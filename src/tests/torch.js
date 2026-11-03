/**
 * BLACKLINE - tests/torch.js
 *
 * AUTO suite (K3): the Warden's rifle-mounted torch, on the night map.
 *
 *   - It is seen. A camera beside the beam photographs it with the torch off,
 *     on, and on with the light out so that only the cone is left, over the
 *     screen area the beam covers: on reads brighter than off, and the cone
 *     alone reads brighter than the dark - the light lights the floor and the
 *     cone lights the air, and a floor lit by a beam nobody can see is a torch
 *     without a cone. The cone is one draw call; the light casts no shadow
 *     (Section 4.1 keeps the one); and the geometry detection reads, which is
 *     arithmetic on the Warden's simulation, is where three drew the light.
 *   - It catches. A crouched, still Shade on dark ground stays under the
 *     meter's line with the torch off, goes over it inside a second with the
 *     torch on her, goes back under it when the beam is turned away, and the
 *     key that flips the torch is the player's own: `T` through the input.
 *   - It is the night map's alone. The registry flags one map `night`; a map
 *     that is not gets no torch and nothing in its scene, on the page that is
 *     on it and in `createTorch` when it is asked to build for one.
 *
 * The readings are the dark yard's, so the floors in the first check are a
 * little under what was expected of a first build and not a measurement of one;
 * the `TODO(lead)` beside them is where the measured numbers go once a suite
 * has run.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import * as THREE from 'three';
import { CONFIG, DEFAULT_BINDINGS } from '../config.js';
import { isNightMap, mapIds } from '../maps/index.js';
import { createTorch } from '../systems/torch.js';
import { alongLane, clearLanes, LIT_METER, meterAt } from './lanes.js';
import { createLens } from './pixels.js';

const T = CONFIG.warden.torch;
const S = CONFIG.shade;

/**
 * What the torch adds to the mean luma (0-255) of the screen area over the
 * beam, and what the cone alone adds. Floors, and small ones: the yard is
 * dark, the cone is a few thousandths of linear light, and what these guard
 * against is a torch that draws nothing, not its brightness.
 * TODO(lead): fill the measured readings in beside these once a suite has run.
 */
const TORCH_GAIN_MIN = 3;
const CONE_GAIN_MIN = 1;

/** Metres of lane behind the Warden, for a camera that looks down the beam from behind. */
const LEAD = 5;
/** A camera is a box this wide, so it is not inside a container. */
const CAMERA_HALF = { x: 0.25, y: 0.25, z: 0.25 };
/** The measuring box is at least this many pixels a side, so a distant cone still has an area to read. */
const BOX_MIN = 6;
/** How much of the cone's apparent radius at its middle the measuring box spans. */
const BOX_SHARE = 0.4;

/** The tilt the alignment clause aims the rig at: off the lane's heading and down, so yaw and pitch both count. */
const TILT = { yaw: 0.6, pitch: -0.35 };
/** The most the drawn light and detection's arithmetic may disagree by, in metres and as a dot product. */
const ALIGN_METRES = 0.01;
const ALIGN_DOT = 0.9999;

/** Where on a lane the Shade stands from the Warden, in metres: well inside the torch's range. */
const REACH = 10;
/** The meter's line for "seen": a Shade over it reads as lit to a Warden (`LIT_METER`, half the range). */
const SEEN_METER = LIT_METER;
/** The darkest a spot may read, standing and with the torch off, to be one the dark hides a Shade in (the plant's "dark"). */
const DARK_METER = 25;
/** Fixed steps the Shade is watched for, with the torch off; and the bound on being caught, a second. */
const WATCH_STEPS = 60;
const CATCH_STEPS = 60;
/** And steps for the meter to fall back after the beam leaves her, which is slower than it looks: a quarter second's smoothing. */
const FALL_STEPS = 90;

/** The torch's key, as the Input's own map has it. */
const KEY = DEFAULT_BINDINGS.torch[0];

/** The mean luma of the square `half` pixels either side of (`cx`, `cy`) in a frame `width` wide. */
function lumaOver(frame, width, cx, cy, half) {
  let total = 0;
  let count = 0;
  for (let y = cy - half; y < cy + half; y++) {
    for (let x = cx - half; x < cx + half; x++) {
      const i = (y * width + x) * 4;
      total += 0.2126 * frame[i] + 0.7152 * frame[i + 1] + 0.0722 * frame[i + 2];
      count++;
    }
  }
  return count ? total / count : 0;
}

/** Where a camera could stand to see a beam down a lane: (along it as a share of the range, to its side in metres, above it in metres). */
function slots() {
  const reach = 0.5 * T.range * Math.tan(T.angle);
  return [
    [0.5, reach + 2.5, 0.3], [0.5, -(reach + 2.5), 0.3],
    [0.5, reach + 2.0, 3.5], [0.5, -(reach + 2.0), 3.5],
    [-0.22, 0, 0.4], [-0.28, 1.2, 1.0], [-0.28, -1.2, 1.0],
    [0.5, 0.4, 9],
  ];
}

/**
 * A lane to put the Warden on and a camera to photograph the beam from: the
 * first clear run of floor where the beam is open for most of its range and
 * some slot beside it can see four points down the beam's axis. Found, and
 * not named, so it is the same on any night map. The Warden is left on the
 * lane it chose, level, facing along it.
 */
function pickView(h, torch) {
  const world = h.map.collision;
  const beam = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 };
  for (const lane of clearLanes(h, T.range + LEAD)) {
    const feet = alongLane(lane, LEAD);
    h.warden.reset({ position: feet, yaw: lane.yaw });
    torch.beam(beam);
    const axis = (share) => ({
      x: beam.x + beam.dx * T.range * share, y: beam.y + beam.dy * T.range * share, z: beam.z + beam.dz * T.range * share,
    });
    if (!world.lineOfSight(beam, axis(0.9))) continue;
    for (const [share, side, up] of slots()) {
      const eye = {
        x: beam.x + lane.dx * T.range * share + lane.dz * side,
        y: beam.y + up,
        z: beam.z + lane.dz * T.range * share - lane.dx * side,
      };
      if (!world.isClear(eye, CAMERA_HALF)) continue;
      if (![0.3, 0.5, 0.7, 0.9].every((k) => world.lineOfSight(eye, axis(k)))) continue;
      return { lane, eye, mid: axis(0.5), from: lane.from, slot: `${share} ${side.toFixed(1)} ${up.toFixed(1)}` };
    }
  }
  return null;
}

/** Where three drew the light and its aim, against detection's arithmetic on the simulation: the gap in metres, and the dot of the two directions. */
function alignment(h, torch, beam) {
  h.scene.updateMatrixWorld(true);
  const at = (object) => ({ x: object.matrixWorld.elements[12], y: object.matrixWorld.elements[13], z: object.matrixWorld.elements[14] });
  const from = at(torch.light);
  const to = at(torch.light.target);
  const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  torch.beam(beam);
  return {
    gap: Math.hypot(from.x - beam.x, from.y - beam.y, from.z - beam.z),
    dot: ((to.x - from.x) * beam.dx + (to.y - from.y) * beam.dy + (to.z - from.z) * beam.dz) / length,
  };
}

/** Run `count` fixed steps and say the highest smoothed meter seen, and the last. */
function watch(h, count) {
  let peak = 0;
  for (let i = 0; i < count; i++) {
    h.stepFrames(1);
    peak = Math.max(peak, h.detection.smoothed);
  }
  return { peak, last: h.detection.smoothed };
}

/** The player's press of the torch key: one step with the code down, then up. */
function pressTorchKey(h) {
  h.input.pressedCodes.add(KEY);
  h.stepFrames(1);
  h.input.pressedCodes.delete(KEY);
}

/** Steps until the smoothed meter is over the line, or `limit`; -1 for never. */
function stepsToSeen(h, limit) {
  for (let i = 1; i <= limit; i++) {
    h.stepFrames(1);
    if (h.detection.smoothed >= SEEN_METER) return i;
  }
  return -1;
}

/** The first clear lane with dark ground `REACH` metres down it, torch off. */
function findDarkReach(h) {
  for (const lane of clearLanes(h, REACH)) {
    const stand = alongLane(lane, REACH);
    const reading = meterAt(h, stand);
    if (reading < DARK_METER) return { lane, stand, reading };
  }
  return null;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-torch-casts-a-visible-cone-on-the-night-map',
    spec: 'Section 4.1 / K3',
    name: 'Photographed from beside the beam, the torch on reads brighter than the torch off over the beam\'s screen area, and the cone alone reads brighter than the dark; the light casts no shadow, the cone is one draw call, and the geometry detection reads is where the light is drawn',
    maps: ['yard'],
    run: (h) => {
      const problems = [];
      const nights = mapIds().filter(isNightMap);
      if (nights.length !== 1 || nights[0] !== h.map.id) {
        problems.push(`the registry flags [${nights.join(', ')}] as night and this page is on ${h.map.id}; one night map, and it is this one`);
      }
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
      const torch = h.detection.torch;
      if (!torch) return { pass: false, detail: `${h.map.id} is a night map and built no torch` };

      // What it is made of (Section 4.1): a spot that casts nothing, in the
      // cool of the palette, on the Warden's own rig; a cone that adds light
      // and writes no depth.
      if (!torch.light.isSpotLight) problems.push('the torch light is not a SpotLight');
      if (torch.light.castShadow) problems.push('the torch casts a shadow; Section 4.1 keeps exactly one');
      if (T.color !== CONFIG.palette.lightCool) problems.push(`the torch is #${T.color.toString(16)}, not the palette's cool #${CONFIG.palette.lightCool.toString(16)}`);
      if (torch.group.parent !== h.warden.cameraRig) problems.push('the torch is not on the Warden\'s camera rig, so it would not follow the look');
      const material = torch.cone.material;
      if (material.blending !== THREE.AdditiveBlending || material.depthWrite || !material.transparent) {
        problems.push('the cone is not additive, transparent and depth-write-off');
      }

      const view = pickView(h, torch);
      if (!view) return { pass: false, detail: `no clear lane on ${h.map.id} with ${T.range}m of beam and a camera that can see it` };

      // The drawn light is where detection says the beam is, level and then
      // tilted, because a beam that is right on the flat and wrong on a pitch
      // is exactly what a hand-written rig axis gets wrong.
      const beam = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 };
      const level = alignment(h, torch, beam);
      const yaw = h.warden.yaw;
      h.warden.yaw = yaw + TILT.yaw;
      h.warden.pitch = TILT.pitch;
      h.warden.cameraRig.rotation.set(TILT.pitch, yaw + TILT.yaw, 0, 'YXZ');
      const tilted = alignment(h, torch, beam);
      h.warden.yaw = yaw;
      h.warden.pitch = 0;
      h.warden.cameraRig.rotation.set(0, yaw, 0, 'YXZ');
      for (const [what, reading] of [['level', level], ['tilted', tilted]]) {
        if (reading.gap > ALIGN_METRES) problems.push(`${what}, the drawn light is ${reading.gap.toFixed(3)}m from where detection reads the beam`);
        if (reading.dot < ALIGN_DOT) problems.push(`${what}, the drawn beam and detection's differ (dot ${reading.dot.toFixed(5)})`);
      }

      const lens = createLens(h);
      let off = 0;
      let on = 0;
      let cone = 0;
      let added = 0;
      let box = 0;
      try {
        h.warden.mesh.visible = false;
        h.warden.groundBlob.visible = false;
        lens.look(view.eye, view.mid);

        // The box: centred on the middle of the beam, as wide as a share of
        // the cone's radius there looks on this screen.
        const centre = new THREE.Vector3(view.mid.x, view.mid.y, view.mid.z).project(h.camera);
        const right = h.camera.matrixWorld.elements;
        const reach = BOX_SHARE * 0.5 * T.range * Math.tan(T.angle);
        const edge = new THREE.Vector3(view.mid.x + right[0] * reach, view.mid.y + right[1] * reach, view.mid.z + right[2] * reach).project(h.camera);
        const limit = (Math.min(lens.width, lens.height) >> 1) - 2;
        box = Math.min(limit, Math.max(BOX_MIN, Math.round(Math.abs(edge.x - centre.x) * 0.5 * lens.width)));
        const cx = lens.width >> 1;
        const cy = lens.height >> 1;
        const read = () => lumaOver(lens.grab(), lens.width, cx, cy, box);

        torch.setOn(false);
        off = read();
        torch.setOn(true);
        on = read();
        // The cone alone: the light out, the mesh still drawn.
        torch.light.intensity = 0;
        cone = read();
        torch.light.intensity = T.intensity;

        // One draw call, whatever else the lens draws.
        torch.setOn(false);
        lens.renderOnly();
        const without = h.renderer.info.render.calls;
        torch.setOn(true);
        lens.renderOnly();
        added = h.renderer.info.render.calls - without;
        if (lens.glError() !== 0) problems.push('GL error during the reads');
      } finally {
        lens.restore();
        h.warden.mesh.visible = true;
        h.warden.groundBlob.visible = true;
        torch.setOn(true);
        torch.light.intensity = T.intensity;
      }
      if (on - off < TORCH_GAIN_MIN) problems.push(`the torch on adds ${(on - off).toFixed(2)} luma over the beam, under ${TORCH_GAIN_MIN}`);
      if (cone - off < CONE_GAIN_MIN) problems.push(`the cone alone adds ${(cone - off).toFixed(2)} luma over the beam, under ${CONE_GAIN_MIN}`);
      if (added !== 1) problems.push(`the torch adds ${added} draw calls to a frame, not one`);

      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      return {
        pass: problems.length === 0,
        detail: `${problems.length ? `${problems.join('; ')} [` : ''}luma off ${off.toFixed(1)} on ${on.toFixed(1)} (+${(on - off).toFixed(1)}) cone alone ${cone.toFixed(1)} (+${(cone - off).toFixed(1)}) in a ${2 * box}px box; ${added} draw call; aligned to ${level.gap.toFixed(4)}m/${tilted.gap.toFixed(4)}m; lane from ${view.from}, camera slot ${view.slot}${problems.length ? ']' : ''}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'a-shade-the-dark-hid-is-caught-in-the-torch',
    spec: 'Section 7.1 / K3',
    name: 'A crouched, still Shade on dark ground stays under the meter\'s line with the torch off, goes over it within a second with the beam on her, drops back when the beam is turned away, and the T key puts the torch on and off',
    maps: ['yard'],
    run: (h) => {
      const problems = [];
      // Free roam, so the human is the Warden and the key is the player's; the
      // AI is off, so nothing else is looking, and the Shade is not stepped, so
      // she is where she is put.
      h.initMatch({ mode: 'freeroam', role: 'warden', ai: false, objective: false });
      h.input.clearAll();
      const torch = h.detection.torch;
      if (!torch) return { pass: false, detail: `${h.map.id} is a night map and built no torch` };
      if (!torch.on) problems.push('a round did not start with the torch on');

      // The dark spot, found with the torch off so it is the map's light alone.
      torch.setOn(false);
      const spot = findDarkReach(h);
      if (!spot) return { pass: false, detail: `no clear lane on ${h.map.id} with ground under ${DARK_METER} ${REACH}m down it` };

      const { lane, stand } = spot;
      h.warden.reset({ position: { x: lane.x, y: lane.y, z: lane.z }, yaw: lane.yaw });
      h.shade.reset({ position: stand, yaw: lane.yaw + Math.PI });
      h.shade.height = S.crouchHeight;
      h.shade.half.y = h.shade.height / 2;
      h.shade.position.set(stand.x, stand.y + h.shade.half.y + 0.02, stand.z);
      h.shade.crouching = true;
      h.detection.reset(h.shade);
      const chest = { x: stand.x, y: h.shade.feetY + h.shade.height * CONFIG.detection.torsoHeightRatio, z: stand.z };
      h.warden.lookAt(chest);
      const aimed = h.warden.yaw;
      const aimedPitch = h.warden.pitch;

      // Torch off: the dark hides her.
      const hidden = watch(h, WATCH_STEPS);
      if (hidden.peak >= SEEN_METER) problems.push(`with the torch off she reads ${hidden.peak.toFixed(1)}, over ${SEEN_METER}: the spot is not dark`);

      // The key, from off: on, and the beam on her catches her.
      pressTorchKey(h);
      if (!torch.on) problems.push(`${KEY} did not put the torch on`);
      const caught = stepsToSeen(h, CATCH_STEPS);
      const sampled = h.detection.raw;
      if (caught < 0) problems.push(`with the beam on her the meter never passed ${SEEN_METER} in ${CATCH_STEPS} steps (raw ${sampled.toFixed(1)}, smoothed ${h.detection.smoothed.toFixed(1)})`);
      if (sampled < T.litLevel * 0.99) problems.push(`the sample reads ${sampled.toFixed(1)} with a clear line down the beam, not the ${T.litLevel} the torch lends`);

      // Turned away, with the torch still on: the dark hides her again.
      h.warden.yaw = aimed + Math.PI / 2;
      const away = watch(h, FALL_STEPS);
      if (away.last >= SEEN_METER) problems.push(`with the beam turned away she still reads ${away.last.toFixed(1)}`);

      // And back: she is the beam's, not the torch's being on.
      h.warden.yaw = aimed;
      h.warden.pitch = aimedPitch;
      const again = stepsToSeen(h, CATCH_STEPS);
      if (again < 0) problems.push(`turned back onto her the meter never passed ${SEEN_METER} in ${CATCH_STEPS} steps`);

      // The key, from on: off, and the dark hides her again.
      pressTorchKey(h);
      if (torch.on) problems.push(`${KEY} did not put the torch off`);
      const gone = watch(h, FALL_STEPS);
      if (gone.last >= SEEN_METER) problems.push(`with the torch off again she still reads ${gone.last.toFixed(1)}`);

      h.input.clearAll();
      torch.setOn(true);
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      return {
        pass: problems.length === 0,
        detail: `${problems.length ? `${problems.join('; ')} [` : ''}dark ${spot.reading.toFixed(1)} standing, ${hidden.peak.toFixed(1)} crouched over ${WATCH_STEPS} steps; in the beam over ${SEEN_METER} in ${caught} steps (raw ${sampled.toFixed(1)}), turned away ${away.last.toFixed(1)}, back in ${again}, torch off ${gone.last.toFixed(1)}; lane from ${lane.from}${problems.length ? ']' : ''}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-torch-is-built-on-the-night-map-and-nowhere-else',
    spec: 'Section 4.1 / K3',
    name: 'The registry flags exactly one night map; the page has a torch, one spot light and one cone, if and only if it is on that map; and the torch refuses to build for a map that is not a night map and adds nothing to the Warden when it does',
    run: (h) => {
      const problems = [];
      const nights = mapIds().filter(isNightMap);
      if (nights.length !== 1) problems.push(`the registry flags ${nights.length} night maps (${nights.join(', ')}), want one`);

      let spots = 0;
      let cones = 0;
      h.scene.traverse((object) => {
        if (object.isSpotLight) spots++;
        if (object.name === 'warden-torch-cone') cones++;
      });
      const night = isNightMap(h.map.id);
      const torch = h.detection.torch;
      if (night) {
        if (!torch) problems.push(`${h.map.id} is a night map and built no torch`);
        if (spots !== 1 || cones !== 1) problems.push(`${h.map.id} has ${spots} spot lights and ${cones} cones in its scene, want one of each`);
      } else {
        if (torch) problems.push(`${h.map.id} is not a night map and built a torch`);
        if (spots !== 0 || cones !== 0) problems.push(`${h.map.id} is not a night map and has ${spots} spot lights and ${cones} cones in its scene`);
      }

      // Asked to build for a map that is not a night map, it builds nothing.
      const spare = { cameraRig: new THREE.Object3D() };
      const refused = createTorch({ night: false, warden: spare, emitter: { on: () => () => {} } });
      if (refused !== null) problems.push('createTorch built a torch for a map that is not a night map');
      if (spare.cameraRig.children.length !== 0) problems.push('createTorch put something on the Warden for a map that is not a night map');

      // The key is an action of the Input's own, with a key.
      if (!Array.isArray(DEFAULT_BINDINGS.torch) || DEFAULT_BINDINGS.torch.length === 0) problems.push('the torch has no default binding');

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `night maps [${nights.join(', ')}]; ${h.map.id} ${night ? 'has' : 'has no'} torch (${spots} spot lights, ${cones} cones); a spare Warden is left bare; ${KEY} is the key`
          : problems.join('; '),
      };
    },
  });
}
