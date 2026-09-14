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
 *
 * Four files (F3): this one is the state machine, the ground and the air;
 * `agentslide.js` is the slide; `agenttraversal.js` is every climb (vault,
 * mantle, grab, hang, pull-up); `agentvisual.js` is how it is drawn. They are
 * methods of the one class, installed on its prototype at the bottom.
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { applyGravity } from '../physics.js';
import { buildShadeMesh, buildGroundBlob } from './agentmesh.js';
import { SHADE_STATE } from './agentstate.js';
import { SLIDE } from './agentslide.js';
import { TRAVERSAL } from './agenttraversal.js';
import { VISUAL } from './agentvisual.js';

export { SHADE_STATE } from './agentstate.js';

const S = CONFIG.shade;
/** The knife lives in combat config; the arc that draws it reads the same
 *  number rather than a second copy under `shade`. */
const KNIFE_SWING_TIME = CONFIG.combat.knife.swingAnimTime;

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
    /** Plant hold (Section 10.1). Read by systems/objective.js. */
    interact: false,
    /** Gadget slots 1-4 (Section 9.1). Read by systems/gadgets.js. */
    gadget: 0,
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
    /** Set while effects owns the mesh transform (Section 15 ragdoll-lite). */
    this.ragdolled = false;
    /**
     * Set by systems/gadgets.js while a stun grenade is on the Shade
     * (Section 9.2). Non-lethal: it slows, it never damages.
     */
    this.speedMultiplier = 1;

    this._coyote = 0;
    this._jumpBuffer = 0;
    this._slideTimer = 0;
    this._slideCooldown = 0;
    this._fallStartY = 0;
    this._falling = false;
    /**
     * A climb is a press of Space, never a side effect of moving (D17). On the
     * ground the jump buffer is the press. In the air this is: set by the jump
     * that launched the body, or by a press during a fall; cleared by walking
     * off an edge and by landing. `_stepAir()` will not mantle without it.
     */
    this._climbArmed = false;
    /** Feet height the body last stood at. `_reachNow()` measures against it. */
    this._launchY = 0;
    /** Populated when a traversal move is in flight. */
    this._move = null;
    /** The ledge currently being hung from. */
    this._hangLedge = null;
    this._hangTimer = 0;
    /**
     * The highest solid face the last ledge probe's hands met, climbable or
     * not, so a climb that finds nothing to get over can still tell you what
     * stopped it (B2). Rewritten by every `_probeLedge()`.
     */
    this._faceAhead = null;
    /** Counts down while the hands are slapped against a face (B2). */
    this._scuffTimer = 0;
    /**
     * Landing weight (B8). How hard the last landing was, 0..1 on
     * `landing`'s ramp, and how long the legs are still taking it: while
     * `_landRecovery` runs the ground speed is held down by the weight.
     */
    this._landWeight = 0;
    this._landRecovery = 0;
    /**
     * The camera dip (B8). The step writes a kick in metres - a hard landing,
     * a climb committing - and the visual runs it through a spring on the
     * pivot's height (`_settleDip`); the simulation never reads the spring.
     * Same shape as `_scuffTimer`: the step says what happened, the frame
     * shows it.
     */
    this._dipKick = 0;
    this._dip = 0;
    this._dipVel = 0;
    /** Failed climbs this body has had, for the checks. */
    this.scuffs = 0;
    /** Distance travelled on the ground, for footstep cadence in Phase 5. */
    this.strideDistance = 0;
    /** Set on the step a landing happens, for Phase 5 noise. Cleared each step. */
    this.landedFallHeight = 0;
    /** Where the hands hit on the step a scuff happens, for the noise (D23). Cleared each step. */
    this.scuffedAt = null;

    this.cameraRig = new THREE.Object3D();
    this.cameraRig.name = 'shade-camera-rig';
    this._cameraDistance = S.camera.back;

    this.mesh = buildShadeMesh(gradientMap);
    this.groundBlob = buildGroundBlob();

    this._smoothPosition = new THREE.Vector3();
    this._animTime = 0;
    /** Counts down while the knife arm is mid-arc (Section 8.2). */
    this._swingTimer = 0;
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
    // Section 15: "reinsert leaves stale state (dead flag, ragdoll, ...)".
    // Clearing it first, before anything reads the mesh transform, is what lets
    // updateVisual() below take the body back off the floor.
    this.ragdolled = false;
    this.mesh.rotation.set(0, 0, 0);
    this.mesh.visible = true;

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
    this._climbArmed = false;
    this._fallStartY = this.position.y;
    this._launchY = this.feetY;
    this._move = null;
    this._hangLedge = null;
    this._hangTimer = 0;
    this._faceAhead = null;
    this._scuffTimer = 0;
    this._landWeight = 0;
    this._landRecovery = 0;
    this._dipKick = 0;
    this._dip = 0;
    this._dipVel = 0;
    this.strideDistance = 0;
    this.landedFallHeight = 0;
    this.scuffedAt = null;
    this._swingTimer = 0;
    this._smoothPosition.copy(this.position);
    this._cameraDistance = S.camera.back;
    this.updateVisual(0);
  }

  get feetY() {
    return this.position.y - this.half.y;
  }

  /**
   * Play the knife arc. Called by systems/combat.js when a swing is actually
   * committed, so what you see and what the game did cannot disagree — a swing
   * on cooldown draws nothing because it did nothing.
   */
  swing() {
    this._swingTimer = KNIFE_SWING_TIME;
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
    this.scuffedAt = null;
    if (this._slideCooldown > 0) this._slideCooldown -= dt;
    // The jump buffer runs in every state, not only on the ground (B8): a
    // press of Space in the last `jumpBuffer` of a fall fires on the landing,
    // and one in the last of a vault or a mantle fires on the exit, which is
    // what the constant's own comment always promised. It is set where a
    // press is read - the ground, the air, a traversal - and spent by the
    // jump, the climb, or the scuff that answers it.
    if (this._jumpBuffer > 0) this._jumpBuffer -= dt;
    if (this._landRecovery > 0) this._landRecovery -= dt;
    // The height the jump bonus is measured against. While the feet are on
    // something this is simply where they are; the moment the body leaves, it
    // freezes at the surface it left from — whether that was a jump, a step off
    // an edge or a shove. See `_reachNow()`.
    if (this.grounded) this._launchY = this.feetY;

    switch (this.state) {
      case SHADE_STATE.VAULT:
      case SHADE_STATE.MANTLE:
      case SHADE_STATE.GRAB:
      case SHADE_STATE.PULLUP:
        this._stepTraversal(dt, intent);
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
    // Slide entry is tested BEFORE the crouch is applied (Section 6.1: "from
    // sprint plus crouch").
    //
    // A player holds sprint and taps crouch, so on the step the edge fires,
    // `crouch` and `crouchPressed` are BOTH true — that is what the keyboard
    // produces, because a keydown adds the code to the held set and the pressed
    // set together. Applying the crouch first therefore set `crouching`, which
    // cleared `sprinting`, which meant the slide could never be entered from
    // real input at all. The fuzz never caught it because random input happily
    // produces a crouch edge with the key not held, which no player can.
    //
    // Same shape as the Phase 3 ledge-hang bug: an edge flag read after the
    // state it depends on has already been changed by the held flag.
    if (
      intent.crouchPressed &&
      intent.sprint &&
      this.speed >= S.slideMinEntrySpeed &&
      this._slideCooldown <= 0 &&
      this._wishDirection(intent).magnitude > 0 &&
      this._enterSlide()
    ) {
      return;
    }

    this._applyCrouch(intent.crouch);

    const wish = this._wishDirection(intent);
    const sprinting = intent.sprint && !this.crouching && wish.magnitude > 0;
    let targetSpeed = (this.crouching ? S.crouchSpeed : sprinting ? S.sprintSpeed : S.walkSpeed)
      * this.speedMultiplier;
    // The legs are still taking a hard landing (B8): the speed is held down
    // by the weight of it until `_landRecovery` runs out.
    if (this._landRecovery > 0) targetSpeed *= 1 - S.landing.speedLoss * this._landWeight;

    this._accelerate(wish, targetSpeed, S.groundAccel, dt);
    this._applyFriction(S.groundFriction, dt, wish.magnitude > 0);

    if (intent.jumpPressed) this._jumpBuffer = S.jumpBuffer;

    // A jump into a ledge is a climb, not a jump (Section 6.1, amended). It is
    // tested before the jump itself so the two can never both fire, and it
    // reads the BUFFER rather than the press edge, which means a jump pressed
    // slightly early still climbs instead of being spent in front of the wall.
    if (this._jumpBuffer > 0 && this._tryClimbFromGround(intent)) {
      this._jumpBuffer = 0;
      return;
    }

    if (this._jumpBuffer > 0 && (this.grounded || this._coyote > 0)) {
      this.velocity.y = S.jumpSpeed;
      this._jumpBuffer = 0;
      this._coyote = 0;
      this.grounded = false;
      this._beginFall();
      this.state = SHADE_STATE.AIR;
      // The press that launched this jump is the choice to climb whatever the
      // arc reaches (D17). A walk-off, below, never arms.
      this._climbArmed = true;
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
        this._climbArmed = false;
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

    // An airborne climb needs a press of Space behind it (D17): the jump that
    // launched the body, or a press during the fall. Without one the body
    // falls past every ledge it could have caught, which is the point - a
    // walk-off is not a choice to climb. And it still has to be moving into
    // the ledge. The same press is buffered, so if the fall ends within the
    // window before the arc finds anything, it is a jump off the landing.
    if (intent.jumpPressed) {
      this._climbArmed = true;
      this._jumpBuffer = S.jumpBuffer;
    }
    if (this._climbArmed && this._tryMantle(intent)) return;
    // The press found nothing to get over. If the hands are on a face, that
    // is a failed climb, and a failed climb is never silent (B2). One tell
    // per press: the arm is spent by it, and the next press re-arms.
    if (this._climbArmed && this._faceAhead && this._isApproaching(this._faceAhead, intent)) {
      this._scuff(this._faceAhead, true);
      this._climbArmed = false;
    }

    if (result.grounded) {
      this._land();
      this.state = SHADE_STATE.GROUND;
      this._coyote = S.coyoteTime;
    }
  }

  // The slide is agentslide.js; vault, mantle, grab, hang and pull-up are
  // agenttraversal.js; the visual is agentvisual.js. All three are installed
  // on the prototype below.

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
    this._climbArmed = false;
    this.landedFallHeight = drop > 0 ? drop : 0;
    this.velocity.y = 0;

    // Landing weight (B8). Nothing below `softFall`, everything from
    // `hardFall`, a ramp between: the horizontal speed is cut by that much of
    // `speedLoss` here, the ground speed is held there for `recovery`
    // (`_stepGround`), and the camera and the body get the same weight to
    // show - `_dipKick` for the pivot, `_landWeight` for the squash.
    const L = S.landing;
    const weight = Math.max(0, Math.min(1, (this.landedFallHeight - L.softFall) / (L.hardFall - L.softFall)));
    if (weight <= 0) return;
    const keep = 1 - L.speedLoss * weight;
    this.velocity.x *= keep;
    this.velocity.z *= keep;
    this._landWeight = weight;
    this._landRecovery = L.recovery * weight;
    this._dipKick -= S.camera.landDip * weight;
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
}

Object.assign(Shade.prototype, SLIDE, TRAVERSAL, VISUAL);
