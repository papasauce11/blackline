/**
 * BLACKLINE — maps/plant.js
 *
 * "Meridian Substation", v2 - the map the registry (`maps/index.js`) knows
 * as `plant` (D1). The level: geometry, collision volumes, spawns, plant
 * sites, lights and AI waypoints. The machinery that builds it lives in
 * `mapkit.js`; this file is the layout. The placements that are data rather
 * than geometry - sites, spawns, lights, waypoints - are `plantdata.js`,
 * and the build-time asserts are `mapvalidate.js` (F3), handed the counts
 * this map promises. Was `src/map.js` until D1 put every map under `maps/`.
 *
 * Layering (Section 3.1): may import from mapkit, physics and config.
 *
 * The central rule (Section 5): every visual is generated from the same data
 * the collision solver reads. `addSolid()` creates the mesh and the
 * CollisionBox together, climbability is derived from the geometry rather than
 * typed on, and the affordance markings are emitted in one pass using
 * `classifyReach()` — the same function the Shade controller calls. Nothing
 * cannot disagree with what the controller will let you climb, because neither
 * is authored by hand.
 *
 * What v2 changes, and why (see PROGRESS.md):
 *
 *  1. Level 1 is 6m tall instead of 4m, and level 2 has 5m of headroom.
 *  2. Level 2 is ONE continuous deck. It is laid as a single plate and holes
 *     are subtracted from it, so it cannot quietly become fragments again.
 *  3. The Shade starts outside. The building is a shell to infiltrate, with a
 *     10m approach apron on every face.
 *  4. Five ways up that are not the Warden's staircases.
 *  5. No room has one door.
 *
 * Coordinates: the site spans X -40..40 and Z -32.5..32.5. The building's
 * interior is X -30..30, Z -22.5..22.5, with its shell walls outside that.
 */

import { CONFIG } from '../config.js';
import { GameMap } from '../mapkit.js';
import { placeSites, placeSpawns, placeLights, placeWaypoints, placeRoutes } from './plantdata.js';
import { validateMap } from '../mapvalidate.js';
import { lightRoutes } from '../maproutelight.js';

const M = CONFIG.map;
const P = CONFIG.palette;

// Building interior.
const HALF_W = M.width / 2;
const HALF_D = M.depth / 2;
// Exterior site.
const SITE_W = M.siteWidth / 2;
const SITE_D = M.siteDepth / 2;

const G = M.groundY;
const DECK = M.catwalkY;
const CEIL = M.ceilingY;
const WALL = M.wallThickness;
const SLAB = M.floorThickness;
/** Top of the roof slab, which is what you stand on up there. */
const ROOF = CEIL + WALL;

const V1 = M.ventFloorY;
const V2 = M.ventUpperY;
const GANTRY = M.gantryY;

// Interior block edges. The corridor ring is the negative space between the
// Turbine Hall, the Loading Bay and the shell.
const HALL_EAST = -6.0;
const HALL_SOUTH = 8.0;
const BAY_WEST = 6.0;
const BAY_SOUTH = 2.0;

// Upper-deck rooms.
const VAULT = { x0: 10.0, x1: 26.0, z0: 6.0, z1: 19.0 };
/** A server rack's width, and the aisle between two of them (see the racks). */
const RACK_W = 1.1;
const RACK_AISLE = 1.5;
const OFFICE = { x0: 10.0, x1: 26.0, z0: -20.0, z1: -6.0, divider: 18.0 };

// The void that keeps the Turbine Hall open to the roof, inset from the hall
// walls so a catwalk band survives on all four sides.
const HALL_VOID = { x0: -27.6, x1: -8.6, z0: -20.0, z1: 5.6 };

// A doorway or window, in the (along-wall, vertical) space addWall() wants.
const opening = (from, to, y0, y1) => ({ from, to, y0, y1 });
/** Standard walk-through door on a floor at `base`. */
const doorway = (from, to, base) => opening(from, to, base, base + 2.4);
/** Window: a crouch-height slot the Shade fits through and the Warden does not. */
const window_ = (from, to, base) => opening(from, to, base + 0.4, base + 1.6);

/** What this map promises to have built, asserted by validateMap() last. */
const EXPECTS = {
  lights: M.destructibleLightCount,
  waypoints: M.waypointCount,
  shadeSpawns: M.shadeSpawnCount,
  wardenSpawns: M.wardenSpawnCount,
  sites: M.plantSiteCount,
  rooms: M.roomCount,
  routes: M.stairlessRouteMin,
};

// ---------------------------------------------------------------------------
// buildPlantMap
// ---------------------------------------------------------------------------

/**
 * @param {object} options
 * @param {string} options.id the registry's id for this map (`plant`)
 * @param {string} options.name what the menu and the briefing call it
 * @param {THREE.DataTexture} options.gradientMap 4-step toon ramp from main.js
 * @returns {GameMap}
 */
export function buildPlantMap({ id, name, gradientMap }) {
  const map = new GameMap(gradientMap, id, name);
  map.shell = { x0: -HALF_W - WALL, x1: HALF_W + WALL, z0: -HALF_D - WALL, z1: HALF_D + WALL };

  // -------------------------------------------------------------------------
  // Ground. One plane covering the whole site: the building's floor and the
  // approach apron are the same surface, so there is no seam to fall through.
  // -------------------------------------------------------------------------

  map.addSolid({
    min: [-SITE_W, G - SLAB, -SITE_D],
    max: [SITE_W, G, SITE_D],
    color: P.concreteDark,
    tag: 'ground-plane',
    castShadow: false,
  });

  // Compound fence. The play space has to be closed now that the Shade starts
  // outside it — without this the apron is an open edge to walk off. Thin, so
  // the climbability pass correctly refuses it as somewhere to stand, and tall
  // enough to sit above the hang band so it cannot be grabbed either.
  const FENCE_HEIGHT = 4.5;
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
  // Vent runs. Declared before any wall, because every wall they cross is
  // generated around them (Section 5, and the Phase 3 bug that motivated it).
  // -------------------------------------------------------------------------

  // Tier one, 2.3m: hall to corridor. Climbed into from the floor at either
  // mouth, and roofed, because at this height the deck above is too far away
  // to stop the Shade standing up.
  const ventLowNorth = map.addVentRun({
    tag: 'vent-low-north', axis: 'x', from: -13.0, to: -1.0, cross: -16.0, floorY: V1, lipAt: 'both',
  });
  const ventLowSouth = map.addVentRun({
    tag: 'vent-low-south', axis: 'x', from: -13.0, to: -1.0, cross: 4.0, floorY: V1, lipAt: 'both',
  });

  // Tier two, 4.3m: the corridor up into the Server Vault's floor. No roof —
  // the deck 1.35m above it already makes the run crouch-only, and a redundant
  // roof slab is wide enough to be read as the standing surface the next ledge
  // is measured from, which would put the vault lip in the wrong band.
  const ventUpVault = map.addVentRun({
    tag: 'vent-up-vault', axis: 'z', from: 5.0, to: 11.0, cross: 14.0, floorY: V2,
    roof: false, lipAt: 'from',
  });

  // At grade, through the shell: the two quietest ways in.
  const ventGradeWest = map.addVentRun({
    tag: 'vent-grade-west', axis: 'x', from: -37.0, to: -25.0, cross: -3.0, floorY: G, floor: false,
  });
  const ventGradeSouth = map.addVentRun({
    tag: 'vent-grade-south', axis: 'z', from: 17.0, to: 29.0, cross: 2.0, floorY: G, floor: false,
  });

  // -------------------------------------------------------------------------
  // Shell. Breached in five places: two roller doors, two vent mouths at
  // grade, and the fire escape's opening onto the upper deck.
  // -------------------------------------------------------------------------

  const ROLLER_DOOR_HEIGHT = 3.4;
  const rollerDoors = [
    { from: -20.0, to: -16.0 },
    { from: -8.0, to: -4.0 },
  ];
  // Where the fire escape lets you step in. The landing is flush with the deck
  // rather than a step above it: an offset landing is measured against the deck
  // as its support, which collapses a 2.0m mantle to a 0.3m nothing and takes
  // the platform out of every traversal band.
  const FIRE_ESCAPE = { x0: 8.4, x1: 10.6, landing: DECK };

  map.addWall({
    tag: 'shell-west', axis: 'x', at: -HALF_W - WALL, thickness: WALL,
    from: -HALF_D, to: HALF_D, y0: G, y1: CEIL,
    openings: [map.ventOpening(ventGradeWest)],
  });
  map.addWall({
    tag: 'shell-east', axis: 'x', at: HALF_W, thickness: WALL,
    from: -HALF_D, to: HALF_D, y0: G, y1: CEIL,
    openings: rollerDoors.map((door) => opening(door.from, door.to, G, G + ROLLER_DOOR_HEIGHT)),
  });
  map.addWall({
    tag: 'shell-north', axis: 'z', at: -HALF_D - WALL, thickness: WALL,
    from: -HALF_W - WALL, to: HALF_W + WALL, y0: G, y1: CEIL,
    openings: [opening(FIRE_ESCAPE.x0, FIRE_ESCAPE.x1, FIRE_ESCAPE.landing, FIRE_ESCAPE.landing + 2.4)],
  });
  map.addWall({
    tag: 'shell-south', axis: 'z', at: HALF_D, thickness: WALL,
    from: -HALF_W - WALL, to: HALF_W + WALL, y0: G, y1: CEIL,
    openings: [map.ventOpening(ventGradeSouth)],
  });

  // Roller shutters, rolled up: the visual that says the opening below is a
  // door rather than a hole in the wall.
  for (const door of rollerDoors) {
    map.addSolid({
      min: [HALF_W, G + ROLLER_DOOR_HEIGHT, door.from],
      max: [HALF_W + WALL, G + ROLLER_DOOR_HEIGHT + 0.6, door.to],
      color: P.hazardOrange,
      tag: 'roller-door',
      castShadow: false,
    });
  }

  // -------------------------------------------------------------------------
  // Ground-floor partitions. These stop at the deck: above 6m, level 2 is one
  // open mezzanine and only its rooms have walls.
  // -------------------------------------------------------------------------

  map.addWall({
    tag: 'hall-east-wall', axis: 'x', at: HALL_EAST, thickness: WALL,
    from: -HALF_D, to: HALL_SOUTH + WALL, y0: G, y1: DECK,
    openings: [
      doorway(-6.0, -2.0, G),
      map.ventOpening(ventLowNorth),
      map.ventOpening(ventLowSouth),
    ],
  });
  map.addWall({
    tag: 'hall-south-wall', axis: 'z', at: HALL_SOUTH, thickness: WALL,
    from: -HALF_W, to: HALL_EAST + WALL, y0: G, y1: DECK,
    openings: [doorway(-20.0, -16.0, G)],
  });
  map.addWall({
    tag: 'bay-west-wall', axis: 'x', at: BAY_WEST, thickness: WALL,
    from: -HALF_D, to: BAY_SOUTH + WALL, y0: G, y1: DECK,
    openings: [doorway(-10.0, -6.0, G), doorway(-3.0, 1.0, G)],
  });
  map.addWall({
    tag: 'bay-south-wall', axis: 'z', at: BAY_SOUTH, thickness: WALL,
    from: BAY_WEST, to: HALF_W, y0: G, y1: DECK,
    openings: [doorway(24.0, 28.0, G)],
  });

  // -------------------------------------------------------------------------
  // Staircases (Section 6.2: the Warden walks, so the level must let it)
  // -------------------------------------------------------------------------

  const stairHall = map.addStaircase({
    tag: 'stair-hall', axis: 'x', start: -26.0, crossMin: -22.1, crossMax: -20.1, baseY: G, deckY: DECK,
  });
  const stairCorridor = map.addStaircase({
    tag: 'stair-corridor', axis: 'z', start: 6.0, crossMin: 3.0, crossMax: 5.0, baseY: G, deckY: DECK,
  });

  // -------------------------------------------------------------------------
  // The upper deck: one plate, minus voids
  // -------------------------------------------------------------------------

  // One-way down (Section 5): the drop shaft, and the opening that keeps the
  // Turbine Hall a full-height space. Neither carries a lip.
  const dropShaft = { x0: 21.6, x1: 25.4, z0: -18.2, z1: -14.8 };
  // Two-way: each of these has a climbing route arriving at the lip beside it.
  // The bay void is the width of its gantry plus a body: the gantry stands in
  // the open under it (B4, below) and the lip is the void's far edge. Its
  // north edge stops 1.2m short of the office wall, whose face is at
  // z=-5.6: a void flush with the wall leaves the deck between them zero
  // metres wide, and the rule still counts that slab climbable from the
  // gantry - its top is standable somewhere along its 38m - while the
  // controller, rightly, will not mantle into a wall. Ledge and landing have
  // to agree, and here the geometry makes them.
  const bayVoid = { x0: 17.4, x1: 21.4, z0: -4.4, z1: -1.4 };
  const vaultHatch = { x0: 13.0, x1: 15.0, z0: 9.2, z1: 11.2 };

  const deckLips = [
    { x0: -8.6, x1: -7.4, z0: -12.0, z1: -9.0, tag: 'lip-hall-east' },
    { x0: -16.5, x1: -13.2, z0: 5.6, z1: 6.8, tag: 'lip-hall-south' },
    { x0: 21.4, x1: 22.6, z0: -4.4, z1: -1.4, tag: 'lip-bay' },
    { x0: 15.0, x1: 16.2, z0: 9.2, z1: 11.2, tag: 'lip-vault' },
  ];

  map.addFloorPlate({
    tag: 'deck',
    min: [-HALF_W, -HALF_D],
    max: [HALF_W, HALF_D],
    top: DECK,
    thickness: SLAB,
    color: P.concreteDark,
    lipColor: P.wardenGunmetal,
    voids: [HALL_VOID, stairHall.stairwell, stairCorridor.stairwell, dropShaft, bayVoid, vaultHatch],
    lips: deckLips,
  });

  // Hazard-striped lip bars around the one-way drop, so it reads as a
  // deliberate opening rather than a missing floor.
  for (const bar of edgeBars(dropShaft, DECK)) {
    map.addSolid({ ...bar, color: P.hazardOrange, tag: 'drop-shaft-lip', castShadow: false });
  }

  // -------------------------------------------------------------------------
  // Upper-deck rooms
  // -------------------------------------------------------------------------

  // Server Vault (site C). Tight, dark, longest approach. Entered by the north
  // door, the hatch its floor shares with the upper vent, or the east window.
  map.addWall({
    tag: 'vault-wall-w', axis: 'x', at: VAULT.x0 - WALL, thickness: WALL,
    from: VAULT.z0 - WALL, to: VAULT.z1 + WALL, y0: DECK, y1: CEIL,
  });
  map.addWall({
    tag: 'vault-wall-e', axis: 'x', at: VAULT.x1, thickness: WALL,
    from: VAULT.z0 - WALL, to: VAULT.z1 + WALL, y0: DECK, y1: CEIL,
    openings: [window_(12.0, 14.0, DECK)],
  });
  map.addWall({
    tag: 'vault-wall-n', axis: 'z', at: VAULT.z0 - WALL, thickness: WALL,
    from: VAULT.x0 - WALL, to: VAULT.x1 + WALL, y0: DECK, y1: CEIL,
    openings: [doorway(15.0, 18.0, DECK)],
  });
  map.addWall({
    tag: 'vault-wall-s', axis: 'z', at: VAULT.z1, thickness: WALL,
    from: VAULT.x0 - WALL, to: VAULT.x1 + WALL, y0: DECK, y1: CEIL,
  });

  // Two pairs of racks. The aisle inside each pair is a Warden's width and
  // then some (B4): the Shade is 0.68m across and the Warden 0.84m on a 0.5m
  // ground grid, so an aisle between the two - they were 0.7m and 1.1m - is a
  // slot the Shade can stand in that no Warden ground cell ever reaches, and
  // the plant rule refuses every spot deeper in it than the defuse reach. A5
  // counted one such floor cell; a fine scan found 150. Cover on both sides
  // of an aisle the Warden can walk is what the racks were for.
  for (let i = 0; i < 4; i++) {
    const x = 10.6 + (i < 2 ? i * (RACK_W + RACK_AISLE) : 8.8 + (i - 2) * (RACK_W + RACK_AISLE));
    map.addSolid({
      min: [x, DECK, 14.5],
      max: [x + RACK_W, DECK + 1.9, 18.5],
      color: P.wardenGunmetal,
      outline: true,
      tag: `server-rack-${i}`,
    });
  }

  // Two office rooms. Each has a door onto the deck, a window the Warden
  // cannot fit through, and a way into its neighbour.
  map.addWall({
    tag: 'office-wall-w', axis: 'x', at: OFFICE.x0 - WALL, thickness: WALL,
    from: OFFICE.z0 - WALL, to: OFFICE.z1 + WALL, y0: DECK, y1: CEIL,
    openings: [window_(-16.0, -14.0, DECK)],
  });
  map.addWall({
    tag: 'office-wall-e', axis: 'x', at: OFFICE.x1, thickness: WALL,
    from: OFFICE.z0 - WALL, to: OFFICE.z1 + WALL, y0: DECK, y1: CEIL,
    openings: [window_(-14.0, -12.0, DECK)],
  });
  map.addWall({
    tag: 'office-wall-n', axis: 'z', at: OFFICE.z0 - WALL, thickness: WALL,
    from: OFFICE.x0 - WALL, to: OFFICE.x1 + WALL, y0: DECK, y1: CEIL,
    openings: [doorway(13.0, 16.0, DECK), doorway(21.0, 24.0, DECK)],
  });
  map.addWall({
    tag: 'office-wall-s', axis: 'z', at: OFFICE.z1, thickness: WALL,
    from: OFFICE.x0 - WALL, to: OFFICE.x1 + WALL, y0: DECK, y1: CEIL,
    openings: [doorway(13.0, 16.0, DECK)],
  });
  map.addWall({
    tag: 'office-divider', axis: 'x', at: OFFICE.divider - WALL / 2, thickness: WALL,
    from: OFFICE.z0 - WALL, to: OFFICE.z1, y0: DECK, y1: CEIL,
    openings: [doorway(-12.0, -9.0, DECK)],
  });

  const officeCover = [[11.5, -17.5], [15.8, -9.4], [19.5, -17.0], [22.6, -10.4]];
  for (let i = 0; i < officeCover.length; i++) {
    const [x, z] = officeCover[i];
    map.addSolid({
      min: [x, DECK, z],
      max: [x + 2.0, DECK + 0.95, z + 0.8],
      color: P.wardenGunmetal,
      outline: true,
      tag: `office-cover-${i}`,
    });
  }

  // -------------------------------------------------------------------------
  // Traversal: four routes to the deck that never touch a staircase
  // -------------------------------------------------------------------------

  // 1. Turbine Hall, west. Crates to a container to a gantry to the deck lip:
  //    1.0 vault, 1.3 mantle, 0.7 vault, 1.0 vault, 2.0 mantle.
  //
  // The chain climbs south: crates on the container's north side, gantry on its
  // south side. That is not arbitrary. The container is the map's only ledge in
  // the hang band, and a hang needs a body's worth of clear air below the lip —
  // so its east face is deliberately left with nothing against it.
  crate(map, 'stack-hall-low', [-14.6, -19.4], [-12.4, -17.2], G, 1.0);
  crate(map, 'stack-hall-mid', [-14.4, -17.2], [-12.4, -15.0], G, 2.3);
  // At 3.0 the container's top is above the mantle band from the floor, so
  // jumping at it from ground level fails the mantle and drops into a ledge
  // hang (Section 6.1, Section 16 check 6). Nothing else on the map exercises
  // that path.
  map.addSolid({
    min: [-14.6, G, -15.0],
    max: [-11.6, G + 3.0, -12.0],
    color: P.hazardOrange,
    outline: true,
    tag: 'hall-container',
  });
  gantry(map, 'gantry-hall', [-14.6, -12.0], [-8.0, -9.0], GANTRY);

  // 2. Turbine Hall, south. Out of the lower vent onto a maintenance platform,
  //    then onto the deck: 2.0 mantle, 1.7 mantle.
  gantry(map, 'gantry-hall-south', [-16.6, 3.0], [-13.2, 5.0], V2);

  // 3. Loading Bay. The same shape as the hall route, arriving beside the bay
  //    void: 1.0 vault, 1.3 mantle, 1.7 mantle, 2.0 mantle.
  //
  // The gantry stands inside the void, open to the roof, and the lip is the
  // void's east edge 0.8m past its end. It used to sit wholly under the deck
  // with the lip over its east end, which left one way onto the lip: crouched
  // under 1.65m of slab, hands up into the underside. The census made that
  // climb because it stands wherever the rule says a body fits; a player
  // walks up to a ledge standing, and here could not (B4). The hall gantry
  // has no such problem - its lip overhangs only its last 0.6m and the rest
  // is in the hall's full-height void - so it is left as it was.
  crate(map, 'stack-bay-low', [13.0, -4.4], [15.2, -2.2], G, 1.0);
  crate(map, 'stack-bay-mid', [15.2, -4.2], [17.2, -2.4], G, 2.3);
  gantry(map, 'gantry-bay', [17.4, -4.4], [20.6, -1.4], GANTRY);

  // 4. Corridor to the Server Vault, silently. Crates to the upper vent, crawl
  //    it, then up through the hatch in the vault floor: 1.0 vault, 1.3 mantle,
  //    2.0 mantle, 1.7 mantle.
  crate(map, 'stack-vault-low', [11.4, 2.6], [13.6, 4.8], G, 1.0);
  crate(map, 'stack-vault-mid', [13.6, 2.8], [15.6, 4.6], G, 2.3);

  // Loose crates: cover, and somewhere to practise a vault.
  const looseCrates = [
    [-25.0, 1.0, 0.9], [-20.0, -19.0, 0.7], [2.0, -16.0, 1.0],
    [20.0, -18.0, 0.8], [26.0, -6.0, 1.05], [-3.0, 10.0, 0.75],
    [24.0, 8.0, 0.9], [-16.0, 14.0, 0.85],
  ];
  for (let i = 0; i < looseCrates.length; i++) {
    const [x, z, h] = looseCrates[i];
    crate(map, `crate-${i}`, [x, z], [x + 1.5, z + 1.5], G, h);
  }

  // -------------------------------------------------------------------------
  // Exterior: the fire escape, and the roof
  // -------------------------------------------------------------------------

  // Switchbacks against the north wall. Every rise is 2.0m or less, so the
  // whole climb stays inside the mantle band. The platform at deck height steps
  // in through the shell; carry on up and the last one vaults onto the roof.
  const FE_WEST = [6.0, 8.2];
  const FE_EAST = [FIRE_ESCAPE.x0, FIRE_ESCAPE.x1];
  const FE_Z = [-25.0, -HALF_D - WALL];
  crate(map, 'fire-escape-base', [FE_WEST[0], -27.0], [FE_WEST[1], -24.0], G, 1.0);
  const feHeights = [2.3, 4.3, FIRE_ESCAPE.landing, 8.0, 10.0];
  for (let i = 0; i < feHeights.length; i++) {
    const span = i % 2 === 0 ? FE_EAST : FE_WEST;
    gantry(map, `fire-escape-${i}`, [span[0], FE_Z[0]], [span[1], FE_Z[1]], feHeights[i]);
  }

  // Roof. Same generator as the deck, so the hatch is a real hole and the only
  // climbable piece is the parapet the fire escape arrives at.
  const roofHatch = { x0: -3.0, x1: 0.0, z0: 12.0, z1: 15.0 };
  map.addFloorPlate({
    tag: 'roof',
    min: [-HALF_W - WALL, -HALF_D - WALL],
    max: [HALF_W + WALL, HALF_D + WALL],
    top: ROOF,
    thickness: WALL,
    color: P.concreteDark,
    lipColor: P.concrete,
    voids: [roofHatch],
    lips: [{ x0: FE_EAST[0], x1: FE_EAST[1], z0: -HALF_D - WALL, z1: -HALF_D - WALL + 1.2, tag: 'lip-roof' }],
  });
  for (const bar of edgeBars(roofHatch, ROOF)) {
    map.addSolid({ ...bar, color: P.hazardOrange, tag: 'roof-hatch-lip', castShadow: false });
  }

  // -------------------------------------------------------------------------
  // Rooms (Section 5 readability). Entries are derived, never declared.
  // -------------------------------------------------------------------------

  map.addRoom({
    id: 'turbine-hall', name: 'Turbine Hall',
    min: [-HALF_W, -HALF_D], max: [HALL_EAST, HALL_SOUTH], floorY: G, ceilingY: DECK,
  });
  map.addRoom({
    id: 'loading-bay', name: 'Loading Bay',
    min: [BAY_WEST + WALL, -HALF_D], max: [HALF_W, BAY_SOUTH], floorY: G, ceilingY: DECK,
  });
  map.addRoom({
    id: 'server-vault', name: 'Server Vault',
    min: [VAULT.x0, VAULT.z0], max: [VAULT.x1, VAULT.z1], floorY: DECK, ceilingY: CEIL,
  });
  map.addRoom({
    id: 'office-west', name: 'Office West',
    min: [OFFICE.x0, OFFICE.z0], max: [OFFICE.divider, OFFICE.z1], floorY: DECK, ceilingY: CEIL,
  });
  map.addRoom({
    id: 'office-east', name: 'Office East',
    min: [OFFICE.divider, OFFICE.z0], max: [OFFICE.x1, OFFICE.z1], floorY: DECK, ceilingY: CEIL,
  });

  // -------------------------------------------------------------------------
  // Sites, spawns, lights, waypoints (mapdata.js) - after the rooms, because a
  // site finds its room by containment.
  // -------------------------------------------------------------------------

  placeSites(map);
  placeSpawns(map);
  placeLights(map);
  placeWaypoints(map);
  placeRoutes(map);

  // -------------------------------------------------------------------------
  // Finish
  // -------------------------------------------------------------------------

  map.collision.build();
  map.deriveClimbableSurfaces();
  // After the rule, because the routes are lit where the rule says a body
  // arrives (B7), and before validation, which counts what was lit.
  lightRoutes(map);
  map.deriveRoomEntries();
  map.deriveWardenGround();
  validateMap(map, EXPECTS);

  return map;
}

// ---------------------------------------------------------------------------
// Small local builders. These exist so a prop's height and its role in a
// traversal chain are stated once, in the chain, rather than as two numbers
// that can drift apart.
// ---------------------------------------------------------------------------

/** A vaultable box sitting on a floor. */
function crate(map, tag, min, max, baseY, height) {
  return map.addSolid({
    min: [min[0], baseY, min[1]],
    max: [max[0], baseY + height, max[1]],
    color: P.hazardOrange,
    outline: true,
    tag,
  });
}

/**
 * A raised platform whose top is at `top`. It hangs deep enough for the Shade's
 * ledge probe to get two rays into its face — a thin slab can fall between two
 * probe heights and become invisible to the climb.
 */
function gantry(map, tag, min, max, top) {
  return map.addSolid({
    min: [min[0], top - M.deckLipDepth, min[1]],
    max: [max[0], top, max[1]],
    color: P.wardenGunmetal,
    tag,
    castShadow: false,
  });
}

/** Four hazard bars ringing a hole in a floor. */
function edgeBars(rect, top) {
  const t = 0.2;
  const h = 0.12;
  return [
    { min: [rect.x0 - t, top, rect.z0 - t], max: [rect.x1 + t, top + h, rect.z0] },
    { min: [rect.x0 - t, top, rect.z1], max: [rect.x1 + t, top + h, rect.z1 + t] },
    { min: [rect.x0 - t, top, rect.z0], max: [rect.x0, top + h, rect.z1] },
    { min: [rect.x1, top, rect.z0], max: [rect.x1 + t, top + h, rect.z1] },
  ];
}
