/**
 * BLACKLINE - mapdecals.js
 *
 * Decals (E4): the marks a place picks up. A stain where something leaked,
 * a drip down a wall from the slab above it, the scuff a trolley's wheels
 * leave through a door, and a painted hazard kerb across a threshold. Each
 * is a quad laid a centimetre proud of a solid's face, its UVs into one
 * tile of an atlas this file draws in code from the same hashed noise as
 * the grime (mapmaterials.js) - no image, no rng. Every decal on a map is
 * merged into at most two meshes, one per material, so the lot costs two
 * draw calls:
 *
 * - The grime kinds (stain, drip, scuff) are a multiplier: `MeshBasicMaterial`
 *   with `MultiplyBlending`, so the surface's own lighting shows through
 *   the mark and a stain in the dark vault is as dark as the vault. Fog
 *   is off on it - a fogged multiplier would darken the whole quad at a
 *   distance, mark or no mark.
 * - The paint kind (hazard) is toon-lit paint on the paint finish's ramp,
 *   cut out by `alphaTest`, so it needs no sorting and shadows fall on it.
 *
 * Section 5, amended, has no affordance markings: nothing here is laid on
 * or near a climb, a vent mouth or a site ring, and nothing here is read
 * by the collision world or the rule. Where they go is the map's list
 * (`maps/plantdecals.js`); this file only knows how to lay one.
 *
 * Layering (Section 3.1): imports config, mapbake and mapmaterials. The map
 * is handed in.
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { mergeGeometries } from './mapbake.js';
import { hash2, valueNoise } from './mapmaterials.js';

const D = CONFIG.map.decals;
const P = CONFIG.palette;

/** Tile of the 2x2 atlas each kind draws from, as [column, row]. */
export const DECAL_TILE = {
  stain: [0, 0],
  drip: [1, 0],
  scuff: [0, 1],
  hazard: [1, 1],
};
/** Kinds drawn as a multiplier over the surface; the rest are paint. */
export const GRIME_KINDS = new Set(['stain', 'drip', 'scuff']);

/** A face name to its outward normal. */
export const FACE_NORMAL = {
  up: [0, 1, 0],
  down: [0, -1, 0],
  east: [1, 0, 0],
  west: [-1, 0, 0],
  south: [0, 0, 1],
  north: [0, 0, -1],
};

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------
// The atlas
// ---------------------------------------------------------------------------

/** The stain tile: a blotch with a noise-broken edge, darkest in the middle. */
function stainAt(u, v) {
  const dx = u - 0.5;
  const dy = v - 0.5;
  const r = Math.sqrt(dx * dx + dy * dy) * 2;
  const angle = (Math.atan2(dy, dx) / (Math.PI * 2)) + 0.5;
  const edge = 0.62 + (valueNoise(angle, 0.5, 6, 1, D.seed) - 0.5) * 0.5;
  const inside = smoothstep(edge, edge - 0.3, r);
  const inner = valueNoise(u, v, 5, 5, D.seed + 1);
  return 1 - (0.35 + 0.2 * inner) * inside;
}

/** The drip tile: streaks hanging from the top edge (v = 1), each its own length. */
function dripAt(u, v) {
  const columns = 24;
  const col = Math.floor(u * columns);
  const strength = hash2(col, 0, D.seed + 2);
  if (strength < 0.45) return 1;
  const length = 0.25 + 0.7 * hash2(col, 1, D.seed + 2);
  const across = u * columns - col;
  const width = smoothstep(0, 0.3, across) * smoothstep(1, 0.7, across);
  const down = (1 - v) / length;
  if (down > 1) return 1;
  const fall = Math.pow(1 - down, 1.5);
  return 1 - 0.45 * width * fall * ((strength - 0.45) / 0.55);
}

/** The scuff tile: two wheel tracks along v, broken by noise, trailing off at both ends. */
function scuffAt(u, v) {
  let band = 0;
  for (const centre of [0.32, 0.68]) band = Math.max(band, smoothstep(0.1, 0.05, Math.abs(u - centre)));
  const grain = valueNoise(u, v, 3, 12, D.seed + 3);
  const fade = smoothstep(0, 0.15, v) * smoothstep(1, 0.85, v);
  return 1 - 0.4 * band * (0.6 + 0.4 * grain) * fade;
}

/** The hazard tile: a kerb of orange and dark blocks along v, aged, with a clear margin. Returns [r, g, b, a] 0..1. */
function hazardAt(u, v) {
  const margin = 0.06;
  if (u < margin || u > 1 - margin || v < margin || v > 1 - margin) return [0, 0, 0, 0];
  const block = Math.floor(v * 8) % 2 === 0;
  const colour = new THREE.Color(block ? P.hazardOrange : P.hazardStripe);
  const age = 0.75 + 0.25 * valueNoise(u, v, 6, 6, D.seed + 4);
  return [colour.r * age, colour.g * age, colour.b * age, 1];
}

/**
 * Draw the atlas: `D.atlasSize` square, four tiles. Grey multipliers with
 * full alpha for the grime kinds; colour and a cut-out alpha for the paint.
 */
export function createDecalAtlas() {
  const size = D.atlasSize;
  const tile = size / 2;
  const data = new Uint8Array(size * size * 4);
  const painters = { stain: stainAt, drip: dripAt, scuff: scuffAt };
  for (const [kind, [column, row]] of Object.entries(DECAL_TILE)) {
    for (let y = 0; y < tile; y++) {
      for (let x = 0; x < tile; x++) {
        const u = (x + 0.5) / tile;
        const v = (y + 0.5) / tile;
        const i = ((row * tile + y) * size + column * tile + x) * 4;
        if (kind === 'hazard') {
          const [r, g, b, a] = hazardAt(u, v);
          data[i] = Math.round(r * 255);
          data[i + 1] = Math.round(g * 255);
          data[i + 2] = Math.round(b * 255);
          data[i + 3] = Math.round(a * 255);
        } else {
          const value = Math.round(Math.min(1, Math.max(0, painters[kind](u, v))) * 255);
          data[i] = value;
          data[i + 1] = value;
          data[i + 2] = value;
          data[i + 3] = 255;
        }
      }
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

// ---------------------------------------------------------------------------
// Laying them
// ---------------------------------------------------------------------------

const xAxis = new THREE.Vector3();
const yAxis = new THREE.Vector3();
const zAxis = new THREE.Vector3();
const matrix = new THREE.Matrix4();

/**
 * One quad for a spec: `w` across (the tile's u), `h` along (its v), lying
 * on the face whose normal is `face`, its v axis pointing `along` in the
 * world - up on a wall unless told otherwise, north on a floor - lifted
 * `D.lift` off the surface. UVs are moved into the kind's atlas tile.
 */
function quadFor(spec) {
  const normal = FACE_NORMAL[spec.face];
  if (!normal) throw new Error(`decal ${spec.kind} at ${spec.at}: no face "${spec.face}"`);
  zAxis.set(normal[0], normal[1], normal[2]);
  const along = spec.along || (normal[1] !== 0 ? [0, 0, -1] : [0, 1, 0]);
  yAxis.set(along[0], along[1], along[2]).normalize();
  if (Math.abs(yAxis.dot(zAxis)) > 1e-6) throw new Error(`decal ${spec.kind} at ${spec.at}: "along" is not in the face`);
  xAxis.crossVectors(yAxis, zAxis);
  matrix.makeBasis(xAxis, yAxis, zAxis);
  matrix.setPosition(
    spec.at[0] + normal[0] * D.lift,
    spec.at[1] + normal[1] * D.lift,
    spec.at[2] + normal[2] * D.lift
  );

  const geometry = new THREE.PlaneGeometry(spec.w, spec.h);
  geometry.applyMatrix4(matrix);
  const [column, row] = DECAL_TILE[spec.kind];
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (column + uv.getX(i)) / 2, (row + uv.getY(i)) / 2);
  }
  return geometry;
}

/**
 * Lay every decal in `specs` on `map`: two merged meshes at most, added to
 * `map.root`, and a record per decal on `map.decals` for the checks -
 * `{ kind, position, normal, w, h, tag }`, the position being the point on
 * the surface, not the lifted quad.
 *
 * @param {import('./mapkit.js').GameMap} map
 * @param {object[]} specs `{ kind, at: [x, y, z], face, w, h, along?, tag? }`
 * @returns {{ atlas: THREE.DataTexture, meshes: THREE.Mesh[] }}
 */
export function bakeDecals(map, specs) {
  const atlas = createDecalAtlas();
  const grime = [];
  const paint = [];
  for (const spec of specs) {
    if (!DECAL_TILE[spec.kind]) throw new Error(`decal at ${spec.at}: no kind "${spec.kind}"`);
    (GRIME_KINDS.has(spec.kind) ? grime : paint).push(quadFor(spec));
    const normal = FACE_NORMAL[spec.face];
    map.decals.push({
      kind: spec.kind,
      position: new THREE.Vector3(spec.at[0], spec.at[1], spec.at[2]),
      normal: new THREE.Vector3(normal[0], normal[1], normal[2]),
      w: spec.w,
      h: spec.h,
      tag: spec.tag || spec.kind,
    });
  }

  const meshes = [];
  if (grime.length) {
    const material = new THREE.MeshBasicMaterial({
      map: atlas,
      blending: THREE.MultiplyBlending,
      // r180 refuses a multiply without it (a console error a frame, and
      // the quad drawn opaque white instead); the tiles' alpha is 1 anyway.
      premultipliedAlpha: true,
      transparent: true,
      depthWrite: false,
      fog: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const mesh = new THREE.Mesh(mergeGeometries(grime), material);
    mesh.name = 'decals-grime';
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    meshes.push(mesh);
  }
  if (paint.length) {
    const material = new THREE.MeshToonMaterial({
      color: 0xffffff,
      map: atlas,
      gradientMap: map.materials.toon(P.hazardOrange).gradientMap,
      alphaTest: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const mesh = new THREE.Mesh(mergeGeometries(paint), material);
    mesh.name = 'decals-paint';
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }
  for (const mesh of meshes) map.root.add(mesh);
  map.decalMeshes = meshes;
  return { atlas, meshes };
}
