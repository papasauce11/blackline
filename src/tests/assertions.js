/**
 * BLACKLINE - tests/assertions.js
 *
 * The Section 17 runtime assertions, checked from the fixed step.
 *
 * These are not the AUTO suite — they run continuously during play and report
 * to the F3 overlay's "assert failures" row. Section 17 names four:
 *
 *   - Player Y is never below the floor plane minus 0.5
 *   - Position and velocity never contain NaN
 *   - Active effect count returns to 0 within 10s of the last gadget expiring
 *   - The round state machine is in exactly one valid state
 *
 * Registered from main.js against the same harness the AUTO suite uses, so
 * nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { SHADE_STATE } from '../entities/agent.js';
import { ROUND } from '../systems/objective.js';

/**
 * @param {import('../ui/debug.js').DebugTools} debugTools
 * @param {object} h harness
 */
export function registerAssertions(debugTools, h) {
  debugTools.registerAssertion('core-finite', () => {
    if (!Number.isFinite(h.clock.sim) || !Number.isFinite(h.clock.wall)) return 'clock is not finite';
    const p = h.camera.position;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
      return `camera position contains NaN (${p.x}, ${p.y}, ${p.z})`;
    }
    return null;
  });

  debugTools.registerAssertion('time-scale-valid', () =>
    Number.isFinite(h.clock.timeScale) && h.clock.timeScale > 0 ? null : `time scale is ${h.clock.timeScale}`
  );

  // Section 17: "Player Y is never below the floor plane minus 0.5".
  debugTools.registerAssertion('shade-above-floor', () => {
    const limit = CONFIG.map.groundY - CONFIG.debug.floorTolerance;
    return h.shade.feetY < limit
      ? `shade feet at y=${h.shade.feetY.toFixed(3)}, floor limit ${limit}`
      : null;
  });

  // Section 17: "Position and velocity never contain NaN".
  debugTools.registerAssertion('shade-finite', () => {
    const p = h.shade.position;
    const v = h.shade.velocity;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
      return `position contains NaN (${p.x}, ${p.y}, ${p.z})`;
    }
    if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) {
      return `velocity contains NaN (${v.x}, ${v.y}, ${v.z})`;
    }
    return null;
  });

  debugTools.registerAssertion('shade-state-valid', () => {
    for (const key of Object.keys(SHADE_STATE)) {
      if (SHADE_STATE[key] === h.shade.state) return null;
    }
    return `shade in unknown state "${h.shade.state}"`;
  });

  // Section 15: one camera object, ever.
  debugTools.registerAssertion('single-camera', () => {
    let count = 0;
    h.scene.traverse((object) => {
      if (object.isCamera) count++;
    });
    return count === 1 ? null : `${count} cameras in the scene graph, expected 1`;
  });

  // Section 17: "the round state machine is in exactly one valid state".
  debugTools.registerAssertion('round-state-valid', () => {
    if (!h.match || !h.match.objectiveEnabled) return null;
    const state = h.objective.round.state;
    for (const key of Object.keys(ROUND)) {
      if (ROUND[key] === state) return null;
    }
    return `round in unknown state "${state}"`;
  });

  // Section 17: "active effect count returns to 0 within 10s of the last gadget
  // expiring". Tracked as a window rather than sampled, because the failure is
  // an effect that never expires and that only shows up over time.
  let idleFor = 0;
  debugTools.registerAssertion('effects-drain-when-idle', () => {
    const live = h.gadgets.effects.count + h.gadgets.projectiles.length;
    if (live > 0) {
      idleFor = 0;
      return null;
    }
    // No gadget is in flight or active, so the pools must be draining.
    idleFor += CONFIG.time.fixedDt * CONFIG.debug.assertionInterval;
    if (idleFor < CONFIG.effects.idleAssertionWindow) return null;
    const sprites = h.effects.pooledSprites;
    return sprites > 0
      ? `${sprites} smoke sprites still alive ${idleFor.toFixed(1)}s after the last gadget expired`
      : null;
  });
}
