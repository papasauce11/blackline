/**
 * BLACKLINE — climbprobe.js
 *
 * The hand sweep's constants and the one sentence of it the map's climb rule
 * (`mapclimb.js`) and the Shade's controller (`entities/agenttraversal.js`)
 * both have to say. They cannot import each other - the layering in Section
 * 3.1 runs downward and an entity does not know the map - so what they share
 * lives here, at the physics layer, importing nothing. `classifyReach` in
 * physics.js is the same idea for the reach bands.
 *
 * Kept identical on purpose: the rule must not see a ledge the hands cannot,
 * and the hands must not get over one the rule refused.
 */

/** A sample every this far up from the feet, each one a horizontal ray. */
export const PROBE_STEP = 0.12;
/** The hand, as a box, for asking whether a sample sits in open air. */
export const HAND_HALF = { x: 0.05, y: 0.05, z: 0.05 };

/**
 * From a hand on a face at `fromY`, is the column above the body open air up
 * to just over the top of that face (B5c)?
 *
 * The sweep meets a face and stops; the mantle then carries the body up to
 * the face's top edge and over. Between those two heights the body is in the
 * column above where it stands, and that column has to be clear - a hand
 * that meets a ceiling on the way up never gets over the edge, whatever the
 * landing on top looks like. A duct lip met from underneath the duct's floor
 * slab was exactly this: its face exposed from 1.4 to 2.1m beneath the slab,
 * a legal crouch inside the mouth for a landing, and the floor between them,
 * which the body rose straight through. Everything higher is behind the same
 * ceiling, so a caller that gets `false` stops sweeping rather than skipping.
 */
export function handsOverTop(collision, x, z, fromY, topY) {
  for (let y = fromY; y <= topY + PROBE_STEP; y += PROBE_STEP) {
    if (!collision.isClear({ x, y, z }, HAND_HALF)) return false;
  }
  return true;
}

/**
 * The shape of a climb: the body goes from `from` to `to` on an ease-out
 * with a small arc, so a vault reads as going over something rather than
 * through it. `_stepTraversal()` draws it and `riseIsClear()` sweeps it, so
 * the two cannot disagree about where the body was.
 */
export const MOVE_ARC = 0.18;

export function movePath(from, to, t, out) {
  const eased = t * t * (3 - 2 * t);
  out.x = from.x + (to.x - from.x) * eased;
  out.y = from.y + (to.y - from.y) * eased + Math.sin(t * Math.PI) * MOVE_ARC;
  out.z = from.z + (to.z - from.z) * eased;
  return out;
}

const RISE_SAMPLES = 6;
const risePoint = { x: 0, y: 0, z: 0 };

/**
 * Once the hands are over the top, is the way up clear of anything higher
 * than the top (B8)?
 *
 * `handsOverTop` clears the column to the top edge of the face and the
 * landing is validated where the move ends; between them the body travels
 * the path above, and it is taller than a hand. This sweeps the capsule
 * along that path against every solid whose top is above the landing's -
 * the things the body could be going up THROUGH. Not against lower ones:
 * every climb passes over the corner of the box it climbs, and at a duct
 * mouth the floor slab is coincident with the lip's top and the body
 * brushes both; those are climbed over, not through, and a solid that is
 * under the landing and over the spot is already `handsOverTop`'s to refuse.
 *
 * A lip with a gantry 0.3m over it (hall-container's south face) has a
 * legal landing beyond the gantry's edge and a body-length of gantry between
 * here and there; the mantle went through it. A grab does not ask this - a
 * hang is a reach, not a rise - so the lip can still be hung from, and the
 * pull-up is what scuffs.
 */
export function riseIsClear(collision, from, to, half, topY) {
  const above = (box) => box.max.y > topY + 0.01;
  for (let i = 1; i < RISE_SAMPLES; i++) {
    movePath(from, to, i / RISE_SAMPLES, risePoint);
    if (!collision.isClear(risePoint, half, above)) return false;
  }
  return true;
}
