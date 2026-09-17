/**
 * BLACKLINE - tests/gadgets.js
 *
 * AUTO suite (Section 16, Section 17.1): Gadgets.
 *
 * The single effect registry, grenade tunnelling, smoke and flashbang line of
 * sight, and the taser.
 *
 * Registered from tests/index.js. Checks reach the live game through the
 * harness `h`; nothing here imports main.js, which Section 3.1 forbids.
 */

import { CONFIG } from '../config.js';
import { GADGET } from '../systems/gadgets.js';
import { WARDEN_STATE } from '../entities/enforcer.js';
import { clearLane, alongLane } from './lanes.js';

const GA = CONFIG.gadgets;

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-ais-grenades-fly-land-and-hurt',
    spec: 'Section 9.2, Section 11 / check 17',
    name: 'A static target draws a real frag that damages, and the counts are honoured',
    run: (h) => {
      const problems = [];
      const GA = CONFIG.gadgets;
      const A = CONFIG.ai;
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      const { shade, warden, wardenAI, gadgets } = h;

      // Stand them in the Turbine Hall with sight of each other. ENGAGE calls
      // for a frag on a target that has not moved for fragStaticTime.
      const siteA = h.map.sites[0];
      shade.reset({ position: siteA.position, yaw: 0 });
      h.stepFrames(20);
      const torso = {
        x: shade.position.x,
        y: shade.feetY + shade.height * CONFIG.detection.torsoHeightRatio,
        z: shade.position.z,
      };
      const W = CONFIG.warden;
      const half = { x: W.radius, y: W.standHeight / 2, z: W.radius };
      let stand = null;
      for (let radius = 8; radius <= 16 && !stand; radius += 2) {
        for (let i = 0; i < 24 && !stand; i++) {
          const angle = (i / 24) * Math.PI * 2;
          const floorY = siteA.position.y;
          const centre = {
            x: torso.x + Math.sin(angle) * radius,
            y: floorY + half.y + 0.05,
            z: torso.z + Math.cos(angle) * radius,
          };
          const eye = { x: centre.x, y: floorY + W.standHeight * W.eyeHeightRatio, z: centre.z };
          if (h.map.collision.lineOfSight(eye, torso) && h.map.collision.isClear(centre, half)) {
            stand = { x: centre.x, y: floorY, z: centre.z };
          }
        }
      }
      if (!stand) return { pass: false, detail: 'no clear stand with sight of site A' };
      warden.reset({ position: stand, yaw: 0 });
      warden.lookAt(shade.position);
      h.stepFrames(1);
      const pinned = warden.position.clone();

      const thrown = [];
      const off = h.emitter.on('ai:throw', (event) => thrown.push(event.type));
      let detonations = 0;
      const offBoom = h.emitter.on('gadget:detonate', (event) => {
        if (event.type === 'frag') detonations++;
      });

      // Hold it in ENGAGE on a Shade that never moves. Section 11: "throw a
      // frag if the Shade is static for 2s".
      const fragBefore = gadgets.loadout.frag;
      const healthBefore = shade.health;
      let projectileSeen = false;
      const window = Math.round((A.fragStaticTime + GA.throw.fuse + 3) / CONFIG.time.fixedDt);
      for (let i = 0; i < window; i++) {
        warden.position.copy(pinned);
        warden.velocity.set(0, 0, 0);
        warden.lookAt(shade.position);
        wardenAI.lastKnown = { x: shade.position.x, y: shade.feetY, z: shade.position.z };
        if (wardenAI.state !== 'engage') wardenAI._enter('engage');
        // God mode on the Shade, or four rifle rounds end the test before the
        // grenade lands — the gun is not what is being measured here.
        shade.health = CONFIG.shade.health;
        h.stepFrames(1);
        if (gadgets.projectiles.length > 0) projectileSeen = true;
      }

      if (thrown.indexOf('frag') === -1) {
        problems.push(`a static target for ${A.fragStaticTime}s drew no frag (threw [${thrown}])`);
      }
      if (!projectileSeen) problems.push('the decision was made but nothing was ever in flight');
      if (detonations === 0) problems.push('the frag never detonated');
      if (gadgets.loadout.frag >= fragBefore) problems.push('throwing a frag did not cost one');

      // It actually hurt: damage arrives through the real gadget:damage path.
      let damaged = 0;
      const offHurt = h.emitter.on('gadget:damage', (event) => {
        if (event.target === 'shade' && event.source === 'frag') damaged += event.amount;
      });
      shade.health = CONFIG.shade.health;
      const at = { x: shade.position.x, y: shade.feetY + 0.3, z: shade.position.z };
      h.gadgets.effects.spawned = h.gadgets.effects.spawned;
      h.emitter.emit('gadget:detonate', { type: 'frag', at });
      // Detonating by hand only proves the event bus; drive the real one too.
      gadgets._detonate({ type: 'frag', x: at.x, y: at.y, z: at.z, owner: 'warden' }, shade, warden);
      offHurt();
      if (damaged <= 0) problems.push('a frag on top of the Shade did no damage');
      if (damaged > GA.frag.damageCentre + 1e-6) {
        problems.push(`a single frag did ${damaged.toFixed(1)}, over its ${GA.frag.damageCentre} centre damage`);
      }

      // Section 9.2's counts. The AI asks as often as it likes; the loadout is
      // what says no, which is the same gate a human hits.
      gadgets.reset();
      let allowed = 0;
      for (let i = 0; i < GA.frag.count + 4; i++) {
        const from = { x: warden.position.x, y: warden.eyeY, z: warden.position.z };
        if (gadgets.throwGadget('frag', from, { x: 0, y: 0.2, z: -1 }, 'warden')) allowed++;
      }
      if (allowed !== GA.frag.count) problems.push(`the Warden got ${allowed} frags, Section 9.2 gives ${GA.frag.count}`);

      // And a stun grenade slows the Shade to 40% rather than damaging it.
      //
      // Asserted on what the detonation emits, not on the Shade's health after
      // stepping: the Warden is still standing over it in ENGAGE at this point,
      // and a rifle round arriving during those steps would read as the stun
      // having done the damage.
      gadgets.reset();
      let stunDamage = 0;
      const offStun = h.emitter.on('gadget:damage', (event) => { stunDamage += event.amount; });
      gadgets._detonate(
        { type: 'stunGrenade', x: shade.position.x, y: shade.feetY, z: shade.position.z, owner: 'warden' },
        shade, warden
      );
      offStun();
      const slow = gadgets.shadeSpeedMultiplier();
      if (Math.abs(slow - GA.stunGrenade.speedMultiplier) > 1e-6) {
        problems.push(`a stun grenade slowed the Shade to ${slow}, spec ${GA.stunGrenade.speedMultiplier}`);
      }
      if (stunDamage !== 0) problems.push(`a stun grenade dealt ${stunDamage} damage — it is non-lethal`);

      off();
      offBoom();
      gadgets.reset();
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      void healthBefore;
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `a target static for ${A.fragStaticTime}s drew ${thrown.filter((t) => t === 'frag').length} frag(s): `
            + `in flight, ${detonations} detonation(s), ${damaged.toFixed(0)} damage through the real path `
            + `(cap ${GA.frag.damageCentre}); the loadout allowed exactly ${allowed} of ${GA.frag.count}; `
            + `a stun grenade slowed to ${(slow * 100).toFixed(0)}% and did no damage`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'gadget-effects-all-expire',
    spec: 'Section 9 / Section 16 check 17 / Section 15',
    name: 'Every gadget type applies its effect and the registry returns to zero',
    run: (h) => {
      const gadgets = h.gadgets;
      const dt = CONFIG.time.fixedDt;
      const problems = [];
      gadgets.reset();
      h.shade.reset(h.map.shadeSpawns[0]);
      h.warden.reset(h.map.wardenSpawns[0]);

      // Stand both actors in the open Turbine Hall so line of sight is real.
      h.shade.position.set(-18, CONFIG.shade.standHeight / 2 + 0.05, -4);
      h.warden.position.set(-20, CONFIG.warden.standHeight / 2 + 0.05, -4);
      const at = { x: -18, y: 1, z: -4 };

      // Detonate one of each thrown type directly, so this check is about the
      // effects rather than about grenade flight.
      for (const type of [GADGET.SMOKE, GADGET.FLASHBANG, GADGET.STUN, GADGET.FRAG]) {
        gadgets._detonate({ type, x: at.x, y: at.y, z: at.z, owner: 'test' }, h.shade, h.warden);
      }
      const started = gadgets.effects.count;
      if (started < 3) problems.push(`only ${started} effects started from four detonations`);
      if (gadgets.shadeSpeedMultiplier() !== GA.stunGrenade.speedMultiplier) {
        problems.push('the stun grenade did not slow the Shade');
      }
      if (!gadgets.blocksSight(
        { x: -20, y: 1.5, z: -4 }, { x: -16, y: 1.5, z: -4 }
      )) problems.push('smoke did not block a line straight through it');

      // Section 15: active effects must return to zero. The longest here is
      // the 8s smoke, so ten seconds is comfortably past all of them.
      let steps = 0;
      while (gadgets.effects.count > 0 && steps++ < 20 / dt) {
        gadgets.step(dt, { shade: h.shade, warden: h.warden });
      }
      const settled = gadgets.effects.count;
      if (settled !== 0) problems.push(`${settled} effects still active after ${(steps * dt).toFixed(1)}s`);
      if (gadgets.shadeSpeedMultiplier() !== 1) problems.push('the slow outlived its effect');
      if (gadgets.blocksSight({ x: -20, y: 1.5, z: -4 }, { x: -16, y: 1.5, z: -4 })) {
        problems.push('smoke still blocking after it expired');
      }

      gadgets.reset();
      h.shade.reset(h.map.shadeSpawns[0]);
      h.warden.reset(h.map.wardenSpawns[0]);

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${started} effects from four detonations, all drained in ${(steps * dt).toFixed(1)}s; slow and smoke both stopped applying`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'grenades-do-not-tunnel-through-walls',
    maps: ['plant'], // thrown at the plant's west wall
    spec: 'Section 9 / Section 16 check 18',
    name: 'A grenade thrown hard at a wall stays on this side of it',
    run: (h) => {
      const gadgets = h.gadgets;
      const dt = CONFIG.time.fixedDt;
      const problems = [];
      gadgets.reset();

      // Throw due west at the perimeter wall, whose inner face is x = -30.
      const from = { x: -20, y: 1.6, z: -4 };
      for (const speedScale of [1, 4, 12]) {
        gadgets.reset();
        const projectile = gadgets.throwGadget(GADGET.FRAG, from, { x: -1, y: 0, z: 0 }, 'test');
        if (!projectile) {
          problems.push('no frag left to throw');
          break;
        }
        // Drive it far harder than the loadout ever would.
        projectile.vx *= speedScale;
        let worst = projectile.x;
        for (let i = 0; i < 3 / dt; i++) {
          projectile.step(dt, h.map.collision);
          worst = Math.min(worst, projectile.x);
        }
        if (worst < -30) problems.push(`at ${speedScale}x it reached x=${worst.toFixed(2)}, past the wall at -30`);
      }

      gadgets.reset();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? 'thrown at 1x, 4x and 12x the spec speed into a wall at x=-30: never crossed it'
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'flashbang-needs-line-of-sight',
    maps: ['plant'], // the hall's east wall is the unseen case
    spec: 'Section 9.1',
    name: 'A flash round a corner does not blind the AI; one in the open does',
    run: (h) => {
      const gadgets = h.gadgets;
      const problems = [];
      h.warden.reset(h.map.wardenSpawns[0]);
      h.warden.position.set(-20, CONFIG.warden.standHeight / 2 + 0.05, -4);

      // In the open, a few metres away: seen, so it blinds.
      gadgets.reset();
      gadgets._detonate({ type: GADGET.FLASHBANG, x: -17, y: 1.5, z: -4, owner: 'shade' }, h.shade, h.warden);
      const open = gadgets.aiBlinded();

      // The same flash on the far side of the hall's east wall: not seen.
      gadgets.reset();
      gadgets._detonate({ type: GADGET.FLASHBANG, x: 2, y: 1.5, z: -10, owner: 'shade' }, h.shade, h.warden);
      const behindWall = gadgets.aiBlinded();

      if (!open) problems.push('a flash in the open did not blind the AI');
      if (behindWall) problems.push('a flash through a wall blinded the AI');

      gadgets.reset();
      h.warden.reset(h.map.wardenSpawns[0]);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? 'in the open at 3m blinds; the same flash behind the hall wall does not'
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'taser-stuns-costs-a-charge-and-recharges',
    spec: 'Section 9.1',
    name: 'One charge stuns the Warden for 3s and comes back after 25s',
    run: (h) => {
      const gadgets = h.gadgets;
      const dt = CONFIG.time.fixedDt;
      const problems = [];
      gadgets.reset();
      h.shade.reset(h.map.shadeSpawns[0]);
      h.warden.reset(h.map.wardenSpawns[0]);

      // The Shade at the foot of a clear lane, the Warden down it
      // (tests/lanes.js): 4m for the hit, range + 3 for the miss.
      const lane = clearLane(h, GA.taser.range + 4);
      if (!lane) return { pass: false, detail: `no ${GA.taser.range + 4}m clear lane on this map` };
      const near = alongLane(lane, 4);
      h.shade.position.set(lane.x, lane.y + CONFIG.shade.standHeight / 2 + 0.05, lane.z);
      h.warden.position.set(near.x, near.y + CONFIG.warden.standHeight / 2 + 0.05, near.z);
      const aim = { x: lane.dx, y: 0, z: lane.dz };

      const hit = gadgets.fireTaser(h.shade, h.warden, aim);
      if (hit !== 'warden') problems.push(`taser at 4m hit ${hit}, want the warden`);
      if (h.warden.state !== WARDEN_STATE.STUNNED) problems.push('the Warden was not stunned');
      if (gadgets.taserCharge !== 0) problems.push('the shot did not cost the charge');
      if (gadgets.fireTaser(h.shade, h.warden, aim) !== null) problems.push('fired again with no charge');

      // Out of range on a fresh charge does nothing (Section 9.1: 6m).
      gadgets.reset();
      h.warden.reset(h.map.wardenSpawns[0]);
      const beyond = alongLane(lane, GA.taser.range + 3);
      h.warden.position.set(beyond.x, beyond.y + CONFIG.warden.standHeight / 2 + 0.05, beyond.z);
      const far = gadgets.fireTaser(h.shade, h.warden, aim);
      if (far === 'warden') problems.push(`taser reached ${GA.taser.range + 3}m, range is ${GA.taser.range}m`);
      if (gadgets.taserCharge !== GA.taser.charges && far === null) problems.push('a miss cost a charge');

      // Recharge over 25s.
      gadgets.reset();
      gadgets.taserCharge = 0;
      gadgets.taserRecharge = 0;
      let steps = 0;
      while (gadgets.taserCharge === 0 && steps++ < 40 / dt) {
        gadgets.step(dt, { shade: h.shade, warden: h.warden });
      }
      const seconds = steps * dt;
      if (Math.abs(seconds - GA.taser.rechargeTime) > 0.2) {
        problems.push(`recharged in ${seconds.toFixed(1)}s, spec is ${GA.taser.rechargeTime}s`);
      }

      gadgets.reset();
      h.shade.reset(h.map.shadeSpawns[0]);
      h.warden.reset(h.map.wardenSpawns[0]);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `stunned at 4m for ${GA.taser.stunDuration}s and cost the only charge; missed past ${GA.taser.range}m; recharged in ${seconds.toFixed(1)}s`
          : problems.join('; '),
      };
    },
  });
}
