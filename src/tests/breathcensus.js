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
 * arm inside the body group the breath lifts: it passed at the worst phase, so
 * what it wanted was a bound, and **H38 built it and corrected this census's
 * own number doing it** - the `hang.js` row below carries both readings. The
 * lesson is H34's in another currency: **a sweep inherits whatever its first
 * sample inherited**, and here that was a transient rather than a phase.
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
 * What this module does not cover: twelve modules read a body off a frame they
 * rendered rather than posing one themselves, and those inherit the run's
 * phase too. H33 declared them and measured none; **H39 classified them**, in
 * `tests/breathdrawn.js`, which owns that table and the five proofs that cover
 * it - two measured, ten out of reach, and the gait reaching none of them
 * because every body in that group stands. The list is imported from there so
 * it cannot be kept twice, and the census below is still held both ways, so a
 * new module in either group is red until it is classified.
 *
 * **Since H53 the two criteria read code and not prose** (`tests/sourcetext.js`
 * owns the reader), and one of them grew a proxy. The criteria below say what
 * the raw read cost and what it hid. H96 moved the fetch to `moduletexts.js`.
 *
 * Registered from tests/index.js beside tests/breath.js (Section 3.1).
 */

import { moduleText } from './moduletexts.js';
import { CONFIG } from '../config.js';
import { POSE } from '../entities/agentvisual.js';
import { QUALITY_FALLBACK, pixelRatioNow } from '../quality.js';
import { createLens, quiesce } from './pixels.js';
import { standAndEyes, flatShadeSilhouette, HOOD_OVER_NECK } from './figure.js';
import { DRAWN } from './breathdrawn.js';
import { codeOf } from './sourcetext.js';
import { poseProxies, classify, criterionProblems, PROXY_HOME } from './posecriterion.js';
import { countByWord, addsUp, REACHES } from './censustally.js';

const SELF = 'every-check-that-poses-a-body-declares-what-the-breath-and-the-gait-do-to-it';

/**
 * The modules that drive `updateVisual` to prove things ABOUT an ease rather
 * than to read a clause off a posed body, and are excluded from the census for
 * that reason. Each is held below to still be driving it, so an exclusion
 * cannot come to cover a module that proves nothing.
 *
 * `positioncensus.js` is here since H43: it drives the frame to measure the
 * **position chase**, the third ease that survives nothing, and its own table
 * is the census of who reads a world position off a drawn body.
 */
const OWN_FILES = ['breathcensus.js', 'breathdrawn.js', 'positioncensus.js'];

/** The breath's own period, from the look table rather than a number copied out of it. */
const BREATH_SECONDS = (2 * Math.PI) / POSE.breath.rate;

/**
 * **The criterion lives in `posecriterion.js`** (H61). A module is in `POSED`
 * if its **code** drives the pose - `updateVisual`, or anything a module under
 * `src/tests/` exports that makes that call on its behalf, which is a **set the
 * tree decides** rather than a name in a regex. H53 wrote `strike` into one and
 * said so; H61 found the tree holds **five such names in three modules** and
 * that the membership they decide is identical, so the criterion changed and
 * the census did not. That module carries the argument, the discovery and the
 * two instruments under it, and it is its own file because a census is worth
 * exactly what its membership rule is worth and this one's has been wrong twice.
 */

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
    note: 'pixel-count floors only, and until H57 the gait rather than the breath was what moved them: the walk and sprint poses read 7,891-9,818px and 8,065-9,788px against a floor of 3,000, where every other pose moved 1-5%. `strike` pins the gait\'s phase now, so what is left in those two is the breath, the same as every other pose - read at 8,119px and 8,167px on the plant and 9,607px and 8,151px on the yard, the walk\'s from the other front eye (H57 moved which one, and poseeye.js declares it). The five-eye check moves 1.1% and its thinnest eye reads 877-887px over 300',
  },
  {
    module: 'poseeye.js',
    reach: 'none',
    proof: 'root',
    note: 'poses all twelve strike states and asserts nothing about any body part: every clause reads `mesh.position` or `position`, the drawn body\'s root and the capsule, and runs `chooseEye` off them. The breath writes group rotations and a torso lift and **never reaches `mesh.position`** (H39\'s finding, which this is the first entry to rest on), and the gait moves limbs rather than the root - so neither phase can move an eye candidate placed off it. Its readings are the proof as well as the claim: the twelve gaps agree with H43\'s table to the millimetre on both maps, and H43 took them without a breath in them either',
  },
  {
    module: 'strikerepeat.js',
    reach: 'none',
    proof: 'root',
    note: 'strikes all twelve states twice and compares the two **capsules** - `h.shade.position`, and nothing else in the check reads a body at all. Neither phase can reach it, on `poseeye.js`\'s proof one layer simpler: the breath writes group rotations and a torso lift and never reaches the root (H39), and the gait moves limbs rather than the root. That is why this check can assert agreement to **1e-9** rather than to a tolerance, and it is the reason all twelve undeclared states agree at all - what the gait reached was `strike`\'s own termination, which is the finding the check existed for (H52) and is about where a strike stops rather than about where a body part is drawn - and since **H57** it does not reach even that: the walk and the sprint run a pinned count of frames from the lane, the declared set is empty, and all twelve states land inside 1e-9m. What the check holds now is that nothing has grown the dependence back',
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
 * one. They inherit the run's phase exactly as the list above does, and H33
 * declared them without measuring any - **H39 classified them**, so the list
 * lives in `tests/breathdrawn.js` beside the proofs that cover it and is read
 * from there rather than kept twice. This module still holds the one clause
 * that needs both lists: a module that renders a frame and is in neither is
 * unclassified, which is the hole a census exists to report.
 */
const ALSO_DRAWN = DRAWN.map((entry) => entry.module);

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
    census: true,
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
      const index = (await moduleText(origin, 'src/tests/index.js')).body;
      const files = [...index.matchAll(/import \{ register as \w+ \} from '\.\/([a-z0-9]+\.js)';/g)].map((m) => m[1]);
      if (files.length < 50) {
        return { pass: false, detail: `tests/index.js imports ${files.length} modules; the suite is 50+` };
      }
      const declared = new Map(POSED.map((entry) => [entry.module, entry]));
      const alsoDrawn = new Set(ALSO_DRAWN);
      // The second half of the criterion, read off the tree rather than written
      // down (H61): every name a module under src/tests/ exports that poses a
      // body on a caller's behalf. Its own problems come back with it - the
      // discovery's table, and whether the enumeration saw the tree at all.
      const proxies = await poseProxies(origin);
      problems.push(...proxies.problems);
      // The proxy the criterion has rested on since H53, in the file that has
      // held it since H75 (`PROXY_HOME`, next door with the criterion). If it
      // stops contributing one, every module that poses through `strike` and
      // calls `updateVisual` nowhere falls out of this census in silence.
      if (!proxies.entries.some((e) => e.module === PROXY_HOME)) {
        problems.push(`the proxy set is [${proxies.names.join(', ') || 'empty'}] and ${PROXY_HOME} is not in it; its frame makes the call and its strike reaches it, so a discovery that cannot see them is not reading this tree`);
      }
      const poseWord = classify(proxies.names);
      // The criteria's own instrument before the census is believed (H53).
      problems.push(...criterionProblems(proxies.names));

      const poses = [];
      const renders = [];
      for (const file of files) {
        // Code and not prose (H53). `tests/deathcam.js` is the live proof of
        // this line: its two sentences name both calls and it makes neither,
        // and between H47 and H53 it could not spell either word.
        const code = (await moduleText(origin, `src/tests/${file}`)).code;
        const word = poseWord(code);
        if (word === 'poses') poses.push(file);
        else if (word === 'renders') renders.push(file);
      }
      for (const file of poses) {
        // The three census modules drive the pose to prove things ABOUT the
        // two phases rather than to read a clause off a posed body, so they
        // are excluded by name - and the clause below holds that they stay
        // out, because a census that declares itself is a census of one
        // thing. (`positioncensus.js` drives it through `strike`, which is
        // why H53's stripped read dropped it until the proxy was added, and
        // why H61 reads the proxies off the tree instead of naming one.)
        if (OWN_FILES.includes(file)) continue;
        if (!declared.has(file)) problems.push(`${file} poses a body and this census does not declare it; what the breath and the gait do to its thinnest clause is the whole point of the list`);
      }
      for (const entry of POSED) {
        if (!poses.includes(entry.module)) problems.push(`${entry.module} is declared here (${entry.reach}) and its code calls neither updateVisual nor any of the ${proxies.names.length} proxies (${proxies.names.join(', ')}); drop it from POSED`);
      }
      for (const file of renders) {
        if (!alsoDrawn.has(file)) problems.push(`${file} renders a frame and is in neither list; classify it in POSED or ALSO_DRAWN (H39 is the group that is declared and unmeasured)`);
      }
      for (const file of ALSO_DRAWN) {
        if (!renders.includes(file)) problems.push(`${file} is in ALSO_DRAWN and no longer renders a frame of its own; drop it`);
      }
      // The three census modules are in neither list: they drive the pose to
      // prove things about it, which is not reading a clause off a posed body.
      // Named so the exclusion is deliberate rather than an oversight nobody
      // can see, and each held to still be driving it.
      for (const own of OWN_FILES) {
        if (declared.has(own)) problems.push(`${own} declares itself; it proves the mechanism rather than reading a clause off it`);
        if (alsoDrawn.has(own)) problems.push(`${own} is in the drawn table; it proves the mechanism rather than reading a clause off it`);
        if (!poses.includes(own)) problems.push(`${own} drives neither updateVisual nor any of the ${proxies.names.length} proxies any more, so its proofs are not reading a body that moved`);
      }

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
        readings.push(`reset keeps breath ${breathBefore.toFixed(2)}s + gait ${gaitBefore.toFixed(2)}, clears dip`);

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
            readings.push(`1m of body moves the camera ${(lifted - before).toFixed(2)}m, a breath <${STILL}m`);
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
          readings.push(`the Warden's chest <${STILL}m at ${warden.speed.toFixed(2)} m/s`);
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
            readings.push(`the ${NEAR}m hood holds ${low}px over ${HOOD_PHASES} phases, worst ${worst.toFixed(2)}x of ${HOOD_OVER_NECK}x`);
          }
        }
      } finally {
        restore();
        shade.reset(h.map.shadeSpawns[0]);
      }

      // The line's own arithmetic (H60). Its total is the set the tree was
      // **found** to pose a body in and its three classes are the set this
      // table **declares** - fifteen against a tally of twelve, for the three
      // census modules excluded by name above - so the sentence names the
      // difference and both sums are held: a fourth class or a fourth
      // exclusion is what a reader of a total and a breakdown cannot see.
      const tally = countByWord('the pose census', POSED, REACHES);
      problems.push(...tally.problems, ...addsUp('the pose census', poses.length, { declared: POSED.length, 'excluded by name': OWN_FILES.length }));
      const { held, measured, none } = tally.counts;
      return {
        pass: problems.length === 0,
        // H91: the proxies are a roster and go beside the line, not in it.
        detail: problems.length === 0
          ? `${poses.length} pose a body: ${POSED.length} declared (${held} held at the worst phase, ${measured} measured, ${none} by proof), ${OWN_FILES.length} excluded; `
            + `${renders.length} render one (H39). ${readings.join('; ')}; `
            + `${proxies.names.length} proxies off ${proxies.scanned} modules in --details`
          : problems.join('; '),
        roster: proxies.entries.map((e) => `${e.module.replace('.js', '')}.${e.name}`),
      };
    },
  });
}
