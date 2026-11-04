/**
 * BLACKLINE - systems/aipatrol.js
 *
 * How the Warden's patrol changes as the round runs out (K7). Which node it
 * walks to next and how long it stands there are already the seed's (ai.js
 * shuffles the circuit and draws each pause), so two seeds are two patrols.
 * What the circuit cannot know is the clock: a Shade that has not planted by
 * the last minute has to plant in the next one, and the only places it can are
 * the site rooms.
 *
 * So below `CONFIG.ai.patrol.siteCheckAt` seconds left, at its next node pick
 * - the step it arrives somewhere, never mid-route, and only in PATROL - the
 * Warden walks to each site's room once, the nearest first from where it
 * stands, stands there for the pause every node draws and scans, then on to the
 * next room not yet seen, then back to the circuit at the node after the one it
 * left it from. A site a Warden is already standing at when the pick is made
 * counts as seen: the pause it is in is the scan. Once per site per round; the
 * round's `reset()` clears it.
 *
 * No randomness and no draw from the seeded stream: "nearest first" is a
 * distance, and the pause is the one the arrival has already drawn, so a
 * replayed seed checks the rooms in the same order on the same frames.
 *
 * The clock reaches the AI as an event: nothing may import main.js (Section
 * 3.1) and the objective, which owns the clock, does not know the AI reads it.
 * `objective.js` says `round:clock` with `{ remaining }` each time the clock
 * passes a whole second with time left, and `_subscribePatrol` keeps the last
 * one. It is a second behind at worst, and unheard (`Infinity`, so not low)
 * between a `reset()` and the first one.
 *
 * Methods of `WardenAI`, installed on its prototype as ainav.js's are (F3):
 * `this` is the AI. Layering (Section 3.1): imports config and aistate.js.
 */

import { A, DEFUSE_SNAP } from './aistate.js';

const P = A.patrol;

/** The test `addSite` and `siteNear` put a foot position to: inside the room's footprint and between its floor and ceiling. */
function inRoom(room, at) {
  return at.x >= room.min.x && at.x <= room.max.x
    && at.z >= room.min.z && at.z <= room.max.z
    && at.y >= room.floorY - 0.5 && at.y < room.ceilingY - 0.5;
}

/**
 * Where to stand to look at each site's room, one per site in `map.sites`'
 * order: the waypoint inside the room nearest the site, or - for a room no
 * waypoint is in - the ground the Warden can stand on nearest the site. Null
 * for a site with no room, or none of either. Every shipped map has a waypoint
 * on each of its sites, so the second is for the map that does not.
 *
 * @param {import('../mapkit.js').GameMap} map
 * @returns {({x:number,y:number,z:number}|null)[]}
 */
export function siteStands(map) {
  return map.sites.map((site) => {
    const room = site.room;
    if (!room) return null;
    let nearest = null;
    let nearestSq = Infinity;
    for (const node of map.waypoints) {
      if (!node || !inRoom(room, node.position)) continue;
      const sq = node.position.distanceToSquared(site.position);
      if (sq < nearestSq) {
        nearestSq = sq;
        nearest = node.position;
      }
    }
    if (nearest) return { x: nearest.x, y: nearest.y, z: nearest.z };
    return map.wardenGround ? map.wardenGround.standAt(site.position, DEFUSE_SNAP) : null;
  });
}

export const PATROL = {
  /** Round state: no clock heard, no site room seen, and one a site with nowhere to stand is never due. */
  _resetPatrol() {
    this._clockLeft = Infinity;
    this._siteStands = siteStands(this.map);
    this._siteDone = this._siteStands.map((stand) => !stand);
    this._siteLeg = -1;
  },

  /** The round clock, as the objective says it. */
  _subscribePatrol() {
    this._unsubscribe.push(this.emitter.on('round:clock', (event) => {
      this._clockLeft = event.remaining;
    }));
  },

  /**
   * A node pick: the Warden has arrived and drawn its pause (ai.js
   * `_stepPatrol`). If the clock is low and a site room is due, route to it;
   * if it has just stood in one and none is due, route back to the circuit.
   *
   * `_circuitIndex` is the node it is walking to, so a circuit arrival spends
   * the node it is at (the step on) before leaving for a room, and a return
   * from one is a route to the node the index already holds.
   *
   * @returns {boolean} true if it has routed; false leaves the pick to the circuit
   */
  _pickSiteRoom() {
    const stands = this._siteStands;
    // At the room it was sent to, or at a circuit node: a leg cut off by
    // another state and re-pathed to the circuit ends there, not at a room.
    const leg = this._siteLeg;
    this._siteLeg = -1;
    const arrived = leg >= 0 && this._atStand(stands[leg]);
    if (arrived) this._siteDone[leg] = true;

    if (this._clockLeft < P.siteCheckAt) {
      for (let next = this._dueSite(); next >= 0; next = this._dueSite()) {
        this._pathTo(stands[next]);
        // Nowhere to go: already standing at it, or no way there. Seen either
        // way, so it is not asked for again.
        if (!this._route.length) {
          this._siteDone[next] = true;
          continue;
        }
        this._siteLeg = next;
        if (!arrived) this._circuitIndex = (this._circuitIndex + 1) % this._circuit.length;
        return true;
      }
    }
    if (!arrived) return false;
    this._pathTo(this.map.waypoints[this._circuit[this._circuitIndex]].position);
    return true;
  },

  /** The site room not yet seen whose stand is nearest the Warden's feet, in 3D so a deck is farther than the floor under it; -1 when none is due. */
  _dueSite() {
    let nearest = -1;
    let nearestSq = Infinity;
    for (let i = 0; i < this._siteStands.length; i++) {
      if (this._siteDone[i]) continue;
      const stand = this._siteStands[i];
      const dx = stand.x - this.warden.position.x;
      const dy = stand.y - this.warden.feetY;
      const dz = stand.z - this.warden.position.z;
      const sq = dx * dx + dy * dy + dz * dz;
      if (sq < nearestSq) {
        nearestSq = sq;
        nearest = i;
      }
    }
    return nearest;
  },

  /** Is the Warden at this stand, as near as a node arrival is (twice the radius it arrives at)? */
  _atStand(stand) {
    return Math.hypot(
      stand.x - this.warden.position.x, stand.y - this.warden.feetY, stand.z - this.warden.position.z
    ) <= A.waypointArriveRadius * 2;
  },
};
