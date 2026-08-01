/**
 * BLACKLINE - tests/warden.js
 *
 * AUTO suite (Section 16, Section 17.1): Warden controller.
 *
 * Speeds, camera handover, the shared intent contract and the actor meshes.
 *
 * Registered from tests/index.js. Checks reach the live game through the
 * harness `h`; nothing here imports main.js, which Section 3.1 forbids.
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { WARDEN_STATE, createWardenIntent } from '../entities/enforcer.js';

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'camera-swap-leaks-no-state',
    spec: 'Section 15 / phase 4 exit gate',
    name: 'Swapping the camera between roles leaks no transform, FOV or instance',
    run: (h) => {
      const problems = [];
      const owners = ['shade', 'warden', 'freefly', 'warden', 'shade', 'freefly', 'shade'];
      const rigFor = (owner) =>
        owner === 'warden' ? h.warden.cameraRig : owner === 'shade' ? h.shade.cameraRig : h.scene;

      // Dirty every piece of camera state a previous owner could have touched.
      const dirty = () => {
        h.camera.position.set(3, -2, 7);
        h.camera.rotation.set(0.4, -1.1, 0.9);
        h.camera.scale.set(2, 2, 2);
        h.camera.fov = 12;
        h.camera.updateProjectionMatrix();
      };

      for (const owner of owners) {
        dirty();
        h.setCameraOwner(null); // force a genuine handover every time
        h.setCameraOwner(owner);

        if (h.camera.parent !== rigFor(owner)) problems.push(`${owner}: wrong parent`);
        if (h.camera.position.length() > 1e-9) problems.push(`${owner}: local position leaked`);
        if (Math.abs(h.camera.rotation.x) + Math.abs(h.camera.rotation.y) + Math.abs(h.camera.rotation.z) > 1e-9) {
          problems.push(`${owner}: local rotation leaked`);
        }
        if (Math.abs(h.camera.scale.x - 1) > 1e-9) problems.push(`${owner}: scale leaked`);
        if (Math.abs(h.camera.fov - CONFIG.render.fov) > 1e-9) problems.push(`${owner}: fov leaked (${h.camera.fov})`);

        let count = 0;
        h.scene.traverse((object) => {
          if (object.isCamera) count++;
        });
        if (count !== 1) problems.push(`${owner}: ${count} cameras in the graph`);
      }

      // The real leak this guards: ADS narrows the FOV, so swapping away
      // mid-aim must not leave the next owner zoomed in.
      h.setCameraOwner('warden');
      h.warden.adsBlend = 1;
      h.camera.fov = h.warden.desiredFov();
      h.camera.updateProjectionMatrix();
      const adsFov = h.camera.fov;
      h.setCameraOwner('shade');
      const restored = Math.abs(h.camera.fov - CONFIG.render.fov) < 1e-9;
      if (!restored) problems.push(`ads fov ${adsFov.toFixed(1)} survived the swap as ${h.camera.fov.toFixed(1)}`);
      h.warden.adsBlend = 0;

      // The body must be hidden only while the camera is inside its head.
      h.setCameraOwner('warden');
      const hiddenInFirstPerson = h.warden.mesh.visible === false;
      h.setCameraOwner('shade');
      const shownOtherwise = h.warden.mesh.visible === true;
      if (!hiddenInFirstPerson) problems.push('warden body visible in first person');
      if (!shownOtherwise) problems.push('warden body still hidden after swapping away');

      return {
        pass: problems.length === 0,
        detail:
          problems.length === 0
            ? `${owners.length} handovers across shade/warden/freefly: parent, local transform, scale and FOV reset every time; ADS fov ${adsFov.toFixed(1)} restored to ${CONFIG.render.fov}; exactly 1 camera throughout`
            : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'warden-speeds-and-no-crouch',
    spec: 'Section 6.2',
    name: 'Warden walk, sprint and ADS speeds match spec; crouch is unavailable',
    run: (h) => {
      const dt = CONFIG.time.fixedDt;
      const intent = createWardenIntent();

      const settle = (sprint, ads) => {
        h.warden.reset(h.map.wardenSpawns[0]);
        h.warden.position.set(-24, CONFIG.warden.standHeight / 2 + 0.05, -19);
        h.warden.yaw = Math.PI; // down the clear lane of the Turbine Hall
        intent.forward = 1;
        intent.strafe = 0;
        intent.sprint = sprint;
        intent.ads = ads;
        for (let i = 0; i < 180; i++) h.warden.step(dt, intent);
        return h.warden.speed;
      };

      const walk = settle(false, false);
      const sprint = settle(true, false);
      const ads = settle(false, true);

      // Section 6.2: "Crouch | Not available. Wardens are heavy."
      const noCrouchApi = typeof h.warden.crouching === 'undefined' && CONFIG.warden.canCrouch === false;
      const heightHeld = Math.abs(h.warden.half.y * 2 - CONFIG.warden.standHeight) < 1e-9;

      h.warden.reset(h.map.wardenSpawns[0]);

      const near = (value, target) => Math.abs(value - target) < 0.15;
      return {
        pass: near(walk, CONFIG.warden.walkSpeed) && near(sprint, CONFIG.warden.sprintSpeed) &&
          near(ads, CONFIG.warden.adsSpeed) && noCrouchApi && heightHeld,
        detail: `walk ${walk.toFixed(2)}/${CONFIG.warden.walkSpeed}, sprint ${sprint.toFixed(2)}/${CONFIG.warden.sprintSpeed}, ads ${ads.toFixed(2)}/${CONFIG.warden.adsSpeed} m/s; no crouch api=${noCrouchApi}, capsule height fixed=${heightHeld}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'warden-shared-by-ai-and-human',
    spec: 'Section 6.2 / Section 12 / Section 15',
    name: 'One Warden controller serves both drivers through the same intent',
    run: (h) => {
      // Free-roam must be a configuration of initMatch, not a second path.
      const before = h.match;
      const free = h.initMatch({ mode: 'freeroam', role: 'warden', ai: false, objective: false, seed: before.seed });
      const isFreeRoam = free.mode === 'freeroam' && free.role === 'warden' && free.aiEnabled === false && free.objectiveEnabled === false;

      // Drive the controller with a synthetic intent, exactly as the AI will.
      const dt = CONFIG.time.fixedDt;
      const intent = createWardenIntent();
      intent.forward = 1;
      const start = h.warden.position.clone();
      for (let i = 0; i < 60; i++) h.warden.step(dt, intent);
      const movedByIntent = h.warden.position.distanceTo(start) > 0.5;

      // Stun blocks movement entirely (Section 11 STUNNED, Section 9 taser).
      h.warden.stun(1.0);
      const stunStart = h.warden.position.clone();
      for (let i = 0; i < 30; i++) h.warden.step(dt, intent);
      const frozenWhileStunned = h.warden.position.distanceTo(stunStart) < 0.05;
      const stunnedState = h.warden.state === WARDEN_STATE.STUNNED;
      for (let i = 0; i < 45; i++) h.warden.step(dt, createWardenIntent());
      const recovered = h.warden.state !== WARDEN_STATE.STUNNED;

      const back = h.initMatch({ mode: 'competitive', role: 'shade', ai: true, objective: true, seed: before.seed });
      const isCompetitive = back.mode === 'competitive' && back.role === 'shade';

      return {
        pass: isFreeRoam && movedByIntent && frozenWhileStunned && stunnedState && recovered && isCompetitive,
        detail: `freeroam config=${isFreeRoam}, moved by intent alone=${movedByIntent}, stunned freeze=${frozenWhileStunned} state=${stunnedState}, recovered=${recovered}, returned to competitive=${isCompetitive}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'outlines-sit-on-the-body-they-outline',
    spec: 'Section 4 / reported bug: teal capsules floating at the shoulders',
    name: 'Every inverted-hull outline is coincident with its own mesh',
    run: (h) => {
      const strays = [];
      const bodyPosition = new THREE.Vector3();
      const outlinePosition = new THREE.Vector3();

      const audit = (root, label) => {
        root.updateMatrixWorld(true);
        let pairs = 0;
        root.traverse((object) => {
          if (!object.isMesh) return;
          // An outline is the BackSide duplicate parented to the mesh it hulls.
          const outlines = object.children.filter((child) => child.isMesh && child.material.side === THREE.BackSide);
          for (const outline of outlines) {
            pairs++;
            object.getWorldPosition(bodyPosition);
            outline.getWorldPosition(outlinePosition);
            const drift = bodyPosition.distanceTo(outlinePosition);
            if (drift > 1e-6) {
              strays.push(`${label} ${object.geometry.type} outline drifts ${drift.toFixed(3)}m`);
            }
          }
        });
        return pairs;
      };

      const shadePairs = audit(h.shade.mesh, 'shade');
      const wardenPairs = audit(h.warden.mesh, 'warden');

      // Every visible body part must actually carry one, or an outline could
      // "not drift" simply by not existing.
      const bodies = [];
      for (const [root, label] of [[h.shade.mesh, 'shade'], [h.warden.mesh, 'warden']]) {
        root.traverse((object) => {
          if (!object.isMesh) return;
          if (object.material.side === THREE.BackSide) return;
          if (!object.children.some((child) => child.isMesh && child.material.side === THREE.BackSide)) {
            strays.push(`${label} ${object.geometry.type} has no outline`);
          }
          bodies.push(label);
        });
      }

      return {
        pass: strays.length === 0 && shadePairs > 0 && wardenPairs > 0,
        detail:
          strays.length === 0
            ? `${bodies.length} body meshes across both actors, ${shadePairs + wardenPairs} outlines, all coincident with the mesh they hull`
            : strays.slice(0, 6).join('; '),
      };
    },
  });
}
