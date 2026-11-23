/**
 * BLACKLINE - systems/ragdolllimbs.js
 *
 * The ragdoll's motion (J3, D94 "realistic"): a moderate impulse along the
 * hit's line, a tip-over about the axis across it, and the limbs trailing the
 * tip so they follow rather than fly. Owned and stepped by `effects.js`, which
 * keeps the list, the settle and the reinsert; this file keeps the maths, and
 * exists because that file had 531 of its 600 lines and this took 100.
 *
 * Not a solver. Every number is a damped decay, so a body always reaches the
 * floor in `CONFIG.effects.ragdollSettleFloor` and `effects.js` stops stepping
 * it there. The one random draw (the twist about the spine) is on `lookRng`
 * (H27): presentation never draws from the simulation's stream.
 *
 * **Which groups a limb may be.** The head, the arms and the legs. Not the
 * torso or the Warden's chest: `breathcensus.js` holds both still, and the
 * tumble is of the whole mesh, so there is nothing for them to add. Nothing
 * here writes the breath's lift, which is a position and not a rotation.
 *
 * Layering (Section 3.1): imports config only.
 */

import { CONFIG, lookRng } from '../config.js';

const E = CONFIG.effects;

// How much of the torso's tip each limb takes (x), and how far it splays
// sideways with it (z, signed by side).
const LIMB_WEIGHTS = {
  head: [0.5, 0.2],
  armL: [1, 0.8],
  armR: [1, -0.8],
  legL: [0.6, 0.3],
  legR: [0.6, -0.3],
};

/**
 * A new ragdoll record for `mesh`. `direction` is normalised here and not
 * trusted: the callers pass unit vectors today, and a launch that scaled with
 * a caller's arithmetic would be the next thing to fly. A zero direction falls
 * to a seeded one.
 */
export function startRagdoll(mesh, direction) {
  let dx = direction.x || 0;
  let dz = direction.z || 0;
  const length = Math.hypot(dx, dz);
  if (length > 1e-9) {
    dx /= length;
    dz /= length;
  } else {
    const heading = lookRng.next() * Math.PI * 2;
    dx = Math.cos(heading);
    dz = Math.sin(heading);
  }
  const parts = mesh.userData && mesh.userData.parts;
  const limbs = [];
  for (const name of Object.keys(LIMB_WEIGHTS)) {
    const group = parts && parts[name];
    if (!group) continue;
    limbs.push({
      group, weights: LIMB_WEIGHTS[name], ax: 0, az: 0,
      restX: group.rotation.x, restZ: group.rotation.z,
    });
  }
  const twist = lookRng.unit() * E.ragdollTwist;
  return {
    mesh,
    life: E.ragdollDuration,
    vx: dx * E.ragdollImpulse,
    vy: E.ragdollLift,
    vz: dz * E.ragdollImpulse,
    // Tipping toward (dx, dz) is a turn about (dz, 0, -dx).
    tiltX: dz * E.ragdollTumble,
    tiltZ: -dx * E.ragdollTumble,
    twist,
    // A body rolls a little as it goes over; along the hit's line, so it is the
    // same fall seen from the side and not a second tumble.
    rollX: dx * E.ragdollRoll * Math.sign(twist || 1),
    rollZ: dz * E.ragdollRoll * Math.sign(twist || 1),
    limbs,
  };
}

/** Put a record's limbs back exactly where they were when the hit landed. */
export function restLimbs(limbs) {
  for (const limb of limbs) {
    limb.group.rotation.x = limb.restX;
    limb.group.rotation.z = limb.restZ;
  }
}

/**
 * One step of one ragdoll. Returns the largest change it made this step,
 * metres or radians, which is what decides whether the body is at rest.
 */
export function stepRagdoll(doll, dt) {
  const mesh = doll.mesh;
  const lag = E.ragdollLimbLag;
  const cap = (E.ragdollLimbMaxDegrees * Math.PI) / 180;
  let moved = 0;

  doll.vy += E.ragdollGravity * dt;
  doll.vx *= E.ragdollLinearDamping;
  doll.vz *= E.ragdollLinearDamping;
  const y = Math.max(0, mesh.position.y + doll.vy * dt);
  // On the floor the fall is over: a body that kept accumulating gravity
  // there would be launched by it the moment the floor moved.
  if (y === 0) doll.vy = 0;
  moved = Math.max(moved, Math.abs(doll.vx * dt), Math.abs(doll.vz * dt), Math.abs(y - mesh.position.y));
  mesh.position.x += doll.vx * dt;
  mesh.position.y = y;
  mesh.position.z += doll.vz * dt;

  doll.tiltX *= E.ragdollAngularDamping;
  doll.tiltZ *= E.ragdollAngularDamping;
  doll.twist *= E.ragdollAngularDamping;
  doll.rollX *= E.ragdollAngularDamping;
  doll.rollZ *= E.ragdollAngularDamping;
  mesh.rotation.x += (doll.tiltX + doll.rollX) * dt;
  mesh.rotation.z += (doll.tiltZ + doll.rollZ) * dt;
  mesh.rotation.y += doll.twist * dt;
  moved = Math.max(moved, Math.abs((doll.tiltX + doll.rollX) * dt), Math.abs((doll.tiltZ + doll.rollZ) * dt), Math.abs(doll.twist * dt));

  // A limb leans against the tip, closing a fraction of the gap to that lean
  // each step: it trails the torso, peaks after it and is gone when it stops.
  // The lean follows how fast the body is tipping, not which way, so a hit
  // from the side flails the limbs as much as one from the front.
  const tip = Math.hypot(doll.tiltX, doll.tiltZ);
  for (const limb of doll.limbs) {
    const [wx, wz] = limb.weights;
    const targetX = -E.ragdollLimbGain * wx * tip;
    const targetZ = -E.ragdollLimbGain * wz * tip;
    const ax = Math.max(-cap, Math.min(cap, (limb.ax + (targetX - limb.ax) * lag) * E.ragdollLimbDamping));
    const az = Math.max(-cap, Math.min(cap, (limb.az + (targetZ - limb.az) * lag) * E.ragdollLimbDamping));
    moved = Math.max(moved, Math.abs(ax - limb.ax), Math.abs(az - limb.az));
    limb.ax = ax;
    limb.az = az;
    limb.group.rotation.x = limb.restX + ax;
    limb.group.rotation.z = limb.restZ + az;
  }
  return moved;
}
