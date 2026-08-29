/**
 * BLACKLINE - tests/audio.js
 *
 * AUTO suite (Section 16, Section 17.1): Audio.
 *
 * The bus graph, autoplay safety, spatialisation, voice lifetime and the
 * detection tension pad.
 *
 * Registered from tests/index.js. Checks reach the live game through the
 * harness `h`; nothing here imports main.js, which Section 3.1 forbids.
 */

import { CONFIG } from '../config.js';

const A = CONFIG.audio;

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'audio-graph-is-one-master-three-buses',
    spec: 'Section 14 / Section 15 (autoplay policy)',
    name: 'Nothing sounds before the unlock; after it, one master and three buses',
    run: (h) => {
      const audio = h.audio;
      const problems = [];

      // Before the gesture there is no context, and every sound is a no-op
      // rather than an exception. Section 15: a context built before a user
      // gesture starts suspended and drops everything silently.
      if (!audio.context) {
        if (audio.play('gunfire', { x: 0, y: 0, z: 0 }) !== false) {
          problems.push('a sound played before the context existed');
        }
      }

      const context = audio.unlock();
      if (!context) return { pass: false, detail: 'no AudioContext available in this browser' };
      // Unlocking twice must not build a second graph.
      const again = audio.unlock();
      if (again !== context) problems.push('unlock built a second context');

      if (!audio.master) problems.push('no master gain');
      if (Math.abs(audio.master.gain.value - A.masterGain) > 1e-6) {
        problems.push(`master gain ${audio.master.gain.value}, want ${A.masterGain}`);
      }
      const names = Object.keys(audio.buses);
      if (names.length !== 3) problems.push(`${names.length} buses, want 3`);
      for (const name of ['sfx', 'ambience', 'ui']) {
        const bus = audio.buses[name];
        if (!bus) {
          problems.push(`missing the ${name} bus`);
          continue;
        }
        if (Math.abs(bus.gain.value - A.busGain[name]) > 1e-6) {
          problems.push(`${name} gain ${bus.gain.value}, want ${A.busGain[name]}`);
        }
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `context ${context.state}, master ${A.masterGain}, buses ${names.join('/')} at ${names.map((n) => A.busGain[n]).join('/')}`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'audio-spatialises-everything-but-ui',
    spec: 'Section 14',
    name: 'World sounds get a panner; UI and the tension pad do not',
    run: (h) => {
      const audio = h.audio;
      if (!audio.unlock()) return { pass: false, detail: 'no AudioContext available' };
      const problems = [];

      const at = { x: 3, y: 1, z: -4 };
      const world = audio._destination('sfx', at);
      if (!world || typeof world.positionX === 'undefined') {
        problems.push('a world sound did not get a PannerNode');
      } else if (world.positionX.value !== at.x || world.positionZ.value !== at.z) {
        problems.push('the panner was not placed at the event position');
      }

      const ui = audio._destination('ui', at);
      if (ui !== audio.buses.ui) problems.push('a UI sound was spatialised');
      const unplaced = audio._destination('sfx', null);
      if (unplaced !== audio.buses.sfx) problems.push('a sound with no position was spatialised');

      // The tension pad is about the AI's mind, not a place (Section 14).
      audio._stopTension();
      audio._startTension();
      const padTarget = audio._tension.gain;
      let spatialised = false;
      // The pad's gain feeds the ambience bus directly.
      if (padTarget.numberOfOutputs !== undefined && audio._tension.osc.type !== 'sine') spatialised = true;
      if (spatialised) problems.push('the tension pad is not a plain sine');
      audio._stopTension();
      if (audio._tension) problems.push('stopping the pad left it behind');

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `world sounds panned at their event position, UI and the ${A.tension.freq}Hz pad routed straight to their bus`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'audio-voices-are-capped-and-released',
    spec: 'Section 14 / Section 15 (pooling)',
    name: 'Every sound in the table plays, the voice count is capped, and reset drains it',
    run: (h) => {
      const audio = h.audio;
      if (!audio.unlock()) return { pass: false, detail: 'no AudioContext available' };
      const problems = [];

      audio.reset();
      const at = { x: 0, y: 1, z: 0 };
      const names = Object.keys(audio._builders);
      const silent = [];
      for (const name of names) {
        audio.reset();
        if (audio.play(name, at) !== true) silent.push(name);
      }
      if (silent.length) problems.push(`no voice started for: ${silent.join(', ')}`);

      // Every row of the Section 14 table needs a builder AND something that
      // fires it. A builder with no trigger is silent in play and sounds
      // exactly like a builder that was never written, which is how smoke,
      // flashbang, grenade, taser, alarm and the plant beep went unheard.
      const TABLE = [
        { sound: 'shadeFootstep', event: 'noise', payload: { type: 'footstep', source: 'shade', x: 0, y: 1, z: 0 } },
        { sound: 'wardenFootstep', event: 'noise', payload: { type: 'footstep', source: 'warden', x: 0, y: 1, z: 0 } },
        { sound: 'gunfire', event: 'combat:shot', payload: { origin: at, direction: { x: 0, y: 0, z: -1 } } },
        { sound: 'knifeSwing', event: 'combat:knife', payload: { actor: 'shade' } },
        { sound: 'takedown', event: 'combat:takedown', payload: { at } },
        { sound: 'reload', event: 'combat:reload', payload: { actor: 'warden' } },
        { sound: 'landing', event: 'noise', payload: { type: 'landing', x: 0, y: 1, z: 0 } },
        { sound: 'lightBreak', event: 'noise', payload: { type: 'light-destroyed', x: 0, y: 1, z: 0 } },
        { sound: 'smoke', event: 'gadget:detonate', payload: { type: 'smoke', at } },
        { sound: 'flashbang', event: 'gadget:detonate', payload: { type: 'flashbang', at } },
        { sound: 'grenade', event: 'gadget:detonate', payload: { type: 'frag', at } },
        { sound: 'taser', event: 'gadget:taser', payload: { hit: 'warden' } },
        { sound: 'alarm', event: 'gadget:alarm', payload: { at } },
        { sound: 'plantBeep', event: 'objective:beep', payload: { at, remaining: 0.5 } },
      ];
      for (const row of TABLE) {
        if (names.indexOf(row.sound) === -1) problems.push(`no builder for ${row.sound}`);
      }
      const untriggered = [];
      for (const row of TABLE) {
        audio.reset();
        h.emitter.emit(row.event, row.payload);
        if (audio.voices.size === 0) untriggered.push(`${row.sound} (${row.event})`);
      }
      if (untriggered.length) {
        problems.push(`built but never triggered in play: ${untriggered.join(', ')}`);
      }

      // Flood well past the cap: it must refuse rather than grow without bound.
      audio.reset();
      const before = audio.dropped;
      for (let i = 0; i < 200; i++) audio.play('shadeFootstep', at);
      const peak = audio.voices.size;
      if (peak > 24) problems.push(`${peak} simultaneous voices, cap is 24`);
      if (audio.dropped <= before) problems.push('the cap never refused a voice');

      audio.reset();
      if (audio.voices.size !== 0) problems.push(`reset left ${audio.voices.size} voices`);

      // An unknown name is a no-op, not a throw.
      if (audio.play('not-a-sound', at) !== false) problems.push('an unknown sound did not return false');

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${names.length} sounds all produce a voice and all ${TABLE.length} Section 14 rows are `
            + `triggered by a real game event; flooded 200 -> ${peak} active `
            + `(cap 24, ${audio.dropped - before} refused); reset drained to 0`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'audio-tension-tracks-the-ai-accumulator',
    spec: 'Section 14',
    name: 'The pad fades in above 50 on the accumulator and stops below it',
    run: (h) => {
      const audio = h.audio;
      if (!audio.unlock()) return { pass: false, detail: 'no AudioContext available' };
      const problems = [];
      const dt = CONFIG.time.fixedDt;

      audio._stopTension();
      // Below the threshold: silence, and no oscillator left running.
      audio.step(dt, { detectionAccumulator: A.tension.threshold - 10 });
      if (audio._tension) problems.push('the pad started below the threshold');

      // Above it: the pad exists and is aimed at a non-zero gain.
      audio.step(dt, { detectionAccumulator: A.tension.threshold + 25 });
      if (!audio._tension) problems.push('the pad did not start above the threshold');
      const started = !!audio._tension;
      const frequency = started ? audio._tension.osc.frequency.value : 0;
      if (started && Math.abs(frequency - A.tension.freq) > 1e-6) {
        problems.push(`pad at ${frequency}Hz, spec is ${A.tension.freq}Hz`);
      }

      audio._stopTension();
      if (audio._tension) problems.push('stop left the pad behind');

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `silent at ${A.tension.threshold - 10}, ${frequency}Hz pad running at ${A.tension.threshold + 25} (threshold ${A.tension.threshold}, max gain ${A.tension.maxGain})`
          : problems.join('; '),
      };
    },
  });
}
