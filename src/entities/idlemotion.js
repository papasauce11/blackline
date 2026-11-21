/**
 * BLACKLINE - entities/idlemotion.js
 *
 * What a body does when nothing is asked of it (J8): it breathes, the Warden's
 * head turns before its body, and on the open yard the Shade's hood moves in
 * the wind. All of it is presentation. It runs inside `updateVisual` on the
 * wall clock and writes two arm heights, one group's yaw and the Warden's drawn
 * yaw, and nothing the simulation reads - the capsule, `yaw` and `pitch` are
 * untouched, so a recorded replay plays the same with or without it.
 *
 * **Where it is written, and why not the obvious place.** The breath is the
 * shoulders rising and falling: the two arm groups' height, which nothing else
 * writes after build. It is not the torso's pitch or the chest's height
 * because `tests/breathcensus.js` holds both still - the torso's rotation is
 * the proof that a breath moves a position and not an angle, and the Warden's
 * chest is the proof its figure checks are phase-free - and those proofs are
 * why a clause far from a margin can be declared out of reach. The wind is the
 * hood's yaw and not its roll for the neighbouring reason: the hood is merged
 * into the torso (a hood of its own is a thirteenth draw call, `figure.js`),
 * the 8m hood reads the same 28px at every phase, and a hood turning about
 * the vertical is the one motion that leaves its width face-on alone.
 *
 * **Pure functions of time and speed.** The sway is `sin` of a clock times a
 * weight that falls to nothing as the body speeds up, so it never fights the
 * stride and nothing in it can drift or draw from an rng. The one thing kept
 * per body is that clock, the offset last applied and the Warden's drawn yaw,
 * in a WeakMap here rather than on the entity: a body that is collected takes
 * its record with it, and agent.js and enforcer.js are not where a
 * presentation detail should grow fields.
 *
 * **Still wherever no round is on screen.** `main.js` tells this module once a
 * frame whether one is (`setIdleLife`): not in the main menu, the pause menu,
 * the briefing or the scoreboard. While it is not, every offset is exactly
 * zero - not damped, put back - and the Warden is drawn square to its facing,
 * so a menu's backdrop is a held frame rather than a figure fidgeting behind
 * the buttons. The Shade's older torso lift (`POSE.breath`) is outside this
 * and unchanged.
 *
 * Layering (Section 3.1): imports config and pose.js. The map's `outdoor` flag
 * reaches here as a boolean from main.js, so nothing in entities/ reads the
 * registry.
 */

import { CONFIG } from '../config.js';
import { easeAngle } from './pose.js';

const I = CONFIG.idle;
const TAU = 2 * Math.PI;

/** What the composition root last said: is a round on screen, and is the map under the sky. */
const LIFE = { live: false, windy: false };

/** Called once a frame by main.js, before the bodies are drawn. */
export function setIdleLife(live, windy) {
  LIFE.live = !!live;
  LIFE.windy = !!windy;
}

/** Read back by the checks, so they argue from what the frame was told and not from a copy of it. */
export function idleLifeState() {
  return { live: LIFE.live, windy: LIFE.windy };
}

/**
 * How much of the sway a body at `speed` still has: all of it standing, none
 * from `fadeSpeed` up, linear between.
 */
export function calm(speed) {
  return Math.max(0, Math.min(1, 1 - speed / I.fadeSpeed));
}

/** How far the shoulders are above their built height at clock `t` for a body at `speed`, metres: the breath. */
export function breathRise(t, speed) {
  return Math.sin((TAU * t) / I.breath.period) * I.breath.rise * calm(speed);
}

/** The hood's yaw at clock `t` for a body at `speed`, radians: the wind and its gust. */
export function windYaw(t, speed) {
  const W = I.wind;
  const slow = Math.sin((TAU * t) / W.period);
  const gust = Math.sin((TAU * t * W.gustRate) / W.period + 1.3) * W.gust;
  return (slow * (1 - W.gust) + gust) * W.yaw * calm(speed);
}

/** The per-body record: the idle clock, the shoulder offset and hood yaw this frame, and the yaw the Warden's body is drawn at. */
const BODIES = new WeakMap();
function bodyOf(actor) {
  let body = BODIES.get(actor);
  if (!body) {
    body = { t: 0, shrug: 0, hood: 0, yaw: actor.yaw };
    BODIES.set(actor, body);
  }
  return body;
}

/**
 * The breath, and for a hooded body the wind, for this frame. The shoulders
 * are carried to their offset by the difference from the last frame's, so
 * whatever else positions an arm is left alone; the hood's yaw is read back
 * by `hoodYaw` where the torso's yaw is written. Nothing while no round is on
 * screen, and nothing off the ground: a body hanging from a lip or tumbling
 * through the air has its own pose to read, and the shoulders are put back.
 *
 * @param {object} actor the Shade or the Warden
 * @param {number} wallDt unscaled frame delta
 * @param {boolean} grounded on the ground, not in a move or stunned
 * @param {boolean} hooded the Shade: the wind has a hood to move
 */
export function idleLife(actor, wallDt, grounded, hooded) {
  const body = bodyOf(actor);
  let rise = 0;
  body.hood = 0;
  if (LIFE.live && grounded) {
    body.t += wallDt;
    const speed = actor.speed;
    rise = breathRise(body.t, speed);
    if (hooded && LIFE.windy) body.hood = windYaw(body.t, speed);
  }
  const { armL, armR } = actor.mesh.userData.parts;
  armL.position.y += rise - body.shrug;
  armR.position.y += rise - body.shrug;
  body.shrug = rise;
}

/** The yaw the Shade's hood (its torso group) is turned this frame, radians. */
export function hoodYaw(actor) {
  return bodyOf(actor).hood;
}

/**
 * The Warden's neck. The head is put on the facing at once and the body comes
 * round to it with `neck.tau`, so the head leads by the gap between them;
 * the gap is held to `neck.clamp`, and past it the body is dragged along
 * rather than the neck twisted. The head group's own yaw carries the lead and
 * the body's is what is returned for the mesh, so the head's world yaw is the
 * facing for as long as the neck can reach it.
 *
 * With no time (a reset draws what it is given) or no round on screen, the
 * body is square to the facing and the head straight on it.
 *
 * @returns {number} the yaw to draw the body at
 */
export function neckTurn(actor, wallDt) {
  const body = bodyOf(actor);
  const head = actor.mesh.userData.parts.head;
  if (!LIFE.live || !(wallDt > 0)) {
    body.yaw = actor.yaw;
    head.rotation.y = 0;
    return actor.yaw;
  }
  body.yaw = easeAngle(body.yaw, actor.yaw, 1 - Math.exp(-wallDt / I.neck.tau));
  const gap = easeAngle(0, actor.yaw - body.yaw, 1);
  const lead = Math.max(-I.neck.clamp, Math.min(I.neck.clamp, gap));
  body.yaw = actor.yaw - lead;
  head.rotation.y = lead;
  return body.yaw;
}
