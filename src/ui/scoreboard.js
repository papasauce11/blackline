/**
 * BLACKLINE — ui/scoreboard.js
 *
 * The round intermission and the match end screen (Section 10.5, Section 13).
 * Since C4 each says who won and how - one of the four outcomes of Section
 * 10.4 as a sentence - and prints the round's timeline, five lines of it,
 * from the objective's own record of what happened.
 *
 * Layering (Section 3.1): imports config only. It is handed the round records
 * the objective system built and renders them; it computes nothing about the
 * match, so it cannot disagree with the score that decided it.
 */

import { CONFIG, SETTINGS } from '../config.js';

const P = CONFIG.palette;
const hex = (value) => `#${value.toString(16).padStart(6, '0')}`;

const CSS = `
#bl-scoreboard {
  position: fixed; inset: 0; z-index: 35; display: none; align-items: center;
  justify-content: center; background: rgba(10,13,16,0.92);
  font: 12px/1.7 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: ${hex(P.shadeTeal)}; letter-spacing: 0.1em; text-transform: uppercase;
}
#bl-scoreboard.open { display: flex; }
#bl-scoreboard .card { min-width: 460px; }
#bl-scoreboard h1 { font-size: 22px; letter-spacing: 0.3em; margin: 0 0 2px; }
#bl-scoreboard .sub { opacity: 0.55; font-size: 11px; margin-bottom: 22px; }
#bl-scoreboard .big { font-size: 34px; letter-spacing: 0.2em; margin: 6px 0 22px; }
#bl-scoreboard .how { font-size: 13px; margin-bottom: 18px; }
#bl-scoreboard .how.warden { color: ${hex(P.wardenOrange)}; }
#bl-scoreboard ol.timeline { list-style: none; margin: 0 0 22px; padding: 0; opacity: 0.8; }
#bl-scoreboard ol.timeline li { padding: 2px 0; }
#bl-scoreboard ol.timeline .t { display: inline-block; width: 4.5em; opacity: 0.55; }
#bl-scoreboard table { width: 100%; border-collapse: collapse; }
#bl-scoreboard th { text-align: left; opacity: 0.45; font-weight: normal; padding-bottom: 6px; }
#bl-scoreboard td { padding: 5px 0; border-top: 1px solid rgba(47,214,195,0.14); }
#bl-scoreboard td.shade { color: ${hex(P.shadeTeal)}; }
#bl-scoreboard td.warden { color: ${hex(P.wardenOrange)}; }
#bl-scoreboard button {
  margin-top: 24px; padding: 11px 18px; cursor: pointer; background: transparent;
  color: inherit; font: inherit; letter-spacing: 0.14em; text-transform: uppercase;
  border: 1px solid rgba(47,214,195,0.35);
}
#bl-scoreboard button:hover { background: rgba(47,214,195,0.12); }
`;

const clock = (seconds) => {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

/** The intermission shows this many lines of the round's timeline (C4). */
export const TIMELINE_LINES = 5;

/** Section 10.4's four outcomes, as a sentence for the screen and a word for the table. */
const OUTCOMES = {
  detonated: { says: 'the charge detonated', word: 'detonated' },
  defused: { says: 'the Warden defused the charge', word: 'defused' },
  eliminated: { says: `the Shade lost all ${CONFIG.shade.lives} lives before planting`, word: 'eliminated' },
  time: { says: 'the clock ran out with no plant', word: 'clock' },
};

/**
 * How a round ended, in a sentence. An outcome the table does not know (a
 * check ending a round by hand) falls back to the reason the record keeps.
 * @param {string|null} outcome one of `OUTCOME` in systems/objective.js
 * @param {string} [reason]
 */
export function sayOutcome(outcome, reason) {
  return OUTCOMES[outcome] ? OUTCOMES[outcome].says : (reason || '');
}

const outcomeWord = (round) => (OUTCOMES[round.outcome] ? OUTCOMES[round.outcome].word : (round.reason || '&mdash;'));

/**
 * The lines the screen prints of a timeline: all of it up to TIMELINE_LINES,
 * else the first line (the round begins) and the last four, so the end and
 * what led to it are always there.
 */
export function timelineLines(timeline) {
  const lines = timeline || [];
  if (lines.length <= TIMELINE_LINES) return lines;
  return [lines[0]].concat(lines.slice(lines.length - (TIMELINE_LINES - 1)));
}

/** How the match was won: `2 defused, 1 clock`, from the winner's rounds. */
function matchHow(rounds, winner) {
  const counts = new Map();
  for (const round of rounds) {
    if (round.winner !== winner) continue;
    const word = outcomeWord(round);
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return Array.from(counts, ([word, n]) => `${n} ${word}`).join(', ');
}

export class Scoreboard {
  constructor(handlers) {
    this.handlers = handlers || {};
    this.style = document.createElement('style');
    this.style.textContent = CSS;
    document.head.appendChild(this.style);

    this.root = document.createElement('div');
    this.root.id = 'bl-scoreboard';
    document.body.appendChild(this.root);
  }

  dispose() {
    this.root.remove();
    this.style.remove();
  }

  get open() {
    return this.root.classList.contains('open');
  }

  hide() {
    this.root.classList.remove('open');
  }

  /**
   * Section 10.5: round number, winner, duration, takedowns, plant site used.
   * @param {object} state
   * @param {object[]} state.rounds records from the objective system
   * @param {{shade:number,warden:number}} state.score
   * @param {boolean} state.matchOver
   */
  show(state) {
    const rounds = state.rounds || [];
    const last = rounds[rounds.length - 1];
    // The live setting, not the CONFIG default: "first to N" has to agree with
    // the target the objective system is actually counting to.
    const target = CONFIG.match.lengths[SETTINGS.matchLength]
      || CONFIG.match.lengths[CONFIG.match.defaultLength];

    // Who won and how (C4): the round's, or the match's with a tally of how
    // the winner took its rounds. The last round's timeline goes under both -
    // the match end is also the end of a round.
    const matchWinner = state.score.shade > state.score.warden ? 'shade' : 'warden';
    const winner = state.matchOver ? matchWinner : (last ? last.winner : '');
    const heading = state.matchOver
      ? `${matchWinner} wins the match`
      : `round ${last ? last.number : ''} to the ${winner}`;
    const how = state.matchOver
      ? matchHow(rounds, matchWinner)
      : (last ? sayOutcome(last.outcome, last.reason) : '');

    this.root.innerHTML = `
      <div class="card">
        <h1>${state.matchOver ? 'Match' : 'Intermission'}</h1>
        <div class="sub">first to ${target}</div>
        <div class="big">${state.score.shade} &ndash; ${state.score.warden}</div>
        <div class="how ${winner}">${heading}${how ? ` &middot; ${how}` : ''}</div>
        <ol class="timeline">
          ${timelineLines(last && last.timeline).map((line) => `
            <li><span class="t">${clock(line.t)}</span> ${line.text}</li>`).join('')}
        </ol>
        <table>
          <thead><tr><th>rd</th><th>winner</th><th>how</th><th>time</th><th>takedowns</th><th>site</th><th>lives</th></tr></thead>
          <tbody>
            ${rounds.map((round) => `
              <tr>
                <td>${round.number}</td>
                <td class="${round.winner}">${round.winner}</td>
                <td>${outcomeWord(round)}</td>
                <td>${clock(round.duration)}</td>
                <td>${round.takedowns}</td>
                <td>${round.site || '&mdash;'}</td>
                <td>${round.livesLeft}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        <button data-action="next">${state.matchOver ? 'Main menu' : 'Next round'}</button>
      </div>`;

    this.root.querySelector('[data-action=next]').onclick = () => {
      this.hide();
      if (state.matchOver) {
        if (this.handlers.onMenu) this.handlers.onMenu();
      } else if (this.handlers.onNextRound) {
        this.handlers.onNextRound();
      }
    };
    this.root.classList.add('open');
  }
}

export function createScoreboard(handlers) {
  return new Scoreboard(handlers);
}
