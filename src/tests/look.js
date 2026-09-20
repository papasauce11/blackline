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
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { createLens, difference, quiesce } from './pixels.js';
import { alongLane } from './lanes.js';
import { standAndEyes } from './figure.js';

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
 * @returns {{ lane: string, stand: object, views: Object<string, { eye: object, covered: number, dataUrl: string }>, skipped: string[] }|null}
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
  lens.restore();
  restore();
  return { lane: lane.from, stand, views, skipped };
}

export function register(debugTools) {
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
        // Both bodies at 4.5m cover thousands of pixels; at 25m a few hundred.
        const least = name === 'far' ? 300 : name === 'eight' ? 2000 : 6000;
        if (view.covered < least) problems.push(`the ${name} frame has the bodies on ${view.covered} pixels, want ${least}`);
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
