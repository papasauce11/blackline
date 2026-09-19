/**
 * BLACKLINE - tests/figure.js
 *
 * The Shade as a figure (E1): what the pixels can say about a silhouette.
 *
 * Section 4 asks for readable silhouettes above all else, and E1 rebuilt
 * the Shade's body for it - a hood, a narrow torso, thin long limbs, each
 * part one merged geometry on one material (entities/agentmesh.js). A
 * pixel count cannot say whether that reads as a person in a hood; it can
 * say that the drawn shape is tall and narrow, that its top is a hood - a
 * head wider than the neck under it, which the old figure's small sphere
 * on a fat capsule never was - and that both hold at 25m as well as 8m,
 * where a body is thirty pixels tall and a silhouette is all there is. And
 * it can count: six parts, one material, and fewer draw calls than before.
 *
 * The silhouette is the geometry's, so it is read with the body on a flat
 * unlit white for the two frames: the yard at night lit half the figure
 * to within a few levels of the container behind it and the difference
 * frame found a third of it. Whether the map's light shows the body is
 * `the-shade-visibly-dims-with-the-meter`'s and the rim check's question.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import * as THREE from 'three';
import { createLens, difference, quiesce } from './pixels.js';
import { clearLanes, alongLane, HEADINGS } from './lanes.js';

/** The two distances the queue names. */
const DISTANCES = [8, 25];
/** The top of the silhouette that is hood, and the band under it that is neck, as fractions of its height. */
const HOOD_BAND = 0.14;
const NECK_BAND = 0.22;
/** A hood is at least this much wider than the neck under it. */
const HOOD_OVER_NECK = 1.5;
/** Tall and narrow: height over width. */
const NARROW = 2.2;
/** Draw calls the body may add to a frame: six parts and their six hulls (twenty before E1). */
const DRAW_CALLS = 12;
/** The eye is this far up from the feet, looking at a metre up. */
const EYE = 1.4;
const FOCUS = 1.0;

/**
 * Somewhere to stand with a clear line of sight to it from `far` metres away
 * and from 8: the first clear lane (open floor, the 8m eye down it) from
 * which some heading has an eye at `far` in open air that sees the stand.
 * A run a body walks is not needed at 25m; sight is.
 */
function standAndEyes(h, far) {
  const world = h.map.collision;
  const eyeHalf = { x: 0.2, y: 0.2, z: 0.2 };
  for (const lane of clearLanes(h, 9)) {
    const stand = alongLane(lane, 0.5);
    const focus = { x: stand.x, y: stand.y + FOCUS, z: stand.z };
    const near = alongLane(lane, 0.5 + 8);
    for (const heading of [{ dx: lane.dx, dz: lane.dz }, ...HEADINGS]) {
      const eye = { x: stand.x + heading.dx * far, y: stand.y + EYE, z: stand.z + heading.dz * far };
      if (!world.isClear(eye, eyeHalf)) continue;
      if (!world.lineOfSight(eye, focus)) continue;
      return { lane, stand, focus, eyes: { 8: { x: near.x, y: stand.y + EYE, z: near.z }, [far]: eye } };
    }
  }
  return null;
}

/** Silhouette width per screen row inside `bounds`, bottom row first (readPixels rows start at the bottom). */
function rowExtents(mask, width, bounds) {
  const rows = [];
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    let left = -1;
    let right = -1;
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      if (!mask[y * width + x]) continue;
      if (left < 0) left = x;
      right = x;
    }
    rows.push(left < 0 ? 0 : right - left + 1);
  }
  return rows;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-shade-reads-as-a-hooded-figure-at-8m-and-25m',
    spec: 'Section 4 (Shade silhouette) / E1',
    name: 'Tall, narrow, and hooded at both distances; six merged parts on one material, twelve draw calls at most',
    run: (h) => {
      const problems = [];
      const shade = h.shade;
      const materials = shade.mesh.userData.materials;
      if (!materials || !materials.body || !materials.outline) return { pass: false, detail: 'the Shade does not expose one body material and one outline material' };

      // The shape of the thing, before any pixel: six body meshes on the one
      // material, each one merged geometry carrying its colours, each with
      // a hull on the one outline material.
      const bodies = [];
      const hulls = [];
      shade.mesh.traverse((object) => {
        if (!object.isMesh) return;
        if (object.material === materials.outline) hulls.push(object);
        else bodies.push(object);
      });
      const foreign = bodies.filter((mesh) => mesh.material !== materials.body);
      if (foreign.length) problems.push(`${foreign.length} body mesh(es) on a material other than the body's`);
      if (bodies.length !== 6) problems.push(`${bodies.length} body meshes, want six parts`);
      if (hulls.length !== bodies.length) problems.push(`${hulls.length} hulls for ${bodies.length} parts`);
      const uncoloured = bodies.filter((mesh) => !mesh.geometry.attributes.color);
      if (uncoloured.length) problems.push(`${uncoloured.length} part(s) without vertex colours - not merged`);
      if (!materials.body.vertexColors) problems.push('the body material does not read vertex colours');

      // Somewhere to stand at the near end of a clear lane, facing down it,
      // with an eye 8m down the lane and one 25m away in open air that sees
      // the stand; and the body on a flat white for the frames (above),
      // its shadow off - the shadow is in the difference too, on the
      // ground and long under the yard's low key.
      const restore = quiesce(h);
      const where = standAndEyes(h, DISTANCES[DISTANCES.length - 1]);
      if (!where) { restore(); return { pass: false, detail: `no stand on this map with a clear lane and ${DISTANCES[DISTANCES.length - 1]}m of sight` }; }
      const { lane, stand, focus, eyes } = where;
      shade.reset({ position: stand, yaw: lane.yaw });
      h.stepFrames(5);
      for (let i = 0; i < 60; i++) shade.updateVisual(1 / 60);
      const flat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
      for (const mesh of bodies) { mesh.material = flat; mesh.castShadow = false; }

      const lens = createLens(h);
      const readings = [];
      let calls = null;
      for (const distance of DISTANCES) {
        lens.look(eyes[distance], focus);
        shade.mesh.visible = false;
        const without = lens.grab();
        if (calls === null) {
          lens.renderOnly();
          const hidden = h.renderer.info.render.calls;
          shade.mesh.visible = true;
          lens.renderOnly();
          calls = h.renderer.info.render.calls - hidden;
        }
        shade.mesh.visible = true;
        const withBody = lens.grab();
        const diff = difference(withBody, without, lens.width, lens.height, 8);
        const label = `at ${distance}m`;
        if (!diff.bounds || diff.count < (distance <= 8 ? 2000 : 150)) {
          problems.push(`${label} the Shade covered ${diff.count} pixels`);
          continue;
        }
        const b = diff.bounds;
        const height = b.maxY - b.minY + 1;
        const width = b.maxX - b.minX + 1;
        const rows = rowExtents(diff.mask, lens.width, b);
        // Rows run bottom to top; the hood is the top of the figure.
        const top = rows.length - 1;
        const hoodRows = rows.slice(Math.max(0, Math.round(top - height * HOOD_BAND)), top + 1);
        const neckRows = rows.slice(Math.max(0, Math.round(top - height * NECK_BAND)), Math.round(top - height * HOOD_BAND));
        const hoodW = Math.max(...hoodRows);
        const neckW = Math.min(...neckRows.filter((w) => w > 0));
        const aspect = height / width;
        readings.push(`${label} ${diff.count}px, ${height}x${width} (${aspect.toFixed(1)}:1), hood ${hoodW}px over neck ${neckW}px`);
        if (aspect < NARROW) problems.push(`${label} the silhouette is ${aspect.toFixed(2)}:1, not narrow (${NARROW}:1)`);
        if (!neckRows.length || !Number.isFinite(neckW)) problems.push(`${label} no neck rows under the hood`);
        else if (hoodW < neckW * HOOD_OVER_NECK) {
          problems.push(`${label} the hood is ${hoodW}px over a neck of ${neckW}px - no hood (want ${HOOD_OVER_NECK}x)`);
        }
      }
      if (calls === null || calls > DRAW_CALLS) problems.push(`the body adds ${calls} draw calls to a frame, at most ${DRAW_CALLS}`);
      if (calls !== null && calls < bodies.length + hulls.length) problems.push(`the body adds ${calls} draw calls, fewer than its ${bodies.length + hulls.length} meshes - something is not drawing`);

      for (const mesh of bodies) { mesh.material = materials.body; mesh.castShadow = true; }
      flat.dispose();
      shade.mesh.visible = true;
      lens.restore();
      restore();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${readings.join('; ')}; ${bodies.length} parts on one material with vertex colours, ${hulls.length} hulls, `
            + `${calls} draw calls (20 before E1); stood at the lane from ${lane.from}`
          : problems.join('; '),
      };
    },
  });
}
