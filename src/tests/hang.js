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
 * of a cycle), but the whole band sits a centimetre higher. Eight phases are
 * ample for *this* quantity - the dense sweep's worst is 0.0663m against the
 * eight-phase 0.066m, because an offset in metres is continuous where a pixel
 * count is not, which is exactly why H34 needed thirty-two phases at 8m and
 * this needs eight.
 *
 * **H40 found which settle that centimetre is, and it is not the pose.** There
 * are two eases between a grab and the glove's world height, and H38 named the
 * faster one. The pose blend is `POSE_BLEND`, 0.2s, **twelve frames** to
 * 99.9%, and it is innocent: the torso's residual against the live breath -
 * `torso.y - (baseY + lift)`, which is exactly the part of the glove's height
 * that is not the breath - never exceeds **0.00061m at any frame**, frame 1
 * included. The slow one is the mesh's own chase, `_smoothPosition` lerped at
 * `positionSmoothing()`, **0.1423 a frame and 45 frames** to 99.9%; a grab
 * lifts the capsule about a metre, so at frame 30 the drawn body is still
 * **9.3mm (plant) and 8.3mm (yard)** below where it is going. That is the
 * centimetre, it is why the sweep's 150 frames was right, and it is what the
 * shipped clause used to read at thirty. Both clauses settle `SETTLE_FRAMES`
 * now, and `the-hang-pose-has-arrived-before-the-glove-is-read` holds the
 * count against the slower law.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { POSE, HANG_ARM_ANGLE, positionSmoothing } from '../entities/agentvisual.js';
import { POSE_BLEND } from '../entities/pose.js';
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
 * Frames of `updateVisual` after a grab before **either** check reads the
 * glove, and the quantity they therefore read: the hang, at whatever phase of
 * the breath the run arrived in.
 *
 * One constant and not two since H40, which is the queue's own option 1: the
 * shipped clause read at thirty frames and the sweep at a hundred and fifty,
 * so the two of them were reading the same world position in two different
 * states of arrival and only one of them was the hang.
 *
 * A hundred and fifty, argued from the **slower** of the two eases between a
 * grab and this reading. The pose blend is the faster and the one H38 named -
 * `POSE_BLEND` 0.2s, twelve frames to 99.9%, with the torso's residual against
 * the live breath never over 0.00061m at any frame. The mesh's own chase is the
 * slow one: `_smoothPosition` closes `positionSmoothing(1/60)` = 0.1423 of the
 * gap a frame, which is **45 frames** to 99.9%, and a grab lifts the capsule
 * about a metre. Measured from the grab, that gap is 0.93m (plant) and 0.83m
 * (yard), still **9.3mm and 8.3mm** at frame thirty, under a millimetre at 45
 * and under a tenth of one at 60. So thirty frames drew the body 9mm below
 * where it was going and the glove's offset carried it; a hundred and fifty is
 * 3.3 of those eases, with the gap at zero to five decimal places.
 */
const SETTLE_FRAMES = 150;

/** Eight phases of one breath, sampled the way `tests/breath.js` samples them. */
const PHASES = 8;

/**
 * H40's bounds for the arrival check, every one measured on both maps.
 *
 * `SETTLE_MARGIN` is the relation `SETTLE_FRAMES` is argued from: at least this
 * many of the **slowest** ease's own time-to-99.9%, which the check computes
 * from `positionSmoothing()` rather than carrying a copy of 45. 150 frames is
 * 3.3 of them, so 2.0 leaves room for a smoothing slowed by half before
 * anybody has to think again. `ARRIVAL_MARGIN` holds the same margin
 * behaviourally, against the frame the check watches the gap close for itself -
 * two clauses, because there are two ways to lose it: slow the law's constant,
 * or change the easing and leave the constant alone.
 *
 * `SMOOTH_ARRIVED` is 0.0005m against a gap that reads 0.00000m at
 * `SETTLE_FRAMES` and closes under 0.0005m around frame 50. `POSE_SETTLED` is
 * 0.002m against a worst of 0.00061m, and that residual is a steady-state lag
 * and not a transient: the torso starts where the breath already wanted it, so
 * the ease only ever has the sinusoid to chase. `ARM_ARRIVED` is 1e-3 rad
 * against 9.6e-8 at frame 30 and 3e-10 by 40 - the error falls by 0.5623 a
 * frame, so this is five orders of room on something exponential.
 * `UNSETTLED_*` are the control's floor, from a gap of 0.71-0.80m, an arm 1.72
 * rad off and a glove 1.49-1.58m off the lip one frame after the grab.
 */
const SETTLE_MARGIN = 2.0;
const ARRIVAL_MARGIN = 1.5;
const SMOOTH_ARRIVED = 0.0005;
const POSE_SETTLED = 0.002;
const ARM_ARRIVED = 1e-3;
const UNSETTLED_SMOOTH = 0.5;
const UNSETTLED_ARM = 1.0;
const UNSETTLED_GLOVE = 0.5;

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
        // whatever phase of the breath the run arrived in - and since H40 the
        // phase is the only thing about it that is not settled, because it
        // waits the same `SETTLE_FRAMES` the sweep does. The check below
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

      const hang = hangAtGroundLedge(h, SETTLE_FRAMES);
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

  debugTools.registerAutoTest({
    id: 'the-hang-pose-has-arrived-before-the-glove-is-read',
    spec: 'Section 6.1, amended (20.4; B8) / H38, H40',
    name: 'The drawn body has finished arriving at the hang before either clause reads the glove, with the frame count argued from the slowest ease and not the fastest',
    // No `glSync`: nothing here renders either. Everything below is a rotation
    // and two group positions off the matrix.
    run: (h) => {
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
      const shade = h.shade;
      const problems = [];

      // 1. The relation, first, because it holds without a body at all: the
      //    frames both clauses wait must be a multiple of the SLOWEST ease's
      //    own time to 99.9%, computed from the law rather than copied from
      //    its answer. H38 argued this count from the pose blend, which is the
      //    faster of the two by nearly four times, and a count argued from the
      //    fast one is how thirty frames came to look settled (H40).
      const smoothingPerFrame = positionSmoothing(1 / 60);
      const smoothFrames = Math.log(0.001) / Math.log(1 - smoothingPerFrame);
      const blendFrames = POSE_BLEND * 60;
      const slowest = Math.max(smoothFrames, blendFrames);
      if (SETTLE_FRAMES < slowest * SETTLE_MARGIN) {
        problems.push(`the glove is read ${SETTLE_FRAMES} frames after a grab, and the slowest ease into that reading takes`
          + ` ${slowest.toFixed(0)} frames to 99.9% (the mesh's chase at ${smoothingPerFrame.toFixed(4)} a frame,`
          + ` against the pose blend's ${blendFrames.toFixed(0)}), so the count is under the ${SETTLE_MARGIN}x it is argued from`);
      }

      const hang = hangAtGroundLedge(h, 0);
      if (!hang.spot || !hang.hung) {
        shade.reset(h.map.shadeSpawns[0]);
        return {
          pass: false,
          detail: hang.spot
            ? `a tap at ${hang.tag} did not hang (state ${shade.state}), so there was no arrival to watch`
            : 'no hangable ground-level ledge was found',
        };
      }
      const parts = shade.mesh.userData.parts;
      // The two gaps, named apart because H38 and H40's own first answer each
      // measured one of them and concluded about the other.
      const meshGap = () => Math.abs(shade._smoothPosition.y - shade.position.y);
      const poseGap = () => Math.abs(parts.torso.position.y
        - (parts.torso.userData.baseY + Math.sin(shade._breathTime * POSE.breath.rate) * POSE.breath.lift));
      const armGap = () => Math.max(
        Math.abs(parts.armL.rotation.x - HANG_ARM_ANGLE),
        Math.abs(parts.armR.rotation.x - HANG_ARM_ANGLE)
      );

      // 2. The control, taken BEFORE the settle and asserted, without which
      //    every clause below is satisfied by a body that never moved: one
      //    frame in, the mesh is most of a metre under the capsule, the arms
      //    are nowhere near the hang and the glove is nowhere near the lip.
      shade.updateVisual(1 / 60);
      const meshAtOne = meshGap();
      const armAtOne = armGap();
      const gloveAtOne = Math.abs(hangingGloveY(shade) - hang.top);
      if (meshAtOne < UNSETTLED_SMOOTH) {
        problems.push(`one frame after the grab the drawn body is already within ${meshAtOne.toFixed(3)}m of the capsule,`
          + ` inside the ${UNSETTLED_SMOOTH}m this control assumes; there is no arrival here to watch`);
      }
      if (armAtOne < UNSETTLED_ARM) {
        problems.push(`one frame after the grab the arms are already ${armAtOne.toFixed(3)} rad from the hang angle,`
          + ` inside the ${UNSETTLED_ARM} rad this control assumes`);
      }
      if (gloveAtOne < UNSETTLED_GLOVE) {
        problems.push(`one frame after the grab the glove is already ${gloveAtOne.toFixed(2)}m from the lip,`
          + ` inside the ${UNSETTLED_GLOVE}m this control assumes`);
      }

      // 3. The arrival, watched rather than assumed, and the worst each gap
      //    reaches after it. `meshArrived` is the number H38's account needed
      //    and did not have: the frame the DRAWN body stops moving toward the
      //    capsule, which is 45-ish and not 12, and which thirty frames is
      //    inside.
      let meshArrived = -1;
      let worstPose = poseGap();
      for (let f = 2; f <= SETTLE_FRAMES; f++) {
        shade.updateVisual(1 / 60);
        if (meshArrived < 0 && meshGap() <= SMOOTH_ARRIVED) meshArrived = f;
        worstPose = Math.max(worstPose, poseGap());
      }
      if (meshArrived < 0) {
        problems.push(`the drawn body is still ${meshGap().toFixed(5)}m from the capsule at frame ${SETTLE_FRAMES},`
          + ` where the glove is read, so both clauses are reading a body on its way to the hang`);
      } else if (meshArrived > SETTLE_FRAMES / ARRIVAL_MARGIN) {
        problems.push(`the drawn body reaches the capsule at frame ${meshArrived} and the glove is read at`
          + ` ${SETTLE_FRAMES}, under the ${ARRIVAL_MARGIN}x margin this count is argued from`);
      }
      const meshAtRead = meshGap();
      const armAtRead = armGap();
      if (meshAtRead > SMOOTH_ARRIVED) {
        problems.push(`at frame ${SETTLE_FRAMES} the drawn body is ${meshAtRead.toFixed(5)}m off the capsule, over ${SMOOTH_ARRIVED}m`);
      }
      if (armAtRead > ARM_ARRIVED) {
        problems.push(`at frame ${SETTLE_FRAMES} the arms are ${armAtRead.toExponential(2)} rad off the hang angle`);
      }
      // And the pose, which H38 blamed and H40 cleared. It is asserted anyway,
      // because "the pose is innocent" is a measurement and not a belief, and
      // a pose that did start lagging should say so here rather than in the
      // glove's own tolerance.
      if (worstPose > POSE_SETTLED) {
        problems.push(`the torso's ease was ${worstPose.toFixed(5)}m from where the breath wanted it, over ${POSE_SETTLED}m;`
          + ` the glove's height then carries a pose that is still moving and not only the breath`);
      }

      shade.reset(h.map.shadeSpawns[0]);
      const line = `hanging at ${hang.tag}: one frame in, the drawn body is ${meshAtOne.toFixed(2)}m under the capsule with the arms`
        + ` ${armAtOne.toFixed(2)} rad off the hang angle and the glove ${gloveAtOne.toFixed(2)}m off the lip; the body reaches the`
        + ` capsule at frame ${meshArrived} and is ${meshAtRead.toFixed(5)}m off it at ${SETTLE_FRAMES}`
        + ` (${(SETTLE_FRAMES / slowest).toFixed(1)} of the ${slowest.toFixed(0)}-frame ease, the slowest of the two),`
        + ` the arms ${armAtRead.toExponential(2)} rad off, the torso within ${worstPose.toFixed(5)}m of the breath throughout`;
      return { pass: problems.length === 0, detail: problems.length === 0 ? line : `${problems.join('; ')} [${line}]` };
    },
  });
}
