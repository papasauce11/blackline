/**
 * BLACKLINE — systems/objective.js
 *
 * Plant, defuse, lives and reinsert, time extensions, win conditions and the
 * match score (Section 10).
 *
 * Layering (Section 3.1): imports config only. Everything else is handed in.
 *
 * Section 10.5 and the risk register both require that nothing carries between
 * rounds except the score, so every mutable field lives inside the object
 * `createRoundState()` returns and `resetRound()` replaces it wholesale. There
 * is no field to forget to clear, because clearing is not how it works.
 *
 * The plant rule - where a charge may be left at all - is `plantrule.js`
 * (F3), re-exported here; so are the round's vocabulary and its state
 * factory, `roundstate.js` (C4).
 */

import { CONFIG, SETTINGS } from '../config.js';
import { withinDefuseReach, canDefuseAt, hasHeadroomAt, canPlantAt } from './plantrule.js';
import { CHARGE, ROUND, OUTCOME, createRoundState } from './roundstate.js';

export { DEFUSE_REACH, DEFUSE_LINE, PLANT_HEADROOM, withinDefuseReach } from './plantrule.js';
export { CHARGE, ROUND, OUTCOME, createRoundState } from './roundstate.js';

const R = CONFIG.round;
const N = CONFIG.noise;

/** Reused so the per-frame defuse test allocates nothing. */
const FOOT = { x: 0, y: 0, z: 0 };
/** Reused so the per-step plant gate allocates nothing. */
const SPOT = { x: 0, y: 0, z: 0 };

export class Objective {
  /**
   * @param {object} options
   * @param {import('../mapkit.js').GameMap} options.map
   * @param {object} options.emitter
   * @param {import('./detection.js').Detection} options.detection
   * @param {import('./ai.js').WardenAI} options.ai
   * @param {import('./gadgets.js').Gadgets} options.gadgets
   * @param {(shade:object, spawn:object)=>void} [options.respawnShade]
   *   Section 15's respawnShade. This system owns *where* the Shade comes back
   *   (Section 10.2's spawn scoring) but not *what else* has to be undone —
   *   the ragdoll, the death camera, the input. Splitting the restore across
   *   two files is how three of the four get done, so it is injected whole.
   */
  constructor({ map, emitter, detection, ai, gadgets, respawnShade }) {
    this.map = map;
    this.emitter = emitter;
    this.detection = detection;
    this.ai = ai;
    this.gadgets = gadgets;
    this.respawnShade = respawnShade || ((shade, spawn) => shade.reset(spawn));

    this.score = { shade: 0, warden: 0 };
    this.rounds = [];
    this.round = createRoundState(1);
    this.matchOver = false;
    this._unsubscribe = [];
    this._subscribe();
  }

  _subscribe() {
    if (!this.emitter) return;
    const on = (event, handler) => this._unsubscribe.push(this.emitter.on(event, handler));
    on('combat:death', (event) => {
      if (event.target === 'shade') {
        // Where the body fell, if the event carried it. A caller that marked
        // the spot itself (the Section 17.1 kill command) sends no position and
        // keeps the one it set.
        if (event.at) this.markDeathPosition(event.at);
        this._onShadeDeath();
      }
      if (event.target === 'warden') this._onWardenDown(event);
    });
  }

  dispose() {
    for (const off of this._unsubscribe) off();
    this._unsubscribe.length = 0;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  resetMatch() {
    this.score.shade = 0;
    this.score.warden = 0;
    this.rounds.length = 0;
    this.matchOver = false;
    this.round = createRoundState(1);
  }

  /** Section 10.5: rebuild everything except the score. */
  resetRound(number) {
    this.round = createRoundState(number !== undefined ? number : this.round.number + 1);
    if (this.gadgets) this.gadgets.reset();
  }

  /**
   * Wins needed to take the match. Reads the LIVE setting (Section 13's match
   * length control), not the CONFIG default — see the note on CONFIG.settings.
   */
  get target() {
    return CONFIG.match.lengths[SETTINGS.matchLength] || CONFIG.match.lengths[CONFIG.match.defaultLength];
  }

  // -------------------------------------------------------------------------
  // Fixed step
  // -------------------------------------------------------------------------

  step(dt, { shade, warden, intent }) {
    const round = this.round;
    if (round.state !== ROUND.ACTIVE) {
      this._stepEnded(dt);
      return;
    }

    round.elapsed += dt;

    if (round.awaitingReinsert) {
      this._stepReinsert(dt, shade, warden);
    } else if (shade && shade.health > 0) {
      this._stepPlant(dt, shade, intent);
    }

    if (round.charge === CHARGE.PLANTED) {
      this._stepDetonation(dt, warden, shade);
    } else {
      // Section 10.4: the base clock only matters before a plant. After one,
      // the detonation clock is the effective timer.
      round.timeRemaining -= dt;
      if (round.timeRemaining <= 0) this._end('warden', 'time expired with no plant', OUTCOME.TIME);
    }
  }

  // -------------------------------------------------------------------------
  // Plant (Section 10.1)
  // -------------------------------------------------------------------------

  _stepPlant(dt, shade, intent) {
    const round = this.round;
    // Recomputed from scratch every step, so releasing interact or stepping
    // off the crate clears the line without anything having to remember to.
    round.plantRefused = false;
    if (round.charge !== CHARGE.CARRIED) return;

    const site = this.siteNear(shade.position);
    if (!site || !intent || !intent.interact) {
      // Section 10.2: partial plant progress is lost, not banked.
      round.plantProgress = 0;
      round.plantNoiseTimer = 0;
      return;
    }

    // A plant is legal exactly where a Warden could stand and defuse it (D5)
    // and it is not inside anything (D20) - `canPlantAt()`. The room says
    // which volume the objective is about; this says which parts of it the
    // Warden can answer for, and it is asked EVERY step of the hold
    // rather than once at the commit. Four seconds of progress and then a
    // refusal is the worst of both answers - it reads as "nearly" while it
    // means "never" - and progress that never starts is the difference a
    // player can act on.
    //
    // The spot tested is the one the commit would record: the Shade's feet,
    // not the site centre and not the body's middle.
    SPOT.x = shade.position.x;
    SPOT.y = shade.feetY;
    SPOT.z = shade.position.z;
    if (!this.canPlantAt(SPOT)) {
      // D6: the refusal is a HUD line and nothing else. This is the line.
      round.plantRefused = true;
      round.plantProgress = 0;
      // D6: no noise event and no sound. Returning above the noise interval is
      // what enforces it - a refused plant must not give the Shade away.
      round.plantNoiseTimer = 0;
      return;
    }

    round.plantProgress += dt;
    round.plantNoiseTimer -= dt;
    if (round.plantNoiseTimer <= 0) {
      round.plantNoiseTimer = R.plantInterval !== undefined ? R.plantInterval : N.plantInterval;
      this.detection.noise.emit(
        shade.position.x, shade.feetY, shade.position.z, N.radii.plant, 'plant', 'shade'
      );
    }

    if (round.plantProgress < R.plantHoldTime) return;
    round.charge = CHARGE.PLANTED;
    round.site = site.id;
    round.chargeAt = { x: shade.position.x, y: shade.feetY, z: shade.position.z };
    round.plantProgress = 0;
    round.detonationTimer = R.detonationTime;

    // Section 10.3: first plant extends the round by 45s, once.
    if (!round.milestones.plant) {
      round.milestones.plant = true;
      round.timeRemaining += R.plantExtension;
    }
    // The Warden stops patrolling and goes to the charge (Section 11 DEFEND).
    if (this.ai) this.ai.setDefendTarget(round.chargeAt);
    this._log(`charge armed at ${site.id}`);
    this.emitter.emit('objective:planted', { site: site.id, at: round.chargeAt });
  }

  /**
   * The site whose room this actor is standing in, or null.
   *
   * The plant is allowed anywhere in the room (Section 10.1, amended). It used
   * to need the body inside 2m of the site centre, which made the ring a
   * target rather than a label: three circles on the whole map, and a Warden
   * who only ever had to watch three square metres of floor. A room is the
   * unit the objective is actually about.
   *
   * The vertical bound does the work the old `dy < 2.5` did, and does it from
   * the room's own floor and ceiling: site C is on the upper deck directly
   * above the Loading Bay, and standing under a floor is not standing in the
   * room above it.
   *
   * @param {{x:number,y:number,z:number}} position actor centre
   * @param {number} [standHeight] body height, to get from centre to feet
   */
  siteNear(position, standHeight = CONFIG.shade.standHeight) {
    const feet = position.y - standHeight / 2;
    for (const site of this.map.sites) {
      const room = site.room;
      if (!room) continue;
      if (position.x < room.min.x || position.x > room.max.x) continue;
      if (position.z < room.min.z || position.z > room.max.z) continue;
      if (feet < room.floorY - 0.5 || feet >= room.ceilingY - 0.5) continue;
      return site;
    }
    return null;
  }

  /**
   * Could a Warden ever defuse a charge left here? The rule is
   * systems/plantrule.js; these are its three predicates asked of this map.
   * @param {{x:number,y:number,z:number}} at a foot position for the charge
   */
  canDefuseAt(at) {
    return canDefuseAt(this.map, at);
  }

  /** Is there a standing body's worth of open air above this spot? (D20) */
  hasHeadroomAt(at) {
    return hasHeadroomAt(this.map, at);
  }

  /** Could a charge be left here at all? The whole plant rule (D5 and D20). */
  canPlantAt(at) {
    return canPlantAt(this.map, at);
  }


  // -------------------------------------------------------------------------
  // Detonation and defuse (Section 10.1)
  // -------------------------------------------------------------------------

  _stepDetonation(dt, warden, shade) {
    const round = this.round;
    round.detonationTimer -= dt;
    if (round.detonationTimer <= 0) {
      round.charge = CHARGE.DETONATED;
      this._end('shade', 'charge detonated', OUTCOME.DETONATED);
      return;
    }

    // Everything below is about where the charge IS, not where the site is.
    // Those were the same point while a plant had to happen in the circle.
    const at = round.chargeAt;

    // Section 14: "a single 1200Hz blip, interval shortening as the detonation
    // timer runs down". The interval is the clock made audible, so it belongs
    // with the clock; audio only sounds it.
    round.beepTimer -= dt;
    if (round.beepTimer <= 0 && at) {
      const remaining = round.detonationTimer / R.detonationTime;
      const beep = CONFIG.audio.plantBeep;
      round.beepTimer = beep.intervalEnd + (beep.intervalStart - beep.intervalEnd) * remaining;
      this.emitter.emit('objective:beep', { at, remaining });
    }
    if (!at || !warden || warden.health <= 0) {
      this._decayDefuse(dt);
      return;
    }

    // The defuse still happens at the charge, within arm's length of it. That
    // radius was never a marking - it is how close you have to be to kneel
    // down and pull the thing apart - so it stays exactly as it was. It is
    // measured by `withinDefuseReach()` now rather than here, so that
    // `canDefuseAt()` below can ask the identical question of the map - and
    // since B5d it is a clear line through this world as well (D27).
    FOOT.x = warden.position.x;
    FOOT.y = warden.position.y - CONFIG.warden.standHeight / 2;
    FOOT.z = warden.position.z;
    const atSite = withinDefuseReach(FOOT, at, this.map.collision);

    // Section 11 DEFEND: defuse if the Shade is not visible. A Warden that can
    // see you should be shooting, not kneeling.
    const canDefuse = atSite && !(this.ai && this.ai.sees);
    if (!canDefuse) {
      this._decayDefuse(dt);
      return;
    }

    round.defuseProgress += dt;
    round.defuseRetain = R.defuseRetainTime;
    if (round.defuseProgress >= R.defuseHoldTime) {
      round.charge = CHARGE.DEFUSED;
      this._end('warden', 'charge defused', OUTCOME.DEFUSED);
    }
  }

  /**
   * Section 10.1: defuse progress is retained for 5s, then decays. Retained,
   * not banked forever — interrupting a defuse has to be worth doing.
   */
  _decayDefuse(dt) {
    const round = this.round;
    if (round.defuseProgress <= 0) return;
    if (round.defuseRetain > 0) {
      round.defuseRetain -= dt;
      return;
    }
    round.defuseProgress = Math.max(0, round.defuseProgress - R.defuseDecayRate * dt);
  }

  // -------------------------------------------------------------------------
  // Lives and reinsert (Section 10.2)
  // -------------------------------------------------------------------------

  _onShadeDeath() {
    const round = this.round;
    if (round.state !== ROUND.ACTIVE || round.awaitingReinsert) return;

    round.lives--;
    round.plantProgress = 0;
    round.plantRefused = false;
    this._log(`life lost - ${round.lives} left`);
    this.emitter.emit('objective:life-lost', { remaining: round.lives });

    // Section 10.4: losing the third life ends the round UNLESS the charge is
    // already planted, in which case the detonation clock carries on alone.
    if (round.lives <= 0 && round.charge !== CHARGE.PLANTED) {
      this._end('warden', 'shade lost all lives before planting', OUTCOME.ELIMINATED);
      return;
    }
    if (round.lives <= 0) return;

    round.awaitingReinsert = true;
    round.reinsertTimer = CONFIG.reinsert.delay;
  }

  _onWardenDown(event) {
    const round = this.round;
    round.takedowns++;
    this._log(event && event.kind === 'takedown' ? 'warden taken down' : 'warden down');
    // Section 10.3: first takedown extends the round by 30s, once.
    if (event && event.kind === 'takedown' && !round.milestones.takedown) {
      round.milestones.takedown = true;
      round.timeRemaining += R.takedownExtension;
    }
  }

  _stepReinsert(dt, shade, warden) {
    const round = this.round;
    round.reinsertTimer -= dt;
    if (round.reinsertTimer > 0) return;

    // Section 10.2: furthest from the Warden's CURRENT position, and never the
    // spawn just used.
    const reference = warden ? warden.position : { x: 0, y: 0, z: 0 };
    let bestIndex = -1;
    let bestDistance = -1;
    for (let i = 0; i < this.map.shadeSpawns.length; i++) {
      if (i === round.lastSpawnIndex) continue;
      const distance = this.map.shadeSpawns[i].position.distanceTo(reference);
      if (distance > bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    if (bestIndex === -1) bestIndex = 0;

    round.lastSpawnIndex = bestIndex;
    round.awaitingReinsert = false;
    this.respawnShade(shade, this.map.shadeSpawns[bestIndex]);
    // Gadgets are deliberately NOT refilled (Section 10.2), and the taser
    // recharge kept running through the whole thing.
    this.detection.reset(shade);

    // Section 10.2: the Warden's knowledge resets to the DEATH location, not
    // the reinsert point. It should be searching where it killed you.
    if (this.ai) {
      this.ai.accumulator = 0;
      this.ai.lastKnown = round.deathPosition || this.ai.lastKnown;
      this.ai._enterSearch();
    }
    this._log('reinserted');
    this.emitter.emit('objective:reinsert', { spawn: bestIndex, lives: round.lives });
  }

  /**
   * Reinsert right now, whatever the countdown says.
   *
   * The escape hatch for the death camera's wall-clock guard (Section 15). The
   * countdown runs on the sim clock, which the time scale can stretch and a
   * stalled frame can stop; if that happens the player is dead, cameraless and
   * waiting on a timer that is not advancing. This is the way out.
   *
   * @returns {boolean} whether a reinsert was pending to be forced
   */
  forceReinsert(shade, warden) {
    if (!this.round.awaitingReinsert) return false;
    this.round.reinsertTimer = 0;
    this._stepReinsert(0, shade, warden);
    this.emitter.emit('objective:reinsert-forced', { lives: this.round.lives });
    return true;
  }

  /** Called by the composition root the moment the Shade dies, before reset. */
  markDeathPosition(position) {
    this.round.deathPosition = { x: position.x, y: position.y, z: position.z };
  }

  // -------------------------------------------------------------------------
  // Round and match end (Section 10.4, 10.5)
  // -------------------------------------------------------------------------

  /**
   * @param {'shade'|'warden'} winner
   * @param {string} reason the sentence the record keeps
   * @param {string} [outcome] one of OUTCOME; the word the end screen says
   */
  _end(winner, reason, outcome = null) {
    const round = this.round;
    if (round.state !== ROUND.ACTIVE) return;
    // Section 10.5: best of N, first to the target. Once someone has reached
    // it the match is decided, and a round ending afterwards must not move the
    // score past it — `matchOver` is only cleared by resetMatch(), so anything
    // that starts another round without resetting the match is playing an
    // exhibition. Found by driving a round end into an already-finished match:
    // the score went to 4 against a target of 3.
    if (this.matchOver) return;
    round.state = ROUND.ENDED;
    round.winner = winner;
    round.reason = reason;
    round.outcome = outcome;
    round.endTimer = R.roundEndDelay;
    this._log(reason);
    this.score[winner]++;

    this.rounds.push({
      number: round.number,
      winner,
      reason,
      outcome,
      duration: round.elapsed,
      takedowns: round.takedowns,
      site: round.site,
      livesLeft: round.lives,
      timeline: round.timeline.slice(),
    });

    if (this.score[winner] >= this.target) {
      this.matchOver = true;
      this.emitter.emit('match:over', { winner, score: { ...this.score } });
    }
    this.emitter.emit('objective:round-end', {
      winner, reason, outcome, number: round.number, score: { ...this.score },
    });
  }

  /** One line on the round's timeline, stamped with the round's own clock. */
  _log(text) {
    this.round.timeline.push({ t: this.round.elapsed, text });
  }

  /**
   * The round has ended and the intermission has not gone up: count
   * `roundEndDelay` down on the sim clock and raise it once. The card is
   * the wiring's; this is only when.
   */
  _stepEnded(dt) {
    const round = this.round;
    if (round.intermission) return;
    round.endTimer -= dt;
    if (round.endTimer > 0) return;
    round.intermission = true;
    this.emitter.emit('objective:intermission', {
      winner: round.winner, outcome: round.outcome, number: round.number, matchOver: this.matchOver,
    });
  }

  /** What the HUD needs, in one object so it never reaches into round state. */
  get hud() {
    const round = this.round;
    return {
      lives: round.lives,
      timeRemaining: round.charge === CHARGE.PLANTED ? round.detonationTimer : round.timeRemaining,
      planted: round.charge === CHARGE.PLANTED,
      charge: round.charge,
      site: round.site,
      plantProgress: round.plantProgress / R.plantHoldTime,
      plantRefused: round.plantRefused,
      defuseProgress: round.defuseProgress / R.defuseHoldTime,
      awaitingReinsert: round.awaitingReinsert,
      reinsertIn: round.reinsertTimer,
      score: this.score,
      roundNumber: round.number,
    };
  }
}

export function createObjective(options) {
  return new Objective(options);
}
