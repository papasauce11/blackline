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
import { bakeMap, listMaps, BAKE_SLICES } from './maps/index.js';
import { createWardenGroundView } from './groundview.js';
import {
  createRenderer, createScene, createCamera, createToonGradient, resizeView, watchContextLoss,
} from './view.js';
import { createCameraOwnership } from './cameraowner.js';
import { createPost } from './post.js';
import { installQuality } from './quality.js';
import { saveSettings } from './settingsstore.js';
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
import { createThumbnails } from './thumbnails.js';
import { createTutorial } from './systems/tutorial.js';
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
 * @param {(label: string, done: number, of: number) => Promise<void>} [root.onSlice]
 *   awaited between bake slices (H4), so the loading screen gets drawn. Absent,
 *   the bake runs straight through and this function still resolves.
 * @returns {Promise<object>} every singleton, by the name main.js keeps it
 *   under — or `{ unsupported: 'webgl2' }` when this browser cannot draw at all
 *   (H4), in which case nothing was built and nothing was added to a scene.
 */
export async function bootWorld({
  emitter, debugState, harness, initMatch, setPaused, setTimeScale, match, mapId, goToMap, onSlice,
}) {
  const canvas = document.getElementById('bl-canvas');
  if (!canvas) throw new Error('bootstrap: #bl-canvas not found');

  // H4: no WebGL2, no renderer, and nothing below this line can be built. The
  // refusal goes back up rather than throwing: main.js has a sentence for it,
  // and a stack trace on the index.html error panel is not one.
  const renderer = createRenderer(canvas);
  if (!renderer) return { unsupported: 'webgl2' };

  const scene = createScene();
  const camera = createCamera();
  scene.add(camera);
  // E6: the bloom and the vignette. The camera sees the overlay layer too,
  // so with the post off the feedback quad still draws in the one pass.
  const post = createPost(renderer);
  camera.layers.enable(CONFIG.render.overlayLayer);

  // Section 4: 4-step gradient map generated in code via DataTexture. Created
  // here in the composition root and passed down, because both the maps and
  // entities/ need it and neither may import the other (Section 3.1).
  const gradientMap = createToonGradient(CONFIG.render.toonSteps);

  // D1: one map per page load, from the registry. Every system below takes
  // it at construction; another map is another page load (maps/index.js).
  //
  // H4: a slice at a time, awaiting `onSlice` between them, because the bake is
  // ~900ms on the plant and a locked main thread means the loading screen the
  // page has been told to draw is never drawn. The slice count is recorded so
  // `the-bake-yields-the-page-a-frame-to-paint` can read what the real boot did
  // rather than only what a bake it drove itself does.
  const bake = bakeMap(mapId, { gradientMap });
  const bakeStart = performance.now();
  let label;
  let yields = 0;
  while ((label = bake.step()) !== null) {
    if (onSlice) {
      await onSlice(label, bake.slices, BAKE_SLICES);
      yields++;
    }
  }
  const map = bake.map;
  debugState.bootBake = {
    map: mapId, slices: bake.slices, yields, ms: Math.round(performance.now() - bakeStart),
  };
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
  // H5: a picture of every registered map for the menu's cards, rendered from
  // the game's own geometry with the live renderer and the one camera. Built
  // here and *started* by the composition root after `window.BLACKLINE` is
  // published, so none of it is inside the boot a player waits on.
  const thumbnails = createThumbnails({ renderer, camera, gradientMap });

  // H6: the first-run chain. It watches `sim:step` and writes nothing on the
  // Shade, so it is built after the actors and before the panels that draw it.
  const tutorial = createTutorial({ emitter, shade: () => shade, map: () => map });

  let input = null;
  const { hud, scoreboard, menu, briefing, tutorialPanel } = createPanels({
    initMatch, setPaused, objective: () => objective, audio: () => audio, match,
    map: () => map, input: () => input, maps: listMaps(), goToMap, thumbnails,
    emitter, tutorial,
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
    if (size) {
      post.setSize();
      emitter.emit('view:resize', size);
    }
  });
  watchContextLoss(canvas, debugState, emitter);

  // H10: the quality preset in force, applied to the live objects now that the
  // key light and both figures' hulls are in the scene. `onProbed` is how the
  // level `auto` measures on a first boot survives a reload: the probe writes
  // it into `SETTINGS` and this is what puts it in the store (H7).
  // It writes `debugState.quality` itself, whenever the level or the probe's
  // reading moves, so there is nothing to assign here - and assigning the
  // return value would replace that record with the thinner one it hands back.
  installQuality({ renderer, post, scene, map, debugState, onProbed: () => saveSettings() });

  const debugTools = new DebugTools({ input, emitter, debugState, harness });
  registerAssertions(debugTools, harness);
  registerAutoTests(debugTools);
  wireTestCommands({ harness });

  return {
    renderer, post, scene, camera, input, debugTools, freefly, map, shade, warden, detection, wardenAI,
    combat, audio, gadgets, objective, effects, deathCam, feedback, hud, groundView, menu, scoreboard,
    briefing, cameraOwner, thumbnails, tutorial, tutorialPanel,
  };
}
