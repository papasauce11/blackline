/**
 * BLACKLINE - systems/aialarm.js
 *
 * Where the Warden hangs its one alarm camera (Section 9.2, K4). The camera
 * prefers the likeliest approach: a declared stairless route (`map.routes`),
 * whose first stage is where the Shade's climb starts. `gadgets.alarmCovers`
 * is the camera's own trip rule, so the AI takes the first wall that rule says
 * watches the way in. It prefers; it never withholds. A camera held for the
 * perfect wall is a camera the round never gets, and the radius it sees is
 * short, so where no wall watches an approach it sweeps for any wall, as it
 * did before K4.
 *
 * Methods of `WardenAI`, installed on its prototype as ainav.js's are (F3):
 * `this` is the AI. Layering (Section 3.1): imports config and aistate.js.
 */

import { CONFIG } from '../config.js';
import { A } from './aistate.js';

const TAU = Math.PI * 2;

export const ALARM = {
  /**
   * Section 9.2: one alarm camera per round, placed on a wall.
   *
   * The Warden gets a single one, so it is spent where it earns the most —
   * standing over a charge in DEFEND, or at a spot it has just cleared in
   * SEARCH and is about to walk away from. Since K4 it is also spent where it
   * *sees* the most: of the walls in reach it takes the first that watches the
   * likeliest approach, trying the ones opposite that approach first.
   *
   * With no approach in range, or no wall in reach that watches it, the
   * fallback is the pre-K4 sweep: any wall in reach, starting behind, because
   * the useful direction is then whichever one it will not be looking at.
   *
   * Throttled rather than run every step: it is a sweep of raycasts, and half
   * a second of walking is the resolution at which "a wall it passed" means
   * anything.
   *
   * @param {number} dt
   * @returns {object|null} the alarm placed, or null
   */
  _maybePlaceAlarm(dt) {
    if (!this.gadgets || this.gadgets.alarm) return null;
    if (this.gadgets.loadout.alarmCamera <= 0) return null;

    this._alarmProbeTimer -= dt;
    if (this._alarmProbeTimer > 0) return null;
    this._alarmProbeTimer = A.alarmPlacementInterval;

    const warden = this.warden;
    const origin = { x: warden.position.x, y: warden.eyeY, z: warden.position.z };
    const way = this._likeliestApproach();
    if (way) {
      // The camera faces back off its wall, so it wants the wall opposite the
      // way in. Fan out from it and take the first that watches that way.
      const base = Math.atan2(-(way.x - origin.x), -(way.z - origin.z));
      for (let i = 0; i < A.alarmPlacementProbes; i++) {
        const step = i === 0 ? 0 : (i % 2 ? (i + 1) / 2 : -i / 2);
        const angle = base + (step * TAU) / A.alarmPlacementProbes;
        const at = this.gadgets.findAlarmWall(origin, { x: -Math.sin(angle), y: 0, z: -Math.cos(angle) });
        if (at && this.gadgets.alarmCovers(at, way)) return this.gadgets.placeAlarm(at, at.yaw);
      }
    }
    for (let i = 0; i < A.alarmPlacementProbes; i++) {
      // Start behind and work around, so it covers what its back is turned on.
      const angle = warden.yaw + Math.PI + (i / A.alarmPlacementProbes) * TAU;
      const placed = this.gadgets.placeAlarmOnWall(origin, {
        x: -Math.sin(angle), y: 0, z: -Math.cos(angle),
      });
      if (placed) return placed;
    }
    return null;
  },

  /**
   * The nearest declared route's foot the camera could watch from here: within
   * its own radius, since a foot it cannot see past is no approach to prefer.
   */
  _likeliestApproach() {
    const warden = this.warden;
    let best = null;
    let bestDistance = CONFIG.gadgets.alarmCamera.radius;
    for (const route of this.map.routes) {
      const box = route.stages[0][0];
      const d = Math.hypot(box.centerX - warden.position.x, box.centerZ - warden.position.z);
      if (d <= bestDistance) {
        bestDistance = d;
        best = { x: box.centerX, y: box.top, z: box.centerZ };
      }
    }
    return best;
  },
};
