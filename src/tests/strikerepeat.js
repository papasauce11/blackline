/**
 * BLACKLINE - tests/strikerepeat.js
 *
 * AUTO suite (H52, H57): that each of the twelve states `strike()` knows puts
 * the capsule in the same place twice - all twelve, since H57 - and the
 * mechanism that is the reason.
 *
 * **What H46 found by accident.** It wanted a state photographed twice - once
 * as shipped, once with the position chase settled - and added a control that
 * the two frames were of the same moment. The control failed: the two `sprint`
 * photographs were of capsules **0.975m apart**. Nothing was wrong with the
 * photographs; the two strikes had simply put the body in two places, so a
 * comparison of two photographs was never going to answer anything. H46
 * abandoned that instrument for a geometric one and left this.
 *
 * **The carried quantity was `_animTime`, the drawn gait's phase**, and it is
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
 * **So the restriction was the two facts together, and H57 removed it by
 * using the second rather than fighting it.** `strike`'s walk and sprint ran
 * to *"the frame after the leg's furthest reach"*, a condition on
 * `sin(_animTime)`, so the phase that condition was met at was whatever the
 * previous driving left and the ground covered getting there was not a
 * function of the argument. What D66 guarantees is that a `reset()` **keeps
 * the phase and snaps the place**, so the order can be inverted: pin the phase
 * by driving to a known one, reset to the lane, and run a measured count of
 * frames from there. `strikedrive.js`'s `GAIT_STRIKE` is those counts and
 * `CARRIED` below is empty.
 *
 * **What this check is for, concretely, now that nothing is declared.** It is
 * the only place the claim *"a strike is a function of its argument"* is
 * measured rather than asserted by a comment, and it is measured on every
 * state rather than on the two that were the problem - so a new state whose
 * termination grows a dependence on anything a previous check left behind is
 * red here, named, with the distance. That is the clause H46 had to write by
 * hand to discover there was a question.
 *
 * **And the mechanism is read from source, because agreement cannot hold this
 * set stale-proof in either direction.** Two strikes agreeing on a given
 * morning used to be the gait's phase aligning rather than the restriction
 * being gone - measured twice on the plant inside one pass, at walk 1.167m /
 * sprint 0.217m and then walk 0.292m / **sprint 0.000m**. The same argument
 * now runs the other way: the two would also agree if somebody replaced the
 * pinned count with something that happened to be stable this morning. So
 * `PINS_THE_GAIT` holds the three lines that make the claim true, one of them
 * by its **absence** - the `Math.abs` read, which is what made the old pose
 * reproducible only up to a mirror (two strikes of a walk ending exactly pi
 * apart, `legL` -0.5626 against +0.5626, the other leg forward).
 *
 * **The spread is gone and what replaced it is an exact number.** The whole
 * of the twelve read **0.000000000000m** apart on both maps at H57, which is
 * `apart === 0` and not a tolerance met. The walk's phase and drawn leg are
 * identical to six decimals across two strikes; the sprint's leg differs by
 * **0.0007 rad** - 0.08% of its amplitude - because its alignment stops on a
 * sub-frame residue and the pinned count lands on a peak, where that residue
 * costs a cosine rather than a sine. Neither reaches the capsule, which is
 * why this check can still assert to 1e-9.
 *
 * **And the hazard H57 walked into, which was here before it and is the most
 * useful thing this job found.** `strike()` drives the body through a **live
 * match**, and this was the one of its four callers with no match of its own:
 * `look.js`, `poseeye.js` and `positioncensus.js` each open with
 * `initMatch({ ai: false })` and this check inherited whatever ran before it -
 * which is `poseeye.js`, whose `quiesce()` **restore** ends
 * `initMatch({ ai: true, objective: true })`. So twenty-four strikes have been
 * driven down a lit lane in front of a hunting Warden since H52, and the only
 * reason they were ever green is that each one was short enough to get away.
 * H57's alignment is some fifty frames longer and the Warden started landing
 * rounds: `combat:shot/warden`, `impact`, `damage/body`, `damage/headshot`,
 * `combat:death` - twenty-two events inside one sprint, `health` 0,
 * `ragdolled` true, and the strike reporting *"the sprint did not bring a leg
 * furthest forward"* because a dead body does not walk. It was intermittent
 * on the frame count, which is the worst way for it to have been wrong. The
 * fix is the line the other three callers already have, taken per **strike**
 * because this is the only caller that strikes twice.
 *
 * Registered from tests/index.js after poseeye.js, which is the check that
 * found this: both drive `strike()` and nothing here draws a pixel. Nothing
 * imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { strike, STRIKES, NOT_A_STATE, refusalProblems } from './strikedrive.js';
import { uncommented } from './sourcetext.js';

/**
 * A match of this check's own before every strike, with the AI off: the same
 * line `look.js`, `poseeye.js` and `positioncensus.js` open with, and the
 * reason is in the header. `initMatch` puts both actors back on their spawns
 * and resets combat and detection, and it **keeps `_animTime`** - it resets
 * the Shade through `Agent.reset()`, which D66 holds to leaving the gait
 * alone - so the second strike of a pair still arrives carrying the first
 * one's phase and this check still measures what it exists to measure.
 */
const fresh = (h) => h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });

/**
 * The states whose strike is not a function of its argument, with what the
 * termination reads. **Empty since H57** - it held `walk` and `sprint`, and
 * both are now pinned - and it stays here rather than going away with them,
 * because it is the shape that makes this check wrong in both directions: a
 * state that joins it has grown a dependence on something a previous check
 * left behind, and a state declared in it that has stopped carrying makes the
 * entry a lie the next reader inherits without arguing.
 *
 * **Two kinds of state a reader would have expected here never were**, and
 * measuring was the only way to know. The four **climbs** are driven five
 * frames of held forward from a probed ledge and then a timed move, so their
 * position is a function of the ledge and the ledge is a function of the map.
 * And the **slide** - which looks like the worst case, being a sprint with a
 * crouch pressed into it - presses that crouch after a *fixed* forty frames
 * and runs to the SLIDE state, reading no phase at all: measured at exactly
 * 0.000m on the plant while the walk was 1.167m and the sprint 0.217m, and
 * measured again at H57 with its phase moving 3.3799 to 1.8393 between two
 * strikes that landed in the same place. It was declared here on the strength
 * of the argument and the first subset run took it out again, which is the
 * whole reason this set is measured every run rather than reasoned about once.
 */
const CARRIED = {};

/**
 * The two states whose strike drives the gait, and so the two the clause above
 * is about. Declared rather than discovered for the reason `poseeye.js`
 * declares its three state-map pairs: the instrument below has to know that
 * the half of this check which is about the gait measured something on this
 * map, and a census that reports whatever it finds reports nothing.
 */
const GAIT_DRIVEN = ['walk', 'sprint'];

/** Two capsule positions are the same place within this, which is the floating-point floor and not a tolerance. */
const SAME_PLACE = 1e-9;

/** How far apart two capsules are, in metres. */
const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/**
 * The module `strike` lives in, which the two source clauses below read. It was
 * `animation.js` until H75 moved the driver out of E3's checks, and **both
 * clauses went red on both maps when it did** - correctly, naming the moved
 * mechanism, which is the whole of what they are for. Named once here so the
 * next move of this code is one line and not four messages.
 */
const DRIVER_FILE = 'strikedrive.js';

/**
 * The three lines in `strike`'s walk and sprint that make a strike a function
 * of its argument, read from `strikedrive.js`'s own source. Two must be there
 * and one must not, and the one that must not is the mirror: an `Math.abs`
 * read stops at whichever half-cycle arrives first, which pins the silhouette
 * and not the parity, and a 3,000-pixel floor cannot tell the two apart.
 */
const PINS_THE_GAIT = [
  {
    is: 'present',
    pattern: /const now = shade\.mesh\.userData\.parts\.legL\.rotation\.x;/,
    what: 'the termination reads the SIGNED drawn leg, which is what pins the phase mod 2pi rather than up to a mirror',
  },
  {
    is: 'absent',
    pattern: /Math\.abs\(shade\.mesh\.userData\.parts\.legL\.rotation\.x\)/,
    what: 'the termination does not read the leg through Math.abs, which is the read that made the old pose reproducible only up to a mirror',
  },
  {
    is: 'present',
    pattern: /for \(let i = 0; i < band\.frames; i\+\+\) frame\(h\);/,
    what: 'the ground covered is a pinned count of frames from the lane and not a condition on the phase, which is what makes the POSITION the argument\'s',
  },
];

/** Read a module from the origin the way the other censuses do. */
async function text(origin, rel) {
  const response = await fetch(`${origin}${rel}`);
  if (!response.ok) return { error: `${rel}: ${response.status}` };
  return { body: await response.text() };
}

/**
 * H72's state, and the step of the strike the round lands on.
 *
 * The **walk** because it is one of the two the gait drives, so it is struck on
 * both maps by the clause above and is the state H57 actually watched die; and
 * step 20 because `stand()` spends five frames resetting and clearing the keys
 * and the walk then holds forward for thirty, so twenty is inside the run-up
 * and not before it. Both are reported in the detail line, since a round that
 * landed before the body started moving would be a different measurement.
 */
const HURT_STATE = 'walk';
const KILL_ON_STEP = 20;

/**
 * The sentence `strike` opens a failure with when the body did not survive it,
 * as a shape and not as a copy.
 *
 * **The wording lives in `strikedrive.js` and this is read against it**, which is
 * H62's rule for a clause whose evidence is a string: the same regex is asked
 * of the reported reason *and* of that module's own source (with the comments
 * out and the strings kept, because a sentence in a template literal is the
 * thing being asserted). Reword it there and the clause names the file rather
 * than failing at runtime with nothing to point at.
 *
 * The captures are the health and the full bar, so the numbers in the message
 * can be held against `config.js` instead of being read as words - a message
 * that says *"health 100 of 100"* about a corpse is worse than no message.
 *
 * **Two currencies, because a template literal and the string it renders are
 * not the same text.** The first draft of this check asked the source for the
 * rendered shape and went red with the sentence sitting right there - the same
 * class of mistake as H53's module path, which a stripped read cannot see
 * because it is a string. So `WOUND_SAYS` is the reported reason, digits and
 * all, and `WOUND_WRITTEN` is what `strikedrive.js` actually carries, `${...}`
 * and all. Each is asked of the thing it is about and neither is asked of the
 * other.
 *
 * **And both branches by name, because only one of them can be driven here.**
 * A strike this check kills reports the *killed* sentence; a Shade with rounds
 * in her and still standing reports the *shot* one, and nothing in this suite
 * produces a wounded body that then fails a strike - so the written clause is
 * the only thing holding that half, and a pattern that accepted either would
 * stay green while the one with no runtime case was reworded away. Found by
 * break 3, which dropped the health from the killed sentence and left the
 * source clause green on the strength of the shot one.
 */
const WOUND_SAYS = /the Shade was (?:killed|shot) during the strike \(health (\d+(?:\.\d+)?) of (\d+)(, ragdolled)?\)/;
const WOUND_WRITTEN = [
  /the Shade was killed during the strike \(health \$\{shade\.health\} of \$\{S\.health\}/,
  /the Shade was shot during the strike \(health \$\{shade\.health\} of \$\{S\.health\}/,
];
const KILLED_SAYS = 'the Shade was killed during the strike';

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-strike-of-a-state-puts-the-capsule-in-the-same-place-twice-except-where-the-gait-is-carried',
    spec: 'Section 17.1 (the AUTO suite), H46, H52, H57',
    name: 'Striking a state twice in one run leaves the capsule in the same place, for all twelve states since H57; no state carries anything a previous check left behind, and the three lines that pin the gait-driven two are read from source',
    run: async (h) => {
      const origin = location.origin;
      const problems = [];
      const readings = [];
      const skipped = [];
      const refused = [];
      const moved = [];
      const agreed = [];
      const struck = [];

      for (const name of STRIKES) {
        fresh(h);
        const first = strike(h, name);
        if (!first.reached) { skipped.push(`${name} (${first.why})`); refused.push({ state: name, why: first.why }); continue; }
        const at = { ...h.shade.position };
        fresh(h);
        const second = strike(h, name);
        if (!second.reached) { skipped.push(`${name} (reached once, then ${second.why})`); refused.push({ state: name, why: `reached once, then ${second.why}` }); continue; }
        struck.push(name);
        const apart = gap(at, h.shade.position);
        const carried = Object.prototype.hasOwnProperty.call(CARRIED, name);

        if (carried) {
          // Reported, never asserted: how far apart two strikes of a declared
          // state land is a function of the phase the run arrived in, which is
          // a function of every check before this one (D71's shape).
          moved.push(`${name} ${apart.toFixed(3)}m`);
        } else if (apart > SAME_PLACE) {
          problems.push(`two strikes of "${name}" left the capsule ${apart.toFixed(3)}m apart and it is not declared as carrying anything; either its termination has grown a dependence on something the previous check left behind - the gait's phase is the one that has done this before (D66, H52) - or it belongs in CARRIED with what it reads`);
        } else {
          agreed.push(name);
        }
      }

      // A declaration that names nothing is the one direction of this set a
      // reading can settle. The other - a declared state that has stopped
      // carrying - **cannot be measured**, and H52 measured why: two strikes
      // of the sprint read 0.217m on one run of a pass and 0.000m on the next,
      // so a clause that reddened on "they agreed this morning" would have
      // reddened a correct build (D71's shape). H57 wrote that clause anyway,
      // against `agreed`, and break 3 showed it could never fire at all -
      // a declared state is reported and never enters `agreed` - which is the
      // same green-whatever-happens shape H56 found one job earlier. It is
      // gone rather than fixed, because fixing it would make it wrong: what
      // holds that direction is `PINS_THE_GAIT` below, read from source.
      for (const name of Object.keys(CARRIED)) {
        if (!STRIKES.includes(name)) {
          problems.push(`"${name}" is declared as carrying the gait and is not one of the ${STRIKES.length} states strike() knows; the entry names nothing`);
        }
      }

      // And the direction measurement cannot cover, which is why this clause
      // survived H57 with its sense inverted. Agreement is not evidence: the
      // twelve would also agree if the pinned count were replaced by something
      // that happened to be stable this morning, the same way the old walk and
      // sprint agreed on the second run of a pass and moved 1.167m on the
      // first. So the three lines that make the claim true are read from
      // `strike`'s own source, one of them by its absence.
      const source = await text(origin, `/src/tests/${DRIVER_FILE}`);
      if (source.error) {
        problems.push(`${source.error}; this clause reads the mechanism that pins ${GAIT_DRIVEN.join(' and ')}`);
      } else {
        for (const clause of PINS_THE_GAIT) {
          const found = clause.pattern.test(source.body);
          if (found !== (clause.is === 'present')) {
            problems.push(`tests/${DRIVER_FILE}: ${clause.what} - and that line is ${found ? 'there and should not be' : 'gone'} (${clause.pattern}). Either a strike is no longer a function of its argument, in which case CARRIED and that file's header are both lies until somebody looks, or the mechanism has moved and this clause wants rewriting with it (H57, H75)`);
          }
        }
      }

      // And the instrument, on F8's model: a census of "nothing moved" is
      // worth nothing unless something could have. Every state has to have
      // been struck twice for the first clause to mean anything, and at least
      // one of the two that drive the gait, or the half of this check that is
      // about the gait measured nothing on this map.
      // Counted off what was STRUCK and never off what passed: a gait-driven
      // state whose two strikes disagreed was measured all the same, and a
      // clause that called that "not measured here" would be reporting the
      // verdict as the instrument. Break 2 of this job printed exactly that
      // line beside a walk it had just measured at 1.167m.
      // H59: a skipped state is red here now rather than printed in a passing
      // line. The instrument first, because both declaration lists are empty
      // and a clause over an empty set is worth nothing unless a refusal would
      // still be seen: a name no `case` dispatches must come back refused.
      fresh(h);
      const staged = strike(h, NOT_A_STATE);
      if (staged.reached) {
        problems.push(`strike() reported reaching "${NOT_A_STATE}", which no case dispatches, so a refusal is not something this census can see and the clause below is about nothing`);
      }
      problems.push(...refusalProblems(h, refused, struck));

      const measured = struck.length;
      if (measured < 2) {
        problems.push(`only ${measured} of ${STRIKES.length} states could be struck twice on this map, so neither clause measured anything`);
      }
      const drivenHere = GAIT_DRIVEN.filter((name) => struck.includes(name));
      if (drivenHere.length === 0 && skipped.length < STRIKES.length) {
        problems.push(`neither of the ${GAIT_DRIVEN.length} states that drive the gait (${GAIT_DRIVEN.join(', ')}) was struck twice on this map, so the half of this clause that is about the gait was not measured here`);
      }

      readings.push(`${measured} of ${STRIKES.length} states struck twice`);
      readings.push(`${agreed.length} put the capsule inside ${SAME_PLACE}m`);
      readings.push(`${drivenHere.length} of ${GAIT_DRIVEN.length} gait-driven struck here, ${Object.keys(CARRIED).length} declared as carrying`);
      if (moved.length) readings.push(`declared and reported: ${moved.join(', ')}`);
      if (skipped.length) readings.push(`${skipped.length} not on this map: ${skipped.join('; ')}`);

      return {
        pass: problems.length === 0,
        detail: problems.length === 0 ? readings.join('; ') : problems.join('; '),
      };
    },
  });

  // -------------------------------------------------------------------------
  // H72: and what a strike says when the body it drove did not survive it.
  // -------------------------------------------------------------------------
  debugTools.registerAutoTest({
    id: 'a-strike-whose-body-was-killed-reports-the-death-and-not-the-stillness',
    spec: 'Section 17.1 (the AUTO suite), H57, H72',
    name: 'A strike that fails because the Shade was killed during it opens its reason with the death and her health, the numbers in that sentence are the config\'s, and the same strike with nobody shooting names neither',
    run: async (h) => {
      const origin = location.origin;
      const problems = [];
      const readings = [];
      const deaths = [];
      const offDeath = h.emitter.on('combat:death', (event) => deaths.push((event && event.target) || 'unknown'));
      // Section 17.1's god mode makes `_damage` a no-op for the Shade and two
      // checks turn it on. Forced off for the duration and put back, the way
      // `anymap.js` borrows it, and **reported**: arriving on, the round below
      // would land on nothing and this check would be measuring a body nobody
      // shot.
      const god = h.debugState.godMode;
      h.debugState.godMode = false;

      let clean;
      let cleanHealth;
      let killed;
      let killedAt = 0;
      let steps = 0;
      try {
        // The control first, and it is the half that makes the clause mean
        // anything: the same state, the same driver, nobody shooting. If the
        // sentence can turn up here, its appearance below says nothing.
        fresh(h);
        clean = strike(h, HURT_STATE);
        cleanHealth = h.shade.health;

        // Then the round, landed in the middle of the strike on the step
        // count. **Through `combat.applyDamage`**, the public door onto the
        // very `_damage` the Warden's rifle calls (`tests/feedback.js` lands
        // its damage the same way), and `combat:death` is the evidence that it
        // went through the combat system rather than into a field. A Warden
        // cannot be asked to kill on cue - four rounds inside ninety frames is
        // a function of where it stands and what it can see, so a clause that
        // waited for one would be flaky on a slower machine, which is the
        // thing H57 was bitten by rather than a way to test for it.
        fresh(h);
        steps = 0;
        const offStep = h.emitter.on('sim:step', () => {
          if (++steps !== KILL_ON_STEP) return;
          killedAt = steps;
          h.combat.applyDamage(h.shade, CONFIG.shade.health, 'shade', 'gun', { ...h.warden.position });
        });
        try {
          killed = strike(h, HURT_STATE);
        } finally {
          offStep();
        }
      } finally {
        offDeath();
        h.debugState.godMode = god;
        // The death took the camera and handed the body to the ragdoll;
        // `initMatch` resets both, so the next check gets what it would have.
        fresh(h);
      }

      if (!killedAt) {
        problems.push(`the strike never reached sim step ${KILL_ON_STEP}, so no round was landed and nothing here was measured`);
      }
      if (!deaths.includes('shade')) {
        problems.push(`a full bar of damage was applied to the Shade mid-strike and combat emitted no death for her (${deaths.length ? deaths.join(', ') : 'no combat:death at all'}); god mode was ${!!god} on the way in`);
      }
      // A dead body does not accelerate, so the strike cannot have reached the
      // state - and if it ever does, `why` is empty by contract and there is
      // nothing for the clauses below to read.
      if (killed.reached) {
        problems.push(`the strike reported "${HURT_STATE}" reached with a body killed in the middle of it, so it reported no reason at all and this check has nothing to read`);
      } else {
        const said = WOUND_SAYS.exec(killed.why);
        if (!killed.why.startsWith(KILLED_SAYS)) {
          problems.push(`a strike whose body was killed reported "${killed.why}", which does not open with "${KILLED_SAYS}" - the death is the cause and the gait is the symptom, and an afternoon on the symptom is what H57 cost (H72)`);
        } else if (!said) {
          problems.push(`the reported reason "${killed.why}" names the death without the health in the shape ${WOUND_SAYS} - the number is what tells a reader it was the rounds and not the legs`);
        } else {
          if (Number(said[2]) !== CONFIG.shade.health) {
            problems.push(`the reason says the bar is ${said[2]} and config.js says ${CONFIG.shade.health}; the sentence is quoting a number rather than reading one`);
          }
          if (Number(said[1]) !== 0 || !said[3]) {
            problems.push(`the Shade took a full bar and the reason reads "${killed.why}" - a body combat has killed is at 0 and ragdolled, so this sentence is about a different body`);
          }
        }
      }
      // And the wording, held against the module it lives in rather than
      // copied into this one (H62).
      const source = await text(origin, `/src/tests/${DRIVER_FILE}`);
      if (source.error) {
        problems.push(`${source.error}; this clause reads the sentence strike() opens a dead body's failure with`);
      } else {
        const carries = uncommented(source.body);
        for (const written of WOUND_WRITTEN) {
          if (written.test(carries)) continue;
          problems.push(`tests/${DRIVER_FILE} no longer carries a sentence of the shape ${written}, so either strike() has stopped naming what happened to the body or it has been reworded and this check wants rewriting with it - and this is the only clause holding the half of that sentence no check here can drive`);
        }
      }
      // And the control, both ways: it reached the state with nobody shooting,
      // and its report is free of the sentence above.
      if (!clean.reached) {
        problems.push(`the control strike of "${HURT_STATE}" did not reach it with nobody shooting (${clean.why}), so the reading above is not a comparison`);
      }
      if (WOUND_SAYS.test(clean.why)) {
        problems.push(`the control strike reported "${clean.why}", which already names a wound, so the sentence is not evidence of one`);
      }
      if (cleanHealth < CONFIG.shade.health) {
        problems.push(`the control strike left the Shade at ${cleanHealth} of ${CONFIG.shade.health} with nobody shooting; something in this run lands rounds of its own and the comparison is not clean`);
      }

      // The whole reason is two sentences and the runner keeps 400 characters
      // of a detail line (H42), so the opening is quoted and the rest is
      // counted: the opening is the clause, and the length is the evidence
      // that the symptom was kept rather than replaced.
      const opening = killed.why.split(';')[0];
      readings.push(`killed on sim step ${killedAt} of a "${HURT_STATE}" strike, combat:death for ${deaths.join(', ') || 'nobody'}`);
      readings.push(`it opened with "${opening}" and kept ${killed.why.length - opening.length} more characters of the gait sentence behind it`);
      readings.push(`control reached=${clean.reached}, health ${cleanHealth} of ${CONFIG.shade.health}, god mode was ${!!god}`);

      return {
        pass: problems.length === 0,
        detail: problems.length === 0 ? readings.join('; ') : problems.join('; '),
      };
    },
  });
}
