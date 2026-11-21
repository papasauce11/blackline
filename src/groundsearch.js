/**
 * BLACKLINE - groundsearch.js
 *
 * What can be asked of the Warden's flood and the collision world, with no
 * route in the question (H122).
 *
 * `WardenGround.route()` is a planner: it composes a breadth-first search over
 * the proven edges, the question of whether a cell has deck under its own
 * centre, and a string-pull over the cells that come back. The first two and
 * the pull's line test are pure queries - each reads the flood's `edges` and
 * `columns` or asks the collision world a question, and none of them knows what
 * a route is. K14 grew them inside `mapground.js` until the file stood at 578
 * of its 600 lines with K16's swept body-clearance test still to land beside
 * them, so they live here and the ground is handed in.
 *
 * Every function takes the `WardenGround` as its first argument and reads it:
 * `edges`, `columns`, `nx`, `collision`, `step`, `half`, `cell`, the firm-cell
 * cache, and its `cellId` / `key` / `centreX` / `centreZ`. Nothing is written
 * to it but the cache, which belongs to `firmAt()` and which the ground's own
 * `_firm()` shares by delegating here - one cache, not two.
 *
 * Layering (Section 3.1): imports config, mapbake (the flood's epsilon) and
 * groundprobe.js. It is handed the ground and never reaches up to it, so
 * `mapground.js` imports this and not the other way round.
 */

import { CONFIG } from './config.js';
import { CUT_EPSILON } from './mapbake.js';
import { WALK_SUBSTEPS, walkable, groundUnder } from './groundprobe.js';

const W = CONFIG.warden;

/** The four walkable directions, in bit order for `edges`. */
export const NEIGHBOURS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
/** `route()` re-derives the flood's step test; this is the flood's epsilon. */
const STEP_SLACK = CUT_EPSILON;

/**
 * Breadth-first over the proven edges: parents by id, the queue is ids,
 * nothing allocated per visited cell beyond the two maps. `firmOnly` walks
 * only cells whose own centre has deck under it (the goal's is always
 * allowed: it is where the caller asked to be). Null if the goal is not
 * reached.
 */
export function searchEdges(g, startId, goalId, firmOnly) {
  const parent = new Map([[startId, -1]]);
  const queue = [startId];
  let head = 0;
  let found = startId === goalId;
  while (head < queue.length && !found) {
    const id = queue[head++];
    const mask = g.edges.get(id) || 0;
    if (!mask) continue;
    const k = id % 4;
    const key = (id - k) / 4;
    const i = key % g.nx;
    const j = (key - i) / g.nx;
    const y = g.columns.get(key)[k];
    for (let n = 0; n < NEIGHBOURS.length; n++) {
      if (!(mask & (1 << n))) continue;
      const ni = i + NEIGHBOURS[n][0];
      const nj = j + NEIGHBOURS[n][1];
      const floors = g.columns.get(g.key(ni, nj));
      if (!floors) continue;
      // The edge bit says one of the neighbour's floors is within reach -
      // a step, or two on a staircase; find which, the way the flood did.
      for (let nk = 0; nk < floors.length; nk++) {
        if (Math.abs(floors[nk] - y) > (W.stepHeight + STEP_SLACK) * 2) continue;
        const nid = g.cellId(ni, nj, nk);
        if (parent.has(nid)) continue;
        if (firmOnly && nid !== goalId && !firmAt(g, ni, nj, nk, floors[nk])) continue;
        parent.set(nid, id);
        if (nid === goalId) {
          found = true;
          break;
        }
        queue.push(nid);
      }
      if (found) break;
    }
  }
  return found ? parent : null;
}

/** Is there a top face under this cell's centre, within a step of its floor? Cached: the flood's footprint test is looser by design. */
export function firmAt(g, i, j, k, y) {
  if (!g.collision) return true;
  const id = g.cellId(i, j, k);
  let firm = g._firmCells.get(id);
  if (firm === undefined) {
    firm = groundUnder(g.collision, g.centreX(i), g.centreZ(j), y, g.step);
    g._firmCells.set(id, firm);
  }
  return firm;
}

/** String-pull a cell path: keep a point only where the line has to bend. */
export function pullStraight(g, cells, maxLeg, margin) {
  const out = [cells[0]];
  let at = 0;
  while (at < cells.length - 1) {
    let far = at + 1;
    for (let probe = cells.length - 1; probe > at + 1; probe--) {
      // Length first: it is a subtraction, and it rules out most probes
      // before the sampled walk along the segment has to run.
      if (Math.hypot(cells[probe].x - cells[at].x, cells[probe].z - cells[at].z) <= maxLeg
        && segmentOnGround(g, cells[at], cells[probe], margin)) {
        far = probe;
        break;
      }
    }
    out.push(cells[far]);
    at = far;
  }
  return out;
}

/**
 * Can a standing body walk this line, resting on whatever is under it -
 * and, `margin` metres to either side of it, is there still something to
 * rest on? See `WardenGround.route()` for why the second question is asked.
 */
export function segmentOnGround(g, a, b, margin = 0) {
  if (!g.collision) return false;
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  const substeps = Math.max(1, Math.ceil(length / (g.cell / WALK_SUBSTEPS)));
  if (!walkable(g.collision, a.x, a.z, a.y, b.x, b.z, b.y, g.half, g.step, substeps)) return false;
  if (!(margin > 0) || length < 1e-6) return true;
  // The two lines beside it. A body there has strayed, not stepped, so it
  // is held to the line's own height and not to a tread's: the ground it
  // finds has to be within a step of where the line is at that point.
  const nx = -(b.z - a.z) / length * margin;
  const nz = (b.x - a.x) / length * margin;
  for (let s = 0; s <= substeps; s++) {
    const t = s / substeps;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    const y = a.y + (b.y - a.y) * t;
    if (!groundUnder(g.collision, x + nx, z + nz, y, g.step)) return false;
    if (!groundUnder(g.collision, x - nx, z - nz, y, g.step)) return false;
  }
  return true;
}
