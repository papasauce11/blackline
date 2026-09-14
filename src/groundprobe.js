/**
 * BLACKLINE - groundprobe.js
 *
 * What is under a point, asked of the collision world. Three questions the
 * Warden's ground (mapground.js) asks in two places - the flood that
 * derives it and the route planner that walks it - and so kept apart from
 * both (Section 3.1's ~600-line guidance; B5c pushed mapground.js over it):
 *
 * - `standableFloors()`: every height in a column a standing Warden could be
 *   supported at - a top face under the footprint with headroom above it.
 * - `walkable()`: can a body walk from one point to another a quarter-cell
 *   at a time, resting on a tread within a step at each - a staircase says
 *   yes, a wall says no.
 * - `groundUnder()`: is there any top face under this one point within a
 *   step of a height - support only, what a body that has strayed off a
 *   planned line finds under its centre.
 *
 * Layering (Section 3.1): imports nothing. The collision world is handed
 * in, and the body's dimensions with it.
 */

/** Two top faces closer than this are the same floor, not two of them. */
export const SAME_FLOOR = 0.05;
/** Lift the capsule clear of the surface it rests on, as the solver's skin does. */
export const SKIN = 0.01;

/** Sub-steps per cell for `walkable()`: a tread every 0.4m needs at least three. */
export const WALK_SUBSTEPS = 4;
/** Arriving within this of the far cell's floor counts as standing on it. */
const ARRIVE = 0.06;

/**
 * Can a standing body walk from one cell centre to the next when the floors
 * under them are more than a step apart? Only a staircase should say yes: the
 * body moves a quarter-cell at a time and at each point rests on the highest
 * standable top under it that is within a step of where it was, up or down
 * (D16). A wall between the two - a floor that jumps a full flight in one
 * cell - has no such tread to rest on halfway and fails.
 */
export function walkable(collision, ax, az, ay, bx, bz, by, half, step, substeps = WALK_SUBSTEPS) {
  let y = ay;
  for (let s = 1; s <= substeps; s++) {
    const t = s / substeps;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    const tops = standableFloors(collision, x, z, half);
    let rest = null;
    for (let k = tops.length - 1; k >= 0; k--) {
      if (Math.abs(tops[k] - y) <= step) {
        rest = tops[k];
        break;
      }
    }
    if (rest === null) return false;
    y = rest;
  }
  return Math.abs(y - by) <= ARRIVE;
}

/**
 * Is there a solid top face under this point within a step of `y`? Support
 * only - no footprint, no headroom. It is what a body that has strayed off a
 * planned line finds under its centre: a wall there stops it, a floor holds
 * it, and nothing at all is a fall.
 */
export function groundUnder(collision, x, z, y, step) {
  const candidates = collision.query({ x, y: y - step, z }, { x, y: y + step, z });
  for (let i = 0; i < candidates.length; i++) {
    const box = candidates[i];
    if (!box.solid) continue;
    // Inclusive: a point on the seam between two deck slabs is over both.
    if (box.max.x < x || box.min.x > x || box.max.z < z || box.min.z > z) continue;
    if (Math.abs(box.max.y - y) <= step) return true;
  }
  return false;
}

/**
 * Every height in this column a standing Warden could be supported at, lowest
 * first: a solid top face under the body's footprint with room above it for the
 * standing capsule.
 *
 * The footprint test matches the solver rather than being stricter than it -
 * the swept AABB rests on any top face it overlaps, so half a body over a deck
 * edge is standing, and pretending otherwise would shrink every walkable
 * surface by a radius all round.
 */
export function standableFloors(collision, x, z, half) {
  const tops = [];
  const candidates = collision.query(
    { x: x - half.x, y: 0, z: z - half.z },
    { x: x + half.x, y: 0, z: z + half.z }
  );
  // Copied out as numbers before the first isClear(): `query` hands back a
  // buffer it reuses, and isClear() queries.
  for (let i = 0; i < candidates.length; i++) {
    const box = candidates[i];
    if (!box.solid) continue;
    if (box.max.x <= x - half.x || box.min.x >= x + half.x) continue;
    if (box.max.z <= z - half.z || box.min.z >= z + half.z) continue;
    tops.push(box.max.y);
  }
  tops.sort((a, b) => a - b);

  const floors = [];
  for (let i = 0; i < tops.length; i++) {
    if (floors.length && tops[i] - floors[floors.length - 1] <= SAME_FLOOR) continue;
    if (!collision.isClear({ x, y: tops[i] + half.y + SKIN, z }, half)) continue;
    floors.push(tops[i]);
  }
  return floors;
}
