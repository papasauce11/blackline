/**
 * BLACKLINE - tests/positioncensus.js
 *
 * The drawn body arrives after the capsule, and this is the census of who
 * reads it on the way (H43). The table is `tests/positionreads.js`; the
 * argument, the measurements and the twelve-state table are PROGRESS.md's H43.
 *
 * H40 found the slowest ease in the project while measuring a different one.
 * `updateVisual` lerps `_smoothPosition` toward the capsule at
 * `positionSmoothing(wallDt)` - 0.1423 of the gap in a frame at 60Hz, so
 * **45 frames** to 99.9% against the pose blend's twelve - and a state change
 * that lifts the capsule a metre leaves the drawn body **9mm** out at frame
 * thirty. Two jobs in a row measured the pose and concluded about this one, so
 * the question H43 asks is H33's in a second currency: **which checks read a
 * world position off a drawn body before that body has got there?**
 *
 * **The suite cannot advance the chase by accident, and that is most of the
 * answer.** `updateVisual` is called from exactly two places outside
 * `src/tests/` - `main.js`'s render frame, and `reset()` with a `wallDt` of 0,
 * which the law answers 1 to and so snaps. The harness's `stepFrames()` runs
 * `fixedStep` and nothing else. So a check that drives a state change with
 * `stepFrames` and then reads a world position off a mesh is not reading a
 * body 9mm out; it is reading a body that **has not moved at all**, and the
 * gap is the whole displacement. Six of the twelve entries are out of reach
 * for that reason rather than for being late, and a seventh - `animation.js` -
 * is past the band because `reset()` left it no gap to close.
 *
 * **One read is inside the band, it is deliberate, and the gap is deeper than
 * nine millimetres.** `look.js`'s `photographPose` says so in its own header -
 * "nothing is stepped between the strike and the frame, so a vault is
 * photographed part way over" - and anchors its eye on `actor.mesh.position`.
 * Measured over all twelve states `strike` reaches, **all twelve read with the
 * gap open**, worst `landing` at **0.794m**; the deep ones are the states
 * where the capsule is still travelling and only `hang` (0.014m) and `crouch`
 * (0.004m) are settled. It passes on an argument this check holds against
 * `look.js`'s source rather than stating: the eye and the focus are both
 * offsets from the **same** read, so the body-to-eye geometry carries no lag
 * and the pixel floors are about a body the right size in the right part of
 * the frame. What the lag can still reach is the *surroundings* - which of six
 * candidate eyes is in open air, and what occludes the body from it - and
 * that residual is **H46**.
 *
 * **Both bodies chase and only one of them read the law.** `enforcer.js`
 * carried its own `1 - Math.pow(0.0001, wallDt)` and `agentvisual.js` a third
 * of the same expression for the camera's pull-out, which is the shape
 * `pose.js`'s own header warns about for `headBobLift`. The law lives in
 * `pose.js` now, both bodies import it, and clause 3 holds that neither
 * carries a copy.
 *
 * And one hole this census reports rather than fixes: `deathcam.js`'s
 * `free-look moved the body` clause reads `shade.mesh.position` across a
 * free-look that advances no frame, so it catches a direct write to the mesh
 * and would not see free-look move the **capsule** a mile. Nothing was
 * loosened to make the census come out; **H47** is that job.
 *
 * **What this check holds, and what it does not.** It holds the set, both
 * ways; that every entry still names a live expression; that the four
 * mechanisms the proofs rest on are real, measured on the bodies rather than
 * quoted (the law, the snap, what `stepFrames` leaves alone, and a ragdolled
 * body's silence); and, per entry, that the module still does the thing its
 * proof names - subtracts inside one frame, advances nothing between its
 * reads, takes the mesh before reading it, closes its own gap, anchors its
 * camera on the same read. What it does **not** hold is that a note is a
 * complete account of a clause: a module could grow a second world read its
 * first one's classification does not cover, and this would see only that the
 * module is declared. The same limit `breathcensus.js` has, with the same
 * answer - the entry names an expression, so the day a clause moves this goes
 * red and somebody reads the note again.
 *
 * Registered from tests/index.js beside tests/breathcensus.js and
 * tests/breathdrawn.js, which are this shape about the two phases.
 * Nothing here imports main.js (Section 3.1).
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { positionSmoothing } from '../entities/pose.js';
import { quiesce } from './pixels.js';
import { strike, STRIKES } from './animation.js';
import {
  CENSUS, PROOFS, HOWS, READS_A_WORLD_POSITION, ADVANCES_THE_CHASE, THE_LAW,
  chaseGap, checkSlice, code, draw, framesToClose, hulledMesh, openTheGap, text,
} from './positionreads.js';

const S = CONFIG.shade;

const SELF = 'every-check-that-reads-a-world-position-off-a-drawn-body-declares-how-far-that-body-has-got-there';

/** This census's own file, excluded from its own table. */
const OWN_FILE = 'positioncensus.js';

/**
 * The fraction of a displacement left when this census calls the chase
 * closed, and the multiple of that settle the queue calls "inside the band".
 * 0.1% is the fraction H40 measured 45 frames against.
 */
const CLOSED = 0.001;
const BAND_MULTIPLE = 2;

/**
 * Frames for the chase to close at 60Hz, recorded so that a change to the law
 * reds this rather than quietly moving the band every entry in the table was
 * read against.
 *
 * Asserted **absolutely** and not as a fraction of anything the law derives
 * (D70): a clause that re-derives its own bar from the constant it guards is
 * satisfied by any constant at all.
 */
const MEASURED_CHASE_FRAMES = 45;

/**
 * The event that hands a body's mesh to the ragdoll, which is what the
 * `ragdoll` proof rests on being ahead of the read.
 */
const TAKES_THE_MESH = 'combat:death';

/** A gap this census calls closed, and one it calls open, in metres. */
const CLOSED_METRES = 1e-6;
const OPEN_METRES = 0.5;

/** A quantity this census calls unmoved, in metres, and one a settled spring is within. */
const STILL = 1e-9;
const NEARLY_STILL = 1e-6;

/**
 * The worst gap, in metres, between the capsule and the drawn body at the
 * frame `look.js` reads it, over the twelve states `strike` reaches. Measured
 * at **0.794m** on both maps, for `landing`; PROGRESS.md's H43 has the whole
 * table, and nine of its twelve rows agree between the maps to the millimetre
 * because they are functions of a speed in `config.js` rather than of a ledge.
 *
 * A **ceiling** and not a floor, for the reason H38's bound is one: this
 * number wants to come down - H44 may well shorten the smoothing for a
 * traversal state change - and a census that reds when its own finding
 * improves is a census nobody can improve past. It reds the other way, when
 * the chase slows or a strike comes to read earlier, and then the table wants
 * measuring again. 1.2m is 1.5x the measured worst: a chase slowed by half
 * reds this, and a map that offers a different ledge does not (the three
 * ledge-dependent rows differ between the maps by 0.10m at most).
 */
const LOOK_GAP_CEILING = 1.2;

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: SELF,
    spec: 'Section 4 / H40, H43',
    name: 'Every module that reads a world position off a drawn body declares how many frames of the position chase separate that read from the state change before it, and the six reasons a read is out of reach are each proved rather than asserted',
    run: async (h) => {
      const origin = location.origin;
      const problems = [];
      const readings = [];

      // ------------------------------------------------------------------
      // 1. The census is the whole of the group, both ways. Read from the
      //    registrar's own import list, as breathcensus.js reads it, so a
      //    module that starts reading a world position is in this census the
      //    day it lands rather than the day somebody remembers.
      // ------------------------------------------------------------------
      const index = await text(origin, '/src/tests/index.js');
      if (index.error) return { pass: false, detail: `${index.error}; the census is read off the registrar's import list` };
      const files = [...index.body.matchAll(/import \{ register as \w+ \} from '\.\/([a-z0-9]+\.js)';/g)].map((m) => m[1]);
      if (files.length < 50) {
        return { pass: false, detail: `tests/index.js imports ${files.length} modules; the suite is 50+` };
      }
      const sources = new Map();
      const worldReaders = [];
      for (const file of files) {
        const read = await text(origin, `/src/tests/${file}`);
        if (read.error) { problems.push(read.error); continue; }
        // Comments out of every source here, once: a module that only
        // *mentions* a world read is not one, and a clause below greps for
        // expressions a module may no longer carry.
        sources.set(file, code(read.body));
        if (READS_A_WORLD_POSITION.test(sources.get(file))) worldReaders.push(file);
      }
      const declared = new Map(CENSUS.map((entry) => [entry.module, entry]));
      for (const file of worldReaders) {
        // This module reads a world position to prove things ABOUT the chase
        // rather than to read a clause off one, so it is out by name - and the
        // clause below holds that it stays out, because a census that declares
        // itself is a census of one thing (breathcensus.js's own exclusion).
        if (file === OWN_FILE) continue;
        if (!declared.has(file)) {
          problems.push(`${file} reads a world position off a drawn body and this census does not declare it; how far that body has got there is the whole point of the list`);
        }
      }
      for (const entry of CENSUS) {
        if (!worldReaders.includes(entry.module)) {
          problems.push(`${entry.module} is declared here (${entry.reach}) and no longer reads a world position; drop it from CENSUS`);
        }
      }
      if (!worldReaders.includes(OWN_FILE)) {
        problems.push(`${OWN_FILE} no longer reads a world position of its own, so the measurements below are not about a drawn body at all`);
      }
      if (declared.has(OWN_FILE)) problems.push(`${OWN_FILE} declares itself; it proves the mechanism rather than reading a clause off it`);

      // ------------------------------------------------------------------
      // 2. Every entry names a live expression, a frames column, and a reach
      //    with a proof or a `how` behind it. A stale entry is the hole a
      //    census exists to report.
      // ------------------------------------------------------------------
      for (const entry of CENSUS) {
        const source = sources.get(entry.module);
        if (!source) { problems.push(`${entry.module} is in the census and was not served`); continue; }
        if (!entry.reads.test(source)) {
          problems.push(`${entry.module} no longer reads ${entry.reads} for its census entry; the clause the entry describes has moved`);
        }
        if (entry.control && !entry.control.test(source)) {
          problems.push(`${entry.module}'s entry rests on ${entry.control} and the module no longer has it; the proof is vacuous without its control`);
        }
        if (entry.reach === 'none' && !PROOFS[entry.proof]) {
          problems.push(`${entry.module} is out of reach by proof "${entry.proof}", which is not one of the ${Object.keys(PROOFS).length} this check holds`);
        }
        if (entry.reach === 'held' && !HOWS.includes(entry.how)) {
          problems.push(`${entry.module} is held by "${entry.how}", which is not one of ${HOWS.join(' or ')}`);
        }
        if (!entry.frames) problems.push(`${entry.module} has no frames-since-state-change column`);
      }

      // Proof `frozen` is the one a file-wide grep cannot hold: both modules
      // it covers render frames in other checks of the same file. So it is
      // held against the entry's own check, sliced out of the source by its id.
      const live = new Set(h.debugTools._autoTests.map((test) => test.id));
      for (const entry of CENSUS) {
        if (entry.proof !== 'frozen') continue;
        const source = sources.get(entry.module);
        if (!source) continue;
        const ids = [...source.matchAll(/id: '([a-z0-9-]+)'/g)].map((m) => m[1]);
        const owning = ids.filter((id) => {
          const slice = checkSlice(source, id);
          return slice && entry.reads.test(slice);
        });
        if (owning.length !== 1) {
          problems.push(`${entry.module}: ${owning.length} of its checks hold ${entry.reads}, so the slice the frozen proof is about is not one check`);
          continue;
        }
        if (!live.has(owning[0])) problems.push(`"${owning[0]}" holds ${entry.module}'s frozen read and no module registers it`);
        if (ADVANCES_THE_CHASE.test(checkSlice(source, owning[0]))) {
          problems.push(`${entry.module}'s "${owning[0]}" is declared frozen and now advances the chase inside itself; the drawn body moves between its reads and the entry wants re-measuring`);
        }
      }

      // Proof `writes`: every mention of the drawn position in that module is
      // a write. A module that starts reading one is a census entry of a
      // different kind, and this is the clause that says so.
      for (const entry of CENSUS) {
        if (entry.proof !== 'writes') continue;
        const source = sources.get(entry.module);
        if (source && /mesh\.position(?!\.set\()/.test(source)) {
          problems.push(`${entry.module} is declared to write the drawn position and read none, and now reads one; classify it`);
        }
      }

      // Proof `ragdoll`, the half the mechanism does not say. Clause 7 proves
      // that a ragdolled body's `updateVisual` writes nothing; it does not say
      // that the module's reads are really under one. `visual.js` kills the
      // Shade with `combat:death` and the ragdoll takes the mesh there, so a
      // read taken BEFORE that emit would be of a live body the chase still
      // owns - and would pass clause 7 and every clause above it.
      for (const entry of CENSUS) {
        if (entry.proof !== 'ragdoll') continue;
        const source = sources.get(entry.module);
        if (!source) continue;
        const owned = source.indexOf(TAKES_THE_MESH);
        const read = source.search(entry.reads);
        if (owned < 0) {
          problems.push(`${entry.module} is out of reach by the ragdoll and nothing in it emits ${TAKES_THE_MESH}; the mesh it reads is one the chase still owns`);
        } else if (owned > read) {
          problems.push(`${entry.module} reads the drawn position before the ragdoll takes it (${read} against ${owned}); the entry's proof is about a body the chase still owns`);
        }
      }

      // And proof `snaps`, the same half: clause 5 proves `reset()` leaves no
      // gap, and this holds that the two modules declared by it really close
      // the gap themselves rather than inheriting whatever the run left.
      for (const entry of CENSUS) {
        if (entry.how !== 'snaps') continue;
        const source = sources.get(entry.module);
        if (source && !entry.snapper.test(source)) {
          problems.push(`${entry.module} is declared to snap the chase and no longer does it with ${entry.snapper}; its readings are at whatever gap the run arrived with`);
        }
      }

      // And the argument the one `measured` entry rests on, held against its
      // source rather than stated in prose: the eye and the focus are both
      // offsets from the single read of the drawn body, which is what makes
      // the body-to-eye geometry lag-free however deep the gap is. A draft
      // that anchored the eye on `actor.position` and the focus on the mesh
      // would read a camera aimed off the body by the whole lag, and would
      // still pass every clause above.
      const lookSource = sources.get('look.js');
      if (lookSource) {
        for (const anchored of [/y: feet\.y \+ EYE/, /y: feet\.y \+ FOCUS/]) {
          if (!anchored.test(lookSource)) {
            problems.push(`look.js no longer builds ${anchored} off the one read of the drawn body; its entry is argued on the eye and the subject carrying the same lag`);
          }
        }
      }

      // The one module that waits holds its own count against the law, in its
      // own check, which is what makes `waits` more than a number in a table.
      if (!live.has('the-hang-pose-has-arrived-before-the-glove-is-read')) {
        problems.push('hang.js\'s arrival check is not registered, so nothing holds the settle the `waits` entry rests on');
      }
      const hangSource = sources.get('hang.js');
      if (hangSource && !/positionSmoothing/.test(hangSource)) {
        problems.push('hang.js does not read positionSmoothing, so its settle is argued from a copy of 45 rather than from the law');
      }

      // ------------------------------------------------------------------
      // 3. One law, one home, and both bodies read it. `pose.js`'s own header
      //    says why for the head bob - two copies is how the Shade's camera
      //    and the Warden's come to disagree - and the chase was in exactly
      //    that state until H43, with a copy in `enforcer.js` and a third of
      //    the same expression in `agentvisual.js`'s camera pull-out.
      // ------------------------------------------------------------------
      const pose = await text(origin, '/src/entities/pose.js');
      if (pose.error) problems.push(`${pose.error}; it is the law's home`);
      else if (!/export function positionSmoothing/.test(code(pose.body))) {
        problems.push('pose.js does not export positionSmoothing; the chase law has moved and the two bodies may be reading two of them');
      }
      for (const rel of ['/src/entities/agentvisual.js', '/src/entities/enforcer.js']) {
        const body = await text(origin, rel);
        if (body.error) { problems.push(body.error); continue; }
        const source = code(body.body);
        if (!/positionSmoothing\(/.test(source)) {
          problems.push(`${rel} does not call positionSmoothing(); its body chases on a law of its own`);
        }
        if (THE_LAW.test(source)) {
          problems.push(`${rel} carries its own copy of the chase law; pose.js's header says what two copies cost`);
        }
      }

      // The law's own settle, computed rather than quoted, and recorded so a
      // slower chase reds this rather than moving the band every entry in the
      // table was read against.
      const settleFrames = framesToClose(CLOSED, 1 / 60);
      if (settleFrames !== MEASURED_CHASE_FRAMES) {
        problems.push(`the chase closes to ${CLOSED} of a displacement in ${settleFrames} frames and this census was measured at ${MEASURED_CHASE_FRAMES}; every frames column wants reading again against the new band`);
      }
      const band = BAND_MULTIPLE * settleFrames;
      readings.push(`closes ${positionSmoothing(1 / 60).toFixed(4)}/frame, ${settleFrames}f to ${CLOSED}, band ${band}f`);

      const { shade, warden } = h;
      const restore = quiesce(h);
      try {
        // ----------------------------------------------------------------
        // 4. The chase is real and the body follows the exported law, taken
        //    off the body rather than quoted: a metre of gap, drawn frame by
        //    frame, against what `positionSmoothing` predicts for that frame.
        // ----------------------------------------------------------------
        shade.pitch = 0;
        draw(shade, band);
        const keep = 1 - positionSmoothing(1 / 60);
        openTheGap(shade, 1);
        if (Math.abs(chaseGap(shade) - 1) > STILL) {
          problems.push(`the gap this check opened reads ${chaseGap(shade).toFixed(6)}m and not the metre it set`);
        }
        const curve = [];
        let worstLaw = 0;
        for (let frame = 1; frame <= band; frame++) {
          draw(shade, 1);
          worstLaw = Math.max(worstLaw, Math.abs(chaseGap(shade) - Math.pow(keep, frame)));
          if (frame === 1 || frame === 30 || frame === settleFrames) curve.push(`${frame}f ${chaseGap(shade).toFixed(4)}`);
        }
        if (worstLaw > NEARLY_STILL) {
          problems.push(`the drawn body closed a metre differently from positionSmoothing() by ${worstLaw.toFixed(9)}m at worst; the law and the body are two laws`);
        }
        if (chaseGap(shade) > CLOSED) {
          problems.push(`${settleFrames} frames left ${chaseGap(shade).toFixed(6)}m of a metre uncovered, over the ${CLOSED} the band is argued from`);
        }
        draw(shade, band);
        if (chaseGap(shade) > CLOSED_METRES) {
          problems.push(`${2 * band} frames left ${chaseGap(shade).toFixed(8)}m of a metre uncovered; nothing that waits is waiting long enough`);
        }
        readings.push(`a metre of gap: ${curve.join(', ')}`);

        // ----------------------------------------------------------------
        // 5. `stepFrames` does not advance the chase, and `reset()` snaps it.
        //    These two put six entries out of reach and a seventh past the
        //    band, so neither is left as prose. The control for the first is
        //    clause 4: the same body closed the same metre when frames were
        //    drawn through it.
        // ----------------------------------------------------------------
        openTheGap(shade, 1);
        const parked = shade._smoothPosition.clone();
        const before = shade.position.clone();
        h.stepFrames(60);
        const drawnMoved = shade._smoothPosition.distanceTo(parked);
        if (drawnMoved > STILL) {
          problems.push(`60 of stepFrames moved the drawn body ${drawnMoved.toFixed(9)}m with a metre of gap open; the frozen and snaps proofs rest on it moving none of it`);
        }
        readings.push(`60 steps: capsule ${shade.position.distanceTo(before).toFixed(3)}m, drawn ${drawnMoved.toFixed(9)}m`);

        // And the snap, on both bodies: a gap a metre open, then a reset.
        for (const [name, actor] of [['shade', shade], ['warden', warden]]) {
          openTheGap(actor, 1);
          if (chaseGap(actor) < OPEN_METRES) {
            problems.push(`${name}: the gap before the reset was ${chaseGap(actor).toFixed(3)}m, so the snap below is about nothing`);
          }
          const at = actor.position.clone();
          actor.reset({ position: { x: at.x, y: at.y - actor.half.y, z: at.z }, yaw: actor.yaw });
          if (chaseGap(actor) > STILL) {
            problems.push(`${name}: reset() left ${chaseGap(actor).toFixed(9)}m of gap; animation.js's readings are sixty frames after a reset and are out of the band because a reset leaves none`);
          }
        }

        // ----------------------------------------------------------------
        // 6. Proof `sameframe`, behaviourally and on both quantities it
        //    covers: read once settled and once with 86cm of lag still in
        //    flight. Each carries the control HANDOFF.md demands of a check
        //    that picks its own inputs - the drawn body must have moved
        //    between the two reads, or the clause passes just as well when
        //    nothing is connected.
        // ----------------------------------------------------------------
        // The pitch is zeroed because the boom then lies level and the rig's
        // height is the pivot's: feel.js zeroes it for the same reason.
        shade.pitch = 0;
        draw(shade, band);
        const dip = () => shade.cameraRig.position.y - (shade.mesh.position.y + S.camera.up);
        draw(shade, 1);
        const settledDip = dip();
        const settledMeshY = shade.mesh.position.y;
        if (Math.abs(settledDip) > NEARLY_STILL) {
          problems.push(`standing settled, the camera dip reads ${settledDip.toFixed(9)}m; the comparison below is against a dip or a bob that is doing something`);
        }
        openTheGap(shade, 1);
        draw(shade, 1);
        const laggedDip = dip();
        const bodyMoved = Math.abs(shade.mesh.position.y - settledMeshY);
        if (bodyMoved < OPEN_METRES) {
          problems.push(`the lag moved the drawn body ${bodyMoved.toFixed(3)}m, so feel.js's dip was read twice in the same place`);
        } else if (Math.abs(laggedDip - settledDip) > NEARLY_STILL) {
          problems.push(`${bodyMoved.toFixed(2)}m of lag moved the camera dip by ${(laggedDip - settledDip).toFixed(9)}m; feel.js is out of reach because the rig and the mesh are written from one smoothed position in one frame`);
        }
        readings.push(`${bodyMoved.toFixed(2)}m of lag moves the dip ${Math.abs(laggedDip - settledDip).toFixed(9)}m`);

        // The outline pair, the same way: the drift of an inverted hull from
        // the mesh it is parented to, settled and mid-flight.
        const pair = hulledMesh(shade);
        if (!pair) {
          problems.push('no mesh on the Shade carries a BackSide hull, so warden.js\'s sameframe proof cannot be held here');
        } else {
          const read = (object) => {
            shade.mesh.updateMatrixWorld(true);
            return object.getWorldPosition(new THREE.Vector3());
          };
          const drift = () => read(pair.body).distanceTo(read(pair.hull));
          draw(shade, band);
          const settledDrift = drift();
          const settledY = read(pair.body).y;
          openTheGap(shade, 1);
          draw(shade, 1);
          const laggedDrift = drift();
          const partMoved = Math.abs(read(pair.body).y - settledY);
          if (partMoved < OPEN_METRES) {
            problems.push(`the lag moved the hulled part ${partMoved.toFixed(3)}m, so the outline pair was read twice in the same place`);
          } else if (Math.abs(laggedDrift - settledDrift) > STILL) {
            problems.push(`${partMoved.toFixed(2)}m of lag moved an outline off its mesh by ${(laggedDrift - settledDrift).toFixed(9)}m; warden.js is out of reach because the pair is subtracted inside one frame`);
          }
        }

        // ----------------------------------------------------------------
        // 7. Proof `ragdoll`: while the ragdoll owns the mesh the chase does
        //    not write it - and it does the moment the ragdoll lets go, or
        //    the clause above is about a body nothing was driving.
        // ----------------------------------------------------------------
        for (const [name, actor] of [['shade', shade], ['warden', warden]]) {
          const was = actor.ragdolled;
          try {
            // Settled first, or the mesh starts where one frame of a metre's
            // gap would put it anyway and the clause reads zero for the wrong
            // reason - which is what the first run of this census did.
            draw(actor, band);
            actor.ragdolled = true;
            openTheGap(actor, 1);
            const parkedMesh = actor.mesh.position.clone();
            draw(actor, 1);
            const movedUnderRagdoll = actor.mesh.position.distanceTo(parkedMesh);
            if (movedUnderRagdoll > STILL) {
              problems.push(`${name}: a ragdolled body's updateVisual moved the mesh ${movedUnderRagdoll.toFixed(9)}m; visual.js and presentation.js read a mesh the ragdoll is meant to own`);
            }
            actor.ragdolled = false;
            draw(actor, 1);
            if (actor.mesh.position.distanceTo(parkedMesh) < 0.1) {
              problems.push(`${name}: with the ragdoll let go the chase still did not move the mesh, so the clause above is about a body nothing drives`);
            }
          } finally {
            actor.ragdolled = was;
          }
          draw(actor, band);
        }

        // ----------------------------------------------------------------
        // 8. And the one read inside the band, measured: the gap at the frame
        //    `look.js` photographs each of the twelve states `strike` reaches.
        //    `strike` is imported rather than copied, so this is the gap that
        //    check really reads and not a reconstruction of it.
        // ----------------------------------------------------------------
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
        const gaps = [];
        let unreached = 0;
        for (const state of STRIKES) {
          const struck = strike(h, state);
          if (!struck.reached) { unreached++; continue; }
          gaps.push({ state, gap: chaseGap(shade) });
        }
        if (gaps.length === 0) {
          problems.push(`none of the ${STRIKES.length} states look.js photographs was reachable on this map, so its entry is unmeasured`);
        } else {
          gaps.sort((a, b) => b.gap - a.gap);
          const worst = gaps[0];
          if (worst.gap > LOOK_GAP_CEILING) {
            problems.push(`look.js photographs ${worst.state} with the drawn body ${worst.gap.toFixed(3)}m from the capsule, past the ${LOOK_GAP_CEILING}m this census measured its entry at; the chase has slowed or a strike now reads earlier, and PROGRESS.md's table wants measuring again`);
          }
          const open = gaps.filter((entry) => entry.gap > CLOSED).length;
          readings.push(`look.js: ${open}/${gaps.length} open, worst ${worst.state} ${worst.gap.toFixed(2)}m`
            + `${unreached ? `, ${unreached} unreachable` : ''}`);
        }
      } finally {
        restore();
      }

      const held = CENSUS.filter((entry) => entry.reach === 'held').length;
      const measured = CENSUS.filter((entry) => entry.reach === 'measured').length;
      const none = CENSUS.filter((entry) => entry.reach === 'none').length;
      return {
        pass: problems.length === 0,
        // Kept short on purpose: a detail line is cut at 400 characters with
        // no ellipsis, and H42 was bitten by that cut while adding to one.
        detail: problems.length === 0
          ? `${CENSUS.length} modules read a world position off a drawn body: ${held} handle the chase, `
            + `${measured} measured, ${none} out of reach by ${Object.keys(PROOFS).length} proofs. ${readings.join('; ')}`
          : problems.join('; '),
      };
    },
  });
}
