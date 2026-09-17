/**
 * BLACKLINE — maps/yard.js
 *
 * The container yard (Block D, D2): the registry's `yard`. What is here is
 * D1's plumbing test - an empty, fenced ground plane the size of the first
 * map's site, with the least a match needs to run on it: three bays that
 * are rooms so a site has one, the sites at their centres, a Shade spawn
 * at each apron corner outside the working yard, four Warden spawns, one
 * lamp over each site and one at the gate, and a ring of waypoints. No
 * stack, no walkway, no route up: D2 blocks it out, D3 raises the
 * walkway, D4 lights it, D5 teaches the AI its ground. Nothing here is a
 * decision about the yard's shape; every number is a placeholder D2 owns.
 *
 * Decided: D2 (outdoors, a container yard, similar size to the first map;
 * the Warden's glazed walkway); provisional D9, D11, D12.
 *
 * Layering (Section 3.1): as plant.js - mapkit, physics, config.
 */

import { CONFIG } from '../config.js';
import { GameMap } from '../mapkit.js';
import { validateMap } from '../mapvalidate.js';
import { lightRoutes } from '../maproutelight.js';

const M = CONFIG.map;
const P = CONFIG.palette;

/** The site: the same 80 x 65 as the plant's, "similar size" (D2). */
const SITE_W = M.siteWidth / 2;
const SITE_D = M.siteDepth / 2;
/** The working yard inside the apron; the Shade starts outside it. */
const YARD = { x0: -30.0, x1: 30.0, z0: -22.5, z1: 22.5 };
const G = M.groundY;
const SLAB = M.floorThickness;
const WALL = M.wallThickness;
/** Perimeter fence: thin, so it is nowhere to stand; above the hang band, so it is nothing to grab. */
const FENCE_HEIGHT = 4.5;
/** A bay is open to the sky; this is how high its room reaches for containment. */
const BAY_CEILING = 8.0;
/** The lamps hang where D4's masts will put them, for now. */
const LAMP_Y = 6.0;

/** What this map promises to have built, asserted by validateMap() last. */
const EXPECTS = {
  lights: 4,
  waypoints: 8,
  shadeSpawns: 4,
  wardenSpawns: 4,
  sites: 3,
  rooms: 3,
  routes: 0,
};

/**
 * @param {object} options
 * @param {string} options.id the registry's id for this map (`yard`)
 * @param {string} options.name what the menu and the briefing call it
 * @param {THREE.DataTexture} options.gradientMap 4-step toon ramp from main.js
 * @returns {GameMap}
 */
export function buildYardMap({ id, name, gradientMap }) {
  const map = new GameMap(gradientMap, id, name);
  map.shell = { ...YARD };

  // Ground: one plane, the apron and the yard the same surface.
  map.addSolid({
    min: [-SITE_W, G - SLAB, -SITE_D],
    max: [SITE_W, G, SITE_D],
    color: P.concreteDark,
    tag: 'ground-plane',
    castShadow: false,
  });

  // The perimeter fence closes the play space, as the plant's does.
  const fence = [
    { min: [-SITE_W - WALL, G, -SITE_D - WALL], max: [SITE_W + WALL, G + FENCE_HEIGHT, -SITE_D] },
    { min: [-SITE_W - WALL, G, SITE_D], max: [SITE_W + WALL, G + FENCE_HEIGHT, SITE_D + WALL] },
    { min: [-SITE_W - WALL, G, -SITE_D], max: [-SITE_W, G + FENCE_HEIGHT, SITE_D] },
    { min: [SITE_W, G, -SITE_D], max: [SITE_W + WALL, G + FENCE_HEIGHT, SITE_D] },
  ];
  for (const spec of fence) {
    map.addSolid({ ...spec, color: P.concreteDark, tag: 'site-fence', castShadow: false });
  }

  // Three bays, declared as rooms so each site has one. Open on every side
  // until D2 stacks containers round them; the entry derivation will count
  // each open edge as a way in, which is honest.
  const bays = [
    { id: 'bay-a', name: 'Bay A', min: [-28.0, -20.0], max: [-8.0, -2.0] },
    { id: 'bay-b', name: 'Bay B', min: [8.0, -20.0], max: [28.0, -2.0] },
    { id: 'bay-c', name: 'Bay C', min: [-10.0, 4.0], max: [10.0, 20.0] },
  ];
  for (const bay of bays) {
    map.addRoom({ ...bay, floorY: G, ceilingY: G + BAY_CEILING });
  }

  // Sites at the bay centres, after the rooms (a site finds its room by
  // containment).
  map.addSite({ id: 'A', name: 'Bay A', x: -18.0, y: G, z: -11.0 });
  map.addSite({ id: 'B', name: 'Bay B', x: 18.0, y: G, z: -11.0 });
  map.addSite({ id: 'C', name: 'Bay C', x: 0.0, y: G, z: 12.0 });

  // The Shade starts outside the working yard (v2 requirement 3, re-read
  // for outdoors): index 0 is the round-start spawn, 1-3 reinsert points.
  map.addShadeSpawn({ x: -35.0, y: G, z: 27.0, name: 'south-west apron' });
  map.addShadeSpawn({ x: 35.0, y: G, z: -27.0, name: 'north-east apron' });
  map.addShadeSpawn({ x: -35.0, y: G, z: -27.0, name: 'north-west apron' });
  map.addShadeSpawn({ x: 35.0, y: G, z: 27.0, name: 'south-east apron' });

  // The Warden starts at the gate (D2's gatehouse, when there is one) and
  // has a spawn in each bay for the reinsert scoring to pick from.
  map.addWardenSpawn({ x: 0.0, y: G, z: -21.0, yaw: Math.PI, name: 'gate' });
  map.addWardenSpawn({ x: -18.0, y: G, z: -6.0, yaw: Math.PI * 0.75, name: 'bay a' });
  map.addWardenSpawn({ x: 18.0, y: G, z: -6.0, yaw: Math.PI * 1.25, name: 'bay b' });
  map.addWardenSpawn({ x: 0.0, y: G, z: 16.0, yaw: 0, name: 'bay c' });

  // One lamp over each site, one at the gate, and the shared rig.
  map.addPointLight(0, -18.0, LAMP_Y, -11.0, M.lighting.pointIntensity, 'bay-a');
  map.addPointLight(1, 18.0, LAMP_Y, -11.0, M.lighting.pointIntensity, 'bay-b');
  map.addPointLight(2, 0.0, LAMP_Y, 12.0, M.lighting.pointIntensity * 0.45, 'bay-c');
  map.addPointLight(3, 0.0, LAMP_Y, -21.0, M.lighting.pointIntensity, 'gate');
  map.addLightRig();

  // A ring of waypoints through the three bays and the gate, every link a
  // straight line over open ground.
  const waypointSpecs = [
    { x: 0.0, z: -21.0, tag: 'gate' },        // 0
    { x: -18.0, z: -11.0, tag: 'site-a' },    // 1
    { x: 18.0, z: -11.0, tag: 'site-b' },     // 2
    { x: 0.0, z: -8.0, tag: 'yard-north' },   // 3
    { x: -18.0, z: 6.0, tag: 'yard-west' },   // 4
    { x: 18.0, z: 6.0, tag: 'yard-east' },    // 5
    { x: 0.0, z: 12.0, tag: 'site-c' },       // 6
    { x: 0.0, z: 0.0, tag: 'yard-mid' },      // 7
  ];
  for (let i = 0; i < waypointSpecs.length; i++) {
    const spec = waypointSpecs[i];
    map.addWaypoint(i, spec.x, G, spec.z, spec.tag);
  }
  const links = [[0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [3, 7], [1, 4], [2, 5], [4, 6], [5, 6], [6, 7]];
  for (const [a, b] of links) map.linkWaypoints(a, b);

  // No routes up until there is something to go up.

  map.collision.build();
  map.deriveClimbableSurfaces();
  lightRoutes(map);
  map.deriveRoomEntries();
  map.deriveWardenGround();
  validateMap(map, EXPECTS);

  return map;
}
