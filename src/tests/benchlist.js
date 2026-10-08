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

/** This check's own id: the policeman is not exemptible, here either. */
const SELF = 'the-bench-only-list-holds-only-checks-the-bench-itself-runs';

/** F15's policeman, which may not be dropped by this route either. */
const SKIP_GUARD = 'the-headless-skip-list-holds-only-the-check-it-declares';

/**
 * Every check `npm run bench` runs, and whether the gate drops it. A new
 * entry here is a deliberate edit visible in the diff of the commit that
 * makes it, which is the difference between an exemption and a way past.
 */
const ALLOWED = [
  {
    id: 'the-frame-budget-holds-everywhere-not-just-at-site-a',
    benchOnly: true,
    why: 'times 92 viewpoints against an 8.33ms ceiling, and headless draws them with SwiftShader',
  },
  {
    id: 'frame-budget-under-the-check-29-load',
    benchOnly: false,
    why: 'the gate counts its CPU median; the bench adds the GPU half the software path cannot give',
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
}
