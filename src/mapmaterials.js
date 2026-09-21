/**
 * BLACKLINE - mapmaterials.js
 *
 * What a surface is made of, as distinct from what colour it is (E4). A
 * map that opts in (`new GameMap(..., { finishes })`) draws every solid in
 * one of three finishes, chosen by its palette colour: concrete, painted
 * metal or glass. A finish is a toon ramp of its own and a grime texture:
 *
 * - The ramp (`CONFIG.map.finishes.<finish>.ramp`) is the Section 4
 *   gradient map with its steps tuned to the material. Concrete is matte -
 *   five bands, a soft roll-off, the lit face as bright as before. Paint is
 *   glossy - a flat body and one narrow hot band where the light is nearly
 *   square on, which is the highlight a painted crate has and a concrete
 *   wall does not. Glass is never dark - a pane catches the sky from both
 *   sides. The actors keep boot's shared 4-step ramp.
 * - The grime (`.grime`) is a tiling texture generated here from a hashed
 *   lattice noise - no image, no rng (Section 2): the same texel every
 *   build - multiplied into the surface colour. Concrete is blotched with
 *   the odd darker stain, paint is streaked with fine scratches, glass is
 *   smudged. Every value is below 1, so grime only ever darkens, by a few
 *   percent on average; the palette stays the colour it says.
 *
 * The texture is projected in world space, not stretched per box:
 * `applyWorldUVs` writes each face's UVs from its world position along the
 * two axes it lies in, so a 38m slab and a 1.5m crate wear the same grain
 * and two boxes that meet share it across the seam. The finish's `tile` is
 * the metres one repeat of the texture covers.
 *
 * Emissive is untouched by a `map` in three, so a route-lit stage (B7) still
 * steps up by exactly `routeLighting.emissive` over the grimed surface
 * beside it; and the multiply leaves the contrast between two finishes
 * where it was, which is what the vent-mouth check measures (B6).
 *
 * Layering (Section 3.1): imports config only. mapbake.js takes the set
 * this builds; nothing here knows a map.
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';

const P = CONFIG.palette;

// ---------------------------------------------------------------------------
// Ramps
// ---------------------------------------------------------------------------

/**
 * A toon ramp from a list of levels, one texel each, nearest-filtered so the
 * bands are hard. The shader reads `texture2D(gradientMap, dotNL * 0.5 +
 * 0.5).r`, so texel i covers the dotNL range [-1 + 2i/n, -1 + 2(i+1)/n):
 * eight levels are quarter-steps of dotNL. `createToonGradient(steps)` in
 * view.js is the evenly spaced case of this and stays the actors' ramp.
 * @param {number[]} levels 0..1, low to high
 */
export function createRamp(levels) {
  const data = new Uint8Array(levels.length);
  for (let i = 0; i < levels.length; i++) data[i] = Math.round(Math.min(1, Math.max(0, levels[i])) * 255);
  const texture = new THREE.DataTexture(data, levels.length, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

// ---------------------------------------------------------------------------
// Noise. A hashed lattice, bilinear between the lattice points, periodic so
// the texture tiles. Deterministic by coordinate: not a random call, so it
// is outside Section 2's one-rng rule the way a sine is.
// ---------------------------------------------------------------------------

/** An integer hash to [0, 1). */
export function hash2(x, y, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Value noise at (u, v) in [0, 1), over a lattice of `cellsU` x `cellsV`
 * points that wraps at 1. Smoothstep between lattice values.
 */
export function valueNoise(u, v, cellsU, cellsV, seed) {
  const x = u * cellsU;
  const y = v * cellsV;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const xa = ((x0 % cellsU) + cellsU) % cellsU;
  const ya = ((y0 % cellsV) + cellsV) % cellsV;
  const xb = (xa + 1) % cellsU;
  const yb = (ya + 1) % cellsV;
  const a = hash2(xa, ya, seed);
  const b = hash2(xb, ya, seed);
  const c = hash2(xa, yb, seed);
  const d = hash2(xb, yb, seed);
  const top = a + (b - a) * sx;
  const bottom = c + (d - c) * sx;
  return top + (bottom - top) * sy;
}

/**
 * The grime multiplier at (u, v) for a finish's spec, 0..1.
 *
 * `layers` sum weighted noises (each `{ cells: [u, v], weight }`; unequal
 * cells stretch the grain into streaks) and the sum is mapped onto
 * [`low`, `high`]. `stain`, if given, is a low-frequency noise that darkens
 * by `depth` where it exceeds `threshold` - the blotches on concrete.
 */
export function grimeAt(spec, u, v) {
  let sum = 0;
  let weight = 0;
  for (let i = 0; i < spec.layers.length; i++) {
    const layer = spec.layers[i];
    sum += valueNoise(u, v, layer.cells[0], layer.cells[1], spec.seed + i) * layer.weight;
    weight += layer.weight;
  }
  let value = spec.low + (spec.high - spec.low) * (weight > 0 ? sum / weight : 1);
  if (spec.stain) {
    const s = spec.stain;
    const n = valueNoise(u, v, s.cells[0], s.cells[1], spec.seed + 97);
    if (n > s.threshold) value -= s.depth * ((n - s.threshold) / (1 - s.threshold));
  }
  return Math.min(1, Math.max(0, value));
}

/**
 * A tiling grime texture, `spec.size` texels square, grey, sRGB - a
 * multiplier in the space the palette's colours are in. Repeats every
 * `spec.tile` metres of the world-projected UVs.
 */
export function createGrimeTexture(spec) {
  const size = spec.size;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const value = Math.round(grimeAt(spec, (x + 0.5) / size, (y + 0.5) / size) * 255);
      const i = (y * size + x) * 4;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / spec.tile, 1 / spec.tile);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

// ---------------------------------------------------------------------------
// The set
// ---------------------------------------------------------------------------

/**
 * Build every finish in `spec` (`CONFIG.map.finishes`): a ramp and a grime
 * texture each, and the palette lookup that says which finish a colour is.
 * `byPalette` names palette entries, not hex values, so a colour that is
 * retuned stays the finish it was; a colour it does not name is concrete,
 * the structure everything else stands on.
 *
 * @returns {{ names: string[], get(name): object, of(color): object, dispose() }}
 */
export function createFinishSet(spec) {
  const finishes = new Map();
  for (const name of Object.keys(spec)) {
    if (name === 'byPalette' || name === 'fallback') continue;
    const entry = spec[name];
    finishes.set(name, {
      name,
      ramp: createRamp(entry.ramp),
      grime: createGrimeTexture(entry.grime),
      tile: entry.grime.tile,
    });
  }
  const byColor = new Map();
  for (const [paletteKey, finishName] of Object.entries(spec.byPalette)) {
    if (P[paletteKey] === undefined) throw new Error(`finishes.byPalette names no palette entry "${paletteKey}"`);
    if (!finishes.has(finishName)) throw new Error(`palette "${paletteKey}" names no finish "${finishName}"`);
    byColor.set(P[paletteKey], finishes.get(finishName));
  }
  const fallback = finishes.get(spec.fallback);
  if (!fallback) throw new Error(`finishes.fallback names no finish "${spec.fallback}"`);
  return {
    names: [...finishes.keys()],
    get(name) {
      return finishes.get(name) || null;
    },
    /** The finish a palette colour (a hex number) is drawn in. */
    of(color) {
      return byColor.get(color) || fallback;
    },
    dispose() {
      for (const finish of finishes.values()) {
        finish.ramp.dispose();
        finish.grime.dispose();
      }
      finishes.clear();
      byColor.clear();
    },
  };
}

// ---------------------------------------------------------------------------
// World-projected UVs
// ---------------------------------------------------------------------------

/**
 * Rewrite a geometry's UVs from its world position: for each vertex, the
 * two world axes its face lies in, in metres. A box's six faces each get
 * their own projection by their normal (x-facing faces read z and y, y-facing
 * x and z, z-facing x and y), so the texture never smears along a face and
 * two boxes that meet continue each other's grain. Geometry must carry a
 * normal attribute; BoxGeometry does. The texture's `repeat` turns the
 * metres into tiles.
 */
export function applyWorldUVs(geometry, cx, cy, cz) {
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const count = position.count;
  const uv = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = position.getX(i) + cx;
    const y = position.getY(i) + cy;
    const z = position.getZ(i) + cz;
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const nz = Math.abs(normal.getZ(i));
    if (nx >= ny && nx >= nz) {
      uv[i * 2] = z;
      uv[i * 2 + 1] = y;
    } else if (ny >= nz) {
      uv[i * 2] = x;
      uv[i * 2 + 1] = z;
    } else {
      uv[i * 2] = x;
      uv[i * 2 + 1] = y;
    }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
