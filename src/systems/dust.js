/**
 * BLACKLINE - systems/dust.js
 *
 * Dust and light (J6): the puff a landing and a failed climb leave, and the
 * one light a shot is drawn by. Owned and stepped by `effects.js`, which
 * listens on the Emitter and calls in here - this file listens to nothing and
 * calls into no system, so it sits beside the sparks and the smoke and obeys
 * the same two rules.
 *
 *  - **Every random number comes from `lookRng`** (H27). A mote's direction is
 *    three draws and the quality preset scales how many motes there are, so a
 *    draw from the simulation's stream here would let `?quality=low` decide
 *    what the Warden does next.
 *  - **One fixed pool, allocated once and recycled, one draw call.** The oldest
 *    mote is overwritten when the pool is full; nothing is ever created in a
 *    step. The cap is `CONFIG.effects.dust.poolSize`, and
 *    `a-landing-a-scuff-and-a-shot-leave-a-mark-you-can-see` is what holds it.
 *
 * Why this is its own module and not 80 more lines of effects.js: that file
 * was at 512 of a 600 allowance, a third emitter with its own material and a
 * light does not fit in what is left with room to spare, and the dust has no
 * state in common with the footprints and the smoke. It is the same shape as
 * `gadgeteffects.js`: the owner keeps the wiring, this keeps the thing.
 */

import * as THREE from 'three';
import { CONFIG, lookRng } from '../config.js';
import { qualityParticles } from '../quality.js';

const D = CONFIG.effects.dust;
const F = CONFIG.effects.muzzleFlash;
const L = CONFIG.shade.landing;

export class Dust {
  /** @param {{root: THREE.Group}} options the effects group the pool and the light hang from */
  constructor({ root }) {
    this.slots = [];
    for (let i = 0; i < D.poolSize; i++) {
      this.slots.push({ life: 0, age: 0, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0 });
    }
    this._next = 0;
    /** Motes ever spawned. The checks read the difference across an event, since a mote outlives the step that made it. */
    this.spawned = 0;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(D.poolSize * 3), 3));
    // Per-mote scale: three's PointsMaterial has one `size` for the whole
    // pool, and a puff that pops out of existence reads as a glitch.
    geometry.setAttribute('aScale', new THREE.BufferAttribute(new Float32Array(D.poolSize), 1));
    const material = new THREE.PointsMaterial({
      color: D.color, size: D.size, sizeAttenuation: true,
      transparent: true, opacity: D.opacity, depthWrite: false, fog: true,
    });
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'attribute float aScale;\nvoid main() {')
        .replace('gl_PointSize = size;', 'gl_PointSize = size * aScale;');
      // A soft round mote: a hard square of flat colour reads as a sticker on
      // the floor, and a puff is a dozen of these overlapping.
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <alphatest_fragment>',
        'diffuseColor.a *= 1.0 - smoothstep( 0.1, 0.5, length( gl_PointCoord - vec2( 0.5 ) ) );\n#include <alphatest_fragment>'
      );
    };
    material.customProgramCacheKey = () => 'bl-dust-scale';
    this.mesh = new THREE.Points(geometry, material);
    this.mesh.name = 'dust';
    this.mesh.frustumCulled = false;
    root.add(this.mesh);

    // The flash is permanent and its intensity is its state, as the alarm
    // lens's lamp is (effects.js): a light that came and went would change the
    // scene's light count, and three recompiles every lit material when it
    // does - on the frame of the shot, which is the one frame that matters.
    // No shadow: only the key light casts (Section 4.1), and a second shadow
    // map in the frame of a shot is a hitch.
    this.muzzleLight = new THREE.PointLight(F.color, 0, F.distance, F.decay);
    this.muzzleLight.name = 'muzzle-flash';
    this.muzzleLight.castShadow = false;
    root.add(this.muzzleLight);
    this._flashSteps = 0;

    this._sync();
  }

  /** Live motes. Section 17: the overlay's count must return to 0 when idle. */
  get activeCount() {
    let count = 0;
    for (const slot of this.slots) if (slot.life > 0) count++;
    return count;
  }

  /** Is the flash lit right now? */
  get flashLit() {
    return this.muzzleLight.intensity > 0;
  }

  /**
   * A landing. Nothing below `minFall`, and from there the count and the
   * spread climb on a straight line to the full ring at `hardFall` - the
   * place the landing's own weight (B8) is whole, so what is felt and what is
   * seen finish together.
   * @param {{x:number,y:number,z:number}} at the feet
   * @param {number} fall metres dropped
   * @returns {number} motes spawned
   */
  landing(at, fall) {
    if (!(fall >= D.minFall)) return 0;
    const t = Math.min(1, (fall - D.minFall) / (L.hardFall - D.minFall));
    return this._burst(at, D.countMin + (D.countMax - D.countMin) * t, D.spreadMin + (D.spreadMax - D.spreadMin) * t, 1 + 0.5 * t);
  }

  /** A scuff's puff: the landing's smallest, where the hands hit. */
  scuff(at) {
    return this._burst(at, D.countMin, D.spreadMin, 1);
  }

  _burst(at, wanted, spread, lift) {
    const count = qualityParticles(Math.round(wanted));
    for (let i = 0; i < count; i++) {
      const slot = this.slots[this._next];
      this._next = (this._next + 1) % this.slots.length;
      const angle = lookRng.next() * Math.PI * 2;
      const speed = spread * (0.4 + 0.6 * lookRng.next());
      slot.life = D.lifetime;
      slot.age = 0;
      slot.x = at.x + Math.cos(angle) * D.spawnRadius;
      slot.y = at.y;
      slot.z = at.z + Math.sin(angle) * D.spawnRadius;
      slot.vx = Math.cos(angle) * speed;
      slot.vy = lookRng.range(0.2, 1) * D.rise * lift;
      slot.vz = Math.sin(angle) * speed;
    }
    this.spawned += count;
    return count;
  }

  /**
   * Light the flash at the muzzle of a shot. `origin` is the eye and
   * `direction` the aim, so the lamp sits where the barrel is and not in the
   * shooter's face.
   */
  muzzleFlash(origin, direction) {
    this.muzzleLight.position.set(
      origin.x + direction.x * F.forward,
      origin.y + direction.y * F.forward - F.drop,
      origin.z + direction.z * F.forward
    );
    this.muzzleLight.intensity = F.intensity;
    this._flashSteps = 0;
  }

  /**
   * The next frame has begun: the flash was drawn once and is done. Called on
   * `frame:begin`, so a shot that lands in a frame's steps is lit for that
   * frame's draw and dark for the next one's.
   */
  endFrame() {
    this.muzzleLight.intensity = 0;
    this._flashSteps = 0;
  }

  step(dt) {
    // A harness runs steps with no frame between them; without this a flash
    // from the last of them would be in the next picture someone takes.
    if (this.flashLit && ++this._flashSteps >= F.maxSteps) this.endFrame();

    for (const slot of this.slots) {
      if (slot.life <= 0) continue;
      slot.life -= dt;
      slot.age += dt;
      slot.vx *= D.drag;
      slot.vy *= D.drag;
      slot.vz *= D.drag;
      slot.x += slot.vx * dt;
      slot.y += slot.vy * dt;
      slot.z += slot.vz * dt;
    }
    this._sync();
  }

  reset() {
    for (const slot of this.slots) slot.life = 0;
    this.endFrame();
    this._sync();
  }

  _sync() {
    const position = this.mesh.geometry.attributes.position.array;
    const scale = this.mesh.geometry.attributes.aScale.array;
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      const alive = slot.life > 0;
      position[i * 3] = slot.x;
      position[i * 3 + 1] = alive ? slot.y : -999;
      position[i * 3 + 2] = slot.z;
      // Grow in, hold, shrink out: the same envelope as the smoke's.
      let s = 1;
      if (slot.age < D.growTime) s = slot.age / D.growTime;
      else if (slot.life < D.fadeTime) s = Math.max(0, slot.life / D.fadeTime);
      scale[i] = alive ? Math.max(0.15, s) : 0;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.aScale.needsUpdate = true;
  }
}
