/**
 * BLACKLINE — systems/ainav.js
 *
 * How the Warden gets somewhere (Section 11: no pathfinding library): A* over
 * the waypoint graph, the last leg planned over the ground the Warden can
 * actually walk (A8), steering along the route, turning at the spec'd rate,
 * and the stuck detector that forces a re-path. Nothing here decides *where*
 * to go; that is the state machine in ai.js.
 *
 * Methods of `WardenAI`, kept in their own file (F3). ai.js installs them on
 * the prototype, so `this` is the AI and every field keeps its name.
 */

import { findPath } from './astar.js';
import { A, DEFUSE_SNAP, MOVING_STATES, angleDelta } from './aistate.js';

export const NAVIGATION = {
  /**
   * Build a route to a world position: graph nodes from here to the node
   * nearest the goal, then the goal itself.
   */
  _pathTo(goal) {
    this._route.length = 0;
    this._routeIndex = 0;
    this._arrivalTime = 0;

    // The goal node is chosen for where the Warden will STAND, not where the
    // charge is: a charge 2.3m up on a vent lip is nearer in three dimensions
    // to a deck node than to the floor node beside it, and that choice sent
    // the Warden up a staircase and back down it. A goal off the ground and
    // beyond the snap keeps its own position, as before.
    // Both ends as FEET. `nearestWaypoint` prefers a node on the body's own
    // floor, "own" being within two steps of the height it is given - and
    // the Warden's position is its centre, a metre above its feet, so from
    // the deck no deck node was ever on its floor and the nearest node
    // anywhere won: a corridor node six metres below, three metres over.
    // The follower then walked the deck above a ground route and off its
    // edge at the last leg (B9 watched it fall six metres onto site A). The
    // goal was already a foot position.
    const ground = this.map.wardenGround;
    const stand = ground ? ground.standAt(goal, DEFUSE_SNAP) : null;
    const feet = { x: this.warden.position.x, y: this.warden.feetY, z: this.warden.position.z };
    const from = this.map.nearestWaypoint(feet);
    const to = this.map.nearestWaypoint(stand || goal);
    if (from && to) {
      const nodes = this._findPath(from.id, to.id);
      for (const id of nodes) {
        const p = this.map.waypoints[id].position;
        this._route.push({ x: p.x, y: p.y, z: p.z });
      }
    }

    // The last leg, from the final waypoint to the goal, used to be a straight
    // line with only the solver to steer it round whatever was in the way -
    // and Block A measured it at up to 15m on the first map. It is planned
    // now, over the ground the Warden can actually walk (A1's flood), in
    // segments no longer than `maxUnpathedLeg`. A goal that is not on that
    // ground - a search spot in mid-air, a charge nothing could reach - keeps
    // the straight line, and the stuck detector behind it, as before.
    const last = this._route.length ? this._route[this._route.length - 1] : this.warden.position;
    const tail = ground
      ? ground.route(
        { x: last.x, y: last === this.warden.position ? this.warden.feetY : last.y, z: last.z },
        goal, A.maxUnpathedLeg, DEFUSE_SNAP, A.routeEdgeMargin
      )
      : null;
    if (tail) {
      for (let i = 1; i < tail.length; i++) this._route.push(tail[i]);
    } else {
      this._route.push({ x: goal.x, y: goal.y, z: goal.z });
    }
  },

  /**
   * A* over the waypoint graph. The search itself is in systems/astar.js —
   * pure, and the one piece of navigation with no knowledge of a Warden.
   */
  _findPath(startId, goalId) {
    return findPath(this.map.waypoints, startId, goalId);
  },

  /**
   * Steer along the current route.
   * @returns {boolean} true once the final point is reached
   */
  _followRoute(dt, sprint) {
    if (this._routeIndex >= this._route.length) {
      if (!this._arrivalTime) this._arrivalTime = this._stateTimer;
      return true;
    }
    const target = this._route[this._routeIndex];
    const flat = Math.hypot(target.x - this.warden.position.x, target.z - this.warden.position.z);
    if (flat <= A.waypointArriveRadius) {
      this._routeIndex++;
      return this._routeIndex >= this._route.length ? this._followRoute(dt, sprint) : false;
    }

    const off = this._face(target, dt);
    // Walk once roughly aligned, so the Warden turns on the spot rather than
    // orbiting its target.
    if (Math.abs(off) < Math.PI / 3) {
      this.intent.forward = 1;
      this.intent.sprint = sprint;
    }
    return false;
  },

  /**
   * Turn toward a point at the spec'd turn rate.
   * @returns {number} the remaining angle after turning
   */
  _face(target, dt, aim) {
    const dx = target.x - this.warden.position.x;
    const dz = target.z - this.warden.position.z;
    if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return 0;

    // Aim error cone (Section 11 difficulty): the gun is held off the target
    // by `_aimYaw` and `_aimPitch`, drawn per burst (`_drawAimError`).
    const desired = Math.atan2(-dx, -dz) + (aim ? this._aimYaw : 0);
    let delta = angleDelta(this.warden.yaw, desired);
    const maxTurn = A.turnRate * dt;
    const applied = Math.max(-maxTurn, Math.min(maxTurn, delta));

    let pitchDelta = 0;
    if (aim) {
      const eyeDy = (target.y !== undefined ? target.y : this.warden.eyeY) - this.warden.eyeY;
      const desiredPitch = Math.atan2(eyeDy, Math.hypot(dx, dz)) + this._aimPitch;
      pitchDelta = Math.max(-maxTurn, Math.min(maxTurn, desiredPitch - this.warden.pitch));
    }
    this.warden.look(applied, pitchDelta);
    return delta - applied;
  },

  /** Sweep left and right on the spot (PATROL pause, INVESTIGATE, SEARCH). */
  _scan(dt) {
    this._scanPhase += A.patrolScanSpeed * dt;
    const half = (A.patrolScanDegrees * Math.PI) / 360;
    // Rate of change of half*sin(phase), so the sweep is a turn, not a snap.
    this.warden.look(half * Math.cos(this._scanPhase) * A.patrolScanSpeed * dt, 0);
  },

  _nearestWaypoints(position, count) {
    return this.map.waypoints
      .slice()
      .sort((a, b) => a.position.distanceToSquared(position) - b.position.distanceToSquared(position))
      .slice(0, count);
  },

  _distanceTo(point) {
    return Math.hypot(point.x - this.warden.position.x, point.z - this.warden.position.z);
  },

  _positionOf(actor) {
    return actor ? { x: actor.position.x, y: actor.feetY, z: actor.position.z } : null;
  },

  // -------------------------------------------------------------------------
  // Stuck handling (Section 11)
  // -------------------------------------------------------------------------

  /**
   * "If the AI's position changes less than 0.3m over 2s while in a moving
   * state, force a re-path from the nearest waypoint."
   *
   * Deliberately not gated on whether the AI *wants* to move: a Warden wedged
   * on a corner still believes it is walking, which is the whole failure.
   */
  _checkStuck(dt) {
    if (MOVING_STATES.indexOf(this.state) === -1 || this._pauseTimer > 0) {
      this.stuckTimer = 0;
      this._stuckAnchor.x = this.warden.position.x;
      this._stuckAnchor.z = this.warden.position.z;
      return;
    }

    this.stuckTimer += dt;
    if (this.stuckTimer < A.stuckTime) return;

    const moved = Math.hypot(
      this.warden.position.x - this._stuckAnchor.x,
      this.warden.position.z - this._stuckAnchor.z
    );
    this.stuckTimer = 0;
    this._stuckAnchor.x = this.warden.position.x;
    this._stuckAnchor.z = this.warden.position.z;
    if (moved >= A.stuckDistance) return;

    this.stuckCount++;
    if (this.emitter) this.emitter.emit('ai:stuck', { at: { ...this._stuckAnchor }, count: this.stuckCount });

    const goal = this._route.length ? this._route[this._route.length - 1] : null;
    if (goal) this._pathTo(goal);
  }
};
