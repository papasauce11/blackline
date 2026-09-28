/**
 * BLACKLINE — systems/tutorial.js
 *
 * The first-run tutorial's chain (H6): eight moves, in the order a player
 * needs them, each completing on the act rather than on a key press.
 *
 * **On the act, not on the key.** A prompt that cleared when you pressed the
 * key would teach nothing and would lie: the key is bound, the move may still
 * not have happened. `slide into the vent` is the case that proves the point —
 * `KeyC` at a standstill is a crouch and not a slide, and a slide that stops
 * at the mouth never gets in. So every step here reads the *controller's own
 * state* after the step ran, which is the same thing the AUTO checks read and
 * the same thing the player can see.
 *
 * **It never drives the game.** This watches. It has no intent, writes nothing
 * on the Shade, and its only output is which prompt is up — so a tutorial that
 * broke could never make the game unplayable, and `initMatch` stays the one
 * entry point (Section 12).
 *
 * Layering (Section 3.1): a system - config, the emitter it is handed, and the
 * state names. It reads the Shade through a getter for the same reason
 * `wiring.js` does: the actors are rebuilt on every `initMatch`.
 */

import { CONFIG, SETTINGS } from '../config.js';
import { saveSettings } from '../settingsstore.js';
import { SHADE_STATE } from '../entities/agentstate.js';

const S = CONFIG.shade;
const TUT = CONFIG.tutorial;

/** Climb states: any of them means a climb is under way. */
const CLIMBING = new Set([SHADE_STATE.VAULT, SHADE_STATE.MANTLE, SHADE_STATE.PULLUP]);

/**
 * The chain. `text` is a function of the bindings so a rebind (H8) moves the
 * prompt, exactly as the briefing card's controls do; `done` is a predicate
 * over the watcher's own reading of this step.
 *
 * @type {{id: string, text: (k: (action: string) => string) => string, done: (r: object) => boolean}[]}
 */
export const TUTORIAL_STEPS = [
  {
    id: 'move',
    text: (k) => `${k('forward')} ${k('left')} ${k('back')} ${k('right')} to move, mouse to look`,
    done: (r) => r.walked >= TUT.walkDistance,
  },
  {
    id: 'sprint',
    text: (k) => `hold ${k('sprint')} to sprint`,
    done: (r) => r.grounded && r.speed >= S.sprintSpeed * TUT.sprintFraction,
  },
  {
    id: 'crouch',
    text: (k) => `${k('crouch')} to crouch — you are quieter and shorter`,
    done: (r) => r.grounded && r.crouching,
  },
  {
    id: 'slide',
    // The one that needs two things at once, and the reason the prompt says
    // both: a duct is 1.15m and a standing body is 1.85, so the only way in
    // is low and moving.
    text: (k) => `sprint, then ${k('crouch')} to slide — slide into a duct, they are too low to walk into`,
    done: (r) => r.inVent && r.sinceSlide <= TUT.slideGrace,
  },
  {
    id: 'jump',
    text: (k) => `${k('jump')} to jump`,
    done: (r) => r.leftGroundUpward,
  },
  {
    id: 'climb',
    // Not "a climb started": a climb you fall out of has taught you nothing.
    text: (k) => `${k('jump')} at a ledge to climb it — anything you could reasonably pull yourself onto, you can`,
    done: (r) => r.climbedBy >= TUT.climbRise,
  },
  {
    id: 'hang',
    text: (k) => `at a high ledge, tap ${k('jump')} to hang instead of going over — hold it to go over`,
    done: (r) => r.hanging,
  },
  {
    id: 'plant',
    text: (k) => `stand in a site room and hold ${k('interact')} to plant`,
    done: (r) => r.planted,
  },
];

/** Whether this browser has seen it. H7 is what makes this survive a reload. */
export function tutorialSeen() {
  return !!SETTINGS.tutorialSeen;
}

/**
 * Whether a map can carry the chain. The chain asks for a duct to slide into,
 * and a duct is only a duct if a standing body does not fit and a low moving
 * one does; a map with none cannot complete step 4, so it is not offered
 * there rather than offering a prompt that cannot be cleared.
 *
 * Derived from the map rather than named (D1's rule): the plant has two runs
 * at grade, and a third map gets the tutorial or not by its own geometry.
 *
 * @param {object} map
 * @returns {boolean}
 */
export function tutorialFits(map) {
  if (!map || !map.vents) return false;
  const ground = CONFIG.map.groundY;
  return map.vents.some((vent) => {
    const height = vent.max.y - vent.min.y;
    return height >= S.crouchHeight && height < S.standHeight && vent.min.y - ground < 0.35;
  });
}

/**
 * Watch the Shade and walk the chain.
 *
 * @param {object} deps
 * @param {object} deps.emitter
 * @param {() => object} deps.shade the live Shade, read per step
 * @param {() => object} deps.map the live map, for the vent volumes
 * @returns {object}
 */
export function createTutorial({ emitter, shade, map }) {
  /** Which step is up, or -1 when the tutorial is not running. */
  let index = -1;
  let done = false;
  /** What this step has seen so far. Reset at every step boundary. */
  let reading = null;
  let lastPosition = null;

  const fresh = () => ({
    walked: 0,
    speed: 0,
    grounded: false,
    crouching: false,
    inVent: false,
    sinceSlide: Infinity,
    leftGroundUpward: false,
    climbedBy: 0,
    hanging: false,
    planted: false,
  });

  /** Is the body's centre inside one of the map's declared duct runs? */
  const inAVent = (position) => {
    const vents = map() ? map().vents : [];
    for (const vent of vents) {
      if (position.x >= vent.min.x && position.x <= vent.max.x
        && position.y >= vent.min.y && position.y <= vent.max.y
        && position.z >= vent.min.z && position.z <= vent.max.z) return true;
    }
    return false;
  };

  const api = {
    /** The steps, so a check and the panel read one list. */
    steps: TUTORIAL_STEPS,
    /** Which step is up (0-based), or -1. */
    get index() { return index; },
    /** The step object, or null. */
    get step() { return index >= 0 && index < TUTORIAL_STEPS.length ? TUTORIAL_STEPS[index] : null; },
    get running() { return index >= 0 && !done; },
    get finished() { return done; },
    /** What the current step has read, for the F3 overlay and the check. */
    get reading() { return reading; },

    /** Begin at the first prompt. */
    start() {
      index = 0;
      done = false;
      reading = fresh();
      lastPosition = null;
      emitter.emit('tutorial:step', { id: api.step.id, index, of: TUTORIAL_STEPS.length });
      return api;
    },

    /**
     * Give up on it. The same ending as finishing, because what the flag
     * records is "this browser has been offered it", not "this player is
     * good at it".
     */
    skip() {
      if (index < 0 || done) return false;
      return api._end('skipped');
    },

    _end(why) {
      index = -1;
      done = true;
      reading = null;
      SETTINGS.tutorialSeen = true;
      // H7: "once per browser" is this line plus the store. A blocked store
      // makes it once per page load, which is the honest degradation.
      saveSettings();
      emitter.emit('tutorial:end', { why });
      return true;
    },

    /**
     * One simulation step's worth of watching. Called from `sim:step`, so it
     * runs after the actors have stepped and sees the state they ended in -
     * which is where a slide or a hang actually shows up.
     */
    observe() {
      if (!api.running) return;
      const body = shade();
      if (!body) return;
      const r = reading;
      const position = body.position;

      if (lastPosition) {
        const dx = position.x - lastPosition.x;
        const dz = position.z - lastPosition.z;
        if (body.grounded) r.walked += Math.sqrt(dx * dx + dz * dz);
      }
      lastPosition = { x: position.x, y: position.y, z: position.z };

      r.speed = body.speed;
      r.grounded = body.grounded;
      r.crouching = body.crouching;
      r.hanging = body.state === SHADE_STATE.HANG;
      r.inVent = inAVent(position);
      r.sinceSlide = body.state === SHADE_STATE.SLIDE ? 0 : r.sinceSlide + CONFIG.time.fixedDt;
      if (!body.grounded && body.velocity.y > 0 && body.state === SHADE_STATE.AIR) r.leftGroundUpward = true;

      // A climb counts when it has put the feet higher than where it began,
      // which is the difference between climbing something and touching it.
      if (CLIMBING.has(body.state) || body.state === SHADE_STATE.GRAB) {
        if (r._climbFrom === undefined) r._climbFrom = body.feetY;
      } else if (r._climbFrom !== undefined) {
        if (body.grounded) {
          r.climbedBy = Math.max(r.climbedBy, body.feetY - r._climbFrom);
          r._climbFrom = undefined;
        }
      }

      api._advance();
    },

    /** The plant is an event, not a state: the round system owns it. */
    _planted() {
      if (!api.running) return;
      reading.planted = true;
      api._advance();
    },

    _advance() {
      while (api.running && TUTORIAL_STEPS[index].done(reading)) {
        emitter.emit('tutorial:complete', { id: TUTORIAL_STEPS[index].id, index });
        index++;
        if (index >= TUTORIAL_STEPS.length) return void api._end('completed');
        reading = fresh();
        lastPosition = null;
        emitter.emit('tutorial:step', { id: api.step.id, index, of: TUTORIAL_STEPS.length });
      }
    },
  };

  emitter.on('sim:step', () => api.observe());
  emitter.on('objective:planted', () => api._planted());

  return api;
}
