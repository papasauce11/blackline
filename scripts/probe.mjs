// BLACKLINE - scripts/probe.mjs
//
// A probe: run a piece of JS inside the game, headless, and print what it
// returns (F9).
//
//   npm run probe -- [--map plant] [--out shots] [--query "seed=N"] <file.js> [more.js ...]
//
// Serves the repo in-process and drives the installed Chrome headless with
// software WebGL (scripts/headless.mjs, as shot.mjs does), loads the page
// on the map (the first registered one unless `--map` names another; one
// map, a probe is a question about a place), stops the loop, warms 60
// frames, and runs each file's text as the body of an async function with
// `h` (the harness, `window.BLACKLINE`) and `THREE` in scope - so
// top-level `await` works, and so does
// `await import('/src/tests/pixels.js')` through the page's import map.
// What the file returns is printed as JSON; if it returns an object with
// `pngs: [{ name, dataUrl }]`, each is written to <out>/<name>.png first
// and the list is dropped from the print. A file that throws prints the
// error and exits 1; the launch failing exits 2.
//
// Every "look at this view" and "what does this number read" question of
// a scheduled run goes through here: E4 and F8 were diagnosed with a
// scratch copy of this, and a scratchpad is not where an instrument lives.
// A probe is a question, not a check: what it finds that should stay true
// becomes a check under src/tests/.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs, registeredMapIds, serve, launch, openPage, loadMap, writePng } from './headless.mjs';

const args = parseArgs(process.argv.slice(2));
const CHANNEL = args.channel ?? 'chrome';
const OUT = path.resolve(ROOT, String(args.out ?? 'shots'));
const QUERY = args.query ? String(args.query) : '';
const MAP = args.map ? String(args.map) : registeredMapIds()[0];
const FILES = args._;

if (!FILES.length) {
  process.stderr.write('probe: no file to run - npm run probe -- [--map plant] <file.js>\n');
  process.exit(2);
}

async function main() {
  const sources = FILES.map(file => ({ file, code: fs.readFileSync(path.resolve(file), 'utf8') }));
  const { server, port } = await serve();
  const browser = await launch(CHANNEL);
  let failed = false;
  try {
    fs.mkdirSync(OUT, { recursive: true });
    const page = await openPage(browser, 'page');
    await loadMap(page, port, MAP, QUERY);

    // The loop stopped and the shaders warmed once, as the suite does; then
    // each file in turn, in the same page, so a second probe sees what the
    // first left.
    await page.evaluate(() => {
      const h = window.BLACKLINE;
      h.loop.stop();
      for (let k = 0; k < 60; k++) h.renderFrame(1 / 60);
    });
    for (const { file, code } of sources) {
      const t0 = Date.now();
      const outcome = await page.evaluate(async (src) => {
        const h = window.BLACKLINE;
        const THREE = await import('three');
        const fn = new Function('h', 'THREE', `return (async () => { ${src} })();`);
        try {
          return { result: await fn(h, THREE) };
        } catch (e) {
          return { error: (e && e.stack) || String(e) };
        }
      }, code);
      if (outcome.error) {
        process.stderr.write(`probe: ${file} threw: ${outcome.error}\n`);
        failed = true;
        continue;
      }
      let result = outcome.result;
      if (result && typeof result === 'object' && Array.isArray(result.pngs)) {
        for (const { name, dataUrl } of result.pngs) {
          if (!name || !dataUrl) continue;
          const png = path.join(OUT, `${name}.png`);
          writePng(png, dataUrl);
          process.stderr.write(`probe: wrote ${path.relative(ROOT, png)}\n`);
        }
        const { pngs, ...rest } = result;
        void pngs;
        result = rest;
      }
      process.stdout.write(`${JSON.stringify(result === undefined ? null : result, null, 1)}\n`);
      process.stderr.write(`probe: ${file} on ${MAP}, ${Date.now() - t0}ms\n`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  process.exit(failed ? 1 : 0);
}

main().catch(err => {
  process.stderr.write(`probe: crashed: ${err && err.stack || err}\n`);
  process.exit(2);
});
