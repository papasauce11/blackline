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
 * `litLane(h, length, stands)` is the same run, and the map's lamps light
 * it: the visibility meter reads at least `LIT_METER` for a standing Shade
 * at every distance in `stands` down it (D5). The AI checks that measure a
 * "lit, still" Shade hold the meter at its maximum so their numbers are
 * the preset's and not the lamp's; a lane the lamps light is what makes
 * that an approximation and not a lie. Until D5 they stood in the Turbine
 * Hall, which five lamps put in the seventies; the yard's masts land in
 * the fifties (D39), and a gap between stacks reads the ambient floor.
 *
 * Layering (Section 3.1): config only; the map through the harness.
 */

import { CONFIG } from '../config.js';

const W = CONFIG.warden;
const D = CONFIG.detection;
/** Every 0.25m along the run. */
const LANE_STEP = 0.25;
/**
 * "Lit": the meter reads more than half its range. Section 16 checks 8 and
 * 9 draw the plant's lit and dark at 70 and 25; half is the line a lamp's
 * pool crosses on either map and the ambient floor (3) and a stack's
 * shadow never do.
 */
export const LIT_METER = D.meterMax / 2;
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
 * Every straight, clear run of at least `length` metres of floor, in the
 * order they are found: the sites, the waypoints, the spawns, each in the
 * eight headings.
 *
 * @returns {Iterable<{x:number, y:number, z:number, yaw:number, dx:number, dz:number, length:number, from:string}>}
 *   the start (feet), the yaw that faces along it (the actors' convention:
 *   forward is (-sin yaw, -cos yaw)), the heading, and where it was found
 */
function* clearLanes(h, length) {
  const candidates = [
    ...h.map.sites.map((site) => ({ at: site.position, from: `site ${site.id}` })),
    ...h.map.waypoints.filter(Boolean).map((node) => ({ at: node.position, from: `waypoint ${node.tag || node.id}` })),
    ...h.map.wardenSpawns.map((spawn) => ({ at: spawn.position, from: `spawn ${spawn.name}` })),
  ];
  for (const { at, from } of candidates) {
    for (const heading of HEADINGS) {
      const run = runLength(h, at, heading, length + LANE_STEP);
      if (run < length) continue;
      yield {
        x: at.x, y: at.y, z: at.z,
        yaw: Math.atan2(-heading.dx, -heading.dz),
        dx: heading.dx, dz: heading.dz,
        length: run,
        from,
      };
    }
  }
}

/** A straight, clear run of at least `length` metres of floor, or null. */
export function clearLane(h, length) {
  for (const lane of clearLanes(h, length)) return lane;
  return null;
}

/**
 * What the visibility meter reads for a standing Shade at a foot position:
 * the sample `detection.reset()` seeds the meter with at a spawn, read the
 * same way. The Shade is moved to read it and put back where it was.
 */
export function meterAt(h, feet) {
  const { shade, detection } = h;
  const was = { x: shade.position.x, y: shade.feetY, z: shade.position.z };
  const yaw = shade.yaw;
  shade.reset({ position: feet, yaw });
  detection.reset(shade);
  const reading = detection.raw;
  shade.reset({ position: was, yaw });
  detection.reset(shade);
  return reading;
}

/**
 * A clear lane the lamps light: the first `clearLane` whose meter reads at
 * least `LIT_METER` at every distance in `stands` down it.
 *
 * @returns {(ReturnType<typeof clearLane> & { meters: number[] })|null}
 *   the lane and the reading at each stand, or null
 */
export function litLane(h, length, stands) {
  for (const lane of clearLanes(h, length)) {
    const meters = stands.map((along) => meterAt(h, alongLane(lane, along)));
    if (meters.every((reading) => reading >= LIT_METER)) return { ...lane, meters };
  }
  return null;
}

/** A point `along` metres down a lane. */
export function alongLane(lane, along) {
  return { x: lane.x + lane.dx * along, y: lane.y, z: lane.z + lane.dz * along };
}
