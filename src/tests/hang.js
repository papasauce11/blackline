/**
 * BLACKLINE - tests/hang.js
 *
 * AUTO suite: B8, the hanging body. Since B1 (D21, D22) a tap of Space at a
 * ledge you had to jump for leaves you hanging; what the hanging body IS was
 * a capsule with its top half a metre above the lip, which meant a lip with
 * anything low over it could not be hung from at all. Now it hangs at full
 * stretch, arms straight up and the gloves on the lip, its top under the
 * lip - `hangDrop` in config.js - and a lip with less than a crouch of
 * room over it is the case: on the plant, hall-container's south face
 * under gantry-hall. The check searches the map it is on for one
 * (`findLiddedLip`) rather than naming it (D1's rule); a map with none -
 * the yard has no such lip by design (D2) - proves the stretch on any
 * hangable lip and says so.
 *
 * **The glove is read by two checks here, and the second one is why (H38).**
 * The drawn hand is on the lip within `GLOVE_ON_LIP`, and that quantity is a
 * **world** position of a mesh hanging off an arm inside the body group the
 * Shade's breath lifts - so it moves with the phase of the breath, and
 * `updateVisual` takes that phase from the wall clock of the render frame,
 * which `Agent.reset()` deliberately leaves alone (H31, D66). The first check
 * reads it once, at whatever phase the run arrived in. H33's census swept it
 * and found it the **thinnest breath-reached clause in the suite** - half the
 * tolerance spent on one quantity nothing bounded - so the second check sweeps
 * the cycle and asserts the **worst** phase, a claim the first one does not
 * make and which cannot depend on where the run came in. It is worth watching
 * because the margin is the product of three independent numbers -
 * `hangDrop`, the arm's length and the breath's amplitude - and nothing
 * watched it.
 *
 * **H38 corrects the census's number upward, and the reason is a settle.** H33
 * recorded the offset running -0.021m to +0.055m, so 2.75x of margin. Swept
 * from a settled pose it runs **-0.014m to +0.066m**, and the worst phase
 * clears its bar by **2.26x**: the breath's own ride agrees (0.080m, twice
 * `POSE.breath.lift` to the millimetre, over a dense sweep of all 419 frames
 * of a cycle), but the whole band sits a centimetre higher, because the hang
 * pose was still easing when the census read it. See `SWEEP_SETTLE_FRAMES`.
 * Eight phases are ample for *this* quantity - the dense sweep's worst is
 * 0.0663m against the eight-phase 0.066m, because an offset in metres is
 * continuous where a pixel count is not, which is exactly why H34 needed
 * thirty-two phases at 8m and this needs eight.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { POSE } from '../entities/agentvisual.js';
import { SHADE_STATE } from '../entities/agent.js';
import { landingSpot } from '../mapclimb.js';
import { driveAtLedge, findGroundLedge } from './movement.js';
import { press } from './feel.js';

const S = CONFIG.shade;

/**
 * The glove's own tolerance, named once so the two clauses that read it cannot
 * come to read it at two different numbers.
 */
const GLOVE_ON_LIP = 0.15;

/**
 * Frames of `updateVisual` after a grab before the first check reads the
 * glove. The arms swing up to the hang angle over the pose blend, so the
 * frames straight after a grab are the ease arriving rather than the hang: the
 * glove is 0.69m under the lip five frames in. Thirty is what that check has
 * always read at and its reading is held to it.
 */
const SETTLE_FRAMES = 30;

/**
 * And the frames the **sweep** settles, which is five times as many for a
 * measured reason. The arm's angle arrives by frame 30, but the pose's own
 * contribution to the glove's height is still moving: the offset reads
 * -0.036m at frame 30, -0.007m at 60 and -0.009m at 120, and the part of it
 * that is not the breath goes -0.016m, +0.018m, +0.027m over the same frames.
 * So a sweep that began at 30 would be sweeping the ease and the breath
 * together and calling the sum the breath. By 120 the pose has arrived to
 * within a third of a millimetre of where a dense sweep of a whole cycle puts
 * it; 150 is that with room.
 */
const SWEEP_SETTLE_FRAMES = 150;

/** Eight phases of one breath, sampled the way `tests/breath.js` samples them. */
const PHASES = 8;

/** The breath's own period, from the look table rather than a number copied out of it. */
const BREATH_SECONDS = (2 * Math.PI) / POSE.breath.rate;

/**
 * The ride the glove was measured over eight phases, and the band this calls
 * agreement. It is the **control** for the sweep below, and the sweep needs
 * one: a worst-of-eight clause read off a body that is not breathing is eight
 * readings of one phase, and would pass.
 *
 * Asserted **absolutely** rather than as a fraction of `POSE.breath.lift`, for
 * the reason `tests/breathcensus.js` pins its own ride that way (D70): a
 * clause that scales with the constant it guards is satisfied by zeroing that
 * constant. The band is wide enough for the sampling itself - eight samples of
 * a sinusoid span between `cos(pi/8)` of its amplitude and all of it, so the
 * ride can legitimately read 0.074m to 0.080m - and narrow enough that a
 * change in the breath's depth turns this red and sends the margin back to be
 * measured, which is the right outcome and not an obstacle. Measured: a dense
 * sweep of all 419 frames of a cycle rides **0.0800m**, which is twice
 * `POSE.breath.lift` to the millimetre, and eight phases of it read 0.078m on
 * the plant and 0.078m on the yard.
 */
const MEASURED_RIDE = 0.078;
const RIDE_TOLERANCE = 0.012;

/**
 * The world height of the drawn glove: the last child of the left arm, which
 * is the hand the figure builder puts on the end of it. Both checks read it
 * through this rather than keeping a copy of the walk, so they cannot drift
 * into reading two different quantities (H29's rule).
 */
function hangingGloveY(shade) {
  shade.mesh.updateMatrixWorld(true);
  const parts = shade.mesh.userData.parts;
  const glove = parts.armL.children[parts.armL.children.length - 1];
  return glove.getWorldPosition(shade.mesh.position.clone()).y;
}

/**
 * A ground-level lip in the hang band with a solid less than a crouch over
 * its landing - a body hangs from it and cannot pull up - and the spot 0.8m
 * off its face, clear for a standing body, where the controller's own probe
 * reports it. The lip need not be climbable (by this face it is not); the
 * hang is the point.
 *
 * @returns {{box: object, lid: object, x: number, z: number, yaw: number}|null}
 */
export function findLiddedLip(h) {
  const ground = CONFIG.map.groundY;
  const shade = h.shade;
  const hangMin = S.standHeight * S.hangMinHeightRatio;
  const fullReach = S.reach.standing + S.reach.jumpBonus;
  const standHalf = { x: S.radius, y: S.standHeight / 2, z: S.radius };
  const boxes = h.map.collision.boxes;
  for (const box of boxes) {
    if (!box.solid) continue;
    if (Math.abs(box.min.y - ground) > 0.05) continue;
    const rise = box.max.y - ground;
    if (rise < hangMin || rise > fullReach) continue;
    for (const [nx, nz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      // The lid: the lowest solid over where the body would land, within a
      // crouch of the top. Without one this face is not the case.
      const land = landingSpot(box, { nx, nz }, (box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2);
      const lid = boxes.filter((other) => other !== box && other.solid
        && other.min.y > box.max.y && other.min.y - box.max.y < S.crouchHeight
        && land.x >= other.min.x && land.x <= other.max.x && land.z >= other.min.z && land.z <= other.max.z)
        .sort((a, b) => a.min.y - b.min.y)[0];
      if (!lid) continue;
      const x = nx === 0 ? land.x : (nx < 0 ? box.min.x : box.max.x) + nx * 0.8;
      const z = nz === 0 ? land.z : (nz < 0 ? box.min.z : box.max.z) + nz * 0.8;
      if (!h.map.collision.isClear({ x, y: ground + standHalf.y + 0.02, z }, standHalf)) continue;
      const yaw = Math.atan2(nx, nz);
      shade.reset({ position: { x, y: ground, z }, yaw });
      h.stepFrames(3);
      if (!shade.grounded || Math.abs(shade.feetY - ground) > 0.05) continue;
      shade.grounded = false;
      const ledge = shade._probeLedge(S.vaultReach);
      shade.grounded = true;
      if (!ledge || ledge.box !== box) continue;
      return { box, lid, x, z, yaw };
    }
  }
  return null;
}

/**
 * Hang at the first hangable ground-level ledge on this map, which is what
 * both checks here start from: the spot the controller's own probe reports,
 * reached on the held key with a tap of Space, and the pose settled for
 * `settleFrames`. Shared so the sweep below is hanging off the same lip, in
 * the same pose, as the shipped clause - by construction rather than by two
 * copies of the same walk.
 *
 * @returns {{spot: object|null, top: number, tag: string, hung: boolean}}
 */
function hangAtGroundLedge(h, settleFrames) {
  const shade = h.shade;
  const hangMin = S.standHeight * S.hangMinHeightRatio;
  const fullReach = S.reach.standing + S.reach.jumpBonus;
  const spot = findGroundLedge(h, hangMin, fullReach, { hangable: true });
  if (!spot) return { spot: null, top: 0, tag: 'the ledge', hung: false };
  const top = spot.box.max.y;
  const tag = spot.box.tag || 'the ledge';
  driveAtLedge(h, spot, { airborne: false, pressAt: 5, hold: false, steps: 90 });
  h.input.clearAll();
  const hung = shade.state === SHADE_STATE.HANG;
  // Only a hanging body is worth settling; a failed grab has left the floor
  // and its pose is the caller's problem to report, not this one's to draw.
  if (hung) for (let i = 0; i < settleFrames; i++) shade.updateVisual(1 / 60);
  return { spot, top, tag, hung };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-hang-is-at-full-stretch-under-the-lip',
    spec: 'Section 6.1, amended (20.4; B8: the hanging body)',
    name: 'The hanging body sits below the lip with the gloves on it, so a lip under a low gantry can be hung from, and its blocked pull-up scuffs',
    run: (h) => {
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
      const shade = h.shade;
      const problems = [];

      // Any hangable ledge: the capsule's top is under the lip, and the drawn
      // gloves are at it with the arms straight up.
      const hang = hangAtGroundLedge(h, SETTLE_FRAMES);
      if (!hang.spot) return { pass: false, detail: 'no hangable ground-level ledge was found' };
      const { top, tag } = hang;
      if (!hang.hung) {
        problems.push(`a tap at ${tag} did not hang (state ${shade.state})`);
      } else {
        const capsuleTop = shade.position.y + shade.half.y;
        if (capsuleTop > top) problems.push(`hanging from ${tag} the capsule's top is ${(capsuleTop - top).toFixed(2)}m above the lip`);
        if (Math.abs(top - shade.feetY - S.hangDrop) > 0.05) problems.push(`hanging feet ${(top - shade.feetY).toFixed(2)}m under the lip, want hangDrop ${S.hangDrop}`);
        // The drawn body, settled by the walk above: the arms straight up and
        // the gloves' height in the world. This is the one reading, at
        // whatever phase of the breath the run arrived in; the check below
        // sweeps the cycle and asserts the worst of it (H38).
        const parts = shade.mesh.userData.parts;
        if (parts.armL.rotation.x > -3.0 || parts.armR.rotation.x > -3.0) problems.push(`hanging arms at ${parts.armL.rotation.x.toFixed(2)} / ${parts.armR.rotation.x.toFixed(2)}, not straight up`);
        const gloveY = hangingGloveY(shade);
        if (Math.abs(gloveY - top) > GLOVE_ON_LIP) problems.push(`the hanging glove is drawn at ${gloveY.toFixed(2)}, the lip is at ${top.toFixed(2)}`);
      }
      h.input.clearAll();

      // The lip the job names, found on the map this is: a lip with a solid
      // less than a crouch over it (the plant: hall-container's south face,
      // 0.3m under gantry-hall). A hanging body fits under it now, the
      // crouched one a pull-up needs does not. So a jump-tap hangs, Space
      // scuffs and stays hanging, crouch drops.
      const under = findLiddedLip(h);
      let lidded = 'no lip on this map has a solid less than a crouch over it, so the hang under a lid is not this map\'s to prove';
      if (under) {
        const { box: lip, lid } = under;
        const lipTag = lip.tag || 'the lip';
        const lidTag = lid.tag || 'the lid';
        const ground = CONFIG.map.groundY;
        const result = driveAtLedge(h, under, { airborne: false, pressAt: 5, hold: false, steps: 90 });
        if (shade.state !== SHADE_STATE.HANG) {
          problems.push(`a jump-tap at ${lipTag} under ${lidTag} did not hang (state ${shade.state}, states ${result.states})`);
        } else {
          if (shade.position.y + shade.half.y > lid.min.y) problems.push(`hanging under ${lidTag} with the capsule inside it`);
          h.input.clearAll();
          h.stepFrames(15);
          const scuffs = shade.scuffs;
          press(h, 'Space');
          h.stepFrames(1);
          h.input.clearAll();
          h.stepFrames(29);
          if (shade.state !== SHADE_STATE.HANG) problems.push(`a pull-up under ${lidTag} left the hang (state ${shade.state})`);
          if (shade.scuffs - scuffs !== 1) problems.push(`a pull-up blocked by ${lidTag} scuffed ${shade.scuffs - scuffs} times, want 1`);
          if (shade.feetY > lip.max.y - 0.5) problems.push(`the body went up through ${lidTag}`);
          press(h, 'ControlLeft');
          h.stepFrames(1);
          h.input.clearEdges();
          h.stepFrames(59);
          h.input.clearAll();
          if (shade.state !== SHADE_STATE.GROUND || Math.abs(shade.feetY - ground) > 0.05) problems.push(`crouch from the hang under ${lidTag} did not drop to the floor (state ${shade.state}, feet ${shade.feetY.toFixed(2)})`);
        }
        lidded = `${lipTag} under ${lidTag} (${(lid.min.y - lip.max.y).toFixed(2)}m of room) hangs, its pull-up scuffs once and crouch drops`;
      }

      shade.reset(h.map.shadeSpawns[0]);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `hanging from ${tag} the feet are ${S.hangDrop}m under the lip, the capsule's top below it and the gloves drawn at it, arms straight up; ${lidded}`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-hanging-glove-holds-the-lip-at-every-phase-of-the-breath',
    spec: 'Section 6.1, amended (20.4; B8) / H33, H38',
    name: 'Hanging at full stretch, the drawn glove stays on the lip at every phase of the Shade\'s breath - not only at the phase the run arrived in',
    // No `glSync`: nothing here renders. The glove is a world position off the
    // matrix, so a whole cycle costs a few hundred `updateVisual` calls and no
    // `readPixels` at all - which is what lets this sample the cycle where
    // tests/breath.js can only afford eight reads of the reference buffer.
    run: (h) => {
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
      const shade = h.shade;
      const problems = [];

      const hang = hangAtGroundLedge(h, SWEEP_SETTLE_FRAMES);
      if (!hang.spot || !hang.hung) {
        shade.reset(h.map.shadeSpawns[0]);
        return {
          pass: false,
          detail: hang.spot
            ? `a tap at ${hang.tag} did not hang (state ${shade.state}), so there was no hanging glove to read`
            : 'no hangable ground-level ledge was found',
        };
      }

      // A sample every eighth of a breath, advanced the way the game advances
      // it - `updateVisual` at the fixed step, so the eased lift lags exactly
      // as it does in a frame rather than being teleported to a phase.
      const frames = Math.max(1, Math.round((BREATH_SECONDS / PHASES) * 60));
      const seen = [];
      for (let phase = 0; phase < PHASES; phase++) {
        for (let i = 0; i < frames; i++) shade.updateVisual(1 / 60);
        seen.push(hangingGloveY(shade) - hang.top);
      }
      // Drawing a body does not step the simulation, so this cannot change -
      // and if it ever does, the readings are not all of one pose and the
      // worst of them is about a body that let go.
      if (shade.state !== SHADE_STATE.HANG) {
        problems.push(`the body left the hang during the sweep (state ${shade.state}), so the readings are not all of one pose`);
      }

      // ------------------------------------------------------------------
      // The worst phase, which is the whole point: a clause that holds at
      // one arbitrary phase of a 7-second cycle is a clause nobody has
      // bounded. Measured from a settled pose the offset runs -0.014m to
      // +0.066m, so 0.066m of 0.15m - 2.26x, and 44% of it spent.
      // ------------------------------------------------------------------
      const worst = Math.max(...seen.map((d) => Math.abs(d)));
      const ride = Math.max(...seen) - Math.min(...seen);
      if (worst > GLOVE_ON_LIP) {
        problems.push(`the worst of ${PHASES} phases draws the hanging glove ${worst.toFixed(3)}m off the lip, over ${GLOVE_ON_LIP}m`);
      }
      // And the control, without which the clause above is eight readings of
      // one phase: the glove really rode the breath inside this window.
      if (Math.abs(ride - MEASURED_RIDE) > RIDE_TOLERANCE) {
        problems.push(`over ${PHASES} phases the glove rode ${ride.toFixed(4)}m against the ${MEASURED_RIDE}m this clause was measured at; the margin is the product of hangDrop, the arm and the breath, and one of the three has moved`);
      }

      shade.reset(h.map.shadeSpawns[0]);
      const readings = seen.map((d) => `${d >= 0 ? '+' : ''}${d.toFixed(3)}`).join(' ');
      const left = worst > 0
        ? `${(GLOVE_ON_LIP / worst).toFixed(2)}x, ${Math.round((1 - worst / GLOVE_ON_LIP) * 100)}% of the tolerance left`
        : 'on the lip exactly';
      const line = `hanging at ${hang.tag}, lip ${hang.top.toFixed(2)}m: ${PHASES} phases of a ${BREATH_SECONDS.toFixed(2)}s breath,`
        + ` glove-lip ${readings}; worst ${worst.toFixed(3)}m of ${GLOVE_ON_LIP}m (${left}), rode ${ride.toFixed(3)}m`;
      return { pass: problems.length === 0, detail: problems.length === 0 ? line : `${problems.join('; ')} [${line}]` };
    },
  });
}
