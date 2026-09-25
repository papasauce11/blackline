// The headless suite runner. `npm run suite`.
//
// Serves the repo from an in-process static server, launches the installed
// Chrome headless with software WebGL, waits for the harness, warms 60 frames,
// runs the AUTO suite N times (default 2), and prints one JSON report.
// Exit 0 only if nothing is red outside QUEUE.md's "Deliberately red" list
// and every run agrees. Checks listed in scripts/suite-skips.json are
// reported but never counted, either way - but only on a map where
// SKIP_GUARD below ran and passed (F15), so the one line of JSON that drops
// a check cannot be used to drop the check that polices the list.
//
// One tiebreak, and it is the page's, not this script's: a check that ran
// while the WebGL context was lost (Chrome kills a starved GPU process on a
// loaded machine and restores the context a moment later; every draw in the
// window is a no-op and every readPixels reads black) is re-run once the
// context is back, by the suite runner in src/ui/autosuite.js. The report
// carries `contextLosses` and `rerun` per run so that is never invisible.
//
//   node scripts/suite.mjs [--runs 2] [--subset <regex>] [--regression]
//                          [--pre "<js>"] [--map plant,yard]
//                          [--channel chrome|msedge] [--timeout 600000]
//                          [--cores N] [--cooldown SECONDS] [--details FILE]
//                          [--stall SECONDS] [--stall-wait SECONDS]
//
// --map names the registered maps to run on (src/maps/index.js), comma
// separated; the page is loaded once per map with `?map=<id>` and the suite
// run N times on each. The default is every map the registry lists, read
// from that file, so a map added there is in the gate the day it lands
// (D6; until then the default was `plant` alone). The report carries `map`
// on every run and every red, flaky or skipped entry, and a run's
// `notForMap` is the checks registered for other maps only, which are never
// counted either way (D1).
// --regression runs the regression set (Section 16's numbers and the
// redesign's checks by id, `runRegressionSet()` in the page) instead of the
// whole suite: the quick gate, per map, with its time on the run line.
// --pre runs in the page before the suite, e.g. to reseed the rng.
// --details writes every check's id, outcome, detail line and ms, per run,
// to FILE as JSON - the readings a PROGRESS.md entry quotes (B8). The report
// on stdout carries only what is red, flaky or skipped.
//
// A hung run dies, and says so (F10, scripts/watchdog.mjs). The run below is
// one `page.evaluate`; it takes no `timeout` option and `setDefaultTimeout`
// does not cover it, so a check that hung in the page used to wedge this
// script with no output and leave node and a SwiftShader Chrome spinning for
// days. So the run is raced against the heartbeat the page publishes
// (`beat()` in src/ui/autosuite.js): when it stands still for --stall
// seconds the run is abandoned with `suite: crashed: run timed out` naming
// the check in flight, and exit 2. Against the beat standing still, never
// against wall-clock total: a cold plant run is legitimately 850s.
// --stall 0 disables it. SIGINT and SIGTERM close the browser and the server
// the same way, so stopping a backgrounded run stops the tree.
// --stall is 240s since D48 (it was 600s): the floor under it used to be the
// renderer's pipeline tail waited for inside one check, and that wait is the
// suite's own now, beats while it waits, and gets --stall-wait (600s) instead.
// Every run line carries how much of it was that wait.
//
// Heat. This PC renders the suite with SwiftShader, so every pixel of every
// rendered check is drawn on the CPU, and a run is a sustained all-core load
// on a 4-core i7-2600 whose fans are owned by OEM firmware Windows cannot
// reach (no ACPI thermal zone, no Win32_Fan). Two levers, both defaulted on:
//
//   --cores N     pin the browser and its children to the first N logical
//                 CPUs. Contiguous on purpose: on a hyperthreaded part the
//                 logical CPUs are enumerated in sibling pairs, so the low
//                 half of the mask leaves whole physical cores idle rather
//                 than merely idling their second thread. 0 disables.
//   --cooldown S  pause between runs so the heatsink catches up instead of
//                 taking one continuous soak. Does not apply after the last.
//
// Neither changes what any check answers - they cost wall-clock, nothing
// else. Windows exposes no temperature here, so the effect is not measurable
// from this script; watch it in SpeedFan if you want the number.
//
// The server and the launch below are also scripts/headless.mjs's, which
// shot.mjs and probe.mjs import (F9); this file runs the suite on import
// and adds the throttle token to the launch, so it keeps its own. Keep the
// two in step: a MIME type or a Chrome flag added here is added there.

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createGuard, otherRunners } from './watchdog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = parseArgs(process.argv.slice(2));
const RUNS = Number(args.runs ?? 2);
const CHANNEL = args.channel ?? 'chrome';
const TIMEOUT = Number(args.timeout ?? 600000);
const SUBSET = args.subset ? new RegExp(args.subset) : null;
const PRE = args.pre ?? null;
const QUERY = args.query ?? null; // e.g. "seed=20260908", appended to the page URL
const REGRESSION = !!args.regression;
const MAPS = args.map
  ? String(args.map).split(',').map(s => s.trim()).filter(Boolean)
  : registeredMapIds();
const DETAILS = args.details ?? null;
// Half the logical CPUs by default, never fewer than two - one core cannot
// run a browser and a compositor without the page timing out.
const CORES = Number(args.cores ?? Math.max(2, Math.floor(os.cpus().length / 2)));
const COOLDOWN_MS = Number(args.cooldown ?? 45) * 1000;
// How long the page's heartbeat may stand still before the run is called
// hung. A check runs to completion without yielding to the watcher, so the
// gap between two beats is one whole check, and the slowest single check is
// the floor under this number: `every-route-reads-lit-from-its-foot` at 76s,
// which four minutes clears three times over. It was ten minutes until D48,
// because the real floor was not a check at all but the renderer's pipeline
// tail waited for inside one - 265s, and rising with the run. That wait is
// the suite's own now (F11), it polls a fence so it beats while it waits, and
// it carries its own budget below. Read the per-check ms in --details before
// tightening this.
const STALL_MS = Number(args.stall ?? 240) * 1000;
// And the budget while the beat says the suite is waiting on the renderer
// rather than running a check. Separate because the two are different things:
// this one is a wait that is allowed to be minutes long and says so, and it
// is still bounded, so a GL call that never returns is still called hung.
const WAIT_STALL_MS = Number(args['stall-wait'] ?? 600) * 1000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Playwright's Browser, unlike Puppeteer's, does not hand back the OS process.
// So the launch carries a switch Chrome does not know and therefore ignores,
// and the browser process is the one whose command line contains it. Only the
// root has to be found this way - the renderers are its children.
const TOKEN = `blackline-suite-${process.pid}-${Date.now()}`;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2',
};

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

// Every map the registry lists, in its order: the `{ id: '...' }` entries of
// REGISTRY in src/maps/index.js, read as text because that module imports
// three.js through the page's import map and node cannot load it. One
// source of truth for what a map is, so the gate cannot forget one.
function registeredMapIds() {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'maps', 'index.js'), 'utf8');
  const start = src.indexOf('const REGISTRY = [');
  const end = src.indexOf('];', start);
  if (start < 0 || end < 0) throw new Error('src/maps/index.js: REGISTRY not found');
  const ids = [];
  for (const m of src.slice(start, end).matchAll(/\{\s*id:\s*'([a-z0-9-]+)'/g)) ids.push(m[1]);
  if (!ids.length) throw new Error('src/maps/index.js: REGISTRY lists no maps');
  return ids;
}

// The single source of truth for what may be red: the bullet list under
// "## Deliberately red" in QUEUE.md. One backticked id per bullet.
function expectedRedIds() {
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
const SKIP_GUARD = 'the-headless-skip-list-holds-only-the-check-it-declares';

function skipsById() {
  const p = path.join(ROOT, 'scripts', 'suite-skips.json');
  if (!fs.existsSync(p)) return new Map();
  const list = JSON.parse(fs.readFileSync(p, 'utf8'));
  return new Map(list.map(s => [s.id, s.reason]));
}

/**
 * Pin the browser and every descendant to the first `cores` logical CPUs.
 *
 * Children inherit the parent's affinity mask on Windows, so setting it before
 * the first page is created is usually enough; it is re-applied once the
 * harness is up because Chrome spawns its renderer and GPU processes lazily
 * and a late one would otherwise run wide.
 *
 * Best-effort by design: a failure here costs heat, not correctness, so it
 * reports to stderr and the suite carries on.
 *
 * @returns {number|null} processes pinned, or null if unavailable
 */
function pinToCores(token, cores) {
  if (process.platform !== 'win32' || !cores || cores >= os.cpus().length) return null;
  const mask = (1 << cores) - 1;
  const script = [
    '$ErrorActionPreference = "SilentlyContinue"',
    '$all = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name, CommandLine',
    // Name-filtered: this very script's command line also contains the token.
    `$root = $all | Where-Object { $_.Name -in @("chrome.exe","msedge.exe") -and $_.CommandLine -like "*${token}*" }`,
    'if (-not $root) { Write-Output 0; exit }',
    `$want = New-Object 'System.Collections.Generic.HashSet[int]'`,
    'foreach ($r in $root) { [void]$want.Add([int]$r.ProcessId) }',
    '$grew = $true',
    'while ($grew) { $grew = $false; foreach ($p in $all) {',
    '  if ($want.Contains([int]$p.ParentProcessId) -and -not $want.Contains([int]$p.ProcessId)) {',
    '    [void]$want.Add([int]$p.ProcessId); $grew = $true } } }',
    '$n = 0',
    'foreach ($id in $want) { try {',
    `  (Get-Process -Id $id -ErrorAction Stop).ProcessorAffinity = [IntPtr]${mask}; $n++`,
    '} catch { } }',
    'Write-Output $n',
  ].join('\n');
  try {
    const out = execFileSync('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'ignore'] });
    const n = Number(String(out).trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    // No favicon in the repo; a 404 here would count as a console error.
    if (rel === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(data);
    });
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/**
 * The deadline, the teardown and the signal handlers (F10). Made here rather
 * than inside main() so its signal handlers are up before the browser is.
 */
const guard = createGuard({ stallMs: STALL_MS, waitStallMs: WAIT_STALL_MS });

/** What the page said before a crash, so a module that failed to load names itself. */
const bootErrors = [];

async function main() {
  // Before anything is launched: an older runner's Chrome invalidates every
  // timing below, and a routine cannot clear one (the sandbox refuses
  // taskkill), so the report has to name it rather than leave the reader to
  // infer why a run was slow.
  const leaked = otherRunners();
  for (const r of leaked) {
    process.stderr.write(`suite: WARNING: another suite.mjs is still running (pid ${r.pid}, started ${r.started}).`
      + ` Its headless Chrome competes for the same cores, so every timing below is measured against it.`
      + ` End it with: taskkill /PID ${r.pid} /T /F\n`);
  }

  const { server, port } = await serve();
  guard.attach({ server });
  const consoleErrors = bootErrors;
  const browser = await chromium.launch({
    channel: CHANNEL,
    headless: true,
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--mute-audio',
      '--autoplay-policy=no-user-gesture-required',
      `--${TOKEN}`,
    ],
  });
  guard.attach({ browser });
  let report;
  const runs = [];
  let pinned = null;
  try {
    // Before the first page, so the renderers inherit the mask rather than
    // having to be caught afterwards.
    pinned = pinToCores(TOKEN, CORES);

    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.setDefaultTimeout(TIMEOUT);
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const at = m.location && m.location().url;
      consoleErrors.push(at ? `${m.text()} @ ${at}` : m.text());
    });
    page.on('pageerror', e => consoleErrors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', r => consoleErrors.push(`request failed: ${r.url()} (${r.failure()?.errorText})`));

    let renderer = null;
    // One page load per map (D1): the world is built on the map at boot and
    // a system never sees it change, so another map is another load.
    for (const [m, mapId] of MAPS.entries()) {
      if (m > 0 && COOLDOWN_MS > 0) await sleep(COOLDOWN_MS);
      const query = [QUERY, `map=${mapId}`].filter(Boolean).join('&');
      await page.goto(`http://127.0.0.1:${port}/?${query}`, { waitUntil: 'load' });
      await page.waitForFunction(() => !!window.BLACKLINE, null, { timeout: 60000 });
      // The live loop plays the game between runs and under any check that
      // yields (F4 measured ~135 frames of the AI hunting an idle Shade in one
      // cooldown). Every frame this runner wants, it drives itself.
      await page.evaluate(() => window.BLACKLINE.loop.stop());
      // The registry falls back to the default map on an id it does not
      // know, so a typo here must not be a green run on the wrong map.
      const booted = await page.evaluate(() => window.BLACKLINE.map.id);
      if (booted !== mapId) throw new Error(`asked for map "${mapId}", the page booted "${booted}"`);

      renderer = renderer ?? await page.evaluate(() => {
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl2') || c.getContext('webgl');
        if (!gl) return 'no webgl';
        const d = gl.getExtension('WEBGL_debug_renderer_info');
        return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown';
      });

      if (PRE) await page.evaluate(PRE);

      // The renderer and GPU processes exist by now; catch any that were spawned
      // after the mask was set.
      pinned = pinToCores(TOKEN, CORES) ?? pinned;
      if (m === 0 && CORES && CORES < os.cpus().length && pinned === null) {
        process.stderr.write(`suite: could not pin to ${CORES} cores; running wide\n`);
      }

      for (let i = 0; i < RUNS; i++) {
        if (i > 0 && COOLDOWN_MS > 0) await sleep(COOLDOWN_MS);
        const t0 = Date.now();
        const r = await guard.withDeadline(page, page.evaluate(async ([subsetSource, regression]) => {
          const h = window.BLACKLINE;
          // The warm-up beats and yields too, so the deadline's first gap is
          // one frame and not all sixty: the first draw of a cold map
          // compiles shaders for tens of seconds (F5).
          for (let k = 0; k < 60; k++) {
            h.renderFrame(1 / 60);
            h.debugTools.suite.beat({ total: 60, done: k + 1, inFlight: 'warm-up', phase: 'warming' });
            await h.debugTools.suite.yieldTask();
          }
          const loopFramesBefore = h.loop.frames;
          // runAutoTests takes `subset` as an array of registered checks.
          const opts = {};
          if (subsetSource) {
            const re = new RegExp(subsetSource);
            opts.subset = h.debugTools._autoTests.filter(t => re.test(t.id));
            opts.label = 'suite:' + subsetSource;
          }
          // The regression set is the page's own subset (F4 then U); the
          // runner asks for it the same way the key does.
          const res = regression
            ? await h.debugTools.runRegressionSet()
            : await h.debugTools.runAutoTests(opts);
          return {
            map: res.map,
            regression: !!regression,
            passed: res.passed,
            failed: res.failed,
            // Checks registered for other maps only; reported, never counted.
            notForMap: res.notForMap.length,
            // Times the machine took the WebGL context away mid-run (a check
            // that stages a loss on purpose is not counted). Each check that ran
            // in that window was re-run once the context came back; those are
            // listed so a green run that needed the tiebreak is never silent.
            contextLosses: res.contextLosses,
            // The software renderer's pipeline tail, waited for by the suite
            // and charged to the run rather than to whichever check
            // synchronised first (F11, D48). A third of a headless run, and
            // until now it appeared only as one check's ms.
            pipelineWaitMs: Math.round(res.pipelineWaitMs || 0),
            rerun: res.results.filter(x => x.rerun).map(x => x.id),
            // Frames the rAF loop drove while the suite ran. Zero is the only
            // right answer (F4); a check that drives frames does so through
            // h.renderFrame, which this does not count.
            loopFrames: h.loop.frames - loopFramesBefore,
            results: res.results.map(x => ({
              id: x.id, pass: !!x.pass, detail: String(x.detail ?? '').slice(0, 400),
              // What --details quotes, and the evidence the stall budget
              // rests on: the slowest single check is the longest gap
              // between two beats (F10).
              ms: Math.round(x.ms),
            })),
          };
        }, [SUBSET ? SUBSET.source : null, REGRESSION]), `map ${mapId}, run ${i + 1}`);
        r.ms = Date.now() - t0;
        runs.push(r);
      }
    }

    report = judge(runs, renderer, consoleErrors);
    report.otherRunners = leaked;
    report.throttle = {
      cores: CORES && CORES < os.cpus().length ? CORES : os.cpus().length,
      of: os.cpus().length,
      pinnedProcesses: pinned,
      cooldownMs: COOLDOWN_MS,
    };
  } finally {
    await guard.teardown();
  }

  if (DETAILS) {
    fs.writeFileSync(DETAILS, JSON.stringify(runs.map(r => ({ map: r.map, results: r.results })), null, 2) + '\n');
  }
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.stderr.write(summary(report));
  process.exit(report.ok ? 0 : 1);
}

// Judged per map: "flaky" is a check answering differently between two runs
// on the SAME map, and a check red on one map and green on another is red
// there, with the map named.
function judge(runs, renderer, consoleErrors) {
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
  const loopRan = runs.some(r => r.loopFrames > 0);
  const ok = red.length === 0 && flaky.length === 0 && !loopRan;
  return {
    ok,
    renderer,
    maps,
    runs: runs.map(r => ({
      map: r.map, regression: r.regression, passed: r.passed, failed: r.failed, notForMap: r.notForMap, ms: r.ms,
      pipelineWaitMs: r.pipelineWaitMs,
      contextLosses: r.contextLosses, rerun: r.rerun, loopFrames: r.loopFrames,
    })),
    red,
    flaky,
    expectedRed,
    unexpectedGreen,
    skipped,
    skipsWithheld,
    consoleErrors: { count: consoleErrors.length, first: consoleErrors.slice(0, 5) },
  };
}

function summary(r) {
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

main().catch(async err => {
  process.stderr.write(`suite: crashed: ${err && err.stack || err}\n`);
  for (const line of bootErrors.slice(0, 5)) process.stderr.write(`  page: ${line}\n`);
  // main()'s own finally has usually run by now; this covers the path where
  // it has not - a throw before the try, or a teardown itself cut short.
  await guard.teardown();
  process.exit(2);
});
