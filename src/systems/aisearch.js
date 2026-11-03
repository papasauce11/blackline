/**
 * BLACKLINE - systems/aisearch.js
 *
 * How the Warden searches (K1, Section 11's SEARCH): where a person would
 * look, not the three waypoints nearest the spot it lost the Shade.
 *
 * A Shade that breaks line of sight does one of two things. She goes to
 * ground - behind a crate, under a gantry - or she goes up, onto something the
 * Warden cannot climb, and waits for it to walk under her. The waypoint sweep
 * this replaces looked at neither: waypoints sit in open space by design, so it
 * walked three open places and the Shade stayed hidden at a distance of two
 * metres. This reads both off the map, mechanically and never by tag, so it
 * holds on the plant and on the yard and on whatever map comes next:
 *
 *   hiding spots  the ground beside each face of a box a crouching Shade fits
 *                 behind (`searchCoverMinHeight` to `searchCoverMaxHeight` above
 *                 its floor, small enough to walk round), and the ground under
 *                 anything overhead within `searchOverheadMax`. Kept only where
 *                 a Shade could stand AND the Warden could walk to, so a sweep
 *                 is never sent somewhere it cannot go.
 *   tops          the climbable surfaces the Warden cannot stand on, more than
 *                 `searchLookUpMinRise` above the ground beside them. The Warden
 *                 has no climb (Section 6.2); a top is exactly where it is blind.
 *
 * `planSweep` ranks the spots from the last-known position and picks the tops
 * near it, then orders the lot nearest first from where the Warden stands.
 * The `SEARCH` methods at the bottom are installed on `WardenAI`'s prototype
 * as `ainav.js`'s are (F3): `this` is the AI. Looking up is the one new thing a
 * body does here - the gaze goes up at the top's centre and holds - and what
 * sees the Shade there is `aiperception.js`, unchanged: a flat cone and a line
 * of sight, so a Shade on a top is seen the way a Shade anywhere is.
 *
 * No randomness and no draw from the seeded stream: the sweep is a function of
 * the map and of two positions, so a replayed seed searches the same way.
 *
 * Layering (Section 3.1): imports config and aistate.js. The derivations read
 * a map's collision world and its Warden ground and nothing else.
 */

import { CONFIG } from '../config.js';
import { A, AI_STATE } from './aistate.js';

const S = CONFIG.shade;
const W = CONFIG.warden;

/** A crouching Shade's torso: where a hiding spot is looked at, and a top looked up at. */
const PERCH = S.crouchHeight * CONFIG.detection.torsoHeightRatio;
/** The Warden's eye above its feet (`Warden.eyeY`, which needs a body). */
const EYE = W.standHeight * W.eyeHeightRatio;
const DOWN = { x: 0, y: -1, z: 0 };
const UP = { x: 0, y: 1, z: 0 };
/** How far down to look for the floor under a box: more than the map is tall. */
const FLOOR_REACH = CONFIG.map.ceilingY + 1;
/** Where along a face a spot goes: its middle, or both quarter points on a long one. */
const SHORT_FACE = [0.5];
const LONG_FACE = [0.25, 0.75];
const LONG = 3;

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** The point on a top a Shade crouching there would be seen at. */
function perchOf(top) {
  return { x: top.position.x, y: top.position.y + PERCH, z: top.position.z };
}

/** The top of whatever is under (x, z) from height y, other than `skip`; null if nothing is. */
function floorUnder(collision, x, y, z, skip) {
  const hit = collision.raycast({ x, y, z }, DOWN, FLOOR_REACH, (box) => box.solid && box !== skip);
  return hit ? hit.y : null;
}

/** The ground beside the four faces of a box, a Shade's radius and a margin out. */
function beside(box) {
  const out = S.radius + A.searchSpotMargin;
  const w = box.max.x - box.min.x;
  const d = box.max.z - box.min.z;
  const points = [];
  for (const high of [false, true]) {
    const x = high ? box.max.x + out : box.min.x - out;
    const z = high ? box.max.z + out : box.min.z - out;
    for (const t of d > LONG ? LONG_FACE : SHORT_FACE) points.push({ x, z: box.min.z + d * t });
    for (const t of w > LONG ? LONG_FACE : SHORT_FACE) points.push({ x: box.min.x + w * t, z });
  }
  return points;
}

/**
 * Every place on a map a crouching Shade could be out of sight: beside the
 * faces of cover, and under an overhang.
 *
 * @param {import('../mapkit.js').GameMap} map
 * @returns {{kind:string, tag:string, position:{x:number,y:number,z:number}}[]}
 *   `position` is a foot position, as the Warden's ground keeps them
 */
export function deriveHidingSpots(map) {
  const collision = map.collision;
  const ground = map.wardenGround;
  const spots = [];
  if (!ground) return spots;
  const half = { x: S.radius, y: S.crouchHeight / 2, z: S.radius };
  const spacing = A.searchSpotSpacing * A.searchSpotSpacing;

  // A candidate is kept where the body fits, the Warden can stand (so it can
  // go and look), and no spot is already within the spacing of it.
  const keep = (kind, tag, x, floor, z) => {
    if (spots.length >= A.searchSpotCap) return;
    if (!collision.isClear({ x, y: floor + half.y + 0.02, z }, half)) return;
    if (!ground.has({ x, y: floor, z })) return;
    for (const other of spots) {
      const p = other.position;
      if ((p.x - x) * (p.x - x) + (p.z - z) * (p.z - z) < spacing && Math.abs(p.y - floor) < S.crouchHeight) return;
    }
    spots.push({ kind, tag, position: { x, y: floor, z } });
  };

  for (const box of collision.boxes) {
    if (!box.solid || !box.blocksSight) continue;
    if (Math.max(box.max.x - box.min.x, box.max.z - box.min.z) > A.searchMaxSide) continue;
    // Standing on a floor, not hung in the air: a vent lip hides nobody.
    const floor = floorUnder(collision, box.centerX, box.min.y + 0.02, box.centerZ, box);
    if (floor === null || box.min.y - floor > A.searchCoverLift) continue;
    const height = box.max.y - floor;
    if (height < A.searchCoverMinHeight || height > A.searchCoverMaxHeight) continue;
    for (const p of beside(box)) keep('cover', box.tag, p.x, floor, p.z);
  }

  // Under an overhang, on a coarse grid of the Warden's own ground: the rule
  // asks only what is overhead, so a gantry and a walkway need no names.
  ground.forEach((x, y, z) => {
    const at = ground.indexAt(x, z);
    if (!at || at.i % A.searchOverheadStride || at.j % A.searchOverheadStride) return;
    const head = { x, y: y + S.crouchHeight, z };
    if (!collision.raycast(head, UP, A.searchOverheadMax - S.crouchHeight)) return;
    keep('overhang', '', x, y, z);
  });
  return spots;
}

/**
 * The climbable tops the Warden cannot get on, high enough above the ground
 * beside them to be out of plain sight.
 *
 * @param {import('../mapkit.js').GameMap} map
 * @returns {{kind:string, tag:string, rise:number, position:{x:number,y:number,z:number}}[]}
 *   `position` is the middle of the top surface
 */
export function deriveTops(map) {
  const ground = map.wardenGround;
  const tops = [];
  if (!ground) return tops;
  const step = W.stepHeight;
  for (const box of map.collision.boxes) {
    if (!box.climbable) continue;
    const w = box.max.x - box.min.x;
    const d = box.max.z - box.min.z;
    if (Math.max(w, d) > A.searchMaxSide) continue;
    const top = box.max.y;
    const centre = { x: box.centerX, y: top, z: box.centerZ };
    // The Warden's floors round it: one at the top's own height inside its
    // footprint means the Warden can stand there; the highest one below it
    // beside the footprint is the ground the rise is measured from.
    let reachable = false;
    let base = CONFIG.map.groundY;
    for (const cell of ground.cellsWithin(centre, Math.hypot(w, d) / 2 + A.searchArriveRadius + ground.cell)) {
      const over = cell.x >= box.min.x - ground.cell && cell.x <= box.max.x + ground.cell
        && cell.z >= box.min.z - ground.cell && cell.z <= box.max.z + ground.cell;
      if (over && Math.abs(cell.y - top) <= step) {
        reachable = true;
        break;
      }
      if (!over && cell.y < top - step && cell.y > base) base = cell.y;
    }
    if (reachable || top - base <= A.searchLookUpMinRise) continue;
    tops.push({ kind: 'top', tag: box.tag, rise: top - base, position: centre });
  }
  return tops;
}

/**
 * The best `count` spots to look in, from where the Shade was last known:
 * nearest first, less `searchHiddenBonus` metres for one that position cannot
 * see - which is what cover is. Only the nearest few are asked whether they
 * are hidden, because each ask is a ray.
 *
 * @param {object[]} spots from `deriveHidingSpots`
 * @param {{x:number,y:number,z:number}} from a foot position
 * @param {{count?:number, collision?:object}} [options] without a collision
 *   world nothing is hidden and the ranking is distance alone
 */
export function rankSpots(spots, from, { count = A.searchSpotCount, collision = null } = {}) {
  const near = [];
  for (const spot of spots) {
    const p = spot.position;
    const away = Math.hypot(p.x - from.x, p.y - from.y, p.z - from.z);
    if (away <= A.searchSpotRadius) near.push({ spot, away, score: away });
  }
  near.sort((a, b) => a.away - b.away);
  near.length = Math.min(near.length, count * A.searchRankPool);
  if (collision) {
    const eye = { x: from.x, y: from.y + EYE, z: from.z };
    for (const entry of near) {
      const p = entry.spot.position;
      if (!collision.lineOfSight(eye, { x: p.x, y: p.y + PERCH, z: p.z })) entry.score -= A.searchHiddenBonus;
    }
    near.sort((a, b) => a.score - b.score);
  }
  return near.slice(0, count).map((entry) => entry.spot);
}

/** The tops within `radius` of a position, flat, nearest first, at most `count`. */
export function topsNear(tops, from, radius = A.searchLookUpRadius, count = A.searchLookUpCount) {
  return tops
    .map((top) => ({ top, away: flat(top.position, from) }))
    .filter((entry) => entry.away <= radius)
    .sort((a, b) => a.away - b.away)
    .slice(0, count)
    .map((entry) => entry.top);
}

/**
 * Does a Warden standing at this foot position have a line up to the top? To
 * the perch and to a point lower, so the place found is not one the Warden
 * loses by stopping a step short of it: the lip of the stack is what sets the
 * line, and a Shade is not always at the middle.
 */
function linesUpTo(collision, top, p) {
  const perch = perchOf(top);
  const eye = { x: p.x, y: p.y + EYE, z: p.z };
  return flat(p, perch) <= A.viewRange
    && collision.lineOfSight(eye, perch)
    && collision.lineOfSight(eye, { x: perch.x, y: perch.y - A.searchVantageMargin, z: perch.z });
}

/** Every place the Warden can stand with a line up to a top (one cell in `searchVantageStride`), kept per top: a map does not move. */
const VANTAGES = new WeakMap();

function vantagesOf(map, top) {
  let cells = VANTAGES.get(top);
  if (!cells) {
    cells = map.wardenGround.cellsWithin(perchOf(top), A.searchLookUpRadius)
      .filter((cell, n) => n % A.searchVantageStride === 0 && linesUpTo(map.collision, top, cell));
    VANTAGES.set(top, cells);
  }
  return cells;
}

/**
 * Where the Warden should stand to look up at a top: where it is, if it has a
 * line to the top's perch already, otherwise the nearest ground to it that
 * does. Null if there is none.
 */
export function vantageFor(map, top, at) {
  if (linesUpTo(map.collision, top, at)) return at;
  // Nearest by the way it is walked: a deck above is a staircase away, so a
  // metre of height counts for more than a metre along.
  let best = null;
  let bestAway = Infinity;
  for (const cell of vantagesOf(map, top)) {
    const away = flat(cell, at) + Math.abs(cell.y - at.y) * A.searchFloorWeight;
    if (away < bestAway) {
      best = cell;
      bestAway = away;
    }
  }
  return best;
}

/** The checks in the order a Warden would walk them, each next to the last. */
function nearestFirst(checks, at) {
  const left = checks.slice();
  const ordered = [];
  let here = at;
  while (left.length) {
    let best = 0;
    for (let i = 1; i < left.length; i++) {
      if (flat(left[i].position, here) < flat(left[best].position, here)) best = i;
    }
    here = left[best].position;
    ordered.push(left[best]);
    left.splice(best, 1);
  }
  return ordered;
}

const INDEXES = new WeakMap();

/**
 * A map's hiding spots and tops, derived once. Keyed on the map and on how
 * many boxes it has, so a check that stages a lid (and so re-derives what is
 * climbable) is not answered from before the lid.
 */
export function searchIndexFor(map) {
  const boxes = map.collision.boxes.length;
  let index = INDEXES.get(map);
  if (!index || index.boxes !== boxes) {
    index = { boxes, spots: deriveHidingSpots(map), tops: deriveTops(map) };
    INDEXES.set(map, index);
  }
  return index;
}

/**
 * The sweep: a list of checks, each `{kind, position, aim}`. `position` is
 * where to stand and `aim` is the point to look at - a crouching Shade's torso
 * at a spot, the perch on a top. Empty when the map offers nothing to search.
 *
 * @param {object} map
 * @param {{x:number,y:number,z:number}} from the last-known position, feet
 * @param {{x:number,y:number,z:number}} at the Warden's feet
 */
export function planSweep(map, from, at) {
  const index = searchIndexFor(map);
  const checks = [];
  for (const spot of rankSpots(index.spots, from, { collision: map.collision })) {
    const p = spot.position;
    checks.push({ kind: 'spot', position: p, aim: { x: p.x, y: p.y + PERCH, z: p.z } });
  }
  for (const top of topsNear(index.tops, from)) {
    const stand = vantageFor(map, top, at);
    if (stand) checks.push({ kind: 'top', position: stand, aim: perchOf(top) });
  }
  return nearestFirst(checks, at);
}

// ---------------------------------------------------------------------------
// SEARCH, as methods of WardenAI
// ---------------------------------------------------------------------------

export const SEARCH = {
  /**
   * SEARCH: sweep the hiding spots and the tops round the last known
   * position. A map with nothing to offer gets the three nearest waypoints, as
   * before K1.
   */
  _enterSearch() {
    this._enter(AI_STATE.SEARCH);
    this.lookingAt = null;
    this._searchHold = 0;
    const feet = this._positionOf(this.warden);
    const sweep = planSweep(this.map, this.lastKnown || feet, feet);
    this._searchSpots = sweep.length
      ? sweep
      : this._nearestWaypoints(this.lastKnown || this.warden.position, A.searchWaypointCount);
    if (this._searchSpots.length) this._pathTo(this._searchSpots[0].position);

    // One stun grenade into a likely hiding spot (Section 11). Phase 9 throws.
    if (this._stunGrenades > 0 && this.lastKnown) {
      this._stunGrenades -= 1;
      if (this.emitter) this.emitter.emit('ai:throw', { type: 'stunGrenade', at: { ...this.lastKnown } });
    }
  },

  _stepSearch(dt) {
    if (this._stateTimer >= A.searchDuration) {
      this._enter(AI_STATE.PATROL);
      this._pathTo(this.map.waypoints[this._circuit[this._circuitIndex]].position);
      return;
    }
    // Section 9.2's camera, hung on any wall it passes while sweeping. Tried
    // as it walks rather than only where it stops: waypoints sit in open
    // space by design, so a Warden standing on one is usually nowhere near a
    // wall, and a camera it can never place is a camera it does not have.
    this._maybePlaceAlarm(dt);

    const check = this._searchSpots[0];
    if (!check) {
      this._enter(AI_STATE.PATROL);
      return;
    }
    // A plain waypoint (the fallback): walk to it, glance, move on.
    if (!check.aim) {
      if (this._followRoute(dt, false)) {
        this._scan(dt);
        this._nextCheck();
      }
      return;
    }

    if (this.lookingAt !== check) {
      if (!this._reached(check)) {
        this._levelGaze(dt);
        if (this._followRoute(dt, false) && check.kind === 'top') this._approach(check, dt);
        return;
      }
      // Standing now: an unfinished route would read as a Warden meaning to
      // move and going nowhere, and the stuck detector would re-path it.
      this.lookingAt = check;
      this._searchHold = 0;
      this._route.length = 0;
      this._routeIndex = 0;
    }
    // The hold counts only while the gaze is on the target, and it does not
    // end while the Shade is in view: perception has a Shade to fill the
    // accumulator on, and walking off would drain it.
    if (this._gaze(check.aim, dt)) this._searchHold += dt;
    const hold = check.kind === 'top' ? A.searchLookUpHold : A.searchSpotHold;
    if (this._searchHold >= hold && !this.sees) this._nextCheck();
  },

  /** On to the next check, or back to PATROL when the sweep is done. */
  _nextCheck() {
    this.lookingAt = null;
    this._searchHold = 0;
    this._searchSpots.shift();
    if (this._searchSpots.length) this._pathTo(this._searchSpots[0].position);
    else this._enter(AI_STATE.PATROL);
  },

  /**
   * With a line to what it looks at - or, for a hiding spot, at the end of its
   * route or near it. Not for a top: its place to stand was chosen for the
   * line, and a route that ends 0.9m short of it ends under the lip of the
   * stack, so a top is walked the rest of the way (`_approach`).
   */
  _reached(check) {
    if (this._canSee(check.aim)) return true;
    if (check.kind === 'top') return false;
    return this._routeIndex >= this._route.length || flat(check.position, this.warden.position) <= A.searchArriveRadius;
  },

  /**
   * The last of the way to a top's vantage, past where the route stops: face
   * it and walk until the line opens. If it never does, the check is spent.
   */
  _approach(check, dt) {
    if (flat(check.position, this.warden.position) <= A.searchApproachDone) {
      this._nextCheck();
      return;
    }
    if (Math.abs(this._face(check.position, dt)) < Math.PI / 3) this.intent.forward = 1;
  },

  /** A line from the Warden's eye to a point, inside the view range. */
  _canSee(point) {
    const warden = this.warden;
    if (flat(point, warden.position) > A.viewRange) return false;
    return this.map.collision.lineOfSight({ x: warden.position.x, y: warden.eyeY, z: warden.position.z }, point);
  },

  /**
   * Turn the head to a point, in yaw (`_face`, with no aim error: this is
   * looking, not shooting) and in pitch, at the spec'd turn rate. The pitch
   * is clamped to the camera's, or a point overhead could never be reached.
   * @returns {boolean} true once both are within `searchAlign` of it
   */
  _gaze(target, dt) {
    const warden = this.warden;
    const yawOff = this._face(target, dt);
    const camera = W.camera;
    const want = Math.max(camera.pitchMin, Math.min(camera.pitchMax, Math.atan2(target.y - warden.eyeY, flat(target, warden.position))));
    const turn = A.turnRate * dt;
    warden.look(0, Math.max(-turn, Math.min(turn, want - warden.pitch)));
    return Math.abs(yawOff) <= A.searchAlign && Math.abs(want - warden.pitch) <= A.searchAlign;
  },

  /** Bring the head back to level while walking, so a look up is a look and not a tilt it keeps. */
  _levelGaze(dt) {
    const turn = A.turnRate * dt;
    this.warden.look(0, Math.max(-turn, Math.min(turn, -this.warden.pitch)));
  },
};
