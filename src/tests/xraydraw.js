/**
 * BLACKLINE - tests/xraydraw.js
 *
 * AUTO suite (M3, Block M): the x-ray, drawn. `X` puts a flat orange
 * silhouette of the Warden on the Shade's frame wherever the rule (mapxray.js,
 * M2) says her eye looks through to it, within `shade.xray.range`; behind a
 * crate it is there, behind a wall it is not. M2's check holds the rule on the
 * built map; this one holds what is drawn from it, in pixels.
 *
 * **Every clause is relative: the same staged frame, photographed with the
 * x-ray off and on.** No luma floor anywhere. The Warden is placed on one side
 * of a solid and the Shade's eye on the other, the lens put at her eye, and
 *
 *   - (a) behind a thin solid M2 names (a crate, a duct or a container), in
 *     range, the Warden hidden from the eye: the rule says see-through and a
 *     good part of the pixels in the Warden's projected rectangle change;
 *   - (b) behind a wall the rule refuses (a room wall or the shell; on the yard
 *     a ring container), in range: the rule refuses all three points, and no
 *     pixel of the frame changes beyond what two frames with the x-ray off
 *     differ by;
 *   - (c) past the range behind a thin solid the rule would look through: the
 *     rule says yes, the distance says no, and nothing changes;
 *   - (d) draw calls: with it off the count is the baseline's exactly, before
 *     the x-ray was ever on and after; on, it adds no more than the
 *     silhouettes' meshes, and at least one;
 *   - (e) it is on only when asked: a second press, the pause page, the
 *     briefing and a new round show none, night vision on turns it off and the
 *     reverse, and the HUD tags it while it is on;
 *   - (f) it costs the Shade nothing: 180 steps of the meter, the Warden's
 *     accumulator, her health and the seeded stream, the same on and off.
 *
 * The staging finds its solids by M2's tags (the rule reads none, this check
 * names its subjects) and its places by the map's floor, so the answer is the
 * same on every run of a map. Whether the silhouette reads, and its colour,
 * stay HUMAN.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import * as THREE from 'three';
import { CONFIG, DEFAULT_BINDINGS } from '../config.js';
import { gatherHudState } from '../hudstate.js';
import { alongLane, litLane } from './lanes.js';
import { createLens, difference, scaledCount } from './pixels.js';
import { SUBJECTS } from './xray.js';

const S = CONFIG.shade;
const W = CONFIG.warden;
const RANGE = S.xray.range;
const KEY = DEFAULT_BINDINGS.xray[0];
const KEY_NIGHT = DEFAULT_BINDINGS.nightVision[0];

/**
 * The share of the Warden's projected rectangle (its height by a body's width)
 * that has to change with the x-ray on, when it is hidden. The silhouette is a
 * body and not a block - head, shoulders, legs and gaps - so the floor is well
 * under what a body fills and well over the speckle of a stray pixel.
 */
const COVER_MIN = 0.2;

/** A body's width as the rectangle takes it, in metres: shoulders and the weapon held across. */
const BODY_WIDTH = 0.9;

/** The pixels a "no change" frame may differ by, over the frame's own step-to-step noise, as a reference-buffer count (`scaledCount`). */
const SLOP = 12;

/** Metres of solid a sightline must cross for the pose to be "through" something and not past it. */
const CROSSED = 0.3;

/** Fixed steps a placed body takes to land on its floor and its pose settle. */
const SETTLE = 12;

const SEED = 20261119;
const WINDOW = 180;
const LANE = { length: 6, stands: [0, 3, 6] };

const press = (h, code = KEY) => {
  h.input.pressedCodes.add(code);
  h.stepFrames(1);
  h.input.pressedCodes.delete(code);
};

function openRound(h) {
  h.initMatch({ mode: 'competitive', role: 'shade', ai: false, objective: false, seed: SEED });
  h.menu.hide();
  h.briefing.hide();
  h.input.clearAll();
}

/** The eye the x-ray looks from, as the module has it. */
const eyeOf = (feet) => ({ x: feet.x, y: feet.y + S.standHeight * S.eyeHeightRatio, z: feet.z });

/** The Warden's three points the rule is asked of, as the module has them. */
const bodyPoints = (feet) => [W.eyeHeightRatio, 0.72, 0.5].map((share) => ({ x: feet.x, y: feet.y + share * W.standHeight, z: feet.z }));

/** The rule's answers to the three points from an eye, and whether the eye can see the chest at all. */
function readings(h, shadeFeet, wardenFeet) {
  const eye = eyeOf(shadeFeet);
  const points = bodyPoints(wardenFeet);
  const along = points.map((p) => h.map.seeThroughAlong(eye, p));
  return {
    rule: along.map((g) => g.seeThrough),
    // Looked through a solid, not along open air: some point is seen at a cost of more than a hand's width.
    crossed: along.some((g) => g.seeThrough && g.thickness > CROSSED),
    hidden: !h.map.collision.lineOfSight(eye, points[1]),
    near: Math.min(...points.map((p) => Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z))),
  };
}

/**
 * Where a Shade can stand `near` metres before a box and a Warden `far` metres
 * behind it, along its short axis, both on floor with room for a body, in the
 * order the boxes and distances come. `want` says which of them will do.
 */
function stage(h, boxes, nears, fars, want) {
  const ground = h.map.wardenGround;
  const half = { x: W.radius, y: W.standHeight / 2, z: W.radius };
  const standable = (p) => (!ground || ground.has(p, W.stepHeight))
    && h.map.collision.isClear({ x: p.x, y: p.y + half.y + 0.05, z: p.z }, half);
  for (const box of boxes) {
    const axis = box.max.x - box.min.x <= box.max.z - box.min.z ? 'x' : 'z';
    const other = axis === 'x' ? 'z' : 'x';
    const mid = (box.min[other] + box.max[other]) / 2;
    for (const sign of [1, -1]) {
      for (const near of nears) {
        for (const far of fars) {
          const at = (along) => ({ x: 0, y: box.min.y, z: 0, [axis]: along, [other]: mid });
          const shade = at(sign > 0 ? box.min[axis] - near : box.max[axis] + near);
          const warden = at(sign > 0 ? box.max[axis] + far : box.min[axis] - far);
          if (!standable(shade) || !standable(warden)) continue;
          const seen = readings(h, shade, warden);
          if (want(seen)) return { box, shade, warden, ...seen };
        }
      }
    }
  }
  return null;
}

/** Put the two bodies where a staging says, facing each other, and let them land. */
function place(h, at) {
  const yaw = Math.atan2(at.warden.x - at.shade.x, at.warden.z - at.shade.z) + Math.PI;
  h.shade.reset({ position: at.shade, yaw });
  h.warden.reset({ position: at.warden, yaw: yaw + Math.PI });
  h.detection.reset(h.shade);
  h.stepFrames(SETTLE);
}

/** The Warden's projected rectangle in the lens's buffer: the feet to the crown, a body's width, from the camera that is looking. */
function rectangle(h, lens) {
  const feet = h.warden.position;
  const base = new THREE.Vector3(feet.x, h.warden.feetY, feet.z);
  const crown = new THREE.Vector3(feet.x, h.warden.feetY + W.standHeight, feet.z);
  const toPixel = (v) => {
    const p = v.clone().project(h.camera);
    return { x: ((p.x + 1) / 2) * lens.width, y: ((1 - p.y) / 2) * lens.height };
  };
  const a = toPixel(base);
  const b = toPixel(crown);
  const depth = Math.hypot(h.camera.position.x - feet.x, h.camera.position.z - feet.z);
  const perMetre = (lens.height / 2) / (Math.tan((h.camera.fov * Math.PI) / 360) * depth);
  const half = (BODY_WIDTH / 2) * perMetre;
  return {
    x0: Math.max(0, Math.floor(a.x - half)), x1: Math.min(lens.width - 1, Math.ceil(a.x + half)),
    y0: Math.max(0, Math.floor(Math.min(a.y, b.y))), y1: Math.min(lens.height - 1, Math.ceil(Math.max(a.y, b.y))),
  };
}

/** Changed pixels of a difference mask inside a rectangle. */
function within(mask, width, rect) {
  let count = 0;
  for (let y = rect.y0; y <= rect.y1; y++) {
    for (let x = rect.x0; x <= rect.x1; x++) if (mask[y * width + x]) count++;
  }
  return count;
}

/**
 * One staged pose photographed three ways: x-ray off, off again a step later
 * (the frame's own noise), and on. The key is pressed, so the state is the
 * player's route to it; the x-ray is left ON, and the lens is the caller's.
 */
function photograph(h, lens, at) {
  const eye = eyeOf(at.shade);
  const chest = bodyPoints(at.warden)[1];
  // Her body is shown again by every reset, and the lens is at her eye.
  h.shade.mesh.visible = false;
  h.shade.groundBlob.visible = false;
  lens.look(eye, chest);
  const off = lens.grab();
  const calls = h.renderer.info.render.calls;
  h.stepFrames(1);
  h.shade.mesh.visible = false;
  h.shade.groundBlob.visible = false;
  const again = lens.grab();
  const callsAgain = h.renderer.info.render.calls;
  press(h);
  h.shade.mesh.visible = false;
  h.shade.groundBlob.visible = false;
  const on = lens.grab();
  const onCalls = h.renderer.info.render.calls;
  const rect = rectangle(h, lens);
  const area = (rect.x1 - rect.x0 + 1) * (rect.y1 - rect.y0 + 1);
  const noise = difference(off, again, lens.width, lens.height);
  const change = difference(off, on, lens.width, lens.height);
  return {
    off, on, calls, callsAgain, onCalls, rect, area,
    noise: noise.count, noiseIn: within(noise.mask, lens.width, rect),
    changed: change.count, changedIn: within(change.mask, lens.width, rect),
    seen: [...h.post.xray.seen], meshes: h.post.xray.drawnMeshes,
  };
}

/** The first step at which two series disagree, or -1. */
function firstDifference(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return i;
  }
  return -1;
}

/** One seeded round, the Shade walking down a lit lane, as nightvision.js watches it; `lens` presses the key at step 0 or not. */
function watch(h, xray) {
  h.initMatch({ mode: 'competitive', role: 'shade', ai: true, objective: true, seed: SEED });
  h.menu.hide();
  h.briefing.hide();
  h.input.clearAll();
  const lane = litLane(h, LANE.length, LANE.stands);
  if (!lane) return null;
  h.shade.reset({ position: alongLane(lane, 0), yaw: lane.yaw });
  h.detection.reset(h.shade);
  const drawnAt = h.rng.drawn;
  if (xray) press(h);
  else h.stepFrames(1);
  const forward = h.input.bindings.forward[0];
  h.input.heldCodes.add(forward);
  const series = [];
  for (let i = 0; i < WINDOW; i++) {
    h.stepFrames(1);
    series.push([h.detection.smoothed, h.detection.raw, h.wardenAI.accumulator, h.shade.health, h.rng.drawn - drawnAt]);
  }
  h.input.heldCodes.delete(forward);
  return { series, still: h.post.xray.on };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-shades-xray-sees-the-warden-through-a-crate-and-never-through-a-wall',
    spec: 'Block M / M3',
    name: 'The Shade\'s x-ray draws the Warden through a thin solid in range and not through a wall or past the range, in pixels against the same frame with it off; it adds only its silhouettes\' draw calls, is off behind the pause page and the briefing, in a new round and when night vision is on, and costs her nothing',
    run: (h) => {
      const subjects = SUBJECTS[h.map.id];
      if (!subjects) return { pass: false, detail: `no x-ray subjects named for map "${h.map.id}"` };
      const problems = [];
      const notes = [];
      const pick = (re) => (re ? h.map.collision.boxes.filter((box) => re.test(box.tag || '')) : []);
      const thin = [...pick(subjects.ducts), ...pick(subjects.crates), ...pick(subjects.containers)];
      const refused = [...pick(subjects.walls), ...pick(subjects.shell)];
      const bodies = [h.shade.mesh, h.shade.groundBlob, h.warden.groundBlob];
      const shown = bodies.map((body) => body.visible);
      let lens = null;
      try {
        openRound(h);
        lens = createLens(h);
        bodies.forEach((body) => { body.visible = false; });
        const slop = scaledCount(lens, SLOP);

        // (a) through a thin solid, in range, hidden from the eye.
        const near = [2.5, 3.5, 5];
        const far = [1.2, 2, 3];
        const throughAt = stage(h, thin, near, far, (r) => r.hidden && r.crossed && r.near < RANGE - 2);
        if (!throughAt) return { pass: false, detail: `no thin solid on ${h.map.id} with the Warden hidden behind it, in range, that the rule looks through` };
        place(h, throughAt);
        const a = photograph(h, lens, throughAt);
        const needed = Math.round(a.area * COVER_MIN);
        if (a.changedIn < needed) problems.push(`(a) behind ${throughAt.box.tag} the x-ray changed ${a.changedIn} pixels where the Warden is, want ${needed} (${COVER_MIN} of ${a.area})`);
        if (a.changedIn < 4 * a.noiseIn) problems.push(`(a) changed ${a.changedIn} against a noise of ${a.noiseIn}`);
        if (!a.seen.includes('warden')) problems.push('(a) the module does not say the Warden is seen');

        // (d) the draw calls, in the pose where something is drawn.
        if (a.calls !== a.callsAgain) problems.push(`(d) the same frame cost ${a.calls} draw calls, then ${a.callsAgain}, with it off`);
        const added = a.onCalls - a.calls;
        if (added < 1 || added > a.meshes) problems.push(`(d) on added ${added} draw calls for ${a.meshes} silhouette meshes`);
        press(h);
        h.shade.mesh.visible = false;
        h.shade.groundBlob.visible = false;
        const afterOff = lens.grab();
        const callsAfter = h.renderer.info.render.calls;
        if (callsAfter !== a.calls) problems.push(`(d) after it was turned off the frame cost ${callsAfter} calls, not the baseline's ${a.calls}`);
        const back = difference(a.off, afterOff, lens.width, lens.height);
        if (back.count > a.noise + slop) problems.push(`(d) turned off again the frame differs from the one it never touched by ${back.count} pixels`);

        // (e) off where it should be; pause, briefing, a second press, a new round, night vision.
        press(h);
        const hudTag = () => {
          h.hud.setVisible(true);
          h.hud.update(0, gatherHudState({
            match: h.match, shade: h.shade, warden: h.warden, gadgets: h.gadgets, detection: h.detection,
            combat: h.combat, objective: h.objective, post: h.post,
          }));
          return h.hud.root.querySelector('#bl-xr').style.display;
        };
        if (!h.post.xray.on) problems.push(`(e) ${KEY} did not turn it on again`);
        if (hudTag() !== 'block') problems.push('(e) the HUD shows no XR tag while it is on');
        const shown1 = lens.grab();
        if (difference(a.off, shown1, lens.width, lens.height).count < needed) problems.push('(e) the on frame is not drawn again before the panels');
        h.menu.show('pause');
        const paused = difference(a.off, lens.grab(), lens.width, lens.height).count;
        h.menu.hide();
        h.briefing.show({ match: h.match, round: 1, sites: h.map.sites, bindings: h.input.bindings, mapName: h.map.name });
        const briefed = difference(a.off, lens.grab(), lens.width, lens.height).count;
        h.briefing.hide();
        for (const [what, count] of [['the pause page', paused], ['the briefing', briefed]]) {
          if (count > a.noise + slop) problems.push(`(e) behind ${what} ${count} pixels differ from the frame with it off`);
        }
        press(h);
        if (h.post.xray.on) problems.push(`(e) a second ${KEY} did not turn it off`);
        if (hudTag() !== 'none') problems.push('(e) the HUD still tags it when off');
        press(h);
        press(h, KEY_NIGHT);
        if (!h.post.nightVision || h.post.xray.on) problems.push(`(e) night vision on left x-ray ${h.post.xray.on ? 'on' : 'off'} and itself ${h.post.nightVision ? 'on' : 'off'}`);
        press(h);
        if (!h.post.xray.on || h.post.nightVision) problems.push(`(e) the x-ray on left night vision ${h.post.nightVision ? 'on' : 'off'} and itself ${h.post.xray.on ? 'on' : 'off'}`);
        h.initMatch({ mode: 'competitive', role: 'shade', ai: false, objective: false, seed: SEED });
        if (h.post.xray.on) problems.push('(e) a new round started with it on');
        notes.push(`(a) ${throughAt.box.tag} ${a.changedIn}/${a.area} px changed (noise ${a.noiseIn}), rule ${throughAt.rule.map((v) => (v ? 'T' : 'F')).join('')}, ${a.seen.join('+')}; (d) ${a.calls} calls, +${added} for ${a.meshes} meshes; panels ${paused}/${briefed}`);

        // (b) behind a wall the rule refuses: nothing changes.
        openRound(h);
        const wallAt = stage(h, refused, near, far, (r) => !r.rule.some(Boolean) && r.hidden && r.near < RANGE - 2);
        if (!wallAt) {
          problems.push(`(b) no wall or shell box on ${h.map.id} with floor either side and the rule refusing the Warden behind it`);
        } else {
          place(h, wallAt);
          const b = photograph(h, lens, wallAt);
          if (b.changed > b.noise + slop) problems.push(`(b) behind ${wallAt.box.tag} the x-ray changed ${b.changed} pixels of the frame, ${b.changedIn} where the Warden is (noise ${b.noise})`);
          if (b.seen.length) problems.push(`(b) behind ${wallAt.box.tag} the module sees ${b.seen.join('+')}`);
          notes.push(`(b) ${wallAt.box.tag} ${b.changed} px changed (noise ${b.noise}), rule ${wallAt.rule.map((v) => (v ? 'T' : 'F')).join('')}`);
        }

        // (c) past the range behind a thin solid the rule looks through.
        openRound(h);
        const farAt = stage(h, thin, [RANGE + 1, RANGE + 2, RANGE + 4, RANGE + 6], [1.2, 2], (r) => r.crossed && r.near > RANGE + 0.5);
        if (!farAt) {
          problems.push(`(c) no thin solid on ${h.map.id} with floor ${RANGE + 1}m off on one side and the rule looking through to the Warden on the other`);
        } else {
          place(h, farAt);
          const c = photograph(h, lens, farAt);
          if (c.changed > c.noise + slop) problems.push(`(c) at ${farAt.near.toFixed(1)}m, past ${RANGE}m, the x-ray changed ${c.changed} pixels (noise ${c.noise})`);
          if (c.seen.length) problems.push(`(c) at ${farAt.near.toFixed(1)}m the module sees ${c.seen.join('+')}`);
          notes.push(`(c) ${farAt.box.tag} at ${farAt.near.toFixed(1)}m ${c.changed} px changed (noise ${c.noise}), rule ${farAt.rule.map((v) => (v ? 'T' : 'F')).join('')}`);
        }
        if (lens.glError() !== 0) problems.push('GL error in the reads');
      } finally {
        bodies.forEach((body, i) => { body.visible = shown[i]; });
        if (lens) lens.restore();
        h.menu.hide();
        h.briefing.hide();
      }

      // (f) it costs her nothing: one seeded round, twice.
      const without = watch(h, false);
      const withXray = watch(h, true);
      if (!without || !withXray) {
        problems.push(`(f) no lane on ${h.map.id} that the lamps light for ${LANE.length}m to watch the Shade walk`);
      } else {
        if (without.still) problems.push('(f) it came on in the round that never pressed the key');
        if (!withXray.still) problems.push('(f) it did not stay on through the watched window');
        const differs = firstDifference(without.series, withXray.series);
        if (differs !== -1) problems.push(`(f) step ${differs} reads ${JSON.stringify(without.series[differs])} without, ${JSON.stringify(withXray.series[differs])} with`);
        const meter = without.series.map((row) => row[0]);
        const spread = Math.max(...meter) - Math.min(...meter);
        if (!(spread > 1)) problems.push(`(f) the meter held within ${spread.toFixed(2)} over the window, so there is little to agree about`);
        notes.push(`(f) ${WINDOW} steps the same on and off, meter spread ${spread.toFixed(1)}`);
      }

      h.input.clearAll();
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      return {
        pass: problems.length === 0,
        detail: `${problems.length ? `${problems.join('; ')} [` : ''}${notes.join('; ')}${problems.length ? ']' : ''}`,
      };
    },
  });
}
