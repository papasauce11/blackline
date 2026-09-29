/**
 * BLACKLINE — input.js
 *
 * Keyboard, mouse and pointer lock. Rebindable action map.
 * Layering (Section 3.1): may import from config only.
 *
 * Edge model
 * ----------
 * The game runs a fixed timestep with an accumulator, so a frame may run zero,
 * one, or several physics steps. A "pressed" edge must be consumed by exactly
 * one step and must not be lost on a frame that runs no steps. So:
 *
 *   while (accumulator >= dt) {
 *     step(dt)
 *     input.clearEdges()             // only after a step actually consumed them
 *   }
 *   input.endFrame()                 // zero the per-frame mouse delta
 *
 * If no step runs this frame, edges survive to the next frame intact.
 */

import { DEFAULT_BINDINGS, SUPPRESSED_KEYS, SETTINGS } from './config.js';

const MOUSE_CODES = ['Mouse0', 'Mouse1', 'Mouse2', 'Mouse3', 'Mouse4'];

export class Input {
  /**
   * @param {HTMLElement} element element that receives pointer lock (the canvas)
   * @param {object} [bindings] action -> array of KeyboardEvent.code / MouseN
   */
  constructor(element, bindings = DEFAULT_BINDINGS) {
    this.element = element;

    /** action -> array of codes. Mutable copy so rebind() cannot touch CONFIG. */
    this.bindings = {};
    for (const action of Object.keys(bindings)) {
      this.bindings[action] = bindings[action].slice();
    }

    /** code -> array of actions. Rebuilt on every rebind. */
    this.codeToActions = new Map();

    /** Codes currently held. */
    this.heldCodes = new Set();
    /** Codes that went down since the last clearEdges(). */
    this.pressedCodes = new Set();
    /** Codes that went up since the last clearEdges(). */
    this.releasedCodes = new Set();

    /** Accumulated pointer movement for this frame, in raw device units. */
    this.mouse = { dx: 0, dy: 0, wheel: 0 };

    this.locked = false;
    /** Set while a click is being used to acquire pointer lock. */
    this._swallowNextMouseDown = false;
    /** Set while the settings page is binding a key (H8): see swallowPress(). */
    this._swallowUntilKeyUp = false;
    /** True once the user has produced a real gesture (audio gate, Section 13). */
    this.hasUserGesture = false;

    this._listeners = [];
    this._rebuildLookup();
    this._attach();
  }

  // -------------------------------------------------------------------------
  // Binding management
  // -------------------------------------------------------------------------

  _rebuildLookup() {
    this.codeToActions.clear();
    for (const action of Object.keys(this.bindings)) {
      for (const code of this.bindings[action]) {
        if (!this.codeToActions.has(code)) this.codeToActions.set(code, []);
        this.codeToActions.get(code).push(action);
      }
    }
  }

  /**
   * Rebind an action to a code.
   * @param {string} action
   * @param {string} code KeyboardEvent.code or MouseN
   * @param {number} [slot] which binding slot to replace; appends past the end
   */
  rebind(action, code, slot = 0) {
    if (!this.bindings[action]) this.bindings[action] = [];
    if (slot < this.bindings[action].length) this.bindings[action][slot] = code;
    else this.bindings[action].push(code);
    this._rebuildLookup();
  }

  /** Codes currently bound to an action. */
  getBinding(action) {
    return this.bindings[action] ? this.bindings[action].slice() : [];
  }

  /** Restore the defaults from config.js. */
  resetBindings() {
    this.bindings = {};
    for (const action of Object.keys(DEFAULT_BINDINGS)) {
      this.bindings[action] = DEFAULT_BINDINGS[action].slice();
    }
    this._rebuildLookup();
  }

  /**
   * Forget the press being handled right now, and everything until that key
   * comes back up (H8).
   *
   * The settings page binds a key on that key's own `keydown`, and this
   * class's listener and the menu's are both on `window`: whichever was
   * added first runs first, and an event dispatched straight at `window`
   * runs both of them whatever phase they asked for - so `preventDefault`
   * and `stopPropagation` cannot keep the code out of `pressedCodes`. A
   * `clearAll()` at the moment of the bind is therefore undone by the very
   * event that caused it, half the time. Holding the gate open to the keyup
   * works whichever way round they run, and spells the rule that matters:
   * **binding a key must not also fire it.**
   */
  swallowPress() {
    this.clearAll();
    this._swallowUntilKeyUp = true;
  }

  /**
   * Restore one action's shipped keys (H8). The settings page offers this per
   * row, so a player who replaced the alternate binding of a cluster - `W /
   * Up` down to one key - can have it back without resetting every other row
   * they have set the way they like.
   *
   * @param {string} action
   */
  resetBinding(action) {
    if (!DEFAULT_BINDINGS[action]) return;
    this.bindings[action] = DEFAULT_BINDINGS[action].slice();
    this._rebuildLookup();
  }

  // -------------------------------------------------------------------------
  // Queries — actions
  // -------------------------------------------------------------------------

  /** Is any code bound to this action currently held? */
  down(action) {
    const codes = this.bindings[action];
    if (!codes) return false;
    for (let i = 0; i < codes.length; i++) {
      if (this.heldCodes.has(codes[i])) return true;
    }
    return false;
  }

  /** Did this action go down since the last clearEdges()? */
  pressed(action) {
    const codes = this.bindings[action];
    if (!codes) return false;
    for (let i = 0; i < codes.length; i++) {
      if (this.pressedCodes.has(codes[i])) return true;
    }
    return false;
  }

  /** Did this action go up since the last clearEdges()? */
  released(action) {
    const codes = this.bindings[action];
    if (!codes) return false;
    for (let i = 0; i < codes.length; i++) {
      if (this.releasedCodes.has(codes[i])) return true;
    }
    return false;
  }

  /** Signed axis from two actions, -1 / 0 / +1. */
  axis(negativeAction, positiveAction) {
    return (this.down(positiveAction) ? 1 : 0) - (this.down(negativeAction) ? 1 : 0);
  }

  // -------------------------------------------------------------------------
  // Queries — raw codes (used by debug tooling, which is not rebindable)
  // -------------------------------------------------------------------------

  keyDown(code) {
    return this.heldCodes.has(code);
  }

  keyPressed(code) {
    return this.pressedCodes.has(code);
  }

  // -------------------------------------------------------------------------
  // Look
  // -------------------------------------------------------------------------

  /**
   * Mouse movement for this frame scaled by sensitivity, in radians.
   * Mouse delta is a displacement, not a rate, so it is applied once per frame
   * rather than per physics step.
   *
   * Sensitivity is per axis (H9): `mouseSensitivity` turns, `mouseSensitivityY`
   * pitches. Equal by default, so nothing about the feel changes until someone
   * moves one of them; the ADS multiplier scales both, because it is there to
   * keep a narrowed FOV tracking 1:1 and that is true of both axes.
   *
   * @param {number} [sensitivityScale] e.g. the ADS multiplier
   */
  lookDelta(sensitivityScale = 1) {
    const x = SETTINGS.mouseSensitivity * sensitivityScale;
    const y = SETTINGS.mouseSensitivityY * sensitivityScale;
    return {
      yaw: -this.mouse.dx * x,
      pitch: (SETTINGS.invertY ? this.mouse.dy : -this.mouse.dy) * y,
    };
  }

  // -------------------------------------------------------------------------
  // Frame lifecycle
  // -------------------------------------------------------------------------

  /** Called after a fixed step has had the chance to read the edges. */
  clearEdges() {
    if (this.pressedCodes.size) this.pressedCodes.clear();
    if (this.releasedCodes.size) this.releasedCodes.clear();
  }

  /** Called once at the end of each rendered frame. */
  endFrame() {
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.mouse.wheel = 0;
  }

  /** Drop all held keys. Used on blur and on pointer-lock exit. */
  clearAll() {
    this.heldCodes.clear();
    this.pressedCodes.clear();
    this.releasedCodes.clear();
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.mouse.wheel = 0;
  }

  // -------------------------------------------------------------------------
  // Pointer lock
  // -------------------------------------------------------------------------

  requestLock() {
    if (this.locked) return;
    const result = this.element.requestPointerLock();
    // Chrome returns a promise; Firefox returns undefined. A rejection here is
    // routine (user pressed Escape moments ago) and must not surface as an
    // unhandled rejection.
    if (result && typeof result.catch === 'function') result.catch(() => {});
  }

  exitLock() {
    if (document.pointerLockElement === this.element) document.exitPointerLock();
  }

  // -------------------------------------------------------------------------
  // DOM wiring
  // -------------------------------------------------------------------------

  _on(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this._listeners.push([target, type, handler, options]);
  }

  _attach() {
    this._on(window, 'keydown', (e) => this._onKeyDown(e));
    this._on(window, 'keyup', (e) => this._onKeyUp(e));
    this._on(window, 'blur', () => this.clearAll());

    this._on(this.element, 'mousedown', (e) => this._onMouseDown(e));
    this._on(window, 'mouseup', (e) => this._onMouseUp(e));
    this._on(window, 'mousemove', (e) => this._onMouseMove(e));
    this._on(this.element, 'wheel', (e) => this._onWheel(e), { passive: true });
    this._on(this.element, 'contextmenu', (e) => e.preventDefault());

    this._on(document, 'pointerlockchange', () => this._onPointerLockChange());
    this._on(document, 'pointerlockerror', () => {
      this.locked = false;
      this.clearAll();
    });
  }

  /** Remove every listener. Called if the game is ever torn down. */
  detach() {
    for (const [target, type, handler, options] of this._listeners) {
      target.removeEventListener(type, handler, options);
    }
    this._listeners.length = 0;
    this.clearAll();
  }

  _shouldSuppress(e) {
    // Never fight the browser's own shortcuts. Reload and devtools must work.
    if (e.ctrlKey || e.altKey || e.metaKey) return false;
    const target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return false;
    return SUPPRESSED_KEYS.indexOf(e.code) !== -1 || this.codeToActions.has(e.code);
  }

  _onKeyDown(e) {
    if (this._shouldSuppress(e)) e.preventDefault();
    this.hasUserGesture = true;
    // The press that bound a key is not also a press of it (H8).
    if (this._swallowUntilKeyUp) return;
    // Browsers repeat keydown while a key is held. Only the first is an edge.
    if (this.heldCodes.has(e.code)) return;
    this.heldCodes.add(e.code);
    this.pressedCodes.add(e.code);
  }

  _onKeyUp(e) {
    if (this._shouldSuppress(e)) e.preventDefault();
    if (this._swallowUntilKeyUp) {
      this._swallowUntilKeyUp = false;
      this.clearAll();
      return;
    }
    this.heldCodes.delete(e.code);
    this.releasedCodes.add(e.code);
  }

  _onMouseDown(e) {
    this.hasUserGesture = true;
    if (this._swallowNextMouseDown) {
      this._swallowNextMouseDown = false;
      return;
    }
    const code = MOUSE_CODES[e.button];
    if (!code || this.heldCodes.has(code)) return;
    this.heldCodes.add(code);
    this.pressedCodes.add(code);
  }

  _onMouseUp(e) {
    const code = MOUSE_CODES[e.button];
    if (!code) return;
    this.heldCodes.delete(code);
    this.releasedCodes.add(code);
  }

  _onMouseMove(e) {
    if (!this.locked) return;
    this.mouse.dx += e.movementX || 0;
    this.mouse.dy += e.movementY || 0;
  }

  _onWheel(e) {
    this.mouse.wheel += Math.sign(e.deltaY);
  }

  _onPointerLockChange() {
    const nowLocked = document.pointerLockElement === this.element;
    if (nowLocked && !this.locked) {
      // The click that acquired the lock must not also register as a shot.
      this._swallowNextMouseDown = true;
    }
    if (!nowLocked && this.locked) {
      // Releasing the lock leaves keys stuck down otherwise.
      this.clearAll();
    }
    this.locked = nowLocked;
  }
}

/**
 * Codes bound to more than one action, as `code -> actions` (H8).
 *
 * A conflict is **shown and never refused**: the game will fire both, and a
 * player who wants melee and crouch on one key is entitled to them. What the
 * settings page owes them is knowing, so this is the rule it draws from - a
 * fact about the input map rather than about the page, which is also what
 * lets a check assert it without a DOM.
 *
 * Pure, and takes the map rather than reading `this`, so the menu can be
 * handed it from the composition root the way every other live reading is
 * (Section 3.1: `ui/` does not import this module).
 *
 * @param {Record<string, string[]>} bindings
 * @returns {Map<string, string[]>}
 */
export function bindingConflicts(bindings) {
  const byCode = new Map();
  for (const action of Object.keys(bindings)) {
    for (const code of bindings[action]) {
      if (!byCode.has(code)) byCode.set(code, []);
      if (byCode.get(code).indexOf(action) === -1) byCode.get(code).push(action);
    }
  }
  const clashes = new Map();
  for (const [code, actions] of byCode) {
    if (actions.length > 1) clashes.set(code, actions);
  }
  return clashes;
}
