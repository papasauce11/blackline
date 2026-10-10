/**
 * BLACKLINE - tests/positionreads.js
 *
 * The census H43 took, and the instruments it took it with: every module under
 * `src/tests/` that reads a world position off a drawn body, how many frames
 * of the position chase separate that read from the state change before it,
 * why the lag does or does not reach what the module asserts - and the eight
 * small readers and drivers `positioncensus.js`'s clauses are written in.
 *
 * A sibling rather than a block inside the check, for the reason H42 moved the
 * sampling statistics out of `soak.js`: the check with its table and its
 * instruments came to **672 lines of a 600 allowance**, and the part of it that
 * is about its own subject came out whole. `tests/breathdrawn.js` owns H39's
 * table beside H33's check for the same reason, and
 * `tests/viewpointsamples.js` owns H36's wording and its statistics together,
 * which is the shape this one copies.
 *
 * Nothing here is imported by anything but `positioncensus.js`, which holds
 * every entry below against the live tree - both ways, so a module that starts
 * reading a world position is red until it is classified. The argument for
 * each entry is in that module's header and in PROGRESS.md's H43.
 */

import * as THREE from 'three';
import { positionSmoothing } from '../entities/pose.js';

/**
 * The criterion for being in the census: a module that reads a world position
 * off a drawn body - a `getWorldPosition` off a part or the camera, a
 * `mesh.position`, a `cameraRig.position`. A grep for the three is the whole
 * of it, which is what makes the list checkable rather than a matter of
 * opinion (breathcensus.js's rule).
 */
export const READS_A_WORLD_POSITION = /getWorldPosition|mesh\.position|cameraRig\.position/;

/**
 * And the criterion for advancing the chase, which is the other half of every
 * entry below: `updateVisual` directly, or `renderFrame`, which is `main.js`'s
 * own frame and calls it for both bodies. The harness's `stepFrames` is not in
 * here, and that is the measured fact six of these entries rest on.
 */
export const ADVANCES_THE_CHASE = /updateVisual|renderFrame/;

/** The expression a body may not carry its own copy of: the chase law itself. */
export const THE_LAW = /Math\.pow\(0\.0001/;

/**
 * Every module under `src/tests/` that reads a world position off a drawn
 * body, with what the lag does to its thinnest clause. `reach` is one of:
 *
 *   held      the module deals with the chase explicitly - it waits for it, or
 *             it snaps it - and `how` says which
 *   measured  reached, measured, and the numbers are in PROGRESS.md's H43
 *   none      structurally out of reach, by one of the six proofs below
 *
 * `frames` is the frames-since-state-change column the queue asked for, in
 * frames of `updateVisual`; `-` where no state change the chase could be
 * chasing happens inside the check at all. `reads` names the expression the
 * entry is about, so a clause that moves makes the census red in the same diff
 * rather than ageing in a comment (timedrenders.js's rule); `control` names the
 * clause that keeps a cancellation from being vacuous where the entry rests on
 * one; and `snapper` names the expression a `snaps` entry closes its own gap
 * with, because proving that a reset leaves no gap does not say that this
 * module took one.
 */
export const CENSUS = [
  {
    module: 'hang.js',
    reach: 'held',
    how: 'waits',
    frames: '150',
    reads: /SETTLE_FRAMES/,
    note: 'the one module that waits on purpose. Both glove clauses read `|gloveY - lip|` 150 frames after the grab - 3.3 of the chase\'s own settle, argued from `positionSmoothing()` rather than from a copy of 45 - and `the-hang-pose-has-arrived-before-the-glove-is-read` holds the count against the law. It is also where the chase was found: the shipped clause read at thirty frames, 9mm under where the body was going, and that was H38\'s missing centimetre (H40)',
  },
  {
    module: 'look.js',
    reach: 'measured',
    frames: '0-30, and all twelve states read with the gap open',
    reads: /chooseEye\(world, actor\.mesh\.position, actor\.yaw\)/,
    note: 'anchors the eye and the focus on `actor.mesh.position` at the frame the strike arrived, deliberately and in its own header. Measured: all twelve states read with the gap open, worst `landing` at 0.794m, the moving states deeper than the climbs and only `hang` (0.014m) and `crouch` (0.004m) settled. Both the eye and the focus come from the same read, so the lag moves camera and subject together and the pixel floors are about a body the right size in the right part of the frame; what it can still reach is which of six eyes is in open air and what occludes the body from it. The table is in PROGRESS.md. **H46 measured that residual and it is not zero**: the lag changes the chosen eye on three state-map pairs, every one a climb - the plant\'s `vault` (0.43m, front-left where the capsule says front-right) and the yard\'s `mantle` (0.40m, right against front-right) and `pullup` (0.49m, left against front-left). Nine of twelve states agree on both maps. It is a census (`the-position-chase-moves-one-pose-photograph-eye-and-this-is-which`) and not a fix: choosing off the drawn body is correct for a photograph of the drawn body, so what the flip costs is the angle and H52 is the fix if one is wanted',
  },
  {
    module: 'poseeye.js',
    reach: 'held',
    how: 'reads both',
    frames: '0, the frame the strike arrived',
    reads: /shade\.mesh\.position\.x, y: shade\.mesh\.position\.y/,
    note: 'the one module whose subject **is** the gap: it reads the drawn feet and the capsule\'s feet off the same frame and runs `look.js`\'s `chooseEye` against each, so the lag is not something it has to deal with - it is the quantity. `held` by `reads both` rather than by waiting or snapping. Its own instrument is held two ways: the gaps agree with H43\'s table to the millimetre on both maps, and a clause requires ten of the twelve states to carry a gap over 0.05m, so a tree where the chase has been snapped cannot pass it. The one arithmetic trap is in TRAPS.md and cost this job an hour - `position` is a capsule centre and `mesh.position` is feet, so `feetY` is the comparison and subtracting the raw vectors adds half a height to every gap',
  },
  {
    module: 'grabslide.js',
    reach: 'measured',
    frames: '1 to 15 from the grab',
    reads: /shade\.mesh\.position\.y/,
    control: /the grab lifted the capsule/,
    note: 'the one module whose clause is **about** the gap rather than exposed to it (H44). It drives whole frames at a hangable ledge and pins the drop at frames 1, 6, 10 and 15 - 0.80m to 0.04m - because `PLAYTEST.md` and D72 quote those numbers to a human and a shortened smoothing should send them back to be measured rather than quietly make them wrong. Its control is the one every entry here needs: the capsule must really have risen half a metre, or the profile is a table about a body standing still',
  },
  {
    module: 'animation.js',
    reach: 'held',
    how: 'snaps',
    frames: '60 and 70, after a snap',
    reads: /end\.getWorldPosition\(/,
    snapper: /warden\.reset\(\{ position: rest, yaw: lane\.yaw \}\)/,
    note: 'reads the Warden\'s rifle-hand world height at the carry and through the sights, and asserts the difference of the two. Both readings are sixty-odd frames after a `reset()`, which copies `position` into `_smoothPosition` and then draws with a `wallDt` of 0 - the law answers 1 to that, so there is no gap left to close - and the sights are a pose change that does not move the capsule at all',
  },
  {
    module: 'breathcensus.js',
    reach: 'held',
    how: 'snaps',
    frames: '1, after a snap',
    reads: /h\.camera\.getWorldPosition\(/,
    snapper: /shade\._smoothPosition\.copy\(shade\.position\)/,
    note: 'lifts the body a metre to prove the camera follows it at all, and copies `position` into `_smoothPosition` on both sides of the lift before drawing - so the camera it reads is at the body\'s new height and not 86cm under it. The one module that already handled this chase, written for a different one',
  },
  {
    module: 'camerasettings.js',
    reach: 'none',
    proof: 'paired',
    frames: 'every frame of a sprint',
    reads: /b\.camY - a\.camY/,
    control: /it is not presentation only/,
    note: 'reads the camera\'s world height every frame of a 150-frame sprint, where the chase lags a moving capsule the whole way - and takes the bob as the difference between two frame-matched runs of that sprint with the setting off and on. The lag is identical in both, so it cancels frame for frame, and the check asserts the two capsule tracks agreed to 1e-9 before reading the difference, which is the control the cancellation needs',
  },
  {
    module: 'feel.js',
    reach: 'none',
    proof: 'sameframe',
    frames: '1',
    reads: /cameraRig\.position\.y - \(shade\.mesh\.position\.y/,
    note: 'the camera dip is `cameraRig.position.y - (mesh.position.y + camera.up)` with the pitch zeroed, and both terms are written from `_smoothPosition` in one frame: the rig\'s pivot is `_smoothPosition.y - half.y + up + _dip + bob` and the mesh\'s is `_smoothPosition.y - half.y`, so the difference is the dip and the bob exactly, however far the chase has got',
  },
  {
    module: 'warden.js',
    reach: 'none',
    proof: 'sameframe',
    frames: '-',
    reads: /bodyPosition\.distanceTo\(outlinePosition\)/,
    note: 'subtracts an outline\'s world position from that of the mesh it is parented to, in one frame, for every pair on both bodies. The cancellation H39 found for the breath, one layer out: whatever the chase has done to the group, it has done to both halves of the pair',
  },
  {
    module: 'deathcam.js',
    reach: 'none',
    proof: 'frozen',
    frames: '-',
    reads: /bodyBefore/,
    note: 'reads the body\'s x and z before and after a free-look and asserts they did not move. Its own check calls neither `updateVisual` nor `renderFrame`, so the drawn body cannot move between the two reads - which is also the hole the census reports rather than fixes: the clause catches a direct write to the mesh and would not see free-look move the capsule. H47',
  },
  {
    module: 'presentation.js',
    reach: 'none',
    proof: 'frozen',
    frames: '-',
    reads: /frozen\.distanceTo\(mesh\.position\)/,
    note: 'drives a ragdoll with `effects.step(dt)` alone and reads the Warden\'s mesh position for the floor it sank to and for the freeze. Nothing in that check advances the chase, so the controller never writes the transform the ragdoll owns',
  },
  {
    module: 'visual.js',
    reach: 'none',
    proof: 'ragdoll',
    frames: '-',
    reads: /shade\.mesh\.position\.distanceTo\(settled\)/,
    note: 'reads the dead Shade\'s mesh position for the tumble and the freeze, and is out of reach twice over (H39\'s phrase for the same shape): `updateVisual` returns before writing position or rotation while `ragdolled` is set, and the reads are bracketed by `stepFrames` either way',
  },
  {
    module: 'feedback.js',
    reach: 'none',
    proof: 'relative',
    frames: '1',
    reads: /camera\.getWorldPosition\(/,
    control: /applyQuaternion\(camera\.getWorldQuaternion/,
    note: 'builds a world point six metres along one of the camera\'s own axes, out of the camera\'s world position and its world quaternion together - so the point is in the frame of the camera it came from and the chase moves the two as one. What it asserts off that point is a vignette and a damage direction, both screen-space',
  },
  {
    module: 'performance.js',
    reach: 'none',
    proof: 'writes',
    frames: '-',
    reads: /shade\.mesh\.position\.set\(/,
    note: 'the one module that **writes** the drawn position and reads none: it snaps the mesh to the capsule\'s feet before ragdolling the body for the check-29 load, because a ragdolled body\'s `updateVisual` returns early and would never bring it there. Every clause in that check is a count, a cap or a pool',
  },
];

/** The reasons a read is out of reach of the chase, each held by the census. */
export const PROOFS = {
  paired: 'the quantity is a difference between two frame-matched runs of one motion',
  sameframe: 'the quantity is a difference of two reads in one frame, carrying the same lag twice',
  frozen: 'nothing in the check advances the chase between its reads',
  ragdoll: 'the ragdoll owns the mesh and updateVisual returns before writing it',
  relative: 'the read is used in the frame of the camera it came from',
  writes: 'the module writes the drawn position and reads none',
};

/**
 * The ways a module may deal with the chase rather than be out of reach of it.
 *
 * `waits` and `snaps` were H43's two: close the gap by waiting for it, or close
 * it by assignment. **H46 added the third**, which is not a way of closing the
 * gap at all - `reads both` is a module whose subject *is* the gap, so it takes
 * the drawn end and the capsule end off the same frame and compares them.
 * Clause 4 of `positioncensus.js` holds `snaps` against `reset()` and clause 5
 * holds `waits` against the law; `reads both` is held by the entry naming the
 * expression that takes both reads, and by the module's own floor on how many
 * states must carry a gap - a tree with the chase snapped fails it, which is
 * the same shape of guarantee from the other side.
 */
export const HOWS = ['waits', 'snaps', 'reads both'];

/** Read a file from the origin the way breathcensus.js and timedrenders.js do. */
export async function text(origin, rel) {
  const response = await fetch(`${origin}${rel}`);
  if (!response.ok) return { error: `${rel}: ${response.status}` };
  return { body: await response.text() };
}

/**
 * A module's text with its comment lines taken out, decided line-locally and
 * never by parsing - timedrenders.js's stripper, used here for the same reason
 * it exists there and for one of its own.
 *
 * The reason it exists there: an explanation is not an ask, so a comment
 * naming a parameter must not satisfy a clause about the code asking for it.
 * The reason this check needs it: every clause below greps for an expression a
 * module is **not** allowed to carry any more, and the first run of this census
 * reported `enforcer.js` for a copy of the chase law that was in the comment
 * saying it used to have one. A census that reds on its own explanation is a
 * census about prose.
 */
export function code(body) {
  return body.replace(/^[\t ]*(\/\/|\/\*|\*).*$/gm, '');
}

/**
 * One registered check's own text: from its id to the next one in the file. A
 * file-wide grep is too coarse for `frozen` - both modules it covers render
 * frames in other checks of the same file.
 */
export function checkSlice(source, id) {
  const at = source.indexOf(`id: '${id}'`);
  if (at < 0) return null;
  const next = source.indexOf("id: '", at + 6);
  return source.slice(at, next < 0 ? source.length : next);
}

/** How far the drawn body still is from the capsule, in metres. */
export function chaseGap(actor) {
  return actor.position.distanceTo(actor._smoothPosition);
}

/** Frames for the chase to leave `fraction` of a displacement, from the law itself. */
export function framesToClose(fraction, wallDt) {
  const keep = 1 - positionSmoothing(wallDt);
  return Math.ceil(Math.log(fraction) / Math.log(keep));
}

/** Put the drawn body `metres` under the capsule and leave the lag in flight. */
export function openTheGap(actor, metres) {
  actor._smoothPosition.set(actor.position.x, actor.position.y - metres, actor.position.z);
}

/** Draw `frames` frames of 60Hz through one body, the simulation untouched. */
export function draw(actor, frames) {
  for (let i = 0; i < frames; i++) actor.updateVisual(1 / 60);
}

/** The first mesh on a body that carries an inverted-hull outline, as warden.js finds them. */
export function hulledMesh(actor) {
  let found = null;
  actor.mesh.traverse((object) => {
    if (found || !object.isMesh) return;
    const hull = object.children.find((child) => child.isMesh && child.material.side === THREE.BackSide);
    if (hull) found = { body: object, hull };
  });
  return found;
}
