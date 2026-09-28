/**
 * BLACKLINE — settingsstore.js
 *
 * `SETTINGS` across a reload (H7). Three jobs before this one put a decision
 * in `SETTINGS` and had to say "until H7": the role row and the last map
 * chosen (H5), and whether this browser has been offered the tutorial (H6).
 * This is what makes those sentences true.
 *
 * **Everything here degrades.** `localStorage` throws rather than returning
 * null in a browser with site data blocked, in some private windows, and
 * inside a sandboxed frame — and a game that will not start because it could
 * not remember a volume slider is a worse game than one that forgets. So
 * every access is wrapped, every failure returns a reason, and the reason is
 * carried rather than thrown. The game runs on defaults and says so in the
 * report H12 will produce.
 *
 * **It is versioned, and a version it does not know is ignored, not migrated.**
 * What is stored is a handful of player preferences; the cost of losing them
 * on a format change is one trip through the settings page, and the cost of a
 * migration path nobody exercises is a bug that only ever shows up on someone
 * else's machine.
 *
 * **It stores a declared list and not "whatever is in SETTINGS".** A value
 * read back is only applied when the defaults have that key and the type
 * matches, so a store someone has edited by hand cannot put a string where
 * the game reads a number. The list is held to the defaults by
 * `the-persisted-settings-are-a-census-and-name-what-they-leave-out`.
 *
 * Layering (Section 3.1): imports config only, as `version.js` does. The
 * composition root loads at boot and the menu saves on a decision.
 */

import { CONFIG, SETTINGS, resetSettings } from './config.js';

/** Where it lives. Namespaced, because a Pages host is shared with every other project on it. */
export const STORE_KEY = 'blackline.settings.v1';

/**
 * The shape version, inside the record as well as in the key. Both, because
 * the key catches a change this code knows about and the field catches a
 * record written by something that did not.
 */
export const STORE_VERSION = 1;

/**
 * What is **not** kept across a reload, and why. Everything else in
 * `CONFIG.settings.defaults` is.
 *
 * `debug` is the only one. The debug gate is a property of a page load and
 * the URL owns it (`?debug=1`, C1); the AUTO suite turns it on for the length
 * of a run. Persisting it would mean one visit to the settings page turns a
 * friend's playtest build into a debug build for good, with the test keys
 * live, and nothing on screen to say why.
 */
export const NOT_PERSISTED = ['debug'];

/** The keys this saves and loads, derived from the defaults so a new setting joins by existing. */
export function persistedKeys() {
  return Object.keys(CONFIG.settings.defaults).filter((key) => NOT_PERSISTED.indexOf(key) === -1);
}

/**
 * The store, defaulted. Taken as an argument everywhere below so a check can
 * drive a blocked one without having to be run in a browser that blocks it -
 * the same trick `bootscreen.js` plays with `matchMedia` (H4).
 */
function defaultStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Reading the property itself throws in a sandboxed frame.
    return null;
  }
}

/**
 * Read the record, if there is a usable one.
 *
 * @param {Storage} [storage]
 * @returns {{values: object|null, why: string}}
 */
export function readStore(storage = defaultStorage()) {
  if (!storage) return { values: null, why: 'no store' };
  let raw = null;
  try {
    raw = storage.getItem(STORE_KEY);
  } catch (error) {
    return { values: null, why: `store unreadable: ${error && error.message}` };
  }
  if (raw === null || raw === undefined) return { values: null, why: 'nothing stored' };
  let record = null;
  try {
    record = JSON.parse(raw);
  } catch {
    return { values: null, why: 'stored record is not JSON' };
  }
  if (!record || typeof record !== 'object') return { values: null, why: 'stored record is not an object' };
  if (record.v !== STORE_VERSION) return { values: null, why: `stored version ${record.v}, this build writes ${STORE_VERSION}` };
  if (!record.values || typeof record.values !== 'object') return { values: null, why: 'stored record carries no values' };
  return { values: record.values, why: 'read' };
}

/**
 * Put the stored values onto `SETTINGS`, one key at a time, taking only what
 * the defaults recognise at the type the defaults have. Returns what happened,
 * for the report and for the check.
 *
 * @param {Storage} [storage]
 * @returns {{applied: string[], ignored: string[], why: string}}
 */
export function loadSettings(storage = defaultStorage()) {
  const { values, why } = readStore(storage);
  const applied = [];
  const ignored = [];
  if (!values) return { applied, ignored, why };
  for (const key of persistedKeys()) {
    if (!Object.prototype.hasOwnProperty.call(values, key)) continue;
    const want = CONFIG.settings.defaults[key];
    const got = values[key];
    // `lastMap` is the one default that is null, so its type is whatever the
    // registry's ids are: a string, or null for "nothing chosen".
    const ok = want === null
      ? (got === null || typeof got === 'string')
      : (typeof got === typeof want);
    if (!ok) {
      ignored.push(`${key} (${typeof got}, want ${want === null ? 'string or null' : typeof want})`);
      continue;
    }
    SETTINGS[key] = got;
    applied.push(key);
  }
  for (const key of Object.keys(values)) {
    if (persistedKeys().indexOf(key) === -1) ignored.push(`${key} (not a setting this build has)`);
  }
  return { applied, ignored, why };
}

/**
 * Write the live settings. Called when a decision has been made - a row
 * changed, a match started, the tutorial finished - and never on a timer,
 * because there is no timer (Section 9 and 15 ban one and F13 holds the ban).
 *
 * @param {Storage} [storage]
 * @returns {{saved: boolean, why: string}}
 */
export function saveSettings(storage = defaultStorage()) {
  if (!storage) return { saved: false, why: 'no store' };
  const values = {};
  for (const key of persistedKeys()) values[key] = SETTINGS[key];
  try {
    storage.setItem(STORE_KEY, JSON.stringify({ v: STORE_VERSION, values }));
    return { saved: true, why: 'saved' };
  } catch (error) {
    // A full quota, a blocked store, a private window. The game carries on.
    return { saved: false, why: `store unwritable: ${error && error.message}` };
  }
}

/**
 * Back to the shipped defaults, and forget what was stored. What the settings
 * page's *Reset* row does.
 *
 * It clears the record rather than writing the defaults into it, so a build
 * that later changes a default gives it to someone who has reset, which is
 * what resetting asked for.
 *
 * @param {Storage} [storage]
 * @returns {{cleared: boolean, why: string}}
 */
export function clearSettings(storage = defaultStorage()) {
  resetSettings();
  if (!storage) return { cleared: false, why: 'no store' };
  try {
    storage.removeItem(STORE_KEY);
    return { cleared: true, why: 'cleared' };
  } catch (error) {
    return { cleared: false, why: `store unwritable: ${error && error.message}` };
  }
}
