/**
 * BLACKLINE — systems/effects.js
 *
 * Footprints, particles, smoke and ragdoll-lite (Section 15's performance and
 * leak rows, and the Section 9.1 smoke render).
 *
 * Layering (Section 3.1): imports config. The scene and the emitter are handed
 * in; it never calls into another system, it listens.
 *
 * Everything here is a **fixed pool**, allocated once and recycled. Three rows
 * of the risk register live in this file:
 *
 *  - "Footprint trails leak memory" — 60 decals, oldest recycled, fade over 6s.
 *  - "Smoke and particles tank framerate" — hard cap, one shared material, and
 *    a single draw call each rather than one per sprite.
 *  - "Ragdoll goes unstable" — ragdoll-LITE only: disable the controller, one
 *    impulse, damped tumble, freeze after 2s. No solver, no constraints.
 *
 * Deviation from Section 9.1's wording: the smoke pool is one `THREE.Points`
 * object rather than 200 `THREE.Sprite`s. It is the same cap and the same one
 * shared material, but 200 sprites is 200 draw calls, which is precisely what
 * that row of the risk register is trying to prevent.
 *
 * **Every random number in this file comes from `lookRng`, never `rng`** (H27).
 * This is the only module that draws from the presentation stream, and the
 * reason is that a draw *count* in here is not fixed: `sparks()` takes three
 * numbers per particle and the quality preset scales how many particles there
 * are, so while these came off the simulation's stream `?quality=low` changed
 * what the Warden did next. H24 measured it at 15 draws against 6 off one
 * impact, and 0.3745 against 0.3492 on the AI's very next draw. The rule is
 * now a layering rule rather than a patch: nothing presentational draws from
 * the simulation's stream, so no future effect can reintroduce it. If a value
 * drawn here ever decides something a player can lose to, it belongs on `rng`
 * instead. `config.js` has the argument and
 * `the-quality-level-cannot-move-the-simulation` is what notices.
 */

import * as THREE from 'three';
import { CONFIG, lookRng } from '../config.js';
import { qualityParticles } from '../quality.js';

const E = CONFIG.effects;
const GA = CONFIG.gadgets;
const P = CONFIG.palette;

export class Effects {
  /**
   * @param {object} options
   * @param {THREE.Scene} options.scene
   * @param {object} options.emitter
   */
  constructor({ scene, emitter }) {
    this.scene = scene;
    this.emitter = emitter;
    this.root = new THREE.Group();
    this.root.name = 'effects';
    scene.add(this.root);

    this._buildFootprints();
    this._buildParticles();
    this._buildSmoke();
    this._buildAlarmFixture();
    this.ragdolls = [];

    this._unsubscribe = [];
    this._subscribe();
  }

  _subscribe() {
    if (!this.emitter) return;
    const on = (event, handler) => this._unsubscribe.push(this.emitter.on(event, handler));
    on('noise', (event) => {
      if (event.type === 'footstep') this.footprint(event, event.source);
    });
    on('gadget:detonate', (event) => {
      if (event.type === 'smoke') this.smokeBurst(event.at);
      else this.sparks(event.at, E.detonationSparks);
    });
    // Where a round landed. Section 16 check 15 asks the player to watch spread
    // grow and recoil climb; neither is readable without seeing the impacts.
    on('combat:impact', (event) => this.sparks(event.at, E.impactSparks));

    // Section 9.2's alarm camera. Gadgets owns what it does; this owns what it
    // looks like, because gadgets has no scene and must not acquire one.
    on('gadget:alarm-placed', (event) => this.showAlarm(event.at));
    on('gadget:alarm-destroyed', (event) => this.breakAlarm(event.by));
    // The lens blinks on a detection, which is the only in-world tell that the
    // thing has seen you — the siren is audio and the ping is HUD.
    on('gadget:alarm', () => this.blinkAlarm());
  }

  dispose() {
    for (const off of this._unsubscribe) off();
    this._unsubscribe.length = 0;
  }

  reset() {
    for (let i = 0; i < this.footprints.length; i++) this.footprints[i].life = 0;
    for (let i = 0; i < this.particles.length; i++) this.particles[i].life = 0;
    for (let i = 0; i < this.smoke.length; i++) this.smoke[i].life = 0;
    for (const ragdoll of this.ragdolls) ragdoll.mesh.rotation.set(0, 0, 0);
    this.ragdolls.length = 0;
    // Section 9.2 allows one alarm camera per round, so a new round starts
    // with none placed rather than with the last one still on the wall.
    this.alarmFixture.visible = false;
    this._alarmBlink = 0;
    this._syncFootprints();
    this._syncParticles();
    this._syncSmoke();
  }

  // -------------------------------------------------------------------------
  // Alarm camera fixture (Section 9.2)
  //
  // One mesh, built once and hidden, because Section 9.2 allows exactly one per
  // round. It renders NO live feed — there is no second camera, no render
  // target and no second draw of the scene here, only a body and a lens.
  // -------------------------------------------------------------------------

  _buildAlarmFixture() {
    const C = GA.alarmCamera;
    const group = new THREE.Group();
    group.name = 'alarm-camera';
    group.visible = false;

    const bodyMaterial = new THREE.MeshToonMaterial({ color: P.wardenGunmetal });
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(C.bodyRadius, C.bodyRadius, C.bodyLength, 10),
      bodyMaterial
    );
    // Lying along -Z, which is the direction the cone points.
    body.rotation.x = Math.PI / 2;
    body.position.z = -C.bodyLength / 2;
    group.add(body);

    const mount = new THREE.Mesh(
      new THREE.CylinderGeometry(C.mountRadius, C.mountRadius, C.mountDepth, 8),
      bodyMaterial
    );
    mount.rotation.x = Math.PI / 2;
    group.add(mount);

    // The lens is the state readout, exactly as a destructible light's glass is
    // (Section 5): live and hot, or dark and dead.
    this._alarmLensMaterial = new THREE.MeshBasicMaterial({ color: P.wardenOrange });
    const lens = new THREE.Mesh(new THREE.SphereGeometry(C.lensRadius, 10, 8), this._alarmLensMaterial);
    lens.position.z = -C.bodyLength;
    group.add(lens);

    this.alarmFixture = group;
    this.root.add(group);
  }

  /** @param {{x:number,y:number,z:number,yaw:number}} at */
  showAlarm(at) {
    const fixture = this.alarmFixture;
    fixture.position.set(at.x, at.y, at.z);
    fixture.rotation.set(0, at.yaw, 0);
    fixture.visible = true;
    this._alarmLensMaterial.color.setHex(P.wardenOrange);
    this._alarmBlink = 0;
  }

  breakAlarm() {
    this.alarmFixture.visible = false;
    this.sparks(this.alarmFixture.position, E.impactSparks);
  }

  blinkAlarm() {
    this._alarmBlink = GA.alarmCamera.retriggerInterval;
  }

  _stepAlarmFixture(dt) {
    if (!this.alarmFixture.visible) return;
    if (this._alarmBlink > 0) this._alarmBlink -= dt;
    // Alternates with the two-tone siren rather than glowing steadily, so a
    // triggered camera reads as triggered from across the room.
    const alerted = this._alarmBlink > 0;
    const on = alerted ? Math.floor(this._alarmBlink * 6) % 2 === 0 : true;
    this._alarmLensMaterial.color.setHex(
      !on ? P.wardenGunmetal : alerted ? P.hazardOrange : P.wardenOrange
    );
  }

  /**
   * Drop one body's ragdoll and level its mesh. Section 15 requires reinsert to
   * clear the ragdoll specifically, and a reinsert must not also wipe an
   * unrelated Warden corpse, so this is per-mesh rather than reset().
   * @returns {boolean} whether a ragdoll was actually holding that mesh
   */
  clearRagdoll(mesh) {
    for (let i = this.ragdolls.length - 1; i >= 0; i--) {
      if (this.ragdolls[i].mesh !== mesh) continue;
      this.ragdolls.splice(i, 1);
      mesh.rotation.set(0, 0, 0);
      return true;
    }
    return false;
  }

  /** Section 17: the overlay reports this, and it must return to 0 when idle. */
  get activeCount() {
    let count = this.ragdolls.length;
    for (const slot of this.footprints) if (slot.life > 0) count++;
    for (const slot of this.particles) if (slot.life > 0) count++;
    for (const slot of this.smoke) if (slot.life > 0) count++;
    return count;
  }

  get pooledSprites() {
    let count = 0;
    for (const slot of this.smoke) if (slot.life > 0) count++;
    return count;
  }

  // -------------------------------------------------------------------------
  // Pools
  // -------------------------------------------------------------------------

  _buildFootprints() {
    const geometry = new THREE.PlaneGeometry(E.footprintSize, E.footprintSize * 1.6);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({
      color: P.signageTeal, transparent: true, opacity: 0, depthWrite: false, fog: true,
    });
    this.footprintMesh = new THREE.InstancedMesh(geometry, material, E.footprintPoolSize);
    this.footprintMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.footprintMesh.frustumCulled = false;
    this.footprintMesh.count = E.footprintPoolSize;
    this.root.add(this.footprintMesh);

    this.footprints = [];
    for (let i = 0; i < E.footprintPoolSize; i++) {
      this.footprints.push({ life: 0, x: 0, y: -999, z: 0, yaw: 0 });
    }
    this._nextFootprint = 0;
    this._matrix = new THREE.Matrix4();
    this._quaternion = new THREE.Quaternion();
    this._position = new THREE.Vector3();
    this._scale = new THREE.Vector3(1, 1, 1);
    this._syncFootprints();
  }

  _buildParticles() {
    this.particles = [];
    for (let i = 0; i < E.particlePoolSize; i++) {
      this.particles.push({ life: 0, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0 });
    }
    this._nextParticle = 0;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(E.particlePoolSize * 3), 3));
    this.particleMesh = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: P.hazardOrange, size: 0.08, transparent: true, opacity: 0.9, depthWrite: false })
    );
    this.particleMesh.frustumCulled = false;
    this.root.add(this.particleMesh);
    this._syncParticles();
  }

  _buildSmoke() {
    this.smoke = [];
    for (let i = 0; i < GA.smoke.spriteCap; i++) {
      this.smoke.push({ life: 0, duration: 1, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, size: 1 });
    }
    this._nextSmoke = 0;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(GA.smoke.spriteCap * 3), 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(new Float32Array(GA.smoke.spriteCap), 1));
    // One shared material for the whole cloud (Section 9.1).
    this.smokeMesh = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0x9aa6ad, size: GA.smoke.spriteSizeMax, sizeAttenuation: true,
        transparent: true, opacity: GA.smoke.spriteOpacity, depthWrite: false, fog: true,
      })
    );
    this.smokeMesh.frustumCulled = false;
    this.root.add(this.smokeMesh);
    this._syncSmoke();
  }

  // -------------------------------------------------------------------------
  // Spawning
  // -------------------------------------------------------------------------

  /** Oldest slot recycled, never a new allocation (Section 15). */
  footprint(at, source) {
    const slot = this.footprints[this._nextFootprint];
    this._nextFootprint = (this._nextFootprint + 1) % this.footprints.length;
    slot.life = E.footprintFadeTime;
    slot.x = at.x;
    slot.y = at.y + E.footprintLift;
    slot.z = at.z;
    slot.yaw = source === 'warden' ? 0 : lookRng.range(-0.4, 0.4);
    return slot;
  }

  sparks(at, count) {
    // H10: the quality preset scales a burst - `low` pays for a third of them.
    // Here rather than at the call sites, so a third caller joins the rule by
    // existing, and never below one: a burst of nothing is a bullet that hit
    // nothing.
    //
    // H27: and this is the line that made the stream split necessary. The loop
    // below draws three numbers per particle, so a scaled count is a scaled
    // number of draws - 15 at medium and 6 at low - and while those came off
    // the simulation's `rng` the quality setting decided what the Warden did
    // next. It draws from `lookRng` now and the count may scale freely.
    const lit = qualityParticles(count);
    for (let i = 0; i < lit; i++) {
      const slot = this.particles[this._nextParticle];
      this._nextParticle = (this._nextParticle + 1) % this.particles.length;
      slot.life = E.particleLifetime;
      slot.x = at.x;
      slot.y = at.y;
      slot.z = at.z;
      slot.vx = lookRng.unit() * 4;
      slot.vy = lookRng.range(1, 5);
      slot.vz = lookRng.unit() * 4;
    }
  }

  /**
   * A smoke cloud. Section 9.1 caps the pool at 200 sprites for the whole game,
   * not per cloud, so a second grenade recycles the first one's oldest puffs
   * rather than doubling the count.
   */
  smokeBurst(at) {
    const perCloud = Math.floor(GA.smoke.spriteCap / GA.smoke.count);
    for (let i = 0; i < perCloud; i++) {
      const slot = this.smoke[this._nextSmoke];
      this._nextSmoke = (this._nextSmoke + 1) % this.smoke.length;
      slot.duration = GA.smoke.duration;
      slot.life = GA.smoke.duration;
      const radius = GA.smoke.radius * Math.cbrt(lookRng.next());
      const theta = lookRng.next() * Math.PI * 2;
      const phi = Math.acos(lookRng.unit());
      slot.x = at.x + radius * Math.sin(phi) * Math.cos(theta);
      slot.y = at.y + radius * Math.cos(phi) * 0.6;
      slot.z = at.z + radius * Math.sin(phi) * Math.sin(theta);
      slot.vx = lookRng.unit() * GA.smoke.driftSpeed;
      slot.vy = lookRng.range(0, GA.smoke.driftSpeed);
      slot.vz = lookRng.unit() * GA.smoke.driftSpeed;
      slot.size = lookRng.range(GA.smoke.spriteSizeMin, GA.smoke.spriteSizeMax);
    }
  }

  /**
   * Ragdoll-lite (Section 15). Not a solver: one impulse, a damped tumble on
   * the whole mesh, frozen after 2s. The controller is expected to be disabled
   * by the caller before this runs.
   */
  ragdoll(mesh, direction) {
    const record = {
      mesh,
      life: E.ragdollDuration,
      vx: (direction.x || 0) * E.ragdollImpulse,
      vy: E.ragdollImpulse * 0.5,
      vz: (direction.z || 0) * E.ragdollImpulse,
      spinX: lookRng.unit() * 6,
      spinY: lookRng.unit() * 6,
      spinZ: lookRng.unit() * 6,
    };
    this.ragdolls.push(record);
    return record;
  }

  // -------------------------------------------------------------------------
  // Fixed step
  // -------------------------------------------------------------------------

  step(dt) {
    this._stepAlarmFixture(dt);

    let dirty = false;
    for (const slot of this.footprints) {
      if (slot.life <= 0) continue;
      slot.life -= dt;
      dirty = true;
    }
    if (dirty) this._syncFootprints();

    for (const slot of this.particles) {
      if (slot.life <= 0) continue;
      slot.life -= dt;
      slot.vy += E.ragdollGravity * dt;
      slot.x += slot.vx * dt;
      slot.y += slot.vy * dt;
      slot.z += slot.vz * dt;
    }
    this._syncParticles();

    for (const slot of this.smoke) {
      if (slot.life <= 0) continue;
      slot.life -= dt;
      slot.x += slot.vx * dt;
      slot.y += slot.vy * dt;
      slot.z += slot.vz * dt;
    }
    this._syncSmoke();

    for (let i = this.ragdolls.length - 1; i >= 0; i--) {
      const doll = this.ragdolls[i];
      doll.life -= dt;
      if (doll.life <= 0) {
        // Freeze, do not delete: the body stays where it fell.
        this.ragdolls.splice(i, 1);
        continue;
      }
      doll.vy += E.ragdollGravity * dt;
      doll.vx *= E.ragdollLinearDamping;
      doll.vz *= E.ragdollLinearDamping;
      doll.mesh.position.x += doll.vx * dt;
      doll.mesh.position.y = Math.max(0, doll.mesh.position.y + doll.vy * dt);
      doll.mesh.position.z += doll.vz * dt;
      doll.spinX *= E.ragdollAngularDamping;
      doll.spinY *= E.ragdollAngularDamping;
      doll.spinZ *= E.ragdollAngularDamping;
      doll.mesh.rotation.x += doll.spinX * dt;
      doll.mesh.rotation.y += doll.spinY * dt;
      doll.mesh.rotation.z += doll.spinZ * dt;
    }
  }

  // -------------------------------------------------------------------------
  // GPU sync
  // -------------------------------------------------------------------------

  _syncFootprints() {
    for (let i = 0; i < this.footprints.length; i++) {
      const slot = this.footprints[i];
      const alive = slot.life > 0;
      this._position.set(slot.x, alive ? slot.y : -999, slot.z);
      this._quaternion.setFromAxisAngle({ x: 0, y: 1, z: 0 }, slot.yaw);
      const fade = alive ? slot.life / E.footprintFadeTime : 0;
      this._scale.set(fade, fade, fade);
      this._matrix.compose(this._position, this._quaternion, this._scale);
      this.footprintMesh.setMatrixAt(i, this._matrix);
    }
    this.footprintMesh.instanceMatrix.needsUpdate = true;
    this.footprintMesh.material.opacity = E.groundBlobOpacity;
  }

  _syncParticles() {
    const array = this.particleMesh.geometry.attributes.position.array;
    for (let i = 0; i < this.particles.length; i++) {
      const slot = this.particles[i];
      const alive = slot.life > 0;
      array[i * 3] = slot.x;
      array[i * 3 + 1] = alive ? slot.y : -999;
      array[i * 3 + 2] = slot.z;
    }
    this.particleMesh.geometry.attributes.position.needsUpdate = true;
  }

  _syncSmoke() {
    const position = this.smokeMesh.geometry.attributes.position.array;
    const size = this.smokeMesh.geometry.attributes.size.array;
    for (let i = 0; i < this.smoke.length; i++) {
      const slot = this.smoke[i];
      const alive = slot.life > 0;
      position[i * 3] = slot.x;
      position[i * 3 + 1] = alive ? slot.y : -999;
      position[i * 3 + 2] = slot.z;
      // Grow in, hold, fade out (Section 9.1 timings).
      const age = slot.duration - slot.life;
      let scale = 1;
      if (age < GA.smoke.growTime) scale = age / GA.smoke.growTime;
      else if (slot.life < GA.smoke.fadeTime) scale = Math.max(0, slot.life / GA.smoke.fadeTime);
      size[i] = alive ? slot.size * scale : 0;
    }
    this.smokeMesh.geometry.attributes.position.needsUpdate = true;
    this.smokeMesh.geometry.attributes.size.needsUpdate = true;
  }
}

export function createEffects(options) {
  return new Effects(options);
}
