/**
 * BLACKLINE - tests/lanes.js
 *
 * Somewhere to stand, on whatever map the page is on. Until D2 the checks
 * that only need open floor - a speed measured over three seconds, a taser
 * fired at four metres, a knife at arm's length - stood at the Turbine
 * Hall's coordinates, which were open floor on the empty yard by luck and
 * are inside a container row on the built one. D1's rule for a check is
 * "name the map only if you name its geometry"; these name none, so they
 * ask here instead.
 *
 * `clearLane(h, length)` is a straight run of `length` metres a standing
 * Warden walks along without touching anything, on the Warden's own
 * ground, found from the sites first (open floor by construction, on every
 * map) and then the waypoints and spawns, in eight headings. The first
 * that fits wins, so the answer is the same every run on a given map.
 *
 * Layering (Section 3.1): config only; the map through the harness.
 */

import { CONFIG } from '../config.js';

const W = CONFIG.warden;
/** Every 0.25m along the run. */
const LANE_STEP = 0.25;
const HEADINGS = [
  { dx: 0, dz: 1 }, { dx: 0, dz: -1 }, { dx: 1, dz: 0 }, { dx: -1, dz: 0 },
  { dx: Math.SQRT1_2, dz: Math.SQRT1_2 }, { dx: -Math.SQRT1_2, dz: Math.SQRT1_2 },
  { dx: Math.SQRT1_2, dz: -Math.SQRT1_2 }, { dx: -Math.SQRT1_2, dz: -Math.SQRT1_2 },
];

/** How far a standing Warden gets from `start` along `heading` before something is in the way. */
function runLength(h, start, heading, limit) {
  const half = { x: W.radius, y: W.standHeight / 2, z: W.radius };
  const ground = h.map.wardenGround;
  let along = 0;
  for (; along <= limit; along += LANE_STEP) {
    const at = { x: start.x + heading.dx * along, y: start.y, z: start.z + heading.dz * along };
    if (ground && !ground.has(at, W.stepHeight)) break;
    if (!h.map.collision.isClear({ x: at.x, y: at.y + half.y + 0.05, z: at.z }, half)) break;
  }
  return Math.max(0, along - LANE_STEP);
}

/**
 * A straight, clear run of at least `length` metres of floor.
 *
 * @returns {{x:number, y:number, z:number, yaw:number, dx:number, dz:number, length:number, from:string}|null}
 *   the start (feet), the yaw that faces along it (the actors' convention:
 *   forward is (-sin yaw, -cos yaw)), the heading, and where it was found
 */
export function clearLane(h, length) {
  const candidates = [
    ...h.map.sites.map((site) => ({ at: site.position, from: `site ${site.id}` })),
    ...h.map.waypoints.filter(Boolean).map((node) => ({ at: node.position, from: `waypoint ${node.tag || node.id}` })),
    ...h.map.wardenSpawns.map((spawn) => ({ at: spawn.position, from: `spawn ${spawn.name}` })),
  ];
  for (const { at, from } of candidates) {
    for (const heading of HEADINGS) {
      const run = runLength(h, at, heading, length + LANE_STEP);
      if (run < length) continue;
      return {
        x: at.x, y: at.y, z: at.z,
        yaw: Math.atan2(-heading.dx, -heading.dz),
        dx: heading.dx, dz: heading.dz,
        length: run,
        from,
      };
    }
  }
  return null;
}

/** A point `along` metres down a lane. */
export function alongLane(lane, along) {
  return { x: lane.x + lane.dx * along, y: lane.y, z: lane.z + lane.dz * along };
}
