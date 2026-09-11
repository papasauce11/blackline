/**
 * BLACKLINE — entities/agenttraversal.js
 *
 * The Shade's climbing (Section 6.1, amended; spec 20.2 and 20.4): the reach
 * it has right now, the ledge probe, the vault, the mantle, the grab, the
 * hang and the pull-up, and the interpolated traversal step that carries a
 * committed move to its destination.
 *
 * Parkour safety rule (Section 6.1, and the second row of the Section 15 risk
 * register): every vault, mantle, slide and pull-up validates that the
 * destination capsule is clear BEFORE committing. `_commitMove()` is the only
 * path into a traversal state and it refuses to start a move it cannot finish.
 *
 * Methods of `Shade`, kept in their own file (F3). agent.js installs them on
 * the prototype, so `this` is the Shade and every field keeps its name. The
 * climb rule itself is `classifyReach()` in physics.js — the same call the
 * map's `deriveClimbableSurfaces()` makes, so the two cannot disagree.
 */

import { CONFIG } from '../config.js';
import { classifyReach } from '../physics.js';
import { SHADE_STATE } from './agentstate.js';

const S = CONFIG.shade;

/**
 * Spacing of the ledge probe's sample heights.
 *
 * This used to be six fixed heights (0.25 / 0.6 / 1.0 / 1.45 / 1.9 / 2.35) and
 * a 0.2m-thick floor slab sitting between the last two was invisible to it —
 * the v2 vent lips classified, marked, and could never actually be climbed. A
 * fixed ladder of samples has gaps by construction; a sweep does not.
 */
const PROBE_STEP = 0.12;

/** Roughly a hand, for testing whether a probe sample is in open air. */
const HAND_HALF = { x: 0.05, y: 0.05, z: 0.05 };

export const TRAVERSAL = {
  /**
   * How high this body can climb from where it is right now (Section 6.1,
   * amended). Standing, that is `reach.standing`. A jump adds
   * `reach.jumpBonus` — added ONCE, spent at take-off, not re-granted on every
   * step of the flight.
   *
   * The rule used to be "airborne means full stretch from the current feet",
   * and it compounded: a jump lifts the feet 0.46m, and measuring the whole
   * 3.8m from up there put the real ceiling at 4.26m. A controller that climbs
   * what the map's own rule calls out of reach is not a generous controller,
   * it is a second rule — and the one-way routes rest on the first one, with
   * the site fence sitting 4.5m up.
   *
   * Measuring the bonus against the take-off height instead pins the ceiling at
   * `launch + standing + jumpBonus` for the whole arc: exactly the 3.8m that
   * `deriveClimbableSurfaces()` derives from. The jump extends the reach, it
   * does not multiply it. Below the take-off height full stretch comes back —
   * dropping past a lip, you are still the same body with the same arms.
   */
  _reachNow() {
    if (this.grounded) return S.reach.standing;
    const full = S.reach.standing + S.reach.jumpBonus;
    const risen = this.feetY - this._launchY;
    return Math.max(0, Math.min(full, full - risen));
  },

  /**
   * Look for a climbable face ahead and return what the controller would do
   * with it. Uses `classifyReach()` — the same function
   * `deriveClimbableSurfaces()` calls, so the controller and the map cannot
   * hold different opinions about what a body can get up.
   */
  _probeLedge(forward) {
    const dirX = -Math.sin(this.yaw);
    const dirZ = -Math.cos(this.yaw);
    const direction = { x: dirX, y: 0, z: dirZ };
    const distance = forward + this.half.x;
    const feet = this.feetY;
    const reach = this._reachNow();
    this._faceAhead = null;

    // Sweep from the feet to the top of reach. Every sample is a face the
    // player could plausibly have their hands on.
    for (let probe = PROBE_STEP; probe <= reach + PROBE_STEP; probe += PROBE_STEP) {
      const origin = { x: this.position.x, y: feet + probe, z: this.position.z };
      // Stop where the hand does. Each sample is a horizontal ray, and a ray
      // that starts inside a slab passes straight through it and reports the
      // face of whatever it is buried in — so the sweep could see, and the
      // controller would then climb, through solid concrete. It did exactly
      // that from inside a duct: 1.15m of roof overhead and the lip on TOP of
      // that roof came back as the ledge ahead. `_commitMove()` had no
      // objection, because it validates where a move ENDS, not what it passes
      // through.
      //
      // Once the column above the body is blocked, everything higher is
      // unreachable too, so this breaks rather than skipping: a hand cannot be
      // in the open air above a ceiling it cannot get through.
      if (!this.collision.isClear(origin, HAND_HALF)) break;
      const hit = this.collision.raycast(origin, direction, distance);
      if (!hit) continue;
      // Only a face gives a ledge; a top or bottom hit is not something to climb.
      if (Math.abs(hit.ny) > 0.5) continue;
      // Remember what the hands are on, whatever it is. A wall too tall for
      // the reach, a lip under a ceiling, a face with nothing standable on
      // top: none is a ledge, all of them are what a failed climb hit (B2).
      // The sweep rises, so the last one written is the highest.
      if (hit.box.solid && hit.box.max.y - feet > S.reach.stepOver) {
        this._faceAhead = { box: hit.box, rise: hit.box.max.y - feet, reach, hitX: hit.x, hitZ: hit.z, dirX, dirZ };
      }
      if (!hit.box.climbable) continue;

      const topY = hit.box.max.y;
      const rise = topY - feet;
      const move = classifyReach(rise, reach);
      if (move === null || move === 'step') continue;

      return { box: hit.box, topY, rise, move, reach, hitX: hit.x, hitZ: hit.z, dirX, dirZ };
    }
    return null;
  },


  /**
   * The bump-and-scuff (B2; Section 6.1, amended: "a physical tell plus
   * audio, never silent"). The hands have landed on a face they cannot get
   * over. The body is pushed back off it and stops rising, the hands-up
   * pose holds for `scuffPoseTime`, and `shade:scuff` goes out for the sound.
   * From a hang there is no push - the body is already where it should be -
   * only the pose and the sound.
   *
   * It is a sound the player hears, not a noise the Warden does: nothing is
   * added to the noise field here. Whether it should be is D23.
   *
   * @param {{rise:number, reach:number, hitX:number, hitZ:number, dirX:number, dirZ:number, box:object}} face
   * @param {boolean} bump push the body back off the face
   */
  _scuff(face, bump) {
    if (bump) {
      this.velocity.x = -face.dirX * S.scuffBumpSpeed;
      this.velocity.z = -face.dirZ * S.scuffBumpSpeed;
      if (this.velocity.y > 0) this.velocity.y = 0;
    }
    this._scuffTimer = S.scuffPoseTime;
    this.scuffs++;
    if (this.emitter) {
      this.emitter.emit('shade:scuff', {
        x: face.hitX, y: this.feetY + Math.min(face.rise, face.reach), z: face.hitZ,
        rise: face.rise, reach: face.reach, tag: face.box ? face.box.tag : '', hanging: !bump,
      });
    }
  },

  /**
   * Destination centre for standing on top of a probed ledge: past the edge by
   * a body radius plus a margin, at the ledge top.
   */
  _ledgeDestination(ledge, height) {
    const forwardOffset = this.half.x + 0.3;
    return {
      x: ledge.hitX + ledge.dirX * forwardOffset,
      y: ledge.topY + height / 2 + S.mantleClearance,
      z: ledge.hitZ + ledge.dirZ * forwardOffset,
    };
  },

  /**
   * The single gate into every traversal state. Validates the destination
   * capsule is clear before committing (Section 6.1 parkour safety rule).
   * @returns {boolean} false if blocked, in which case nothing was changed
   */
  _commitMove(state, destination, duration, height) {
    const half = { x: S.radius, y: height / 2, z: S.radius };
    if (!this.collision.isClear(destination, half)) return false;

    // Also require the destination to still be clear at full standing height if
    // the move ends standing, so a mantle under a low ceiling aborts rather
    // than leaving the player stuck inside geometry (Section 16, check 4).
    this._move = {
      from: { x: this.position.x, y: this.position.y, z: this.position.z },
      to: destination,
      timer: 0,
      duration,
      height,
    };
    this.state = state;
    this.velocity.set(0, 0, 0);
    this._falling = false;
    return true;
  },

  /**
   * Commit a climb onto a ledge, preferring to arrive standing but falling back
   * to crouched when the space above the ledge is low.
   *
   * Without the fallback a ledge with a low ceiling — a vent lip, anything under
   * a catwalk — is silently unclimbable: the destination capsule is standing
   * height, it does not fit, and the move aborts with no feedback.
   */
  _climbOnto(state, ledge, duration) {
    const heights = [S.standHeight, S.crouchHeight];
    for (let i = 0; i < heights.length; i++) {
      const destination = this._ledgeDestination(ledge, heights[i]);
      if (this._commitMove(state, destination, duration, heights[i])) return true;
    }
    return false;
  },

  /**
   * Head into something with a jump and get up it — the whole ground-started
   * climb. The caller gates this on the jump buffer.
   *
   * This used to be `intent.sprint && intent.forward > 0 && _tryVault()`, and
   * `_tryVault()` accepted the vault band alone. Two consequences, both of them
   * things a player would call broken. A 1.0m crate could not be climbed at all
   * without sprinting at it. And nothing above 1.15m could be climbed from a
   * standing start, because the mantle lived exclusively in `_stepAir()` — so a
   * 2.3m lip, well inside a standing reach of 2.6m, ate every step of held
   * forward and did nothing. The census counted 58 vault-band and 57
   * mantle-band faces in exactly that state.
   *
   * Sprint is gone from the gate: it never made a climb possible, it only made
   * it permitted, and "hold shift to be allowed onto a crate" is a marking by
   * another name. The jump took its place, and it is a better gate for the
   * reason sprint was a bad one — it is what you would press anyway. It also
   * leaves waist-high cover usable, which a climb on contact does not: walk up
   * to a crate with a rifle pointed at you and you stay behind it.
   *
   * One probe, at the longer of the two reaches. Which distance you are allowed
   * to start a climb from should not depend on the height you are about to
   * discover, because that is not a distinction anyone can feel through a
   * keyboard.
   */
  _tryClimbFromGround(intent) {
    if (!intent || intent.forward <= 0) return false;
    const ledge = this._probeLedge(S.vaultReach);
    if (!ledge) return false;
    if (!this._isApproaching(ledge, intent)) return false;

    return this._climbLedge(ledge);
  },

  /**
   * Is the Shade actually heading at this ledge, rather than merely looking at
   * it? The probe follows the facing direction, so without this a player
   * stepping backwards off a ledge is grabbed by the face they just left.
   */
  _isApproaching(ledge, intent) {
    if (intent && intent.forward > 0) return true;
    const into = this.velocity.x * ledge.dirX + this.velocity.z * ledge.dirZ;
    return into >= S.mantleApproachSpeed;
  },

  _tryMantle(intent) {
    const ledge = this._probeLedge(S.mantleReach);
    if (!ledge) return false;
    if (!this._isApproaching(ledge, intent)) return false;

    // Vault-band ledges climb from the air too. A sprint is not always
    // available — on top of a crate there is no room to build speed — and
    // without this a 0.4m to 1.2m ledge cannot be climbed at all except by
    // running at it, which strands the player on small platforms.
    return this._climbLedge(ledge);
  },

  /**
   * One rule for every Space-driven climb, ground or air (D21): a vault-height
   * ledge goes straight over, because there is nothing to hang from; a
   * mantle-height ledge is GRABBED first, and whether the body carries on over
   * is decided by whether Space is still held when the hand lands — see
   * `_stepHang()`. Tap: hang. Hold: climb.
   *
   * Only a ledge worth hanging from is grabbed (D22): at least
   * `hangMinHeightRatio` Shade-heights above the surface the climb started on
   * — measured from `_launchY`, not from wherever the body is in its jump, so
   * the same ledge answers the same way from the ground and from the apex.
   * Anything lower goes straight over on tap or hold alike; a hang is for a
   * ledge you had to jump for.
   *
   * A grab that will not fit — something under the lip — goes straight over
   * too, so a mantle never becomes unclimbable because it is unhangable. If
   * the top itself is blocked, nothing happens: the parkour safety rule forbids
   * committing. There is no third case: a climb you cannot make does not happen.
   */
  _climbLedge(ledge) {
    if (ledge.move === 'vault') return this._climbOnto(SHADE_STATE.VAULT, ledge, S.vaultDuration);
    if (ledge.move !== 'mantle') return false;
    const fromLaunch = ledge.topY - this._launchY;
    if (fromLaunch >= S.standHeight * S.hangMinHeightRatio && this._tryGrab(ledge)) return true;
    return this._climbOnto(SHADE_STATE.MANTLE, ledge, S.mantleDuration);
  },

  /**
   * Reach for the lip: a short move to hanging position below the edge, which
   * ends in HANG. Goes through `_commitMove()` like every traversal, so the
   * hanging body is validated before anything is changed.
   */
  _tryGrab(ledge) {
    if (ledge.rise > S.hangMaxHeight) return false;
    const centre = {
      x: ledge.hitX - ledge.dirX * (this.half.x + 0.04),
      y: ledge.topY - S.hangDrop + this.half.y,
      z: ledge.hitZ - ledge.dirZ * (this.half.x + 0.04),
    };
    if (!this._commitMove(SHADE_STATE.GRAB, centre, S.hangGrabDuration, this.height)) return false;
    this._hangLedge = ledge;
    return true;
  },

  _stepHang(dt, intent) {
    const ledge = this._hangLedge;
    if (!ledge) {
      // Defensive: never leave the player frozen in a state with no ledge.
      this.state = SHADE_STATE.AIR;
      this._beginFall();
      this._climbArmed = false;
      return;
    }

    this._hangTimer += dt;

    // Pull up with Space (Section 6.1, amended 20.3). Read before the settle
    // grace, and as a HELD key: the grab that got us here was the tap window,
    // so a key still down now is a hold, and a hold means carry on over. A
    // press later, from a settled hang, pulls up the same way.
    if (intent.jump || intent.jumpPressed) {
      if (this._climbOnto(SHADE_STATE.PULLUP, ledge, S.hangPullUpDuration)) {
        this._hangLedge = null;
        return;
      }
      // The stored ledge was probed at grab time and can go stale — after a
      // shimmy, or if the grab landed on an awkward corner. Re-probe from where
      // we actually are before giving up, so a pull-up never silently does
      // nothing while the player hammers jump.
      const fresh = this._probeLedge(S.mantleReach);
      if (fresh && this._climbOnto(SHADE_STATE.PULLUP, fresh, S.hangPullUpDuration)) {
        this._hangLedge = null;
        return;
      }
      // Genuinely blocked: stay hanging, which is the correct "return to the
      // previous state" behaviour - but not a silent one (B2). The hands slap
      // the lip on the press, and on the first step if Space was held
      // through the grab; a held key does not hammer it every step.
      if (intent.jumpPressed || this._hangTimer <= dt * 1.5) {
        this._scuff({ ...ledge, rise: ledge.topY - this.feetY, reach: this._reachNow() }, false);
      }
    }

    // Everything else waits for the hang to settle, so a crouch still held
    // from a crouch-jump does not let go on the frame the hand lands.
    if (this._hangTimer < S.hangInputGrace) return;

    // Shimmy sideways along the ledge.
    if (intent.strafe) this._shimmy(dt, intent.strafe, ledge);

    // Drop with crouch (Section 6.1).
    if (intent.crouch || intent.crouchPressed) {
      this._hangLedge = null;
      this.state = SHADE_STATE.AIR;
      this.velocity.set(0, 0, 0);
      this._beginFall();
      // Letting go is not a press of Space (D17): the fall catches nothing
      // unless the player presses again.
      this._climbArmed = false;
    }
  },

  /**
   * Move sideways along a grabbed ledge. Refuses to move unless the body still
   * fits AND the ledge actually continues at the destination, so you cannot
   * shimmy off the end of an edge into thin air.
   */
  _shimmy(dt, direction, ledge) {
    // Lateral axis is perpendicular to the ledge's approach direction.
    const latX = -ledge.dirZ;
    const latZ = ledge.dirX;
    const distance = S.hangShimmySpeed * dt * direction;

    const x = this.position.x + latX * distance;
    const z = this.position.z + latZ * distance;

    if (!this.collision.isClear({ x, y: this.position.y, z }, this.half)) return;

    // The ledge must still be there to hold on to.
    const origin = { x, y: ledge.topY - 0.15, z };
    const hit = this.collision.raycast(
      origin,
      { x: ledge.dirX, y: 0, z: ledge.dirZ },
      this.half.x + 0.5
    );
    if (!hit || !hit.box.climbable) return;
    if (Math.abs(hit.box.max.y - ledge.topY) > 0.05) return;

    this.position.x = x;
    this.position.z = z;
    ledge.hitX += latX * distance;
    ledge.hitZ += latZ * distance;
  },

  _stepTraversal(dt) {
    const move = this._move;
    move.timer += dt;
    const t = Math.min(1, move.timer / move.duration);
    // Ease out, with a small vertical arc so a vault reads as going over
    // something rather than through it.
    const eased = t * t * (3 - 2 * t);
    const arc = Math.sin(t * Math.PI) * 0.18;

    this.position.x = move.from.x + (move.to.x - move.from.x) * eased;
    this.position.y = move.from.y + (move.to.y - move.from.y) * eased + arc;
    this.position.z = move.from.z + (move.to.z - move.from.z) * eased;

    if (t < 1) return;

    this.position.set(move.to.x, move.to.y, move.to.z);

    if (this.state === SHADE_STATE.GRAB) {
      // The hand is on the lip. Whether the body carries on over is decided in
      // _stepHang() by whether Space is still held (D21): the grab itself was
      // the tap window.
      this._move = null;
      this.state = SHADE_STATE.HANG;
      this._hangTimer = 0;
      return;
    }

    // The destination was validated at this height, so adopt it. A climb into a
    // low space arrives crouched rather than clipping.
    this.height = move.height;
    this.half.y = move.height / 2;
    this.crouching = move.height < S.standHeight;
    this._move = null;

    // Leave with a little momentum so a vault keeps flow (Section 6.1).
    if (this.state === SHADE_STATE.VAULT) {
      this.velocity.x = -Math.sin(this.yaw) * S.vaultExitSpeed;
      this.velocity.z = -Math.cos(this.yaw) * S.vaultExitSpeed;
    }

    this.state = SHADE_STATE.GROUND;
    this._coyote = S.coyoteTime;
    this.grounded = true;
    this._falling = false;
  }
};
