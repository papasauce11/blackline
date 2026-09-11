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
import { register as registerDeterminism } from './determinism.js';
import { register as registerMap } from './map.js';
import { register as registerNavigation } from './navigation.js';
import { register as registerShade } from './shade.js';
import { register as registerMovement } from './movement.js';
import { register as registerReadability } from './readability.js';
import { register as registerWarden } from './warden.js';
import { register as registerDetection } from './detection.js';
import { register as registerAI } from './ai.js';
import { register as registerCombat } from './combat.js';
import { register as registerAudio } from './audio.js';
import { register as registerGadgets } from './gadgets.js';
import { register as registerObjective } from './objective.js';
import { register as registerPlantRule } from './plantrule.js';
import { register as registerPlantCensus } from './plantcensus.js';
import { register as registerGroundView } from './groundview.js';
import { register as registerFreeRoam } from './freeroam.js';
import { register as registerSettings } from './settings.js';
import { register as registerDeathCam } from './deathcam.js';
import { register as registerPresentation } from './presentation.js';
import { register as registerVisual } from './visual.js';
import { register as registerPerformance } from './performance.js';
import { register as registerDoneDef } from './donedef.js';
import { register as registerSoak } from './soak.js';
import { register as registerFuzz } from './fuzz.js';

/** @param {import('../ui/debug.js').DebugTools} debugTools */
export function registerAutoTests(debugTools) {
  registerEngine(debugTools);
  registerDeterminism(debugTools);
  registerMap(debugTools);
  registerNavigation(debugTools);
  registerShade(debugTools);
  registerMovement(debugTools);
  registerReadability(debugTools);
  registerWarden(debugTools);
  registerDetection(debugTools);
  registerAI(debugTools);
  registerCombat(debugTools);
  registerAudio(debugTools);
  registerGadgets(debugTools);
  registerObjective(debugTools);
  registerPlantRule(debugTools);
  registerPlantCensus(debugTools);
  registerGroundView(debugTools);
  registerFreeRoam(debugTools);
  registerSettings(debugTools);
  registerDeathCam(debugTools);
  registerPresentation(debugTools);
  registerVisual(debugTools);
  registerDoneDef(debugTools);
  registerSoak(debugTools);
  registerFuzz(debugTools);
  // Last: it is the heaviest check and it leaves the world in a known state.
  registerPerformance(debugTools);
}
