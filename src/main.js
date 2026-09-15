/**
 * BLACKLINE — main.js
 *
 * Composition root. Owns the renderer, the scene, the one and only camera, the
 * fixed-timestep loop, the event emitter and the mode router.
 *
 * Layering (Section 3.1): main.js may import from anything. Nothing may import
 * main.js. Cross-system messages go through the emitter created here and passed
 * down, never through sibling imports.
 *
 * What is here is what has to be: the singletons, `initMatch`, the loop and
 * the fixed step in its spec order. The pieces that were only cohesive
 * blocks of it live beside it (F3): `boot.js` (building the world - C3),
 * `loop.js` (the rAF scheduler),
 * `timestep.js` (the step planner), `matchstate.js` (what a match is),
 * `view.js` (renderer, camera, toon ramp, resize, lost context),
 * `cameraowner.js` (whose rig the camera is on, and mouse look),
 * `intents.js` (input to intent), `loadout.js` (the gadget slots),
 * `wiring.js` (the emitter listeners between systems), `hudstate.js` (what
 * the HUD is told), `debugfields.js` (what the F3 overlay is told),
 * `harness.js` (what the AUTO suite is handed) and `panels.js` (the HUD,
 * the scoreboard, the menu and the briefing, and what their buttons do -
 * C1, C2).
 */

import * as THREE from 'three';
import { CONFIG, SETTINGS, rng, deriveSeed, debugRequested } from './config.js';
import { Emitter } from './emitter.js';
import { bootWorld } from './boot.js';
import { FrameLoop } from './loop.js';
import { computeStepPlan } from './timestep.js';
import { resolveMatchOptions, createMatchState, bootMatchOptions } from './matchstate.js';
import { createCamera } from './view.js';
import { readShadeIntent, idleShadeIntent, readWardenIntent } from './intents.js';
import { useShadeGadget, useWardenGadget } from './loadout.js';
import { gatherHudState } from './hudstate.js';
import { recordStepFields, recordFrameFields } from './debugfields.js';
import { createHarness } from './harness.js';
import { createIntent } from './entities/agent.js';
import { createWardenIntent } from './entities/enforcer.js';

// ---------------------------------------------------------------------------
// Engine singletons
// ---------------------------------------------------------------------------

/** @type {THREE.WebGLRenderer} */ let renderer = null;
/** @type {THREE.Scene} */ let scene = null;
/** @type {THREE.PerspectiveCamera} */ let camera = null;
/** @type {import('./input.js').Input} */ let input = null;
/** @type {import('./ui/debug.js').DebugTools} */ let debugTools = null;
/** @type {import('./freefly.js').Freefly} */ let freefly = null;
/** @type {import('./map.js').GameMap} */ let map = null;
/** @type {import('./entities/agent.js').Shade} */ let shade = null;
/** @type {import('./entities/enforcer.js').Warden} */ let warden = null;
/** @type {import('./systems/detection.js').Detection} */ let detection = null;
/** @type {import('./systems/ai.js').WardenAI} */ let wardenAI = null;
/** @type {import('./systems/combat.js').Combat} */ let combat = null;
/** @type {import('./systems/audio.js').AudioSystem} */ let audio = null;
/** @type {import('./systems/gadgets.js').Gadgets} */ let gadgets = null;
/** @type {import('./systems/objective.js').Objective} */ let objective = null;
/** @type {import('./systems/effects.js').Effects} */ let effects = null;
/** @type {import('./systems/deathcam.js').DeathCam} */ let deathCam = null;
/** @type {import('./systems/feedback.js').Feedback} */ let feedback = null;
/** @type {import('./ui/hud.js').Hud} */ let hud = null;
/** @type {import('./groundview.js').WardenGroundView} */ let groundView = null;
/** @type {import('./ui/menu.js').Menu} */ let menu = null;
/** @type {import('./ui/scoreboard.js').Scoreboard} */ let scoreboard = null;
/** @type {import('./ui/briefing.js').Briefing} */ let briefing = null;
const shadeIntent = createIntent();
const wardenIntent = createWardenIntent();
/**
 * What the Warden does while nothing is driving it. In competitive the AI takes
 * over in Phase 6; until then it still needs stepping so gravity settles it
 * onto its spawn rather than leaving it hovering.
 */
const wardenIdleIntent = createWardenIntent();

/** @type {ReturnType<typeof import('./cameraowner.js').createCameraOwnership>} whose rig the one camera is on */
let cameraOwner = null;

const emitter = new Emitter();

/** Shared field bag the F3 overlay renders. Systems write their own keys. */
const debugState = {};

/**
 * Wall clock is unscaled and is what the finisher and reinsert hard guards run
 * on (Section 8.3, Section 15). Sim clock is time-scaled.
 */
const clock = { wall: 0, sim: 0, frame: 0, timeScale: 1 };

/** Esc. The loop still renders while set, but runs no simulation steps. */
let paused = false;
let accumulator = 0;
/** The rAF scheduler. Started once at boot, never by `initMatch`: the suite
 *  stops it while it runs (F4), and every check calls `initMatch`. */
const loop = new FrameLoop(renderFrame);

/** @type {object|null} current match state */
let match = null;

// ---------------------------------------------------------------------------
// Match
// ---------------------------------------------------------------------------

/**
 * Single entry point for both modes (Section 12, Section 15). Free-roam is a
 * configuration of this call, never a duplicated code path.
 *
 * @param {object} [options]
 * @param {'competitive'|'freeroam'} [options.mode]
 * @param {'shade'|'warden'} [options.role]
 * @param {boolean} [options.ai]
 * @param {boolean} [options.objective]
 * @param {number} [options.round] the round number to start on; 1 by default
 * @param {number} [options.seed] explicit seed, for reproducing a bug
 */
export function initMatch(options = {}) {
  const opts = resolveMatchOptions(options);
  // A debugging view of map data never survives into a new match (A7).
  if (groundView) groundView.setVisible(false);

  const seed = rng.reseed(
    opts.seed !== undefined ? opts.seed : deriveSeed(typeof location !== 'undefined' ? location.search : '')
  );

  match = createMatchState(opts, seed);

  debugState.seed = seed;
  debugState.mode = `${match.mode}/${match.role}`;
  debugState.rngCalls = 0;

  // Rebuild actor state too, and force a camera handover so nothing from the
  // previous match's owner survives (Section 15).
  if (shade) shade.reset(map.shadeSpawns[0]);
  if (warden) warden.reset(map.wardenSpawns[0]);
  // Noise events and the visibility cache are round state and must not bleed
  // across a match boundary (Section 15).
  if (detection) detection.reset(shade);
  // Reseeded above, so the patrol circuit is redrawn from the new stream and a
  // replayed seed reproduces the same patrol order (Section 16 check 28).
  if (wardenAI) wardenAI.reset();
  if (combat) combat.reset();
  if (gadgets) {
    gadgets.reset();
    // Section 12: "unlimited ammo and gadgets, instant recharge". A flag on the
    // one Gadgets instance, set from the match config, never a second path.
    gadgets.setUnlimited(match.mode === 'freeroam');
  }
  if (effects) effects.reset();
  // A match must never start on the previous one's death camera (Section 15).
  if (deathCam) deathCam.reset();
  if (objective && opts.objective !== false) objective.resetRound(opts.round);
  // A new match must never start behind a stale intermission.
  if (scoreboard) scoreboard.hide();
  if (audio) audio.reset();
  if (cameraOwner) cameraOwner.forget();

  emitter.emit('match:init', match);
  return match;
}

// ---------------------------------------------------------------------------
// Time scale
// ---------------------------------------------------------------------------

/** Set the simulation time scale. The finisher (Section 8.3) drives this. */
export function setTimeScale(value) {
  clock.timeScale = Number.isFinite(value) && value > 0 ? value : 1;
  debugState.timeScale = clock.timeScale;
}

/**
 * Stop and start the simulation.
 *
 * Pausing drains the accumulator and drops every held key. Without the drain,
 * unpausing after a minute would hand the loop a minute of banked time — the
 * step planner caps and drains a single frame's worth (Section 15), so the
 * result would not be a spiral, but it would still be a visible lurch. Without
 * the key drop, a key released while the menu had focus would stay down.
 */
function setPaused(value) {
  const next = !!value;
  if (paused === next) return;
  paused = next;
  debugState.paused = paused;
  accumulator = 0;
  if (paused) {
    input.exitLock();
    input.clearAll();
    menu.show('pause');
  }
  emitter.emit('game:paused', { paused });
}

/** Esc, when there is a match to pause and no menu already up. */
function togglePause() {
  if (scoreboard.open) return;
  if (paused) {
    menu.hide();
    setPaused(false);
    return;
  }
  if (menu.open) return;
  setPaused(true);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function bootstrap() {
  // Everything built is boot.js (C3); what runs it stays here. `match` is a
  // getter because the menu is built before the first match exists.
  ({
    renderer, scene, camera, input, debugTools, freefly, map, shade, warden, detection, wardenAI,
    combat, audio, gadgets, objective, effects, deathCam, feedback, hud, groundView, menu, scoreboard,
    briefing, cameraOwner,
  } = bootWorld({ emitter, debugState, harness, initMatch, setPaused, setTimeScale, match: () => match }));

  setTimeScale(1);
  debugState.stepsPerFrame = 0;
}

// ---------------------------------------------------------------------------
// Loop. The rAF scheduling is loop.js; what a step and a frame do is here,
// in the order the spec fixes.
// ---------------------------------------------------------------------------

/**
 * One fixed simulation step. dt is always CONFIG.time.fixedDt.
 * @param {number} dt
 */
function fixedStep(dt) {
  clock.sim += dt;
  map.update(dt);

  // Whichever intent actually drove the Warden this step is the one combat
  // reads. Section 12 requires free-roam to be a configuration rather than a
  // second code path, so the human's trigger and the AI's arrive by one route.
  let activeWardenIntent = wardenIdleIntent;

  if (freefly.enabled) {
    freefly.step(dt);
    warden.step(dt, wardenIdleIntent);
    shade.step(dt, idleShadeIntent(shadeIntent));
  } else if (match.role === 'warden') {
    // Free-roam (Section 12): the human drives the Warden through the very same
    // controller the AI drives in competitive.
    activeWardenIntent = readWardenIntent(input, wardenIntent);
    warden.step(dt, activeWardenIntent);
  } else {
    // A dead Shade takes no input: it is a ragdoll waiting on a countdown, and
    // driving the capsule around would leave the body and the collider apart.
    shade.step(dt, shade.health > 0 ? readShadeIntent(input, shadeIntent) : idleShadeIntent(shadeIntent));
    activeWardenIntent = match.aiEnabled ? wardenAI.step(dt, { shade }) : wardenIdleIntent;
    warden.step(dt, activeWardenIntent);
  }

  // After the actors, never before: the landing noise reads a flag the Shade
  // sets during its own step and clears at the top of the next one.
  detection.step(dt, { shade, warden });
  combat.step(dt, {
    // Section 12: free-roam has no opponent, so the Shade is not a target there
    // and the gun only interacts with the world.
    shade: match.mode === 'freeroam' ? null : shade,
    warden,
    shadeIntent: match.role === 'shade' && !freefly.enabled ? shadeIntent : null,
    wardenIntent: activeWardenIntent,
  });
  gadgets.step(dt, { shade, warden });
  if (match.role === 'shade' && !freefly.enabled && shadeIntent.gadget) {
    useShadeGadget(shadeIntent.gadget, { shade, warden, gadgets, hud });
    shadeIntent.gadget = 0;
  }
  if (match.role === 'warden' && !freefly.enabled && activeWardenIntent.gadget) {
    useWardenGadget(activeWardenIntent.gadget, { warden, gadgets, hud });
    activeWardenIntent.gadget = 0;
  }
  // Section 9.2: the slow is applied to the controller, never to the physics.
  shade.speedMultiplier = gadgets.shadeSpeedMultiplier();
  if (match.objectiveEnabled) {
    objective.step(dt, {
      shade, warden,
      intent: match.role === 'shade' && !freefly.enabled ? shadeIntent : null,
    });
  }
  effects.step(dt);

  if (SETTINGS.debug) recordStepFields(debugState, { detection, wardenAI, effects, gadgets, objective });

  emitter.emit('sim:step', dt);
  if (SETTINGS.debug) debugTools.step();
}

/** Who the human is currently driving. */
function humanOwner() {
  if (freefly.enabled) return 'freefly';
  return match && match.role === 'warden' ? 'warden' : 'shade';
}

/**
 * Everything one frame does, given how long the last one took.
 *
 * Split out of `frame()` so the Section 16 check 29 benchmark can run the real
 * frame rather than a re-implementation of it. A performance number measured
 * against a copy of the frame loop is a number about the copy.
 *
 * @param {number} wallDelta unscaled seconds since the previous frame
 */
function renderFrame(wallDelta) {
  clock.wall += wallDelta;
  clock.frame++;

  // Before the steps: a step clears input edges, which would eat F3/F4 — and
  // Esc, which is read here for the same reason.
  debugTools.pollKeys();
  // C2: the briefing holds the round until any key or mouse button (Esc is
  // one); the press is spent, so the key that starts the round is not a jump.
  if (briefing.open) {
    if (input.pressedCodes.size) briefing.dismiss(input);
  } else if (input.pressed('pause')) togglePause();

  const owner = humanOwner();
  // Section 8.3: the finisher owns the camera while it runs. Reasserting
  // ownership every frame here is what stopped the 40 degree orbit from ever
  // being seen — combat parented the camera to its pivot and the next frame
  // yanked it straight back to the Shade rig.
  // Section 10.2's death camera owns the camera for the same reason: reasserting
  // ownership every frame is what stopped the finisher's orbit from ever being
  // seen, and the death cam would lose it the same way.
  const dead = deathCam && deathCam.active;
  const cinematic = (combat && combat.inFinisher) || dead;
  if (!cinematic) cameraOwner.set(owner);
  cameraOwner.look({ human: owner, dead, cinematic, input, deathCam, freefly });
  emitter.emit('frame:begin', { wallDelta, input });

  // Paused feeds the planner nothing rather than skipping it: the accumulator
  // must not quietly fill while the menu is up, or resuming replays the pause.
  // The briefing holds the round the same way.
  const held = paused || briefing.open;
  const plan = computeStepPlan(accumulator, held ? 0 : wallDelta, clock.timeScale);
  accumulator = plan.accumulator;
  for (let i = 0; i < plan.steps; i++) {
    fixedStep(plan.dt);
    input.clearEdges();
  }
  debugState.stepsPerFrame = plan.steps;
  // Edges still have to be consumed while paused, or the Esc that resumes is
  // still pending on the next frame and pauses straight back.
  if (held) input.clearEdges();

  const alpha = accumulator / plan.dt;
  if (owner === 'freefly') freefly.apply(camera);
  shade.updateVisual(wallDelta);
  warden.updateVisual(wallDelta);
  // On the wall clock, after the bodies have moved: the death camera frames the
  // killer, and its guard must not be slowed by a time scale it does not own.
  if (dead) deathCam.step(wallDelta, shade);

  // Section 6.2: ADS narrows the FOV. Only the Warden touches it, and only
  // while it owns the camera; the handover restores it.
  if (owner === 'warden' && !cinematic) cameraOwner.applyAdsFov();

  // The Warden-ground overlay's marker follows the human's actor. Nothing
  // while hidden, which is always outside the F4 panel.
  if (groundView.visible) groundView.update(owner === 'warden' ? warden : shade);

  // Audio and the HUD run on the wall clock, not the fixed step: they present
  // the simulation rather than being part of it.
  audio.step(wallDelta, { detectionAccumulator: wardenAI.accumulator });

  // The HUD is not drawn behind a menu, an intermission or the briefing.
  hud.setVisible(!menu.open && !scoreboard.open && !briefing.open);
  if (hud.visible) {
    hud.update(wallDelta, gatherHudState({ match, shade, warden, gadgets, detection, combat, objective }));
  }

  emitter.emit('frame:render', { alpha, wallDelta });

  const cpuStart = performance.now();
  renderer.render(scene, camera);
  recordFrameFields(debugState, {
    renderer, cpuMs: performance.now() - cpuStart, rng, shade, warden, camera, cameraOwner: cameraOwner.owner,
  });

  debugTools.update(wallDelta, wallDelta * 1000);
  input.endFrame();
}

// ---------------------------------------------------------------------------
// Harness handed to the AUTO suite (harness.js). One getter per live object.
// ---------------------------------------------------------------------------

const harness = createHarness({
  scene: () => scene,
  camera: () => camera,
  renderer: () => renderer,
  input: () => input,
  debugTools: () => debugTools,
  match: () => match,
  map: () => map,
  shade: () => shade,
  warden: () => warden,
  detection: () => detection,
  wardenAI: () => wardenAI,
  combat: () => combat,
  audio: () => audio,
  gadgets: () => gadgets,
  objective: () => objective,
  effects: () => effects,
  deathCam: () => deathCam,
  feedback: () => feedback,
  hud: () => hud,
  groundView: () => groundView,
  menu: () => menu,
  scoreboard: () => scoreboard,
  briefing: () => briefing,
  paused: () => paused,
  cameraOwner: () => cameraOwner.owner,
  freefly: () => freefly,
}, {
  fixedStep,
  renderFrame,
  setPaused,
  togglePause,
  loop,
  setCameraOwner: (owner) => cameraOwner.set(owner),
  createCamera,
  emitter,
  debugState,
  clock,
  config: CONFIG,
  rng,
  computeStepPlan,
  setTimeScale,
  initMatch,
});

// ---------------------------------------------------------------------------
// Go
// ---------------------------------------------------------------------------

// The debug gate, before anything reads it: `?debug=1` opens the tooling
// for this page load (C1). Off, the page is the playtest build.
if (debugRequested(location.search)) SETTINGS.debug = true;

bootstrap();

initMatch(bootMatchOptions(location.search));
loop.start();

// Console handle so a seed can be reproduced by hand (Section 16, check 28),
// and the AUTO suite's way in whether or not the gate is up: the headless
// runner reaches the game through it and the suite turns the gate on for
// the length of a run.
window.BLACKLINE = harness;
if (SETTINGS.debug) {
  console.log(
    `%c BLACKLINE %c three r${THREE.REVISION}  seed ${rng.seed}  F3 debug  F4 test mode `,
    'background:#2fd6c3;color:#08090b;font-weight:bold',
    'color:#7e8f95'
  );
}

// Nothing may import main.js (Section 3.1), so the only exports are the ones
// the AUTO suite reaches through the harness. `stop` is kept for teardown.
export function stop() {
  loop.stop();
}
