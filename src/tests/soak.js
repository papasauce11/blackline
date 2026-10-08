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
 * sweep will spend buying them (H36). Both are measured numbers.
 *
 * The sweep used to time **one** draw per viewpoint and assert the highest of
 * them against the ceiling, so its verdict was a single frame. H36 benched it
 * twice on this PC's GPU with fifteen draws per viewpoint and asked what a
 * sample count would have to be for that verdict to reproduce. Three answers.
 *
 *   - **The worst PLACE never reproduces, at any count up to fifteen.** The
 *     top-three places overlapped one or two of three in every one of the six
 *     scenes. It is not noise in the measurement: at a median of fifteen,
 *     **4 to 13 viewpoints of 92 sit within 0.2ms of the top** and 18 to 41
 *     within 0.5ms, on a clock `performance.now()` clamps to **0.1ms**. The
 *     top of the distribution is a dozen near-ties, so which one is "worst" is
 *     decided by one or two ticks and no count can fix it. The top **ten as a
 *     set** does reproduce - 7 to 10 of 10 - so the busiest *neighbourhood* is
 *     a real finding and the busiest *viewpoint* is not.
 *   - **The worst VALUE settles as a median and never as a maximum.** Two
 *     benches agreed within 0.3ms in all six scenes from five samples and
 *     within 0.2ms from nine, where the max-of-N gap was still 1.0-1.1ms at
 *     fifteen on the yard and on the plant at `medium` *grew* from 0.1ms at
 *     nine to 0.6ms at fifteen - because a longer run gives a spike more
 *     chances. **More samples make a maximum worse**, which is the whole
 *     argument for the median. What a median does **not** survive is a
 *     sustained stall, and the fourth bench produced one: `deck-office-door@0`
 *     on the plant at `medium` read a median of **4.80ms** across all nine
 *     draws where two benches read it at 2.20ms with a maximum of 2.30, and
 *     the next bench put its worst single draw at 3.80ms. Four readings of
 *     that scene's worst median go 2.60, 2.40, **4.80**, 2.60. So nine samples
 *     buy about 20ms of window, and anything that slows the machine for longer
 *     than the window is inside every sample of it. No count fixes that; the
 *     **headroom** does, and the worst of those four is 58% of the ceiling.
 *   - **And a spike had already turned this check red on a real GPU.** One
 *     reading at `bay-a-north` on the yard at `medium` came back **13.80ms**
 *     against the 8.33ms ceiling; the same place in the next bench reads a
 *     median of **2.30ms** and a maximum of 2.40ms over fifteen draws. H36's
 *     queue line said nothing on this GPU came within 1.5x of the ceiling.
 *     Something did, and it was a descheduled frame rather than a cost.
 *
 * Nine, because nine is where two benches agreed to 0.2ms everywhere. The
 * **budget** rather than a flat nine is what lets one check be honest on two
 * renderers: a 2.5ms draw on this GPU buys all nine inside 120ms, a draw right
 * at the 8.33ms ceiling still buys nine, and a 400ms SwiftShader draw buys
 * one - so the gate, which runs this check and drops only its verdict, pays
 * exactly what it always paid. `the-bench-only-list-holds-only-checks-the-bench
 * -itself-runs` holds both numbers and the median against this file's text.
 */
export const VIEWPOINT_SAMPLES = 9;
export const VIEWPOINT_BUDGET_MS = 120;

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
    // Since H36 this synchronises twice before the sweep - once to clear
    // whatever the run has queued and once to time a single draw start to
    // finish - so the wait belongs on the run's clock and not inside this
    // check's ms (F11, D48). Without the flag the drain stands the heartbeat
    // still and `--stall` kills the run rather than `--stall-wait`.
    glSync: true,
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
      // How many samples the budget can actually afford, asked **once, by
      // making one draw finish**. This is H36's second lesson and it cost a
      // crashed verify to learn: a wall clock around `renderOnly()` does not
      // measure a draw, it measures *submitting* one. Probed here, SwiftShader
      // submits a draw in **1.7-2.2ms and then takes 40,030ms to drain five of
      // them** - about eight seconds of real work behind each 1.7ms
      // submission, which is F11's pipeline tail seen from the inside. So a
      // 120ms budget wrapped round submissions bought all nine samples
      // headless, nine times the commands went into the queue, and the tail
      // ran past the 600s `--stall-wait` and killed the run.
      //
      // The first fix was wrong too and is worth recording: the GPU timer
      // extension is **present** under this SwiftShader build, so gating on
      // `getExtension('EXT_disjoint_timer_query_webgl2')` gated nothing. H11's
      // claim was that it returns *usable* timings on a real driver, not that
      // it is absent on a software one, and presence is not usefulness.
      //
      // One synchronisation, before the sweep, is what answers it honestly:
      // `glError()` after a timed draw cannot return until that draw is done,
      // so this reads what a draw really costs on whatever renderer this is -
      // and then the budget decides, which is what the budget was always
      // claiming to do. It is one sync for the whole sweep, and the work it
      // waits for is work something was going to pay for at the next check
      // anyway (D48). Headless that gives one sample and the sweep costs what
      // it always cost, which is what the gate is owed: it runs this check and
      // drops only its verdict.
      // Drain first, THEN time one draw. The drain is necessary and is its own
      // small lesson: a `glError()` waits for everything queued, not for the
      // draw just issued, so timing a draw with a backlog in front of it
      // measures the backlog. This was measured the wrong way round once - a
      // probe read "8 seconds a draw" that was really 60 warmed frames of
      // somebody else's queue - and the number it produced happened to give the
      // right answer for the wrong reason, which is the sort of thing that
      // survives until it does not.
      lens.renderOnly();
      lens.glError();
      const probeStarted = performance.now();
      lens.renderOnly();
      lens.glError();
      const trueDrawMs = performance.now() - probeStarted;
      const wanted = trueDrawMs * VIEWPOINT_SAMPLES <= VIEWPOINT_BUDGET_MS ? VIEWPOINT_SAMPLES : 1;

      for (const spot of spots) {
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2;
          const eye = { x: spot.p.x, y: spot.p.y + 1.7, z: spot.p.z };
          lens.look(eye, { x: eye.x + Math.sin(angle) * 10, y: eye.y - 0.2, z: eye.z + Math.cos(angle) * 10 });
          // One untimed draw so a cold view does not count as a slow one, then
          // time the render alone — reading the buffer back would time a GPU
          // sync and a 3.5MB copy instead of the frame.
          lens.renderOnly();
          // As many timed draws as `VIEWPOINT_BUDGET_MS` affords, up to
          // `VIEWPOINT_SAMPLES`, and the viewpoint's cost is their MEDIAN
          // (H36). The budget rather than a flat count is what keeps this
          // honest on both renderers at once: on this PC's GPU a draw is about
          // 2.5ms, so the budget buys all nine; under SwiftShader a draw is
          // 400ms, so it buys one and the sweep costs exactly what it always
          // did, which matters because the gate runs this check and drops only
          // its verdict. A machine right at the ceiling still gets all nine.
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
      if (worst.ms > ceiling) {
        problems.push(`the worst viewpoint's median frame ("${worst.where}") costs ${worst.ms.toFixed(2)}ms, over the ${ceiling.toFixed(2)}ms ceiling`);
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
      const medians = leanest >= 5
        ? `median of ${leanest}-${VIEWPOINT_SAMPLES}`
        : `${leanest} sample${leanest === 1 ? '' : 's'}, NOT a median - a synced draw took ${trueDrawMs.toFixed(0)}ms here, so ${VIEWPOINT_SAMPLES} of them do not fit ${VIEWPOINT_BUDGET_MS}ms`;
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
