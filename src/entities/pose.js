/**
 * BLACKLINE - entities/pose.js
 *
 * How a body gets from the pose it is in to the pose its state asks for
 * (E3). Both bodies are six limb groups posed by rotation (Section 4: no
 * skeleton), and every state used to write its angles straight into them,
 * so a vault began and ended on a snap. Now the frame fills a TARGET - a
 * flat record of angles, one field per axis a state may set - and
 * `easePose` carries each group toward it over `POSE_BLEND`, the shortest
 * way round, so a change of state reads as the body moving into the pose
 * rather than being replaced by it. A timed move (a vault, a mantle, a
 * pull-up) keys its target on the move's own progress and the ease follows
 * it; a pull-up's target walks the arms the long way round, over the front,
 * and the ease, always taking the short way to a target that is never far,
 * walks with it.
 *
 * Nothing here allocates after construction: the target is one record per
 * body, filled in place every frame (E3's done-when), and the ease is
 * arithmetic on the groups' own Euler fields.
 *
 * Layering (Section 3.1): imports nothing. agentvisual.js and enforcer.js
 * fill the target; agentmesh.js and wardenmesh.js build the groups it is
 * applied to, each with `userData.baseY` on the body group.
 */

const TAU = 2 * Math.PI;

/**
 * Seconds for a pose to be 99.9% of the way to its target: a state change
 * is nine-tenths there in about a third of it, which on a 0.28s vault is
 * the reach in the first frames and the push in the last.
 */
export const POSE_BLEND = 0.2;

/**
 * The record a frame fills: rotations in radians, `lift` in metres.
 *
 *   torsoX / torsoZ  the body group's lean (negative x is forward: the
 *                    group's top goes -z) and roll
 *   lift             the body group above its built height (the bob)
 *   headX            the head's pitch, positive up
 *   arm*X / leg*X    the limb forward (positive is ahead of the body)
 *   arm*Z / leg*Z    the limb out to the body's right (so the left limb's
 *                    "out" is negative)
 */
export function createPoseTarget() {
  return {
    torsoX: 0, torsoZ: 0, lift: 0, headX: 0,
    armLX: 0, armLZ: 0, armRX: 0, armRZ: 0,
    legLX: 0, legLZ: 0, legRX: 0, legRZ: 0,
  };
}

/** The standing rest, for a state to write over. */
export function restPose(target) {
  target.torsoX = 0; target.torsoZ = 0; target.lift = 0; target.headX = 0;
  target.armLX = 0; target.armLZ = 0; target.armRX = 0; target.armRZ = 0;
  target.legLX = 0; target.legLZ = 0; target.legRX = 0; target.legRZ = 0;
  return target;
}

/**
 * How much of the way to the target a group goes this frame: all of it
 * when there is no time (a reset draws the pose it is given).
 */
export function blendFactor(wallDt) {
  return wallDt > 0 ? 1 - Math.pow(0.001, wallDt / POSE_BLEND) : 1;
}

/** `angle` carried `k` of the shortest way round toward `target`, kept in (-pi, pi]. */
export function easeAngle(angle, target, k) {
  let d = target - angle;
  d -= Math.round(d / TAU) * TAU;
  let a = angle + d * k;
  a -= Math.round(a / TAU) * TAU;
  return a;
}

/**
 * Every group `k` of the way to `target`. `body` is the group the head and
 * arms hang from (the Shade's torso, the Warden's chest) and carries the
 * lean, the roll and the lift; `parts` names the rest as both meshes do.
 */
export function easePose(body, parts, target, k) {
  body.rotation.x = easeAngle(body.rotation.x, target.torsoX, k);
  body.rotation.z = easeAngle(body.rotation.z, target.torsoZ, k);
  body.position.y += (body.userData.baseY + target.lift - body.position.y) * k;
  parts.head.rotation.x = easeAngle(parts.head.rotation.x, target.headX, k);
  parts.armL.rotation.x = easeAngle(parts.armL.rotation.x, target.armLX, k);
  parts.armL.rotation.z = easeAngle(parts.armL.rotation.z, target.armLZ, k);
  parts.armR.rotation.x = easeAngle(parts.armR.rotation.x, target.armRX, k);
  parts.armR.rotation.z = easeAngle(parts.armR.rotation.z, target.armRZ, k);
  parts.legL.rotation.x = easeAngle(parts.legL.rotation.x, target.legLX, k);
  parts.legL.rotation.z = easeAngle(parts.legL.rotation.z, target.legLZ, k);
  parts.legR.rotation.x = easeAngle(parts.legR.rotation.x, target.legRX, k);
  parts.legR.rotation.z = easeAngle(parts.legR.rotation.z, target.legRZ, k);
}
