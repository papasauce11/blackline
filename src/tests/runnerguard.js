/**
 * BLACKLINE - tests/runnerguard.js
 *
 * The gate refuses to run beside another gate, and this holds that it does
 * (H45).
 *
 * `npm run bench` has refused to run beside a suite since H11, with the right
 * argument: a frame timed next to a sustained all-core software-GL load is a
 * reading about a busy machine. `npm run suite` had exactly the same exposure
 * and only **warned** - `scripts/watchdog.mjs`'s `otherRunners()` found them,
 * `suitereport.mjs` printed `OTHER RUNNERS ALIVE: pid N - every timing above
 * was measured against them`, and the run went ahead and wrote its numbers
 * into the record.
 *
 * The warning was read past twice, and each time cost a doubled plant run.
 * H41's gate took **2,215,508ms against the 1,105,958ms** of the four runs
 * before it, on the same tree with the same instrument, because 38 minutes of
 * it were measured beside a runner a previous session had left healthy - and
 * `auto` read 10.30ms there and called for `low` where every uncontended run
 * on this machine reads 5-7ms. H44's run then made a third one, by a third
 * mechanism (a deliberate stop, which kills the npm wrapper and leaves the
 * runner drawing), and cleared it by hand before it could cost anything.
 *
 * So the runner refuses now and exits **3**, naming the other pid, two ways
 * to end it, and the flag. Three is deliberate and is the point of the clause
 * below that holds it: **1 is red, 2 is a crash, and 3 is "this run declined
 * to measure"** - three different things a scheduled session has to tell apart
 * without reading stderr, and until H45 the third one did not exist.
 *
 * The distinction the refusal rests on, which is also why there is a flag at
 * all: a *verdict* is still honest beside another runner. A check that counts
 * draw calls counts the same number on a busy machine, and a check that reads
 * pixels reads the same pixels. No **timing** is, and the report is full of
 * them. So a reader who means it may pass `--allow-other-runners` and get the
 * old warning, and a run that cannot tell the difference does not get to write
 * numbers into `PROGRESS.md` by default.
 *
 * **The check cannot test the behaviour, and says so rather than pretending.**
 * The page has no processes: it cannot start a second runner, cannot see one,
 * and cannot read an exit code. What it can do is hold the mechanism in the
 * one place it lives, the way `tests/benchlist.js` holds `bench.mjs`'s own
 * rules by reading its source - that the refusal is in `scripts/suite.mjs`,
 * that it is an exit and not a warning, that the flag is the only way past it,
 * that the exit code is the one a reader is told to expect, and that
 * `bench.mjs` still refuses too so the pair cannot drift. The behaviour itself
 * was proved by starting a second runner beside a first and reading the
 * refusal, which is in PROGRESS.md's H45 with the pid it named.
 *
 * **A second check lives here, about the other end of the same summary**
 * (H63). The runner's stderr line is the only thing a reader of a run sees
 * without a flag, and a **passing** check's detail is not in the report at
 * all - so the source-line ceiling's cluster now goes on it, per run, and this
 * module holds the chain that makes the printed number the check's own: the
 * check hands its numbers out beside its verdict, the runner carries them
 * through without touching them, and the summary quotes neither threshold of
 * its own. Same shape as the clauses above - a rule about a runner, held by
 * reading its source, from a page that cannot read an exit code - with one
 * half that is not source at all: it **runs** the ceiling check and holds its
 * prose against its own object, which is the only way to prove that two
 * outputs of one measurement still say the same thing.
 *
 * Registered from tests/index.js beside tests/benchlist.js, which is the
 * check the first one is modelled on. Nothing here imports main.js
 * (Section 3.1).
 */

const SELF = 'the-suite-refuses-to-run-beside-another-suite-and-the-flag-is-the-only-way-past-it';

/** The runner that must refuse, and the one that has refused since H11. */
const RUNNER = '/scripts/suite.mjs';
const BENCH = '/scripts/bench.mjs';

/** The finder both of them call. A refusal that stopped calling it would be a refusal about nothing. */
const FINDER = 'otherRunners';

/**
 * The flag, named here once. It is a string rather than a regex because it
 * has to be matched in three different kinds of file - the runner's code, the
 * runner's own help text, and `TRAPS.md`'s prose - and one spelling is the
 * whole point of a flag a human is told about at two in the morning.
 */
const FLAG = '--allow-other-runners';

/** The constant in the runner that the flag becomes, and the guard it appears in. */
const FLAG_CONST = 'ALLOW_OTHER_RUNNERS';
const GUARD = /if \(leaked\.length && !ALLOW_OTHER_RUNNERS\) \{/;

/**
 * The exit code a refusal gives. Distinct from 1 (something is red) and 2 (the
 * runner crashed), because a scheduled session reads an exit code before it
 * reads anything else and those are three different mornings.
 */
const REFUSAL_EXIT = 3;

/**
 * How many times `ALLOW_OTHER_RUNNERS` may appear in the runner's code: once
 * where it is read off the command line, once in the guard. A third is a
 * second way past the refusal, which is the failure mode this clause exists
 * for - and the reason the flag got a named constant at all rather than being
 * read inline.
 */
const FLAG_USES = 2;

/**
 * H63's subject: the one check that hands the runner numbers beside its
 * verdict, the field it hands them in, and the report that prints them.
 */
const CEILING_CHECK = 'no-source-file-outside-config-is-over-600-lines';
const CEILING_FIELD = 'ceiling';
const REPORT = '/scripts/suitereport.mjs';

/**
 * The ceiling check's own detail line, read back. A census of one: the prose
 * and the object are two renderings of one measurement, and nothing else in
 * the suite can tell you they have stopped agreeing.
 *
 * Brittle on purpose. Reword the detail line and this goes red, which is the
 * clause working - the two are meant to move together, and the alternative is
 * a summary quietly quoting a number the check no longer reports.
 */
const CLUSTER_PROSE = /^(\d+) modules loaded; (\d+) within (\d+) of the (\d+) guidance, nearest \d+: (\S+) (\d+) \((-?\d+) left\)/;
const EMPTY_PROSE = /^(\d+) modules loaded; none within (\d+) of the (\d+) guidance/;

/**
 * The two numbers `suitereport.mjs` may not carry (H63). They arrive inside
 * the check's object, so a guidance or a band changed where the check
 * measures cannot leave the summary quoting the old one - and a literal in
 * the summary is exactly how that drift would be written. Scoped to the
 * summary's own block rather than the file, so an unrelated `50` elsewhere is
 * not this clause's business.
 */
const NOT_IN_THE_SUMMARY = [/\b600\b/, /\b50\b/];

/**
 * The expression that prints it, named rather than grepped for - `GUARD`
 * above and `positionreads.js`'s `snapper` patterns are the same idiom, and
 * the day it moves this reds and somebody reads this note.
 *
 * It is named because the obvious clause does not work, and H63 found that out
 * by breaking it: a substring test for `run.ceiling` inside the per-run loop
 * passes a loop that reads `run.ceilingButNotRead` and prints nothing, because
 * one name **contains** the other. That is H61's finding one job later and in
 * the same file-reading currency - a longer word that happens to start with
 * the one you are looking for - so what is held here is the whole shape: the
 * value is read off the run, the line is guarded on it, and the guard's body
 * pushes. A grep for the name alone cannot tell a live line from a dead one.
 */
const PRINTS_THE_CLUSTER = /const c = run\.ceiling;\s*if \(c\) \{\s*lines\.push\(/;

/** Read a file from the origin the way benchlist.js and donedef.js do. */
async function text(origin, rel) {
  const response = await fetch(`${origin}${rel}`);
  if (!response.ok) return { error: `${rel}: ${response.status}` };
  return { body: await response.text() };
}

/**
 * A file's text with its comment lines out, decided line-locally and never by
 * parsing - timedrenders.js's stripper, for its reason and for H43's: an
 * explanation is not an ask, and a clause that greps for something a file
 * must *do* will otherwise find the paragraph explaining that it does it.
 * This module's own subject is a runner whose header describes its refusal at
 * length, so every clause below reads the stripped text.
 */
function code(body) {
  return body.replace(/^[\t ]*(\/\/|\/\*|\*).*$/gm, '');
}

/** The body of the first `{ ... }` block opened by `open`, by brace depth. */
function blockAfter(source, open) {
  const at = source.search(open);
  if (at < 0) return null;
  const start = source.indexOf('{', at);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  return null;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: SELF,
    spec: 'Section 17.1 (the AUTO suite), H11, H41, H45',
    name: 'scripts/suite.mjs refuses to start beside another suite.mjs and exits 3 naming the pid and the flag, the flag is the only way past it, and npm run bench still refuses the same way',
    run: async () => {
      const origin = location.origin;
      const problems = [];
      const readings = [];

      const runner = await text(origin, RUNNER);
      if (runner.error) return { pass: false, detail: `${runner.error}; it is the runner this check is about` };
      const source = code(runner.body);

      // ------------------------------------------------------------------
      // 1. It still looks, and it refuses rather than annotating. A warning
      //    is what this replaced, and the whole of H45 is that the exit is
      //    there - so the clause is about `process.exit`, inside the guard,
      //    and not about the wording of a message.
      // ------------------------------------------------------------------
      if (!source.includes(`${FINDER}(`)) {
        problems.push(`${RUNNER} does not call ${FINDER}(); a refusal that never looks is not one`);
      }
      if (!GUARD.test(source)) {
        problems.push(`${RUNNER} has no \`${GUARD.source}\`; the refusal is either gone or guarded by something this check cannot read, and either way the flag is not the only way past it`);
      }
      const block = blockAfter(source, GUARD);
      if (!block) {
        problems.push(`${RUNNER}'s refusal has no block to read; nothing holds that it exits`);
      } else {
        if (!new RegExp(`process\\.exit\\(${REFUSAL_EXIT}\\)`).test(block)) {
          problems.push(`${RUNNER} finds another runner and does not exit ${REFUSAL_EXIT} for it; this warned until H45 and the warning was read past twice, each time for a doubled plant run`);
        }
        if (!block.includes(FLAG)) {
          problems.push(`${RUNNER}'s refusal does not name ${FLAG} in the message it prints; a refusal a reader cannot get past without reading the source is a worse bug than the one it fixes`);
        }
        if (!/pid \$\{r\.pid\}/.test(block)) {
          problems.push(`${RUNNER}'s refusal does not name the other pid; "another runner is alive" with no pid cannot be acted on`);
        }
      }

      // ------------------------------------------------------------------
      // 2. The flag is the only way past it, which is a claim about how many
      //    places read it rather than about what any of them say. Two: the
      //    command line, and the guard above.
      // ------------------------------------------------------------------
      const uses = (source.match(new RegExp(FLAG_CONST, 'g')) || []).length;
      if (uses !== FLAG_USES) {
        problems.push(`${FLAG_CONST} is read ${uses} times in ${RUNNER} and the refusal allows ${FLAG_USES} (the command line, and the guard); a third reader is a second way past the refusal`);
      }
      if (!new RegExp(`const ${FLAG_CONST} = [^\\n]*allow-other-runners`).test(source)) {
        problems.push(`${FLAG_CONST} is not read off ${FLAG} in ${RUNNER}; the flag a human is told about and the constant the guard reads are two different things`);
      }
      // And the exit code is distinct from the two that already meant
      // something, or a scheduled session cannot tell a refusal from a crash.
      for (const [taken, means] of [[1, 'something is red'], [2, 'the runner crashed']]) {
        if (taken === REFUSAL_EXIT) problems.push(`the refusal exits ${REFUSAL_EXIT}, which already means "${means}"`);
      }
      readings.push(`${RUNNER} exits ${REFUSAL_EXIT} beside another runner, ${FLAG} the only way past`);

      // ------------------------------------------------------------------
      // 3. The default path cannot carry the flag. `npm run suite` is what
      //    every gate and every verify runs, and a flag quietly added to it
      //    would turn the refusal off for the whole project in one line
      //    nobody reads twice.
      // ------------------------------------------------------------------
      const pkg = await text(origin, '/package.json');
      if (pkg.error) problems.push(`${pkg.error}; it holds the command every gate runs`);
      else if (pkg.body.includes(FLAG)) {
        problems.push(`package.json carries ${FLAG}; the refusal is then off for every gate and every verify this project runs`);
      }

      // ------------------------------------------------------------------
      // 4. And the bench still refuses, because the pair is the argument.
      //    H11 made this case for the runner that produces the real-GPU
      //    numbers; H45 made it for the one that produces everything else.
      //    If the bench's refusal ever goes, the suite's is an odd rule
      //    rather than a policy, and somebody will argue it away.
      // ------------------------------------------------------------------
      const bench = await text(origin, BENCH);
      if (bench.error) problems.push(`${bench.error}; it is the refusal this one is modelled on`);
      else {
        const benchCode = code(bench.body);
        if (!benchCode.includes(`${FINDER}(`)) {
          problems.push(`${BENCH} no longer calls ${FINDER}(); it has refused to run beside a suite since H11 and the suite's refusal is modelled on it`);
        }
        if (!/process\.exit\(/.test(benchCode.slice(benchCode.indexOf(`${FINDER}(`)))) {
          problems.push(`${BENCH} finds another runner and no longer exits for it`);
        }
      }

      // ------------------------------------------------------------------
      // 5. The finder is still a finder of suites. A `otherRunners()` that
      //    stopped matching `suite.mjs` would answer an empty list for ever
      //    and every clause above would pass on a machine with four runners
      //    on it - the shape HANDOFF.md's standing lesson is about.
      // ------------------------------------------------------------------
      const watchdog = await text(origin, '/scripts/watchdog.mjs');
      if (watchdog.error) problems.push(`${watchdog.error}; it is where the finder lives`);
      else {
        const dog = code(watchdog.body);
        if (!new RegExp(`export function ${FINDER}\\(`).test(dog)) {
          problems.push(`scripts/watchdog.mjs does not export ${FINDER}(); both runners import it from there`);
        }
        if (!dog.includes('suite.mjs')) {
          problems.push(`${FINDER}() no longer looks for suite.mjs, so it answers an empty list however many are running and every clause above is vacuous`);
        }
      }

      // ------------------------------------------------------------------
      // 6. TRAPS.md's orphan entry points at the flag, which is the half of
      //    H45 a human needs: the entry is where somebody goes at two in the
      //    morning with a refusal on their screen, and it is the only place
      //    that says an orphan has to be killed by hand.
      // ------------------------------------------------------------------
      const traps = await text(origin, '/TRAPS.md');
      if (traps.error) problems.push(`${traps.error}; it carries the orphan entry`);
      else if (!traps.body.includes(FLAG)) {
        problems.push(`TRAPS.md does not name ${FLAG}; its orphan entry is where a reader of this refusal is sent, and it should say what the way past is`);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${readings.join('; ')}; package.json carries no flag, ${BENCH} still refuses, ${FINDER}() still looks for suite.mjs, TRAPS.md names the flag`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-runners-own-summary-prints-the-source-ceiling-from-the-checks-own-number',
    spec: 'Section 17.1 (the AUTO suite), H55, H63',
    name: "The runner's stderr summary prints the source-line ceiling cluster on every run with no flag, the number it prints is the ceiling check's own rather than a second measurement, and the check's prose and its object cannot drift apart",
    run: async (h) => {
      const origin = location.origin;
      const problems = [];
      const readings = [];

      // ------------------------------------------------------------------
      // 1. The check is registered and hands its numbers out beside its
      //    verdict. Run it rather than read it: a field that has stopped
      //    being returned is the one failure a grep of its source would
      //    report as fine, because the line building the object is still
      //    there either way.
      // ------------------------------------------------------------------
      const test = h.debugTools._autoTests.find((t) => t.id === CEILING_CHECK);
      if (!test) {
        return { pass: false, detail: `no module registers "${CEILING_CHECK}", and it is the one that measures the thing this summary prints` };
      }
      const result = await test.run(h);
      const ceiling = result && result[CEILING_FIELD];
      if (!ceiling) {
        problems.push(`"${CEILING_CHECK}" returned no ${CEILING_FIELD} field, so the runner's summary has nothing to print and prints nothing - silently, which is the state H63 found`);
      } else {
        for (const key of ['modules', 'guidance', 'within', 'count']) {
          if (typeof ceiling[key] !== 'number') {
            problems.push(`${CEILING_FIELD}.${key} is ${typeof ceiling[key]} and the summary quotes it as a number`);
          }
        }
        if (ceiling.count > 0 && (!ceiling.nearest || typeof ceiling.nearest.left !== 'number')) {
          problems.push(`${CEILING_FIELD}.count is ${ceiling.count} and ${CEILING_FIELD}.nearest carries no headroom; the summary names the nearest module and would print undefined`);
        }
        if (ceiling.count === 0 && ceiling.nearest) {
          problems.push(`${CEILING_FIELD}.count is 0 and ${CEILING_FIELD}.nearest is set; the summary chooses its sentence on the count and the two disagree`);
        }
      }

      // ------------------------------------------------------------------
      // 2. And the half that is the whole point: the prose and the object
      //    are one measurement rendered twice, so they are held against each
      //    other. Only where the check passed - a red one reports its
      //    problems instead of its report, and the suite is red anyway.
      // ------------------------------------------------------------------
      if (ceiling && result.pass) {
        const detail = String(result.detail ?? '');
        const full = detail.match(CLUSTER_PROSE);
        const empty = detail.match(EMPTY_PROSE);
        if (!full && !empty) {
          problems.push(`the ceiling check's detail line no longer reads as either of the two sentences this clause knows, so its prose and its ${CEILING_FIELD} object cannot be compared: "${detail.slice(0, 120)}"`);
        } else if (full) {
          const said = {
            modules: Number(full[1]), count: Number(full[2]), within: Number(full[3]),
            guidance: Number(full[4]), path: full[5], lines: Number(full[6]), left: Number(full[7]),
          };
          const want = {
            modules: ceiling.modules, count: ceiling.count, within: ceiling.within,
            guidance: ceiling.guidance, path: ceiling.nearest.path,
            lines: ceiling.nearest.lines, left: ceiling.nearest.left,
          };
          for (const key of Object.keys(want)) {
            if (said[key] !== want[key]) {
              problems.push(`the ceiling check says ${key} is ${said[key]} in its detail line and ${want[key]} in its ${CEILING_FIELD} object; the summary prints the second and a reader of --details reads the first`);
            }
          }
          readings.push(`${want.count} within ${want.within} of ${want.guidance}, nearest ${want.path} (${want.left} left), prose and object agree on ${Object.keys(want).length} numbers`);
        } else {
          if (Number(empty[1]) !== ceiling.modules || Number(empty[2]) !== ceiling.within || Number(empty[3]) !== ceiling.guidance) {
            problems.push(`the ceiling check's empty-cluster sentence and its ${CEILING_FIELD} object disagree`);
          }
          readings.push(`no cluster; prose and object agree that nothing is within ${ceiling.within} of ${ceiling.guidance}`);
        }
      }

      // ------------------------------------------------------------------
      // 3. The runner carries the field through without touching it. A
      //    result map that drops an unknown key is how this would stop
      //    working with nothing red: the check still measures, the summary
      //    still has its line, and the line never prints.
      // ------------------------------------------------------------------
      const runner = await text(origin, RUNNER);
      if (runner.error) problems.push(`${runner.error}; it is what carries the field`);
      else if (!new RegExp(`${CEILING_FIELD}\\b`).test(code(runner.body))) {
        problems.push(`${RUNNER} does not carry ${CEILING_FIELD} out of a check's result, so the numbers never reach the summary`);
      }

      // ------------------------------------------------------------------
      // 4. The summary names the check, reads the field off the run, and
      //    prints it **inside the per-run loop**. Per run and not per map:
      //    the cluster is read off the modules the page loaded and the two
      //    maps do not load the same set, so one answer for the suite is one
      //    map's answer printed twice - which is the `break` that hid a
      //    whole map, in a second currency (H25).
      // ------------------------------------------------------------------
      const report = await text(origin, REPORT);
      if (report.error) problems.push(`${report.error}; it is where the summary is built`);
      else {
        const reportCode = code(report.body);
        if (!reportCode.includes(CEILING_CHECK)) {
          problems.push(`${REPORT} does not name "${CEILING_CHECK}", so it cannot find the result the numbers are on`);
        }
        const perRun = blockAfter(reportCode, /for \(const \[i, run\] of r\.runs\.entries\(\)\)/);
        if (!perRun) {
          problems.push(`${REPORT} has no per-run loop in its summary, and the ceiling line belongs in one`);
        } else if (!PRINTS_THE_CLUSTER.test(perRun)) {
          problems.push(`${REPORT}'s per-run loop does not match ${PRINTS_THE_CLUSTER}, so nothing here holds that the cluster is read off the run and printed from it - either the line has left the loop, in which case one map's answer stands in for both, or it is still there and dead`);
        }
        const body = blockAfter(reportCode, /export function summary/);
        if (!body) problems.push(`${REPORT} exports no summary() this clause can read`);
        else {
          for (const literal of NOT_IN_THE_SUMMARY) {
            if (literal.test(body)) {
              problems.push(`${REPORT}'s summary() carries ${literal} as a literal; both thresholds arrive inside the check's object, and a copy here is how the printed line comes to quote a guidance the check no longer measures against`);
            }
          }
        }
        readings.push(`${REPORT} names the check and reads the field per run`);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0 ? readings.join('; ') : problems.join('; '),
      };
    },
  });
}
