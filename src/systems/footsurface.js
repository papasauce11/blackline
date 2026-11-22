/**
 * BLACKLINE - systems/footsurface.js
 *
 * What a foot lands on, as a class (I2): `concrete`, `metal`, `grate` or
 * `wet`. The finish `mapbake` wrote on the box (E4, E5) is the material's
 * name, which is more than a footstep wants to tell apart, so
 * `CONFIG.footsteps.materials` folds the finishes into the four sounds and
 * the radius scales that exist, and anything it does not name is the
 * fallback - a map drawn flat has no finish and steps as it always did.
 *
 * Kept out of `detection.js`, which reads it twice a stride, and out of the
 * recipes, which are handed the class on the event and never ask a map.
 *
 * Layering (Section 3.1): config and the ground probe. The collision world is
 * handed in.
 */

import { CONFIG } from '../config.js';
import { boxUnder } from '../groundprobe.js';

const F = CONFIG.footsteps;

/** A foot is on a top face this far above or below the sole: the controller's own step, a little over, so a kerb underfoot is still the kerb. */
const BAND = 0.35;

/** The class a finish sounds as. */
export function footstepClass(finish) {
  return F.materials[finish] || F.fallback;
}

/**
 * The class under an actor's feet, or the fallback where there is nothing
 * under them (a step taken as the ground goes is not a sound worth inventing).
 */
export function surfaceUnder(collision, actor) {
  const box = boxUnder(collision, actor.position.x, actor.position.z, actor.feetY, BAND);
  return box ? footstepClass(box.surface) : F.fallback;
}
