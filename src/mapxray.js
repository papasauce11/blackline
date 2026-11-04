/**
 * BLACKLINE - mapxray.js
 *
 * What the x-ray will look through (Block M, M2). Josh: it "works through
 * thin walls like vents, crates and such, not real regular walls". The test
 * for thin is mechanical and never a tag - nothing here reads `box.tag`; the
 * checks name their subjects by tag, the rule does not:
 *
 *   - The shell never is: a box that lies *along* the shell rectangle's
 *     boundary. The plant's `shell-*` walls fill that band; the yard's ring of
 *     containers (and the arch laid across each gate) sits on it, which is
 *     what the ring is for. Lying along is measured, not tagged: the box
 *     reaches the boundary and runs no farther inward than it does along the
 *     edge. A tube that passes out through the shell - the plant's grade
 *     vents - is long inward and a hand's width along, so it is not shell,
 *     and the 0.12m sheet of it is looked through.
 *   - Otherwise, a box is see-through if its top is a body's height below its
 *     room's ceiling. A room wall spans floor to ceiling, so its top *is* the
 *     ceiling and it fails with no special case. A box in no room stands under
 *     the sky and is see-through.
 *   - Except a wall plane's own low pieces: the sill under a window or a vent
 *     mouth is a body's height below the ceiling too, but it stands end to end
 *     with a full-height piece of the same wall, in the same plane, and is
 *     brickwork. The x-ray looks through a vent, not through the wall beside it.
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

/** Does this box lie along the shell's boundary, not run out through it? */
function liesAlongShell(shell, box) {
  const dx = box.max.x - box.min.x;
  const dz = box.max.z - box.min.z;
  // On a west or east edge the edge runs along z and inward is x; on a north
  // or south edge, the other way about. A corner box is shell on either.
  if ((box.min.x <= shell.x0 + TOUCH || box.max.x >= shell.x1 - TOUCH) && dx <= dz + TOUCH) return true;
  return (box.min.z <= shell.z0 + TOUCH || box.max.z >= shell.z1 - TOUCH) && dz <= dx + TOUCH;
}

/**
 * Would the ceiling clause alone let the sightline through this box? The
 * room is found as `addSite` finds one - by the rectangle and the floor band -
 * but by overlap, not by the centre: a room's walls stand just outside its
 * rectangle, so their centres are in none, and a wall that reads as under the
 * sky would be seen through.
 */
function lowForItsRoom(map, box) {
  for (const room of map.rooms) {
    if (box.max.x < room.min.x - TOUCH || box.min.x > room.max.x + TOUCH) continue;
    if (box.max.z < room.min.z - TOUCH || box.min.z > room.max.z + TOUCH) continue;
    if (box.min.y < room.floorY - 0.5 || box.min.y >= room.ceilingY - 0.5) continue;
    if (box.max.y > room.ceilingY - CONFIG.shade.standHeight) return false;
  }
  // In no room, or low in every one it overlaps: under the sky, or thin.
  return true;
}

const probeLo = { x: 0, y: 0, z: 0 };
const probeHi = { x: 0, y: 0, z: 0 };

/** Does this box stand floor to ceiling in a room - a wall, and not the top tier of a stack that merely reaches the ceiling? */
function spansItsRoom(map, box) {
  if (lowForItsRoom(map, box)) return false;
  return map.rooms.some((room) => box.min.y <= room.floorY + 0.5 && box.max.y >= room.ceilingY - 0.01
    && box.max.x >= room.min.x - TOUCH && box.min.x <= room.max.x + TOUCH
    && box.max.z >= room.min.z - TOUCH && box.min.z <= room.max.z + TOUCH);
}

/**
 * Is this low box a piece of a wall - in a wall plane, end to end with a
 * full-height sight-blocker?
 *
 * **This queries the collision grid, and `query` hands back one reused array**
 * (physics.js), so nothing may call `seeThroughBox` while still walking a
 * `query` result of its own. `seeThroughAlong` below is safe because it
 * collects its crossings first, for the sort; a future caller that loops a
 * live query and asks the rule inside it would read boxes that are not there.
 *
 * The thin axis is the plane's normal; the piece
 * must sit inside the neighbour's thickness (a crate stood flush against a
 * wall is thicker than the wall and fails here) and abut or overlap it along
 * the plane. Height is not asked: the sill under an opening and the lintel
 * over it both stand end to end with the jamb, whichever side it is on.
 */
function isWallPiece(map, box) {
  const thin = box.max.x - box.min.x <= box.max.z - box.min.z ? 'x' : 'z';
  const long = thin === 'x' ? 'z' : 'x';
  probeLo.x = box.min.x - TOUCH; probeLo.y = box.min.y; probeLo.z = box.min.z - TOUCH;
  probeHi.x = box.max.x + TOUCH; probeHi.y = box.max.y; probeHi.z = box.max.z + TOUCH;
  for (const other of map.collision.query(probeLo, probeHi)) {
    if (other === box || !other.blocksSight) continue;
    if (other.max[thin] - other.min[thin] > other.max[long] - other.min[long]) continue;
    if (box.min[thin] < other.min[thin] - TOUCH || box.max[thin] > other.max[thin] + TOUCH) continue;
    if (box.max[long] < other.min[long] - TOUCH || box.min[long] > other.max[long] + TOUCH) continue;
    if (spansItsRoom(map, other)) return true;
  }
  return false;
}

/**
 * Is this solid something the x-ray looks through?
 * @param {import('./mapkit.js').GameMap} map
 * @param {import('./collisionbox.js').CollisionBox} box
 */
export function seeThroughBox(map, box) {
  if (map.shell && liesAlongShell(map.shell, box)) return false;
  return lowForItsRoom(map, box) && !isWallPiece(map, box);
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
