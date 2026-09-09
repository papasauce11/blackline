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
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { CollisionWorld, classifyReach } from './physics.js';
import {
  CUT_EPSILON, SWEEP_STEP, createMaterialCache, applyContactTint,
  collectCuts, containsPoint, bake, mergeGeometries,
} from './mapbake.js';
import { deriveRoomEntries } from './maprooms.js';
import { deriveWardenGround } from './mapground.js';

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
   * @param {boolean} [spec.climbable] force the top face to be a usable ledge
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
        climbable: spec.climbable === true,
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
  // Wall with openings
  // -------------------------------------------------------------------------

  /**
   * A wall plane with rectangular openings subtracted from it.
   *
   * Phase 3 lost a day to vent runs that had been typed to end inside a wall
   * that was typed separately. The fix generalises here: an opening is declared
   * once, and the wall is emitted as the spans that survive around it. A
   * doorway cannot be half a metre out of line with the thing meant to go
   * through it, because only one of them is authored.
   *
   * @param {object} spec
   * @param {'x'|'z'} spec.axis the wall's normal
   * @param {number} spec.at near face along the normal
   * @param {number} spec.thickness
   * @param {number} spec.from along-wall start
   * @param {number} spec.to along-wall end
   * @param {number} spec.y0 base
   * @param {number} spec.y1 top
   * @param {{from:number, to:number, y0:number, y1:number}[]} [spec.openings]
   */
  addWall(spec) {
    const openings = (spec.openings || []).filter(
      (hole) => hole.to > spec.from && hole.from < spec.to && hole.y1 > spec.y0 && hole.y0 < spec.y1
    );
    const cuts = collectCuts(spec.from, spec.to, openings, 'from', 'to');
    const built = [];

    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i];
      const b = cuts[i + 1];
      if (b - a <= CUT_EPSILON) continue;
      const mid = (a + b) / 2;

      // Cuts land on opening edges, so an opening either spans this slice
      // completely or misses it. Stack the vertical gaps it leaves.
      const bands = openings
        .filter((hole) => mid > hole.from && mid < hole.to)
        .map((hole) => ({ y0: Math.max(hole.y0, spec.y0), y1: Math.min(hole.y1, spec.y1) }))
        .sort((p, q) => p.y0 - q.y0);

      let y = spec.y0;
      for (const band of bands) {
        if (band.y0 > y + CUT_EPSILON) built.push(this._wallSpan(spec, a, b, y, band.y0, built.length));
        y = Math.max(y, band.y1);
      }
      if (spec.y1 > y + CUT_EPSILON) built.push(this._wallSpan(spec, a, b, y, spec.y1, built.length));
    }
    return built;
  }

  _wallSpan(spec, a, b, y0, y1, index) {
    const near = spec.at;
    const far = spec.at + spec.thickness;
    const min = spec.axis === 'x' ? [near, y0, a] : [a, y0, near];
    const max = spec.axis === 'x' ? [far, y1, b] : [b, y1, far];
    return this.addSolid({
      min,
      max,
      color: spec.color !== undefined ? spec.color : P.concrete,
      tag: `${spec.tag}-${index}`,
      castShadow: spec.castShadow,
    });
  }

  // -------------------------------------------------------------------------
  // Floor plate with voids
  // -------------------------------------------------------------------------

  /**
   * A continuous horizontal slab with rectangular voids cut out of it.
   *
   * This is how the v2 upper deck becomes one surface rather than a set of
   * fragments stitched together by walkways — the fragment approach is what
   * produced a 0.4m doorway the Warden could not fit through in Phase 4. The
   * plate is laid whole and holes are subtracted, so the only way to sever the
   * deck is to declare a void that severs it, which the connectivity check
   * catches.
   *
   * A 6m deck edge is out of reach on its own, so nothing has to say so.
   * @param {object} spec
   * @param {number[]} spec.min [x, z]
   * @param {number[]} spec.max [x, z]
   * @param {number} spec.top surface height
   * @param {number} spec.thickness
   * @param {{x0:number,x1:number,z0:number,z1:number}[]} [spec.voids]
   * @param {{x0:number,x1:number,z0:number,z1:number,tag:string}[]} [spec.lips]
   */
  addFloorPlate(spec) {
    const [x0, z0] = spec.min;
    const [x1, z1] = spec.max;
    const holes = spec.voids || [];
    const lips = spec.lips || [];
    const all = holes.concat(lips);
    const cutsX = collectCuts(x0, x1, all, 'x0', 'x1');
    const cutsZ = collectCuts(z0, z1, all, 'z0', 'z1');
    const lipDepth = spec.lipDepth !== undefined ? spec.lipDepth : M.deckLipDepth;
    const built = [];
    let plain = 0;

    for (let j = 0; j < cutsZ.length - 1; j++) {
      const za = cutsZ[j];
      const zb = cutsZ[j + 1];
      if (zb - za <= CUT_EPSILON) continue;
      const cz = (za + zb) / 2;
      let runFrom = null;

      const flush = (runTo) => {
        if (runFrom === null) return;
        built.push(
          this.addSolid({
            min: [runFrom, spec.top - spec.thickness, za],
            max: [runTo, spec.top, zb],
            color: spec.color,
            tag: `${spec.tag}-${plain++}`,
            // Deliberately NOT castShadow:false. A plate is the roof or the
            // upper deck — the largest occluders on the map — and switching
            // them out of the shadow pass let the one directional key light
            // the whole interior as if the building had no lid. Measured: the
            // Server Vault floor rendered brighter than the Turbine Hall's.
            // addSolid() decides from the footprint, which keeps the trim and
            // the stair treads out without excusing the roof.
          })
        );
        runFrom = null;
      };

      for (let i = 0; i < cutsX.length - 1; i++) {
        const xa = cutsX[i];
        const xb = cutsX[i + 1];
        if (xb - xa <= CUT_EPSILON) continue;
        const cx = (xa + xb) / 2;

        // Lips are subtracted here and emitted whole below. Letting them tile
        // like the rest would split one against a cut line belonging to some
        // unrelated void, and the offcut is narrower than an actor — so the
        // route arriving there would silently stop being climbable.
        if (all.some((rect) => containsPoint(rect, cx, cz))) {
          flush(xa);
          continue;
        }
        if (runFrom === null) runFrom = xa;
      }
      flush(cutsX[cutsX.length - 1]);
    }

    for (const lip of lips) {
      built.push(
        this.addSolid({
          min: [lip.x0, spec.top - lipDepth, lip.z0],
          max: [lip.x1, spec.top, lip.z1],
          color: spec.lipColor !== undefined ? spec.lipColor : spec.color,
          tag: lip.tag,
          castShadow: false,
        })
      );
    }

    for (const hole of holes) this.deckVoids.push({ ...hole, top: spec.top });
    return built;
  }

  // -------------------------------------------------------------------------
  // Staircase
  // -------------------------------------------------------------------------

  /**
   * A walkable staircase, generated as a run of solid steps, together with the
   * stairwell opening the deck above it needs.
   *
   * Each step is a full block from the floor up to its own tread rather than a
   * floating slab, so there is no gap underneath and the swept solver only ever
   * sees one clean face per step. Treads are shallower than an actor diameter,
   * so `deriveClimbableSurfaces()` skips them and they carry no affordance
   * stripes — a staircase is walked, not vaulted.
   *
   * `stairwell` is computed, not authored: it starts at the first step whose
   * tread plus standing headroom would break through the deck, and runs to the
   * top of the flight. Move the flight or change the deck height and the hole
   * follows, which is the only reason the Warden cannot walk into the underside
   * of its own destination.
   *
   * @param {object} spec
   * @param {'x'|'z'} spec.axis direction the stairs ascend
   * @param {number} spec.start along-axis coordinate of the first step
   * @param {number} spec.crossMin across-axis minimum (the stair's width)
   * @param {number} spec.crossMax across-axis maximum
   * @param {number} spec.baseY floor the stairs rise from
   * @param {number} spec.deckY surface the flight arrives on
   */
  addStaircase(spec) {
    const steps = M.stairSteps;
    const rise = M.stairRise;
    const run = M.stairRun;
    const built = [];

    for (let i = 0; i < steps; i++) {
      const from = spec.start + i * run;
      const to = from + run;
      const top = spec.baseY + (i + 1) * rise;
      const min = spec.axis === 'x' ? [from, spec.baseY, spec.crossMin] : [spec.crossMin, spec.baseY, from];
      const max = spec.axis === 'x' ? [to, top, spec.crossMax] : [spec.crossMax, top, to];
      built.push(
        this.addSolid({
          min,
          max,
          color: P.concrete,
          tag: `${spec.tag}-step-${i}`,
          castShadow: false,
        })
      );
    }

    const underside = spec.deckY - M.floorThickness;
    let breaks = steps;
    for (let i = 0; i < steps; i++) {
      if (spec.baseY + (i + 1) * rise + M.stairHeadroom > underside) {
        breaks = i;
        break;
      }
    }
    // The hole has to open BEFORE the step that breaks headroom, not at it. An
    // actor is still centred over the previous tread when the solver lifts it
    // by a full step height to test the next one, and its body reaches a radius
    // further back again — so it needs all three of those cleared or the
    // step-up is refused and the flight dead-ends two treads from the top.
    const margin = CONFIG.warden.radius + run + CONFIG.warden.stepHeight;
    const wellFrom = spec.start + breaks * run - margin;
    const wellTo = spec.start + steps * run;
    const across = CONFIG.warden.radius;
    const stairwell =
      spec.axis === 'x'
        ? { x0: wellFrom, x1: wellTo, z0: spec.crossMin - across, z1: spec.crossMax + across }
        : { x0: spec.crossMin - across, x1: spec.crossMax + across, z0: wellFrom, z1: wellTo };

    const record = {
      tag: spec.tag,
      axis: spec.axis,
      bottom: spec.start,
      top: spec.start + steps * run,
      topY: spec.baseY + steps * rise,
      crossMin: spec.crossMin,
      crossMax: spec.crossMax,
      baseY: spec.baseY,
      stairwell,
      steps: built,
    };
    this.staircases.push(record);
    return record;
  }

  // -------------------------------------------------------------------------
  // Vent run
  // -------------------------------------------------------------------------

  /**
   * A crouch-only tube (Section 5). Returns the run record, whose bounds the
   * caller feeds straight back into `addWall()` as an opening so a run can
   * never end up buried inside a wall.
   *
   * `roof` is optional because a run threaded under the upper deck is already
   * crouch-only — the deck is its roof. Adding a redundant one is not merely
   * wasteful: a roof slab is wide enough to count as a standing surface, so it
   * becomes the support the marking pass measures the next ledge against, and
   * the stripe ends up in the wrong band. The two-tier v2 chain needs the
   * measurement taken from the vent floor, so the upper run has no roof.
   *
   * @param {object} spec
   * @param {'x'|'z'} spec.axis
   * @param {number} spec.from along-axis start
   * @param {number} spec.to along-axis end
   * @param {number} spec.cross centre on the other horizontal axis
   * @param {number} spec.floorY interior floor height
   * `lipAt` thickens the floor at a mouth into a block deep enough for the
   * Shade's forward ledge probe to find. The probe samples six fixed heights
   * above the feet, and a 0.2m floor slab is thin enough to fall between two of
   * them — so in v1 a vent lip classified as a mantle, was marked as one, and
   * could not actually be climbed. The block is the same surface at the same
   * height; it is simply tall enough to be seen.
   *
   * @param {boolean} [spec.floor] emit a floor slab (false at grade)
   * @param {boolean} [spec.roof] emit a roof slab
   * @param {'from'|'to'|'both'} [spec.lipAt] which mouths are climbed into
   */
  addVentRun(spec) {
    const w = M.ventWidth;
    const h = M.ventHeight;
    const halfW = w / 2;
    const y0 = spec.floorY;
    const y1 = spec.floorY + h;
    const alongX = spec.axis === 'x';
    const c0 = spec.cross - halfW;
    const c1 = spec.cross + halfW;
    const wallT = 0.12;

    const span = (a0, a1, cMin, cMax, vy0, vy1, tag, flags) =>
      this.addSolid({
        min: alongX ? [a0, vy0, cMin] : [cMin, vy0, a0],
        max: alongX ? [a1, vy1, cMax] : [cMax, vy1, a1],
        color: P.concreteDark,
        castShadow: false,
        tag,
        ...flags,
      });

    if (spec.floor !== false) {
      span(spec.from, spec.to, c0, c1, y0 - M.ventFloorDepth, y0, `${spec.tag}-floor`, {});
    }
    if (spec.lipAt === 'from' || spec.lipAt === 'both') {
      span(spec.from, spec.from + M.ventLipLength, c0, c1, y0 - M.ventLipDepth, y0, `${spec.tag}-lip-from`, {});
    }
    if (spec.lipAt === 'to' || spec.lipAt === 'both') {
      span(spec.to - M.ventLipLength, spec.to, c0, c1, y0 - M.ventLipDepth, y0, `${spec.tag}-lip-to`, {});
    }
    span(spec.from, spec.to, c0 - wallT, c0, y0, y1, `${spec.tag}-wall-a`, {});
    span(spec.from, spec.to, c1, c1 + wallT, y0, y1, `${spec.tag}-wall-b`, {});
    if (spec.roof !== false) {
      const insetFrom = spec.roofInsetFrom !== undefined ? spec.roofInsetFrom : M.ventMouthLength;
      const insetTo = spec.roofInsetTo !== undefined ? spec.roofInsetTo : M.ventMouthLength;
      span(spec.from + insetFrom, spec.to - insetTo, c0, c1, y1, y1 + wallT, `${spec.tag}-roof`, { vent: true });
    }

    // Section 5, amended: the self-illuminated interior panel is gone with the
    // rest of the affordance markings. A duct says it is passable by being
    // visibly a duct - metal, rimmed, person-sized - not by glowing.

    const record = {
      tag: spec.tag,
      axis: spec.axis,
      min: new THREE.Vector3(alongX ? spec.from : c0, y0, alongX ? c0 : spec.from),
      max: new THREE.Vector3(alongX ? spec.to : c1, y1, alongX ? c1 : spec.to),
      grade: spec.floorY <= M.groundY + CUT_EPSILON,
      /** Underside of the duct, so a wall opening clears the floor slab too. */
      underside: spec.floor === false ? y0 : y0 - M.ventFloorDepth,
    };
    this.vents.push(record);
    return record;
  }

  /**
   * The opening a vent run needs where it crosses a wall, in the
   * (along-wall, vertical) space `addWall()` expects.
   */
  ventOpening(run, margin = 0.14) {
    const alongX = run.axis === 'x';
    return {
      from: (alongX ? run.min.z : run.min.x) - margin,
      to: (alongX ? run.max.z : run.max.x) + margin,
      y0: run.underside - margin,
      y1: run.max.y + margin,
    };
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
  // Affordance markings (Section 5) - ONE pass, driven by the collision flags
  // -------------------------------------------------------------------------

  /**
   * Decide which surfaces are climbable, from the geometry and the body alone.
   *
   * Section 5, amended: there are no markings, so this is the whole contract.
   * The rule is mechanical and has NO exceptions — no `noClimb`, no tags, no
   * per-box judgement:
   *
   *   a surface is climbable when you could stand on top of it
   *   and the body could reach it from whatever is below.
   *
   * "Stand on top of it" means a top face at least an actor-diameter across in
   * both axes with crouch headroom above. "Reach it" means the rise from the
   * surface below is inside `CONFIG.shade.reach` at full stretch — standing
   * reach plus what a jump adds.
   *
   * `noClimb` used to opt surfaces out: the office floor to keep the drop shaft
   * one-way, and the whole upper deck except four declared lips. Both are now
   * enforced by the vertical layout instead. The deck is 6m and full reach is
   * 3.8m, so it is unreachable on its own merits and nothing has to say so —
   * which means a future change to a floor height cannot silently turn a
   * one-way route into a two-way one without the census noticing.
   */
  deriveClimbableSurfaces() {
    const minSupport = CONFIG.shade.radius * 2;
    const headroom = CONFIG.shade.crouchHeight;
    const probeHalf = { x: minSupport * 0.5, y: headroom * 0.5, z: minSupport * 0.5 };
    const fullReach = CONFIG.shade.reach.standing + CONFIG.shade.reach.jumpBonus;

    this.ledges.length = 0;

    for (const box of this.collision.boxes) {
      if (!box.solid) continue;
      if (box.max.x - box.min.x < minSupport) continue;
      if (box.max.z - box.min.z < minSupport) continue;

      const standY = this._supportHeightBelow(box);
      const rise = box.max.y - standY;
      const move = classifyReach(rise, fullReach);
      // `step` is not a climb: the swept solver carries you over it.
      if (move === null || move === 'step') continue;

      // Somewhere to actually stand once you are up. Sampled along the surface
      // rather than at its centre alone: a long ledge that passes under one
      // obstruction is still climbable everywhere else, and judging it by a
      // single point excludes the whole thing.
      const y = box.max.y + headroom * 0.5 + 0.05;
      let standable = false;
      for (let i = 1; i <= 3 && !standable; i++) {
        const t = i / 4;
        const point = {
          x: box.min.x + (box.max.x - box.min.x) * t,
          y,
          z: box.min.z + (box.max.z - box.min.z) * t,
        };
        // Keep the sample inside the footprint so an edge point does not
        // wrongly report clear air beside the box.
        point.x = Math.min(Math.max(point.x, box.min.x + probeHalf.x), box.max.x - probeHalf.x);
        point.z = Math.min(Math.max(point.z, box.min.z + probeHalf.z), box.max.z - probeHalf.z);
        if (this.collision.isClear(point, probeHalf)) standable = true;
      }
      if (!standable) continue;

      box.climbable = true;
      box.reachMove = move;
      this.ledges.push({ box, move, topY: box.max.y, standY, rise });
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
    const candidates = this._supportCandidates(box);
    return candidates[candidates.length - 1];
  }

  /**
   * Every height an actor could be standing on to climb this box, lowest
   * first. Always includes the ground plane.
   */
  _supportCandidates(box) {
    const heights = [M.groundY];
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
      heights.push(other.max.y);
    }
    heights.sort((a, b) => a - b);
    return heights;
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

/** Yaw that makes an actor at (x, z) look at (tx, tz). */
export function facing(x, z, tx, tz) {
  return Math.atan2(-(tx - x), -(tz - z));
}
