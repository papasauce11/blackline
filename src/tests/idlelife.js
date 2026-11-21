/**
 * BLACKLINE - tests/idlelife.js
 *
 * AUTO suite (J8): a body at rest is never still, and one behind a menu always
 * is. Both figures breathe, the Warden's head turns before its body, and on
 * the open yard the Shade's hood moves in the wind (`entities/idlemotion.js`);
 * all of it is presentation, drawn on the wall clock inside `updateVisual`
 * and gone the moment no round is on screen.
 *
 * **Read off the nodes, driven the way a player drives.** The breath is the
 * height of each figure's left shoulder (its arm group), the wind is the yaw
 * of the Shade's torso (the hood is merged into it, and a figure may not spend
 * a thirteenth draw call on a hood of its own - `figure.js`), the neck is the
 * Warden's head yaw against its body's. Not the torso's pitch or the chest's
 * height, which `breathcensus.js` holds still. The state the frame decides - a round
 * on screen, or a pause over it - is delivered by a real `renderFrame`, and the
 * frames that follow are `frame()`s: a hundred drawn frames under software
 * WebGL is a cost this suite has refused before (`camerasettings.js`) and the
 * nodes are the same either way. The turn is a mouse flick on the locked input,
 * consumed by `cameraOwner.look()` as a player's is; the pause is `setPaused`.
 *
 * **Why the series is ten seconds and not two.** The breath is 3.4s a cycle
 * (`CONFIG.idle`), and a clause that wants the maximum *and* the minimum
 * reached more than once needs two whole cycles at least - 120 frames is a
 * third of one. 600 frames is nearly three, and a frame here is a step and
 * two eases, not a draw.
 *
 * **The sprint is the difference of two runs, not a reading.** A shoulder at
 * speed rides the stride's own bob, and a reading of the node would
 * measure that. Two sprints from one place, the first with the round on screen
 * and the second behind a pause, differ by exactly what the idle motion adds:
 * the bob is a function of speed alone, so it cancels, and the number left
 * is the idle contribution.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG, SETTINGS } from '../config.js';
import { idleLifeState } from '../entities/idlemotion.js';
import { isOutdoorMap } from '../maps/index.js';
import { clearLane } from './lanes.js';
import { quiesce } from './pixels.js';
import { frame } from './strikedrive.js';

const I = CONFIG.idle;
const S = CONFIG.shade;
const W = CONFIG.warden;
const TAU = 2 * Math.PI;
const DEG = 180 / Math.PI;

/** Frames of a resting series: ten seconds, which is 2.9 breaths. */
const SERIES = 600;
/** Frames a body gets to come to rest, or to ease back to square, before a series is read. */
const SETTLE = 60;
/** The least a breath may lift a shoulder, either side of its mean, in metres: a quarter of what `CONFIG.idle` asks. */
const BREATH_FLOOR = 0.005;
/** The least the wind may turn a hood, in radians: a sixth of what `CONFIG.idle` asks. */
const WIND_FLOOR = 0.01;
/** What "moved nothing" reads at, in metres or radians: float dust is far inside it. */
const STILL = 1e-9;
/** Sprint's idle contribution as a share of the rest amplitude it must be under. */
const SPRINT_SHARE = 0.05;
/** A flick of the mouse, in radians of turn: inside the neck's clamp, so the head can be on it at once. */
const TURN = 0.6;
/** And one past the clamp, to see the clamp hold. */
const BIG_TURN = 2.0;
/** The head is on the facing, or the body is, when it is within this many radians of it. */
const ON = 0.0087;
/** Frames a turn is watched for. */
const TURN_FRAMES = 120;
/** Frames of a sprint, and the first of them whose contribution is read: the ramp to full speed is over by then. */
const SPRINT_FRAMES = 70;
const SPRINT_FROM = 40;
/** The metres of lane: the Shade's sprint run, and the other body parked beyond it. */
const LANE = 14;
const PARK = 10;

/** `a - b` the short way round, in (-pi, pi]. */
const wrap = (a, b) => {
  const d = a - b;
  return d - Math.round(d / TAU) * TAU;
};

const fmt = (n, digits = 4) => n.toFixed(digits);
const deg = (rad) => `${(rad * DEG).toFixed(1)}deg`;

/** The nodes this reads: each figure's left shoulder, the Shade's torso (the hood) and the Warden's head. */
function nodes(h) {
  const s = h.shade.mesh.userData.parts;
  const w = h.warden.mesh.userData.parts;
  return { shade: s.armL, warden: w.armL, hood: s.torso, head: w.head };
}

/** Both bodies on the lane, `mover` at its start and the other `PARK` metres down it, both facing along it. */
function stand(h, lane, mover = 'shade') {
  const start = { x: lane.x, y: lane.y, z: lane.z };
  const parked = { x: lane.x + lane.dx * PARK, y: lane.y, z: lane.z + lane.dz * PARK };
  h.shade.reset({ position: mover === 'shade' ? start : parked, yaw: lane.yaw });
  h.warden.reset({ position: mover === 'shade' ? parked : start, yaw: lane.yaw });
  h.shade.pitch = 0;
  h.warden.pitch = 0;
}

/**
 * The round on screen, or a pause over it, as a frame decides it: one real
 * `renderFrame`, which is where `main.js` tells the bodies. A pause drops the
 * held keys, so the caller holds its own after this.
 */
function tell(h, onScreen) {
  h.resetPresentation();
  if (!onScreen) h.setPaused(true);
  h.renderFrame(1 / 60);
}

/** `frames` frames with nothing held, a reading off each: `read(h)` returns an object of numbers. */
function watch(h, frames, read) {
  const rows = [];
  for (let i = 0; i < frames; i++) {
    frame(h);
    rows.push(read(h));
  }
  return rows;
}

/** The maxima and minima of a series: its span, and how many whole peaks and troughs it reached. */
function swing(xs) {
  const hi = Math.max(...xs);
  const lo = Math.min(...xs);
  const span = hi - lo;
  let maxima = 0;
  let minima = 0;
  for (let i = 1; i < xs.length - 1; i++) {
    if (xs[i] > xs[i - 1] && xs[i] >= xs[i + 1] && xs[i] >= hi - 0.1 * span) maxima++;
    if (xs[i] < xs[i - 1] && xs[i] <= xs[i + 1] && xs[i] <= lo + 0.1 * span) minima++;
  }
  return { hi, lo, span, amplitude: span / 2, maxima, minima };
}

/** The most any value of a series strays from its first: "moved nothing" is this being under `STILL`. */
function strayed(xs) {
  return Math.max(...xs.map((x) => Math.abs(x - xs[0])));
}

/**
 * The Warden turned by a flick of the mouse and watched: the head's world yaw
 * against the body's, frame by frame from the one that drew the flick.
 */
function turned(h, lane, radians) {
  const warden = h.warden;
  const nodesNow = nodes(h);
  stand(h, lane, 'warden');
  tell(h, true);
  h.setCameraOwner('warden');
  h.input.locked = true;
  for (let i = 0; i < SETTLE; i++) frame(h);
  const from = warden.yaw;
  // `lookDelta` is `-dx * sensitivity`: a flick of this many counts turns the camera by `radians`.
  h.input.mouse.dx = -radians / SETTINGS.mouseSensitivity;
  h.renderFrame(1 / 60);
  const done = wrap(warden.yaw, from);
  const rows = [];
  const read = () => {
    const body = h.warden.mesh.rotation.y;
    rows.push({
      lead: nodesNow.head.rotation.y,
      head: wrap(warden.yaw, body + nodesNow.head.rotation.y),
      body: wrap(warden.yaw, body),
    });
  };
  read();
  for (let i = 0; i < TURN_FRAMES; i++) {
    frame(h);
    read();
  }
  h.input.locked = false;
  h.input.clearAll();
  // The first frame each node is on the facing: the head's world yaw, then the body's.
  const first = (key) => rows.findIndex((row) => Math.abs(row[key]) < ON);
  let at = 0;
  for (let i = 1; i < rows.length; i++) if (Math.abs(rows[i].lead) > Math.abs(rows[at].lead)) at = i;
  return { done, lead: Math.abs(rows[at].lead), leadFrame: at, headOn: first('head'), bodyOn: first('body') };
}

/**
 * The idle contribution a sprint adds to a shoulder: its height over a sprint
 * with the round on screen less the same sprint behind a pause, at the frames
 * after the ramp. `who` is 'shade' or 'warden', whichever the match's human is.
 */
function sprintContribution(h, lane, who) {
  const keys = ['KeyW', 'ShiftLeft'];
  const run = (onScreen) => {
    stand(h, lane, who);
    tell(h, onScreen);
    // The keys move a body only under the pointer lock, and a pause lets go of it.
    h.input.locked = true;
    for (let i = 0; i < SETTLE; i++) frame(h);
    for (const code of keys) h.input.heldCodes.add(code);
    const node = nodes(h)[who];
    const actor = who === 'shade' ? h.shade : h.warden;
    const height = [];
    let slowest = Infinity;
    for (let i = 0; i < SPRINT_FRAMES; i++) {
      frame(h);
      if (i >= SPRINT_FROM) {
        height.push(node.position.y);
        slowest = Math.min(slowest, actor.speed);
      }
    }
    h.input.clearAll();
    h.input.locked = false;
    return { height, slowest };
  };
  const live = run(true);
  const still = run(false);
  let most = 0;
  for (let i = 0; i < live.height.length; i++) most = Math.max(most, Math.abs(live.height[i] - still.height[i]));
  return { most, slowest: Math.min(live.slowest, still.slowest) };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-body-at-rest-is-never-still-and-one-in-a-menu-always-is',
    spec: 'Section 4 / J8',
    name: 'Standing still both figures breathe, periodically and by a stated amount; behind a menu the same nodes move nothing; the Warden\'s head leads its body through a turn, inside the neck\'s clamp; the Shade\'s hood moves in the yard\'s wind and not in the plant; and the sway has gone by a sprint',
    run: (h) => {
      const problems = [];
      const readings = [];
      const restore = quiesce(h);
      try {
        const lane = clearLane(h, LANE);
        if (!lane) return { pass: false, detail: `no clear ${LANE}m lane on this map to stand two bodies on` };
        const outdoor = isOutdoorMap(h.map.id);

        // ----------------------------------------------------------------
        // (a) and (d): the round on screen, nothing held. Each figure's
        // shoulder rides the breath; the Shade's torso (its hood)
        // rolls with the wind on the yard and not under a roof.
        // ----------------------------------------------------------------
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
        stand(h, lane);
        tell(h, true);
        const state = idleLifeState();
        if (!state.live) problems.push('a round on screen and a frame drawn, and the bodies were told it is not on screen');
        if (state.windy !== outdoor) problems.push(`the registry says ${h.map.id} is ${outdoor ? '' : 'not '}outdoor and the frame told the bodies the wind is ${state.windy ? 'up' : 'down'}`);
        h.input.clearAll();
        for (let i = 0; i < SETTLE; i++) frame(h);
        const n = nodes(h);
        const rest = watch(h, SERIES, () => ({ shade: n.shade.position.y, warden: n.warden.position.y, hood: n.hood.rotation.y }));
        const shade = swing(rest.map((r) => r.shade));
        const warden = swing(rest.map((r) => r.warden));
        const hood = swing(rest.map((r) => r.hood));
        for (const [who, s] of [['Shade\'s shoulder', shade], ['Warden\'s shoulder', warden]]) {
          if (!(s.amplitude >= BREATH_FLOOR)) problems.push(`(a) the ${who} rides ${fmt(s.amplitude)}m about its mean over ${SERIES} frames at rest, want at least ${BREATH_FLOOR} - a body at rest is still`);
          if (s.maxima < 2 || s.minima < 2) problems.push(`(a) the ${who} reached its maximum ${s.maxima} and its minimum ${s.minima} times in ${SERIES} frames, want each more than once - that is a drift and not a breath`);
        }
        readings.push(`(a) at rest over ${SERIES} frames the Shade's shoulder rides +-${fmt(shade.amplitude)}m (${shade.maxima} peaks, ${shade.minima} troughs) and the Warden's +-${fmt(warden.amplitude)}m (${warden.maxima}, ${warden.minima}), floor ${BREATH_FLOOR}m`);
        const rolled = Math.max(Math.abs(hood.hi), Math.abs(hood.lo));
        if (outdoor && !(rolled >= WIND_FLOOR)) problems.push(`(d) on ${h.map.id}, an outdoor map, the Shade's hood turns only ${fmt(rolled)} rad over ${SERIES} frames at rest, want at least ${WIND_FLOOR}`);
        if (!outdoor && rolled > STILL) problems.push(`(d) on ${h.map.id}, which is under a roof, the Shade's hood turns ${fmt(rolled, 6)} rad at rest, want 0`);
        readings.push(`(d) ${h.map.id} (${outdoor ? 'outdoor' : 'indoor'}): the hood turns to ${fmt(rolled)} rad over ${SERIES} frames at rest, ${outdoor ? `floor ${WIND_FLOOR}` : 'want 0'}`);

        // ----------------------------------------------------------------
        // (b): the same frames behind the pause menu, the Warden turned to
        // face somewhere else on the way. Nothing moves; the Warden is drawn
        // square to its facing with its head straight on the body.
        // ----------------------------------------------------------------
        tell(h, false);
        if (idleLifeState().live) problems.push('a pause over the round and a frame drawn, and the bodies were told the round is on screen');
        for (let i = 0; i < SETTLE; i++) frame(h);
        const side = { x: h.warden.position.x + 3, y: h.warden.eyeY, z: h.warden.position.z };
        h.warden.lookAt(side);
        let squareness = 0;
        const menu = watch(h, SERIES, () => {
          squareness = Math.max(squareness, Math.abs(wrap(h.warden.yaw, h.warden.mesh.rotation.y)), Math.abs(n.head.rotation.y));
          return { shade: n.shade.position.y, warden: n.warden.position.y, hood: n.hood.rotation.y };
        });
        const moved = {
          shade: strayed(menu.map((r) => r.shade)),
          warden: strayed(menu.map((r) => r.warden)),
          hood: strayed(menu.map((r) => r.hood)),
        };
        for (const [what, d] of [['the Shade\'s shoulder', moved.shade], ['the Warden\'s shoulder', moved.warden], ['the Shade\'s hood', moved.hood], ['the Warden\'s neck', squareness]]) {
          if (d > STILL) problems.push(`(b) behind a menu ${what} moved ${fmt(d, 9)} over ${SERIES} frames, want 0`);
        }
        readings.push(`(b) behind the pause menu over ${SERIES} frames the Shade's shoulder moved ${fmt(moved.shade, 9)}m, the Warden's ${fmt(moved.warden, 9)}m, the hood ${fmt(moved.hood, 9)} rad, the neck ${fmt(squareness, 9)} rad (the Warden turned ${deg(Math.abs(wrap(h.warden.yaw, lane.yaw)))} meanwhile)`);
        h.resetPresentation();

        // ----------------------------------------------------------------
        // (c): the Warden turned by a mouse flick. Its head is on the new
        // facing first and its body follows, the gap never past the clamp,
        // and a flick past the clamp drags the body along at it.
        // ----------------------------------------------------------------
        h.initMatch({ mode: 'freeroam', role: 'warden', ai: false, objective: false });
        const turn = turned(h, lane, TURN);
        const clamp = I.neck.clamp;
        if (Math.abs(turn.done - TURN) > 0.02) problems.push(`(c) a flick for ${deg(TURN)} turned the Warden ${deg(turn.done)}, so the turn this reads is not the one it asked for`);
        if (!(turn.lead > 0.05)) problems.push(`(c) through a ${deg(TURN)} turn the head led the body by at most ${deg(turn.lead)}, want it non-zero - the head does not turn first`);
        if (turn.lead > clamp + 1e-6) problems.push(`(c) the head led the body by ${deg(turn.lead)}, past the neck's clamp of ${deg(clamp)}`);
        if (turn.headOn < 0 || turn.bodyOn < 0) problems.push(`(c) after ${TURN_FRAMES} frames the ${turn.headOn < 0 ? 'head' : 'body'} was still not on the new facing`);
        else if (!(turn.headOn < turn.bodyOn)) problems.push(`(c) the head was on the new facing at frame ${turn.headOn} and the body at frame ${turn.bodyOn}, want the head first`);
        readings.push(`(c) through a ${deg(TURN)} turn the head led the body by ${deg(turn.lead)} at frame ${turn.leadFrame} (clamp ${deg(clamp)}), on the facing at frame ${turn.headOn} and the body at frame ${turn.bodyOn}, ${turn.bodyOn - turn.headOn} frames later`);
        const big = turned(h, lane, BIG_TURN);
        if (big.lead > clamp + 1e-6 || big.lead < clamp - 0.01) problems.push(`(c) through a ${deg(BIG_TURN)} turn the head led by ${deg(big.lead)}, want it held at the clamp, ${deg(clamp)}`);
        readings.push(`past the clamp (${deg(BIG_TURN)}) the lead held at ${deg(big.lead)}`);

        // ----------------------------------------------------------------
        // (e): at a sprint the sway has gone. Each body's idle contribution
        // at full run, against the amplitude it had at rest.
        // ----------------------------------------------------------------
        const wardenRun = sprintContribution(h, lane, 'warden');
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
        const shadeRun = sprintContribution(h, lane, 'shade');
        for (const [who, run, at, floor] of [['Shade', shadeRun, shade.amplitude, I.fadeSpeed], ['Warden', wardenRun, warden.amplitude, I.fadeSpeed]]) {
          if (!(run.slowest > floor)) problems.push(`(e) the ${who} sprinted no faster than ${fmt(run.slowest, 2)} m/s, under the ${floor} m/s the sway fades at, so the sprint proves nothing`);
          if (!(run.most < at * SPRINT_SHARE)) problems.push(`(e) at a sprint the ${who}'s idle contribution is ${fmt(run.most, 6)}m against ${fmt(at)}m at rest, want under ${SPRINT_SHARE * 100}% of it`);
        }
        readings.push(`(e) at a sprint (never under ${fmt(Math.min(shadeRun.slowest, wardenRun.slowest), 2)} m/s, ${S.sprintSpeed} and ${W.sprintSpeed} asked) the idle contribution is ${fmt(shadeRun.most, 6)}m on the Shade against ${fmt(shade.amplitude)}m at rest and ${fmt(wardenRun.most, 6)}m on the Warden against ${fmt(warden.amplitude)}m, under ${SPRINT_SHARE * 100}%`);
      } finally {
        h.input.clearAll();
        h.resetPresentation();
        restore();
      }
      return { pass: problems.length === 0, detail: problems.length ? problems.join('; ') : readings.join('; ') };
    },
  });
}
