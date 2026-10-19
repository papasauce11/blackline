// BLACKLINE - scripts/suitereport.mjs
//
// The verdict and the summary: everything scripts/suite.mjs does with the runs
// once they are over, and nothing that drives a browser. Split out at H10,
// which took suite.mjs past the ~600 lines PLAN.md allows a module - the
// judging and the printing are the half of that file with no Chrome in it, and
// the half a reader comes to when they want to know what "OK" meant.
//
// Nothing here has state. `judge()` takes the runs and returns the report;
// `summary()` turns that report into the lines on stderr. Both read three
// files from the checkout - QUEUE.md's Deliberately-red list,
// scripts/suite-skips.json and, since H11, scripts/bench-checks.json - and that
// is deliberate: the rules a run is judged by belong to the commit you are on,
// not to the page that was loaded (which is what makes `--url` judge a deployed
// copy by these rules).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { driftByMap, sayDrift } from './detaildrift.mjs';

/** The repo root: the directory above scripts/, as suite.mjs computes its own. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The single source of truth for what may be red: the bullet list under
// "## Deliberately red" in QUEUE.md. One backticked id per bullet.
export function expectedRedIds() {
  const q = fs.readFileSync(path.join(ROOT, 'QUEUE.md'), 'utf8');
  const start = q.indexOf('## Deliberately red');
  if (start < 0) return [];
  const rest = q.slice(start + 1);
  const endRel = rest.search(/\n(## |---)/);
  const section = endRel < 0 ? rest : rest.slice(0, endRel);
  const ids = [];
  for (const line of section.split('\n')) {
    const m = /^- `([a-z0-9-]+)`/.exec(line.trim());
    if (m) ids.push(m[1]);
  }
  return ids;
}

// The page-side check that holds scripts/suite-skips.json to what it
// declares (F15, src/tests/skiplist.js). A skip is an exemption, and an
// exemption is honoured only while the thing that polices exemptions has run
// and passed on that map: otherwise skipping this one check would take every
// other skip with it, which is the hole the pair was written to close.
export const SKIP_GUARD = 'the-headless-skip-list-holds-only-the-check-it-declares';

export function skipsById() {
  const p = path.join(ROOT, 'scripts', 'suite-skips.json');
  if (!fs.existsSync(p)) return new Map();
  const list = JSON.parse(fs.readFileSync(p, 'utf8'));
  return new Map(list.map(s => [s.id, s.reason]));
}

// H11's other list, and the reason it is a different list. A skip says "this
// machine cannot run this check". `scripts/bench-checks.json` says something
// stronger: "`npm run bench` runs this one instead, headed, on the real GPU,
// and its number is in bench/<date>.json". The frame budget sat in the skip
// list for a month with nobody owing an answer, and that is the gap the two
// lists exist to keep apart - a check this machine cannot run, against a check
// run somewhere that reports.
//
// One file, two readers: scripts/bench.mjs runs what it names and this decides
// what the gate does not count, so the bench cannot drift from the gate.
// src/tests/benchlist.js holds both ends of that from inside the page.
export const BENCH_CHECKS_FILE = path.join(ROOT, 'scripts', 'bench-checks.json');

/** Every check `npm run bench` runs, bench-only or not. */
export function benchChecks() {
  if (!fs.existsSync(BENCH_CHECKS_FILE)) return [];
  const list = JSON.parse(fs.readFileSync(BENCH_CHECKS_FILE, 'utf8'));
  return Array.isArray(list) ? list : [];
}

/** The ones the gate does not count, by id, with the reason. */
export function benchOnlyById() {
  return new Map(benchChecks()
    .filter(entry => entry && entry.benchOnly === true && typeof entry.id === 'string')
    .map(entry => [entry.id, entry.reason]));
}

// The page-side check that holds the list above, and the same rule as
// SKIP_GUARD: an exemption is honoured only where the thing that polices
// exemptions has run and passed, or the one line of JSON that moves a check to
// the bench could move the check that polices the move.
export const BENCH_GUARD = 'the-bench-only-list-holds-only-checks-the-bench-itself-runs';

/**
 * The newest bench/<date>.json, so the summary can say how old the real-GPU
 * number is. Reported and never judged: nothing in the gate can know whether
 * this machine's GPU has been asked lately, and a stale bench is a reader's
 * judgement rather than a red. Absent is the honest answer on a fresh clone.
 */
export function latestBench(dir = path.join(ROOT, 'bench')) {
  let names;
  try {
    names = fs.readdirSync(dir).filter(n => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
  } catch {
    return null;
  }
  if (!names.length) return null;
  const date = names[names.length - 1].replace(/\.json$/, '');
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(dir, `${date}.json`), 'utf8'));
    const runs = Array.isArray(doc.runs) ? doc.runs : [];
    const run = runs[runs.length - 1];
    if (!run) return null;
    const scenes = Array.isArray(run.scenes) ? run.scenes : [];
    return {
      date,
      at: run.at ?? null,
      commit: run.commit ?? null,
      gpu: run.gpu && run.gpu.renderer ? run.gpu.renderer : null,
      ok: !!run.ok,
      readings: scenes.reduce((n, s) => n + (Array.isArray(s.checks) ? s.checks.length : 0), 0),
      ids: [...new Set(scenes.flatMap(s => (Array.isArray(s.checks) ? s.checks : []).map(c => c && c.id).filter(Boolean)))],
    };
  } catch {
    return null;
  }
}

/**
 * How old the real-GPU reading is, for the weekly audit (H37). D69 put the
 * question there rather than in the gate: a red that only a headed Chrome on a
 * real GPU can clear would stop a routine that has neither. So this answers
 * and never judges - the newest file, its commit, how far HEAD has moved since,
 * and which `benchOnly` checks it holds no reading for (a check moved to the
 * bench after the last bench was taken is a check nobody has run).
 *
 * The file is named from `run.at`, which is UTC (H36), so an evening bench
 * files under the next day; `at` is returned beside it for the local time.
 */
export function benchAge(dir = path.join(ROOT, 'bench')) {
  const latest = latestBench(dir);
  const owed = [...benchOnlyById().keys()];
  if (!latest) return { latest: null, commitsSince: null, missing: owed };
  let commitsSince = null;
  if (latest.commit) {
    try {
      commitsSince = Number(execFileSync('git', ['rev-list', '--count', `${latest.commit}..HEAD`],
        { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
    } catch {
      // A commit this clone does not have: the bench was taken on another branch.
    }
  }
  return {
    latest: { date: latest.date, at: latest.at, commit: latest.commit, gpu: latest.gpu, ok: latest.ok, readings: latest.readings },
    commitsSince,
    missing: owed.filter(id => !latest.ids.includes(id)),
  };
}

/**
 * The one check that hands this file numbers beside its verdict (H63): the
 * source-line ceiling, whose cluster is printed on every run's summary because
 * a **passing** check's detail reaches nobody without `--details`.
 *
 * Named here and nowhere else, and the thresholds it measures against are
 * deliberately **not** repeated in this file - they arrive in the object, so a
 * guidance changed in `config`'s neighbourhood cannot leave this summary
 * quoting the old one. `runnerguard.js` holds that from the page: it runs the
 * check, compares its prose against its own object, and reads this source for
 * the two literals that must not be here.
 */
const CEILING_CHECK = 'no-source-file-outside-config-is-over-600-lines';

/**
 * H77: who spent the simulation's shared stream under this run.
 *
 * The runner counts it per check (`_runOne`), which is how the question "how
 * many numbers did something other than this check draw while it ran" became
 * a counter rather than an inference. Said per run because the two maps shuffle
 * circuits of different lengths and a check that opens a match spends that
 * shuffle before it steps anything.
 *
 * `underAi` is the number the question was actually about: values drawn inside
 * a fixed step the AI drove. Everything else a check spends it asked for.
 * Nothing here is a verdict - `the-simulations-stream-is-drawn-from-only-by-a-
 * decision` is the clause, and this is the reading beside it.
 */
function drawsOf(run) {
  const drew = run.results.filter(x => x.draws);
  const underAi = drew.filter(x => x.draws.underAi > 0);
  const sum = (list, key) => list.reduce((n, x) => n + x.draws[key], 0);
  if (!drew.length) return null;
  return {
    checks: drew.length,
    total: sum(drew, 'total'),
    underAi: sum(drew, 'underAi'),
    withoutAi: sum(drew, 'withoutAi'),
    underAiChecks: underAi
      .sort((a, b) => b.draws.underAi - a.draws.underAi)
      .map(x => ({ id: x.id, underAi: x.draws.underAi, total: x.draws.total })),
  };
}

// Judged per map: "flaky" is a check answering differently between two runs
// on the SAME map, and a check red on one map and green on another is red
// there, with the map named.
export function judge(runs, renderer, consoleErrors) {
  const expected = new Set(expectedRedIds());
  const skips = skipsById();
  const benchOnly = benchOnlyById();
  const maps = [...new Set(runs.map(r => r.map))];

  const red = [], expectedRed = [], flaky = [], skipped = [], unexpectedGreen = [], skipsWithheld = [];
  const benched = [], benchDropsWithheld = [];
  for (const map of maps) {
    const own = runs.filter(r => r.map === map);
    const ids = [...new Set(own.flatMap(r => r.results.map(x => x.id)))];
    const byRun = own.map(r => new Map(r.results.map(x => [x.id, x])));
    // Green on every run of this map, or no skip is honoured here. Absent
    // counts as not green - a --subset that names a skipped check and not
    // this one judges that check like any other, which is the rule working.
    const guardGreen = byRun.every(m => m.get(SKIP_GUARD)?.pass === true);
    const benchGuardGreen = byRun.every(m => m.get(BENCH_GUARD)?.pass === true);
    for (const id of ids) {
      const outcomes = byRun.map(m => m.get(id)?.pass);
      const allPass = outcomes.every(p => p === true);
      const allFail = outcomes.every(p => p === false);
      const detail = byRun.map(m => m.get(id)?.detail).find(Boolean) ?? '';
      if (skips.has(id)) {
        if (guardGreen) {
          skipped.push({ id, map, reason: skips.get(id), outcome: allPass ? 'pass' : allFail ? 'fail' : 'mixed' });
          continue;
        }
        // Withheld, and then judged like anything else, which is what makes
        // this fail closed: the skipped check goes red and the run says why.
        skipsWithheld.push({ id, map });
      }
      // The bench's, and fail closed the same way. The outcome HERE is kept
      // and printed - the frame budget reads `fail` under software GL, and a
      // reader of the gate should see that this is the number being set aside
      // rather than a check nobody ran.
      if (benchOnly.has(id)) {
        if (benchGuardGreen) {
          benched.push({ id, map, reason: benchOnly.get(id), outcome: allPass ? 'pass' : allFail ? 'fail' : 'mixed' });
          continue;
        }
        benchDropsWithheld.push({ id, map });
      }
      if (!allPass && !allFail) { flaky.push({ id, map, outcomes, detail }); continue; }
      if (allFail) {
        if (expected.has(id)) expectedRed.push({ id, map, detail });
        else red.push({ id, map, detail });
      } else if (expected.has(id)) {
        unexpectedGreen.push(id);
      }
    }
  }
  // How far apart the runs of one map are (F16). Two runs of a map share one
  // page, and until F11 the first left its renderer tail behind for the second
  // to carry: across every pair on record since F5 the second run was 100-190s
  // the slower, which made "the same suite, twice" two different measurements
  // and quietly contaminated any comparison drawn between them. Reported, not
  // judged - a spread is a reading about the machine, and a red would be a
  // threshold nobody has grounds for yet.
  const spreads = maps.map(map => {
    const own = runs.filter(r => r.map === map);
    const ms = own.map(r => r.ms);
    const waits = own.map(r => r.pipelineWaitMs || 0);
    return {
      map,
      runs: own.length,
      spreadMs: Math.max(...ms) - Math.min(...ms),
      waitSpreadMs: Math.max(...waits) - Math.min(...waits),
      longestMs: Math.max(...ms),
    };
  });
  // Which checks answered differently between the runs of one map (H79).
  // `flaky` compares verdicts, so a reading can drift twenty percent and stay
  // green, and a floor set just under one run's reading is a floor that goes
  // red on a Tuesday. **Reported and never judged**, the same as `spreads`
  // above and for the same reason: how much a reading may drift is a rule
  // nobody has argued yet, and this report is what would earn it.
  const drift = driftByMap(runs, maps);
  const loopRan = runs.some(r => r.loopFrames > 0);
  const ok = red.length === 0 && flaky.length === 0 && !loopRan;
  return {
    ok,
    renderer,
    maps,
    runs: runs.map(r => ({
      map: r.map, regression: r.regression, passed: r.passed, failed: r.failed, notForMap: r.notForMap, ms: r.ms,
      pipelineWaitMs: r.pipelineWaitMs,
      // H10: what was drawn, and what auto's probe would have picked if the
      // pin had let it. The gate is pinned to `medium` because the probe picks
      // `low` under software WebGL every time; recording the pick anyway is
      // what keeps that decision visible instead of buried in a query string.
      quality: r.quality,
      // Per **run** and not per map (H63). The cluster is read off the
      // modules the page loaded, and the two maps do not load the same set,
      // so one answer for the suite would be one map's answer printed twice -
      // which is the `break` in a summary loop that hid a whole map, one
      // currency over.
      ceiling: (r.results.find(x => x.id === CEILING_CHECK) || {}).ceiling ?? null,
      // H77, per run for the same reason the ceiling is: the circuit a match
      // opening shuffles is map data.
      draws: drawsOf(r),
      contextLosses: r.contextLosses, rerun: r.rerun, loopFrames: r.loopFrames,
    })),
    spreads,
    drift,
    red,
    flaky,
    expectedRed,
    unexpectedGreen,
    skipped,
    skipsWithheld,
    benched,
    benchDropsWithheld,
    lastBench: latestBench(),
    consoleErrors: { count: consoleErrors.length, first: consoleErrors.slice(0, 5) },
  };
}

export function summary(r) {
  const lines = [];
  lines.push(`suite: ${r.ok ? 'OK' : 'FAIL'}  renderer: ${r.renderer}`);
  const tag = x => (r.maps.length > 1 ? `${x.id} [${x.map}]` : x.id);
  for (const [i, run] of r.runs.entries()) {
    lines.push(`  run ${i + 1} (${run.map}${run.regression ? ', regression set' : ''}): ${run.passed} passed, ${run.failed} failed`
      + `${run.notForMap ? `, ${run.notForMap} not for this map` : ''}, ${run.ms}ms`
      + `${run.pipelineWaitMs ? ` (${run.pipelineWaitMs}ms of it the renderer's pipeline tail, F11)` : ''}`);
    if (run.contextLosses) {
      lines.push(`    GL CONTEXT LOST ${run.contextLosses}x during run ${i + 1}; re-ran after restore: ${run.rerun.join(', ') || 'nothing'}`);
    }
    if (run.loopFrames) {
      lines.push(`    LOOP RAN ${run.loopFrames} frame(s) under run ${i + 1}: the game played itself underneath the checks (F4)`);
    }
    // The source ceiling, on a plain `npm run suite` with no flag (H63). Every
    // number here is the check's own; nothing in this file measures a line.
    const c = run.ceiling;
    if (c) {
      lines.push(`    ceiling: ${c.count ? `${c.count} modules within ${c.within} of ${c.guidance}`
        + `, nearest ${c.nearest.path} at ${c.nearest.lines} (${c.nearest.left} left)`
        : `none within ${c.within} of ${c.guidance}`} - of ${c.modules} this run loaded`);
    }
    // H77, and a reading rather than a verdict like the drift below it: what
    // the run spent of the simulation's shared stream, and which checks had a
    // live AI spending it underneath them. Two lines a run at most, because
    // the whole list is in the report under each run's `draws`.
    const d = run.draws;
    if (d) {
      lines.push(`    rng: ${d.total} draw(s) over ${d.checks} check(s), ${d.underAi} of them under a live AI`
        + ` in ${d.underAiChecks.length} check(s) - a reading and not a verdict (H77)`);
      if (d.underAiChecks.length) {
        lines.push(`      under a live AI: ${d.underAiChecks.slice(0, 6).map(x => `${x.id} ${x.underAi}`).join(', ')}`
          + `${d.underAiChecks.length > 6 ? `, and ${d.underAiChecks.length - 6} more` : ''}`);
      }
    }
  }
  for (const s of r.spreads ?? []) {
    if (s.runs < 2) continue;
    const share = s.longestMs ? Math.round((100 * s.spreadMs) / s.longestMs) : 0;
    lines.push(`    ${s.map}: ${s.runs} runs spread ${s.spreadMs}ms (${share}% of the longest),`
      + ` pipeline wait spread ${s.waitSpreadMs}ms - two runs of a map are comparable only while this is small (F16)`);
  }
  // H79, and it is a reading rather than a verdict: one line a map saying how
  // many checks answered differently, then one line each naming the widest
  // number that moved. Ten lines of a two-map run, which is the size at which
  // a reader will actually look - the whole list, every number of it, is in
  // the report under `drift`.
  for (const d of r.drift ?? []) {
    if (d.runs < 2 || !d.count) continue;
    lines.push(`    ${d.map}: ${d.count} check(s) answered differently between the ${d.runs} runs`
      + ' - a reading and not a verdict (H79)');
    for (const entry of d.drifted) lines.push(`      ${sayDrift(entry)}`);
  }
  // One line per MAP, not one line for the whole suite (H25). This used to
  // `break` after the first run, so a two-map suite printed the plant's probe
  // and silently dropped the yard's - and the two disagree, which is the entire
  // point: the probe measures this machine *times this scene* (8.70ms and `low`
  // on the plant against 5.30ms and `medium` on the yard, H10's own verify).
  // A reader could not see that from the summary, which is how it went a month
  // without anybody noticing that the map you open first decides your level.
  const named = new Set();
  for (const run of r.runs) {
    const q = run.quality;
    if (!q || named.has(run.map)) continue;
    named.add(run.map);
    lines.push(`    ${run.map}: drawing ${q.level} quality (${q.source}), ${q.buffer ? q.buffer.join('x') : '?'} buffer, `
      + `${q.shadowMapSize} shadow map, post ${q.post ? 'on' : 'off'}`
      + `${q.probe ? ` - auto would pick ${q.probe.pick} here (${q.probe.why})` : ', probe still measuring'}`);
  }
  if (r.red.length) lines.push(`  RED (unexpected): ${r.red.map(tag).join(', ')}`);
  if (r.flaky.length) lines.push(`  FLAKY: ${r.flaky.map(tag).join(', ')}`);
  if (r.expectedRed.length) lines.push(`  expected red: ${r.expectedRed.map(tag).join(', ')}`);
  if (r.unexpectedGreen.length) lines.push(`  now GREEN, remove from QUEUE.md: ${r.unexpectedGreen.join(', ')}`);
  if (r.skipped.length) lines.push(`  skipped headless: ${r.skipped.map(x => `${tag(x)} (${x.outcome})`).join(', ')}`);
  // H11: the checks the gate does not count because something else answers
  // them, and how old that answer is. The date is the whole value of the line
  // - a bench-only check whose last reading is three weeks old is a check
  // nobody is answering, which is the state this mechanism replaced.
  if (r.benched && r.benched.length) {
    lines.push(`  bench only: ${r.benched.map(x => `${tag(x)} (${x.outcome} here)`).join(', ')}`
      + ' - `npm run bench` measures these headed, on the real GPU');
    const b = r.lastBench;
    lines.push(b
      ? `    last bench ${b.date}${b.commit ? ` (${b.commit})` : ''} on ${b.gpu ?? 'an unnamed renderer'}:`
        + ` ${b.ok ? 'OK' : 'RED'}, ${b.readings} reading${b.readings === 1 ? '' : 's'}`
      : '    NO BENCH ON RECORD in bench/ - these checks are counted nowhere until `npm run bench` is run');
  }
  if (r.benchDropsWithheld && r.benchDropsWithheld.length) {
    lines.push(`  BENCH DROPS WITHHELD: ${r.benchDropsWithheld.map(tag).join(', ')} - ${BENCH_GUARD} did not pass there,`
      + ' so nothing is handed to the bench and each was judged');
  }
  if (r.skipsWithheld && r.skipsWithheld.length) {
    lines.push(`  SKIPS WITHHELD: ${r.skipsWithheld.map(tag).join(', ')} - ${SKIP_GUARD} did not pass there, so nothing is skipped and each was judged`);
  }
  if (r.consoleErrors.count) {
    // The messages themselves, not only the count (H32). HANDOFF.md tells
    // every run that "a new console error is a defect even when every check
    // passes", and until now reading one meant parsing the JSON report - which
    // is how the intermittent `AudioContext` error got written off twice by
    // sessions that had seen only its count. Each carries the map, the run and
    // how far into it the error arrived.
    lines.push(`  console errors: ${r.consoleErrors.count}`);
    for (const message of r.consoleErrors.first) lines.push(`    ${message}`);
    if (r.consoleErrors.count > r.consoleErrors.first.length) {
      lines.push(`    ... and ${r.consoleErrors.count - r.consoleErrors.first.length} more (the report's JSON keeps the first ${r.consoleErrors.first.length})`);
    }
  }
  if (r.otherRunners && r.otherRunners.length) {
    lines.push(`  OTHER RUNNERS ALIVE: ${r.otherRunners.map(x => `pid ${x.pid} (${x.started})`).join(', ')}`
      + ` - every timing above was measured against them`);
  }
  if (r.throttle) {
    const t = r.throttle;
    lines.push(`  throttle: ${t.cores}/${t.of} cores`
      + `${t.pinnedProcesses ? ` (${t.pinnedProcesses} processes pinned)` : ''}`
      + `, ${t.cooldownMs / 1000}s cooldown between runs`);
  }
  return lines.join('\n') + '\n';
}
