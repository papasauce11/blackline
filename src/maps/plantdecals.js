/**
 * BLACKLINE - maps/plantdecals.js
 *
 * Where the substation is marked (E4): the decals `mapdecals.js` lays on
 * the plant. Dressing, not information. Nothing here sits within reach of
 * a climb, a vent mouth or a site ring - the pixel checks read those
 * against the concrete round them, and a stain in the band would be read
 * as the material - and nothing here is on a route's stage or the floor
 * at its foot. Positions are the layout's (plant.js): the bay's roller
 * doors are in the east shell at z -20..-16 and -8..-4, the hall's west
 * wall is the shell at x -30, the deck is at 6 and the roof line at 11.
 *
 * Layering (Section 3.1): as plantdata.js - config and mapdecals.
 */

import { CONFIG } from '../config.js';
import { bakeDecals } from '../mapdecals.js';

const M = CONFIG.map;
const G = M.groundY;
const DECK = M.catwalkY;
const CEIL = M.ceilingY;
const HALF_W = M.width / 2;
const HALF_D = M.depth / 2;

/** Just inside a face: the quad is laid on the face and lifted by mapdecals. */
const IN = 0.001;

export function placeDecals(map) {
  const specs = [
    // Loading Bay. Wheel tracks in from both roller doors, a painted kerb
    // across each threshold, a leak in the north-west corner, another by the
    // south door, and the deck's drips down the north wall.
    { kind: 'scuff', tag: 'bay-tracks-north', at: [26.6, G, -18.0], face: 'up', along: [-1, 0, 0], w: 2.2, h: 5.0 },
    { kind: 'scuff', tag: 'bay-tracks-south', at: [26.6, G, -7.2], face: 'up', along: [-1, 0, 0], w: 1.8, h: 5.0 },
    { kind: 'scuff', tag: 'apron-tracks-north', at: [33.0, G, -18.0], face: 'up', along: [-1, 0, 0], w: 2.2, h: 5.0 },
    { kind: 'hazard', tag: 'bay-kerb-north', at: [29.25, G, -18.0], face: 'up', along: [0, 0, 1], w: 1.3, h: 4.0 },
    { kind: 'hazard', tag: 'bay-kerb-south', at: [29.25, G, -6.0], face: 'up', along: [0, 0, 1], w: 1.3, h: 4.0 },
    { kind: 'stain', tag: 'bay-leak-nw', at: [10.5, G, -19.0], face: 'up', w: 2.6, h: 2.6 },
    { kind: 'stain', tag: 'bay-leak-south', at: [26.0, G, 0.2], face: 'up', w: 2.0, h: 2.0 },
    { kind: 'drip', tag: 'bay-drip-1', at: [14.0, DECK - 1.6, -HALF_D + IN], face: 'south', w: 2.5, h: 3.0 },
    { kind: 'drip', tag: 'bay-drip-2', at: [23.0, DECK - 1.6, -HALF_D + IN], face: 'south', w: 2.0, h: 3.0 },

    // Turbine Hall. Two leaks on the floor away from site A and the stacks,
    // rain drips from the roof line down the west shell wall above the deck
    // catwalk, and one from the deck's underside down the east wall.
    { kind: 'stain', tag: 'hall-leak-west', at: [-24.0, G, -8.0], face: 'up', w: 2.6, h: 2.6 },
    { kind: 'stain', tag: 'hall-leak-south', at: [-18.0, G, 6.4], face: 'up', w: 2.2, h: 2.2 },
    { kind: 'stain', tag: 'hall-leak-north', at: [-27.0, G, -14.0], face: 'up', w: 1.8, h: 1.8 },
    { kind: 'drip', tag: 'hall-drip-1', at: [-HALF_W + IN, CEIL - 2.5, -10.0], face: 'east', w: 3.0, h: 5.0 },
    { kind: 'drip', tag: 'hall-drip-2', at: [-HALF_W + IN, CEIL - 2.0, 2.0], face: 'east', w: 2.5, h: 4.0 },
    { kind: 'drip', tag: 'hall-drip-east', at: [-6.0 - IN, DECK - 1.4, -10.0], face: 'west', w: 2.0, h: 2.6 },

    // The corridor ring and the deck: a leak each side, and the vault's.
    { kind: 'stain', tag: 'corridor-leak-south', at: [-8.0, G, 16.0], face: 'up', w: 2.5, h: 2.5 },
    { kind: 'stain', tag: 'corridor-leak-east', at: [22.0, G, 15.0], face: 'up', w: 2.0, h: 2.0 },
    { kind: 'stain', tag: 'deck-leak-north', at: [-3.0, DECK, -13.0], face: 'up', w: 2.4, h: 2.4 },
    { kind: 'stain', tag: 'deck-leak-south', at: [4.0, DECK, 18.0], face: 'up', w: 2.0, h: 2.0 },
    { kind: 'stain', tag: 'vault-leak', at: [23.5, DECK, 8.0], face: 'up', w: 1.8, h: 1.8 },
  ];
  return bakeDecals(map, specs);
}
