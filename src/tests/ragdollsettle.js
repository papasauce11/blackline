/**
 * BLACKLINE - tests/ragdollsettle.js
 *
 * AUTO suite (J3, D94 "realistic"): a body that is hit falls the way it was
 * hit, its limbs follow rather than fly, it is at rest inside a second, and
 * once it is at rest it does not move at all.
 *
 * The queue's done-when is two numbers - "a check measures settle time and
 * zero post-settle motion" - and this holds both, but the second is held
 * **exactly**: a settled record is no longer stepped, so the per-step change
 * in the mesh and in every limb is 0 and not "under a floor". A floor there
 * would pass the jitter the entry is about (a 1e-4 rotation written every
 * frame for ever) and fail nothing. `presentation.js`'s
 * `ragdoll-is-lite-and-freezes` owns the older half - the position freezes -
 * and this is the half it could not say, because it never read a limb.
 *
 * Driven the way the neighbours drive the ragdoll (`effects.ragdoll()` and the
 * fixed step), on both bodies, in three directions so a hard-coded axis
 * cannot pass. The bounds are what was measured, on both bodies and both
 * maps' harness: 0.42m of travel and 54 degrees of tip from a unit hit, the
 * arms peaking 6 steps after the tip's fastest step at 27 degrees, and the
 * body at rest on step 54 (0.9s).
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';

const E = CONFIG.effects;
const LIMBS = ['head', 'armL', 'armR', 'legL', 'legR'];

/** Degrees, the bound on how far off the hit's line the first 0.2s may point. */
const LINE_TOLERANCE = 5;
/** Metres of horizontal travel: a fall, and not a launch. Measured 0.42 from a unit hit. */
const TRAVEL = { min: 0.25, max: 0.7 };
/** A limb moved at all (degrees), and the settle's budget (seconds). */
const LIMB_MOVED = 3;
const SETTLE_BUDGET = 1.0;
/** Per-step change (m or rad) under which a body counts as having stopped. */
const STOPPED = 0.001;
const DIRECTIONS = [
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: -0.6, z: 0.8 },
];

/** Every number a ragdoll writes, as one flat array. */
function snapshot(mesh) {
  const out = [mesh.position.x, mesh.position.y, mesh.position.z, mesh.rotation.x, mesh.rotation.y, mesh.rotation.z];
  for (const name of LIMBS) {
    const group = mesh.userData.parts[name];
    out.push(group.rotation.x, group.rotation.z);
  }
  return out;
}

function restore(mesh, saved) {
  mesh.position.set(saved[0], saved[1], saved[2]);
  mesh.rotation.set(saved[3], saved[4], saved[5]);
  LIMBS.forEach((name, i) => {
    const group = mesh.userData.parts[name];
    group.rotation.x = saved[6 + i * 2];
    group.rotation.z = saved[7 + i * 2];
  });
}

/** The largest absolute difference between two snapshots, over the slice [from, to). */
function change(a, b, from = 0, to = a.length) {
  let worst = 0;
  for (let i = from; i < to; i++) worst = Math.max(worst, Math.abs(a[i] - b[i]));
  return worst;
}

/** Drop a ragdoll on `mesh` along `direction` and record every step of `steps`. */
function fall(effects, mesh, direction, steps) {
  const dt = CONFIG.time.fixedDt;
  const trace = [snapshot(mesh)];
  // 9x the unit vector: the impulse follows the direction and not its length.
  effects.ragdoll(mesh, { x: direction.x * 9, z: direction.z * 9 });
  for (let i = 0; i < steps; i++) {
    effects.step(dt);
    trace.push(snapshot(mesh));
  }
  return trace;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-ragdoll-follows-the-hit-settles-under-a-second-and-then-does-not-move',
    spec: 'Section 15 (ragdoll goes unstable) / D94',
    name: 'A ragdoll falls along the hit, the limbs trail it, it is at rest inside a second and then writes nothing',
    run: (h) => {
      const effects = h.effects;
      const dt = CONFIG.time.fixedDt;
      const problems = [];
      const notes = [];
      const bodies = [['Shade', h.shade.mesh], ['Warden', h.warden.mesh]];
      const saved = bodies.map(([, mesh]) => snapshot(mesh));
      try {
        effects.reset();
        if (E.ragdollSettleSeconds >= SETTLE_BUDGET) problems.push(`ragdollSettleSeconds is ${E.ragdollSettleSeconds}, the budget is under ${SETTLE_BUDGET}s`);

        for (const [who, mesh] of bodies) {
          for (const dir of DIRECTIONS) {
            const tag = `${who} hit along (${dir.x}, ${dir.z})`;
            restore(mesh, saved[bodies.findIndex((b) => b[1] === mesh)]);
            mesh.position.y = 0.3;
            const start = snapshot(mesh);
            const trace = fall(effects, mesh, dir, 130);
            const final = trace[trace.length - 1];

            // (a) Along the hit's line over the first 0.2s.
            const early = trace[Math.round(0.2 / dt)];
            const ex = early[0] - start[0];
            const ez = early[2] - start[2];
            const off = Math.abs(((Math.atan2(ez, ex) - Math.atan2(dir.z, dir.x)) * 180) / Math.PI);
            const offWrapped = Math.min(off, 360 - off);
            if (Math.hypot(ex, ez) < 0.05) problems.push(`${tag}: moved ${Math.hypot(ex, ez).toFixed(3)}m in 0.2s, it is not falling`);
            else if (offWrapped > LINE_TOLERANCE) problems.push(`${tag}: the first 0.2s pointed ${offWrapped.toFixed(1)} degrees off the hit's line, bound ${LINE_TOLERANCE}`);

            // (b) Moderate.
            const travel = Math.hypot(final[0] - start[0], final[2] - start[2]);
            if (travel < TRAVEL.min || travel > TRAVEL.max) problems.push(`${tag}: travelled ${travel.toFixed(3)}m, a fall is ${TRAVEL.min}-${TRAVEL.max}m`);

            // (c) The limbs follow: they move, they do not windmill, and they peak after the torso.
            let tipPeak = 0;
            let tipStep = 0;
            for (let i = 1; i < trace.length; i++) {
              const rate = Math.hypot(trace[i][3] - trace[i - 1][3], trace[i][5] - trace[i - 1][5]);
              if (rate > tipPeak) { tipPeak = rate; tipStep = i; }
            }
            const capDeg = E.ragdollLimbMaxDegrees;
            LIMBS.forEach((name, k) => {
              let peak = 0;
              let peakStep = 0;
              for (let i = 0; i < trace.length; i++) {
                const reach = Math.hypot(trace[i][6 + k * 2] - start[6 + k * 2], trace[i][7 + k * 2] - start[7 + k * 2]);
                if (reach > peak) { peak = reach; peakStep = i; }
              }
              const deg = (peak * 180) / Math.PI;
              if (deg < LIMB_MOVED) problems.push(`${tag}: the ${name} peaked at ${deg.toFixed(1)} degrees, it did not follow`);
              // The cap is on each axis, so the two together may reach the cap's hypotenuse.
              if (deg > capDeg * Math.SQRT2 + 0.01) problems.push(`${tag}: the ${name} reached ${deg.toFixed(1)} degrees, the cap is ${capDeg}`);
              if (peakStep < tipStep + 1) problems.push(`${tag}: the ${name} peaked on step ${peakStep}, not after the torso's fastest tip on step ${tipStep}`);
              if (who === 'Shade' && dir.x === 1 && name === 'armL') notes.push(`armL ${deg.toFixed(1)} degrees on step ${peakStep}, torso fastest on step ${tipStep}`);
            });

            // (d) Settled: the first step from which every per-step change is under the floor, and stays so.
            let settleStep = -1;
            for (let i = trace.length - 1; i >= 1; i--) {
              if (change(trace[i], trace[i - 1]) >= STOPPED) break;
              settleStep = i;
            }
            const seconds = settleStep < 0 ? Infinity : settleStep * dt;
            if (!(seconds < SETTLE_BUDGET)) problems.push(`${tag}: not at rest by ${SETTLE_BUDGET}s (settled on step ${settleStep})`);
            if (who === 'Shade' && dir.x === 1) notes.push(`at rest after ${seconds.toFixed(2)}s`);

            // (e) Nothing at all afterwards: the per-step change is exactly 0, and the record is gone.
            let worst = 0;
            for (let i = Math.max(settleStep, 1); i < trace.length; i++) worst = Math.max(worst, change(trace[i], trace[i - 1]));
            const after = trace.length - 1 - settleStep;
            if (settleStep < 0 || after < 60) problems.push(`${tag}: only ${after} steps recorded after the settle, the clause needs 60`);
            if (worst !== 0) problems.push(`${tag}: a settled body still moved ${worst.toExponential(2)} in one step - the jitter; a settled record must not be stepped`);
            if (effects.ragdolls.length !== 0) problems.push(`${tag}: ${effects.ragdolls.length} ragdoll records are still stepping after they settled`);

            // (f) A reinsert clears it: level, and every limb exactly at rest.
            effects.clearRagdoll(mesh);
            if (mesh.rotation.x !== 0 || mesh.rotation.y !== 0 || mesh.rotation.z !== 0) problems.push(`${tag}: clearRagdoll left the mesh at (${mesh.rotation.x}, ${mesh.rotation.y}, ${mesh.rotation.z})`);
            const cleared = snapshot(mesh);
            if (change(cleared, start, 6) !== 0) problems.push(`${tag}: clearRagdoll left a limb ${change(cleared, start, 6).toExponential(2)} off its rest`);
          }

          // (f) again, mid-tumble, and an unrelated body is left alone.
          const other = bodies.find((b) => b[1] !== mesh)[1];
          other.rotation.set(0.3, 0, 0.2);
          const startMid = snapshot(mesh);
          const otherBefore = snapshot(other);
          effects.ragdoll(mesh, { x: 1, z: 0 });
          for (let i = 0; i < 12; i++) effects.step(dt);
          if (change(snapshot(mesh), startMid, 6) === 0) problems.push(`${who}: nothing in the limbs had moved by step 12, so the mid-tumble clear below proves nothing`);
          if (!effects.clearRagdoll(mesh)) problems.push(`${who}: clearRagdoll found no ragdoll mid-tumble`);
          if (mesh.rotation.x !== 0 || mesh.rotation.z !== 0 || change(snapshot(mesh), startMid, 6) !== 0) problems.push(`${who}: a mid-tumble clear left the body tilted or a limb off its rest`);
          if (change(snapshot(other), otherBefore) !== 0) problems.push(`${who}: clearing one body moved the other`);
          effects.step(dt);
          if (effects.ragdolls.length !== 0) problems.push(`${who}: a cleared ragdoll was still stepping`);
          other.rotation.set(0, 0, 0);
        }
      } finally {
        effects.reset();
        bodies.forEach(([, mesh], i) => restore(mesh, saved[i]));
      }
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `both bodies, three hit lines each: along the line within ${LINE_TOLERANCE} degrees, ${TRAVEL.min}-${TRAVEL.max}m of travel, limbs trailing under the ${E.ragdollLimbMaxDegrees} degree cap (${notes.join('; ')}), then 60 steps of exactly nothing and a clean clear`
          : problems.slice(0, 6).join('; ') + (problems.length > 6 ? `; and ${problems.length - 6} more` : ''),
      };
    },
  });
}
