/**
 * BLACKLINE - tests/readernames.js
 *
 * The one thing a reader cannot say about itself, said by the name (H68).
 *
 * `tests/sourcetext.js` owns two readers and its header says why there are
 * two: `codeOf` takes comments **and** quoted strings out, for a census asking
 * whether a module makes a call, and `uncommented` takes only the comments,
 * for a clause whose evidence *is* a string - a URL parameter, a check's own
 * `id`, the wording of a reported problem. Neither can tell you which it is,
 * so that header draws the only conclusion available: **the names are the
 * documentation.** A grep written against the strong reader is a grep about
 * code; one written against the weak reader is a grep that wanted the strings
 * and said so.
 *
 * A local name undoes that in one line. `benchlist.js` bound the weak reader
 * to `code` with four correct lines above it explaining that this census wants
 * the strings kept, and then called it at three sites where those four lines
 * are nowhere to be seen and the strong reader is what a reader would believe.
 * **H58 is how it survived**: that line had been the fifth copy of the
 * stripper, and collapsing the copies into the shared module turned a function
 * into an alias and carried its old name across, so the one job that would
 * have caught the name was the job that hid it.
 *
 * And H68 found the alias was the smaller half. H62 had read every *call site
 * of the two shared readers* in `src/tests/` and found the alias the only name
 * out of step - a grep that could not see a module with its **own copy** of a
 * reader, and there were three: `runnerguard.js` and `detaildrift.js` each
 * declared `function code(body)` and `grabslide.js` wrote the replace inline
 * into `const code`, all three of them the weak reader under the strong one's
 * name. Three copies, two jobs after the collapse that was meant to end them.
 * So this check holds both halves, on H61's model - off the tree, where a
 * fourth copy cannot be written silently:
 *
 *   1. **Only `sourcetext.js` spells either reader.** A module that wants one
 *      imports it. A copy is a second answer to a question this suite has
 *      decided twice already (H53, H58), and a copy is what carries a wrong
 *      name past every grep written against the right ones.
 *   2. **No name claims the reader it did not get.** A name claims one when it
 *      carries its vocabulary - the word `code` for the strong reader, `said`,
 *      `says`, `prose` or `wording` for the weak one - and a name claiming
 *      neither (`carries`, `solver`, `body`, `asked`) is nobody's business
 *      here. This is about a name that makes a promise, not about naming.
 *
 * What it cannot see: whether a clause asked the right reader in the first
 * place. That is H62's question, answered one clause at a time by reading what
 * the clause's evidence is, and no grep can do it. This one holds only that
 * the reader a use site names is the reader it got.
 *
 * **Its patterns are data and not regex literals**, which is the trap
 * `quiescesites.js`'s header names: the strong reader strips a string and
 * leaves a literal where it found it, so a literal spelling a reader's own
 * line would survive this file's read of this file and enrol it for talking
 * about its subject. Assembled with `new RegExp` and compared as quoted text,
 * nothing here is visible to itself - which is also why the two names in
 * `READS` are keys rather than strings.
 *
 * Registered from tests/index.js beside tests/benchlist.js, the census H68
 * came out of. Nothing here imports main.js (Section 3.1).
 */

import { codeOf, readerProblems, uncommented } from './sourcetext.js';

/** The file that owns both readers, and the only one that may spell either. */
const OWNER = 'sourcetext.js';

/** The two readers, and which of the two questions each one answers. */
const READS = { codeOf: 'code', codeOnly: 'code', uncommented: 'the wording' };

/**
 * What a name claims, as data: the word is in the name, case folded. `code`
 * catches `code`, `benchCode` and `asCode`; the second list is this suite's
 * own vocabulary for a weak read - `args.js`, `positioncensus.js`,
 * `solverquery.js` and `timedrenders.js` all call it `said`.
 */
const CLAIMS = {
  code: ['code'],
  'the wording': ['said', 'says', 'prose', 'wording', 'uncommented'],
};

/** The reader names as an alternation, so no literal here spells one. */
const READERS = Object.keys(READS).join('|');

/** `const x = reader` and `const x = reader(...)`, which are one shape. */
const BOUND = new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(${READERS})\\b`, 'g');

/** `{ x: reader(...) }`, the shape a census holding clauses on both uses. */
const KEYED = new RegExp(`([A-Za-z_$][\\w$]*)\\s*:\\s*(${READERS})\\s*\\(`, 'g');

/**
 * Each reader's own line, in **fragments**, and read with the weak reader
 * rather than the strong one. Both halves of that are forced:
 *
 * The strong reader cannot read the strong reader's own line. Its first span
 * is a pattern over single-quoted text, so it contains a quoted span and
 * strips itself to something else - which is why clause 3 asks `uncommented`,
 * where a regex literal survives whole. That leaves the strings in every
 * module standing, so these spellings are assembled from pieces at load and
 * appear nowhere in this file entire: a check that quotes its subject and then
 * greps for the quotation is a check that reports itself.
 *
 * The copies H68 found were all of the weak reader, which is the one that fits
 * in a `const`; the strong one is three spans and its first is enough to name.
 */
const SPELLINGS = [
  ['the weak reader', ['/^[\\t ]*(', '\\/\\/|\\/\\*|\\*', ').*$/gm'].join('')],
  ['the strong reader', ["/'(?:[^'", '\\\\]|\\\\.)*', "'/g"].join('')],
];

/**
 * The fewest claimed bindings on a healthy tree. This census answers "nothing
 * wrong" both when its patterns work and when they have stopped seeing
 * anything: the cases below prove the patterns on six lines, and this proves
 * they are still finding the real thing. H68 measured **twenty-one** claimed
 * bindings of thirty in fifteen modules, so half is a floor a tidy-up cannot
 * trip over and a pattern gone blind cannot clear - H67's rule about how far
 * from firing a tripwire has to sit on a healthy tree.
 */
const CLAIMED_FLOOR = 10;

/** And the set they are read out of, which is the whole suite or nothing. */
const MODULE_FLOOR = 60;

/**
 * The criterion's own cases, run before the census is believed (H53). Two
 * lines that are the defect - H68's own line, and the same mistake the other
 * way round - and four that are not: a right pairing, a name that claims
 * nothing, a line of this suite's prose quoting the defect (written with the
 * leading star, which is the form `codeOnly` drops line-locally; a prose line
 * without one reads as code, which is H43's bite), and `positionreads.js`'s
 * re-export, which names both readers and binds no local name at all.
 */
const SEES = [
  ['      const code = uncommented;', 'a name against its reader'],
  ['        sources.set(file, { said: codeOf(read.body) });', 'a name against its reader'],
];
const IGNORES = [
  '      const code = codeOf(read.body);',
  '      const carries = uncommented(source.body);',
  ' * four correct lines above `const code = uncommented;` saying it is the weak reader',
  "export { codeOf, uncommented } from './sourcetext.js';",
];

/** Read a file from the origin the way benchlist.js and requestbuffer.js do. */
async function text(origin, rel) {
  const response = await fetch(`${origin}${rel}`);
  if (!response.ok) return { error: `${rel}: ${response.status}` };
  return { body: await response.text() };
}

/**
 * Which modules under `src/tests/` the page loaded, from the Resource Timing
 * buffer - the read `requestbuffer.js` declares for this check (H67).
 */
function loadedModules(origin) {
  const modules = new Set();
  for (const entry of performance.getEntriesByType('resource')) {
    const url = entry.name.split('?')[0];
    if (!url.startsWith(origin) || !url.endsWith('.js') || url.indexOf('/src/tests/') === -1) continue;
    modules.add(url.slice(url.indexOf('/src/') + 1));
  }
  return [...modules];
}

/**
 * Every place a module binds one of the shared readers to a local name, line
 * by line and never by parsing - `donedef.js`'s rule, and the reason this is
 * safe to point at a suite still being written in.
 */
function bindings(code) {
  const found = [];
  code.split('\n').forEach((line, index) => {
    for (const pattern of [BOUND, KEYED]) {
      pattern.lastIndex = 0;
      let hit = pattern.exec(line);
      while (hit) {
        found.push({ at: index + 1, name: hit[1], reader: hit[2] });
        hit = pattern.exec(line);
      }
    }
  });
  return found;
}

/** Which of the two readers a name claims to be, as a list, usually empty. */
function claims(name) {
  const lower = name.toLowerCase();
  return Object.entries(CLAIMS)
    .filter(([, words]) => words.some((word) => lower.includes(word)))
    .map(([reads]) => reads);
}

/** What is wrong with one module's bindings, as sentences, usually none. */
function nameProblems(where, code) {
  const problems = [];
  for (const bound of bindings(code)) {
    const claimed = claims(bound.name);
    if (claimed.length === 0) continue;
    if (claimed.length > 1) {
      problems.push(`${where}:${bound.at} binds a reader to \`${bound.name}\`, a name carrying the vocabulary of ${claimed.join(' and ')} at once, so a use site is told two things and may believe either`);
    } else if (claimed[0] !== READS[bound.reader]) {
      problems.push(`${where}:${bound.at} binds the reader that reads ${READS[bound.reader]} to \`${bound.name}\`, a name that says ${claimed[0]}; at the use site a reader is whatever its name says it is, which is the one thing tests/sourcetext.js says a reader cannot tell you about itself (H68)`);
    }
  }
  return problems;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'only-sourcetext-owns-the-two-source-readers-and-no-name-claims-the-wrong-one',
    spec: 'Section 17.1 / H68',
    name: 'Both source readers are spelled only in tests/sourcetext.js, and no module under src/tests/ binds one of them to a name claiming the other, so a use site reading `code` got the reader that reads code',
    run: async () => {
      const problems = [];
      const origin = location.origin;
      if (typeof performance === 'undefined' || !performance.getEntriesByType) {
        return { pass: false, detail: 'no Resource Timing API, so there is no list of the modules that ran to read' };
      }

      // ------------------------------------------------------------------
      // 1. The criterion before the census. Both directions of the defect
      //    must read as the defect, and four lines that are not it must read
      //    as nothing - the last of them a re-export, which names both
      //    readers on one line and binds neither.
      // ------------------------------------------------------------------
      problems.push(...readerProblems(
        (code) => (nameProblems('a case', code).length ? 'a name against its reader' : ''),
        SEES,
        IGNORES,
      ));

      // ------------------------------------------------------------------
      // 2. The census: every module under src/tests/ that ran, read as code.
      //    As code and not raw, because what a module binds is code and a
      //    line of prose quoting a binding is prose about it (H53). A
      //    spelling is asked of the weak read instead,
      //    because the strong reader mangles its own line - and the owner is
      //    asked for both, since a needle gone stale would make clause 3
      //    vacuous and that is the only control quoted text can have.
      // ------------------------------------------------------------------
      const modules = loadedModules(origin);
      if (modules.length < MODULE_FLOOR) {
        return { pass: false, detail: `the buffer names ${modules.length} modules under src/tests/ and this page loads ${MODULE_FLOOR}+, so the census below would be a census of nothing` };
      }
      let bound = 0;
      let claimed = 0;
      const claiming = new Set();
      const owned = new Set();
      for (const path of modules) {
        const read = await text(origin, `/${path}`);
        if (read.error) { problems.push(read.error); continue; }
        const file = path.slice(path.lastIndexOf('/') + 1);
        const code = codeOf(read.body);
        const said = uncommented(read.body);
        for (const binding of bindings(code)) {
          bound += 1;
          if (claims(binding.name).length > 0) {
            claimed += 1;
            claiming.add(file);
          }
        }
        problems.push(...nameProblems(file, code));
        for (const [whose, spelling] of SPELLINGS) {
          if (!said.includes(spelling)) continue;
          if (file === OWNER) owned.add(whose);
          else problems.push(`${file} spells ${whose} itself rather than importing it from tests/${OWNER}; a copy is a second answer to a question H53 and H58 decided, and a copy is what carried a wrong name past H62's grep (H68)`);
        }
      }

      // ------------------------------------------------------------------
      // 3. And that both clauses still see the tree they are pointed at.
      // ------------------------------------------------------------------
      for (const [whose] of SPELLINGS) {
        if (!owned.has(whose)) {
          problems.push(`tests/${OWNER} does not spell ${whose} the way this check quotes it, so the clause above would pass a tree with a copy of it in every module`);
        }
      }
      if (claimed < CLAIMED_FLOOR) {
        problems.push(`${claimed} bindings under a name that claims a reader, below the ${CLAIMED_FLOOR} this holds; H68 read 21 of 30 in 15 modules, so the patterns here have stopped seeing what they are for`);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${bound} reader bindings in ${modules.length} modules under src/tests/, ${claimed} under a name claiming one of the two readers (floor ${CLAIMED_FLOOR}) and every one agreeing, across ${claiming.size} modules; `
            + `both readers spelled in tests/${OWNER} and nowhere else; both directions of the defect instrumented and four lines that are not it`
          : problems.join('; '),
      };
    },
  });
}
