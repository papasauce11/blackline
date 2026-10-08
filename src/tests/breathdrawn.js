/**
 * BLACKLINE - tests/breathdrawn.js
 *
 * The other half of the breath census (H39): the modules that read a body off
 * a frame they rendered rather than posing one.
 *
 * H33 took the census of every module that **poses** a body - a grep for
 * `updateVisual` is the whole criterion, which is what makes that list
 * checkable - and said plainly that it was not the whole of what inherits the
 * run's phase. A check that renders a frame and reads pixels out of it gets
 * whatever phase the run is at, through the same `updateVisual` call inside
 * the frame. Twelve such modules were declared in `ALSO_DRAWN` and **none was
 * measured**. This is that measurement, and the list is classified now rather
 * than merely declared: `DRAWN` below is the one source of truth and
 * `tests/breathcensus.js` reads it for its own both-ways clause.
 *
 * **Two facts about the machinery narrow the question before any measuring,
 * and both are proved below rather than asserted.**
 *
 *   - **A lens does not advance the pose.** `grab()` in `tests/pixels.js` is
 *     `h.post.render(...)` and a `readPixels`; it never calls `updateVisual`.
 *     So every grab inside one check is at **one** pose, and a difference
 *     between two grabs - which is how nearly every picture check isolates
 *     what it is about - cancels the body exactly. That is `onepose`.
 *   - **The gait reaches nothing while a body stands.** `_posture` multiplies
 *     the whole gait by `walking`, so a standing body's limbs are at rest
 *     whatever `_animTime` has reached. Every body in this group stands, so
 *     the gait - which H33 found to be the *bigger* lever on `look.js`'s walk
 *     and sprint poses, 24% of a pixel count - is out of reach of all twelve
 *     for one structural reason. That is `standing`, and it is proved once for
 *     the whole table rather than per entry.
 *
 * And one about `reset()`, which is why nothing here needed H38's settle:
 * `Agent.reset()` ends with `this.updateVisual(0)`, and `blendFactor(0)` is
 * **1**, so a reset body is re-posed at the run's current phase with the ease
 * snapped all the way to its target. A check that resets a body and then
 * reads it reads a settled pose, where H38's hang - driven into rather than
 * reset into - had a live ease on top of the breath and needed 150 frames of
 * it out of the way.
 *
 * **What is left once those apply is two clauses, and both are wide.** Over
 * eight phases on both maps:
 *
 *   - `the-shade-visibly-dims-with-the-meter` covers **18,579-19,763 pixels**
 *     against a floor of 400 (a 46x margin, moving 4-5% with the breath), and
 *     its near-black clause reads **36.7-42.8** against a bar of 90, moving
 *     less than a luma step.
 *   - `the-rim-light-is-really-on-screen` masks **7,376-8,109 pixels** against
 *     500 and brightens 4,872-5,118 of them against 200, and its real clause
 *     - the rim is an *edge* and not an ambient add - reads the silhouette
 *     **2.08x to 2.39x** the interior against a bar of 1.5. **That 2.08x is
 *     the thinnest breath-reached clause in this group, 1.39x of margin**, and
 *     the breath moves it 7%.
 *
 * So the group's answer is the opposite shape to H38's: nothing here is near a
 * margin, and the reason is not luck but that a body's own pixels are averaged
 * or counted in the thousands, where H38's glove was a single point 2m from
 * the pivot the breath turns.
 *
 * Registered from tests/index.js beside tests/breathcensus.js. Nothing here
 * imports main.js (Section 3.1).
 */

import { POSE } from '../entities/agentvisual.js';
import { quiesce } from './pixels.js';

const SELF = 'every-check-that-draws-a-body-declares-what-the-breath-and-the-gait-do-to-it';

/** The breath's own period, from the look table rather than a number copied out of it. */
const BREATH_SECONDS = (2 * Math.PI) / POSE.breath.rate;

/** A metre, or a radian, this check calls "did not move". */
const STILL = 1e-4;

/**
 * Every module under `src/tests/` that renders a frame and reads a body out of
 * it rather than posing one, what the breath does to its thinnest clause, and
 * the reading or the proof that says so. `reach` is one of:
 *
 *   measured  reached, measured here, and this far from its bar
 *   none      structurally out of reach, by the named proof
 *
 * The gait is out of reach of **every** entry by `standing`, proved once
 * below, so no entry carries a gait note. A `none` entry names the proof that
 * covers it, so a reason that stops being true turns a clause red rather than
 * ageing quietly in a comment - H30's model, and H33's.
 */
export const DRAWN = [
  {
    module: 'visual.js',
    reach: 'measured',
    note: 'one of its five clauses reads the Shade\'s own body: the dim-with-the-meter check covers 18,579-19,763px over a 400 floor across eight phases on both maps (46x, moving 4-5%) and reads near-black at 36.7-42.8 against a bar of 90, the luma being a mean over the body\'s own mask and so near-immobile. Its other four are out of reach: the lit-pools reading hides both bodies, the smoke and the alarm fixture are differences between grabs at one pose, and the death camera\'s killer is the Warden, which does not breathe',
  },
  {
    module: 'presentation.js',
    reach: 'measured',
    note: 'the rim check reads the Shade at about 4m: 7,376-8,109px masked over a 500 floor, 4,872-5,118 brightened over 200, and the clause that matters - edge over interior, so a rim is not an ambient add wearing a rim\'s name - reads 2.08x to 2.39x against 1.5. **The thinnest in this group at 1.39x**, and the breath moves it 7%. Its other six read the pause clock, the effect pools, ragdoll positions, the HUD and the menu gate, none of them a pixel of a body',
  },
  {
    module: 'feedback.js',
    reach: 'none',
    proof: 'onepose',
    note: 'all three clauses are differences between two grabs with only the feedback quad toggled - the vignette, the hit marker, the damage arc - so the body in the frame is the same body at the same pose in both and cancels exactly',
  },
  {
    module: 'sitetint.js',
    reach: 'none',
    proof: 'hidden',
    note: 'hides both bodies for the length of the reading and measures the site floor\'s channels; its other clause reads the HUD\'s text',
  },
  {
    module: 'groundview.js',
    reach: 'none',
    proof: 'hidden',
    note: 'hides both bodies and differences the overlay on and off against the floor',
  },
  {
    module: 'quality.js',
    reach: 'none',
    proof: 'nobody',
    note: 'reads the renderer\'s knobs, the probe\'s frame times and the published record; no framebuffer and no part of a posed body',
  },
  {
    module: 'qualityhold.js',
    reach: 'none',
    proof: 'nobody',
    note: 'reads the quality record and the bytes of a baked menu card, which is a fresh map in a fresh scene with no agent in it (H23)',
  },
  {
    module: 'plantrule.js',
    reach: 'none',
    proof: 'nobody',
    note: 'reads reach geometry, the charge\'s world position and the HUD\'s refusal line',
  },
  {
    module: 'briefing.js',
    reach: 'none',
    proof: 'nobody',
    note: 'reads the briefing panel\'s DOM and the setting that skips it',
  },
  {
    module: 'debuggate.js',
    reach: 'none',
    proof: 'nobody',
    note: 'asserts that every debug key does nothing with the gate down, which is an absence and has no body in it',
  },
  {
    module: 'fuzz.js',
    reach: 'none',
    proof: 'onebit',
    note: 'its one framebuffer read reduces a whole frame to a single bit - whether any pixel is non-zero at all - to tell a live context from a lost one (F1). Where a body is drawn cannot move one bit. Its other clauses read simulation state and the renderer\'s reported size',
  },
  {
    module: 'performance.js',
    reach: 'none',
    proof: 'cost',
    note: 'its one clause is a frame cost in milliseconds, and it is bench-only headless (H11): on the real GPU it clears by 3x to 6x over twelve readings. The breath moves a transform inside the body group and changes no draw call, which is what the proof reads',
  },
];

/** The proofs a `none` entry may name, each held by a clause below. */
const PROOFS = {
  onepose: 'a lens grab does not advance the pose, so a difference between two grabs cancels the body',
  hidden: 'the reading is taken with both bodies hidden',
  nobody: 'the module reads no framebuffer and no part of a posed body',
  onebit: 'the only framebuffer read is one bit - whether any pixel is lit',
  cost: 'the clause is a frame cost, and the breath changes no draw call',
};

/** What a `nobody` module's text may not contain, each pattern with what it would mean. */
const NOBODY_BANS = [
  [/readPixels/, 'reads the framebuffer'],
  [/\.grab\(\)/, 'grabs a frame through a lens'],
  [/userData\.parts/, 'reads a body\'s parts'],
  [/mesh\.rotation/, 'reads a body\'s rotation'],
  [/mesh\.position/, 'reads a body\'s drawn position'],
];

/** The body group of a built figure. Both figures carry `baseY` on theirs. */
function bodyGroup(actor) {
  const parts = actor.mesh.userData.parts;
  return parts.torso || parts.chest || null;
}

/** Render the live scene the way a lens grab does - through post, no game frame. */
function grabLive(h) {
  h.post.render(h.scene, h.camera);
}

/**
 * Put the drawn body at an exact phase of the breath: the clock to the phase
 * asked for, then one `updateVisual(0)`, whose `blendFactor(0)` is 1 and so
 * snaps the ease all the way to its target (the same thing `Agent.reset()`
 * does with it).
 *
 * **Driven to an absolute phase rather than advanced by a relative one**, and
 * the first draft of this check was the argument for it. It advanced half a
 * cycle from wherever the run arrived, which moves the body by
 * `2A * |sin(entry)|` - the full ride at a crest and **nothing at all** at a
 * crossing - so its own control fired on both maps, saying the body had moved
 * 0.0239m of a 0.04m lift and equal draw calls therefore proved nothing. It
 * was right. A proof whose window depends on the phase the run happened to
 * start at is a proof that is vacuous at two phases in eight.
 *
 * `CREST` and `TROUGH` are a whole ride apart by construction, so the clauses
 * below are the same measurement in every run.
 */
function toBreathPhase(shade, phase) {
  shade._breathTime = phase / POSE.breath.rate;
  shade.updateVisual(0);
}

const CREST = Math.PI / 2;
const TROUGH = 3 * Math.PI / 2;
/** Where the lift is zero and climbing fastest, so a few frames move it most. */
const CROSSING = 2 * Math.PI;

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: SELF,
    spec: 'Section 4 / H33, H39',
    name: 'Every module that reads a body off a frame it rendered declares what the breath does to its thinnest clause, and the four reasons such a clause is out of reach are each proved rather than asserted',
    // No `glSync`: everything here renders the live scene the suite has already
    // drawn, so no pipeline is built and there is no tail to wait for. The flag
    // is for a check that asserts on `gl.getError()` (F11, D48).
    run: async (h) => {
      const origin = location.origin;
      const problems = [];
      const readings = [];

      // ------------------------------------------------------------------
      // 1. The table is a classification and not a list: every entry is
      //    reachable, named once, and names a proof this check holds.
      // ------------------------------------------------------------------
      const seen = new Set();
      for (const entry of DRAWN) {
        if (seen.has(entry.module)) problems.push(`${entry.module} is in DRAWN twice`);
        seen.add(entry.module);
        if (entry.reach === 'measured') {
          if (entry.proof) problems.push(`${entry.module} is measured and names the proof "${entry.proof}"; a measured entry carries its numbers instead`);
          continue;
        }
        if (entry.reach !== 'none') {
          problems.push(`${entry.module} declares reach "${entry.reach}"; it is measured or none`);
          continue;
        }
        if (!PROOFS[entry.proof]) {
          problems.push(`${entry.module} names the proof "${entry.proof}", which this check does not hold`);
        }
      }
      // And every proof is used, so a clause below cannot go on proving
      // something no entry rests on - the way a stale allowance rots (H30).
      for (const name of Object.keys(PROOFS)) {
        if (!DRAWN.some((entry) => entry.reach === 'none' && entry.proof === name)) {
          problems.push(`the proof "${name}" is held below and no entry rests on it; drop it or classify something by it`);
        }
      }

      // ------------------------------------------------------------------
      // 2. Proof `nobody`, from the text, the way tests/donedef.js reads
      //    source for its line counts and its two bans: a module that reads
      //    neither the framebuffer nor any part of a posed body cannot be
      //    moved by a pose, and that is a fact about its text.
      // ------------------------------------------------------------------
      for (const entry of DRAWN) {
        if (entry.reach !== 'none' || entry.proof !== 'nobody') continue;
        const text = await (await fetch(`${origin}/src/tests/${entry.module}`)).text();
        for (const [pattern, meaning] of NOBODY_BANS) {
          if (pattern.test(text)) problems.push(`${entry.module} is declared out of reach because it reads no body, and it ${meaning} (${pattern.source})`);
        }
      }

      // Proof `hidden`, the same way: the module hides both bodies. Held from
      // the text because what is being claimed is about the whole module's
      // readings, not about one frame this check could render.
      for (const entry of DRAWN) {
        if (entry.reach !== 'none' || entry.proof !== 'hidden') continue;
        const text = await (await fetch(`${origin}/src/tests/${entry.module}`)).text();
        if (!/shade\.mesh\.visible = false/.test(text) || !/warden\.mesh\.visible = false/.test(text)) {
          problems.push(`${entry.module} is declared out of reach because it hides both bodies, and its text no longer hides them both`);
        }
      }

      // Proof `onebit`: the read is reduced to whether anything is lit.
      for (const entry of DRAWN) {
        if (entry.reach !== 'none' || entry.proof !== 'onebit') continue;
        const text = await (await fetch(`${origin}/src/tests/${entry.module}`)).text();
        if (!/some\(\(v\) => v > 0\)/.test(text)) {
          problems.push(`${entry.module} is declared out of reach because its framebuffer read is one bit, and that reduction is gone from its text`);
        }
      }

      const { shade, warden } = h;
      const restore = quiesce(h);
      try {
        h.initMatch({ mode: 'competitive', role: 'shade', ai: false, objective: false });
        shade.reset(h.map.shadeSpawns[0]);
        h.stepFrames(5);
        const body = bodyGroup(shade);
        if (!body) {
          problems.push('the Shade exposes no torso group, so there is nothing to read a pose off');
          restore();
          return { pass: false, detail: problems.join('; ') };
        }

        // ----------------------------------------------------------------
        // 3. Proof `standing`: the gait reaches nothing while a body stands,
        //    because `_posture` multiplies the whole of it by `walking`.
        //    Read across a whole gait cycle, and with the SECOND HALF first -
        //    the same limbs are shown to move when the body does walk, or
        //    "the gait changed nothing" is a fact about a gait nobody turned
        //    on rather than about standing still.
        // ----------------------------------------------------------------
        const limbs = ['legL', 'legR', 'armL', 'armR'];
        const poseOf = () => {
          const parts = shade.mesh.userData.parts;
          return limbs.map((limb) => parts[limb].rotation.x).concat([body.position.y]);
        };
        // Walked, through the held key, exactly as a player does it.
        h.input.heldCodes.add('KeyW');
        const walking = [];
        for (let i = 0; i < 48; i++) {
          h.stepFrames(1);
          h.input.clearEdges();
          shade.updateVisual(1 / 60);
          if (i % 12 === 11) walking.push(poseOf());
        }
        h.input.clearAll();
        let walkSwing = 0;
        for (let i = 0; i < limbs.length; i++) {
          const values = walking.map((p) => p[i]);
          walkSwing = Math.max(walkSwing, Math.max(...values) - Math.min(...values));
        }
        if (walkSwing < 0.05) {
          problems.push(`walking, the legs and arms swung ${walkSwing.toFixed(4)} rad in all; the gait is not reaching the body and the standing clause below would prove nothing`);
        }
        // Now standing, with `_animTime` driven right round its own cycle.
        shade.reset(h.map.shadeSpawns[0]);
        h.stepFrames(10);
        const standingAt = [];
        const gaitBefore = shade._animTime;
        for (let turn = 0; turn < 4; turn++) {
          shade._animTime = gaitBefore + turn * (Math.PI / 2);
          shade.updateVisual(0);
          standingAt.push(poseOf());
        }
        let standSwing = 0;
        for (let i = 0; i < limbs.length; i++) {
          const values = standingAt.map((p) => p[i]);
          standSwing = Math.max(standSwing, Math.max(...values) - Math.min(...values));
        }
        if (standSwing > STILL) {
          problems.push(`standing, a whole turn of the gait moved a limb ${standSwing.toFixed(5)} rad; every entry in DRAWN rests on it moving nothing`);
        }
        readings.push(`gait: ${walkSwing.toFixed(2)} rad walking, under ${STILL} standing`);

        // ----------------------------------------------------------------
        // 4. Proof `onepose`: a grab does not advance the pose. The second
        //    half again - a real frame DOES advance it - so this is a fact
        //    about grabbing rather than about a body nobody animated.
        // ----------------------------------------------------------------
        const beforeGrabs = body.position.y;
        const breathBeforeGrabs = shade._breathTime;
        for (let i = 0; i < 12; i++) grabLive(h);
        if (Math.abs(body.position.y - beforeGrabs) > STILL || shade._breathTime !== breathBeforeGrabs) {
          problems.push(`twelve grabs moved the body ${(body.position.y - beforeGrabs).toFixed(5)}m and the breath's phase by ${(shade._breathTime - breathBeforeGrabs).toFixed(4)}s; every difference-of-two-grabs clause in DRAWN rests on them moving neither`);
        }
        // From the crossing, where the lift is climbing fastest: at a crest
        // twelve frames of a 7-second cycle move the body almost nothing, and
        // "a real frame does move it" would be false for a reason that has
        // nothing to do with frames.
        toBreathPhase(shade, CROSSING);
        const beforeFrame = body.position.y;
        for (let i = 0; i < 12; i++) h.renderFrame(1 / 60);
        if (Math.abs(body.position.y - beforeFrame) <= STILL) {
          problems.push('twelve real frames moved the body less than a tenth of a millimetre from the breath\'s steepest point, so "a grab does not move it" says nothing');
        }
        readings.push(`12 grabs move the body under ${STILL}m, 12 frames move it ${Math.abs(body.position.y - beforeFrame).toFixed(4)}m`);

        // ----------------------------------------------------------------
        // 5. Proof `hidden`, behaviourally this time: with both bodies
        //    hidden the frame does not change across half a breath, and with
        //    them shown it does. The pair is the proof; the first half alone
        //    would pass on a renderer that had stopped drawing.
        // ----------------------------------------------------------------
        const renderer = h.renderer;
        const gl = renderer.getContext();
        const width = renderer.domElement.width;
        const height = renderer.domElement.height;
        const buffer = new Uint8Array(width * height * 4);
        const frame = () => {
          grabLive(h);
          gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
          return buffer.slice();
        };
        const differs = (a, b) => {
          let n = 0;
          for (let i = 0; i < a.length; i += 4) {
            if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 8) n++;
          }
          return n;
        };
        // Put the camera where it can see the body at all, by the frame's own
        // rules: the Shade's rig owns it, so a frame points it at the Shade.
        h.renderFrame(1 / 60);
        shade.mesh.visible = false;
        warden.mesh.visible = false;
        toBreathPhase(shade, CREST);
        const blindA = frame();
        toBreathPhase(shade, TROUGH);
        const blindB = frame();
        shade.mesh.visible = true;
        warden.mesh.visible = true;
        toBreathPhase(shade, CREST);
        const shownA = frame();
        toBreathPhase(shade, TROUGH);
        const shownB = frame();
        const blindMoved = differs(blindA, blindB);
        const shownMoved = differs(shownA, shownB);
        if (blindMoved !== 0) {
          problems.push(`with both bodies hidden, half a breath changed ${blindMoved} pixels; sitetint.js and groundview.js are out of reach because it changes none`);
        }
        if (shownMoved === 0) {
          problems.push('with both bodies shown, half a breath changed no pixel either, so hiding them proves nothing about this frame');
        }
        readings.push(`half a breath moves ${blindMoved}px hidden, ${shownMoved}px shown`);

        // ----------------------------------------------------------------
        // 6. Proof `cost`: the breath is a transform, so it changes no draw
        //    call - which is what a frame-budget clause is made of. Read with
        //    the body shown to have moved between the two counts.
        // ----------------------------------------------------------------
        const callsAt = () => {
          renderer.info.reset();
          grabLive(h);
          return renderer.info.render.calls;
        };
        toBreathPhase(shade, CREST);
        const liftA = body.position.y;
        const callsA = callsAt();
        toBreathPhase(shade, TROUGH);
        const liftB = body.position.y;
        const callsB = callsAt();
        // A crest and a trough are a whole ride apart, so this window is the
        // same in every run - which is the whole reason the phases above are
        // absolute. Held against one lift rather than two, so the clause is
        // about the window being real and not about the ride's exact size,
        // which breathcensus.js pins (D70).
        if (Math.abs(liftB - liftA) < POSE.breath.lift) {
          problems.push(`the body moved ${Math.abs(liftB - liftA).toFixed(4)}m between the two draw-call counts, under one lift of ${POSE.breath.lift}m, so equal counts say nothing`);
        }
        if (callsA !== callsB) {
          problems.push(`half a breath changed the draw calls from ${callsA} to ${callsB}; performance.js is out of reach because the breath moves a transform and nothing else`);
        }
        readings.push(`draw calls ${callsA} at both ends of a ${Math.abs(liftB - liftA).toFixed(3)}m lift`);
      } finally {
        shade.mesh.visible = true;
        warden.mesh.visible = true;
        h.input.clearAll();
        restore();
        shade.reset(h.map.shadeSpawns[0]);
      }

      const measured = DRAWN.filter((entry) => entry.reach === 'measured').length;
      const none = DRAWN.filter((entry) => entry.reach === 'none').length;
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${DRAWN.length} draw a body: ${measured} measured, ${none} out of reach by ${Object.keys(PROOFS).length} proofs. `
            + `Thinnest is presentation.js's rim at 2.08x of 1.5x. ${readings.join('; ')}`
          : problems.join('; '),
      };
    },
  });
}
