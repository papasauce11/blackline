/**
 * BLACKLINE - tests/visual.js
 *
 * AUTO suite: things that had only ever been asserted as numbers.
 *
 * Every check here renders and reads the framebuffer back. See tests/pixels.js
 * for why that is possible in a pane that never composites, and for the honest
 * limits: this proves something is drawn, where, and how bright, and that it
 * changes when the game says it changed. Whether any of it *looks good* is not
 * a question a pixel count can answer, and each check below says which half it
 * is settling.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { createLens, difference, meanLuma, meanLumaIn, brightnessDelta, erode, quiesce, SITE_SAMPLE_OFFSET } from './pixels.js';

/** Look at `target` from `distance` away, on a bearing, at eye height. */
function eyeOn(target, distance, bearing, height = 1.4) {
  return {
    x: target.x + Math.sin(bearing) * distance,
    y: target.y + height,
    z: target.z + Math.cos(bearing) * distance,
  };
}

export function register(debugTools) {
  // -------------------------------------------------------------------------
  // Section 4 — "high contrast between lit pools and dark gaps"
  // -------------------------------------------------------------------------
  debugTools.registerAutoTest({
    id: 'lit-pools-and-dark-gaps-are-actually-contrasty',
    spec: 'Section 4 / checks 8, 9',
    name: 'The Turbine Hall renders bright and the Server Vault renders dark',
    run: (h) => {
      const problems = [];
      const restore = quiesce(h);
      const lens = createLens(h);

      // Measured looking DOWN at the floor from standing height, so the reading
      // is of the light landing in the room rather than of whatever wall
      // happens to be on the far side of it.
      // Sampled OFF the site centre. A plant site carried a 2m hazard ring that
      // pulsed between 0.35 and 0.9 opacity, and it sat exactly under a camera
      // pointed straight down at the site. In the dark rooms it dominated the
      // crop, and because the lit and unlit samples are taken at different
      // moments it was read at different points in its pulse — which is how an
      // "ambient floor" came out brighter than the same floor with the lights on.
      // The ring went with C7; the spot stays so the readings are comparable.
      const OFF_RING = SITE_SAMPLE_OFFSET;
      const sample = (position) => {
        const at = { x: position.x + OFF_RING, y: position.y, z: position.z };
        lens.look({ x: at.x, y: at.y + 2.2, z: at.z + 0.01 }, at);
        return meanLumaIn(lens.grab(), lens.width, lens.height, 0.4);
      };

      // Get both actors out of the frame first. The sample looks straight down
      // at a site floor, and a body standing on it is lit geometry inside the
      // crop — which made this reading depend on wherever the previous check
      // happened to leave someone.
      const parked = { x: 0, y: -400, z: 0 };
      h.shade.mesh.visible = false;
      h.warden.mesh.visible = false;
      h.shade.groundBlob.visible = false;
      h.warden.groundBlob.visible = false;
      void parked;

      // The first draw after a load compiles programs and returns a frame that
      // is not representative. Warm up before measuring anything.
      lens.grab();

      const readings = {};
      for (const site of h.map.sites) readings[`site ${site.id}`] = sample(site.position);

      // The same floors with every destructible light off. This is the number
      // that matters: Section 4 calls the contrast between lit pools and dark
      // gaps "the core visual language", which only means anything if the gaps
      // are dark on their own and the pools are what light them.
      const lights = h.map.activeLights();
      const saved = lights.map((entry) => entry.light.intensity);
      lights.forEach((entry) => { entry.light.intensity = 0; });
      const ambient = {};
      for (const site of h.map.sites) ambient[`site ${site.id}`] = sample(site.position);
      lights.forEach((entry, i) => { entry.light.intensity = saved[i]; });

      const hall = readings['site A'];
      const vault = readings['site C'];
      const contribution = {};
      for (const key of Object.keys(readings)) contribution[key] = readings[key] - ambient[key];

      // Section 5: site A is "brightly lit", site C is "tight, dark ... lowest
      // light". The screen has to agree with the meter, which reads 72 and 18.
      if (!(hall > vault)) problems.push(`the hall renders at ${hall.toFixed(1)} and the vault at ${vault.toFixed(1)}`);
      const darkest = Object.entries(readings).sort((a, b) => a[1] - b[1])[0][0];
      if (darkest !== 'site C') problems.push(`${darkest} renders darker than the Server Vault, which Section 5 calls the darkest`);

      // The pools must dominate. If the ambient floor is brighter than what the
      // point lights add, the room is lit whether or not you shoot the lights
      // out — and shooting them out is the mechanic.
      for (const key of Object.keys(readings)) {
        if (contribution[key] <= ambient[key]) {
          problems.push(`at ${key} the point lights add ${contribution[key].toFixed(1)} over an ambient floor of ${ambient[key].toFixed(1)}`);
        }
      }
      // Section 4's dark gaps still have to be navigable: a floor at luma 0 is
      // a hole, not a shadow.
      for (const [where, value] of Object.entries(readings)) {
        if (value < 1) problems.push(`${where} renders at ${value.toFixed(2)} — indistinguishable from nothing`);
      }
      if (lens.glError() !== 0) problems.push('GL error during the reads');

      h.shade.mesh.visible = true;
      h.warden.mesh.visible = true;
      h.shade.groundBlob.visible = true;
      h.warden.groundBlob.visible = true;
      lens.restore();
      restore();
      const summary = Object.entries(readings)
        .map(([where, value]) => `${where} ${value.toFixed(1)} (${contribution[where] >= 0 ? '+' : ''}${contribution[where].toFixed(1)} from its lights)`)
        .join(', ');
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `floor luma: ${summary}; with every destructible light off the interiors fall to `
            + `${Object.values(ambient).map((v) => v.toFixed(1)).join('/')}, so the pools are what light the rooms; `
            + `the Turbine Hall is ${(hall / vault).toFixed(2)}x the Server Vault, which is the darkest`
          : problems.join('; '),
      };
    },
  });

  // -------------------------------------------------------------------------
  // Section 4.2 / check 27 — the Shade visibly dims
  // -------------------------------------------------------------------------
  debugTools.registerAutoTest({
    id: 'the-shade-visibly-dims-with-the-meter',
    spec: 'Section 4.2 / check 27',
    name: 'Reads the framebuffer: the body is darker at meter 0 than at meter 100',
    run: (h) => {
      const problems = [];
      const restore = quiesce(h);
      const lens = createLens(h);
      const shade = h.shade;

      const site = h.map.sites[0];
      shade.reset({ position: site.position, yaw: 0 });
      h.stepFrames(20);
      const focus = { x: shade.position.x, y: shade.feetY + 1.0, z: shade.position.z };
      lens.look(eyeOn(focus, 3, Math.PI * 0.75, 0.4), focus);

      // The silhouette, so only the body is measured and not the room behind it.
      shade.mesh.visible = false;
      const empty = lens.grab();
      shade.mesh.visible = true;

      const at = (meter) => {
        h.detection.smoothed = meter;
        h.detection._applyFeedback(shade);
        return lens.grab();
      };
      const dark = at(0);
      const lit = at(CONFIG.detection.meterMax);

      const body = difference(lit, empty, lens.width, lens.height, 8);
      if (body.count < 400) {
        lens.restore();
        restore();
        return { pass: false, detail: `the Shade covered ${body.count} pixels — nothing to measure` };
      }

      const gain = brightnessDelta(dark, lit, body.mask);
      if (gain <= 0) {
        problems.push(`the body was ${(-gain).toFixed(1)} DARKER at meter 100 than at meter 0`);
      }
      // Section 4.2: "at visibility 0 the Shade is a near-black silhouette".
      let darkLuma = 0;
      let litLuma = 0;
      let count = 0;
      for (let i = 0; i < body.mask.length; i++) {
        if (!body.mask[i]) continue;
        const p = i * 4;
        darkLuma += 0.2126 * dark[p] + 0.7152 * dark[p + 1] + 0.0722 * dark[p + 2];
        litLuma += 0.2126 * lit[p] + 0.7152 * lit[p + 1] + 0.0722 * lit[p + 2];
        count++;
      }
      darkLuma /= count;
      litLuma /= count;
      if (darkLuma > 90) problems.push(`at meter 0 the body reads ${darkLuma.toFixed(1)} — not a near-black silhouette`);
      if (litLuma <= darkLuma) problems.push('the lit body is no brighter than the hidden one');

      // Monotonic across the range, so there is no band where hiding makes you
      // brighter — the disagreement Section 4.2 exists to forbid.
      const steps = [0, 25, 50, 75, 100].map((meter) => {
        const frame = at(meter);
        let total = 0;
        for (let i = 0; i < body.mask.length; i++) {
          if (!body.mask[i]) continue;
          const p = i * 4;
          total += 0.2126 * frame[p] + 0.7152 * frame[p + 1] + 0.0722 * frame[p + 2];
        }
        return Math.round((total / count) * 10) / 10;
      });
      for (let i = 1; i < steps.length; i++) {
        if (steps[i] < steps[i - 1] - 0.5) problems.push(`brightness fell from ${steps[i - 1]} to ${steps[i]} as the meter rose`);
      }
      if (lens.glError() !== 0) problems.push('GL error during the reads');

      lens.restore();
      restore();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${body.count} body pixels: luma ${steps.join(' -> ')} across meter 0/25/50/75/100, `
            + `monotonic, near-black (${darkLuma.toFixed(1)}) when hidden`
          : problems.join('; '),
      };
    },
  });

  // -------------------------------------------------------------------------
  // Section 4 — the inverted-hull outline is what makes the silhouette read
  // -------------------------------------------------------------------------
  debugTools.registerAutoTest({
    id: 'the-outline-darkens-the-silhouette-edge',
    spec: 'Section 4',
    name: 'Hiding the inverted hull measurably lightens the body edge',
    run: (h) => {
      const problems = [];
      const restore = quiesce(h);
      const lens = createLens(h);
      const shade = h.shade;

      const site = h.map.sites[0];
      shade.reset({ position: site.position, yaw: 0 });
      h.stepFrames(20);
      h.detection.smoothed = CONFIG.detection.meterMax;
      h.detection._applyFeedback(shade);
      const focus = { x: shade.position.x, y: shade.feetY + 1.0, z: shade.position.z };
      lens.look(eyeOn(focus, 3, Math.PI * 0.75, 0.4), focus);

      // The outlines are children of the meshes they hull, added in Phase 5's
      // fix. Collect them by material rather than by name.
      const outlineMaterial = shade.mesh.userData.materials.outline;
      const hulls = [];
      shade.mesh.traverse((object) => {
        if (object.isMesh && object.material === outlineMaterial) hulls.push(object);
      });
      if (hulls.length === 0) {
        lens.restore();
        restore();
        return { pass: false, detail: 'the Shade has no inverted-hull outline meshes' };
      }

      lens.grab();
      shade.mesh.visible = false;
      const empty = lens.grab();
      shade.mesh.visible = true;
      const withHull = lens.grab();
      for (const hull of hulls) hull.visible = false;
      const withoutHull = lens.grab();
      for (const hull of hulls) hull.visible = true;

      const body = difference(withHull, empty, lens.width, lens.height, 8);
      const inner = erode(erode(body.mask, lens.width, lens.height), lens.width, lens.height);
      const edge = new Uint8Array(body.mask.length);
      for (let i = 0; i < body.mask.length; i++) if (body.mask[i] && !inner[i]) edge[i] = 1;

      // The hull is a back-faced shell scaled past the body, so it occupies the
      // silhouette RIM and nothing else. Whether removing it lightens or
      // darkens that rim depends on the meter: Section 4.2 drives the outline
      // from near-black at visibility 0 to a bright rim at 100. So the claim
      // worth testing is not a direction, it is that the hull owns the edge —
      // hiding it must change the rim far more than the interior.
      const edgeChange = Math.abs(brightnessDelta(withHull, withoutHull, edge));
      const coreChange = Math.abs(brightnessDelta(withHull, withoutHull, inner));

      // One hull per body mesh, whatever the body is made of. Counted rather
      // than hard-coded, so adding a limb cannot silently go un-outlined.
      let bodyMeshes = 0;
      shade.mesh.traverse((object) => {
        if (object.isMesh && object.material !== outlineMaterial) bodyMeshes++;
      });

      if (body.count < 400) problems.push(`the Shade covered ${body.count} pixels`);
      if (hulls.length !== bodyMeshes) {
        problems.push(`${bodyMeshes} body meshes but ${hulls.length} outlines — something is un-outlined`);
      }
      if (edgeChange < 5) problems.push(`hiding the hull changed the silhouette edge by ${edgeChange.toFixed(1)} — it is not drawing`);
      if (!(edgeChange > coreChange * 2)) {
        problems.push(`edge ${edgeChange.toFixed(1)} vs interior ${coreChange.toFixed(1)} — the hull is not edge-only`);
      }

      // Section 4.2's range: a faint edge when hidden, a bright rim when lit.
      const rimAt = (meter) => {
        h.detection.smoothed = meter;
        h.detection._applyFeedback(shade);
        const frame = lens.grab();
        let total = 0;
        let count = 0;
        for (let i = 0; i < edge.length; i++) {
          if (!edge[i]) continue;
          const p = i * 4;
          total += 0.2126 * frame[p] + 0.7152 * frame[p + 1] + 0.0722 * frame[p + 2];
          count++;
        }
        return count ? total / count : 0;
      };
      const faint = rimAt(0);
      const bright = rimAt(CONFIG.detection.meterMax);
      if (!(bright > faint)) {
        problems.push(`the silhouette edge reads ${faint.toFixed(1)} hidden and ${bright.toFixed(1)} lit — no range`);
      }
      if (lens.glError() !== 0) problems.push('GL error during the reads');

      lens.restore();
      restore();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${hulls.length} hulls over ${bodyMeshes} body meshes and ${body.count} pixels: hiding them moved the `
            + `silhouette edge by ${edgeChange.toFixed(1)} against ${coreChange.toFixed(1)} in the interior, so the `
            + `hull is what draws the rim; that rim runs ${faint.toFixed(1)} hidden to ${bright.toFixed(1)} lit`
          : problems.join('; '),
      };
    },
  });

  // -------------------------------------------------------------------------
  // Section 9.1 — smoke occludes, and the flashbang reaches the screen
  // -------------------------------------------------------------------------
  debugTools.registerAutoTest({
    id: 'smoke-obscures-and-the-flash-whites-out',
    spec: 'Section 9.1 / check 17',
    name: 'A cloud measurably changes what is behind it; the whiteout reaches the HUD',
    run: (h) => {
      const problems = [];
      const restore = quiesce(h);
      const lens = createLens(h);
      const GA = CONFIG.gadgets;

      const site = h.map.sites[0];
      const focus = { x: site.position.x, y: site.position.y + 1.0, z: site.position.z };
      const from = eyeOn(focus, 8, 0, 1.2);
      lens.look(from, focus);
      const clear = lens.grab();

      // A cloud halfway between the camera and what it is looking at.
      const at = { x: (from.x + focus.x) / 2, y: (from.y + focus.y) / 2, z: (from.z + focus.z) / 2 };
      h.gadgets.effects.add({ type: 'smoke', at, radius: GA.smoke.radius, duration: GA.smoke.duration });
      h.emitter.emit('gadget:detonate', { type: 'smoke', at });
      h.stepFrames(Math.round(GA.smoke.growTime / CONFIG.time.fixedDt));
      const smoked = lens.grab();

      const diff = difference(smoked, clear, lens.width, lens.height, 6);
      const covered = diff.count / lens.pixels;
      const sprites = h.effects.pooledSprites;

      if (sprites === 0) problems.push('no smoke sprites were alive');
      if (diff.count < 5000) {
        problems.push(`the cloud changed only ${diff.count} pixels (${(covered * 100).toFixed(1)}% of frame) — it is not obscuring`);
      }
      // Smoke is light grey against an industrial interior: it should lighten.
      const shift = brightnessDelta(clear, smoked, diff.mask);
      if (Math.abs(shift) < 5) problems.push(`the cloud shifted brightness by only ${shift.toFixed(1)}`);

      // The flashbang whiteout is a DOM overlay, not geometry — Section 13 puts
      // the HUD in DOM — so it is checked where it actually lives.
      const hud = h.hud;
      const wasVisible = hud.visible;
      hud.setVisible(true);
      hud.update(0.016, { role: 'shade', freeroam: false, health: 100, lives: 3, visibility: 0, blind: 1 });
      const opaque = parseFloat(hud.flash.style.opacity);
      hud.update(0.016, { role: 'shade', freeroam: false, health: 100, lives: 3, visibility: 0, blind: 0 });
      const clearOpacity = parseFloat(hud.flash.style.opacity);
      hud.setVisible(wasVisible);
      if (!(opaque >= 1)) problems.push(`a full flashbang set the whiteout to ${opaque}`);
      if (clearOpacity !== 0) problems.push(`the whiteout did not clear (${clearOpacity})`);
      if (lens.glError() !== 0) problems.push('GL error during the reads');

      // Let it expire so nothing is left hanging over the next check.
      h.stepFrames(Math.ceil((GA.smoke.duration + 1) / CONFIG.time.fixedDt));
      lens.restore();
      restore();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${sprites} sprites covered ${diff.count} pixels (${(covered * 100).toFixed(1)}% of frame) and shifted `
            + `them by ${shift.toFixed(1)}; the flashbang whiteout reaches opacity ${opaque} and clears to 0`
          : problems.join('; '),
      };
    },
  });

  // -------------------------------------------------------------------------
  // Section 9.2 — the alarm camera is a thing you can see
  // -------------------------------------------------------------------------
  debugTools.registerAutoTest({
    id: 'the-alarm-fixture-is-visible-and-changes-state',
    spec: 'Section 9.2 / check 19',
    name: 'The camera renders on its wall, its lens changes when tripped, and it goes when destroyed',
    run: (h) => {
      const problems = [];
      const restore = quiesce(h);
      const lens = createLens(h);
      const C = CONFIG.gadgets.alarmCamera;

      // A wall to mount on, found the same way the AI finds one.
      const W = CONFIG.warden;
      let surface = null;
      for (const node of h.map.waypoints) {
        const eyeY = node.position.y + W.standHeight * W.eyeHeightRatio;
        for (let i = 0; i < 32 && !surface; i++) {
          const angle = (i / 32) * Math.PI * 2;
          const hit = h.map.collision.raycast(
            { x: node.position.x, y: eyeY, z: node.position.z },
            { x: Math.sin(angle), y: 0, z: Math.cos(angle) }, C.placeRange
          );
          if (hit && Math.abs(hit.ny) < 0.5) surface = hit;
        }
        if (surface) break;
      }
      if (!surface) {
        lens.restore();
        restore();
        return { pass: false, detail: 'no wall within reach of a waypoint to mount on' };
      }

      const mount = {
        x: surface.x + surface.nx * C.surfaceOffset,
        y: surface.y + surface.ny * C.surfaceOffset,
        z: surface.z + surface.nz * C.surfaceOffset,
      };
      // Look at the wall from in front of it, close enough that a 0.34m fixture
      // is a real number of pixels.
      lens.look({ x: mount.x + surface.nx * 1.6, y: mount.y + 0.2, z: mount.z + surface.nz * 1.6 }, mount);

      h.gadgets.destroyAlarm('test');
      h.stepFrames(1);
      const bare = lens.grab();
      h.gadgets.placeAlarm(mount, Math.atan2(-surface.nx, -surface.nz));
      h.stepFrames(1);
      const placed = lens.grab();

      const fixture = difference(placed, bare, lens.width, lens.height, 6);
      if (fixture.count < 150) problems.push(`the fixture drew only ${fixture.count} pixels`);

      // The lens is the state readout, as a destructible light's glass is.
      // Trip it and the colour must change on screen, not just in a material.
      h.effects.blinkAlarm();
      h.effects._stepAlarmFixture(0);
      const alerted = lens.grab();
      const alertDiff = difference(alerted, placed, lens.width, lens.height, 6);
      if (alertDiff.count < 10) problems.push('tripping the camera changed nothing on screen');

      // Destroyed, it goes.
      h.gadgets.destroyAlarm('test');
      h.stepFrames(1);
      const gone = lens.grab();
      const removed = difference(gone, bare, lens.width, lens.height, 6);
      // Sparks fire on destruction and expire, so allow a small residue.
      if (removed.count > fixture.count * 0.5) {
        problems.push(`${removed.count} pixels still differ after destroying it — the fixture is still drawn`);
      }
      if (h.effects.alarmFixture.visible) problems.push('the fixture stayed visible after destruction');
      if (lens.glError() !== 0) problems.push('GL error during the reads');

      lens.restore();
      restore();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `the fixture drew ${fixture.count} pixels on its wall, tripping it changed ${alertDiff.count} of them `
            + `(the lens), and destroying it left ${removed.count}`
          : problems.join('; '),
      };
    },
  });

  // -------------------------------------------------------------------------
  // Section 10.2 — the death camera really is pointed at the killer
  // -------------------------------------------------------------------------
  debugTools.registerAutoTest({
    id: 'the-death-camera-frames-the-killer',
    spec: 'Section 10.2 / check 23',
    name: 'The Warden is on screen and near the middle of it, and the body tumbles',
    run: (h) => {
      const problems = [];
      const restore = quiesce(h);
      const renderer = h.renderer;
      const gl = renderer.getContext();
      const width = renderer.domElement.width;
      const height = renderer.domElement.height;
      const buffer = new Uint8Array(width * height * 4);
      const { shade, warden, deathCam } = h;

      // Stand them together somewhere lit, then kill the Shade.
      const site = h.map.sites[0];
      shade.reset({ position: site.position, yaw: 0 });
      h.stepFrames(10);
      warden.reset({
        position: { x: site.position.x + 2.5, y: site.position.y, z: site.position.z + 2.5 },
        yaw: 0,
      });
      h.stepFrames(5);

      // Warm this view before the death camera starts its wall-clock guard
      // (F5). The first draw of a view compiles what it has not drawn yet,
      // and headless on the software renderer that took 39s here - the
      // guard is 16.5s, so run alone the first grab below fired it, the
      // Shade was force-reinserted and the check read a camera at the
      // origin and a body that never fell. In the full suite an earlier
      // check at site A had already paid. The readPixels is what makes the
      // draw finish now rather than inside the guarded window.
      const warmStart = performance.now();
      h.renderFrame(1 / 60);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
      const warmMs = performance.now() - warmStart;

      shade.health = 0;
      h.emitter.emit('combat:death', { target: 'shade', kind: 'test' });
      if (!deathCam.active) {
        restore();
        return { pass: false, detail: 'no death camera to look through' };
      }
      // The guard is the only way the camera comes down inside this check
      // short of the reinsert; if it fires, the numbers below are about
      // nothing, and the reason should be said rather than inferred.
      let guarded = null;
      const offGuard = h.emitter.on('deathcam:guard', (event) => { guarded = event.after; });

      // The death camera owns the camera, so render through it as the frame
      // loop would rather than repointing it.
      const grab = () => {
        deathCam.step(1 / 60, shade);
        renderer.render(h.scene, h.camera);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
        return buffer.slice();
      };

      grab();
      const withWarden = grab();
      warden.mesh.visible = false;
      const withoutWarden = grab();
      warden.mesh.visible = true;

      const killer = difference(withWarden, withoutWarden, width, height, 8);
      if (killer.count < 300) {
        problems.push(`the killer covered ${killer.count} pixels — it is not in frame`);
      } else {
        // Section 10.2 puts the camera ON the killer, so it should be somewhere
        // near the middle rather than clipped to a corner.
        const offX = Math.abs(killer.bounds.cx - width / 2) / width;
        const offY = Math.abs(killer.bounds.cy - height / 2) / height;
        if (offX > 0.3 || offY > 0.35) {
          problems.push(`the killer sits ${(offX * 100).toFixed(0)}%/${(offY * 100).toFixed(0)}% off centre`);
        }
      }

      // Section 15's ragdoll-lite: it must visibly move, then visibly stop.
      const early = [shade.mesh.position.clone(), shade.mesh.rotation.x, shade.mesh.rotation.z];
      h.stepFrames(Math.round(0.4 / CONFIG.time.fixedDt));
      const moved = shade.mesh.position.distanceTo(early[0])
        + Math.abs(shade.mesh.rotation.x - early[1]) + Math.abs(shade.mesh.rotation.z - early[2]);
      h.stepFrames(Math.round((CONFIG.effects.ragdollDuration + 0.5) / CONFIG.time.fixedDt));
      const settled = shade.mesh.position.clone();
      h.stepFrames(30);
      const drift = shade.mesh.position.distanceTo(settled);

      if (moved < 0.05) problems.push(`the ragdoll moved ${moved.toFixed(3)} in its first 0.4s — it is not tumbling`);
      if (drift > 1e-6) problems.push(`the ragdoll was still drifting ${drift.toFixed(4)} after it should have frozen`);
      if (gl.getError() !== 0) problems.push('GL error during the reads');
      offGuard();
      if (guarded !== null) problems.push(`the wall-clock guard fired ${guarded.toFixed(1)}s in, under the reads`);

      deathCam.restore();
      restore();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `the killer covers ${killer.count} pixels, centred within `
            + `${(Math.abs(killer.bounds.cx - width / 2) / width * 100).toFixed(0)}% of frame centre; `
            + `the body tumbled ${moved.toFixed(2)} then froze to ${drift.toFixed(5)} drift; `
            + `the view warmed in ${(warmMs / 1000).toFixed(1)}s before the kill`
          : problems.join('; '),
      };
    },
  });
}
