// BLACKLINE - scripts/bench.mjs
//
// The frame budget on the real GPU. `npm run bench` (H11).
//
//   npm run bench -- [--map plant,yard] [--quality low,medium,high]
//                    [--channel chrome|msedge] [--out bench] [--runs 1]
//                    [--window-position -2400,-2400] [--onscreen]
//                    [--stall SECONDS]
//
// Everything else in this repo is measured headless on SwiftShader, which
// draws a frame in about 400ms and therefore says nothing whatever about a
// frame budget. So one check has been dropped at the gate since F5 - the
// 92-viewpoint sweep, `the-frame-budget-holds-everywhere-not-just-at-site-a` -
// and `PLAYTEST.md` has asked Josh to open the game and read its line by hand.
// This is that reading, taken by a script: the checks `bench-checks.json`
// names, run in a *headed* Chrome on this machine's own GPU, on every
// registered map at every quality level, written to `bench/<date>.json` and
// summarised on stderr in the shape a HANDOFF line quotes.
//
// Headed, and not headless-with-the-GPU, for one reason: a headless Chrome
// has no window and so no window's swap chain, and whether it uses the GPU at
// all has changed between Chrome versions more than once. A headed window is
// what a friend runs. The window is placed far off the desktop
// (`--window-position`) so a bench during a working day does not sit on top of
// anything; it still takes focus for the second it opens, which is the one
// cost of running this while somebody is at the machine, and `--onscreen` is
// for watching it.
//
// Three honesty clauses, because a bench that lies is worse than no bench:
//
//  1. **It refuses to bench software.** If the page's unmasked renderer names
//     SwiftShader or a software rasteriser, nothing is written and the exit
//     code is 2. The whole claim of this file is that a real GPU drew it.
//  2. **It refuses to run beside a suite.** `npm run suite` is a sustained
//     all-core software-GL load, and a frame timed beside one is a reading
//     about a busy machine. An older `suite.mjs` still alive is named and the
//     bench stops rather than quietly measuring the contention.
//  3. **It runs exactly what `scripts/bench-checks.json` names**, which is the
//     same file the gate reads to decide what not to count
//     (`benchOnlyById()` in scripts/suitereport.mjs). So a check dropped from
//     the gate as "the bench has this one" is run here by construction rather
//     than by a comment, and
//     `the-bench-only-list-holds-only-checks-the-bench-itself-runs` holds
//     both ends of that from inside the page (src/tests/benchlist.js) -
//     including that no id is written in this file's own source.
//
// And one thing this runner asks the page for that no other may:
// `?viewpointSamples=9`. The frame-budget sweep costs a viewpoint the MEDIAN
// of its timed draws and takes **one** draw unless a page asks for more,
// because headless a second draw costs about half a second of queued pipeline
// and the gate drops the verdict anyway. Nine is where two benches of this
// PC's GPU agreed to 0.2ms, so this is the one URL in the repo that asks for
// them, and `the-frame-budget-asserts-a-median-frame-and-not-an-unlucky-one`
// holds that it does (H36).
//
// The viewport is pinned to the suite's 1280x720 so a number here is
// comparable with a number there. Playwright sets that by emulation in a
// headed browser, which changes the size of the drawing buffer and nothing
// about which device fills it, and the buffer actually measured is written
// into every scene either way.
//
// Exit 0 when every check passed everywhere it ran, 1 when one is red - a red
// here is the real answer to check 29 and worth an exit code - and 2 when the
// bench could not honestly be taken at all.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { ROOT, parseArgs, listArg, registeredMapIds, serve } from './headless.mjs';
import { createGuard, otherRunners } from './watchdog.mjs';
import { benchChecks } from './suitereport.mjs';

const args = parseArgs(process.argv.slice(2));
const CHANNEL = args.channel ?? 'chrome';
const OUT = path.resolve(ROOT, String(args.out ?? 'bench'));
const MAPS = listArg(args.map) ?? registeredMapIds();
// Every level the preset table has, by default. The gate has only ever drawn
// `medium` (H10's pin) and H24 priced `low` and `high` in software; what
// nobody has is what any of the three costs on a GPU, and on hardware that
// clears the budget all three together are a couple of minutes. `--quality`
// narrows it.
const LEVELS = listArg(args.quality) ?? ['low', 'medium', 'high'];
const REPEATS = Number(args.runs ?? 1);
const POSITION = String(args['window-position'] ?? '-2400,-2400');
const ONSCREEN = !!args.onscreen;
const STALL_MS = Number(args.stall ?? 240) * 1000;
/** The suite's viewport, so a reading here sits beside a reading there. */
const VIEWPORT = { width: 1280, height: 720 };

/** A renderer string that means nobody's GPU drew anything. */
const SOFTWARE = /swiftshader|software|llvmpipe|basic render|microsoft basic/i;

const guard = createGuard({
  stallMs: STALL_MS,
  // watchdog.mjs writes its signal line for the gate; this is the same tree
  // being torn down, under a different command's name.
  warn: line => process.stderr.write(line.replace(/^suite:/, 'bench:')),
});

/**
 * The build stamp for the record. Absent is not fatal.
 *
 * Read from `version.json`, which `scripts/version.mjs` writes **only from a
 * clean tree** (H3) — so on a dirty tree this names the last clean commit and
 * not what was actually benched. That is the honest thing available from here
 * and it is worth knowing when reading an old file: a bench taken mid-job
 * carries the commit before the job.
 */
function versionStamp() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Today's file, with today's runs in it. One file a day, as the queue asked,
 * and a second bench the same day appends rather than overwriting the first -
 * two readings an hour apart are exactly the comparison this file exists for.
 */
function appendRun(file, run) {
  let doc = { date: run.at.slice(0, 10), runs: [] };
  if (fs.existsSync(file)) {
    try {
      const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (existing && Array.isArray(existing.runs)) doc = existing;
    } catch {
      // A hand-mangled file is not a reason to lose a reading; start a new
      // document and say so rather than throwing after the measuring is done.
      process.stderr.write(`bench: ${path.relative(ROOT, file)} does not parse; starting a new one\n`);
    }
  }
  doc.runs.push(run);
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
}

async function main() {
  // 2. A suite running next to this one makes every number below a number
  //    about a busy machine.
  const busy = otherRunners();
  if (busy.length) {
    for (const r of busy) {
      process.stderr.write(`bench: a suite.mjs is still running (pid ${r.pid}, started ${r.started}).`
        + ` It is a sustained all-core software-GL load, so a frame timed beside it is not a frame on an idle machine.`
        + ` Wait for it, or end it with: taskkill /PID ${r.pid} /T /F\n`);
    }
    process.exit(2);
  }

  const wanted = benchChecks();
  if (!wanted.length) {
    process.stderr.write('bench: scripts/bench-checks.json names no checks\n');
    process.exit(2);
  }
  const ids = wanted.map(c => c.id);

  const { server, port } = await serve();
  guard.attach({ server });
  const origin = `http://127.0.0.1:${port}/`;

  // The real GPU: no `--use-angle=swiftshader`, no `--enable-unsafe-swiftshader`,
  // and no `--ignore-gpu-blocklist` either - if Chrome refuses this card then a
  // friend's Chrome refuses it too, and the bench should say so rather than
  // override it. The three backgrounding switches are about the window being
  // off the desktop: Chrome throttles and un-composites a window it believes
  // nobody can see, which would be an artefact of how this is run rather than
  // anything about the game. Nothing here renders through rAF - every frame
  // below is an explicit `h.renderFrame()` - so no vsync flag is needed.
  const browser = await chromium.launch({
    channel: CHANNEL,
    headless: false,
    args: [
      '--mute-audio',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
      '--window-size=1280,800',
      ...(ONSCREEN ? [] : [`--window-position=${POSITION}`]),
    ],
  });
  guard.attach({ browser });

  const consoleErrors = [];
  const scenes = [];
  let gpu = null;
  let ok = true;
  try {
    const page = await browser.newPage({ viewport: VIEWPORT });
    const at = { map: null, level: null };
    const stamp = () => `[${at.map ?? '-'} ${at.level ?? '-'}] `;
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(`${stamp()}${m.text()}`); });
    page.on('pageerror', e => consoleErrors.push(`${stamp()}pageerror: ${e.message}`));

    for (let repeat = 0; repeat < REPEATS; repeat++) {
      for (const mapId of MAPS) {
        for (const level of LEVELS) {
          at.map = mapId;
          at.level = level;
          // One page load per map and level: the world is built on the map at
          // boot, and `?quality=` is read at boot too (H10's precedence has
          // the URL first), so a level is a load exactly as a map is. The
          // sample count rides the same URL, for the reason in this file's
          // header: a median is a thing only a real GPU can afford.
          await page.goto(`${origin}?quality=${level}&map=${mapId}&viewpointSamples=9`, { waitUntil: 'load' });
          await page.waitForFunction(() => !!window.BLACKLINE, null, { timeout: 60000 });
          // The live loop would play the game under the checks (F4).
          await page.evaluate(() => window.BLACKLINE.loop.stop());
          const booted = await page.evaluate(() => window.BLACKLINE.map.id);
          if (booted !== mapId) throw new Error(`asked for map "${mapId}", the page booted "${booted}"`);

          if (!gpu) {
            gpu = await page.evaluate(() => {
              const c = document.createElement('canvas');
              const gl = c.getContext('webgl2') || c.getContext('webgl');
              if (!gl) return { renderer: 'no webgl', vendor: null, unmasked: false };
              const d = gl.getExtension('WEBGL_debug_renderer_info');
              if (!d) {
                return { renderer: gl.getParameter(gl.RENDERER), vendor: gl.getParameter(gl.VENDOR), unmasked: false };
              }
              return {
                renderer: gl.getParameter(d.UNMASKED_RENDERER_WEBGL),
                vendor: gl.getParameter(d.UNMASKED_VENDOR_WEBGL),
                unmasked: true,
              };
            });
            // 1. The refusal. Everything below would otherwise be a second,
            //    slower copy of the gate's own reading wearing the word bench.
            if (SOFTWARE.test(String(gpu.renderer))) {
              throw new Error(`the browser came up on "${gpu.renderer}", which is a software rasteriser.`
                + ` A frame timed on it is what the gate already measures, so nothing was written.`
                + ` Check that ${CHANNEL} has hardware acceleration on (chrome://gpu).`);
            }
            process.stderr.write(`bench: ${gpu.renderer}${gpu.unmasked ? '' : ' (masked)'}\n`);
          }

          const scene = await guard.withDeadline(page, page.evaluate(async (checkIds) => {
            const h = window.BLACKLINE;
            // Warm the shaders before timing anything (the standing rule), and
            // beat while warming so the deadline's first gap is one frame
            // rather than all sixty.
            for (let k = 0; k < 60; k++) {
              h.renderFrame(1 / 60);
              h.debugTools.suite.beat({ total: 60, done: k + 1, inFlight: 'warm-up', phase: 'warming' });
              await h.debugTools.suite.yieldTask();
            }
            const subset = h.debugTools._autoTests.filter(t => checkIds.includes(t.id));
            const missing = checkIds.filter(id => !subset.some(t => t.id === id));
            const res = await h.debugTools.runAutoTests({ subset, label: 'bench' });
            return {
              missing,
              // `applicable()` hands these back as ids (F14's own reading).
              notForMap: res.notForMap,
              contextLosses: res.contextLosses,
              quality: h.debugState.quality ?? null,
              devicePixelRatio: window.devicePixelRatio,
              // The whole detail line, never the suite's 400-character cut:
              // the numbers are the entire output of this script.
              checks: res.results.map(x => ({
                id: x.id, pass: !!x.pass, ms: Math.round(x.ms), detail: String(x.detail ?? ''),
              })),
            };
          }, ids), `${mapId} at ${level}`);

          for (const id of scene.missing) {
            process.stderr.write(`bench: no module registers "${id}"\n`);
            ok = false;
          }
          // A check registered for another map only is neither a red nor a
          // reading; say it, so a thin bench is never a silent one.
          for (const id of scene.notForMap) {
            if (ids.includes(id)) process.stderr.write(`  ${mapId} ${level}: ${id} is not registered for this map\n`);
          }
          if (scene.contextLosses) {
            process.stderr.write(`  ${mapId} ${level}: GL CONTEXT LOST ${scene.contextLosses}x\n`);
          }
          const buffer = scene.quality && scene.quality.buffer ? scene.quality.buffer : null;
          process.stderr.write(`  ${mapId} ${level} (${buffer ? buffer.join('x') : '?'} buffer,`
            + ` post ${scene.quality && scene.quality.post ? 'on' : 'off'}):\n`);
          for (const c of scene.checks) {
            if (!c.pass) ok = false;
            process.stderr.write(`    ${c.pass ? 'pass' : 'RED '} ${c.id} (${c.ms}ms)\n      ${c.detail}\n`);
          }
          scenes.push({
            map: mapId,
            level,
            repeat: repeat + 1,
            buffer,
            devicePixelRatio: scene.devicePixelRatio,
            quality: scene.quality,
            contextLosses: scene.contextLosses,
            checks: scene.checks,
          });
        }
      }
    }
  } finally {
    await guard.teardown();
  }

  const stamped = versionStamp();
  const run = {
    at: new Date().toISOString(),
    commit: stamped ? stamped.short ?? stamped.commit ?? null : null,
    branch: stamped ? stamped.branch ?? null : null,
    machine: {
      platform: process.platform,
      cpu: os.cpus()[0] ? os.cpus()[0].model.trim() : null,
      logicalCpus: os.cpus().length,
      memGb: Math.round(os.totalmem() / 1e9),
    },
    browser: { channel: CHANNEL, headless: false, viewport: [VIEWPORT.width, VIEWPORT.height] },
    gpu,
    maps: MAPS,
    levels: LEVELS,
    checks: wanted,
    ok,
    consoleErrors,
    scenes,
  };
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${run.at.slice(0, 10)}.json`);
  appendRun(file, run);
  const readings = scenes.reduce((n, s) => n + s.checks.length, 0);
  process.stderr.write(`bench: ${ok ? 'OK' : 'RED'} - ${readings} readings on ${MAPS.join(', ')}`
    + ` at ${LEVELS.join(', ')} -> ${path.relative(ROOT, file)}\n`);
  if (consoleErrors.length) {
    process.stderr.write(`bench: console errors: ${consoleErrors.length}\n`);
    for (const line of consoleErrors.slice(0, 5)) process.stderr.write(`    ${line}\n`);
  }
  process.exit(ok ? 0 : 1);
}

main().catch(async err => {
  process.stderr.write(`bench: crashed: ${err && err.stack || err}\n`);
  await guard.teardown();
  process.exit(2);
});
