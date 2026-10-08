/**
 * BLACKLINE — entities/agentvisual.js
 *
 * How the Shade is drawn: the smoothed render position, the limb animation,
 * the ground blob and the third-person camera rig. Runs once per rendered
 * frame, never in the fixed step, and writes nothing the simulation reads.
 *
 * Methods of `Shade`, kept in their own file (F3). agent.js installs them on
 * the prototype, so `this` is the Shade and every field keeps its name.
 */

import { CONFIG } from '../config.js';
import { SHADE_STATE } from './agentstate.js';
import { blendFactor, easePose, headBobLift, restPose } from './pose.js';

const S = CONFIG.shade;
/** The knife lives in combat config; the arc that draws it reads the same
 *  number `swing()` in agent.js arms the timer with. */
const KNIFE_SWING_TIME = CONFIG.combat.knife.swingAnimTime;
/**
 * The hanging body is at full stretch (B8): arms straight up, gloves on the
 * lip, which is where `hangDrop` puts them. Pi is straight up on this rig;
 * a shade short of it keeps the elbows in front of the head.
 */
export const HANG_ARM_ANGLE = -3.05;

/**
 * How much of the way the drawn body closes on the capsule in one frame of
 * `wallDt`. Exported so a check can argue a settle from the law rather than
 * from a copy of its result (H40).
 */
export function positionSmoothing(wallDt) {
  return wallDt > 0 ? 1 - Math.pow(0.0001, wallDt) : 1;
}

/**
 * The poses (E3), in radians about each group's pivot - x forward for a
 * limb and back for the torso's top, z out to the body's right - and the
 * gait they sit on. Every state is a pose here or a pose over the gait;
 * `_posture` fills the target and `easePose` (pose.js) carries the six
 * groups there. Every number is a look, never a rule; D42 argues them.
 */
export const POSE = {
  /**
   * The swing: the legs to the amplitude, the arms the other way by `arms`
   * of it, the amplitude by speed; the body leans into its speed and bobs
   * twice a cycle.
   */
  gait: { base: 0.22, perSpeed: 0.1, max: 0.9, arms: 0.75, lean: 0.025, bob: 0.03 },
  /** The breath standing still: the torso rises and falls this much, this fast (rad/s). */
  breath: { lift: 0.04, rate: 0.9 },
  /** Low and forward, the thighs bent under the squashed body, the hands ahead and a little out, the head up to see; the gait under it, smaller. */
  crouch: { lean: -0.35, legL: 0.55, legR: 0.25, arms: 0.35, armsOut: 0.15, head: 0.3, gait: 0.6 },
  /** Leant back with the legs out ahead, the left hand trailing on the floor and the right out for balance. */
  slide: { lean: 0.35, legL: 1.1, legR: 0.7, armL: -0.7, armR: 0.6, armROut: 0.3 },
  /**
   * Rising: a stride held and the arms trailing. Falling: the legs together
   * and the arms out to the sides, by the fall (`fallSpeed` m/s is all of
   * it). A press that has armed a climb with a face under the hands reaches
   * for it instead, so the grab that follows comes up over the front.
   */
  air: { rise: { legL: 0.5, legR: -0.2, armL: -0.6, armR: -0.3 }, fall: { legs: 0.15, arms: -0.4, armsOut: 0.9 }, fallSpeed: 6, reach: 1.8 },
  /** The hands planted ahead and down through the first half, pushing off behind by the end; the legs tucked over the top, a bell over the move. */
  vault: { plant: 0.9, push: -0.4, tuckL: 1.4, tuckR: 1.0, lean: -0.5 },
  /** The hands over the lip above the head, pressing down as the body comes up; the right knee over the lip, the left trailing. */
  mantle: { reach: 2.4, press: 0.8, knee: 1.3, trail: 0.2, lean: -0.4 },
  /** At full stretch (B8): the arms straight up (`HANG_ARM_ANGLE`), the legs hanging a little apart. */
  hang: { legL: 0.12, legR: -0.06 },
  /**
   * From the hang the hands stay on the lip and the body rises past them:
   * the arms go the long way round, over the front, from straight up to
   * ahead and down (`over`), and the legs kick.
   */
  pullup: { over: 0.6, kickL: 0.9, kickR: -0.4, lean: -0.3 },
  /** The legs taking a hard landing (B8): a squat, the arms out for balance; by the weight, as long as the recovery holds the speed down. */
  landing: { legs: 0.6, lean: -0.4, arms: 0.3, armsOut: 0.7 },
  /** How much of the aim's pitch the head takes. */
  head: 0.25,
};

export const VISUAL = {
  /**
   * @param {number} wallDt unscaled frame delta, for smoothing only
   */
  updateVisual(wallDt) {
    // While a ragdoll owns the mesh, do not write position or rotation: the
    // controller and the ragdoll would fight over the same transform every
    // frame and the controller, running later, would always win. Same rule the
    // Warden follows — see enforcer.js.
    if (this.ragdolled) return;

    // Smooth the render position so the 60Hz simulation does not read steppy at
    // higher refresh rates. Simulation state is untouched.
    //
    // This is the SLOWEST ease between a state change and the drawn body:
    // 0.1423 a frame at 60Hz, so 45 frames to 99.9% against the pose blend's
    // twelve (H40). A grab lifts the capsule about a metre, so a check that
    // reads a world position off this mesh must wait for it and not for the
    // pose - `positionSmoothing` is exported for the one that does.
    const smoothing = positionSmoothing(wallDt);
    this._smoothPosition.lerp(this.position, smoothing);

    const feet = this._smoothPosition.y - this.half.y;
    this.mesh.position.set(this._smoothPosition.x, feet, this._smoothPosition.z);
    this.mesh.rotation.y = this.yaw;

    this._settleDip(wallDt);

    // Squash the body group to match the current capsule height so a crouching
    // or sliding Shade actually looks low - and, while the camera is dipped,
    // by the weight of the landing or the climb that dipped it (B8).
    const squash = S.landing.squash * Math.max(0, Math.min(1, -this._dip / S.camera.landDip));
    this.mesh.scale.y = (this.height / S.standHeight) * (1 - squash);

    this._animate(wallDt);
    this._updateGroundBlob(feet);
    this._updateCamera();
  },

  _animate(wallDt) {
    const parts = this.mesh.userData.parts;

    // Section 4: animate by rotating and translating primitive limb groups.
    // The state's pose into the one target record (E3), then every group
    // eased toward it; the two timed tells below are written over the top.
    const pose = this._pose;
    this._posture(pose, wallDt);
    easePose(parts.torso, parts, pose, blendFactor(wallDt));

    // The hands-up slap (B2): both arms thrown straight up against the face,
    // then dropped over the pose time. Overrides whatever the state posed.
    if (this._scuffTimer > 0) {
      this._scuffTimer = Math.max(0, this._scuffTimer - wallDt);
      const t = this._scuffTimer / S.scuffPoseTime;
      parts.armL.rotation.x = -3.0 * t;
      parts.armR.rotation.x = -3.0 * t;
    }

    // The knife arc overrides the right arm for its duration: a fast wind-up
    // and a slower follow-through, so the swing reads as a strike rather than
    // a twitch. The ease takes the arm back to its pose when it is over.
    if (this._swingTimer > 0) {
      this._swingTimer = Math.max(0, this._swingTimer - wallDt);
      const t = 1 - this._swingTimer / KNIFE_SWING_TIME;
      const arc = t < 0.35
        ? -1.9 * (t / 0.35)
        : -1.9 + 2.9 * ((t - 0.35) / 0.65);
      parts.armR.rotation.x = arc;
      parts.armR.rotation.z = -0.5 * Math.sin(t * Math.PI);
      parts.torso.rotation.y = -0.35 * Math.sin(t * Math.PI);
    } else {
      parts.torso.rotation.y = 0;
    }
  },

  /**
   * The pose the state asks for this frame, into `pose` (E3). The gait is
   * a swing of the legs by the ground covered; the ground's poses sit on
   * it and every other state's replaces it. Timed moves key theirs on the
   * move's own progress. Nothing here allocates: the record is filled in
   * place.
   */
  _posture(pose, wallDt) {
    const speed = this.speed;
    const onGround = this.state === SHADE_STATE.GROUND;
    const walking = onGround && speed > 0.2;

    // The feet plant by the ground covered, not by the clock: half a cycle
    // per stride of the band's footstep, so a foot lands as the step
    // sounds, and a body that stops stops mid-stride and eases to rest.
    if (walking) {
      const band = this.movementBand;
      const stride = band === 'crouch' ? S.crouchFootstepStride : band === 'sprint' ? S.sprintFootstepStride : S.footstepStride;
      this._animTime += speed * wallDt * (Math.PI / stride);
    }
    this._breathTime += wallDt;

    restPose(pose);
    const G = POSE.gait;
    const gait = walking ? Math.sin(this._animTime) * Math.min(G.max, G.base + speed * G.perSpeed) : 0;
    pose.lift = Math.sin(this._breathTime * POSE.breath.rate) * POSE.breath.lift;
    pose.headX = this.pitch * POSE.head;

    switch (this.state) {
      case SHADE_STATE.HANG:
      case SHADE_STATE.GRAB: {
        pose.armLX = HANG_ARM_ANGLE;
        pose.armRX = HANG_ARM_ANGLE;
        pose.legLX = POSE.hang.legL;
        pose.legRX = POSE.hang.legR;
        break;
      }
      case SHADE_STATE.PULLUP: {
        const P = POSE.pullup;
        const t = this._moveProgress();
        const bell = Math.sin(t * Math.PI);
        // Down from straight up through minus pi, which is plus pi: the
        // hands pass in front of the body. The ease follows the short way to
        // a target that moves a little each frame, so it goes round with it.
        const arms = HANG_ARM_ANGLE - t * (2 * Math.PI + HANG_ARM_ANGLE - P.over);
        pose.armLX = arms;
        pose.armRX = arms;
        pose.legLX = P.kickL * bell;
        pose.legRX = P.kickR * bell;
        pose.torsoX = P.lean * bell;
        break;
      }
      case SHADE_STATE.VAULT: {
        const V = POSE.vault;
        const t = this._moveProgress();
        const bell = Math.sin(t * Math.PI);
        const arms = t < 0.5 ? V.plant : V.plant + (V.push - V.plant) * (t - 0.5) * 2;
        pose.armLX = arms;
        pose.armRX = arms;
        pose.legLX = V.tuckL * bell;
        pose.legRX = V.tuckR * bell;
        pose.torsoX = V.lean * bell;
        break;
      }
      case SHADE_STATE.MANTLE: {
        const M = POSE.mantle;
        const t = this._moveProgress();
        const bell = Math.sin(t * Math.PI);
        const arms = M.reach + (M.press - M.reach) * t;
        pose.armLX = arms;
        pose.armRX = arms;
        pose.legLX = M.trail;
        pose.legRX = M.knee * bell;
        pose.torsoX = M.lean * bell;
        break;
      }
      case SHADE_STATE.AIR: {
        const A = POSE.air;
        if (this._climbArmed && this._faceAhead) {
          pose.armLX = A.reach;
          pose.armRX = A.reach;
          pose.legLX = A.rise.legL;
          pose.legRX = A.rise.legR;
          break;
        }
        const f = Math.max(0, Math.min(1, -this.velocity.y / A.fallSpeed));
        pose.legLX = A.rise.legL + (A.fall.legs - A.rise.legL) * f;
        pose.legRX = A.rise.legR + (-A.fall.legs - A.rise.legR) * f;
        pose.armLX = A.rise.armL + (A.fall.arms - A.rise.armL) * f;
        pose.armRX = A.rise.armR + (A.fall.arms - A.rise.armR) * f;
        pose.armLZ = -A.fall.armsOut * f;
        pose.armRZ = A.fall.armsOut * f;
        break;
      }
      case SHADE_STATE.SLIDE: {
        const D = POSE.slide;
        pose.torsoX = D.lean;
        pose.legLX = D.legL;
        pose.legRX = D.legR;
        pose.armLX = D.armL;
        pose.armRX = D.armR;
        pose.armRZ = D.armROut;
        break;
      }
      default: {
        // The ground: the gait, with the crouch and the landing on top of it.
        const C = POSE.crouch;
        const swing = this.crouching ? gait * C.gait : gait;
        pose.legLX = swing;
        pose.legRX = -swing;
        pose.armLX = -swing * G.arms;
        pose.armRX = swing * G.arms;
        pose.torsoX = -speed * G.lean;
        pose.lift += Math.abs(Math.sin(this._animTime)) * G.bob * (walking ? speed / S.sprintSpeed : 0);
        if (this.crouching) {
          pose.torsoX += C.lean;
          pose.legLX += C.legL;
          pose.legRX += C.legR;
          pose.armLX += C.arms;
          pose.armRX += C.arms;
          pose.armLZ = -C.armsOut;
          pose.armRZ = C.armsOut;
          pose.headX += C.head;
        }
        // The weight of the landing (B8) while the legs take it: the
        // recovery is `landing.recovery` scaled by the weight, so what is
        // left of it over the whole is the weight still on the legs.
        const r = this._landRecovery > 0 ? Math.min(1, this._landRecovery / S.landing.recovery) : 0;
        if (r > 0) {
          const L = POSE.landing;
          pose.legLX += L.legs * r;
          pose.legRX += L.legs * r;
          pose.torsoX += L.lean * r;
          pose.armLX += L.arms * r;
          pose.armRX += L.arms * r;
          pose.armLZ -= L.armsOut * r;
          pose.armRZ += L.armsOut * r;
        }
      }
    }
  },

  /** How far through the traversal move in flight, 0..1; 1 when there is none. */
  _moveProgress() {
    const move = this._move;
    return move ? Math.min(1, move.timer / move.duration) : 1;
  },

  /**
   * The dip (B8): a critically damped spring on the camera pivot's height.
   * The step leaves a kick in `_dipKick` - metres, negative is down - and it
   * lands here as a velocity impulse sized so the spring bottoms out at
   * exactly that depth `dipRecovery` seconds later (x(t) = -d·e·(t/τ)·e^(-t/τ)
   * has its minimum -d at t = τ), then eases back to rest with no overshoot.
   * Wall time, like the smoothing: it is presentation, and the simulation
   * never reads it.
   */
  _settleDip(wallDt) {
    const tau = S.camera.dipRecovery;
    if (this._dipKick !== 0) {
      this._dipVel += (this._dipKick * Math.E) / tau;
      this._dipKick = 0;
    }
    if (!(wallDt > 0)) return;
    const k = 1 / (tau * tau);
    const c = 2 / tau;
    this._dipVel += (-k * this._dip - c * this._dipVel) * wallDt;
    this._dip += this._dipVel * wallDt;
    if (Math.abs(this._dip) < 1e-4 && Math.abs(this._dipVel) < 1e-3) {
      this._dip = 0;
      this._dipVel = 0;
    }
  },

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
  },

  /**
   * Third person, 2.2m back / 1.4m up, collision-aware pullback (Section 6.1).
   * The rig is what the one camera object is parented to; no camera is created
   * here (Section 15).
   */
  _updateCamera() {
    const cam = S.camera;
    // `_dip` is the weight of the last landing or climb, easing out (B8); the
    // bob is the stride, and only if the player asked for it (H9). It reads
    // `_animTime` after `_animate` has advanced it this frame, so the camera
    // rises with the same foot the legs are swinging.
    const bob = headBobLift(
      this._animTime, this.speed, S.sprintSpeed, cam.bob,
      this.state === SHADE_STATE.GROUND && this.speed > 0.2
    );
    const pivotY = this._smoothPosition.y - this.half.y + cam.up + this._dip + bob;
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
};
