/**
 * BLACKLINE - tests/pausemenu.js
 *
 * AUTO suite (H15): the pause menu's four ways out of a round - restart the
 * round, restart the match, change map, quit to the menu - each driven by
 * its own button, each asking first while a round is live and not when
 * there is nothing to lose.
 *
 * Every button here is the real one and every handler the real one: a
 * restart is read off the objective (the round's number, its clock and the
 * score), and change map off the main page the ring lands on. Nothing is
 * stubbed, because change map is not a page load - the cards are the way to
 * pick a map (D55), so it ends the match and puts the ring on one.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG, SETTINGS } from '../config.js';

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-pause-menu-restarts-changes-map-and-quits-and-asks-first-mid-round',
    spec: 'H15',
    name: 'Restart round keeps the round number and the score and zeroes the round clock, restart match zeroes both, change map ends the match on the main page with the ring on another map, quit goes to the menu; each asks first mid-round and not in free roam',
    run: (h) => {
      const problems = [];
      const obj = h.objective;
      const menu = h.menu;
      const wasBriefing = SETTINGS.briefing;
      const open = (round) => {
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: true, round });
        menu.hide();
        h.setPaused(false);
      };
      const click = (action) => {
        const el = menu.root.querySelector(`[data-action=${action}]`);
        if (!el) {
          problems.push(`the ${menu.open ? menu.page : 'closed'} page has no ${action}`);
          return false;
        }
        el.click();
        return true;
      };
      // Asked, then taken: the confirm must be in front of it, and it must be the one.
      const confirmed = (action) => {
        if (!click(action)) return;
        if (menu.page !== 'confirm') problems.push(`${action} mid-round went to ${menu.page} without asking`);
        else click('yes');
      };
      const read = [];
      try {
        SETTINGS.briefing = false;
        // 1. Restart round: refused once, then taken.
        open(2);
        obj.score.shade = 1;
        h.stepFrames(30);
        const ran = obj.round.elapsed;
        if (!(ran > 0)) problems.push('the round clock did not run, so a restart would prove nothing');
        h.setPaused(true);
        if (click('restart-round')) {
          if (menu.page !== 'confirm') problems.push('restart round mid-round did not ask');
          else {
            click('no');
            if (menu.page !== 'pause') problems.push(`No went to ${menu.page}, not back to the pause page`);
            if (obj.round.elapsed !== ran) problems.push('No restarted the round anyway');
          }
        }
        confirmed('restart-round');
        if (obj.round.number !== 2) problems.push(`restart round started round ${obj.round.number}, want 2`);
        if (obj.round.elapsed !== 0) problems.push(`restart round left the round clock at ${obj.round.elapsed.toFixed(2)}s`);
        if (obj.score.shade !== 1) problems.push(`restart round took the score to ${obj.score.shade}, want it kept at 1`);
        if (h.paused || menu.open) problems.push('restart round left the match paused or the menu up');
        read.push(`round 2 kept at ${ran.toFixed(2)}s then reset`);

        // 2. Restart match, with the briefing on: the round goes up behind it.
        SETTINGS.briefing = true;
        h.stepFrames(10);
        h.setPaused(true);
        confirmed('restart-match');
        if (obj.round.number !== 1 || obj.score.shade !== 0) problems.push(`restart match left round ${obj.round.number} at ${obj.score.shade}-${obj.score.warden}`);
        if (!h.briefing.open) problems.push('restart match did not put the briefing up, the way every route into a round does');
        h.briefing.hide();
        SETTINGS.briefing = false;

        // 3. Change map: the match ends and the ring is on another map's card.
        obj.score.warden = 1;
        h.setPaused(true);
        confirmed('change-map');
        if (menu.page !== 'main') problems.push(`change map went to ${menu.page}, not the main page`);
        else {
          const on = menu.rows[menu.focus] && menu.rows[menu.focus].el;
          const cards = menu.root.querySelectorAll('.mapcard').length;
          if (!on || !on.classList.contains('mapcard')) problems.push('change map left the ring off the map cards');
          else if (cards > 1 && on.getAttribute('aria-current') === 'true') problems.push('change map put the ring on the map already loaded');
          else read.push(`change map on ${on.dataset.map}`);
        }
        if (obj.score.warden !== 0) problems.push('change map did not end the match');
        if (h.paused) problems.push('change map left the match paused');

        // 4. Quit to the menu.
        open(1);
        h.stepFrames(5);
        h.setPaused(true);
        confirmed('quit');
        if (menu.page !== 'main' || h.paused) problems.push(`quit left the menu on ${menu.page}, paused ${h.paused}`);

        // 5. Nothing to lose, nothing asked: free roam has no round.
        h.initMatch({ mode: 'freeroam', role: 'warden', ai: false, objective: false });
        menu.hide();
        h.setPaused(false);
        h.setPaused(true);
        if (click('restart-round')) {
          if (menu.page === 'confirm') problems.push('free roam asked to confirm a restart with no round to lose');
          if (menu.open || h.paused) problems.push('restart round in free roam left the menu up');
        }

        // 6. Both pages declare every control they draw.
        for (const page of ['pause', 'confirm']) {
          menu.show(page);
          const drew = [...menu.root.querySelectorAll('button')].filter((el) => el.onclick).length;
          if (drew !== menu.rows.length) problems.push(`the ${page} page drew ${drew} controls and declared ${menu.rows.length}`);
        }
      } finally {
        SETTINGS.briefing = wasBriefing;
        menu._confirm = null;
        h.briefing.hide();
        menu.hide();
        h.setPaused(false);
        h.input.clearAll();
      }
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      menu.hide();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `restart round, restart match, change map and quit each asked first mid-round and did what it says (${read.join('; ')}); `
            + 'restart match put the briefing up; free roam restarted without asking'
          : problems.join('; '),
      };
    },
  });
}
