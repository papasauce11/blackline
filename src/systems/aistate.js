/**
 * BLACKLINE — systems/aistate.js
 *
 * The Warden AI's state names and the small shared helpers its three files
 * (ai.js the state machine, aiperception.js, ainav.js) all read. Split out so
 * neither of the mixins has to import the class it is mixed into.
 */

import { CONFIG } from '../config.js';
import { DEFUSE_REACH, withinDefuseReach } from './plantrule.js';

export const A = CONFIG.ai;

/**
 * A charge on a crate top is not on the Warden's ground; the Warden works on
 * it from the nearest cell within the defuse reach. The same two numbers the
 * plant rule reads (`DEFUSE_REACH` in systems/objective.js reads them from
 * config too), so where the AI walks to and where the defuse counts from
 * cannot drift apart. This is the snap every goal is planned with.
 */
export const DEFUSE_SNAP = { radius: CONFIG.round.siteRadius, dy: CONFIG.round.defuseReachY };

/**
 * The snap DEFEND stands by (B5d, D27): the reach itself, asked of this
 * map's world, so the cell the Warden walks to is one the defuse counts
 * from - not the nearest cell inside the distances, which under a duct is
 * a cell the line through the duct's floor refuses.
 */
export function defuseSnapFor(map) {
  return {
    radius: DEFUSE_REACH.radius,
    dy: DEFUSE_REACH.dy,
    accepts: (cell, at) => withinDefuseReach(cell, at, map.collision),
  };
}

export const AI_STATE = {
  PATROL: 'patrol',
  SUSPICIOUS: 'suspicious',
  INVESTIGATE: 'investigate',
  ENGAGE: 'engage',
  SEARCH: 'search',
  DEFEND: 'defend',
  STUNNED: 'stunned',
};

/** States in which a stuck actor means something has gone wrong. */
export const MOVING_STATES = [AI_STATE.PATROL, AI_STATE.INVESTIGATE, AI_STATE.ENGAGE, AI_STATE.SEARCH, AI_STATE.DEFEND];

const TAU = Math.PI * 2;

/** Shortest signed angle from `from` to `to`. */
export function angleDelta(from, to) {
  let delta = (to - from) % TAU;
  if (delta > Math.PI) delta -= TAU;
  if (delta < -Math.PI) delta += TAU;
  return delta;
}
