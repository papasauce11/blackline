/**
 * BLACKLINE — systems/gadgets.js
 *
 * All six gadgets, and the one registry that owns every timed effect
 * (Section 9).
 *
 * Layering (Section 3.1): imports physics and config. The map, the emitter and
 * the sibling systems it needs are handed in by the composition root, never
 * imported — Section 3.1 forbids a system importing a system.
 *
 * The rule this file exists to enforce: **no `setTimeout` for anything that
 * affects gameplay** (Section 9, and the risk register). Every effect is an
 * object with an elapsed time and a duration, ticked from the one fixed step.
 * Nothing schedules itself, so nothing can outlive a round, fire during a
 * pause, or stack invisibly.
 *
 * Other systems do not reach in here either. They ask questions —
 * `blocksSight()`, `aiBlinded()`, `shadeSpeedMultiplier()` — and this file
 * answers from the live effect list.
 */

import { CONFIG, rng } from '../config.js';

const GA = CONFIG.gadgets;
const N = CONFIG.noise;

export const GADGET = {
  SMOKE: 'smoke',
  FLASHBANG: 'flashbang',
  TASER: 'taser',
  STUN: 'stunGrenade',
  FRAG: 'frag',
  ALARM: 'alarmCamera',
};

/** Thrown types travel; the taser and the camera do not. */
const THROWN = [GADGET.SMOKE, GADGET.FLASHBANG, GADGET.STUN, GADGET.FRAG];

// ---------------------------------------------------------------------------
// Effect registry (Section 9, Section 15)
// ---------------------------------------------------------------------------

/**
 * One list, ticked once per fixed step. An effect is plain data: no closures
 * holding references alive, no timers, nothing that can fire twice.
 */
export class EffectRegistry {
  constructor() {
    this.effects = [];
    this.spawned = 0;
  }

  add(effect) {
    effect.elapsed = 0;
    effect.dead = false;
    this.effects.push(effect);
    this.spawned++;
    return effect;
  }

  step(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.elapsed += dt;
      if (effect.elapsed >= effect.duration) effect.dead = true;
      if (effect.dead) this.effects.splice(i, 1);
    }
  }

  /** Section 17: the overlay reports this, and it must return to 0 when idle. */
  get count() {
    return this.effects.length;
  }

  of(type) {
    return this.effects.filter((effect) => effect.type === type);
  }

  clear() {
    this.effects.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Thrown projectiles
// ---------------------------------------------------------------------------

/**
 * A grenade in flight. Integrated on the fixed step and swept against the world
 * between its previous and current position every step, which is the Section 9
 * and Section 15 requirement: a fast grenade must not tunnel through a wall.
 */
class Projectile {
  constructor(type, position, direction, owner) {
    const T = GA.throw;
    this.type = type;
    this.owner = owner;
    this.x = position.x;
    this.y = position.y;
    this.z = position.z;
    this.px = this.x;
    this.py = this.y;
    this.pz = this.z;
    this.vx = direction.x * T.speed;
    this.vy = direction.y * T.speed + T.speed * T.upBias;
    this.vz = direction.z * T.speed;
    this.fuse = T.fuse;
    this.resting = false;
    this.bounces = 0;
  }

  step(dt, collision) {
    const T = GA.throw;
    this.fuse -= dt;
    if (this.resting) return;

    this.px = this.x;
    this.py = this.y;
    this.pz = this.z;

    this.vy += T.gravity * dt;
    let nx = this.x + this.vx * dt;
    let ny = this.y + this.vy * dt;
    let nz = this.z + this.vz * dt;

    // Sweep the segment actually travelled. A grenade at throw speed covers
    // more than a wall's thickness in one step, so testing only the endpoint
    // would let it pass straight through.
    const dx = nx - this.x;
    const dy = ny - this.y;
    const dz = nz - this.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distance > 1e-6) {
      const inv = 1 / distance;
      const hit = collision.raycast(
        { x: this.x, y: this.y, z: this.z },
        { x: dx * inv, y: dy * inv, z: dz * inv },
        distance + T.radius
      );
      if (hit) {
        // Land just off the surface and reflect what is left of the velocity.
        nx = hit.x + hit.nx * T.radius;
        ny = hit.y + hit.ny * T.radius;
        nz = hit.z + hit.nz * T.radius;
        const dot = this.vx * hit.nx + this.vy * hit.ny + this.vz * hit.nz;
        this.vx = (this.vx - 2 * dot * hit.nx) * T.restitution;
        this.vy = (this.vy - 2 * dot * hit.ny) * T.restitution;
        this.vz = (this.vz - 2 * dot * hit.nz) * T.restitution;
        // Friction along the surface, so it skids rather than skating.
        this.vx *= T.friction;
        this.vz *= T.friction;
        this.bounces++;
      }
    }

    this.x = nx;
    this.y = ny;
    this.z = nz;

    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy + this.vz * this.vz);
    if (speed < T.sleepSpeed && this.bounces > 0) {
      this.resting = true;
      this.vx = 0;
      this.vy = 0;
      this.vz = 0;
    }
  }
}

// ---------------------------------------------------------------------------
// Gadgets
// ---------------------------------------------------------------------------

export class Gadgets {
  /**
   * @param {object} options
   * @param {import('../map.js').GameMap} options.map
   * @param {object} options.emitter
   * @param {import('./detection.js').Detection} options.detection
   */
  constructor({ map, emitter, detection }) {
    this.map = map;
    this.collision = map.collision;
    this.emitter = emitter;
    this.detection = detection;

    this.effects = new EffectRegistry();
    this.projectiles = [];
    this.loadout = null;
    this.taserCharge = 0;
    this.alarm = null;
    this.reset();
  }

  /**
   * Section 10.2: reinsert restores health but does NOT refill gadgets, and the
   * taser recharge keeps running. So a round reset and a reinsert are different
   * things, and only the round reset comes through here.
   */
  reset() {
    this.effects.clear();
    this.projectiles.length = 0;
    this.loadout = {
      smoke: GA.smoke.count,
      flashbang: GA.flashbang.count,
      stunGrenade: GA.stunGrenade.count,
      frag: GA.frag.count,
      alarmCamera: GA.alarmCamera.count,
    };
    this.taserCharge = GA.taser.charges;
    this.taserRecharge = 0;
    this.alarm = null;
    this.shadeMarkedFor = 0;
  }

  // -------------------------------------------------------------------------
  // Fixed step
  // -------------------------------------------------------------------------

  step(dt, { shade, warden }) {
    this.effects.step(dt);

    if (this.taserCharge < GA.taser.charges) {
      this.taserRecharge += dt;
      if (this.taserRecharge >= GA.taser.rechargeTime) {
        this.taserCharge = GA.taser.charges;
        this.taserRecharge = 0;
      }
    }
    if (this.shadeMarkedFor > 0) this.shadeMarkedFor -= dt;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      projectile.step(dt, this.collision);
      if (projectile.fuse > 0) continue;
      this.projectiles.splice(i, 1);
      this._detonate(projectile, shade, warden);
    }

    this._stepAlarm(dt, shade);
  }

  // -------------------------------------------------------------------------
  // Throwing
  // -------------------------------------------------------------------------

  /**
   * @returns {Projectile|null} null when the loadout is empty, which is what
   * makes not refilling on reinsert (Section 10.2) actually bite.
   */
  throwGadget(type, from, direction, owner) {
    if (THROWN.indexOf(type) === -1) return null;
    if (this.loadout[type] <= 0) return null;
    this.loadout[type]--;
    const projectile = new Projectile(type, from, direction, owner);
    this.projectiles.push(projectile);
    this.emitter.emit('gadget:thrown', { type, owner });
    return projectile;
  }

  _detonate(projectile, shade, warden) {
    const at = { x: projectile.x, y: projectile.y, z: projectile.z };
    this.emitter.emit('gadget:detonate', { type: projectile.type, at });
    this.detection.noise.emit(
      at.x, at.y, at.z, N.radii.gadgetDetonation, projectile.type, projectile.owner
    );

    switch (projectile.type) {
      case GADGET.SMOKE:
        this.effects.add({
          type: GADGET.SMOKE, at, radius: GA.smoke.radius, duration: GA.smoke.duration,
        });
        break;

      case GADGET.FLASHBANG: {
        // Section 9.1: the AI is hard-blinded only if it actually had line of
        // sight to the detonation. A flashbang round a corner does nothing,
        // which is what makes placing it a skill.
        const eye = warden ? { x: warden.position.x, y: warden.eyeY, z: warden.position.z } : null;
        const sawIt = eye
          && this._distance(eye, at) <= GA.flashbang.radius
          && this.collision.lineOfSight(eye, at);
        const playerEye = shade
          ? { x: shade.position.x, y: shade.feetY + shade.height * 0.9, z: shade.position.z }
          : null;
        const playerSawIt = playerEye
          && this._distance(playerEye, at) <= GA.flashbang.radius
          && this.collision.lineOfSight(playerEye, at);
        this.effects.add({
          type: GADGET.FLASHBANG, at, duration: GA.flashbang.duration,
          blindsAI: !!sawIt, blindsPlayer: !!playerSawIt,
        });
        break;
      }

      case GADGET.STUN:
        // Non-lethal (Section 9.2): slows the Shade, never damages it.
        if (shade && this._distance(shade.position, at) <= GA.stunGrenade.radius) {
          this.effects.add({
            type: GADGET.STUN, at, duration: GA.stunGrenade.duration,
            multiplier: GA.stunGrenade.speedMultiplier,
          });
        }
        break;

      case GADGET.FRAG: {
        if (!shade) break;
        const distance = this._distance(shade.position, at);
        if (distance > GA.frag.radius) break;
        let damage = GA.frag.damageCentre * (1 - distance / GA.frag.radius);
        const torso = {
          x: shade.position.x,
          y: shade.feetY + shade.height * CONFIG.detection.torsoHeightRatio,
          z: shade.position.z,
        };
        if (!this.collision.lineOfSight(torso, at)) damage *= GA.frag.noLineOfSightMultiplier;
        this.emitter.emit('gadget:damage', { target: 'shade', amount: damage, source: GADGET.FRAG });
        break;
      }

      default:
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Taser (Section 9.1)
  // -------------------------------------------------------------------------

  /**
   * 6m, needs line of sight, stuns the Warden for 3s, and permanently destroys
   * a targeted light. Light destruction goes through detection so the
   * visibility cache invalidate cannot be skipped (Section 15).
   *
   * @returns {'warden'|'light'|null} what it hit
   */
  fireTaser(shade, warden, aimDirection) {
    if (this.taserCharge <= 0) return null;
    const origin = {
      x: shade.position.x,
      y: shade.feetY + shade.height * CONFIG.detection.torsoHeightRatio,
      z: shade.position.z,
    };
    const cone = Math.cos((GA.taser.aimConeDegrees * Math.PI) / 180);

    // The Warden first: a taser is for people, and lights are the fallback.
    if (warden && warden.health > 0) {
      const target = { x: warden.position.x, y: warden.eyeY, z: warden.position.z };
      if (this._inCone(origin, aimDirection, target, GA.taser.range, cone)
        && this.collision.lineOfSight(origin, target)) {
        this.taserCharge--;
        this.taserRecharge = 0;
        warden.stun(GA.taser.stunDuration);
        this.emitter.emit('gadget:taser', { hit: 'warden' });
        return 'warden';
      }
    }

    if (GA.taser.destroysLights) {
      for (const light of this.map.activeLights()) {
        if (!this._inCone(origin, aimDirection, light.position, GA.taser.range, cone)) continue;
        if (!this.collision.lineOfSight(origin, light.position)) continue;
        this.taserCharge--;
        this.taserRecharge = 0;
        this.detection.breakLight(light.lightId, 'shade');
        this.emitter.emit('gadget:taser', { hit: 'light', lightId: light.lightId });
        return 'light';
      }
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Alarm camera (Section 9.2)
  // -------------------------------------------------------------------------

  /**
   * A proximity alarm, not a second viewport. Section 9.2 is explicit that it
   * renders no live feed, so there is no camera, no render target and no second
   * draw of the scene here — only a cone test.
   */
  placeAlarm(position, yaw) {
    if (this.loadout.alarmCamera <= 0) return null;
    this.loadout.alarmCamera--;
    this.alarm = {
      x: position.x, y: position.y, z: position.z, yaw,
      health: GA.alarmCamera.health, cooldown: 0,
    };
    this.emitter.emit('gadget:alarm-placed', { at: { ...this.alarm } });
    return this.alarm;
  }

  destroyAlarm(by) {
    if (!this.alarm) return false;
    this.alarm = null;
    this.emitter.emit('gadget:alarm-destroyed', { by });
    return true;
  }

  _stepAlarm(dt, shade) {
    const alarm = this.alarm;
    if (!alarm || !shade || shade.health <= 0) return;
    if (alarm.cooldown > 0) alarm.cooldown -= dt;

    const target = {
      x: shade.position.x,
      y: shade.feetY + shade.height * CONFIG.detection.torsoHeightRatio,
      z: shade.position.z,
    };
    const forward = { x: -Math.sin(alarm.yaw), y: 0, z: -Math.cos(alarm.yaw) };
    const cone = Math.cos((GA.alarmCamera.coneDegrees * Math.PI) / 360);
    if (!this._inCone(alarm, forward, target, GA.alarmCamera.radius, cone)) return;
    if (!this.collision.lineOfSight(alarm, target)) return;

    this.shadeMarkedFor = GA.alarmCamera.markDuration;
    if (alarm.cooldown > 0) return;
    alarm.cooldown = GA.alarmCamera.retriggerInterval;
    this.detection.noise.emit(alarm.x, alarm.y, alarm.z, N.radii.gunfire * 0.5, 'alarm', 'alarm');
    this.emitter.emit('gadget:alarm', { at: { x: alarm.x, y: alarm.y, z: alarm.z } });
  }

  // -------------------------------------------------------------------------
  // Questions other systems ask. They never reach into the effect list.
  // -------------------------------------------------------------------------

  /** Section 9.1: smoke blocks AI line of sight entirely. */
  blocksSight(from, to) {
    const clouds = this.effects.of(GADGET.SMOKE);
    for (let i = 0; i < clouds.length; i++) {
      if (this._segmentHitsSphere(from, to, clouds[i].at, clouds[i].radius)) return true;
    }
    return false;
  }

  /** Section 9.1: AI perception is hard-disabled while a seen flash lasts. */
  aiBlinded() {
    const flashes = this.effects.of(GADGET.FLASHBANG);
    for (let i = 0; i < flashes.length; i++) if (flashes[i].blindsAI) return true;
    return false;
  }

  /** Screen whiteout, read by the HUD. */
  playerBlindFraction() {
    const flashes = this.effects.of(GADGET.FLASHBANG);
    let worst = 0;
    for (const flash of flashes) {
      if (!flash.blindsPlayer) continue;
      const remaining = 1 - flash.elapsed / flash.duration;
      worst = Math.max(worst, remaining);
    }
    return worst;
  }

  /** Section 9.2: a stun grenade slows the Shade to 40%, never damages it. */
  shadeSpeedMultiplier() {
    let multiplier = 1;
    for (const effect of this.effects.of(GADGET.STUN)) {
      multiplier = Math.min(multiplier, effect.multiplier);
    }
    return multiplier;
  }

  get shadeMarked() {
    return this.shadeMarkedFor > 0;
  }

  // -------------------------------------------------------------------------
  // Geometry helpers
  // -------------------------------------------------------------------------

  _distance(a, b) {
    const dx = a.x - b.x;
    const dy = (a.y || 0) - (b.y || 0);
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  _inCone(origin, forward, target, range, cosHalfAngle) {
    const dx = target.x - origin.x;
    const dy = (target.y || 0) - (origin.y || 0);
    const dz = target.z - origin.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distance > range || distance < 1e-6) return distance <= range;
    const dot = (dx * forward.x + dy * (forward.y || 0) + dz * forward.z) / distance;
    return dot >= cosHalfAngle;
  }

  /** Does the segment from->to pass within `radius` of `centre`? */
  _segmentHitsSphere(from, to, centre, radius) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const lengthSq = dx * dx + dy * dy + dz * dz;
    const fx = from.x - centre.x;
    const fy = from.y - centre.y;
    const fz = from.z - centre.z;
    if (lengthSq < 1e-9) return fx * fx + fy * fy + fz * fz <= radius * radius;
    let t = -(fx * dx + fy * dy + fz * dz) / lengthSq;
    t = Math.max(0, Math.min(1, t));
    const cx = fx + dx * t;
    const cy = fy + dy * t;
    const cz = fz + dz * t;
    return cx * cx + cy * cy + cz * cz <= radius * radius;
  }
}

export function createGadgets(options) {
  return new Gadgets(options);
}
