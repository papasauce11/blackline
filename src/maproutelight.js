/**
 * BLACKLINE - maproutelight.js
 *
 * Route lighting (the redesign's phases 35-41, built as B7). The affordance
 * markings are gone; what tells a player where the stairless ways up are is
 * that they are lit. Two devices, both derived from `map.routes` (B5) and
 * the climb rule's own approaches, nothing named:
 *
 * - Every stage of every route is drawn a step brighter than the same
 *   surface unlit: the material cache's `lit` variant of the box's own
 *   colour (mapbake.js), its colour as emissive at
 *   `map.routeLighting.emissive`, on its four sides - the faces a body
 *   sees from the foot of the route and climbs - and not on its top, which
 *   is what a body standing on it sees and what the next thing along (the
 *   north duct's mouth, B6) is read against. A crate on a route reads
 *   brighter than the identical crate beside it that is not one. Two
 *   material groups on the box, so two draw calls where there was one.
 * - The edge a route goes over at the top carries a lit strip: for each
 *   climbable surface at the route's landing height, every face the rule
 *   names an approach onto from a box of the route's last stage, along the
 *   span of the spots it names and a body radius either side. Warm white, unlit
 *   (MeshBasicMaterial), one merged mesh for the whole map - one draw call.
 *   A lip is lit only where a route actually lands on it (D25).
 *
 * Paint, not lamps. Nothing here is a light the detection model reads
 * (Section 7.1), so a lit route costs the Shade nothing to stand on; it is
 * legibility, decided provisionally as D28. Runs after the climb rule has
 * derived the surfaces (it reads `map.ledges` and `_supportApproaches`) and
 * before validation.
 *
 * Layering (Section 3.1): imports config. The map is handed in.
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';

const M = CONFIG.map;
const P = CONFIG.palette;
const S = CONFIG.shade;

/** Landing height and a climbable top agree to within this. */
const LANDING_TOLERANCE = 0.1;
/** The strip stands proud of the face and the top by this, so it is not the face. */
const STRIP_LIFT = 0.01;

/**
 * Light the declared routes. Fills `map.routeLighting`:
 *   `stages`  every box drawn lit, with the route id it belongs to
 *   `edges`   every strip laid, `{ route, box, nx, nz, from, to, y }`
 *   `mesh`    the one mesh the strips are merged into (null if none)
 *
 * @param {import('./mapkit.js').GameMap} map
 */
export function lightRoutes(map) {
  const stages = [];
  const edges = [];

  for (const route of map.routes) {
    const boxes = route.stages.flat().filter((box) => typeof box !== 'string');
    for (const box of boxes) {
      if (!box.mesh || box.routeLit) continue;
      box.routeLit = route.id;
      lightSides(box.mesh, map.materials);
      stages.push({ route: route.id, box });
    }
    const last = route.stages[route.stages.length - 1].filter((box) => typeof box !== 'string');
    for (const edge of landingEdges(map, route, last)) edges.push(edge);
  }

  const mesh = edges.length ? buildStrips(edges) : null;
  if (mesh) {
    mesh.name = 'route-edges';
    map.root.add(mesh);
  }
  map.routeLighting = { stages, edges, mesh };
  return map.routeLighting;
}

/**
 * Paint a box's four sides lit and leave its caps as they were. BoxGeometry
 * indexes its faces +x, -x, +y, -y, +z, -z, six triangles each; the index is
 * reordered so the sides are one contiguous group and the caps another, and
 * the mesh takes the two materials. The outline mesh (mapkit.js) shares the
 * geometry with one material of its own and ignores the groups.
 */
export function lightSides(mesh, materials) {
  const geometry = mesh.geometry;
  const index = geometry.getIndex();
  const order = [0, 1, 4, 5, 2, 3]; // sides first, then the caps
  const reordered = index.array.slice();
  for (let g = 0; g < 6; g++) {
    for (let i = 0; i < 6; i++) reordered[g * 6 + i] = index.array[order[g] * 6 + i];
  }
  index.array.set(reordered);
  index.needsUpdate = true;
  geometry.clearGroups();
  geometry.addGroup(0, 24, 0);
  geometry.addGroup(24, 12, 1);
  const plain = Array.isArray(mesh.material) ? mesh.material[1] : mesh.material;
  mesh.material = [materials.toon(plain.color.getHex(), true), plain];
}

/** The plain material of a box, whether or not its sides have been lit. */
export function plainMaterialOf(mesh) {
  return Array.isArray(mesh.material) ? mesh.material[1] : mesh.material;
}

/**
 * The faces a route's last stage climbs onto at the landing height, and the
 * span of each to light: where the rule names approaches from a last-stage
 * box onto a climbable surface at the landing, the strip runs along that
 * face over the spots it names, `edgeReach` further either side, clipped to
 * the face. The spots and not the support's extent, because a duct roof
 * runs ten metres along a deck edge and only the part of it in the void is
 * a place to stand for that edge. One entry per (surface, face).
 */
function landingEdges(map, route, last) {
  const out = new Map();
  const reach = M.routeLighting.edgeReach;
  for (const ledge of map.ledges) {
    const box = ledge.box;
    if (Math.abs(box.max.y - route.landing) > LANDING_TOLERANCE) continue;
    for (const approach of map._supportApproaches(box)) {
      if (!last.includes(approach.box)) continue;
      const alongX = approach.nz !== 0; // a z-facing face runs along x
      const faceMin = alongX ? box.min.x : box.min.z;
      const faceMax = alongX ? box.max.x : box.max.z;
      const along = alongX ? approach.x : approach.z;
      const from = Math.max(faceMin, along - reach);
      const to = Math.min(faceMax, along + reach);
      if (to <= from) continue;
      const key = `${box.tag}|${approach.nx}|${approach.nz}`;
      const entry = out.get(key);
      if (entry) {
        entry.from = Math.min(entry.from, from);
        entry.to = Math.max(entry.to, to);
      } else {
        out.set(key, { route: route.id, box, nx: approach.nx, nz: approach.nz, from, to, y: box.max.y });
      }
    }
  }
  return [...out.values()];
}

/** Every strip as a thin box, merged into one geometry and one material. */
function buildStrips(edges) {
  const t = M.routeLighting.edgeThickness;
  const h = M.routeLighting.edgeHeight;
  const chunks = [];
  let total = 0;
  for (const edge of edges) {
    const box = edge.box;
    const alongX = edge.nz !== 0;
    const length = edge.to - edge.from;
    // Outward from the face by the strip's thickness, up past the top by a
    // lift: it sits on the edge you go over, not inside the slab.
    const geometry = alongX
      ? new THREE.BoxGeometry(length, h, t)
      : new THREE.BoxGeometry(t, h, length);
    const facePlane = alongX
      ? (edge.nz > 0 ? box.max.z : box.min.z)
      : (edge.nx > 0 ? box.max.x : box.min.x);
    const outward = (alongX ? edge.nz : edge.nx) * (t / 2 + STRIP_LIFT);
    const centreAlong = (edge.from + edge.to) / 2;
    geometry.translate(
      alongX ? centreAlong : facePlane + outward,
      edge.y - h / 2 + STRIP_LIFT,
      alongX ? facePlane + outward : centreAlong
    );
    const flat = geometry.toNonIndexed();
    chunks.push(flat.attributes.position.array);
    total += flat.attributes.position.array.length;
    geometry.dispose();
    flat.dispose();
  }
  const positions = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    positions.set(chunk, offset);
    offset += chunk.length;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.MeshBasicMaterial({ color: P.lightWarm, fog: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}
