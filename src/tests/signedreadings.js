/**
 * BLACKLINE - tests/signedreadings.js
 *
 * AUTO suite (H88): a reading that is grouped or compared across cases keeps
 * its sign.
 *
 * An absolute value is right when the clause is *how far* - a body within
 * 0.15m of a lip, a drift under a bar - and wrong the moment the reading is
 * **grouped** or **compared across cases**, because two opposite answers become
 * one. H81 is the worked example and it cost a job: `settlecircuit.js` grouped
 * the settle by an absolute turn, so a Warden on its spawn facing 2.27 rad the
 * other way counted with the majority, and the census passed while a
 * photograph in eighteen was of a different body.
 *
 * **The census, taken off the tree** (H88, 2026-10-18): 213 absolute values in
 * `src/tests/`, comments excluded. 181 sit directly in a bound, a `max`, a sum
 * or a print; 13 are helpers whose callers are the same (`near`, `footOf`,
 * three copies of a wrapped `turn`); the rest were read one by one. Two
 * compare two magnitudes inside **one** case and say why in their own
 * comments - the outline's edge against its core, where the direction moves
 * with the meter (Section 4.2), and the camera's yaw against its pitch on the
 * defaults, whose signs the clauses beside it hold exactly. **One** was a
 * comparison across cases on an absolute value: two seeds that drew the same
 * first node were held to the same settle by comparing their absolute turns,
 * so a left and a right of one size agreed. It is signed now, and it is the
 * second row below; the first is the pose key H81 introduced.
 *
 * So this holds the sites that group or compare across cases, by name, off the
 * tree: each is found by its own opening, read with its strings left in (a
 * pose key is a template, and the strong reader erases what is inside one),
 * and red if an absolute value is anywhere in it. A new grouping elsewhere is
 * not seen - this is a list and not a parser - and the census above is how the
 * list was made, so the next one is a row.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { uncommented } from './sourcetext.js';

/** What an absolute value is spelt as, assembled so this file does not spell it. */
const ABS = ['Math', 'abs('].join('.');

/**
 * The sites, with the opening each is found by and what its sign is for. An
 * opening must occur exactly once in its file, or the row is about a line
 * that moved.
 */
const SITES = [
  {
    file: 'src/tests/settlecircuit.js',
    opens: 'const poseOf = ',
    why: 'the key a settle is grouped by (H81): a body facing the other way is a different photograph',
  },
  {
    file: 'src/tests/settlecircuit.js',
    opens: 'const turn = ',
    why: 'the turn two seeds that drew one node are compared on (H88): a left and a right of one size are two settles',
  },
];

/**
 * The statement a site opens: from its line to the first line that ends one.
 * Every site is a one-line arrow today, and a body that grows a line still
 * ends where its statement does.
 */
function statementAt(said, opens) {
  const lines = said.split('\n');
  const at = lines.findIndex((line) => line.indexOf(opens) !== -1);
  if (at === -1) return null;
  const out = [];
  for (let i = at; i < lines.length; i++) {
    out.push(lines[i]);
    if (lines[i].trim().endsWith(';')) break;
  }
  return out.join('\n');
}

const occurrences = (said, opens) => said.split(opens).length - 1;

/**
 * The reader's own proof, on the two shapes a break would take: the old turn
 * put back, and an absolute value inside a pose key's template. Both must be
 * seen, and the signed forms must not be.
 */
const PROOF = [
  { said: 'const turn = (a, b) => ' + ABS + 'Math.atan2(Math.sin(a - b), Math.cos(a - b)));', sees: true },
  { said: 'const poseOf = (w) => `${w.x.toFixed(4)},${' + ABS + 'w.yaw).toFixed(4)}`;', sees: true },
  { said: 'const turn = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));', sees: false },
];

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-reading-grouped-or-compared-across-cases-keeps-its-sign',
    spec: 'H81 / H88',
    name: 'Every site that groups a reading or compares it across cases reads a signed quantity, so two opposite answers stay two',
    run: async () => {
      const problems = [];
      const origin = location.origin;

      for (const { said, sees } of PROOF) {
        const seen = said.indexOf(ABS) !== -1;
        if (seen !== sees) problems.push(`the reader ${seen ? 'saw' : 'missed'} an absolute value in \`${said}\`, so every row below is read wrong`);
      }

      const texts = new Map();
      for (const site of SITES) {
        if (!texts.has(site.file)) texts.set(site.file, uncommented(await (await fetch(`${origin}/${site.file}`)).text()));
        const said = texts.get(site.file);
        const count = occurrences(said, site.opens);
        if (count !== 1) {
          problems.push(`${site.file}: \`${site.opens.trim()}\` opens ${count} statements, want 1 - the row is about a line that moved`);
          continue;
        }
        const statement = statementAt(said, site.opens);
        if (statement.indexOf(ABS) !== -1) {
          problems.push(`${site.file}: \`${site.opens.trim()}\` takes an absolute value, and it is ${site.why}`);
        }
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${SITES.length} sites that group a reading or compare it across cases, in ${texts.size} module(s), each found once and each signed; `
            + `the reader sees an absolute value in ${PROOF.filter((p) => p.sees).length} broken forms and not in the signed one`
          : problems.join('; '),
      };
    },
  });
}
