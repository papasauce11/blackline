/**
 * BLACKLINE — mapgen.js
 *
 * The generators of the construction kit: a wall with openings, a floor plate
 * with voids, a staircase, a vent run. Each is a pattern of `addSolid()`
 * calls, so a hole is subtracted from real geometry rather than faked by
 * leaving a gap in hand-typed coordinates (Section 5: a visual and its
 * collision volume come from one spec). `mapkit.js` owns `addSolid()` and the
 * map's lists; this file only emits.
 *
 * Methods of `GameMap`, kept in their own file (F3). mapkit.js installs them
 * on the prototype, so `this` is the map and every field keeps its name.
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { CUT_EPSILON, SWEEP_STEP, collectCuts, containsPoint } from './mapbake.js';

const M = CONFIG.map;
const P = CONFIG.palette;

export const GENERATORS = {
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
  },

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
  },

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
  },

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
  },

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
  },

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
};
