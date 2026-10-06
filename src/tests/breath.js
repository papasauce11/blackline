/**
 * BLACKLINE - tests/breath.js
 *
 * AUTO suite (H31): the two thin clauses of the figure checks, held at every
 * phase of the breath rather than at the phase a run happened to arrive in.
 *
 * **Why a check has a phase at all.** The Shade breathes standing still -
 * `POSE.breath` lifts the torso 4cm at 0.9 rad/s, a 6.98s cycle - and
 * `updateVisual` runs on the **wall clock from the render frame**, never from
 * `fixedStep`, while `Agent.reset()` deliberately leaves `_breathTime` alone
 * (it is not stale state a reinsert should clear; the body keeps breathing).
 * So the phase a check reads is a function of how many frames the whole run
 * drew before it, which is why a subset and a full suite disagree and why two
 * runs of one suite can disagree. At 25m on the reference buffer the Shade is
 * forty rows tall for 1.8 metres: **a row is about 4.5cm and the breath is
 * most of one.**
 *
 * **What that moves, measured.** H29 and H31 both suspected the breath slides
 * `band()` onto different anatomy. At this buffer it does not - the band is
 * three or four rows at 39 to 41 and always contains the neck's narrowest row.
 * What the breath moves is the body's **sub-pixel** alignment, so the narrow
 * part of the neck falls inside one row or straddles two. Over 48 readings on
 * both maps the hood was **10px every single time** and the neck was **4, 5 or
 * 6px** - the ratio running 1.67x to 2.50x, with the worst case 1.67x against
 * `HOOD_OVER_NECK`. A neck of 7px would be 1.43x and red, and never happened.
 *
 * **So this check exists to hold that worst case rather than to find a bug.**
 * `the-shade-reads-as-a-hooded-figure-at-8m-and-25m` and
 * `...told-apart-by-silhouette-at-25m` each take the one reading their own
 * arrival gave them, so each has been green on every run on record while
 * sampling a quantity nobody had bounded. This one sweeps the cycle and asserts
 * the **worst** phase, which is a claim neither of them makes and which cannot
 * depend on where the run came in. Both of the band's clauses are held, because
 * both run on the same 11% - `hood >= neck * 1.5` read 1.67x at worst and
 * `hood >= below * 0.9` read exactly 1.00 at worst, and the second is the
 * thinner of the two in character even though its number looks further off.
 *
 * **Why it is not flaky although the first sample is arbitrary.** Eight samples
 * cover one whole cycle from wherever the run came in, so the *set* of phases
 * rotates between runs. That would matter if the worst value were rare; it is
 * not - a 6px neck came up in six or seven of the eight samples in every run,
 * so the maximum is hit many times over whatever the rotation. Six runs read a
 * worst case of 1.67x and 1.00x, to the digit, while the individual phases
 * moved.
 *
 * It reads through `figure.js`'s own exports rather than copies of them, for
 * the reason `tests/bufferscale.js` calls `silhouetteFloor` instead of its
 * numbers (H28), and the breath's period comes from the look table rather than
 * from two constants written again here.
 *
 * Registered from tests/index.js beside the figure checks. Nothing here
 * imports main.js (Section 3.1).
 */

import { POSE } from '../entities/agentvisual.js';
import { QUALITY_FALLBACK, pixelRatioNow } from '../quality.js';
import { createLens, quiesce } from './pixels.js';
import {
  standAndEyes, flatShadeSilhouette, silhouetteFloor, yawToward,
  HOOD_OVER_NECK, HOOD_OVER_ALL_BELOW,
} from './figure.js';

/** The distance the margin is thin at: the far eye of the figure checks' stand. */
const DISTANCE = 25;

/**
 * Samples across one breath cycle. The reading is an integer count of pixels,
 * so the point of sampling is to find which integers the band takes rather
 * than to resolve a curve - and each sample costs two renders and two
 * `readPixels` of the reference buffer, which is why it is eight and not forty.
 */
const PHASES = 8;

/** The breath's own period, from the look table rather than a number copied out of it. */
const BREATH_SECONDS = (2 * Math.PI) / POSE.breath.rate;

/**
 * The rows of head and shoulder the profile prints, from the top down. Thirteen
 * covers the hood, the neck band and the row under it on the 39-41 row body
 * this buffer draws, which is everything either clause reads.
 */
const PROFILE_ROWS = 13;

/** The buffer the figure checks read at since H28 (D63), and this one with them. */
const READ_AT = () => pixelRatioNow(undefined, QUALITY_FALLBACK);

/**
 * A row profile as one character a row, top first, so eight of them fit in the
 * 400 characters a detail line keeps (TRAPS.md - the cut is silent and has
 * already cost one job its readings). Base 36 covers every width a body
 * subtends at 25m; anything wider prints `+` rather than wrapping round
 * unnoticed.
 */
function profileText(profile) {
  return profile.slice(0, PROFILE_ROWS)
    .map((width) => (width > 35 ? '+' : width.toString(36)))
    .join('');
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-hood-holds-its-ratio-at-every-phase-of-the-breath',
    spec: 'Section 4 / H31',
    name: 'At 25m on the reference buffer, face-on, the Shade\'s hood stays wider than the neck band under it at every phase of the breath - not only at the phase the run arrived in',
    // No `glSync`: this reads the buffer the figure checks just read, at the
    // same pixel ratio, so nothing is resized and no pipeline is built. The
    // flag is for a check that asserts on `gl.getError()` (F11, D48), and
    // claiming it here would charge the run for a tail already paid.
    run: (h) => {
      const problems = [];
      const restore = quiesce(h);
      const where = standAndEyes(h, DISTANCE);
      if (!where) {
        restore();
        return { pass: false, detail: `no stand on this map with a clear lane and ${DISTANCE}m of sight` };
      }
      // Face-on to the eye, which is the view both figure checks read their
      // hood in: the lane's own yaw is a different and easier question, and
      // H29's first draft got comfortable numbers out of it by accident.
      h.shade.reset({ position: where.stand, yaw: yawToward(where.stand, where.eyes[DISTANCE]) });
      h.stepFrames(5);

      // A sample every eighth of a breath, advanced the way the game advances
      // it - `updateVisual` at the fixed step, so the eased pose lags exactly
      // as it does in a frame rather than being teleported to a phase.
      const frames = Math.max(1, Math.round((BREATH_SECONDS / PHASES) * 60));
      const lens = createLens(h, { pixelRatio: READ_AT() });
      const floor = silhouetteFloor(lens, DISTANCE);
      const seen = [];
      try {
        for (let phase = 0; phase < PHASES; phase++) {
          for (let i = 0; i < frames; i++) h.shade.updateVisual(1 / 60);
          const shape = flatShadeSilhouette(h, lens, where, DISTANCE);
          seen.push({
            height: shape ? shape.height : 0,
            width: shape ? shape.width : 0,
            count: shape ? shape.count : 0,
            hood: shape ? shape.hood : 0,
            // `narrowest()` is a Math.min over the rows with any width, so a
            // band with no resolvable row comes back Infinity, not 0 - the trap
            // figure.js guards with Number.isFinite. Carried as 0, which is
            // what it means, and reported as a problem rather than divided by.
            neck: shape && Number.isFinite(shape.neck) ? shape.neck : 0,
            below: shape ? shape.below : 0,
            profile: shape ? profileText(shape.profile) : '',
          });
        }
      } finally {
        lens.restore();
      }

      // ------------------------------------------------------------------
      // The worst phase, which is the whole point: a clause that holds at
      // one arbitrary phase of a 7-second cycle is a clause nobody has
      // bounded. Measured 1.67x and 1.00x over six runs on both maps.
      // ------------------------------------------------------------------
      const ratios = [];
      const overBelow = [];
      for (const r of seen) {
        if (r.count < floor) {
          problems.push(`a phase drew ${r.count}px of a ${lens.width}x${lens.height} buffer against a floor of ${floor}`);
          continue;
        }
        if (r.neck === 0) {
          problems.push(`a phase left no resolvable row in the neck band of a ${r.height}x${r.width} body`);
          continue;
        }
        ratios.push(r.hood / r.neck);
        overBelow.push(r.below > 0 ? r.hood / r.below : 0);
      }
      const worst = ratios.length ? Math.min(...ratios) : 0;
      const best = ratios.length ? Math.max(...ratios) : 0;
      const worstBelow = overBelow.length ? Math.min(...overBelow) : 0;
      if (ratios.length === PHASES) {
        if (worst < HOOD_OVER_NECK) {
          problems.push(`the worst phase reads a hood ${worst.toFixed(2)}x its neck, under ${HOOD_OVER_NECK}x`);
        }
        if (worstBelow < HOOD_OVER_ALL_BELOW) {
          problems.push(`the worst phase reads a hood ${worstBelow.toFixed(2)} of the widest row under it, under ${HOOD_OVER_ALL_BELOW}`);
        }
      }

      restore();
      const readings = seen.map((r) => `${r.height}|${r.profile}|${r.hood}/${r.neck}-${r.below}`);
      const line = `ref ${lens.width}x${lens.height} 25m face-on, ${PHASES} phases of a ${BREATH_SECONDS.toFixed(2)}s breath`
        + ` as h|top${PROFILE_ROWS} base36|hood/neck-below: ${readings.join(' ')}`
        + `; worst ${worst.toFixed(2)}x of ${best.toFixed(2)}x against ${HOOD_OVER_NECK}x, over-below ${worstBelow.toFixed(2)} against ${HOOD_OVER_ALL_BELOW}`;
      return { pass: problems.length === 0, detail: problems.length === 0 ? line : `${problems.join('; ')} [${line}]` };
    },
  });
}
