/**
 * BLACKLINE - tests/routes.js
 *
 * AUTO suite: the stacked routes are intentional (B5).
 *
 * The census says which surfaces the controller reaches and which of them
 * need a leg up first - a climb onto something you had to climb something
 * else to get to. That number is reported, never failed, because a surface
 * behind another is the whole point of a stacked route. What the census
 * cannot say is whether a stacked climb was DESIGNED. B5 measured the map
 * honestly and found the reach rule had drawn two routes of its own (the
 * duct roofs to the deck edge), a jump it could not make (the mouth of a
 * duct to the deck, with the duct's wall in the way) and a climb the
 * controller refused that the rule promised (the same roofs, from the
 * floor). Two of those were rule and controller disagreeing; the third was
 * a route nobody had decided on.
 *
 * So the map now declares its routes (`map.routes`, mapdata.js) and two
 * checks hold it to them, both through the rule's own approaches rather
 * than by driving - every approach the rule names is proven to climb by
 * `every-approach-the-rule-names-is-a-climb-the-controller-makes`, so the
 * rule's word is good here:
 *
 *   - Every declared route climbs: its first stage from ground a walking
 *     body reaches, within STANDING reach (a first step you find by walking
 *     up to it, not by knowing you can jump); every later stage from a box
 *     of the stage below; and it lands where it says. And the other way:
 *     every climbable surface with no approach from walkable ground - every
 *     leg-up - is a stage or a landing of some route. A stacked climb no
 *     route explains is a decision waiting to be made.
 *
 *   - Every climbable top has an exit that is not the way you came: an
 *     onward climb, a surface at its level to walk onto, or a second face
 *     to drop from. A crate against a wall you can only climb back down
 *     from is a dead climb, and the map has none.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { classifyReach } from '../physics.js';
import { landingFits, onWalkableGround } from './readability.js';

const S = CONFIG.shade;
const FULL_REACH = S.reach.standing + S.reach.jumpBonus;

/** The four horizontal faces of a box, as outward normals. */
const FACES = [
  { nx: 1, nz: 0 },
  { nx: -1, nz: 0 },
  { nx: 0, nz: 1 },
  { nx: 0, nz: -1 },
];

/** Is this an approach the rule would let the body take: in reach, with a landing? */
function usable(h, box, approach, reach = FULL_REACH) {
  const move = classifyReach(approach.rise, reach);
  if (move === null || move === 'step') return false;
  return landingFits(h, box, approach);
}

/** The rule's approaches to `box` that the body could actually take. */
function usableApproaches(h, box, reach = FULL_REACH) {
  return h.map._supportApproaches(box).filter((approach) => usable(h, box, approach, reach));
}

/** Does the rule name a way onto `box` from ground a walking body reaches? */
function fromWalkableGround(h, box, reach = FULL_REACH) {
  return usableApproaches(h, box, reach).some((approach) =>
    onWalkableGround(h, { x: approach.x, z: approach.z }, approach.y));
}

/** Does the rule name a way onto `box` from any box in `from`? */
function fromAnyOf(h, box, from) {
  return usableApproaches(h, box).some((approach) => from.includes(approach.box));
}

/**
 * Could a body standing on top of `box` leave it by this face - step off
 * into clear air? Sampled at three points along the face; a crouched capsule
 * astride the edge (so a wall or a duct side standing at the edge blocks
 * it) and another a radius and a step past it, both at the top. Nothing
 * hurts to fall from (there is no fall damage), so any clear edge is a way
 * down.
 */
function canLeaveBy(h, box, face) {
  const half = { x: S.radius, y: S.crouchHeight / 2, z: S.radius };
  const y = box.max.y + half.y + S.mantleClearance;
  const edgeX = face.nx > 0 ? box.max.x : box.min.x;
  const edgeZ = face.nz > 0 ? box.max.z : box.min.z;
  for (const t of [0.5, 0.25, 0.75]) {
    const alongX = face.nx !== 0 ? edgeX : box.min.x + (box.max.x - box.min.x) * t;
    const alongZ = face.nz !== 0 ? edgeZ : box.min.z + (box.max.z - box.min.z) * t;
    let clear = true;
    for (const out of [0, S.radius + 0.3]) {
      if (!h.map.collision.isClear({ x: alongX + face.nx * out, y, z: alongZ + face.nz * out }, half)) {
        clear = false;
        break;
      }
    }
    if (clear) return true;
  }
  return false;
}

/**
 * Is there a wide solid at this box's level touching it - the deck beside a
 * lip, the duct floor beyond its lip, the next roof slab - that a body on
 * top simply walks onto?
 */
function walkOffOnto(h, box) {
  const minSupport = S.radius * 2;
  for (const other of h.map.collision.boxes) {
    if (other === box || !other.solid) continue;
    if (Math.abs(other.max.y - box.max.y) > S.reach.stepOver) continue;
    if (other.max.x - other.min.x < minSupport || other.max.z - other.min.z < minSupport) continue;
    const gap = 0.05;
    const touchesX = other.min.x <= box.max.x + gap && other.max.x >= box.min.x - gap;
    const touchesZ = other.min.z <= box.max.z + gap && other.max.z >= box.min.z - gap;
    if (touchesX && touchesZ) return other;
  }
  return null;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'every-stacked-climb-is-a-step-of-a-declared-route',
    spec: 'Section 5, amended / v2 requirement 4',
    name: 'The routes the map declares climb as declared, and every leg up is on one of them',
    run: (h) => {
      const problems = [];
      const routes = h.map.routes;
      if (!routes || !routes.length) return { pass: false, detail: 'the map declares no routes' };

      // Forward: each route, stage by stage, through the rule's approaches.
      const onRoute = new Set();
      let stages = 0;
      for (const route of routes) {
        let below = null;
        for (let i = 0; i < route.stages.length; i++) {
          const stage = route.stages[i];
          for (const box of stage) {
            if (typeof box === 'string') { problems.push(`${route.id}: no box tagged ${box}`); continue; }
            onRoute.add(box);
            if (!box.climbable) { problems.push(`${route.id}: ${box.tag} is not climbable`); continue; }
            if (i === 0) {
              // A first step is found on foot: from walkable ground and no
              // higher than a standing reach.
              if (!fromWalkableGround(h, box, S.reach.standing)) {
                problems.push(`${route.id}: first step ${box.tag} is not a standing climb from walkable ground`);
              }
            } else if (!fromAnyOf(h, box, below)) {
              problems.push(`${route.id}: ${box.tag} is not climbable from ${below.map((b) => b.tag).join('/')}`);
            }
          }
          below = stage;
          stages++;
        }
        // It lands where it says: a climbable surface at the landing height
        // that the rule names from some stage of the route.
        const every = route.stages.flat();
        const landings = h.map.collision.boxes.filter((box) =>
          box.climbable && Math.abs(box.max.y - route.landing) < 0.01 && fromAnyOf(h, box, every));
        if (!landings.length) problems.push(`${route.id}: nothing at ${route.landing}m is climbable from it`);
        for (const box of landings) onRoute.add(box);
      }

      // Backward: every leg up is on some route. A leg up, by the rule: a
      // climbable surface with no usable approach from walkable ground.
      const legUps = h.map.collision.boxes.filter((box) => box.climbable && !fromWalkableGround(h, box));
      const unexplained = legUps.filter((box) => !onRoute.has(box)).map((box) => box.tag || 'box');
      if (unexplained.length) {
        problems.push(`${unexplained.length} stacked climbs no route explains: ${unexplained.join(', ')}`);
      }
      debugTools.logResult(`routes: ${legUps.length} stacked climbs by the rule: ${legUps.map((b) => b.tag).join(', ')}`);

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${routes.length} routes, ${stages} stages, every stage climbs from the one below and the `
            + `first from walkable ground within a standing reach; ${legUps.length} stacked climbs by the `
            + 'rule, every one a stage or a landing of a route'
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'every-climbable-top-has-an-exit-that-is-not-the-way-you-came',
    spec: 'Section 5, amended',
    name: 'No dead climbs: from every climbable top there is somewhere to go but back',
    run: (h) => {
      const dead = [];
      let onward = 0;
      let walked = 0;
      let dropped = 0;
      const boxes = h.map.collision.boxes;
      for (const box of boxes) {
        if (!box.climbable) continue;
        // 1. Something to climb next, from up here.
        if (boxes.some((other) => other !== box && other.climbable && fromAnyOf(h, other, [box]))) {
          onward++;
          continue;
        }
        // 2. Something at this level to walk onto.
        if (walkOffOnto(h, box)) {
          walked++;
          continue;
        }
        // 3. An edge to drop from that is not the one you climbed. With two
        // clear faces one of them is always the other one; with one, it
        // must not also be the only way up.
        const leave = FACES.filter((face) => canLeaveBy(h, box, face));
        const ways = new Set(usableApproaches(h, box).map((a) => `${a.nx},${a.nz}`));
        const other = leave.filter((face) => !ways.has(`${face.nx},${face.nz}`));
        if (leave.length >= 2 || other.length >= 1) {
          dropped++;
          continue;
        }
        dead.push(`${box.tag || 'box'} (${leave.length} clear face${leave.length === 1 ? '' : 's'}, `
          + `${ways.size} way${ways.size === 1 ? '' : 's'} up)`);
      }
      return {
        pass: dead.length === 0,
        detail: dead.length === 0
          ? `${onward + walked + dropped} climbable tops: ${onward} lead to another climb, ${walked} onto `
            + `a surface at their level, ${dropped} have a second edge to drop from`
          : `${dead.length} dead climbs: ${dead.join('; ')}`,
      };
    },
  });
}
