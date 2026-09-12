/**
 * BLACKLINE - tests/deck.js
 *
 * AUTO suite: the upper deck's edges and floors (B4).
 *
 * Two things the census and the plant census report but do not hold:
 *
 *   - A deck lip is climbed standing. The census stands wherever the rule
 *     says a body fits, crouched included, and it climbed `lip-bay` from
 *     under 1.65m of slab with its hands up into the underside - a climb a
 *     player would never find. Every lip now has an approach the rule names
 *     where a standing body fits, and the controller gets over from there.
 *
 *   - Every clear floor spot in a site room is a legal plant. A5 counted one
 *     refused floor cell on its 2m grid; the same rule, asked every 0.1m,
 *     refused 150 - the aisles between the server racks admitted the Shade
 *     and never a Warden ground cell. The rule is right to refuse those;
 *     the map is wrong to have them.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { plantableSpots } from './plantspots.js';

const S = CONFIG.shade;

/** Does a standing body fit at this spot on a support at `feet`? */
function standsAt(h, spot, feet) {
  const half = { x: S.radius, y: S.standHeight / 2, z: S.radius };
  return h.map.collision.isClear({ x: spot.x, y: feet + half.y + 0.02, z: spot.z }, half);
}

/**
 * From a standing start at `approach`, face the lip and do what a player
 * does: hold forward, hold Space. Returns whether the body got on top, and
 * whether it was ever crouched on the way - a climb that only works crouched
 * is the one this file exists to rule out.
 */
function climbStanding(h, box, approach) {
  const shade = h.shade;
  shade.reset({
    position: { x: approach.x, y: approach.y, z: approach.z },
    yaw: Math.atan2(approach.nx, approach.nz),
  });
  h.stepFrames(2);

  h.input.clearAll();
  h.input.heldCodes.add('KeyW');
  h.input.heldCodes.add('Space');
  let climbed = false;
  let crouched = false;
  for (let step = 0; step < 90 && !climbed; step++) {
    if (step % 22 === 0) h.input.pressedCodes.add('Space');
    h.stepFrames(1);
    h.input.clearEdges();
    if (shade.crouching) crouched = true;
    if (shade.feetY > box.max.y - 0.12) climbed = true;
  }
  h.input.clearAll();
  return { climbed, crouched };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'every-deck-lip-is-climbed-from-a-standing-approach',
    spec: 'Section 5, amended (B4)',
    name: 'Every lip-* has an approach the rule names where a standing body fits, and the controller climbs it from there without crouching',
    run: (h) => {
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
      h.menu.hide();
      h.setPaused(false);

      const lips = h.map.collision.boxes.filter((box) => box.tag && box.tag.startsWith('lip-'));
      if (lips.length < 4) {
        return { pass: false, detail: `only ${lips.length} lip-* boxes on the map; the deck has lost its edges` };
      }

      const problems = [];
      const climbed = [];
      for (const box of lips) {
        if (!box.climbable) {
          problems.push(`${box.tag} is not climbable`);
          continue;
        }
        const named = h.map._supportApproaches(box);
        const standing = named.filter((approach) => standsAt(h, approach, approach.y));
        if (!standing.length) {
          const where = named.map((a) => `${a.box.tag} (${a.x.toFixed(1)}, ${a.z.toFixed(1)})`).join(', ');
          problems.push(`${box.tag}: none of its ${named.length} approaches has standing headroom [${where}]`);
          continue;
        }
        // The tallest standing approach is the one the map reports the rise
        // from; any one that climbs is enough, but the first must be tried.
        standing.sort((a, b) => b.y - a.y);
        let got = null;
        for (const approach of standing) {
          const result = climbStanding(h, box, approach);
          if (result.climbed && !result.crouched) {
            got = approach;
            break;
          }
          if (result.climbed) {
            problems.push(`${box.tag}: climbed from ${approach.box.tag} only after crouching`);
          }
        }
        if (got) {
          climbed.push(`${box.tag} from ${got.box.tag} (${got.rise.toFixed(1)}m)`);
        } else if (!problems.some((p) => p.startsWith(`${box.tag}:`))) {
          problems.push(`${box.tag}: standing at ${standing.map((a) => a.box.tag).join('/')}, the controller never got on top`);
        }
      }

      h.shade.reset(h.map.shadeSpawns[0]);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${lips.length} lips, each climbed standing from a spot the rule names: ${climbed.join('; ')}`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'no-clear-floor-in-a-site-room-refuses-the-plant',
    spec: 'Section 10.1 amended / D5 (B4)',
    name: 'Every spot on a site room floor where the Shade can stand is a legal plant, at 0.1m',
    run: (h) => {
      h.initMatch({ mode: 'competitive', role: 'shade', ai: false, objective: true });
      const objective = h.objective;
      if (!h.map.wardenGround) return { pass: false, detail: 'map.wardenGround was never derived' };

      // The census's own floor spots first: this is B4's done-when as written.
      const coarse = plantableSpots(h).filter((spot) => spot.kind === 'floor');
      const coarseRefused = coarse.filter((spot) => !spot.legal);
      const problems = [];
      if (coarseRefused.length) {
        problems.push(`the census refuses ${coarseRefused.length} floor spots: ${coarseRefused.map((s) => s.what).join(', ')}`);
      }

      // Then every 0.1m. A rack aisle 0.7m wide takes the 0.68m Shade and is
      // invisible to any coarser grid, which is how A5 counted one refusal
      // where there were 150.
      const STEP = 0.1;
      const half = { x: S.radius, y: S.standHeight / 2, z: S.radius };
      let clear = 0;
      const refused = [];
      for (const site of h.map.sites) {
        const room = site.room;
        if (!room) {
          problems.push(`site ${site.id} has no room`);
          continue;
        }
        for (let x = room.min.x + STEP / 2; x < room.max.x; x += STEP) {
          for (let z = room.min.z + STEP / 2; z < room.max.z; z += STEP) {
            const foot = { x, y: room.floorY + 0.02, z };
            if (!h.map.collision.isClear({ x, y: foot.y + half.y, z }, half)) continue;
            clear++;
            if (!objective.canPlantAt(foot)) refused.push(`${site.id} (${x.toFixed(2)}, ${z.toFixed(2)})`);
          }
        }
      }
      if (refused.length) {
        problems.push(`${refused.length} of ${clear} clear floor spots are refused: ${refused.slice(0, 5).join(', ')}`
          + (refused.length > 5 ? ` (+${refused.length - 5} more)` : ''));
      }

      objective.resetMatch();
      objective.resetRound(1);
      h.shade.reset(h.map.shadeSpawns[0]);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${coarse.length} census floor spots and ${clear} spots at ${STEP}m across ${h.map.sites.length} site rooms, all legal`
          : problems.join('; '),
      };
    },
  });
}
