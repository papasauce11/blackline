/**
 * BLACKLINE — entities/agent.js
 *
 * The Shade controller (Section 6.1). Third person, agile, lightly armed.
 * Layering (Section 3.1): may import from physics and config.
 *
 * The controller is a state machine driven from the fixed step by an `intent`
 * object rather than by reading input directly. That keeps it headlessly
 * testable — the AUTO suite drives it with a seeded intent stream and asserts
 * the invariants from Section 17.
 *
 * Parkour safety rule (Section 6.1, and the second row of the Section 15 risk
 * register): every vault, mantle, slide and pull-up validates that the
 * destination capsule is clear BEFORE committing. `_commitMove()` is the only
 * path into a traversal state and it refuses to start a move it cannot finish.
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { applyGravity, classifyLedge } from '../physics.js';

const S = CONFIG.shade;
const P = CONFIG.palette;

export const SHADE_STATE = {
  GROUND: 'ground',
  AIR: 'air',
  SLIDE: 'slide',
  VAULT: 'vault',
  MANTLE: 'mantle',
  HANG: 'hang',
  PULLUP: 'pullup',
};

/** Heights above the feet at which a ledge probe looks for a climbable face. */
const PROBE_HEIGHTS = [0.25, 0.6, 1.0, 1.45, 1.9, 2.35];

/** Blank intent, so callers can omit fields without the controller reading NaN. */
export function createIntent() {
  return {
    forward: 0,
    strafe: 0,
    yaw: 0,
    jump: false,
    jumpPressed: false,
    crouch: false,
    crouchPressed: false,
    sprint: false,
    /** Knife (Section 8.2). Read by systems/combat.js, not by the controller. */
    melee: false,
  };
}

export class Shade {
  /**
   * @param {object} options
   * @param {import('../physics.js').CollisionWorld} options.collision
   * @param {THREE.DataTexture} options.gradientMap
   * @param {object} options.emitter event emitter from main.js
   */
  constructor({ collision, gradientMap, emitter }) {
    this.collision = collision;
    this.emitter = emitter;

    /** AABB centre. Physics works in centres; `feetY` exposes the sole. */
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.half = { x: S.radius, y: S.standHeight / 2, z: S.radius };
    this.height = S.standHeight;

    this.state = SHADE_STATE.GROUND;
    this.yaw = 0;
    this.pitch = -0.12;
    this.grounded = false;
    this.crouching = false;

    this.health = S.health;
    this.lives = S.lives;

    this._coyote = 0;
    this._jumpBuffer = 0;
    this._slideTimer = 0;
    this._slideCooldown = 0;
    this._fallStartY = 0;
    this._falling = false;
    /** Populated when a traversal move is in flight. */
    this._move = null;
    /** The ledge currently being hung from. */
    this._hangLedge = null;
    this._hangTimer = 0;
    /** Distance travelled on the ground, for footstep cadence in Phase 5. */
    this.strideDistance = 0;
    /** Set on the step a landing happens, for Phase 5 noise. Cleared each step. */
    this.landedFallHeight = 0;

    this.cameraRig = new THREE.Object3D();
    this.cameraRig.name = 'shade-camera-rig';
    this._cameraDistance = S.camera.back;

    this.mesh = buildShadeMesh(gradientMap);
    this.groundBlob = buildGroundBlob();

    this._smoothPosition = new THREE.Vector3();
    this._animTime = 0;
    this._scratchCentre = { x: 0, y: 0, z: 0 };
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Place the Shade at a spawn and clear every scrap of transient state.
   * Reinsert (Section 10.2) calls this, so it must leave nothing behind.
   */
  reset(spawn) {
    this.height = S.standHeight;
    this.half.y = this.height / 2;
    this.position.set(spawn.position.x, spawn.position.y + this.half.y + 0.02, spawn.position.z);
    this.velocity.set(0, 0, 0);
    this.yaw = spawn.yaw || 0;
    this.pitch = -0.12;
    this.state = SHADE_STATE.GROUND;
    this.grounded = false;
    this.crouching = false;
    this.health = S.health;
    this._coyote = 0;
    this._jumpBuffer = 0;
    this._slideTimer = 0;
    this._slideCooldown = 0;
    this._falling = false;
    this._fallStartY = this.position.y;
    this._move = null;
    this._hangLedge = null;
    this._hangTimer = 0;
    this.strideDistance = 0;
    this.landedFallHeight = 0;
    this._smoothPosition.copy(this.position);
    this._cameraDistance = S.camera.back;
    this.updateVisual(0);
  }

  get feetY() {
    return this.position.y - this.half.y;
  }

  get speed() {
    return Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
  }

  /** Movement multiplier band the AI perception model reads (Section 11). */
  get movementBand() {
    if (this.crouching || this.state === SHADE_STATE.SLIDE) return 'crouch';
    const speed = this.speed;
    if (speed < 0.15) return 'still';
    if (speed > S.walkSpeed + 0.5) return 'sprint';
    return 'walk';
  }

  // -------------------------------------------------------------------------
  // Look — applied once per frame, not per step (mouse delta is a displacement)
  // -------------------------------------------------------------------------

  look(deltaYaw, deltaPitch) {
    this.yaw += deltaYaw;
    this.pitch = Math.max(S.camera.pitchMin, Math.min(S.camera.pitchMax, this.pitch + deltaPitch));
  }

  // -------------------------------------------------------------------------
  // Fixed step
  // -------------------------------------------------------------------------

  /**
   * @param {number} dt always CONFIG.time.fixedDt
   * @param {object} intent see createIntent()
   */
  step(dt, intent) {
    this.landedFallHeight = 0;
    if (this._slideCooldown > 0) this._slideCooldown -= dt;

    switch (this.state) {
      case SHADE_STATE.VAULT:
      case SHADE_STATE.MANTLE:
      case SHADE_STATE.PULLUP:
        this._stepTraversal(dt);
        break;
      case SHADE_STATE.HANG:
        this._stepHang(dt, intent);
        break;
      case SHADE_STATE.SLIDE:
        this._stepSlide(dt, intent);
        break;
      case SHADE_STATE.AIR:
        this._stepAir(dt, intent);
        break;
      default:
        this._stepGround(dt, intent);
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Ground
  // -------------------------------------------------------------------------

  _stepGround(dt, intent) {
    this._applyCrouch(intent.crouch);

    const wish = this._wishDirection(intent);
    const sprinting = intent.sprint && !this.crouching && wish.magnitude > 0;
    const targetSpeed = this.crouching ? S.crouchSpeed : sprinting ? S.sprintSpeed : S.walkSpeed;

    this._accelerate(wish, targetSpeed, S.groundAccel, dt);
    this._applyFriction(S.groundFriction, dt, wish.magnitude > 0);

    // Slide: from sprint plus crouch (Section 6.1).
    if (
      intent.crouchPressed &&
      sprinting &&
      this.speed >= S.slideMinEntrySpeed &&
      this._slideCooldown <= 0 &&
      this._enterSlide()
    ) {
      return;
    }

    // Vault: forward input plus sprint into a flagged ledge (Section 6.1).
    if (intent.sprint && intent.forward > 0 && this._tryVault()) return;

    if (intent.jumpPressed) this._jumpBuffer = S.jumpBuffer;
    if (this._jumpBuffer > 0) this._jumpBuffer -= dt;

    if (this._jumpBuffer > 0 && (this.grounded || this._coyote > 0)) {
      this.velocity.y = S.jumpSpeed;
      this._jumpBuffer = 0;
      this._coyote = 0;
      this.grounded = false;
      this._beginFall();
      this.state = SHADE_STATE.AIR;
      this._integrate(dt, true);
      return;
    }

    applyGravity(this.velocity, dt, S.gravity, S.maxFallSpeed);
    const before = this.speed;
    const result = this._integrate(dt, this.grounded);

    this.strideDistance += before * dt;

    if (result.grounded) {
      this._coyote = S.coyoteTime;
      if (this._falling) this._land();
    } else {
      this._coyote -= dt;
      if (this._coyote <= 0) {
        this._beginFall();
        this.state = SHADE_STATE.AIR;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Air
  // -------------------------------------------------------------------------

  _stepAir(dt, intent) {
    const wish = this._wishDirection(intent);
    this._accelerate(wish, S.sprintSpeed, S.airAccel, dt);
    this.velocity.x *= 1 - S.airDrag * dt;
    this.velocity.z *= 1 - S.airDrag * dt;

    applyGravity(this.velocity, dt, S.gravity, S.maxFallSpeed);
    const result = this._integrate(dt, false);

    // Mantle is auto-triggered when airborne near a flagged ledge (Section 6.1),
    // but only when actually moving into it.
    if (this._tryMantle(intent)) return;

    if (result.grounded) {
      this._land();
      this.state = SHADE_STATE.GROUND;
      this._coyote = S.coyoteTime;
    }
  }

  // -------------------------------------------------------------------------
  // Slide
  // -------------------------------------------------------------------------

  /** @returns {boolean} true if the slide was entered */
  _enterSlide() {
    // The lowered capsule must fit. Shrinking always fits, but validate anyway
    // so the rule holds if the slide height is ever retuned upward.
    if (!this._resize(S.slideHeight)) return false;

    this.state = SHADE_STATE.SLIDE;
    this._slideTimer = 0;
    this.crouching = true;

    const speed = this.speed;
    if (speed > 0.001) {
      const scale = S.slideSpeed / speed;
      this.velocity.x *= scale;
      this.velocity.z *= scale;
    } else {
      this.velocity.x = -Math.sin(this.yaw) * S.slideSpeed;
      this.velocity.z = -Math.cos(this.yaw) * S.slideSpeed;
    }
    return true;
  }

  _stepSlide(dt, intent) {
    this._slideTimer += dt;

    // 8.0 m/s initial, decaying over 0.8s (Section 6.1).
    const t = Math.min(1, this._slideTimer / S.slideDuration);
    const target = S.slideSpeed * (1 - t) + S.crouchSpeed * t;
    const speed = this.speed;
    if (speed > 0.001) {
      const scale = target / speed;
      this.velocity.x *= scale;
      this.velocity.z *= scale;
    }

    applyGravity(this.velocity, dt, S.gravity, S.maxFallSpeed);
    const result = this._integrate(dt, this.grounded);
    this.strideDistance += target * dt;

    const expired = this._slideTimer >= S.slideDuration;
    const released = !intent.crouch;

    if (expired || released || !result.grounded) {
      // Only stand up if there is headroom; otherwise stay low (in a vent this
      // is the normal case) and continue as a crouch.
      const stood = released && this._resize(S.standHeight);
      this.crouching = !stood;
      this._slideCooldown = S.slideCooldown;
      this.state = result.grounded ? SHADE_STATE.GROUND : SHADE_STATE.AIR;
      if (!result.grounded) this._beginFall();
    }
  }

  // -------------------------------------------------------------------------
  // Vault, mantle, pull-up
  // -------------------------------------------------------------------------

  /**
   * Look for a climbable face ahead and return what the controller would do
   * with it. Uses `classifyLedge()` — the same function map.js used to place
   * the affordance stripes, so what is marked is exactly what is climbable.
   */
  _probeLedge(reach) {
    const dirX = -Math.sin(this.yaw);
    const dirZ = -Math.cos(this.yaw);
    const direction = { x: dirX, y: 0, z: dirZ };
    const distance = reach + this.half.x;
    const feet = this.feetY;

    for (let i = 0; i < PROBE_HEIGHTS.length; i++) {
      const probeY = feet + PROBE_HEIGHTS[i];
      const origin = { x: this.position.x, y: probeY, z: this.position.z };
      const hit = this.collision.raycast(origin, direction, distance);
      if (!hit || !hit.box.climbable) continue;
      // Only a face gives a ledge; a top or bottom hit is not something to climb.
      if (Math.abs(hit.ny) > 0.5) continue;

      const topY = hit.box.max.y;
      const rise = topY - feet;
      const band = classifyLedge(rise);
      if (!band) continue;

      return { box: hit.box, topY, rise, band, hitX: hit.x, hitZ: hit.z, dirX, dirZ };
    }
    return null;
  }

  /**
   * Destination centre for standing on top of a probed ledge: past the edge by
   * a body radius plus a margin, at the ledge top.
   */
  _ledgeDestination(ledge, height) {
    const forwardOffset = this.half.x + 0.3;
    return {
      x: ledge.hitX + ledge.dirX * forwardOffset,
      y: ledge.topY + height / 2 + S.mantleClearance,
      z: ledge.hitZ + ledge.dirZ * forwardOffset,
    };
  }

  /**
   * The single gate into every traversal state. Validates the destination
   * capsule is clear before committing (Section 6.1 parkour safety rule).
   * @returns {boolean} false if blocked, in which case nothing was changed
   */
  _commitMove(state, destination, duration, height) {
    const half = { x: S.radius, y: height / 2, z: S.radius };
    if (!this.collision.isClear(destination, half)) return false;

    // Also require the destination to still be clear at full standing height if
    // the move ends standing, so a mantle under a low ceiling aborts rather
    // than leaving the player stuck inside geometry (Section 16, check 4).
    this._move = {
      from: { x: this.position.x, y: this.position.y, z: this.position.z },
      to: destination,
      timer: 0,
      duration,
      height,
    };
    this.state = state;
    this.velocity.set(0, 0, 0);
    this._falling = false;
    return true;
  }

  /**
   * Commit a climb onto a ledge, preferring to arrive standing but falling back
   * to crouched when the space above the ledge is low.
   *
   * Without the fallback a ledge with a low ceiling — a vent lip, anything under
   * a catwalk — is silently unclimbable: the destination capsule is standing
   * height, it does not fit, and the move aborts with no feedback.
   */
  _climbOnto(state, ledge, duration) {
    const heights = [S.standHeight, S.crouchHeight];
    for (let i = 0; i < heights.length; i++) {
      const destination = this._ledgeDestination(ledge, heights[i]);
      if (this._commitMove(state, destination, duration, heights[i])) return true;
    }
    return false;
  }

  _tryVault() {
    const ledge = this._probeLedge(S.vaultReach);
    if (!ledge || ledge.band !== 'vault') return false;
    return this._climbOnto(SHADE_STATE.VAULT, ledge, S.vaultDuration);
  }

  /**
   * Is the Shade actually heading at this ledge, rather than merely looking at
   * it? The probe follows the facing direction, so without this a player
   * stepping backwards off a ledge is grabbed by the face they just left.
   */
  _isApproaching(ledge, intent) {
    if (intent && intent.forward > 0) return true;
    const into = this.velocity.x * ledge.dirX + this.velocity.z * ledge.dirZ;
    return into >= S.mantleApproachSpeed;
  }

  _tryMantle(intent) {
    const ledge = this._probeLedge(S.mantleReach);
    if (!ledge) return false;
    if (!this._isApproaching(ledge, intent)) return false;

    // Vault-band ledges climb from the air too. A sprint is not always
    // available — on top of a crate there is no room to build speed — and
    // without this a 0.4m to 1.2m ledge cannot be climbed at all except by
    // running at it, which strands the player on small platforms.
    if (ledge.band === 'vault' || ledge.band === 'mantle') {
      const duration = ledge.band === 'vault' ? S.vaultDuration : S.mantleDuration;
      const state = ledge.band === 'vault' ? SHADE_STATE.VAULT : SHADE_STATE.MANTLE;
      if (this._climbOnto(state, ledge, duration)) return true;
      // Blocked. Section 6.1: fall back to a hang rather than clipping.
      return this._tryHang(ledge);
    }

    // Failed mantle above 2.4m: grab and hang (Section 6.1).
    if (ledge.band === 'hang') return this._tryHang(ledge);

    return false;
  }

  _tryHang(ledge) {
    if (ledge.rise < S.mantleMinHeight || ledge.rise > S.hangMaxHeight) return false;

    const centre = {
      x: ledge.hitX - ledge.dirX * (this.half.x + 0.04),
      y: ledge.topY - S.hangDrop + this.half.y,
      z: ledge.hitZ - ledge.dirZ * (this.half.x + 0.04),
    };
    if (!this.collision.isClear(centre, this.half)) return false;

    this.position.set(centre.x, centre.y, centre.z);
    this.velocity.set(0, 0, 0);
    this.state = SHADE_STATE.HANG;
    this._falling = false;
    this._hangLedge = ledge;
    this._hangTimer = 0;
    return true;
  }

  _stepHang(dt, intent) {
    const ledge = this._hangLedge;
    if (!ledge) {
      // Defensive: never leave the player frozen in a state with no ledge.
      this.state = SHADE_STATE.AIR;
      this._beginFall();
      return;
    }

    this._hangTimer += dt;
    if (this._hangTimer < S.hangInputGrace) return;

    // Shimmy sideways along the ledge.
    if (intent.strafe) this._shimmy(dt, intent.strafe, ledge);

    // Pull up with jump, drop with crouch (Section 6.1).
    //
    // These read the HELD key, not a fresh press. A hang is entered mid-jump
    // with the jump key usually still down, so an edge-triggered pull-up would
    // wait for a keypress the player has no reason to make — they are already
    // holding it. Same for crouch.
    if (intent.jump || intent.jumpPressed) {
      if (this._climbOnto(SHADE_STATE.PULLUP, ledge, S.hangPullUpDuration)) {
        this._hangLedge = null;
        return;
      }
      // The stored ledge was probed at grab time and can go stale — after a
      // shimmy, or if the grab landed on an awkward corner. Re-probe from where
      // we actually are before giving up, so a pull-up never silently does
      // nothing while the player hammers jump.
      const fresh = this._probeLedge(S.mantleReach);
      if (fresh && this._climbOnto(SHADE_STATE.PULLUP, fresh, S.hangPullUpDuration)) {
        this._hangLedge = null;
        return;
      }
      // Genuinely blocked: stay hanging, which is the correct "return to the
      // previous state" behaviour.
    }

    if (intent.crouch || intent.crouchPressed) {
      this._hangLedge = null;
      this.state = SHADE_STATE.AIR;
      this.velocity.set(0, 0, 0);
      this._beginFall();
    }
  }

  /**
   * Move sideways along a grabbed ledge. Refuses to move unless the body still
   * fits AND the ledge actually continues at the destination, so you cannot
   * shimmy off the end of an edge into thin air.
   */
  _shimmy(dt, direction, ledge) {
    // Lateral axis is perpendicular to the ledge's approach direction.
    const latX = -ledge.dirZ;
    const latZ = ledge.dirX;
    const distance = S.hangShimmySpeed * dt * direction;

    const x = this.position.x + latX * distance;
    const z = this.position.z + latZ * distance;

    if (!this.collision.isClear({ x, y: this.position.y, z }, this.half)) return;

    // The ledge must still be there to hold on to.
    const origin = { x, y: ledge.topY - 0.15, z };
    const hit = this.collision.raycast(
      origin,
      { x: ledge.dirX, y: 0, z: ledge.dirZ },
      this.half.x + 0.5
    );
    if (!hit || !hit.box.climbable) return;
    if (Math.abs(hit.box.max.y - ledge.topY) > 0.05) return;

    this.position.x = x;
    this.position.z = z;
    ledge.hitX += latX * distance;
    ledge.hitZ += latZ * distance;
  }

  _stepTraversal(dt) {
    const move = this._move;
    move.timer += dt;
    const t = Math.min(1, move.timer / move.duration);
    // Ease out, with a small vertical arc so a vault reads as going over
    // something rather than through it.
    const eased = t * t * (3 - 2 * t);
    const arc = Math.sin(t * Math.PI) * 0.18;

    this.position.x = move.from.x + (move.to.x - move.from.x) * eased;
    this.position.y = move.from.y + (move.to.y - move.from.y) * eased + arc;
    this.position.z = move.from.z + (move.to.z - move.from.z) * eased;

    if (t < 1) return;

    this.position.set(move.to.x, move.to.y, move.to.z);
    // The destination was validated at this height, so adopt it. A climb into a
    // low space arrives crouched rather than clipping.
    this.height = move.height;
    this.half.y = move.height / 2;
    this.crouching = move.height < S.standHeight;
    this._move = null;

    // Leave with a little momentum so a vault keeps flow (Section 6.1).
    if (this.state === SHADE_STATE.VAULT) {
      this.velocity.x = -Math.sin(this.yaw) * S.vaultExitSpeed;
      this.velocity.z = -Math.cos(this.yaw) * S.vaultExitSpeed;
    }

    this.state = SHADE_STATE.GROUND;
    this._coyote = S.coyoteTime;
    this.grounded = true;
    this._falling = false;
  }

  // -------------------------------------------------------------------------
  // Shared movement helpers
  // -------------------------------------------------------------------------

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
      groundNormalY: S.groundNormalY,
      stepHeight: S.stepHeight,
      wasGrounded,
    });
    this.grounded = result.grounded;
    return result;
  }

  _beginFall() {
    if (this._falling) return;
    this._falling = true;
    this._fallStartY = this.position.y;
  }

  _land() {
    const drop = this._fallStartY - this.position.y;
    this._falling = false;
    this.landedFallHeight = drop > 0 ? drop : 0;
    this.velocity.y = 0;
  }

  /**
   * Change capsule height keeping the feet planted. Growing is validated first:
   * standing up inside a vent must fail, not push the player through the roof.
   * @returns {boolean} whether the resize happened
   */
  _resize(newHeight) {
    if (Math.abs(newHeight - this.height) < 0.0001) return true;
    const feet = this.feetY;
    const newHalfY = newHeight / 2;
    const centre = this._scratchCentre;
    centre.x = this.position.x;
    centre.y = feet + newHalfY;
    centre.z = this.position.z;

    if (newHeight > this.height) {
      const half = { x: this.half.x, y: newHalfY, z: this.half.z };
      if (!this.collision.isClear(centre, half)) return false;
    }

    this.height = newHeight;
    this.half.y = newHalfY;
    this.position.y = centre.y;
    return true;
  }

  _applyCrouch(wantsCrouch) {
    if (wantsCrouch && !this.crouching) {
      if (this._resize(S.crouchHeight)) this.crouching = true;
    } else if (!wantsCrouch && this.crouching) {
      if (this._resize(S.standHeight)) this.crouching = false;
    }
  }

  // -------------------------------------------------------------------------
  // Visual — runs once per rendered frame, never in the fixed step
  // -------------------------------------------------------------------------

  /**
   * @param {number} wallDt unscaled frame delta, for smoothing only
   */
  updateVisual(wallDt) {
    // Smooth the render position so the 60Hz simulation does not read steppy at
    // higher refresh rates. Simulation state is untouched.
    const smoothing = wallDt > 0 ? 1 - Math.pow(0.0001, wallDt) : 1;
    this._smoothPosition.lerp(this.position, smoothing);

    const feet = this._smoothPosition.y - this.half.y;
    this.mesh.position.set(this._smoothPosition.x, feet, this._smoothPosition.z);
    this.mesh.rotation.y = this.yaw;

    // Squash the body group to match the current capsule height so a crouching
    // or sliding Shade actually looks low.
    this.mesh.scale.y = this.height / S.standHeight;

    this._animate(wallDt);
    this._updateGroundBlob(feet);
    this._updateCamera();
  }

  _animate(wallDt) {
    const parts = this.mesh.userData.parts;
    const speed = this.speed;
    const moving = speed > 0.2 && (this.state === SHADE_STATE.GROUND || this.state === SHADE_STATE.SLIDE);

    // Section 4: animate by rotating and translating primitive limb groups.
    if (moving) {
      this._animTime += wallDt * (2.4 + speed * 0.55);
    } else {
      this._animTime += wallDt * 1.1;
    }

    const swing = moving ? Math.sin(this._animTime) * Math.min(0.9, 0.22 + speed * 0.1) : 0;
    const idle = Math.sin(this._animTime * 0.8) * 0.04;

    if (this.state === SHADE_STATE.HANG) {
      parts.armL.rotation.x = -2.5;
      parts.armR.rotation.x = -2.5;
      parts.legL.rotation.x = 0.25;
      parts.legR.rotation.x = -0.15;
    } else if (this.state === SHADE_STATE.AIR) {
      parts.armL.rotation.x = -0.8;
      parts.armR.rotation.x = -0.5;
      parts.legL.rotation.x = 0.4;
      parts.legR.rotation.x = -0.3;
    } else if (this.state === SHADE_STATE.SLIDE) {
      parts.armL.rotation.x = -0.6;
      parts.armR.rotation.x = 0.5;
      parts.legL.rotation.x = 0.9;
      parts.legR.rotation.x = 0.1;
    } else {
      parts.legL.rotation.x = swing;
      parts.legR.rotation.x = -swing;
      parts.armL.rotation.x = -swing * 0.75;
      parts.armR.rotation.x = swing * 0.75;
    }

    parts.torso.position.y = parts.torso.userData.baseY + idle;
    parts.head.rotation.x = this.pitch * 0.25;
  }

  /** Section 4.1: grounding sold with a flat dark circle scaled by height. */
  _updateGroundBlob(feet) {
    const below = this.collision.raycast(
      { x: this._smoothPosition.x, y: feet + 0.1, z: this._smoothPosition.z },
      { x: 0, y: -1, z: 0 },
      CONFIG.effects.groundBlobMaxHeight
    );
    if (!below) {
      this.groundBlob.visible = false;
      return;
    }
    this.groundBlob.visible = true;
    const gap = Math.max(0, feet - below.y);
    const t = 1 - Math.min(1, gap / CONFIG.effects.groundBlobMaxHeight);
    this.groundBlob.position.set(this._smoothPosition.x, below.y + CONFIG.effects.footprintLift, this._smoothPosition.z);
    this.groundBlob.scale.setScalar(0.5 + t * 0.5);
    this.groundBlob.material.opacity = CONFIG.effects.groundBlobOpacity * t;
  }

  /**
   * Third person, 2.2m back / 1.4m up, collision-aware pullback (Section 6.1).
   * The rig is what the one camera object is parented to; no camera is created
   * here (Section 15).
   */
  _updateCamera() {
    const cam = S.camera;
    const pivotY = this._smoothPosition.y - this.half.y + cam.up;
    const pivot = { x: this._smoothPosition.x, y: pivotY, z: this._smoothPosition.z };

    const cosPitch = Math.cos(this.pitch);
    const backX = Math.sin(this.yaw) * cosPitch;
    const backY = -Math.sin(this.pitch);
    const backZ = Math.cos(this.yaw) * cosPitch;
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    // Sweep from the pivot out to the desired boom length and pull in on a hit.
    let desired = cam.back;
    const direction = { x: backX, y: backY, z: backZ };
    const hit = this.collision.raycast(pivot, direction, cam.back + cam.collisionRadius);
    if (hit) desired = Math.max(cam.minDistance, hit.distance - cam.collisionRadius);

    // Snap in immediately, ease out. A camera that lerps into a wall clips.
    if (desired < this._cameraDistance) {
      this._cameraDistance = desired;
    } else {
      const rate = 1 - Math.pow(0.0001, Math.max(0, 1 / 60));
      this._cameraDistance += (desired - this._cameraDistance) * Math.min(1, rate * (1 / cam.pullOutSmoothing) * (1 / 60));
    }

    const shoulder = cam.side * (this._cameraDistance / cam.back);
    this.cameraRig.position.set(
      pivot.x + backX * this._cameraDistance + rightX * shoulder,
      pivot.y + backY * this._cameraDistance,
      pivot.z + backZ * this._cameraDistance + rightZ * shoulder
    );
    this.cameraRig.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}

// ---------------------------------------------------------------------------
// Mesh construction
//
// Section 4: lanky. Tall capsule torso, long limbs, small head, oversized boots
// and gloves. Teal and charcoal. No faces, no hair, no skeletal rig.
// ---------------------------------------------------------------------------

function outlined(geometry, material, group, outlineMaterial) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  group.add(mesh);

  // Child of the mesh, not a sibling of it. Callers reposition the mesh they
  // get back — a limb segment hangs from its pivot — and a sibling outline
  // stays at the pivot instead of following. That left four outline capsules
  // stranded at the shoulders and hips, invisible only for as long as the
  // outline was painted near-black. Parenting makes the drift impossible.
  const outline = new THREE.Mesh(geometry, outlineMaterial);
  outline.scale.setScalar(CONFIG.render.outlineScale);
  mesh.add(outline);
  return mesh;
}

function buildShadeMesh(gradientMap) {
  const root = new THREE.Group();
  root.name = 'shade';

  const teal = new THREE.MeshToonMaterial({ color: P.shadeTeal, gradientMap });
  const charcoal = new THREE.MeshToonMaterial({ color: P.shadeCharcoal, gradientMap });
  // One outline material for the whole body, not one per part. Section 4.2
  // drives the edge brightness from the visibility meter every frame, and that
  // has to be a single assignment rather than a walk over nine materials.
  const outline = new THREE.MeshBasicMaterial({ color: P.outline, side: THREE.BackSide, fog: true });

  const H = S.standHeight;

  // Torso: tall capsule.
  const torso = new THREE.Group();
  torso.position.y = H * 0.62;
  torso.userData.baseY = torso.position.y;
  outlined(new THREE.CapsuleGeometry(0.19, H * 0.34, 4, 10), teal, torso, outline);
  root.add(torso);

  // Small head, sat high on the torso.
  const head = new THREE.Group();
  head.position.y = H * 0.29;
  outlined(new THREE.SphereGeometry(0.125, 12, 10), charcoal, head, outline);
  torso.add(head);

  // Long limbs, pivoting from the shoulder and hip.
  const makeLimb = (parent, x, y, length, radius, boot) => {
    const limb = new THREE.Group();
    limb.position.set(x, y, 0);
    const segment = outlined(new THREE.CapsuleGeometry(radius, length, 3, 8), charcoal, limb, outline);
    segment.position.y = -length / 2 - radius;
    // Oversized boots and gloves (Section 4).
    const cap = new THREE.Group();
    cap.position.y = -length - radius * 1.4;
    outlined(new THREE.BoxGeometry(boot, boot * 0.62, boot * 1.25), teal, cap, outline);
    limb.add(cap);
    parent.add(limb);
    return limb;
  };

  const armL = makeLimb(torso, -0.235, H * 0.16, H * 0.3, 0.058, 0.15);
  const armR = makeLimb(torso, 0.235, H * 0.16, H * 0.3, 0.058, 0.15);
  const legL = makeLimb(root, -0.105, H * 0.46, H * 0.4, 0.068, 0.17);
  const legR = makeLimb(root, 0.105, H * 0.46, H * 0.4, 0.068, 0.17);

  root.userData.parts = { torso, head, armL, armR, legL, legR };
  root.userData.materials = { teal, charcoal, outline };
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
  mesh.name = 'shade-ground-blob';
  return mesh;
}
