/**
 * BLACKLINE - tests/stairground.js
 *
 * AUTO suite (K15): the Warden's ground does not disagree with a stair about
 * where the stair is.
 *
 * The flood counts a cell as ground when any sliver of the body's footprint
 * overlaps a top face (groundprobe.js: matching the solver, so that no walkable
 * surface shrinks by a radius), which is why the plant's hall stair has
 * climbing cells at z -19.75 against a declared crossMax of -20.1. They are
 * genuinely standable and the flood is not what this changes. What is true, and
 * what nothing held, is that such a cell is never firm: its own centre has no
 * tread under it, and `_firm` (K14) is exactly that question. The route planner
 * leans on it, so this pins the ground it leans on.
 *
 * Reads the map's declared staircases against the Warden's ground and drives
 * nothing. Registered from tests/index.js. Nothing here imports main.js
 * (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { groundUnder } from '../groundprobe.js';

const FAILURES_SHOWN = 3;

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-climbing-cell-outside-its-stairs-declared-width-is-never-firm',
    maps: ['plant', 'yard'],
    spec: 'Section 6.2 / Block K15',
    name: "A Warden-ground cell at a mid-flight tread height whose centre lies outside its staircase's declared cross range is never firm, and the reading finds every staircase and, on the plant, cells outside to test",
    run: (h) => {
      const problems = [];
      const ground = h.map.wardenGround;
      const stairs = h.map.staircases;
      if (!ground) return { pass: false, detail: 'map.wardenGround was never derived' };
      if (!stairs || !stairs.length) return { pass: false, detail: 'this map declares no staircase to read the ground against' };

      const rise = CONFIG.map.stairRise;
      const readings = [];
      let outsideAll = 0;
      for (const stair of stairs) {
        // A mid-flight tread height is one only this stair reaches: half a rise
        // in from either end keeps the floor it arrives on and the one it
        // leaves from out of the count.
        const lowest = stair.baseY + rise * 0.5;
        const highest = stair.topY - rise * 0.5;
        let climbing = 0;
        let outside = 0;
        let firm = 0;
        const failures = [];
        ground.forEach((x, y, z) => {
          const along = stair.axis === 'x' ? x : z;
          if (along < stair.bottom || along > stair.top || !(y > lowest && y < highest)) return;
          climbing++;
          // `_firm` asks about a cell's CENTRE, so the declared range is held
          // against the centre too. Against the cell's footprint it would call
          // every edge cell a failure, which is the wrong question: the half
          // cell that overhangs the edge is the flood's sliver, by design.
          const centreAcross = stair.axis === 'x' ? z : x;
          if (centreAcross >= stair.crossMin && centreAcross <= stair.crossMax) return;
          outside++;
          if (!groundUnder(ground.collision, x, z, y, ground.step)) return;
          firm++;
          failures.push(`(${x.toFixed(2)}, ${z.toFixed(2)}) at y ${y.toFixed(2)}`);
        });
        outsideAll += outside;
        readings.push(`${stair.tag} [${stair.crossMin}, ${stair.crossMax}] ${climbing}/${outside}/${firm}`);
        // (a) a stair the reading missed would pass (b) for nothing.
        if (climbing === 0) problems.push(`${stair.tag} has no climbing cell on the Warden's ground: the reading missed the stair`);
        // (b)
        if (firm > 0) {
          problems.push(`${stair.tag}: ${firm} firm cell(s) outside [${stair.crossMin}, ${stair.crossMax}], first ${failures.slice(0, FAILURES_SHOWN).join(', ')}`);
        }
      }

      // (c) on the plant, the finding itself: there are cells to test.
      const plant = h.map.id === 'plant';
      if (plant && outsideAll === 0) problems.push('no climbing cell lies outside a declared range on the plant: (b) tested an empty set');

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `climbing/outside/firm: ${readings.join('; ')}; ${outsideAll} outside in all${plant ? '' : ' (not required to be non-zero here)'}`
          : problems.concat(`climbing/outside/firm: ${readings.join('; ')}`).join('; '),
      };
    },
  });
}
