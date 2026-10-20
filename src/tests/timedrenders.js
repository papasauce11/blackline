/**
 * BLACKLINE - tests/timedrenders.js
 *
 * Every clock in the suite that brackets a draw, and whether a verdict rests
 * on what it says (H41).
 *
 * H36 established the fact this census exists for: **no synchronous clock in
 * this page can price a draw.** Probed at three viewpoints of the plant, nine
 * queued draws submit in 13-24ms, `gl.getError()` returns **0.6ms** later, and
 * a real `fenceSync` / `clientWaitSync` then waits **5.5 to 6.9 seconds** for
 * those same nine - 610-761ms a queued draw. So a wall clock wrapped round a
 * render reads the *submission* and the work lands later, at whichever check
 * next synchronises (F11's tail, seen from the inside). The frame-budget sweep
 * was one such clock and H36 stopped it measuring its own sample count.
 *
 * The question H36 left is the one this answers: **how many more are there,
 * and does any of them assert on the number?** A check that *reports* a
 * submission time is honest. A check that *asserts* on one is measuring the
 * wrong thing, however green it comes out - and green is exactly how it comes
 * out, because a submission is cheap no matter what the frame really costs.
 *
 * Ten clauses in nine modules read a duration and the tables below carry all
 * ten with what each does; the detail line counts them, so the count in this
 * paragraph is the one that goes stale and the printed one is the record - it
 * said "nine clauses in eight modules" until H50 counted it against the
 * tables, having added nothing to either. **Two of them put a verdict on the
 * size of one when H41 looked**, and those two are:
 *
 *   - `the-frame-budget-holds-everywhere-not-just-at-site-a` (soak.js) times
 *     92 viewpoints against the 8.33ms ceiling and asserts the worst median.
 *     It was already resolved, by the other branch: `scripts/bench-checks.json`
 *     declares it **bench-only** with a reason naming the hardware, so the
 *     gate drops its verdict and `npm run bench` takes it on the real GPU
 *     (H11). Nothing here changes it; the census holds that it stays that way.
 *   - `frame-budget-under-the-check-29-load` (performance.js) times 180
 *     frames of the check-29 load and asserted its CPU median against a
 *     fraction of the same budget, headless, at every gate - 3.10ms against an
 *     8.33ms ceiling, **2.7x of margin on a number that leaves out the
 *     610-761ms a queued frame really costs here**.
 *     That is the defect H41 predicted and it is the one this job moved.
 *
 * It was not moved by making the whole check bench-only, which would have been
 * a loosening: everything else that check asserts is clock-free and valuable -
 * that the load actually assembled, that Section 15's caps held under it, that
 * the pools neither grew nor leaked, that no runtime assertion fired. Dropping
 * all of that off the gate to dodge one dishonest clause buys nothing. So the
 * clock stops setting the verdict and says so at the line, and **the verdict
 * moves to the runner whose clock can price a draw**: `npm run bench` runs in
 * a headed Chrome, refuses a software rasteriser outright, and now asks for
 * `?timedVerdict=1`. It already ran this check for its GPU half; it asserts
 * the budget now, on hardware, and a red there is an exit code.
 *
 * That is H36's own lesson in a second currency. A sample count that has to be
 * affordable is **declared by whoever is measuring** rather than measured by a
 * clock that cannot see; a verdict that needs a trustworthy clock is likewise
 * **declared by the runner that has one**. Neither is sniffed from inside the
 * page, which is what `WEBGL_debug_renderer_info` and a throwaway context
 * would cost (view.js, and sixteen seconds of it).
 *
 * The clause that makes this more than a comment is the measurement: this
 * check drains the pipeline, times one real frame, and drains again. Headless
 * the two numbers are two orders of magnitude apart, and **a page that asks
 * for a timed verdict while they are is red** - so the param cannot be put in
 * the gate's URL to quiet something down, and a reader of the gate's own
 * output has this renderer's submit-to-finish ratio in the detail line rather
 * than in a trap file.
 *
 * What this cannot see: whether a `reported` number is ever *read* by a human
 * as if it were a verdict. The detail lines say which it is, and that is as
 * far as a check reaches.
 *
 * Registered after benchlist.js and before performance.js: late enough that
 * the run's own tail has been paid by fuzz.js and pipelinewait.js, so the
 * first drain here answers in milliseconds (F11, D48).
 *
 * **Since H53 the census reads code and not prose.** It grepped the raw file
 * until then, so a module was in this census the moment a sentence *mentioned*
 * the clock - which is how **H35** got here, by a header explaining what its
 * clock measures. It belonged here anyway by a different route and declared
 * itself, so the entry is honest and says nothing about the grep.
 * `tests/sourcetext.js` owns the reader and the instrument that proves it can
 * still see a reading.
 */

import { AS_WORDING, codeOf, readerProblems, uncommented } from './sourcetext.js';

/**
 * The URL parameter that says the clock on this page can price a draw, and so
 * that a check timing one may put a verdict on the number.
 *
 * Only `scripts/bench.mjs` asks for it, and the clauses below hold both ends:
 * the bench's URL carries it and `scripts/suite.mjs`'s does not. The default
 * is off, which is the only safe default - a renderer that cannot price a draw
 * is the normal case in this repo, every gate and every `npm run shot`.
 */
export const TIMED_VERDICT_PARAM = 'timedVerdict';

/**
 * Whether a timed verdict has been asked for. `1` and nothing else, so a
 * parameter that arrives empty, mistyped or copied from another URL does not
 * quietly turn an assertion back on.
 */
export function timedVerdictAsked(search) {
  const params = new URLSearchParams(typeof search === 'string' ? search : '');
  return params.get(TIMED_VERDICT_PARAM) === '1';
}

/** This check's own id, and the file it lives in - excluded from its own census. */
const SELF = 'every-check-that-times-a-draw-says-whether-its-verdict-rests-on-the-clock';
const OWN_FILE = 'timedrenders.js';

/**
 * How far the fence may outrun the wall clock before the clock is not pricing
 * the draw. Measured: headless, one frame submits in a few milliseconds and
 * the fence waits several hundred for it - **two orders of magnitude**, where
 * on the real GPU H11 benched a whole frame at 1.71ms and a fence behind one
 * frame is a small multiple of its submission. Twenty sits a factor of twenty
 * clear of the software reading and well above a hardware one, which is the
 * widest gap available to put a line in.
 */
const TRUST_RATIO = 20;

/**
 * A module takes its own reading if its **code** calls the clock. The only
 * clock here, and read off a comment-and-string-stripped source since H53.
 */
const TAKES_A_CLOCK = /performance\.now\(\)/;

/**
 * The criterion's own cases, read by `readerProblems`: a line of real code it
 * must see, and a line of this suite's own prose it must not. A stripped grep
 * needs both, because it can fail by stripping too much as easily as too
 * little and either way this census reports "nothing new".
 */
const CLOCK_SEES = '      const t0 = performance.now();';
const CLOCK_IGNORES = ' * rather than guessing: a module that calls performance.now() is in here.';

/**
 * The four verdicts, which partition both groups below and are counted across
 * both in the summary. The vocabulary lives here rather than half here and
 * half over `READS`, because a word documented for one group is a word the
 * other group's entries get wrong - `sign` was described over `READS` alone
 * until H50, and the summary counted it there alone too.
 *
 *   size      the verdict rests on how big the number is - the only kind H36's
 *             finding makes dishonest, and allowed only where the gate drops
 *             it to `npm run bench` (`bench: true`)
 *   reported  the number reaches the detail line and the pass does not rest on
 *             it here; a runner with a clock that can price a draw asks for the
 *             verdict by URL
 *   sign      the verdict is that a number exists and is positive, never how
 *             big it is - which H36's finding does not touch: a clock that
 *             reads a submission still reads a positive one, and a fence that
 *             answers NaN is broken on any renderer
 *   none      no verdict touches it, for the reason in `proof`
 *   span      the verdict rests on how long a span is, where the span is a
 *             wall-clock interval that brackets **no draw** and is a lower
 *             bound by construction - so a red can be missed and never
 *             invented, the opposite of `size`. Allowed only with a `span`
 *             that names one of `SPANS`, the way `none` names a proof (H92)
 */
const VERDICTS = ['size', 'reported', 'sign', 'none', 'span'];

/** Why a `span` verdict is honest, as data: an entry names one of these. */
const SPANS = {
  bracketed: 'two marks of one monotonic clock bound it, so a wider blind spot makes it shorter and never longer',
};

/**
 * Every clause in `src/tests/` that **takes** a clock reading round a render
 * or a GL call, with its verdict from `VERDICTS`.
 */
const CLOCKED = [
  {
    module: 'soak.js',
    check: 'the-frame-budget-holds-everywhere-not-just-at-site-a',
    verdict: 'size',
    bench: true,
    note: 'times `renderOnly()` at 92 viewpoints and asserts the worst viewpoint\'s median against the 8.33ms draw ceiling. Bench-only since H11 with a reason naming the hardware, so the gate runs it and drops the verdict; the worst single draw is reported and never asserted, and the 120ms per-viewpoint budget is a cap on sampling rather than a verdict (H36)',
  },
  {
    module: 'audiodevice.js',
    check: 'the-audio-device-keeps-its-clock-and-journals-the-states-it-enters',
    // H92: was `sign`; the clock's sign is still asserted, and the stretch now
    // carries a floor, which is the stronger of the two verdicts on it.
    verdict: 'span',
    span: 'bracketed',
    note: 'takes the wall-clock end of the audio device\'s own clock - `performance.now()` against the `currentTime` the journal in `systems/audiodevice.js` has watched since the unlock - and asserts that the clock moved at all over a window of at least 30s, which is a device that played something. Nothing rests on how far it moved, and H50 measured before settling that: twenty-five full-run readings between fed 0.5225 and 0.7481, where a device stopped at a run\'s halfway point reads 0.28-0.36 and so does a healthy device on a machine twice as loaded, so the total has no shape to put a floor on (D74). The ratio is printed and the sign is run over twenty-nine recorded and synthetic readings in `CLOCK_CASES`. **H54 put a second duration beside it, H66 priced it, and its verdict is still `reported`**: the longest wall interval the journal is known to have watched `currentTime` stand still across, taken on the marks `AudioSystem.step()` hands it rather than on any clock of its own. Nothing rests on its size either - `readUnfedShape()` turns it into one of three words and the word reaches the detail line - because the marks arrive in bursts (the rAF loop drives no frames under the suite, F4), so a concentration over what was watched is not a concentration over a run, and `samples`, `sampledToMs` and `maxGapMs` go out beside it to say so. **H66 priced that reach and found the limit one-sided**: `readCoverage()` holds the widest interval between two marks against the loss, and it is worth 1.00 of the loss on the plant and 1.16 of it on the yard, so the concentration is a concentration over the two thirds of a page that had marks in it - but the stretch itself is bounded by two marks reading the same monotonic clock, so it is a proven unfed span and a LOWER bound, and a wider blind spot makes it smaller rather than larger. A verdict on its size can therefore be missed and can never be invented, which is the opposite of the case this census exists for - so the stretch can carry a floor where a submission time cannot, and **H92** is the job that writes one. When it does, the word for it is not `size` as this census defines it: that word is argued about a timed draw, and a wall-clock interval that brackets no draw is a fifth thing this vocabulary has no name for yet. What IS asserted of either duration is arithmetic and not size: a stretch inside the window its own marks measured, a blind spot no wider than the span it is a gap in, and marks arriving at all. The four clauses that decide the rest of that check - one context, the sample rate held, the state running, no state nobody asked for - touch no duration at all',
  },
  {
    module: 'performance.js',
    check: 'frame-budget-under-the-check-29-load',
    verdict: 'reported',
    note: 'times 180 frames of the check-29 load, after 30 warm-up frames it discards, and reports the CPU median and p95. It asserted the median against half the frame budget at every gate until H41: 3.10ms against an 8.33ms ceiling is 2.7x of margin on a quantity that leaves out the 610-761ms a queued frame really costs here, and on the real GPU the same clause reads 0.90-2.00ms with the GPU half beside it (H11). The pass now rests on the load assembling, Section 15\'s caps, the pools and the runtime assertions, all of them clock-free, and `npm run bench` asks for the budget verdict on the real GPU',
  },
  {
    module: 'maps.js',
    check: 'every-registered-map-builds-and-the-page-is-on-the-one-its-url-asked-for',
    verdict: 'none',
    proof: 'nodraw',
    note: 'times `buildMap()` for every registered map, which assembles geometry off the scene and issues no draw and no GL call - three\'s uploads happen on the first render of a mesh, and nothing here renders one. The ms is in the detail line beside each map\'s box count',
  },
  {
    module: 'visual.js',
    check: 'the-death-camera-frames-the-killer',
    verdict: 'none',
    proof: 'detail',
    note: 'times the frame that warms the death camera\'s view, because a cold view took 39s here and the camera\'s own guard is 16.5s (F5). The number is printed only in the branch that explains a guard that fired, and no clause compares it with anything',
  },
];

/**
 * And the clauses that **read** a duration something else measured, with the
 * same `VERDICTS` as the group above. Keyed by check rather than by module,
 * because two of them are in one module, and each names the expression it
 * reads so that a clause which stops reading a clock stops being in this
 * census in the same diff.
 */
const READS = [
  {
    module: 'boot.js',
    check: 'the-bake-yields-the-page-a-frame-to-paint',
    reads: /bake\.ms/,
    verdict: 'sign',
    note: 'asserts `bake.ms > 0` off the boot\'s own recording of its sliced map build - a liveness clause about a bake that happened, not a budget, and the bake builds a map rather than drawing one',
  },
  {
    module: 'pipelinewait.js',
    check: 'the-pipeline-wait-is-the-runs-number-and-not-a-checks',
    reads: /drainPipeline\(/,
    verdict: 'sign',
    note: 'asserts that `drainPipeline()` answers a finite number at or above zero, and that the wait beat while it happened. The ms is the one duration in this page that IS the draw rather than its submission, and even so nothing asserts its size - it is the run\'s number (D48)',
  },
  {
    module: 'menu.js',
    check: 'the-main-menu-draws-a-rendered-thumbnail-for-every-map',
    reads: /record\.ms/,
    verdict: 'none',
    proof: 'detail',
    note: 'prints what the card strip cost to build and to draw, per map, in its detail line. Every clause it asserts is about pixels: that each card is lit, that two cards are not one picture, and that nothing was fetched',
  },
  {
    module: 'quality.js',
    check: 'the-quality-probe-picks-the-level-its-frame-times-ask-for',
    reads: /probe\.sample\(/,
    verdict: 'none',
    proof: 'fed',
    note: 'feeds the probe frame times it derives from the budget constant rather than measuring any - three machines that do not exist - so no clock is in the check at all. The probe itself does time a real draw, in main.js, and that number picks a player\'s quality level on `auto`: D68 and H25 are where that lives, and it is a decision about a look rather than a verdict about a budget',
  },
  {
    module: 'quality.js',
    check: 'each-quality-preset-changes-what-a-frame-costs',
    reads: /render\.calls/,
    verdict: 'none',
    proof: 'counts',
    note: 'the one check in the suite whose name says "what a frame costs" and the honest shape of it: the cost it asserts is draw calls, drawing-buffer pixels, post passes and particles, every one of them a count this renderer answers exactly',
  },
];

/** The reasons a clause is out of reach of the clock, each held below. */
const PROOFS = {
  nodraw: 'the clock brackets no draw and no GL call',
  detail: 'the number reaches a detail line and no comparison',
  fed: 'the durations judged are fed to the check, not measured by it',
  counts: 'the cost asserted is counts and not milliseconds',
};

/** Read a file from the origin the way benchlist.js and donedef.js do. */
async function text(origin, rel) {
  const response = await fetch(`${origin}${rel}`);
  if (!response.ok) return { error: `${rel}: ${response.status}` };
  return { body: await response.text() };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: SELF,
    census: true,
    spec: 'Section 17.1 (the AUTO suite), H36, H41',
    // This check synchronises on purpose, so it declares it (D48, F11): the
    // runner drains the run's own backlog before the clock starts, and what is
    // left inside is the one frame this check queued itself. Without the flag
    // the first drain here read **226,454ms** in a subset run where nothing
    // else synchronised - a quarter of an hour of somebody else's pipeline on
    // this check's ms, which is the exact reading D48 exists to prevent.
    glSync: true,
    name: 'Every check that times a render declares whether its verdict rests on the number, and no verdict rests on the size of a draw this renderer cannot price',
    run: async (h) => {
      const origin = location.origin;
      const problems = [];
      const readings = [];

      // ------------------------------------------------------------------
      // 1. The census is the whole of the clocked group, both ways. Read from
      //    the registrar's own import list, as breathcensus.js reads it, so a
      //    module that starts timing something is in this census the day it
      //    lands rather than the day somebody remembers.
      // ------------------------------------------------------------------
      const index = await text(origin, '/src/tests/index.js');
      if (index.error) return { pass: false, detail: `${index.error}; the census is read off the registrar's import list` };
      const files = [...index.body.matchAll(/import \{ register as \w+ \} from '\.\/([a-z0-9]+\.js)';/g)].map((m) => m[1]);
      if (files.length < 50) {
        return { pass: false, detail: `tests/index.js imports ${files.length} modules; the suite is 50+` };
      }
      // The criterion's own instrument before the census is believed (H53).
      problems.push(...readerProblems(
        (code) => (TAKES_A_CLOCK.test(code) ? 'a clock reading' : ''),
        [[CLOCK_SEES, 'a clock reading']],
        [CLOCK_IGNORES],
      ));

      const sources = new Map();
      const clocked = [];
      for (const file of files) {
        const read = await text(origin, `/src/tests/${file}`);
        if (read.error) { problems.push(read.error); continue; }
        // Two readings of every module, because two clauses below ask two
        // different questions of it (H53). `code` has the comments **and the
        // strings** out, for every clause asking what a module does: the
        // membership grep here and every `reads` pattern in the read group.
        // `said` has only the comments out, for the one clause that asks what
        // a module *imports* - a module path is a string literal, and the
        // stronger reader is blind to it by construction. That is the second
        // hole in a stripped read and it cost this job a subset run.
        sources.set(file, { code: codeOf(read.body), said: uncommented(read.body) });
        if (TAKES_A_CLOCK.test(sources.get(file).code)) clocked.push(file);
      }
      const declared = new Map(CLOCKED.map((entry) => [entry.module, entry]));
      for (const file of clocked) {
        // This module times a frame to prove a thing ABOUT the clock rather
        // than to read a clause off one, so it is out by name - and the clause
        // below holds that it stays out, because a census that declares itself
        // is a census of one thing (breathcensus.js's own exclusion).
        if (file === OWN_FILE) continue;
        if (!declared.has(file)) {
          problems.push(`${file} takes a clock reading and this census does not declare it; whether a verdict rests on a submission time is the whole point of the list`);
        }
      }
      for (const entry of CLOCKED) {
        if (!clocked.includes(entry.module)) {
          problems.push(`${entry.module} is declared here (${entry.verdict}) and its code no longer calls performance.now(); drop it from CLOCKED`);
        }
      }
      if (!clocked.includes(OWN_FILE)) {
        problems.push(`${OWN_FILE} no longer times a frame of its own, so the measurement below is not reading this renderer at all`);
      }
      if (declared.has(OWN_FILE)) problems.push(`${OWN_FILE} declares itself; it proves the mechanism rather than reading a clause off it`);

      // ------------------------------------------------------------------
      // 2. The read group names live clauses, and each still reads the clock
      //    the entry says it does. A stale entry is the hole a census exists
      //    to report, and the two groups together are every duration in
      //    `src/tests/` that any verdict touches.
      // ------------------------------------------------------------------
      const live = new Set(h.debugTools._autoTests.map((test) => test.id));
      for (const entry of [...CLOCKED, ...READS]) {
        if (!live.has(entry.check)) {
          problems.push(`"${entry.check}" is in this census and no module registers it; the entry names nothing`);
        }
        if (entry.verdict === 'span' && !SPANS[entry.span]) {
          problems.push(`"${entry.check}" rests a verdict on a span "${entry.span}", which is not one of the ${Object.keys(SPANS).length} reasons this check holds a span honest by`);
        }
        if (entry.verdict === 'none' && !PROOFS[entry.proof]) {
          problems.push(`"${entry.check}" is out of reach by proof "${entry.proof}", which is not one of the ${Object.keys(PROOFS).length} this check holds`);
        }
      }
      for (const entry of READS) {
        const read = sources.get(entry.module);
        if (!read) { problems.push(`${entry.module} is in the read group and was not served`); continue; }
        const source = read.code;
        if (!entry.reads.test(source)) {
          problems.push(`${entry.module} no longer reads ${entry.reads} for "${entry.check}"; the entry is stale and the clause it describes has moved`);
        }
        if (entry.proof === 'fed' && TAKES_A_CLOCK.test(source)) {
          problems.push(`${entry.module} is declared to judge durations fed to it and now takes its own clock reading; it belongs in CLOCKED`);
        }
      }

      // ------------------------------------------------------------------
      // 3. The rule, which is the whole of H41: a verdict may rest on the
      //    SIZE of a timed draw only where the gate does not count it. The
      //    H11 mechanism is the only way to hold that - `bench-checks.json`
      //    is read by the bench and by the gate's own reporter, so a check
      //    the gate drops is a check the bench runs by construction.
      // ------------------------------------------------------------------
      const listFile = await text(origin, '/scripts/bench-checks.json');
      const benchOnly = new Set();
      if (listFile.error) {
        problems.push(`${listFile.error}; this check reads it to hold that a size verdict is one the gate drops`);
      } else {
        let list = [];
        try { list = JSON.parse(listFile.body); } catch (err) { problems.push(`scripts/bench-checks.json does not parse (${err.message})`); }
        if (Array.isArray(list)) {
          for (const entry of list) if (entry && entry.benchOnly) benchOnly.add(entry.id);
        }
      }
      for (const entry of CLOCKED) {
        if (entry.verdict === 'size' && !benchOnly.has(entry.check)) {
          problems.push(`"${entry.check}" puts a verdict on the size of a timed draw and the gate counts it; a submission time is cheap however expensive the frame is, so it is bench-only with a hardware reason or it stops asserting (H41)`);
        }
        if (entry.verdict !== 'size' && entry.bench) {
          problems.push(`"${entry.check}" is marked bench in this census and does not assert on a size; the flag says which branch of H41 resolved it`);
        }
      }

      // ------------------------------------------------------------------
      // 4. The relocation is real and cannot drift. One runner asks for a
      //    timed verdict, the other does not, and the clause that reads the
      //    parameter is the shared reader rather than a local copy of it -
      //    the same three things benchlist.js holds about `viewpointSamples`.
      // ------------------------------------------------------------------
      // Comment lines come out of both files first, decided line-locally and
      // never by parsing, exactly as benchlist.js decides it for
      // `viewpointSamples` - because this clause and that one are the same
      // clause about a second parameter. bench.mjs's header explains this one
      // at length, and an explanation is not an ask: without the strip, the
      // comment alone would satisfy the clause below. The **weaker** of the
      // two readers `tests/sourcetext.js` owns, and a fourth copy of it until
      // H53: what it looks for is a parameter inside a URL, which is a string.
      const asking = `${TIMED_VERDICT_PARAM}=1`;
      const bench = await text(origin, '/scripts/bench.mjs');
      if (bench.error) problems.push(`${bench.error}; it is the one runner that may ask for a timed verdict`);
      else if (!uncommented(bench.body).includes(asking)) {
        problems.push(`scripts/bench.mjs does not put ${asking} in the page URL, so the budget verdict H41 moved off the gate is asserted by nobody`);
      }
      const suiteRunner = await text(origin, '/scripts/suite.mjs');
      if (suiteRunner.error) problems.push(`${suiteRunner.error}; it is the runner that must NOT ask`);
      else if (new RegExp(`${TIMED_VERDICT_PARAM}=`).test(uncommented(suiteRunner.body))) {
        problems.push(`scripts/suite.mjs asks for ${TIMED_VERDICT_PARAM} ${AS_WORDING}; the gate draws with a software rasteriser, where a wall clock round a frame reads the submission, so it may not ask for a verdict on one (H36)`);
      }
      // And the clause itself reads the shared reader rather than a local copy
      // of the parameter, which is what keeps the gate and the bench from
      // coming to two answers about who may assert on a clock.
      // The call is read as code and the import as text, for the reason the
      // two readings exist: a clause looking for `from './timedrenders.js'`
      // is looking for a module path, and a path is a string.
      const perf = sources.get('performance.js');
      if (perf && !/timedVerdictAsked\(/.test(perf.code)) {
        problems.push('performance.js does not call timedVerdictAsked(); its budget clause is gated on something other than the shared reader');
      }
      if (perf && !/from '\.\/timedrenders\.js'/.test(perf.said)) {
        problems.push('performance.js does not import the reader from this module, so there are two answers to who may assert on a clock');
      }

      // And the reader itself: off by default, on for exactly one value. A
      // parameter that arrives empty or mistyped must not turn an assertion
      // back on, which is the failure mode a default-on reader would have.
      const asks = [
        ['', false], ['?quality=medium&map=yard', false],
        [`?${TIMED_VERDICT_PARAM}=1`, true],
        [`?quality=high&${TIMED_VERDICT_PARAM}=1&map=plant`, true],
        [`?${TIMED_VERDICT_PARAM}=0`, false],
        [`?${TIMED_VERDICT_PARAM}=`, false],
        [`?${TIMED_VERDICT_PARAM}=true`, false],
        [`?${TIMED_VERDICT_PARAM}=11`, false],
      ];
      for (const [search, want] of asks) {
        if (timedVerdictAsked(search) !== want) {
          problems.push(`timedVerdictAsked("${search}") answered ${!want}`);
        }
      }

      // ------------------------------------------------------------------
      // 5. And the measurement the rule rests on, taken here rather than
      //    quoted from a trap file: drain, time one real frame, drain again.
      //    The first drain is what makes the second one about this frame and
      //    not about the run's backlog - which is H36's second false start,
      //    a probe that timed a draw behind a queue and read the queue.
      // ------------------------------------------------------------------
      const suite = h.debugTools.suite;
      if (typeof suite.drainPipeline !== 'function') {
        problems.push('AutoSuite has no drainPipeline(), so the only barrier that really waits is gone and this clause cannot measure anything');
      } else {
        // Drained for already by the runner (the `glSync` above), so this is
        // whatever was queued between that drain and this line - normally
        // nothing, and never the run's backlog.
        const backlogMs = await suite.drainPipeline(`${SELF}: before`);
        h.renderer.info.reset();
        const started = performance.now();
        h.renderFrame(1 / 60);
        const submitMs = performance.now() - started;
        const calls = h.renderer.info.render.calls;
        const finishMs = await suite.drainPipeline(`${SELF}: after`);
        const ratio = submitMs > 0 ? finishMs / submitMs : Infinity;
        const canPrice = ratio <= TRUST_RATIO;
        const asked = timedVerdictAsked(location.search);

        // The controls first: a frame that drew nothing, or a clock that read
        // nothing, makes both numbers below about nothing.
        if (!(calls > 0)) problems.push(`the timed frame issued ${calls} draw calls, so neither number is about a draw`);
        if (!(submitMs > 0)) problems.push(`the timed frame read ${submitMs}ms on the wall clock, which is under its own 0.1ms resolution and leaves nothing to compare the fence with`);
        if (!Number.isFinite(finishMs)) problems.push(`the fence answered ${finishMs}ms`);

        // The clause that makes the parameter safe to exist: it may not be
        // asked for on a renderer whose fence outruns its clock. Put the param
        // in the gate's URL to quiet a budget down and this goes red naming
        // both numbers.
        if (asked && !canPrice) {
          problems.push(`?${TIMED_VERDICT_PARAM}=1 asks for a verdict on a timed draw, and this page submits a frame in ${submitMs.toFixed(2)}ms that the fence then waits ${finishMs.toFixed(0)}ms for (${ratio.toFixed(0)}x the clock); a budget asserted here is a budget on a submission`);
        }
        readings.push(`one frame submits in ${submitMs.toFixed(2)}ms and finishes in ${finishMs.toFixed(0)}ms (${Number.isFinite(ratio) ? `${ratio.toFixed(0)}x` : 'n/a'}, ${calls} calls), so the clock ${canPrice ? 'prices' : 'does not price'} a draw here`);
        if (backlogMs > 0) readings.push(`${backlogMs.toFixed(0)}ms was still queued ahead of it`);
        readings.push(`timed verdicts ${asked ? 'asked for' : 'not asked for'}`);
      }

      // ------------------------------------------------------------------
      // 6. And the summary counts every declared clause once. Each verdict is
      //    counted across BOTH groups, which `sign` was not until H50: it was
      //    described over `READS` and counted there, so the first `sign` entry
      //    in `CLOCKED` - the audio device's clock, which asserts that the
      //    device played something and never how much - would have been
      //    counted nowhere and the detail line would have under-reported this
      //    census by one with nothing red. A tally that must add up is what
      //    makes that a failure rather than a sentence missing from a line,
      //    and it is cheap: the four words partition the census, so the four
      //    counts are its length.
      // ------------------------------------------------------------------
      const census = [...CLOCKED, ...READS];
      const sized = census.filter((e) => e.verdict === 'size').length;
      const reported = census.filter((e) => e.verdict === 'reported').length;
      const sign = census.filter((e) => e.verdict === 'sign').length;
      const none = census.filter((e) => e.verdict === 'none').length;
      const span = census.filter((e) => e.verdict === 'span').length;
      for (const entry of census) {
        if (!VERDICTS.includes(entry.verdict)) {
          problems.push(`"${entry.check}" is declared "${entry.verdict}", which is not one of the ${VERDICTS.length} verdicts this census counts (${VERDICTS.join(', ')})`);
        }
      }
      if (sized + reported + sign + none + span !== census.length) {
        problems.push(`the summary counts ${sized + reported + sign + none + span} of ${census.length} declared clauses; a verdict counted in one group only under-reports this census and nothing else would have said so (H50)`);
      }
      // A size verdict is the one kind that may not be in the read group: a
      // clause that reads a duration it did not measure cannot be the one the
      // bench takes over, because `bench-checks.json` drops whole checks.
      for (const entry of READS) {
        if (entry.verdict === 'size') {
          problems.push(`"${entry.check}" reads a duration it did not measure and puts a verdict on its size; H41's only resolution for that is bench-only, which drops the whole check`);
        }
      }
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${census.length} clauses read a duration (${CLOCKED.length} take it, ${READS.length} read it): ${sized} assert a size and are bench-only, `
            + `${reported} report one, ${sign} assert a sign, ${span} floor a bracketed span, ${none} out of reach by ${Object.keys(PROOFS).length} proofs; `
            + `only bench.mjs asks for ${TIMED_VERDICT_PARAM}. ${readings.join('; ')}`
          : problems.join('; '),
      };
    },
  });
}
