/**
 * BLACKLINE - tests/detection.js
 *
 * AUTO suite (Section 16, Section 17.1): Detection.
 *
 * Light sampling, the visibility meter, Section 4.2 feedback and noise.
 *
 * Registered from tests/index.js. Checks reach the live game through the
 * harness `h`; nothing here imports main.js, which Section 3.1 forbids.
 */

import { CONFIG } from '../config.js';
import { createIntent } from '../entities/agent.js';
import { createWardenIntent } from '../entities/enforcer.js';
import { clearLane } from './lanes.js';

export function register(debugTools) {
  // -------------------------------------------------------------------------
  // Phase 5 — detection (Section 7, Section 4.2)
  // -------------------------------------------------------------------------
  debugTools.registerAutoTest({
    id: 'visibility-sampling-stays-in-budget',
    spec: 'Section 7.1 / Section 15 (light sampling tanks framerate)',
    name: 'Sampled on a 100ms cadence, never more than 5 rays per light',
    run: (h) => {
      const d = h.detection;
      const dt = CONFIG.time.fixedDt;
      const problems = [];

      // Park the Shade under the brightest part of the map so lights are in
      // range and the budget is actually being spent.
      h.shade.reset(h.map.shadeSpawns[0]);
      h.shade.position.set(-18, CONFIG.shade.standHeight / 2 + 0.05, -4);
      d.reset(h.shade);

      const before = d.samples;
      const seconds = 2;
      let maxRays = 0;
      for (let i = 0; i < seconds / dt; i++) {
        d.step(dt, { shade: h.shade, warden: h.warden });
        maxRays = Math.max(maxRays, d.raysLastSample);
      }
      const taken = d.samples - before;
      const expected = seconds / CONFIG.detection.sampleInterval;
      // Captured here, not after the reset below: the reset resamples at the
      // spawn, where nothing is in range, so reading it later would report a
      // different moment than the one being asserted.
      const lights = d.lightsLastSample;

      // Two seconds at 100ms is 20 samples, not 120 steps' worth.
      if (Math.abs(taken - expected) > 1) problems.push(`${taken} samples in ${seconds}s, expected ~${expected}`);
      if (lights > 0 && maxRays !== lights * CONFIG.detection.raysPerLight) {
        problems.push(`${maxRays} rays for ${lights} lights, cap is ${CONFIG.detection.raysPerLight}/light`);
      }
      if (lights === 0) problems.push('no lights in range at site A, so the budget was not exercised');

      h.shade.reset(h.map.shadeSpawns[0]);
      d.reset(h.shade);

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${taken} samples over ${seconds}s at ${CONFIG.detection.sampleInterval * 1000}ms (${seconds / dt} steps); ${lights} lights in range, ${maxRays} rays (cap ${CONFIG.detection.raysPerLight}/light)`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'visibility-reads-lit-and-dark-zones',
    maps: ['plant'], // the plant's lit hall and dark vault
    spec: 'Section 16 checks 8 and 9 (auto half)',
    name: 'Turbine Hall reads above 70; the Server Vault reads below 25',
    run: (h) => {
      const d = h.detection;
      const dt = CONFIG.time.fixedDt;

      const settle = (x, y, z, crouch) => {
        h.shade.reset(h.map.shadeSpawns[0]);
        h.shade.position.set(x, y + CONFIG.shade.standHeight / 2 + 0.05, z);
        h.shade.velocity.set(0, 0, 0);
        h.shade.crouching = !!crouch;
        d.reset(h.shade);
        // A second of simulation so the smoothed value has fully caught up.
        for (let i = 0; i < 1 / dt; i++) d.step(dt, { shade: h.shade, warden: null });
        return d.smoothed;
      };

      const siteA = h.map.sites.find((s) => s.id === 'A');
      const siteC = h.map.sites.find((s) => s.id === 'C');
      const hall = settle(siteA.position.x, siteA.position.y, siteA.position.z, false);
      const vault = settle(siteC.position.x, siteC.position.y, siteC.position.z, false);
      // A vent is unlit no matter what is outside it (Section 5).
      const vent = h.map.vents[0];
      const inVent = settle((vent.min.x + vent.max.x) / 2, vent.min.y, (vent.min.z + vent.max.z) / 2, true);

      h.shade.reset(h.map.shadeSpawns[0]);
      d.reset(h.shade);

      // Headroom matters as much as the threshold: a meter pegged at the clamp
      // cannot show a light going out, which is check 10.
      const headroom = hall < CONFIG.detection.meterMax - 5;
      const pass = hall > 70 && headroom && vault < 25 && inVent === 0;
      return {
        pass,
        detail: `Turbine Hall ${hall.toFixed(1)} (want >70, unclamped=${headroom}), Server Vault ${vault.toFixed(1)} (want <25), inside a vent ${inVent.toFixed(1)} (want 0); scoreScale ${CONFIG.detection.scoreScale}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'light-break-invalidates-the-cache',
    maps: ['plant'], // hall-site-a
    spec: 'Section 16 check 10 / Section 15',
    name: 'Shooting out the light overhead drops the meter within 200ms',
    run: (h) => {
      const d = h.detection;
      const dt = CONFIG.time.fixedDt;

      // Stand under site A's own fixture, the brightest spot on the map.
      const lamp = h.map.lights.find((entry) => entry.tag === 'hall-site-a');
      if (!lamp) return { pass: false, detail: 'hall-site-a light missing' };

      h.shade.reset(h.map.shadeSpawns[0]);
      h.shade.position.set(lamp.position.x, CONFIG.shade.standHeight / 2 + 0.05, lamp.position.z);
      d.reset(h.shade);
      for (let i = 0; i < 1 / dt; i++) d.step(dt, { shade: h.shade, warden: null });
      const before = d.smoothed;
      const rawBefore = d.raw;
      const noiseBefore = d.noise.activeCount;

      // Break it mid-interval, so a system that only resampled on the tick
      // would still be serving the stale value.
      d.step(dt * 0.5, { shade: h.shade, warden: null });
      d.breakLight(lamp.lightId, 'test');
      const rawAfterOneStep = (() => {
        d.step(dt, { shade: h.shade, warden: null });
        return d.raw;
      })();

      // 200ms of simulation, per check 10.
      for (let i = 0; i < 0.2 / dt - 1; i++) d.step(dt, { shade: h.shade, warden: null });
      const after = d.smoothed;

      const noiseFired = d.noise.active().some((e) => e.type === 'light-destroyed');
      const cacheUpdatedImmediately = rawAfterOneStep < rawBefore - 1;
      const meterDropped = after < before - 1;

      // Restore, or the suite leaves the map dark for everything after it.
      lamp.broken = false;
      lamp.light.intensity = lamp.intensity;
      lamp.glassMaterial.color.set(CONFIG.palette.lightWarm);
      h.shade.reset(h.map.shadeSpawns[0]);
      d.reset(h.shade);

      return {
        pass: cacheUpdatedImmediately && meterDropped && noiseFired,
        detail: `raw ${rawBefore.toFixed(1)} -> ${rawAfterOneStep.toFixed(1)} on the next step (no wait for the 100ms tick)=${cacheUpdatedImmediately}; smoothed ${before.toFixed(1)} -> ${after.toFixed(1)} within 200ms=${meterDropped}; 20m noise emitted=${noiseFired} (${noiseBefore} events before)`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'shade-is-quieter-than-the-warden',
    maps: ['plant'], // stands in the plant's hall
    spec: 'Section 7.2',
    name: 'Noise radii match spec, and crouch and vents are silent',
    run: (h) => {
      const d = h.detection;
      const dt = CONFIG.time.fixedDt;
      const problems = [];

      // Walk an actor in a straight clear lane and collect what it emitted.
      const walk = (actor, intent, steps, reset) => {
        d.noise.clear();
        reset();
        const seen = [];
        const off = h.emitter.on('noise', (event) => {
          if (event.source === (actor === h.shade ? 'shade' : 'warden')) seen.push(event.radius);
        });
        for (let i = 0; i < steps; i++) {
          actor.step(dt, intent);
          d.step(dt, { shade: actor === h.shade ? actor : null, warden: actor === h.warden ? actor : null });
        }
        off();
        return seen;
      };

      // A straight clear run on whatever map this is (tests/lanes.js): 3s
      // of the Shade's sprint is 19.5m.
      const run = clearLane(h, 22);
      if (!run) return { pass: false, detail: 'no 22m clear lane on this map' };
      const lane = (actor, height) => () => {
        actor.reset(actor === h.shade ? h.map.shadeSpawns[0] : h.map.wardenSpawns[0]);
        actor.position.set(run.x, run.y + height / 2 + 0.05, run.z);
        actor.yaw = run.yaw;
        actor.velocity.set(0, 0, 0);
      };

      const shadeIntentLocal = createIntent();
      shadeIntentLocal.forward = 1;
      const shadeWalk = walk(h.shade, shadeIntentLocal, 180, lane(h.shade, CONFIG.shade.standHeight));
      shadeIntentLocal.sprint = true;
      const shadeSprint = walk(h.shade, shadeIntentLocal, 180, lane(h.shade, CONFIG.shade.standHeight));
      shadeIntentLocal.sprint = false;
      shadeIntentLocal.crouch = true;
      const shadeCrouch = walk(h.shade, shadeIntentLocal, 240, lane(h.shade, CONFIG.shade.standHeight));

      const wardenIntentLocal = createWardenIntent();
      wardenIntentLocal.forward = 1;
      const wardenWalk = walk(h.warden, wardenIntentLocal, 180, lane(h.warden, CONFIG.warden.standHeight));
      wardenIntentLocal.sprint = true;
      const wardenSprint = walk(h.warden, wardenIntentLocal, 180, lane(h.warden, CONFIG.warden.standHeight));

      const R = CONFIG.noise.radii;
      const only = (list, value, label) => {
        if (list.length === 0) return problems.push(`${label} emitted nothing`);
        if (list.some((r) => r !== value)) problems.push(`${label} emitted ${[...new Set(list)].join('/')}, expected ${value}`);
      };
      only(shadeWalk, R.shadeWalk, 'shade walk');
      only(shadeSprint, R.shadeSprint, 'shade sprint');
      only(wardenWalk, R.wardenWalk, 'warden walk');
      only(wardenSprint, R.wardenSprint, 'warden sprint');
      if (shadeCrouch.length !== 0) problems.push(`crouch-walk emitted ${shadeCrouch.length} events, must be silent`);

      // The core design pillar (Section 7.2): the Shade is quieter than the
      // Warden at every equivalent stance.
      if (!(R.shadeWalk < R.wardenWalk)) problems.push('shade walk is not quieter than warden walk');
      if (!(R.shadeSprint < R.wardenSprint)) problems.push('shade sprint is not quieter than warden sprint');

      // And a vent is silent regardless of stance.
      const vent = h.map.vents[0];
      d.noise.clear();
      h.shade.reset(h.map.shadeSpawns[0]);
      h.shade.height = CONFIG.shade.crouchHeight;
      h.shade.half.y = h.shade.height / 2;
      h.shade.crouching = true;
      h.shade.position.set((vent.min.x + vent.max.x) / 2, vent.min.y + h.shade.half.y + 0.02, (vent.min.z + vent.max.z) / 2);
      h.shade.strideDistance += 100; // force the cadence
      d.step(dt, { shade: h.shade, warden: null });
      if (d.noise.activeCount !== 0) problems.push('a vent emitted noise');

      d.noise.clear();
      h.shade.reset(h.map.shadeSpawns[0]);
      h.warden.reset(h.map.wardenSpawns[0]);
      d.reset(h.shade);

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `shade walk ${R.shadeWalk}m (${shadeWalk.length} steps) / sprint ${R.shadeSprint}m (${shadeSprint.length}) / crouch silent; warden walk ${R.wardenWalk}m (${wardenWalk.length}) / sprint ${R.wardenSprint}m (${wardenSprint.length}); vent silent`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'noise-events-expire-and-are-capped',
    spec: 'Section 7.2 / Section 15 (effects never expire)',
    name: 'Noise events expire after 0.4s and the pool never grows',
    run: (h) => {
      const d = h.detection;
      const dt = CONFIG.time.fixedDt;
      d.noise.clear();

      // Flood well past the cap from one spot.
      for (let i = 0; i < CONFIG.noise.maxEvents * 3; i++) {
        d.noise.emit(0, 0, 0, 5, 'flood', 'test');
      }
      const peak = d.noise.activeCount;
      const poolSize = d.noise.pool.length;

      // Silence must not occupy a slot.
      const silent = d.noise.emit(0, 0, 0, 0, 'silent', 'test');

      let steps = 0;
      while (d.noise.activeCount > 0 && steps < 120) {
        d.noise.step(dt);
        steps++;
      }
      const drainedSeconds = steps * dt;
      const settled = d.noise.activeCount;

      // And hearing is a plain distance test (Section 7.2).
      d.noise.clear();
      d.noise.emit(10, 0, 0, 8, 'probe', 'test');
      const nearHeard = d.noise.heard({ x: 14, y: 0, z: 0 }) !== null;
      const farHeard = d.noise.heard({ x: 22, y: 0, z: 0 }) !== null;
      d.noise.clear();
      d.reset(h.shade);

      const pass =
        peak <= CONFIG.noise.maxEvents && poolSize === CONFIG.noise.maxEvents &&
        silent === null && settled === 0 &&
        drainedSeconds <= CONFIG.noise.lifetime + dt * 2 && nearHeard && !farHeard;
      return {
        pass,
        detail: `flooded ${CONFIG.noise.maxEvents * 3} -> ${peak} active (cap ${CONFIG.noise.maxEvents}), pool fixed at ${poolSize}; silence took no slot=${silent === null}; drained to ${settled} in ${drainedSeconds.toFixed(2)}s (lifetime ${CONFIG.noise.lifetime}s); heard at 4m=${nearHeard}, at 12m past an 8m radius=${farHeard}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'visibility-feedback-matches-the-meter',
    spec: 'Section 4.2 / check 27',
    name: 'The Shade darkens and brightens in step with the smoothed meter',
    run: (h) => {
      const d = h.detection;
      const materials = h.shade.mesh.userData.materials;
      if (!materials || !materials.outline) return { pass: false, detail: 'shade materials not exposed' };

      const F = CONFIG.detection.feedback;
      const readings = [];
      // Drive the meter directly across its whole range and read what the
      // player would see. This is the disagreement Section 4.2 forbids.
      for (const value of [0, 25, 50, 75, 100]) {
        d.smoothed = value;
        d._applyFeedback(h.shade);
        readings.push({
          meter: value,
          body: materials.teal.color.getHSL({ h: 0, s: 0, l: 0 }).l,
          rim: materials.outline.color.getHSL({ h: 0, s: 0, l: 0 }).l,
        });
      }

      let monotonic = true;
      for (let i = 1; i < readings.length; i++) {
        if (readings[i].body <= readings[i - 1].body) monotonic = false;
        if (readings[i].rim <= readings[i - 1].rim) monotonic = false;
      }
      const darkAtZero = readings[0].body < readings[4].body * (F.silhouetteDarkness + 0.1);
      const rimVisibleAtZero = readings[0].rim > 0;

      // Restore, and prove the value the player sees is the smoothed one and
      // not the raw sample: the two differ mid-transition.
      d.reset(h.shade);
      const rawOnly = d.raw;
      d.smoothed = 0;
      d.raw = 100;
      d.step(CONFIG.time.fixedDt, { shade: h.shade, warden: null });
      const tracksSmoothed = d.litFraction < 0.5;
      d.reset(h.shade);

      return {
        pass: monotonic && darkAtZero && rimVisibleAtZero && tracksSmoothed,
        detail: `body lightness ${readings.map((r) => r.body.toFixed(2)).join(' -> ')}, rim ${readings.map((r) => r.rim.toFixed(2)).join(' -> ')} across meter 0..100; monotonic=${monotonic}, near-black at 0=${darkAtZero}, teal edge still visible at 0=${rimVisibleAtZero}, driven by smoothed not raw=${tracksSmoothed} (raw was ${rawOnly.toFixed(1)})`,
      };
    },
  });
}
