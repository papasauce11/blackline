/**
 * BLACKLINE - groundview.js
 *
 * Drawing the Warden's reachable ground (Block A7).
 *
 * `map.wardenGround` is 25,000 cells that decide whether a plant is legal, and
 * until this file nothing drew one. A wrong cell was invisible until a plant
 * was refused in play for no apparent reason. This is the F4 test-mode overlay
 * that puts the set on the floor: one flat quad per (column, floor) at the
 * floor's own height, and a brighter quad under the human's actor when it is
 * standing on a cell the Warden could reach.
 *
 * Off by default and off in every match. It is a debugging view of map data,
 * not a marking - the redesign's rule is that the world carries none - so it
 * lives with the F3/F4 tools and nowhere near the HUD.
 *
 * One mesh, built once, toggled by `visible`. Hidden it costs no draw call;
 * shown it costs two. The marker moves; the field never does.
 *
 * Layering (Section 3.1): imports three and config only. The ground arrives
 * as data.
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';

const P = CONFIG.palette;

/** Sit the quads just above the floor so they win the depth test against it. */
const LIFT = 0.02;
/** How much of the cell the quad fills, so the grid reads as a grid. */
const FILL = 0.84;

export class WardenGroundView {
  /**
   * @param {import('./mapground.js').WardenGround} ground
   */
  constructor(ground) {
    this.ground = ground;
    this.root = new THREE.Group();
    this.root.name = 'warden-ground-view';
    this.root.visible = false;

    this.field = new THREE.Mesh(buildField(ground), new THREE.MeshBasicMaterial({
      color: P.shadeTeal,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    }));
    this.field.name = 'warden-ground-field';
    this.field.frustumCulled = false;
    this.root.add(this.field);

    const half = (ground.cell * FILL) / 2;
    const marker = new THREE.PlaneGeometry(half * 2, half * 2);
    marker.rotateX(-Math.PI / 2);
    this.marker = new THREE.Mesh(marker, new THREE.MeshBasicMaterial({
      color: P.hazardOrange,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    }));
    this.marker.name = 'warden-ground-marker';
    this.marker.visible = false;
    this.root.add(this.marker);
  }

  get visible() {
    return this.root.visible;
  }

  setVisible(visible) {
    this.root.visible = !!visible;
    if (!this.root.visible) this.marker.visible = false;
  }

  toggle() {
    this.setVisible(!this.root.visible);
    return this.root.visible;
  }

  /**
   * Put the marker under this actor's feet, on the reachable floor nearest
   * them, or hide it if the actor is somewhere the Warden could never stand.
   * Called once per rendered frame while visible; nothing while hidden.
   *
   * @param {{position:{x:number,y:number,z:number}, feetY:number}} actor
   */
  update(actor) {
    if (!this.root.visible || !actor) return;
    const ground = this.ground;
    const at = ground.indexAt(actor.position.x, actor.position.z);
    if (!at) {
      this.marker.visible = false;
      return;
    }
    const floors = ground.floorsAt(actor.position.x, actor.position.z);
    let best = -1;
    let bestGap = Infinity;
    for (let i = 0; i < floors.length; i++) {
      const gap = Math.abs(floors[i] - actor.feetY);
      if (gap < bestGap) {
        bestGap = gap;
        best = i;
      }
    }
    if (best < 0 || bestGap > CONFIG.warden.stepHeight) {
      this.marker.visible = false;
      return;
    }
    this.marker.visible = true;
    this.marker.position.set(ground.centreX(at.i), floors[best] + LIFT * 2, ground.centreZ(at.j));
  }

  dispose() {
    this.field.geometry.dispose();
    this.field.material.dispose();
    this.marker.geometry.dispose();
    this.marker.material.dispose();
  }
}

/**
 * Every reachable (column, floor) as a flat quad, merged into one geometry so
 * the whole field is one draw call however many cells there are.
 */
function buildField(ground) {
  const half = (ground.cell * FILL) / 2;
  const positions = new Float32Array(ground.count * 4 * 3);
  const indices = new Uint32Array(ground.count * 6);
  let v = 0;
  let i = 0;
  let quad = 0;
  ground.forEach((x, y, z) => {
    const top = y + LIFT;
    positions[v++] = x - half; positions[v++] = top; positions[v++] = z - half;
    positions[v++] = x + half; positions[v++] = top; positions[v++] = z - half;
    positions[v++] = x + half; positions[v++] = top; positions[v++] = z + half;
    positions[v++] = x - half; positions[v++] = top; positions[v++] = z + half;
    const base = quad * 4;
    indices[i++] = base; indices[i++] = base + 2; indices[i++] = base + 1;
    indices[i++] = base; indices[i++] = base + 3; indices[i++] = base + 2;
    quad++;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  return geometry;
}

export function createWardenGroundView(ground) {
  return new WardenGroundView(ground);
}
