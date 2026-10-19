/**
 * BLACKLINE - ui/menupause.js
 *
 * The pages a match opens rather than the main menu: the pause overlay, and
 * what it copies when a friend wants to tell you what they saw (H12).
 * Installed on `Menu.prototype` at the bottom of `menu.js` beside
 * `menupages.js`, the same prototype mixin: `this` is the menu, and every
 * page ends by declaring its rows through `this._rows()`, which is what
 * `every-main-menu-row-is-reachable-and-actionable-from-the-keyboard` counts.
 *
 * Layering (Section 3.1): nothing. What a button does arrives as a handler
 * from `panels.js`; nothing here imports main.js.
 */

export const MENU_PAUSE = {
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
        <button data-action="report">Copy report</button>
        <button data-action="quit">Main menu</button>
        ${this._reportBox()}
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
    const report = this.root.querySelector('[data-action=report]');
    report.onclick = () => this._copyReport();
    const quit = this.root.querySelector('[data-action=quit]');
    quit.onclick = () => {
      this.show('main');
      if (this.handlers.onQuit) this.handlers.onQuit();
    };
    this._rows([resume, settings, report, quit]);
  },

  /** Where *Copy report* puts its text: hidden until it is asked for. */
  _reportBox() {
    return `<div class="tag" data-role="report-status" hidden></div>
        <textarea data-role="report" readonly rows="8" hidden></textarea>`;
  },

  /**
   * H12: build the report, show it, and try the clipboard. It is shown as well
   * as copied because a page served over plain http, or a browser that says
   * no, has no clipboard to write to - and the box is what a check reads.
   */
  _copyReport() {
    const text = this.handlers.report ? this.handlers.report() : '';
    const box = this.root.querySelector('[data-role=report]');
    const status = this.root.querySelector('[data-role=report-status]');
    if (!box || !status) return;
    box.value = text;
    box.hidden = false;
    status.hidden = false;
    status.textContent = 'select the text below and copy it';
    const clip = typeof navigator !== 'undefined' && navigator.clipboard;
    if (clip && typeof clip.writeText === 'function') {
      clip.writeText(text).then(() => { status.textContent = 'copied - paste it into a message'; }, () => {});
    }
  },
};
