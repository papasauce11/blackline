/**
 * BLACKLINE — ui/menu.js
 *
 * Main menu and settings (Section 13). Flat, high contrast, faction accents.
 *
 * Layering (Section 3.1): ui may import from config. The menu never starts a
 * match itself — it calls back into the composition root, so `initMatch` stays
 * the single entry point Section 12 requires and free-roam remains a
 * configuration rather than a second path.
 *
 * **Audio gate.** Section 13 and the risk register: the Play button is the
 * first user gesture, and the AudioContext is created there. Nothing attempts
 * to create or resume audio before that click.
 */

import { CONFIG, SETTINGS } from '../config.js';

const P = CONFIG.palette;
const hex = (value) => `#${value.toString(16).padStart(6, '0')}`;

const CSS = `
#bl-menu {
  position: fixed; inset: 0; z-index: 40; display: flex; align-items: center;
  justify-content: center; background: rgba(10,13,16,0.94);
  font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: ${hex(P.shadeTeal)}; letter-spacing: 0.1em; text-transform: uppercase;
}
#bl-menu.hidden { display: none; }
#bl-menu .card { min-width: 340px; }
#bl-menu h1 { font-size: 30px; letter-spacing: 0.42em; margin: 0 0 4px; }
#bl-menu .tag { opacity: 0.5; font-size: 11px; margin-bottom: 28px; letter-spacing: 0.2em; }
#bl-menu button {
  display: block; width: 100%; margin: 0 0 8px; padding: 12px 16px; cursor: pointer;
  background: transparent; color: inherit; font: inherit; letter-spacing: 0.14em;
  text-transform: uppercase; text-align: left;
  border: 1px solid rgba(47,214,195,0.35);
}
#bl-menu button:hover { background: rgba(47,214,195,0.12); border-color: ${hex(P.shadeTeal)}; }
#bl-menu .row { display: flex; justify-content: space-between; align-items: center;
  padding: 9px 0; border-bottom: 1px solid rgba(47,214,195,0.14); }
#bl-menu .row span { opacity: 0.7; }
#bl-menu .row .value { opacity: 1; color: ${hex(P.hazardOrange)}; cursor: pointer; }
#bl-menu input[type=range] { width: 150px; accent-color: ${hex(P.shadeTeal)}; }
#bl-menu .back { margin-top: 20px; opacity: 0.6; }
`;

export class Menu {
  /**
   * @param {object} handlers
   * @param {(config:object)=>void} handlers.onPlay
   * @param {()=>void} handlers.onFreeRoam
   * @param {()=>void} [handlers.onFirstGesture] the audio gate
   */
  constructor(handlers) {
    this.handlers = handlers || {};
    this.gestureFired = false;

    this.style = document.createElement('style');
    this.style.textContent = CSS;
    document.head.appendChild(this.style);

    this.root = document.createElement('div');
    this.root.id = 'bl-menu';
    document.body.appendChild(this.root);

    this.page = 'main';
    this.render();
  }

  dispose() {
    this.root.remove();
    this.style.remove();
  }

  get open() {
    return !this.root.classList.contains('hidden');
  }

  show(page) {
    this.page = page || 'main';
    this.root.classList.remove('hidden');
    this.render();
  }

  hide() {
    this.root.classList.add('hidden');
  }

  /**
   * Every route out of the menu passes through here, so the audio gate cannot
   * be bypassed by adding a new button later.
   */
  _gesture() {
    if (this.gestureFired) return;
    this.gestureFired = true;
    if (this.handlers.onFirstGesture) this.handlers.onFirstGesture();
  }

  render() {
    if (this.page === 'settings') return this._renderSettings();
    if (this.page === 'pause') return this._renderPause();
    this._renderMain();
  }

  /**
   * The pause overlay. Deliberately the same surface as the main menu rather
   * than a second one: the settings page has to be reachable from both, and a
   * duplicated overlay is how the two drift apart.
   *
   * Settings returns here, not to the main menu, so adjusting sensitivity
   * mid-match does not abandon the match.
   */
  _renderPause() {
    this.root.innerHTML = `
      <div class="card">
        <h1 style="font-size:20px">Paused</h1>
        <div class="tag">the round is stopped</div>
        <button data-action="resume">Resume</button>
        <button data-action="settings">Settings</button>
        <button data-action="quit">Main menu</button>
      </div>`;
    this.root.querySelector('[data-action=resume]').onclick = () => {
      this.hide();
      if (this.handlers.onResume) this.handlers.onResume();
    };
    this.root.querySelector('[data-action=settings]').onclick = () => {
      this._settingsReturn = 'pause';
      this.show('settings');
    };
    this.root.querySelector('[data-action=quit]').onclick = () => {
      this.show('main');
      if (this.handlers.onQuit) this.handlers.onQuit();
    };
  }

  _renderMain() {
    this.root.innerHTML = `
      <div class="card">
        <h1>Blackline</h1>
        <div class="tag">meridian substation</div>
        <button data-action="play">Play</button>
        <button data-action="freeroam">Free Roam</button>
        <button data-action="settings">Settings</button>
      </div>`;
    this.root.querySelector('[data-action=play]').onclick = () => {
      this._gesture();
      this.hide();
      if (this.handlers.onPlay) this.handlers.onPlay();
    };
    this.root.querySelector('[data-action=freeroam]').onclick = () => {
      this._gesture();
      this.hide();
      if (this.handlers.onFreeRoam) this.handlers.onFreeRoam();
    };
    this.root.querySelector('[data-action=settings]').onclick = () => {
      this._settingsReturn = 'main';
      this.show('settings');
    };
  }

  _renderSettings() {
    const lengths = Object.keys(CONFIG.match.lengths);
    this.root.innerHTML = `
      <div class="card">
        <h1 style="font-size:20px">Settings</h1>
        <div class="tag"></div>
        <div class="row"><span>mouse sensitivity</span>
          <input type="range" id="bl-sens" min="${CONFIG.settings.mouseSensitivityMin}"
            max="${CONFIG.settings.mouseSensitivityMax}" step="0.0002" value="${SETTINGS.mouseSensitivity}"></div>
        <div class="row"><span>master volume</span>
          <input type="range" id="bl-vol" min="0" max="1" step="0.05" value="${SETTINGS.masterVolume}"></div>
        <div class="row"><span>match length</span>
          <span class="value" id="bl-len">best of ${SETTINGS.matchLength}</span></div>
        <div class="row"><span>difficulty</span>
          <span class="value" id="bl-diff">${SETTINGS.difficulty}</span></div>
        <div class="row"><span>invert Y</span>
          <span class="value" id="bl-inv">${SETTINGS.invertY ? 'on' : 'off'}</span></div>
        <button class="back" data-action="back">Back</button>
      </div>`;

    const sens = this.root.querySelector('#bl-sens');
    sens.oninput = () => { SETTINGS.mouseSensitivity = parseFloat(sens.value); };
    const vol = this.root.querySelector('#bl-vol');
    vol.oninput = () => {
      SETTINGS.masterVolume = parseFloat(vol.value);
      if (this.handlers.onVolume) this.handlers.onVolume(SETTINGS.masterVolume);
    };
    const len = this.root.querySelector('#bl-len');
    len.onclick = () => {
      const index = lengths.indexOf(String(SETTINGS.matchLength));
      SETTINGS.matchLength = Number(lengths[(index + 1) % lengths.length]);
      len.textContent = `best of ${SETTINGS.matchLength}`;
    };
    const diff = this.root.querySelector('#bl-diff');
    // The AI re-reads SETTINGS.difficulty on every reset(), so a change here
    // takes effect at the next match rather than mid-round.
    const names = Object.keys(CONFIG.ai.difficulty);
    diff.onclick = () => {
      SETTINGS.difficulty = names[(names.indexOf(SETTINGS.difficulty) + 1) % names.length];
      diff.textContent = SETTINGS.difficulty;
    };
    const inv = this.root.querySelector('#bl-inv');
    inv.onclick = () => {
      SETTINGS.invertY = !SETTINGS.invertY;
      inv.textContent = SETTINGS.invertY ? 'on' : 'off';
    };
    this.root.querySelector('[data-action=back]').onclick = () => this.show(this._settingsReturn || 'main');
  }
}

export function createMenu(handlers) {
  return new Menu(handlers);
}
