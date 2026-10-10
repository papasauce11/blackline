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
 * **It drives whole frames**, which is the whole point and the thing H43's
 * census exists to keep straight: the harness's `stepFrames()` advances the
 * simulation and draws nothing, so a grab driven with it leaves the drawn body
 * exactly where it was; a draw with no step moves the body and not the game.
 * Only a real frame - one step, one draw, both bodies - is what a player sees,
 * and that is `frame()` in `tests/animation.js`, exported for this.
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
import { frame as wholeFrame } from './animation.js';
import { findGroundLedge } from './movement.js';
import { press } from './feel.js';
import { photographHere } from './look.js';
import { chaseGap } from './positionreads.js';

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
 * the capsule's feet - at the frames `PLAYTEST.md` and D72 quote.
 *
 * **The queue's premise was wrong and this is the correction.** H44 was
 * written expecting a metre of displacement closing: "0.80m one frame in,
 * 0.20m at a tenth of a second". That is what an *instantaneous* lift looks
 * like, which is how H40 measured it - `_smoothPosition` moved a metre by hand
 * and then drawn. A real grab does not teleport the capsule. It carries it up
 * over the move's own duration, so the drawn body falls progressively further
 * behind while the climb is happening and only then catches up: the drop
 * **builds** from 0.16m at frame 1 to a peak of 0.42-0.46m at frame 7, and is
 * back under 0.15m by frame 15. Measured on both maps, which differ only by
 * their lips: the plant lifts 0.90m and peaks at 0.46m, the yard lifts 0.81m
 * and peaks at 0.42m.
 *
 * Asserted **absolutely**, with a band, and not as a fraction of anything the
 * smoothing derives (D70): a clause that re-derives its bar from the constant
 * it guards is satisfied by any constant at all, and the whole value of this
 * table is that it is a set of numbers a human can be told and then look at.
 * The band is 0.08m, which covers the two maps' 0.04m of difference and still
 * reds on a smoothing changed by anything like the factor D72 recommends.
 */
const PROFILE = [
  { frame: 1, drop: 0.16 },
  { frame: 4, drop: 0.345 },
  { frame: 7, drop: 0.44 },
  { frame: 11, drop: 0.26 },
  { frame: 15, drop: 0.14 },
];
const PROFILE_BAND = 0.08;

/**
 * The frame the drop peaks at, which is the shape rather than the size: a
 * profile that peaked at frame 1 would be the instantaneous displacement H44
 * expected, and one that never peaked would be a body still climbing. Pinned
 * at 7 on both maps, with two frames either side for a lip that moves.
 */
const PEAK_FRAME = 7;
const PEAK_FRAME_BAND = 2;

/**
 * How much of the peak must have closed by the last frame of the slide, and
 * how much of it must have built after the first. Measured: the plant runs
 * 0.16 to 0.46 to 0.15, so each end is a third of the peak - 0.6 asks only
 * that the shape is a rise and a fall rather than a plateau.
 */
const SHAPE = 0.6;

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

    // The run-up and the tap, as tests/animation.js's `climb` does it, except
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

      for (const want of PROFILE) {
        const drop = dropAt(run.slide, want.frame);
        if (drop === null) { problems.push(`the slide has no frame ${want.frame}`); continue; }
        if (Math.abs(drop - want.drop) > PROFILE_BAND) {
          problems.push(`at frame ${want.frame} the drawn body is ${drop.toFixed(3)}m under the capsule and this profile was measured at ${want.drop}m; PLAYTEST.md and D72 quote these numbers to a human, so they are re-measured rather than widened`);
        }
      }
      // And the shape, not only the four samples: a slide that is not closing
      // is not a slide.

      // And the shape, which is what the queue got wrong and what a reader of
      // PLAYTEST.md is being told: the lag BUILDS while the capsule climbs and
      // closes after it stops, so the peak is in the middle. A profile that
      // peaked at the first frame would be the instantaneous displacement H44
      // expected, and the four pinned sizes above would pass a plateau.
      const peak = run.slide.reduce((worst, e) => (e.drop > worst.drop ? e : worst), run.slide[0]);
      if (Math.abs(peak.frame - PEAK_FRAME) > PEAK_FRAME_BAND) {
        problems.push(`the drop peaks at frame ${peak.frame} and this profile was measured peaking at ${PEAK_FRAME}; the lag builds while the capsule climbs, so a peak at either end is a different mechanism and the table wants re-measuring`);
      }
      const first = dropAt(run.slide, 1);
      const last = dropAt(run.slide, SLIDE_FRAMES);
      if (!(first < peak.drop * SHAPE)) {
        problems.push(`the drop starts at ${first.toFixed(3)}m of a ${peak.drop.toFixed(3)}m peak; it is not building`);
      }
      if (!(last < peak.drop * SHAPE)) {
        problems.push(`the drop is still ${last.toFixed(3)}m of a ${peak.drop.toFixed(3)}m peak at frame ${SLIDE_FRAMES}; it is not closing`);
      }
      readings.push(`lift ${run.lift.toFixed(2)}m, peak ${peak.drop.toFixed(2)}m at ${peak.frame}f, drop ${run.slide.map((e) => `${e.frame}f ${e.drop.toFixed(2)}`).join(' ')}`);

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
        const code = (await response.text()).replace(/^[\t ]*(\/\/|\/\*|\*).*$/gm, '');
        for (const asked of [/grabSlide\(/, /SLIDE_FRAMES/, /slide/]) {
          if (!asked.test(code)) {
            problems.push(`scripts/shot.mjs does not mention ${asked} in code, so the frames PLAYTEST.md quotes cannot be produced`);
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
