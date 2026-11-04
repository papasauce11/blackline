/**
 * BLACKLINE - tests/hearing.js
 *
 * AUTO suite (K2): the Warden remembers what it has heard, room by room.
 *
 * Hearing used to be a distance test with no past: a noise inside its radius
 * turned the Warden toward the exact coordinate of the sound, and the next
 * footstep two seconds later was a stranger to the first
 * (`systems/aihearing.js`). Now each room keeps an attention level that each
 * noise heard in it raises by how near it was and that fades on its own, and
 * when a room's level reaches `investigateAt` the Warden is sent: to the
 * room's waypoint if it is not in that room - a sound says which room and no
 * closer - and to the sound itself if it is, where it can tell.
 *
 * Two scenes, found at runtime on whatever map the page is on and naming no
 * coordinate. In both the Warden is held on its spot in PATROL as the AI
 * checks hold theirs, turned each step away from her so it never sees her and
 * this is only ever hearing, and the Shade walks a ring of clear floor inside
 * a room that has a waypoint to send the Warden to (W held, the heading
 * steered the way a mouse would):
 *
 *   inside   the Warden is in that room, at the ring's centre, and she WALKS
 *            two metres off it. A ring and not a pass or a pace, because the
 *            footstep wanted is the Nth in a steady cadence at one distance:
 *            a pass makes their distances depend on where in her stride she
 *            starts, and a pace loses a stride to every turn.
 *   outside  the Warden is out of that room - the next room, or open ground
 *            beside it - and she SPRINTS the ring, because a walking footstep
 *            carries four metres and the ring, the wall and the Warden's
 *            body do not fit in them. Noise has no occlusion, so being just
 *            across is being in earshot.
 *
 * Held:
 *
 *   rises      at each of her footsteps the room's attention goes up by what
 *              the curve says (`gain` of the way in from the edge of the
 *              footstep's radius), on the step after it is emitted, once; no
 *              other room's moves (both scenes)
 *   escalates  enough steps and the Warden is INVESTIGATE, sent by the
 *              attention and not by the suspicious hold running out (both)
 *   sent to the room, not the point
 *              from outside, to the room's waypoint: inside the room, and
 *              not where she was
 *   sent to the sound
 *              from inside, within 0.3m of her last footstep, not the waypoint
 *   one is not enough
 *              a single footstep leaves it SUSPICIOUS, below the line, for
 *              the time the hold has left to run
 *   decays     with her still and nothing new heard, the level is half of
 *              what it was after `decayTau * ln 2` seconds
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { AI_STATE } from '../systems/ai.js';
import { angleDelta } from '../systems/aistate.js';

const A = CONFIG.ai;
const H = A.hearing;
const S = CONFIG.shade;
const W = CONFIG.warden;
const dt = CONFIG.time.fixedDt;
const TAU = Math.PI * 2;

/** Metres from the Warden to the ring she walks, inside: a walking footstep (4m) carries well past it. */
const WALK_RING = 1.8;
/** The ring she sprints, outside, and the farthest any point of it is from the Warden: a sprint carries 12m. */
const RUN_RING = 2.0;
const EARSHOT = 5.8;
/** The ring and the floor either side of it are sampled this many times round, at this far in and out. */
const RING = 16;
const BAND = 0.4;
/** The room's waypoint must be this far from the ring, so reaching it is not where she was. */
const APART = 1.5;
/** Seconds to wait for the escalation before calling it never. */
const BOUND = 6;
/** The hold has this long left to run when "one footstep is not enough" is read. */
const HOLD_LEFT = 0.3;
/** Her last footstep and where the Warden is sent are the same place to within this, from inside. */
const SAME_PLACE = 0.3;
const BODY = { x: S.radius, y: S.standHeight / 2, z: S.radius };
const STANDING = { x: W.radius, y: W.standHeight / 2, z: W.radius };

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const onRing = (at, angle, radius) => ({ x: at.x + Math.cos(angle) * radius, y: at.y, z: at.z + Math.sin(angle) * radius });

/** Is a ring of `radius` round `centre`, and the floor either side of it, all inside `room`, on the Warden's ground and clear? */
function ringClear(h, room, centre, radius) {
  const ai = h.wardenAI;
  const ground = h.map.wardenGround;
  for (let k = 0; k < RING; k++) {
    for (const reach of [radius - BAND, radius, radius + BAND]) {
      const p = onRing(centre, (k / RING) * TAU, reach);
      if (ai._roomIndexAt(p) !== room || (ground && !ground.has(p, W.stepHeight))
        || !h.map.collision.isClear({ x: p.x, y: p.y + BODY.y + 0.05, z: p.z }, BODY)) return false;
    }
  }
  return true;
}

/** A spot in a room with a waypoint, and a clear ring round it inside the room: the Warden's spot and her ring's centre are one. */
function findInside(h) {
  const ai = h.wardenAI;
  const spots = [
    ...h.map.sites.map((site) => ({ at: site.position, from: `site ${site.id}` })),
    ...h.map.waypoints.filter(Boolean).map((node) => ({ at: node.position, from: `waypoint ${node.tag || node.id}` })),
    ...h.map.wardenSpawns.map((spawn) => ({ at: spawn.position, from: `spawn ${spawn.name}` })),
  ];
  for (const { at, from } of spots) {
    const room = ai._roomIndexAt(at);
    if (room < 0) continue;
    const target = ai._roomTarget(room);
    if (!target || flat(at, target) < WALK_RING + BAND + APART || !ringClear(h, room, at, WALK_RING)) continue;
    const spot = { x: at.x, y: at.y, z: at.z };
    return { at: spot, centre: spot, radius: WALK_RING, sprint: false, room, target, name: h.map.rooms[room].id, from: `ring round ${from}` };
  }
  return null;
}

/**
 * A ring inside a room that has a waypoint, and a spot for the Warden outside
 * that room - another room's floor or open ground - on its own ground and clear
 * for it, within earshot of every point of the ring. First found, rooms in
 * their declared order and the floor in rows.
 */
function findOutside(h) {
  const ai = h.wardenAI;
  const ground = h.map.wardenGround;
  for (let room = 0; room < h.map.rooms.length; room++) {
    const bounds = h.map.rooms[room];
    const target = ai._roomTarget(room);
    if (!target) continue;
    for (let x = bounds.min.x; x <= bounds.max.x; x += 1) {
      for (let z = bounds.min.z; z <= bounds.max.z; z += 1) {
        // Only near an edge can a spot outside be within earshot of the ring.
        if (Math.min(x - bounds.min.x, bounds.max.x - x, z - bounds.min.z, bounds.max.z - z) > EARSHOT) continue;
        const centre = { x, y: bounds.floorY, z };
        if (flat(centre, target) < RUN_RING + BAND + APART || !ringClear(h, room, centre, RUN_RING)) continue;
        for (let reach = RUN_RING + BAND + 0.2; reach <= EARSHOT - RUN_RING; reach += 0.3) {
          for (let k = 0; k < RING; k++) {
            const at = onRing(centre, (k / RING) * TAU, reach);
            if (ai._roomIndexAt(at) === room || (ground && !ground.has(at, W.stepHeight))
              || !h.map.collision.isClear({ x: at.x, y: at.y + STANDING.y + 0.05, z: at.z }, STANDING)) continue;
            const standsIn = ai._roomIndexAt(at);
            return {
              at, centre, radius: RUN_RING, sprint: true, room, target, name: bounds.id,
              from: `Warden ${reach.toFixed(1)}m off the ring's centre, in ${standsIn < 0 ? 'open ground' : h.map.rooms[standsIn].id}`,
            };
          }
        }
      }
    }
  }
  return null;
}

/** A fresh round on the scene: the Warden on its spot held in PATROL, the Shade on the ring, nothing remembered. */
function pose(h, scene) {
  const { shade, warden, wardenAI: ai } = h;
  h.input.clearAll();
  warden.reset({ position: scene.at, yaw: 0 });
  shade.reset({ position: onRing(scene.centre, 0, scene.radius), yaw: 0 });
  h.stepFrames(2);
  ai.reset();
  h.detection.noise.clear();
  return warden.position.clone();
}

/**
 * Turn the Shade to walk round the ring, counter-clockwise: along the
 * tangent, with a push back toward the ring when she drifts off it. It is
 * `look`, the call a mouse delta makes, and W held; nothing else moves her.
 */
function steer(shade, scene) {
  const rx = shade.position.x - scene.centre.x;
  const rz = shade.position.z - scene.centre.z;
  const range = Math.hypot(rx, rz) || scene.radius;
  const push = 1.5 * (scene.radius - range);
  const dx = -rz / range + (rx / range) * push;
  const dz = rx / range + (rz / range) * push;
  shade.look(angleDelta(shade.yaw, Math.atan2(-dx, -dz)), 0);
}

/**
 * One fixed step: the Warden put back on its spot facing away from her, the
 * Shade walking (or sprinting) the ring if `moving`, standing if not.
 */
function stepOnce(h, scene, held, moving) {
  const { shade, warden } = h;
  h.input.heldCodes.delete('KeyW');
  h.input.heldCodes.delete('ShiftLeft');
  if (moving) {
    steer(shade, scene);
    h.input.heldCodes.add('KeyW');
    if (scene.sprint) h.input.heldCodes.add('ShiftLeft');
  }
  warden.position.copy(held);
  warden.velocity.set(0, 0, 0);
  warden.yaw = Math.atan2(-(held.x - shade.position.x), -(held.z - shade.position.z));
  h.stepFrames(1);
}

/**
 * Every noise the Shade makes from now until `off()`, copied as it is
 * emitted. The field's own count also takes the Warden's footsteps, which a
 * Warden that has been sent somewhere makes even held on its spot; it is her
 * noise that is heard, so it is hers that is counted.
 */
function listen(h) {
  const events = [];
  const off = h.emitter.on('noise', (event) => {
    if (event.source === 'shade') events.push({ type: event.type, x: event.x, y: event.y, z: event.z, radius: event.radius });
  });
  return { events, off };
}

/**
 * Walk the ring until the AI is INVESTIGATE or the bound is up, reading the
 * room's attention either side of each footstep's hearing. The AI steps
 * before the noise field in a fixed step, so a footstep emitted on one step
 * is heard on the next: `before` is taken as it is emitted, `after` the step
 * it is heard.
 */
function walkUntilInvestigating(h, scene, held) {
  const { wardenAI: ai } = h;
  const { room } = scene;
  const keep = Math.exp(-dt / H.decayTau);
  const story = { steps: [], saw: false, otherRooms: 0, suspiciousAt: null, investigatedAt: null, noise: null };
  const heard = listen(h);
  let pending = null;
  let counted = 0;
  try {
    for (let i = 0; i < Math.round(BOUND / dt); i++) {
      stepOnce(h, scene, held, true);
      const t = (i + 1) * dt;
      if (ai.sees || ai.accumulator > 0) story.saw = true;
      if (ai.attention.some((level, index) => index !== room && level !== 0)) story.otherRooms++;
      if (ai.state === AI_STATE.SUSPICIOUS && story.suspiciousAt === null) story.suspiciousAt = t;

      if (pending) {
        const expected = Math.min(H.max, pending.before * keep + pending.amount);
        story.steps.push({ before: pending.before, after: ai.attention[room], expected });
        pending = null;
      }
      const footsteps = heard.events.filter((event) => event.type === 'footstep');
      if (footsteps.length > counted) {
        counted = footsteps.length;
        story.noise = footsteps[counted - 1];
        // From where the Warden is held, which is where the AI listens from;
        // the step has nudged the body a few centimetres since.
        const distance = Math.hypot(story.noise.x - held.x, story.noise.y - held.y, story.noise.z - held.z);
        pending = { before: ai.attention[room], amount: H.gain * (1 - distance / story.noise.radius) };
      }
      if (ai.state === AI_STATE.INVESTIGATE) {
        story.investigatedAt = t;
        break;
      }
    }
  } finally {
    heard.off();
    h.input.clearAll();
  }
  story.attention = ai.attention[room];
  story.lastKnown = ai.lastKnown ? { ...ai.lastKnown } : null;
  story.hearingRoom = ai.hearingRoom;
  return story;
}

/**
 * Let her take exactly one footstep, then stand still and watch for the time
 * the hold has left to run. Reports the states it was in and the level.
 */
function oneFootstep(h, scene, held) {
  const { wardenAI: ai } = h;
  const states = new Set();
  const heard = listen(h);
  let heardAt = null;
  try {
    const total = Math.round((BOUND + A.suspiciousHold) / dt);
    for (let i = 0; i < total; i++) {
      stepOnce(h, scene, held, heard.events.length === 0);
      states.add(ai.state);
      if (heard.events.length > 0 && heardAt === null) heardAt = i + 1;
      if (heardAt !== null && (i + 1 - heardAt) * dt >= A.suspiciousHold - HOLD_LEFT) break;
    }
  } finally {
    heard.off();
    h.input.clearAll();
  }
  return { footsteps: heard.events.length, states: [...states], state: ai.state, attention: ai.attention[scene.room], heard: heardAt !== null };
}

/**
 * Stand her still: keys up, and step until she has stopped, then two more so
 * the Warden has heard whatever her last footstep was. Any step she takes on
 * the way is hers; what is read is the level she leaves.
 */
function standStill(h, scene, held) {
  const { shade } = h;
  for (let i = 0; i < Math.round(2 / dt) && shade.speed >= 0.15; i++) stepOnce(h, scene, held, false);
  const stopped = shade.speed < 0.15;
  for (let i = 0; i < 2; i++) stepOnce(h, scene, held, false);
  return stopped;
}

/** Step on with nobody moving for `steps`; reports whether she made a sound. */
function silentFor(h, scene, held, steps) {
  const heard = listen(h);
  try {
    for (let i = 0; i < steps; i++) stepOnce(h, scene, held, false);
  } finally {
    heard.off();
  }
  return heard.events.length === 0;
}

/**
 * What a run of footsteps has to have done in either scene: each raised the
 * room by the curve and nothing else's, the Warden saw nothing, and it was
 * the attention that sent it and not the hold.
 */
function escalationProblems(label, scene, story) {
  const problems = [];
  const name = `${label} ${scene.name}`;
  if (story.saw) problems.push(`${label}: the Warden saw the Shade, so this is not a hearing test`);
  if (story.steps.length < 2) problems.push(`${label}: only ${story.steps.length} footstep(s) were heard before the bound, a rise needs two`);
  story.steps.forEach((step, index) => {
    if (step.after <= step.before) problems.push(`${label}: footstep ${index + 1} did not raise ${scene.name}'s attention (${step.before.toFixed(3)} -> ${step.after.toFixed(3)})`);
    else if (Math.abs(step.after - step.expected) > 0.002) {
      problems.push(`${label}: footstep ${index + 1} raised ${scene.name} to ${step.after.toFixed(3)}, the curve says ${step.expected.toFixed(3)}`);
    }
  });
  if (story.otherRooms > 0) problems.push(`${label}: another room's attention moved on ${story.otherRooms} step(s)`);
  if (story.hearingRoom !== scene.room) problems.push(`${label}: hearingRoom is ${story.hearingRoom}, want ${scene.room} (${name})`);
  if (story.investigatedAt === null) {
    problems.push(`${label}: ${story.steps.length} footsteps in ${scene.name} never sent the Warden (attention ${story.attention.toFixed(2)} of ${H.investigateAt} after ${BOUND}s)`);
  } else if (story.attention < H.investigateAt) {
    problems.push(`${label}: INVESTIGATE came at attention ${story.attention.toFixed(2)}, under the ${H.investigateAt} line: the hold sent it, not the memory`);
  } else if (!story.lastKnown) problems.push(`${label}: INVESTIGATE with no lastKnown`);
  return problems;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-warden-remembers-what-it-heard-room-by-room',
    spec: 'Section 7.2 / K2',
    name: 'Footsteps in a room raise that room\'s attention a little each and it fades; enough of them send the Warden to the sound if it is in the room and to the room\'s waypoint if it is not, one never does',
    run: (h) => {
      const problems = [];
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: false });
      h.menu.hide();
      h.input.clearAll();
      const ai = h.wardenAI;
      const inside = findInside(h);
      const outside = findOutside(h);
      if (!inside) problems.push('no spot of open floor in a room with a waypoint, with a clear ring two metres round it inside the room, was found on this map');
      if (!outside) problems.push('no clear ring inside a room with a waypoint, with a spot for the Warden outside that room within earshot of the whole ring, was found on this map');
      if (problems.length) {
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
        h.menu.hide();
        return { pass: false, detail: problems.join('; ') };
      }

      let near;
      let far;
      let single;
      let still = false;
      let silent = false;
      let left = 0;
      let after = 0;
      try {
        // In the room: walk round the Warden until the attention sends it,
        // then stand her still and let the level fade from where she left it.
        const held = pose(h, inside);
        near = walkUntilInvestigating(h, inside, held);
        still = standStill(h, inside, held);
        left = ai.attention[inside.room];
        silent = silentFor(h, inside, held, Math.round((H.decayTau * Math.LN2) / dt));
        after = ai.attention[inside.room];

        // A fresh round, and one footstep.
        single = oneFootstep(h, inside, pose(h, inside));

        // Out of the room: sprint round a ring in it, the Warden beside it.
        far = walkUntilInvestigating(h, outside, pose(h, outside));
      } finally {
        h.input.clearAll();
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
        h.menu.hide();
      }

      // Rises and escalates, in both scenes.
      problems.push(...escalationProblems('inside', inside, near), ...escalationProblems('outside', outside, far));

      // (e) From inside, to the sound.
      if (near.lastKnown && near.noise) {
        if (flat(near.lastKnown, near.noise) > SAME_PLACE) {
          problems.push(`inside: sent ${flat(near.lastKnown, near.noise).toFixed(2)}m from her last footstep, want within ${SAME_PLACE}m: the Warden is in ${inside.name} and can tell where in it`);
        }
        if (flat(near.lastKnown, inside.target) <= 0.5) problems.push(`inside: sent to ${inside.name}'s waypoint, the room, not the sound`);
      }

      // (b) From outside, to the room: its waypoint, and not where she was.
      const room = h.map.rooms[outside.room];
      const known = far.lastKnown;
      if (known) {
        if (flat(known, ai._roomTarget(outside.room)) > 0.01) {
          problems.push(`outside: sent to (${known.x.toFixed(1)}, ${known.z.toFixed(1)}), not ${outside.name}'s waypoint (${outside.target.x.toFixed(1)}, ${outside.target.z.toFixed(1)})`);
        }
        if (known.x < room.min.x || known.x > room.max.x || known.z < room.min.z || known.z > room.max.z) {
          problems.push(`outside: the place it was sent to is outside ${outside.name}`);
        }
        if (far.noise && flat(known, far.noise) <= 0.5) {
          problems.push(`outside: sent to within ${flat(known, far.noise).toFixed(2)}m of her last footstep: the point, not the room`);
        }
      }

      // One is not enough.
      if (!single.heard) problems.push('a single footstep was never heard');
      else {
        if (single.footsteps !== 1) problems.push(`the single-footstep run took ${single.footsteps} footsteps`);
        if (single.states.includes(AI_STATE.INVESTIGATE)) problems.push('one footstep sent the Warden to investigate');
        if (single.state !== AI_STATE.SUSPICIOUS) problems.push(`one footstep left the Warden ${single.state}, want suspicious`);
        if (!(single.attention > 0 && single.attention < H.investigateAt)) {
          problems.push(`one footstep left ${inside.name} at ${single.attention.toFixed(3)}, want above 0 and under ${H.investigateAt}`);
        }
      }

      // Decays.
      const ratio = left > 0 ? after / left : 0;
      if (!still) problems.push('she did not stop in two seconds');
      if (!silent) problems.push('something was heard while the attention was left to fade');
      if (!(left > 0)) problems.push('there was no attention to watch fade');
      else if (Math.abs(ratio - 0.5) > 0.025) {
        problems.push(`after ${(H.decayTau * Math.LN2).toFixed(1)}s the attention is ${(ratio * 100).toFixed(1)}% of the ${left.toFixed(2)} she left, want half`);
      }

      const two = (value) => value.toFixed(2);
      const at = (time) => (time === null ? 'never' : `${time.toFixed(2)}s`);
      const curve = (story) => story.steps.map((step) => two(step.after)).join('/');
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `inside ${inside.name} (${inside.from}): ${near.steps.length} walking footsteps ${curve(near)}, INVESTIGATE at ${at(near.investigatedAt)} (hold ${A.suspiciousHold}s), `
            + `sent ${flat(near.lastKnown, near.noise).toFixed(2)}m from her last step; outside (${outside.from}): sprinting ${curve(far)}, `
            + `INVESTIGATE at ${at(far.investigatedAt)}, sent to the waypoint, ${flat(known, far.noise).toFixed(1)}m from her last step; `
            + `one footstep left it suspicious at ${two(single.attention)}; faded to ${(ratio * 100).toFixed(1)}% in ${(H.decayTau * Math.LN2).toFixed(1)}s`
          : `${problems.join('; ')} [inside ${inside.name}: ${near.steps.map((step) => `${two(step.before)}->${two(step.after)}`).join(' ')}, investigate at ${at(near.investigatedAt)}; `
            + `outside: ${far.steps.map((step) => `${two(step.before)}->${two(step.after)}`).join(' ')}, investigate at ${at(far.investigatedAt)}]`,
      };
    },
  });
}
