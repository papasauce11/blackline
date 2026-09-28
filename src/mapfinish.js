/**
 * BLACKLINE — mapfinish.js
 *
 * The tail of every map's build, as slices the caller can pause between (H4).
 *
 * Both map builders ended with the same six lines in the same order, and those
 * six lines are where the bake's time goes. Measured headless on the plant:
 * declaring all 214 solids costs **112ms** and the tail costs **762** —
 * `collision.build()` 11, `deriveClimbableSurfaces()` 86,
 * `deriveRoomEntries()` 332, `deriveWardenGround()` 333. The yard is 83
 * against 373. So a page that paints during the bake has to be able to paint
 * *inside* that tail, and the tail is the same on every map, which is why it
 * lives here rather than being sliced twice.
 *
 * This is a generator: it yields a label after each step, and the caller
 * decides whether to hand the browser a frame before asking for the next one.
 * `buildMap` drives it straight through and is unchanged in behaviour;
 * `bakeMap` (maps/index.js) drives it a slice at a time. One code path, two
 * drivers — never a "loading" build beside a real one, which is how the two
 * would come to disagree about what a finished map is.
 *
 * The order is load-bearing and is the order both maps already had:
 *
 *   1. `collision.build()` — nothing can be probed before the tree exists.
 *   2. `deriveClimbableSurfaces()` — the climb rule, from the collision.
 *   3. `lightRoutes()` — after the rule, because a route is lit where the rule
 *      says a body arrives (B7), and before validation, which counts what was lit.
 *   4. `deriveRoomEntries()`
 *   5. `deriveWardenGround()`
 *   6. `validateMap()` — last, and it throws, so a map that fails its own
 *      contract fails the bake rather than the first round played on it.
 *
 * Layering (Section 3.1): takes a map, imports no map. mapkit.js does not
 * import this, so there is no cycle.
 */

import { lightRoutes } from './maproutelight.js';
import { validateMap } from './mapvalidate.js';

/**
 * How many slices the tail yields. `maps/index.js` adds the declaration phase
 * to get the bake's total, and `the-bake-yields-the-page-a-frame-to-paint`
 * holds a real bake to it, so a step dropped here cannot go unnoticed.
 */
export const FINISH_SLICES = 5;

/**
 * Finish a map, yielding between steps.
 *
 * @param {import('./mapkit.js').GameMap} map
 * @param {object} expects the counts this map promises, for `validateMap`
 * @yields {{label: string, map: object}} what has just been done, and the map
 *   as far as it has got - `bakeMap` hands that out as `partial`, which is what
 *   lets a caller take the map at a cut short of the whole bake (H5).
 */
export function* finishSteps(map, expects) {
  map.collision.build();
  yield { label: 'collision', map };

  map.deriveClimbableSurfaces();
  // After the rule, because the routes are lit where the rule says a body
  // arrives (B7), and before validation, which counts what was lit.
  lightRoutes(map);
  yield { label: 'the climb rule', map };

  map.deriveRoomEntries();
  yield { label: 'rooms', map };

  map.deriveWardenGround();
  yield { label: "the Warden's ground", map };

  validateMap(map, expects);
  yield { label: 'checking the map', map };
}
