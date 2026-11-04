/**
 * BLACKLINE - mapxray.js
 *
 * What the x-ray will look through (Block M, M2). Josh: it "works through
 * thin walls like vents, crates and such, not real regular walls". The test
 * for thin is mechanical and never a tag - nothing here reads `box.tag`; the
 * checks name their subjects by tag, the rule does not:
 *
 *   - The shell never is: a box whose footprint reaches the shell rectangle's
 *     boundary. The plant's `shell-*` walls fill that band; the yard's ring of
 *     containers (and the arch laid across each gate) sits on it, which is
 *     what the ring is for.
 *   - Otherwise, a box is see-through if its top is a body's height below its
 *     room's ceiling. A room wall spans floor to ceiling, so its top *is* the
 *     ceiling and it fails with no special case. A box in no room stands under
 *     the sky and is see-through.
 *
 * A sightline then spends a budget: the metres it crosses of such solids, in
 * total, must stay under `xray.maxThickness`. One solid that is not see-through
 * stops it whatever the budget says.
 *
 * Free functions over the map, as `mapclimb.js`: `GameMap.seeThroughAlong`
 * calls in. No Three.js.
 *
 * Layering (Section 3.1): imports config.js and collisionbox.js, nothing else.
 */

import { CONFIG } from './config.js';
import { raySlab } from './collisionbox.js';

const X = CONFIG.shade.xray;

/** Footprints this close count as touching: a wall stands against its room's rectangle, not in it. */
const TOUCH = 0.01;

/**
 * Is this solid something the x-ray looks through?
 * @param {import('./mapkit.js').GameMap} map
 * @param {import('./collisionbox.js').CollisionBox} box
 */
export function seeThroughBox(map, box) {
  const shell = map.shell;
  if (shell && (
    box.min.x <= shell.x0 + TOUCH || box.max.x >= shell.x1 - TOUCH
    || box.min.z <= shell.z0 + TOUCH || box.max.z >= shell.z1 - TOUCH
  )) return false;

  // The room is found as `addSite` finds one - by the rectangle and the floor
  // band - but by overlap, not by the centre: a room's walls stand just
  // outside its rectangle, so their centres are in none, and a wall that
  // reads as under the sky would be seen through.
  for (const room of map.rooms) {
    if (box.max.x < room.min.x - TOUCH || box.min.x > room.max.x + TOUCH) continue;
    if (box.max.z < room.min.z - TOUCH || box.min.z > room.max.z + TOUCH) continue;
    if (box.min.y < room.floorY - 0.5 || box.min.y >= room.ceilingY - 0.5) continue;
    if (box.max.y > room.ceilingY - CONFIG.shade.standHeight) return false;
  }
  // In no room, or low in every one it overlaps: under the sky, or thin.
  return true;
}

const lo = { x: 0, y: 0, z: 0 };
const hi = { x: 0, y: 0, z: 0 };
const delta = { x: 0, y: 0, z: 0 };

/**
 * Walk the segment `from` -> `to` through every solid that blocks sight.
 * @returns {{seeThrough: boolean, thickness: number, blockedBy: import('./collisionbox.js').CollisionBox|null}}
 *   `thickness` is the metres crossed in see-through solids (up to the stop,
 *   if one stopped it); `blockedBy` is the solid that is not see-through.
 */
export function seeThroughAlong(map, from, to) {
  delta.x = to.x - from.x;
  delta.y = to.y - from.y;
  delta.z = to.z - from.z;
  const length = Math.hypot(delta.x, delta.y, delta.z);
  lo.x = Math.min(from.x, to.x); lo.y = Math.min(from.y, to.y); lo.z = Math.min(from.z, to.z);
  hi.x = Math.max(from.x, to.x); hi.y = Math.max(from.y, to.y); hi.z = Math.max(from.z, to.z);

  // Nearest first, so a stop reports the thickness crossed before it.
  const crossings = [];
  for (const box of map.collision.query(lo, hi)) {
    if (!box.blocksSight) continue;
    const hit = raySlab(from, delta, box.min, box.max);
    if (hit) crossings.push({ box, tEnter: hit.t, tExit: hit.tExit });
  }
  crossings.sort((a, b) => a.tEnter - b.tEnter);

  let thickness = 0;
  for (const { box, tEnter, tExit } of crossings) {
    if (!seeThroughBox(map, box)) return { seeThrough: false, thickness, blockedBy: box };
    thickness += (tExit - tEnter) * length;
  }
  return { seeThrough: thickness < X.maxThickness, thickness, blockedBy: null };
}
