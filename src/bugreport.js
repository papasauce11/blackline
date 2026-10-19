/**
 * BLACKLINE - bugreport.js
 *
 * The bug report (H12): what a friend presses *Copy report* on the pause menu
 * for, and what the routine needs to reproduce what they saw. One block of
 * plain text - the build, the map and the seed that make a match replayable
 * (`?map=` and `?seed=` mean what they say), the settings, the last thirty
 * seconds of input and the last twenty lines the page logged - so it pastes
 * into a message as it is and needs no tool to read.
 *
 * **The input is a journal of edges, taken off the held set.** A step reads
 * `input.heldCodes`, which is what the controllers read, and a difference
 * against the last step is a key going down or coming up. The harness steps
 * the simulation without clearing the press edges, and the composition root
 * clears them after every step, so the held set is the one thing both paths
 * agree on. Times are simulation seconds, the clock a replay runs on.
 *
 * **The log is a tap on the console, installed once.** Every line still
 * reaches the console it was written to; the tap keeps a copy of the last
 * twenty, each cut short, so a report carries the warnings a player never saw
 * without carrying a stack trace a friend has to scroll past. A wrapper is the
 * top frame of every line it passes on, so a console's link says this file
 * rather than the caller: DevTools' ignore list (add `bugreport.js`) puts the
 * caller back. Under automation the boot leaves the tap off, because the
 * gate's own console-error list names where each error came from and would
 * name this file for all of them; the check installs it for its own length and
 * takes it off again, which is what `tapConsole` returning an undo is for.
 *
 * No `setTimeout`, no rng, no DOM: the menu draws it (`ui/menupages.js`).
 */

import { CONFIG } from './config.js';
import { VERSION } from './version.js';

const R = CONFIG.debug.report;

/** The console's levels the tap copies. */
const LEVELS = ['log', 'info', 'warn', 'error'];

/** One logged argument, as a reader would want it in a line. */
function said(value) {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * @param {object} live getters for what a report names
 * @param {() => object} live.match the match state
 * @param {() => object} live.map the built map
 * @param {() => number} live.seed the seed the match was opened with
 * @param {() => number} live.assertions runtime assertion failures so far (H14)
 * @param {() => object} [live.crashGuard] the crash guard (H14), whose crashes it lists
 * @param {object} live.settings the live `SETTINGS`
 */
export function createBugReport(live) {
  const edges = [];
  let held = new Set();
  const lines = [];
  let tapped = false;

  return {
    /** Called once per fixed step with the step's clock and the held keys. */
    record(simTime, heldCodes) {
      let changed = false;
      for (const code of heldCodes) if (!held.has(code)) { edges.push({ t: simTime, code, down: true }); changed = true; }
      for (const code of held) if (!heldCodes.has(code)) { edges.push({ t: simTime, code, down: false }); changed = true; }
      // A copy only when something moved: this runs every step.
      if (changed) held = new Set(heldCodes);
      const since = simTime - R.inputSeconds;
      let drop = 0;
      while (drop < edges.length && edges[drop].t < since) drop++;
      if (drop) edges.splice(0, drop);
    },

    /**
     * Keep a copy of every console line from here on, the last few only.
     * Returns what takes the tap off again; a no-op when it was already on.
     */
    tapConsole(target = console) {
      if (tapped) return () => {};
      tapped = true;
      const before = {};
      for (const level of LEVELS) {
        before[level] = target[level];
        const original = target[level].bind(target);
        target[level] = (...args) => {
          // A styled line (`%c`) carries one CSS string per marker after it.
          const styles = typeof args[0] === 'string' ? (args[0].match(/%c/g) || []).length : 0;
          const words = styles ? [args[0].replace(/%c/g, ''), ...args.slice(1 + styles)] : args;
          lines.push(`[${level}] ${words.map(said).join(' ').trim().slice(0, R.lineChars)}`);
          if (lines.length > R.logLines) lines.splice(0, lines.length - R.logLines);
          original(...args);
        };
      }
      return () => {
        for (const level of LEVELS) target[level] = before[level];
        tapped = false;
      };
    },

    /** The report, as it is copied. */
    text() {
      const match = live.match() || {};
      const map = live.map() || {};
      const out = [];
      out.push('BLACKLINE bug report');
      out.push(`version: ${VERSION.short || 'unknown'} (${VERSION.commit || 'no commit'}) ${VERSION.date || ''} ${VERSION.branch || ''} [${VERSION.source}]`.replace(/\s+/g, ' ').trim());
      if (typeof location !== 'undefined') out.push(`url: ${location.href}`);
      out.push(`map: ${map.id || '?'} (${map.name || '?'})`);
      out.push(`seed: ${live.seed()}`);
      out.push(`match: ${match.mode || '?'}/${match.role || '?'}, round ${match.roundNumber ?? '?'}`);
      out.push(`assertion failures: ${live.assertions()}`);
      const guard = live.crashGuard ? live.crashGuard() : null;
      out.push(`crashes: ${guard ? guard.count : 0}`);
      if (guard) out.push(...guard.lines().map((line) => `  ${line}`));
      if (typeof navigator !== 'undefined') out.push(`browser: ${navigator.userAgent}`);
      out.push(`settings: ${JSON.stringify(live.settings)}`);
      out.push(`input, last ${R.inputSeconds}s (sim seconds, + down, - up):`);
      out.push(edges.length ? `  ${edges.map((e) => `${e.t.toFixed(2)} ${e.down ? '+' : '-'}${e.code}`).join('  ')}` : '  (none)');
      out.push(`log, last ${R.logLines}:`);
      out.push(...(lines.length ? lines.map((l) => `  ${l}`) : ['  (none)']));
      return out.join('\n');
    },
  };
}
