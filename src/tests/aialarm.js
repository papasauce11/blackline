/**
 * BLACKLINE - tests/aialarm.js
 *
 * AUTO suite (K4): the Warden's one camera goes up watching the way in, and a
 * trip walks it past the lens.
 *
 * The camera used to go on the first wall a sweep from behind the Warden's yaw
 * found, which is the wall it happened to be standing near. The likeliest
 * approach is a declared stairless route (`map.routes`): its first stage is
 * where her climb starts, and `systems/aialarm.js` now prefers a wall from
 * which `gadgets.alarmCovers` says that spot is watched - and falls back to
 * any wall, so the camera is never withheld. A trip used to send the Warden
 * straight to the mark; now it goes by the camera first, which is the way in
 * she used (`aiperception.js`).
 *
 *   on the way in  for each declared route the Warden is stood on the ground
 *                  within the camera's radius of its foot - the top-face
 *                  centre of `stages[0][0]` - where some wall watches it, and
 *                  put into SEARCH. The camera it hangs must cover that foot
 *                  by the camera's own trip rule. A route no wall near it
 *                  watches is named in the detail, not skipped silently.
 *   past the lens  with a camera standing, the Shade crouch-walks into the
 *                  cone through the input set until `gadget:alarm` fires. The route laid then ends at
 *                  the camera, not the mark, with `_investigateVia` set; on
 *                  arrival the via is spent and the route ends at the mark.
 *                  The Warden is put within a short walk of the lens, out of
 *                  her sight, so the arrival is about the via and not
 *                  `investigateTimeout`.
 *
 * Each map is read as the page is on it: no coordinate and no tag is named.
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { AI_STATE } from '../systems/ai.js';

const dt = CONFIG.time.fixedDt;
const GA = CONFIG.gadgets.alarmCamera;
const R = GA.radius;
const N = CONFIG.ai.alarmPlacementProbes;
const TAU = Math.PI * 2;
/** Steps given to SEARCH to hang the camera: the first tick tries, so this is generous. */
const PLACE_FRAMES = Math.round(2 / dt);
/** The Shade's torso above her feet, crouching, and the Warden's eye above its. */
const TORSO = CONFIG.shade.crouchHeight * CONFIG.detection.torsoHeightRatio;
const EYE = CONFIG.warden.standHeight * CONFIG.warden.eyeHeightRatio;
/** A floor is the camera's own when its cell is within this of the stand the camera was hung from. */
const SAME_FLOOR = 0.3;
/** The Warden's walk to the lens, metres: long enough to be a walk, short enough for `investigateTimeout` at its 3m/s with room over. */
const WALK_MIN = 5;
const WALK_MAX = 24;
/** Seconds the Shade gets to walk into the cone. */
const WALK_SECONDS = 6;

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const fresh = (h) => h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
const hide = (h) => { h.menu.hide(); h.input.clearAll(); };

/** Every declared route's foot: the top-face centre of the box her climb starts from. */
const approaches = (h) => h.map.routes.map((route) => {
  const box = route.stages[0][0];
  return { id: route.id, at: { x: box.centerX, y: box.top, z: box.centerZ } };
});

/**
 * Would a camera hung by the AI's own sweep from this stand cover `foot`? The
 * camera's rule, asked of the same eight walls in the order the AI tries them
 * (opposite the foot first): where this says no, no preference can make it yes.
 */
function watchedFrom(h, stand, foot) {
  const origin = { x: stand.x, y: stand.y + EYE, z: stand.z };
  const base = Math.atan2(-(foot.x - origin.x), -(foot.z - origin.z));
  for (let i = 0; i < N; i++) {
    const step = i === 0 ? 0 : (i % 2 ? (i + 1) / 2 : -i / 2);
    const angle = base + (step * TAU) / N;
    const at = h.gadgets.findAlarmWall(origin, { x: -Math.sin(angle), y: 0, z: -Math.cos(angle) });
    if (at && h.gadgets.alarmCovers(at, foot)) return true;
  }
  return false;
}

/**
 * Stand the Warden somewhere a wall watches this route's foot and the foot is
 * the nearest approach to it, put it into SEARCH, and let it hang its camera.
 * Returns `{ stand, tried, cam }`; `cam` is null if none stood, `stand` null
 * if no ground near the foot has a watching wall.
 */
function hangFrom(h, route, routes) {
  fresh(h);
  hide(h);
  const { wardenAI, gadgets, warden, shade } = h;
  const owns = (s) => routes.every((r) => flat(s, route.at) <= flat(s, r.at) + 1e-9);
  let stand = null;
  let tried = 0;
  for (const s of h.map.wardenGround.cellsWithin(route.at, R)) {
    if (!owns(s)) continue;
    tried++;
    if (watchedFrom(h, s, route.at)) { stand = s; break; }
  }
  if (!stand) return { stand: null, tried, cam: null };
  warden.reset({ position: stand, yaw: 0 });
  wardenAI.lastKnown = { x: shade.position.x, y: shade.feetY, z: shade.position.z };
  wardenAI._enterSearch();
  for (let f = 0; f < PLACE_FRAMES && !gadgets.alarm; f++) h.stepFrames(1);
  return { stand, tried, cam: gadgets.alarm };
}

/** Length of the Warden's walk between two foot positions, or Infinity. */
function walkLength(ground, from, to) {
  const path = ground.route(from, to);
  if (!path) return Infinity;
  let len = 0;
  let prev = from;
  for (const p of path) { len += flat(prev, p); prev = p; }
  return len;
}

/** Clause 2: trip the camera hung from `stand` and read the route laid, pushing what is wrong. */
function trip(h, stand, cam, problems) {
  const { wardenAI, gadgets, warden, shade } = h;
  const ground = h.map.wardenGround;
  const fwd = { x: -Math.sin(cam.yaw), z: -Math.cos(cam.yaw) };
  const cells = ground.cellsWithin(cam, R + 3).filter((c) => Math.abs(c.y - stand.y) < SAME_FLOOR);

  // The Shade: just outside the radius, in front of the lens, in its sight.
  const starts = cells.filter((c) => {
    const d = flat(c, cam);
    const dot = ((c.x - cam.x) * fwd.x + (c.z - cam.z) * fwd.z) / d;
    return d >= R + 0.5 && d <= R + 2.5 && dot > Math.cos(0.4)
      && h.map.collision.lineOfSight(cam, { x: c.x, y: c.y + TORSO, z: c.z });
  }).sort((a, b) => Math.abs(flat(a, cam) - (R + 1.5)) - Math.abs(flat(b, cam) - (R + 1.5)));
  if (!starts.length) { problems.push(`no ground ${R + 0.5}-${R + 2.5}m in front of the camera at (${cam.x.toFixed(1)}, ${cam.z.toFixed(1)}) sees its lens`); return; }

  // The Warden: a short walk from the lens and out of her sight all the way in, so the camera is the only thing that can tell it.
  const s = starts[0];
  const way = [0, 2, 4, 6].map((k) => {
    const t = k / flat(s, cam);
    return { x: s.x + (cam.x - s.x) * t, y: s.y + TORSO, z: s.z + (cam.z - s.z) * t };
  });
  const lens = ground.standAt({ x: cam.x, y: stand.y, z: cam.z }, { radius: 3, dy: 0.5 });
  const waits = lens ? cells.filter((c) => (
    way.every((p) => !h.map.collision.lineOfSight({ x: c.x, y: c.y + EYE, z: c.z }, p))
  )).sort((a, b) => flat(a, cam) - flat(b, cam)) : [];
  let wait = null;
  let len = 0;
  for (const c of waits) {
    len = walkLength(ground, c, lens);
    if (len >= WALK_MIN && len <= WALK_MAX) { wait = c; break; }
  }
  if (!wait) { problems.push(`no ground unseen from her walk is a ${WALK_MIN}-${WALK_MAX}m walk from the lens (${waits.length} unseen of ${cells.length})`); return; }

  let fired = false;
  const off = h.emitter.on('gadget:alarm', () => { fired = true; });
  wardenAI._enter(AI_STATE.PATROL);
  wardenAI.lastKnown = null;
  gadgets.shadeMarkedFor = 0;
  gadgets.shadeMarkedAt = null;
  warden.reset({ position: wait, yaw: 0 });
  // Standing guard until the trip: a Warden walking its circuit meanwhile is somewhere else when the camera speaks.
  wardenAI._pauseTimer = WALK_SECONDS + 1;
  shade.reset({ position: s, yaw: Math.atan2(-(cam.x - s.x), -(cam.z - s.z)) });
  h.input.heldCodes.add('KeyW');
  h.input.heldCodes.add('ControlLeft');
  for (let f = 0; f < WALK_SECONDS / dt && !fired; f++) h.stepFrames(1);
  h.input.clearAll();
  off();
  if (!fired) { problems.push(`the Shade walked ${WALK_SECONDS}s from ${flat(s, cam).toFixed(1)}m out and never tripped the camera`); return; }

  h.stepFrames(2);
  const mark = gadgets.shadeMarkedAt;
  const last = () => wardenAI._route[wardenAI._route.length - 1];
  if (wardenAI.state !== AI_STATE.INVESTIGATE) { problems.push(`a trip left the Warden in ${wardenAI.state}, want investigate`); return; }
  if (!wardenAI._investigateVia) { problems.push('the Warden went to the mark: no via was set'); return; }
  if (!last() || !mark) { problems.push('the Warden has no route laid after the trip'); return; }
  if (flat(last(), cam) >= flat(last(), mark)) {
    problems.push(`the route ends ${flat(last(), cam).toFixed(1)}m from the camera and ${flat(last(), mark).toFixed(1)}m from the mark, want the camera nearer`);
    return;
  }

  // Past the lens: arrival spends the via and the route turns to the mark.
  const limit = Math.round(CONFIG.ai.investigateTimeout / dt);
  for (let f = 0; f < limit && wardenAI._investigateVia && wardenAI.state === AI_STATE.INVESTIGATE; f++) h.stepFrames(1);
  const known = wardenAI.lastKnown;
  if (wardenAI._investigateVia) {
    problems.push(`the Warden did not reach the camera in ${CONFIG.ai.investigateTimeout}s over a ${len.toFixed(1)}m walk (state ${wardenAI.state}, ${flat(warden.position, cam).toFixed(1)}m from it)`);
  } else if (!known || !last()) {
    problems.push('arriving at the camera left the Warden with no route to the mark');
  } else if (flat(last(), known) >= flat(last(), cam)) {
    problems.push(`after the camera the route ends ${flat(last(), known).toFixed(1)}m from the mark and ${flat(last(), cam).toFixed(1)}m from the camera, want the mark nearer`);
  }
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-warden-puts-its-one-camera-on-the-way-in-and-a-trip-walks-it-past-the-lens',
    spec: 'Section 9.2 / K4',
    name: 'The Warden hangs its camera where it watches a declared route\'s foot, and a trip walks it by the camera to the mark',
    run: (h) => {
      const problems = [];
      fresh(h);
      hide(h);
      const routes = approaches(h);
      if (routes.length === 0) {
        return { pass: false, detail: 'the map declares no routes, so there is no way in to watch' };
      }

      // (1) On the way in: every route with a wall that can watch it.
      const unwatched = [];
      const watched = [];
      let first = null;
      for (const route of routes) {
        const { stand, tried, cam } = hangFrom(h, route, routes);
        const foot = `(${route.at.x.toFixed(1)}, ${route.at.z.toFixed(1)})`;
        if (!stand) {
          unwatched.push(`${route.id} ${foot} (${tried} stands tried)`);
        } else if (!cam) {
          problems.push(`route ${route.id}: no camera stood from (${stand.x.toFixed(1)}, ${stand.z.toFixed(1)}) after ${(PLACE_FRAMES * dt).toFixed(0)}s of SEARCH`);
        } else if (!h.gadgets.alarmCovers(cam, route.at)) {
          problems.push(`route ${route.id}: the camera at (${cam.x.toFixed(1)}, ${cam.z.toFixed(1)}) facing ${cam.yaw.toFixed(2)}rad does not cover its foot ${foot}, though a wall near stand ${tried} of those tried does`);
        } else {
          watched.push(route.id);
          if (!first) first = { route, stand, cam };
        }
      }
      if (watched.length === 0 && problems.length === 0) {
        problems.push(`no route on this map has a wall that watches its foot: [${unwatched.join('; ')}]`);
      }

      // (2) A trip walks it past the lens, on the first route that was watched.
      if (first) {
        const again = hangFrom(h, first.route, routes);
        if (again.cam) trip(h, again.stand, again.cam, problems);
        else problems.push('the first watched route did not hang its camera a second time');
      }

      fresh(h);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `cameras cover the feet of [${watched}]${unwatched.length ? `; no wall near [${unwatched.join('; ')}] watches it` : ''}; a trip on ${first.route.id} laid the route to the camera, then to the mark`
          : problems.join('; '),
      };
    },
  });
}
