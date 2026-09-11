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

/** The renderer, configured as Section 4 asks: saturated, high contrast. */
export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: CONFIG.render.antialias,
    powerPreference: 'high-performance',
    stencil: false,
  });
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
