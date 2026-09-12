/**
 * BLACKLINE — collisionbox.js
 *
 * The static axis-aligned collision volume and the slab test a ray makes
 * against it. Split out of physics.js (F3): the box is what the map builds
 * and the derivations read, the slab test is the one primitive every sweep
 * and raycast in `CollisionWorld` reduces to. Plain {x, y, z} objects, no
 * Three.js, as physics.js.
 */

/** Below this a component of motion is treated as zero. */
export const EPSILON = 1e-8;


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
   * @param {boolean} [flags.climbable] top face is a usable ledge - set by
   *   `deriveClimbableSurfaces()`, never declared; the map has no say
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
export function raySlab(origin, delta, min, max) {
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
