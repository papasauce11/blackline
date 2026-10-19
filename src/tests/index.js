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
import { register as registerRngDraws } from './rngdraws.js';
import { register as registerMap } from './map.js';
import { register as registerMaps } from './maps.js';
import { register as registerYard } from './yard.js';
import { register as registerWalkway } from './walkway.js';
import { register as registerYardLight } from './yardlight.js';
import { register as registerNavigation } from './navigation.js';
import { register as registerShade } from './shade.js';
import { register as registerMovement } from './movement.js';
import { register as registerClimbPress } from './climbpress.js';
import { register as registerScuff } from './scuff.js';
import { register as registerFeel } from './feel.js';
import { register as registerHang } from './hang.js';
import { register as registerGrabSlide } from './grabslide.js';
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
import { register as registerBindings } from './bindings.js';
import { register as registerCameraSettings } from './camerasettings.js';
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
import { register as registerOutline } from './outline.js';
import { register as registerKeyLight } from './keylight.js';
import { register as registerSiteTint } from './sitetint.js';
import { register as registerPost } from './post.js';
import { register as registerFigure } from './figure.js';
import { register as registerBreath } from './breath.js';
import { register as registerBreathCensus } from './breathcensus.js';
import { register as registerBreathDrawn } from './breathdrawn.js';
import { register as registerPositionCensus } from './positioncensus.js';
import { register as registerAnimation } from './animation.js';
import { register as registerLook } from './look.js';
import { register as registerPoseEye } from './poseeye.js';
import { register as registerStrikeRepeat } from './strikerepeat.js';
import { register as registerMaterials } from './materials.js';
import { register as registerYardMaterials } from './yardmaterials.js';
import { register as registerQuality } from './quality.js';
import { register as registerQualityHold } from './qualityhold.js';
import { register as registerBufferScale } from './bufferscale.js';
import { register as registerSmallWindow } from './smallwindow.js';
import { register as registerPixelFloors } from './pixelfloors.js';
import { register as registerQuiesce } from './quiesce.js';
import { register as registerQuiesceSites } from './quiescesites.js';
import { register as registerResetCensus } from './resetcensus.js';
import { register as registerSettleCircuit } from './settlecircuit.js';
import { register as registerGrabWorld } from './grabworld.js';
import { register as registerAudioContext } from './audiocontext.js';
import { register as registerSolverQuery } from './solverquery.js';
import { register as registerAutoPick } from './autopick.js';
import { register as registerPerformance } from './performance.js';
import { register as registerDoneDef } from './donedef.js';
import { register as registerRequestBuffer } from './requestbuffer.js';
import { register as registerSoak } from './soak.js';
import { register as registerFuzz } from './fuzz.js';
import { register as registerPipelineWait } from './pipelinewait.js';
import { register as registerHeartbeat } from './heartbeat.js';
import { register as registerTraversalFuzz } from './traversalfuzz.js';
import { register as registerRegistry } from './registry.js';
import { register as registerSkipList } from './skiplist.js';
import { register as registerArgs } from './args.js';
import { register as registerBenchList } from './benchlist.js';
import { register as registerReaderNames } from './readernames.js';
import { register as registerSignedReadings } from './signedreadings.js';
import { register as registerOutlierPose } from './outlierpose.js';
import { register as registerRunnerGuard } from './runnerguard.js';
import { register as registerDetailDrift } from './detaildrift.js';
import { register as registerTimedRenders } from './timedrenders.js';
import { register as registerAudioDevice } from './audiodevice.js';

/** @param {import('../ui/debug.js').DebugTools} debugTools */
export function registerAutoTests(debugTools) {
  registerEngine(debugTools);
  // Before the world: what the page does when there is no game to show (H4).
  registerBoot(debugTools);
  registerDeterminism(debugTools);
  registerSeeds(debugTools);
  // Who spends the two seeded streams, and when (H77). Beside the other two
  // seed checks because it is about the same stream they replay.
  registerRngDraws(debugTools);
  registerMap(debugTools);
  registerMaps(debugTools);
  registerYard(debugTools);
  registerWalkway(debugTools);
  registerYardLight(debugTools);
  registerNavigation(debugTools);
  registerShade(debugTools);
  registerMovement(debugTools);
  // Beside it, the two checks about the climb key and the drivers every
  // other climb check reaches a ledge with (H70).
  registerClimbPress(debugTools);
  registerScuff(debugTools);
  registerFeel(debugTools);
  registerHang(debugTools);
  registerGrabSlide(debugTools);
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
  registerBindings(debugTools);
  registerCameraSettings(debugTools);
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
  // Beside it, and out of it since H28: the inverted-hull outline on its own.
  registerOutline(debugTools);
  registerKeyLight(debugTools);
  registerSiteTint(debugTools);
  registerPost(debugTools);
  registerFigure(debugTools);
  // Beside it: the same hood over the same neck, at every phase of the
  // breath rather than the one phase the run arrived in (H31).
  registerBreath(debugTools);
  // And the census of what those two phases reach at all (H33).
  registerBreathCensus(debugTools);
  registerBreathDrawn(debugTools);
  registerPositionCensus(debugTools);
  registerAnimation(debugTools);
  registerLook(debugTools);
  // After it, because it drives that module's own instrument twice over and
  // compares the two frames: what the position chase does to which eye a pose
  // is photographed from (H46).
  registerPoseEye(debugTools);
  registerStrikeRepeat(debugTools);
  registerMaterials(debugTools);
  registerYardMaterials(debugTools);
  // After the pixel-reading modules: it is the one module that resizes the
  // drawing buffer, so anything it failed to put back is seen by the soak and
  // the frame-budget check rather than hidden behind them (H10).
  registerQuality(debugTools);
  // Beside it, and after it: the level held still while the menu bakes a set
  // of cards (H23). It resizes the drawing buffer for the same reason and
  // belongs on the same side of the pixel-reading modules.
  registerQualityHold(debugTools);
  // Beside them, and it draws no frame: the probe's pick is stored as the lower
  // of what it found and what was already there, so the map a friend opens
  // first cannot decide their level for good (H25).
  registerAutoPick(debugTools);
  // And the third module that resizes the drawing buffer, on the same side of
  // the pixel-reading checks for the same reason: it drives the renderer's
  // pixel ratio to each preset's, to hold every pixel floor in this suite to
  // being a fraction of the buffer rather than a number (H28).
  registerBufferScale(debugTools);
  // And the fourth, which asks what the third one's law implies: whether a body
  // is still legible once the buffer is small enough (H29).
  registerSmallWindow(debugTools);
  // Beside the other census checks, because it reads source text and draws no
  // frame: every pixel floor in this suite is a fraction of the buffer (H30).
  registerPixelFloors(debugTools);
  // And beside that one, because its subject is the helper all of those checks
  // frame a body with: what `quiesce()` says about the AI is what its body
  // passes, and the match it leaves is live in fact (H71).
  registerQuiesce(debugTools);
  // And next to it the other half of the same subject: not what the helper
  // says, but which of its thirty-one sites steps the world before it draws,
  // and therefore owes itself a match with no AI in it (H74).
  registerQuiesceSites(debugTools);
  registerResetCensus(debugTools);
  // And the third of the same subject: not what the helper says, nor which of
  // its sites steps the world, but which patrol circuit its settle got - the
  // clock draws it, and one node of twenty-one sends the Warden walking off the
  // spawn twelve one-frame sites grab it on (H80).
  registerSettleCircuit(debugTools);
  // And the fourth: not the helper's sentence, nor its sites, nor the circuit
  // its settle got, but the promise twelve of those sites rest on - that a
  // lens grab() advances neither the clock nor the picture (H76).
  registerGrabWorld(debugTools);
  // Beside it, and a census of the same shape: one module owns the audio
  // device's constructor, and an offline render gives the live context back
  // (H32).
  registerAudioContext(debugTools);
  // And the same shape one layer down: the swept solver's read-only queries
  // live in physicsquery.js, the world answers them from there, and both
  // halves write the one scratch set physicsscratch.js owns (H56).
  registerSolverQuery(debugTools);
  registerDoneDef(debugTools);
  // Beside donedef.js because it is the same kind of census and about the
  // instrument donedef.js uses: the Resource Timing buffer three of those
  // clauses read (H67). It fetches every module that ran, which is what
  // makes its own 'the buffer is past its default' clause a measurement.
  registerRequestBuffer(debugTools);
  registerSoak(debugTools);
  registerFuzz(debugTools);
  // After fuzz.js on purpose: by then the run's pipeline tail has been paid
  // once, so this one's own drains answer in milliseconds (F11, D48).
  registerPipelineWait(debugTools);
  registerHeartbeat(debugTools);
  registerTraversalFuzz(debugTools);
  registerRegistry(debugTools);
  registerSkipList(debugTools);
  // Beside it, the other list of checks the gate does not count: the ones
  // `npm run bench` answers on the real GPU instead (H11).
  registerArgs(debugTools);
  registerBenchList(debugTools);
  // And the readers both of those censuses grep with: one module owns them,
  // and a local name may not claim the one it did not get (H68).
  registerReaderNames(debugTools);
  // H88: and the sites that group a reading or compare it across cases keep
  // its sign, which is the class H81 found by a whole job.
  registerSignedReadings(debugTools);
  // H89: the pixel floors at a settle pose the pinned seed never photographs.
  registerOutlierPose(debugTools);
  registerRunnerGuard(debugTools);
  // H79: and which readings moved between the two runs of a map without
  // moving a verdict, which `flaky` cannot see.
  registerDetailDrift(debugTools);
  // And the census of the clocks themselves: which checks time a render, and
  // which of them put a verdict on a number this renderer cannot measure
  // (H36, H41). After fuzz.js and pipelinewait.js, so its own two drains
  // answer in milliseconds rather than re-measuring the run's tail.
  registerTimedRenders(debugTools);
  // Last but one, and ahead of the device journal since H65: this check drives
  // **210** frames, a frame is a mark in that journal (H54), and so the
  // densest block of marks in the suite used to arrive after the journal had
  // been read. It is also the heaviest check and it leaves the world in a
  // known state.
  registerPerformance(debugTools);
  // Last on purpose: the journal's whole value is the window it covers, every
  // check before this one is window, and the unlock is up at registerAudio so
  // by here it is most of a run (H35). This reads and drives nothing, which is
  // what lets it sit after the heaviest check. **The import order says the
  // opposite and is not the registration order** - audiodevice.js is imported
  // above performance.js - so the order is a clause rather than a comment:
  // `the-device-journal-is-read-after-the-frames-that-feed-it` (H65).
  registerAudioDevice(debugTools);
}
