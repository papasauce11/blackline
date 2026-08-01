/**
 * BLACKLINE — systems/combat.js
 *
 * Hitscan, damage, the knife, death and the takedown finisher (Section 8).
 *
 * Layering (Section 3.1): imports entities, physics and config. The map, the
 * emitter, the camera and the two callbacks the finisher needs are handed in.
 *
 * Section 8.3's hard safety requirement drives the shape of this file: the
 * finisher is a state with a **wall-clock** timeout, and on expiry it force
 * restores the camera, the FOV, the time scale and input regardless of how far
 * the animation got. The cinematic must never own the only path back to normal
 * play, so `_restore()` is idempotent and is called from both the last beat and
 * the guard.
 */

import * as THREE from 'three';
import { CONFIG, rng } from '../config.js';
import { WARDEN_STATE } from '../entities/enforcer.js';

const G = CONFIG.combat.gun;
const K = CONFIG.combat.knife;
const F = CONFIG.finisher;
const N = CONFIG.noise;

const DEG = Math.PI / 180;

/** Wall-clock seconds. Deliberately not the sim clock: the finisher scales it. */
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

// ---------------------------------------------------------------------------
// Weapon (Section 8.1)
// ---------------------------------------------------------------------------

/**
 * Magazine, fire rate, spread and recoil for the Warden's machine gun.
 *
 * Spread and recoil are separate on purpose: spread is where the bullet goes
 * relative to the aim, recoil is where the aim goes. Only recoil moves the
 * camera, so the player can fight it; spread cannot be fought, which is what
 * makes sustained fire worse than tapping.
 */
export class Weapon {
  constructor() {
    this.reset();
  }

  reset() {
    this.magazine = G.magazine;
    this.spread = G.spreadBase;
    this.reloading = false;
    this.reloadTimer = 0;
    this.shotTimer = 0;
    this.shotsFired = 0;
    /** Accumulated recoil, in radians, applied to the shooter's aim. */
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this._sinceShot = 0;
  }

  get secondsPerShot() {
    return 60 / G.roundsPerMinute;
  }

  step(dt) {
    this._sinceShot += dt;
    if (this.shotTimer > 0) this.shotTimer -= dt;

    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.magazine = G.magazine;
        this.spread = G.spreadBase;
      }
      return;
    }

    // Spread recovers whenever the trigger is off (Section 8.1).
    if (this._sinceShot > this.secondsPerShot * 1.5) {
      this.spread = Math.max(G.spreadBase, this.spread - G.spreadRecovery * dt);
    }

    // Recoil eases back toward centre; the fraction that survives a burst is
    // what makes a long burst climb further than several short ones.
    const decay = Math.exp(-G.recoilRecoveryRate * dt);
    this.recoilPitch *= decay;
    this.recoilYaw *= decay;
  }

  beginReload() {
    if (this.reloading || this.magazine === G.magazine) return false;
    this.reloading = true;
    this.reloadTimer = G.reloadTime;
    return true;
  }

  get canFire() {
    return !this.reloading && this.magazine > 0 && this.shotTimer <= 0;
  }

  /** Consume a round. Returns the spread cone, in radians, for this shot. */
  consume() {
    this.magazine--;
    this.shotsFired++;
    this.shotTimer = this.secondsPerShot;
    this._sinceShot = 0;
    const cone = this.spread * DEG;
    this.spread = Math.min(G.spreadMax, this.spread + G.spreadPerShot);
    this.recoilPitch += G.recoilVertical * DEG;
    this.recoilYaw += G.recoilHorizontal * DEG * rng.unit();
    if (this.magazine === 0) this.beginReload();
    return cone;
  }
}

// ---------------------------------------------------------------------------
// Hitscan
// ---------------------------------------------------------------------------

/**
 * Ray against an actor's capsule, treated as its AABB. Returns the distance
 * along the ray and whether it landed above the head line, or null.
 *
 * Section 8.1 is hitscan, so there is no projectile to tunnel — but the world
 * still has to occlude, which the caller does by comparing this against a
 * `collision.raycast()`.
 */
export function rayHitsActor(origin, direction, actor, maxDistance) {
  const half = actor.half;
  const min = { x: actor.position.x - half.x, y: actor.position.y - half.y, z: actor.position.z - half.z };
  const max = { x: actor.position.x + half.x, y: actor.position.y + half.y, z: actor.position.z + half.z };

  let tEnter = 0;
  let tExit = maxDistance;
  for (const axis of ['x', 'y', 'z']) {
    const d = direction[axis];
    if (Math.abs(d) < 1e-9) {
      if (origin[axis] < min[axis] || origin[axis] > max[axis]) return null;
      continue;
    }
    let t1 = (min[axis] - origin[axis]) / d;
    let t2 = (max[axis] - origin[axis]) / d;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tEnter) tEnter = t1;
    if (t2 < tExit) tExit = t2;
    if (tEnter > tExit) return null;
  }
  if (tEnter < 0 || tEnter > maxDistance) return null;

  const y = origin.y + direction.y * tEnter;
  const headLine = actor.feetY + actor.height * G.headHeightRatio;
  return { distance: tEnter, headshot: y >= headLine, y };
}

/** Section 8.1: 25 at 0-15m, falling linearly to 12 at 30m, then flat. */
export function damageAtRange(distance) {
  if (distance <= G.damageNearRange) return G.damageNear;
  if (distance >= G.damageFarRange) return G.damageFar;
  const t = (distance - G.damageNearRange) / (G.damageFarRange - G.damageNearRange);
  return G.damageNear + (G.damageFar - G.damageNear) * t;
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

export class Combat {
  /**
   * @param {object} options
   * @param {import('../map.js').GameMap} options.map
   * @param {object} options.emitter
   * @param {import('./detection.js').Detection} options.detection
   * @param {THREE.PerspectiveCamera} options.camera
   * @param {(scale:number)=>void} options.setTimeScale
   * @param {(owner:string|null)=>void} options.setCameraOwner
   */
  constructor({ map, emitter, detection, ai, scene, camera, setTimeScale, setCameraOwner }) {
    this.map = map;
    this.scene = scene || null;
    this.ai = ai || null;
    this.emitter = emitter;
    this.detection = detection;
    this.camera = camera;
    this.setTimeScale = setTimeScale || (() => {});
    this.setCameraOwner = setCameraOwner || (() => {});

    this.weapon = new Weapon();
    /** Section 8.3 state. Null when nothing cinematic is happening. */
    this.finisher = null;
    this.wardenRespawnTimer = 0;
    this.knifeTimer = 0;
    this.shots = 0;
    this.hits = 0;

    this._forward = { x: 0, y: 0, z: 0 };
    this._origin = { x: 0, y: 0, z: 0 };
    this._orbitPivot = new THREE.Object3D();
  }

  reset() {
    this.weapon.reset();
    this._restore();
    this.finisher = null;
    this.wardenRespawnTimer = 0;
    this.knifeTimer = 0;
    this.shots = 0;
    this.hits = 0;
  }

  get inFinisher() {
    return this.finisher !== null;
  }

  // -------------------------------------------------------------------------
  // Fixed step
  // -------------------------------------------------------------------------

  step(dt, { shade, warden, shadeIntent, wardenIntent }) {
    // The finisher runs on its own clock and suppresses ordinary combat.
    if (this.finisher) {
      this._stepFinisher(dt, shade, warden);
      return;
    }

    if (this.knifeTimer > 0) this.knifeTimer -= dt;
    this.weapon.step(dt);

    if (warden && warden.state === WARDEN_STATE.DEAD) {
      this._stepWardenRespawn(dt, shade, warden);
    } else if (warden && wardenIntent) {
      this._stepWarden(dt, shade, warden, wardenIntent);
    }

    if (shade && shade.health > 0 && shadeIntent && shadeIntent.melee) {
      this._swingKnife(shade, warden);
    }
  }

  // -------------------------------------------------------------------------
  // The gun (Section 8.1)
  // -------------------------------------------------------------------------

  _stepWarden(dt, shade, warden, intent) {
    if (intent.reload && this.weapon.beginReload()) {
      this.emitter.emit('combat:reload', { actor: 'warden' });
    }
    if (!intent.fire || !this.weapon.canFire) return;

    const cone = this.weapon.consume();
    this.shots++;

    // Aim, plus a random offset inside the spread cone. Both draws come from
    // the seeded stream, so a replayed seed reproduces the same burst.
    warden.forwardVector(this._forward);
    const yawOffset = rng.unit() * cone;
    const pitchOffset = rng.unit() * cone;
    const yaw = warden.yaw + yawOffset;
    const pitch = Math.max(-1.5, Math.min(1.5, warden.pitch + pitchOffset));
    const cosPitch = Math.cos(pitch);
    const direction = {
      x: -Math.sin(yaw) * cosPitch,
      y: Math.sin(pitch),
      z: -Math.cos(yaw) * cosPitch,
    };

    this._origin.x = warden.position.x;
    this._origin.y = warden.eyeY;
    this._origin.z = warden.position.z;

    // Recoil moves the aim itself, so the player fights it (Section 8.1).
    warden.look(this.weapon.recoilYaw * dt * G.recoilRecoveryRate, this.weapon.recoilPitch * dt * G.recoilRecoveryRate);

    this.emitter.emit('combat:shot', {
      actor: 'warden', origin: { ...this._origin }, direction, spread: cone / DEG,
    });
    this.detection.noise.emit(this._origin.x, this._origin.y, this._origin.z, N.radii.gunfire, 'gunfire', 'warden');

    const world = this.map.collision.raycast(this._origin, direction, G.range);
    const wall = world ? world.distance : Infinity;
    const hit = shade && shade.health > 0 ? rayHitsActor(this._origin, direction, shade, G.range) : null;
    if (!hit || hit.distance > wall) return;

    this.hits++;
    const damage = damageAtRange(hit.distance) * (hit.headshot ? G.headshotMultiplier : 1);
    this._damage(shade, damage, 'shade', hit.headshot ? 'headshot' : 'body');
  }

  // -------------------------------------------------------------------------
  // The knife (Section 8.2)
  // -------------------------------------------------------------------------

  /**
   * @returns {'takedown'|'arc'|null} what the swing produced
   */
  _swingKnife(shade, warden) {
    if (this.knifeTimer > 0) return null;
    this.knifeTimer = K.swingInterval;

    this.emitter.emit('combat:knife', { actor: 'shade' });
    this.detection.noise.emit(
      shade.position.x, shade.feetY, shade.position.z, N.radii.knifeSwing, 'knife', 'shade'
    );

    if (!warden || warden.state === WARDEN_STATE.DEAD) return null;
    const kind = this.classifyKnife(shade, warden);
    if (kind === 'takedown') {
      this._beginFinisher(shade, warden);
      return 'takedown';
    }
    if (kind === 'arc') {
      this._damage(warden, K.damage, 'warden', 'knife');
      return 'arc';
    }
    return null;
  }

  /**
   * Section 8.2. A rear takedown needs the attacker close, behind, and inside
   * the cone the target is facing AWAY from — not merely behind in world space,
   * which would let a Warden be taken down while looking straight at you.
   */
  classifyKnife(shade, warden) {
    const dx = warden.position.x - shade.position.x;
    const dz = warden.position.z - shade.position.z;
    const distance = Math.hypot(dx, dz);

    // Is the target inside the attacker's own swing arc at all?
    const attackerForward = { x: -Math.sin(shade.yaw), z: -Math.cos(shade.yaw) };
    const toTarget = distance > 1e-6 ? { x: dx / distance, z: dz / distance } : attackerForward;
    const facing = attackerForward.x * toTarget.x + attackerForward.z * toTarget.z;
    if (facing < Math.cos((K.arcDegrees / 2) * DEG)) return null;

    // Rear takedown: within 1.8m and inside the 100 degree cone behind the
    // Warden. `toTarget` runs attacker->target, so the vector from the target
    // back to the attacker is its negation; the attacker is behind when that
    // opposes the Warden's facing, and the two negations cancel to a plain dot.
    const targetForward = { x: -Math.sin(warden.yaw), z: -Math.cos(warden.yaw) };
    const behind = targetForward.x * toTarget.x + targetForward.z * toTarget.z;
    if (distance <= K.rearRange && behind >= Math.cos((K.rearConeDegrees / 2) * DEG)) return 'takedown';

    if (distance <= K.range) return 'arc';
    return null;
  }

  // -------------------------------------------------------------------------
  // Damage and death
  // -------------------------------------------------------------------------

  /** Public entry for damage from outside combat, e.g. a frag (Section 9.2). */
  applyDamage(actor, amount, who, kind) {
    this._damage(actor, amount, who, kind);
  }

  _damage(actor, amount, who, kind) {
    if (actor.health <= 0) return;
    actor.health = Math.max(0, actor.health - amount);
    this.emitter.emit('combat:damage', { target: who, amount, kind, remaining: actor.health });
    if (actor.health > 0) return;

    if (who === 'warden') {
      actor.state = WARDEN_STATE.DEAD;
      actor.velocity.set(0, 0, 0);
      this.wardenRespawnTimer = CONFIG.warden.respawnDelay;
    }
    // The Shade's lives and reinsert are Section 10.2, which Phase 10 owns.
    // Combat's job ends at reporting the death.
    this.emitter.emit('combat:death', { target: who, kind });
  }

  /**
   * Section 6.2: the Warden respawns 12s after death, at the spawn furthest
   * from the Shade's last known position.
   */
  _stepWardenRespawn(dt, shade, warden) {
    this.wardenRespawnTimer -= dt;
    if (this.wardenRespawnTimer > 0) return;

    // Section 6.2: furthest from the Shade's LAST KNOWN position, which is the
    // AI's belief, not the Shade's actual position. Respawning relative to the
    // truth would hand the Warden information it has not earned.
    const reference = this.ai && this.ai.lastKnown
      ? this.ai.lastKnown
      : (shade ? shade.position : { x: 0, y: 0, z: 0 });

    let best = this.map.wardenSpawns[0];
    let bestDistance = -1;
    for (const spawn of this.map.wardenSpawns) {
      const distance = spawn.position.distanceTo(reference);
      if (distance > bestDistance) {
        bestDistance = distance;
        best = spawn;
      }
    }
    warden.reset(best);
    this.emitter.emit('combat:respawn', { actor: 'warden', at: best.name });
  }

  // -------------------------------------------------------------------------
  // Finisher (Section 8.3)
  // -------------------------------------------------------------------------

  _beginFinisher(shade, warden) {
    this.finisher = {
      elapsed: 0,
      wallStart: now(),
      pivot: new THREE.Vector3(
        (shade.position.x + warden.position.x) / 2,
        (shade.feetY + warden.feetY) / 2 + F.orbitHeight,
        (shade.position.z + warden.position.z) / 2
      ),
      startAngle: Math.atan2(
        this.camera.position.x - warden.position.x,
        this.camera.position.z - warden.position.z
      ),
      restored: false,
    };

    this.setCameraOwner(null);
    this._orbitPivot.position.copy(this.finisher.pivot);
    // The pivot has to be IN the scene before the camera is parented to it, or
    // reparenting quietly lifts the only camera out of the graph.
    if (this.scene && this._orbitPivot.parent !== this.scene) this.scene.add(this._orbitPivot);
    if (this.camera.parent !== this._orbitPivot) this._orbitPivot.add(this.camera);

    this.setTimeScale(F.hitStopTimeScale);
    this.detection.noise.emit(
      warden.position.x, warden.feetY, warden.position.z, N.radii.knifeSwing, 'takedown', 'shade'
    );
    this.emitter.emit('combat:takedown', { at: this.finisher.pivot.clone() });
    this._damage(warden, CONFIG.warden.health, 'warden', 'takedown');
  }

  _stepFinisher(dt, shade, warden) {
    const state = this.finisher;
    // Advanced with the RAW step, never the scaled one: the cinematic changes
    // the time scale, so timing itself against the scaled clock would stretch
    // the beats by exactly the amount they slow down.
    state.elapsed += CONFIG.time.fixedDt;

    // Section 8.3's hard requirement. Wall clock, so a stalled frame, a
    // breakpoint or a time scale of 0.05 cannot strand the player.
    if (now() - state.wallStart >= F.wallClockTimeout) {
      this._restore();
      this.finisher = null;
      this.emitter.emit('combat:finisher-timeout', {});
      return;
    }

    if (state.elapsed < F.hitStopEnd) {
      this.setTimeScale(F.hitStopTimeScale);
    } else if (state.elapsed < F.slowMoEnd) {
      this.setTimeScale(F.slowMoTimeScale);
      const t = (state.elapsed - F.hitStopEnd) / (F.slowMoEnd - F.hitStopEnd);
      const angle = state.startAngle + F.orbitDegrees * DEG * t;
      this._orbitPivot.position.copy(state.pivot);
      this.camera.position.set(
        Math.sin(angle) * F.orbitRadius,
        F.orbitHeight * 0.35,
        Math.cos(angle) * F.orbitRadius
      );
      this.camera.lookAt(state.pivot);
    } else if (state.elapsed < F.duration) {
      // Snap-back: ease the time scale home while the camera returns.
      const t = (state.elapsed - F.slowMoEnd) / (F.duration - F.slowMoEnd);
      this.setTimeScale(F.slowMoTimeScale + (1 - F.slowMoTimeScale) * t);
    } else {
      this._restore();
      this.finisher = null;
      this.emitter.emit('combat:finisher-end', {});
    }
  }

  /**
   * Force the world back to normal. Idempotent, and called from both the last
   * beat and the wall-clock guard, because Section 8.3 forbids the cinematic
   * from owning the only path back.
   */
  _restore() {
    this.setTimeScale(1);
    this.camera.position.set(0, 0, 0);
    this.camera.rotation.set(0, 0, 0);
    this.camera.scale.set(1, 1, 1);
    this.camera.fov = CONFIG.render.fov;
    this.camera.updateProjectionMatrix();
    // Hand the camera back to the scene BEFORE dropping the pivot, or it is
    // removed along with it and the scene ends up with no camera at all.
    if (this.scene && this.camera.parent === this._orbitPivot) this.scene.add(this.camera);
    if (this._orbitPivot.parent) this._orbitPivot.parent.remove(this._orbitPivot);
    this.setCameraOwner(null);
  }
}

export function createCombat(options) {
  return new Combat(options);
}
