// BLACKLINE - scripts/headless.mjs
//
// The page, headless: what every script that looks at the game without a
// browser pane needs (F9). Serves the repo from an in-process static
// server, launches the installed Chrome headless with software WebGL,
// loads the page on a map, waits for the harness. scripts/shot.mjs (F6,
// F7) and scripts/probe.mjs (F9) import this; scripts/suite.mjs carries
// its own copy of the same server and launch, because it runs the suite
// on import and adds a throttle token to the launch. Keep the two in step:
// a MIME type, a Chrome flag or a query pin added here is added there.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

/** The repo root: the directory above scripts/. */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.wav': 'audio/wav',
};

/**
 * `--key value` pairs and bare `--flag`s into an object; anything that is
 * not an option is a positional, under `_`.
 */
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

/** A comma-separated option as a list of trimmed names, or null if absent. */
export function listArg(value) {
  return value ? String(value).split(',').map(s => s.trim()).filter(Boolean) : null;
}

/**
 * Every map the registry lists, in its order, read as text: the module
 * imports three.js through the page's import map and node cannot load it.
 */
export function registeredMapIds() {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'maps', 'index.js'), 'utf8');
  const start = src.indexOf('const REGISTRY = [');
  const end = src.indexOf('];', start);
  if (start < 0 || end < 0) throw new Error('src/maps/index.js: REGISTRY not found');
  const ids = [];
  for (const m of src.slice(start, end).matchAll(/\{\s*id:\s*'([a-z0-9-]+)'/g)) ids.push(m[1]);
  if (!ids.length) throw new Error('src/maps/index.js: REGISTRY lists no maps');
  return ids;
}

/** Serve the repo on a free loopback port. Resolves to `{ server, port }`. */
export function serve() {
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

/** The installed Chrome (or `channel`), headless, on SwiftShader. */
export function launch(channel = 'chrome') {
  return chromium.launch({
    channel,
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'],
  });
}

/**
 * A page at the suite's size, with the page's errors on stderr under
 * `prefix` so a module that fails to load names itself.
 */
export async function openPage(browser, prefix) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => process.stderr.write(`  ${prefix}: pageerror: ${e.message}\n`));
  page.on('console', m => { if (m.type() === 'error') process.stderr.write(`  ${prefix}: ${m.text()}\n`); });
  return page;
}

/**
 * Load the page on `mapId` (with `query` in front, e.g. "seed=N") and wait
 * for the harness; throws if the page booted another map.
 */
export async function loadMap(page, port, mapId, query = '') {
  // H10: pinned to `medium`, the picture every reading on record was taken at.
  // Auto's probe picks `low` under software WebGL every time, so an unpinned
  // shot would come back without its outlines or its bloom. `--query` naming a
  // level wins, which is how a shot of another level is taken.
  const pin = /(^|&)quality=/.test(query) ? null : 'quality=medium';
  const q = [query, pin, `map=${mapId}`].filter(Boolean).join('&');
  await page.goto(`http://127.0.0.1:${port}/?${q}`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.BLACKLINE, null, { timeout: 60000 });
  const booted = await page.evaluate(() => window.BLACKLINE.map.id);
  if (booted !== mapId) throw new Error(`asked for map "${mapId}", the page booted "${booted}"`);
}

/** Write a data URL's PNG to `file`. */
export function writePng(file, dataUrl) {
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
}
