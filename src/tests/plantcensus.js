/**
 * BLACKLINE - tests/plantcensus.js
 *
 * AUTO suite (Section 16, Section 17.1): the plant rule over the whole map.
 *
 * Two checks, and they are the two halves of proving Block A's rule rather
 * than two views of one half. The first asks the GAME whether it agrees with
 * the rule at every place a charge could go. The second asks the MAP whether
 * the rule is telling the truth: for every spot it calls legal, is there
 * ground a Warden can actually stand on, can the AI's graph get there, and
 * does the Warden arrive when it is sent.
 *
 * The gate itself, driven through the keyboard, is next door in
 * tests/plantrule.js; this file drives the objective directly because it does
 * it hundreds of times.
 *
 * Registered from tests/index.js. Checks reach the live game through the
 * harness `h`; nothing here imports main.js, which Section 3.1 forbids.
 */

import { CONFIG } from '../config.js';
import { CHARGE, ROUND, DEFUSE_REACH, withinDefuseReach } from '../systems/objective.js';
import { findPath } from '../systems/astar.js';
import { createIntent } from '../entities/agent.js';
import { plantableSpots, plantOutcomeAt } from './plantspots.js';

const R = CONFIG.round;

/**
 * How long the sample below gives the AI to walk from its nearest spawn to a
 * planted charge and start defusing. Generous: the point is whether the ground
 * is reachable at all, not how quickly. The whole-map version of the same walk
 * (`the-ai-walks-to-the-charge-and-defuses-it`) allows the entire fuse.
 */
const SAMPLE_WALK_LIMIT = 30;

export function register(debugTools) {
  // A5, the census. Block A's rule is one sentence and the two checks below
  // are the two halves of proving it, over the whole map rather than at the
  // spots a previous check happened to pick.
  //
  // This one enumerates every place inside a site room a Shade can actually
  // put a charge - the room floors, the climbable tops, the vent interiors -
  // and asserts the game's answer is the rule's answer at every one of them.
  // It drives the objective directly rather than through the keyboard, because
  // it does this two hundred times; A3's check is the one that proves the same
  // gate through `input.heldCodes`, and this one would be a slower copy of it.
  debugTools.registerAutoTest({
    id: 'every-plant-spot-in-a-site-room-answers-to-the-defuse-rule',
    spec: 'Section 10.1 amended / D5 / Block A5',
    name: 'Floor, crate top, duct or crawl space: the plant commits exactly where a Warden could defuse and nowhere else',
    run: (h) => {
      const problems = [];
      h.initMatch({ mode: 'competitive', role: 'shade', ai: false, objective: true });
      const objective = h.objective;
      if (!h.map.wardenGround) return { pass: false, detail: 'map.wardenGround was never derived' };

      const spots = plantableSpots(h);
      const kinds = { floor: 0, top: 0, vent: 0, crawl: 0 };
      const legalBy = { floor: 0, top: 0, vent: 0, crawl: 0 };
      for (const spot of spots) {
        kinds[spot.kind]++;
        if (spot.legal) legalBy[spot.kind]++;
      }
      // Three kinds of place: the floor, a top, and inside something - which
      // on the plant is a duct and on the yard the crawl space under the
      // trailer (D2). A map with none of the third kind cannot exercise D20.
      const inside = kinds.vent + kinds.crawl;
      if (!kinds.floor || !kinds.top || !inside) {
        return {
          pass: false,
          detail: `the census found ${kinds.floor} floor spots, ${kinds.top} climbable tops and `
            + `${inside} enclosed interiors (${kinds.vent} in ducts, ${kinds.crawl} in crawl spaces) inside site rooms; `
            + 'it needs all three kinds to mean anything',
        };
      }

      // A census where everything answers the same way proves nothing about
      // the rule, only about the map. Both answers have to be present.
      const refused = spots.filter((spot) => !spot.legal);
      if (!refused.length) {
        return { pass: false, detail: `all ${spots.length} plant spots are legal, so nothing here exercises the gate` };
      }

      let planted = 0;
      let held = 0;
      let lidded = 0;
      for (const spot of spots) {
        if (!spot.legal && !objective.hasHeadroomAt(spot.at)) lidded++;
        const outcome = plantOutcomeAt(h, spot);
        if (spot.legal && outcome.charge !== CHARGE.PLANTED) {
          problems.push(`${spot.what} is defusable but the plant never committed`);
        } else if (!spot.legal && outcome.charge === CHARGE.PLANTED) {
          problems.push(`${spot.what} is not defusable and the plant committed anyway`);
        } else if (!spot.legal && outcome.peak > 0) {
          problems.push(`${spot.what} refused only after ${outcome.peak.toFixed(2)}s of progress`);
        }
        // Where the charge ends up is where the body stood. The site id says
        // which room and nothing more (Section 10.1 amended), so a charge that
        // drifted to a site centre would defeat the whole rule quietly.
        if (outcome.charge === CHARGE.PLANTED) {
          planted++;
          const at = outcome.at;
          const drift = Math.hypot(at.x - spot.at.x, at.z - spot.at.z) + Math.abs(at.y - spot.at.y);
          if (drift > 0.05) problems.push(`${spot.what} planted ${drift.toFixed(2)}m from where the body stood`);
        } else {
          held++;
        }
      }

      objective.resetMatch();
      objective.resetRound(1);
      h.shade.reset(h.map.shadeSpawns[0]);

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${spots.length} plant spots in ${h.map.sites.length} site rooms `
            + `(${kinds.floor} floor, ${kinds.top} climbable tops, ${kinds.vent} vent interiors, ${kinds.crawl} crawl spaces); `
            + `${planted} committed where the charge landed within 5cm of the body, ${held} refused with `
            + `no progress. Refused by kind: `
            + `${kinds.floor - legalBy.floor} floor, ${kinds.top - legalBy.top} tops, `
            + `${kinds.vent - legalBy.vent} ducts, ${kinds.crawl - legalBy.crawl} crawl spaces (${lidded} of the refusals by headroom, D20)`
          : problems.slice(0, 6).join('; ') + (problems.length > 6 ? ` (+${problems.length - 6} more)` : ''),
      };
    },
  });

  // The other half, and the half that is not circular. The census above tests
  // the game against the rule; this tests the rule against the map. For every
  // spot the rule calls legal it finds the ground a Warden would defuse from
  // and asks two cheap questions of all of them - is that ground real, does
  // the AI's waypoint graph reach it from a spawn - and then the expensive one
  // of a sample: send the Warden and watch it arrive.
  //
  // The bug this exists to catch is the one in HANDOFF.md: a legal plant the
  // Warden cannot get to does not merely go undefused, it strands the AI in
  // DEFEND for the whole 45s fuse, walking as far as it can and stopping.
  // Nothing short of driving the AI proves that one, because the failure is
  // the pathing, not the rule.
  debugTools.registerAutoTest({
    id: 'every-legal-plant-has-a-warden-who-can-reach-it',
    spec: 'Section 10.1 amended / Section 11 DEFEND / D5 / Block A5',
    name: 'Every legal plant has ground a Warden can walk to, and the AI actually walks to a sample of it',
    run: (h) => {
      const problems = [];
      const dt = CONFIG.time.fixedDt;
      h.initMatch({ mode: 'competitive', role: 'shade', ai: true, objective: true });
      h.menu.hide();
      const objective = h.objective;
      const ground = h.map.wardenGround;
      if (!ground) return { pass: false, detail: 'map.wardenGround was never derived' };

      const legal = plantableSpots(h).filter((spot) => spot.legal);
      if (!legal.length) return { pass: false, detail: 'no legal plant spot anywhere in a site room' };

      // Where the Warden starts, in waypoint terms. A defuse it cannot path to
      // from its own spawn is a defuse that never happens.
      const spawnNodes = h.map.wardenSpawns
        .map((spawn) => h.map.nearestWaypoint(spawn.position))
        .filter(Boolean);
      if (!spawnNodes.length) return { pass: false, detail: 'no waypoint near any Warden spawn' };

      let worstLeg = 0;
      for (const spot of legal) {
        // The ground the defuse would happen from: the nearest cell the real
        // reach predicate accepts. `canDefuseAt` said one exists; this is the
        // one, and it has to survive being asked for by name.
        const cells = ground.cellsWithin(spot.at, DEFUSE_REACH.radius);
        let stand = null;
        let bestDistance = Infinity;
        for (const cell of cells) {
          if (!withinDefuseReach(cell, spot.at)) continue;
          const distance = Math.hypot(cell.x - spot.at.x, cell.z - spot.at.z);
          if (distance < bestDistance) {
            bestDistance = distance;
            stand = cell;
          }
        }
        if (!stand) {
          problems.push(`${spot.what} is legal but no cell of Warden ground is within the defuse reach`);
          continue;
        }
        if (!ground.has(stand)) {
          problems.push(`${spot.what}: the cell the reach named is not ground the flood reached`);
        }
        spot.stand = stand;

        // The waypoint graph gets there from a spawn. `findPath` answers
        // `[start]` when it cannot, which is why the length is read rather
        // than the truthiness.
        const goalNode = h.map.nearestWaypoint(stand);
        const reachable = spawnNodes.some((from) => (
          from.id === goalNode.id || findPath(h.map.waypoints, from.id, goalNode.id).length > 1
        ));
        if (!reachable) {
          problems.push(`${spot.what}: no route over the waypoint graph from any Warden spawn to ${goalNode.tag || goalNode.id}`);
        }
        // Reported, not asserted. The AI walks straight from its last waypoint
        // to the goal, so this is how far it freewheels with only the solver
        // to get it round a crate. A number worth watching rather than a line
        // to fail on: the solver slides along walls and the stuck-detector
        // repaths, so a leg crossing a crate is not the same as a leg that
        // cannot be walked. The sample below is what actually settles it.
        worstLeg = Math.max(worstLeg, Math.hypot(stand.x - goalNode.position.x, stand.z - goalNode.position.z));
      }

      // And now the expensive question, of one spot per room: plant it for
      // real, hand the AI the charge the way a plant does, and watch. Room by
      // room rather than spot by spot because what is being tested is whether
      // the Warden can get to that part of the map at all, and the least
      // obvious kind in each room is the one worth sending it to.
      const rank = { vent: 0, top: 1, floor: 2 };
      const sample = [];
      for (const site of h.map.sites) {
        const here = legal.filter((spot) => spot.site === site.id && spot.stand);
        if (!here.length) continue;
        here.sort((a, b) => rank[a.kind] - rank[b.kind]);
        sample.push(here[0]);
      }

      const arrivals = [];
      for (const spot of sample) {
        objective.resetRound(1);
        const round = objective.round;

        // Plant it where the body is, then get the Shade out of sight: Section
        // 11 will not kneel while it can see you, and this is a test of the
        // walk, not of the stand-off.
        h.shade.reset(h.map.shadeSpawns[0]);
        h.shade.position.set(spot.body.x, spot.body.y, spot.body.z);
        const intent = createIntent();
        intent.interact = true;
        for (let i = 0; i < Math.ceil((R.plantHoldTime + 0.5) / dt) && round.charge === CHARGE.CARRIED; i++) {
          objective.step(dt, { shade: h.shade, warden: h.warden, intent });
        }
        if (round.charge !== CHARGE.PLANTED) {
          problems.push(`${spot.what}: the sample plant never committed`);
          continue;
        }
        const hideout = h.map.shadeSpawns.reduce((far, spawn) => (
          spawn.position.distanceTo(spot.at) > far.position.distanceTo(spot.at) ? spawn : far
        ), h.map.shadeSpawns[0]);
        h.shade.reset(hideout);

        // From the spawn nearest the charge. The claim under test is that this
        // ground is reachable, not that it is close, so the Warden is given
        // the fairest start it could have had.
        const spawn = h.map.wardenSpawns.reduce((near, entry) => (
          entry.position.distanceTo(spot.at) < near.position.distanceTo(spot.at) ? entry : near
        ), h.map.wardenSpawns[0]);
        h.warden.reset(spawn);
        objective.ai.setDefendTarget(round.chargeAt);

        const limit = Math.round(SAMPLE_WALK_LIMIT / dt);
        let steps = 0;
        let closest = Infinity;
        while (steps++ < limit && round.defuseProgress <= 0 && round.state === ROUND.ACTIVE) {
          h.stepFrames(1);
          closest = Math.min(closest, Math.hypot(
            h.warden.position.x - round.chargeAt.x, h.warden.position.z - round.chargeAt.z
          ));
        }
        if (round.defuseProgress > 0) {
          arrivals.push(`${spot.site}:${spot.kind} ${(steps * dt).toFixed(1)}s`);
        } else {
          problems.push(
            `${spot.what}: the Warden never started defusing in ${SAMPLE_WALK_LIMIT}s from its nearest `
            + `spawn - it got to ${closest.toFixed(1)}m and stayed in ${h.wardenAI.state}`
          );
        }
      }

      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      objective.resetMatch();
      objective.resetRound(1);
      h.shade.reset(h.map.shadeSpawns[0]);
      h.warden.reset(h.map.wardenSpawns[0]);

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${legal.length} legal plant spots, each with Warden ground inside the defuse reach and each `
            + `on the waypoint graph from a spawn; the AI walked to and began defusing `
            + `${arrivals.length} of ${sample.length} sampled (${arrivals.join(', ')}). `
            + `Worst unpathed last leg ${worstLeg.toFixed(1)}m`
          : problems.slice(0, 6).join('; ') + (problems.length > 6 ? ` (+${problems.length - 6} more)` : ''),
      };
    },
  });

  // A8: the last leg is planned. The AI paths over the waypoint graph and used
  // to walk straight from its last node to the goal with only the solver to
  // steer it - A5 measured that leg at up to 14.9m across the legal plants,
  // which worked on this map and is the DEFEND stall waiting to happen on one
  // with more furniture. `WardenGround.route()` now plans it over A1's ground
  // in segments no longer than `ai.maxUnpathedLeg`. This asks, for every legal
  // plant, whether that route exists from the nearest waypoint, whether every
  // segment is short and genuinely walkable - a standing Warden's capsule
  // fits at every quarter-cell sample, asked of the collision world and not
  // of the ground data that planned it - whether it ends within the defuse
  // reach, and whether the AI's own `_pathTo` produces the same thing.
  debugTools.registerAutoTest({
    id: 'the-last-leg-to-every-legal-plant-is-planned-and-short',
    spec: 'Section 11 / Block A8',
    name: 'From its last waypoint the AI walks planned ground to every legal plant, no segment over ai.maxUnpathedLeg',
    run: (h) => {
      const problems = [];
      h.initMatch({ mode: 'competitive', role: 'shade', ai: true, objective: true });
      h.menu.hide();
      const ground = h.map.wardenGround;
      const bound = CONFIG.ai.maxUnpathedLeg;
      const snap = { radius: CONFIG.round.siteRadius, dy: CONFIG.round.defuseReachY };
      const half = { x: CONFIG.warden.radius, y: CONFIG.warden.standHeight / 2, z: CONFIG.warden.radius };
      const step = CONFIG.warden.stepHeight;
      const margin = CONFIG.ai.routeEdgeMargin;
      if (!ground) return { pass: false, detail: 'map.wardenGround was never derived' };
      if (!ground.edges.size) return { pass: false, detail: 'the ground has no edges, so nothing can be routed over it' };

      /**
       * Walk a segment the way the solver would, with the collision world's
       * raycast rather than the ground data that planned it. Every
       * quarter-cell the body rests on the highest solid top under its
       * FOOTPRINT within a step of where it was - five rays, centre and
       * corners, because the swept AABB rests on any top face it overlaps and
       * steps up onto a tread corner the centre ray would miss - refuses a
       * drop of more than a step, and needs the standing capsule to fit
       * there. Independent of `route()`, which rests by box query.
       *
       * And the body does not walk the line (B5c): the follower cuts every
       * bend from `waypointArriveRadius` away, so along a pulled segment -
       * one the planner drew across cells rather than a flood-proven step
       * between two neighbours - `ai.routeEdgeMargin` to either side of it
       * there has to be a top face within a step of the line's own height. A
       * wall there is a slide; nothing there is the hall void the Warden
       * walked off. A ray straight down at each strayed point, from a step
       * above the line, as far as a step below it. A cell step is held to
       * the flood's own test: both centres standable and the gap clear.
       */
      const walkableByRay = (a, b) => {
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        const n = Math.max(1, Math.ceil(length / (ground.cell / 4)));
        const down = { x: 0, y: -1, z: 0 };
        const feet = [[0, 0], [-half.x, -half.z], [half.x, -half.z], [-half.x, half.z], [half.x, half.z]];
        const pulled = length > ground.cell + 1e-3;
        const sideX = pulled ? -(b.z - a.z) / length * margin : 0;
        const sideZ = pulled ? (b.x - a.x) / length * margin : 0;
        let y = a.y;
        for (let q = 1; q <= n; q++) {
          const t = q / n;
          const x = a.x + (b.x - a.x) * t;
          const z = a.z + (b.z - a.z) * t;
          let rest = -Infinity;
          for (const [dx, dz] of feet) {
            const hit = h.map.collision.raycast({ x: x + dx, y: y + step + 0.01, z: z + dz }, down, step * 2 + 0.02);
            if (hit && hit.y > rest) rest = hit.y;
          }
          if (rest === -Infinity) return { ok: false, x, z, why: 'a drop of more than a step' };
          y = rest;
          if (!h.map.collision.isClear({ x, y: y + half.y + 0.02, z }, half)) return { ok: false, x, z, why: 'no room for a standing body' };
          if (!pulled) continue;
          for (const side of [1, -1]) {
            const sx = x + side * sideX;
            const sz = z + side * sideZ;
            const hit = h.map.collision.raycast({ x: sx, y: y + step + 0.01, z: sz }, down, step * 2 + 0.02);
            if (!hit) return { ok: false, x: sx, z: sz, why: `a drop of more than a step ${margin}m beside the line` };
          }
        }
        return { ok: true };
      };

      const legal = plantableSpots(h).filter((spot) => spot.legal);
      let worst = 0;
      let longestRoute = 0;
      let unplanned = 0;
      let straightBefore = 0;

      for (const spot of legal) {
        // From the waypoint the AI would path to, as the AI finds it.
        const node = h.map.nearestWaypoint(spot.at);
        const from = { x: node.position.x, y: node.position.y, z: node.position.z };
        const straight = Math.hypot(spot.at.x - from.x, spot.at.z - from.z);
        straightBefore = Math.max(straightBefore, straight);

        const route = ground.route(from, spot.at, bound, snap, margin);
        if (!route) {
          unplanned++;
          if (unplanned <= 3) problems.push(`${spot.what}: no planned route from ${node.tag || node.id} (${straight.toFixed(1)}m straight)`);
          continue;
        }
        longestRoute = Math.max(longestRoute, route.length);
        // A snapped route's last hop is the walk at the crate the charge is
        // on, ended by the solver rather than by arriving; it is not ground
        // and is not held to the walk test. Everything before it is.
        const last = route[route.length - 1];
        const onGround = ground.has(last) ? route.length : route.length - 1;
        for (let s = 1; s < route.length; s++) {
          const a = route[s - 1];
          const b = route[s];
          const leg = Math.hypot(b.x - a.x, b.z - a.z);
          worst = Math.max(worst, leg);
          if (leg > bound + 1e-6) {
            problems.push(`${spot.what}: segment ${s} is ${leg.toFixed(1)}m, over the ${bound}m bound`);
            break;
          }
          if (s >= onGround) continue;
          // Walkable by the physics, not by the data that planned it.
          const walk = walkableByRay(a, b);
          if (!walk.ok) {
            problems.push(`${spot.what}: segment ${s} meets ${walk.why} at (${walk.x.toFixed(1)}, ${walk.z.toFixed(1)})`);
            break;
          }
        }
        // The ground it defuses from: the last point that is ground.
        const end = route[onGround - 1];
        if (!withinDefuseReach(end, spot.at)) {
          problems.push(`${spot.what}: the route ends ${Math.hypot(end.x - spot.at.x, end.z - spot.at.z).toFixed(1)}m from the charge, outside the defuse reach`);
        }
        if (problems.length > 8) break;
      }
      if (unplanned > 3) problems.push(`(+${unplanned - 3} more legal plants with no planned route)`);
      if (!problems.length && straightBefore <= bound) {
        problems.push(`the longest straight leg is only ${straightBefore.toFixed(1)}m, inside the ${bound}m bound, so planning it proves nothing here`);
      }

      // And the AI itself builds the same kind of route: send it, read what
      // it intends to walk, and require the tail after its last waypoint to
      // be short segments rather than one line.
      const sample = legal.find((spot) => spot.kind === 'top') || legal[0];
      const ai = h.wardenAI;
      h.warden.reset(h.map.wardenSpawns[0]);
      ai._pathTo({ x: sample.at.x, y: sample.at.y, z: sample.at.z });
      // Node-to-node links are the graph's, asserted walkable elsewhere; the
      // bound is for what comes after the last node, which is the first route
      // point that is not a waypoint.
      const tailStart = ai._route.findIndex((p) => !h.map.waypoints.some((n) => n && Math.abs(n.position.x - p.x) < 1e-6 && Math.abs(n.position.z - p.z) < 1e-6));
      let aiTailWorst = 0;
      for (let s = Math.max(1, tailStart); s < ai._route.length; s++) {
        const a = ai._route[s - 1];
        const b = ai._route[s];
        aiTailWorst = Math.max(aiTailWorst, Math.hypot(b.x - a.x, b.z - a.z));
      }
      if (aiTailWorst > bound + 1e-6) {
        problems.push(`the AI's own route to ${sample.what} has a ${aiTailWorst.toFixed(1)}m segment after its last waypoint`);
      }
      if (tailStart < 0) problems.push(`the AI's route to ${sample.what} has no planned tail at all`);

      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      h.warden.reset(h.map.wardenSpawns[0]);

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${legal.length} legal plants routed from their nearest waypoint over ${ground.edges.size} ground edges; `
            + `longest segment ${worst.toFixed(1)}m against a ${bound}m bound (the straight leg was up to `
            + `${straightBefore.toFixed(1)}m), longest route ${longestRoute} points, every sample clear for a `
            + `standing Warden, every end inside the defuse reach; the AI's own route to ${sample.what} `
            + `tails in ${(ai._route.length - Math.max(0, tailStart))} segments, longest ${aiTailWorst.toFixed(1)}m`
          : problems.join('; '),
      };
    },
  });
}
