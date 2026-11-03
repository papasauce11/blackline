/**
 * BLACKLINE - systems/torch.js
 *
 * The Warden's rifle-mounted torch (K3), on the night map and nowhere else.
 *
 * The yard is dark between its pools (D4), and a Shade who keeps to the dark
 * is invisible to a Warden who walks past her. The torch is the Warden's answer:
 * a spot on the rifle that goes where the Warden looks, so a Shade in the
 * beam is seen whatever the ground around her would have said. Three parts,
 * one object, so none of them can disagree with the others about where the
 * beam is:
 *
 *  - **The light**: a `SpotLight` with `castShadow` false - Section 4.1 keeps
 *    exactly one shadowed light, and `exactly-one-shadow-caster` holds it.
 *  - **The cone**: one additive, transparent mesh with the depth write off,
 *    a single draw call, faded to nothing at the far end. The light alone
 *    lights the floor and not the air, and a beam you cannot see is a beam
 *    the Shade cannot see coming.
 *  - **The geometry detection reads** (`beam`, `covers`): worked out from the
 *    Warden's *simulation* - its position, yaw and pitch - and not from the
 *    drawn rig, which lags it by the position chase and bobs. Detection runs
 *    on the fixed step and a replay must come out the same, so it cannot ask a
 *    transform that only a rendered frame updates.
 *
 * It is parented to the Warden's camera rig, which follows its yaw and pitch,
 * so the AI's sweep (`lookAt`) and the human's mouse both carry the beam with
 * no change to either. On a map that is not `night` (maps/index.js) it is not
 * built: `createTorch` returns null and nothing is added to the scene.
 *
 * The AI's torch is on for the whole round; a human Warden flips theirs with
 * the `torch` key, which arrives as `torch:toggle` on the emitter from the
 * Warden's own step - main.js is not in the path. `match:init` puts it back on.
 * Switching it off drops the light to zero rather than hiding it: a light that
 * comes and goes changes the light count, and three recompiles every lit
 * material's program for that.
 *
 * Layering (Section 3.1): config and three, and the Warden it is handed.
 * Detection is handed this object by the composition root; it never imports it.
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';

const T = CONFIG.warden.torch;
const TAN = Math.tan(T.angle);
const COS = Math.cos(T.angle);

/**
 * The visible cone: apex at the origin, axis down -z (the way the rig looks),
 * open at the far end. The brightness is a vertex colour, so the fade costs
 * nothing at run time: it rises over the first `peak` of the length, so the
 * apex - under the Warden's own nose in first person - is not a bright point,
 * and falls to nothing by the far end.
 */
function buildCone() {
  const C = T.cone;
  const geometry = new THREE.ConeGeometry(T.range * TAN, T.range, C.radialSegments, C.lengthSegments, true);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    // ConeGeometry stands apex up: 0 at the apex, 1 at the far end.
    const along = 0.5 - position.getY(i) / T.range;
    const glow = Math.min(1, along / C.peak) * (1 - along) * (1 - along);
    colors[i * 3] = glow;
    colors[i * 3 + 1] = glow;
    colors[i * 3 + 2] = glow;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.translate(0, -T.range / 2, 0);
  geometry.rotateX(Math.PI / 2);

  const material = new THREE.MeshBasicMaterial({
    color: T.color,
    vertexColors: true,
    transparent: true,
    opacity: C.opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    // Three draws a transparent double-sided mesh in two passes, back then
    // front, to get the blend order right. Additive light has no order, so one
    // pass is the same picture for half the draw calls.
    forceSinglePass: true,
    fog: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'warden-torch-cone';
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/**
 * The beam in the world, from the Warden's simulation: its origin on the
 * rifle (the mount, in the camera rig's frame) and the unit direction it
 * points. The rig's axes under YXZ - right, up and forward - are written out
 * rather than built from a transform, for the reason in the header.
 *
 * @param {import('../entities/enforcer.js').Warden} warden
 * @param {{x:number,y:number,z:number,dx:number,dy:number,dz:number}} out
 */
function beamOf(warden, out) {
  const sy = Math.sin(warden.yaw);
  const cy = Math.cos(warden.yaw);
  const sp = Math.sin(warden.pitch);
  const cp = Math.cos(warden.pitch);
  const M = T.mount;
  out.dx = -sy * cp;
  out.dy = sp;
  out.dz = -cy * cp;
  out.x = warden.position.x + cy * M.x + sp * sy * M.y + out.dx * M.forward;
  out.y = warden.eyeY + cp * M.y + out.dy * M.forward;
  out.z = warden.position.z - sy * M.x + sp * cy * M.y + out.dz * M.forward;
  return out;
}

/**
 * Is `point` inside the beam: within the range, and within the half-angle of
 * its axis? Geometry only - whether the map lets the light reach it is
 * detection's question, asked with the line-of-sight helper it already uses.
 */
function covers(beam, point) {
  const dx = point.x - beam.x;
  const dy = point.y - beam.y;
  const dz = point.z - beam.z;
  const squared = dx * dx + dy * dy + dz * dz;
  if (squared > T.range * T.range) return false;
  const along = dx * beam.dx + dy * beam.dy + dz * beam.dz;
  return along > 0 && along >= COS * Math.sqrt(squared);
}

/**
 * Build the torch for a Warden, or nothing.
 *
 * @param {object} options
 * @param {boolean} options.night whether the map is a night map (`isNightMap`)
 * @param {import('../entities/enforcer.js').Warden} options.warden
 * @param {import('../emitter.js').Emitter} options.emitter
 * @returns {object|null} null on a map that is not a night map, with nothing added to the scene
 */
export function createTorch({ night, warden, emitter }) {
  if (!night) return null;

  const group = new THREE.Group();
  group.name = 'warden-torch';
  group.position.set(T.mount.x, T.mount.y, -T.mount.forward);

  const light = new THREE.SpotLight(T.color, T.intensity, T.range, T.angle, T.penumbra, 2);
  light.name = 'warden-torch-light';
  light.castShadow = false; // Section 4.1. Never change this.
  light.target.position.set(0, 0, -1);
  const cone = buildCone();
  group.add(light, light.target, cone);
  warden.cameraRig.add(group);

  let on = true;
  const apply = () => {
    light.intensity = on ? T.intensity : 0;
    cone.visible = on;
  };

  const torch = {
    group,
    light,
    cone,
    /** The meter a Shade in the beam is raised to (Section 7.1). */
    litLevel: T.litLevel,
    get on() {
      return on;
    },
    setOn(value) {
      on = !!value;
      apply();
      return on;
    },
    toggle() {
      return torch.setOn(!on);
    },
    /** @see beamOf */
    beam: (out) => beamOf(warden, out),
    /** @see covers */
    covers,
  };

  emitter.on('torch:toggle', () => torch.toggle());
  // A round starts with the torch on, whatever the last one left it at.
  emitter.on('match:init', () => torch.setOn(true));
  apply();
  return torch;
}
