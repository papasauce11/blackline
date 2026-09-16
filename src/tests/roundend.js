/**
 * BLACKLINE - tests/roundend.js
 *
 * AUTO suite: C4, the round and match end screens. A round is ended each of
 * Section 10.4's four ways through the objective's own step - the clock, a
 * detonation, a defuse, the third life - and the screen that comes up must
 * say who won and how, print the round's timeline, and come up
 * `roundEndDelay` after the end rather than in the step that ended it. The
 * fourth round ends the match, so the match screen is read too. And Play
 * from the main menu starts a fresh match whatever the score was.
 *
 * The delay is stepped through the real frame (`h.stepFrames`), so the
 * intermission event goes objective -> wiring -> scoreboard the way it does
 * in play. Registered from tests/index.js. Nothing here imports main.js
 * (Section 3.1).
 */

import { CONFIG, SETTINGS } from '../config.js';
import { CHARGE, ROUND, OUTCOME } from '../systems/objective.js';
import { TIMELINE_LINES } from '../ui/scoreboard.js';
import { plantAt } from './plantspots.js';

const R = CONFIG.round;
const dt = CONFIG.time.fixedDt;

/** Step the objective alone until the round ends, or `seconds` pass. */
function stepObjectiveUntilEnded(h, seconds) {
  let steps = 0;
  while (h.objective.round.state === ROUND.ACTIVE && steps++ < seconds / dt) {
    h.objective.step(dt, { shade: h.shade, warden: h.warden, intent: null });
  }
}

/** Park the Shade on the spawn furthest from the Warden, out of the fight. */
function hideShade(h) {
  const far = h.map.shadeSpawns.reduce((best, spawn) => (
    spawn.position.distanceTo(h.warden.position) > best.position.distanceTo(h.warden.position) ? spawn : best
  ), h.map.shadeSpawns[0]);
  h.shade.reset(far);
}

/** The four ways a round ends, each driven the way the game ends it. */
const WAYS = [
  {
    outcome: OUTCOME.TIME, winner: 'warden', says: 'the clock ran out with no plant',
    drive: (h) => {
      h.objective.round.timeRemaining = 0.5;
      stepObjectiveUntilEnded(h, 2);
    },
  },
  {
    outcome: OUTCOME.DETONATED, winner: 'shade', says: 'the charge detonated', line: 'charge armed at a',
    drive: (h) => {
      // The Warden is on its spawn, nowhere near the charge, and only the
      // objective steps: nobody kneels on it.
      plantAt(h, 'A');
      stepObjectiveUntilEnded(h, R.detonationTime + 5);
    },
  },
  {
    outcome: OUTCOME.DEFUSED, winner: 'warden', says: 'the warden defused the charge', line: 'charge armed at b',
    drive: (h) => {
      plantAt(h, 'B');
      const at = h.objective.round.chargeAt;
      // On the charge and unable to see the Shade, as the sibling defuse
      // check stands it (Section 11 DEFEND kneels only when it cannot see you).
      h.wardenAI.sees = false;
      h.shade.position.set(at.x + 40, CONFIG.shade.standHeight / 2 + 0.05, at.z);
      h.warden.position.set(at.x, at.y + CONFIG.warden.standHeight / 2 + 0.05, at.z);
      stepObjectiveUntilEnded(h, R.defuseHoldTime + 5);
    },
  },
  {
    outcome: OUTCOME.ELIMINATED, winner: 'warden', says: `the shade lost all ${CONFIG.shade.lives} lives before planting`,
    line: 'life lost - 0 left', deathCam: true,
    drive: (h) => {
      // Every life through the real reinsert countdown, so the timeline
      // carries each death and each reinsert: more lines than the screen
      // shows, which is what proves the cap.
      for (let life = 0; life < CONFIG.shade.lives; life++) {
        h.emitter.emit('combat:death', { target: 'shade', kind: 'test' });
        let steps = 0;
        while (h.objective.round.awaitingReinsert && steps++ < (CONFIG.reinsert.delay + 2) / dt) {
          h.objective.step(dt, { shade: h.shade, warden: h.warden, intent: null });
        }
      }
    },
  },
];

/** The timeline rows the screen prints, as lower-case text. */
function printedTimeline(h) {
  return Array.from(h.scoreboard.root.querySelectorAll('ol.timeline li')).map((li) => li.textContent.trim().toLowerCase());
}

/** Click a panel button the way the player does. */
function click(root, action) {
  const button = root.querySelector(`[data-action=${action}]`);
  if (!button) throw new Error(`no [data-action=${action}] button on the panel`);
  button.click();
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-end-screen-says-who-won-and-how-each-way',
    spec: 'Sections 10.4, 10.5 and 13, amended (20.15; C4)',
    name: 'A round ended each of the four ways raises, after roundEndDelay, a screen that says who won, how, and the round\'s timeline; the fourth ends the match and the match screen says how it was won',
    run: (h) => {
      const problems = [];
      const objective = h.objective;
      const wasLength = SETTINGS.matchLength;
      const delaySteps = Math.ceil(R.roundEndDelay / dt);
      const timelines = [];
      try {
        // First to 3: the Warden's three of the four rounds below end the match.
        SETTINGS.matchLength = CONFIG.match.defaultLength;
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
        objective.resetMatch();
        objective.resetRound(1);
        if (objective.target !== 3) {
          return { pass: false, detail: `the default match length is first to ${objective.target}; this check plays four rounds for a first-to-3` };
        }

        for (let i = 0; i < WAYS.length; i++) {
          const way = WAYS[i];
          const number = i + 1;
          const label = `round ${number} (${way.outcome})`;
          if (number > 1) objective.resetRound(number);
          h.warden.reset(h.map.wardenSpawns[0]);
          hideShade(h);
          h.wardenAI.sees = false;
          h.scoreboard.hide();

          way.drive(h);
          const round = objective.round;
          if (round.state !== ROUND.ENDED) {
            problems.push(`${label}: the round did not end`);
            break;
          }
          if (round.winner !== way.winner) problems.push(`${label}: went to the ${round.winner}, want ${way.winner}`);
          if (round.outcome !== way.outcome) problems.push(`${label}: outcome "${round.outcome}"`);
          const record = objective.rounds[objective.rounds.length - 1];
          if (!record || record.outcome !== way.outcome) problems.push(`${label}: the round record carries outcome "${record && record.outcome}"`);
          if (!record || !Array.isArray(record.timeline) || record.timeline.length < 2) {
            problems.push(`${label}: the round record carries no timeline`);
          }
          const isMatchEnd = number === WAYS.length;
          if (objective.matchOver !== isMatchEnd) problems.push(`${label}: matchOver ${objective.matchOver}`);

          // The delay: nothing in the step that ended it, nothing one step
          // later, the screen once roundEndDelay has run on the sim clock.
          if (h.scoreboard.open) problems.push(`${label}: the intermission went up in the step that ended the round`);
          hideShade(h);
          h.stepFrames(1);
          if (h.scoreboard.open) problems.push(`${label}: the intermission went up one step after the end`);
          if (way.deathCam && h.cameraOwner !== 'deathcam') {
            problems.push(`${label}: the death camera is not on the killer during the delay (owner ${h.cameraOwner})`);
          }
          h.stepFrames(delaySteps);
          if (!h.scoreboard.open) {
            problems.push(`${label}: no intermission ${R.roundEndDelay}s after the end`);
            continue;
          }
          if (h.cameraOwner === 'deathcam') problems.push(`${label}: the intermission left the death camera up`);

          // Who won, and how.
          const text = h.scoreboard.root.textContent.replace(/\s+/g, ' ').toLowerCase();
          const heading = isMatchEnd ? `${way.winner} wins the match` : `round ${number} to the ${way.winner}`;
          if (text.indexOf(heading) === -1) problems.push(`${label}: the screen does not say "${heading}"`);
          if (!isMatchEnd && text.indexOf(way.says) === -1) problems.push(`${label}: the screen does not say "${way.says}"`);
          if (text.indexOf(`${objective.score.shade} – ${objective.score.warden}`) === -1) {
            problems.push(`${label}: the score ${objective.score.shade}-${objective.score.warden} is not on the screen`);
          }

          // The timeline: the round begins, the end, what happened between,
          // and never more than the cap.
          const lines = printedTimeline(h);
          const want = Math.min(TIMELINE_LINES, record ? record.timeline.length : 0);
          timelines.push(lines.length);
          if (lines.length !== want) problems.push(`${label}: ${lines.length} timeline lines printed, want ${want}`);
          if (!lines.length || lines[0].indexOf(`round ${number} begins`) === -1) problems.push(`${label}: the timeline does not start with the round beginning`);
          if (!lines.length || lines[lines.length - 1].indexOf(round.reason) === -1) {
            problems.push(`${label}: the timeline does not end with "${round.reason}"`);
          }
          if (way.line && !lines.some((line) => line.indexOf(way.line) !== -1)) {
            problems.push(`${label}: the timeline has no "${way.line}" line`);
          }
          if (lines.some((line) => !/^\d+:\d\d /.test(line))) problems.push(`${label}: a timeline line has no clock`);

          // The table says how, per round.
          const cells = Array.from(h.scoreboard.root.querySelectorAll('tbody tr:last-child td')).map((td) => td.textContent.trim().toLowerCase());
          if (cells.length < 3 || cells[0] !== String(number) || cells[1] !== way.winner) {
            problems.push(`${label}: the last table row reads ${JSON.stringify(cells)}`);
          }

          if (isMatchEnd) {
            // First to 3 by the clock, a defuse and the third life.
            for (const word of ['1 clock', '1 defused', '1 eliminated']) {
              if (text.indexOf(word) === -1) problems.push(`the match screen does not tally "${word}"`);
            }
            if (!h.scoreboard.root.querySelector('[data-action=next]') || text.indexOf('main menu') === -1) {
              problems.push('the match screen has no Main menu button');
            }
          }
        }
      } finally {
        SETTINGS.matchLength = wasLength;
        h.scoreboard.hide();
        h.menu.hide();
        h.briefing.hide();
        h.input.clearAll();
        h.debugState.godMode = false;
        objective.resetMatch();
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      }
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `four rounds, ended on the clock, by detonation, by defuse and by the third life; each screen up ${R.roundEndDelay}s `
            + `after the end and not before, naming the winner and the way, timelines of ${timelines.join('/')} lines `
            + `(cap ${TIMELINE_LINES}); the fourth ended the match 3-1 and the match screen tallied how`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'play-from-the-main-menu-starts-a-fresh-match',
    spec: 'Section 13 (C4)',
    name: 'Play resets the score and the round records itself, whatever route brought the main menu up',
    run: (h) => {
      const problems = [];
      const objective = h.objective;
      const was = SETTINGS.briefing;
      try {
        SETTINGS.briefing = false;
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
        objective.resetMatch();
        objective.resetRound(1);
        // A round on the books, then the main menu raised without going
        // through any button that resets the match.
        objective.round.timeRemaining = 0.5;
        stepObjectiveUntilEnded(h, 2);
        if (objective.score.warden !== 1 || objective.rounds.length !== 1) {
          return { pass: false, detail: `could not put a round on the books (score ${objective.score.shade}-${objective.score.warden})` };
        }
        objective.resetRound(2);
        h.menu.show('main');
        click(h.menu.root, 'play');
        if (objective.score.shade !== 0 || objective.score.warden !== 0) {
          problems.push(`Play kept the score at ${objective.score.shade}-${objective.score.warden}`);
        }
        if (objective.rounds.length !== 0) problems.push(`Play kept ${objective.rounds.length} round records`);
        if (objective.round.number !== 1) problems.push(`Play started round ${objective.round.number}`);
        if (objective.round.charge !== CHARGE.CARRIED) problems.push(`Play started with the charge ${objective.round.charge}`);
        if (objective.matchOver) problems.push('Play started with the match over');
      } finally {
        SETTINGS.briefing = was;
        h.menu.hide();
        h.briefing.hide();
        h.scoreboard.hide();
        h.input.clearAll();
        objective.resetMatch();
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      }
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? 'a round on the books and round 2 under way; Play from the main menu: 0-0, no records, round 1, the charge carried'
          : problems.join('; '),
      };
    },
  });
}
