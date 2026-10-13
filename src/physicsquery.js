/**
 * BLACKLINE — physicsquery.js
 *
 * The collision world's read-only queries: cast a ray, and ask whether two
 * points can see each other. Nothing here moves an actor.
 *
 * Split out of `physics.js` (H56), which stood at exactly 600 of Section 3.1's
 * ~600 lines — no headroom at all in the swept solver, the hottest code in the
 * game and the one module where a behaviour change is a rule change. These two
 * methods are the half of it that only *reads*: they resolve no contact and
 * write no position, which is what makes them the honest seam. `sweep`,
 * `depenetrate`, `moveAndSlide` and the step-up stay together, because they are
 * one algorithm.
 *
 * Methods of `CollisionWorld`, kept in their own file on F3's model and exactly
 * as `agenttraversal.js`, `ainav.js` and `mapgen.js` are: `physics.js` installs
 * them on the prototype, so `this` is the world, `this.query` is the same
 * broadphase, and all **53** call sites of `world.raycast` and
 * `world.lineOfSight` under `src/` are untouched. Free functions taking the
 * world — `mapclimb.js`'s shape, and the one H56 named as fitting this codebase
 * — would have been 53 edits through the hot path in the job whose whole
 * promise is that nothing behaves differently afterwards.
 *
 * The scratch vectors are imported from `physicsscratch.js` and are the
 * solver's own, not a copy of them: that file's header says why, and
 * `tests/solverquery.js` holds it.
 *
 * Layering (Section 3.1): imports `collisionbox.js` and `physicsscratch.js`,
 * and nothing else. No Three.js, as `physics.js`.
 */

import { EPSILON, raySlab } from './collisionbox.js';
import { scratch, set } from './physicsscratch.js';

/** @typedef {import('./collisionbox.js').CollisionBox} CollisionBox */

/**
 * The sight rule a line-of-sight query uses when the caller names none: a box
 * blocks sight if it says it does. Exported so that a check can ask the live
 * rule rather than restate it — a test that rewrites the default can only ever
 * agree with itself.
 */
export function defaultSightFilter(box) {
  return box.blocksSight;
}

export const QUERY = {
  /**
   * Cast a ray and return the nearest hit.
   *
   * Used by light sampling (Section 7.1), AI perception (Section 11), hitscan
   * (Section 8.1), and the per-step grenade tunnelling check (Section 9).
   *
   * @param {object} origin
   * @param {object} direction assumed normalised
   * @param {number} maxDistance
   * @param {(box: CollisionBox) => boolean} [filter]
   * @returns {{distance:number, box:CollisionBox, nx:number, ny:number,
   *            nz:number, x:number, y:number, z:number}|null}
   */
  raycast(origin, direction, maxDistance, filter) {
    const delta = set(scratch.delta, direction.x * maxDistance, direction.y * maxDistance, direction.z * maxDistance);

    const min = scratch.min;
    const max = scratch.max;
    min.x = Math.min(origin.x, origin.x + delta.x);
    min.y = Math.min(origin.y, origin.y + delta.y);
    min.z = Math.min(origin.z, origin.z + delta.z);
    max.x = Math.max(origin.x, origin.x + delta.x);
    max.y = Math.max(origin.y, origin.y + delta.y);
    max.z = Math.max(origin.z, origin.z + delta.z);

    const candidates = this.query(min, max);
    let best = null;

    for (let i = 0; i < candidates.length; i++) {
      const box = candidates[i];
      if (filter && filter(box) === false) continue;
      const hit = raySlab(origin, delta, box.min, box.max);
      if (!hit || hit.t < 0) continue;
      if (!best || hit.t < best.t) best = { t: hit.t, nx: hit.nx, ny: hit.ny, nz: hit.nz, box };
    }

    if (!best) return null;
    return {
      distance: best.t * maxDistance,
      box: best.box,
      nx: best.nx,
      ny: best.ny,
      nz: best.nz,
      x: origin.x + delta.x * best.t,
      y: origin.y + delta.y * best.t,
      z: origin.z + delta.z * best.t,
    };
  },

  /**
   * Is the straight line between two points unobstructed?
   * The workhorse for light sampling and AI perception.
   */
  lineOfSight(from, to, filter) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distance < EPSILON) return true;
    const inv = 1 / distance;
    const direction = set(scratch.normal, dx * inv, dy * inv, dz * inv);
    const sightFilter = filter || defaultSightFilter;
    const hit = this.raycast(from, direction, distance, sightFilter);
    return hit === null;
  },
};
