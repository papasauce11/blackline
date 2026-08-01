/**
 * BLACKLINE — entities/enforcer.js
 *
 * The Warden controller (Section 6.2). First person, heavy, no crouch.
 * Layering (Section 3.1): may import from physics and config.
 *
 * One controller, two drivers. Section 6.2 calls the Warden
 * "AI-controlled, and human-controlled in free-roam only", and Section 12
 * insists free-roam is "a configuration, never a duplicated code path". So this
 * class never reads input and never runs AI: it consumes the same `intent`
 * object either one produces. The AI in Phase 6 and the free-roam human in
 * Phase 12 drive exactly the same `step()`.
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { applyGravity } from '../physics.js';

const W = CONFIG.warden;
const P = CONFIG.palette;

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
    this._animTime = 0;
    this._firstPerson = false;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Place at a spawn and clear every scrap of transient state. */
  reset(spawn) {
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
    this.mesh.visible = !enabled && this.state !== WARDEN_STATE.DEAD;
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
   * The FOV this Warden wants right now, blended between the default and the
   * narrower ADS value (Section 6.2). The composition root applies it to the
   * one camera; nothing here touches a camera.
   */
  desiredFov() {
    return CONFIG.render.fov + (W.camera.adsFov - CONFIG.render.fov) * this.adsBlend;
  }

  updateVisual(wallDt) {
    const smoothing = wallDt > 0 ? 1 - Math.pow(0.0001, wallDt) : 1;
    this._smoothPosition.lerp(this.position, smoothing);

    const feet = this._smoothPosition.y - this.half.y;
    this.mesh.position.set(this._smoothPosition.x, feet, this._smoothPosition.z);
    this.mesh.rotation.y = this.yaw;

    this._animate(wallDt);
    this._updateGroundBlob(feet);

    // First person: the rig sits at the eyes and carries the full aim.
    this.cameraRig.position.set(
      this._smoothPosition.x,
      feet + W.standHeight * W.eyeHeightRatio,
      this._smoothPosition.z
    );
    this.cameraRig.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  _animate(wallDt) {
    const parts = this.mesh.userData.parts;
    const speed = this.speed;
    const moving = speed > 0.2 && this.state === WARDEN_STATE.GROUND;
    this._animTime += wallDt * (moving ? 2.0 + speed * 0.5 : 0.9);

    if (this.state === WARDEN_STATE.STUNNED) {
      // Rigid, arms locked down. Reads clearly as "not currently a threat".
      parts.armL.rotation.x = 0.1;
      parts.armR.rotation.x = 0.1;
      parts.legL.rotation.x = 0;
      parts.legR.rotation.x = 0;
      return;
    }

    // Short legs, heavy gait: less swing than the Shade, more body roll.
    const swing = moving ? Math.sin(this._animTime) * Math.min(0.55, 0.14 + speed * 0.08) : 0;
    parts.legL.rotation.x = swing;
    parts.legR.rotation.x = -swing;
    // Arms stay forward holding the weapon rather than swinging freely.
    parts.armL.rotation.x = -1.15 + swing * 0.12;
    parts.armR.rotation.x = -1.15 - swing * 0.12;
    parts.chest.rotation.z = moving ? Math.sin(this._animTime) * 0.05 : 0;
    parts.head.rotation.x = this.pitch * 0.3;
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

// ---------------------------------------------------------------------------
// Mesh construction
//
// Section 4: bulky. Wide box chest, short legs, helmet dominates the head,
// heavy pauldrons. Orange and gunmetal. No faces, no rig.
// ---------------------------------------------------------------------------

function outlined(geometry, material, group) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  group.add(mesh);
  // Child of the mesh, not a sibling. A limb segment is repositioned by its
  // caller after this returns, and a sibling outline would stay behind at the
  // pivot. Same fault the Shade had.
  const outline = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: P.outline, side: THREE.BackSide, fog: true })
  );
  outline.scale.setScalar(CONFIG.render.outlineScale);
  mesh.add(outline);
  return mesh;
}

function buildWardenMesh(gradientMap) {
  const root = new THREE.Group();
  root.name = 'warden';

  const orange = new THREE.MeshToonMaterial({ color: P.wardenOrange, gradientMap });
  const gunmetal = new THREE.MeshToonMaterial({ color: P.wardenGunmetal, gradientMap });

  const H = W.standHeight;

  // Wide box chest, sat low because the legs are short.
  const chest = new THREE.Group();
  chest.position.y = H * 0.66;
  outlined(new THREE.BoxGeometry(0.78, H * 0.34, 0.5), orange, chest);
  root.add(chest);

  // Helmet dominates the head.
  const head = new THREE.Group();
  head.position.y = H * 0.24;
  outlined(new THREE.BoxGeometry(0.38, 0.34, 0.4), gunmetal, head);
  chest.add(head);

  // Heavy pauldrons.
  for (const side of [-1, 1]) {
    const pauldron = new THREE.Group();
    pauldron.position.set(side * 0.45, H * 0.12, 0);
    outlined(new THREE.BoxGeometry(0.28, 0.24, 0.44), gunmetal, pauldron);
    chest.add(pauldron);
  }

  const makeLimb = (parent, x, y, length, width, material) => {
    const limb = new THREE.Group();
    limb.position.set(x, y, 0);
    const segment = outlined(new THREE.BoxGeometry(width, length, width), material, limb);
    segment.position.y = -length / 2;
    parent.add(limb);
    return limb;
  };

  const armL = makeLimb(chest, -0.44, H * 0.04, H * 0.3, 0.19, gunmetal);
  const armR = makeLimb(chest, 0.44, H * 0.04, H * 0.3, 0.19, gunmetal);
  // Short legs (Section 4): a third of the body rather than half.
  const legL = makeLimb(root, -0.19, H * 0.36, H * 0.34, 0.24, gunmetal);
  const legR = makeLimb(root, 0.19, H * 0.36, H * 0.34, 0.24, gunmetal);

  root.userData.parts = { chest, head, armL, armR, legL, legR };
  return root;
}

function buildGroundBlob() {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(CONFIG.effects.groundBlobRadius, 16),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: CONFIG.effects.groundBlobOpacity,
      depthWrite: false,
      fog: true,
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.name = 'warden-ground-blob';
  return mesh;
}
