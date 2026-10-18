/**
 * BLACKLINE - tests/detaildrift.js
 *
 * AUTO suite (H79): a reading that drifts while passing, and the instrument
 * that can now see it.
 *
 * **What was invisible.** `flaky` compares **verdicts**. A check that answers
 * 19,228 pixels on one run and 19,260 on the next is green both times and the
 * suite says nothing, so a floor set just under one run's reading is a floor
 * that will go red on a Tuesday and nobody can tell which floors those are.
 * H74 found ten such readings by hand across two runs of each map;
 * `scripts/detaildrift.mjs` finds them on every run, and this file drives it.
 *
 * **Why the comparison is a module and not a regex at the call site.** The
 * first draft read a leading minus as part of a number and left a leading plus
 * in the prose, so `glove-lip +0.066` and `glove-lip -0.012` - one reading,
 * twice, on either side of zero - came back as *the wording differs* and the
 * drift they were the clearest case of went unmeasured. `SIGN_CASE` below is
 * that pair, and it is the reason this file exists rather than a comment.
 *
 * **And the report must stay a reading.** D48's shape, and `spreadMs`'s: a
 * threshold on how far a reading may drift is a rule nobody has argued, so the
 * last clause reads the runner's own `ok` line and requires drift to be absent
 * from it. A reading that quietly became a verdict would red here and nowhere
 * else, because every other symptom of it is a run that went red for a reason
 * the queue never agreed to.
 *
 * Nothing here renders a frame. Registered from tests/index.js; nothing
 * imports main.js (Section 3.1).
 */

import { skeleton, compareDetails, driftOnMap, driftByMap, sayDrift } from '../../scripts/detaildrift.mjs';
// The weak reader, imported rather than copied (H68): comments out, because
// an explanation is not an ask, and strings kept because this module's own
// subject is the wording of a detail line.
import { uncommented } from './sourcetext.js';

/** The runner whose wiring the last two clauses read. */
const REPORTER = '/scripts/suitereport.mjs';

/**
 * The pair that cost the first draft its answer, written out so the fix cannot
 * be undone silently: the same reading on either side of zero.
 */
const SIGN_CASE = {
  before: 'glove-lip +0.066 +0.059; worst 0.066m of 0.15m',
  after: 'glove-lip -0.012 -0.008; worst 0.065m of 0.15m',
};

/**
 * One row a question. `kind` is what the comparison must answer; `widest` is
 * the share the biggest move must come back as, to two places, where one is
 * expected.
 */
const CASES = [
  {
    says: 'two identical lines are not drift',
    before: 'the killer covers 50942 pixels', after: 'the killer covers 50942 pixels',
    kind: 'same',
  },
  {
    says: 'a pixel count that moved is drift, with its share',
    before: 'the killer covers 50942 pixels', after: 'the killer covers 50977 pixels',
    kind: 'numbers', widest: 35 / 50977, changes: 1,
  },
  {
    says: 'a sign is part of the number, so a reading that crossed zero still compares',
    ...SIGN_CASE, kind: 'numbers', changes: 3,
  },
  {
    says: 'a number that gained a digit is still one number',
    before: 'reset keeps breath 70.95s', after: 'reset keeps breath 158.09s',
    kind: 'numbers', widest: (158.09 - 70.95) / 158.09, changes: 1,
  },
  {
    says: 'a count of one against a count of none is a full move and not a crash',
    before: '1 of them', after: '0 of them',
    kind: 'numbers', widest: 1, changes: 1,
  },
  {
    says: 'a different branch is wording, and says so rather than inventing a number',
    before: 'the worst viewpoint ("deck-mid@3") costs 682.70ms',
    after: 'nothing was timed, so there is no worst viewpoint',
    kind: 'wording',
  },
  {
    says: 'two lines that part company only at the end read as the 400-character cut',
    before: `${'x'.repeat(380)} tails in 2 segm`,
    after: `${'x'.repeat(380)} tails in 12 seg`,
    kind: 'wording', prefixAtLeast: 0.9,
  },
  {
    says: 'an absent detail compares against a present one rather than throwing',
    before: undefined, after: 'something',
    kind: 'wording',
  },
];

/** A run of one map, as `judge()` holds them. */
const run = (map, results) => ({ map, results });

/** Read a file from the origin the way runnerguard.js and benchlist.js do. */
async function text(origin, rel) {
  const response = await fetch(`${origin}${rel}`);
  if (!response.ok) return { error: `${rel}: ${response.status}` };
  return { body: await response.text() };
}

/** Each case asked of `compareDetails`, with what it answered. */
function askTheCases(problems) {
  let answered = 0;
  for (const c of CASES) {
    const got = compareDetails(c.before, c.after);
    if (got.kind !== c.kind) {
      problems.push(`"${c.says}": answered ${got.kind}, want ${c.kind}`);
      continue;
    }
    if (c.changes !== undefined && got.changes.length !== c.changes) {
      problems.push(`"${c.says}": ${got.changes.length} number(s) moved, want ${c.changes}`);
    }
    if (c.widest !== undefined && Math.abs(got.widest.share - c.widest) > 5e-3) {
      problems.push(`"${c.says}": widest share ${got.widest.share.toFixed(4)}, want ${c.widest.toFixed(4)}`);
    }
    if (c.prefixAtLeast !== undefined && !(got.prefix >= c.prefixAtLeast)) {
      problems.push(`"${c.says}": the two agree for ${(got.prefix * 100).toFixed(0)}% of their length, want ${c.prefixAtLeast * 100}% or more`);
    }
    answered++;
  }
  return answered;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-reading-that-drifts-between-two-runs-is-reported-with-its-numbers',
    spec: 'Section 17.1 / H79',
    name: 'The runner says which checks answered differently between the two runs of a map, by how much, and never turns that into a verdict',
    run: async (h) => {
      const problems = [];

      // 1. The comparison, case by case.
      const answered = askTheCases(problems);

      // A number and the prose around it are separable at all, which every
      // case above assumes and none of them states.
      // Three, not four: `1280x720` is two numbers with an `x` between them,
      // which is the right answer and not an obvious one.
      const split = skeleton('the killer covers 50942 pixels of a 1280x720 buffer');
      if (split.numbers.length !== 3) {
        problems.push(`the skeleton found ${split.numbers.length} number(s) in a line with three in it (50942, 1280, 720)`);
      }
      if (/\d/.test(split.prose)) problems.push('the skeleton left a digit in the prose');

      // 2. The census over a map's runs.
      const a = run('plant', [
        { id: 'drifts', pass: true, detail: 'covers 100 pixels' },
        { id: 'holds', pass: true, detail: 'covers 100 pixels' },
        { id: 'only-in-the-first', pass: true, detail: 'covers 100 pixels' },
        { id: 'drifts-less', pass: true, detail: 'covers 1000 pixels' },
      ]);
      const b = run('plant', [
        { id: 'drifts', pass: true, detail: 'covers 200 pixels' },
        { id: 'holds', pass: true, detail: 'covers 100 pixels' },
        { id: 'drifts-less', pass: true, detail: 'covers 1010 pixels' },
      ]);
      const found = driftOnMap([a, b]);
      const names = found.map(x => x.id);
      if (names.join(',') !== 'drifts,drifts-less') {
        problems.push(`the census found [${names.join(', ')}], want [drifts, drifts-less] - widest first, and a check in one run only is not drift`);
      }
      if (driftOnMap([a]).length) problems.push('a single run cannot drift and should report nothing');

      // Per map, and the two must not be pooled: the same id drifting on one
      // map says nothing about the other, which is the mistake H25 found in
      // the probe line and the reason that one is printed per map too.
      const byMap = driftByMap([a, b, run('yard', [{ id: 'drifts', pass: true, detail: 'covers 5 pixels' }])], ['plant', 'yard']);
      const yard = byMap.find(x => x.map === 'yard');
      if (!yard || yard.count !== 0 || yard.runs !== 1) {
        problems.push('a map with one run was counted as drifting, or counted the other map\'s runs');
      }

      // The sentence a reader actually sees.
      const said = sayDrift(found[0]);
      if (!said.includes('100 -> 200') || !said.includes('drifts')) {
        problems.push(`the summary line for the widest drift reads "${said}", which does not name the check and its move`);
      }

      // 3. The runner really calls it, and really reports it. A module that
      // nothing imports is a module that proves nothing (H61's shape).
      const origin = window.location.origin;
      const reporter = await text(origin, REPORTER);
      if (reporter.error) {
        problems.push(`${reporter.error} - this clause reads the runner's source`);
      } else {
        const source = uncommented(reporter.body);
        if (!/from '\.\/detaildrift\.mjs'/.test(source)) {
          problems.push(`${REPORTER} does not import ./detaildrift.mjs, so nothing in a run uses this instrument`);
        }
        if (!/\bdrift\s*=\s*driftByMap\(/.test(source)) {
          problems.push(`${REPORTER} does not call driftByMap(), so the report carries no drift`);
        }
        if (!/^\s*drift,\s*$/m.test(source)) {
          problems.push(`${REPORTER} computes the drift and does not put it in the report it returns`);
        }
        if (!/sayDrift\(/.test(source)) {
          problems.push(`${REPORTER} never prints a drift line, so a reader of the summary cannot see one`);
        }

        // 4. A reading and never a verdict (D48). The `ok` line is the whole
        // of the suite's exit code, and drift must not be in it.
        const verdict = /const ok = [^;]*;/.exec(source);
        if (!verdict) {
          problems.push(`${REPORTER} no longer has a single \`const ok = ...\` line, and this clause reads it`);
        } else if (/drift/.test(verdict[0])) {
          problems.push(`the run's verdict reads the drift: "${verdict[0].trim()}" - a threshold on how far a reading may drift is a rule nobody has argued (D48)`);
        }
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${answered} comparison cases answered, including the sign pair that cost the first draft its reading; `
            + `the census of two runs found ${found.length} drifting of 4 ids, widest first (${said}); `
            + `${REPORTER} imports the module, calls driftByMap(), carries \`drift\` in the report and prints it, `
            + 'and its `ok` line does not read it'
          : problems.join('; '),
      };
    },
  });
}
