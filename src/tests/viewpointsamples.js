/**
 * BLACKLINE - tests/viewpointsamples.js
 *
 * How many timed draws a viewpoint of the frame-budget sweep rests on, what
 * that costs, and how the sweep says which of the two it got (H36, H42).
 *
 * This was the top of `tests/soak.js` until H42, which needed one more
 * exported line and found that file at 589 of its 600. The whole argument
 * moved out together rather than being split from the constants it is about:
 * the sweep still lives next door and imports these, `tests/benchlist.js`
 * holds them against the two runners' URLs, and `scripts/bench.mjs` reads
 * `sampleSummary()`'s own wording back out of a detail line. One producer of
 * these numbers, three readers of them, and nothing here renders or asserts.
 *
 * Imported by tests/soak.js and tests/benchlist.js. Registers no check of its
 * own, and nothing here imports main.js (Section 3.1).
 */

/**
 * Timed draws per viewpoint in the frame-budget sweep, and the wall-clock the
 * sweep will spend buying them (H36). Both are measured numbers, and
 * `PROGRESS.md`'s H36 entry holds the readings they came from.
 *
 * The sweep used to time **one** draw per viewpoint and assert the highest of
 * them against the ceiling, so its verdict was a single frame. Benched twice on
 * this PC's GPU at fifteen draws a viewpoint, three things came out of it.
 *
 *   - **The worst PLACE reproduces at no sample count.** The top three
 *     overlapped one or two of three in all six scenes, at fifteen samples as
 *     at one, because the top of the distribution is a plateau inside the
 *     clock's own resolution: `performance.now()` is clamped to **0.1ms** and
 *     4 to 13 viewpoints of 92 sit within 0.2ms of the top. A tie is not
 *     fixable by sampling. The top **ten as a set** does reproduce, 7 to 10 of
 *     10, so the busiest *neighbourhood* is a real finding and the busiest
 *     *viewpoint* never was one - which is why the busiest three are named now
 *     and the one crowned winner is gone.
 *   - **The worst VALUE settles as a median and never as a maximum.** Two
 *     benches agreed within 0.3ms from five samples and 0.2ms from nine, where
 *     max-of-N agreed nowhere and on the plant *grew* from 0.1ms apart at nine
 *     to 0.6ms at fifteen, a longer run giving a spike more chances. **More
 *     samples make a maximum worse**, which is the whole argument for the
 *     median. What no median survives is a stall longer than its own sampling
 *     window - one bench read a 2.20ms viewpoint at 4.80ms across all nine of
 *     its draws - and what makes the clause safe there is **headroom**, the
 *     worst of four readings being 58% of the ceiling, not reproducibility.
 *   - **And a spike had already turned this check red on a real GPU.** One
 *     draw at `bay-a-north` read **13.80ms** against the 8.33ms ceiling, at a
 *     place whose median over fifteen draws is 2.30ms. So the worst single
 *     draw is reported now and never asserted.
 *
 * Nine, because nine is where two benches agreed to 0.2ms - and **nobody takes
 * nine unless the URL asks for them**, which is the half that cost three dead
 * runs. A per-viewpoint wall-clock budget was meant to decide it: nine samples
 * where nine are affordable, one where they are not. **Nothing in this page
 * can decide that.** `renderOnly()` only *queues* a draw, and the barrier the
 * budget used to make one finish - `gl.getError()` - **does not wait**: probed
 * here, nine queued draws of a real viewpoint submit in 13-24ms, `getError()`
 * returns **0.6ms** later, and a real `fenceSync` then waits **5.5 to 6.9
 * seconds** for those same nine. A queued draw costs **610-761ms**, so nine at
 * 92 viewpoints is some 560s of pipeline on top of the plant's own ~450s tail,
 * which is the 600s `--stall-wait` three runs died on. And the only barrier
 * that does wait must **yield to the event loop** to poll it, so it cannot
 * live inside a synchronous timer at all. There is no honest wall clock here
 * to build a sample count on, at any sample count (H36; `TRAPS.md`).
 *
 * So the count is **declared by whoever is measuring**: `?viewpointSamples=9`,
 * which only `scripts/bench.mjs` asks for, and **one** otherwise - so the
 * gate, which runs this check and drops only its verdict, costs what it always
 * cost by construction rather than by a measurement that can be wrong. The
 * **budget** stays as what it can honestly be: a cap, so a real GPU slower
 * than this one takes the samples 120ms affords instead of nine regardless.
 * `the-frame-budget-asserts-a-median-frame-and-not-an-unlucky-one` holds both
 * numbers, the median, the default of one and the two runners' two URLs.
 */
export const VIEWPOINT_SAMPLES = 9;
export const VIEWPOINT_BUDGET_MS = 120;

/** The URL parameter that asks for a median, and the only thing that can. */
export const VIEWPOINT_SAMPLES_PARAM = 'viewpointSamples';

/**
 * What a viewpoint costs, given its timed draws: the **median**, so one frame
 * the scheduler took away cannot set a verdict about a frame budget. Exported
 * for the check that proves a spike cannot reach it.
 */
export function viewpointCost(samples) {
  if (!samples.length) return 0;
  const sorted = samples.slice().sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * How many timed draws a viewpoint rests on: **one, unless the URL asks for
 * more**, and never more than the nine two benches agreed at.
 *
 * One is not a median and the sweep's detail line says so in those words. It
 * is the right default anyway: the gate draws with SwiftShader, where a frame
 * costs 610-761ms queued and this check's verdict is dropped for exactly that
 * reason (`scripts/bench-checks.json`), so a second sample there would buy
 * nothing and cost the next check two thirds of a second of pipeline tail it
 * has to wait out. An ask above nine is clamped rather
 * than refused - fifteen was measured, and it made the *maximum* worse while
 * the median had stopped moving at nine, so there is nothing up there to buy.
 */
export function viewpointSamples(search) {
  const params = new URLSearchParams(typeof search === 'string' ? search : '');
  const asked = Math.floor(Number(params.get(VIEWPOINT_SAMPLES_PARAM)));
  if (!Number.isFinite(asked) || asked < 2) return 1;
  return Math.min(asked, VIEWPOINT_SAMPLES);
}

/**
 * How the sweep says what its medians rest on, in the two forms it has: a real
 * median, or a count too small to be one. **Exported because `npm run bench`
 * reads it back** (H42) - the bench is the one runner whose whole output is
 * these numbers, and a reading taken on fewer samples than two benches agreed
 * at is not a median however its field is named. One producer, one reader, and
 * `tests/benchlist.js` holds that the reader's pattern still matches both forms
 * this returns.
 */
export function sampleSummary(leanest, wanted) {
  if (leanest >= MIN_SAMPLES_FOR_A_MEDIAN) return `median of ${leanest}-${wanted}`;
  return `${leanest} sample${leanest === 1 ? '' : 's'}, NOT a median`
    + ` - a median wants \`?${VIEWPOINT_SAMPLES_PARAM}=${VIEWPOINT_SAMPLES}\`, which only \`npm run bench\` asks for`;
}

/**
 * The fewest timed draws a viewpoint's median may rest on: over two benches of
 * this PC's GPU the worst median-of-N agreed within 0.3ms from five samples and
 * within 0.2ms from nine (H36). `tests/benchlist.js` holds the same number and
 * reads it from here.
 */
export const MIN_SAMPLES_FOR_A_MEDIAN = 5;
