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
import { AI_STATE } from '../systems/ai.js';
import { clearLane } from './lanes.js';
import { moduleText, ranModules } from './moduletexts.js';
import { AS_CODE, AS_WORDING, codeOf, readerProblems, uncommented } from './sourcetext.js';

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
    spec: "Section 7.1 - the plant by name: the Turbine Hall and the Server Vault (Section 16's eighth and ninth, the auto half; the set holds them on every map through a-lamp-lit-site-reads-lit-and-the-darkest-ground-reads-dark)",
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
          body: materials.body.color.getHSL({ h: 0, s: 0, l: 0 }).l,
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

  // -------------------------------------------------------------------------
  // M6 - what the alarm camera's feed means (Section 9.2 / 20.36)
  // -------------------------------------------------------------------------
  debugTools.registerAutoTest({
    id: 'the-alarm-feed-is-the-human-wardens-to-notice-and-the-ai-never-reads-it',
    spec: 'Section 9.2 / 20.36 / M6',
    name: 'The AI modules name nothing of the camera feed (read with their comments out), a Shade in the camera lens but beyond its trip radius and out of the Warden\'s sight leaves the AI in PATROL with no suspicion, and PLAYTEST.md says the feed is the human Warden\'s to watch',
    run: async (h) => {
      const problems = [];
      const notes = [];
      const origin = location.origin;

      // 1. The source, two clauses and two readers (H62, H95). Does the AI
      //    *read* the feed is a doing question, so the body is asked of the
      //    strong reader: a mention in prose or in a string is not a use. The
      //    import is a string, which that reader empties, so it is asked
      //    separately of the weak one.
      const AI_MODULES = ['ai', 'ainav', 'aiperception', 'aihearing', 'aisearch', 'aialarm', 'aipatrol', 'aistate', 'detection'];
      const FEED = /camera\s*feed/i;
      const inBody = (code) => (FEED.test(code) ? 'the feed' : '');
      const inImport = (said) => (/^\s*import\b[^;]*['"][^'"]*camerafeed/i.test(said) ? 'the feed module' : '');
      problems.push(...readerProblems(
        inBody,
        [['this.cameraFeed = null;', 'the feed'], ['const f = createCameraFeed(renderer);', 'the feed']],
        ["import { x } from '../camerafeed.js';", '// the cameraFeed is not read here', "  * cameraFeed is the human's", 'const a = 1; // cameraFeed'],
        codeOf,
      ));
      problems.push(...readerProblems(
        inImport,
        [["import { x } from '../camerafeed.js';", 'the feed module']],
        ["// import { x } from '../camerafeed.js';", 'const a = 1;'],
        uncommented,
      ));
      const ran = ranModules(origin) || [];
      const paths = AI_MODULES.map((name) => `src/systems/${name}.js`).filter((path) => ran.includes(path));
      let read = 0;
      for (const path of paths) {
        const module = await moduleText(origin, path);
        if (module.error) { problems.push(module.error); continue; }
        read++;
        const hit = module.code.split(/\r?\n/).findIndex((line) => inBody(line));
        if (hit !== -1) problems.push(`${path} names the camera feed ${AS_CODE} (line ${hit + 1}): the feed is the human Warden's, the AI must not read it`);
        const bound = module.said.split(/\r?\n/).findIndex((line) => inImport(line));
        if (bound !== -1) problems.push(`${path} imports the feed module, read ${AS_WORDING} (line ${bound + 1}): the AI must not depend on it`);
      }
      if (read < 5) problems.push(`only ${read} AI modules were read, so the source clause read nothing`);

      // 2. The behaviour. A camera hung on a wall, the Shade in its lens just
      //    outside the trip radius, the Warden far off and out of sight.
      const dt = CONFIG.time.fixedDt;
      const C = CONFIG.gadgets.alarmCamera;
      const R = C.radius;
      const eye = CONFIG.warden.standHeight * CONFIG.warden.eyeHeightRatio;
      const torso = CONFIG.shade.crouchHeight * CONFIG.detection.torsoHeightRatio;
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      h.input.clearAll();
      const { gadgets, shade, warden, wardenAI } = h;
      const ground = h.map.wardenGround;
      const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
      let stage = null;
      for (const node of h.map.waypoints) {
        for (let i = 0; i < 32 && !stage; i++) {
          const angle = (i / 32) * Math.PI * 2;
          const cam = gadgets.findAlarmWall(
            { x: node.position.x, y: node.position.y + eye, z: node.position.z },
            { x: Math.sin(angle), y: 0, z: Math.cos(angle) }
          );
          if (!cam) continue;
          const fwd = { x: -Math.sin(cam.yaw), y: 0, z: -Math.cos(cam.yaw) };
          const cone = Math.cos((C.coneDegrees * Math.PI) / 360);
          const stands = ground.cellsWithin(cam, R + 3).filter((c) => {
            const d = flat(c, cam);
            const target = { x: c.x, y: c.y + torso, z: c.z };
            return d >= R + 0.5 && d <= R + 2.5 && Math.abs(c.y - (cam.y - eye)) < 3
              && gadgets._inCone(cam, fwd, target, R + 3, cone) && h.map.collision.lineOfSight(cam, target);
          });
          if (!stands.length) continue;
          const at = stands[0];
          const target = { x: at.x, y: at.y + torso, z: at.z };
          const far = ground.cellsWithin(at, 400)
            .filter((c) => flat(c, at) > CONFIG.ai.viewRange + 5 && !h.map.collision.lineOfSight({ x: c.x, y: c.y + eye, z: c.z }, target))
            .sort((a, b) => flat(b, at) - flat(a, at));
          if (far.length) stage = { cam, at, away: far[0] };
        }
        if (stage) break;
      }
      if (!stage) {
        notes.push(`no wall in lens of ground ${R + 0.5}-${R + 2.5}m out with a Warden stand beyond ${CONFIG.ai.viewRange + 5}m and out of sight on this map, so the behaviour clause did not stand here`);
      } else {
        const placed = gadgets.placeAlarm(stage.cam, stage.cam.yaw);
        warden.reset({ position: stage.away, yaw: 0 });
        wardenAI._enter(AI_STATE.PATROL);
        wardenAI.lastKnown = null;
        wardenAI.accumulator = 0;
        // Standing guard: a Warden walking its circuit might wander into sight, and then it is her eyes that are tested, not the feed.
        wardenAI._pauseTimer = 10;
        shade.reset({ position: stage.at, yaw: Math.atan2(-(stage.cam.x - stage.at.x), -(stage.cam.z - stage.at.z)) });
        let fired = false;
        const off = h.emitter.on('gadget:alarm', () => { fired = true; });
        let peak = 0;
        let sawIt = false;
        let left = null;
        for (let f = 0; f < Math.round(5 / dt); f++) {
          h.stepFrames(1);
          peak = Math.max(peak, wardenAI.accumulator);
          if (wardenAI.sees) sawIt = true;
          if (wardenAI.state !== AI_STATE.PATROL) left = left || wardenAI.state;
        }
        off();
        if (!placed) problems.push('the alarm camera could not be hung for the behaviour clause');
        if (fired) problems.push('the camera tripped, so the Shade was inside its trip radius and the clause is about the wrong thing');
        if (sawIt) problems.push('the Warden saw the Shade by its own eyes, so the stand was not out of sight');
        if (left) {
          problems.push(`the Shade in the lens, ${flat(stage.at, stage.cam).toFixed(1)}m out and ${flat(stage.at, stage.away).toFixed(1)}m from the Warden, took the AI to ${left}, want patrol`);
        }
        if (peak > 0) problems.push(`the AI's suspicion rose to ${peak.toFixed(1)} with the Shade only on the feed`);
        notes.push(`Shade ${flat(stage.at, stage.cam).toFixed(1)}m in the lens, Warden ${flat(stage.at, stage.away).toFixed(1)}m off: ${wardenAI.state}, suspicion peak ${peak.toFixed(1)}`);
      }
      h.input.clearAll();

      // 3. The record.
      const response = await fetch(`${origin}/PLAYTEST.md`);
      if (!response.ok) {
        problems.push(`PLAYTEST.md: HTTP ${response.status}`);
      } else {
        const text = (await response.text()).replace(/[\s*]+/g, ' ');
        if (!text.includes('The AI never reads the feed')) problems.push('PLAYTEST.md no longer says "The AI never reads the feed"');
      }

      return {
        pass: problems.length === 0,
        detail: problems.length ? problems.join('; ') : `${read} AI modules read with comments out, none names the feed; ${notes.join('; ')}; PLAYTEST.md carries the rule`,
      };
    },
  });
}
