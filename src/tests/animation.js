/**
 * BLACKLINE - tests/animation.js
 *
 * AUTO suite: E3, the bodies in motion. Section 4 animates by rotating and
 * translating limb groups, and before E3 the Shade had three poses (the
 * hang, the air, the slide) over a swing driven by the clock, and the
 * Warden a swing and a stun. Now every state the Shade can be in is a
 * pose of its own - the crouch, the vault, the mantle, the grab and the
 * hang, the pull-up, the landing - the swing is by the ground covered so
 * a foot plants once a stride, and the Warden raises the rifle to where
 * it looks when the sights come up (entities/pose.js says how a body
 * gets from one pose to the next).
 *
 * What a check can say: that each state is drawn differently from the
 * standing rest and from every other state, by at least `APART` radians
 * in some limb; that the legs swing walking and not standing, further at
 * a sprint, and cross the vertical once per stride of the ground covered;
 * that the Warden's arm rises with the sights and with the aim's pitch,
 * and is at the carry again when they drop. Whether any of it reads as
 * a body moving is PLAYTEST.md's. Every state is reached the way a
 * player reaches it, through the real keys (tests/fuzz.js's lesson):
 * `strike` drives the Shade into a named state and leaves it there, for
 * the check here and for the photograph (tests/look.js, F7).
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { SHADE_STATE } from '../entities/agent.js';
import { WARDEN_STATE } from '../entities/enforcer.js';
import { WARDEN_FIGURE } from '../entities/wardenmesh.js';
import { findGroundLedge } from './movement.js';
import { clearLane, alongLane } from './lanes.js';
import { press } from './feel.js';

const S = CONFIG.shade;
const W = CONFIG.warden;
const DT = CONFIG.time.fixedDt;
/** Two poses are apart when some limb differs by this much, in radians (about fourteen degrees). */
const APART = 0.25;
/** A leg is swinging when it reaches this far from the vertical ... */
const SWINGS = 0.3;
/** ... and at rest when it stays within this. */
const STILL = 0.05;
/** Frames for a pose to settle: three blends' worth (pose.js). */
const SETTLE = 20;
/** How far the ground covered between crossings may be from the stride: the ease lags every crossing alike, so this is the speed ramp and the last frame's rounding. */
const STRIDE_TOLERANCE = 0.15;

/** The rotations of the six groups: what `easePose` writes, read back as a flat record. */
function readPose(actor) {
  const parts = actor.mesh.userData.parts;
  const body = parts.torso || parts.chest;
  return {
    torsoX: body.rotation.x, torsoZ: body.rotation.z, lift: body.position.y - body.userData.baseY, headX: parts.head.rotation.x,
    armLX: parts.armL.rotation.x, armLZ: parts.armL.rotation.z, armRX: parts.armR.rotation.x, armRZ: parts.armR.rotation.z,
    legLX: parts.legL.rotation.x, legLZ: parts.legL.rotation.z, legRX: parts.legR.rotation.x, legRZ: parts.legR.rotation.z,
  };
}

const LIMBS = ['torsoX', 'torsoZ', 'headX', 'armLX', 'armLZ', 'armRX', 'armRZ', 'legLX', 'legLZ', 'legRX', 'legRZ'];

/** The largest difference between two poses over the rotations, the short way round, and where it is. */
function apart(a, b) {
  let most = 0;
  let where = '';
  for (const limb of LIMBS) {
    let d = Math.abs(a[limb] - b[limb]);
    d = Math.abs(d - Math.round(d / (2 * Math.PI)) * 2 * Math.PI);
    if (d > most) { most = d; where = limb; }
  }
  return { most, where };
}

/** One fixed step and one drawn frame, the way the loop runs at 60Hz, for both bodies. */
function frame(h) {
  h.stepFrames(1);
  h.input.clearEdges();
  h.shade.updateVisual(DT);
  h.warden.updateVisual(DT);
}

/** Frames until `until` holds (or `limit` frames), then `settle` more with it still holding. */
function frameUntil(h, until, limit, settle = 0) {
  for (let i = 0; i < limit; i++) {
    frame(h);
    if (until()) {
      for (let j = 0; j < settle && until(); j++) frame(h);
      return true;
    }
  }
  return false;
}

/**
 * Walk (or sprint) `frames` down a lane and watch the left leg: its
 * furthest reach from the vertical, how many times it crossed it, the
 * ground covered, and the ground covered between one crossing and the
 * next - the stride the feet plant at, whatever the clock did.
 */
function gait(h, actor, lane, held, frames) {
  actor.reset({ position: { x: lane.x, y: lane.y, z: lane.z }, yaw: lane.yaw });
  actor.pitch = 0;
  for (let i = 0; i < 10; i++) frame(h);
  h.input.clearAll();
  for (const code of held) h.input.heldCodes.add(code);
  const from = { x: actor.position.x, z: actor.position.z };
  const along = () => Math.hypot(actor.position.x - from.x, actor.position.z - from.z);
  let reach = 0;
  let last = 0;
  const crossedAt = [];
  for (let i = 0; i < frames; i++) {
    frame(h);
    const leg = actor.mesh.userData.parts.legL.rotation.x;
    reach = Math.max(reach, Math.abs(leg));
    if (i > 0 && Math.sign(leg) !== Math.sign(last) && leg !== 0 && last !== 0) crossedAt.push(along());
    last = leg;
  }
  h.input.clearAll();
  const crossings = crossedAt.length;
  const stride = crossings >= 2 ? (crossedAt[crossings - 1] - crossedAt[0]) / (crossings - 1) : null;
  return { reach, crossings, distance: along(), stride };
}

const fmt = (n) => (n === null ? '-' : n.toFixed(2));

/**
 * The feet plant once a stride: at least two crossings of the vertical in
 * the run, and the ground covered between one and the next within
 * `STRIDE_TOLERANCE` of the band's footstep stride. A swing on the clock
 * gives a walk 2.5m and a sprint 3.4m here, and this says so.
 */
function strideProblems(doing, run, stride) {
  if (run.crossings < 2) return [`${doing} ${run.distance.toFixed(1)}m the leg crossed the vertical ${run.crossings} time(s), want one a stride (${stride}m)`];
  if (Math.abs(run.stride - stride) > stride * STRIDE_TOLERANCE) {
    return [`${doing}, the leg crosses the vertical every ${run.stride.toFixed(2)}m, want the ${stride}m stride within ${STRIDE_TOLERANCE * 100}% - the swing is not by the ground covered`];
  }
  return [];
}

/** The furthest the left leg strays from the vertical over `frames` with nothing held. */
function standing(h, actor, frames) {
  h.input.clearAll();
  let stray = 0;
  for (let i = 0; i < frames; i++) {
    frame(h);
    stray = Math.max(stray, Math.abs(actor.mesh.userData.parts.legL.rotation.x));
  }
  return stray;
}

/**
 * Drive the Shade at a ledge from 0.8m off its face: forward held, Space
 * pressed on the fifth step (held through or released the next), then
 * frames until `state` is `mid` of the way through its move.
 */
function climb(h, spot, state, hold, mid) {
  const shade = h.shade;
  shade.reset({ position: { x: spot.x, y: CONFIG.map.groundY, z: spot.z }, yaw: spot.yaw });
  for (let i = 0; i < 3; i++) frame(h);
  h.input.clearAll();
  h.input.heldCodes.add('KeyW');
  for (let i = 0; i < 5; i++) frame(h);
  press(h, 'Space');
  frame(h);
  if (!hold) h.input.heldCodes.delete('Space');
  const through = () => shade.state === state && shade._move && shade._move.timer / shade._move.duration >= mid;
  return frameUntil(h, through, 90);
}

/** The states `strike` knows, in the order the check reads them. */
export const STRIKES = ['walk', 'sprint', 'crouch', 'slide', 'rise', 'fall', 'landing', 'vault', 'mantle', 'grab', 'hang', 'pullup'];

/**
 * Drive the Shade into a named state the way a player does - from the
 * first clear lane, or the ledge the map has for it (tests/movement.js's
 * `findGroundLedge`, the controller's own probe the arbiter) - and leave
 * it there with the keys cleared: mid-stride for a walk and a sprint, part
 * way through the move for a vault, a mantle, a grab and a pull-up, on
 * the way up and on the way down for a jump, while the legs take it for
 * a landing. The frame after is the photograph's (tests/look.js).
 *
 * @returns {{ reached: boolean, why: string }} `why` says what stopped it
 */
export function strike(h, name) {
  const shade = h.shade;
  const lane = clearLane(h, 10);
  if (!lane) return { reached: false, why: 'no clear 10m lane on this map' };
  const rest = { x: lane.x, y: lane.y, z: lane.z };
  const stand = () => {
    shade.reset({ position: rest, yaw: lane.yaw });
    shade.pitch = 0;
    for (let i = 0; i < 5; i++) frame(h);
    h.input.clearAll();
  };
  const done = (reached, why) => { h.input.clearAll(); return { reached, why: reached ? '' : why }; };
  const hangMin = S.standHeight * S.hangMinHeightRatio;
  const fullReach = S.reach.standing + S.reach.jumpBonus;
  switch (name) {
    case 'walk':
    case 'sprint': {
      stand();
      h.input.heldCodes.add('KeyW');
      if (name === 'sprint') h.input.heldCodes.add('ShiftLeft');
      // To speed, then to the leg's furthest reach: the frame after a
      // crossing of the amplitude's sign is as far as the stride goes.
      for (let i = 0; i < 30; i++) frame(h);
      let last = Math.abs(shade.mesh.userData.parts.legL.rotation.x);
      let rising = false;
      const reached = frameUntil(h, () => {
        const now = Math.abs(shade.mesh.userData.parts.legL.rotation.x);
        const peak = rising && now < last;
        rising = now > last;
        last = now;
        return peak;
      }, 60);
      return done(reached && shade.speed > 0.2, `the ${name} never swung a leg (speed ${shade.speed.toFixed(1)})`);
    }
    case 'crouch': {
      stand();
      h.input.heldCodes.add('ControlLeft');
      for (let i = 0; i < SETTLE + 10; i++) frame(h);
      return done(shade.crouching, `holding crouch did not crouch (state ${shade.state})`);
    }
    case 'slide': {
      stand();
      h.input.heldCodes.add('KeyW');
      h.input.heldCodes.add('ShiftLeft');
      for (let i = 0; i < 40; i++) frame(h);
      press(h, 'ControlLeft');
      const reached = frameUntil(h, () => shade.state === SHADE_STATE.SLIDE, 10, 12);
      return done(reached, `a crouch at ${shade.speed.toFixed(1)} m/s did not slide (state ${shade.state})`);
    }
    case 'rise':
    case 'fall': {
      stand();
      press(h, 'Space');
      const rose = frameUntil(h, () => shade.state === SHADE_STATE.AIR && shade.velocity.y > 0, 10, 6);
      if (name === 'rise') return done(rose, `a jump did not rise (state ${shade.state})`);
      const fell = rose && frameUntil(h, () => shade.state === SHADE_STATE.AIR && shade.velocity.y < -2, 60, 4);
      return done(fell, `the jump did not come down (state ${shade.state}, vy ${shade.velocity.y.toFixed(1)})`);
    }
    case 'landing': {
      shade.reset({ position: { x: rest.x, y: rest.y + S.landing.hardFall + 1, z: rest.z }, yaw: lane.yaw });
      shade.pitch = 0;
      h.input.clearAll();
      const reached = frameUntil(h, () => shade.state === SHADE_STATE.GROUND && shade._landRecovery > 0, 240, 3);
      return done(reached, `a ${(S.landing.hardFall + 1).toFixed(1)}m drop did not land hard (state ${shade.state}, feet ${shade.feetY.toFixed(2)})`);
    }
    case 'vault': {
      const spot = findGroundLedge(h, S.vaultMinHeight + 0.1, S.reach.vaultTop);
      if (!spot) return done(false, 'no vault-height ground ledge was found');
      return done(climb(h, spot, SHADE_STATE.VAULT, true, 0.4), `a press at ${spot.box.tag || 'the ledge'} did not reach the middle of a vault (state ${shade.state})`);
    }
    case 'mantle': {
      const spot = findGroundLedge(h, S.reach.vaultTop + 0.1, Math.min(hangMin - 0.05, S.reach.standing));
      if (!spot) return done(false, 'no mantle-height ground ledge under the hang height was found');
      return done(climb(h, spot, SHADE_STATE.MANTLE, true, 0.4), `holding Space at ${spot.box.tag || 'the ledge'} did not reach the middle of a mantle (state ${shade.state})`);
    }
    case 'grab':
    case 'hang':
    case 'pullup': {
      const spot = findGroundLedge(h, hangMin, fullReach, { hangable: true });
      if (!spot) return done(false, 'no hangable ground-level ledge was found');
      const tag = spot.box.tag || 'the ledge';
      const grabbed = climb(h, spot, SHADE_STATE.GRAB, false, 0.5);
      if (name === 'grab') return done(grabbed, `a tap at ${tag} did not reach the middle of a grab (state ${shade.state})`);
      h.input.clearAll();
      const hung = grabbed && frameUntil(h, () => shade.state === SHADE_STATE.HANG, 30, SETTLE);
      if (name === 'hang') return done(hung, `the grab at ${tag} did not end hanging (state ${shade.state})`);
      if (!hung) return done(false, `the grab at ${tag} did not end hanging (state ${shade.state})`);
      press(h, 'Space');
      frame(h);
      h.input.heldCodes.delete('Space');
      const half = () => shade.state === SHADE_STATE.PULLUP && shade._move && shade._move.timer / shade._move.duration >= 0.5;
      return done(frameUntil(h, half, 60), `Space from the hang at ${tag} did not reach the middle of a pull-up (state ${shade.state})`);
    }
    default:
      return done(false, `no such state as "${name}" to strike; one of ${STRIKES.join(', ')}`);
  }
}

/** The world height of a limb group's end (the glove, the gauntlet, the boot). */
function endHeight(actor, limb) {
  actor.mesh.updateMatrixWorld(true);
  const end = limb.children[limb.children.length - 1];
  return end.getWorldPosition(actor.mesh.position.clone()).y;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-shade-has-a-pose-for-every-state-and-a-stride-for-every-step',
    spec: 'Section 4 (procedural animation) / E3',
    name: 'Every state of the Shade is drawn apart from the standing rest and from every other; the legs swing walking and not standing, further sprinting, once per stride of the ground covered; the pull-up brings the hands over the front',
    run: (h) => {
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
      const shade = h.shade;
      const problems = [];
      const readings = [];
      const poses = {};

      // Standing on the first clear lane: the rest every pose is measured
      // against, and no swing in it.
      const lane = clearLane(h, 10);
      if (!lane) return { pass: false, detail: 'no clear 10m lane on this map to walk down' };
      const rest = { x: lane.x, y: lane.y, z: lane.z };
      shade.reset({ position: rest, yaw: lane.yaw });
      shade.pitch = 0;
      for (let i = 0; i < 60; i++) frame(h);
      poses.stand = readPose(shade);
      const stray = standing(h, shade, 30);
      if (stray > STILL) problems.push(`standing still the left leg strays ${stray.toFixed(3)} rad from the vertical`);

      // The gait: a walk and a sprint down the lane. The leg swings, further
      // at a sprint, and crosses the vertical once per stride of the band's
      // footstep - the plant is by the ground covered, not the clock.
      const walk = gait(h, shade, lane, ['KeyW'], 90);
      const sprint = gait(h, shade, lane, ['KeyW', 'ShiftLeft'], 75);
      readings.push(`walking ${walk.distance.toFixed(1)}m the leg reached ${walk.reach.toFixed(2)} rad and crossed the vertical ${walk.crossings} times, ${fmt(walk.stride)}m apart (stride ${S.footstepStride}); `
        + `sprinting ${sprint.distance.toFixed(1)}m, ${sprint.reach.toFixed(2)} rad, ${sprint.crossings} crossings ${fmt(sprint.stride)}m apart (stride ${S.sprintFootstepStride})`);
      if (walk.reach < SWINGS) problems.push(`walking, the leg reaches only ${walk.reach.toFixed(2)} rad`);
      if (sprint.reach < walk.reach + 0.1) problems.push(`sprinting, the leg reaches ${sprint.reach.toFixed(2)} rad against ${walk.reach.toFixed(2)} walking - the swing is not by speed`);
      problems.push(...strideProblems('walking', walk, S.footstepStride), ...strideProblems('sprinting', sprint, S.sprintFootstepStride));

      // Every other state, struck the way a player gets there (`strike`),
      // and read where it leaves the body: the crouch and the slide, the
      // jump on the way up and down, a hard landing while the legs take
      // it, and the climbs at the ledges the map has, part way through.
      for (const name of STRIKES.slice(2)) {
        const struck = strike(h, name);
        if (!struck.reached) { problems.push(struck.why); continue; }
        poses[name] = readPose(shade);
      }
      if (poses.hang && (poses.hang.armLX > -3.0 || poses.hang.armRX > -3.0)) problems.push(`hanging arms at ${poses.hang.armLX.toFixed(2)} / ${poses.hang.armRX.toFixed(2)}, not straight up`);
      // The pull-up: the hands stay on the lip and come past the front of
      // the body, so half way through the arms are ahead of it, not behind.
      if (poses.pullup && !(poses.pullup.armLX > 0.5 && poses.pullup.armLX < Math.PI)) problems.push(`half way up the pull-up the left arm is at ${poses.pullup.armLX.toFixed(2)} rad - the hands went behind, not over the front`);

      // Every pose apart from the rest, and from every other. The grab is
      // the reach into the hang and is measured against the rest only.
      const named = Object.keys(poses).filter((name) => name !== 'stand');
      for (const name of named) {
        const d = apart(poses[name], poses.stand);
        if (d.most < APART) problems.push(`the ${name} is drawn ${d.most.toFixed(2)} rad from standing at most (${d.where || 'nowhere'}), want ${APART}`);
      }
      const distinct = named.filter((name) => name !== 'grab');
      const closest = { most: Infinity, pair: '' };
      for (let i = 0; i < distinct.length; i++) {
        for (let j = i + 1; j < distinct.length; j++) {
          const d = apart(poses[distinct[i]], poses[distinct[j]]);
          if (d.most < closest.most) { closest.most = d.most; closest.pair = `${distinct[i]} and ${distinct[j]}`; }
          if (d.most < APART) problems.push(`the ${distinct[i]} and the ${distinct[j]} are drawn ${d.most.toFixed(2)} rad apart at most (${d.where || 'nowhere'}), want ${APART}`);
        }
      }
      readings.push(`${named.length} poses apart from standing, the closest pair ${closest.pair} by ${Number.isFinite(closest.most) ? closest.most.toFixed(2) : '-'} rad`);

      h.input.clearAll();
      shade.reset(h.map.shadeSpawns[0]);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${readings.join('; ')}; the hanging arms straight up and half way up the pull-up the left arm at ${poses.pullup ? poses.pullup.armLX.toFixed(2) : '-'} rad, over the front; standing still the leg strays ${stray.toFixed(3)} rad`
          : `${problems.join('; ')} [${readings.join('; ')}]`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-warden-walks-heavy-and-raises-the-rifle-to-where-it-looks',
    spec: 'Section 4 (procedural animation), Section 6.2 (ADS) / E3',
    name: 'The Warden\'s legs swing walking and not standing, once per stride; the sights bring the right arm and the rifle up to level, the aim\'s pitch raises them further, dropping the sights brings the carry back; the stun drops them',
    run: (h) => {
      h.initMatch({ mode: 'freeroam', role: 'warden', ai: false, objective: false });
      const warden = h.warden;
      const problems = [];
      const readings = [];

      const lane = clearLane(h, 10);
      if (!lane) return { pass: false, detail: 'no clear 10m lane on this map to walk down' };
      const rest = { x: lane.x, y: lane.y, z: lane.z };
      warden.reset({ position: rest, yaw: lane.yaw });
      warden.pitch = 0;
      h.input.clearAll();
      for (let i = 0; i < 60; i++) frame(h);
      const carry = readPose(warden);
      const carryHand = endHeight(warden, warden.mesh.userData.parts.armR);
      const REST = WARDEN_FIGURE.arm.rest;
      if (Math.abs(carry.armRX - REST.right.x) > 0.02 || Math.abs(carry.armLX - REST.left.x) > 0.02) {
        problems.push(`standing, the arms are at ${carry.armLX.toFixed(2)} / ${carry.armRX.toFixed(2)}, not the carry ${REST.left.x} / ${REST.right.x}`);
      }
      const stray = standing(h, warden, 30);
      if (stray > STILL) problems.push(`standing still the left leg strays ${stray.toFixed(3)} rad from the vertical`);

      // The walk: the legs swing, once a stride, and the body rolls.
      const walk = gait(h, warden, lane, ['KeyW'], 90);
      let roll = 0;
      warden.reset({ position: rest, yaw: lane.yaw });
      h.input.heldCodes.add('KeyW');
      for (let i = 0; i < 60; i++) { frame(h); roll = Math.max(roll, Math.abs(warden.mesh.userData.parts.chest.rotation.z)); }
      h.input.clearAll();
      readings.push(`walking ${walk.distance.toFixed(1)}m the leg reached ${walk.reach.toFixed(2)} rad and crossed the vertical ${walk.crossings} times, ${fmt(walk.stride)}m apart (stride ${W.footstepStride}), the body rolled ${roll.toFixed(3)} rad`);
      if (walk.reach < 0.15) problems.push(`walking, the Warden's leg reaches only ${walk.reach.toFixed(2)} rad`);
      problems.push(...strideProblems('walking', walk, W.footstepStride));
      if (roll < 0.03) problems.push(`walking, the body rolls ${roll.toFixed(3)} rad at most`);

      // The aim: the sights held (Mouse2 is what DEFAULT_BINDINGS.ads binds)
      // until the blend settles. Both arms rise out of the carry, the right
      // hand with them, and the head takes the aim.
      warden.reset({ position: rest, yaw: lane.yaw });
      warden.pitch = 0;
      for (let i = 0; i < 10; i++) frame(h);
      h.input.clearAll();
      h.input.heldCodes.add('Mouse2');
      for (let i = 0; i < 60; i++) frame(h);
      if (warden.adsBlend < 0.99) problems.push(`holding the sights, the blend is ${warden.adsBlend.toFixed(2)} after a second`);
      const aim = readPose(warden);
      const aimHand = endHeight(warden, warden.mesh.userData.parts.armR);
      readings.push(`the sights raise the right arm from ${carry.armRX.toFixed(2)} to ${aim.armRX.toFixed(2)} rad and the hand ${(aimHand - carryHand).toFixed(2)}m`);
      if (aim.armRX < carry.armRX + APART) problems.push(`the sights raise the right arm ${(aim.armRX - carry.armRX).toFixed(2)} rad, want ${APART}`);
      if (aim.armLX < carry.armLX + APART) problems.push(`the sights raise the left arm ${(aim.armLX - carry.armLX).toFixed(2)} rad, want ${APART}`);
      if (aimHand < carryHand + 0.1) problems.push(`the sights raise the right hand ${(aimHand - carryHand).toFixed(2)}m, want 0.1`);
      if (Math.abs(aim.legLX) > STILL) problems.push(`aiming on the spot, the leg is at ${aim.legLX.toFixed(2)} rad`);

      // Looking up through the sights raises the rifle further, by the pitch.
      warden.look(0, 0.6);
      for (let i = 0; i < SETTLE + 10; i++) frame(h);
      const up = readPose(warden);
      if (up.armRX < aim.armRX + 0.4) problems.push(`looking 0.6 rad up through the sights raised the right arm ${(up.armRX - aim.armRX).toFixed(2)} rad, want about 0.6`);
      if (up.headX < aim.headX + 0.4) problems.push(`looking 0.6 rad up through the sights pitched the head ${(up.headX - aim.headX).toFixed(2)} rad, want most of it`);
      warden.look(0, -0.6);

      // The sights dropped: the carry again.
      h.input.clearAll();
      for (let i = 0; i < 60; i++) frame(h);
      const lowered = readPose(warden);
      const back = apart(lowered, carry);
      if (back.most > 0.05) problems.push(`a second after the sights drop the ${back.where} is still ${back.most.toFixed(2)} rad from the carry`);

      // The stun: the arms down, the rifle with them.
      warden.stun(2);
      for (let i = 0; i < SETTLE + 10; i++) frame(h);
      if (warden.state !== WARDEN_STATE.STUNNED) problems.push(`stun() left the Warden ${warden.state}`);
      const stunned = readPose(warden);
      if (stunned.armRX > 0.2) problems.push(`stunned, the right arm is at ${stunned.armRX.toFixed(2)} rad, not dropped`);
      if (apart(stunned, carry).most < APART) problems.push('the stun is drawn no differently from the carry');
      readings.push(`stunned the arms drop to ${stunned.armRX.toFixed(2)} rad`);

      h.input.clearAll();
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${readings.join('; ')}; looking 0.6 rad up raised it to ${up.armRX.toFixed(2)} and the head to ${up.headX.toFixed(2)}; the carry back within ${back.most.toFixed(3)} rad of itself a second after; standing still the leg strays ${stray.toFixed(3)} rad`
          : `${problems.join('; ')} [${readings.join('; ')}]`,
      };
    },
  });
}
