/**
 * BLACKLINE - tests/bindingstore.js
 *
 * AUTO suite (H19): a rebind survives a reload, and a stored keymap naming an
 * action this build does not have applies the rest of itself.
 *
 * Read and written through an in-memory store with the `Storage` shape, so a
 * run never touches the browser's own record (TRAPS.md: a setting outlives
 * the page). The live map is thrown away the way a reload does - back to the
 * shipped defaults - and loaded back; then a climb is driven on the restored
 * key through the input layer, which is the only proof a keymap means
 * anything.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG, DEFAULT_BINDINGS } from '../config.js';
import { loadBindings, saveBindings, BINDINGS_KEY, BINDINGS_VERSION } from '../bindingstore.js';
import { findGroundLedge, driveAtLedge } from './climbpress.js';

/** A `Storage` over a Map: what the store reads and writes, and nothing else. */
function memoryStore() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  };
}

/** The key the restored jump is bound to: one nothing else in the map uses. */
const REBOUND = 'KeyJ';

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-rebind-survives-a-reload-and-a-dead-action-drops-alone',
    spec: 'H19',
    name: 'A key rebound and stored is the key after the map is thrown away and loaded back, a climb is driven on it, and a stored action this build lacks is dropped while the rest applies',
    run: (h) => {
      const problems = [];
      const input = h.input;
      const before = {};
      for (const action of Object.keys(input.bindings)) before[action] = input.bindings[action].slice();
      let climbed = null;
      let deadReport = null;
      try {
        // 1. Rebind, store, throw the live map away, load it back.
        const store = memoryStore();
        input.resetBindings();
        input.rebind('jump', REBOUND, 0);
        const saved = saveBindings(input, store);
        if (!saved.saved) problems.push(`the keymap did not save: ${saved.why}`);
        input.resetBindings();
        if (input.getBinding('jump')[0] === REBOUND) problems.push('throwing the map away left the rebind in place, so the load below proves nothing');
        const loaded = loadBindings(input, store);
        if (input.getBinding('jump')[0] !== REBOUND) {
          problems.push(`after a load the jump is ${input.getBinding('jump').join('/') || 'unbound'}, want ${REBOUND} (${loaded.why})`);
        }

        // 2. And it is the key: a climb, driven on it, at a ledge the probe offers.
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
        h.menu.hide();
        const spot = findGroundLedge(h, 0.5, CONFIG.shade.reach.vaultTop);
        if (!spot) {
          problems.push('no vault-height ledge with a clear approach on this map, so the restored key drove nothing');
        } else {
          climbed = driveAtLedge(h, spot, { airborne: false, pressAt: 5, hold: true, steps: 90, code: REBOUND });
          if (!climbed.onTop) problems.push(`holding ${REBOUND} at ${spot.box.tag || 'a ledge'} did not climb it (feet ${climbed.feet.toFixed(2)})`);
        }

        // 3. A record from another build: one dead action, one live one.
        const old = memoryStore();
        old.setItem(BINDINGS_KEY, JSON.stringify({ v: BINDINGS_VERSION, bindings: { jump: [REBOUND], teleport: ['KeyT'], crouch: [42] } }));
        input.resetBindings();
        deadReport = loadBindings(input, old);
        if (input.getBinding('jump')[0] !== REBOUND) problems.push('a stored keymap with a dead action in it did not apply its live jump');
        if (input.getBinding('crouch').join() !== DEFAULT_BINDINGS.crouch.join()) problems.push('a crouch stored as a number replaced the default instead of being dropped');
        if (!deadReport.ignored.some((line) => line.startsWith('teleport'))) problems.push(`the dead action was not named as dropped (${deadReport.ignored.join('; ') || 'nothing dropped'})`);
        if ('teleport' in input.bindings) problems.push('the dead action became a binding');
      } finally {
        input.resetBindings();
        for (const action of Object.keys(before)) input.setBinding(action, before[action]);
        h.input.clearAll();
      }
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `jump rebound to ${REBOUND}, stored, thrown away, loaded back and climbed on (feet ${climbed.feet.toFixed(2)}); `
            + `a record with a dead action applied ${deadReport.applied.join(', ')} and dropped ${deadReport.ignored.length}: ${deadReport.ignored.join('; ')}`
          : problems.join('; '),
      };
    },
  });
}
