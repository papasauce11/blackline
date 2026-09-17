/**
 * BLACKLINE - tests/yard.js
 *
 * AUTO suite: D2, the container yard's shape. Two checks, both scoped to
 * `yard` because both name its geometry - the container's height and the
 * tiers a stack can reach (`CONTAINER`, `TIERS`, maps/yarddata.js):
 *
 *   - The tops of the one-high containers are ONE CONNECTED DECK (v2
 *     requirement 2, re-read for outdoors): from any container top the
 *     Shade reaches every other without touching the ground - along a row
 *     where boxes touch, up a tier where the climb rule names an approach
 *     from the top below, and down again by the drop that is its reverse.
 *     The gates are the test: the ring is cut there and the arches laid
 *     across them are what keep it one surface.
 *
 *   - One high is a jump and a grab, two high needs a stack (QUEUE.md's
 *     words for D2): the container is taller than a standing reach and
 *     inside a jumping one; every top above the first tier has no way up
 *     from the ground by the rule and one from the tier below; and the
 *     controller, stood on the tier below, gets onto the second.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { classifyReach } from '../physics.js';
import { CONTAINER, TIERS } from '../maps/yarddata.js';
import { landingFits, onWalkableGround } from './readability.js';

const S = CONFIG.shade;
const FULL_REACH = S.reach.standing + S.reach.jumpBonus;
/** The rise a climb has to be before it begins with a grab (D22). */
const HANG_MIN = S.standHeight * S.hangMinHeightRatio;
/** A top within this of a tier height is at that tier. */
const TIER_TOLERANCE = 0.01;

/** The rule's approaches onto `box` that a body could take: in reach, with a landing. */
function usableApproaches(h, box) {
  return h.map._supportApproaches(box).filter((approach) => {
    const move = classifyReach(approach.rise, FULL_REACH);
    return move !== null && move !== 'step' && landingFits(h, box, approach);
  });
}

/** Which tier a top is at, or -1 for a top at no tier (a prop, the ground). */
function tierOf(box) {
  for (let i = 0; i < TIERS.length; i++) {
    if (Math.abs(box.max.y - TIERS[i]) <= TIER_TOLERANCE) return i;
  }
  return -1;
}

/** Do these two boxes touch at the same level - a body walks from one top onto the other? */
function touching(a, b) {
  if (Math.abs(a.max.y - b.max.y) > S.reach.stepOver) return false;
  const gap = 0.05;
  return a.min.x <= b.max.x + gap && a.max.x >= b.min.x - gap
    && a.min.z <= b.max.z + gap && a.max.z >= b.min.z - gap;
}

/**
 * Stand on `support` in front of `face` of `box` at the approach the rule
 * names, hold W and Space with the press repeated, and report whether the
 * feet got onto the top - the census's own way of asking (tests/readability.js).
 */
function climbFrom(h, box, approach) {
  const shade = h.shade;
  shade.reset({ position: { x: approach.x, y: approach.y, z: approach.z }, yaw: Math.atan2(approach.nx, approach.nz) });
  h.stepFrames(2);
  h.input.clearAll();
  h.input.heldCodes.add('KeyW');
  h.input.heldCodes.add('Space');
  let climbed = false;
  for (let step = 0; step < 90 && !climbed; step++) {
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
    id: 'the-container-tops-are-one-connected-deck',
    spec: 'v2 requirement 2, re-read for outdoors (D2)',
    name: 'From any container top the Shade reaches every other along the rows, up the stacks and over the gate arches, never touching the ground',
    maps: ['yard'],
    run: (h) => {
      const problems = [];
      const boxes = h.map.collision.boxes.filter((box) => box.solid && box.climbable && tierOf(box) >= 0);
      if (boxes.length < 20) problems.push(`${boxes.length} climbable container tops; a yard has more`);

      // Union-find over the tops: an edge where two touch at a level, and
      // one where the rule names a climb from one onto the other (the drop
      // back is the same edge the other way).
      const parent = boxes.map((_, i) => i);
      const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
      const join = (i, j) => { parent[find(i)] = find(j); };
      let walks = 0;
      let climbs = 0;
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          if (touching(boxes[i], boxes[j])) { join(i, j); walks++; }
        }
        for (const approach of usableApproaches(h, boxes[i])) {
          const j = boxes.indexOf(approach.box);
          if (j === -1) continue;
          join(i, j);
          climbs++;
        }
      }
      const components = new Map();
      for (let i = 0; i < boxes.length; i++) {
        const root = find(i);
        if (!components.has(root)) components.set(root, []);
        components.get(root).push(boxes[i].tag || 'box');
      }
      if (components.size !== 1) {
        const islands = [...components.values()].sort((a, b) => a.length - b.length).slice(0, -1);
        problems.push(`${components.size} pieces: ${islands.map((names) => names.join('+')).join('; ')} are cut off from the rest`);
      }

      // The gates are where the ring is cut, so the arches have to carry it:
      // each arch is climbable from a ring top on BOTH sides of its gate.
      for (const side of ['north', 'south']) {
        const arch = boxes.find((box) => box.tag === `arch-${side}`);
        if (!arch) { problems.push(`no arch-${side}`); continue; }
        const from = new Set(usableApproaches(h, arch).map((a) => a.box.tag));
        const west = [...from].some((tag) => tag && tag.startsWith(`ring-${side}-w`));
        const east = [...from].some((tag) => tag && tag.startsWith(`ring-${side}-e`));
        if (!west || !east) problems.push(`arch-${side} is climbed from ${[...from].join(', ') || 'nothing'}, not from the ring on both sides`);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${boxes.length} container tops at ${TIERS.map((t) => t.toFixed(1)).join('/')}m: ${walks} touch at a level, `
            + `${climbs} climbs between them by the rule; one connected deck, carried over both gates by the arches`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'one-high-is-a-jump-and-two-high-needs-a-stack',
    spec: 'Section 6.1 amended / D2 / D35',
    name: 'A container top is a jump and a grab from the ground; every higher tier has no way up from the ground and one from the tier below, and the controller climbs it from there',
    maps: ['yard'],
    run: (h) => {
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
      h.menu.hide();
      h.setPaused(false);
      const problems = [];
      const height = CONTAINER.height;

      // The numbers first: what one container's height means to the body.
      if (classifyReach(height, S.reach.standing) !== null) {
        problems.push(`a ${height}m container is within a standing reach of ${S.reach.standing}m, so one high is walked up`);
      }
      if (classifyReach(height, FULL_REACH) === null) {
        problems.push(`a ${height}m container is beyond the jump's reach of ${FULL_REACH}m, so nothing here is climbed`);
      }
      if (height < HANG_MIN) problems.push(`${height}m is under the hang height ${HANG_MIN.toFixed(2)}m, so a container top is not grabbed`);
      if (classifyReach(2 * height, FULL_REACH) !== null) {
        problems.push(`two high (${2 * height}m) is within the jump's reach, so a stack is not needed`);
      }

      // Every top is at a tier or under the first; every tier is built.
      const climbable = h.map.collision.boxes.filter((box) => box.solid && box.climbable);
      const byTier = TIERS.map(() => []);
      for (const box of climbable) {
        const tier = tierOf(box);
        if (tier >= 0) byTier[tier].push(box);
        else if (box.max.y > TIERS[0]) problems.push(`${box.tag || 'a box'} tops out at ${box.max.y.toFixed(2)}m, which is no tier`);
      }
      for (let i = 0; i < TIERS.length; i++) {
        if (!byTier[i].length) problems.push(`nothing is ${i + 1} high`);
      }

      // Above the first tier: no way up from the ground, a way up from the
      // tier below. The census reports these as needing a leg up; here they
      // are required to.
      let stacked = 0;
      let driven = 0;
      for (let tier = 1; tier < TIERS.length; tier++) {
        for (const box of byTier[tier]) {
          const ways = usableApproaches(h, box);
          if (ways.some((a) => onWalkableGround(h, { x: a.x, z: a.z }, a.y))) {
            problems.push(`${box.tag} (${tier + 1} high) is climbable from walkable ground`);
          }
          const below = ways.filter((a) => tierOf(a.box) === tier - 1);
          if (!below.length) {
            problems.push(`${box.tag} (${tier + 1} high) has no approach from a top ${tier} high`);
            continue;
          }
          stacked++;
          // And the controller does it: from the first approach the rule
          // names on the tier below.
          if (!climbFrom(h, box, below[0])) {
            problems.push(`${box.tag}: from ${below[0].box.tag} at (${below[0].x.toFixed(1)}, ${below[0].z.toFixed(1)}) the controller did not get on top`);
          } else {
            driven++;
          }
        }
      }

      h.shade.reset(h.map.shadeSpawns[0]);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `a container is ${height}m: past a standing reach (${S.reach.standing}), inside a jump's (${FULL_REACH}), `
            + `over the hang height (${HANG_MIN.toFixed(2)}); two high is not. ${byTier.map((b, i) => `${b.length} tops ${i + 1} high`).join(', ')}; `
            + `${stacked} above the first tier, none from the ground, every one from the tier below, ${driven} climbed by the controller from there`
          : problems.join('; '),
      };
    },
  });
}
