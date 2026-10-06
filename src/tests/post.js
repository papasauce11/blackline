/**
 * BLACKLINE - tests/post.js
 *
 * AUTO suite (E6, D10): post-processing - a bloom on the emissives, a
 * vignette on the frame's edge, a switch.
 *
 * Read through the same lens every pixel check reads through (pixels.js
 * renders through post.js when it is on), against the same frame with the
 * post off: a lamp fixture grows a halo, the outer band of a floor view
 * darkens and its centre does not, the hit marker's bounds are the same
 * size either way (it draws over the composite, on its own layer), the
 * frame costs the passes it says, and the settings row is the switch.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG, SETTINGS } from '../config.js';
import { activeQuality, qualityPreset, postEnabled } from '../quality.js';
import { createLens, difference, quiesce, scaledCount, scaledRow, SITE_SAMPLE_OFFSET } from './pixels.js';

const PP = CONFIG.render.post;

/** A fixture reads over this (0..255) in the raw frame. */
const FIXTURE_LUMA = 200;
/** ...on at least this many pixels of the reference buffer, or there is nothing to bloom. */
const FIXTURE_PIXELS = 20;
/** How far out from the fixture the halo is read, in pixels of the reference buffer. */
const HALO = 10;
/** The corners have to give this many pixels of the reference buffer over the floor for the vignette to be readable. */
const BAND_PIXELS = 500;
/**
 * The halo: the ring round the fixture reads brighter by this much (luma,
 * 0..255) with the post on. Measured MEASURED_HALO; the floor is a third.
 */
const HALO_STEP = 3;
/**
 * The vignette: the four corner squares of a floor view, 6% of the frame a
 * side, the median ratio of post to raw where the raw reads 10 or more.
 * The vignette is elliptical - nothing at the top and bottom edges'
 * middles, which sit inside the inner radius - so the corners are where it
 * is read. Expected 0.7-0.8 at strength 0.3; measured 0.847 on the plant
 * (the squares reach well inside the corner). A tenth off is the floor.
 */
const BAND_RATIO_MAX = 0.9;
/** The centre 10% is left alone, within this of unchanged. */
const CENTRE_RATIO_MIN = 0.97;
/** The hit marker's bounds may move this many pixels between the raw frame and the composite before it counts as bloomed. */
const MARKER_SLOP = 3;

function luma(frame, i) {
  return 0.2126 * frame[i] + 0.7152 * frame[i + 1] + 0.0722 * frame[i + 2];
}

/** Pixels over `threshold` luma, as a mask. */
function brightMask(frame, width, height, threshold) {
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) if (luma(frame, i * 4) > threshold) mask[i] = 1;
  return mask;
}

/** A mask grown by `radius` in every direction (a box). */
function dilate(mask, width, height, radius) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < width) out[yy * width + xx] = 1;
        }
      }
    }
  }
  return out;
}

/**
 * The fixture of a lamp in `frame` - the pixels over `FIXTURE_LUMA` - and the
 * ring just outside it, `halo` pixels out, which is where a bloom shows.
 */
function fixtureAndRing(frame, width, height, halo) {
  const fixture = brightMask(frame, width, height, FIXTURE_LUMA);
  let lit = 0;
  for (let i = 0; i < fixture.length; i++) lit += fixture[i];
  const grown = dilate(fixture, width, height, halo);
  const ring = new Uint8Array(fixture.length);
  for (let i = 0; i < ring.length; i++) ring[i] = grown[i] && !fixture[i] ? 1 : 0;
  return { lit, ring };
}

/** Mean luma over a mask. */
function meanOver(frame, mask) {
  let total = 0;
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    total += luma(frame, i * 4);
    n++;
  }
  return n ? total / n : 0;
}

/** Median of post/raw luma over the four corner squares, `fraction` of the frame a side, where raw >= floor. */
function bandRatio(raw, post, width, height, fraction, floor) {
  const bw = Math.max(1, Math.floor(width * fraction));
  const bh = Math.max(1, Math.floor(height * fraction));
  const ratios = [];
  for (let y = 0; y < height; y++) {
    if (y >= bh && y < height - bh) continue;
    for (let x = 0; x < width; x++) {
      if (x >= bw && x < width - bw) continue;
      const i = (y * width + x) * 4;
      const a = luma(raw, i);
      if (a < floor) continue;
      ratios.push(luma(post, i) / a);
    }
  }
  ratios.sort((p, q) => p - q);
  return { median: ratios.length ? ratios[ratios.length >> 1] : 1, count: ratios.length };
}

/** Mean luma over the centred `fraction` box. */
function centreMean(frame, width, height, fraction) {
  const hw = Math.floor(width * fraction / 2);
  const hh = Math.floor(height * fraction / 2);
  let total = 0;
  let n = 0;
  for (let y = (height >> 1) - hh; y < (height >> 1) + hh; y++) {
    for (let x = (width >> 1) - hw; x < (width >> 1) + hw; x++) {
      total += luma(frame, (y * width + x) * 4);
      n++;
    }
  }
  return total / n;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'post-processing-blooms-the-emissives-darkens-the-corners-and-is-a-switch',
    spec: 'Section 4 (E6, D10)',
    name: 'With the post on a lamp fixture grows a halo, a floor view\'s outer band darkens and its centre does not, the hit marker is not bloomed, the frame costs its passes, and the settings row turns it off and on',
    run: (h) => {
      const problems = [];
      const post = h.post;
      if (!post) return { pass: false, detail: 'no post pipeline on the harness' };
      const was = SETTINGS.post;
      // The level, and whether its preset draws any post at all (D60): read
      // once here because the detail line below is outside the try (H28).
      const level = activeQuality();
      const drawsPost = qualityPreset().post;
      const restore = quiesce(h);
      const lens = createLens(h);
      h.shade.mesh.visible = false;
      h.warden.mesh.visible = false;
      h.shade.groundBlob.visible = false;
      h.warden.groundBlob.visible = false;
      const { width, height } = lens;
      const tiny = { x: 0.05, y: 0.05, z: 0.05 };
      const readings = [];
      try {
        // A lamp with an eye 3m off it in open air, with sight of the glass.
        let eye = null;
        let lamp = null;
        for (const entry of h.map.activeLights()) {
          const p = entry.position;
          for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3], [2.1, 2.1], [-2.1, -2.1]]) {
            const candidate = { x: p.x + dx, y: p.y - 0.8, z: p.z + dz + 0.01 };
            if (!h.map.collision.isClear(candidate, tiny)) continue;
            if (!h.map.collision.lineOfSight(candidate, p, () => true)) continue;
            eye = candidate;
            lamp = entry;
            break;
          }
          if (eye) break;
        }
        if (!eye) return { pass: false, detail: 'no lamp has an eye 3m off it in open air' };
        lens.look(eye, lamp.position);
        const lampName = lamp.tag || lamp.lightId;
        // The ring is a dilation measured in pixels and the fixture a count of
        // them, so both are the reference buffer's and both are scaled to this
        // one (H28, pixels.js).
        const halo = scaledRow(lens, HALO);
        const litFloor = scaledCount(lens, FIXTURE_PIXELS);

        // Both frames of the lamp, and both of the floor, taken before anything
        // is asserted: at a level that draws no post each pair is the same frame
        // twice, and that is the reading rather than a reason to stop.
        SETTINGS.post = false;
        lens.grab();
        const raw = lens.grab();
        if (post.passes !== 0) problems.push(`with the post off the frame reports ${post.passes} passes`);
        SETTINGS.post = true;
        lens.grab();
        const shone = lens.grab();
        const onPasses = post.passes;
        const { lit, ring } = fixtureAndRing(raw, width, height, halo);
        if (lit < litFloor) problems.push(`the fixture of ${lampName} covers ${lit} pixels of a ${width}x${height} buffer over ${FIXTURE_LUMA} from 3m, want ${litFloor}; nothing to bloom`);
        const haloRaw = meanOver(raw, ring);
        const haloPost = meanOver(shone, ring);
        readings.push(`the ring round ${lampName}'s fixture, ${halo}px out, ${haloRaw.toFixed(1)} -> ${haloPost.toFixed(1)}`);

        // The vignette: a floor view, the outer band down, the centre alone.
        const site = h.map.sites[0];
        const at = { x: site.position.x + SITE_SAMPLE_OFFSET, y: site.position.y, z: site.position.z };
        lens.look({ x: at.x, y: at.y + 2.2, z: at.z + 0.01 }, at);
        SETTINGS.post = false;
        const floorRaw = lens.grab();
        SETTINGS.post = true;
        const floorPost = lens.grab();
        const band = bandRatio(floorRaw, floorPost, width, height, 0.06, 10);
        const bandFloor = scaledCount(lens, BAND_PIXELS);
        const centreRaw = centreMean(floorRaw, width, height, 0.1);
        const centrePost = centreMean(floorPost, width, height, 0.1);
        readings.push(`the corners of site ${site.id}'s floor at ${band.median.toFixed(3)}x over ${band.count} pixels, the centre ${centreRaw.toFixed(1)} -> ${centrePost.toFixed(1)}`);
        if (band.count < bandFloor) problems.push(`only ${band.count} pixels of the corners of a ${width}x${height} buffer read 10 or more raw, want ${bandFloor}; the vignette cannot be read here`);

        // -------------------------------------------------------------------
        // `low` draws no post whatever the player's row says - the preset is
        // the other half of an AND (D60, `postEnabled`) - so at that level the
        // claim is the ABSENCE, and H28 has this check read it rather than go
        // red with "0 passes, not 7" or ask for a skip. It is the stronger half
        // of the pair: a row that could switch the bloom on at `low` would be
        // the preset not being honoured, and nothing else in the suite would
        // notice.
        // -------------------------------------------------------------------
        if (!drawsPost) {
          if (postEnabled()) problems.push('the row turned the post on at a level whose preset has it off');
          if (onPasses !== 0) problems.push(`with the row on the frame reports ${onPasses} passes at a level that draws no post`);
          if (Math.abs(haloPost - haloRaw) >= HALO_STEP) problems.push(`the ring round the fixture moved ${(haloPost - haloRaw).toFixed(1)} with the row on at a level that draws no post`);
          if (band.median <= BAND_RATIO_MAX) problems.push(`the corners read ${band.median.toFixed(3)}x with the row on at a level that draws no vignette`);
        } else {
          const passes = 3 + 2 * PP.blurPasses;
          if (onPasses !== passes) problems.push(`with the post on the frame reports ${onPasses} passes, not ${passes}`);
          if (!(haloPost - haloRaw >= HALO_STEP)) problems.push(`the ring round the fixture reads ${haloRaw.toFixed(1)} raw and ${haloPost.toFixed(1)} with the post; no bloom`);
          if (band.count >= bandFloor && !(band.median <= BAND_RATIO_MAX)) problems.push(`the corners read ${band.median.toFixed(3)}x with the post on; no vignette`);
          if (centreRaw > 1 && centrePost / centreRaw < CENTRE_RATIO_MIN) problems.push(`the centre reads ${centrePost.toFixed(1)} against ${centreRaw.toFixed(1)} raw; the vignette reaches the middle`);
        }

        // The hit marker draws over the composite: its bounds are the same
        // size with the post on and off, or it has grown a halo. There is no
        // composite at a level that draws no post, so there is nothing there
        // for it to be the same size as, and the pair is not read.
        const marker = (on) => {
          SETTINGS.post = on;
          h.feedback.hitTimer = 0;
          h.feedback.update(0);
          const without = lens.grab();
          h.feedback.mark();
          h.feedback.update(0);
          const withMarker = lens.grab();
          h.feedback.hitTimer = 0;
          h.feedback.update(0);
          return difference(without, withMarker, width, height, 8);
        };
        if (drawsPost) {
          const markerRaw = marker(false);
          const markerPost = marker(true);
          if (!markerRaw.bounds || !markerPost.bounds) problems.push('the hit marker changed nothing');
          else {
            const spanRaw = markerRaw.bounds.maxX - markerRaw.bounds.minX;
            const spanPost = markerPost.bounds.maxX - markerPost.bounds.minX;
            readings.push(`the hit marker spans ${spanRaw}px raw, ${spanPost}px with the post`);
            if (Math.abs(spanPost - spanRaw) > MARKER_SLOP) problems.push(`the hit marker spans ${spanRaw}px raw and ${spanPost}px with the post; it is bloomed`);
          }
        } else {
          // One frame of it all the same, so a level with no composite still
          // proves the marker draws: a vacuous pair would be the one clause
          // here that could never fail.
          const drawn = marker(true);
          if (!drawn.bounds) problems.push('the hit marker changed nothing');
          else readings.push(`the hit marker spans ${drawn.bounds.maxX - drawn.bounds.minX}px, with no composite to bloom it`);
        }

        // The switch: the settings row.
        h.menu.show('settings');
        const row = h.menu.root.querySelector('#bl-post');
        if (!row) problems.push('the settings menu has no post-processing row');
        else {
          SETTINGS.post = true;
          row.click();
          if (SETTINGS.post !== false) problems.push('the settings row did not turn the post off');
          row.click();
          if (SETTINGS.post !== true) problems.push('the settings row did not turn the post back on');
        }
        h.menu.hide();
        if (lens.glError() !== 0) problems.push('GL error during the reads');
      } finally {
        SETTINGS.post = was;
        h.shade.mesh.visible = true;
        h.warden.mesh.visible = true;
        h.shade.groundBlob.visible = true;
        h.warden.groundBlob.visible = true;
        lens.restore();
        restore();
      }
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${readings.join('; ')}; ${drawsPost ? `${3 + 2 * PP.blurPasses} passes a frame, 0 off` : `0 passes a frame at ${level}, with the row on and with it off`}; the settings row switches it`
          : problems.join('; '),
      };
    },
  });
}
