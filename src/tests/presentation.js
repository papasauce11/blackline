/**
 * BLACKLINE - tests/presentation.js
 *
 * AUTO suite (Section 16, Section 17.1): Effects and UI.
 *
 * Fixed pools that never grow, ragdoll-lite freezing, and the HUD reading the
 * same smoothed meter Section 4.2 drives the character with.
 *
 * Registered from tests/index.js. Checks reach the live game through the
 * harness `h`; nothing here imports main.js, which Section 3.1 forbids.
 */

import { CONFIG } from '../config.js';

const E = CONFIG.effects;
const GA = CONFIG.gadgets;

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'effect-pools-are-fixed-and-drain',
    spec: 'Section 15 (footprint leak, particle framerate)',
    name: 'Footprints, particles and smoke recycle a fixed pool and return to zero',
    run: (h) => {
      const effects = h.effects;
      const dt = CONFIG.time.fixedDt;
      const problems = [];
      effects.reset();

      const sizes = {
        footprints: effects.footprints.length,
        particles: effects.particles.length,
        smoke: effects.smoke.length,
      };
      if (sizes.footprints !== E.footprintPoolSize) problems.push(`footprint pool ${sizes.footprints}`);
      if (sizes.particles !== E.particlePoolSize) problems.push(`particle pool ${sizes.particles}`);
      if (sizes.smoke !== GA.smoke.spriteCap) problems.push(`smoke pool ${sizes.smoke}`);

      // Flood every pool well past its size. The pools must recycle, not grow.
      const at = { x: -18, y: 0.1, z: -4 };
      for (let i = 0; i < E.footprintPoolSize * 3; i++) effects.footprint(at, 'shade');
      for (let i = 0; i < 8; i++) effects.sparks(at, 40);
      for (let i = 0; i < 6; i++) effects.smokeBurst(at);

      if (effects.footprints.length !== sizes.footprints) problems.push('the footprint pool grew');
      if (effects.particles.length !== sizes.particles) problems.push('the particle pool grew');
      if (effects.smoke.length !== sizes.smoke) problems.push('the smoke pool grew');
      if (effects.pooledSprites > GA.smoke.spriteCap) {
        problems.push(`${effects.pooledSprites} sprites, cap is ${GA.smoke.spriteCap}`);
      }
      const peak = effects.activeCount;

      // One shared material each, and one draw call each (Section 15).
      const materials = new Set([
        effects.footprintMesh.material, effects.particleMesh.material, effects.smokeMesh.material,
      ]);
      if (materials.size !== 3) problems.push('the three pools do not each have exactly one material');

      // Section 15: everything returns to zero. Smoke is the longest at 8s.
      let steps = 0;
      while (effects.activeCount > 0 && steps++ < 30 / dt) effects.step(dt);
      if (effects.activeCount !== 0) problems.push(`${effects.activeCount} effects left after ${(steps * dt).toFixed(1)}s`);

      effects.reset();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `pools fixed at ${sizes.footprints}/${sizes.particles}/${sizes.smoke}, flooded to ${peak} active, drained to 0 in ${(steps * dt).toFixed(1)}s, one material each`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'ragdoll-is-lite-and-freezes',
    spec: 'Section 15 (ragdoll goes unstable)',
    name: 'One impulse, damped tumble, frozen after 2s and never below the floor',
    run: (h) => {
      const effects = h.effects;
      const dt = CONFIG.time.fixedDt;
      const problems = [];
      effects.reset();

      const mesh = h.warden.mesh;
      const startRotation = mesh.rotation.x;
      mesh.position.set(-18, 1, -4);
      effects.ragdoll(mesh, { x: 1, y: 0, z: 0 });
      if (effects.ragdolls.length !== 1) problems.push('no ragdoll started');

      let lowest = Infinity;
      let steps = 0;
      while (effects.ragdolls.length > 0 && steps++ < 10 / dt) {
        effects.step(dt);
        lowest = Math.min(lowest, mesh.position.y);
        if (!Number.isFinite(mesh.position.y) || !Number.isFinite(mesh.rotation.x)) {
          problems.push('ragdoll went non-finite');
          break;
        }
      }
      const seconds = steps * dt;
      const frozen = mesh.position.clone();
      const rotated = Math.abs(mesh.rotation.x - startRotation) > 1e-6;

      // Frozen means frozen: further steps must not move it.
      for (let i = 0; i < 1 / dt; i++) effects.step(dt);
      if (frozen.distanceTo(mesh.position) > 1e-9) problems.push('the ragdoll kept moving after freezing');
      if (Math.abs(seconds - E.ragdollDuration) > 0.1) {
        problems.push(`froze after ${seconds.toFixed(2)}s, spec is ${E.ragdollDuration}s`);
      }
      if (lowest < -0.001) problems.push(`sank to y=${lowest.toFixed(3)}, below the floor`);
      if (!rotated) problems.push('it never tumbled');

      mesh.rotation.set(0, 0, 0);
      effects.reset();
      h.warden.reset(h.map.wardenSpawns[0]);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `tumbled and froze after ${seconds.toFixed(2)}s (spec ${E.ragdollDuration}s), stayed on or above the floor, and stopped dead`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'hud-reads-the-meter-it-is-shown-beside',
    spec: 'Section 4.2 / Section 13',
    name: 'The visibility bar tracks the smoothed meter, and lives dim as they are spent',
    run: (h) => {
      const hud = h.hud;
      const problems = [];
      if (!hud) return { pass: false, detail: 'no HUD' };

      const read = () => parseFloat(hud.el.visFill.style.height) || 0;
      for (const value of [0, 25, 60, 100]) {
        hud.update(0, { role: 'shade', visibility: value, lives: 3, health: 100, score: { shade: 0, warden: 0 } });
        // Section 4.2: the bar reads the meter, it does not compute its own.
        if (Math.abs(read() - value) > 0.51) problems.push(`meter ${value} drew ${read()}%`);
      }

      // Three pips, dimming as they are spent (Section 13).
      for (const lives of [3, 2, 0]) {
        hud.update(0, { role: 'shade', visibility: 0, lives, health: 100, score: { shade: 0, warden: 0 } });
        const spent = hud._pips.filter((pip) => pip.classList.contains('spent')).length;
        if (spent !== CONFIG.hud.livesPips - lives) problems.push(`${lives} lives dimmed ${spent} pips`);
      }

      // On death the centre carries the reinsert countdown (Section 13).
      hud.update(0, {
        role: 'shade', visibility: 0, lives: 2, health: 0, score: { shade: 0, warden: 0 },
        awaitingReinsert: true, reinsertIn: 9.4,
      });
      if (hud.el.centre.style.display !== 'block') problems.push('no reinsert countdown on death');
      if (hud.el.centreBig.textContent !== '10') problems.push(`countdown read ${hud.el.centreBig.textContent}`);

      // Free-roam shows a crosshair whose gap is the live spread.
      hud.update(0, { role: 'warden', health: 100, magazine: 30, spread: 4, score: { shade: 0, warden: 0 } });
      if (hud.el.crosshair.style.display !== 'block') problems.push('no crosshair in free-roam');
      const wide = parseFloat(hud.el.crossBars[1].style.left);
      hud.update(0, { role: 'warden', health: 100, magazine: 30, spread: 0.6, score: { shade: 0, warden: 0 } });
      const tight = parseFloat(hud.el.crossBars[1].style.left);
      if (!(wide > tight)) problems.push('the crosshair did not widen with spread');

      hud.update(0, { role: 'shade', visibility: 0, lives: 3, health: 100, score: { shade: 0, warden: 0 } });
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `bar tracked 0/25/60/100 exactly, pips dimmed 0/1/3, reinsert countdown replaced the centre, crosshair gap ${tight}px -> ${wide}px with spread`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'menu-is-the-audio-gate-and-the-only-entry',
    spec: 'Section 12, Section 13, Section 15 (autoplay)',
    name: 'Play fires the gesture once and both modes go through initMatch',
    run: (h) => {
      const menu = h.menu;
      const problems = [];
      if (!menu) return { pass: false, detail: 'no menu' };

      const wasOpen = menu.open;
      let gestures = 0;
      let plays = 0;
      let freeRoams = 0;
      const original = menu.handlers;
      menu.handlers = {
        onFirstGesture: () => gestures++,
        onPlay: () => plays++,
        onFreeRoam: () => freeRoams++,
      };
      menu.gestureFired = false;
      menu.show('main');

      menu.root.querySelector('[data-action=play]').click();
      if (plays !== 1) problems.push('Play did not start a match');
      if (gestures !== 1) problems.push(`Play fired ${gestures} gestures, want exactly 1`);
      if (menu.open) problems.push('the menu stayed open after Play');

      // The gate is once per session, not once per button.
      menu.show('main');
      menu.root.querySelector('[data-action=freeroam]').click();
      if (freeRoams !== 1) problems.push('Free Roam did not start');
      if (gestures !== 1) problems.push(`the gesture fired again (${gestures} total)`);

      // Settings is reachable and does not start anything.
      menu.show('main');
      menu.root.querySelector('[data-action=settings]').click();
      if (!menu.root.querySelector('#bl-sens')) problems.push('settings did not render');
      if (plays !== 1 || freeRoams !== 1) problems.push('settings started a match');

      menu.handlers = original;
      // Leave the menu as it was found: this check clicked its way out of it.
      if (wasOpen) menu.show('main');
      else menu.hide();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? 'Play and Free Roam both route through initMatch; the audio gesture fired exactly once across both; settings starts nothing'
          : problems.join('; '),
      };
    },
  });
}
