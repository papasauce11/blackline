/**
 * BLACKLINE — maps/yard.js
 *
 * "Container Yard", the registry's `yard` (Block D). D1 registered it as an
 * empty plane; D2 is the blockout: the geometry; D3 the Warden's walkway;
 * D4 the night, in yarddata.js. The placements that are data rather than
 * geometry - sites, spawns, the lights and their masts, waypoints, routes -
 * are `yarddata.js`, as the plant's are `plantdata.js`.
 *
 * Decided: D2 (outdoors, a shipping-container yard, similar size to the
 * first map; the Shade takes vertical advantage the Warden cannot close;
 * the Warden has a railed, glazed walkway reached by stairs, with small
 * apertures to shoot through). Provisional: D9 and D39 (night, yarddata.js),
 * D11 and D12 (the walkway, below), D35 (the shape built here).
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
 * THE WALKWAY (D3) is the Warden's overhead view: a glazed run 7.2m up
 * over the mid lane's north edge, between the bays, reached by one flight
 * of stairs up the west side of the gate lane, beside bay A's lane row
 * (the gatehouse has the east). It is where the Warden
 * cannot be reached and cannot easily shoot from. Its floor is above
 * `standing + jumpBonus` from every top within 4m (D12), so the climb rule
 * names no way up and nothing has to say so; a parapet a metre high and
 * glass from there to the roof close it, and the glass is solid to a body,
 * a shot and a knife and nothing to a line of sight, so the Warden sees the
 * whole yard through it and shoots only through THREE APERTURES (D11):
 * a slot in each end face, looking down the mid lane into the bays' open
 * corners - A from the west, B from the east - and one in the middle of
 * the south face over bay C's gap. Each is a hand's width (0.4m) and
 * reaches from the parapet down to just above the eye, so a Warden with
 * its muzzle in the slot can aim down into a bay and not much else; to
 * cover another bay it walks to another slot. The door is the stair's
 * mouth in the north face. `WALKWAY` states all of it; tests/walkway.js
 * holds it.
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

/**
 * The Warden's walkway (D3, D11, D12). A stair of `stair.steps` treads
 * rises to `floorY`; the run is a floor slab, a parapet `rail` high, glass
 * from there to `headroom`, a roof. Every pane and the parapet are `pane`
 * thick, inside the footprint. The apertures are slots `aperture.width`
 * wide from the parapet's top to `aperture.top` above the floor (the
 * Warden's eye is at 1.755), one per site: `face` is the pane it is cut
 * in, `at` its centre along that pane, `site` what it looks down into.
 * The door is the stair's mouth: the north pane stops at the stair's
 * sides and the glass above it starts at `door.height`.
 */
export const WALKWAY = {
  x0: -6.0, x1: 6.0, z0: -3.4, z1: -1.0,
  stair: { x0: -6.0, x1: -4.0, start: -13.0, steps: 24 },
  floorY: G + 24 * M.stairRise,
  slab: 0.2,
  rail: 1.0,
  headroom: 2.3,
  roof: 0.15,
  pane: 0.1,
  aperture: { width: 0.4, top: 1.95 },
  apertures: [
    { id: 'west', face: 'west', at: -2.2, site: 'A' },
    { id: 'east', face: 'east', at: -2.2, site: 'B' },
    { id: 'south', face: 'south', at: 0.0, site: 'C' },
  ],
  door: { height: 2.1 },
};

/** What this map promises to have built, asserted by validateMap() last. */
const EXPECTS = {
  lights: 5,
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
  // The Warden's walkway (D3): the stair up the gate lane's west side, the
  // glazed run over the mid lane's north edge. After every stack, because
  // its height is answerable to theirs (D12) and nothing else is.
  // -------------------------------------------------------------------------

  walkway(map);

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

/**
 * The walkway (D3). The stair first: `steps` treads from the lane beside
 * bay A's lane row to the floor's height, a rail on both sides the whole
 * flight - the west rail is not decoration: the flight passes the row's
 * top at 2.9m, and without it the Warden's ground stepped off the ninth
 * tread onto the row and from there along the whole container deck.
 * Then the run: the slab, the parapet on
 * every side but the stair's mouth, the glass above the parapet with a
 * slot cut for each aperture, the glass over the door, the roof.
 */
function walkway(map) {
  const K = WALKWAY;
  const floor = K.floorY;
  const stair = map.addStaircase({
    tag: 'stair-walkway', axis: 'z', start: K.stair.start, crossMin: K.stair.x0, crossMax: K.stair.x1,
    baseY: G, deckY: floor, steps: K.stair.steps,
  });
  // The rails: a box every four treads each side, from the lowest tread's
  // top in the group to a metre over the highest.
  const rise = M.stairRise;
  const run = M.stairRun;
  for (let g = 0; g < K.stair.steps / 4; g++) {
    const z0 = K.stair.start + g * 4 * run;
    const y0 = G + (g * 4 + 1) * rise;
    const y1 = G + (g * 4 + 4) * rise + K.rail;
    rail(map, `stair-walkway-rail-w${g}`, [K.stair.x0, y0, z0], [K.stair.x0 + K.pane, y1, z0 + 4 * run]);
    rail(map, `stair-walkway-rail-e${g}`, [K.stair.x1 - K.pane, y0, z0], [K.stair.x1, y1, z0 + 4 * run]);
  }

  // The run. The slab the stair's top tread meets; the roof over it.
  map.addSolid({
    min: [K.x0, floor - K.slab, K.z0], max: [K.x1, floor, K.z1],
    color: P.wardenGunmetal, tag: 'walkway-floor',
  });
  map.addSolid({
    min: [K.x0, floor + K.headroom, K.z0], max: [K.x1, floor + K.headroom + K.roof, K.z1],
    color: P.wardenGunmetal, tag: 'walkway-roof',
  });

  // The four faces, as spans along each pane: the north pane stops at the
  // stair's mouth, the door, and the glass above it starts at the door's
  // height. A face is the parapet, then glass to the roof with its slot
  // cut out: a pane either side of the slot up to the slot's top, and one
  // over it the whole span.
  const t = K.pane;
  const railTop = floor + K.rail;
  const glassTop = floor + K.headroom;
  const slotTop = floor + K.aperture.top;
  const faces = {
    west: { axis: 'z', fixed: [K.x0, K.x0 + t], span: [K.z0, K.z1] },
    east: { axis: 'z', fixed: [K.x1 - t, K.x1], span: [K.z0, K.z1] },
    north: { axis: 'x', fixed: [K.z0, K.z0 + t], span: [K.stair.x1, K.x1 - t] },
    south: { axis: 'x', fixed: [K.z1 - t, K.z1], span: [K.x0 + t, K.x1 - t] },
  };
  const box = (tag, face, a, b, y0, y1, glass) => {
    const f = faces[face];
    const min = f.axis === 'z' ? [f.fixed[0], y0, a] : [a, y0, f.fixed[0]];
    const max = f.axis === 'z' ? [f.fixed[1], y1, b] : [b, y1, f.fixed[1]];
    return glass ? pane(map, tag, min, max) : rail(map, tag, min, max);
  };
  for (const [name, f] of Object.entries(faces)) {
    const [a, b] = f.span;
    box(`walkway-rail-${name}`, name, a, b, floor, railTop, false);
    const slot = K.apertures.find((ap) => ap.face === name);
    if (!slot) {
      box(`walkway-glass-${name}`, name, a, b, railTop, glassTop, true);
      continue;
    }
    const s0 = slot.at - K.aperture.width / 2;
    const s1 = slot.at + K.aperture.width / 2;
    box(`walkway-glass-${name}-0`, name, a, s0, railTop, slotTop, true);
    box(`walkway-glass-${name}-1`, name, s1, b, railTop, slotTop, true);
    box(`walkway-glass-${name}-over`, name, a, b, slotTop, glassTop, true);
  }
  // Over the door: glass from the door's head to the roof, the stair's width.
  pane(map, 'walkway-glass-door-over', [K.stair.x0, floor + K.door.height, K.z0], [K.stair.x1, glassTop, K.z0 + t]);
  return stair;
}

/** A parapet or a handrail: thinner than a body, so nothing to stand on and nothing to climb. */
function rail(map, tag, min, max) {
  return map.addSolid({ min, max, color: P.concreteDark, tag, castShadow: false });
}

/** A pane of the walkway's glazing: solid, see-through (`addSolid`'s `glass`). */
function pane(map, tag, min, max) {
  return map.addSolid({ min, max, glass: true, tag });
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
