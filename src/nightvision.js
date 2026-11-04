/**
 * BLACKLINE - nightvision.js
 *
 * The Shade's night vision (M1, D50): a screen effect on her view, toggled
 * with `V`. On the frame's linear colour it is `c * gain + lift`, then a
 * green phosphor (the lifted frame's luma times a tint), then grain, then a
 * vignette. It lifts the dark and nothing else: **it costs the body nothing**
 * and detection never reads it - the Shade's problem is being seen, not
 * seeing, so this is a picture and not a rule. The numbers are
 * `CONFIG.shade.nightVision`, and provisional.
 *
 * It has to work at every quality level, and `post.js` draws no post at `low`
 * or with the settings row off (`postEnabled()`, D60). So there are two ways
 * in, and exactly one is used on a frame:
 *
 *  - **post on**: `NIGHT_VISION_GLSL` is spliced into post's composite (a
 *    second material of the same source with `NIGHT_VISION` defined), so it
 *    is a stage of the pass that was going to run anyway - no extra draw,
 *    and it sees the bloom;
 *  - **post off**: `render()` here draws the scene into a target of its own
 *    and composites to the canvas - two draws, and only while it is on. The
 *    target is made the first time that is needed and not before.
 *
 * Off, neither exists in the frame: post's composite is the unchanged material
 * and the unchanged `renderer.render`. The state is a boolean that post.js
 * exposes (`setNightVision`), called from the wiring on the Shade's
 * `nightvision:toggle` - the renderer never imports a system.
 *
 * **Held dark behind a menu.** `gate` is a predicate the wiring sets: the
 * effect draws only while it says yes, and the wiring says no behind a menu,
 * the pause page, the intermission or the briefing, so the picture under them
 * is the one it has always been. The player's toggle is untouched by it.
 *
 * **Deterministic grain.** The noise is a hash of the pixel and `nvFrame`, a
 * counter the caller advances once per fixed step (`tick`) and that starts at
 * zero when the goggles go on. No `Math.random`, nothing from the clock: two
 * runs of one seed on one machine draw the same pixels, and a frame drawn
 * twice between steps is the same frame twice.
 *
 * Layering (Section 3.1): as post.js - three and config.
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';

const NV = CONFIG.shade.nightVision;

/** The scene target's multisampling when night vision draws it itself: the canvas's antialias carried over, as post's (`render.post.samples`). */
const SAMPLES = CONFIG.render.post.samples;

/** The grain counter wraps here, so it stays a small exact float however long the goggles are on. */
const FRAME_WRAP = 4096;

/**
 * The stage, as GLSL: uniforms, a hash and `nightVision()`. The hash is
 * integer arithmetic on the pixel and the counter (GLSL ES 3.00, which every
 * three r180 ShaderMaterial is on WebGL2) and not a `sin()` of them, whose
 * precision is the driver's. The grain rides the tint, so it is green grain.
 */
export const NIGHT_VISION_GLSL = /* glsl */`
uniform float nvGain;
uniform float nvLift;
uniform vec3 nvTint;
uniform float nvGrain;
uniform float nvVignette;
uniform float nvVignetteInner;
uniform float nvVignetteOuter;
uniform float nvFrame;

float nvHash( vec2 pixel, float frame ) {
  uint h = uint( pixel.x ) * 1597334677u ^ uint( pixel.y ) * 3812015801u ^ uint( frame ) * 2654435761u;
  h ^= h >> 15;
  h *= 2246822519u;
  h ^= h >> 13;
  h *= 3266489917u;
  h ^= h >> 16;
  return float( h ) * ( 1.0 / 4294967296.0 );
}

vec3 nightVision( vec3 c, vec2 uv, vec2 pixel, float aspect ) {
  c = c * nvGain + nvLift;
  c = vec3( dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ) ) * nvTint;
  c += ( nvHash( pixel, nvFrame ) - 0.5 ) * nvGrain * nvTint;
  vec2 p = ( uv - 0.5 ) * 2.0;
  p.x *= aspect;
  float r = length( p ) / length( vec2( aspect, 1.0 ) );
  c *= 1.0 - nvVignette * smoothstep( nvVignetteInner, nvVignetteOuter, r );
  return max( c, vec3( 0.0 ) );
}`;

/** The post-off path's composite: the scene target through the stage, to the canvas's colour space. */
const STANDALONE = /* glsl */`
uniform sampler2D tScene;
uniform float aspect;
varying vec2 vUv;
${NIGHT_VISION_GLSL}
void main() {
  vec3 c = nightVision( texture2D( tScene, vUv ).rgb, vUv, gl_FragCoord.xy, aspect );
  gl_FragColor = vec4( c, 1.0 );
  #include <colorspace_fragment>
}`;

const size = new THREE.Vector2();

/**
 * @param {object} options
 * @param {THREE.WebGLRenderer} options.renderer
 * @param {string} options.vertex post's screen-pass vertex shader
 * @param {THREE.BufferGeometry} options.geometry post's one-triangle screen geometry (not disposed here)
 */
export function createNightVision({ renderer, vertex, geometry }) {
  /** The stage's uniform objects, shared by reference with post's night composite so one write reaches both. */
  const uniforms = {
    nvGain: { value: NV.gain },
    nvLift: { value: NV.lift },
    nvTint: { value: new THREE.Vector3(NV.tint[0], NV.tint[1], NV.tint[2]) },
    nvGrain: { value: NV.grain },
    nvVignette: { value: NV.vignette },
    nvVignetteInner: { value: NV.vignetteInner },
    nvVignetteOuter: { value: NV.vignetteOuter },
    nvFrame: { value: 0 },
  };
  const own = { tScene: { value: null }, aspect: { value: 1 }, ...uniforms };
  const material = new THREE.ShaderMaterial({
    vertexShader: vertex, fragmentShader: STANDALONE, uniforms: own, depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(geometry, material);
  quad.frustumCulled = false;
  const passScene = new THREE.Scene();
  passScene.add(quad);
  const passCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let target = null;
  let on = false;
  let gate = () => true;

  const night = {
    uniforms,
    /** The player's toggle. */
    get on() {
      return on;
    },
    /**
     * Switch it, and start the grain from its first pattern: the same press
     * gives the same pixels. Off gives the post-off path's target back, so
     * what is off holds nothing.
     */
    setOn(value) {
      on = !!value;
      uniforms.nvFrame.value = 0;
      if (!on && target) {
        target.dispose();
        target = null;
      }
      return on;
    },
    /** One fixed step: the grain moves. Only while on - off, there is nothing to move. */
    tick() {
      if (on) uniforms.nvFrame.value = (uniforms.nvFrame.value + 1) % FRAME_WRAP;
    },
    /** Hold it dark while `allowed()` says no (a menu is up). Nothing given, always allowed. */
    setGate(allowed) {
      gate = typeof allowed === 'function' ? allowed : () => true;
    },
    /** Does this frame get it: the toggle, and the gate. */
    get active() {
      return on && gate();
    },
    /** The context was lost and is back: a target made before is let go undisposed (post.js, `contextRestored`). */
    forget() {
      target = null;
    },
    /** The scene target, once the post-off path has needed one; for the checks. */
    get sceneTarget() {
      return target;
    },
    /**
     * The post-off path: the scene into this module's target, through the
     * stage to the canvas, then `overlay` (the feedback quad, which post
     * draws over its own composite the same way) on top. The camera's layer
     * mask is borrowed and given back.
     */
    render(world, camera, overlay) {
      renderer.getDrawingBufferSize(size);
      if (!target || target.width !== size.x || target.height !== size.y) {
        if (target) target.dispose();
        target = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), {
          minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, samples: SAMPLES,
          type: THREE.HalfFloatType,
        });
      }
      own.aspect.value = size.x / size.y;
      const mask = camera.layers.mask;
      camera.layers.set(0);
      renderer.setRenderTarget(target);
      renderer.render(world, camera);
      own.tScene.value = target.texture;
      renderer.setRenderTarget(null);
      renderer.render(passScene, passCamera);
      overlay(world, camera);
      camera.layers.mask = mask;
    },
    dispose() {
      if (target) target.dispose();
      target = null;
      material.dispose();
    },
  };
  return night;
}
