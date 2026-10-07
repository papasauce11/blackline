/**
 * BLACKLINE - tests/breathcensus.js
 *
 * Two phases survive a reset, and this is the census of what they reach (H33).
 *
 * H31 found the mechanism behind a reading that moved between two runs of one
 * suite: `updateVisual` runs on the **wall clock from the render frame**, never
 * from `fixedStep`, and `Agent.reset()` deliberately leaves the breath's phase
 * alone - so the phase any check reads is a function of how many frames the
 * whole run drew before it. It fixed one instance (`tests/breath.js` holds the
 * two thin figure clauses at the worst of eight phases) and left the obvious
 * question: **which other checks read a posed body at whatever phase the run
 * arrived in, and is any of their clauses near a margin?**
 *
 * H33 measured it rather than guessing, over eight phases of the 6.98s breath,
 * on both maps. Three things came out of it.
 *
 * **One: there are two phases, not one.** `_animTime`, the gait, has exactly
 * the same property - advanced from the render frame by `updateVisual` (by the
 * ground covered, so only while walking), zeroed in the constructor and
 * **not** by `reset()`. It is the bigger lever: the breath moves a pixel count
 * by 1-3%, and the gait moves `a-look-at-a-pose-photographs-the-state-named`'s
 * walk and sprint frames by **24%** (7,891-9,818px against a floor of 3,000),
 * because a leg at the top of its swing is a different silhouette from a leg
 * under the body. Both are in this census and both are proved below.
 *
 * **Two: almost nothing is near a margin, and the numbers are in the table.**
 * The one clause the breath spends real margin on is `tests/hang.js`'s, and it
 * is the one the detail-diff instrument was blind to - a passing check's
 * numbers are not in its detail line at all (TRAPS.md), so it had to be
 * measured directly. `|gloveY - lip| <= 0.15m`, where the glove hangs off an
 * arm inside the body group the breath lifts: over eight phases the offset ran
 * **-0.021m to +0.055m, a span of 0.075m - half the tolerance**. It passed on
 * the worst phase, so it wanted nothing done; what it wanted was bounding,
 * which is the state the two figure clauses were in before H31. **H38 built
 * that bound, and corrected this number in the process**: read from a settled
 * pose the offset runs **-0.014m to +0.066m** and the margin is **2.26x**, not
 * the 2.75x recorded here, because the hang pose was still easing when this
 * census read it (the arm's angle arrives by frame 30, the pose's contribution
 * to the glove's height is still moving 0.009m between frames 30 and 120). The
 * breath's own ride agrees either way, and a dense sweep of all 419 frames of a
 * cycle puts it at 0.080m - twice `POSE.breath.lift` to the millimetre. The
 * lesson is the one H34 left in a different currency: **a sweep inherits
 * whatever its first sample inherited**, and here that was a transient rather
 * than a phase.
 *
 * **Three: most of the suite cannot be reached at all, for four structural
 * reasons, and this check proves each one** rather than asserting it in prose:
 *
 *   - **The Warden does not breathe.** `enforcer.js` sets `pose.lift` from the
 *     walk bob only, so it is zero at a stand. Every Warden reading in
 *     `tests/figure.js`'s second check held to the pixel across all eight
 *     phases, which is the measurement agreeing with the code.
 *   - **The camera never reads the breath.** Its pivot is
 *     `_smoothPosition.y - half.y + cam.up + _dip + bob` (agentvisual.js) and
 *     `pose.lift` is not in it, which is why `tests/camerasettings.js` and
 *     `tests/feel.js` are out of reach.
 *   - **The breath is a position, not a rotation.** It moves the body group's
 *     `position.y`; `tests/animation.js` compares poses over a list of
 *     rotations with no `lift` in it, and `tests/scuff.js` reads an arm angle.
 *   - **A difference taken inside the group cancels it.** `tests/warden.js`'s
 *     outline drift subtracts two world positions in the same group.
 *
 * Each of those is a behavioural clause below, and each carries the second half
 * HANDOFF.md demands of a check that picks its own inputs: the camera is first
 * shown to follow the body at all, and the rotations and the Warden are read
 * against a Shade whose lift is shown to have moved in the same window. A
 * clause that only ever asserts "this number did not change" passes just as
 * well when nothing is connected.
 *
 * What it does not cover, said plainly: thirteen modules read a body off a
 * frame they rendered rather than posing one themselves, and those inherit the
 * run's phase too. They are declared in `ALSO_DRAWN` and **none of them is
 * measured** - that is **H39**, not a claim made here. The census is held both
 * ways so a new module in either group is red until it is classified.
 *
 * Registered from tests/index.js beside tests/breath.js. Nothing here imports
 * main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { POSE } from '../entities/agentvisual.js';
import { QUALITY_FALLBACK, pixelRatioNow } from '../quality.js';
import { createLens, quiesce } from './pixels.js';
import { standAndEyes, flatShadeSilhouette, HOOD_OVER_NECK } from './figure.js';

const SELF = 'every-check-that-poses-a-body-declares-what-the-breath-and-the-gait-do-to-it';

/** This module's own file, excluded from the census it holds. */
const OWN_FILE = 'breathcensus.js';

/** The breath's own period, from the look table rather than a number copied out of it. */
const BREATH_SECONDS = (2 * Math.PI) / POSE.breath.rate;

/**
 * The criterion for being in `POSED`: a module that drives the pose itself.
 * A grep for the one call is the whole of it, which is what makes the census
 * checkable rather than a matter of opinion.
 */
const POSES_A_BODY = /updateVisual/;

/** And for `ALSO_DRAWN`: a module that renders a frame and reads what is in it. */
const RENDERS_A_FRAME = /renderFrame/;

/**
 * Every module under `src/tests/` that poses a body, what the two phases do to
 * its thinnest clause, and the reading that says so. `reach` is one of:
 *
 *   held      the module sweeps the cycle and asserts the worst phase
 *   measured  reached, measured here, and this far from its bar
 *   none      structurally out of reach, by one of the four proofs below
 *
 * A `none` entry names its proof in `proof`, so a reason that stops being true
 * turns a clause red rather than ageing quietly in a comment.
 */
const POSED = [
  {
    module: 'breath.js',
    reach: 'held',
    note: 'sweeps eight phases itself and asserts the worst; its per-phase readings rotate between runs and its asserted worst did not move at any entry phase, which is the control for this whole census (H31)',
  },
  {
    module: 'figure.js',
    reach: 'measured',
    note: 'the 25m hood-over-neck pair is held at the worst phase by breath.js. The rest is wide: 8m count 2,996-3,089 over a 2,000 floor, 8m aspect 3.5-3.6 over 2.2, 25m count 345-359 over 150, 25m aspect 3.3-3.4 over 2.2. The 8m neck reads 10 to 14px under a hood that read 28px in all 64 readings H34 took on both maps - 2.00x at worst against 1.5x. H33 read 10-12 and recorded 2.33x here from eight phases on one map, and H34 corrected it: eight phases is too coarse at 8m',
  },
  {
    module: 'smallwindow.js',
    reach: 'measured',
    note: 'reports the hood and neck and asserts neither (H29). What it asserts moves little against wide bars: the count 116-121 over a floor of 51 at the smallest buffer, and the aspect 2.9-3.0 over 2.2 there and 3.4-3.6 at the reference',
  },
  {
    module: 'look.js',
    reach: 'measured',
    note: 'pixel-count floors only. The gait, not the breath, is what moves them: the walk and sprint poses read 7,891-9,818px and 8,065-9,788px against a floor of 3,000, where every other pose moves 1-5%. The five-eye check moves 1.1% and its thinnest eye reads 877-887px over 300',
  },
  {
    module: 'bufferscale.js',
    reach: 'measured',
    note: 'the count at 8m moves 3.3% at each of three pixel ratios, and the scaling law it asserts is a ratio BETWEEN those counts, so the common part cancels: measured 1.7% of spread against a 10% tolerance',
  },
  {
    module: 'hang.js',
    reach: 'held',
    note: 'the thinnest in the suite, and the detail line did not carry it. H38 gave it a second check that sweeps the cycle, asserts the worst phase and holds the glove\'s own ride absolutely as the control. It also corrected this line: read from a settled pose |gloveY - lip| runs -0.014m to +0.066m, not the -0.021m to +0.055m recorded here, because the hang pose was still easing when this census read it. The ride agrees (0.080m) and the margin is 2.26x, not 2.75x',
  },
  {
    module: 'animation.js',
    reach: 'none',
    proof: 'rotations',
    note: 'compares poses over a list of eleven rotations with no `lift` in it, so a body group that has moved vertically reads identical. Its one world-height reading (the rifle hand) is the Warden\'s, which does not breathe either',
  },
  {
    module: 'scuff.js',
    reach: 'none',
    proof: 'rotations',
    note: 'reads an arm angle during the hands-up pose, and a simulation position for where the scuff sounded',
  },
  {
    module: 'camerasettings.js',
    reach: 'none',
    proof: 'camera',
    note: 'reads the camera\'s world height, and takes the difference of two runs on top of that',
  },
  {
    module: 'feel.js',
    reach: 'none',
    proof: 'camera',
    note: 'reads speeds, step counts and the camera\'s landing dip',
  },
];

/**
 * The modules that read a body off a frame they rendered rather than posing
 * one. They inherit the run's phase exactly as the list above does, and
 * **none of them has been measured** - H39. Declared so the census is complete
 * about its own scope rather than quiet about it.
 */
const ALSO_DRAWN = [
  'briefing.js', 'debuggate.js', 'feedback.js', 'fuzz.js', 'groundview.js',
  'performance.js', 'plantrule.js', 'presentation.js', 'quality.js',
  'qualityhold.js', 'sitetint.js', 'visual.js',
];

/** Rotations the breath must not touch: animation.js's own list, by the parts both meshes name. */
const LIMBS = ['head', 'armL', 'armR', 'legL', 'legR'];

/** A metre this check calls "did not move". A float eased toward a constant settles well inside it. */
const STILL = 1e-4;

/**
 * The vertical ride H33 measured the table's numbers at: twice
 * `POSE.breath.lift`, 0.080m to the millimetre, read off the torso group over
 * one whole cycle.
 *
 * Asserted **absolutely** and not as a fraction of the constant, which is the
 * difference between a clause and a tautology: the first draft required the
 * ride to be at least half of `2 * POSE.breath.lift`, so setting that constant
 * to zero would have satisfied it with a body that does not breathe - and
 * every "out of reach" proof below would then have been trivially true about a
 * mechanism that no longer existed. If the breath's amplitude moves, this goes
 * red and the margins in the table above want measuring again, which is the
 * right outcome and not an obstacle.
 */
const MEASURED_RIDE = 0.08;
const RIDE_TOLERANCE = 0.02;

/** The two distances figure.js reads at, and the phases this samples the near hood over. */
const NEAR = 8;
const FAR = 25;
const HOOD_PHASES = 8;

/** The body group of a built figure, and the height the pose lifts it from. */
function bodyGroup(actor) {
  const parts = actor.mesh.userData.parts;
  // The Shade's is the torso and the Warden's the chest; both carry `baseY`.
  return parts.torso || parts.chest || null;
}

/** Drive one whole breath through a body the way a frame does, and report what moved. */
function overOneBreath(actor, read) {
  const frames = Math.round(BREATH_SECONDS * 60);
  const seen = [read()];
  for (let i = 0; i < frames; i++) {
    actor.updateVisual(1 / 60);
    seen.push(read());
  }
  const low = Math.min(...seen);
  const high = Math.max(...seen);
  return { low, high, span: high - low };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: SELF,
    spec: 'Section 4 / H31, H33',
    name: 'Every module that poses a body declares what the breath and the gait do to its thinnest clause, and the four reasons a clause is out of reach are each proved rather than asserted',
    run: async (h) => {
      const origin = location.origin;
      const problems = [];
      const readings = [];

      // ------------------------------------------------------------------
      // 1. The census is the whole of both groups, both ways. Read from the
      //    registrar's own import list, as tests/registry.js reads it, so a
      //    module added to the suite is in this census the day it lands.
      // ------------------------------------------------------------------
      const index = await (await fetch(`${origin}/src/tests/index.js`)).text();
      const files = [...index.matchAll(/import \{ register as \w+ \} from '\.\/([a-z0-9]+\.js)';/g)].map((m) => m[1]);
      if (files.length < 50) {
        return { pass: false, detail: `tests/index.js imports ${files.length} modules; the suite is 50+` };
      }
      const declared = new Map(POSED.map((entry) => [entry.module, entry]));
      const alsoDrawn = new Set(ALSO_DRAWN);
      const poses = [];
      const renders = [];
      for (const file of files) {
        const text = await (await fetch(`${origin}/src/tests/${file}`)).text();
        if (POSES_A_BODY.test(text)) poses.push(file);
        else if (RENDERS_A_FRAME.test(text)) renders.push(file);
      }
      for (const file of poses) {
        // This module drives `updateVisual` to prove things ABOUT the two
        // phases rather than to read a clause off a posed body, so it is
        // excluded by name - and the clause below holds that it stays out,
        // because a census that declares itself is a census of one thing.
        if (file === OWN_FILE) continue;
        if (!declared.has(file)) problems.push(`${file} poses a body and this census does not declare it; what the breath and the gait do to its thinnest clause is the whole point of the list`);
      }
      for (const entry of POSED) {
        if (!poses.includes(entry.module)) problems.push(`${entry.module} is declared here (${entry.reach}) and no longer calls updateVisual; drop it from POSED`);
      }
      for (const file of renders) {
        if (!alsoDrawn.has(file)) problems.push(`${file} renders a frame and is in neither list; classify it in POSED or ALSO_DRAWN (H39 is the group that is declared and unmeasured)`);
      }
      for (const file of ALSO_DRAWN) {
        if (!renders.includes(file)) problems.push(`${file} is in ALSO_DRAWN and no longer renders a frame of its own; drop it`);
      }
      // This module is in neither: it drives updateVisual to prove things about
      // it, which is not reading a clause off a posed body. Named so the
      // exclusion is deliberate rather than an oversight nobody can see.
      if (declared.has(OWN_FILE)) problems.push(`${OWN_FILE} declares itself; it proves the mechanism rather than reading a clause off it`);
      if (!poses.includes(OWN_FILE)) problems.push(`${OWN_FILE} no longer drives updateVisual, so none of the four proofs below is reading a body that moved`);

      const { shade, warden } = h;
      const restore = quiesce(h);
      try {
        // ----------------------------------------------------------------
        // 2. Two phases, and reset() clears neither. D66 refused zeroing them
        //    with reasons (it would make the suite repeatable without making
        //    it thorough, and change how a reinserted body looks), so this
        //    holds that refusal: a job that changes it changes this line too,
        //    in the same diff.
        // ----------------------------------------------------------------
        // The camera follows a body only while that body owns it, and the
        // suite leaves the ownership wherever the last check put it - so the
        // camera clause below read a camera parented to nothing until this
        // line existed. The check caught that itself, which is the second half
        // HANDOFF.md asks for doing its job.
        h.initMatch({ mode: 'competitive', role: 'shade', ai: false, objective: false });
        h.setCameraOwner('shade');
        shade.reset(h.map.shadeSpawns[0]);
        h.stepFrames(5);
        // **Walked, not merely drawn.** The gait's phase advances by the
        // ground covered and only inside `updateVisual`, so a body that was
        // only ever drawn standing still leaves `_animTime` at 0 - and then
        // "reset() did not move it" is 0 === 0 and proves nothing. Driven
        // through the held key and one `updateVisual` a step, which is how a
        // frame runs and how animation.js drives its own gait.
        h.input.heldCodes.add('KeyW');
        for (let i = 0; i < 40; i++) {
          h.stepFrames(1);
          h.input.clearEdges();
          shade.updateVisual(1 / 60);
        }
        h.input.clearAll();
        for (let i = 0; i < 40; i++) shade.updateVisual(1 / 60);
        const breathBefore = shade._breathTime;
        const gaitBefore = shade._animTime;
        shade._dip = -0.2;
        shade.reset(h.map.shadeSpawns[0]);
        if (shade._breathTime !== breathBefore) problems.push(`reset() moved the breath's phase from ${breathBefore.toFixed(3)} to ${shade._breathTime.toFixed(3)}; this census and tests/breath.js both rest on it surviving (D66)`);
        if (shade._animTime !== gaitBefore) problems.push(`reset() moved the gait's phase from ${gaitBefore.toFixed(3)} to ${shade._animTime.toFixed(3)}`);
        // And the control: reset DOES clear what it means to clear, so the two
        // above are a deliberate exception and not a reset that does nothing.
        if (shade._dip !== 0) problems.push(`reset() left the camera dip at ${shade._dip}; then it clears nothing and the two phases above prove nothing`);
        if (breathBefore <= 0) problems.push('the breath never advanced, so nothing here was measured');
        if (gaitBefore <= 0) problems.push('the gait never advanced, so "reset() did not move it" is 0 === 0 and says nothing; the body has to be walked and not merely drawn');
        readings.push(`reset keeps breath ${breathBefore.toFixed(2)}s + gait ${gaitBefore.toFixed(2)}, clears the dip`);

        // ----------------------------------------------------------------
        // 3. What the breath moves on the Shade, over one whole cycle: the
        //    body group's height, by about twice the lift. Every clause below
        //    is read in a window where this moved, so "did not change" is a
        //    fact about that quantity and not about a body nobody animated.
        // ----------------------------------------------------------------
        const shadeBody = bodyGroup(shade);
        if (!shadeBody) {
          problems.push('the Shade exposes no torso group, so there is nothing to read the lift off');
        } else {
          const lift = overOneBreath(shade, () => shadeBody.position.y);
          const want = 2 * POSE.breath.lift;
          if (Math.abs(lift.span - MEASURED_RIDE) > RIDE_TOLERANCE) {
            problems.push(`over a whole breath the Shade's torso moved ${lift.span.toFixed(4)}m against the ${MEASURED_RIDE}m this census measured its table at; every margin in POSED above wants re-measuring, and the four proofs below are about a breath of a different size`);
          }
          if (lift.span < want * 0.5) {
            problems.push(`the torso moved ${lift.span.toFixed(4)}m of the ${want.toFixed(3)}m \`POSE.breath.lift\` asks for; the lift is configured and not reaching the body`);
          }
          readings.push(`torso rides ${lift.span.toFixed(3)}m of ${BREATH_SECONDS.toFixed(2)}s`);

          // Proof `rotations`: the breath is a position. Every limb rotation
          // holds still through the same cycle that moved the torso.
          const parts = shade.mesh.userData.parts;
          const strays = [];
          for (const limb of LIMBS) {
            const part = parts[limb];
            if (!part) { problems.push(`the Shade has no ${limb} to read`); continue; }
            const swing = overOneBreath(shade, () => part.rotation.x);
            if (swing.span > STILL) strays.push(`${limb} by ${swing.span.toFixed(5)} rad`);
          }
          const torsoSwing = overOneBreath(shade, () => shadeBody.rotation.x);
          if (torsoSwing.span > STILL) strays.push(`the torso by ${torsoSwing.span.toFixed(5)} rad`);
          if (strays.length) {
            problems.push(`a whole breath turned ${strays.join(', ')}; animation.js and scuff.js read rotations and are declared out of reach because it does not`);
          }

          // Proof `camera`: the pivot has no `pose.lift` in it. The second
          // half first - the camera must be following this body at all, or
          // the clause is about a camera nobody attached.
          const camY = () => { const v = h.camera.getWorldPosition(h.shade.mesh.position.clone()); return v.y; };
          const before = camY();
          const wasY = shade.position.y;
          shade.position.y = wasY + 1;
          shade._smoothPosition.copy(shade.position);
          shade.updateVisual(1 / 60);
          const lifted = camY();
          shade.position.y = wasY;
          shade._smoothPosition.copy(shade.position);
          shade.updateVisual(1 / 60);
          if (!(lifted - before > 0.5)) {
            problems.push(`a metre of body moved the camera ${(lifted - before).toFixed(3)}m, so the camera is not following this body and the breath clause below is vacuous`);
          } else {
            const cam = overOneBreath(shade, camY);
            if (cam.span > STILL) {
              problems.push(`a whole breath moved the camera ${cam.span.toFixed(5)}m; camerasettings.js and feel.js read the camera and are declared out of reach because it does not`);
            }
            readings.push(`1m of body moves the camera ${(lifted - before).toFixed(2)}m, a breath under ${STILL}m`);
          }
        }

        // ----------------------------------------------------------------
        // 4. Proof `warden`: the Warden does not breathe. `pose.lift` is its
        //    walk bob, which is zero at a stand - so every Warden reading in
        //    figure.js's second check is phase-free, and the measurement
        //    agreed, holding to the pixel across all eight phases.
        // ----------------------------------------------------------------
        warden.reset({ position: h.map.shadeSpawns[0].position, yaw: 0 });
        const wardenBody = bodyGroup(warden);
        if (!wardenBody) problems.push('the Warden exposes no chest group');
        else {
          for (let i = 0; i < 40; i++) warden.updateVisual(1 / 60);
          const still = overOneBreath(warden, () => wardenBody.position.y);
          if (still.span > STILL) {
            problems.push(`standing, the Warden's chest moved ${still.span.toFixed(5)}m over a breath; it is declared not to breathe (enforcer.js sets pose.lift from the walk bob)`);
          }
          if (Math.abs(warden.speed) > 0.2) {
            problems.push(`the Warden was moving at ${warden.speed.toFixed(2)} m/s, so a still chest says nothing - the bob is zero only at a stand`);
          }
          readings.push(`the Warden's chest inside ${STILL}m at ${warden.speed.toFixed(2)} m/s`);
        }

        // ----------------------------------------------------------------
        // 5. The 8m hood does not move, which is what the widest margin in
        //    the suite actually rests on (H34).
        //
        //    `the-shade-reads-as-a-hooded-figure-at-8m-and-25m` reads the 8m
        //    hood over the 8m neck at one arbitrary phase, and the neck there
        //    wanders: over 32 phases on each map H34 read **10 to 14px**,
        //    where H33's eight phases on one map had read 10 to 12 and
        //    recorded 2.33x of margin. Eight is too coarse at 8m - the band is
        //    ten rows deep and the breath is worth about three of them, so the
        //    extremes are rare there, where at 25m a worst-case neck turns up
        //    in six samples of eight and `tests/breath.js` can assert it from
        //    eight. The real worst is **2.00x** (28/14, on the yard).
        //
        //    So the clause that belongs here is not the ratio - a dense sweep
        //    of it costs 64 readings - but the **invariance of the hood**,
        //    which is why the ratio is safe at any phase and which eight
        //    phases is ample to catch moving. The hood read 28px at every one
        //    of H34's 64 readings on both maps. If it ever starts riding the
        //    breath the way the neck does, the 8m margin is a product of two
        //    moving numbers instead of one and wants measuring again.
        // ----------------------------------------------------------------
        const where = standAndEyes(h, FAR);
        if (!where) {
          problems.push(`no stand on this map with a clear lane and ${FAR}m of sight, so the 8m hood was not read`);
        } else {
          // The lane's own yaw, which is what that check uses; breath.js and
          // figure.js's second check face the eye instead, a different and
          // easier question.
          shade.reset({ position: where.stand, yaw: where.lane.yaw });
          h.stepFrames(5);
          const lens = createLens(h, { pixelRatio: pixelRatioNow(undefined, QUALITY_FALLBACK) });
          const frames = Math.max(1, Math.round((BREATH_SECONDS / HOOD_PHASES) * 60));
          const hoods = [];
          const ratios = [];
          try {
            for (let phase = 0; phase < HOOD_PHASES; phase++) {
              for (let i = 0; i < frames; i++) shade.updateVisual(1 / 60);
              const shape = flatShadeSilhouette(h, lens, where, NEAR);
              if (!shape) { problems.push(`a phase read no silhouette at ${NEAR}m`); continue; }
              hoods.push(shape.hood);
              if (Number.isFinite(shape.neck) && shape.neck > 0) ratios.push(shape.hood / shape.neck);
            }
          } finally {
            lens.restore();
          }
          if (hoods.length === HOOD_PHASES) {
            const low = Math.min(...hoods);
            const high = Math.max(...hoods);
            if (low !== high) {
              problems.push(`over ${HOOD_PHASES} phases the ${NEAR}m hood read ${low}-${high}px; it held at one width in all 64 of H34's readings, and the widest margin in the suite rests on only the neck moving`);
            }
            const worst = ratios.length ? Math.min(...ratios) : 0;
            if (!(worst >= HOOD_OVER_NECK)) {
              problems.push(`the worst of ${HOOD_PHASES} phases reads a ${NEAR}m hood ${worst.toFixed(2)}x its neck, under ${HOOD_OVER_NECK}x`);
            }
            readings.push(`the ${NEAR}m hood holds at ${low}px over ${HOOD_PHASES} phases, worst ${worst.toFixed(2)}x of ${HOOD_OVER_NECK}x`);
          }
        }
      } finally {
        restore();
        shade.reset(h.map.shadeSpawns[0]);
      }

      const held = POSED.filter((e) => e.reach === 'held').length;
      const measured = POSED.filter((e) => e.reach === 'measured').length;
      const none = POSED.filter((e) => e.reach === 'none').length;
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${poses.length} pose a body: ${held} held at the worst phase, ${measured} measured, ${none} out of reach by proof; `
            + `${renders.length} render one, unmeasured (H39). ${readings.join('; ')}`
          : problems.join('; '),
      };
    },
  });
}
