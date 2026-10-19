/**
 * BLACKLINE - tests/resetcensus.js
 *
 * AUTO suite (H83): every check that puts an actor somewhere and then reads it
 * back, and what each of them does about the body having stayed there.
 *
 * **The shape, found three times by hand before anybody counted it.** A1 asked
 * whether a climbable top had ground beside it within `warden.stepHeight` and
 * stayed green with the step temporarily at 2.00m; A3 *selected* its perches
 * with `canDefuseAt` and then asserted `canDefuseAt` had refused them; H78
 * found `the-death-camera-frames-the-killer` counting the killer's pixels and
 * how near the middle of frame they sat, **both true of a body anywhere**,
 * because the camera follows the killer and the check never asked whether the
 * Warden was still on the spot it had been put on. `HANDOFF.md` calls it the
 * lesson that keeps repeating: *any check that picks its own inputs owes the
 * suite that second half.* Three instances, three hands, no census - so this
 * is the census, and the unit is one actor reset inside one check.
 *
 * **Count first** (H71, H74, H77), because a floor on a number first measured
 * this morning is a rule nobody argued. **186 reset calls in 115 (check,
 * actor) pairs over 42 modules**, and the honest reading of them is that the
 * question is live for **eight**:
 *
 *   not read back       87  the reset places a body for something else to
 *                           measure - a HUD line, a round's state, a noise -
 *                           and nothing afterwards reads that body's position
 *                           or its mesh at all. Where it ended up is not a
 *                           premise of anything.
 *   nothing can move it  6  the body is read back, and no frame is driven
 *                           between the reset and the read. H76 is the clause:
 *                           a lens grab advances neither the clock nor the
 *                           picture, so a body nothing stepped is where it was
 *                           put, to the byte.
 *   driven by the check  9  the check drives that actor itself - the keys, a
 *                           step of its own, an eased pose - so the body is
 *                           *meant* to move and a mark would be the wrong
 *                           claim. These are the climb, slide and sprint
 *                           checks, and the figures photographed mid-pose.
 *   pinned every step    3  stronger than an assertion and nobody had written
 *                           it down: the check copies the position back onto
 *                           the body every step (`position.copy(held)`), so it
 *                           cannot drift. The three are the gunfight checks,
 *                           where the Warden is held in its lane while a live
 *                           AI shoots.
 *   the AI is off        2  a Warden in a match with `ai: false`, which H71
 *                           measured at 0.000m and 0.000rad over 420 frames
 *                           and `tests/quiesce.js` holds as a clause. Nothing
 *                           in this engine drives a Warden but its AI.
 *   exposed              8  read back, the world driven, and something other
 *                           than this check doing the driving. `EXPOSED` is
 *                           the roster, below, and every row says what it
 *                           holds instead.
 *
 * **Why the last column is declared and not derived.** Whether a check asserts
 * its mark is a question about *what the check means*, and a line-local reader
 * cannot answer it: `ai.js` and `objective.js` both carry a `Math.hypot` over a
 * position two lines after a reset, and in neither case is it about a mark - it
 * is the distance between the Warden's `lastKnown` and **where the Shade is
 * now**, which is a claim about the AI's knowledge and is self-correcting. A
 * regex that counted those as marks held would report this census green with
 * the one real instance (H78's, which is in `visual.js` and is the reason this
 * file exists) wide open. So the roster carries the reason in words, each row
 * is matched against the derived class both ways, and the two rows that say
 * they hold a mark are checkable: they must call `markProblems` below, which
 * is the only thing in this suite that measures that offset.
 *
 * **The tolerance was measured before it was written** (`npm run probe`, 18ms,
 * both maps). A Shade reset onto a site's floor and stepped with no AI and no
 * input is **0.000000000m** off its mark at the reset and after 1, 4, 5, 10
 * and 20 steps and a warm frame, on the plant and on the yard alike; the only
 * travel a reset leaves is the **0.019m** it settles in y, which is why the
 * measurement is horizontal (H74, H78). A Warden reset onto a mark 2.5m from
 * the site and stepped twenty times with the AI off reads the same 0.000000000m
 * and the same 0.019m of settle. So `ON_ITS_MARK` is the width of the
 * arithmetic and not an allowance for drift, which is H78's distinction and
 * the second time it has been measured rather than quoted.
 *
 * Nothing here renders a frame - it reads the tree, the way `quiescesites.js`
 * and `registry.js` do. `markProblems` is the one export other modules reach
 * for and is declared in `registry.js` (H70). Registered from tests/index.js;
 * nothing imports main.js (Section 3.1).
 */

import { codeOf, uncommented, readerProblems } from './sourcetext.js';
import { addsUp } from './censustally.js';

/**
 * The two actors. There is no third: a `GameMap`, a `CollisionWorld` and an
 * `EffectRegistry` all have a `reset()` and none of them is a body, which is
 * the distinction H82's reader had to make for the same reason - the one in
 * `breathdrawn.js` resets a draw-call counter three lines from a body.
 */
const ACTORS = ['shade', 'warden'];

/**
 * The tolerance and the measurement, as a problem or nothing.
 *
 * Horizontal, because the only travel a `reset()` leaves behind is the 0.019m
 * the capsule settles through in y (H74's reading, H78's clause, and this
 * job's probe on both maps). 1e-6m is the width of the arithmetic: every
 * reading taken of a body nothing drives is an exact zero.
 *
 * The caller names the mark **once** and hands the same object to `reset()`,
 * which is H78's rule rather than a style - a second copy of the coordinate
 * asks a different question, and the two can drift apart in a later edit
 * without anything going red.
 */
export const ON_ITS_MARK = 1e-6;
export function markProblems(actor, mark, what = 'the body') {
  const off = Math.hypot(actor.position.x - mark.x, actor.position.z - mark.z);
  if (off <= ON_ITS_MARK) return [];
  return [`${what} is ${off.toFixed(6)}m off the spot this check put it on, horizontally (the tolerance is ${ON_ITS_MARK}m, and the only travel a reset leaves is the 0.019m it settles in y): the eye below is taken from the body, so every reading in this check is about a body somewhere else and would have passed anyway (H78, H83)`];
}

/**
 * The readers, every one built through a template rather than written as a
 * regex literal, for the reason H82 wrote down: `codeOf` strips a string and
 * leaves a regex literal exactly where it stands, so a literal here would put
 * `reset(`, a world driver and a position read into **this** module's code -
 * and this module is in the census it performs, and in four others besides
 * (`breathcensus.js`, `breathdrawn.js`, `positioncensus.js`, `timedrenders.js`).
 * The identifiers belong in strings.
 */
const RESET_CALL = (actor) => new RegExp(`\\b(?:h\\.)?${actor}\\.reset\\(`, 'g');
const READS_IT_BACK = (actor) => new RegExp(`\\b(?:h\\.)?${actor}\\.(?:position|mesh)\\b|\\b${actor}Body\\b`);
const PINS_IT = (actor) => new RegExp(`\\b(?:h\\.)?${actor}\\.position\\.copy\\(`);
const DRIVES_THE_ACTOR = (actor) => new RegExp(`\\b(?:h\\.)?${actor}\\.(?:step|updateVisual|easeOneFrame)\\(|\\binput\\.(?:heldCodes|pressedCodes)|\\bdriveAtLedge\\(`);
const WORLD_DRIVERS = ['stepFrames', 'renderFrame'];
const DRIVES_THE_WORLD = new RegExp(`\\bh\\.(?:${WORLD_DRIVERS.join('|')})\\(`);
const AI_IS_OFF = /\bai:\s*false\b/;
const REGISTRAR = /\bregisterAutoTest\(/g;
/** An id is a string, so it comes off the weak reader and never off `codeOf` (H62). */
const ID = /\bid:\s*'([a-z0-9-]+)'/;
/** The claim a row makes when it says it holds its mark: the call, by name. */
const MARK_READER = 'markProblems';

/** What a line is to the readers above, or nothing. */
const SEEN_AS = (text) => {
  if (RESET_CALL('shade').test(text) || RESET_CALL('warden').test(text)) return 'a reset';
  if (PINS_IT('shade').test(text) || PINS_IT('warden').test(text)) return 'a pin';
  if (DRIVES_THE_WORLD.test(text)) return 'a driver';
  if (READS_IT_BACK('shade').test(text) || READS_IT_BACK('warden').test(text)) return 'a read';
  if (AI_IS_OFF.test(text)) return 'the flag';
  return '';
};
const RESET_SEES = [
  ['      shade.reset({ position: site.position, yaw: 0 });', 'a reset'],
  ['      h.warden.reset(h.map.wardenSpawns[0]);', 'a reset'],
  ['        warden.position.copy(held);', 'a pin'],
  ['      h.stepFrames(20);', 'a driver'],
  ['      const focus = { x: shade.position.x, y: shade.feetY + 1.0, z: shade.position.z };', 'a read'],
  ["      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: true });", 'the flag'],
];
const RESET_IGNORES = [
  // A reset that is not a body: a draw-call counter, three lines from two that are.
  '      renderer.info.reset();',
  '      h.gadgets.reset();',
  // A longer word that begins with an actor's name is not that actor (H61).
  // This census's first draft wrote that case as `structure(shade.mesh)`,
  // which *is* a read of a body, and its own instrument said so on the first
  // subset - a vector has to be a line the reader must make nothing of.
  '      const spawn = h.map.shadeSpawns[0];',
  // Prose naming all of it, which is what this header is made of.
  ' * `position.copy(held)`, so a stepFrames after a shade.reset( cannot drift',
];

/**
 * The eight pairs where the question is live, and what each holds instead of a
 * mark. `holds: MARK_READER` is the only one of these that is checkable from
 * here, and it is checked: the span must call it.
 *
 * Keyed by module and check id rather than by a line number, because every
 * edit to a file moves a line and none of them moves an id (H82's lesson from
 * its own roster).
 */
const EXPOSED = [
  {
    file: 'outline.js', id: 'the-outline-darkens-the-silhouette-edge', actor: 'shade',
    holds: MARK_READER,
    why: 'the site was chosen because it is lit and the eye is taken from the body, so H78s shape exactly: a Shade that had walked into shadow would be framed the same way and read a different edge',
  },
  {
    file: 'visual.js', id: 'the-shade-visibly-dims-with-the-meter', actor: 'shade',
    holds: MARK_READER,
    why: 'the same shape in the same module as H78s own: the eye is three metres from whatever the body is, so the dim-with-the-meter reading is about a body anywhere',
  },
  {
    file: 'ai.js', id: 'ai-places-its-alarm-camera-and-acts-on-it', actor: 'shade',
    holds: 'a live comparison and not a mark',
    why: 'the claim is the distance between the AIs lastKnown and where the Shade is now, both read at the moment of the comparison, so a Shade that moved moves both sides of it',
  },
  {
    file: 'objective.js', id: 'defend-breaks-off-when-the-warden-is-attacked', actor: 'shade',
    holds: 'a live comparison and not a mark',
    why: 'the Shade is placed one metre behind wherever the Warden is standing, read live, and the assertion is about what the Warden knew afterwards',
  },
  {
    file: 'objective.js', id: 'defend-breaks-off-when-the-warden-is-attacked', actor: 'warden',
    holds: 'the body is the subject',
    why: 'the Warden is defusing with the AI live and the check is that it breaks off and turns, which is a body that must move for the check to mean anything',
  },
  {
    file: 'gadgets.js', id: 'the-ais-grenades-fly-land-and-hurt', actor: 'shade',
    holds: 'the body is the subject',
    why: 'the grenade is thrown at the Shade read live and then damages it; a body that did not move under a frag would be the defect',
  },
  {
    file: 'performance.js', id: 'frame-budget-under-the-check-29-load', actor: 'shade',
    holds: 'the body is the subject',
    why: 'the Shade is smoked, flashed, shot and ragdolled, which is the load being timed - its position is read to aim all four at it',
  },
  {
    file: 'visual.js', id: 'the-death-camera-frames-the-killer', actor: 'shade',
    holds: 'the body is the subject',
    why: 'the Shade is killed and the ragdoll tumbles it, which the check measures; the Warden half of this same check is H78s clause and holds its mark to 1e-6m',
  },
];

/**
 * How many modules the registrar must import before this census believes it is
 * reading the tree (`registry.js`'s model, and `quiescesites.js`'s): it cannot
 * see one module go missing, and it does catch an import list that has
 * collapsed to a handful and reads as a clean sweep of nothing.
 */
const MIN_TEST_MODULES = 50;

/**
 * Every (check, actor) pair in one module, read as code.
 *
 * The span is one `registerAutoTest(` to the next, which is `quiescesites.js`'s
 * unit and the only one a line-local reader can defend; the id comes off the
 * **weak** reader, because an id is a string and `codeOf` empties it (H62).
 * Everything after the **last** reset of that actor is what the classification
 * reads, because an earlier reset is a placement the later one replaced.
 */
function pairsIn(file, source) {
  const code = codeOf(source);
  const weak = uncommented(source);
  REGISTRAR.lastIndex = 0;
  const starts = [...code.matchAll(REGISTRAR)].map((m) => m.index);
  REGISTRAR.lastIndex = 0;
  const idStarts = [...weak.matchAll(REGISTRAR)].map((m) => m.index);
  const pairs = [];
  starts.forEach((start, i) => {
    const span = code.slice(start, i + 1 < starts.length ? starts[i + 1] : code.length);
    let id = '(a check with no id)';
    if (idStarts[i] !== undefined) {
      const found = weak.slice(idStarts[i], i + 1 < idStarts.length ? idStarts[i + 1] : weak.length).match(ID);
      if (found) id = found[1];
    }
    for (const actor of ACTORS) {
      const hits = [...span.matchAll(RESET_CALL(actor))];
      if (!hits.length) continue;
      const after = span.slice(hits[hits.length - 1].index);
      pairs.push({
        file, id, actor, resets: hits.length,
        readsBack: READS_IT_BACK(actor).test(after),
        drivesWorld: DRIVES_THE_WORLD.test(after),
        drivesActor: DRIVES_THE_ACTOR(actor).test(after),
        pinned: PINS_IT(actor).test(after),
        aiOff: AI_IS_OFF.test(span),
        holdsMark: after.includes(`${MARK_READER}(`),
      });
    }
  });
  return pairs;
}

/** The one classification, in the order the header lists it. */
function classOf(pair) {
  if (!pair.readsBack) return 'not read back';
  if (!pair.drivesWorld) return 'nothing can move it';
  if (pair.pinned) return 'pinned every step';
  if (pair.drivesActor) return 'driven by the check';
  if (pair.actor === 'warden' && pair.aiOff) return 'the AI is off';
  return 'exposed';
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'every-check-that-resets-an-actor-and-reads-it-back-says-what-holds-it-there',
    spec: 'Section 17.1 / H83',
    name: 'Every reset of an actor under src/tests is classified by what keeps the body where the check put it, and the pairs where something other than the check drives the world are declared with what each holds instead of a mark',
    run: async () => {
      const problems = [];
      const origin = location.origin;

      // ------------------------------------------------------------------
      // 1. The readers, before anything they report is believed
      //    (`sourcetext.js`'s instrument, F8's model). Two of the lines they
      //    must make nothing of are resets of things that are not bodies,
      //    one is a longer word beginning with an actor's name, and one is
      //    prose out of this header.
      // ------------------------------------------------------------------
      problems.push(...readerProblems(SEEN_AS, RESET_SEES, RESET_IGNORES, codeOf));

      // ------------------------------------------------------------------
      // 2. The census, over every module the registrar imports.
      // ------------------------------------------------------------------
      const index = await (await fetch(`${origin}/src/tests/index.js`)).text();
      const files = [...index.matchAll(/import \{ register as \w+ \} from '\.\/([a-z0-9]+\.js)';/g)].map((m) => m[1]);
      if (files.length < MIN_TEST_MODULES) {
        return { pass: false, detail: `tests/index.js imports ${files.length} modules and the suite is ${MIN_TEST_MODULES}+, so this census is not reading the tree` };
      }
      const pairs = [];
      for (const file of files) {
        pairs.push(...pairsIn(file, await (await fetch(`${origin}/src/tests/${file}`)).text()));
      }
      const byClass = (name) => pairs.filter((p) => classOf(p) === name);
      const exposed = byClass('exposed');
      const calls = pairs.reduce((n, p) => n + p.resets, 0);

      // ------------------------------------------------------------------
      // 3. The clause, both ways. An exposed pair nothing declares is the
      //    sentence H78 had to write by hand about to be needed again; a
      //    declared row with no exposed pair under it is a roster nobody
      //    maintained, and from here the two look identical.
      // ------------------------------------------------------------------
      const declared = new Map(EXPOSED.map((row) => [`${row.file} ${row.id} ${row.actor}`, row]));
      for (const pair of exposed) {
        const key = `${pair.file} ${pair.id} ${pair.actor}`;
        const row = declared.get(key);
        if (!row) {
          problems.push(`${pair.file}'s ${pair.id} resets the ${pair.actor}, drives frames it does not drive that body through, and then reads the body back - and EXPOSED declares nothing for it, so it is A1, A3 and H78's shape with nothing said about it`);
          continue;
        }
        if (row.holds === MARK_READER && !pair.holdsMark) {
          problems.push(`${pair.file}'s ${pair.id} declares that it holds the ${pair.actor} on its mark and does not call ${MARK_READER}(), which is the only reader of that offset in this suite`);
        }
      }
      for (const row of EXPOSED) {
        const key = `${row.file} ${row.id} ${row.actor}`;
        if (!exposed.some((p) => `${p.file} ${p.id} ${p.actor}` === key)) {
          problems.push(`EXPOSED declares ${row.id} (${row.file}, the ${row.actor}) and the census does not put it in the exposed class - either the check now drives or pins that body, or a reader has stopped matching`);
        }
      }

      // ------------------------------------------------------------------
      // 4. And the other half a census of a set always owes (H4, H11, H60):
      //    every class is populated on this tree, so a reader that went
      //    blind names itself rather than reporting a clean sweep, and the
      //    classes add up to the total the line prints beside them.
      // ------------------------------------------------------------------
      for (const name of ['not read back', 'nothing can move it', 'driven by the check', 'pinned every step', 'the AI is off', 'exposed']) {
        if (!byClass(name).length) {
          problems.push(`no (check, actor) pair is in the "${name}" class and this tree has at least one, so the reader that decides it has stopped matching`);
        }
      }
      problems.push(...addsUp('the actor-reset census', pairs.length, {
        'are never read back': byClass('not read back').length,
        'have nothing that could move them': byClass('nothing can move it').length,
        'are pinned every step': byClass('pinned every step').length,
        'are driven by the check': byClass('driven by the check').length,
        'are a Warden with the AI off': byClass('the AI is off').length,
        'are exposed and declared': exposed.length,
      }));

      const modules = new Set(pairs.map((p) => p.file)).size;
      const marked = exposed.filter((p) => p.holdsMark).length;
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${calls} actor resets in ${pairs.length} (check, actor) pairs over ${modules} modules: ${byClass('not read back').length} never read the body back, `
            + `${byClass('nothing can move it').length} drive no frame after it (H76), ${byClass('driven by the check').length} drive that body themselves, ${byClass('pinned every step').length} pin it every step, ${byClass('the AI is off').length} are a Warden with the AI off (H71); `
            + `${exposed.length} are exposed and all ${exposed.length} declared - ${marked} hold the mark to ${ON_ITS_MARK}m (H78), the rest a live comparison or a body that is the subject`
          : problems.join('; '),
      };
    },
  });
}
