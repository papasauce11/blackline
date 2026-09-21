// BLACKLINE - scripts/shot.mjs
//
// A look at the figures, headless (F6):
//
//   npm run shot -- [--map plant,yard] [--out shots] [--query "seed=N"] [--pose crouch,vault,aim|all]
//
// Serves the repo in-process, drives the installed Chrome headless with
// software WebGL the way scripts/suite.mjs does (scripts/headless.mjs,
// F9), loads the page once per map, warms 60 frames, and calls
// `photograph()` from src/tests/look.js: both actors on the first clear
// lane with 25m of sight, a frame from every eye in open air - front, side
// and three-quarter at 4.5m, down the lane at 8m and 25m. Each frame is
// written as <out>/look-<map>-<eye>.png, and one line per eye says how
// many pixels the bodies cover in it. The PNGs are what the Browser pane
// showed a human session; a scheduled run has no pane, and can read a PNG.
//
// `--pose` (F7) photographs a state instead: `photographPose()` drives
// the Shade into each named state through the real keys (a crouch, a
// slide, a vault part way over, a hang, ...; `aim` is the Warden with the
// sights up) and frames it where it is, from the first three-quarter eye
// in open air - <out>/look-<map>-pose-<name>.png, one line per pose with
// the state the body was in. `all` is every pose there is.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs, listArg, registeredMapIds, serve, launch, openPage, loadMap, writePng } from './headless.mjs';

const args = parseArgs(process.argv.slice(2));
const CHANNEL = args.channel ?? 'chrome';
const OUT = path.resolve(ROOT, String(args.out ?? 'shots'));
const QUERY = args.query ? String(args.query) : '';
const POSES = listArg(args.pose);
const MAPS = listArg(args.map) ?? registeredMapIds();

async function main() {
  const { server, port } = await serve();
  const browser = await launch(CHANNEL);
  let failed = false;
  try {
    fs.mkdirSync(OUT, { recursive: true });
    const page = await openPage(browser, 'page');

    for (const mapId of MAPS) {
      const t0 = Date.now();
      await loadMap(page, port, mapId, QUERY);

      // The page's own module, through its import map; the loop stopped
      // and the shaders warmed first, as the suite does.
      if (POSES) {
        const looks = await page.evaluate(async (names) => {
          const h = window.BLACKLINE;
          h.loop.stop();
          for (let k = 0; k < 60; k++) h.renderFrame(1 / 60);
          const { photographPose, POSES: all } = await import('/src/tests/look.js');
          const wanted = names.length === 1 && names[0] === 'all' ? all : names;
          return wanted.map(name => photographPose(h, name));
        }, POSES);
        for (const look of looks) {
          if (!look.dataUrl) {
            process.stdout.write(`  ${look.pose}: no frame - ${look.why || `no eye in open air with sight of the body (${look.state})`}\n`);
            failed = true;
            continue;
          }
          const file = path.join(OUT, `look-${mapId}-pose-${look.pose}.png`);
          writePng(file, look.dataUrl);
          process.stdout.write(`${path.relative(ROOT, file)}  ${look.state}${look.reached ? '' : ` (NOT ${look.pose}: ${look.why})`}, ${look.covered}px of the body from the ${look.eye} eye\n`);
          if (!look.reached) failed = true;
        }
        process.stderr.write(`shot: ${mapId}: ${looks.length} poses, ${Date.now() - t0}ms\n`);
        continue;
      }
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
        writePng(file, view.dataUrl);
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
