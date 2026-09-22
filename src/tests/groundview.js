/**
 * BLACKLINE - tests/groundview.js
 *
 * AUTO suite (Section 16, Section 17.1): the Warden-ground overlay (Block A7).
 *
 * `map.wardenGround` decides whether a plant is legal, and until A7 nothing
 * could draw a cell of it. These prove the overlay is off unless asked for,
 * that asking for it - the real keys, through the real frame - puts something
 * measurable on the floor, and that the marker follows the actor onto ground
 * the Warden could reach and off ground it could not.
 *
 * Registered from tests/index.js. Checks reach the live game through the
 * harness `h`; nothing here imports main.js, which Section 3.1 forbids.
 */

import { CONFIG, DEBUG_KEYS } from '../config.js';
import { createLens, difference, brightnessDelta, quiesce, SITE_SAMPLE_OFFSET } from './pixels.js';
import { perchesInSiteRooms } from './plantspots.js';

export function register(debugTools) {
  /**
   * Press one debug key the way the frame does: the edge goes into
   * `input.pressedCodes` and `debugTools.pollKeys()` reads it, which is the
   * first thing `renderFrame` does. Not `renderFrame` itself, because that
   * also re-parents the camera to the actor's rig every frame - and a lens
   * pointed at the floor would be pointed at the floor no longer.
   */
  const press = (h, code) => {
    h.input.pressedCodes.add(code);
    h.input.heldCodes.add(code);
    h.debugTools.pollKeys();
    h.input.clearEdges();
    h.input.heldCodes.delete(code);
  };

  debugTools.registerAutoTest({
    id: 'the-warden-ground-overlay-is-off-by-default',
    spec: 'Section 17 / Block A7',
    name: 'The Warden-ground overlay is in the scene, hidden, and costs no draw call until asked for',
    run: (h) => {
      const problems = [];
      const restore = quiesce(h);
      const view = h.groundView;
      if (!view) return { pass: false, detail: 'no groundView on the harness' };

      if (view.visible) problems.push('visible after initMatch');
      let inScene = false;
      h.scene.traverse((object) => { if (object === view.root) inScene = true; });
      if (!inScene) problems.push('the overlay root is not in the scene, so toggling it would draw nothing');
      if (view.field.geometry.index.count / 6 !== h.map.wardenGround.count) {
        problems.push(`the field has ${view.field.geometry.index.count / 6} quads for ${h.map.wardenGround.count} cells`);
      }

      // No draw call while hidden, one or two while shown, none again after.
      h.renderFrame(1 / 60);
      const hidden = h.renderer.info.render.calls;
      view.setVisible(true);
      h.renderFrame(1 / 60);
      const shown = h.renderer.info.render.calls;
      view.setVisible(false);
      h.renderFrame(1 / 60);
      const after = h.renderer.info.render.calls;
      // The exact cost depends on how many passes the frame renders the scene
      // in; what matters is that hidden costs nothing and shown costs something.
      if (shown <= hidden) problems.push(`showing it did not add a draw call (${hidden} -> ${shown})`);
      if (after !== hidden) problems.push(`hiding it left draw calls at ${after}, was ${hidden}`);

      // A new match does not bring it back.
      view.setVisible(true);
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      if (h.groundView.visible) problems.push('a new match kept the overlay on');

      restore();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `hidden by default, ${h.map.wardenGround.count} quads in one mesh, draw calls ${hidden} hidden / ${shown} shown / ${after} hidden again, off after initMatch`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-warden-ground-overlay-draws-the-set-on-the-floor',
    spec: 'Section 17 / Block A7',
    name: 'F4 then the overlay key measurably changes a site floor; the marker follows the actor onto reachable ground',
    run: (h) => {
      const problems = [];
      const restore = quiesce(h);
      const view = h.groundView;
      const lens = createLens(h);
      const t = DEBUG_KEYS.test;

      // Looking down at the floor of site A, off the ring, the way the lighting
      // checks do: the ring pulses and would be read at different points in it.
      const site = h.map.sites[0];
      const at = { x: site.position.x + SITE_SAMPLE_OFFSET, y: site.position.y, z: site.position.z };
      lens.look({ x: at.x, y: at.y + 3.0, z: at.z + 0.01 }, at);
      h.shade.mesh.visible = false;
      h.warden.mesh.visible = false;
      h.shade.groundBlob.visible = false;
      h.warden.groundBlob.visible = false;
      lens.grab();

      try {
        const before = lens.grab();

        // The real keys: F4 opens test mode, then the overlay key. The panel's
        // bindings are inert until it is open, which is the point of pressing
        // F4 rather than calling setVisible.
        const wasTestMode = h.debugTools.testModeVisible;
        if (!wasTestMode) press(h, DEBUG_KEYS.toggleTestMode);
        press(h, t.toggleWardenGround);
        if (!view.visible) problems.push('F4 then the overlay key did not show the overlay');
        const shown = lens.grab();

        press(h, t.toggleWardenGround);
        if (view.visible) problems.push('a second press did not hide it');
        if (!wasTestMode) press(h, DEBUG_KEYS.toggleTestMode);
        const after = lens.grab();

        const on = difference(before, shown, lens.width, lens.height);
        const off = difference(before, after, lens.width, lens.height);
        const fraction = on.count / lens.pixels;
        if (fraction < 0.2) problems.push(`the overlay changed ${(fraction * 100).toFixed(1)}% of a floor-facing frame, want at least 20%`);
        const lift = brightnessDelta(before, shown, on.mask);
        if (lift <= 0) problems.push(`the overlay made the floor darker (${lift.toFixed(1)}), want a lift`);
        if (off.count / lens.pixels > 0.02) problems.push(`${(off.count / lens.pixels * 100).toFixed(1)}% of the frame still differs after hiding it`);

        // The marker: on a floor cell it appears under the actor; on a top the
        // Warden could never reach, it does not. Through the real frame, so
        // the lens goes first - the frame owns the camera again from here.
        lens.restore();
        h.shade.mesh.visible = true;
        h.warden.mesh.visible = true;
        h.shade.groundBlob.visible = true;
        h.warden.groundBlob.visible = true;
        view.setVisible(true);
        h.shade.position.set(at.x, at.y + CONFIG.shade.standHeight / 2 + 0.05, at.z);
        h.renderFrame(1 / 60);
        if (!view.marker.visible) problems.push('no marker under the Shade on a floor cell');
        else {
          const gap = Math.hypot(view.marker.position.x - at.x, view.marker.position.z - at.z);
          if (gap > h.map.wardenGround.cell) problems.push(`the marker is ${gap.toFixed(2)}m from the Shade`);
        }
        const unreachable = perchesInSiteRooms(h).find((perch) => !h.objective.canDefuseAt(perch.foot));
        if (unreachable) {
          h.shade.position.set(unreachable.body.x, unreachable.body.y, unreachable.body.z);
          h.renderFrame(1 / 60);
          if (view.marker.visible) problems.push(`the marker followed the Shade onto ${unreachable.tag}, which the Warden cannot reach`);
        }
        view.setVisible(false);
        h.renderFrame(1 / 60);

        return {
          pass: problems.length === 0,
          detail: problems.length === 0
            ? `F4 + ${t.toggleWardenGround} changed ${(fraction * 100).toFixed(0)}% of a floor-facing frame by +${lift.toFixed(0)} per channel; `
              + `hidden again within ${(off.count / lens.pixels * 100).toFixed(1)}%; marker under the Shade on the floor, `
              + `gone on ${unreachable ? unreachable.tag : 'an unreachable top'}`
            : problems.join('; '),
        };
      } finally {
        view.setVisible(false);
        h.shade.mesh.visible = true;
        h.warden.mesh.visible = true;
        h.shade.groundBlob.visible = true;
        h.warden.groundBlob.visible = true;
        if (h.cameraOwner === null) lens.restore();
        restore();
      }
    },
  });
}
