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

/** The highest solid top under (x, z) below `ceiling`: the ground there. */
function groundUnder(h, x, z, ceiling) {
  let best = null;
  for (const box of h.map.collision.boxes) {
    if (!box.solid || box.max.y >= ceiling) continue;
    if (x < box.min.x || x > box.max.x || z < box.min.z || z > box.max.z) continue;
    if (best === null || box.max.y > best) best = box.max.y;
  }
  return best;
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

  debugTools.registerAutoTest({
    id: 'a-mantle-never-passes-through-a-solid',
    spec: 'Section 6.1 (parkour safety rule) / B5c',
    name: 'From where a climb starts to where it lands, the body is in open air - by the rule and by the controller',
    run: (h) => {
      // B6's approach survey found the rule naming a climb onto a duct lip
      // from the ground UNDER the duct: the lip's face is exposed beneath the
      // floor slab, the landing inside the mouth is a legal crouch, and the
      // mantle carried the body straight up through the floor. The safety
      // rule validates where a move ends; this asks about the way there.
      const problems = [];

      // By the rule: no approach it names starts under a solid it lands
      // over. A mantle is a diagonal from the spot to the landing, and every
      // one goes over the corner of the box it climbs - so "passes through"
      // cannot mean "touches": at a duct mouth the floor slab is coincident
      // with the lip's top and the body brushes both. What it means is a
      // solid that is over the spot - its footprint contains it, its
      // underside is above the feet - and under the landing. The body would
      // have to go through it to get from one to the other. A fact about the
      // geometry, asked without the rule's own sweep.
      let approaches = 0;
      for (const box of h.map.collision.boxes) {
        if (!box.climbable) continue;
        for (const approach of usableApproaches(h, box)) {
          approaches++;
          for (const other of h.map.collision.boxes) {
            if (other === box || !other.solid) continue;
            if (approach.x < other.min.x || approach.x > other.max.x) continue;
            if (approach.z < other.min.z || approach.z > other.max.z) continue;
            if (other.min.y <= approach.y + 0.01) continue;
            if (other.max.y > box.max.y + 0.01) continue;
            problems.push(`${box.tag} from ${approach.box.tag} at ${approach.x.toFixed(2)},${approach.z.toFixed(2)}: `
              + `${other.tag} is over the spot (${other.min.y.toFixed(2)}-${other.max.y.toFixed(2)}m) and under the `
              + `${box.max.y.toFixed(2)}m landing`);
          }
        }
      }

      // By the controller, without asking the rule: stand on the ground
      // under each low duct's floor slab, a hand's reach short of its lip,
      // face the lip and hold W and Space - the spot the rule used to name.
      // The body must not rise into the slab, and the press must not be
      // silent (20.5): the hands are on a face they cannot get over.
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      h.setPaused(false);
      const shade = h.shade;
      let tried = 0;
      for (const vent of h.map.vents) {
        const floor = vent.boxes.find((box) => box.tag === `${vent.tag}-floor`);
        if (!floor) continue;
        const alongX = vent.axis === 'x';
        for (const lip of vent.boxes.filter((box) => /-lip-(from|to)$/.test(box.tag))) {
          const from = lip.tag.endsWith('-lip-from');
          const inward = from ? 1 : -1;
          const innerFace = alongX ? (from ? lip.max.x : lip.min.x) : (from ? lip.max.z : lip.min.z);
          const along = innerFace + inward * (S.radius + 0.55);
          const cross = alongX ? (vent.min.z + vent.max.z) / 2 : (vent.min.x + vent.max.x) / 2;
          const x = alongX ? along : cross;
          const z = alongX ? cross : along;
          const feet = groundUnder(h, x, z, floor.min.y);
          // A lip beyond full reach from the ground under it (the upper vent,
          // 4.3m) is not a climb anyone can attempt; a press there is a jump.
          if (feet === null || lip.max.y - feet > FULL_REACH) continue;
          tried++;
          // Facing the lip: back toward the mouth, against `inward`.
          const dirX = alongX ? -inward : 0;
          const dirZ = alongX ? 0 : -inward;
          shade.reset({ position: { x, y: feet, z }, yaw: Math.atan2(-dirX, -dirZ) });
          h.stepFrames(2);
          const scuffs = shade.scuffs;
          h.input.clearAll();
          h.input.heldCodes.add('KeyW');
          h.input.heldCodes.add('Space');
          let highest = shade.feetY;
          for (let step = 0; step < 90; step++) {
            if (step % 22 === 0) h.input.pressedCodes.add('Space');
            h.stepFrames(1);
            h.input.clearEdges();
            highest = Math.max(highest, shade.feetY);
          }
          h.input.clearAll();
          if (highest > floor.min.y - 0.05) {
            problems.push(`${lip.tag} from under the duct at ${x.toFixed(2)},${z.toFixed(2)}: the body rose to `
              + `${highest.toFixed(2)}m, into a floor slab whose underside is ${floor.min.y.toFixed(2)}m`);
          } else if (shade.scuffs === scuffs) {
            problems.push(`${lip.tag} from under the duct: the press was silent - no climb and no scuff`);
          }
        }
      }
      if (tried < 4) problems.push(`only ${tried} under-the-floor spots driven; the two low ducts have four lips`);

      h.input.clearAll();
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${approaches} approaches by the rule, none starting under a solid it lands over; ${tried} presses `
            + 'from under a duct floor, every one a scuff with the body still under the slab'
          : problems.join('; '),
      };
    },
  });
}
