/**
 * BLACKLINE - tests/grabslide.js
 *
 * The quarter second where the Shade rises into a hang she is already in
 * (H44). What this module is for is a *look*, so the numbers are the
 * deliverable and the judgement is Josh's: D72, and `PLAYTEST.md`'s eyes list.
 *
 * The drawn body eases toward the capsule at `positionSmoothing()`, 0.1423 of
 * the gap a frame at 60Hz. That smoothing exists for a good reason and does
 * its job: the simulation is a fixed sixty steps a second, and a body drawn
 * exactly where the step left it reads as a stutter on a 120Hz or 144Hz
 * screen. It is sized for *jitter*, a fraction of a step's travel.
 *
 * A grab is not jitter. It lifts the capsule 0.81m to 0.90m, and the ease
 * spends 45 frames closing that - so for about a quarter of a second the drawn
 * body trails a climb the simulation has already made.
 *
 * **The queue expected the wrong shape and the measurement corrects it.** H44
 * was written from H40's numbers - "0.80m one frame in, 0.20m at a tenth of a
 * second" - which are what an *instantaneous* metre of displacement does,
 * because that is how H40 produced it. A real grab carries the capsule over
 * its move, so the drawn body falls progressively further behind while the
 * climb is happening and only then catches up: **0.16m at frame 1, a peak of
 * 0.42-0.46m at frame 7, under 0.15m by frame 15**, and 1.5mm at 45. The
 * complaint is not a body starting low and rising; it is a body trailing its
 * own climb by up to a quarter of its own height, in the middle of it.
 *
 * And the thing that decides whether a player can see it is not in this
 * module: the third-person rig is derived from `_smoothPosition` too, so the
 * camera carries the **same** lag and the body holds its place on screen. What
 * is drawn out of place is the body against the *world* - the gloves the pose
 * puts on the lip are up to 0.46m under the lip while the slide runs. D72 is
 * that question, with these numbers in it.
 *
 * **H48 closed it (D72, option 3), and this module is what measures that it
 * stayed closed.** While a timed move owns the body - `_move`, with its own
 * timer and duration - the drawn body follows the capsule with no smoothing,
 * and the drop above is **0.000m at every frame of the move on both maps**.
 * What is left is the hand-over: the grab ends at frame 11 and the hang's own
 * settle is a 2.5cm step the capsule takes *down*, which the smoothing (back on,
 * since nothing owns the body) eases in, so the drawn feet are 0.026m **above**
 * the capsule's there and 0.013m at frame 15. The figures that follow are the
 * ones from before, kept where they are measured against in `PLAYTEST.md`.
 *
 * **It drives whole frames**, which is the whole point and the thing H43's
 * census exists to keep straight: the harness's `stepFrames()` advances the
 * simulation and draws nothing, so a grab driven with it leaves the drawn body
 * exactly where it was; a draw with no step moves the body and not the game.
 * Only a real frame - one step, one draw, both bodies - is what a player sees,
 * and that is `frame()` in `tests/strikedrive.js`, exported for this (H75).
 *
 * `grabSlide()` is the instrument and `scripts/shot.mjs --slide` is the
 * viewer: one PNG a frame through the first fifteen, written where Josh can
 * look at them, with the measured drop printed beside each. The check below
 * pins the profile so that a job which shortens the smoothing - which is what
 * D72 recommends, and what nobody should do until he has looked - turns this
 * red and sends the table back to be measured rather than letting
 * `PLAYTEST.md` quote numbers the game no longer produces.
 *
 * Registered from tests/index.js after tests/hang.js, which owns the other
 * end of this geometry. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { positionSmoothing } from '../entities/pose.js';
import { SHADE_STATE } from '../entities/agent.js';
import { quiesce } from './pixels.js';
import { frame as wholeFrame, strike } from './strikedrive.js';
import { GLOVE_ON_LIP } from './hang.js';
import { findGroundLedge } from './climbpress.js';
import { press } from './feel.js';
import { photographHere } from './look.js';
import { chaseGap } from './positionreads.js';
import { AS_WORDING, uncommented } from './sourcetext.js';

const S = CONFIG.shade;

const SELF = 'a-grab-slides-the-drawn-body-up-into-the-hang-by-a-measured-amount';

/** Frames of the slide `npm run shot -- --slide` photographs, and this check measures. */
export const SLIDE_FRAMES = 15;

/** Frames of standing before the walk, so the reset's snap is long closed. */
const SETTLE = 20;

/** Steps of KeyW before Space, and frames to wait for the grab to begin. */
const RUN_UP = 5;
const WAIT_FOR_GRAB = 20;

/**
 * The measured profile, in metres of drop - how far the drawn feet are below
 * the capsule's feet - at the frames `PLAYTEST.md` and D72 quote. **Signed**:
 * a negative drop is the drawn body *above* the capsule.
 *
 * **Re-measured by H48.** It was 0.16, 0.345, 0.44, 0.26, 0.14 - a lag that
 * built to 0.46m (plant) and 0.42m (yard) at frame 7 and closed by 15, because
 * the drawn body chased a capsule the grab was carrying up 0.90m and 0.81m.
 * With no smoothing while the move owns the body it is **0.000 at every frame
 * of the move**, frames 1 to 10, on both maps; the hang begins at frame 11 and
 * there the drawn body is 0.025m (plant) and 0.026m (yard) *above* the capsule
 * and easing down, 0.013m and 0.014m at frame 15. Frame 4 is the middle of the
 * move and 7 was the old peak, so they stay in the table as the samples that
 * were worst.
 *
 * Asserted **absolutely**, with a band, and not as a fraction of anything the
 * smoothing derives (D70): a clause that re-derives its bar from the constant
 * it guards is satisfied by any constant at all. The band is **0.01m**, down
 * from 0.08m - the old one covered a 0.04m difference between the maps and a
 * peak of half a metre; these numbers differ between the maps by 0.001m and
 * the band is ten of those.
 */
const PROFILE = [
  { frame: 1, drop: 0 },
  { frame: 4, drop: 0 },
  { frame: 7, drop: 0 },
  { frame: 11, drop: -0.025 },
  { frame: 15, drop: -0.013 },
];
const PROFILE_BAND = 0.01;

/**
 * **The band H48 exists to hold:** the drop under this at every frame of the
 * first fifteen, the 0.15m `tests/hang.js` calls "on the lip" once settled.
 * Before H48 it was exceeded from frame 5 to frame 14 on the plant; now the
 * worst of the fifteen is 0.026m. Read as an absolute value, so a body drawn
 * far *above* the capsule is as red as one drawn far below.
 */
const DROP_BAND = GLOVE_ON_LIP;

/**
 * While the grab owns the body the drawn feet are the capsule's: measured
 * 0.000m on both maps, so a millimetre is the arithmetic and nothing else.
 * This is the clause the one-line break reds hardest - a restored smoothing
 * leaves 0.16m at frame 1 - and it needs `MOVE_FRAMES` of them to be about a
 * move at all (measured 10, frames 1 to 10).
 */
const IN_MOVE_DROP = 0.001;
const MOVE_FRAMES = 5;

/**
 * The frame the largest drop falls on, which is the shape rather than the
 * size: it used to be 7, the middle of the climb, and is now the **hand-over**
 * - the first frame of the hang, 11 on both maps - because that is the one
 * place left where the body is not on the capsule. One frame either side for a
 * lip that moves the move's length. `PEAK_CEILING` is its size, measured
 * 0.026m, which is the 0.05m it may not pass: 3x the measurement, a fraction
 * of the band, and a smoothing that had come back reads 0.16 at frame 1.
 */
const PEAK_FRAME = 11;
const PEAK_FRAME_BAND = 1;
const PEAK_CEILING = 0.05;

/**
 * What the smoothing still has to do outside a move, which is the half of
 * D72's option 3 that must not be lost: a Shade walking at 3.5m/s on a 144Hz
 * wall clock, the simulation still stepping at 60. Unsmoothed the drawn body
 * jumps the whole step - **0.058m** - on the first draw after each step and
 * sits still on the others; smoothed it moves a little on every draw. Measured
 * on both maps over 129 draws: the largest single-draw jump is **0.026m**
 * (0.45 of a step) and the drawn body trails the capsule by 0.34m to 0.39m.
 * `JUMP_SHARE` is 0.6 of a step, and `LAG_FLOOR` 0.1m, which an unsmoothed
 * body (0.000m) cannot reach.
 */
const WALL_HZ = 144;
const WALK_WARM = 70;
const WALK_TICKS = 200;
const JUMP_SHARE = 0.6;
const LAG_FLOOR = 0.1;

/**
 * The controls the profile needs, or it is a table about a body that never
 * moved. `LIFT_FLOOR` is what the capsule must actually rise in the grab -
 * measured at 0.83m to 0.93m, so half a metre is well clear and would still
 * catch a grab that stopped lifting. `SETTLED` is the drop this calls arrived,
 * read at 45 frames rather than 15.
 */
const LIFT_FLOOR = 0.5;
const SETTLED = 0.01;

/** The hang band, from the config rather than from a copy of it (hang.js's rule). */
function hangBand() {
  return {
    min: S.standHeight * S.hangMinHeightRatio,
    max: S.reach.standing + S.reach.jumpBonus,
  };
}

/**
 * Drive the Shade at a hangable ground ledge the way a player does - KeyW
 * held, Space tapped - in **whole frames**, and from the frame the grab begins
 * report what the player is looking at: the state, how far the drawn body is
 * from the capsule, and how far below the capsule's feet the drawn feet are.
 *
 * `photograph` adds a PNG per frame from the first eye in open air, which is
 * what `scripts/shot.mjs --slide` writes out. It costs a lens grab a frame, so
 * the check leaves it off.
 *
 * The match is left as `quiesce` leaves it, exactly as `photographPose` does.
 *
 * @returns {{ reached: boolean, why: string, lift: number, slide: Array }}
 *   `lift` is how far the capsule's feet rose over the whole grab, which is
 *   the control every number in `slide` is read against
 */
export function grabSlide(h, { frames = SLIDE_FRAMES, photograph = false } = {}) {
  const shade = h.shade;
  const restore = quiesce(h);
  const empty = (why) => { h.input.clearAll(); restore(); return { reached: false, why, lift: 0, slide: [] }; };
  try {
    h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
    const band = hangBand();
    const spot = findGroundLedge(h, band.min, band.max, { hangable: true });
    if (!spot) return empty('no hangable ground-level ledge was found');

    // 0.8m off the face, standing, with the reset's snap long closed - so the
    // first number below is the grab's own lift and not a leftover.
    shade.reset({ position: { x: spot.x, y: CONFIG.map.groundY, z: spot.z }, yaw: spot.yaw });
    shade.pitch = 0;
    h.input.clearAll();
    for (let i = 0; i < SETTLE; i++) wholeFrame(h);
    if (chaseGap(shade) > SETTLED) {
      return empty(`the body had not settled before the run-up (${chaseGap(shade).toFixed(4)}m)`);
    }

    // The run-up and the tap, as tests/strikedrive.js's `climb` does it, except
    // that every one of these is a real frame rather than a step.
    h.input.heldCodes.add('KeyW');
    for (let i = 0; i < RUN_UP; i++) wholeFrame(h);
    press(h, 'Space');
    wholeFrame(h);
    h.input.heldCodes.delete('Space');

    // The frame the grab begins is frame 1, and the feet it lifts from are
    // read here, before it has lifted them.
    let began = shade.state === SHADE_STATE.GRAB;
    const footFrom = shade.position.y - shade.half.y;
    for (let i = 0; i < WAIT_FOR_GRAB && !began; i++) {
      wholeFrame(h);
      began = shade.state === SHADE_STATE.GRAB;
    }
    if (!began) return empty(`a tap at ${spot.box.tag || 'the ledge'} did not start a grab (state ${shade.state})`);
    h.input.clearAll();

    const slide = [];
    let lift = 0;
    for (let n = 1; n <= frames; n++) {
      wholeFrame(h);
      const capsuleFeet = shade.position.y - shade.half.y;
      const drawnFeet = shade.mesh.position.y;
      lift = Math.max(lift, capsuleFeet - footFrom);
      const record = {
        frame: n,
        state: shade.state,
        gap: chaseGap(shade),
        drop: capsuleFeet - drawnFeet,
      };
      if (photograph) Object.assign(record, photographHere(h, shade));
      slide.push(record);
    }
    h.input.clearAll();
    restore();
    return { reached: true, why: '', lift, slide };
  } catch (err) {
    return empty(`grabSlide threw: ${err.message}`);
  }
}

/** The drop at a frame of a measured slide, or null when the slide is shorter. */
function dropAt(slide, frame) {
  const record = slide.find((entry) => entry.frame === frame);
  return record ? record.drop : null;
}

/**
 * A 60Hz step on a 144Hz wall clock, outside any move: the Shade struck into a
 * walk, KeyW held, one draw every 1/144s and a step each time 1/60s has
 * accumulated. After the warm-up it reports the largest single-draw travel of
 * the drawn feet, the capsule's largest step, how far the drawn body trails it,
 * and the number of draws a timed move owned the body - which must be none, or
 * this is a reading about a climb.
 */
export function jitterWalk(h) {
  const shade = h.shade;
  const restore = quiesce(h);
  const empty = (why) => { h.input.clearAll(); restore(); return { reached: false, why }; };
  try {
    h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
    const struck = strike(h, 'walk');
    if (!struck.reached) return empty(`no walk could be struck: ${struck.why}`);
    h.input.heldCodes.add('KeyW');
    const wall = 1 / WALL_HZ;
    const step = 1 / 60;
    let owed = 0;
    let before = null;
    let last = shade.position.clone();
    const out = { reached: true, why: '', maxJump: 0, maxStep: 0, minLag: Infinity, moving: 0, draws: 0, speed: 0 };
    for (let tick = 0; tick < WALK_TICKS; tick++) {
      owed += wall;
      while (owed >= step) {
        owed -= step;
        h.stepFrames(1);
        h.input.clearEdges();
        if (tick > WALK_WARM) out.maxStep = Math.max(out.maxStep, Math.hypot(shade.position.x - last.x, shade.position.z - last.z));
        last = shade.position.clone();
      }
      shade.updateVisual(wall);
      const at = { x: shade.mesh.position.x, z: shade.mesh.position.z };
      if (shade._move) out.moving++;
      if (before && tick > WALK_WARM) {
        out.maxJump = Math.max(out.maxJump, Math.hypot(at.x - before.x, at.z - before.z));
        out.minLag = Math.min(out.minLag, chaseGap(shade));
        out.draws++;
      }
      before = at;
    }
    out.speed = shade.speed;
    h.input.clearAll();
    restore();
    return out;
  } catch (err) {
    return empty(`jitterWalk threw: ${err.message}`);
  }
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: SELF,
    spec: 'Section 4 / H40, H43, H44',
    name: 'A grab lifts the capsule about a metre and the drawn body follows it over a measured quarter of a second, the profile PLAYTEST.md quotes and D72 asks about',
    run: async (h) => {
      const problems = [];
      const readings = [];

      // ------------------------------------------------------------------
      // 1. The profile itself, driven in whole frames the way a player gets
      //    there, and measured from the frame the grab begins.
      // ------------------------------------------------------------------
      const run = grabSlide(h);
      if (!run.reached) return { pass: false, detail: run.why };

      // The control first: a grab that did not lift the capsule makes every
      // number below a reading about a body standing still, and the clause
      // would pass. H43's census is full of this shape.
      if (run.lift < LIFT_FLOOR) {
        problems.push(`the grab lifted the capsule ${run.lift.toFixed(3)}m, under the ${LIFT_FLOOR}m this profile was measured against; every drop below is about a body that did not move`);
      }

      // The band H48 exists for, at every frame and not at a sample of them.
      const worstDrop = run.slide.reduce((worst, e) => (Math.abs(e.drop) > Math.abs(worst.drop) ? e : worst), run.slide[0]);
      for (const e of run.slide) {
        if (Math.abs(e.drop) >= DROP_BAND) {
          problems.push(`at frame ${e.frame} (${e.state}) the drawn feet are ${e.drop.toFixed(3)}m from the capsule's, over the ${DROP_BAND}m a hand is allowed to be off the lip; the smoothing is trailing a climb a timed move already carries`);
          break;
        }
      }
      // And while the move owns the body they are the capsule's feet, which is
      // what no smoothing means; counted, so that it is about a move.
      const inMove = run.slide.filter((e) => e.state === SHADE_STATE.GRAB);
      if (inMove.length < MOVE_FRAMES) {
        problems.push(`only ${inMove.length} of the ${SLIDE_FRAMES} frames were in the grab, under the ${MOVE_FRAMES} this clause is measured over`);
      }
      const offTheCapsule = inMove.find((e) => Math.abs(e.drop) > IN_MOVE_DROP);
      if (offTheCapsule) {
        problems.push(`frame ${offTheCapsule.frame} is in the grab and the drawn feet are ${offTheCapsule.drop.toFixed(3)}m from the capsule's; a timed move owns the body and it is drawn where it is, with no smoothing (D72, H48)`);
      }

      for (const want of PROFILE) {
        const drop = dropAt(run.slide, want.frame);
        if (drop === null) { problems.push(`the slide has no frame ${want.frame}`); continue; }
        if (Math.abs(drop - want.drop) > PROFILE_BAND) {
          problems.push(`at frame ${want.frame} the drawn body is ${drop.toFixed(3)}m under the capsule and this profile was measured at ${want.drop}m; PLAYTEST.md and D72 quote these numbers to a human, so they are re-measured rather than widened`);
        }
      }

      // And the shape: the one place left where the body is not on the
      // capsule is the hand-over, so that is where the largest drop falls.
      if (Math.abs(worstDrop.frame - PEAK_FRAME) > PEAK_FRAME_BAND) {
        problems.push(`the largest drop is at frame ${worstDrop.frame} and this profile was measured with it at ${PEAK_FRAME}, the first frame of the hang; a peak inside the move is the lag H48 took out`);
      }
      if (Math.abs(worstDrop.drop) > PEAK_CEILING) {
        problems.push(`the largest drop is ${worstDrop.drop.toFixed(3)}m, over the ${PEAK_CEILING}m this was measured under`);
      }
      readings.push(`lift ${run.lift.toFixed(2)}m, worst ${worstDrop.drop.toFixed(3)}m at ${worstDrop.frame}f, drop ${run.slide.map((e) => `${e.frame}f ${e.drop.toFixed(3)}`).join(' ')}`);

      // ------------------------------------------------------------------
      // 2. It does arrive, which is the other half of a look question: the
      //    complaint is a quarter of a second and not a body permanently low.
      //    Read at the chase's own settle rather than at a copy of 45.
      // ------------------------------------------------------------------
      const settleFrames = Math.ceil(Math.log(0.001) / Math.log(1 - positionSmoothing(1 / 60)));
      const long = grabSlide(h, { frames: settleFrames });
      if (!long.reached) problems.push(`the second run did not grab: ${long.why}`);
      else {
        const arrived = dropAt(long.slide, settleFrames);
        if (!(Math.abs(arrived) <= SETTLED)) {
          problems.push(`${settleFrames} frames after the grab the drawn body is still ${arrived.toFixed(4)}m out, over the ${SETTLED}m this calls arrived`);
        }
        readings.push(`arrived ${arrived.toFixed(4)}m at ${settleFrames}f`);
      }

      // ------------------------------------------------------------------
      // 2b. Outside a move the smoothing is untouched (H48): a walk at a
      //     60Hz step on a 144Hz clock still has the jitter hidden. Without
      //     it the drawn body would jump a whole step on one draw in 2.4.
      // ------------------------------------------------------------------
      const walk = jitterWalk(h);
      if (!walk.reached) problems.push(`the walk did not start: ${walk.why}`);
      else {
        if (walk.moving > 0) problems.push(`a timed move owned the body for ${walk.moving} draws of a walk; this reading is about a climb`);
        if (walk.speed < 3) problems.push(`the walk had slowed to ${walk.speed.toFixed(2)}m/s, so the step it measures is not a walking step`);
        if (!(walk.maxJump < walk.maxStep * JUMP_SHARE)) {
          problems.push(`outside a move a ${WALL_HZ}Hz draw of a 60Hz walk moved the drawn body ${walk.maxJump.toFixed(3)}m, against ${walk.maxStep.toFixed(3)}m for the capsule's step; over ${JUMP_SHARE} of a step is the jitter drawn, not hidden`);
        }
        if (!(walk.minLag > LAG_FLOOR)) {
          problems.push(`outside a move the drawn body trailed the capsule by only ${walk.minLag.toFixed(3)}m while walking, under the ${LAG_FLOOR}m an eased body carries (measured 0.34m); it is following the capsule directly`);
        }
        readings.push(`walk at ${WALL_HZ}Hz: jump ${walk.maxJump.toFixed(3)}m of a ${walk.maxStep.toFixed(3)}m step, trailing ${walk.minLag.toFixed(2)}m`);
      }

      // ------------------------------------------------------------------
      // 3. And the frames PLAYTEST.md sends Josh to look at really exist:
      //    the viewer asks this module for them by name, and asks for the
      //    count this module owns rather than a copy of fifteen. Read out of
      //    `shot.mjs`'s own source, the way benchlist.js reads bench.mjs's,
      //    with its comment lines out first - an explanation is not an ask
      //    (H41), and H43 was bitten by the other half of that.
      // ------------------------------------------------------------------
      const response = await fetch(`${location.origin}/scripts/shot.mjs`);
      if (!response.ok) {
        problems.push(`scripts/shot.mjs: ${response.status}; it is the one viewer PLAYTEST.md sends a human to`);
      } else {
        const said = uncommented(await response.text());
        for (const asked of [/grabSlide\(/, /SLIDE_FRAMES/, /slide/]) {
          if (!asked.test(said)) {
            problems.push(`scripts/shot.mjs does not mention ${asked} ${AS_WORDING}, so the frames PLAYTEST.md quotes cannot be produced`);
          }
        }
      }

      // ------------------------------------------------------------------
      // 4. The viewer's frames carry a picture, which is what a look question
      //    needs. One frame of it, because a lens grab is not free.
      // ------------------------------------------------------------------
      const shot = grabSlide(h, { frames: 1, photograph: true });
      if (!shot.reached) problems.push(`the photographed run did not grab: ${shot.why}`);
      else {
        const first = shot.slide[0];
        if (!first.eye) problems.push(`no eye in open air had sight of the grabbing body (state ${first.state})`);
        else if (!first.dataUrl || !first.dataUrl.startsWith('data:image/png;base64,') || first.dataUrl.length < 1000) {
          problems.push('the slide\'s frame is not a PNG');
        } else {
          readings.push(`frame 1 drawn from the ${first.eye} eye, ${first.covered}px of body`);
        }
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${PROFILE.length} pinned frames of ${SLIDE_FRAMES}; ${readings.join('; ')}`
          : problems.join('; '),
      };
    },
  });
}
