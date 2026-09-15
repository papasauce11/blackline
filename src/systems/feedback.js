/**
 * BLACKLINE — systems/feedback.js
 *
 * Hit and damage feedback (Section 13, amended - C3): a hit marker when a
 * shot of yours lands, an arc toward where damage came from, and a vignette
 * at the screen edge that deepens as health goes. All three are one
 * screen-space quad drawn over the scene by the renderer - not the DOM, so
 * `gl.readPixels` sees them and the checks can prove them, where the HUD's
 * flash is invisible to a pixel check. Its vertex shader passes clip
 * coordinates straight through, so it covers the screen whatever the
 * camera, the FOV or the aspect, and `frustumCulled` is off because it
 * has no place in the world to be culled from.
 *
 * Layering (Section 3.1): imports config. The scene, the camera, the two
 * actors and the emitter are handed in; it listens, and reads the health
 * of whichever actor the human drives. It never calls into another system.
 *
 * It runs on the wall clock, from `frame:render`, because it presents the
 * simulation rather than being part of it (as the HUD and audio do). The
 * quad is invisible - no draw call - while it has nothing to show.
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';

const F = CONFIG.feedback;

const VERTEX = `
varying vec2 vPos;
void main() {
  vPos = position.xy;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAGMENT = `
uniform float aspect;
uniform float vignette;
uniform float hit;
uniform float dirStrength;
uniform float dirAngle;
uniform vec3 vignetteColor;
uniform vec3 hitColor;
uniform vec3 dirColor;
varying vec2 vPos;
const float PI = 3.141592653589793;
const float TWO_PI = 6.283185307179586;

// Lay one layer over another (straight alpha).
void over(inout vec3 col, inout float al, vec3 c, float a) {
  float out_a = a + al * (1.0 - a);
  col = out_a > 0.0 ? (c * a + col * al * (1.0 - a)) / out_a : col;
  al = out_a;
}

void main() {
  // Circular things use aspect-corrected coordinates; the vignette follows the
  // frame's own shape.
  vec2 p = vec2(vPos.x * aspect, vPos.y);
  vec3 col = vec3(0.0);
  float al = 0.0;

  float edge = smoothstep(${F.vignetteInner.toFixed(4)}, ${F.vignetteOuter.toFixed(4)}, length(vPos));
  over(col, al, vignetteColor, vignette * edge);

  float r = length(p);
  float ang = atan(p.x, p.y);
  float da = abs(mod(ang - dirAngle + PI, TWO_PI) - PI);
  float ring = 1.0 - smoothstep(${(F.indicatorWidth * 0.5).toFixed(4)}, ${F.indicatorWidth.toFixed(4)}, abs(r - ${F.indicatorRadius.toFixed(4)}));
  float arc = 1.0 - smoothstep(${(F.indicatorArc * 0.7).toFixed(4)}, ${F.indicatorArc.toFixed(4)}, da);
  over(col, al, dirColor, dirStrength * ring * arc);

  float ax = abs(p.x);
  float ay = abs(p.y);
  float m = max(ax, ay);
  float stroke = step(abs(ax - ay), ${F.hitMarkerThickness.toFixed(4)})
    * step(${F.hitMarkerInner.toFixed(4)}, m) * step(m, ${F.hitMarkerOuter.toFixed(4)});
  over(col, al, hitColor, hit * stroke);

  gl_FragColor = vec4(col, al);
}`;

/** Reused: the damage source in camera space. */
const LOCAL = new THREE.Vector3();

export class Feedback {
  /**
   * @param {object} options
   * @param {THREE.Scene} options.scene
   * @param {THREE.Camera} options.camera the one camera, wherever it is parented
   * @param {object} options.emitter
   * @param {object} options.shade
   * @param {object} options.warden
   * @param {() => 'shade'|'warden'} options.role whose view this is, read live
   */
  constructor({ scene, camera, emitter, shade, warden, role }) {
    this.camera = camera;
    this.emitter = emitter;
    this.shade = shade;
    this.warden = warden;
    this.role = role;

    this.uniforms = {
      aspect: { value: 1 },
      vignette: { value: 0 },
      hit: { value: 0 },
      dirStrength: { value: 0 },
      dirAngle: { value: 0 },
      vignetteColor: { value: new THREE.Color(F.vignetteColor) },
      hitColor: { value: new THREE.Color(F.hitMarkerColor) },
      dirColor: { value: new THREE.Color(F.indicatorColor) },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: this.uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    // Two triangles over the whole of clip space.
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -1, -1, 0, 1, -1, 0, 1, 1, 0,
      -1, -1, 0, 1, 1, 0, -1, 1, 0,
    ], 3));
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'feedback';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1000;
    this.mesh.visible = false;
    scene.add(this.mesh);

    /** Seconds left on the hit marker. */
    this.hitTimer = 0;
    /** Seconds left on the direction arc, and where the damage came from. */
    this.indicatorTimer = 0;
    this.indicatorFrom = new THREE.Vector3();

    this._unsubscribe = [];
    this._subscribe();
  }

  _subscribe() {
    if (!this.emitter) return;
    const on = (event, handler) => this._unsubscribe.push(this.emitter.on(event, handler));
    // Damage to the human's actor, from somewhere combat knew about.
    on('combat:damage', (event) => {
      if (event.target !== this.role() || !event.at) return;
      this.indicate(event.at);
    });
    // A landed shot of the human's: the Shade's knife and taser, the
    // Warden's round on the Shade.
    on('combat:knife-hit', () => { if (this.role() === 'shade') this.mark(); });
    on('gadget:taser', () => { if (this.role() === 'shade') this.mark(); });
    on('combat:impact', (event) => { if (event.target === 'shade' && this.role() === 'warden') this.mark(); });
    // Presentation, on the wall clock, before the renderer draws the frame.
    on('frame:render', (event) => this.update(event.wallDelta));
    // A new match starts with nothing on screen, whatever the last one left.
    on('match:init', () => this.reset());
  }

  dispose() {
    for (const off of this._unsubscribe) off();
    this._unsubscribe.length = 0;
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }

  /**
   * Compile the quad's program now rather than on the first hit. The soak
   * check counts the renderer's programs before and after a match and calls
   * a new one a leak, and a program that first compiles when the Shade is
   * first shot is exactly that to it.
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} scene
   */
  warm(renderer, scene) {
    this.mesh.visible = true;
    renderer.compile(scene, this.camera);
    this.mesh.visible = false;
  }

  /** The actor whose view this is. */
  get human() {
    return this.role() === 'warden' ? this.warden : this.shade;
  }

  /** Show the hit marker for `hitMarkerTime`. */
  mark() {
    this.hitTimer = F.hitMarkerTime;
  }

  /** Point the arc at a world position for `indicatorTime`. */
  indicate(at) {
    this.indicatorFrom.set(at.x, at.y, at.z);
    this.indicatorTimer = F.indicatorTime;
  }

  reset() {
    this.hitTimer = 0;
    this.indicatorTimer = 0;
    this.update(0);
  }

  /**
   * Advance the timers and write the uniforms. Public so a check can settle
   * the uniforms without drawing a frame, or run the clocks down.
   * @param {number} wallDelta seconds
   */
  update(wallDelta) {
    const dt = Math.max(0, wallDelta || 0);
    this.hitTimer = Math.max(0, this.hitTimer - dt);
    this.indicatorTimer = Math.max(0, this.indicatorTimer - dt);

    const u = this.uniforms;
    const camera = this.camera;
    u.aspect.value = camera.aspect || 1;

    // The vignette scales with lost health while the actor is alive; a dead
    // actor's view is the death camera's, not the body's.
    const actor = this.human;
    const max = actor === this.warden ? CONFIG.warden.health : CONFIG.shade.health;
    u.vignette.value = actor.health > 0 ? F.vignetteMax * (1 - Math.min(1, actor.health / max)) : 0;

    u.hit.value = this.hitTimer > 0 ? Math.min(1, this.hitTimer / (F.hitMarkerTime * 0.5)) : 0;

    if (this.indicatorTimer > 0) {
      // The source in camera space, recomputed every frame so the arc stays
      // on it as the camera turns: forward is -z, right is +x, and the arc
      // sits at that bearing on the ring, 0 at the top, clockwise.
      camera.updateWorldMatrix(true, false);
      LOCAL.copy(this.indicatorFrom);
      camera.worldToLocal(LOCAL);
      u.dirAngle.value = Math.atan2(LOCAL.x, -LOCAL.z);
      u.dirStrength.value = Math.min(1, this.indicatorTimer / (F.indicatorTime * 0.4));
    } else {
      u.dirStrength.value = 0;
    }

    this.mesh.visible = u.vignette.value > 0 || u.hit.value > 0 || u.dirStrength.value > 0;
  }
}

export function createFeedback(options) {
  return new Feedback(options);
}
