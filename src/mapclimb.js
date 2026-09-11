/**
 * BLACKLINE — mapclimb.js
 *
 * Which surfaces are climbable, derived from the geometry and the body alone
 * (Section 5, amended: there are no markings, so this is the whole contract).
 * `GameMap.deriveClimbableSurfaces()` calls it after the level is built, the
 * way `maprooms.js` derives entries and `mapground.js` the Warden's ground.
 * B3's fix to `supportCandidates` lands here.
 */

import { CONFIG } from './config.js';
import { classifyReach } from './physics.js';

const M = CONFIG.map;


/**
 * Decide which surfaces are climbable, from the geometry and the body alone.
 *
 * Section 5, amended: there are no markings, so this is the whole contract.
 * The rule is mechanical and has NO exceptions — no `noClimb`, no tags, no
 * per-box judgement:
 *
 *   a surface is climbable when you could stand on top of it
 *   and the body could reach it from whatever is below.
 *
 * "Stand on top of it" means a top face at least an actor-diameter across in
 * both axes with crouch headroom above. "Reach it" means the rise from the
 * surface below is inside `CONFIG.shade.reach` at full stretch — standing
 * reach plus what a jump adds.
 *
 * `noClimb` used to opt surfaces out: the office floor to keep the drop shaft
 * one-way, and the whole upper deck except four declared lips. Both are now
 * enforced by the vertical layout instead. The deck is 6m and full reach is
 * 3.8m, so it is unreachable on its own merits and nothing has to say so —
 * which means a future change to a floor height cannot silently turn a
 * one-way route into a two-way one without the census noticing.
 */
export function deriveClimbableSurfaces(collision, ledges) {
  const minSupport = CONFIG.shade.radius * 2;
  const headroom = CONFIG.shade.crouchHeight;
  const probeHalf = { x: minSupport * 0.5, y: headroom * 0.5, z: minSupport * 0.5 };
  const fullReach = CONFIG.shade.reach.standing + CONFIG.shade.reach.jumpBonus;

  ledges.length = 0;

  for (const box of collision.boxes) {
    if (!box.solid) continue;
    if (box.max.x - box.min.x < minSupport) continue;
    if (box.max.z - box.min.z < minSupport) continue;

    const standY = supportHeightBelow(collision, box);
    const rise = box.max.y - standY;
    const move = classifyReach(rise, fullReach);
    // `step` is not a climb: the swept solver carries you over it.
    if (move === null || move === 'step') continue;

    // Somewhere to actually stand once you are up. Sampled along the surface
    // rather than at its centre alone: a long ledge that passes under one
    // obstruction is still climbable everywhere else, and judging it by a
    // single point excludes the whole thing.
    const y = box.max.y + headroom * 0.5 + 0.05;
    let standable = false;
    for (let i = 1; i <= 3 && !standable; i++) {
      const t = i / 4;
      const point = {
        x: box.min.x + (box.max.x - box.min.x) * t,
        y,
        z: box.min.z + (box.max.z - box.min.z) * t,
      };
      // Keep the sample inside the footprint so an edge point does not
      // wrongly report clear air beside the box.
      point.x = Math.min(Math.max(point.x, box.min.x + probeHalf.x), box.max.x - probeHalf.x);
      point.z = Math.min(Math.max(point.z, box.min.z + probeHalf.z), box.max.z - probeHalf.z);
      if (collision.isClear(point, probeHalf)) standable = true;
    }
    if (!standable) continue;

    box.climbable = true;
    box.reachMove = move;
    ledges.push({ box, move, topY: box.max.y, standY, rise });
  }
}


/**
 * Height of the surface an actor would be standing on to climb this box:
 * the tallest solid top face directly beneath it that is below its own top.
 * Falls back to the ground plane.
 *
 * A candidate must be wide enough to actually stand on. Without this, a thin
 * wall or parapet passing under a ledge is treated as a foothold and collapses
 * the ledge's rise to almost nothing, so it classifies into no band and goes
 * unmarked — which is exactly the drift Section 5 forbids.
 */
export function supportHeightBelow(collision, box) {
  const candidates = supportCandidates(collision, box);
  return candidates[candidates.length - 1];
}

/**
 * Every height an actor could be standing on to climb this box, lowest
 * first. Always includes the ground plane.
 */
export function supportCandidates(collision, box) {
  const heights = [M.groundY];
  const minSupport = CONFIG.shade.radius * 2;
  for (const other of collision.boxes) {
    if (other === box || !other.solid) continue;
    if (other.max.y >= box.max.y) continue;
    if (other.max.x - other.min.x < minSupport) continue;
    if (other.max.z - other.min.z < minSupport) continue;
    // Overlapping footprint, allowing a small reach margin either side.
    const margin = CONFIG.shade.vaultReach;
    if (other.max.x < box.min.x - margin || other.min.x > box.max.x + margin) continue;
    if (other.max.z < box.min.z - margin || other.min.z > box.max.z + margin) continue;
    heights.push(other.max.y);
  }
  heights.sort((a, b) => a - b);
  return heights;
}
