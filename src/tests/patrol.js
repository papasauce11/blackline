/**
 * BLACKLINE - tests/patrol.js
 *
 * AUTO suite (K7): the Warden's patrol with the round clock low.
 *
 * **What was already true, and is not asserted again here.** The circuit is a
 * shuffle of the waypoints from the seeded stream and each pause is drawn from
 * it, so two seeds were already two patrols - `ai-patrol-order-is-seed-
 * reproducible` holds the circuit and `a-match-replays-identically-from-its-
 * seed` the rest. What K7 added is the one thing the circuit cannot know: the
 * clock. Below `CONFIG.ai.patrol.siteCheckAt` seconds left the Warden, at its
 * next node pick, walks to each plant site's room once - nearest first - and
 * stands there for the pause every node draws (systems/aipatrol.js).
 *
 * **The scene.** A match on the seed with the Warden alone in it - the AI is
 * stepped with no Shade to notice, as `ai-patrols-without-getting-stuck`
 * steps it, so it stays in PATROL and every arrival is a pick - and the round
 * clock set to `SECONDS_ABOVE` seconds over the line. The objective is stepped
 * beside it until the clock first reads under the line, so the AI hears the
 * crossing the way it does in a game (`round:clock`, from the objective), and
 * then not again: the clock is held where it crossed. A real round has the
 * last `siteCheckAt` seconds to spend and a full sweep of the plant takes
 * longer than that, so letting the round end under the Warden would measure the
 * round and not the sweep.
 *
 * **What is read off the body.** An arrival is the step the AI starts a pause
 * (its `_pauseTimer` goes from spent to drawn), and what it is judged by is
 * where the Warden stands: `objective.siteNear` says which site's room that is
 * - the game's own containment - and the distance to a circuit node says which
 * node. The first arrival after the crossing, the **pick**, is the Warden
 * reaching the node it was already walking to, which is what "never mid-route"
 * means. Nothing here writes an intent field or a position.
 *
 * **The seed is searched for, deterministically.** Whether the pick lands on a
 * node inside a site room is the circuit's luck: eight of the plant's twenty
 * nodes are, and a Warden that picks while standing in a site room has seen it
 * (aipatrol.js), which is right and makes the trace ambiguous. So the check
 * takes the first of `SEED_TRIES` seeds from `SEED_FROM` whose pick is on a
 * node outside every site room and which has `ABOVE_ARRIVALS` circuit arrivals
 * before it, and says which it took.
 *
 * Nothing here renders a frame. Registered from tests/index.js; nothing
 * imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { AI_STATE } from '../systems/ai.js';
import { siteStands } from '../systems/aipatrol.js';

const A = CONFIG.ai;
const dt = CONFIG.time.fixedDt;

/** The first seed tried, and how many in a row may be. K7 in hex. */
const SEED_FROM = 0x4b37;
const SEED_TRIES = 24;
/** Seconds of clock above the line the circuit is read over before it crosses. */
const SECONDS_ABOVE = 90;
/** Circuit arrivals a seed must have before its pick, so "in order" is more than one. */
const ABOVE_ARRIVALS = 3;
/**
 * The longest, in seconds, from the clock crossing the line to the Warden
 * starting its pause in the last site room. Measured over the fourteen clean
 * seeds of the first `SEED_TRIES` on each map: 69 to 133s on the plant, 45 to
 * 73s on the yard, the check's own seed at 87s and 58s. 150s is the plant's
 * worst and an eighth over - a Warden that waited for the circuit to come
 * round to a room would be far past it.
 */
const SWEEP_BOUND = 150;
/** Circuit arrivals read after the last room: the node it left, and the one after. */
const RESUMED = 2;
/** Metres from its arrival point at which the Warden has left the spot it paused on. */
const LEFT_THE_SPOT = 0.5;
/** How near a node an arrival is: the radius the follower arrives at, and a stride's margin. */
const ARRIVE = A.waypointArriveRadius + 0.2;

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const secs = (frames) => (frames * dt).toFixed(1);

/**
 * Play the scene once and return what the body did: every arrival (frame, feet,
 * the site room it is in, the pause it drew, and how long it stood still), the
 * circuit it walked, the frame the clock crossed and the states the AI was in.
 */
export function traceRun(h, seed) {
  h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true, seed });
  h.menu.hide();
  h.input.clearAll();
  const ai = h.wardenAI;
  const { warden, objective } = h;
  const line = A.patrol.siteCheckAt;
  const rooms = h.map.sites.length;
  objective.round.timeRemaining = line + SECONDS_ABOVE;

  const circuit = ai._circuit.slice();
  const arrivals = [];
  const states = new Set();
  let cross = -1;
  let pick = -1;
  let paused = false;
  const limit = Math.round((SECONDS_ABOVE + SWEEP_BOUND) / dt);
  let f = 0;
  for (; f < limit; f++) {
    warden.step(dt, ai.step(dt, { shade: null }));
    if (cross < 0) {
      objective.step(dt, { shade: h.shade, warden, intent: null });
      if (objective.round.timeRemaining < line) cross = f;
    }
    states.add(ai.state);

    const last = arrivals[arrivals.length - 1];
    if (last && last.dwell < 0 && flat(last, warden.position) > LEFT_THE_SPOT) last.dwell = f - last.f;
    const now = ai._pauseTimer > 0;
    if (now && !paused) {
      const site = objective.siteNear(warden.position, CONFIG.warden.standHeight);
      arrivals.push({
        f, x: warden.position.x, y: warden.feetY, z: warden.position.z,
        site: site ? site.id : null, pause: ai._pauseTimer, dwell: -1,
      });
      if (pick < 0 && cross >= 0 && f > cross) pick = arrivals.length - 1;
    }
    paused = now;
    if (pick >= 0 && arrivals.length >= pick + 1 + rooms + RESUMED) break;
  }
  return { seed, circuit, cross, pick, arrivals, states: [...states], frames: f };
}

/** A run is a usable scene if its pick is on a circuit node outside the site rooms and the circuit had time to show its order. */
const isClean = (run) => run.cross >= 0 && run.pick >= ABOVE_ARRIVALS && run.arrivals[run.pick].site === null;

/** The sites by greedy nearest-first from a point, as ids: what "nearest first" is, written without the AI. */
function nearestFirst(from, sites) {
  const left = sites.slice();
  const order = [];
  let at = from;
  while (left.length) {
    let best = 0;
    for (let i = 1; i < left.length; i++) {
      if (dist(at, left[i].position) < dist(at, left[best].position)) best = i;
    }
    const [next] = left.splice(best, 1);
    order.push(next.id);
    at = { x: next.position.x, y: next.position.y, z: next.position.z };
  }
  return order;
}

/** The frames and rooms of a run, as one string two runs can be compared on. */
const signature = (run) => `${run.circuit.join(',')}|${run.cross}|${run.arrivals.map((a) => `${a.f}${a.site || '-'}`).join(',')}`;

/**
 * Read the clauses off one run. Each is a list of problems, empty when it
 * holds, so the detail line names the clause that broke and not just a red.
 */
function clauses(h, run) {
  const sites = h.map.sites;
  const nodes = h.map.waypoints;
  const { arrivals: arr, circuit, cross, pick } = run;
  const nodeAt = (k) => nodes[circuit[k % circuit.length]].position;
  const out = { above: [], below: [], back: [], facts: {} };
  if (run.states.some((state) => state !== AI_STATE.PATROL)) {
    out.above.push(`the AI left PATROL: [${run.states}], with no Shade in the scene`);
  }

  // (a) Above the line, and the pick that follows the crossing: the circuit's nodes, in order.
  if (cross < 0 || pick < 0) {
    out.above.push(cross < 0 ? 'the clock never crossed the line' : `no node was reached in the ${SWEEP_BOUND}s after the clock crossed`);
    return out;
  }
  for (let k = 0; k <= pick && out.above.length < 3; k++) {
    const d = dist(arr[k], nodeAt(k));
    if (d > ARRIVE) out.above.push(`arrival ${k} at ${secs(arr[k].f)}s is ${d.toFixed(1)}m from circuit node ${circuit[k]}, not within ${ARRIVE.toFixed(1)}m`);
  }

  // (b) Below it: every site's room, once, nearest first, each stood in for the pause that was drawn.
  const order = nearestFirst(arr[pick], sites);
  const sweep = arr.slice(pick + 1, pick + 1 + sites.length);
  for (let j = 0; j < sites.length && out.below.length < 3; j++) {
    const a = sweep[j];
    if (!a) {
      out.below.push(`only ${sweep.length} of ${sites.length} arrivals followed the pick within ${SWEEP_BOUND}s`);
    } else if (a.site !== order[j]) {
      out.below.push(`arrival ${j + 1} after the pick (${secs(a.f - cross)}s past the line) is ${a.site ? `in room ${a.site}` : 'in no site room'}, want ${order[j]}`);
    } else if (a.dwell < 0 || a.dwell * dt < a.pause - dt) {
      out.below.push(`in room ${a.site} it stood ${secs(a.dwell)}s of a drawn ${a.pause.toFixed(2)}s pause`);
    }
  }
  const lastRoom = sweep[sites.length - 1];
  if (lastRoom && (lastRoom.f - cross) * dt > SWEEP_BOUND) {
    out.below.push(`the last room took ${secs(lastRoom.f - cross)}s from the line, past ${SWEEP_BOUND}s`);
  }
  if (out.below.length) return out;

  // (c) Back to the circuit: the node after the one it left, and the one after that.
  const back = arr.slice(pick + 1 + sites.length, pick + 1 + sites.length + RESUMED);
  for (let j = 0; j < RESUMED; j++) {
    if (!back[j]) {
      out.back.push(`only ${back.length} of ${RESUMED} circuit arrivals followed the last room`);
      break;
    }
    const d = dist(back[j], nodeAt(pick + 1 + j));
    if (d > ARRIVE) out.back.push(`arrival ${j + 1} after the last room is ${d.toFixed(1)}m from circuit node ${circuit[(pick + 1 + j) % circuit.length]}, the circuit's next`);
  }

  out.facts = {
    cross: secs(cross),
    pickAt: secs(arr[pick].f - cross),
    rooms: order.join(''),
    reached: sweep.map((a) => secs(a.f - cross)).join('/'),
    sweep: secs(lastRoom.f - arr[pick].f),
    dwell: Math.min(...sweep.map((a) => a.dwell * dt)).toFixed(1),
    resumed: back[0] ? secs(back[0].f - lastRoom.f) : '-',
    node: circuit[(pick + 1) % circuit.length],
  };
  return out;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-warden-checks-a-site-room-when-the-round-clock-is-low',
    spec: 'Section 11 (PATROL) / K7',
    name: 'Below the clock line the Warden walks to each site room in turn, nearest first, pauses in each and goes back to its circuit; above it, the circuit alone',
    run: (h) => {
      const problems = [];
      let run = null;
      let tried = 0;
      for (; tried < SEED_TRIES; tried++) {
        run = traceRun(h, SEED_FROM + tried);
        if (isClean(run)) break;
      }
      if (tried === SEED_TRIES) {
        problems.push(`no seed in ${SEED_TRIES} from ${SEED_FROM.toString(16)} had a pick on a node outside the site rooms after ${ABOVE_ARRIVALS} circuit arrivals`);
      }
      const read = clauses(h, run);
      if (read.above.length) problems.push(`above the line: ${read.above.join('; ')}`);
      if (read.below.length) problems.push(`below the line: ${read.below.join('; ')}`);
      if (read.back.length) problems.push(`back to the circuit: ${read.back.join('; ')}`);

      // (d) Reproducible: the same seed twice is the same rooms on the same frames; the next seed is not.
      const again = traceRun(h, run.seed);
      const next = traceRun(h, run.seed + 1);
      const sameTwice = signature(run) === signature(again);
      const nextDiffers = run.arrivals.map((a) => a.f).join() !== next.arrivals.map((a) => a.f).join();
      if (!sameTwice) problems.push('the same seed twice gave different rooms or arrival frames');
      if (!nextDiffers) problems.push('the next seed gave the same arrival frames');

      // (e) A room no waypoint is in is still reachable: the ground nearest the site stands in for the node.
      const bare = siteStands({ sites: h.map.sites, waypoints: [], wardenGround: h.map.wardenGround });
      h.map.sites.forEach((site, i) => {
        const stand = bare[i];
        if (!stand) problems.push(`room ${site.id} with no waypoint has no stand on the Warden's ground`);
        else if (flat(stand, site.position) > CONFIG.round.siteRadius) problems.push(`room ${site.id}'s fallback stand is ${flat(stand, site.position).toFixed(1)}m from the site`);
      });

      // Leave a fresh match, as the AI checks do, with no round ended behind it.
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.objective.resetMatch();

      const f = read.facts;
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `seed ${run.seed.toString(16)} (${tried + 1} tried): under ${A.patrol.siteCheckAt}s at ${f.cross}s, pick +${f.pickAt}s at node ${run.circuit[run.pick]}; rooms ${f.rooms} +${f.reached}s (sweep ${f.sweep}s, bound ${SWEEP_BOUND}s), stood >=${f.dwell}s; circuit resumed at node ${f.node} +${f.resumed}s; replay identical, next seed differs`
          : problems.join('; '),
      };
    },
  });
}
