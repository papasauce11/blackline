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
import { createWardenAI } from './systems/ai.js';
import { createCombat } from './systems/combat.js';
import { createAudio } from './systems/audio.js';
import { DebugTools } from './ui/debug.js';
import { registerAutoTests } from './tests/index.js';

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
/** @type {import('./systems/combat.js').Combat} */ let combat = null;
/** @type {import('./systems/audio.js').AudioSystem} */ let audio = null;
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
  if (combat) combat.reset();
  if (audio) audio.reset();
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

  // Section 8. The finisher needs the camera and the time scale, so it is
  // handed the same two functions the composition root uses rather than
  // reaching for them.
  combat = createCombat({
    map, emitter, detection, ai: wardenAI, scene, camera, setTimeScale, setCameraOwner,
  });
  // Section 14. Listens on the emitter and is unlocked by the first gesture,
  // because a context built before one starts suspended (Section 15).
  audio = createAudio({ emitter, listener: shade });

  freefly.enabled = false;
  freefly.position.copy(map.shadeSpawns[0].position).setY(map.shadeSpawns[0].position.y + 1.7);

  input = new Input(canvas);
  canvas.addEventListener('mousedown', () => {
    input.requestLock();
    audio.unlock();
  });

  window.addEventListener('resize', onResize);

  debugTools = new DebugTools({ input, emitter, debugState, harness });
  registerDebugAssertions();
  registerAutoTests(debugTools);
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
  combat.step(dt, {
    shade, warden,
    shadeIntent: match.role === 'shade' && !freefly.enabled ? shadeIntent : null,
    wardenIntent: wardenAI.intent,
  });

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
  shadeIntent.melee = input.pressed('melee');
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
  get combat() {
    return combat;
  },
  get audio() {
    return audio;
  },
  get cameraOwner() {
    return cameraOwner;
  },
  setCameraOwner,
  createCamera,
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
