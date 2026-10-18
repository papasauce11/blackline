/**
 * BLACKLINE - tests/registry.js
 *
 * The AUTO suite counts itself (F14).
 *
 * Every other check in `src/tests/` asks a question of the game. This one
 * asks a question of the suite: is the registry still the whole of what its
 * modules declare? Nothing asked before. Delete one `registerX(debugTools);`
 * line from `registerAutoTests()` in `tests/index.js` and leave its import
 * alone - `node --check` passes, the page boots, that module's checks vanish
 * from every run and the gate exits 0 on the smaller suite. That is the
 * lesson HANDOFF.md says keeps repeating: before believing a check on a set,
 * ask whether it would notice the set being cut in half. Until this one, the
 * set nothing watched was the suite.
 *
 * The census is taken from source text, fetched from the origin the same way
 * `tests/donedef.js` reads modules for the line-count and the two bans. Two
 * things about the real tree make a naive regex wrong, and both are handled
 * rather than papered over:
 *
 *   - `heartbeat.js` registers `a-staged-hang-never-returns` only under
 *     `?hang=1`, because a check that never returns has no business in a
 *     gate. It is declared and not live, on purpose, and is named in
 *     CONDITIONAL below - which is itself asserted to be still declared.
 *   - `heartbeat.js` writes that check's sibling as `id: SELF`, a file-local
 *     constant rather than a literal. An id the census cannot read is
 *     reported red with its line, never skipped: silence is the thing this
 *     check exists to remove.
 *
 * Registered from tests/index.js, which means this check is one of the
 * registrations it counts. Nothing here imports main.js (Section 3.1).
 */

import { codeOf } from './sourcetext.js';

/**
 * Machinery a check module hands out that none of its own checks use, with who
 * reaches for it and why it is where it is (H70).
 *
 * `movement.js` was 599 lines of a 600 allowance, and the two checks that took
 * it there were about the climb key rather than about a motion - **and the two
 * ledge drivers seven other modules reach a ledge with were in the same file,
 * called by none of the three checks that stayed.** That is a seam, and this
 * is the census of it: a module that registers checks and exports something
 * its own checks never touch is declared here, with why.
 *
 * **Not a ban.** The shape is often right, because a module is usually where
 * the mechanism was measured and the readers came later - both rows below are
 * that. What it is not allowed to be is *unlooked at*: this is the seam H51,
 * H53, H58, H60, H61, H62, H70 and H75 all cut along, every one of them found
 * by a file reaching its ceiling rather than by anybody noticing the shape,
 * and a declared row is the difference between a decision and a surprise.
 *
 * Read **as code**, and anchored to the line start. `runnerguard.js` carries
 * the regex literal `/export function summary/` - it reads the runner's
 * reporter, which has one - and the strong reader leaves a literal where it
 * found it (H68's trap from the other end), so an unanchored pattern over the
 * raw text enrols a module for a grep it performs on somebody else.
 */
const SHARED_FROM_A_CHECK = [
  {
    file: 'figure.js',
    name: 'flatShadeSilhouette',
    why: 'the flat-shaded silhouette reader, used by breath.js, breathcensus.js and bufferscale.js; figure.js is where the figure itself was measured and the three readers came after',
  },
  {
    file: 'look.js',
    name: 'POSE_EYE_NAMES',
    why: 'the six candidate eye names, used by poseeye.js alone, and beside the chooseEye whose candidates they name',
  },
];

/** An export, at the line start, which is where an export is and a literal is not. */
const EXPORTED = /^export (?:async )?function (\w+)|^export const (\w+) =/gm;

/**
 * Checks that are registered only when the URL asks for them, with why. Each
 * must still be declared in its module's text - an entry for something that
 * has gone is an entry the next missing check hides behind.
 */
const CONDITIONAL = [
  { id: 'a-staged-hang-never-returns', why: 'registered only under ?hang=1; it never returns by design (F10)' },
];

/**
 * A floor on the modules `tests/index.js` pulls in - 58 today (H9). It does not
 * catch one module being dropped from both the import list and the call list,
 * which is the one shape this check cannot see; it catches the registrar
 * having collapsed to a handful and reading as a clean sweep of nothing.
 */
const MIN_TEST_MODULES = 50;

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-registry-holds-every-check-its-modules-declare',
    spec: 'Section 17.1 (the AUTO suite), F14',
    name: 'Every registrar tests/index.js imports is called exactly once, every check its modules declare is registered, and every registered check was declared',
    run: async (h) => {
      const origin = location.origin;
      const problems = [];
      const index = await (await fetch(`${origin}/src/tests/index.js`)).text();

      // 1. The registrar's own wiring. An import with no call is the silent
      // failure this check was written for; a call with no import would not
      // have loaded at all, and is here because the pair is what makes the
      // one-to-one meaningful. Order is NOT asserted here: which call runs when
      // is a question with reasons behind it per pair, and the one pair that
      // has a reason has a clause of its own next door
      // (`the-device-journal-is-read-after-the-frames-that-feed-it`, H65 -
      // registerPerformance before registerAudioDevice, where the import order
      // reads the other way round).
      const imports = [...index.matchAll(/import \{ register as (\w+) \} from '\.\/([a-z0-9]+\.js)';/g)]
        .map((match) => ({ name: match[1], file: match[2] }));
      const body = index.slice(index.indexOf('export function registerAutoTests'));
      const called = [...body.matchAll(/^\s*(\w+)\(debugTools\);/gm)].map((match) => match[1]);

      if (imports.length < MIN_TEST_MODULES) {
        return { pass: false, detail: `tests/index.js imports ${imports.length} registrars; the suite is ${MIN_TEST_MODULES}+` };
      }
      for (const entry of imports) {
        const times = called.filter((name) => name === entry.name).length;
        if (times === 0) problems.push(`${entry.file}: imported as ${entry.name} and never called - its checks are registered nowhere`);
        else if (times > 1) problems.push(`${entry.file}: ${entry.name} is called ${times} times`);
      }
      const importedNames = new Set(imports.map((entry) => entry.name));
      for (const name of new Set(called)) {
        if (!importedNames.has(name)) problems.push(`registerAutoTests calls ${name}, which is not imported`);
      }

      // 2. What those modules declare, read out of their text. Each
      // registration's id is a literal, or a file-local const this resolves;
      // anything else is named and red, because a census that skips what it
      // cannot read is the shape of hole being closed here.
      const declared = [];
      const shared = new Set(SHARED_FROM_A_CHECK.map((row) => `${row.file} ${row.name}`));
      const handedOut = new Set();
      for (const entry of imports) {
        const text = await (await fetch(`${origin}/src/tests/${entry.file}`)).text();
        // 2a. And the seam: machinery this module hands out that its own
        //     checks never touch (H70). As code, so a reader's own regex
        //     literal is not an export, and `\b` on the name so a longer
        //     word that starts with it is not a use.
        const code = codeOf(text);
        if (/registerAutoTest\(/.test(code)) {
          EXPORTED.lastIndex = 0;
          for (const match of code.matchAll(EXPORTED)) {
            const name = match[1] || match[2];
            if (name === 'register') continue;
            if ([...code.matchAll(new RegExp(`\\b${name}\\b`, 'g'))].length > 1) continue;
            handedOut.add(`${entry.file} ${name}`);
            if (!shared.has(`${entry.file} ${name}`)) {
              problems.push(`${entry.file} exports ${name} and none of its own checks use it, so it is machinery another module reaches for and this census does not declare it (H70's seam)`);
            }
          }
        }
        const constants = new Map();
        for (const match of text.matchAll(/^const (\w+) = '([^']+)';/gm)) constants.set(match[1], match[2]);
        for (const match of text.matchAll(/registerAutoTest\(\{\s*\r?\n\s*id: ('([^']+)'|\w+),/g)) {
          const line = text.slice(0, match.index).split(/\r?\n/).length;
          const id = match[2] !== undefined ? match[2] : constants.get(match[1]);
          if (id === undefined) problems.push(`${entry.file}:${line}: registers an id this census cannot read (${match[1]}); write it as a literal or a file-local const`);
          else declared.push({ file: entry.file, line, id });
        }
      }
      const bare = [...index.matchAll(/registerAutoTest\(\{/g)].length;
      if (bare) problems.push(`tests/index.js registers ${bare} checks of its own; the registrar registers nothing`);

      // 3. Declared and live must be the same set, bar the conditional ones.
      const live = new Set(h.debugTools._autoTests.map((test) => test.id));
      const conditional = new Set(CONDITIONAL.map((entry) => entry.id));
      const declaredIds = new Set();
      for (const entry of declared) {
        if (declaredIds.has(entry.id)) problems.push(`${entry.file}:${entry.line}: a second check is registered as "${entry.id}"`);
        declaredIds.add(entry.id);
        if (live.has(entry.id) || conditional.has(entry.id)) continue;
        problems.push(`${entry.file}:${entry.line} declares "${entry.id}" and the registry does not hold it`);
      }
      for (const id of live) {
        if (!declaredIds.has(id)) problems.push(`the registry holds "${id}", which no module under tests/ declares`);
      }
      for (const entry of CONDITIONAL) {
        // Only that it is still declared. Whether it is live is the URL's
        // business: under `?hang=1` it is, and that run is the point of it.
        if (!declaredIds.has(entry.id)) problems.push(`"${entry.id}" is listed as conditional (${entry.why}) and is declared nowhere; drop it from the list`);
      }
      // And the other direction, which is what keeps the census from
      // becoming a list of things that used to be true.
      for (const row of SHARED_FROM_A_CHECK) {
        if (!handedOut.has(`${row.file} ${row.name}`)) {
          problems.push(`${row.file} no longer hands out ${row.name} unused by its own checks; drop the row (${row.why})`);
        }
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${imports.length} registrars imported and each called once; ${declared.length} checks declared, ${live.size} registered, `
            + `the difference being ${CONDITIONAL.map((entry) => `${entry.id} (${entry.why})`).join('; ')}; `
            + `${handedOut.size} exports are machinery another module reaches for and all ${SHARED_FROM_A_CHECK.length} are declared `
            + `(${SHARED_FROM_A_CHECK.map((row) => `${row.file}'s ${row.name}`).join(', ')})`
          : problems.join('; '),
      };
    },
  });
}
