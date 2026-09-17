/**
 * BLACKLINE — boot.js
 *
 * Building the world: the renderer, the scene, the one camera, the map, the
 * two actors and every system, in the order their dependencies dictate, and
 * the wiring between them. Split from main.js's `bootstrap()` (C3) for the
 * 600-line guard; the composition root keeps what runs the world - the
 * match, the loop, the fixed step and the frame - and destructures what is
 * built here into its own singletons.
 *
 * Layering (Section 3.1): this is the composition root's own code and may
 * import from anything, as main.js may. Nothing imports it but main.js.
 */

import { CONFIG } from './config.js';
import { Freefly } from './freefly.js';
import { Input } from './input.js';
import { buildMap, listMaps } from './maps/index.js';
import { createWardenGroundView } from './groundview.js';
import {
  createRenderer, createScene, createCamera, createToonGradient, resizeView, watchContextLoss,
} from './view.js';
import { createCameraOwnership } from './cameraowner.js';
import { wireMatchEvents } from './wiring.js';
import { Shade } from './entities/agent.js';
import { Warden } from './entities/enforcer.js';
import { createDetection } from './systems/detection.js';
import { createWardenAI } from './systems/ai.js';
import { createCombat } from './systems/combat.js';
import { createAudio } from './systems/audio.js';
import { createGadgets } from './systems/gadgets.js';
import { createObjective } from './systems/objective.js';
import { createEffects } from './systems/effects.js';
import { createDeathCam } from './systems/deathcam.js';
import { createFeedback } from './systems/feedback.js';
import { createPanels } from './panels.js';
import { DebugTools } from './ui/debug.js';
import { registerAutoTests } from './tests/index.js';
import { registerAssertions } from './tests/assertions.js';
import { wireTestCommands } from './testcommands.js';

/**
 * @param {object} root what the composition root owns and the systems need
 * @param {object} root.emitter
 * @param {object} root.debugState the F3 field bag
 * @param {object} root.harness the AUTO suite's object, for the debug tools
 * @param {(options?: object) => object} root.initMatch
 * @param {(paused: boolean) => void} root.setPaused
 * @param {(value: number) => void} root.setTimeScale
 * @param {() => object} root.match the current match record, read live
 * @param {string} root.mapId which registered map to build (D1); the URL's, or the default
 * @param {(id: string) => void} root.goToMap reload the page on another map, for the menu's map row
 * @returns {object} every singleton, by the name main.js keeps it under
 */
export function bootWorld({
  emitter, debugState, harness, initMatch, setPaused, setTimeScale, match, mapId, goToMap,
}) {
  const canvas = document.getElementById('bl-canvas');
  if (!canvas) throw new Error('bootstrap: #bl-canvas not found');

  const renderer = createRenderer(canvas);
  const scene = createScene();
  const camera = createCamera();
  scene.add(camera);

  // Section 4: 4-step gradient map generated in code via DataTexture. Created
  // here in the composition root and passed down, because both the maps and
  // entities/ need it and neither may import the other (Section 3.1).
  const gradientMap = createToonGradient(CONFIG.render.toonSteps);

  // D1: one map per page load, from the registry. Every system below takes
  // it at construction; another map is another page load (maps/index.js).
  const map = buildMap(mapId, { gradientMap });
  scene.add(map.root);
  // Block A7: the Warden's reachable ground, drawable from the F4 panel.
  // Hidden by default; `test:toggle-warden-ground` shows it.
  const groundView = createWardenGroundView(map.wardenGround);
  scene.add(groundView.root);

  debugState.map = map.id;
  debugState.map = map.id;
  debugState.collisionBoxes = map.collision.boxCount;
  debugState.mapLedges = map.ledges.length;

  const shade = new Shade({ collision: map.collision, gradientMap, emitter });
  scene.add(shade.mesh);
  scene.add(shade.groundBlob);
  scene.add(shade.cameraRig);
  shade.reset(map.shadeSpawns[0]);

  const warden = new Warden({ collision: map.collision, gradientMap, emitter });
  scene.add(warden.mesh);
  scene.add(warden.groundBlob);
  scene.add(warden.cameraRig);
  warden.reset(map.wardenSpawns[0]);

  // The one camera's owner, now both rigs exist. Combat's finisher and the
  // death camera are handed `set` so they take the camera the same way the
  // frame does, rather than reaching for it.
  const cameraOwner = createCameraOwnership({ camera, scene, shade, warden, emitter });
  const setCameraOwner = (owner) => cameraOwner.set(owner);

  // Section 7: light sampling, the visibility meter, the Section 4.2 feedback
  // and the noise field. Built after both actors, because it seeds the meter
  // from the Shade's spawn rather than letting it ramp up from zero.
  const detection = createDetection({ map, emitter });
  detection.reset(shade);

  // Section 11. The AI fills the same intent a human fills in free-roam; the
  // composition root is what steps the controller with it, so there is exactly
  // one path into the Warden.
  const gadgets = createGadgets({ map, emitter, detection });
  const wardenAI = createWardenAI({ map, warden, detection, gadgets, emitter });

  // Section 8. The finisher needs the camera and the time scale, so it is
  // handed the same two functions the composition root uses rather than
  // reaching for them.
  // Section 17.1 test mode: the Shade ignores damage while set. The `G`
  // command (testcommands.js) toggles it in the shared bag; the F3 overlay
  // shows it from the same place, so there is one value.
  const isGodMode = () => !!debugState.godMode;
  const combat = createCombat({
    map, emitter, detection, ai: wardenAI, scene, camera, setTimeScale, setCameraOwner, isGodMode,
  });
  // Section 14. Listens on the emitter and is unlocked by the first gesture,
  // because a context built before one starts suspended (Section 15).
  const audio = createAudio({ emitter, listener: shade });
  const effects = createEffects({ scene, emitter });
  // C3: the hit marker, the damage direction and the health vignette, drawn
  // in the frame over the scene for whichever actor the human is driving.
  const feedback = createFeedback({
    scene, camera, emitter, shade, warden,
    role: () => (match() ? match().role : CONFIG.match.humanRole),
  });
  feedback.warm(renderer, scene);
  // Section 10.2's death camera and Section 15's respawnShade. Built before
  // objective so the reinsert can be handed the whole restore rather than half
  // of it; the two callbacks are late-bound because each needs the other.
  let objective = null;
  const deathCam = createDeathCam({
    scene, camera, emitter, effects, setCameraOwner,
    forceReinsert: () => objective.forceReinsert(shade, warden),
  });
  objective = createObjective({
    map, emitter, detection, ai: wardenAI, gadgets,
    respawnShade: (target, spawn) => deathCam.respawnShade(target, spawn),
  });

  // The HUD, the scoreboard, the menu and the briefing, and what their
  // buttons do (panels.js); the handlers read the live objects through getters.
  let input = null;
  const { hud, scoreboard, menu, briefing } = createPanels({
    initMatch, setPaused, objective: () => objective, audio: () => audio, match,
    map: () => map, input: () => input, maps: listMaps(), goToMap,
  });

  wireMatchEvents({
    emitter, hud, audio, combat, shade, warden, deathCam, effects, scoreboard, objective, gadgets,
  });

  input = new Input(canvas);
  // Built after input, which it reads, and parked on a Shade spawn at eye
  // height so re-enabling it from the console starts somewhere sensible.
  const freefly = new Freefly(input, {
    x: map.shadeSpawns[0].position.x,
    y: map.shadeSpawns[0].position.y + CONFIG.shade.standHeight * CONFIG.shade.eyeHeightRatio,
    z: map.shadeSpawns[0].position.z,
  });

  canvas.addEventListener('mousedown', () => {
    input.requestLock();
    audio.unlock();
  });

  window.addEventListener('resize', () => {
    const size = resizeView(renderer, camera);
    if (size) emitter.emit('view:resize', size);
  });
  watchContextLoss(canvas, debugState, emitter);

  const debugTools = new DebugTools({ input, emitter, debugState, harness });
  registerAssertions(debugTools, harness);
  registerAutoTests(debugTools);
  wireTestCommands({ harness });

  return {
    renderer, scene, camera, input, debugTools, freefly, map, shade, warden, detection, wardenAI,
    combat, audio, gadgets, objective, effects, deathCam, feedback, hud, groundView, menu, scoreboard,
    briefing, cameraOwner,
  };
}
