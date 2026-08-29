/**
 * BLACKLINE — physics.js
 *
 * Swept AABB collision, gravity integration, ground checks and raycasting.
 * Layering (Section 3.1): imports from config only. Operates on plain
 * {x, y, z} objects so it has no Three.js dependency — a THREE.Vector3 is
 * structurally compatible and can be passed straight in.
 *
 * Section 15, first row: "Player falls through the floor — fixed timestep at
 * 60Hz with an accumulator. Swept AABB collision. Never integrate with a raw
 * frame delta." The loop half lives in main.js; the swept solver is here.
 *
 * The solver never integrates position and then tests. It sweeps the actor's
 * box along its whole displacement, stops at the first time of impact, and
 * slides the remainder along the surface. Combined with a depenetration pass
 * that runs first, an actor cannot pass through a wall at any speed.
 */

import { CONFIG } from './config.js';

/** Backed off from every contact so the actor never rests exactly on a face. */
const SKIN = 0.001;
/** Below this a component of motion is treated as zero. */
const EPSILON = 1e-8;
/** Sweep/slide passes per move. Four handles a corner plus a floor. */
const MAX_SLIDE_ITERATIONS = 4;
/** Broadphase cell size in metres. */
const CELL_SIZE = 4;
/** Downward probe length used for the ground check. */
const GROUND_PROBE = 0.08;

// ---------------------------------------------------------------------------
// Small vector helpers on plain objects. No allocation in the hot paths.
// ---------------------------------------------------------------------------

const scratch = {
  min: { x: 0, y: 0, z: 0 },
  max: { x: 0, y: 0, z: 0 },
  delta: { x: 0, y: 0, z: 0 },
  remaining: { x: 0, y: 0, z: 0 },
  normal: { x: 0, y: 0, z: 0 },
};

function set(out, x, y, z) {
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

// ---------------------------------------------------------------------------
// CollisionBox
// ---------------------------------------------------------------------------

let nextBoxId = 1;

/**
 * A static axis-aligned collision volume.
 *
 * `flags` is the single source of truth that both the collision solver and the
 * affordance-marking pass read (Section 5: "All markings are generated
 * procedurally from the same flags that drive the collision logic").
 */
export class CollisionBox {
  /**
   * @param {{x:number,y:number,z:number}} min
   * @param {{x:number,y:number,z:number}} max
   * @param {object} [flags]
   * @param {boolean} [flags.solid] blocks movement (default true)
   * @param {boolean} [flags.climbable] top face is a usable ledge
   * @param {boolean} [flags.vent] crouch-only, silent volume
   * @param {boolean} [flags.blocksSight] blocks rays for light and perception
   * @param {string}  [flags.tag] human label, used by the debug overlay
   */
  constructor(min, max, flags = {}) {
    this.id = nextBoxId++;
    this.min = { x: min.x, y: min.y, z: min.z };
    this.max = { x: max.x, y: max.y, z: max.z };
    this.solid = flags.solid !== false;
    this.climbable = flags.climbable === true;
    /** Crouch-only, silent volume (Section 5). */
    this.vent = flags.vent === true;
    this.blocksSight = flags.blocksSight !== false;
    this.tag = flags.tag || '';
    /** Set by the map derivation: what move this ledge calls for. */
    this.reachMove = null;
  }

  get topY() {
    return this.max.y;
  }

  get centerX() {
    return (this.min.x + this.max.x) * 0.5;
  }

  get centerZ() {
    return (this.min.z + this.max.z) * 0.5;
  }
}

// ---------------------------------------------------------------------------
// Slab test: ray (origin + t*delta, t in [0,1]) against an AABB
// ---------------------------------------------------------------------------

/**
 * @returns {{t:number, nx:number, ny:number, nz:number}|null} entry time and
 * the outward normal of the face entered through, or null if no crossing.
 */
function raySlab(origin, delta, min, max) {
  let tEnter = 0;
  let tExit = 1;
  let nx = 0;
  let ny = 0;
  let nz = 0;

  // X
  if (Math.abs(delta.x) < EPSILON) {
    if (origin.x < min.x || origin.x > max.x) return null;
  } else {
    let t1 = (min.x - origin.x) / delta.x;
    let t2 = (max.x - origin.x) / delta.x;
    let sign = -1;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      sign = 1;
    }
    if (t1 > tEnter) {
      tEnter = t1;
      nx = sign;
      ny = 0;
      nz = 0;
    }
    if (t2 < tExit) tExit = t2;
    if (tEnter > tExit) return null;
  }

  // Y
  if (Math.abs(delta.y) < EPSILON) {
    if (origin.y < min.y || origin.y > max.y) return null;
  } else {
    let t1 = (min.y - origin.y) / delta.y;
    let t2 = (max.y - origin.y) / delta.y;
    let sign = -1;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      sign = 1;
    }
    if (t1 > tEnter) {
      tEnter = t1;
      nx = 0;
      ny = sign;
      nz = 0;
    }
    if (t2 < tExit) tExit = t2;
    if (tEnter > tExit) return null;
  }

  // Z
  if (Math.abs(delta.z) < EPSILON) {
    if (origin.z < min.z || origin.z > max.z) return null;
  } else {
    let t1 = (min.z - origin.z) / delta.z;
    let t2 = (max.z - origin.z) / delta.z;
    let sign = -1;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      sign = 1;
    }
    if (t1 > tEnter) {
      tEnter = t1;
      nx = 0;
      ny = 0;
      nz = sign;
    }
    if (t2 < tExit) tExit = t2;
    if (tEnter > tExit) return null;
  }

  if (tEnter > 1 || tExit < 0) return null;
  return { t: tEnter, nx, ny, nz };
}

// ---------------------------------------------------------------------------
// CollisionWorld
// ---------------------------------------------------------------------------

export class CollisionWorld {
  constructor() {
    /** @type {CollisionBox[]} */
    this.boxes = [];
    this._grid = null;
    this._bounds = null;
    this._queryStamp = 0;
    this._stamps = [];
    this._candidates = [];
  }

  /**
   * @param {{x:number,y:number,z:number}} min
   * @param {{x:number,y:number,z:number}} max
   * @param {object} [flags]
   * @returns {CollisionBox}
   */
  addBox(min, max, flags) {
    const box = new CollisionBox(min, max, flags);
    this.boxes.push(box);
    this._grid = null; // invalidate
    return box;
  }

  /** Build the uniform-grid broadphase. Call once after all boxes are added. */
  build() {
    if (this.boxes.length === 0) {
      this._grid = { cells: new Map(), nx: 0, nz: 0, minX: 0, minZ: 0 };
      this._bounds = { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };
      return this;
    }

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (const box of this.boxes) {
      if (box.min.x < minX) minX = box.min.x;
      if (box.min.y < minY) minY = box.min.y;
      if (box.min.z < minZ) minZ = box.min.z;
      if (box.max.x > maxX) maxX = box.max.x;
      if (box.max.y > maxY) maxY = box.max.y;
      if (box.max.z > maxZ) maxZ = box.max.z;
    }
    this._bounds = { minX, minY, minZ, maxX, maxY, maxZ };

    const nx = Math.max(1, Math.ceil((maxX - minX) / CELL_SIZE));
    const nz = Math.max(1, Math.ceil((maxZ - minZ) / CELL_SIZE));
    const cells = new Map();

    for (let i = 0; i < this.boxes.length; i++) {
      const box = this.boxes[i];
      const x0 = Math.max(0, Math.floor((box.min.x - minX) / CELL_SIZE));
      const x1 = Math.min(nx - 1, Math.floor((box.max.x - minX) / CELL_SIZE));
      const z0 = Math.max(0, Math.floor((box.min.z - minZ) / CELL_SIZE));
      const z1 = Math.min(nz - 1, Math.floor((box.max.z - minZ) / CELL_SIZE));
      for (let cz = z0; cz <= z1; cz++) {
        for (let cx = x0; cx <= x1; cx++) {
          const key = cz * nx + cx;
          let list = cells.get(key);
          if (!list) {
            list = [];
            cells.set(key, list);
          }
          list.push(i);
        }
      }
    }

    this._grid = { cells, nx, nz, minX, minZ };
    this._stamps = new Array(this.boxes.length).fill(0);
    return this;
  }

  _ensureGrid() {
    if (!this._grid) this.build();
  }

  /**
   * Unique boxes whose cells overlap the given world-space AABB.
   * Reuses one array and a stamp table, so a query allocates nothing.
   * @returns {CollisionBox[]}
   */
  query(min, max) {
    this._ensureGrid();
    const grid = this._grid;
    const out = this._candidates;
    out.length = 0;
    if (grid.nx === 0) return out;

    this._queryStamp++;
    const stamp = this._queryStamp;

    const x0 = Math.max(0, Math.floor((min.x - grid.minX) / CELL_SIZE));
    const x1 = Math.min(grid.nx - 1, Math.floor((max.x - grid.minX) / CELL_SIZE));
    const z0 = Math.max(0, Math.floor((min.z - grid.minZ) / CELL_SIZE));
    const z1 = Math.min(grid.nz - 1, Math.floor((max.z - grid.minZ) / CELL_SIZE));

    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const list = grid.cells.get(cz * grid.nx + cx);
        if (!list) continue;
        for (let k = 0; k < list.length; k++) {
          const index = list[k];
          if (this._stamps[index] === stamp) continue;
          this._stamps[index] = stamp;
          out.push(this.boxes[index]);
        }
      }
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Overlap
  // -------------------------------------------------------------------------

  /**
   * Does an actor box at `center` with `half` extents overlap any solid volume?
   *
   * This is the parkour safety rule from Section 6.1: "every vault, mantle,
   * slide, and pull-up must validate the destination capsule is clear of
   * geometry BEFORE committing." Call this with the destination before moving.
   *
   * @param {object} center
   * @param {object} half
   * @param {(box: CollisionBox) => boolean} [filter] return false to ignore
   * @returns {CollisionBox|null} the first blocking box, or null if clear
   */
  overlap(center, half, filter) {
    const min = set(scratch.min, center.x - half.x, center.y - half.y, center.z - half.z);
    const max = set(scratch.max, center.x + half.x, center.y + half.y, center.z + half.z);
    const candidates = this.query(min, max);
    for (let i = 0; i < candidates.length; i++) {
      const box = candidates[i];
      if (!box.solid) continue;
      if (filter && filter(box) === false) continue;
      if (
        min.x < box.max.x && max.x > box.min.x &&
        min.y < box.max.y && max.y > box.min.y &&
        min.z < box.max.z && max.z > box.min.z
      ) {
        return box;
      }
    }
    return null;
  }

  /** Convenience: true when the destination is clear. */
  isClear(center, half, filter) {
    return this.overlap(center, half, filter) === null;
  }

  // -------------------------------------------------------------------------
  // Depenetration
  // -------------------------------------------------------------------------

  /**
   * Push an actor out of anything it is already inside, along the axis of least
   * penetration. Runs before every sweep so the solver never starts from an
   * invalid state — which is the usual root cause of tunnelling.
   * @returns {number} how many boxes it had to resolve against
   */
  depenetrate(center, half, filter) {
    let resolved = 0;
    for (let pass = 0; pass < MAX_SLIDE_ITERATIONS; pass++) {
      const box = this.overlap(center, half, filter);
      if (!box) break;
      resolved++;

      // Signed distance to push out on each axis, smallest magnitude wins.
      const dxPos = box.max.x - (center.x - half.x);
      const dxNeg = (center.x + half.x) - box.min.x;
      const dyPos = box.max.y - (center.y - half.y);
      const dyNeg = (center.y + half.y) - box.min.y;
      const dzPos = box.max.z - (center.z - half.z);
      const dzNeg = (center.z + half.z) - box.min.z;

      const px = dxPos < dxNeg ? dxPos : -dxNeg;
      const py = dyPos < dyNeg ? dyPos : -dyNeg;
      const pz = dzPos < dzNeg ? dzPos : -dzNeg;

      const ax = Math.abs(px);
      const ay = Math.abs(py);
      const az = Math.abs(pz);

      if (ay <= ax && ay <= az) center.y += py + Math.sign(py) * SKIN;
      else if (ax <= az) center.x += px + Math.sign(px) * SKIN;
      else center.z += pz + Math.sign(pz) * SKIN;
    }
    return resolved;
  }

  // -------------------------------------------------------------------------
  // Sweep
  // -------------------------------------------------------------------------

  /**
   * Sweep an actor box along `delta` and return the first contact.
   * @returns {{t:number, nx:number, ny:number, nz:number, box:CollisionBox}|null}
   */
  sweep(center, half, delta, filter) {
    const min = scratch.min;
    const max = scratch.max;
    // Query bounds must cover the whole swept volume, start and end.
    min.x = Math.min(center.x, center.x + delta.x) - half.x;
    min.y = Math.min(center.y, center.y + delta.y) - half.y;
    min.z = Math.min(center.z, center.z + delta.z) - half.z;
    max.x = Math.max(center.x, center.x + delta.x) + half.x;
    max.y = Math.max(center.y, center.y + delta.y) + half.y;
    max.z = Math.max(center.z, center.z + delta.z) + half.z;

    const candidates = this.query(min, max);
    let best = null;

    for (let i = 0; i < candidates.length; i++) {
      const box = candidates[i];
      if (!box.solid) continue;
      if (filter && filter(box) === false) continue;

      // Minkowski sum: expand the static box by the actor's half extents and
      // sweep the actor's centre point against it.
      const emin = {
        x: box.min.x - half.x,
        y: box.min.y - half.y,
        z: box.min.z - half.z,
      };
      const emax = {
        x: box.max.x + half.x,
        y: box.max.y + half.y,
        z: box.max.z + half.z,
      };

      const hit = raySlab(center, delta, emin, emax);
      if (!hit) continue;
      if (hit.t < 0) continue; // already inside; depenetration owns that case
      if (!best || hit.t < best.t) {
        best = { t: hit.t, nx: hit.nx, ny: hit.ny, nz: hit.nz, box };
      }
    }

    return best;
  }

  // -------------------------------------------------------------------------
  // Move and slide
  // -------------------------------------------------------------------------

  /**
   * Move an actor by `velocity * dt`, sweeping and sliding against geometry.
   * Mutates `center` and `velocity` in place.
   *
   * @param {object} center actor centre, mutated
   * @param {object} half half extents
   * @param {object} velocity metres per second, mutated
   * @param {number} dt fixed step, never a raw frame delta
   * @param {object} [options]
   * @param {number} [options.groundNormalY] cosine above which a face is ground
   * @param {number} [options.stepHeight] max lip climbed without a vault
   * @param {boolean} [options.wasGrounded] whether the actor was on the ground
   *        before this move; step-up is only attempted for a grounded actor
   * @param {(box: CollisionBox) => boolean} [options.filter]
   * @returns {{grounded:boolean, groundBox:CollisionBox|null, hitWall:boolean,
   *            hitCeiling:boolean, stepped:boolean, impactSpeed:number}}
   */
  moveAndSlide(center, half, velocity, dt, options = {}) {
    const groundNormalY = options.groundNormalY !== undefined
      ? options.groundNormalY
      : CONFIG.shade.groundNormalY;
    const stepHeight = options.stepHeight || 0;
    const filter = options.filter;

    const result = {
      grounded: false,
      groundBox: null,
      hitWall: false,
      hitCeiling: false,
      stepped: false,
      impactSpeed: 0,
    };

    this.depenetrate(center, half, filter);

    const remaining = set(scratch.remaining, velocity.x * dt, velocity.y * dt, velocity.z * dt);

    for (let iteration = 0; iteration < MAX_SLIDE_ITERATIONS; iteration++) {
      const lengthSq = remaining.x * remaining.x + remaining.y * remaining.y + remaining.z * remaining.z;
      if (lengthSq < EPSILON) break;

      const hit = this.sweep(center, half, remaining, filter);

      if (!hit) {
        center.x += remaining.x;
        center.y += remaining.y;
        center.z += remaining.z;
        break;
      }

      // Advance to just before the contact.
      const travel = Math.max(0, hit.t);
      center.x += remaining.x * travel;
      center.y += remaining.y * travel;
      center.z += remaining.z * travel;
      center.x += hit.nx * SKIN;
      center.y += hit.ny * SKIN;
      center.z += hit.nz * SKIN;

      if (hit.ny >= groundNormalY) {
        result.grounded = true;
        result.groundBox = hit.box;
        result.impactSpeed = Math.max(result.impactSpeed, -velocity.y);
      } else if (hit.ny <= -groundNormalY) {
        result.hitCeiling = true;
      } else {
        result.hitWall = true;
      }

      // Leftover motion for this iteration.
      const leftover = 1 - travel;
      remaining.x *= leftover;
      remaining.y *= leftover;
      remaining.z *= leftover;

      // Step-up: a grounded actor walking into a low lip should climb it rather
      // than snag. Only attempted against genuine walls, and only when the
      // raised destination is verified clear first.
      if (
        stepHeight > 0 &&
        options.wasGrounded === true &&
        hit.ny > -groundNormalY && hit.ny < groundNormalY &&
        this._tryStep(center, half, remaining, stepHeight, filter)
      ) {
        result.stepped = true;
        continue;
      }

      // Slide: remove the component of both the leftover motion and the
      // velocity that points into the surface.
      const dotRemaining = remaining.x * hit.nx + remaining.y * hit.ny + remaining.z * hit.nz;
      remaining.x -= dotRemaining * hit.nx;
      remaining.y -= dotRemaining * hit.ny;
      remaining.z -= dotRemaining * hit.nz;

      const dotVelocity = velocity.x * hit.nx + velocity.y * hit.ny + velocity.z * hit.nz;
      if (dotVelocity < 0) {
        velocity.x -= dotVelocity * hit.nx;
        velocity.y -= dotVelocity * hit.ny;
        velocity.z -= dotVelocity * hit.nz;
      }
    }

    // Ground probe. A short downward sweep so walking off a tiny lip does not
    // flicker the grounded flag for one step.
    if (!result.grounded && velocity.y <= 0) {
      const probe = set(scratch.delta, 0, -GROUND_PROBE, 0);
      const hit = this.sweep(center, half, probe, filter);
      if (hit && hit.ny >= groundNormalY) {
        center.y += probe.y * hit.t + SKIN;
        result.grounded = true;
        result.groundBox = hit.box;
      }
    }

    return result;
  }

  /**
   * Attempt to climb a lip up to `stepHeight`. Returns true only if the raised
   * path is clear and the actor lands on ground; otherwise leaves `center`
   * untouched. Never commits to an unvalidated position.
   */
  _tryStep(center, half, remaining, stepHeight, filter) {
    const startX = center.x;
    const startY = center.y;
    const startZ = center.z;

    // Room to rise?
    const up = set(scratch.delta, 0, stepHeight, 0);
    const upHit = this.sweep(center, half, up, filter);
    const rise = upHit ? stepHeight * upHit.t - SKIN : stepHeight;
    if (rise <= SKIN) return false;
    center.y += rise;

    // Room to move forward from up there?
    const forward = set(scratch.normal, remaining.x, 0, remaining.z);
    if (Math.abs(forward.x) < EPSILON && Math.abs(forward.z) < EPSILON) {
      center.x = startX;
      center.y = startY;
      center.z = startZ;
      return false;
    }
    const forwardHit = this.sweep(center, half, forward, filter);
    const advance = forwardHit ? Math.max(0, forwardHit.t) : 1;
    if (advance <= 0.01) {
      center.x = startX;
      center.y = startY;
      center.z = startZ;
      return false;
    }
    center.x += forward.x * advance;
    center.z += forward.z * advance;

    // Settle back down onto the step.
    const down = set(scratch.delta, 0, -(rise + GROUND_PROBE), 0);
    const downHit = this.sweep(center, half, down, filter);
    if (!downHit || downHit.ny < CONFIG.shade.groundNormalY) {
      center.x = startX;
      center.y = startY;
      center.z = startZ;
      return false;
    }
    center.y += down.y * downHit.t + SKIN;

    // Final validation before committing (parkour safety rule).
    if (!this.isClear(center, half, filter)) {
      center.x = startX;
      center.y = startY;
      center.z = startZ;
      return false;
    }

    // Consume the horizontal motion we just used.
    remaining.x -= forward.x * advance;
    remaining.z -= forward.z * advance;
    return true;
  }

  // -------------------------------------------------------------------------
  // Raycast
  // -------------------------------------------------------------------------

  /**
   * Cast a ray and return the nearest hit.
   *
   * Used by light sampling (Section 7.1), AI perception (Section 11), hitscan
   * (Section 8.1), and the per-step grenade tunnelling check (Section 9).
   *
   * @param {object} origin
   * @param {object} direction assumed normalised
   * @param {number} maxDistance
   * @param {(box: CollisionBox) => boolean} [filter]
   * @returns {{distance:number, box:CollisionBox, nx:number, ny:number,
   *            nz:number, x:number, y:number, z:number}|null}
   */
  raycast(origin, direction, maxDistance, filter) {
    const delta = set(scratch.delta, direction.x * maxDistance, direction.y * maxDistance, direction.z * maxDistance);

    const min = scratch.min;
    const max = scratch.max;
    min.x = Math.min(origin.x, origin.x + delta.x);
    min.y = Math.min(origin.y, origin.y + delta.y);
    min.z = Math.min(origin.z, origin.z + delta.z);
    max.x = Math.max(origin.x, origin.x + delta.x);
    max.y = Math.max(origin.y, origin.y + delta.y);
    max.z = Math.max(origin.z, origin.z + delta.z);

    const candidates = this.query(min, max);
    let best = null;

    for (let i = 0; i < candidates.length; i++) {
      const box = candidates[i];
      if (filter && filter(box) === false) continue;
      const hit = raySlab(origin, delta, box.min, box.max);
      if (!hit || hit.t < 0) continue;
      if (!best || hit.t < best.t) best = { t: hit.t, nx: hit.nx, ny: hit.ny, nz: hit.nz, box };
    }

    if (!best) return null;
    return {
      distance: best.t * maxDistance,
      box: best.box,
      nx: best.nx,
      ny: best.ny,
      nz: best.nz,
      x: origin.x + delta.x * best.t,
      y: origin.y + delta.y * best.t,
      z: origin.z + delta.z * best.t,
    };
  }

  /**
   * Is the straight line between two points unobstructed?
   * The workhorse for light sampling and AI perception.
   */
  lineOfSight(from, to, filter) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distance < EPSILON) return true;
    const inv = 1 / distance;
    const direction = set(scratch.normal, dx * inv, dy * inv, dz * inv);
    const sightFilter = filter || defaultSightFilter;
    const hit = this.raycast(from, direction, distance, sightFilter);
    return hit === null;
  }

  /** Total solid boxes. Surfaced in the debug overlay. */
  get boxCount() {
    return this.boxes.length;
  }

  get bounds() {
    this._ensureGrid();
    return this._bounds;
  }
}

function defaultSightFilter(box) {
  return box.blocksSight;
}

// ---------------------------------------------------------------------------
// Gravity
// ---------------------------------------------------------------------------

/**
 * Integrate gravity for one fixed step, clamped to terminal velocity so the
 * swept solver stays well conditioned no matter how long a fall lasts.
 */
export function applyGravity(velocity, dt, gravity, maxFallSpeed) {
  velocity.y += gravity * dt;
  if (velocity.y < -maxFallSpeed) velocity.y = -maxFallSpeed;
  return velocity;
}

/**
 * Classify a ledge height into the traversal bands from Section 6.1.
 * Both the collision logic and the affordance-marking pass call this, so a
 * marking cannot disagree with what the controller will actually do.
 *
 * @param {number} height metres above the surface the actor is standing on
 * @returns {'vault'|'mantle'|'hang'|null}
 */
export function classifyReach(rise, reach = CONFIG.shade.reach.standing) {
  const R = CONFIG.shade.reach;
  if (rise < R.stepOver) return 'step';
  if (rise > reach) return null;
  return rise <= R.vaultTop ? 'vault' : 'mantle';
}
