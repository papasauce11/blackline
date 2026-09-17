/**
 * BLACKLINE — maps/yard.js
 *
 * "Container Yard", the registry's `yard` (Block D). D1 registered it as an
 * empty plane; D2 is the blockout: the geometry. The placements that are
 * data rather than geometry - sites, spawns, lights, waypoints, routes -
 * are `yarddata.js`, as the plant's are `plantdata.js`.
 *
 * Decided: D2 (outdoors, a shipping-container yard, similar size to the
 * first map; the Shade takes vertical advantage the Warden cannot close;
 * the Warden's glazed walkway is D3's). Provisional: D9 (night, D4's),
 * D11, D12 (D3's), D35 (the shape built here).
 *
 * The shape. One ground plane, the site fence round the whole 80 x 65 as
 * the plant has it, and inside that a WORKING YARD of 60 x 42 walled by a
 * ring of one-high containers laid end to end - the yard's shell, the way
 * the plant's building is. Two gates break the ring, north and south, and
 * a container laid across the top of each gate makes it an arch: the
 * Warden walks under, the Shade walks over, and the ring's tops stay one
 * surface. Inside, three bays walled by more rows: A and B either side of
 * the lane from the north gate, C across the south, with a storage block
 * of stacks either side of it. Every row touches the ring or another row,
 * so the tops of the one-high containers are ONE CONNECTED DECK (v2
 * requirement 2, re-read for outdoors; `the-container-tops-are-one-
 * connected-deck`, tests/yard.js, holds it): the Shade climbs the ring
 * anywhere and runs the tops of every wall in the yard; the Warden walks
 * the lanes below and can never follow.
 *
 * The container is a high cube, 2.9m (D35): above `shade.reach.standing`
 * (2.6), so one high is a jump and a grab - never walked up - and two high
 * is 5.8, past `standing + jumpBonus` (3.8), so it needs the one below as a
 * stage. The stairless routes up (requirement 4) are stacks: pallets to a
 * row top to a second tier to a third, every stage a container's height,
 * declared in yarddata.js and held by tests/routes.js. The pallets are
 * where a route starts on foot: 1.0m, a vault from the ground and a 1.9m
 * mantle onto the row beside them.
 *
 * What the checks need at ground level, and where it is: a vault-band box
 * with a straight run (the loose pallets in the mid lane), a mantle-band
 * box (the skip, the trailer bed), a hangable face (any row), a face too
 * tall to climb (the site fence), a box with one open face to lid (the
 * pallets in the slot beside the gatehouse), a climbable top inside a site
 * room the Warden can defuse beside (the skip, the trailer) and one it
 * cannot (every wall top), and an enclosed interior in a site room (the
 * crawl space under the trailer bed: a crouched Shade fits, a standing
 * Warden's headroom does not, D20).
 *
 * Coordinates: x east, z south. The site spans X -40..40, Z -32.5..32.5;
 * the working yard X -30..30, Z -21..21, its ring 2.4m thick inside that.
 * Every lane the Warden is meant to walk is at least 1.8m wide; every gap
 * the Warden is not meant to walk is zero - containers touch.
 *
 * Layering (Section 3.1): as plant.js - mapkit, physics, config.
 */

import { CONFIG } from '../config.js';
import { GameMap } from '../mapkit.js';
import { CONTAINER, TIERS, placeSites, placeSpawns, placeLights, placeWaypoints, placeRoutes } from './yarddata.js';
import { validateMap } from '../mapvalidate.js';
import { lightRoutes } from '../maproutelight.js';

const M = CONFIG.map;
const P = CONFIG.palette;

/** The site: the same 80 x 65 as the plant's, "similar size" (D2). */
const SITE_W = M.siteWidth / 2;
const SITE_D = M.siteDepth / 2;
const G = M.groundY;
const SLAB = M.floorThickness;
const WALL = M.wallThickness;
/** Perimeter fence: thin, so it is nowhere to stand; above the hang band, so it is nothing to grab. */
const FENCE_HEIGHT = 4.5;

/** The working yard: the ring of containers sits just inside this. */
export const YARD = { x0: -30.0, x1: 30.0, z0: -21.0, z1: 21.0 };
/** The container's size is `CONTAINER` (yarddata.js), where the routes read the tier heights from it. */
const CH = CONTAINER.height;
const CW = CONTAINER.width;
/** A bay is open to the sky; this is how high its room reaches for containment. */
const BAY_CEILING = 8.0;
/** Pallets: a stack the height of a crate, a vault from the ground and a step to a row. */
const PALLET = { size: 1.5, height: 1.0 };
/** The flatbed trailer: a bed a crouched body fits under and a standing one does not. */
export const TRAILER = { bedBottom: 1.2, bedTop: 1.5, width: 2.4, length: 8.0 };
/** The gatehouse beside the north gate: a hut lower than a container, a standing mantle from the lane. */
const GATEHOUSE_HEIGHT = 2.4;

/** The gates in the ring, and the arch laid across each. */
const GATE = { halfWidth: 3.6, archLength: 12.0 };

/** What this map promises to have built, asserted by validateMap() last. */
const EXPECTS = {
  lights: 4,
  waypoints: 21,
  shadeSpawns: 4,
  wardenSpawns: 4,
  sites: 3,
  rooms: 3,
  routes: 9,
};

/** The three bays: rooms, each bounded by the outer faces of its walls. */
export const BAYS = {
  a: { id: 'bay-a', name: 'Bay A', min: [-27.6, -18.6], max: [-6.2, -2.0] },
  b: { id: 'bay-b', name: 'Bay B', min: [6.2, -18.6], max: [27.6, -2.0] },
  c: { id: 'bay-c', name: 'Bay C', min: [-12.0, 4.2], max: [12.0, 18.6] },
};

// ---------------------------------------------------------------------------
// buildYardMap
// ---------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Ground and the site fence, as the plant has them.
  // -------------------------------------------------------------------------

  map.addSolid({
    min: [-SITE_W, G - SLAB, -SITE_D],
    max: [SITE_W, G, SITE_D],
    color: P.concreteDark,
    tag: 'ground-plane',
    castShadow: false,
  });
  const fence = [
    { min: [-SITE_W - WALL, G, -SITE_D - WALL], max: [SITE_W + WALL, G + FENCE_HEIGHT, -SITE_D] },
    { min: [-SITE_W - WALL, G, SITE_D], max: [SITE_W + WALL, G + FENCE_HEIGHT, SITE_D + WALL] },
    { min: [-SITE_W - WALL, G, -SITE_D], max: [-SITE_W, G + FENCE_HEIGHT, SITE_D] },
    { min: [SITE_W, G, -SITE_D], max: [SITE_W + WALL, G + FENCE_HEIGHT, SITE_D] },
  ];
  for (const spec of fence) {
    map.addSolid({ ...spec, color: P.concreteDark, tag: 'site-fence', castShadow: false });
  }

  // -------------------------------------------------------------------------
  // The ring: the working yard's shell, one high, a gate north and south
  // with a container laid across each as an arch.
  // -------------------------------------------------------------------------

  const inner = { x0: YARD.x0 + CW, x1: YARD.x1 - CW, z0: YARD.z0 + CW, z1: YARD.z1 - CW };
  // West and east rows run the full depth; north and south rows sit between
  // them, so the corners are one box deep and every row touches the next.
  for (const [side, x] of [['west', YARD.x0], ['east', inner.x1]]) {
    let z = YARD.z0;
    for (const [i, length] of [12, 12, 12, 6].entries()) {
      container(map, `ring-${side}-${i}`, x, z, 'z', length, 0);
      z += length;
    }
  }
  for (const [side, z] of [['north', YARD.z0], ['south', inner.z1]]) {
    // Two 40ft boxes from each corner to the gate post, either side.
    container(map, `ring-${side}-w0`, inner.x0, z, 'x', 12, 0);
    container(map, `ring-${side}-w1`, inner.x0 + 12, z, 'x', 12, 0);
    container(map, `ring-${side}-e1`, GATE.halfWidth, z, 'x', 12, 0);
    container(map, `ring-${side}-e0`, GATE.halfWidth + 12, z, 'x', 12, 0);
    // The arch: a 40ft box across the gate on top of the posts, 2.4m of
    // bearing at each end. Climbed from the ring's top either side; walked
    // under by the Warden at a container's headroom.
    container(map, `arch-${side}`, -GATE.archLength / 2, z, 'x', GATE.archLength, 1);
  }

  // -------------------------------------------------------------------------
  // Bays A and B, either side of the lane from the north gate. Each is walled
  // by the ring on two sides, a row on its south and a row on its lane side,
  // and open at the corner where the two rows do not meet: that corner is
  // the Warden's way in, an L of 9.4m and 4.6m.
  // -------------------------------------------------------------------------

  for (const [key, sign] of [['a', -1], ['b', 1]]) {
    const bay = BAYS[key];
    // The south row, from the ring to 12m in.
    const southX = sign < 0 ? bay.min[0] : bay.max[0] - 12;
    container(map, `bay-${key}-south`, southX, bay.max[1] - CW, 'x', 12, 0);
    // The lane row, from the ring's north row 12m south, leaving the corner.
    const laneX = sign < 0 ? bay.max[0] - CW : bay.min[0];
    container(map, `bay-${key}-lane`, laneX, bay.min[1], 'z', 12, 0);
    // The stack in the bay: two 20ft side by side against the ring's north
    // row, a second tier on the northern one. Climbed from the southern
    // one's top, or from the ring's.
    const stackX = sign < 0 ? -24 : 18;
    container(map, `bay-${key}-stack-n`, stackX, bay.min[1], 'x', 6, 0);
    container(map, `bay-${key}-stack-s`, stackX, bay.min[1] + CW, 'x', 6, 0);
    container(map, `bay-${key}-stack-t2`, stackX, bay.min[1], 'x', 6, 1);
    // Pallets against the southern box: the route's first step on foot.
    pallets(map, `pallets-${key}`, stackX + 2.25, bay.min[1] + 2 * CW);
  }

  // Bay A's skip, against the lane row: a mantle from the ground, a top the
  // Warden can defuse beside.
  map.addSolid({
    min: [-12.0, G, -13.0],
    max: [BAYS.a.max[0] - CW, G + 1.6, -11.0],
    color: P.wardenGunmetal,
    outline: true,
    tag: 'skip',
  });

  // Bay B's flatbed trailer, along the ring's east row with a lane between:
  // a bed the plant rule reads as a top (1.5m, the Warden reaches it from
  // the ground beside) over a crawl space it reads as inside something.
  trailer(map, 'trailer', 23.2, -15.0);

  // The gatehouse: a hut in the lane beside the north gate, against bay B's
  // lane row. It stops 1.6m short of the ring, and the slot that leaves,
  // closed on three sides, holds a pallet stack with one open face. The
  // ring's top there is under the arch, so the slot is not the way onto
  // it: that is the pallets in bay B, east of the arch's end.
  map.addSolid({
    min: [2.2, G, -17.0],
    max: [BAYS.b.min[0], G + GATEHOUSE_HEIGHT, -13.0],
    color: P.concrete,
    tag: 'gatehouse',
  });
  pallets(map, 'pallets-gatehouse', BAYS.b.min[0] - 0.05 - PALLET.size, inner.z0 + 0.05);
  pallets(map, 'pallets-north', 10.0, inner.z0 + 0.05);

  // -------------------------------------------------------------------------
  // Bay C, across the south: a row along its north with the lane's gap in
  // the middle, a row down each side to the ring. The rear gate opens into
  // it from the apron. The third tier rides its west wall: a 20ft on the
  // wall's south half, a 10ft on that, each climbed from the top before it.
  // -------------------------------------------------------------------------

  const c = BAYS.c;
  container(map, 'bay-c-north-w0', c.min[0], c.min[1], 'x', 6, 0);
  container(map, 'bay-c-north-w1', c.min[0] + 6, c.min[1], 'x', 3, 0);
  container(map, 'bay-c-north-e1', c.max[0] - 9, c.min[1], 'x', 3, 0);
  container(map, 'bay-c-north-e0', c.max[0] - 6, c.min[1], 'x', 6, 0);
  container(map, 'bay-c-west', c.min[0], c.min[1] + CW, 'z', 12, 0);
  container(map, 'bay-c-east', c.max[0] - CW, c.min[1] + CW, 'z', 12, 0);
  container(map, 'bay-c-t2', c.min[0], c.max[1] - 6, 'z', 6, 1);
  container(map, 'bay-c-t3', c.min[0], c.max[1] - 3, 'z', 3, 2);
  // Pallets against the wall's inner face, clear of the spot the rule
  // samples a quarter of the way along it, so the wall stays a climb from
  // the ground as well as the route's second stage.
  pallets(map, 'pallets-c', c.min[0] + CW + 0.05, 10.0);
  // And pallets against the ring's south row just west of the arch's end,
  // inside the bay: the way onto the rear arch (under the arch itself the
  // ring's top is roofed, and the rule names no climb there).
  pallets(map, 'pallets-rear', -GATE.archLength / 2 - 0.1 - PALLET.size, c.max[1] - 0.05 - PALLET.size);

  // -------------------------------------------------------------------------
  // The storage blocks either side of bay C. West: a three-high stack along
  // bay C's wall, a two-high against the ring's corner, a loose one-high.
  // East: a two-high against the corner, a one-high with a 10ft on it.
  // -------------------------------------------------------------------------

  // West. The 40ft base touches bay C's west wall; the tiers sit at that
  // end and step in, so each is climbed from the top of the one below and
  // the pallets at the west end have the base's top clear above them.
  container(map, 'store-w-t1', -24.0, 8.0, 'x', 12, 0);
  container(map, 'store-w-t2', -18.0, 8.0, 'x', 6, 1);
  container(map, 'store-w-t3', -15.0, 8.0, 'x', 3, 2);
  pallets(map, 'pallets-store-w', -24.0 - 0.05 - PALLET.size, 8.5);
  container(map, 'store-w-corner-n', inner.x0, 13.8, 'x', 6, 0);
  container(map, 'store-w-corner-s', inner.x0, inner.z1 - CW, 'x', 6, 0);
  container(map, 'store-w-corner-t2', inner.x0, inner.z1 - CW, 'x', 6, 1);
  pallets(map, 'pallets-store-w-corner', inner.x0 + 6 + 0.05, 14.3);
  container(map, 'store-w-loose', -18.0, 14.0, 'x', 6, 0);

  // East.
  container(map, 'store-e-corner-n', inner.x1 - 6, 13.8, 'x', 6, 0);
  container(map, 'store-e-corner-s', inner.x1 - 6, inner.z1 - CW, 'x', 6, 0);
  container(map, 'store-e-corner-t2', inner.x1 - 6, inner.z1 - CW, 'x', 6, 1);
  pallets(map, 'pallets-store-e-corner', inner.x1 - 6 - 0.05 - PALLET.size, 14.3);
  container(map, 'store-e-t1', c.max[0], 8.0, 'x', 6, 0);
  container(map, 'store-e-t2', c.max[0] + 3, 8.0, 'x', 3, 1);
  pallets(map, 'pallets-store-e', 13.0, 8.0 + CW + 0.05);

  // Loose pallets in the open, in the mid lane: a vault with a run at it.
  pallets(map, 'pallets-loose', 13.25, 2.0);

  // -------------------------------------------------------------------------
  // Rooms (Section 5 readability). Entries are derived, never declared: the
  // bays are open to the sky, so the ceiling is one and the gaps in the rows
  // the rest.
  // -------------------------------------------------------------------------

  for (const bay of Object.values(BAYS)) {
    map.addRoom({ ...bay, floorY: G, ceilingY: G + BAY_CEILING });
  }

  // -------------------------------------------------------------------------
  // Sites, spawns, lights, waypoints, routes (yarddata.js) - after the rooms,
  // because a site finds its room by containment.
  // -------------------------------------------------------------------------

  placeSites(map);
  placeSpawns(map);
  placeLights(map);
  placeWaypoints(map);
  placeRoutes(map);

  map.collision.build();
  map.deriveClimbableSurfaces();
  lightRoutes(map);
  map.deriveRoomEntries();
  map.deriveWardenGround();
  validateMap(map, EXPECTS);

  return map;
}

// ---------------------------------------------------------------------------
// Small local builders. A container is stated by its corner, its axis, its
// length and its tier, so a stack reads as a stack in the source.
// ---------------------------------------------------------------------------

/**
 * A shipping container: `length` along `along`, a container wide across,
 * a container tall, its floor at `tier` containers up. Tier colours step
 * so a stack reads by height in the blockout: the rows dark, so the orange
 * pallets a route starts on read against them (B7's check measures it).
 */
function container(map, tag, x, z, along, length, tier) {
  const dx = along === 'x' ? length : CW;
  const dz = along === 'x' ? CW : length;
  const y0 = G + tier * CH;
  return map.addSolid({
    min: [x, y0, z],
    max: [x + dx, y0 + CH, z + dz],
    color: [P.wardenGunmetal, P.concrete, P.hazardOrange][tier],
    outline: tier > 0,
    tag,
  });
}

/** A pallet stack: a crate's height, a body and a half square. */
function pallets(map, tag, x, z) {
  return map.addSolid({
    min: [x, G, z],
    max: [x + PALLET.size, G + PALLET.height, z + PALLET.size],
    color: P.hazardOrange,
    outline: true,
    tag,
  });
}

/**
 * A flatbed trailer along z: the bed, and four wheels under its sides.
 * The wheels are narrower than a body, so they are nothing to stand on;
 * the space between them under the bed is the crawl space.
 */
function trailer(map, tag, x, z) {
  const T = TRAILER;
  const bed = map.addSolid({
    min: [x, G + T.bedBottom, z],
    max: [x + T.width, G + T.bedTop, z + T.length],
    color: P.wardenGunmetal,
    outline: true,
    tag,
  });
  const wheel = 0.3;
  for (const [i, along] of [1.0, T.length - 1.9].entries()) {
    for (const [j, side] of [0, T.width - wheel].entries()) {
      map.addSolid({
        min: [x + side, G, z + along],
        max: [x + side + wheel, G + 0.9, z + along + 0.9],
        color: P.hazardStripe,
        tag: `${tag}-wheel-${i}${j}`,
        castShadow: false,
      });
    }
  }
  return bed;
}
