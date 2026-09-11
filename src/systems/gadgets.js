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
 * answers from the live effect list. The registry itself and the grenade in
 * flight are `gadgeteffects.js` (F3).
 */

import { CONFIG, rng } from '../config.js';
import { EffectRegistry, Projectile } from './gadgeteffects.js';

export { EffectRegistry } from './gadgeteffects.js';

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
    this._unsubscribe = [];
    this._subscribeToCombat();

    this.effects = new EffectRegistry();
    this.projectiles = [];
    this.loadout = null;
    this.taserCharge = 0;
    this.alarm = null;
    /**
     * Section 12: free-roam has "unlimited ammo and gadgets, instant recharge".
     * A flag rather than a second Gadgets implementation, so every throw, every
     * taser shot and every effect still runs the one code path.
     */
    this.unlimited = false;
    this.reset();
  }

  /**
   * Section 9.2: the alarm camera is "destructible by gunfire, taser, or
   * knife". Two of those three live in combat, which this file may not import
   * and which may not import this one (Section 3.1) — so combat announces the
   * geometry of every shot and every swing, and the alarm tests itself against
   * them. Ownership of what an alarm camera is stays in one file.
   */
  _subscribeToCombat() {
    if (!this.emitter) return;
    const on = (event, handler) => this._unsubscribe.push(this.emitter.on(event, handler));

    on('combat:shot', (event) => {
      if (!this.alarm || !event.origin || !event.direction) return;
      if (this._rayHitsAlarm(event.origin, event.direction, CONFIG.combat.gun.range)) {
        this.destroyAlarm('gunfire');
      }
    });

    on('combat:knife', (event) => {
      if (!this.alarm || !event.origin || !event.direction) return;
      // A swing is a short arc, not a ray: anything inside the blade's reach
      // and roughly in front of the swinger is cut.
      if (this._inCone(event.origin, event.direction, this.alarm, event.range, 0)) {
        if (this.collision.lineOfSight(event.origin, this.alarm)) this.destroyAlarm('knife');
      }
    });
  }

  dispose() {
    for (const off of this._unsubscribe) off();
    this._unsubscribe.length = 0;
  }

  /**
   * Does a shot reach the alarm before it reaches the wall behind it? The
   * fixture is small, so it is treated as a sphere rather than as a box.
   */
  _rayHitsAlarm(origin, direction, range) {
    const alarm = this.alarm;
    const dx = alarm.x - origin.x;
    const dy = alarm.y - origin.y;
    const dz = alarm.z - origin.z;
    const along = dx * direction.x + dy * direction.y + dz * direction.z;
    if (along < 0 || along > range) return false;
    const cx = dx - direction.x * along;
    const cy = dy - direction.y * along;
    const cz = dz - direction.z * along;
    const radius = GA.alarmCamera.hitRadius;
    if (cx * cx + cy * cy + cz * cz > radius * radius) return false;
    // The camera sits ON a wall, so a world raycast stops at that same wall.
    // Only a shot that arrives in front of the surface counts.
    const world = this.collision.raycast(origin, direction, range);
    return !world || world.distance >= along - radius;
  }

  /** Set by the composition root from the match mode. */
  setUnlimited(value) {
    this.unlimited = !!value;
    if (this.unlimited) {
      this.taserCharge = GA.taser.charges;
      this.taserRecharge = 0;
    }
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
    this.shadeMarkedAt = null;
  }

  // -------------------------------------------------------------------------
  // Fixed step
  // -------------------------------------------------------------------------

  step(dt, { shade, warden }) {
    this.effects.step(dt);

    if (this.taserCharge < GA.taser.charges) {
      // Section 12: instant recharge in free-roam. Same accumulator, zero wait.
      this.taserRecharge += this.unlimited ? GA.taser.rechargeTime : dt;
      if (this.taserRecharge >= GA.taser.rechargeTime) {
        this.taserCharge = GA.taser.charges;
        this.taserRecharge = 0;
      }
    }
    if (this.shadeMarkedFor > 0) {
      this.shadeMarkedFor -= dt;
      if (this.shadeMarkedFor <= 0) this.shadeMarkedAt = null;
    }

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
    if (this.loadout[type] <= 0 && !this.unlimited) return null;
    if (!this.unlimited) this.loadout[type]--;
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
  _spendTaser() {
    // Free-roam keeps the charge (Section 12); the recharge accumulator is
    // still zeroed so the HUD ring reads full rather than mid-sweep.
    if (!this.unlimited) this.taserCharge--;
    this.taserRecharge = 0;
  }

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
        this._spendTaser();
        warden.stun(GA.taser.stunDuration);
        this.emitter.emit('gadget:taser', { hit: 'warden' });
        return 'warden';
      }
    }

    // Section 9.2: the alarm camera is destructible by the taser too. Ahead of
    // the lights, because an alarm is something you aim at deliberately.
    if (this.alarm
      && this._inCone(origin, aimDirection, this.alarm, GA.taser.range, cone)
      && this.collision.lineOfSight(origin, this.alarm)) {
      this._spendTaser();
      this.destroyAlarm('taser');
      this.emitter.emit('gadget:taser', { hit: 'alarm' });
      return 'alarm';
    }

    if (GA.taser.destroysLights) {
      for (const light of this.map.activeLights()) {
        if (!this._inCone(origin, aimDirection, light.position, GA.taser.range, cone)) continue;
        if (!this.collision.lineOfSight(origin, light.position)) continue;
        this._spendTaser();
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
  /**
   * Find a wall along `direction` and hang the camera on it, facing back out.
   *
   * Section 9.2 says "placed on a wall", and there is exactly one way to do
   * that — the free-roam human on slot 3 and the AI both come through here, so
   * a camera the AI places is a camera a player could have placed.
   *
   * @returns {object|null} the alarm, or null if there is no wall in reach
   */
  placeAlarmOnWall(origin, direction) {
    const C = GA.alarmCamera;
    const surface = this.collision.raycast(origin, direction, C.placeRange);
    // A floor or a ceiling is not a wall.
    if (!surface || Math.abs(surface.ny) > 0.5) return null;
    return this.placeAlarm(
      {
        x: surface.x + surface.nx * C.surfaceOffset,
        y: surface.y + surface.ny * C.surfaceOffset,
        z: surface.z + surface.nz * C.surfaceOffset,
      },
      Math.atan2(-surface.nx, -surface.nz)
    );
  }

  placeAlarm(position, yaw) {
    if (this.loadout.alarmCamera <= 0 && !this.unlimited) return null;
    if (!this.unlimited) this.loadout.alarmCamera--;
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
    // Where the Shade was when it tripped. Section 9.2 marks it "on the
    // Warden's HUD" — in competitive the Warden is the AI and has no HUD, so
    // this is the same information in the form it can use.
    this.shadeMarkedAt = { x: target.x, y: shade.feetY, z: target.z };
    if (alarm.cooldown > 0) return;
    alarm.cooldown = GA.alarmCamera.retriggerInterval;
    this.detection.noise.emit(alarm.x, alarm.y, alarm.z, N.radii.gunfire * 0.5, 'alarm', 'alarm');
    this.emitter.emit('gadget:alarm', {
      at: { x: alarm.x, y: alarm.y, z: alarm.z },
      shadeAt: { ...this.shadeMarkedAt },
    });
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
