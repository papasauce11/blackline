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
