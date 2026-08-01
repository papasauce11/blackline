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
import { createDetection } from './systems/detection.js';
import { createWardenAI, AI_STATE } from './systems/ai.js';
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
/** @type {import('./systems/detection.js').Detection} */ let detection = null;
/** @type {import('./systems/ai.js').WardenAI} */ let wardenAI = null;
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
  // Noise events and the visibility cache are round state and must not bleed
  // across a match boundary (Section 15).
  if (detection) detection.reset(shade);
  // Reseeded above, so the patrol circuit is redrawn from the new stream and a
  // replayed seed reproduces the same patrol order (Section 16 check 28).
  if (wardenAI) wardenAI.reset();
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

  // Section 7: light sampling, the visibility meter, the Section 4.2 feedback
  // and the noise field. Built after both actors, because it seeds the meter
  // from the Shade's spawn rather than letting it ramp up from zero.
  detection = createDetection({ map, emitter });
  detection.reset(shade);

  // Section 11. The AI fills the same intent a human fills in free-roam; the
  // composition root is what steps the controller with it, so there is exactly
  // one path into the Warden.
  wardenAI = createWardenAI({ map, warden, detection, emitter });

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
    warden.step(dt, match.aiEnabled ? wardenAI.step(dt, { shade }) : wardenIdleIntent);
  }

  // After the actors, never before: the landing noise reads a flag the Shade
  // sets during its own step and clears at the top of the next one.
  detection.step(dt, { shade, warden });

  if (DEBUG) {
    // Keys and types the overlay's field table actually consumes (Section 17:
    // "visibility meter raw and smoothed", "active noise events"). Anything
    // else here is silently dropped, so it must match.
    debugState.visibilityRaw = detection.raw;
    debugState.visibilitySmoothed = detection.smoothed;
    debugState.activeNoise = detection.noise.activeCount;
    debugState.aiState = wardenAI.state;
    debugState.aiDetection = wardenAI.accumulator;
    debugState.aiStuckCounter = wardenAI.stuckCount;
    debugState.aiStuckTimer = wardenAI.stuckTimer;
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
        /^(crate|stack|gantry|lip-|office-cover|server-rack|hall-container|fire-escape)/.test(box.tag)
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
    id: 'markings-sit-on-real-geometry',
    spec: 'Section 5 / reported bug: chevrons floating in mid-air',
    name: 'Every affordance decal lies on the surface it describes',
    run: (h) => {
      const floating = [];
      let marked = 0;

      for (const ledge of h.map.ledges) {
        // Top-edge stripes ride the ledge's own top face, so they cannot drift.
        // Chevrons go on the face BELOW the ledge, which only exists where the
        // ledge reaches down to whatever it was measured against. A lip, gantry
        // or duct hangs, so its face stops well short of that.
        if (ledge.band !== 'mantle') continue;
        const box = ledge.box;
        if (!ledge.chevrons) {
          floating.push(`${box.tag} is a mantle ledge with no chevrons`);
          continue;
        }
        marked++;
        // Asserted against where the map actually put them, not a recomputation.
        if (ledge.chevrons.y0 < box.min.y - 1e-6 || ledge.chevrons.y1 > box.max.y + 1e-6) {
          floating.push(
            `${box.tag} decal spans ${ledge.chevrons.y0.toFixed(2)}..${ledge.chevrons.y1.toFixed(2)}, box is ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)}`
          );
        }
      }

      return {
        pass: floating.length === 0 && marked > 0,
        detail:
          floating.length === 0
            ? `${marked} mantle ledges: every chevron sits within the face of the box it marks`
            : `${floating.length} floating: ${floating.slice(0, 5).join('; ')}`,
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

      // Derived from the box rather than typed, so moving the container in the
      // map does not silently make this test probe empty air.
      const midZ = (container.min.z + container.max.z) / 2;
      const approach = () => {
        h.shade.reset(h.map.shadeSpawns[0]);
        // Airborne just off the container's east face, facing into it.
        // Feet at 0.5 so the 3.0m top is a 2.5m rise — above the mantle band.
        h.shade.position.set(container.max.x + 0.75, 0.5 + CONFIG.shade.standHeight / 2, midZ);
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
      const gantry = h.map.collision.boxes.find((box) => box.tag === 'gantry-hall');
      if (!container || !gantry) return { pass: false, detail: 'hall-container or gantry-hall missing' };

      const rise = gantry.max.y - container.max.y;
      const band = classifyLedge(rise);

      // Stand on the container top and hop toward the gantry. Sprint is
      // deliberately NOT given: there is no room to build speed up here, which
      // is exactly the situation that stranded the player. Start point and
      // facing are derived from the two boxes so that moving either in the map
      // cannot leave this test walking at empty air.
      const target = { x: (gantry.min.x + gantry.max.x) / 2, z: (gantry.min.z + gantry.max.z) / 2 };
      const near = {
        x: Math.min(Math.max(target.x, container.min.x), container.max.x),
        z: Math.min(Math.max(target.z, container.min.z), container.max.z),
      };
      const length = Math.hypot(target.x - near.x, target.z - near.z) || 1;
      const dx = (target.x - near.x) / length;
      const dz = (target.z - near.z) / length;

      h.shade.reset(h.map.shadeSpawns[0]);
      h.shade.position.set(
        near.x - dx * 0.6,
        container.max.y + CONFIG.shade.standHeight / 2 + 0.05,
        near.z - dz * 0.6
      );
      h.shade.velocity.set(0, 0, 0);
      h.shade.yaw = Math.atan2(-dx, -dz); // face the gantry
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
        if (h.shade.feetY > gantry.max.y - 0.3 && h.shade.state !== SHADE_STATE.VAULT &&
            h.shade.state !== SHADE_STATE.MANTLE) break;
      }
      // Let the landing settle: mid-traversal the capsule is interpolating
      // through the ledge, so "clean" can only be judged once it is down.
      for (let i = 0; i < 30; i++) h.shade.step(CONFIG.time.fixedDt, createIntent());

      const onGantry = h.shade.feetY > gantry.max.y - 0.3;
      const clear = h.map.collision.isClear(h.shade.position, h.shade.half);
      h.shade.reset(h.map.shadeSpawns[0]);

      return {
        pass: band === 'vault' && climbed && onGantry && clear,
        detail: `container top ${container.max.y.toFixed(1)} -> gantry ${gantry.max.y.toFixed(1)} is ${rise.toFixed(2)}m (${band}); climbed without sprint=${climbed}, reached gantry=${onGantry}, clear=${clear}`,
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
      // is used because the gantry adjoins the east side.
      const midZ = (container.min.z + container.max.z) / 2;
      h.shade.reset(h.map.shadeSpawns[0]);
      h.shade.position.set(container.min.x + 0.55, container.max.y + CONFIG.shade.standHeight / 2 + 0.02, midZ);
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
      h.shade.position.set(container.max.x + 0.75, 0.5 + CONFIG.shade.standHeight / 2, midZ);
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
      const midZ = (container.min.z + container.max.z) / 2;
      const grab = () => {
        h.shade.reset(h.map.shadeSpawns[0]);
        h.shade.position.set(container.max.x + 0.75, 0.5 + CONFIG.shade.standHeight / 2, midZ);
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
    name: 'Every vent run is crouch-only along its length and open at both mouths',
    run: (h) => {
      const crouchHalf = { x: CONFIG.shade.radius, y: CONFIG.shade.crouchHeight / 2, z: CONFIG.shade.radius };
      const standHalf = { x: CONFIG.shade.radius, y: CONFIG.shade.standHeight / 2, z: CONFIG.shade.radius };
      const problems = [];
      let grade = 0;

      for (const vent of h.map.vents) {
        if (vent.grade) grade++;
        const alongX = vent.axis === 'x';
        const from = alongX ? vent.min.x : vent.min.z;
        const to = alongX ? vent.max.x : vent.max.z;
        const cross = alongX ? (vent.min.z + vent.max.z) / 2 : (vent.min.x + vent.max.x) / 2;
        const floorY = vent.min.y;
        const at = (along, half, height) => {
          const y = floorY + height / 2 + 0.02;
          const point = alongX ? { x: along, y, z: cross } : { x: cross, y, z: along };
          return h.map.collision.isClear(point, half);
        };

        // Crouch-only wherever the run is enclosed, mouth to mouth. Sampling
        // the midpoint alone would pass a run that is only capped over part of
        // its length. Samples under a deck void are skipped: there the run has
        // deliberately opened into the room above, which is the whole point of
        // the hatch the upper run climbs through.
        const samples = Math.max(4, Math.floor((to - from) / 1.0));
        let standing = 0;
        let cramped = 0;
        let enclosed = 0;
        for (let i = 1; i < samples; i++) {
          const along = from + ((to - from) * i) / samples;
          const x = alongX ? along : cross;
          const z = alongX ? cross : along;
          const underVoid = h.map.deckVoids.some(
            (hole) => x > hole.x0 && x < hole.x1 && z > hole.z0 && z < hole.z1 && hole.top > floorY
          );
          if (underVoid) continue;
          enclosed++;
          if (at(along, standHalf, CONFIG.shade.standHeight)) standing++;
          if (!at(along, crouchHalf, CONFIG.shade.crouchHeight)) cramped++;
        }
        if (standing > 0) problems.push(`${vent.tag} allows standing at ${standing}/${enclosed} enclosed samples`);
        if (cramped > 0) problems.push(`${vent.tag} blocks crouching at ${cramped}/${enclosed} enclosed samples`);
        if (enclosed < (samples - 1) * 0.6) {
          problems.push(`${vent.tag} is open to a void along ${samples - 1 - enclosed}/${samples - 1} of its length`);
        }
        if (!at(from + 0.4, crouchHalf, CONFIG.shade.crouchHeight)) problems.push(`${vent.tag} start mouth blocked`);
        if (!at(to - 0.4, crouchHalf, CONFIG.shade.crouchHeight)) problems.push(`${vent.tag} end mouth blocked`);
      }

      // The two-tier chain heights must land in the spec bands by construction.
      const chain = [
        ['ground -> lower vent', CONFIG.map.ventFloorY - CONFIG.map.groundY],
        ['lower vent -> upper vent', CONFIG.map.ventUpperY - CONFIG.map.ventFloorY],
        ['upper vent -> deck', CONFIG.map.catwalkY - CONFIG.map.ventUpperY],
      ];
      for (const [label, rise] of chain) {
        if (classifyLedge(rise) !== 'mantle') problems.push(`${label} rise ${rise.toFixed(2)}m is not a mantle`);
      }
      if (grade < 2) problems.push(`only ${grade} vent mouths at grade, v2 wants at least 2`);

      return {
        pass: problems.length === 0,
        detail:
          problems.length === 0
            ? `${h.map.vents.length} runs crouch-only end to end (${grade} at grade); chain ${chain.map(([label, rise]) => `${label} ${rise.toFixed(2)}m`).join(', ')}, all mantle`
            : problems.join('; '),
      };
    },
  });

  // -------------------------------------------------------------------------
  // v2 map redesign. Each of the five requirements is asserted rather than
  // trusted, in the same spirit as the derived-climbability check: the map is
  // large enough that a hand walkthrough would not reliably catch a regression.
  // -------------------------------------------------------------------------

  debugTools.registerAutoTest({
    id: 'warden-upper-deck-fully-connected',
    spec: 'v2 requirement 2',
    name: 'Every walkable square of the upper deck is one connected region',
    run: (h) => {
      const cell = CONFIG.debug.deckFloodCell;
      const deck = CONFIG.map.catwalkY;
      const half = { x: CONFIG.warden.radius, y: CONFIG.warden.standHeight / 2, z: CONFIG.warden.radius };
      const world = h.map.collision;
      const x0 = -CONFIG.map.width / 2;
      const z0 = -CONFIG.map.depth / 2;
      const nx = Math.ceil(CONFIG.map.width / cell);
      const nz = Math.ceil(CONFIG.map.depth / cell);

      // A square counts when a standing Warden fits there AND the thing under
      // its feet is the deck surface itself — not a stair tread on the way up,
      // not a crate top, not thin air over a void.
      const walkable = [];
      let total = 0;
      for (let j = 0; j < nz; j++) {
        walkable.push(new Array(nx).fill(false));
        for (let i = 0; i < nx; i++) {
          const x = x0 + (i + 0.5) * cell;
          const z = z0 + (j + 0.5) * cell;
          const floor = world.raycast({ x, y: deck + 0.5, z }, { x: 0, y: -1, z: 0 }, 1.0);
          if (!floor || Math.abs(floor.y - deck) > 0.05) continue;
          if (!world.isClear({ x, y: deck + half.y + 0.05, z }, half)) continue;
          walkable[j][i] = true;
          total++;
        }
      }

      // Flood from the top of a staircase: if the Warden can walk up, it must
      // be able to reach everything up there.
      const head = h.map.staircases[0];
      const seed = {
        i: Math.round((((head.axis === 'x' ? head.top : (head.crossMin + head.crossMax) / 2) - x0) / cell) - 0.5),
        j: Math.round((((head.axis === 'x' ? (head.crossMin + head.crossMax) / 2 : head.top) - z0) / cell) - 0.5),
      };
      // Nudge onto the nearest walkable square; the exact top step may straddle
      // the stairwell edge.
      let start = null;
      for (let r = 0; r <= 8 && !start; r++) {
        for (let dj = -r; dj <= r && !start; dj++) {
          for (let di = -r; di <= r && !start; di++) {
            const i = seed.i + di;
            const j = seed.j + dj;
            if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
            if (walkable[j][i]) start = { i, j };
          }
        }
      }
      if (!start) return { pass: false, detail: 'no walkable deck square near the stair head' };

      const seen = [];
      for (let j = 0; j < nz; j++) seen.push(new Array(nx).fill(false));
      const stack = [start];
      seen[start.j][start.i] = true;
      let reached = 0;
      while (stack.length) {
        const { i, j } = stack.pop();
        reached++;
        const neighbours = [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]];
        for (const [ni, nj] of neighbours) {
          if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue;
          if (!walkable[nj][ni] || seen[nj][ni]) continue;
          seen[nj][ni] = true;
          stack.push({ i: ni, j: nj });
        }
      }

      // Name what was stranded, so a failure points at a place rather than a count.
      const stranded = [];
      for (let j = 0; j < nz && stranded.length < 4; j++) {
        for (let i = 0; i < nx && stranded.length < 4; i++) {
          if (walkable[j][i] && !seen[j][i]) {
            stranded.push(`(${(x0 + (i + 0.5) * cell).toFixed(1)}, ${(z0 + (j + 0.5) * cell).toFixed(1)})`);
          }
        }
      }

      // And every upper waypoint and room must actually be on that region.
      const missed = [];
      for (const node of h.map.waypoints) {
        if (Math.abs(node.position.y - deck) > 0.05) continue;
        const i = Math.floor((node.position.x - x0) / cell);
        const j = Math.floor((node.position.z - z0) / cell);
        if (!(seen[j] && seen[j][i])) missed.push(`waypoint ${node.id} (${node.tag})`);
      }
      for (const room of h.map.rooms) {
        if (Math.abs(room.floorY - deck) > 0.05) continue;
        let found = false;
        for (let j = 0; j < nz && !found; j++) {
          for (let i = 0; i < nx && !found; i++) {
            const x = x0 + (i + 0.5) * cell;
            const z = z0 + (j + 0.5) * cell;
            if (x < room.min.x || x > room.max.x || z < room.min.z || z > room.max.z) continue;
            if (seen[j][i]) found = true;
          }
        }
        if (!found) missed.push(`room ${room.id}`);
      }

      const pass = total > 0 && reached === total && missed.length === 0;
      return {
        pass,
        detail: pass
          ? `${total} walkable deck squares at ${cell}m, all ${reached} reachable from ${h.map.staircases[0].tag}; every upper waypoint and room on the same region`
          : `${reached}/${total} reachable; stranded near ${stranded.join(' ') || 'n/a'}; unreached: [${missed.join(', ')}]`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'shade-spawns-are-outside-the-shell',
    spec: 'v2 requirement 3',
    name: 'The Shade starts outside the building, on clear ground',
    run: (h) => {
      const shell = h.map.shell;
      const half = { x: CONFIG.shade.radius, y: CONFIG.shade.standHeight / 2, z: CONFIG.shade.radius };
      const problems = [];

      for (let i = 0; i < h.map.shadeSpawns.length; i++) {
        const spawn = h.map.shadeSpawns[i];
        const p = spawn.position;
        if (p.x > shell.x0 && p.x < shell.x1 && p.z > shell.z0 && p.z < shell.z1) {
          problems.push(`spawn ${i} (${spawn.name}) is inside the shell`);
        }
        if (!h.map.collision.isClear({ x: p.x, y: p.y + half.y + 0.02, z: p.z }, half)) {
          problems.push(`spawn ${i} (${spawn.name}) has no room to stand`);
        }
        const ground = h.map.collision.raycast({ x: p.x, y: p.y + 1.0, z: p.z }, { x: 0, y: -1, z: 0 }, 2.0);
        if (!ground || Math.abs(ground.y - p.y) > 0.05) {
          problems.push(`spawn ${i} (${spawn.name}) is not standing on the ground plane`);
        }
      }

      // The Warden stays inside, or the two roles start on the same side of
      // the wall and the infiltration premise is gone.
      for (let i = 0; i < h.map.wardenSpawns.length; i++) {
        const p = h.map.wardenSpawns[i].position;
        const inside = p.x > shell.x0 && p.x < shell.x1 && p.z > shell.z0 && p.z < shell.z1;
        if (!inside) problems.push(`warden spawn ${i} is outside the shell`);
      }

      return {
        pass: problems.length === 0,
        detail:
          problems.length === 0
            ? `${h.map.shadeSpawns.length} shade spawns outside the shell (x ${shell.x0}..${shell.x1}, z ${shell.z0}..${shell.z1}) and clear; ${h.map.wardenSpawns.length} warden spawns inside`
            : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'shade-reaches-level-2-without-stairs',
    spec: 'v2 requirement 4',
    name: 'Four routes climb to the upper deck without using a staircase',
    run: (h) => {
      const deck = CONFIG.map.catwalkY;
      const roof = CONFIG.map.ceilingY + CONFIG.map.wallThickness;

      /**
       * Drive the Shade from the top of one box onto the top of the next,
       * starting from the point on the lower surface closest to the upper one.
       * No teleporting into the destination: the move has to be committed by
       * the controller, through the same parkour gate real play uses.
       */
      const hop = (from, to) => {
        const mid = (box, axis) => (box.min[axis] + box.max[axis]) / 2;
        // Walk at the ledge along the axis the two surfaces are separated on.
        // A ledge probe is a ray at a face; approaching diagonally puts the
        // face outside its reach even when the climb itself is fine.
        const gapX = Math.max(from.min.x - to.max.x, to.min.x - from.max.x);
        const gapZ = Math.max(from.min.z - to.max.z, to.min.z - from.max.z);
        const useX =
          gapX > gapZ ||
          (gapX === gapZ && Math.abs(mid(to, 'x') - mid(from, 'x')) >= Math.abs(mid(to, 'z') - mid(from, 'z')));
        const axis = useX ? 'x' : 'z';
        const cross = useX ? 'z' : 'x';
        const sign = mid(to, axis) >= mid(from, axis) ? 1 : -1;
        const inset = CONFIG.shade.radius + 0.06;

        const along = Math.min(
          Math.max((sign > 0 ? from.max[axis] : from.min[axis]) - sign * 0.55, from.min[axis] + inset),
          from.max[axis] - inset
        );
        const lo = Math.max(from.min[cross], to.min[cross]);
        const hi = Math.min(from.max[cross], to.max[cross]);
        const across =
          lo < hi
            ? (lo + hi) / 2
            : Math.min(Math.max(mid(to, cross), from.min[cross] + inset), from.max[cross] - inset);
        const start = { x: useX ? along : across, z: useX ? across : along };
        const dir = { x: useX ? sign : 0, z: useX ? 0 : sign };

        h.shade.reset(h.map.shadeSpawns[0]);
        // Some surfaces in these chains sit under the deck with only crouch
        // headroom. Start the way the controller would leave you there.
        const place = (height) => {
          h.shade.height = height;
          h.shade.half.y = height / 2;
          h.shade.crouching = height < CONFIG.shade.standHeight;
          h.shade.position.set(start.x, from.max.y + height / 2 + 0.05, start.z);
          return h.map.collision.isClear(h.shade.position, h.shade.half);
        };
        if (!place(CONFIG.shade.standHeight) && !place(CONFIG.shade.crouchHeight)) {
          return { ok: false, why: `no room to stand on ${from.tag}` };
        }
        h.shade.velocity.set(0, 0, 0);
        h.shade.yaw = Math.atan2(-dir.x, -dir.z);
        h.shade.state = SHADE_STATE.GROUND;

        const intent = createIntent();
        intent.forward = 1;
        for (let i = 0; i < 300; i++) {
          intent.jumpPressed = i % 22 === 0;
          intent.jump = intent.jumpPressed;
          h.shade.step(CONFIG.time.fixedDt, intent);
          if (Math.abs(h.shade.feetY - to.max.y) < 0.3) {
            // Let the traversal finish and gravity settle before believing it.
            for (let k = 0; k < 40; k++) h.shade.step(CONFIG.time.fixedDt, createIntent());
            const landed = Math.abs(h.shade.feetY - to.max.y) < 0.35;
            const clear = h.map.collision.isClear(h.shade.position, h.shade.half);
            return { ok: landed && clear, why: landed ? (clear ? '' : 'landed inside geometry') : 'slid off' };
          }
        }
        return { ok: false, why: `never reached ${to.max.y.toFixed(1)}m (ended ${h.shade.feetY.toFixed(2)})` };
      };

      const box = (tag) => h.map.collision.boxes.find((entry) => entry.tag === tag);
      const routes = [
        { name: 'turbine hall crates', top: deck, tags: ['stack-hall-low', 'stack-hall-mid', 'hall-container', 'gantry-hall', 'lip-hall-east'] },
        { name: 'lower vent to hall deck', top: deck, tags: ['vent-low-south-lip-from', 'gantry-hall-south', 'lip-hall-south'] },
        { name: 'loading bay crates', top: deck, tags: ['stack-bay-low', 'stack-bay-mid', 'gantry-bay', 'lip-bay'] },
        { name: 'upper vent into the vault', top: deck, tags: ['stack-vault-low', 'stack-vault-mid', 'vent-up-vault-floor', 'lip-vault'] },
        { name: 'fire escape to the roof', top: roof, tags: ['fire-escape-base', 'fire-escape-0', 'fire-escape-1', 'fire-escape-2', 'fire-escape-3', 'fire-escape-4', 'lip-roof'] },
      ];

      const problems = [];
      const summaries = [];
      for (const route of routes) {
        const boxes = route.tags.map(box);
        const missing = route.tags.filter((tag, i) => !boxes[i]);
        if (missing.length) {
          problems.push(`${route.name}: missing [${missing.join(', ')}]`);
          continue;
        }
        if (boxes.some((entry) => /^stair-/.test(entry.tag))) {
          problems.push(`${route.name} uses a staircase`);
          continue;
        }
        let ok = true;
        for (let i = 0; i < boxes.length - 1 && ok; i++) {
          const result = hop(boxes[i], boxes[i + 1]);
          if (!result.ok) {
            problems.push(`${route.name}: ${boxes[i].tag} -> ${boxes[i + 1].tag} ${result.why}`);
            ok = false;
          }
        }
        if (!ok) continue;
        const reached = boxes[boxes.length - 1].max.y;
        if (Math.abs(reached - route.top) > 0.05) {
          problems.push(`${route.name} ends at ${reached.toFixed(2)}m, not ${route.top.toFixed(2)}m`);
          continue;
        }
        const rises = [];
        for (let i = 0; i < boxes.length - 1; i++) rises.push((boxes[i + 1].max.y - boxes[i].max.y).toFixed(1));
        summaries.push(`${route.name} (${rises.join('/')}m)`);
      }

      h.shade.reset(h.map.shadeSpawns[0]);

      return {
        pass: problems.length === 0,
        detail:
          problems.length === 0
            ? `${summaries.length} stairless routes driven end to end: ${summaries.join('; ')}`
            : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'every-room-has-two-entries',
    spec: 'v2 requirement 5',
    name: 'No room can be sealed by standing in one doorway',
    run: (h) => {
      const half = { x: CONFIG.shade.radius, y: CONFIG.shade.crouchHeight / 2, z: CONFIG.shade.radius };
      const problems = [];
      const summaries = [];

      for (const room of h.map.rooms) {
        if (room.entries.length < CONFIG.map.roomMinEntries) {
          problems.push(`${room.id}: ${room.entries.length} entries`);
          continue;
        }
        // Re-test each reported entry independently: a derived count is only
        // worth anything if the openings it counted are really passable.
        const bad = room.entries.filter((entry) => {
          const y = entry.kind === 'lateral' ? entry.at.y + half.y + 0.02 : entry.at.y;
          return !h.map.collision.isClear({ x: entry.at.x, y, z: entry.at.z }, half);
        });
        if (bad.length) {
          problems.push(`${room.id}: ${bad.length} reported entries are blocked`);
          continue;
        }
        const kinds = room.entries.map((entry) => entry.edge).join('/');
        summaries.push(`${room.id} ${room.entries.length} (${kinds})`);
      }

      return {
        pass: problems.length === 0,
        detail:
          problems.length === 0
            ? `${h.map.rooms.length} rooms, all with >= ${CONFIG.map.roomMinEntries} verified entries: ${summaries.join('; ')}`
            : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'waypoint-links-are-walkable',
    spec: 'Section 11 / phase 4 known issue',
    name: 'Every waypoint link is a straight line the Warden can actually walk',
    run: (h) => {
      const step = CONFIG.debug.linkWalkSample;
      const half = { x: CONFIG.warden.radius, y: CONFIG.warden.standHeight / 2, z: CONFIG.warden.radius };
      const maxRise = CONFIG.warden.stepHeight;
      const world = h.map.collision;
      const problems = [];
      let checked = 0;
      let samples = 0;

      // Stair treads are the floor of a flight, not obstacles in it. A capsule
      // standing on one always overlaps the risers ahead of it, so they are
      // excluded from the clearance test — the per-sample rise limit below is
      // what proves the flight is actually walkable.
      const treads = new Set();
      for (const stair of h.map.staircases) for (const step of stair.steps) treads.add(step);

      for (const node of h.map.waypoints) {
        for (const other of node.links) {
          if (other < node.id) continue; // each undirected link once
          const a = node.position;
          const b = h.map.waypoints[other].position;
          const length = Math.hypot(b.x - a.x, b.z - a.z);
          const count = Math.max(2, Math.ceil(length / step));
          let previous = null;
          let failed = null;

          for (let i = 0; i <= count && !failed; i++) {
            const t = i / count;
            const x = a.x + (b.x - a.x) * t;
            const z = a.z + (b.z - a.z) * t;
            // Probe around the height the route is expected to be at, so a
            // staircase is traced along its treads rather than measured
            // against the deck slab passing overhead.
            const expected = a.y + (b.y - a.y) * t;
            const floor = world.raycast({ x, y: expected + 1.5, z }, { x: 0, y: -1, z: 0 }, 4.0);
            samples++;
            if (!floor) {
              failed = `no floor at (${x.toFixed(1)}, ${z.toFixed(1)})`;
              break;
            }
            // Ignore stair treads and anything low enough to walk over.
            const passable = (box) => !treads.has(box) && box.max.y > floor.y + maxRise;
            if (!world.isClear({ x, y: floor.y + half.y + 0.05, z }, half, passable)) {
              failed = `blocked at (${x.toFixed(1)}, ${z.toFixed(1)})`;
              break;
            }
            if (previous !== null && Math.abs(floor.y - previous) > maxRise + 1e-6) {
              failed = `${(floor.y - previous).toFixed(2)}m step at (${x.toFixed(1)}, ${z.toFixed(1)})`;
              break;
            }
            previous = floor.y;
          }

          checked++;
          if (failed) problems.push(`${node.id}(${node.tag}) -> ${other}(${h.map.waypoints[other].tag}): ${failed}`);
        }
      }

      return {
        pass: problems.length === 0,
        detail:
          problems.length === 0
            ? `${checked} links, ${samples} samples at ${step}m: floor found everywhere, Warden capsule fits, no rise above ${maxRise}m`
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
        // A long clear lane down the Turbine Hall: 27m of open floor before the
        // south wall, well past what a 2s sprint covers. Kept east of the
        // grade vent that now pierces the west wall, and north of the crates.
        h.shade.reset(h.map.shadeSpawns[0]);
        h.shade.position.set(-24, CONFIG.shade.standHeight / 2 + 0.05, -19);
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
        h.warden.position.set(-24, CONFIG.warden.standHeight / 2 + 0.05, -19);
        h.warden.yaw = Math.PI; // down the clear lane of the Turbine Hall
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

  // -------------------------------------------------------------------------
  // Phase 5 — detection (Section 7, Section 4.2)
  // -------------------------------------------------------------------------

  debugTools.registerAutoTest({
    id: 'visibility-sampling-stays-in-budget',
    spec: 'Section 7.1 / Section 15 (light sampling tanks framerate)',
    name: 'Sampled on a 100ms cadence, never more than 5 rays per light',
    run: (h) => {
      const d = h.detection;
      const dt = CONFIG.time.fixedDt;
      const problems = [];

      // Park the Shade under the brightest part of the map so lights are in
      // range and the budget is actually being spent.
      h.shade.reset(h.map.shadeSpawns[0]);
      h.shade.position.set(-18, CONFIG.shade.standHeight / 2 + 0.05, -4);
      d.reset(h.shade);

      const before = d.samples;
      const seconds = 2;
      let maxRays = 0;
      for (let i = 0; i < seconds / dt; i++) {
        d.step(dt, { shade: h.shade, warden: h.warden });
        maxRays = Math.max(maxRays, d.raysLastSample);
      }
      const taken = d.samples - before;
      const expected = seconds / CONFIG.detection.sampleInterval;
      // Captured here, not after the reset below: the reset resamples at the
      // spawn, where nothing is in range, so reading it later would report a
      // different moment than the one being asserted.
      const lights = d.lightsLastSample;

      // Two seconds at 100ms is 20 samples, not 120 steps' worth.
      if (Math.abs(taken - expected) > 1) problems.push(`${taken} samples in ${seconds}s, expected ~${expected}`);
      if (lights > 0 && maxRays !== lights * CONFIG.detection.raysPerLight) {
        problems.push(`${maxRays} rays for ${lights} lights, cap is ${CONFIG.detection.raysPerLight}/light`);
      }
      if (lights === 0) problems.push('no lights in range at site A, so the budget was not exercised');

      h.shade.reset(h.map.shadeSpawns[0]);
      d.reset(h.shade);

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${taken} samples over ${seconds}s at ${CONFIG.detection.sampleInterval * 1000}ms (${seconds / dt} steps); ${lights} lights in range, ${maxRays} rays (cap ${CONFIG.detection.raysPerLight}/light)`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'visibility-reads-lit-and-dark-zones',
    spec: 'Section 16 checks 8 and 9 (auto half)',
    name: 'Turbine Hall reads above 70; the Server Vault reads below 25',
    run: (h) => {
      const d = h.detection;
      const dt = CONFIG.time.fixedDt;

      const settle = (x, y, z, crouch) => {
        h.shade.reset(h.map.shadeSpawns[0]);
        h.shade.position.set(x, y + CONFIG.shade.standHeight / 2 + 0.05, z);
        h.shade.velocity.set(0, 0, 0);
        h.shade.crouching = !!crouch;
        d.reset(h.shade);
        // A second of simulation so the smoothed value has fully caught up.
        for (let i = 0; i < 1 / dt; i++) d.step(dt, { shade: h.shade, warden: null });
        return d.smoothed;
      };

      const siteA = h.map.sites.find((s) => s.id === 'A');
      const siteC = h.map.sites.find((s) => s.id === 'C');
      const hall = settle(siteA.position.x, siteA.position.y, siteA.position.z, false);
      const vault = settle(siteC.position.x, siteC.position.y, siteC.position.z, false);
      // A vent is unlit no matter what is outside it (Section 5).
      const vent = h.map.vents[0];
      const inVent = settle((vent.min.x + vent.max.x) / 2, vent.min.y, (vent.min.z + vent.max.z) / 2, true);

      h.shade.reset(h.map.shadeSpawns[0]);
      d.reset(h.shade);

      // Headroom matters as much as the threshold: a meter pegged at the clamp
      // cannot show a light going out, which is check 10.
      const headroom = hall < CONFIG.detection.meterMax - 5;
      const pass = hall > 70 && headroom && vault < 25 && inVent === 0;
      return {
        pass,
        detail: `Turbine Hall ${hall.toFixed(1)} (want >70, unclamped=${headroom}), Server Vault ${vault.toFixed(1)} (want <25), inside a vent ${inVent.toFixed(1)} (want 0); scoreScale ${CONFIG.detection.scoreScale}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'light-break-invalidates-the-cache',
    spec: 'Section 16 check 10 / Section 15',
    name: 'Shooting out the light overhead drops the meter within 200ms',
    run: (h) => {
      const d = h.detection;
      const dt = CONFIG.time.fixedDt;

      // Stand under site A's own fixture, the brightest spot on the map.
      const lamp = h.map.lights.find((entry) => entry.tag === 'hall-site-a');
      if (!lamp) return { pass: false, detail: 'hall-site-a light missing' };

      h.shade.reset(h.map.shadeSpawns[0]);
      h.shade.position.set(lamp.position.x, CONFIG.shade.standHeight / 2 + 0.05, lamp.position.z);
      d.reset(h.shade);
      for (let i = 0; i < 1 / dt; i++) d.step(dt, { shade: h.shade, warden: null });
      const before = d.smoothed;
      const rawBefore = d.raw;
      const noiseBefore = d.noise.activeCount;

      // Break it mid-interval, so a system that only resampled on the tick
      // would still be serving the stale value.
      d.step(dt * 0.5, { shade: h.shade, warden: null });
      d.breakLight(lamp.lightId, 'test');
      const rawAfterOneStep = (() => {
        d.step(dt, { shade: h.shade, warden: null });
        return d.raw;
      })();

      // 200ms of simulation, per check 10.
      for (let i = 0; i < 0.2 / dt - 1; i++) d.step(dt, { shade: h.shade, warden: null });
      const after = d.smoothed;

      const noiseFired = d.noise.active().some((e) => e.type === 'light-destroyed');
      const cacheUpdatedImmediately = rawAfterOneStep < rawBefore - 1;
      const meterDropped = after < before - 1;

      // Restore, or the suite leaves the map dark for everything after it.
      lamp.broken = false;
      lamp.light.intensity = lamp.intensity;
      lamp.glassMaterial.color.set(CONFIG.palette.lightWarm);
      h.shade.reset(h.map.shadeSpawns[0]);
      d.reset(h.shade);

      return {
        pass: cacheUpdatedImmediately && meterDropped && noiseFired,
        detail: `raw ${rawBefore.toFixed(1)} -> ${rawAfterOneStep.toFixed(1)} on the next step (no wait for the 100ms tick)=${cacheUpdatedImmediately}; smoothed ${before.toFixed(1)} -> ${after.toFixed(1)} within 200ms=${meterDropped}; 20m noise emitted=${noiseFired} (${noiseBefore} events before)`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'shade-is-quieter-than-the-warden',
    spec: 'Section 7.2',
    name: 'Noise radii match spec, and crouch and vents are silent',
    run: (h) => {
      const d = h.detection;
      const dt = CONFIG.time.fixedDt;
      const problems = [];

      // Walk an actor in a straight clear lane and collect what it emitted.
      const walk = (actor, intent, steps, reset) => {
        d.noise.clear();
        reset();
        const seen = [];
        const off = h.emitter.on('noise', (event) => {
          if (event.source === (actor === h.shade ? 'shade' : 'warden')) seen.push(event.radius);
        });
        for (let i = 0; i < steps; i++) {
          actor.step(dt, intent);
          d.step(dt, { shade: actor === h.shade ? actor : null, warden: actor === h.warden ? actor : null });
        }
        off();
        return seen;
      };

      const lane = (actor, height) => () => {
        actor.reset(actor === h.shade ? h.map.shadeSpawns[0] : h.map.wardenSpawns[0]);
        actor.position.set(-24, height / 2 + 0.05, -19);
        actor.yaw = Math.PI;
        actor.velocity.set(0, 0, 0);
      };

      const shadeIntentLocal = createIntent();
      shadeIntentLocal.forward = 1;
      const shadeWalk = walk(h.shade, shadeIntentLocal, 180, lane(h.shade, CONFIG.shade.standHeight));
      shadeIntentLocal.sprint = true;
      const shadeSprint = walk(h.shade, shadeIntentLocal, 180, lane(h.shade, CONFIG.shade.standHeight));
      shadeIntentLocal.sprint = false;
      shadeIntentLocal.crouch = true;
      const shadeCrouch = walk(h.shade, shadeIntentLocal, 240, lane(h.shade, CONFIG.shade.standHeight));

      const wardenIntentLocal = createWardenIntent();
      wardenIntentLocal.forward = 1;
      const wardenWalk = walk(h.warden, wardenIntentLocal, 180, lane(h.warden, CONFIG.warden.standHeight));
      wardenIntentLocal.sprint = true;
      const wardenSprint = walk(h.warden, wardenIntentLocal, 180, lane(h.warden, CONFIG.warden.standHeight));

      const R = CONFIG.noise.radii;
      const only = (list, value, label) => {
        if (list.length === 0) return problems.push(`${label} emitted nothing`);
        if (list.some((r) => r !== value)) problems.push(`${label} emitted ${[...new Set(list)].join('/')}, expected ${value}`);
      };
      only(shadeWalk, R.shadeWalk, 'shade walk');
      only(shadeSprint, R.shadeSprint, 'shade sprint');
      only(wardenWalk, R.wardenWalk, 'warden walk');
      only(wardenSprint, R.wardenSprint, 'warden sprint');
      if (shadeCrouch.length !== 0) problems.push(`crouch-walk emitted ${shadeCrouch.length} events, must be silent`);

      // The core design pillar (Section 7.2): the Shade is quieter than the
      // Warden at every equivalent stance.
      if (!(R.shadeWalk < R.wardenWalk)) problems.push('shade walk is not quieter than warden walk');
      if (!(R.shadeSprint < R.wardenSprint)) problems.push('shade sprint is not quieter than warden sprint');

      // And a vent is silent regardless of stance.
      const vent = h.map.vents[0];
      d.noise.clear();
      h.shade.reset(h.map.shadeSpawns[0]);
      h.shade.height = CONFIG.shade.crouchHeight;
      h.shade.half.y = h.shade.height / 2;
      h.shade.crouching = true;
      h.shade.position.set((vent.min.x + vent.max.x) / 2, vent.min.y + h.shade.half.y + 0.02, (vent.min.z + vent.max.z) / 2);
      h.shade.strideDistance += 100; // force the cadence
      d.step(dt, { shade: h.shade, warden: null });
      if (d.noise.activeCount !== 0) problems.push('a vent emitted noise');

      d.noise.clear();
      h.shade.reset(h.map.shadeSpawns[0]);
      h.warden.reset(h.map.wardenSpawns[0]);
      d.reset(h.shade);

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `shade walk ${R.shadeWalk}m (${shadeWalk.length} steps) / sprint ${R.shadeSprint}m (${shadeSprint.length}) / crouch silent; warden walk ${R.wardenWalk}m (${wardenWalk.length}) / sprint ${R.wardenSprint}m (${wardenSprint.length}); vent silent`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'noise-events-expire-and-are-capped',
    spec: 'Section 7.2 / Section 15 (effects never expire)',
    name: 'Noise events expire after 0.4s and the pool never grows',
    run: (h) => {
      const d = h.detection;
      const dt = CONFIG.time.fixedDt;
      d.noise.clear();

      // Flood well past the cap from one spot.
      for (let i = 0; i < CONFIG.noise.maxEvents * 3; i++) {
        d.noise.emit(0, 0, 0, 5, 'flood', 'test');
      }
      const peak = d.noise.activeCount;
      const poolSize = d.noise.pool.length;

      // Silence must not occupy a slot.
      const silent = d.noise.emit(0, 0, 0, 0, 'silent', 'test');

      let steps = 0;
      while (d.noise.activeCount > 0 && steps < 120) {
        d.noise.step(dt);
        steps++;
      }
      const drainedSeconds = steps * dt;
      const settled = d.noise.activeCount;

      // And hearing is a plain distance test (Section 7.2).
      d.noise.clear();
      d.noise.emit(10, 0, 0, 8, 'probe', 'test');
      const nearHeard = d.noise.heard({ x: 14, y: 0, z: 0 }) !== null;
      const farHeard = d.noise.heard({ x: 22, y: 0, z: 0 }) !== null;
      d.noise.clear();
      d.reset(h.shade);

      const pass =
        peak <= CONFIG.noise.maxEvents && poolSize === CONFIG.noise.maxEvents &&
        silent === null && settled === 0 &&
        drainedSeconds <= CONFIG.noise.lifetime + dt * 2 && nearHeard && !farHeard;
      return {
        pass,
        detail: `flooded ${CONFIG.noise.maxEvents * 3} -> ${peak} active (cap ${CONFIG.noise.maxEvents}), pool fixed at ${poolSize}; silence took no slot=${silent === null}; drained to ${settled} in ${drainedSeconds.toFixed(2)}s (lifetime ${CONFIG.noise.lifetime}s); heard at 4m=${nearHeard}, at 12m past an 8m radius=${farHeard}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'outlines-sit-on-the-body-they-outline',
    spec: 'Section 4 / reported bug: teal capsules floating at the shoulders',
    name: 'Every inverted-hull outline is coincident with its own mesh',
    run: (h) => {
      const strays = [];
      const bodyPosition = new THREE.Vector3();
      const outlinePosition = new THREE.Vector3();

      const audit = (root, label) => {
        root.updateMatrixWorld(true);
        let pairs = 0;
        root.traverse((object) => {
          if (!object.isMesh) return;
          // An outline is the BackSide duplicate parented to the mesh it hulls.
          const outlines = object.children.filter((child) => child.isMesh && child.material.side === THREE.BackSide);
          for (const outline of outlines) {
            pairs++;
            object.getWorldPosition(bodyPosition);
            outline.getWorldPosition(outlinePosition);
            const drift = bodyPosition.distanceTo(outlinePosition);
            if (drift > 1e-6) {
              strays.push(`${label} ${object.geometry.type} outline drifts ${drift.toFixed(3)}m`);
            }
          }
        });
        return pairs;
      };

      const shadePairs = audit(h.shade.mesh, 'shade');
      const wardenPairs = audit(h.warden.mesh, 'warden');

      // Every visible body part must actually carry one, or an outline could
      // "not drift" simply by not existing.
      const bodies = [];
      for (const [root, label] of [[h.shade.mesh, 'shade'], [h.warden.mesh, 'warden']]) {
        root.traverse((object) => {
          if (!object.isMesh) return;
          if (object.material.side === THREE.BackSide) return;
          if (!object.children.some((child) => child.isMesh && child.material.side === THREE.BackSide)) {
            strays.push(`${label} ${object.geometry.type} has no outline`);
          }
          bodies.push(label);
        });
      }

      return {
        pass: strays.length === 0 && shadePairs > 0 && wardenPairs > 0,
        detail:
          strays.length === 0
            ? `${bodies.length} body meshes across both actors, ${shadePairs + wardenPairs} outlines, all coincident with the mesh they hull`
            : strays.slice(0, 6).join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'visibility-feedback-matches-the-meter',
    spec: 'Section 4.2',
    name: 'The Shade darkens and brightens in step with the smoothed meter',
    run: (h) => {
      const d = h.detection;
      const materials = h.shade.mesh.userData.materials;
      if (!materials || !materials.outline) return { pass: false, detail: 'shade materials not exposed' };

      const F = CONFIG.detection.feedback;
      const readings = [];
      // Drive the meter directly across its whole range and read what the
      // player would see. This is the disagreement Section 4.2 forbids.
      for (const value of [0, 25, 50, 75, 100]) {
        d.smoothed = value;
        d._applyFeedback(h.shade);
        readings.push({
          meter: value,
          body: materials.teal.color.getHSL({ h: 0, s: 0, l: 0 }).l,
          rim: materials.outline.color.getHSL({ h: 0, s: 0, l: 0 }).l,
        });
      }

      let monotonic = true;
      for (let i = 1; i < readings.length; i++) {
        if (readings[i].body <= readings[i - 1].body) monotonic = false;
        if (readings[i].rim <= readings[i - 1].rim) monotonic = false;
      }
      const darkAtZero = readings[0].body < readings[4].body * (F.silhouetteDarkness + 0.1);
      const rimVisibleAtZero = readings[0].rim > 0;

      // Restore, and prove the value the player sees is the smoothed one and
      // not the raw sample: the two differ mid-transition.
      d.reset(h.shade);
      const rawOnly = d.raw;
      d.smoothed = 0;
      d.raw = 100;
      d.step(CONFIG.time.fixedDt, { shade: h.shade, warden: null });
      const tracksSmoothed = d.litFraction < 0.5;
      d.reset(h.shade);

      return {
        pass: monotonic && darkAtZero && rimVisibleAtZero && tracksSmoothed,
        detail: `body lightness ${readings.map((r) => r.body.toFixed(2)).join(' -> ')}, rim ${readings.map((r) => r.rim.toFixed(2)).join(' -> ')} across meter 0..100; monotonic=${monotonic}, near-black at 0=${darkAtZero}, teal edge still visible at 0=${rimVisibleAtZero}, driven by smoothed not raw=${tracksSmoothed} (raw was ${rawOnly.toFixed(1)})`,
      };
    },
  });

  // -------------------------------------------------------------------------
  // Phase 6 — Warden AI (Section 11)
  // -------------------------------------------------------------------------

  debugTools.registerAutoTest({
    id: 'ai-paths-between-every-waypoint-pair',
    spec: 'Section 11 (A* over the waypoint graph)',
    name: 'A* returns a valid, acyclic, connected route for every node pair',
    run: (h) => {
      const ai = h.wardenAI;
      const nodes = h.map.waypoints;
      const problems = [];
      let pairs = 0;
      let longest = 0;

      for (let a = 0; a < nodes.length; a++) {
        for (let b = 0; b < nodes.length; b++) {
          pairs++;
          const path = ai._findPath(a, b);
          // A path must start where asked, end where asked, contain no repeats,
          // and only step along declared links. A cycle in the parent chain
          // shows up here as a repeat rather than as a hung tab.
          if (path[0] !== a) problems.push(`${a}->${b} starts at ${path[0]}`);
          if (path[path.length - 1] !== b) problems.push(`${a}->${b} ends at ${path[path.length - 1]}`);
          if (new Set(path).size !== path.length) problems.push(`${a}->${b} revisits a node: [${path}]`);
          for (let i = 1; i < path.length; i++) {
            if (nodes[path[i - 1]].links.indexOf(path[i]) === -1) {
              problems.push(`${a}->${b} steps ${path[i - 1]}->${path[i]} with no link`);
            }
          }
          longest = Math.max(longest, path.length);
          if (problems.length > 4) break;
        }
        if (problems.length > 4) break;
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${pairs} node pairs, every route valid and acyclic, longest ${longest} nodes`
          : problems.slice(0, 4).join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'ai-patrols-without-getting-stuck',
    spec: 'Section 11 (PATROL, stuck handling)',
    name: 'The Warden walks its circuit for a minute without wedging',
    run: (h) => {
      const ai = h.wardenAI;
      const dt = CONFIG.time.fixedDt;
      h.warden.reset(h.map.wardenSpawns[0]);
      ai.reset();

      const start = h.warden.position.clone();
      let travelled = 0;
      const previous = h.warden.position.clone();
      const seen = new Set();
      // A minute of patrol with no Shade to notice, so it should never leave
      // PATROL of its own accord.
      for (let i = 0; i < 60 / dt; i++) {
        h.warden.step(dt, ai.step(dt, { shade: null }));
        travelled += previous.distanceTo(h.warden.position);
        previous.copy(h.warden.position);
        seen.add(ai.state);
      }

      const strayed = [...seen].filter((state) => state !== AI_STATE.PATROL);
      const onFloor = h.warden.feetY > -CONFIG.debug.floorTolerance;
      const clear = h.map.collision.isClear(h.warden.position, h.warden.half);
      const moved = start.distanceTo(h.warden.position);

      h.warden.reset(h.map.wardenSpawns[0]);
      ai.reset();

      // Stuck detection is allowed to fire — the point is that it recovers and
      // keeps walking, not that a 60s patrol is always perfectly smooth.
      const pass = travelled > 30 && strayed.length === 0 && onFloor && clear && ai.stuckCount <= 4;
      return {
        pass,
        detail: `walked ${travelled.toFixed(1)}m over 60s (net ${moved.toFixed(1)}m), states [${[...seen].join(' ')}], stuck re-paths ${ai.stuckCount}, feet ${h.warden.feetY.toFixed(2)}, capsule clear=${clear}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'ai-perception-cone-and-accumulator',
    spec: 'Section 11 (perception)',
    name: '90 degree cone, 25m, needs an unobstructed ray; drains without one',
    run: (h) => {
      const ai = h.wardenAI;
      const dt = CONFIG.time.fixedDt;

      // Face the Warden down a long clear lane in the Turbine Hall.
      const place = (shadeX, shadeZ) => {
        h.warden.reset(h.map.wardenSpawns[0]);
        h.warden.position.set(-24, CONFIG.warden.standHeight / 2 + 0.05, -19);
        h.warden.yaw = Math.PI; // +Z, down the lane
        h.shade.reset(h.map.shadeSpawns[0]);
        h.shade.position.set(shadeX, CONFIG.shade.standHeight / 2 + 0.05, shadeZ);
        ai.reset();
        ai.accumulator = 0;
        h.detection.reset(h.shade);
        h.detection.smoothed = CONFIG.detection.meterMax; // fully lit, worst case
      };

      const look = (steps) => {
        for (let i = 0; i < steps; i++) {
          h.detection.smoothed = CONFIG.detection.meterMax;
          ai._perceive(dt, h.shade);
        }
        return { sees: ai.sees, acc: ai.accumulator };
      };

      // 1. Straight ahead, 8m, clear line: seen, accumulator climbs.
      place(-24, -11);
      const ahead = look(30);

      // 2. Directly behind: outside the 90 degree cone.
      place(-24, -25);
      const behind = look(30);

      // 3. Ahead but past the 25m range.
      place(-24, 8);
      const far = look(30);

      // 4. Ahead and in range, but with the hall's east wall between them.
      place(-2, -11);
      const walled = look(30);

      // 5. Drains at 15/s once sight is lost (Section 11).
      place(-24, -11);
      look(120);
      const peak = ai.accumulator;
      h.shade.position.set(-24, CONFIG.shade.standHeight / 2 + 0.05, -25); // step behind
      const before = ai.accumulator;
      for (let i = 0; i < 1 / dt; i++) ai._perceive(dt, h.shade);
      const drained = before - ai.accumulator;

      h.shade.reset(h.map.shadeSpawns[0]);
      h.warden.reset(h.map.wardenSpawns[0]);
      ai.reset();
      h.detection.reset(h.shade);

      const problems = [];
      if (!ahead.sees || ahead.acc <= 0) problems.push('did not see a lit Shade 8m dead ahead');
      if (behind.sees) problems.push('saw through the back of its own head');
      if (far.sees) problems.push(`saw past the ${CONFIG.ai.viewRange}m range`);
      if (walled.sees) problems.push('saw through a wall');
      if (Math.abs(drained - CONFIG.ai.drainRate) > 1.5) {
        problems.push(`drained ${drained.toFixed(1)}/s, spec is ${CONFIG.ai.drainRate}/s`);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `ahead acc ${ahead.acc.toFixed(1)}; behind/out-of-range/through-wall all unseen; peaked ${peak.toFixed(1)} then drained ${drained.toFixed(1)}/s (spec ${CONFIG.ai.drainRate})`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'ai-state-machine-follows-section-11',
    spec: 'Section 11 (state table)',
    name: 'Noise, thresholds and a stun move the AI through the spec states',
    run: (h) => {
      const ai = h.wardenAI;
      const dt = CONFIG.time.fixedDt;
      const problems = [];

      const settle = () => {
        h.warden.reset(h.map.wardenSpawns[0]);
        h.shade.reset(h.map.shadeSpawns[0]);
        ai.reset();
        h.detection.noise.clear();
      };

      // The whole escalation, driven the way play drives it: a noise puts the
      // Warden on alert, it turns and walks to the source, sees the Shade on
      // the way in, and the accumulator carries it to ENGAGE. Poking the
      // accumulator directly does not work and should not — the drain runs
      // before the threshold test, so an assigned 100 is already below it.
      settle();
      h.warden.position.set(-24, CONFIG.warden.standHeight / 2 + 0.05, -19);
      h.warden.yaw = Math.PI; // +Z, down a clear lane in the Turbine Hall
      h.shade.position.set(-24, CONFIG.shade.standHeight / 2 + 0.05, -11);
      h.detection.reset(h.shade);
      h.detection.noise.emit(
        h.shade.position.x, h.shade.feetY, h.shade.position.z, 12, 'test', 'shade'
      );

      // Tick detection alongside, exactly as fixedStep does. Without it the
      // noise field never ages, a stale event lives forever, and the Warden
      // re-investigates it the moment it wanders back into range.
      const drive = (steps, target, shade) => {
        for (let i = 0; i < steps; i++) {
          h.detection.step(dt, { shade, warden: h.warden });
          // Hold the Shade fully lit; the meter itself is Phase 5's problem.
          h.detection.smoothed = CONFIG.detection.meterMax;
          h.warden.step(dt, ai.step(dt, { shade }));
          if (target && ai.state === target) return i;
        }
        return -1;
      };

      ai._perceive(dt, h.shade);
      if (ai.state !== AI_STATE.SUSPICIOUS) problems.push(`noise gave ${ai.state}, want suspicious`);
      if (drive(Math.ceil((CONFIG.ai.suspiciousHold + 0.2) / dt), AI_STATE.INVESTIGATE, h.shade) < 0) {
        problems.push(`after the hold got ${ai.state}, want investigate`);
      }
      if (drive(Math.ceil(20 / dt), AI_STATE.ENGAGE, h.shade) < 0) {
        problems.push(`never engaged a lit Shade in view (state ${ai.state}, acc ${ai.accumulator.toFixed(0)})`);
      }

      // Losing sight for 2.5s in ENGAGE -> SEARCH.
      drive(Math.ceil((CONFIG.ai.engageLoseSightTime + 0.3) / dt), null, null);
      if (ai.state !== AI_STATE.SEARCH) problems.push(`lost sight gave ${ai.state}, want search`);

      // SEARCH times out back to PATROL.
      drive(Math.ceil((CONFIG.ai.searchDuration + 0.5) / dt), null, null);
      if (ai.state !== AI_STATE.PATROL) problems.push(`search timeout gave ${ai.state}, want patrol`);

      // A stun freezes it, and Section 11 says it comes out into SEARCH.
      settle();
      h.warden.stun(0.5);
      h.warden.step(dt, ai.step(dt, { shade: null }));
      if (ai.state !== AI_STATE.STUNNED) problems.push(`stun gave ${ai.state}, want stunned`);
      const frozen = h.warden.position.clone();
      drive(Math.ceil(0.4 / dt), null, null);
      if (frozen.distanceTo(h.warden.position) > 0.05) problems.push('moved while stunned');
      drive(Math.ceil(0.4 / dt), null, null);
      if (ai.state !== AI_STATE.SEARCH) problems.push(`stun ended in ${ai.state}, want search`);

      settle();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? 'noise -> suspicious -> investigate; accumulator 100 -> engage; sight lost 2.5s -> search; search timeout -> patrol; stun freezes then -> search'
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'ai-patrol-order-is-seed-reproducible',
    spec: 'Section 16 check 28',
    name: 'The same seed reproduces the same patrol circuit',
    run: (h) => {
      const ai = h.wardenAI;
      const seed = 0xa17ea5;

      rng.reseed(seed);
      ai.reset();
      const first = ai._circuit.slice();

      rng.reseed(seed);
      ai.reset();
      const second = ai._circuit.slice();

      rng.reseed(seed + 1);
      ai.reset();
      const other = ai._circuit.slice();

      rng.reseed(h.match.seed);
      ai.reset();

      const same = first.join() === second.join();
      const differs = first.join() !== other.join();
      const covers = new Set(first).size === h.map.waypoints.length;
      return {
        pass: same && differs && covers,
        detail: `same seed identical=${same}, seed+1 differs=${differs}, circuit covers all ${h.map.waypoints.length} nodes=${covers}; first 6 [${first.slice(0, 6).join(' ')}]`,
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
  get detection() {
    return detection;
  },
  get wardenAI() {
    return wardenAI;
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
