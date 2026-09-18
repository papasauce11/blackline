/**
 * BLACKLINE — maps/yarddata.js
 *
 * "Container Yard": the level's data that is not geometry. Plant sites,
 * spawns, the lights and the ambient rig, the AI waypoint graph and the
 * declared routes up. `yard.js` lays the geometry and calls these in order
 * once the rooms exist (a site finds its room by containment). Split from
 * the layout as the plant's data is from its (F3), so each can be read
 * whole.
 *
 * Layering (Section 3.1): as yard.js — mapkit, config.
 */

import { CONFIG } from '../config.js';

const M = CONFIG.map;
const P = CONFIG.palette;
const G = M.groundY;

/**
 * The container (D35): a high cube, 2.9 tall - above `shade.reach.standing`
 * (2.6), so one high is a jump and a grab, and two high is past the jump's
 * reach (3.8), so it needs the one below as a stage. 20ft is 6.0 long, 40ft
 * 12.0, 10ft 3.0; every one 2.4 wide. Stated here, beside the routes that
 * name the tier heights, and read by yard.js for the geometry.
 */
export const CONTAINER = { height: 2.9, width: 2.4 };
/** The tier heights a top can be at: one, two and three high. */
export const TIERS = [G + CONTAINER.height, G + 2 * CONTAINER.height, G + 3 * CONTAINER.height];

/**
 * Plant sites (Section 5). Each site's room is derived by containment
 * (`GameMap.addSite`), so the rooms must be declared first. A and B in the
 * bays either side of the gate lane, C across the south.
 */
export function placeSites(map) {
  const siteSpecs = [
    { id: 'A', x: -19.0, y: G, z: -8.0, name: 'Bay A' },
    { id: 'B', x: 16.0, y: G, z: -8.0, name: 'Bay B' },
    { id: 'C', x: 0.0, y: G, z: 10.5, name: 'Bay C' },
  ];
  for (const spec of siteSpecs) map.addSite(spec);
}

/**
 * Spawns. The Shade starts on the apron outside the ring (v2 requirement
 * 3, re-read for outdoors: outside the working yard); the Warden at the
 * gatehouse, with a spawn in each bay for the reinsert scoring to pick from.
 */
export function placeSpawns(map) {
  // Index 0 is the round-start spawn (Section 5); 1-3 are reinsert-only
  // candidates (Section 10.2, Section 15).
  const shadeSpawnSpecs = [
    { x: -35.0, z: 27.0, name: 'south-west apron' },
    { x: 35.0, z: -27.0, name: 'north-east apron' },
    { x: -35.0, z: -27.0, name: 'north-west apron' },
    { x: 35.0, z: 27.0, name: 'south-east apron' },
  ];
  for (const spec of shadeSpawnSpecs) map.addShadeSpawn({ ...spec, y: G });

  const wardenSpawnSpecs = [
    { x: 0.0, y: G, z: -15.0, yaw: Math.PI, name: 'gatehouse' },
    { x: -14.0, y: G, z: -15.0, yaw: Math.PI * 0.75, name: 'bay a' },
    { x: 14.0, y: G, z: -15.0, yaw: Math.PI * 1.25, name: 'bay b' },
    { x: 0.0, y: G, z: 16.5, yaw: 0, name: 'bay c' },
  ];
  for (const spec of wardenSpawnSpecs) map.addWardenSpawn(spec);
}

/**
 * The yard at night (D4; D9 provisional). Floodlights on masts light the
 * sites and the gate in pools; between the stacks it is dark. The sky is
 * the rig over `CONFIG.map.lighting`'s: a hemisphere too dim to read the
 * ground by, a cool fill from straight overhead so a shadow is a shade
 * and not a hole (Section 4's dark gaps have to be navigable), and the
 * one shadowed key (Section 4.1) is a floodlight: warm, low, aimed from
 * the head of the mast that covers the most of the yard's ground at its
 * centre, so every stack throws a long hard shadow away from it; the sky
 * lands about 8 of luma on the ground where the key reaches and 3 in a
 * shadow, a lamp 13 to 22 in its pool. The lamps, not the sky, are
 * what light a site - `lit-pools-and-dark-gaps-
 * are-actually-contrasty` requires each site's lamp to add more than the
 * sky lands there, because shooting the lamp out is the mechanic, and a
 * day sky (the plant's rig outdoors) put 21 of luma on the ground before
 * a lamp added its 7. The numbers to turn are here.
 */
export const RIG = {
  hemisphereIntensity: 0.2,
  keyIntensity: 0.3,
  // The fill is what a shadow reads by: from straight overhead, in the
  // lamps' cool, less than half the day's - `ambientSky`, the plant's fill
  // colour, is too dark a blue to land anything at any intensity.
  fillIntensity: 0.14,
  fillDirection: [0.15, -1.0, 0.1],
  fillColor: P.lightCool,
};

/**
 * A floodlight mast: a pole on the ground, an arm from its top, the lamp
 * at the arm's end. The pole and the arm are thinner than a body, so the
 * rule finds nothing to stand on and nothing to climb, and each stands
 * against a wall or in a corner off every lane the Warden walks. The
 * head is at `head`: past a standing reach from any tier top beside it,
 * under the tier the walkway keeps for itself. A head at 6.5m needs
 * `lift` times the plant's pendant to land the same pool - the inverse
 * square, and the yard's ground is the darker concrete.
 */
export const MAST = { pole: 0.3, arm: 0.15, height: 6.7, head: 6.5, lift: 2.5 };

/**
 * Where the masts stand, and where their heads hang. `pole` is the
 * foot's centre, `head` the lamp's (x, z) - the arm reaches from one to
 * the other. `KEY_MAST` names the one the shadowed key shines from: the
 * mast whose lamp reaches the most of the Warden's ground inside the ring
 * (the arena, not the apron) - bay C's, which stands in the widest open
 * floor in the yard and reaches the mid lane and the east store besides.
 * `the-yard-is-floodlit-from-masts-at-night` (tests/yardlight.js) counts
 * the cells and holds the name to the count.
 */
export const MASTS = [
  // Against bay A's south row, the arm out over the site.
  { tag: 'bay-a', pole: [-19.0, -4.55], head: [-19.0, -7.7], dim: false },
  // Bay B, the mirror.
  { tag: 'bay-b', pole: [16.0, -4.55], head: [16.0, -7.7], dim: false },
  // Against bay C's east wall, the arm out over the bay. The dimmest, as
  // the plant's site C is.
  { tag: 'bay-c', pole: [9.45, 10.5], head: [6.4, 10.5], dim: true },
  // In the open ground west of the gate lane, north of the stair's foot,
  // the arm out over the lane just inside the arch.
  { tag: 'gate', pole: [-3.85, -17.0], head: [0.0, -17.0], dim: false },
];
export const KEY_MAST = 'bay-c';

/**
 * Destructible point lights, and the rig. Four floodlights on masts
 * (`MASTS`) and a fifth under the walkway's floor: the Warden's post
 * lights the crossroads it looks down on, so the mid lane is a pool and
 * not a gap. `EXPECTS.lights` (yard.js) is five.
 */
export function placeLights(map) {
  const L = M.lighting;
  const bright = L.pointIntensity * MAST.lift;
  const dim = bright * 0.5;
  let id = 0;
  for (const spec of MASTS) {
    mast(map, spec);
    map.addPointLight(id++, spec.head[0], G + MAST.head, spec.head[1], spec.dim ? dim : bright, spec.tag);
  }
  // Under the walkway's slab (floor at 7.2, the slab 0.2 thick), over the
  // mid lane's north edge.
  map.addPointLight(id++, 0.0, G + 6.75, -2.2, bright, 'walkway');

  const key = MASTS.find((spec) => spec.tag === KEY_MAST);
  map.addLightRig({ ...RIG, keyColor: P.lightWarm });
  map.aimKeyLight([-key.head[0], -(G + MAST.head), -key.head[1]]);
  map.keyMast = KEY_MAST;
}

/** The pole and the arm of a mast, both thinner than a body (see `MAST`). */
function mast(map, spec) {
  const [px, pz] = spec.pole;
  const [hx, hz] = spec.head;
  const half = MAST.pole / 2;
  const top = G + MAST.height;
  map.addSolid({
    min: [px - half, G, pz - half],
    max: [px + half, top, pz + half],
    color: P.wardenGunmetal,
    tag: `mast-${spec.tag}`,
    castShadow: false,
  });
  const a = MAST.arm / 2;
  map.addSolid({
    min: [Math.min(px, hx) - a, top - MAST.arm, Math.min(pz, hz) - a],
    max: [Math.max(px, hx) + a, top, Math.max(pz, hz) + a],
    color: P.wardenGunmetal,
    tag: `mast-${spec.tag}-arm`,
    castShadow: false,
  });
}

/**
 * AI waypoints (Section 5: explicit bidirectional links, every site).
 * Every link is a straight line down a lane the Warden can walk -
 * asserted by `waypoint-links-are-walkable`. The graph is the lanes: the
 * gate lane south to the mid lane, the mid lane east and west to the bay
 * doors and the storage blocks, and a node or two inside each.
 */
export function placeWaypoints(map) {
  const waypointSpecs = [
    { x: 0.0, z: -17.0, tag: 'gate' },                 // 0
    { x: 0.0, z: -9.0, tag: 'lane' },                  // 1
    { x: 0.0, z: 1.0, tag: 'mid' },                    // 2
    { x: -18.0, z: 1.0, tag: 'mid-west' },             // 3
    { x: 18.0, z: 1.0, tag: 'mid-east' },              // 4
    { x: -19.0, z: -8.0, tag: 'site-a' },              // 5
    { x: -14.0, z: -15.0, tag: 'bay-a-north' },        // 6
    { x: 16.0, z: -8.0, tag: 'site-b' },               // 7
    { x: 14.0, z: -15.0, tag: 'bay-b-north' },         // 8
    { x: 0.0, z: 10.5, tag: 'site-c' },                // 9
    { x: 0.0, z: 16.5, tag: 'bay-c-rear' },            // 10
    { x: -26.0, z: 6.5, tag: 'store-west' },           // 11
    { x: -26.5, z: 12.0, tag: 'store-west-lane' },     // 12
    { x: -19.4, z: 12.0, tag: 'store-west-yard' },     // 13
    { x: -19.4, z: 17.4, tag: 'store-west-south' },    // 14
    { x: -14.0, z: 17.5, tag: 'store-west-pocket' },   // 15
    { x: 18.0, z: 6.0, tag: 'store-east' },            // 16
    { x: 20.0, z: 12.0, tag: 'store-east-yard' },      // 17
    { x: 16.0, z: 15.0, tag: 'store-east-pocket' },    // 18
    { x: -13.0, z: -3.4, tag: 'bay-a-door' },          // 19
    { x: 13.0, z: -3.4, tag: 'bay-b-door' },           // 20
  ];
  for (let i = 0; i < waypointSpecs.length; i++) {
    const spec = waypointSpecs[i];
    map.addWaypoint(i, spec.x, G, spec.z, spec.tag);
  }

  const links = [
    // The gate lane and the mid lane.
    [0, 1], [1, 2], [2, 3], [2, 4],
    // Bay A, through the open corner at its south-east; bay B the same.
    [3, 19], [19, 5], [19, 6], [5, 6],
    [4, 20], [20, 7], [20, 8], [7, 8],
    // Bay C, through the gap in its north row.
    [2, 9], [9, 10],
    // The storage blocks: west round the three-high stack by the west lane,
    // east straight in.
    [3, 11], [11, 12], [12, 13], [13, 14], [14, 15],
    [4, 16], [16, 17], [17, 18],
  ];
  for (const [a, b] of links) map.linkWaypoints(a, b);
}

/**
 * The stairless routes up (v2 requirement 4), as data (B5): here every one
 * is a stack. A route is a chain of stages the climb rule names, the first
 * a standing climb from walkable ground - the pallets - and lands where it
 * says: the second tier, or the third. The rule reads nothing here; the
 * checks in tests/routes.js hold the map to it, and every climbable surface
 * with no approach from the ground - every second and third tier, and the
 * two arches - has to be a stage or a landing of one of these.
 */
export function placeRoutes(map) {
  const [, T2, T3] = TIERS;
  const routeSpecs = [
    {
      id: 'bay-a', name: 'Bay A: pallets, the stack, its second tier',
      stages: [['pallets-a'], ['bay-a-stack-s']], landing: T2,
    },
    {
      id: 'bay-b', name: 'Bay B: pallets, the stack, its second tier',
      stages: [['pallets-b'], ['bay-b-stack-s']], landing: T2,
    },
    {
      id: 'bay-c', name: 'Bay C: pallets, the west wall, the tier on it, the tier on that',
      stages: [['pallets-c'], ['bay-c-west'], ['bay-c-t2']], landing: T3,
    },
    {
      id: 'north-arch', name: 'The gate: pallets in bay B, the ring, the arch over the gate',
      stages: [['pallets-north'], ['ring-north-e1']], landing: T2,
    },
    {
      id: 'south-arch', name: 'The rear gate: pallets in bay C, the ring, the arch',
      stages: [['pallets-rear'], ['ring-south-w1']], landing: T2,
    },
    {
      id: 'store-west', name: 'West storage: pallets, the 40ft, the 20ft on it, the 10ft on that',
      stages: [['pallets-store-w'], ['store-w-t1'], ['store-w-t2']], landing: T3,
    },
    {
      id: 'store-west-corner', name: 'West storage: pallets, the corner pair, the tier on the south one',
      stages: [['pallets-store-w-corner'], ['store-w-corner-n']], landing: T2,
    },
    {
      id: 'store-east-corner', name: 'East storage: pallets, the corner pair, the tier on the south one',
      stages: [['pallets-store-e-corner'], ['store-e-corner-n']], landing: T2,
    },
    {
      id: 'store-east', name: 'East storage: pallets, the 20ft, the 10ft on it',
      stages: [['pallets-store-e'], ['store-e-t1']], landing: T2,
    },
  ];
  const byTag = new Map();
  for (const box of map.collision.boxes) if (box.tag) byTag.set(box.tag, box);
  for (const spec of routeSpecs) {
    map.routes.push({
      id: spec.id,
      name: spec.name,
      // Unresolved tags stay as strings; validateMap() names them.
      stages: spec.stages.map((stage) => stage.map((tag) => byTag.get(tag) || tag)),
      landing: spec.landing,
    });
  }
}
