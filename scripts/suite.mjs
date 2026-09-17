// The headless suite runner. `npm run suite`.
//
// Serves the repo from an in-process static server, launches the installed
// Chrome headless with software WebGL, waits for the harness, warms 60 frames,
// runs the AUTO suite N times (default 2), and prints one JSON report.
// Exit 0 only if nothing is red outside QUEUE.md's "Deliberately red" list
// and every run agrees. Checks listed in scripts/suite-skips.json are
// reported but never counted, either way.
//
// One tiebreak, and it is the page's, not this script's: a check that ran
// while the WebGL context was lost (Chrome kills a starved GPU process on a
// loaded machine and restores the context a moment later; every draw in the
// window is a no-op and every readPixels reads black) is re-run once the
// context is back, by the suite runner in src/ui/autosuite.js. The report
// carries `contextLosses` and `rerun` per run so that is never invisible.
//
//   node scripts/suite.mjs [--runs 2] [--subset <regex>] [--pre "<js>"]
//                          [--map plant,yard] [--channel chrome|msedge]
//                          [--timeout 600000] [--cores N] [--cooldown SECONDS]
//                          [--details FILE]
//
// --map names the registered maps to run on (src/maps/index.js), comma
// separated; the page is loaded once per map with `?map=<id>` and the suite
// run N times on each. Default `plant`, the first map. The report carries
// `map` on every run and every red, flaky or skipped entry, and a run's
// `notForMap` is the checks registered for other maps only, which are never
// counted either way (D1).
// --pre runs in the page before the suite, e.g. to reseed the rng.
// --details writes every check's id, outcome and detail line, per run, to
// FILE as JSON - the readings a PROGRESS.md entry quotes (B8). The report on
// stdout carries only what is red, flaky or skipped.
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

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = parseArgs(process.argv.slice(2));
const RUNS = Number(args.runs ?? 2);
const CHANNEL = args.channel ?? 'chrome';
const TIMEOUT = Number(args.timeout ?? 600000);
const SUBSET = args.subset ? new RegExp(args.subset) : null;
const PRE = args.pre ?? null;
const QUERY = args.query ?? null; // e.g. "seed=20260908", appended to the page URL
const MAPS = String(args.map ?? 'plant').split(',').map(s => s.trim()).filter(Boolean);
const DETAILS = args.details ?? null;
// Half the logical CPUs by default, never fewer than two - one core cannot
// run a browser and a compositor without the page timing out.
const CORES = Number(args.cores ?? Math.max(2, Math.floor(os.cpus().length / 2)));
const COOLDOWN_MS = Number(args.cooldown ?? 45) * 1000;

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

/** What the page said before a crash, so a module that failed to load names itself. */
const bootErrors = [];

async function main() {
  const { server, port } = await serve();
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
        const r = await page.evaluate(async (subsetSource) => {
          const h = window.BLACKLINE;
          for (let k = 0; k < 60; k++) h.renderFrame(1 / 60);
          const loopFramesBefore = h.loop.frames;
          // runAutoTests takes `subset` as an array of registered checks.
          const opts = {};
          if (subsetSource) {
            const re = new RegExp(subsetSource);
            opts.subset = h.debugTools._autoTests.filter(t => re.test(t.id));
            opts.label = 'suite:' + subsetSource;
          }
          const res = await h.debugTools.runAutoTests(opts);
          return {
            map: res.map,
            passed: res.passed,
            failed: res.failed,
            // Checks registered for other maps only; reported, never counted.
            notForMap: res.notForMap.length,
            // Times the machine took the WebGL context away mid-run (a check
            // that stages a loss on purpose is not counted). Each check that ran
            // in that window was re-run once the context came back; those are
            // listed so a green run that needed the tiebreak is never silent.
            contextLosses: res.contextLosses,
            rerun: res.results.filter(x => x.rerun).map(x => x.id),
            // Frames the rAF loop drove while the suite ran. Zero is the only
            // right answer (F4); a check that drives frames does so through
            // h.renderFrame, which this does not count.
            loopFrames: h.loop.frames - loopFramesBefore,
            results: res.results.map(x => ({
              id: x.id, pass: !!x.pass, detail: String(x.detail ?? '').slice(0, 400),
            })),
          };
        }, SUBSET ? SUBSET.source : null);
        r.ms = Date.now() - t0;
        runs.push(r);
      }
    }

    report = judge(runs, renderer, consoleErrors);
    report.throttle = {
      cores: CORES && CORES < os.cpus().length ? CORES : os.cpus().length,
      of: os.cpus().length,
      pinnedProcesses: pinned,
      cooldownMs: COOLDOWN_MS,
    };
  } finally {
    await browser.close();
    server.close();
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

  const red = [], expectedRed = [], flaky = [], skipped = [], unexpectedGreen = [];
  for (const map of maps) {
    const own = runs.filter(r => r.map === map);
    const ids = [...new Set(own.flatMap(r => r.results.map(x => x.id)))];
    const byRun = own.map(r => new Map(r.results.map(x => [x.id, x])));
    for (const id of ids) {
      const outcomes = byRun.map(m => m.get(id)?.pass);
      const allPass = outcomes.every(p => p === true);
      const allFail = outcomes.every(p => p === false);
      const detail = byRun.map(m => m.get(id)?.detail).find(Boolean) ?? '';
      if (skips.has(id)) {
        skipped.push({ id, map, reason: skips.get(id), outcome: allPass ? 'pass' : allFail ? 'fail' : 'mixed' });
        continue;
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
      map: r.map, passed: r.passed, failed: r.failed, notForMap: r.notForMap, ms: r.ms,
      contextLosses: r.contextLosses, rerun: r.rerun, loopFrames: r.loopFrames,
    })),
    red,
    flaky,
    expectedRed,
    unexpectedGreen,
    skipped,
    consoleErrors: { count: consoleErrors.length, first: consoleErrors.slice(0, 5) },
  };
}

function summary(r) {
  const lines = [];
  lines.push(`suite: ${r.ok ? 'OK' : 'FAIL'}  renderer: ${r.renderer}`);
  const tag = x => (r.maps.length > 1 ? `${x.id} [${x.map}]` : x.id);
  for (const [i, run] of r.runs.entries()) {
    lines.push(`  run ${i + 1} (${run.map}): ${run.passed} passed, ${run.failed} failed`
      + `${run.notForMap ? `, ${run.notForMap} not for this map` : ''}, ${run.ms}ms`);
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
  if (r.consoleErrors.count) lines.push(`  console errors: ${r.consoleErrors.count}`);
  if (r.throttle) {
    const t = r.throttle;
    lines.push(`  throttle: ${t.cores}/${t.of} cores`
      + `${t.pinnedProcesses ? ` (${t.pinnedProcesses} processes pinned)` : ''}`
      + `, ${t.cooldownMs / 1000}s cooldown between runs`);
  }
  return lines.join('\n') + '\n';
}

main().catch(err => {
  process.stderr.write(`suite: crashed: ${err && err.stack || err}\n`);
  for (const line of bootErrors.slice(0, 5)) process.stderr.write(`  page: ${line}\n`);
  process.exit(2);
});
