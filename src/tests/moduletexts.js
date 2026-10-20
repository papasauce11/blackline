/**
 * BLACKLINE - tests/moduletexts.js
 *
 * The tree of modules that ran, fetched once (H96).
 *
 * Eight censuses under `src/tests/` ask the same two questions - *which
 * modules actually ran* and *what does each one say* - and until this module
 * each of them answered both for itself: `performance.getEntriesByType(
 * 'resource')` for the list, then a `fetch` of every path in it. Seven copies
 * of the same four lines, which is the shape H53 and H58 collapsed twice
 * already one level down, and **193 modules fetched seven times a run**.
 *
 * **It was never slow, and that is the honest framing.** The browser serves
 * every one of those from its cache, so the duplication cost 278-322ms inside
 * a full run (H83's verify) beside a census that reads the tree once. What it
 * cost was the thing a copy always costs: seven places to change, seven places
 * to get the filter subtly different in, and - measured here for the first
 * time - about **1,200 entries of the Resource Timing buffer** H67 had to
 * raise by two hundred times, every one of them a second reading of a file
 * already in hand.
 *
 * **Why the list and the fetch move together.** They are one question asked in
 * two halves, and `requestbuffer.js` censuses the first half by name: every
 * module whose code reads the buffer is declared there with what it reads it
 * for. Moving only the fetch would have left seven declared readers reading
 * the buffer to build a list this module had already built. So the
 * enumeration is here too, and that census now declares **three** readers
 * where it declared seven - this module, `donedef.js`'s network ban (which
 * reads every entry and not the modules), and `requestbuffer.js`'s own live
 * count of what the buffer holds.
 *
 * **Memoised per page and not per run**, because a page serves two runs (D1,
 * F16) and a module's text does not change between them. The cache is keyed by
 * path and holds the body beside its two readings, each computed on the first
 * ask - a census that wants only `codeOf` never pays for `uncommented`, and
 * `resetcensus.js`, which wants both (H83), pays for each once rather than
 * twice.
 *
 * **What it deliberately does not do is filter.** A caller says which subtree
 * it wants and reads the rest itself: `pixelfloors.js`, `posecriterion.js` and
 * `readernames.js` want `src/tests/`, the others want everything under `src/`,
 * and `posecriterion.js` wants bare file names. A shared helper that tried to
 * own every caller's filter would be a second place to get a filter wrong,
 * which is the defect this module exists to remove.
 *
 * A helper rather than a check, so it is not registered in `tests/index.js`
 * and is in no census's membership - `sourcetext.js`, `pixels.js`,
 * `assertions.js` and `positionreads.js` are the same shape. The rule that
 * nobody may go round it is held by `requestbuffer.js`, off the tree, the way
 * `readernames.js` holds the two source readers (H68). Nothing here imports
 * main.js (Section 3.1).
 */

import { codeOf, uncommented } from './sourcetext.js';

/**
 * Path to `{ body, code, said }`, filled as it is asked for and never cleared.
 * Module-level, so it is the page's and outlives a run - which is the whole
 * saving, since a page's second run asks the same questions of the same files.
 */
const CACHE = new Map();

/**
 * Which modules under `src/` the page actually loaded, from the Resource
 * Timing buffer - never a guess at the import graph, which is F13's rule and
 * the reason a draw or a timer hiding in an unimported file cannot reach a
 * match.
 *
 * Returns paths from `src/` down (`src/tests/donedef.js`), sorted, so a
 * census's order is the tree's and not the buffer's.
 *
 * @param {string} origin usually `location.origin`
 * @returns {string[]|null} null where there is no Resource Timing to read
 */
export function ranModules(origin) {
  if (typeof performance === 'undefined' || !performance.getEntriesByType) return null;
  const modules = new Set();
  for (const entry of performance.getEntriesByType('resource')) {
    const url = entry.name.split('?')[0];
    if (!url.startsWith(origin) || !url.endsWith('.js') || url.indexOf('/src/') === -1) continue;
    modules.add(url.slice(url.indexOf('/src/') + 1));
  }
  return [...modules].sort();
}

/**
 * The same list cut to one subtree, which is what five of the eight callers
 * want. `under` is a path prefix (`src/tests/`), compared as text.
 *
 * @param {string} origin
 * @param {string} under
 * @returns {string[]|null}
 */
export function ranModulesUnder(origin, under) {
  const all = ranModules(origin);
  return all && all.filter((path) => path.startsWith(under));
}

/**
 * One module's text and its two readings, fetched at most once a page.
 *
 * The readings are computed on the first ask and kept, so a caller may take
 * `code` from one census and `said` from another without either paying for
 * the other's. A failed fetch is returned as `{ path, error }` and never
 * cached, because a census that reported a module missing once should not go
 * on reporting it after the server comes back.
 *
 * @param {string} origin
 * @param {string} path from `src/` down
 * @returns {Promise<{path: string, body?: string, code?: string, said?: string, error?: string}>}
 */
export async function moduleText(origin, path) {
  const held = CACHE.get(path);
  if (held) return held;
  const response = await fetch(`${origin}/${path}`);
  if (!response.ok) return { path, error: `${path}: ${response.status}` };
  const body = await response.text();
  let code = null;
  let said = null;
  const entry = {
    path,
    body,
    get code() {
      if (code === null) code = codeOf(body);
      return code;
    },
    get said() {
      if (said === null) said = uncommented(body);
      return said;
    },
  };
  CACHE.set(path, entry);
  return entry;
}

/**
 * Every path in `paths`, read, in the order given. The one call a census
 * makes: `for (const module of await moduleTexts(origin, paths))`.
 *
 * @param {string} origin
 * @param {string[]} paths
 * @returns {Promise<object[]>}
 */
export async function moduleTexts(origin, paths) {
  const read = [];
  for (const path of paths) read.push(await moduleText(origin, path));
  return read;
}

/**
 * How many modules this page has read, for the census that is about the cost.
 * A page's second run adds nothing to it, which is the saving stated as a
 * number rather than claimed.
 */
export function readSoFar() {
  return CACHE.size;
}
