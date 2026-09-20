// BLACKLINE - scripts/shot.mjs
//
// A look at the figures, headless (F6):
//
//   npm run shot -- [--map plant,yard] [--out shots] [--query "seed=N"]
//
// Serves the repo in-process, drives the installed Chrome headless with
// software WebGL the way scripts/suite.mjs does, loads the page once per
// map, warms 60 frames, and calls `photograph()` from src/tests/look.js:
// both actors on the first clear lane with 25m of sight, a frame from
// every eye in open air - front, side and three-quarter at 4.5m, down
// the lane at 8m and 25m. Each frame is written as
// <out>/look-<map>-<eye>.png, and one line per eye says how many pixels
// the bodies cover in it. The PNGs are what the Browser pane showed a
// human session; a scheduled run has no pane, and can read a PNG.
//
// The server and the launch are the suite runner's, repeated here rather
// than imported: suite.mjs runs the suite on import. Keep the two in step.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const CHANNEL = args.channel ?? 'chrome';
const OUT = path.resolve(ROOT, String(args.out ?? 'shots'));
const QUERY = args.query ? String(args.query) : '';
const MAPS = args.map
  ? String(args.map).split(',').map(s => s.trim()).filter(Boolean)
  : registeredMapIds();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.wav': 'audio/wav',
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

/** Every map the registry lists, read as text (the module imports three.js through the page's import map). */
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

function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
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
  const browser = await chromium.launch({
    channel: CHANNEL,
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'],
  });
  let failed = false;
  try {
    fs.mkdirSync(OUT, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', e => process.stderr.write(`  page: pageerror: ${e.message}\n`));
    page.on('console', m => { if (m.type() === 'error') process.stderr.write(`  page: ${m.text()}\n`); });

    for (const mapId of MAPS) {
      const t0 = Date.now();
      const query = [QUERY, `map=${mapId}`].filter(Boolean).join('&');
      await page.goto(`http://127.0.0.1:${port}/?${query}`, { waitUntil: 'load' });
      await page.waitForFunction(() => !!window.BLACKLINE, null, { timeout: 60000 });
      const booted = await page.evaluate(() => window.BLACKLINE.map.id);
      if (booted !== mapId) throw new Error(`asked for map "${mapId}", the page booted "${booted}"`);

      // The page's own module, through its import map; the loop stopped
      // and the shaders warmed first, as the suite does.
      const look = await page.evaluate(async () => {
        const h = window.BLACKLINE;
        h.loop.stop();
        for (let k = 0; k < 60; k++) h.renderFrame(1 / 60);
        const { photograph } = await import('/src/tests/look.js');
        return photograph(h);
      });
      if (!look) {
        process.stderr.write(`shot: ${mapId}: no stand with a clear lane and 25m of sight\n`);
        failed = true;
        continue;
      }
      for (const [name, view] of Object.entries(look.views)) {
        const file = path.join(OUT, `look-${mapId}-${name}.png`);
        fs.writeFileSync(file, Buffer.from(view.dataUrl.split(',')[1], 'base64'));
        process.stdout.write(`${path.relative(ROOT, file)}  ${view.covered}px of the bodies\n`);
      }
      for (const why of look.skipped) process.stdout.write(`  skipped ${why}\n`);
      process.stderr.write(`shot: ${mapId}: ${Object.keys(look.views).length} frames from the lane at ${look.lane}, ${Date.now() - t0}ms\n`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  process.exit(failed ? 1 : 0);
}

main().catch(err => {
  process.stderr.write(`shot: crashed: ${err && err.stack || err}\n`);
  process.exit(2);
});
