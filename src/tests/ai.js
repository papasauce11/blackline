/**
 * BLACKLINE - tests/ai.js
 *
 * AUTO suite (Section 16, Section 17.1): Warden AI.
 *
 * Pathfinding, patrol, perception and the Section 11 state machine.
 *
 * Registered from tests/index.js. Checks reach the live game through the
 * harness `h`; nothing here imports main.js, which Section 3.1 forbids.
 */

import { CONFIG, rng } from '../config.js';
import { AI_STATE } from '../systems/ai.js';

export function register(debugTools) {
  // -------------------------------------------------------------------------
  // Phase 6 — Warden AI (Section 11)
  // -------------------------------------------------------------------------
  debugTools.registerAutoTest({
    id: 'ai-paths-between-every-waypoint-pair',
    spec: 'Section 11 (A* over the waypoint graph)',
    name: 'A* returns a valid, acyclic, connected route for every node pair',
    run: (h) => {
      const ai = h.wardenAI;
      const nodes = h.map.waypoints;
      const problems = [];
      let pairs = 0;
      let longest = 0;

      for (let a = 0; a < nodes.length; a++) {
        for (let b = 0; b < nodes.length; b++) {
          pairs++;
          const path = ai._findPath(a, b);
          // A path must start where asked, end where asked, contain no repeats,
          // and only step along declared links. A cycle in the parent chain
          // shows up here as a repeat rather than as a hung tab.
          if (path[0] !== a) problems.push(`${a}->${b} starts at ${path[0]}`);
          if (path[path.length - 1] !== b) problems.push(`${a}->${b} ends at ${path[path.length - 1]}`);
          if (new Set(path).size !== path.length) problems.push(`${a}->${b} revisits a node: [${path}]`);
          for (let i = 1; i < path.length; i++) {
            if (nodes[path[i - 1]].links.indexOf(path[i]) === -1) {
              problems.push(`${a}->${b} steps ${path[i - 1]}->${path[i]} with no link`);
            }
          }
          longest = Math.max(longest, path.length);
          if (problems.length > 4) break;
        }
        if (problems.length > 4) break;
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${pairs} node pairs, every route valid and acyclic, longest ${longest} nodes`
          : problems.slice(0, 4).join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'ai-patrols-without-getting-stuck',
    spec: 'Section 11 (PATROL, stuck handling)',
    name: 'The Warden walks its circuit for a minute without wedging',
    run: (h) => {
      const ai = h.wardenAI;
      const dt = CONFIG.time.fixedDt;
      h.warden.reset(h.map.wardenSpawns[0]);
      ai.reset();

      const start = h.warden.position.clone();
      let travelled = 0;
      const previous = h.warden.position.clone();
      const seen = new Set();
      // A minute of patrol with no Shade to notice, so it should never leave
      // PATROL of its own accord.
      for (let i = 0; i < 60 / dt; i++) {
        h.warden.step(dt, ai.step(dt, { shade: null }));
        travelled += previous.distanceTo(h.warden.position);
        previous.copy(h.warden.position);
        seen.add(ai.state);
      }

      const strayed = [...seen].filter((state) => state !== AI_STATE.PATROL);
      const onFloor = h.warden.feetY > -CONFIG.debug.floorTolerance;
      const clear = h.map.collision.isClear(h.warden.position, h.warden.half);
      const moved = start.distanceTo(h.warden.position);

      h.warden.reset(h.map.wardenSpawns[0]);
      ai.reset();

      // Stuck detection is allowed to fire — the point is that it recovers and
      // keeps walking, not that a 60s patrol is always perfectly smooth.
      const pass = travelled > 30 && strayed.length === 0 && onFloor && clear && ai.stuckCount <= 4;
      return {
        pass,
        detail: `walked ${travelled.toFixed(1)}m over 60s (net ${moved.toFixed(1)}m), states [${[...seen].join(' ')}], stuck re-paths ${ai.stuckCount}, feet ${h.warden.feetY.toFixed(2)}, capsule clear=${clear}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'ai-perception-cone-and-accumulator',
    spec: 'Section 11 (perception)',
    name: '90 degree cone, 25m, needs an unobstructed ray; drains without one',
    run: (h) => {
      const ai = h.wardenAI;
      const dt = CONFIG.time.fixedDt;

      // Face the Warden down a long clear lane in the Turbine Hall.
      const place = (shadeX, shadeZ) => {
        h.warden.reset(h.map.wardenSpawns[0]);
        h.warden.position.set(-24, CONFIG.warden.standHeight / 2 + 0.05, -19);
        h.warden.yaw = Math.PI; // +Z, down the lane
        h.shade.reset(h.map.shadeSpawns[0]);
        h.shade.position.set(shadeX, CONFIG.shade.standHeight / 2 + 0.05, shadeZ);
        ai.reset();
        ai.accumulator = 0;
        h.detection.reset(h.shade);
        h.detection.smoothed = CONFIG.detection.meterMax; // fully lit, worst case
      };

      const look = (steps) => {
        for (let i = 0; i < steps; i++) {
          h.detection.smoothed = CONFIG.detection.meterMax;
          ai._perceive(dt, h.shade);
        }
        return { sees: ai.sees, acc: ai.accumulator };
      };

      // 1. Straight ahead, 8m, clear line: seen, accumulator climbs.
      place(-24, -11);
      const ahead = look(30);

      // 2. Directly behind: outside the 90 degree cone.
      place(-24, -25);
      const behind = look(30);

      // 3. Ahead but past the 25m range.
      place(-24, 8);
      const far = look(30);

      // 4. Ahead and in range, but with the hall's east wall between them.
      place(-2, -11);
      const walled = look(30);

      // 5. Drains at 15/s once sight is lost (Section 11).
      place(-24, -11);
      look(120);
      const peak = ai.accumulator;
      h.shade.position.set(-24, CONFIG.shade.standHeight / 2 + 0.05, -25); // step behind
      const before = ai.accumulator;
      for (let i = 0; i < 1 / dt; i++) ai._perceive(dt, h.shade);
      const drained = before - ai.accumulator;

      h.shade.reset(h.map.shadeSpawns[0]);
      h.warden.reset(h.map.wardenSpawns[0]);
      ai.reset();
      h.detection.reset(h.shade);

      const problems = [];
      if (!ahead.sees || ahead.acc <= 0) problems.push('did not see a lit Shade 8m dead ahead');
      if (behind.sees) problems.push('saw through the back of its own head');
      if (far.sees) problems.push(`saw past the ${CONFIG.ai.viewRange}m range`);
      if (walled.sees) problems.push('saw through a wall');
      if (Math.abs(drained - CONFIG.ai.drainRate) > 1.5) {
        problems.push(`drained ${drained.toFixed(1)}/s, spec is ${CONFIG.ai.drainRate}/s`);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `ahead acc ${ahead.acc.toFixed(1)}; behind/out-of-range/through-wall all unseen; peaked ${peak.toFixed(1)} then drained ${drained.toFixed(1)}/s (spec ${CONFIG.ai.drainRate})`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'ai-state-machine-follows-section-11',
    spec: 'Section 11 (state table)',
    name: 'Noise, thresholds and a stun move the AI through the spec states',
    run: (h) => {
      const ai = h.wardenAI;
      const dt = CONFIG.time.fixedDt;
      const problems = [];

      const settle = () => {
        h.warden.reset(h.map.wardenSpawns[0]);
        h.shade.reset(h.map.shadeSpawns[0]);
        ai.reset();
        h.detection.noise.clear();
      };

      // The whole escalation, driven the way play drives it: a noise puts the
      // Warden on alert, it turns and walks to the source, sees the Shade on
      // the way in, and the accumulator carries it to ENGAGE. Poking the
      // accumulator directly does not work and should not — the drain runs
      // before the threshold test, so an assigned 100 is already below it.
      settle();
      h.warden.position.set(-24, CONFIG.warden.standHeight / 2 + 0.05, -19);
      h.warden.yaw = Math.PI; // +Z, down a clear lane in the Turbine Hall
      h.shade.position.set(-24, CONFIG.shade.standHeight / 2 + 0.05, -11);
      h.detection.reset(h.shade);
      h.detection.noise.emit(
        h.shade.position.x, h.shade.feetY, h.shade.position.z, 12, 'test', 'shade'
      );

      // Tick detection alongside, exactly as fixedStep does. Without it the
      // noise field never ages, a stale event lives forever, and the Warden
      // re-investigates it the moment it wanders back into range.
      const drive = (steps, target, shade) => {
        for (let i = 0; i < steps; i++) {
          h.detection.step(dt, { shade, warden: h.warden });
          // Hold the Shade fully lit; the meter itself is Phase 5's problem.
          h.detection.smoothed = CONFIG.detection.meterMax;
          h.warden.step(dt, ai.step(dt, { shade }));
          if (target && ai.state === target) return i;
        }
        return -1;
      };

      ai._perceive(dt, h.shade);
      if (ai.state !== AI_STATE.SUSPICIOUS) problems.push(`noise gave ${ai.state}, want suspicious`);
      if (drive(Math.ceil((CONFIG.ai.suspiciousHold + 0.2) / dt), AI_STATE.INVESTIGATE, h.shade) < 0) {
        problems.push(`after the hold got ${ai.state}, want investigate`);
      }
      if (drive(Math.ceil(20 / dt), AI_STATE.ENGAGE, h.shade) < 0) {
        problems.push(`never engaged a lit Shade in view (state ${ai.state}, acc ${ai.accumulator.toFixed(0)})`);
      }

      // Losing sight for 2.5s in ENGAGE -> SEARCH.
      drive(Math.ceil((CONFIG.ai.engageLoseSightTime + 0.3) / dt), null, null);
      if (ai.state !== AI_STATE.SEARCH) problems.push(`lost sight gave ${ai.state}, want search`);

      // SEARCH times out back to PATROL.
      drive(Math.ceil((CONFIG.ai.searchDuration + 0.5) / dt), null, null);
      if (ai.state !== AI_STATE.PATROL) problems.push(`search timeout gave ${ai.state}, want patrol`);

      // A stun freezes it, and Section 11 says it comes out into SEARCH.
      settle();
      h.warden.stun(0.5);
      h.warden.step(dt, ai.step(dt, { shade: null }));
      if (ai.state !== AI_STATE.STUNNED) problems.push(`stun gave ${ai.state}, want stunned`);
      const frozen = h.warden.position.clone();
      drive(Math.ceil(0.4 / dt), null, null);
      if (frozen.distanceTo(h.warden.position) > 0.05) problems.push('moved while stunned');
      drive(Math.ceil(0.4 / dt), null, null);
      if (ai.state !== AI_STATE.SEARCH) problems.push(`stun ended in ${ai.state}, want search`);

      settle();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? 'noise -> suspicious -> investigate; accumulator 100 -> engage; sight lost 2.5s -> search; search timeout -> patrol; stun freezes then -> search'
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'ai-patrol-order-is-seed-reproducible',
    spec: 'Section 16 check 28',
    name: 'The same seed reproduces the same patrol circuit',
    run: (h) => {
      const ai = h.wardenAI;
      const seed = 0xa17ea5;

      rng.reseed(seed);
      ai.reset();
      const first = ai._circuit.slice();

      rng.reseed(seed);
      ai.reset();
      const second = ai._circuit.slice();

      rng.reseed(seed + 1);
      ai.reset();
      const other = ai._circuit.slice();

      rng.reseed(h.match.seed);
      ai.reset();

      const same = first.join() === second.join();
      const differs = first.join() !== other.join();
      const covers = new Set(first).size === h.map.waypoints.length;
      return {
        pass: same && differs && covers,
        detail: `same seed identical=${same}, seed+1 differs=${differs}, circuit covers all ${h.map.waypoints.length} nodes=${covers}; first 6 [${first.slice(0, 6).join(' ')}]`,
      };
    },
  });
}
