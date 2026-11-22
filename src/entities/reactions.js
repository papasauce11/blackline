/**
 * BLACKLINE - entities/reactions.js
 *
 * How a body is drawn when it is hit (J7): the Warden's head and rifle arms
 * jolt away from a blow, its chest rocks back when a taser lands, and the
 * Shade's head and shoulders jolt from a round. All of it is presentation. It
 * runs inside `updateVisual` on the wall clock and writes the head, the two
 * arm groups and, for a stagger only, the Warden's chest - nothing the
 * simulation reads, and nothing either camera reads: both rigs are built from
 * `pitch`, `yaw` and the capsule, so a body that flinches moves no picture.
 * A shake of the screen is another job.
 *
 * **What it may write, and why not the torso.** `idlemotion.js` found that
 * `breathcensus.js` holds the Shade's torso pitch and the Warden's chest
 * height still against a breath, because they are what make "the breath is a
 * position" and "the Warden's figure checks are phase-free" provable. A hit is
 * not a breath, and those proofs are of a body at rest: nothing in them runs
 * through a hit. So the Warden's chest *pitch* may rock for a stagger, and
 * does; the Shade's flinch is the head and arms alone, which asks nothing of
 * the census and is all that reads on a figure that small.
 *
 * **Taken out before the ease and put back after it.** `easePose` carries
 * every group a fraction of the way to a target from where the group is, so an
 * offset left on a group would be eased toward as though it were the pose and
 * a 0.25s jolt would be gone in a blend's length. The frame's own offsets are
 * subtracted first, the ease runs on the pose alone, and the new offsets go on
 * after - one call, `reactEase`, in place of `easePose` at both bodies.
 *
 * **Pure functions of the time since the hit.** A flinch is `(1 - t/T)^2`
 * along the direction away from the blow, full on the first frame and gone at
 * `T`; a stagger is a quarter-sine up to its peak and a half-cosine down. A
 * second hit restarts the clock and replaces the direction, so a burst never
 * stacks past one amplitude. The per-body record (the clocks, the direction
 * and the offsets last applied) is in a WeakMap, as `idlemotion.js` keeps its
 * own: a collected body takes its record with it.
 *
 * **Still behind a menu.** The clocks advance only while `idlemotion.js` says
 * a round is on screen, and a frame with no time advances nothing, so a pause
 * or a menu holds a body mid-flinch rather than finishing it.
 *
 * Layering (Section 3.1): imports config, pose.js and idlemotion.js. The
 * emitter's events reach here through `wiring.js`, never by an import of it.
 */

import { CONFIG } from '../config.js';
import { easePose } from './pose.js';
import { idleLifeState } from './idlemotion.js';

const R = CONFIG.reactions;

/** The per-body record: clocks (Infinity is "not reacting"), the push direction, and the offsets on the groups now. */
const BODIES = new WeakMap();
function bodyOf(actor) {
  let body = BODIES.get(actor);
  if (!body) {
    body = {
      hit: Infinity, stagger: Infinity, fwd: -1, lat: 0, strength: 1,
      headX: 0, headZ: 0, armX: 0, leanX: 0,
    };
    BODIES.set(actor, body);
  }
  return body;
}

/** The Warden's figure has a chest; the Shade's a torso. The Warden's flinch is the larger. */
const isWarden = (actor) => !!actor.mesh.userData.parts.chest;

/** The share of a flinch left `t` seconds after the blow: all of it at once, none at `time`. */
export function flinchEnvelope(t, time) {
  if (!(t < time)) return 0;
  const left = 1 - t / time;
  return left * left;
}

/** The share of a stagger at `t`: up to its peak by a quarter-sine, down to nothing at `time` by a half-cosine. */
export function staggerEnvelope(t) {
  const { peak, time } = R.stagger;
  if (!(t < time)) return 0;
  if (t < peak) return Math.sin((Math.PI / 2) * (t / peak));
  return 0.5 * (1 + Math.cos((Math.PI * (t - peak)) / (time - peak)));
}

/**
 * A blow on `actor`, from a world position (or none, which is a blow from in
 * front). Restarts the flinch: the clock goes to zero and the direction is the
 * new blow's, so a second hit never adds to the first.
 *
 * @param {object} actor the Shade or the Warden
 * @param {{x:number, z:number}|null} from where it came from
 * @param {number} [strength] scales both amplitudes
 */
export function flinch(actor, from, strength = 1) {
  const body = bodyOf(actor);
  let fwd = -1;
  let lat = 0;
  if (from) {
    const dx = actor.position.x - from.x;
    const dz = actor.position.z - from.z;
    const length = Math.hypot(dx, dz);
    if (length > 1e-6) {
      // The push as the body sees it: along its facing (-sin, -cos) and out to its right (cos, -sin).
      fwd = (-Math.sin(actor.yaw) * dx - Math.cos(actor.yaw) * dz) / length;
      lat = (Math.cos(actor.yaw) * dx - Math.sin(actor.yaw) * dz) / length;
    }
  }
  body.fwd = fwd;
  body.lat = lat;
  body.strength = strength;
  body.hit = 0;
}

/** A taser's shock: the chest rocks back over whatever pose the stun is easing into. */
export function stagger(actor) {
  bodyOf(actor).stagger = 0;
}

/** A new round or a respawn: no reaction in flight. The offsets on the groups come off at the next ease. */
export function clearReactions(actor) {
  const body = bodyOf(actor);
  body.hit = Infinity;
  body.stagger = Infinity;
}

/**
 * This frame's offsets into the actor's record, and its clocks moved on.
 * Held, not finished, where no round is on screen or no time has passed.
 */
function step(actor, wallDt) {
  const r = bodyOf(actor);
  const dt = idleLifeState().live && wallDt > 0 ? wallDt : 0;
  const F = isWarden(actor) ? R.flinch : R.shade;
  const flinching = flinchEnvelope(r.hit, F.time) * r.strength;
  r.headX = -r.fwd * F.head * flinching;
  r.headZ = -r.lat * F.head * flinching;
  r.armX = -r.fwd * F.arms * flinching;
  r.leanX = R.stagger.lean * staggerEnvelope(r.stagger);
  r.hit += dt;
  r.stagger += dt;
  return r;
}

/**
 * `easePose`, with this frame's reactions on top. Call it where `easePose` was.
 *
 * @param {object} actor the Shade or the Warden
 * @param {object} body the group the head and arms hang from (torso or chest)
 * @param {object} parts the figure's named groups
 * @param {object} pose the target record
 * @param {number} k the ease's share of the way this frame
 * @param {number} wallDt unscaled frame delta
 */
export function reactEase(actor, body, parts, pose, k, wallDt) {
  const last = bodyOf(actor);
  parts.head.rotation.x -= last.headX;
  parts.head.rotation.z -= last.headZ;
  parts.armL.rotation.x -= last.armX;
  parts.armR.rotation.x -= last.armX;
  body.rotation.x -= last.leanX;
  easePose(body, parts, pose, k);

  const r = step(actor, wallDt);
  parts.head.rotation.x += r.headX;
  parts.head.rotation.z += r.headZ;
  parts.armL.rotation.x += r.armX;
  parts.armR.rotation.x += r.armX;
  body.rotation.x += r.leanX;
}
