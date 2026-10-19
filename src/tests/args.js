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
 * **Nothing in here is written down by hand any more (H64).** The runners and
 * the flags each one reads are both read off the tree: `package.json`'s own
 * commands are the entry points, the `from './<name>.mjs'` graph is the rest -
 * five commands reach **nine** modules, which is every `.mjs` under `scripts/`
 * - and each module's flags are every `args.<name>`, `args['<name>']`,
 * `scalarArg(args, '<name>')` and `one('<name>')` in its source. That closes
 * two holes a hand-written list had, and **both were open**: `watchdog.mjs`,
 * `version.mjs`, `suitereport.mjs`, `args.mjs` and `headless.mjs` were outside
 * the census altogether, so the day one grew a flag nothing would have said it
 * was unclassified; and seven flags on two runners that *are* in the census
 * were simply missing from the table - `--url`, `--regression`, `--query`,
 * `--pre` and `--allow-other-runners` on the suite, `--onscreen` and
 * `--window-position` on the bench. **All seven were already decided about**,
 * every one of them read through `one()`, so this job changed no runner's
 * behaviour: the table was the only thing out of date, which is exactly the
 * failure a hand-written list has and a derived one cannot.
 *
 * The page cannot list a directory - `/scripts/` is a 404, measured - so the
 * import graph is how "every `.mjs` under `scripts/`" is reached, and the
 * instrument below asserts the crawl got past its own entry points.
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

/**
 * Names that look like a flag read and are not. `_` is the positionals, which
 * `parseArgs` collects and no runner declares; the three extensions are the
 * one thing reading from `said` cannot tell apart for itself, because
 * `from './args.mjs'` is a **string** and survives there on purpose (H53).
 */
const NOT_A_FLAG = new Set(['_', 'mjs', 'js', 'json']);

/**
 * Every flag a module reads, off its own source: the two ways a value is
 * taken (`args.name`, `args['name']`) and the two readers it may be handed to
 * (`scalarArg(args, 'name')`, the runner's local `one('name')`). A flag read
 * one way and never the other is the hole this is for - `--foo` taken as
 * `args.foo` with no reader touching it used to pass every clause there was.
 */
function flagsIn(said) {
  const out = new Set();
  const add = (name) => { if (name && !NOT_A_FLAG.has(name)) out.add(name); };
  for (const m of said.matchAll(/(^|[^\w/'"`.])args\.([A-Za-z_][\w]*)/g)) add(m[2]);
  for (const m of said.matchAll(/args\['([a-z][a-z0-9-]*)'\]/g)) add(m[1]);
  for (const m of said.matchAll(/scalarArg\(args, '([a-z][a-z0-9-]*)'\)/g)) add(m[1]);
  for (const m of said.matchAll(/\bone\('([a-z][a-z0-9-]*)'\)/g)) add(m[1]);
  return [...out].sort();
}

/**
 * The runners, read off the tree. `package.json`'s commands are the entry
 * points and the import graph is the rest, so a tenth module under `scripts/`
 * joins the census the day something runs it rather than the day somebody
 * remembers to add it here.
 *
 * @returns {Promise<{ sources: Map<string, {code: string, said: string}>, entries: string[], missing: string[] }>}
 */
async function discoverRunners(origin, read) {
  const pkg = await read(origin, '/package.json');
  if (pkg.error) return { sources: new Map(), entries: [], missing: [`package.json: ${pkg.error}`] };
  const commands = Object.values(JSON.parse(pkg.body).scripts || {});
  const entries = [...new Set(commands.flatMap((cmd) => [...cmd.matchAll(/scripts\/([a-z-]+\.mjs)/g)].map((m) => `/scripts/${m[1]}`)))];
  const sources = new Map();
  const missing = [];
  const queue = [...entries];
  while (queue.length) {
    const rel = queue.shift();
    if (sources.has(rel)) continue;
    const got = await read(origin, rel);
    if (got.error) { missing.push(got.error); continue; }
    const said = uncommented(got.body);
    sources.set(rel, { code: codeOf(got.body), said });
    for (const m of said.matchAll(/from '\.\/([a-z-]+\.mjs)'/g)) queue.push(`/scripts/${m[1]}`);
  }
  return { sources, entries, missing };
}

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
  { runner: '/scripts/suite.mjs', repeat: ['map'], scalar: ['runs', 'channel', 'timeout', 'subset', 'details', 'cores', 'cooldown', 'stall', 'stall-wait', 'url', 'regression', 'query', 'pre', 'allow-other-runners'] },
  { runner: '/scripts/shot.mjs', repeat: ['pose', 'map'], scalar: ['channel', 'out', 'query', 'slide'] },
  { runner: '/scripts/probe.mjs', repeat: [], scalar: ['channel', 'out', 'query', 'map'] },
  { runner: '/scripts/bench.mjs', repeat: ['map', 'quality'], scalar: ['runs', 'channel', 'out', 'stall', 'samples', 'onscreen', 'window-position'] },
  // H16: a runner of its own that reads git and PROGRESS.md and no command
  // line - a zero here is a claim, as it is for the six below.
  { runner: '/scripts/notes.mjs', repeat: [], scalar: [] },
  // The six that read no command line. They are in the census **because**
  // they read none: an entry saying zero is a claim the clauses below hold
  // both ways, and absence was not. `args.mjs` is the parser itself and
  // `headless.mjs` re-exports it; the other four take their work from the
  // runner that imports them. The day any of them grows a flag, that flag has
  // nowhere to hide (H64) - and `detaildrift.mjs` is the proof that this works
  // rather than a claim about it: H79 added it, ran the four censuses under
  // `src/tests/` that TRAPS.md names, and the verify went red here anyway,
  // because a new module under `scripts/` is a row in *this* census and that
  // list did not say so.
  { runner: '/scripts/args.mjs', repeat: [], scalar: [] },
  { runner: '/scripts/detaildrift.mjs', repeat: [], scalar: [] },
  { runner: '/scripts/headless.mjs', repeat: [], scalar: [] },
  { runner: '/scripts/suitereport.mjs', repeat: [], scalar: [] },
  { runner: '/scripts/version.mjs', repeat: [], scalar: [] },
  { runner: '/scripts/watchdog.mjs', repeat: [], scalar: [] },
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
      const { sources, entries, missing } = await discoverRunners(origin, text);
      problems.push(...missing);
      const runners = [...sources.keys()].sort();
      const readsFlags = new Map(runners.map((rel) => [rel, flagsIn(sources.get(rel).said)]));

      // The crawl's own instrument, on F8's model: a graph walk that never
      // left its entry points is a hand-written list wearing a derivation.
      if (runners.length <= entries.length) {
        problems.push(`the import graph from package.json's ${entries.length} command(s) reached ${runners.length} module(s) under scripts/, so the crawl followed nothing; every clause below is then about the entry points only`);
      }

      const owner = sources.get(OWNER);
      if (!owner) {
        problems.push(`${OWNER} is not reachable from package.json's commands, and it is where the one parser lives; the clause below is about to call every runner an offender`);
      } else if (!DECLARES_A_PARSER.test(owner.code)) {
        problems.push(`${OWNER} does not declare parseArgs, and it is where the one parser lives; the clause below is about to call every runner an offender`);
      }
      for (const rel of runners) {
        if (rel === OWNER) continue;
        const read = sources.get(rel);
        if (DECLARES_A_PARSER.test(read.code)) {
          problems.push(`${rel} declares a parser of its own; there was a second copy until H58 and the two had already drifted over whether a positional is kept`);
        }
        // Asked only of a module that reads a command line. The three that
        // take their work from whoever imports them need no parser, and a
        // clause that demanded one of them would be noise rather than a claim.
        if (readsFlags.get(rel).length && !/from '\.\/args\.mjs'/.test(read.said) && !/from '\.\/headless\.mjs'/.test(read.said)) {
          problems.push(`${rel} reads ${readsFlags.get(rel).length} flag(s) and imports the command line from neither ./args.mjs nor ./headless.mjs, so it is reading one of its own`);
        }
      }

      // ------------------------------------------------------------------
      // 2b. The census covers the tree, both ways (H64). A module the graph
      //     reaches and the table does not know is the hole that let five
      //     modules sit outside this check; a table entry naming a module
      //     nothing runs is the declaration a later reader inherits.
      // ------------------------------------------------------------------
      const declared = new Map(FLAGS.map((entry) => [entry.runner, entry]));
      for (const rel of runners) {
        if (!declared.has(rel)) {
          problems.push(`${rel} is reachable from package.json and is in no FLAGS entry, so the ${readsFlags.get(rel).length} flag(s) it reads are unclassified and a flag added to it would be invisible`);
        }
      }
      for (const entry of FLAGS) {
        if (!sources.has(entry.runner)) {
          problems.push(`FLAGS declares ${entry.runner}, which nothing under package.json's commands reaches; either it has gone or the graph has, and a census of a file nobody runs holds nothing`);
        }
      }

      // ------------------------------------------------------------------
      // 3. Every flag was decided about: collected, or refused.
      // ------------------------------------------------------------------
      for (const entry of FLAGS) {
        const read = sources.get(entry.runner);
        if (!read) continue;
        const code = read.said;

        // Both ways against the source (H64). A flag the runner reads and the
        // table does not name is one nobody decided about, which is how seven
        // of them arrived; a flag the table names and the runner no longer
        // reads is a decision about nothing.
        const names = [...entry.repeat, ...entry.scalar];
        const reads = readsFlags.get(entry.runner) || [];
        for (const flag of reads) {
          if (!names.includes(flag)) {
            problems.push(`${entry.runner} reads --${flag} and FLAGS classifies it as neither repeatable nor scalar; it is a flag nobody decided about, which is the state --url, --regression, --query, --pre, --allow-other-runners, --onscreen and --window-position were all in until H64`);
          }
        }
        for (const flag of names) {
          if (!reads.includes(flag)) {
            problems.push(`FLAGS says ${entry.runner} takes --${flag} and nothing in its source reads it; an entry for a flag no runner reads is a line the next reader inherits without arguing`);
          }
        }

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
        // Asked of a runner that has something to refuse. The five that read
        // no command line print no refusal because they never take one, and
        // a clause demanding it of them would red on the day this census was
        // widened rather than on the day anything was wrong (H64).
        if (reads.length && !code.includes(REFUSAL)) {
          problems.push(`${entry.runner} reads ${reads.length} flag(s) and never prints "${REFUSAL}", so a refused flag reaches the reader as a stack trace rather than as a sentence naming the flag`);
        }
      }

      const flags = FLAGS.reduce((sum, e) => sum + e.repeat.length + e.scalar.length, 0);
      const runnerCount = runners.length;
      const entryCount = entries.length;
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${ARG_CASES.length} parser cases (${repeats} giving a flag twice), one parser in ${OWNER} and none in the other ${runnerCount - 1}`
            + `, ${runnerCount} modules reached from ${entryCount} package.json command(s)`
            + `, ${flags} flags read off the tree and each classified and read as a list or refused as a scalar`
          : problems.join('; '),
      };
    },
  });
}
