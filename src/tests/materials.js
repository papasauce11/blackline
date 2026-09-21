/**
 * BLACKLINE - tests/materials.js
 *
 * The plant's materials (E4): what the pixels can say about a finish and a
 * decal.
 *
 * Section 4 asks for toon shading and Section 2 for no image anywhere, and
 * E4 gave the plant three finishes - concrete, painted metal and glass -
 * each a toon ramp of its own and a grime texture generated in code
 * (mapmaterials.js), projected in world metres onto every solid; and a set
 * of decals - stains, drips, wheel scuffs, a hazard kerb - merged into two
 * meshes (mapdecals.js, maps/plantdecals.js). A pixel cannot say whether
 * a wall reads as concrete or a blotch as a leak; it can say that every
 * material on the map is on the ramp and the texture its finish names,
 * that the ramps differ where the config says they do, that a plain wall
 * varies across its face by more than the same wall untextured - which is
 * the grime being drawn and not merely assigned - that a stain darkens the
 * floor under it and a kerb changes the pixels where it is laid, that
 * every decal sits on the face of a solid, and that the lot costs two draw
 * calls. Whether it reads is D43.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { createLens, difference, meanLumaIn, quiesce } from './pixels.js';

const P = CONFIG.palette;
const F = CONFIG.map.finishes;

/** The centred crop read from a face, as a fraction of the frame. */
const CROP = 0.4;
/** The eye stands this far off a face to read its grain. */
const STAND_OFF = 2.5;
/**
 * Grime: over the crop, the grimed face minus the same face with the
 * texture taken off is the grime itself, whatever the lighting's own bands
 * do. It varies pixel to pixel by at least this (its standard deviation)
 * and darkens on average by at least this.
 */
const GRAIN_SPREAD = 1.0;
const GRAIN_DARKENS = 2.0;
/** Every floor stain takes at least this fraction off the floor's luma under it, and the darkest at least this much. */
const STAIN_DIMS = 0.1;
const STAIN_STEP = 3.0;
/** A kerb changes at least this many pixels from 2.2m up. */
const KERB_PIXELS = 200;
/** A decal's surface point is this far into the solid, and its lifted point this far out of it. */
const PROBE = 0.05;

/** The per-pixel luma difference a minus b over the centred crop: its mean and its standard deviation. */
function lumaDeltaIn(a, b, width, height, fraction) {
  const halfW = Math.floor((width * fraction) / 2);
  const halfH = Math.floor((height * fraction) / 2);
  const cx = width >> 1;
  const cy = height >> 1;
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = cy - halfH; y < cy + halfH; y++) {
    for (let x = cx - halfW; x < cx + halfW; x++) {
      const i = (y * width + x) * 4;
      const delta = 0.2126 * (a[i] - b[i]) + 0.7152 * (a[i + 1] - b[i + 1]) + 0.0722 * (a[i + 2] - b[i + 2]);
      sum += delta;
      sumSq += delta * delta;
      count++;
    }
  }
  if (!count) return { mean: 0, spread: 0 };
  const mean = sum / count;
  return { mean, spread: Math.sqrt(Math.max(0, sumSq / count - mean * mean)) };
}

/** Both actors out of every frame. Returns the undo. */
function hideActors(h) {
  h.shade.mesh.visible = false;
  h.warden.mesh.visible = false;
  h.shade.groundBlob.visible = false;
  h.warden.groundBlob.visible = false;
  return () => {
    h.shade.mesh.visible = true;
    h.warden.mesh.visible = true;
    h.shade.groundBlob.visible = true;
    h.warden.groundBlob.visible = true;
  };
}

/** The ramp's texels, 0..1. */
function rampLevels(texture) {
  return Array.from(texture.image.data, (value) => value / 255);
}

/**
 * Read a face's grain: the crop with the finish's grime on, minus the same
 * crop with the grime taken off every material of that finish (and put
 * back). The eye stands `STAND_OFF` off the face along its normal, at
 * `at`, looking square at it; a tiny sideways offset keeps the look-at
 * defined when the normal is the up vector.
 */
function readGrain(h, lens, finish, at, normal) {
  const eye = { x: at.x + normal.x * STAND_OFF, y: at.y + normal.y * STAND_OFF, z: at.z + normal.z * STAND_OFF + 0.01 };
  lens.look(eye, at);
  const textured = lens.grab();
  const luma = meanLumaIn(textured, lens.width, lens.height, CROP);
  const affected = h.map.materials.entries()
    .map(([, material]) => material)
    .filter((material) => material.map === finish.grime);
  for (const material of affected) {
    material.map = null;
    material.needsUpdate = true;
  }
  const plain = lens.grab();
  for (const material of affected) {
    material.map = finish.grime;
    material.needsUpdate = true;
  }
  const delta = lumaDeltaIn(textured, plain, lens.width, lens.height, CROP);
  return { spread: delta.spread, darkens: -delta.mean, luma, materials: affected.length };
}

export function register(debugTools) {
  // -------------------------------------------------------------------------
  // E4 - three finishes, and the grime is on the wall
  // -------------------------------------------------------------------------
  debugTools.registerAutoTest({
    id: 'the-plant-is-dressed-in-three-finishes-and-the-grime-is-on-the-wall',
    maps: ['plant'], // the plant opts in; the yard is E5's
    spec: 'Section 4 (E4)',
    name: 'Every material is on its finish\'s ramp and grime, the ramps differ as configured, and a wall varies across its face more than the same wall untextured',
    run: (h) => {
      const problems = [];
      const finishes = h.map.finishes;
      if (!finishes) return { pass: false, detail: 'the plant has no finish set' };

      // The set: three finishes, the palette sorted into them.
      for (const name of ['concrete', 'paint', 'glass']) {
        if (!finishes.get(name)) problems.push(`no "${name}" finish`);
      }
      const expectFinish = [[P.concrete, 'concrete'], [P.concreteDark, 'concrete'], [P.ductMetal, 'paint'],
        [P.hazardOrange, 'paint'], [P.wardenGunmetal, 'paint'], [P.glass, 'glass']];
      for (const [color, name] of expectFinish) {
        const got = finishes.of(color);
        if (!got || got.name !== name) problems.push(`0x${color.toString(16)} is drawn as ${got ? got.name : 'nothing'}, not ${name}`);
      }

      // The ramps: each finish's texels are its configured levels, and
      // concrete's and paint's are not the same ramp.
      for (const name of finishes.names) {
        const want = F[name].ramp;
        const got = rampLevels(finishes.get(name).ramp);
        const off = want.findIndex((level, i) => Math.abs(level - got[i]) > 1 / 255 + 1e-6);
        if (got.length !== want.length || off !== -1) {
          problems.push(`${name}'s ramp reads [${got.map((v) => v.toFixed(2)).join(', ')}] against the configured [${want.join(', ')}]`);
        }
      }
      if (finishes.get('concrete') && finishes.get('paint')) {
        const a = rampLevels(finishes.get('concrete').ramp).join();
        const b = rampLevels(finishes.get('paint').ramp).join();
        if (a === b) problems.push('concrete and paint share one ramp');
      }

      // Every material the map made is on its finish's ramp and grime, lit
      // variants and glass included.
      let materials = 0;
      for (const [key, material] of h.map.materials.entries()) {
        materials++;
        const finish = finishes.of(material.color.getHex());
        if (material.gradientMap !== finish.ramp) problems.push(`material ${key} is not on ${finish.name}'s ramp`);
        if (material.map !== finish.grime) problems.push(`material ${key} does not wear ${finish.name}'s grime`);
      }
      if (materials < 4) problems.push(`only ${materials} materials in the cache`);

      // The pixels: a concrete slab and a painted duct, each read square on
      // from 2.5m under a lamp - a surface at luma 20 hides a tenth of
      // itself in a level or two - differ from themselves untextured pixel
      // to pixel, and are darker for it.
      const restore = quiesce(h);
      const lens = createLens(h);
      const unhide = hideActors(h);
      lens.grab();
      const M = CONFIG.map;
      const reads = [
        // The deck's underside over the north corridor, under its lamp.
        { what: 'concrete slab', finish: finishes.get('concrete'), at: { x: 0, y: M.catwalkY, z: -18.0 }, normal: { x: 0, y: -1, z: 0 } },
        // The south duct's outer wall where it crosses the hall, under the deck.
        { what: 'painted duct', finish: finishes.get('paint'), at: { x: -7.0, y: M.ventFloorY + 0.6, z: 4.0 + M.ventWidth / 2 }, normal: { x: 0, y: 0, z: -1 } },
      ];
      const readings = [];
      for (const read of reads) {
        if (!read.finish) continue;
        const grain = readGrain(h, lens, read.finish, read.at, read.normal);
        readings.push(`${read.what}: grime spread ${grain.spread.toFixed(2)}, darkens ${grain.darkens.toFixed(1)} at luma ${grain.luma.toFixed(1)}, ${grain.materials} materials`);
        if (!(grain.spread >= GRAIN_SPREAD && grain.darkens >= GRAIN_DARKENS)) {
          problems.push(`the ${read.what}'s grime varies by ${grain.spread.toFixed(2)} luma and darkens by ${grain.darkens.toFixed(1)} at luma ${grain.luma.toFixed(1)}; the grime is not on screen`);
        }
      }
      if (lens.glError() !== 0) problems.push('GL error during the reads');

      unhide();
      lens.restore();
      restore();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${materials} materials on ${finishes.names.length} finishes (${finishes.names.join(', ')}); ${readings.join('; ')}`
          : problems.join('; '),
      };
    },
  });

  // -------------------------------------------------------------------------
  // E4 - the decals are on the surfaces, and cost two draw calls
  // -------------------------------------------------------------------------
  debugTools.registerAutoTest({
    id: 'the-plant-wears-its-decals-on-its-faces-in-two-draw-calls',
    maps: ['plant'], // plantdecals.js is the plant's list
    spec: 'Section 4 and Section 5, amended (E4)',
    name: 'Every decal sits on the face of a solid clear of the sites, a stain darkens the floor under it, a kerb is drawn, and the lot costs two draw calls',
    run: (h) => {
      const problems = [];
      const decals = h.map.decals;
      const meshes = h.map.decalMeshes;
      if (!decals || decals.length < 12) return { pass: false, detail: `the plant carries ${decals ? decals.length : 0} decals` };
      if (!meshes || meshes.length !== 2) problems.push(`${meshes ? meshes.length : 0} decal meshes, not two`);

      // Every kind is used; every decal sits on a solid's face - the surface
      // point is inside a solid, the lifted point is in clear air - and none
      // is within reach of a site ring.
      const kinds = new Set(decals.map((decal) => decal.kind));
      for (const kind of ['stain', 'drip', 'scuff', 'hazard']) {
        if (!kinds.has(kind)) problems.push(`no ${kind} on the map`);
      }
      const collision = h.map.collision;
      const tiny = { x: 0.01, y: 0.01, z: 0.01 };
      const ringClear = CONFIG.map.marking.siteRingOuter + 2.5;
      for (const decal of decals) {
        const p = decal.position;
        const n = decal.normal;
        const inside = { x: p.x - n.x * PROBE, y: p.y - n.y * PROBE, z: p.z - n.z * PROBE };
        const outside = { x: p.x + n.x * PROBE, y: p.y + n.y * PROBE, z: p.z + n.z * PROBE };
        if (collision.isClear(inside, tiny)) problems.push(`${decal.tag} is not on a solid`);
        if (!collision.isClear(outside, tiny)) problems.push(`${decal.tag} is inside a solid`);
        for (const site of h.map.sites) {
          const reach = Math.hypot(p.x - site.position.x, p.z - site.position.z);
          if (Math.abs(p.y - site.position.y) < 1 && reach < ringClear + Math.max(decal.w, decal.h) / 2) {
            problems.push(`${decal.tag} is ${reach.toFixed(1)}m from site ${site.id}, inside its ring's clearance`);
          }
        }
      }

      const restore = quiesce(h);
      const lens = createLens(h);
      const unhide = hideActors(h);
      lens.grab();

      // Two draw calls, shown minus hidden, from the middle of the bay.
      const show = (visible) => { for (const mesh of meshes || []) mesh.visible = visible; };
      lens.look({ x: 18, y: 1.6, z: -10 }, { x: 28, y: 0.5, z: -12 });
      lens.renderOnly();
      const withDecals = h.renderer.info.render.calls;
      show(false);
      lens.renderOnly();
      const withoutDecals = h.renderer.info.render.calls;
      show(true);
      if (withDecals - withoutDecals !== 2) {
        problems.push(`the decals cost ${withDecals - withoutDecals} draw calls, not two (${withoutDecals} -> ${withDecals})`);
      }

      // A stain darkens the floor under it: every floor stain, read straight
      // down from 2.2m, shown against hidden. Each takes a tenth off; the
      // darkest, in a lit room, takes whole levels.
      const readings = [];
      const overhead = (decal) => {
        const p = decal.position;
        lens.look({ x: p.x, y: p.y + 2.2, z: p.z + 0.01 }, { x: p.x, y: p.y, z: p.z });
      };
      let deepest = 0;
      let stains = 0;
      for (const stain of decals) {
        if (stain.kind !== 'stain' || stain.normal.y < 0.5) continue;
        stains++;
        overhead(stain);
        const shown = meanLumaIn(lens.grab(), lens.width, lens.height, 0.3);
        show(false);
        const hidden = meanLumaIn(lens.grab(), lens.width, lens.height, 0.3);
        show(true);
        deepest = Math.max(deepest, hidden - shown);
        readings.push(`${stain.tag} ${hidden.toFixed(1)} -> ${shown.toFixed(1)}`);
        if (!(hidden - shown >= hidden * STAIN_DIMS)) {
          problems.push(`${stain.tag} leaves the floor at ${shown.toFixed(1)} against ${hidden.toFixed(1)} bare; a stain that does not darken is not drawn`);
        }
      }
      if (stains === 0) problems.push('no stain on a floor');
      else if (deepest < STAIN_STEP) problems.push(`the deepest stain takes ${deepest.toFixed(1)} off its floor; none is in a lit room`);

      // A kerb is drawn where it is laid: the pixels that change when it is
      // hidden, from 2.2m over it.
      const kerb = decals.find((decal) => decal.kind === 'hazard');
      if (kerb) {
        overhead(kerb);
        const shown = lens.grab();
        show(false);
        const hidden = lens.grab();
        show(true);
        const changed = difference(shown, hidden, lens.width, lens.height).count;
        readings.push(`${kerb.tag} changes ${changed} pixels`);
        if (changed < KERB_PIXELS) problems.push(`${kerb.tag} changes ${changed} pixels from 2.2m up; the kerb is not drawn`);
      }
      if (lens.glError() !== 0) problems.push('GL error during the reads');

      unhide();
      lens.restore();
      restore();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${decals.length} decals (${[...kinds].join(', ')}) on ${meshes.length} meshes, ${withDecals - withoutDecals} draw calls; ${readings.join('; ')}`
          : problems.join('; '),
      };
    },
  });
}
