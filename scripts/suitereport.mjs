// BLACKLINE - scripts/suitereport.mjs
//
// The verdict and the summary: everything scripts/suite.mjs does with the runs
// once they are over, and nothing that drives a browser. Split out at H10,
// which took suite.mjs past the ~600 lines PLAN.md allows a module - the
// judging and the printing are the half of that file with no Chrome in it, and
// the half a reader comes to when they want to know what "OK" meant.
//
// Nothing here has state. `judge()` takes the runs and returns the report;
// `summary()` turns that report into the lines on stderr. Both read two files
// from the checkout - QUEUE.md's Deliberately-red list and
// scripts/suite-skips.json - and that is deliberate: the rules a run is judged
// by belong to the commit you are on, not to the page that was loaded (which is
// what makes `--url` judge a deployed copy by these rules).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

// Judged per map: "flaky" is a check answering differently between two runs
// on the SAME map, and a check red on one map and green on another is red
// there, with the map named.
export function judge(runs, renderer, consoleErrors) {
  const expected = new Set(expectedRedIds());
  const skips = skipsById();
  const maps = [...new Set(runs.map(r => r.map))];

  const red = [], expectedRed = [], flaky = [], skipped = [], unexpectedGreen = [], skipsWithheld = [];
  for (const map of maps) {
    const own = runs.filter(r => r.map === map);
    const ids = [...new Set(own.flatMap(r => r.results.map(x => x.id)))];
    const byRun = own.map(r => new Map(r.results.map(x => [x.id, x])));
    // Green on every run of this map, or no skip is honoured here. Absent
    // counts as not green - a --subset that names a skipped check and not
    // this one judges that check like any other, which is the rule working.
    const guardGreen = byRun.every(m => m.get(SKIP_GUARD)?.pass === true);
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
      contextLosses: r.contextLosses, rerun: r.rerun, loopFrames: r.loopFrames,
    })),
    spreads,
    red,
    flaky,
    expectedRed,
    unexpectedGreen,
    skipped,
    skipsWithheld,
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
  }
  for (const s of r.spreads ?? []) {
    if (s.runs < 2) continue;
    const share = s.longestMs ? Math.round((100 * s.spreadMs) / s.longestMs) : 0;
    lines.push(`    ${s.map}: ${s.runs} runs spread ${s.spreadMs}ms (${share}% of the longest),`
      + ` pipeline wait spread ${s.waitSpreadMs}ms - two runs of a map are comparable only while this is small (F16)`);
  }
  for (const run of r.runs) {
    const q = run.quality;
    if (!q) continue;
    lines.push(`    ${run.map}: drawing ${q.level} quality (${q.source}), ${q.buffer ? q.buffer.join('x') : '?'} buffer, `
      + `${q.shadowMapSize} shadow map, post ${q.post ? 'on' : 'off'}`
      + `${q.probe ? ` - auto would pick ${q.probe.pick} here (${q.probe.why})` : ', probe still measuring'}`);
    break;
  }
  if (r.red.length) lines.push(`  RED (unexpected): ${r.red.map(tag).join(', ')}`);
  if (r.flaky.length) lines.push(`  FLAKY: ${r.flaky.map(tag).join(', ')}`);
  if (r.expectedRed.length) lines.push(`  expected red: ${r.expectedRed.map(tag).join(', ')}`);
  if (r.unexpectedGreen.length) lines.push(`  now GREEN, remove from QUEUE.md: ${r.unexpectedGreen.join(', ')}`);
  if (r.skipped.length) lines.push(`  skipped headless: ${r.skipped.map(x => `${tag(x)} (${x.outcome})`).join(', ')}`);
  if (r.skipsWithheld && r.skipsWithheld.length) {
    lines.push(`  SKIPS WITHHELD: ${r.skipsWithheld.map(tag).join(', ')} - ${SKIP_GUARD} did not pass there, so nothing is skipped and each was judged`);
  }
  if (r.consoleErrors.count) lines.push(`  console errors: ${r.consoleErrors.count}`);
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
