/**
 * BLACKLINE - maprooms.js
 *
 * Section 5's readability rule: "no room is a single-door trap".
 *
 * Rooms are DECLARED in map.js with a footprint; their entries are not. They
 * are derived here from the geometry after the map is built, so cutting a
 * doorway or a hatch changes the count and typing a room name does not.
 *
 * Layering (Section 3.1): imports config and mapbake only. Split out of
 * mapkit.js, which was over the ~600 line guidance; this is the derivation
 * half, and it needs nothing from GameMap but the collision world and the
 * room list.
 */

import { CONFIG } from './config.js';
import { CUT_EPSILON, SWEEP_STEP } from './mapbake.js';

const M = CONFIG.map;

/**
 * Derive every way a Shade can get into each declared room.
 *
 * @param {import('./physics.js').CollisionWorld} collision
 * @param {object[]} rooms mutated in place: each gains its `entries`
 */
export function deriveRoomEntries(collision, rooms) {
for (const room of rooms) {
  room.entries = lateralEntries(collision, room)
    .concat(verticalEntries(collision, room, room.ceilingY, 'ceiling'))
    .concat(verticalEntries(collision, room, room.floorY, 'floor'));
}
}

/** Can a crouched Shade pass straight through this point on the boundary? */
function passesThrough(collision, point, inward, half) {
  const outer = -(M.wallThickness + CONFIG.shade.radius + 0.2);
  const inner = CONFIG.shade.radius + 0.2;
  for (let t = outer; t <= inner + CUT_EPSILON; t += SWEEP_STEP) {
    const probe = {
      x: point.x + inward.x * t,
      y: point.y,
      z: point.z + inward.z * t,
    };
    if (!collision.isClear(probe, half)) return false;
  }
  return true;
}

function lateralEntries(collision, room) {
  const radius = CONFIG.shade.radius;
  const half = { x: radius, y: CONFIG.shade.crouchHeight / 2, z: radius };
  const step = M.roomEntrySample;
  const sillMax = Math.min(room.ceilingY - room.floorY, M.roomEntrySillMax + CONFIG.shade.crouchHeight)
    - CONFIG.shade.crouchHeight;
  const edges = [
    { name: 'west', inward: { x: 1, z: 0 }, fixed: room.min.x, from: room.min.z, to: room.max.z, along: 'z' },
    { name: 'east', inward: { x: -1, z: 0 }, fixed: room.max.x, from: room.min.z, to: room.max.z, along: 'z' },
    { name: 'north', inward: { x: 0, z: 1 }, fixed: room.min.z, from: room.min.x, to: room.max.x, along: 'x' },
    { name: 'south', inward: { x: 0, z: -1 }, fixed: room.max.z, from: room.min.x, to: room.max.x, along: 'x' },
  ];

  const entries = [];
  for (const edge of edges) {
    let runStart = null;
    let runEnd = null;
    let runSill = 0;
    const flush = () => {
      if (runStart === null) return;
      const width = runEnd - runStart + step;
      if (width >= radius * 2) {
        const centre = (runStart + runEnd) / 2;
        entries.push({
          kind: 'lateral',
          edge: edge.name,
          width,
          at: {
            x: edge.along === 'x' ? centre : edge.fixed,
            y: room.floorY + runSill,
            z: edge.along === 'x' ? edge.fixed : centre,
          },
        });
      }
      runStart = null;
    };

    for (let a = edge.from + radius; a <= edge.to - radius + CUT_EPSILON; a += step) {
      let sill = null;
      for (let s = 0; s <= sillMax + CUT_EPSILON; s += M.roomEntrySillStep) {
        const point = {
          x: edge.along === 'x' ? a : edge.fixed,
          y: room.floorY + s + half.y + 0.02,
          z: edge.along === 'x' ? edge.fixed : a,
        };
        if (passesThrough(collision, point, edge.inward, half)) {
          sill = s;
          break;
        }
      }
      if (sill === null) {
        flush();
        continue;
      }
      if (runStart === null) {
        runStart = a;
        runSill = sill;
      }
      runEnd = a;
    }
    flush();
  }
  return entries;
}

/**
 * Openings in a room's floor or ceiling. A ceiling opening is always an entry
 * — the Shade can drop through anything. A floor opening only counts when the
 * level design put a climbable lip on it, which is what separates the vault's
 * hatch from the deliberately one-way drop shaft.
 */
function verticalEntries(collision, room, planeY, kind) {
  const radius = CONFIG.shade.radius;
  const half = { x: radius, y: CONFIG.shade.crouchHeight / 2, z: radius };
  const step = M.roomVerticalSample;
  const reach = CONFIG.shade.crouchHeight / 2 + M.floorThickness + 0.2;

  const nx = Math.max(1, Math.floor((room.max.x - room.min.x - radius * 2) / step));
  const nz = Math.max(1, Math.floor((room.max.z - room.min.z - radius * 2) / step));
  const open = [];
  for (let j = 0; j < nz; j++) {
    open.push(new Array(nx).fill(false));
    for (let i = 0; i < nx; i++) {
      const x = room.min.x + radius + (i + 0.5) * step;
      const z = room.min.z + radius + (j + 0.5) * step;
      let clear = true;
      for (let t = -reach; t <= reach + CUT_EPSILON && clear; t += SWEEP_STEP) {
        if (!collision.isClear({ x, y: planeY + t, z }, half)) clear = false;
      }
      open[j][i] = clear;
    }
  }

  const entries = [];
  const seen = [];
  for (let j = 0; j < nz; j++) seen.push(new Array(nx).fill(false));
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      if (!open[j][i] || seen[j][i]) continue;
      // Flood the connected opening so two separate hatches are two entries.
      const stack = [[i, j]];
      seen[j][i] = true;
      let i0 = i;
      let i1 = i;
      let j0 = j;
      let j1 = j;
      while (stack.length) {
        const [ci, cj] = stack.pop();
        i0 = Math.min(i0, ci);
        i1 = Math.max(i1, ci);
        j0 = Math.min(j0, cj);
        j1 = Math.max(j1, cj);
        const neighbours = [[ci - 1, cj], [ci + 1, cj], [ci, cj - 1], [ci, cj + 1]];
        for (const [ni, nj] of neighbours) {
          if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue;
          if (!open[nj][ni] || seen[nj][ni]) continue;
          seen[nj][ni] = true;
          stack.push([ni, nj]);
        }
      }
      // No minimum size here, unlike the boundary walk. Every cell in this
      // component already carried a full crouch capsule the whole way through
      // the floor or ceiling plane, so one cell is proof enough — and demanding
      // several would reject a vent-width shaft for being narrow rather than
      // for being impassable.
      const width = (i1 - i0 + 1) * step;
      const depth = (j1 - j0 + 1) * step;
      const at = {
        x: room.min.x + radius + ((i0 + i1) / 2 + 0.5) * step,
        y: planeY,
        z: room.min.z + radius + ((j0 + j1) / 2 + 0.5) * step,
      };
      if (kind === 'floor' && !hasClimbableLip(collision, at, planeY, Math.max(width, depth))) continue;
      entries.push({ kind, edge: kind, width: Math.min(width, depth), at });
    }
  }
  return entries;
}

/** Is there a climbable surface at this height bordering the opening? */
function hasClimbableLip(collision, at, planeY, span) {
  const reach = span / 2 + CONFIG.shade.vaultReach;
  for (const box of collision.boxes) {
    if (!box.climbable) continue;
    if (Math.abs(box.max.y - planeY) > 0.05) continue;
    if (box.max.x < at.x - reach || box.min.x > at.x + reach) continue;
    if (box.max.z < at.z - reach || box.min.z > at.z + reach) continue;
    return true;
  }
  return false;
}
