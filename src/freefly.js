/**
 * BLACKLINE — freefly.js
 *
 * The debug flycam.
 *
 * Built as the Phase 2 exit gate ("freefly the whole map, every usable ledge
 * marked") and kept because it is still the only way to inspect the level
 * without playing it. Disabled by default; re-enable from the console with
 * `BLACKLINE.freefly.enabled = true`.
 *
 * Layering (Section 3.1): imports config only, like input.js. It MOVES the one
 * camera object the composition root owns; it never creates another, which is
 * the risk-register rule.
 */

import { CONFIG } from './config.js';

export class Freefly {
  /**
   * @param {import('./input.js').Input} input
   * @param {{x:number,y:number,z:number}} start
   */
  constructor(input, start) {
    this.input = input;
    this.enabled = false;
    this.yaw = Math.PI;
    this.pitch = -0.15;
    this.speed = CONFIG.shade.walkSpeed * 2;
    this.position = { x: start.x, y: start.y, z: start.z };
  }

  /** Place the camera somewhere, e.g. a spawn point, at eye height. */
  moveTo(x, y, z) {
    this.position.x = x;
    this.position.y = y;
    this.position.z = z;
  }

  look() {
    if (!this.enabled || !this.input.locked) return;
    const delta = this.input.lookDelta();
    this.yaw += delta.yaw;
    this.pitch = Math.max(
      CONFIG.shade.camera.pitchMin,
      Math.min(CONFIG.shade.camera.pitchMax, this.pitch + delta.pitch)
    );
  }

  step(dt) {
    if (!this.enabled) return;
    const input = this.input;
    const forward = input.axis('back', 'forward');
    const strafe = input.axis('left', 'right');
    const lift = (input.down('jump') ? 1 : 0) - (input.down('crouch') ? 1 : 0);
    const speed = this.speed * (input.down('sprint') ? 3 : 1);

    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);

    // Forward follows the aim so you can fly up to a catwalk to inspect it.
    const fx = -sinYaw * cosPitch;
    const fy = sinPitch;
    const fz = -cosYaw * cosPitch;
    const rx = cosYaw;
    const rz = -sinYaw;

    this.position.x += (fx * forward + rx * strafe) * speed * dt;
    this.position.y += (fy * forward + lift) * speed * dt;
    this.position.z += (fz * forward + rz * strafe) * speed * dt;
  }

  /** @param {import('three').PerspectiveCamera} camera the ONE camera */
  apply(camera) {
    if (!this.enabled) return;
    camera.position.set(this.position.x, this.position.y, this.position.z);
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
