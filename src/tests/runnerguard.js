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
 * Registered from tests/index.js beside tests/benchlist.js, which is the
 * check this one is modelled on. Nothing here imports main.js (Section 3.1).
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
}
