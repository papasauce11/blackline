/**
 * BLACKLINE — main.js
 *
 * Composition root. Owns the renderer, the scene, the one and only camera, the
 * fixed-timestep loop, the event emitter and the mode router.
 *
 * Layering (Section 3.1): main.js may import from anything. Nothing may import
 * main.js. Cross-system messages go through the emitter created here and passed
 * down, never through sibling imports.
 */

import * as THREE from 'three';
import { CONFIG, DEBUG, SETTINGS, rng, deriveSeed } from './config.js';
import { Input } from './input.js';
import { buildMap } from './map.js';
import { classifyLedge } from './physics.js';
import { Shade, SHADE_STATE, createIntent } from './entities/agent.js';
import { Warden, WARDEN_STATE, createWardenIntent } from './entities/enforcer.js';
import { DebugTools } from './ui/debug.js';

// ---------------------------------------------------------------------------
// Event emitter (Section 3.1). Small on purpose.
// ---------------------------------------------------------------------------

class Emitter {
  constructor() {
    this._handlers = new Map();
  }

  /** @returns {() => void} unsubscribe */
  on(event, handler) {
    if (!this._handlers.has(event)) this._handlers.set(event, []);
    this._handlers.get(event).push(handler);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    const wrapped = (payload) => {
      this.off(event, wrapped);
      handler(payload);
    };
    return this.on(event, wrapped);
  }

  off(event, handler) {
    const list = this._handlers.get(event);
    if (!list) return;
    const index = list.indexOf(handler);
    if (index !== -1) list.splice(index, 1);
    if (list.length === 0) this._handlers.delete(event);
  }

  /**
   * Invoke every listener. A throwing listener is reported and the rest still
   * run, so one broken system cannot silently disable the ones after it.
   * @returns {number} how many listeners were invoked
   */
  emit(event, payload) {
    const list = this._handlers.get(event);
    if (!list || list.length === 0) return 0;
    // Copy: a listener may unsubscribe itself or others during dispatch.
    const snapshot = list.slice();
    for (let i = 0; i < snapshot.length; i++) {
      try {
        snapshot[i](payload);
      } catch (error) {
        console.error(`[emitter] listener for "${event}" threw:`, error);
      }
    }
    return snapshot.length;
  }

  listenerCount(event) {
    const list = this._handlers.get(event);
    return list ? list.length : 0;
  }
}

// ---------------------------------------------------------------------------
// Fixed timestep (Section 15: never integrate with a raw frame delta)
// ---------------------------------------------------------------------------

/**
 * Pure step planner. Extracted so the AUTO suite tests the real scheduling
 * maths rather than a copy of it.
 *
 * Time scale multiplies the accumulator FEED, never the step size. dt handed to
 * the simulation is always exactly CONFIG.time.fixedDt, whatever the time scale
 * or the frame rate.
 *
 * @returns {{steps: number, accumulator: number, dt: number, dropped: boolean}}
 */
export function computeStepPlan(accumulator, wallDelta, timeScale) {
  const dt = CONFIG.time.fixedDt;
  const delta = Number.isFinite(wallDelta) ? Math.max(wallDelta, 0) : 0;
  const scale = Number.isFinite(timeScale) && timeScale > 0 ? timeScale : 0;

  // Clamp before scaling: a tab-switch or a breakpoint must not be able to
  // inject a hundred steps into one frame.
  const clamped = Math.min(delta, CONFIG.time.maxFrameDelta);
  let acc = accumulator + clamped * scale;

  let steps = Math.floor(acc / dt);
  let dropped = false;
  if (steps > CONFIG.time.maxStepsPerFrame) {
    steps = CONFIG.time.maxStepsPerFrame;
    // Drain rather than carry: carrying a backlog is how a hitch turns into a
    // permanent spiral of death.
    acc = 0;
    dropped = true;
  } else {
    acc -= steps * dt;
  }

  return { steps, accumulator: acc, dt, dropped };
}

// ---------------------------------------------------------------------------
// Engine singletons
// ---------------------------------------------------------------------------

/** @type {THREE.WebGLRenderer} */ let renderer = null;
/** @type {THREE.Scene} */ let scene = null;
/** @type {THREE.PerspectiveCamera} */ let camera = null;
/** @type {Input} */ let input = null;
/** @type {DebugTools} */ let debugTools = null;
/** @type {import('./map.js').GameMap} */ let map = null;
/** @type {THREE.DataTexture} */ let gradientMap = null;
/** @type {Shade} */ let shade = null;
/** @type {Warden} */ let warden = null;
const shadeIntent = createIntent();
const wardenIntent = createWardenIntent();
/**
 * What the Warden does while nothing is driving it. In competitive the AI takes
 * over in Phase 6; until then it still needs stepping so gravity settles it
 * onto its spawn rather than leaving it hovering.
 */
const wardenIdleIntent = createWardenIntent();

/** 'freefly' | 'shade' | 'warden'. The one camera is reparented, never rebuilt. */
let cameraOwner = null;

const emitter = new Emitter();

/** Shared field bag the F3 overlay renders. Systems write their own keys. */
const debugState = {};

/**
 * Wall clock is unscaled and is what the finisher and reinsert hard guards run
 * on (Section 8.3, Section 15). Sim clock is time-scaled.
 */
const clock = { wall: 0, sim: 0, frame: 0, timeScale: 1 };

let timeScaleIndex = 0;
let accumulator = 0;
let lastFrameTime = 0;
let frameHandle = 0;
let running = false;

/** Guard for the risk-register rule: exactly one camera object, ever. */
let camerasCreated = 0;

// Spec speeds, hoisted so the AUTO checks read against the config rather than
// against literals typed twice.
/** An intent that counts as heading into a ledge, for tests that call the
 *  traversal helpers directly rather than driving them through step(). */
const APPROACHING = (() => {
  const intent = createIntent();
  intent.forward = 1;
  return intent;
})();

const S_WALK = CONFIG.shade.walkSpeed;
const S_SPRINT = CONFIG.shade.sprintSpeed;
const S_CROUCH = CONFIG.shade.crouchSpeed;

/** @type {object|null} current match state */
let match = null;

// ---------------------------------------------------------------------------
// Match state
// ---------------------------------------------------------------------------

/**
 * Defaults factory for match-level mutable state (Section 15). Every field is
 * rebuilt here so nothing can carry between matches by accident. Round-level
 * state gets its own factory in systems/objective.js.
 */
function createMatchState(options, seed) {
  const length = CONFIG.match.lengths[options.matchLength] ? options.matchLength : CONFIG.match.defaultLength;
  return {
    mode: options.mode,
    role: options.role,
    aiEnabled: options.ai,
    objectiveEnabled: options.objective,
    difficulty: options.difficulty,
    seed,
    matchLength: length,
    winsNeeded: CONFIG.match.lengths[length],
    roundNumber: 1,
    score: { shade: 0, warden: 0 },
    rounds: [],
    over: false,
  };
}

/**
 * Single entry point for both modes (Section 12, Section 15). Free-roam is a
 * configuration of this call, never a duplicated code path.
 *
 * @param {object} [options]
 * @param {'competitive'|'freeroam'} [options.mode]
 * @param {'shade'|'warden'} [options.role]
 * @param {boolean} [options.ai]
 * @param {boolean} [options.objective]
 * @param {number} [options.seed] explicit seed, for reproducing a bug
 */
export function initMatch(options = {}) {
  const opts = {
    mode: 'competitive',
    role: CONFIG.match.humanRole,
    ai: true,
    objective: true,
    matchLength: SETTINGS.matchLength,
    difficulty: SETTINGS.difficulty,
    ...options,
  };

  const seed = rng.reseed(
    opts.seed !== undefined ? opts.seed : deriveSeed(typeof location !== 'undefined' ? location.search : '')
  );

  match = createMatchState(opts, seed);

  debugState.seed = seed;
  debugState.mode = `${match.mode}/${match.role}`;
  debugState.rngCalls = 0;

  // Rebuild actor state too, and force a camera handover so nothing from the
  // previous match's owner survives (Section 15).
  if (shade) shade.reset(map.shadeSpawns[0]);
  if (warden) warden.reset(map.wardenSpawns[0]);
  cameraOwner = null;

  emitter.emit('match:init', match);

  if (!running) start();
  return match;
}

// ---------------------------------------------------------------------------
// Time scale
// ---------------------------------------------------------------------------

/** Set the simulation time scale. The finisher (Section 8.3) drives this. */
export function setTimeScale(value) {
  clock.timeScale = Number.isFinite(value) && value > 0 ? value : 1;
  debugState.timeScale = clock.timeScale;
}

function cycleTimeScale() {
  const cycle = CONFIG.time.timeScaleCycle;
  timeScaleIndex = (timeScaleIndex + 1) % cycle.length;
  setTimeScale(cycle[timeScaleIndex]);
  if (debugTools) debugTools.logResult(`time scale ${clock.timeScale}x`);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function bootstrap() {
  const canvas = document.getElementById('bl-canvas');
  if (!canvas) throw new Error('bootstrap: #bl-canvas not found');

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: CONFIG.render.antialias,
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.render.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Filmic tone mapping flattens toon banding and desaturates the palette.
  // Section 4 asks for saturated, high contrast, so it stays off.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = CONFIG.render.toneMappingExposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.render.clearColor);
  scene.fog = new THREE.FogExp2(CONFIG.render.fogColor, CONFIG.render.fogDensity);

  camera = createCamera();
  scene.add(camera);

  // Section 4: 4-step gradient map generated in code via DataTexture. Created
  // here in the composition root and passed down, because both map.js and
  // entities/ need it and neither may import the other (Section 3.1).
  gradientMap = createToonGradient(CONFIG.render.toonSteps);

  map = buildMap({ gradientMap });
  scene.add(map.root);

  debugState.collisionBoxes = map.collision.boxCount;
  debugState.mapLedges = map.ledges.length;

  shade = new Shade({ collision: map.collision, gradientMap, emitter });
  scene.add(shade.mesh);
  scene.add(shade.groundBlob);
  scene.add(shade.cameraRig);
  shade.reset(map.shadeSpawns[0]);

  warden = new Warden({ collision: map.collision, gradientMap, emitter });
  scene.add(warden.mesh);
  scene.add(warden.groundBlob);
  scene.add(warden.cameraRig);
  warden.reset(map.wardenSpawns[0]);

  freefly.enabled = false;
  freefly.position.copy(map.shadeSpawns[0].position).setY(map.shadeSpawns[0].position.y + 1.7);

  input = new Input(canvas);
  canvas.addEventListener('mousedown', () => input.requestLock());

  window.addEventListener('resize', onResize);

  debugTools = new DebugTools({ input, emitter, debugState, harness });
  registerDebugAssertions();
  registerAutoTests();
  wireTestCommands();

  setTimeScale(1);
  debugState.stepsPerFrame = 0;
}

/**
 * Section 4: a 4-step toon ramp. The shader samples the red channel
 * (`texture2D(gradientMap, coord).r`), so a single-channel RedFormat texture
 * with nearest filtering gives hard bands.
 */
function createToonGradient(steps) {
  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) {
    data[i] = Math.round((i / (steps - 1)) * 255);
  }
  const texture = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Risk register: "One camera object. Reparent and adjust FOV only. Never
 * instantiate a second camera." This is the only place a camera is made, and it
 * refuses to make a second one.
 */
function createCamera() {
  if (camerasCreated > 0) {
    throw new Error('createCamera: a second camera was requested. Reparent the existing one instead.');
  }
  camerasCreated++;
  const cam = new THREE.PerspectiveCamera(
    CONFIG.render.fov,
    window.innerWidth / window.innerHeight,
    CONFIG.render.near,
    CONFIG.render.far
  );
  cam.name = 'bl-camera';
  return cam;
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.render.maxPixelRatio));
  renderer.setSize(width, height, false);
  emitter.emit('view:resize', { width, height });
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

function start() {
  if (running) return;
  running = true;
  lastFrameTime = 0;
  accumulator = 0;
  frameHandle = requestAnimationFrame(frame);
}

function stop() {
  running = false;
  if (frameHandle) cancelAnimationFrame(frameHandle);
  frameHandle = 0;
}

/**
 * One fixed simulation step. dt is always CONFIG.time.fixedDt.
 * @param {number} dt
 */
function fixedStep(dt) {
  clock.sim += dt;
  map.update(dt);

  if (freefly.enabled) {
    freefly.step(dt);
    warden.step(dt, wardenIdleIntent);
    shade.step(dt, shadeIdleIntent());
  } else if (match.role === 'warden') {
    // Free-roam (Section 12): the human drives the Warden through the very same
    // controller the AI will drive in Phase 6.
    warden.step(dt, readWardenIntent());
  } else {
    shade.step(dt, readShadeIntent());
    // Nothing is driving the Warden until the AI lands in Phase 6, but it still
    // needs stepping so gravity settles it onto its spawn.
    warden.step(dt, wardenIdleIntent);
  }

  emitter.emit('sim:step', dt);
  if (DEBUG) debugTools.step();
}

/**
 * Translate raw input into the controller's intent object. Reusing one object
 * keeps the fixed step allocation-free. Edge flags are true only on the first
 * step of a frame, because input.clearEdges() runs after each step.
 */
function readShadeIntent() {
  shadeIntent.forward = input.axis('back', 'forward');
  shadeIntent.strafe = input.axis('left', 'right');
  shadeIntent.jump = input.down('jump');
  shadeIntent.jumpPressed = input.pressed('jump');
  shadeIntent.crouch = input.down('crouch');
  shadeIntent.crouchPressed = input.pressed('crouch');
  shadeIntent.sprint = input.down('sprint');
  return shadeIntent;
}

/** Neutral Shade intent, for when the human is driving something else. */
function shadeIdleIntent() {
  shadeIntent.forward = 0;
  shadeIntent.strafe = 0;
  shadeIntent.jump = false;
  shadeIntent.jumpPressed = false;
  shadeIntent.crouch = false;
  shadeIntent.crouchPressed = false;
  shadeIntent.sprint = false;
  return shadeIntent;
}

/** Section 12: free-roam feeds the same controller the AI will feed. */
function readWardenIntent() {
  wardenIntent.forward = input.axis('back', 'forward');
  wardenIntent.strafe = input.axis('left', 'right');
  wardenIntent.sprint = input.down('sprint');
  wardenIntent.ads = input.down('ads');
  wardenIntent.fire = input.down('fire');
  wardenIntent.reload = input.pressed('reload');
  return wardenIntent;
}

/**
 * Move the one camera between rigs.
 *
 * Risk register (Section 15): "Camera state leaks between roles or after the
 * finisher — one camera object. Reparent and adjust FOV only. Never instantiate
 * a second camera."
 *
 * Every swap resets the full local transform and the FOV, so nothing a previous
 * owner did can survive the handover. The Warden's ADS narrows the FOV
 * (Section 6.2); without the reset here, swapping away mid-aim would leave the
 * Shade permanently zoomed.
 *
 * @param {'freefly'|'shade'|'warden'} owner
 */
function setCameraOwner(owner) {
  if (cameraOwner === owner) return;

  const parent =
    owner === 'warden' ? warden.cameraRig : owner === 'shade' ? shade.cameraRig : scene;

  parent.add(camera);
  camera.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);
  camera.scale.set(1, 1, 1);
  camera.fov = CONFIG.render.fov;
  camera.updateProjectionMatrix();

  warden.setFirstPerson(owner === 'warden');
  cameraOwner = owner;
  emitter.emit('camera:owner', owner);
}

/** Who the human is currently driving. */
function humanOwner() {
  if (freefly.enabled) return 'freefly';
  return match && match.role === 'warden' ? 'warden' : 'shade';
}

// ---------------------------------------------------------------------------
// Freefly camera
//
// The Phase 2 exit gate is "freefly the whole map, every usable ledge marked".
// Until the Shade controller exists there is nothing else driving the camera,
// so this owns it. It moves the one camera object; it never creates another.
// ---------------------------------------------------------------------------

const freefly = {
  enabled: true,
  yaw: Math.PI,
  pitch: -0.15,
  speed: CONFIG.shade.walkSpeed * 2,
  position: new THREE.Vector3(-27, 1.7, 19),

  look() {
    if (!this.enabled || !input.locked) return;
    const delta = input.lookDelta();
    this.yaw += delta.yaw;
    this.pitch = Math.max(
      CONFIG.shade.camera.pitchMin,
      Math.min(CONFIG.shade.camera.pitchMax, this.pitch + delta.pitch)
    );
  },

  step(dt) {
    if (!this.enabled) return;
    const forward = input.axis('back', 'forward');
    const strafe = input.axis('left', 'right');
    const lift = (input.down('jump') ? 1 : 0) - (input.down('crouch') ? 1 : 0);
    const speed = this.speed * (input.down('sprint') ? 3 : 1);

    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);

    // Forward follows the aim so you can fly up to a catwalk to inspect it.
    const fx = -sinYaw * cosPitch;
    const fy = sinPitch;
    const fz = -cosYaw * cosPitch;
    const rx = cosYaw;
    const rz = -sinYaw;

    this.position.x += (fx * forward + rx * strafe) * speed * dt;
    this.position.y += (fy * forward + lift) * speed * dt;
    this.position.z += (fz * forward + rz * strafe) * speed * dt;
  },

  apply() {
    if (!this.enabled) return;
    camera.position.copy(this.position);
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  },
};

function frame(now) {
  frameHandle = requestAnimationFrame(frame);

  const wallDelta = lastFrameTime === 0 ? 0 : (now - lastFrameTime) / 1000;
  lastFrameTime = now;
  clock.wall += wallDelta;
  clock.frame++;

  // Before the steps: a step clears input edges, which would eat F3/F4.
  debugTools.pollKeys();

  // Mouse delta is a displacement, not a rate, so look is applied once per
  // frame rather than once per fixed step.
  const owner = humanOwner();
  setCameraOwner(owner);
  if (owner === 'freefly') {
    freefly.look();
  } else if (input.locked) {
    // ADS uses a reduced sensitivity so the narrower FOV still tracks 1:1.
    const scale = owner === 'warden' && warden.ads ? CONFIG.settings.adsSensitivityMultiplier : 1;
    const delta = input.lookDelta(scale);
    if (owner === 'warden') warden.look(delta.yaw, delta.pitch);
    else shade.look(delta.yaw, delta.pitch);
  }
  emitter.emit('frame:begin', { wallDelta, input });

  const plan = computeStepPlan(accumulator, wallDelta, clock.timeScale);
  accumulator = plan.accumulator;
  for (let i = 0; i < plan.steps; i++) {
    fixedStep(plan.dt);
    input.clearEdges();
  }
  debugState.stepsPerFrame = plan.steps;

  const alpha = accumulator / plan.dt;
  if (owner === 'freefly') freefly.apply();
  shade.updateVisual(wallDelta);
  warden.updateVisual(wallDelta);

  // Section 6.2: ADS narrows the FOV. Only the Warden touches it, and only
  // while it owns the camera; setCameraOwner() restores it on every handover.
  if (owner === 'warden') {
    const fov = warden.desiredFov();
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  emitter.emit('frame:render', { alpha, wallDelta });

  const cpuStart = performance.now();
  renderer.render(scene, camera);
  debugState.cpuMs = performance.now() - cpuStart;
  debugState.drawCalls = renderer.info.render.calls;
  debugState.triangles = renderer.info.render.triangles;
  debugState.rngCalls = rng.calls;
  debugState.shadeState = shade.state + (shade.crouching ? ' (crouch)' : '');
  debugState.shadePos = shade.position;
  debugState.shadeVel = shade.velocity;
  debugState.shadeLives = shade.lives;
  debugState.shadeGrounded = shade.grounded ? 'yes' : 'no';
  debugState.cameraOwner = `${cameraOwner} (fov ${camera.fov.toFixed(1)})`;
  debugState.wardenState = warden.state + (warden.ads ? ' (ads)' : '');
  debugState.wardenPos = warden.position;
  debugState.wardenHealth = warden.health;

  debugTools.update(wallDelta, wallDelta * 1000);
  input.endFrame();
}

// ---------------------------------------------------------------------------
// Test-mode commands owned by the engine (Section 17.1)
//
// Only the commands whose subsystem exists are wired here. Gameplay commands
// are claimed by their own systems as those phases land; until then the F4
// panel reports "no handler yet" rather than pretending to have worked.
// ---------------------------------------------------------------------------

function wireTestCommands() {
  emitter.on('test:cycle-time-scale', cycleTimeScale);
}

// ---------------------------------------------------------------------------
// Runtime assertions (Section 17)
// ---------------------------------------------------------------------------

function registerDebugAssertions() {
  debugTools.registerAssertion('core-finite', () => {
    if (!Number.isFinite(clock.sim) || !Number.isFinite(clock.wall)) return 'clock is not finite';
    if (!Number.isFinite(accumulator)) return 'accumulator is not finite';
    const p = camera.position;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
      return `camera position contains NaN (${p.x}, ${p.y}, ${p.z})`;
    }
    return null;
  });

  debugTools.registerAssertion('time-scale-valid', () =>
    Number.isFinite(clock.timeScale) && clock.timeScale > 0 ? null : `time scale is ${clock.timeScale}`
  );

  // Section 17: "Player Y is never below the floor plane minus 0.5" and
  // "Position and velocity never contain NaN".
  debugTools.registerAssertion('shade-above-floor', () => {
    const limit = CONFIG.map.groundY - CONFIG.debug.floorTolerance;
    return shade.feetY < limit ? `shade feet at y=${shade.feetY.toFixed(3)}, floor limit ${limit}` : null;
  });

  debugTools.registerAssertion('shade-finite', () => {
    const p = shade.position;
    const v = shade.velocity;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
      return `position contains NaN (${p.x}, ${p.y}, ${p.z})`;
    }
    if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) {
      return `velocity contains NaN (${v.x}, ${v.y}, ${v.z})`;
    }
    return null;
  });

  debugTools.registerAssertion('shade-state-valid', () => {
    for (const key of Object.keys(SHADE_STATE)) {
      if (SHADE_STATE[key] === shade.state) return null;
    }
    return `shade in unknown state "${shade.state}"`;
  });

  debugTools.registerAssertion('single-camera', () => {
    let count = 0;
    scene.traverse((object) => {
      if (object.isCamera) count++;
    });
    return count === 1 ? null : `${count} cameras in the scene graph, expected 1`;
  });
}

// ---------------------------------------------------------------------------
// AUTO test suite (Section 16 / Section 17.1 "Y")
//
// Only checks that genuinely exercise built code are registered. Later phases
// register their own. The suite never reports a check it did not run.
// ---------------------------------------------------------------------------

function registerAutoTests() {
  debugTools.registerAutoTest({
    id: 'prng-determinism',
    spec: 'check 28 (part)',
    name: 'Same seed reproduces an identical random sequence',
    run: () => {
      const n = CONFIG.debug.prngCompareCount;
      const restoreSeed = rng.seed;

      rng.reseed(0x5eed1234);
      const first = [];
      for (let i = 0; i < n; i++) first.push(rng.next());

      rng.reseed(0x5eed1234);
      let identical = 0;
      for (let i = 0; i < n; i++) if (rng.next() === first[i]) identical++;

      rng.reseed(0x5eed1235);
      let differing = 0;
      for (let i = 0; i < n; i++) if (rng.next() !== first[i]) differing++;

      rng.reseed(restoreSeed);

      const pass = identical === n && differing > n * 0.99;
      return {
        pass,
        detail: `${identical}/${n} identical on same seed, ${differing}/${n} differ on seed+1`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'prng-range-bounds',
    spec: 'Section 2 (seeded RNG)',
    name: 'Seeded RNG helpers stay in bounds',
    run: () => {
      const restoreSeed = rng.seed;
      rng.reseed(0xa11ce);
      let bad = 0;
      const n = CONFIG.debug.prngCompareCount;
      for (let i = 0; i < n; i++) {
        const v = rng.next();
        if (!(v >= 0 && v < 1)) bad++;
        const r = rng.range(-3, 7);
        if (!(r >= -3 && r < 7)) bad++;
        const k = rng.int(2, 5);
        if (!(k >= 2 && k <= 5 && Number.isInteger(k))) bad++;
        const u = rng.unit();
        if (!(u >= -1 && u < 1)) bad++;
      }
      rng.reseed(restoreSeed);
      return { pass: bad === 0, detail: `${bad} out-of-range values across ${n * 4} draws` };
    },
  });

  debugTools.registerAutoTest({
    id: 'fixed-timestep-invariants',
    spec: 'Section 15 (fall through floor)',
    name: 'Step size is always fixedDt and steps per frame are capped',
    run: () => {
      const dt = CONFIG.time.fixedDt;
      const deltas = [0, 0.001, 1 / 240, 1 / 60, 1 / 30, 0.1, 0.5, 4, 60, NaN, -1, Infinity];
      const scales = [1, 0.05, 0.25, 4];
      let violations = 0;
      let maxSteps = 0;
      let acc = 0;

      for (const scale of scales) {
        for (const delta of deltas) {
          const plan = computeStepPlan(acc, delta, scale);
          if (plan.dt !== dt) violations++;
          if (plan.steps > CONFIG.time.maxStepsPerFrame) violations++;
          if (!Number.isFinite(plan.accumulator) || plan.accumulator < 0) violations++;
          if (plan.accumulator >= dt && !plan.dropped) violations++;
          maxSteps = Math.max(maxSteps, plan.steps);
          acc = plan.accumulator;
        }
      }
      return {
        pass: violations === 0,
        detail: `${violations} violations over ${deltas.length * scales.length} plans, max ${maxSteps} steps/frame (cap ${CONFIG.time.maxStepsPerFrame})`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'timescale-scales-feed-not-dt',
    spec: 'Section 8.3 / Section 15',
    name: 'Time scale changes simulation rate without changing step size',
    run: () => {
      const dt = CONFIG.time.fixedDt;
      const wall = 1.0; // one second of wall clock, delivered in 1/60s frames
      const frameDelta = 1 / 60;
      const frames = Math.round(wall / frameDelta);

      const simulate = (scale) => {
        let acc = 0;
        let steps = 0;
        for (let i = 0; i < frames; i++) {
          const plan = computeStepPlan(acc, frameDelta, scale);
          acc = plan.accumulator;
          steps += plan.steps;
          if (plan.dt !== dt) return -1;
        }
        return steps;
      };

      const full = simulate(1);
      const quarter = simulate(0.25);
      const hitStop = simulate(CONFIG.finisher.hitStopTimeScale);

      // 1s at 60Hz is ~60 steps; a quarter time scale is ~15; hit-stop ~3.
      const okFull = Math.abs(full - 60) <= 1;
      const okQuarter = Math.abs(quarter - 15) <= 1;
      const okHitStop = Math.abs(hitStop - 60 * CONFIG.finisher.hitStopTimeScale) <= 1;

      return {
        pass: okFull && okQuarter && okHitStop,
        detail: `1s of wall clock -> ${full} steps at 1x, ${quarter} at 0.25x, ${hitStop} at ${CONFIG.finisher.hitStopTimeScale}x`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'single-camera-object',
    spec: 'Section 15 (camera state leak)',
    name: 'Exactly one camera object exists and it is the engine camera',
    run: (h) => {
      let count = 0;
      let isEngineCamera = false;
      h.scene.traverse((object) => {
        if (object.isCamera) {
          count++;
          if (object === h.camera) isEngineCamera = true;
        }
      });
      let refused = false;
      try {
        createCamera();
      } catch (error) {
        refused = true;
      }
      return {
        pass: count === 1 && isEngineCamera && refused,
        detail: `${count} camera(s) in graph, isEngineCamera=${isEngineCamera}, second instantiation refused=${refused}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'emitter-contract',
    spec: 'Section 3.1 (cross-system messaging)',
    name: 'Emitter dispatches, reports listener count, unsubscribes cleanly',
    run: (h) => {
      const event = '__auto_test_probe';
      let calls = 0;
      const offA = h.emitter.on(event, () => calls++);
      const offB = h.emitter.on(event, () => calls++);
      const handledFirst = h.emitter.emit(event, null);
      const callsAfterFirst = calls;

      // once() must fire exactly once and unsubscribe itself.
      let onceCalls = 0;
      h.emitter.once(event, () => onceCalls++);
      h.emitter.emit(event, null);
      h.emitter.emit(event, null);

      // A throwing listener must not stop the ones registered after it.
      let afterThrow = 0;
      const offThrow = h.emitter.on(event, () => {
        throw new Error('deliberate');
      });
      const offAfter = h.emitter.on(event, () => afterThrow++);
      const suppressed = console.error;
      console.error = () => {};
      const handledLast = h.emitter.emit(event, null);
      console.error = suppressed;

      offA();
      offB();
      offThrow();
      offAfter();
      const remaining = h.emitter.listenerCount(event);
      const unhandled = h.emitter.emit(event, null);

      const pass =
        callsAfterFirst === 2 &&
        handledFirst === 2 &&
        onceCalls === 1 &&
        handledLast === 4 &&
        afterThrow === 1 &&
        remaining === 0 &&
        unhandled === 0;
      return {
        pass,
        detail: `firstEmit=${callsAfterFirst}/reported ${handledFirst}, once fired ${onceCalls}x, lastEmit reported ${handledLast}, survivedThrow=${afterThrow}, residual=${remaining}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'no-nan-after-sustained-stepping',
    spec: 'Section 17 (runtime assertions)',
    name: 'Core state stays finite across sustained simulation',
    run: (h) => {
      const before = h.debugTools.assertionFailures;
      const steps = 600; // 10 seconds of simulation
      h.stepFrames(steps);
      const p = h.camera.position;
      const finite =
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        Number.isFinite(p.z) &&
        Number.isFinite(h.clock.sim) &&
        Number.isFinite(h.clock.wall);
      const newFailures = h.debugTools.assertionFailures - before;
      return {
        pass: finite && newFailures === 0,
        detail: `${steps} steps, sim=${h.clock.sim.toFixed(2)}s, finite=${finite}, new assertion failures=${newFailures}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'exactly-one-shadow-caster',
    spec: 'Section 4.1 / check 29',
    name: 'Exactly one shadow-casting light; no point light casts',
    run: (h) => {
      let casters = 0;
      let pointCasters = 0;
      let total = 0;
      h.scene.traverse((object) => {
        if (!object.isLight) return;
        total++;
        if (object.castShadow) casters++;
        if (object.isPointLight && object.castShadow) pointCasters++;
      });
      const size = h.map.keyLight.shadow.mapSize;
      const mapOk = size.x === CONFIG.render.shadowMapSize && size.y === CONFIG.render.shadowMapSize;
      return {
        pass: casters === 1 && pointCasters === 0 && mapOk,
        detail: `${total} lights, ${casters} shadow caster(s), ${pointCasters} shadowed point lights, shadow map ${size.x}x${size.y}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'markings-match-collision-flags',
    spec: 'check 26 (auto half) / Section 15',
    name: 'Every climbable box is marked, in the band its geometry implies',
    run: (h) => {
      let climbable = 0;
      let marked = 0;
      let mismatched = 0;
      const bands = { vault: 0, mantle: 0, hang: 0 };

      for (const box of h.map.collision.boxes) {
        if (!box.climbable) continue;
        climbable++;
        const ledge = h.map.ledges.find((entry) => entry.box === box);
        if (!ledge) continue;
        marked++;
        // Recompute the band independently from the stored rise and compare.
        if (classifyLedge(ledge.rise) !== box.ledgeBand) mismatched++;
        if (box.ledgeBand) bands[box.ledgeBand]++;
      }

      return {
        pass: climbable > 0 && marked === climbable && mismatched === 0,
        detail: `${climbable} climbable, ${marked} marked, ${mismatched} band mismatches (vault ${bands.vault}, mantle ${bands.mantle}, hang ${bands.hang})`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'climbable-surfaces-are-derived-not-hand-flagged',
    spec: 'Section 5 / reported bug',
    name: 'Every standable surface in a traversal band is climbable; exclusions are justified',
    run: (h) => {
      const minSupport = CONFIG.shade.radius * 2;
      const unjustified = [];

      for (const box of h.map.collision.boxes) {
        if (box.climbable || !box.solid) continue;
        // Every non-climbable surface must have a reason. Anything wide enough
        // to stand on, in a traversal band, and not explicitly opted out is an
        // invisible wall on a surface that looks climbable.
        const wideX = box.max.x - box.min.x >= minSupport;
        const wideZ = box.max.z - box.min.z >= minSupport;
        if (!wideX || !wideZ) continue; // too thin to land on
        if (box.noClimb) continue; // deliberate one-way drop
        const standY = h.map._supportHeightBelow(box);
        if (!classifyLedge(box.max.y - standY)) continue; // out of every band
        // Wide, in-band, not opted out: the only remaining excuse is no
        // headroom, which deriveClimbableSurfaces() already tested.
        const headroom = CONFIG.shade.crouchHeight;
        const probeHalf = { x: minSupport * 0.5, y: headroom * 0.5, z: minSupport * 0.5 };
        const point = { x: box.centerX, y: box.max.y + headroom * 0.5 + 0.05, z: box.centerZ };
        if (!h.map.collision.isClear(point, probeHalf)) continue;
        unjustified.push(box.tag);
      }

      // The surfaces a player will obviously try must all be climbable.
      const mustClimb = h.map.collision.boxes.filter((box) =>
        /^(catwalk|walkway|crate|stack|vent-exit|office-cover|server-rack|hall-container)/.test(box.tag)
      );
      const missed = mustClimb.filter((box) => !box.climbable).map((box) => box.tag);

      return {
        pass: unjustified.length === 0 && missed.length === 0 && h.map.ledges.length === h.map.collision.boxes.filter((b) => b.climbable).length,
        detail:
          unjustified.length === 0 && missed.length === 0
            ? `${h.map.ledges.length} climbable surfaces derived and marked; ${mustClimb.length} obvious traversal surfaces all climbable; every exclusion justified (too thin, out of band, no headroom, or noClimb)`
            : `unjustified exclusions: [${unjustified.join(', ')}]; obvious surfaces missed: [${missed.join(', ')}]`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'waypoint-graph-valid',
    spec: 'Section 5 / Section 11',
    name: '14 waypoints, links bidirectional, graph fully connected',
    run: (h) => {
      const nodes = h.map.waypoints;
      let asymmetric = 0;
      for (const node of nodes) {
        for (const other of node.links) {
          if (nodes[other].links.indexOf(node.id) === -1) asymmetric++;
        }
      }
      const seen = new Set([0]);
      const queue = [0];
      while (queue.length) {
        const current = queue.shift();
        for (const next of nodes[current].links) {
          if (!seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      const siteTags = ['site-a', 'site-b', 'site-c'];
      const sitesCovered = siteTags.filter((tag) => nodes.some((n) => n.tag === tag)).length;
      const pass =
        nodes.length === CONFIG.map.waypointCount &&
        asymmetric === 0 &&
        seen.size === nodes.length &&
        sitesCovered === 3;
      return {
        pass,
        detail: `${nodes.length} nodes, ${asymmetric} asymmetric links, ${seen.size} reachable from node 0, ${sitesCovered}/3 sites covered`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'swept-collision-no-tunnelling',
    spec: 'check 1 (auto half) / Section 15',
    name: 'An actor driven into a wall at extreme speed never passes through',
    run: (h) => {
      const world = h.map.collision;
      const half = { x: CONFIG.shade.radius, y: CONFIG.shade.standHeight / 2, z: CONFIG.shade.radius };
      const dt = CONFIG.time.fixedDt;
      const speeds = [6.5, 50, 200, 1000];
      let breaches = 0;
      const details = [];

      for (const speed of speeds) {
        // Start inside the Turbine Hall and drive due west into the perimeter
        // wall, whose inner face is at x = -30.
        const position = { x: -20, y: half.y + 0.05, z: -4 };
        const velocity = { x: -speed, y: 0, z: 0 };
        for (let i = 0; i < 180; i++) {
          velocity.x = -speed;
          world.moveAndSlide(position, half, velocity, dt, {
            groundNormalY: CONFIG.shade.groundNormalY,
            stepHeight: CONFIG.shade.stepHeight,
            wasGrounded: true,
          });
        }
        const insideWall = position.x < -30 + half.x - 0.05;
        if (insideWall) breaches++;
        details.push(`${speed}m/s -> x=${position.x.toFixed(3)}`);
      }

      return {
        pass: breaches === 0,
        detail: `${breaches} breaches; ${details.join(', ')} (wall face at x=-30)`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'spawns-and-sites-clear',
    spec: 'Section 5 / Section 10.2',
    name: 'No spawn or plant site is embedded in geometry',
    run: (h) => {
      const world = h.map.collision;
      const blocked = [];

      const check = (label, position, radius, height) => {
        const half = { x: radius, y: height / 2, z: radius };
        const centre = { x: position.x, y: position.y + height / 2 + 0.02, z: position.z };
        const hit = world.overlap(centre, half);
        if (hit) blocked.push(`${label} in "${hit.tag}"`);
      };

      h.map.shadeSpawns.forEach((spawn, i) =>
        check(`shade spawn ${i}`, spawn.position, CONFIG.shade.radius, CONFIG.shade.standHeight)
      );
      h.map.wardenSpawns.forEach((spawn, i) =>
        check(`warden spawn ${i}`, spawn.position, CONFIG.warden.radius, CONFIG.warden.standHeight)
      );
      h.map.sites.forEach((site) =>
        check(`site ${site.id}`, site.position, CONFIG.shade.radius, CONFIG.shade.standHeight)
      );
      h.map.waypoints.forEach((node) =>
        check(`waypoint ${node.id} (${node.tag})`, node.position, CONFIG.warden.radius, CONFIG.warden.standHeight)
      );

      return {
        pass: blocked.length === 0,
        detail:
          blocked.length === 0
            ? `${h.map.shadeSpawns.length} shade spawns, ${h.map.wardenSpawns.length} warden spawns, ${h.map.sites.length} sites, ${h.map.waypoints.length} waypoints all clear`
            : blocked.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'light-break-is-permanent',
    spec: 'Section 5 / Section 7.1',
    name: 'Breaking a light zeroes its intensity, darkens the glass, and sticks',
    run: (h) => {
      const target = h.map.lights.find((entry) => !entry.broken);
      if (!target) return { pass: false, detail: 'no unbroken light to test' };
      const beforeActive = h.map.activeLights().length;
      const beforeIntensity = target.light.intensity;

      const first = h.map.breakLight(target.lightId);
      const second = h.map.breakLight(target.lightId); // must be a no-op
      const afterActive = h.map.activeLights().length;

      const pass =
        first !== null &&
        second === null &&
        target.broken === true &&
        target.light.intensity === 0 &&
        beforeIntensity > 0 &&
        afterActive === beforeActive - 1;

      // Restore so the suite does not leave the map dark for the next run.
      target.broken = false;
      target.light.intensity = beforeIntensity;
      target.glassMaterial.color.set(CONFIG.palette.lightWarm);

      return {
        pass,
        detail: `active ${beforeActive} -> ${afterActive}, intensity ${beforeIntensity} -> 0, repeat break returned null=${second === null}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'shade-invariants-under-fuzz',
    spec: 'Section 17 / phase 3 exit gate',
    name: 'Seeded random input never produces NaN or puts the Shade below the floor',
    run: (h) => {
      const restoreSeed = rng.seed;
      rng.reseed(0xf0f0f0);

      const intent = createIntent();
      const dt = CONFIG.time.fixedDt;
      const steps = 7200; // two simulated minutes
      const limit = CONFIG.map.groundY - CONFIG.debug.floorTolerance;

      let nan = 0;
      let belowFloor = 0;
      let badState = 0;
      let minFeet = Infinity;
      let maxSpeed = 0;
      const visited = new Set();
      const validStates = Object.keys(SHADE_STATE).map((k) => SHADE_STATE[k]);

      // Start from each spawn in turn so the fuzz covers the whole map.
      for (let spawnIndex = 0; spawnIndex < h.map.shadeSpawns.length; spawnIndex++) {
        h.shade.reset(h.map.shadeSpawns[spawnIndex]);

        for (let i = 0; i < steps / h.map.shadeSpawns.length; i++) {
          // Re-roll the intent occasionally so the Shade commits to a direction
          // long enough to actually reach geometry and attempt traversal.
          if (i % 12 === 0) {
            intent.forward = rng.int(-1, 1);
            intent.strafe = rng.int(-1, 1);
            intent.sprint = rng.chance(0.45);
            intent.crouch = rng.chance(0.25);
            h.shade.look(rng.unit() * 0.9, rng.unit() * 0.25);
          }
          intent.jumpPressed = rng.chance(0.06);
          intent.crouchPressed = rng.chance(0.05);
          intent.jump = intent.jumpPressed;

          h.shade.step(dt, intent);

          const p = h.shade.position;
          const v = h.shade.velocity;
          if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) nan++;
          if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) nan++;
          if (h.shade.feetY < limit) belowFloor++;
          if (validStates.indexOf(h.shade.state) === -1) badState++;
          minFeet = Math.min(minFeet, h.shade.feetY);
          maxSpeed = Math.max(maxSpeed, h.shade.speed);
          visited.add(h.shade.state);
        }
      }

      rng.reseed(restoreSeed);
      h.shade.reset(h.map.shadeSpawns[0]);

      return {
        pass: nan === 0 && belowFloor === 0 && badState === 0,
        detail: `${steps} steps: ${nan} NaN, ${belowFloor} below floor, ${badState} bad states, lowest feet y=${minFeet.toFixed(3)} (limit ${limit}), peak speed ${maxSpeed.toFixed(2)}m/s, states seen [${[...visited].join(' ')}]`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'parkour-safety-gate',
    spec: 'Section 6.1 / check 4',
    name: 'A traversal move into blocked space is refused, leaving state untouched',
    run: (h) => {
      h.shade.reset(h.map.shadeSpawns[0]);
      const stateBefore = h.shade.state;
      const posBefore = h.shade.position.clone();

      // A destination buried inside the west perimeter wall.
      const blocked = { x: -30.2, y: 1.0, z: 0 };
      const refused = h.shade._commitMove(SHADE_STATE.MANTLE, blocked, 0.5, CONFIG.shade.standHeight) === false;
      const unchanged =
        h.shade.state === stateBefore &&
        h.shade.position.distanceTo(posBefore) < 1e-9 &&
        h.shade._move === null;

      // And a clear destination is accepted, so the gate is not simply always
      // saying no.
      const clear = { x: -18, y: CONFIG.shade.standHeight / 2 + 0.1, z: -4 };
      const accepted = h.shade._commitMove(SHADE_STATE.MANTLE, clear, 0.5, CONFIG.shade.standHeight) === true;
      h.shade.reset(h.map.shadeSpawns[0]);

      return {
        pass: refused && unchanged && accepted,
        detail: `blocked destination refused=${refused}, state/position untouched=${unchanged}, clear destination accepted=${accepted}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'failed-mantle-becomes-hang',
    spec: 'Section 6.1 / check 6',
    name: 'A ledge above the mantle band triggers a hang; pull up and drop both work',
    run: (h) => {
      const container = h.map.collision.boxes.find((box) => box.tag === 'hall-container');
      if (!container) return { pass: false, detail: 'hall-container missing from the map' };

      const approach = () => {
        h.shade.reset(h.map.shadeSpawns[0]);
        // Airborne just off the container's east face, facing into it.
        // Feet at 0.5 so the 3.0m top is a 2.5m rise — above the mantle band.
        h.shade.position.set(container.max.x + 0.75, 0.5 + CONFIG.shade.standHeight / 2, -8.5);
        h.shade.velocity.set(0, 0, 0);
        h.shade.yaw = Math.PI / 2; // face -X, into the container
        h.shade.state = SHADE_STATE.AIR;
      };

      approach();
      const ledge = h.shade._probeLedge(CONFIG.shade.mantleReach);
      const grabbed = h.shade._tryMantle(APPROACHING);
      const hangState = h.shade.state;
      const hangClear = h.map.collision.isClear(h.shade.position, h.shade.half);
      const hangFeet = h.shade.feetY;

      // Releasing everything must leave the Shade hanging, not auto-resolve.
      for (let i = 0; i < 60; i++) h.shade.step(CONFIG.time.fixedDt, createIntent());
      const stillHanging = h.shade.state === SHADE_STATE.HANG;

      // Pull up with jump HELD and never freshly pressed. This is the exact
      // case that failed in play: the ledge is grabbed mid-jump with the key
      // already down, so no keydown edge is ever generated and an
      // edge-triggered pull-up would wait forever.
      const heldJump = createIntent();
      heldJump.jump = true;
      heldJump.jumpPressed = false;
      let pullingUp = false;
      for (let i = 0; i < 120; i++) {
        const before = h.shade.state;
        h.shade.step(CONFIG.time.fixedDt, heldJump);
        if (before === SHADE_STATE.HANG && h.shade.state === SHADE_STATE.PULLUP) {
          pullingUp = true;
          break;
        }
      }

      for (let i = 0; i < 150; i++) h.shade.step(CONFIG.time.fixedDt, createIntent());
      const onTop = h.shade.feetY > container.max.y - 0.25;
      const topClear = h.map.collision.isClear(h.shade.position, h.shade.half);

      // On a FRESH grab with jump already held, the pull-up must wait out the
      // grace period so the grab reads as its own beat rather than resolving on
      // the frame the ledge is caught.
      approach();
      h.shade._tryMantle(APPROACHING);
      let stepsToPullUp = 0;
      for (let i = 0; i < 120; i++) {
        h.shade.step(CONFIG.time.fixedDt, heldJump);
        stepsToPullUp++;
        if (h.shade.state === SHADE_STATE.PULLUP) break;
      }
      const graceSteps = Math.ceil(CONFIG.shade.hangInputGrace / CONFIG.time.fixedDt);
      const graceRespected = stepsToPullUp >= graceSteps && stepsToPullUp <= graceSteps + 2;

      // Drop with crouch HELD, likewise without a fresh press.
      approach();
      h.shade._tryMantle(APPROACHING);
      const heldCrouch = createIntent();
      heldCrouch.crouch = true;
      heldCrouch.crouchPressed = false;
      let dropped = false;
      for (let i = 0; i < 120; i++) {
        h.shade.step(CONFIG.time.fixedDt, heldCrouch);
        if (h.shade.state === SHADE_STATE.AIR) {
          dropped = true;
          break;
        }
      }

      h.shade.reset(h.map.shadeSpawns[0]);

      const pass =
        ledge !== null && ledge.band === 'hang' && grabbed && hangState === SHADE_STATE.HANG &&
        hangClear && stillHanging && pullingUp && graceRespected && onTop && topClear && dropped;
      return {
        pass,
        detail: `band=${ledge ? ledge.band : 'none'} rise=${ledge ? ledge.rise.toFixed(2) : '-'}, hang clear=${hangClear} feetY=${hangFeet.toFixed(2)}, idle stays hanging=${stillHanging}, HELD jump pulled up=${pullingUp}, landed on top=${onTop} clear=${topClear}, HELD crouch dropped=${dropped}, fresh grab waited ${stepsToPullUp} steps (grace ${graceSteps}, ok=${graceRespected})`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'container-top-is-not-a-dead-end',
    spec: 'reported bug: cannot climb from the container',
    name: 'A vault-band ledge climbs from the air, so a small platform is never a trap',
    run: (h) => {
      const container = h.map.collision.boxes.find((box) => box.tag === 'hall-container');
      const spine = h.map.collision.boxes.find((box) => box.tag === 'catwalk-spine');
      if (!container || !spine) return { pass: false, detail: 'container or catwalk-spine missing' };

      const rise = spine.max.y - container.max.y;
      const band = classifyLedge(rise);

      // Stand on the container top and hop toward the spine. Sprint is
      // deliberately NOT given: there is no room to build speed up here, which
      // is exactly the situation that stranded the player.
      h.shade.reset(h.map.shadeSpawns[0]);
      h.shade.position.set(container.max.x - 0.6, container.max.y + CONFIG.shade.standHeight / 2 + 0.05, -8.5);
      h.shade.velocity.set(0, 0, 0);
      h.shade.yaw = -Math.PI / 2; // face +X, toward the spine
      h.shade.state = SHADE_STATE.GROUND;

      const intent = createIntent();
      intent.forward = 1;
      intent.sprint = false;
      let climbed = false;
      for (let i = 0; i < 240; i++) {
        intent.jumpPressed = i % 25 === 0;
        intent.jump = intent.jumpPressed;
        h.shade.step(CONFIG.time.fixedDt, intent);
        if (h.shade.state === SHADE_STATE.VAULT || h.shade.state === SHADE_STATE.MANTLE) climbed = true;
        if (h.shade.feetY > spine.max.y - 0.3) break;
      }

      const onSpine = h.shade.feetY > spine.max.y - 0.3;
      const clear = h.map.collision.isClear(h.shade.position, h.shade.half);
      h.shade.reset(h.map.shadeSpawns[0]);

      return {
        pass: band === 'vault' && climbed && onSpine && clear,
        detail: `container top ${container.max.y.toFixed(1)} -> spine ${spine.max.y.toFixed(1)} is ${rise.toFixed(2)}m (${band}); climbed without sprint=${climbed}, reached spine=${onSpine}, clear=${clear}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'backing-off-a-ledge-does-not-re-climb',
    spec: 'reported bug: pulled back up when falling off backwards',
    name: 'Stepping backwards off a ledge falls to the floor instead of auto-climbing',
    run: (h) => {
      const container = h.map.collision.boxes.find((box) => box.tag === 'hall-container');
      if (!container) return { pass: false, detail: 'hall-container missing' };

      // Stand on top near the WEST edge, facing east into the container, then
      // walk backwards off that west edge. The probe follows the facing
      // direction, so the ledge just left is squarely in front of it — this is
      // the exact geometry that used to haul the player back up. The west edge
      // is used because the catwalk spine overhangs the east side.
      h.shade.reset(h.map.shadeSpawns[0]);
      h.shade.position.set(container.min.x + 0.55, container.max.y + CONFIG.shade.standHeight / 2 + 0.02, -8.5);
      h.shade.velocity.set(0, 0, 0);
      h.shade.yaw = -Math.PI / 2; // face +X, into the container
      h.shade.state = SHADE_STATE.GROUND;

      const intent = createIntent();
      intent.forward = -1; // walking backwards, off the edge behind us

      let reClimbed = false;
      for (let i = 0; i < 240; i++) {
        h.shade.step(CONFIG.time.fixedDt, intent);
        if (
          h.shade.state === SHADE_STATE.MANTLE ||
          h.shade.state === SHADE_STATE.VAULT ||
          h.shade.state === SHADE_STATE.HANG
        ) {
          reClimbed = true;
          break;
        }
      }

      // Capture before the second setup below moves the Shade, or the reported
      // numbers describe a different moment than the assertion.
      const feet = h.shade.feetY;
      const groundedAfterFall = h.shade.grounded;
      const landed = !reClimbed && feet < 1.0 && groundedAfterFall;

      // The forward approach must still work, or the fix has broken climbing.
      h.shade.reset(h.map.shadeSpawns[0]);
      h.shade.position.set(container.max.x + 0.75, 0.5 + CONFIG.shade.standHeight / 2, -8.5);
      h.shade.velocity.set(0, 0, 0);
      h.shade.yaw = Math.PI / 2;
      h.shade.state = SHADE_STATE.AIR;
      const stillGrabs = h.shade._tryMantle(APPROACHING) && h.shade.state === SHADE_STATE.HANG;

      h.shade.reset(h.map.shadeSpawns[0]);

      return {
        pass: landed && stillGrabs,
        detail: `walked backwards off a ${container.max.y.toFixed(1)}m ledge: re-climbed=${reClimbed}, ended feetY=${feet.toFixed(2)} grounded=${groundedAfterFall}; approaching forwards still grabs=${stillGrabs}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'hang-shimmy-stays-on-the-ledge',
    spec: 'requested: movement while hanging',
    name: 'Shimmy moves along a grabbed ledge and refuses to run off the end',
    run: (h) => {
      const container = h.map.collision.boxes.find((box) => box.tag === 'hall-container');
      const grab = () => {
        h.shade.reset(h.map.shadeSpawns[0]);
        h.shade.position.set(container.max.x + 0.75, 0.5 + CONFIG.shade.standHeight / 2, -8.5);
        h.shade.velocity.set(0, 0, 0);
        h.shade.yaw = Math.PI / 2;
        h.shade.state = SHADE_STATE.AIR;
        return h.shade._tryMantle(APPROACHING) && h.shade.state === SHADE_STATE.HANG;
      };

      if (!grab()) return { pass: false, detail: 'could not establish a hang to shimmy from' };

      const startZ = h.shade.position.z;
      const intent = createIntent();
      intent.strafe = 1;
      // Long enough to run past the end of a 3m ledge if it were unbounded.
      for (let i = 0; i < 400; i++) h.shade.step(CONFIG.time.fixedDt, intent);

      const movedZ = h.shade.position.z;
      const moved = Math.abs(movedZ - startZ) > 0.3;
      const stillHanging = h.shade.state === SHADE_STATE.HANG;
      const clear = h.map.collision.isClear(h.shade.position, h.shade.half);
      // Must have stopped within the ledge's own footprint, not past its end.
      const withinLedge = movedZ >= container.min.z - 0.5 && movedZ <= container.max.z + 0.5;

      h.shade.reset(h.map.shadeSpawns[0]);

      return {
        pass: moved && stillHanging && clear && withinLedge,
        detail: `z ${startZ.toFixed(2)} -> ${movedZ.toFixed(2)} (ledge z ${container.min.z}..${container.max.z}), moved=${moved}, still hanging=${stillHanging}, clear=${clear}, stayed on ledge=${withinLedge}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'sprint-vault-clears-a-crate',
    spec: 'Section 6.1 / check 2',
    name: 'Sprinting into a vault-band crate vaults it and lands clean on top',
    run: (h) => {
      const crate = h.map.collision.boxes.find((box) => box.tag === 'stack-hall-low');
      if (!crate) return { pass: false, detail: 'stack-hall-low missing from the map' };

      h.shade.reset(h.map.shadeSpawns[0]);
      h.shade.position.set(
        (crate.min.x + crate.max.x) / 2,
        CONFIG.shade.standHeight / 2 + 0.05,
        crate.min.z - 1.4
      );
      h.shade.yaw = Math.PI; // face +Z, into the crate
      h.shade.state = SHADE_STATE.GROUND;

      const intent = createIntent();
      intent.forward = 1;
      intent.sprint = true;

      // Stop sampling the instant the vault resolves, otherwise the held sprint
      // carries the Shade across the map and "landed clean" proves nothing.
      let entered = false;
      let landedFeet = null;
      let landedZ = null;
      let landedClear = false;
      for (let i = 0; i < 200; i++) {
        h.shade.step(CONFIG.time.fixedDt, intent);
        if (h.shade.state === SHADE_STATE.VAULT) {
          entered = true;
        } else if (entered) {
          landedFeet = h.shade.feetY;
          landedZ = h.shade.position.z;
          landedClear = h.map.collision.isClear(h.shade.position, h.shade.half);
          break;
        }
      }

      const rise = crate.max.y - CONFIG.map.groundY;
      const band = classifyLedge(rise);
      // Landed on top of the crate, not inside it and not back on the floor.
      const onTop = landedFeet !== null && Math.abs(landedFeet - crate.max.y) < 0.25;
      const pastEdge = landedZ !== null && landedZ > crate.min.z;

      h.shade.reset(h.map.shadeSpawns[0]);

      return {
        pass: band === 'vault' && entered && landedClear && onTop && pastEdge,
        detail: `crate rise ${rise.toFixed(2)}m (${band}) top y=${crate.max.y.toFixed(2)}, vault entered=${entered}, landed feetY=${landedFeet === null ? 'n/a' : landedFeet.toFixed(3)} z=${landedZ === null ? 'n/a' : landedZ.toFixed(2)} (crate z ${crate.min.z}..${crate.max.z}), capsule clear=${landedClear}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'vent-runs-are-crouch-only-and-enterable',
    spec: 'Section 5 / check 5',
    name: 'Both vent mouths admit a standing mantle; mid-run fits crouched only',
    run: (h) => {
      const V = CONFIG.map.ventFloorY;
      const standHalf = { x: CONFIG.shade.radius, y: CONFIG.shade.standHeight / 2, z: CONFIG.shade.radius };
      const crouchHalf = { x: CONFIG.shade.radius, y: CONFIG.shade.crouchHeight / 2, z: CONFIG.shade.radius };
      const problems = [];

      for (const vent of h.map.vents) {
        const z = (vent.min.z + vent.max.z) / 2;
        const midX = (vent.min.x + vent.max.x) / 2;
        const at = (x, half, height) =>
          h.map.collision.isClear({ x, y: V + height / 2 + 0.02, z }, half);

        // Mantling onto the lip commits a STANDING capsule, so both mouths must
        // clear standing height or the run can never be entered.
        if (!at(vent.min.x + 0.5, standHalf, CONFIG.shade.standHeight)) problems.push(`${vent.tag} west mouth blocked standing`);
        if (!at(vent.max.x - 0.5, standHalf, CONFIG.shade.standHeight)) problems.push(`${vent.tag} east mouth blocked standing`);
        // Mid-run must be crouch-only.
        if (at(midX, standHalf, CONFIG.shade.standHeight)) problems.push(`${vent.tag} mid-run allows standing`);
        if (!at(midX, crouchHalf, CONFIG.shade.crouchHeight)) problems.push(`${vent.tag} mid-run blocks crouching`);
      }

      // And the traversal chain heights must land in the spec bands.
      const lipRise = V - CONFIG.map.groundY;
      const spine = h.map.collision.boxes.find((box) => box.tag === 'catwalk-spine');
      const spineRise = spine ? spine.max.y - V : -1;
      if (classifyLedge(lipRise) !== 'mantle') problems.push(`vent lip rise ${lipRise} is not a mantle`);
      if (classifyLedge(spineRise) !== 'mantle') problems.push(`platform to catwalk rise ${spineRise} is not a mantle`);

      return {
        pass: problems.length === 0,
        detail:
          problems.length === 0
            ? `${h.map.vents.length} runs crouch-only and enterable; chain ground -> lip ${lipRise.toFixed(2)}m (mantle) -> platform -> catwalk ${spineRise.toFixed(2)}m (mantle)`
            : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'shade-speeds-match-spec',
    spec: 'Section 6.1',
    name: 'Walk, crouch and sprint settle at the spec speeds',
    run: (h) => {
      const dt = CONFIG.time.fixedDt;
      const intent = createIntent();

      const settle = (sprint, crouch) => {
        // A long clear lane down the west edge of the Turbine Hall: 26m of
        // open floor before the south wall, well past what a 2s sprint covers.
        h.shade.reset(h.map.shadeSpawns[0]);
        h.shade.position.set(-27, CONFIG.shade.standHeight / 2 + 0.05, -18);
        h.shade.yaw = Math.PI; // +Z, along the hall
        intent.forward = 1;
        intent.strafe = 0;
        intent.sprint = sprint;
        intent.crouch = crouch;
        intent.jumpPressed = false;
        intent.crouchPressed = false;
        for (let i = 0; i < 120; i++) h.shade.step(dt, intent);
        return h.shade.speed;
      };

      const walk = settle(false, false);
      const sprint = settle(true, false);
      const crouch = settle(false, true);
      h.shade.reset(h.map.shadeSpawns[0]);

      const near = (value, target) => Math.abs(value - target) < 0.15;
      const pass = near(walk, S_WALK) && near(sprint, S_SPRINT) && near(crouch, S_CROUCH);
      return {
        pass,
        detail: `walk ${walk.toFixed(2)}/${S_WALK}, sprint ${sprint.toFixed(2)}/${S_SPRINT}, crouch ${crouch.toFixed(2)}/${S_CROUCH} m/s`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'crouch-blocked-under-vent-roof',
    spec: 'Section 6.1 / check 5',
    name: 'Standing up inside a vent is refused rather than pushing through the roof',
    run: (h) => {
      const vent = h.map.vents[0];
      const midX = (vent.min.x + vent.max.x) / 2;
      const midZ = (vent.min.z + vent.max.z) / 2;

      h.shade.reset(h.map.shadeSpawns[0]);
      // Place the crouched capsule on the vent floor, under the roof.
      h.shade.height = CONFIG.shade.crouchHeight;
      h.shade.half.y = h.shade.height / 2;
      h.shade.crouching = true;
      h.shade.position.set(midX, vent.min.y + h.shade.half.y + 0.02, midZ);

      const fitsCrouched = h.map.collision.isClear(h.shade.position, h.shade.half);
      const stood = h.shade._resize(CONFIG.shade.standHeight);
      const stillCrouchHeight = Math.abs(h.shade.height - CONFIG.shade.crouchHeight) < 1e-9;

      h.shade.reset(h.map.shadeSpawns[0]);

      return {
        pass: fitsCrouched && stood === false && stillCrouchHeight,
        detail: `crouched capsule fits vent=${fitsCrouched}, stand-up refused=${stood === false}, height unchanged=${stillCrouchHeight}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'camera-swap-leaks-no-state',
    spec: 'Section 15 / phase 4 exit gate',
    name: 'Swapping the camera between roles leaks no transform, FOV or instance',
    run: (h) => {
      const problems = [];
      const owners = ['shade', 'warden', 'freefly', 'warden', 'shade', 'freefly', 'shade'];
      const rigFor = (owner) =>
        owner === 'warden' ? h.warden.cameraRig : owner === 'shade' ? h.shade.cameraRig : h.scene;

      // Dirty every piece of camera state a previous owner could have touched.
      const dirty = () => {
        camera.position.set(3, -2, 7);
        camera.rotation.set(0.4, -1.1, 0.9);
        camera.scale.set(2, 2, 2);
        camera.fov = 12;
        camera.updateProjectionMatrix();
      };

      for (const owner of owners) {
        dirty();
        h.setCameraOwner(null); // force a genuine handover every time
        h.setCameraOwner(owner);

        if (camera.parent !== rigFor(owner)) problems.push(`${owner}: wrong parent`);
        if (camera.position.length() > 1e-9) problems.push(`${owner}: local position leaked`);
        if (Math.abs(camera.rotation.x) + Math.abs(camera.rotation.y) + Math.abs(camera.rotation.z) > 1e-9) {
          problems.push(`${owner}: local rotation leaked`);
        }
        if (Math.abs(camera.scale.x - 1) > 1e-9) problems.push(`${owner}: scale leaked`);
        if (Math.abs(camera.fov - CONFIG.render.fov) > 1e-9) problems.push(`${owner}: fov leaked (${camera.fov})`);

        let count = 0;
        h.scene.traverse((object) => {
          if (object.isCamera) count++;
        });
        if (count !== 1) problems.push(`${owner}: ${count} cameras in the graph`);
      }

      // The real leak this guards: ADS narrows the FOV, so swapping away
      // mid-aim must not leave the next owner zoomed in.
      h.setCameraOwner('warden');
      h.warden.adsBlend = 1;
      camera.fov = h.warden.desiredFov();
      camera.updateProjectionMatrix();
      const adsFov = camera.fov;
      h.setCameraOwner('shade');
      const restored = Math.abs(camera.fov - CONFIG.render.fov) < 1e-9;
      if (!restored) problems.push(`ads fov ${adsFov.toFixed(1)} survived the swap as ${camera.fov.toFixed(1)}`);
      h.warden.adsBlend = 0;

      // The body must be hidden only while the camera is inside its head.
      h.setCameraOwner('warden');
      const hiddenInFirstPerson = h.warden.mesh.visible === false;
      h.setCameraOwner('shade');
      const shownOtherwise = h.warden.mesh.visible === true;
      if (!hiddenInFirstPerson) problems.push('warden body visible in first person');
      if (!shownOtherwise) problems.push('warden body still hidden after swapping away');

      return {
        pass: problems.length === 0,
        detail:
          problems.length === 0
            ? `${owners.length} handovers across shade/warden/freefly: parent, local transform, scale and FOV reset every time; ADS fov ${adsFov.toFixed(1)} restored to ${CONFIG.render.fov}; exactly 1 camera throughout`
            : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'warden-speeds-and-no-crouch',
    spec: 'Section 6.2',
    name: 'Warden walk, sprint and ADS speeds match spec; crouch is unavailable',
    run: (h) => {
      const dt = CONFIG.time.fixedDt;
      const intent = createWardenIntent();

      const settle = (sprint, ads) => {
        h.warden.reset(h.map.wardenSpawns[0]);
        h.warden.position.set(-27, CONFIG.warden.standHeight / 2 + 0.05, -18);
        h.warden.yaw = Math.PI; // down the clear west lane of the Turbine Hall
        intent.forward = 1;
        intent.strafe = 0;
        intent.sprint = sprint;
        intent.ads = ads;
        for (let i = 0; i < 180; i++) h.warden.step(dt, intent);
        return h.warden.speed;
      };

      const walk = settle(false, false);
      const sprint = settle(true, false);
      const ads = settle(false, true);

      // Section 6.2: "Crouch | Not available. Wardens are heavy."
      const noCrouchApi = typeof h.warden.crouching === 'undefined' && CONFIG.warden.canCrouch === false;
      const heightHeld = Math.abs(h.warden.half.y * 2 - CONFIG.warden.standHeight) < 1e-9;

      h.warden.reset(h.map.wardenSpawns[0]);

      const near = (value, target) => Math.abs(value - target) < 0.15;
      return {
        pass: near(walk, CONFIG.warden.walkSpeed) && near(sprint, CONFIG.warden.sprintSpeed) &&
          near(ads, CONFIG.warden.adsSpeed) && noCrouchApi && heightHeld,
        detail: `walk ${walk.toFixed(2)}/${CONFIG.warden.walkSpeed}, sprint ${sprint.toFixed(2)}/${CONFIG.warden.sprintSpeed}, ads ${ads.toFixed(2)}/${CONFIG.warden.adsSpeed} m/s; no crouch api=${noCrouchApi}, capsule height fixed=${heightHeld}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'warden-can-walk-between-floors',
    spec: 'Section 6.2 / Section 5',
    name: 'The Warden walks up every staircase to the upper floor unaided',
    run: (h) => {
      const dt = CONFIG.time.fixedDt;
      const intent = createWardenIntent();
      const results = [];
      let failures = 0;

      for (const stair of h.map.staircases) {
        const alongZ = stair.axis === 'z';
        const cross = (stair.crossMin + stair.crossMax) / 2;

        // Start one metre short of the first step, facing up the flight.
        const startAlong = stair.bottom - 1.0;
        h.warden.reset(h.map.wardenSpawns[0]);
        h.warden.position.set(
          alongZ ? cross : startAlong,
          stair.baseY + CONFIG.warden.standHeight / 2 + 0.05,
          alongZ ? startAlong : cross
        );
        h.warden.velocity.set(0, 0, 0);
        // Face +Z or +X, the direction the flight ascends.
        h.warden.yaw = alongZ ? Math.PI : -Math.PI / 2;

        intent.forward = 1;
        intent.sprint = false;
        intent.ads = false;

        let reached = false;
        for (let i = 0; i < 900; i++) {
          h.warden.step(dt, intent);
          if (h.warden.feetY >= stair.topY - 0.2) {
            reached = true;
            break;
          }
        }
        const clear = h.map.collision.isClear(h.warden.position, h.warden.half);
        if (!reached || !clear) failures++;
        results.push(`${stair.tag}: reached=${reached} feetY=${h.warden.feetY.toFixed(2)}/${stair.topY.toFixed(2)} clear=${clear}`);
      }

      h.warden.reset(h.map.wardenSpawns[0]);

      // Rise must clear both actors' step-up, or one of them cannot use it.
      const riseOk =
        CONFIG.map.stairRise < CONFIG.warden.stepHeight && CONFIG.map.stairRise < CONFIG.shade.stepHeight;
      if (!riseOk) failures++;

      return {
        pass: failures === 0 && h.map.staircases.length >= 2,
        detail: `${h.map.staircases.length} staircases, step rise ${CONFIG.map.stairRise.toFixed(3)}m under both step-ups (shade ${CONFIG.shade.stepHeight}, warden ${CONFIG.warden.stepHeight})=${riseOk}; ${results.join('; ')}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'warden-shared-by-ai-and-human',
    spec: 'Section 6.2 / Section 12 / Section 15',
    name: 'One Warden controller serves both drivers through the same intent',
    run: (h) => {
      // Free-roam must be a configuration of initMatch, not a second path.
      const before = h.match;
      const free = h.initMatch({ mode: 'freeroam', role: 'warden', ai: false, objective: false, seed: before.seed });
      const isFreeRoam = free.mode === 'freeroam' && free.role === 'warden' && free.aiEnabled === false && free.objectiveEnabled === false;

      // Drive the controller with a synthetic intent, exactly as the AI will.
      const dt = CONFIG.time.fixedDt;
      const intent = createWardenIntent();
      intent.forward = 1;
      const start = h.warden.position.clone();
      for (let i = 0; i < 60; i++) h.warden.step(dt, intent);
      const movedByIntent = h.warden.position.distanceTo(start) > 0.5;

      // Stun blocks movement entirely (Section 11 STUNNED, Section 9 taser).
      h.warden.stun(1.0);
      const stunStart = h.warden.position.clone();
      for (let i = 0; i < 30; i++) h.warden.step(dt, intent);
      const frozenWhileStunned = h.warden.position.distanceTo(stunStart) < 0.05;
      const stunnedState = h.warden.state === WARDEN_STATE.STUNNED;
      for (let i = 0; i < 45; i++) h.warden.step(dt, createWardenIntent());
      const recovered = h.warden.state !== WARDEN_STATE.STUNNED;

      const back = h.initMatch({ mode: 'competitive', role: 'shade', ai: true, objective: true, seed: before.seed });
      const isCompetitive = back.mode === 'competitive' && back.role === 'shade';

      return {
        pass: isFreeRoam && movedByIntent && frozenWhileStunned && stunnedState && recovered && isCompetitive,
        detail: `freeroam config=${isFreeRoam}, moved by intent alone=${movedByIntent}, stunned freeze=${frozenWhileStunned} state=${stunnedState}, recovered=${recovered}, returned to competitive=${isCompetitive}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'match-state-rebuilt-on-init',
    spec: 'Section 15 (state bleed)',
    name: 'initMatch rebuilds match state from the defaults factory',
    run: (h) => {
      const before = h.match;
      before.score.shade = 99;
      before.roundNumber = 42;
      before.rounds.push({ dirty: true });

      const seed = before.seed;
      const after = initMatch({ seed });

      const pass =
        after !== before &&
        after.score.shade === 0 &&
        after.score.warden === 0 &&
        after.roundNumber === 1 &&
        after.rounds.length === 0 &&
        after.seed === seed;

      return {
        pass,
        detail: `newObject=${after !== before} score=${after.score.shade}/${after.score.warden} round=${after.roundNumber} rounds=${after.rounds.length} seed preserved=${after.seed === seed}`,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Harness handed to the AUTO suite. Getters so tests always see live objects.
// ---------------------------------------------------------------------------

const harness = {
  get scene() {
    return scene;
  },
  get camera() {
    return camera;
  },
  get renderer() {
    return renderer;
  },
  get input() {
    return input;
  },
  get debugTools() {
    return debugTools;
  },
  get match() {
    return match;
  },
  get map() {
    return map;
  },
  get shade() {
    return shade;
  },
  get warden() {
    return warden;
  },
  get cameraOwner() {
    return cameraOwner;
  },
  setCameraOwner,
  get freefly() {
    return freefly;
  },
  emitter,
  debugState,
  clock,
  config: CONFIG,
  rng,
  computeStepPlan,
  setTimeScale,
  initMatch,

  /**
   * Advance the simulation synchronously, without rendering. This is how the
   * AUTO suite drives scripted state transitions (Section 17.1).
   */
  stepFrames(count) {
    const n = Math.min(Math.max(0, Math.floor(count)), CONFIG.debug.autoTestMaxFrames);
    for (let i = 0; i < n; i++) fixedStep(CONFIG.time.fixedDt);
    return n;
  },

  /** Await one real animation frame, for tests that need the renderer to run. */
  nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  },
};

// ---------------------------------------------------------------------------
// Go
// ---------------------------------------------------------------------------

bootstrap();

// Section 12: free-roam is a configuration of initMatch, never a second code
// path. Until the menu lands in Phase 10, ?mode=freeroam selects it so the
// Warden controller can be driven by hand.
const bootFreeRoam = DEBUG && /(?:^|[?&])mode=freeroam(?:&|$)/.test(location.search);
initMatch(
  bootFreeRoam
    ? { mode: 'freeroam', role: 'warden', ai: false, objective: false }
    : { mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true }
);

if (DEBUG) {
  // Console handle so a seed can be reproduced by hand (Section 16, check 28).
  window.BLACKLINE = harness;
  console.log(
    `%c BLACKLINE %c three r${THREE.REVISION}  seed ${rng.seed}  F3 debug  F4 test mode `,
    'background:#2fd6c3;color:#08090b;font-weight:bold',
    'color:#7e8f95'
  );
}

// Nothing may import main.js (Section 3.1), so the only exports are the ones
// the AUTO suite reaches through the harness. `stop` is kept for teardown.
export { stop };
