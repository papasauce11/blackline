/**
 * BLACKLINE - tests/footsteps.js
 *
 * AUTO suite: a step sounds like the floor under it, and a metal one carries
 * further (I2; Section 7.2, Section 14).
 *
 * Three things are held, each the way a player would meet it:
 *
 *   1. **The floor is read where the foot lands.** On the map the page is on,
 *      the Shade is stood on one box of each class the map has and walked
 *      through `KeyW` until a footstep fires; the event's `surface` is the
 *      class `CONFIG.footsteps.materials` gives that box's finish. The
 *      expectation is read off the config table here, not off the module that
 *      classifies, so a classifier that ignores the finish is a disagreement
 *      and not a tautology.
 *   2. **Metal is louder to the Warden.** The radius on that event is the
 *      walking radius times `noiseScale[class]`, and the ratio of two
 *      classes' radii is the ratio of their scales, to 1e-9.
 *   3. **And it sounds different.** Each class's step is rendered offline and
 *      compared with every other by the RMS of the difference. The margin is
 *      derived from the recipes (below), not measured: a quarter of what the
 *      thinner layer should carry. Concrete's step is the pre-I2 recipe to the
 *      sample (to within the render's own jitter, measured by rendering it again) - rebuilt here from `CONFIG.audio` and rendered through the same
 *      graph - so nothing that never stood on a plate moved.
 *
 * **What a map lacks is said, not invented.** Neither map has a grate: no
 * finish folds into the class (E4, E5 drew concrete, paint, glass, corrugated
 * and wet), so its radius scale and its recipe are held by the config and the
 * render, and no step is walked on one. The yard has no concrete either - its
 * ground is `wet`, its containers `corrugated` - so its ratios are read
 * between the classes it has.
 *
 * **Not measured in a browser.** The predicted levels below ignore the
 * panner (a source at the listener's own position, which `inverse` clamps to
 * the reference distance) and take a bandpass at the Web Audio default Q of 1
 * for about pi/2 of its centre in noise-equivalent width; the margin of a
 * quarter is where that slack lives. The first browser run reads the real
 * differences in the detail line, and the margin is to be tightened to them.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';

const F = CONFIG.footsteps;
const A = CONFIG.audio;
const N = CONFIG.noise;
const S = CONFIG.shade;

const SEED = 20260;
const CLASSES = ['concrete', 'metal', 'grate', 'wet'];
/** A footstep is `footstepStride` of ground, so a strip a little longer than that. */
const STRIP = 4;
const HALF_WIDTH = 0.6;
const MARGIN_ALONG = 0.4;
/** Frames given a walk to produce its first footstep: the stride at a walking pace is well inside it. */
const WALK_FRAMES = 90;

const RATE = 44100;
const SECONDS = 0.5;
/** The sfx bus and the master, which every rendered sample went through. */
const CHAIN = A.busGain.sfx * A.masterGain;
/** A layer must carry this fraction of what its recipe predicts, or it is not there. */
const SHARE = 0.25;
/** The ring is read as gone below this, as the scuff check reads a slap. */
const AUDIBLE = 0.002;
/** Renders of the pre-I2 recipe taken to measure the render's own jitter (the panner is not bit-stable between renders). */
const REPEATS = 4;
/** Concrete may sit this many jitters from the pre-I2 recipe: twice what the recipe differs from itself. */
const JITTER_BAR = 2;
/**
 * And never a bar below this, because the jitter is itself a sample: a probe
 * read it 0 on one pair of renders and 1.8e-4 on another, so four renders can
 * all land quiet and make twice nothing. A step is 0.035 at its peak and the
 * thinnest layer a recipe can lose or gain is a few hundredths, so 1e-3 is
 * still thirty times under a real difference.
 */
const JITTER_FLOOR = 1e-3;

const classOf = (finish) => F.materials[finish] || F.fallback;

// ---------------------------------------------------------------------------
// Predicted levels, from the recipes' own numbers
// ---------------------------------------------------------------------------

/** Decay rate of an envelope that falls from `gain` to the ramp's floor (0.0001) in `duration`. */
const decay = (gain, duration) => Math.log(gain / 0.0001) / duration;
/** RMS over the render window of a sine on that envelope: (1/T) * g^2 / (4r). */
const sineRms = (gain, duration) => CHAIN * Math.sqrt((gain * gain) / (4 * decay(gain, duration)) / SECONDS);
/** The same for uniform noise (variance 1/3) through a filter that passes `pass` of its power. */
const noiseRms = (gain, duration, pass) => (
  CHAIN * Math.sqrt(((1 / 3) * pass * (gain * gain)) / (2 * decay(gain, duration)) / SECONDS)
);
const lowpassPass = (hz) => hz / (RATE / 2);
const bandpassPass = (hz) => (Math.PI / 2) * hz / (RATE / 2);

/** What each class's layer should carry on its own, in the render's units. */
function predictedLayers() {
  const m = F.sounds.metal;
  const g = F.sounds.grate;
  const w = F.sounds.wet;
  return {
    concrete: 0,
    metal: sineRms(m.ringGain, m.ringDuration),
    // Several clicks of one size that do not overlap: their powers add.
    grate: Math.sqrt(g.clicks) * noiseRms(g.clickGain, g.clickDuration, bandpassPass(g.clickBand)),
    wet: noiseRms(w.splashGain, w.splashDuration, lowpassPass(w.splashLowpass)),
  };
}

const rmsOfDifference = (a, b) => {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) sum += (a[i] - b[i]) * (a[i] - b[i]);
  return Math.sqrt(sum / n);
};
const maxAbsDifference = (a, b) => {
  if (a.length !== b.length) return Infinity;
  let worst = 0;
  for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i] - b[i]));
  return worst;
};
const peakOf = (data) => data.reduce((p, v) => Math.max(p, Math.abs(v)), 0);
const lastAudible = (data) => {
  let last = 0;
  for (let i = 0; i < data.length; i++) if (Math.abs(data[i]) > AUDIBLE) last = i;
  return last / RATE;
};

// ---------------------------------------------------------------------------
// Finding a floor of each class
// ---------------------------------------------------------------------------

/**
 * One strip of floor per class the map has: a run of `STRIP` metres along +x
 * or +z, wholly on one box's top, with nothing else solid in the body's way
 * or at the sole's height. Boxes taken by id, so it is the same strip every run.
 */
function findStrips(h) {
  const boxes = h.map.collision.boxes.filter((b) => b.solid && !b.vent && !b.glass);
  const present = new Set(boxes.map((b) => classOf(b.surface)));
  const strips = new Map();
  const clear = (box, x0, z0, x1, z1) => {
    const top = box.max.y;
    for (const other of boxes) {
      if (other === box) continue;
      if (other.max.x <= x0 || other.min.x >= x1 || other.max.z <= z0 || other.min.z >= z1) continue;
      if (other.max.y > top - 0.4 && other.min.y < top + S.standHeight) return false;
    }
    return true;
  };
  for (const box of [...boxes].sort((a, b) => a.id - b.id)) {
    const cls = classOf(box.surface);
    if (strips.has(cls)) continue;
    for (const heading of [{ dx: 1, dz: 0, yaw: -Math.PI / 2 }, { dx: 0, dz: 1, yaw: Math.PI }]) {
      const along = heading.dx ? 'x' : 'z';
      const across = heading.dx ? 'z' : 'x';
      const room = (box.max[along] - box.min[along]) - 2 * MARGIN_ALONG;
      const wide = (box.max[across] - box.min[across]) - 2 * HALF_WIDTH;
      if (room < STRIP || wide < 0) continue;
      const stepAlong = Math.max(1, room / 12);
      const stepAcross = Math.max(1, wide / 6);
      for (let a = box.min[along] + MARGIN_ALONG; a + STRIP <= box.max[along] - MARGIN_ALONG + 1e-9 && !strips.has(cls); a += stepAlong) {
        for (let c = box.min[across] + HALF_WIDTH; c <= box.max[across] - HALF_WIDTH + 1e-9; c += stepAcross) {
          const x0 = heading.dx ? a : c - HALF_WIDTH;
          const x1 = heading.dx ? a + STRIP : c + HALF_WIDTH;
          const z0 = heading.dx ? c - HALF_WIDTH : a;
          const z1 = heading.dx ? c + HALF_WIDTH : a + STRIP;
          if (!clear(box, x0, z0, x1, z1)) continue;
          strips.set(cls, { cls, box, yaw: heading.yaw, y: box.max.y, x: heading.dx ? a : c, z: heading.dx ? c : a, x0, x1, z0, z1 });
          break;
        }
      }
      if (strips.has(cls)) break;
    }
  }
  return { present, strips };
}

/** Walk the Shade from a strip's start with W held until she takes a step; the footstep event, or null. */
function walkUntilStep(h, strip) {
  const shade = h.shade;
  shade.reset({ position: { x: strip.x, y: strip.y, z: strip.z }, yaw: strip.yaw });
  h.stepFrames(2);
  h.input.clearAll();
  h.input.heldCodes.add('KeyW');
  let heard = null;
  // The event is a pooled slot that is rewritten, so what is read is copied out.
  const off = h.emitter.on('noise', (event) => {
    if (!heard && event.type === 'footstep' && event.source === 'shade') {
      heard = { radius: event.radius, surface: event.surface, x: event.x, y: event.y, z: event.z };
    }
  });
  try {
    for (let i = 0; i < WALK_FRAMES && !heard; i++) h.stepFrames(1);
  } finally {
    off();
    h.input.clearAll();
  }
  return heard;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-step-sounds-like-the-floor-under-it-and-metal-carries-further',
    spec: 'Section 7.2, Section 14; I2',
    name: 'A footstep carries the class of the finish under the foot - concrete, metal, grate or wet - metal and its kin carry further to the Warden by the configured scale, and each class renders differently, concrete as it always did',
    run: async (h) => {
      const problems = [];
      const readings = [];
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false, seed: SEED });
      h.menu.hide();

      // -- The config is a table of exactly the four classes. ---------------
      for (const cls of CLASSES) {
        if (!(F.noiseScale[cls] > 0)) problems.push(`noiseScale has no positive entry for ${cls}`);
      }
      if (F.noiseScale.concrete !== 1) problems.push(`concrete scales the radius by ${F.noiseScale.concrete}, and it is the floor the radii were tuned on`);
      if (!(F.noiseScale.metal > F.noiseScale.concrete)) problems.push('metal is not louder than concrete in the config');
      for (const [finish, cls] of Object.entries(F.materials)) {
        if (!CLASSES.includes(cls)) problems.push(`finish "${finish}" names the class "${cls}", which is not one of ${CLASSES.join(', ')}`);
      }

      // -- (a) and (b): walk each class the map has. -------------------------
      const { present, strips } = findStrips(h);
      const lacks = CLASSES.filter((cls) => !present.has(cls));
      const heardBy = new Map();
      try {
        for (const cls of present) {
          const strip = strips.get(cls);
          if (!strip) {
            problems.push(`the map has ${cls} floor but no ${STRIP}m strip of it clear enough to walk`);
            continue;
          }
          const tag = strip.box.tag || `box ${strip.box.id}`;
          const heard = walkUntilStep(h, strip);
          if (!heard) {
            problems.push(`walking ${STRIP}m of ${cls} (${tag}, finish "${strip.box.surface}") took no footstep in ${WALK_FRAMES} frames`);
            continue;
          }
          heardBy.set(cls, heard);
          const inside = heard.x >= strip.x0 - 0.1 && heard.x <= strip.x1 + 0.1 && heard.z >= strip.z0 - 0.1 && heard.z <= strip.z1 + 0.1;
          if (!inside || Math.abs(heard.y - strip.y) > 0.15) {
            problems.push(`the ${cls} step landed at (${heard.x.toFixed(2)}, ${heard.y.toFixed(2)}, ${heard.z.toFixed(2)}), off its strip on ${tag}`);
          }
          if (heard.surface !== cls) {
            problems.push(`a step on ${tag} (finish "${strip.box.surface}") carried the surface "${heard.surface}", want "${cls}"`);
          }
          const want = N.radii.shadeWalk * F.noiseScale[cls];
          if (Math.abs(heard.radius - want) > 1e-9) {
            problems.push(`a ${cls} step carried ${heard.radius}m, want ${want} (${N.radii.shadeWalk} x ${F.noiseScale[cls]})`);
          }
          readings.push(`${cls} on ${tag} ("${strip.box.surface}") ${heard.radius.toFixed(2)}m`);
        }

        // Every pair the map has: the ratio of radii is the ratio of scales.
        const have = [...heardBy.keys()];
        for (let i = 0; i < have.length; i++) {
          for (let j = i + 1; j < have.length; j++) {
            const ratio = heardBy.get(have[i]).radius / heardBy.get(have[j]).radius;
            const want = F.noiseScale[have[i]] / F.noiseScale[have[j]];
            if (Math.abs(ratio - want) > 1e-9) problems.push(`${have[i]} / ${have[j]} radii read ${ratio}, the scales say ${want}`);
          }
        }
        const metal = heardBy.get('metal');
        const concrete = heardBy.get('concrete');
        if (metal && concrete && !(metal.radius > concrete.radius)) {
          problems.push(`a metal step carries ${metal.radius}m, no further than concrete's ${concrete.radius}m`);
        }
      } finally {
        h.input.clearAll();
        h.shade.reset(h.map.shadeSpawns[0]);
      }

      // -- (c): the sound, rendered. ----------------------------------------
      const audio = h.audio;
      let audioReading = '';
      let jitterReading = '';
      if (!audio.unlock()) problems.push('no AudioContext available');
      else if (typeof OfflineAudioContext === 'undefined') problems.push('no OfflineAudioContext in this browser');
      else {
        const table = audio.constructor.BUILDERS;
        const render = async (name, surface) => {
          const buffer = await audio.renderOffline(name, SECONDS, surface);
          return buffer ? buffer.getChannelData(0) : null;
        };

        // The pre-I2 recipes, rebuilt from the same rows of CONFIG.audio and
        // rendered through the same graph. Installed for the render and taken
        // out again, so the enumeration other checks read never sees them.
        const legacy = {
          i2LegacyShadeFootstep(position) {
            const c = A.shadeFootstep;
            return this._noiseBurst(position, { filterType: 'highpass', frequency: c.highpass, duration: c.duration, gain: c.gain });
          },
          i2LegacyWardenFootstep(position) {
            const c = A.wardenFootstep;
            const body = this._noiseBurst(position, { filterType: 'lowpass', frequency: c.lowpass, duration: c.duration, gain: c.gain });
            this._tone(position, { type: 'square', frequency: c.clickFreq, duration: 0.02, gain: c.clickGain });
            return body;
          },
        };
        const before = {};
        // The render's own jitter, measured on the pre-I2 recipe alone: the
        // same graph rendered `REPEATS` times with identical arguments. The
        // panner is not bit-stable from one render to the next (a probe read
        // 6e-5 between two identical renders, 1e-6 between two others), so
        // exact zero was a bar the instrument itself fails.
        const repeats = { shade: [], warden: [] };
        try {
          Object.assign(table, legacy);
          for (let i = 0; i < REPEATS; i++) {
            repeats.shade.push(await render('i2LegacyShadeFootstep'));
            repeats.warden.push(await render('i2LegacyWardenFootstep'));
          }
          before.shade = repeats.shade[0];
          before.warden = repeats.warden[0];
        } finally {
          for (const name of Object.keys(legacy)) delete table[name];
        }
        const samples = { shade: {}, warden: {} };
        for (const cls of CLASSES) {
          samples.shade[cls] = await render('shadeFootstep', cls);
          samples.warden[cls] = await render('wardenFootstep', cls);
        }
        const unnamed = { shade: await render('shadeFootstep'), warden: await render('wardenFootstep') };

        const missing = [];
        for (const who of ['shade', 'warden']) {
          for (const cls of CLASSES) if (!samples[who][cls]) missing.push(`${who} ${cls}`);
          if (!before[who] || !unnamed[who]) missing.push(`${who} reference`);
        }
        if (missing.length) {
          problems.push(`rendered nothing: ${missing.join(', ')}`);
        } else {
          // Concrete is the step it always was, with the class named or not:
          // no further from the pre-I2 recipe than twice what two renders of
          // that recipe differ by, and the same path whether named or not.
          const jitters = [];
          for (const who of ['shade', 'warden']) {
            let jitter = 0;
            for (let i = 0; i < repeats[who].length; i++) {
              for (let j = i + 1; j < repeats[who].length; j++) jitter = Math.max(jitter, maxAbsDifference(repeats[who][i], repeats[who][j]));
            }
            const bar = Math.max(JITTER_BAR * jitter, JITTER_FLOOR);
            const named = maxAbsDifference(samples[who].concrete, before[who]);
            const bare = maxAbsDifference(unnamed[who], before[who]);
            const same = maxAbsDifference(unnamed[who], samples[who].concrete);
            jitters.push(`${who} jitter ${jitter.toExponential(2)} (concrete ${named.toExponential(2)}, bare ${bare.toExponential(2)}, concrete/bare ${same.toExponential(2)})`);
            if (!(named <= bar)) problems.push(`the ${who}'s concrete step differs from the pre-I2 recipe by up to ${named.toExponential(2)}, over the bar of ${bar.toExponential(2)} (${JITTER_BAR}x the render's own jitter of ${jitter.toExponential(2)}, floor ${JITTER_FLOOR})`);
            if (!(bare <= bar)) problems.push(`the ${who}'s step with no surface named differs from the pre-I2 recipe by up to ${bare.toExponential(2)}, over the bar of ${bar.toExponential(2)} (${JITTER_BAR}x the render's own jitter of ${jitter.toExponential(2)}, floor ${JITTER_FLOOR})`);
            if (!(same <= bar)) problems.push(`the ${who}'s named-concrete and unnamed steps differ by up to ${same.toExponential(2)}, over the bar of ${bar.toExponential(2)} (jitter ${jitter.toExponential(2)}): they are not one path`);
          }
          jitterReading = jitters.join('; ');

          // Every pair differs by a margin read off the recipes.
          const predicted = predictedLayers();
          const rows = [];
          for (let i = 0; i < CLASSES.length; i++) {
            for (let j = i + 1; j < CLASSES.length; j++) {
              const a = CLASSES[i];
              const b = CLASSES[j];
              const layers = [predicted[a], predicted[b]].filter((p) => p > 0);
              const need = SHARE * Math.min(...layers);
              const got = rmsOfDifference(samples.shade[a], samples.shade[b]);
              rows.push(`${a}/${b} ${got.toFixed(4)}`);
              if (!(got >= need)) {
                problems.push(`the Shade's ${a} and ${b} steps differ by an RMS of ${got.toExponential(2)}, want at least ${need.toExponential(2)} (a quarter of the thinner layer's predicted ${(need / SHARE).toExponential(2)})`);
              }
            }
          }
          // The Warden's steps tell metal from concrete too, for the same reason.
          const wardenGot = rmsOfDifference(samples.warden.metal, samples.warden.concrete);
          if (!(wardenGot >= SHARE * predicted.metal)) {
            problems.push(`the Warden's metal step differs from her concrete one by an RMS of only ${wardenGot.toExponential(2)}`);
          }

          // A plate rings after the thud has gone; a slab does not.
          const m = F.sounds.metal;
          const ringFor = m.ringDuration * Math.log((m.ringGain * CHAIN) / AUDIBLE) / Math.log(m.ringGain / 0.0001);
          const metalLast = lastAudible(samples.shade.metal);
          const concreteLast = lastAudible(samples.shade.concrete);
          if (!(metalLast >= 0.6 * ringFor)) problems.push(`the metal step is gone by ${metalLast.toFixed(3)}s, its ring should last about ${ringFor.toFixed(3)}s`);
          if (!(metalLast > concreteLast)) problems.push(`the metal step (${metalLast.toFixed(3)}s) does not outlast the concrete one (${concreteLast.toFixed(3)}s)`);
          for (const cls of CLASSES) {
            const peak = peakOf(samples.shade[cls]);
            if (peak > 1.0) problems.push(`the Shade's ${cls} step clips at ${peak.toFixed(2)}`);
          }
          audioReading = `${jitterReading}; rendered RMS differences ${rows.join(', ')}; metal rings ${metalLast.toFixed(3)}s against concrete's ${concreteLast.toFixed(3)}s`;
        }
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `walked ${[...present].join(', ')}${lacks.length ? ` (this map has no ${lacks.join(' or ')}: nothing was invented)` : ''}: ${readings.join('; ')}; ratios match the scales to 1e-9; concrete is the pre-I2 step within the render's own jitter; ${audioReading}`
          : problems.join('; '),
      };
    },
  });
}
