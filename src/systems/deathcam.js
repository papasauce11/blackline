/**
 * BLACKLINE — systems/deathcam.js
 *
 * The Shade's death: the ragdoll, the free-look camera on the killing Warden,
 * and the guarded restore (Section 10.2, Section 15).
 *
 * Layering (Section 3.1): imports config only. The scene, the camera, the
 * emitter and the two callbacks it needs are handed in by the composition root,
 * exactly as combat's finisher is.
 *
 * This file exists for the same reason `Combat._restore()` does. Section 15
 * lists "reinsert leaves stale state (dead flag, ragdoll, camera on the death
 * cam)" as its own risk, and the required mitigation is a `respawnShade()` that
 * "resets controller state, clears the ragdoll, reparents the camera to the
 * standard rig, and re-enables input, with a hard wall-clock guard like the
 * finisher". A camera that is only handed back by the same countdown that took
 * it is one stall away from a player who can never move again — so the restore
 * is idempotent and there are two independent routes into it: the reinsert, and
 * a wall clock nothing in the simulation can slow down.
 */

import { CONFIG } from '../config.js';

const RI = CONFIG.reinsert;
const S = CONFIG.shade;

/** Wall-clock seconds. Deliberately not the sim clock, which is time-scaled. */
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

export class DeathCam {
  /**
   * @param {object} options
   * @param {THREE.Object3D} options.scene
   * @param {THREE.PerspectiveCamera} options.camera
   * @param {object} options.emitter
   * @param {import('./effects.js').Effects} options.effects
   * @param {(owner:string|null)=>void} options.setCameraOwner
   * @param {()=>void} options.forceReinsert last-resort escape for the guard
   */
  constructor({ scene, camera, emitter, effects, setCameraOwner, forceReinsert }) {
    this.scene = scene;
    this.camera = camera;
    this.emitter = emitter;
    this.effects = effects;
    this.setCameraOwner = setCameraOwner || (() => {});
    this.forceReinsert = forceReinsert || (() => {});

    /** Null when the Shade is alive. */
    this.state = null;
    /** Set once per death so a guarded restore cannot fire the escape twice. */
    this._escaped = false;
  }

  get active() {
    return this.state !== null;
  }

  reset() {
    if (this.state) this.restore();
    this.state = null;
    this._escaped = false;
  }

  // -------------------------------------------------------------------------
  // Begin
  // -------------------------------------------------------------------------

  /**
   * Called the moment the Shade dies, before anything resets it.
   *
   * @param {object} shade
   * @param {object} warden the killer the camera watches (Section 10.2)
   */
  begin(shade, warden) {
    if (this.state) return null;

    this.state = {
      wallStart: now(),
      // Start behind the killer's shoulder so the first frame reads as "that is
      // who got me" rather than as an arbitrary angle.
      yaw: warden ? warden.yaw : shade.yaw,
      pitch: RI.deathCamPitch,
      killer: warden || null,
      restored: false,
    };
    this._escaped = false;

    // Section 15's ragdoll-lite. The controller is disabled by the caller (the
    // Shade is dead and steps nothing); this only takes the mesh transform.
    if (this.effects && shade.mesh) {
      shade.ragdolled = true;
      shade.mesh.position.set(shade.position.x, shade.feetY, shade.position.z);
      const dx = warden ? shade.position.x - warden.position.x : 0;
      const dz = warden ? shade.position.z - warden.position.z : 1;
      const length = Math.hypot(dx, dz) || 1;
      this.effects.ragdoll(shade.mesh, { x: dx / length, z: dz / length });
    }

    // Taking the camera by name, through the same setter every other handover
    // uses, so the risk-register rule still holds: one camera, reparented.
    this.setCameraOwner('deathcam');
    this.emitter.emit('deathcam:begin', { killer: warden ? warden.position : null });
    return this.state;
  }

  // -------------------------------------------------------------------------
  // Free look (Section 10.2)
  // -------------------------------------------------------------------------

  /** Mouse look while dead. Orbits the killer; it never moves the dead Shade. */
  look(deltaYaw, deltaPitch) {
    if (!this.state) return;
    this.state.yaw += deltaYaw;
    this.state.pitch = Math.max(
      RI.deathCamPitchMin,
      Math.min(RI.deathCamPitchMax, this.state.pitch + deltaPitch)
    );
  }

  // -------------------------------------------------------------------------
  // Per frame
  // -------------------------------------------------------------------------

  /**
   * Frame the killer. Runs on the wall clock, like the finisher's camera: the
   * death camera is presentation, and a time scale of 0.05 should not turn a
   * slow orbit into a frozen one.
   *
   * @param {number} wallDt
   * @param {object} shade fallback subject if the killer is gone
   */
  step(wallDt, shade) {
    const state = this.state;
    if (!state) return;

    // Section 8.3's discipline, applied to Section 15's reinsert row: the only
    // guard that can be trusted is one measured against a clock the thing being
    // guarded cannot touch.
    if (now() - state.wallStart >= RI.wallClockGuard) {
      if (!this._escaped) {
        this._escaped = true;
        this.emitter.emit('deathcam:guard', { after: now() - state.wallStart });
        // Force the reinsert rather than merely dropping the camera: handing
        // back a camera attached to a still-dead Shade is not "control
        // restored", it just moves where the player is stuck.
        this.forceReinsert();
      }
      // If the reinsert did not take, still let go of the camera.
      if (this.state) this.restore();
      return;
    }

    // A slow drift so the scene reads as a camera rather than a screenshot.
    state.yaw += RI.deathCamOrbitSpeed * wallDt;

    // The killer may have died or respawned since. Fall back to the body.
    const subject = state.killer && state.killer.health > 0
      ? state.killer
      : (state.killer || shade);
    const focusY = (subject.feetY !== undefined ? subject.feetY : subject.position.y) + RI.deathCamHeight;

    const cosPitch = Math.cos(state.pitch);
    this.camera.position.set(
      subject.position.x + Math.sin(state.yaw) * RI.deathCamDistance * cosPitch,
      focusY - Math.sin(state.pitch) * RI.deathCamDistance,
      subject.position.z + Math.cos(state.yaw) * RI.deathCamDistance * cosPitch
    );
    this.camera.lookAt(subject.position.x, focusY, subject.position.z);
  }

  // -------------------------------------------------------------------------
  // Restore
  // -------------------------------------------------------------------------

  /**
   * Hand everything back. Idempotent, and reachable from both the reinsert and
   * the wall-clock guard, so the countdown never owns the only path out.
   */
  restore() {
    if (!this.state) return false;
    this.state = null;
    this.camera.position.set(0, 0, 0);
    this.camera.rotation.set(0, 0, 0);
    this.camera.scale.set(1, 1, 1);
    this.camera.fov = CONFIG.render.fov;
    this.camera.updateProjectionMatrix();
    // Null, not 'shade': the composition root reasserts the live owner on the
    // next frame, and naming it here would duplicate that decision.
    this.setCameraOwner(null);
    this.emitter.emit('deathcam:end', {});
    return true;
  }

  /**
   * The Section 15 respawnShade(). Everything the risk register lists, in one
   * place, so a future reinsert path cannot do three of the four.
   */
  respawnShade(shade, spawn) {
    if (shade.ragdolled) {
      shade.ragdolled = false;
      if (this.effects) this.effects.clearRagdoll(shade.mesh);
    }
    // reset() clears the dead flag, the health, the controller state and the
    // mesh rotation the ragdoll left behind.
    shade.reset(spawn || { position: shade.position, yaw: shade.yaw });
    shade.health = S.health;
    this.restore();
    return shade;
  }
}

export function createDeathCam(options) {
  return new DeathCam(options);
}
