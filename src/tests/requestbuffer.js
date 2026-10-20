/**
 * BLACKLINE - tests/requestbuffer.js
 *
 * AUTO suite (H67): the Resource Timing buffer has room for every request this
 * page makes, nothing it dropped went unreported, and the modules that read it
 * are declared.
 *
 * **What was wrong, and the shape of it is the point.** Five modules read
 * `performance.getEntriesByType('resource')` at seven call sites, and every
 * one of them reads it for the same reason: it is the list of modules that
 * **actually ran**, never a guess at the import graph (F13's rule, and the
 * reason a draw or a timer hiding in an unimported file cannot reach a match).
 * The buffer's default size is **250** entries. Nothing in this project raised
 * it, nothing listened for `resourcetimingbufferfull`, and
 * `no-network-beyond-the-three-cdn` had been printing *"250 requests"* - which
 * is the **cap** and not a count. So every request past the 250th was dropped
 * in silence, including from the one census whose whole job is to see every
 * request there is.
 *
 * **Why nothing had broken yet.** The module graph is requested first and sits
 * at the **front** of the buffer, so the six readings that want *which modules
 * ran* were intact by position rather than by design - 193 modules inside the
 * first 197 entries. What was genuinely exposed is the network ban, which
 * reads every entry and could not see one made after the cap. H67's queue
 * entry said this was three censuses; it is **seven call sites in five
 * modules**, and the four it missed are the ones that joined since (`H30`'s
 * pixel-floor census, `H77`'s draw-site census, the AudioContext owner ban and
 * the second of the two source bans).
 *
 * **Where the size is set, and it cannot be a module.** `index.html`'s inline
 * script, before `<script type="module" src="./src/main.js">` is reached,
 * because a module cannot be early enough: the graph that loads `main.js` is
 * itself most of the requests this protects, so by the time any of our code
 * evaluates the entries are already in - and under the default the last of
 * them are already gone. The same inline script records
 * `resourcetimingbufferfull` into a flag rather than handling it, because the
 * one thing a reader of those censuses needs is to know **nothing was
 * dropped**.
 *
 * **Five clauses, and the third is the behavioural half this check owes the
 * suite** (HANDOFF.md, A1 and A3's debt: a check that reads the constant the
 * derivation read can only ever agree with it).
 *
 *   1. `index.html` asks for a size, once, as a literal above the default, and
 *      registers the overflow recorder. Read as **code**, comments stripped,
 *      because an explanation is not an ask (H41's rule, H43's bite).
 *   2. The flag is false: the buffer never filled on this page. **This is the
 *      clause that turns the next crossing into a red rather than another
 *      silence**, and it is the whole of what the queue asked for.
 *   3. The live entry count is **above the default**, which it cannot be if
 *      the call did not take effect - and this check guarantees it rather than
 *      hoping for it, because clause 4 fetches every module that ran, which is
 *      193 requests on top of the boot graph. Plus this check's own fetch of
 *      `index.html` must be *in* the buffer: a full buffer drops new entries,
 *      so finding its own request there is the direct reading.
 *   4. The readers census, both ways: every module that ran whose **code**
 *      calls the buffer is declared here with what it reads it for, and every
 *      declared module still calls it. A new reader is a new row, not a
 *      silence. **H96 took it from seven modules at ten sites to three at
 *      three** by moving the list, and the fetch with it, into
 *      `tests/moduletexts.js`; the three left are the one reader that wants
 *      the entries rather than the modules, the owner of the list, and this
 *      check's own count.
 *   5. And nobody goes round the owner (H96): no module under `src/tests/`
 *      fetches a path under `src/` for itself. Clause 4 holds who may ask
 *      *which modules ran*; this holds who may read one, which is the other
 *      half of the same ownership and the half five modules were doing off
 *      `src/tests/index.js`'s list rather than off the buffer's. It reads the
 *      **weak** reader, because a path is a string and the strong one empties
 *      the literal it sits in.
 *
 * **Two readers, and the division is load-bearing** (H62). Membership is a
 * question about what a module *does*, so it is decided on `codeOf` - an
 * identifier inside a comment is not a call, which is H53's whole subject and
 * cost three jobs an hour each. But the entry **type** is a string argument,
 * and `codeOf` takes strings out, so the clause that the call is about
 * *resources* and not about marks or measures is decided on `uncommented`,
 * the one reader that can see it. `readerProblems` is run on both before
 * either census is believed, because a stripped read fails by stripping too
 * much as easily as too little.
 *
 * **It declares itself**, unlike `breathcensus.js` and `timedrenders.js`,
 * which exclude their own file by name. The reason is that those census a
 * property their own existence would distort; this one censuses *readers of
 * the buffer*, and this module is honestly one - clause 4 reads the buffer to
 * find the modules it then greps, so the instrument is the thing it protects.
 * Leaving itself out would be the inaccuracy, not the discipline.
 *
 * Nothing here imports main.js (Section 3.1).
 */

import { moduleTexts, ranModules, readSoFar } from './moduletexts.js';
import { AS_CODE, codeOf, uncommented, readerProblems } from './sourcetext.js';

/**
 * The Resource Timing buffer's default size, from the spec and from what this
 * page had until H67. Clause 3 holds the live count above it, which is the one
 * reading that says the raise took effect: under the default the count cannot
 * pass this number however many requests are made.
 */
const DEFAULT_SIZE = 250;

/**
 * How many times the count this check sees the size must be at least.
 *
 * The count here is the count **so far** - this check runs at its own place in
 * the order and the page goes on requesting after it - so the multiple is
 * against a partial number, and clause 2 catches the real crossing whatever the
 * arithmetic says. What this clause is for is the **early warning**: it reds
 * while the count is still well under the size, so the next crossing is a job
 * and not an outage.
 *
 * **Both constants come off a measurement and the first pair was wrong.** One
 * run of one map makes **991** requests against the 250 default, so three
 * quarters of them were being dropped. But two runs share one page (D1, F16),
 * and a page's **second** run reaches **2,799** requests with **3,383** entries
 * in the buffer by the time this check reads it - so the size first chosen,
 * 16,384, was 4.8x the busiest reading and left this clause **21% from firing
 * on a healthy tree**. A tripwire that near is what a threshold is not allowed
 * to be here, because a false red costs a whole run (the gate routes a non-zero
 * to `## BROKEN BASE`), and the verify that found it is the only reason it is
 * not shipped. At 65,536 the size is **19x** the busiest page measured and this
 * clause reds past **16,384** entries, 4.8x today's - room for the suite to
 * grow by what it has grown by over this whole block, several times over.
 */
const HEADROOM = 4;

/** Where the size is set, and the two things that must be in it. */
const SIZE_FILE = '/index.html';
const SIZE_CALL = /performance\.setResourceTimingBufferSize\(\s*(\d+)\s*\)/;
const OVERFLOW_EVENT = 'resourcetimingbufferfull';
const OVERFLOW_FLAG = '__blRequestBufferFull';

/** The call that makes a module a reader, and the argument that says of what. */
const READS_BUFFER = /getEntriesByType\(/;
const READS_RESOURCES = /getEntriesByType\(\s*['"]resource['"]\s*\)/;

/**
 * The criterion's own cases, run before the census is believed (H53). A line of
 * real code each reader must see, and a line of this suite's own prose neither
 * may - the comment above `loadedModules()` in `rngdraws.js` names the API in
 * words, and a census that enrolled a module for its comments is the defect
 * H53 fixed in two others.
 */
const SEES = '  for (const entry of performance.getEntriesByType(\'resource\')) {';
const IGNORES = ' * Which modules the page loaded under `src/`, from getEntriesByType(\'resource\') (H63).';

/**
 * And clause 1's own two cases, because that clause is the same shape in a
 * different file: the call must be seen as code and a line of the comment
 * above it must not. The second is written the way `index.html` writes it,
 * leading star and all, since that is the form `codeOnly` drops
 * line-locally - a prose line without one reads as the ask itself, which is
 * H43's bite and was a real defect in this check's first draft.
 */
const ASK_SEES = '    performance.setResourceTimingBufferSize(4096);';
const ASK_IGNORES = '   * handled, because performance.setResourceTimingBufferSize(250) would say nothing.';

/**
 * Every module that ran and reads the buffer, with what it reads it for. Keyed
 * by file name; `sites` is how many call sites it has, so a reader that grows
 * a second one is a number that moved rather than nothing.
 *
 * **H96 took this from seven modules at ten sites to three at three**, and
 * that is the shape of the job rather than a tidy-up: six of the seven were
 * reading the buffer for the same thing - the list of modules that ran - and
 * then fetching all 193 of them for themselves. `tests/moduletexts.js` does
 * both once a page for all of them. What is left here is the one reader that
 * wants the entries rather than the modules, the owner of the list, and this
 * check's own count of what the buffer holds.
 */
const READERS = [
  { module: 'donedef.js', sites: 1, what: 'the network ban reads every entry, which is the one reading the 250 cap genuinely broke - it wants the requests and not the modules, so it is the one site H96 did not move' },
  { module: 'moduletexts.js', sites: 1, what: 'the modules that ran, once a page, for the eight censuses that want them: the ceiling and the two source bans, the AudioContext owner ban, the pixel floors, the pose proxies, the two source readers and the draw sites (H96)' },
  { module: 'requestbuffer.js', sites: 1, what: 'this check, counting what the buffer holds after the census above has read the tree - the instrument is the thing it protects, so it declares itself' },
];

/**
 * And the other half of the same ownership, which is the half H96 is about
 * (its done-when: *no census under `src/tests/` fetches a module's text for
 * itself*). A buffer reader cannot be declared away by fetching the tree off
 * some other list - `registry.js`, `resetcensus.js`, `quiescesites.js`,
 * `breathcensus.js` and `breathdrawn.js` each take their list from
 * `src/tests/index.js` rather than from the buffer, and each used to fetch
 * every file on it - so the fetch is held in its own right.
 *
 * **Line-local, the way `donedef.js` decides the two spec bans.** The needle
 * is a `fetch` naming a path under `src/` on the one line, which is the shape
 * all fourteen sites H96 moved were written in and the shape the next one
 * will be written in. A fetch whose URL is assembled a line earlier walks
 * through, which `pixelfloors.js`'s own header makes the same admission
 * about its floors: this catches the shape, not every possible spelling.
 */
const FETCHES_SOURCE = /fetch\([^)]*\bsrc\//;

/**
 * The reader this clause takes is the **weak** one, and it has to be: the
 * path is inside a template literal at every one of the sites H96 moved, and
 * `codeOf` empties a literal where it finds it, so the strong reader cannot
 * see a path at all - `sourcetext.js`'s header says it in as many words, *a
 * module path is a string, so this reader cannot see one*.
 *
 * Which means this file's own cases are visible to this file's own clause,
 * so each is assembled from pieces that fail the needle on their own: `fe`
 * and `tch(` are not `fetch(`. Same trap and same answer as `SPELLINGS` in
 * `readernames.js`.
 *
 * **`moduletexts.js` is not exempted and does not need to be.** It builds its
 * URL from a path it was handed, so it names no subtree and matches nothing:
 * the rule is that *no* module under `src/tests/` fetches a path under
 * `src/`, and the owner obeys it rather than being excused from it. The
 * second ignore case is the owner's own line, held here so that a rewrite of
 * it into a form this clause would red is caught as a case and not as a
 * mystery.
 */
const FETCH_SEES = ['      const index = await (await fe', 'tch(`${origin}/src/tests/index.js`)).text();'].join('');
const FETCH_IGNORES = [
  ['      const bench = await te', "xt(origin, '/scripts/bench.mjs');"].join(''),
  ['  const response = await fe', 'tch(`${origin}/${path}`);'].join(''),
];

/** Read a file from the origin the way donedef.js and timedrenders.js do. */
async function text(origin, rel) {
  const response = await fetch(`${origin}${rel}`);
  if (!response.ok) return { error: `${rel}: ${response.status}` };
  return { body: await response.text() };
}

/**
 * Which modules the page loaded under `src/`. Read through the owner since
 * H96, which is why this check's own declared site count fell from two to
 * one: the instrument it protects is now somebody else's single call.
 */
function loadedModules(origin) {
  return ranModules(origin) || [];
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-resource-timing-buffer-has-room-for-every-request-the-page-makes',
    spec: 'Section 2 / Section 18 / H67',
    name: 'The Resource Timing buffer is raised past its 250-entry default before the module graph is requested, it never filled on this page, and every module that reads it is declared with what it reads it for',
    run: async () => {
      const problems = [];
      const origin = location.origin;
      if (typeof performance === 'undefined' || !performance.getEntriesByType) {
        return { pass: false, detail: 'no Resource Timing API to inspect, so six readings in five modules are reading nothing' };
      }

      // ------------------------------------------------------------------
      // 1. The ask, read off index.html as code. A comment describing the
      //    raise is not a raise (H41's rule), and the number has to be a
      //    literal for this clause to be able to compare it with anything.
      // ------------------------------------------------------------------
      const page = await text(origin, SIZE_FILE);
      if (page.error) return { pass: false, detail: `${page.error}; it is where the buffer size is set` };
      const asked = codeOf(page.body);
      const match = asked.match(SIZE_CALL);
      let size = 0;
      if (!match) {
        problems.push(`${SIZE_FILE} does not call performance.setResourceTimingBufferSize with a literal, so the buffer is at its ${DEFAULT_SIZE}-entry default and every request past the ${DEFAULT_SIZE}th is dropped in silence (H67)`);
      } else {
        size = Number(match[1]);
        if (!(size > DEFAULT_SIZE)) {
          problems.push(`${SIZE_FILE} asks for a buffer of ${size} and the default is already ${DEFAULT_SIZE}, so the call buys nothing`);
        }
      }
      // The one of the five sites H95 reviewed that was already right, and
      // so its control: `asked` is the **strong** reader (`codeOf` above), a
      // registration is a call and not a string, and this sentence is the one
      // that was telling the truth when it said `in code`. It says the same
      // words it always did; what changed is where they come from, which is
      // the reader's own file, so this site and the four that were wrong are
      // now held by the same rule.
      if (!asked.includes(OVERFLOW_EVENT)) {
        problems.push(`${SIZE_FILE} does not register ${OVERFLOW_EVENT} ${AS_CODE}, so a buffer that fills again fills in silence - which is the whole of what H67 was for`);
      }

      // ------------------------------------------------------------------
      // 2. The flag: the buffer never filled. The one clause that is about
      //    what happened rather than about what was asked for.
      // ------------------------------------------------------------------
      const overflowed = window[OVERFLOW_FLAG];
      if (overflowed === undefined) {
        problems.push(`window.${OVERFLOW_FLAG} is undefined, so the recorder in ${SIZE_FILE} did not run and a dropped request would not be reported`);
      } else if (overflowed) {
        problems.push(`the Resource Timing buffer filled on this page (${OVERFLOW_EVENT} fired), so an unknown number of requests are missing from the ${READERS.length} readings below`);
      }

      // ------------------------------------------------------------------
      // 4. The readers census, both ways - run before clause 3 because its
      //    fetches are what make clause 3 a measurement rather than a hope.
      // ------------------------------------------------------------------
      problems.push(...readerProblems(
        (code) => (SIZE_CALL.test(code) ? 'the ask' : ''),
        [[ASK_SEES, 'the ask']],
        [ASK_IGNORES],
      ));
      problems.push(...readerProblems(
        (code) => (READS_BUFFER.test(code) ? 'a buffer read' : ''),
        [[SEES, 'a buffer read']],
        [IGNORES],
      ));
      problems.push(...readerProblems(
        (said) => (READS_RESOURCES.test(said) ? 'a resource read' : ''),
        [[SEES, 'a resource read']],
        [IGNORES],
        uncommented,
      ));
      // H96's needle, on the weak reader because a path is a string.
      problems.push(...readerProblems(
        (said) => (FETCHES_SOURCE.test(said) ? 'a fetch of the tree' : ''),
        [[FETCH_SEES, 'a fetch of the tree']],
        FETCH_IGNORES,
        uncommented,
      ));

      const modules = loadedModules(origin);
      if (modules.length < 120) {
        return { pass: false, detail: `the buffer names ${modules.length} modules under src/ and this page loads 120+, so the census below would be a census of nothing` };
      }
      const declared = new Map(READERS.map((entry) => [entry.module, entry]));
      const found = new Map();
      let fetchers = 0;
      for (const read of await moduleTexts(origin, modules)) {
        if (read.error) { problems.push(read.error); continue; }
        const path = read.path;
        const file = path.slice(path.lastIndexOf('/') + 1);
        // H96: and nobody goes round the owner. A path is a string, so this
        // half asks the weak reader where the half above asks the strong one -
        // the same division H62 drew for the call and its argument.
        if (path.startsWith('src/tests/') && FETCHES_SOURCE.test(read.said)) {
          fetchers += 1;
          problems.push(`${file} fetches a path under src/ for itself; tests/moduletexts.js reads every module that ran once a page and hands back its text with both readings, so a second fetch is a second list to get wrong and an entry of the buffer this check is about (H96)`);
        }
        const code = read.code;
        if (!READS_BUFFER.test(code)) continue;
        const sites = (code.match(/getEntriesByType\(/g) || []).length;
        found.set(file, sites);
        if (!declared.has(file)) {
          problems.push(`${file} reads the Resource Timing buffer at ${sites} site(s) and this census does not declare it; what it reads the buffer for is what the size has to cover`);
          continue;
        }
        if (!READS_RESOURCES.test(read.said)) {
          problems.push(`${file} calls getEntriesByType and names no resource type in it, so this census cannot say the buffer it reads is the one this size is about`);
        }
        if (sites !== declared.get(file).sites) {
          problems.push(`${file} is declared with ${declared.get(file).sites} call site(s) and its code has ${sites}`);
        }
      }
      for (const entry of READERS) {
        if (!found.has(entry.module)) {
          problems.push(`${entry.module} is declared here and its code no longer reads the buffer; drop the row (${entry.what})`);
        }
      }

      // ------------------------------------------------------------------
      // 3. The behavioural half. The census above has just fetched every
      //    module that ran, so the count is past the default by construction
      //    - unless the raise did not take effect, in which case it is
      //    pinned at exactly the default and those fetches are gone. And
      //    this check's own read of index.html must be in the buffer, which
      //    is the same question asked of one entry instead of a total.
      // ------------------------------------------------------------------
      const entries = performance.getEntriesByType('resource');
      if (!(entries.length > DEFAULT_SIZE)) {
        problems.push(`${entries.length} entries in the buffer after fetching ${modules.length} modules, which cannot be more than ${DEFAULT_SIZE}: the raise in ${SIZE_FILE} did not take effect`);
      }
      const own = `${origin}${SIZE_FILE}`;
      if (!entries.some((entry) => entry.name.split('?')[0] === own)) {
        problems.push(`this check fetched ${SIZE_FILE} and no entry for it is in the buffer, so new entries are being dropped`);
      }
      if (size > 0 && !(size >= entries.length * HEADROOM)) {
        problems.push(`the buffer is ${size} and this page has already spent ${entries.length} entries by the time this check runs, under the ${HEADROOM}x this holds - and it goes on requesting after this (H67)`);
      }

      const sites = READERS.reduce((total, entry) => total + entry.sites, 0);
      if (fetchers) {
        problems.push(`${fetchers} module(s) under src/tests/ fetch the tree for themselves, which is the duplication H96 ended`);
      }
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `buffer ${size} of a ${DEFAULT_SIZE} default, never filled; ${entries.length} entries here`
            + ` (${(size / entries.length).toFixed(1)}x left, ${HEADROOM}x held), ${modules.length} modules under src/;`
            + ` ${found.size} readers at ${sites} call sites, all declared: ${READERS.map((entry) => entry.module).join(', ')};`
            + ` no module under src/tests/ fetches one for itself, ${readSoFar()} read once between them (H96);`
            + ` three readers instrumented, the call as code, the type and a path as strings (H62)`
          : problems.join('; '),
      };
    },
  });
}
