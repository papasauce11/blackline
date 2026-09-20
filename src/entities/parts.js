/**
 * BLACKLINE - entities/parts.js
 *
 * How a figure's part is built: primitives placed and merged into one
 * geometry with a colour per vertex, and an inverted hull merged the same
 * way. The Shade's body (agentmesh.js, E1) and the Warden's (wardenmesh.js,
 * E2) are both six such parts on one toon material and one outline
 * material - twelve draw calls a body - posed as groups by their
 * controllers. Section 4: no skeleton; a merged mesh cannot bend an elbow,
 * and the groups are what animate.
 *
 * The hull is built per primitive, not by scaling the finished part: a limb
 * group's origin is its pivot, and a hull scaled about the shoulder sits
 * 2cm off the glove. Each primitive is grown by a fixed distance on every
 * side about its own centre before it is placed (Section 4's 1.03 was a
 * scale about a capsule's centre; a fixed growth is the same edge on a
 * torso and a visible one on a 4cm arm), and the grown pieces are merged
 * the same way.
 *
 * Layering (Section 3.1): imports three only. Nothing here runs after
 * build time.
 */

import * as THREE from 'three';

/**
 * Merge placed primitives into one indexed geometry with a colour per vertex.
 * @param {{geometry: THREE.BufferGeometry, color: THREE.Color}[]} pieces already transformed
 */
export function mergePieces(pieces) {
  let vertices = 0;
  let indices = 0;
  for (const { geometry } of pieces) {
    vertices += geometry.attributes.position.count;
    indices += geometry.index.count;
  }
  const position = new Float32Array(vertices * 3);
  const normal = new Float32Array(vertices * 3);
  const color = new Float32Array(vertices * 3);
  const index = new Uint16Array(indices);
  let v = 0;
  let i = 0;
  for (const { geometry, color: tint } of pieces) {
    const p = geometry.attributes.position;
    const n = geometry.attributes.normal;
    for (let k = 0; k < p.count; k++) {
      position[(v + k) * 3] = p.getX(k);
      position[(v + k) * 3 + 1] = p.getY(k);
      position[(v + k) * 3 + 2] = p.getZ(k);
      normal[(v + k) * 3] = n.getX(k);
      normal[(v + k) * 3 + 1] = n.getY(k);
      normal[(v + k) * 3 + 2] = n.getZ(k);
      color[(v + k) * 3] = tint.r;
      color[(v + k) * 3 + 1] = tint.g;
      color[(v + k) * 3 + 2] = tint.b;
    }
    const ix = geometry.index;
    for (let k = 0; k < ix.count; k++) index[i + k] = ix.getX(k) + v;
    v += p.count;
    i += ix.count;
    geometry.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(color, 3));
  merged.setIndex(new THREE.BufferAttribute(index, 1));
  merged.computeBoundingSphere();
  return merged;
}

/** The same shell facing inward: mirrored in x (the opening is symmetric about x) and its normals turned. */
export function inward(geometry) {
  geometry.scale(-1, 1, 1);
  const n = geometry.attributes.normal;
  for (let k = 0; k < n.count; k++) n.setXYZ(k, -n.getX(k), -n.getY(k), -n.getZ(k));
  return geometry;
}

/** A primitive grown by `by` metres on every side about its own centre. */
export function grown(geometry, by) {
  geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new THREE.Vector3());
  const d = by * 2;
  return geometry.clone().scale(1 + d / size.x, 1 + d / size.y, 1 + d / size.z);
}

/**
 * One part of a body: the pieces merged into a mesh on `group`, with its
 * hull grown `outline` metres. A piece is a primitive at the origin, a
 * colour, and where it goes in the group: a position `at`, and optionally
 * a `rotation` (Euler x, y, z applied in that order) or a `quaternion`.
 */
export function part(group, pieces, material, outlineMaterial, outline) {
  const place = (geometry, at, rotation, quaternion) => {
    if (quaternion) geometry.applyQuaternion(quaternion);
    if (rotation) geometry.rotateX(rotation.x || 0).rotateY(rotation.y || 0).rotateZ(rotation.z || 0);
    return geometry.translate(at.x || 0, at.y || 0, at.z || 0);
  };
  const body = mergePieces(pieces.map(({ geometry, color, at = {}, rotation, quaternion }) => ({
    geometry: place(geometry.clone(), at, rotation, quaternion), color,
  })));
  const hull = mergePieces(pieces.map(({ geometry, color, at = {}, rotation, quaternion }) => ({
    geometry: place(grown(geometry, outline), at, rotation, quaternion), color,
  })));
  for (const { geometry } of pieces) geometry.dispose();

  const mesh = new THREE.Mesh(body, material);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  group.add(mesh);
  // Child of the mesh, not a sibling of it. Callers reposition the mesh they
  // get back and a sibling outline stays behind; parenting makes the drift
  // impossible (Phase 5).
  const hullMesh = new THREE.Mesh(hull, outlineMaterial);
  mesh.add(hullMesh);
  return mesh;
}
