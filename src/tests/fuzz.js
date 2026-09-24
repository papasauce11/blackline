/**
 * BLACKLINE - tests/fuzz.js
 *
 * AUTO suite: adversarial. Two checks that try to break the game rather than
 * confirm it works.
 *
 * Both exist because of the same lesson, learned twice. Phase 3's ledge hang
 * and Phase 21's slide were each unreachable from a keyboard while every check
 * covering them passed, because the checks set intent fields directly and could
 * therefore pick combinations no player can produce. A held key and its press
 * edge arrive on the SAME step; a test that sets one without the other is
 * testing a machine nobody is sitting at.
 *
 * So the input fuzz drives real key codes through the real binding layer, and
 * the lifecycle fuzz drives the round, match and cinematic state machines into
 * each other rather than exercising them one at a time.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG, rng } from '../config.js';
import { SHADE_STATE } from '../entities/agent.js';
import { ROUND } from '../systems/objective.js';
import { exploreSeed } from './seeds.js';

/** The match this fuzz is played in. `?seed=` moves it; see tests/seeds.js. */
const FUZZ_SEED = exploreSeed('shade-fuzz', 8675309);

/**
 * Everything that must be true after anything at all has happened. Returns a
 * list of whatever is not.
 */
function invariants(h, where) {
  const bad = [];
  const shade = h.shade;
  const warden = h.warden;

  for (const [name, actor] of [['shade', shade], ['warden', warden]]) {
    for (const field of ['position', 'velocity']) {
      const v = actor[field];
      if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) {
        bad.push(`${where}: ${name}.${field} is not finite`);
      }
    }
  }
  const floor = CONFIG.map.groundY - CONFIG.debug.floorTolerance;
  if (shade.feetY < floor) bad.push(`${where}: shade fell to y=${shade.feetY.toFixed(2)}`);

  let states = 0;
  for (const key of Object.keys(SHADE_STATE)) if (SHADE_STATE[key] === shade.state) states++;
  if (states !== 1) bad.push(`${where}: shade in unknown state "${shade.state}"`);

  let cameras = 0;
  h.scene.traverse((object) => { if (object.isCamera) cameras++; });
  if (cameras !== 1) bad.push(`${where}: ${cameras} cameras in the scene`);

  if (!(h.clock.timeScale > 0) || !Number.isFinite(h.clock.timeScale)) {
    bad.push(`${where}: time scale is ${h.clock.timeScale}`);
  }
  if (!Number.isFinite(h.detection.smoothed) || h.detection.smoothed < 0) {
    bad.push(`${where}: visibility meter is ${h.detection.smoothed}`);
  }
  return bad;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'random-real-input-never-breaks-anything',
    spec: 'Section 17 / Section 15',
    name: 'Seeded random KEY PRESSES, not intents, for a simulated minute',
    run: (h) => {
      const problems = [];
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true, seed: FUZZ_SEED });
      h.menu.hide();
      h.setPaused(false);
      h.input.clearAll();

      const steps = Math.round(60 / CONFIG.time.fixedDt);
      const seen = new Set();
      let checks = 0;

      /**
       * Uniform key churn produces a player having a seizure, and it reached
       * only ground and air. Real input arrives in BURSTS: a run held for a
       * second, then a crouch, then a jump. Picking a behaviour and holding it
       * is what gets the controller into its interesting states, and each
       * burst still enters through held+pressed on the same step.
       */
      const BEHAVIOURS = [
        { name: 'idle', hold: [] },
        { name: 'walk', hold: ['KeyW'] },
        { name: 'sprint', hold: ['KeyW', 'ShiftLeft'] },
        { name: 'slide', hold: ['KeyW', 'ShiftLeft'], then: 'ControlLeft', after: 30 },
        { name: 'crouch-walk', hold: ['KeyW', 'ControlLeft'] },
        { name: 'jump-run', hold: ['KeyW', 'ShiftLeft'], repeat: 'Space', every: 20 },
        { name: 'strafe', hold: ['KeyA', 'ShiftLeft'] },
        { name: 'back', hold: ['KeyS'] },
        { name: 'knife-run', hold: ['KeyW'], repeat: 'KeyF', every: 25 },
        { name: 'gadgets', hold: [], repeat: 'Digit1', every: 40 },
      ];

      let burst = null;
      let burstStep = 0;
      let burstLeft = 0;
      const used = new Set();

      for (let step = 0; step < steps; step++) {
        if (burstLeft <= 0) {
          // Drop everything from the last burst, as releasing keys does.
          h.input.clearAll();
          burst = BEHAVIOURS[rng.int(0, BEHAVIOURS.length - 1)];
          used.add(burst.name);
          burstLeft = rng.int(30, 120);
          burstStep = 0;
          // A fresh press is held AND pressed on the same step.
          for (const code of burst.hold) {
            h.input.heldCodes.add(code);
            h.input.pressedCodes.add(code);
          }
          // Look somewhere new, so the run meets different geometry. Mouse look
          // happens per frame rather than per step, so this is the same write
          // the look path makes.
          h.shade.yaw = rng.next() * Math.PI * 2;
        }

        if (burst.then && burstStep === burst.after) {
          h.input.heldCodes.add(burst.then);
          h.input.pressedCodes.add(burst.then);
        }
        if (burst.repeat && burstStep % burst.every === 0) {
          h.input.heldCodes.add(burst.repeat);
          h.input.pressedCodes.add(burst.repeat);
        }

        h.stepFrames(1);
        // The frame loop clears edges after each step; do the same, or a press
        // lasts forever and nothing is ever a genuine edge.
        h.input.clearEdges();
        if (burst.repeat) h.input.heldCodes.delete(burst.repeat);
        seen.add(h.shade.state);
        burstStep++;
        burstLeft--;

        if (step % 30 === 0) {
          checks++;
          const bad = invariants(h, `step ${step} (${burst.name})`);
          if (bad.length) {
            problems.push(...bad.slice(0, 2));
            break;
          }
        }
      }

      h.input.clearAll();
      problems.push(...invariants(h, 'end').slice(0, 2));
      if (h.debugTools.assertionFailures !== 0) {
        problems.push(`${h.debugTools.assertionFailures} runtime assertion failures`);
      }

      // Which states real input actually reaches. Reported rather than
      // asserted: what matters is that nothing broke, and that the number is
      // visible so a change making a state unreachable is noticeable.
      const reached = [...seen].sort().join(' ');

      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${steps} steps of bursty real key input, `
            + `${checks} invariant sweeps across ${used.size} behaviours: no NaN, nothing through the `
            + `floor, one camera throughout, every state valid; reached [${reached}]`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'a-zero-size-viewport-does-not-blind-the-renderer',
    spec: 'Section 15',
    name: 'A resize reporting 0x0 is ignored rather than latched',
    run: (h) => {
      const problems = [];
      const gl = h.renderer.getContext();
      const canvas = h.renderer.domElement;
      const before = { w: canvas.width, h: canvas.height };
      if (before.w <= 0 || before.h <= 0) {
        return { pass: false, detail: `the canvas is already ${before.w}x${before.h}` };
      }

      // Clear the error state before staging anything, so the read at the end
      // is about the resize and not about whatever ran before this check -
      // the A1/A3 lesson, and this check was the shape it warns about.
      //
      // The drain is also where this check's clock goes, and it is not this
      // check's cost (F11). `getError` is the suite's first GL
      // synchronisation, and a synchronisation waits for the software
      // renderer to finish building pipelines the run has queued: 38.8s with
      // only the 60-frame warm-up behind it, 265s with 167 checks behind it,
      // while the whole rest of this check is under 50ms. It is reported
      // rather than asserted on: the number belongs to the run, and the
      // reader of a 265s line needs to know it is a wait, not work.
      // Bounded, because a lost context answers `CONTEXT_LOST_WEBGL` to every
      // call and an unbounded drain would spin on it forever (F1: the machine
      // can take the GPU away mid-suite).
      const drainStarted = performance.now();
      for (let i = 0; i < 64 && gl.getError() !== 0; i++) {
        if (gl.isContextLost()) break;
      }
      const drainMs = Math.round(performance.now() - drainStarted);

      // A viewport reports zero transiently: a minimised window, a tab moved
      // between displays, devtools resizing an emulated frame. Taking it at
      // face value sets a 0x0 drawing buffer and an infinite aspect, and every
      // frame after that is blank until some later resize happens to rescue
      // it. Found for real: an emulated resize left the canvas 0x0 while CSS
      // still read 1280x720, and all eight pixel checks went black at once.
      const original = Object.getOwnPropertyDescriptor(window, 'innerWidth');
      const restore = () => {
        if (original) Object.defineProperty(window, 'innerWidth', original);
        else delete window.innerWidth;
      };
      try {
        Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => 0 });
        window.dispatchEvent(new Event('resize'));
      } finally {
        restore();
      }

      const after = { w: canvas.width, h: canvas.height };
      if (after.w !== before.w || after.h !== before.h) {
        problems.push(`a 0-width resize took the canvas ${before.w}x${before.h} -> ${after.w}x${after.h}`);
      }
      if (gl.drawingBufferWidth <= 1 || gl.drawingBufferHeight <= 1) {
        problems.push(`the drawing buffer collapsed to ${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`);
      }
      if (!Number.isFinite(h.camera.aspect) || h.camera.aspect <= 0) {
        problems.push(`the camera aspect is ${h.camera.aspect}`);
      }

      // And it still draws something afterwards.
      h.renderFrame(1 / 60);
      if (!(h.debugState.drawCalls > 0)) problems.push('nothing drew after the zero resize');
      if (gl.getError() !== 0) problems.push('GL error after the zero resize');

      return {
        pass: problems.length === 0,
        detail: `[${drainMs}ms of this check is the pipeline drain, F11] ` + (problems.length === 0
          ? `a resize reporting a 0 width left the canvas at ${after.w}x${after.h}, the aspect at `
            + `${h.camera.aspect.toFixed(3)} and ${h.debugState.drawCalls} draw calls on the next frame`
          : problems.join('; ')),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'a-lost-gl-context-is-caught-and-the-check-re-run',
    spec: 'Section 15',
    name: 'A check that ran under a lost WebGL context is tagged, and re-run once the context is back',
    // The loss below is staged on purpose. Declared, so the suite counts it
    // as this check's own rather than as the machine taking the GPU away.
    losesContext: true,
    run: async (h) => {
      const problems = [];
      const gl = h.renderer.getContext();
      const canvas = h.renderer.domElement;
      const ext = gl.getExtension('WEBGL_lose_context');
      if (!ext) return { pass: false, detail: 'WEBGL_lose_context is unavailable, so a loss cannot be staged' };
      if (gl.isContextLost()) return { pass: false, detail: 'the context is already lost' };

      // F1: eight pixel checks went red at once on a loaded PC and never
      // reproduced. A lost WebGL context - Chrome killing a starved GPU
      // process and handing the context back a moment later - fails exactly
      // that set: every draw is a no-op and every readPixels reads black, the
      // drawing buffer reports 0x0 against a 1280x720 canvas. Staged here with
      // WEBGL_lose_context, which is the same event Chrome sends, and driven
      // through the real runner: the probe must be tagged, the context must
      // come back, and the probe's second answer must stand.
      const lossesBefore = h.debugState.contextLosses;
      const seen = [];
      const offLost = h.emitter.on('view:contextlost', () => seen.push('lost'));
      const offBack = h.emitter.on('view:contextrestored', () => seen.push('restored'));

      // What every pixel check does: render, read back. A live frame is never
      // all zero - the clear colour alone is 0x0a0d10 - and a lost one always is.
      const frame = new Uint8Array(canvas.width * canvas.height * 4);
      const readsLit = () => {
        h.renderFrame(1 / 60);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, frame);
        return frame.some((v) => v > 0);
      };

      let runs = 0;
      const probe = {
        id: 'probe-under-a-lost-context',
        spec: 'F1',
        run: async () => {
          runs++;
          if (runs === 1) {
            // Lose it, wait for the event, and ask for it back - Chrome does
            // the same restore on its own once the GPU process is up again.
            // The ask has to land in a later task: Chrome only allows a
            // restore once the lost event has finished dispatching, and an
            // await on the event resumes as a microtask, still inside it.
            // A MessageChannel hop is a task without being a timer.
            const lostEvent = new Promise((resolve) => canvas.addEventListener('webglcontextlost', resolve, { once: true }));
            ext.loseContext();
            await lostEvent;
            await new Promise((resolve) => {
              const channel = new MessageChannel();
              channel.port1.onmessage = () => resolve();
              channel.port2.postMessage(0);
            });
            ext.restoreContext();
          }
          const lit = readsLit();
          return { pass: lit, detail: lit ? `read back a lit frame on run ${runs}` : `read back black on run ${runs}` };
        },
      };

      let outcome;
      try {
        outcome = await h.debugTools.suite.runChecks([probe]);
      } finally {
        offLost();
        offBack();
      }
      const result = outcome.results[0];

      if (runs !== 2) problems.push(`the probe ran ${runs} time${runs === 1 ? '' : 's'}, not twice`);
      if (!result.contextLost) problems.push('the probe was not tagged contextLost');
      if (!result.rerun) problems.push('the probe was not marked as re-run');
      if (!result.pass) problems.push(`the re-run did not stand: "${result.detail}"`);
      if (h.debugState.contextLosses !== lossesBefore + 1) {
        problems.push(`debugState.contextLosses went ${lossesBefore} -> ${h.debugState.contextLosses}, expected +1`);
      }
      if (seen.join(',') !== 'lost,restored') problems.push(`the emitter saw [${seen.join(', ')}], expected lost then restored`);
      if (gl.isContextLost() || h.debugState.contextLost) problems.push('the context is still lost afterwards');
      if (!readsLit()) problems.push('the frame after the restore reads black');
      if (gl.getError() !== 0) problems.push('GL error after the restore');

      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `the probe read black under the staged loss, was tagged and re-run after the restore, and read a lit `
            + `frame the second time; the loss was counted once and both events reached the emitter`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-state-machines-survive-each-other',
    spec: 'Section 15',
    name: 'Pause, death, finisher, reinsert and match end driven into one another',
    run: (h) => {
      const problems = [];
      const settle = () => {
        h.input.clearAll();
        h.menu.hide();
        h.setPaused(false);
        if (h.deathCam.active) h.deathCam.restore();
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
        h.menu.hide();
        h.stepFrames(10);
      };

      const kill = () => {
        h.shade.health = 0;
        h.emitter.emit('combat:death', { target: 'shade', kind: 'test' });
      };

      // Each scenario is a collision between two things that each work alone.
      const scenarios = [
        ['pause during the death camera', () => {
          kill();
          h.setPaused(true);
          for (let i = 0; i < 30; i++) h.renderFrame(1 / 60);
          h.menu.hide();
          h.setPaused(false);
          h.stepFrames(60);
        }],

        ['a second death while already dead', () => {
          kill();
          const lives = h.objective.round.lives;
          kill();
          if (h.objective.round.lives !== lives) {
            problems.push('dying twice in one death cost two lives');
          }
          h.stepFrames(30);
        }],

        ['initMatch while on the death camera', () => {
          kill();
          h.stepFrames(30);
          h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
          h.menu.hide();
          if (h.deathCam.active) problems.push('a new match started on the previous death camera');
          if (h.shade.ragdolled) problems.push('a new match started with the body ragdolled');
        }],

        ['initMatch while paused', () => {
          h.setPaused(true);
          h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
          h.menu.hide();
          h.setPaused(false);
          h.stepFrames(30);
          if (h.paused) problems.push('still paused after a new match');
        }],

        ['round ends while awaiting reinsert', () => {
          kill();
          if (!h.objective.round.awaitingReinsert) return;
          h.objective._end('warden', 'test');
          // C4: the round has a tail. The death camera holds the killer
          // until the intermission, `roundEndDelay` after the end, takes
          // it down - and not a step longer.
          h.stepFrames(60);
          if (!h.deathCam.active) problems.push('the death camera dropped before the intermission');
          h.stepFrames(Math.ceil(CONFIG.round.roundEndDelay / CONFIG.time.fixedDt) + 2 - 60);
          if (h.deathCam.active) problems.push('the death camera outlived the round');
        }],

        ['a finisher interrupted by a match reset', () => {
          // Stand the Warden in front of the Shade, facing away, and knife it.
          const site = h.map.sites[0];
          h.shade.reset({ position: site.position, yaw: 0 });
          h.stepFrames(5);
          h.warden.reset({
            position: {
              x: h.shade.position.x - Math.sin(h.shade.yaw) * 1.0,
              y: h.shade.feetY,
              z: h.shade.position.z - Math.cos(h.shade.yaw) * 1.0,
            },
            yaw: h.shade.yaw,
          });
          h.stepFrames(2);
          h.combat.knifeTimer = 0;
          h.combat._swingKnife(h.shade, h.warden);
          const started = h.combat.inFinisher;
          h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
          h.menu.hide();
          h.stepFrames(30);
          if (!started) problems.push('the rear knife did not start a finisher, so this tested nothing');
          if (h.combat.inFinisher) problems.push('the finisher survived a match reset');
          if (Math.abs(h.clock.timeScale - 1) > 1e-9) {
            problems.push(`time scale left at ${h.clock.timeScale} after a reset mid-finisher`);
          }
        }],

        ['plant completing as the round timer expires', () => {
          h.objective.resetRound(1);
          const site = h.map.sites[0];
          h.shade.reset({ position: site.position, yaw: 0 });
          h.objective.round.timeRemaining = CONFIG.time.fixedDt * 2;
          h.objective.round.plantProgress = CONFIG.round.plantHoldTime - CONFIG.time.fixedDt;
          for (let i = 0; i < 10; i++) {
            h.objective.step(CONFIG.time.fixedDt, {
              shade: h.shade, warden: h.warden, intent: { interact: true },
            });
          }
          if (h.objective.round.state === ROUND.ACTIVE && h.objective.round.charge === 'carried') {
            problems.push('the round neither ended nor planted when the timer met the plant');
          }
        }],

        ['scoring past the end of the match', () => {
          h.objective.resetMatch();
          const target = h.objective.target;
          for (let i = 0; i < target; i++) {
            h.objective.resetRound(i + 1);
            h.objective._end('warden', 'test');
          }
          if (!h.objective.matchOver) problems.push('reaching the target did not end the match');
          h.objective.resetRound(target + 1);
          h.objective._end('warden', 'test again');
          if (h.objective.score.warden > target) {
            problems.push(`scoring past match end took the score to ${h.objective.score.warden}, target ${target}`);
          }
          h.objective.resetMatch();
        }],
      ];

      for (const [name, scenario] of scenarios) {
        settle();
        try {
          scenario();
        } catch (error) {
          problems.push(`${name}: threw ${error && error.message}`);
          continue;
        }
        problems.push(...invariants(h, name));
      }

      settle();
      if (h.debugTools.assertionFailures !== 0) {
        problems.push(`${h.debugTools.assertionFailures} runtime assertion failures`);
      }
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${scenarios.length} collisions between the round, match, cinematic and pause state machines: `
            + 'every one left one camera, a valid state, time scale 1 and control with the player'
          : problems.join('; '),
      };
    },
  });
}
