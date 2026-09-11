/**
 * BLACKLINE — harness.js
 *
 * The object handed to the AUTO suite, the assertions and `window.BLACKLINE`
 * (Section 17.1). Nothing may import main.js (Section 3.1), so this is the
 * only way a check reaches the engine: main.js builds it once with a getter
 * for every live object and the handful of loop functions a check may drive.
 */

import { CONFIG } from './config.js';

/**
 * @param {Record<string, () => any>} live one getter per engine object, so
 *   tests always see the current instance rather than the one at boot
 * @param {object} loop the composition root's own functions, not copies:
 *   `fixedStep`, `renderFrame`, `setPaused`, plus everything exposed as-is
 */
export function createHarness(live, loop) {
  const { fixedStep, renderFrame, setPaused, ...exposed } = loop;
  const harness = {
    ...exposed,
    setPaused,

    /**
     * Advance the simulation synchronously, without rendering. This is how the
     * AUTO suite drives scripted state transitions (Section 17.1).
     */
    stepFrames(count) {
      const n = Math.min(Math.max(0, Math.floor(count)), CONFIG.debug.autoTestMaxFrames);
      for (let i = 0; i < n; i++) fixedStep(CONFIG.time.fixedDt);
      return n;
    },

    /**
     * Put the presentation layer where a check expects to find it: no menu, no
     * intermission, nothing paused, the HUD shown. The suite runner calls this
     * before every check (F2). The frame derives `hud.visible` from the menu
     * and `hud.update()` draws nothing while hidden, so a check that rendered
     * a frame behind a menu used to leave the next HUD-reading check reading a
     * stale DOM; and at boot the menu is up, so the first such check in any
     * subset read a HUD nothing had ever shown.
     */
    resetPresentation() {
      live.menu().hide();
      live.scoreboard().hide();
      setPaused(false);
      live.hud().setVisible(true);
    },

    /** Await one real animation frame, for tests that need the renderer to run. */
    nextFrame() {
      return new Promise((resolve) => requestAnimationFrame(() => resolve()));
    },

    /**
     * Run one complete frame synchronously — the same function requestAnimationFrame
     * calls, not a copy of it. This is what lets the check-29 benchmark measure
     * the real cost of a frame in a tab the compositor is not driving.
     *
     * @param {number} [wallDelta] seconds to pretend elapsed; defaults to one
     *   frame at the target rate, so the fixed-step count is representative.
     */
    renderFrame(wallDelta) {
      const delta = Number.isFinite(wallDelta) ? wallDelta : 1 / CONFIG.performance.targetFps;
      renderFrame(delta);
      return delta;
    },
  };

  // Getters, so tests always see live objects.
  for (const key of Object.keys(live)) {
    Object.defineProperty(harness, key, { get: live[key], enumerable: true });
  }
  return harness;
}
