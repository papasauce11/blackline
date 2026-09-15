/**
 * BLACKLINE - tests/debuggate.js
 *
 * AUTO suite: C1, the playtest build. The debug tooling - the F3 overlay,
 * the F4 panel and every test-mode key behind it, `?mode=freeroam` - is
 * behind a gate that is OFF by default (`SETTINGS.debug`, seeded false);
 * `?debug=1` on the URL or the settings menu's "debug tooling" row turns
 * it on. The suite runs with it on (`AutoSuite.runChecks` turns it on for
 * the length of a run and puts it back), so this check turns it off for the
 * length of its own presses and asks that every debug key does nothing -
 * through the real path: the code goes into `input.pressedCodes` and
 * `debugTools.pollKeys()` reads it, which is the first thing a frame does.
 *
 * First with the gate ON, so a key that is dead for some other reason
 * cannot pass as gated: F3 shows the overlay, F4 opens the panel, and a
 * panel key (T) reaches the game. Then OFF, with the panel left open, so
 * the panel being open is not what the keys are waiting for.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG, SETTINGS, DEBUG_KEYS, debugRequested } from '../config.js';
import { bootMatchOptions, COMPETITIVE, FREEROAM } from '../matchstate.js';
import { press } from './feel.js';

/** A press of one code, read the way the frame reads it. */
function poll(h, code) {
  press(h, code);
  h.debugTools.pollKeys();
  h.input.clearAll();
}

/** Everything a test-mode key can change, as one comparable line. */
function snapshot(h) {
  const d = h.debugTools;
  const p = h.shade.position;
  return [
    `shade ${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)} health ${h.shade.health}`,
    `god ${!!h.debugState.godMode}`,
    `time ${h.clock.timeScale}`,
    `ai ${h.wardenAI.state}`,
    `plant ${h.objective.round.plantProgress} planted ${!!h.objective.round.planted}`,
    `ground ${!!h.groundView.visible}`,
    `overlay ${d.overlayVisible} panel ${d.testModeVisible}`,
    `log ${d._testLog.length}:${d._testLog[0] || ''}`,
  ].join(' | ');
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'with-the-debug-gate-off-every-debug-key-does-nothing',
    spec: 'Section 17.1, amended (20.12; C1)',
    name: 'The gate is off by default, ?debug=1 and the settings row turn it on, and off it makes F3, F4 and every test key inert',
    run: (h) => {
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      const problems = [];
      const d = h.debugTools;
      const was = SETTINGS.debug;
      const overlayWas = d.overlayVisible;
      const panelWas = d.testModeVisible;
      const timeWas = h.clock.timeScale;
      const runAutoTests = d.runAutoTests;
      const runRegressionSet = d.runRegressionSet;
      let suiteRuns = 0;
      // Y and U would start a suite inside this one; count them instead.
      d.runAutoTests = () => { suiteRuns++; };
      d.runRegressionSet = () => { suiteRuns++; };

      try {
        // The default, and the two ways on.
        if (CONFIG.settings.defaults.debug !== false) problems.push(`the gate defaults to ${CONFIG.settings.defaults.debug}, want false`);
        if (!debugRequested('?debug=1')) problems.push('?debug=1 does not ask for the gate');
        if (!debugRequested('?seed=5&debug=1')) problems.push('?seed=5&debug=1 does not ask for the gate');
        if (debugRequested('?debug=0') || debugRequested('?seed=1') || debugRequested('')) problems.push('a URL without debug=1 asks for the gate');
        // The settings row is rendered on demand; show the page to read it.
        h.menu.show('settings');
        const toggle = h.menu.root.querySelector('#bl-dbg');
        if (!toggle) {
          problems.push('the settings menu has no debug tooling row');
        } else {
          SETTINGS.debug = false;
          toggle.click();
          if (SETTINGS.debug !== true) problems.push('the settings row did not turn the gate on');
          toggle.click();
          if (SETTINGS.debug !== false) problems.push('the settings row did not turn the gate off');
        }
        h.menu.hide();

        // Gate ON: the keys are live, so what follows measures the gate.
        SETTINGS.debug = true;
        d.overlayVisible = false;
        d.testModeVisible = false;
        poll(h, DEBUG_KEYS.toggleOverlay);
        if (!d.overlayVisible) problems.push('with the gate on, F3 did not show the overlay');
        poll(h, DEBUG_KEYS.toggleOverlay);
        poll(h, DEBUG_KEYS.toggleTestMode);
        if (!d.testModeVisible) problems.push('with the gate on, F4 did not open the panel');
        poll(h, DEBUG_KEYS.test.cycleTimeScale);
        if (h.clock.timeScale === timeWas) problems.push('with the gate on and the panel open, T did not change the time scale');
        h.setTimeScale(timeWas);
        if (bootMatchOptions('?mode=freeroam') !== FREEROAM) problems.push('with the gate on, ?mode=freeroam does not boot free-roam');

        // Gate OFF, the panel still open. Every key, nothing moves.
        SETTINGS.debug = false;
        const before = snapshot(h);
        const codes = [DEBUG_KEYS.toggleOverlay, DEBUG_KEYS.toggleTestMode, ...Object.values(DEBUG_KEYS.test)];
        for (const code of codes) {
          poll(h, code);
          const after = snapshot(h);
          if (after !== before) problems.push(`with the gate off, ${code} changed something: ${after}`);
        }
        if (suiteRuns) problems.push(`with the gate off, Y or U started ${suiteRuns} suite runs`);
        if (bootMatchOptions('?mode=freeroam') !== COMPETITIVE) problems.push('with the gate off, ?mode=freeroam still boots free-roam');

        // And a frame drawn with the gate off takes the panels down.
        h.renderFrame();
        if (d.overlayVisible || d.testModeVisible) problems.push('a frame with the gate off left a panel up');
        if (!d.overlayEl.classList.contains('bl-hidden') || !d.testEl.classList.contains('bl-hidden')) {
          problems.push('a frame with the gate off left a panel in the DOM unhidden');
        }
      } finally {
        d.runAutoTests = runAutoTests;
        d.runRegressionSet = runRegressionSet;
        SETTINGS.debug = was;
        h.setTimeScale(timeWas);
        h.input.clearAll();
        d.overlayVisible = overlayWas;
        d.overlayEl.classList.toggle('bl-hidden', !overlayWas);
        d.testModeVisible = panelWas;
        d.testEl.classList.toggle('bl-hidden', !panelWas);
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `the gate defaults off; ?debug=1 and the settings row turn it on; on, F3, F4 and T are live; off, `
            + `${2 + Object.keys(DEBUG_KEYS.test).length} debug keys pressed through pollKeys() changed nothing, `
            + 'Y and U ran no suite, free-roam does not boot, and a frame took the panels down'
          : problems.join('; '),
      };
    },
  });
}
