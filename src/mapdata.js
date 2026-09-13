/**
 * BLACKLINE — mapdata.js
 *
 * "Meridian Substation", v2: the level's data that is not geometry. Plant
 * sites, spawns, the destructible lights and the ambient rig, and the AI
 * waypoint graph. `map.js` lays the geometry and calls these in order once
 * the rooms exist (a site finds its room by containment). Split out of map.js
 * (F3) so the layout and the placements can each be read whole.
 *
 * Layering (Section 3.1): as map.js — mapkit, config, three.
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { facing } from './mapkit.js';

const M = CONFIG.map;
const P = CONFIG.palette;
const G = M.groundY;
const DECK = M.catwalkY;
/** Top of the roof slab, as map.js has it. */
const ROOF = M.ceilingY + M.wallThickness;

/**
 * Plant sites (Section 5). Each site's room is derived by containment, so the
 * rooms must be declared first.
 */
export function placeSites(map) {
  const siteSpecs = [
    { id: 'A', x: -18.0, y: G, z: -4.0, name: 'Turbine Hall' },
    { id: 'B', x: 18.0, y: G, z: -10.0, name: 'Loading Bay' },
    { id: 'C', x: 18.0, y: DECK, z: 12.5, name: 'Server Vault' },
  ];
  const ringGeometry = new THREE.RingGeometry(M.marking.siteRingInner, M.marking.siteRingOuter, 36);
  for (const spec of siteSpecs) {
    const ring = map.addDecal(
      ringGeometry,
      P.hazardOrange,
      new THREE.Vector3(spec.x, spec.y + 0.02, spec.z),
      -Math.PI / 2,
      M.marking.siteRingPulseMax
    );
    // The room the site is the objective of. Derived by containment rather
    // than declared, so a site that moves cannot end up pointing at the room
    // it used to be in. The plant is allowed anywhere in this volume
    // (Section 10.1, amended); the ring says which room, not which square
    // metre of it.
    const room = map.rooms.find((entry) => (
      spec.x >= entry.min.x && spec.x <= entry.max.x
      && spec.z >= entry.min.z && spec.z <= entry.max.z
      && spec.y >= entry.floorY - 0.5 && spec.y < entry.ceilingY - 0.5
    )) || null;

    map.sites.push({
      id: spec.id,
      name: spec.name,
      position: new THREE.Vector3(spec.x, spec.y, spec.z),
      radius: CONFIG.round.siteRadius,
      room,
      ring,
    });
  }
}

/**
 * Spawns. The Shade starts outside the shell (v2 requirement 3); the Warden
 * starts inside, on both floors.
 */
export function placeSpawns(map) {
  // Index 0 is the fixed round-start spawn (Section 5): the darkest corner of
  // the apron, furthest from any lit opening. 1-3 are reinsert-only candidates
  // required by Section 10.2 and Section 15. See PROGRESS.md Q1.
  const shadeSpawnSpecs = [
    { x: -35.0, z: 27.0, name: 'south-west apron' },
    { x: 35.0, z: -27.0, name: 'north-east apron' },
    { x: -35.0, z: -27.0, name: 'north-west apron' },
    { x: 35.0, z: 27.0, name: 'south-east apron' },
  ];
  for (const spec of shadeSpawnSpecs) {
    map.shadeSpawns.push({
      position: new THREE.Vector3(spec.x, G, spec.z),
      yaw: facing(spec.x, spec.z, 0, 0),
      name: spec.name,
    });
  }

  const wardenSpawnSpecs = [
    { x: -22.0, y: G, z: -12.0, yaw: Math.PI * 0.75, name: 'turbine hall' },
    { x: 24.0, y: G, z: -10.0, yaw: Math.PI * 1.25, name: 'loading bay' },
    { x: 18.0, y: DECK, z: 16.5, yaw: 0, name: 'server vault' },
    { x: -28.8, y: DECK, z: -14.0, yaw: Math.PI / 2, name: 'deck west catwalk' },
  ];
  for (const spec of wardenSpawnSpecs) {
    map.wardenSpawns.push({
      position: new THREE.Vector3(spec.x, spec.y, spec.z),
      yaw: spec.yaw,
      name: spec.name,
    });
  }
}

/**
 * Destructible point lights (Section 5: 12, each with a lightId), and the
 * ambient rig.
 *
 * Heights are re-keyed to the v2 layout. The hall's pendants hang at deck
 * level in the void, so they light the floor 6m below and the catwalk band
 * beside them; everything under the deck hangs just below it.
 */
export function placeLights(map) {
  const L = M.lighting;
  const bright = L.pointIntensity;
  const dim = L.pointIntensity * 0.45;
  const veryDim = L.pointIntensity * 0.22;
  const UNDER_DECK = DECK - 1.0;

  const lightSpecs = [
    // Turbine Hall — brightly lit, high risk (site A).
    { x: -22.0, y: 6.6, z: -14.0, i: bright, tag: 'hall-1' },
    { x: -22.0, y: 6.6, z: -2.0, i: bright, tag: 'hall-2' },
    { x: -13.0, y: 6.6, z: -14.0, i: bright, tag: 'hall-3' },
    { x: -13.0, y: 6.6, z: -2.0, i: bright, tag: 'hall-4' },
    { x: -18.0, y: 5.0, z: -4.0, i: bright, tag: 'hall-site-a' },
    // Loading Bay — mixed light (site B).
    { x: 12.0, y: UNDER_DECK, z: -16.0, i: dim, tag: 'bay-1' },
    { x: 20.0, y: UNDER_DECK, z: -8.0, i: bright, tag: 'bay-2' },
    { x: 27.0, y: UNDER_DECK, z: -18.0, i: dim, tag: 'bay-3' },
    // Corridor ring — three destructible ceiling lights (Section 5).
    { x: 0.0, y: UNDER_DECK, z: -18.0, i: dim, tag: 'corridor-n' },
    { x: 0.0, y: UNDER_DECK, z: 14.0, i: dim, tag: 'corridor-s' },
    { x: -2.0, y: UNDER_DECK, z: 3.0, i: dim, tag: 'corridor-w' },
    // Server Vault — lowest light in the map (site C).
    { x: 18.0, y: 9.5, z: 12.0, i: veryDim, tag: 'vault-1' },
  ];
  for (let i = 0; i < lightSpecs.length; i++) {
    const spec = lightSpecs[i];
    map.addPointLight(i, spec.x, spec.y, spec.z, spec.i, spec.tag);
  }

  // Ambient rig. Section 4: one dim hemisphere, 2 directional fills.
  // Section 4.1: exactly one of the directionals casts shadows.
  const hemisphere = new THREE.HemisphereLight(P.ambientSky, P.ambientGround, L.hemisphereIntensity);
  map.root.add(hemisphere);

  const key = new THREE.DirectionalLight(P.lightCool, L.keyIntensity);
  key.position.set(-L.keyDirection[0] * 60, -L.keyDirection[1] * 60, -L.keyDirection[2] * 60);
  key.target.position.set(0, 0, 0);
  key.castShadow = true; // The one and only shadow caster in the scene.
  key.shadow.mapSize.set(CONFIG.render.shadowMapSize, CONFIG.render.shadowMapSize);
  const frustum = CONFIG.render.shadowFrustum;
  key.shadow.camera.left = frustum.left;
  key.shadow.camera.right = frustum.right;
  key.shadow.camera.top = frustum.top;
  key.shadow.camera.bottom = frustum.bottom;
  key.shadow.camera.near = frustum.near;
  key.shadow.camera.far = frustum.far;
  key.shadow.bias = CONFIG.render.shadowBias;
  key.shadow.normalBias = CONFIG.render.shadowNormalBias;
  key.shadow.camera.updateProjectionMatrix();
  map.root.add(key);
  map.root.add(key.target);
  map.keyLight = key;

  const fill = new THREE.DirectionalLight(P.ambientSky, L.fillIntensity);
  fill.position.set(-L.fillDirection[0] * 60, -L.fillDirection[1] * 60, -L.fillDirection[2] * 60);
  fill.castShadow = false;
  map.root.add(fill);
  map.root.add(fill.target);
}

/**
 * The stairless routes up (v2 requirement 4), as data (B5).
 *
 * The climb rule has no exceptions and reads nothing declared, so nothing
 * here can make a surface climbable or stop it being so. What this is for is
 * the opposite: holding the map to what it MEANS. A route is a chain of
 * stages - one or more boxes at a level, every one of which the rule names
 * as climbable from some box of the stage below, the first from ground a
 * walking body reaches and within standing reach, so the first step never
 * needs a jump to be discovered - ending on the surface it lands at. The
 * check in tests/routes.js walks every chain through the rule's own
 * approaches, and asks the other direction too: every climb the census
 * reports as needing a leg up is a stage or a landing of some route here.
 * A stacked climb that no route explains is either a new route to declare
 * or geometry to fix; either way it is a decision, not an accident.
 *
 * Seven, not the five map.js was designed with. The two duct roofs are the
 * reach rule's own discovery: 3.57m up with a jump or a vault from the lip,
 * and the deck edge 2.43m above where they cross into the hall's void. They
 * read as routes - lip, roof, edge - so they are declared as routes, and
 * whether the void edges should refuse anywhere but a lip is D25.
 */
export function placeRoutes(map) {
  const routeSpecs = [
    {
      id: 'hall-west', name: 'Turbine Hall, west: crates, container, gantry, lip',
      stages: [['stack-hall-low'], ['stack-hall-mid'], ['hall-container'], ['gantry-hall']], landing: DECK,
    },
    {
      id: 'hall-south', name: 'Turbine Hall, south: the low vent onto the maintenance platform',
      stages: [['vent-low-south-lip-from'], ['gantry-hall-south']], landing: DECK,
    },
    {
      id: 'hall-vent-north', name: 'Turbine Hall: the north duct, lip to roof to the void edge',
      stages: [['vent-low-north-lip-from'], ['vent-low-north-roof']], landing: DECK,
    },
    {
      id: 'hall-vent-south', name: 'Turbine Hall: the south duct, lip to roof to the void edge',
      stages: [['vent-low-south-lip-from'], ['vent-low-south-roof']], landing: DECK,
    },
    {
      id: 'bay', name: 'Loading Bay: crates to the gantry in the open void',
      stages: [['stack-bay-low'], ['stack-bay-mid'], ['gantry-bay']], landing: DECK,
    },
    {
      id: 'vault-hatch', name: 'Corridor: crates into the upper vent, up through the vault hatch',
      stages: [['stack-vault-low'], ['stack-vault-mid'], ['vent-up-vault-lip-from', 'vent-up-vault-floor']],
      landing: DECK,
    },
    {
      id: 'fire-escape', name: 'Exterior: the fire escape to the deck landing',
      stages: [['fire-escape-base'], ['fire-escape-0'], ['fire-escape-1']], landing: DECK,
    },
    {
      // The deck landing is walkable ground - the flood reaches it through
      // the shell - so the last two flights are a route of their own, first
      // step from the landing.
      id: 'fire-escape-roof', name: 'Exterior: the last two flights to the roof',
      stages: [['fire-escape-3'], ['fire-escape-4']], landing: ROOF,
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

/**
 * AI waypoints (Section 5: explicit bidirectional links, both floors, all
 * three sites). Every link is a straight line the Warden can walk — asserted,
 * because Phase 4 shipped a graph whose cross-floor links were not.
 */
export function placeWaypoints(map) {
  const waypointSpecs = [
    { x: -22.0, y: G, z: -15.0, tag: 'hall-north' },              // 0
    { x: -18.0, y: G, z: -4.0, tag: 'site-a' },                   // 1
    { x: -24.0, y: G, z: 5.0, tag: 'hall-south' },                // 2
    { x: -27.5, y: G, z: -21.1, tag: 'stair-hall-foot' },         // 3
    { x: -8.5, y: G, z: -4.0, tag: 'hall-door' },                 // 4
    { x: 0.0, y: G, z: -18.0, tag: 'corridor-n' },                // 5
    { x: 0.0, y: G, z: -4.0, tag: 'corridor-mid' },               // 6
    { x: 4.0, y: G, z: 4.0, tag: 'stair-corridor-foot' },         // 7
    { x: 12.0, y: G, z: -12.0, tag: 'bay-north' },                // 8
    { x: 18.0, y: G, z: -10.0, tag: 'site-b' },                   // 9
    { x: -17.0, y: DECK, z: -21.1, tag: 'stair-hall-head' },      // 10
    { x: -28.8, y: DECK, z: -21.1, tag: 'deck-nw' },              // 11
    { x: -28.8, y: DECK, z: 10.0, tag: 'deck-sw' },               // 12
    { x: -14.0, y: DECK, z: 12.0, tag: 'deck-south' },            // 13
    { x: 4.0, y: DECK, z: 16.5, tag: 'stair-corridor-head' },     // 14
    { x: 2.0, y: DECK, z: 0.0, tag: 'deck-mid' },                 // 15
    { x: 14.5, y: DECK, z: -21.0, tag: 'deck-office-door' },      // 16
    { x: 14.5, y: DECK, z: -13.0, tag: 'deck-office' },           // 17
    { x: 16.5, y: DECK, z: 4.0, tag: 'deck-vault-door' },         // 18
    { x: 18.0, y: DECK, z: 12.5, tag: 'site-c' },                 // 19
  ];
  for (let i = 0; i < waypointSpecs.length; i++) {
    const spec = waypointSpecs[i];
    map.addWaypoint(i, spec.x, spec.y, spec.z, spec.tag);
  }

  const links = [
    // Ground floor.
    [0, 1], [0, 3], [1, 2], [1, 4], [4, 6], [5, 6], [6, 7], [6, 8], [8, 9],
    // The only two ways between floors on foot.
    [3, 10], [7, 14],
    // Upper deck. 10 reaches the rest of the deck eastward along the north
    // strip; 11 is cut off from it by the stairwell and connects round the
    // west catwalk instead, which is what makes the deck a ring.
    [10, 16], [16, 17], [17, 18], [18, 19], [15, 18], [13, 15], [13, 14],
    [12, 13], [11, 12],
  ];
  for (const [a, b] of links) map.linkWaypoints(a, b);
}
