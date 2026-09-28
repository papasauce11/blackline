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
import { riseIsClear } from '../climbprobe.js';

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
    maps: ['plant'], // the plant's ducts
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

  // D17: a climb is a press of Space, never a side effect of moving. Before
  // this, _stepAir() mantled on every airborne step, so walking off any edge
  // while holding forward climbed whatever face was in reach. D21 then split
  // the press — a tap grabs the lip and hangs, a hold carries on over — so the
  // climbs here HOLD Space, and the tap/hold split has its own check below.
  debugTools.registerAutoTest({
    id: 'a-climb-is-a-press-of-space-never-a-side-effect',
    spec: 'Section 6.1, amended (20.2)',
    name: 'Forward into a ledge does nothing; Space held climbs it, on the ground and mid-fall',
    run: (h) => {
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
      const spot = findGroundLedge(h, 1.2, 2.4);
      if (!spot) {
        return { pass: false, detail: 'no ground-level ledge between 1.2m and 2.4m with a clear approach was found' };
      }
      const { box } = spot;
      const top = box.max.y;
      const ground = CONFIG.map.groundY;
      const tag = box.tag || 'the ledge';

      const problems = [];
      const groundNoPress = driveAtLedge(h, spot, { airborne: false, pressAt: null, hold: false, steps: 120 });
      if (groundNoPress.onTop || groundNoPress.sawClimb) {
        problems.push(`holding forward on the ground climbed ${tag} without Space`);
      }
      const groundHold = driveAtLedge(h, spot, { airborne: false, pressAt: 5, hold: true, steps: 90 });
      if (!groundHold.onTop) {
        problems.push(`Space held on the ground did not climb ${tag} (feet ${groundHold.feet.toFixed(2)}, top ${top.toFixed(2)})`);
      }
      const airNoPress = driveAtLedge(h, spot, { airborne: true, pressAt: null, hold: false, steps: 120 });
      if (airNoPress.onTop || airNoPress.sawClimb) {
        problems.push(`falling past ${tag} while holding forward climbed it without Space`);
      } else if (!airNoPress.grounded || airNoPress.feet > ground + 0.3) {
        problems.push(`the un-pressed fall did not end on the ground (feet ${airNoPress.feet.toFixed(2)}, grounded ${airNoPress.grounded})`);
      }
      const airHold = driveAtLedge(h, spot, { airborne: true, pressAt: 2, hold: true, steps: 90 });
      if (!airHold.onTop) {
        problems.push(`Space held during the fall did not climb ${tag} (feet ${airHold.feet.toFixed(2)})`);
      }

      h.input.clearAll();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${tag} (${(top - ground).toFixed(2)}m): forward alone never climbed, on the ground `
            + 'or falling past it; Space held climbed it from both'
          : problems.join('; '),
      };
    },
  });

  // D21: "tapping space grabs first always. holding space climbs." The grab is
  // the tap window: a key still down when the hand lands is a hold.
  debugTools.registerAutoTest({
    id: 'tap-space-grabs-the-ledge-hold-space-climbs-it',
    spec: 'Section 6.1, amended (20.3)',
    name: 'A tap of Space hangs from a mantle-height ledge, a hold goes over; a hang pulls up on Space and drops on crouch',
    run: (h) => {
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
      const shade = h.shade;
      const ground = CONFIG.map.groundY;
      // A hang is for a ledge at least 1.4 Shade-heights up (D22): one you
      // have to jump for. Everything below goes over on a tap, checked last.
      const hangMin = S.standHeight * S.hangMinHeightRatio;
      const fullReach = S.reach.standing + S.reach.jumpBonus;
      const spot = findGroundLedge(h, hangMin, fullReach, { hangable: true });
      if (!spot) {
        return { pass: false, detail: `no ground-level ledge between ${hangMin.toFixed(2)}m (1.4 heights) and ${fullReach}m with a clear approach and room to hang was found` };
      }
      const { box } = spot;
      const top = box.max.y;
      const tag = box.tag || 'the ledge';
      const hangFeet = top - S.hangDrop;
      const problems = [];

      // A tap on the ground: the hand lands, the body stays below the lip...
      const tap = driveAtLedge(h, spot, { airborne: false, pressAt: 5, hold: false, steps: 90 });
      if (tap.onTop) problems.push(`a tap on the ground went over ${tag} instead of hanging`);
      if (!tap.sawGrab) problems.push(`a tap on the ground never grabbed ${tag} (states ${tap.states})`);
      if (shade.state !== SHADE_STATE.HANG) problems.push(`after the tap the state is ${shade.state}, not hang`);
      if (Math.abs(shade.feetY - hangFeet) > 0.2) problems.push(`hanging feet at ${shade.feetY.toFixed(2)}, want ${hangFeet.toFixed(2)}`);

      // ...and a settled hang stays put with nothing pressed.
      h.input.clearAll();
      h.stepFrames(60);
      if (shade.state !== SHADE_STATE.HANG) problems.push(`a hang with nothing pressed became ${shade.state} within a second`);

      // From the hang, a press of Space pulls up.
      h.input.heldCodes.add('Space');
      h.input.pressedCodes.add('Space');
      h.stepFrames(1);
      h.input.clearEdges();
      h.input.heldCodes.delete('Space');
      h.stepFrames(60);
      if (shade.feetY < top - 0.12) problems.push(`Space from the hang did not pull up onto ${tag} (feet ${shade.feetY.toFixed(2)}, state ${shade.state})`);

      // Tap again, then crouch: drops to the floor, nothing climbed.
      const tap2 = driveAtLedge(h, spot, { airborne: false, pressAt: 5, hold: false, steps: 90 });
      if (tap2.onTop || shade.state !== SHADE_STATE.HANG) problems.push(`the second tap did not end hanging (state ${shade.state})`);
      h.input.clearAll();
      h.stepFrames(15); // past the settle grace
      h.input.heldCodes.add('ControlLeft');
      h.input.pressedCodes.add('ControlLeft');
      h.stepFrames(1);
      h.input.clearEdges();
      h.input.heldCodes.delete('ControlLeft');
      h.stepFrames(90);
      if (!shade.grounded || shade.feetY > ground + 0.3 || shade.state === SHADE_STATE.HANG) {
        problems.push(`crouch from the hang did not drop to the floor (feet ${shade.feetY.toFixed(2)}, state ${shade.state})`);
      }

      // A human tap is not one step. The window is the grab plus
      // `hangHoldDelay` - 0.30s from key-down - so 250ms down then released
      // is still a hang, and 500ms down is a hold and goes over. With the
      // grab alone as the window, 250ms went over (2026-09-17).
      const longTap = driveAtLedge(h, spot, { airborne: false, pressAt: 5, hold: false, holdFor: 15, steps: 90 });
      if (longTap.onTop || shade.state !== SHADE_STATE.HANG) {
        problems.push(`a 250ms tap went over ${tag} instead of hanging (state ${shade.state})`);
      }
      const longHold = driveAtLedge(h, spot, { airborne: false, pressAt: 5, hold: false, holdFor: 30, steps: 120 });
      if (!longHold.onTop) {
        problems.push(`a 500ms hold did not go over ${tag} (feet ${longHold.feet.toFixed(2)}, state ${shade.state})`);
      }

      // A hold on the ground: over, and through a grab on the way.
      const hold = driveAtLedge(h, spot, { airborne: false, pressAt: 5, hold: true, steps: 90 });
      if (!hold.onTop) problems.push(`a hold on the ground did not go over ${tag} (feet ${hold.feet.toFixed(2)})`);
      if (!hold.sawGrab) problems.push(`a hold went over ${tag} without grabbing first (states ${hold.states})`);

      // Mid-air, the same split.
      const airTap = driveAtLedge(h, spot, { airborne: true, pressAt: 2, hold: false, steps: 90 });
      if (airTap.onTop || shade.state !== SHADE_STATE.HANG) problems.push(`a tap mid-fall did not end hanging from ${tag} (state ${shade.state})`);
      const airHold = driveAtLedge(h, spot, { airborne: true, pressAt: 2, hold: true, steps: 90 });
      if (!airHold.onTop) problems.push(`a hold mid-fall did not go over ${tag} (feet ${airHold.feet.toFixed(2)})`);

      // Below the hang line there is nothing worth hanging from: a tap goes
      // straight over, at vault height and at mantle height alike.
      const lower = [
        { name: 'vault-height', min: 0.5, max: S.reach.vaultTop },
        { name: 'mantle-height below the hang line', min: S.reach.vaultTop + 0.05, max: hangMin - 0.05 },
      ];
      const lowerNotes = [];
      for (const tier of lower) {
        const found = findGroundLedge(h, tier.min, tier.max);
        if (!found) {
          problems.push(`no ground-level ${tier.name} ledge with a clear approach was found`);
          continue;
        }
        const fTag = found.box.tag || 'a ledge';
        const fRise = found.box.max.y - ground;
        const r = driveAtLedge(h, found, { airborne: false, pressAt: 5, hold: false, steps: 90 });
        if (!r.onTop) problems.push(`a tap at ${fTag} (${fRise.toFixed(2)}m, ${tier.name}) did not go over it (feet ${r.feet.toFixed(2)}, state ${shade.state})`);
        if (r.sawGrab) problems.push(`a tap at ${fTag} (${fRise.toFixed(2)}m, ${tier.name}) grabbed — below ${hangMin.toFixed(2)}m nothing should`);
        lowerNotes.push(`${fTag} (${fRise.toFixed(2)}m) goes over on a tap with no grab`);
      }

      h.input.clearAll();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${tag} (${(top - ground).toFixed(2)}m, above the ${hangMin.toFixed(2)}m hang line): a tap hangs at feet `
            + `${hangFeet.toFixed(2)} (250ms down still hangs, 500ms goes over), a hold goes over through a grab, `
            + `Space pulls up, crouch drops, the same mid-fall; ${lowerNotes.join('; ')}`
          : problems.join('; '),
      };
    },
  });
}

/**
 * Stand (or hang in the air) 0.8m from a ledge face, hold forward, and press
 * `code` — jump's key — once on a given step, released the next step (a tap)
 * or held to the end. Drives the real input; H8's rebind check drives it on J.
 */
export function driveAtLedge(h, spot, { airborne, pressAt, hold, holdFor = 0, steps, code = 'Space' }) {
  const shade = h.shade;
  const { box, x, z, yaw } = spot;
  const ground = CONFIG.map.groundY;
  const top = box.max.y;
  const climbStates = new Set([
    SHADE_STATE.VAULT, SHADE_STATE.MANTLE, SHADE_STATE.GRAB, SHADE_STATE.HANG, SHADE_STATE.PULLUP,
  ]);
  shade.reset({ position: { x, y: ground, z }, yaw });
  h.stepFrames(2);
  if (airborne) {
    // The walk-off case without the walk: airborne in front of the face
    // with nothing pressed, exactly the state a step off an edge leaves.
    shade.position.y += 0.6;
    shade.velocity.set(0, 0, 0);
    shade.grounded = false;
    shade.state = SHADE_STATE.AIR;
    shade._beginFall();
  }
  h.input.clearAll();
  h.input.heldCodes.add('KeyW');
  const states = new Set();
  let sawClimb = false;
  let sawGrab = false;
  let onTop = false;
  // The key goes up after the step at `pressAt + holdFor` (a one-step tap
  // by default), or never, for a hold.
  const releaseAt = hold || pressAt === null ? Infinity : pressAt + holdFor;
  for (let i = 0; i < steps && !onTop; i++) {
    if (pressAt !== null && i === pressAt) {
      h.input.heldCodes.add(code);
      h.input.pressedCodes.add(code);
    }
    h.stepFrames(1);
    h.input.clearEdges();
    if (i >= releaseAt) h.input.heldCodes.delete(code);
    states.add(shade.state);
    if (climbStates.has(shade.state)) sawClimb = true;
    if (shade.state === SHADE_STATE.GRAB) sawGrab = true;
    if (shade.feetY > top - 0.12 && shade.state !== SHADE_STATE.GRAB && shade.state !== SHADE_STATE.HANG) onTop = true;
  }
  h.input.clearAll();
  return {
    onTop, sawGrab, sawClimb, feet: shade.feetY, grounded: shade.grounded, states: [...states].join(','),
  };
}

/**
 * A climbable box that sits on the ground floor, between minRise and maxRise tall,
 * with a spot 0.8m off one of its faces where the Shade can stand and the
 * controller's own probe agrees the face is in reach. The probe is the
 * arbiter so the check cannot pick a face the game itself would not offer.
 */
export function findGroundLedge(h, minRise, maxRise, { hangable = false } = {}) {
  const ground = CONFIG.map.groundY;
  const shade = h.shade;
  for (const box of h.map.collision.boxes) {
    if (!box.climbable || !box.solid) continue;
    if (Math.abs(box.min.y - ground) > 0.05) continue;
    const rise = box.max.y - ground;
    if (rise < minRise || rise > maxRise) continue;
    const cx = (box.min.x + box.max.x) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    for (const [nx, nz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const x = nx === 0 ? cx : (nx < 0 ? box.min.x : box.max.x) + nx * 0.8;
      const z = nz === 0 ? cz : (nz < 0 ? box.min.z : box.max.z) + nz * 0.8;
      // Forward is (-sin yaw, -cos yaw); we want it pointing back at the box.
      const yaw = Math.atan2(nx, nz);
      shade.reset({ position: { x, y: ground, z }, yaw });
      h.stepFrames(3);
      if (!shade.grounded || Math.abs(shade.feetY - ground) > 0.05) continue;
      // Probe with the jump's reach: a ledge above standing reach is still this
      // spot's ledge, the press just has to leave the ground first.
      shade.grounded = false;
      const ledge = shade._probeLedge(S.vaultReach);
      shade.grounded = true;
      if (!ledge || ledge.box !== box) continue;
      if (hangable) {
        // A ledge you can actually hang from AND pull up onto: the hanging
        // body has to fit below the lip - the same centre `_tryGrab()`
        // commits to - and the way up from there has to be clear, by the
        // controller's own sweep (B8). A face with a gantry 0.3m over it
        // (hall-container's south side) hangs but never pulls up, and the
        // checks that pull up want a lip they can.
        const centre = {
          x: ledge.hitX - ledge.dirX * (shade.half.x + 0.04),
          y: ledge.topY - S.hangDrop + shade.half.y,
          z: ledge.hitZ - ledge.dirZ * (shade.half.x + 0.04),
        };
        if (!h.map.collision.isClear(centre, shade.half)) continue;
        const crouched = { x: S.radius, y: S.crouchHeight / 2, z: S.radius };
        const landing = shade._ledgeDestination(ledge, S.crouchHeight);
        if (!riseIsClear(h.map.collision, centre, landing, crouched, ledge.topY)) continue;
      }
      return { box, x, z, yaw };
    }
  }
  return null;
}
