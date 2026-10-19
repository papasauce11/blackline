/**
 * BLACKLINE - tests/crashguard.js
 *
 * AUTO suite (H14): a throw from inside a step stops the match where it was,
 * and the crash page says what broke, with the seed and *Copy report* on it.
 *
 * The throw is a real one, from the Shade's own step, met by the loop's own
 * guard: `h.guardedFrame()` is the frame the rAF callback runs, through
 * `FrameLoop.run`, without the rAF. The window's two routes are driven with
 * the events a browser fires - an `ErrorEvent` and a `PromiseRejectionEvent`
 * dispatched at the window - rather than a real uncaught throw, because a
 * real one is also a `pageerror` on the gate's console list, and this check
 * is about the guard and not about that list.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG, rng } from '../config.js';

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-throw-inside-a-step-stops-the-match-and-the-crash-page-says-so',
    spec: 'H14',
    name: 'A throw from inside a step stops the loop, pauses the match and puts up a crash page naming the error and the seed, whose Copy report counts it and the assertion failures; the window and a lost promise land the same way',
    run: (h) => {
      const problems = [];
      const guard = h.crashGuard;
      const loop = h.loop;
      const shade = h.shade;
      const wasRunning = loop.running;
      const ownStep = Object.prototype.hasOwnProperty.call(shade, 'step');
      const step = shade.step;
      const wasFailures = h.debugTools.assertionFailures;
      const before = guard.count;
      const marker = `crash probe ${rng.seed}`;
      let thrown = 0;
      let text = '';
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: true });
      h.menu.hide();
      h.setPaused(false);
      try {
        // 1. A step that throws, met by the loop's guard.
        shade.step = () => { thrown++; throw new Error(marker); };
        let escaped = null;
        try {
          h.guardedFrame(CONFIG.time.fixedDt * 2);
        } catch (error) {
          escaped = error;
        }
        if (ownStep) shade.step = step; else delete shade.step;
        if (escaped) problems.push(`the throw escaped the loop's guard: ${escaped.message}`);
        if (!thrown) problems.push('the frame ran no step, so nothing was thrown and nothing below means anything');
        if (guard.count !== before + 1) problems.push(`the guard counted ${guard.count - before} crashes for one throw`);
        if (loop.running) problems.push('the loop is still running after the crash');
        if (!h.paused) problems.push('the match was not paused');
        if (!h.menu.open || h.menu.page !== 'crash') problems.push(`the menu is on ${h.menu.open ? h.menu.page : 'nothing'}, not the crash page`);
        const said = (id) => (h.menu.root.querySelector(id) || {}).textContent || '';
        if (said('#bl-crash-message').indexOf(marker) === -1) problems.push(`the crash page says "${said('#bl-crash-message')}", not the error`);
        if (said('#bl-crash-seed') !== String(rng.seed)) problems.push(`the crash page's seed is "${said('#bl-crash-seed')}", want ${rng.seed}`);

        // 2. Copy report, on the crash page, with two assertion failures more.
        h.debugTools.assertionFailures = wasFailures + 2;
        const copy = h.menu.root.querySelector('[data-action=report]');
        if (!copy) problems.push('the crash page has no Copy report');
        else {
          copy.click();
          text = (h.menu.root.querySelector('[data-role=report]') || {}).value || '';
          if (text.indexOf(`crashes: ${guard.count}`) === -1) problems.push(`the report does not count the crash ("crashes: ${guard.count}")`);
          if (text.indexOf(marker) === -1) problems.push('the report does not name the crash');
          if (text.indexOf(`assertion failures: ${wasFailures + 2}`) === -1) problems.push(`the report does not count the assertion failures (${wasFailures + 2})`);
        }
        h.debugTools.assertionFailures = wasFailures;

        // 3. The window and a lost promise: counted, and no second halt.
        window.dispatchEvent(new ErrorEvent('error', { message: 'window probe', error: new Error('window probe') }));
        window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', { promise: Promise.resolve(), reason: new Error('promise probe') }));
        if (guard.count !== before + 3) problems.push(`the window and the promise were counted ${guard.count - before - 1} times, want 2`);
        if (h.menu.page !== 'crash' || said('#bl-crash-message').indexOf(marker) === -1) problems.push('a second crash replaced the first on the page');
        const boot = document.getElementById('bl-boot-error');
        if (boot && boot.style.display === 'block') problems.push('index.html\'s "failed to start" panel came up over a running game');

        // 4. Every control on the page is a row, and Try to continue goes back to the pause page.
        const drew = [...h.menu.root.querySelectorAll('button')].filter((el) => el.onclick);
        if (drew.length !== h.menu.rows.length) problems.push(`the crash page drew ${drew.length} controls and declared ${h.menu.rows.length}`);
        const again = h.menu.root.querySelector('[data-action=continue]');
        if (!again) problems.push('the crash page has no Try to continue');
        else {
          again.click();
          // Started and stopped inside one task, so no frame runs under the check (F4).
          const ran = loop.running;
          if (!wasRunning) loop.stop();
          if (!ran) problems.push('Try to continue did not start the loop again');
          if (h.menu.page !== 'pause') problems.push(`Try to continue went to ${h.menu.page}, not the pause page`);
          if (guard.current) problems.push('the guard still holds a crash after Try to continue');
        }
      } finally {
        if (ownStep) shade.step = step; else delete shade.step;
        h.debugTools.assertionFailures = wasFailures;
        if (!wasRunning) loop.stop();
        h.menu.hide();
        h.setPaused(false);
        h.input.clearAll();
      }
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `a throw in the Shade's step stopped the loop, paused the match and put up the crash page with the error and seed ${rng.seed}; `
            + `Copy report counted it and two assertion failures (${text.split('\n').length} lines); the window and a lost promise were counted without a second halt; `
            + 'Try to continue went back to the pause page'
          : problems.join('; '),
      };
    },
  });
}
