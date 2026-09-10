/**
 * BLACKLINE - mapground.js
 *
 * Where the Warden can stand.
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

  const neighbours = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  while (frontier.length) {
    const y = frontier.pop();
    const j = frontier.pop();
    const i = frontier.pop();
    for (const [di, dj] of neighbours) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= ground.nx || nj >= ground.nz) continue;
      const floors = floorsIn(ni, nj);
      for (let index = 0; index < floors.length; index++) {
        const ny = floors[index];
        if (Math.abs(ny - y) > step) continue;
        if (seen.has(ni + ',' + nj + ',' + index)) continue;
        // The body has to fit in the gap, not only at the two centres. A wall
        // thinner than the cell can otherwise leave both sides standable and
        // the route through it imaginary. Tested at the higher floor, which is
        // where the solver puts the body before it advances.
        const midY = Math.max(y, ny) + half.y + SKIN;
        const midX = (ground.centreX(i) + ground.centreX(ni)) / 2;
        const midZ = (ground.centreZ(j) + ground.centreZ(nj)) / 2;
        if (!collision.isClear({ x: midX, y: midY, z: midZ }, half)) continue;
        reach(ni, nj, index, ny);
      }
    }
  }

  return ground;
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
