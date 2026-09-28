/**
 * BLACKLINE - tests/index.js
 *
 * The AUTO suite's registrar.
 *
 * Section 3 gives the test harness no home, and Section 3.1 caps a module at
 * roughly 600 lines. The suite had grown to ~2400 lines inside main.js, which
 * is the composition root and had become the largest file in the project by a
 * wide margin. See PROGRESS.md deviation 16.
 *
 * Order here is the order the suite reports in: engine invariants first, then
 * the world, then the actors that move through it, then the systems that watch
 * them. A failure early in that list usually explains the ones after it.
 */

import { register as registerEngine } from './engine.js';
import { register as registerBoot } from './boot.js';
import { register as registerDeterminism } from './determinism.js';
import { register as registerSeeds } from './seeds.js';
import { register as registerMap } from './map.js';
import { register as registerMaps } from './maps.js';
import { register as registerYard } from './yard.js';
import { register as registerWalkway } from './walkway.js';
import { register as registerYardLight } from './yardlight.js';
import { register as registerNavigation } from './navigation.js';
import { register as registerShade } from './shade.js';
import { register as registerMovement } from './movement.js';
import { register as registerScuff } from './scuff.js';
import { register as registerFeel } from './feel.js';
import { register as registerHang } from './hang.js';
import { register as registerReadability } from './readability.js';
import { register as registerDeck } from './deck.js';
import { register as registerRoutes } from './routes.js';
import { register as registerAnyMap } from './anymap.js';
import { register as registerLegibility } from './legibility.js';
import { register as registerWarden } from './warden.js';
import { register as registerWardenGround } from './wardenground.js';
import { register as registerDetection } from './detection.js';
import { register as registerAI } from './ai.js';
import { register as registerDifficulty } from './difficulty.js';
import { register as registerAISoak } from './aisoak.js';
import { register as registerCombat } from './combat.js';
import { register as registerAudio } from './audio.js';
import { register as registerGadgets } from './gadgets.js';
import { register as registerObjective } from './objective.js';
import { register as registerPlantRule } from './plantrule.js';
import { register as registerPlantCensus } from './plantcensus.js';
import { register as registerDefuseLine } from './defuseline.js';
import { register as registerGroundView } from './groundview.js';
import { register as registerFreeRoam } from './freeroam.js';
import { register as registerSettings } from './settings.js';
import { register as registerSettingsStore } from './settingsstore.js';
import { register as registerVersion } from './version.js';
import { register as registerMenu } from './menu.js';
import { register as registerTutorial } from './tutorial.js';
import { register as registerDebugGate } from './debuggate.js';
import { register as registerBriefing } from './briefing.js';
import { register as registerRoundEnd } from './roundend.js';
import { register as registerFeedback } from './feedback.js';
import { register as registerDeathCam } from './deathcam.js';
import { register as registerPresentation } from './presentation.js';
import { register as registerVisual } from './visual.js';
import { register as registerKeyLight } from './keylight.js';
import { register as registerSiteTint } from './sitetint.js';
import { register as registerPost } from './post.js';
import { register as registerFigure } from './figure.js';
import { register as registerAnimation } from './animation.js';
import { register as registerLook } from './look.js';
import { register as registerMaterials } from './materials.js';
import { register as registerYardMaterials } from './yardmaterials.js';
import { register as registerPerformance } from './performance.js';
import { register as registerDoneDef } from './donedef.js';
import { register as registerSoak } from './soak.js';
import { register as registerFuzz } from './fuzz.js';
import { register as registerPipelineWait } from './pipelinewait.js';
import { register as registerHeartbeat } from './heartbeat.js';
import { register as registerTraversalFuzz } from './traversalfuzz.js';
import { register as registerRegistry } from './registry.js';
import { register as registerSkipList } from './skiplist.js';

/** @param {import('../ui/debug.js').DebugTools} debugTools */
export function registerAutoTests(debugTools) {
  registerEngine(debugTools);
  // Before the world: what the page does when there is no game to show (H4).
  registerBoot(debugTools);
  registerDeterminism(debugTools);
  registerSeeds(debugTools);
  registerMap(debugTools);
  registerMaps(debugTools);
  registerYard(debugTools);
  registerWalkway(debugTools);
  registerYardLight(debugTools);
  registerNavigation(debugTools);
  registerShade(debugTools);
  registerMovement(debugTools);
  registerScuff(debugTools);
  registerFeel(debugTools);
  registerHang(debugTools);
  registerReadability(debugTools);
  registerDeck(debugTools);
  registerRoutes(debugTools);
  registerAnyMap(debugTools);
  registerLegibility(debugTools);
  registerWarden(debugTools);
  registerWardenGround(debugTools);
  registerDetection(debugTools);
  registerAI(debugTools);
  registerDifficulty(debugTools);
  registerAISoak(debugTools);
  registerCombat(debugTools);
  registerAudio(debugTools);
  registerGadgets(debugTools);
  registerObjective(debugTools);
  registerPlantRule(debugTools);
  registerPlantCensus(debugTools);
  registerDefuseLine(debugTools);
  registerGroundView(debugTools);
  registerFreeRoam(debugTools);
  registerSettings(debugTools);
  registerSettingsStore(debugTools);
  registerVersion(debugTools);
  registerMenu(debugTools);
  registerTutorial(debugTools);
  registerDebugGate(debugTools);
  registerBriefing(debugTools);
  registerRoundEnd(debugTools);
  registerFeedback(debugTools);
  registerDeathCam(debugTools);
  registerPresentation(debugTools);
  registerVisual(debugTools);
  registerKeyLight(debugTools);
  registerSiteTint(debugTools);
  registerPost(debugTools);
  registerFigure(debugTools);
  registerAnimation(debugTools);
  registerLook(debugTools);
  registerMaterials(debugTools);
  registerYardMaterials(debugTools);
  registerDoneDef(debugTools);
  registerSoak(debugTools);
  registerFuzz(debugTools);
  // After fuzz.js on purpose: by then the run's pipeline tail has been paid
  // once, so this one's own drains answer in milliseconds (F11, D48).
  registerPipelineWait(debugTools);
  registerHeartbeat(debugTools);
  registerTraversalFuzz(debugTools);
  registerRegistry(debugTools);
  registerSkipList(debugTools);
  // Last: it is the heaviest check and it leaves the world in a known state.
  registerPerformance(debugTools);
}
