/**
 * BLACKLINE — matchstate.js
 *
 * Match-level state: what `initMatch` is asked for, defaulted, and the record
 * it builds. Round-level state has its own factory in systems/objective.js.
 */

import { CONFIG, SETTINGS } from './config.js';

/** The competitive match the menu's Play button starts. */
export const COMPETITIVE = Object.freeze({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
/** Section 12: free-roam, the human on the Warden, nothing to fight. */
export const FREEROAM = Object.freeze({ mode: 'freeroam', role: 'warden', ai: false, objective: false });

/**
 * What the page boots into. Section 12: free-roam is a configuration of
 * initMatch, never a second code path; `?mode=freeroam` selects it under
 * the debug gate (`SETTINGS.debug`, set from `?debug=1` before this runs) so
 * the Warden controller can be driven by hand. The menu's Free roam button
 * is the player's way in and is not gated.
 */
export function bootMatchOptions(search) {
  const freeroam = SETTINGS.debug && /(?:^|[?&])mode=freeroam(?:&|$)/.test(search);
  return freeroam ? FREEROAM : COMPETITIVE;
}

/**
 * Fill in what the caller left out. Section 12: free-roam is a configuration
 * of the same call, so the defaults are the competitive match and every
 * field can be overridden. The live settings (`SETTINGS.x`, never
 * `CONFIG.settings.defaults.x`) seed the length and the difficulty.
 */
export function resolveMatchOptions(options = {}) {
  return {
    mode: 'competitive',
    role: CONFIG.match.humanRole,
    ai: true,
    objective: true,
    matchLength: SETTINGS.matchLength,
    difficulty: SETTINGS.difficulty,
    ...options,
  };
}

/**
 * Defaults factory for match-level mutable state (Section 15). Every field is
 * rebuilt here so nothing can carry between matches by accident.
 */
export function createMatchState(options, seed) {
  const length = CONFIG.match.lengths[options.matchLength] ? options.matchLength : CONFIG.match.defaultLength;
  return {
    mode: options.mode,
    role: options.role,
    aiEnabled: options.ai,
    objectiveEnabled: options.objective,
    difficulty: options.difficulty,
    seed,
    matchLength: length,
    winsNeeded: CONFIG.match.lengths[length],
    roundNumber: 1,
    score: { shade: 0, warden: 0 },
    rounds: [],
    over: false,
  };
}
