/**
 * BLACKLINE - post.js
 *
 * Post-processing (E6, D10): a bloom on the emissives and a vignette on the
 * frame's edge, and nothing else - no tone mapping, no colour grade; the
 * toon look is the scene's and this only adds light where the scene
 * already emits it and takes a little off the corners. Off, `render()` is
 * `renderer.render()` and nothing here costs a draw call.
 *
 * Four passes over the scene's frame, all in one file because three's
 * EffectComposer lives in the addons bundle index.html deliberately does
 * not fetch (the import map pins one file):
 *
 *  1. the scene, into a full-size target (multisampled, so the edges are
 *     what the canvas had) - every object but the feedback quad;
 *  2. the bright pass: the frame thresholded on its luma, at half size,
 *     so what survives is the emissives - route-lit stages, lamp
 *     fixtures, a flash - and not a lit floor (a floor under a lamp reads
 *     0.4; the dimmest emissive 0.85);
 *  3. a separable Gaussian blur of that, `passes` times each way, at
 *     half size, ping-ponging between two targets;
 *  4. the composite to the canvas: the scene plus the blur times
 *     `strength`, times a vignette that falls from 1 at `vignetteInner`
 *     (of the half-diagonal) to `1 - vignetteStrength` at
 *     `vignetteOuter`; then the feedback quad (C3's hit marker and damage
 *     vignette) drawn over the top, on its own layer, so a white hit
 *     marker is not a bloom.
 *
 * The scene target is linear and the composite applies the output colour
 * space transform (`colorspace_fragment`), so the pixels on the canvas
 * are what they were plus the glow: every pixel check reads through this
 * when it is on (pixels.js's lens), because what ships is what is read.
 *
 * `postEnabled()` is the switch: `SETTINGS.post`, the settings row, **and**
 * the quality preset (H10, D60) - `low` draws no post whatever the row says,
 * and the row still remembers what the player chose. `CONFIG.render.post` is
 * the numbers. Layering (Section 3.1): as view.js - three and config.
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { postEnabled } from './quality.js';

const PP = CONFIG.render.post;

/** The layer the feedback quad draws on, over the composite (`render.overlayLayer`). */
const OVERLAY_LAYER = CONFIG.render.overlayLayer;

const VERTEX = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}`;

// The scene target's alpha is the bloom mask: an opaque material writes 1,
// a body writes 0 (agentmesh.js, `NO_BLOOM`) - a body is not an emissive,
// and its rim at full meter is brighter than any lamp. A step, not a
// multiply: the multisample resolve leaves a body's edge pixels half
// covered - alpha 0.5, half the body's brightness - and a bright body's
// edge would bloom into a ring ten pixels wide round it.
const BRIGHT = /* glsl */`
uniform sampler2D tScene;
uniform float threshold;
varying vec2 vUv;
void main() {
  vec4 s = texture2D( tScene, vUv );
  float luma = dot( s.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
  float keep = smoothstep( threshold, threshold + 0.1, luma ) * step( 0.999, s.a );
  gl_FragColor = vec4( s.rgb * keep, 1.0 );
}`;

const BLUR = /* glsl */`
uniform sampler2D tSource;
uniform vec2 step;
varying vec2 vUv;
void main() {
  vec3 sum = texture2D( tSource, vUv ).rgb * 0.227027;
  sum += ( texture2D( tSource, vUv + step * 1.384615 ).rgb + texture2D( tSource, vUv - step * 1.384615 ).rgb ) * 0.316216;
  sum += ( texture2D( tSource, vUv + step * 3.230769 ).rgb + texture2D( tSource, vUv - step * 3.230769 ).rgb ) * 0.070270;
  gl_FragColor = vec4( sum, 1.0 );
}`;

const COMPOSITE = /* glsl */`
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float strength;
uniform float vignetteInner;
uniform float vignetteOuter;
uniform float vignetteStrength;
uniform float aspect;
varying vec2 vUv;
void main() {
  vec3 c = texture2D( tScene, vUv ).rgb + texture2D( tBloom, vUv ).rgb * strength;
  vec2 p = ( vUv - 0.5 ) * 2.0;
  p.x *= aspect;
  float r = length( p ) / length( vec2( aspect, 1.0 ) );
  float edge = smoothstep( vignetteInner, vignetteOuter, r );
  c *= 1.0 - vignetteStrength * edge;
  gl_FragColor = vec4( c, 1.0 );
  #include <colorspace_fragment>
}`;

/** One triangle over clip space, for the screen passes. */
function screenGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  return geometry;
}

/**
 * @param {THREE.WebGLRenderer} renderer
 */
export function createPost(renderer) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  // Half floats: the targets are linear, and the game is dark - a floor at
  // sRGB 8 is linear 0.002, which an 8-bit target rounds to 1/255 and hands
  // back as 13. Every dark tone would have banded to grey.
  const target = (w, h, samples = 0) => new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: samples > 0, samples,
    type: THREE.HalfFloatType,
  });
  let scene = target(size.x, size.y, PP.samples);
  let bright = target(size.x >> 1, size.y >> 1);
  let blurA = target(size.x >> 1, size.y >> 1);

  const uniforms = {
    bright: { tScene: { value: null }, threshold: { value: PP.bloomThreshold } },
    blur: { tSource: { value: null }, step: { value: new THREE.Vector2() } },
    composite: {
      tScene: { value: null }, tBloom: { value: null },
      strength: { value: PP.bloomStrength },
      vignetteInner: { value: PP.vignetteInner }, vignetteOuter: { value: PP.vignetteOuter },
      vignetteStrength: { value: PP.vignetteStrength }, aspect: { value: size.x / size.y },
    },
  };
  const material = (fragment, u) => new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: fragment, uniforms: u, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(screenGeometry(), material(BRIGHT, uniforms.bright));
  quad.frustumCulled = false;
  const passScene = new THREE.Scene();
  passScene.add(quad);
  const passCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const brightMaterial = quad.material;
  const blurMaterial = material(BLUR, uniforms.blur);
  const compositeMaterial = material(COMPOSITE, uniforms.composite);

  const pass = (mat, to) => {
    quad.material = mat;
    renderer.setRenderTarget(to);
    renderer.render(passScene, passCamera);
  };

  const post = {
    uniforms,
    /** The last frame's passes, for the checks: 0 when off. */
    passes: 0,
    /** The targets' sizes, for the checks: the scene's full, the blur's half. */
    get sizes() {
      return { scene: [scene.width, scene.height], bloom: [bright.width, bright.height] };
    },
    /** The scene target, for a check that reads it back. */
    get sceneTarget() {
      return scene;
    },
    get enabled() {
      return postEnabled();
    },
    /**
     * Draw the frame: the scene through the passes when on, straight to
     * the canvas when off. The camera's layer mask is borrowed and given
     * back.
     */
    render(world, camera) {
      // One frame, one count: the renderer's info is reset here and not per
      // pass, so `renderer.info.render.calls` after a frame is the frame's -
      // the scene's draws plus the passes - whichever path drew it.
      renderer.info.autoReset = false;
      renderer.info.reset();
      if (!postEnabled()) {
        renderer.setRenderTarget(null);
        renderer.render(world, camera);
        post.passes = 0;
        return;
      }
      const mask = camera.layers.mask;
      camera.layers.set(0);
      renderer.setRenderTarget(scene);
      renderer.render(world, camera);

      uniforms.bright.tScene.value = scene.texture;
      pass(brightMaterial, bright);
      let from = bright;
      let to = blurA;
      for (let i = 0; i < PP.blurPasses; i++) {
        uniforms.blur.tSource.value = from.texture;
        uniforms.blur.step.value.set(1 / from.width, 0);
        pass(blurMaterial, to);
        uniforms.blur.tSource.value = to.texture;
        uniforms.blur.step.value.set(0, 1 / to.height);
        pass(blurMaterial, from);
      }
      uniforms.composite.tScene.value = scene.texture;
      uniforms.composite.tBloom.value = from.texture;
      pass(compositeMaterial, null);

      // The feedback quad over the composite, on its own layer, unbloomed.
      // The scene's background comes off for it: a Color background clears
      // the canvas whatever `autoClear` says, and took the composite with it.
      camera.layers.set(OVERLAY_LAYER);
      const autoClear = renderer.autoClear;
      const background = world.background;
      renderer.autoClear = false;
      world.background = null;
      renderer.render(world, camera);
      world.background = background;
      renderer.autoClear = autoClear;
      camera.layers.mask = mask;
      post.passes = 3 + 2 * PP.blurPasses;
    },
    /** The targets follow the drawing buffer. */
    setSize() {
      const now = renderer.getDrawingBufferSize(new THREE.Vector2());
      if (now.x === scene.width && now.y === scene.height) return;
      for (const t of [scene, bright, blurA]) t.dispose();
      scene = target(now.x, now.y, PP.samples);
      bright = target(now.x >> 1, now.y >> 1);
      blurA = target(now.x >> 1, now.y >> 1);
      uniforms.composite.aspect.value = now.x / now.y;
    },
    dispose() {
      for (const t of [scene, bright, blurA]) t.dispose();
      for (const m of [brightMaterial, blurMaterial, compositeMaterial]) m.dispose();
      quad.geometry.dispose();
    },
  };
  return post;
}
