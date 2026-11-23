/**
 * BLACKLINE - tests/sprintfov.js
 *
 * AUTO suite (J9, D90): the sprint's FOV kick, read off the one camera.
 *
 * Josh's answer (2026-11-22) was "about 4 degrees, eased over a quarter
 * second", and a number he chose is a number a later tune can quietly move: a
 * `sprintFovKick` of 15 is a lurch and a `sprintFovEase` of 0 is a snap, and
 * both are one edit in `config.js` that no other check would notice. So the
 * check holds the config to his words (3..5 degrees) and then holds the
 * *camera* to the config, which is the reading that matters - a constant
 * nobody applies is the failure `tests/settings.js` opens with.
 *
 * Every clause drives a sprint the way a player does, `KeyW` and `ShiftLeft`
 * in `input.heldCodes` down a clear lane, through `renderFrame` - the only
 * path that asks `cameraOwner.applyFov`, since `stepFrames` runs the
 * simulation and nothing else. The FOV is read from `camera.fov`, the field
 * H9 asserts every frame, and from the projection matrix once, so the kick is
 * proved drawn and not only asked for.
 *
 * The ease is measured from the frame the body is first a sprint to the
 * camera (`movementBand === 'sprint'`, which is what the kick keys on) and
 * not from the key going down: the body is still gathering speed for the
 * first tenth of a second and that is the controller's, not the lens's.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG, SETTINGS } from '../config.js';
import { clearLane } from './lanes.js';

const R = CONFIG.render;
const W = CONFIG.warden;
/** Metres of clear floor a sprint, its settle and its release want. */
const LANE = 20;

/** A match with the human on the Shade, nothing else running. */
function asShade(h) {
  return h.initMatch({ mode: 'competitive', role: 'shade', ai: false, objective: false });
}

/** Free roam with the human on the Warden (Section 12). */
function asWarden(h) {
  return h.initMatch({ mode: 'freeroam', role: 'warden', ai: false, objective: false });
}

/** What the player has set for this role, which the lens rests at with no sprint in it. */
const restOf = (role) => (role === 'warden' ? SETTINGS.fovWarden : SETTINGS.fovShade);

/** The vertical field of view the renderer draws with, from the projection matrix. */
function drawnFov(h) {
  return (2 * Math.atan(1 / h.camera.projectionMatrix.elements[5]) * 180) / Math.PI;
}

/** The body, standing still on the lane's first metre with nothing held, the camera on it. */
function stand(h, role, lane) {
  const actor = role === 'warden' ? h.warden : h.shade;
  if (role === 'warden') asWarden(h); else asShade(h);
  h.setCameraOwner(role);
  actor.reset({ position: { x: lane.x, y: lane.y, z: lane.z }, yaw: lane.yaw });
  actor.pitch = 0;
  h.input.clearAll();
  h.input.locked = false;
  // Let the reset settle into the floor and the lens settle at rest, so the
  // sprint starts from a camera that has nothing in it.
  for (let i = 0; i < 30; i++) h.renderFrame(1 / 60);
  return actor;
}

/**
 * Hold a sprint for `seconds` of wall time at frame length `dt`, then let go
 * for `after` more, and report every frame.
 *
 * @returns {Array<{t: number, fov: number, band: string, ads: boolean}>} `t` is
 *   wall seconds from the key going down
 */
function sprintFor(h, actor, dt, seconds, after) {
  const trace = [];
  const frames = (s) => Math.round(s / dt);
  let t = 0;
  h.input.heldCodes.add('KeyW');
  h.input.heldCodes.add('ShiftLeft');
  for (let i = 0; i < frames(seconds); i++) {
    h.renderFrame(dt);
    t += dt;
    trace.push({ t, fov: h.camera.fov, band: actor.movementBand });
  }
  h.input.clearAll();
  for (let i = 0; i < frames(after); i++) {
    h.renderFrame(dt);
    t += dt;
    trace.push({ t, fov: h.camera.fov, band: actor.movementBand });
  }
  return trace;
}

/** The first frame at which the camera's body is a sprint, or -1. */
const onsetOf = (trace) => trace.findIndex((f) => f.band === 'sprint');

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-sprint-kick-widens-the-lens-by-four-degrees-and-gives-it-back',
    spec: 'D90, Section 6.2, H9',
    name: 'A sprint widens the lens by about four degrees over a quarter second and gives them back exactly, on the wall clock, not on the Warden aim, not across a handover, and only under its setting',
    run: (h) => {
      const problems = [];
      const seen = [];
      const was = {
        kick: SETTINGS.sprintFovKick, shade: SETTINGS.fovShade, warden: SETTINGS.fovWarden,
        locked: h.input.locked,
      };
      const lane = clearLane(h, LANE);
      if (!lane) return { pass: false, detail: `no clear ${LANE}m lane on this map` };
      try {
        // ----------------------------------------------------------------
        // (b) Josh's words. A setting that is not a number he gave is a tune
        // nobody asked for, and the lens reading below is only as honest as
        // the number it is held to.
        // ----------------------------------------------------------------
        if (!(R.sprintFovKick >= 3 && R.sprintFovKick <= 5)) {
          problems.push(`the kick is ${R.sprintFovKick} degrees and D90 is "about 4": 3..5`);
        }
        if (!(R.sprintFovEase >= 0.2 && R.sprintFovEase <= 0.3)) {
          problems.push(`the ease is ${R.sprintFovEase}s and D90 is "a quarter second": 0.2..0.3`);
        }
        if (CONFIG.settings.defaults.sprintFovKick !== true) {
          problems.push('the kick is not on by default; it is the feel D90 asked for');
        }

        // Distinct from the engine's 70 and from each other, so a kick that
        // came off the wrong role's rest, or off `CONFIG.render.fov`, is read.
        SETTINGS.fovShade = 80;
        SETTINGS.fovWarden = 90;
        SETTINGS.sprintFovKick = true;

        // ----------------------------------------------------------------
        // (a) the FOV over a sprint, then (d) the release.
        // ----------------------------------------------------------------
        const dt = 1 / 60;
        const shade = stand(h, 'shade', lane);
        const rest = restOf('shade');
        if (h.camera.fov !== rest) problems.push(`at rest the Shade's lens is ${h.camera.fov}, want exactly ${rest}`);
        const trace = sprintFor(h, shade, dt, 1.0, 1.2);
        const on = onsetOf(trace);
        if (on < 0) {
          problems.push(`the body never reached a sprint (top band ${trace[trace.length - 1].band}); nothing was measured`);
          return { pass: false, detail: problems.join('; ') };
        }
        const sprinting = trace.filter((f) => f.band === 'sprint');
        const peak = Math.max(...trace.map((f) => f.fov)) - rest;
        const last = sprinting[sprinting.length - 1];
        const settled = last.fov - rest;
        if (trace.slice(0, on).some((f) => f.fov !== rest)) {
          problems.push('the lens moved before the body was a sprint');
        }
        if (!(trace[on + 2].fov > rest)) problems.push('holding the sprint did not widen the lens');
        if (Math.abs(settled - R.sprintFovKick) > 0.1) {
          problems.push(`the sprint settled ${settled.toFixed(3)} degrees over rest, want ${R.sprintFovKick} within 0.1`);
        }
        // (b) again, measured: the lens went as far as the config says and no
        // further, so a later tune that made the number 15 is read here too.
        if (Math.abs(peak - R.sprintFovKick) > 0.1) {
          problems.push(`the lens peaked ${peak.toFixed(3)} degrees over rest, want ${R.sprintFovKick} within 0.1 (D90: about 4)`);
        }
        if (Math.abs(drawnFov(h) - h.camera.fov) > 1e-9) {
          problems.push(`the projection draws ${drawnFov(h).toFixed(3)} and the camera asks ${h.camera.fov.toFixed(3)}; the kick was not applied to the matrix`);
        }
        seen.push(`+${settled.toFixed(2)} settled, peak +${peak.toFixed(2)} over ${rest}`);

        // (c) A quarter second, eased. Half way through the ease the lens is
        // some of the way and not all of it; by the end it has arrived. A snap
        // is all of it on the first frame and fails the first half.
        const since = (f) => f.t - trace[on].t + dt; // seconds into the kick, this frame inclusive
        const half = trace.slice(on).find((f) => since(f) >= R.sprintFovEase / 2 - 1e-9);
        const whole = trace.slice(on).find((f) => since(f) >= R.sprintFovEase - 1e-9);
        const first = trace[on];
        const share = (f) => (f.fov - rest) / R.sprintFovKick;
        if (!(share(half) > 0.1 && share(half) < 0.9)) {
          problems.push(`half way through the ease the lens had come ${(share(half) * 100).toFixed(0)}% of the kick, want 10..90% - it is a snap or a stall, not an ease`);
        }
        if (!(share(whole) > 0.9)) {
          problems.push(`by the end of the ease (${R.sprintFovEase}s) the lens had come only ${(share(whole) * 100).toFixed(0)}% of the kick`);
        }
        if (!(share(first) < 0.5)) {
          problems.push(`the first frame of the sprint took ${(share(first) * 100).toFixed(0)}% of the kick at once`);
        }
        seen.push(`${(share(half) * 100).toFixed(0)}% at half the ease, ${(share(whole) * 100).toFixed(0)}% at the end`);

        // (d) Back to exactly `restFov`, within the ease of the body ceasing
        // to be a sprint, and bit for bit: `applyFov`'s own guard and the
        // checks written against it read that constant, so "nearly" is a
        // regression, not a tolerance.
        const off = trace.findIndex((f, i) => i > on && f.band !== 'sprint');
        if (off < 0) {
          problems.push('the body never stopped being a sprint after the release; the give-back was not measured');
        } else {
          const arrived = trace.findIndex((f, i) => i >= off && f.fov === rest);
          if (arrived < 0) {
            problems.push(`the lens never came back to exactly ${rest}; it ended at ${trace[trace.length - 1].fov}`);
          } else {
            const took = trace[arrived].t - trace[off].t;
            if (took > R.sprintFovEase + 2 * dt) {
              problems.push(`the lens took ${took.toFixed(3)}s to give the kick back after the sprint ended, want ${R.sprintFovEase}s`);
            }
            if (trace.slice(arrived).some((f) => f.fov !== rest)) problems.push('the lens left rest again after it had come back');
            seen.push(`back to exactly ${rest} ${took.toFixed(2)}s after the body stopped sprinting`);
          }
        }

        // ----------------------------------------------------------------
        // (e) Wall clock, not frames. The same sprint at 60 and at 30 frames
        // a second: the lens is at the same place at the same wall time. A
        // kick that stepped per frame would be a quarter of a second late at
        // 30, which at this moment of the ease is two degrees.
        // ----------------------------------------------------------------
        const at = 0.25;
        const fast = (stand(h, 'shade', lane), sprintFor(h, h.shade, 1 / 60, 0.4, 0));
        const slow = (stand(h, 'shade', lane), sprintFor(h, h.shade, 1 / 30, 0.4, 0));
        const pick = (tr, step) => tr[Math.round(at / step) - 1].fov;
        const gap = Math.abs(pick(fast, 1 / 60) - pick(slow, 1 / 30));
        // One 30Hz frame of the steepest part of the ease: 1.5 * kick / ease
        // degrees a second for 1/30s, which is the most two correct frame
        // lengths can disagree by at an instant that falls between samples.
        const allowed = (1.5 * R.sprintFovKick / R.sprintFovEase) / 30 + 1e-6;
        if (!(pick(fast, 1 / 60) > rest + 0.2)) problems.push('the wall-clock comparison read a lens that had not moved');
        if (gap > allowed) {
          problems.push(`at ${at}s of wall time the lens read ${pick(fast, 1 / 60).toFixed(3)} at 60Hz and ${pick(slow, 1 / 30).toFixed(3)} at 30Hz; ${gap.toFixed(3)} apart, allowed ${allowed.toFixed(3)} - it is counting frames`);
        }
        seen.push(`60Hz and 30Hz agree to ${gap.toFixed(2)} degrees at ${at}s`);

        // ----------------------------------------------------------------
        // (h) Under the setting: off, the lens is exactly rest the whole way.
        // ----------------------------------------------------------------
        SETTINGS.sprintFovKick = false;
        stand(h, 'shade', lane);
        const off4 = sprintFor(h, h.shade, dt, 1.0, 0.5);
        if (onsetOf(off4) < 0) problems.push('with the kick off the body never sprinted; nothing was measured');
        const strayed = off4.find((f) => f.fov !== rest);
        if (strayed) problems.push(`with the setting off the lens read ${strayed.fov} at ${strayed.t.toFixed(2)}s, want exactly ${rest} the whole sprint`);
        SETTINGS.sprintFovKick = true;
        seen.push('exactly rest the whole way with the setting off');

        // ----------------------------------------------------------------
        // (f) The handover carries nothing. Mid-kick, the next owner gets its
        // own resting field and not a sliver of the last one's.
        // ----------------------------------------------------------------
        stand(h, 'shade', lane);
        sprintFor(h, h.shade, dt, 0.6, 0);
        if (!(h.camera.fov > rest + 1)) problems.push('the handover was not read mid-kick; the lens was not wide');
        h.setCameraOwner('warden');
        if (h.camera.fov !== restOf('warden')) {
          problems.push(`the handover to the Warden mid-kick left ${h.camera.fov}, want exactly ${restOf('warden')}`);
        }
        h.input.clearAll();
        seen.push('a handover mid-kick leaves the next rig at exactly its own rest');

        // ----------------------------------------------------------------
        // The Warden sprints too: his kick rides his own setting, and (g) his
        // aim wins over it.
        // ----------------------------------------------------------------
        const warden = stand(h, 'warden', lane);
        const wrest = restOf('warden');
        const wtrace = sprintFor(h, warden, dt, 0.8, 0);
        const wsettled = h.camera.fov - wrest;
        if (Math.abs(wsettled - R.sprintFovKick) > 0.1) {
          problems.push(`the Warden's sprint settled ${wsettled.toFixed(3)} over his rest of ${wrest}, want ${R.sprintFovKick}`);
        }
        if (wtrace.length === 0) problems.push('the Warden never ran');
        // Still sprinting, lens wide: now take the aim. It narrows from his
        // own rest to the sight picture, and no kick rides on top of it.
        h.input.heldCodes.add('KeyW');
        h.input.heldCodes.add('ShiftLeft');
        h.input.heldCodes.add('Mouse2');
        let over = 0;
        for (let i = 0; i < 40; i++) {
          h.renderFrame(dt);
          const bound = h.warden.desiredFov() + R.sprintFovKick * (1 - h.warden.adsBlend);
          over = Math.max(over, h.camera.fov - bound);
        }
        // 0.02: `applyFov` leaves the lens alone inside 0.01 of what it wants,
        // so a blend caught between frames reads that far stale.
        if (over > 0.02) problems.push(`aiming while sprinting the lens ran ${over.toFixed(3)} degrees past the aim's own field`);
        if (Math.abs(h.warden.adsBlend - 1) > 0.01) problems.push(`the aim only reached blend ${h.warden.adsBlend.toFixed(3)}`);
        // 0.05 is `each-role-draws-with-the-field-of-view-its-setting-asks-for`'s
        // own: the blend closes on 1 and a kick left on top would be four.
        if (Math.abs(h.camera.fov - W.camera.adsFov) > 0.05) {
          problems.push(`fully aimed from a sprint the lens read ${h.camera.fov.toFixed(4)}, want the sight picture ${W.camera.adsFov} with no kick on it`);
        }
        seen.push(`the Warden's aim from a sprint settles at the sight picture ${W.camera.adsFov}`);
      } finally {
        SETTINGS.sprintFovKick = was.kick;
        SETTINGS.fovShade = was.shade;
        SETTINGS.fovWarden = was.warden;
        h.input.clearAll();
        h.input.locked = was.locked;
        h.warden.adsBlend = 0;
        asShade(h);
        h.renderFrame(1 / 60);
      }
      return {
        pass: problems.length === 0,
        detail: problems.length === 0 ? `down ${lane.from}: ${seen.join('; ')}` : problems.join('; '),
      };
    },
  });
}
