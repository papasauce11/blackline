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
import { classifyReach } from '../physics.js';
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
    maps: ['plant'], // a destination inside the plant's west wall
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
    id: 'container-top-is-not-a-dead-end',
    maps: ['plant'], // hall-container and gantry-hall
    spec: 'reported bug: cannot climb from the container',
    name: 'A vault-band ledge climbs from the air, so a small platform is never a trap',
    run: (h) => {
      const container = h.map.collision.boxes.find((box) => box.tag === 'hall-container');
      const gantry = h.map.collision.boxes.find((box) => box.tag === 'gantry-hall');
      if (!container || !gantry) return { pass: false, detail: 'hall-container or gantry-hall missing' };

      const rise = gantry.max.y - container.max.y;
      const band = classifyReach(rise, CONFIG.shade.reach.standing + CONFIG.shade.reach.jumpBonus);

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
    maps: ['plant'], // hall-container
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
          h.shade.state === SHADE_STATE.GRAB ||
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
      // Airborne, feet at 0.5, a 3.0m top is a 2.5m rise — inside the 3.8m a
      // jump reaches, so this is a climb, and since D21 a climb at mantle
      // height starts with a grab. Hanging is something you choose.
      h.shade.reset(h.map.shadeSpawns[0]);
      h.shade.position.set(container.max.x + 0.75, 0.5 + CONFIG.shade.standHeight / 2, midZ);
      h.shade.velocity.set(0, 0, 0);
      h.shade.yaw = Math.PI / 2;
      h.shade.state = SHADE_STATE.AIR;
      const stillGrabs = h.shade._tryMantle(APPROACHING)
        && (h.shade.state === SHADE_STATE.MANTLE || h.shade.state === SHADE_STATE.VAULT
          || h.shade.state === SHADE_STATE.GRAB || h.shade.state === SHADE_STATE.HANG);

      h.shade.reset(h.map.shadeSpawns[0]);

      return {
        pass: landed && stillGrabs,
        detail: `walked backwards off a ${container.max.y.toFixed(1)}m ledge: re-climbed=${reClimbed}, ended feetY=${feet.toFixed(2)} grounded=${groundedAfterFall}; approaching forwards still climbs=${stillGrabs}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'sprint-vault-clears-a-crate',
    maps: ['plant'], // stack-hall-low
    spec: 'Section 6.1 / check 2',
    name: 'Running at a vault-band crate and jumping vaults it, landing clean on top',
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
        // A ground climb is a jump into a ledge (Section 6.1, amended). Sprint
        // used to be the gate on its own; it no longer permits anything, so the
        // run-up here is just a run-up and the jump is what asks for the vault.
        // Held and pressed together, which is what a keydown produces.
        intent.jumpPressed = i % 14 === 0;
        intent.jump = intent.jumpPressed;
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
      const band = classifyReach(rise, CONFIG.shade.reach.standing + CONFIG.shade.reach.jumpBonus);
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
    maps: ['plant'], // the plant's ducts
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
