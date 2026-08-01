/**
 * BLACKLINE - tests/shade.js
 *
 * AUTO suite (Section 16, Section 17.1): Shade controller.
 *
 * Movement speeds, parkour, capsule safety and the ledge-hang chain.
 *
 * Registered from tests/index.js. Checks reach the live game through the
 * harness `h`; nothing here imports main.js, which Section 3.1 forbids.
 */

import { CONFIG, rng } from '../config.js';
import { classifyLedge } from '../physics.js';
import { SHADE_STATE, createIntent } from '../entities/agent.js';

/**
 * An intent that reads as deliberately approaching a ledge. The airborne
 * auto-climb requires it (Section 6.1), so a test that expects a grab must
 * supply it or it is exercising the approach gate instead.
 */
const APPROACHING = (() => {
  const intent = createIntent();
  intent.forward = 1;
  return intent;
})();

const S_WALK = CONFIG.shade.walkSpeed;
const S_SPRINT = CONFIG.shade.sprintSpeed;
const S_CROUCH = CONFIG.shade.crouchSpeed;

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'shade-invariants-under-fuzz',
    spec: 'Section 17 / phase 3 exit gate',
    name: 'Seeded random input never produces NaN or puts the Shade below the floor',
    run: (h) => {
      const restoreSeed = rng.seed;
      rng.reseed(0xf0f0f0);

      const intent = createIntent();
      const dt = CONFIG.time.fixedDt;
      const steps = 7200; // two simulated minutes
      const limit = CONFIG.map.groundY - CONFIG.debug.floorTolerance;

      let nan = 0;
      let belowFloor = 0;
      let badState = 0;
      let minFeet = Infinity;
      let maxSpeed = 0;
      const visited = new Set();
      const validStates = Object.keys(SHADE_STATE).map((k) => SHADE_STATE[k]);

      // Start from each spawn in turn so the fuzz covers the whole map.
      for (let spawnIndex = 0; spawnIndex < h.map.shadeSpawns.length; spawnIndex++) {
        h.shade.reset(h.map.shadeSpawns[spawnIndex]);

        for (let i = 0; i < steps / h.map.shadeSpawns.length; i++) {
          // Re-roll the intent occasionally so the Shade commits to a direction
          // long enough to actually reach geometry and attempt traversal.
          if (i % 12 === 0) {
            intent.forward = rng.int(-1, 1);
            intent.strafe = rng.int(-1, 1);
            intent.sprint = rng.chance(0.45);
            intent.crouch = rng.chance(0.25);
            h.shade.look(rng.unit() * 0.9, rng.unit() * 0.25);
          }
          intent.jumpPressed = rng.chance(0.06);
          intent.crouchPressed = rng.chance(0.05);
          intent.jump = intent.jumpPressed;

          h.shade.step(dt, intent);

          const p = h.shade.position;
          const v = h.shade.velocity;
          if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) nan++;
          if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) nan++;
          if (h.shade.feetY < limit) belowFloor++;
          if (validStates.indexOf(h.shade.state) === -1) badState++;
          minFeet = Math.min(minFeet, h.shade.feetY);
          maxSpeed = Math.max(maxSpeed, h.shade.speed);
          visited.add(h.shade.state);
        }
      }

      rng.reseed(restoreSeed);
      h.shade.reset(h.map.shadeSpawns[0]);

      return {
        pass: nan === 0 && belowFloor === 0 && badState === 0,
        detail: `${steps} steps: ${nan} NaN, ${belowFloor} below floor, ${badState} bad states, lowest feet y=${minFeet.toFixed(3)} (limit ${limit}), peak speed ${maxSpeed.toFixed(2)}m/s, states seen [${[...visited].join(' ')}]`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'parkour-safety-gate',
    spec: 'Section 6.1 / check 4',
    name: 'A traversal move into blocked space is refused, leaving state untouched',
    run: (h) => {
      h.shade.reset(h.map.shadeSpawns[0]);
      const stateBefore = h.shade.state;
      const posBefore = h.shade.position.clone();

      // A destination buried inside the west perimeter wall.
      const blocked = { x: -30.2, y: 1.0, z: 0 };
      const refused = h.shade._commitMove(SHADE_STATE.MANTLE, blocked, 0.5, CONFIG.shade.standHeight) === false;
      const unchanged =
        h.shade.state === stateBefore &&
        h.shade.position.distanceTo(posBefore) < 1e-9 &&
        h.shade._move === null;

      // And a clear destination is accepted, so the gate is not simply always
      // saying no.
      const clear = { x: -18, y: CONFIG.shade.standHeight / 2 + 0.1, z: -4 };
      const accepted = h.shade._commitMove(SHADE_STATE.MANTLE, clear, 0.5, CONFIG.shade.standHeight) === true;
      h.shade.reset(h.map.shadeSpawns[0]);

      return {
        pass: refused && unchanged && accepted,
        detail: `blocked destination refused=${refused}, state/position untouched=${unchanged}, clear destination accepted=${accepted}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'failed-mantle-becomes-hang',
    spec: 'Section 6.1 / check 6',
    name: 'A ledge above the mantle band triggers a hang; pull up and drop both work',
    run: (h) => {
      const container = h.map.collision.boxes.find((box) => box.tag === 'hall-container');
      if (!container) return { pass: false, detail: 'hall-container missing from the map' };

      // Derived from the box rather than typed, so moving the container in the
      // map does not silently make this test probe empty air.
      const midZ = (container.min.z + container.max.z) / 2;
      const approach = () => {
        h.shade.reset(h.map.shadeSpawns[0]);
        // Airborne just off the container's east face, facing into it.
        // Feet at 0.5 so the 3.0m top is a 2.5m rise — above the mantle band.
        h.shade.position.set(container.max.x + 0.75, 0.5 + CONFIG.shade.standHeight / 2, midZ);
        h.shade.velocity.set(0, 0, 0);
        h.shade.yaw = Math.PI / 2; // face -X, into the container
        h.shade.state = SHADE_STATE.AIR;
      };

      approach();
      const ledge = h.shade._probeLedge(CONFIG.shade.mantleReach);
      const grabbed = h.shade._tryMantle(APPROACHING);
      const hangState = h.shade.state;
      const hangClear = h.map.collision.isClear(h.shade.position, h.shade.half);
      const hangFeet = h.shade.feetY;

      // Releasing everything must leave the Shade hanging, not auto-resolve.
      for (let i = 0; i < 60; i++) h.shade.step(CONFIG.time.fixedDt, createIntent());
      const stillHanging = h.shade.state === SHADE_STATE.HANG;

      // Pull up with jump HELD and never freshly pressed. This is the exact
      // case that failed in play: the ledge is grabbed mid-jump with the key
      // already down, so no keydown edge is ever generated and an
      // edge-triggered pull-up would wait forever.
      const heldJump = createIntent();
      heldJump.jump = true;
      heldJump.jumpPressed = false;
      let pullingUp = false;
      for (let i = 0; i < 120; i++) {
        const before = h.shade.state;
        h.shade.step(CONFIG.time.fixedDt, heldJump);
        if (before === SHADE_STATE.HANG && h.shade.state === SHADE_STATE.PULLUP) {
          pullingUp = true;
          break;
        }
      }

      for (let i = 0; i < 150; i++) h.shade.step(CONFIG.time.fixedDt, createIntent());
      const onTop = h.shade.feetY > container.max.y - 0.25;
      const topClear = h.map.collision.isClear(h.shade.position, h.shade.half);

      // On a FRESH grab with jump already held, the pull-up must wait out the
      // grace period so the grab reads as its own beat rather than resolving on
      // the frame the ledge is caught.
      approach();
      h.shade._tryMantle(APPROACHING);
      let stepsToPullUp = 0;
      for (let i = 0; i < 120; i++) {
        h.shade.step(CONFIG.time.fixedDt, heldJump);
        stepsToPullUp++;
        if (h.shade.state === SHADE_STATE.PULLUP) break;
      }
      const graceSteps = Math.ceil(CONFIG.shade.hangInputGrace / CONFIG.time.fixedDt);
      const graceRespected = stepsToPullUp >= graceSteps && stepsToPullUp <= graceSteps + 2;

      // Drop with crouch HELD, likewise without a fresh press.
      approach();
      h.shade._tryMantle(APPROACHING);
      const heldCrouch = createIntent();
      heldCrouch.crouch = true;
      heldCrouch.crouchPressed = false;
      let dropped = false;
      for (let i = 0; i < 120; i++) {
        h.shade.step(CONFIG.time.fixedDt, heldCrouch);
        if (h.shade.state === SHADE_STATE.AIR) {
          dropped = true;
          break;
        }
      }

      h.shade.reset(h.map.shadeSpawns[0]);

      const pass =
        ledge !== null && ledge.band === 'hang' && grabbed && hangState === SHADE_STATE.HANG &&
        hangClear && stillHanging && pullingUp && graceRespected && onTop && topClear && dropped;
      return {
        pass,
        detail: `band=${ledge ? ledge.band : 'none'} rise=${ledge ? ledge.rise.toFixed(2) : '-'}, hang clear=${hangClear} feetY=${hangFeet.toFixed(2)}, idle stays hanging=${stillHanging}, HELD jump pulled up=${pullingUp}, landed on top=${onTop} clear=${topClear}, HELD crouch dropped=${dropped}, fresh grab waited ${stepsToPullUp} steps (grace ${graceSteps}, ok=${graceRespected})`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'container-top-is-not-a-dead-end',
    spec: 'reported bug: cannot climb from the container',
    name: 'A vault-band ledge climbs from the air, so a small platform is never a trap',
    run: (h) => {
      const container = h.map.collision.boxes.find((box) => box.tag === 'hall-container');
      const gantry = h.map.collision.boxes.find((box) => box.tag === 'gantry-hall');
      if (!container || !gantry) return { pass: false, detail: 'hall-container or gantry-hall missing' };

      const rise = gantry.max.y - container.max.y;
      const band = classifyLedge(rise);

      // Stand on the container top and hop toward the gantry. Sprint is
      // deliberately NOT given: there is no room to build speed up here, which
      // is exactly the situation that stranded the player. Start point and
      // facing are derived from the two boxes so that moving either in the map
      // cannot leave this test walking at empty air.
      const target = { x: (gantry.min.x + gantry.max.x) / 2, z: (gantry.min.z + gantry.max.z) / 2 };
      const near = {
        x: Math.min(Math.max(target.x, container.min.x), container.max.x),
        z: Math.min(Math.max(target.z, container.min.z), container.max.z),
      };
      const length = Math.hypot(target.x - near.x, target.z - near.z) || 1;
      const dx = (target.x - near.x) / length;
      const dz = (target.z - near.z) / length;

      h.shade.reset(h.map.shadeSpawns[0]);
      h.shade.position.set(
        near.x - dx * 0.6,
        container.max.y + CONFIG.shade.standHeight / 2 + 0.05,
        near.z - dz * 0.6
      );
      h.shade.velocity.set(0, 0, 0);
      h.shade.yaw = Math.atan2(-dx, -dz); // face the gantry
      h.shade.state = SHADE_STATE.GROUND;

      const intent = createIntent();
      intent.forward = 1;
      intent.sprint = false;
      let climbed = false;
      for (let i = 0; i < 240; i++) {
        intent.jumpPressed = i % 25 === 0;
        intent.jump = intent.jumpPressed;
        h.shade.step(CONFIG.time.fixedDt, intent);
        if (h.shade.state === SHADE_STATE.VAULT || h.shade.state === SHADE_STATE.MANTLE) climbed = true;
        if (h.shade.feetY > gantry.max.y - 0.3 && h.shade.state !== SHADE_STATE.VAULT &&
            h.shade.state !== SHADE_STATE.MANTLE) break;
      }
      // Let the landing settle: mid-traversal the capsule is interpolating
      // through the ledge, so "clean" can only be judged once it is down.
      for (let i = 0; i < 30; i++) h.shade.step(CONFIG.time.fixedDt, createIntent());

      const onGantry = h.shade.feetY > gantry.max.y - 0.3;
      const clear = h.map.collision.isClear(h.shade.position, h.shade.half);
      h.shade.reset(h.map.shadeSpawns[0]);

      return {
        pass: band === 'vault' && climbed && onGantry && clear,
        detail: `container top ${container.max.y.toFixed(1)} -> gantry ${gantry.max.y.toFixed(1)} is ${rise.toFixed(2)}m (${band}); climbed without sprint=${climbed}, reached gantry=${onGantry}, clear=${clear}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'backing-off-a-ledge-does-not-re-climb',
    spec: 'reported bug: pulled back up when falling off backwards',
    name: 'Stepping backwards off a ledge falls to the floor instead of auto-climbing',
    run: (h) => {
      const container = h.map.collision.boxes.find((box) => box.tag === 'hall-container');
      if (!container) return { pass: false, detail: 'hall-container missing' };

      // Stand on top near the WEST edge, facing east into the container, then
      // walk backwards off that west edge. The probe follows the facing
      // direction, so the ledge just left is squarely in front of it — this is
      // the exact geometry that used to haul the player back up. The west edge
      // is used because the gantry adjoins the east side.
      const midZ = (container.min.z + container.max.z) / 2;
      h.shade.reset(h.map.shadeSpawns[0]);
      h.shade.position.set(container.min.x + 0.55, container.max.y + CONFIG.shade.standHeight / 2 + 0.02, midZ);
      h.shade.velocity.set(0, 0, 0);
      h.shade.yaw = -Math.PI / 2; // face +X, into the container
      h.shade.state = SHADE_STATE.GROUND;

      const intent = createIntent();
      intent.forward = -1; // walking backwards, off the edge behind us

      let reClimbed = false;
      for (let i = 0; i < 240; i++) {
        h.shade.step(CONFIG.time.fixedDt, intent);
        if (
          h.shade.state === SHADE_STATE.MANTLE ||
          h.shade.state === SHADE_STATE.VAULT ||
          h.shade.state === SHADE_STATE.HANG
        ) {
          reClimbed = true;
          break;
        }
      }

      // Capture before the second setup below moves the Shade, or the reported
      // numbers describe a different moment than the assertion.
      const feet = h.shade.feetY;
      const groundedAfterFall = h.shade.grounded;
      const landed = !reClimbed && feet < 1.0 && groundedAfterFall;

      // The forward approach must still work, or the fix has broken climbing.
      h.shade.reset(h.map.shadeSpawns[0]);
      h.shade.position.set(container.max.x + 0.75, 0.5 + CONFIG.shade.standHeight / 2, midZ);
      h.shade.velocity.set(0, 0, 0);
      h.shade.yaw = Math.PI / 2;
      h.shade.state = SHADE_STATE.AIR;
      const stillGrabs = h.shade._tryMantle(APPROACHING) && h.shade.state === SHADE_STATE.HANG;

      h.shade.reset(h.map.shadeSpawns[0]);

      return {
        pass: landed && stillGrabs,
        detail: `walked backwards off a ${container.max.y.toFixed(1)}m ledge: re-climbed=${reClimbed}, ended feetY=${feet.toFixed(2)} grounded=${groundedAfterFall}; approaching forwards still grabs=${stillGrabs}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'hang-shimmy-stays-on-the-ledge',
    spec: 'requested: movement while hanging',
    name: 'Shimmy moves along a grabbed ledge and refuses to run off the end',
    run: (h) => {
      const container = h.map.collision.boxes.find((box) => box.tag === 'hall-container');
      const midZ = (container.min.z + container.max.z) / 2;
      const grab = () => {
        h.shade.reset(h.map.shadeSpawns[0]);
        h.shade.position.set(container.max.x + 0.75, 0.5 + CONFIG.shade.standHeight / 2, midZ);
        h.shade.velocity.set(0, 0, 0);
        h.shade.yaw = Math.PI / 2;
        h.shade.state = SHADE_STATE.AIR;
        return h.shade._tryMantle(APPROACHING) && h.shade.state === SHADE_STATE.HANG;
      };

      if (!grab()) return { pass: false, detail: 'could not establish a hang to shimmy from' };

      const startZ = h.shade.position.z;
      const intent = createIntent();
      intent.strafe = 1;
      // Long enough to run past the end of a 3m ledge if it were unbounded.
      for (let i = 0; i < 400; i++) h.shade.step(CONFIG.time.fixedDt, intent);

      const movedZ = h.shade.position.z;
      const moved = Math.abs(movedZ - startZ) > 0.3;
      const stillHanging = h.shade.state === SHADE_STATE.HANG;
      const clear = h.map.collision.isClear(h.shade.position, h.shade.half);
      // Must have stopped within the ledge's own footprint, not past its end.
      const withinLedge = movedZ >= container.min.z - 0.5 && movedZ <= container.max.z + 0.5;

      h.shade.reset(h.map.shadeSpawns[0]);

      return {
        pass: moved && stillHanging && clear && withinLedge,
        detail: `z ${startZ.toFixed(2)} -> ${movedZ.toFixed(2)} (ledge z ${container.min.z}..${container.max.z}), moved=${moved}, still hanging=${stillHanging}, clear=${clear}, stayed on ledge=${withinLedge}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'sprint-vault-clears-a-crate',
    spec: 'Section 6.1 / check 2',
    name: 'Sprinting into a vault-band crate vaults it and lands clean on top',
    run: (h) => {
      const crate = h.map.collision.boxes.find((box) => box.tag === 'stack-hall-low');
      if (!crate) return { pass: false, detail: 'stack-hall-low missing from the map' };

      h.shade.reset(h.map.shadeSpawns[0]);
      h.shade.position.set(
        (crate.min.x + crate.max.x) / 2,
        CONFIG.shade.standHeight / 2 + 0.05,
        crate.min.z - 1.4
      );
      h.shade.yaw = Math.PI; // face +Z, into the crate
      h.shade.state = SHADE_STATE.GROUND;

      const intent = createIntent();
      intent.forward = 1;
      intent.sprint = true;

      // Stop sampling the instant the vault resolves, otherwise the held sprint
      // carries the Shade across the map and "landed clean" proves nothing.
      let entered = false;
      let landedFeet = null;
      let landedZ = null;
      let landedClear = false;
      for (let i = 0; i < 200; i++) {
        h.shade.step(CONFIG.time.fixedDt, intent);
        if (h.shade.state === SHADE_STATE.VAULT) {
          entered = true;
        } else if (entered) {
          landedFeet = h.shade.feetY;
          landedZ = h.shade.position.z;
          landedClear = h.map.collision.isClear(h.shade.position, h.shade.half);
          break;
        }
      }

      const rise = crate.max.y - CONFIG.map.groundY;
      const band = classifyLedge(rise);
      // Landed on top of the crate, not inside it and not back on the floor.
      const onTop = landedFeet !== null && Math.abs(landedFeet - crate.max.y) < 0.25;
      const pastEdge = landedZ !== null && landedZ > crate.min.z;

      h.shade.reset(h.map.shadeSpawns[0]);

      return {
        pass: band === 'vault' && entered && landedClear && onTop && pastEdge,
        detail: `crate rise ${rise.toFixed(2)}m (${band}) top y=${crate.max.y.toFixed(2)}, vault entered=${entered}, landed feetY=${landedFeet === null ? 'n/a' : landedFeet.toFixed(3)} z=${landedZ === null ? 'n/a' : landedZ.toFixed(2)} (crate z ${crate.min.z}..${crate.max.z}), capsule clear=${landedClear}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'shade-speeds-match-spec',
    spec: 'Section 6.1',
    name: 'Walk, crouch and sprint settle at the spec speeds',
    run: (h) => {
      const dt = CONFIG.time.fixedDt;
      const intent = createIntent();

      const settle = (sprint, crouch) => {
        // A long clear lane down the Turbine Hall: 27m of open floor before the
        // south wall, well past what a 2s sprint covers. Kept east of the
        // grade vent that now pierces the west wall, and north of the crates.
        h.shade.reset(h.map.shadeSpawns[0]);
        h.shade.position.set(-24, CONFIG.shade.standHeight / 2 + 0.05, -19);
        h.shade.yaw = Math.PI; // +Z, along the hall
        intent.forward = 1;
        intent.strafe = 0;
        intent.sprint = sprint;
        intent.crouch = crouch;
        intent.jumpPressed = false;
        intent.crouchPressed = false;
        for (let i = 0; i < 120; i++) h.shade.step(dt, intent);
        return h.shade.speed;
      };

      const walk = settle(false, false);
      const sprint = settle(true, false);
      const crouch = settle(false, true);
      h.shade.reset(h.map.shadeSpawns[0]);

      const near = (value, target) => Math.abs(value - target) < 0.15;
      const pass = near(walk, S_WALK) && near(sprint, S_SPRINT) && near(crouch, S_CROUCH);
      return {
        pass,
        detail: `walk ${walk.toFixed(2)}/${S_WALK}, sprint ${sprint.toFixed(2)}/${S_SPRINT}, crouch ${crouch.toFixed(2)}/${S_CROUCH} m/s`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'crouch-blocked-under-vent-roof',
    spec: 'Section 6.1 / check 5',
    name: 'Standing up inside a vent is refused rather than pushing through the roof',
    run: (h) => {
      const vent = h.map.vents[0];
      const midX = (vent.min.x + vent.max.x) / 2;
      const midZ = (vent.min.z + vent.max.z) / 2;

      h.shade.reset(h.map.shadeSpawns[0]);
      // Place the crouched capsule on the vent floor, under the roof.
      h.shade.height = CONFIG.shade.crouchHeight;
      h.shade.half.y = h.shade.height / 2;
      h.shade.crouching = true;
      h.shade.position.set(midX, vent.min.y + h.shade.half.y + 0.02, midZ);

      const fitsCrouched = h.map.collision.isClear(h.shade.position, h.shade.half);
      const stood = h.shade._resize(CONFIG.shade.standHeight);
      const stillCrouchHeight = Math.abs(h.shade.height - CONFIG.shade.crouchHeight) < 1e-9;

      h.shade.reset(h.map.shadeSpawns[0]);

      return {
        pass: fitsCrouched && stood === false && stillCrouchHeight,
        detail: `crouched capsule fits vent=${fitsCrouched}, stand-up refused=${stood === false}, height unchanged=${stillCrouchHeight}`,
      };
    },
  });
}
