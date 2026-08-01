/**
 * BLACKLINE - tests/engine.js
 *
 * AUTO suite (Section 16, Section 17.1): Engine invariants.
 *
 * Fixed timestep, the seeded PRNG, the one camera, the emitter contract and
 * match-state rebuilding.
 *
 * Registered from tests/index.js. Checks reach the live game through the
 * harness `h`; nothing here imports main.js, which Section 3.1 forbids.
 */

import { CONFIG, rng } from '../config.js';

export function register(debugTools) {
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
    run: (h) => {
      const dt = CONFIG.time.fixedDt;
      const deltas = [0, 0.001, 1 / 240, 1 / 60, 1 / 30, 0.1, 0.5, 4, 60, NaN, -1, Infinity];
      const scales = [1, 0.05, 0.25, 4];
      let violations = 0;
      let maxSteps = 0;
      let acc = 0;

      for (const scale of scales) {
        for (const delta of deltas) {
          const plan = h.computeStepPlan(acc, delta, scale);
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
    run: (h) => {
      const dt = CONFIG.time.fixedDt;
      const wall = 1.0; // one second of wall clock, delivered in 1/60s frames
      const frameDelta = 1 / 60;
      const frames = Math.round(wall / frameDelta);

      const simulate = (scale) => {
        let acc = 0;
        let steps = 0;
        for (let i = 0; i < frames; i++) {
          const plan = h.computeStepPlan(acc, frameDelta, scale);
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
        h.createCamera();
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
      const after = h.initMatch({ seed });

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
