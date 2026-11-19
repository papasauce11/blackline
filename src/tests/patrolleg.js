/**
 * BLACKLINE - tests/patrolleg.js
 *
 * AUTO suite (K11): a Warden beginning a patrol leg from anywhere reaches the
 * node the leg is for.
 *
 * **What was wrong.** `_pathTo` laid a leg as the graph's nodes with only the
 * *last* stretch planned over the ground; the first, from the feet to the node
 * nearest them, was a straight line. "Nearest" is in the air, and two things
 * followed. A Warden that had slid along a crate into a pocket the flood left
 * out - the plant's hall floor at (-12, -17), on no cell - had no start for the
 * planner, so the straight line to the hall-north node ten metres west, with
 * the crate between, was laid again every time. And a Warden 1.7m short of the
 * vault door was sent to the door's node and straight back through the frame,
 * turning on the spot long enough to be called wedged. The stuck detector was
 * not blind - it fired every two seconds, seven times in the first measurement
 * - but a re-path begins at the same feet and chose the same node, so what it
 * laid was the route it had just failed on. The fix is `_leadTo` and the
 * skipped first node in ainav.js's `_pathTo`.
 *
 * **The scene.** A match with the Warden alone in it, as `ai-patrols-without-
 * getting-stuck` steps it: `warden.step(dt, ai.step(dt, { shade: null }))`, so
 * it stays in PATROL and the only thing that can stop it is the map. A stand
 * is put the Warden's feet on, `_pathTo` the leg's node lays what `_stepPatrol`
 * lays on arriving at the one before it, and the body is stepped until it is
 * within the follower's arrival radius of the node, on the node's floor.
 *
 *   (a) the plant's spot   (-12, -17), to the node at the hall's west stair
 *                          foot: the stand the freeze was measured at. Named
 *                          by coordinate because it is the one measured stand;
 *                          the yard has no such spot and the detail says so
 *                          rather than inventing one.
 *   (b) the sweep          every ground cell within `NEAR` of a waypoint on its
 *                          own floor, thinned to every `THIN`th, walks to a node
 *                          beyond `ai.directRouteRange` (rotating through them,
 *                          so each is walked to from some stand). The count and
 *                          the slowest arrival are in the detail.
 *
 * **Which legs.** Beyond `directRouteRange` only: a nearer goal is planned
 * from the feet over the ground with no node in it (D5), which is a different
 * route with a different failure - the plant's vault door, from (17.25, 4.75)
 * to site-c, grazes the jamb on a pulled segment and slides at a tenth of a
 * metre a second - and is not what a circuit leg's first node is about. It is
 * recorded in PROGRESS.md, and K12 walks it: clause (c) is every short leg of the
 * same stands, clause (d) that very leg, with a re-path after a stuck planned
 * at `ai.stuckEdgeMargin`.
 *
 * **The time allowed** is the walk the route itself lays, at the Warden's
 * walking speed, with `SLACK` over for the bends and the stairs and `TURNS`
 * seconds for turning round on the spot at the start and the end (two half
 * turns at `ai.turnRate` are under two seconds): a leg that is not there by
 * then is going somewhere else. Measured over both maps' stands (327 on the
 * plant, 339 on the yard) the slowest leg took 67% and 61% of its allowance,
 * 25.0s and 27.4s, and the plant's spot 7.6s of 16.4s; the detail prints them.
 * Before the fix, with the first leg left to a straight line, both maps froze
 * stands in the sweep and the spot never left (-12, -17). `FROZEN`
 * seconds without moving `PINNED` metres ends a leg early as a failure, which
 * keeps a red cheap.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { AI_STATE } from '../systems/ai.js';

const dt = CONFIG.time.fixedDt;
const A = CONFIG.ai;

/** Metres around a waypoint the sweep's stands are taken from. */
const NEAR = 2;
/** Every this many cells of the ones near a waypoint is a stand. */
const THIN = 3;
/** A node is reached inside the follower's arrival radius and a stride's margin, on its own floor within this. */
const ARRIVE = A.waypointArriveRadius + 0.2;
const SAME_FLOOR = 1;
/** Seconds without moving `PINNED` metres that ends a leg as a freeze. */
const FROZEN = 6;
const PINNED = 0.5;
/** The walk laid, over walking speed, times this, plus `TURNS` seconds: the time a leg is allowed. */
const SLACK = 1.5;
const TURNS = 4;

/** The one stand the freeze was measured at, and the node its leg was for. */
const SPOT = { x: -12, z: -17 };
const SPOT_NODE_TAG = 'stair-hall-foot';

/** K12's measured leg: the raw point the jamb pinned a body at, and the node it was walking to. */
const JAMB = { x: 17.25, z: 4.75 };
const JAMB_NODE_TAG = 'site-c';
/** A short leg's goal is at least this far from its stand. */
const SHORT_FLOOR = 2;

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const fresh = (h) => h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });

/** Length of the route the AI laid, from `from` along every point of it. */
function routeLength(ai, from) {
  let length = 0;
  let at = from;
  for (const p of ai._route) { length += flat(at, p); at = p; }
  return length;
}

/**
 * Stand the Warden on `stand`, lay the leg to `node` and walk it. Returns how it
 * ended: 'arrived' with the seconds taken, 'frozen' or 'timeout' with where it
 * was, how many times the stuck detector fired along the way, and the metres
 * the route laid (which is what the time allowed is made of).
 */
function walkLeg(h, stand, node) {
  const { warden, wardenAI: ai } = h;
  warden.reset({ position: { x: stand.x, y: stand.y, z: stand.z }, yaw: 0 });
  ai._enter(AI_STATE.PATROL);
  ai._pauseTimer = 0;
  ai.stuckCount = 0;
  ai.stuckTimer = 0;
  ai._stuckAnchor.x = stand.x;
  ai._stuckAnchor.z = stand.z;
  ai._pathTo(node.position);

  const planned = routeLength(ai, stand);
  const limit = (planned / CONFIG.warden.walkSpeed) * SLACK + TURNS;
  const window = Math.round(FROZEN / dt);
  const steps = Math.round(limit / dt);
  let anchor = { x: warden.position.x, z: warden.position.z };
  let anchorStep = 0;
  for (let f = 0; f < steps; f++) {
    warden.step(dt, ai.step(dt, { shade: null }));
    if (flat(warden.position, node.position) <= ARRIVE && Math.abs(warden.feetY - node.position.y) < SAME_FLOOR) {
      return { how: 'arrived', seconds: (f + 1) * dt, planned, limit, stuck: ai.stuckCount };
    }
    if (f - anchorStep >= window) {
      if (flat(warden.position, anchor) < PINNED) {
        return { how: 'frozen', seconds: (f + 1) * dt, planned, limit, stuck: ai.stuckCount, at: warden.position };
      }
      anchor = { x: warden.position.x, z: warden.position.z };
      anchorStep = f;
    }
  }
  return { how: 'timeout', seconds: limit, planned, limit, stuck: ai.stuckCount, at: warden.position };
}

/** The sweep's stands: ground within `NEAR` of each waypoint on its own floor, thinned, each with a node beyond the direct range to walk to. */
function stands(h) {
  const out = [];
  const seen = new Set();
  const ground = h.map.wardenGround;
  const nodes = h.map.waypoints.filter(Boolean);
  for (const node of nodes) {
    let k = 0;
    for (const c of ground.cellsWithin(node.position, NEAR)) {
      if (Math.abs(c.y - node.position.y) > SAME_FLOOR) continue;
      const key = `${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (k++ % THIN) continue;
      const far = nodes.filter((n) => flat(n.position, c) > A.directRouteRange + 1);
      if (!far.length) continue;
      out.push({ at: { x: c.x, y: c.y, z: c.z }, near: node, goal: far[(k / THIN | 0) % far.length] });
    }
  }
  return out;
}

/**
 * K12's population: the same stands, each with a node on its own floor within
 * `directRouteRange` (and past `SHORT_FLOOR`, so a stand is not on its goal),
 * which `_pathTo` plans from the feet over the ground with no node in it.
 */
function shortStands(h) {
  const out = [];
  const seen = new Set();
  const ground = h.map.wardenGround;
  const nodes = h.map.waypoints.filter(Boolean);
  for (const node of nodes) {
    let k = 0;
    for (const c of ground.cellsWithin(node.position, NEAR)) {
      if (Math.abs(c.y - node.position.y) > SAME_FLOOR) continue;
      const key = `${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (k++ % THIN) continue;
      const close = nodes.filter((n) => {
        const d = flat(n.position, c);
        return d > SHORT_FLOOR && d <= A.directRouteRange && Math.abs(n.position.y - c.y) <= SAME_FLOOR;
      });
      if (!close.length) continue;
      out.push({ at: { x: c.x, y: c.y, z: c.z }, near: node, goal: close[(k / THIN | 0) % close.length] });
    }
  }
  return out;
}

/** The route the AI holds, as a string of its points to 2dp. */
const routeKey = (ai) => ai._route.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`).join(' ');

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-warden-starting-a-patrol-leg-anywhere-reaches-its-node',
    spec: 'Section 11 / K11',
    name: 'A Warden beginning a patrol leg from the plant\'s hall pocket or from stands around the circuit reaches the leg\'s node, and does not freeze on the way',
    run: (h) => {
      const problems = [];
      fresh(h);
      h.menu.hide();
      h.input.clearAll();
      const ground = h.map.wardenGround;
      if (!ground) return { pass: false, detail: 'map.wardenGround was never derived' };
      const facts = [];

      // (a) The stand the freeze was measured at.
      const goal = h.map.waypoints.find((node) => node && node.tag === SPOT_NODE_TAG);
      if (goal) {
        // The raw point, not a cell centre: it is on no cell of the Warden's ground (that is the stall), so `standAt` would return null.
        const spot = { x: SPOT.x, y: goal.position.y, z: SPOT.z };
        if (ground.cellAt(spot)) problems.push(`(${SPOT.x}, ${SPOT.z}) is on the Warden's ground now: the stand this clause was measured at has moved`);
        const leg = walkLeg(h, spot, goal);
        facts.push(`spot (${SPOT.x}, ${SPOT.z}) to ${SPOT_NODE_TAG}: ${leg.how} in ${leg.seconds.toFixed(1)}s of ${leg.limit.toFixed(1)}s`);
        if (leg.how !== 'arrived') {
          problems.push(`from (${SPOT.x}, ${SPOT.z}) to ${SPOT_NODE_TAG} the Warden ${leg.how} after ${leg.seconds.toFixed(1)}s at (${leg.at.x.toFixed(1)}, ${leg.at.z.toFixed(1)}), stuck re-paths ${leg.stuck}`);
        }
      } else {
        facts.push('no named spot on this map');
      }

      // (b) Stands around the circuit.
      let tried = 0;
      let failed = 0;
      let slowest = null;
      let worst = 0;
      for (const stand of stands(h)) {
        const leg = walkLeg(h, stand.at, stand.goal);
        tried++;
        if (leg.how === 'arrived') {
          const used = leg.seconds / leg.limit;
          if (used > worst) { worst = used; slowest = { stand, leg }; }
        } else {
          failed++;
          if (problems.length < 4) {
            problems.push(`from (${stand.at.x.toFixed(2)}, ${stand.at.z.toFixed(2)}) by ${stand.near.tag || stand.near.id} to ${stand.goal.tag || stand.goal.id} the Warden ${leg.how} after ${leg.seconds.toFixed(1)}s at (${leg.at.x.toFixed(1)}, ${leg.at.z.toFixed(1)}), stuck re-paths ${leg.stuck}`);
          }
        }
      }
      if (tried === 0) problems.push('no stand was found around any waypoint');
      if (failed > 3) problems.push(`${failed} of ${tried} stands did not arrive`);

      // (c) Short legs: a goal within `directRouteRange` is planned from the feet with no node (K12).
      // Zero tolerance: a leg of ten metres or less arrives, or it is a failure and is listed.
      let shortTried = 0;
      let shortFailed = 0;
      for (const stand of shortStands(h)) {
        const leg = walkLeg(h, stand.at, stand.goal);
        shortTried++;
        if (leg.how !== 'arrived') {
          shortFailed++;
          if (shortFailed <= 6) {
            problems.push(`short leg from (${stand.at.x.toFixed(2)}, ${stand.at.z.toFixed(2)}) to ${stand.goal.tag || stand.goal.id} ${leg.how} after ${leg.seconds.toFixed(1)}s at (${leg.at.x.toFixed(1)}, ${leg.at.z.toFixed(1)}), stuck re-paths ${leg.stuck}`);
          }
        }
      }
      if (shortTried === 0) problems.push('no short leg was found around any waypoint');
      if (shortFailed) problems.push(`${shortFailed} of ${shortTried} short legs did not arrive`);

      // (d) The measured case, plant only: the leg that pinned on the vault door's jamb.
      // The plant is told by clause (a)'s node; the yard has no such stand and says so.
      const jambGoal = goal ? h.map.waypoints.find((node) => node && node.tag === JAMB_NODE_TAG) : null;
      if (jambGoal) {
        const jamb = { x: JAMB.x, y: jambGoal.position.y, z: JAMB.z };
        const leg = walkLeg(h, jamb, jambGoal);
        if (leg.how !== 'arrived') {
          problems.push(`from (${JAMB.x}, ${JAMB.z}) to ${JAMB_NODE_TAG} the Warden ${leg.how} after ${leg.seconds.toFixed(1)}s at (${leg.at.x.toFixed(1)}, ${leg.at.z.toFixed(1)}), stuck re-paths ${leg.stuck}`);
        }
        // The re-path, driven the way the detector drives it: a freeze is the
        // anchor not having moved in `stuckTime`, so it is given one, and
        // `_checkStuck` lays what it lays. A call to `_pathTo` here would
        // prove the planner, not that the detector asks for a wider one.
        const { warden, wardenAI: ai } = h;
        warden.reset({ position: { x: jamb.x, y: jamb.y, z: jamb.z }, yaw: 0 });
        ai._enter(AI_STATE.PATROL);
        ai._pauseTimer = 0;
        ai.stuckCount = 0;
        ai._pathTo(jambGoal.position);
        const first = routeKey(ai);
        const firstLength = routeLength(ai, jamb);
        const firstPoints = ai._route.length;
        ai.stuckTimer = A.stuckTime;
        ai._stuckAnchor.x = warden.position.x;
        ai._stuckAnchor.z = warden.position.z;
        ai._checkStuck(dt);
        const second = routeKey(ai);
        const secondLength = routeLength(ai, jamb);
        facts.push(`${JAMB_NODE_TAG} from (${JAMB.x}, ${JAMB.z}): ${leg.how} in ${leg.seconds.toFixed(1)}s, route ${firstLength.toFixed(1)}m of ${firstPoints} points, after a stuck ${secondLength.toFixed(1)}m of ${ai._route.length}`);
        if (ai.stuckCount !== 1) {
          problems.push(`a freeze given to the detector at (${JAMB.x}, ${JAMB.z}) was not counted (stuck ${ai.stuckCount}): the re-path was not driven`);
        } else if (second === first) {
          problems.push(`after a stuck at (${JAMB.x}, ${JAMB.z}) the route did not differ from the one it was stuck on (${firstLength.toFixed(1)}m, ${firstPoints} points both)`);
        }
      } else {
        facts.push(`no ${JAMB_NODE_TAG} stand of the plant's on this map (the jamb leg is the plant's)`);
      }
      const shortNote = `${shortTried} short legs of ${SHORT_FLOOR}-${A.directRouteRange}m each arrived`;

      fresh(h);
      const slow = slowest
        ? `, slowest ${slowest.leg.seconds.toFixed(1)}s of ${slowest.leg.limit.toFixed(1)}s from (${slowest.stand.at.x.toFixed(1)}, ${slowest.stand.at.z.toFixed(1)}) to ${slowest.stand.goal.tag || slowest.stand.goal.id}`
        : '';
      return {
        pass: problems.length === 0,
        detail: problems.length
          ? problems.join('; ')
          : `${facts.join('; ')}; ${shortNote}; ${tried} stands within ${NEAR}m of a waypoint each reached a node beyond ${A.directRouteRange}m${slow}`,
      };
    },
  });
}
