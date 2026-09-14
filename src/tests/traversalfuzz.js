/**
 * BLACKLINE - tests/traversalfuzz.js
 *
 * AUTO suite: B8, the traversal fuzz. tests/fuzz.js walks a player round the
 * map for a minute and reaches only what a walk reaches. This one starts
 * every episode where the climb rule says a body can stand to climb - the
 * rule's own approaches to every climbable surface, `map._supportApproaches`
 * - faces it, and drives the climbs the way a player does: real key codes,
 * in bursts, holds and taps and mashing, ten thousand steps of it. What it
 * asserts is that the controller never sticks.
 *
 * "Stuck" is defined, not felt: a traversal state that outlives its longest
 * move, a hang with no ledge, a fall that never lands, a body at rest inside
 * geometry, a body below the floor, a number that is not a number. The
 * second check asks the other half: after any episode, with nothing pressed
 * (or crouch, from a hang), the body is back on the ground within seconds.
 * A game that can be driven into a state a player cannot leave has failed
 * both, and a check on a set cannot see a connectivity fault - so this one
 * does not look for progress, it looks for the ways out.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG, rng } from '../config.js';
import { SHADE_STATE } from '../entities/agent.js';
import { classifyReach } from '../physics.js';
import { MOVE_STATES } from './feel.js';

const S = CONFIG.shade;
const DT = CONFIG.time.fixedDt;
const FULL_REACH = S.reach.standing + S.reach.jumpBonus;
/** The longest a committed move can last, plus two steps of slack. */
const MOVE_STEP_LIMIT = Math.ceil(Math.max(S.vaultDuration, S.mantleDuration, S.hangGrabDuration, S.hangPullUpDuration) / DT) + 2;
/** A fall this long is not a fall from anywhere on this map. */
const AIR_STEP_LIMIT = Math.ceil(3.0 / DT);
const RECOVER_STEPS = Math.ceil(3.0 / DT);

/**
 * The behaviours. Each is what a player does at a face: `hold` is the keys
 * down for the whole burst, `taps` are (step, code) presses that are held
 * for one step, `holds` are (step, code) presses that stay down, `turn` is a
 * yaw nudge every so many steps. `mash` ignores all of that and flips a
 * random key every three steps.
 */
const BEHAVIOURS = [
  { name: 'hold-climb', hold: ['KeyW', 'Space'], taps: [[3, 'Space'], [25, 'Space'], [50, 'Space'], [75, 'Space']] },
  { name: 'tap-hang-drop', hold: ['KeyW'], taps: [[3, 'Space'], [40, 'ControlLeft']] },
  { name: 'tap-hang-pull', hold: ['KeyW'], taps: [[3, 'Space'], [45, 'Space'], [80, 'Space']] },
  { name: 'tap-shimmy', hold: ['KeyW'], taps: [[3, 'Space'], [70, 'Space']], holds: [[20, 'KeyA']] },
  { name: 'tap-shimmy-right', hold: ['KeyW'], taps: [[3, 'Space'], [70, 'Space']], holds: [[20, 'KeyD']] },
  { name: 'sprint-jump', hold: ['KeyW', 'ShiftLeft'], taps: [[2, 'Space'], [14, 'Space'], [26, 'Space'], [38, 'Space'], [50, 'Space']] },
  { name: 'jump-back', hold: ['KeyS'], taps: [[2, 'Space'], [20, 'Space'], [40, 'Space']] },
  { name: 'crouch-off', hold: ['KeyW'], taps: [[3, 'Space']], holds: [[6, 'ControlLeft']] },
  { name: 'spin-jump', hold: ['KeyW'], taps: [[4, 'Space'], [14, 'Space'], [24, 'Space'], [34, 'Space'], [44, 'Space']], turn: 10 },
  { name: 'crouch-jump', hold: ['KeyW', 'ControlLeft'], taps: [[3, 'Space'], [30, 'Space']] },
  { name: 'slide-in', hold: ['KeyW', 'ShiftLeft'], taps: [[8, 'ControlLeft'], [20, 'Space']] },
  { name: 'mash', mash: ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ControlLeft', 'ShiftLeft'] },
];

/**
 * Every spot the rule names for a climb the body could make from there.
 * `target` is the box climbed; the approach's own `box` is the support it
 * stands on.
 */
function everyApproach(h) {
  const out = [];
  for (const box of h.map.collision.boxes) {
    if (!box.climbable) continue;
    for (const approach of h.map._supportApproaches(box)) {
      const move = classifyReach(approach.rise, FULL_REACH);
      if (move === null || move === 'step') continue;
      out.push({ target: box, ...approach });
    }
  }
  return out;
}

/**
 * Put the body at an approach, facing the face, standing if it fits there and
 * crouched if only that does (the rule validates a crouched body at the
 * spot). Returns false if it fits neither way.
 */
function standAt(h, approach, yawJitter) {
  const shade = h.shade;
  shade.reset({ position: { x: approach.x, y: approach.y, z: approach.z }, yaw: Math.atan2(approach.nx, approach.nz) + yawJitter });
  if (!h.map.collision.isClear(shade.position, shade.half)) {
    shade._resize(S.crouchHeight);
    shade.crouching = true;
    if (!h.map.collision.isClear(shade.position, shade.half)) return false;
  }
  h.stepFrames(2);
  return true;
}

/** Why the body is stuck this step, or null. */
function stuckReason(h, watch) {
  const shade = h.shade;
  const p = shade.position;
  const v = shade.velocity;
  if (![p.x, p.y, p.z, v.x, v.y, v.z].every(Number.isFinite)) return 'position or velocity is not finite';
  if (shade.feetY < CONFIG.map.groundY - CONFIG.debug.floorTolerance) return `fell to y=${shade.feetY.toFixed(2)}`;

  if (MOVE_STATES.has(shade.state)) {
    watch.moveSteps++;
    if (!shade._move) return `in ${shade.state} with no move`;
    if (watch.moveSteps > MOVE_STEP_LIMIT) return `in ${shade.state} for ${watch.moveSteps} steps`;
  } else {
    watch.moveSteps = 0;
  }
  if (shade.state === SHADE_STATE.HANG && !shade._hangLedge) return 'hanging from nothing';
  watch.airSteps = shade.state === SHADE_STATE.AIR ? watch.airSteps + 1 : 0;
  if (watch.airSteps > AIR_STEP_LIMIT) return `airborne for ${(watch.airSteps * DT).toFixed(1)}s`;
  // At rest on the ground, the capsule is out of everything. A hair of
  // tolerance: the solver rests the body on a face, not inside it.
  if (shade.state === SHADE_STATE.GROUND && shade.grounded && shade.speed < 0.01) {
    const half = { x: S.radius - 0.01, y: shade.height / 2 - 0.01, z: S.radius - 0.01 };
    const inside = h.map.collision.overlap(shade.position, half);
    if (inside) return `at rest inside ${inside.tag || 'a solid'}`;
  }
  return null;
}

/**
 * One burst of a behaviour at an approach. Drives the real input and steps
 * the game; returns the first stuck reason, and what the body did.
 */
function runEpisode(h, approach, behaviour, steps, stats) {
  const shade = h.shade;
  h.input.clearAll();
  if (!standAt(h, approach, (rng.next() - 0.5) * 0.6)) return { skipped: true };
  const startFeet = shade.feetY;
  const watch = { moveSteps: 0, airSteps: 0 };
  let highest = startFeet;
  if (behaviour.hold) {
    for (const code of behaviour.hold) {
      h.input.heldCodes.add(code);
      h.input.pressedCodes.add(code);
    }
  }
  const tapped = [];
  for (let step = 0; step < steps; step++) {
    for (const code of tapped) h.input.heldCodes.delete(code);
    tapped.length = 0;
    if (behaviour.mash) {
      if (step % 3 === 0) {
        const code = behaviour.mash[rng.int(0, behaviour.mash.length - 1)];
        if (h.input.heldCodes.has(code)) h.input.heldCodes.delete(code);
        else { h.input.heldCodes.add(code); h.input.pressedCodes.add(code); }
      }
    } else {
      for (const [at, code] of behaviour.taps || []) {
        if (step === at && !h.input.heldCodes.has(code)) { h.input.heldCodes.add(code); h.input.pressedCodes.add(code); tapped.push(code); }
        else if (step === at) h.input.pressedCodes.add(code);
      }
      for (const [at, code] of behaviour.holds || []) {
        if (step === at) { h.input.heldCodes.add(code); h.input.pressedCodes.add(code); }
      }
      if (behaviour.turn && step % behaviour.turn === 0 && step > 0) shade.yaw += 0.4;
    }
    h.stepFrames(1);
    h.input.clearEdges();
    stats.steps++;
    stats.states.add(shade.state);
    if (MOVE_STATES.has(shade.state)) stats.moves++;
    if (shade.state === SHADE_STATE.HANG) stats.hangs++;
    highest = Math.max(highest, shade.feetY);
    const reason = stuckReason(h, watch);
    if (reason) {
      h.input.clearAll();
      return { stuck: `${behaviour.name} at ${approach.target.tag || 'box'} from (${approach.x.toFixed(1)}, ${approach.y.toFixed(1)}, ${approach.z.toFixed(1)}) step ${step}: ${reason}` };
    }
  }
  h.input.clearAll();
  const climbed = highest >= approach.target.max.y - 0.12;
  if (climbed) stats.climbed++;
  return { climbed };
}

/**
 * With nothing pressed, does the body come to rest on the ground, or hang -
 * and from a hang, does crouch put it on the ground? The way out a player
 * always has.
 */
function recovers(h) {
  const shade = h.shade;
  h.input.clearAll();
  const settled = () => shade.state === SHADE_STATE.GROUND && shade.grounded;
  for (let i = 0; i < RECOVER_STEPS; i++) {
    h.stepFrames(1);
    if (settled()) return null;
    if (shade.state === SHADE_STATE.HANG && i > 20) break;
  }
  if (shade.state === SHADE_STATE.HANG) {
    h.input.heldCodes.add('ControlLeft');
    h.input.pressedCodes.add('ControlLeft');
    for (let i = 0; i < RECOVER_STEPS; i++) {
      h.stepFrames(1);
      h.input.clearEdges();
      if (settled()) { h.input.clearAll(); return null; }
    }
    h.input.clearAll();
    return `crouch from a hang did not reach the ground in 3s (state ${shade.state})`;
  }
  return `did not settle in 3s (state ${shade.state}, grounded ${shade.grounded}, feet ${shade.feetY.toFixed(2)})`;
}

function newStats() {
  return { steps: 0, episodes: 0, skipped: 0, moves: 0, hangs: 0, climbed: 0, states: new Set() };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'traversal-fuzz-ten-thousand-steps-never-sticks',
    spec: 'Section 6.1 / Section 17 (B8)',
    name: 'Ten thousand steps of real key input at the faces the rule names: no move outlives its duration, no hang from nothing, no endless fall, no body at rest in a solid',
    run: (h) => {
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false, seed: 20260914 });
      h.menu.hide();
      h.setPaused(false);
      const approaches = everyApproach(h);
      if (approaches.length < 20) return { pass: false, detail: `only ${approaches.length} approaches by the rule; the map has ~146` };
      const stats = newStats();
      const problems = [];
      const used = new Set();
      const target = 10000;
      while (stats.steps < target) {
        const approach = approaches[rng.int(0, approaches.length - 1)];
        const behaviour = BEHAVIOURS[rng.int(0, BEHAVIOURS.length - 1)];
        const steps = Math.min(rng.int(60, 150), target - stats.steps);
        const result = runEpisode(h, approach, behaviour, steps, stats);
        if (result.skipped) { stats.skipped++; continue; }
        stats.episodes++;
        used.add(behaviour.name);
        if (result.stuck) {
          problems.push(result.stuck);
          if (problems.length >= 3) break;
        }
      }
      if (h.debugTools.assertionFailures !== 0) problems.push(`${h.debugTools.assertionFailures} runtime assertion failures`);
      h.input.clearAll();
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${stats.steps} steps in ${stats.episodes} episodes at ${approaches.length} approaches (${stats.skipped} spots skipped as unfittable), `
            + `${used.size} of ${BEHAVIOURS.length} behaviours: ${stats.moves} steps mid-move, ${stats.hangs} hanging, ${stats.climbed} episodes `
            + `reached the top; no move outlived ${MOVE_STEP_LIMIT} steps, no fall outlived 3s, nothing at rest in a solid; `
            + `states [${[...stats.states].sort().join(' ')}]`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'after-any-traversal-the-body-can-be-put-back-on-the-ground',
    spec: 'Section 6.1 / Section 15 (B8: no stuck state)',
    name: 'After every kind of burst at every kind of face, nothing pressed - or crouch, from a hang - has the body on the ground within seconds',
    run: (h) => {
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false, seed: 19770912 });
      h.menu.hide();
      h.setPaused(false);
      const approaches = everyApproach(h);
      if (approaches.length < 20) return { pass: false, detail: `only ${approaches.length} approaches by the rule; the map has ~146` };
      const stats = newStats();
      const problems = [];
      // Every behaviour at a spread of faces: the approaches shuffled once,
      // each behaviour taken in turn down the list.
      const order = approaches.slice();
      for (let i = order.length - 1; i > 0; i--) {
        const j = rng.int(0, i);
        [order[i], order[j]] = [order[j], order[i]];
      }
      let recovered = 0;
      let fromHang = 0;
      for (let i = 0; i < order.length; i++) {
        const behaviour = BEHAVIOURS[i % BEHAVIOURS.length];
        const result = runEpisode(h, order[i], behaviour, rng.int(40, 100), stats);
        if (result.skipped) { stats.skipped++; continue; }
        stats.episodes++;
        if (result.stuck) { problems.push(result.stuck); if (problems.length >= 3) break; continue; }
        const hanging = h.shade.state === SHADE_STATE.HANG;
        const why = recovers(h);
        if (why) {
          problems.push(`${behaviour.name} at ${order[i].target.tag || 'box'}: ${why}`);
          if (problems.length >= 3) break;
        } else {
          recovered++;
          if (hanging) fromHang++;
        }
      }
      if (h.debugTools.assertionFailures !== 0) problems.push(`${h.debugTools.assertionFailures} runtime assertion failures`);
      h.input.clearAll();
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${stats.episodes} episodes at ${approaches.length} approaches (${stats.skipped} unfittable), ${stats.steps} steps, ${stats.climbed} reached the top; `
            + `after every one the body was on the ground within 3s - ${recovered} recovered, ${fromHang} of them let go of a hang with crouch`
          : problems.join('; '),
      };
    },
  });
}
