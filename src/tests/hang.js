/**
 * BLACKLINE - tests/hang.js
 *
 * AUTO suite: B8, the hanging body. Since B1 (D21, D22) a tap of Space at a
 * ledge you had to jump for leaves you hanging; what the hanging body IS was
 * a capsule with its top half a metre above the lip, which meant a lip with
 * anything low over it could not be hung from at all. Now it hangs at full
 * stretch, arms straight up and the gloves on the lip, its top under the
 * lip - `hangDrop` in config.js - and a lip with less than a crouch of
 * room over it is the case: on the plant, hall-container's south face
 * under gantry-hall. The check searches the map it is on for one
 * (`findLiddedLip`) rather than naming it (D1's rule); a map with none -
 * the yard has no such lip by design (D2) - proves the stretch on any
 * hangable lip and says so.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { SHADE_STATE } from '../entities/agent.js';
import { landingSpot } from '../mapclimb.js';
import { driveAtLedge, findGroundLedge } from './movement.js';
import { press } from './feel.js';

const S = CONFIG.shade;

/**
 * A ground-level lip in the hang band with a solid less than a crouch over
 * its landing - a body hangs from it and cannot pull up - and the spot 0.8m
 * off its face, clear for a standing body, where the controller's own probe
 * reports it. The lip need not be climbable (by this face it is not); the
 * hang is the point.
 *
 * @returns {{box: object, lid: object, x: number, z: number, yaw: number}|null}
 */
export function findLiddedLip(h) {
  const ground = CONFIG.map.groundY;
  const shade = h.shade;
  const hangMin = S.standHeight * S.hangMinHeightRatio;
  const fullReach = S.reach.standing + S.reach.jumpBonus;
  const standHalf = { x: S.radius, y: S.standHeight / 2, z: S.radius };
  const boxes = h.map.collision.boxes;
  for (const box of boxes) {
    if (!box.solid) continue;
    if (Math.abs(box.min.y - ground) > 0.05) continue;
    const rise = box.max.y - ground;
    if (rise < hangMin || rise > fullReach) continue;
    for (const [nx, nz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      // The lid: the lowest solid over where the body would land, within a
      // crouch of the top. Without one this face is not the case.
      const land = landingSpot(box, { nx, nz }, (box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2);
      const lid = boxes.filter((other) => other !== box && other.solid
        && other.min.y > box.max.y && other.min.y - box.max.y < S.crouchHeight
        && land.x >= other.min.x && land.x <= other.max.x && land.z >= other.min.z && land.z <= other.max.z)
        .sort((a, b) => a.min.y - b.min.y)[0];
      if (!lid) continue;
      const x = nx === 0 ? land.x : (nx < 0 ? box.min.x : box.max.x) + nx * 0.8;
      const z = nz === 0 ? land.z : (nz < 0 ? box.min.z : box.max.z) + nz * 0.8;
      if (!h.map.collision.isClear({ x, y: ground + standHalf.y + 0.02, z }, standHalf)) continue;
      const yaw = Math.atan2(nx, nz);
      shade.reset({ position: { x, y: ground, z }, yaw });
      h.stepFrames(3);
      if (!shade.grounded || Math.abs(shade.feetY - ground) > 0.05) continue;
      shade.grounded = false;
      const ledge = shade._probeLedge(S.vaultReach);
      shade.grounded = true;
      if (!ledge || ledge.box !== box) continue;
      return { box, lid, x, z, yaw };
    }
  }
  return null;
}

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

      // The lip the job names, found on the map this is: a lip with a solid
      // less than a crouch over it (the plant: hall-container's south face,
      // 0.3m under gantry-hall). A hanging body fits under it now, the
      // crouched one a pull-up needs does not. So a jump-tap hangs, Space
      // scuffs and stays hanging, crouch drops.
      const under = findLiddedLip(h);
      let lidded = 'no lip on this map has a solid less than a crouch over it, so the hang under a lid is not this map\'s to prove';
      if (under) {
        const { box: lip, lid } = under;
        const lipTag = lip.tag || 'the lip';
        const lidTag = lid.tag || 'the lid';
        const ground = CONFIG.map.groundY;
        const result = driveAtLedge(h, under, { airborne: false, pressAt: 5, hold: false, steps: 90 });
        if (shade.state !== SHADE_STATE.HANG) {
          problems.push(`a jump-tap at ${lipTag} under ${lidTag} did not hang (state ${shade.state}, states ${result.states})`);
        } else {
          if (shade.position.y + shade.half.y > lid.min.y) problems.push(`hanging under ${lidTag} with the capsule inside it`);
          h.input.clearAll();
          h.stepFrames(15);
          const scuffs = shade.scuffs;
          press(h, 'Space');
          h.stepFrames(1);
          h.input.clearAll();
          h.stepFrames(29);
          if (shade.state !== SHADE_STATE.HANG) problems.push(`a pull-up under ${lidTag} left the hang (state ${shade.state})`);
          if (shade.scuffs - scuffs !== 1) problems.push(`a pull-up blocked by ${lidTag} scuffed ${shade.scuffs - scuffs} times, want 1`);
          if (shade.feetY > lip.max.y - 0.5) problems.push(`the body went up through ${lidTag}`);
          press(h, 'ControlLeft');
          h.stepFrames(1);
          h.input.clearEdges();
          h.stepFrames(59);
          h.input.clearAll();
          if (shade.state !== SHADE_STATE.GROUND || Math.abs(shade.feetY - ground) > 0.05) problems.push(`crouch from the hang under ${lidTag} did not drop to the floor (state ${shade.state}, feet ${shade.feetY.toFixed(2)})`);
        }
        lidded = `${lipTag} under ${lidTag} (${(lid.min.y - lip.max.y).toFixed(2)}m of room) hangs, its pull-up scuffs once and crouch drops`;
      }

      shade.reset(h.map.shadeSpawns[0]);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `hanging from ${tag} the feet are ${S.hangDrop}m under the lip, the capsule's top below it and the gloves drawn at it, arms straight up; ${lidded}`
          : problems.join('; '),
      };
    },
  });
}
