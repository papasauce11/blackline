/**
 * BLACKLINE - tests/wardenground.js
 *
 * AUTO suite: B9, the Warden stays grounded. The redesign's asymmetry is one
 * sentence - the Shade climbs anything within reach, the Warden climbs
 * nothing - and A1 turned the second half into data: `map.wardenGround`,
 * every cell a walking body can reach from its spawns, flooded with the
 * Warden's own step. This check does not re-derive it. It plays the game
 * with the AI driving - a patrol, a plant to defend and defuse, a Shade to
 * chase - through the real fixed step, and asks on every one of them
 * whether the Warden's feet are on that ground. If the AI ever climbs,
 * vaults, gets shoved onto a crate or pushed through a floor, this is where
 * it shows.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { AI_STATE } from '../systems/ai.js';
import { CHARGE } from '../systems/objective.js';
import { plantAt } from './plantspots.js';

const W = CONFIG.warden;
/** A cell centre is at most this far from a foot standing between cells. */
const CELL_NEAR = CONFIG.map.wardenGroundCell * 1.1;
/**
 * How far above its ground an airborne Warden may be. Walking DOWN a stair
 * it is in the air between treads - at 3 m/s it clears a 0.4m tread before
 * it has fallen 0.3m and lands two down - so a descent is a series of short
 * falls over ground that is a little below the feet. A metre is three
 * treads; the deck is six.
 */
const DESCENT = 1.0;

/**
 * Is a foot at `at` on the Warden's ground? Standing: a floor of the column
 * under it within a step - or, since a body stands between cell centres and
 * a column whose centre is inside a wall has no floors while the body beside
 * it is fine, of a cell within one cell's reach. Airborne: a floor that
 * close, no more than `DESCENT` below the feet and no more than a step above
 * them, so a stair is walked down and a deck edge is not.
 */
export function onGround(ground, at, grounded) {
  const drop = grounded ? W.stepHeight : DESCENT;
  const near = (y) => y <= at.y + W.stepHeight && y >= at.y - drop;
  if (ground.floorsAt(at.x, at.z).some(near)) return true;
  return ground.cellsWithin(at, CELL_NEAR).some((cell) => near(cell.y));
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-warden-never-leaves-its-ground',
    spec: 'Section 6.2 / Section 11 / Block A phase 1 (B9)',
    name: 'Through a patrol, a defended plant and a chase driven by the AI, the Warden is on its own ground every step',
    run: (h) => {
      const problems = [];
      const dt = CONFIG.time.fixedDt;
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true, seed: 20260914 });
      h.menu.hide();
      h.setPaused(false);
      h.input.clearAll();
      const ground = h.map.wardenGround;
      if (!ground) return { pass: false, detail: 'map.wardenGround was never derived' };
      const warden = h.warden;
      const ai = h.wardenAI;
      // Four rifle rounds kill the Shade and end the chase early.
      h.debugState.godMode = true;

      let steps = 0;
      let off = 0;
      let airborne = 0;
      let highest = -Infinity;
      const states = new Set();
      const phases = [];
      const at = { x: 0, y: 0, z: 0 };
      const watch = (label, count) => {
        let offHere = 0;
        for (let i = 0; i < count; i++) {
          h.stepFrames(1);
          steps++;
          states.add(ai.state);
          at.x = warden.position.x;
          at.y = warden.feetY;
          at.z = warden.position.z;
          highest = Math.max(highest, at.y);
          if (!warden.grounded) airborne++;
          if (!onGround(ground, at, warden.grounded)) {
            offHere++;
            if (off < 3) {
              problems.push(`${label}, step ${i} (${ai.state}): the Warden's feet are off its ground at `
                + `(${at.x.toFixed(2)}, ${at.y.toFixed(2)}, ${at.z.toFixed(2)}), grounded=${warden.grounded}`);
            }
            off++;
          }
        }
        if (!label.includes('+')) phases.push(`${label} ${count} steps, ${offHere} off`);
        else phases[phases.length - 1] = phases[phases.length - 1].replace(/(\d+) steps, (\d+) off$/, (m, s, o) => `${Number(s) + count} steps, ${Number(o) + offHere} off`);
      };

      // 1. A patrol, with the Shade parked at its spawn out of sight.
      watch('patrol', Math.round(20 / dt));

      // 2. A hunt, from the patrol (Section 16 check 12 is the shape): the Shade dropped near the Warden and sprinting in
      // circles - a noise it hears (Section 7.2), a body it may see - so the
      // AI leaves its route for ground it picks itself: SUSPICIOUS,
      // INVESTIGATE, ENGAGE, SEARCH. The phase has to have moved it, or it
      // proved nothing about those states.
      const seenBefore = new Set(states);
      let dropped = false;
      for (let k = 0; k < 8 && !dropped; k++) {
        const angle = (k / 8) * Math.PI * 2;
        const spot = { x: warden.position.x + Math.sin(angle) * 5, y: warden.feetY, z: warden.position.z + Math.cos(angle) * 5 };
        const centre = { x: spot.x, y: spot.y + CONFIG.shade.standHeight / 2 + 0.02, z: spot.z };
        if (!h.map.collision.isClear(centre, h.shade.half)) continue;
        const under = h.map.collision.raycast({ x: spot.x, y: spot.y + 0.1, z: spot.z }, { x: 0, y: -1, z: 0 }, 0.3);
        if (!under) continue;
        h.shade.reset({ position: spot, yaw: angle });
        dropped = true;
      }
      if (!dropped) h.shade.reset(h.map.shadeSpawns[0]);
      h.input.clearAll();
      h.input.heldCodes.add('KeyW');
      h.input.heldCodes.add('ShiftLeft');
      const hunt = Math.round(20 / dt);
      for (let i = 0; i < hunt; i += 30) {
        h.shade.yaw += 0.9;
        watch(i === 0 ? 'hunt' : `hunt+${i}`, Math.min(30, hunt - i));
      }
      h.input.clearAll();
      const moved = [...states].filter((state) => !seenBefore.has(state));
      if (!moved.length) problems.push(`the hunt never took the AI out of [${[...seenBefore].join(' ')}]`);

      // 3. A plant, and the AI walking its last leg to defend and defuse it.
      // The charge goes where the plant rule allows, off the ring, at site A.
      const planted = plantAt(h, h.map.sites[0].id);
      if (h.objective.round.charge !== CHARGE.PLANTED) {
        problems.push(`the plant at ${h.map.sites[0].id} did not take in ${planted.toFixed(1)}s`);
      } else {
        // Out of the way, so the defuse is not interrupted by a sighting.
        h.shade.reset(h.map.shadeSpawns[0]);
        watch('defend', Math.round(30 / dt));
        if (!states.has(AI_STATE.DEFEND)) problems.push('the AI never entered DEFEND for the planted charge');
      }

      h.debugState.godMode = false;
      if (h.debugTools.assertionFailures !== 0) problems.push(`${h.debugTools.assertionFailures} runtime assertion failures`);
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      return {
        pass: problems.length === 0 && off === 0,
        detail: problems.length === 0 && off === 0
          ? `${steps} steps of AI-driven play (${phases.join('; ')}), states [${[...states].join(' ')}]: `
            + `the Warden's feet were on map.wardenGround every step (${airborne} of them airborne, all within `
            + `${DESCENT}m over it - a stair walked down), highest ${highest.toFixed(2)}m`
          : problems.concat(off > 3 ? [`${off} steps off the ground in all`] : []).join('; '),
      };
    },
  });
}
