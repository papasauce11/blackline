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

const S = CONFIG.shade;
/** The knife lives in combat config; the arc that draws it reads the same
 *  number `swing()` in agent.js arms the timer with. */
const KNIFE_SWING_TIME = CONFIG.combat.knife.swingAnimTime;

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
  },

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

    if (this.state === SHADE_STATE.HANG || this.state === SHADE_STATE.GRAB) {
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

    // The knife arc overrides the right arm for its duration: a fast wind-up
    // and a slower follow-through, so the swing reads as a strike rather than
    // a twitch.
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
      parts.armR.rotation.z = 0;
      parts.torso.rotation.y = 0;
    }

    parts.torso.position.y = parts.torso.userData.baseY + idle;
    parts.head.rotation.x = this.pitch * 0.25;
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
};
