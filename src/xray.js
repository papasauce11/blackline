/**
 * BLACKLINE - xray.js
 *
 * The Shade's x-ray (Block M, M3): `X` toggles it, and while it is on the
 * Warden, a placed alarm camera and a planted charge are drawn as a flat
 * silhouette on top of the frame wherever the rule - `GameMap.seeThroughAlong`,
 * mapxray.js - says her eye can look through to them, and they are within
 * `CONFIG.shade.xray.range`. It looks through thin things and never through a
 * wall, and the rule is the map's: this module asks it and draws the answer.
 * Like night vision it is a picture, not a rule for the body - **it costs the
 * Shade nothing**, and detection never reads it.
 *
 * **One lens.** Night vision and the x-ray are never on together; the wiring
 * (wiring.js) turns the other off when either goes on, so neither module knows
 * the other exists.
 *
 * **On the fixed step, never per frame.** `step()` runs on `sim:step` and finds
 * which targets are seen; a frame only draws what the last step decided. A
 * target is seen if **any** of a few points on it passes - a Warden behind a
 * low crate is seen by the head and chest over it and by the hips through it,
 * and the rule is asked of each. That is the rule's own sightline, so a clear
 * line counts too: a highlighted Warden in the open is fine.
 *
 * **The draw.** A seen body's meshes are rendered a second time with one flat
 * unlit material (no depth test, no depth write, transparent) over the finished
 * canvas. The mechanism is a layer: a mesh that is seen gains `render.xrayLayer`
 * and the second render's camera sees that layer alone, with the scene's
 * `overrideMaterial` set. So the frame with the x-ray off is the frame it has
 * always been - no mesh, material or draw is added to it - and with it on the
 * only draw calls added are the silhouettes' own, one per mesh. The planted
 * charge has no mesh in the world, so it is drawn from a cube of this module's
 * own, in a scene of its own that the world's camera never sees.
 *
 * `seeThroughAlong` queries the collision grid, and `query` hands back one
 * reused array (physics.js, mapxray.js): nothing here walks a live `query`
 * result, the rule is asked of a list of points this module owns.
 *
 * **Held dark behind a menu** as the goggles are: `gate` is a predicate the
 * wiring sets, and the draw is skipped while it says no. The toggle stands.
 *
 * Layering (Section 3.1): three and config. What it looks at arrives by
 * injection (boot.js), so it imports no system and the renderer owns no state.
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';

const S = CONFIG.shade;
const W = CONFIG.warden;
const X = S.xray;

/** The layer a seen mesh gains and the silhouette camera sees alone (`render.xrayLayer`). */
const LAYER = CONFIG.render.xrayLayer;

/**
 * Where on the Warden's body the rule is asked, as shares of its stand height
 * above the feet: the head (the eye), the chest and the hips. Three, so a body
 * behind a low solid is found by the part that is over it or by the part that
 * is through it.
 */
const WARDEN_POINTS = [W.eyeHeightRatio, 0.72, 0.5].map((share) => share * W.standHeight);

/** The meshes of a root that are drawn as silhouette: the body's, not the inverted hulls that outline it. */
function silhouetteMeshes(root) {
  const out = [];
  root.traverse((object) => {
    if (object.isMesh && !(object.userData && object.userData.isOutline)) out.push(object);
  });
  return out;
}

/**
 * @param {object} options
 * @param {import('./mapkit.js').GameMap} options.map
 * @param {THREE.Scene} options.scene the world; only its `overrideMaterial` and `background` are borrowed, in `draw`
 * @param {object} options.shade the Shade, for her eye
 * @param {object} options.warden the Warden, for its feet
 * @param {() => ({x:number,y:number,z:number}|null)} options.alarm the placed camera's position, or null
 * @param {THREE.Object3D} options.alarmRoot the camera's fixture, drawn when it is seen
 * @param {() => ({x:number,y:number,z:number}|null)} options.charge the planted charge's foot position, or null
 */
export function createXray({ map, shade, warden, alarm, alarmRoot, charge }) {
  const material = new THREE.MeshBasicMaterial({
    color: X.color, transparent: true, opacity: X.opacity, depthTest: false, depthWrite: false, toneMapped: false, fog: false,
  });
  const marker = new THREE.Mesh(new THREE.BoxGeometry(X.chargeSize, X.chargeSize, X.chargeSize), material);
  marker.layers.set(LAYER);
  marker.visible = false;
  marker.frustumCulled = false;
  const markerScene = new THREE.Scene();
  markerScene.add(marker);

  /** What can be seen, by name: its meshes (found when first needed) and whether it is drawn now. */
  const targets = {
    warden: { root: warden.mesh, meshes: null, seen: false },
    alarm: { root: alarmRoot, meshes: null, seen: false },
    charge: { root: null, meshes: [marker], seen: false },
  };

  const eye = { x: 0, y: 0, z: 0 };
  const point = { x: 0, y: 0, z: 0 };
  let on = false;
  let gate = () => true;
  let drawn = 0;

  /** Is the point inside the range and one the rule looks through to? */
  const seesPoint = (x, y, z) => {
    point.x = x; point.y = y; point.z = z;
    const dx = x - eye.x;
    const dy = y - eye.y;
    const dz = z - eye.z;
    if (dx * dx + dy * dy + dz * dz > X.range * X.range) return false;
    return map.seeThroughAlong(eye, point).seeThrough;
  };

  /** Put a target's meshes on the silhouette layer or take them off; the marker is its own and shown, not layered. */
  const show = (target, value) => {
    if (target.seen === value) return;
    target.seen = value;
    if (!target.meshes) target.meshes = silhouetteMeshes(target.root);
    for (const mesh of target.meshes) {
      if (target === targets.charge) mesh.visible = value;
      else if (value) mesh.layers.enable(LAYER);
      else mesh.layers.disable(LAYER);
    }
    drawn = 0;
    for (const t of Object.values(targets)) if (t.seen) drawn += t.meshes.length;
  };

  const xray = {
    /** The player's toggle. */
    get on() {
      return on;
    },
    /** Off takes every silhouette back, so what is off holds nothing. */
    setOn(value) {
      on = !!value;
      if (!on) for (const target of Object.values(targets)) show(target, false);
      return on;
    },
    /** Hold it dark while `allowed()` says no (a menu is up). Nothing given, always allowed. */
    setGate(allowed) {
      gate = typeof allowed === 'function' ? allowed : () => true;
    },
    /** What is seen now, by name, for the checks. */
    get seen() {
      return Object.keys(targets).filter((name) => targets[name].seen);
    },
    /** Silhouette meshes this frame will draw: the draw calls it adds, at most. */
    get drawnMeshes() {
      return drawn;
    },
    /** Does the frame draw anything of it: on, not held dark, and something is seen. */
    get drawing() {
      return on && drawn > 0 && gate();
    },

    /** One fixed step: who is seen from her eye. Off, there is nothing to find. */
    step() {
      if (!on) return;
      eye.x = shade.position.x;
      eye.y = shade.feetY + shade.height * S.eyeHeightRatio;
      eye.z = shade.position.z;

      const feet = warden.feetY;
      const wx = warden.position.x;
      const wz = warden.position.z;
      show(targets.warden, WARDEN_POINTS.some((up) => seesPoint(wx, feet + up, wz)));

      const camera = alarm();
      show(targets.alarm, !!camera && seesPoint(camera.x, camera.y, camera.z));

      const at = charge();
      if (at) marker.position.set(at.x, at.y + X.chargeSize / 2, at.z);
      show(targets.charge, !!at && seesPoint(at.x, at.y + X.chargeSize / 2, at.z));
    },

    /**
     * Draw the silhouettes over whatever is on the canvas. The camera's layer
     * mask, the scene's background and override and the renderer's `autoClear`
     * are borrowed and given back; a Color background would clear the canvas
     * whatever `autoClear` says, so it comes off for the draw (as post's
     * overlay does).
     */
    draw(renderer, world, camera) {
      const mask = camera.layers.mask;
      const autoClear = renderer.autoClear;
      const background = world.background;
      const override = world.overrideMaterial;
      camera.layers.set(LAYER);
      renderer.autoClear = false;
      renderer.setRenderTarget(null);
      if (drawn > (targets.charge.seen ? 1 : 0)) {
        world.background = null;
        world.overrideMaterial = material;
        renderer.render(world, camera);
        world.background = background;
        world.overrideMaterial = override;
      }
      if (targets.charge.seen) renderer.render(markerScene, camera);
      renderer.autoClear = autoClear;
      camera.layers.mask = mask;
    },

    dispose() {
      xray.setOn(false);
      marker.geometry.dispose();
      material.dispose();
    },
  };
  return xray;
}
