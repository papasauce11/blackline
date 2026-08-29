/**
 * BLACKLINE - entities/agentmesh.js
 *
 * The Shade's body.
 *
 * Section 4: lanky. Tall capsule torso, long limbs, small head, oversized boots
 * and gloves. Teal and charcoal. No faces, no hair, no skeletal rig - the
 * controller animates by rotating and translating these primitive groups.
 *
 * Layering (Section 3.1): imports config only. Split out of agent.js, which was
 * 869 lines against the ~600 guidance; construction and control are the natural
 * seam, and nothing here runs after build time.
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';

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
        + '#include <opaque_fragment>'
      );
  };
  // Every body material gets the identical injection, so one constant key is
  // enough to keep them off the unmodified toon program.
  material.customProgramCacheKey = () => 'bl-rim';
  return material;
}

// ---------------------------------------------------------------------------
// Mesh construction
//
// Section 4: lanky. Tall capsule torso, long limbs, small head, oversized boots
// and gloves. Teal and charcoal. No faces, no hair, no skeletal rig.
// ---------------------------------------------------------------------------

export function outlined(geometry, material, group, outlineMaterial) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  group.add(mesh);

  // Child of the mesh, not a sibling of it. Callers reposition the mesh they
  // get back — a limb segment hangs from its pivot — and a sibling outline
  // stays at the pivot instead of following. That left four outline capsules
  // stranded at the shoulders and hips, invisible only for as long as the
  // outline was painted near-black. Parenting makes the drift impossible.
  const outline = new THREE.Mesh(geometry, outlineMaterial);
  outline.scale.setScalar(CONFIG.render.outlineScale);
  mesh.add(outline);
  return mesh;
}

export function buildShadeMesh(gradientMap) {
  const root = new THREE.Group();
  root.name = 'shade';

  // Section 4.2's rim, on the Shade only. Both body materials share one set of
  // uniforms so the per-frame update is a single write.
  const rim = createRimUniforms();
  const teal = addRimLight(new THREE.MeshToonMaterial({ color: P.shadeTeal, gradientMap }), rim);
  const charcoal = addRimLight(new THREE.MeshToonMaterial({ color: P.shadeCharcoal, gradientMap }), rim);
  // One outline material for the whole body, not one per part. Section 4.2
  // drives the edge brightness from the visibility meter every frame, and that
  // has to be a single assignment rather than a walk over nine materials.
  const outline = new THREE.MeshBasicMaterial({ color: P.outline, side: THREE.BackSide, fog: true });

  const H = S.standHeight;

  // Torso: tall capsule.
  const torso = new THREE.Group();
  torso.position.y = H * 0.62;
  torso.userData.baseY = torso.position.y;
  outlined(new THREE.CapsuleGeometry(0.19, H * 0.34, 4, 10), teal, torso, outline);
  root.add(torso);

  // Small head, sat high on the torso.
  const head = new THREE.Group();
  head.position.y = H * 0.29;
  outlined(new THREE.SphereGeometry(0.125, 12, 10), charcoal, head, outline);
  torso.add(head);

  // Long limbs, pivoting from the shoulder and hip.
  const makeLimb = (parent, x, y, length, radius, boot) => {
    const limb = new THREE.Group();
    limb.position.set(x, y, 0);
    const segment = outlined(new THREE.CapsuleGeometry(radius, length, 3, 8), charcoal, limb, outline);
    segment.position.y = -length / 2 - radius;
    // Oversized boots and gloves (Section 4).
    const cap = new THREE.Group();
    cap.position.y = -length - radius * 1.4;
    outlined(new THREE.BoxGeometry(boot, boot * 0.62, boot * 1.25), teal, cap, outline);
    limb.add(cap);
    parent.add(limb);
    return limb;
  };

  const armL = makeLimb(torso, -0.235, H * 0.16, H * 0.3, 0.058, 0.15);
  const armR = makeLimb(torso, 0.235, H * 0.16, H * 0.3, 0.058, 0.15);
  const legL = makeLimb(root, -0.105, H * 0.46, H * 0.4, 0.068, 0.17);
  const legR = makeLimb(root, 0.105, H * 0.46, H * 0.4, 0.068, 0.17);

  root.userData.parts = { torso, head, armL, armR, legL, legR };
  root.userData.materials = { teal, charcoal, outline };
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
