/**
 * BLACKLINE — systems/plantrule.js
 *
 * The plant rule (Block A, D5, D20): *a plant is legal exactly where a Warden
 * could stand and defuse it, and it is not inside anything.* One reach, one
 * headroom, three predicates. The defuse in objective.js asks
 * `withinDefuseReach()` of the Warden; `canPlantAt()` asks the same predicate
 * of every cell of Warden ground near the charge (A1's `map.wardenGround`),
 * so the two cannot drift - the same trick `classifyReach()` plays for the
 * map and the traversal controller. objective.js re-exports all of it and
 * wraps the predicates as methods; the checks in tests/plantrule.js and
 * tests/plantcensus.js move the constants and assert the game moves with them.
 *
 * Layering (Section 3.1): imports config only. The map is handed in.
 */

import { CONFIG } from '../config.js';

const R = CONFIG.round;

/**
 * How close a Warden has to be to a charge to work on it. One object, because
 * the plant rule Block A is building - *a plant is legal exactly where a
 * Warden could stand and defuse it* (D5) - is only honest while both sides
 * measure the same reach. Two copies of these numbers is two rules, and the
 * one the player meets is whichever drifted.
 *
 * Not frozen on purpose: a check moves these and asserts both sides move with
 * them. A derived answer that agrees with its own constant proves nothing (the
 * A1 lesson in HANDOFF.md); the proof is that raising the constant changes the
 * game.
 *
 * The horizontal reach is `round.siteRadius` - arm's length, never a marking.
 *
 * The vertical one, 2.5m, is decided (A6, D5, D20): a Warden standing beside a
 * 2m crate reaches up to a charge on top of it, and that is the case D5 was
 * written for - "on or beside". It was the literal `dy < 2.5` from when plant
 * and defuse were both pinned to a site centre, and the census (A5) measured
 * what it buys before it was kept: of 373 places a charge can go inside a site
 * room, the vertical reach refuses none on its own; the horizontal one does the
 * excluding. What 2.5m also let through was a charge inside a duct 2.3m up,
 * defused from underneath. That is not settled here by shrinking the reach -
 * a crate top would go with it - but by `PLANT_HEADROOM` below, which is the
 * clause D20 actually asked for.
 */
export const DEFUSE_REACH = {
  radius: R.siteRadius,
  dy: R.defuseReachY,
};

/**
 * A charge cannot be *inside* anything (D20). Josh, on finding that every duct
 * in a site room was a legal plant: "can't plant inside things. only on top."
 *
 * Read mechanically, never by name, because the redesign's binding rule is
 * that the map obeys tests and carries no tags: a spot is inside something when
 * there is a lid on it lower than a standing body. That is the same headroom
 * `standableFloors()` demands before a cell counts as Warden ground, asked of
 * the charge instead of the Warden. A duct fails by its roof; a crate top, a
 * floor or an open gantry passes by the air above it.
 *
 * The column probed is a charge's footprint, not a body's: a charge tucked
 * against a wall on a crate top is still on top of the crate. Not frozen, for
 * the same reason as `DEFUSE_REACH` - a check lowers `height` under a duct
 * roof and asserts the duct becomes plantable.
 */
export const PLANT_HEADROOM = {
  radius: 0.15,
  height: CONFIG.warden.standHeight,
};
/** Lift the probe off the surface the charge rests on, as the solver's skin does. */
const HEADROOM_SKIN = 0.05;

/**
 * Is a Warden with its feet at `foot` close enough to a charge at `at` to
 * kneel down and work on it? The one place the reach is measured.
 *
 * @param {{x:number,y:number,z:number}} foot Warden foot position
 * @param {{x:number,y:number,z:number}} at charge position
 */
export function withinDefuseReach(foot, at) {
  const dx = at.x - foot.x;
  const dz = at.z - foot.z;
  const dy = Math.abs(at.y - foot.y);
  return dx * dx + dz * dz <= DEFUSE_REACH.radius * DEFUSE_REACH.radius
    && dy < DEFUSE_REACH.dy;
}

/** Reused so the per-step headroom probe allocates nothing. */
const HEADROOM_AT = { x: 0, y: 0, z: 0 };
const HEADROOM_HALF = { x: 0, y: 0, z: 0 };
/**
 * `someCellWithin`'s test, as a module constant rather than a closure, so the
 * gate allocates nothing at all on the step it runs.
 */
const REACHES = (cell, at) => withinDefuseReach(cell, at);

/**
 * Could a Warden ever defuse a charge left here?
 *
 * The room says which volume the objective is about; this says which parts
 * of that volume the Warden can answer for. The Warden stays grounded and
 * the Shade does not, so inside a site's room there are gantries, crate
 * tops, vent roofs and deck lips where a plant would be unloseable - and
 * worse than unloseable, since `setDefendTarget()` would send the AI at a
 * charge it cannot reach and strand it in DEFEND for the whole fuse.
 *
 * It is not a second authored zone. It asks `withinDefuseReach()` - the same
 * predicate the defuse itself asks, of the same constants - of every cell of
 * Warden-reachable ground near the point (A1's `map.wardenGround`). The two
 * cannot drift, the same trick `classifyReach()` plays for the map and the
 * traversal controller.
 *
 * Asked every step of a plant hold (A3), so it scans the grid without
 * building a list - `someCellWithin()` rather than `cellsWithin()`.
 *
 * One approximation worth knowing: the ground is a 0.5m grid and the cells
 * are tested at their centres, so a `false` here can be over-strict by up to half a
 * cell - a spot the Warden could just barely reach, refused. It is never
 * over-permissive: every cell returned is a place the fill proved a standing
 * body fits. That is the safe side of D5, and the same direction D16 chose.
 *
 * @param {import('../map.js').GameMap} map
 * @param {{x:number,y:number,z:number}} at a foot position for the charge
 * @returns {boolean}
 */
export function canDefuseAt(map, at) {
  return map.wardenGround.someCellWithin(at, DEFUSE_REACH.radius, REACHES, at);
}

/**
 * Is there a standing body's worth of open air above this spot? The D20
 * clause: a charge with a lid on it is inside something. See
 * `PLANT_HEADROOM` for why it is a headroom test and not a list of ducts.
 *
 * @param {import('../map.js').GameMap} map
 * @param {{x:number,y:number,z:number}} at a foot position for the charge
 */
export function hasHeadroomAt(map, at) {
  HEADROOM_HALF.x = PLANT_HEADROOM.radius;
  HEADROOM_HALF.y = PLANT_HEADROOM.height / 2;
  HEADROOM_HALF.z = PLANT_HEADROOM.radius;
  HEADROOM_AT.x = at.x;
  HEADROOM_AT.y = at.y + HEADROOM_SKIN + HEADROOM_HALF.y;
  HEADROOM_AT.z = at.z;
  return map.collision.isClear(HEADROOM_AT, HEADROOM_HALF);
}

/**
 * Could a charge be left here at all? The whole plant rule, and the one
 * question the gate in `_stepPlant()` asks: a Warden could defuse it (D5)
 * and it is not inside anything (D20). Both halves are mechanical; neither
 * knows a duct or a crate by name.
 *
 * @param {import('../map.js').GameMap} map
 * @param {{x:number,y:number,z:number}} at a foot position for the charge
 */
export function canPlantAt(map, at) {
  return canDefuseAt(map, at) && hasHeadroomAt(map, at);
}
