/**
 * BLACKLINE - tests/strikedrive.js
 *
 * The driver four other test modules pose a body with: `strike`, the twelve
 * states it knows, and the frame-by-frame helpers underneath it (H75).
 *
 * **Why it is its own file, and why the seam is here.** `tests/animation.js`
 * was E3's two checks **plus** this driver, and at 592 of 600 lines it had been
 * in the ceiling's crowded cluster since H72. Unlike H69 the length was not an
 * argument that could move to the thing it is about: the file held two
 * unrelated jobs, and `look.js`, `poseeye.js`, `positioncensus.js` and
 * `strikerepeat.js` all imported the second one. So the driver moved and the
 * registered checks stayed. **H56 is the worked example** of a move whose proof
 * is that nothing it drives answers differently; this one changed five import
 * lines and no behaviour, and `PROGRESS.md` has the before-and-after readings.
 *
 * **A strike is a function of its argument**, since H57 (2026-10-14): strike
 * any of the twelve twice in one run and the capsule lands in the same place
 * to 1e-9. It was not always, and the two that did not were `walk` and
 * `sprint`, which ran to *"the frame after the leg's furthest reach"* - a
 * condition on `sin(_animTime)`, so the ground covered getting there was
 * whatever the last check to walk a body left behind. Measured at **1.167m**
 * and **0.217m** on one run of the plant and **0.292m** and **0.000m** on the
 * next; H46 found it by accident when its own control caught two sprints
 * **0.975m apart**.
 *
 * **What fixed it is the order, and not a new condition.** `_animTime`, the
 * drawn gait's phase, is advanced by the ground covered inside `updateVisual`;
 * the constructor zeroes it and **`reset()` deliberately does not** - D66,
 * held by a clause of its own in `breathcensus.js`, so that a reset cannot
 * teleport a walking body's legs. That refusal is what makes a pinned strike
 * possible rather than what stands in its way: drive the body until the drawn
 * leg is furthest **forward**, `reset()` to the lane - the capsule and the
 * drawn pose snap, the phase survives - and hold the key a **measured count**
 * of frames from there. Both ends are then the argument's, because the
 * position reads no phase at all and the phase is the alignment plus a
 * deterministic speed ramp. `GAIT_STRIKE` has the counts and their readings.
 *
 * **Signed, because the pose half of the old restriction was true only up to
 * a mirror.** The old detector read `Math.abs`, so it stopped at whichever
 * half-cycle arrived first, and two strikes of a walk in one run ended exactly
 * pi apart: `legL` **-0.5626** against **+0.5626**, the same silhouette with
 * the other leg forward. A 3,000-pixel floor against 7,891-9,818px could never
 * have caught it. Pinning the parity moved every walk and sprint gallery frame
 * once, deliberately (D76; `PLAYTEST.md` says which).
 *
 * **One carried quantity is left, and it is why no check may still compare
 * two photographs of one state.** `_breathTime` is carried by the same
 * refusal and moves a silhouette by 1-5% (H33, H46). So: strike once, read
 * what you need off that one frame - which is what `poseeye.js` does, and why
 * it asks the geometry rather than comparing two pictures. `a-strike-of-a-state-puts-the-capsule-in-the-same-place-twice-except-where-the-gait-is-carried`
 * measures all twelve every run, with an empty `CARRIED` since H57, so
 * neither of these paragraphs can go stale in either direction.
 *
 * **This module is where the breath census's proxy set now lives** (H61, H75).
 * `frame` makes the `updateVisual` call and `strike` reaches it through
 * `frame`, so both are read off the tree as names that pose a body on a
 * caller's behalf - which is what puts the four importers above in that census
 * although none of them calls `updateVisual` in its own code. The set is read
 * from Resource Timing, so a helper that registers no check is still seen;
 * `breathcensus.js` names **this file** as the one that must contribute one,
 * and that line is the thing a future move of this code has to update.
 *
 * Registers nothing - it is imported by the checks that use it, not by
 * `tests/index.js`. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { SHADE_STATE } from '../entities/agent.js';
import { findGroundLedge } from './movement.js';
import { clearLane } from './lanes.js';
import { press } from './feel.js';

const S = CONFIG.shade;
const DT = CONFIG.time.fixedDt;
/**
 * Frames for a pose to settle: three blends' worth (pose.js). Exported because
 * `animation.js`'s two checks settle a pose by the same count, and two copies
 * of a blend's length is the drift this split must not introduce.
 */
export const SETTLE = 20;

/**
 * The two gait-driven strikes, by band (H57). Both numbers are functions of
 * the speed ramp and the stride, so they are the same on every map; they were
 * measured on the plant over five different incoming phases.
 *
 * `find` is how long to look for the drawn leg at its furthest reach forward,
 * counted from speed. The **signed** cycle comes round once a full period -
 * 4.2m of ground at the walk's 3.5m/s over a 2.1m stride, which is 72 frames,
 * and 5.2m at the sprint's 6.5m/s over 2.6m, which is 48 - and the drawn leg
 * lags its target by two frames, so the worst cases are 74 and 50. Measured
 * worst: **65** and **46**. The 60 this used to be given was under the
 * walk's, which is the trap in the obvious fix: `frameUntil` running out
 * reports a walk that was never struck as **skipped** and not as red.
 *
 * `frames` is the pinned count from the lane, chosen to land the drawn leg on
 * a peak - what this function promises its callers, and also where the ease
 * makes the pose insensitive to where inside a frame the alignment stopped.
 * At these counts the drawn leg read **-0.5636 rad with a spread of 0.00000**
 * over the five phases at the walk and **-0.8482 with 0.00145** at the
 * sprint, both at full speed, 2.04m and 2.48m down the lane.
 */
const GAIT_STRIKE = {
  walk: { find: 80, frames: 37 },
  sprint: { find: 56, frames: 27 },
};

/**
 * One fixed step and one drawn frame, the way the loop runs at 60Hz, for both
 * bodies. Exported since H44, which needs a frame of the real loop rather than
 * a step (which draws nothing) or a draw (which moves nothing) - the two
 * halves H43's census is about.
 */
export function frame(h) {
  h.stepFrames(1);
  h.input.clearEdges();
  h.shade.updateVisual(DT);
  h.warden.updateVisual(DT);
}

/** Frames until `until` holds (or `limit` frames), then `settle` more with it still holding. */
function frameUntil(h, until, limit, settle = 0) {
  for (let i = 0; i < limit; i++) {
    frame(h);
    if (until()) {
      for (let j = 0; j < settle && until(); j++) frame(h);
      return true;
    }
  }
  return false;
}

/**
 * Drive the Shade at a ledge from 0.8m off its face: forward held, Space
 * pressed on the fifth step (held through or released the next), then
 * frames until `state` is `mid` of the way through its move.
 */
function climb(h, spot, state, hold, mid) {
  const shade = h.shade;
  shade.reset({ position: { x: spot.x, y: CONFIG.map.groundY, z: spot.z }, yaw: spot.yaw });
  for (let i = 0; i < 3; i++) frame(h);
  h.input.clearAll();
  h.input.heldCodes.add('KeyW');
  for (let i = 0; i < 5; i++) frame(h);
  press(h, 'Space');
  frame(h);
  if (!hold) h.input.heldCodes.delete('Space');
  const through = () => shade.state === state && shade._move && shade._move.timer / shade._move.duration >= mid;
  return frameUntil(h, through, 90);
}

/**
 * What a strike says about a body that did not survive it, and `''` about one
 * that did (H72).
 *
 * **Health and the ragdoll both, because they are two halves of one answer**:
 * the health is what the rounds did and the ragdoll is what `combat:death`
 * did, and a reader given only the first cannot tell a wounded body from a
 * dead one. So a Shade with rounds in her and still standing is *shot* and a
 * Shade the combat system has handed to the ragdoll is *killed* - which
 * matters because the two fail a strike in different ways: a wounded body
 * walks and a dead one does not accelerate at all.
 *
 * `a-strike-whose-body-was-killed-reports-the-death-and-not-the-stillness`
 * drives a strike and lands a round in the middle of it, so this sentence is
 * held by a check rather than by a comment.
 */
function hurtMidStrike(shade) {
  const dead = shade.ragdolled || shade.health <= 0;
  if (!dead && shade.health >= S.health) return '';
  return dead
    ? `the Shade was killed during the strike (health ${shade.health} of ${S.health}${shade.ragdolled ? ', ragdolled' : ''})`
    : `the Shade was shot during the strike (health ${shade.health} of ${S.health})`;
}

/** The states `strike` knows, in the order the check reads them. */
export const STRIKES = ['walk', 'sprint', 'crouch', 'slide', 'rise', 'fall', 'landing', 'vault', 'mantle', 'grab', 'hang', 'pullup'];

/**
 * Drive the Shade into a named state the way a player does - from the
 * first clear lane, or the ledge the map has for it (tests/movement.js's
 * `findGroundLedge`, the controller's own probe the arbiter) - and leave
 * it there with the keys cleared: mid-stride for a walk and a sprint, part
 * way through the move for a vault, a mantle, a grab and a pull-up, on
 * the way up and on the way down for a jump, while the legs take it for
 * a landing. The frame after is the photograph's (tests/look.js).
 *
 * **Give this a match with the AI off, and do it per strike if you strike
 * more than once.** It drives a real body through a **live** match: a walk or
 * a sprint goes several metres down a lit lane, and a Warden that is hunting
 * will shoot it - four rounds and the Shade is dead, and a dead body reports
 * *"never swung a leg"* rather than anything about the gait. All four callers
 * open with `initMatch({ ai: false })` for this reason; `strikerepeat.js` was
 * the one that did not, inherited `quiesce`'s **`ai: true`** restore, and got
 * away with it for five jobs because every strike was short. H57's is fifty
 * frames longer and it stopped getting away with it. This function does not
 * do it for you on purpose - `initMatch` reseeds the rng, which is not a side
 * effect a shared driver should have.
 *
 * @returns {{ reached: boolean, why: string }} `why` says what stopped it
 */
export function strike(h, name) {
  const shade = h.shade;
  const lane = clearLane(h, 10);
  if (!lane) return { reached: false, why: 'no clear 10m lane on this map' };
  const rest = { x: lane.x, y: lane.y, z: lane.z };
  const stand = () => {
    shade.reset({ position: rest, yaw: lane.yaw });
    shade.pitch = 0;
    for (let i = 0; i < 5; i++) frame(h);
    h.input.clearAll();
  };
  /**
   * What stopped a strike - with one question asked before any of the others:
   * **was the body still alive?** Every `why` in the switch below is about what
   * the body did not *do*, and this drives a real Shade through a live match
   * where four rifle rounds kill her, so a Shade shot dead during the run-up
   * comes back as *"the walk never swung a leg (speed 0.0)"* and an afternoon
   * goes on the gait. H57 spent that afternoon; H72 is this line.
   *
   * The death is named **first**, because it is the cause and the rest is the
   * symptom, and the symptom is kept after it rather than replaced: a body that
   * died may also have failed for a second reason, and the sentence that was
   * there before this line is still the only evidence of what it was doing.
   */
  const done = (reached, why) => {
    h.input.clearAll();
    if (reached) return { reached, why: '' };
    const hurt = hurtMidStrike(shade);
    return { reached, why: hurt ? `${hurt}; ${why}` : why };
  };
  const hangMin = S.standHeight * S.hangMinHeightRatio;
  const fullReach = S.reach.standing + S.reach.jumpBonus;
  switch (name) {
    case 'walk':
    case 'sprint': {
      // The phase first, then the place (H57). To speed, then to the frame
      // after the drawn leg's furthest reach **forward** - signed, so the
      // phase is pinned mod 2pi and the same leg leads every time.
      const band = GAIT_STRIKE[name];
      stand();
      h.input.heldCodes.add('KeyW');
      if (name === 'sprint') h.input.heldCodes.add('ShiftLeft');
      for (let i = 0; i < 30; i++) frame(h);
      let last = shade.mesh.userData.parts.legL.rotation.x;
      let rising = false;
      const pinned = frameUntil(h, () => {
        const now = shade.mesh.userData.parts.legL.rotation.x;
        const peak = rising && now < last;
        rising = now > last;
        last = now;
        return peak;
      }, band.find);
      if (!pinned) return done(false, `the ${name} did not bring a leg furthest forward inside ${band.find} frames of speed, so the gait's phase is not pinned and the ground covered from here would be the last check's (speed ${shade.speed.toFixed(1)})`);
      // Back to the lane: the capsule snaps, the drawn pose snaps with it
      // (`reset` draws at wallDt 0 and `blendFactor(0)` is 1), the phase
      // survives - D66 - and the pinned count runs from a known phase at a
      // known place, so the ground covered is the argument's and not the run's.
      shade.reset({ position: rest, yaw: lane.yaw });
      shade.pitch = 0;
      for (let i = 0; i < band.frames; i++) frame(h);
      return done(shade.speed > 0.2, `the ${name} never swung a leg (speed ${shade.speed.toFixed(1)})`);
    }
    case 'crouch': {
      stand();
      h.input.heldCodes.add('ControlLeft');
      for (let i = 0; i < SETTLE + 10; i++) frame(h);
      return done(shade.crouching, `holding crouch did not crouch (state ${shade.state})`);
    }
    case 'slide': {
      stand();
      h.input.heldCodes.add('KeyW');
      h.input.heldCodes.add('ShiftLeft');
      for (let i = 0; i < 40; i++) frame(h);
      press(h, 'ControlLeft');
      const reached = frameUntil(h, () => shade.state === SHADE_STATE.SLIDE, 10, 12);
      return done(reached, `a crouch at ${shade.speed.toFixed(1)} m/s did not slide (state ${shade.state})`);
    }
    case 'rise':
    case 'fall': {
      stand();
      press(h, 'Space');
      const rose = frameUntil(h, () => shade.state === SHADE_STATE.AIR && shade.velocity.y > 0, 10, 6);
      if (name === 'rise') return done(rose, `a jump did not rise (state ${shade.state})`);
      const fell = rose && frameUntil(h, () => shade.state === SHADE_STATE.AIR && shade.velocity.y < -2, 60, 4);
      return done(fell, `the jump did not come down (state ${shade.state}, vy ${shade.velocity.y.toFixed(1)})`);
    }
    case 'landing': {
      shade.reset({ position: { x: rest.x, y: rest.y + S.landing.hardFall + 1, z: rest.z }, yaw: lane.yaw });
      shade.pitch = 0;
      h.input.clearAll();
      const reached = frameUntil(h, () => shade.state === SHADE_STATE.GROUND && shade._landRecovery > 0, 240, 3);
      return done(reached, `a ${(S.landing.hardFall + 1).toFixed(1)}m drop did not land hard (state ${shade.state}, feet ${shade.feetY.toFixed(2)})`);
    }
    case 'vault': {
      const spot = findGroundLedge(h, S.vaultMinHeight + 0.1, S.reach.vaultTop);
      if (!spot) return done(false, 'no vault-height ground ledge was found');
      return done(climb(h, spot, SHADE_STATE.VAULT, true, 0.4), `a press at ${spot.box.tag || 'the ledge'} did not reach the middle of a vault (state ${shade.state})`);
    }
    case 'mantle': {
      const spot = findGroundLedge(h, S.reach.vaultTop + 0.1, Math.min(hangMin - 0.05, S.reach.standing));
      if (!spot) return done(false, 'no mantle-height ground ledge under the hang height was found');
      return done(climb(h, spot, SHADE_STATE.MANTLE, true, 0.4), `holding Space at ${spot.box.tag || 'the ledge'} did not reach the middle of a mantle (state ${shade.state})`);
    }
    case 'grab':
    case 'hang':
    case 'pullup': {
      const spot = findGroundLedge(h, hangMin, fullReach, { hangable: true });
      if (!spot) return done(false, 'no hangable ground-level ledge was found');
      const tag = spot.box.tag || 'the ledge';
      const grabbed = climb(h, spot, SHADE_STATE.GRAB, false, 0.5);
      if (name === 'grab') return done(grabbed, `a tap at ${tag} did not reach the middle of a grab (state ${shade.state})`);
      h.input.clearAll();
      const hung = grabbed && frameUntil(h, () => shade.state === SHADE_STATE.HANG, 30, SETTLE);
      if (name === 'hang') return done(hung, `the grab at ${tag} did not end hanging (state ${shade.state})`);
      if (!hung) return done(false, `the grab at ${tag} did not end hanging (state ${shade.state})`);
      press(h, 'Space');
      frame(h);
      h.input.heldCodes.delete('Space');
      const half = () => shade.state === SHADE_STATE.PULLUP && shade._move && shade._move.timer / shade._move.duration >= 0.5;
      return done(frameUntil(h, half, 60), `Space from the hang at ${tag} did not reach the middle of a pull-up (state ${shade.state})`);
    }
    default:
      return done(false, `no such state as "${name}" to strike; one of ${STRIKES.join(', ')}`);
  }
}
