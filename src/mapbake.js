/**
 * BLACKLINE — mapbake.js
 *
 * The build-time geometry helpers `mapkit.js` constructs the level with:
 * shared materials, the Section 4.1 contact tint, the rectangle maths the plate
 * and wall generators cut on, and a minimal geometry merger.
 *
 * Layering (Section 3.1): imports config only. Split out of mapkit.js, which
 * was 1103 lines against the ~600 guidance; this is the half that has no
 * knowledge of a map at all — every function here takes geometry in and hands
 * geometry back.
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';

const M = CONFIG.map;

/** Coordinates closer than this are the same cut line. */
export const CUT_EPSILON = 1e-6;
/** Step used when sweeping a capsule through a candidate opening. */
export const SWEEP_STEP = 0.15;

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

/**
 * Toon materials are shared by colour so the whole shell draws from a handful
 * of programs. Per-box contact darkness rides on a vertex-colour attribute
 * (Section 4.1) rather than on a per-box material.
 *
 * A `lit` variant of each colour (B7) is the same material with its own
 * colour as emissive at `map.routeLighting.emissive`: a step brighter than
 * the same surface unlit, from every angle and in every light, without a
 * light in the scene - the detection model reads point lights (Section 7.1)
 * and this is paint, not a lamp. One more material per lit colour, cached
 * the same way.
 *
 * With a finish set (E4, mapmaterials.js) each colour's material takes the
 * ramp and the grime texture of the finish that colour is - concrete,
 * paint or glass - in place of the shared ramp; the lit variant keeps the
 * finish, so a route-lit crate is still a painted one. Without one (the
 * yard, until E5) every material is on `gradientMap` with no texture, as
 * before.
 */
export function createMaterialCache(gradientMap, finishes = null) {
  const cache = new Map();
  const dressing = (color) => {
    const finish = finishes ? finishes.of(color) : null;
    return finish ? { gradientMap: finish.ramp, map: finish.grime } : { gradientMap };
  };
  return {
    toon(color, lit = false) {
      const key = lit ? `${color}:lit` : color;
      let material = cache.get(key);
      if (!material) {
        material = new THREE.MeshToonMaterial({ color, ...dressing(color), vertexColors: true });
        if (lit) {
          material.emissive.set(color);
          material.emissiveIntensity = M.routeLighting.emissive;
        }
        cache.set(key, material);
      }
      return material;
    },
    /**
     * Glazing (D3): the same toon shading, drawn translucent and from both
     * sides so a pane reads from inside the booth and out. No depth write,
     * so the panes behind a pane still draw; the collision box under it is
     * as solid as any other.
     */
    glass(color) {
      const key = `${color}:glass`;
      let material = cache.get(key);
      if (!material) {
        material = new THREE.MeshToonMaterial({
          color, ...dressing(color), vertexColors: true,
          transparent: true, opacity: M.glassOpacity, depthWrite: false, side: THREE.DoubleSide,
        });
        cache.set(key, material);
      }
      return material;
    },
    /** Every material made so far, with its cache key. For the checks. */
    entries() {
      return [...cache.entries()];
    },
    dispose() {
      for (const material of cache.values()) material.dispose();
      cache.clear();
    },
    get size() {
      return cache.size;
    },
  };
}

// ---------------------------------------------------------------------------
// Contact tint (Section 4.1: baked vertex tint, applied once at build time)
// ---------------------------------------------------------------------------

export function applyContactTint(geometry, centreY) {
  const position = geometry.attributes.position;
  const count = position.count;
  const colors = new Float32Array(count * 3);
  const strength = M.vertexTintStrength;
  const height = M.vertexTintHeight;

  for (let i = 0; i < count; i++) {
    const worldY = position.getY(i) + centreY;
    const t = Math.min(1, Math.max(0, worldY / height));
    const shade = 1 - strength * (1 - t);
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// ---------------------------------------------------------------------------
// Rectangle helpers used by the plate and wall generators
// ---------------------------------------------------------------------------

/**
 * Cut lines along one axis: the plate's own edges plus every rectangle edge
 * that falls strictly inside it. Splitting the plate on these means a void or
 * a lip always lands on cell boundaries, never half-covering a cell.
 */
export function collectCuts(low, high, rects, key0, key1) {
  const cuts = [low, high];
  for (const rect of rects) {
    for (const value of [rect[key0], rect[key1]]) {
      if (value > low + CUT_EPSILON && value < high - CUT_EPSILON) cuts.push(value);
    }
  }
  cuts.sort((a, b) => a - b);
  const unique = [];
  for (const value of cuts) {
    if (unique.length === 0 || value - unique[unique.length - 1] > CUT_EPSILON) unique.push(value);
  }
  return unique;
}

export function containsPoint(rect, x, z) {
  return x > rect.x0 && x < rect.x1 && z > rect.z0 && z < rect.z1;
}

// ---------------------------------------------------------------------------
// Static-geometry merging
//
// Three's BufferGeometryUtils lives in the addons bundle, which index.html
// deliberately does not fetch — the import map pins exactly one file and the
// game makes no other network request. These two helpers are the sliver of it
// the map needs, for baked decoration that never moves.
// ---------------------------------------------------------------------------

const bakeMatrix = new THREE.Matrix4();
const bakeEuler = new THREE.Euler();

/** Move a geometry into world space and add it to a merge bucket. */
export function bake(bucket, geometry, x, y, z, rotationX = 0, rotationZ = 0) {
  bakeEuler.set(rotationX, 0, rotationZ);
  bakeMatrix.makeRotationFromEuler(bakeEuler);
  bakeMatrix.setPosition(x, y, z);
  geometry.applyMatrix4(bakeMatrix);
  bucket.parts.push(geometry);
}

/**
 * Concatenate geometries into one. Position and normal, and uv when every
 * part carries it (the decals, E4).
 */
export function mergeGeometries(parts) {
  let total = 0;
  const flattened = parts.map((part) => {
    const plain = part.index ? part.toNonIndexed() : part;
    if (plain !== part) part.dispose();
    total += plain.attributes.position.count;
    return plain;
  });
  const withUv = flattened.every((part) => part.attributes.uv);

  const position = new Float32Array(total * 3);
  const normal = new Float32Array(total * 3);
  const uv = withUv ? new Float32Array(total * 2) : null;
  let offset = 0;
  for (const part of flattened) {
    position.set(part.attributes.position.array, offset * 3);
    normal.set(part.attributes.normal.array, offset * 3);
    if (uv) uv.set(part.attributes.uv.array, offset * 2);
    offset += part.attributes.position.count;
    part.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  if (uv) merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  merged.computeBoundingSphere();
  return merged;
}
