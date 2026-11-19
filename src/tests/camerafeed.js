/**
 * BLACKLINE - tests/camerafeed.js
 *
 * AUTO suite (M5, Block M): the alarm camera's live feed. While a camera
 * stands the Warden's frame carries a small picture of what it sees, and
 * the one camera the game owns is exactly where it was after drawing it
 * (Section 15: "one camera object, reparent and adjust FOV only").
 *
 * Two checks, because the done-when has two halves:
 *
 *   the-wardens-hud-carries-a-live-feed-from-its-camera-and-gives-the-one-camera-back
 *     (a) the picture is there: the panel's pixels spread over a luma range, a
 *         flat panel being a feed that rendered nothing;
 *     (b) the borrow is clean: parent, world position, world rotation, field of
 *         view, aspect, planes and layer mask are identical across a frame that
 *         rendered a feed - and across one whose render threw;
 *     (c) the camera destroyed by the Shade's taser, the panel is dark and the
 *         feed's render count **stops**, counted and not read off a pixel, and
 *         the HUD's frame says so;
 *     (d) the Shade never sees it: the same camera standing under the Shade's
 *         frame draws nothing and renders nothing.
 *
 *   the-alarm-feed-adds-no-more-than-its-budget-to-a-frame
 *     the same pose drawn with the feed up and with it held off (a panel over
 *     the picture holds it dark), counted in draw calls and triangles.
 *
 * **The budget is counted and not timed.** H36 and H41 settled that no wall
 * clock in this page prices a draw - a queued frame submits in milliseconds and
 * lands in hundreds - so a frame budget asserted on `performance.now()` is a
 * green that says nothing, and `timedrenders.js` keeps a census of every check
 * that takes one. This one takes none, and so is not in it: what a renderer can
 * answer exactly is `info.render.calls` and `.triangles`, which is the same
 * currency `each-quality-preset-changes-what-a-frame-costs` spends. The ceiling
 * is `cameraFeed.budgetShare` of the frame's own, and config.js has its parent.
 *
 * **Floors.** The spread floor in (a) is `SPREAD_MIN`: it is **not measured**
 * and it is low on purpose - a dark map's wall at six metres is dim, and what
 * has to be told apart is a picture from a flat fill, which has a spread of 0.
 * `npm run probe` on both maps would put a measured number in its place.
 *
 * Whether the picture reads, and where it sits, stay HUMAN. Registered from
 * tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import * as THREE from 'three';
import { CONFIG, DEFAULT_BINDINGS } from '../config.js';
import { gatherHudState } from '../hudstate.js';
import { createLens, difference, scaledCount } from './pixels.js';

const F = CONFIG.gadgets.alarmCamera.cameraFeed;
const W = CONFIG.warden;
const SEED = 20261119;
const PLACE = DEFAULT_BINDINGS.gadget3[0];

/** Metres from the wall the Warden stands, inside `placeRange`, and the clear air the camera must have in front of it. */
const STAND = 2;
const CLEAR = 6;
/** Fixed steps a placed body takes to land on its floor. */
const SETTLE = 12;
/** Luma (0-255) from the 5th to the 95th percentile of the panel that makes it a picture. Not measured; a flat fill reads 0. */
const SPREAD_MIN = 6;
/** The dead panel is the config's near-black; this much above it is still dark, and its spread is at most `FLAT`. */
const DARK_MAX = 12;
const FLAT = 2;
/** Pixels of the panel's edge left out of every reading: the frame lies there. */
const INSET = 4;
/** Frames of each kind the budget is read over, and the slop on a pixel count in the Shade's case. */
const FRAMES = 8;
const SLOP = 12;

/** A pose is the same to this much: nothing in a borrow should move it at all. */
const SAME = 1e-9;

const press = (h, code) => {
  h.input.pressedCodes.add(code);
  h.stepFrames(1);
  h.input.pressedCodes.delete(code);
};

/** A wall with `CLEAR` metres of air in front of it and floor to stand on `STAND` metres out, off a waypoint. */
function findWall(h) {
  const half = { x: W.radius, y: W.standHeight / 2, z: W.radius };
  const ground = h.map.wardenGround;
  for (const node of h.map.waypoints) {
    const eyeY = node.position.y + W.standHeight * W.eyeHeightRatio;
    for (let i = 0; i < 32; i++) {
      const angle = (i / 32) * Math.PI * 2;
      const hit = h.map.collision.raycast(
        { x: node.position.x, y: eyeY, z: node.position.z },
        { x: Math.sin(angle), y: 0, z: Math.cos(angle) }, 14
      );
      if (!hit || Math.abs(hit.ny) >= 0.5) continue;
      if (h.map.collision.raycast({ x: hit.x, y: hit.y, z: hit.z }, { x: hit.nx, y: 0, z: hit.nz }, CLEAR + 0.5)) continue;
      const stand = { x: hit.x + hit.nx * STAND, y: node.position.y, z: hit.z + hit.nz * STAND };
      const clear = h.map.collision.isClear({ x: stand.x, y: stand.y + half.y + 0.05, z: stand.z }, half);
      if (clear && (!ground || ground.has(stand, W.stepHeight))) return { hit, stand };
    }
  }
  return null;
}

/** The Warden's round, the human driving it, no AI and no objective so nothing else moves. */
function openWarden(h) {
  h.initMatch({ mode: 'competitive', role: 'warden', ai: false, objective: false, seed: SEED });
  h.menu.hide();
  h.briefing.hide();
  h.input.clearAll();
}

/** Stand the Warden before the wall facing it and hang the camera with the key a player presses. */
function hang(h, wall) {
  const yaw = Math.atan2(wall.hit.nx, wall.hit.nz);
  h.warden.reset({ position: wall.stand, yaw });
  h.detection.reset(h.shade);
  h.stepFrames(SETTLE);
  press(h, PLACE);
  h.stepFrames(1);
  return h.gadgets.alarm ? { ...h.gadgets.alarm } : null;
}

/** The panel in a read-back frame's own rows (which count from the bottom), inset from its edge. */
function panel(lens) {
  const width = F.widthShare * lens.width;
  const height = (width * F.height) / F.width;
  const left = F.anchor.x * lens.width;
  const top = F.anchor.y * lens.height;
  return {
    x0: Math.ceil(left) + INSET, x1: Math.floor(left + width) - INSET,
    y0: lens.height - Math.floor(top + height) + INSET, y1: lens.height - Math.ceil(top) - INSET,
  };
}

function lumas(frame, lens, rect) {
  const out = [];
  for (let y = rect.y0; y <= rect.y1; y++) {
    for (let x = rect.x0; x <= rect.x1; x++) {
      const i = (y * lens.width + x) * 4;
      out.push(0.2126 * frame[i] + 0.7152 * frame[i + 1] + 0.0722 * frame[i + 2]);
    }
  }
  return out.sort((a, b) => a - b);
}

/** The panel's reading: its 5th-95th percentile spread, its brightest pixel and its mean. */
function reading(frame, lens) {
  const sorted = lumas(frame, lens, panel(lens));
  const at = (share) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))];
  return {
    spread: at(0.95) - at(0.05), max: sorted[sorted.length - 1],
    mean: sorted.reduce((a, b) => a + b, 0) / sorted.length, count: sorted.length,
  };
}

/** Everything about the one camera a borrow could leave moved. */
function snapshot(h) {
  const camera = h.camera;
  const position = camera.getWorldPosition(new THREE.Vector3());
  const rotation = camera.getWorldQuaternion(new THREE.Quaternion());
  return {
    parent: camera.parent,
    world: [position.x, position.y, position.z, rotation.x, rotation.y, rotation.z, rotation.w],
    local: [...camera.position.toArray(), ...camera.quaternion.toArray()],
    lens: [camera.fov, camera.aspect, camera.near, camera.far],
    mask: camera.layers.mask,
    shadows: h.renderer.shadowMap.autoUpdate,
    autoClear: h.renderer.autoClear,
    target: h.renderer.getRenderTarget(),
  };
}

/** What differs between two snapshots, as words, or an empty list. */
function moved(before, after, { mask = true } = {}) {
  const out = [];
  if (before.parent !== after.parent) out.push('its parent');
  const worse = (a, b) => a.some((value, i) => !(Math.abs(value - b[i]) <= SAME));
  if (worse(before.world, after.world)) out.push('its world pose');
  if (worse(before.local, after.local)) out.push('its local pose');
  if (worse(before.lens, after.lens)) out.push('its fov, aspect or planes');
  if (mask && before.mask !== after.mask) out.push('its layer mask');
  if (before.shadows !== after.shadows) out.push('the renderer\'s shadow update');
  if (before.autoClear !== after.autoClear) out.push('the renderer\'s autoClear');
  if (before.target !== after.target) out.push('the renderer\'s target');
  return out;
}

/** The HUD's reading of the feed's frame: its display and whether it says the signal is gone. */
function frameOf(h) {
  h.hud.setVisible(true);
  h.hud.update(0, gatherHudState({
    match: h.match, shade: h.shade, warden: h.warden, gadgets: h.gadgets, detection: h.detection,
    combat: h.combat, objective: h.objective, post: h.post,
  }));
  const el = h.hud.root.querySelector('#bl-camfeed');
  return { display: el.style.display, dead: el.classList.contains('dead') };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-wardens-hud-carries-a-live-feed-from-its-camera-and-gives-the-one-camera-back',
    spec: 'Section 9.2 / M5',
    name: 'With a camera placed the Warden\'s frame carries a picture in its panel; the one camera is exactly where it was after a frame that drew the feed and after one whose render threw; once a taser has destroyed the camera the panel is dark and the feed\'s renders stop; and the Shade, with the same camera standing, sees no panel and no render',
    run: (h) => {
      const problems = [];
      const notes = [];
      const wall = findWall(h);
      if (!wall) return { pass: false, detail: `no wall on ${h.map.id} with ${CLEAR}m of air in front of it and floor ${STAND}m out to stand on` };
      let lens = null;
      try {
        openWarden(h);
        const placed = hang(h, wall);
        if (!placed) return { pass: false, detail: 'pressing the gadget 3 key at a wall in reach hung no camera' };
        h.renderFrame();
        const feed = h.post.feed;
        if (!feed) return { pass: false, detail: 'the post has no feed: boot.js did not hand it one' };
        if (feed.state !== 'live') problems.push(`a camera stands under the Warden and the feed says "${feed.state}"`);

        // (b) the borrow, on the rig's own camera: a frame, not a lens. The
        // camera hangs on the Warden's rig here, which is the case a re-parent
        // can get wrong.
        if (h.camera.parent === h.scene) problems.push('(b) the camera is already on the scene, so a borrow could not be seen to put it back');
        const before = snapshot(h);
        const rendersBefore = feed.renders;
        h.post.render(h.scene, h.camera);
        const after = snapshot(h);
        if (feed.renders !== rendersBefore + 1) problems.push(`(b) a frame rendered the feed ${feed.renders - rendersBefore} times, not once, so nothing was borrowed to be given back`);
        const drifted = moved(before, after);
        if (drifted.length) problems.push(`(b) after a frame that drew the feed the one camera has moved ${drifted.join(', ')}`);
        if (h.camera.parent !== before.parent) problems.push('(b) the camera is on another parent after the frame');

        // And a render that throws mid-borrow: the feed's own target is the
        // only 256x144 one there is, so the throw is the feed's and nothing
        // else's.
        const render = h.renderer.render;
        let thrown = false;
        h.renderer.render = function patched(...args) {
          const target = h.renderer.getRenderTarget();
          if (target && target.width === F.width && target.height === F.height) throw new Error('camerafeed check: a render that fails');
          return render.apply(this, args);
        };
        const beforeThrow = snapshot(h);
        try {
          h.post.render(h.scene, h.camera);
        } catch (error) {
          thrown = true;
        } finally {
          // Restore by assignment: three assigns `render` as an OWN property in the
          // constructor, so `delete` leaves nothing on the prototype and every later
          // call in the run throws "renderer.render is not a function".
          h.renderer.render = render;
        }
        const afterThrow = snapshot(h);
        if (!thrown) problems.push('(b) the render this check made fail did not reach the feed, so the restore was not tried');
        // The mask is post.js's to put back and a throw skips that line, so it is not asked of a throw.
        const driftedThrow = moved(beforeThrow, afterThrow, { mask: false });
        if (driftedThrow.length) problems.push(`(b) after a feed render that threw the one camera has moved ${driftedThrow.join(', ')}`);
        notes.push(`(b) the camera on ${before.parent === h.scene ? 'the scene' : 'its rig'} came back across a frame${thrown ? ' and across a throw' : ''}`);

        // (a) the picture, through a lens read back with the rest of the canvas.
        lens = createLens(h);
        const eye = { x: wall.stand.x, y: wall.stand.y + W.standHeight * W.eyeHeightRatio, z: wall.stand.z };
        lens.look(eye, { x: eye.x - wall.hit.nx, y: eye.y, z: eye.z - wall.hit.nz });
        const grabs = feed.renders;
        const live = reading(lens.grab(), lens);
        if (feed.renders !== grabs + 1) problems.push(`(a) a frame drawn with a camera standing rendered the feed ${feed.renders - grabs} times`);
        if (!(live.spread >= SPREAD_MIN)) problems.push(`(a) the feed carried no picture: its panel spans ${live.spread.toFixed(1)} luma over ${live.count} pixels, want at least ${SPREAD_MIN}`);
        const frame = frameOf(h);
        if (frame.display !== 'block' || frame.dead) problems.push(`(a) the HUD's frame for a live feed reads display "${frame.display}", dead ${frame.dead}`);
        notes.push(`(a) panel spread ${live.spread.toFixed(1)} luma, mean ${live.mean.toFixed(1)}, max ${live.max.toFixed(0)} (floor ${SPREAD_MIN}) over ${live.count} px`);

        // (c) the Shade's taser, the way the game fires it, down the line to the lens.
        const stand = wall.stand;
        h.shade.reset({ position: { x: stand.x + wall.hit.nx * 0.5, y: stand.y, z: stand.z + wall.hit.nz * 0.5 }, yaw: 0 });
        const from = { x: h.shade.position.x, y: h.shade.feetY + h.shade.height * CONFIG.detection.torsoHeightRatio, z: h.shade.position.z };
        const length = Math.hypot(placed.x - from.x, placed.y - from.y, placed.z - from.z);
        const killed = h.gadgets.fireTaser(h.shade, null, {
          x: (placed.x - from.x) / length, y: (placed.y - from.y) / length, z: (placed.z - from.z) / length,
        });
        if (killed !== 'alarm') problems.push(`(c) the taser fired down the line to the camera hit "${killed}"`);
        h.stepFrames(1);
        if (h.gadgets.alarm) problems.push('(c) the camera still stands after the taser');
        const stopped = feed.renders;
        const dark = reading(lens.grab(), lens);
        lens.grab();
        lens.grab();
        if (feed.renders !== stopped) problems.push(`(c) the feed rendered ${feed.renders - stopped} more times after the camera was destroyed`);
        if (feed.state !== 'dead') problems.push(`(c) a destroyed camera leaves the feed "${feed.state}", not "dead"`);
        if (!(dark.max <= DARK_MAX) || !(dark.spread <= FLAT)) problems.push(`(c) the panel is not dark: brightest ${dark.max.toFixed(1)} (limit ${DARK_MAX}), spread ${dark.spread.toFixed(1)} (limit ${FLAT})`);
        const gone = frameOf(h);
        if (gone.display !== 'block' || !gone.dead) problems.push(`(c) the HUD's frame for a dead feed reads display "${gone.display}", dead ${gone.dead}`);
        notes.push(`(c) taser hit ${killed}; renders stopped at ${stopped}; panel brightest ${dark.max.toFixed(1)}, spread ${dark.spread.toFixed(1)}`);
        lens.restore();
        lens = null;

        // (d) the Shade, with the same camera on the same wall.
        h.initMatch({ mode: 'competitive', role: 'shade', ai: false, objective: false, seed: SEED });
        h.menu.hide();
        h.briefing.hide();
        h.input.clearAll();
        h.gadgets.placeAlarm(placed, placed.yaw);
        h.stepFrames(SETTLE);
        h.renderFrame();
        lens = createLens(h);
        // Looking away from the wall, so the fixture is behind the eye in both frames.
        const away = { x: eye.x + wall.hit.nx * STAND, y: eye.y, z: eye.z + wall.hit.nz * STAND };
        lens.look(eye, away);
        const seen = h.post.feed.renders;
        const shadeWith = lens.grab();
        lens.grab();
        const slop = scaledCount(lens, SLOP);
        if (h.post.feed.renders !== seen) problems.push(`(d) the Shade's frame rendered the feed ${h.post.feed.renders - seen} times`);
        if (h.post.feed.state !== 'none') problems.push(`(d) the feed's state under the Shade is "${h.post.feed.state}"`);
        const shadeFrame = frameOf(h);
        if (shadeFrame.display !== 'none') problems.push(`(d) the HUD shows the feed's frame to the Shade (${shadeFrame.display})`);
        h.gadgets.destroyAlarm('test');
        h.stepFrames(1);
        const shadeWithout = lens.grab();
        const rect = panel(lens);
        const mask = difference(shadeWith, shadeWithout, lens.width, lens.height).mask;
        let inPanel = 0;
        for (let y = rect.y0; y <= rect.y1; y++) for (let x = rect.x0; x <= rect.x1; x++) if (mask[y * lens.width + x]) inPanel++;
        if (inPanel > slop) problems.push(`(d) with a camera standing the Shade's panel region differs from the frame with none by ${inPanel} pixels (slop ${slop})`);
        notes.push(`(d) Shade: state ${h.post.feed.state}, ${inPanel} px differ in the panel with and without the camera`);
        if (lens.glError() !== 0) problems.push('GL error in the reads');
      } finally {
        if (lens) lens.restore();
        h.menu.hide();
        h.briefing.hide();
        h.input.clearAll();
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      }
      return {
        pass: problems.length === 0,
        detail: `${problems.length ? `${problems.join('; ')} [` : ''}${notes.join('; ')}${problems.length ? ']' : ''}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-alarm-feed-adds-no-more-than-its-budget-to-a-frame',
    spec: 'Section 15 / M5',
    name: 'The same Warden frame drawn with the feed up and with it held dark behind a panel adds at least one draw and at most the budget\'s share of the frame\'s own draw calls and triangles, the same every frame, and renders the world once a frame and never behind the panel',
    run: (h) => {
      const problems = [];
      const wall = findWall(h);
      if (!wall) return { pass: false, detail: `no wall on ${h.map.id} with ${CLEAR}m of air in front of it and floor ${STAND}m out to stand on` };
      let detail = '';
      try {
        openWarden(h);
        if (!hang(h, wall)) return { pass: false, detail: 'pressing the gadget 3 key at a wall in reach hung no camera' };
        // Turned round to face what the lens faces: a frame looking at a wall a
        // body's length off draws almost nothing, and the lens is looking into the room.
        h.warden.reset({ position: wall.stand, yaw: Math.atan2(wall.hit.nx, wall.hit.nz) + Math.PI });
        h.stepFrames(SETTLE);
        h.renderFrame();
        const feed = h.post.feed;
        const info = h.renderer.info.render;
        // Drawn through the post as the frame draws, with no step between: the
        // two kinds of frame differ by the feed and by nothing the world did.
        const draw = () => {
          const renders = feed.renders;
          h.post.render(h.scene, h.camera);
          return { calls: info.calls, triangles: info.triangles, renders: feed.renders - renders };
        };
        draw();
        const on = Array.from({ length: FRAMES }, draw);
        h.menu.show('pause');
        draw();
        const off = Array.from({ length: FRAMES }, draw);
        h.menu.hide();
        const steady = (frames, key) => frames.every((frame) => frame[key] === frames[0][key]);
        for (const [what, frames] of [['up', on], ['held dark', off]]) {
          for (const key of ['calls', 'triangles']) {
            if (!steady(frames, key)) problems.push(`the same frame cost ${[...new Set(frames.map((f) => f[key]))].join(' then ')} ${key} with the feed ${what}`);
          }
        }
        if (!on.every((frame) => frame.renders === 1)) problems.push(`the feed rendered the world ${on.map((f) => f.renders).join(',')} times in ${FRAMES} frames, once each expected`);
        if (!off.every((frame) => frame.renders === 0)) problems.push(`the feed rendered behind the pause page (${off.map((f) => f.renders).join(',')})`);
        const added = { calls: on[0].calls - off[0].calls, triangles: on[0].triangles - off[0].triangles };
        const room = {
          calls: Math.floor(F.budgetShare * off[0].calls),
          triangles: Math.floor(F.budgetShare * off[0].triangles),
        };
        if (added.calls < 1) problems.push(`the feed added ${added.calls} draw calls, so the frame drew no picture`);
        if (added.calls > room.calls) problems.push(`the feed added ${added.calls} draw calls to a frame of ${off[0].calls}, over its ${F.budgetShare} share (${room.calls})`);
        if (added.triangles > room.triangles) problems.push(`the feed added ${added.triangles} triangles to a frame of ${off[0].triangles}, over its ${F.budgetShare} share (${room.triangles})`);
        detail = `frame ${off[0].calls} calls ${off[0].triangles} triangles; the feed adds ${added.calls} calls and ${added.triangles} triangles `
          + `(budget ${F.budgetShare} of the frame: ${room.calls} and ${room.triangles}, from the check-29 median 3.10ms against its ${(CONFIG.performance.frameBudgetMs * CONFIG.performance.cpuBudgetFraction).toFixed(2)}ms ceiling)`;
      } finally {
        h.menu.hide();
        h.input.clearAll();
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      }
      return { pass: problems.length === 0, detail: problems.length ? `${problems.join('; ')} [${detail}]` : detail };
    },
  });
}
