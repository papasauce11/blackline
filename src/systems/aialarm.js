/**
 * BLACKLINE - systems/aialarm.js
 *
 * Where the Warden hangs its one alarm camera (Section 9.2, K4). The camera
 * goes over the likeliest approach: a declared stairless route (`map.routes`),
 * whose first stage is where the Shade's climb starts. `gadgets.alarmCovers`
 * is the camera's own trip rule, so the AI places it only where that rule
 * says the way in is watched. With no route in range it sweeps for any wall,
 * as it did before K4.
 *
 * Methods of `WardenAI`, installed on its prototype as ainav.js's are (F3):
 * `this` is the AI. Layering (Section 3.1): imports config and aistate.js.
 */

import { A } from './aistate.js';

const TAU = Math.PI * 2;

export const ALARM = {
  /**
   * Section 9.2: one alarm camera per round, placed on a wall.
   *
   * The Warden gets a single one, so it is spent where it earns the most —
   * standing over a charge in DEFEND, or at a spot it has just cleared in
   * SEARCH and is about to walk away from. It sweeps for a wall in reach
   * rather than firing straight ahead, because the useful direction is
   * whichever one it will not be looking at.
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
      // way in. Hang it only where it watches that way: the one camera waits
      // for the right spot, and this runs again from elsewhere in half a second.
      const base = Math.atan2(-(way.x - origin.x), -(way.z - origin.z));
      for (let i = 0; i < A.alarmPlacementProbes; i++) {
        const step = i === 0 ? 0 : (i % 2 ? (i + 1) / 2 : -i / 2);
        const angle = base + (step * TAU) / A.alarmPlacementProbes;
        const at = this.gadgets.findAlarmWall(origin, { x: -Math.sin(angle), y: 0, z: -Math.cos(angle) });
        if (at && this.gadgets.alarmCovers(at, way)) return this.gadgets.placeAlarm(at, at.yaw);
      }
      return null;
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

  /** The nearest declared route's foot in `alarmRouteRange`: the likeliest approach (K4). */
  _likeliestApproach() {
    const warden = this.warden;
    let best = null;
    let bestDistance = A.alarmRouteRange;
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
