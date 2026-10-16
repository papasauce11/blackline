/**
 * BLACKLINE - tests/grabworld.js
 *
 * AUTO suite (H76): a `lens.grab()` advances neither the clock nor the picture,
 * which is the sentence twelve checks rest on and no clause held.
 *
 * **What the twelve are leaning on.** H74 sorted `quiesce()`'s thirty-one sites
 * into three classes, and **twelve of them grab a frame without stepping one**.
 * They are safe for a reason none of them states and only `quiescesites.js`'s
 * header argued: `grab()` renders and reads the framebuffer back and **advances
 * nothing**, so the world in every one of those pictures is the world
 * `quiesce()` returned, and a toggle difference taken across two grabs cancels
 * whatever was standing still in both. That is a property of `pixels.js`. A
 * `grab()` that one day stepped a frame - or a helper that grew a `stepFrames`
 * into it for a reason that looked good at the time - would make twelve
 * classifications wrong **in silence**, and the sites census would not notice,
 * because it reads the *caller's* source and never the helper's.
 *
 * **The measurement, and it split the sentence in two.** Three grabs in a row
 * off one lens are **byte-identical** - 0 differing bytes of 3,686,400, on both
 * maps - and across them `clock.frame`, `clock.wall` and `clock.sim` do not
 * move and the Warden translates 0.000000000m and turns 0.000000000rad. So the
 * sentence is true. But *"advances nothing"* turns out to be **two guarantees
 * with two different detectors**, and the entry that asked for this clause
 * assumed one:
 *
 *   the clock    `stepFrames` inside `grab()` would advance `clock.sim` by a
 *                sixtieth a call, and `renderFrame` would advance `frame` and
 *                `wall` - and **neither would change the picture**
 *   the picture  what moves the drawn body is `updateVisual`, which neither of
 *                those two calls is: measured, a frame stepped between two
 *                grabs leaves the buffer **byte-identical as well**
 *
 * That last reading is the one worth having. The obvious break for this check -
 * put a `stepFrames` in `grab()` - is caught by the **clock** clause and not by
 * the picture clause, because stepping the simulation moves the capsule and not
 * the pose the renderer draws. A check written with only the picture half would
 * have passed the very mutation the queue entry named.
 *
 * So all three are asserted: the source says what `grab()` is allowed to call,
 * the clock says nothing advanced, and the two buffers say the picture did not
 * change - each with its own control, because a clause that only ever asserts
 * *this did not move* passes just as well when nothing is connected
 * (`HANDOFF.md`'s "lesson that keeps repeating"). The picture's control is a
 * **second eye**: the same lens looked somewhere else differs by some 2.3
 * million bytes, which proves the comparison can see a difference and advances
 * nothing to prove it.
 *
 * **Read off `pixels.js` rather than written down**, the way `quiesce.js` reads
 * the flag and `settlecircuit.js` the settle: the body of `grab()` is sliced out
 * of that file and the names it may not contain are a **list**, not a regex
 * literal - the trap `quiescesites.js`'s header names, where `codeOf` strips a
 * string and leaves a regex literal exactly where it is, so a pattern spelling
 * an identifier puts that identifier in this module's own code.
 *
 * One quiesce site, and it is in the class it is about: this check reads the
 * framebuffer and steps no frame until it has asked for a match with the AI
 * off, which is what its control needs. Registered from tests/index.js; nothing
 * imports main.js (Section 3.1).
 */

import { codeOf, readerProblems } from './sourcetext.js';
import { createLens, quiesce } from './pixels.js';

/** The helper whose body this reads, and where it lives. */
const LENS_FILE = 'src/tests/pixels.js';
const GRAB = 'grab';

/**
 * What `grab()` may not call, as **data and not a regex literal**: `codeOf`
 * leaves a regex literal where it is, so a pattern spelling one of these names
 * would put it in this module's code and another census would read it as a
 * call (H74 paid for that in the pose census).
 *
 * The first two are the ways a caller advances the world and the third is what
 * moves the drawn body. None of them belongs in a read of the framebuffer.
 */
const MAY_NOT_CALL = ['stepFrames', 'renderFrame', 'updateVisual', 'fixedStep'];
const ADVANCES = new RegExp(`\\b(?:${MAY_NOT_CALL.join('|')})\\(`);

/** What a line is, to the reader above, or nothing. */
const SEEN_AS = (text) => (ADVANCES.test(text) ? 'an advance' : '');
const SEES = [
  ['      h.stepFrames(1);', 'an advance'],
  ['      h.renderFrame(1 / 60);', 'an advance'],
  ['  h.shade.updateVisual(DT);', 'an advance'],
];
const IGNORES = [
  // What `grab()` really does, both lines, neither of which advances anything.
  '      h.post.render(h.scene, camera);',
  '      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);',
  // And prose naming one, which is what this file's header is made of: the
  // reader decides line-locally and a sentence about a call is not a call.
  ' * `grab()` that one day stepped a frame - or a helper that grew a `stepFrames`',
];

/** Where the eye sits for the picture, and where it moves for the control. */
const EYE_BACK = 6;
const EYE_UP = 2;
const EYE_RAISED = 9;

/** Grabs taken in a row, which is the claim: a second one is the same picture. */
const GRABS = 3;
/** The Warden has not moved, in metres and radians. */
const UNMOVED = 1e-9;
/** A different eye must differ by more than this, or the comparison is blind. */
const AN_EYE_APART = 1000;

/** Horizontal distance, because a settling body's travel is all in y (H74). */
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** A yaw difference, wrapped, so a turn through pi reads as a turn. */
const turn = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
/** How many bytes of two buffers differ. */
function differing(a, b) {
  if (a.length !== b.length) return Math.max(a.length, b.length);
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

/** Everything that must not have moved, read in one place. */
const worldNow = (h) => ({
  frame: h.clock.frame,
  wall: h.clock.wall,
  sim: h.clock.sim,
  x: h.warden.position.x,
  z: h.warden.position.z,
  yaw: h.warden.yaw,
});

/** What moved between two readings, named, or ''. */
function moved(before, after) {
  const said = [];
  for (const field of ['frame', 'wall', 'sim']) {
    if (before[field] !== after[field]) said.push(`clock.${field} ${before[field]} to ${after[field]}`);
  }
  const far = flat(after, before);
  const round = turn(after.yaw, before.yaw);
  if (far > UNMOVED) said.push(`the Warden translated ${far.toFixed(9)}m`);
  if (round > UNMOVED) said.push(`the Warden turned ${round.toFixed(9)}rad`);
  return said.join(', ');
}

/** The body of `grab()`, sliced out of the object `createLens` returns. */
function grabBody(source) {
  const at = source.indexOf(`\n    ${GRAB}() {`);
  if (at === -1) return { error: `${LENS_FILE} no longer returns a lens with a ${GRAB}() method on it, and this clause is about what that method does not do` };
  const close = source.indexOf('\n    },', at);
  if (close === -1) return { error: `${GRAB}() in ${LENS_FILE} does not close where this reader can find it, so what it calls cannot be read off the tree` };
  return { body: source.slice(at, close) };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-lens-grab-advances-neither-the-clock-nor-the-picture',
    spec: 'Section 17.1 / H74, H76',
    name: 'The lens grab() twelve quiesce sites read their frame with calls nothing that advances the world, moves neither the clock nor the Warden, and returns the same picture every time until something else changes it',
    run: async (h) => {
      const problems = [];

      // ------------------------------------------------------------------
      // 1. The reader, before anything it reports is believed: three lines
      //    that advance the world and three it must make nothing of, two of
      //    them the real body of grab() and one prose from this header.
      // ------------------------------------------------------------------
      problems.push(...readerProblems(SEEN_AS, SEES, IGNORES, codeOf));

      // ------------------------------------------------------------------
      // 2. What grab() calls, off its own source. The sites census reads the
      //    caller and never the helper, so this is the only place the
      //    helper's own promise is held.
      // ------------------------------------------------------------------
      const source = await (await fetch(`${location.origin}/${LENS_FILE}`)).text();
      const cut = grabBody(source);
      if (cut.error) return { pass: false, detail: cut.error };
      const code = codeOf(cut.body);
      if (ADVANCES.test(code)) {
        problems.push(`${GRAB}() in ${LENS_FILE} now calls one of ${MAY_NOT_CALL.join(', ')}, and twelve quiesce sites take their picture at the end of a settle on the strength of it calling none of them (H74) - the picture they report is no longer the world quiesce() returned`);
      }

      // ------------------------------------------------------------------
      // 3. And in fact, with the live match the helper leaves: three grabs
      //    in a row, nothing driven. The clock, the Warden and the picture.
      // ------------------------------------------------------------------
      const restore = quiesce(h);
      let readings;
      try {
        const lens = createLens(h, {});
        try {
          const subject = h.warden.position;
          lens.look({ x: subject.x + EYE_BACK, y: subject.y + EYE_UP, z: subject.z + EYE_BACK }, subject);
          const before = worldNow(h);
          const shots = [];
          for (let i = 0; i < GRABS; i++) shots.push(lens.grab());
          const after = worldNow(h);
          const drift = shots.slice(1).map((shot) => differing(shots[0], shot));

          // The control for the picture clause, and it advances nothing to be
          // one: the same lens looked somewhere else. Without it, "the two
          // buffers are identical" is satisfied by a comparison that has
          // stopped being able to tell two pictures apart.
          lens.look({ x: subject.x + EYE_BACK, y: subject.y + EYE_RAISED, z: subject.z + EYE_BACK }, subject);
          const elsewhere = differing(shots[0], lens.grab());

          readings = { before, after, drift, elsewhere, bytes: shots[0].length };
        } finally {
          lens.restore();
        }
      } finally {
        restore();
      }

      const stirred = moved(readings.before, readings.after);
      if (stirred) {
        problems.push(`${GRABS} ${GRAB}()s in a row moved the world: ${stirred} - twelve quiesce sites report a pixel count taken at the end of quiesce()'s settle and that count is only about that moment while this holds (H74, H76)`);
      }
      const changed = readings.drift.filter((n) => n > 0);
      if (changed.length) {
        problems.push(`${GRABS} ${GRAB}()s of a scene nothing touched returned ${changed.length} different picture(s) - ${readings.drift.map((n, i) => `grab ${i + 2}: ${n} bytes`).join(', ')} of ${readings.bytes} - so a difference taken across two grabs no longer cancels what was standing still in both`);
      }
      if (readings.elsewhere <= AN_EYE_APART) {
        problems.push(`the same lens looked ${EYE_RAISED - EYE_UP}m higher and its picture differs by only ${readings.elsewhere} bytes of ${readings.bytes}, against ${AN_EYE_APART} - the comparison above cannot tell two pictures apart, so its agreement is not evidence of anything`);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${GRAB}() calls none of ${MAY_NOT_CALL.join(', ')}, read off ${LENS_FILE}'s own ${cut.body.length}-char body; `
            + `${GRABS} in a row left clock.frame ${readings.after.frame}, wall ${readings.after.wall.toFixed(6)}, sim ${readings.after.sim.toFixed(6)} and the Warden 0.000000000m/rad where they were; `
            + `all ${GRABS} pictures identical over ${readings.bytes} bytes, and a second eye differs by ${readings.elsewhere} - so the world in the twelve one-frame sites' pictures is the world quiesce() returned (H74)`
          : problems.join('; '),
      };
    },
  });
}
