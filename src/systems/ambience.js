/**
 * BLACKLINE - systems/ambience.js
 *
 * The map's own sound (I1; Josh's D50: no music). One bed per map, built once
 * as a looping buffer and played through the audio system's ambience bus:
 * the plant is a transformer's hum with drips and ducting, the yard is wind
 * with a far horn and a clank or two. D9 gives the yard's night no rain, so
 * none is made.
 *
 * **No seam.** A loop is only as good as sample N-1 running into sample 0,
 * and three things can break that, each answered differently:
 *
 *  - A periodic part (the hum, the vent's swell) completes a whole number of
 *    cycles in the loop, so its frequency is rounded to cycles / loopSeconds.
 *  - An event (a drip, a gust, the horn, a clank) is written modulo the
 *    buffer's length, so a tail that runs past the end lands at the start
 *    where the loop will play it next. One event is put across the seam on
 *    purpose, because a loop with nothing at its edge never exercises the wrap.
 *  - A filtered noise layer is run round the loop twice and the second pass is
 *    kept, so the filter's state at the first sample is the state the last one
 *    left it in. The memory of these filters is milliseconds against a
 *    12 second loop; the first pass is only there to forget its zero start.
 *
 * **The generator is private.** `mulberry32` over `CONFIG.ambience.seed` and a
 * per-bed salt, never `rng` or `lookRng`: a bed is ~1.6 million draws and the
 * simulation's stream is counted (`tests/rngdraws.js`), so a match's decisions
 * must not move because a bed was built. The same seed is the same samples.
 *
 * **Louder in bigger rooms.** The bed's level follows the volume of the room
 * the listener is in (`rooms` is the map's own list), eased on the wall clock.
 * Outdoors, and any ground that is in no declared room, counts as larger than
 * the largest.
 *
 * Layering (Section 3.1): imports config only. `audio.js` owns the graph and
 * hands this the context, the bus and the listener.
 */

import { CONFIG, mulberry32 } from '../config.js';

const A = CONFIG.ambience;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Synthesis: samples out, no audio graph in
// ---------------------------------------------------------------------------

/** Whole cycles of `hz` in a loop: the rounding that makes a partial periodic. */
const cyclesOf = (hz) => Math.max(1, Math.round(hz * A.loopSeconds));

/** `sin` over the loop at a whole number of cycles. Phase is read off `i / n`, not off time, so rate cannot break the count. */
const partial = (i, n, cycles, phase) => Math.sin(TAU * cycles * (i / n) + phase);

/** An RBJ biquad, normalised. */
function biquad(type, hz, q, rate) {
  const w = (TAU * hz) / rate;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  let b0;
  let b1;
  let b2;
  if (type === 'lowpass') {
    b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0;
  } else { // bandpass, constant 0 dB peak
    b0 = alpha; b1 = 0; b2 = -alpha;
  }
  const a0 = 1 + alpha;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0 };
}

/** Run `data` through one biquad starting from `state`, writing `out`; returns the state it ended in. */
function runBiquad(data, out, c, state) {
  let { x1, x2, y1, y2 } = state;
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    out[i] = y;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
  }
  return { x1, x2, y1, y2 };
}

/**
 * Filter a loop of noise so that it still loops: two passes, the second kept
 * and started from where the first finished.
 */
function filterRound(data, coefficients) {
  let signal = data;
  for (const c of coefficients) {
    const scratch = new Float64Array(signal.length);
    const out = new Float64Array(signal.length);
    const state = runBiquad(signal, scratch, c, { x1: 0, x2: 0, y1: 0, y2: 0 });
    runBiquad(signal, out, c, state);
    signal = out;
  }
  return signal;
}

/** White noise, scaled to unit RMS after `filter` so a layer's level is its gain and nothing else. */
function noiseLayer(next, n, filter) {
  const white = new Float64Array(n);
  for (let i = 0; i < n; i++) white[i] = next() * 2 - 1;
  const shaped = filter(white);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += shaped[i] * shaped[i];
  const scale = 1 / Math.sqrt(sum / n || 1);
  for (let i = 0; i < n; i++) shaped[i] *= scale;
  return shaped;
}

/**
 * Add an event into the loop, wrapping. **This modulo is the seam**: without
 * it a tail past the end is dropped by the typed array and the loop jumps.
 */
function addWrapped(data, start, event, gain) {
  const n = data.length;
  for (let i = 0; i < event.length; i++) {
    const at = (start + i) % n;
    data[at] += event[i] * gain;
  }
}

/** A seeded start time in [lo, hi) seconds, as a sample index inside the loop. */
const sampleAt = (seconds, rate, n) => Math.min(n - 1, Math.max(0, Math.floor(seconds * rate)));

// -- the plant ----------------------------------------------------------------

function plantBed(next, rate, n, P) {
  const out = new Float64Array(n);

  // The hum: partials at whole cycles, and a second partial with a close
  // neighbour so the two beat.
  const { fundamental, harmonics, beatHz, gain } = P.hum;
  for (let k = 0; k < harmonics.length; k++) {
    const cycles = cyclesOf(fundamental * (k + 1));
    const phase = next() * TAU;
    const amp = gain * harmonics[k];
    for (let i = 0; i < n; i++) out[i] += amp * partial(i, n, cycles, phase);
  }
  const beatCycles = cyclesOf(fundamental * 2 + beatHz);
  const beatPhase = next() * TAU;
  const beatAmp = gain * harmonics[1];
  for (let i = 0; i < n; i++) out[i] += beatAmp * partial(i, n, beatCycles, beatPhase);

  // Ventilation: band-passed noise with a slow swell of whole cycles.
  const vent = noiseLayer(next, n, (white) => filterRound(white, [biquad('bandpass', P.vent.centre, P.vent.q, rate)]));
  const swellPhase = next() * TAU;
  const swellNorm = 1 + P.vent.depth;
  for (let i = 0; i < n; i++) {
    const swell = (1 + P.vent.depth * partial(i, n, P.vent.swellCycles, swellPhase)) / swellNorm;
    out[i] += vent[i] * P.vent.gain * swell;
  }

  // Drips: a ringing click each, one per equal slot of the loop with a seeded
  // place in it, and the last one put just before the end.
  const D = P.drips;
  const ringLength = Math.round(rate * D.ring);
  const slot = A.loopSeconds / D.count;
  for (let k = 0; k < D.count; k++) {
    const when = (k + 0.15 + 0.7 * next()) * slot;
    const hz = D.lowHz + (D.highHz - D.lowHz) * next();
    const level = 0.6 + 0.4 * next();
    const click = new Float64Array(ringLength);
    for (let i = 0; i < ringLength; i++) {
      click[i] = (next() * 2 - 1) * Math.exp(-i / (rate * D.decay));
    }
    const rung = new Float64Array(ringLength);
    runBiquad(click, rung, biquad('bandpass', hz, D.q, rate), { x1: 0, x2: 0, y1: 0, y2: 0 });
    let peak = 0;
    for (let i = 0; i < ringLength; i++) peak = Math.max(peak, Math.abs(rung[i]));
    const start = k === D.count - 1 ? n - Math.round(D.seamLead * rate) : sampleAt(when, rate, n);
    addWrapped(out, start, rung, (D.gain * level) / (peak || 1));
  }
  return out;
}

// -- the yard -----------------------------------------------------------------

/** A Hann window of `length` samples: zero at both ends, so an event built on it has no edge of its own. */
function hann(length) {
  const w = new Float64Array(length);
  for (let i = 0; i < length; i++) w[i] = 0.5 - 0.5 * Math.cos((TAU * (i + 0.5)) / length);
  return w;
}

function yardBed(next, rate, n, Y) {
  const out = new Float64Array(n);

  // Wind: two low-passes of noise under a level that is a floor plus gusts.
  const W = Y.wind;
  const lowpass = biquad('lowpass', W.cutoff, W.q, rate);
  const wind = noiseLayer(next, n, (white) => filterRound(white, [lowpass, lowpass]));
  const level = new Float64Array(n).fill(W.base);
  for (let g = 0; g < W.gusts; g++) {
    const length = Math.round(rate * (W.gustMin + (W.gustMax - W.gustMin) * next()));
    const height = W.gustHeight * (0.5 + 0.5 * next());
    addWrapped(level, sampleAt(next() * A.loopSeconds, rate, n), hann(length), height);
  }
  for (let i = 0; i < n; i++) out[i] += wind[i] * level[i] * W.gain;

  // The port: a far horn, a few harmonics under an attack-hold-release.
  const H = Y.horn;
  const attack = Math.round(rate * H.attack);
  const hold = Math.round(rate * H.hold);
  const release = Math.round(rate * H.release);
  const hornLength = attack + hold + release;
  const horn = new Float64Array(hornLength);
  for (let k = 0; k < H.harmonics.length; k++) {
    const hz = H.freq * (k + 1);
    const phase = next() * TAU;
    for (let i = 0; i < hornLength; i++) horn[i] += H.harmonics[k] * Math.sin(TAU * hz * (i / rate) + phase);
  }
  for (let i = 0; i < hornLength; i++) {
    let shape = 1;
    if (i < attack) shape = Math.sin((Math.PI / 2) * (i / attack)) ** 2;
    else if (i >= attack + hold) shape = Math.cos((Math.PI / 2) * ((i - attack - hold) / release)) ** 2;
    horn[i] *= shape;
  }
  addWrapped(out, sampleAt(H.at * A.loopSeconds, rate, n), horn, H.gain);

  // Clanks: a few inharmonic partials, struck and left to die.
  const C = Y.clanks;
  const clankLength = Math.round(rate * C.decay * 5);
  for (let k = 0; k < C.count; k++) {
    const start = sampleAt(next() * A.loopSeconds, rate, n);
    const clank = new Float64Array(clankLength);
    for (const hz of C.partials) {
      const phase = next() * TAU;
      for (let i = 0; i < clankLength; i++) {
        clank[i] += Math.sin(TAU * hz * (i / rate) + phase) * Math.exp(-i / (rate * C.decay));
      }
    }
    addWrapped(out, start, clank, C.gain / C.partials.length);
  }
  return out;
}

/** Which recipe builds which map's bed; a map with a `CONFIG.ambience.beds` entry and no recipe is a startup error, not silence. */
const RECIPES = { plant: plantBed, yard: yardBed };

/**
 * One map's bed as samples, or null where the map has none.
 *
 * @param {string} mapId a registered map
 * @param {number} rate the context's sample rate
 * @param {number} [seed] defaults to the configured one; a bed is a pure function of it
 * @returns {Float32Array|null} exactly `loopSeconds` long
 */
export function synthesiseBed(mapId, rate, seed = A.seed) {
  const spec = A.beds[mapId];
  if (!spec) return null;
  const n = Math.round(rate * A.loopSeconds);
  const next = mulberry32((seed ^ spec.salt) >>> 0);
  const wide = RECIPES[mapId](next, rate, n, spec);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) samples[i] = wide[i];
  return samples;
}

/**
 * Render a bed the way it plays: looped from a buffer source, through an
 * offline context. `seconds` longer than the loop plays the seam. Null where
 * the map has no bed or the browser has no offline context.
 */
export async function renderBedOffline(mapId, seconds, seed = A.seed, rate = 44100) {
  const Ctor = typeof OfflineAudioContext !== 'undefined' ? OfflineAudioContext : null;
  const samples = Ctor ? synthesiseBed(mapId, rate, seed) : null;
  if (!samples) return null;
  const offline = new Ctor(1, Math.ceil(rate * seconds), rate);
  const buffer = offline.createBuffer(1, samples.length, rate);
  buffer.copyToChannel(samples, 0);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(offline.destination);
  source.start();
  return offline.startRendering();
}

// ---------------------------------------------------------------------------
// Room volume -> level
// ---------------------------------------------------------------------------

/** A declared room's volume in cubic metres. */
export const roomVolume = (room) => (
  (room.max.x - room.min.x) * (room.max.z - room.min.z) * (room.ceilingY - room.floorY)
);

/**
 * The volume of the space a point is in: its room's, or Infinity for outdoors
 * and anywhere in no declared room. The floor is allowed half a metre of slack
 * below, as `addSite` allows, for a body whose centre is not its feet.
 */
export function volumeAt(rooms, position) {
  for (const room of rooms || []) {
    if (position.x >= room.min.x && position.x <= room.max.x
      && position.z >= room.min.z && position.z <= room.max.z
      && position.y >= room.floorY - 0.5 && position.y <= room.ceilingY) {
      return roomVolume(room);
    }
  }
  return Infinity;
}

/** Level for a volume: `floor` at `smallVolume`, 1 at `largeVolume`, straight in log between, clamped. */
export function gainForVolume(volume) {
  const R = A.roomGain;
  if (!(volume > R.smallVolume)) return R.floor;
  const t = Math.log(volume / R.smallVolume) / Math.log(R.largeVolume / R.smallVolume);
  return R.floor + (1 - R.floor) * Math.min(1, t);
}

// ---------------------------------------------------------------------------
// The live bed
// ---------------------------------------------------------------------------

export class Ambience {
  /**
   * @param {object} options
   * @param {object} options.audio the AudioSystem: its `context` and `buses`
   * @param {string} options.mapId which bed
   * @param {object[]} [options.rooms] the map's declared rooms
   * @param {object} [options.listener] object with a `position`
   */
  constructor({ audio, mapId, rooms, listener }) {
    this.audio = audio;
    this.mapId = mapId;
    this.rooms = rooms || [];
    this.listener = listener || null;
    /** The context the bed was started on, kept so an offline render swapping the audio system's own cannot redirect the ease. */
    this.context = null;
    this.source = null;
    this.gain = null;
    /** Where the level is easing to; read by the checks. */
    this.targetGain = gainForVolume(Infinity);
  }

  /** Build the buffer and start it looping. Safe to call twice; silent where the map has no bed. */
  start() {
    const context = this.audio.context;
    if (this.source || !context) return false;
    const samples = synthesiseBed(this.mapId, context.sampleRate);
    if (!samples) return false;
    const buffer = context.createBuffer(1, samples.length, context.sampleRate);
    buffer.copyToChannel(samples, 0);
    this.context = context;
    this.source = context.createBufferSource();
    this.source.buffer = buffer;
    this.source.loop = true;
    this.gain = context.createGain();
    this.gain.gain.value = this.targetGain * A.bedGain;
    this.source.connect(this.gain).connect(this.audio.buses.ambience);
    this.source.start();
    return true;
  }

  /** The level for where the listener stands now, and an ease toward it. */
  step() {
    const at = this.listener && this.listener.position;
    this.targetGain = gainForVolume(at ? volumeAt(this.rooms, at) : Infinity);
    if (this.gain) {
      this.gain.gain.setTargetAtTime(this.targetGain * A.bedGain, this.context.currentTime, A.easeSeconds / 3);
    }
  }

  stop() {
    if (!this.source) return;
    try {
      this.source.stop();
    } catch (error) {
      /* already stopped */
    }
    this.source.disconnect();
    this.gain.disconnect();
    this.source = null;
    this.gain = null;
  }
}
