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
import { controlRows, keyLabel, objectiveLine } from './briefing.js';

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
        <div class="row"><span>look sensitivity, turn</span>
          <input type="range" id="bl-sens" min="${CONFIG.settings.mouseSensitivityMin}"
            max="${CONFIG.settings.mouseSensitivityMax}" step="0.0002" value="${SETTINGS.mouseSensitivity}"></div>
        <div class="row"><span>look sensitivity, pitch</span>
          <input type="range" id="bl-sensy" min="${CONFIG.settings.mouseSensitivityMin}"
            max="${CONFIG.settings.mouseSensitivityMax}" step="0.0002" value="${SETTINGS.mouseSensitivityY}"></div>
        <div class="row"><span>field of view, shade</span>
          <input type="range" id="bl-fov-shade" min="${CONFIG.settings.fovMin}"
            max="${CONFIG.settings.fovMax}" step="1" value="${SETTINGS.fovShade}"></div>
        <div class="row"><span>field of view, warden</span>
          <input type="range" id="bl-fov-warden" min="${CONFIG.settings.fovMin}"
            max="${CONFIG.settings.fovMax}" step="1" value="${SETTINGS.fovWarden}"></div>
        <div class="row"><span>head-bob</span>
          <span class="value" id="bl-bob">${SETTINGS.headBob ? 'on' : 'off'}</span></div>
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
        <button data-action="controls">Controls</button>
        <button class="back" data-action="back">Back</button>
      </div>`;

    // H9: look and camera. Sensitivity is per axis, the field of view is per
    // role because the two are different pictures, and the head-bob is a
    // switch. Every one of them takes effect on the next frame the camera is
    // drawn - `cameraOwner.applyFov()` asserts the FOV every frame and
    // `lookDelta` reads the live sensitivity - so a player adjusting these
    // from the pause menu sees the result the moment they resume.
    const sens = this.root.querySelector('#bl-sens');
    sens.oninput = () => { SETTINGS.mouseSensitivity = parseFloat(sens.value); this._changed(); };
    const sensY = this.root.querySelector('#bl-sensy');
    sensY.oninput = () => { SETTINGS.mouseSensitivityY = parseFloat(sensY.value); this._changed(); };
    const fovShade = this.root.querySelector('#bl-fov-shade');
    fovShade.oninput = () => { SETTINGS.fovShade = parseFloat(fovShade.value); this._changed(); };
    const fovWarden = this.root.querySelector('#bl-fov-warden');
    fovWarden.oninput = () => { SETTINGS.fovWarden = parseFloat(fovWarden.value); this._changed(); };
    const bob = this.root.querySelector('#bl-bob');
    bob.onclick = () => {
      SETTINGS.headBob = !SETTINGS.headBob;
      bob.textContent = SETTINGS.headBob ? 'on' : 'off';
      this._changed();
    };
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

    // H8: rebinding is a page of its own - seventeen actions do not fit
    // beside eight settings - and it returns here rather than to the main
    // menu, so a rebind mid-match does not abandon the match either.
    const controls = this.root.querySelector('[data-action=controls]');
    controls.onclick = () => this.show('controls');
    const back = this.root.querySelector('[data-action=back]');
    back.onclick = () => this.show(this._settingsReturn || 'main');
    // Every slider answers the left and right keys with a step of its own, so
    // a keyboard can set sensitivity, the field of view and volume without a
    // mouse (H5). Both paths end at `_changed()`, or a keyboard-only player's
    // slider is the one setting a reload forgets (H7) - which is exactly the
    // gap `every-settings-row-that-moves-a-setting-reports-it-for-saving`
    // found in the two H5 shipped with, and it holds these four too.
    this._rows([
      this._slider(sens, () => { SETTINGS.mouseSensitivity = parseFloat(sens.value); this._changed(); }),
      this._slider(sensY, () => { SETTINGS.mouseSensitivityY = parseFloat(sensY.value); this._changed(); }),
      this._slider(fovShade, () => { SETTINGS.fovShade = parseFloat(fovShade.value); this._changed(); }),
      this._slider(fovWarden, () => { SETTINGS.fovWarden = parseFloat(fovWarden.value); this._changed(); }),
      bob,
      this._slider(vol, () => {
        SETTINGS.masterVolume = parseFloat(vol.value);
        if (this.handlers.onVolume) this.handlers.onVolume(SETTINGS.masterVolume);
        this._changed();
      }),
      len, diff, inv, brief, postRow, dbg, reset, controls, back,
    ]);
  },

  /**
   * Controls (H8). One row per action in the order `DEFAULT_BINDINGS`
   * declares them, showing every key bound to it; activating the row waits
   * for a key and the key you press becomes that action's **first** binding,
   * leaving any alternate alone - so rebinding forward to T reads `T / Up`
   * and the arrow keys a player never touched are still there. A second cell
   * restores that one row's shipped keys, which is what makes the alternate
   * you did replace recoverable without resetting the lot.
   *
   * **A key bound to two actions is shown, not refused.** The game will fire
   * both, and a player who wants crouch and slide on one key is entitled to
   * it; what the page owes them is knowing, so both rows say whose key they
   * are sharing. The rule is `bindingConflicts()` in `input.js`, handed down
   * like every other live reading, so it is a fact about the input map rather
   * than about this page.
   *
   * **Escape is the way out of a capture**, and so the one key nothing can be
   * bound to: a page you can walk into and not out of is worse than a pause
   * key nobody rebinds. A mouse button is bound by clicking the waiting cell
   * with it, which is also why `fire` can be put back on Mouse0 by hand and
   * not only by the row's reset.
   */
  _renderControls() {
    // The live map when the root has wired one, the defaults otherwise: this
    // page, like How to play, is reachable before a match exists.
    const bindings = (this.handlers.bindings && this.handlers.bindings()) || DEFAULT_BINDINGS;
    const clashes = (this.handlers.conflicts && this.handlers.conflicts()) || new Map();
    const actions = Object.keys(DEFAULT_BINDINGS);
    const rows = actions.map((action) => {
      const codes = bindings[action] || [];
      const also = [];
      for (const code of codes) {
        for (const other of clashes.get(code) || []) {
          if (other !== action && also.indexOf(other) === -1) also.push(other);
        }
      }
      const waiting = this.binding === action;
      const keys = codes.length ? codes.map(keyLabel).join(' / ') : 'unbound';
      return `<div class="row bindrow">
        <span class="what">${action}</span>
        <span class="clash" id="bl-clash-${action}">${also.length ? `also ${also.join(', ')}` : ''}</span>
        <span class="value${waiting ? ' waiting' : ''}" id="bl-bind-${action}">${waiting ? 'press a key' : keys}</span>
        <span class="value small" id="bl-bindreset-${action}">reset</span>
      </div>`;
    }).join('');

    this.root.innerHTML = `
      <div class="card">
        <h1 style="font-size:20px">Controls</h1>
        <div class="tag">${this.binding ? 'press a key, or esc to cancel' : 'pick a row, then press the key'}</div>
        ${rows}
        <button class="back" data-action="back">Back</button>
      </div>`;

    const declared = [];
    for (const action of actions) {
      const key = this.root.querySelector(`#bl-bind-${action}`);
      key.onclick = () => {
        // The click that ended a mouse capture is not also the click that
        // starts the next one (input.js plays the same trick with pointer
        // lock): mousedown, mouseup and click all arrive from one press.
        if (this._swallowBindClick) { this._swallowBindClick = false; return; }
        this.binding = action;
        this.render();
      };
      // A mouse button is bound by pressing it on the cell that is waiting.
      // A press anywhere else is that row's click and cancels this one, so
      // there is no way to bind a button by accident.
      key.onmousedown = (event) => {
        if (this.binding !== action) return;
        event.preventDefault();
        this._swallowBindClick = true;
        this._bindCaptured(`Mouse${event.button}`);
      };
      key.oncontextmenu = (event) => { if (this.binding === action) event.preventDefault(); };
      const reset = this.root.querySelector(`#bl-bindreset-${action}`);
      reset.onclick = () => {
        this.binding = null;
        if (this.handlers.onResetBinding) this.handlers.onResetBinding(action);
        this.render();
      };
      declared.push(key, reset);
    }
    const back = this.root.querySelector('[data-action=back]');
    back.onclick = () => {
      this.binding = null;
      this.show('settings');
    };
    this._rows([...declared, back]);
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

