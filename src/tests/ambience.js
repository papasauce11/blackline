/**
 * BLACKLINE - tests/ambience.js
 *
 * AUTO suite (I1; D50: no music, the map's own sound carries it): every map's
 * bed is there, is what it says it is, loops without a click, and is louder
 * in a bigger room.
 *
 * **What the bed is held to, and what it is not.** Nobody has heard these
 * beds, which is why they are rendered rather than counted: `renderBedOffline`
 * plays the bed the way the game does (a looped buffer source) for two
 * loops, so the seam is read at the sample where the browser's own loop
 * crosses it and not at the end of an array. Every threshold is derived from
 * the recipe's own numbers in `CONFIG.ambience`; none was fitted to a render.
 * What nothing here says is that it sounds good - that is Josh's, on the live
 * site (D84) - only that it is not silent, not clipped, not clicking, and
 * not the wrong instrument.
 *
 *   a. **Audible, and not clipped.** RMS above half of what the recipe's own
 *      gains put there (the hum's partials on the plant, the wind's floor on
 *      the yard), peak under full scale, no NaN.
 *   b. **The seam.** The step from the last sample to the first is no larger
 *      than the 99.9th percentile of every step inside the loop, and the RMS
 *      of the last and first 50 ms agree within what noise of that bandwidth
 *      allows (3 sigma of an RMS estimate, 1/sqrt(2BT)). One event is put
 *      across the seam by the recipe on purpose, so a bed whose wrap is gone
 *      fails here and not by luck. The render is also the same samples on its
 *      second pass, which is what `loop = true` is.
 *   c. **Seeded.** One seed, one buffer, sample for sample; another seed, a
 *      different one; the two maps' beds are not one another.
 *   d. **The character.** The plant's spectral peak is on the hum's
 *      fundamental or a harmonic of it, each partial (and the beating
 *      neighbour of the second) stands well clear of the floor and a frequency
 *      between two harmonics does not; the yard's energy is nearly all below
 *      twice the wind's low-pass corner.
 *   e. **The room.** With the Shade stood in the map's smallest room and then
 *      in its largest (outdoors, on a map under the sky), the bed's target
 *      level is the configured curve at that volume, and the larger is
 *      louder by at least `roomGain.minRatio`.
 *
 * And the live bed: a started graph has one, looping, and not a voice - so
 * `reset()` between rounds does not stop it.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { mapIds, isOutdoorMap } from '../maps/index.js';
import { synthesiseBed, renderBedOffline } from '../systems/ambience.js';

const A = CONFIG.ambience;
const TAU = Math.PI * 2;
const RATE = 44100;
/** The window each end of the loop is read over. */
const END_SECONDS = 0.05;
/** The spectrum window: the largest power of two inside one loop (11.9 s of 12). */
const FFT_SIZE = 1 << 19;

/** The recipe's own account of how loud its bed is: half of it is the floor, so a dropped layer is red and a retune is not. */
const expectedRms = {
  plant: () => {
    const H = A.beds.plant.hum;
    const squares = H.harmonics.reduce((sum, a) => sum + a * a, 0) + H.harmonics[1] ** 2;
    return H.gain * Math.sqrt(squares / 2);
  },
  yard: () => A.beds.yard.wind.gain * A.beds.yard.wind.base,
};

/** The noise bandwidth each bed's RMS estimate is made over. */
const bandwidth = {
  plant: () => A.beds.plant.vent.centre / A.beds.plant.vent.q,
  yard: () => A.beds.yard.wind.cutoff,
};

/** In-place radix-2 FFT. */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = -TAU / len;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const next = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = next;
      }
    }
  }
}

/** Hann-windowed power spectrum of the first FFT_SIZE samples, with the width of a bin. */
function spectrum(samples) {
  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) re[i] = samples[i] * (0.5 - 0.5 * Math.cos((TAU * i) / FFT_SIZE));
  fft(re, im);
  const power = new Float64Array(FFT_SIZE / 2);
  for (let k = 0; k < power.length; k++) power[k] = re[k] * re[k] + im[k] * im[k];
  return { power, binHz: RATE / FFT_SIZE };
}

/** The strongest power within `width` Hz of `hz`. */
function nearest(spec, hz, width) {
  let best = 0;
  for (let k = Math.floor((hz - width) / spec.binHz); k <= Math.ceil((hz + width) / spec.binHz); k++) {
    best = Math.max(best, spec.power[k]);
  }
  return best;
}

/** The median power from `lo` to `hi` Hz: what "the floor" means below. */
function floorPower(spec, lo, hi) {
  const slice = Array.from(spec.power.slice(Math.ceil(lo / spec.binHz), Math.floor(hi / spec.binHz)));
  slice.sort((a, b) => a - b);
  return slice[slice.length >> 1];
}

const rms = (data, from, to) => {
  let sum = 0;
  for (let i = from; i < to; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / (to - from));
};

const db = (ratio) => 10 * Math.log10(ratio);

/** What the plant's spectrum has to say for itself. */
function plantCharacter(spec) {
  const problems = [];
  const H = A.beds.plant.hum;
  const f0 = H.fundamental;
  let peak = 0;
  for (let k = Math.ceil(20 / spec.binHz); k < spec.power.length; k++) if (spec.power[k] > spec.power[peak]) peak = k;
  const peakHz = peak * spec.binHz;
  const nearHarmonic = H.harmonics.some((_, k) => Math.abs(peakHz - f0 * (k + 1)) <= 3);
  if (!nearHarmonic) problems.push(`spectral peak at ${peakHz.toFixed(1)}Hz, not within 3Hz of a harmonic of ${f0}Hz`);

  const floor = floorPower(spec, 20, 2000);
  const partials = H.harmonics.map((_, k) => f0 * (k + 1)).concat([f0 * 2 + H.beatHz]);
  const MIN_DB = 20;
  for (const hz of partials) {
    const over = db(nearest(spec, hz, 0.15) / floor);
    if (over < MIN_DB) problems.push(`the ${hz}Hz partial stands ${over.toFixed(1)}dB over the floor, want ${MIN_DB}`);
  }
  // Midway between the first two harmonics there is nothing, which is what
  // tells a hum from a flat spectrum with a strong floor.
  const between = db(nearest(spec, f0 * 1.5, 0.15) / floor);
  if (between > 6) problems.push(`${f0 * 1.5}Hz, between two harmonics, stands ${between.toFixed(1)}dB over the floor`);
  return { problems, note: `peak ${peakHz.toFixed(2)}Hz (hum ${f0}Hz), partials >= ${MIN_DB}dB over the floor` };
}

/** What the yard's spectrum has to say for itself. */
function yardCharacter(spec) {
  const problems = [];
  const cutoff = A.beds.yard.wind.cutoff * 2;
  let low = 0;
  let total = 0;
  for (let k = 1; k < spec.power.length; k++) {
    total += spec.power[k];
    if (k * spec.binHz <= cutoff) low += spec.power[k];
  }
  const MIN_SHARE = 0.95;
  if (low / total < MIN_SHARE) problems.push(`${(100 * low / total).toFixed(1)}% of the energy is below ${cutoff}Hz (twice the wind's corner), want ${100 * MIN_SHARE}%`);
  return { problems, note: `${(100 * low / total).toFixed(1)}% of the energy below ${cutoff}Hz` };
}

const CHARACTER = { plant: plantCharacter, yard: yardCharacter };

/** Is the point in a declared room? Written out here and not borrowed, so the check is not the code it checks. */
function inRoom(room, at) {
  return at.x >= room.min.x && at.x <= room.max.x && at.z >= room.min.z && at.z <= room.max.z
    && at.y >= room.floorY - 0.5 && at.y <= room.ceilingY;
}

const volumeOf = (room) => (room.max.x - room.min.x) * (room.max.z - room.min.z) * (room.ceilingY - room.floorY);

/** The configured curve, written out from its three numbers. */
function curve(volume) {
  const R = A.roomGain;
  if (volume <= R.smallVolume) return R.floor;
  const t = Math.min(1, Math.log(volume / R.smallVolume) / Math.log(R.largeVolume / R.smallVolume));
  return R.floor + (1 - R.floor) * t;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'each-map-has-a-bed-that-loops-without-a-seam-and-swells-in-big-rooms',
    spec: 'I1; D50; Section 14',
    name: 'Every map has a synthesised ambience bed that is audible, loops without a click, is the same samples for the same seed, has the character of its place, and is louder in a bigger room',
    run: async (h) => {
      const problems = [];
      const notes = [];
      const audio = h.audio;
      if (typeof OfflineAudioContext === 'undefined') return { pass: false, detail: 'no OfflineAudioContext in this browser' };

      const ids = mapIds();
      const beds = {};
      for (const id of ids) {
        if (!A.beds[id] || !CHARACTER[id]) { problems.push(`${id}: no bed in CONFIG.ambience.beds or no character clause in this check`); continue; }
        const loop = Math.round(RATE * A.loopSeconds);
        const rendered = await renderBedOffline(id, A.loopSeconds * 2, A.seed, RATE);
        if (!rendered) { problems.push(`${id}: the bed rendered nothing`); continue; }
        const data = rendered.getChannelData(0);
        // The render is the pure synthesis, to float rounding: playing it added nothing.
        beds[id] = synthesiseBed(id, RATE);
        let altered = 0;
        for (let i = 0; i < loop; i++) if (Math.abs(data[i] - beds[id][i]) > 1e-5) altered++;
        if (altered) problems.push(`${id}: the render differs from the synthesised samples at ${altered} places`);

        // a. Audible, finite, not clipped.
        let peak = 0;
        let bad = 0;
        for (let i = 0; i < loop; i++) {
          if (!Number.isFinite(data[i])) bad++;
          peak = Math.max(peak, Math.abs(data[i]));
        }
        const level = rms(data, 0, loop);
        const floor = expectedRms[id]() * 0.5;
        if (bad) problems.push(`${id}: ${bad} samples are not finite`);
        if (!(level > floor)) problems.push(`${id}: RMS ${level.toFixed(4)}, want above ${floor.toFixed(4)} (half what the recipe's gains give)`);
        if (!(peak < 1)) problems.push(`${id}: peak ${peak.toFixed(3)} clips`);

        // b. The seam, read where the loop crosses it in the render.
        const steps = new Float64Array(loop - 1);
        for (let i = 1; i < loop; i++) steps[i - 1] = Math.abs(data[i] - data[i - 1]);
        const sorted = Array.from(steps).sort((a, b) => a - b);
        const p999 = sorted[Math.floor(sorted.length * 0.999)];
        const seam = Math.abs(data[loop] - data[loop - 1]);
        if (!(seam <= p999)) problems.push(`${id}: the step across the seam is ${seam.toFixed(5)}, past the 99.9th percentile of the loop's own steps (${p999.toFixed(5)})`);
        const end = Math.round(RATE * END_SECONDS);
        const tail = rms(data, loop - end, loop);
        const head = rms(data, loop, loop + end);
        const margin = 3 / Math.sqrt(2 * bandwidth[id]() * END_SECONDS);
        if (Math.abs(tail - head) > margin * Math.max(tail, head)) {
          problems.push(`${id}: the last ${END_SECONDS * 1000}ms read ${tail.toFixed(4)} RMS and the first ${head.toFixed(4)}, apart by more than ${(100 * margin).toFixed(0)}%`);
        }
        let differs = 0;
        for (let i = 0; i < loop; i++) if (Math.abs(data[loop + i] - data[i]) > 1e-5) differs++;
        if (differs) problems.push(`${id}: the second pass of the render is not the first (${differs} samples), so it is not looping`);

        // d. The character.
        const spec = spectrum(data);
        const character = CHARACTER[id](spec);
        for (const p of character.problems) problems.push(`${id}: ${p}`);
        notes.push(`${id} rms ${level.toFixed(3)}, seam ${seam.toFixed(4)} of ${p999.toFixed(4)}, ${character.note}`);
      }

      // c. Seeded.
      for (const id of Object.keys(beds)) {
        const again = synthesiseBed(id, RATE);
        let drift = 0;
        for (let i = 0; i < again.length; i++) if (again[i] !== beds[id][i]) drift++;
        if (drift) problems.push(`${id}: the same seed built a different bed (${drift} samples)`);
        const other = synthesiseBed(id, RATE, A.seed + 1);
        let same = 0;
        for (let i = 0; i < other.length; i++) if (other[i] === beds[id][i]) same++;
        if (same > other.length * 0.1) problems.push(`${id}: another seed built the same bed (${same} samples equal)`);
      }
      const names = Object.keys(beds);
      if (names.length >= 2) {
        let same = 0;
        for (let i = 0; i < beds[names[0]].length; i++) if (beds[names[0]][i] === beds[names[1]][i]) same++;
        if (same > beds[names[0]].length * 0.1) problems.push(`${names[0]} and ${names[1]} are the same bed (${same} samples equal)`);
      }

      // The live bed: one, looping, not a voice.
      if (!audio.unlock()) {
        problems.push('no AudioContext available, so the live bed could not be read');
      } else {
        const bed = audio.ambience;
        if (!bed || !bed.source) problems.push('a started graph has no bed playing');
        else {
          if (!bed.source.loop) problems.push('the live bed is not looping');
          const want = Math.round(audio.context.sampleRate * A.loopSeconds);
          if (bed.source.buffer.length !== want) problems.push(`the live bed is ${bed.source.buffer.length} samples, want ${want}`);
          audio.reset();
          if (!bed.source) problems.push('reset() stopped the bed; a bed is not a voice');
          if (audio.voices.has(bed.source)) problems.push('the bed is counted as a voice');
        }
      }

      // e. The room.
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
      const map = h.map;
      const live = audio.ambience;
      if (!live) problems.push('no bed to ask about rooms');
      else if (!map.rooms.length) problems.push(`${map.id} declares no rooms`);
      else {
        const stand = (spot) => {
          h.shade.position.set(spot.x, spot.y + CONFIG.shade.standHeight / 2 + 0.05, spot.z);
          audio.step(1 / 60);
          return live.targetGain;
        };
        const centre = (room) => ({ x: (room.min.x + room.max.x) / 2, y: room.floorY, z: (room.min.z + room.max.z) / 2 });
        const byVolume = [...map.rooms].sort((a, b) => volumeOf(a) - volumeOf(b));
        const smallest = byVolume[0];
        let largest = byVolume[byVolume.length - 1];
        let largestVolume = volumeOf(largest);
        let largestSpot = centre(largest);
        if (isOutdoorMap(map.id)) {
          const open = [...map.shadeSpawns, ...map.wardenSpawns]
            .map((s) => s.position)
            .find((p) => !map.rooms.some((room) => inRoom(room, { x: p.x, y: p.y + CONFIG.shade.standHeight / 2 + 0.05, z: p.z })));
          if (!open) problems.push(`${map.id} is under the sky and no spawn is outside every room to stand outdoors on`);
          else { largest = null; largestVolume = Infinity; largestSpot = { x: open.x, y: open.y, z: open.z }; }
        }
        const small = stand(centre(smallest));
        const big = stand(largestSpot);
        const wantSmall = curve(volumeOf(smallest));
        const wantBig = curve(largestVolume);
        if (Math.abs(small - wantSmall) > 1e-6) problems.push(`in ${smallest.name} (${volumeOf(smallest).toFixed(0)} m3) the bed's target is ${small.toFixed(3)}, the curve says ${wantSmall.toFixed(3)}`);
        if (Math.abs(big - wantBig) > 1e-6) problems.push(`in ${largest ? largest.name : 'the open'} the bed's target is ${big.toFixed(3)}, the curve says ${wantBig.toFixed(3)}`);
        if (!(big >= small * A.roomGain.minRatio)) problems.push(`the largest space is ${(big / small).toFixed(2)}x the smallest room's level, want at least ${A.roomGain.minRatio}x`);
        if (isOutdoorMap(map.id) && Math.abs(big - 1) > 1e-9) problems.push(`outdoors the bed's target is ${big.toFixed(3)}, want full (1)`);
        // Every room sits on the curve, so a bigger room is never quieter.
        let last = 0;
        for (const room of byVolume) {
          const level = stand(centre(room));
          if (level + 1e-9 < last) problems.push(`${room.name} (${volumeOf(room).toFixed(0)} m3) is quieter (${level.toFixed(3)}) than a smaller room (${last.toFixed(3)})`);
          last = level;
        }
        notes.push(`${map.id}: ${smallest.name} ${small.toFixed(2)} -> ${largest ? largest.name : 'outdoors'} ${big.toFixed(2)} (${(big / small).toFixed(2)}x, floor ${A.roomGain.floor})`);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0 ? notes.join('; ') : problems.join('; '),
      };
    },
  });
}
