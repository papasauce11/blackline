/**
 * BLACKLINE - tests/quality.js
 *
 * AUTO suite (Section 4.1, Section 13, H10): the quality presets, read off the
 * renderer rather than off the table they came from.
 *
 * Every check here ends at a live object - the drawing buffer's own width, the
 * key light's `shadow.mapSize`, `post.passes` after a frame, the frame's draw
 * calls, the particle slots a burst actually lit. A preset that wrote five
 * fields and a label would look identical from the table, which is the lesson
 * `tests/settings.js` opens with and the reason the Section 13 difficulty
 * control moved a label and nothing else for thirty phases.
 *
 * **The pin is the subject, not an inconvenience.** The headless gate runs under
 * `?quality=medium` precisely so its picture cannot move, so a check that wants
 * to see `low` takes the pin down the way boot puts it up (`pinQuality`) and
 * puts it back in a `finally`. Driving the real resolution path is the point:
 * `activeQuality()` is the question the game asks every frame, and a check that
 * reached past it straight to `applyQuality` would prove the knobs turn without
 * proving anything turns them.
 *
 * And each of them **asserts its own restore**, because this is the one module
 * in the suite that resizes the drawing buffer: a botched put-back here is
 * thirteen pixel-reading modules reading a picture nobody calibrated, and it
 * should be loud where it happened rather than mysterious four checks later.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG, SETTINGS, rng } from '../config.js';
import {
  QUALITY_LEVELS, QUALITY_FALLBACK, activeQuality, applyQuality, createQualityProbe,
  pinQuality, pixelRatioNow, qualityPreset, qualityReadings, requestedQuality, syncQuality,
} from '../quality.js';

const E = CONFIG.effects;
const PP = CONFIG.render.post;
/** The passes E6 composes when the post is on: the bright pass, the blurs, the composite. */
const POST_PASSES = 3 + 2 * PP.blurPasses;

/** Pixels in the drawing buffer, which is what a resolution scale actually buys or saves. */
function bufferPixels(readings) {
  return readings.buffer ? readings.buffer[0] * readings.buffer[1] : 0;
}

/** Particle slots a burst of `count` sparks actually lit, from an empty pool. */
function sparksLit(h, count) {
  // `effects.reset()` is the round's own clear, and every slot it empties is
  // presentation, which the runner resets before the next check anyway (F2).
  // An unemptied pool would count somebody else's sparks as this burst.
  h.effects.reset();
  // The call `effects.js` makes on `combat:impact`, with the argument it passes.
  // Not the event: `combat:impact` is heard by audio and the hit marker too,
  // and half an emitted event leaves the other half behind (TRAPS.md).
  h.effects.sparks({ x: 0, y: 2, z: 0 }, count);
  let lit = 0;
  for (const slot of h.effects.particles) if (slot.life > 0) lit++;
  return lit;
}

/**
 * Put the game at `level` the way a player does - the settings row, with no pin
 * over it - draw one frame at it, and report what that frame cost.
 *
 * The pin has to come down for this. Under the gate's `?quality=medium` the row
 * is deliberately powerless, which is the property that keeps the suite's
 * picture still and is asserted on its own below.
 */
function drawAt(h, level) {
  pinQuality('');
  // The player's post row is held on, because what is under test is the
  // preset's half of the AND (D60) and not somebody else's setting.
  SETTINGS.post = true;
  SETTINGS.quality = level;
  syncQuality();
  h.renderFrame(1 / 60);
  return {
    ...qualityReadings(),
    calls: h.renderer.info.render.calls,
    passes: h.post.passes,
    sparks: sparksLit(h, E.impactSparks),
  };
}

/** Back to whatever the URL and the player's record say, and drawn once at it. */
function putBack(h, was) {
  SETTINGS.quality = was.quality;
  SETTINGS.post = was.post;
  if (was.auto !== undefined) SETTINGS.qualityAuto = was.auto;
  pinQuality(location.search);
  syncQuality();
  h.effects.reset();
  h.renderFrame(1 / 60);
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-quality-level-cannot-move-the-simulation',
    spec: 'Section 2 (the seeded rng), Section 16 check 28, H27',
    name: 'The same seed drives the same simulation at every quality level, although the levels light a different number of particles',
    run: (h) => {
      // H27, and H24 is why. `effects.sparks()` draws three numbers per
      // particle and the preset scales the count, so while those came off the
      // simulation's `rng` the quality setting decided what the Warden did
      // next: 15 draws at medium against 6 at low, and the next burst pause
      // the AI would draw 0.3745 against 0.3492. The streams are split now
      // (`lookRng`), and this holds the split from both ends.
      const problems = [];
      const was = { quality: SETTINGS.quality, post: SETTINGS.post, auto: SETTINGS.qualityAuto };
      const SEED = 0x27a11e;
      const runs = {};
      try {
        pinQuality('');
        SETTINGS.post = true;
        for (const level of QUALITY_LEVELS) {
          SETTINGS.quality = level;
          syncQuality();
          // One seeded match per level, stepped the same way, with the
          // presentation call an impact makes fired on a fixed cadence. The
          // method and not the event: `combat:impact` is heard by the audio and
          // the hit marker too, and half an emitted event leaves the other half
          // behind (TRAPS.md).
          //
          // Sparks and nothing else, deliberately. The first draft also fired
          // `smokeBurst()`, which is the *other* half of that same trap: a
          // cloud with no gadget behind it is a leak as far as
          // `effects-drain-when-idle` is concerned, and it spent the rest of
          // the run asserting "200 smoke sprites still alive 42s after the last
          // gadget expired" - 120 console errors and seven unrelated checks
          // down with it. Smoke is no loss here anyway: its puff count is
          // `spriteCap / count` from config and no preset scales it, so it was
          // never part of what H27 is about.
          h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true, seed: SEED });
          h.effects.reset();
          let lit = 0;
          for (let step = 0; step < 120; step++) {
            h.stepFrames(1);
            if (step % 10 === 0) {
              h.effects.sparks({ x: 0, y: 2, z: 0 }, E.impactSparks);
              lit = 0;
              for (const slot of h.effects.particles) if (slot.life > 0) lit++;
            }
          }
          // The simulation's own state after all that, plus the count of draws
          // it has made and the next number it would hand out. A presentation
          // draw that reached this stream moves every one of them.
          runs[level] = {
            lit,
            simCalls: rng.calls,
            nextDraw: rng.next(),
            warden: [
              h.warden.position.x.toFixed(6), h.warden.position.y.toFixed(6),
              h.warden.position.z.toFixed(6), h.warden.yaw.toFixed(6),
            ].join(','),
            aiState: h.wardenAI.state,
          };
        }
      } finally {
        SETTINGS.quality = was.quality;
        SETTINGS.post = was.post;
        SETTINGS.qualityAuto = was.auto;
        pinQuality(location.search);
        syncQuality();
        h.effects.reset();
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      }

      // 1. The simulation is the same at every level, read four ways. The draw
      // count is the sharpest: it cannot be equal by luck.
      const base = runs[QUALITY_FALLBACK];
      for (const level of QUALITY_LEVELS) {
        const seen = runs[level];
        if (seen.simCalls !== base.simCalls) {
          problems.push(`${level} left the simulation's stream at ${seen.simCalls} draws against ${QUALITY_FALLBACK}'s ${base.simCalls}`);
        }
        if (seen.nextDraw !== base.nextDraw) {
          problems.push(`${level} would hand the simulation ${seen.nextDraw} next and ${QUALITY_FALLBACK} ${base.nextDraw}`);
        }
        if (seen.warden !== base.warden) problems.push(`${level} put the Warden at ${seen.warden}, ${QUALITY_FALLBACK} at ${base.warden}`);
        if (seen.aiState !== base.aiState) problems.push(`${level} left the AI in ${seen.aiState} and ${QUALITY_FALLBACK} in ${base.aiState}`);
      }

      // 2. And the levels really were different pictures while that held - or
      // this check would pass just as well with `particleScale` 1 everywhere,
      // which would "fix" H27 by deleting the feature it is about.
      const litByLevel = QUALITY_LEVELS.map((level) => runs[level].lit);
      if (new Set(litByLevel).size < 2) {
        problems.push(`every level lit ${litByLevel[0]} particles, so the presets no longer scale a burst and this proves nothing`);
      }
      if (!(runs.low.lit < base.lit)) {
        problems.push(`low lit ${runs.low.lit} particles and ${QUALITY_FALLBACK} ${base.lit}; low must light fewer`);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `one seed, ${QUALITY_LEVELS.length} levels: ${base.simCalls} simulation draws and the Warden at the same place in all of them, `
            + `while a burst lit ${QUALITY_LEVELS.map((level) => `${level} ${runs[level].lit}`).join(' / ')}`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-medium-preset-is-what-the-game-drew-before-there-were-presets',
    spec: 'Section 4.1, H10',
    name: 'Medium is the shipped picture knob for knob - the 1024 shadow map, the device ratio, full particles, outlines on, post on - and the cap that makes high a no-op on a 2x display is stated rather than pretended',
    run: (h) => {
      const problems = [];
      const seen = [];
      const was = { quality: SETTINGS.quality, post: SETTINGS.post };

      // Every reading on record was taken at these numbers: the 92-viewpoint
      // sweep, the thirteen pixel-reading modules, every screenshot. Pinned to
      // the constants they came from so the agreement cannot rot quietly - what
      // `each-role-draws-with-the-field-of-view-its-setting-asks-for` does for
      // `fovShade` against `CONFIG.render.fov`.
      const medium = qualityPreset('medium');
      if (medium.shadowMapSize !== CONFIG.render.shadowMapSize) {
        problems.push(`medium's shadow map is ${medium.shadowMapSize} and Section 4.1's is ${CONFIG.render.shadowMapSize}`);
      }
      if (medium.resolutionScale !== 1) problems.push(`medium scales the resolution by ${medium.resolutionScale}`);
      if (medium.particleScale !== 1) problems.push(`medium scales the particles by ${medium.particleScale}`);
      if (medium.outlines !== true) problems.push('medium draws no outlines, and Section 4 is an inverted hull');
      if (medium.post !== true) problems.push('medium has the post off, and E6 shipped it on');
      if (medium.post !== CONFIG.settings.defaults.post) {
        problems.push(`the shipped post default is ${CONFIG.settings.defaults.post} and medium allows ${medium.post}`);
      }
      if (QUALITY_FALLBACK !== 'medium') {
        problems.push(`an unmeasured machine falls back to ${QUALITY_FALLBACK} rather than to the shipped picture`);
      }

      // Three rows, each a step up, or two of the names are one picture under
      // two labels.
      const sizes = QUALITY_LEVELS.map((level) => qualityPreset(level).shadowMapSize);
      for (let i = 1; i < sizes.length; i++) {
        if (!(sizes[i] > sizes[i - 1])) {
          problems.push(`${QUALITY_LEVELS[i]}'s shadow map (${sizes[i]}) is not over ${QUALITY_LEVELS[i - 1]}'s (${sizes[i - 1]})`);
        }
      }
      seen.push(`shadow maps ${sizes.join(' / ')}`);

      try {
        // The honest clause about high. `resolutionScale` multiplies
        // `devicePixelRatio` and `maxPixelRatio` still caps the product, so on
        // a 2x display high and medium ask for the same pixels. Asserted here
        // rather than implied by a row that quietly does nothing.
        pinQuality('');
        SETTINGS.quality = 'high';
        const highOnOne = pixelRatioNow(1);
        const highOnTwo = pixelRatioNow(2);
        SETTINGS.quality = 'medium';
        const mediumOnTwo = pixelRatioNow(2);
        if (!(highOnOne > 1)) problems.push(`high on a 1x display is ${highOnOne}, no more than medium`);
        if (highOnTwo !== mediumOnTwo || highOnTwo !== CONFIG.render.maxPixelRatio) {
          problems.push(`high on a 2x display is ${highOnTwo} and medium ${mediumOnTwo}; the cap is ${CONFIG.render.maxPixelRatio} and both belong at it`);
        }
        seen.push(`high is ${highOnOne} on a 1x display and ${highOnTwo} on a 2x, where the ${CONFIG.render.maxPixelRatio} cap already had it`);

        // And the live picture at medium, off the objects rather than the table.
        const now = drawAt(h, 'medium');
        if (now.shadowMapSize !== CONFIG.render.shadowMapSize) {
          problems.push(`the key light's map is ${now.shadowMapSize} at medium, not ${CONFIG.render.shadowMapSize}`);
        }
        if (now.pixelRatio !== pixelRatioNow()) {
          problems.push(`the renderer is at ${now.pixelRatio} and medium asks for ${pixelRatioNow()}`);
        }
        if (now.outlines.hidden !== 0) problems.push(`${now.outlines.hidden} outlines are hidden at medium`);
        if (now.outlines.shown === 0) {
          problems.push('nothing in the scene carries userData.isOutline, so no outline can be switched off');
        }
        if (now.passes !== POST_PASSES) problems.push(`the frame drew ${now.passes} post passes, not the ${POST_PASSES} E6 composes`);
        if (now.sparks !== E.impactSparks) problems.push(`an impact lit ${now.sparks} sparks at medium, not ${E.impactSparks}`);
        seen.push(`live at medium: ${now.buffer.join('x')} buffer, ${now.shadowMapSize} shadow map, `
          + `${now.outlines.shown} outlines, ${now.passes} post passes, ${now.sparks} sparks`);
      } finally {
        putBack(h, was);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0 ? seen.join('; ') : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'each-quality-preset-changes-what-a-frame-costs',
    spec: 'Section 4.1, Section 16 check 29, H10',
    name: 'Low, medium and high each draw a different number of pixels with a different shadow map, and low costs fewer draw calls, no post passes and fewer sparks',
    run: (h) => {
      const problems = [];
      const seen = [];
      const was = { quality: SETTINGS.quality, post: SETTINGS.post };
      const before = qualityReadings();
      let frames = null;
      try {
        // Each level as a player would have it, one frame apiece.
        frames = { low: drawAt(h, 'low'), medium: drawAt(h, 'medium'), high: drawAt(h, 'high') };
      } finally {
        putBack(h, was);
      }

      // The resolution, in pixels the GPU is actually asked for: the knob a
      // machine feels most and the one a table cannot fake.
      const pixels = {
        low: bufferPixels(frames.low), medium: bufferPixels(frames.medium), high: bufferPixels(frames.high),
      };
      if (!(pixels.low < pixels.medium)) {
        problems.push(`low drew ${frames.low.buffer.join('x')} and medium ${frames.medium.buffer.join('x')}; low must be fewer pixels`);
      }
      // High is capped by `maxPixelRatio`, so on a 2x display it is medium's
      // count and that is not a fault. Smaller than medium would be: the scale
      // would have gone the wrong way.
      if (pixels.high < pixels.medium) {
        problems.push(`high drew ${frames.high.buffer.join('x')}, fewer pixels than medium's ${frames.medium.buffer.join('x')}`);
      }
      const capped = frames.high.pixelRatio === CONFIG.render.maxPixelRatio && pixels.high === pixels.medium;
      seen.push(`buffers ${frames.low.buffer.join('x')} / ${frames.medium.buffer.join('x')} / ${frames.high.buffer.join('x')}`
        + `${capped ? ` (high at the ${CONFIG.render.maxPixelRatio} cap, so medium's count on this display)` : ''}`);

      // The shadow map. three sizes the depth target once and never looks
      // again, so a stale reading here is the bug that would leave every level
      // drawing at whatever the first one asked for.
      for (const level of QUALITY_LEVELS) {
        const want = qualityPreset(level).shadowMapSize;
        if (frames[level].shadowMapSize !== want) {
          problems.push(`${level} left the key light's map at ${frames[level].shadowMapSize}, not ${want}`);
        }
      }
      seen.push(`shadow maps ${QUALITY_LEVELS.map((level) => frames[level].shadowMapSize).join(' / ')}`);

      // The post, the outlines and the particles: low is the level that stops
      // paying for them, and each is read off what the frame did.
      if (frames.low.passes !== 0) problems.push(`low drew ${frames.low.passes} post passes`);
      if (frames.medium.passes !== POST_PASSES) problems.push(`medium drew ${frames.medium.passes} post passes, not ${POST_PASSES}`);
      // Every one of those frames had the player's post row on, so low is the
      // preset overriding the row rather than the row being off (D60) - and
      // the row is still on afterwards, not rewritten by the level.
      if (frames.low.postRow !== true || frames.medium.postRow !== true) {
        problems.push('a preset rewrote the post row instead of overriding it');
      }
      if (frames.low.post !== false) problems.push('low reports the post on');
      if (frames.low.outlines.shown !== 0) problems.push(`low still draws ${frames.low.outlines.shown} outlines`);
      if (frames.medium.outlines.hidden !== 0) problems.push(`medium hides ${frames.medium.outlines.hidden} outlines`);
      if (!(frames.low.calls < frames.medium.calls)) {
        problems.push(`low's frame took ${frames.low.calls} draw calls and medium's ${frames.medium.calls}; with the outlines and the post off it must take fewer`);
      }
      if (!(frames.low.sparks < frames.medium.sparks)) {
        problems.push(`an impact lit ${frames.low.sparks} particles at low and ${frames.medium.sparks} at medium`);
      }
      seen.push(`draw calls ${frames.low.calls} / ${frames.medium.calls} / ${frames.high.calls}`);
      seen.push(`low: ${frames.low.passes} post passes, ${frames.low.outlines.hidden} outlines off, `
        + `${frames.low.sparks} sparks against medium's ${frames.medium.sparks}`);

      // This is the one module in the suite that resizes the drawing buffer,
      // and thirteen pixel-reading modules run beside it.
      const after = qualityReadings();
      if (after.level !== before.level) problems.push(`left the game at ${after.level}, which was ${before.level}`);
      if (after.pixelRatio !== before.pixelRatio) problems.push(`left the pixel ratio at ${after.pixelRatio}, which was ${before.pixelRatio}`);
      if (String(after.buffer) !== String(before.buffer)) {
        problems.push(`left the buffer ${after.buffer.join('x')}, which was ${before.buffer.join('x')}`);
      }
      if (after.shadowMapSize !== before.shadowMapSize) {
        problems.push(`left the shadow map at ${after.shadowMapSize}, which was ${before.shadowMapSize}`);
      }
      if (after.post !== before.post) problems.push(`left the post ${after.post ? 'on' : 'off'}, which was ${before.post ? 'on' : 'off'}`);
      if (after.outlines.hidden !== before.outlines.hidden) {
        problems.push(`left ${after.outlines.hidden} outlines hidden, which was ${before.outlines.hidden}`);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${seen.join('; ')}; put back at ${after.level}, ${after.buffer.join('x')}`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-quality-probe-picks-the-level-its-frame-times-ask-for',
    spec: 'Section 16 check 29, H10',
    name: 'The probe picks from the median of the frames it measured, throws the warm ones away, answers nothing early, stops, and the real boot left its reading in the report',
    run: (h) => {
      const problems = [];
      const seen = [];
      const P = CONFIG.quality.probe;
      // What the probe samples is a CPU number, so the budget is the CPU's
      // share of the frame's.
      const budget = CONFIG.performance.frameBudgetMs * CONFIG.performance.cpuBudgetFraction;
      // Feed a fresh probe `count` frames of `ms` each.
      const feed = (ms, count) => {
        const probe = createQualityProbe();
        for (let i = 0; i < count; i++) probe.sample(ms);
        return probe;
      };
      const enough = P.warmFrames + P.maxFrames;

      // Three machines. The thresholds are fractions of Section 2's frame
      // budget, so what is fed here is derived from the budget rather than
      // typed beside the threshold - a check that reads the constant the
      // derivation read can only ever agree with it (HANDOFF.md).
      const fastMs = budget * P.highFraction * 0.5;
      const midMs = budget * (P.highFraction + P.mediumFraction) / 2;
      const slowMs = budget * P.mediumFraction * 4;
      const fast = feed(fastMs, enough);
      const middling = feed(midMs, enough);
      const slow = feed(slowMs, enough);
      if (fast.pick !== 'high') problems.push(`${fastMs.toFixed(2)}ms frames picked ${fast.pick}, not high`);
      if (middling.pick !== 'medium') problems.push(`${midMs.toFixed(2)}ms frames picked ${middling.pick}, not medium`);
      if (slow.pick !== 'low') problems.push(`${slowMs.toFixed(2)}ms frames picked ${slow.pick}, not low`);
      seen.push(`${fastMs.toFixed(1)} / ${midMs.toFixed(1)} / ${slowMs.toFixed(1)}ms frames pick ${fast.pick} / ${middling.pick} / ${slow.pick}`);

      // And which budget it judges them against, which the three above cannot
      // tell you: they are derived from the same constant the probe reads, and
      // a check that reads the constant the derivation read can only ever agree
      // with it (HANDOFF.md). A median **between** the CPU's share and the whole
      // frame's must pick `low`, and would pick `medium` off the frame budget -
      // the mistake `cpuBudgetFraction` exists to prevent, and the one the first
      // headless run of this probe actually made (6.30ms read as `high`).
      const whole = CONFIG.performance.frameBudgetMs;
      const between = feed((budget + whole) / 2, enough);
      if (between.pick !== 'low') {
        problems.push(`${((budget + whole) / 2).toFixed(2)}ms picked ${between.pick}; a CPU frame is allowed ${budget.toFixed(2)}ms, not the frame's ${whole.toFixed(2)}`);
      }
      if (between.budgetMs !== budget) problems.push(`the probe judges against ${between.budgetMs.toFixed(2)}ms, not the ${budget.toFixed(2)}ms a CPU frame is allowed`);
      seen.push(`judged against the ${budget.toFixed(2)}ms a CPU frame is allowed, not the frame's ${whole.toFixed(2)}`);

      // The warm frames are discarded, and no answer comes out of one sample:
      // the first draws of a cold renderer are a shader compile, and picking
      // from them would put a fast machine on low for the life of the browser.
      const young = createQualityProbe();
      for (let i = 0; i < P.warmFrames; i++) young.sample(budget * 40);
      if (young.samples !== 0) problems.push(`${young.samples} of the first ${P.warmFrames} frames were sampled, and every one is warm-up`);
      if (young.done) problems.push('the probe was done before it had measured anything');
      young.sample(fastMs);
      if (young.samples !== 1) problems.push(`the frame after the warm-up was not sampled (${young.samples} samples)`);
      if (young.done) problems.push(`the probe answered on ${young.samples} sample and its floor is ${P.minFrames}`);
      seen.push(`${P.warmFrames} warm frames discarded, nothing answered before ${P.minFrames} samples`);

      // Discarded, not averaged in. This is the reading that decides whether a
      // real machine is judged by its compile or by its frames.
      const compiled = createQualityProbe();
      for (let i = 0; i < P.warmFrames; i++) compiled.sample(budget * 60);
      for (let i = 0; i < P.maxFrames; i++) compiled.sample(fastMs);
      if (compiled.pick !== 'high') {
        problems.push(`a compile then ${P.maxFrames} fast frames picked ${compiled.pick}; the warm frames are still in the median`);
      }
      // And it stops, or a player never gets a pick and every frame pays for
      // the measuring.
      if (!compiled.done) problems.push(`${enough} frames in and the probe is still measuring`);
      if (compiled.samples > P.maxFrames) problems.push(`the probe took ${compiled.samples} samples and its ceiling is ${P.maxFrames}`);
      // Two seconds of measured cost is the other way it stops, and the one
      // that ends it on this machine: a frame here is ~400ms, so five spend it.
      const heavy = createQualityProbe();
      for (let i = 0; i < P.warmFrames + P.minFrames; i++) heavy.sample(P.budgetMs / P.minFrames);
      if (!heavy.done) problems.push(`${P.budgetMs}ms of measured frames did not spend the probe's budget`);
      seen.push(`stops at ${compiled.samples} samples or ${P.budgetMs}ms of them, whichever comes first`);

      // And the half nothing above can prove: that the real boot asked. H4's
      // discipline - a check that picks its own inputs owes the suite the
      // reading the live path produced.
      const live = h.debugState.quality;
      if (!live) problems.push('debugState.quality is unset, so the boot never installed the presets');
      else if (!live.probe) problems.push('the boot drew frames and the probe recorded no reading');
      else {
        if (QUALITY_LEVELS.indexOf(live.probe.pick) === -1) problems.push(`the boot's probe picked "${live.probe.pick}"`);
        if (!(live.probe.samples >= P.minFrames)) problems.push(`the boot's probe answered on ${live.probe.samples} samples`);
        seen.push(`the boot's own probe: ${live.probe.pick} (${live.probe.why})`);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0 ? seen.join('; ') : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'a-quality-pin-decides-what-is-applied-and-the-probe-only-records',
    spec: 'Section 13, H10',
    name: 'Under ?quality= no settings row and no auto pick can move the picture, an unknown level is no pin at all, and unpinned the row decides',
    run: (h) => {
      const problems = [];
      const seen = [];
      const was = { quality: SETTINGS.quality, post: SETTINGS.post, auto: SETTINGS.qualityAuto };
      try {
        // What the pin is for. The probe picks `low` under software WebGL every
        // time, and a gate that drew with the post off, the outlines off and
        // the resolution at 0.7 would turn thirteen pixel-reading modules red
        // for a reason with nothing to do with the game - consistently, not
        // flakily, which is worse. So with a pin up, nothing a player can touch
        // moves the picture.
        pinQuality('?quality=high');
        for (const level of [...QUALITY_LEVELS, 'auto']) {
          SETTINGS.quality = level;
          SETTINGS.qualityAuto = 'low';
          if (activeQuality() !== 'high') {
            problems.push(`with ?quality=high pinned, the row at "${level}" draws ${activeQuality()}`);
          }
        }
        if (applyQuality(activeQuality()).level !== 'high') problems.push('the pin applied something other than high');
        if (syncQuality() !== null) problems.push('a frame under the pin reached for the knobs when nothing had moved');
        seen.push('a pin holds the picture against every row and against auto');

        // A typo is no pin. Becoming a level silently would be worse than
        // being ignored: the URL would then be lying about the picture.
        if (requestedQuality('?quality=ultra') !== null) problems.push('"ultra" was accepted as a pin');
        if (requestedQuality('?map=yard') !== null) problems.push('a query with no quality= produced a pin');
        if (requestedQuality('?seed=1&quality=low&map=yard') !== 'low') problems.push('quality= in the middle of a query was missed');
        if (requestedQuality('?equality=low') !== null) problems.push('"equality=low" was read as a pin');
        seen.push('an unknown level, and a key that merely ends in quality, are no pin');

        // Unpinned, the row decides - including auto falling through to
        // whatever the probe stored, and to the shipped picture before there
        // is one.
        pinQuality('');
        for (const level of QUALITY_LEVELS) {
          SETTINGS.quality = level;
          if (activeQuality() !== level) problems.push(`unpinned, the row at "${level}" draws ${activeQuality()}`);
        }
        SETTINGS.quality = 'auto';
        SETTINGS.qualityAuto = 'high';
        if (activeQuality() !== 'high') problems.push(`auto with a stored pick of high draws ${activeQuality()}`);
        SETTINGS.qualityAuto = null;
        if (activeQuality() !== QUALITY_FALLBACK) {
          problems.push(`auto before any measurement draws ${activeQuality()}, not ${QUALITY_FALLBACK}`);
        }
        seen.push(`unpinned, auto draws its stored pick and ${QUALITY_FALLBACK} before there is one`);
      } finally {
        putBack(h, was);
      }

      const after = qualityReadings();
      if (after.level !== activeQuality()) problems.push(`left the game at ${after.level} against ${activeQuality()}`);

      return {
        pass: problems.length === 0,
        detail: problems.length === 0 ? `${seen.join('; ')}; put back at ${after.level}` : problems.join('; '),
      };
    },
  });
}
