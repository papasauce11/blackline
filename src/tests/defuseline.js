/**
 * BLACKLINE - tests/defuseline.js
 *
 * AUTO suite (B5d, D27): the defuse reach is a clear line.
 *
 * Josh, asked whether a Warden on the deck may defuse a charge on the duct
 * roof under it, through the slab: "no". `withinDefuseReach()` is two
 * distances and a line now (systems/plantrule.js), and this drives the
 * half the census cannot: a charge put where the plant would refuse it, a
 * Warden stood over it on the deck, and no defuse starting - then the same
 * Warden beside a crate top, and the defuse starting. The refusal is proved
 * to be the slab, not a distance, by taking the slab out of the world and
 * watching the defuse start through the hole.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { CHARGE, DEFUSE_REACH, withinDefuseReach } from '../systems/objective.js';
import { plantableSpots } from './plantspots.js';

const R = CONFIG.round;
const W = CONFIG.warden;

/** The plant's north low duct: its roof is the top D27 was asked about. */
const ROOF_TAG = 'vent-low-north-roof';

/** The distances alone, as the reach measured them before B5d. */
function withinDistances(foot, at) {
  const dx = at.x - foot.x;
  const dz = at.z - foot.z;
  return dx * dx + dz * dz <= DEFUSE_REACH.radius * DEFUSE_REACH.radius && Math.abs(at.y - foot.y) < DEFUSE_REACH.dy;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-warden-defuses-along-a-clear-line-never-through-a-floor',
    maps: ['plant'], // the deck over the duct roof is the plant's
    spec: 'Section 10.1 amended / D27 / Block B5d',
    name: 'A charge on the duct roof under the deck is not defused from the deck; one on a crate top is defused from beside it; take the deck away and the first is',
    run: (h) => {
      const problems = [];
      const dt = CONFIG.time.fixedDt;
      h.initMatch({ mode: 'competitive', role: 'shade', ai: false, objective: true });
      h.menu.hide();
      const objective = h.objective;
      const ground = h.map.wardenGround;
      const collision = h.map.collision;
      if (!ground) return { pass: false, detail: 'map.wardenGround was never derived' };

      const roof = collision.boxes.find((box) => box.tag === ROOF_TAG);
      if (!roof) return { pass: false, detail: `no box tagged ${ROOF_TAG}` };
      const onRoof = { x: (roof.min.x + roof.max.x) / 2, y: roof.max.y, z: (roof.min.z + roof.max.z) / 2 };

      // The cell over it: Warden ground within the distances, higher than
      // the charge, with something solid between - the deck.
      const over = ground.cellsWithin(onRoof, DEFUSE_REACH.radius)
        .filter((cell) => cell.y > onRoof.y + 0.5 && withinDistances(cell, onRoof))
        .sort((a, b) => Math.hypot(a.x - onRoof.x, a.z - onRoof.z) - Math.hypot(b.x - onRoof.x, b.z - onRoof.z))[0];
      if (!over) return { pass: false, detail: `no Warden ground over ${ROOF_TAG} inside the distances: the case D27 was asked about is not on this map` };
      if (withinDefuseReach(over, onRoof, collision)) problems.push(`the reach accepts the deck cell (${over.x.toFixed(1)}, ${over.y.toFixed(1)}, ${over.z.toFixed(1)}) over ${ROOF_TAG}`);
      if (objective.canDefuseAt(onRoof)) problems.push(`canDefuseAt still says a Warden could defuse on ${ROOF_TAG}`);

      // A crate top a Warden defuses from beside: a legal top with its
      // nearest reaching cell lower than the charge.
      const tops = plantableSpots(h).filter((spot) => spot.kind === 'top' && spot.legal);
      let crate = null;
      let beside = null;
      for (const spot of tops) {
        const cell = ground.cellsWithin(spot.at, DEFUSE_REACH.radius)
          .filter((c) => c.y < spot.at.y - 0.5 && withinDefuseReach(c, spot.at, collision))
          .sort((a, b) => Math.hypot(a.x - spot.at.x, a.z - spot.at.z) - Math.hypot(b.x - spot.at.x, b.z - spot.at.z))[0];
        if (cell) { crate = spot; beside = cell; break; }
      }
      if (!crate) return { pass: false, detail: `none of ${tops.length} legal tops has Warden ground below it inside the reach` };

      /**
       * Put a charge at `at` the way a plant leaves it, stand the Warden with
       * its feet on `cell`, and run a second of the round: how much defuse
       * progress that made. No AI, so nothing but the reach says no.
       */
      const defuseFrom = (cell, at) => {
        objective.resetRound(1);
        const round = objective.round;
        h.shade.reset(h.map.shadeSpawns[0]);
        h.warden.reset(h.map.wardenSpawns[0]);
        h.warden.position.set(cell.x, cell.y + W.standHeight / 2 + 0.02, cell.z);
        h.warden.velocity.set(0, 0, 0);
        round.charge = CHARGE.PLANTED;
        const site = objective.siteNear({ x: at.x, y: at.y + CONFIG.shade.standHeight / 2, z: at.z });
        if (site) round.site = site.id;
        round.chargeAt = { x: at.x, y: at.y, z: at.z };
        round.detonationTimer = R.detonationTime;
        const steps = Math.round(1 / dt);
        for (let i = 0; i < steps; i++) h.stepFrames(1);
        const foot = { x: h.warden.position.x, y: h.warden.feetY, z: h.warden.position.z };
        return { progress: round.defuseProgress, foot, moved: Math.hypot(foot.x - cell.x, foot.z - cell.z) };
      };

      const throughFloor = defuseFrom(over, onRoof);
      if (throughFloor.moved > 0.5) problems.push(`the Warden slid ${throughFloor.moved.toFixed(2)}m off the deck cell`);
      if (throughFloor.progress > 0) {
        problems.push(`from the deck cell over ${ROOF_TAG} the defuse reached ${throughFloor.progress.toFixed(2)}s through the slab`);
      }
      const fromBeside = defuseFrom(beside, crate.at);
      if (fromBeside.moved > 0.5) problems.push(`the Warden slid ${fromBeside.moved.toFixed(2)}m off the cell beside ${crate.what}`);
      if (!(fromBeside.progress > 0)) {
        problems.push(`beside ${crate.what}, ${(crate.at.y - beside.y).toFixed(1)}m below it, the defuse never started`);
      }

      // The refusal is the slab. Find what the line from the deck cell meets,
      // take it out of the world, and the reach accepts the deck cell - asked
      // of the predicate, not the round: a Warden stood on a slab that is no
      // longer solid falls through it onto the roof, beside the charge.
      const hands = { x: over.x, y: over.y + 0.1, z: over.z };
      const to = { x: onRoof.x, y: onRoof.y + 0.1, z: onRoof.z };
      const dir = { x: to.x - hands.x, y: to.y - hands.y, z: to.z - hands.z };
      const length = Math.hypot(dir.x, dir.y, dir.z);
      dir.x /= length; dir.y /= length; dir.z /= length;
      const hit = collision.raycast(hands, dir, length, (box) => box.solid);
      let opened = false;
      if (!hit) {
        problems.push('the line from the deck cell to the charge meets nothing, so the refusal is not the slab');
      } else {
        hit.box.solid = false;
        try {
          opened = withinDefuseReach(over, onRoof, collision) && objective.canDefuseAt(onRoof);
        } finally {
          hit.box.solid = true;
        }
        if (!opened) {
          problems.push(`with ${hit.box.tag || 'the slab'} taken out of the world the reach still refuses the deck cell: the refusal is not the line`);
        }
        if (withinDefuseReach(over, onRoof, collision)) problems.push('the reach accepts the deck cell again with the slab back');
      }

      objective.resetMatch();
      objective.resetRound(1);
      h.shade.reset(h.map.shadeSpawns[0]);
      h.warden.reset(h.map.wardenSpawns[0]);

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${ROOF_TAG} at ${onRoof.y.toFixed(1)}m: from the deck cell ${(over.y - onRoof.y).toFixed(1)}m over it, inside the distances, `
            + `no defuse in 1s; beside ${crate.what} from ${(crate.at.y - beside.y).toFixed(1)}m below, `
            + `${fromBeside.progress.toFixed(2)}s of defuse in 1s; with ${hit.box.tag || 'the slab'} out of the world `
            + 'the reach accepts the deck cell through the hole'
          : problems.join('; '),
      };
    },
  });
}
