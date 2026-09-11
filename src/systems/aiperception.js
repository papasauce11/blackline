/**
 * BLACKLINE — systems/aiperception.js
 *
 * The Warden's senses (Section 11): sight through a cone and a line-of-sight
 * test, filling the 0-100 accumulator against the visibility meter; hearing
 * against the noise field; the alarm camera's mark arriving as knowledge. It
 * moves the state machine only through `_enter` / `_enterInvestigate`, which
 * ai.js owns.
 *
 * Methods of `WardenAI`, kept in their own file (F3). ai.js installs them on
 * the prototype, so `this` is the AI and every field keeps its name.
 */

import { CONFIG } from '../config.js';
import { A, AI_STATE, angleDelta } from './aistate.js';

export const PERCEPTION = {
  _perceive(dt, shade) {
    const warden = this.warden;
    const previouslySaw = this.sees;
    this.sees = false;

    if (shade && shade.health > 0) {
      const eye = this._scratch;
      eye.x = warden.position.x;
      eye.y = warden.eyeY;
      eye.z = warden.position.z;

      const torso = {
        x: shade.position.x,
        y: shade.feetY + shade.height * CONFIG.detection.torsoHeightRatio,
        z: shade.position.z,
      };
      const dx = torso.x - eye.x;
      const dy = torso.y - eye.y;
      const dz = torso.z - eye.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance <= A.viewRange) {
        // 90 degree cone about the facing direction, measured flat: pitch
        // should not let the Warden lose someone by looking at the floor.
        // Forward is (-sin yaw, -cos yaw), so the bearing of a point in that
        // same form is atan2(-dx, -dz) and the facing bearing is yaw itself.
        const toTarget = Math.atan2(-dx, -dz);
        const off = Math.abs(angleDelta(warden.yaw, toTarget));
        if (off <= (A.fovDegrees * Math.PI) / 360) {
          // Section 9.1: smoke blocks the line entirely, and a flashbang it
          // actually saw disables perception outright for the duration.
          const blinded = this.gadgets && this.gadgets.aiBlinded();
          const smoked = this.gadgets && this.gadgets.blocksSight(eye, torso);
          if (!blinded && !smoked && this.map.collision.lineOfSight(eye, torso)) this.sees = true;
        }
      }

      if (this.sees) {
        // Reaction delay (Section 11 difficulty): a Warden that has just laid
        // eyes on the Shade does not begin accumulating instantly.
        if (!previouslySaw) this._reactionTimer = this.difficulty.reactionDelay;
        this._reactionTimer -= dt;

        this.lastKnown = { x: torso.x, y: shade.feetY, z: torso.z };
        this._lostTimer = 0;

        if (this._reactionTimer <= 0) {
          const visibility = this.detection ? this.detection.smoothed : CONFIG.detection.meterMax;
          const movement = A.movementMultiplier[shade.movementBand] || 1;
          const fill =
            this.difficulty.fillRate *
            (visibility / CONFIG.detection.meterMax) *
            (1 - distance / A.viewRange) *
            movement;
          this.accumulator += fill * dt;
        }
      }
    }

    if (!this.sees) {
      this.accumulator -= A.drainRate * dt;
      this._lostTimer += dt;
    }
    this.accumulator = Math.max(0, Math.min(A.accumulatorMax, this.accumulator));

    // Hearing is a distance test against live noise events (Section 7.2). The
    // Warden ignores its own footsteps, or it would investigate itself.
    if (this.detection && this.state !== AI_STATE.ENGAGE && this.state !== AI_STATE.DEFEND) {
      const heard = this.detection.noise.heard(warden.position);
      if (heard && heard.source !== 'warden') {
        this.lastKnown = { x: heard.x, y: heard.y, z: heard.z };
        if (this.state === AI_STATE.PATROL) this._enter(AI_STATE.SUSPICIOUS);
      }
    }

    // Section 9.2: the alarm camera marks the Shade "on the Warden's HUD for
    // 2s". In competitive the Warden is this, and it has no HUD — so the mark
    // arrives as knowledge instead. A camera trip is a confirmed sighting by a
    // device, not a noise, so it goes straight to INVESTIGATE rather than
    // through SUSPICIOUS: there is nothing to turn around and wonder about.
    if (this.gadgets && this.gadgets.shadeMarked && this.gadgets.shadeMarkedAt && !this.sees) {
      const marked = this.gadgets.shadeMarkedAt;
      this.lastKnown = { x: marked.x, y: marked.y, z: marked.z };
      if (this.state === AI_STATE.PATROL || this.state === AI_STATE.SUSPICIOUS) {
        this._enterInvestigate();
      }
    }

    // Section 11 thresholds. Engage wins over everything short of a stun.
    if (this.accumulator >= A.engageThreshold && this.state !== AI_STATE.ENGAGE) {
      this._enter(AI_STATE.ENGAGE);
    } else if (
      this.accumulator > A.suspicionThreshold &&
      (this.state === AI_STATE.PATROL || this.state === AI_STATE.SUSPICIOUS)
    ) {
      this._enterInvestigate();
    }
  }
};
