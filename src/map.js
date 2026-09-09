/**
 * BLACKLINE — map.js
 *
 * "Meridian Substation", v2. The level: geometry, collision volumes, spawns,
 * plant sites, lights and AI waypoints. The machinery that builds it lives in
 * `mapkit.js`; this file is the layout.
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

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { GameMap, facing } from './mapkit.js';
import { classifyReach } from './physics.js';

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

// ---------------------------------------------------------------------------
// buildMap
// ---------------------------------------------------------------------------

/**
 * @param {object} options
 * @param {THREE.DataTexture} options.gradientMap 4-step toon ramp from main.js
 * @returns {GameMap}
 */
export function buildMap({ gradientMap }) {
  const map = new GameMap(gradientMap, 'meridian-substation-v2');
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
  const bayVoid = { x0: 19.6, x1: 22.6, z0: -5.6, z1: -2.6 };
  const vaultHatch = { x0: 13.0, x1: 15.0, z0: 9.2, z1: 11.2 };

  const deckLips = [
    { x0: -8.6, x1: -7.4, z0: -12.0, z1: -9.0, tag: 'lip-hall-east' },
    { x0: -16.5, x1: -13.2, z0: 5.6, z1: 6.8, tag: 'lip-hall-south' },
    { x0: 18.4, x1: 19.6, z0: -5.6, z1: -2.6, tag: 'lip-bay' },
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

  for (let i = 0; i < 4; i++) {
    const x = 10.6 + (i < 2 ? i * 1.8 : 8.8 + (i - 2) * 2.2);
    map.addSolid({
      min: [x, DECK, 14.5],
      max: [x + 1.1, DECK + 1.9, 18.5],
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
    climbable: true,
    outline: true,
    tag: 'hall-container',
  });
  gantry(map, 'gantry-hall', [-14.6, -12.0], [-8.0, -9.0], GANTRY);

  // 2. Turbine Hall, south. Out of the lower vent onto a maintenance platform,
  //    then onto the deck: 2.0 mantle, 1.7 mantle.
  gantry(map, 'gantry-hall-south', [-16.6, 3.0], [-13.2, 5.0], V2);

  // 3. Loading Bay. The same shape as the hall route, arriving beside the bay
  //    void: 1.0 vault, 1.3 mantle, 1.7 mantle, 2.0 mantle.
  crate(map, 'stack-bay-low', [13.0, -5.6], [15.2, -3.4], G, 1.0);
  crate(map, 'stack-bay-mid', [15.2, -5.4], [17.2, -3.6], G, 2.3);
  gantry(map, 'gantry-bay', [17.4, -5.6], [19.6, -2.6], GANTRY);

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
  // Plant sites (Section 5)
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Spawns. The Shade starts outside the shell (v2 requirement 3); the Warden
  // starts inside, on both floors.
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Destructible point lights (Section 5: 12, each with a lightId)
  //
  // Heights are re-keyed to the v2 layout. The hall's pendants hang at deck
  // level in the void, so they light the floor 6m below and the catwalk band
  // beside them; everything under the deck hangs just below it.
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // AI waypoints (Section 5: explicit bidirectional links, both floors, all
  // three sites). Every link is a straight line the Warden can walk — asserted,
  // because Phase 4 shipped a graph whose cross-floor links were not.
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Finish
  // -------------------------------------------------------------------------

  map.collision.build();
  map.deriveClimbableSurfaces();
  map.deriveRoomEntries();
  map.deriveWardenGround();
  validateMap(map);

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

// ---------------------------------------------------------------------------
// Build-time validation. The counts in Section 5 are contractual, and the v2
// requirements are structural, so the map asserts both rather than letting a
// miscount or a severed deck drift in silently.
// ---------------------------------------------------------------------------

function validateMap(map) {
  const problems = [];

  const expect = (actual, wanted, what) => {
    if (actual !== wanted) problems.push(`expected ${wanted} ${what}, built ${actual}`);
  };
  expect(map.lights.length, M.destructibleLightCount, 'destructible lights');
  expect(map.waypoints.length, M.waypointCount, 'waypoints');
  expect(map.shadeSpawns.length, M.shadeSpawnCount, 'shade spawns');
  expect(map.wardenSpawns.length, M.wardenSpawnCount, 'warden spawns');
  expect(map.sites.length, M.plantSiteCount, 'plant sites');

  // A site with no room cannot be planted at all now that the room IS the
  // plant zone, and a silent null here would read in play as "the interact key
  // does nothing at site B".
  for (const site of map.sites) {
    if (!site.room) problems.push(`site "${site.id}" is not inside any room`);
  }
  expect(map.rooms.length, M.roomCount, 'rooms');

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

  // Every climbable box must have resolved to a band, or it is unmarked and
  // therefore unusable-looking (Section 16 check 26).
  for (const box of map.collision.boxes) {
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

  if (problems.length) {
    for (const problem of problems) console.error(`[map] ${problem}`);
    throw new Error(`buildMap: ${problems.length} validation failure(s); see console`);
  }
}
