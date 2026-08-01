/**
 * BLACKLINE — systems/detection.js
 *
 * The two things the Warden can notice: light and sound (Section 7).
 *
 * Layering (Section 3.1): may import from entities, physics and config. It is
 * handed the map and the event emitter by the composition root and never
 * reaches sideways to another system.
 *
 * Three responsibilities, kept in one file because they share the same tick and
 * the same actors:
 *
 *  1. The visibility meter (7.1). Sampled on a 100ms cadence with a hard 5-ray
 *     cap per light, cached between samples, smoothed over 250ms.
 *  2. The Section 4.2 feedback on the Shade. The meter and what the player sees
 *     must never disagree, so both are written from one value in one place.
 *  3. Noise events (7.2), emitted from actor movement into a fixed pool that
 *     expires on the fixed step. No timers.
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';

const D = CONFIG.detection;
const N = CONFIG.noise;
const F = CONFIG.detection.feedback;
const P = CONFIG.palette;

const clamp = (value, low, high) => (value < low ? low : value > high ? high : value);

// ---------------------------------------------------------------------------
// Noise field (Section 7.2)
// ---------------------------------------------------------------------------

/**
 * A fixed pool of noise events. Section 15 forbids `setTimeout`, so lifetime is
 * counted down on the fixed step, and the pool is capped so a stuck emitter
 * cannot grow the array without bound.
 */
export class NoiseField {
  constructor(emitter) {
    this.emitter = emitter;
    /** @type {object[]} */
    this.pool = [];
    for (let i = 0; i < N.maxEvents; i++) {
      this.pool.push({ x: 0, y: 0, z: 0, radius: 0, type: '', source: '', age: 0, active: false });
    }
    this.emitted = 0;
    this.dropped = 0;
  }

  /**
   * Emit a noise event. A zero radius is silence — a crouch-walking Shade and a
   * Shade in a vent make no event at all, rather than an event nobody can hear.
   * @returns {object|null} the pooled event, or null if silent
   */
  emit(x, y, z, radius, type, source) {
    if (!(radius > 0)) return null;

    let slot = null;
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        slot = this.pool[i];
        break;
      }
    }
    if (!slot) {
      // Full: recycle the oldest rather than dropping the newest, so the most
      // recent information always survives.
      slot = this.pool[0];
      for (let i = 1; i < this.pool.length; i++) {
        if (this.pool[i].age > slot.age) slot = this.pool[i];
      }
      this.dropped++;
    }

    slot.x = x;
    slot.y = y;
    slot.z = z;
    slot.radius = radius;
    slot.type = type;
    slot.source = source;
    slot.age = 0;
    slot.active = true;
    this.emitted++;
    // Cross-system messaging goes through the emitter (Section 3.1); audio in
    // Phase 8 and the AI in Phase 6 both listen here.
    if (this.emitter) this.emitter.emit('noise', slot);
    return slot;
  }

  step(dt) {
    for (let i = 0; i < this.pool.length; i++) {
      const event = this.pool[i];
      if (!event.active) continue;
      event.age += dt;
      if (event.age >= N.lifetime) event.active = false;
    }
  }

  get activeCount() {
    let count = 0;
    for (let i = 0; i < this.pool.length; i++) if (this.pool[i].active) count++;
    return count;
  }

  active() {
    return this.pool.filter((event) => event.active);
  }

  /**
   * The AI hearing check (Section 7.2): a distance test against active events.
   * Returns the loudest event audible from `point`, or null.
   */
  heard(point) {
    let best = null;
    let bestRadius = 0;
    for (let i = 0; i < this.pool.length; i++) {
      const event = this.pool[i];
      if (!event.active) continue;
      const dx = event.x - point.x;
      const dy = event.y - point.y;
      const dz = event.z - point.z;
      if (dx * dx + dy * dy + dz * dz > event.radius * event.radius) continue;
      if (event.radius > bestRadius) {
        bestRadius = event.radius;
        best = event;
      }
    }
    return best;
  }

  clear() {
    for (let i = 0; i < this.pool.length; i++) this.pool[i].active = false;
  }
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

export class Detection {
  constructor({ map, emitter }) {
    this.map = map;
    this.collision = map.collision;
    this.emitter = emitter;
    this.noise = new NoiseField(emitter);

    /** Latest sampled value, 0-100. The cache Section 7.1 talks about. */
    this.raw = 0;
    /** What the HUD and the AI read. Never null (Section 15). */
    this.smoothed = 0;
    this.inVent = false;

    this._sampleTimer = 0;
    this._dirty = true;
    /** Instrumentation the AUTO suite reads to prove the sampling budget. */
    this.samples = 0;
    this.raysLastSample = 0;
    this.lightsLastSample = 0;

    this._lastShadeStride = 0;
    this._lastWardenStride = 0;
    this._lastShadeState = null;

    this._origins = [];
    for (let i = 0; i < D.raysPerLight; i++) this._origins.push({ x: 0, y: 0, z: 0 });

    this._baseTeal = new THREE.Color(P.shadeTeal);
    this._baseCharcoal = new THREE.Color(P.shadeCharcoal);
    this._baseRim = new THREE.Color(P.signageTeal);
  }

  // -------------------------------------------------------------------------
  // Cache
  // -------------------------------------------------------------------------

  /**
   * Force the next step to resample instead of reusing the cache.
   * Section 15: "Destroyed light does not update visibility — breaking a light
   * calls an explicit cache invalidate."
   */
  invalidate() {
    this._dirty = true;
  }

  /**
   * The one route by which a light is destroyed. Going through here rather than
   * calling `map.breakLight()` directly is what makes the invalidate impossible
   * to forget, and it emits the 20m noise Section 7.2 assigns to it.
   */
  breakLight(lightId, by) {
    const record = this.map.breakLight(lightId);
    if (!record) return null;
    this.invalidate();
    this.noise.emit(
      record.position.x, record.position.y, record.position.z,
      N.radii.lightDestroyed, 'light-destroyed', by || 'unknown'
    );
    if (this.emitter) this.emitter.emit('light:broken', record);
    return record;
  }

  /** Reinsert and round boundaries must not inherit the previous round's state. */
  reset(shade) {
    this.noise.clear();
    this._lastShadeStride = shade ? shade.strideDistance : 0;
    this._lastWardenStride = 0;
    this._lastShadeState = null;
    this._sampleTimer = 0;
    this._dirty = true;
    if (shade) {
      this.raw = this._sampleVisibility(shade);
      // Seed the smoothed value at spawn so it is never null and never has to
      // ramp up from a lie (Section 15, last row).
      this.smoothed = this.raw;
      this._applyFeedback(shade);
    }
  }

  // -------------------------------------------------------------------------
  // Fixed step
  // -------------------------------------------------------------------------

  step(dt, { shade, warden }) {
    this.noise.step(dt);
    this._emitMovementNoise(shade, warden);

    this._sampleTimer += dt;
    if (shade && (this._dirty || this._sampleTimer >= D.sampleInterval)) {
      this.raw = this._sampleVisibility(shade);
      // Subtract rather than zero, the same accumulator discipline as the fixed
      // step. Zeroing loses the remainder every tick, and since six 1/60 steps
      // fall a float's hair short of 100ms it would silently sample at 8.6Hz.
      this._sampleTimer = this._dirty ? 0 : this._sampleTimer - D.sampleInterval;
      if (this._sampleTimer < 0) this._sampleTimer = 0;
      this._dirty = false;
    }

    // Exponential approach with a 250ms time constant. Framerate independent,
    // and it never overshoots, so the meter cannot flicker past its target.
    const blend = 1 - Math.exp(-dt / D.smoothingTime);
    this.smoothed += (this.raw - this.smoothed) * blend;

    if (shade) this._applyFeedback(shade);
  }

  // -------------------------------------------------------------------------
  // Visibility (Section 7.1)
  // -------------------------------------------------------------------------

  _sampleVisibility(shade) {
    const torsoY = shade.feetY + shade.height * D.torsoHeightRatio;
    const origins = this._torsoOrigins(shade.position.x, torsoY, shade.position.z);

    let sum = 0;
    let rays = 0;
    let lights = 0;

    const active = this.map.activeLights();
    for (let i = 0; i < active.length; i++) {
      const light = active[i];
      const dx = light.position.x - shade.position.x;
      const dy = light.position.y - torsoY;
      const dz = light.position.z - shade.position.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // Only lights within the sampling radius, and never past their own range:
      // beyond that the score term would go negative.
      if (distance > D.lightRadius || distance >= light.range) continue;
      lights++;

      let unobstructed = 0;
      for (let r = 0; r < D.raysPerLight; r++) {
        rays++;
        if (this.collision.lineOfSight(origins[r], light.position)) unobstructed++;
      }
      if (unobstructed === 0) continue;

      sum += light.intensity * (1 - distance / light.range) * (unobstructed / D.raysPerLight);
    }

    this.samples++;
    this.raysLastSample = rays;
    this.lightsLastSample = lights;

    // Section 7.1's formula produces a physical sum (three's intensities are in
    // candela since r155), so scoreScale maps it into the meter's range.
    let score = sum * D.scoreScale + D.ambientFloor;
    if (shade.crouching) score *= D.crouchMultiplier;
    this.inVent = this.isInVent(shade.position);
    if (this.inVent) score *= D.ventMultiplier;

    return clamp(score, D.meterMin, D.meterMax);
  }

  /** Five sample points across the torso, so a light half-blocked reads as half. */
  _torsoOrigins(x, y, z) {
    const s = D.torsoSpread;
    const offsets = [
      [0, 0, 0],
      [-s, 0, 0],
      [s, 0, 0],
      [0, 0, -s],
      [0, 0, s],
    ];
    for (let i = 0; i < D.raysPerLight; i++) {
      const offset = offsets[i % offsets.length];
      const origin = this._origins[i];
      origin.x = x + offset[0];
      origin.y = y + offset[1];
      origin.z = z + offset[2];
    }
    return this._origins;
  }

  /** Vents are unlit and silent regardless of what is outside them (Section 5). */
  isInVent(point) {
    const vents = this.map.vents;
    for (let i = 0; i < vents.length; i++) {
      const vent = vents[i];
      if (point.x < vent.min.x || point.x > vent.max.x) continue;
      if (point.z < vent.min.z || point.z > vent.max.z) continue;
      if (point.y < vent.min.y || point.y > vent.max.y) continue;
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Section 4.2 — feedback that cannot disagree with the meter
  // -------------------------------------------------------------------------

  /**
   * "If the meter reads hidden while the character looks brightly lit, the
   * player will stop trusting the mechanic and the entire stealth loop fails."
   *
   * Both readouts are therefore written from `this.smoothed` in this one
   * function, on the Shade only. At 0 the body sits at `silhouetteDarkness` of
   * its palette colour with a faint teal edge; at 100 it is fully lit with a
   * bright rim.
   */
  _applyFeedback(shade) {
    const materials = shade.mesh && shade.mesh.userData ? shade.mesh.userData.materials : null;
    if (!materials) return;

    const t = clamp(this.smoothed / D.meterMax, 0, 1);
    this.litFraction = t;

    const body = F.silhouetteDarkness + (1 - F.silhouetteDarkness) * t;
    materials.teal.color.copy(this._baseTeal).multiplyScalar(body);
    materials.charcoal.color.copy(this._baseCharcoal).multiplyScalar(body);

    const rim = F.rimMin + (F.rimMax - F.rimMin) * t;
    materials.outline.color.copy(this._baseRim).multiplyScalar(rim);
  }

  // -------------------------------------------------------------------------
  // Noise emitters (Section 7.2)
  // -------------------------------------------------------------------------

  _emitMovementNoise(shade, warden) {
    if (shade) this._emitShadeNoise(shade);
    if (warden) this._emitWardenNoise(warden);
  }

  _emitShadeNoise(shade) {
    // A reset rewinds the odometer; follow it rather than emitting a burst.
    if (shade.strideDistance < this._lastShadeStride) this._lastShadeStride = shade.strideDistance;

    const silent = this.isInVent(shade.position);

    // Landing (Section 7.2: falls over 2m). Read in the same fixed step the
    // controller sets it, because it clears the flag at the top of the next.
    if (shade.landedFallHeight > CONFIG.shade.landingNoiseFallHeight) {
      this.noise.emit(
        shade.position.x, shade.feetY, shade.position.z,
        silent ? N.radii.shadeVent : N.radii.shadeLanding, 'landing', 'shade'
      );
    }

    // Slide, on entry only, not once per step for its whole 0.8s.
    if (shade.state === 'slide' && this._lastShadeState !== 'slide') {
      this.noise.emit(
        shade.position.x, shade.feetY, shade.position.z,
        silent ? N.radii.shadeVent : N.radii.shadeSlide, 'slide', 'shade'
      );
    }
    this._lastShadeState = shade.state;

    if (!shade.grounded) return;
    const band = shade.movementBand;
    if (band === 'still') return;

    const stride =
      band === 'crouch' ? CONFIG.shade.crouchFootstepStride
        : band === 'sprint' ? CONFIG.shade.sprintFootstepStride
          : CONFIG.shade.footstepStride;

    if (shade.strideDistance - this._lastShadeStride < stride) return;
    this._lastShadeStride = shade.strideDistance;

    const radius = silent
      ? N.radii.shadeVent
      : band === 'crouch' ? N.radii.shadeCrouchWalk
        : band === 'sprint' ? N.radii.shadeSprint
          : N.radii.shadeWalk;
    this.noise.emit(shade.position.x, shade.feetY, shade.position.z, radius, 'footstep', 'shade');
  }

  _emitWardenNoise(warden) {
    if (warden.strideDistance < this._lastWardenStride) this._lastWardenStride = warden.strideDistance;
    if (!warden.grounded) return;

    const sprinting = warden.speed > CONFIG.warden.walkSpeed + 0.5;
    const stride = sprinting ? CONFIG.warden.sprintFootstepStride : CONFIG.warden.footstepStride;
    if (warden.speed < 0.15) return;
    if (warden.strideDistance - this._lastWardenStride < stride) return;
    this._lastWardenStride = warden.strideDistance;

    this.noise.emit(
      warden.position.x, warden.feetY, warden.position.z,
      sprinting ? N.radii.wardenSprint : N.radii.wardenWalk, 'footstep', 'warden'
    );
  }
}

export function createDetection(options) {
  return new Detection(options);
}
