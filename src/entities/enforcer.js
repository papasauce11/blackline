/**
 * BLACKLINE — entities/enforcer.js
 *
 * The Warden controller (Section 6.2). First person, heavy, no crouch.
 * Layering (Section 3.1): may import from physics and config; the body is
 * built in wardenmesh.js (E2).
 *
 * One controller, two drivers. Section 6.2 calls the Warden
 * "AI-controlled, and human-controlled in free-roam only", and Section 12
 * insists free-roam is "a configuration, never a duplicated code path". So this
 * class never reads input and never runs AI: it consumes the same `intent`
 * object either one produces. The AI in Phase 6 and the free-roam human in
 * Phase 12 drive exactly the same `step()`.
 */

import * as THREE from 'three';
import { CONFIG, SETTINGS } from '../config.js';
import { applyGravity } from '../physics.js';
import { buildWardenMesh, buildGroundBlob, WARDEN_FIGURE } from './wardenmesh.js';
import { blendFactor, createPoseTarget, easePose, headBobLift, positionSmoothing, restPose } from './pose.js';

const W = CONFIG.warden;
/** The carry (E2): where the arms rest, and the rifle with them. */
const REST = WARDEN_FIGURE.arm.rest;
/** The rifle points this far under level at the carry; the aim lifts it out by as much. */
const RIFLE_PITCH = WARDEN_FIGURE.rifle.pitch;

/**
 * The poses (E3), in radians about each group's pivot - x forward for a
 * limb and back for the chest's top, z out to the body's right. The carry
 * is `REST`; these are what the gait, the aim and the stun do about it.
 * `_posture` fills the target and `easePose` (pose.js) carries the six
 * groups there. Every number is a look, never a rule; D42 argues them.
 */
const POSE = {
  /**
   * Short legs, heavy gait (Section 4): less swing than the Shade, a roll of
   * the body, a bob, a lean into a sprint; the arms swing a little about
   * the carry.
   */
  gait: { base: 0.14, perSpeed: 0.08, max: 0.55, arms: 0.12, roll: 0.05, bob: 0.03, lean: 0.12 },
  /**
   * The sights up (Section 6.2's ADS, `adsBlend`): both arms rise by the
   * rifle's own pitch, so the barrel is level, and then by the aim's within
   * `pitchMax` of level, so the rifle points where the Warden looks; the
   * swing leaves the arms; the head takes the whole pitch and drops
   * `cheek` to the sight.
   */
  aim: { pitchMax: 1.0, cheek: -0.15 },
  /** Rigid, the arms locked down and the rifle dropped with the right one, the body sagging: reads as "not currently a threat". */
  stunned: { arms: 0.1, lean: -0.2, head: -0.4 },
  /** How much of the aim's pitch the head takes at the carry. */
  head: 0.3,
};

export const WARDEN_STATE = {
  GROUND: 'ground',
  AIR: 'air',
  STUNNED: 'stunned',
  DEAD: 'dead',
};

/** Blank intent, so a driver can omit fields without the controller reading NaN. */
export function createWardenIntent() {
  return {
    forward: 0,
    strafe: 0,
    sprint: false,
    ads: false,
    fire: false,
    reload: false,
    /** Section 9.2 loadout slot, 0 for none. Free-roam fills it from keys 1-3. */
    gadget: 0,
  };
}

export class Warden {
  /**
   * @param {object} options
   * @param {import('../physics.js').CollisionWorld} options.collision
   * @param {THREE.DataTexture} options.gradientMap
   * @param {object} options.emitter
   */
  constructor({ collision, gradientMap, emitter }) {
    this.collision = collision;
    this.emitter = emitter;

    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.half = { x: W.radius, y: W.standHeight / 2, z: W.radius };

    this.state = WARDEN_STATE.GROUND;
    this.yaw = 0;
    this.pitch = 0;
    this.grounded = false;
    this.health = W.health;
    this.ads = false;

    /** Smoothed 0..1 aim-down-sights blend, drives FOV and speed. */
    this.adsBlend = 0;
    /** Counts down while stunned by a taser or stun grenade (Section 9). */
    this.stunTimer = 0;

    this.strideDistance = 0;

    this.cameraRig = new THREE.Object3D();
    this.cameraRig.name = 'warden-camera-rig';

    this.mesh = buildWardenMesh(gradientMap);
    this.groundBlob = buildGroundBlob();

    this._smoothPosition = new THREE.Vector3();
    /** The gait's phase, advanced by the ground covered (E3). */
    this._animTime = 0;
    /** The pose the state asks for, filled in place every frame (E3, pose.js). */
    this._pose = createPoseTarget();
    this._firstPerson = false;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Place at a spawn and clear every scrap of transient state. */
  reset(spawn) {
    this.ragdolled = false;
    this.mesh.rotation.set(0, 0, 0);
    this.mesh.visible = !this._firstPerson;
    this.position.set(spawn.position.x, spawn.position.y + this.half.y + 0.02, spawn.position.z);
    this.velocity.set(0, 0, 0);
    this.yaw = spawn.yaw || 0;
    this.pitch = 0;
    this.state = WARDEN_STATE.GROUND;
    this.grounded = false;
    this.health = W.health;
    this.ads = false;
    this.adsBlend = 0;
    this.stunTimer = 0;
    this.strideDistance = 0;
    this._smoothPosition.copy(this.position);
    this.mesh.visible = !this._firstPerson;
    this.updateVisual(0);
  }

  get feetY() {
    return this.position.y - this.half.y;
  }

  get eyeY() {
    return this.feetY + W.standHeight * W.eyeHeightRatio;
  }

  get speed() {
    return Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
  }

  get alive() {
    return this.state !== WARDEN_STATE.DEAD;
  }

  /** Movement band the noise model reads (Section 7.2). */
  get movementBand() {
    const speed = this.speed;
    if (speed < 0.15) return 'still';
    return speed > W.walkSpeed + 0.4 ? 'sprint' : 'walk';
  }

  /**
   * Hide the body when the camera is inside the head. Called by the composition
   * root on a camera swap, so the entity never reaches for the camera itself.
   */
  setFirstPerson(enabled) {
    this._firstPerson = enabled;
    // Deliberately not hidden when dead. A corpse that vanishes the instant it
    // dies reads as a bug, and Phase 11's ragdoll needs something to tumble.
    this.mesh.visible = !enabled;
  }

  /** Stun for a duration (taser, stun grenade). No movement, no fire. */
  stun(duration) {
    this.stunTimer = Math.max(this.stunTimer, duration);
    this.state = WARDEN_STATE.STUNNED;
    this.velocity.x = 0;
    this.velocity.z = 0;
  }

  // -------------------------------------------------------------------------
  // Look
  // -------------------------------------------------------------------------

  look(deltaYaw, deltaPitch) {
    if (this.state === WARDEN_STATE.STUNNED || this.state === WARDEN_STATE.DEAD) return;
    this.yaw += deltaYaw;
    this.pitch = Math.max(W.camera.pitchMin, Math.min(W.camera.pitchMax, this.pitch + deltaPitch));
  }

  /** Face a world position directly. Used by the AI (Phase 6). */
  lookAt(target) {
    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    const dy = target.y - this.eyeY;
    this.yaw = Math.atan2(-dx, -dz);
    const flat = Math.sqrt(dx * dx + dz * dz);
    this.pitch = Math.max(W.camera.pitchMin, Math.min(W.camera.pitchMax, Math.atan2(dy, flat)));
  }

  /** Unit forward vector, matching the camera's facing. */
  forwardVector(out) {
    const cosPitch = Math.cos(this.pitch);
    out.x = -Math.sin(this.yaw) * cosPitch;
    out.y = Math.sin(this.pitch);
    out.z = -Math.cos(this.yaw) * cosPitch;
    return out;
  }

  // -------------------------------------------------------------------------
  // Fixed step
  // -------------------------------------------------------------------------

  step(dt, intent) {
    if (this.state === WARDEN_STATE.DEAD) return;

    if (this.state === WARDEN_STATE.STUNNED) {
      this.stunTimer -= dt;
      // Still subject to gravity while stunned, or a stun on a catwalk would
      // leave the Warden hovering.
      applyGravity(this.velocity, dt, W.gravity, W.maxFallSpeed);
      this.velocity.x = 0;
      this.velocity.z = 0;
      this._integrate(dt, this.grounded);
      if (this.stunTimer <= 0) {
        this.stunTimer = 0;
        this.state = this.grounded ? WARDEN_STATE.GROUND : WARDEN_STATE.AIR;
      }
      return;
    }

    // Section 6.2: ADS is 1.8 m/s with a narrower FOV. Crouch is not available.
    this.ads = intent.ads === true;
    const adsTarget = this.ads ? 1 : 0;
    const blendRate = dt / Math.max(0.0001, W.camera.fovSmoothing);
    this.adsBlend += (adsTarget - this.adsBlend) * Math.min(1, blendRate);

    const wish = this._wishDirection(intent);
    const sprinting = intent.sprint && !this.ads && wish.magnitude > 0;
    const targetSpeed = this.ads ? W.adsSpeed : sprinting ? W.sprintSpeed : W.walkSpeed;

    const grounded = this.grounded;
    this._accelerate(wish, targetSpeed, grounded ? W.groundAccel : W.airAccel, dt);
    if (grounded) this._applyFriction(W.groundFriction, dt, wish.magnitude > 0);

    applyGravity(this.velocity, dt, W.gravity, W.maxFallSpeed);

    const before = this.speed;
    const result = this._integrate(dt, grounded);
    this.strideDistance += before * dt;

    this.state = result.grounded ? WARDEN_STATE.GROUND : WARDEN_STATE.AIR;
    if (result.grounded && this.velocity.y < 0) this.velocity.y = 0;
  }

  _wishDirection(intent) {
    const forward = intent.forward || 0;
    const strafe = intent.strafe || 0;
    const magnitude = Math.min(1, Math.sqrt(forward * forward + strafe * strafe));
    if (magnitude < 0.0001) return { x: 0, z: 0, magnitude: 0 };

    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);
    let x = -sinYaw * forward + cosYaw * strafe;
    let z = -cosYaw * forward - sinYaw * strafe;
    const length = Math.sqrt(x * x + z * z);
    if (length > 0.0001) {
      x /= length;
      z /= length;
    }
    return { x, z, magnitude };
  }

  _accelerate(wish, targetSpeed, accel, dt) {
    if (wish.magnitude <= 0) return;
    const desiredX = wish.x * targetSpeed * wish.magnitude;
    const desiredZ = wish.z * targetSpeed * wish.magnitude;
    const step = accel * dt;
    const dx = desiredX - this.velocity.x;
    const dz = desiredZ - this.velocity.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance <= step || distance < 0.0001) {
      this.velocity.x = desiredX;
      this.velocity.z = desiredZ;
    } else {
      this.velocity.x += (dx / distance) * step;
      this.velocity.z += (dz / distance) * step;
    }
  }

  _applyFriction(friction, dt, moving) {
    if (moving) return;
    const decay = Math.max(0, 1 - friction * dt);
    this.velocity.x *= decay;
    this.velocity.z *= decay;
    if (Math.abs(this.velocity.x) < 0.01) this.velocity.x = 0;
    if (Math.abs(this.velocity.z) < 0.01) this.velocity.z = 0;
  }

  _integrate(dt, wasGrounded) {
    const result = this.collision.moveAndSlide(this.position, this.half, this.velocity, dt, {
      groundNormalY: W.groundNormalY,
      stepHeight: W.stepHeight,
      wasGrounded,
    });
    this.grounded = result.grounded;
    return result;
  }

  // -------------------------------------------------------------------------
  // Visual
  // -------------------------------------------------------------------------

  /**
   * The FOV this Warden wants right now, blended between the player's own
   * (`SETTINGS.fovWarden`, H9 - it was `CONFIG.render.fov`, which is what
   * that setting defaults to) and the narrower ADS value (Section 6.2). The
   * composition root applies it to the one camera; nothing here touches a
   * camera. A player on 90 degrees therefore aims down to the same 52 as a
   * player on 60, from further away: the sight picture is the sight picture.
   */
  desiredFov() {
    const hip = SETTINGS.fovWarden;
    return hip + (W.camera.adsFov - hip) * this.adsBlend;
  }

  updateVisual(wallDt) {
    // While a ragdoll owns the mesh, do not write position or rotation: the
    // controller and the ragdoll would fight over the same transform every
    // frame and the controller, running later, would always win.
    if (this.ragdolled) {
      this._updateGroundBlob(this.mesh.position.y);
      return;
    }
    // The Shade's law, not a copy of it: this line carried its own
    // `1 - Math.pow(0.0001, wallDt)` until H43, which is the shape pose.js's
    // header warns about for the head bob.
    const smoothing = positionSmoothing(wallDt);
    this._smoothPosition.lerp(this.position, smoothing);

    const feet = this._smoothPosition.y - this.half.y;
    this.mesh.position.set(this._smoothPosition.x, feet, this._smoothPosition.z);
    this.mesh.rotation.y = this.yaw;

    this._animate(wallDt);
    this._updateGroundBlob(feet);

    // First person: the rig sits at the eyes and carries the full aim, plus
    // the stride's bob if the player asked for it (H9). `_animate` above has
    // advanced `_animTime` this frame, so the eye rises with the foot.
    const bob = headBobLift(
      this._animTime, this.speed, W.sprintSpeed, W.camera.bob,
      this.state === WARDEN_STATE.GROUND && this.speed > 0.2
    );
    this.cameraRig.position.set(
      this._smoothPosition.x,
      feet + W.standHeight * W.eyeHeightRatio + bob,
      this._smoothPosition.z
    );
    this.cameraRig.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  _animate(wallDt) {
    // Section 4: animate by rotating and translating primitive limb groups.
    // The state's pose into the one target record (E3), then every group
    // eased toward it.
    const parts = this.mesh.userData.parts;
    this._posture(this._pose, wallDt);
    easePose(parts.chest, parts, this._pose, blendFactor(wallDt));
  }

  /**
   * The pose the state asks for this frame, into `pose` (E3): the gait by
   * the ground covered, the carry with the aim raising the rifle out of it,
   * or the stun. Nothing here allocates: the record is filled in place.
   */
  _posture(pose, wallDt) {
    const speed = this.speed;
    const moving = speed > 0.2 && this.state === WARDEN_STATE.GROUND;
    // The feet plant by the ground covered, as the Shade's do: half a cycle
    // per stride of the band's footstep.
    if (moving) {
      const stride = this.movementBand === 'sprint' ? W.sprintFootstepStride : W.footstepStride;
      this._animTime += speed * wallDt * (Math.PI / stride);
    }

    restPose(pose);
    if (this.state === WARDEN_STATE.STUNNED) {
      const T = POSE.stunned;
      pose.armLX = T.arms;
      pose.armRX = T.arms;
      pose.torsoX = T.lean;
      pose.headX = T.head;
      return;
    }

    const G = POSE.gait;
    const gait = moving ? Math.sin(this._animTime) * Math.min(G.max, G.base + speed * G.perSpeed) : 0;
    const pace = moving ? Math.max(0, Math.min(1, (speed - W.walkSpeed) / (W.sprintSpeed - W.walkSpeed))) : 0;
    pose.legLX = gait;
    pose.legRX = -gait;
    pose.torsoZ = moving ? Math.sin(this._animTime) * G.roll : 0;
    pose.torsoX = -G.lean * pace;
    pose.lift = moving ? Math.abs(Math.sin(this._animTime)) * G.bob * (speed / W.sprintSpeed) : 0;

    // The arms at the carry holding the rifle rather than swinging freely:
    // positive x is forward on this rig (the old -1.15 held them behind the
    // back), and z pulls them in to the centreline where the rifle is. The
    // sights lift both out of it, by the rifle's own pitch and then the aim's.
    const aim = this.adsBlend;
    const A = POSE.aim;
    const raise = aim * (Math.max(-A.pitchMax, Math.min(A.pitchMax, this.pitch)) - RIFLE_PITCH);
    pose.armLX = REST.left.x + gait * G.arms * (1 - aim) + raise;
    pose.armLZ = REST.left.z;
    pose.armRX = REST.right.x - gait * G.arms * (1 - aim) + raise;
    pose.armRZ = REST.right.z;
    pose.headX = this.pitch * (POSE.head + (1 - POSE.head) * aim) + A.cheek * aim;
  }

  _updateGroundBlob(feet) {
    const below = this.collision.raycast(
      { x: this._smoothPosition.x, y: feet + 0.1, z: this._smoothPosition.z },
      { x: 0, y: -1, z: 0 },
      CONFIG.effects.groundBlobMaxHeight
    );
    if (!below || this._firstPerson) {
      this.groundBlob.visible = false;
      return;
    }
    this.groundBlob.visible = true;
    const gap = Math.max(0, feet - below.y);
    const t = 1 - Math.min(1, gap / CONFIG.effects.groundBlobMaxHeight);
    this.groundBlob.position.set(
      this._smoothPosition.x,
      below.y + CONFIG.effects.footprintLift,
      this._smoothPosition.z
    );
    this.groundBlob.scale.setScalar(0.6 + t * 0.55);
    this.groundBlob.material.opacity = CONFIG.effects.groundBlobOpacity * t;
  }
}
