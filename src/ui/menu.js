/**
 * BLACKLINE — ui/menu.js
 *
 * The main menu (Section 13). Flat, high contrast, faction accents. Every page
 * but this one is `menupages.js` and the stylesheet is `menucss.js`; both are
 * installed here, so `h.menu` is one object with every page on it.
 *
 * Layering (Section 3.1): ui may import from config. The menu never starts a
 * match itself — it calls back into the composition root, so `initMatch` stays
 * the single entry point Section 12 requires and free-roam remains a
 * configuration rather than a second path. The same rule is why the build
 * stamp (H3) and the map thumbnails (H5) arrive as getters the root hands
 * down rather than as modules this reaches up for.
 *
 * **Audio gate.** Section 13 and the risk register: the Play button is the
 * first user gesture, and the AudioContext is created there. Nothing attempts
 * to create or resume audio before that click.
 *
 * **The keyboard drives it** (H5). `Tab` is in `SUPPRESSED_KEYS`, so the
 * browser's own focus traversal is turned off inside this game on purpose and
 * the menu has to do its own: every page declares its focusable rows through
 * `_rows()`, the arrow keys move and change, Enter and Space activate. A page
 * that draws a control and forgets to declare it is caught by
 * `every-main-menu-row-is-reachable-and-actionable-from-the-keyboard`, which
 * counts the controls in the DOM and requires as many to be reachable.
 */

import { SETTINGS } from '../config.js';
import { MENU_CSS } from './menucss.js';
import { MENU_PAGES } from './menupages.js';

/** The two roles a player can pick, and what Play does with each. */
export const ROLES = [
  { id: 'shade', note: 'competitive - plant the charge' },
  { id: 'warden', note: 'free roam - no opponent, no clock' },
];

/** Keys the menu acts on. Everything else falls through to the game. */
const NAV = {
  prev: ['ArrowUp', 'KeyW'],
  next: ['ArrowDown', 'KeyS'],
  less: ['ArrowLeft', 'KeyA'],
  more: ['ArrowRight', 'KeyD'],
  // Enter and not Space: Space is the jump key, and a menu that swallowed it
  // would still leave it held for the first step after the menu closes.
  go: ['Enter', 'NumpadEnter'],
};

export class Menu {
  /**
   * @param {object} handlers
   * @param {(config:object)=>void} handlers.onPlay
   * @param {()=>void} handlers.onFreeRoam
   * @param {()=>void} [handlers.onFirstGesture] the audio gate
   * @param {{id:string,name:string}[]} [handlers.maps] every map the registry offers (D1)
   * @param {()=>string} [handlers.mapId] the map this page is on
   * @param {(id:string)=>void} [handlers.onMap] a card's click: another page load
   * @param {()=>string} [handlers.version] the build this page is (H3), for the footer
   * @param {(id:string)=>string|null} [handlers.thumbnail] the picture for a map (H5),
   *   null until it has been rendered; the root re-renders the menu when they land
   * @param {()=>object} [handlers.bindings] the live key bindings, for How to play
   */
  constructor(handlers) {
    this.handlers = handlers || {};
    this.gestureFired = false;

    this.style = document.createElement('style');
    this.style.textContent = MENU_CSS;
    document.head.appendChild(this.style);

    this.root = document.createElement('div');
    this.root.id = 'bl-menu';
    document.body.appendChild(this.root);

    /** The focusable rows of the page on screen, in the order the keys walk them. */
    this.rows = [];
    /** Which of them the ring is on. */
    this.focus = 0;

    this._onKeyDown = (event) => this._key(event);
    window.addEventListener('keydown', this._onKeyDown);

    this.page = 'main';
    this.render();
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
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
    if (this.page === 'howto') return this._renderHowTo();
    if (this.page === 'credits') return this._renderCredits();
    this._renderMain();
  }

  // -------------------------------------------------------------------------
  // The keyboard (H5)
  // -------------------------------------------------------------------------

  /**
   * Declare the page's focusable rows. An element is a row that activates on
   * its own `click`; `_slider` wraps one that answers left and right instead.
   *
   * The ring is kept where it was across a re-render when the page has not
   * changed, so re-drawing the menu to show a thumbnail that has just landed
   * does not throw the player back to the top of the list.
   *
   * @param {(HTMLElement|object)[]} rows
   */
  _rows(rows) {
    const same = this._focusPage === this.page;
    this.rows = rows.filter(Boolean).map((row) => (row.el ? row : { el: row, activate: () => row.click() }));
    this.focus = same ? Math.min(this.focus, Math.max(0, this.rows.length - 1)) : 0;
    this._focusPage = this.page;
    this._paint();
  }

  /**
   * A range input as a row: left and right step it and fire its `oninput`
   * work, because a slider that only answers a drag is a setting a keyboard
   * cannot reach.
   *
   * @param {HTMLInputElement} el
   * @param {() => void} apply what the mouse path does with the new value
   */
  _slider(el, apply) {
    const nudge = (direction) => {
      const step = Number(el.step) || 1;
      const min = Number(el.min);
      const max = Number(el.max);
      el.value = String(Math.min(max, Math.max(min, Number(el.value) + direction * step)));
      apply();
    };
    return { el, activate: () => {}, less: () => nudge(-1), more: () => nudge(1) };
  }

  /** Put the ring where `this.focus` says. */
  _paint() {
    for (let i = 0; i < this.rows.length; i++) {
      this.rows[i].el.classList.toggle('focused', i === this.focus);
    }
  }

  /** Move the ring, wrapping, so the list has no dead end. */
  _move(by) {
    if (!this.rows.length) return;
    this.focus = (this.focus + by + this.rows.length) % this.rows.length;
    this._paint();
  }

  _key(event) {
    if (!this.open || !this.rows.length) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const code = event.code;
    const row = this.rows[this.focus];
    if (NAV.prev.indexOf(code) !== -1) this._move(-1);
    else if (NAV.next.indexOf(code) !== -1) this._move(1);
    else if (NAV.less.indexOf(code) !== -1) (row.less || row.activate)();
    else if (NAV.more.indexOf(code) !== -1) (row.more || row.activate)();
    else if (NAV.go.indexOf(code) !== -1) row.activate();
    else return;
    // Only the keys the menu acted on: everything else is still the game's,
    // and Input has already suppressed the browser default for the arrows.
    event.preventDefault();
  }

  // -------------------------------------------------------------------------
  // The main page
  // -------------------------------------------------------------------------

  /** The registry's maps, and the one this page is on. */
  _maps() {
    const maps = this.handlers.maps || [];
    const id = this.handlers.mapId ? this.handlers.mapId() : null;
    const current = maps.find((entry) => entry.id === id) || maps[0] || { id, name: id || '' };
    return { maps, current };
  }

  /** The role Play will start, defaulted to the one the settings hold. */
  _role() {
    return ROLES.find((entry) => entry.id === SETTINGS.role) || ROLES[0];
  }

  /**
   * The build stamp for the footer (H3). A string the root hands down rather
   * than a module this imports, so `ui/` keeps its one import (Section 3.1),
   * and a getter rather than a value because the stamp arrives over the network
   * after the menu is first drawn — `panels.js` re-renders when it lands.
   */
  _version() {
    if (!this.handlers.version) return '';
    return String(this.handlers.version() || '');
  }

  /**
   * One card per registered map (H5). The picture is a data URL rendered from
   * the map's own geometry at boot (`thumbnails.js`); until it lands the card
   * is drawn with an empty frame at the same aspect, so nothing on the menu
   * moves when it arrives.
   */
  _cards(maps, current) {
    return maps.map((entry) => {
      const url = this.handlers.thumbnail ? this.handlers.thumbnail(entry.id) : null;
      const here = entry.id === current.id;
      return `<button class="mapcard" data-map="${entry.id}" aria-current="${here}">
        <img class="thumb" id="bl-thumb-${entry.id}" alt="${entry.name}"${url ? ` src="${url}"` : ''}>
        <span class="label"><span class="mapname">${entry.name}</span>
          <span class="mapnote">${here ? 'selected' : 'switch to'}</span></span>
      </button>`;
    }).join('');
  }

  _renderMain() {
    const { maps, current } = this._maps();
    const role = this._role();
    this.root.innerHTML = `
      <div class="card">
        <h1 id="bl-title">Blackline</h1>
        <div class="tag">${current.name.toLowerCase()}</div>
        <div class="maps" id="bl-cards">${this._cards(maps, current)}</div>
        <div class="row"><span>role</span>
          <span class="value" id="bl-role" title="${ROLES.map((entry) => entry.id).join(' / ')}">${role.id}</span></div>
        <div class="tag" id="bl-role-note" style="margin:6px 0 16px">${role.note}</div>
        <button data-action="play">Play</button>
        <button data-action="freeroam">Free Roam</button>
        <button data-action="settings">Settings</button>
        <button data-action="howto">How to play</button>
        <button data-action="credits">Credits</button>
        <div class="row"><span>map</span>
          <span class="value" id="bl-map" title="${maps.map((entry) => entry.name).join(' / ')}">${current.name}</span></div>
        <div class="footer" id="bl-version">${this._version()}</div>
      </div>`;

    // D1: another map is another page load (maps/index.js), so a card hands
    // its id up and the page goes. The card for the map already loaded does
    // nothing but say so.
    const cards = [...this.root.querySelectorAll('.mapcard')];
    for (const card of cards) {
      card.onclick = () => {
        const id = card.dataset.map;
        if (id === current.id) return;
        SETTINGS.lastMap = id;
        if (this.handlers.onMap) this.handlers.onMap(id);
      };
    }

    // The map row stays what D1 made it — the label for which map this page is
    // on, cycling to the next on a click. The cards are the way to pick one;
    // this is the line that answers "which am I on".
    const row = this.root.querySelector('#bl-map');
    row.onclick = () => {
      if (maps.length < 2) return;
      const next = maps[(maps.findIndex((entry) => entry.id === current.id) + 1) % maps.length];
      SETTINGS.lastMap = next.id;
      if (this.handlers.onMap) this.handlers.onMap(next.id);
    };

    // H5: which role Play starts. Two, because those are the two the game has
    // — a competitive Warden would need a Shade AI and there is none (D56).
    const roleRow = this.root.querySelector('#bl-role');
    const note = this.root.querySelector('#bl-role-note');
    roleRow.onclick = () => {
      const index = ROLES.findIndex((entry) => entry.id === SETTINGS.role);
      const picked = ROLES[(index + 1) % ROLES.length];
      SETTINGS.role = picked.id;
      roleRow.textContent = picked.id;
      note.textContent = picked.note;
    };

    const play = this.root.querySelector('[data-action=play]');
    play.onclick = () => {
      this._gesture();
      this.hide();
      // The role row decides which of the two this is. Both go through the
      // root's own handlers, so `initMatch` is still the one entry point.
      if (SETTINGS.role === 'warden') {
        if (this.handlers.onFreeRoam) this.handlers.onFreeRoam();
      } else if (this.handlers.onPlay) {
        this.handlers.onPlay();
      }
    };
    const freeroam = this.root.querySelector('[data-action=freeroam]');
    // The shortcut into free roam, unchanged since Section 12. It deliberately
    // does NOT move the role row: a check that clicks it would otherwise leave
    // the role behind for every check after it, which is the one thing a check
    // may not leave (F2, TRAPS.md).
    freeroam.onclick = () => {
      this._gesture();
      this.hide();
      if (this.handlers.onFreeRoam) this.handlers.onFreeRoam();
    };
    const settings = this.root.querySelector('[data-action=settings]');
    settings.onclick = () => {
      this._settingsReturn = 'main';
      this.show('settings');
    };
    const howto = this.root.querySelector('[data-action=howto]');
    howto.onclick = () => this.show('howto');
    const credits = this.root.querySelector('[data-action=credits]');
    credits.onclick = () => this.show('credits');

    this._rows([...cards, roleRow, play, freeroam, settings, howto, credits, row]);
  }
}

Object.assign(Menu.prototype, MENU_PAGES);

export function createMenu(handlers) {
  return new Menu(handlers);
}
