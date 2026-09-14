/**
 * BLACKLINE — entities/agentslide.js
 *
 * The Shade's slide (Section 6.1): from sprint plus crouch, 8.0 m/s decaying
 * over 0.8s, the capsule lowered to vent height. Entry is decided in
 * `_stepGround()` (agent.js), where the order of the crouch edge and the held
 * crouch matters; what happens once it is entered is here.
 *
 * Methods of `Shade`, kept in their own file (F3, and the ~600-line guidance
 * agent.js met when B8 gave the landing its weight). agent.js installs them
 * on the prototype, so `this` is the Shade and every field keeps its name.
 */

import { CONFIG } from '../config.js';
import { applyGravity } from '../physics.js';
import { SHADE_STATE } from './agentstate.js';

const S = CONFIG.shade;

export const SLIDE = {
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
  },

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
  },
};
