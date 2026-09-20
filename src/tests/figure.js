/**
 * BLACKLINE - tests/figure.js
 *
 * The Shade and the Warden as figures (E1, E2): what the pixels can say
 * about a silhouette.
 *
 * Section 4 asks for readable silhouettes above all else, and E1 rebuilt
 * the Shade's body for it - a hood, a narrow torso, thin long limbs, each
 * part one merged geometry on one material (entities/agentmesh.js) - and
 * E2 the Warden's - a helmet on the shoulders, a vest, a rifle, a broad
 * stance (entities/wardenmesh.js). A pixel count cannot say whether that
 * reads as a person in a hood or a guard with a gun; it can say that the
 * one drawn shape is tall and narrow with a top wider than the neck under
 * it, that the other is broad with a top narrower than the shoulders under
 * it and something held out in front, and that all of it holds at 25m,
 * where a body is forty pixels tall and a silhouette is all there is. And
 * it can count: six parts, one material, and fewer draw calls than before.
 *
 * The silhouette is the geometry's, so it is read with the body on a flat
 * unlit white for the two frames - the figure as it is in the dark, its
 * shape and nothing else: the yard at night lit half the Shade to within a
 * few levels of the container behind it and the difference frame found a
 * third of it. Whether the map's light shows the body is
 * `the-shade-visibly-dims-with-the-meter`'s and the rim check's question.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import * as THREE from 'three';
import { createLens, difference, quiesce } from './pixels.js';
import { clearLanes, alongLane, HEADINGS } from './lanes.js';

/** The two distances the queue names. */
const DISTANCES = [8, 25];
/** The top of the silhouette that is hood or helmet, and the band under it that is neck or shoulders, as fractions of its height. */
const HOOD_BAND = 0.14;
const NECK_BAND = 0.22;
/** A hood is at least this much wider than the neck under it. */
const HOOD_OVER_NECK = 1.5;
/** Tall and narrow: height over width. */
const NARROW = 2.2;
/** Draw calls a body may add to a frame: six parts and their six hulls (twenty before E1; sixteen for the Warden before E2). */
const DRAW_CALLS = 12;
/** The eye is this far up from the feet, looking at a metre up. */
const EYE = 1.4;
const FOCUS = 1.0;

/** Broad: the Warden's height over its width is at most this. */
const BROAD = 2.0;
/** The two apart: the Shade's aspect over the Warden's, and the Warden's widest row over the Shade's, at least this. */
const APART = 1.5;
/** A helmet on the shoulders: the top band's widest row over the widest row of the band under it, at most this for the Warden ... */
const HELMET_UNDER_SHOULDERS = 0.6;
/** ... and at least this for the Shade, whose hood is as wide as anything under it. */
const HOOD_OVER_ALL_BELOW = 0.9;
/** From the side, the middle of the figure (as fractions of its height from the top) ... */
const CARRY_BAND = [0.3, 0.7];
/** ... reaches ahead of the head by at least this fraction of the height on the Warden (the rifle), and at most this on the Shade. */
const CARRIES = 0.25;
const CARRIES_NOT = 0.1;

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

/** Silhouette extent per screen row inside `bounds`, bottom row first (readPixels rows start at the bottom). */
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
    rows.push(left < 0 ? { left: 0, right: -1, width: 0 } : { left, right, width: right - left + 1 });
  }
  return rows;
}

/**
 * The rows of a silhouette between two fractions of its height measured
 * from the top: `from` 0 is the top row itself, and a band ends where the
 * next begins.
 */
function band(rows, from, to) {
  const top = rows.length - 1;
  const height = rows.length;
  return rows.slice(Math.max(0, Math.round(top - height * to)), from === 0 ? top + 1 : Math.round(top - height * from));
}

const widest = (rows) => Math.max(0, ...rows.map((row) => row.width));
const narrowest = (rows) => Math.min(...rows.filter((row) => row.width > 0).map((row) => row.width));

/**
 * The silhouette of `mesh` from `eye`: render without it and with it, and
 * the difference is the shape. Null when nothing was drawn.
 */
function silhouette(lens, mesh, eye, focus) {
  lens.look(eye, focus);
  mesh.visible = false;
  const without = lens.grab();
  mesh.visible = true;
  const withBody = lens.grab();
  const diff = difference(withBody, without, lens.width, lens.height, 8);
  if (!diff.bounds) return null;
  const b = diff.bounds;
  const height = b.maxY - b.minY + 1;
  const width = b.maxX - b.minX + 1;
  const rows = rowExtents(diff.mask, lens.width, b);
  const hood = band(rows, 0, HOOD_BAND);
  const neck = band(rows, HOOD_BAND, NECK_BAND);
  const carry = band(rows, CARRY_BAND[0], CARRY_BAND[1]);
  // How far the middle of the figure reaches beyond the top of it, on
  // whichever side it does: the rifle ahead of the helmet from the side.
  const reach = (from, to) => Math.max(
    Math.max(...to.map((row) => row.right)) - Math.max(...from.map((row) => row.right)),
    Math.min(...from.filter((row) => row.width).map((row) => row.left)) - Math.min(...to.filter((row) => row.width).map((row) => row.left))
  );
  return {
    count: diff.count,
    height,
    width,
    aspect: height / width,
    hood: widest(hood),
    neck: narrowest(neck),
    below: widest(neck),
    widest: widest(rows),
    reach: reach(hood, carry) / height,
  };
}

/** The draw calls a mesh adds to a frame through `lens`. */
function drawCalls(h, lens, mesh) {
  mesh.visible = false;
  lens.renderOnly();
  const hidden = h.renderer.info.render.calls;
  mesh.visible = true;
  lens.renderOnly();
  return h.renderer.info.render.calls - hidden;
}

/**
 * The shape of a body before any pixel: six body meshes on the one
 * material, each one merged geometry carrying its colours, each with a
 * hull on the one outline material.
 */
function structure(mesh, label) {
  const problems = [];
  const materials = mesh.userData.materials;
  if (!materials || !materials.body || !materials.outline) {
    return { problems: [`the ${label} does not expose one body material and one outline material`], bodies: [], hulls: [], materials: null };
  }
  const bodies = [];
  const hulls = [];
  mesh.traverse((object) => {
    if (!object.isMesh) return;
    if (object.material === materials.outline) hulls.push(object);
    else bodies.push(object);
  });
  const foreign = bodies.filter((body) => body.material !== materials.body);
  if (foreign.length) problems.push(`${foreign.length} ${label} body mesh(es) on a material other than the body's`);
  if (bodies.length !== 6) problems.push(`${bodies.length} ${label} body meshes, want six parts`);
  if (hulls.length !== bodies.length) problems.push(`${hulls.length} ${label} hulls for ${bodies.length} parts`);
  const uncoloured = bodies.filter((body) => !body.geometry.attributes.color);
  if (uncoloured.length) problems.push(`${uncoloured.length} ${label} part(s) without vertex colours - not merged`);
  if (!materials.body.vertexColors) problems.push(`the ${label} body material does not read vertex colours`);
  return { problems, bodies, hulls, materials };
}

/** The body on a flat unlit white, its shadow off; returns the way back. */
function flatten(bodies, materials) {
  const flat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  for (const mesh of bodies) { mesh.material = flat; mesh.castShadow = false; }
  return () => {
    for (const mesh of bodies) { mesh.material = materials.body; mesh.castShadow = true; }
    flat.dispose();
  };
}

/** The yaw that faces `at` from `from`, in the actors' convention (forward is (-sin yaw, -cos yaw)). */
function yawToward(from, at) {
  return Math.atan2(-(at.x - from.x), -(at.z - from.z));
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-shade-reads-as-a-hooded-figure-at-8m-and-25m',
    spec: 'Section 4 (Shade silhouette) / E1',
    name: 'Tall, narrow, and hooded at both distances; six merged parts on one material, twelve draw calls at most',
    run: (h) => {
      const shade = h.shade;
      const { problems, bodies, hulls, materials } = structure(shade.mesh, 'Shade');
      if (!materials) return { pass: false, detail: problems[0] };

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
      const unflatten = flatten(bodies, materials);

      const lens = createLens(h);
      const readings = [];
      let calls = null;
      for (const distance of DISTANCES) {
        const label = `at ${distance}m`;
        const s = silhouette(lens, shade.mesh, eyes[distance], focus);
        if (calls === null) calls = drawCalls(h, lens, shade.mesh);
        if (!s || s.count < (distance <= 8 ? 2000 : 150)) {
          problems.push(`${label} the Shade covered ${s ? s.count : 0} pixels`);
          continue;
        }
        readings.push(`${label} ${s.count}px, ${s.height}x${s.width} (${s.aspect.toFixed(1)}:1), hood ${s.hood}px over neck ${s.neck}px`);
        if (s.aspect < NARROW) problems.push(`${label} the silhouette is ${s.aspect.toFixed(2)}:1, not narrow (${NARROW}:1)`);
        if (!Number.isFinite(s.neck)) problems.push(`${label} no neck rows under the hood`);
        else if (s.hood < s.neck * HOOD_OVER_NECK) {
          problems.push(`${label} the hood is ${s.hood}px over a neck of ${s.neck}px - no hood (want ${HOOD_OVER_NECK}x)`);
        }
      }
      if (calls === null || calls > DRAW_CALLS) problems.push(`the body adds ${calls} draw calls to a frame, at most ${DRAW_CALLS}`);
      if (calls !== null && calls < bodies.length + hulls.length) problems.push(`the body adds ${calls} draw calls, fewer than its ${bodies.length + hulls.length} meshes - something is not drawing`);

      unflatten();
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

  debugTools.registerAutoTest({
    id: 'the-warden-and-the-shade-are-told-apart-by-silhouette-at-25m',
    spec: 'Section 4 (Warden silhouette) / E2',
    name: 'At 25m, as flat shapes: the Warden broad with a helmet narrower than its shoulders and a rifle out in front, the Shade narrow and hooded with nothing held; the Warden six merged parts on one material, twelve draw calls at most',
    run: (h) => {
      const { shade, warden } = h;
      const { problems, bodies, hulls, materials } = structure(warden.mesh, 'Warden');
      if (!materials) return { pass: false, detail: problems[0] };
      const shadeParts = structure(shade.mesh, 'Shade');
      if (!shadeParts.materials) return { pass: false, detail: shadeParts.problems[0] };

      // The same stand and the same 25m eye for both figures, each turned
      // to face the eye and then side-on to it, each on the flat white
      // with the other hidden.
      const far = DISTANCES[DISTANCES.length - 1];
      const restore = quiesce(h);
      const where = standAndEyes(h, far);
      if (!where) { restore(); return { pass: false, detail: `no stand on this map with a clear lane and ${far}m of sight` }; }
      const { lane, stand, focus, eyes } = where;
      const eye = eyes[far];
      const facing = yawToward(stand, eye);
      const views = { front: facing, side: facing + Math.PI / 2 };

      const lens = createLens(h);
      const readings = [];
      const shapes = { shade: {}, warden: {} };
      let calls = null;

      const unflattenShade = flatten(shadeParts.bodies, shadeParts.materials);
      warden.mesh.visible = false;
      for (const [view, yaw] of Object.entries(views)) {
        shade.reset({ position: stand, yaw });
        h.stepFrames(5);
        for (let i = 0; i < 60; i++) shade.updateVisual(1 / 60);
        shapes.shade[view] = silhouette(lens, shade.mesh, eye, focus);
      }
      unflattenShade();

      // The Warden is placed and drawn, never stepped: a stepped frame is
      // the AI's, and it would walk off the stand.
      const unflattenWarden = flatten(bodies, materials);
      shade.mesh.visible = false;
      for (const [view, yaw] of Object.entries(views)) {
        warden.reset({ position: stand, yaw });
        for (let i = 0; i < 60; i++) warden.updateVisual(1 / 60);
        shapes.warden[view] = silhouette(lens, warden.mesh, eye, focus);
        if (calls === null) calls = drawCalls(h, lens, warden.mesh);
      }
      unflattenWarden();
      shade.mesh.visible = true;
      warden.mesh.visible = true;

      for (const who of ['shade', 'warden']) {
        for (const view of Object.keys(views)) {
          const s = shapes[who][view];
          if (!s || s.count < 150) problems.push(`the ${who} from the ${view} covered ${s ? s.count : 0} pixels at ${far}m`);
        }
      }

      if (problems.length === 0) {
        const S = shapes.shade.front;
        const W = shapes.warden.front;
        readings.push(`front: Shade ${S.count}px ${S.height}x${S.width} (${S.aspect.toFixed(1)}:1) hood ${S.hood}px over ${S.neck}-${S.below}px; `
          + `Warden ${W.count}px ${W.height}x${W.width} (${W.aspect.toFixed(1)}:1) helmet ${W.hood}px over shoulders ${W.below}px`);
        if (S.aspect < NARROW) problems.push(`the Shade is ${S.aspect.toFixed(2)}:1, not narrow (${NARROW}:1)`);
        if (W.aspect > BROAD) problems.push(`the Warden is ${W.aspect.toFixed(2)}:1, not broad (${BROAD}:1 at most)`);
        if (S.aspect < W.aspect * APART) problems.push(`the Shade's ${S.aspect.toFixed(2)}:1 is not ${APART}x the Warden's ${W.aspect.toFixed(2)}:1`);
        if (W.widest < S.widest * APART) problems.push(`the Warden's widest row ${W.widest}px is not ${APART}x the Shade's ${S.widest}px`);
        if (!Number.isFinite(S.neck) || S.hood < S.neck * HOOD_OVER_NECK) problems.push(`the Shade's hood ${S.hood}px is not ${HOOD_OVER_NECK}x its neck ${S.neck}px`);
        if (S.hood < S.below * HOOD_OVER_ALL_BELOW) problems.push(`the Shade's hood ${S.hood}px is narrower than the ${S.below}px under it`);
        if (W.hood > W.below * HELMET_UNDER_SHOULDERS) problems.push(`the Warden's helmet ${W.hood}px is not under ${HELMET_UNDER_SHOULDERS} of its shoulders ${W.below}px - a neck, or no pauldrons`);

        const Ss = shapes.shade.side;
        const Ws = shapes.warden.side;
        readings.push(`side: the Warden ${Ws.height}x${Ws.width}, its middle reaches ${(Ws.reach * 100).toFixed(0)}% of its height ahead of its helmet; `
          + `the Shade ${Ss.height}x${Ss.width}, ${(Ss.reach * 100).toFixed(0)}% ahead of its hood`);
        if (Ws.reach < CARRIES) problems.push(`from the side the Warden's middle reaches ${(Ws.reach * 100).toFixed(0)}% of its height past its helmet, want ${CARRIES * 100}% - no rifle`);
        if (Ss.reach > CARRIES_NOT) problems.push(`from the side the Shade's middle reaches ${(Ss.reach * 100).toFixed(0)}% of its height past its hood, at most ${CARRIES_NOT * 100}% - it carries something`);
      }
      if (calls === null || calls > DRAW_CALLS) problems.push(`the Warden's body adds ${calls} draw calls to a frame, at most ${DRAW_CALLS}`);
      if (calls !== null && calls < bodies.length + hulls.length) problems.push(`the Warden's body adds ${calls} draw calls, fewer than its ${bodies.length + hulls.length} meshes - something is not drawing`);

      lens.restore();
      restore();
      // The readings lead either way: a red line has to say what it saw.
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${readings.join('; ')}; the Warden ${bodies.length} parts on one material with vertex colours, ${hulls.length} hulls, `
            + `${calls} draw calls (16 before E2); stood at the lane from ${lane.from}`
          : `${problems.join('; ')} [${readings.join('; ')}]`,
      };
    },
  });
}
