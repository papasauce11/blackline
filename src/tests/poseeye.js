/**
 * BLACKLINE - tests/poseeye.js
 *
 * AUTO suite (H46): what the position chase does to a pose photograph's
 * *surroundings* - which eye is picked, and what the world lets that eye see.
 * **It changes one, and this is the census that holds which.**
 *
 * **What H43 left open.** `look.js`'s `photographPose` anchors its eye and its
 * focus on `actor.mesh.position` at the frame the strike arrived, and H43
 * measured that gap for all twelve states `strike` reaches: all twelve read
 * with the gap open, worst `landing` at 0.794m. H43 passed on a structural
 * argument for why that is harmless, and it is sound as far as it goes: the eye
 * and the focus are both offsets from **one** read of the drawn body, so camera
 * and subject carry the same lag, and the pixel floors are about a body the
 * right size in the right part of the frame.
 *
 * **What that argument does not cover is the world**, and H43 said so and named
 * this job. The eye is chosen as the first of six candidates that
 * `world.isClear(candidate, eyeHalf)` and `world.lineOfSight(candidate, focus)`
 * both accept, and both are asked about a point placed off a body up to 0.8m
 * from where the capsule is. Neither function knows a drawn body exists; they
 * answer about geometry. So the lag can move a candidate eye into or out of a
 * crate and can change what stands between that eye and the body.
 *
 * **It does, in three places, and all three are climbs.** On the plant,
 * `vault`: the drawn body is 0.43m behind the capsule and the eye chosen off it
 * is `front-left` where off the capsule it is `front-right`. On the yard,
 * `mantle` (0.40m, `right` against `front-right`) and `pullup` (0.49m, `left`
 * against `front-left`). Nine of the twelve states agree on both maps, and the
 * set is **climbs** - which is the shape of the finding rather than a
 * coincidence: a climb is where the body is up against something, so a
 * candidate eye 4.5m off it is where `isClear` has a crate to disagree about.
 * It is not a proof that nothing moves. It is the three that do.
 *
 * **The gaps this measures agree with H43's table to the millimetre**, which is
 * how the instrument is known to be reading the right quantity: walk 0.35
 * against H43's 0.352, landing 0.79 against 0.794, hang 0.01 against 0.014,
 * mantle 0.50 against 0.498 on the plant and 0.40 against 0.398 on the yard,
 * and ten of twelve above 0.05m where H43 counted ten. Two independent
 * measurements of the same gap, a job apart.
 *
 * **It did not agree at first, and the reason is worth the paragraph.**
 * `shade.position` is the capsule's **centre** and `mesh.position` is written
 * as `_smoothPosition.y - half.y`, which is its **feet** - the expression is
 * quoted in `positionreads.js`'s `feel.js` entry. Subtracting the two raw
 * vectors adds the capsule's half-height to every gap, so this check first
 * read `hang` at 0.94m where H43 says 0.014m, and `crouch` at exactly half the
 * standing states, which is the tell. Worse than the wrong numbers: the eye
 * comparison was then placing its candidate eyes 0.9m too high, and it
 * "found" `mantle` and `pullup` moving on the plant, which they do not. The
 * capsule's feet are `feetY`, an accessor the entity already has. **A gap
 * between a drawn body and its capsule is a gap between two feet or two
 * centres, never one of each.**
 *
 * **Why that is a census and not a red.** Choosing off the drawn body is
 * **correct for this photograph**: the subject of the frame is the body as
 * drawn, so an eye in open air with sight of *that* body is the eye the picture
 * needs, and the frame `photographPose` returns is self-consistent whichever
 * candidate wins. What the flip costs is that the view of a vault is
 * `front-left` rather than `front-right`, and of a yard mantle `right` rather
 * than `front-right` - a different angle on the same pose, chosen by a lag
 * rather than by the geometry anybody intended. So
 * the honest handling is the one `positioncensus.js` uses for the hole it
 * reports: **declare the set, hold it both ways, and let the next map say so.**
 * `EYE_MOVES` below is that set. A state joining it turns this red, and a
 * declared state leaving it turns this red too, because a declaration for
 * something that has moved is one the next reader inherits without arguing.
 * **H52** is the fix, if Josh wants one, and it is a look rather than a rule:
 * the alternative is to choose the eye off the capsule and photograph the drawn
 * body, which frames a vault from where the move is going rather than from
 * where the body is.
 *
 * **What is asserted beside the census** is the invariant that actually has to
 * hold for a photograph to mean anything, and nothing held it before: the eye
 * chosen off the drawn body is in open air **and** has sight of that body. A
 * frame from an eye inside a crate is the failure this function could have, and
 * it is a different claim from "the same eye as the capsule would pick".
 *
 * **How this is measured, which is not how the queue proposed to measure it.**
 * H46 asked for a state photographed twice - once as shipped, once with the
 * chase settled - and for the eye and the pixel coverage compared. That was
 * built first, with the `settle` option it needs (which `photographPose` now
 * has, defaulting to zero so `npm run shot` is unchanged), and **it does not
 * work, for two measured reasons**:
 *
 *   1. **`updateVisual` is not only the position chase.** Settling 150 frames
 *      of it also advances the breath, which is H33's quantity and moves the
 *      silhouette. On the plant, `landing` covered 9,451 pixels shipped and
 *      9,996 settled - **5.77% apart from the same eye** - and that 5.77% is a
 *      body at a different point in its breath, not an occluder. A pixel count
 *      cannot tell the two apart, so it cannot answer this question.
 *   2. **Two strikes of a moving state do not land in the same place.** The
 *      control caught it: the two `sprint` photographs were of capsules
 *      **0.975m apart**, so they were never two frames of one moment. **H52**
 *      carries it, and it is the reason a comparison of two photographs is the
 *      wrong shape of instrument here whatever it measures.
 *
 * So this check asks the geometry **directly and once**: strike the state, take
 * the drawn body's feet and the capsule's feet from the same frame, and run
 * `chooseEye` - `look.js`'s own function, exported rather than copied - against
 * both. Those two calls are the entire mechanism by which the lag could reach
 * the surroundings, so comparing them is a **complete** answer rather than a
 * sampled one. It costs no frame and no pixel, and it has no breath in it.
 *
 * All twelve states are measured, not the three the queue named: once the
 * instrument is geometry rather than a pair of photographs the other nine are
 * free, and `vault` - which the queue did not name - is the one that moved.
 *
 * Registered from tests/index.js after tests/look.js, whose instrument it
 * uses. Nothing here imports main.js (Section 3.1).
 */

import { chooseEye, POSE_EYE_NAMES } from './look.js';
import { quiesce } from './pixels.js';
import { strike, STRIKES } from './animation.js';
import { CONFIG } from '../config.js';

/**
 * The states whose chosen eye differs between the drawn body and the capsule
 * it is chasing - the hole this check reports rather than fixes, declared so
 * that it cannot grow quietly.
 *
 * **Keyed by map, because the set is a property of the geometry and not of the
 * chase.** Every state in it is a **climb**: a climb is where the body is up
 * against something, so a candidate eye 4.5m off it is where `isClear` has a
 * crate to disagree about. The plant moves one (`vault`) and the yard two
 * (`mantle`, `pullup`), which is the same division H43's table found - only the
 * ledge-dependent states differ between maps.
 *
 * A candidate whose verdict flips **without** changing the winner is not in
 * here and is not asserted: it changes no picture, and the detail line marks it
 * with a second eye name (the plant's `mantle` reads `L/L`). It is the same
 * mechanism one step from arriving, so it is worth seeing and not worth a red.
 *
 * A map with no entry is a map where nothing moves, and the check holds that
 * too: an entry appearing for it is the hole growing.
 */
const EYE_MOVES = {
  plant: {
    vault: { drawn: 'front-left', capsule: 'front-right' },
  },
  yard: {
    mantle: { drawn: 'right', capsule: 'front-right' },
    pullup: { drawn: 'left', capsule: 'front-left' },
  },
};

/**
 * Below this gap, in metres, a state's agreement is reported and not counted
 * as evidence: the drawn body and the capsule are in the same place, so the
 * two answers agreeing says nothing about the mechanism. H43 measured `hang`
 * at 0.014m and `crouch` at 0.004m, which are the two that land here.
 */
const MIN_GAP = 0.05;

/**
 * At least this many of the twelve states must carry a real gap, or the
 * instrument is not reading what it claims to. H43's table says ten do.
 */
const MIN_STATES_WITH_A_GAP = 8;

/** Eye names shortened for the detail line, which is cut at 400 characters. */
function brief(name) {
  return name ? name.split('-').map((part) => part[0].toUpperCase()).join('') : '-';
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-position-chase-moves-one-pose-photograph-eye-and-this-is-which',
    spec: 'Section 17.1 / F7 / H43, H46',
    name: 'The eye a pose would be photographed from is chosen off the drawn body, it is always in open air with sight of that body, and the states where the capsule would have chosen differently are exactly the declared set',
    run: (h) => {
      const problems = [];
      const readings = [];
      const restore = quiesce(h);
      const moved = {};
      let withAGap = 0;
      let worst = { state: null, gap: 0 };

      try {
        for (const state of STRIKES) {
          h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
          const struck = strike(h, state);
          if (!struck.reached) {
            problems.push(`${state}: the strike did not reach it (${struck.why})`);
            continue;
          }
          const shade = h.shade;
          const world = h.map.collision;
          // Both **feet** off the same frame: the body as drawn, and where the
          // mesh would be if the chase had arrived.
          //
          // `shade.position` is the capsule's **centre** and `mesh.position`
          // is written as `_smoothPosition.y - half.y`, which is its feet
          // (`positionreads.js`'s `feel.js` entry states the expression). So
          // the capsule's feet are `feetY`, the accessor the entity already
          // has, and subtracting the two raw vectors instead - which this
          // check did first - adds the capsule's half-height to every gap. It
          // read `crouch` at exactly half the standing states, which is the
          // tell, and `hang` at 0.94m where H43's table says 0.014m.
          const drawn = { x: shade.mesh.position.x, y: shade.mesh.position.y, z: shade.mesh.position.z };
          const capsule = { x: shade.position.x, y: shade.feetY, z: shade.position.z };
          const gap = Math.hypot(capsule.x - drawn.x, capsule.y - drawn.y, capsule.z - drawn.z);

          const asDrawn = chooseEye(world, drawn, shade.yaw);
          const asCapsule = chooseEye(world, capsule, shade.yaw);

          if (gap >= MIN_GAP) {
            withAGap++;
            if (gap > worst.gap) worst = { state, gap };
          }

          // The invariant that has to hold whatever the capsule would have
          // picked: the frame is of the drawn body, from an eye that can see it.
          if (!asDrawn.name) {
            problems.push(`${state}: no candidate eye is in open air with sight of the drawn body, so this state is photographed from nowhere`);
          } else {
            const check = chooseEye(world, drawn, shade.yaw);
            if (check.name !== asDrawn.name) {
              problems.push(`${state}: chooseEye answered "${asDrawn.name}" and then "${check.name}" for the same body in the same frame, so it is not a function of what it is given`);
            }
          }

          if (asDrawn.name !== asCapsule.name) {
            moved[state] = { drawn: asDrawn.name, capsule: asCapsule.name, gap };
          }
          const differing = POSE_EYE_NAMES.filter((_, i) => asDrawn.accepted[i] !== asCapsule.accepted[i]);
          readings.push(`${state} ${gap.toFixed(2)} ${brief(asDrawn.name)}${differing.length ? `/${brief(asCapsule.name)}` : ''}`);
        }
      } finally {
        h.input.clearAll();
        restore();
      }

      // The census, both ways - and reported as **one** line however many
      // states are in it, because a detail is cut at 400 characters with no
      // ellipsis and a problem per state hid four of six the first time this
      // check was run (TRAPS.md; H42 and H43 were bitten by the same cut).
      const declaredHere = EYE_MOVES[h.map.id] || {};
      const undeclared = [];
      const stale = [];
      for (const [state, found] of Object.entries(moved)) {
        const declared = declaredHere[state];
        if (!declared) {
          undeclared.push(`${state} ${brief(found.drawn)}/${brief(found.capsule)} ${found.gap.toFixed(2)}m`);
        } else if (declared.drawn !== found.drawn || declared.capsule !== found.capsule) {
          stale.push(`${state} declared ${brief(declared.drawn)}/${brief(declared.capsule)}, read ${brief(found.drawn)}/${brief(found.capsule)}`);
        }
      }
      const closed = Object.keys(declaredHere).filter((state) => !moved[state]);
      if (undeclared.length) {
        problems.push(`on ${h.map.id}, ${undeclared.length} state(s) photographed from an eye the lag chose and not declared in EYE_MOVES: ${undeclared.join(', ')} (drawn/capsule, F=front B=back L=left R=right)`);
      }
      if (stale.length) problems.push(`EYE_MOVES is stale: ${stale.join('; ')}`);
      if (closed.length) {
        problems.push(`${closed.join(', ')} declared in EYE_MOVES and no longer moving - the hole has closed or the state has changed, and a declaration for something that has moved is one the next reader inherits without arguing`);
      }

      if (withAGap < MIN_STATES_WITH_A_GAP) {
        problems.push(`only ${withAGap} of ${STRIKES.length} states carried a gap of ${MIN_GAP}m or more, under the ${MIN_STATES_WITH_A_GAP} this reading rests on - H43 measured ten, so either the chase has changed or this is not reading it`);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${STRIKES.length} states, ${withAGap} with a gap over ${MIN_GAP}m, worst ${worst.state} ${worst.gap.toFixed(2)}m; ${Object.keys(moved).length} eye moves (declared on ${h.map.id}: ${Object.keys(declaredHere).join(',') || 'none'}): ${readings.join(' ')}`
          : problems.join('; '),
      };
    },
  });
}
