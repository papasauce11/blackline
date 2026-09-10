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
    name: 'Floor, crate top or duct: the plant commits exactly where a Warden could defuse and nowhere else',
    run: (h) => {
      const problems = [];
      h.initMatch({ mode: 'competitive', role: 'shade', ai: false, objective: true });
      const objective = h.objective;
      if (!h.map.wardenGround) return { pass: false, detail: 'map.wardenGround was never derived' };

      const spots = plantableSpots(h);
      const kinds = { floor: 0, top: 0, vent: 0 };
      const legalBy = { floor: 0, top: 0, vent: 0 };
      for (const spot of spots) {
        kinds[spot.kind]++;
        if (spot.legal) legalBy[spot.kind]++;
      }
      if (!kinds.floor || !kinds.top || !kinds.vent) {
        return {
          pass: false,
          detail: `the census found ${kinds.floor} floor spots, ${kinds.top} climbable tops and `
            + `${kinds.vent} vent interiors inside site rooms; it needs all three kinds to mean anything`,
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
      for (const spot of spots) {
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
            + `(${kinds.floor} floor, ${kinds.top} climbable tops, ${kinds.vent} vent interiors); `
            + `${planted} committed where the charge landed within 5cm of the body, ${held} refused with `
            + `no progress. By kind, out of the Warden's reach: `
            + `${kinds.floor - legalBy.floor} floor, ${kinds.top - legalBy.top} tops, `
            + `${kinds.vent - legalBy.vent} ducts`
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
}
