/**
 * BLACKLINE - tests/skiplist.js
 *
 * The one documented way past a red gate, held by the gate (F15).
 *
 * `scripts/suite-skips.json` names checks the headless runner drops before it
 * judges anything: `judge()` in `scripts/suite.mjs` sees a skipped id, files
 * it under `skipped` with its reason and moves on, so the check counts towards
 * neither red nor flaky and the run exits 0. That is right for the one entry
 * in it - a frame budget measured against SwiftShader says nothing about a
 * real GPU - and it is also, in exactly one line of JSON, a way to make any
 * red check disappear. The routine's own instructions say what belongs there
 * ("only a check that measures this machine's GPU or audio hardware") and that
 * adding one is "never a way past a red gate"; until this check, nothing held
 * either sentence. The weekly audit greps the file and reports it unchanged,
 * which is the shape F13 closed for the two spec bans: a grep is not a gate,
 * and the drift surfaces up to seven days later.
 *
 * So the file is a census, like F13's allowances and F14's registry. ALLOWED
 * below is the whole of what may be in it, and the comparison runs both ways:
 * an entry the file has and this list does not is red and named, and an entry
 * this list has and the file does not is red too, because an exemption for
 * something that has gone is one the next skip inherits without arguing.
 *
 * The runner carries the other half. A skip is honoured on a map only while
 * this check has run and passed there - otherwise skipping the check that
 * polices the skip list would take every other skip with it. One consequence
 * worth knowing while iterating: a `--subset` that names a skipped check and
 * not this one will see that check red, which is the rule working.
 *
 * What it cannot see: whether the reason is *true*. It holds that a reason is
 * there, is a sentence rather than a word, and names hardware - the argument
 * the rule actually allows. Whether SwiftShader really draws in 400ms is a
 * measurement, and the check that measures it is the one being skipped.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

/**
 * This check's own id. It is asserted to be absent from the skip list: the
 * policeman is not exemptible, and the runner fails closed if it ever is.
 */
const SELF = 'the-headless-skip-list-holds-only-the-check-it-declares';

/**
 * Every check the headless runner may drop, and the hardware reading that is
 * the whole of the argument for dropping it. A new entry here is a deliberate
 * edit to a check, visible in the diff and in the commit that makes it - which
 * is the point, and the difference between an exemption and a way past.
 */
const ALLOWED = [
  {
    id: 'the-frame-budget-holds-everywhere-not-just-at-site-a',
    why: 'measures this machine\'s GPU against an 8.33ms ceiling, and headless draws with SwiftShader in ~400ms',
  },
];

/**
 * The hardware a reason is allowed to appeal to. The rule is that only a check
 * measuring this machine's GPU or audio hardware belongs in the file, so a
 * reason that names none of these is not making that argument.
 */
const HARDWARE = /\b(gpu|swiftshader|software (?:webgl|renderer|rasteris)|hardware|audio|sound card)\b/i;

/** A reason shorter than this is a label, not an argument. */
const MIN_REASON = 40;

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: SELF,
    spec: 'Section 17.1 (the AUTO suite), F15',
    name: 'The headless skip list holds exactly the checks this check declares, each a live check with a hardware reason',
    run: async (h) => {
      const origin = location.origin;
      const problems = [];

      // Read from the origin, the way donedef.js and registry.js read source:
      // the file the runner itself opens, not a copy of it. A 404 here is red
      // and not a pass - the runner falls back to "no skips" when the file is
      // missing, so a check silently stops being skipped and the gate goes red
      // for the wrong reason; better to say which file went.
      const response = await fetch(`${origin}/scripts/suite-skips.json`);
      if (!response.ok) {
        return { pass: false, detail: `scripts/suite-skips.json: ${response.status}; the runner reads this file to decide what it may drop` };
      }
      let list;
      try {
        list = JSON.parse(await response.text());
      } catch (err) {
        return { pass: false, detail: `scripts/suite-skips.json does not parse (${err.message}); the runner would throw on it` };
      }
      if (!Array.isArray(list)) {
        return { pass: false, detail: 'scripts/suite-skips.json is not an array; the runner builds its map from one' };
      }

      // 1. The file and the declaration are the same set, both ways.
      const declared = new Map(ALLOWED.map((entry) => [entry.id, entry]));
      const seen = new Set();
      for (const entry of list) {
        const id = entry && entry.id;
        if (typeof id !== 'string' || !id) { problems.push(`an entry has no id (${JSON.stringify(entry)})`); continue; }
        if (seen.has(id)) problems.push(`"${id}" is listed twice`);
        seen.add(id);
        if (!declared.has(id)) {
          problems.push(`"${id}" is skipped headless and this check does not declare it; only a check measuring this machine's GPU or audio hardware belongs there, and adding one is an edit here as well`);
        }
      }
      for (const entry of ALLOWED) {
        if (!seen.has(entry.id)) problems.push(`"${entry.id}" is declared skippable (${entry.why}) and the file does not skip it; drop it from ALLOWED`);
      }
      if (seen.has(SELF)) problems.push(`"${SELF}" skips the check that holds the skip list; the runner withholds every skip on a map where this one did not pass`);

      // 2. Every skipped id is a check the suite actually registers. A skip
      // naming nothing is an exemption the next rename inherits - and it is
      // how a check that has been deleted outright leaves no mark at all.
      // (Read against the registry, not against this run's results, so a
      // `--subset` cannot make a real id look like a stale one. F14's one
      // conditional check is not in the list and would be red here if it
      // were, correctly: a check the gate never runs needs no exemption.)
      const live = new Set(h.debugTools._autoTests.map((test) => test.id));
      for (const id of seen) {
        if (!live.has(id)) problems.push(`"${id}" is skipped headless and no module registers it; the exemption names nothing`);
      }

      // 3. Each reason is an argument, and the argument is about hardware.
      for (const entry of list) {
        if (!entry || typeof entry.id !== 'string') continue;
        const reason = typeof entry.reason === 'string' ? entry.reason.trim() : '';
        if (!reason) problems.push(`"${entry.id}" is skipped with no reason`);
        else if (reason.length < MIN_REASON) problems.push(`"${entry.id}": the reason is ${reason.length} characters; ${MIN_REASON}+ is the difference between an argument and a label`);
        else if (!HARDWARE.test(reason)) problems.push(`"${entry.id}": the reason names no hardware, and hardware this machine cannot provide is the only ground for skipping`);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${list.length} check${list.length === 1 ? '' : 's'} skipped headless, each declared here, registered, and argued from hardware `
            + `(${ALLOWED.map((entry) => `${entry.id} ${entry.why}`).join('; ')}); the runner honours a skip only where this check is green`
          : problems.join('; '),
      };
    },
  });
}
