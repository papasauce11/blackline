/**
 * BLACKLINE - tests/alarmseen.js
 *
 * AUTO suite (M7): a placed camera can be found. The fixture has always been
 * drawn - `the-alarm-fixture-is-visible-and-changes-state` proves a body and a
 * lens - but in a dark room a `MeshBasicMaterial` dot lights nothing, so the
 * camera was a speck the Shade had to be standing on to see. The lens now has a
 * small point light of its own, and this holds it from the distance the
 * done-when names: 6m.
 *
 * **Both clauses are relative, so neither carries a luma floor.** The same
 * scene, the same seed and the same eye are photographed with the camera and
 * without it, nothing else moved, so the difference is the camera and only the
 * camera:
 *
 *   - **Seen.** The pixels that changed, inside a disc about the fixture's
 *     projected centre, are at least the fixture's own projected area - worked
 *     out here from its dimensions, the view's field of view and the buffer, not
 *     written down - and they got brighter. A camera that merely occluded the
 *     wall would change as many pixels and darken them.
 *   - **Spilling.** The wall in a ring round the fixture - outside its
 *     silhouette, so the fixture itself is not read - is brighter with the
 *     camera there, by more than four times what the same ring varies by across
 *     two frames with no camera at all. That is the clause the light has to
 *     carry: the body and the lens are the same with or without it, and only a
 *     light puts luma on the wall around them.
 *
 * Read on whichever map the page is on, at a wall found off a waypoint with six
 * metres of clear air in front of it. Whether it reads at a glance, and whether
 * a Shade finds it in play, stays HUMAN.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import {
  REFERENCE_HEIGHT, SETTLE_SEED, brightnessDelta, createLens, difference, quiesce, scaledCount,
} from './pixels.js';

/** The done-when's distance, eye to wall. */
const STANDOFF = 6;
/** The ring reaches this many silhouette radii out, and starts at one. */
const RING_OUTER = 3;
/** The lit margin has to beat the frame's own noise by this factor. */
const NOISE_FACTOR = 4;
/** Fixed steps after the camera is destroyed, so its sparks have expired. */
const SETTLE_STEPS = 240;

function luma(frame, i) {
  return 0.2126 * frame[i] + 0.7152 * frame[i + 1] + 0.0722 * frame[i + 2];
}

/** Mean luma of the pixels between two radii of a point, edge-safe. */
function ringLuma(frame, width, height, cx, cy, inner, outer) {
  let total = 0;
  let count = 0;
  for (let y = Math.max(0, Math.floor(cy - outer)); y <= Math.min(height - 1, Math.ceil(cy + outer)); y++) {
    for (let x = Math.max(0, Math.floor(cx - outer)); x <= Math.min(width - 1, Math.ceil(cx + outer)); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d < inner || d > outer) continue;
      total += luma(frame, (y * width + x) * 4);
      count++;
    }
  }
  return count ? total / count : 0;
}

/** A wall a camera can be mounted on with `STANDOFF` metres of air in front of it. */
function findWall(h, C) {
  const W = CONFIG.warden;
  for (const node of h.map.waypoints) {
    const eyeY = node.position.y + W.standHeight * W.eyeHeightRatio;
    for (let i = 0; i < 32; i++) {
      const angle = (i / 32) * Math.PI * 2;
      const hit = h.map.collision.raycast(
        { x: node.position.x, y: eyeY, z: node.position.z },
        { x: Math.sin(angle), y: 0, z: Math.cos(angle) }, 14
      );
      if (!hit || Math.abs(hit.ny) >= 0.5) continue;
      const mount = {
        x: hit.x + hit.nx * C.surfaceOffset,
        y: hit.y + hit.ny * C.surfaceOffset,
        z: hit.z + hit.nz * C.surfaceOffset,
      };
      const clear = h.map.collision.raycast(mount, { x: hit.nx, y: 0, z: hit.nz }, STANDOFF + 0.5);
      if (!clear) return { hit, mount };
    }
  }
  return null;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-placed-alarm-camera-is-found-from-six-metres-by-its-lens-light',
    spec: 'Section 9.2 / M7',
    name: 'A placed alarm camera, photographed from 6m against the same frame with it destroyed, changes at least its own projected area of pixels at its projected position and they get brighter, and the wall in a ring round it is brighter by more than four times the ring\'s own frame-to-frame noise',
    run: (h) => {
      const problems = [];
      const C = CONFIG.gadgets.alarmCamera;
      const restore = quiesce(h);
      // Steps frames between the grabs (sparks, the destroy), so the match is
      // its own with no Warden in it (H74).
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: true, seed: SETTLE_SEED });
      const lens = createLens(h);
      const bodies = [h.shade.mesh, h.warden.mesh, h.shade.groundBlob, h.warden.groundBlob];
      const shown = bodies.map((body) => body.visible);
      const finish = () => {
        bodies.forEach((body, i) => { body.visible = shown[i]; });
        lens.restore();
        restore();
      };

      const wall = findWall(h, C);
      if (!wall) {
        finish();
        return { pass: false, detail: `no wall within reach of a waypoint with ${STANDOFF}m of clear air in front of it` };
      }
      const { hit, mount } = wall;
      bodies.forEach((body) => { body.visible = false; });
      const eye = { x: mount.x + hit.nx * STANDOFF, y: mount.y, z: mount.z + hit.nz * STANDOFF };
      lens.look(eye, mount);

      // The fixture points along the wall's normal, so from the eye it is seen
      // end-on: a disc of the body's radius at the lens's depth. The lens's
      // world point is the one the lamp is placed at, read back off it once the
      // camera is up, so the projection and the light cannot be two copies of
      // the arithmetic.
      h.gadgets.placeAlarm(mount, Math.atan2(-hit.nx, -hit.nz));
      h.stepFrames(1);
      const tip = h.effects._alarmLensLight.getWorldPosition(new THREE.Vector3());
      const depth = Math.hypot(tip.x - eye.x, tip.z - eye.z);
      const projected = tip.clone().project(h.camera);
      const cx = ((projected.x + 1) / 2) * lens.width;
      const cy = ((1 - projected.y) / 2) * lens.height;
      const pxPerMetre = (lens.height / 2) / (Math.tan((h.camera.fov * Math.PI) / 360) * depth);
      const radius = C.bodyRadius * pxPerMetre + 1;
      // Worked out on the reference buffer and scaled, so it is the fixture's
      // area in whichever buffer this is and not a number (H28).
      const referenceRadius = C.bodyRadius * ((REFERENCE_HEIGHT / 2) / (Math.tan((h.camera.fov * Math.PI) / 360) * depth));
      const areaFloor = scaledCount(lens, Math.PI * referenceRadius * referenceRadius);

      // Placed once: a round allows one camera and a second placement would
      // find the loadout spent. The two no-camera frames are the pair below.
      const withCamera = lens.grab();
      h.gadgets.destroyAlarm('test');
      h.stepFrames(SETTLE_STEPS);
      const without = lens.grab();
      h.stepFrames(1);
      const noise1 = lens.grab();

      // Clause 1: a blob at the fixture's position, at least its own size, lit.
      const blob = difference(withCamera, without, lens.width, lens.height, 8);
      const disc = new Uint8Array(blob.mask.length);
      let inDisc = 0;
      for (let y = Math.max(0, Math.floor(cy - radius * RING_OUTER)); y <= Math.min(lens.height - 1, Math.ceil(cy + radius * RING_OUTER)); y++) {
        for (let x = Math.max(0, Math.floor(cx - radius * RING_OUTER)); x <= Math.min(lens.width - 1, Math.ceil(cx + radius * RING_OUTER)); x++) {
          const i = y * lens.width + x;
          if (!blob.mask[i] || Math.hypot(x - cx, y - cy) > radius * RING_OUTER) continue;
          disc[i] = 1;
          inDisc++;
        }
      }
      const delta = brightnessDelta(without, withCamera, disc);
      if (inDisc < areaFloor) problems.push(`the camera changed ${inDisc} pixels at its projected position (${cx.toFixed(0)},${cy.toFixed(0)}), want its own area, ${areaFloor}`);
      if (!(delta > 0)) problems.push(`the pixels at the camera's position changed by ${delta.toFixed(2)} (summed channels): it did not light up`);

      // Clause 2: the wall round the fixture, outside its silhouette.
      const ringOn = ringLuma(withCamera, lens.width, lens.height, cx, cy, radius, radius * RING_OUTER);
      const ringOff = ringLuma(without, lens.width, lens.height, cx, cy, radius, radius * RING_OUTER);
      const margin = ringOn - ringOff;
      const noise = Math.abs(
        ringLuma(without, lens.width, lens.height, cx, cy, radius, radius * RING_OUTER)
        - ringLuma(noise1, lens.width, lens.height, cx, cy, radius, radius * RING_OUTER)
      );
      if (!(margin > 0)) problems.push(`the wall round the camera is no brighter with it there (${ringOn.toFixed(3)} against ${ringOff.toFixed(3)})`);
      else if (!(margin > NOISE_FACTOR * noise)) problems.push(`the wall round the camera is brighter by ${margin.toFixed(3)}, which does not beat ${NOISE_FACTOR}x the ring's own noise of ${noise.toFixed(3)}`);
      if (lens.glError() !== 0) problems.push('GL error during the reads');

      finish();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `at ${STANDOFF}m the camera changed ${inDisc} pixels at its position (floor ${areaFloor}), brighter by ${delta.toFixed(1)}; `
            + `the ring round it is ${margin.toFixed(3)} luma brighter against a noise of ${noise.toFixed(3)} (need ${NOISE_FACTOR}x)`
          : problems.join('; '),
      };
    },
  });
}
