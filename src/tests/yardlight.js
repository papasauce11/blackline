/**
 * BLACKLINE - tests/yardlight.js
 *
 * AUTO suite: D4, the yard at night. Both checks name the yard's masts
 * (`MASTS`, `MAST`, `KEY_MAST`, maps/yarddata.js) and are scoped to it:
 *
 *   - The yard is floodlit from masts at night (D4, D9): every mast is a
 *     pole on the ground and an arm to a lamp at its head, both thinner
 *     than a body, so neither is a surface the rule lets a body stand on
 *     (the rule names approaches onto any face; it is the top that is
 *     too narrow) and neither derives as climbable; the shadowed key
 *     (Section 4.1) shines from the head of the mast whose lamp reaches
 *     the most of the Warden's ground inside the ring - counted here,
 *     cell by cell, against the name the map declares - at the yard's
 *     centre, warm, and low enough that a container throws a shadow
 *     longer than it is tall.
 *
 *   - The yard is dark between its pools: read straight down, with the
 *     actors hidden, the floor in a lane no lamp reaches and the floor in
 *     a stack's shadow both read under half of the dimmest site's pool
 *     and above the black a hole would be; and the sky alone - every lamp
 *     off - lands under a third of the brightest pool on every site, which
 *     is what "night" means to a pixel (the plant's rig outdoors landed
 *     three quarters). `lit-pools-and-dark-gaps-are-actually-contrasty`
 *     (tests/visual.js) holds the other half on every map: each site's
 *     lamp adds more than the sky.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { MASTS, MAST, KEY_MAST } from '../maps/yarddata.js';
import { YARD } from '../maps/yard.js';
import { createLens, meanLumaIn, quiesce, SITE_SAMPLE_OFFSET } from './pixels.js';

const S = CONFIG.shade;
const P = CONFIG.palette;
const G = CONFIG.map.groundY;
/** A gap reads under this fraction of the dimmest pool. */
const GAP_TO_POOL_MAX = 0.5;
/** The sky alone lands under this fraction of the brightest pool. */
const SKY_TO_POOL_MAX = 1 / 3;
/** Section 4: a floor at luma 0 is a hole, not a shadow. */
const NAVIGABLE_MIN = 1;
/** How far off the key's stated aim the light may point, as a dot product. */
const AIM_MIN = 0.999;

/**
 * Where to read the dark: a lane between the west store's stacks that no
 * lamp reaches, the ground west of bay C between the ring and the store
 * (the `store-west` waypoint); `shadowGap()` adds a spot in a stack's key
 * shadow, found at run time from the key's own direction, so the reading
 * follows the mast the key is on.
 */
const GAPS = [
  { id: 'west store lane', x: -15.0, z: 12.2 },
  { id: 'west of bay C', x: -26.0, z: 6.5 },
];

/** The mast's lamp head, in world space. */
function headOf(spec) {
  return { x: spec.head[0], y: G + MAST.head, z: spec.head[1] };
}

/** Warden-ground cells inside the ring within the lamp's range of the head. */
function coverage(h, spec, range) {
  const head = headOf(spec);
  let cells = 0;
  for (const cell of h.map.wardenGround.cellsWithin(head, range)) {
    if (cell.x < YARD.x0 || cell.x > YARD.x1 || cell.z < YARD.z0 || cell.z > YARD.z1) continue;
    const dx = cell.x - head.x;
    const dy = cell.y - head.y;
    const dz = cell.z - head.z;
    if (dx * dx + dy * dy + dz * dz < range * range) cells++;
  }
  return cells;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-yard-is-floodlit-from-masts-at-night',
    spec: 'Section 4.1 / D4 / D9',
    name: 'Every mast is a pole and an arm too thin to climb with a lamp at its head; the one shadowed key is warm and low and shines from the head of the mast that covers the most Warden ground inside the ring',
    maps: ['yard'],
    run: (h) => {
      const problems = [];
      const collision = h.map.collision;
      const minSupport = S.radius * 2;
      const byTag = new Map();
      for (const box of collision.boxes) if (box.tag) byTag.set(box.tag, box);

      // The masts: a pole on the ground, an arm from its top to the head,
      // a lamp there; nothing on them a body could stand on.
      for (const spec of MASTS) {
        const pole = byTag.get(`mast-${spec.tag}`);
        const arm = byTag.get(`mast-${spec.tag}-arm`);
        const head = headOf(spec);
        if (!pole || !arm) {
          problems.push(`${spec.tag}: no pole or no arm box`);
          continue;
        }
        if (Math.abs(pole.min.y - G) > 0.01) problems.push(`${spec.tag}: the pole starts ${pole.min.y.toFixed(2)}m up, not on the ground`);
        for (const [what, box] of [['pole', pole], ['arm', arm]]) {
          const thin = Math.min(box.max.x - box.min.x, box.max.z - box.min.z);
          if (thin >= minSupport) problems.push(`${spec.tag}: the ${what} is ${thin.toFixed(2)}m across, wide enough to stand on (${minSupport})`);
          if (box.climbable) problems.push(`${spec.tag}: the ${what} derives as climbable`);
        }
        const reaches = arm.min.x - 0.1 <= head.x && head.x <= arm.max.x + 0.1 && arm.min.z - 0.1 <= head.z && head.z <= arm.max.z + 0.1;
        if (!reaches) problems.push(`${spec.tag}: the arm does not reach the head at (${head.x}, ${head.z})`);
        if (head.y > pole.max.y) problems.push(`${spec.tag}: the head hangs above the pole's top`);
        const lamp = h.map.lights.find((entry) => entry.tag === spec.tag);
        if (!lamp) problems.push(`${spec.tag}: no lamp carries its tag`);
        else if (lamp.position.distanceTo(head) > 0.01) problems.push(`${spec.tag}: the lamp is at (${lamp.position.x}, ${lamp.position.y}, ${lamp.position.z}), the head at (${head.x}, ${head.y}, ${head.z})`);
      }

      // The key shines from the mast that covers the most: counted here,
      // against the name the map declares.
      const range = h.map.lights[0].range;
      const counts = MASTS.map((spec) => ({ tag: spec.tag, cells: coverage(h, spec, range) }));
      counts.sort((a, b) => b.cells - a.cells);
      if (h.map.keyMast !== KEY_MAST) problems.push(`the map says the key is on ${h.map.keyMast}, yarddata says ${KEY_MAST}`);
      if (counts[0].tag !== KEY_MAST) problems.push(`${counts[0].tag} covers the most (${counts[0].cells} cells), the key is on ${KEY_MAST} (${counts.find((c) => c.tag === KEY_MAST).cells})`);
      if (counts[0].cells === counts[1].cells) problems.push(`${counts[0].tag} and ${counts[1].tag} cover the same ${counts[0].cells} cells - "the most" is a tie`);

      // And it is aimed from that head at the yard's centre, warm, low.
      const key = h.map.keyLight;
      const keySpec = MASTS.find((spec) => spec.tag === KEY_MAST);
      const head = headOf(keySpec);
      const aim = { x: -head.x, y: -head.y, z: -head.z };
      const length = Math.hypot(aim.x, aim.y, aim.z);
      const dir = keyDirection(key);
      const dot = (dir.x * aim.x + dir.y * aim.y + dir.z * aim.z) / length;
      if (!key.castShadow) problems.push('the key does not cast');
      if (dot < AIM_MIN) problems.push(`the key points (${dir.x.toFixed(2)}, ${dir.y.toFixed(2)}, ${dir.z.toFixed(2)}), not from ${KEY_MAST}'s head at the centre (dot ${dot.toFixed(3)})`);
      if (key.color.getHex() !== P.lightWarm) problems.push(`the key is #${key.color.getHexString()}, not the floodlight's warm #${P.lightWarm.toString(16)}`);
      const elevation = Math.asin(-dir.y) * 180 / Math.PI;
      if (!(elevation < 45)) problems.push(`the key is ${elevation.toFixed(0)}° up: a container's shadow is shorter than it is tall`);

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${MASTS.length} masts, heads at ${(G + MAST.head).toFixed(1)}m; coverage inside the ring ${counts.map((c) => `${c.tag} ${c.cells}`).join(', ')}; the key from ${KEY_MAST} at ${elevation.toFixed(0)}° up, #${key.color.getHexString()}`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-yard-is-dark-between-its-pools',
    spec: 'Section 4 / D4 / D9',
    name: 'A lane no lamp reaches and a stack\'s key shadow read under half the dimmest pool and above black; the sky alone lands under a third of the brightest pool on every site',
    maps: ['yard'],
    run: (h) => {
      const problems = [];
      const restore = quiesce(h);
      const lens = createLens(h);
      // As lit-pools reads: straight down at the floor from standing
      // height, off the site's pulsing ring.
      const OFF_RING = SITE_SAMPLE_OFFSET;
      const sample = (x, z) => {
        lens.look({ x, y: G + 2.2, z: z + 0.01 }, { x, y: G, z });
        return meanLumaIn(lens.grab(), lens.width, lens.height, 0.4);
      };
      h.shade.mesh.visible = false;
      h.warden.mesh.visible = false;
      h.shade.groundBlob.visible = false;
      h.warden.groundBlob.visible = false;
      lens.grab();

      // A stack's key shadow on the Warden's ground: the darkest such spot
      // the yard offers, which follows the mast the key is on.
      const gaps = GAPS.slice();
      const shadow = shadowGap(h, keyDirection(h.map.keyLight));
      if (shadow) gaps.push(shadow);
      else problems.push('no container throws a key shadow onto the Warden\'s ground');

      const pools = {};
      for (const site of h.map.sites) pools[`site ${site.id}`] = sample(site.position.x + OFF_RING, site.position.z);
      const gapReadings = {};
      for (const gap of gaps) gapReadings[gap.id] = sample(gap.x, gap.z);

      const lights = h.map.activeLights();
      const saved = lights.map((entry) => entry.light.intensity);
      lights.forEach((entry) => { entry.light.intensity = 0; });
      const sky = {};
      for (const site of h.map.sites) sky[`site ${site.id}`] = sample(site.position.x + OFF_RING, site.position.z);
      lights.forEach((entry, i) => { entry.light.intensity = saved[i]; });

      const brightest = Math.max(...Object.values(pools));
      const dimmest = Math.min(...Object.values(pools));
      for (const [id, value] of Object.entries(gapReadings)) {
        if (value >= dimmest * GAP_TO_POOL_MAX) problems.push(`${id} reads ${value.toFixed(1)}, not under half the dimmest pool (${dimmest.toFixed(1)})`);
        if (value < NAVIGABLE_MIN) problems.push(`${id} reads ${value.toFixed(2)} - a hole, not a shadow`);
      }
      for (const [where, value] of Object.entries(sky)) {
        if (value >= brightest * SKY_TO_POOL_MAX) problems.push(`with every lamp off ${where} still reads ${value.toFixed(1)} from the sky, over a third of the brightest pool (${brightest.toFixed(1)}) - is it night?`);
      }
      if (lens.glError() !== 0) problems.push('GL error during the reads');

      h.shade.mesh.visible = true;
      h.warden.mesh.visible = true;
      h.shade.groundBlob.visible = true;
      h.warden.groundBlob.visible = true;
      lens.restore();
      restore();
      const summary = `pools ${Object.entries(pools).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ')}; `
        + `sky alone ${Object.entries(sky).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ')}; `
        + `gaps ${Object.entries(gapReadings).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ')}`;
      return {
        pass: problems.length === 0,
        detail: problems.length === 0 ? summary : `${problems.join('; ')} [${summary}]`,
      };
    },
  });
}

/** The key light's unit direction, as `aimKeyLight` recorded it. */
function keyDirection(key) {
  const d = key.userData.direction;
  return { x: d[0], y: d[1], z: d[2] };
}

/**
 * A spot on the Warden's ground in a container's key shadow: from the
 * corner of each tier top the light passes first, along the light to the
 * ground, pulled 1.5m back toward the box so the sample sits inside the
 * shadow; of those on the ground inside the ring, the one farthest from
 * any lamp.
 */
function shadowGap(h, dir) {
  const ground = h.map.wardenGround;
  const lamps = h.map.lights.map((entry) => entry.position);
  let best = null;
  for (const box of h.map.collision.boxes) {
    if (!box.solid || !box.tag || box.max.y < G + 2.5 || box.min.y > G + 0.1) continue;
    if (box.max.x - box.min.x < 2 || box.max.z - box.min.z < 2) continue;
    const run = (box.max.y - G) / -dir.y;
    const along = { x: dir.x * run, z: dir.z * run };
    const step = Math.hypot(along.x, along.z);
    if (step < 3) continue;
    const from = { x: dir.x > 0 ? box.min.x : box.max.x, z: dir.z > 0 ? box.min.z : box.max.z };
    const at = { x: from.x + along.x - (along.x / step) * 1.5, y: G, z: from.z + along.z - (along.z / step) * 1.5 };
    if (at.x < YARD.x0 || at.x > YARD.x1 || at.z < YARD.z0 || at.z > YARD.z1) continue;
    if (!ground || !ground.has(at)) continue;
    let nearest = Infinity;
    for (const lamp of lamps) nearest = Math.min(nearest, Math.hypot(lamp.x - at.x, lamp.z - at.z));
    if (!best || nearest > best.nearest) best = { id: `${box.tag}'s shadow`, x: at.x, z: at.z, nearest };
  }
  return best;
}
