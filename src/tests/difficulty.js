/**
 * BLACKLINE - tests/difficulty.js
 *
 * AUTO suite (Section 16, Section 17.1): the Section 11 difficulty presets,
 * measured (C5).
 *
 * `difficulty-preset-reaches-the-ai` (tests/settings.js) proves the three
 * presets reach the AI and differ. This file asks what they are worth: how
 * long a lit, still Shade in plain view lasts before the Warden engages
 * (time-to-detect) and how long after that before it is dead (time-to-kill),
 * on one lane at two ranges, and requires both to fall from one preset to
 * the next in the order `config.js` lists them. A preset that is "harder"
 * by its numbers and not by its clock is decoration, and this is the check
 * that would say so. Its first run said so twice: the gun was aimed at the
 * Shade's feet (0 of 52 hit at 8m on every preset), and a burst was counted
 * in steps rather than rounds (one round, sometimes two, then a pause).
 *
 * Registered from tests/index.js. Checks reach the live game through the
 * harness `h`; nothing here imports main.js, which Section 3.1 forbids.
 */

import { CONFIG, SETTINGS, mulberry32 } from '../config.js';
import { AI_STATE } from '../systems/ai.js';
import { LIT_METER, alongLane, litLane } from './lanes.js';
import { exploreSeed } from './seeds.js';

const A = CONFIG.ai;

/**
 * Metres up the lane, both inside `engageRange` so the Warden fires from
 * where it stands. At 16m the aim error cone is twice the metres it is at 8.
 */
const RANGES = [8, 16];
/**
 * The lane: a clear run the map's lamps light at both ranges (`litLane`,
 * D5), the Warden at its foot facing along it, the Shade up it, nothing
 * between them. Until D5 it was the Turbine Hall's by coordinate, which
 * kept both checks off the yard; on the plant it is still the hall's, from
 * `hall-north` under hall-1 (site A has no 17m run), and D33's table stands
 * to the hundredth. On the yard it runs north from site C up the gate lane
 * (meter 63 at 8m, 80 at 16m under the walkway's lamp).
 */
const lane = (h) => litLane(h, RANGES[RANGES.length - 1] + 1, RANGES);
/** The yaw that faces back down a lane: forward is (-sin yaw, -cos yaw). */
const facingBack = (lane) => Math.atan2(lane.dx, lane.dz);
/**
 * Seeds every preset is measured with at every range: the comparison is paired,
 * so the eight move together or not at all. `?seed=` moves them (tests/seeds.js).
 */
const SEEDS = [0xd1f1, 0xd1f2, 0xd1f3, 0xd1f4, 0xd1f5, 0xd1f6, 0xd1f7, 0xd1f8]
  .map((pinned, i) => exploreSeed(`difficulty-preset-${i}`, pinned));
/** The one engagement the aim check is measured in. */
const ENGAGEMENT_SEED = exploreSeed('difficulty-engagement', 0xb0b5);
/** The longest a detection or a kill is allowed to take before it is a stall. */
const DETECT_LIMIT = 40;
const KILL_LIMIT = 30;

/**
 * F17's twelve engagements, and they stay pinned. The first two are the
 * regression itself, one per map, each of them a 30s engagement at the old
 * 5.0 degree cone and a kill at 4.0:
 *
 *   - `1637054825` is the yard's, and is what the 2026-09-27 audit drew -
 *     23 bursts, 119 rounds, 2 hits, alive. It is also exactly what
 *     `exploreSeed('difficulty-preset-0', 0xd1f1)` returns under
 *     `?seed=20260927`, which is how the audit reached it.
 *   - `4196849476` is the plant's - 3 of 119 at 5.0, dead in 12.40s at 4.0 -
 *     found by walking seeds through this same engagement at the old cone.
 *     Without it a revert would be red on the yard only, and a check that
 *     catches a regression on one map of two is half a check.
 *
 * The other ten are one mulberry32 walk from 0xf17, so ten engagements cost
 * one number to write down. All twelve are literals rather than
 * `exploreSeed` sites, for the reason the other reproducibility seeds are
 * (`tests/seeds.js`), and the first is deliberately not in PINNED_SEEDS:
 * that census compares by value, and this value is one a URL seed produces,
 * so listing it would be red on the one run this job exists to pass. The
 * argument is written out beside PINNED_SEEDS.
 */
const STALL_SEEDS = [1637054825, 4196849476, ...(() => {
  const next = mulberry32(0xf17);
  return Array.from({ length: 10 }, () => (next() * 0x100000000) >>> 0);
})()];

/**
 * One engagement on one preset from one seed: the Warden held on its spot
 * facing up the lane, the Shade standing lit and still `range` metres ahead.
 * The AI is live and unmodified; the Warden's position is held so the
 * numbers are about the preset at one range, and its facing only until it
 * engages, so the aim is the AI's own.
 *
 * The frag is taken out of its loadout first: Section 11 throws one at a
 * Shade that has held still for 2s, and a 60-damage blast at the fuse would
 * put every preset at the same number. The frag is Section 9's, and its
 * checks measure it.
 *
 * @returns {{ detect: number, kill: number, shots: number, hits: number,
 *   stalled: string|null }} seconds from the first step in view to ENGAGE,
 *   and from ENGAGE to the death; or a stall's reason
 */
function engage(h, name, seed, range, LANE) {
  const dt = CONFIG.time.fixedDt;
  SETTINGS.difficulty = name;
  h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true, seed });
  const { warden, shade, wardenAI, detection, combat, gadgets } = h;
  gadgets.loadout.frag = 0;

  warden.reset({ position: { x: LANE.x, y: LANE.y, z: LANE.z }, yaw: LANE.yaw });
  shade.reset({ position: alongLane(LANE, range), yaw: facingBack(LANE) });
  h.stepFrames(2);
  const held = warden.position.clone();
  wardenAI.reset();
  wardenAI.accumulator = 0;
  h.input.clearAll();

  // Fully lit, the worst case for the Shade and the same for every preset;
  // what the lane's lighting reads is Section 7's business. The AI reads the
  // meter before detection rewrites it in the same step, so this is what it
  // sees on the next step.
  const lit = () => { detection.smoothed = CONFIG.detection.meterMax; };
  lit();

  const hold = (facing) => {
    warden.position.copy(held);
    warden.velocity.set(0, 0, 0);
    if (facing) warden.yaw = LANE.yaw;
  };

  const shotsBefore = combat.shots;
  const hitsBefore = combat.hits;
  let detect = -1;
  const detectSteps = Math.round(DETECT_LIMIT / dt);
  for (let i = 0; i < detectSteps; i++) {
    hold(true);
    h.stepFrames(1);
    lit();
    if (wardenAI.state === AI_STATE.ENGAGE) {
      detect = (i + 1) * dt;
      break;
    }
  }
  if (detect < 0) {
    return {
      detect, kill: -1, shots: 0, hits: 0,
      stalled: `never engaged in ${DETECT_LIMIT}s (state ${wardenAI.state}, accumulator ${wardenAI.accumulator.toFixed(0)})`,
    };
  }

  // ENGAGE fires on the step it is entered, so the kill is counted from that
  // step and its round is in the count.
  let kill = -1;
  const killSteps = Math.round(KILL_LIMIT / dt);
  for (let i = 0; i < killSteps; i++) {
    if (shade.health <= 0) {
      kill = i * dt;
      break;
    }
    hold(false);
    h.stepFrames(1);
    lit();
  }
  const shots = combat.shots - shotsBefore;
  const hits = combat.hits - hitsBefore;
  return {
    detect,
    kill,
    shots,
    hits,
    stalled: kill < 0
      ? `not dead after ${KILL_LIMIT}s of ENGAGE (${hits} of ${shots} shots hit, state ${wardenAI.state})`
      : null,
  };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'each-difficulty-is-quicker-to-see-you-and-quicker-to-kill-you',
    spec: 'Section 11 (difficulty)',
    name: 'Time-to-detect and time-to-kill both fall from one preset to the next, at 8m and at 16m',
    run: (h) => {
      const problems = [];
      const was = SETTINGS.difficulty;
      const names = Object.keys(A.difficulty);
      const lines = [];
      const LANE = lane(h);
      if (!LANE) {
        return { pass: false, detail: `no clear lane of ${RANGES[RANGES.length - 1] + 1}m the lamps light to ${LIT_METER} at ${RANGES.join('m and ')}m on this map` };
      }

      for (const range of RANGES) {
        const measured = [];
        for (const name of names) {
          const runs = SEEDS.map((seed) => engage(h, name, seed, range, LANE));
          const stalled = runs
            .map((run, i) => (run.stalled ? `seed ${i}: ${run.stalled}` : null))
            .filter(Boolean);
          if (stalled.length) problems.push(`${name} at ${range}m: ${stalled.join('; ')}`);
          const mean = (key) => runs.reduce((sum, run) => sum + run[key], 0) / runs.length;
          measured.push({
            name,
            detect: mean('detect'),
            kill: mean('kill'),
            kills: runs.map((run) => run.kill),
            shots: runs.reduce((sum, run) => sum + run.shots, 0),
            hits: runs.reduce((sum, run) => sum + run.hits, 0),
          });
        }

        // The order in config.js is the order of difficulty. Each preset must
        // see the Shade sooner and kill it sooner than the one before it.
        for (let i = 1; i < measured.length; i++) {
          const easier = measured[i - 1];
          const harder = measured[i];
          if (!(harder.detect < easier.detect)) {
            problems.push(`at ${range}m ${harder.name} detects in ${harder.detect.toFixed(2)}s, not sooner than ${easier.name}'s ${easier.detect.toFixed(2)}s`);
          }
          if (!(harder.kill < easier.kill)) {
            problems.push(`at ${range}m ${harder.name} kills in ${harder.kill.toFixed(2)}s, not sooner than ${easier.name}'s ${easier.kill.toFixed(2)}s`);
          }
        }

        // The runner keeps 400 characters of a detail line; the per-seed
        // kills go to the F4 log.
        lines.push(`${range}m: ${measured.map((m) => (
          `${m.name} ${m.detect.toFixed(2)}s/${m.kill.toFixed(2)}s ${m.hits}/${m.shots}`
        )).join(', ')}`);
        for (const m of measured) {
          debugTools.logResult(`difficulty ${m.name} at ${range}m: kills [${m.kills.map((k) => k.toFixed(2)).join(' ')}]s`);
        }
      }

      SETTINGS.difficulty = was;
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });

      const report = `detect/kill, hits/shots; lit, still, ${SEEDS.length} seeds each, from ${LANE.from} `
        + `(meter ${LANE.meters.map((m) => m.toFixed(0)).join('/')} at ${RANGES.join('/')}m) - ${lines.join(' | ')}`;
      return {
        pass: problems.length === 0,
        detail: problems.length === 0 ? report : `${problems.join('; ')} - ${report}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-warden-fires-in-bursts-of-rounds-at-the-torso',
    spec: 'Section 11 (ENGAGE), Section 17.1 (god mode)',
    name: 'A burst is 3-7 rounds at the gun\'s rate, aimed at the torso, and god mode stops every one',
    run: (h) => {
      const dt = CONFIG.time.fixedDt;
      const G = CONFIG.combat.gun;
      const problems = [];
      const was = SETTINGS.difficulty;
      const LANE = lane(h);
      if (!LANE) return { pass: false, detail: `no clear lane the lamps light to ${LIT_METER} on this map` };
      // The tightest cone, so nearly every round lands and the impacts say
      // where the gun was pointed.
      const names = Object.keys(A.difficulty);
      SETTINGS.difficulty = names[names.length - 1];
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true, seed: ENGAGEMENT_SEED });
      const { warden, shade, wardenAI, detection, combat, gadgets } = h;
      gadgets.loadout.frag = 0;
      warden.reset({ position: { x: LANE.x, y: LANE.y, z: LANE.z }, yaw: LANE.yaw });
      shade.reset({ position: alongLane(LANE, RANGES[0]), yaw: facingBack(LANE) });
      h.stepFrames(2);
      const held = warden.position.clone();
      wardenAI.reset();
      // Straight to the fight: the fill is the other check's business.
      wardenAI.accumulator = A.engageThreshold;
      h.input.clearAll();
      h.debugState.godMode = true;
      const lit = () => { detection.smoothed = CONFIG.detection.meterMax; };
      lit();

      // Short of a magazine, so no reload gap lands in the burst timing.
      const seconds = 3.5;
      const shots = [];
      const impacts = [];
      let reloads = 0;
      let lowest = shade.health;
      let step = 0;
      const offs = [
        h.emitter.on('combat:shot', (event) => { if (event.actor === 'warden') shots.push(step * dt); }),
        h.emitter.on('combat:impact', (event) => { if (event.target === 'shade') impacts.push(event.at.y); }),
        h.emitter.on('combat:reload', (event) => { if (event.actor === 'warden') reloads++; }),
      ];
      for (; step < Math.round(seconds / dt); step++) {
        warden.position.copy(held);
        warden.velocity.set(0, 0, 0);
        h.stepFrames(1);
        lit();
        lowest = Math.min(lowest, shade.health);
      }
      for (const off of offs) off();
      h.debugState.godMode = false;
      const stateSeen = wardenAI.state;
      const torso = shade.feetY + shade.height * CONFIG.detection.torsoHeightRatio;
      SETTINGS.difficulty = was;
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });

      if (stateSeen !== AI_STATE.ENGAGE) problems.push(`the Warden was in ${stateSeen}, not engage`);
      if (reloads) problems.push(`${reloads} reload(s) inside ${seconds}s, the timing below is confounded`);
      if (shots.length < A.engageBurstMin * 2) problems.push(`only ${shots.length} rounds in ${seconds}s`);

      // Rounds `secondsPerShot` apart are one burst; a longer gap is the pause.
      const rate = 60 / G.roundsPerMinute;
      const bursts = [];
      const pauses = [];
      let burst = 0;
      for (let i = 0; i < shots.length; i++) {
        const gap = i ? shots[i] - shots[i - 1] : 0;
        if (i && gap > rate + dt * 1.5) {
          bursts.push(burst);
          pauses.push(gap - rate);
          burst = 0;
        } else if (i && gap < rate - dt * 0.5) {
          problems.push(`rounds ${i - 1} and ${i} are ${gap.toFixed(3)}s apart, faster than the gun's ${rate.toFixed(3)}s`);
        }
        burst++;
      }
      // The last burst may be cut by the clock; every finished one is counted.
      for (const n of bursts) {
        if (n < A.engageBurstMin || n > A.engageBurstMax) {
          problems.push(`a burst of ${n} rounds, config says ${A.engageBurstMin}-${A.engageBurstMax}`);
        }
      }
      for (const p of pauses) {
        if (p < A.engageBurstPauseMin - dt || p > A.engageBurstPauseMax + dt * 2) {
          problems.push(`a pause of ${p.toFixed(2)}s between bursts, config says ${A.engageBurstPauseMin}-${A.engageBurstPauseMax}`);
        }
      }
      if (bursts.length < 2) problems.push(`only ${bursts.length} finished burst(s) in ${seconds}s`);

      // Aimed at the torso: the rounds that land do so about the height the
      // eye sees (`torsoHeightRatio`), not at the floor line.
      const meanY = impacts.length ? impacts.reduce((sum, y) => sum + y, 0) / impacts.length : NaN;
      if (impacts.length < shots.length * 0.6) {
        problems.push(`${impacts.length} of ${shots.length} rounds hit at ${RANGES[0]}m on ${names[names.length - 1]}`);
      }
      if (!(Math.abs(meanY - torso) < 0.3)) {
        problems.push(`the rounds land at a mean height of ${meanY.toFixed(2)}m, the torso is at ${torso.toFixed(2)}m`);
      }

      // Section 17.1: god mode, and the rifle in particular, which was the
      // one source of damage it did not cover.
      if (lowest < CONFIG.shade.health) {
        problems.push(`god mode let the rifle take the Shade to ${lowest}`);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${shots.length} rounds in ${seconds}s as bursts of [${bursts.join(' ')}] with pauses of `
            + `[${pauses.map((p) => p.toFixed(2)).join(' ')}]s; ${impacts.length} hit at a mean height of `
            + `${meanY.toFixed(2)}m (torso ${torso.toFixed(2)}m); health stayed ${lowest} under god mode`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-widest-cone-kills-at-range-and-not-once-in-a-while',
    spec: 'Section 11 (difficulty), F17',
    name: 'Every one of twelve pinned engagements on the widest preset at the longer range kills inside the limit, the two that the old cone could not among them',
    run: (h) => {
      const problems = [];
      const was = SETTINGS.difficulty;
      const LANE = lane(h);
      if (!LANE) {
        return { pass: false, detail: `no clear lane of ${RANGES[RANGES.length - 1] + 1}m the lamps light to ${LIT_METER} at ${RANGES.join('m and ')}m on this map` };
      }
      // The widest cone at the longer range: the only pairing where the cone
      // is wider than the body is, and so the only one whose time-to-kill
      // has a tail worth holding.
      const name = Object.keys(A.difficulty)[0];
      const range = RANGES[RANGES.length - 1];

      const kills = [];
      let shots = 0;
      let hits = 0;
      for (const seed of STALL_SEEDS) {
        const run = engage(h, name, seed, range, LANE);
        kills.push(run.kill);
        shots += run.shots;
        hits += run.hits;
        if (run.stalled) problems.push(`seed ${seed}: ${run.stalled}`);
      }
      SETTINGS.difficulty = was;
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });

      // The sibling check averages eight seeds and compares the presets; this
      // one never averages. Twelve engagements, and the assertion is that not
      // one of them is a stall - which is the shape of the thing F17 found,
      // since the mean was 6.3s all along and it was the worst case that had
      // gone past the limit. The hit fraction is reported and not asserted:
      // over twelve engagements it carries about five points of noise, which
      // is most of the distance between the old cone and this one.
      const sorted = kills.slice().sort((a, b) => a - b);
      const landed = shots ? hits / shots : 0;
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${name} at ${range}m from ${LANE.from}, ${STALL_SEEDS.length} pinned seeds: every engagement killed, `
            + `worst ${sorted[sorted.length - 1].toFixed(2)}s of ${KILL_LIMIT}s, median `
            + `${sorted[sorted.length >> 1].toFixed(2)}s; ${hits} of ${shots} rounds landed (${landed.toFixed(3)})`
          : `${problems.join('; ')} - kills [${kills.map((k) => k.toFixed(1)).join(' ')}]s, ${hits}/${shots} landed`,
      };
    },
  });
}
