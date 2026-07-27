/**
 * BLACKLINE — map.js
 *
 * "Meridian Substation". Level geometry, collision volumes, spawns, plant
 * sites, lights and AI waypoints.
 *
 * Layering (Section 3.1): may import from physics and config.
 *
 * The central rule of this file (Section 5): every visual is generated from the
 * same data the collision solver reads. `addSolid()` creates the mesh and the
 * CollisionBox together from one spec, and the affordance markings are emitted
 * in a single pass over the collision boxes using `classifyLedge()` — the same
 * function the Shade controller calls. A stripe cannot disagree with what the
 * controller will actually let you climb, because neither is authored by hand.
 *
 * Coordinates: X spans -30..30 (60m), Z spans -22.5..22.5 (45m), Y is up.
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { CollisionWorld, classifyLedge } from './physics.js';

const M = CONFIG.map;
const P = CONFIG.palette;
const HALF_W = M.width / 2;
const HALF_D = M.depth / 2;

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

/**
 * Toon materials are shared by colour so the whole shell draws from a handful
 * of programs. Per-box contact darkness rides on a vertex-colour attribute
 * (Section 4.1) rather than on a per-box material.
 */
function createMaterialCache(gradientMap) {
  const cache = new Map();
  return {
    toon(color) {
      let material = cache.get(color);
      if (!material) {
        material = new THREE.MeshToonMaterial({ color, gradientMap, vertexColors: true });
        cache.set(color, material);
      }
      return material;
    },
    dispose() {
      for (const material of cache.values()) material.dispose();
      cache.clear();
    },
    get size() {
      return cache.size;
    },
  };
}

// ---------------------------------------------------------------------------
// GameMap
// ---------------------------------------------------------------------------

class GameMap {
  constructor(gradientMap) {
    this.root = new THREE.Group();
    this.root.name = 'meridian-substation';

    this.collision = new CollisionWorld();
    this.materials = createMaterialCache(gradientMap);

    /** @type {{position:THREE.Vector3, yaw:number, name:string}[]} */
    this.shadeSpawns = [];
    this.wardenSpawns = [];
    /** @type {{id:string, position:THREE.Vector3, ring:THREE.Mesh}[]} */
    this.sites = [];
    /** @type {object[]} */
    this.lights = [];
    /** @type {object[]} */
    this.waypoints = [];
    /** @type {object[]} */
    this.ledges = [];
    /** @type {object[]} */
    this.vents = [];

    this.keyLight = null;
    this._siteTime = 0;
    this._outlineGroup = new THREE.Group();
    this._outlineGroup.name = 'outlines';
    this.root.add(this._outlineGroup);
  }

  // -------------------------------------------------------------------------
  // Building blocks
  // -------------------------------------------------------------------------

  /**
   * Create a visual box and its collision volume from one spec. Nothing in this
   * file creates one without the other.
   *
   * @param {object} spec
   * @param {number[]} spec.min [x, y, z]
   * @param {number[]} spec.max [x, y, z]
   * @param {number} [spec.color]
   * @param {boolean} [spec.climbable] top face is a usable ledge
   * @param {boolean} [spec.vent] crouch-only silent volume (non-solid interior)
   * @param {boolean} [spec.solid]
   * @param {boolean} [spec.blocksSight]
   * @param {boolean} [spec.outline] give it an inverted-hull outline
   * @param {string} [spec.tag]
   */
  addSolid(spec) {
    const [x0, y0, z0] = spec.min;
    const [x1, y1, z1] = spec.max;
    const width = x1 - x0;
    const height = y1 - y0;
    const depth = z1 - z0;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const cz = (z0 + z1) / 2;

    const geometry = new THREE.BoxGeometry(width, height, depth);
    applyContactTint(geometry, cy);

    const material = this.materials.toon(spec.color !== undefined ? spec.color : P.concrete);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(cx, cy, cz);
    mesh.name = spec.tag || 'solid';
    // Section 4.1: only the one directional light casts, so receiving is cheap
    // but casting is limited to geometry that reads as an occluder.
    mesh.castShadow = spec.castShadow !== false && height > 0.5;
    mesh.receiveShadow = true;
    this.root.add(mesh);

    if (spec.outline) this._addOutline(mesh, geometry);

    const box = this.collision.addBox(
      { x: x0, y: y0, z: z0 },
      { x: x1, y: y1, z: z1 },
      {
        solid: spec.solid !== false,
        climbable: spec.climbable === true,
        vent: spec.vent === true,
        blocksSight: spec.blocksSight !== false,
        tag: spec.tag,
      }
    );
    box.mesh = mesh;
    return box;
  }

  /** Section 4: inverted hull. Duplicate mesh, BackSide, scaled 1.03. */
  _addOutline(mesh, geometry) {
    const outline = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ color: P.outline, side: THREE.BackSide, fog: true })
    );
    outline.position.copy(mesh.position);
    outline.scale.setScalar(CONFIG.render.outlineScale);
    outline.castShadow = false;
    outline.receiveShadow = false;
    this._outlineGroup.add(outline);
  }

  /** A flat, unlit decal lying on a surface. Used for markings and site rings. */
  _addDecal(geometry, color, position, rotationX, opacity = 1) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthWrite: false,
      fog: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.rotation.x = rotationX;
    this.root.add(mesh);
    return mesh;
  }

  // -------------------------------------------------------------------------
  // Affordance markings (Section 5) — ONE pass, driven by the collision flags
  // -------------------------------------------------------------------------

  /**
   * For every climbable collision box, work out how high its top face sits
   * above whatever you would be standing on to climb it, classify that height
   * with the same `classifyLedge()` the controller uses, and emit the marking
   * the spec assigns to that band.
   *
   * Nothing here is authored per-ledge. Flip `climbable` on a box and its
   * stripe appears; move the box and the band reclassifies.
   */
  generateAffordanceMarkings() {
    const mark = M.marking;
    const stripeMaterialCache = new Map();

    const stripeMaterial = (intensity) => {
      const key = intensity.toFixed(2);
      let material = stripeMaterialCache.get(key);
      if (!material) {
        const color = new THREE.Color(P.signageTeal).multiplyScalar(intensity);
        material = new THREE.MeshBasicMaterial({ color, fog: true });
        stripeMaterialCache.set(key, material);
      }
      return material;
    };

    for (const box of this.collision.boxes) {
      if (!box.climbable) continue;

      const standY = this._supportHeightBelow(box);
      const rise = box.max.y - standY;
      const band = classifyLedge(rise);
      box.ledgeBand = band;
      if (!band) continue;

      const intensity =
        band === 'vault' ? mark.vaultIntensity : band === 'mantle' ? mark.mantleIntensity : mark.hangIntensity;
      const material = stripeMaterial(intensity);
      const y = box.max.y + mark.stripeInset;
      const t = mark.stripeThickness;

      const edges = [
        { horizontal: true, z: box.min.z + t / 2 },
        { horizontal: true, z: box.max.z - t / 2 },
        { horizontal: false, x: box.min.x + t / 2 },
        { horizontal: false, x: box.max.x - t / 2 },
      ];

      for (const edge of edges) {
        const length = edge.horizontal ? box.max.x - box.min.x : box.max.z - box.min.z;
        if (length <= t) continue;
        const centre = edge.horizontal
          ? new THREE.Vector3(box.centerX, y, edge.z)
          : new THREE.Vector3(edge.x, y, box.centerZ);

        if (band === 'hang') {
          // Section 5: hang edges use a dashed stripe.
          this._addDashedStripe(centre, length, t, edge.horizontal, material);
        } else {
          const geometry = edge.horizontal
            ? new THREE.BoxGeometry(length, t, t)
            : new THREE.BoxGeometry(t, t, length);
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.copy(centre);
          this.root.add(mesh);
        }
      }

      // Section 5: mantle ledges also get chevrons on the face below.
      if (band === 'mantle') this._addChevrons(box, standY, material);

      this.ledges.push({ box, band, topY: box.max.y, standY, rise });
    }
  }

  /**
   * Height of the surface an actor would be standing on to climb this box:
   * the tallest solid top face directly beneath it that is below its own top.
   * Falls back to the ground plane.
   *
   * A candidate must be wide enough to actually stand on. Without this, a thin
   * wall or parapet passing under a ledge is treated as a foothold and collapses
   * the ledge's rise to almost nothing, so it classifies into no band and goes
   * unmarked — which is exactly the drift Section 5 forbids.
   */
  _supportHeightBelow(box) {
    let best = M.groundY;
    const minSupport = CONFIG.shade.radius * 2;
    for (const other of this.collision.boxes) {
      if (other === box || !other.solid) continue;
      if (other.max.y >= box.max.y) continue;
      if (other.max.x - other.min.x < minSupport) continue;
      if (other.max.z - other.min.z < minSupport) continue;
      // Overlapping footprint, allowing a small reach margin either side.
      const margin = CONFIG.shade.vaultReach;
      if (other.max.x < box.min.x - margin || other.min.x > box.max.x + margin) continue;
      if (other.max.z < box.min.z - margin || other.min.z > box.max.z + margin) continue;
      if (other.max.y > best) best = other.max.y;
    }
    return best;
  }

  _addDashedStripe(centre, length, thickness, horizontal, material) {
    const mark = M.marking;
    const period = mark.hangDashLength + mark.hangGapLength;
    const count = Math.max(1, Math.floor(length / period));
    const start = -length / 2 + mark.hangDashLength / 2;
    for (let i = 0; i < count; i++) {
      const offset = start + i * period;
      const geometry = horizontal
        ? new THREE.BoxGeometry(mark.hangDashLength, thickness, thickness)
        : new THREE.BoxGeometry(thickness, thickness, mark.hangDashLength);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        centre.x + (horizontal ? offset : 0),
        centre.y,
        centre.z + (horizontal ? 0 : offset)
      );
      this.root.add(mesh);
    }
  }

  _addChevrons(box, standY, material) {
    const mark = M.marking;
    const faceY = (box.max.y + standY) / 2;
    const spread = mark.chevronHeight * 1.6;
    // Chevrons go on the two longer faces so the route reads from a distance.
    const spanX = box.max.x - box.min.x;
    const spanZ = box.max.z - box.min.z;
    const onX = spanX >= spanZ;

    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < mark.chevronCount; i++) {
        const geometry = onX
          ? new THREE.BoxGeometry(mark.chevronWidth, mark.chevronHeight, mark.stripeThickness)
          : new THREE.BoxGeometry(mark.stripeThickness, mark.chevronHeight, mark.chevronWidth);
        const mesh = new THREE.Mesh(geometry, material);
        const along = (i - (mark.chevronCount - 1) / 2) * spread * 2;
        if (onX) {
          mesh.position.set(
            box.centerX + along,
            faceY,
            side === 0 ? box.min.z - mark.stripeInset : box.max.z + mark.stripeInset
          );
        } else {
          mesh.position.set(
            side === 0 ? box.min.x - mark.stripeInset : box.max.x + mark.stripeInset,
            faceY,
            box.centerZ + along
          );
        }
        mesh.rotation.z = onX ? 0.32 : 0;
        mesh.rotation.x = onX ? 0 : 0.32;
        this.root.add(mesh);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Lights
  // -------------------------------------------------------------------------

  /**
   * Section 4.1 is explicit: the 12 destructible point lights cast NO shadows,
   * and exactly one directional light does, at 1024x1024 with a tight frustum.
   */
  addPointLight(id, x, y, z, intensity, tag) {
    const L = M.lighting;
    const light = new THREE.PointLight(P.lightWarm, intensity, L.pointDistance, L.pointDecay);
    light.position.set(x, y, z);
    light.castShadow = false; // Section 4.1. Never change this.
    this.root.add(light);

    // Fixture housing plus a separate glass element so breaking it is visible.
    const housing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.3, 0.16, 10),
      this.materials.toon(P.wardenGunmetal)
    );
    housing.position.set(x, y + 0.16, z);
    this.root.add(housing);

    const glassMaterial = new THREE.MeshBasicMaterial({ color: P.lightWarm, fog: true });
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), glassMaterial);
    glass.position.set(x, y, z);
    this.root.add(glass);

    const record = {
      lightId: id,
      light,
      housing,
      glass,
      glassMaterial,
      position: new THREE.Vector3(x, y, z),
      intensity,
      range: L.pointDistance,
      broken: false,
      tag,
    };
    this.lights.push(record);
    return record;
  }

  /**
   * Break a light permanently. Callers must also invalidate the visibility
   * cache immediately (Section 7.1, Section 15) — that is wired in Phase 5.
   */
  breakLight(lightId) {
    const record = this.lights.find((entry) => entry.lightId === lightId);
    if (!record || record.broken) return null;
    record.broken = true;
    record.light.intensity = 0;
    record.glassMaterial.color.set(P.brokenGlass);
    return record;
  }

  /** True when the light is alive and should contribute to visibility. */
  activeLights() {
    return this.lights.filter((entry) => !entry.broken);
  }

  // -------------------------------------------------------------------------
  // Waypoints (Section 5: 14 nodes with explicit bidirectional links)
  // -------------------------------------------------------------------------

  addWaypoint(id, x, y, z, tag) {
    const node = { id, position: new THREE.Vector3(x, y, z), links: [], tag };
    this.waypoints[id] = node;
    return node;
  }

  linkWaypoints(a, b) {
    const nodeA = this.waypoints[a];
    const nodeB = this.waypoints[b];
    if (!nodeA || !nodeB) throw new Error(`linkWaypoints: unknown node ${a} or ${b}`);
    if (nodeA.links.indexOf(b) === -1) nodeA.links.push(b);
    if (nodeB.links.indexOf(a) === -1) nodeB.links.push(a);
  }

  /** Nearest waypoint to a world position. */
  nearestWaypoint(position) {
    let best = null;
    let bestDistance = Infinity;
    for (const node of this.waypoints) {
      if (!node) continue;
      const distance = node.position.distanceToSquared(position);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = node;
      }
    }
    return best;
  }

  // -------------------------------------------------------------------------
  // Per-frame
  // -------------------------------------------------------------------------

  /** Section 5: plant site rings pulse slowly. */
  update(dt) {
    this._siteTime += dt;
    const mark = M.marking;
    const phase = (this._siteTime % mark.siteRingPulsePeriod) / mark.siteRingPulsePeriod;
    const wave = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
    const opacity = mark.siteRingPulseMin + (mark.siteRingPulseMax - mark.siteRingPulseMin) * wave;
    for (const site of this.sites) site.ring.material.opacity = opacity;
  }
}

// ---------------------------------------------------------------------------
// Contact tint (Section 4.1: baked vertex tint, applied once at build time)
// ---------------------------------------------------------------------------

function applyContactTint(geometry, centreY) {
  const position = geometry.attributes.position;
  const count = position.count;
  const colors = new Float32Array(count * 3);
  const strength = M.vertexTintStrength;
  const height = M.vertexTintHeight;

  for (let i = 0; i < count; i++) {
    const worldY = position.getY(i) + centreY;
    const t = Math.min(1, Math.max(0, worldY / height));
    const shade = 1 - strength * (1 - t);
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// ---------------------------------------------------------------------------
// buildMap
// ---------------------------------------------------------------------------

/**
 * @param {object} options
 * @param {THREE.DataTexture} options.gradientMap 4-step toon ramp from main.js
 * @returns {GameMap}
 */
export function buildMap({ gradientMap }) {
  const map = new GameMap(gradientMap);
  const G = M.groundY;
  const C = M.catwalkY;
  const CEIL = M.ceilingY;
  const wall = M.wallThickness;
  const V = M.ventFloorY;

  // -------------------------------------------------------------------------
  // Shell: floor, ceiling, perimeter walls
  // -------------------------------------------------------------------------

  map.addSolid({
    min: [-HALF_W, G - M.floorThickness, -HALF_D],
    max: [HALF_W, G, HALF_D],
    color: P.concreteDark,
    tag: 'ground-floor',
    castShadow: false,
  });
  map.addSolid({
    min: [-HALF_W, CEIL, -HALF_D],
    max: [HALF_W, CEIL + wall, HALF_D],
    color: P.concreteDark,
    tag: 'ceiling',
    castShadow: false,
  });

  const perimeter = [
    { min: [-HALF_W - wall, G, -HALF_D], max: [-HALF_W, CEIL, HALF_D], tag: 'wall-west' },
    { min: [HALF_W, G, -HALF_D], max: [HALF_W + wall, CEIL, HALF_D], tag: 'wall-east' },
    { min: [-HALF_W - wall, G, -HALF_D - wall], max: [HALF_W + wall, CEIL, -HALF_D], tag: 'wall-north' },
    { min: [-HALF_W - wall, G, HALF_D], max: [HALF_W + wall, CEIL, HALF_D + wall], tag: 'wall-south' },
  ];
  for (const spec of perimeter) map.addSolid({ ...spec, color: P.concrete });

  // -------------------------------------------------------------------------
  // Interior partitions. The corridor ring is the negative space between the
  // Turbine Hall block, the Loading Bay block and the perimeter.
  // -------------------------------------------------------------------------

  // Vent runs are declared first: the Turbine Hall's east wall is generated
  // around them, so a run can never end up buried inside a wall.
  // Each runs west from the corridor into the hall at crouch height.
  const VENT_X_EAST = -1.0;
  const VENT_X_WEST = -13.0;
  const ventRuns = [
    { z: -16.0, tag: 'vent-north', piercesWall: true },
    // This one lines up with the existing doorway, so it needs no penetration.
    { z: -3.75, tag: 'vent-mid', piercesWall: false },
    { z: 4.0, tag: 'vent-south', piercesWall: true },
  ];
  const ventHalfWidth = M.ventWidth / 2;
  const ventGapLow = V - 0.3;
  const ventGapHigh = V + M.ventHeight + 0.3;

  // Hall east wall, segmented around the doorway and the two vent penetrations.
  const hallWallSpans = [];
  let cursor = -HALF_D;
  const stops = [];
  for (const run of ventRuns) {
    if (!run.piercesWall) continue;
    stops.push({ z0: run.z - ventHalfWidth - 0.05, z1: run.z + ventHalfWidth + 0.05 });
  }
  stops.push({ z0: -6.0, z1: -1.5, doorway: true }); // full-height opening
  stops.sort((a, b) => a.z0 - b.z0);

  for (const stop of stops) {
    if (stop.z0 > cursor) {
      hallWallSpans.push({ z0: cursor, z1: stop.z0, y0: G, y1: CEIL });
    }
    if (!stop.doorway) {
      // Leave a vent-sized hole: wall below it and wall above it.
      hallWallSpans.push({ z0: stop.z0, z1: stop.z1, y0: G, y1: ventGapLow });
      hallWallSpans.push({ z0: stop.z0, z1: stop.z1, y0: ventGapHigh, y1: CEIL });
    }
    cursor = stop.z1;
  }
  if (cursor < 8.0) hallWallSpans.push({ z0: cursor, z1: 8.0, y0: G, y1: CEIL });

  for (let i = 0; i < hallWallSpans.length; i++) {
    const span = hallWallSpans[i];
    map.addSolid({
      min: [-6.0, span.y0, span.z0],
      max: [-6.0 + wall, span.y1, span.z1],
      color: P.concrete,
      tag: `hall-east-wall-${i}`,
    });
  }

  const partitions = [
    { min: [-HALF_W, G, 8.0], max: [-6.0 + wall, CEIL, 8.0 + wall], tag: 'hall-south-wall' },

    // Loading Bay enclosure (east), two roller-door openings on the west face.
    { min: [6.0, G, -HALF_D], max: [6.0 + wall, CEIL, -14.0], tag: 'bay-west-wall-n' },
    { min: [6.0, G, -10.0], max: [6.0 + wall, CEIL, -6.0], tag: 'bay-west-wall-m' },
    { min: [6.0, G, -2.0], max: [6.0 + wall, CEIL, 2.0], tag: 'bay-west-wall-s' },
    { min: [6.0, G, 2.0], max: [HALF_W, CEIL, 2.0 + wall], tag: 'bay-south-wall' },
  ];
  for (const spec of partitions) map.addSolid({ ...spec, color: P.concrete });

  // Roller doors: visual only, set into the two bay openings.
  for (const z of [-12.0, -4.0]) {
    map.addSolid({
      min: [6.0, G + 3.2, z - 2.0],
      max: [6.0 + wall, CEIL, z + 2.0],
      color: P.hazardOrange,
      tag: 'roller-door',
    });
  }

  // -------------------------------------------------------------------------
  // Upper floor slabs: Server Vault, two offices, catwalks over Turbine Hall
  // -------------------------------------------------------------------------

  // Server Vault (south-east upper). Tight, dark, longest approach.
  map.addSolid({
    min: [10.0, C - M.floorThickness, 6.0],
    max: [26.0, C, 19.0],
    color: P.concreteDark,
    tag: 'vault-floor',
    castShadow: false,
  });
  const vaultWalls = [
    { min: [10.0, C, 6.0], max: [10.0 + wall, CEIL, 19.0], tag: 'vault-wall-w' },
    { min: [26.0 - wall, C, 6.0], max: [26.0, CEIL, 19.0], tag: 'vault-wall-e' },
    { min: [10.0, C, 6.0], max: [26.0, CEIL, 6.0 + wall], tag: 'vault-wall-n' },
    { min: [10.0, C, 19.0 - wall], max: [18.0, CEIL, 19.0], tag: 'vault-wall-s-a' },
    { min: [21.0, C, 19.0 - wall], max: [26.0, CEIL, 19.0], tag: 'vault-wall-s-b' },
  ];
  for (const spec of vaultWalls) map.addSolid({ ...spec, color: P.concrete });

  // Server racks: waist-high-plus cover inside the vault.
  for (let i = 0; i < 4; i++) {
    const x = 12.5 + i * 3.2;
    map.addSolid({
      min: [x, C, 9.0],
      max: [x + 1.1, C + 1.9, 16.0],
      color: P.wardenGunmetal,
      outline: true,
      tag: `server-rack-${i}`,
    });
  }

  // Two office rooms (north-east upper) with waist-high cover. The floor is
  // built in four pieces so the drop shaft is a genuine hole in it rather than
  // a decorative lip: x 21.6..25.4, z -18.2..-14.8 is open to the Loading Bay.
  const shaft = { x0: 21.6, x1: 25.4, z0: -18.2, z1: -14.8 };
  const officeFloorPieces = [
    { min: [10.0, C - M.floorThickness, -20.0], max: [shaft.x0, C, -6.0], tag: 'office-floor-w' },
    { min: [shaft.x0, C - M.floorThickness, -20.0], max: [26.0, C, shaft.z0], tag: 'office-floor-n' },
    { min: [shaft.x0, C - M.floorThickness, shaft.z1], max: [26.0, C, -6.0], tag: 'office-floor-s' },
    { min: [shaft.x1, C - M.floorThickness, shaft.z0], max: [26.0, C, shaft.z1], tag: 'office-floor-e' },
  ];
  for (const spec of officeFloorPieces) {
    map.addSolid({ ...spec, color: P.concreteDark, castShadow: false });
  }
  const officeWalls = [
    { min: [10.0, C, -20.0], max: [10.0 + wall, CEIL, -6.0], tag: 'office-wall-w' },
    { min: [26.0 - wall, C, -20.0], max: [26.0, CEIL, -6.0], tag: 'office-wall-e' },
    { min: [10.0, C, -6.0 - wall], max: [26.0, CEIL, -6.0], tag: 'office-wall-s' },
    { min: [17.6, C, -20.0], max: [18.4, CEIL, -12.0], tag: 'office-divider' },
  ];
  for (const spec of officeWalls) map.addSolid({ ...spec, color: P.concrete });

  // Waist-high cover in both offices.
  const coverSpots = [
    [12.5, -17.5], [14.5, -9.0], [19.0, -17.0], [23.0, -10.0],
  ];
  for (let i = 0; i < coverSpots.length; i++) {
    const [x, z] = coverSpots[i];
    map.addSolid({
      min: [x, C, z],
      max: [x + 2.0, C + 0.95, z + 0.8],
      color: P.wardenGunmetal,
      climbable: true,
      outline: true,
      tag: `office-cover-${i}`,
    });
  }

  // Catwalks overlooking the Turbine Hall.
  const catwalks = [
    { min: [-28.0, C - 0.25, -8.0], max: [-6.0, C, -5.0], tag: 'catwalk-north' },
    { min: [-9.6, C - 0.25, -20.0], max: [-6.0, C, -5.0], tag: 'catwalk-east' },
    { min: [-28.0, C - 0.25, 4.0], max: [-14.0, C, 6.4], tag: 'catwalk-south' },
    // North-south spine linking all three vent exit platforms to the catwalk
    // network. Without it the vent runs would dead-end on isolated platforms.
    { min: [-18.0, C - 0.25, -18.0], max: [-15.0, C, 5.2], tag: 'catwalk-spine' },
  ];
  for (const spec of catwalks) {
    map.addSolid({ ...spec, color: P.wardenGunmetal, climbable: true, castShadow: false });
  }

  // A connecting walkway from the catwalks across to the upper east rooms.
  map.addSolid({
    min: [-6.0, C - 0.25, -7.4],
    max: [10.4, C, -5.6],
    color: P.wardenGunmetal,
    climbable: true,
    tag: 'walkway-cross',
    castShadow: false,
  });

  // -------------------------------------------------------------------------
  // Traversal
  // -------------------------------------------------------------------------

  // Crate stacks. Heights are chosen so classifyLedge() lands them in the
  // intended bands: 1.0 vault, 2.3 mantle from the crate, 4.0 mantle from 2.3.
  const stacks = [
    { x: -12.0, z: -12.0, tag: 'stack-hall' },
    { x: 16.0, z: -16.0, tag: 'stack-bay' },
  ];
  for (const stack of stacks) {
    map.addSolid({
      min: [stack.x, G, stack.z],
      max: [stack.x + 2.2, G + 1.0, stack.z + 2.2],
      color: P.hazardOrange,
      climbable: true,
      outline: true,
      tag: `${stack.tag}-low`,
    });
    map.addSolid({
      min: [stack.x + 2.2, G, stack.z + 0.2],
      max: [stack.x + 4.2, G + 2.3, stack.z + 2.0],
      color: P.hazardOrange,
      climbable: true,
      outline: true,
      tag: `${stack.tag}-mid`,
    });
  }

  // A tall container in the Turbine Hall. At 3.0m its top is above the mantle
  // band, so jumping at it fails the mantle and drops into a ledge hang
  // (Section 6.1, and Section 16 check 6). Without a ledge in this band that is
  // actually within reach, the hang mechanic could never be exercised.
  map.addSolid({
    min: [-24.0, G, -10.0],
    max: [-21.0, G + 3.0, -7.0],
    color: P.hazardOrange,
    climbable: true,
    outline: true,
    tag: 'hall-container',
  });

  // Loose vaultable crates scattered for cover and vault practice.
  const looseCrates = [
    [-20.0, 2.0, 0.9], [-24.0, -6.0, 0.7], [2.0, -18.0, 1.0],
    [14.0, -2.0, 0.8], [22.0, -6.0, 1.05], [-2.0, 12.0, 0.75],
    [20.0, 12.0, 0.9],
  ];
  for (let i = 0; i < looseCrates.length; i++) {
    const [x, z, h] = looseCrates[i];
    map.addSolid({
      min: [x, G, z],
      max: [x + 1.5, G + h, z + 1.5],
      color: P.hazardOrange,
      climbable: true,
      outline: true,
      tag: `crate-${i}`,
    });
  }

  // Build the three vent runs declared above. Each is a floor slab at V with
  // side walls and a roof; the lip at V is a mantle up from the ground floor,
  // and the roof makes the run crouch-only.
  for (const run of ventRuns) {
    run.x0 = VENT_X_WEST;
    run.x1 = VENT_X_EAST;
    const w = M.ventWidth;
    const h = M.ventHeight;
    // Floor of the run — climbable, so the entrance lip gets marked.
    map.addSolid({
      min: [run.x0, V - 0.2, run.z - w / 2],
      max: [run.x1, V, run.z + w / 2],
      color: P.concreteDark,
      climbable: true,
      tag: `${run.tag}-floor`,
      castShadow: false,
    });
    // Side walls define the crouch-only tube.
    map.addSolid({
      min: [run.x0, V, run.z - w / 2 - 0.12],
      max: [run.x1, V + h, run.z - w / 2],
      color: P.concreteDark,
      tag: `${run.tag}-wall-a`,
      castShadow: false,
    });
    map.addSolid({
      min: [run.x0, V, run.z + w / 2],
      max: [run.x1, V + h, run.z + w / 2 + 0.12],
      color: P.concreteDark,
      tag: `${run.tag}-wall-b`,
      castShadow: false,
    });
    // Roof: this is what makes it crouch-only. Inset from both ends so each
    // mouth has standing headroom — a mantle onto the lip commits at standing
    // height, so a roof flush to the end would make the run unenterable.
    map.addSolid({
      min: [run.x0 + M.ventMouthLength, V + h, run.z - w / 2],
      max: [run.x1 - M.ventMouthLength, V + h + 0.12, run.z + w / 2],
      color: P.concreteDark,
      vent: true,
      tag: `${run.tag}-roof`,
      castShadow: false,
    });

    // Section 5: vent interior lit by a dim self-illuminated panel so the run
    // reads as passable from outside.
    const panelMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(P.signageTeal).multiplyScalar(M.marking.ventPanelIntensity),
      fog: true,
    });
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(run.x1 - run.x0 - 0.2, 0.04, M.ventWidth - 0.2),
      panelMaterial
    );
    panel.position.set((run.x0 + run.x1) / 2, V + h - 0.06, run.z);
    map.root.add(panel);

    map.vents.push({
      tag: run.tag,
      min: new THREE.Vector3(run.x0, V, run.z - w / 2),
      max: new THREE.Vector3(run.x1, V + h, run.z + w / 2),
    });
  }

  // Exit platform at the west mouth of each run, level with the vent floor.
  // It sits between the vent and the catwalk spine, so the route reads
  // ground -> mantle 2.3 -> crouch the vent -> step out -> mantle 1.7 -> catwalk.
  for (let i = 0; i < ventRuns.length; i++) {
    const run = ventRuns[i];
    map.addSolid({
      min: [-15.0, G, run.z - 1.2],
      max: [VENT_X_WEST, V, run.z + 1.2],
      color: P.concrete,
      climbable: true,
      tag: `vent-exit-platform-${i}`,
    });
  }

  // One-way drop shaft (Section 5). Hazard-striped lip bars ring the hole in
  // the office floor so it reads as a deliberate opening. The surrounding floor
  // is deliberately NOT flagged climbable, which is what makes the route
  // one-way: with no climbable flag there is no ledge to hang from, so ground
  // to upper is blocked exactly as the spec requires.
  const lipBars = [
    { min: [shaft.x0 - 0.2, C, shaft.z0 - 0.2], max: [shaft.x1 + 0.2, C + 0.12, shaft.z0] },
    { min: [shaft.x0 - 0.2, C, shaft.z1], max: [shaft.x1 + 0.2, C + 0.12, shaft.z1 + 0.2] },
    { min: [shaft.x0 - 0.2, C, shaft.z0], max: [shaft.x0, C + 0.12, shaft.z1] },
    { min: [shaft.x1, C, shaft.z0], max: [shaft.x1 + 0.2, C + 0.12, shaft.z1] },
  ];
  for (let i = 0; i < lipBars.length; i++) {
    map.addSolid({ ...lipBars[i], color: P.hazardOrange, tag: `drop-shaft-lip-${i}`, castShadow: false });
  }

  // -------------------------------------------------------------------------
  // Plant sites (Section 5)
  // -------------------------------------------------------------------------

  const siteSpecs = [
    { id: 'A', x: -18.0, y: G, z: -4.0, name: 'Turbine Hall' },
    { id: 'B', x: 18.0, y: G, z: -10.0, name: 'Loading Bay' },
    { id: 'C', x: 18.0, y: C, z: 12.5, name: 'Server Vault' },
  ];
  const ringGeometry = new THREE.RingGeometry(
    M.marking.siteRingInner,
    M.marking.siteRingOuter,
    36
  );
  for (const spec of siteSpecs) {
    const ring = map._addDecal(
      ringGeometry,
      P.hazardOrange,
      new THREE.Vector3(spec.x, spec.y + 0.02, spec.z),
      -Math.PI / 2,
      M.marking.siteRingPulseMax
    );
    map.sites.push({
      id: spec.id,
      name: spec.name,
      position: new THREE.Vector3(spec.x, spec.y, spec.z),
      radius: CONFIG.round.siteRadius,
      ring,
    });
  }

  // -------------------------------------------------------------------------
  // Spawns
  // -------------------------------------------------------------------------

  // Index 0 is the fixed round-start spawn (Section 5). 1-3 are reinsert-only
  // candidates, required by Section 10.2 and Section 15. See PROGRESS.md Q1.
  const shadeSpawnSpecs = [
    { x: -27.0, y: G, z: 19.0, yaw: -Math.PI / 4, name: 'south-west perimeter' },
    { x: 27.0, y: G, z: 19.5, yaw: Math.PI * 0.75, name: 'south-east perimeter' },
    { x: -27.0, y: G, z: -19.5, yaw: Math.PI / 4, name: 'north-west perimeter' },
    { x: 1.0, y: G, z: 19.5, yaw: Math.PI, name: 'south corridor' },
  ];
  for (const spec of shadeSpawnSpecs) {
    map.shadeSpawns.push({ position: new THREE.Vector3(spec.x, spec.y, spec.z), yaw: spec.yaw, name: spec.name });
  }

  const wardenSpawnSpecs = [
    { x: -20.0, y: G, z: -18.0, yaw: Math.PI * 0.75, name: 'turbine hall north' },
    { x: 24.0, y: G, z: -18.0, yaw: Math.PI * 1.25, name: 'loading bay north' },
    { x: 18.0, y: C, z: 16.0, yaw: 0, name: 'server vault' },
    { x: -20.0, y: C, z: -6.8, yaw: Math.PI / 2, name: 'catwalk north' },
  ];
  for (const spec of wardenSpawnSpecs) {
    map.wardenSpawns.push({ position: new THREE.Vector3(spec.x, spec.y, spec.z), yaw: spec.yaw, name: spec.name });
  }

  // -------------------------------------------------------------------------
  // Destructible point lights (Section 5: 12, each with a lightId)
  // -------------------------------------------------------------------------

  const L = M.lighting;
  const bright = L.pointIntensity;
  const dim = L.pointIntensity * 0.45;
  const veryDim = L.pointIntensity * 0.22;

  const lightSpecs = [
    // Turbine Hall — brightly lit, high risk (site A).
    { x: -22.0, y: 6.6, z: -12.0, i: bright, tag: 'hall-1' },
    { x: -22.0, y: 6.6, z: 0.0, i: bright, tag: 'hall-2' },
    { x: -12.0, y: 6.6, z: -12.0, i: bright, tag: 'hall-3' },
    { x: -12.0, y: 6.6, z: 0.0, i: bright, tag: 'hall-4' },
    { x: -18.0, y: 5.4, z: -4.0, i: bright, tag: 'hall-site-a' },
    // Loading Bay — mixed light (site B). These hang BELOW the office floor at
    // y = 4.0, otherwise they light the upper rooms and leave the bay dark.
    { x: 12.0, y: 3.5, z: -16.0, i: dim, tag: 'bay-1' },
    { x: 20.0, y: 3.5, z: -8.0, i: bright, tag: 'bay-2' },
    { x: 28.0, y: 6.4, z: -16.0, i: dim, tag: 'bay-3' },
    // Corridor ring — three destructible ceiling lights (Section 5).
    { x: 0.0, y: 6.8, z: -20.0, i: dim, tag: 'corridor-n' },
    { x: 0.0, y: 6.8, z: 16.0, i: dim, tag: 'corridor-s' },
    { x: -2.0, y: 6.8, z: 4.0, i: dim, tag: 'corridor-w' },
    // Server Vault — lowest light in the map (site C).
    { x: 18.0, y: 7.4, z: 12.0, i: veryDim, tag: 'vault-1' },
  ];
  for (let i = 0; i < lightSpecs.length; i++) {
    const spec = lightSpecs[i];
    map.addPointLight(i, spec.x, spec.y, spec.z, spec.i, spec.tag);
  }

  // Ambient rig. Section 4: one dim hemisphere, 2 directional fills.
  // Section 4.1: exactly one of the directionals casts shadows.
  const hemisphere = new THREE.HemisphereLight(P.ambientSky, P.ambientGround, L.hemisphereIntensity);
  map.root.add(hemisphere);

  const key = new THREE.DirectionalLight(P.lightCool, L.keyIntensity);
  key.position.set(-L.keyDirection[0] * 40, -L.keyDirection[1] * 40, -L.keyDirection[2] * 40);
  key.target.position.set(0, 0, 0);
  key.castShadow = true; // The one and only shadow caster in the scene.
  key.shadow.mapSize.set(CONFIG.render.shadowMapSize, CONFIG.render.shadowMapSize);
  const frustum = CONFIG.render.shadowFrustum;
  key.shadow.camera.left = frustum.left;
  key.shadow.camera.right = frustum.right;
  key.shadow.camera.top = frustum.top;
  key.shadow.camera.bottom = frustum.bottom;
  key.shadow.camera.near = frustum.near;
  key.shadow.camera.far = frustum.far;
  key.shadow.bias = CONFIG.render.shadowBias;
  key.shadow.normalBias = CONFIG.render.shadowNormalBias;
  key.shadow.camera.updateProjectionMatrix();
  map.root.add(key);
  map.root.add(key.target);
  map.keyLight = key;

  const fill = new THREE.DirectionalLight(P.ambientSky, L.fillIntensity);
  fill.position.set(-L.fillDirection[0] * 40, -L.fillDirection[1] * 40, -L.fillDirection[2] * 40);
  fill.castShadow = false;
  map.root.add(fill);
  map.root.add(fill.target);

  // -------------------------------------------------------------------------
  // AI waypoints (Section 5: 14 nodes, explicit bidirectional links, both
  // floors, all three sites)
  // -------------------------------------------------------------------------

  const waypointSpecs = [
    { x: -22.0, y: G, z: -14.0, tag: 'hall-north' },        // 0
    { x: -18.0, y: G, z: -4.0, tag: 'site-a' },             // 1
    { x: -22.0, y: G, z: 4.0, tag: 'hall-south' },          // 2
    { x: -3.0, y: G, z: -19.5, tag: 'corridor-nw' },        // 3
    { x: 0.0, y: G, z: -19.0, tag: 'corridor-n' },          // 4
    { x: 0.0, y: G, z: 0.0, tag: 'corridor-mid' },          // 5
    { x: 0.0, y: G, z: 16.0, tag: 'corridor-s' },           // 6
    { x: 12.0, y: G, z: -16.0, tag: 'bay-north' },          // 7
    { x: 18.0, y: G, z: -10.0, tag: 'site-b' },             // 8
    { x: 25.0, y: G, z: -4.0, tag: 'bay-south' },           // 9
    { x: -18.0, y: C, z: -6.8, tag: 'catwalk-north' },      // 10
    { x: -20.0, y: C, z: 5.2, tag: 'catwalk-south' },       // 11
    { x: 14.0, y: C, z: -12.0, tag: 'office' },             // 12
    { x: 18.0, y: C, z: 12.5, tag: 'site-c' },              // 13
  ];
  for (let i = 0; i < waypointSpecs.length; i++) {
    const spec = waypointSpecs[i];
    map.addWaypoint(i, spec.x, spec.y, spec.z, spec.tag);
  }

  const links = [
    [0, 1], [0, 3], [1, 2], [1, 5], [2, 11], [3, 4], [4, 5], [4, 7],
    [5, 6], [6, 9], [7, 8], [8, 9], [0, 10], [10, 11], [10, 12], [12, 13],
    [9, 13], [3, 10],
  ];
  for (const [a, b] of links) map.linkWaypoints(a, b);

  // -------------------------------------------------------------------------
  // Finish
  // -------------------------------------------------------------------------

  map.collision.build();
  map.generateAffordanceMarkings();
  validateMap(map);

  return map;
}

// ---------------------------------------------------------------------------
// Build-time validation. The counts in Section 5 are contractual, so the map
// asserts them rather than letting a miscount drift in silently.
// ---------------------------------------------------------------------------

function validateMap(map) {
  const problems = [];

  if (map.lights.length !== M.destructibleLightCount) {
    problems.push(`expected ${M.destructibleLightCount} destructible lights, built ${map.lights.length}`);
  }
  if (map.waypoints.length !== M.waypointCount) {
    problems.push(`expected ${M.waypointCount} waypoints, built ${map.waypoints.length}`);
  }
  if (map.shadeSpawns.length !== M.shadeSpawnCount) {
    problems.push(`expected ${M.shadeSpawnCount} shade spawns, built ${map.shadeSpawns.length}`);
  }
  if (map.wardenSpawns.length !== M.wardenSpawnCount) {
    problems.push(`expected ${M.wardenSpawnCount} warden spawns, built ${map.wardenSpawns.length}`);
  }
  if (map.sites.length !== M.plantSiteCount) {
    problems.push(`expected ${M.plantSiteCount} plant sites, built ${map.sites.length}`);
  }

  for (const light of map.lights) {
    if (light.light.castShadow) problems.push(`point light ${light.lightId} casts shadows (Section 4.1)`);
  }

  // Every waypoint must be reachable from node 0, or the AI can strand itself.
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length) {
    const current = queue.shift();
    for (const next of map.waypoints[current].links) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  if (seen.size !== map.waypoints.length) {
    problems.push(`waypoint graph is not connected: ${seen.size}/${map.waypoints.length} reachable from node 0`);
  }

  // Links must be bidirectional (Section 5).
  for (const node of map.waypoints) {
    for (const other of node.links) {
      if (map.waypoints[other].links.indexOf(node.id) === -1) {
        problems.push(`waypoint link ${node.id} -> ${other} is not bidirectional`);
      }
    }
  }

  // Every climbable box must have resolved to a band, or it is unmarked and
  // therefore unusable-looking (Section 16 check 26).
  for (const box of map.collision.boxes) {
    if (box.climbable && box.ledgeBand === null) {
      problems.push(`climbable box "${box.tag}" classified into no band (rise out of range)`);
    }
  }

  if (problems.length) {
    for (const problem of problems) console.error(`[map] ${problem}`);
    throw new Error(`buildMap: ${problems.length} validation failure(s); see console`);
  }
}
