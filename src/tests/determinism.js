/**
 * BLACKLINE - tests/determinism.js
 *
 * AUTO suite: Section 16 check 28.
 *
 * "Confirm the debug overlay shows the match seed, and that restarting with the
 * same seed reproduces identical AI patrol order."
 *
 * `ai-patrol-order-is-seed-reproducible` covers the circuit — the order the
 * nodes are shuffled into. That is the first draw from the stream and the
 * easiest thing to get right. It says nothing about whether the match that
 * follows replays, and a match is where the stream is actually spent: patrol
 * pauses, aim error, burst lengths, spread offsets, grenade decisions, smoke
 * puff positions.
 *
 * So this plays the same slice of a real match twice and compares it step for
 * step. One `Math.random()` reached by gameplay, one draw taken in a different
 * order, one `Date.now()` in a decision, and the two runs come apart — which is
 * exactly the property that makes a reported bug reproducible from its seed.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';

/** Fixed, and deliberately not random: the input must not perturb the stream. */
function scriptedKeys(step) {
  const held = [];
  const phase = Math.floor(step / 90) % 4;
  if (phase === 0) held.push('KeyW');
  if (phase === 1) held.push('KeyW', 'ShiftLeft');
  if (phase === 2) held.push('KeyA');
  if (phase === 3) held.push('KeyW', 'ControlLeft');
  return held;
}

/** Round hard, so float noise below the simulation's resolution is ignored. */
const q = (value) => Math.round(value * 1e4) / 1e4;

/**
 * Play a slice of a match from a seed and return a trace of everything a
 * player could observe.
 */
function playSlice(h, seed, steps) {
  h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true, seed });
  h.menu.hide();
  h.setPaused(false);
  h.input.clearAll();

  const trace = [];
  for (let step = 0; step < steps; step++) {
    h.input.heldCodes.clear();
    for (const code of scriptedKeys(step)) h.input.heldCodes.add(code);
    h.stepFrames(1);

    // Sampled every few steps: the point is that the run is identical, and a
    // divergence anywhere shows up within a handful of steps.
    if (step % 5 !== 0) continue;
    trace.push([
      q(h.shade.position.x), q(h.shade.position.y), q(h.shade.position.z),
      h.shade.state,
      q(h.warden.position.x), q(h.warden.position.z), q(h.warden.yaw),
      h.wardenAI.state,
      q(h.wardenAI.accumulator),
      q(h.detection.smoothed),
      h.detection.noise.activeCount,
      q(h.objective.round.timeRemaining),
      h.combat.shots,
      h.gadgets.effects.count,
    ].join('|'));
  }
  h.input.clearAll();
  return trace;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-match-replays-identically-from-its-seed',
    spec: 'Section 2 / check 28',
    name: 'The same seed reproduces the whole slice; the next seed does not',
    run: (h) => {
      const problems = [];
      const seed = 20250814;
      const steps = Math.round(20 / CONFIG.time.fixedDt);

      const first = playSlice(h, seed, steps);
      const second = playSlice(h, seed, steps);
      const other = playSlice(h, seed + 1, steps);

      if (first.length === 0) return { pass: false, detail: 'the slice recorded nothing' };

      // Identical, and the check reports WHERE it first came apart rather than
      // just that it did — a divergence at sample 0 is a seeding bug, one at
      // sample 300 is something drawing out of order deep in a round.
      let divergedAt = -1;
      for (let i = 0; i < first.length; i++) {
        if (first[i] !== second[i]) {
          divergedAt = i;
          break;
        }
      }
      if (divergedAt !== -1) {
        problems.push(
          `the same seed diverged at sample ${divergedAt} of ${first.length} `
          + `(${(divergedAt * 5 * CONFIG.time.fixedDt).toFixed(2)}s in): `
          + `\n  run A: ${first[divergedAt]}\n  run B: ${second[divergedAt]}`
        );
      }

      // And a different seed has to actually produce a different match, or
      // "reproducible" is just "the same every time".
      let differences = 0;
      for (let i = 0; i < Math.min(first.length, other.length); i++) {
        if (first[i] !== other[i]) differences++;
      }
      if (differences === 0) problems.push('seed+1 produced a byte-identical match');

      // The seed has to be visible, which is the other half of check 28.
      if (h.debugState.seed !== h.match.seed) {
        problems.push(`the overlay shows seed ${h.debugState.seed}, the match is running ${h.match.seed}`);
      }
      if (h.match.seed !== seed + 1) problems.push(`asking for seed ${seed + 1} started ${h.match.seed}`);

      // Replaying by seed alone must also restore the same starting state, not
      // just the same sequence from wherever the previous run left off.
      const replay = playSlice(h, seed, 5);
      if (replay[0] !== first[0]) problems.push('a replay did not start from the same state');

      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${steps} steps of a live match (AI, detection, objective, scripted input) sampled `
            + `${first.length} times: seed ${seed} replayed identically on every sample, `
            + `seed ${seed + 1} differed on ${differences} of them`
          : problems.join('; '),
      };
    },
  });
}
