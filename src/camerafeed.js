/**
 * BLACKLINE - camerafeed.js
 *
 * The alarm camera's live feed (Block M, M5): a second, low-resolution render
 * of the world from the placed camera's lens, shown as a picture-in-picture on
 * the Warden's frame while the camera stands, and dark once it is destroyed.
 *
 * **There is no second camera, and this does not make one.** The risk register
 * allows one camera object, `createCamera()` throws on a second, and
 * `single-camera` counts them in the scene graph. So the feed does what
 * thumbnails.js does and what tests/pixels.js does: it borrows the one camera,
 * puts it at the lens, renders, and gives it back - parent, local position,
 * rotation, field of view, aspect, planes and layer mask - in a `finally`, so a
 * throw in the middle cannot leave the player's picture at a wall.
 *
 * **No shadows, no post.** The scene goes straight into a 256x144 target and
 * never through the post chain. The shadow pass is skipped by holding
 * `shadowMap.autoUpdate` off rather than `shadowMap.enabled`: `enabled` is part
 * of three's program cache key, so flipping it twice a frame would swap every
 * lit material's program twice a frame, where `autoUpdate` only decides whether
 * the maps are redrawn. The feed is drawn after the frame's own render, so the
 * maps it samples are this frame's. Fog and the map's lights stay: the lens is
 * a few metres from what it shows, inside the lit map, and it is the 100m card
 * thumbnails.js draws that fog turns black.
 *
 * **Composed as M3's silhouettes are**, a quad drawn over the finished frame by
 * post.js rather than a DOM element: a texture cannot be an `<img>`, and a
 * pixel check can read it back with the rest of the canvas. The quad's vertex
 * shader ignores the camera, so the draw needs no camera of its own either. The
 * HUD (ui/hud.js) owns the frame and the label round it, over the canvas.
 *
 * **It renders only while it is seen.** `update()` renders when a camera stands
 * and the Warden's HUD is up; it never clears the target for a dead camera, it
 * stops. The dark state is a flat panel the quad draws instead of the texture,
 * which costs one draw and no render of the world. `renders` is the count, for
 * the check that holds "stops" to a number rather than a pixel.
 *
 * Layering (Section 3.1): this is composition-root code - three, config, the
 * renderer and the one camera. What it looks at (the camera's transform, who is
 * driving) arrives by injection from boot.js; it imports no system and no `ui/`.
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';

const C = CONFIG.gadgets.alarmCamera;
const F = C.cameraFeed;

const VERTEX = /* glsl */`
uniform vec4 rect;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4( mix( rect.xy, rect.zw, position.xy ), 0.0, 1.0 );
}`;

const FEED = /* glsl */`
uniform sampler2D tFeed;
uniform float opacity;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4( texture2D( tFeed, vUv ).rgb, opacity );
  #include <colorspace_fragment>
}`;

const DARK = /* glsl */`
uniform vec3 colour;
uniform float opacity;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4( colour, opacity );
  #include <colorspace_fragment>
}`;

/** A unit quad: positions and uvs both 0..1, so the vertex shader maps it onto the rectangle. */
function quadGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
}

/**
 * @param {object} deps
 * @param {THREE.WebGLRenderer} deps.renderer the live renderer
 * @param {THREE.PerspectiveCamera} deps.camera the one camera, borrowed and put back
 * @param {THREE.Scene} deps.scene the world
 * @param {import('./emitter.js').Emitter} deps.emitter for the camera's death and a new round
 * @param {() => ({x:number,y:number,z:number,yaw:number}|null)} deps.alarm the placed camera, or null
 * @param {() => boolean} deps.gate whether the Warden's HUD is up: the Warden driving, no panel over the picture
 */
export function createCameraFeed({ renderer, camera, scene, emitter, alarm, gate }) {
  const target = () => new THREE.WebGLRenderTarget(F.width, F.height, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true,
    type: THREE.HalfFloatType,
  });
  let feedTarget = target();

  const rect = { value: new THREE.Vector4() };
  const opacity = { value: F.opacity };
  const feedMaterial = new THREE.ShaderMaterial({
    vertexShader: VERTEX, fragmentShader: FEED, depthTest: false, depthWrite: false, transparent: true,
    uniforms: { rect, opacity, tFeed: { value: feedTarget.texture } },
  });
  const darkMaterial = new THREE.ShaderMaterial({
    vertexShader: VERTEX, fragmentShader: DARK, depthTest: false, depthWrite: false, transparent: true,
    uniforms: { rect, opacity, colour: { value: new THREE.Color(F.deadColor) } },
  });
  const quad = new THREE.Mesh(quadGeometry(), feedMaterial);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);

  const size = new THREE.Vector2();
  const euler = new THREE.Euler();
  const savedPosition = new THREE.Vector3();
  const savedQuaternion = new THREE.Quaternion();
  let dead = false;
  let renders = 0;

  const off = [
    emitter.on('gadget:alarm-placed', () => { dead = false; }),
    emitter.on('gadget:alarm-destroyed', () => { dead = true; }),
    emitter.on('match:init', () => { dead = false; }),
  ];

  /** Where the panel goes on the canvas, in clip space, from the config's shares of the drawing buffer. */
  function place() {
    renderer.getDrawingBufferSize(size);
    const x0 = -1 + 2 * F.anchor.x;
    const y1 = 1 - 2 * F.anchor.y;
    const width = 2 * F.widthShare;
    const height = (width * (F.height / F.width) * size.x) / size.y;
    rect.value.set(x0, y1 - height, x0 + width, y1);
  }

  const feed = {
    /** The feed's picture, for a caller that wants to put it somewhere else. */
    get texture() {
      return feedTarget.texture;
    },
    /** World renders into the target so far: the number "it stops" is held to. */
    get renders() {
      return renders;
    },
    /** `live` while a camera stands, `dead` once it is destroyed, `none` otherwise or when the Warden's HUD is not up. */
    get state() {
      if (!gate()) return 'none';
      if (alarm()) return 'live';
      return dead ? 'dead' : 'none';
    },

    /**
     * Render the world from the lens into the target. Nothing while there is no
     * camera or no Warden HUD: a dead feed is not redrawn black, it is not drawn.
     * The camera is the player's and is back where it was whatever happens.
     */
    update() {
      if (!gate()) return;
      const lens = alarm();
      if (!lens) return;

      const wasTarget = renderer.getRenderTarget();
      const wasAutoClear = renderer.autoClear;
      const wasShadows = renderer.shadowMap.autoUpdate;
      const wasParent = camera.parent;
      const wasMask = camera.layers.mask;
      const was = { fov: camera.fov, aspect: camera.aspect, near: camera.near, far: camera.far };
      savedPosition.copy(camera.position);
      savedQuaternion.copy(camera.quaternion);

      try {
        // Out of whatever rig it hangs on, so the pose below is a world pose.
        if (camera.parent !== scene) scene.add(camera);
        // The lens's own point, the one the lens's lamp is placed at (effects.js).
        camera.position.set(
          lens.x - Math.sin(lens.yaw) * C.bodyLength, lens.y, lens.z - Math.cos(lens.yaw) * C.bodyLength
        );
        camera.quaternion.setFromEuler(euler.set(0, lens.yaw, 0));
        camera.fov = F.fov;
        camera.aspect = F.width / F.height;
        camera.near = F.near;
        camera.far = F.far;
        camera.layers.set(0);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);

        renderer.autoClear = true;
        renderer.shadowMap.autoUpdate = false;
        renderer.setRenderTarget(feedTarget);
        renderer.render(scene, camera);
        renders++;
      } finally {
        renderer.setRenderTarget(wasTarget);
        renderer.autoClear = wasAutoClear;
        renderer.shadowMap.autoUpdate = wasShadows;
        camera.fov = was.fov;
        camera.aspect = was.aspect;
        camera.near = was.near;
        camera.far = was.far;
        camera.layers.mask = wasMask;
        camera.position.copy(savedPosition);
        camera.quaternion.copy(savedQuaternion);
        camera.updateProjectionMatrix();
        if (wasParent) {
          if (camera.parent !== wasParent) wasParent.add(camera);
        } else camera.removeFromParent();
        camera.updateMatrixWorld(true);
      }
    },

    /**
     * Over the finished frame, called by post.js with the silhouettes: render
     * the lens, then lay the picture - or the dark panel - on the canvas.
     */
    draw() {
      const state = feed.state;
      if (state === 'none') return;
      if (state === 'live') feed.update();
      place();
      feedMaterial.uniforms.tFeed.value = feedTarget.texture;
      quad.material = state === 'live' ? feedMaterial : darkMaterial;

      const wasAutoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.setRenderTarget(null);
      renderer.render(quadScene, camera);
      renderer.autoClear = wasAutoClear;
    },

    /** The target follows nothing: it is fixed at the config's size. Kept so a resize has somewhere to call. */
    setSize() {
      place();
    },

    /** A restored context took the target with it; the old one is let go undisposed (post.js has the argument). */
    contextRestored() {
      feedTarget = target();
    },

    dispose() {
      for (const unsubscribe of off) unsubscribe();
      feedTarget.dispose();
      feedMaterial.dispose();
      darkMaterial.dispose();
      quad.geometry.dispose();
    },
  };
  return feed;
}
