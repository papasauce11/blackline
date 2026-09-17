/**
 * BLACKLINE - tests/map.js
 *
 * AUTO suite (Section 16, Section 17.1): Map geometry and markings.
 *
 * Shell, collision, affordance markings, lights, spawns, rooms and vents.
 *
 * Registered from tests/index.js. Checks reach the live game through the
 * harness `h`; nothing here imports main.js, which Section 3.1 forbids.
 */

import { CONFIG } from '../config.js';
import { classifyReach } from '../physics.js';

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'exactly-one-shadow-caster',
    spec: 'Section 4.1 / check 29',
    name: 'Exactly one shadow-casting light; no point light casts',
    run: (h) => {
      let casters = 0;
      let pointCasters = 0;
      let total = 0;
      h.scene.traverse((object) => {
        if (!object.isLight) return;
        total++;
        if (object.castShadow) casters++;
        if (object.isPointLight && object.castShadow) pointCasters++;
      });
      const size = h.map.keyLight.shadow.mapSize;
      const mapOk = size.x === CONFIG.render.shadowMapSize && size.y === CONFIG.render.shadowMapSize;
      return {
        pass: casters === 1 && pointCasters === 0 && mapOk,
        detail: `${total} lights, ${casters} shadow caster(s), ${pointCasters} shadowed point lights, shadow map ${size.x}x${size.y}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'swept-collision-no-tunnelling',
    maps: ['plant'], // drives into the plant's west perimeter wall at x=-30
    spec: 'check 1 (auto half) / Section 15',
    name: 'An actor driven into a wall at extreme speed never passes through',
    run: (h) => {
      const world = h.map.collision;
      const half = { x: CONFIG.shade.radius, y: CONFIG.shade.standHeight / 2, z: CONFIG.shade.radius };
      const dt = CONFIG.time.fixedDt;
      const speeds = [6.5, 50, 200, 1000];
      let breaches = 0;
      const details = [];

      for (const speed of speeds) {
        // Start inside the Turbine Hall and drive due west into the perimeter
        // wall, whose inner face is at x = -30.
        const position = { x: -20, y: half.y + 0.05, z: -4 };
        const velocity = { x: -speed, y: 0, z: 0 };
        for (let i = 0; i < 180; i++) {
          velocity.x = -speed;
          world.moveAndSlide(position, half, velocity, dt, {
            groundNormalY: CONFIG.shade.groundNormalY,
            stepHeight: CONFIG.shade.stepHeight,
            wasGrounded: true,
          });
        }
        const insideWall = position.x < -30 + half.x - 0.05;
        if (insideWall) breaches++;
        details.push(`${speed}m/s -> x=${position.x.toFixed(3)}`);
      }

      return {
        pass: breaches === 0,
        detail: `${breaches} breaches; ${details.join(', ')} (wall face at x=-30)`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'spawns-and-sites-clear',
    spec: 'Section 5 / Section 10.2',
    name: 'No spawn or plant site is embedded in geometry',
    run: (h) => {
      const world = h.map.collision;
      const blocked = [];

      const check = (label, position, radius, height) => {
        const half = { x: radius, y: height / 2, z: radius };
        const centre = { x: position.x, y: position.y + height / 2 + 0.02, z: position.z };
        const hit = world.overlap(centre, half);
        if (hit) blocked.push(`${label} in "${hit.tag}"`);
      };

      h.map.shadeSpawns.forEach((spawn, i) =>
        check(`shade spawn ${i}`, spawn.position, CONFIG.shade.radius, CONFIG.shade.standHeight)
      );
      h.map.wardenSpawns.forEach((spawn, i) =>
        check(`warden spawn ${i}`, spawn.position, CONFIG.warden.radius, CONFIG.warden.standHeight)
      );
      h.map.sites.forEach((site) =>
        check(`site ${site.id}`, site.position, CONFIG.shade.radius, CONFIG.shade.standHeight)
      );
      h.map.waypoints.forEach((node) =>
        check(`waypoint ${node.id} (${node.tag})`, node.position, CONFIG.warden.radius, CONFIG.warden.standHeight)
      );

      return {
        pass: blocked.length === 0,
        detail:
          blocked.length === 0
            ? `${h.map.shadeSpawns.length} shade spawns, ${h.map.wardenSpawns.length} warden spawns, ${h.map.sites.length} sites, ${h.map.waypoints.length} waypoints all clear`
            : blocked.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'light-break-is-permanent',
    spec: 'Section 5 / Section 7.1',
    name: 'Breaking a light zeroes its intensity, darkens the glass, and sticks',
    run: (h) => {
      const target = h.map.lights.find((entry) => !entry.broken);
      if (!target) return { pass: false, detail: 'no unbroken light to test' };
      const beforeActive = h.map.activeLights().length;
      const beforeIntensity = target.light.intensity;

      const first = h.map.breakLight(target.lightId);
      const second = h.map.breakLight(target.lightId); // must be a no-op
      const afterActive = h.map.activeLights().length;

      const pass =
        first !== null &&
        second === null &&
        target.broken === true &&
        target.light.intensity === 0 &&
        beforeIntensity > 0 &&
        afterActive === beforeActive - 1;

      // Restore so the suite does not leave the map dark for the next run.
      target.broken = false;
      target.light.intensity = beforeIntensity;
      target.glassMaterial.color.set(CONFIG.palette.lightWarm);

      return {
        pass,
        detail: `active ${beforeActive} -> ${afterActive}, intensity ${beforeIntensity} -> 0, repeat break returned null=${second === null}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'vent-runs-are-crouch-only-and-enterable',
    maps: ['plant'], // v2's duct count is the plant's
    spec: 'Section 5 / check 5',
    name: 'Every vent run is crouch-only along its length and open at both mouths',
    run: (h) => {
      const crouchHalf = { x: CONFIG.shade.radius, y: CONFIG.shade.crouchHeight / 2, z: CONFIG.shade.radius };
      const standHalf = { x: CONFIG.shade.radius, y: CONFIG.shade.standHeight / 2, z: CONFIG.shade.radius };
      const problems = [];
      let grade = 0;

      for (const vent of h.map.vents) {
        if (vent.grade) grade++;
        const alongX = vent.axis === 'x';
        const from = alongX ? vent.min.x : vent.min.z;
        const to = alongX ? vent.max.x : vent.max.z;
        const cross = alongX ? (vent.min.z + vent.max.z) / 2 : (vent.min.x + vent.max.x) / 2;
        const floorY = vent.min.y;
        const at = (along, half, height) => {
          const y = floorY + height / 2 + 0.02;
          const point = alongX ? { x: along, y, z: cross } : { x: cross, y, z: along };
          return h.map.collision.isClear(point, half);
        };

        // Crouch-only wherever the run is enclosed, mouth to mouth. Sampling
        // the midpoint alone would pass a run that is only capped over part of
        // its length. Samples under a deck void are skipped: there the run has
        // deliberately opened into the room above, which is the whole point of
        // the hatch the upper run climbs through.
        const samples = Math.max(4, Math.floor((to - from) / 1.0));
        let standing = 0;
        let cramped = 0;
        let enclosed = 0;
        for (let i = 1; i < samples; i++) {
          const along = from + ((to - from) * i) / samples;
          const x = alongX ? along : cross;
          const z = alongX ? cross : along;
          const underVoid = h.map.deckVoids.some(
            (hole) => x > hole.x0 && x < hole.x1 && z > hole.z0 && z < hole.z1 && hole.top > floorY
          );
          if (underVoid) continue;
          enclosed++;
          if (at(along, standHalf, CONFIG.shade.standHeight)) standing++;
          if (!at(along, crouchHalf, CONFIG.shade.crouchHeight)) cramped++;
        }
        if (standing > 0) problems.push(`${vent.tag} allows standing at ${standing}/${enclosed} enclosed samples`);
        if (cramped > 0) problems.push(`${vent.tag} blocks crouching at ${cramped}/${enclosed} enclosed samples`);
        if (enclosed < (samples - 1) * 0.6) {
          problems.push(`${vent.tag} is open to a void along ${samples - 1 - enclosed}/${samples - 1} of its length`);
        }
        if (!at(from + 0.4, crouchHalf, CONFIG.shade.crouchHeight)) problems.push(`${vent.tag} start mouth blocked`);
        if (!at(to - 0.4, crouchHalf, CONFIG.shade.crouchHeight)) problems.push(`${vent.tag} end mouth blocked`);
      }

      // The two-tier chain heights must land in the spec bands by construction.
      const chain = [
        ['ground -> lower vent', CONFIG.map.ventFloorY - CONFIG.map.groundY],
        ['lower vent -> upper vent', CONFIG.map.ventUpperY - CONFIG.map.ventFloorY],
        ['upper vent -> deck', CONFIG.map.catwalkY - CONFIG.map.ventUpperY],
      ];
      for (const [label, rise] of chain) {
        if (classifyReach(rise, CONFIG.shade.reach.standing + CONFIG.shade.reach.jumpBonus) !== 'mantle') problems.push(`${label} rise ${rise.toFixed(2)}m is not a mantle`);
      }
      if (grade < 2) problems.push(`only ${grade} vent mouths at grade, v2 wants at least 2`);

      return {
        pass: problems.length === 0,
        detail:
          problems.length === 0
            ? `${h.map.vents.length} runs crouch-only end to end (${grade} at grade); chain ${chain.map(([label, rise]) => `${label} ${rise.toFixed(2)}m`).join(', ')}, all mantle`
            : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'shade-spawns-are-outside-the-shell',
    spec: 'v2 requirement 3',
    name: 'The Shade starts outside the building, on clear ground',
    run: (h) => {
      const shell = h.map.shell;
      const half = { x: CONFIG.shade.radius, y: CONFIG.shade.standHeight / 2, z: CONFIG.shade.radius };
      const problems = [];

      for (let i = 0; i < h.map.shadeSpawns.length; i++) {
        const spawn = h.map.shadeSpawns[i];
        const p = spawn.position;
        if (p.x > shell.x0 && p.x < shell.x1 && p.z > shell.z0 && p.z < shell.z1) {
          problems.push(`spawn ${i} (${spawn.name}) is inside the shell`);
        }
        if (!h.map.collision.isClear({ x: p.x, y: p.y + half.y + 0.02, z: p.z }, half)) {
          problems.push(`spawn ${i} (${spawn.name}) has no room to stand`);
        }
        const ground = h.map.collision.raycast({ x: p.x, y: p.y + 1.0, z: p.z }, { x: 0, y: -1, z: 0 }, 2.0);
        if (!ground || Math.abs(ground.y - p.y) > 0.05) {
          problems.push(`spawn ${i} (${spawn.name}) is not standing on the ground plane`);
        }
      }

      // The Warden stays inside, or the two roles start on the same side of
      // the wall and the infiltration premise is gone.
      for (let i = 0; i < h.map.wardenSpawns.length; i++) {
        const p = h.map.wardenSpawns[i].position;
        const inside = p.x > shell.x0 && p.x < shell.x1 && p.z > shell.z0 && p.z < shell.z1;
        if (!inside) problems.push(`warden spawn ${i} is outside the shell`);
      }

      return {
        pass: problems.length === 0,
        detail:
          problems.length === 0
            ? `${h.map.shadeSpawns.length} shade spawns outside the shell (x ${shell.x0}..${shell.x1}, z ${shell.z0}..${shell.z1}) and clear; ${h.map.wardenSpawns.length} warden spawns inside`
            : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'every-room-has-two-entries',
    spec: 'v2 requirement 5',
    name: 'No room can be sealed by standing in one doorway',
    run: (h) => {
      const half = { x: CONFIG.shade.radius, y: CONFIG.shade.crouchHeight / 2, z: CONFIG.shade.radius };
      const problems = [];
      const summaries = [];

      for (const room of h.map.rooms) {
        if (room.entries.length < CONFIG.map.roomMinEntries) {
          problems.push(`${room.id}: ${room.entries.length} entries`);
          continue;
        }
        // Re-test each reported entry independently: a derived count is only
        // worth anything if the openings it counted are really passable.
        const bad = room.entries.filter((entry) => {
          const y = entry.kind === 'lateral' ? entry.at.y + half.y + 0.02 : entry.at.y;
          return !h.map.collision.isClear({ x: entry.at.x, y, z: entry.at.z }, half);
        });
        if (bad.length) {
          problems.push(`${room.id}: ${bad.length} reported entries are blocked: ${bad.map((entry) =>
            `${entry.edge} at (${entry.at.x.toFixed(1)}, ${entry.at.y.toFixed(1)}, ${entry.at.z.toFixed(1)})`).join(', ')}`);
          continue;
        }
        const kinds = room.entries.map((entry) => entry.edge).join('/');
        summaries.push(`${room.id} ${room.entries.length} (${kinds})`);
      }

      return {
        pass: problems.length === 0,
        detail:
          problems.length === 0
            ? `${h.map.rooms.length} rooms, all with >= ${CONFIG.map.roomMinEntries} verified entries: ${summaries.join('; ')}`
            : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-warden-can-walk-to-every-spawn-waypoint-and-site',
    spec: 'Section 6.2 / Block A phase 1',
    name: "The Warden's reachable ground covers every spawn, waypoint and site",
    run: (h) => {
      const ground = h.map.wardenGround;
      if (!ground) return { pass: false, detail: 'map.wardenGround was never derived' };
      const problems = [];

      const onIt = (label, position) => {
        if (ground.has(position)) return;
        const floors = ground.floorsAt(position.x, position.z);
        problems.push(
          `${label} at y=${position.y.toFixed(2)} is not on it (column holds ${floors.length ? floors.map((y) => y.toFixed(2)).join('/') : 'nothing'})`
        );
      };

      for (let i = 0; i < h.map.wardenSpawns.length; i++) {
        onIt(`warden spawn ${i} (${h.map.wardenSpawns[i].name})`, h.map.wardenSpawns[i].position);
      }
      // Every patrol waypoint, or the AI walks a route through thin air - and
      // A*'s own checks would never notice, because the graph is authored.
      for (const node of h.map.waypoints) {
        if (node) onIt(`waypoint ${node.id} (${node.tag})`, node.position);
      }
      // Every site centre, or the round cannot be defended at all.
      for (const site of h.map.sites) onIt(`site ${site.id} (${site.name})`, site.position);

      let columns = 0;
      let multi = 0;
      ground.columns.forEach((floors) => {
        columns++;
        if (floors.length > 1) multi++;
      });

      // And it is ONE ground, not islands. A1 flooded from four spawns, two of
      // them on the deck, and shipped with the deck and the floor as two
      // components: no edge climbed either staircase, because a 0.5m cell can
      // hold two 0.3m risers. Coverage could not see it - every spawn,
      // waypoint and site was on some island. Walking the edges from the first
      // spawn has to reach every cell, or the Warden's map of where it can go
      // has a floor it cannot get to from where it starts.
      const first = h.map.wardenSpawns[0];
      const route = ground.route(
        { x: first.position.x, y: first.position.y, z: first.position.z },
        first.position
      );
      if (!route) problems.push('the first Warden spawn is not on its own ground');
      const start = ground.cellAt(first.position);
      const seen = new Set();
      if (start) {
        const queue = [ground.cellId(start.i, start.j, start.k)];
        seen.add(queue[0]);
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (let head = 0; head < queue.length; head++) {
          const id = queue[head];
          const mask = ground.edges.get(id) || 0;
          const k = id % 4;
          const key = (id - k) / 4;
          const i = key % ground.nx;
          const j = (key - i) / ground.nx;
          const y = ground.columns.get(key)[k];
          for (let n = 0; n < 4; n++) {
            if (!(mask & (1 << n))) continue;
            const floors = ground.columns.get(ground.key(i + dirs[n][0], j + dirs[n][1]));
            if (!floors) continue;
            for (let nk = 0; nk < floors.length; nk++) {
              if (Math.abs(floors[nk] - y) > CONFIG.warden.stepHeight * 2 + 0.01) continue;
              const nid = ground.cellId(i + dirs[n][0], j + dirs[n][1], nk);
              if (!seen.has(nid)) {
                seen.add(nid);
                queue.push(nid);
              }
            }
          }
        }
      }
      if (seen.size !== ground.count) {
        problems.push(`walking the edges from spawn 0 (${first.name}) reaches ${seen.size} of ${ground.count} cells; the rest is an island`);
      }

      return {
        pass: problems.length === 0,
        detail:
          problems.length === 0
            ? `${ground.count} standable cells in ${columns} columns (${multi} carrying two or more floors) on a ${ground.cell}m grid, all reachable from spawn 0 over ${ground.edges.size} edges; all ${h.map.wardenSpawns.length} spawns, ${h.map.waypoints.length} waypoints and ${h.map.sites.length} site centres are on it`
            : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-warden-never-climbs-to-reach-its-ground',
    spec: 'Section 6.2 / Block A phase 1',
    name: 'Nothing the Warden can stand on was climbed, crawled or vaulted onto',
    run: (h) => {
      const ground = h.map.wardenGround;
      if (!ground) return { pass: false, detail: 'map.wardenGround was never derived' };
      // Deliberately NOT warden.stepHeight. A check that reads the same
      // constant the derivation read can only ever agree with it; "level with"
      // is a fact about the geometry, so raising the step limit breaks this
      // check instead of moving it.
      const flush = 0.06;
      const radius = CONFIG.warden.radius;
      const problems = [];

      // A vent is crouch-only and the Warden cannot crouch (Section 6.2), so no
      // cell may sit on a duct floor. Checked against the vent volumes rather
      // than trusting that the standing capsule happened not to fit.
      let inVents = 0;
      for (const vent of h.map.vents) {
        const cells = ground.cellsWithin(
          { x: (vent.min.x + vent.max.x) / 2, z: (vent.min.z + vent.max.z) / 2 },
          Math.max(vent.max.x - vent.min.x, vent.max.z - vent.min.z)
        );
        for (const cell of cells) {
          if (cell.x < vent.min.x || cell.x > vent.max.x) continue;
          if (cell.z < vent.min.z || cell.z > vent.max.z) continue;
          if (cell.y < vent.min.y - flush || cell.y >= vent.max.y - flush) continue;
          inVents++;
          if (inVents <= 3) problems.push(`a cell stands inside vent ${vent.tag} at y=${cell.y.toFixed(2)}`);
        }
      }
      if (inVents > 3) problems.push(`...and ${inVents - 3} more cells inside vents`);

      // A climbable surface top may be on the ground set, but only where the
      // Warden walked onto it - the deck lips are flush with the deck it
      // already patrols. What it may never be is an island: a top the set
      // reaches with nothing beside it at that height is a surface something
      // climbed, which is the one thing this derivation must not do.
      let shared = 0;
      const sharedAt = [];
      const islands = [];
      for (const ledge of h.map.ledges) {
        const box = ledge.box;
        const top = ledge.topY;
        const halfDiag = Math.hypot(box.max.x - box.min.x, box.max.z - box.min.z) / 2;
        const cells = ground.cellsWithin(
          { x: (box.min.x + box.max.x) / 2, z: (box.min.z + box.max.z) / 2 },
          halfDiag + radius + ground.cell * 2
        );
        let onTop = false;
        let beside = false;
        for (const cell of cells) {
          if (Math.abs(cell.y - top) > flush) continue;
          // "Beside" has to mean the body is clear of the surface altogether,
          // not that the cell centre is past its edge. A footprint overlapping
          // the top face by a finger is resting on it, exactly as the swept
          // solver would have it - so counting that as "beside" would let
          // every climbed surface vouch for itself.
          const touching =
            cell.x > box.min.x - radius && cell.x < box.max.x + radius &&
            cell.z > box.min.z - radius && cell.z < box.max.z + radius;
          if (touching) onTop = true;
          else beside = true;
        }
        if (!onTop) continue;
        if (beside) {
          shared++;
          if (sharedAt.indexOf(top.toFixed(2)) === -1) sharedAt.push(top.toFixed(2));
        } else {
          islands.push(`${box.tag || 'untagged'} at y=${top.toFixed(2)} (rise ${ledge.rise.toFixed(2)}m)`);
        }
      }
      if (islands.length) {
        problems.push(`climbable tops reached with nothing walkable beside them: ${islands.join(', ')}`);
      }

      return {
        pass: problems.length === 0,
        detail:
          problems.length === 0
            ? `no cell inside any of ${h.map.vents.length} vent runs; of ${h.map.ledges.length} climbable surfaces, ${shared} are flush with ground the Warden already walks (at y=${sharedAt.sort().join(', ')}) and 0 were climbed onto`
            : problems.join('; '),
      };
    },
  });
}
