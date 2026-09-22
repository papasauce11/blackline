/**
 * BLACKLINE - maps/yarddecals.js
 *
 * Where the container yard is marked (E5): the decals `mapdecals.js` lays
 * on the yard. Dressing, not information. Rust where the rain sits at a
 * container's foot, a box number stencilled on a side, the trucks' tracks
 * through both gates and a kerb inside the south one, oil where the
 * trailer backs in and the loose boxes were dragged, a drip down the row
 * the mast hangs over. Every container face here is a climb (the tops are
 * one deck, D2), so what Section 5 amended asks is kept the other way:
 * nothing is laid on the first stage of a declared route or the ground at
 * its foot, and nothing within reach of a site's centre or the spots the
 * light checks read (tests/yardlight.js). Positions are the layout's
 * (yard.js): the ring's inner faces at x +-27.6 and z +-18.6, the bays'
 * lane rows at x +-6.2..8.6, bay C's side rows at x +-9.6..12.
 *
 * Layering (Section 3.1): as yarddata.js - config and mapdecals.
 */

import { CONFIG } from '../config.js';
import { bakeDecals } from '../mapdecals.js';

const G = CONFIG.map.groundY;

/** A rust band's height, and a stencil's line at eye height on a 2.9m box. */
const RUST_H = 0.9;
const STENCIL_Y = G + 1.7;

export function placeDecals(map) {
  const specs = [
    // Rust at the foot of the rows: the ring's north row west of bay A's
    // stack, bay A's lane row on the bay side clear of the skip, bay B's on
    // its bay side, the ring's east row across the lane from the trailer,
    // bay C's west row facing in, the ring's south row west of bay C.
    { kind: 'rust', tag: 'rust-ring-north-w', at: [-25.8, G + RUST_H / 2, -18.6], face: 'south', w: 3.4, h: RUST_H },
    { kind: 'rust', tag: 'rust-bay-a-lane', at: [-8.6, G + RUST_H / 2, -16.0], face: 'west', w: 4.0, h: RUST_H },
    { kind: 'rust', tag: 'rust-bay-b-lane', at: [8.6, G + RUST_H / 2, -15.0], face: 'east', w: 4.0, h: RUST_H },
    { kind: 'rust', tag: 'rust-ring-east', at: [27.6, G + RUST_H / 2, -8.0], face: 'west', w: 5.0, h: RUST_H },
    { kind: 'rust', tag: 'rust-bay-c-west', at: [-9.6, G + RUST_H / 2, 15.0], face: 'east', w: 5.0, h: RUST_H },
    { kind: 'rust', tag: 'rust-ring-south-w', at: [-14.0, G + RUST_H / 2, 18.6], face: 'north', w: 3.0, h: RUST_H },
    // Box numbers, at eye height.
    { kind: 'stencil', tag: 'stencil-bay-a-lane', at: [-8.6, STENCIL_Y, -9.0], face: 'west', w: 3.0, h: 1.0 },
    { kind: 'stencil', tag: 'stencil-bay-b-lane', at: [8.6, STENCIL_Y, -9.5], face: 'east', w: 3.0, h: 1.0 },
    { kind: 'stencil', tag: 'stencil-ring-north-e', at: [13.5, STENCIL_Y, -18.6], face: 'south', w: 3.0, h: 1.0 },
    { kind: 'stencil', tag: 'stencil-bay-c-east', at: [9.6, STENCIL_Y, 12.0], face: 'west', w: 3.0, h: 1.0 },
    // The trucks: tracks in through both gates, a kerb inside the south one.
    { kind: 'scuff', tag: 'tracks-north-gate', at: [0.0, G, -16.5], face: 'up', along: [0, 0, 1], w: 2.2, h: 5.0 },
    { kind: 'scuff', tag: 'tracks-south-gate', at: [0.0, G, 19.5], face: 'up', along: [0, 0, 1], w: 2.2, h: 4.0 },
    { kind: 'hazard', tag: 'kerb-south-gate', at: [0.0, G, 17.2], face: 'up', along: [1, 0, 0], w: 1.3, h: 4.0 },
    // Oil: where the trailer is backed into bay B, where the loose boxes
    // were dragged in the west store, and under the walkway's south edge.
    { kind: 'stain', tag: 'oil-bay-b', at: [21.5, G, -9.5], face: 'up', w: 2.0, h: 3.0 },
    { kind: 'stain', tag: 'oil-store-west', at: [-21.0, G, 12.0], face: 'up', w: 2.6, h: 2.6 },
    { kind: 'stain', tag: 'oil-walkway', at: [-3.5, G, 1.0], face: 'up', w: 2.2, h: 2.2 },
    // A drip down bay A's south row, under the mast that stands against it.
    { kind: 'drip', tag: 'drip-bay-a-south', at: [-24.0, G + 1.45, -4.4], face: 'north', w: 3.0, h: 2.9 },
  ];
  return bakeDecals(map, specs);
}
