/**
 * BLACKLINE - tests/groundsearch.js
 *
 * AUTO suite (H122): the ground search and its cell predicates are their own
 * module, and the planner is a composition of them.
 *
 * `mapground.js` stood at 578 of its 600 lines after K14, with K16's swept
 * body-clearance test still to come, so the breadth-first search, the firmness
 * question, the string-pull and the line walk moved to `groundsearch.js`, which
 * is handed the ground and knows nothing about a route. A move is only safe if
 * nothing about it changed, and four things could have: the search might no
 * longer land on the chain `route()` lands on, `_firm()` might keep a cache of
 * its own beside the module's, `canWalk()` might answer differently from the
 * function it delegates to, and the old loops might be still in the class
 * beside the new ones. One clause each.
 *
 * Reads the map against the Warden's ground and drives nothing. Registered
 * from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { searchEdges, firmAt, segmentOnGround } from '../groundsearch.js';
import { moduleText } from './moduletexts.js';

/** How far from a spawn the cells for (a) and (b) are taken, in metres. */
const GOAL_REACH = 8;
const FIRM_REACH = 6;
const MARGIN = 0.3;
const FOUR = ['searchEdges', 'firmAt', 'segmentOnGround', 'pullStraight'];

/** The cell under a foot position; a spawn is held to a step, a cell's own floor to a hair. */
function cellOf(ground, p, tolerance = 0.01) {
  return ground.cellAt({ x: p.x, y: p.y, z: p.z }, tolerance);
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-ground-search-and-its-cell-predicates-are-their-own-module',
    maps: ['plant', 'yard'],
    spec: 'Section 3.1 / Block H122',
    name: "groundsearch.js's search lands on the chain route() lands on, firmAt shares the ground's cache, segmentOnGround agrees with canWalk, and mapground.js no longer carries the loops",
    run: async (h) => {
      const problems = [];
      const ground = h.map.wardenGround;
      const spawns = h.map.wardenSpawns;
      if (!ground || !ground.collision) return { pass: false, detail: 'map.wardenGround was never derived' };
      if (!spawns || !spawns.length) return { pass: false, detail: 'this map has no Warden spawn to read the ground from' };
      const spawn = spawns[0].position;
      const start = cellOf(ground, spawn, CONFIG.warden.stepHeight);
      if (!start) return { pass: false, detail: `the first Warden spawn (${spawn.x}, ${spawn.y}, ${spawn.z}) is not a cell of the ground` };
      const startId = ground.cellId(start.i, start.j, start.k);
      const readings = [];

      // (a) the furthest cell within reach that the flood connects to the spawn.
      const near = ground.cellsWithin(spawn, GOAL_REACH)
        .map((c) => ({ c, d: Math.hypot(c.x - spawn.x, c.z - spawn.z) }))
        .sort((p, q) => q.d - p.d);
      let goal = null;
      let parent = null;
      let goalId = -1;
      for (const { c } of near) {
        const at = cellOf(ground, c);
        if (!at) continue;
        goalId = ground.cellId(at.i, at.j, at.k);
        if (goalId === startId) continue;
        parent = searchEdges(ground, startId, goalId, false);
        if (parent) {
          goal = c;
          break;
        }
      }
      if (!goal) {
        problems.push(`searchEdges found no cell within ${GOAL_REACH}m of the spawn that the flood connects to it (${near.length} candidates)`);
      } else {
        let unwound = 0;
        for (let id = goalId; id !== -1 && unwound <= ground.count; id = parent.get(id)) unwound++;
        // maxLeg 0 refuses every pulled leg, so route() hands back one point
        // per cell of the chain it unwound: its length is the chain's.
        const routed = ground.route(spawn, goal, 0, null, 0);
        readings.push(`a: ${unwound}-cell chain over ${parent.size} reached, route() ${routed ? routed.length : 'null'}`);
        if (parent.get(startId) !== -1) problems.push('the parent map does not root at the start cell');
        if (!routed) problems.push('route() found no route for the pair searchEdges connected');
        else if (routed.length !== unwound) problems.push(`searchEdges unwinds ${unwound} cells and route() lands on ${routed.length} for the same pair`);
      }

      // (b) the delegation is real, and so is the one cache.
      const cells = ground.cellsWithin(spawn, FIRM_REACH);
      let firm = 0;
      let disagree = 0;
      for (const c of cells) {
        const at = cellOf(ground, c);
        if (!at) continue;
        const viaClass = ground._firm(at.i, at.j, at.k, at.y);
        const size = ground._firmCells.size;
        const viaModule = firmAt(ground, at.i, at.j, at.k, at.y);
        if (viaClass !== viaModule || ground._firmCells.size !== size) disagree++;
        if (viaModule) firm++;
      }
      readings.push(`b: ${cells.length} cells within ${FIRM_REACH}m, ${firm} firm, ${disagree} disagree, ${ground._firmCells.size} cached`);
      if (cells.length === 0) problems.push(`no cell within ${FIRM_REACH}m of the spawn: (b) tested an empty set`);
      if (disagree > 0) problems.push(`firmAt and _firm disagree, or firmAt grew a cache of its own, on ${disagree} of ${cells.length} cells`);

      // (c) the line walk against canWalk, on lines it should both allow and refuse.
      const half = { x: CONFIG.map.siteWidth / 2, z: CONFIG.map.siteDepth / 2 };
      const ends = [
        { x: spawn.x, y: spawn.y + 3, z: spawn.z },
        { x: -half.x, y: spawn.y, z: -half.z },
        { x: half.x, y: spawn.y, z: half.z },
      ];
      for (const c of near.slice(0, 40)) ends.push(c.c);
      for (const other of spawns) ends.push(other.position);
      let clear = 0;
      let refused = 0;
      let differ = 0;
      for (const margin of [0, MARGIN]) {
        for (const b of ends) {
          const direct = segmentOnGround(ground, spawn, b, margin);
          if (direct !== ground.canWalk(spawn, b, margin)) differ++;
          if (margin === 0) {
            if (direct) clear++;
            else refused++;
          }
        }
      }
      readings.push(`c: ${ends.length} lines from the spawn, ${clear} clear, ${refused} refused, ${differ} differ from canWalk`);
      if (clear === 0) problems.push('no staged line was walkable: (c) never saw an agreement on a yes');
      if (refused === 0) problems.push('no staged line was refused: (c) never saw an agreement on a no');
      if (differ > 0) problems.push(`segmentOnGround and canWalk differ on ${differ} of ${ends.length * 2} line asks`);

      // (d) the move is complete: the class names the four and no longer holds
      // the loops. `said` keeps the import path, `code` has strings out too.
      const text = await moduleText(location.origin, 'src/mapground.js');
      if (text.error) {
        problems.push(text.error);
      } else {
        const imported = /import\s*\{([^}]*)\}\s*from\s*'\.\/groundsearch\.js'/.exec(text.said);
        const names = imported ? imported[1].split(',').map((n) => n.trim()) : [];
        const missing = FOUR.filter((n) => !names.includes(n));
        const bfs = /\bqueue\b[^;]*\bhead\b|\bhead\s*<\s*queue\.length\b/.test(text.code);
        const walk = /\bWALK_SUBSTEPS\b|\bwalkable\(\s*this\.collision/.test(text.code);
        readings.push(`d: mapground.js imports ${FOUR.length - missing.length}/${FOUR.length}, breadth-first loop ${bfs ? 'present' : 'gone'}, substep walk ${walk ? 'present' : 'gone'}`);
        if (missing.length) problems.push(`mapground.js does not import ${missing.join(', ')} from ./groundsearch.js`);
        if (bfs) problems.push('mapground.js still declares the breadth-first loop: the move left a copy behind');
        if (walk) problems.push('mapground.js still declares the substep walk: the move left a copy behind');
      }

      return { pass: problems.length === 0, detail: problems.length === 0 ? readings.join('; ') : problems.concat(readings).join('; ') };
    },
  });
}
