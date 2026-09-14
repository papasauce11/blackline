/**
 * BLACKLINE — mapkit.js
 *
 * The construction kit `map.js` builds "Meridian Substation" out of. This file
 * knows how to make geometry; it knows nothing about the level.
 *
 * Layering (Section 3.1): imports from physics, config and mapbake only, so it
 * sits at the same layer as map.js and map.js imports it. Section 3 lists
 * map.js as the only map file, but Section 3.1 also requires anything past
 * ~600 lines to be split, and the v2 level data alone is larger than that. See
 * PROGRESS.md deviation 12. The build-time geometry helpers — materials, the
 * contact tint, cut lines and geometry merging — live in `mapbake.js`, which is
 * the part of this file that knows nothing about a map.
 *
 * The rule this file exists to enforce (Section 5): a visual and its collision
 * volume are created from one spec, never separately. `addSolid()` is the only
 * way to make either, so they cannot drift apart. Everything above it —
 * staircases, walls with openings, floor plates with voids, vent runs — is a
 * generator that emits `addSolid()` calls, so a hole is subtracted from real
 * geometry rather than faked by leaving a gap in hand-typed coordinates.
 * The generators themselves are `mapgen.js`, installed on this class at the
 * bottom; the climbable-surface derivation is `mapclimb.js` (F3).
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { CollisionWorld } from './physics.js';
import { createMaterialCache, applyContactTint, mergeGeometries } from './mapbake.js';
import { GENERATORS } from './mapgen.js';
import { deriveRoomEntries } from './maprooms.js';
import { deriveWardenGround } from './mapground.js';
import { deriveClimbableSurfaces, supportHeightBelow, supportCandidates, supportApproaches } from './mapclimb.js';

const M = CONFIG.map;
const P = CONFIG.palette;

// ---------------------------------------------------------------------------
// GameMap
// ---------------------------------------------------------------------------

export class GameMap {
  constructor(gradientMap, name) {
    this.root = new THREE.Group();
    this.root.name = name;

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
    /** @type {object[]} */
    this.staircases = [];
    /** @type {object[]} */
    this.rooms = [];
    /**
     * The stairless routes up, declared (v2 requirement 4; B5). Each is a
     * list of stages - boxes at one level, every one climbable from the
     * stage below by the rule - and the height it lands at. Data, not a
     * tag: nothing in the rule or the controller reads it. The checks do.
     * @type {{id:string, name:string, stages:object[][], landing:number}[]}
     */
    this.routes = [];
    /** What B7 lit: `{ stages, edges, mesh }`, filled by lightRoutes() (maproutelight.js). */
    this.routeLighting = null;
    /** Rectangles the upper deck is missing, for the connectivity check. */
    this.deckVoids = [];
    /** The building shell's outer footprint, used to place the Shade outside. */
    this.shell = null;
    /**
     * Where the Warden can stand, derived at build. See mapground.js.
     * @type {import('./mapground.js').WardenGround|null}
     */
    this.wardenGround = null;

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
   * Create a visual box and its collision volume from one spec. Nothing in the
   * codebase creates one without the other.
   *
   * @param {object} spec
   * @param {number[]} spec.min [x, y, z]
   * @param {number[]} spec.max [x, y, z]
   * @param {number} [spec.color]
   * @param {boolean} [spec.vent] crouch-only silent volume
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
    //
    // "Occluder" was `height > 0.5`, which is right for walls and wrong for the
    // things that make an interior an interior. A roof slab is 0.2m thick, so
    // it failed the test — and the one shadowed directional light shone
    // straight through the building onto everything inside it. Measured: with
    // the point lights off, the Server Vault floor rendered BRIGHTER than the
    // Turbine Hall's, because the upper deck was catching an unobstructed key
    // through a roof that was not there as far as the shadow pass knew. That
    // is the opposite of Section 5's "tight, dark" vault, and it flattens the
    // high contrast Section 4 calls the core visual language.
    //
    // A slab is judged by its footprint instead: big in both horizontal axes
    // is an occluder however thin it is. Trim and stripes stay out of the
    // shadow pass, which is what the original test was protecting.
    const broad = width >= M.shadowCasterMinSpan && depth >= M.shadowCasterMinSpan;
    mesh.castShadow = spec.castShadow !== false && (height > 0.5 || broad);
    mesh.receiveShadow = true;
    this.root.add(mesh);

    if (spec.outline) this._addOutline(mesh, geometry);

    const box = this.collision.addBox(
      { x: x0, y: y0, z: z0 },
      { x: x1, y: y1, z: z1 },
      {
        solid: spec.solid !== false,
        vent: spec.vent === true,
        blocksSight: spec.blocksSight !== false,
        tag: spec.tag,
      }
    );
    box.mesh = mesh;
    return box;
  }

  /** Section 4: inverted hull. Duplicate mesh, BackSide, scaled up slightly. */
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
  addDecal(geometry, color, position, rotationX, opacity = 1) {
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
  // Rooms (Section 5 readability: no room is a single-door trap)
  // -------------------------------------------------------------------------

  /**
   * Declare a room. Its entries are not declared — they are derived from the
   * geometry after the map is built, so cutting a doorway or a hatch changes
   * the count and typing a room name does not.
   */
  addRoom(spec) {
    const room = {
      id: spec.id,
      name: spec.name,
      min: { x: spec.min[0], z: spec.min[1] },
      max: { x: spec.max[0], z: spec.max[1] },
      floorY: spec.floorY,
      ceilingY: spec.ceilingY,
      entries: [],
    };
    this.rooms.push(room);
    return room;
  }

  /**
   * Section 5: every room's entries, derived from the geometry rather than
   * declared. The derivation itself lives in maprooms.js.
   */
  deriveRoomEntries() {
    deriveRoomEntries(this.collision, this.rooms);
  }

  /**
   * Flood the Warden's reachable ground from its spawns. Map data, not an
   * objective-system private: whether a waypoint is standable, whether a
   * DEFEND path can complete and where a plant may legally go are all the same
   * question, and three systems were each guessing at it. See mapground.js.
   */
  deriveWardenGround() {
    this.wardenGround = deriveWardenGround(this.collision, this.wardenSpawns);
  }

  // -------------------------------------------------------------------------
  // Climbable surfaces (Section 5, amended) - ONE pass, from the geometry alone
  // -------------------------------------------------------------------------

  /**
   * Decide which surfaces are climbable, from the geometry and the body alone.
   * The rule is mechanical and has no exceptions; it lives in mapclimb.js.
   */
  deriveClimbableSurfaces() {
    deriveClimbableSurfaces(this.collision, this.ledges);
  }

  /** Height of the surface an actor would stand on to climb this box. */
  _supportHeightBelow(box) {
    return supportHeightBelow(this.collision, box);
  }

  /** Every height an actor could be standing on to climb this box, lowest first. */
  _supportCandidates(box) {
    return supportCandidates(this.collision, box);
  }

  /** Every place a body could stand to climb this box: surface, spot and face. */
  _supportApproaches(box) {
    return supportApproaches(this.collision, box);
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
  // Waypoints (Section 5: explicit bidirectional links)
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
  /**
   * The waypoint a body at `position` should head for: the nearest on its
   * own floor if there is one, else the nearest anywhere. A deck node six
   * metres up is often the nearest in three dimensions to a point on the
   * floor beneath it, and a route that starts there starts with a staircase
   * in the wrong direction (Block A8 found the Warden climbing to the deck to
   * reach a charge on the hall floor). "Own floor" is generous - twice a
   * step - so a body on a staircase still finds the node at either end.
   */
  nearestWaypoint(position) {
    let best = null;
    let bestDistance = Infinity;
    let bestLevel = null;
    let bestLevelDistance = Infinity;
    const level = CONFIG.warden.stepHeight * 2;
    for (const node of this.waypoints) {
      if (!node) continue;
      const distance = node.position.distanceToSquared(position);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = node;
      }
      if (Math.abs(node.position.y - position.y) <= level && distance < bestLevelDistance) {
        bestLevelDistance = distance;
        bestLevel = node;
      }
    }
    return bestLevel || best;
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

Object.assign(GameMap.prototype, GENERATORS);

/** Yaw that makes an actor at (x, z) look at (tx, tz). */
export function facing(x, z, tx, tz) {
  return Math.atan2(-(tx - x), -(tz - z));
}
