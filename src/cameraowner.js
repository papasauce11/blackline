/**
 * BLACKLINE — cameraowner.js
 *
 * Who has the one camera. Risk register (Section 15): "Camera state leaks
 * between roles or after the finisher — one camera object. Reparent and
 * adjust FOV only. Never instantiate a second camera." This is the one place
 * the camera changes parent, and the one place mouse look is routed to
 * whichever rig owns it. main.js asks it every frame; combat's finisher and
 * the death camera are handed `set` so they can take the camera without
 * reaching for it.
 */

import { CONFIG } from './config.js';

/**
 * @param {object} o
 * @param {THREE.PerspectiveCamera} o.camera the engine camera
 * @param {THREE.Scene} o.scene the free-fly parent
 * @param {import('./entities/agent.js').Shade} o.shade
 * @param {import('./entities/enforcer.js').Warden} o.warden
 * @param {import('./emitter.js').Emitter} o.emitter
 */
export function createCameraOwnership({ camera, scene, shade, warden, emitter }) {
  /** 'freefly' | 'shade' | 'warden' | null. The one camera is reparented, never rebuilt. */
  let owner = null;

  return {
    get owner() {
      return owner;
    },

    /**
     * Forget the owner without touching the camera, so the next `set` is a
     * full handover. initMatch calls it: nothing from the previous match's
     * owner may survive (Section 15).
     */
    forget() {
      owner = null;
    },

    /**
     * Move the one camera between rigs.
     *
     * Every swap resets the full local transform and the FOV, so nothing a
     * previous owner did can survive the handover. The Warden's ADS narrows
     * the FOV (Section 6.2); without the reset here, swapping away mid-aim
     * would leave the Shade permanently zoomed.
     *
     * @param {'freefly'|'shade'|'warden'} next
     */
    set(next) {
      if (owner === next) return;

      const parent =
        next === 'warden' ? warden.cameraRig : next === 'shade' ? shade.cameraRig : scene;

      parent.add(camera);
      camera.position.set(0, 0, 0);
      camera.rotation.set(0, 0, 0);
      camera.scale.set(1, 1, 1);
      camera.fov = CONFIG.render.fov;
      camera.updateProjectionMatrix();

      warden.setFirstPerson(next === 'warden');
      owner = next;
      emitter.emit('camera:owner', next);
    },

    /**
     * Route this frame's mouse delta. Mouse delta is a displacement, not a
     * rate, so look is applied once per frame rather than once per fixed step.
     *
     * @param {object} f
     * @param {'freefly'|'shade'|'warden'} f.human who the human is driving
     * @param {boolean} f.dead the death camera has the camera (Section 10.2)
     * @param {boolean} f.cinematic the finisher or the death camera has it
     */
    look({ human, dead, cinematic, input, deathCam, freefly }) {
      if (dead) {
        // Free-look while dead (Section 10.2). It orbits the killer and moves
        // nothing in the world.
        if (input.locked) {
          const delta = input.lookDelta();
          deathCam.look(delta.yaw, delta.pitch);
        }
      } else if (cinematic) {
        // No steering during the finisher either; it is not the player's camera.
      } else if (human === 'freefly') {
        freefly.look();
      } else if (input.locked) {
        // ADS uses a reduced sensitivity so the narrower FOV still tracks 1:1.
        const scale = human === 'warden' && warden.ads ? CONFIG.settings.adsSensitivityMultiplier : 1;
        const delta = input.lookDelta(scale);
        if (human === 'warden') warden.look(delta.yaw, delta.pitch);
        else shade.look(delta.yaw, delta.pitch);
      }
    },

    /**
     * Section 6.2: ADS narrows the FOV. Only the Warden touches it, and only
     * while it owns the camera; `set()` restores it on every handover.
     */
    applyAdsFov() {
      const fov = warden.desiredFov();
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },
  };
}
