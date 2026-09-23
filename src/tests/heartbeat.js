/**
 * BLACKLINE - tests/heartbeat.js
 *
 * AUTO suite: F10, a hung gate must die and say so.
 *
 * The headless runner drives a whole run from one `page.evaluate`, which
 * takes no timeout and is not covered by `page.setDefaultTimeout`. Before
 * F10 a check that hung in the page - one awaiting a promise that never
 * settles, or `h.nextFrame()` where frames never fire - wedged the runner
 * with no output, the `finally` that closes Chrome never ran, and node plus
 * a SwiftShader Chrome were left spinning. One of those was found alive four
 * days after the build that started it, competing for the pinned cores with
 * every run timed since.
 *
 * The fix has a page-side half and a runner-side half. This file holds the
 * page-side half to account: `AutoSuite.beat()` publishes a monotonic `seq`,
 * the count done, the run's total and the id of the check in flight on
 * `debugState.suiteProgress`, one beat before every check and one after. The
 * runner polls that from a second evaluate and kills a run whose heartbeat
 * stands still for the stall budget, naming the check that stopped. The
 * budget is against the heartbeat standing still rather than against
 * wall-clock total, because a cold plant run is legitimately 850s and slow
 * must never be mistaken for hung.
 *
 * The check below drives the real runner (`suite.runChecks`, the same path
 * the suite takes) with three probes that each copy the beat they are run
 * under, and asks that the sequence only goes up, that the count matches,
 * and that every probe was named while it was the one running. It also asks
 * the beat it is itself running under to name it.
 *
 * The staged hang at the bottom is the runner-side half's demonstration and
 * is registered only when the page is asked for it (`?hang=1`, which the
 * runner appends with `--query`), so the gate never carries a check that
 * cannot finish.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

/** This check's own id, asserted against the beat it runs under. */
const SELF = 'the-suite-heartbeat-advances-and-names-the-check-in-flight';

/**
 * The published beat, copied. It is mutated in place, so a held reference
 * reads the next check's numbers rather than this one's.
 *
 * @param {object} h the harness
 * @returns {object|null}
 */
function beatOf(h) {
  const p = h.debugState.suiteProgress;
  if (!p) return null;
  return { seq: p.seq, done: p.done, total: p.total, inFlight: p.inFlight, last: p.last, phase: p.phase, map: p.map };
}

/** `?hang=1` - the staged hang, asked for on purpose and never by the gate. */
function stagedHangRequested() {
  if (typeof location === 'undefined') return false;
  return new URLSearchParams(location.search).get('hang') === '1';
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: SELF,
    spec: 'Section 17.1, amended (20.33; F10)',
    name: 'The suite publishes a monotonic heartbeat naming the check in flight, so a watcher can tell slow from hung',
    run: async (h) => {
      const problems = [];
      const suite = h.debugTools.suite;

      // This check is in flight, run by the same `_runChecks` every check is
      // run by: the beat must already name it. Nothing else proves that the
      // id published is the id of the check actually running.
      const outer = beatOf(h);
      if (!outer) return { pass: false, detail: 'debugState.suiteProgress is not published at all' };
      if (outer.inFlight !== SELF) problems.push(`the beat this check runs under names "${outer.inFlight}", not this check`);
      if (outer.map !== h.map.id) problems.push(`the beat names map "${outer.map}", the page is on "${h.map.id}"`);
      if (!(outer.total >= 1)) problems.push(`the beat gives the run a total of ${outer.total}`);

      // Three probes through the real runner, each copying the beat it is
      // run under. A subset of three is what the runner asks for with
      // --subset, and the beat has to advance across it.
      const ids = ['heartbeat-probe-a', 'heartbeat-probe-b', 'heartbeat-probe-c'];
      const seen = [];
      const probes = ids.map((id, i) => ({
        id,
        spec: 'F10',
        run: async () => { seen.push(beatOf(h)); return { pass: true, detail: `probe ${i + 1}` }; },
      }));

      const before = beatOf(h).seq;
      const { results } = await suite.runChecks(probes);
      const after = beatOf(h).seq;

      if (results.length !== ids.length) problems.push(`${results.length} of ${ids.length} probes returned a result`);
      if (seen.length !== ids.length) problems.push(`${seen.length} of ${ids.length} probes saw a beat`);

      // Named, counted, and totalled - while it was the one running.
      for (let i = 0; i < seen.length; i++) {
        const b = seen[i];
        if (b.inFlight !== ids[i]) problems.push(`probe ${i + 1} ran under a beat naming "${b.inFlight}"`);
        if (b.done !== i) problems.push(`probe ${i + 1} ran with ${b.done} done, expected ${i}`);
        if (b.total !== ids.length) problems.push(`probe ${i + 1} ran with a total of ${b.total}, expected ${ids.length}`);
      }

      // Monotonic, and it moved: a heartbeat that repeats a number is a
      // heartbeat a deadline reads as a stall.
      const seq = [before, ...seen.map((b) => b.seq), after];
      for (let i = 1; i < seq.length; i++) {
        if (!(seq[i] > seq[i - 1])) problems.push(`the sequence went ${seq[i - 1]} -> ${seq[i]}`);
      }
      // One beat before each probe and one after, so three probes move it by
      // at least six. Fewer would mean a boundary is not published.
      if (after - before < ids.length * 2) {
        problems.push(`the sequence moved ${after - before} across ${ids.length} probes, expected ${ids.length * 2} at least`);
      }

      const detail = `seq ${before} -> ${after} across ${ids.length} probes,`
        + ` named ${seen.map((b) => b.inFlight).join('/')},`
        + ` under a beat naming ${outer.inFlight} (${outer.done}/${outer.total}, map ${outer.map})`;
      return { pass: problems.length === 0, detail: problems.length ? problems.join('; ') : detail };
    },
  });

  // The staged hang. `npm run suite -- --query "hang=1" --subset a-staged-hang
  // --stall 90 --map yard` awaits a promise that never settles; the runner
  // must report `suite: crashed: run timed out`, name this check, close the
  // browser and exit 2 within the stall budget instead of waiting forever.
  // Registered only when asked for: a check that cannot finish has no
  // business in a gate.
  if (stagedHangRequested()) {
    debugTools.registerAutoTest({
      id: 'a-staged-hang-never-returns',
      spec: 'F10',
      name: 'Awaits a promise that never settles, to prove the runner kills a hung run and says which check hung',
      run: () => new Promise(() => {}),
    });
  }
}
