/**
 * BLACKLINE — systems/gadgeteffects.js
 *
 * The two things every gadget is made of: a timed effect in the one registry
 * that owns all of them, and a grenade in flight. Split out of gadgets.js
 * (F3), which decides what the effects *do*; this file only keeps time and
 * integrates.
 *
 * The rule (Section 9, and the risk register): **no `setTimeout` for anything
 * that affects gameplay**. Every effect is an object with an elapsed time and
 * a duration, ticked from the one fixed step. Nothing schedules itself, so
 * nothing can outlive a round, fire during a pause, or stack invisibly.
 */

import { CONFIG } from '../config.js';

const GA = CONFIG.gadgets;

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
export class Projectile {
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
