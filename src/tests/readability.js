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
 * Where a body would stand to climb this face: three positions along it, each
 * at three distances back, furthest back first.
 *
 * Neither axis used to vary, and both mattered. At 0.59m out the body is
 * already inside the probe's own reach, so the check never exercised walking up
 * to anything - and on stacked geometry that spot is usually under the very
 * thing it is trying to climb. `lip-bay` overhangs `gantry-bay`, so 0.59m out
 * from its face puts the body under the deck with no standing room, which reads
 * as "unclimbable" when what it means is "stand back". A player backs up.
 *
 * And sampling only the middle of a face judges a 6.6m-wide gantry by one
 * point. `standableTop()` already learned this on the other side of the same
 * problem: "a long ledge that passes under one obstruction is still climbable
 * everywhere else, and judging it by a single point excludes the whole thing."
 * The foothold you climb from can just as easily be at one end.
 *
 * `along` indexes the position on the face, so the caller can tell "another
 * distance back from the same place" from "somewhere else entirely".
 */
function standSpots(box, face) {
  const spots = [];
  for (let i = 0; i < 3; i++) {
    const t = (i + 1) / 4;
    const at = {
      x: face.nx !== 0 ? (face.nx > 0 ? box.max.x : box.min.x) : box.min.x + (box.max.x - box.min.x) * t,
      z: face.nz !== 0 ? (face.nz > 0 ? box.max.z : box.min.z) : box.min.z + (box.max.z - box.min.z) * t,
    };
    for (const out of [S.radius + 1.15, S.radius + 0.7, S.radius + 0.25]) {
      spots.push({ x: at.x + face.nx * out, z: at.z + face.nz * out, along: i });
    }
  }
  return spots;
}

/**
 * The body height that fits at this spot standing on a surface at `feet`, or
 * null if none does.
 *
 * Crouched counts. Several of the surfaces in the stacked routes sit under the
 * deck with only crouch headroom, and that is where the controller leaves you
 * when you climb onto them - a check that only ever tries a standing body
 * declares those approaches impossible and never drives the one that matters.
 */
function bodyHeightAt(h, stand, feet) {
  for (const height of [S.standHeight, S.crouchHeight]) {
    const half = { x: S.radius, y: height / 2, z: S.radius };
    if (h.map.collision.isClear({ x: stand.x, y: feet + half.y + 0.02, z: stand.z }, half)) return height;
  }
  return null;
}

/**
 * Every height a body could actually be standing on at this spot, lowest first.
 *
 * The census used to take one: a long ray dropped from just above the box's
 * top. For anything sitting on the floor that is the right answer and the only
 * answer. For anything stacked it is the wrong one - a deck lip 6m up got
 * approached from the bay floor 6m below, which the rule already says is out of
 * reach, while `gantry-bay` at 4m, the surface the rule actually derived it
 * from and the one the stairless route climbs from, was never stood on at all.
 * Three of `lip-bay`'s four faces came back with a rise of 0.00 because the ray
 * landed on the deck the lip is part of, and the box was then recorded as
 * unclimbable while the body was standing on it.
 *
 * So the approach heights come from `_supportCandidates()` - the same list
 * `deriveClimbableSurfaces()` reads to decide the box is climbable in the first
 * place. That is what "reach it from whatever is below" says, and a census that
 * tests a different sentence than the rule states is not testing the rule.
 * Each candidate is confirmed to be real ground at THIS spot before it counts;
 * a support that stops short of the standing position is not a foothold.
 * Since B3 the rule names the spot as well as the height
 * (`_supportApproaches()`), and the census stands there too - see the face
 * loop in the check.
 */
function standHeightsAt(h, box, stand) {
  const collision = h.map.collision;
  const heights = [];
  const seen = new Set();
  const add = (y) => {
    const key = y.toFixed(2);
    if (seen.has(key)) return;
    seen.add(key);
    heights.push(y);
  };

  // Whatever is under the spot, however far down - the floor case.
  const floor = collision.raycast(
    { x: stand.x, y: box.max.y + 0.6, z: stand.z }, { x: 0, y: -1, z: 0 }, 60
  );
  if (floor) add(floor.y);

  for (const y of h.map._supportCandidates(box)) {
    // Real ground at this spot, at this height? A short ray, so a candidate
    // that belongs to a box the standing position is beside rather than on
    // does not count.
    const hit = collision.raycast({ x: stand.x, y: y + 0.25, z: stand.z }, { x: 0, y: -1, z: 0 }, 0.5);
    if (hit && Math.abs(hit.y - y) < 0.06) add(hit.y);
  }

  heights.sort((a, b) => a - b);
  return heights;
}

/**
 * Stand at one face of a box, on one surface below it, and try to get on top
 * the way a player would: face it, hold forward, and jump. A ground climb IS a
 * jump into a ledge, so the jump is pressed for every rise, not only for the
 * ones above standing reach — and held, because since D21 a tap only grabs.
 *
 * @returns {boolean} whether the body ended up on top
 */
function attemptClimb(h, box, face, stand, feet, height) {
  const shade = h.shade;
  shade.reset({ position: { x: stand.x, y: feet, z: stand.z }, yaw: Math.atan2(face.nx, face.nz) });
  if (height < S.standHeight) {
    // Under a deck. Start the way the controller would leave you there.
    shade.height = height;
    shade.half.y = height / 2;
    shade.crouching = true;
    shade.position.set(stand.x, feet + height / 2 + 0.02, stand.z);
  }
  h.stepFrames(2);

  h.input.clearAll();
  h.input.heldCodes.add('KeyW');
  // Space is HELD throughout: since D21 a tap grabs the lip and hangs, and it
  // is the hold that carries the body on over. Getting on top is a hold.
  h.input.heldCodes.add('Space');
  let climbed = false;
  for (let step = 0; step < 90 && !climbed; step++) {
    // The jump itself is edge-triggered, so the press is repeated periodically:
    // a single edge can be consumed by a step that was not yet in range.
    if (step % 22 === 0) h.input.pressedCodes.add('Space');
    h.stepFrames(1);
    h.input.clearEdges();
    if (shade.feetY > box.max.y - 0.12) climbed = true;
  }
  h.input.clearAll();
  return climbed;
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
        // "From whatever is below" is every place the rule says a body can
        // stand and get its hands on the face (B3); any one of them in reach
        // is enough. The tallest is the rise the map reports.
        const standY = h.map._supportHeightBelow(box);
        const reachable = h.map._supportApproaches(box).some((approach) => {
          const move = classifyReach(approach.rise, FULL_REACH);
          return move !== null && move !== 'step';
        });
        const shouldClimb = box.solid && standableTop(h, box) && reachable;
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
      const failedBoxes = new Map();
      /** Climbable, but only once you are standing on something else first. */
      const needsALegUp = [];
      let approaches = 0;
      let climbs = 0;
      let reached = 0;
      let enclosed = 0;
      let unreachable = 0;

      for (const box of climbable) {
        let standable = false;
        let inReach = false;
        let climbedAny = false;
        let climbedFromFloor = false;
        const named = h.map._supportApproaches(box);

        for (const face of FACES) {
          if (climbedFromFloor) break;
          // One approach per place-on-the-face per surface below it, taken from
          // the furthest distance back that still has ground and room.
          const tried = new Set();
          // Three places along the face - and every place the rule itself
          // names on it (B3). A 38m deck edge sampled at its quarter points
          // never stood on the 2m landing at one end that the rule derived
          // the surface from, and reported "nothing in reach" of a face the
          // rule had a spot for. Now the census stands exactly where the
          // rule says you can, so the two cannot disagree about where.
          const spots = standSpots(box, face);
          for (const approach of named) {
            if (approach.nx !== face.nx || approach.nz !== face.nz) continue;
            spots.push({ x: approach.x, z: approach.z, along: `rule:${approach.box.tag || 'box'}` });
          }
          for (const stand of spots) {
            const heights = standHeightsAt(h, box, stand);
            for (let i = 0; i < heights.length; i++) {
              const feet = heights[i];
              const key = `${stand.along}:${feet.toFixed(2)}`;
              if (tried.has(key)) continue;
              const height = bodyHeightAt(h, stand, feet);
              if (height === null) continue;
              standable = true;
              const rise = box.max.y - feet;
              if (rise <= 0) continue;
              const move = classifyReach(rise, FULL_REACH);
              // Out of reach from down there is not a failure, it is the rule
              // agreeing with itself. It only counts as an approach if the rule
              // says a body standing here could make it.
              if (move === null || move === 'step') continue;
              tried.add(key);
              inReach = true;

              approaches++;
              if (!attemptClimb(h, box, face, stand, feet, height)) continue;
              climbs++;
              climbedAny = true;
              // heights[0] is the lowest thing under this spot: the floor.
              if (i === 0) {
                climbedFromFloor = true;
                break;
              }
            }
            if (climbedFromFloor) break;
          }
        }

        // A box nothing can stand next to is not a failure — it is enclosed.
        if (!standable) {
          enclosed++;
          continue;
        }
        // Flagged climbable, but no surface a body can stand on is within
        // reach of it. That is the rule disagreeing with the geometry, and it
        // is a failure of the same kind as a climb that does not happen.
        if (!inReach) {
          unreachable++;
          const area = areaOf(h, box);
          if (!failedBoxes.has(area)) failedBoxes.set(area, []);
          failedBoxes.get(area).push(`${box.tag || 'box'} (nothing in reach of it)`);
          continue;
        }
        if (climbedAny) {
          reached++;
          if (!climbedFromFloor) needsALegUp.push(box.tag || 'box');
        } else {
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

      // Reported, not failed. A surface you have to climb something else to get
      // to is the whole point of a stacked route — it is only worth knowing how
      // much of the map is behind one, because that is the part a player cannot
      // reach by walking up to it.
      const legUp = needsALegUp.length
        ? `; ${needsALegUp.length} need a leg up first (${needsALegUp.slice(0, 5).join(', ')}`
          + `${needsALegUp.length > 5 ? ', ...' : ''})`
        : '; every one of them is reachable straight off the floor';

      return {
        pass: failedCount === 0,
        detail: failedCount === 0
          ? `${climbable.length} climbable surfaces, ${approaches} approaches from every surface the rule `
            + `derives them from, ${climbs} climbs; the controller got onto all ${reached} reachable `
            + `surfaces (${enclosed} enclosed)${legUp}`
          : `${failedCount} of ${climbable.length} climbable surfaces cannot be climbed`
            + `${unreachable ? ` (${unreachable} with nothing in reach of them)` : ''}. Worst area: `
            + `"${worst}" with ${byArea[0][1].length}. By area: `
            + byArea.map(([area, list]) => `${area} ${list.length}`).join(', ') + legUp,
      };
    },
  });
}
