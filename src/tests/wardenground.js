/**
 * BLACKLINE - tests/wardenground.js
 *
 * AUTO suite: B9, the Warden stays grounded. The redesign's asymmetry is one
 * sentence - the Shade climbs anything within reach, the Warden climbs
 * nothing - and A1 turned the second half into data: `map.wardenGround`,
 * every cell a walking body can reach from its spawns, flooded with the
 * Warden's own step. This check does not re-derive it. It plays the game
 * with the AI driving - a patrol, a plant to defend and defuse, a Shade to
 * chase - through the real fixed step, and asks on every one of them
 * whether the Warden's feet are on that ground. If the AI ever climbs,
 * vaults, gets shoved onto a crate or pushed through a floor, this is where
 * it shows.
 *
 * And one walk is driven by hand (K14). The plant's west deck is a strip two
 * cells wide beside the hall void, and the flood counts a cell as ground when
 * any sliver of the body's footprint overlaps a top face: so the ring's
 * cells ran down the void's rim with their centres over nothing, and a
 * Warden sent from (-29.25, 6, -18.25) to the hall's stair foot walked them,
 * strayed a tenth of a metre and fell the six metres to the hall floor. The
 * soak's patrol never takes that leg, so it never saw it. Clause 4 stands the
 * Warden there, paths it to the stair foot and steps it through the real
 * fixed step, asking on every frame that its feet are on its ground and, for
 * as long as it is walking the deck, that they are not a step below it.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { AI_STATE } from '../systems/ai.js';
import { CHARGE } from '../systems/objective.js';
import { plantAt } from './plantspots.js';
import { exploreSeed } from './seeds.js';

/** The match the Warden is driven through here. `?seed=` moves it; see tests/seeds.js. */
const SOAK_SEED = exploreSeed('warden-ground-soak', 20260914);

const W = CONFIG.warden;
/** A cell centre is at most this far from a foot standing between cells. */
const CELL_NEAR = CONFIG.map.wardenGroundCell * 1.1;
/**
 * How far above its ground an airborne Warden may be. Walking DOWN a stair
 * it is in the air between treads - at 3 m/s it clears a 0.4m tread before
 * it has fallen 0.3m and lands two down - so a descent is a series of short
 * falls over ground that is a little below the feet. A metre is three
 * treads; the deck is six.
 */
const DESCENT = 1.0;

/** The stand the walk-off was measured at, and the tag of the node its leg was for. */
const RING_STAND = { x: -29.25, z: -18.25 };
const RING_NODE_TAG = 'stair-hall-foot';
/** The walk laid, over walking speed, times this, plus `RING_TURNS` seconds, is the time allowed (as patrolleg.js allows a leg). */
const RING_SLACK = 1.5;
const RING_TURNS = 4;

/**
 * Is a foot at `at` on the Warden's ground? Standing: a floor of the column
 * under it within a step - or, since a body stands between cell centres and
 * a column whose centre is inside a wall has no floors while the body beside
 * it is fine, of a cell within one cell's reach. Airborne: a floor that
 * close, no more than `DESCENT` below the feet and no more than a step above
 * them, so a stair is walked down and a deck edge is not.
 */
export function onGround(ground, at, grounded) {
  const drop = grounded ? W.stepHeight : DESCENT;
  const near = (y) => y <= at.y + W.stepHeight && y >= at.y - drop;
  if (ground.floorsAt(at.x, at.z).some(near)) return true;
  return ground.cellsWithin(at, CELL_NEAR).some((cell) => near(cell.y));
}

/**
 * Clause 4: the measured deck-ring walk. Returns what it found as
 * `{ problems, fact }`; the plant has the ring and the yard has no stand like it.
 */
function walkRing(h) {
  const dt = CONFIG.time.fixedDt;
  h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
  h.menu.hide();
  h.input.clearAll();
  const ground = h.map.wardenGround;
  const node = h.map.waypoints.find((n) => n && n.tag === RING_NODE_TAG);
  if (!node) return { problems: [], fact: `no ${RING_NODE_TAG} node on this map, so no deck ring to walk` };
  const deck = Math.max(...h.map.waypoints.filter(Boolean).map((n) => n.position.y));
  const stand = { x: RING_STAND.x, y: deck, z: RING_STAND.z };
  if (!ground.cellAt(stand)) return { problems: [`(${RING_STAND.x}, ${RING_STAND.z}) is on no cell of the Warden's ground at y ${deck}: the stand this clause was measured at has moved`], fact: '' };

  const { warden, wardenAI: ai } = h;
  warden.reset({ position: stand, yaw: 0 });
  ai._enter(AI_STATE.PATROL);
  ai._pauseTimer = 0;
  ai.stuckCount = 0;
  ai.stuckTimer = 0;
  ai._stuckAnchor.x = stand.x;
  ai._stuckAnchor.z = stand.z;
  ai._pathTo(node.position);
  const points = ai._route.length;
  let planned = 0;
  let from = stand;
  for (const p of ai._route) { planned += Math.hypot(p.x - from.x, p.z - from.z); from = p; }
  const limit = (planned / W.walkSpeed) * RING_SLACK + RING_TURNS;

  const at = { x: 0, y: 0, z: 0 };
  const problems = [];
  let lowest = { y: Infinity, x: 0, z: 0 };
  let frames = 0;
  let arrived = false;
  let onDeck = true;
  const steps = Math.round(limit / dt);
  for (let f = 0; f < steps && !arrived; f++) {
    // Which floor the leg is on is the point it is walking to: once that is
    // below the deck the body is on the stair, and the descent is allowed.
    const target = ai._route[ai._routeIndex];
    if (target && target.y < deck - W.stepHeight) onDeck = false;
    warden.step(dt, ai.step(dt, { shade: null }));
    frames++;
    at.x = warden.position.x;
    at.y = warden.feetY;
    at.z = warden.position.z;
    if (onDeck && at.y < lowest.y) lowest = { y: at.y, x: at.x, z: at.z };
    if (!onGround(ground, at, warden.grounded) && problems.length < 3) {
      problems.push(`frame ${f}: feet off the Warden's ground at (${at.x.toFixed(2)}, ${at.y.toFixed(2)}, ${at.z.toFixed(2)})`);
    }
    if (onDeck && at.y < deck - W.stepHeight && problems.length < 3) {
      problems.push(`frame ${f}: off the deck, feet at ${at.y.toFixed(2)} where the deck is ${deck}, at (${at.x.toFixed(2)}, ${at.z.toFixed(2)}), walking to route point ${ai._routeIndex} of ${points}`);
      onDeck = false;
    }
    arrived = Math.hypot(at.x - node.position.x, at.z - node.position.z) <= CONFIG.ai.waypointArriveRadius + 0.2
      && Math.abs(at.y - node.position.y) <= CONFIG.ai.waypointArriveRise + 0.15;
  }
  if (!arrived) problems.push(`${frames} frames (${(frames * dt).toFixed(1)}s of ${limit.toFixed(1)}s allowed) and the Warden never reached ${RING_NODE_TAG}`);
  return {
    problems,
    fact: `the deck ring from (${RING_STAND.x}, ${deck}, ${RING_STAND.z}) to ${RING_NODE_TAG}: ${frames} frames over ${points} route points, `
      + `lowest feet on the deck ${lowest.y.toFixed(2)}m (${lowest.x.toFixed(2)}, ${lowest.z.toFixed(2)}) against its ${deck}m, ${arrived ? 'arrived' : 'did not arrive'}`,
  };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-warden-never-leaves-its-ground',
    spec: 'Section 6.2 / Section 11 / Block A phase 1 (B9)',
    name: 'Through a patrol, a defended plant and a chase driven by the AI, the Warden is on its own ground every step',
    run: (h) => {
      const problems = [];
      const dt = CONFIG.time.fixedDt;
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true, seed: SOAK_SEED });
      h.menu.hide();
      h.setPaused(false);
      h.input.clearAll();
      const ground = h.map.wardenGround;
      if (!ground) return { pass: false, detail: 'map.wardenGround was never derived' };
      const warden = h.warden;
      const ai = h.wardenAI;
      // Four rifle rounds kill the Shade and end the chase early.
      h.debugState.godMode = true;

      let steps = 0;
      let off = 0;
      let airborne = 0;
      let highest = -Infinity;
      const states = new Set();
      const phases = [];
      const at = { x: 0, y: 0, z: 0 };
      const watch = (label, count) => {
        let offHere = 0;
        for (let i = 0; i < count; i++) {
          h.stepFrames(1);
          steps++;
          states.add(ai.state);
          at.x = warden.position.x;
          at.y = warden.feetY;
          at.z = warden.position.z;
          highest = Math.max(highest, at.y);
          if (!warden.grounded) airborne++;
          if (!onGround(ground, at, warden.grounded)) {
            offHere++;
            if (off < 3) {
              problems.push(`${label}, step ${i} (${ai.state}): the Warden's feet are off its ground at `
                + `(${at.x.toFixed(2)}, ${at.y.toFixed(2)}, ${at.z.toFixed(2)}), grounded=${warden.grounded}`);
            }
            off++;
          }
        }
        if (!label.includes('+')) phases.push(`${label} ${count} steps, ${offHere} off`);
        else phases[phases.length - 1] = phases[phases.length - 1].replace(/(\d+) steps, (\d+) off$/, (m, s, o) => `${Number(s) + count} steps, ${Number(o) + offHere} off`);
      };

      // 1. A patrol, with the Shade parked at its spawn out of sight.
      watch('patrol', Math.round(20 / dt));

      // 2. A hunt, from the patrol (Section 16 check 12 is the shape): the Shade dropped near the Warden and sprinting in
      // circles - a noise it hears (Section 7.2), a body it may see - so the
      // AI leaves its route for ground it picks itself: SUSPICIOUS,
      // INVESTIGATE, ENGAGE, SEARCH. The phase has to have moved it, or it
      // proved nothing about those states.
      const seenBefore = new Set(states);
      let dropped = false;
      for (let k = 0; k < 8 && !dropped; k++) {
        const angle = (k / 8) * Math.PI * 2;
        const spot = { x: warden.position.x + Math.sin(angle) * 5, y: warden.feetY, z: warden.position.z + Math.cos(angle) * 5 };
        const centre = { x: spot.x, y: spot.y + CONFIG.shade.standHeight / 2 + 0.02, z: spot.z };
        if (!h.map.collision.isClear(centre, h.shade.half)) continue;
        const under = h.map.collision.raycast({ x: spot.x, y: spot.y + 0.1, z: spot.z }, { x: 0, y: -1, z: 0 }, 0.3);
        if (!under) continue;
        h.shade.reset({ position: spot, yaw: angle });
        dropped = true;
      }
      if (!dropped) h.shade.reset(h.map.shadeSpawns[0]);
      h.input.clearAll();
      h.input.heldCodes.add('KeyW');
      h.input.heldCodes.add('ShiftLeft');
      const hunt = Math.round(20 / dt);
      for (let i = 0; i < hunt; i += 30) {
        h.shade.yaw += 0.9;
        watch(i === 0 ? 'hunt' : `hunt+${i}`, Math.min(30, hunt - i));
      }
      h.input.clearAll();
      const moved = [...states].filter((state) => !seenBefore.has(state));
      if (!moved.length) problems.push(`the hunt never took the AI out of [${[...seenBefore].join(' ')}]`);

      // 3. A plant, and the AI walking its last leg to defend and defuse it.
      // The charge goes where the plant rule allows, off the ring, at site A.
      const planted = plantAt(h, h.map.sites[0].id);
      if (h.objective.round.charge !== CHARGE.PLANTED) {
        problems.push(`the plant at ${h.map.sites[0].id} did not take in ${planted.toFixed(1)}s`);
      } else {
        // Out of the way, so the defuse is not interrupted by a sighting.
        h.shade.reset(h.map.shadeSpawns[0]);
        watch('defend', Math.round(30 / dt));
        if (!states.has(AI_STATE.DEFEND)) problems.push('the AI never entered DEFEND for the planted charge');
      }

      h.debugState.godMode = false;
      if (h.debugTools.assertionFailures !== 0) problems.push(`${h.debugTools.assertionFailures} runtime assertion failures`);

      // 4. The deck ring, walked by hand: the leg the soak's patrol never takes (K14).
      const ring = walkRing(h);
      problems.push(...ring.problems);
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      return {
        pass: problems.length === 0 && off === 0,
        detail: problems.length === 0 && off === 0
          ? `${steps} steps of AI-driven play (${phases.join('; ')}), states [${[...states].join(' ')}]: `
            + `the Warden's feet were on map.wardenGround every step (${airborne} of them airborne, all within `
            + `${DESCENT}m over it - a stair walked down), highest ${highest.toFixed(2)}m; ${ring.fact}`
          : problems.concat(off > 3 ? [`${off} steps off the ground in all`] : []).join('; '),
      };
    },
  });
}
