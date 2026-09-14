/**
 * BLACKLINE — ui/autosuite.js
 *
 * The AUTO test registry and runner behind the "Y" key (Section 16,
 * Section 17.1), split out of ui/debug.js when F1 pushed it past the ~600 line
 * guidance. DebugTools composes one of these and forwards to it, so every
 * check still reaches the suite as `h.debugTools.runAutoTests()` and
 * `h.debugTools._autoTests`.
 *
 * Layering (Section 3.1): ui/ may import from systems, entities and config.
 * This module imports config only.
 */

import { CONFIG, rng } from '../config.js';

export class AutoSuite {
  /**
   * @param {object} options
   * @param {object} options.debugState shared mutable field bag
   * @param {object} options.harness capabilities the AUTO suite needs
   * @param {(line: string) => void} options.log the F4 panel's command log
   */
  constructor({ debugState, harness, log }) {
    this.state = debugState;
    this.harness = harness;
    this._log = log;

    /** Registered AUTO checks, in registration order. */
    this.tests = [];
    this.running = false;
  }

  /**
   * @param {object} test
   * @param {string} test.id short slug
   * @param {string} test.name human description
   * @param {string} test.spec which Section 16 check this covers
   * @param {(harness: object) => Promise<{pass: boolean, detail: string}>} test.run
   */
  registerAutoTest(test) {
    this.tests.push(test);
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
   * than not having one. Since 20.11 the redesign's contract rides with it,
   * by id (`regressionChecks`): Section 16's numbers were written for marked
   * bands, and the census and the routes are what a climb is now.
   */
  runRegressionSet() {
    const wanted = new Set(CONFIG.debug.regressionSet);
    const byId = new Set(CONFIG.debug.regressionChecks);
    const covered = new Set();
    const subset = this.tests.filter((test) => {
      const hits = this.checksCovered(test).filter((number) => wanted.has(number));
      for (const hit of hits) covered.add(hit);
      return hits.length > 0 || byId.has(test.id);
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
    if (this.running) {
      console.warn('[AUTO] suite already running');
      return null;
    }
    const tests = options.subset || this.tests;
    const label = options.label || 'AUTO SUITE';
    this.running = true;
    this._log(`running ${label.toLowerCase()} (${tests.length})`);

    console.log(
      `%c BLACKLINE ${label}  seed=${rng.seed}  checks=${tests.length} `,
      'background:#2fd6c3;color:#08090b;font-weight:bold'
    );

    const lossesBefore = this.state.contextLosses || 0;
    const { results, staged } = await this.runChecks(tests);
    // Losses a check staged on purpose are its own business; the count that
    // matters is the ones the machine inflicted.
    const contextLosses = (this.state.contextLosses || 0) - lossesBefore - staged;

    const passed = results.filter((r) => r.pass).length;
    const failed = results.length - passed;
    console.log(
      `%c ${passed} passed, ${failed} failed `,
      failed === 0
        ? 'background:#4ade80;color:#08090b;font-weight:bold'
        : 'background:#f87171;color:#08090b;font-weight:bold'
    );
    this._log(`${label}: ${passed} passed, ${failed} failed`);
    if (contextLosses > 0) {
      const rerun = results.filter((r) => r.rerun).map((r) => r.id);
      this._log(`gl context lost ${contextLosses}x during the run; re-ran ${rerun.length}`);
    }

    this.running = false;
    return { passed, failed, results, contextLosses };
  }

  /**
   * Run checks in order and return one result each, re-running once any check
   * whose run overlapped a lost WebGL context.
   *
   * A lost context is the instrument being unplugged, not an answer: every
   * draw is a no-op and every readPixels reads black until Chrome hands the
   * context back, which it does on its own schedule. A check that ran in that
   * window is tagged `contextLost` and, once the context is restored, run
   * again with the second answer standing. Only once: a check that loses the
   * context every time it runs is a check with a real defect in it, and the
   * loss count is reported either way so a suite that keeps losing its GPU is
   * never quietly green.
   *
   * Separate from `runAutoTests` so a check can drive it directly, which is
   * how the suite proves this path without re-entering the suite. A check
   * registered with `losesContext: true` stages a loss on purpose; the loss
   * it causes is its own, counted as `staged` and never a reason to re-run it.
   *
   * @param {object[]} tests registered checks, or inline `{ id, spec, run }`
   * @returns {Promise<{results: object[], staged: number}>}
   */
  async runChecks(tests) {
    // The game must not play itself underneath the checks (F4). In a tab
    // whose animation frames fire - headless Chrome included - the live loop
    // was running the AI against an idle Shade between every `await`, so a
    // check that did not start from `initMatch` inherited a state that
    // depended on the wall clock. Stopped here, for the length of the run,
    // and put back as it was found; `initMatch` no longer restarts it.
    const loop = this.harness.loop;
    const loopWasRunning = !!(loop && loop.running);
    if (loopWasRunning) loop.stop();
    try {
      return await this._runChecks(tests);
    } finally {
      if (loopWasRunning) loop.start();
    }
  }

  async _runChecks(tests) {
    const gl = this.harness.renderer && this.harness.renderer.getContext();
    const lost = () => !!(gl && gl.isContextLost()) || !!this.state.contextLost;
    const results = [];
    const retry = [];
    let staged = 0;

    for (const test of tests) {
      const lossesBefore = this.state.contextLosses || 0;
      const lostBefore = lost();
      const result = await this._runOne(test);
      const losses = (this.state.contextLosses || 0) - lossesBefore;
      if (test.losesContext) {
        staged += losses;
      } else if (lostBefore || lost() || losses !== 0) {
        result.contextLost = true;
        retry.push(results.length);
      }
      results.push(result);
      this._printResult(result);
    }

    if (retry.length) {
      const restored = await this._awaitContextRestored();
      for (const index of retry) {
        const test = tests[index];
        if (!restored) {
          results[index].detail = `gl context lost and not restored: ${results[index].detail}`;
          continue;
        }
        const again = await this._runOne(test);
        again.contextLost = true;
        again.rerun = true;
        if (lost()) again.detail = `gl context lost again on the re-run: ${again.detail}`;
        results[index] = again;
        this._printResult(again);
      }
    }
    return { results, staged };
  }

  /**
   * One check, caught, timed, with the verdict shape enforced. Every check
   * starts from the same presentation state (no menu, HUD shown - F2), so
   * its answer does not depend on who ran before it.
   */
  async _runOne(test) {
    let result;
    const started = performance.now();
    if (typeof this.harness.resetPresentation === 'function') this.harness.resetPresentation();
    try {
      result = await test.run(this.harness);
      if (!result || typeof result.pass !== 'boolean') {
        result = { pass: false, detail: 'test returned no verdict' };
      }
    } catch (error) {
      result = { pass: false, detail: `threw: ${error && error.message}` };
    }
    return { id: test.id, spec: test.spec, ...result, ms: performance.now() - started };
  }

  _printResult(result) {
    const tag = result.pass ? 'PASS' : 'FAIL';
    const colour = result.pass ? 'color:#4ade80' : 'color:#f87171;font-weight:bold';
    const note = result.rerun ? ' [re-run after gl context loss]' : result.contextLost ? ' [gl context lost]' : '';
    console.log(
      `%c[${tag}]%c ${result.id.padEnd(26)} ${String(result.spec).padEnd(22)} ${result.detail}${note}  (${result.ms.toFixed(1)}ms)`,
      colour,
      'color:inherit'
    );
  }

  /**
   * Wait for a lost context to come back. Resolves true when it is usable,
   * false if it is still lost after the bound.
   *
   * The restore arrives as an event, so the wait is on that event rather than
   * on a clock; the bound is counted in animation frames because that is the
   * one timer this codebase allows itself outside the fixed step (no
   * setTimeout in src/). Where frames never fire - the browser pane - the
   * event is the only way out, and a context that never returns leaves the
   * suite waiting, which the headless runner's page timeout turns into a
   * crash report rather than a green run.
   */
  async _awaitContextRestored() {
    const gl = this.harness.renderer && this.harness.renderer.getContext();
    if (!gl) return false;
    if (!gl.isContextLost()) return true;
    const canvas = this.harness.renderer.domElement;
    let done = false;
    const restored = new Promise((resolve) => {
      canvas.addEventListener('webglcontextrestored', () => { done = true; resolve(true); }, { once: true });
    });
    const bound = (async () => {
      for (let i = 0; i < CONFIG.debug.contextRestoreFrames && !done; i++) await this.harness.nextFrame();
      return !gl.isContextLost();
    })();
    return Promise.race([restored, bound]);
  }
}
