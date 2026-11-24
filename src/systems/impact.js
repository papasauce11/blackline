/**
 * BLACKLINE - systems/impact.js
 *
 * Impact (J2, D89 - "subtle"): the picture holding for a beat on a knife or a
 * finisher, and the camera shivering on a grenade a few metres off. Presentation
 * only, and it listens on the Emitter and calls into no system.
 *
 * **The hit-stop banks the time. It never drops it.** This game rests on a fixed
 * step and a seeded rng, so a stop that ate simulation time would make the
 * picture lie about the world and make the same seed play out differently with
 * the setting on. While the stop runs the planner is handed nothing and the wall
 * time withheld is added to a debt; when the stop ends the debt is handed back
 * on the frames after, never more than `CONFIG.time.maxFrameDelta` to one frame
 * (the planner clamps there, and a clamp inside the planner would drop what
 * this was repaying). The fixed steps run across the whole window are exactly
 * the steps that would have run without it - the check counts them.
 *
 * **A frame handed no time ticks nothing.** `main.js` feeds `step()` zero while
 * the game is paused or the briefing is up, and `step()` cannot tell that from
 * a stalled frame, so it does not try: a zero delta freezes the stop where it
 * was, banks nothing and repays nothing. Resuming carries on from there, which
 * is why a pause in the middle of a stop cannot replay it and cannot leak the
 * debt into the menu (`setPaused` drains the accumulator for the same reason).
 *
 * **The shake is a function of elapsed wall time and three phases drawn once**
 * from the presentation stream (H27), never from the simulation's: a shaken
 * camera must not decide what the Warden does next. When it is over the offset
 * is written as exactly zero rather than left to decay toward it, because a
 * residue on a camera that is only reset on a handover survives a round.
 */

import * as THREE from 'three';
import { CONFIG, SETTINGS } from '../config.js';

const I = CONFIG.impact;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/** Below this a stop or a shake is over; a float residue must not cost a frame. */
const EPS = 1e-9;

/**
 * The stream is the LOOK one, and is named for it. `main.js` has always passed
 * `lookRng` here - a shake's phase is a mark on the picture and nothing reads
 * it back, which is the argument H27 makes for a footprint's yaw - but the
 * parameter was called `rng`, so `the-simulations-stream-is-drawn-from-only-by-a-decision`
 * read the text and reported a simulation draw this module does not make.
 *
 * @param {{emitter: import('../emitter.js').Emitter, camera: import('three').Camera, lookRng: {next: () => number}}} options
 */
export function createImpact({ emitter, camera, lookRng }) {
  let stopLeft = 0;
  let debt = 0;

  let strength = 0;
  let age = 0;
  const phase = [0, 0, 0];
  /** Whether a nonzero offset is on the camera, so clearing it is one write and never a fight. */
  let dirty = false;
  const eye = new THREE.Vector3();

  /** @returns {{x: number, y: number, roll: number} | null} this frame's offset, or null when there is none */
  function offset() {
    if (strength <= 0 || age >= I.shakeSeconds) return null;
    const env = strength * (1 - age / I.shakeSeconds);
    const wave = (i) => Math.sin(TAU * I.shakeHz * age + phase[i]) * env;
    return { x: wave(0) * I.shakeMetres, y: wave(1) * I.shakeMetres, roll: wave(2) * I.shakeRollDegrees * DEG };
  }

  const self = {
    /** The stop is running. */
    get active() { return stopLeft > EPS; },
    /** Wall seconds withheld and not yet handed back. */
    get debt() { return debt; },

    /**
     * Begin a stop. A second one while the first runs extends it to the longer
     * of the two rather than adding, so a knife hit and the finisher it
     * commits (one step, two events) are one beat and not two.
     */
    hitStop(seconds) {
      if (!SETTINGS.hitStop || !(seconds > 0)) return;
      stopLeft = Math.max(stopLeft, seconds);
    },

    /** Begin a shake of `strength` in [0, 1]; a stronger one already running is not weakened. */
    shake(amount) {
      if (!SETTINGS.screenShake || !(amount > 0)) return;
      const next = Math.min(amount, 1);
      if (next < strength * (1 - age / I.shakeSeconds)) return;
      strength = next;
      age = 0;
      for (let i = 0; i < 3; i++) {
        // Named rather than inlined so the draw census can read what the draw
        // feeds, as every other declared draw in the tree is written.
        const angle = lookRng.next() * TAU;
        phase[i] = angle;
      }
    },

    /**
     * The wall delta the planner should be fed this frame: nothing while the
     * stop runs, the frame's own plus what is repaid after it, and the frame's
     * own when idle.
     */
    step(wallDelta) {
      if (!(wallDelta > 0)) return 0;
      age += wallDelta;
      let feed = wallDelta;
      if (stopLeft > EPS) {
        const held = Math.min(stopLeft, wallDelta);
        stopLeft -= held;
        debt += held;
        feed -= held;
      }
      if (stopLeft <= EPS && debt > 0) {
        stopLeft = 0;
        const repaid = Math.min(debt, Math.max(0, CONFIG.time.maxFrameDelta - feed));
        debt -= repaid;
        feed += repaid;
      }
      return feed;
    },

    /** Write this frame's shake onto the camera's local transform. */
    apply(target) {
      const o = offset();
      if (!o) {
        if (dirty) this.clear(target);
        return;
      }
      target.position.set(o.x, o.y, 0);
      target.rotation.z = o.roll;
      dirty = true;
    },

    /**
     * Write exactly zero, and end the shake: whoever has the camera now owns
     * its transform, and a shake that resumed behind them would be a residue.
     * Writes only if this module put something there - a cinematic's own
     * orbit position is not ours to zero.
     */
    clear(target) {
      strength = 0;
      if (!dirty) return;
      target.position.set(0, 0, 0);
      target.rotation.z = 0;
      dirty = false;
    },

    /** Forget everything: a new match must not start inside the last one's beat. */
    reset() {
      stopLeft = 0;
      debt = 0;
      strength = 0;
      age = 0;
    },
  };

  emitter.on('combat:knife-hit', () => self.hitStop(I.hitStopSeconds));
  emitter.on('combat:takedown', () => self.hitStop(I.hitStopSeconds));
  emitter.on('gadget:detonate', (event) => {
    if (event.type !== 'frag') return;
    camera.getWorldPosition(eye);
    const d = Math.hypot(event.at.x - eye.x, event.at.y - eye.y, event.at.z - eye.z);
    const t = (I.shakeFarMetres - d) / (I.shakeFarMetres - I.shakeNearMetres);
    self.shake(Math.min(Math.max(t, 0), 1));
  });

  return self;
}
