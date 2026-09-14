/**
 * BLACKLINE — mapclimb.js
 *
 * Which surfaces are climbable, derived from the geometry and the body alone
 * (Section 5, amended: there are no markings, so this is the whole contract).
 * `GameMap.deriveClimbableSurfaces()` calls it after the level is built, the
 * way `maprooms.js` derives entries and `mapground.js` the Warden's ground.
 */

import { CONFIG } from './config.js';
import { classifyReach } from './physics.js';
import { PROBE_STEP, HAND_HALF, handsOverTop } from './climbprobe.js';

const M = CONFIG.map;
const S = CONFIG.shade;

/** The four horizontal faces of a box, as outward normals. */
const FACES = [
  { nx: 1, nz: 0 },
  { nx: -1, nz: 0 },
  { nx: 0, nz: 1 },
  { nx: 0, nz: -1 },
];

// The hand sweep, as the controller does it (`Shade._probeLedge`): a sample
// every `PROBE_STEP` up from the feet, each one a horizontal ray at the face.
// The constants and the over-the-top test are shared through climbprobe.js
// so the rule cannot see a ledge the hands cannot.

/**
 * Where the body lands once it is over a face, as the controller puts it
 * (`Shade._ledgeDestination`): a radius and 0.3m past the point on the face
 * the hands met. Kept identical for the same reason as the sweep.
 */
const LANDING_FORWARD = S.radius + 0.3;

/**
 * How far in front of the body the hands reach for a face of this rise, as
 * the controller probes it (B5). A rise within standing reach is climbed
 * from the ground, where `_tryClimbFromGround` probes `vaultReach` ahead; a
 * taller one needs the jump and is caught in the air, where `_tryMantle`
 * probes `mantleReach` - 0.15m less. The rule used the longer distance for
 * every rise and so named a jump from the mouth of a duct onto the deck edge
 * 1.41m away, with the duct's own wall 0.3m in front of the hands; the
 * controller, probing 1.29m in the air, met the wall and scuffed.
 */
function handReach(rise) {
  return rise > S.reach.standing ? S.mantleReach : S.vaultReach;
}


/**
 * Decide which surfaces are climbable, from the geometry and the body alone.
 *
 * Section 5, amended: there are no markings, so this is the whole contract.
 * The rule is mechanical and has NO exceptions — no `noClimb`, no tags, no
 * per-box judgement:
 *
 *   a surface is climbable when you could stand on top of it
 *   and the body could reach it from whatever is below.
 *
 * "Stand on top of it" means a top face at least an actor-diameter across in
 * both axes, with crouch headroom where the climb puts the body - at the
 * landing of the approach, not anywhere along the top. It used to be
 * sampled at the box's quarter points, and on a 38m deck slab those can be
 * twenty metres from the face being climbed: B4 met a slab that derived as
 * climbable from a gantry while the only landing was a wall (B4b). "Reach
 * it" means the rise from the surface below is inside `CONFIG.shade.reach`
 * at full stretch — standing reach plus what a jump adds — from a place a
 * body can actually stand and get its hands on the face:
 * `supportApproaches()`, each entry of which has been checked for both.
 *
 * `noClimb` used to opt surfaces out: the office floor to keep the drop shaft
 * one-way, and the whole upper deck except four declared lips. Both are now
 * enforced by the vertical layout instead. The deck is 6m and full reach is
 * 3.8m, so it is unreachable on its own merits and nothing has to say so —
 * which means a future change to a floor height cannot silently turn a
 * one-way route into a two-way one without the census noticing.
 */
export function deriveClimbableSurfaces(collision, ledges) {
  const minSupport = S.radius * 2;
  const fullReach = S.reach.standing + S.reach.jumpBonus;

  ledges.length = 0;

  for (const box of collision.boxes) {
    // The derivation is the only thing that decides this, and it decides it
    // afresh: nothing declared on the box survives, and a re-derivation after
    // the world changes (a check stages a lid) forgets what it said before.
    box.climbable = false;
    box.reachMove = undefined;
    if (!box.solid) continue;
    if (box.max.x - box.min.x < minSupport) continue;
    if (box.max.z - box.min.z < minSupport) continue;

    // The easiest climb on offer: the tallest surface a body can stand on and
    // reach this top from, with room to land. `step` is not a climb: the
    // swept solver carries you over it, and `supportApproaches` never names
    // one.
    let best = null;
    for (const approach of supportApproaches(collision, box)) {
      const move = classifyReach(approach.rise, fullReach);
      if (move === null || move === 'step') continue;
      if (!best || approach.y > best.approach.y) best = { approach, move };
    }
    if (!best) continue;

    box.climbable = true;
    box.reachMove = best.move;
    ledges.push({ box, move: best.move, topY: box.max.y, standY: best.approach.y, rise: best.approach.rise });
  }
}


/**
 * Height of the surface an actor would be standing on to climb this box:
 * the tallest one `supportApproaches()` names. Falls back to the ground plane
 * for a box with no approach at all, so a caller measuring a rise always has
 * a number - but such a box is never climbable, whatever that rise is.
 */
export function supportHeightBelow(collision, box) {
  const candidates = supportCandidates(collision, box);
  return candidates[candidates.length - 1];
}

/**
 * Every height an actor could be standing on to climb this box, lowest
 * first. Always includes the ground plane.
 */
export function supportCandidates(collision, box) {
  const heights = [M.groundY];
  const seen = new Set([M.groundY.toFixed(3)]);
  for (const approach of supportApproaches(collision, box)) {
    const key = approach.y.toFixed(3);
    if (seen.has(key)) continue;
    seen.add(key);
    heights.push(approach.y);
  }
  heights.sort((a, b) => a - b);
  return heights;
}

/**
 * Every place a body could stand to climb this box: a surface below its top,
 * wide enough to stand on, with a spot on it in front of one of the box's
 * faces from which the hands can get onto that face. One entry per
 * (surface, face) pair, the spot being where the test succeeded.
 *
 * This used to be a footprint test - any wide surface whose footprint came
 * within `vaultReach` of the box's counted as "below" it - and that named
 * supports a body could not climb from: a gantry touching a deck slab at one
 * corner, a duct roof diagonally beside a container, a server rack under a
 * roof with three metres of ceiling in between. B3 replaced it with what the
 * controller actually does. A support counts when, standing on it in front of
 * the face at the distance the controller probes from, the body fits and the
 * hand sweep from its feet meets THIS box's face before it meets a ceiling.
 * That is one rule for the map and the controller: a face the sweep cannot
 * reach is not climbable, and nothing has to say so.
 *
 * And the landing fits (B4b): from that spot, the controller puts the body a
 * radius and 0.3m past the face, crouched at least, and if that capsule is
 * inside something the climb is refused at `_commitMove()`. A face under a
 * ceiling, or one whose top is a strip narrower than a body against a wall,
 * has hands on it and nowhere to go, so it is not an approach.
 *
 * Sampled at three points along the approach, so a support that passes
 * under one obstruction, or a face whose top is blocked at one end, still
 * counts elsewhere.
 *
 * @returns {{box: object, y: number, rise: number, x: number, z: number,
 *            nx: number, nz: number}[]}
 */
export function supportApproaches(collision, box) {
  const out = [];
  const minSupport = S.radius * 2;
  const margin = S.vaultReach + S.radius;
  for (const other of collision.boxes) {
    if (other === box || !other.solid) continue;
    // A surface you would merely step off is not one you climb from.
    const rise = box.max.y - other.max.y;
    if (rise < S.reach.stepOver) continue;
    if (other.max.x - other.min.x < minSupport) continue;
    if (other.max.z - other.min.z < minSupport) continue;
    // Anywhere near, before the per-face work.
    if (other.max.x < box.min.x - margin || other.min.x > box.max.x + margin) continue;
    if (other.max.z < box.min.z - margin || other.min.z > box.max.z + margin) continue;

    const depth = handReach(rise);
    for (const face of FACES) {
      const rect = approachRect(box, other, face, depth);
      if (!rect) continue;
      const alongX = face.nx === 0;
      for (const t of [0.5, 0.25, 0.75]) {
        const x = alongX ? rect.x0 + (rect.x1 - rect.x0) * t : (rect.x0 + rect.x1) / 2;
        const z = alongX ? (rect.z0 + rect.z1) / 2 : rect.z0 + (rect.z1 - rect.z0) * t;
        if (!handsReachFace(collision, box, face, x, z, other.max.y, depth)) continue;
        if (!landingFits(collision, box, face, x, z)) continue;
        out.push({ box: other, y: other.max.y, rise, x, z, nx: face.nx, nz: face.nz });
        break;
      }
    }
  }
  return out;
}

/**
 * Where a body's centre can be while standing on `other` in front of `face`
 * of `box`: on the support with the whole footprint over it, clear of the box
 * by a body radius, and no further out than the controller's probe reaches
 * (`depth`, from `handReach`). Null when there is no such place.
 */
function approachRect(box, other, face, depth) {
  const r = S.radius;
  let fx0;
  let fx1;
  let fz0;
  let fz1;
  if (face.nx > 0) {
    fx0 = box.max.x + r; fx1 = box.max.x + r + depth; fz0 = box.min.z; fz1 = box.max.z;
  } else if (face.nx < 0) {
    fx0 = box.min.x - r - depth; fx1 = box.min.x - r; fz0 = box.min.z; fz1 = box.max.z;
  } else if (face.nz > 0) {
    fz0 = box.max.z + r; fz1 = box.max.z + r + depth; fx0 = box.min.x; fx1 = box.max.x;
  } else {
    fz0 = box.min.z - r - depth; fz1 = box.min.z - r; fx0 = box.min.x; fx1 = box.max.x;
  }
  const x0 = Math.max(other.min.x + r, fx0);
  const x1 = Math.min(other.max.x - r, fx1);
  const z0 = Math.max(other.min.z + r, fz0);
  const z1 = Math.min(other.max.z - r, fz1);
  if (x1 < x0 - 1e-6 || z1 < z0 - 1e-6) return null;
  return { x0, x1, z0, z1 };
}

/**
 * Where a body standing at (x, z) in front of `face` of `box` ends up once
 * it is over: the controller's destination, a radius and 0.3m past the point
 * on the face straight ahead of it. Exported so a check can stand there.
 */
export function landingSpot(box, face, x, z) {
  const hitX = face.nx > 0 ? box.max.x : face.nx < 0 ? box.min.x : x;
  const hitZ = face.nz > 0 ? box.max.z : face.nz < 0 ? box.min.z : z;
  return { x: hitX - face.nx * LANDING_FORWARD, z: hitZ - face.nz * LANDING_FORWARD };
}

/**
 * Does a body fit at the landing, crouched at least? The capsule the
 * controller validates in `_commitMove()`, at the height it puts it.
 */
export function landingFits(collision, box, face, x, z) {
  const spot = landingSpot(box, face, x, z);
  const half = { x: S.radius, y: S.crouchHeight / 2, z: S.radius };
  return collision.isClear({ x: spot.x, y: box.max.y + half.y + S.mantleClearance, z: spot.z }, half);
}

/**
 * Standing at (x, z) with feet at `feet`, facing `face` of `box`: does the
 * body fit, and does the hand sweep meet that face? The sweep is the
 * controller's - a ray at every `PROBE_STEP` up to full reach, stopping at
 * the first sample that is not in open air, because a hand cannot be above a
 * ceiling it cannot get through. A ray that meets something else first keeps
 * sweeping, as the controller does: a low wall in front of a tall box hides
 * the box's foot, not its lip.
 *
 * And once the face is met, the hands go on up it to its top edge (B5c):
 * the column above the body has to be open air all the way to the top of
 * the box, or the face is a wall under a ceiling, not a ledge. A duct lip
 * met from underneath the duct's floor slab is exactly that - its face is
 * exposed from 1.4 to 2.1m beneath the slab, the landing on top is a legal
 * crouch inside the mouth, and the body between them would rise straight
 * through the floor. `handsOverTop` (climbprobe.js) is the same test the
 * controller makes in `_probeLedge()` before it commits.
 */
function handsReachFace(collision, box, face, x, z, feet, depth) {
  const half = { x: S.radius, y: S.crouchHeight / 2, z: S.radius };
  if (!collision.isClear({ x, y: feet + half.y + 0.02, z }, half)) return false;

  const direction = { x: -face.nx, y: 0, z: -face.nz };
  const distance = depth + S.radius;
  const reach = S.reach.standing + S.reach.jumpBonus;
  for (let probe = PROBE_STEP; probe <= reach + PROBE_STEP; probe += PROBE_STEP) {
    const origin = { x, y: feet + probe, z };
    if (!collision.isClear(origin, HAND_HALF)) return false;
    const hit = collision.raycast(origin, direction, distance);
    if (!hit) continue;
    // Only a face gives a ledge; a top or bottom hit is not something to climb.
    if (Math.abs(hit.ny) > 0.5) continue;
    if (hit.box === box) return handsOverTop(collision, x, z, feet + probe, box.max.y);
  }
  return false;
}
