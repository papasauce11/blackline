/**
 * BLACKLINE — thumbnails.js
 *
 * A picture of every registered map for the main menu's cards (H5). Rendered
 * at boot from a fixed eye, out of the game's own geometry; there are no asset
 * files in this project and this does not add one, so a card costs nothing on
 * the wire and cannot go stale against a map that moved.
 *
 * Layering (Section 3.1): this is the composition root's own code - it takes
 * the renderer and the one camera and hands `ui/` a string. `ui/menu.js` gets
 * a data URL through a getter, exactly as it gets the build stamp (H3), and
 * keeps its single import.
 *
 * What was measured before this was written (H5, `npm run probe`):
 *
 *  - **A map is built once per page load and another map is another page
 *    load**, so there is no yard in memory while you are on the plant. A card
 *    per map means building every registered map. Baking them whole is 632ms
 *    on the plant and 200 on the yard; stopping at the slices that *draw*
 *    (`buildDrawnMap`, `DRAWN_SLICES`) is 346 and 74. The derivations the cut
 *    skips - rooms, the Warden's ground, validation - put nothing in a scene.
 *  - **None of it is on the critical path.** `start()` is called after
 *    `window.BLACKLINE` is published, so boot is exactly as long as H4 left
 *    it; the menu draws its cards empty and fills them in, the way the footer
 *    fills in when the stamp lands.
 *  - **The first eye came back black.** The scene's `FogExp2` is 0.018 and its
 *    colour is the clear colour, so at 100m an 81m site is 96% fog. Fog is off
 *    in a thumbnail scene.
 *  - **The second eye came back black too**, and that one is the maps: they are
 *    lit for a dark stealth interior and an unlit roof at 100m reads at luma 1.
 *    So a card carries its own key and hemisphere on top of the map's rig -
 *    the map's own lights stay, because the yard's lamps are the yard.
 *
 * All of that is look, not rule: D55.
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { listMaps, buildDrawnMap } from './maps/index.js';
import { yieldToPaint } from './bootscreen.js';
import { createScene } from './view.js';

const T = CONFIG.menu.thumbnail;

/**
 * Where the eye goes, from the map's own extent: out along a corner, up, and
 * pointed at the middle. Derived rather than authored, so a third map in the
 * registry gets a card without anyone placing a camera in it.
 *
 * @param {import('./mapkit.js').GameMap} map
 * @returns {{from: THREE.Vector3, at: THREE.Vector3, far: number}}
 */
export function thumbnailEye(map) {
  const bounds = new THREE.Box3();
  const point = new THREE.Vector3();
  for (const box of map.collision.boxes) {
    bounds.expandByPoint(point.set(box.min.x, box.min.y, box.min.z));
    bounds.expandByPoint(point.set(box.max.x, box.max.y, box.max.z));
  }
  const at = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const reach = Math.max(size.x, size.z) || 1;
  return {
    from: new THREE.Vector3(
      at.x + reach * T.out, at.y + reach * T.up, at.z + reach * T.out
    ),
    at,
    far: reach * 4,
  };
}

/**
 * The thumbnails for every registered map, rendered one at a time.
 *
 * @param {object} deps
 * @param {THREE.WebGLRenderer} deps.renderer the live renderer - never a second
 *   one. A second WebGL context is a whole software device and cost 16 seconds
 *   headless when H4 asked for one (TRAPS.md).
 * @param {THREE.PerspectiveCamera} deps.camera the one camera, borrowed and put
 *   back inside a single task, the way `tests/pixels.js` borrows it. The risk
 *   register allows no second camera and this does not make one.
 * @param {THREE.DataTexture} deps.gradientMap the toon ramp every map shares
 * @returns {{start: () => Promise<void>, ready: Promise<void>, get: (id: string) => string|null, record: object}}
 */
export function createThumbnails({ renderer, camera, gradientMap }) {
  /** id -> data URL, filled as each is rendered. */
  const urls = new Map();
  /** What was drawn, for the check and the F3 overlay: per map, and the total. */
  const record = { maps: {}, ms: 0, done: false };
  let started = null;
  let settle = null;
  const ready = new Promise((resolve) => { settle = resolve; });

  /**
   * One map: build what it draws, put it alone in a scene, borrow the camera,
   * render to an offscreen target, read it back and paint it into a 2D canvas.
   *
   * Every step of this happens inside one task on purpose. The camera is the
   * actor rigs' camera and `renderFrame` re-parents it every frame (TRAPS.md),
   * so a yield in the middle would hand a frame a camera pointed at a rooftop.
   *
   * @param {string} id
   * @returns {string} a `data:image/png` URL
   */
  function renderOne(id) {
    const t0 = performance.now();
    const map = buildDrawnMap(id, { gradientMap });
    const built = performance.now();

    const scene = createScene();
    // The game's fog is 0.018 exponential in the clear colour: at the distance
    // that frames a whole site it is the picture. A card is a picture of the
    // place, not a frame of the round.
    scene.fog = null;
    scene.add(map.root);
    // The map's own rig stays - the yard's floodlights and lamps are what the
    // yard looks like - and the card's own key and fill go on top of it,
    // because from outside at 100m an unlit roof reads at luma 1.
    const hemisphere = new THREE.HemisphereLight(
      CONFIG.palette.ambientSky, CONFIG.palette.ambientGround, T.hemisphereIntensity
    );
    scene.add(hemisphere);
    const key = new THREE.DirectionalLight(CONFIG.palette.lightCool, T.keyIntensity);
    scene.add(key);
    scene.add(key.target);

    const eye = thumbnailEye(map);
    key.position.set(eye.from.x, eye.from.y + eye.far * 0.1, eye.from.z);
    key.target.position.copy(eye.at);

    const target = new THREE.WebGLRenderTarget(T.width, T.height);
    const pixels = new Uint8Array(T.width * T.height * 4);
    const wasTarget = renderer.getRenderTarget();
    const wasParent = camera.parent;
    const wasPosition = camera.position.clone();
    const wasQuaternion = camera.quaternion.clone();
    const was = { fov: camera.fov, aspect: camera.aspect, near: camera.near, far: camera.far };

    try {
      camera.fov = T.fov;
      camera.aspect = T.width / T.height;
      camera.near = 0.5;
      camera.far = eye.far;
      camera.position.copy(eye.from);
      camera.lookAt(eye.at.x, eye.at.y, eye.at.z);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);

      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.readRenderTargetPixels(target, 0, 0, T.width, T.height, pixels);
    } finally {
      renderer.setRenderTarget(wasTarget);
      camera.fov = was.fov;
      camera.aspect = was.aspect;
      camera.near = was.near;
      camera.far = was.far;
      camera.position.copy(wasPosition);
      camera.quaternion.copy(wasQuaternion);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      if (wasParent && camera.parent !== wasParent) wasParent.add(camera);
      target.dispose();
      scene.remove(map.root);
    }

    const canvas = document.createElement('canvas');
    canvas.width = T.width;
    canvas.height = T.height;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(T.width, T.height);
    // `readRenderTargetPixels` hands back GL's bottom-up rows; an ImageData is
    // top-down, so the picture arrives upside down unless the rows are flipped.
    for (let y = 0; y < T.height; y++) {
      const row = (T.height - 1 - y) * T.width * 4;
      image.data.set(pixels.subarray(row, row + T.width * 4), y * T.width * 4);
    }
    ctx.putImageData(image, 0, 0);
    const url = canvas.toDataURL('image/png');

    record.maps[id] = {
      buildMs: Math.round(built - t0),
      ms: Math.round(performance.now() - t0),
      boxes: map.collision.boxes.length,
      bytes: url.length,
      eye: [Math.round(eye.from.x), Math.round(eye.from.y), Math.round(eye.from.z)],
    };
    return url;
  }

  return {
    /** The data URL for a map, or null until that one has been rendered. */
    get(id) {
      return urls.get(id) || null;
    },
    /** Resolves when every registered map has a picture. */
    ready,
    record,
    /**
     * Render them all, one per task. Idempotent: a second call hands back the
     * first one's promise rather than drawing everything again.
     *
     * Called after `window.BLACKLINE` is published, so nothing here is inside
     * the boot a player waits on, and the menu re-renders when it lands.
     */
    start() {
      if (started) return started;
      const t0 = performance.now();
      started = (async () => {
        for (const entry of listMaps()) {
          // A real task boundary between maps, never inside one: two bakes and
          // two draws back to back would be the one long block on the main
          // thread that H4 took out of the boot. `await` on a settled promise
          // is a microtask and would not yield at all (TRAPS.md), so this is
          // the same posted message H4's bake lets go of the thread with.
          await yieldToPaint();
          urls.set(entry.id, renderOne(entry.id));
        }
        record.ms = Math.round(performance.now() - t0);
        record.done = true;
        settle();
      })();
      return started;
    },
  };
}
