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

import { CONFIG, SETTINGS, rng } from '../config.js';

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
   * @param {string[]} [test.maps] the registry ids this check is for (D1):
   *   a check that names the first map's geometry - a tag, a room, a
   *   coordinate - says `['plant']`; one that reads the map it is given
   *   through `h.map` says nothing and runs everywhere
   * @param {boolean} [test.glSync] this check reads or asserts on
   *   `gl.getError()`, so the runner drains the renderer's pipeline tail
   *   before it and charges the wait to the run rather than to the check
   *   (F11, D48; `drainPipeline` says why)
   * @param {(harness: object) => Promise<{pass: boolean, detail: string}>} test.run
   */
  registerAutoTest(test) {
    this.tests.push(test);
  }

  /**
   * Which of these checks are for the map the page is on (D1). A check with
   * no `maps` is for every map; one that lists them runs only there and is
   * reported as "not for this map" elsewhere - never as a pass.
   *
   * @param {object[]} tests
   * @returns {{ tests: object[], notForMap: string[] }}
   */
  applicable(tests) {
    const id = this.harness.map ? this.harness.map.id : null;
    const forThisMap = [];
    const notForMap = [];
    for (const test of tests) {
      if (!test.maps || test.maps.indexOf(id) !== -1) forThisMap.push(test);
      else notForMap.push(test.id);
    }
    return { tests: forThisMap, notForMap };
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
   * The regression set as it stands on the map the page is on (D6): every
   * registered check that covers one of Section 16's numbers or is named by
   * id, split into the ones that run here and the ones registered for other
   * maps only, and the Section 16 numbers that no check running HERE covers.
   * `runRegressionSet` runs the first list and says the rest out loud;
   * `the-regression-set-resolves-to-real-checks` holds the shape, and since
   * D7 holds the last two lists empty on every map (tests/anymap.js).
   *
   * @returns {{ subset: object[], notForMap: object[], uncovered: number[] }}
   */
  regressionSet() {
    const wanted = new Set(CONFIG.debug.regressionSet);
    const byId = new Set(CONFIG.debug.regressionChecks);
    const all = this.tests.filter((test) => (
      this.checksCovered(test).some((number) => wanted.has(number)) || byId.has(test.id)
    ));
    const { tests: subset } = this.applicable(all);
    const here = new Set(subset);
    const covered = new Set();
    for (const test of subset) {
      for (const number of this.checksCovered(test)) if (wanted.has(number)) covered.add(number);
    }
    return {
      subset,
      notForMap: all.filter((test) => !here.has(test)),
      uncovered: [...wanted].filter((number) => !covered.has(number)),
    };
  }

  /**
   * Section 16: "Regression set after any patch: 1, 3, 9, 13, 17, 20, 22, 23,
   * 27." Runs only the checks covering those, and says which of them no AUTO
   * check covers on this map — a regression run that silently skips half the
   * set is worse than not having one. Since 20.11 the redesign's contract
   * rides with it, by id (`regressionChecks`): Section 16's numbers were
   * written for marked bands, and the census and the routes are what a climb
   * is now. Since D6 the set is asked per map: a check registered for another
   * map is named, and a Section 16 number only such a check covers is a
   * number this map's regression run does not hold. Since D7 both lists
   * are empty on every registered map, and red in the suite if not.
   */
  runRegressionSet() {
    const wanted = CONFIG.debug.regressionSet;
    const { subset, notForMap, uncovered } = this.regressionSet();
    const mapId = this.harness.map ? this.harness.map.id : '?';
    if (notForMap.length) {
      console.log(
        `%c[regression] ${notForMap.length} of the set ${notForMap.length > 1 ? 'are' : 'is'} not for ${mapId}: `
        + `${notForMap.map((test) => test.id).join(', ')} `,
        'background:#f5c451;color:#08090b'
      );
    }
    if (uncovered.length) {
      console.log(
        `%c[regression] no AUTO check on ${mapId} covers Section 16 check${uncovered.length > 1 ? 's' : ''} `
        + `${uncovered.join(', ')} — run ${uncovered.length > 1 ? 'those' : 'that'} by hand `,
        'background:#f5c451;color:#08090b'
      );
    }
    return this.runAutoTests({ subset, label: `REGRESSION SET (${wanted.join(', ')})` });
  }

  /**
   * Publish where a run has got to, on `debugState.suiteProgress`, so a
   * watcher outside the page can tell a slow run from a hung one (F10).
   *
   * `seq` is the heartbeat: it only goes up, and one beat is published before
   * every check and one after, so a run that is working advances it and a run
   * wedged inside a check does not. The headless runner polls it from a
   * second `page.evaluate` and kills a run whose beat stands still for the
   * stall budget, naming `inFlight` as the check that stopped - which is why
   * the id is published and not a bare counter. The budget is against the
   * beat standing still rather than against wall-clock total, because a cold
   * plant run is legitimately 850s.
   *
   * Mutated in place rather than replaced, so a reader copies the fields it
   * wants rather than holding the object.
   *
   * @param {object} fields merged over the published beat
   * @returns {object} the beat
   */
  beat(fields) {
    const b = this.state.suiteProgress || (this.state.suiteProgress = { seq: 0 });
    b.seq++;
    b.at = Math.round(performance.now());
    Object.assign(b, fields);
    return b;
  }

  /**
   * Give up a whole task, not just a microtask.
   *
   * Publishing the beat is not enough on its own. The watcher reads it with a
   * second `page.evaluate`, which needs a task to run in, and a run of checks
   * never lets the event loop turn: `await` on an already-settled promise is
   * a microtask, so a stretch of synchronous checks holds the thread from the
   * first of them to the last and nothing outside the page can see how far it
   * has got. So the run gives up one task at every check boundary, just after
   * publishing the beat that names what is about to run, and the headless
   * runner's warm-up does the same between frames. A MessageChannel, because
   * `setTimeout` is not allowed in src/ and animation frames do not fire
   * everywhere this code runs.
   *
   * @returns {Promise<void>}
   */
  yieldTask() {
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => { channel.port1.close(); resolve(); };
      channel.port2.postMessage(0);
    });
  }

  /**
   * Wait for the software renderer to finish the pipeline work the run has
   * queued, and charge the ms to the run rather than to whichever check
   * happened to synchronise first (F11, D48).
   *
   * A third of every headless run was inside one `gl.getError()` in
   * `a-zero-size-viewport-does-not-blind-the-renderer` - 265s of 753s on the
   * plant - because a GL synchronisation waits for everything queued before
   * it, and that check was simply the first in the run to ask. The wait is
   * real and cannot be avoided: F11 measured synchronising after every check
   * at 236s of added run, and a flush at 0ms and no change at all. So D48's
   * answer is not to remove it but to name it - the suite waits, here, and
   * the report carries the number as the run's own.
   *
   * Two halves, and the first is what let `--stall` come down from 600s to
   * 240s. A fence can be POLLED: `clientWaitSync` with a zero timeout answers
   * at once, so the wait becomes a loop that yields a task and publishes the
   * heartbeat, and a run waiting four minutes on the renderer no longer looks
   * to the watcher exactly like a run wedged inside a check. The second half
   * is the bounded `getError` drain - the call F11 measured, and the one that
   * clears the error state, so a check that reads `getError` afterwards is
   * reading about itself and not about the run before it (the A1/A3 lesson).
   * Bounded at 64 reads and bailing on a lost context, because a lost context
   * answers CONTEXT_LOST_WEBGL to every call and an unbounded drain would
   * spin on it forever (F1).
   *
   * @param {string} inFlight what the wait is being paid for, for the beat
   * @returns {Promise<number>} ms the wait took
   */
  async drainPipeline(inFlight) {
    const gl = this.harness.renderer && this.harness.renderer.getContext();
    if (!gl || gl.isContextLost()) return 0;
    const started = performance.now();
    this.beat({ inFlight, phase: 'pipeline-wait', waitMs: 0 });
    if (typeof gl.fenceSync === 'function') {
      // Free, and it only says "nothing more is coming" (F11: 0ms, every time).
      gl.flush();
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (sync) {
        let announced = 0;
        for (;;) {
          if (gl.clientWaitSync(sync, 0, 0) !== gl.TIMEOUT_EXPIRED) break;
          if (gl.isContextLost()) break;
          const waited = performance.now() - started;
          if (waited > CONFIG.debug.pipelineWaitBudgetMs) break;
          // A beat four times a second rather than every poll: the watcher
          // reads it every five, and a poll is an IPC round trip already.
          if (waited - announced >= 250) {
            announced = waited;
            this.beat({ inFlight, phase: 'pipeline-wait', waitMs: Math.round(waited) });
          }
          await this.yieldTask();
        }
        gl.deleteSync(sync);
      }
    }
    for (let i = 0; i < 64 && gl.getError() !== 0; i++) {
      if (gl.isContextLost()) break;
    }
    const ms = performance.now() - started;
    this.beat({ inFlight, phase: 'pipeline-waited', waitMs: Math.round(ms) });
    return ms;
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
    const { tests, notForMap } = this.applicable(options.subset || this.tests);
    const mapId = this.harness.map ? this.harness.map.id : '?';
    const label = options.label || 'AUTO SUITE';
    this.running = true;
    this._log(`running ${label.toLowerCase()} (${tests.length}, map ${mapId})`);

    console.log(
      `%c BLACKLINE ${label}  map=${mapId}  seed=${rng.seed}  checks=${tests.length}`
      + `${notForMap.length ? `  not for this map=${notForMap.length}` : ''} `,
      'background:#2fd6c3;color:#08090b;font-weight:bold'
    );

    this.beat({ label, map: mapId, total: tests.length, done: 0, inFlight: null, phase: 'start' });
    const lossesBefore = this.state.contextLosses || 0;
    const { results, staged, pipelineWaitMs } = await this.runChecks(tests);
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
    this._log(`${label}: ${passed} passed, ${failed} failed`
      + `${notForMap.length ? `, ${notForMap.length} not for ${mapId}` : ''}`);
    if (contextLosses > 0) {
      const rerun = results.filter((r) => r.rerun).map((r) => r.id);
      this._log(`gl context lost ${contextLosses}x during the run; re-ran ${rerun.length}`);
    }
    // The renderer's tail, as the run's own number and not a check's (D48).
    // Said out loud rather than left in the report, because the reader of a
    // long run in a tab has the same question the reader of the report has.
    if (pipelineWaitMs >= 1000) {
      const line = `${Math.round(pipelineWaitMs)}ms of this run was the renderer's pipeline tail, not a check (F11)`;
      console.log(`%c[AUTO] ${line}`, 'color:#8a8f98');
      this._log(line);
    }

    this.beat({ label, map: mapId, total: tests.length, done: results.length, inFlight: null, phase: 'done' });
    this.running = false;
    return { passed, failed, results, contextLosses, pipelineWaitMs, map: mapId, notForMap };
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
   * @returns {Promise<{results: object[], staged: number, pipelineWaitMs: number}>}
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
    // And the debug gate is up for the length of the run (C1): the suite is
    // the debug tooling, and checks press F4 and the panel's keys through
    // the real path. Put back as found, so a playtest tab that ran the suite
    // from the console is a playtest tab after.
    const gateWasUp = SETTINGS.debug;
    SETTINGS.debug = true;
    // Whether this is the run or a run inside a check. Only the outer one
    // pays the tail after its last check: a check that drives `runChecks`
    // itself would otherwise pay, inside its own clock, the very wait D48
    // moved off a check (the lost-context check next door does this, and so
    // does the check that holds this arrangement).
    const top = (this._depth = (this._depth || 0) + 1) === 1;
    try {
      return await this._runChecks(tests, top);
    } finally {
      this._depth--;
      SETTINGS.debug = gateWasUp;
      if (loopWasRunning) loop.start();
    }
  }

  async _runChecks(tests, top = true) {
    const gl = this.harness.renderer && this.harness.renderer.getContext();
    const lost = () => !!(gl && gl.isContextLost()) || !!this.state.contextLost;
    const results = [];
    const retry = [];
    let staged = 0;
    // Every beat carries the total of the run publishing it, so a check that
    // drives `runChecks` itself does not leave its own count behind for the
    // run around it to report (F10).
    const total = tests.length;
    let pipelineWaitMs = 0;

    for (const test of tests) {
      this.beat({ total, done: results.length, inFlight: test.id, phase: 'running' });
      await this.yieldTask();
      // A check that reads `gl.getError()` is drained for here, before its own
      // clock starts, so the renderer's tail is the run's number and not its
      // (F11, D48). Only the checks that ask: F11 measured draining before
      // every check at 236s of added run for nothing.
      if (test.glSync) pipelineWaitMs += await this.drainPipeline(test.id);
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
      this.beat({ total, done: results.length, inFlight: null, last: test.id, phase: 'ran' });
    }

    if (retry.length) {
      this.beat({ total, done: results.length, inFlight: null, phase: 'awaiting-context' });
      const restored = await this._awaitContextRestored();
      for (const index of retry) {
        const test = tests[index];
        this.beat({ total, done: results.length, inFlight: test.id, phase: 'rerun' });
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

    // And the tail the run leaves behind. Nothing normally waits for it - the
    // page is torn down first - so it has never appeared in a number at all;
    // paid here, once, after the last check, so what the run asked the
    // renderer for is what the run is reported to have cost (D48).
    if (top) pipelineWaitMs += await this.drainPipeline('after the last check');
    return { results, staged, pipelineWaitMs };
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
