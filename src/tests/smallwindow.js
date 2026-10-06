/**
 * BLACKLINE - tests/smallwindow.js
 *
 * AUTO suite (H29): does a small window keep a body legible at 25m?
 *
 * **The answer is that this instrument cannot tell**, and establishing that is
 * what the job turned out to be. Read `REFERENCE_ROWS` below for the
 * measurement; read this for why the question was asked.
 *
 * **Why it was asked.** H24 ran the suite at `low` and
 * `the-warden-and-the-shade-are-told-apart-by-silhouette-at-25m` went red on
 * *"the Shade's hood 6px is not 1.5x its neck 5px"*. H28 took both figure checks
 * off the applied resolution and onto the one `medium` ships, because everything
 * they assert is the **geometry** of a body and a hood is the same shape at every
 * resolution - and because the red was a reading about the runner's 1280x720
 * window rather than about the level, a player at `low` on a 1080p display
 * drawing 1344x756 getting *more* pixels than the reference. D63 records that and
 * records its cost honestly: the old red was the wrong instrument for a real
 * question, and it was the only thing in the suite pointed anywhere near it.
 *
 * So this asks it directly, of the buffer rather than of the level, because the
 * buffer is what a body is drawn into: a sweep of five drawing-buffer sizes, each
 * a real window height times a preset's `resolutionScale`, containing the one the
 * queue named (1366x768 at `low`, which is 956x538) and bracketing it both ways.
 * A window height times a scale is the only thing that reaches the rasteriser, so
 * a 1080p display at `low` and a 756-row window at `medium` draw the same body
 * out of the same pixels.
 *
 * **What it asserts.** Only what held across two runs of a full suite on both
 * maps: the body is **found**, it **covers its share of the buffer** (a fraction
 * of it, H28, not a number of pixels), and it **keeps its tall narrow
 * proportions** all the way down. Those are claims about the whole silhouette and
 * they are stable. The hood and the neck are **reported and asserted nowhere** -
 * `REFERENCE_ROWS` has the measurement that forced that, and it is the finding of
 * this job rather than a weakening of it.
 *
 * It reads through `flatShadeSilhouette`, `silhouetteFloor`, `yawToward` and
 * `NARROW` from `tests/figure.js` rather than copies of any of them, for the
 * reason `tests/bufferscale.js` calls `silhouetteFloor` instead of its numbers
 * (H28), and it restores through `applyQuality()` for the reason H28's outline
 * bug exists. It reads **face-on**, which matters: the red being explained was
 * the told-apart check's `front` view, and the first draft of this check stood
 * the Shade at the lane's yaw instead and got comfortable numbers for a question
 * nobody had asked.
 *
 * Registered from tests/index.js **after** the pixel-reading modules, beside the
 * other two that resize the drawing buffer. Nothing here imports main.js
 * (Section 3.1).
 */

import { applyQuality, qualityPreset } from '../quality.js';
import { createLens, quiesce } from './pixels.js';
import { standAndEyes, flatShadeSilhouette, silhouetteFloor, yawToward, NARROW } from './figure.js';

/** The distance the question is about: the far eye of the figure checks' own stand. */
const DISTANCE = 25;

/**
 * The displays read at, largest buffer first. Each is a real window height times
 * the `resolutionScale` of the preset named, because that product is the only
 * thing that reaches the rasteriser - a 1080p display at `low` and a 756-row
 * window at `medium` draw the same body out of the same pixels.
 *
 * The third is the one the queue named (1366x768 at `low`), and the last two are
 * below anything this game is likely to be opened in; they are here so the
 * crossover is bracketed rather than merely hunted for.
 */
const DISPLAYS = [
  { label: '1920x1080 at low', height: 1080, level: 'low' },
  { label: '1280x720 at medium, the reference', height: 720, level: 'medium' },
  { label: '1366x768 at low', height: 768, level: 'low' },
  { label: '1280x720 at low', height: 720, level: 'low' },
  { label: '1024x600 at low', height: 600, level: 'low' },
];

/**
 * **The hood-over-neck ratio is reported here and asserted nowhere, and that is
 * the finding rather than a dodge.**
 *
 * This check was first written to assert it at 538 rows and above, which held
 * over eight consecutive isolated runs - 1.67x / 1.67x / 2.00x / 1.50x / 1.50x
 * down the table, the hood rock-steady at 10 / 10 / 8 / 6 / 6 and only the neck
 * wobbling between 4 and 5 - and then went **flaky on both maps in the very next
 * full suite**. The failing run read the neck at **6px** where the other read 4,
 * at two buffer sizes at once: 8/6 = 1.33x at 538 and 6/6 = **1.00x** at 503.
 *
 * It is not quantisation of one row. `band()` in `tests/figure.js` takes the neck
 * as the rows between 14% and 22% of the silhouette's height, and at 25m in these
 * buffers the silhouette is **30 rows tall and 8 pixels wide** - so the neck band
 * is *two rows*, and the body's measured height moving by one (31 to 30, 24 to 23,
 * which is what the two runs differ by) slides those two rows onto different
 * anatomy. `narrowest()` then returns the shoulders instead of the neck. The
 * readings were not a noisy measurement of the same thing; they were measurements
 * of two different things.
 *
 * **So the honest answer to H29's question is that this instrument cannot answer
 * it.** A hood cannot be told from a neck inside eight pixels of width, and no
 * band-by-fraction-of-height decomposition is meaningful on a body that small -
 * which is a stronger vindication of D63 than D63 claimed for itself. What is
 * asserted below is only what is stable across both runs and both maps: the body
 * is found, it covers its share of the buffer, and it keeps its proportions. The
 * ratio goes in the detail line, with the two runs' disagreement in `PROGRESS.md`
 * and the question handed to the one instrument that can settle it, which is
 * Josh's eyes (`PLAYTEST.md`, *Still needs a human*).
 *
 * `REFERENCE_ROWS` is the buffer the figure checks read at since H28, kept here
 * only to label it in the detail line.
 */
const REFERENCE_ROWS = 720;

/** The buffer height each display asks for: the preset's own scale, not a copy of it. */
function bufferHeight(display) {
  return Math.round(display.height * qualityPreset(display.level).resolutionScale);
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-small-window-keeps-the-shade-a-hooded-figure-at-25m',
    spec: 'Section 4 / H29',
    name: 'The Shade is drawn, covers its share of the buffer and keeps its tall narrow proportions at five drawing-buffer sizes down to 746x420 - the sizes at which the hood-over-neck ratio stops being measurable at all',
    glSync: true,
    run: (h) => {
      const problems = [];
      const restore = quiesce(h);
      const was = h.renderer.getPixelRatio();
      // The CSS size the renderer is laid out at, which is what a pixel ratio
      // multiplies. Taken from the live buffer rather than from the window, so
      // this is right in a pane the runner resized.
      const cssHeight = h.renderer.domElement.height / was;

      // The stand is the expensive half (a sweep of the clear lanes) and does
      // not depend on the buffer, so the body is placed and posed once.
      const where = standAndEyes(h, DISTANCE);
      if (!where) {
        restore();
        return { pass: false, detail: `no stand on this map with a clear lane and ${DISTANCE}m of sight` };
      }
      // **Face-on to the eye**, which is the angle that matters: the red this
      // check exists to explain was `...told-apart-by-silhouette-at-25m`'s
      // `front` view, where the Shade is turned to the camera and its hood is
      // read across its full width against the narrowest neck row under it. The
      // lane's own yaw is a different and easier question.
      h.shade.reset({ position: where.stand, yaw: yawToward(where.stand, where.eyes[DISTANCE]) });
      h.stepFrames(5);
      for (let i = 0; i < 60; i++) h.shade.updateVisual(1 / 60);

      const seen = [];
      try {
        for (const display of DISPLAYS) {
          const want = bufferHeight(display);
          const lens = createLens(h, { pixelRatio: want / cssHeight });
          // A 0x0 buffer is a lost context or a resize that landed badly, and
          // every reading off it is black (TRAPS.md).
          if (lens.width === 0 || lens.height === 0) {
            lens.restore();
            problems.push(`${display.label} asked for ${want} rows and got a ${lens.width}x${lens.height} buffer`);
            break;
          }
          const shape = flatShadeSilhouette(h, lens, where, DISTANCE);
          seen.push({
            display,
            rows: lens.height,
            columns: lens.width,
            count: shape ? shape.count : 0,
            floor: silhouetteFloor(lens, DISTANCE),
            body: shape ? `${shape.height}x${shape.width}` : '0x0',
            aspect: shape ? shape.aspect : 0,
            hood: shape ? shape.hood : 0,
            // `narrowest()` is a `Math.min` over the rows that have any width,
            // so a neck band with no resolvable row in it comes back
            // **Infinity**, not 0 - the same trap `tests/figure.js` guards with
            // `Number.isFinite`. Carried here as 0, which is what it means.
            neck: shape && Number.isFinite(shape.neck) ? shape.neck : 0,
            // A ratio against a neck of no rows is not a reading: it is the band
            // falling below one resolvable row, which is the answer and not a
            // divide to do. `null` says so, and every clause below reads it.
            ratio: shape && Number.isFinite(shape.neck) && shape.neck > 0
              ? shape.hood / shape.neck
              : null,
          });
          lens.restore();
        }
      } finally {
        // Back through `applyQuality`, so the ratio, the size, the post's
        // targets, the shadow map and the outlines are all what the level asks
        // for rather than what this check left behind (H28's own bug).
        applyQuality();
        if (Math.abs(h.renderer.getPixelRatio() - was) > 1e-6) {
          h.renderer.setPixelRatio(was);
          h.post.setSize();
        }
      }

      // A check's detail line is capped at 400 characters by the report, so each
      // reading is the buffer, the body in it, and the hood over the neck -
      // which is the whole question - and the displays those buffers come from
      // are named in the table above rather than in every line.
      const readings = seen.map((r) => `${r.columns}x${r.rows}${r.rows === REFERENCE_ROWS ? ' (ref)' : ''}`
        + ` ${r.body} ${r.count}px ${r.aspect.toFixed(1)}:1 hood ${r.hood}/${r.neck}`
        + (r.ratio === null ? ' (no neck row)' : ''));

      // -------------------------------------------------------------------
      // What is asserted: only the readings that held across both runs of a
      // full suite on both maps. The hood and the neck are not among them (see
      // the note on `REFERENCE_ROWS`), so they are reported and nothing here
      // tests them.
      // -------------------------------------------------------------------
      for (const r of seen) {
        // The body is drawn, and covers its share of the buffer rather than a
        // number of pixels (H28). Measured 400 / 356 / 190 / 120 / 85-ish
        // against floors of 165 / 150 / 83 / 73 / 51.
        if (r.count < r.floor) {
          problems.push(`at ${r.display.label} the Shade covered ${r.count} pixels of a ${r.columns}x${r.rows} buffer against a floor of ${r.floor}`);
        }
        // And it keeps its proportions all the way down: a Shade that went
        // squat, or that lost its legs to a culling bug at a small buffer,
        // fails here. This is the stable half of what the figure checks assert,
        // and it is stable because it is a ratio of the whole silhouette rather
        // than of two bands two rows tall - measured 3.58 / 3.42 / 3.88 / 3.50
        // / 3.00 in one run and 3.50 / 3.33 / 3.75 / 3.50 / 2.88 in the other,
        // against a bar of 2.2.
        if (!(r.aspect >= NARROW)) {
          problems.push(`at ${r.display.label} the silhouette is ${r.aspect.toFixed(2)}:1, not narrow (${NARROW}:1)`);
        }
      }

      restore();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `face-on at ${DISTANCE}m: ${readings.join('; ')}`
            + `; hood/neck reported only - a 2-row band on an 8px-wide body is not a measurement (H29)`
            + `; ${where.lane.from}, ratio back at ${h.renderer.getPixelRatio()}`
          : `${problems.join('; ')} [${readings.join('; ')}]`,
      };
    },
  });
}
