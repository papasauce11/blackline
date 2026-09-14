/**
 * BLACKLINE - tests/hang.js
 *
 * AUTO suite: B8, the hanging body. Since B1 (D21, D22) a tap of Space at a
 * ledge you had to jump for leaves you hanging; what the hanging body IS was
 * a capsule with its top half a metre above the lip, which meant a lip with
 * anything low over it could not be hung from at all. Now it hangs at full
 * stretch, arms straight up and the gloves on the lip, its top under the
 * lip - `hangDrop` in config.js - and the one such lip on this map,
 * hall-container's south face under gantry-hall, is the case.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { SHADE_STATE } from '../entities/agent.js';
import { driveAtLedge, findGroundLedge } from './movement.js';
import { press } from './feel.js';

const S = CONFIG.shade;

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-hang-is-at-full-stretch-under-the-lip',
    spec: 'Section 6.1, amended (20.4; B8: the hanging body)',
    name: 'The hanging body sits below the lip with the gloves on it, so a lip under a low gantry can be hung from, and its blocked pull-up scuffs',
    run: (h) => {
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
      const shade = h.shade;
      const problems = [];
      const hangMin = S.standHeight * S.hangMinHeightRatio;
      const fullReach = S.reach.standing + S.reach.jumpBonus;

      // Any hangable ledge: the capsule's top is under the lip, and the drawn
      // gloves are at it with the arms straight up.
      const spot = findGroundLedge(h, hangMin, fullReach, { hangable: true });
      if (!spot) return { pass: false, detail: 'no hangable ground-level ledge was found' };
      const top = spot.box.max.y;
      const tag = spot.box.tag || 'the ledge';
      driveAtLedge(h, spot, { airborne: false, pressAt: 5, hold: false, steps: 90 });
      if (shade.state !== SHADE_STATE.HANG) {
        problems.push(`a tap at ${tag} did not hang (state ${shade.state})`);
      } else {
        const capsuleTop = shade.position.y + shade.half.y;
        if (capsuleTop > top) problems.push(`hanging from ${tag} the capsule's top is ${(capsuleTop - top).toFixed(2)}m above the lip`);
        if (Math.abs(top - shade.feetY - S.hangDrop) > 0.05) problems.push(`hanging feet ${(top - shade.feetY).toFixed(2)}m under the lip, want hangDrop ${S.hangDrop}`);
        // Draw it, then read the gloves' height in the world.
        for (let i = 0; i < 30; i++) shade.updateVisual(1 / 60);
        shade.mesh.updateMatrixWorld(true);
        const parts = shade.mesh.userData.parts;
        if (parts.armL.rotation.x > -3.0 || parts.armR.rotation.x > -3.0) problems.push(`hanging arms at ${parts.armL.rotation.x.toFixed(2)} / ${parts.armR.rotation.x.toFixed(2)}, not straight up`);
        const glove = parts.armL.children[parts.armL.children.length - 1];
        const gloveY = glove.getWorldPosition(shade.mesh.position.clone()).y;
        if (Math.abs(gloveY - top) > 0.15) problems.push(`the hanging glove is drawn at ${gloveY.toFixed(2)}, the lip is at ${top.toFixed(2)}`);
      }
      h.input.clearAll();

      // The lip the job names: hall-container's south face, under gantry-hall.
      // The gantry is 0.3m over it: a hanging body fits under it now, the
      // crouched one a pull-up needs does not. So a jump-tap hangs, Space
      // scuffs and stays hanging, crouch drops.
      const container = h.map.collision.boxes.find((box) => box.tag === 'hall-container');
      const gantry = h.map.collision.boxes.find((box) => box.tag === 'gantry-hall');
      if (!container || !gantry) {
        problems.push('hall-container or gantry-hall missing');
      } else if (gantry.min.y - container.max.y > S.crouchHeight) {
        problems.push(`gantry-hall is ${(gantry.min.y - container.max.y).toFixed(2)}m over hall-container; the case needs less than a crouch`);
      } else {
        const ground = CONFIG.map.groundY;
        const under = {
          box: container,
          x: Math.min(Math.max((container.min.x + container.max.x) / 2, gantry.min.x + S.radius), gantry.max.x - S.radius),
          z: container.max.z + 0.8,
          yaw: Math.atan2(0, 1),
        };
        const half = { x: S.radius, y: S.standHeight / 2, z: S.radius };
        if (!h.map.collision.isClear({ x: under.x, y: ground + half.y + 0.02, z: under.z }, half)) {
          problems.push('no room to stand 0.8m south of hall-container under the gantry');
        } else {
          const result = driveAtLedge(h, under, { airborne: false, pressAt: 5, hold: false, steps: 90 });
          if (shade.state !== SHADE_STATE.HANG) {
            problems.push(`a jump-tap at hall-container's south face under the gantry did not hang (state ${shade.state}, states ${result.states})`);
          } else {
            if (shade.position.y + shade.half.y > gantry.min.y) problems.push('hanging under the gantry with the capsule inside it');
            h.input.clearAll();
            h.stepFrames(15);
            const scuffs = shade.scuffs;
            press(h, 'Space');
            h.stepFrames(1);
            h.input.clearAll();
            h.stepFrames(29);
            if (shade.state !== SHADE_STATE.HANG) problems.push(`a pull-up under the gantry left the hang (state ${shade.state})`);
            if (shade.scuffs - scuffs !== 1) problems.push(`a pull-up blocked by the gantry scuffed ${shade.scuffs - scuffs} times, want 1`);
            if (shade.feetY > container.max.y - 0.5) problems.push('the body went up through the gantry');
            press(h, 'ControlLeft');
            h.stepFrames(1);
            h.input.clearEdges();
            h.stepFrames(59);
            h.input.clearAll();
            if (shade.state !== SHADE_STATE.GROUND || Math.abs(shade.feetY - ground) > 0.05) problems.push(`crouch from the hang under the gantry did not drop to the floor (state ${shade.state}, feet ${shade.feetY.toFixed(2)})`);
          }
        }
      }

      shade.reset(h.map.shadeSpawns[0]);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `hanging from ${tag} the feet are ${S.hangDrop}m under the lip, the capsule's top below it and the gloves drawn at it, arms straight up; `
            + `hall-container's south face under gantry-hall (${(gantry.min.y - container.max.y).toFixed(2)}m of room) hangs, its pull-up scuffs once and crouch drops`
          : problems.join('; '),
      };
    },
  });
}
