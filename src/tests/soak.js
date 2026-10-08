/**
 * BLACKLINE - tests/soak.js
 *
 * The checks that only mean anything at scale: every sound rendered to samples,
 * the HUD's layout as geometry, the frame budget everywhere rather than at one
 * camera position, and a whole match watched for leaks.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { createLens } from './pixels.js';

const A = CONFIG.audio;

/**
 * Timed draws per viewpoint in the frame-budget sweep, and the wall-clock the
 * sweep will spend buying them (H36). Both are measured numbers, and
 * `PROGRESS.md`'s H36 entry holds the readings they came from.
 *
 * The sweep used to time **one** draw per viewpoint and assert the highest of
 * them against the ceiling, so its verdict was a single frame. Benched twice on
 * this PC's GPU at fifteen draws a viewpoint, three things came out of it.
 *
 *   - **The worst PLACE reproduces at no sample count.** The top three
 *     overlapped one or two of three in all six scenes, at fifteen samples as
 *     at one, because the top of the distribution is a plateau inside the
 *     clock's own resolution: `performance.now()` is clamped to **0.1ms** and
 *     4 to 13 viewpoints of 92 sit within 0.2ms of the top. A tie is not
 *     fixable by sampling. The top **ten as a set** does reproduce, 7 to 10 of
 *     10, so the busiest *neighbourhood* is a real finding and the busiest
 *     *viewpoint* never was one - which is why the busiest three are named now
 *     and the one crowned winner is gone.
 *   - **The worst VALUE settles as a median and never as a maximum.** Two
 *     benches agreed within 0.3ms from five samples and 0.2ms from nine, where
 *     max-of-N agreed nowhere and on the plant *grew* from 0.1ms apart at nine
 *     to 0.6ms at fifteen, a longer run giving a spike more chances. **More
 *     samples make a maximum worse**, which is the whole argument for the
 *     median. What no median survives is a stall longer than its own sampling
 *     window - one bench read a 2.20ms viewpoint at 4.80ms across all nine of
 *     its draws - and what makes the clause safe there is **headroom**, the
 *     worst of four readings being 58% of the ceiling, not reproducibility.
 *   - **And a spike had already turned this check red on a real GPU.** One
 *     draw at `bay-a-north` read **13.80ms** against the 8.33ms ceiling, at a
 *     place whose median over fifteen draws is 2.30ms. So the worst single
 *     draw is reported now and never asserted.
 *
 * Nine, because nine is where two benches agreed to 0.2ms - and **nobody takes
 * nine unless the URL asks for them**, which is the half that cost three dead
 * runs. A per-viewpoint wall-clock budget was meant to decide it: nine samples
 * where nine are affordable, one where they are not. **Nothing in this page
 * can decide that.** `renderOnly()` only *queues* a draw, and the barrier the
 * budget used to make one finish - `gl.getError()` - **does not wait**: probed
 * here, nine queued draws of a real viewpoint submit in 13-24ms, `getError()`
 * returns **0.6ms** later, and a real `fenceSync` then waits **5.5 to 6.9
 * seconds** for those same nine. A queued draw costs **610-761ms**, so nine at
 * 92 viewpoints is some 560s of pipeline on top of the plant's own ~450s tail,
 * which is the 600s `--stall-wait` three runs died on. And the only barrier
 * that does wait must **yield to the event loop** to poll it, so it cannot
 * live inside a synchronous timer at all. There is no honest wall clock here
 * to build a sample count on, at any sample count (H36; `TRAPS.md`).
 *
 * So the count is **declared by whoever is measuring**: `?viewpointSamples=9`,
 * which only `scripts/bench.mjs` asks for, and **one** otherwise - so the
 * gate, which runs this check and drops only its verdict, costs what it always
 * cost by construction rather than by a measurement that can be wrong. The
 * **budget** stays as what it can honestly be: a cap, so a real GPU slower
 * than this one takes the samples 120ms affords instead of nine regardless.
 * `the-frame-budget-asserts-a-median-frame-and-not-an-unlucky-one` holds both
 * numbers, the median, the default of one and the two runners' two URLs.
 */
export const VIEWPOINT_SAMPLES = 9;
export const VIEWPOINT_BUDGET_MS = 120;

/** The URL parameter that asks for a median, and the only thing that can. */
export const VIEWPOINT_SAMPLES_PARAM = 'viewpointSamples';

/**
 * What a viewpoint costs, given its timed draws: the **median**, so one frame
 * the scheduler took away cannot set a verdict about a frame budget. Exported
 * for the check that proves a spike cannot reach it.
 */
export function viewpointCost(samples) {
  if (!samples.length) return 0;
  const sorted = samples.slice().sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * How many timed draws a viewpoint rests on: **one, unless the URL asks for
 * more**, and never more than the nine two benches agreed at.
 *
 * One is not a median and the sweep's detail line says so in those words. It
 * is the right default anyway: the gate draws with SwiftShader, where a frame
 * costs 610-761ms queued and this check's verdict is dropped for exactly that
 * reason (`scripts/bench-checks.json`), so a second sample there would buy
 * nothing and cost the next check two thirds of a second of pipeline tail it
 * has to wait out. An ask above nine is clamped rather
 * than refused - fifteen was measured, and it made the *maximum* worse while
 * the median had stopped moving at nine, so there is nothing up there to buy.
 */
export function viewpointSamples(search) {
  const params = new URLSearchParams(typeof search === 'string' ? search : '');
  const asked = Math.floor(Number(params.get(VIEWPOINT_SAMPLES_PARAM)));
  if (!Number.isFinite(asked) || asked < 2) return 1;
  return Math.min(asked, VIEWPOINT_SAMPLES);
}

/** Peak absolute sample, and where the tail falls below a fraction of it. */
function envelope(buffer) {
  const data = buffer.getChannelData(0);
  const rate = buffer.sampleRate;
  let peak = 0;
  let peakAt = 0;
  for (let i = 0; i < data.length; i++) {
    const value = Math.abs(data[i]);
    if (value > peak) {
      peak = value;
      peakAt = i;
    }
  }
  let last = 0;
  const floor = peak * 0.05;
  for (let i = data.length - 1; i >= 0; i--) {
    if (Math.abs(data[i]) > floor) {
      last = i;
      break;
    }
  }
  return { peak, peakAt: peakAt / rate, audibleFor: last / rate };
}

/**
 * Rough pitch, by zero crossings across the loud part of the sound.
 *
 * Not an FFT: the only question worth asking here is whether a 120Hz square
 * and a 1200Hz blip are an order of magnitude apart, and crossings answer that
 * without shipping a transform.
 *
 * Crossings and duration must come from the SAME window. Counting every
 * crossing in the buffer but dividing by only the audible span counts the
 * near-silent tail's dither against the loud part's period, which reported a
 * 660Hz alarm at 16kHz.
 *
 * Only meaningful for a single-oscillator sound. A thud that is a 55Hz sine
 * plus a 900Hz noise crack has no single pitch, and the caller does not ask.
 */
function crossingRate(buffer) {
  const data = buffer.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak === 0) return 0;

  const gate = peak * 0.15;
  let first = -1;
  let last = -1;
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) <= gate) continue;
    if (first === -1) first = i;
    last = i;
  }
  if (first === -1 || last <= first) return 0;

  let crossings = 0;
  let previous = data[first];
  for (let i = first + 1; i <= last; i++) {
    const value = data[i];
    if ((previous < 0 && value >= 0) || (previous > 0 && value <= 0)) crossings++;
    previous = value;
  }
  const seconds = (last - first) / buffer.sampleRate;
  return seconds > 0 ? crossings / 2 / seconds : 0;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'every-sound-renders-to-samples-that-match-section-14',
    spec: 'Section 14',
    name: 'Rendered offline: each sound is audible, the right length and the right register',
    run: async (h) => {
      const problems = [];
      const audio = h.audio;
      if (!audio.unlock()) return { pass: false, detail: 'no AudioContext available' };
      if (typeof OfflineAudioContext === 'undefined') {
        return { pass: false, detail: 'no OfflineAudioContext in this browser' };
      }

      // Section 14's table, with the claim each row makes that samples can
      // settle.
      //
      // `minHz`/`maxHz` are only set where the builder is a SINGLE oscillator
      // and a pitch is therefore a real property of the sound. The takedown is
      // a 55Hz sine mixed with a 900Hz noise crack, the grenade is a filtered
      // burst plus a tone — asking those for "the" frequency is asking a
      // question the signal does not answer, so they are checked for level,
      // length and decay only.
      const table = [
        { sound: 'shadeFootstep', seconds: 0.4, note: 'high-passed 800Hz, short and quiet' },
        { sound: 'wardenFootstep', seconds: 0.5, note: 'low-passed, heavier and louder than the Shade' },
        { sound: 'gunfire', seconds: 0.8, note: 'burst plus a tail from delayed copies' },
        { sound: 'knifeSwing', seconds: 0.5, note: 'filtered noise whoosh' },
        { sound: 'takedown', seconds: 1.2, note: 'sub-bass sine plus a mid noise crack' },
        { sound: 'taser', seconds: 0.8, pure: true, minHz: 60, maxHz: 400, note: 'square around 120Hz' },
        { sound: 'smoke', seconds: 2.5, note: 'sustained, slow sweep' },
        { sound: 'flashbang', seconds: 5.0, note: 'transient plus a 4kHz ring' },
        { sound: 'grenade', seconds: 1.2, note: 'low burst, pitched-down tail' },
        { sound: 'alarm', seconds: 0.8, pure: true, minHz: 400, maxHz: 1600, note: 'two-tone 660/880 square' },
        { sound: 'plantBeep', seconds: 0.3, pure: true, minHz: 700, maxHz: 2000, note: '1200Hz blip' },
        { sound: 'lifeLost', seconds: 1.5, pure: true, minHz: 40, maxHz: 500, note: 'descending 320 -> 90Hz' },
        { sound: 'landing', seconds: 0.5, note: 'heavy impact' },
        { sound: 'lightBreak', seconds: 0.6, note: 'glass' },
        { sound: 'reload', seconds: 0.3, note: 'mechanical click' },
        { sound: 'scuff', seconds: 0.4, note: 'B2: low-passed slap, short' },
      ];

      const measured = [];
      for (const row of table) {
        const buffer = await audio.renderOffline(row.sound, row.seconds);
        if (!buffer) {
          problems.push(`${row.sound} rendered nothing`);
          continue;
        }
        const env = envelope(buffer);
        const hz = crossingRate(buffer);

        // Silence is the failure this whole check exists to catch: a builder
        // that runs, starts a voice, releases it, and emits nothing.
        if (env.peak < 0.001) {
          problems.push(`${row.sound} rendered silence (peak ${env.peak.toExponential(1)})`);
          continue;
        }
        // And clipping is the other end of it.
        if (env.peak > 1.0) problems.push(`${row.sound} clips at ${env.peak.toFixed(2)}`);
        if (env.audibleFor <= 0.005) problems.push(`${row.sound} is audible for only ${env.audibleFor.toFixed(3)}s`);
        if (env.audibleFor > row.seconds * 0.995) {
          problems.push(`${row.sound} was still sounding when the render ended — it may not decay`);
        }
        if (row.pure) {
          if (hz < row.minHz) problems.push(`${row.sound} sits at ~${hz.toFixed(0)}Hz, expected above ${row.minHz} (${row.note})`);
          if (hz > row.maxHz) problems.push(`${row.sound} sits at ~${hz.toFixed(0)}Hz, expected below ${row.maxHz} (${row.note})`);
        }

        measured.push({ sound: row.sound, peak: env.peak, hz, length: env.audibleFor, pure: !!row.pure });
      }

      // Section 7.2's design pillar, in the mix rather than in the noise radii:
      // the Warden's footstep is "noticeably heavier and louder".
      const shade = measured.find((m) => m.sound === 'shadeFootstep');
      const warden = measured.find((m) => m.sound === 'wardenFootstep');
      if (shade && warden) {
        if (!(warden.peak > shade.peak)) {
          problems.push(`the Warden's footstep peaks at ${warden.peak.toFixed(3)} against the Shade's ${shade.peak.toFixed(3)}`);
        }
        if (!(warden.hz < shade.hz)) {
          problems.push(`the Warden's footstep is not lower than the Shade's (${warden.hz.toFixed(0)} vs ${shade.hz.toFixed(0)}Hz)`);
        }
      }

      const summary = measured.slice(0, 5)
        .map((m) => `${m.sound} ${m.hz.toFixed(0)}Hz/${m.length.toFixed(2)}s`).join(', ');
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${measured.length} sounds rendered to samples, none silent, none clipping, all decaying: `
            + `${summary}...; the Warden's footstep is louder (${warden.peak.toFixed(2)} vs `
            + `${shade.peak.toFixed(2)}) and lower (${warden.hz.toFixed(0)} vs ${shade.hz.toFixed(0)}Hz)`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-hud-fits-on-screen-and-does-not-overlap-itself',
    spec: 'Section 13',
    name: 'Every panel is inside the viewport and clear of the others, at three aspect ratios',
    run: (h) => {
      const problems = [];
      const hud = h.hud;
      const wasVisible = hud.visible;
      hud.setVisible(true);
      hud.update(0.016, {
        role: 'shade', freeroam: false, health: 100, lives: 3, visibility: 60,
        loadout: { smoke: 2, flashbang: 2 }, taserCharge: 1, taserRecharge: 0,
        timeRemaining: 137, planted: false, plantProgress: 0, defuseProgress: 0,
        promptInRange: true, awaitingReinsert: false, score: { shade: 1, warden: 1 },
        roundNumber: 3, blind: 0,
      });
      hud.push('a kill feed line long enough to matter');

      const panels = [...hud.root.querySelectorAll('.panel')].filter((el) => {
        const style = getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
      if (panels.length < 4) problems.push(`only ${panels.length} HUD panels are showing`);

      const width = window.innerWidth;
      const height = window.innerHeight;
      const boxes = panels.map((el) => ({ el, r: el.getBoundingClientRect() }));

      for (const { el, r } of boxes) {
        if (r.width === 0 || r.height === 0) continue;
        if (r.left < -1 || r.top < -1 || r.right > width + 1 || r.bottom > height + 1) {
          problems.push(`#${el.id} is off screen (${r.left.toFixed(0)},${r.top.toFixed(0)} to ${r.right.toFixed(0)},${r.bottom.toFixed(0)} in ${width}x${height})`);
        }
      }

      // Overlap. Section 13 asks for flat and legible; two readouts on top of
      // each other is neither.
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i].r;
          const b = boxes[j].r;
          if (a.width === 0 || b.width === 0) continue;
          const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (overlapX > 2 && overlapY > 2) {
            problems.push(`#${boxes[i].el.id} overlaps #${boxes[j].el.id} by ${overlapX.toFixed(0)}x${overlapY.toFixed(0)}px`);
          }
        }
      }

      // The HUD is a DOM overlay (Section 13), so it must not intercept the
      // mouse — the canvas needs every click for pointer lock.
      if (getComputedStyle(hud.root).pointerEvents !== 'none') {
        problems.push('the HUD is capturing pointer events, which would break pointer lock');
      }

      hud.setVisible(wasVisible);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${panels.length} panels at ${width}x${height}: all inside the viewport, none overlapping, `
            + 'and the overlay passes the mouse through to the canvas'
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-frame-budget-holds-everywhere-not-just-at-site-a',
    spec: 'Section 2 / check 29',
    name: 'Sweep viewpoints across the whole map and assert the worst viewpoint\'s median frame, not its unluckiest one',
    // No `glSync`, and the absence is load-bearing rather than an oversight:
    // nothing here waits for the renderer, because nothing here times a draw
    // in order to decide anything. The sample count comes from the URL. A
    // sweep that needs a drain is a sweep gone back to pricing its own frames,
    // which is what took three runs past `--stall-wait` (H36), so the holder
    // check asserts that this flag is not here.
    run: (h) => {
      const problems = [];
      const PERF = CONFIG.performance;
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      h.stepFrames(20);
      const lens = createLens(h);

      // Every waypoint and every site, looking four ways from each.
      const spots = [
        ...h.map.waypoints.map((w) => ({ name: w.tag || `wp${w.id}`, p: w.position })),
        ...h.map.sites.map((s) => ({ name: `site ${s.id}`, p: s.position })),
      ];

      lens.renderOnly();
      let total = 0;
      let samples = 0;
      let peakCalls = 0;
      let peakTriangles = 0;
      let drawn = 0;
      let leanest = Infinity;
      const costs = [];
      let spike = { ms: 0, where: '' };
      // How many timed draws each viewpoint gets, asked of the URL and never
      // of a clock. `viewpointSamples()` carries the whole argument; the short
      // form is that the only barrier in this page that really waits for a
      // draw is asynchronous, so a synchronous timer reads a submission
      // whatever is wrapped round it - 0.6ms standing in front of 610-761ms of
      // work. One here, nine under `npm run bench`.
      const wanted = viewpointSamples(typeof location !== 'undefined' ? location.search : '');

      for (const spot of spots) {
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2;
          const eye = { x: spot.p.x, y: spot.p.y + 1.7, z: spot.p.z };
          lens.look(eye, { x: eye.x + Math.sin(angle) * 10, y: eye.y - 0.2, z: eye.z + Math.cos(angle) * 10 });
          // One untimed draw so a cold view does not count as a slow one, then
          // time the render alone — reading the buffer back would time a GPU
          // sync and a 3.5MB copy instead of the frame.
          lens.renderOnly();
          // As many timed draws as `wanted` asked for, and the viewpoint's
          // cost is their MEDIAN (H36). `VIEWPOINT_BUDGET_MS` is the cap and
          // no longer the decision: nine draws at 2.5ms on this PC's GPU spend
          // 22ms of it and nine right at the 8.33ms ceiling spend 75ms, so any
          // GPU that clears the budget gets all nine it was asked for, and one
          // slow enough to need 15ms a frame gets eight rather than a sweep
          // nine times its own length. Headless `wanted` is one and this loop
          // runs once, which is what the sweep cost before H36 touched it.
          const each = [];
          const openedAt = performance.now();
          do {
            const t0 = performance.now();
            lens.renderOnly();
            each.push(performance.now() - t0);
          } while (each.length < wanted && performance.now() - openedAt < VIEWPOINT_BUDGET_MS);
          const ms = viewpointCost(each);
          const highest = Math.max(...each);
          total += ms;
          samples++;
          drawn += each.length;
          leanest = Math.min(leanest, each.length);
          peakCalls = Math.max(peakCalls, h.renderer.info.render.calls);
          peakTriangles = Math.max(peakTriangles, h.renderer.info.render.triangles);
          costs.push({ ms, where: `${spot.name}@${i}`, calls: h.renderer.info.render.calls });
          if (highest > spike.ms) spike = { ms: highest, where: `${spot.name}@${i}` };
        }
      }

      const mean = total / samples;
      const budget = PERF.frameBudgetMs;
      const ceiling = budget * PERF.cpuBudgetFraction;
      // The busiest places as a SET and the worst as a value, because H36
      // measured that the single worst PLACE does not reproduce at any sample
      // count while the top-ten set does (7-10 of 10 over two benches) - the
      // top of the distribution is a dozen near-ties inside the 0.1ms
      // `performance.now()` is clamped to, so "the worst viewpoint" is not a
      // quantity this can measure. The value is: median-of-nine agreed to
      // 0.2ms between two benches in all six scenes.
      const ranked = costs.slice().sort((a, b) => b.ms - a.ms);
      const worst = ranked[0] || { ms: 0, where: '', calls: 0 };
      // What the verdict rests on, named BEFORE the verdict is formed, because
      // the red is the line the gate prints every run and one sample is not a
      // median. The first draft said "the worst viewpoint's median frame" on
      // every red, which headless - where the sweep is red by design and the
      // count is one - was a claim about a statistic that had not been taken.
      const medians = leanest >= 5
        ? `median of ${leanest}-${wanted}`
        : `${leanest} sample${leanest === 1 ? '' : 's'}, NOT a median - a median wants \`?${VIEWPOINT_SAMPLES_PARAM}=${VIEWPOINT_SAMPLES}\`, which only \`npm run bench\` asks for`;
      if (worst.ms > ceiling) {
        problems.push(leanest >= 5
          ? `the worst viewpoint's median frame ("${worst.where}", ${medians}) costs ${worst.ms.toFixed(2)}ms, over the ${ceiling.toFixed(2)}ms ceiling`
          : `the worst viewpoint ("${worst.where}") costs ${worst.ms.toFixed(2)}ms on ${medians}, over the ${ceiling.toFixed(2)}ms ceiling`);
      }
      if (peakCalls > 600) problems.push(`${peakCalls} draw calls at the busiest viewpoint`);
      if (lens.glError() !== 0) problems.push('GL error during the sweep');

      lens.restore();
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      // The spike is REPORTED and never asserted: one of them read 13.80ms on
      // this PC's GPU at a place whose median over fifteen draws is 2.30ms,
      // and it turned this check red (H36). A descheduled frame is not a
      // frame budget. It is printed because a spike that grew would be worth
      // somebody's attention, and `drawn`/`leanest` are printed so a reader
      // can see whether the medians are medians at all.
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${samples} viewpoints across ${spots.length} places, ${drawn} timed draws (${medians}): mean ${mean.toFixed(2)}ms, worst `
            + `${worst.ms.toFixed(2)}ms at "${worst.where}" (${worst.calls} calls) against a ${ceiling.toFixed(2)}ms draw ceiling; `
            + `busiest ${ranked.slice(0, 3).map((c) => `${c.where} ${c.ms.toFixed(2)}`).join(', ')}; `
            + `worst single draw ${spike.ms.toFixed(2)}ms at "${spike.where}", reported not asserted (H36); `
            + `peak ${peakCalls} calls / ${peakTriangles} triangles`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'a-whole-match-leaks-nothing',
    spec: 'Section 15 / Section 18',
    name: 'Play five rounds and every pool, listener and GPU resource is where it started',
    run: (h) => {
      const problems = [];
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      h.stepFrames(60);

      const count = (object) => {
        let n = 0;
        object.traverse(() => { n++; });
        return n;
      };
      const snapshot = () => ({
        sceneNodes: count(h.scene),
        geometries: h.renderer.info.memory.geometries,
        textures: h.renderer.info.memory.textures,
        programs: h.renderer.info.programs.length,
        listeners: ['noise', 'combat:death', 'combat:damage', 'gadget:detonate', 'objective:round-end',
          'ai:throw', 'gadget:alarm', 'sim:step', 'frame:render']
          .reduce((sum, event) => sum + h.emitter.listenerCount(event), 0),
        voices: h.audio.voices ? h.audio.voices.size : 0,
        // Gadget effects and smoke must drain. Footprints deliberately are not
        // counted: the AI is still walking at the end of the soak and laying
        // fresh ones, which is the pool working, not leaking.
        effects: h.gadgets.effects.count,
        smokeSprites: h.effects.pooledSprites,
        projectiles: h.gadgets.projectiles.length,
        ragdolls: h.effects.ragdolls.length,
        footprintPool: h.effects.footprints.length,
        particlePool: h.effects.particles.length,
        smokePool: h.effects.smoke.length,
        noisePool: h.detection.noise.events ? h.detection.noise.events.length : 0,
      });

      const before = snapshot();

      // Five rounds of real play, with gadgets thrown, deaths taken and the
      // round reset between each — the whole lifecycle, repeatedly.
      const eye = { x: h.shade.position.x, y: h.shade.feetY + 1.4, z: h.shade.position.z };
      for (let round = 1; round <= 5; round++) {
        h.objective.resetRound(round);
        for (let i = 0; i < Math.round(12 / CONFIG.time.fixedDt); i++) {
          if (i === 120) h.gadgets.throwGadget('smoke', eye, { x: 0, y: 0.2, z: -1 }, 'shade');
          if (i === 240) h.gadgets.throwGadget('flashbang', eye, { x: 0, y: 0.2, z: -1 }, 'shade');
          if (i === 400) {
            h.shade.health = 0;
            h.emitter.emit('combat:death', { target: 'shade', kind: 'test' });
          }
          h.stepFrames(1);
        }
        h.deathCam.restore();
      }
      // Let everything in flight expire.
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      h.stepFrames(Math.ceil((CONFIG.gadgets.smoke.duration + 3) / CONFIG.time.fixedDt));

      const after = snapshot();

      // Fixed pools must be exactly fixed (Section 15).
      for (const key of ['footprintPool', 'particlePool', 'smokePool', 'noisePool']) {
        if (after[key] !== before[key]) problems.push(`${key} went ${before[key]} -> ${after[key]}`);
      }
      // Live counts must drain.
      for (const key of ['effects', 'smokeSprites', 'projectiles', 'ragdolls']) {
        if (after[key] !== 0) problems.push(`${after[key]} ${key} still live after the match`);
      }
      // Nothing may accumulate.
      if (after.listeners !== before.listeners) {
        problems.push(`emitter listeners went ${before.listeners} -> ${after.listeners}`);
      }
      if (after.sceneNodes > before.sceneNodes) {
        problems.push(`the scene grew by ${after.sceneNodes - before.sceneNodes} nodes`);
      }
      if (after.geometries > before.geometries) {
        problems.push(`GPU geometries went ${before.geometries} -> ${after.geometries}`);
      }
      if (after.textures > before.textures) {
        problems.push(`GPU textures went ${before.textures} -> ${after.textures}`);
      }
      if (after.programs > before.programs) {
        problems.push(`shader programs went ${before.programs} -> ${after.programs}`);
      }
      if (h.debugTools.assertionFailures !== 0) {
        problems.push(`${h.debugTools.assertionFailures} runtime assertion failures during the soak`);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `5 rounds with smoke, flashbangs and deaths: scene ${before.sceneNodes} nodes, `
            + `${before.geometries} geometries, ${before.textures} textures, ${before.programs} programs and `
            + `${before.listeners} listeners — all unchanged; every pool fixed and every live count drained to 0`
          : problems.join('; '),
      };
    },
  });
}
