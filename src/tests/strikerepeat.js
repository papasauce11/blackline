/**
 * BLACKLINE - tests/strikerepeat.js
 *
 * AUTO suite (H52): which of the twelve states `strike()` puts in the same
 * place twice, and the one carried quantity that decides it.
 *
 * **What H46 found by accident.** It wanted a state photographed twice - once
 * as shipped, once with the position chase settled - and added a control that
 * the two frames were of the same moment. The control failed: the two `sprint`
 * photographs were of capsules **0.975m apart**. Nothing was wrong with the
 * photographs; the two strikes had simply put the body in two places, so a
 * comparison of two photographs was never going to answer anything. H46
 * abandoned that instrument for a geometric one and left this.
 *
 * **The carried quantity is `_animTime`, the drawn gait's phase**, and it is
 * carried **on purpose**. It is advanced inside `updateVisual` by the ground
 * covered (`speed * wallDt * PI / stride`), it is zeroed in the constructor,
 * and `reset()` deliberately does **not** touch it - D66, with
 * `every-check-that-poses-a-body-declares-what-the-breath-and-the-gait-do-to-it`
 * holding that refusal in a clause of its own, driven and measured so that
 * "reset did not move it" is not `0 === 0`. Its sibling `strideDistance`, the
 * footstep accumulator, *is* zeroed, which is what makes this look like an
 * oversight and it is not: the two are the same quantity in two currencies,
 * and D66 keeps the drawn one so that a reset does not teleport a walking
 * body's legs.
 *
 * **So the two facts together are the restriction.** `strike`'s walk and
 * sprint cases run to *"the frame after the leg's furthest reach"*, which is a
 * condition on `sin(_animTime)`; the phase that condition is met at is
 * whatever the previous driving left, and the ground the body covers getting
 * there is therefore not a function of the argument. **A strike of a moving
 * state is reproducible in its pose and not in its position.** That is written
 * into `animation.js`'s header where the next job will read it, and the clause
 * below is the half a comment cannot do: it says **which** states it applies
 * to, measured, rather than leaving a reader to guess that a vault is as
 * affected as a sprint. It is not - and neither is the slide, which was
 * declared on the argument and measured out of the set.
 *
 * **What this check is for, concretely.** Nothing is wrong today - no shipped
 * check strikes a state twice, which is why H46's control was the first to
 * notice. What this stops is the next check that would: a reader who needs two
 * strikes of one state finds here, in numbers, that ten of the twelve agree
 * to the floating-point floor and two do not, and that the two are the ones
 * whose termination reads the gait.
 *
 * **Why `CARRIED` is a declared set and not a measurement.** The same reason
 * `poseeye.js` declares its three state-map pairs: a census that reports
 * whatever it finds reports nothing, because there is no answer it could give
 * that would be wrong - and this set has already been wrong once, in the
 * direction a declared set catches and a reported one cannot. Declared, it is red when a state joins the set (a new
 * strike has grown a dependence on something carried) and red when one leaves
 * it (the restriction has been fixed and the header is now a lie) - and H57 is
 * the job that would make it leave.
 *
 * **The spread is reported and never asserted, and that was measured too.**
 * How far apart two strikes of a sprint land depends on the phase the run
 * happened to be at, which depends on every check before this one. Two runs
 * of the plant inside one pass read **walk 1.167m / sprint 0.217m** and then
 * **walk 0.292m / sprint 0.000m** - so a clause that reds when a declared
 * state reproduces would have reddened a correct build on the second run,
 * and a clause that asserts a distance would be asserting the registration
 * order (D71's shape, one more time). The *sign* of it is the finding and the
 * size of it is this morning's. What holds the set stale-proof instead is
 * `TERMINATES_ON_THE_DRAWN_LEG`, read from `animation.js`'s source.
 *
 * Registered from tests/index.js after poseeye.js, which is the check that
 * found this: both drive `strike()` and nothing here draws a pixel. Nothing
 * imports main.js (Section 3.1).
 */

import { strike, STRIKES } from './animation.js';

/**
 * The states whose strike is not a function of its argument, with what the
 * termination reads. Every other state in `STRIKES` must put the capsule in
 * the same place twice.
 *
 * Both are the run-to-a-leg cases, and the reason is the same for each: the
 * case runs until the drawn leg turns round, so the body walks until
 * `sin(_animTime)` does something, and `_animTime` came in from the last check
 * that walked a body.
 *
 * **Two kinds of state a reader would expect here are not**, and measuring was
 * the only way to know. The four **climbs** are driven five frames of held
 * forward from a probed ledge and then a timed move, so their position is a
 * function of the ledge and the ledge is a function of the map. And the
 * **slide** - which looks like the worst case, being a sprint with a crouch
 * pressed into it - presses that crouch after a *fixed* forty frames and runs
 * to the SLIDE state, reading no phase at all: measured at exactly 0.000m on
 * the plant while the walk was 1.167m and the sprint 0.217m. It was declared
 * here on the strength of the argument and the first subset run took it out
 * again, which is the whole reason this set is measured every run rather than
 * reasoned about once.
 */
const CARRIED = {
  walk: 'runs to the frame after the drawn leg\'s furthest reach, which is a condition on sin(_animTime)',
  sprint: 'the same condition as the walk, at sprint speed, so a frame of it is 0.1m of ground',
};

/** Two capsule positions are the same place within this, which is the floating-point floor and not a tolerance. */
const SAME_PLACE = 1e-9;

/** How far apart two capsules are, in metres. */
const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/**
 * The expression that makes the walk and the sprint carry: the frame after the
 * drawn leg stops reaching further. It is `strike`'s own line, read from
 * source, because the set above cannot be held stale-proof by measurement -
 * two strikes agreeing on a given morning is the gait's phase aligning, not
 * the restriction being gone.
 */
const TERMINATES_ON_THE_DRAWN_LEG = /const peak = rising && now < last;/;

/** Read a module from the origin the way the other censuses do. */
async function text(origin, rel) {
  const response = await fetch(`${origin}${rel}`);
  if (!response.ok) return { error: `${rel}: ${response.status}` };
  return { body: await response.text() };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-strike-of-a-state-puts-the-capsule-in-the-same-place-twice-except-where-the-gait-is-carried',
    spec: 'Section 17.1 (the AUTO suite), H46, H52',
    name: 'Striking a state twice in one run leaves the capsule in the same place, for every state whose strike does not run to a condition on the carried gait phase, and the three that do are declared',
    run: async (h) => {
      const origin = location.origin;
      const problems = [];
      const readings = [];
      const skipped = [];
      const moved = [];

      for (const name of STRIKES) {
        const first = strike(h, name);
        if (!first.reached) { skipped.push(`${name} (${first.why})`); continue; }
        const at = { ...h.shade.position };
        const second = strike(h, name);
        if (!second.reached) { skipped.push(`${name} (reached once, then ${second.why})`); continue; }
        const apart = gap(at, h.shade.position);
        const carried = Object.prototype.hasOwnProperty.call(CARRIED, name);

        if (carried) {
          // Reported, never asserted: see the header. What is asserted is
          // only that the state is in the set, which the clause below does.
          moved.push(`${name} ${apart.toFixed(3)}m`);
        } else if (apart > SAME_PLACE) {
          problems.push(`two strikes of "${name}" left the capsule ${apart.toFixed(3)}m apart and it is not declared as carrying anything; either its termination has grown a dependence on something the previous check left behind - the gait's phase is the one that has done this before (D66) - or it belongs in CARRIED with what it reads`);
        }
      }

      // The set is declared, so it is wrong in both directions. A state that
      // has stopped carrying is the better news and the more dangerous: the
      // header's restriction would be a lie and the next job would write a
      // check around a limitation that no longer exists.
      for (const name of Object.keys(CARRIED)) {
        if (!STRIKES.includes(name)) {
          problems.push(`"${name}" is declared as carrying the gait and is not one of the ${STRIKES.length} states strike() knows; the entry names nothing`);
        }
      }
      // And the other direction, which is **not** done by measuring. A run
      // where both declared states happen to read 0.000m is a run where the
      // gait's phase aligned, not a run where the restriction is fixed -
      // measured twice on the plant within one pass of two runs, at walk
      // 1.167m / sprint 0.217m and then walk 0.292m / **sprint 0.000m**. A
      // clause that reds on "they agreed this morning" would be asserting
      // the registration order, which is D71's shape and the very thing the
      // header says the size of this number is. So the set is held stale-proof
      // from the mechanism instead: `strike`'s walk and sprint cases run to a
      // peak of the DRAWN leg, and that one expression is why they carry. If
      // it goes, the restriction has been fixed or moved, and this entry and
      // animation.js's header are both lies until somebody looks (H57).
      const source = await text(origin, '/src/tests/animation.js');
      if (source.error) {
        problems.push(`${source.error}; this clause reads the mechanism that puts walk and sprint in CARRIED`);
      } else if (!TERMINATES_ON_THE_DRAWN_LEG.test(source.body)) {
        problems.push(`tests/animation.js no longer runs a strike to a peak of the drawn leg (${TERMINATES_ON_THE_DRAWN_LEG}), which is the whole reason ${Object.keys(CARRIED).join(' and ')} carry the gait; either the restriction is fixed - in which case CARRIED comes out and the header with it - or it has moved to a condition nobody has looked at (H57)`);
      }

      // And the instrument, on F8's model: a census of "nothing moved" is
      // worth nothing unless something could have. At least one declared
      // state has to have been struck twice for the clause above to mean
      // anything, and at least one undeclared one for the clause above that.
      const measured = STRIKES.length - skipped.length;
      if (measured < 2) {
        problems.push(`only ${measured} of ${STRIKES.length} states could be struck twice on this map, so neither clause measured anything`);
      }
      if (moved.length === 0 && skipped.length < STRIKES.length) {
        problems.push(`neither of the ${Object.keys(CARRIED).length} declared states was struck on this map, so the half of this clause that is about carrying was not measured here`);
      }

      readings.push(`${measured} of ${STRIKES.length} states struck twice`);
      readings.push(`${measured - moved.length} put the capsule inside ${SAME_PLACE}m`);
      if (moved.length) readings.push(`declared and reported: ${moved.join(', ')}`);
      if (skipped.length) readings.push(`${skipped.length} not on this map: ${skipped.join('; ')}`);

      return {
        pass: problems.length === 0,
        detail: problems.length === 0 ? readings.join('; ') : problems.join('; '),
      };
    },
  });
}
