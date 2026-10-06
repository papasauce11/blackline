/**
 * BLACKLINE - tests/bufferscale.js
 *
 * AUTO suite (H28): a pixel reading is a reading about the drawing buffer, and
 * the floors in this suite have to say so.
 *
 * H24 ran the suite at `low` for the first time and three pixel-reading checks
 * went red with nothing wrong with the game: `resolutionScale` 0.7 is a buffer
 * with 49% of the pixels in it, and a figure that covered 3,014 of them at
 * `medium` covered 1,455 at `low` against a floor of 2,000 that was 2,000
 * whatever the buffer was. The quality level is only what *found* that - the
 * same reds come up on a resized window, on a phone, on any display whose
 * pixel ratio is not 1 - so the fix was never "read the level", it was to make
 * a count a fraction of the buffer (`scaledCount`, pixels.js).
 *
 * This check holds that, and it holds it by the buffer rather than by the
 * level: at `medium`, where the gate is pinned, it drives the renderer's pixel
 * ratio to the three the presets ask for and reads the Shade's silhouette at
 * each, through **the figure check's own floor function** rather than a copy of
 * its numbers. So a floor that stopped scaling fails here at 0.7 before anyone
 * has to run the suite at another level again. The clause that makes the point
 * out loud is the last one: the smallest buffer's reading is *below* the
 * reference floor, which is the sentence "a fixed 2,000 would have failed
 * here" asserted rather than remembered.
 *
 * It also reads `tests/keylight.js`'s window on the east shell wall, which was
 * the other half of the same bug and the less obvious half: columns 700-1270 of
 * a 1280-wide buffer are columns 700-1270 of an 896-wide one too, which is a
 * read that runs off the end of each row and into the next. A window that fits
 * is the weakest thing worth asserting about it, and it is enough to catch the
 * constants coming back.
 *
 * Registered from tests/index.js **after** the pixel-reading modules and beside
 * `tests/quality.js`, for the reason that module is there: it is one of the
 * three that resize the drawing buffer, so anything it fails to put back is
 * seen by the soak and the frame-budget check rather than hidden behind them.
 * Nothing here imports main.js (Section 3.1).
 */

import { applyQuality } from '../quality.js';
import { createLens, quiesce, REFERENCE_WIDTH, REFERENCE_HEIGHT } from './pixels.js';
import { standAndEyes, flatShadeSilhouette, silhouetteFloor } from './figure.js';
import { wallWindow } from './keylight.js';

/**
 * The pixel ratios read at: the three the presets ask for on a 1x display
 * (`resolutionScale` 0.7 / 1 / 1.25), driven here directly because what is
 * under test is the buffer and not the level - a check that moved the level
 * would be reading five knobs to ask about one.
 */
const RATIOS = [0.7, 1, 1.25];
/** The distance the reading is taken at: the near eye of the figure checks' own stand. */
const DISTANCE = 8;
/**
 * Counts over the square of the buffer height agree between buffers within
 * this. Measured on the plant at the three ratios: 5,750.8 / 5,814.0 / 5,730.9
 * per megapixel-of-height, a spread of **1.4%** - so the law is not
 * approximately right, it is right, and the band is this wide only to leave
 * room for the thin limbs a smaller buffer resolves differently against the
 * 8-luma difference threshold.
 */
const LAW_TOLERANCE = 0.1;

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-pixel-reading-is-a-fraction-of-the-drawing-buffer',
    spec: 'Section 4 / H28',
    name: 'The Shade clears the figure check\'s own floor at three drawing-buffer sizes, the counts go with the square of the buffer height, and the key-light check\'s window on the wall fits every one',
    run: (h) => {
      const problems = [];
      const readings = [];
      const restore = quiesce(h);
      const was = h.renderer.getPixelRatio();

      // The stand does not depend on the buffer, so it is found once: it is the
      // expensive half of the figure checks (a sweep of the clear lanes).
      const where = standAndEyes(h, 25);
      if (!where) {
        restore();
        return { pass: false, detail: 'no stand on this map with a clear lane and 25m of sight' };
      }
      h.shade.reset({ position: where.stand, yaw: where.lane.yaw });
      h.stepFrames(5);
      for (let i = 0; i < 60; i++) h.shade.updateVisual(1 / 60);

      const seen = [];
      try {
        for (const ratio of RATIOS) {
          // `setPixelRatio` resizes the drawing buffer off the CSS size three
          // already holds; the post's targets follow it and reallocate only
          // when the size moved (post.js), exactly as `applyQuality` does it.
          h.renderer.setPixelRatio(ratio);
          h.post.setSize();
          const lens = createLens(h);
          // A 0x0 buffer is a lost context or a resize that landed badly, and
          // every reading off it is black (TRAPS.md). Say which it is rather
          // than reporting a figure that covered no pixels.
          if (lens.width === 0 || lens.height === 0) {
            lens.restore();
            problems.push(`at x${ratio} the drawing buffer is ${lens.width}x${lens.height}`);
            break;
          }
          const shape = flatShadeSilhouette(h, lens, where, DISTANCE);
          const floor = silhouetteFloor(lens, DISTANCE);
          const window = wallWindow(lens);
          const fits = window.x1 <= lens.width && Math.max(...window.rows) < lens.height;
          seen.push({
            ratio,
            width: lens.width,
            height: lens.height,
            count: shape ? shape.count : 0,
            floor,
            window,
            fits,
          });
          lens.restore();
        }
      } finally {
        // Back through `applyQuality`, so the ratio, the size, the post's
        // targets, the shadow map and the outlines are all what the level asks
        // for rather than what this check left behind.
        applyQuality();
        if (Math.abs(h.renderer.getPixelRatio() - was) > 1e-6) {
          h.renderer.setPixelRatio(was);
          h.post.setSize();
        }
      }

      for (const r of seen) {
        readings.push(`x${r.ratio} ${r.width}x${r.height}: ${r.count}px over a floor of ${r.floor}, the wall window ${r.window.x0}-${r.window.x1} on rows ${r.window.rows.join('/')}`);
        if (r.count < r.floor) problems.push(`at x${r.ratio} the Shade covered ${r.count} pixels of a ${r.width}x${r.height} buffer against its own floor of ${r.floor}`);
        if (!r.fits) problems.push(`at x${r.ratio} the key light's window runs to column ${r.window.x1} and row ${Math.max(...r.window.rows)} of a ${r.width}x${r.height} buffer`);
      }

      // The law, not just the direction: a count over the square of the buffer
      // height is the same number at every size, because `render.fov` is a
      // vertical field of view and the horizontal follows the aspect.
      if (problems.length === 0) {
        const density = seen.map((r) => r.count / (r.height * r.height));
        const low = Math.min(...density);
        const high = Math.max(...density);
        readings.push(`the count over the square of the buffer height holds at ${density.map((d) => (d * 1e6).toFixed(1)).join(' / ')} per megapixel-of-height`);
        if (!(low > 0) || high / low > 1 + LAW_TOLERANCE) {
          problems.push(`the count over the square of the buffer height runs ${(low * 1e6).toFixed(1)} to ${(high * 1e6).toFixed(1)}, a factor of ${(high / low).toFixed(2)} — the scaling law is not this one`);
        }

        // And the sentence the job exists for: the smallest buffer's reading is
        // under the floor as it was written, so a count that stopped being
        // scaled would fail rather than merely be unjustified.
        // `silhouetteFloor` only reads a buffer's height, so the reference
        // buffer can be handed to it as the two numbers it is.
        const smallest = seen[0];
        const unscaled = silhouetteFloor({ width: REFERENCE_WIDTH, height: REFERENCE_HEIGHT }, DISTANCE);
        if (!(smallest.count < unscaled)) {
          problems.push(`at x${smallest.ratio} the Shade covered ${smallest.count} pixels, which clears the reference buffer's own floor of ${unscaled} — this check proves nothing about the scaling`);
        } else {
          readings.push(`x${smallest.ratio}'s ${smallest.count}px is under the ${unscaled} the reference buffer asks for, which is the red H24 found`);
        }
      }

      restore();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${readings.join('; ')}; stood at the lane from ${where.lane.from}, the pixel ratio back at ${h.renderer.getPixelRatio()}`
          : `${problems.join('; ')} [${readings.join('; ')}]`,
      };
    },
  });
}
