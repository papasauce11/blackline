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

import { CONFIG, SETTINGS } from './config.js';

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

  /**
   * The FOV a rig sits at with no aim in it (H9). The two roles are the
   * player's settings and free-fly is the engine's, which is also what a
   * cinematic restores to; with the shipped defaults all three are
   * `CONFIG.render.fov`, so a check written before H9 still reads the right
   * constant.
   *
   * @param {'freefly'|'shade'|'warden'} who
   */
  const restFov = (who) =>
    who === 'warden' ? SETTINGS.fovWarden : who === 'shade' ? SETTINGS.fovShade : CONFIG.render.fov;

  /**
   * How far into the sprint kick the lens is, 0..1 (D90). Walked by `applyFov`
   * on the wall delta that `frame:begin` carries - main.js emits it before it
   * asks for the FOV, so the ease keeps wall time without this module reaching
   * for the loop. Owned here and nowhere else, so `set` and `forget` can
   * zero it.
   */
  let kick = 0;
  let wallDelta = 0;
  emitter.on('frame:begin', (frame) => { wallDelta = frame.wallDelta; });

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
      kick = 0;
    },

    /**
     * Move the one camera between rigs.
     *
     * Every swap resets the full local transform and the FOV, so nothing a
     * previous owner did can survive the handover. The Warden's ADS narrows
     * the FOV (Section 6.2); without the reset here, swapping away mid-aim
     * would leave the Shade permanently zoomed. The FOV it resets to is the
     * next owner's *resting* one (H9) and never `desiredFov()`, so the aim
     * cannot come across with the camera either.
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
      camera.fov = restFov(next);
      camera.updateProjectionMatrix();
      // A sprint's kick is the previous owner's too: it must not widen the
      // next rig's first frame.
      kick = 0;

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
     * The FOV this owner wants, asserted every frame (H9). One place, so the
     * Shade's setting, the Warden's, and Section 6.2's ADS narrowing cannot
     * disagree — and so a cinematic that put the camera back at
     * `CONFIG.render.fov` on its way out (combat's finisher, the death
     * camera: their contract is to leave nothing behind) is corrected on the
     * first frame the player has the camera again, rather than leaving
     * whoever set a wide FOV looking through the shipped one until the next
     * handover. It was `applyAdsFov()` and only the Warden called it.
     *
     * @param {'freefly'|'shade'|'warden'} human who the human is driving
     */
    applyFov(human) {
      // The sprint kick (D90). `kick` is how far through the ease the lens is,
      // 0..1, walked at `1 / sprintFovEase` a second of WALL time - the same
      // clock the bob and the camera dip keep, so a slow frame does not
      // stretch the quarter second - and shaped by smoothstep, which is flat
      // at both ends so the lens leaves and arrives without a corner. Fixed
      // duration rather than a time constant on purpose: a time constant
      // never arrives, and H9's contract is that the FOV comes back to
      // `restFov` *exactly*, which is what `kick === 0` is.
      const R = CONFIG.render;
      const body = human === 'warden' ? warden : human === 'shade' ? shade : null;
      // An aim wins: the Warden's ADS is the sight picture, and his own
      // `adsBlend` takes the kick out as it narrows rather than adding to it.
      const wants = SETTINGS.sprintFovKick && body !== null
        && body.movementBand === 'sprint' && !(human === 'warden' && warden.ads);
      const step = wallDelta / R.sprintFovEase;
      kick = wants ? Math.min(1, kick + step) : Math.max(0, kick - step);
      const eased = kick * kick * (3 - 2 * kick);
      const lift = human === 'warden' ? eased * (1 - warden.adsBlend) : eased;

      const fov = (human === 'warden' ? warden.desiredFov() : restFov(human)) + R.sprintFovKick * lift;
      // The 0.01 guard keeps a steady frame from rebuilding the matrix, and it
      // would also strand the lens a hair off rest as the kick runs out; at
      // rest the camera is asserted exactly.
      if (Math.abs(camera.fov - fov) > 0.01 || (kick === 0 && camera.fov !== fov)) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },
  };
}
