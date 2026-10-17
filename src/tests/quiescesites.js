/**
 * BLACKLINE - tests/quiescesites.js
 *
 * AUTO suite (H74): who owns the Warden inside a `quiesce()` site.
 *
 * **The question H71 left and H73 sharpened.** `quiesce()` leaves a live match
 * (`tests/quiesce.js` holds that sentence against the flag), so every check
 * that quiesces has a hunting Warden in the scene while it measures. H73
 * measured why that has always been reproducible: the AI is awake on the first
 * frame, and a patrol's first act is to **turn** to face its first route node
 * at 0.0567 rad a frame, translating nothing until it is round - four frames of
 * headroom on the plant and seventeen on the yard. So the thing that decides
 * whether a Warden is in a picture is **how many frames the check steps between
 * the quiesce and the grab**, and until this file nothing read that number.
 *
 * **The measurement the entry asked for, and what it could not settle.** All
 * eleven sites that step the simulation before they read a frame were run
 * through the real runner on both maps, once with the match `quiesce()` leaves
 * and once with the AI taken out of it, and most of the detail lines moved by a
 * few pixels in a few thousand. **That comparison turned out not to be worth
 * much**, because the same eleven were then read across the two runs of each map
 * on one tree, and **ten of them answer differently run to run anyway** - at
 * HEAD as well, so it is nothing this job did. The band: a body of 19,228 or
 * 19,260 pixels on the plant and 18,654 or 18,974 on the yard, a silhouette of
 * 347 or 359 at 25m, a smoke cloud of 794,510 or 861,269. The mechanism is
 * known and written down elsewhere - the breath advances on the **wall clock of
 * the render frame** (H31, H33, H40, and `breathcensus.js`'s header), so the
 * phase a grab arrives in is not reproducible - and every delta the A/B
 * measured is inside that band or comparable to it. It is in the queue (H79),
 * because the suite cannot currently see it: `flaky` compares **verdicts**, and
 * a reading that drifts while passing is invisible to it.
 *
 * **One exception, and it is the one that matters.** The death camera's killer
 * covers 53,813 / 53,827 / 53,851 pixels with the AI live, in a run-to-run band
 * of about thirty, and 50,951 / 50,977 with it off - a shift of some 2,870
 * pixels, two orders of magnitude outside the band. That check **resets the
 * Warden to a spot 2.5m from the Shade because it wants it in frame** and then
 * steps fifteen frames, which H73 says was only ever valid for four of them on
 * the plant. There the live AI was demonstrably walking the subject out of the
 * shot it had been placed in. H78 is the clause it still wants.
 *
 * **So the rule does not rest on the pixel counts, and should not.** It is a
 * rule about what a check guarantees: one that steps the world after a quiesce
 * has a Warden in its frame at a position it never states, and the fix is for it
 * to say so - `initMatch` for a match of its own with no AI in it. Eleven lines,
 * and this clause so that the twelfth cannot be written without one.
 *
 * Nothing here renders a frame - it reads the tree. Registered from
 * tests/index.js; nothing imports main.js (Section 3.1).
 */

import { codeOf, readerProblems } from './sourcetext.js';
import { HELPER, HELPER_FILE } from './quiesce.js';

/**
 * A **site** is the span of code one `quiesce(h)` call is answerable for: from
 * the call to whichever comes first of the next one, the next
 * `registerAutoTest(`, and the end of the file.
 *
 * Spans and not check bodies, because two of the thirty-one sites are inside
 * exported helpers - `look.js` photographs through one and `grabslide.js`
 * drives one - and a reader that only looked inside a `registerAutoTest(`
 * would see neither. The `registerAutoTest(` boundary is what stops a span
 * bleeding into the next check and borrowing its answer: measured without it,
 * `sitetint.js`'s single site reads as owning the Warden on the strength of a
 * flag two checks below it.
 *
 * Built from `HELPER` rather than spelled out, which is not tidiness: a
 * pattern whose own source says `quiesce(h)` is one more site in this file,
 * because `codeOf` strips strings and comments and leaves a regex literal
 * exactly where it is. The lookbehind is the other exclusion - the helper's own
 * `export function quiesce(h)` is not a call to itself - and `SITE_IGNORES`
 * holds that line, so both are proved on every run.
 */
const SITE = new RegExp(`(?<!function )\\b${HELPER}\\(h\\)`, 'g');
const ONE_SITE = new RegExp(SITE.source);
const REGISTRAR = /\bregisterAutoTest\(/g;

/**
 * The three questions asked of a site, and the only three.
 *
 * The first is the fixed step and the frame, and deliberately not the
 * eased-pose driver: four of these sites advance the drawn Shade sixty times
 * without stepping the simulation once, which cannot move the Warden. The
 * second is the lens and the raw read, which between them are every way this
 * suite has of looking at a picture - and `lens.grab()` renders without
 * advancing anything, which is why a site that steps no frame is safe however
 * many times it grabs, and why a toggle difference taken across two grabs
 * cancels whatever is standing still in both of them.
 *
 * **That last sentence is a clause now and not an argument** (H76):
 * `a-lens-grab-advances-neither-the-clock-nor-the-picture` reads what `grab()`
 * is allowed to call off `pixels.js`'s own source and takes three in a row,
 * holding the clock, the Warden and the picture, each with its own control. It
 * is worth knowing which half catches what, because the obvious break fools
 * one of them: a `stepFrames` put inside `grab()` advances `clock.sim` and
 * turns the Warden - 0.170rad over three grabs, three frames at H73's rate -
 * and leaves all three **buffers byte-identical**, because what moves the drawn
 * body is `updateVisual` and stepping the simulation is not that.
 *
 * **H80 named the world those twelve pictures are of, and H81 pinned it.** The
 * grab advances nothing, so the world at it is the world `quiesce()` returned -
 * and that world used to be whichever circuit the clock drew: the Warden on its
 * spawn for twenty of the twenty-one, and 0.368m (plant) or 0.837m (yard) off
 * it for the twenty-first, about one run in twenty-four. H81 measured the same
 * population in the currency a photograph is actually in, the **pose**, and
 * found a third class the distance census could not see - a yard circuit on its
 * spawn to the micrometre and facing 2.27rad the other way, 22 seeds in 400. So
 * `quiesce()` names a seed, every one of these sites gets one circuit and one
 * pose, and `tests/settlecircuit.js` holds that seed in the class the most
 * circuits share. The twelve are safe in the sense this file means, and the
 * thing the helper leaves is now the same thing every run.
 *
 * **The names are a list and not a regex literal, and that is the point rather
 * than a style.** `codeOf` strips a string and leaves a regex literal where it
 * is, so a pattern spelled `/renderFrame\(/` puts the identifier in this
 * module's *code* - and `breathcensus.js` read it, correctly by its own rule,
 * as a module that renders a frame and wanted it declared in a table of
 * modules that draw a body. It draws nothing; it is a census of source. Writing
 * the names as data says exactly that, and is the same move `SITE` makes above
 * for the same reason. H52 paid seventy minutes of verify for this shape; this
 * cost two, because the four censuses were run as a subset before the verify.
 */
const WORLD_DRIVERS = ['stepFrames', 'renderFrame'];
const FRAMEBUFFER_READS = ['createLens', 'readPixels'];
const DRIVES_THE_WORLD = new RegExp(`\\bh\\.(?:${WORLD_DRIVERS.join('|')})\\(`);
const READS_THE_FRAMEBUFFER = new RegExp(`\\b(?:${FRAMEBUFFER_READS.join('|')})\\(`);
const OWNS_THE_WARDEN = /\bai:\s*false\b/;

/** What a line is, to the three readers above, or nothing. */
const SEEN_AS = (text) => {
  if (ONE_SITE.test(text)) return 'a site';
  if (DRIVES_THE_WORLD.test(text)) return 'a driver';
  if (READS_THE_FRAMEBUFFER.test(text)) return 'a read';
  if (OWNS_THE_WARDEN.test(text)) return 'the flag';
  return '';
};

const SITE_SEES = [
  ['      const restore = quiesce(h);', 'a site'],
  ['      h.stepFrames(5);', 'a driver'],
  ['      h.renderFrame(1 / 60);', 'a driver'],
  ['      const lens = createLens(h, { pixelRatio: READ_AT() });', 'a read'],
  ['        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);', 'a read'],
  ["      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: true });", 'the flag'],
];
const SITE_IGNORES = [
  // The definition is not a call to itself, which is the whole of the lookbehind.
  'export function quiesce(h) {',
  // Prose naming all three, which is what the headers of both files are made of.
  ' * is awake on the first frame, and a site that steps a frame after a',
  ' * quiesce(h) and then calls createLens() owns the Warden it finds there.',
  // A pose eased sixty times moves the drawn Shade and cannot move the Warden.
  '      for (let i = 0; i < 60; i++) h.shade.easeOneFrame(1 / 60);',
  // And the flag the other way round is not this flag.
  "      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });",
];

/**
 * How many modules the registrar must import before this census believes it is
 * reading the tree, on `registry.js`'s model: it cannot catch one module going
 * missing, and it does catch the import list having collapsed to a handful and
 * reading as a clean sweep of nothing.
 */
const MIN_TEST_MODULES = 50;

/**
 * Every site in one module, with the three answers and the line it opens on.
 * `codeOf` and not the raw text (H41, H62): a sentence about `createLens` is
 * not a call to it, and five of the lines above are prose from a header.
 */
function sitesIn(file, source) {
  const code = codeOf(source);
  SITE.lastIndex = 0;
  const starts = [...code.matchAll(SITE)].map((m) => m.index);
  REGISTRAR.lastIndex = 0;
  const registrars = [...code.matchAll(REGISTRAR)].map((m) => m.index);
  return starts.map((start, i) => {
    const ends = [code.length];
    if (i + 1 < starts.length) ends.push(starts[i + 1]);
    for (const at of registrars) if (at > start) ends.push(at);
    const span = code.slice(start, Math.min(...ends));
    return {
      where: `${file}:${code.slice(0, start).split('\n').length}`,
      reads: READS_THE_FRAMEBUFFER.test(span),
      drives: DRIVES_THE_WORLD.test(span),
      owns: OWNS_THE_WARDEN.test(span),
    };
  });
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-check-that-drives-the-world-after-a-quiesce-owns-the-warden',
    spec: 'Section 17.1 / H74',
    name: 'Every quiesce site that steps the simulation before it reads the framebuffer asks initMatch for a match of its own with the AI off, and the sites that read a frame without stepping one are counted as the other class',
    run: async () => {
      const problems = [];
      const origin = location.origin;

      // ------------------------------------------------------------------
      // 1. The three readers, before anything they report is believed, on
      //    `sourcetext.js`'s instrument (F8's model). Two of the lines they
      //    must make nothing of are prose from a header, and one is the
      //    definition the lookbehind exists to exclude.
      // ------------------------------------------------------------------
      problems.push(...readerProblems(SEEN_AS, SITE_SEES, SITE_IGNORES, codeOf));

      // ------------------------------------------------------------------
      // 2. The census: every module the registrar imports, read the way the
      //    three source censuses read it, plus the file the helper lives in -
      //    which registers nothing, and is where the lookbehind meets the
      //    real tree rather than only a test vector.
      // ------------------------------------------------------------------
      const index = await (await fetch(`${origin}/src/tests/index.js`)).text();
      const files = [...index.matchAll(/import \{ register as \w+ \} from '\.\/([a-z0-9]+\.js)';/g)].map((m) => m[1]);
      if (files.length < MIN_TEST_MODULES) {
        return { pass: false, detail: `tests/index.js imports ${files.length} modules and the suite is ${MIN_TEST_MODULES}+, so this census is not reading the tree` };
      }
      const helper = HELPER_FILE.slice('src/tests/'.length);
      const scanned = [...new Set([...files, helper])];
      const sites = [];
      for (const file of scanned) {
        sites.push(...sitesIn(file, await (await fetch(`${origin}/src/tests/${file}`)).text()));
      }

      const owned = sites.filter((s) => s.reads && s.drives && s.owns);
      const live = sites.filter((s) => s.reads && s.drives && !s.owns);
      const oneFrame = sites.filter((s) => s.reads && !s.drives);
      const blind = sites.filter((s) => !s.reads);

      // ------------------------------------------------------------------
      // 3. The clause. A site that steps the simulation and then reads a
      //    picture has a Warden in that picture which has walked a distance
      //    the check never states. All of them in one problem, because the
      //    runner keeps 400 characters of a detail line and eleven separate
      //    complaints would be cut to two (H29).
      // ------------------------------------------------------------------
      if (live.length) {
        problems.push(`${live.length} quiesce site(s) step the simulation and then read the framebuffer with no match of their own, so the Warden in that frame has walked a distance the check does not state (H73: the body first moves on frame 4 of the plant, 17 of the yard): ${live.map((s) => s.where).join(', ')}`);
      }

      // ------------------------------------------------------------------
      // 4. And the other half, which a census of a set always owes (H4,
      //    H11): a reader that has stopped matching reports an empty list
      //    and so does a clean tree, and the two look identical from here.
      //    Every class is populated on this tree, so a reader that went
      //    blind names itself instead of passing.
      // ------------------------------------------------------------------
      if (!owned.length) {
        problems.push('no site both steps the simulation and asks for a match with the AI off, so either every stepping site has lost its flag or the flag reader has stopped matching');
      }
      if (!oneFrame.length) {
        problems.push('no site reads the framebuffer without stepping the simulation, and a dozen do, so the driver reader is matching lines that drive nothing');
      }
      if (!blind.length) {
        problems.push('no site is without a framebuffer read, and several are, so the read reader is matching lines that read nothing');
      }
      const itself = sites.filter((s) => s.where.startsWith(helper));
      if (itself.length) {
        problems.push(`${HELPER_FILE} contributes ${itself.length} site(s) (${itself.map((s) => s.where).join(', ')}) and should contribute none - the only ${HELPER}( in it is the definition, so the lookbehind that excludes it has stopped working`);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${sites.length} quiesce sites over ${scanned.length} modules: ${owned.length} step the simulation and read a frame, and every one asks initMatch for a match with the AI off; `
            + `${oneFrame.length} read a frame without stepping one, where the Warden is still where ${HELPER}() left it (H73); ${blind.length} read no frame; `
            + `the definition in ${HELPER_FILE} is not a site`
          : problems.join('; '),
      };
    },
  });
}
