/**
 * BLACKLINE — systems/roundstate.js
 *
 * The round's vocabulary and its state factory (Section 10), split from
 * objective.js for the 600-line guard when C4 gave a round its outcome and
 * its timeline. objective.js re-exports everything here, so nothing that
 * reads `CHARGE` or `createRoundState` from there has moved.
 *
 * Layering (Section 3.1): imports config only.
 */

import { CONFIG } from '../config.js';

const R = CONFIG.round;

export const CHARGE = {
  CARRIED: 'carried',
  PLANTED: 'planted',
  DEFUSED: 'defused',
  DETONATED: 'detonated',
};

export const ROUND = {
  ACTIVE: 'active',
  ENDED: 'ended',
};

/**
 * How a round ended - Section 10.4's four rows, one word each, so the end
 * screen (C4) can say it without parsing the reason string.
 */
export const OUTCOME = {
  DETONATED: 'detonated',
  DEFUSED: 'defused',
  ELIMINATED: 'eliminated',
  TIME: 'time',
};

/**
 * Every mutable thing a round owns. A defaults factory, not a reset method:
 * a new object cannot inherit a field somebody forgot to clear.
 */
export function createRoundState(number) {
  return {
    number,
    state: ROUND.ACTIVE,
    timeRemaining: R.duration,
    elapsed: 0,
    charge: CHARGE.CARRIED,
    site: null,
    /**
     * Where the charge actually is, once planted. The plant is free within the
     * room, so the site id says which room and this says which spot - the
     * Warden has to walk to the charge, not to the middle of the floor.
     */
    chargeAt: null,
    plantProgress: 0,
    plantNoiseTimer: 0,
    /**
     * Is the Shade holding interact somewhere the Warden could never defuse?
     * One step's answer, not a latch: the HUD line D6 decided is the only
     * thing a refused plant produces, and a line that outlived the hold would
     * be a rule the player cannot un-trigger.
     */
    plantRefused: false,
    defuseProgress: 0,
    defuseRetain: 0,
    detonationTimer: 0,
    /** Section 14's plant beep. Shortens as the detonation clock runs down. */
    beepTimer: 0,
    lives: CONFIG.shade.lives,
    reinsertTimer: 0,
    awaitingReinsert: false,
    deathPosition: null,
    lastSpawnIndex: 0,
    takedowns: 0,
    // Section 10.3: each milestone fires at most once per round.
    milestones: { plant: false, takedown: false },
    winner: null,
    reason: null,
    /** One of OUTCOME once the round has ended. */
    outcome: null,
    /**
     * What happened, in order, as `{ t, text }` with `t` the round's elapsed
     * seconds: the plant, each life lost and reinsert, each Warden down, and
     * the end. The end screen (C4) prints it; it is the objective's own view
     * of the round, so it cannot disagree with the result.
     */
    timeline: [{ t: 0, text: `round ${number} begins` }],
    /**
     * Section 10.5's intermission comes `roundEndDelay` after the end, not in
     * the step that ended it, so the player sees what happened before the
     * card covers it. Counts down on the sim clock from the end; the event
     * fires once.
     */
    endTimer: 0,
    intermission: false,
  };
}
