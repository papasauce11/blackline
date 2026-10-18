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
 * Warden to a spot 2.5m from the Shade because it wants it in frame**, and
 * there the live AI was demonstrably walking the subject out of the shot it had
 * been placed in. H78 is the clause it wanted and now carries: the mark is
 * named once, each of the three grabs records the horizontal offset from it,
 * and the worst is held to 1e-6m.
 *
 * **And H78 corrected the margin this header used to argue that case with**
 * (H82). The sentence here said the check "steps fifteen frames, which H73 says
 * was only ever valid for four of them on the plant", which reads as though the
 * plant had four frames in hand and the yard seventeen. **Neither number is
 * about this check.** H73's four and seventeen are about a Warden standing on
 * its **spawn** when a match begins - a patrol with a route node to turn to and
 * nothing yet to walk to, turning at 0.0567 rad a frame and translating nothing
 * until it is round. A body **teleported** onto a mark finished turning
 * somewhere else and translates on frame **one**: H78 measured
 * **0.09263658m after five steps and 0.13542695m at the grab**, the same to ten
 * significant figures on both maps, because the travel is the walk ramp times
 * the frame count and has nothing of the place in it - only the yaw differs,
 * +-0.340000 rad, six frames at H73's rate to the digit. So the header
 * understated its own case, and did it in the one direction that matters.
 * **Nor is fifteen the count that has to survive**: ten of those frames are
 * driven before the Warden is moved at all, and what the mark must hold through
 * is the five `stepFrames` after it plus the one fixed step inside the warm
 * `renderFrame` - six, which is the column H78's table reads 0.13542695m in.
 *
 * **Which splits the stepping class in two, and the split is a clause below.**
 * A site that teleports the Warden has no headroom whatever, and nothing but
 * its own `ai: false` between the mark and the picture; a site that leaves the
 * Warden where its own match opened has H73's four frames (plant) or seventeen
 * (yard) as well, because that body is on a spawn. Both counts are in the
 * detail line and `TELEPORTS` declares which modules do it, so the next
 * stepping site cannot quietly inherit a margin that is not about it - the
 * same declaration `registry.js` asks for (H70) and the shape H83 will take
 * to every `reset(` in the suite.
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
import { addsUp } from './censustally.js';
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

/**
 * The fourth reader, and the one H82 is for: does this site put the Warden
 * somewhere of its own choosing before it reads a frame?
 *
 * **It is about the Warden and not about a body.** Ten of the fourteen stepping
 * sites reset the *Shade* - that is what a figure, a silhouette and a breath
 * are photographed by - and a Shade on a mark says nothing about where the
 * Warden is. `breathdrawn.js` has a third kind in the same span,
 * `renderer.info.reset()`, which is a draw-call counter and no body at all, so
 * a reader spelled `\.reset\(` would enrol two classes it is not about and one
 * thing that is not an actor. Both are `SITE_IGNORES` lines below.
 *
 * Built through a template rather than written as a regex literal, for the
 * reason `SITE` is: `codeOf` strips a string and leaves a regex literal where
 * it stands, so a literal here would put `warden.reset(` in **this** module's
 * code and a census of resets - which is what H83 is - would read this file as
 * one of its own. The identifier belongs in a string.
 */
const TELEPORTED_ACTOR = 'warden';
const TELEPORTS_THE_WARDEN = new RegExp(`\\b${TELEPORTED_ACTOR}\\.reset\\(`);

/**
 * The modules with a stepping site that teleports the Warden, and what each one
 * puts it on. Four of the fourteen, and the declaration is the point: a
 * teleported body has none of H73's headroom, so a site in this list is held up
 * by its `ai: false` alone and a site that joins it silently is a site arguing
 * from a margin that is about somebody else's Warden (H78, H82).
 *
 * Declared per module with a count rather than per line, because a `where` is a
 * line number and every edit to a file moves one - the count is what a reader
 * can check against the tree a year from now.
 */
const TELEPORTS = [
  { file: 'visual.js', sites: 1, onto: 'a mark 2.5m from the site, so the death camera has a killer to frame (H78 holds it there to 1e-6m)' },
  { file: 'figure.js', sites: 1, onto: 'the one 25m stand both figures are photographed on, face-on and side-on' },
  { file: 'breathcensus.js', sites: 1, onto: "the Shade's spawn, for the proof that the Warden does not breathe" },
  { file: 'look.js', sites: 1, onto: 'a lit lane, for the aim pose with the sights held through sixty frames' },
];

/** What a line is, to the three readers above, or nothing. */
const SEEN_AS = (text) => {
  if (ONE_SITE.test(text)) return 'a site';
  if (DRIVES_THE_WORLD.test(text)) return 'a driver';
  if (READS_THE_FRAMEBUFFER.test(text)) return 'a read';
  if (OWNS_THE_WARDEN.test(text)) return 'the flag';
  if (TELEPORTS_THE_WARDEN.test(text)) return 'a teleport';
  return '';
};

const SITE_SEES = [
  ['      const restore = quiesce(h);', 'a site'],
  ['      h.stepFrames(5);', 'a driver'],
  ['      h.renderFrame(1 / 60);', 'a driver'],
  ['      const lens = createLens(h, { pixelRatio: READ_AT() });', 'a read'],
  ['        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);', 'a read'],
  ["      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: true });", 'the flag'],
  ['      warden.reset({ position: mark, yaw: 0 });', 'a teleport'],
  // The harness's own field reads the same, which is how nine other modules
  // spell it (`h.warden.reset(h.map.wardenSpawns[0])` in ai.js).
  ['      h.warden.reset(h.map.wardenSpawns[0]);', 'a teleport'],
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
  // A body on a mark, and not the body this class is about: ten of the
  // fourteen stepping sites stand the Shade somewhere to photograph it.
  '      shade.reset({ position: site.position, yaw: 0 });',
  '      h.shade.reset({ position: where.stand, yaw: where.lane.yaw });',
  // And a reset that is not an actor at all - the draw-call counter, in the
  // same span as two of the resets above (breathdrawn.js).
  '      renderer.info.reset();',
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
      teleports: TELEPORTS_THE_WARDEN.test(span),
    };
  });
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-check-that-drives-the-world-after-a-quiesce-owns-the-warden',
    spec: 'Section 17.1 / H74',
    name: 'Every quiesce site that steps the simulation before it reads the framebuffer asks initMatch for a match of its own with the AI off, the sites that read a frame without stepping one are counted as the other class, and every stepping site that teleports the Warden onto a mark of its own is declared as one',
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
      const stepping = sites.filter((s) => s.reads && s.drives);
      const teleported = stepping.filter((s) => s.teleports);
      const fromTheOpening = stepping.filter((s) => !s.teleports);

      // ------------------------------------------------------------------
      // 3. The clause. A site that steps the simulation and then reads a
      //    picture has a Warden in that picture which has walked a distance
      //    the check never states. All of them in one problem, because the
      //    runner keeps 400 characters of a detail line and eleven separate
      //    complaints would be cut to two (H29).
      // ------------------------------------------------------------------
      if (live.length) {
        // H82: the margin cited depends on which class the site is in, and
        // citing the wrong one is the defect this job was raised for. A body
        // on its spawn has H73's turn to spend; a body put on a mark has
        // nothing, and the number for it is H78's.
        const spawned = live.filter((s) => !s.teleports);
        const moved = live.filter((s) => s.teleports);
        const parts = [];
        if (spawned.length) parts.push(`${spawned.length} leave the Warden where their match opened, where H73 gives it 4 frames of turning on the plant and 17 on the yard and no more (${spawned.map((s) => s.where).join(', ')})`);
        if (moved.length) parts.push(`${moved.length} teleport it onto a mark first, where H73's headroom does not apply at all and a body translates on frame one - 0.13542695m by the sixth step, both maps, H78 (${moved.map((s) => s.where).join(', ')})`);
        problems.push(`${live.length} quiesce site(s) step the simulation and then read the framebuffer with no match of their own, so the Warden in that frame has walked a distance the check does not state: ${parts.join('; ')}`);
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
      // And the arithmetic the detail line rests on (H60). These four classes
      // partition every site found, by construction - two booleans and a
      // third with no gap between them - so the clause buys nothing today and
      // cannot be wrong tomorrow (H61's shape). What it is for is the line
      // printing **three** of the four, the fourth being held empty above: a
      // class that stopped partitioning would leave sites out of a total no
      // reader could add up, which is the defect H60 found in a sibling.
      // ------------------------------------------------------------------
      // 5. H82's half: which stepping sites put the Warden where they want
      //    it. The class is not a verdict - all fourteen own a match, which
      //    is section 3's clause - it is which margin each may argue from,
      //    and `TELEPORTS` is the declaration. A teleport that nothing
      //    declares is the sentence H78 had to correct, about to be written
      //    again; a declaration with no teleport left under it is a roster
      //    nobody maintained, which is the half a census always owes.
      // ------------------------------------------------------------------
      const declaredTeleports = new Map(TELEPORTS.map((t) => [t.file, t]));
      const teleportsIn = new Map();
      for (const s of teleported) {
        const file = s.where.split(':')[0];
        teleportsIn.set(file, (teleportsIn.get(file) || 0) + 1);
      }
      for (const [file, found] of teleportsIn) {
        const declared = declaredTeleports.get(file);
        if (!declared) {
          problems.push(`${file} has ${found} stepping quiesce site(s) that reset the Warden onto a spot of their own and TELEPORTS declares none, so a site is relying on H73's four frames (plant) and seventeen (yard), which are about a Warden on its spawn - a teleported body translates on frame one (H78, H82)`);
        } else if (declared.sites !== found) {
          problems.push(`${file} teleports the Warden at ${found} stepping site(s) and TELEPORTS declares ${declared.sites}, onto ${declared.onto}`);
        }
      }
      for (const t of TELEPORTS) {
        if (!teleportsIn.has(t.file)) {
          problems.push(`TELEPORTS declares that ${t.file} teleports the Warden onto ${t.onto} and no stepping site in it does, so either the site has gone or the reader has stopped seeing a ${TELEPORTED_ACTOR} reset`);
        }
      }
      problems.push(...addsUp('the stepping-site split', stepping.length, {
        'teleport the Warden onto a spot of their own': teleported.length,
        'leave it where their own match opened': fromTheOpening.length,
      }));
      problems.push(...addsUp('the quiesce-site census', sites.length, {
        'step the simulation and own a match': owned.length,
        'step one without a match of their own': live.length,
        'read a frame without stepping one': oneFrame.length,
        'read no frame': blind.length,
      }));
      const itself = sites.filter((s) => s.where.startsWith(helper));
      if (itself.length) {
        problems.push(`${HELPER_FILE} contributes ${itself.length} site(s) (${itself.map((s) => s.where).join(', ')}) and should contribute none - the only ${HELPER}( in it is the definition, so the lookbehind that excludes it has stopped working`);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          // H60's rule about a line this long: the readings first, because the
          // runner keeps 400 characters of it and the two new counts are what
          // this check is read for. H91 is the cut itself.
          ? `${sites.length} quiesce sites over ${scanned.length} modules: ${stepping.length} step the simulation and read a frame, all owning a match with the AI off - ${teleported.length} teleport the Warden onto their own mark, where a body translates on frame 1 (0.1354m by six, H78), ${fromTheOpening.length} leave it where their match opened, with H73's 4 (plant) / 17 (yard) frames of headroom on top; `
            + `${oneFrame.length} read a frame without stepping one (Warden unmoved, H73); ${blind.length} read no frame`
          : problems.join('; '),
      };
    },
  });
}
