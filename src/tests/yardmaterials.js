/**
 * BLACKLINE - tests/yardmaterials.js
 *
 * AUTO suite (E5): the container yard's materials, as tests/materials.js
 * holds the plant's. The yard opts into E4's kit with its own set
 * (`CONFIG.map.yardFinishes`): every container corrugated - a glossy ramp
 * and a grime with ridges across it - the ground and the fence wet, the
 * walkway's steel paint, its panes glass; and its own decals
 * (maps/yarddecals.js): rust at the foot of the rows, box numbers, the
 * trucks' tracks and a kerb at the gates, oil, a drip. The first check
 * holds every material to its finish and reads the corrugation off a
 * container under a floodlight - by difference, and as ridges: the
 * difference row across the face crosses its own mean once a trough. The
 * second holds the decals to the faces, clear of the sites, two draw
 * calls, the rust drawn.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { createLens, difference, meanLumaIn, quiesce, SITE_SAMPLE_OFFSET } from './pixels.js';
import { hideActors, rampLevels, readGrain, GRAIN_SPREAD, GRAIN_DARKENS, STAIN_DIMS, PROBE } from './materials.js';

const P = CONFIG.palette;
const F = CONFIG.map.yardFinishes;
const G = CONFIG.map.groundY;

/**
 * The corrugation, read as ridges: along a row across a container's face
 * from 2.5m, the textured frame minus the plain one crosses its own mean
 * this many times at least. Nine ridges a 2.4m tile; the row spans about
 * 3m of face at that stand-off, so a dozen troughs, two crossings each.
 * Measured 19/19/23 on three rows; the floor is half of it.
 */
const RIDGE_CROSSINGS = 12;
/** A residual has to leave this band before it counts as a side. */
const RIDGE_BAND = 0.5;
/** A rust band changes at least this many pixels from 2.5m off the face. */
const RUST_PIXELS = 300;

/** Level-crossings of a row against its own mean, with a band. */
function crossings(row, band) {
  const mean = row.reduce((a, b) => a + b, 0) / row.length;
  let side = 0;
  let count = 0;
  for (const value of row) {
    const d = value - mean;
    const now = d > band ? 1 : d < -band ? -1 : 0;
    if (now === 0) continue;
    if (side !== 0 && now !== side) count++;
    side = now;
  }
  return count;
}

/** Luma of frame a minus frame b along row y, from x0 to x1. */
function deltaRow(a, b, width, y, x0, x1) {
  const row = [];
  for (let x = x0; x < x1; x++) {
    const i = (y * width + x) * 4;
    row.push(0.2126 * (a[i] - b[i]) + 0.7152 * (a[i + 1] - b[i + 1]) + 0.0722 * (a[i + 2] - b[i + 2]));
  }
  return row;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-yard-is-corrugated-wet-and-numbered',
    maps: ['yard'],
    spec: 'Section 4 (E5)',
    name: 'Every yard material is on its finish\'s ramp and grime, the containers wear a corrugation that reads as ridges under a floodlight, and the wet ground is darker than the plant\'s concrete in its mid-tones',
    run: (h) => {
      const problems = [];
      const finishes = h.map.finishes;
      if (!finishes) return { pass: false, detail: 'the yard has no finish set' };

      for (const name of ['corrugated', 'wet', 'paint', 'glass']) {
        if (!finishes.get(name)) problems.push(`no "${name}" finish`);
      }
      const expectFinish = [[P.wardenGunmetal, 'corrugated'], [P.concrete, 'corrugated'], [P.hazardOrange, 'corrugated'],
        [P.concreteDark, 'wet'], [P.wardenSteel, 'paint'], [P.glass, 'glass']];
      for (const [color, name] of expectFinish) {
        const got = finishes.of(color);
        if (!got || got.name !== name) problems.push(`0x${color.toString(16)} is drawn as ${got ? got.name : 'nothing'}, not ${name}`);
      }
      for (const name of finishes.names) {
        const want = F[name].ramp;
        const got = rampLevels(finishes.get(name).ramp);
        const off = want.findIndex((level, i) => Math.abs(level - got[i]) > 1 / 255 + 1e-6);
        if (got.length !== want.length || off !== -1) {
          problems.push(`${name}'s ramp reads [${got.map((v) => v.toFixed(2)).join(', ')}] against the configured [${want.join(', ')}]`);
        }
      }
      // Wet is a lower concrete: its mid-tones under the plant's concrete's.
      const plant = CONFIG.map.finishes.concrete.ramp;
      const wet = F.wet.ramp;
      const mid = [3, 4, 5].filter((i) => wet[i] < plant[i]).length;
      if (mid < 2) problems.push(`the wet ramp [${wet.join(', ')}] is not lower than concrete's [${plant.join(', ')}] in its mid-tones`);
      if (!F.corrugated.grime.ridges || !(F.corrugated.grime.ridges.depth > 0)) problems.push('the corrugated grime has no ridges');

      let materials = 0;
      for (const [key, material] of h.map.materials.entries()) {
        materials++;
        const finish = finishes.of(material.color.getHex());
        if (material.gradientMap !== finish.ramp) problems.push(`material ${key} is not on ${finish.name}'s ramp`);
        if (material.map !== finish.grime) problems.push(`material ${key} does not wear ${finish.name}'s grime`);
      }
      if (materials < 4) problems.push(`only ${materials} materials in the cache`);

      // The pixels. A container's side: bay A's lane row on the bay side,
      // where the stencil is; and the ground in the lane under the gate mast.
      const restore = quiesce(h);
      const lens = createLens(h);
      const unhide = hideActors(h);
      lens.grab();
      const corrugated = finishes.get('corrugated');
      const wetFinish = finishes.get('wet');
      const readings = [];
      const side = { at: { x: -8.6, y: G + 1.5, z: -9.0 }, normal: { x: -1, y: 0, z: 0 } };
      if (corrugated) {
        const grain = readGrain(h, lens, corrugated, side.at, side.normal);
        readings.push(`container side: grime spread ${grain.spread.toFixed(2)}, darkens ${grain.darkens.toFixed(1)} at luma ${grain.luma.toFixed(1)}`);
        if (!(grain.spread >= GRAIN_SPREAD && grain.darkens >= GRAIN_DARKENS)) {
          problems.push(`the container's grime varies by ${grain.spread.toFixed(2)} luma and darkens by ${grain.darkens.toFixed(1)} at luma ${grain.luma.toFixed(1)}; it is not on screen`);
        }
        // The ridges: the difference row across the face, at the middle of
        // the frame, crosses its mean once a trough each way.
        const eye = { x: side.at.x + side.normal.x * 2.5, y: side.at.y, z: side.at.z + 0.01 };
        lens.look(eye, side.at);
        const textured = lens.grab();
        const affected = h.map.materials.entries().map(([, m]) => m).filter((m) => m.map === corrugated.grime);
        for (const m of affected) { m.map = null; m.needsUpdate = true; }
        const plain = lens.grab();
        for (const m of affected) { m.map = corrugated.grime; m.needsUpdate = true; }
        const x0 = Math.floor(lens.width * 0.3);
        const x1 = Math.floor(lens.width * 0.7);
        const rows = [lens.height >> 1, (lens.height >> 1) - 40, (lens.height >> 1) + 40].map((y) => crossings(deltaRow(textured, plain, lens.width, y, x0, x1), RIDGE_BAND));
        readings.push(`ridges: ${rows.join('/')} crossings across the face`);
        if (Math.max(...rows) < RIDGE_CROSSINGS) problems.push(`the corrugation crosses its mean ${rows.join('/')} times across the face (want ${RIDGE_CROSSINGS}); no ridges on screen`);
      }
      if (wetFinish) {
        // The puddles are metres across (an 8m tile, three cells to it),
        // so the ground is read from higher than a face - 6m up, a crop
        // four metres wide, several puddles in it - and in the lane under
        // the gate mast, the brightest ground in the yard (luma 25; a
        // texture on a floor at 20 hides in a level).
        const at = { x: -3.0, y: G, z: -10.0 };
        const grain = readGrain(h, lens, wetFinish, at, { x: 0, y: 1, z: 0 }, 6.0);
        readings.push(`wet ground: grime spread ${grain.spread.toFixed(2)}, darkens ${grain.darkens.toFixed(1)} at luma ${grain.luma.toFixed(1)}`);
        if (!(grain.spread >= GRAIN_SPREAD && grain.darkens >= GRAIN_DARKENS)) {
          problems.push(`the ground's grime varies by ${grain.spread.toFixed(2)} luma and darkens by ${grain.darkens.toFixed(1)} at luma ${grain.luma.toFixed(1)}; it is not on screen`);
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

  debugTools.registerAutoTest({
    id: 'the-yard-wears-its-decals-on-its-faces-in-two-draw-calls',
    maps: ['yard'],
    spec: 'Section 4 and Section 5, amended (E5)',
    name: 'Every yard decal sits on the face of a solid clear of the sites and the light checks\' spots, the rust and the stencil are drawn, a stain darkens the ground, and the lot costs two draw calls',
    run: (h) => {
      const problems = [];
      const decals = h.map.decals;
      const meshes = h.map.decalMeshes;
      if (!decals || decals.length < 12) return { pass: false, detail: `the yard carries ${decals ? decals.length : 0} decals` };
      if (!meshes || meshes.length !== 2) problems.push(`${meshes ? meshes.length : 0} decal meshes, not two`);

      const kinds = new Set(decals.map((decal) => decal.kind));
      for (const kind of ['rust', 'stencil', 'scuff', 'hazard', 'stain', 'drip']) {
        if (!kinds.has(kind)) problems.push(`no ${kind} on the map`);
      }
      const collision = h.map.collision;
      const tiny = { x: 0.01, y: 0.01, z: 0.01 };
      for (const decal of decals) {
        const p = decal.position;
        const n = decal.normal;
        const inside = { x: p.x - n.x * PROBE, y: p.y - n.y * PROBE, z: p.z - n.z * PROBE };
        const outside = { x: p.x + n.x * PROBE, y: p.y + n.y * PROBE, z: p.z + n.z * PROBE };
        if (collision.isClear(inside, tiny)) problems.push(`${decal.tag} is not on a solid`);
        if (!collision.isClear(outside, tiny)) problems.push(`${decal.tag} is inside a solid`);
        for (const site of h.map.sites) {
          const reach = Math.hypot(p.x - site.position.x, p.z - site.position.z);
          if (Math.abs(p.y - site.position.y) < 1 && reach < SITE_SAMPLE_OFFSET + Math.max(decal.w, decal.h) / 2) {
            problems.push(`${decal.tag} is ${reach.toFixed(1)}m from site ${site.id}, inside its centre's clearance`);
          }
        }
      }

      const restore = quiesce(h);
      const lens = createLens(h);
      const unhide = hideActors(h);
      lens.grab();
      const show = (visible) => { for (const mesh of meshes || []) mesh.visible = visible; };

      // Two draw calls, shown minus hidden, from the lane looking into bay A.
      lens.look({ x: -4.0, y: 1.6, z: -12.0 }, { x: -12.0, y: 1.0, z: -10.0 });
      lens.renderOnly();
      const withDecals = h.renderer.info.render.calls;
      show(false);
      lens.renderOnly();
      const withoutDecals = h.renderer.info.render.calls;
      show(true);
      if (withDecals - withoutDecals !== 2) {
        problems.push(`the decals cost ${withDecals - withoutDecals} draw calls, not two (${withoutDecals} -> ${withDecals})`);
      }

      // A rust band and a stencil are drawn: the pixels that change when
      // they are hidden, from 2.5m off the face.
      const readings = [];
      for (const kind of ['rust', 'stencil']) {
        const decal = decals.find((d) => d.kind === kind);
        if (!decal) continue;
        const p = decal.position;
        const n = decal.normal;
        lens.look({ x: p.x + n.x * 2.5, y: p.y, z: p.z + n.z * 2.5 + 0.01 }, { x: p.x, y: p.y, z: p.z });
        const shown = lens.grab();
        show(false);
        const hidden = lens.grab();
        show(true);
        const changed = difference(shown, hidden, lens.width, lens.height).count;
        readings.push(`${decal.tag} changes ${changed} pixels`);
        if (changed < RUST_PIXELS) problems.push(`${decal.tag} changes ${changed} pixels from 2.5m off its face; it is not drawn`);
      }

      // Every ground stain takes a tenth off the ground under it.
      let stains = 0;
      for (const stain of decals) {
        if (stain.kind !== 'stain' || stain.normal.y < 0.5) continue;
        stains++;
        const p = stain.position;
        lens.look({ x: p.x, y: p.y + 2.2, z: p.z + 0.01 }, { x: p.x, y: p.y, z: p.z });
        const shown = meanLumaIn(lens.grab(), lens.width, lens.height, 0.3);
        show(false);
        const hidden = meanLumaIn(lens.grab(), lens.width, lens.height, 0.3);
        show(true);
        readings.push(`${stain.tag} ${hidden.toFixed(1)} -> ${shown.toFixed(1)}`);
        if (!(hidden - shown >= hidden * STAIN_DIMS)) {
          problems.push(`${stain.tag} leaves the ground at ${shown.toFixed(1)} against ${hidden.toFixed(1)} bare; a stain that does not darken is not drawn`);
        }
      }
      if (stains === 0) problems.push('no stain on the ground');
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
