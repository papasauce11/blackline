/**
 * BLACKLINE - tests/reactions.js
 *
 * AUTO suite (J7): a body that is hit is drawn hit, and nothing about the
 * picture moves for it. The Warden's head and rifle arms jolt away from a
 * knife, its chest rocks back when a taser lands and then sags into the stun,
 * the Shade's head and shoulders jolt from a round - and in every case the
 * camera is where it was (`entities/reactions.js`; a screen shake is another
 * job, and this is the check that says this one is not it).
 *
 * **Read off the meshes, driven the way a player drives.** Every number is a
 * part's own rotation, read after `updateVisual` as `idlelife.js` reads its
 * nodes, and never the reactions module's return value - the check is about
 * the drawn body. The knife is `KeyF` and the taser `Digit3` on the Shade, held
 * to the one route a player's key takes. The Shade's wound is
 * `combat.applyDamage`, the public entry a frag and `feedback.js` use and the
 * call combat's own shot ends in: no input makes the Warden fire at a Shade
 * that is not the one being driven, and a shot is exactly "damage with a
 * source" by the time the body is told.
 *
 * **A reaction is a difference, read against the body's own rest.** A body
 * standing with nothing asked of it has fixed part rotations (the breath moves
 * heights, `idlemotion.js`), so the offset is the rotation less its reading
 * just before the blow, and it is signed by geometry: the push is along the
 * line from the blow through the body, resolved on the body's facing, and the
 * check works that out from the two positions and not from the module.
 *
 * **The stagger is read against the carry, not the sag.** The stunned pose is
 * a forward lean, and the ease into it only ever travels one way, from the
 * carry down to the sag - so a chest further *back* than it began has been
 * pushed there by something else, and that is what a stagger is. "Beyond the
 * stunned pose" would pass for the plain ease alone.
 *
 * **The camera is read as the world sees it**, `getWorldPosition` and
 * `getWorldQuaternion` off the one camera under each owner, across the frames
 * of a flinch against the frame before the blow: first the Shade's third-person
 * boom, then the Warden's eye, where a body that is hidden still flinches and
 * the picture must still not.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { WARDEN_STATE } from '../entities/enforcer.js';
import { clearLane } from './lanes.js';
import { quiesce } from './pixels.js';
import { frame } from './strikedrive.js';

const R = CONFIG.reactions;
const K = CONFIG.combat.knife;

const SEED = 7007;
/** Frames a body gets to come to rest, and a camera to stop easing, before a reading is a baseline. */
const SETTLE = 40;
const CAMERA_SETTLE = 240;
/** Frames: "within 3 frames" of a blow, half a second, six tenths, a second. */
const SOON = 3;
const HALF_SECOND = 30;
const TASER_WINDOW = 18;
const TASER_SETTLED = 36;
const TASER_LONG = 60;
const FLINCH_FRAMES = 12;
/** The lane: the taser's four metres and the one beyond it. */
const KNIFE_GAP = 1.2;
const TASER_GAP = 4;
const SHOT_GAP = 6;
/** Back under this and a reaction is over, radians. */
const GONE = 1e-3;
/** Equal to this and a held value has not moved, and a camera has not either. */
const STILL = 1e-9;
/** The least a stagger leans a chest back past the carry, radians. */
const LEAN_PAST_CARRY = 0.1;

const fmt = (n, digits = 3) => n.toFixed(digits);

/** `{x, z}` of a lane's foot `metres` along it. */
const along = (lane, metres) => ({ x: lane.x + lane.dx * metres, y: lane.y, z: lane.z + lane.dz * metres });

/**
 * The Shade at the foot of the lane facing down it, the Warden `gap` metres on
 * facing back at her: she is in front of it, so a knife is an arc and not a
 * takedown, and the push from her is straight back through its chest.
 */
function face(h, lane, gap) {
  h.shade.reset({ position: along(lane, 0), yaw: lane.yaw });
  h.warden.reset({ position: along(lane, gap), yaw: lane.yaw + Math.PI });
  h.shade.pitch = 0;
  h.warden.pitch = 0;
}

/** One real `renderFrame`, which is where `main.js` tells the bodies whether a round is on screen. */
function tell(h, onScreen) {
  h.resetPresentation();
  if (!onScreen) h.setPaused(true);
  h.renderFrame(1 / 60);
}

/** Frames with nothing held. */
function settle(h, frames) {
  for (let i = 0; i < frames; i++) frame(h);
}

/** The drawn rotations a reaction writes, off the figure's own nodes. */
function pose(actor) {
  const p = actor.mesh.userData.parts;
  const body = p.chest || p.torso;
  return { head: p.head.rotation.x, roll: p.head.rotation.z, armL: p.armL.rotation.x, armR: p.armR.rotation.x, lean: body.rotation.x };
}

/** What `to` is from `from`, part by part. */
function offset(to, from) {
  return { head: to.head - from.head, roll: to.roll - from.roll, armL: to.armL - from.armL, armR: to.armR - from.armR, lean: to.lean - from.lean };
}

/**
 * Which way a blow from `from` pushes `body`, along the body's facing: -1 when
 * it comes from straight ahead (pushed back), +1 from behind. The sign a head
 * or arm offset must carry is its opposite - back is up for a head and forward
 * for an arm on this rig.
 */
function pushAlong(body, from) {
  const dx = body.position.x - from.position.x;
  const dz = body.position.z - from.position.z;
  const length = Math.hypot(dx, dz);
  return (-Math.sin(body.yaw) * dx - Math.cos(body.yaw) * dz) / length;
}

/** The camera as the world sees it: a position and a rotation, fresh copies. */
function eye(h) {
  return {
    p: h.camera.getWorldPosition(h.camera.position.clone()),
    q: h.camera.getWorldQuaternion(h.camera.quaternion.clone()),
  };
}

/** How far two cameras differ: the largest of the position's and the rotation's component differences. */
function moved(a, b) {
  return Math.max(
    Math.abs(a.p.x - b.p.x), Math.abs(a.p.y - b.p.y), Math.abs(a.p.z - b.p.z),
    Math.abs(a.q.x - b.q.x), Math.abs(a.q.y - b.q.y), Math.abs(a.q.z - b.q.z), Math.abs(a.q.w - b.q.w)
  );
}

/** Frames until the camera stops easing, or null if it has not by `CAMERA_SETTLE`: "unchanged" reads nothing off a camera still arriving. */
function cameraAtRest(h) {
  let last = eye(h);
  for (let i = 0; i < CAMERA_SETTLE; i++) {
    frame(h);
    const now = eye(h);
    if (i > 10 && moved(now, last) < STILL * 0.001) return now;
    last = now;
  }
  return null;
}

/**
 * Hit `actor` and watch `frames` frames: the camera against the one before the
 * blow, and the pose against its own rest. Returns the worst camera movement
 * and the offsets of each frame.
 */
function hitAndWatch(h, actor, hitter, frames) {
  const rest = cameraAtRest(h);
  if (!rest) return null;
  const before = pose(actor);
  h.combat.applyDamage(actor, 10, actor === h.shade ? 'shade' : 'warden', actor === h.shade ? 'body' : 'knife', {
    x: hitter.position.x, y: hitter.feetY, z: hitter.position.z,
  });
  let worst = 0;
  const offsets = [];
  for (let i = 0; i < frames; i++) {
    frame(h);
    worst = Math.max(worst, moved(eye(h), rest));
    offsets.push(offset(pose(actor), before));
  }
  return { worst, offsets };
}

/** The best signed offset of a part across the frames given: the largest in the direction `sign`. */
function best(offsets, key, sign) {
  return Math.max(...offsets.map((o) => sign * o[key]));
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-hit-body-flinches-a-tased-warden-staggers-and-no-camera-moves',
    spec: 'Section 4 / J7',
    name: 'A knife hit jolts the Warden\'s head and arms away from the blow and is gone in half a second; a taser rocks its chest back past the carry before it sags into the stun; a round jolts the Shade\'s head and arms; a pause holds a flinch where it is; and the camera does not move for any of them, in third person or first',
    run: (h) => {
      const problems = [];
      const readings = [];
      const restore = quiesce(h);
      try {
        const lane = clearLane(h, TASER_GAP + 1);
        if (!lane) return { pass: false, detail: `no clear ${TASER_GAP + 1}m lane on this map to stand two bodies on` };
        const own = (role) => {
          h.initMatch({ mode: 'competitive', role, ai: false, objective: false, seed: SEED });
          h.resetPresentation();
          h.input.clearAll();
        };

        // ----------------------------------------------------------------
        // (a): a knife hit, by the key. Within three frames the head and both
        // arms are away from the Shade by half their configured swing, and by
        // half a second they are back.
        // ----------------------------------------------------------------
        own('shade');
        face(h, lane, KNIFE_GAP);
        tell(h, true);
        settle(h, SETTLE);
        const wardenRest = pose(h.warden);
        settle(h, 5);
        const drift = Math.abs(pose(h.warden).head - wardenRest.head) + Math.abs(pose(h.warden).armL - wardenRest.armL);
        if (drift > STILL) problems.push(`(a) the Warden's head and arm moved ${drift.toExponential(2)} over five frames at rest, so an offset read against its rest says nothing`);
        const hits = [];
        const stopHits = h.emitter.on('combat:knife-hit', () => hits.push(1));
        const health = h.warden.health;
        h.input.pressedCodes.add('KeyF');
        const knife = [];
        for (let i = 0; i < HALF_SECOND; i++) {
          frame(h);
          knife.push(offset(pose(h.warden), wardenRest));
        }
        stopHits();
        if (hits.length !== 1 || !(h.warden.health < health)) problems.push(`(a) the knife key landed ${hits.length} hits and left the Warden at ${h.warden.health} of ${health}, so there was no blow to read`);
        const away = -pushAlong(h.warden, h.shade);
        const soon = knife.slice(0, SOON);
        const head = best(soon, 'head', away);
        const armL = best(soon, 'armL', away);
        const armR = best(soon, 'armR', away);
        if (!(head >= R.flinch.head / 2)) problems.push(`(a) within ${SOON} frames of a knife hit the Warden's head is ${fmt(head)} rad away from the Shade, want at least ${fmt(R.flinch.head / 2)}`);
        if (!(armL >= R.flinch.arms / 2) || !(armR >= R.flinch.arms / 2)) problems.push(`(a) within ${SOON} frames the Warden's arms are ${fmt(armL)} and ${fmt(armR)} rad away from the Shade, want at least ${fmt(R.flinch.arms / 2)} each`);
        const last = knife[HALF_SECOND - 1];
        const left = Math.max(Math.abs(last.head), Math.abs(last.armL), Math.abs(last.armR), Math.abs(last.roll));
        if (!(left < GONE)) problems.push(`(a) half a second after the knife hit the Warden is still ${left.toExponential(2)} rad off its rest, want under ${GONE}`);
        readings.push(`(a) a knife hit swung the Warden's head ${fmt(head)} and arms ${fmt(armL)}/${fmt(armR)} rad away within ${SOON} frames (asked ${R.flinch.head}/${R.flinch.arms}, floor half), and ${left.toExponential(1)} rad is left at 0.5s`);

        // ----------------------------------------------------------------
        // (b): a taser, by the key. The chest goes further back than the carry
        // it started from, which the ease into the sag never does, and by 0.6s
        // it is where the stun leaves it.
        // ----------------------------------------------------------------
        own('shade');
        face(h, lane, TASER_GAP);
        tell(h, true);
        settle(h, SETTLE);
        const carry = pose(h.warden).lean;
        h.input.pressedCodes.add('Digit3');
        const leans = [];
        for (let i = 0; i < TASER_LONG; i++) {
          frame(h);
          leans.push(pose(h.warden).lean);
        }
        if (h.warden.state !== WARDEN_STATE.STUNNED) problems.push(`(b) the taser key left the Warden ${h.warden.state}, want stunned`);
        const settled = leans[TASER_LONG - 1];
        const peak = Math.max(...leans.slice(0, TASER_WINDOW));
        if (!(settled < carry - LEAN_PAST_CARRY)) problems.push(`(b) the stunned chest settled at ${fmt(settled)} against a carry of ${fmt(carry)}, so there is no sag for a stagger to rock back over`);
        if (!(peak >= carry + LEAN_PAST_CARRY)) problems.push(`(b) over the first ${TASER_WINDOW} frames of a stun the chest reached ${fmt(peak)} against a carry of ${fmt(carry)}, want at least ${LEAN_PAST_CARRY} rad further back than it began`);
        const late = Math.abs(leans[TASER_SETTLED - 1] - settled);
        if (!(late < GONE)) problems.push(`(b) at 0.6s the chest is ${late.toExponential(2)} rad from the stunned pose it settles to, want under ${GONE}`);
        readings.push(`(b) a taser rocked the chest to ${fmt(peak)} rad against a carry of ${fmt(carry)} (asked ${R.stagger.lean} over the sag), into a stunned pose of ${fmt(settled)} that it is ${late.toExponential(1)} rad off at 0.6s`);

        // ----------------------------------------------------------------
        // (c): a round on the Shade, standing with nothing held, in third
        // person; then a blow on the Warden through its own eyes. The body
        // flinches and the camera is where it was, to 1e-9, every frame.
        // ----------------------------------------------------------------
        own('shade');
        face(h, lane, SHOT_GAP);
        tell(h, true);
        h.setCameraOwner('shade');
        const third = hitAndWatch(h, h.shade, h.warden, FLINCH_FRAMES);
        if (!third) {
          problems.push(`(c) the Shade's camera had not stopped easing after ${CAMERA_SETTLE} frames at rest, so "unchanged" has nothing to be unchanged from`);
        } else {
          const push = -pushAlong(h.shade, h.warden);
          const shadeHead = best(third.offsets, 'head', push);
          const shadeArm = Math.min(best(third.offsets, 'armL', push), best(third.offsets, 'armR', push));
          if (!(shadeHead >= R.shade.head / 2)) problems.push(`(c) a round on the Shade moved her head ${fmt(shadeHead)} rad, want at least ${fmt(R.shade.head / 2)}`);
          if (!(shadeArm >= R.shade.arms / 2)) problems.push(`(c) a round on the Shade moved her arms ${fmt(shadeArm)} rad, want at least ${fmt(R.shade.arms / 2)}`);
          if (!(third.worst <= STILL)) problems.push(`(c) the Shade's third-person camera moved ${third.worst.toExponential(2)} across the frames of her flinch, want 0 to ${STILL}`);
          readings.push(`(c) a round moved the Shade's head ${fmt(shadeHead)} and arms ${fmt(shadeArm)} rad (asked ${R.shade.head}/${R.shade.arms}) and her third-person camera ${third.worst.toExponential(1)}`);
        }

        own('warden');
        face(h, lane, SHOT_GAP);
        tell(h, true);
        h.setCameraOwner('warden');
        const first = hitAndWatch(h, h.warden, h.shade, FLINCH_FRAMES);
        if (!first) {
          problems.push(`(c) the Warden's camera had not stopped easing after ${CAMERA_SETTLE} frames at rest, so "unchanged" has nothing to be unchanged from`);
        } else {
          const jolt = best(first.offsets, 'head', -pushAlong(h.warden, h.shade));
          if (!(jolt >= R.flinch.head / 2)) problems.push(`(c) in first person the hidden Warden's head moved ${fmt(jolt)} rad on a hit, want at least ${fmt(R.flinch.head / 2)}: the flinch did not run, so an unmoved camera proves nothing`);
          if (!(first.worst <= STILL)) problems.push(`(c) the Warden's first-person camera moved ${first.worst.toExponential(2)} across the frames of its flinch, want 0 to ${STILL}`);
          readings.push(`(c) in first person the Warden's head moved ${fmt(jolt)} rad and its camera ${first.worst.toExponential(1)}`);
        }

        // ----------------------------------------------------------------
        // (d): a pause mid-flinch holds it where it is, to the radian, and
        // lifting the pause lets it finish.
        // ----------------------------------------------------------------
        own('shade');
        face(h, lane, KNIFE_GAP);
        tell(h, true);
        settle(h, SETTLE);
        const rest = pose(h.warden);
        h.combat.applyDamage(h.warden, K.damage, 'warden', 'knife', { x: h.shade.position.x, y: h.shade.feetY, z: h.shade.position.z });
        settle(h, 2);
        tell(h, false);
        const held = pose(h.warden);
        let strayed = 0;
        for (let i = 0; i < HALF_SECOND; i++) {
          frame(h);
          const now = pose(h.warden);
          strayed = Math.max(strayed, Math.abs(now.head - held.head), Math.abs(now.armL - held.armL), Math.abs(now.armR - held.armR), Math.abs(now.lean - held.lean));
        }
        const mid = Math.abs(held.head - rest.head);
        if (!(mid > 0.01)) problems.push(`(d) the flinch was ${fmt(mid, 4)} rad when the pause came, so it was not mid-flinch and holding says nothing`);
        if (strayed > STILL) problems.push(`(d) paused mid-flinch the Warden's head and arms moved ${strayed.toExponential(2)} rad over ${HALF_SECOND} frames, want 0`);
        tell(h, true);
        settle(h, HALF_SECOND);
        const after = Math.abs(pose(h.warden).head - rest.head);
        if (!(after < GONE)) problems.push(`(d) half a second after the pause lifted the head is still ${after.toExponential(2)} rad off its rest, want it finished`);
        readings.push(`(d) held at ${fmt(mid, 3)} rad for ${HALF_SECOND} paused frames (moved ${strayed.toExponential(1)}), finished to ${after.toExponential(1)} after`);
      } finally {
        h.input.clearAll();
        h.resetPresentation();
        restore();
      }
      return { pass: problems.length === 0, detail: problems.length ? problems.join('; ') : readings.join('; ') };
    },
  });
}
