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
  emitter.emit('sim:step', dt);
  if (DEBUG) debugTools.step();
}

function frame(now) {
  frameHandle = requestAnimationFrame(frame);

  const wallDelta = lastFrameTime === 0 ? 0 : (now - lastFrameTime) / 1000;
  lastFrameTime = now;
  clock.wall += wallDelta;
  clock.frame++;

  // Before the steps: a step clears input edges, which would eat F3/F4.
  debugTools.pollKeys();

  emitter.emit('frame:begin', { wallDelta, input });

  const plan = computeStepPlan(accumulator, wallDelta, clock.timeScale);
  accumulator = plan.accumulator;
  for (let i = 0; i < plan.steps; i++) {
    fixedStep(plan.dt);
    input.clearEdges();
  }
  debugState.stepsPerFrame = plan.steps;

  const alpha = accumulator / plan.dt;
  emitter.emit('frame:render', { alpha, wallDelta });

  const cpuStart = performance.now();
  renderer.render(scene, camera);
  debugState.cpuMs = performance.now() - cpuStart;
  debugState.drawCalls = renderer.info.render.calls;
  debugState.triangles = renderer.info.render.triangles;
  debugState.rngCalls = rng.calls;

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
initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });

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
