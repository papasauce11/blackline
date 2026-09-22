/**
 * BLACKLINE - tests/feedback.js
 *
 * AUTO suite: C3, hit and damage feedback. The hit marker, the damage
 * direction and the health vignette are drawn by the renderer (one
 * screen-space quad, systems/feedback.js), so these checks read them back
 * from the framebuffer the way every visual check does (tests/pixels.js):
 * render with the thing, render without it, and the difference is the
 * thing. Nothing here trusts a uniform; a uniform that is set and never
 * reaches a pixel is the failure these are for.
 *
 * Between two grabs no simulation step runs, so the only thing that can
 * differ is the feedback itself - not a swing pose, not a flickering light.
 * The knife is swung through the real input path (F into `pressedCodes`,
 * one fixed step); damage arrives through `combat.applyDamage`, the public
 * entry a frag uses, because a Warden that shoots on cue from a chosen side
 * is not something the AI offers.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { difference, brightnessDelta } from './pixels.js';
import { press } from './feel.js';

const F = CONFIG.feedback;

/** A reader of the real camera's view: settle the uniforms, draw, read back. */
function createReader(h) {
  const renderer = h.renderer;
  const gl = renderer.getContext();
  const width = renderer.domElement.width;
  const height = renderer.domElement.height;
  const buffer = new Uint8Array(width * height * 4);
  return {
    width,
    height,
    grab() {
      h.feedback.update(0);
      h.post.render(h.scene, h.camera);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
      return buffer.slice();
    },
  };
}

/** A quiet competitive match: the AI off, one real frame so the camera is on the Shade's rig. */
function settle(h) {
  h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: true });
  h.input.clearAll();
  h.stepFrames(10);
  h.renderFrame();
}

/** How many of the mask's pixels fall inside a centred box of the given fraction. */
function countInCentre(mask, width, height, fraction) {
  const halfW = Math.floor((width * fraction) / 2);
  const halfH = Math.floor((height * fraction) / 2);
  const cx = width >> 1;
  const cy = height >> 1;
  let n = 0;
  for (let y = cy - halfH; y < cy + halfH; y++) {
    for (let x = cx - halfW; x < cx + halfW; x++) if (mask[y * width + x]) n++;
  }
  return n;
}

/** The outer band of the frame, as a mask: where the vignette is strongest. */
function borderMask(width, height, fraction) {
  const mask = new Uint8Array(width * height);
  const bx = Math.floor(width * fraction);
  const by = Math.floor(height * fraction);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < bx || x >= width - bx || y < by || y >= height - by) mask[y * width + x] = 1;
    }
  }
  return mask;
}

/** A world point `distance` metres from the camera along one of its own axes. */
function fromCamera(h, axis, distance) {
  const camera = h.camera;
  camera.updateWorldMatrix(true, false);
  const origin = camera.getWorldPosition(new THREE.Vector3());
  const along = new THREE.Vector3(axis.x, axis.y, axis.z).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
  return origin.addScaledVector(along, distance);
}

/** The first code bound to the knife, so a rebind is still a knife. */
function meleeKey(h) {
  return h.input.getBinding('melee')[0];
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-vignette-deepens-with-lost-health-and-leaves-the-centre-alone',
    maps: ['plant'], // measured over the plant's site A; the darkening it wants is that backdrop's (D31)
    spec: 'Section 13, amended (20.14; C3)',
    name: 'Damage darkens the screen edge in proportion to health lost, the centre is untouched, and at full health nothing is drawn',
    run: (h) => {
      const problems = [];
      settle(h);
      const reader = createReader(h);
      const { width, height } = reader;
      try {
        // Somewhere lit (site A, the turbine hall): a red vignette over the
        // dark apron the Shade spawns on reddens black, which is not darker.
        // The number the queue asks for is a darkening, so it is measured
        // where there is light to take away, over the frame's outer band.
        const placeLit = () => {
          h.shade.reset({ position: h.map.sites[0].position, yaw: 0 });
          h.stepFrames(10);
          h.renderFrame();
        };
        placeLit();
        const band = borderMask(width, height, 0.1);
        if (h.feedback.mesh.visible) problems.push('at full health the feedback quad is visible (a draw call for nothing)');
        const base = reader.grab();

        h.combat.applyDamage(h.shade, CONFIG.shade.health / 2, 'shade', 'gun');
        const half = reader.grab();
        if (!h.feedback.mesh.visible) problems.push('at half health the feedback quad is not visible');
        h.combat.applyDamage(h.shade, CONFIG.shade.health * 0.4, 'shade', 'gun');
        const low = reader.grab();

        const dHalf = difference(base, half, width, height, 8);
        const dLow = difference(base, low, width, height, 8);
        if (dHalf.count < width * height * 0.05) {
          problems.push(`half health changed ${dHalf.count} pixels, want at least 5% of the frame`);
        } else {
          const b = dHalf.bounds;
          if (b.minX > 2 || b.minY > 2 || b.maxX < width - 3 || b.maxY < height - 3) {
            problems.push(`the vignette does not reach every edge: ${JSON.stringify(b)}`);
          }
        }
        const centreHalf = countInCentre(dHalf.mask, width, height, 0.4);
        const centreLow = countInCentre(dLow.mask, width, height, 0.4);
        if (centreHalf || centreLow) problems.push(`the centre 40% changed (${centreHalf} pixels at half, ${centreLow} at low)`);

        // Both over the same outer band, so the two numbers are one place at
        // two strengths.
        const darkHalf = brightnessDelta(base, half, band);
        const darkLow = brightnessDelta(base, low, band);
        if (!(darkHalf < -8)) problems.push(`half health: brightness over the outer band moved ${darkHalf.toFixed(1)}, want darker than -8`);
        if (!(darkLow < darkHalf * 1.3)) problems.push(`low health (${darkLow.toFixed(1)}) is not clearly darker than half (${darkHalf.toFixed(1)})`);
        if (dLow.count < dHalf.count) problems.push(`low health reaches fewer pixels (${dLow.count}) than half (${dHalf.count})`);

        // Back to full health through a new match: no draw call, and even a
        // forced draw of the quad puts nothing on the frame.
        settle(h);
        placeLit();
        const again = reader.grab();
        if (h.feedback.mesh.visible) problems.push('after a new match the quad is still visible');
        h.feedback.mesh.visible = true;
        const forced = reader.grab();
        h.feedback.mesh.visible = false;
        const dAgain = difference(again, forced, width, height, 8);
        if (dAgain.count > 0) problems.push(`at full health the quad still changes ${dAgain.count} pixels when drawn`);

        return {
          pass: problems.length === 0,
          detail: problems.length === 0
            ? `half health: ${dHalf.count} pixels changed, the outer band ${darkHalf.toFixed(1)} darker; low: ${dLow.count} pixels, ${darkLow.toFixed(1)}; `
              + 'the centre 40% untouched; full health draws nothing'
            : problems.join('; '),
        };
      } finally {
        settle(h);
      }
    },
  });

  debugTools.registerAutoTest({
    id: 'a-landed-knife-puts-a-hit-marker-at-the-centre-and-a-miss-does-not',
    spec: 'Section 13, amended (20.14; C3)',
    name: 'A knife that lands draws a small bright mark on the screen centre for hitMarkerTime; a swing at nothing draws none',
    run: (h) => {
      const problems = [];
      settle(h);
      const reader = createReader(h);
      const { width, height } = reader;
      try {
        // The Warden in front of the Shade at knife range, facing it, the
        // Shade facing the Warden (the arrangement tests/combat.js uses),
        // on the first site's floor - open on every map.
        const x = h.map.sites[0].position.x;
        const z = h.map.sites[0].position.z;
        const y = h.map.sites[0].position.y;
        h.warden.position.set(x, y + CONFIG.warden.standHeight / 2 + 0.05, z);
        h.warden.yaw = Math.PI;
        h.shade.position.set(x, y + CONFIG.shade.standHeight / 2 + 0.05, z + 1.2);
        h.shade.yaw = Math.atan2(-(x - h.shade.position.x), -(z - h.shade.position.z));
        h.stepFrames(5);
        h.renderFrame();

        press(h, meleeKey(h));
        h.stepFrames(1);
        h.input.clearAll();
        if (!(h.feedback.hitTimer > 0)) problems.push('the knife landed (or did not) and no hit marker was started');
        if (h.warden.health >= CONFIG.warden.health) problems.push(`the swing did not land: warden health ${h.warden.health}`);

        const on = reader.grab();
        h.feedback.hitTimer = 0;
        const off = reader.grab();
        const d = difference(off, on, width, height, 8);
        if (d.count < 20) {
          problems.push(`the hit marker changed ${d.count} pixels, want a visible mark`);
        } else {
          const b = d.bounds;
          const offX = Math.abs(b.cx - width / 2);
          const offY = Math.abs(b.cy - height / 2);
          const extent = Math.max(b.maxX - b.minX, b.maxY - b.minY);
          const limit = F.hitMarkerOuter * height + 4;
          if (offX > 4 || offY > 4) problems.push(`the mark is centred ${offX.toFixed(0)}/${offY.toFixed(0)} px off the screen centre`);
          if (extent > limit) problems.push(`the mark spans ${extent} px, more than hitMarkerOuter allows (${limit.toFixed(0)})`);
          if (extent < F.hitMarkerInner * height) problems.push(`the mark spans ${extent} px, smaller than hitMarkerInner`);
          const bright = brightnessDelta(off, on, d.mask);
          if (!(bright > 40)) problems.push(`the mark is only ${bright.toFixed(1)} brighter than what it covers`);
        }

        // It is timed: the marker's own clock runs it out.
        h.feedback.mark();
        h.feedback.update(F.hitMarkerTime + 0.01);
        if (h.feedback.hitTimer > 0 || h.feedback.uniforms.hit.value > 0) problems.push('the marker outlived hitMarkerTime');

        // A swing at nothing: the Warden out of range.
        h.warden.position.set(x, CONFIG.warden.standHeight / 2 + 0.05, z - CONFIG.combat.knife.range - 3);
        h.stepFrames(Math.ceil(CONFIG.combat.knife.swingInterval / CONFIG.time.fixedDt) + 2);
        press(h, meleeKey(h));
        h.stepFrames(1);
        h.input.clearAll();
        if (h.feedback.hitTimer > 0) problems.push('a swing at nothing started a hit marker');

        return {
          pass: problems.length === 0,
          detail: problems.length === 0
            ? `a landed knife: ${d.count} pixels centred on the screen, ${brightnessDelta(off, on, d.mask).toFixed(0)} brighter, `
              + `${d.bounds.maxX - d.bounds.minX}x${d.bounds.maxY - d.bounds.minY} px, gone after ${F.hitMarkerTime}s; a miss draws nothing`
            : problems.join('; '),
        };
      } finally {
        settle(h);
      }
    },
  });

  debugTools.registerAutoTest({
    id: 'damage-draws-an-arc-toward-where-it-came-from',
    spec: 'Section 13, amended (20.14; C3)',
    name: 'Damage from the camera\'s right draws on the right of the screen, from the left on the left, from behind at the bottom, and the arc fades on its clock',
    run: (h) => {
      const problems = [];
      settle(h);
      const reader = createReader(h);
      const { width, height } = reader;
      const sides = [];
      try {
        // Every frame at the same health, so the vignette is the same in all
        // of them and the arc is the only difference against `none`.
        const held = CONFIG.shade.health - 10;
        const hit = (from) => {
          h.combat.applyDamage(h.shade, 10, 'shade', 'gun', from);
          h.shade.health = held;
          return reader.grab();
        };
        h.shade.health = held;
        h.feedback.indicatorTimer = 0;
        const none = reader.grab();

        const cases = [
          ['right', { x: 1, y: 0, z: 0 }, (b) => b.minX > width / 2 + 10, 'entirely right of centre'],
          ['left', { x: -1, y: 0, z: 0 }, (b) => b.maxX < width / 2 - 10, 'entirely left of centre'],
          // readPixels rows run bottom-up: behind is the bottom of the screen, low y.
          ['behind', { x: 0, y: 0, z: 1 }, (b) => b.maxY < height / 2 - 10, 'entirely below centre'],
          ['ahead', { x: 0, y: 0, z: -1 }, (b) => b.minY > height / 2 + 10, 'entirely above centre'],
        ];
        for (const [name, axis, where, want] of cases) {
          const frame = hit(fromCamera(h, axis, 6));
          if (!(h.feedback.indicatorTimer > 0)) problems.push(`${name}: damage with a source started no indicator`);
          const d = difference(none, frame, width, height, 8);
          if (d.count < 20) {
            problems.push(`${name}: the arc changed ${d.count} pixels, want a visible arc`);
            continue;
          }
          const radius = Math.hypot(d.bounds.cx - width / 2, d.bounds.cy - height / 2) / (height / 2);
          if (!where(d.bounds)) problems.push(`${name}: the arc is not ${want}: ${JSON.stringify(d.bounds)}`);
          if (Math.abs(radius - F.indicatorRadius) > 0.1) {
            problems.push(`${name}: the arc sits ${radius.toFixed(2)} half-heights from the centre, want ${F.indicatorRadius}`);
          }
          sides.push(`${name} ${d.count}px at ${radius.toFixed(2)}`);
        }

        // Damage with no known source draws no arc.
        h.feedback.indicatorTimer = 0;
        h.combat.applyDamage(h.shade, 10, 'shade', 'gun');
        h.shade.health = held;
        if (h.feedback.indicatorTimer > 0) problems.push('damage with no source started an indicator');

        // It fades on its clock.
        h.combat.applyDamage(h.shade, 10, 'shade', 'gun', fromCamera(h, { x: 1, y: 0, z: 0 }, 6));
        h.shade.health = held;
        h.feedback.update(F.indicatorTime + 0.01);
        const after = reader.grab();
        const dAfter = difference(none, after, width, height, 8);
        if (dAfter.count > 0) problems.push(`${dAfter.count} pixels of arc remain after indicatorTime`);

        return {
          pass: problems.length === 0,
          detail: problems.length === 0
            ? `${sides.join(', ')} (half-heights); no source, no arc; gone after ${F.indicatorTime}s`
            : problems.join('; '),
        };
      } finally {
        settle(h);
      }
    },
  });
}
