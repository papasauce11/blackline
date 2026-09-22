/**
 * BLACKLINE - entities/wardenmesh.js
 *
 * The Warden's body.
 *
 * Section 4: bulky. Wide box chest, short legs, helmet dominates the head,
 * heavy pauldrons. Orange and gunmetal. Since E2 a vest over the chest, a
 * rifle carried across the body, and a broad stance. No faces, no rig - the
 * controller animates by rotating the six limb groups (enforcer.js, through
 * pose.js since E3), each holding one merged mesh and its hull (parts.js),
 * as the Shade's do.
 *
 * What the Shade sees of the Warden is a silhouette in the dark at twenty
 * metres, so the figure is built for that reading first: broad where the
 * Shade is narrow, a helmet that sits on the shoulders where the Shade has
 * a hood over a neck, and a rifle that breaks the outline where the Shade
 * carries nothing. `the-warden-and-the-shade-are-told-apart-by-silhouette-
 * at-25m` (tests/figure.js) reads those three back.
 *
 * Layering (Section 3.1): imports config and parts.js only. Split out of
 * enforcer.js, as agentmesh.js was split out of agent.js: construction and
 * control are the natural seam, and nothing here runs after build time.
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { part } from './parts.js';
import { withoutBloom } from './agentmesh.js';

const W = CONFIG.warden;
const P = CONFIG.palette;

/**
 * The figure, in metres and fractions of the standing height. Heights are
 * fractions of `W.standHeight`; everything else is metres, relative to the
 * group it sits in (the chest group for the torso's pieces, the head and
 * the arms; the root for the legs).
 */
export const WARDEN_FIGURE = {
  /** The hull's growth on every side: thicker than the Shade's 4mm on a body with no rim to share the edge with. */
  outline: 0.006,
  /** The chest group's pivot: the body rolls about it as it walks. */
  torso: { pivot: 0.60 },
  /**
   * The wide orange chest, its top a hand under the helmet's brim; the
   * vest's plates proud of its front and back; a collar at the neck. The
   * shoulder line is set so that at 25m the top seventh of the figure is
   * helmet and nothing else (the check's band is seven rows of forty).
   */
  chest: { width: 0.70, height: 0.36, depth: 0.42, lift: 0.03 },
  vest: { width: 0.52, height: 0.46, depth: 0.09, lift: 0.05 },
  collar: { width: 0.36, height: 0.10, depth: 0.34, lift: 0.41 },
  /** A belt of hips under the chest, over the tops of the legs, so the body is one block from shoulder to thigh. */
  hips: { width: 0.58, height: 0.18, depth: 0.40, lift: -0.29 },
  /** Heavy pauldrons on the shoulders, tilted down at the outer edge; the silhouette's widest row. */
  pauldron: { x: 0.47, lift: 0.25, width: 0.26, height: 0.20, depth: 0.42, tilt: 0.15 },
  /**
   * The helmet dominates the head (Section 4): a dome over a band, its brim
   * as wide as the skull is not, sat on the chest with no neck showing - the
   * silhouette does not step in under it, which is the Shade's hood in
   * reverse. The visor is the only dark thing on the front.
   */
  head: { pivot: 0.236, skull: 0.26 },
  helmet: { radius: 0.21, band: 0.13, lift: 0.10, brim: 0.245, brimHeight: 0.035, brimLift: -0.02 },
  visor: { width: 0.30, height: 0.09, depth: 0.05, lift: 0.0, out: 0.215 },
  /**
   * Thick arms from inside the pauldrons, an orange gauntlet at the end.
   * `rest` is the carry: both arms forward and pulled in to the centreline,
   * the hands together at the grip in front of the belly, the rifle from
   * the right hand ahead and a little down (the low ready - the elbows
   * cannot bend, so the stock is short and the hands are not far apart);
   * enforcer.js poses the arms there and swings them a little as it walks.
   * The rifle is built in the right arm's frame from this pose, so it is
   * in the hands when the arms are here and follows the right hand when
   * they are not (the stun drops it; E3's aim raises it). From the side
   * it reaches 0.8m past the helmet; that is the silhouette the check reads.
   */
  arm: {
    x: 0.45, pivot: 0.144, width: 0.17, length: 0.56, gauntlet: 0.20,
    rest: { left: { x: 1.0, z: 0.6 }, right: { x: 0.7, z: -0.5 } },
  },
  /** Short legs (Section 4) set wide and splayed wider, the boots further apart than the hips. */
  leg: { x: 0.22, pivot: 0.41, width: 0.22, length: 0.78, splay: 0.10, boot: { width: 0.26, height: 0.14, depth: 0.36 } },
  /**
   * The rifle, along its own z from butt to muzzle: a stock and receiver,
   * a barrel, a magazine down and a grip under the right hand. It points
   * where `pitch` (down from level) and `yaw` (toward the left hand) say
   * at the rest pose; `butt` is how far the stock reaches behind the right
   * hand, the muzzle is the rest of the length ahead of it.
   */
  rifle: {
    length: 0.9, butt: 0.18, pitch: -0.35, yaw: 0.1,
    stock: { width: 0.05, height: 0.10, length: 0.42 },
    barrel: { width: 0.035, length: 0.48 },
    magazine: { width: 0.045, height: 0.16, depth: 0.08, at: 0.08 },
    grip: { width: 0.04, height: 0.10, depth: 0.05, at: -0.10 },
  },
};

/** The hand at the end of an arm posed by `rest`, in the chest group's frame. */
function handAt(G, side, rest) {
  const pivot = new THREE.Vector3(side * G.arm.x, W.standHeight * G.arm.pivot, 0);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rest.x, 0, rest.z));
  return { pivot, q, hand: new THREE.Vector3(0, -(G.arm.length + G.arm.gauntlet / 2), 0).applyQuaternion(q).add(pivot) };
}

/**
 * The rifle's pieces, placed in the right arm's local frame so that at the
 * rest pose the grip is in the right hand and the barrel points ahead and
 * down by the figure's `pitch` and `yaw` (forward is -z, as the actors
 * face). Every piece is one colour; the offsets are along the rifle's own
 * axes.
 */
function riflePieces(G, steel) {
  const R = G.rifle;
  const right = handAt(G, 1, G.arm.rest.right);
  const along = new THREE.Vector3(
    -Math.sin(R.yaw) * Math.cos(R.pitch), Math.sin(R.pitch), -Math.cos(R.yaw) * Math.cos(R.pitch)
  );
  const centre = right.hand.clone().addScaledVector(along, R.length / 2 - R.butt);
  // World orientation of the rifle, then both taken into the right arm's frame.
  const orientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), along);
  const inverse = right.q.clone().invert();
  const quaternion = orientation.clone().premultiply(inverse);
  const at = centre.clone().sub(right.pivot).applyQuaternion(inverse);
  const piece = (geometry, offset) => ({
    geometry, color: steel, quaternion,
    at: offset.applyQuaternion(quaternion).add(at),
  });
  const stockZ = -R.length / 2 + R.stock.length / 2;
  return [
    piece(new THREE.BoxGeometry(R.stock.width, R.stock.height, R.stock.length), new THREE.Vector3(0, 0, stockZ)),
    piece(new THREE.BoxGeometry(R.barrel.width, R.barrel.width, R.barrel.length), new THREE.Vector3(0, 0.01, R.length / 2 - R.barrel.length / 2)),
    piece(new THREE.BoxGeometry(R.magazine.width, R.magazine.height, R.magazine.depth), new THREE.Vector3(0, -R.stock.height / 2 - R.magazine.height / 2 + 0.02, R.magazine.at)),
    piece(new THREE.BoxGeometry(R.grip.width, R.grip.height, R.grip.depth), new THREE.Vector3(0, -R.stock.height / 2 - R.grip.height / 2 + 0.02, R.grip.at)),
  ];
}

export function buildWardenMesh(gradientMap) {
  const root = new THREE.Group();
  root.name = 'warden';

  // One toon material for the six parts, coloured by vertex; one outline
  // material for the six hulls. No rim: Section 4.2's is the Shade's only.
  // No rim on the Warden; no bloom either (E6): a body is not an emissive.
  const body = withoutBloom(new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap }));
  const outline = new THREE.MeshBasicMaterial({ color: P.outline, side: THREE.BackSide, fog: true });

  const H = W.standHeight;
  const G = WARDEN_FIGURE;
  const orange = new THREE.Color(P.wardenOrange);
  const gunmetal = new THREE.Color(P.wardenGunmetal);
  const steel = new THREE.Color(P.wardenSteel);

  // Chest: the orange block with the vest's plates proud of it, the hips
  // under it and the pauldrons on it, one piece, rolling together.
  const chest = new THREE.Group();
  chest.position.y = H * G.torso.pivot;
  // The height the bob lifts from (pose.js reads it, as on the Shade's torso).
  chest.userData.baseY = chest.position.y;
  const pauldronAt = (side) => ({
    at: { x: side * G.pauldron.x, y: G.pauldron.lift },
    rotation: { z: -side * G.pauldron.tilt },
  });
  part(chest, [
    { geometry: new THREE.BoxGeometry(G.chest.width, H * G.chest.height, G.chest.depth), color: orange, at: { y: G.chest.lift } },
    { geometry: new THREE.BoxGeometry(G.vest.width, G.vest.height, G.vest.depth), color: gunmetal, at: { y: G.vest.lift, z: -(G.chest.depth + G.vest.depth) / 2 + 0.02 } },
    { geometry: new THREE.BoxGeometry(G.vest.width, G.vest.height, G.vest.depth), color: gunmetal, at: { y: G.vest.lift, z: (G.chest.depth + G.vest.depth) / 2 - 0.02 } },
    { geometry: new THREE.BoxGeometry(G.hips.width, G.hips.height, G.hips.depth), color: gunmetal, at: { y: G.hips.lift } },
    { geometry: new THREE.BoxGeometry(G.collar.width, G.collar.height, G.collar.depth), color: gunmetal, at: { y: G.collar.lift } },
    { geometry: new THREE.BoxGeometry(G.pauldron.width, G.pauldron.height, G.pauldron.depth), color: gunmetal, ...pauldronAt(-1) },
    { geometry: new THREE.BoxGeometry(G.pauldron.width, G.pauldron.height, G.pauldron.depth), color: gunmetal, ...pauldronAt(1) },
  ], body, outline, G.outline);
  root.add(chest);

  // Head: the skull under a domed helmet with a brim, and the visor; it
  // takes the pitch (enforcer.js), helmet and all.
  const head = new THREE.Group();
  head.position.y = H * G.head.pivot;
  const K = G.helmet;
  part(head, [
    { geometry: new THREE.BoxGeometry(G.head.skull, G.head.skull, G.head.skull), color: gunmetal, at: { y: 0.02 } },
    { geometry: new THREE.SphereGeometry(K.radius, 14, 8, 0, 2 * Math.PI, 0, Math.PI / 2), color: gunmetal, at: { y: K.lift } },
    { geometry: new THREE.CylinderGeometry(K.radius, K.radius, K.band, 14, 1), color: gunmetal, at: { y: K.lift - K.band / 2 } },
    { geometry: new THREE.CylinderGeometry(K.brim, K.brim, K.brimHeight, 14, 1), color: gunmetal, at: { y: K.brimLift } },
    { geometry: new THREE.BoxGeometry(G.visor.width, G.visor.height, G.visor.depth), color: steel, at: { y: G.visor.lift, z: -G.visor.out } },
  ], body, outline, G.outline);
  chest.add(head);

  // Limbs pivot from the shoulder and the hip. The last child of a limb
  // group is an empty at the gauntlet's or boot's centre, as on the Shade
  // (E3 will want it).
  const makeLimb = (parent, x, y, pieces, endY) => {
    const limb = new THREE.Group();
    limb.position.set(x, y, 0);
    part(limb, pieces, body, outline, G.outline);
    const end = new THREE.Object3D();
    end.name = 'limb-end';
    end.position.y = endY;
    limb.add(end);
    parent.add(limb);
    return limb;
  };

  const A = G.arm;
  const handY = -(A.length + A.gauntlet / 2);
  const armPieces = () => [
    { geometry: new THREE.BoxGeometry(A.width, A.length, A.width), color: gunmetal, at: { y: -A.length / 2 } },
    { geometry: new THREE.BoxGeometry(A.gauntlet, A.gauntlet, A.gauntlet), color: orange, at: { y: handY } },
  ];
  const armL = makeLimb(chest, -A.x, H * A.pivot, armPieces(), handY);
  // The rifle is the right arm's: it goes where the right hand goes.
  const armR = makeLimb(chest, A.x, H * A.pivot, [...armPieces(), ...riflePieces(G, steel)], handY);

  // Short legs set wide, each splayed outward so the boots stand further
  // apart than the hips: the broad stance.
  const L = G.leg;
  const bootY = -L.length * Math.cos(L.splay) + L.boot.height / 2;
  // The leg hangs from the pivot before it is tilted, so the tilt is about
  // the hip and the boot lands where the tilted leg ends.
  const legPieces = (side) => [
    { geometry: new THREE.BoxGeometry(L.width, L.length, L.width + 0.02).translate(0, -L.length / 2, 0), color: gunmetal, rotation: { z: side * L.splay } },
    { geometry: new THREE.BoxGeometry(L.boot.width, L.boot.height, L.boot.depth), color: gunmetal, at: { x: side * L.length * Math.sin(L.splay), y: bootY, z: -0.04 } },
  ];
  const legL = makeLimb(root, -L.x, H * L.pivot, legPieces(-1), bootY);
  const legR = makeLimb(root, L.x, H * L.pivot, legPieces(1), bootY);

  root.userData.parts = { chest, head, armL, armR, legL, legR };
  root.userData.materials = { body, outline };
  return root;
}

export function buildGroundBlob() {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(CONFIG.effects.groundBlobRadius, 16),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: CONFIG.effects.groundBlobOpacity,
      depthWrite: false,
      fog: true,
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.name = 'warden-ground-blob';
  return mesh;
}
