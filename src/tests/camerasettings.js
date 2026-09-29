/**
 * BLACKLINE - tests/camerasettings.js
 *
 * AUTO suite (Section 13, H9): look and camera settings, read off the one
 * camera.
 *
 * Every check here ends at `h.camera` - its world rotation for the look, its
 * **projection matrix** for the field of view, its world height for the bob -
 * because a setting that changes a field on `SETTINGS` and a label on a row is
 * indistinguishable from one that works. That is the lesson `tests/settings.js`
 * opens with, and the reason the Section 13 difficulty and match length
 * controls moved a label and nothing else for thirty phases.
 *
 * The FOV is read from `projectionMatrix.elements[5]`, which is
 * `1 / tan(fovY / 2)`, rather than from `camera.fov`: the field is what was
 * asked for and the matrix is what the renderer draws with, and a missing
 * `updateProjectionMatrix()` is exactly the gap between them.
 *
 * The head-bob is measured as the **difference between two identical walks**,
 * one with it off and one with it on. That cancels the ground under the feet,
 * the landing dip and the boom's pullback, which is what makes the reading the
 * bob and nothing else - and the same pair proves the bob is presentation only,
 * since a body that moved differently between the two runs would mean the
 * camera had leaked into the simulation.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import * as THREE from 'three';
import { CONFIG, SETTINGS } from '../config.js';
import { SHADE_STATE } from '../entities/agentstate.js';
import { WARDEN_STATE } from '../entities/enforcer.js';
import { clearLane } from './lanes.js';

const S = CONFIG.shade;
const W = CONFIG.warden;
const DT = CONFIG.time.fixedDt;
/** Scratch, so a per-frame reading allocates nothing (E3's habit). */
const SCRATCH = new THREE.Vector3();
/** Metres of clear floor the bob's walk needs: a 2.5s sprint and a little over. */
const LANE = 20;

/** A match with the human on the Shade, nothing else running. */
function asShade(h) {
  return h.initMatch({ mode: 'competitive', role: 'shade', ai: false, objective: false });
}

/** Free roam with the human on the Warden (Section 12): the first-person eye. */
function asWarden(h) {
  return h.initMatch({ mode: 'freeroam', role: 'warden', ai: false, objective: false });
}

/**
 * One simulation step and the visual update that follows it, as the loop does
 * and without drawing - `animation.js`'s `frame`, for the same reason: a
 * hundred frames of `renderFrame` under software WebGL is a hundred frames of
 * pipeline the run pays for, and nothing here needs a pixel.
 */
function frame(h) {
  h.stepFrames(1);
  h.input.clearEdges();
  h.shade.updateVisual(DT);
  h.warden.updateVisual(DT);
}

/**
 * Where the one camera is actually looking, off its own world matrix. The
 * camera sits at the rig's origin with no local rotation, so this is the rig's
 * aim - but it is read from the camera, which is the thing a player sees
 * through.
 *
 * @returns {{yaw: number, pitch: number}} radians
 */
function cameraAim(h) {
  h.camera.getWorldDirection(SCRATCH);
  return {
    yaw: Math.atan2(-SCRATCH.x, -SCRATCH.z),
    pitch: Math.asin(Math.max(-1, Math.min(1, SCRATCH.y))),
  };
}

/**
 * The vertical field of view the renderer is drawing with, in degrees, taken
 * from the projection matrix rather than from the field that asked for it.
 */
function drawnFov(h) {
  return (2 * Math.atan(1 / h.camera.projectionMatrix.elements[5]) * 180) / Math.PI;
}

/**
 * One rendered frame with a mouse movement in it, the way a player's arrives: a
 * delta on the locked input, consumed by `cameraOwner.look()` at the top of the
 * frame and zeroed by `endFrame()` at the bottom. A frame with no delta comes
 * first, so the aim the caller set is on the rig before it is read.
 *
 * @returns {{yaw: number, pitch: number}} how far the camera turned, radians
 */
function mouseMove(h, dx, dy) {
  h.input.locked = true;
  h.input.mouse.dx = 0;
  h.input.mouse.dy = 0;
  h.renderFrame(1 / 60);
  const before = cameraAim(h);
  h.input.mouse.dx = dx;
  h.input.mouse.dy = dy;
  h.renderFrame(1 / 60);
  const after = cameraAim(h);
  return { yaw: after.yaw - before.yaw, pitch: after.pitch - before.pitch };
}

/**
 * Sprint one body down a clear lane and report, for each of `count` frames,
 * the one camera's world height and what the body was doing. The lane is the
 * map's own (`tests/lanes.js`), so neither map is named.
 *
 * @param {object} h
 * @param {'shade'|'warden'} role
 * @param {object} lane from `clearLane`
 * @param {number} count
 */
function sprintDownLane(h, role, lane, count) {
  const actor = role === 'warden' ? h.warden : h.shade;
  if (role === 'warden') asWarden(h); else asShade(h);
  h.setCameraOwner(role);
  actor.reset({ position: { x: lane.x, y: lane.y, z: lane.z }, yaw: lane.yaw });
  actor.pitch = 0;
  h.input.clearAll();
  h.input.locked = false;
  // Stand first, so the reset is not still settling into the floor when the
  // walk starts. The difference of two runs would cancel it either way; this
  // keeps each run's own trace readable.
  for (let i = 0; i < 20; i++) frame(h);
  const trace = [];
  h.input.heldCodes.add('KeyW');
  h.input.heldCodes.add('ShiftLeft');
  for (let i = 0; i < count; i++) {
    frame(h);
    h.camera.getWorldPosition(SCRATCH);
    trace.push({
      camY: SCRATCH.y,
      x: actor.position.x, y: actor.position.y, z: actor.position.z,
      speed: actor.speed,
      grounded: actor.state === (role === 'warden' ? WARDEN_STATE.GROUND : SHADE_STATE.GROUND),
    });
  }
  h.input.clearAll();
  return trace;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'look-sensitivity-is-per-axis-and-invert-y-turns-only-the-pitch',
    spec: 'Section 13, H9',
    name: 'The same mouse movement turns the camera by each axis own sensitivity, and invert Y flips the pitch and leaves the turn alone',
    run: (h) => {
      const problems = [];
      const was = {
        x: SETTINGS.mouseSensitivity, y: SETTINGS.mouseSensitivityY,
        invert: SETTINGS.invertY, locked: h.input.locked,
      };
      const seen = [];
      try {
        asShade(h);
        const min = CONFIG.settings.mouseSensitivityMin;
        const max = CONFIG.settings.mouseSensitivityMax;
        const D = 30;
        // Level and square on, well inside the pitch clamp: 30 device units at
        // the top sensitivity is 0.24rad, against a clamp of over a radian.
        const level = () => { h.shade.pitch = 0; h.shade.yaw = 0; };

        // Slow turn, fast pitch. Each axis must come out as its own
        // sensitivity times the delta, not as one applied to both.
        SETTINGS.invertY = false;
        SETTINGS.mouseSensitivity = min;
        SETTINGS.mouseSensitivityY = max;
        level();
        const slow = mouseMove(h, D, D);
        if (Math.abs(slow.yaw - -D * min) > 1e-6) {
          problems.push(`turn at the minimum moved ${slow.yaw.toFixed(6)}rad, want ${(-D * min).toFixed(6)}`);
        }
        if (Math.abs(slow.pitch - -D * max) > 1e-6) {
          problems.push(`pitch at the maximum moved ${slow.pitch.toFixed(6)}rad, want ${(-D * max).toFixed(6)}`);
        }

        // And the other way round, so neither reading can be the other axis
        // standing in for it.
        SETTINGS.mouseSensitivity = max;
        SETTINGS.mouseSensitivityY = min;
        level();
        const fast = mouseMove(h, D, D);
        if (Math.abs(fast.yaw - -D * max) > 1e-6) {
          problems.push(`turn at the maximum moved ${fast.yaw.toFixed(6)}rad, want ${(-D * max).toFixed(6)}`);
        }
        if (Math.abs(fast.pitch - -D * min) > 1e-6) {
          problems.push(`pitch at the minimum moved ${fast.pitch.toFixed(6)}rad, want ${(-D * min).toFixed(6)}`);
        }
        const ratio = Math.abs(slow.pitch / slow.yaw);
        if (Math.abs(ratio - max / min) > 0.01) {
          problems.push(`the axes came out ${ratio.toFixed(2)}:1 apart and the sliders are ${(max / min).toFixed(2)}:1`);
        }
        seen.push(`${ratio.toFixed(1)}:1 apart at the slider's ends, either way round`);

        // The defaults are one feel and not two: a player who has touched
        // neither slider gets the same radians on both axes.
        SETTINGS.mouseSensitivity = CONFIG.settings.defaults.mouseSensitivity;
        SETTINGS.mouseSensitivityY = CONFIG.settings.defaults.mouseSensitivityY;
        level();
        const even = mouseMove(h, D, D);
        if (Math.abs(Math.abs(even.yaw) - Math.abs(even.pitch)) > 1e-9) {
          problems.push(`on the defaults the axes differ: ${even.yaw.toFixed(6)} against ${even.pitch.toFixed(6)}`);
        }

        // Invert Y: the pitch reverses, and the turn does not move at all.
        SETTINGS.invertY = true;
        level();
        const flipped = mouseMove(h, D, D);
        if (Math.abs(flipped.pitch + even.pitch) > 1e-9) {
          problems.push(`inverted the pitch moved ${flipped.pitch.toFixed(6)}rad against ${even.pitch.toFixed(6)} upright`);
        }
        if (Math.abs(flipped.yaw - even.yaw) > 1e-9) {
          problems.push(`invert Y moved the turn too: ${flipped.yaw.toFixed(6)} against ${even.yaw.toFixed(6)}`);
        }
        if (flipped.pitch <= 0) {
          problems.push(`invert Y did not raise the aim on a downward movement (${flipped.pitch.toFixed(6)}rad)`);
        }
        seen.push(`invert turns ${even.pitch.toFixed(4)} into ${flipped.pitch.toFixed(4)} and leaves the turn at ${even.yaw.toFixed(4)}`);
      } finally {
        SETTINGS.mouseSensitivity = was.x;
        SETTINGS.mouseSensitivityY = was.y;
        SETTINGS.invertY = was.invert;
        h.input.clearAll();
        h.input.locked = was.locked;
        asShade(h);
      }
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `off the camera's own world aim: ${seen.join('; ')}`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'each-role-draws-with-the-field-of-view-its-setting-asks-for',
    spec: 'Section 6.2, Section 13, H9',
    name: 'The projection matrix carries the Shade FOV, the Warden its own, an aim that narrows from the player value to the sight picture, and is put back every frame',
    run: (h) => {
      const problems = [];
      const was = { shade: SETTINGS.fovShade, warden: SETTINGS.fovWarden, locked: h.input.locked };
      const seen = [];
      try {
        // The defaults are the engine's FOV, which is what lets every check
        // written before H9 read `CONFIG.render.fov` as the resting one -
        // `tests/warden.js`'s handover check does exactly that. Pinned here so
        // the agreement cannot rot without something going red.
        const D = CONFIG.settings.defaults;
        if (D.fovShade !== CONFIG.render.fov || D.fovWarden !== CONFIG.render.fov) {
          problems.push(`the default FOVs are ${D.fovShade}/${D.fovWarden} and the engine draws at ${CONFIG.render.fov}`);
        }
        if (CONFIG.render.fov < CONFIG.settings.fovMin || CONFIG.render.fov > CONFIG.settings.fovMax) {
          problems.push(`${CONFIG.render.fov} is outside the slider's ${CONFIG.settings.fovMin}..${CONFIG.settings.fovMax}`);
        }

        SETTINGS.fovShade = 95;
        SETTINGS.fovWarden = 62;

        asShade(h);
        h.input.clearAll();
        h.input.locked = false;
        h.renderFrame(1 / 60);
        if (Math.abs(drawnFov(h) - 95) > 0.02) problems.push(`the Shade drew at ${drawnFov(h).toFixed(2)}, want 95`);

        // A cinematic hands the camera back at the engine's FOV by contract
        // (combat's finisher, the death camera: leave nothing behind). The
        // frame has to put the player's own back, or whoever set a wide one
        // looks through the shipped one until the next handover.
        h.camera.fov = 12;
        h.camera.updateProjectionMatrix();
        h.renderFrame(1 / 60);
        if (Math.abs(drawnFov(h) - 95) > 0.02) problems.push(`a frame did not take the FOV back off 12: ${drawnFov(h).toFixed(2)}`);
        seen.push('shade 95 drawn, and put back after a dirty 12');

        // The Shade's setting is not the Warden's: two pictures, two numbers.
        asWarden(h);
        h.input.clearAll();
        h.input.locked = false;
        h.renderFrame(1 / 60);
        if (Math.abs(drawnFov(h) - 62) > 0.02) problems.push(`the Warden drew at ${drawnFov(h).toFixed(2)}, want its own 62`);

        // Section 6.2's ADS, held the way a player holds it. It narrows from
        // the player's own FOV to `adsFov` absolutely, so the sight picture is
        // the same however wide the hip-fire view was: from 90 at half a blend
        // that is 71, never the 61 a fraction of the shipped 70 would give.
        SETTINGS.fovWarden = 90;
        h.renderFrame(1 / 60);
        h.input.heldCodes.add('Mouse2');
        const blends = [];
        for (let i = 0; i < 40; i++) {
          h.renderFrame(1 / 60);
          const blend = h.warden.adsBlend;
          const want = 90 + (W.camera.adsFov - 90) * blend;
          if (Math.abs(drawnFov(h) - want) > 0.05) {
            problems.push(`at blend ${blend.toFixed(3)} the camera drew ${drawnFov(h).toFixed(2)}, want ${want.toFixed(2)}`);
            break;
          }
          blends.push(blend);
        }
        const deepest = blends.length ? blends[blends.length - 1] : 0;
        if (deepest < 0.99) problems.push(`holding the aim for ${blends.length} frames only reached blend ${deepest.toFixed(3)}`);
        if (Math.abs(drawnFov(h) - W.camera.adsFov) > 0.05) {
          problems.push(`fully aimed from 90 the camera drew ${drawnFov(h).toFixed(2)}, want the sight picture ${W.camera.adsFov}`);
        }
        seen.push(`warden 90 narrows to ${W.camera.adsFov} through all ${blends.length} blends`);

        // And the aim does not come across with the camera: a handover takes
        // the next owner's RESTING field, never `desiredFov()`.
        h.setCameraOwner('shade');
        if (Math.abs(h.camera.fov - 95) > 1e-9) problems.push(`the handover to the Shade left ${h.camera.fov.toFixed(2)}, want its resting 95`);
        h.setCameraOwner('warden');
        if (Math.abs(h.camera.fov - 90) > 1e-9) problems.push(`the handover to an aiming Warden left ${h.camera.fov.toFixed(2)}, want its resting 90`);
        seen.push('a handover takes the resting field, not the aimed one');
      } finally {
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
        detail: problems.length === 0
          ? `off the projection matrix: ${seen.join('; ')}`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'head-bob-rides-the-stride-only-when-it-is-switched-on',
    spec: 'Section 13, H9',
    name: 'Two identical sprints, bob off then on: the camera rises with the stride by its body amplitude, never below its rest, nothing off the ground, and the body not at all',
    run: (h) => {
      const problems = [];
      const wasBob = SETTINGS.headBob;
      const wasLocked = h.input.locked;
      const seen = [];
      const lane = clearLane(h, LANE);
      if (!lane) return { pass: false, detail: `no clear ${LANE}m lane on this map` };
      try {
        for (const role of ['shade', 'warden']) {
          const amplitude = role === 'warden' ? W.camera.bob : S.camera.bob;
          const sprintSpeed = role === 'warden' ? W.sprintSpeed : S.sprintSpeed;
          const walkSpeed = role === 'warden' ? W.walkSpeed : S.walkSpeed;

          // The same sprint twice. The simulation is deterministic - one seed
          // per `initMatch`, one fixed step - and the bob writes nothing the
          // simulation reads, so the two traces differ by the bob and by
          // nothing else. That is what cancels the landing dip, the ground
          // under the feet and the boom's pullback in one stroke.
          SETTINGS.headBob = false;
          const off = sprintDownLane(h, role, lane, 150);
          SETTINGS.headBob = true;
          const on = sprintDownLane(h, role, lane, 150);
          if (off.length !== on.length) {
            problems.push(`${role}: ${off.length} frames off and ${on.length} on`);
            continue;
          }

          let drift = 0;
          let lowest = Infinity;
          let peak = -Infinity;
          let fastest = 0;
          let airborne = 0;
          let still = 0;
          for (let i = 0; i < on.length; i++) {
            const a = off[i];
            const b = on[i];
            drift = Math.max(drift, Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
            const bob = b.camY - a.camY;
            lowest = Math.min(lowest, bob);
            peak = Math.max(peak, bob);
            fastest = Math.max(fastest, b.speed);
            if (!b.grounded) airborne = Math.max(airborne, Math.abs(bob));
            else if (b.speed <= 0.2) still = Math.max(still, Math.abs(bob));
          }

          // The reason for taking the reading as a difference at all.
          if (drift > 1e-9) {
            problems.push(`${role}: the body moved ${drift.toFixed(9)}m differently with the bob on - it is not presentation only`);
          }
          if (fastest < walkSpeed) {
            problems.push(`${role}: the sprint only reached ${fastest.toFixed(2)}m/s; nothing was measured`);
          }
          const want = amplitude * Math.min(1, fastest / sprintSpeed);
          if (peak < want * 0.8) {
            problems.push(`${role}: the camera rose ${peak.toFixed(4)}m at ${fastest.toFixed(2)}m/s, want about ${want.toFixed(4)}`);
          }
          if (peak > want * 1.02 + 1e-6) {
            problems.push(`${role}: the camera rose ${peak.toFixed(4)}m, past the ${want.toFixed(4)} its amplitude allows`);
          }
          if (lowest < -1e-9) {
            problems.push(`${role}: the bob took the camera ${lowest.toFixed(4)}m BELOW its rest; a dip is a landing or a climb, not a stride`);
          }
          if (airborne > 1e-9) problems.push(`${role}: the camera bobbed ${airborne.toFixed(4)}m while off the ground`);
          if (still > 1e-9) problems.push(`${role}: the camera bobbed ${still.toFixed(4)}m while barely moving`);
          // `lowest` is the least the bob ever was, not how far it went down:
          // it is above zero because the sine passes through zero between two
          // sampled frames, and a negative one is the failure above.
          seen.push(`${role} peak +${peak.toFixed(4)}m at ${fastest.toFixed(2)}m/s (amplitude ${amplitude}), `
            + `never lower than +${lowest.toFixed(4)}m, 0 airborne, body identical to 1e-9`);
        }
      } finally {
        SETTINGS.headBob = wasBob;
        h.input.clearAll();
        h.input.locked = wasLocked;
        asShade(h);
      }
      return {
        pass: problems.length === 0,
        detail: problems.length === 0 ? `down ${lane.from}: ${seen.join('; ')}` : problems.join('; '),
      };
    },
  });
}
