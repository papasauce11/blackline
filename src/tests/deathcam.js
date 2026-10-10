/**
 * BLACKLINE - tests/deathcam.js
 *
 * AUTO suite (Section 16 check 23, Section 17.1): the Shade's death.
 *
 * Section 15 lists "reinsert leaves stale state (dead flag, ragdoll, camera on
 * the death cam)" as its own risk. The failure it describes is not a crash — it
 * is a player who reinserts and finds themselves watching a corpse, or steering
 * a body that is lying on the floor. So these checks assert the *absence* of
 * leftovers, one field at a time, and then prove the wall-clock guard hands
 * control back even when the countdown never does.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';

const RI = CONFIG.reinsert;

/** Put the harness back on a clean competitive round. */
function freshRound(h) {
  h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'death-camera-watches-the-killer',
    spec: 'Section 10.2 / check 23',
    name: 'Ragdoll, free-look camera on the Warden, countdown, then a clean restore',
    run: (h) => {
      const problems = [];
      freshRound(h);
      const { shade, warden, objective, deathCam, effects } = h;

      // Put the Warden somewhere definite so "the camera looks at the killer"
      // is a claim with a coordinate behind it.
      const spawn = h.map.wardenSpawns[0];
      warden.reset(spawn);
      h.stepFrames(10);

      const livesBefore = objective.round.lives;
      const ragdollsBefore = effects.ragdolls.length;

      shade.health = 0;
      h.emitter.emit('combat:death', { target: 'shade', kind: 'test' });

      if (!deathCam.active) problems.push('no death camera after the Shade died');
      if (!shade.ragdolled) problems.push('the body was not ragdolled');
      if (effects.ragdolls.length !== ragdollsBefore + 1) problems.push('no ragdoll was registered with effects');
      if (h.cameraOwner !== 'deathcam') problems.push(`camera owner is "${h.cameraOwner}", want "deathcam"`);
      if (objective.round.lives !== livesBefore - 1) {
        problems.push(`lives went ${livesBefore} -> ${objective.round.lives}`);
      }
      if (!objective.round.awaitingReinsert) problems.push('no reinsert was scheduled');
      if (Math.abs(objective.round.reinsertTimer - RI.delay) > 1e-6) {
        problems.push(`countdown started at ${objective.round.reinsertTimer}s, spec ${RI.delay}s`);
      }

      // The camera frames the killer, and free-look moves it without moving
      // anything in the world.
      deathCam.step(1 / 60, shade);
      const framedDistance = Math.hypot(
        h.camera.position.x - warden.position.x,
        h.camera.position.z - warden.position.z
      );
      if (Math.abs(framedDistance - RI.deathCamDistance) > 0.6) {
        problems.push(`camera sits ${framedDistance.toFixed(2)}m from the killer, want ~${RI.deathCamDistance}m`);
      }
      // Two bodies read, because they can fail differently (H47). The
      // **capsule** is what a free-look could move: the camera reads it and a
      // cinematic that wrote back through it would walk the corpse, and
      // nothing in the suite held that. The **mesh** is the direct-write guard
      // this clause was named for - a cinematic setting the transform itself -
      // and it is out of reach of the position chase by the ragdoll rather
      // than by luck: `combat:death` above handed the mesh over, and a
      // ragdolled body's visual update returns before writing position.
      //
      // Neither of the two identifiers for driving a frame is spelled out
      // anywhere in this file, deliberately: `breathcensus.js` decides who
      // poses a body by grepping the raw source for one of them, comments
      // included, so naming it here puts this module in a census it does not
      // belong in. `audiocontext.js` keeps its own subject out of its own text
      // for exactly this reason, and H53 is the root cause.
      //
      // H43 found the hole: this check drives no frame at all, so the drawn
      // body was frozen for the whole of it and the mesh read could not have
      // moved whatever free-look did. It was
      // never wrong about what it claimed; it was reading the quantity it
      // could see rather than the one it meant.
      const capsuleBefore = { x: shade.position.x, z: shade.position.z };
      const bodyBefore = { x: shade.mesh.position.x, z: shade.mesh.position.z };
      const yawBefore = deathCam.state.yaw;
      deathCam.look(1.0, 0.2);
      deathCam.step(1 / 60, shade);
      if (deathCam.state.yaw <= yawBefore) problems.push('free-look did not turn the camera');
      const movedX = h.camera.position.x;
      const capsuleMoved = Math.hypot(shade.position.x - capsuleBefore.x, shade.position.z - capsuleBefore.z);
      if (capsuleMoved > 1e-6) {
        problems.push(`free-look moved the body ${capsuleMoved.toFixed(4)}m: turning the death camera wrote back through the capsule it is reading`);
      }
      if (Math.abs(shade.mesh.position.x - bodyBefore.x) > 1e-6
        || Math.abs(shade.mesh.position.z - bodyBefore.z) > 1e-6) {
        problems.push('free-look wrote the drawn transform directly');
      }
      // Pitch is clamped, so a player cannot spin the camera inside the floor.
      deathCam.look(0, 99);
      if (deathCam.state.pitch > RI.deathCamPitchMax + 1e-9) problems.push('pitch was not clamped');
      deathCam.look(0, -99);
      if (deathCam.state.pitch < RI.deathCamPitchMin - 1e-9) problems.push('pitch was not clamped downward');

      // Movement input must not drive the corpse. This is the real path: the
      // composition root feeds an idle intent while health is 0.
      const posBefore = shade.position.clone();
      h.input.heldCodes.add('KeyW');
      h.stepFrames(30);
      h.input.heldCodes.delete('KeyW');
      if (shade.position.distanceTo(posBefore) > 0.05) {
        problems.push(`a dead Shade walked ${shade.position.distanceTo(posBefore).toFixed(2)}m`);
      }

      // Run the countdown out and assert nothing is left behind. Measured from
      // the timer, not from this loop: the movement probe above already spent
      // half a second of the countdown, and counting only the loop would report
      // a 15s reinsert as 14.5s.
      const remainingBefore = objective.round.reinsertTimer;
      let steps = 0;
      while (objective.round.awaitingReinsert && steps < 2000) {
        h.stepFrames(1);
        steps++;
      }
      const loopSeconds = steps * CONFIG.time.fixedDt;
      const waited = RI.delay - remainingBefore + loopSeconds;
      if (objective.round.awaitingReinsert) problems.push('never reinserted');
      if (Math.abs(loopSeconds - remainingBefore) > 0.05) {
        problems.push(`the last ${remainingBefore.toFixed(2)}s of countdown took ${loopSeconds.toFixed(2)}s`);
      }
      if (Math.abs(waited - RI.delay) > 0.05) problems.push(`reinserted after ${waited.toFixed(2)}s, spec ${RI.delay}s`);

      // Section 15's four leftovers, checked one at a time.
      if (deathCam.active) problems.push('LEFTOVER: still on the death camera');
      if (shade.ragdolled) problems.push('LEFTOVER: the ragdoll flag survived');
      if (effects.ragdolls.some((r) => r.mesh === shade.mesh)) problems.push('LEFTOVER: the ragdoll is still ticking');
      if (shade.health !== CONFIG.shade.health) problems.push(`LEFTOVER: health is ${shade.health}`);
      if (Math.abs(shade.mesh.rotation.x) > 1e-6 || Math.abs(shade.mesh.rotation.z) > 1e-6) {
        problems.push('LEFTOVER: the body is still lying at the ragdoll angle');
      }
      if (!shade.mesh.visible) problems.push('LEFTOVER: the body is invisible');

      // Control is genuinely back: one frame of the real loop hands the camera
      // to the Shade rig, and input drives the Shade again.
      h.stepFrames(1);
      h.setCameraOwner('shade');
      if (h.camera.parent !== shade.cameraRig) problems.push('the camera did not return to the Shade rig');
      const returnedFrom = shade.position.clone();
      h.input.heldCodes.add('KeyW');
      h.stepFrames(30);
      h.input.heldCodes.delete('KeyW');
      const walked = shade.position.distanceTo(returnedFrom);
      if (walked < 0.5) problems.push(`input was not restored — the Shade moved ${walked.toFixed(2)}m`);

      freshRound(h);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `lives ${livesBefore} -> ${livesBefore - 1}, body ragdolled, camera ${framedDistance.toFixed(2)}m off the `
            + `killer and free-look turned it to x=${movedX.toFixed(2)} without moving the body; `
            + `reinserted after ${waited.toFixed(2)}s with no ragdoll, no death cam, full health, `
            + `and ${walked.toFixed(2)}m walked on the first input after`
          : problems.join('; '),
      };
    },
  });

  registerGuardCheck(debugTools);
}

/** The guard is its own check: it must work when the countdown does not. */
function registerGuardCheck(debugTools) {
  debugTools.registerAutoTest({
    id: 'death-camera-guard-always-returns-control',
    spec: 'Section 15',
    name: 'A countdown that never advances still hands the player back their camera',
    run: (h) => {
      const problems = [];
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      const { shade, objective, deathCam } = h;

      if (!(RI.wallClockGuard > RI.delay)) {
        problems.push(`the guard (${RI.wallClockGuard}s) must sit past the countdown (${RI.delay}s)`);
      }

      shade.health = 0;
      h.emitter.emit('combat:death', { target: 'shade', kind: 'test' });
      if (!deathCam.active) problems.push('no death camera to guard');

      // Simulate the failure the guard exists for: the sim clock has stopped,
      // so the countdown is frozen at full and no number of steps will move it.
      // Rewinding the wall start is how the finisher check does the same thing.
      objective.round.reinsertTimer = RI.delay;
      deathCam.state.wallStart -= RI.wallClockGuard + 0.1;

      let warned = null;
      const off = h.emitter.on('deathcam:guard', (event) => { warned = event; });
      deathCam.step(1 / 60, shade);
      off();

      if (!warned) problems.push('the guard did not fire');
      if (deathCam.active) problems.push('the guard fired but kept the camera');
      if (objective.round.awaitingReinsert) problems.push('the guard fired but left the Shade dead');
      if (shade.ragdolled) problems.push('the guard fired but left the ragdoll');
      if (shade.health !== CONFIG.shade.health) problems.push(`the guard left health at ${shade.health}`);

      // Idempotent: a second restore is a no-op, not a second reinsert.
      const livesAfter = objective.round.lives;
      const restoredAgain = deathCam.restore();
      if (restoredAgain) problems.push('restore() was not idempotent');
      if (objective.round.lives !== livesAfter) problems.push('a repeat restore cost another life');

      // And the guard cannot fire when there is nothing to guard.
      deathCam.step(1 / 60, shade);
      if (deathCam.active) problems.push('stepping an inactive death camera reactivated it');

      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `countdown frozen at ${RI.delay}s: the ${RI.wallClockGuard}s wall-clock guard fired after `
            + `${warned.after.toFixed(2)}s, forced the reinsert, cleared the ragdoll and returned the camera; `
            + 'restore is idempotent'
          : problems.join('; '),
      };
    },
  });
}
