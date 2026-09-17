/**
 * BLACKLINE - tests/combat.js
 *
 * AUTO suite (Section 16, Section 17.1): Combat.
 *
 * Hitscan, damage falloff, spread and recoil, the knife arc and rear takedown,
 * and the Section 8.3 finisher's hard wall-clock restore.
 *
 * Registered from tests/index.js. Checks reach the live game through the
 * harness `h`; nothing here imports main.js, which Section 3.1 forbids.
 */

import { CONFIG } from '../config.js';
import { damageAtRange, rayHitsActor } from '../systems/combat.js';
import { WARDEN_STATE } from '../entities/enforcer.js';
import { createWardenIntent } from '../entities/enforcer.js';

const G = CONFIG.combat.gun;
const K = CONFIG.combat.knife;

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'gun-damage-falloff-and-lethality',
    spec: 'Section 8.1',
    name: '25 to 15m falling to 12 at 30m, 2x headshots, four body shots kill',
    run: () => {
      const problems = [];
      const near = damageAtRange(0);
      const edge = damageAtRange(G.damageNearRange);
      const mid = damageAtRange((G.damageNearRange + G.damageFarRange) / 2);
      const far = damageAtRange(G.damageFarRange);
      const beyond = damageAtRange(G.damageFarRange * 2);

      if (near !== G.damageNear) problems.push(`point blank ${near}, want ${G.damageNear}`);
      if (edge !== G.damageNear) problems.push(`at ${G.damageNearRange}m ${edge}, want ${G.damageNear}`);
      if (far !== G.damageFar) problems.push(`at ${G.damageFarRange}m ${far}, want ${G.damageFar}`);
      if (beyond !== G.damageFar) problems.push(`past ${G.damageFarRange}m ${beyond}, want a flat ${G.damageFar}`);
      // Linear between the two, so the midpoint is the mean.
      const wanted = (G.damageNear + G.damageFar) / 2;
      if (Math.abs(mid - wanted) > 1e-9) problems.push(`midpoint ${mid.toFixed(2)}, want ${wanted}`);

      // "Four body shots kill a Shade" (Section 8.1) at close range.
      const shots = Math.ceil(CONFIG.shade.health / G.damageNear);
      if (shots !== 4) problems.push(`${shots} body shots to kill, spec says four`);
      // And a headshot is worth exactly two body shots.
      if (near * G.headshotMultiplier !== 2 * near) problems.push('headshot multiplier is not 2x');

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `0m ${near}, ${G.damageNearRange}m ${edge}, ${((G.damageNearRange + G.damageFarRange) / 2)}m ${mid.toFixed(1)}, ${G.damageFarRange}m ${far}, beyond ${beyond}; ${shots} body shots kill, headshot x${G.headshotMultiplier}`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'gun-spread-recoil-and-reload',
    spec: 'Section 8.1',
    name: 'Spread grows to its cap and recovers; the magazine empties and reloads',
    run: (h) => {
      const weapon = h.combat.weapon;
      const dt = CONFIG.time.fixedDt;
      const problems = [];
      weapon.reset();

      if (weapon.magazine !== G.magazine) problems.push(`magazine starts at ${weapon.magazine}`);
      const opening = weapon.spread;

      // Empty the magazine as fast as the fire rate allows.
      let fired = 0;
      let guard = 0;
      while (weapon.magazine > 0 && guard++ < 5000) {
        if (weapon.canFire) {
          weapon.consume();
          fired++;
        }
        weapon.step(dt);
      }
      const cappedSpread = weapon.spread;
      const recoilAfterBurst = weapon.recoilPitch;

      if (fired !== G.magazine) problems.push(`fired ${fired} rounds from a ${G.magazine} magazine`);
      if (cappedSpread > G.spreadMax + 1e-9) problems.push(`spread ${cappedSpread} exceeded the ${G.spreadMax} cap`);
      if (cappedSpread <= opening) problems.push('spread did not grow while firing');
      if (recoilAfterBurst <= 0) problems.push('recoil did not climb');

      // Emptying the magazine starts a reload on its own (Section 8.1).
      if (!weapon.reloading) problems.push('an empty magazine did not begin a reload');
      let reloadSteps = 0;
      while (weapon.reloading && reloadSteps++ < 10 / dt) weapon.step(dt);
      const reloadSeconds = reloadSteps * dt;
      if (Math.abs(reloadSeconds - G.reloadTime) > dt * 2) {
        problems.push(`reload took ${reloadSeconds.toFixed(2)}s, spec is ${G.reloadTime}s`);
      }
      if (weapon.magazine !== G.magazine) problems.push('reload did not refill the magazine');
      if (weapon.spread !== G.spreadBase) problems.push('reload did not reset spread');

      // Recoil decays once the trigger is off.
      for (let i = 0; i < 2 / dt; i++) weapon.step(dt);
      if (weapon.recoilPitch >= recoilAfterBurst * 0.1) problems.push('recoil did not recover between bursts');
      weapon.reset();

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${fired} rounds, spread ${opening} -> ${cappedSpread.toFixed(2)} (cap ${G.spreadMax}), reload ${reloadSeconds.toFixed(2)}s refilled to ${weapon.magazine}, recoil decayed to ${weapon.recoilPitch.toFixed(4)}`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'hitscan-respects-cover-and-the-head-line',
    maps: ['plant'], // the plant's walls are the cover
    spec: 'Section 8.1 / check 1',
    name: 'A shot stops at a wall, and only lands a headshot above the head line',
    run: (h) => {
      const problems = [];
      const shade = h.shade;
      shade.reset(h.map.shadeSpawns[0]);
      // Stand the Shade in the open in the Turbine Hall.
      shade.position.set(-18, CONFIG.shade.standHeight / 2 + 0.05, -4);

      const torsoY = shade.feetY + shade.height * 0.5;
      const headY = shade.feetY + shade.height * (G.headHeightRatio + 0.05);

      // Straight down the lane from 8m west: clear line, torso height.
      const from = { x: -26, y: torsoY, z: -4 };
      const direction = { x: 1, y: 0, z: 0 };
      const body = rayHitsActor(from, direction, shade, G.range);
      if (!body) problems.push('a clear torso shot missed');
      if (body && body.headshot) problems.push('a torso shot registered as a headshot');

      const up = { x: -26, y: headY, z: -4 };
      const head = rayHitsActor(up, direction, shade, G.range);
      if (!head) problems.push('a clear head shot missed');
      if (head && !head.headshot) problems.push('a shot above the head line was not a headshot');

      // Now put the hall's east wall between them. z = -10 is a solid span:
      // the doorway is z -6..-2 and the two vent mouths are elsewhere, so
      // firing across at z = -4 would go straight through the door.
      shade.position.set(-18, CONFIG.shade.standHeight / 2 + 0.05, -10);
      const across = { x: 2, y: torsoY, z: -10 };
      const west = { x: -1, y: 0, z: 0 };
      const throughWall = rayHitsActor(across, west, shade, G.range);
      const world = h.map.collision.raycast(across, west, G.range);
      const occluded = !throughWall || !world || world.distance < throughWall.distance;
      if (!occluded) problems.push('the shot reached the Shade through a wall');

      shade.reset(h.map.shadeSpawns[0]);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `torso hit at ${body.distance.toFixed(1)}m (headshot=false), head hit at ${head.distance.toFixed(1)}m (headshot=true), wall at ${world ? world.distance.toFixed(1) : 'n/a'}m occludes the Shade at ${throughWall ? throughWall.distance.toFixed(1) : 'n/a'}m`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'rear-takedown-needs-the-wardens-back',
    spec: 'Section 8.2 / checks 13, 14',
    name: 'Behind and close is a takedown; in front is a two-hit knife',
    run: (h) => {
      const combat = h.combat;
      const problems = [];
      h.shade.reset(h.map.shadeSpawns[0]);
      h.warden.reset(h.map.wardenSpawns[0]);

      const place = (offsetX, offsetZ, wardenYaw) => {
        h.warden.position.set(-18, CONFIG.warden.standHeight / 2 + 0.05, -4);
        h.warden.yaw = wardenYaw;
        h.shade.position.set(-18 + offsetX, CONFIG.shade.standHeight / 2 + 0.05, -4 + offsetZ);
        // Face the Shade at the Warden, or it is not swinging at anything.
        h.shade.yaw = Math.atan2(-(h.warden.position.x - h.shade.position.x), -(h.warden.position.z - h.shade.position.z));
        return combat.classifyKnife(h.shade, h.warden);
      };

      // Warden facing +Z (yaw = PI). Behind it is -Z.
      const behind = place(0, -1.2, Math.PI);
      if (behind !== 'takedown') problems.push(`from behind at 1.2m got ${behind}, want takedown`);

      const inFront = place(0, 1.2, Math.PI);
      if (inFront !== 'arc') problems.push(`from the front at 1.2m got ${inFront}, want arc`);

      // Behind, but past the 1.8m rear range: whatever else it is, it is not a
      // takedown. This is what makes the rear range mean anything.
      const behindFar = place(0, -(K.rearRange + 0.4), Math.PI);
      if (behindFar === 'takedown') problems.push(`behind at ${(K.rearRange + 0.4).toFixed(1)}m still took down, past the ${K.rearRange}m rear range`);

      const miles = place(0, -(K.range + 2), Math.PI);
      if (miles !== null) problems.push(`out of range got ${miles}, want nothing`);

      // Two hits to kill from the front (Section 8.2).
      const hits = Math.ceil(CONFIG.warden.health / K.damage);
      if (hits !== 2) problems.push(`${hits} knife hits to kill, spec says two`);

      h.shade.reset(h.map.shadeSpawns[0]);
      h.warden.reset(h.map.wardenSpawns[0]);
      combat.reset();

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `behind 1.2m=takedown, front 1.2m=arc, behind ${(K.rearRange + 0.4).toFixed(1)}m=${behindFar} (past the ${K.rearRange}m rear range), beyond ${K.range}m=nothing; ${hits} arc hits kill`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'finisher-always-returns-control',
    spec: 'Section 8.3 / Section 15 / check 13',
    name: 'The cinematic restores camera, FOV and time scale, and cannot strand the player',
    run: (h) => {
      const combat = h.combat;
      const dt = CONFIG.time.fixedDt;
      const problems = [];

      const stage = () => {
        h.shade.reset(h.map.shadeSpawns[0]);
        h.warden.reset(h.map.wardenSpawns[0]);
        combat.reset();
        h.warden.position.set(-18, CONFIG.warden.standHeight / 2 + 0.05, -4);
        h.warden.yaw = Math.PI;
        h.shade.position.set(-18, CONFIG.shade.standHeight / 2 + 0.05, -5.2);
        h.shade.yaw = 0;
        combat._beginFinisher(h.shade, h.warden);
      };

      // 1. It runs its beats and ends on its own.
      stage();
      if (!combat.inFinisher) problems.push('the takedown did not start a finisher');
      if (h.clock.timeScale !== CONFIG.finisher.hitStopTimeScale) {
        problems.push(`hit-stop did not take: time scale ${h.clock.timeScale}`);
      }
      let steps = 0;
      while (combat.inFinisher && steps++ < 5 / dt) {
        combat.step(dt, { shade: h.shade, warden: h.warden, shadeIntent: null, wardenIntent: null });
      }
      if (combat.inFinisher) problems.push('the finisher never ended');
      if (h.clock.timeScale !== 1) problems.push(`time scale left at ${h.clock.timeScale}`);
      if (Math.abs(h.camera.fov - CONFIG.render.fov) > 1e-9) problems.push(`fov left at ${h.camera.fov}`);
      if (h.camera.position.length() > 1e-9) problems.push('camera local position left dirty');
      const ranBeats = steps;

      // 2. The hard requirement: a finisher whose beats never complete must
      // still hand control back on the wall clock. Rewind its start time past
      // the timeout, which is exactly what a stalled frame would do.
      stage();
      combat.finisher.wallStart -= CONFIG.finisher.wallClockTimeout + 0.5;
      combat.step(dt, { shade: h.shade, warden: h.warden, shadeIntent: null, wardenIntent: null });
      if (combat.inFinisher) problems.push('the wall-clock guard did not fire');
      if (h.clock.timeScale !== 1) problems.push(`guard left the time scale at ${h.clock.timeScale}`);
      if (Math.abs(h.camera.fov - CONFIG.render.fov) > 1e-9) problems.push(`guard left the fov at ${h.camera.fov}`);

      // 3. Exactly one camera survived all of it (Section 15).
      let cameras = 0;
      h.scene.traverse((object) => {
        if (object.isCamera) cameras++;
      });
      if (cameras !== 1) problems.push(`${cameras} cameras after the finisher`);

      h.shade.reset(h.map.shadeSpawns[0]);
      h.warden.reset(h.map.wardenSpawns[0]);
      combat.reset();
      h.setCameraOwner('shade');

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `beats ran to completion in ${(ranBeats * dt).toFixed(2)}s (spec ${CONFIG.finisher.duration}s) and restored; wall-clock guard at ${CONFIG.finisher.wallClockTimeout}s restored on the next step; 1 camera throughout`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'warden-respawns-furthest-from-last-known',
    spec: 'Section 6.2',
    name: 'A dead Warden returns after 12s at the spawn furthest from where it lost you',
    run: (h) => {
      const combat = h.combat;
      const dt = CONFIG.time.fixedDt;
      const problems = [];

      h.shade.reset(h.map.shadeSpawns[0]);
      h.warden.reset(h.map.wardenSpawns[0]);
      combat.reset();
      h.wardenAI.reset();

      // Pin the AI's belief to one corner, then check the Warden comes back in
      // the other. The belief is what Section 6.2 scores against, not the truth.
      h.wardenAI.lastKnown = { x: -22, y: 0, z: -14 };
      let furthest = h.map.wardenSpawns[0];
      let best = -1;
      for (const spawn of h.map.wardenSpawns) {
        const d = spawn.position.distanceTo(h.wardenAI.lastKnown);
        if (d > best) {
          best = d;
          furthest = spawn;
        }
      }

      combat._damage(h.warden, CONFIG.warden.health, 'warden', 'test');
      if (h.warden.state !== WARDEN_STATE.DEAD) problems.push('the Warden did not die');

      // Not before the delay.
      for (let i = 0; i < (CONFIG.warden.respawnDelay - 0.5) / dt; i++) {
        combat.step(dt, { shade: h.shade, warden: h.warden, shadeIntent: null, wardenIntent: createWardenIntent() });
      }
      if (h.warden.state !== WARDEN_STATE.DEAD) problems.push('respawned early');

      for (let i = 0; i < 1 / dt; i++) {
        combat.step(dt, { shade: h.shade, warden: h.warden, shadeIntent: null, wardenIntent: createWardenIntent() });
      }
      if (h.warden.state === WARDEN_STATE.DEAD) problems.push('never respawned');
      if (h.warden.health !== CONFIG.warden.health) problems.push(`respawned on ${h.warden.health} health`);
      const at = h.warden.position.distanceTo(furthest.position);
      if (at > 1.0) problems.push(`respawned ${at.toFixed(1)}m from the furthest spawn (${furthest.name})`);

      h.warden.reset(h.map.wardenSpawns[0]);
      combat.reset();
      h.wardenAI.reset();

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `died, held dead for ${CONFIG.warden.respawnDelay}s, returned at "${furthest.name}" (${best.toFixed(1)}m from the last known position) on full health`
          : problems.join('; '),
      };
    },
  });
}
