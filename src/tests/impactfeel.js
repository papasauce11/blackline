/**
 * BLACKLINE - tests/impactfeel.js
 *
 * AUTO suite (J2, D89 - "subtle"): the picture holds for a beat on a blow and
 * the camera shivers on a blast, and **neither costs the simulation a step**.
 *
 * The property that matters is the first, and it is about the fixed step, not
 * about what is drawn: a hit-stop that ate simulation time would make the
 * picture lie about the world, so `systems/impact.js` withholds the frame's wall
 * time while the stop runs and hands it back on the frames after. This check
 * drives the same frames twice - once with a knife hit landing on frame 3 and
 * once without - and counts the fixed steps each frame ran, which is the
 * done-when read as a number. Every frame is the loop's own (`h.renderFrame`,
 * the function the rAF calls), so `main.js`'s wiring of the planner's feed is
 * held too and not only the module.
 *
 * The pause is driven through Escape, the way a player does it. A pause is
 * the other path that feeds the planner nothing, and the clause for it holds
 * that a stop interrupted by one is frozen where it stood - not ticking on the
 * wall clock behind the menu and not banking the seconds the menu was open -
 * and still costs the simulation nothing once the menu is gone.
 *
 * The shake is read off the one camera's own local transform, which is where
 * `impact.js` writes it and which nothing else writes under the Shade's or the
 * Warden's rig (`cameraowner.set` zeroes it). The camera's place in the world
 * comes from its matrix, so a blast can be put a stated distance from it.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import * as THREE from 'three';
import { CONFIG, SETTINGS } from '../config.js';

const I = CONFIG.impact;
const T = CONFIG.time;

/** A frame a little longer than a step, so a stop has frames to run behind and the baseline is not on a boundary. */
const SIXTEEN_MS = 0.016;
const FOUR_MS = 0.004;
const BLOW_FRAME = 3;

/** A quiet match with the AI and the round off, an empty planner and no stop or shake pending. */
function fresh(h) {
  h.input.clearAll();
  h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
  h.menu.hide();
  h.setPaused(false);
  h.stepFrames(10);
  // A pause drains the accumulator, which is the one way a check can start a
  // run from exactly nothing banked.
  h.setPaused(true);
  h.menu.hide();
  h.setPaused(false);
  h.impact.reset();
}

const knife = (h) => h.emitter.emit('combat:knife-hit', { kind: 'arc', remaining: 50 });

/**
 * `frames` frames of `delta` seconds, the fixed steps each one ran, and where
 * the stop was. `blowAt` lands a knife hit before that frame; `pauseAt` makes
 * that frame the Escape that opens the pause menu, holds five frames of a full
 * second behind it, and resumes with a second Escape.
 */
function run(h, { delta, frames, blowAt = -1, pauseAt = -1 }) {
  fresh(h);
  const steps = [];
  let spanned = 0;
  const pause = { steps: 0, before: null, after: null };
  for (let i = 0; i < frames; i++) {
    if (i === blowAt) knife(h);
    if (h.impact.active) spanned++;
    if (i === pauseAt) {
      h.input.pressedCodes.add('Escape');
      h.renderFrame(delta);
      steps.push(h.debugState.stepsPerFrame);
      pause.before = { active: h.impact.active, debt: h.impact.debt, paused: h.paused };
      for (let k = 0; k < 5; k++) {
        h.renderFrame(1.0);
        pause.steps += h.debugState.stepsPerFrame;
      }
      pause.after = { active: h.impact.active, debt: h.impact.debt };
      h.input.pressedCodes.add('Escape');
      continue;
    }
    h.renderFrame(delta);
    steps.push(h.debugState.stepsPerFrame);
  }
  return { steps, total: steps.reduce((a, b) => a + b, 0), spanned, pause };
}

/** The camera's place in the world, off its matrix. */
function eyeOf(h) {
  return new THREE.Vector3().setFromMatrixPosition(h.camera.matrixWorld);
}

/**
 * The largest single-axis offset of the camera's local position, and of its
 * roll, across a shake that began with a frag `distance` metres from the eye.
 * Per axis and not the vector's length: the three phases are drawn, so the
 * length wanders where the amplitude of each axis does not.
 */
function peakAt(h, distance, type = 'frag') {
  fresh(h);
  h.renderFrame(FOUR_MS);
  const eye = eyeOf(h);
  h.emitter.emit('gadget:detonate', { type, at: { x: eye.x + distance, y: eye.y, z: eye.z } });
  let metres = 0;
  let roll = 0;
  for (let i = 0; i < 80; i++) {
    h.renderFrame(FOUR_MS);
    const p = h.camera.position;
    metres = Math.max(metres, Math.abs(p.x), Math.abs(p.y), Math.abs(p.z));
    roll = Math.max(roll, Math.abs(h.camera.rotation.z));
  }
  return { metres, roll, endX: h.camera.position.x, endY: h.camera.position.y, endZ: h.camera.position.z, endRoll: h.camera.rotation.z };
}

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-hit-stops-the-picture-without-costing-the-simulation-a-step',
    spec: 'J2, D89',
    name: 'A knife hit holds the picture for a beat of wall clock and the fixed step count is unchanged; a blast shakes the camera by its distance; both sit under a setting and leave nothing behind',
    run: (h) => {
      const problems = [];
      const was = { hitStop: SETTINGS.hitStop, screenShake: SETTINGS.screenShake };
      let detail = '';
      try {
        SETTINGS.hitStop = true;
        SETTINGS.screenShake = true;

        // (a) The step count is unchanged - the done-when.
        const baseline = run(h, { delta: SIXTEEN_MS, frames: 60 });
        const stopped = run(h, { delta: SIXTEEN_MS, frames: 60, blowAt: BLOW_FRAME });
        if (stopped.total !== baseline.total) {
          problems.push(`a hit-stop changed the fixed step count: ${stopped.total} steps over 60 frames against ${baseline.total} without it`);
        }
        const fine = run(h, { delta: FOUR_MS, frames: 200 });
        const fineStopped = run(h, { delta: FOUR_MS, frames: 200, blowAt: BLOW_FRAME });
        if (fineStopped.total !== fine.total) {
          problems.push(`at a 4ms frame a hit-stop changed the fixed step count: ${fineStopped.total} against ${fine.total}`);
        }

        // (b) The picture really stops: a frame the baseline ran steps on ran none.
        const frozen = stopped.steps.filter((n, i) => n === 0 && baseline.steps[i] >= 1).length;
        if (frozen < 1) problems.push('no frame inside the stop ran zero steps where the same frame ran one without it');

        // (c) Wall clock and not frames.
        if (!(fineStopped.spanned > stopped.spanned)) {
          problems.push(`the stop spans ${fineStopped.spanned} frames at 4ms and ${stopped.spanned} at 16ms; it is meant to be the same wall time, so more of the short ones`);
        }
        for (const [label, r, delta] of [['16ms', stopped, SIXTEEN_MS], ['4ms', fineStopped, FOUR_MS]]) {
          const wall = r.spanned * delta;
          if (Math.abs(wall - I.hitStopSeconds) > delta + 1e-9) {
            problems.push(`at ${label} frames the stop held ${wall.toFixed(3)}s of wall clock, not ${I.hitStopSeconds}s within a frame`);
          }
        }

        // (d) Subtle, which is Josh's answer to D89.
        if (I.hitStopSeconds > 0.06) problems.push(`hitStopSeconds is ${I.hitStopSeconds}; D89 answered subtle, which is at most 0.06`);
        if (I.shakeMetres > 0.02) problems.push(`shakeMetres is ${I.shakeMetres}; D89 answered subtle, which is at most 0.02`);
        if (I.shakeRollDegrees > 1) problems.push(`shakeRollDegrees is ${I.shakeRollDegrees}; D89 answered subtle, which is at most 1`);

        // (e) The shake falls off with distance.
        const mid = (I.shakeNearMetres + I.shakeFarMetres) / 2;
        const near = peakAt(h, I.shakeNearMetres);
        const half = peakAt(h, mid);
        const far = peakAt(h, I.shakeFarMetres);
        const beyond = peakAt(h, I.shakeFarMetres + 10);
        const smoke = peakAt(h, I.shakeNearMetres, 'smoke');
        if (!(near.metres > 0)) problems.push('a frag at the near distance did not move the camera');
        if (!(near.metres > half.metres)) problems.push(`a frag at ${I.shakeNearMetres}m peaked ${near.metres.toFixed(5)}m and one at ${mid}m ${half.metres.toFixed(5)}m; the closer must shake harder`);
        if (!(half.metres > 0)) problems.push(`a frag at ${mid}m, inside the far distance, did not move the camera`);
        if (far.metres !== 0 || far.roll !== 0) problems.push(`a frag at the far distance moved the camera ${far.metres}m, ${far.roll}rad`);
        if (beyond.metres !== 0 || beyond.roll !== 0) problems.push(`a frag beyond the far distance moved the camera ${beyond.metres}m`);
        if (smoke.metres !== 0) problems.push(`a smoke grenade at ${I.shakeNearMetres}m moved the camera ${smoke.metres}m; only a frag shakes`);
        if (near.metres > I.shakeMetres + 1e-9 || near.roll > I.shakeRollDegrees * (Math.PI / 180) + 1e-9) {
          problems.push(`the shake peaked ${near.metres}m and ${near.roll}rad, past its configured ${I.shakeMetres}m and ${I.shakeRollDegrees} degrees`);
        }

        // (f) Both under a setting.
        SETTINGS.hitStop = false;
        const off = run(h, { delta: SIXTEEN_MS, frames: 60, blowAt: BLOW_FRAME });
        if (!same(off.steps, baseline.steps)) problems.push('with hitStop off the per-frame step counts differ from the run with no blow');
        if (off.spanned !== 0) problems.push(`with hitStop off the stop still ran for ${off.spanned} frames`);
        SETTINGS.hitStop = true;
        SETTINGS.screenShake = false;
        const quiet = peakAt(h, I.shakeNearMetres);
        if (quiet.metres !== 0 || quiet.roll !== 0) problems.push(`with screenShake off the camera still moved ${quiet.metres}m, ${quiet.roll}rad`);
        SETTINGS.screenShake = true;

        // (g) Nothing left behind: the shake ends on exactly zero.
        if (near.endX !== 0 || near.endY !== 0 || near.endZ !== 0 || near.endRoll !== 0) {
          problems.push(`a shake that ran its course left the camera at (${near.endX}, ${near.endY}, ${near.endZ}) rolled ${near.endRoll}`);
        }
        // ... and a frame that goes cinematic mid-shake adds NOTHING to the
        // transform the cinematic sets. Not "reads zero": the finisher owns the
        // camera's local transform then and sets it to an orbit that is not the
        // origin, so a clause demanding zero would pass only while the shake was
        // wiping the pose the finisher had just taken. The honest reading is the
        // same cinematic frame run twice, once shaken and once not, bit-identical.
        const cineFrame = (shaken) => {
          fresh(h);
          h.renderFrame(FOUR_MS);
          if (shaken) {
            const at = eyeOf(h);
            h.emitter.emit('gadget:detonate', { type: 'frag', at: { x: at.x + 1, y: at.y, z: at.z } });
            for (let i = 0; i < 6; i++) h.renderFrame(FOUR_MS);
          }
          const moved = h.camera.position.x !== 0 || h.camera.position.y !== 0;
          h.combat._beginFinisher(h.shade, h.warden);
          h.renderFrame(FOUR_MS);
          const p = h.camera.position;
          const got = { x: p.x, y: p.y, z: p.z, roll: h.camera.rotation.z, moved };
          h.combat.finisher.wallStart -= CONFIG.finisher.wallClockTimeout + 0.5;
          h.combat.step(T.fixedDt, { shade: h.shade, warden: h.warden, shadeIntent: null, wardenIntent: null });
          return got;
        };
        const cineShaken = cineFrame(true);
        const cineClean = cineFrame(false);
        if (!cineShaken.moved) problems.push('the shake was not on the camera when the cinematic began, so the clause below proves nothing');
        if (cineShaken.x !== cineClean.x || cineShaken.y !== cineClean.y
          || cineShaken.z !== cineClean.z || cineShaken.roll !== cineClean.roll) {
          problems.push(`a cinematic frame mid-shake put the camera at (${cineShaken.x}, ${cineShaken.y}, ${cineShaken.z}) rolled ${cineShaken.roll}, where the same frame with no shake put it at (${cineClean.x}, ${cineClean.y}, ${cineClean.z}) rolled ${cineClean.roll}; the cinematic owns that transform and the shake must add nothing to it`);
        }

        // (h) A pause in the middle of a stop freezes it: nothing ticks, nothing
        // banks, and the simulation still loses no step.
        const pausedBase = run(h, { delta: SIXTEEN_MS, frames: 60, pauseAt: 5 });
        const pausedStop = run(h, { delta: SIXTEEN_MS, frames: 60, blowAt: BLOW_FRAME, pauseAt: 5 });
        const { before, after } = pausedStop.pause;
        if (!before || !before.paused) problems.push('Escape did not pause the match mid-stop');
        else {
          if (!before.active) problems.push('the stop was already over when the pause opened, so the clause proves nothing');
          if (pausedStop.pause.steps !== 0) problems.push(`${pausedStop.pause.steps} fixed steps ran behind the pause menu`);
          if (after.active !== before.active || after.debt !== before.debt) {
            problems.push(`five paused seconds moved the stop: active ${before.active} -> ${after.active}, debt ${before.debt} -> ${after.debt}`);
          }
        }
        if (pausedStop.total !== pausedBase.total) {
          problems.push(`a pause mid-stop changed the fixed step count: ${pausedStop.total} against ${pausedBase.total} with the same pause and no blow`);
        }
        if (h.impact.debt !== 0 || h.impact.active) problems.push('the stop or its debt outlived the run');

        detail = `${baseline.total} steps with and without a stop at 16ms and ${fine.total} at 4ms; the stop held ${stopped.spanned} frames at 16ms and ${fineStopped.spanned} at 4ms with ${frozen} frame(s) frozen that would have stepped; `
          + `shake peaks ${near.metres.toFixed(5)}m near, ${half.metres.toFixed(5)}m at ${mid}m, 0 at ${I.shakeFarMetres}m; a pause mid-stop kept ${pausedStop.total} of ${pausedBase.total} steps`;
      } finally {
        SETTINGS.hitStop = was.hitStop;
        SETTINGS.screenShake = was.screenShake;
        h.input.clearAll();
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
        h.menu.hide();
        h.setPaused(false);
      }
      return { pass: problems.length === 0, detail: problems.length === 0 ? detail : problems.join('; ') };
    },
  });
}
