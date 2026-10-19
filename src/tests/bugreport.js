/**
 * BLACKLINE - tests/bugreport.js
 *
 * AUTO suite (H12): *Copy report* on the pause menu produces the text a friend
 * pastes, and it says what the routine needs to reproduce what they saw.
 *
 * Driven the way a player gets there: a match, keys held and let go through
 * the input layer, a line logged, the pause page, the button. The text is read
 * back off the page's own box - the clipboard is a browser's to refuse, and a
 * headless one does - so this reads exactly what a player who copies it by
 * hand would have.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG, SETTINGS, rng } from '../config.js';
import { VERSION } from '../version.js';

const R = CONFIG.debug.report;

/** Hold a key for some steps, then let it go, through the input layer. */
function tap(h, code, steps) {
  h.input.heldCodes.add(code);
  h.input.pressedCodes.add(code);
  h.stepFrames(steps);
  h.input.clearEdges();
  h.input.heldCodes.delete(code);
  h.stepFrames(1);
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'copy-report-on-the-pause-menu-says-the-build-the-match-and-the-last-thirty-seconds',
    spec: 'H12',
    name: 'The pause menu\'s Copy report produces text naming the build, the map, the seed, the settings, the input inside the window and the last lines logged',
    run: (h) => {
      const problems = [];
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: true });
      h.menu.hide();
      h.setPaused(false);
      h.input.clearAll();
      const marker = `bug report marker ${rng.seed}`;
      let text = '';
      // Off under automation (bugreport.js says why), so on for this check only.
      const untap = h.bugReport.tapConsole();
      try {
        // A key long enough ago that the window must have let it go...
        tap(h, 'KeyF', 2);
        const stale = Math.ceil((R.inputSeconds + 1) / CONFIG.time.fixedDt);
        for (let left = stale; left > 0; left -= CONFIG.debug.autoTestMaxFrames) h.stepFrames(Math.min(left, CONFIG.debug.autoTestMaxFrames));
        // ...and one inside it, held for five steps.
        tap(h, 'KeyW', 5);
        console.info(marker);

        h.menu.show('pause');
        const button = h.menu.root.querySelector('[data-action=report]');
        if (!button) {
          problems.push('the pause page has no Copy report button');
        } else {
          button.click();
          const box = h.menu.root.querySelector('[data-role=report]');
          text = box ? box.value : '';
          if (!box || box.hidden) problems.push('Copy report showed no text to copy by hand');
        }
      } finally {
        untap();
        h.menu.hide();
        h.input.clearAll();
      }

      const has = (needle, what) => { if (text.indexOf(needle) === -1) problems.push(`the report does not carry ${what} ("${needle}")`); };
      if (text) {
        has(`map: ${h.map.id}`, 'the map');
        has(`seed: ${rng.seed}`, 'the seed the match was opened with');
        has(VERSION.commit || VERSION.source, VERSION.commit ? 'the commit, not only the label' : 'why the build has no commit');
        has(`"mouseSensitivity":${SETTINGS.mouseSensitivity}`, 'the live settings');
        has('+KeyW', 'the key held inside the window');
        has('-KeyW', 'the key let go inside the window');
        has(marker, 'the last line logged');
        if (text.indexOf('KeyF') !== -1) problems.push(`the report carries a key pressed ${R.inputSeconds + 1}s ago, outside its ${R.inputSeconds}s window`);
        const logged = text.split('\nlog, last ')[1] || '';
        const kept = logged.split('\n').slice(1).filter((l) => l.startsWith('  [')).length;
        if (kept > R.logLines) problems.push(`the report keeps ${kept} log lines, over its ${R.logLines}`);
      }

      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${text.length} characters, ${text.split('\n').length} lines: the map, the seed, the commit ${VERSION.short || VERSION.source}, the settings, `
            + `+KeyW and -KeyW inside the ${R.inputSeconds}s window and a key from ${R.inputSeconds + 1}s ago gone, the marker line in the log`
          : problems.join('; '),
      };
    },
  });
}
