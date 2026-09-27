/**
 * BLACKLINE — view.js
 *
 * The renderer, the one camera, the toon ramp, the resize and the lost-context
 * watch: everything about the WebGL view that is not the frame loop. main.js
 * calls these once from bootstrap and owns what they return; nothing here
 * knows about actors or systems (Section 3.1).
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';

/** Guard for the risk-register rule: exactly one camera object, ever. */
let camerasCreated = 0;

/**
 * The renderer, configured as Section 4 asks: saturated, high contrast — or
 * **null where there is no WebGL2** (H4).
 *
 * three throws `Error creating WebGL context` from its own constructor when the
 * canvas hands back no context, and until H4 that reached the page as the
 * index.html error panel: a stack trace, to a player whose browser simply
 * cannot run this. Caught here and turned into null, so the composition root can
 * put a sentence on the screen instead.
 *
 * **This is the whole WebGL2 test, and there is deliberately no second one.** A
 * separate `getContext('webgl2')` probe was the first shape of this and had two
 * faults, each worse than the last: probing the *real* canvas hands three back
 * the context that canvas already has and silently drops every attribute below,
 * because `getContext` ignores its second argument once a context exists; and
 * probing a throwaway canvas creates a second SwiftShader device, which measured
 * **16 seconds** headless and would have been paid on every page load, before
 * the renderer then paid it again. Asking whether the renderer can be built
 * costs nothing, cannot disagree with itself, and is the question that matters.
 * A check drives it with a canvas whose `getContext` returns null
 * (`a-browser-without-webgl2-is-told-so-plainly`).
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {THREE.WebGLRenderer|null}
 */
export function createRenderer(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: CONFIG.render.antialias,
      powerPreference: 'high-performance',
      stencil: false,
    });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.render.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Filmic tone mapping flattens toon banding and desaturates the palette.
  // Section 4 asks for saturated, high contrast, so it stays off.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = CONFIG.render.toneMappingExposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

/** The scene, with Section 4's clear colour and fog. */
export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.render.clearColor);
  scene.fog = new THREE.FogExp2(CONFIG.render.fogColor, CONFIG.render.fogDensity);
  return scene;
}

/**
 * Risk register: "One camera object. Reparent and adjust FOV only. Never
 * instantiate a second camera." This is the only place a camera is made, and it
 * refuses to make a second one.
 */
export function createCamera() {
  if (camerasCreated > 0) {
    throw new Error('createCamera: a second camera was requested. Reparent the existing one instead.');
  }
  camerasCreated++;
  const cam = new THREE.PerspectiveCamera(
    CONFIG.render.fov,
    window.innerWidth / window.innerHeight,
    CONFIG.render.near,
    CONFIG.render.far
  );
  cam.name = 'bl-camera';
  return cam;
}

/**
 * Section 4: a 4-step toon ramp. The shader samples the red channel
 * (`texture2D(gradientMap, coord).r`), so a single-channel RedFormat texture
 * with nearest filtering gives hard bands.
 */
export function createToonGradient(steps) {
  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) {
    data[i] = Math.round((i / (steps - 1)) * 255);
  }
  const texture = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Fit the renderer and the camera to the window. Returns the size applied, or
 * null when nothing was.
 *
 * A viewport can report zero transiently — a minimised window, a tab being
 * moved between displays, devtools resizing the emulated frame. Taking it at
 * face value latches a 0x0 drawing buffer and an infinite aspect, and the
 * game then renders nothing until some later resize happens to rescue it.
 * Found when an emulated resize left the canvas 0x0 while CSS still said
 * 1280x720 and every pixel read back black.
 */
export function resizeView(renderer, camera) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (!(width > 0) || !(height > 0)) return null;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.render.maxPixelRatio));
  renderer.setSize(width, height, false);
  return { width, height };
}

/**
 * The GPU can be taken away underneath a running game. Chrome kills a
 * starved GPU process (its watchdog, or a machine under load) and hands
 * every WebGL context back a little later; three.js already prevents the
 * default so the restore happens, and rebuilds its state when it does. What
 * it does not do is tell anyone. While the context is lost every draw is a
 * no-op and every readPixels returns black, so a check measuring pixels in
 * that window fails for a reason that has nothing to do with the game. F1
 * found eight pixel checks red at once, unreproducible, on a loaded PC:
 * the drawing buffer reads 0x0 against a 1280x720 canvas, which is what a
 * lost context reports. Counted here so the suite can tell a lost
 * instrument from a wrong answer, and re-run only what the loss touched.
 */
export function watchContextLoss(canvas, debugState, emitter) {
  debugState.contextLosses = 0;
  debugState.contextLost = false;
  canvas.addEventListener('webglcontextlost', () => {
    debugState.contextLosses++;
    debugState.contextLost = true;
    emitter.emit('view:contextlost', { count: debugState.contextLosses });
  });
  canvas.addEventListener('webglcontextrestored', () => {
    debugState.contextLost = false;
    emitter.emit('view:contextrestored', { count: debugState.contextLosses });
  });
}
