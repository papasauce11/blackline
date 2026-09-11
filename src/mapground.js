/**
 * BLACKLINE - mapground.js
 *
 * Where the Warden can stand, and how it walks between those places.
 *
 * Nothing in the codebase stated the asymmetry the redesign is built on. The
 * Shade climbs anything within reach; the Warden has walk, sprint and ADS and
 * nothing else (Section 6.2) - no crouch, no climb, no vault. That was true
 * only because no controller implemented a climb for it, which is a fact about
 * the code rather than a property of the map. This file makes it map data: the
 * set of places a standing Warden could walk to from its own spawns.
 *
 * Flooded once at map build, over a grid, from the Warden spawns outward. An
 * edge between two cells exists when the floors under them are within
 * `warden.stepHeight` of each other AND the standing body fits in the gap
 * between them - the two halves of what the swept solver's `_tryStep()` does,
 * asked ahead of time instead of per frame.
 *
 * The step limit is symmetric, so the set is ground the Warden can walk to and
 * walk back from. A one-way drop is not in it. That is deliberate: the set
 * exists to answer "could a Warden defuse here", and a Warden that falls
 * somewhere it cannot leave has not defended the site, it has removed itself
 * from the round. See DECISIONS.md D16.
 *
 * A staircase is the one place a single cell hides more than one step: treads
 * rise 0.3m every 0.4m and the grid is 0.5m, so two adjacent centres can sit
 * two risers apart, which is more than a step and less than two. For those
 * edges - and only those - the flood walks the gap in quarter-cell sub-steps
 * the way the solver does, resting on the highest tread under the body at
 * each one. A1 shipped without this and the deck was ground only because two
 * spawns are on it; from the hall floor no route climbed either staircase,
 * which A8 found the moment it tried to plan one.
 *
 * Layering (Section 3.1): imports config and mapbake only, like maprooms.js.
 * It needs nothing from GameMap but the collision world and the spawn list.
 */

import { CONFIG } from './config.js';
import { CUT_EPSILON } from './mapbake.js';

const M = CONFIG.map;
const W = CONFIG.warden;

/** Two top faces closer than this are the same floor, not two of them. */
const SAME_FLOOR = 0.05;
/** Lift the capsule clear of the surface it rests on, as the solver's skin does. */
const SKIN = 0.01;
/** Handed to `someCellWithin`'s test, one object for every cell it visits. */
const CELL = { x: 0, y: 0, z: 0 };
/** The four walkable directions, in bit order for `edges`. */
const NEIGHBOURS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
/** `route()` re-derives the flood's step test; this is the flood's epsilon. */
const STEP_SLACK = CUT_EPSILON;

/**
 * The Warden's reachable ground, as a column grid over the site footprint.
 * Each column holds every floor height in it the Warden can walk to, lowest
 * first, so a cell under the upper deck carries both the deck and the floor
 * six metres below it.
 */
export class WardenGround {
  constructor(cell) {
    this.cell = cell;
    this.x0 = -M.siteWidth / 2;
    this.z0 = -M.siteDepth / 2;
    this.nx = Math.round(M.siteWidth / cell);
    this.nz = Math.round(M.siteDepth / cell);
    /** @type {Map<number, number[]>} column key -> ascending floor heights. */
    this.columns = new Map();
    /** How many (column, floor) states are reachable. */
    this.count = 0;
    /**
     * Which neighbours each cell can be walked to, as a bitmask over
     * `NEIGHBOURS` keyed by `cellId()`. The flood proves each edge - a step
     * the Warden can make with a standing body fitting in the gap - and
     * records it here, so `route()` can walk the same edges without asking
     * the collision world again. Two adjacent cells that are both ground are
     * not necessarily joined: a wall thinner than a cell leaves both sides
     * standable, and only the edge knows the route through it is imaginary.
     * @type {Map<number, number>}
     */
    this.edges = new Map();
    /**
     * What the flood was derived from, kept so `route()` can ask the same
     * physics of a pulled-straight segment that the flood asked of an edge.
     * Set by `deriveWardenGround()`; null on a bare grid.
     */
    this.collision = null;
    this.half = null;
    this.step = 0;
  }

  /** One integer per (column, floor). Assumes no column carries five floors. */
  cellId(i, j, k) {
    return this.key(i, j) * 4 + k;
  }

  /**
   * The cell under a foot position: grid indices plus which of the column's
   * floors, or null if the point is off the site or not within `tolerance`
   * of a reachable floor.
   */
  cellAt(position, tolerance = W.stepHeight) {
    const at = this.indexAt(position.x, position.z);
    if (!at) return null;
    const floors = this.columns.get(this.key(at.i, at.j));
    if (!floors) return null;
    let k = -1;
    let gap = tolerance;
    for (let n = 0; n < floors.length; n++) {
      const d = Math.abs(floors[n] - position.y);
      if (d <= gap) {
        gap = d;
        k = n;
      }
    }
    return k < 0 ? null : { i: at.i, j: at.j, k, y: floors[k] };
  }

  /**
   * Where a Warden would stand for this point: the reachable floor under it,
   * or - if the point is not itself on the ground, a charge on a crate top -
   * the nearest reachable cell within `snap` of it. Null if neither.
   *
   * @param {{x:number,y:number,z:number}} position a foot position
   * @param {{radius:number, dy:number}} [snap]
   * @returns {{x:number,y:number,z:number}|null} a foot position on the ground
   */
  standAt(position, snap = null) {
    const cell = this.cellAt(position);
    if (cell) return { x: position.x, y: cell.y, z: position.z };
    if (!snap) return null;
    const cells = this.cellsWithin(position, snap.radius);
    let best = Infinity;
    let found = null;
    for (let n = 0; n < cells.length; n++) {
      if (Math.abs(cells[n].y - position.y) >= snap.dy) continue;
      const d = Math.hypot(cells[n].x - position.x, cells[n].z - position.z);
      if (d < best) {
        best = d;
        found = cells[n];
      }
    }
    return found;
  }

  /**
   * A walkable route over the ground from one foot position to another, as a
   * short list of foot positions, or null if either end is off the ground or
   * they are not connected. Block A8: the AI paths over its waypoint graph and
   * then used to walk straight from its last node to the goal with only the
   * solver to steer it. This is that last leg, planned.
   *
   * Breadth-first over the proven edges, then pulled straight: each kept point
   * is the furthest later point a standing body can walk to in a straight
   * line - `walkable()`, the same quarter-cell rest-and-step the flood uses
   * on a staircase, asked of the collision world - and no segment is longer
   * than `maxLeg`, so the AI re-aims often enough that a nudge off the line
   * is corrected rather than compounded. A wall or a crate corner refuses
   * the pull, and the line bends round it at a cell centre instead.
   *
   * @param {{x:number,y:number,z:number}} from foot position
   * @param {{x:number,y:number,z:number}} to foot position
   * @param {number} [maxLeg] longest straight segment to hand back
   * @param {{radius:number, dy:number}} [snap] if `to` is not itself on the
   *   ground - a charge on a crate top - walk to the nearest cell within this
   *   reach of it instead, which is where the Warden would work on it from
   * @returns {{x:number,y:number,z:number}[]|null}
   */
  route(from, to, maxLeg = Infinity, snap = null) {
    const start = this.cellAt(from);
    const end = this.standAt(to, snap);
    const goal = end ? this.cellAt(end) : null;
    if (!start || !goal) return null;
    const snapped = end.x !== to.x || end.z !== to.z;
    const startId = this.cellId(start.i, start.j, start.k);
    const goalId = this.cellId(goal.i, goal.j, goal.k);

    // Breadth-first. Parents by id; the queue is ids; nothing allocated per
    // visited cell beyond the two maps.
    const parent = new Map([[startId, -1]]);
    const queue = [startId];
    let head = 0;
    let found = startId === goalId;
    while (head < queue.length && !found) {
      const id = queue[head++];
      const mask = this.edges.get(id) || 0;
      if (!mask) continue;
      const k = id % 4;
      const key = (id - k) / 4;
      const i = key % this.nx;
      const j = (key - i) / this.nx;
      const y = this.columns.get(key)[k];
      for (let n = 0; n < NEIGHBOURS.length; n++) {
        if (!(mask & (1 << n))) continue;
        const ni = i + NEIGHBOURS[n][0];
        const nj = j + NEIGHBOURS[n][1];
        const floors = this.columns.get(this.key(ni, nj));
        if (!floors) continue;
        // The edge bit says one of the neighbour's floors is within reach -
        // a step, or two on a staircase; find which, the way the flood did.
        for (let nk = 0; nk < floors.length; nk++) {
          if (Math.abs(floors[nk] - y) > (W.stepHeight + STEP_SLACK) * 2) continue;
          const nid = this.cellId(ni, nj, nk);
          if (parent.has(nid)) continue;
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
    if (!found) return null;

    // Unwind into foot positions, start first.
    const cells = [];
    for (let id = goalId; id !== -1; id = parent.get(id)) {
      const k = id % 4;
      const key = (id - k) / 4;
      const i = key % this.nx;
      const j = (key - i) / this.nx;
      cells.push({ x: this.centreX(i), y: this.columns.get(key)[k], z: this.centreZ(j) });
    }
    cells.reverse();
    // The start is the caller's point, not the cell centre under it - it is
    // where the body already is. The end stays a cell centre: a spot the
    // Shade could stand on 0.4m from a wall is one a wider Warden cannot, and
    // the centre is at most a third of a metre from the goal, inside every
    // arrival radius that reads it.
    cells[0] = { x: from.x, y: start.y, z: from.z };
    const pulled = this._pullStraight(cells, maxLeg);
    // A snapped goal still finishes at the thing itself. The AI decides it
    // has arrived by its distance to the charge, not to the cell beside it,
    // so the last leg is the short walk at the crate the solver stops it at,
    // exactly as it was before any of this was planned.
    if (snapped) pulled.push({ x: to.x, y: goal.y, z: to.z });
    return pulled;
  }

  /** String-pull a cell path: keep a point only where the line has to bend. */
  _pullStraight(cells, maxLeg) {
    const out = [cells[0]];
    let at = 0;
    while (at < cells.length - 1) {
      let far = at + 1;
      for (let probe = cells.length - 1; probe > at + 1; probe--) {
        // Length first: it is a subtraction, and it rules out most probes
        // before the sampled walk along the segment has to run.
        if (Math.hypot(cells[probe].x - cells[at].x, cells[probe].z - cells[at].z) <= maxLeg
          && this._segmentOnGround(cells[at], cells[probe])) {
          far = probe;
          break;
        }
      }
      out.push(cells[far]);
      at = far;
    }
    return out;
  }

  /** Can a standing body walk this line, resting on whatever is under it? */
  _segmentOnGround(a, b) {
    if (!this.collision) return false;
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const substeps = Math.max(1, Math.ceil(length / (this.cell / WALK_SUBSTEPS)));
    return walkable(this.collision, a.x, a.z, a.y, b.x, b.z, b.y, this.half, this.step, substeps);
  }

  key(i, j) {
    return j * this.nx + i;
  }

  centreX(i) {
    return this.x0 + (i + 0.5) * this.cell;
  }

  centreZ(j) {
    return this.z0 + (j + 0.5) * this.cell;
  }

  /** Grid indices containing a world point, or null if it is off the site. */
  indexAt(x, z) {
    const i = Math.floor((x - this.x0) / this.cell);
    const j = Math.floor((z - this.z0) / this.cell);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return null;
    return { i, j };
  }

  /** Reachable floor heights in the column containing (x, z). Never null. */
  floorsAt(x, z) {
    const at = this.indexAt(x, z);
    if (!at) return [];
    return this.columns.get(this.key(at.i, at.j)) || [];
  }

  /**
   * Could the Warden be standing here? `position` is a foot position, and
   * `tolerance` is how far the floor may be from it - a step by default,
   * because that is the most the solver will silently carry a body.
   */
  has(position, tolerance = W.stepHeight) {
    const floors = this.floorsAt(position.x, position.z);
    for (let i = 0; i < floors.length; i++) {
      if (Math.abs(floors[i] - position.y) <= tolerance) return true;
    }
    return false;
  }

  /**
   * Every reachable cell within `radius` horizontally of `position`, as foot
   * positions {x, y, z}. The vertical test is the caller's, because what
   * counts as close enough differs between a defuse reach and a patrol.
   */
  cellsWithin(position, radius) {
    const out = [];
    const at = this.indexAt(position.x, position.z);
    if (!at) return out;
    const span = Math.ceil(radius / this.cell);
    const rSq = radius * radius;
    for (let j = at.j - span; j <= at.j + span; j++) {
      if (j < 0 || j >= this.nz) continue;
      const z = this.centreZ(j);
      for (let i = at.i - span; i <= at.i + span; i++) {
        if (i < 0 || i >= this.nx) continue;
        const floors = this.columns.get(this.key(i, j));
        if (!floors) continue;
        const x = this.centreX(i);
        const dx = x - position.x;
        const dz = z - position.z;
        if (dx * dx + dz * dz > rSq) continue;
        for (let k = 0; k < floors.length; k++) out.push({ x, y: floors[k], z });
      }
    }
    return out;
  }

  /**
   * Does any reachable cell within `radius` horizontally of `position` satisfy
   * `test`? The same scan as `cellsWithin()` without the array: `test` is
   * handed one reused foot position and the caller's `context`, and the scan
   * stops at the first yes.
   *
   * It exists because one caller asks this every fixed step - the plant gate
   * (Block A3) tests the spot under the Shade for as long as interact is held,
   * and `cellsWithin()` would allocate eighty-odd objects a step to answer a
   * question that usually ends on the first cell.
   *
   * @param {{x:number,y:number,z:number}} position
   * @param {number} radius
   * @param {(cell:{x:number,y:number,z:number}, context:*)=>boolean} test
   * @param {*} [context] passed through, so `test` can stay a module constant
   */
  someCellWithin(position, radius, test, context) {
    const at = this.indexAt(position.x, position.z);
    if (!at) return false;
    const span = Math.ceil(radius / this.cell);
    const rSq = radius * radius;
    for (let j = at.j - span; j <= at.j + span; j++) {
      if (j < 0 || j >= this.nz) continue;
      const z = this.centreZ(j);
      for (let i = at.i - span; i <= at.i + span; i++) {
        if (i < 0 || i >= this.nx) continue;
        const floors = this.columns.get(this.key(i, j));
        if (!floors) continue;
        const x = this.centreX(i);
        const dx = x - position.x;
        const dz = z - position.z;
        if (dx * dx + dz * dz > rSq) continue;
        CELL.x = x;
        CELL.z = z;
        for (let k = 0; k < floors.length; k++) {
          CELL.y = floors[k];
          if (test(CELL, context)) return true;
        }
      }
    }
    return false;
  }

  /** Every reachable cell, as fn(x, y, z). */
  forEach(fn) {
    for (const [key, floors] of this.columns) {
      const i = key % this.nx;
      const j = (key - i) / this.nx;
      const x = this.centreX(i);
      const z = this.centreZ(j);
      for (let k = 0; k < floors.length; k++) fn(x, floors[k], z);
    }
  }

  _add(i, j, y) {
    const key = this.key(i, j);
    let floors = this.columns.get(key);
    if (!floors) {
      floors = [];
      this.columns.set(key, floors);
    }
    let at = floors.length;
    while (at > 0 && floors[at - 1] > y) at--;
    floors.splice(at, 0, y);
    this.count++;
  }
}

/**
 * Flood the Warden's reachable ground from its spawns.
 *
 * @param {import('./physics.js').CollisionWorld} collision built
 * @param {{position: {x:number, y:number, z:number}}[]} spawns the Warden's
 * @returns {WardenGround}
 */
export function deriveWardenGround(collision, spawns) {
  const ground = new WardenGround(M.wardenGroundCell);
  const half = { x: W.radius, y: W.standHeight / 2, z: W.radius };
  const step = W.stepHeight + CUT_EPSILON;
  ground.collision = collision;
  ground.half = half;
  ground.step = step;

  // Columns are probed only where the fill looks, and cached. Probing the whole
  // site up front costs four times as much and most of it is under the deck or
  // inside a wall.
  /** @type {Map<number, number[]>} */
  const probed = new Map();
  const floorsIn = (i, j) => {
    const key = ground.key(i, j);
    let floors = probed.get(key);
    if (floors === undefined) {
      floors = standableFloors(collision, ground.centreX(i), ground.centreZ(j), half);
      probed.set(key, floors);
    }
    return floors;
  };

  const seen = new Set();
  const frontier = [];
  const reach = (i, j, index, y) => {
    const id = i + ',' + j + ',' + index;
    if (seen.has(id)) return;
    seen.add(id);
    ground._add(i, j, y);
    frontier.push(i, j, y);
  };

  for (const spawn of spawns) {
    const at = ground.indexAt(spawn.position.x, spawn.position.z);
    if (!at) continue;
    const floors = floorsIn(at.i, at.j);
    for (let index = 0; index < floors.length; index++) {
      if (Math.abs(floors[index] - spawn.position.y) <= step) reach(at.i, at.j, index, floors[index]);
    }
  }

  // Every edge the flood proves is kept, both ways, as (i, j, y, direction);
  // they resolve to cell ids once the reachable floors are all known.
  const proven = [];
  while (frontier.length) {
    const y = frontier.pop();
    const j = frontier.pop();
    const i = frontier.pop();
    for (let n = 0; n < NEIGHBOURS.length; n++) {
      const ni = i + NEIGHBOURS[n][0];
      const nj = j + NEIGHBOURS[n][1];
      if (ni < 0 || nj < 0 || ni >= ground.nx || nj >= ground.nz) continue;
      const floors = floorsIn(ni, nj);
      for (let index = 0; index < floors.length; index++) {
        const ny = floors[index];
        const rise = Math.abs(ny - y);
        if (rise > step * 2) continue;
        if (rise <= step) {
          // The body has to fit in the gap, not only at the two centres. A
          // wall thinner than the cell can otherwise leave both sides
          // standable and the route through it imaginary. Tested at the
          // higher floor, which is where the solver puts the body before it
          // advances. Tested for every edge, not only the ones that reach
          // somewhere new: `route()` walks the edges, and an untested edge is
          // a route through a wall.
          const midY = Math.max(y, ny) + half.y + SKIN;
          const midX = (ground.centreX(i) + ground.centreX(ni)) / 2;
          const midZ = (ground.centreZ(j) + ground.centreZ(nj)) / 2;
          if (!collision.isClear({ x: midX, y: midY, z: midZ }, half)) continue;
        } else if (!walkable(collision, ground.centreX(i), ground.centreZ(j), y,
          ground.centreX(ni), ground.centreZ(nj), ny, half, step)) {
          // More than a step but less than two: a staircase, or a wall. Walk it.
          continue;
        }
        proven.push(i, j, y, n);
        if (!seen.has(ni + ',' + nj + ',' + index)) reach(ni, nj, index, ny);
      }
    }
  }

  // Edges into the mask table. An edge is proven from the cell it was
  // expanded from; the reverse direction is proven when that neighbour is
  // expanded in its turn, which every reached cell is.
  for (let p = 0; p < proven.length; p += 4) {
    const i = proven[p];
    const j = proven[p + 1];
    const k = ground.columns.get(ground.key(i, j)).indexOf(proven[p + 2]);
    const id = ground.cellId(i, j, k);
    ground.edges.set(id, (ground.edges.get(id) || 0) | (1 << proven[p + 3]));
  }

  return ground;
}

/** Sub-steps per cell for `walkable()`: a tread every 0.4m needs at least three. */
const WALK_SUBSTEPS = 4;
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
function walkable(collision, ax, az, ay, bx, bz, by, half, step, substeps = WALK_SUBSTEPS) {
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
 * Every height in this column a standing Warden could be supported at, lowest
 * first: a solid top face under the body's footprint with room above it for the
 * standing capsule.
 *
 * The footprint test matches the solver rather than being stricter than it -
 * the swept AABB rests on any top face it overlaps, so half a body over a deck
 * edge is standing, and pretending otherwise would shrink every walkable
 * surface by a radius all round.
 */
function standableFloors(collision, x, z, half) {
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
