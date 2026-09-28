/**
 * BLACKLINE - tests/settingsstore.js
 *
 * AUTO suite (Section 13, H7): settings that survive a reload.
 *
 * A page cannot reload itself inside a check, so what is driven instead is the
 * thing a reload actually does: write the store, throw the live values away
 * (`resetSettings`), and load from the store again. That is the same two
 * functions the boot calls, in the same order, against a real `localStorage`.
 *
 * Every store here is a **scratch one**, not the page's: a `Storage`-shaped
 * object the check owns. The page's own record belongs to whoever is playing,
 * and a check that wrote into it would hand the next run whatever this one
 * happened to leave. It also means the blocked-store case can be driven -
 * `localStorage` throws rather than returning null when site data is blocked,
 * and a game that will not start over a volume slider is a worse game than one
 * that forgets.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG, SETTINGS, resetSettings } from '../config.js';
import {
  STORE_KEY, STORE_VERSION, NOT_PERSISTED, persistedKeys,
  loadSettings, saveSettings, clearSettings, readStore,
} from '../settingsstore.js';

/** A `Storage`-shaped object backed by a Map, so a check owns its own store. */
function scratchStore() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    get size() { return map.size; },
  };
}

/** One that throws on everything, the way a blocked store does. */
function blockedStore(why = 'access is denied for this document') {
  const bang = () => { throw new DOMException(why, 'SecurityError'); };
  return { getItem: bang, setItem: bang, removeItem: bang };
}

/** A value for every persisted key that is not its default, for a round trip. */
function changedValues() {
  const defaults = CONFIG.settings.defaults;
  const lengths = Object.keys(CONFIG.match.lengths).map(Number);
  const difficulties = Object.keys(CONFIG.ai.difficulty);
  const picks = {
    mouseSensitivity: defaults.mouseSensitivity + 0.0008,
    masterVolume: 0.25,
    matchLength: lengths.find((n) => n !== defaults.matchLength),
    difficulty: difficulties.find((name) => name !== defaults.difficulty),
    invertY: !defaults.invertY,
    briefing: !defaults.briefing,
    post: !defaults.post,
    role: 'warden',
    lastMap: 'yard',
    tutorialSeen: !defaults.tutorialSeen,
  };
  const values = {};
  for (const key of persistedKeys()) {
    if (!Object.prototype.hasOwnProperty.call(picks, key)) return { values: null, missing: key };
    values[key] = picks[key];
  }
  return { values, missing: null };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-setting-changed-now-is-the-setting-a-reload-reads',
    spec: 'Section 13, H7',
    name: 'Every persisted setting written, thrown away and loaded back from the store comes out the value it went in as, and the defaults come back when nothing is stored',
    run: () => {
      const problems = [];
      const before = { ...SETTINGS };
      const store = scratchStore();
      try {
        const { values, missing } = changedValues();
        if (missing) {
          // A new setting joins `persistedKeys()` by existing, so this check
          // has to be told what a changed value of it looks like. Failing
          // here is the reminder.
          return { pass: false, detail: `this check has no changed value for the setting "${missing}"` };
        }

        // 1. Set them live, the way a settings row does, and save.
        Object.assign(SETTINGS, values);
        const saved = saveSettings(store);
        if (!saved.saved) problems.push(`the save failed: ${saved.why}`);

        // 2. Throw the live values away - which is what a reload does - and
        //    load from the store.
        resetSettings();
        for (const key of persistedKeys()) {
          if (SETTINGS[key] !== CONFIG.settings.defaults[key]) {
            problems.push(`resetSettings left ${key} at ${SETTINGS[key]}`);
          }
        }
        const loaded = loadSettings(store);
        if (loaded.ignored.length) problems.push(`the load ignored ${loaded.ignored.join(', ')}`);
        for (const key of persistedKeys()) {
          if (SETTINGS[key] !== values[key]) {
            problems.push(`${key} came back ${JSON.stringify(SETTINGS[key])}, went in ${JSON.stringify(values[key])}`);
          }
        }
        if (loaded.applied.length !== persistedKeys().length) {
          problems.push(`${loaded.applied.length} of ${persistedKeys().length} settings were applied`);
        }

        // 3. Nothing stored is the shipped defaults, not a blank.
        const empty = scratchStore();
        resetSettings();
        const none = loadSettings(empty);
        if (none.applied.length) problems.push(`an empty store applied ${none.applied.join(', ')}`);
        for (const key of persistedKeys()) {
          if (SETTINGS[key] !== CONFIG.settings.defaults[key]) {
            problems.push(`with nothing stored ${key} is ${SETTINGS[key]}, the default is ${CONFIG.settings.defaults[key]}`);
          }
        }

        // 4. The record says which version wrote it, and a version this build
        //    does not know is ignored rather than half-applied.
        const raw = JSON.parse(store.getItem(STORE_KEY));
        if (raw.v !== STORE_VERSION) problems.push(`the record is stamped v${raw.v}, this build writes v${STORE_VERSION}`);
        const stale = scratchStore();
        stale.setItem(STORE_KEY, JSON.stringify({ v: STORE_VERSION + 1, values }));
        resetSettings();
        const old = loadSettings(stale);
        if (old.applied.length) problems.push(`a record from v${STORE_VERSION + 1} applied ${old.applied.join(', ')}`);
        for (const key of persistedKeys()) {
          if (SETTINGS[key] !== CONFIG.settings.defaults[key]) problems.push(`a newer record moved ${key}`);
        }

        // 5. A record edited by hand cannot put a string where a number is
        //    read, and cannot invent a setting.
        const junk = scratchStore();
        junk.setItem(STORE_KEY, JSON.stringify({
          v: STORE_VERSION,
          values: { masterVolume: 'loud', difficulty: 7, invertY: 'yes', role: 'shade', nonsense: 1 },
        }));
        resetSettings();
        const dirty = loadSettings(junk);
        if (dirty.applied.join(',') !== 'role') {
          problems.push(`a hand-edited record applied ${dirty.applied.join(', ') || 'nothing'}, want role alone`);
        }
        if (typeof SETTINGS.masterVolume !== 'number' || typeof SETTINGS.difficulty !== 'string' || typeof SETTINGS.invertY !== 'boolean') {
          problems.push('a hand-edited record changed the type of a live setting');
        }
        if (!dirty.ignored.some((line) => line.indexOf('nonsense') === 0)) {
          problems.push('a setting this build does not have was not reported as ignored');
        }

        // 6. Reset clears the record rather than filling it with defaults, so
        //    a build that later changes one gives it to whoever reset.
        Object.assign(SETTINGS, values);
        saveSettings(store);
        const cleared = clearSettings(store);
        if (!cleared.cleared) problems.push(`the reset did not clear the store: ${cleared.why}`);
        if (store.getItem(STORE_KEY) !== null) problems.push('the reset left a record behind');
        if (readStore(store).values !== null) problems.push('the reset left readable values behind');
        for (const key of persistedKeys()) {
          if (SETTINGS[key] !== CONFIG.settings.defaults[key]) problems.push(`the reset left ${key} at ${SETTINGS[key]}`);
        }
      } finally {
        Object.assign(SETTINGS, before);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${persistedKeys().length} settings round-trip through a v${STORE_VERSION} record; an empty store, `
            + 'a newer version and a hand-edited one all leave the defaults standing; reset clears the record'
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'a-blocked-store-degrades-to-defaults-and-never-throws',
    spec: 'Section 13, H7',
    name: 'Reading, writing and clearing a store that throws all report why and leave the game on its defaults',
    run: (h) => {
      const problems = [];
      const before = { ...SETTINGS };
      try {
        const blocked = blockedStore();
        // Every entry point, because the one that throws is the one nobody
        // wrapped. A browser with site data blocked throws on access, it does
        // not return null, which is the whole reason this is a check.
        resetSettings();
        let read = null;
        try {
          read = readStore(blocked);
        } catch (error) {
          problems.push(`readStore threw: ${error && error.message}`);
        }
        if (read && read.values !== null) problems.push('a blocked store returned values');
        if (read && !/unreadable/.test(read.why)) problems.push(`a blocked read said "${read.why}"`);

        let loaded = null;
        try {
          loaded = loadSettings(blocked);
        } catch (error) {
          problems.push(`loadSettings threw: ${error && error.message}`);
        }
        if (loaded && loaded.applied.length) problems.push('a blocked store applied settings');

        let saved = null;
        try {
          saved = saveSettings(blocked);
        } catch (error) {
          problems.push(`saveSettings threw: ${error && error.message}`);
        }
        if (saved && saved.saved) problems.push('a blocked store reported a successful save');
        if (saved && !/unwritable/.test(saved.why)) problems.push(`a blocked save said "${saved.why}"`);

        SETTINGS.masterVolume = 0.33;
        let cleared = null;
        try {
          cleared = clearSettings(blocked);
        } catch (error) {
          problems.push(`clearSettings threw: ${error && error.message}`);
        }
        if (cleared && cleared.cleared) problems.push('a blocked store reported a successful clear');
        // And the live settings are still put back, because that half does
        // not need the store at all.
        if (SETTINGS.masterVolume !== CONFIG.settings.defaults.masterVolume) {
          problems.push('a blocked clear did not reset the live settings');
        }

        // With no store at all - `localStorage` undefined, which is what a
        // sandboxed frame looks like - the same, and it says so.
        resetSettings();
        const none = loadSettings(null);
        if (none.why !== 'no store' || none.applied.length) problems.push(`no store at all: "${none.why}"`);
        if (saveSettings(null).saved) problems.push('saving with no store reported success');

        // The real boot did this, and recorded what happened: a page that
        // could not read its store is a page whose settings are defaults, and
        // H12's report will want to say so.
        const boot = h.debugState.settingsStore;
        if (!boot || !Array.isArray(boot.applied) || typeof boot.why !== 'string') {
          problems.push(`the boot did not record what the store did (${JSON.stringify(boot)})`);
        }
      } finally {
        Object.assign(SETTINGS, before);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? 'a store that throws on read, write and clear reports why and leaves the defaults standing; '
            + `no store at all is the same; the boot recorded "${h.debugState.settingsStore.why}"`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-persisted-settings-are-a-census-and-name-what-they-leave-out',
    spec: 'Section 13, H7',
    name: 'Every setting is either persisted or listed as deliberately not, the settings page has a reset row, and the debug gate is not kept',
    run: (h) => {
      // F15's shape: a list that is a census and not a lever. A setting added
      // to the defaults joins `persistedKeys()` by existing, so the only way
      // to leave one out is to name it in `NOT_PERSISTED` - and naming one
      // there is a change somebody reads, not a quiet omission.
      const problems = [];
      const defaults = Object.keys(CONFIG.settings.defaults);
      const kept = persistedKeys();
      const union = [...kept, ...NOT_PERSISTED].sort();
      if (union.join(',') !== [...defaults].sort().join(',')) {
        problems.push(`persisted + not-persisted is ${union.join(',')}, the defaults are ${[...defaults].sort().join(',')}`);
      }
      for (const key of NOT_PERSISTED) {
        if (defaults.indexOf(key) === -1) problems.push(`"${key}" is named as not persisted and is not a setting`);
        if (kept.indexOf(key) !== -1) problems.push(`"${key}" is both persisted and not`);
      }
      // The one the list exists for: C1 made the debug gate off by default and
      // the URL owns it for a page load. Persisting it would turn a friend's
      // playtest build into a debug build for good.
      if (NOT_PERSISTED.indexOf('debug') === -1) problems.push('the debug gate is persisted');
      // And the three settings H5 and H6 added, which are the reason H7 exists.
      for (const key of ['role', 'lastMap', 'tutorialSeen']) {
        if (kept.indexOf(key) === -1) problems.push(`"${key}" is not kept, and H5/H6 need it to be`);
      }

      // The reset row a player can reach, on the page it belongs to.
      try {
        h.menu.show('settings');
        const row = h.menu.root.querySelector('#bl-reset');
        if (!row) problems.push('the settings page has no reset row');
        else {
          if (!row.onclick) problems.push('the reset row does nothing');
          const box = row.getBoundingClientRect();
          if (box.width < 1 || box.height < 1) problems.push(`the reset row is ${box.width}x${box.height}`);
          // And it is reachable from the keyboard, like every other row (H5).
          if (!h.menu.rows.some((entry) => entry.el === row)) problems.push('the reset row is not reachable from the keyboard');
        }
      } finally {
        h.menu.hide();
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${kept.length} settings kept, ${NOT_PERSISTED.length} named as deliberately not (${NOT_PERSISTED.join(', ')}); `
            + 'the settings page has a reset row and the keyboard reaches it'
          : problems.join('; '),
      };
    },
  });
}
