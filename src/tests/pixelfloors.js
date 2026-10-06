/**
 * BLACKLINE - tests/pixelfloors.js
 *
 * AUTO suite (H30): every pixel floor under `src/tests/` is a fraction of the
 * drawing buffer, or it is one of three that says why it is not.
 *
 * **The census this holds.** H24 ran the suite at `low` for the first time and
 * three picture checks went red with nothing wrong with the game: the buffer is
 * 896x503 at `low` against 1280x720 at `medium`, and a floor of 2,000 pixels was
 * 2,000 whatever the buffer was. H28 fixed the six it had found and left the rest
 * as H30, with the honest note that *none of them is red at any level today,
 * which means only that no level happens to cross them* - which was exactly true
 * of H28's six before anybody ran the suite at another level. So H30 read every
 * floor in the suite, scaled eight and argued three, and this check is what stops
 * the fourth arriving unnoticed.
 *
 * **Why a table and not a comment convention.** `no-source-file-calls-math-
 * random-or-sets-a-timer` (F13) is the model: the ban is the default, every
 * allowance is named in a table with the reason, and the check asserts the
 * allowance is **still used** as well as that nothing else does it. An exemption
 * for something that has gone is an exemption the next line inherits without
 * arguing. A comment convention would let a new floor be written with the magic
 * words above it and never read by anybody.
 *
 * **What counts as a pixel floor**, deliberately narrowly: a comparison of
 * something named for a count of pixels against a bare integer literal, on a line
 * that is code rather than prose. It will not catch a floor hidden behind
 * arithmetic, and it is not meant to - `FLOORS` is a regex over source text and
 * the moment it tried to understand expressions it would start lying. What it
 * does catch is the shape every one of the twelve floors H30 found was written
 * in, which is the shape the next one will be written in too.
 *
 * Nothing here draws a frame, so it is cheap and it is registered beside the
 * other census checks rather than with the picture ones. Nothing imports
 * main.js (Section 3.1).
 */

/**
 * A floor is a count-ish name compared against a bare integer. `scaledCount(...)`
 * and a comparison against a named `...Floor` both read as something else and are
 * not matched, which is the point: the fix H30 applied is invisible to this
 * pattern and the thing it replaced is not.
 */
const FLOORS = /\b(?:count|masked|brightened|covered|lit|interior|surround)\s*<\s*(\d+)\b/g;

/**
 * The pattern's own instrument check, because **this check goes quiet rather than
 * red when it stops working**: if `FLOORS` ever matched nothing at all - a typo, a
 * flag dropped, somebody "tidying" the character class - the census would read
 * *zero absolute floors* and pass, which is the answer it gives when everything
 * is correct. So it is exercised every run on a line that must match and a line
 * that must not, which is the shape the H30 fix actually took: the floor moved out
 * of the comparison and into a named `...Floor` computed by `scaledCount`.
 *
 * F8's clause is the model - prove the instrument can see the thing before
 * trusting it to report the thing's absence.
 *
 * **And the number is interpolated rather than written**, because the first draft
 * spelled the line out as a literal and this check duly flagged *itself* - a
 * census that cannot survive describing its own subject is a census with a hole
 * in it. `donedef.js` has the same problem with `Math.random` and solves it the
 * same way, reading the call's name back off its own pattern so the file is
 * scanned like every other rather than excused.
 */
const FIXED = 5000;
const MUST_MATCH = `if (diff.count < ${FIXED}) {`;
const MUST_NOT_MATCH = 'if (diff.count < smokeFloor) {';

/**
 * The floors that are absolute on purpose. Each is an **existence** claim and not
 * a size one - *something was drawn at all* - with the size, placement or shape
 * asserted properly in the clauses around it. Scaling one would make the tripwire
 * looser on a small buffer, which is backwards for a tripwire.
 *
 * `why` is what the entry and the detail line say; it is read back rather than
 * written twice.
 */
const ALLOWED = [
  {
    path: 'src/tests/visual.js',
    value: 10,
    why: 'tripping the alarm changed the screen at all (the colour, not a material)',
  },
  {
    path: 'src/tests/feedback.js',
    value: 20,
    why: 'the hit marker is on screen at all; its size and centring are fractions of the height below it',
  },
];

/**
 * How many times each allowance may appear in its file. `feedback.js` makes the
 * same twenty-pixel existence claim twice - once for the hit marker and once for
 * the damage arc - and both are argued at their lines, so the count is named here
 * rather than left as "some".
 */
const ALLOWED_TIMES = { 'src/tests/visual.js:10': 1, 'src/tests/feedback.js:20': 2 };

/**
 * The suite is this many modules under `src/tests/` or the Resource Timing list
 * is not the suite. It is 77 today; the bar is low enough that retiring a check
 * module is not a false red and high enough that an empty or filtered list is.
 * F13's own `MIN_MODULES` is larger because it counts the whole of `src/`.
 */
const MIN_MODULES = 60;

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'every-pixel-floor-under-tests-is-a-fraction-of-the-buffer-or-says-why-not',
    spec: 'Section 16 / H30',
    name: 'No check under src/tests/ compares a count of pixels against a bare number, but for the two existence tripwires named here, and each of those is still there',
    run: async () => {
      // The same Resource Timing list F13's bans read: the modules that actually
      // ran, never a guess at the import graph.
      const origin = location.origin;
      const modules = new Set();
      for (const entry of performance.getEntriesByType('resource')) {
        const url = entry.name.split('?')[0];
        if (!url.startsWith(origin) || !url.endsWith('.js') || url.indexOf('/src/') === -1) continue;
        const path = url.slice(url.indexOf('/src/') + 1);
        if (path.startsWith('src/tests/')) modules.add(path);
      }
      if (modules.size < MIN_MODULES) {
        return { pass: false, detail: `Resource Timing lists ${modules.size} modules under src/tests/; the suite is ${MIN_MODULES}+` };
      }

      const problems = [];
      const found = [];
      let prose = 0;

      // The instrument first (see MUST_MATCH): a census that reports an absence
      // has to show it can see a presence.
      FLOORS.lastIndex = 0;
      const canSee = FLOORS.exec(MUST_MATCH);
      FLOORS.lastIndex = 0;
      const canTell = FLOORS.exec(MUST_NOT_MATCH);
      if (!canSee || Number(canSee[1]) !== FIXED) {
        problems.push(`the pattern does not match ${MUST_MATCH.trim()} - it would report every file clean`);
      }
      if (canTell) {
        problems.push(`the pattern matches ${MUST_NOT_MATCH.trim()}, which is the scaled form - every fixed floor would read as a violation`);
      }
      for (const path of [...modules].sort()) {
        const lines = (await (await fetch(`${origin}/${path}`)).text()).split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          FLOORS.lastIndex = 0;
          let hit = FLOORS.exec(line);
          if (!hit) continue;
          // Prose or code, decided line-locally and never by parsing, as F13
          // does it: a comparison cannot live on a line whose first character
          // is a comment's, and this file's own prose quotes these numbers.
          if (/^\s*(\/\/|\/\*|\*)/.test(line)) {
            while (hit) { prose++; hit = FLOORS.exec(line); }
            continue;
          }
          while (hit) {
            found.push({ path, line: i + 1, value: Number(hit[1]) });
            hit = FLOORS.exec(line);
          }
        }
      }

      // Every floor that is there is one of the allowances.
      for (const floor of found) {
        const allowed = ALLOWED.find((a) => a.path === floor.path && a.value === floor.value);
        if (!allowed) {
          problems.push(`${floor.path}:${floor.line} compares a count of pixels against ${floor.value} - scale it with scaledCount(lens, ${floor.value}) from pixels.js, or add it to ALLOWED here with the reason it is an existence claim`);
        }
      }
      // And every allowance is still used, the number of times it says. A floor
      // that has gone leaves an exemption behind for the next one to inherit.
      for (const allowed of ALLOWED) {
        const key = `${allowed.path}:${allowed.value}`;
        const want = ALLOWED_TIMES[key] ?? 1;
        const hits = found.filter((f) => f.path === allowed.path && f.value === allowed.value);
        if (hits.length === 0) {
          problems.push(`${allowed.path} no longer compares a count against ${allowed.value} - ${allowed.why}; drop it from ALLOWED`);
        } else if (hits.length !== want) {
          problems.push(`${allowed.path} compares a count against ${allowed.value} ${hits.length} times, and ALLOWED_TIMES says ${want} (lines ${hits.map((f) => f.line).join(', ')})`);
        }
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${modules.size} check modules read; ${found.length} absolute pixel floors, all of them existence tripwires argued at their lines `
            + `(${ALLOWED.map((a) => `${a.path.slice(10)} ${a.value}px: ${a.why}`).join('; ')}); `
            + `${prose} more quoted in prose. Every other floor in the suite is a fraction of the drawing buffer, `
            + 'and the pattern was shown to see a fixed floor and to ignore a scaled one before reporting that'
          : problems.join('; '),
      };
    },
  });
}
