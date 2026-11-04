/**
 * BLACKLINE - tests/xray.js
 *
 * AUTO suite (M2, Block M): the x-ray's rule. The Shade's x-ray looks through
 * thin things - ducts, crates, containers - and never through a real wall, and
 * the rule that decides is mechanical (mapxray.js): a box is see-through if
 * its top is a body below its room's ceiling or it stands under the sky, a
 * box on the shell's boundary never is, and a sightline's budget is
 * `xray.maxThickness` metres of such solids in total. The rule reads no tag.
 * **This check does** - it names its subjects by tag, because that is how it
 * finds the duct it means, and then asks the live rule about each. A map that
 * loses its ducts would otherwise pass by finding none, so every set must be
 * non-empty and its count is in the detail.
 *
 * It reads the built map and asks `map.seeThroughAlong`; it drives no frame.
 *
 *   1. Per box: every thin subject is see-through, every shell box and every
 *      room wall is not.
 *   2. Along a line, straight across a thin solid's short axis: seen through,
 *      and the thickness is the box's own; across a shell or room wall:
 *      stopped, and by that box.
 *   3. The budget bites: a line across two thin solids that add to more than
 *      the budget is not seen through, and nothing in it is the culprit.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { raySlab } from '../collisionbox.js';
import { seeThroughBox } from '../mapxray.js';

const BUDGET = CONFIG.shade.xray.maxThickness;

/**
 * The subjects, by tag, per map. Ducts and crates and containers are the thin
 * ones; `grade` vents are left out on purpose: they run out through the
 * plant's shell wall, so their footprint reaches the shell boundary and the
 * rule (rightly, by its own words) will not look through them.
 */
const SUBJECTS = {
  plant: {
    ducts: /^vent-(low-north|low-south|up-vault)-/,
    crates: /^(stack-|crate-)/,
    containers: /^hall-container$/,
    shell: /^shell-/,
    walls: /^(hall-east|hall-south|bay-west|bay-south)-wall-\d+$|^vault-wall-[wens]-\d+$|^office-wall-[wens]-\d+$|^office-divider-\d+$/,
  },
  yard: {
    containers: /^bay-/,
    crates: /^pallets-/,
    shell: /^(ring|arch)-/,
    // The yard has no walls inside its ring: its rooms are bays open to the sky.
    walls: null,
  },
};

/** How far from a face the line begins and ends, as the brief puts it: a metre outside. */
const OUTSIDE = 1.0;
const SLOP = 0.05;

const size = (box, axis) => box.max[axis] - box.min[axis];
const fmt = (box) => `${box.tag} (y ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)})`;

/** Every sight-blocking box a segment crosses, by the same slab test the rule uses. */
function crossed(map, from, to) {
  const lo = { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), z: Math.min(from.z, to.z) };
  const hi = { x: Math.max(from.x, to.x), y: Math.max(from.y, to.y), z: Math.max(from.z, to.z) };
  const delta = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
  return map.collision.query(lo, hi).filter((box) => box.blocksSight && raySlab(from, delta, box.min, box.max));
}

/**
 * A line straight across the box's short axis, at its middle height and along
 * its middle, a metre outside each face - or null if something else stands in it.
 */
function acrossLine(map, box) {
  const axis = size(box, 'x') <= size(box, 'z') ? 'x' : 'z';
  const other = axis === 'x' ? 'z' : 'x';
  const from = { x: 0, y: (box.min.y + box.max.y) / 2, z: 0 };
  const to = { ...from };
  from[other] = to[other] = (box.min[other] + box.max[other]) / 2;
  from[axis] = box.min[axis] - OUTSIDE;
  to[axis] = box.max[axis] + OUTSIDE;
  const hit = crossed(map, from, to);
  return hit.length === 1 && hit[0] === box ? { from, to, extent: size(box, axis) } : null;
}

/** The first pair of thin boxes end to end that a line at their shared middle crosses and nothing else, and that add to more than the budget. */
function pairLine(map, thin) {
  for (const a of thin) {
    for (const b of thin) {
      if (a === b) continue;
      for (const axis of ['x', 'z']) {
        const other = axis === 'x' ? 'z' : 'x';
        const gap = b.min[axis] - a.max[axis];
        if (gap < -0.01 || gap > 0.2) continue;
        const o0 = Math.max(a.min[other], b.min[other]);
        const o1 = Math.min(a.max[other], b.max[other]);
        const y0 = Math.max(a.min.y, b.min.y);
        const y1 = Math.min(a.max.y, b.max.y);
        if (o1 - o0 < 0.5 || y1 - y0 < 0.3) continue;
        if (size(a, axis) + size(b, axis) <= BUDGET + 0.1) continue;
        const from = { x: 0, y: (y0 + y1) / 2, z: 0 };
        const to = { ...from };
        from[other] = to[other] = (o0 + o1) / 2;
        from[axis] = a.min[axis] - OUTSIDE;
        to[axis] = b.max[axis] + OUTSIDE;
        const hit = crossed(map, from, to);
        if (hit.length === 2 && hit.includes(a) && hit.includes(b)) return { from, to, a, b };
      }
    }
  }
  return null;
}

/** @param {import('../ui/debug.js').DebugTools} debugTools */
export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-xray-sees-through-a-duct-a-crate-and-a-container-and-never-through-a-wall',
    spec: 'Block M / M2',
    name: 'The x-ray rule on the built map: every duct, crate, container and pallet stack is see-through, every shell box and room wall is not; a line across one thin solid is seen through with the box\'s own thickness, a line across a shell or room wall is stopped by it, and a line across two thin solids that add past the budget is not seen through',
    run: (h) => {
      const map = h.map;
      const subjects = SUBJECTS[map.id];
      if (!subjects) return { pass: false, detail: `no x-ray subjects named for map "${map.id}"` };
      const boxes = map.collision.boxes;
      const problems = [];
      const readings = [];

      // The sets. A room wall "reaches the ceiling" if its top is some room's:
      // the piece under a window or over a vent mouth is a low wall, and the
      // rule (top a body below the ceiling) does look over those; they are
      // counted, not asserted.
      const pick = (re) => (re ? boxes.filter((box) => re.test(box.tag || '')) : []);
      const ceiling = (box) => map.rooms.some((room) => Math.abs(room.ceilingY - box.max.y) < 0.01);
      const thin = [...pick(subjects.ducts), ...pick(subjects.crates), ...pick(subjects.containers)];
      const shell = pick(subjects.shell);
      const wallsAll = pick(subjects.walls);
      const walls = wallsAll.filter(ceiling);
      const sets = [['thin', thin], ['shell', shell]];
      if (subjects.walls) sets.push(['wall', walls]);
      for (const [name, set] of sets) {
        if (set.length === 0) problems.push(`no ${name} boxes found on ${map.id}`);
      }
      readings.push(`${map.id}: ${thin.length} thin (${pick(subjects.ducts).length} duct, ${pick(subjects.crates).length} crate, ${pick(subjects.containers).length} container), ${shell.length} shell, ${subjects.walls ? `${walls.length} wall (+${wallsAll.length - walls.length} low pieces not asserted)` : 'no room walls'}`);

      // 1. Per box.
      const wrong = thin.find((box) => !seeThroughBox(map, box));
      if (wrong) problems.push(`thin ${fmt(wrong)} is not see-through`);
      const solid = [...shell, ...walls].find((box) => seeThroughBox(map, box));
      if (solid) problems.push(`${solid.tag} (top ${solid.max.y.toFixed(2)}) is see-through but is a shell box or room wall`);

      // 2. Along a line.
      const across = thin.filter((box) => size(box, 'x') < BUDGET - 0.1 && size(box, 'z') < BUDGET - 0.1);
      const thinLine = across.map((box) => ({ box, line: acrossLine(map, box) })).find((entry) => entry.line);
      if (!thinLine) {
        problems.push('no thin solid with a clear line across its short axis');
      } else {
        const { box, line } = thinLine;
        const got = map.seeThroughAlong(line.from, line.to);
        if (!got.seeThrough || Math.abs(got.thickness - line.extent) > SLOP) {
          problems.push(`line across ${box.tag}: seeThrough ${got.seeThrough}, thickness ${got.thickness.toFixed(3)} against its ${line.extent.toFixed(3)}`);
        }
        readings.push(`across ${box.tag} ${got.thickness.toFixed(2)}m of ${line.extent.toFixed(2)}m`);
      }
      for (const [name, set] of [['shell', shell], ['wall', walls]]) {
        if (set.length === 0) continue;
        const entry = set.map((box) => ({ box, line: acrossLine(map, box) })).find((e) => e.line);
        if (!entry) {
          problems.push(`no ${name} box with a clear line across it`);
          continue;
        }
        const got = map.seeThroughAlong(entry.line.from, entry.line.to);
        if (got.seeThrough || got.blockedBy !== entry.box) {
          problems.push(`line across ${name} ${entry.box.tag}: seeThrough ${got.seeThrough}, blocked by ${got.blockedBy ? got.blockedBy.tag : 'nothing'}`);
        }
        readings.push(`across ${entry.box.tag} stopped by ${got.blockedBy ? got.blockedBy.tag : 'nothing'}`);
      }

      // 3. The budget.
      const pair = pairLine(map, thin);
      if (!pair) {
        problems.push(`no pair of thin solids end to end on ${map.id} that add past ${BUDGET}m`);
      } else {
        const got = map.seeThroughAlong(pair.from, pair.to);
        if (got.seeThrough || got.thickness < BUDGET || got.blockedBy !== null) {
          problems.push(`line across ${pair.a.tag} and ${pair.b.tag}: seeThrough ${got.seeThrough}, thickness ${got.thickness.toFixed(3)}, blocked by ${got.blockedBy ? got.blockedBy.tag : 'nothing'}`);
        }
        readings.push(`${pair.a.tag}+${pair.b.tag} ${got.thickness.toFixed(2)}m against ${BUDGET}m`);
      }

      return {
        pass: problems.length === 0,
        detail: `${problems.length ? `${problems.join('; ')} [` : ''}${readings.join('; ')}${problems.length ? ']' : ''}`,
      };
    },
  });
}
