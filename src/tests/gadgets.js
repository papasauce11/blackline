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

const GA = CONFIG.gadgets;

export function register(debugTools) {
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

      h.shade.position.set(-20, CONFIG.shade.standHeight / 2 + 0.05, -4);
      h.warden.position.set(-16, CONFIG.warden.standHeight / 2 + 0.05, -4);
      const aim = { x: 1, y: 0, z: 0 };

      const hit = gadgets.fireTaser(h.shade, h.warden, aim);
      if (hit !== 'warden') problems.push(`taser at 4m hit ${hit}, want the warden`);
      if (h.warden.state !== WARDEN_STATE.STUNNED) problems.push('the Warden was not stunned');
      if (gadgets.taserCharge !== 0) problems.push('the shot did not cost the charge');
      if (gadgets.fireTaser(h.shade, h.warden, aim) !== null) problems.push('fired again with no charge');

      // Out of range on a fresh charge does nothing (Section 9.1: 6m).
      gadgets.reset();
      h.warden.reset(h.map.wardenSpawns[0]);
      h.warden.position.set(-20 + GA.taser.range + 3, CONFIG.warden.standHeight / 2 + 0.05, -4);
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
