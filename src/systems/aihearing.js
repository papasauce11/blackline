/**
 * BLACKLINE - systems/aihearing.js
 *
 * What the Warden remembers of what it has heard (K2, Section 7.2). Hearing
 * used to be a test with no past: a noise inside its radius turned the
 * Warden toward the exact coordinate of the sound, and the next footstep two
 * seconds later was a stranger to the first. A person who hears a step in the
 * next room shrugs; one who hears four goes to look, and goes to the room, not
 * to the spot, because a sound says where something is to within a room and no
 * closer.
 *
 * So each room of the map keeps an attention level (`this.attention`, one
 * entry per `map.rooms[i]`, nothing for open ground). A noise the Warden hears
 * adds to its room's level by how near it was, the level fades exponentially,
 * and when a room's level reaches `investigateAt` the Warden goes to that
 * room's waypoint nearest its centre. One noise is never enough
 * (`gain` is under `investigateAt`); several in a few seconds always are.
 *
 * A single noise still does what it did (PATROL -> SUSPICIOUS, facing it for
 * the hold). What changes is where it sends the Warden when the Warden is not
 * in the room the sound was in: a person in the next room can tell which room
 * a sound came from and no closer, so it goes to that room's waypoint. A
 * Warden in the room itself can tell where in it, and goes to the sound, as
 * does one hearing a sound on open ground.
 *
 * Methods of `WardenAI` (installed on the prototype as aisearch.js's are), so
 * `this` is the AI. No randomness and no timers: the fixed step's `dt` and the
 * noise field's own count are all it reads.
 *
 * Layering (Section 3.1): imports config and aistate.js; the noise field and
 * the map are handed to the AI.
 */

import { A, AI_STATE } from './aistate.js';

const H = A.hearing;

/** Is the point in the room: its rectangle, and the floor it stands on (see `_roomIndexAt`). */
function roomHolds(room, point) {
  return point.x >= room.min.x && point.x <= room.max.x
    && point.z >= room.min.z && point.z <= room.max.z
    && point.y >= room.floorY - 0.5 && point.y < room.ceilingY - 0.5;
}

export const HEARING = {
  /**
   * Nothing is remembered and nothing is owed: the constructor and `reset()`
   * both start here. The count is where the noise field is now, so an event
   * emitted before the round began is not heard after it.
   */
  _resetHearing() {
    this.attention = this.map.rooms.map(() => 0);
    /** The room the newest noise the AI listened to was in, or -1 (open ground, or none yet). */
    this.hearingRoom = -1;
    this._heardSeq = this.detection ? this.detection.noise.emitted : 0;
    this._underfoot = { x: 0, y: 0, z: 0 };
  },

  /**
   * One step of hearing: fade every room's attention, count the noises that
   * are new, and move the state machine on what they add up to. Always
   * fades; listens only when the AI is not fighting or guarding a charge
   * (ENGAGE and DEFEND are deaf to everything but the shot that breaks them).
   *
   * Hearing is still `noise.heard()` for the single-noise reaction, so a
   * Warden whose own footstep is the loudest thing in range (it walks at 8m,
   * the Shade at 4m) turns to nothing, as before. The counting walks the
   * pool for every Shade-side event in range instead, so the memory is not
   * deaf to a quiet step just because the Warden is walking.
   */
  _hear(dt, warden) {
    const noise = this.detection.noise;
    const attention = this.attention;
    const keep = Math.exp(-dt / H.decayTau);
    for (let i = 0; i < attention.length; i++) attention[i] *= keep;

    // The count only rises; a fresh field starts again from one.
    const seen = noise.emitted < this._heardSeq ? 0 : this._heardSeq;
    this._heardSeq = noise.emitted;
    if (this.state === AI_STATE.ENGAGE || this.state === AI_STATE.DEFEND) return;

    // Each new noise in earshot adds to its room; the one that carries a room
    // over the line, loudest level first, is where the Warden is sent.
    let newest = seen;
    let reached = null;
    let reachedLevel = 0;
    const at = warden.position;
    const pool = noise.pool;
    for (let i = 0; i < pool.length; i++) {
      const event = pool[i];
      if (!event.active || event.source === 'warden' || event.seq <= seen) continue;
      const dx = event.x - at.x;
      const dy = event.y - at.y;
      const dz = event.z - at.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distance > event.radius) continue;

      const room = this._roomIndexAt(event);
      if (event.seq > newest) {
        newest = event.seq;
        this.hearingRoom = room;
      }
      if (room < 0) continue;
      const level = Math.min(H.max, attention[room] + H.gain * (1 - distance / event.radius));
      attention[room] = level;
      if (level >= H.investigateAt && level > reachedLevel) {
        reached = event;
        reachedLevel = level;
      }
    }

    // The single-noise reaction, as it was: the loudest thing in earshot that
    // is not the Warden's own.
    const heard = noise.heard(at);
    if (heard && heard.source !== 'warden') {
      this.lastKnown = this._whereHeard(heard);
      if (this.state === AI_STATE.PATROL) this._enter(AI_STATE.SUSPICIOUS);
    }

    // The memory: enough in one room is a reason to go there, now, with no
    // hold to wonder in first.
    if (reached && (this.state === AI_STATE.PATROL || this.state === AI_STATE.SUSPICIOUS)) {
      this.lastKnown = this._whereHeard(reached);
      this._enterInvestigate();
    }
  },

  /**
   * Where a noise sends the Warden. From outside the room it came from, the
   * room's waypoint (the exact point if the room has none): a sound says which
   * room and no more. From inside it, or on open ground, the sound's own point.
   * The Warden's room is read at its feet, as the noise's is.
   */
  _whereHeard(event) {
    const point = { x: event.x, y: event.y, z: event.z };
    const room = this._roomIndexAt(event);
    if (room < 0) return point;
    const feet = this._underfoot;
    feet.x = this.warden.position.x;
    feet.y = this.warden.feetY;
    feet.z = this.warden.position.z;
    if (this._roomIndexAt(feet) === room) return point;
    return this._roomTarget(room) || point;
  },

  /**
   * The index into `map.rooms` of the room a point is in, or -1 for open
   * ground. The first that holds it, by the rectangle and by the floor it
   * stands on: from half a metre under the floor to half a metre under the
   * ceiling, which is `addSite`'s own containment (mapkit.js). The ceiling's
   * half metre is what keeps a deck from belonging to the room beneath it:
   * the plant's deck is the Turbine Hall's and the Loading Bay's ceiling and
   * the offices' floor, at one height.
   */
  _roomIndexAt(point) {
    const rooms = this.map.rooms;
    for (let i = 0; i < rooms.length; i++) if (roomHolds(rooms[i], point)) return i;
    return -1;
  },

  /**
   * Where the Warden goes for a room: the waypoint inside it, on its floor,
   * nearest its centre, as a fresh point; null if the room has none (the
   * caller keeps the noise's own point). Read off the map once per AI, as the
   * waypoints do not move.
   */
  _roomTarget(roomIndex) {
    const room = this.map.rooms[roomIndex];
    if (!room) return null;
    if (!this._roomNodes) this._roomNodes = [];
    let node = this._roomNodes[roomIndex];
    if (node === undefined) {
      const cx = (room.min.x + room.max.x) / 2;
      const cz = (room.min.z + room.max.z) / 2;
      let best = Infinity;
      node = null;
      for (const candidate of this.map.waypoints) {
        if (!candidate || !roomHolds(room, candidate.position)) continue;
        const distance = Math.hypot(candidate.position.x - cx, candidate.position.z - cz);
        if (distance < best) {
          best = distance;
          node = candidate;
        }
      }
      this._roomNodes[roomIndex] = node;
    }
    return node ? { x: node.position.x, y: node.position.y, z: node.position.z } : null;
  },
};
