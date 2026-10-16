/**
 * BLACKLINE - tests/posecriterion.js
 *
 * The breath census's criterion for membership, and the instruments that hold
 * it (H61). `breathcensus.js` keeps the census; this keeps the question of who
 * is in it.
 *
 * **Why the criterion is worth its own module.** A census is worth exactly what
 * its membership rule is worth, and this one's rule has been wrong twice. H53
 * found it wrong in **both directions at once**: it read the raw file, so a
 * module was in the census the moment a comment *mentioned* `updateVisual`
 * (`sourcetext.js`'s header has what that cost), and the moment the read was
 * stripped, **three real members fell out** - `poseeye.js`, `strikerepeat.js`
 * and `positioncensus.js`, each of which poses all twelve strike states and
 * calls `updateVisual` nowhere in its own code. H53's fix was to grep for
 * `animation.js`'s `strike` as well, which is honest about today and silent
 * about tomorrow: **a name in a regex**. A second helper that drove a frame on
 * a caller's behalf would put its callers back where H47 was - in a census by
 * accident or out of one by accident - and nothing would say so.
 *
 * **So the proxy set is read off the tree.** Every module under `src/tests/`
 * that **exports** a function whose own code reaches `updateVisual` is a proxy,
 * and the criterion is that call or any of them. The module list comes from
 * Resource Timing, which is `donedef.js`'s rule - the modules that actually
 * ran, never a guess at the import graph - and it is the half that makes this
 * cover **helpers**: `animation.js` is in the registrar's import list, but a
 * helper that is only imported by other tests would not be, and a proxy is
 * exactly the kind of module that need not register a check of its own.
 *
 * **And the reading is the finding: there are three of them, not one.** The
 * queue entry that asked for this said `animation.js` was the only proxy
 * today. It is not:
 *
 *   `strikedrive.js`    `frame` (makes the call) and `strike` (through `frame`)
 *   `look.js`           `photograph` and `photographPose`
 *   `positionreads.js`  `draw`
 *
 * The first was `animation.js` until H75 split E3's checks from the driver;
 * the set followed the code without this module changing, which is the whole
 * point of reading it off the tree.
 *
 * Five names in three modules, where the record said one in one - which is
 * H55's lesson again, that a number nobody has measured is a number nobody
 * should quote. **The census's answer does not move**: every caller of all five
 * already calls `updateVisual` or `strike` in its own code, so membership is
 * identical the day this lands and the criterion is now a set the tree decides
 * rather than a list somebody maintains. That is the whole of what changed, and
 * it is the right kind of change - it buys nothing today and it cannot be wrong
 * tomorrow.
 *
 * The entry's own example of a second proxy was `figure.js`'s `standAndEyes`,
 * and **it is not one**: every `updateVisual` in that module is inside its
 * `register`, so nothing it exports poses a body. A correct negative, and worth
 * saying, because it is the case a hand-written list gets wrong in the other
 * direction.
 *
 * **`register` is exempt by name, with a reason.** Every module in this suite
 * exports one, and a `register` whose checks drive frames reaches `updateVisual`
 * like any other function - so without the exemption every module with a
 * frame-driving check would be a proxy and the criterion would match the word
 * `register(` everywhere. It is the entry point the registrar calls, not a
 * helper a caller invokes to pose a body, and that is the distinction the set
 * is about.
 *
 * Layering (Section 3.1): reads source text and nothing else. It imports
 * `sourcetext.js` for the two readers H53 put in one place and imports no
 * system, no entity and no map.
 */

import { codeOf, readerProblems } from './sourcetext.js';

/**
 * The module whose exports the criterion has rested on since H53, and which
 * has held them since H75 - it was `animation.js` until the driver moved out
 * of E3's checks. `breathcensus.js` requires it to still contribute a proxy,
 * because a discovery that has stopped seeing `frame` and `strike` drops three
 * real members of that census without a word.
 *
 * **This is the one hand-written thing left in the criterion**, so a job that
 * moves those two functions again changes this line in the same diff. H75 is
 * the worked example: it moved them, two clauses in `strikerepeat.js` went red
 * on both maps naming the moved mechanism, and this line was the third.
 */
export const PROXY_HOME = 'strikedrive.js';

/** The call itself: a module whose code drives the pose. */
export const POSES_A_BODY = /updateVisual\(/;

/** And the second group's: a module that renders a frame and reads what is in it. */
export const RENDERS_A_FRAME = /renderFrame/;

/**
 * Exported names that are never proxies however far they reach. One entry, and
 * the module header argues it: `register` is what the registrar calls, and
 * every module here has one.
 */
const PROXY_EXEMPT = ['register'];

/**
 * A top-level declaration, anchored at column 0 - which is `donedef.js`'s rule
 * carried into this file: **decide line-locally and never by parsing.** A
 * nested function is indented and so is not one of these, which is what makes
 * a declaration's reach the text between it and the next one without any brace
 * counting. `function f`, `export function f`, `async`, a generator, and the
 * `const f = (h) => ...` form this suite writes its small helpers in.
 */
const DECLARATION = /^(export\s+)?(?:async\s+)?(?:function\s*\*?\s*(\w+)|(?:const|let)\s+(\w+)\s*=)/;

/** A call of a free function `name`, which is never a method and never a longer word. */
const calls = (code, name) => new RegExp(`(?<![.\\w])${name}\\s*\\(`).test(code);

/**
 * Every top-level declaration in a module's code, with the text it reaches
 * over: from its own line to the line the next one starts on.
 *
 * @param {string} code source with comments and strings out (`codeOf`)
 * @returns {{name: string, exported: boolean, body: string}[]}
 */
function declarations(code) {
  const lines = code.split('\n');
  const starts = [];
  lines.forEach((line, i) => {
    const m = DECLARATION.exec(line);
    if (m) starts.push({ at: i, exported: !!m[1], name: m[2] || m[3] });
  });
  return starts.map((start, k) => ({
    name: start.name,
    exported: start.exported,
    body: lines.slice(start.at, k + 1 < starts.length ? starts[k + 1].at : lines.length).join('\n'),
  }));
}

/**
 * The names a module **exports** that pose a body, directly or through another
 * declaration of its own. `strike` is the case that makes the second half
 * necessary: it calls `frame`, and `frame` is the one that calls
 * `updateVisual`, so a reader that only looked for the call would miss the name
 * every caller actually writes.
 *
 * Pure, so `PROXY_CASES` can put it to sources rather than to whatever the tree
 * happens to hold this morning - which is the only way a clause about a second
 * proxy that does not exist yet can be known to answer.
 *
 * @param {string} code source with comments and strings out (`codeOf`)
 * @returns {string[]} exported proxy names, sorted
 */
export function exportsReaching(code) {
  const decls = declarations(code);
  const reach = new Set(decls.filter((d) => POSES_A_BODY.test(d.body)).map((d) => d.name));
  // Transitive, and inside the module only: a proxy is something a caller can
  // import and call, so a chain that leaves the file is a chain through another
  // module's exports, and that module is in this set on its own account.
  for (let changed = true; changed;) {
    changed = false;
    for (const d of decls) {
      if (reach.has(d.name)) continue;
      for (const name of [...reach]) {
        if (calls(d.body, name)) { reach.add(d.name); changed = true; break; }
      }
    }
  }
  return decls
    .filter((d) => d.exported && reach.has(d.name) && !PROXY_EXEMPT.includes(d.name))
    .map((d) => d.name)
    .sort();
}

/**
 * The discovery's own cases: module sources it must read a proxy set off, and
 * the ones it must read nothing off. These are the clause about **tomorrow** -
 * a second module exporting a frame driver is in the set the day it lands, and
 * no second module has landed yet, so a table is the only instrument that can
 * say so (`timedrenders.js`'s `timedVerdictAsked()` and
 * `tests/audiodevice.js`'s `CLOCK_CASES` are the same shape for the same
 * reason).
 */
const PROXY_CASES = [
  {
    why: "a helper that makes the call itself, which is `strikedrive.js`'s `frame`",
    source: 'export function frame(h) {\n  h.shade.updateVisual(1 / 60);\n}\n',
    proxies: ['frame'],
  },
  {
    why: "a helper that reaches it through another in the same module, which is `strikedrive.js`'s `strike` and the whole reason a name in a regex was not enough",
    source: 'function inner(h) {\n  h.shade.updateVisual(1 / 60);\n}\nexport function strike(h, name) {\n  inner(h);\n}\n',
    proxies: ['strike'],
  },
  {
    why: 'two of them in one module, because a module contributes a set and not a name',
    source: 'export function frame(h) {\n  h.shade.updateVisual(1 / 60);\n}\nexport function strike(h, name) {\n  frame(h);\n}\n',
    proxies: ['frame', 'strike'],
  },
  {
    why: 'the registrar, which every module here exports and whose checks drive frames: it is exempt by name, or the criterion would match `register(` everywhere',
    source: 'export function register(debugTools) {\n  debugTools.registerAutoTest({ run: (h) => h.shade.updateVisual(1 / 60) });\n}\n',
    proxies: [],
  },
  {
    why: 'a module-private helper: it poses a body and nobody outside the module can ask it to, so it makes no caller a member of anything',
    source: 'function pose(h) {\n  h.shade.updateVisual(1 / 60);\n}\n',
    proxies: [],
  },
  {
    why: "a module that only names the call in its prose, which is H53's subject one layer up - the discovery reads code and not comments",
    source: "/** Drives updateVisual on the caller's behalf. */\nexport function frame(h) {\n  h.renderFrame(1 / 60);\n}\n",
    proxies: [],
  },
  {
    why: 'the small-helper form this suite writes, which a reader looking only for the word `function` would miss',
    source: 'export const pose = (h) => {\n  h.shade.updateVisual(1 / 60);\n};\n',
    proxies: ['pose'],
  },
];

/** `PROXY_CASES`, answered. */
function proxyProblems() {
  const problems = [];
  for (const probe of PROXY_CASES) {
    const got = exportsReaching(codeOf(probe.source));
    if (got.join(',') !== probe.proxies.join(',')) {
      problems.push(`the proxy discovery read [${got.join(', ') || 'nothing'}] off a module whose proxies are [${probe.proxies.join(', ') || 'nothing'}]: ${probe.why}`);
    }
  }
  return problems;
}

/**
 * Every module under `src/tests/` the page actually loaded, from the same
 * Resource Timing list `donedef.js` reads. Helpers included, which is the point:
 * a proxy need register no check of its own.
 *
 * @returns {string[]|null} file names, or null where there is no Resource Timing
 */
function testModules() {
  if (typeof performance === 'undefined' || !performance.getEntriesByType) return null;
  const here = '/src/tests/';
  const modules = new Set();
  for (const entry of performance.getEntriesByType('resource')) {
    const url = entry.name.split('?')[0];
    if (!url.endsWith('.js')) continue;
    const at = url.indexOf(here);
    if (at === -1) continue;
    const rest = url.slice(at + here.length);
    if (rest.indexOf('/') === -1) modules.add(rest);
  }
  return [...modules].sort();
}

/** Below this many modules the enumeration has stopped working, not the tree shrunk. */
const MIN_MODULES = 50;

/**
 * The proxy set the tree decides, read once per run.
 *
 * @param {string} origin
 * @returns {Promise<{names: string[], entries: {module: string, name: string}[], scanned: number, problems: string[]}>}
 */
export async function poseProxies(origin) {
  const problems = [];
  const files = testModules();
  if (!files) {
    return { names: [], entries: [], scanned: 0, problems: ['no Resource Timing API, so the proxy set cannot be read off the tree and the criterion has no second half'] };
  }
  if (files.length < MIN_MODULES) {
    problems.push(`Resource Timing lists ${files.length} modules under src/tests/ and the suite is ${MIN_MODULES}+, so the proxy set was read off a list that is not the tree`);
  }
  const entries = [];
  for (const file of files) {
    const code = codeOf(await (await fetch(`${origin}/src/tests/${file}`)).text());
    for (const name of exportsReaching(code)) entries.push({ module: file, name });
  }
  if (!entries.length) {
    problems.push('no module under src/tests/ exports a function that poses a body, so the discovery has stopped seeing strikedrive.js\'s frame and the criterion is one grep again');
  }
  problems.push(...proxyProblems());
  return { names: entries.map((e) => e.name), entries, scanned: files.length, problems };
}

/**
 * The criterion itself. `proxies` is `poseProxies()`'s names, so a module is a
 * member if its code makes the call or calls anything that makes it on its
 * behalf.
 */
export const posesABody = (code, proxies) => POSES_A_BODY.test(code) || proxies.some((name) => calls(code, name));

/** What the two criteria make of a module's code: one word, or nothing. */
export const classify = (proxies) => (code) => (
  posesABody(code, proxies) ? 'poses' : RENDERS_A_FRAME.test(code) ? 'renders' : ''
);

/**
 * Lines of real code each criterion must classify, and lines it must make
 * **nothing** of - prose that names the call, and code that names something
 * which is not it - H53's instrument, kept beside the criterion it is about,
 * with H61's second kind under it. The three
 * modules the stripped read dropped are how close a reader that strips too much
 * is; the `${...}` case is the hole H53 named, because a call inside a template
 * literal is still a call; and the `frame(h)` pair is H61's, because the proxy
 * set reaching a second name is the change and a criterion that could not read
 * it would be the same silence in a new place.
 */
const READER_SEES = [
  ['        shade.updateVisual(1 / 60);', 'poses'],
  ["      const struck = strike(h, 'walk');", 'poses'],
  ['      for (let i = 0; i < 5; i++) frame(h);', 'poses'],
  ['        h.renderFrame(1 / 60);', 'renders'],
  ['        problems.push(`a frame moved ${shade.updateVisual(1 / 60)}m`);', 'poses'],
];
const READER_IGNORES = [
  // Not prose - **code**, and the one case the control found nothing holding.
  // A proxy is a free function a caller imports, so a method of the same name
  // is a different thing and a longer word is another word. Dropping the
  // lookbehind in `calls` left this census green with both, which is how this
  // line came to exist: the break was meant to be a control and was a finding.
  '        lens.draw(mesh, eye, focus);',
  '        const n = drawCalls(h, lens, mesh);',
  ' * `updateVisual` runs on the wall clock from the render frame, never from',
  '      // this check never calls strike(h, name), so nothing here is posed',
  ' * Drive the pose with frame(h) from animation.js rather than by hand.',
  ' * Drive frames with `h.renderFrame(1 / 60)`, never by waiting for rAF.',
];

/**
 * The criterion's own instrument, run before the census is believed: the two
 * readers put to real lines, and the proxy discovery put to `PROXY_CASES`.
 *
 * @param {string[]} proxies `poseProxies()`'s names
 */
export function criterionProblems(proxies) {
  return readerProblems(classify(proxies), READER_SEES, READER_IGNORES);
}
