/**
 * BLACKLINE - tests/look.js
 *
 * A look at the figures (F6): both actors on a clear lane, photographed
 * from a few eyes, as PNGs a session can read.
 *
 * The pixel checks say what a silhouette measures; they cannot say what
 * it looks like, and a scheduled run cannot open the Browser pane to see.
 * E2 wanted to see the Warden before committing it and got there from a
 * scratch script: the runner's Chrome, the page loaded once, a camera
 * placed by hand and `renderer.domElement.toDataURL()` after a `render`.
 * This is that, kept: `photograph(h)` places the two actors side by side
 * at the near end of the first clear lane with 25m of sight (the stand
 * the figure checks use), faces them down it, and returns a frame from
 * each eye that is in open air - front, side and three-quarter at 4.5m,
 * and down the lane at 8m and 25m - with how many pixels the actors
 * cover in it. `scripts/shot.mjs` (`npm run shot`) calls it headless
 * and writes the PNGs; the check below calls it under the suite and
 * holds it to a frame from every eye with both bodies in it.
 *
 * A look at a pose (F7): `photographPose(h, name)` drives the Shade into
 * a named state the way a player gets there (`strike`, tests/animation.js
 * - a crouch, a slide, a vault part way over, a hang, ...) and
 * photographs it where it is, from the first three-quarter eye in open
 * air with sight of it; `aim` is the Warden with the sights up on the
 * stand. E3 built ten poses nobody had seen mid-move. `npm run shot --
 * --pose <name>` writes them.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { createLens, difference, quiesce, scaledCount } from './pixels.js';
import { alongLane } from './lanes.js';
import { standAndEyes } from './figure.js';
import { strike, STRIKES } from './animation.js';

/** The eyes, by name: a direction relative to the lane (along, across) and a distance, or a lane eye the stand already has. */
const EYES = [
  { name: 'front', along: 1, across: 0, distance: 4.5 },
  { name: 'side', along: 0, across: 1, distance: 4.5 },
  { name: 'three-quarter', along: Math.SQRT1_2, across: Math.SQRT1_2, distance: 4.5 },
  { name: 'eight', lane: 8 },
  { name: 'far', lane: 25 },
];
/** The eye is this far up from the feet, looking at a metre up, as the figure checks look. */
const EYE = 1.4;
const FOCUS = 1.0;
/** The actors stand this far either side of the stand, across the eye's line of sight. */
const APART = 0.9;

/**
 * Both actors on the stand, a frame from every eye in open air.
 *
 * @returns {{ lane: string, stand: object, buffer: {width: number, height: number}, views: Object<string, { eye: object, covered: number, dataUrl: string }>, skipped: string[] }|null}
 *   `buffer` is the drawing buffer the frames were taken in, because every
 *   pixel count below it is a fraction of that and not a number (H28)
 *   null when this map has no stand with a clear lane and 25m of sight
 */
export function photograph(h) {
  const restore = quiesce(h);
  const where = standAndEyes(h, 25);
  if (!where) { restore(); return null; }
  const { lane, stand, focus, eyes } = where;
  const { shade, warden } = h;
  const world = h.map.collision;
  const eyeHalf = { x: 0.2, y: 0.2, z: 0.2 };
  const across = { dx: -lane.dz, dz: lane.dx };

  // Both facing down the lane, the Shade to the eye's left and the Warden
  // to its right, spread across the eye's line of sight so neither hides
  // the other from any eye; placed and drawn, never stepped (a stepped
  // frame is the AI's, and it would walk the Warden off the stand).
  const place = (eye) => {
    const dx = eye.x - stand.x;
    const dz = eye.z - stand.z;
    const length = Math.hypot(dx, dz) || 1;
    const left = { dx: dz / length, dz: -dx / length };
    shade.reset({ position: { x: stand.x + left.dx * APART, y: stand.y, z: stand.z + left.dz * APART }, yaw: lane.yaw });
    warden.reset({ position: { x: stand.x - left.dx * APART, y: stand.y, z: stand.z - left.dz * APART }, yaw: lane.yaw });
    for (let i = 0; i < 60; i++) { shade.updateVisual(1 / 60); warden.updateVisual(1 / 60); }
  };

  const lens = createLens(h);
  const views = {};
  const skipped = [];
  for (const spec of EYES) {
    let eye;
    if (spec.lane) {
      eye = eyes[spec.lane];
    } else {
      // Either side of the lane for the side and three-quarter eyes: the
      // first that is in open air.
      const sides = spec.across ? [1, -1] : [1];
      for (const side of sides) {
        const at = alongLane(lane, 0.5 + spec.along * spec.distance);
        const candidate = {
          x: at.x + across.dx * side * spec.across * spec.distance,
          y: stand.y + EYE,
          z: at.z + across.dz * side * spec.across * spec.distance,
        };
        if (world.isClear(candidate, eyeHalf)) { eye = candidate; break; }
      }
    }
    if (!eye) { skipped.push(`${spec.name}: no eye in open air`); continue; }
    place(eye);
    lens.look(eye, focus);
    shade.mesh.visible = false;
    warden.mesh.visible = false;
    const without = lens.grab();
    shade.mesh.visible = true;
    warden.mesh.visible = true;
    const withBodies = lens.grab();
    // The drawing buffer is the frame just rendered until the task ends.
    const dataUrl = h.renderer.domElement.toDataURL('image/png');
    const covered = difference(withBodies, without, lens.width, lens.height, 8).count;
    views[spec.name] = { eye, covered, dataUrl };
  }
  const buffer = { width: lens.width, height: lens.height };
  lens.restore();
  restore();
  return { lane: lane.from, stand, buffer, views, skipped };
}

/** The poses `photographPose` knows: the Shade's, and the Warden's aim. */
export const POSES = [...STRIKES, 'aim'];

/** The eyes tried for a pose, in order, as (along the body's facing, across to its left) at 4.5m: the first in open air with sight of the body. */
const POSE_EYES = [
  { name: 'front-left', along: Math.SQRT1_2, across: Math.SQRT1_2 },
  { name: 'front-right', along: Math.SQRT1_2, across: -Math.SQRT1_2 },
  { name: 'left', along: 0, across: 1 },
  { name: 'right', along: 0, across: -1 },
  { name: 'back-left', along: -Math.SQRT1_2, across: Math.SQRT1_2 },
  { name: 'back-right', along: -Math.SQRT1_2, across: -Math.SQRT1_2 },
];
const POSE_DISTANCE = 4.5;

/**
 * The Shade in a named state, or the Warden aiming, photographed where it
 * is: the other actor out of the frame, the eye 4.5m off at three
 * quarters (or the first of `POSE_EYES` in open air that sees the body's
 * middle), the frame the drawing buffer as a PNG. Nothing is stepped
 * between the strike and the frame, so a vault is photographed part way
 * over. The match is left as `quiesce` leaves it.
 *
 * @returns {{ pose: string, reached: boolean, why: string, state: string, eye: string|null, covered: number, buffer: object|null, dataUrl: string|null }}
 *   `state` is what the body was in for the frame; `reached` whether that
 *   is the state named, `why` what stopped it when not; `eye` null when
 *   no eye had sight of the body
 */
export function photographPose(h, name) {
  const { shade, warden } = h;
  const restore = quiesce(h);
  let actor;
  let reached;
  let why = '';
  let state;
  if (name === 'aim') {
    // Free roam as the Warden, the sights held until the blend settles;
    // first person hides the body, so it is shown for the frame.
    h.initMatch({ mode: 'freeroam', role: 'warden', ai: false, objective: false });
    const where = standAndEyes(h, 25);
    if (where) {
      warden.reset({ position: where.stand, yaw: where.lane.yaw });
      warden.pitch = 0;
      h.input.clearAll();
      h.input.heldCodes.add('Mouse2');
      for (let i = 0; i < 60; i++) { h.stepFrames(1); h.input.clearEdges(); warden.updateVisual(1 / 60); }
      h.input.clearAll();
    }
    actor = warden;
    reached = !!where && warden.adsBlend > 0.99;
    why = where ? (reached ? '' : `the sights are at ${warden.adsBlend.toFixed(2)}`) : 'no stand on this map with a clear lane and 25m of sight';
    state = `ads ${warden.adsBlend.toFixed(2)}`;
  } else {
    // The Shade driven by the keys with the AI off, so nothing shoots it
    // on the way down a 5m drop.
    h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
    const struck = strike(h, name);
    actor = shade;
    reached = struck.reached;
    why = struck.why;
    state = shade.state + (shade.crouching ? ' (crouching)' : '') + (shade._move ? ` ${(shade._move.timer / shade._move.duration * 100).toFixed(0)}%` : '');
  }

  const shot = photographHere(h, actor);
  h.input.clearAll();
  restore();
  return { pose: name, reached, why, state, ...shot };
}

/**
 * The half of `photographPose` that does not drive anything: frame the actor
 * **where it stands**, from the first of `POSE_EYES` in open air with sight of
 * its middle, and answer the PNG and how much of the buffer the body covers.
 *
 * Split out at H44, which wants a photograph a frame through a grab rather
 * than one at the end of a strike, and drives its own frames to get there
 * (`tests/grabslide.js`). Neither the match nor the input is touched here, so
 * the caller owns both - `photographPose` still quiesces and restores around
 * it, and a caller mid-sequence can take as many of these as it likes.
 *
 * The eye and the focus are both offsets from **one** read of the drawn body,
 * which is the clause H43's census holds against this file: the camera and its
 * subject carry the same position lag, so a body the chase has not caught up
 * with is still photographed the right size in the right part of the frame.
 *
 * @returns {{ eye: string|null, covered: number, buffer: object|null, dataUrl: string|null }}
 */
export function photographHere(h, actor) {
  const { shade, warden } = h;
  const world = h.map.collision;

  // The eye, from the body's facing: the first in open air that sees the
  // body's middle (a vault is over a crate, and an eye can be in it).
  const feet = actor.mesh.position;
  const focus = { x: feet.x, y: feet.y + FOCUS, z: feet.z };
  const forward = { x: -Math.sin(actor.yaw), z: -Math.cos(actor.yaw) };
  const left = { x: -Math.cos(actor.yaw), z: Math.sin(actor.yaw) };
  const eyeHalf = { x: 0.2, y: 0.2, z: 0.2 };
  let eye = null;
  let eyeName = null;
  for (const spec of POSE_EYES) {
    const candidate = {
      x: feet.x + (forward.x * spec.along + left.x * spec.across) * POSE_DISTANCE,
      y: feet.y + EYE,
      z: feet.z + (forward.z * spec.along + left.z * spec.across) * POSE_DISTANCE,
    };
    if (!world.isClear(candidate, eyeHalf) || !world.lineOfSight(candidate, focus)) continue;
    eye = candidate;
    eyeName = spec.name;
    break;
  }

  let covered = 0;
  let dataUrl = null;
  let buffer = null;
  if (eye) {
    const other = actor === shade ? warden : shade;
    const wasVisible = { actor: actor.mesh.visible, other: other.mesh.visible };
    other.mesh.visible = false;
    const lens = createLens(h);
    lens.look(eye, focus);
    actor.mesh.visible = false;
    const without = lens.grab();
    actor.mesh.visible = true;
    const withBody = lens.grab();
    dataUrl = h.renderer.domElement.toDataURL('image/png');
    covered = difference(withBody, without, lens.width, lens.height, 8).count;
    buffer = { width: lens.width, height: lens.height };
    lens.restore();
    actor.mesh.visible = wasVisible.actor;
    other.mesh.visible = wasVisible.other;
  }
  return { eye: eyeName, covered, buffer, dataUrl };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-look-at-a-pose-photographs-the-state-named',
    spec: 'Section 4 (procedural animation) / F7',
    name: 'photographPose() drives the Shade into each named state (and the Warden into the aim) and returns a PNG of it from an eye with sight of the body, mid-move for the climbs',
    run: (h) => {
      const problems = [];
      const readings = [];
      for (const name of POSES) {
        const look = photographPose(h, name);
        if (!look.reached) { problems.push(`${name}: ${look.why}`); continue; }
        if (!look.eye) { problems.push(`${name}: no eye in open air with sight of the body (${look.state})`); continue; }
        if (!look.dataUrl || !look.dataUrl.startsWith('data:image/png;base64,') || look.dataUrl.length < 1000) problems.push(`${name}: the frame is not a PNG`);
        // One body at 4.5m covers thousands of pixels - of the reference
        // buffer, which is the whole of H28: at `low`'s 0.7 this read 2,459px
        // against a flat 3,000 and failed a pose that was drawn correctly.
        const floor = scaledCount(look.buffer, 3000);
        if (look.covered < floor) problems.push(`${name}: the body covers ${look.covered} pixels of a ${look.buffer.width}x${look.buffer.height} buffer from the ${look.eye} eye, want ${floor}`);
        readings.push(`${name} ${look.state} ${look.covered}px ${look.eye}`);
      }
      return {
        pass: problems.length === 0,
        detail: problems.length === 0 ? readings.join('; ') : `${problems.join('; ')} [${readings.join('; ')}]`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'a-look-at-both-figures-photographs-every-eye',
    spec: 'Section 4 (readable silhouettes) / F6',
    name: 'photograph() returns a PNG from every eye in open air, front to 25m, with both bodies in each',
    run: (h) => {
      const problems = [];
      const look = photograph(h);
      if (!look) return { pass: false, detail: 'no stand on this map with a clear lane and 25m of sight' };
      const readings = [];
      for (const { name, lane, along } of EYES) {
        const view = look.views[name];
        // The lane eyes and the front one are the stand's own and always in
        // open air; a side eye may be in a wall on some map, and says so.
        const required = lane || along === 1;
        if (!view) {
          if (required) problems.push(`no frame from the ${name} eye (${look.skipped.join('; ') || 'not skipped either'})`);
          continue;
        }
        if (!view.dataUrl.startsWith('data:image/png;base64,') || view.dataUrl.length < 1000) problems.push(`the ${name} frame is not a PNG (${view.dataUrl.slice(0, 30)}..., ${view.dataUrl.length} chars)`);
        // Both bodies at 4.5m cover thousands of pixels; at 25m a few hundred -
        // of the reference buffer, as the floor above it is (H28). This one was
        // never red at `low`, because the near eyes clear 6,000 with room to
        // spare; it is the same reading all the same and is scaled with it.
        const least = scaledCount(look.buffer, name === 'far' ? 300 : name === 'eight' ? 2000 : 6000);
        if (view.covered < least) problems.push(`the ${name} frame has the bodies on ${view.covered} pixels of a ${look.buffer.width}x${look.buffer.height} buffer, want ${least}`);
        readings.push(`${name} ${view.covered}px`);
      }
      // The lane and the far eye are the figure checks' own, so the
      // photographs are of the stand the numbers were read at.
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${readings.join(', ')} from the lane at ${look.lane}; ${look.skipped.length ? `skipped ${look.skipped.join('; ')}` : 'no eye skipped'}`
          : `${problems.join('; ')} [${readings.join(', ')}]`,
      };
    },
  });
}
