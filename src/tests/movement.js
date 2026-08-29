/**
 * BLACKLINE - tests/movement.js
 *
 * AUTO suite: the mechanical half of Section 16's movement checks.
 *
 * Checks 1-7 are classed HUMAN because feel cannot be asserted. But each of
 * them also makes a claim that *can* be: no clipping, a clean landing, a
 * capsule that lowers, a noise that fires. Those halves live here so a
 * regression is caught without a play session, and Josh's pass over them is
 * about how they feel rather than about whether they still work.
 *
 * Checks 2, 4, 5 (stand-up) and 6 already have homes in tests/shade.js. This
 * file covers what was left: 1 (sprint into a wall), 5 (slide into a vent) and
 * 7 (an 8m fall).
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { SHADE_STATE, createIntent } from '../entities/agent.js';

const S = CONFIG.shade;
const N = CONFIG.noise;

/** The Shade's capsule half-extents at its current height. */
function halfOf(shade) {
  return { x: S.radius, y: shade.height / 2, z: S.radius };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'sprint-into-a-wall-never-clips-or-jitters',
    spec: 'Section 6.1 / check 1',
    name: 'Full-speed into a wall: stops clean, stays outside, and settles still',
    run: (h) => {
      const problems = [];
      const dt = CONFIG.time.fixedDt;
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      const shade = h.shade;

      // A wall to run at: cast around a spawn until something roughly vertical
      // turns up with room to build sprint speed in front of it.
      const spawn = h.map.shadeSpawns[0];
      shade.reset(spawn);
      h.stepFrames(10);
      const runUp = S.sprintSpeed * 1.2;
      let wall = null;
      let heading = 0;
      const from = { x: shade.position.x, y: shade.feetY + 1.0, z: shade.position.z };
      for (let i = 0; i < 48 && !wall; i++) {
        const angle = (i / 48) * Math.PI * 2;
        const hit = h.map.collision.raycast(from, { x: Math.sin(angle), y: 0, z: Math.cos(angle) }, 40);
        if (hit && Math.abs(hit.ny) < 0.5 && hit.distance > runUp) {
          wall = hit;
          heading = angle;
        }
      }
      if (!wall) return { pass: false, detail: 'no wall with a run-up found from the Shade spawn' };

      // Start a sprint's length back from it, square to the face. Backing off
      // along the surface NORMAL rather than along the ray is what makes it
      // square: a ray that hits a wall at an angle would have the Shade slide
      // along it instead of stopping, which is correct behaviour and would make
      // the jitter measurement below meaningless.
      const startAt = {
        x: wall.x + wall.nx * runUp,
        y: spawn.position.y,
        z: wall.z + wall.nz * runUp,
      };
      // Shade forward is (-sin yaw, -cos yaw), and it must head along -normal.
      shade.reset({ position: startAt, yaw: Math.atan2(wall.nx, wall.nz) });
      h.stepFrames(10);
      void heading;

      const intent = createIntent();
      intent.forward = 1;
      intent.sprint = true;

      let overlaps = 0;
      let peakSpeed = 0;
      const steps = Math.round(4 / dt);
      const displacement = [];
      let previous = shade.position.clone();
      for (let i = 0; i < steps; i++) {
        shade.step(dt, intent);
        peakSpeed = Math.max(peakSpeed, Math.hypot(shade.velocity.x, shade.velocity.z));
        // Never inside geometry, on any step — not merely at the end.
        if (h.map.collision.overlap(shade.position, halfOf(shade))) overlaps++;
        displacement.push(shade.position.distanceTo(previous));
        previous = shade.position.clone();
      }

      // "No jitter": once it is up against the wall it should be still, not
      // oscillating in and out of the surface. The last half-second decides.
      const settleWindow = displacement.slice(-Math.round(0.5 / dt));
      const worstSettle = Math.max(...settleWindow);
      const restingGap = Math.hypot(shade.position.x - wall.x, shade.position.z - wall.z);

      if (overlaps > 0) problems.push(`the capsule was inside geometry on ${overlaps}/${steps} steps`);
      if (peakSpeed < S.sprintSpeed - 0.5) problems.push(`only reached ${peakSpeed.toFixed(2)} m/s, sprint is ${S.sprintSpeed}`);
      if (worstSettle > 0.01) problems.push(`still moving ${(worstSettle / dt).toFixed(2)} m/s against the wall — jitter`);
      if (restingGap < S.radius - 0.02) problems.push(`resting ${restingGap.toFixed(3)}m from the face, inside a ${S.radius}m radius`);
      if (!Number.isFinite(shade.position.x) || !Number.isFinite(shade.position.z)) problems.push('position went non-finite');

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `sprinted ${runUp.toFixed(1)}m into a wall at ${peakSpeed.toFixed(2)} m/s: 0 overlaps across `
            + `${steps} steps, came to rest ${restingGap.toFixed(3)}m off the face (radius ${S.radius}), `
            + `and moved ${(worstSettle * 1000).toFixed(2)}mm/step over the last half second`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'slide-into-a-vent-lowers-the-capsule',
    spec: 'Section 6.1 / check 5',
    name: 'Sprint plus crouch slides, drops to vent height, and passes through',
    run: (h) => {
      const problems = [];
      const dt = CONFIG.time.fixedDt;
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      const shade = h.shade;

      // A vent at grade is the one a slide can actually reach from a run-up.
      const vent = h.map.vents.find((run) => run.grade) || h.map.vents[0];
      if (!vent) return { pass: false, detail: 'the map has no vent runs' };

      const alongX = vent.axis === 'x';
      const cross = alongX ? (vent.min.z + vent.max.z) / 2 : (vent.min.x + vent.max.x) / 2;
      const low = alongX ? vent.min.x : vent.min.z;
      const high = alongX ? vent.max.x : vent.max.z;
      const floorY = vent.min.y;
      const runUp = 5;

      const place = (along) => (alongX ? { x: along, y: floorY, z: cross } : { x: cross, y: floorY, z: along });

      // Which end has floor to run up on? A grade vent is a breach in the
      // shell, so one of its ends can open onto the edge of the world — and a
      // run-up that starts in mid-air measures a fall, not a slide.
      const hasGround = (along) => {
        const spot = place(along);
        const down = h.map.collision.raycast({ x: spot.x, y: floorY + 3, z: spot.z }, { x: 0, y: -1, z: 0 }, 20);
        return down !== null && Math.abs(down.y - floorY) < 0.4;
      };
      // dir +1 runs from the low end toward the high one.
      const dir = hasGround(low - runUp) ? 1 : hasGround(high + runUp) ? -1 : 0;
      if (dir === 0) return { pass: false, detail: `${vent.tag}: neither end has a run-up on solid ground` };
      const mouth = dir > 0 ? low : high;
      const exit = dir > 0 ? high : low;

      // How much clear lane there is to run up in. A duct mouth is 1.15m tall,
      // so a standing sprint at it just jams into the wall above — which is
      // exactly why check 5 is a slide. The run-up has to happen in the open.
      const standingHalf = { x: S.radius, y: S.standHeight / 2, z: S.radius };
      let lane = 0;
      for (let back = 1; back <= runUp * 2; back += 0.5) {
        const spot = place(mouth - dir * back);
        if (!h.map.collision.isClear({ x: spot.x, y: floorY + S.standHeight / 2 + 0.05, z: spot.z }, standingHalf)) break;
        lane = back;
      }
      if (lane < 4) return { pass: false, detail: `${vent.tag}: only ${lane}m of clear run-up outside the mouth` };

      // Shade forward is (-sin yaw, -cos yaw); it must head along the axis.
      const yaw = alongX ? Math.atan2(-dir, 0) : Math.atan2(0, -dir);
      shade.reset({ position: place(mouth - dir * lane), yaw });
      h.stepFrames(10);
      if (!shade.grounded) return { pass: false, detail: `${vent.tag}: the run-up start is not on the floor` };

      // Driven through the real key layer, not a hand-built intent. On the step
      // the crouch key goes down, `crouch` and `crouchPressed` are BOTH true —
      // that is what a keyboard produces and it is the combination that used to
      // make the slide unreachable, because the crouch was applied before the
      // slide was tested. A test that sets the flags itself can pick a
      // combination no player can produce and pass a broken game.
      h.input.clearAll();
      h.input.heldCodes.add('KeyW');
      h.input.heldCodes.add('ShiftLeft');

      const distanceToMouth = () => (mouth - (alongX ? shade.position.x : shade.position.z)) * dir;
      let runSteps = 0;
      while (distanceToMouth() > S.slideLead && runSteps++ < Math.round(3 / dt)) {
        h.stepFrames(1);
      }
      const speedIntoIt = Math.hypot(shade.velocity.x, shade.velocity.z);
      const leadIn = distanceToMouth();

      // Tap crouch: held and pressed on the same step, as a real keydown is.
      h.input.heldCodes.add('ControlLeft');
      h.input.pressedCodes.add('ControlLeft');
      h.stepFrames(1);
      h.input.pressedCodes.clear();
      const slid = shade.state === SHADE_STATE.SLIDE;
      const slideHeight = shade.height;
      const slideSpeed = Math.hypot(shade.velocity.x, shade.velocity.z);

      // Ride it through the duct, crouch still held.
      let overlaps = 0;
      let tallest = shade.height;
      /** How far past the mouth it got, in the direction of travel. */
      let reached = -Infinity;
      for (let i = 0; i < Math.round(4 / dt); i++) {
        h.stepFrames(1);
        if (h.map.collision.overlap(shade.position, halfOf(shade))) overlaps++;
        const along = alongX ? shade.position.x : shade.position.z;
        const inside = dir > 0 ? along > mouth && along < exit : along < mouth && along > exit;
        if (inside) tallest = Math.max(tallest, shade.height);
        reached = Math.max(reached, (along - mouth) * dir);
      }
      h.input.clearAll();

      if (!slid) problems.push(`sprint plus crouch produced state "${shade.state}", not a slide`);
      if (slideHeight > S.slideHeight + 1e-6) {
        problems.push(`the slide capsule is ${slideHeight.toFixed(2)}m, vent height is ${S.slideHeight}`);
      }
      if (Math.abs(slideSpeed - S.slideSpeed) > 0.6) {
        problems.push(`slide started at ${slideSpeed.toFixed(2)} m/s, spec is ${S.slideSpeed}`);
      }
      if (tallest > S.slideHeight + 1e-6) {
        problems.push(`stood up to ${tallest.toFixed(2)}m inside the duct (vent height ${S.slideHeight})`);
      }
      if (overlaps > 0) problems.push(`clipped geometry on ${overlaps} steps inside the vent`);
      if (reached <= 0) problems.push(`never entered the duct (got ${reached.toFixed(2)}m past the mouth)`);

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${vent.tag}: ${lane}m run-up, slid from ${leadIn.toFixed(2)}m short of the mouth at `
            + `${speedIntoIt.toFixed(2)} m/s, slide began at ${slideSpeed.toFixed(2)} `
            + `(spec ${S.slideSpeed}), capsule dropped to ${slideHeight.toFixed(2)}m from ${S.standHeight}m, `
            + `travelled ${reached.toFixed(2)}m inside a ${(vent.max.y - vent.min.y).toFixed(2)}m duct with 0 clips`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'an-eight-metre-fall-lands-loud-and-clean',
    spec: 'Section 6.1, 7.2 / check 7',
    name: 'Fall 8m: the landing noise fires at its spec radius and nothing clips the floor',
    run: (h) => {
      const problems = [];
      const dt = CONFIG.time.fixedDt;
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      const shade = h.shade;
      const drop = 8;

      // Open floor with 8m of air above it: drop straight down from a spawn.
      const spawn = h.map.shadeSpawns[0];
      shade.reset(spawn);
      h.stepFrames(10);
      const floorY = shade.feetY;
      const above = {
        x: shade.position.x,
        y: floorY + drop,
        z: shade.position.z,
      };
      if (!h.map.collision.isClear({ x: above.x, y: above.y + shade.height / 2, z: above.z }, halfOf(shade))) {
        return { pass: false, detail: `no clear air ${drop}m above the Shade spawn` };
      }

      // Copy the fields out. Noise events come from a fixed pool of 48 that
      // recycles (Section 7.2), so the object a listener is handed is a live
      // slot, not a record — hold on to it and a later Warden footstep quietly
      // rewrites the radius under you. Production listeners all read the
      // fields immediately; this one has to keep them.
      const heard = [];
      const off = h.emitter.on('noise', (event) => {
        if (event.type === 'landing') heard.push({ type: event.type, radius: event.radius, source: event.source });
      });

      shade.reset({ position: above, yaw: 0 });
      const intent = createIntent();
      let lowest = Infinity;
      let landedFrom = 0;
      let steps = 0;
      const limit = Math.round(5 / dt);
      while (steps++ < limit) {
        // Through the real fixed step, so detection sees the landing flag on
        // the same step the controller sets it — the ordering Phase 5 depends on.
        h.stepFrames(1);
        lowest = Math.min(lowest, shade.feetY);
        if (shade.landedFallHeight > 0) landedFrom = shade.landedFallHeight;
        if (shade.grounded && steps > 4) break;
      }
      off();

      const fell = steps * dt;
      const floorLimit = CONFIG.map.groundY - CONFIG.debug.floorTolerance;

      if (!shade.grounded) problems.push('never landed');
      if (lowest < floorLimit) problems.push(`feet reached y=${lowest.toFixed(3)}, floor limit ${floorLimit}`);
      if (Math.abs(landedFrom - drop) > 0.6) problems.push(`recorded a ${landedFrom.toFixed(2)}m fall, dropped ${drop}m`);
      if (h.map.collision.overlap(shade.position, halfOf(shade))) problems.push('came to rest inside geometry');

      // Section 7.2: a fall over 2m emits a 10m landing noise.
      if (heard.length === 0) problems.push(`an ${drop}m fall emitted no landing noise`);
      else if (Math.abs(heard[0].radius - N.radii.shadeLanding) > 1e-6) {
        problems.push(`landing noise radius ${heard[0].radius}, spec ${N.radii.shadeLanding}`);
      }

      // And a short hop stays quiet, or the threshold means nothing.
      const quiet = [];
      const offQuiet = h.emitter.on('noise', (event) => {
        if (event.type === 'landing') quiet.push({ type: event.type, radius: event.radius });
      });
      shade.reset({ position: { x: above.x, y: floorY + 1.0, z: above.z }, yaw: 0 });
      for (let i = 0; i < Math.round(2 / dt); i++) h.stepFrames(1);
      offQuiet();
      if (quiet.length > 0) problems.push(`a 1m drop emitted ${quiet.length} landing noises`);

      void intent;
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `fell ${landedFrom.toFixed(2)}m in ${fell.toFixed(2)}s: lowest feet y=${lowest.toFixed(3)} `
            + `(limit ${floorLimit}), landed clear of geometry, emitted a ${heard[0].radius}m landing noise `
            + `(spec ${N.radii.shadeLanding}m); a 1m drop stayed silent (threshold ${S.landingNoiseFallHeight}m)`
          : problems.join('; '),
      };
    },
  });
}
