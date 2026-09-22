/**
 * BLACKLINE - entities/agentmesh.js
 *
 * The Shade's body.
 *
 * Section 4: lanky. Tall capsule torso, long limbs, small head, oversized boots
 * and gloves, and since E1 a hood. Teal and charcoal. No faces, no hair, no
 * skeletal rig - the controller animates by rotating and translating six
 * limb groups, each holding one merged mesh and its hull.
 *
 * Layering (Section 3.1): imports config and parts.js (the merge and the hull,
 * shared with the Warden's body since E2). Split out of agent.js, which was
 * 869 lines against the ~600 guidance; construction and control are the natural
 * seam, and nothing here runs after build time.
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { inward, part } from './parts.js';

const S = CONFIG.shade;
const P = CONFIG.palette;

// ---------------------------------------------------------------------------
// Rim light (Section 4.2)
//
// "The Shade's rim light intensity AND outline brightness are driven directly
// by the smoothed visibility value each frame ... This is a per-frame material
// uniform update on the Shade only."
//
// A fresnel term added to the outgoing light of the Shade's toon materials.
// The alternative — recolouring the inverted-hull outline and calling that a
// rim — is what Phase 5 shipped, and it reads as a thicker edge rather than as
// light catching a shoulder.
//
// Injected by token replacement rather than by rebuilding the shader. Every
// include used here was verified present, and unique, in the pinned r180 toon
// program before this was written (Section 2: "verify the API names for that
// exact version rather than recalling them"):
//
//   vertex   <common>          declarations
//            <project_vertex>  after it, mvPosition exists
//   fragment <common>          declarations
//            <opaque_fragment> before it, outgoingLight is still writable
//
// The view vector is carried on varyings this file declares, so nothing
// depends on which internal varyings three happens to expose for toon.
// ---------------------------------------------------------------------------

const F = CONFIG.detection.feedback;

/**
 * Uniforms shared by every material on the body. One object, so Section 4.2's
 * per-frame update is a single write and the parts cannot drift apart.
 */
export function createRimUniforms() {
  return {
    uBlRimColor: { value: new THREE.Color(P.shadeTeal) },
    uBlRimStrength: { value: F.rimStrengthMin },
    uBlRimPower: { value: F.rimPower },
  };
}

/** Add the fresnel rim to a material, fed from `uniforms`. */
function addRimLight(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    // Assign the shared objects, not copies: writing one .value drives them all.
    shader.uniforms.uBlRimColor = uniforms.uBlRimColor;
    shader.uniforms.uBlRimStrength = uniforms.uBlRimStrength;
    shader.uniforms.uBlRimPower = uniforms.uBlRimPower;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vBlRimNormal;\nvarying vec3 vBlRimView;'
      )
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\n'
        + '\tvBlRimNormal = normalize( normalMatrix * objectNormal );\n'
        + '\tvBlRimView = -mvPosition.xyz;'
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vBlRimNormal;\nvarying vec3 vBlRimView;\n'
        + 'uniform vec3 uBlRimColor;\nuniform float uBlRimStrength;\nuniform float uBlRimPower;'
      )
      .replace(
        '#include <opaque_fragment>',
        // Facing the camera contributes nothing; grazing angles contribute
        // everything. abs() so back faces do not go black.
        '\tfloat blRim = 1.0 - abs( dot( normalize( vBlRimNormal ), normalize( vBlRimView ) ) );\n'
        + '\toutgoingLight += uBlRimColor * pow( blRim, uBlRimPower ) * uBlRimStrength;\n'
        + '#include <opaque_fragment>\n'
        + NO_BLOOM
      );
  };
  // Every body material gets the identical injection, so one constant key is
  // enough to keep them off the unmodified toon program.
  material.customProgramCacheKey = () => 'bl-rim';
  return material;
}

/**
 * A body is not an emissive (E6). The post pipeline's bright pass reads the
 * scene target's alpha as its mask, and an opaque material writes 1 there;
 * a body writes 0, so its rim - which at full meter is brighter than any
 * lamp - grows no halo, and a silhouette at 25m is the body's own. The
 * canvas has no alpha channel, so with the post off this changes nothing.
 */
export const NO_BLOOM = '\tgl_FragColor.a = 0.0;\n';

/** Mark a body material as no emissive: alpha 0 into the scene target. */
export function withoutBloom(material) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\n' + NO_BLOOM);
  };
  material.customProgramCacheKey = () => 'bl-no-bloom';
  return material;
}

// ---------------------------------------------------------------------------
// Mesh construction (E1)
//
// Section 4: lanky. Tall torso, long limbs, small head, oversized boots and
// gloves, teal and charcoal, readable silhouette above all else. No faces,
// no hair, no skeletal rig - the controller animates by rotating and
// translating the six limb GROUPS below (agentvisual.js), exactly as it did
// when each group held two or three primitive meshes.
//
// What E1 changed is what a group holds. Every part - the torso with its
// hood and mantle, the head, each arm with its glove, each leg with its
// boot - is ONE merged geometry with the colours in a vertex attribute, so
// the whole body is six meshes sharing ONE toon material (the rim is on it,
// Section 4.2) and six hulls sharing one outline material: twelve draw
// calls where there were twenty. A skinned mesh would be two, but Section 4
// forbids a rigged skeleton, and a merged mesh cannot bend an elbow.
//
// The hull is built per primitive, grown by `FIGURE.outline` on every side
// about its own centre before it is placed, and merged the same way
// (`part`, parts.js, which says why). `FIGURE` states the proportions;
// D40 argues them.
// ---------------------------------------------------------------------------

/**
 * The figure, in metres and fractions of the standing height. The pivots
 * and the reach of the arms are what they were before E1 (the hanging
 * glove lands on the lip because of them - tests/hang.js reads it); the
 * widths are narrower and the hood is new.
 */
export const FIGURE = {
  /**
   * How far every hull piece is grown on each side: a shade under Section
   * 4's 1.03 on the old torso. The hull and the fresnel rim share the
   * silhouette's outer pixels, and on a thin limb the hull takes them:
   * `the-rim-light-is-really-on-screen` read a wash at 1cm and 1.5x at
   * 5mm on 4.5cm arms; 4mm on 5cm arms reads 2x (D40).
   */
  outline: 0.004,
  /** The capsule's top is the neck: it reaches just under the hood's rim. */
  torso: { pivot: 0.62, radius: 0.14, length: 0.3 },
  head: { pivot: 0.29, radius: 0.11 },
  /**
   * A shell round the head, open at the face and below the drape (D40): the
   * hooded silhouette, wider than the neck under it. `lining` is a second
   * shell just inside, facing in, so the opening shows a dark hood and not
   * the world behind the head.
   */
  hood: { radius: 0.21, lining: 0.2, opening: 0.3 * Math.PI, drape: 0.7 * Math.PI },
  /** A short cowl over the shoulders, its apex under the hood's rim, open underneath. */
  mantle: { top: 0.05, bottom: 0.25, height: 0.14, lift: 0.027 },
  /** Pivot and reach as before E1 (the glove is what hangs from a lip). */
  arm: { x: 0.19, pivot: 0.16, length: 0.3, radius: 0.05, glove: 0.14, reach: 0.081 },
  leg: { x: 0.09, pivot: 0.46, length: 0.4, radius: 0.06, boot: 0.16, reach: 0.095 },
};

export function buildShadeMesh(gradientMap) {
  const root = new THREE.Group();
  root.name = 'shade';

  // Section 4.2's rim, on the Shade only. One body material for the six
  // parts, coloured by vertex, so the per-frame update is a single write:
  // `body.color` scales every tone together (systems/detection.js).
  const rim = createRimUniforms();
  const body = addRimLight(new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap }), rim);
  // One outline material for the whole body, not one per part. Section 4.2
  // drives the edge brightness from the visibility meter every frame, and that
  // has to be a single assignment rather than a walk over the hulls.
  const outline = new THREE.MeshBasicMaterial({ color: P.outline, side: THREE.BackSide, fog: true });

  const H = S.standHeight;
  const teal = new THREE.Color(P.shadeTeal);
  const charcoal = new THREE.Color(P.shadeCharcoal);
  const G = FIGURE;

  // Torso: a narrow capsule, the hood round where the head sits and a cowl
  // over the shoulders, all one piece so the hood turns with the torso and
  // the head turns inside it. The hood is a sphere shell open at the face
  // (the Shade faces -z; three's phi puts -z at 1.5 pi) and open below the
  // drape, so between it and the mantle's apex the silhouette steps in: a
  // hooded head, not a helmet.
  const torso = new THREE.Group();
  torso.position.y = H * G.torso.pivot;
  torso.userData.baseY = torso.position.y;
  const headY = H * G.head.pivot;
  const phiStart = 1.5 * Math.PI + G.hood.opening / 2;
  const phiLength = 2 * Math.PI - G.hood.opening;
  part(torso, [
    { geometry: new THREE.CapsuleGeometry(G.torso.radius, H * G.torso.length, 4, 10), color: teal },
    { geometry: new THREE.SphereGeometry(G.hood.radius, 14, 10, phiStart, phiLength, 0, G.hood.drape), color: teal, at: { y: headY } },
    { geometry: inward(new THREE.SphereGeometry(G.hood.lining, 14, 10, phiStart, phiLength, 0, G.hood.drape)), color: charcoal, at: { y: headY } },
    {
      geometry: new THREE.CylinderGeometry(G.mantle.top, G.mantle.bottom, G.mantle.height, 12, 1, true),
      color: teal,
      at: { y: H * G.arm.pivot + G.mantle.lift },
    },
  ], body, outline, G.outline);
  root.add(torso);

  // Small head, inside the hood; it takes the pitch (agentvisual.js).
  const head = new THREE.Group();
  head.position.y = headY;
  part(head, [{ geometry: new THREE.SphereGeometry(G.head.radius, 12, 10), color: charcoal }], body, outline, G.outline);
  torso.add(head);

  // Long limbs, pivoting from the shoulder and hip: a thin capsule and the
  // oversized glove or boot (Section 4) in one piece. The last child of a
  // limb group is an empty at the glove's or boot's centre, for anything
  // that needs to know where the hand is (the hang, tests/hang.js).
  const makeLimb = (parent, x, y, spec, cap) => {
    const limb = new THREE.Group();
    limb.position.set(x, y, 0);
    const capY = -spec.length * H - spec.reach;
    part(limb, [
      { geometry: new THREE.CapsuleGeometry(spec.radius, spec.length * H, 3, 8), color: charcoal, at: { y: -spec.length * H / 2 - spec.radius } },
      { geometry: new THREE.BoxGeometry(cap, cap * 0.62, cap * 1.25), color: teal, at: { y: capY } },
    ], body, outline, G.outline);
    const end = new THREE.Object3D();
    end.name = 'limb-end';
    end.position.y = capY;
    limb.add(end);
    parent.add(limb);
    return limb;
  };

  const armL = makeLimb(torso, -G.arm.x, H * G.arm.pivot, G.arm, G.arm.glove);
  const armR = makeLimb(torso, G.arm.x, H * G.arm.pivot, G.arm, G.arm.glove);
  const legL = makeLimb(root, -G.leg.x, H * G.leg.pivot, G.leg, G.leg.boot);
  const legR = makeLimb(root, G.leg.x, H * G.leg.pivot, G.leg, G.leg.boot);

  root.userData.parts = { torso, head, armL, armR, legL, legR };
  root.userData.materials = { body, outline };
  root.userData.rim = rim;
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
  mesh.name = 'shade-ground-blob';
  return mesh;
}
