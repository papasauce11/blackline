/**
 * BLACKLINE - tests/pipelinewait.js
 *
 * Who pays for the software renderer's tail (F11, D48).
 *
 * F11 measured a third of every headless run inside one `gl.getError()` in
 * `a-zero-size-viewport-does-not-blind-the-renderer`: 265s on the plant and
 * 149s on the yard, while everything else that check does comes to under
 * 50ms. The call is the suite's first GL synchronisation, and a
 * synchronisation waits for the pipelines the whole run has queued to finish
 * building - so the check was paying for its 167 predecessors, and the one
 * number a reader of the report had was that check's name against 265s.
 *
 * D48 answered it: the suite waits, the suite reports the number, and no
 * check carries a wait it did not cause. This check holds that arrangement,
 * in the four places it can be taken back out:
 *
 *   - `AutoSuite.drainPipeline()` exists, answers with its own ms, leaves the
 *     GL error state clear behind it, and BEATS while it waits. The beat is
 *     not decoration: a wait that stands still is a wait the headless
 *     runner's `--stall` cannot tell from a hang, and bringing that budget
 *     down from 600s to 240s is what moving the number was for.
 *   - A check that declares `glSync: true` is drained for by the runner
 *     before its own clock starts; a check that declares nothing is not. Both
 *     halves are asserted, because the first alone would pass just as well if
 *     the runner drained before every check - which F11 measured at 236s of
 *     added run.
 *   - A top-level `runChecks` drains once more after its last check and
 *     returns the total as `pipelineWaitMs`, which `scripts/suite.mjs` prints
 *     beside the run's ms.
 *   - And the check the wait was found in still asks for the drain. That line
 *     is one word long and is the whole of what keeps its 265s off its own
 *     clock.
 *
 * A nested `runChecks` deliberately does NOT drain at the end. A check that
 * drives the runner itself - the lost-context check in `fuzz.js`, and this
 * one - would otherwise pay inside its own clock the very tail this
 * arrangement exists to take off a check.
 *
 * Registered after `fuzz.js` on purpose: by then the run's tail has been paid
 * once, so the drains here answer in milliseconds rather than re-measuring
 * it. Ahead of it the check would still be correct, only slow.
 */

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-pipeline-wait-is-the-runs-number-and-not-a-checks',
    spec: 'Section 17.1 (the AUTO suite), F11, D48',
    name: 'The suite drains the renderer pipeline for the checks that ask, beats while it waits, and gives the ms to the run',
    run: async (h) => {
      const problems = [];
      const suite = h.debugTools.suite;
      const state = h.debugState;
      const gl = h.renderer.getContext();

      if (typeof suite.drainPipeline !== 'function') {
        return {
          pass: false,
          detail: 'AutoSuite has no drainPipeline(): the renderer tail is back on whichever check synchronises first (F11, D48)',
        };
      }

      // 1. The drain itself. The beat is read the moment it returns, because
      // `suiteProgress` is one object mutated in place and the nested run
      // below moves it on.
      const seqBefore = state.suiteProgress ? state.suiteProgress.seq : 0;
      const ms = await suite.drainPipeline('a check of the drain');
      const beat = state.suiteProgress || {};
      const beats = beat.seq - seqBefore;
      const phaseAfter = beat.phase;
      const waitMsAfter = beat.waitMs;
      if (!Number.isFinite(ms) || ms < 0) problems.push(`drainPipeline answered ${ms}`);
      if (beats < 2) problems.push(`the drain published ${beats} beat(s); a wait that does not beat cannot be told from a hang`);
      if (phaseAfter !== 'pipeline-waited') problems.push(`the beat after the drain says phase "${phaseAfter}", not pipeline-waited`);
      if (!Number.isFinite(waitMsAfter)) problems.push(`the beat after the drain carries waitMs ${waitMsAfter}`);
      if (gl.getError() !== 0) problems.push('the drain left a GL error behind it, so the next check inherits it');

      // 2. Who it is done for. Two inline checks through the real runner, one
      // asking and one not, each reading the phase it was entered under.
      const seen = {};
      const asked = {
        id: 'inline-a-check-that-asks-to-be-drained-for',
        spec: 'F11',
        glSync: true,
        run: () => {
          seen.asked = (state.suiteProgress || {}).phase;
          return { pass: true, detail: 'entered' };
        },
      };
      const plain = {
        id: 'inline-a-check-that-asks-for-nothing',
        spec: 'F11',
        run: () => {
          seen.plain = (state.suiteProgress || {}).phase;
          return { pass: true, detail: 'entered' };
        },
      };
      const nested = await suite.runChecks([asked, plain]);
      if (seen.asked !== 'pipeline-waited') problems.push(`a glSync check was entered under phase "${seen.asked}", so nothing was drained for it`);
      if (seen.plain !== 'running') problems.push(`a check asking for nothing was entered under phase "${seen.plain}"; every check is being drained for, which F11 measured at 236s of added run`);
      if (!Number.isFinite(nested.pipelineWaitMs)) problems.push(`runChecks answered pipelineWaitMs ${nested.pipelineWaitMs}`);
      if (nested.results.length !== 2) problems.push(`the nested run returned ${nested.results.length} results for 2 checks`);

      // 3. The drain after the last check of a run - the one clause the whole
      // of F16 rests on, and the one `runChecks` above cannot show, because a
      // nested run deliberately skips it. Driven through the private method
      // with `top` forced, which is the only way a check running inside a run
      // can be a top-level run. Cheap here: clause 1 drained a moment ago.
      const tail = {
        id: 'inline-the-last-check-of-a-top-level-run',
        spec: 'F16',
        run: () => ({ pass: true, detail: 'entered' }),
      };
      const top = await suite._runChecks([tail], true);
      const closing = state.suiteProgress || {};
      if (closing.phase !== 'pipeline-waited') {
        problems.push(`a top-level run ended under phase "${closing.phase}"; nothing was drained after its last check, so the run leaves its tail for the next run of this map to carry (F16)`);
      }
      if (!Number.isFinite(top.pipelineWaitMs)) problems.push(`a top-level runChecks answered pipelineWaitMs ${top.pipelineWaitMs}`);

      // 4. And the runner says how far apart the runs of a map are. Read as
      // text, the way `tests/registry.js` reads the registrar: the number is
      // computed in node and never reaches the page, so the contract is all a
      // check here can hold - and it is worth holding, because the pairs on
      // record from F5 to F11 differed by 100-190s and nothing ever said so.
      const runner = await (await fetch(`${location.origin}/scripts/suite.mjs`)).text();
      for (const wanted of ['spreadMs', 'waitSpreadMs', 'spreads']) {
        if (runner.indexOf(wanted) === -1) problems.push(`scripts/suite.mjs no longer computes ${wanted}: the report stops saying how far apart the runs of a map are (F16)`);
      }

      // 5. And the check the wait was found in still asks.
      const found = h.debugTools._autoTests.find((test) => test.id === 'a-zero-size-viewport-does-not-blind-the-renderer');
      if (!found) problems.push('a-zero-size-viewport-does-not-blind-the-renderer is not registered');
      else if (!found.glSync) problems.push('a-zero-size-viewport-does-not-blind-the-renderer no longer declares glSync: the renderer tail is back on its own clock, and the report calls a 265s wait a 265s check');

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `the drain answered in ${Math.round(ms)}ms across ${beats} beats and left the error state clear, `
            + `a glSync check is entered after one and a plain check is not, a top-level run drains `
            + `after its last check, and the run carries ${Math.round(nested.pipelineWaitMs)}ms of wait `
            + `for the two`
          : problems.join('; '),
      };
    },
  });
}
