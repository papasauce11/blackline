/**
 * BLACKLINE — ui/debug.js
 *
 * Debug tooling (Section 17):
 *   - F3 overlay, data driven from a shared debugState object
 *   - F4 test mode, its key bindings and its command log (Section 17.1)
 *   - Runtime assertions
 *   - The AUTO test registry and runner behind the "Y" key
 *
 * Layering (Section 3.1): ui/ may import from systems, entities and config.
 * This module imports config only, and never Three.js: the shadow-light count
 * is read from the duck-typed isLight/castShadow flags on the scene graph.
 *
 * Design note — nothing here is a placeholder. The overlay renders whichever
 * fields are present in debugState, the assertion registry runs whichever
 * assertions have been registered, and the AUTO suite runs whichever checks
 * have been registered. Systems populate all three as they come online across
 * phases, so a partial build reports honestly instead of showing dead rows.
 */

import { CONFIG, DEBUG, DEBUG_KEYS, rng } from '../config.js';

// ---------------------------------------------------------------------------
// Overlay field spec. Order here is the order on screen. A row is drawn only
// if its key exists in debugState.
// ---------------------------------------------------------------------------

const num = (d) => (v) => (typeof v === 'number' ? v.toFixed(d) : String(v));
const vec3 = (v) =>
  v && typeof v.x === 'number' ? `${v.x.toFixed(2)} ${v.y.toFixed(2)} ${v.z.toFixed(2)}` : String(v);

const FIELDS = [
  { key: 'fps', label: 'FPS', fmt: num(0) },
  { key: 'frameMs', label: 'frame ms', fmt: num(2) },
  { key: 'cpuMs', label: 'cpu ms', fmt: num(2) },
  { key: 'stepsPerFrame', label: 'steps/frame', fmt: num(0) },
  { key: 'timeScale', label: 'time scale', fmt: num(2) },
  { key: 'drawCalls', label: 'draw calls', fmt: num(0) },
  { key: 'triangles', label: 'triangles', fmt: num(0) },
  { key: 'sep1', label: null },
  { key: 'seed', label: 'match seed', fmt: (v) => String(v) },
  { key: 'rngCalls', label: 'rng calls', fmt: num(0) },
  { key: 'mode', label: 'mode', fmt: String },
  { key: 'roundState', label: 'round state', fmt: String },
  { key: 'collisionBoxes', label: 'collision boxes', fmt: num(0) },
  { key: 'mapLedges', label: 'marked ledges', fmt: num(0) },
  { key: 'cameraPos', label: 'camera pos', fmt: vec3 },
  { key: 'sep2', label: null },
  { key: 'visibilityRaw', label: 'visibility raw', fmt: num(1) },
  { key: 'visibilitySmoothed', label: 'visibility smoothed', fmt: num(1) },
  { key: 'shadeLives', label: 'shade lives', fmt: num(0) },
  { key: 'shadeState', label: 'shade state', fmt: String },
  { key: 'shadeGrounded', label: 'grounded', fmt: String },
  { key: 'shadePos', label: 'shade pos', fmt: vec3 },
  { key: 'shadeVel', label: 'shade vel', fmt: vec3 },
  { key: 'sep3', label: null },
  { key: 'cameraOwner', label: 'camera owner', fmt: String },
  { key: 'wardenState', label: 'warden state', fmt: String },
  { key: 'wardenHealth', label: 'warden health', fmt: num(0) },
  { key: 'wardenPos', label: 'warden pos', fmt: vec3 },
  { key: 'aiState', label: 'ai state', fmt: String },
  { key: 'aiDetection', label: 'ai detection', fmt: num(1) },
  { key: 'aiStuckCounter', label: 'ai stuck count', fmt: num(0) },
  { key: 'aiStuckTimer', label: 'ai stuck timer', fmt: num(2) },
  { key: 'sep4', label: null },
  { key: 'activeEffects', label: 'active effects', fmt: num(0) },
  { key: 'activeNoise', label: 'active noise', fmt: num(0) },
  { key: 'pooledSprites', label: 'pooled sprites', fmt: num(0) },
];

const OVERLAY_CSS = `
#bl-debug, #bl-test {
  position: fixed; z-index: 40;
  font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #cfe9e4; background: rgba(8,11,14,0.82);
  border: 1px solid rgba(47,214,195,0.28); border-radius: 3px;
  padding: 8px 10px; pointer-events: none; white-space: pre;
  text-shadow: 0 1px 0 rgba(0,0,0,0.9);
}
#bl-debug { top: 10px; left: 10px; min-width: 232px; }
#bl-test  { top: 10px; right: 10px; min-width: 224px; }
#bl-debug h4, #bl-test h4 {
  margin: 0 0 6px; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
  color: #2fd6c3; font-weight: 600;
}
.bl-row { display: flex; justify-content: space-between; gap: 18px; }
.bl-row span:first-child { color: #7e8f95; }
.bl-row span:last-child { color: #e6f5f2; }
.bl-sep { height: 5px; }
.bl-ok   span:last-child { color: #4ade80; }
.bl-warn span:last-child { color: #fbbf24; }
.bl-bad  span:last-child { color: #f87171; }
#bl-test .bl-key { color: #f28c1a; }
#bl-test .bl-log { color: #9fb4ba; }
#bl-test .bl-log-latest { color: #2fd6c3; }
.bl-hidden { display: none !important; }
`;

// ---------------------------------------------------------------------------
// DebugTools
// ---------------------------------------------------------------------------

export class DebugTools {
  /**
   * @param {object} options
   * @param {import('../input.js').Input} options.input
   * @param {object} options.emitter event emitter created in main.js
   * @param {object} options.debugState shared mutable field bag
   * @param {object} options.harness capabilities the AUTO suite needs
   */
  constructor({ input, emitter, debugState, harness }) {
    this.input = input;
    this.emitter = emitter;
    this.state = debugState;
    this.harness = harness;

    this.overlayVisible = false;
    this.testModeVisible = false;

    this._refreshInterval = 1 / CONFIG.debug.overlayRefreshHz;
    this._refreshTimer = 0;

    this._frameTimes = [];
    this._testLog = [];

    /** name -> { fn, failures } */
    this._assertions = new Map();
    this._assertionMessages = new Map();
    this.assertionFailures = 0;
    this._assertionStepCounter = 0;

    /** Registered AUTO checks, in registration order. */
    this._autoTests = [];
    this._autoRunning = false;

    this._buildDom();
  }

  // -------------------------------------------------------------------------
  // DOM
  // -------------------------------------------------------------------------

  _buildDom() {
    const style = document.createElement('style');
    style.textContent = OVERLAY_CSS;
    document.head.appendChild(style);

    this.overlayEl = document.createElement('div');
    this.overlayEl.id = 'bl-debug';
    this.overlayEl.className = 'bl-hidden';
    document.body.appendChild(this.overlayEl);

    this.testEl = document.createElement('div');
    this.testEl.id = 'bl-test';
    this.testEl.className = 'bl-hidden';
    document.body.appendChild(this.testEl);
  }

  // -------------------------------------------------------------------------
  // Per-frame
  // -------------------------------------------------------------------------

  /**
   * Refresh the overlays. Called once per frame, after rendering.
   * @param {number} wallDt unscaled frame delta in seconds
   * @param {number} frameMs frame delta in milliseconds
   */
  update(wallDt, frameMs) {
    if (!DEBUG) return;

    this._sampleFps(frameMs);

    if (!this.overlayVisible && !this.testModeVisible) return;

    this._refreshTimer += wallDt;
    if (this._refreshTimer < this._refreshInterval) return;
    this._refreshTimer = 0;

    if (this.overlayVisible) this._renderOverlay();
    if (this.testModeVisible) this._renderTestPanel();
  }

  _sampleFps(frameMs) {
    // The very first frame has no previous timestamp to subtract, so it reports
    // zero. Sampling it would drag the average down for a second.
    if (!(frameMs > 0)) return;
    this._frameTimes.push(frameMs);
    if (this._frameTimes.length > CONFIG.debug.fpsSampleFrames) this._frameTimes.shift();
    let total = 0;
    for (let i = 0; i < this._frameTimes.length; i++) total += this._frameTimes[i];
    const mean = total / this._frameTimes.length;
    this.state.frameMs = mean;
    this.state.fps = mean > 0 ? 1000 / mean : 0;
  }

  // -------------------------------------------------------------------------
  // Keys
  // -------------------------------------------------------------------------

  /**
   * Read the debug keys. Must be called BEFORE the fixed steps run, because a
   * step calls input.clearEdges() and would otherwise eat the keypress.
   */
  pollKeys() {
    if (!DEBUG) return;
    const input = this.input;

    if (input.keyPressed(DEBUG_KEYS.toggleOverlay)) {
      this.overlayVisible = !this.overlayVisible;
      this.overlayEl.classList.toggle('bl-hidden', !this.overlayVisible);
      if (this.overlayVisible) this._renderOverlay();
    }

    if (input.keyPressed(DEBUG_KEYS.toggleTestMode)) {
      this.testModeVisible = !this.testModeVisible;
      this.testEl.classList.toggle('bl-hidden', !this.testModeVisible);
      this._log(this.testModeVisible ? 'test mode ON' : 'test mode OFF');
      if (this.testModeVisible) this._renderTestPanel();
    }

    // Test-mode bindings are inert unless the panel is open. This is what keeps
    // Digit1-4 from colliding with the gadget-select bindings during play.
    if (!this.testModeVisible) return;

    const t = DEBUG_KEYS.test;
    if (input.keyPressed(t.siteA)) this._command('teleport site A', 'test:teleport-site', { site: 0 });
    if (input.keyPressed(t.siteB)) this._command('teleport site B', 'test:teleport-site', { site: 1 });
    if (input.keyPressed(t.siteC)) this._command('teleport site C', 'test:teleport-site', { site: 2 });
    if (input.keyPressed(t.toWarden)) this._command('teleport behind warden', 'test:teleport-warden', {});
    if (input.keyPressed(t.godMode)) this._command('toggle god mode', 'test:god-mode', {});
    if (input.keyPressed(t.killShade)) this._command('kill shade', 'test:kill-shade', {});
    if (input.keyPressed(t.instantPlant)) this._command('instant plant', 'test:instant-plant', {});
    if (input.keyPressed(t.cycleAiState)) this._command('cycle ai state', 'test:cycle-ai-state', {});
    if (input.keyPressed(t.refillGadgets)) this._command('refill gadgets', 'test:refill-gadgets', {});
    if (input.keyPressed(t.cycleTimeScale)) this._command('cycle time scale', 'test:cycle-time-scale', {});
    if (input.keyPressed(t.toggleWardenGround)) this._command('toggle warden ground', 'test:toggle-warden-ground', {});
    if (input.keyPressed(t.runAutoTests)) this.runAutoTests();
    if (input.keyPressed(t.runRegressionSet)) this.runRegressionSet();
  }

  /**
   * Fire a test command. emit() returns how many listeners ran, so the panel
   * distinguishes "did nothing" from "no system is listening yet" instead of
   * silently looking broken during a partial build.
   */
  _command(label, event, payload) {
    const handled = this.emitter.emit(event, payload);
    this._log(handled > 0 ? label : `${label} — no handler yet`);
  }

  _log(line) {
    this._testLog.unshift(line);
    if (this._testLog.length > CONFIG.debug.testLogLines) this._testLog.pop();
    if (this.testModeVisible) this._renderTestPanel();
  }

  /**
   * Systems acknowledge a test command here so the panel shows the effect, not
   * just the keypress. Wired through the emitter by main.js.
   */
  logResult(line) {
    this._log(`  -> ${line}`);
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  _renderOverlay() {
    const parts = ['<h4>Blackline debug &nbsp;F3</h4>'];

    for (const field of FIELDS) {
      if (field.label === null) {
        parts.push('<div class="bl-sep"></div>');
        continue;
      }
      if (!(field.key in this.state)) continue;
      parts.push(row(field.label, field.fmt(this.state[field.key])));
    }

    // Shadow-casting light count. Section 4.1 requires exactly one; the overlay
    // is the standing check for it (Section 17).
    const shadowCount = this._countShadowLights();
    const cls = shadowCount === 1 ? 'bl-ok' : shadowCount === 0 ? 'bl-warn' : 'bl-bad';
    parts.push('<div class="bl-sep"></div>');
    parts.push(row('shadow lights', `${shadowCount} (want 1)`, cls));

    const acls = this.assertionFailures === 0 ? 'bl-ok' : 'bl-bad';
    parts.push(row('assert failures', String(this.assertionFailures), acls));
    parts.push(row('assertions', String(this._assertions.size)));
    parts.push(row('auto checks', String(this._autoTests.length)));

    this.overlayEl.innerHTML = parts.join('');
  }

  _renderTestPanel() {
    const t = DEBUG_KEYS.test;
    const k = (code) => code.replace('Digit', '').replace('Key', '');
    const parts = [
      '<h4>Test mode &nbsp;F4</h4>',
      keyRow(`${k(t.siteA)}/${k(t.siteB)}/${k(t.siteC)}`, 'teleport site A/B/C'),
      keyRow(k(t.toWarden), 'teleport behind warden'),
      keyRow(k(t.godMode), 'god mode'),
      keyRow(k(t.killShade), 'kill shade'),
      keyRow(k(t.instantPlant), 'instant plant'),
      keyRow(k(t.cycleAiState), 'cycle ai state'),
      keyRow(k(t.refillGadgets), 'refill gadgets'),
      keyRow(k(t.cycleTimeScale), 'cycle time scale'),
      keyRow(k(t.toggleWardenGround), 'toggle warden ground'),
      keyRow(k(t.runAutoTests), `run AUTO suite (${this._autoTests.length})`),
      keyRow(k(t.runRegressionSet), `run regression set (${CONFIG.debug.regressionSet.join(', ')})`),
      '<div class="bl-sep"></div>',
    ];
    for (let i = 0; i < this._testLog.length; i++) {
      const cls = i === 0 ? 'bl-log-latest' : 'bl-log';
      parts.push(`<div class="${cls}">${escapeHtml(this._testLog[i])}</div>`);
    }
    this.testEl.innerHTML = parts.join('');
  }

  _countShadowLights() {
    const scene = this.harness.scene;
    if (!scene) return 0;
    let count = 0;
    scene.traverse((object) => {
      if (object.isLight && object.castShadow) count++;
    });
    return count;
  }

  // -------------------------------------------------------------------------
  // Runtime assertions (Section 17)
  // -------------------------------------------------------------------------

  /**
   * @param {string} name
   * @param {() => (string|null)} fn returns a failure message, or null if fine
   */
  registerAssertion(name, fn) {
    this._assertions.set(name, fn);
  }

  /** Called from the fixed step. Throttled by CONFIG.debug.assertionInterval. */
  step() {
    if (!DEBUG || this._assertions.size === 0) return;
    this._assertionStepCounter++;
    if (this._assertionStepCounter % CONFIG.debug.assertionInterval !== 0) return;

    for (const [name, fn] of this._assertions) {
      let message = null;
      try {
        message = fn();
      } catch (error) {
        message = `assertion threw: ${error && error.message}`;
      }
      if (message) this._reportAssertion(name, message);
    }
  }

  _reportAssertion(name, message) {
    this.assertionFailures++;
    const key = `${name}: ${message}`;
    const seen = this._assertionMessages.get(key) || 0;
    if (seen < CONFIG.debug.assertionLogLimit) {
      this._assertionMessages.set(key, seen + 1);
      const suffix = seen + 1 === CONFIG.debug.assertionLogLimit ? ' (further repeats suppressed)' : '';
      console.error(`[ASSERT] ${key}${suffix}`);
    }
  }

  // -------------------------------------------------------------------------
  // AUTO test suite (Section 16, Section 17.1 "Y")
  // -------------------------------------------------------------------------

  /**
   * @param {object} test
   * @param {string} test.id short slug
   * @param {string} test.name human description
   * @param {string} test.spec which Section 16 check this covers
   * @param {(harness: object) => Promise<{pass: boolean, detail: string}>} test.run
   */
  registerAutoTest(test) {
    this._autoTests.push(test);
  }

  /**
   * Which Section 16 checks a registered test covers, read out of its `spec`
   * string ("Section 6.1 / check 1", "checks 23, 24, 25").
   *
   * Parsed rather than declared in a second field, because a second field is
   * one more thing to forget to update — and every check already states which
   * spec check it is for, in the line it prints.
   *
   * @returns {number[]}
   */
  checksCovered(test) {
    const found = new Set();
    const spec = String(test.spec || '');
    const groups = spec.match(/checks?\s*[\d,\s]+(?:and\s*\d+)?/gi) || [];
    for (const group of groups) {
      for (const digits of group.match(/\d+/g) || []) found.add(Number(digits));
    }
    return [...found];
  }

  /**
   * Section 16: "Regression set after any patch: 1, 3, 9, 13, 17, 20, 22, 23,
   * 27." Runs only the checks covering those, and says which of them no AUTO
   * check covers — a regression run that silently skips half the set is worse
   * than not having one.
   */
  runRegressionSet() {
    const wanted = new Set(CONFIG.debug.regressionSet);
    const covered = new Set();
    const subset = this._autoTests.filter((test) => {
      const hits = this.checksCovered(test).filter((number) => wanted.has(number));
      for (const hit of hits) covered.add(hit);
      return hits.length > 0;
    });
    const uncovered = [...wanted].filter((number) => !covered.has(number));
    if (uncovered.length) {
      console.log(
        `%c[regression] no AUTO check covers Section 16 check${uncovered.length > 1 ? 's' : ''} `
        + `${uncovered.join(', ')} — run ${uncovered.length > 1 ? 'those' : 'that'} by hand `,
        'background:#f5c451;color:#08090b'
      );
    }
    return this.runAutoTests({ subset, label: `REGRESSION SET (${[...wanted].join(', ')})` });
  }

  /**
   * Run registered AUTO checks and print a pass/fail line each.
   * @param {object} [options]
   * @param {object[]} [options.subset] run only these, defaults to all
   * @param {string} [options.label] banner text
   */
  async runAutoTests(options = {}) {
    if (this._autoRunning) {
      console.warn('[AUTO] suite already running');
      return null;
    }
    const tests = options.subset || this._autoTests;
    const label = options.label || 'AUTO SUITE';
    this._autoRunning = true;
    this._log(`running ${label.toLowerCase()} (${tests.length})`);

    const results = [];
    console.log(
      `%c BLACKLINE ${label}  seed=${rng.seed}  checks=${tests.length} `,
      'background:#2fd6c3;color:#08090b;font-weight:bold'
    );

    for (const test of tests) {
      let result;
      const started = performance.now();
      try {
        result = await test.run(this.harness);
        if (!result || typeof result.pass !== 'boolean') {
          result = { pass: false, detail: 'test returned no verdict' };
        }
      } catch (error) {
        result = { pass: false, detail: `threw: ${error && error.message}` };
      }
      const ms = performance.now() - started;
      results.push({ id: test.id, spec: test.spec, ...result });
      const tag = result.pass ? 'PASS' : 'FAIL';
      const colour = result.pass ? 'color:#4ade80' : 'color:#f87171;font-weight:bold';
      console.log(
        `%c[${tag}]%c ${test.id.padEnd(26)} ${String(test.spec).padEnd(22)} ${result.detail}  (${ms.toFixed(1)}ms)`,
        colour,
        'color:inherit'
      );
    }

    const passed = results.filter((r) => r.pass).length;
    const failed = results.length - passed;
    console.log(
      `%c ${passed} passed, ${failed} failed `,
      failed === 0
        ? 'background:#4ade80;color:#08090b;font-weight:bold'
        : 'background:#f87171;color:#08090b;font-weight:bold'
    );
    this._log(`${label}: ${passed} passed, ${failed} failed`);

    this._autoRunning = false;
    return { passed, failed, results };
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function row(label, value, cls = '') {
  return `<div class="bl-row ${cls}"><span>${label}</span><span>${escapeHtml(value)}</span></div>`;
}

function keyRow(key, label) {
  return `<div class="bl-row"><span class="bl-key">${escapeHtml(key)}</span><span>${escapeHtml(label)}</span></div>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
}
