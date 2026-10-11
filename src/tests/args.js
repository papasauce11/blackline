/**
 * BLACKLINE - tests/args.js
 *
 * The runners read one command line, and a flag given twice is kept (H58).
 *
 * `npm run shot -- --pose mantle --pose pullup` wrote only the pull-up, on
 * both maps, and printed *"1 poses"* while doing it. The parser assigned
 * `out[key] = next` for every option, so a repeated flag kept the last value
 * and the earlier one was gone before `listArg` ever saw it: a session asking
 * for three poses got one, and a line of output that agreed with itself. H52
 * lost two runs to it and worked around it by running three times.
 *
 * **The interesting half is that nothing said so.** A runner that drops an
 * argument it was given is the same class of defect as a gate that warns and
 * builds anyway (H45, which this suite made a refusal), and the answer is the
 * same shape: collect it, or refuse it. So there are exactly two ways to read
 * a flag now and every runner picks one at the line - `listArg` for a flag
 * that may repeat, `scalarArg` for one that takes a single value and throws
 * on a second.
 *
 * **Why this check can test the behaviour where `runnerguard.js` cannot.**
 * That check holds `suite.mjs`'s refusal by reading its source, because the
 * page has no processes and cannot start a runner or read an exit code. A
 * command line is different: it is a pure function from an array of strings
 * to an object, and the only reason it was untestable from here is that it
 * lived in a module full of `node:http`. So H58 moved it to
 * `scripts/args.mjs`, which has **no node builtin in it**, and the page
 * imports it and runs it. The cases are the module's own `ARG_CASES`, beside
 * the code they describe, so the behaviour and its examples cannot drift -
 * and each case carries the sentence saying what it is for, which is what
 * gets printed when one fails.
 *
 * **And the clause that keeps the repair.** The parser was written twice:
 * once in `headless.mjs` for the three small runners and once inside
 * `suite.mjs`, whose own header asks for the two to be kept in step. A
 * parser is exactly the part where "in step" is not something a reader can
 * see, and the two had already drifted - `headless.mjs` kept positionals
 * under `_` and `suite.mjs` silently discarded them. So this check holds that
 * **there is one**: `function parseArgs` is declared in `scripts/args.mjs`
 * and nowhere else under `scripts/`, read off comment-stripped source (H53,
 * which is the job that made a grep like this honest), and every runner
 * reaches it through an import.
 *
 * Registered from tests/index.js beside tests/runnerguard.js, the check this
 * one is modelled on. It reads source text and draws no frame. Nothing here
 * imports main.js (Section 3.1).
 */

import { codeOf, uncommented } from './sourcetext.js';
import { parseArgs, listArg, scalarArg, ARG_CASES } from '../../scripts/args.mjs';

const SELF = 'every-runner-reads-one-command-line-and-a-flag-given-twice-is-kept';

/** Where the one parser lives, and where a second one must not appear. */
const OWNER = '/scripts/args.mjs';
const RUNNERS = ['/scripts/suite.mjs', '/scripts/headless.mjs', '/scripts/shot.mjs', '/scripts/probe.mjs', '/scripts/bench.mjs'];

/**
 * A declaration of the parser, which is the thing there may be only one of.
 * A re-export is not a declaration, which is why this looks for `function`
 * and not for the bare name - `headless.mjs` re-exports all four helpers so
 * the three small runners keep importing them from one place.
 */
const DECLARES_A_PARSER = /function parseArgs\s*\(/;

/**
 * Each runner, the flags it says may repeat, and the ones it says take a
 * single value. The point of writing them down is that the clauses below are
 * checkable **per flag** rather than per file: a `--pose` that stopped going
 * through `listArg` is the original defect returning, and a `--subset` that
 * stopped going through the refusal is two regexes with one of them used.
 *
 * Read against the runner's own source: a repeatable flag must be passed to
 * `listArg`, a scalar one to the refusing reader (`scalarArg`, or the local
 * `one()` that wraps it with the runner's own exit). Anything neither is a
 * flag nobody decided about, which is the state every one of them was in.
 */
const FLAGS = [
  { runner: '/scripts/suite.mjs', repeat: ['map'], scalar: ['runs', 'channel', 'timeout', 'subset', 'details', 'cores', 'cooldown', 'stall', 'stall-wait'] },
  { runner: '/scripts/shot.mjs', repeat: ['pose', 'map'], scalar: ['channel', 'out', 'query', 'slide'] },
  { runner: '/scripts/probe.mjs', repeat: [], scalar: ['channel', 'out', 'query', 'map'] },
  { runner: '/scripts/bench.mjs', repeat: ['map', 'quality'], scalar: ['runs', 'channel', 'out', 'stall', 'samples'] },
];

/** The refusal each runner prints, so a bad command line is loud and is not a red check. */
const REFUSAL = 'REFUSED:';

/** Read a file from the origin the way benchlist.js and runnerguard.js do. */
async function text(origin, rel) {
  const response = await fetch(`${origin}${rel}`);
  if (!response.ok) return { error: `${rel}: ${response.status}` };
  return { body: await response.text() };
}

/** Is this flag read through `listArg`, under either spelling a runner uses? */
function readsAsList(code, flag) {
  return new RegExp(`listArg\\(args(\\.${flag}\\b|\\['${flag}'\\])`).test(code);
}

/** And through the refusing reader, directly or through the runner's own `one()`? */
function readsAsScalar(code, flag) {
  return new RegExp(`(scalarArg\\(args, '${flag}'\\)|one\\('${flag}'\\))`).test(code);
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: SELF,
    spec: 'Section 17.1 (the AUTO suite), F6, F9, H58',
    name: 'One command-line parser serves every runner, a flag given twice keeps both values, and a flag that takes one value refuses a second',
    run: async () => {
      const origin = location.origin;
      const problems = [];

      // ------------------------------------------------------------------
      // 1. The behaviour, which is the half runnerguard.js cannot reach: the
      //    parser is a pure function and the page runs it. Every case is the
      //    module's own, so a shape that stops working is reported in the
      //    words of what it was for.
      // ------------------------------------------------------------------
      if (ARG_CASES.length < 8) {
        problems.push(`scripts/args.mjs offers ${ARG_CASES.length} cases; the table is 8+ and covers one value, a list, a repeat, a bare flag and a positional`);
      }
      let repeats = 0;
      for (const kase of ARG_CASES) {
        const got = parseArgs(kase.argv);
        for (const [key, want] of Object.entries(kase.want)) {
          if (JSON.stringify(got[key]) !== JSON.stringify(want)) {
            problems.push(`${kase.why}: parseArgs(${JSON.stringify(kase.argv)}).${key} is ${JSON.stringify(got[key])}, want ${JSON.stringify(want)}`);
          }
        }
        const [key, wantList] = kase.list;
        const gotList = listArg(got[key]);
        if (JSON.stringify(gotList) !== JSON.stringify(wantList)) {
          problems.push(`${kase.why}: listArg of --${key} is ${JSON.stringify(gotList)}, want ${JSON.stringify(wantList)}`);
        }
        // The refusal, both ways round: a flag given twice must throw and a
        // flag given once must not. A reader that threw on everything would
        // satisfy half of this and break every runner.
        const asked = kase.refuses ?? key;
        let threw = null;
        try { scalarArg(got, asked); } catch (err) { threw = err.message; }
        if (kase.refuses && !threw) {
          problems.push(`${kase.why}: --${asked} was given more than once and scalarArg returned instead of refusing`);
        }
        if (!kase.refuses && threw) {
          problems.push(`${kase.why}: --${asked} was given at most once and scalarArg refused it ("${threw}")`);
        }
        if (kase.refuses) repeats++;
      }
      // The table's own instrument, on F8's model and audiocontext.js's: a
      // table of cases that happened to contain no repeat would pass every
      // clause above while testing nothing about H58's actual defect.
      if (repeats < 2) {
        problems.push(`only ${repeats} of the ${ARG_CASES.length} cases gives a flag twice; the defect this check exists for is a repeated flag, so a table without one proves nothing`);
      }

      // ------------------------------------------------------------------
      // 2. There is one parser. It was two, and the two had drifted.
      // ------------------------------------------------------------------
      // Two readings of every runner, and H53 is a job old enough that this
      // check walked into its hole before taking its advice. `code` has the
      // comments **and the strings** out, which is right for the one clause
      // below asking what a module *does* - declare a parser. Everything
      // else here is a flag name, a module path or a line of output, and all
      // three are **strings**: read through `code` they vanish, and the
      // first run of this check reported all thirty-one of its clauses
      // broken. `said` keeps them.
      const sources = new Map();
      for (const rel of [OWNER, ...RUNNERS]) {
        const read = await text(origin, rel);
        if (read.error) { problems.push(read.error); continue; }
        sources.set(rel, { code: codeOf(read.body), said: uncommented(read.body) });
      }
      const owner = sources.get(OWNER);
      if (owner && !DECLARES_A_PARSER.test(owner.code)) {
        problems.push(`${OWNER} does not declare parseArgs, and it is where the one parser lives; the clause below is about to call every runner an offender`);
      }
      for (const rel of RUNNERS) {
        const read = sources.get(rel);
        if (!read) continue;
        if (DECLARES_A_PARSER.test(read.code)) {
          problems.push(`${rel} declares a parser of its own; there was a second copy until H58 and the two had already drifted over whether a positional is kept`);
        }
        if (!/from '\.\/args\.mjs'/.test(read.said) && !/from '\.\/headless\.mjs'/.test(read.said)) {
          problems.push(`${rel} imports the command line from neither ./args.mjs nor ./headless.mjs, so it is reading one of its own`);
        }
      }

      // ------------------------------------------------------------------
      // 3. Every flag was decided about: collected, or refused.
      // ------------------------------------------------------------------
      for (const entry of FLAGS) {
        const read = sources.get(entry.runner);
        if (!read) continue;
        const code = read.said;
        for (const flag of entry.repeat) {
          if (!readsAsList(code, flag)) {
            problems.push(`${entry.runner} is declared to let --${flag} repeat and does not read it through listArg; this is H58's own defect, which lost every --pose but the last`);
          }
        }
        for (const flag of entry.scalar) {
          if (!readsAsScalar(code, flag)) {
            problems.push(`${entry.runner} is declared to take one --${flag} and does not read it through the refusing reader; a second value would be kept or dropped silently`);
          }
          if (readsAsList(code, flag)) {
            problems.push(`${entry.runner} reads --${flag} as both a list and a single value; one of the two is wrong and neither says which`);
          }
        }
        if (!code.includes(REFUSAL)) {
          problems.push(`${entry.runner} never prints "${REFUSAL}", so a refused flag reaches the reader as a stack trace rather than as a sentence naming the flag`);
        }
      }

      const flags = FLAGS.reduce((sum, e) => sum + e.repeat.length + e.scalar.length, 0);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${ARG_CASES.length} parser cases (${repeats} giving a flag twice), one parser in ${OWNER} and none in the ${RUNNERS.length} runners`
            + `, ${flags} flags across ${FLAGS.length} runners each read as a list or refused as a scalar`
          : problems.join('; '),
      };
    },
  });
}
