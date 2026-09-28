/**
 * BLACKLINE — ui/tutorial.js
 *
 * The first-run tutorial's one line on screen (H6): which move is being asked
 * for, how far through the chain it is, and the way out.
 *
 * It is one line on purpose. The briefing (C2) is the card that explains the
 * round and the menu's *How to play* (H5) is the page that lists everything;
 * this is neither. A tutorial that put a paragraph in front of a player
 * learning to walk would be read once and never again, and the thing being
 * taught is in the hands.
 *
 * Layering (Section 3.1): imports config only. It is handed the step and the
 * key labels and draws them; what counts as done is `systems/tutorial.js`.
 */

import { CONFIG } from '../config.js';

const P = CONFIG.palette;
const hex = (value) => `#${value.toString(16).padStart(6, '0')}`;

const CSS = `
#bl-tutorial {
  position: fixed; left: 50%; bottom: 14%; transform: translateX(-50%);
  z-index: 25; display: none; text-align: center; pointer-events: none;
  font: 13px/1.7 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: ${hex(P.shadeTeal)}; letter-spacing: 0.1em;
  text-shadow: 0 1px 3px rgba(0,0,0,0.85);
}
#bl-tutorial.open { display: block; }
#bl-tutorial .count { font-size: 10px; letter-spacing: 0.24em; opacity: 0.5; text-transform: uppercase; }
#bl-tutorial .text { margin-top: 3px; }
#bl-tutorial .text b { font-weight: normal; color: ${hex(P.hazardOrange)}; }
#bl-tutorial .skip {
  margin-top: 10px; padding: 6px 14px; pointer-events: auto; cursor: pointer;
  background: transparent; color: inherit; font: inherit; font-size: 10px;
  letter-spacing: 0.2em; text-transform: uppercase; opacity: 0.55;
  border: 1px solid rgba(47,214,195,0.3);
}
#bl-tutorial .skip:hover { opacity: 1; border-color: ${hex(P.shadeTeal)}; }
`;

export class Tutorial {
  /**
   * @param {object} handlers
   * @param {() => void} [handlers.onSkip] what the Skip button does
   */
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.style = document.createElement('style');
    this.style.textContent = CSS;
    document.head.appendChild(this.style);

    this.root = document.createElement('div');
    this.root.id = 'bl-tutorial';
    this.root.innerHTML = `
      <div class="count" id="bl-tutorial-count"></div>
      <div class="text" id="bl-tutorial-text"></div>
      <button class="skip" id="bl-tutorial-skip">Skip the tutorial</button>`;
    document.body.appendChild(this.root);

    this.root.querySelector('#bl-tutorial-skip').onclick = () => {
      if (this.handlers.onSkip) this.handlers.onSkip();
    };

    this.el = {
      count: this.root.querySelector('#bl-tutorial-count'),
      text: this.root.querySelector('#bl-tutorial-text'),
      skip: this.root.querySelector('#bl-tutorial-skip'),
    };
  }

  dispose() {
    this.root.remove();
    this.style.remove();
  }

  get open() {
    return this.root.classList.contains('open');
  }

  /**
   * Put a prompt up. The keys are wrapped so what to press reads out of the
   * sentence at a glance.
   *
   * @param {{text: string, index: number, of: number}} step
   */
  show({ text, index, of }) {
    this.el.count.textContent = `${index + 1} of ${of}`;
    this.el.text.innerHTML = String(text).replace(/\[([^\]]+)\]/g, '<b>$1</b>');
    this.root.classList.add('open');
  }

  /**
   * Take it down. There is no closing line and no pause on one, because there
   * is no timer to hold one up with - Section 9 and 15 ban `setTimeout` and
   * F13's check holds the ban. What follows a finished tutorial is the round
   * briefing (C2), which holds until a key, so the player gets the beat there.
   */
  hide() {
    this.root.classList.remove('open');
  }
}

export function createTutorialPanel(handlers) {
  return new Tutorial(handlers);
}
