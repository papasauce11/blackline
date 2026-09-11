/**
 * BLACKLINE — systems/ai.js
 *
 * The Warden's brain (Section 11). A finite state machine, A* over the
 * waypoint graph, and a perception model that reads the visibility meter and
 * the noise field built in Phase 5.
 *
 * Layering (Section 3.1): may import from entities, physics and config. The
 * map, the Warden, the detection system and the emitter are handed in.
 *
 * The load-bearing decision: this file never touches the Warden's position. It
 * fills the same `intent` object a human fills in free-roam and hands it back,
 * and the composition root steps the controller with it. Section 12 requires
 * free-roam to be "a configuration, never a duplicated code path", and the only
 * way to guarantee that is for the AI to have no privileged route into the
 * controller. If the AI can do something the player cannot, it is because the
 * intent has a field for it.
 */

import { CONFIG, SETTINGS } from '../config.js';
import { rng } from '../config.js';
import { findPath } from './astar.js';
import { createWardenIntent, WARDEN_STATE } from '../entities/enforcer.js';

const A = CONFIG.ai;
/**
 * A charge on a crate top is not on the Warden's ground; the Warden works on
 * it from the nearest cell within the defuse reach. The same two numbers the
 * plant rule reads (`DEFUSE_REACH` in systems/objective.js reads them from
 * config too), so where the AI walks to and where the defuse counts from
 * cannot drift apart.
 */
const DEFUSE_SNAP = { radius: CONFIG.round.siteRadius, dy: CONFIG.round.defuseReachY };

export const AI_STATE = {
  PATROL: 'patrol',
  SUSPICIOUS: 'suspicious',
  INVESTIGATE: 'investigate',
  ENGAGE: 'engage',
  SEARCH: 'search',
  DEFEND: 'defend',
  STUNNED: 'stunned',
};

/** States in which a stuck actor means something has gone wrong. */
const MOVING_STATES = [AI_STATE.PATROL, AI_STATE.INVESTIGATE, AI_STATE.ENGAGE, AI_STATE.SEARCH, AI_STATE.DEFEND];

const TAU = Math.PI * 2;

/** Shortest signed angle from `from` to `to`. */
function angleDelta(from, to) {
  let delta = (to - from) % TAU;
  if (delta > Math.PI) delta -= TAU;
  if (delta < -Math.PI) delta += TAU;
  return delta;
}

export class WardenAI {
  /**
   * @param {object} options
   * @param {import('../map.js').GameMap} options.map
   * @param {import('../entities/enforcer.js').Warden} options.warden
   * @param {import('./detection.js').Detection} options.detection
   * @param {object} options.emitter
   */
  constructor({ map, warden, detection, gadgets, emitter }) {
    this.map = map;
    this.gadgets = gadgets || null;
    this.warden = warden;
    this.detection = detection;
    this.emitter = emitter;

    this.intent = createWardenIntent();
    this.state = AI_STATE.PATROL;
    /** 0-100, Section 11. Fills on sight, drains without it. */
    this.accumulator = 0;
    this.difficulty = A.difficulty[SETTINGS.difficulty] || A.difficulty[A.defaultDifficulty];

    /** Where the AI last had eyes on the Shade. Drives SEARCH. */
    this.lastKnown = null;
    this.sees = false;
    this.stuckCount = 0;
    this.stuckTimer = 0;

    this._route = [];
    this._routeIndex = 0;
    this._arrivalTime = 0;
    this._circuit = [];
    this._circuitIndex = 0;
    this._stateTimer = 0;
    this._pauseTimer = 0;
    this._scanPhase = 0;
    this._sightTimer = 0;
    this._lostTimer = 0;
    this._reactionTimer = 0;
    this._staticTimer = 0;
    this._shadeAnchor = { x: 0, z: 0 };
    this._burstRemaining = 0;
    this._burstPause = 0;
    this._searchSpots = [];
    this._stunGrenades = A.searchStunGrenades;
    this._alarmProbeTimer = 0;
    this._repathTimer = 0;
    this._stuckAnchor = { x: 0, z: 0 };
    this._defendTarget = null;
    this._aimOffset = 0;

    this._scratch = { x: 0, y: 0, z: 0 };

    this._unsubscribe = [];
    this._subscribe();
  }

  /**
   * Section 11's DEFEND exit: "break off to ENGAGE if fired upon".
   *
   * The AI drives nothing through this — it only listens. A Warden kneeling
   * over a charge has to notice being attacked, and the only thing that can
   * tell it is the system that applied the damage.
   */
  _subscribe() {
    if (!this.emitter) return;
    this._unsubscribe.push(this.emitter.on('combat:damage', (event) => {
      if (event.target !== 'warden') return;
      if (this.state !== AI_STATE.DEFEND) return;
      // Whoever did that is within a knife's reach. Go and look at them.
      if (event.at) this.lastKnown = { x: event.at.x, y: event.at.y, z: event.at.z };
      else if (!this.lastKnown) {
        this.lastKnown = { x: this.warden.position.x, y: this.warden.feetY, z: this.warden.position.z };
      }
      this._enter(AI_STATE.ENGAGE);
    }));
  }

  dispose() {
    for (const off of this._unsubscribe) off();
    this._unsubscribe.length = 0;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Rebuild every mutable field from scratch (Section 15: round state must not
   * bleed). The patrol circuit is drawn from the seeded stream, so the same
   * seed reproduces the same patrol order — Section 16 check 28.
   */
  reset() {
    this.state = AI_STATE.PATROL;
    this.accumulator = 0;
    this.difficulty = A.difficulty[SETTINGS.difficulty] || A.difficulty[A.defaultDifficulty];
    this.lastKnown = null;
    this.sees = false;
    this.stuckCount = 0;
    this.stuckTimer = 0;
    this._route.length = 0;
    this._routeIndex = 0;
    this._stateTimer = 0;
    this._pauseTimer = 0;
    this._scanPhase = 0;
    this._sightTimer = 0;
    this._lostTimer = 0;
    this._reactionTimer = 0;
    this._staticTimer = 0;
    this._burstRemaining = 0;
    this._burstPause = 0;
    this._searchSpots.length = 0;
    this._stunGrenades = A.searchStunGrenades;
    this._alarmProbeTimer = 0;
    this._repathTimer = 0;
    this._defendTarget = null;
    this._aimOffset = 0;
    this._stuckAnchor.x = this.warden.position.x;
    this._stuckAnchor.z = this.warden.position.z;

    this._circuit = this.map.waypoints.map((node) => node.id);
    rng.shuffle(this._circuit);
    this._circuitIndex = 0;
    this._pathTo(this.map.waypoints[this._circuit[0]].position);
  }

  /** Phase 10 hands the planted charge here; DEFEND takes over until it clears. */
  setDefendTarget(position) {
    this._defendTarget = position ? { x: position.x, y: position.y, z: position.z } : null;
    if (!this._defendTarget || this.state === AI_STATE.ENGAGE) return;
    this._enter(AI_STATE.DEFEND);
    // Section 11: "path directly to the charge". Entering the state is not the
    // same as going there — without this the Warden kept walking the patrol
    // route it happened to be on and only reached the charge by coincidence,
    // which is the same fault ENGAGE had before Phase 6 fixed it.
    this._pathTo(this._defendTarget);
  }

  // -------------------------------------------------------------------------
  // Fixed step
  // -------------------------------------------------------------------------

  /**
   * @param {number} dt fixed step
   * @param {object} context
   * @param {import('../entities/agent.js').Shade} context.shade
   * @returns {object} the intent to step the Warden with
   */
  step(dt, { shade }) {
    const intent = this.intent;
    intent.forward = 0;
    intent.strafe = 0;
    intent.sprint = false;
    intent.ads = false;
    intent.fire = false;
    intent.reload = false;

    // The controller owns the stun (Section 9 taser, Section 11 STUNNED). The
    // AI observes it rather than duplicating the timer.
    if (this.warden.state === WARDEN_STATE.STUNNED) {
      if (this.state !== AI_STATE.STUNNED) this._enter(AI_STATE.STUNNED);
      this._stateTimer += dt;
      return intent;
    }
    if (this.state === AI_STATE.STUNNED) {
      // Section 11: a stun ends in SEARCH, not back where it started.
      this.lastKnown = this.lastKnown || this._positionOf(shade);
      this._enterSearch();
    }

    if (this.warden.state === WARDEN_STATE.DEAD) return intent;

    this._perceive(dt, shade);
    this._stateTimer += dt;

    switch (this.state) {
      case AI_STATE.SUSPICIOUS: this._stepSuspicious(dt); break;
      case AI_STATE.INVESTIGATE: this._stepInvestigate(dt); break;
      case AI_STATE.ENGAGE: this._stepEngage(dt, shade); break;
      case AI_STATE.SEARCH: this._stepSearch(dt); break;
      case AI_STATE.DEFEND: this._stepDefend(dt); break;
      default: this._stepPatrol(dt); break;
    }

    this._checkStuck(dt);
    return intent;
  }

  // -------------------------------------------------------------------------
  // Perception (Section 11)
  // -------------------------------------------------------------------------

  _perceive(dt, shade) {
    const warden = this.warden;
    const previouslySaw = this.sees;
    this.sees = false;

    if (shade && shade.health > 0) {
      const eye = this._scratch;
      eye.x = warden.position.x;
      eye.y = warden.eyeY;
      eye.z = warden.position.z;

      const torso = {
        x: shade.position.x,
        y: shade.feetY + shade.height * CONFIG.detection.torsoHeightRatio,
        z: shade.position.z,
      };
      const dx = torso.x - eye.x;
      const dy = torso.y - eye.y;
      const dz = torso.z - eye.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance <= A.viewRange) {
        // 90 degree cone about the facing direction, measured flat: pitch
        // should not let the Warden lose someone by looking at the floor.
        // Forward is (-sin yaw, -cos yaw), so the bearing of a point in that
        // same form is atan2(-dx, -dz) and the facing bearing is yaw itself.
        const toTarget = Math.atan2(-dx, -dz);
        const off = Math.abs(angleDelta(warden.yaw, toTarget));
        if (off <= (A.fovDegrees * Math.PI) / 360) {
          // Section 9.1: smoke blocks the line entirely, and a flashbang it
          // actually saw disables perception outright for the duration.
          const blinded = this.gadgets && this.gadgets.aiBlinded();
          const smoked = this.gadgets && this.gadgets.blocksSight(eye, torso);
          if (!blinded && !smoked && this.map.collision.lineOfSight(eye, torso)) this.sees = true;
        }
      }

      if (this.sees) {
        // Reaction delay (Section 11 difficulty): a Warden that has just laid
        // eyes on the Shade does not begin accumulating instantly.
        if (!previouslySaw) this._reactionTimer = this.difficulty.reactionDelay;
        this._reactionTimer -= dt;

        this.lastKnown = { x: torso.x, y: shade.feetY, z: torso.z };
        this._lostTimer = 0;

        if (this._reactionTimer <= 0) {
          const visibility = this.detection ? this.detection.smoothed : CONFIG.detection.meterMax;
          const movement = A.movementMultiplier[shade.movementBand] || 1;
          const fill =
            this.difficulty.fillRate *
            (visibility / CONFIG.detection.meterMax) *
            (1 - distance / A.viewRange) *
            movement;
          this.accumulator += fill * dt;
        }
      }
    }

    if (!this.sees) {
      this.accumulator -= A.drainRate * dt;
      this._lostTimer += dt;
    }
    this.accumulator = Math.max(0, Math.min(A.accumulatorMax, this.accumulator));

    // Hearing is a distance test against live noise events (Section 7.2). The
    // Warden ignores its own footsteps, or it would investigate itself.
    if (this.detection && this.state !== AI_STATE.ENGAGE && this.state !== AI_STATE.DEFEND) {
      const heard = this.detection.noise.heard(warden.position);
      if (heard && heard.source !== 'warden') {
        this.lastKnown = { x: heard.x, y: heard.y, z: heard.z };
        if (this.state === AI_STATE.PATROL) this._enter(AI_STATE.SUSPICIOUS);
      }
    }

    // Section 9.2: the alarm camera marks the Shade "on the Warden's HUD for
    // 2s". In competitive the Warden is this, and it has no HUD — so the mark
    // arrives as knowledge instead. A camera trip is a confirmed sighting by a
    // device, not a noise, so it goes straight to INVESTIGATE rather than
    // through SUSPICIOUS: there is nothing to turn around and wonder about.
    if (this.gadgets && this.gadgets.shadeMarked && this.gadgets.shadeMarkedAt && !this.sees) {
      const marked = this.gadgets.shadeMarkedAt;
      this.lastKnown = { x: marked.x, y: marked.y, z: marked.z };
      if (this.state === AI_STATE.PATROL || this.state === AI_STATE.SUSPICIOUS) {
        this._enterInvestigate();
      }
    }

    // Section 11 thresholds. Engage wins over everything short of a stun.
    if (this.accumulator >= A.engageThreshold && this.state !== AI_STATE.ENGAGE) {
      this._enter(AI_STATE.ENGAGE);
    } else if (
      this.accumulator > A.suspicionThreshold &&
      (this.state === AI_STATE.PATROL || this.state === AI_STATE.SUSPICIOUS)
    ) {
      this._enterInvestigate();
    }
  }

  // -------------------------------------------------------------------------
  // States
  // -------------------------------------------------------------------------

  _enter(state) {
    if (this.state === state) return;
    const from = this.state;
    this.state = state;
    this._stateTimer = 0;
    this._scanPhase = 0;
    if (state === AI_STATE.ENGAGE) {
      // Draw a fresh aim error for this engagement, from the seeded stream so
      // a replayed seed reproduces the same shots (Section 16 check 28).
      this._aimOffset = (rng.unit() * this.difficulty.aimErrorDegrees * Math.PI) / 180;
      this._shadeAnchor.x = Infinity;
      this._staticTimer = 0;
    }
    if (this.emitter) this.emitter.emit('ai:state', { from, to: state });
  }

  /** PATROL: a randomised circuit, pausing and scanning at each node. */
  _stepPatrol(dt) {
    if (this._pauseTimer > 0) {
      this._pauseTimer -= dt;
      this._scan(dt);
      return;
    }
    if (this._followRoute(dt, false)) {
      this._pauseTimer = rng.range(A.patrolPauseMin, A.patrolPauseMax);
      this._circuitIndex = (this._circuitIndex + 1) % this._circuit.length;
      this._pathTo(this.map.waypoints[this._circuit[this._circuitIndex]].position);
    }
  }

  /** SUSPICIOUS: stop, turn toward it, hold. */
  _stepSuspicious(dt) {
    if (this.lastKnown) this._face(this.lastKnown, dt);
    if (this._stateTimer >= A.suspiciousHold) {
      if (this.lastKnown) this._enterInvestigate();
      else this._enter(AI_STATE.PATROL);
    }
  }

  _enterInvestigate() {
    this._enter(AI_STATE.INVESTIGATE);
    if (this.lastKnown) this._pathTo(this.lastKnown);
  }

  /** INVESTIGATE: walk to it, scan on arrival, give up to SEARCH. */
  _stepInvestigate(dt) {
    const arrived = this._followRoute(dt, false);
    if (arrived) {
      this._scan(dt);
      if (this._stateTimer >= A.investigateScanTime + this._arrivalTime) this._enterSearch();
      return;
    }
    if (this._stateTimer >= A.investigateTimeout) this._enterSearch();
  }

  /**
   * ENGAGE: close to effective range, fire in bursts, break line of sight
   * between bursts, and call for a frag on a static target.
   *
   * Firing sets `intent.fire`. Nothing reads it until Phase 7 wires the gun —
   * that is the same field a human's mouse button fills, and giving the AI a
   * private path to the weapon is exactly what Section 12 forbids.
   */
  _stepEngage(dt, shade) {
    if (!this.lastKnown) {
      this._enterSearch();
      return;
    }

    const distance = this._distanceTo(this.lastKnown);
    this._face(this.lastKnown, dt, true);

    if (this.sees) {
      // Frag call (Section 11): the Shade has held still long enough to be
      // worth one. Phase 9 owns the throw; the decision is made here.
      const moved = Math.hypot(shade.position.x - this._shadeAnchor.x, shade.position.z - this._shadeAnchor.z);
      if (moved > A.stuckDistance) {
        this._shadeAnchor.x = shade.position.x;
        this._shadeAnchor.z = shade.position.z;
        this._staticTimer = 0;
      } else {
        this._staticTimer += dt;
        if (this._staticTimer >= A.fragStaticTime) {
          this._staticTimer = 0;
          if (this.emitter) this.emitter.emit('ai:throw', { type: 'frag', at: { ...this.lastKnown } });
        }
      }

      this._engagePathed = false;
      if (distance > A.engageRange) {
        // Close the gap.
        this.intent.forward = 1;
        this.intent.sprint = true;
      } else {
        this._fireBurst(dt);
        // Use cover (Section 11): between bursts, break the Shade's line back.
        if (this._burstPause > 0) this._seekCover(dt, shade);
      }
    } else {
      // Lost sight. Path to where it last was — the patrol route it happened
      // to be on is not a route to the target — and give up after 2.5s.
      if (!this._engagePathed) {
        this._pathTo(this.lastKnown);
        this._engagePathed = true;
      }
      this._followRoute(dt, true);
      if (this._lostTimer >= A.engageLoseSightTime) this._enterSearch();
    }
  }

  /**
   * Step toward a spot that breaks the Shade's line of sight, without leaving
   * effective range. Sampled on a ring rather than from authored cover points,
   * so it works anywhere on the map and cannot go stale when the map changes.
   * Only run during a burst pause, which bounds it to a handful of rays.
   */
  _seekCover(dt, shade) {
    if (!shade) return;
    const eyeY = this.warden.eyeY;
    const torso = {
      x: shade.position.x,
      y: shade.feetY + shade.height * CONFIG.detection.torsoHeightRatio,
      z: shade.position.z,
    };
    const step = A.coverProbeDistance;
    const probe = { x: 0, y: eyeY, z: 0 };

    for (let i = 0; i < A.coverProbeCount; i++) {
      const angle = (i / A.coverProbeCount) * TAU;
      probe.x = this.warden.position.x + Math.cos(angle) * step;
      probe.z = this.warden.position.z + Math.sin(angle) * step;
      if (Math.hypot(probe.x - torso.x, probe.z - torso.z) > A.engageRange) continue;
      // Somewhere it can actually stand, that the Shade cannot see into.
      const centre = { x: probe.x, y: this.warden.position.y, z: probe.z };
      if (!this.map.collision.isClear(centre, this.warden.half)) continue;
      if (this.map.collision.lineOfSight(probe, torso)) continue;

      // Strafe rather than turn: the Warden keeps its gun on the target.
      const bearing = angleDelta(this.warden.yaw, Math.atan2(-(probe.x - this.warden.position.x), -(probe.z - this.warden.position.z)));
      this.intent.forward = Math.cos(bearing) > 0 ? 1 : -1;
      this.intent.strafe = Math.sin(bearing) > 0 ? -1 : 1;
      return;
    }
  }

  _fireBurst(dt) {
    this.intent.ads = true;
    if (this._burstPause > 0) {
      this._burstPause -= dt;
      return;
    }
    if (this._burstRemaining <= 0) {
      this._burstRemaining = rng.int(A.engageBurstMin, A.engageBurstMax);
    }
    this.intent.fire = true;
    this._burstRemaining -= 1;
    if (this._burstRemaining <= 0) {
      this._burstPause = rng.range(A.engageBurstPauseMin, A.engageBurstPauseMax);
    }
  }

  /** SEARCH: sweep the nearest waypoints to the last known position. */
  _enterSearch() {
    this._enter(AI_STATE.SEARCH);
    this._searchSpots = this._nearestWaypoints(this.lastKnown || this.warden.position, A.searchWaypointCount);
    if (this._searchSpots.length) this._pathTo(this._searchSpots[0].position);

    // One stun grenade into a likely hiding spot (Section 11). Phase 9 throws.
    if (this._stunGrenades > 0 && this.lastKnown) {
      this._stunGrenades -= 1;
      if (this.emitter) this.emitter.emit('ai:throw', { type: 'stunGrenade', at: { ...this.lastKnown } });
    }
  }

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

    if (this._followRoute(dt, false)) {
      this._scan(dt);
      this._searchSpots.shift();
      if (this._searchSpots.length) this._pathTo(this._searchSpots[0].position);
      else this._enter(AI_STATE.PATROL);
    }
  }

  /** DEFEND: go to the charge and hold it. Fed by Phase 10. */
  _stepDefend(dt) {
    if (!this._defendTarget) {
      this._enter(AI_STATE.PATROL);
      return;
    }
    // Guarding a charge is the best use of the one camera it gets: it cannot
    // watch the approach and the charge at the same time, and this can.
    this._maybePlaceAlarm(dt);

    if (!this._followRoute(dt, false)) return;

    // Arrived. If that is not actually the charge — a route can end at the
    // nearest reachable node, and the Warden can be nudged off by a grenade or
    // a body — go again rather than standing somewhere near it forever.
    const dx = this._defendTarget.x - this.warden.position.x;
    const dz = this._defendTarget.z - this.warden.position.z;
    if (dx * dx + dz * dz > A.defendHoldRadius * A.defendHoldRadius) {
      this._repathTimer -= dt;
      if (this._repathTimer <= 0) {
        this._repathTimer = A.defendRepathInterval;
        this._pathTo(this._defendTarget);
      }
      return;
    }

    this._face(this._defendTarget, dt);
    this._scan(dt);
  }

  /**
   * Section 9.2: one alarm camera per round, placed on a wall.
   *
   * The Warden gets a single one, so it is spent where it earns the most —
   * standing over a charge in DEFEND, or at a spot it has just cleared in
   * SEARCH and is about to walk away from. It sweeps for a wall in reach
   * rather than firing straight ahead, because the useful direction is
   * whichever one it will not be looking at.
   *
   * Throttled rather than run every step: it is a sweep of raycasts, and half
   * a second of walking is the resolution at which "a wall it passed" means
   * anything.
   *
   * @param {number} dt
   * @returns {object|null} the alarm placed, or null
   */
  _maybePlaceAlarm(dt) {
    if (!this.gadgets || this.gadgets.alarm) return null;
    if (this.gadgets.loadout.alarmCamera <= 0) return null;

    this._alarmProbeTimer -= dt;
    if (this._alarmProbeTimer > 0) return null;
    this._alarmProbeTimer = A.alarmPlacementInterval;

    const warden = this.warden;
    const origin = { x: warden.position.x, y: warden.eyeY, z: warden.position.z };
    for (let i = 0; i < A.alarmPlacementProbes; i++) {
      // Start behind and work around, so it covers what its back is turned on.
      const angle = warden.yaw + Math.PI + (i / A.alarmPlacementProbes) * TAU;
      const placed = this.gadgets.placeAlarmOnWall(origin, {
        x: -Math.sin(angle), y: 0, z: -Math.cos(angle),
      });
      if (placed) return placed;
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Navigation — A* over the waypoint graph (Section 11: no pathfinding library)
  // -------------------------------------------------------------------------

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
    const ground = this.map.wardenGround;
    const stand = ground ? ground.standAt(goal, DEFUSE_SNAP) : null;
    const from = this.map.nearestWaypoint(this.warden.position);
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
        goal, A.maxUnpathedLeg, DEFUSE_SNAP
      )
      : null;
    if (tail) {
      for (let i = 1; i < tail.length; i++) this._route.push(tail[i]);
    } else {
      this._route.push({ x: goal.x, y: goal.y, z: goal.z });
    }
  }

  /**
   * A* over the waypoint graph. The search itself is in systems/astar.js —
   * pure, and the one piece of navigation with no knowledge of a Warden.
   */
  _findPath(startId, goalId) {
    return findPath(this.map.waypoints, startId, goalId);
  }

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
  }

  /**
   * Turn toward a point at the spec'd turn rate.
   * @returns {number} the remaining angle after turning
   */
  _face(target, dt, aim) {
    const dx = target.x - this.warden.position.x;
    const dz = target.z - this.warden.position.z;
    if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return 0;

    const desired = Math.atan2(-dx, -dz);
    let delta = angleDelta(this.warden.yaw, desired);
    const maxTurn = A.turnRate * dt;
    const applied = Math.max(-maxTurn, Math.min(maxTurn, delta));

    let pitchDelta = 0;
    if (aim) {
      // Aim error cone (Section 11 difficulty): the Warden does not track
      // perfectly, and the error is drawn from the seeded stream.
      const eyeDy = (target.y !== undefined ? target.y : this.warden.eyeY) - this.warden.eyeY;
      const desiredPitch = Math.atan2(eyeDy, Math.hypot(dx, dz)) + this._aimOffset;
      pitchDelta = Math.max(-maxTurn, Math.min(maxTurn, desiredPitch - this.warden.pitch));
    }
    this.warden.look(applied, pitchDelta);
    return delta - applied;
  }

  /** Sweep left and right on the spot (PATROL pause, INVESTIGATE, SEARCH). */
  _scan(dt) {
    this._scanPhase += A.patrolScanSpeed * dt;
    const half = (A.patrolScanDegrees * Math.PI) / 360;
    // Rate of change of half*sin(phase), so the sweep is a turn, not a snap.
    this.warden.look(half * Math.cos(this._scanPhase) * A.patrolScanSpeed * dt, 0);
  }

  _nearestWaypoints(position, count) {
    return this.map.waypoints
      .slice()
      .sort((a, b) => a.position.distanceToSquared(position) - b.position.distanceToSquared(position))
      .slice(0, count);
  }

  _distanceTo(point) {
    return Math.hypot(point.x - this.warden.position.x, point.z - this.warden.position.z);
  }

  _positionOf(actor) {
    return actor ? { x: actor.position.x, y: actor.feetY, z: actor.position.z } : null;
  }

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
}

export function createWardenAI(options) {
  return new WardenAI(options);
}
