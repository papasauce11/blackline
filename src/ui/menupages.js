/**
 * BLACKLINE — ui/menupages.js
 *
 * Every menu page that is not the main one: pause, settings, how to play and
 * credits (H5). Installed on `Menu.prototype` at the bottom of `menu.js`, the
 * prototype-mixin idiom F3 split the big classes with - `this` is the same
 * object, every private field keeps its name, and a check reaching
 * `menu._renderSettings` still finds it.
 *
 * Each `_render*` ends by declaring its focusable rows through `this._rows()`,
 * so a page cannot be added with a row the keyboard cannot reach: the check
 * `every-main-menu-row-is-reachable-and-actionable-from-the-keyboard` counts
 * the controls the page drew and requires the same number to be reachable.
 *
 * Layering (Section 3.1): config and its sibling in `ui/`. Nothing here
 * imports main.js.
 */

import { CONFIG, DEFAULT_BINDINGS, SETTINGS } from '../config.js';
import { controlRows, objectiveLine } from './briefing.js';

/** What the how-to-play page describes: the two roles, as the game has them. */
const HOW_TO_ROLES = [
  { role: 'shade', mode: 'competitive', objectiveEnabled: true, title: 'As the Shade' },
  { role: 'warden', mode: 'freeroam', objectiveEnabled: false, title: 'As the Warden' },
];

export const MENU_PAGES = {
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
    const resume = this.root.querySelector('[data-action=resume]');
    resume.onclick = () => {
      this.hide();
      if (this.handlers.onResume) this.handlers.onResume();
    };
    const settings = this.root.querySelector('[data-action=settings]');
    settings.onclick = () => {
      this._settingsReturn = 'pause';
      this.show('settings');
    };
    const quit = this.root.querySelector('[data-action=quit]');
    quit.onclick = () => {
      this.show('main');
      if (this.handlers.onQuit) this.handlers.onQuit();
    };
    this._rows([resume, settings, quit]);
  },

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
        <div class="row"><span>round briefing</span>
          <span class="value" id="bl-brief">${SETTINGS.briefing ? 'on' : 'off'}</span></div>
        <div class="row"><span>post-processing</span>
          <span class="value" id="bl-post">${SETTINGS.post ? 'on' : 'off'}</span></div>
        <div class="row"><span>debug tooling</span>
          <span class="value" id="bl-dbg">${SETTINGS.debug ? 'on' : 'off'}</span></div>
        <div class="row"><span>settings</span>
          <span class="value" id="bl-reset">reset to defaults</span></div>
        <button class="back" data-action="back">Back</button>
      </div>`;

    const sens = this.root.querySelector('#bl-sens');
    sens.oninput = () => { SETTINGS.mouseSensitivity = parseFloat(sens.value); this._changed(); };
    const vol = this.root.querySelector('#bl-vol');
    vol.oninput = () => {
      SETTINGS.masterVolume = parseFloat(vol.value);
      if (this.handlers.onVolume) this.handlers.onVolume(SETTINGS.masterVolume);
      this._changed();
    };
    const len = this.root.querySelector('#bl-len');
    len.onclick = () => {
      const index = lengths.indexOf(String(SETTINGS.matchLength));
      SETTINGS.matchLength = Number(lengths[(index + 1) % lengths.length]);
      len.textContent = `best of ${SETTINGS.matchLength}`;
      this._changed();
    };
    const diff = this.root.querySelector('#bl-diff');
    // The AI re-reads SETTINGS.difficulty on every reset(), so a change here
    // takes effect at the next match rather than mid-round.
    const names = Object.keys(CONFIG.ai.difficulty);
    diff.onclick = () => {
      SETTINGS.difficulty = names[(names.indexOf(SETTINGS.difficulty) + 1) % names.length];
      diff.textContent = SETTINGS.difficulty;
      this._changed();
    };
    const inv = this.root.querySelector('#bl-inv');
    inv.onclick = () => {
      SETTINGS.invertY = !SETTINGS.invertY;
      inv.textContent = SETTINGS.invertY ? 'on' : 'off';
      this._changed();
    };
    // C2: the round-start briefing and controls card. Off, Play and Next
    // round start the round on the click.
    const brief = this.root.querySelector('#bl-brief');
    brief.onclick = () => {
      SETTINGS.briefing = !SETTINGS.briefing;
      brief.textContent = SETTINGS.briefing ? 'on' : 'off';
      this._changed();
    };
    // E6: the bloom and the vignette, live; off is the scene as drawn.
    const postRow = this.root.querySelector('#bl-post');
    postRow.onclick = () => {
      SETTINGS.post = !SETTINGS.post;
      postRow.textContent = SETTINGS.post ? 'on' : 'off';
      this._changed();
    };
    // Section 17.1, amended (C1): the debug gate, off by default. On, F3
    // and F4 work; off, they and every test key are inert, and a frame
    // takes any open panel down.
    const dbg = this.root.querySelector('#bl-dbg');
    dbg.onclick = () => {
      SETTINGS.debug = !SETTINGS.debug;
      dbg.textContent = SETTINGS.debug ? 'on' : 'off';
      // Deliberately no `_changed()`: the debug gate is the one setting H7
      // does not keep across a reload (`NOT_PERSISTED`, settingsstore.js).
    };
    // H7: back to what the game shipped with, and forget what was stored -
    // the record is cleared rather than written full of defaults, so a build
    // that later changes one gives it to whoever asked for the defaults.
    const reset = this.root.querySelector('#bl-reset');
    reset.onclick = () => {
      const wasDebug = SETTINGS.debug;
      if (this.handlers.onResetSettings) this.handlers.onResetSettings();
      // The debug gate belongs to this page load, not to the store, so a
      // reset of the *stored* settings does not close the tooling under a
      // session that opened it with `?debug=1`.
      SETTINGS.debug = wasDebug;
      if (this.handlers.onVolume) this.handlers.onVolume(SETTINGS.masterVolume);
      this.render();
    };

    const back = this.root.querySelector('[data-action=back]');
    back.onclick = () => this.show(this._settingsReturn || 'main');
    // The two sliders answer the left and right keys with a step of their own,
    // so a keyboard can set sensitivity and volume without a mouse (H5).
    this._rows([
      this._slider(sens, () => { SETTINGS.mouseSensitivity = parseFloat(sens.value); }),
      this._slider(vol, () => {
        SETTINGS.masterVolume = parseFloat(vol.value);
        if (this.handlers.onVolume) this.handlers.onVolume(SETTINGS.masterVolume);
      }),
      len, diff, inv, brief, postRow, dbg, reset, back,
    ]);
  },

  /**
   * How to play (H5). The objective and the controls are read from
   * `ui/briefing.js` and the live bindings, never retyped: the briefing card
   * C2 puts up at round start and this page are the same sentences, so a
   * rebind (H8) moves both and neither can go stale against the other.
   */
  _renderHowTo() {
    // The live bindings when the root has wired them, the defaults otherwise:
    // this page is reachable before a match exists.
    const bindings = (this.handlers.bindings && this.handlers.bindings()) || DEFAULT_BINDINGS;
    const sections = HOW_TO_ROLES.map((role) => {
      const rows = controlRows(role, bindings).map(
        ([key, does]) => `<tr><td class="key">${key}</td><td class="does">${does}</td></tr>`
      ).join('');
      return `<h2 style="font-size:13px;letter-spacing:0.24em;margin:18px 0 6px">${role.title}</h2>
        <div class="prose"><p>${objectiveLine(role, bindings)}</p></div>
        <table>${rows}</table>`;
    }).join('');

    this.root.innerHTML = `
      <div class="card">
        <h1 style="font-size:20px">How to play</h1>
        <div class="tag">one hides, one hunts</div>
        <div class="prose">
          <p>Blackline is an asymmetric round: the Shade has to plant a charge in one of
          the site rooms and keep the Warden off it; the Warden has to find the Shade, or
          get to the charge and defuse it. The Shade climbs anything within reach of a
          standing jump and the Warden never leaves the ground. That asymmetry is the game.</p>
          <p>There are no markings telling you what can be climbed. A ledge you could
          reasonably pull yourself onto is one you can: tap jump at a high one to hang from
          it, hold jump to go straight over.</p>
        </div>
        ${sections}
        <button class="back" data-action="back">Back</button>
      </div>`;
    const back = this.root.querySelector('[data-action=back]');
    back.onclick = () => this.show('main');
    this._rows([back]);
  },

  /**
   * Credits (H5). Short and true: everything in this game is generated in
   * code - the geometry, the figures, the textures, every sound - so the list
   * of things to credit is the one library it draws with.
   */
  _renderCredits() {
    this.root.innerHTML = `
      <div class="card">
        <h1 style="font-size:20px">Credits</h1>
        <div class="tag">blackline</div>
        <div class="prose">
          <p>An original game. The levels, the figures, the materials, the animation and
          every sound are generated in code at load time &mdash; there are no art or audio
          files in this project, which is also why the cards on the main menu are rendered
          from the maps themselves rather than loaded from a picture.</p>
          <p>Drawn with three.js, pinned to exactly one release in <code>index.html</code>.
          Nothing else is fetched: <code>no-network-beyond-the-three-cdn</code> holds that,
          and these cards are data URLs, so they are not an exception to it.</p>
        </div>
        <div class="row"><span>build</span><span class="value" id="bl-credits-version">${this._version()}</span></div>
        <button class="back" data-action="back">Back</button>
      </div>`;
    const back = this.root.querySelector('[data-action=back]');
    back.onclick = () => this.show('main');
    this._rows([back]);
  },
};

