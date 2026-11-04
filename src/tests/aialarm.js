/**
 * BLACKLINE - tests/aialarm.js
 *
 * AUTO suite (K4): the Warden's one camera goes up watching the way in, and a
 * trip walks it past the lens.
 *
 * The camera used to go on the first wall a sweep from behind the Warden's yaw
 * found, which is the wall it happened to be standing near. The likeliest
 * approach is a declared stairless route (`map.routes`): its first stage is
 * where her climb starts, and `systems/ai.js` now hangs the camera only where
 * `gadgets.alarmCovers` says that spot is watched. And a trip used to send the
 * Warden straight to the mark; now it goes by the camera first, which is the
 * way in she used (`aiperception.js`).
 *
 *   on the way in  the AI is driven into SEARCH, where it places its camera;
 *                  the camera must cover the approach point of a declared
 *                  route - the top-face centre of `stages[0][0]` - by the
 *                  camera's own trip rule, not by a rule the check rewrote.
 *   past the lens  the Shade crouch-walks into its cone through the input set
 *                  until `gadget:alarm` fires. The route laid then ends nearer
 *                  the camera than the mark, with `_investigateVia` set; once
 *                  the Warden arrives there the via is spent and the route
 *                  ends at the mark.
 *
 * Each map is read as the page is on it: no coordinate and no tag is named.
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { AI_STATE } from '../systems/ai.js';

const dt = CONFIG.time.fixedDt;
const C = CONFIG.gadgets.alarmCamera;
/** Seconds of SEARCH a Warden gets, from each spawn in turn, to hang its camera. */
const PLACE_SECONDS = 20;
/** Metres in front of the camera the Shade is stood to start, widest first: a wall in the way tries the next. */
const STARTS = [C.radius + 1, C.radius - 1, 5, 3];
/** Seconds the Shade gets to walk into the cone from one start. */
const WALK_SECONDS = 4;

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const fresh = (h) => h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });

/** Every declared route's approach point: the top-face centre of the box her climb starts from. */
const approaches = (h) => h.map.routes.map((route) => {
  const box = route.stages[0][0];
  return { id: route.id, at: { x: box.centerX, y: box.top, z: box.centerZ } };
});

/** Drive the Warden into SEARCH from each spawn until its camera stands. Returns the camera or null. */
function hangCamera(h) {
  const { wardenAI, gadgets, warden, shade } = h;
  for (const spawn of h.map.wardenSpawns) {
    warden.reset(spawn);
    wardenAI.lastKnown = { x: shade.position.x, y: shade.feetY, z: shade.position.z };
    wardenAI._enterSearch();
    for (let f = 0; f < PLACE_SECONDS / dt && !gadgets.alarm; f++) h.stepFrames(1);
    if (gadgets.alarm) return gadgets.alarm;
  }
  return null;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-warden-puts-its-one-camera-on-the-way-in-and-a-trip-walks-it-past-the-lens',
    spec: 'Section 9.2 / K4',
    name: 'The Warden hangs its camera where it watches a declared route\'s foot, and a trip walks it by the camera to the mark',
    run: (h) => {
      const problems = [];
      fresh(h);
      h.menu.hide();
      h.input.clearAll();
      const routes = approaches(h);
      if (routes.length === 0) {
        return { pass: false, detail: 'the map declares no routes, so there is no way in to watch' };
      }

      // (1) On the way in.
      const { wardenAI, gadgets, warden, shade } = h;
      const cam = hangCamera(h);
      if (!cam) {
        fresh(h);
        return { pass: false, detail: `no camera stood after ${PLACE_SECONDS}s of SEARCH from each of ${h.map.wardenSpawns.length} spawns` };
      }
      const watched = routes.filter((r) => gadgets.alarmCovers(cam, r.at));
      if (watched.length === 0) {
        problems.push(`the camera at (${cam.x.toFixed(1)}, ${cam.z.toFixed(1)}) faces ${cam.yaw.toFixed(2)}rad and covers no approach of [${routes.map((r) => r.id)}]`);
      }

      // (2) Trip it. Crouch-walking is silent, so any reaction is the camera's.
      let fired = false;
      const off = h.emitter.on('gadget:alarm', () => { fired = true; });
      const front = { x: -Math.sin(cam.yaw), z: -Math.cos(cam.yaw) };
      const far = h.map.wardenSpawns.reduce((best, spawn) => (
        flat(spawn.position, cam) > flat(best.position, cam) ? spawn : best
      ), h.map.wardenSpawns[0]);
      let start = 0;
      for (const d of STARTS) {
        // Out of the Warden's sight, so the camera is the only thing that can tell it.
        wardenAI._enter(AI_STATE.PATROL);
        wardenAI.lastKnown = null;
        gadgets.shadeMarkedFor = 0;
        gadgets.shadeMarkedAt = null;
        warden.reset(far);
        shade.reset({ position: { x: cam.x + front.x * d, y: cam.y - 1.0, z: cam.z + front.z * d }, yaw: cam.yaw + Math.PI });
        h.input.heldCodes.add('KeyW');
        h.input.heldCodes.add('ControlLeft');
        for (let f = 0; f < WALK_SECONDS / dt && !fired; f++) h.stepFrames(1);
        if (fired) { start = d; break; }
      }
      h.input.clearAll();
      off();
      if (!fired) {
        problems.push(`the Shade never tripped the camera walking in from ${STARTS.join('/')}m`);
      } else {
        h.stepFrames(2);
        const mark = gadgets.shadeMarkedAt;
        const last = () => wardenAI._route[wardenAI._route.length - 1];
        if (wardenAI.state !== AI_STATE.INVESTIGATE) {
          problems.push(`a trip left the Warden in ${wardenAI.state}, want investigate`);
        } else if (!wardenAI._investigateVia) {
          problems.push('the Warden went to the mark: no via was set');
        } else if (!last() || !mark) {
          problems.push('the Warden has no route laid after the trip');
        } else if (flat(last(), cam) >= flat(last(), mark)) {
          problems.push(`the route ends ${flat(last(), cam).toFixed(1)}m from the camera and ${flat(last(), mark).toFixed(1)}m from the mark, want the camera nearer`);
        } else {
          // (3) Past the lens: arrival spends the via and heads for the mark.
          const arriveLimit = CONFIG.ai.investigateTimeout / dt;
          for (let f = 0; f < arriveLimit && wardenAI._investigateVia && wardenAI.state === AI_STATE.INVESTIGATE; f++) h.stepFrames(1);
          const known = wardenAI.lastKnown;
          if (wardenAI._investigateVia) {
            problems.push(`the Warden never reached the camera in ${CONFIG.ai.investigateTimeout}s (state ${wardenAI.state})`);
          } else if (!known || !last()) {
            problems.push('arriving at the camera left the Warden with no route to the mark');
          } else if (flat(last(), known) >= flat(last(), cam)) {
            problems.push(`after the camera the route ends ${flat(last(), known).toFixed(1)}m from the mark and ${flat(last(), cam).toFixed(1)}m from the camera, want the mark nearer`);
          }
        }
      }

      fresh(h);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `camera at (${cam.x.toFixed(1)}, ${cam.z.toFixed(1)}) covers route ${watched.map((r) => r.id).join('/')} of [${routes.map((r) => r.id)}]; tripped walking in from ${start}m, the route laid to the camera, then to the mark`
          : problems.join('; '),
      };
    },
  });
}
