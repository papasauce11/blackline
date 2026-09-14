/**
 * BLACKLINE - tests/legibility.js
 *
 * Legibility without markings (the redesign's phases 35-41). The affordance
 * markings are gone; what is left has to read by what it is made of and how
 * it is lit. These checks stand where a player stands and read the pixels.
 *
 * The first (B6): a duct reads as passable by material contrast - galvanised
 * sheet against concrete - and the check measures it from the approach to
 * every mouth. It settles that the contrast is on screen at the number the
 * job asked for. Whether metal-against-concrete *reads as a duct* to a person
 * is HUMAN; see tests/pixels.js for that boundary.
 *
 * The second (B7): the stairless routes up are lit - every stage a step
 * brighter than it would be unlit, the edge each lands over carrying a lit
 * strip (maproutelight.js) - and the check stands at the foot of every
 * declared route and reads both from the pixels, against the same stage
 * painted unlit in the same frame.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createLens, difference, quiesce } from './pixels.js';
import { plainMaterialOf } from '../maproutelight.js';

const S = CONFIG.shade;

/**
 * Michelson contrast between two luminances, 0..1. Invariant to how bright
 * the light is, which is the point: a metal duct in the dark vault and one
 * in the lit hall are the same material and should read the same.
 */
export function michelson(a, b) {
  return a + b > 0 ? Math.abs(a - b) / (a + b) : 0;
}

/** The job's number: B6's done-when, luminance contrast at least this. */
export const VENT_CONTRAST_MIN = 0.25;
/**
 * B7's numbers. A route's first stage, seen from its foot, reads at least
 * this much brighter (luma, 0..255) than the same surface would unlit -
 * the light itself - and at least this Michelson against its surround; the
 * strip on the edge it lands over reads at least this against what is
 * round it, from where the rule says you stand to go over. Measured before
 * they were set: the stages read 16 to 27 of step and 0.30 to 0.61 of
 * contrast, the strips 0.72 to 0.98 (PROGRESS.md, B7).
 */
export const ROUTE_LIGHT_STEP = 10;
export const ROUTE_CONTRAST_MIN = 0.25;
export const EDGE_CONTRAST_MIN = 0.5;
/** Fewest pixels a strip needs on screen before its mean means anything. */
const EDGE_MIN_PIXELS = 200;

/**
 * How far back from a walk-in mouth the approach is measured from, nearest
 * last: a mouth that opens onto a crate top, or out through the fence line,
 * has less floor in front of it than one on the hall floor.
 */
const WALK_IN_DISTANCES = [3.0, 2.5, 2.0, 1.5, 1.0];
/** Fewest pixels a region needs before its mean means anything. */
const MIN_REGION_PIXELS = 400;

/** Luma of one pixel of a frame, 0..255. */
function lumaAt(frame, i) {
  const p = i * 4;
  return 0.2126 * frame[p] + 0.7152 * frame[p + 1] + 0.0722 * frame[p + 2];
}

/**
 * The top of whatever is under (x, z) at the run's floor height, give or take
 * a step: the surface a body walks into this mouth from. Null when the floor
 * there is not level with the run - that mouth is climbed, not walked, into.
 */
function levelFloorUnder(h, x, z, floorY) {
  let best = null;
  for (const box of h.map.collision.boxes) {
    if (!box.solid) continue;
    if (x < box.min.x || x > box.max.x || z < box.min.z || z > box.max.z) continue;
    if (box.max.y > floorY + 0.05 || box.max.y < floorY - S.reach.stepOver) continue;
    if (best === null || box.max.y > best) best = box.max.y;
  }
  return best;
}

/**
 * Where a body stands to arrive at this mouth, at floor height.
 *
 * A mouth with a lip is climbed into, and the climb rule already names every
 * spot a body can climb it from: the lowest of those on the mouth's own face
 * is the approach. Otherwise the mouth is walked into - at grade, or off a
 * surface level with the run's floor, the way the north duct opens onto the
 * hall's crate stack - from straight out along the run, as far back as there
 * is level floor to stand on. Null when there is neither.
 */
function approachSpot(h, vent, mouth) {
  const alongX = vent.axis === 'x';
  // Outward along the run's axis, away from the interior.
  const out = mouth === 'from' ? -1 : 1;
  const nx = alongX ? out : 0;
  const nz = alongX ? 0 : out;
  const lip = vent.boxes.find((box) => box.tag === `${vent.tag}-lip-${mouth}`);
  if (lip) {
    const spots = h.map._supportApproaches(lip).filter((spot) => spot.nx === nx && spot.nz === nz);
    if (spots.length > 0) {
      spots.sort((a, b) => a.y - b.y);
      return { x: spots[0].x, y: spots[0].y, z: spots[0].z, from: `${spots[0].box.tag} (climbed)` };
    }
  }
  const end = mouth === 'from' ? (alongX ? vent.min.x : vent.min.z) : (alongX ? vent.max.x : vent.max.z);
  const cross = alongX ? (vent.min.z + vent.max.z) / 2 : (vent.min.x + vent.max.x) / 2;
  const standHalf = { x: S.radius, y: S.standHeight / 2, z: S.radius };
  for (const distance of WALK_IN_DISTANCES) {
    const along = end + out * distance;
    const x = alongX ? along : cross;
    const z = alongX ? cross : along;
    const y = levelFloorUnder(h, x, z, vent.min.y);
    if (y === null) continue;
    if (!h.map.collision.isClear({ x, y: y + S.standHeight / 2 + 0.02, z }, standHalf)) continue;
    return { x, y, z, from: `${distance.toFixed(1)}m out (walked)` };
  }
  return null;
}

/** The four corners of the opening at one end of a run, in world space. */
function mouthCorners(vent, mouth) {
  const alongX = vent.axis === 'x';
  const along = mouth === 'from' ? (alongX ? vent.min.x : vent.min.z) : (alongX ? vent.max.x : vent.max.z);
  const c0 = alongX ? vent.min.z : vent.min.x;
  const c1 = alongX ? vent.max.z : vent.max.x;
  const corners = [];
  for (const [c, y] of [[c0, vent.min.y], [c1, vent.min.y], [c1, vent.max.y], [c0, vent.max.y]]) {
    corners.push(alongX ? new THREE.Vector3(along, y, c) : new THREE.Vector3(c, y, along));
  }
  return corners;
}

/**
 * Project a world-space rectangle through the lens's camera into pixel space
 * (GL rows, bottom up, the way `readPixels` hands them back).
 */
function projectQuad(camera, corners, width, height) {
  return corners.map((corner) => {
    const v = corner.clone().project(camera);
    return { x: ((v.x + 1) / 2) * width, y: ((v.y + 1) / 2) * height };
  });
}

/** Inside a convex quad, whichever way round its corners run. */
function insideQuad(quad, x, y) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    if (cross === 0) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/**
 * Read one mouth: mean luma of what is seen THROUGH the opening (the
 * interior), of everything the run draws (its body), and of the concrete
 * around the opening (the surround).
 */
function readMouth(h, lens, vent, mouth, spot) {
  const eye = { x: spot.x, y: spot.y + S.standHeight * S.eyeHeightRatio, z: spot.z };
  const corners = mouthCorners(vent, mouth);
  const centre = corners[0].clone().add(corners[2]).multiplyScalar(0.5);
  lens.look(eye, centre);

  const shown = lens.grab();
  for (const box of vent.boxes) box.mesh.visible = false;
  const hidden = lens.grab();
  for (const box of vent.boxes) box.mesh.visible = true;

  const { width, height } = lens;
  const duct = difference(shown, hidden, width, height);
  const quad = projectQuad(h.camera, corners, width, height);
  const xs = quad.map((p) => p.x);
  const ys = quad.map((p) => p.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const hh = Math.max(...ys) - Math.min(...ys);
  // The surround is a band around the opening about as wide as the opening
  // itself: the wall it goes through, the floor under it, nothing further.
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - w * 0.6));
  const x1 = Math.min(width - 1, Math.ceil(Math.max(...xs) + w * 0.6));
  const y0 = Math.max(0, Math.floor(Math.min(...ys) - hh * 0.6));
  const y1 = Math.min(height - 1, Math.ceil(Math.max(...ys) + hh * 0.6));

  const sum = { interior: 0, body: 0, surround: 0 };
  const count = { interior: 0, body: 0, surround: 0 };
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * width + x;
      const luma = lumaAt(shown, i);
      if (duct.mask[i]) {
        sum.body += luma;
        count.body++;
        if (insideQuad(quad, x + 0.5, y + 0.5)) {
          sum.interior += luma;
          count.interior++;
        }
      } else {
        sum.surround += luma;
        count.surround++;
      }
    }
  }
  const mean = (key) => (count[key] ? sum[key] / count[key] : 0);
  return {
    interior: mean('interior'),
    body: mean('body'),
    surround: mean('surround'),
    pixels: count,
    eye,
  };
}

export function register(debugTools) {
  // -------------------------------------------------------------------------
  // B6 - vents read by material contrast
  // -------------------------------------------------------------------------
  debugTools.registerAutoTest({
    id: 'every-vent-mouth-reads-by-contrast-from-its-approach',
    spec: 'Section 5, amended (B6)',
    name: 'From the approach to every vent mouth, the duct and what is seen through it contrast with the concrete around it',
    run: (h) => {
      const problems = [];
      const readings = [];
      const restore = quiesce(h);
      const lens = createLens(h);

      // The actors are lit geometry; get them out of every frame.
      h.shade.mesh.visible = false;
      h.warden.mesh.visible = false;
      h.shade.groundBlob.visible = false;
      h.warden.groundBlob.visible = false;
      lens.grab();

      let mouths = 0;
      for (const vent of h.map.vents) {
        if (!Array.isArray(vent.mouths) || vent.mouths.length === 0) {
          problems.push(`${vent.tag} declares no mouths`);
          continue;
        }
        for (const mouth of vent.mouths) {
          mouths++;
          const label = `${vent.tag} (${mouth})`;
          const spot = approachSpot(h, vent, mouth);
          if (!spot) {
            problems.push(`${label}: no approach - the rule names no climb onto its lip and there is no level floor to walk in from`);
            continue;
          }
          const read = readMouth(h, lens, vent, mouth, spot);
          const interior = michelson(read.interior, read.surround);
          const body = michelson(read.body, read.surround);
          readings.push({ label, from: spot.from, interior, body, read });

          if (read.pixels.interior < MIN_REGION_PIXELS) {
            problems.push(`${label}: only ${read.pixels.interior} interior pixels through the mouth from the approach`);
            continue;
          }
          if (read.pixels.surround < MIN_REGION_PIXELS) {
            problems.push(`${label}: only ${read.pixels.surround} pixels of surround around the mouth`);
            continue;
          }
          if (interior < VENT_CONTRAST_MIN) {
            problems.push(
              `${label}: the interior reads ${read.interior.toFixed(1)} against a surround of ${read.surround.toFixed(1)}, `
              + `contrast ${interior.toFixed(2)} < ${VENT_CONTRAST_MIN}`
            );
          }
          if (body < VENT_CONTRAST_MIN) {
            problems.push(
              `${label}: the duct reads ${read.body.toFixed(1)} against a surround of ${read.surround.toFixed(1)}, `
              + `contrast ${body.toFixed(2)} < ${VENT_CONTRAST_MIN}`
            );
          }
        }
      }
      if (mouths < 5) problems.push(`only ${mouths} mouths measured; the map declares more runs than that`);
      if (lens.glError() !== 0) problems.push('GL error during the reads');

      h.shade.mesh.visible = true;
      h.warden.mesh.visible = true;
      h.shade.groundBlob.visible = true;
      h.warden.groundBlob.visible = true;
      lens.restore();
      restore();

      const summary = readings
        .map((r) => `${r.label} from ${r.from}: interior ${r.interior.toFixed(2)} (${r.read.interior.toFixed(0)}), `
          + `duct ${r.body.toFixed(2)} (${r.read.body.toFixed(0)}) against ${r.read.surround.toFixed(0)}`)
        .join('; ');
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${mouths} mouths, every one at least ${VENT_CONTRAST_MIN} Michelson against its surround - ${summary}`
          : `${problems.join('; ')} [${summary}]`,
      };
    },
  });

  // -------------------------------------------------------------------------
  // B7 - the routes are lit, and the pixels say so
  // -------------------------------------------------------------------------

  /**
   * Where a route starts, for a player: the lowest spot the rule names for
   * a climb onto its first stage that is on ground a walking body reaches
   * (`map.wardenGround`, B5's "from the floor"), or the lowest at all.
   */
  const routeFoot = (h, route) => {
    const ground = h.map.wardenGround;
    const spots = [];
    for (const box of route.stages[0]) {
      if (typeof box === 'string') continue;
      for (const approach of h.map._supportApproaches(box)) spots.push({ approach, box });
    }
    const walked = spots.filter((s) => ground && ground.has({ x: s.approach.x, y: s.approach.y, z: s.approach.z }, 0.4));
    const pick = walked.length ? walked : spots;
    pick.sort((p, q) => p.approach.y - q.approach.y);
    return pick[0] || null;
  };

  /**
   * Mean luma of a difference mask and of a band around its bounds (the
   * surround), read from one frame; `other` is read over the same mask.
   */
  const readMasked = (frame, other, d, width, height, band) => {
    const bw = d.bounds.maxX - d.bounds.minX;
    const bh = d.bounds.maxY - d.bounds.minY;
    const x0 = Math.max(0, Math.floor(d.bounds.minX - bw * band.x));
    const x1 = Math.min(width - 1, Math.ceil(d.bounds.maxX + bw * band.x));
    const y0 = Math.max(0, Math.floor(d.bounds.minY - bh * band.y));
    const y1 = Math.min(height - 1, Math.ceil(d.bounds.maxY + bh * band.y));
    let subject = 0;
    let otherSum = 0;
    let surround = 0;
    let n = 0;
    let m = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * width + x;
        if (d.mask[i]) {
          subject += lumaAt(frame, i);
          if (other) otherSum += lumaAt(other, i);
          n++;
        } else {
          surround += lumaAt(frame, i);
          m++;
        }
      }
    }
    return { subject: n ? subject / n : 0, other: n ? otherSum / n : 0, surround: m ? surround / m : 0, pixels: n, surroundPixels: m };
  };

  debugTools.registerAutoTest({
    id: 'every-route-reads-lit-from-its-foot',
    spec: 'Section 5, amended (B7)',
    name: 'From the foot of every declared route its first stage reads a step brighter than unlit and than its surround, and the edge it lands over is lit',
    run: (h) => {
      const problems = [];
      const readings = [];
      const lighting = h.map.routeLighting;
      if (!lighting || !lighting.mesh) return { pass: false, detail: 'the map lit no routes' };
      const restore = quiesce(h);
      const lens = createLens(h);
      const { width, height } = lens;

      h.shade.mesh.visible = false;
      h.warden.mesh.visible = false;
      h.shade.groundBlob.visible = false;
      h.warden.groundBlob.visible = false;
      lens.grab();

      // One draw call for every strip on the map, and none while hidden.
      lens.look({ x: 0, y: 8, z: 0 }, { x: 1, y: 8, z: 0 });
      lens.renderOnly();
      const withStrips = h.renderer.info.render.calls;
      lighting.mesh.visible = false;
      lens.renderOnly();
      const withoutStrips = h.renderer.info.render.calls;
      lighting.mesh.visible = true;
      if (withStrips - withoutStrips !== 1) {
        problems.push(`the strips cost ${withStrips - withoutStrips} draw calls, not one (${withoutStrips} -> ${withStrips})`);
      }

      for (const route of h.map.routes) {
        const first = route.stages[0].filter((box) => typeof box !== 'string');
        const foot = routeFoot(h, route);
        if (!foot) {
          problems.push(`${route.id}: the rule names no spot to start it from`);
          continue;
        }
        const { approach, box } = foot;
        const eye = { x: approach.x, y: approach.y + S.standHeight * S.eyeHeightRatio, z: approach.z };
        lens.look(eye, {
          x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2, z: (box.min.z + box.max.z) / 2,
        });
        const shown = lens.grab();
        for (const b of first) b.mesh.visible = false;
        const hidden = lens.grab();
        for (const b of first) b.mesh.visible = true;
        // The same stage, the same frame, painted the way it would be if it
        // were not a route: the instrument reading the lighting itself.
        const lit = first.map((b) => b.mesh.material);
        for (const b of first) b.mesh.material = plainMaterialOf(b.mesh);
        const unlit = lens.grab();
        first.forEach((b, i) => { b.mesh.material = lit[i]; });

        const d = difference(shown, hidden, width, height);
        if (!d.bounds || d.count < MIN_REGION_PIXELS) {
          problems.push(`${route.id}: its first stage (${box.tag}) is not on screen from its foot`);
          continue;
        }
        const read = readMasked(shown, unlit, d, width, height, { x: 0.5, y: 0.5 });
        const step = read.subject - read.other;
        const contrast = michelson(read.subject, read.surround);
        readings.push(`${route.id} from ${approach.box.tag}: ${box.tag} ${read.subject.toFixed(0)} lit / ${read.other.toFixed(0)} unlit against ${read.surround.toFixed(0)}, contrast ${contrast.toFixed(2)}`);
        if (step < ROUTE_LIGHT_STEP) {
          problems.push(`${route.id}: ${box.tag} reads ${read.subject.toFixed(1)} lit and ${read.other.toFixed(1)} unlit from its foot, a step of ${step.toFixed(1)} < ${ROUTE_LIGHT_STEP}`);
        }
        if (contrast < ROUTE_CONTRAST_MIN) {
          problems.push(`${route.id}: ${box.tag} reads ${read.subject.toFixed(1)} against a surround of ${read.surround.toFixed(1)}, contrast ${contrast.toFixed(2)} < ${ROUTE_CONTRAST_MIN}`);
        }

        // The edge it lands over, seen from the last stage where the rule
        // says a body stands to go over it.
        const edges = lighting.edges.filter((edge) => edge.route === route.id);
        if (!edges.length) problems.push(`${route.id}: no landing edge is lit`);
        for (const edge of edges) {
          const last = route.stages[route.stages.length - 1];
          const stands = h.map._supportApproaches(edge.box)
            .filter((a) => last.includes(a.box) && a.nx === edge.nx && a.nz === edge.nz);
          if (!stands.length) {
            problems.push(`${route.id}: the strip on ${edge.box.tag} has no approach behind it`);
            continue;
          }
          const stand = stands[0];
          const alongX = edge.nz !== 0;
          const face = alongX ? (edge.nz > 0 ? edge.box.max.z : edge.box.min.z) : (edge.nx > 0 ? edge.box.max.x : edge.box.min.x);
          const mid = (edge.from + edge.to) / 2;
          lens.look(
            { x: stand.x, y: stand.y + S.standHeight * S.eyeHeightRatio, z: stand.z },
            { x: alongX ? mid : face, y: edge.y, z: alongX ? face : mid }
          );
          const withStrip = lens.grab();
          lighting.mesh.visible = false;
          const noStrip = lens.grab();
          lighting.mesh.visible = true;
          const ds = difference(withStrip, noStrip, width, height);
          if (!ds.bounds || ds.count < EDGE_MIN_PIXELS) {
            problems.push(`${route.id}: the strip on ${edge.box.tag} is ${ds.count} pixels from the top of ${stand.box.tag}`);
            continue;
          }
          const edgeRead = readMasked(withStrip, null, ds, width, height, { x: 0.3, y: 3 });
          const edgeContrast = michelson(edgeRead.subject, edgeRead.surround);
          readings.push(`${route.id} edge ${edge.box.tag}: ${edgeRead.subject.toFixed(0)} against ${edgeRead.surround.toFixed(0)}, contrast ${edgeContrast.toFixed(2)}`);
          if (edgeContrast < EDGE_CONTRAST_MIN) {
            problems.push(`${route.id}: the strip on ${edge.box.tag} reads ${edgeRead.subject.toFixed(1)} against ${edgeRead.surround.toFixed(1)}, contrast ${edgeContrast.toFixed(2)} < ${EDGE_CONTRAST_MIN}`);
          }
        }
      }
      if (lens.glError() !== 0) problems.push('GL error during the reads');

      h.shade.mesh.visible = true;
      h.warden.mesh.visible = true;
      h.shade.groundBlob.visible = true;
      h.warden.groundBlob.visible = true;
      lens.restore();
      restore();

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${h.map.routes.length} routes, ${lighting.stages.length} stages lit, ${lighting.edges.length} landing edges in one draw call - ${readings.join('; ')}`
          : `${problems.join('; ')} [${readings.join('; ')}]`,
      };
    },
  });
}
