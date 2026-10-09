/**
 * BLACKLINE - tests/performance.js
 *
 * AUTO suite (Section 16 check 29, Section 17.1).
 *
 * Check 29 is: "Trigger smoke, a flashbang, sustained gunfire, and a ragdoll
 * simultaneously. Framerate stays at or above 60 on integrated graphics."
 * Section 16 classes it AUTO and says to build the harness rather than reason
 * about it, so this actually assembles that exact load and actually times the
 * frame — `h.renderFrame()` is the same function requestAnimationFrame calls.
 *
 * What this can and cannot prove is worth stating plainly, because a
 * performance check that overclaims is worse than none:
 *
 *  - It CAN prove the stress load really assembled (**at least 100** smoke
 *    sprites, which is what the clause below actually requires - half of
 *    `GA.smoke.spriteCap`, because the two grenades share it - a live
 *    flashbang, a tumbling ragdoll, a magazine going downrange), and it can
 *    time the CPU cost of a real frame and the GPU cost of the draw when
 *    EXT_disjoint_timer_query_webgl2 is available. This line said "200 smoke
 *    sprites" until H41, which is the cap and not the bar; the realised peak
 *    here is 100, and a check's own doc overstating what it requires is the
 *    same fault in prose that H41 came to fix in a clause.
 *  - It CANNOT prove a vsync-paced frame rate on Josh's integrated GPU. This
 *    machine is not that machine, and a backgrounded tab is not a presented
 *    frame. The final word on check 29 stays HUMAN.
 *  - And it CANNOT price the frame it times, which is why the budget below is
 *    reported here and asserted elsewhere (H41). A wall clock round a render
 *    reads the *submission*: headless a frame submits in a few milliseconds
 *    and the fence behind it waits several hundred, so a median held against
 *    half the budget here was 2.7x clear of a ceiling on a number that leaves
 *    out almost all of what the frame cost (H36, `TRAPS.md`). The verdict
 *    belongs to the runner whose clock can price a draw: `npm run bench` runs
 *    this check in a headed Chrome on the real GPU, refuses a software
 *    rasteriser outright, and asks for it with `?timedVerdict=1`.
 *    Everything else here is clock-free and still the gate's: that the load
 *    assembled, that Section 15's caps held under it, that the pools neither
 *    grew nor leaked, that no runtime assertion fired.
 *    `tests/timedrenders.js` is the census of every clock in the suite and
 *    holds both ends of that parameter.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { timedVerdictAsked } from './timedrenders.js';

const PERF = CONFIG.performance;
const GA = CONFIG.gadgets;

/** Median is the honest middle here: one GC pause should not set the verdict. */
function median(values) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

/**
 * GPU timing, when the extension is there. Returns a function that resolves the
 * elapsed nanoseconds once the query is not disjoint, or null if unsupported.
 */
function gpuTimer(renderer) {
  const gl = renderer.getContext();
  if (!gl || typeof gl.createQuery !== 'function') return null;
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if (!ext) return null;
  return {
    begin() {
      this.query = gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, this.query);
    },
    end() {
      gl.endQuery(ext.TIME_ELAPSED_EXT);
    },
    async read() {
      const { query } = this;
      for (let i = 0; i < 200; i++) {
        const available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
        const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
        if (available && !disjoint) {
          const ns = gl.getQueryParameter(query, gl.QUERY_RESULT);
          gl.deleteQuery(query);
          return ns / 1e6;
        }
        if (disjoint) {
          gl.deleteQuery(query);
          return null;
        }
        // Deliberately setTimeout, and the only one in src/. Section 9 and the
        // risk register ban it for anything that affects GAMEPLAY — an effect
        // that schedules itself can outlive a round or fire during a pause.
        // This yields the thread so a GPU fence can resolve inside a test, ends
        // when the query does, and touches no game state. Called out at the
        // line, as the audio noise buffer's Math.random is.
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      gl.deleteQuery(query);
      return null;
    },
  };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'frame-budget-under-the-check-29-load',
    spec: 'Section 2 / check 29',
    name: 'Smoke, flashbang, sustained gunfire and a ragdoll at once, frame timed',
    run: async (h) => {
      const problems = [];
      const notes = [];
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      const { shade, warden, gadgets, effects, combat } = h;

      // Site A, the Turbine Hall: the brightest, busiest room on the map, and
      // the one with the most geometry in frame. Benchmarking on the empty
      // apron would measure an empty skybox.
      const siteA = h.map.sites[0];
      shade.reset({ position: siteA.position, yaw: 0 });
      h.stepFrames(20);

      // The Warden needs a clear stand with line of sight to the Shade, or it
      // will never hold ENGAGE and there is no gunfire to measure.
      const W = CONFIG.warden;
      const torso = { x: shade.position.x, y: shade.feetY + 1.2, z: shade.position.z };
      const half = { x: W.radius, y: W.standHeight / 2, z: W.radius };
      let stand = null;
      for (let radius = 6; radius <= 16 && !stand; radius += 2) {
        for (let i = 0; i < 24 && !stand; i++) {
          const angle = (i / 24) * Math.PI * 2;
          const floorY = siteA.position.y;
          const centre = {
            x: torso.x + Math.sin(angle) * radius,
            y: floorY + half.y + 0.05,
            z: torso.z + Math.cos(angle) * radius,
          };
          const eyeAt = { x: centre.x, y: floorY + W.standHeight * W.eyeHeightRatio, z: centre.z };
          if (h.map.collision.lineOfSight(eyeAt, torso) && h.map.collision.isClear(centre, half)) {
            stand = { x: centre.x, y: floorY, z: centre.z };
          }
        }
      }
      if (!stand) return { pass: false, detail: 'no clear stand with line of sight to site A' };
      warden.reset({ position: stand, yaw: 0 });
      warden.lookAt(shade.position);
      // Exactly one step to settle it onto the floor. More and PATROL walks it
      // off the stand and out of line of sight before the window even opens.
      h.stepFrames(1);
      const pinned = warden.position.clone();

      // The smoke goes to one side of the firing line rather than onto the
      // Shade. Section 9.1 has smoke block AI sight *entirely*, so a cloud on
      // the target is a cloud that stops the gunfire — the two halves of check
      // 29 only coexist when the smoke is somewhere else in the room, which is
      // also where a real one gets thrown.
      const toShade = {
        x: shade.position.x - pinned.x,
        z: shade.position.z - pinned.z,
      };
      const span = Math.hypot(toShade.x, toShade.z) || 1;
      const aside = GA.smoke.radius * 1.9;
      const near = {
        x: shade.position.x + (-toShade.z / span) * aside,
        y: shade.feetY + 1.4,
        z: shade.position.z + (toShade.x / span) * aside,
      };

      // 1. Smoke — the real gameplay cloud AND its 200 sprites. Registering
      //    only the effect gives no sprites; emitting only the event gives
      //    sprites that block nothing. Check 29 wants both halves.
      gadgets.effects.add({ type: 'smoke', at: near, radius: GA.smoke.radius, duration: GA.smoke.duration });
      h.emitter.emit('gadget:detonate', { type: 'smoke', at: near });
      // 2. Flashbang. Blinding the player but not the AI, which is a state
      //    Section 9.1 models explicitly — the AI is only blinded if it had
      //    line of sight to the detonation. It matters here because a blinded
      //    AI stops shooting, and check 29 wants the gunfire and the whiteout
      //    at the same time. The rendering cost is identical either way; the
      //    difference is one boolean the AI reads.
      gadgets.effects.add({
        type: 'flashbang', at: near, duration: GA.flashbang.duration,
        blindsAI: false, blindsPlayer: true,
      });
      // 3. A ragdoll tumbling. The Shade's body, not the Warden's — the Warden
      //    has to stay upright to provide the gunfire.
      shade.ragdolled = true;
      shade.mesh.position.set(shade.position.x, shade.feetY, shade.position.z);
      effects.ragdoll(shade.mesh, { x: 0.7, z: 0.7 });

      const smokeSprites = effects.pooledSprites;
      if (smokeSprites < GA.smoke.spriteCap / GA.smoke.count) {
        problems.push(`only ${smokeSprites} smoke sprites in the air`);
      }
      if (gadgets.effects.of('smoke').length === 0) problems.push('no smoke effect was registered');
      // The cloud must be real but off the firing line, or there is no gunfire.
      const wardenEye = { x: pinned.x, y: warden.eyeY, z: pinned.z };
      if (gadgets.blocksSight(wardenEye, torso)) {
        problems.push('the smoke landed across the firing line, so nothing could shoot');
      }
      if (gadgets.playerBlindFraction() <= 0) problems.push('the flashbang was not whiting out the screen');
      if (effects.ragdolls.length === 0) problems.push('no ragdoll was tumbling');

      // 4. Sustained gunfire. The gun is AI-driven in competitive — the human
      //    trigger deliberately does not reach it (Section 12) — so the load is
      //    made by holding the AI in ENGAGE and cancelling its burst pauses.
      //    Section 11's 3-7 round bursts are the *typical* case; check 29 asks
      //    for the sustained one, which is the trigger held down at 600rpm.
      const wardenAI = h.wardenAI;
      combat.weapon.reset();
      const holdTheTrigger = () => {
        // God mode, as the Section 17.1 `G` command gives. Four body shots kill
        // a Shade (Section 8.1), so without this the target dies a third of a
        // second into the window, perception drops it, and the gunfire — the
        // thing being measured — stops.
        shade.health = CONFIG.shade.health;
        // Pinned to its stand: ENGAGE seeks cover between bursts, which by
        // design breaks line of sight and stops the firing. Check 29 is a
        // worst case, so the Warden is held where it can shoot.
        warden.position.copy(pinned);
        warden.velocity.set(0, 0, 0);
        warden.lookAt(shade.position);
        wardenAI.lastKnown = { x: shade.position.x, y: shade.feetY, z: shade.position.z };
        if (wardenAI.state !== 'engage') wardenAI._enter('engage');
        wardenAI._burstPause = 0;
        wardenAI._burstRemaining = PERF.benchmarkFrames;
        // Unlimited ammo for the window: a reload is a pause in the load, and
        // check 29 is about the loud part, not the quiet part.
        if (combat.weapon.magazine === 0 || combat.weapon.reloading) combat.weapon.reset();
      };

      // The flashbang has to stay lit for the whole window, so it is topped up
      // rather than thrown once and allowed to expire mid-measurement.
      const keepFlashLit = () => {
        if (gadgets.effects.of('flashbang').length > 0) return;
        gadgets.effects.add({
          type: 'flashbang', at: near, duration: GA.flashbang.duration,
          blindsAI: false, blindsPlayer: true,
        });
      };

      const renderer = h.renderer;
      const timer = gpuTimer(renderer);
      const frameMs = [];
      let peakCalls = 0;
      let peakTriangles = 0;
      let peakSprites = smokeSprites;
      let peakEffects = 0;

      // Warm-up frames are discarded: the first draw of a new material compiles
      // a shader, which is a real cost but not a per-frame one.
      for (let i = 0; i < PERF.benchmarkWarmupFrames; i++) {
        holdTheTrigger();
        keepFlashLit();
        h.renderFrame();
      }

      const shotsAtStart = combat.shots;
      let gpuMs = null;
      if (timer) timer.begin();
      for (let i = 0; i < PERF.benchmarkFrames; i++) {
        holdTheTrigger();
        keepFlashLit();
        const started = performance.now();
        h.renderFrame();
        frameMs.push(performance.now() - started);
        peakCalls = Math.max(peakCalls, h.debugState.drawCalls || 0);
        peakTriangles = Math.max(peakTriangles, h.debugState.triangles || 0);
        peakSprites = Math.max(peakSprites, effects.pooledSprites);
        peakEffects = Math.max(peakEffects, effects.activeCount + gadgets.effects.count);
      }
      if (timer) {
        timer.end();
        const total = await timer.read();
        if (total !== null) gpuMs = total / PERF.benchmarkFrames;
      }
      const shotsFired = combat.shots - shotsAtStart;
      const cpuMedian = median(frameMs);
      const cpu95 = percentile(frameMs, 0.95);
      const budget = PERF.frameBudgetMs;
      const cpuCeiling = budget * PERF.cpuBudgetFraction;

      // The load has to have actually been under way while it was timed.
      if (shotsFired < PERF.stressRounds) {
        problems.push(`only ${shotsFired} rounds fired during the window`);
      }
      if (peakSprites < GA.smoke.spriteCap / GA.smoke.count) {
        problems.push(`smoke thinned to ${peakSprites} sprites during the window`);
      }

      // Section 15's caps must hold under exactly this load — this is the
      // moment they exist for.
      if (peakSprites > GA.smoke.spriteCap) {
        problems.push(`${peakSprites} sprites exceeded the ${GA.smoke.spriteCap} cap`);
      }
      if (effects.particles.length !== CONFIG.effects.particlePoolSize) {
        problems.push(`the particle pool grew to ${effects.particles.length}`);
      }
      if (effects.footprints.length !== CONFIG.effects.footprintPoolSize) {
        problems.push(`the footprint pool grew to ${effects.footprints.length}`);
      }

      // The budget. CPU only: the GPU number is reported when the driver gives
      // one, but it is this machine's GPU, not the target's.
      //
      // **And asserted only where the clock can price a draw** (H41). The two
      // lines below are built either way, so the numbers reach the reader
      // whichever runner is asking; what the parameter decides is whether they
      // are a verdict. One reader for that, `tests/timedrenders.js`'s, so the
      // gate and the bench cannot come to two answers about it.
      const priced = timedVerdictAsked(typeof location !== 'undefined' ? location.search : '');
      const over = [];
      if (cpuMedian > cpuCeiling) {
        over.push(
          `CPU frame ${cpuMedian.toFixed(2)}ms is over the ${cpuCeiling.toFixed(2)}ms ceiling `
          + `(${(PERF.cpuBudgetFraction * 100)}% of the ${budget.toFixed(2)}ms budget for ${PERF.targetFps}fps)`
        );
      }
      if (gpuMs !== null && cpuMedian + gpuMs > budget) {
        over.push(`CPU ${cpuMedian.toFixed(2)}ms + GPU ${gpuMs.toFixed(2)}ms exceeds the ${budget.toFixed(2)}ms budget`);
      }
      if (priced) problems.push(...over);
      else if (over.length) {
        // Over budget on a clock that cannot price a draw is still worth
        // saying, and saying loudly: it is a submission that got expensive,
        // which is a real regression about something other than a frame rate.
        notes.push(`not asserted on this clock (H41): ${over.join('; ')}`);
      }
      if (gpuMs === null) notes.push('no GPU timer (EXT_disjoint_timer_query_webgl2 unavailable or disjoint)');

      // Nothing may have gone non-finite or fallen through the floor under load.
      const failuresBefore = h.debugTools.assertionFailures;
      h.stepFrames(60);
      if (h.debugTools.assertionFailures !== failuresBefore) {
        problems.push('runtime assertions failed during the stress load');
      }

      // And it must all drain. Section 17's assertion is specifically about
      // gadget effects and the sprite pool returning to zero — footprints from
      // an AI that is still walking around are not a leak, so they are not
      // counted here.
      shade.ragdolled = false;
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.stepFrames(Math.ceil((GA.smoke.duration + 2) / CONFIG.time.fixedDt));
      if (gadgets.effects.count !== 0) {
        problems.push(`${gadgets.effects.count} gadget effects still active after the load drained`);
      }
      if (effects.pooledSprites !== 0) problems.push(`${effects.pooledSprites} smoke sprites never expired`);
      if (effects.ragdolls.length !== 0) problems.push(`${effects.ragdolls.length} ragdolls never froze`);

      const gpuText = gpuMs !== null ? `, GPU ${gpuMs.toFixed(2)}ms` : '';
      // Which of the two the budget is, in the line a reader actually reads.
      const budgetPhrase = priced
        ? `against a ${budget.toFixed(2)}ms budget`
        : `beside a ${budget.toFixed(2)}ms budget (reported, H41)`;
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${PERF.benchmarkFrames} frames with ${peakSprites} smoke sprites, a live flashbang, a ragdoll `
            + `and ${shotsFired} rounds: CPU ${cpuMedian.toFixed(2)}ms median / ${cpu95.toFixed(2)}ms p95${gpuText} `
            + `${budgetPhrase}; peak ${peakCalls} draw calls, `
            + `${peakTriangles} triangles, ${peakEffects} live effects; pools held and drained to 0`
            + (notes.length ? ` [${notes.join('; ')}]` : '')
          : problems.join('; '),
      };
    },
  });
}
