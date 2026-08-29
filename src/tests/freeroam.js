/**
 * BLACKLINE - tests/freeroam.js
 *
 * AUTO suite (Section 16, Section 17.1): free-roam.
 *
 * Section 12 makes free-roam a *configuration* of `initMatch`, never a second
 * code path, so these checks drive the real input layer rather than calling
 * combat directly. Holding the bound code in `input.heldCodes` is exactly what
 * a held mouse button produces; everything downstream — the binding lookup,
 * `readWardenIntent()`, the controller and combat — is the production path.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';

const G = CONFIG.combat.gun;
const GA = CONFIG.gadgets;

/** Restore the competitive match these checks interrupt. */
function backToCompetitive(h) {
  h.input.clearAll();
  h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'freeroam-trigger-reaches-the-gun',
    spec: 'Section 12 / check 15',
    name: 'The human Warden fires, spread grows, recoil climbs and reload works',
    run: (h) => {
      const problems = [];
      h.initMatch({ mode: 'freeroam', role: 'warden', ai: false, objective: false });
      const weapon = h.combat.weapon;
      const warden = h.warden;

      // Settle the Warden onto its spawn before measuring the aim it climbs from.
      h.stepFrames(30);
      const startPitch = warden.pitch;
      const startSpread = weapon.spread;
      const startMagazine = weapon.magazine;

      // Hold the trigger. Mouse0 is what CONFIG.DEFAULT_BINDINGS.fire binds.
      h.input.heldCodes.add('Mouse0');
      let steps = 0;
      let peakSpread = startSpread;
      while (weapon.magazine > 0 && steps < 1200) {
        h.stepFrames(1);
        steps++;
        peakSpread = Math.max(peakSpread, weapon.spread);
      }
      const emptiedIn = steps;
      const climbedPitch = warden.pitch;
      h.input.heldCodes.delete('Mouse0');

      if (startMagazine !== G.magazine) problems.push(`magazine started at ${startMagazine}`);
      if (weapon.magazine > 0) {
        problems.push('holding the trigger never emptied the magazine — the human intent is not reaching combat');
      }
      if (peakSpread <= startSpread) problems.push(`spread never grew (stayed at ${startSpread})`);
      if (peakSpread > G.spreadMax + 1e-9) problems.push(`spread ${peakSpread} passed the ${G.spreadMax} cap`);
      // Recoil is the aim moving, so it is observable on the controller itself.
      if (climbedPitch <= startPitch) problems.push('recoil never moved the aim');

      // An empty magazine reloads (Section 8.1) and free-roam is unlimited
      // ammo (Section 12), so it comes back full without a resupply.
      if (!weapon.reloading) problems.push('an empty magazine did not begin a reload');
      let reloadSteps = 0;
      while (weapon.reloading && reloadSteps < 600) {
        h.stepFrames(1);
        reloadSteps++;
      }
      const reloadSeconds = reloadSteps * CONFIG.time.fixedDt;
      if (weapon.magazine !== G.magazine) problems.push(`reload left ${weapon.magazine} rounds`);
      if (Math.abs(reloadSeconds - G.reloadTime) > 0.05) {
        problems.push(`reload took ${reloadSeconds.toFixed(2)}s, spec ${G.reloadTime}s`);
      }
      if (weapon.spread !== G.spreadBase) problems.push('reload did not reset the spread');

      // And the competitive path is untouched by any of it: back in a match the
      // AI's intent is what drives the gun, not the (still bound) mouse button.
      backToCompetitive(h);
      h.input.heldCodes.add('Mouse0');
      const beforeCompetitive = h.combat.weapon.magazine;
      h.stepFrames(30);
      h.input.heldCodes.delete('Mouse0');
      if (h.combat.weapon.magazine !== beforeCompetitive) {
        problems.push('the human trigger drove the gun in competitive, where the AI owns it');
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `held the trigger: ${G.magazine} rounds in ${(emptiedIn * CONFIG.time.fixedDt).toFixed(2)}s, `
            + `spread ${startSpread.toFixed(1)} -> ${peakSpread.toFixed(2)} (cap ${G.spreadMax}), `
            + `aim climbed ${((climbedPitch - startPitch) * 180 / Math.PI).toFixed(2)} deg, `
            + `reloaded in ${reloadSeconds.toFixed(2)}s to ${weapon.magazine}; competitive unaffected`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'freeroam-gadgets-are-unlimited',
    spec: 'Section 12',
    name: 'Unlimited gadgets and instant taser recharge, and competitive is not',
    run: (h) => {
      const problems = [];
      h.initMatch({ mode: 'freeroam', role: 'warden', ai: false, objective: false });
      const gadgets = h.gadgets;

      if (!gadgets.unlimited) problems.push('free-roam did not set the unlimited flag');

      // Throw far more of each than the loadout holds.
      const from = { x: h.warden.position.x, y: h.warden.eyeY, z: h.warden.position.z };
      const direction = { x: 0, y: 0.2, z: -1 };
      const throws = 8;
      for (const type of ['stunGrenade', 'frag', 'smoke', 'flashbang']) {
        const before = gadgets.loadout[type];
        let thrown = 0;
        for (let i = 0; i < throws; i++) {
          if (gadgets.throwGadget(type, from, direction, 'warden')) thrown++;
        }
        if (thrown !== throws) problems.push(`${type}: only ${thrown} of ${throws} throws were allowed`);
        if (gadgets.loadout[type] !== before) {
          problems.push(`${type}: count fell ${before} -> ${gadgets.loadout[type]} in free-roam`);
        }
      }

      // Instant recharge: spend the taser and it is back on the next step.
      gadgets._spendTaser();
      gadgets.taserCharge = 0;
      h.stepFrames(1);
      if (gadgets.taserCharge !== GA.taser.charges) {
        problems.push(`taser did not instantly recharge (charge ${gadgets.taserCharge})`);
      }

      // Let everything in flight land and expire so the registry is clean.
      h.stepFrames(Math.ceil((GA.throw.fuse + GA.smoke.duration + 1) / CONFIG.time.fixedDt));

      // Competitive still costs you: the same throw depletes and the taser waits.
      backToCompetitive(h);
      if (h.gadgets.unlimited) problems.push('the unlimited flag survived into competitive');
      const smokeBefore = h.gadgets.loadout.smoke;
      h.gadgets.throwGadget('smoke', from, direction, 'shade');
      if (h.gadgets.loadout.smoke !== smokeBefore - 1) {
        problems.push('a competitive throw did not cost a gadget');
      }
      h.gadgets.taserCharge = 0;
      h.stepFrames(1);
      if (h.gadgets.taserCharge !== 0) problems.push('the competitive taser recharged instantly');

      backToCompetitive(h);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${throws} throws of each of 4 types with no depletion, taser recharged on the next step; `
            + `competitive still spends a gadget per throw and waits ${GA.taser.rechargeTime}s for the taser`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'alarm-camera-fires-and-can-be-destroyed',
    spec: 'Section 9.2 / check 19',
    name: 'Placed on a wall, siren on entering the cone, killed by gunfire, taser or knife',
    run: (h) => {
      const problems = [];
      const C = GA.alarmCamera;
      h.initMatch({ mode: 'freeroam', role: 'warden', ai: false, objective: false });
      const { gadgets, shade, effects } = h;

      // A wall to hang it on. Warden spawns sit in open space by design, so the
      // search walks the waypoint graph too — the same places the AI stands.
      h.warden.reset(h.map.wardenSpawns[0]);
      h.stepFrames(20);
      const origins = [
        ...h.map.wardenSpawns.map((s) => s.position),
        ...h.map.waypoints.map((w) => w.position),
      ];
      let surface = null;
      for (const origin of origins) {
        const eyeY = origin.y + CONFIG.warden.standHeight * CONFIG.warden.eyeHeightRatio;
        const eye = { x: origin.x, y: eyeY, z: origin.z };
        for (let i = 0; i < 32 && !surface; i++) {
          const angle = (i / 32) * Math.PI * 2;
          const hit = h.map.collision.raycast(
            eye, { x: Math.sin(angle), y: 0, z: Math.cos(angle) }, C.placeRange
          );
          // A wall, not the floor: the normal has to be roughly horizontal.
          if (hit && Math.abs(hit.ny) < 0.5) surface = hit;
        }
        if (surface) break;
      }
      if (!surface) {
        return { pass: false, detail: `no wall within ${C.placeRange}m of any spawn or waypoint to mount on` };
      }

      const mount = {
        x: surface.x + surface.nx * C.surfaceOffset,
        y: surface.y + surface.ny * C.surfaceOffset,
        z: surface.z + surface.nz * C.surfaceOffset,
      };
      const yaw = Math.atan2(-surface.nx, -surface.nz);

      /** Place it, put the Shade in front of it, and count sirens. */
      const arm = () => {
        gadgets.destroyAlarm('test');
        gadgets.placeAlarm(mount, yaw);
        // Directly in front of the lens, well inside the 8m radius.
        const reach = Math.min(C.radius * 0.4, 2.5);
        shade.reset({
          position: { x: mount.x + surface.nx * reach, y: mount.y - 1.0, z: mount.z + surface.nz * reach },
          yaw: 0,
        });
        gadgets.shadeMarkedFor = 0;
      };

      let sirens = 0;
      const off = h.emitter.on('gadget:alarm', () => { sirens++; });

      arm();
      if (!gadgets.alarm) problems.push('placeAlarm returned nothing');
      if (!effects.alarmFixture.visible) problems.push('no fixture appeared in the world');
      // Section 9.2: no live feed. There must be no second camera anywhere.
      let cameras = 0;
      h.scene.traverse((object) => { if (object.isCamera) cameras++; });
      if (cameras !== 1) problems.push(`${cameras} cameras in the scene — the alarm rendered a feed`);

      // Walking into the cone fires the siren and marks the Shade. Stepped one
      // at a time so the gap between sirens is measured, not estimated.
      const wantGap = Math.round(C.retriggerInterval / CONFIG.time.fixedDt);
      const firedAt = [];
      for (let step = 1; step <= wantGap * 2 + 4; step++) {
        const before = sirens;
        h.stepFrames(1);
        if (sirens > before) firedAt.push(step);
      }
      if (firedAt.length === 0) problems.push('standing in the cone did not fire the siren');
      if (!gadgets.shadeMarked) problems.push('the Shade was not marked on the Warden HUD');

      // Section 9.2's re-trigger interval: it sounds again, but not every step.
      let gap = 0;
      if (firedAt.length < 2) {
        problems.push(`the siren fired ${firedAt.length} time(s) over ${(wantGap * 2 + 4)} steps`);
      } else {
        gap = firedAt[1] - firedAt[0];
        if (Math.abs(gap - wantGap) > 2) {
          problems.push(`sirens ${gap} steps apart, want ${wantGap} (${C.retriggerInterval}s)`);
        }
      }

      // Out of the cone, behind the camera: silence.
      const quietFrom = sirens;
      shade.reset({
        position: { x: mount.x - surface.nx * 2.0, y: mount.y - 1.0, z: mount.z - surface.nz * 2.0 },
        yaw: 0,
      });
      h.stepFrames(Math.ceil((C.retriggerInterval + 0.3) / CONFIG.time.fixedDt));
      if (sirens !== quietFrom) problems.push('the camera saw the Shade through its own back');

      // Section 9.2: destructible by gunfire, taser or knife. All three.
      const destroyed = {};

      arm();
      h.stepFrames(4);
      const shotFrom = { x: mount.x + surface.nx * 4, y: mount.y, z: mount.z + surface.nz * 4 };
      h.emitter.emit('combat:shot', {
        actor: 'warden', origin: shotFrom,
        direction: { x: -surface.nx, y: 0, z: -surface.nz }, spread: 0,
      });
      destroyed.gunfire = !gadgets.alarm;
      if (effects.alarmFixture.visible) problems.push('the fixture survived being shot');

      arm();
      h.stepFrames(4);
      const taserFrom = {
        x: mount.x + surface.nx * 1.5,
        y: mount.y,
        z: mount.z + surface.nz * 1.5,
      };
      shade.reset({ position: { x: taserFrom.x, y: taserFrom.y - 1.2, z: taserFrom.z }, yaw: 0 });
      gadgets.taserCharge = GA.taser.charges;
      const taserHit = gadgets.fireTaser(shade, null, { x: -surface.nx, y: 0, z: -surface.nz });
      destroyed.taser = taserHit === 'alarm' && !gadgets.alarm;
      if (taserHit !== 'alarm') problems.push(`the taser reported "${taserHit}" rather than hitting the alarm`);

      arm();
      h.stepFrames(4);
      h.emitter.emit('combat:knife', {
        actor: 'shade',
        origin: { x: mount.x + surface.nx * 0.8, y: mount.y, z: mount.z + surface.nz * 0.8 },
        direction: { x: -surface.nx, y: 0, z: -surface.nz },
        range: CONFIG.combat.knife.range,
      });
      destroyed.knife = !gadgets.alarm;

      // And once destroyed, the siren stops for good — that is check 19's end.
      const silentFrom = sirens;
      shade.reset({
        position: { x: mount.x + surface.nx * 2, y: mount.y - 1.0, z: mount.z + surface.nz * 2 },
        yaw: 0,
      });
      h.stepFrames(Math.ceil((C.retriggerInterval * 2) / CONFIG.time.fixedDt));
      if (sirens !== silentFrom) problems.push('a destroyed camera kept sounding');
      if (gadgets.shadeMarked) problems.push('a destroyed camera kept marking the Shade');

      for (const [how, worked] of Object.entries(destroyed)) {
        if (!worked) problems.push(`${how} did not destroy the camera`);
      }

      off();
      backToCompetitive(h);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `mounted on a wall at ${C.radius}m/${C.coneDegrees}deg: sirens ${gap} steps apart `
            + `(${C.retriggerInterval}s), silent behind it, marked the Shade, no second camera in the scene; `
            + 'destroyed by gunfire, taser and knife, and silent after each'
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'warden-hud-shows-ammo-not-the-objective',
    spec: 'Section 13 / Section 12',
    name: 'Free-roam Warden HUD: ammo, gadget counts, health, no timer or score',
    run: (h) => {
      const problems = [];
      const hud = h.hud;
      const wasVisible = hud.visible;
      hud.setVisible(true);

      const base = {
        role: 'warden', freeroam: true, health: 64, magazine: 17, reloading: false,
        spread: G.spreadBase, unlimitedGadgets: true, alarmPlaced: false,
        loadout: { stunGrenade: 2, frag: 2, alarmCamera: 1 },
        timeRemaining: 123, score: { shade: 1, warden: 2 }, roundNumber: 3,
      };
      hud.update(0.016, base);

      const ammo = hud.el.wardenAmmo;
      const gadgetRow = hud.el.wardenGadgets;
      if (ammo.textContent !== '17') problems.push(`ammo read "${ammo.textContent}", want "17"`);
      if (hud.el.wardenPanel.style.display !== 'block') problems.push('the Warden panel was hidden');
      if (hud.el.shadeGadgets.style.display !== 'none') problems.push('the Shade gadget row was still shown');
      if (hud.el.crosshair.style.display !== 'block') problems.push('no crosshair');
      // Section 12: no objective, no timer, no score.
      if (hud.el.top.style.display !== 'none') problems.push('the round timer was shown in free-roam');
      if (hud.el.scorePanel.style.display !== 'none') problems.push('the score was shown in free-roam');
      if (hud.el.centre.style.display !== 'none') problems.push('the reinsert countdown was shown in free-roam');
      // Unlimited reads as unlimited rather than as a number that never moves.
      if (!/∞/.test(gadgetRow.textContent)) problems.push(`gadget row "${gadgetRow.textContent}" did not read as unlimited`);
      if (Math.round(parseFloat(hud.el.health.style.width)) !== 64) {
        problems.push(`health bar at ${hud.el.health.style.width}, want 64%`);
      }

      // Section 13: the crosshair gap is the live spread, so it must move with it.
      const narrow = parseFloat(hud.el.crossBars[1].style.left);
      hud.update(0.016, { ...base, spread: G.spreadMax });
      const wide = parseFloat(hud.el.crossBars[1].style.left);
      if (!(wide > narrow)) problems.push(`crosshair gap did not grow with spread (${narrow} -> ${wide})`);

      // Reloading replaces the count rather than showing a stale magazine.
      hud.update(0.016, { ...base, reloading: true });
      if (!ammo.classList.contains('reloading')) problems.push('reloading was not indicated');

      // A competitive Shade gets the objective chrome back.
      hud.update(0.016, {
        role: 'shade', freeroam: false, health: 100, lives: 3, visibility: 40,
        loadout: { smoke: 2, flashbang: 2 }, taserCharge: 1,
        timeRemaining: 123, score: { shade: 1, warden: 2 }, roundNumber: 3,
      });
      if (hud.el.top.style.display !== 'block') problems.push('the timer did not come back in competitive');
      if (hud.el.wardenPanel.style.display !== 'none') problems.push('the Warden panel survived the role swap');

      hud.setVisible(wasVisible);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `ammo 17, gadgets unlimited, health 64%, crosshair gap ${narrow} -> ${wide}px across `
            + `spread ${G.spreadBase}-${G.spreadMax} deg; timer, score and reinsert absent in free-roam`
          : problems.join('; '),
      };
    },
  });
}
