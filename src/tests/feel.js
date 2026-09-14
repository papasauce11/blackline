/**
 * BLACKLINE - tests/feel.js
 *
 * AUTO suite: B8, feel. Momentum carried into a vault, the weight of a
 * landing, the camera's dip and the jump buffer that runs in every state
 * (the hanging body is tests/hang.js). Every one of these is a number in
 * `config.js`, and every check here drives the real controller through real
 * key codes (the lesson of the ledge hang and the slide - see tests/fuzz.js).
 * CONFIG is frozen, so the A1 lesson - turn the constant and watch - is met
 * the other way: each check compares two inputs that differ only in what the
 * number acts on (a walk and a sprint, a hop and a fall) and requires the
 * answers to differ by what the number says.
 *
 * The camera is measured by where the rig is, not by pixels: the dip is the
 * rig's height above the drawn body, and that transform is the thing itself.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { SHADE_STATE } from '../entities/agent.js';
import { classifyReach } from '../physics.js';
import { findGroundLedge } from './movement.js';
import { findTallFace } from './scuff.js';

const S = CONFIG.shade;
const DT = CONFIG.time.fixedDt;
const MOVE_STATES = new Set([SHADE_STATE.VAULT, SHADE_STATE.MANTLE, SHADE_STATE.GRAB, SHADE_STATE.PULLUP]);

export function press(h, code) {
  h.input.heldCodes.add(code);
  h.input.pressedCodes.add(code);
}

/** One fixed step through the real input path, edges cleared after, as the loop does. */
function stepOnce(h) {
  h.stepFrames(1);
  h.input.clearEdges();
}

/**
 * The camera's dip this frame: how far the rig sits below where the rig
 * would be with nothing happening. Pitch is zeroed by the caller so the boom
 * is level and the rig's height is the pivot's; the pivot is `camera.up`
 * over the drawn feet, which is the mesh's position.
 */
function cameraDip(shade) {
  return shade.cameraRig.position.y - (shade.mesh.position.y + S.camera.up);
}

/**
 * A vault-band box on the ground with a straight run at one of its faces:
 * a spot 0.8m off the face where the controller's own probe reports the
 * face (the arbiter, as in `findGroundLedge`), and `runway` metres of clear
 * floor straight back from it at the same level.
 */
function findVaultRun(h, runway) {
  const ground = CONFIG.map.groundY;
  const shade = h.shade;
  const half = { x: S.radius, y: S.standHeight / 2, z: S.radius };
  for (const box of h.map.collision.boxes) {
    if (!box.climbable || !box.solid) continue;
    if (Math.abs(box.min.y - ground) > 0.05) continue;
    const rise = box.max.y - ground;
    if (classifyReach(rise, S.reach.standing) !== 'vault') continue;
    const cx = (box.min.x + box.max.x) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    for (const [nx, nz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const x = nx === 0 ? cx : (nx < 0 ? box.min.x : box.max.x) + nx * 0.8;
      const z = nz === 0 ? cz : (nz < 0 ? box.min.z : box.max.z) + nz * 0.8;
      let clear = true;
      for (let back = 0; back <= runway && clear; back += 0.5) {
        const px = x + nx * back;
        const pz = z + nz * back;
        if (!h.map.collision.isClear({ x: px, y: ground + half.y + 0.02, z: pz }, half)) clear = false;
        const under = h.map.collision.raycast({ x: px, y: ground + 0.1, z: pz }, { x: 0, y: -1, z: 0 }, 0.3);
        if (!under || Math.abs(under.y - ground) > 0.05) clear = false;
      }
      if (!clear) continue;
      const yaw = Math.atan2(nx, nz);
      shade.reset({ position: { x, y: ground, z }, yaw });
      h.stepFrames(3);
      if (!shade.grounded || Math.abs(shade.feetY - ground) > 0.05) continue;
      const ledge = shade._probeLedge(S.vaultReach);
      if (!ledge || ledge.box !== box || ledge.move !== 'vault') continue;
      return { box, x, z, nx, nz, yaw, start: { x: x + nx * runway, z: z + nz * runway } };
    }
  }
  return null;
}

/**
 * Run at the face from the far end of the runway and press Space when the
 * face is within the probe's distance. Returns what the vault did: how long
 * it took, the speed the body brought and the speed it left with.
 */
function runAndVault(h, run, { sprint, pressLate = null }) {
  const shade = h.shade;
  const ground = CONFIG.map.groundY;
  shade.reset({ position: { x: run.start.x, y: ground, z: run.start.z }, yaw: run.yaw });
  h.stepFrames(3);
  h.input.clearAll();
  h.input.heldCodes.add('KeyW');
  if (sprint) h.input.heldCodes.add('ShiftLeft');
  const faceX = run.nx > 0 ? run.box.max.x : run.nx < 0 ? run.box.min.x : shade.position.x;
  const faceZ = run.nz > 0 ? run.box.max.z : run.nz < 0 ? run.box.min.z : shade.position.z;
  let entry = 0;
  let steps = 0;
  let exit = null;
  let pressed = false;
  let latePressed = false;
  for (let i = 0; i < 240; i++) {
    const ahead = (shade.position.x - faceX) * run.nx + (shade.position.z - faceZ) * run.nz;
    if (!pressed && shade.state === SHADE_STATE.GROUND && ahead < S.vaultReach + S.radius - 0.1) {
      press(h, 'Space');
      pressed = true;
    }
    if (pressLate !== null && shade.state === SHADE_STATE.VAULT && !latePressed
        && shade._move && shade._move.timer >= shade._move.duration - pressLate) {
      press(h, 'Space');
      latePressed = true;
    }
    const before = shade.speed;
    const wasVault = shade.state === SHADE_STATE.VAULT;
    stepOnce(h);
    if (shade.state === SHADE_STATE.VAULT) {
      if (!wasVault) entry = before;
      steps++;
    } else if (wasVault) {
      exit = shade.speed;
      break;
    }
  }
  h.input.clearAll();
  return { entry, steps, exit, latePressed };
}

/** Drop the body from `height` above the spawn floor with the keys held, and land it. */
function dropAndLand(h, height, held, { pressBeforeLanding = null } = {}) {
  const shade = h.shade;
  const spawn = h.map.shadeSpawns[0];
  h.input.clearAll();
  shade.reset(spawn);
  h.stepFrames(5);
  const floor = shade.feetY;
  shade.reset({ position: { x: shade.position.x, y: floor + height, z: shade.position.z }, yaw: spawn.yaw || 0 });
  shade.pitch = 0;
  h.input.clearAll();
  for (const code of held) h.input.heldCodes.add(code);
  let before = 0;
  let after = null;
  let landedFrom = 0;
  let pressed = false;
  for (let i = 0; i < 240; i++) {
    if (pressBeforeLanding !== null && !pressed && shade.velocity.y < 0) {
      const toFloor = (shade.feetY - floor) / -shade.velocity.y;
      if (toFloor <= pressBeforeLanding) {
        press(h, 'Space');
        pressed = true;
      }
    }
    const speed = shade.speed;
    stepOnce(h);
    if (shade.landedFallHeight > 0) {
      landedFrom = shade.landedFallHeight;
      before = speed;
      after = shade.speed;
      break;
    }
  }
  return { floor, landedFrom, before, after, ratio: after === null ? null : after / Math.max(0.001, before), pressed };
}

/**
 * Did the body leave the ground again within a few steps, under the keys
 * still held? A jump, or - the same press, if a face is in reach - a climb.
 */
function leavesGroundWithin(h, steps) {
  const shade = h.shade;
  for (let i = 0; i < steps; i++) {
    stepOnce(h);
    if (shade.state === SHADE_STATE.AIR && shade.velocity.y > 1) return true;
    if (MOVE_STATES.has(shade.state)) return true;
  }
  return false;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-vault-carries-the-speed-you-brought-to-it',
    spec: 'Section 6.1 (B8: momentum)',
    name: 'A sprint into a vault is over sooner and leaves faster than a walk into the same one; the walk is what it was',
    run: (h) => {
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
      const problems = [];
      const run = findVaultRun(h, 4.0);
      if (!run) return { pass: false, detail: 'no vault-band ground ledge with a 4m straight run at one of its faces' };
      const tag = run.box.tag || 'the ledge';

      const walk = runAndVault(h, run, { sprint: false });
      const sprint = runAndVault(h, run, { sprint: true });
      if (walk.exit === null) problems.push(`the walk never vaulted ${tag}`);
      if (sprint.exit === null) problems.push(`the sprint never vaulted ${tag}`);
      if (problems.length) return { pass: false, detail: problems.join('; ') };

      // The walk is the vault as it was: the base duration, the base exit.
      const walkSteps = Math.round(S.vaultDuration / DT);
      if (Math.abs(walk.steps - walkSteps) > 1) problems.push(`a walk vault took ${walk.steps} steps, want ${walkSteps}`);
      if (walk.exit < S.vaultExitSpeed - 0.05) problems.push(`a walk vault left at ${walk.exit.toFixed(2)} m/s, under vaultExitSpeed ${S.vaultExitSpeed}`);
      if (walk.entry > S.walkSpeed + 0.3) problems.push(`the walk arrived at ${walk.entry.toFixed(2)} m/s, which is not a walk`);

      // The sprint arrived fast, was over sooner, and kept what it brought.
      if (sprint.entry < S.sprintSpeed - 0.5) problems.push(`the sprint arrived at ${sprint.entry.toFixed(2)} m/s, not a sprint (${S.sprintSpeed}); the runway is too short`);
      const sprintSteps = Math.round(S.vaultDurationAtSprint / DT);
      if (sprint.steps > walk.steps - 3) problems.push(`a sprint vault took ${sprint.steps} steps against the walk's ${walk.steps}`);
      if (Math.abs(sprint.steps - sprintSteps) > 2) problems.push(`a sprint vault took ${sprint.steps} steps, want about ${sprintSteps}`);
      const carried = Math.min(S.sprintSpeed, Math.max(S.vaultExitSpeed, sprint.entry * S.vaultCarry));
      if (Math.abs(sprint.exit - carried) > 0.1) problems.push(`a sprint vault left at ${sprint.exit.toFixed(2)} m/s, want ${carried.toFixed(2)} (${S.vaultCarry} of ${sprint.entry.toFixed(2)})`);
      if (sprint.exit < walk.exit + 0.5) problems.push(`the sprint left at ${sprint.exit.toFixed(2)}, the walk at ${walk.exit.toFixed(2)}: no momentum carried`);

      h.shade.reset(h.map.shadeSpawns[0]);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${tag}: a walk (${walk.entry.toFixed(1)} m/s in) vaults in ${walk.steps} steps and leaves at ${walk.exit.toFixed(2)}; `
            + `a sprint (${sprint.entry.toFixed(1)} in) in ${sprint.steps} and leaves at ${sprint.exit.toFixed(2)}, `
            + `${S.vaultCarry} of what it brought`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'a-landing-is-heavier-the-further-you-fell',
    spec: 'Section 6.1 (B8: landing weight)',
    name: 'A hop costs nothing, a hard fall cuts the speed and holds it while the legs take it, and the camera and the body show the weight',
    run: (h) => {
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
      const shade = h.shade;
      const L = S.landing;
      const problems = [];
      const run = ['KeyW', 'ShiftLeft'];

      // Three falls, sprinting in the air so there is a speed to cut: a hop
      // under softFall, one on the ramp, one past hardFall.
      const hop = dropAndLand(h, L.softFall - 0.2, run);
      const mid = dropAndLand(h, (L.softFall + L.hardFall) / 2, run);
      const hard = dropAndLand(h, L.hardFall + 1.0, run);
      for (const [name, fall] of [['hop', hop], ['mid', mid], ['hard', hard]]) {
        if (fall.after === null) problems.push(`the ${name} fall never landed`);
        else if (fall.before < 1) problems.push(`the ${name} fall landed at ${fall.before.toFixed(2)} m/s, too slow to measure a cut`);
      }
      if (problems.length) return { pass: false, detail: problems.join('; ') };

      if (hop.ratio < 0.97) problems.push(`a ${hop.landedFrom.toFixed(1)}m hop cut the speed to ${hop.ratio.toFixed(2)} of what it was; under softFall it should cost nothing`);
      const midWeight = (mid.landedFrom - L.softFall) / (L.hardFall - L.softFall);
      const midWant = 1 - L.speedLoss * midWeight;
      if (Math.abs(mid.ratio - midWant) > 0.08) problems.push(`a ${mid.landedFrom.toFixed(1)}m fall kept ${mid.ratio.toFixed(2)} of its speed, want about ${midWant.toFixed(2)} on the ramp`);
      if (hard.ratio > 1 - L.speedLoss + 0.05) problems.push(`a ${hard.landedFrom.toFixed(1)}m fall kept ${hard.ratio.toFixed(2)} of its speed, want at most ${(1 - L.speedLoss).toFixed(2)}`);
      if (!(hop.ratio > mid.ratio && mid.ratio > hard.ratio)) problems.push(`the cut is not monotonic in the fall: ${hop.ratio.toFixed(2)}, ${mid.ratio.toFixed(2)}, ${hard.ratio.toFixed(2)}`);

      // After the hard landing, still sprinting: held down while the legs take
      // it, back to a full sprint once they have.
      const held = Math.round(0.15 / DT);
      for (let i = 0; i < held; i++) stepOnce(h);
      const during = shade.speed;
      const ceiling = S.sprintSpeed * (1 - L.speedLoss) + 0.3;
      if (during > ceiling) problems.push(`0.15s after a hard landing the sprint is already ${during.toFixed(2)} m/s; the recovery holds it under ${ceiling.toFixed(2)}`);
      const rest = Math.round((L.recovery + 0.3) / DT) - held;
      for (let i = 0; i < rest; i++) stepOnce(h);
      const recovered = shade.speed;
      if (recovered < S.sprintSpeed - 0.15) problems.push(`${(L.recovery + 0.3).toFixed(2)}s after a hard landing the sprint is ${recovered.toFixed(2)} m/s, not back to ${S.sprintSpeed}`);
      h.input.clearAll();

      // The camera dips by the weight and comes back; the body squashes with it.
      const cam = S.camera;
      const settle = (frames) => {
        let lowest = 0;
        let smallest = Infinity;
        for (let i = 0; i < frames; i++) {
          shade.updateVisual(1 / 60);
          lowest = Math.min(lowest, cameraDip(shade));
          smallest = Math.min(smallest, shade.mesh.scale.y);
        }
        return { lowest, smallest, last: cameraDip(shade) };
      };
      dropAndLand(h, L.hardFall + 1.0, []);
      const hardDip = settle(120);
      if (hardDip.lowest > -cam.landDip * 0.8) problems.push(`the camera dipped ${hardDip.lowest.toFixed(3)}m on a hard landing, want about ${-cam.landDip}`);
      if (hardDip.lowest < -cam.landDip * 1.15) problems.push(`the camera dipped ${hardDip.lowest.toFixed(3)}m on a hard landing, past ${-cam.landDip}`);
      if (Math.abs(hardDip.last) > 0.01) problems.push(`2s after a hard landing the camera is still ${hardDip.last.toFixed(3)}m off`);
      const squashWant = 1 - L.squash;
      if (hardDip.smallest > squashWant + 0.03) problems.push(`the body squashed to ${hardDip.smallest.toFixed(3)} of its height on a hard landing, want about ${squashWant.toFixed(2)}`);
      dropAndLand(h, L.softFall - 0.2, []);
      const hopDip = settle(30);
      if (hopDip.lowest < -0.001) problems.push(`the camera dipped ${hopDip.lowest.toFixed(3)}m on a hop`);

      shade.reset(h.map.shadeSpawns[0]);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `landing at a sprint: a ${hop.landedFrom.toFixed(1)}m hop kept ${hop.ratio.toFixed(2)} of its speed, `
            + `${mid.landedFrom.toFixed(1)}m kept ${mid.ratio.toFixed(2)}, ${hard.landedFrom.toFixed(1)}m kept ${hard.ratio.toFixed(2)}; `
            + `0.15s on the sprint is ${during.toFixed(2)} m/s and ${(L.recovery + 0.3).toFixed(2)}s on it is ${recovered.toFixed(2)}; `
            + `the camera dipped ${(-hardDip.lowest).toFixed(3)}m (landDip ${cam.landDip}) and was back within 2s, the body squashed to `
            + `${hardDip.smallest.toFixed(3)}; the hop did not dip`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-camera-dips-on-a-climb-and-comes-back',
    spec: 'Section 6.1 (B8: mantle camera)',
    name: 'The camera takes the weight of a mantle and a pull-up, not of a grab, and is level again after',
    run: (h) => {
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
      const shade = h.shade;
      const cam = S.camera;
      const problems = [];

      // Frames are driven by hand: one visual update per fixed step, which is
      // what the loop does at 60Hz. `driveAtLedge` steps without drawing, so
      // the dip is read by stepping the same keys here.
      const climbWatched = (spot, { hold, steps }) => {
        const ground = CONFIG.map.groundY;
        shade.reset({ position: { x: spot.x, y: ground, z: spot.z }, yaw: spot.yaw });
        shade.pitch = 0;
        h.stepFrames(2);
        shade.updateVisual(1 / 60);
        h.input.clearAll();
        h.input.heldCodes.add('KeyW');
        let lowest = 0;
        let lowestState = '';
        const seen = new Set();
        for (let i = 0; i < steps; i++) {
          if (i === 5) press(h, 'Space');
          stepOnce(h);
          if (!hold) h.input.heldCodes.delete('Space');
          shade.updateVisual(1 / 60);
          seen.add(shade.state);
          const dip = cameraDip(shade);
          if (dip < lowest) { lowest = dip; lowestState = shade.state; }
        }
        h.input.clearAll();
        return { lowest, lowestState, last: cameraDip(shade), states: [...seen].join(',') };
      };

      // A mantle, held over. Below the hang height so there is no grab in it.
      const hangMin = S.standHeight * S.hangMinHeightRatio;
      const mantle = findGroundLedge(h, S.reach.vaultTop + 0.1, Math.min(hangMin - 0.05, S.reach.standing));
      if (!mantle) return { pass: false, detail: 'no mantle-height ground ledge under the hang height was found' };
      const over = climbWatched(mantle, { hold: true, steps: 160 });
      if (!over.states.includes(SHADE_STATE.MANTLE)) problems.push(`holding Space at ${mantle.box.tag} never mantled (states ${over.states})`);
      if (over.lowest > -cam.climbDip * 0.8) problems.push(`the camera dipped ${over.lowest.toFixed(3)}m over a mantle, want about ${-cam.climbDip}`);
      if (over.lowest < -cam.climbDip * 1.15) problems.push(`the camera dipped ${over.lowest.toFixed(3)}m over a mantle, past ${-cam.climbDip}`);
      if (Math.abs(over.last) > 0.01) problems.push(`2s after the mantle the camera is still ${over.last.toFixed(3)}m off (${over.states})`);

      // A grab, tapped: the hang is a reach, not a rise, and the camera stays
      // level through it. Then Space: the pull-up gets the dip.
      const fullReach = S.reach.standing + S.reach.jumpBonus;
      const hang = findGroundLedge(h, hangMin, fullReach, { hangable: true });
      if (!hang) return { pass: false, detail: 'no hangable ground-level ledge was found' };
      const grabbed = climbWatched(hang, { hold: false, steps: 60 });
      if (shade.state !== SHADE_STATE.HANG) problems.push(`a tap at ${hang.box.tag} did not end hanging (state ${shade.state}, states ${grabbed.states})`);
      if (grabbed.lowest < -0.001) problems.push(`the camera dipped ${grabbed.lowest.toFixed(3)}m on a grab; a grab is not a climb`);
      let pulled = 0;
      if (shade.state === SHADE_STATE.HANG) {
        press(h, 'Space');
        for (let i = 0; i < 90; i++) {
          stepOnce(h);
          h.input.heldCodes.delete('Space');
          shade.updateVisual(1 / 60);
          pulled = Math.min(pulled, cameraDip(shade));
        }
        if (pulled > -cam.climbDip * 0.8) problems.push(`the camera dipped ${pulled.toFixed(3)}m on a pull-up, want about ${-cam.climbDip}`);
        if (shade.feetY < hang.box.max.y - 0.12) problems.push(`the pull-up from ${hang.box.tag} did not arrive on top`);
      }

      // Standing still, nothing dips.
      shade.reset(h.map.shadeSpawns[0]);
      shade.pitch = 0;
      let idle = 0;
      for (let i = 0; i < 30; i++) {
        h.stepFrames(1);
        shade.updateVisual(1 / 60);
        idle = Math.min(idle, -Math.abs(cameraDip(shade)));
      }
      if (idle < -0.001) problems.push(`standing still the camera is ${idle.toFixed(3)}m off its pivot`);

      shade.reset(h.map.shadeSpawns[0]);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `over ${mantle.box.tag} the camera dipped ${(-over.lowest).toFixed(3)}m (climbDip ${cam.climbDip}) in ${over.lowestState} and was level within 2s; `
            + `the grab at ${hang.box.tag} did not move it and the pull-up dipped ${(-pulled).toFixed(3)}m; standing still it is level`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'a-jump-pressed-just-before-landing-still-fires',
    spec: 'Section 6.1 (B8: the buffer)',
    name: 'Space in the last of a fall jumps off the landing, in the last of a vault jumps off its top; earlier presses do not, and a scuff spends one',
    run: (h) => {
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
      const shade = h.shade;
      const problems = [];
      // Pressed this long before the end, by the fall's own arithmetic. The
      // estimate reads the current speed, so the true time left is shorter
      // than it says: `outside` is chosen with room for that.
      const inside = S.jumpBuffer * 0.5;
      const outside = S.jumpBuffer + 0.2;

      // A fall with the press inside the window: airborne again off the landing.
      const late = dropAndLand(h, 1.0, ['KeyW'], { pressBeforeLanding: inside });
      if (!late.pressed) problems.push('the fall was too short to press inside the window');
      else if (!leavesGroundWithin(h, 3)) problems.push(`Space ${inside.toFixed(2)}s before landing did not jump off the landing (state ${shade.state})`);
      h.input.clearAll();

      // The same press outside it: the landing is a landing.
      const early = dropAndLand(h, 2.0, ['KeyW'], { pressBeforeLanding: outside });
      if (!early.pressed) problems.push('the fall was too short to press outside the window');
      else if (leavesGroundWithin(h, 12)) problems.push(`Space ${outside.toFixed(2)}s before landing still jumped off the landing`);
      h.input.clearAll();

      // A vault with the press in its last moments: off the top.
      const run = findVaultRun(h, 2.0);
      if (!run) {
        problems.push('no vault-band ground ledge with a 2m run was found');
      } else {
        const tag = run.box.tag || 'the ledge';
        const chained = runAndVault(h, run, { sprint: false, pressLate: inside });
        if (chained.exit === null || !chained.latePressed) problems.push(`the walk never vaulted ${tag}, or the vault was too short to press late in`);
        else {
          h.input.heldCodes.add('KeyW');
          if (!leavesGroundWithin(h, 3)) problems.push(`Space ${inside.toFixed(2)}s before a vault ended did not jump off ${tag} (state ${shade.state})`);
        }
        h.input.clearAll();
        const early2 = runAndVault(h, run, { sprint: false, pressLate: outside });
        if (early2.exit === null || !early2.latePressed) problems.push(`the second walk never vaulted ${tag}, or the vault was too short to press early in`);
        else {
          h.input.heldCodes.add('KeyW');
          if (leavesGroundWithin(h, 12)) problems.push(`Space ${outside.toFixed(2)}s before a vault ended still jumped off ${tag}`);
        }
        h.input.clearAll();
      }

      // A press that ends in a scuff is spent: no jump off the landing after.
      const wall = findTallFace(h, S.reach.standing + S.reach.jumpBonus + 0.5);
      if (!wall) {
        problems.push('no face beyond full reach was found to scuff on');
      } else {
        const ground = CONFIG.map.groundY;
        shade.reset({ position: { x: wall.x, y: ground, z: wall.z }, yaw: wall.yaw });
        h.stepFrames(2);
        shade.position.y += 0.6;
        shade.velocity.set(0, 0, 0);
        shade.grounded = false;
        shade.state = SHADE_STATE.AIR;
        shade._beginFall();
        h.input.clearAll();
        h.input.heldCodes.add('KeyW');
        const scuffs = shade.scuffs;
        let pressed = false;
        let landed = false;
        for (let i = 0; i < 60 && !landed; i++) {
          if (!pressed && shade.velocity.y < 0 && (shade.feetY - ground) / -shade.velocity.y <= inside) {
            press(h, 'Space');
            pressed = true;
          }
          stepOnce(h);
          if (shade.landedFallHeight > 0 || (shade.grounded && shade.state === SHADE_STATE.GROUND)) landed = true;
        }
        if (!pressed) problems.push('never pressed before landing at the wall');
        if (shade.scuffs === scuffs) problems.push(`the press at ${wall.box.tag} did not scuff, so it tested nothing`);
        else if (leavesGroundWithin(h, 12)) problems.push(`a press spent on a scuff at ${wall.box.tag} still jumped off the landing`);
        h.input.clearAll();
      }

      shade.reset(h.map.shadeSpawns[0]);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `Space ${inside.toFixed(2)}s before a landing jumped off it and ${outside.toFixed(2)}s before did not (jumpBuffer ${S.jumpBuffer}); `
            + `the same in the last of a vault of ${run.box.tag} and not earlier; a press spent on a scuff at ${wall.box.tag} did not jump`
          : problems.join('; '),
      };
    },
  });
}

export { MOVE_STATES };
