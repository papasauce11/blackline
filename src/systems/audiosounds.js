/**
 * BLACKLINE - systems/audiosounds.js
 *
 * One entry per row of the Section 14 sound table: the recipes themselves
 * (H51).
 *
 * **Why they live here.** `systems/audio.js` was at 589 lines of the 600
 * `no-source-file-outside-config-is-over-600-lines` allows, with eleven left,
 * and H35 had spent three of them. The next job to touch it would have
 * discovered that halfway through a verify, which is what H42, H43 and H44
 * each avoided by splitting a file **before** being forced to. This table is
 * the seam that costs nothing to cut: 145 lines called in exactly one shape,
 * from three sites, with no state of its own.
 *
 * **What a recipe is.** A function called as `builder.call(audioSystem, position)`,
 * so `this` is the one `AudioSystem` and the two shapes every recipe is written
 * in - `this._noiseBurst()` and `this._tone()` - stay where the graph is. A
 * recipe therefore reaches nothing but those two helpers and its own row of
 * `CONFIG.audio`, which is why it moves whole and why nothing here constructs
 * anything. That matters for one check in particular:
 * `one-module-owns-the-audio-device-and-an-offline-render-gives-it-back` lets
 * exactly one module name the realtime constructor, and a recipe names no
 * constructor at all - so this module is not a second owner, and that check
 * holds a clause saying this table is here and not back in `audio.js`.
 *
 * Layering (Section 3.1): imports config only, like the module it came out of.
 * A sibling import inside `systems/` is what `ai.js` does with `aistate.js`
 * and `gadgets.js` with `gadgeteffects.js`.
 */

import { CONFIG } from '../config.js';

const A = CONFIG.audio;

/**
 * One entry per row of the Section 14 table. A plain object rather than
 * per-instance state, so the lookup is shared rather than rebuilt per call -
 * `audio.js` assigns it to `AudioSystem.BUILDERS`, which is the name the three
 * call sites and `tests/audio.js`'s enumeration both read.
 */
export const SOUND_BUILDERS = {
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
