/**
 * BLACKLINE - bindingstore.js
 *
 * A rebind survives a reload (H19). H7's store keeps `SETTINGS`, and a keymap
 * is not a setting: it is the Input's own map of action to codes, rebuilt by
 * H8's controls page one row at a time. So it gets its own versioned record
 * beside the settings one, written when a row is rebound or reset and read
 * once when the Input is built.
 *
 * **The rule for a record this build does not fully recognise** is the
 * settings store's, in the shape a map needs: an action this build has, with a
 * list of strings for codes, is applied; anything else - an action that no
 * longer exists, a code that is not a string - is dropped and named, and the
 * rest of the record still applies. A keymap from an older build with one
 * renamed action loses that one row, not the player's whole layout.
 *
 * Everything here degrades exactly as `settingsstore.js` does: no store, a
 * blocked store, a record that will not parse, and the defaults stand.
 *
 * Layering (Section 3.1): imports config only.
 */

import { DEFAULT_BINDINGS } from './config.js';

export const BINDINGS_KEY = 'blackline.bindings.v1';
export const BINDINGS_VERSION = 1;

function defaultStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Apply a stored keymap onto an Input, row by row.
 *
 * @param {import('./input.js').Input} input
 * @param {Storage} [storage]
 * @returns {{applied: string[], ignored: string[], why: string}}
 */
export function loadBindings(input, storage = defaultStorage()) {
  const applied = [];
  const ignored = [];
  if (!storage) return { applied, ignored, why: 'no store' };
  let record;
  try {
    const raw = storage.getItem(BINDINGS_KEY);
    if (raw === null) return { applied, ignored, why: 'nothing stored' };
    record = JSON.parse(raw);
  } catch (error) {
    return { applied, ignored, why: `stored keymap unreadable: ${error && error.message}` };
  }
  if (!record || typeof record !== 'object') return { applied, ignored, why: 'stored keymap is not an object' };
  if (record.v !== BINDINGS_VERSION) return { applied, ignored, why: `stored keymap version ${record.v}, this build writes ${BINDINGS_VERSION}` };
  const map = record.bindings;
  if (!map || typeof map !== 'object') return { applied, ignored, why: 'stored keymap carries no bindings' };
  for (const action of Object.keys(map)) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_BINDINGS, action)) {
      ignored.push(`${action} (not an action this build has)`);
      continue;
    }
    const codes = map[action];
    if (!Array.isArray(codes) || !codes.length || codes.some((code) => typeof code !== 'string' || !code)) {
      ignored.push(`${action} (codes are not a list of names)`);
      continue;
    }
    input.setBinding(action, codes);
    applied.push(action);
  }
  return { applied, ignored, why: 'read' };
}

/**
 * Write the Input's keymap. Called when a decision was made - a row rebound,
 * a row reset - and never on a timer.
 *
 * @param {import('./input.js').Input} input
 * @param {Storage} [storage]
 * @returns {{saved: boolean, why: string}}
 */
export function saveBindings(input, storage = defaultStorage()) {
  if (!storage) return { saved: false, why: 'no store' };
  const bindings = {};
  for (const action of Object.keys(input.bindings)) bindings[action] = input.bindings[action].slice();
  try {
    storage.setItem(BINDINGS_KEY, JSON.stringify({ v: BINDINGS_VERSION, bindings }));
    return { saved: true, why: 'saved' };
  } catch (error) {
    return { saved: false, why: `store unwritable: ${error && error.message}` };
  }
}
