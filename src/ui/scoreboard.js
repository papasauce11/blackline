/**
 * BLACKLINE — ui/scoreboard.js
 *
 * The round intermission and the match end screen (Section 10.5, Section 13).
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

    const heading = state.matchOver
      ? `${state.score.shade > state.score.warden ? 'Shade' : 'Warden'} wins the match`
      : `Round ${last ? last.number : ''} to the ${last ? last.winner : ''}`;

    this.root.innerHTML = `
      <div class="card">
        <h1>${state.matchOver ? 'Match' : 'Intermission'}</h1>
        <div class="sub">${last ? last.reason : ''}</div>
        <div class="big">${state.score.shade} &ndash; ${state.score.warden}</div>
        <div class="sub">${heading} &middot; first to ${target}</div>
        <table>
          <thead><tr><th>rd</th><th>winner</th><th>time</th><th>takedowns</th><th>site</th><th>lives</th></tr></thead>
          <tbody>
            ${rounds.map((round) => `
              <tr>
                <td>${round.number}</td>
                <td class="${round.winner}">${round.winner}</td>
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
