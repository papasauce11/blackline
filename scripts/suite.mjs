// The headless suite runner. `npm run suite`.
//
// Serves the repo from an in-process static server, launches the installed
// Chrome headless with software WebGL, waits for the harness, warms 60 frames,
// runs the AUTO suite N times (default 2), and prints one JSON report.
// Exit 0 only if nothing is red outside QUEUE.md's "Deliberately red" list
// and every run agrees. Checks listed in scripts/suite-skips.json are
// reported but never counted, either way.
//
//   node scripts/suite.mjs [--runs 2] [--subset <regex>] [--pre "<js>"]
//                          [--channel chrome|msedge] [--timeout 600000]
//
// --pre runs in the page before the suite, e.g. to reseed the rng.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
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

async function main() {
  const { server, port } = await serve();
  const consoleErrors = [];
  const browser = await chromium.launch({
    channel: CHANNEL,
    headless: true,
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--mute-audio',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  let report;
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.setDefaultTimeout(TIMEOUT);
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const at = m.location && m.location().url;
      consoleErrors.push(at ? `${m.text()} @ ${at}` : m.text());
    });
    page.on('pageerror', e => consoleErrors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', r => consoleErrors.push(`request failed: ${r.url()} (${r.failure()?.errorText})`));

    await page.goto(`http://127.0.0.1:${port}/${QUERY ? '?' + QUERY : ''}`, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.BLACKLINE, null, { timeout: 60000 });

    const renderer = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return 'no webgl';
      const d = gl.getExtension('WEBGL_debug_renderer_info');
      return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown';
    });

    if (PRE) await page.evaluate(PRE);

    const runs = [];
    for (let i = 0; i < RUNS; i++) {
      const t0 = Date.now();
      const r = await page.evaluate(async (subsetSource) => {
        const h = window.BLACKLINE;
        for (let k = 0; k < 60; k++) h.renderFrame(1 / 60);
        // runAutoTests takes `subset` as an array of registered checks.
        const opts = {};
        if (subsetSource) {
          const re = new RegExp(subsetSource);
          opts.subset = h.debugTools._autoTests.filter(t => re.test(t.id));
          opts.label = 'suite:' + subsetSource;
        }
        const res = await h.debugTools.runAutoTests(opts);
        return {
          passed: res.passed,
          failed: res.failed,
          results: res.results.map(x => ({
            id: x.id, pass: !!x.pass, detail: String(x.detail ?? '').slice(0, 400),
          })),
        };
      }, SUBSET ? SUBSET.source : null);
      r.ms = Date.now() - t0;
      runs.push(r);
    }

    report = judge(runs, renderer, consoleErrors);
  } finally {
    await browser.close();
    server.close();
  }

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.stderr.write(summary(report));
  process.exit(report.ok ? 0 : 1);
}

function judge(runs, renderer, consoleErrors) {
  const expected = new Set(expectedRedIds());
  const skips = skipsById();
  const ids = [...new Set(runs.flatMap(r => r.results.map(x => x.id)))];
  const byRun = runs.map(r => new Map(r.results.map(x => [x.id, x])));

  const red = [], expectedRed = [], flaky = [], skipped = [], unexpectedGreen = [];
  for (const id of ids) {
    const outcomes = byRun.map(m => m.get(id)?.pass);
    const allPass = outcomes.every(p => p === true);
    const allFail = outcomes.every(p => p === false);
    const detail = byRun.map(m => m.get(id)?.detail).find(Boolean) ?? '';
    if (skips.has(id)) {
      skipped.push({ id, reason: skips.get(id), outcome: allPass ? 'pass' : allFail ? 'fail' : 'mixed' });
      continue;
    }
    if (!allPass && !allFail) { flaky.push({ id, outcomes, detail }); continue; }
    if (allFail) {
      if (expected.has(id)) expectedRed.push({ id, detail });
      else red.push({ id, detail });
    } else if (expected.has(id)) {
      unexpectedGreen.push(id);
    }
  }
  const ok = red.length === 0 && flaky.length === 0;
  return {
    ok,
    renderer,
    runs: runs.map(r => ({ passed: r.passed, failed: r.failed, ms: r.ms })),
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
  for (const [i, run] of r.runs.entries()) lines.push(`  run ${i + 1}: ${run.passed} passed, ${run.failed} failed, ${run.ms}ms`);
  if (r.red.length) lines.push(`  RED (unexpected): ${r.red.map(x => x.id).join(', ')}`);
  if (r.flaky.length) lines.push(`  FLAKY: ${r.flaky.map(x => x.id).join(', ')}`);
  if (r.expectedRed.length) lines.push(`  expected red: ${r.expectedRed.map(x => x.id).join(', ')}`);
  if (r.unexpectedGreen.length) lines.push(`  now GREEN, remove from QUEUE.md: ${r.unexpectedGreen.join(', ')}`);
  if (r.skipped.length) lines.push(`  skipped headless: ${r.skipped.map(x => `${x.id} (${x.outcome})`).join(', ')}`);
  if (r.consoleErrors.count) lines.push(`  console errors: ${r.consoleErrors.count}`);
  return lines.join('\n') + '\n';
}

main().catch(err => {
  process.stderr.write(`suite: crashed: ${err && err.stack || err}\n`);
  process.exit(2);
});
