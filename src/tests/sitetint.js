/**
 * BLACKLINE - tests/sitetint.js
 *
 * AUTO suite (C7, D8): the site is a tinted floor, and the HUD names it.
 *
 * The plant is the room (20.1), and the 2m pulsing ring that said "plant
 * here" went with C7. In its place the room's floor is tinted - a multiply
 * quad over every floor plate inside the site's room (mapdecals.js,
 * `bakeSiteTints`) - and the HUD says which site you are standing in. The
 * first check reads a site floor with the tint drawn and with it hidden
 * and wants it warmer by a step and no darker than a tenth; the second
 * walks the Shade into a site through the real keys and reads the line
 * off the DOM, then out again and reads nothing, and stands the Warden in
 * another.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { facing } from '../mapkit.js';
import { createLens, quiesce, SITE_SAMPLE_OFFSET } from './pixels.js';

const M = CONFIG.map;

/**
 * The warmth step the tint has to make on a lit site floor: red over blue,
 * after against before. Measured 1.14-1.17x at strength 0.28 through the
 * plain renderer (C7); E6's post pipeline multiplies the tint in linear
 * light, which darkens more and warms less for the same strength, so the
 * strength went to 0.13 and the step measured 1.09-1.13x (D44); the
 * ceiling on the darkening is the done-when's tenth (5-8% measured).
 */
const MIN_WARMTH_STEP = 1.05;
const MAX_DARKENING = 0.1;
/** The crop read, as a fraction of the frame. */
const CROP = 0.4;

/** Mean R, G, B and luma over a centred crop. */
function meanChannels(frame, width, height, fraction) {
  const halfW = Math.floor((width * fraction) / 2);
  const halfH = Math.floor((height * fraction) / 2);
  const cx = width >> 1;
  const cy = height >> 1;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = cy - halfH; y < cy + halfH; y++) {
    for (let x = cx - halfW; x < cx + halfW; x++) {
      const i = (y * width + x) * 4;
      r += frame[i];
      g += frame[i + 1];
      b += frame[i + 2];
      n++;
    }
  }
  return { r: r / n, g: g / n, b: b / n, luma: (0.2126 * r + 0.7152 * g + 0.0722 * b) / n };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-site-floor-is-tinted-warm-and-the-ring-is-gone',
    spec: 'Section 5 / D8 (C7)',
    name: 'Every site room\'s floor is one tinted mesh that reads warmer than the same floor untinted and no darker than a tenth; no site has a ring',
    run: (h) => {
      const problems = [];
      const map = h.map;
      const restore = quiesce(h);
      const lens = createLens(h);
      h.shade.mesh.visible = false;
      h.warden.mesh.visible = false;
      h.shade.groundBlob.visible = false;
      h.warden.groundBlob.visible = false;

      // The mesh: one for every site, on the root, a multiply.
      const mesh = map.siteTintMesh;
      if (!mesh) problems.push('the map has no site tint mesh');
      else {
        if (mesh.parent !== map.root) problems.push('the site tint mesh is not on the map');
        // THREE.MultiplyBlending is 4; the checks do not import three.
        if (mesh.material.blending !== 4) problems.push(`the site tint blends by ${mesh.material.blending}, not a multiply`);
        if (!mesh.material.premultipliedAlpha) problems.push('the site tint multiply is not premultiplied (r180 draws it opaque)');
      }
      const tinted = map.root.children.filter((child) => child.name === 'site-tints').length;
      if (tinted !== 1) problems.push(`${tinted} site tint meshes on the map, not one`);

      // Every site: no ring, at least one quad, every quad on a floor plate
      // inside the room.
      const tiny = { x: 0.01, y: 0.01, z: 0.01 };
      for (const site of map.sites) {
        if (site.ring) problems.push(`site ${site.id} still has a ring`);
        if (!site.room) { problems.push(`site ${site.id} has no room to tint`); continue; }
        if (!site.tint || !site.tint.length) { problems.push(`site ${site.id} has no tint quads`); continue; }
        for (const quad of site.tint) {
          const room = site.room;
          if (quad.x0 < room.min.x - 1e-6 || quad.x1 > room.max.x + 1e-6 || quad.z0 < room.min.z - 1e-6 || quad.z1 > room.max.z + 1e-6) {
            problems.push(`site ${site.id}: a tint quad leaves its room`);
          }
          const cx = (quad.x0 + quad.x1) / 2;
          const cz = (quad.z0 + quad.z1) / 2;
          if (map.collision.isClear({ x: cx, y: quad.y - 0.02, z: cz }, tiny)) problems.push(`site ${site.id}: a tint quad at (${cx.toFixed(1)}, ${cz.toFixed(1)}) is not on a solid`);
          if (!map.collision.isClear({ x: cx, y: quad.y + M.decals.lift + 0.02, z: cz }, tiny)) problems.push(`site ${site.id}: a tint quad at (${cx.toFixed(1)}, ${cz.toFixed(1)}) is inside a solid`);
        }
      }

      // The pixels: the lit-pools spot on every site floor, tint drawn and
      // tint hidden. Warmer by a step where the floor is lit enough to
      // read a ratio; never darker than a tenth anywhere.
      const readings = {};
      lens.grab();
      for (const site of map.sites) {
        const at = { x: site.position.x + SITE_SAMPLE_OFFSET, y: site.position.y, z: site.position.z };
        lens.look({ x: at.x, y: at.y + 2.2, z: at.z + 0.01 }, at);
        if (mesh) mesh.visible = true;
        const on = meanChannels(lens.grab(), lens.width, lens.height, CROP);
        if (mesh) mesh.visible = false;
        const off = meanChannels(lens.grab(), lens.width, lens.height, CROP);
        if (mesh) mesh.visible = true;
        const warmth = off.b > 0.5 && on.b > 0.5 ? (on.r / on.b) / (off.r / off.b) : 1;
        const darkening = off.luma > 0 ? 1 - on.luma / off.luma : 0;
        readings[site.id] = { on, off, warmth, darkening };
        if (darkening > MAX_DARKENING) problems.push(`site ${site.id}'s floor is ${(darkening * 100).toFixed(0)}% darker with the tint (luma ${off.luma.toFixed(1)} to ${on.luma.toFixed(1)})`);
      }
      const lit = Object.entries(readings).sort((a, b) => b[1].off.luma - a[1].off.luma)[0];
      if (!lit) problems.push('no site to read');
      else if (lit[1].warmth < MIN_WARMTH_STEP) {
        problems.push(`site ${lit[0]}'s floor (luma ${lit[1].off.luma.toFixed(1)}) reads R/B ${lit[1].warmth.toFixed(3)}x with the tint, under the ${MIN_WARMTH_STEP} step`);
      }
      if (lens.glError() !== 0) problems.push('GL error during the reads');

      h.shade.mesh.visible = true;
      h.warden.mesh.visible = true;
      h.shade.groundBlob.visible = true;
      h.warden.groundBlob.visible = true;
      lens.restore();
      restore();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${map.sites.length} sites tinted on one mesh (${map.sites.map((site) => `${site.id}: ${site.tint.length} quads`).join(', ')}), no rings; `
            + Object.entries(readings).map(([id, r]) => `site ${id} R/B x${r.warmth.toFixed(3)}, luma ${r.off.luma.toFixed(1)} to ${r.on.luma.toFixed(1)} (${(r.darkening * 100).toFixed(1)}% darker)`).join('; ')
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-hud-names-the-site-you-stand-in',
    spec: 'Section 13 / D8 (C7)',
    name: 'Walked into a site room through the keys the HUD says which site; walked out it says nothing; the Warden standing in one reads its own',
    run: (h) => {
      const problems = [];
      const dt = CONFIG.time.fixedDt;
      const hud = h.hud;
      if (!hud) return { pass: false, detail: 'no HUD' };
      const sites = h.map.sites.filter((site) => site.room);
      if (!sites.length) return { pass: false, detail: 'no site has a room' };

      // A site with a lateral entry at floor level: the way in is a walk.
      let site = null;
      let entry = null;
      for (const candidate of sites) {
        const door = candidate.room.entries.find((e) => e.kind === 'lateral' && Math.abs(e.at.y - candidate.room.floorY) < 1e-3);
        if (door) { site = candidate; entry = door; break; }
      }
      if (!site) return { pass: false, detail: 'no site room has a lateral entry at floor level to walk in through' };
      const inward = { east: { x: -1, z: 0 }, west: { x: 1, z: 0 }, north: { x: 0, z: 1 }, south: { x: 0, z: -1 } }[entry.edge];
      const OUT = 1.5;
      const start = { x: entry.at.x - inward.x * OUT, y: entry.at.y, z: entry.at.z - inward.z * OUT };
      const yaw = facing(start.x, start.z, entry.at.x + inward.x * 3, entry.at.z + inward.z * 3);

      h.initMatch({ mode: 'competitive', role: 'shade', ai: false, objective: true });
      h.menu.hide();
      h.resetPresentation();
      const shade = h.shade;
      shade.reset({ position: start, yaw });
      shade.pitch = 0;
      h.input.clearAll();
      h.stepFrames(5);
      if (h.objective.siteNear(shade.position)) problems.push(`the start ${OUT}m outside the ${entry.edge} entry of site ${site.id} is already in a site`);

      // The frame draws the HUD from the gathered state; the read is the DOM.
      const read = () => {
        h.renderFrame(dt);
        const line = hud.el.site;
        return line.style.display === 'none' ? '' : line.textContent;
      };
      const outside = read();
      if (outside !== '') problems.push(`outside any site the HUD reads "${outside}"`);

      // In, through W. The site is read from the game, the line from the DOM.
      h.input.heldCodes.add('KeyW');
      let steps = 0;
      const limit = Math.round(4 / dt);
      while (steps++ < limit && !h.objective.siteNear(shade.position)) h.stepFrames(1);
      h.input.heldCodes.delete('KeyW');
      const walkedIn = steps * dt;
      const here = h.objective.siteNear(shade.position);
      if (!here) problems.push(`holding W for 4s from ${OUT}m outside the ${entry.edge} entry never entered site ${site.id} (at ${shade.position.x.toFixed(1)}, ${shade.position.z.toFixed(1)})`);
      else {
        const inside = read();
        const want = `SITE ${here.id} - ${here.name}`;
        if (inside !== want) problems.push(`in site ${here.id} the HUD reads "${inside}", not "${want}"`);
        if (hud.el.prompt.style.display !== 'block') problems.push('the prompt panel is hidden with the site line in it');
      }

      // Out again, through S, and the line goes.
      h.input.heldCodes.add('KeyS');
      steps = 0;
      while (steps++ < limit && h.objective.siteNear(shade.position)) h.stepFrames(1);
      h.input.heldCodes.delete('KeyS');
      if (h.objective.siteNear(shade.position)) problems.push('holding S for 4s never left the site');
      else {
        const gone = read();
        if (gone !== '') problems.push(`back outside the HUD still reads "${gone}"`);
      }

      // The Warden, named for its own position, with no plant prompt.
      const other = sites.find((candidate) => candidate !== site) || site;
      h.initMatch({ mode: 'competitive', role: 'warden', ai: false, objective: true });
      h.menu.hide();
      h.resetPresentation();
      h.warden.reset(h.map.wardenSpawns[0]);
      h.warden.position.set(other.position.x, other.position.y + CONFIG.warden.standHeight / 2 + 0.02, other.position.z);
      h.warden.velocity.set(0, 0, 0);
      h.stepFrames(3);
      const wardenLine = read();
      const wardenWant = `SITE ${other.id} - ${other.name}`;
      if (wardenLine !== wardenWant) problems.push(`the Warden in site ${other.id} reads "${wardenLine}", not "${wardenWant}"`);
      if (hud.el.promptText.style.display !== 'none') problems.push('the Warden is shown the plant prompt');

      h.input.clearAll();
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `walked in through site ${site.id}'s ${entry.edge} entry in ${walkedIn.toFixed(1)}s and the HUD read "SITE ${site.id} - ${site.name}"; `
            + `walked out and it read nothing; the Warden in site ${other.id} read "${wardenWant}" with no plant prompt`
          : problems.join('; '),
      };
    },
  });
}
