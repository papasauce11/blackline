/**
 * BLACKLINE - tests/readability.js
 *
 * The expectation census. With the affordance markings gone this is the whole
 * contract, and it has no exceptions.
 *
 *   A surface is climbable when you could stand on top of it and the body
 *   could reach it from whatever is below. If it is climbable, the controller
 *   must actually climb it.
 *
 * There is no tagging, no `noClimb`, and no per-box judgement anywhere in the
 * map any more. The rule IS the expectation: a player who walks up to
 * something that plainly has a top, within reach, and tries the obvious thing,
 * gets up it. Anything that fails is a map bug or a controller bug, never an
 * intentional exclusion.
 *
 * Two checks:
 *   - `the-climb-rule-has-no-exceptions` — the derivation matches the rule.
 *     Cheap, and it is what makes the rule the single source of truth.
 *   - `every-climbable-surface-can-actually-be-climbed` — the expensive one.
 *     It walks the Shade up to every climbable face on the map and drives the
 *     real controller at it. This is the census, and its failure list is the
 *     work queue.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { classifyReach } from '../physics.js';

const S = CONFIG.shade;
/** The furthest forward the controller ever reaches for a ledge. */
const FORWARD = Math.max(S.vaultReach, S.mantleReach, S.hangReach);
const FULL_REACH = S.reach.standing + S.reach.jumpBonus;

/** The four horizontal faces of a box, as outward normals. */
const FACES = [
  { nx: 1, nz: 0 },
  { nx: -1, nz: 0 },
  { nx: 0, nz: 1 },
  { nx: 0, nz: -1 },
];

/** Which room a box sits in, so the failure list groups into work. */
function areaOf(h, box) {
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  for (const room of h.map.rooms) {
    if (cx >= room.min.x && cx <= room.max.x && cz >= room.min.z && cz <= room.max.z) return room.id;
  }
  const shell = h.map.shell;
  if (shell && (cx < shell.x0 || cx > shell.x1 || cz < shell.z0 || cz > shell.z1)) {
    return 'exterior';
  }
  return box.max.y > CONFIG.map.catwalkY - 0.5 ? 'upper deck' : 'interior';
}

/** Is this box's top face something a body could stand on? */
function standableTop(h, box) {
  const minSupport = S.radius * 2;
  if (!box.solid) return false;
  if (box.max.x - box.min.x < minSupport) return false;
  if (box.max.z - box.min.z < minSupport) return false;
  const headroom = S.crouchHeight;
  const half = { x: minSupport * 0.5, y: headroom * 0.5, z: minSupport * 0.5 };
  const y = box.max.y + headroom * 0.5 + 0.05;
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    const point = {
      x: Math.min(Math.max(box.min.x + (box.max.x - box.min.x) * t, box.min.x + half.x), box.max.x - half.x),
      y,
      z: Math.min(Math.max(box.min.z + (box.max.z - box.min.z) * t, box.min.z + half.z), box.max.z - half.z),
    };
    if (h.map.collision.isClear(point, half)) return true;
  }
  return false;
}

/**
 * Walk up to one face of a box and try to get on top of it, the way a player
 * would: face it, hold forward, and jump if it is above standing reach.
 *
 * @returns {{tried: boolean, climbed: boolean, from: number, rise: number}}
 */
function attemptClimb(h, box, face) {
  const shade = h.shade;
  const collision = h.map.collision;
  const along = {
    x: face.nx !== 0 ? (face.nx > 0 ? box.max.x : box.min.x) : (box.min.x + box.max.x) / 2,
    z: face.nz !== 0 ? (face.nz > 0 ? box.max.z : box.min.z) : (box.min.z + box.max.z) / 2,
  };
  const stand = {
    x: along.x + face.nx * (S.radius + 0.25),
    z: along.z + face.nz * (S.radius + 0.25),
  };

  // What would you be standing on here?
  const down = collision.raycast(
    { x: stand.x, y: box.max.y + 0.6, z: stand.z }, { x: 0, y: -1, z: 0 }, 60
  );
  if (!down) return { tried: false, climbed: false, from: 0, rise: 0 };
  const feet = down.y;
  const half = { x: S.radius, y: S.standHeight / 2, z: S.radius };
  if (!collision.isClear({ x: stand.x, y: feet + half.y + 0.02, z: stand.z }, half)) {
    return { tried: false, climbed: false, from: feet, rise: 0 };
  }

  const rise = box.max.y - feet;
  if (rise <= 0) return { tried: false, climbed: false, from: feet, rise };

  shade.reset({ position: { x: stand.x, y: feet, z: stand.z }, yaw: Math.atan2(face.nx, face.nz) });
  h.stepFrames(2);

  const needsJump = rise > S.reach.standing;
  h.input.clearAll();
  h.input.heldCodes.add('KeyW');
  let climbed = false;
  for (let step = 0; step < 90 && !climbed; step++) {
    // A player about to climb something tall jumps into it. Re-pressed
    // periodically because a single edge can be consumed by a step that was
    // not yet in range.
    if (needsJump && step % 22 === 0) {
      h.input.heldCodes.add('Space');
      h.input.pressedCodes.add('Space');
    }
    h.stepFrames(1);
    h.input.clearEdges();
    if (needsJump) h.input.heldCodes.delete('Space');
    if (shade.feetY > box.max.y - 0.12) climbed = true;
  }
  h.input.clearAll();
  return { tried: true, climbed, from: feet, rise };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-climb-rule-has-no-exceptions',
    spec: 'Section 5, amended',
    name: 'Climbable is exactly standable-top plus within-reach, everywhere',
    run: (h) => {
      const problems = [];
      let climbable = 0;
      let checked = 0;
      const wrong = [];

      for (const box of h.map.collision.boxes) {
        checked++;
        const standY = h.map._supportHeightBelow(box);
        const move = classifyReach(box.max.y - standY, FULL_REACH);
        const shouldClimb = box.solid && standableTop(h, box) && move !== null && move !== 'step';
        if (box.climbable) climbable++;
        if (!!box.climbable !== shouldClimb) {
          wrong.push(`${box.tag || 'box'} climbable=${!!box.climbable} rule=${shouldClimb} (rise ${(box.max.y - standY).toFixed(2)})`);
        }
      }
      if (wrong.length) problems.push(`${wrong.length} disagree with the rule: ${wrong.slice(0, 3).join('; ')}`);

      // Nothing may opt out any more. If this field ever comes back, the rule
      // has an exception again and this check is a lie.
      const optOuts = h.map.collision.boxes.filter((box) => box.noClimb !== undefined).length;
      if (optOuts) problems.push(`${optOuts} boxes still carry a noClimb flag`);

      // And the one-way routes must be enforced by height, not by a flag: the
      // upper deck has to be genuinely out of reach from the ground.
      const deckRise = CONFIG.map.catwalkY - CONFIG.map.groundY;
      if (deckRise <= FULL_REACH) {
        problems.push(`the deck is ${deckRise}m up and full reach is ${FULL_REACH}m — the drop shaft is no longer one-way`);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${checked} boxes, ${climbable} climbable, 0 disagreements with "standable top within `
            + `${FULL_REACH}m"; no opt-out flags remain, and the ${deckRise}m deck stays out of `
            + 'reach on its own merits'
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'every-climbable-surface-can-actually-be-climbed',
    spec: 'Section 5, amended / check 26',
    name: 'The census: walk up to every climbable face and try the obvious thing',
    run: (h) => {
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      h.setPaused(false);

      const climbable = h.map.collision.boxes.filter((box) => box.climbable);
      const reached = new Set();
      const failedBoxes = new Map();
      let approaches = 0;
      let climbs = 0;

      for (const box of climbable) {
        let anyFace = false;
        let anySuccess = false;
        for (const face of FACES) {
          const result = attemptClimb(h, box, face);
          if (!result.tried) continue;
          anyFace = true;
          approaches++;
          if (result.climbed) {
            climbs++;
            anySuccess = true;
          }
        }
        // A box nothing can stand next to is not a failure — it is enclosed.
        if (!anyFace) continue;
        if (anySuccess) reached.add(box);
        else {
          const area = areaOf(h, box);
          if (!failedBoxes.has(area)) failedBoxes.set(area, []);
          failedBoxes.get(area).push(box.tag || 'box');
        }
      }

      h.input.clearAll();
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();

      const failedCount = [...failedBoxes.values()].reduce((sum, list) => sum + list.length, 0);
      const byArea = [...failedBoxes.entries()].sort((a, b) => b[1].length - a[1].length);

      // The failure list is the work queue, so it is logged in full rather than
      // truncated into the pass/fail line.
      if (failedCount) {
        debugTools.logResult(`census: ${failedCount} climbable surfaces the controller cannot climb`);
        for (const [area, list] of byArea) {
          debugTools.logResult(`  ${area}: ${list.length} (${list.slice(0, 6).join(', ')}${list.length > 6 ? ', ...' : ''})`);
        }
      }

      const worst = byArea.length ? byArea[0][0] : 'none';
      return {
        pass: failedCount === 0,
        detail: failedCount === 0
          ? `${climbable.length} climbable surfaces, ${approaches} approaches, ${climbs} successful climbs; `
            + `the controller got onto ${reached.size} of ${reached.size} reachable surfaces`
          : `${failedCount} of ${climbable.length} climbable surfaces cannot be climbed. Worst area: `
            + `"${worst}" with ${byArea[0][1].length}. By area: `
            + byArea.map(([area, list]) => `${area} ${list.length}`).join(', '),
      };
    },
  });
}
