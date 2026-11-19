/**
 * BLACKLINE - tests/cameraclip.js
 *
 * AUTO suite (Section 6.1, J1): the third-person boom and the world.
 *
 * The camera is a ball 0.22m across on the end of a 2.2m pole, and the check
 * asks the only question that matters to the picture: where is that ball,
 * after `_updateCamera`, against the collision boxes? It backs the Shade into a
 * tall face the map itself offers (`findTallFace`, no coordinate named) with
 * the S key, at several yaws around the face and at the steepest pitch the
 * camera allows each way, because the boom swings with pitch and the floor is
 * the surface a horizontal ray never meets.
 *
 * What is asserted, per frame, on the rig's own world position - the one the
 * camera is parented to, shoulder and all:
 * - it is never inside a solid box (always, even at the near-plane clamp);
 * - when the boom sits at or past `minDistance` (so nothing has clamped it to
 *   the surface) its nearest surface is at least `collisionRadius` away.
 * Poses with a pitch are driven head-on only: the five rays are the sphere's
 * four compass points, and an oblique wall seen at an oblique pitch lies
 * between two of them, so a clearance of the full radius there is more than a
 * five-ray cast promises and the check would be asserting the approximation.
 *
 * The count of frames an OFFSET ray (not the centre one) set the boom is in the
 * detail on purpose: it is the number that says the sweep did something a
 * single ray would not, and a sweep cut back to the centre ray turns the
 * steep-pitch frames red (the camera rests 0.195m off the floor, not 0.22).
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { BOOM_CASTS_PER_FRAME } from '../entities/agentvisual.js';
import { findTallFace } from './scuff.js';

const CAM = CONFIG.shade.camera;
const DT = CONFIG.time.fixedDt;
/** Metres of slack on a clearance: float noise and the ease, not the 0.025 a one-ray boom loses. */
const EPS = 0.005;
/** Fixed steps held on S per pose: 2m of walk at walk speed, and the push against the face after. */
const STEPS = 90;
const WORLD = new THREE.Vector3();

/**
 * Signed distance from a point to a box, metres: positive outside (the gap to
 * the nearest face, edge or corner), negative inside (how far in from the
 * nearest face).
 */
export function pointToBox(p, box) {
  const dx = Math.max(box.min.x - p.x, 0, p.x - box.max.x);
  const dy = Math.max(box.min.y - p.y, 0, p.y - box.max.y);
  const dz = Math.max(box.min.z - p.z, 0, p.z - box.max.z);
  if (dx > 0 || dy > 0 || dz > 0) return Math.hypot(dx, dy, dz);
  return -Math.min(p.x - box.min.x, box.max.x - p.x, p.y - box.min.y, box.max.y - p.y, p.z - box.min.z, box.max.z - p.z);
}

/** The nearest solid box to a point, and the signed distance to it. */
function nearest(boxes, p) {
  let best = { box: null, gap: Infinity };
  for (const box of boxes) {
    if (!box.solid) continue;
    const gap = pointToBox(p, box);
    if (gap < best.gap) best = { box, gap };
  }
  return best;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-third-person-boom-never-puts-the-camera-inside-the-world',
    spec: 'Section 6.1 / J1',
    name: 'Backed into a wall at every yaw and pitch, the camera never enters a box, and clear of the boom floor it stays a camera radius off every surface',
    run: (h) => {
      const problems = [];
      h.initMatch({ mode: 'competitive', role: 'shade', ai: false, objective: false });
      h.menu.hide();
      h.input.clearAll();
      const shade = h.shade;
      const boxes = h.map.collision.boxes;
      try {
        const wall = findTallFace(h, 2.5);
        if (!wall) return { pass: false, detail: 'no ground-level face at least 2.5m tall with a clear approach was found' };
        const tag = wall.box.tag || 'the wall';
        // Face the other way: the boom (behind the Shade) then points at the wall.
        const away = wall.yaw + Math.PI;
        const nx = Math.sin(wall.yaw);
        const nz = Math.cos(wall.yaw);
        const ground = CONFIG.map.groundY;

        const poses = [];
        for (const turn of [0, 0.5, -0.5, 1.0, -1.0]) poses.push({ turn, pitch: 0 });
        poses.push({ turn: 0, pitch: CAM.pitchMax }, { turn: 0, pitch: CAM.pitchMin }, { turn: 0, pitch: CAM.pitchMax * 0.5 });

        let frames = 0;
        let offsetWon = 0;
        let shoulderWon = 0;
        let worst = Infinity;
        let worstShoulder = Infinity;
        let worstPose = '';
        let clamped = 0;
        for (const pose of poses) {
          // 2m off the face: the probe stood 0.8 out, so 1.2 further.
          shade.reset({ position: { x: wall.x + nx * 1.2, y: ground, z: wall.z + nz * 1.2 }, yaw: away + pose.turn });
          h.stepFrames(2);
          shade.pitch = pose.pitch;
          h.input.clearAll();
          h.input.heldCodes.add('KeyS');
          const label = `yaw ${(away + pose.turn).toFixed(2)} pitch ${pose.pitch.toFixed(2)}`;
          for (let i = 0; i < STEPS; i++) {
            h.stepFrames(1);
            h.input.clearEdges();
            shade.updateVisual(DT);
            shade.cameraRig.updateWorldMatrix(true, false);
            shade.cameraRig.getWorldPosition(WORLD);
            const probe = shade._boomProbe;
            frames++;
            const ray = probe.pulledBy === 2 ? probe.ray2 : probe.ray1;
            if (probe.pulledBy && ray > 0) offsetWon++;
            if (probe.pulledBy === 2) shoulderWon++;
            const { box, gap } = nearest(boxes, WORLD);
            const free = shade._cameraDistance >= CAM.minDistance - 1e-6;
            if (!free) clamped++;
            if (gap < worst) { worst = gap; worstPose = label; }
            if (probe.pulledBy === 2 && gap < worstShoulder) worstShoulder = gap;
            const where = `${label}, frame ${i}, at (${WORLD.x.toFixed(2)}, ${WORLD.y.toFixed(2)}, ${WORLD.z.toFixed(2)}), boom ${shade._cameraDistance.toFixed(2)}m`;
            if (gap <= 0) {
              problems.push(`the camera was inside ${box.tag || 'a box'} by ${(-gap).toFixed(3)}m: ${where}`);
              break;
            }
            if (free && gap < CAM.collisionRadius - EPS) {
              problems.push(`the camera sat ${gap.toFixed(3)}m off ${box.tag || 'a box'}, want ${CAM.collisionRadius}: ${where}`);
              break;
            }
          }
        }
        if (offsetWon === 0) problems.push('no frame was set by an offset ray: the sweep never did what a centre ray would not');
        const shoulderText = Number.isFinite(worstShoulder) ? `${worstShoulder.toFixed(3)}m` : 'none (the shoulder pass never won)';
        return {
          pass: problems.length === 0,
          detail: problems.length === 0
            ? `backed into ${tag} at ${poses.length} poses (5 yaws level, steep pitch up and down, half pitch), ${frames} frames, ${BOOM_CASTS_PER_FRAME} casts per frame; `
              + `${offsetWon} frames set by an offset ray, ${shoulderWon} where the shoulder pass beat the axis pass; `
              + `${clamped} at the near-plane clamp; worst clearance ${worst.toFixed(3)}m (${worstPose}), worst on a shoulder-pass frame ${shoulderText}`
            : problems.join('; '),
        };
      } finally {
        h.input.clearAll();
        h.initMatch({ mode: 'competitive', role: 'shade', ai: false, objective: false });
      }
    },
  });
}
