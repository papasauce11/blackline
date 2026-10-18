/**
 * BLACKLINE - tests/climbpress.js
 *
 * AUTO suite: everything about **one key**, and the drivers that press it.
 *
 * A climb is a press of Space and never a side effect of moving (D17), and the
 * press has two meanings (D21): a tap grabs the lip and hangs, a hold carries
 * on over. Those two rules are the whole subject of this file - the two checks
 * that hold them, and the two drivers every other climb check in the suite
 * reaches a ledge with.
 *
 * **It was 267 lines of `tests/movement.js` and the seam was the subject**
 * (H70). That file is the mechanical half of Section 16's checks 1, 5 and 7 -
 * sprint into a wall, slide into a vent, an eight-metre fall - which is what
 * its header says it is for; these two arrived later, about a key rather than
 * about a motion, and took it to **599 of a 600 allowance**. Unlike H56's
 * split, none of the length was prose: the header is seventeen lines and the
 * rest is check body, so the only honest cut was along the subject.
 *
 * **Seven modules drive a ledge through here**, which is the reason the two
 * drivers came across with the checks rather than staying behind: nothing in
 * `movement.js`'s own three checks calls either of them. `bindings.js`,
 * `hang.js`, `scuff.js` and `tutorial.js` take both; `feel.js`,
 * `grabslide.js` and `strikedrive.js` take `findGroundLedge` alone.
 *
 * Both checks drive the real controller through `input.heldCodes` and
 * `input.pressedCodes` and never write an intent field - the lesson
 * `HANDOFF.md` says keeps repeating - and `driveAtLedge` is where that is
 * done, which is why H8's rebind check can drive the same ledge on `J`.
 *
 * Registered from tests/index.js beside tests/movement.js, the file it came
 * out of. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { SHADE_STATE } from '../entities/agent.js';
import { riseIsClear } from '../climbprobe.js';

const S = CONFIG.shade;

export function register(debugTools) {
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
