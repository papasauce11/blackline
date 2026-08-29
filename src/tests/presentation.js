/**
 * BLACKLINE - tests/presentation.js
 *
 * AUTO suite (Section 16, Section 17.1): Effects and UI.
 *
 * Fixed pools that never grow, ragdoll-lite freezing, and the HUD reading the
 * same smoothed meter Section 4.2 drives the character with.
 *
 * Registered from tests/index.js. Checks reach the live game through the
 * harness `h`; nothing here imports main.js, which Section 3.1 forbids.
 */

import { CONFIG } from '../config.js';

const E = CONFIG.effects;
const GA = CONFIG.gadgets;

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'pause-stops-the-world-without-banking-time',
    spec: 'Section 13',
    name: 'Esc halts the simulation, releases the mouse, and resumes where it stopped',
    run: (h) => {
      const problems = [];
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      h.setPaused(false);
      h.stepFrames(30);

      const before = {
        sim: h.clock.sim,
        shade: h.shade.position.clone(),
        warden: h.warden.position.clone(),
        time: h.objective.round.timeRemaining,
      };

      h.setPaused(true);
      if (!h.paused) problems.push('setPaused(true) did not take');
      if (!h.menu.open) problems.push('pausing did not raise the menu');
      if (h.menu.page !== 'pause') problems.push(`the menu is on "${h.menu.page}", want "pause"`);

      // Real frames, with a full second of wall clock handed to each — the
      // simulation must not advance by a single step.
      for (let i = 0; i < 20; i++) h.renderFrame(1.0);

      if (h.clock.sim !== before.sim) {
        problems.push(`the sim clock moved ${(h.clock.sim - before.sim).toFixed(3)}s while paused`);
      }
      if (h.shade.position.distanceTo(before.shade) > 1e-9) problems.push('the Shade moved while paused');
      if (h.warden.position.distanceTo(before.warden) > 1e-9) problems.push('the Warden moved while paused');
      if (h.objective.round.timeRemaining !== before.time) problems.push('the round clock ran while paused');
      if (h.debugState.stepsPerFrame !== 0) problems.push(`${h.debugState.stepsPerFrame} steps ran on a paused frame`);

      // Resuming must not replay the twenty seconds it was paused for.
      h.menu.hide();
      h.setPaused(false);
      h.renderFrame(1 / 60);
      const caughtUp = h.clock.sim - before.sim;
      if (caughtUp > CONFIG.time.fixedDt * CONFIG.time.maxStepsPerFrame + 1e-6) {
        problems.push(`resuming replayed ${caughtUp.toFixed(3)}s of banked time`);
      }
      if (h.clock.sim <= before.sim) problems.push('resuming did not restart the simulation');

      // Esc toggles both ways through the real binding, and one press does not
      // pause and immediately unpause.
      h.menu.hide();
      h.setPaused(false);
      h.input.clearAll();
      h.input.pressedCodes.add('Escape');
      h.renderFrame(1 / 60);
      const pausedByKey = h.paused;
      h.input.pressedCodes.add('Escape');
      h.renderFrame(1 / 60);
      const resumedByKey = !h.paused;
      if (!pausedByKey) problems.push('Escape did not pause');
      if (!resumedByKey) problems.push('Escape did not resume');

      h.input.clearAll();
      h.menu.hide();
      h.setPaused(false);
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? '20 frames at 1s each while paused advanced the simulation by 0.000s and moved neither actor; '
            + `resuming stepped forward ${caughtUp.toFixed(3)}s rather than replaying the pause; `
            + 'Escape toggles both ways through the real binding'
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-rim-light-is-really-on-screen',
    spec: 'Section 4.2 / check 27',
    name: 'Reads the framebuffer: the rim brightens the Shade, and at its edges',
    run: (h) => {
      const problems = [];
      const F = CONFIG.detection.feedback;
      const renderer = h.renderer;
      const gl = renderer.getContext();
      const camera = h.camera;
      const shade = h.shade;

      const rim = shade.mesh.userData.rim;
      if (!rim) return { pass: false, detail: 'the Shade has no rim uniforms' };

      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.stepFrames(20);

      // Frame the Shade close up, from the scene rather than from a rig, so
      // nothing reparents the camera underneath the reads.
      const owner = h.cameraOwner;
      h.setCameraOwner(null);
      h.scene.add(camera);
      const feet = shade.feetY;
      camera.position.set(shade.position.x + 3, feet + 1.2, shade.position.z + 3);
      camera.lookAt(shade.position.x, feet + 1.0, shade.position.z);
      camera.updateMatrixWorld(true);

      const width = renderer.domElement.width;
      const height = renderer.domElement.height;
      const buffer = new Uint8Array(width * height * 4);
      const grab = () => {
        renderer.render(h.scene, camera);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
        return buffer.slice();
      };

      const startStrength = rim.uBlRimStrength.value;

      // 1. The silhouette, by difference: the same scene with and without a body.
      shade.mesh.visible = false;
      const empty = grab();
      shade.mesh.visible = true;
      rim.uBlRimStrength.value = 0;
      const bodyOnly = grab();

      const count = width * height;
      const mask = new Uint8Array(count);
      let masked = 0;
      for (let i = 0; i < count; i++) {
        const p = i * 4;
        const d = Math.abs(bodyOnly[p] - empty[p])
          + Math.abs(bodyOnly[p + 1] - empty[p + 1])
          + Math.abs(bodyOnly[p + 2] - empty[p + 2]);
        if (d > 8) {
          mask[i] = 1;
          masked++;
        }
      }
      if (masked < 500) {
        rim.uBlRimStrength.value = startStrength;
        h.setCameraOwner(owner);
        return { pass: false, detail: `the Shade covered only ${masked} pixels — nothing to measure` };
      }

      // 2. The rim, by difference: same body, strength 0 vs its maximum.
      rim.uBlRimStrength.value = F.rimStrengthMax;
      const lit = grab();

      // 3. Erode the mask to separate the edge band from the interior. A rim
      //    light brightens grazing angles, which is the silhouette boundary —
      //    if the delta were flat across the body it would be an ambient add
      //    wearing a rim's name.
      const erode = (source) => {
        const out = new Uint8Array(count);
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const i = y * width + x;
            if (!source[i]) continue;
            if (source[i - 1] && source[i + 1] && source[i - width] && source[i + width]) out[i] = 1;
          }
        }
        return out;
      };
      const inner2 = erode(erode(mask));
      const inner5 = erode(erode(erode(inner2)));

      let edgeSum = 0;
      let edgeCount = 0;
      let coreSum = 0;
      let coreCount = 0;
      let brightened = 0;
      for (let i = 0; i < count; i++) {
        if (!mask[i]) continue;
        const p = i * 4;
        const delta = (lit[p] - bodyOnly[p]) + (lit[p + 1] - bodyOnly[p + 1]) + (lit[p + 2] - bodyOnly[p + 2]);
        if (delta > 6) brightened++;
        if (!inner2[i]) {
          edgeSum += delta;
          edgeCount++;
        } else if (inner5[i]) {
          coreSum += delta;
          coreCount++;
        }
      }
      const edgeMean = edgeCount ? edgeSum / edgeCount : 0;
      const coreMean = coreCount ? coreSum / coreCount : 0;

      if (brightened < 200) problems.push(`the rim changed only ${brightened} pixels of ${masked}`);
      if (edgeMean <= 0) problems.push('the silhouette edge did not brighten at all');
      if (!(edgeMean > coreMean * 1.5)) {
        problems.push(`edge +${edgeMean.toFixed(1)} vs core +${coreMean.toFixed(1)} — that is a wash, not a rim`);
      }

      // 4. And the strength is driven by the meter, not set by hand.
      const at = (value) => {
        h.detection.smoothed = value;
        h.detection._applyFeedback(shade);
        return rim.uBlRimStrength.value;
      };
      const atDark = at(0);
      const atLit = at(CONFIG.detection.meterMax);
      if (!(atLit > atDark)) problems.push(`rim strength ${atDark} -> ${atLit} across the meter`);
      if (Math.abs(atDark - F.rimStrengthMin) > 1e-6) problems.push(`at meter 0 the rim is ${atDark}, want ${F.rimStrengthMin}`);
      if (Math.abs(atLit - F.rimStrengthMax) > 1e-6) problems.push(`at meter 100 the rim is ${atLit}, want ${F.rimStrengthMax}`);

      if (gl.getError() !== 0) problems.push('GL reported an error during the reads');

      rim.uBlRimStrength.value = startStrength;
      h.setCameraOwner(owner);
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `read back ${width}x${height}: the Shade covers ${masked} pixels, the rim brightened `
            + `${brightened} of them by +${edgeMean.toFixed(1)} at the silhouette against +${coreMean.toFixed(1)} `
            + `in the interior (${(edgeMean / Math.max(coreMean, 0.01)).toFixed(1)}x); `
            + `strength ${F.rimStrengthMin} -> ${F.rimStrengthMax} across meter 0..${CONFIG.detection.meterMax}`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'effect-pools-are-fixed-and-drain',
    spec: 'Section 15 (footprint leak, particle framerate)',
    name: 'Footprints, particles and smoke recycle a fixed pool and return to zero',
    run: (h) => {
      const effects = h.effects;
      const dt = CONFIG.time.fixedDt;
      const problems = [];
      effects.reset();

      const sizes = {
        footprints: effects.footprints.length,
        particles: effects.particles.length,
        smoke: effects.smoke.length,
      };
      if (sizes.footprints !== E.footprintPoolSize) problems.push(`footprint pool ${sizes.footprints}`);
      if (sizes.particles !== E.particlePoolSize) problems.push(`particle pool ${sizes.particles}`);
      if (sizes.smoke !== GA.smoke.spriteCap) problems.push(`smoke pool ${sizes.smoke}`);

      // Flood every pool well past its size. The pools must recycle, not grow.
      const at = { x: -18, y: 0.1, z: -4 };
      for (let i = 0; i < E.footprintPoolSize * 3; i++) effects.footprint(at, 'shade');
      for (let i = 0; i < 8; i++) effects.sparks(at, 40);
      for (let i = 0; i < 6; i++) effects.smokeBurst(at);

      if (effects.footprints.length !== sizes.footprints) problems.push('the footprint pool grew');
      if (effects.particles.length !== sizes.particles) problems.push('the particle pool grew');
      if (effects.smoke.length !== sizes.smoke) problems.push('the smoke pool grew');
      if (effects.pooledSprites > GA.smoke.spriteCap) {
        problems.push(`${effects.pooledSprites} sprites, cap is ${GA.smoke.spriteCap}`);
      }
      const peak = effects.activeCount;

      // One shared material each, and one draw call each (Section 15).
      const materials = new Set([
        effects.footprintMesh.material, effects.particleMesh.material, effects.smokeMesh.material,
      ]);
      if (materials.size !== 3) problems.push('the three pools do not each have exactly one material');

      // Section 15: everything returns to zero. Smoke is the longest at 8s.
      let steps = 0;
      while (effects.activeCount > 0 && steps++ < 30 / dt) effects.step(dt);
      if (effects.activeCount !== 0) problems.push(`${effects.activeCount} effects left after ${(steps * dt).toFixed(1)}s`);

      effects.reset();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `pools fixed at ${sizes.footprints}/${sizes.particles}/${sizes.smoke}, flooded to ${peak} active, drained to 0 in ${(steps * dt).toFixed(1)}s, one material each`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'ragdoll-is-lite-and-freezes',
    spec: 'Section 15 (ragdoll goes unstable)',
    name: 'One impulse, damped tumble, frozen after 2s and never below the floor',
    run: (h) => {
      const effects = h.effects;
      const dt = CONFIG.time.fixedDt;
      const problems = [];
      effects.reset();

      const mesh = h.warden.mesh;
      const startRotation = mesh.rotation.x;
      mesh.position.set(-18, 1, -4);
      effects.ragdoll(mesh, { x: 1, y: 0, z: 0 });
      if (effects.ragdolls.length !== 1) problems.push('no ragdoll started');

      let lowest = Infinity;
      let steps = 0;
      while (effects.ragdolls.length > 0 && steps++ < 10 / dt) {
        effects.step(dt);
        lowest = Math.min(lowest, mesh.position.y);
        if (!Number.isFinite(mesh.position.y) || !Number.isFinite(mesh.rotation.x)) {
          problems.push('ragdoll went non-finite');
          break;
        }
      }
      const seconds = steps * dt;
      const frozen = mesh.position.clone();
      const rotated = Math.abs(mesh.rotation.x - startRotation) > 1e-6;

      // Frozen means frozen: further steps must not move it.
      for (let i = 0; i < 1 / dt; i++) effects.step(dt);
      if (frozen.distanceTo(mesh.position) > 1e-9) problems.push('the ragdoll kept moving after freezing');
      if (Math.abs(seconds - E.ragdollDuration) > 0.1) {
        problems.push(`froze after ${seconds.toFixed(2)}s, spec is ${E.ragdollDuration}s`);
      }
      if (lowest < -0.001) problems.push(`sank to y=${lowest.toFixed(3)}, below the floor`);
      if (!rotated) problems.push('it never tumbled');

      mesh.rotation.set(0, 0, 0);
      effects.reset();
      h.warden.reset(h.map.wardenSpawns[0]);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `tumbled and froze after ${seconds.toFixed(2)}s (spec ${E.ragdollDuration}s), stayed on or above the floor, and stopped dead`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'hud-reads-the-meter-it-is-shown-beside',
    spec: 'Section 4.2 / Section 13',
    name: 'The visibility bar tracks the smoothed meter, and lives dim as they are spent',
    run: (h) => {
      const hud = h.hud;
      const problems = [];
      if (!hud) return { pass: false, detail: 'no HUD' };

      const read = () => parseFloat(hud.el.visFill.style.height) || 0;
      for (const value of [0, 25, 60, 100]) {
        hud.update(0, { role: 'shade', visibility: value, lives: 3, health: 100, score: { shade: 0, warden: 0 } });
        // Section 4.2: the bar reads the meter, it does not compute its own.
        if (Math.abs(read() - value) > 0.51) problems.push(`meter ${value} drew ${read()}%`);
      }

      // Three pips, dimming as they are spent (Section 13).
      for (const lives of [3, 2, 0]) {
        hud.update(0, { role: 'shade', visibility: 0, lives, health: 100, score: { shade: 0, warden: 0 } });
        const spent = hud._pips.filter((pip) => pip.classList.contains('spent')).length;
        if (spent !== CONFIG.hud.livesPips - lives) problems.push(`${lives} lives dimmed ${spent} pips`);
      }

      // On death the centre carries the reinsert countdown (Section 13).
      hud.update(0, {
        role: 'shade', visibility: 0, lives: 2, health: 0, score: { shade: 0, warden: 0 },
        awaitingReinsert: true, reinsertIn: 9.4,
      });
      if (hud.el.centre.style.display !== 'block') problems.push('no reinsert countdown on death');
      if (hud.el.centreBig.textContent !== '10') problems.push(`countdown read ${hud.el.centreBig.textContent}`);

      // Free-roam shows a crosshair whose gap is the live spread.
      hud.update(0, { role: 'warden', health: 100, magazine: 30, spread: 4, score: { shade: 0, warden: 0 } });
      if (hud.el.crosshair.style.display !== 'block') problems.push('no crosshair in free-roam');
      const wide = parseFloat(hud.el.crossBars[1].style.left);
      hud.update(0, { role: 'warden', health: 100, magazine: 30, spread: 0.6, score: { shade: 0, warden: 0 } });
      const tight = parseFloat(hud.el.crossBars[1].style.left);
      if (!(wide > tight)) problems.push('the crosshair did not widen with spread');

      hud.update(0, { role: 'shade', visibility: 0, lives: 3, health: 100, score: { shade: 0, warden: 0 } });
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `bar tracked 0/25/60/100 exactly, pips dimmed 0/1/3, reinsert countdown replaced the centre, crosshair gap ${tight}px -> ${wide}px with spread`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'menu-is-the-audio-gate-and-the-only-entry',
    spec: 'Section 12, Section 13, Section 15 (autoplay)',
    name: 'Play fires the gesture once and both modes go through initMatch',
    run: (h) => {
      const menu = h.menu;
      const problems = [];
      if (!menu) return { pass: false, detail: 'no menu' };

      const wasOpen = menu.open;
      let gestures = 0;
      let plays = 0;
      let freeRoams = 0;
      const original = menu.handlers;
      menu.handlers = {
        onFirstGesture: () => gestures++,
        onPlay: () => plays++,
        onFreeRoam: () => freeRoams++,
      };
      menu.gestureFired = false;
      menu.show('main');

      menu.root.querySelector('[data-action=play]').click();
      if (plays !== 1) problems.push('Play did not start a match');
      if (gestures !== 1) problems.push(`Play fired ${gestures} gestures, want exactly 1`);
      if (menu.open) problems.push('the menu stayed open after Play');

      // The gate is once per session, not once per button.
      menu.show('main');
      menu.root.querySelector('[data-action=freeroam]').click();
      if (freeRoams !== 1) problems.push('Free Roam did not start');
      if (gestures !== 1) problems.push(`the gesture fired again (${gestures} total)`);

      // Settings is reachable and does not start anything.
      menu.show('main');
      menu.root.querySelector('[data-action=settings]').click();
      if (!menu.root.querySelector('#bl-sens')) problems.push('settings did not render');
      if (plays !== 1 || freeRoams !== 1) problems.push('settings started a match');

      menu.handlers = original;
      // Leave the menu as it was found: this check clicked its way out of it.
      if (wasOpen) menu.show('main');
      else menu.hide();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? 'Play and Free Roam both route through initMatch; the audio gesture fired exactly once across both; settings starts nothing'
          : problems.join('; '),
      };
    },
  });
}
