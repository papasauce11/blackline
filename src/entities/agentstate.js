/**
 * BLACKLINE — entities/agentstate.js
 *
 * The Shade's state names, shared by the three files of the controller
 * (agent.js, agenttraversal.js, agentvisual.js) and re-exported from
 * agent.js, which is where everything else imports them from.
 */

export const SHADE_STATE = {
  GROUND: 'ground',
  AIR: 'air',
  SLIDE: 'slide',
  VAULT: 'vault',
  MANTLE: 'mantle',
  /** The short reach to a lip that every mantle-height climb starts with (D21). */
  GRAB: 'grab',
  HANG: 'hang',
  PULLUP: 'pullup',
};
