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
 * **Four clauses, and the third is the behavioural half this check owes the
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
 *      silence.
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

import { codeOf, uncommented, readerProblems } from './sourcetext.js';

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
 */
const READERS = [
  { module: 'audiocontext.js', sites: 1, what: 'the modules that ran, for F13-style one-owner ban on the realtime AudioContext constructor' },
  { module: 'donedef.js', sites: 3, what: 'three sites: the network ban reads every entry (the one reading the 250 cap genuinely broke), and the 600-line ceiling and the two source bans read the modules that ran' },
  { module: 'pixelfloors.js', sites: 1, what: 'the modules under src/tests/ that ran, for H30 census of pixel floors against the drawing buffer' },
  { module: 'posecriterion.js', sites: 1, what: 'the modules under src/tests/ that ran, for H61 discovery of the proxies that pose a body' },
  { module: 'requestbuffer.js', sites: 2, what: 'this check: once to find the modules it then greps, and once afterwards to count what the buffer holds - the instrument is the thing it protects, so it declares itself, and its own second site is the first thing this census caught' },
  { module: 'rngdraws.js', sites: 1, what: 'the modules that ran, for H77 census of every draw site on the two seeded streams' },
];

/** Read a file from the origin the way donedef.js and timedrenders.js do. */
async function text(origin, rel) {
  const response = await fetch(`${origin}${rel}`);
  if (!response.ok) return { error: `${rel}: ${response.status}` };
  return { body: await response.text() };
}

/** Which modules the page loaded under `src/`, from the buffer this check is about. */
function loadedModules(origin) {
  const modules = new Set();
  for (const entry of performance.getEntriesByType('resource')) {
    const url = entry.name.split('?')[0];
    if (!url.startsWith(origin) || !url.endsWith('.js') || url.indexOf('/src/') === -1) continue;
    modules.add(url.slice(url.indexOf('/src/') + 1));
  }
  return [...modules];
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
      if (!asked.includes(OVERFLOW_EVENT)) {
        problems.push(`${SIZE_FILE} does not register ${OVERFLOW_EVENT} in code, so a buffer that fills again fills in silence - which is the whole of what H67 was for`);
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

      const modules = loadedModules(origin);
      if (modules.length < 120) {
        return { pass: false, detail: `the buffer names ${modules.length} modules under src/ and this page loads 120+, so the census below would be a census of nothing` };
      }
      const declared = new Map(READERS.map((entry) => [entry.module, entry]));
      const found = new Map();
      for (const path of modules) {
        const read = await text(origin, `/${path}`);
        if (read.error) { problems.push(read.error); continue; }
        const code = codeOf(read.body);
        if (!READS_BUFFER.test(code)) continue;
        const file = path.slice(path.lastIndexOf('/') + 1);
        const sites = (code.match(/getEntriesByType\(/g) || []).length;
        found.set(file, sites);
        if (!declared.has(file)) {
          problems.push(`${file} reads the Resource Timing buffer at ${sites} site(s) and this census does not declare it; what it reads the buffer for is what the size has to cover`);
          continue;
        }
        if (!READS_RESOURCES.test(uncommented(read.body))) {
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
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `buffer ${size} of a ${DEFAULT_SIZE} default, never filled; ${entries.length} entries here`
            + ` (${(size / entries.length).toFixed(1)}x left, ${HEADROOM}x held), ${modules.length} modules under src/;`
            + ` ${found.size} readers at ${sites} call sites, all declared: ${READERS.map((entry) => entry.module).join(', ')};`
            + ` two readers instrumented, the call as code and the resource type as a string (H62)`
          : problems.join('; '),
      };
    },
  });
}
