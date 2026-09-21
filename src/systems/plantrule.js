/**
 * BLACKLINE — systems/plantrule.js
 *
 * The plant rule (Block A, D5, D20, D27): *a plant is legal exactly where a
 * Warden could stand and defuse it, and it is not inside anything.* One
 * reach, one headroom, three predicates. The defuse in objective.js asks
 * `withinDefuseReach()` of the Warden; `canPlantAt()` asks the same predicate
 * of every cell of Warden ground near the charge (A1's `map.wardenGround`),
 * so the two cannot drift - the same trick `classifyReach()` plays for the
 * map and the traversal controller. Since B5d the reach is a clear line as
 * well as two distances (D27: no defusing through a floor), so both ask it
 * of the collision world too. objective.js re-exports all of it and wraps
 * the predicates as methods; the checks in tests/plantrule.js,
 * tests/plantcensus.js and tests/defuseline.js move the constants and the
 * world and assert the game moves with them.
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
 * The line (B5d, D27). Josh, asked whether a Warden on the deck may defuse a
 * charge on the duct roof under it, through the slab: "no". So the reach is
 * also a clear line: from some point of the segment from the Warden's feet
 * to its raised hands (`DEFUSE_REACH.dy` up), the charge is in open air -
 * no solid box on the way, glass included. The segment is sampled at
 * `samples` heights, the feet and the hands among them, each `skin` off the
 * floor the Warden stands on and the charge `skin` off the surface it rests
 * on, so neither end starts inside the box it touches. A Warden beside a
 * crate still reaches the charge on top of it - from its hands, over the
 * crate's edge - and a Warden on the floor beside a charge sees it from its
 * feet; a Warden over a floor does not see through the floor. Every solid
 * box counts, whatever it blocks the sight of: you cannot reach through
 * glass either. Not frozen, for the reason `DEFUSE_REACH` is not.
 */
export const DEFUSE_LINE = {
  samples: 6,
  skin: 0.1,
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

/** Reused so the per-step line probe allocates nothing. */
const LINE_FROM = { x: 0, y: 0, z: 0 };
const LINE_TO = { x: 0, y: 0, z: 0 };
/** Every solid box is in the way of a hand, whatever it does to a sight line. */
const SOLID = (box) => box.solid;

/**
 * Is a Warden with its feet at `foot` close enough to a charge at `at` to
 * kneel down and work on it, with nothing in the way? The one place the
 * reach is measured: the two distances of `DEFUSE_REACH`, then the clear
 * line of `DEFUSE_LINE`, asked of `collision` (the map's world) - which is
 * required, so no caller can measure the distances alone and call it the
 * reach.
 *
 * @param {{x:number,y:number,z:number}} foot Warden foot position
 * @param {{x:number,y:number,z:number}} at charge position
 * @param {import('../physics.js').CollisionWorld} collision
 */
export function withinDefuseReach(foot, at, collision) {
  if (!collision) throw new Error('withinDefuseReach needs the collision world (B5d)');
  const dx = at.x - foot.x;
  const dz = at.z - foot.z;
  const dy = Math.abs(at.y - foot.y);
  if (dx * dx + dz * dz > DEFUSE_REACH.radius * DEFUSE_REACH.radius || dy >= DEFUSE_REACH.dy) return false;
  LINE_TO.x = at.x;
  LINE_TO.y = at.y + DEFUSE_LINE.skin;
  LINE_TO.z = at.z;
  LINE_FROM.x = foot.x;
  LINE_FROM.z = foot.z;
  const bottom = foot.y + DEFUSE_LINE.skin;
  const top = foot.y + DEFUSE_REACH.dy;
  const last = Math.max(1, DEFUSE_LINE.samples - 1);
  for (let i = 0; i <= last; i++) {
    LINE_FROM.y = bottom + (top - bottom) * (i / last);
    if (collision.lineOfSight(LINE_FROM, LINE_TO, SOLID)) return true;
  }
  return false;
}

/** Reused so the per-step headroom probe allocates nothing. */
const HEADROOM_AT = { x: 0, y: 0, z: 0 };
const HEADROOM_HALF = { x: 0, y: 0, z: 0 };
/**
 * `someCellWithin`'s test and its context, as module constants rather than
 * closures, so the gate allocates nothing at all on the step it runs.
 */
const REACH_CONTEXT = { at: null, collision: null };
const REACHES = (cell, context) => withinDefuseReach(cell, context.at, context.collision);

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
 * predicate the defuse itself asks, of the same constants and the same
 * world - of every cell of Warden-reachable ground near the point (A1's
 * `map.wardenGround`). The two cannot drift, the same trick
 * `classifyReach()` plays for the map and the traversal controller. Since
 * B5d a cell over the charge with a floor between them is not a place to
 * defuse from (D27), and a cell beside a crate still is.
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
 * @param {import('../mapkit.js').GameMap} map
 * @param {{x:number,y:number,z:number}} at a foot position for the charge
 * @returns {boolean}
 */
export function canDefuseAt(map, at) {
  REACH_CONTEXT.at = at;
  REACH_CONTEXT.collision = map.collision;
  const answer = map.wardenGround.someCellWithin(at, DEFUSE_REACH.radius, REACHES, REACH_CONTEXT);
  REACH_CONTEXT.at = null;
  REACH_CONTEXT.collision = null;
  return answer;
}

/**
 * Is there a standing body's worth of open air above this spot? The D20
 * clause: a charge with a lid on it is inside something. See
 * `PLANT_HEADROOM` for why it is a headroom test and not a list of ducts.
 *
 * @param {import('../mapkit.js').GameMap} map
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
 * @param {import('../mapkit.js').GameMap} map
 * @param {{x:number,y:number,z:number}} at a foot position for the charge
 */
export function canPlantAt(map, at) {
  return canDefuseAt(map, at) && hasHeadroomAt(map, at);
}
