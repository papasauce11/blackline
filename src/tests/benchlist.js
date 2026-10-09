/**
 * BLACKLINE - tests/benchlist.js
 *
 * The other way past the gate, and the one that owes a number (H11).
 *
 * F15 closed `scripts/suite-skips.json` with a census: a check may be dropped
 * headless only while `tests/skiplist.js` declares it and the reason names
 * hardware this machine cannot provide. That held the mechanism honest and
 * left one thing unsaid - a dropped check is a question nobody ever answers.
 * The frame budget sat there for a month: skipped at every gate, and
 * `PLAYTEST.md` asking Josh to open the game and read its line by hand.
 *
 * So H11 split the two ideas apart. `suite-skips.json` keeps its meaning,
 * "this machine cannot run this", and `scripts/bench-checks.json` carries the
 * new one: **this check is run by `npm run bench` instead, on the real GPU,
 * and its number is in `bench/<date>.json`.** That is a stronger claim than a
 * skip, so this check holds it to a stronger standard - the list is not
 * merely declared and argued from hardware, the bench must demonstrably be
 * the thing that runs it:
 *
 *   - `scripts/bench.mjs` must read `bench-checks.json` and must NOT name any
 *     of the ids itself, so what it runs cannot drift from what the gate
 *     dropped. One file, two readers.
 *   - `scripts/suitereport.mjs`, which is the reader that decides what the
 *     gate does not count, must read the same file.
 *   - `package.json` must have the `bench` script. A bench-only list with no
 *     `npm run bench` behind it is the exemption without the number, which is
 *     the state this whole mechanism exists to leave behind.
 *
 * And the cross-file rule, which only something reading both can hold: **no
 * id is in both files.** An exemption with two homes is two places to forget
 * it, and the two reasons would eventually disagree about why.
 *
 * What it cannot see, the same as skiplist.js: whether the reason is *true*,
 * or whether anybody has run the bench lately. The runner's summary prints
 * the date of the newest `bench/` file for the second half of that, because a
 * stale number is a different problem from a missing mechanism and wants a
 * reader's judgement rather than a red.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import {
  VIEWPOINT_SAMPLES, VIEWPOINT_BUDGET_MS, VIEWPOINT_SAMPLES_PARAM,
  MIN_SAMPLES_FOR_A_MEDIAN, sampleSummary, viewpointCost, viewpointSamples,
} from './viewpointsamples.js';

/** This check's own id: the policeman is not exemptible, here either. */
const SELF = 'the-bench-only-list-holds-only-checks-the-bench-itself-runs';

/**
 * The fewest timed draws a viewpoint's median may rest on, measured: over two
 * benches of this PC's GPU the worst median-of-N agreed within 0.3ms in all six
 * scenes from **five** samples and within 0.2ms from nine, where the worst
 * max-of-N never agreed at all (H36). It is a floor on the sample count and not
 * a promise of reproducibility - a fourth bench read one viewpoint 2.6ms high
 * across all nine of its draws, because a stall longer than the sampling window
 * is inside every sample in it, and `tests/viewpointsamples.js` has that
 * arithmetic.
 *
 * **Imported rather than copied** since H42, which gave the same number a
 * second reader in `scripts/bench.mjs`: a check that holds a constant against
 * its own copy of it holds nothing (H29's rule).
 */
const MIN_VIEWPOINT_SAMPLES = MIN_SAMPLES_FOR_A_MEDIAN;

/** F15's policeman, which may not be dropped by this route either. */
const SKIP_GUARD = 'the-headless-skip-list-holds-only-the-check-it-declares';

/**
 * The spike this check proves a median survives: **13.80ms at `bay-a-north`**
 * was a real reading on this PC's GPU at a place whose median over fifteen
 * draws is 2.30ms, and it turned the sweep red (H36). Named once since H42,
 * because the detail line quotes it and a second copy of a measurement is a
 * second thing to forget.
 */
const SPIKE_MS = 13.8;

/**
 * Every check `npm run bench` runs, and whether the gate drops it. A new
 * entry here is a deliberate edit visible in the diff of the commit that
 * makes it, which is the difference between an exemption and a way past.
 */
const SWEEP = 'the-frame-budget-holds-everywhere-not-just-at-site-a';

const ALLOWED = [
  {
    id: SWEEP,
    benchOnly: true,
    why: 'times 92 viewpoints against an 8.33ms ceiling, and headless draws them with SwiftShader',
  },
  {
    id: 'frame-budget-under-the-check-29-load',
    benchOnly: false,
    why: 'the gate counts its clock-free clauses; the bench asks for the verdict on its frame cost, and adds the GPU half the software path cannot give (H41)',
  },
];

/**
 * The hardware a reason must appeal to - the same rule as the skip list's,
 * because the ground for running a check somewhere else is the same ground as
 * for not running it here.
 */
const HARDWARE = /\b(gpu|graphics|hardware|driver|swiftshader|software (?:webgl|renderer|rasteris))\b/i;

/** And the reason must say where the number went, by name. */
const BENCH_COMMAND = /npm run bench/;

/**
 * Longer than the skip list's 40, because this reason carries two things
 * rather than one: why the gate cannot answer, and where the answer is.
 */
const MIN_REASON = 80;

/** Read a file from the origin the way donedef.js and skiplist.js do. */
async function text(origin, rel) {
  const response = await fetch(`${origin}${rel}`);
  if (!response.ok) return { error: `${rel}: ${response.status}` };
  return { body: await response.text() };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: SELF,
    spec: 'Section 17.1 (the AUTO suite), H11',
    name: 'The bench-only list holds exactly the checks this check declares, and npm run bench is demonstrably what runs them',
    run: async (h) => {
      const origin = location.origin;
      const problems = [];

      const listFile = await text(origin, '/scripts/bench-checks.json');
      if (listFile.error) {
        return { pass: false, detail: `${listFile.error}; the gate reads this file to decide what the bench owns instead of it` };
      }
      let list;
      try {
        list = JSON.parse(listFile.body);
      } catch (err) {
        return { pass: false, detail: `scripts/bench-checks.json does not parse (${err.message}); both readers would throw on it` };
      }
      if (!Array.isArray(list)) {
        return { pass: false, detail: 'scripts/bench-checks.json is not an array; bench.mjs and suitereport.mjs both build from one' };
      }

      // 1. The file and the declaration are the same set, both ways, down to
      //    which entries the gate drops: a `benchOnly` that flipped without
      //    an edit here is a check that silently left the gate.
      const declared = new Map(ALLOWED.map((entry) => [entry.id, entry]));
      const seen = new Map();
      for (const entry of list) {
        const id = entry && entry.id;
        if (typeof id !== 'string' || !id) { problems.push(`an entry has no id (${JSON.stringify(entry)})`); continue; }
        if (seen.has(id)) problems.push(`"${id}" is listed twice`);
        seen.set(id, entry);
        if (typeof entry.benchOnly !== 'boolean') {
          problems.push(`"${id}" has no benchOnly boolean; whether the gate still counts a check is not a thing to infer`);
        }
        const mine = declared.get(id);
        if (!mine) {
          problems.push(`"${id}" is in the bench list and this check does not declare it; a check the gate stops counting is an edit here as well`);
        } else if (mine.benchOnly !== entry.benchOnly) {
          problems.push(`"${id}" is benchOnly=${entry.benchOnly} in the file and ${mine.benchOnly} here`);
        }
      }
      for (const entry of ALLOWED) {
        if (!seen.has(entry.id)) problems.push(`"${entry.id}" is declared here (${entry.why}) and the file does not list it; drop it from ALLOWED`);
      }
      if (seen.has(SELF)) problems.push(`"${SELF}" would hand the check that holds this list to the bench`);
      if (seen.has(SKIP_GUARD)) problems.push(`"${SKIP_GUARD}" is F15's policeman and does not belong to the bench`);

      // 2. Every id is a check something registers. An entry naming nothing is
      //    an exemption the next rename inherits, and it is how a deleted
      //    check leaves no mark at all.
      const live = new Set(h.debugTools._autoTests.map((test) => test.id));
      for (const id of seen.keys()) {
        if (!live.has(id)) problems.push(`"${id}" is in the bench list and no module registers it; the entry names nothing`);
      }

      // 3. Each reason is an argument about hardware, and says where the
      //    number is. The second half is the whole difference between this
      //    list and a skip.
      for (const entry of list) {
        if (!entry || typeof entry.id !== 'string') continue;
        const reason = typeof entry.reason === 'string' ? entry.reason.trim() : '';
        if (!reason) problems.push(`"${entry.id}" is in the bench list with no reason`);
        else if (reason.length < MIN_REASON) problems.push(`"${entry.id}": the reason is ${reason.length} characters; ${MIN_REASON}+ is room for why the gate cannot answer and where the answer is`);
        else {
          if (!HARDWARE.test(reason)) problems.push(`"${entry.id}": the reason names no hardware, and hardware is the only ground for moving a check off the gate`);
          if (!BENCH_COMMAND.test(reason)) problems.push(`"${entry.id}": the reason does not name \`npm run bench\`, so a reader of the gate's output cannot find the number`);
        }
      }

      // 4. No id in both files. Two homes for one exemption is two places to
      //    forget it, and two reasons that will eventually disagree.
      const skipFile = await text(origin, '/scripts/suite-skips.json');
      if (skipFile.error) {
        problems.push(`${skipFile.error}; this check compares the two lists and could not read one`);
      } else {
        let skips = [];
        try { skips = JSON.parse(skipFile.body); } catch { skips = []; }
        if (Array.isArray(skips)) {
          for (const entry of skips) {
            const id = entry && entry.id;
            if (typeof id === 'string' && seen.has(id)) {
              problems.push(`"${id}" is both skipped headless and owned by the bench; one exemption, one home`);
            }
          }
        }
      }

      // 5. The honest half. The bench must read this file rather than carry
      //    its own copy of the ids, so that what it runs cannot drift from
      //    what the gate dropped - and the gate's own reader must read it too.
      const bench = await text(origin, '/scripts/bench.mjs');
      if (bench.error) {
        problems.push(`${bench.error}; the bench-only list claims npm run bench runs these, and there is no bench`);
      } else {
        if (!bench.body.includes('bench-checks.json') && !bench.body.includes('benchChecks')) {
          problems.push('scripts/bench.mjs does not read bench-checks.json; then what it runs is a second claim rather than this list');
        }
        // Prose or code, decided line-locally and never by parsing, exactly as
        // donedef.js decides it for the two spec bans: an id cannot be part of
        // a list on a line whose first characters are a comment's. The bench's
        // own doc comment names the frame-budget check, because a reader of
        // that file should be told what it is for; what must not exist is the
        // id in its code, which would be a second set able to drift from the
        // one the gate dropped.
        const lines = bench.body.split(/\r?\n/);
        for (const id of seen.keys()) {
          for (let i = 0; i < lines.length; i++) {
            if (!lines[i].includes(id) || /^\s*(\/\/|\/\*|\*)/.test(lines[i])) continue;
            problems.push(`scripts/bench.mjs:${i + 1} names "${id}" in code; the list is its input, so a hard-coded id is a set that can drift from the gate's`);
          }
        }
      }
      const report = await text(origin, '/scripts/suitereport.mjs');
      if (report.error) problems.push(`${report.error}; this is the reader that decides what the gate does not count`);
      else if (!report.body.includes('bench-checks.json')) {
        problems.push('scripts/suitereport.mjs does not read bench-checks.json, so the gate is dropping these checks on some other grounds');
      }

      // 6. And the command itself exists. A bench-only list with no
      //    `npm run bench` behind it is the exemption without the number.
      const pkg = await text(origin, '/package.json');
      if (pkg.error) problems.push(`${pkg.error}; this check reads the bench script from it`);
      else {
        let scripts = null;
        try { scripts = JSON.parse(pkg.body).scripts; } catch { /* reported below */ }
        if (!scripts || typeof scripts.bench !== 'string') {
          problems.push('package.json has no `bench` script; `npm run bench` is what every reason here points a reader at');
        } else if (!scripts.bench.includes('bench.mjs')) {
          problems.push(`package.json's bench script is "${scripts.bench}" and does not run bench.mjs`);
        }
      }

      const benchOnly = [...seen.values()].filter((entry) => entry.benchOnly === true);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${list.length} check${list.length === 1 ? '' : 's'} run by \`npm run bench\`, ${benchOnly.length} of them dropped from the gate `
            + `(${benchOnly.map((entry) => entry.id).join(', ') || 'none'}); each declared here, registered, argued from hardware and naming the command; `
            + 'none also in suite-skips.json; bench.mjs and suitereport.mjs both read the one file and bench.mjs names no id of its own'
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-frame-budget-asserts-a-median-frame-and-not-an-unlucky-one',
    spec: 'Section 2 / check 29, H36',
    name: 'A viewpoint costs the median of several timed draws, the budget affords them even at the ceiling, and a frame the scheduler took away cannot set the verdict',
    run: async (h) => {
      const problems = [];
      const PERF = CONFIG.performance;
      const ceiling = PERF.frameBudgetMs * PERF.cpuBudgetFraction;

      // 1. The two constants, held as a RELATION rather than as copies of
      //    themselves - a check that reads the number the sweep read can only
      //    ever agree with it (HANDOFF's standing lesson). The relation that
      //    matters is that the budget still affords every sample on a machine
      //    drawing right at its ceiling: if it did not, a slow machine would
      //    be judged on fewer samples than a fast one, which is the bias the
      //    budget exists to avoid.
      if (VIEWPOINT_SAMPLES < MIN_VIEWPOINT_SAMPLES) {
        problems.push(`a viewpoint is costed from ${VIEWPOINT_SAMPLES} draws and two benches only agreed from ${MIN_VIEWPOINT_SAMPLES} (H36)`);
      }
      const affords = VIEWPOINT_SAMPLES * ceiling;
      if (VIEWPOINT_BUDGET_MS < affords) {
        problems.push(`the per-viewpoint budget is ${VIEWPOINT_BUDGET_MS}ms, and ${VIEWPOINT_SAMPLES} draws at the ${ceiling.toFixed(2)}ms ceiling need ${affords.toFixed(0)}ms - a machine at its ceiling would be judged on fewer samples than one well inside it`);
      }

      // 2. A spike cannot reach the verdict. The input is chosen to be one the
      //    OLD clause would have failed on, and that is asserted rather than
      //    assumed: 13.80ms at bay-a-north was a real reading on this PC's GPU
      //    at a place whose median is 2.30ms, and it reddened this check.
      const quiet = new Array(VIEWPOINT_SAMPLES).fill(2);
      const spiked = quiet.slice();
      spiked[VIEWPOINT_SAMPLES - 1] = SPIKE_MS;
      if (!(Math.max(...spiked) > ceiling)) {
        problems.push(`the spike this check uses is ${Math.max(...spiked)}ms against a ${ceiling.toFixed(2)}ms ceiling, so it is not one the old clause would have failed on and proves nothing`);
      }
      if (viewpointCost(spiked) !== 2) {
        problems.push(`${VIEWPOINT_SAMPLES} draws of 2ms with one of ${SPIKE_MS}ms cost ${viewpointCost(spiked)}ms; a descheduled frame is reaching the verdict`);
      }

      // 3. And the second half, without which the clause above is satisfied by
      //    a statistic that ignores everything: a viewpoint genuinely over the
      //    ceiling in every draw must still read over it. The median has to be
      //    deaf to one frame and not to the cost.
      const overrun = new Array(VIEWPOINT_SAMPLES).fill(ceiling + 1);
      if (!(viewpointCost(overrun) > ceiling)) {
        problems.push(`every draw at ${(ceiling + 1).toFixed(2)}ms costs ${viewpointCost(overrun).toFixed(2)}ms, under the ceiling; the median is hiding a real overrun`);
      }

      // 4. **The count is declared, and the declaration defaults to one.**
      //    This is the clause three dead runs paid for, and it is a rule
      //    rather than an instrument because no instrument here works. A
      //    sweep that prices its own frames reads 0.6ms and buys all nine:
      //    probed, nine queued draws of a real viewpoint submit in 13-24ms,
      //    `gl.getError()` returns 0.6ms later, and a real `fenceSync` then
      //    waits 5.5-6.9 SECONDS for the same nine - 610-761ms a draw, which
      //    at 92 viewpoints is the 600s `--stall-wait` those runs died on. The
      //    barrier that does wait is asynchronous and cannot live inside a
      //    timer (H36, `TRAPS.md`). So: a page that asks for nothing pays for
      //    one draw a viewpoint, and the gate is the page that asks for
      //    nothing. Each row is a reading somebody can get wrong - an absent
      //    parameter, a junk one, and an ask past the top of what was ever
      //    measured.
      const asks = [
        ['', 1],
        ['?quality=medium&map=yard', 1],
        [`?${VIEWPOINT_SAMPLES_PARAM}=0`, 1],
        [`?${VIEWPOINT_SAMPLES_PARAM}=1`, 1],
        [`?${VIEWPOINT_SAMPLES_PARAM}=nine`, 1],
        [`?${VIEWPOINT_SAMPLES_PARAM}=${VIEWPOINT_SAMPLES}`, VIEWPOINT_SAMPLES],
        [`?${VIEWPOINT_SAMPLES_PARAM}=500`, VIEWPOINT_SAMPLES],
      ];
      for (const [search, want] of asks) {
        const got = viewpointSamples(search);
        if (got !== want) {
          problems.push(`"${search || '(no query)'}" buys ${got} timed draws a viewpoint and should buy ${want}`
            + (want === 1 ? ' - the gate is the page that asks for nothing' : ''));
        }
      }

      // 5. The sweep is what uses all of it, read from its own text the way
      //    this module reads bench.mjs's - a statistic nothing calls is
      //    decoration, and a parameter nothing reads is a comment.
      const sweepText = await (await fetch(`${location.origin}/src/tests/soak.js`)).text();
      if (!/viewpointCost\(each\)/.test(sweepText)) {
        problems.push('tests/soak.js does not cost a viewpoint with viewpointCost(each); the sweep is not using the statistic this check holds');
      }
      if (!/worst viewpoint's median frame/.test(sweepText)) {
        problems.push('tests/soak.js\'s ceiling complaint no longer says it is about a median frame, so a red would not say what it had measured');
      }
      if (!/VIEWPOINT_BUDGET_MS/.test(sweepText)) {
        problems.push('tests/soak.js no longer spends a per-viewpoint budget, so a GPU too slow for nine samples would be asked for nine anyway');
      }
      if (!/viewpointSamples\(typeof location/.test(sweepText)) {
        problems.push('tests/soak.js no longer takes its sample count from the URL, so it is deciding one from a clock, and no clock here can (H36)');
      }
      // And the flag it must NOT have. A drain before the sweep is the shape
      // the measured version needed - it waits for the renderer so the wait
      // lands on the run's clock rather than in this check's ms (F11, D48) -
      // so the flag coming back is the sweep gone back to timing a draw in
      // order to decide something. Read off the registry rather than the text,
      // the way pipelinewait.js reads the other direction.
      const sweep = h.debugTools._autoTests.find((t) => t.id === SWEEP);
      if (!sweep) problems.push(`no module registers "${SWEEP}", which is the check these two numbers are for`);
      else if (sweep.glSync) {
        problems.push(`"${SWEEP}" declares glSync again; the sweep only ever needed a drain in order to time its own draws, and that is what took three runs past --stall-wait (H36)`);
      }

      // 6. The two runners, and their two URLs. Only a real GPU can afford a
      //    median, so only the bench may ask for one - and the bench must
      //    actually ask, or `bench/<date>.json` fills up with one-sample
      //    readings wearing the word median. Both ends are read from the files
      //    themselves against this check's own constant, so neither can drift.
      //    Comment lines come out of both first, decided line-locally and
      //    never by parsing, exactly as clause 5 of the check above decides
      //    it: bench.mjs's header explains the parameter at length, and an
      //    explanation is not an ask.
      const code = (body) => body.replace(/^[\t ]*(\/\/|\/\*|\*).*$/gm, '');
      // H42 put the count behind a `--samples` flag so the refusal below can be
      // driven from the command line, so the URL is a template now and the
      // literal nine is in the default beside it. Both halves are asserted,
      // because either alone would pass a bench that asks for one draw: the
      // URL must carry the flag's value, and the flag must default to the
      // page's own constant rather than to a typed number.
      const asking = `${VIEWPOINT_SAMPLES_PARAM}=\${SAMPLES}`;
      const defaulting = 'args.samples ?? VIEWPOINT_SAMPLES';
      /** The URL a reader would type, which `asking` stopped being at H42. */
      const askedNine = `${VIEWPOINT_SAMPLES_PARAM}=${VIEWPOINT_SAMPLES}`;
      const bench = await text(location.origin, '/scripts/bench.mjs');
      if (bench.error) problems.push(`${bench.error}; it is the one runner that may ask for a median`);
      else {
        const benchCode = code(bench.body);
        if (!benchCode.includes(asking)) {
          problems.push(`scripts/bench.mjs does not put ${asking} in the page URL, so the bench times one draw a viewpoint and calls it a median`);
        }
        if (!benchCode.includes(defaulting)) {
          problems.push(`scripts/bench.mjs's sample count does not default to \`${defaulting}\`; then the ${VIEWPOINT_SAMPLES} two benches agreed at is a number typed into a runner rather than the one this page reads`);
        }
      }
      const gate = await text(location.origin, '/scripts/suite.mjs');
      if (gate.error) problems.push(`${gate.error}; it is the runner that must NOT ask for a median`);
      else if (new RegExp(`${VIEWPOINT_SAMPLES_PARAM}=`).test(code(gate.body))) {
        problems.push(`scripts/suite.mjs asks for ${VIEWPOINT_SAMPLES_PARAM} in code; headless a sample costs 610-761ms of queued pipeline and the gate drops this verdict anyway (H36)`);
      }

      // 7. And the fourth honesty clause's reader (H42). The bench learns a
      //    viewpoint's sample count by reading `sampleSummary()`'s own wording
      //    back out of a detail line, and a regex over somebody else's prose
      //    is the one thing that cannot hold itself: the day that sentence is
      //    reworded the bench silently stops finding a count and every
      //    reading passes. So the pattern comes out of bench.mjs's source,
      //    runs in this page against both forms that function actually
      //    produces, and must answer the count each one was built from.
      if (!bench.error) {
        const found = /const SWEEP_SAMPLES = (\/.*\/);/.exec(bench.body);
        if (!found) {
          problems.push('scripts/bench.mjs has no SWEEP_SAMPLES pattern, so nothing reads a sample count out of a reading and a one-draw median is filed as a median (H42)');
        } else {
          let reader = null;
          try { reader = new RegExp(found[1].slice(1, -1)); } catch (err) { problems.push(`scripts/bench.mjs's SWEEP_SAMPLES does not compile here (${err.message})`); }
          if (reader) {
            // One below the floor, one at it, one well over, and the count
            // the gate itself produces - which is the form that says NOT a
            // median and is the one a reader must still get a number out of.
            for (const leanest of [1, 4, MIN_VIEWPOINT_SAMPLES, VIEWPOINT_SAMPLES]) {
              const said = sampleSummary(leanest, VIEWPOINT_SAMPLES);
              const hit = reader.exec(said);
              const got = hit ? Number(hit[1] ?? hit[2]) : null;
              if (got !== leanest) {
                problems.push(`the bench reads ${got} out of "${said}", which rests on ${leanest}; its reader and tests/viewpointsamples.js's wording have come apart (H42)`);
              }
            }
          }
        }
        const benchCode = code(bench.body);
        // The floor it judges against is this page's, not a second copy of a
        // five, and the verdict is in the file rather than only in a comment.
        if (!benchCode.includes('MIN_SAMPLES_FOR_A_MEDIAN')) {
          problems.push(`scripts/bench.mjs does not read MIN_SAMPLES_FOR_A_MEDIAN, so the ${MIN_VIEWPOINT_SAMPLES} it judges a median by is its own number`);
        }
        if (!benchCode.includes('UNDERSAMPLED')) {
          problems.push('scripts/bench.mjs no longer ends non-zero on an undersampled sweep; the fourth honesty clause is gone and a one-draw reading is filed as a median (H42)');
        }
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `a viewpoint is the median of up to ${VIEWPOINT_SAMPLES} draws inside ${VIEWPOINT_BUDGET_MS}ms, all ${VIEWPOINT_SAMPLES} affordable at the ${ceiling.toFixed(2)}ms ceiling (${affords.toFixed(0)}ms); `
            + `a ${SPIKE_MS}ms spike cannot reach the verdict and ${ceiling.toFixed(2)}ms+ draws still read over; `
            + `${asks.length} URLs buy what they should (${askedNine} buys ${VIEWPOINT_SAMPLES}, nothing buys 1, 500 clamps); `
            + `no glSync; bench.mjs asks and suite.mjs does not, and its reader gets ${MIN_VIEWPOINT_SAMPLES} and ${VIEWPOINT_SAMPLES} out of both of this page's sentences (H42)`
          : problems.join('; '),
      };
    },
  });
}
