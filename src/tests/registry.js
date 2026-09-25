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

/**
 * Checks that are registered only when the URL asks for them, with why. Each
 * must still be declared in its module's text - an entry for something that
 * has gone is an entry the next missing check hides behind.
 */
const CONDITIONAL = [
  { id: 'a-staged-hang-never-returns', why: 'registered only under ?hang=1; it never returns by design (F10)' },
];

/**
 * A floor on the modules `tests/index.js` pulls in - 57 today. It does not
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
      // one-to-one meaningful. Order is NOT asserted: registerPerformance is
      // deliberately called last, after the imports it follows.
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
      for (const entry of imports) {
        const text = await (await fetch(`${origin}/src/tests/${entry.file}`)).text();
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

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${imports.length} registrars imported and each called once; ${declared.length} checks declared, ${live.size} registered, `
            + `the difference being ${CONDITIONAL.map((entry) => `${entry.id} (${entry.why})`).join('; ')}`
          : problems.join('; '),
      };
    },
  });
}
