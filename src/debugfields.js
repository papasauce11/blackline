/**
 * BLACKLINE — debugfields.js
 *
 * What the F3 overlay is told by the loop, once per fixed step and once per
 * frame. Keys and types the overlay's field table actually consumes
 * (Section 17: "visibility meter raw and smoothed", "active noise events").
 * Anything else written here is silently dropped, so it must match
 * `ui/debug.js`. Systems write their own keys into the same bag directly;
 * these are the ones only the composition root can see.
 */

/** After the systems have stepped. Only under DEBUG. */
export function recordStepFields(debugState, { detection, wardenAI, effects, gadgets, objective }) {
  debugState.visibilityRaw = detection.raw;
  debugState.visibilitySmoothed = detection.smoothed;
  debugState.activeNoise = detection.noise.activeCount;
  debugState.aiState = wardenAI.state;
  debugState.aiDetection = wardenAI.accumulator;
  debugState.aiStuckCounter = wardenAI.stuckCount;
  debugState.aiStuckTimer = wardenAI.stuckTimer;
  debugState.activeEffects = effects.activeCount + gadgets.effects.count;
  debugState.pooledSprites = effects.pooledSprites;
  debugState.roundState = `${objective.round.charge} ${Math.ceil(objective.hud.timeRemaining)}s`;
}

/**
 * H77: who drew from the simulation's stream, per fixed step.
 *
 * The stream is shared, so a check that steps frames beside a live AI and then
 * reads anything the stream feeds is reading numbers something else has been
 * pulling on. Which is answerable with a counter rather than inferred from
 * pixels - and the counter has to be split by whether the AI drove that step,
 * because the AI is the only drawer a check can turn off.
 *
 * Not an overlay field and not behind `SETTINGS.debug` like everything else
 * here, and both are on purpose: `ui/debug.js` has no row for a count that
 * only means something as a difference between two instants, and a
 * bookkeeping that exists only while the gate is up is a bookkeeping whose own
 * gate is one more thing a reading depends on. It is two integer adds.
 * Cumulative for the life of the page - a reseed must not move it, or a check
 * that opens its own match would zero the span it is being measured over.
 *
 * @param {object} debugState
 * @param {boolean} aiDrove whether wardenAI stepped this step
 * @param {number} drawn values taken from the simulation's stream in it
 */
export function recordStepDraws(debugState, aiDrove, drawn) {
  if (aiDrove) debugState.rngUnderAi = (debugState.rngUnderAi || 0) + drawn;
  else debugState.rngWithoutAi = (debugState.rngWithoutAi || 0) + drawn;
}

/** After the render call, with the renderer's own counters. */
export function recordFrameFields(debugState, { renderer, cpuMs, rng, shade, warden, camera, cameraOwner }) {
  debugState.cpuMs = cpuMs;
  debugState.drawCalls = renderer.info.render.calls;
  debugState.triangles = renderer.info.render.triangles;
  debugState.rngCalls = rng.calls;
  debugState.shadeState = shade.state + (shade.crouching ? ' (crouch)' : '');
  debugState.shadePos = shade.position;
  debugState.shadeVel = shade.velocity;
  debugState.shadeLives = shade.lives;
  debugState.shadeGrounded = shade.grounded ? 'yes' : 'no';
  debugState.cameraOwner = `${cameraOwner} (fov ${camera.fov.toFixed(1)})`;
  debugState.wardenState = warden.state + (warden.ads ? ' (ads)' : '');
  debugState.wardenPos = warden.position;
  debugState.wardenHealth = warden.health;
}
