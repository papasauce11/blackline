/**
 * BLACKLINE — systems/audio.js
 *
 * Every sound in the game, synthesized (Section 14). No files, no fetches.
 *
 * Layering (Section 3.1): imports config only, and is driven by the emitter the
 * composition root hands it. It listens; nothing calls into it directly except
 * the frame loop and the unlock.
 *
 * Two constraints shape it:
 *
 *  - **Autoplay** (Section 15). An `AudioContext` created before a user gesture
 *    starts suspended and every sound is silently dropped. `unlock()` is
 *    therefore the only thing that builds the graph, and it is wired to the
 *    first real gesture rather than to boot.
 *  - **No leaks.** Web Audio nodes are garbage only once they have stopped and
 *    been disconnected. Every voice registers itself, releases on `onended`,
 *    and the count is asserted back to zero.
 */

import { CONFIG, mulberry32 } from '../config.js';

const A = CONFIG.audio;
/** Seed of the offline render's noise texture, so a rendered sound is the same samples every time. */
const RENDER_NOISE_SEED = 0x53414d50; // "SAMP"

/** Beyond this many simultaneous voices, new one-shots are dropped. */
const VOICE_CAP = 24;

export class AudioSystem {
  /**
   * @param {object} options
   * @param {object} options.emitter
   * @param {object} [options.listener] object with a `position` to spatialise from
   */
  constructor({ emitter, listener }) {
    this.emitter = emitter;
    this.listener = listener || null;

    this.context = null;
    this.master = null;
    this.buses = null;
    this.voices = new Set();
    this.played = 0;
    this.dropped = 0;
    this.enabled = true;

    this._noiseBuffer = null;
    this._tension = null;
    this._unsubscribe = [];
    this._subscribe();
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Build the graph. Called from the first user gesture (Section 15: "Audio
   * blocked by autoplay policy — initialise AudioContext on the menu Play
   * click"), and safe to call again.
   */
  unlock() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume();
      return this.context;
    }
    const Ctor = typeof AudioContext !== 'undefined'
      ? AudioContext
      : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null);
    if (!Ctor) return null;

    const context = new Ctor();
    this.context = context;

    // One master, three buses (Section 14).
    this.master = context.createGain();
    this.master.gain.value = A.masterGain;
    this.master.connect(context.destination);

    this.buses = {};
    for (const name of ['sfx', 'ambience', 'ui']) {
      const gain = context.createGain();
      gain.gain.value = A.busGain[name];
      gain.connect(this.master);
      this.buses[name] = gain;
    }

    // One second of white noise, shared by every noise-based voice.
    const frames = Math.floor(context.sampleRate);
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    // Deliberately Math.random: this is a one-off audio texture with no
    // gameplay meaning, and Section 2's ban exists so gameplay is reproducible
    // from a seed. Drawing it from the seeded stream would burn 44100 values
    // and change every downstream draw.
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    this._noiseBuffer = buffer;

    if (this.context.state === 'suspended') this.context.resume();
    return context;
  }

  setMasterVolume(value) {
    if (this.master) this.master.gain.value = value;
  }

  /**
   * Render one sound to samples instead of to speakers.
   *
   * Nobody has ever heard this game. The suite could prove a voice started and
   * that it was released, which is the difference between a graph that exists
   * and a graph that makes the right noise — a builder with its envelope
   * inverted or its frequency an order of magnitude out passes every one of
   * those checks. Rendering it offline gives the samples themselves, so
   * duration, envelope shape, level and rough pitch can be held against what
   * Section 14 describes.
   *
   * It is not hearing it. It is a great deal more than counting voices.
   *
   * @param {string} name a Section 14 builder
   * @param {number} seconds how long to render
   * @returns {Promise<AudioBuffer|null>}
   */
  async renderOffline(name, seconds) {
    const Ctor = typeof OfflineAudioContext !== 'undefined' ? OfflineAudioContext : null;
    if (!Ctor || !AudioSystem.BUILDERS[name]) return null;

    const rate = 44100;
    const offline = new Ctor(1, Math.ceil(rate * seconds), rate);

    // Swap the whole graph onto the offline context for the duration. The
    // builders are untouched — the point is to render exactly what plays, not
    // a re-implementation of it.
    const live = {
      context: this.context, master: this.master, buses: this.buses,
      noise: this._noiseBuffer, voices: this.voices, enabled: this.enabled,
    };

    this.context = offline;
    this.master = offline.createGain();
    this.master.gain.value = A.masterGain;
    this.master.connect(offline.destination);
    this.buses = {};
    for (const bus of ['sfx', 'ambience', 'ui']) {
      const gain = offline.createGain();
      gain.gain.value = A.busGain[bus];
      gain.connect(this.master);
      this.buses[bus] = gain;
    }
    const frames = Math.floor(rate);
    const buffer = offline.createBuffer(1, frames, rate);
    const data = buffer.getChannelData(0);
    // The same texture every render, from a private generator that is not the
    // game's stream (unlock() draws its live texture from Math.random; see the
    // note there). This is an instrument: a check that compares two rendered
    // sounds must compare the sounds, not two draws of noise. The Warden's
    // footstep peaked at 0.049 against the Shade's 0.050 on one run and above
    // it on the next, with nothing changed but the noise.
    const next = mulberry32(RENDER_NOISE_SEED);
    for (let i = 0; i < frames; i++) data[i] = next() * 2 - 1;
    this._noiseBuffer = buffer;
    this.voices = new Set();
    this.enabled = true;

    let rendered = null;
    try {
      AudioSystem.BUILDERS[name].call(this, { x: 0, y: 0, z: 0 });
      rendered = await offline.startRendering();
    } finally {
      this.context = live.context;
      this.master = live.master;
      this.buses = live.buses;
      this._noiseBuffer = live.noise;
      this.voices = live.voices;
      this.enabled = live.enabled;
    }
    return rendered;
  }

  /** Stop everything and drop the graph. Used at teardown and between matches. */
  reset() {
    for (const voice of [...this.voices]) {
      try {
        voice.stop();
      } catch (error) {
        /* already stopped */
      }
    }
    this.voices.clear();
    this._stopTension();
  }

  dispose() {
    for (const off of this._unsubscribe) off();
    this._unsubscribe.length = 0;
    this.reset();
    if (this.context) this.context.close();
    this.context = null;
  }

  // -------------------------------------------------------------------------
  // Event wiring — audio never reaches into another system (Section 3.1)
  // -------------------------------------------------------------------------

  _subscribe() {
    if (!this.emitter) return;
    const on = (event, handler) => this._unsubscribe.push(this.emitter.on(event, handler));

    on('noise', (event) => {
      switch (event.type) {
        case 'footstep':
          this.footstep(event.source, event);
          break;
        case 'landing':
          this.play('landing', event);
          break;
        case 'light-destroyed':
          this.play('lightBreak', event);
          break;
        default:
          break;
      }
    });
    on('combat:shot', (event) => this.play('gunfire', event.origin));
    on('combat:knife', () => this.play('knifeSwing', this._listenerPosition()));
    on('combat:takedown', (event) => this.play('takedown', event.at));
    on('combat:reload', () => this.play('reload', this._listenerPosition()));
    // B2: a failed climb is never silent. The controller says where the hands hit.
    on('shade:scuff', (event) => this.play('scuff', event));

    // The rest of the Section 14 table. Each of these had a builder and no
    // trigger, which sounds exactly like a builder that does not exist.
    on('gadget:detonate', (event) => {
      if (event.type === 'smoke') this.play('smoke', event.at);
      else if (event.type === 'flashbang') this.play('flashbang', event.at);
      else this.play('grenade', event.at);
    });
    on('gadget:taser', () => this.play('taser', this._listenerPosition()));
    on('gadget:alarm', (event) => this.play('alarm', event.at));
    // Section 14: "interval shortening as the detonation timer runs down".
    // Objective owns the interval; this only sounds it.
    on('objective:beep', (event) => this.play('plantBeep', event.at));
  }

  _listenerPosition() {
    return this.listener && this.listener.position ? this.listener.position : { x: 0, y: 0, z: 0 };
  }

  // -------------------------------------------------------------------------
  // Per-frame
  // -------------------------------------------------------------------------

  /**
   * @param {number} dt wall delta
   * @param {object} state
   * @param {number} [state.detectionAccumulator] drives the tension pad
   */
  step(dt, state = {}) {
    if (!this.context) return;

    // Section 14: a low sine pad that fades in as the accumulator rises above
    // 50. It is the one sound that is not spatialised, because it is telling
    // the player about the AI's mind, not about a place.
    const accumulator = state.detectionAccumulator || 0;
    const target = accumulator > A.tension.threshold
      ? Math.min(1, (accumulator - A.tension.threshold) / (CONFIG.ai.accumulatorMax - A.tension.threshold)) * A.tension.maxGain
      : 0;

    if (target > 0 && !this._tension) this._startTension();
    if (this._tension) {
      const gain = this._tension.gain.gain;
      gain.setTargetAtTime(target, this.context.currentTime, A.tension.fadeTime);
      if (target === 0 && gain.value < 0.001) this._stopTension();
    }
  }

  _startTension() {
    const context = this.context;
    const osc = context.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = A.tension.freq;
    const gain = context.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(this.buses.ambience);
    osc.start();
    this._tension = { osc, gain };
  }

  _stopTension() {
    if (!this._tension) return;
    try {
      this._tension.osc.stop();
    } catch (error) {
      /* already stopped */
    }
    this._tension.osc.disconnect();
    this._tension.gain.disconnect();
    this._tension = null;
  }

  // -------------------------------------------------------------------------
  // Voice plumbing
  // -------------------------------------------------------------------------

  /**
   * A destination for a one-shot: a panner on the sfx bus, or the bus itself
   * for UI. Section 14: everything is spatialised except UI and the pad.
   */
  _destination(bus, position) {
    if (bus === 'ui' || !position) return this.buses[bus];
    const panner = this.context.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = A.panner.refDistance;
    panner.maxDistance = A.panner.maxDistance;
    panner.rolloffFactor = A.panner.rolloffFactor;
    panner.positionX.value = position.x || 0;
    panner.positionY.value = position.y || 0;
    panner.positionZ.value = position.z || 0;
    panner.connect(this.buses[bus]);
    return panner;
  }

  /** Register a source so the voice count is honest and cleanup is guaranteed. */
  _track(source, chain) {
    if (this.voices.size >= VOICE_CAP) {
      this.dropped++;
      return false;
    }
    this.voices.add(source);
    this.played++;
    source.onended = () => {
      this.voices.delete(source);
      try {
        source.disconnect();
        for (const node of chain) node.disconnect();
      } catch (error) {
        /* already torn down */
      }
    };
    return true;
  }

  _noiseSource() {
    const source = this.context.createBufferSource();
    source.buffer = this._noiseBuffer;
    source.loop = true;
    return source;
  }

  // -------------------------------------------------------------------------
  // The sounds (Section 14)
  // -------------------------------------------------------------------------

  /** Shade footsteps are silent when crouched — the noise field says so too. */
  footstep(source, position) {
    if (source === 'warden') return this.play('wardenFootstep', position);
    return this.play('shadeFootstep', position);
  }

  /**
   * @param {string} name one of the entries below
   * @param {object} [position] world position, omitted for UI
   * @returns {boolean} whether a voice actually started
   */
  play(name, position) {
    if (!this.enabled || !this.context) return false;
    const builder = this._builders[name];
    if (!builder) return false;
    return builder.call(this, position) === true;
  }

  get _builders() {
    return AudioSystem.BUILDERS;
  }

  /** Shared shape: a noise burst through a filter with an envelope. */
  _noiseBurst(position, { bus = 'sfx', filterType, frequency, duration, gain, sweepTo }) {
    const context = this.context;
    const source = this._noiseSource();
    const filter = context.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    if (sweepTo !== undefined) {
      filter.frequency.setValueAtTime(frequency, context.currentTime);
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), context.currentTime + duration);
    }
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(gain, context.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);

    const destination = this._destination(bus, position);
    source.connect(filter).connect(envelope).connect(destination);
    if (!this._track(source, [filter, envelope, destination])) return false;
    source.start();
    source.stop(context.currentTime + duration);
    return true;
  }

  _tone(position, { bus = 'sfx', type = 'sine', frequency, duration, gain, sweepTo }) {
    const context = this.context;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, context.currentTime);
    if (sweepTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), context.currentTime + duration);
    }
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(gain, context.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);

    const destination = this._destination(bus, position);
    osc.connect(envelope).connect(destination);
    if (!this._track(osc, [envelope, destination])) return false;
    osc.start();
    osc.stop(context.currentTime + duration);
    return true;
  }
}

/**
 * One entry per row of the Section 14 table. Kept off the instance so the
 * lookup is a shared object rather than rebuilt per call.
 */
AudioSystem.BUILDERS = {
  shadeFootstep(position) {
    const c = A.shadeFootstep;
    return this._noiseBurst(position, {
      filterType: 'highpass', frequency: c.highpass, duration: c.duration, gain: c.gain,
    });
  },

  wardenFootstep(position) {
    const c = A.wardenFootstep;
    const body = this._noiseBurst(position, {
      filterType: 'lowpass', frequency: c.lowpass, duration: c.duration, gain: c.gain,
    });
    // Plus the metallic click that makes it read as armour, not a shoe.
    this._tone(position, {
      type: 'square', frequency: c.clickFreq, duration: 0.02, gain: c.clickGain,
    });
    return body;
  },

  gunfire(position) {
    const c = A.gunfire;
    const fired = this._noiseBurst(position, {
      filterType: 'lowpass', frequency: c.sweepFrom, sweepTo: c.sweepTo,
      duration: c.duration, gain: c.gain,
    });
    // Section 14: a tail from delayed lower-gain copies rather than a
    // convolver, which would need an impulse response file.
    for (let i = 1; i <= c.tailCount; i++) {
      this._noiseBurst(position, {
        filterType: 'lowpass', frequency: c.sweepFrom * 0.5, sweepTo: c.sweepTo,
        duration: c.duration * 1.6, gain: c.gain * Math.pow(c.tailFalloff, i),
      });
    }
    return fired;
  },

  knifeSwing(position) {
    const c = A.knifeSwing;
    return this._noiseBurst(position, {
      filterType: 'bandpass', frequency: c.bandpass, duration: c.duration, gain: c.gain,
    });
  },

  takedown(position) {
    const c = A.takedown;
    this._noiseBurst(position, {
      filterType: 'bandpass', frequency: 900, duration: c.crackDuration, gain: c.gain * 0.6,
    });
    return this._tone(position, {
      frequency: c.subFreq, duration: c.subDuration, gain: c.gain, sweepTo: c.subFreq * 0.6,
    });
  },

  landing(position) {
    const c = A.wardenFootstep;
    return this._noiseBurst(position, {
      filterType: 'lowpass', frequency: c.lowpass * 0.8, duration: c.duration * 2, gain: c.gain,
    });
  },

  lightBreak(position) {
    return this._noiseBurst(position, {
      filterType: 'highpass', frequency: 2600, duration: 0.18, gain: 0.3,
    });
  },

  /** B2: hands slapping a face they cannot get over. Dull, short, unmistakably a body. */
  scuff(position) {
    const c = A.scuff;
    return this._noiseBurst(position, {
      filterType: 'lowpass', frequency: c.lowpass, duration: c.duration, gain: c.gain,
    });
  },

  reload() {
    return this._tone(null, {
      bus: 'ui', type: 'square', frequency: 320, duration: 0.06, gain: 0.12,
    });
  },

  taser(position) {
    const c = A.taser;
    return this._tone(position, {
      type: 'square', frequency: c.freq, duration: c.duration, gain: c.gain,
    });
  },

  alarm(position) {
    const c = A.alarm;
    this._tone(position, { type: 'square', frequency: c.freqLow, duration: c.toneDuration, gain: c.gain });
    return this._tone(position, {
      type: 'square', frequency: c.freqHigh, duration: c.toneDuration, gain: c.gain,
    });
  },

  /** Section 14: sustained noise with a slow low-pass sweep over 1.5s. */
  smoke(position) {
    const c = A.smoke;
    return this._noiseBurst(position, {
      filterType: 'lowpass', frequency: c.sweepFrom, sweepTo: c.sweepTo,
      duration: c.duration, gain: c.gain,
    });
  },

  /** Section 14: a sharp transient plus the 4kHz ring that decays over 4s. */
  flashbang(position) {
    const c = A.flashbang;
    const crack = this._noiseBurst(position, {
      filterType: 'highpass', frequency: 1200, duration: c.transientDuration, gain: c.gain,
    });
    // The ring is what the player is left with, so it is the longer voice.
    this._tone(position, {
      frequency: c.ringFreq, duration: c.ringDuration, gain: c.gain * 0.35,
    });
    return crack;
  },

  /** Section 14: a low noise burst with a pitched-down tail. */
  grenade(position) {
    const c = A.grenade;
    const blast = this._noiseBurst(position, {
      filterType: 'lowpass', frequency: c.sweepFrom, sweepTo: c.sweepTo,
      duration: c.duration, gain: c.gain,
    });
    this._tone(position, {
      frequency: c.sweepFrom * 0.25, sweepTo: c.sweepTo * 0.5,
      duration: c.duration * 1.5, gain: c.gain * 0.5,
    });
    return blast;
  },

  plantBeep(position) {
    const c = A.plantBeep;
    return this._tone(position, { frequency: c.freq, duration: c.duration, gain: c.gain });
  },

  lifeLost() {
    const c = A.lifeLost;
    return this._tone(null, {
      bus: 'ui', frequency: c.freqStart, sweepTo: c.freqEnd, duration: c.duration, gain: c.gain,
    });
  },
};

export function createAudio(options) {
  return new AudioSystem(options);
}
