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

/**
 * Walk the Shade at a patrolling Warden in one stance and report what the AI
 * did about it. Checks 11 and 12 are the same approach run twice — same lane,
 * same Warden, same distance, only the stance differs — so anything that could
 * confound them (a stray sight line, a lucky patrol turn) hits both runs
 * equally and the difference between them isolates Section 7.2's noise radii,
 * which is the thing those two checks are actually about.
 *
 * @param {object} h harness
 * @param {'crouch'|'sprint'} stance
 * @param {number} steps how long to approach for
 * @param {number} from how far back to start, in metres
 * @param {number} [stopWithin] stop walking at this range and keep watching, so
 *   a sprint does not simply run past the Warden and into its view cone
 */
function approachAPatrollingWarden(h, stance, steps, from, stopWithin = 0) {
  h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
  const { warden, shade, wardenAI } = h;

  // Stand the Warden on a waypoint, and hold both its position and its facing
  // for the run. Section 11's PATROL pauses at nodes and scans, and over five
  // seconds that scan sweeps far enough to turn round and simply *look* at the
  // Shade — which is a sight detection, not the thing checks 11 and 12 are
  // about. Both live under "Detection" beside the Section 7.2 noise table, and
  // both are phrased as approaches the Warden has not already spotted. Holding
  // the facing is what makes "has not spotted you" true for the whole run; the
  // rest of the AI is live and unmodified.
  const node = h.map.waypoints.find((w) => w.tag && /hall|corridor/.test(w.tag)) || h.map.waypoints[0];
  warden.reset({ position: node.position, yaw: 0 });
  h.stepFrames(2);
  const held = warden.position.clone();
  const heldYaw = warden.yaw;

  // The Shade starts behind the Warden, on the lane it is facing away from.
  // Warden forward is (-sin yaw, -cos yaw), so this is its back.
  const lane = { x: Math.sin(warden.yaw), z: Math.cos(warden.yaw) };
  const start = {
    x: warden.position.x + lane.x * from,
    y: node.position.y,
    z: warden.position.z + lane.z * from,
  };
  // Face back down the lane, toward the Warden: Shade forward is also
  // (-sin yaw, -cos yaw), so it needs the yaw whose forward is -lane.
  shade.reset({ position: start, yaw: Math.atan2(lane.x, lane.z) });
  h.stepFrames(2);

  h.input.clearAll();
  h.input.heldCodes.add('KeyW');
  if (stance === 'crouch') h.input.heldCodes.add('ControlLeft');
  if (stance === 'sprint') h.input.heldCodes.add('ShiftLeft');

  const states = new Set();
  const heard = [];
  const off = h.emitter.on('noise', (event) => {
    if (event.source === 'shade') heard.push(event.type);
  });

  let closest = Infinity;
  let peakAccumulator = 0;
  let sawTheShade = false;
  for (let i = 0; i < steps; i++) {
    warden.position.copy(held);
    warden.velocity.set(0, 0, 0);
    warden.yaw = heldYaw;
    h.stepFrames(1);
    if (wardenAI.sees) sawTheShade = true;
    states.add(wardenAI.state);
    peakAccumulator = Math.max(peakAccumulator, wardenAI.accumulator);
    const range = Math.hypot(
      shade.position.x - warden.position.x,
      shade.position.z - warden.position.z
    );
    closest = Math.min(closest, range);
    // Pull up short rather than barrelling through the Warden and out the
    // front, which would turn a hearing test into a sight test.
    if (stopWithin > 0 && range <= stopWithin) h.input.heldCodes.delete('KeyW');
  }

  off();
  h.input.clearAll();
  return { states: [...states], heard, closest, peakAccumulator, sawTheShade };
}

export function register(debugTools) {
  // -------------------------------------------------------------------------
  // Phase 6 — Warden AI (Section 11)
  // -------------------------------------------------------------------------
  debugTools.registerAutoTest({
    id: 'crouch-approaches-unheard-sprint-does-not',
    spec: 'Section 7.2 / checks 11 and 12',
    name: 'Crouch-walk close and it never reacts; sprint the same lane and it does',
    run: (h) => {
      const problems = [];
      const steps = Math.round(5 / CONFIG.time.fixedDt);

      // Check 11: "crouch-walk within 5m". At 1.6 m/s, 5s covers 8m, so it
      // starts at 8m and ends up on top of the Warden.
      const quiet = approachAPatrollingWarden(h, 'crouch', steps, 8);
      // Check 12: "sprint within 15m", down the same lane, pulling up at 6m.
      const loud = approachAPatrollingWarden(h, 'sprint', steps, 15, 6);

      // Both runs stay behind the Warden, so any reaction is hearing rather
      // than sight. If that ever stops being true the checks below are testing
      // something other than Section 7.2 and should say so.
      if (quiet.sawTheShade) problems.push('the Warden saw the crouching Shade, so this is not a hearing test');
      if (loud.sawTheShade) problems.push('the Warden saw the sprinting Shade, so this is not a hearing test');

      // Section 7.2: a crouch-walking Shade emits nothing at all — not a
      // zero-radius event that the AI then has to filter, nothing.
      if (quiet.heard.filter((type) => type === 'footstep').length !== 0) {
        problems.push(`crouch-walking emitted ${quiet.heard.length} noise events`);
      }
      if (loud.heard.filter((type) => type === 'footstep').length === 0) {
        problems.push('sprinting emitted no footstep noise at all');
      }

      // It has to have actually got close, or "did not react" means nothing.
      if (quiet.closest > 5) problems.push(`the crouch approach only reached ${quiet.closest.toFixed(1)}m, check 11 asks for 5m`);
      if (loud.closest > 15) problems.push(`the sprint approach only reached ${loud.closest.toFixed(1)}m, check 12 asks for 15m`);

      // Check 11: no reaction. PATROL throughout, accumulator flat.
      const reacted = quiet.states.filter((state) => state !== AI_STATE.PATROL);
      if (reacted.length) problems.push(`crouch-walking put the Warden into [${reacted}]`);
      if (quiet.peakAccumulator > 0) {
        problems.push(`crouch-walking filled the detection accumulator to ${quiet.peakAccumulator.toFixed(1)}`);
      }

      // Check 12: SUSPICIOUS then INVESTIGATE.
      if (loud.states.indexOf(AI_STATE.SUSPICIOUS) === -1) problems.push('sprinting never made it SUSPICIOUS');
      if (loud.states.indexOf(AI_STATE.INVESTIGATE) === -1) problems.push('sprinting never made it INVESTIGATE');

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `crouch-walked to ${quiet.closest.toFixed(1)}m: silent, states [${quiet.states}], accumulator `
            + `${quiet.peakAccumulator.toFixed(1)}; sprinted the same lane to ${loud.closest.toFixed(1)}m: `
            + `${loud.heard.length} noise events, states [${loud.states}]`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'ai-places-its-alarm-camera-and-acts-on-it',
    spec: 'Section 9.2',
    name: 'The Warden hangs its one camera, and a trip becomes knowledge, not a HUD icon',
    run: (h) => {
      const problems = [];
      const C = CONFIG.gadgets.alarmCamera;
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      const { wardenAI, gadgets, warden, shade } = h;

      if (gadgets.loadout.alarmCamera !== C.count) {
        problems.push(`the round started with ${gadgets.loadout.alarmCamera} cameras, spec ${C.count}`);
      }

      // Drive it into SEARCH, which is where it arrives somewhere, clears it,
      // and walks away — the moment an early warning is worth leaving behind.
      wardenAI.lastKnown = { x: shade.position.x, y: shade.feetY, z: shade.position.z };
      wardenAI._enterSearch();

      let placedAfter = 0;
      const limit = Math.round(40 / CONFIG.time.fixedDt);
      while (!gadgets.alarm && placedAfter++ < limit) h.stepFrames(1);
      const placed = gadgets.alarm;

      if (!placed) {
        return { pass: false, detail: `the AI never placed a camera across ${(limit * CONFIG.time.fixedDt).toFixed(0)}s of SEARCH` };
      }
      if (gadgets.loadout.alarmCamera !== 0) {
        problems.push(`placing left ${gadgets.loadout.alarmCamera} in the loadout, spec is 1 per round`);
      }
      if (!h.effects.alarmFixture.visible) problems.push('no fixture appeared for the AI-placed camera');

      // On a wall, not floating: something solid behind it, and the lens
      // pointing away from that surface.
      const behind = h.map.collision.raycast(
        { x: placed.x, y: placed.y, z: placed.z },
        { x: Math.sin(placed.yaw), y: 0, z: Math.cos(placed.yaw) },
        C.surfaceOffset * 3
      );
      if (!behind) problems.push('the camera is not mounted against anything');

      // It has one. It must not keep placing them.
      const before = h.effects.alarmFixture.position.clone();
      h.stepFrames(Math.round(10 / CONFIG.time.fixedDt));
      if (h.effects.alarmFixture.position.distanceTo(before) > 1e-6) {
        problems.push('the AI placed a second camera in the same round');
      }

      // Now trip it, and assert the AI learns where the SHADE is — not where
      // the camera is, which is the difference between a tripwire and a noise.
      wardenAI._enter(AI_STATE.PATROL);
      wardenAI.lastKnown = null;
      gadgets.shadeMarkedFor = 0;
      gadgets.shadeMarkedAt = null;

      const reach = Math.min(C.radius * 0.4, 2.5);
      const front = { x: -Math.sin(placed.yaw), z: -Math.cos(placed.yaw) };
      shade.reset({
        position: { x: placed.x + front.x * reach, y: placed.y - 1.0, z: placed.z + front.z * reach },
        yaw: 0,
      });
      // Out of the Warden's own sight, so any reaction is the camera's doing.
      warden.reset(h.map.wardenSpawns.reduce((far, spawn) => (
        spawn.position.distanceTo(shade.position) > far.position.distanceTo(shade.position) ? spawn : far
      ), h.map.wardenSpawns[0]));

      let tripped = false;
      for (let i = 0; i < Math.round(3 / CONFIG.time.fixedDt) && !tripped; i++) {
        h.stepFrames(1);
        tripped = gadgets.shadeMarked;
      }
      if (!tripped) problems.push('standing in the cone never marked the Shade');
      // Gadgets steps after the AI in the fixed step, so the mark set on this
      // step is read on the next. One frame of latency, not a bug — but the
      // check has to let it happen rather than measuring the step before.
      h.stepFrames(4);
      if (wardenAI.sees) problems.push('the Warden could see the Shade, so this proves nothing about the camera');

      const known = wardenAI.lastKnown;
      if (!known) {
        problems.push('the camera tripped and the AI learned nothing');
      } else {
        const toShade = Math.hypot(known.x - shade.position.x, known.z - shade.position.z);
        const toCamera = Math.hypot(known.x - placed.x, known.z - placed.z);
        if (toShade > 1.0) problems.push(`the AI was told the Shade is ${toShade.toFixed(2)}m from where it is`);
        if (toCamera < toShade) problems.push('the AI went to the camera rather than to the Shade');
      }
      if (wardenAI.state !== AI_STATE.INVESTIGATE) {
        problems.push(`a camera trip left the AI in ${wardenAI.state}, want investigate`);
      }

      // A new round hands it a fresh camera (Section 9.2: one PER ROUND).
      h.objective.resetRound(2);
      if (h.gadgets.loadout.alarmCamera !== C.count) {
        problems.push(`round 2 started with ${h.gadgets.loadout.alarmCamera} cameras`);
      }
      if (h.gadgets.alarm) problems.push('the previous round\'s camera survived the reset');

      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `hung its one camera on a wall after ${(placedAfter * CONFIG.time.fixedDt).toFixed(1)}s of SEARCH `
            + 'and placed no second; a trip told it where the SHADE was (not where the camera was) '
            + 'and sent it to investigate without ever seeing it; a new round restores the camera'
          : problems.join('; '),
      };
    },
  });

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
    maps: ['plant'], // the hall's east wall is the through-wall case
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
    maps: ['plant'], // stands in the Turbine Hall lane at (-24, -19), lit by hall-1; the yard's lane is D5's
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
