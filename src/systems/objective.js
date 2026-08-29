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
 */

import { CONFIG, SETTINGS } from '../config.js';

const R = CONFIG.round;
const N = CONFIG.noise;

export const CHARGE = {
  CARRIED: 'carried',
  PLANTED: 'planted',
  DEFUSED: 'defused',
  DETONATED: 'detonated',
};

export const ROUND = {
  ACTIVE: 'active',
  ENDED: 'ended',
};

/**
 * Every mutable thing a round owns. A defaults factory, not a reset method:
 * a new object cannot inherit a field somebody forgot to clear.
 */
export function createRoundState(number) {
  return {
    number,
    state: ROUND.ACTIVE,
    timeRemaining: R.duration,
    elapsed: 0,
    charge: CHARGE.CARRIED,
    site: null,
    plantProgress: 0,
    plantNoiseTimer: 0,
    defuseProgress: 0,
    defuseRetain: 0,
    detonationTimer: 0,
    /** Section 14's plant beep. Shortens as the detonation clock runs down. */
    beepTimer: 0,
    lives: CONFIG.shade.lives,
    reinsertTimer: 0,
    awaitingReinsert: false,
    deathPosition: null,
    lastSpawnIndex: 0,
    takedowns: 0,
    // Section 10.3: each milestone fires at most once per round.
    milestones: { plant: false, takedown: false },
    winner: null,
    reason: null,
  };
}

export class Objective {
  /**
   * @param {object} options
   * @param {import('../map.js').GameMap} options.map
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
    if (round.state !== ROUND.ACTIVE) return;

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
      if (round.timeRemaining <= 0) this._end('warden', 'time expired with no plant');
    }
  }

  // -------------------------------------------------------------------------
  // Plant (Section 10.1)
  // -------------------------------------------------------------------------

  _stepPlant(dt, shade, intent) {
    const round = this.round;
    if (round.charge !== CHARGE.CARRIED) return;

    const site = this.siteNear(shade.position);
    if (!site || !intent || !intent.interact) {
      // Section 10.2: partial plant progress is lost, not banked.
      round.plantProgress = 0;
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
    round.plantProgress = 0;
    round.detonationTimer = R.detonationTime;

    // Section 10.3: first plant extends the round by 45s, once.
    if (!round.milestones.plant) {
      round.milestones.plant = true;
      round.timeRemaining += R.plantExtension;
    }
    // The Warden stops patrolling and goes to the charge (Section 11 DEFEND).
    if (this.ai) this.ai.setDefendTarget(site.position);
    this.emitter.emit('objective:planted', { site: site.id, at: site.position });
  }

  /** The site the actor is standing in, or null. */
  siteNear(position) {
    for (const site of this.map.sites) {
      const dx = site.position.x - position.x;
      const dz = site.position.z - position.z;
      // Vertical check too: site C is on the upper deck, directly above the
      // Loading Bay. Without it you could plant C from the floor below.
      const dy = Math.abs(site.position.y - (position.y - CONFIG.shade.standHeight / 2));
      if (dx * dx + dz * dz <= R.siteRadius * R.siteRadius && dy < 2.5) return site;
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Detonation and defuse (Section 10.1)
  // -------------------------------------------------------------------------

  _stepDetonation(dt, warden, shade) {
    const round = this.round;
    round.detonationTimer -= dt;
    if (round.detonationTimer <= 0) {
      this._end('shade', 'charge detonated');
      round.charge = CHARGE.DETONATED;
      return;
    }

    const site = this.map.sites.find((entry) => entry.id === round.site);

    // Section 14: "a single 1200Hz blip, interval shortening as the detonation
    // timer runs down". The interval is the clock made audible, so it belongs
    // with the clock; audio only sounds it.
    round.beepTimer -= dt;
    if (round.beepTimer <= 0 && site) {
      const remaining = round.detonationTimer / R.detonationTime;
      const beep = CONFIG.audio.plantBeep;
      round.beepTimer = beep.intervalEnd + (beep.intervalStart - beep.intervalEnd) * remaining;
      this.emitter.emit('objective:beep', { at: site.position, remaining });
    }
    if (!site || !warden || warden.health <= 0) {
      this._decayDefuse(dt);
      return;
    }

    const dx = site.position.x - warden.position.x;
    const dz = site.position.z - warden.position.z;
    const dy = Math.abs(site.position.y - (warden.position.y - CONFIG.warden.standHeight / 2));
    const atSite = dx * dx + dz * dz <= R.siteRadius * R.siteRadius && dy < 2.5;

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
      this._end('warden', 'charge defused');
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
    this.emitter.emit('objective:life-lost', { remaining: round.lives });

    // Section 10.4: losing the third life ends the round UNLESS the charge is
    // already planted, in which case the detonation clock carries on alone.
    if (round.lives <= 0 && round.charge !== CHARGE.PLANTED) {
      this._end('warden', 'shade lost all lives before planting');
      return;
    }
    if (round.lives <= 0) return;

    round.awaitingReinsert = true;
    round.reinsertTimer = CONFIG.reinsert.delay;
  }

  _onWardenDown(event) {
    const round = this.round;
    round.takedowns++;
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

  _end(winner, reason) {
    const round = this.round;
    if (round.state !== ROUND.ACTIVE) return;
    round.state = ROUND.ENDED;
    round.winner = winner;
    round.reason = reason;
    this.score[winner]++;

    this.rounds.push({
      number: round.number,
      winner,
      reason,
      duration: round.elapsed,
      takedowns: round.takedowns,
      site: round.site,
      livesLeft: round.lives,
    });

    if (this.score[winner] >= this.target) {
      this.matchOver = true;
      this.emitter.emit('match:over', { winner, score: { ...this.score } });
    }
    this.emitter.emit('objective:round-end', {
      winner, reason, number: round.number, score: { ...this.score },
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
