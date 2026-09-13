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
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createLens, difference, quiesce } from './pixels.js';

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
}
