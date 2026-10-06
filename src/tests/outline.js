/**
 * BLACKLINE - tests/outline.js
 *
 * AUTO suite (Section 4): the inverted-hull outline, which is what makes a
 * silhouette read at all.
 *
 * It lived in `tests/visual.js` until H28, which needed to add a clause to it
 * and found that module at 589 lines against the ~600 guidance - so the block
 * came out into a sibling named for its own subject, as H23's check did. The
 * claim is one thing and it is worth its own file: hiding the hull of every
 * part of the Shade must move the silhouette's RIM far more than its interior,
 * because a back-faced shell scaled past the body occupies the rim and nothing
 * else. Whether hiding it lightens or darkens that rim is the detection
 * meter's business (Section 4.2 runs the outline from near-black at 0 to a
 * bright rim at 100), so the direction is not the claim; ownership of the edge
 * is.
 *
 * **And the level has a say** (H28). `low` turns the outlines off (D60), so
 * before H28 this check read a `low` run as *"hiding the hull changed the
 * silhouette edge by 0.0 - it is not drawing"*, which was true of the preset
 * and said nothing about the hull. The preset's own claim is asserted here
 * first - at a level that draws outlines every hull is visible, at a level
 * that does not every hull is hidden - and then the measurement is taken with
 * the hulls shown whatever the level, because the hull is what is being
 * measured. The restore puts them back to what the preset asks for rather than
 * to visible, which is a bug this file inherited: the old block ended
 * `hull.visible = true` unconditionally and so a `low` run came out of it
 * drawing outlines the level had turned off.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { qualityPreset } from '../quality.js';
import { createLens, difference, brightnessDelta, erode, quiesce, scaledCount } from './pixels.js';

/** Look at `target` from `distance` away, on a bearing, at eye height. */
function eyeOn(target, distance, bearing, height = 1.4) {
  return {
    x: target.x + Math.sin(bearing) * distance,
    y: target.y + height,
    z: target.z + Math.cos(bearing) * distance,
  };
}

/** The body has to be on this many pixels of the reference buffer for the rim to be readable. */
const BODY_PIXELS = 400;
/** Hiding the hull moves the rim by at least this much luma, or it is not drawing. */
const EDGE_STEP = 5;
/** ...and it moves the rim at least this many times as much as the interior. */
const EDGE_OVER_CORE = 2;

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-outline-darkens-the-silhouette-edge',
    spec: 'Section 4',
    name: 'Hiding the inverted hull measurably lightens the body edge, and a level that draws no outlines has them off',
    run: (h) => {
      const problems = [];
      const restore = quiesce(h);
      const lens = createLens(h);
      const shade = h.shade;
      const preset = qualityPreset();

      const site = h.map.sites[0];
      shade.reset({ position: site.position, yaw: 0 });
      h.stepFrames(20);
      h.detection.smoothed = CONFIG.detection.meterMax;
      h.detection._applyFeedback(shade);
      const focus = { x: shade.position.x, y: shade.feetY + 1.0, z: shade.position.z };
      lens.look(eyeOn(focus, 3, Math.PI * 0.75, 0.4), focus);

      // The outlines are children of the meshes they hull, added in Phase 5's
      // fix. Collect them by material rather than by name.
      const outlineMaterial = shade.mesh.userData.materials.outline;
      const hulls = [];
      shade.mesh.traverse((object) => {
        if (object.isMesh && object.material === outlineMaterial) hulls.push(object);
      });
      if (hulls.length === 0) {
        lens.restore();
        restore();
        return { pass: false, detail: 'the Shade has no inverted-hull outline meshes' };
      }

      // The preset's own claim, read off the live hulls before anything is
      // measured: `low` has the outlines off and `medium` and `high` have them
      // on, and that is `applyQuality`'s traverse being asserted rather than
      // trusted. It is the clause that lets the measurement below show the
      // hulls at every level without the check losing what the level says.
      const shown = hulls.filter((hull) => hull.visible).length;
      if (preset.outlines && shown !== hulls.length) {
        problems.push(`${shown} of ${hulls.length} hulls are drawn and this level draws outlines`);
      }
      if (!preset.outlines && shown !== 0) {
        problems.push(`${shown} of ${hulls.length} hulls are drawn and this level draws none`);
      }
      for (const hull of hulls) hull.visible = true;

      lens.grab();
      shade.mesh.visible = false;
      const empty = lens.grab();
      shade.mesh.visible = true;
      const withHull = lens.grab();
      for (const hull of hulls) hull.visible = false;
      const withoutHull = lens.grab();
      for (const hull of hulls) hull.visible = true;

      const body = difference(withHull, empty, lens.width, lens.height, 8);
      const inner = erode(erode(body.mask, lens.width, lens.height), lens.width, lens.height);
      const edge = new Uint8Array(body.mask.length);
      for (let i = 0; i < body.mask.length; i++) if (body.mask[i] && !inner[i]) edge[i] = 1;

      // The hull is a back-faced shell scaled past the body, so it occupies the
      // silhouette RIM and nothing else. Whether removing it lightens or
      // darkens that rim depends on the meter: Section 4.2 drives the outline
      // from near-black at visibility 0 to a bright rim at 100. So the claim
      // worth testing is not a direction, it is that the hull owns the edge —
      // hiding it must change the rim far more than the interior.
      const edgeChange = Math.abs(brightnessDelta(withHull, withoutHull, edge));
      const coreChange = Math.abs(brightnessDelta(withHull, withoutHull, inner));

      // One hull per body mesh, whatever the body is made of. Counted rather
      // than hard-coded, so adding a limb cannot silently go un-outlined.
      let bodyMeshes = 0;
      shade.mesh.traverse((object) => {
        if (object.isMesh && object.material !== outlineMaterial) bodyMeshes++;
      });

      // A pixel count is a reading about the drawing buffer (pixels.js, H28).
      const floor = scaledCount(lens, BODY_PIXELS);
      if (body.count < floor) problems.push(`the Shade covered ${body.count} pixels of a ${lens.width}x${lens.height} buffer, want ${floor}`);
      if (hulls.length !== bodyMeshes) {
        problems.push(`${bodyMeshes} body meshes but ${hulls.length} outlines — something is un-outlined`);
      }
      if (edgeChange < EDGE_STEP) problems.push(`hiding the hull changed the silhouette edge by ${edgeChange.toFixed(1)} — it is not drawing`);
      if (!(edgeChange > coreChange * EDGE_OVER_CORE)) {
        problems.push(`edge ${edgeChange.toFixed(1)} vs interior ${coreChange.toFixed(1)} — the hull is not edge-only`);
      }

      // Section 4.2's range: a faint edge when hidden, a bright rim when lit.
      const rimAt = (meter) => {
        h.detection.smoothed = meter;
        h.detection._applyFeedback(shade);
        const frame = lens.grab();
        let total = 0;
        let count = 0;
        for (let i = 0; i < edge.length; i++) {
          if (!edge[i]) continue;
          const p = i * 4;
          total += 0.2126 * frame[p] + 0.7152 * frame[p + 1] + 0.0722 * frame[p + 2];
          count++;
        }
        return count ? total / count : 0;
      };
      const faint = rimAt(0);
      const bright = rimAt(CONFIG.detection.meterMax);
      if (!(bright > faint)) {
        problems.push(`the silhouette edge reads ${faint.toFixed(1)} hidden and ${bright.toFixed(1)} lit — no range`);
      }
      if (lens.glError() !== 0) problems.push('GL error during the reads');

      // Back to what the level asks for, never to visible: at `low` the preset
      // has the outlines off and this check must not be what turns them on for
      // every check after it.
      for (const hull of hulls) hull.visible = preset.outlines;
      lens.restore();
      restore();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${hulls.length} hulls over ${bodyMeshes} body meshes and ${body.count} pixels of a ${lens.width}x${lens.height} buffer (floor ${floor}): `
            + `hiding them moved the silhouette edge by ${edgeChange.toFixed(1)} against ${coreChange.toFixed(1)} in the interior, so the `
            + `hull is what draws the rim; that rim runs ${faint.toFixed(1)} hidden to ${bright.toFixed(1)} lit; `
            + `this level draws ${preset.outlines ? 'outlines, and all of them were on' : 'no outlines, and all of them were off'}`
          : problems.join('; '),
      };
    },
  });
}
