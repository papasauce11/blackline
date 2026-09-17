/**
 * BLACKLINE — mapvalidate.js
 *
 * Build-time validation. The counts in Section 5 are contractual, and the v2
 * requirements are structural, so the map asserts both rather than letting a
 * miscount or a severed deck drift in silently. Every map's builder calls it
 * last, with the counts that map promises (D1: the plant's are Section 5's,
 * from `CONFIG.map`; the yard states its own), and it throws on any failure.
 */

import { CONFIG } from './config.js';
import { classifyReach } from './physics.js';

const M = CONFIG.map;

/**
 * @param {import('./mapkit.js').GameMap} map
 * @param {object} expects the counts this map promises
 * @param {number} expects.lights destructible point lights
 * @param {number} expects.waypoints
 * @param {number} expects.shadeSpawns
 * @param {number} expects.wardenSpawns
 * @param {number} expects.sites
 * @param {number} expects.rooms
 * @param {number} expects.routes declared stairless routes, a minimum
 */
export function validateMap(map, expects) {
  const problems = [];

  const expect = (actual, wanted, what) => {
    if (actual !== wanted) problems.push(`expected ${wanted} ${what}, built ${actual}`);
  };
  const expectAtLeast = (actual, wanted, what) => {
    if (actual < wanted) problems.push(`expected at least ${wanted} ${what}, built ${actual}`);
  };
  expect(map.lights.length, expects.lights, 'destructible lights');
  expect(map.waypoints.length, expects.waypoints, 'waypoints');
  expect(map.shadeSpawns.length, expects.shadeSpawns, 'shade spawns');
  expect(map.wardenSpawns.length, expects.wardenSpawns, 'warden spawns');
  expect(map.sites.length, expects.sites, 'plant sites');

  // A site with no room cannot be planted at all now that the room IS the
  // plant zone, and a silent null here would read in play as "the interact key
  // does nothing at site B".
  for (const site of map.sites) {
    if (!site.room) problems.push(`site "${site.id}" is not inside any room`);
  }
  expect(map.rooms.length, expects.rooms, 'rooms');

  for (const light of map.lights) {
    if (light.light.castShadow) problems.push(`point light ${light.lightId} casts shadows (Section 4.1)`);
  }

  // Every waypoint must be reachable from node 0, or the AI can strand itself.
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length) {
    const current = queue.shift();
    for (const next of map.waypoints[current].links) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  if (seen.size !== map.waypoints.length) {
    problems.push(`waypoint graph is not connected: ${seen.size}/${map.waypoints.length} reachable from node 0`);
  }

  // Links must be bidirectional (Section 5).
  for (const node of map.waypoints) {
    for (const other of node.links) {
      if (map.waypoints[other].links.indexOf(node.id) === -1) {
        problems.push(`waypoint link ${node.id} -> ${other} is not bidirectional`);
      }
    }
  }

  // v2 requirement 3: the Shade infiltrates, so it cannot start inside.
  for (let i = 0; i < map.shadeSpawns.length; i++) {
    const p = map.shadeSpawns[i].position;
    const inside =
      p.x > map.shell.x0 && p.x < map.shell.x1 && p.z > map.shell.z0 && p.z < map.shell.z1;
    if (inside) problems.push(`shade spawn ${i} is inside the building shell`);
  }

  // v2 requirement 5: no room is a single-door trap.
  for (const room of map.rooms) {
    if (room.entries.length < M.roomMinEntries) {
      problems.push(
        `room "${room.id}" has ${room.entries.length} entries, needs ${M.roomMinEntries}`
      );
    }
  }

  // v2 requirement 4: at least one lip on the deck for each climbing route, or
  // the routes end at a wall.
  const lips = map.collision.boxes.filter((box) => box.tag && box.tag.startsWith('lip-'));
  const unclimbable = lips.filter((box) => !box.climbable).map((box) => box.tag);
  if (unclimbable.length) {
    problems.push(`declared lips that did not derive as climbable: ${unclimbable.join(', ')}`);
  }
  for (const box of lips) {
    if (box.climbable && classifyReach(box.max.y - map._supportHeightBelow(box),
      CONFIG.shade.reach.standing + CONFIG.shade.reach.jumpBonus) === null) {
      problems.push(`lip "${box.tag}" is not in a traversal band`);
    }
  }

  // v2 requirement 4, the other half: the routes are declared (B5), every
  // stage names a box that exists, and there are at least as many as the
  // requirement asks. Whether each one climbs is tests/routes.js's question.
  expectAtLeast(map.routes.length, expects.routes, 'stairless routes');
  for (const route of map.routes) {
    for (const stage of route.stages) {
      for (const box of stage) {
        if (typeof box === 'string') problems.push(`route "${route.id}" names a box that does not exist: ${box}`);
      }
    }
  }

  if (problems.length) {
    for (const problem of problems) console.error(`[map] ${problem}`);
    throw new Error(`buildMap(${map.id}): ${problems.length} validation failure(s); see console`);
  }
}
