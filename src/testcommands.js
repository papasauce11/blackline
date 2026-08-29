/**
 * BLACKLINE — testcommands.js
 *
 * The Section 17.1 test-mode command handlers.
 *
 * `ui/debug.js` owns the F4 panel and turns a keypress into an event; this
 * turns that event into something happening. The two are deliberately apart:
 * the panel knows nothing about the game, and these handlers know nothing about
 * keys, so rebinding one cannot break the other.
 *
 * These exist so a human can reach a situation in one keypress instead of a
 * two-minute walk. Most of what is left in Section 16 is HUMAN checks, and they
 * are hard enough to run without the setup costing more than the check.
 *
 * Layering (Section 3.1): imports config and systems for their state enums. The
 * live objects arrive through the same harness the AUTO suite uses, so nothing
 * here imports main.js.
 */

import { CONFIG } from './config.js';
import { AI_STATE } from './systems/ai.js';

/**
 * @param {object} options
 * @param {object} options.harness live game objects, by getter
 * @param {() => void} options.cycleTimeScale
 * @param {(value: boolean) => void} options.setGodMode
 */
export function wireTestCommands({ harness: h, cycleTimeScale, setGodMode }) {
  const on = (event, handler) => h.emitter.on(event, handler);

  on('test:cycle-time-scale', cycleTimeScale);

  on('test:teleport-site', ({ site }) => {
    const target = h.map.sites[site];
    if (!target) return;
    h.shade.reset({ position: target.position, yaw: h.shade.yaw });
  });

  on('test:teleport-warden', () => {
    // Just behind the Warden, facing its back: the takedown setup (check 13).
    const behind = CONFIG.combat.knife.rearRange * 0.65;
    const warden = h.warden;
    h.shade.reset({
      position: {
        x: warden.position.x + Math.sin(warden.yaw) * behind,
        y: warden.feetY,
        z: warden.position.z + Math.cos(warden.yaw) * behind,
      },
      yaw: warden.yaw,
    });
  });

  on('test:god-mode', () => setGodMode());

  on('test:kill-shade', () => {
    if (h.shade.health <= 0) return;
    h.objective.markDeathPosition(h.shade.position);
    h.shade.health = 0;
    h.emitter.emit('combat:death', { target: 'shade', kind: 'test' });
  });

  on('test:instant-plant', () => {
    const site = h.objective.siteNear(h.shade.position) || h.map.sites[0];
    h.shade.reset({ position: site.position, yaw: h.shade.yaw });
    h.objective.round.plantProgress = CONFIG.round.plantHoldTime;
    h.objective.step(CONFIG.time.fixedDt, {
      shade: h.shade, warden: h.warden, intent: { interact: true },
    });
  });

  on('test:cycle-ai-state', () => {
    const ai = h.wardenAI;
    const states = Object.keys(AI_STATE).map((key) => AI_STATE[key]);
    const next = states[(states.indexOf(ai.state) + 1) % states.length];
    ai.lastKnown = ai.lastKnown || {
      x: h.shade.position.x, y: h.shade.feetY, z: h.shade.position.z,
    };
    ai._enter(next);
  });

  on('test:refill-gadgets', () => {
    h.gadgets.reset();
    h.combat.weapon.reset();
    h.shade.health = CONFIG.shade.health;
  });
}
