/**
 * BLACKLINE - tests/quiesce.js
 *
 * AUTO suite (H71): `quiesce()` says what it does about the AI, and the
 * sentence is held against the flag its own body passes.
 *
 * **The sentence that was false.** `tests/pixels.js`'s helper opened with *"Put
 * both actors somewhere harmless and stop the AI interfering, so a measurement
 * is of the thing being measured"*, and its body asked `initMatch` for
 * `ai: true` - twice, once on the way in and once in the restore it hands back.
 * So a check that quiesced got a fresh match with a **live** Warden in it -
 * and **twenty** modules under `src/tests/` call the helper thirty times,
 * **twelve of them never naming `initMatch` at all**, which is to say twelve
 * that read the sentence and nothing else. H57 paid for that
 * the expensive way: `strikerepeat.js` runs after `poseeye.js`, inherited the
 * restore, and had the Shade shot dead in the middle of a strike - and a strike
 * reports what the body did not do, so the afternoon went on the gait.
 *
 * **The sentence is what changed, and not the flag.** Passing `ai: false` here
 * would have changed what every one of those thirty calls measures, in exchange
 * for a comment - the AI's own frames are part of anything driven after a
 * `quiesce` - so the entry recommended the sentence and the sentence is what
 * moved; PROGRESS.md has the argument and the measurement under it. The honest
 * fix for a false comment is a true one.
 *
 * **Which leaves the drift, and that is what this check is for.** A sentence
 * and a flag a dozen lines apart agree today because somebody read both at
 * once; they stay agreed only if something keeps reading them together. So the
 * flag is read off `pixels.js`'s source as **code**, the sentence is sliced out
 * of the comment directly above the function and read as **prose**, and each is
 * required to name the other's answer: flip the body to `ai: false` and the
 * sentence is red until it is rewritten, and rewrite the sentence to claim the
 * AI is stopped and it is red until the body agrees.
 *
 * **The one clause in this suite whose subject really is a comment.** H41's
 * rule is that a grep over source strips the comments first and every census
 * here obeys it (`sourcetext.js` owns the two readers). This breaks the rule
 * deliberately and in one direction: the prose clause reads the raw text of one
 * sliced comment, because the thing asserted *is* that comment, while the flag
 * clause reads `codeOf`. That division is load-bearing rather than tidy - the
 * corrected sentence names the flag it passes, so a reader that kept the prose
 * would count the mention as a third flag and read a disagreement as agreement.
 *
 * And a behavioural half, because a clause about a comment is still a clause
 * about text: the live match the helper leaves is asked for by name, and the
 * Warden is required to walk with nothing held after a `quiesce` and to stand
 * still over the same frames in a match this check starts with `ai: false`
 * itself. Without that control the movement clause would be satisfied by any
 * body that drifts, which is the shape H39's first draft went red for.
 *
 * **One reading is reported and asserted nowhere, and it is the interesting
 * one.** At the moment `quiesce` returns, the Warden is **0.000m** off its
 * spawn on both maps - so the frame a pixel check draws next is the same frame
 * either way, and the three callers that rest on this helper have been safe for
 * a reason none of them states: the AI takes about twenty-five frames to start
 * walking and `quiesce` settles twenty. That is a five-frame margin nothing
 * watches, and whether it should be pinned is a question about the suite rather
 * than an answer, so it is in the queue (H73) and in the detail line, and not
 * in a clause here. A number asserted the morning it is first measured is a
 * rule nobody argued.
 *
 * Nothing here renders a frame. Registered from tests/index.js; nothing
 * imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { codeOf, readerProblems } from './sourcetext.js';
import { quiesce } from './pixels.js';

/** The helper, where it lives, and the id this check reports under. */
const HELPER = 'quiesce';
const HELPER_FILE = 'src/tests/pixels.js';

/**
 * The flag, read as code. A `g` flag and `lastIndex` reset at every use, which
 * is `pixelfloors.js`'s rule for a shared pattern.
 */
const FLAG = /\bai:\s*(true|false)\b/g;

/**
 * How many times the body must pass it. **Two**, and the second is the one that
 * matters: the restore is what the *next* check inherits, which is what H57 was
 * bitten by, so a body that passes the flag on the way in and leaves the restore
 * to chance is the defect and not a tidier helper.
 */
const PASSES_IT_TIMES = 2;

/**
 * What the sentence above the helper must say, and must not, for each value the
 * body could pass - keyed by the flag, so which row is applied is read off the
 * tree rather than decided here.
 *
 * `example` is a sentence that row must accept, and that the *other* row must
 * reject; both are checked every run, which is what makes this a judgement
 * rather than a recital of today's wording (F8's model, and `posecriterion.js`'s
 * seven cases for a proxy that does not exist yet). **The `false` row is not the
 * tree's today** and is kept for exactly that reason: a table with one row is a
 * clause that cannot tell you what it would do if the flag moved.
 *
 * **A `mustNot` phrasing is banned outright, negated or not**, which is a real
 * constraint on the comment and is the honest one: these readers decide
 * line-locally and never by parsing (`donedef.js`'s rule), and no line-local
 * reader can see a *not* in front of a claim. So the sentence says what the
 * helper does, in the positive, and what it does not do is this check's to say
 * and PROGRESS.md's to explain.
 */
const SAYS = {
  true: {
    reading: 'a live match with the AI in it',
    must: [
      { pattern: /\blive\b/, want: 'the word live, because that is what the match it leaves is' },
      { pattern: /\bai: true\b/, want: 'the flag it passes, spelled the way the body spells it' },
    ],
    mustNot: [
      { pattern: /stops?(?:ping)? the AI/i, why: 'it does not stop the AI - it starts a match with one' },
      { pattern: /\bai: false\b/, why: 'the body passes the other value' },
    ],
    example: 'Put both actors back on their spawns in a live match - `ai: true` - and settle it.',
  },
  false: {
    reading: 'a quiet match with the AI stopped',
    must: [
      { pattern: /stops?(?:ping)? the AI/i, want: 'the thing a caller would be relying on' },
      { pattern: /\bai: false\b/, want: 'the flag it passes, spelled the way the body spells it' },
    ],
    mustNot: [
      { pattern: /\blive\b/, why: 'a match with no AI in it is the opposite of a live one' },
      { pattern: /\bai: true\b/, why: 'the body passes the other value' },
    ],
    example: 'Put both actors back on their spawns and stop the AI interfering - `ai: false`.',
  },
};

/**
 * Lines the flag reader must see and lines it must make nothing of, through
 * `codeOf` and on `sourcetext.js`'s instrument. The second `ignores` line is
 * the one this check would otherwise break on: the sentence it asserts names
 * the flag, in prose, directly above the body that passes it.
 */
const READER_SEES = [
  ["  h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });", 'a flag'],
];
const READER_IGNORES = [
  ' * spawns in a live match - it passes `ai: true` - and settles twenty frames.',
  "      problems.push('give strike() a match of its own with ai: false');",
];
const SEEN_AS_A_FLAG = (text) => { FLAG.lastIndex = 0; return FLAG.test(text) ? 'a flag' : ''; };

/**
 * Frames the Warden is given, and the four bars.
 *
 * **Moved or turned, and not moved alone**, because a live AI is not only a
 * patrol: it pauses two to four seconds at every node of its circuit and scans
 * from the spot, it stops and faces a noise, and it stands and fires at a Shade
 * it can see - so there is no number of frames in which a live Warden must have
 * walked. What it never does is nothing, and nothing is exactly what the idle
 * intent `main.js` hands the controller when the flag is off: no direction, no
 * look, and the only thing left moving is gravity, which is vertical. Seven
 * seconds because that is longer than the longest pause, and the numbers are
 * the probe's: the Warden covered **9.9m, 12.7m** (plant) and **15.3m** (yard)
 * over those frames with the AI on, turning 0.8 to 2.8 radians, and **0.000m
 * and 0.000rad** every time with it off. So the floor is a twentieth of the
 * shortest walk measured and the ceiling is a centimetre against a reading
 * that is not near zero but *is* zero.
 */
const WALK_FRAMES = 420;
const WALKED = 0.5;
const TURNED = 0.1;
const STILL = 0.01;
const UNTURNED = 0.001;

/**
 * H73: what the settle is for, and the thing twelve callers actually rest on.
 *
 * Twelve of the twenty modules that call this helper draw a frame after it and
 * never open a match of their own (H74), so every pixel number they report is
 * taken with a **live** Warden somewhere in the scene. The reason that has
 * always been reproducible is not that the AI is slow to wake: **it is awake on
 * the first frame, and what it does first is turn.** Measured one frame at a
 * time on both maps, four passes each: the Warden rotates a flat **0.0567 rad a
 * frame** from frame 1 - a patrol's first act is to face its first route node -
 * and translates **nothing at all** until it is round. The angle is map data,
 * so the frames are too: the plant's first node is 1.83 rad off its nose and
 * the body first moves on frame **4 or 5** after the helper returns, the yard's
 * is 1.13 rad off and it first moves on frame **17**.
 *
 * **So the clause is the mechanism and not the margin.** An exact frame is a
 * bad bar twice over - it is map data, and on the plant two probes of the same
 * question read 4 and 5, because the crossing falls near a frame boundary. What
 * is stable, and what the twelve are really leaning on, is that over the frames
 * the helper settles **the yaw moves and the position does not**: the AI is
 * live, which is the sentence, and the body is where `initMatch` put it, which
 * is the reading. Both halves asserted, the first moving frame reported.
 *
 * `SETTLE` is read off `pixels.js`'s own source rather than written here, so a
 * helper that grew its settle past the turn would be driven as it really is and
 * go red - which is the drift H71 queued this for. It is **not** D70's vacuous
 * shape: the bar is a distance of zero and a turn, neither derived from the
 * count, and only the number of frames driven comes from the tree.
 */
const SETTLES = /stepFrames\((\d+)\)/;
const ON_SPAWN = 1e-6;
const TURNS_BY = 0.05;
const FIRST_MOVE_CAP = 60;

/** Horizontal distance, because a settling body's travel is all in y. */
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** A yaw difference, wrapped, so a turn through pi reads as a turn. */
const turn = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/**
 * What the Warden's body did over `WALK_FRAMES`, with nothing held: the one
 * reading both halves of the control are taken with, so the only difference
 * between them is the flag.
 */
function whatTheBodyDid(h) {
  const from = { x: h.warden.position.x, z: h.warden.position.z, yaw: h.warden.yaw };
  h.stepFrames(WALK_FRAMES);
  return { moved: flat(h.warden.position, from), turned: turn(h.warden.yaw, from.yaw) };
}

/**
 * H73: the settle, driven here rather than inside the helper, so that what
 * happens during it can be read. The same match the helper starts and the same
 * number of frames, taken off its source - then one frame at a time until the
 * body translates, which is reported and not asserted.
 */
function whatTheSettleDoes(h, flag, settle) {
  h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: flag === 'true', objective: true });
  h.menu.hide();
  h.setPaused(false);
  h.input.clearAll();
  const spawn = { x: h.warden.position.x, z: h.warden.position.z, yaw: h.warden.yaw };
  h.stepFrames(settle);
  const over = { moved: flat(h.warden.position, spawn), turned: turn(h.warden.yaw, spawn.yaw) };
  let firstMove = 0;
  for (let i = 1; i <= FIRST_MOVE_CAP && !firstMove; i++) {
    h.stepFrames(1);
    if (flat(h.warden.position, spawn) > ON_SPAWN) firstMove = i;
  }
  return { ...over, firstMove };
}

/**
 * The helper's own two slices: the body, and the comment that opens above it.
 * Sliced and never grepped whole - a sentence anywhere else in `pixels.js`
 * would satisfy a file-wide read, and this file has a long header about what a
 * pixel reading can and cannot settle.
 */
function slices(source) {
  const at = source.indexOf(`export function ${HELPER}(`);
  if (at === -1) return { error: `${HELPER_FILE} no longer exports a function called ${HELPER}(); this check is about that function's own sentence` };
  const close = source.indexOf('\n}', at);
  const opens = source.lastIndexOf('/**', at);
  const doc = opens === -1 ? '' : source.slice(opens, at);
  if (!/\*\/\s*$/.test(doc)) {
    return { error: `the text above ${HELPER}() in ${HELPER_FILE} is not a doc comment that closes before it; this check asserts that comment and cannot read it` };
  }
  return { body: source.slice(at, close === -1 ? source.length : close + 2), doc };
}

/** What a row makes of a sentence: the problems, in the row's own words. */
function judge(flag, doc) {
  const row = SAYS[String(flag)];
  const problems = [];
  for (const { pattern, want } of row.must) {
    if (!pattern.test(doc)) problems.push(`it does not contain ${pattern} - ${want}`);
  }
  for (const { pattern, why } of row.mustNot) {
    if (pattern.test(doc)) problems.push(`it contains ${pattern} - ${why}`);
  }
  return problems;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'quiesce-says-what-it-does-about-the-ai',
    spec: 'Section 17.1 / H57, H71',
    name: 'The sentence above quiesce() in tests/pixels.js says what its body does about the AI, the flag it passes is read off the source rather than written down here, and the match it leaves is live in fact and not only in prose',
    run: async (h) => {
      const problems = [];

      // ------------------------------------------------------------------
      // 1. The instruments, before anything they report is believed: the
      //    flag reader against a line of code and two lines of prose (one of
      //    them the very sentence this check asserts), and the prose judge
      //    against both rows of SAYS.
      // ------------------------------------------------------------------
      problems.push(...readerProblems(SEEN_AS_A_FLAG, READER_SEES, READER_IGNORES, codeOf));
      for (const flag of ['true', 'false']) {
        const other = flag === 'true' ? 'false' : 'true';
        if (judge(flag, SAYS[flag].example).length) {
          problems.push(`the ${flag} row rejects its own example sentence (${judge(flag, SAYS[flag].example).join('; ')}), so it would red a correct comment`);
        }
        if (!judge(flag, SAYS[other].example).length) {
          problems.push(`the ${flag} row accepts the ${other} row's sentence, so the two readings are not being told apart and the clause below would pass on either comment`);
        }
      }

      // ------------------------------------------------------------------
      // 2. The flag, off the body, as code.
      // ------------------------------------------------------------------
      const source = await (await fetch(`${location.origin}/${HELPER_FILE}`)).text();
      const cut = slices(source);
      if (cut.error) return { pass: false, detail: cut.error };
      FLAG.lastIndex = 0;
      const passed = [...codeOf(cut.body).matchAll(FLAG)].map((m) => m[1]);
      const asked = [...new Set(passed)];
      if (asked.length !== 1) {
        return {
          pass: false,
          detail: asked.length === 0
            ? `${HELPER}()'s body asks initMatch for no ai flag at all, so what a caller gets is whatever resolveMatchOptions defaults to and no sentence can be held against it`
            : `${HELPER}()'s body passes ai: ${passed.join(' and then ai: ')} - one match on the way in and another in the restore, so a caller measures in one and leaves the next check in the other`,
        };
      }
      const flag = asked[0];
      // And the frames it settles, off the same body, because the clause below
      // drives the settle the helper really has rather than a copy of it (H73).
      const settles = SETTLES.exec(codeOf(cut.body));
      if (!settles) {
        return { pass: false, detail: `${HELPER}()'s body no longer steps a fixed number of frames (${SETTLES}), and what happens during that settle is what twelve of its callers draw their frame after (H73)` };
      }
      const settle = Number(settles[1]);
      if (passed.length < PASSES_IT_TIMES) {
        problems.push(`${HELPER}()'s body passes ai: ${flag} ${passed.length} time(s) and this check wants ${PASSES_IT_TIMES} - the call and the restore; the restore is what the next check inherits, which is what H57 was bitten by`);
      }

      // ------------------------------------------------------------------
      // 3. The sentence, off the comment above it, as prose. The one clause
      //    in this suite that reads a comment on purpose (see the header).
      // ------------------------------------------------------------------
      const said = judge(flag, cut.doc);
      for (const fault of said) {
        problems.push(`${HELPER}()'s body passes ai: ${flag} - ${SAYS[flag].reading} - and ${fault}`);
      }

      // ------------------------------------------------------------------
      // 4. And in fact: the match the helper leaves says so, the restore
      //    leaves the same one, and the Warden does what that flag means.
      // ------------------------------------------------------------------
      const wants = flag === 'true';
      const restore = quiesce(h);
      let afterCall;
      let quiesced;
      let shadeDrift;
      let wardenSettled;
      try {
        afterCall = h.match.aiEnabled;
        shadeDrift = flat(h.shade.position, h.map.shadeSpawns[0].position);
        wardenSettled = flat(h.warden.position, h.map.wardenSpawns[0].position);
        quiesced = whatTheBodyDid(h);
      } finally {
        restore();
      }
      const afterRestore = h.match.aiEnabled;

      // The control, in the other state, started the way `quiesce` starts one
      // so that the flag is the only difference between the two readings.
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: !wants, objective: true });
      h.menu.hide();
      h.setPaused(false);
      h.input.clearAll();
      h.stepFrames(settle);
      const control = whatTheBodyDid(h);
      // H73: and the settle itself, driven out here where it can be read - the
      // same match, the same frame count off the same source. Twelve callers
      // draw their frame at the end of it.
      const during = whatTheSettleDoes(h, flag, settle);
      // And leave the run in the state a restore leaves it, which is what
      // every check after a pixel check already inherits.
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: wants, objective: true });
      h.menu.hide();

      const driven = wants ? quiesced : control;
      const inert = wants ? control : quiesced;
      const did = (reading) => `${reading.moved.toFixed(3)}m and ${reading.turned.toFixed(3)}rad`;

      if (afterCall !== wants) problems.push(`${HELPER}() passes ai: ${flag} and the match it left says aiEnabled=${afterCall}`);
      if (afterRestore !== wants) problems.push(`${HELPER}()'s restore passes ai: ${flag} and the match it left says aiEnabled=${afterRestore} - the next check in the run inherits that one`);
      if (shadeDrift > WALKED) problems.push(`the Shade is ${shadeDrift.toFixed(3)}m from her spawn after ${HELPER}(), and the sentence says it puts her there`);
      if (driven.moved < WALKED && driven.turned < TURNED) {
        problems.push(`with ai: true the Warden moved ${did(driven)} over ${WALK_FRAMES} frames with nothing held, against ${WALKED}m or ${TURNED}rad - either no AI is running or this clause has stopped being able to see one that is`);
      }
      if (inert.moved > STILL || inert.turned > UNTURNED) {
        problems.push(`with ai: false the Warden moved ${did(inert)} over the same ${WALK_FRAMES} frames, against ${STILL}m and ${UNTURNED}rad - the control is what makes the reading above about the AI rather than about a body that drifts`);
      }
      // H73: what the settle does, which is what twelve callers draw after.
      // Both halves, because either alone is satisfied by the wrong thing: a
      // body that has not moved could be a body nobody is driving, and a yaw
      // that moved could belong to a Warden already walking off its spawn.
      if (wardenSettled > ON_SPAWN) {
        problems.push(`the Warden is ${wardenSettled.toFixed(6)}m off its spawn when ${HELPER}() returns, against ${ON_SPAWN}m - twelve of its callers draw their frame here and have never had to say where the Warden was (H73, H74)`);
      }
      if (during.moved > ON_SPAWN) {
        problems.push(`over the ${settle} frames ${HELPER}() settles the Warden translated ${during.moved.toFixed(6)}m, against ${ON_SPAWN}m - a settle that outlasts the turn puts a walking Warden in twelve checks' frames, and the frames it takes are map data (${during.firstMove || `>${FIRST_MOVE_CAP}`} after the settle here)`);
      }
      if (wants && during.turned < TURNS_BY) {
        problems.push(`over the ${settle} frames ${HELPER}() settles the Warden turned ${during.turned.toFixed(4)}rad, against ${TURNS_BY}rad - with the AI live its first act is to face its first route node, and a body that did not turn either has no AI driving it or is already round, which would make the clause above about nothing`);
      }

      return {
        pass: problems.length === 0,
        // Kept inside the 400 characters the runner keeps, because the numbers
        // below are this check's own finding and H42's were cut out of H42's.
        detail: problems.length === 0
          ? `ai: ${flag} x${passed.length} (call, restore); sentence: ${SAYS[flag].reading}, read as prose off its ${cut.doc.length}-char comment; `
            + `aiEnabled=${afterCall} then ${afterRestore}; Shade ${shadeDrift.toFixed(3)}m off spawn; `
            + `over its ${settle} settling frames the Warden turned ${during.turned.toFixed(4)}rad, translated ${during.moved.toFixed(6)}m, first moved ${during.firstMove || `>${FIRST_MOVE_CAP}`} frames later (H73); `
            + `over ${WALK_FRAMES} frames nothing held it moved ${did(driven)} with the AI on, ${did(inert)} off`
          : problems.join('; '),
      };
    },
  });
}
