/**
 * BLACKLINE - tests/scuff.js
 *
 * AUTO suite: the bump-and-scuff (B2; Section 6.1, amended: a failed climb
 * is "a physical tell plus audio, never silent").
 *
 * Two silent cases existed. A press of Space that carried the hands onto a
 * face too tall for the reach did nothing at all - the body slid down the
 * wall as if the key had not been pressed. And since D21, a hold from a hang
 * whose pull-up is blocked did nothing either. Both now bump, pose and sound,
 * and this file drives each the way a player does: through the input codes.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { SHADE_STATE } from '../entities/agent.js';
import { AI_STATE } from '../systems/ai.js';
import { driveAtLedge, findGroundLedge } from './movement.js';

const S = CONFIG.shade;

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-climb-beyond-reach-bumps-poses-and-sounds',
    spec: 'Section 6.1, amended (B2); Section 14',
    name: 'A press of Space into a face beyond reach gives a bump back, the hands-up pose and a rendered slap; a blocked pull-up from a hang gives the pose and the slap',
    run: async (h) => {
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
      const shade = h.shade;
      const problems = [];
      const fullReach = S.reach.standing + S.reach.jumpBonus;

      // Every scuff the controller reports, as the audio system hears it.
      const heard = [];
      const off = h.emitter.on('shade:scuff', (event) => heard.push({ ...event }));

      try {
        // -- A face at least reach + 0.3 tall, with a spot to stand in front of it.
        const wall = findTallFace(h, fullReach + 0.3);
        if (!wall) {
          problems.push(`no ground-level face at least ${(fullReach + 0.3).toFixed(1)}m tall with a clear approach was found`);
        } else {
          const tag = wall.box.tag || 'the wall';
          const rise = wall.box.max.y - CONFIG.map.groundY;

          // A tap of Space heading into it: exactly one tell, and no climb.
          const before = shade.scuffs;
          const run = driveAtLedge(h, wall, { airborne: false, pressAt: 5, hold: false, steps: 40 });
          if (run.onTop || run.sawClimb) problems.push(`the press climbed ${tag} (${rise.toFixed(1)}m; states ${run.states})`);
          if (shade.scuffs - before !== 1) problems.push(`one press into ${tag} scuffed ${shade.scuffs - before} times, want exactly 1`);
          const event = heard[heard.length - 1];
          if (!event) problems.push('no shade:scuff event reached the emitter');
          else {
            if (event.rise < fullReach + 0.3 - 0.6) problems.push(`the scuff reports a rise of ${event.rise.toFixed(2)}m against a ${rise.toFixed(1)}m face`);
            if (event.hanging) problems.push('a scuff from the air reported itself as hanging');
          }

          // The physical tell: the body left the face and the pose was held.
          // Read on the step of the scuff itself, driving frame by frame.
          const felt = driveUntilScuff(h, wall);
          if (!felt.scuffed) problems.push(`driving frame by frame, the press into ${tag} never scuffed`);
          else {
            if (felt.into >= 0) problems.push(`on the scuff step the body was still moving into ${tag} (${felt.into.toFixed(2)} m/s along the face normal)`);
            if (felt.rising) problems.push('on the scuff step the body was still rising');
            if (!(felt.poseTimer > 0)) problems.push('the hands-up pose timer was not set on the scuff step');
            if (felt.poseTimer > 0) {
              // The pose is drawn: the arms are up while the timer runs.
              shade.updateVisual(1 / 60);
              const arm = shade.mesh.userData.parts.armL.rotation.x;
              if (!(arm < -1.5)) problems.push(`the left arm reads ${arm.toFixed(2)} rad during the pose, want thrown up (below -1.5)`);
            }
          }

          // A walk-off into the same face, nothing pressed, is not a climb
          // attempt (D17) and gets no tell.
          const silentBefore = shade.scuffs;
          driveAtLedge(h, wall, { airborne: true, pressAt: null, hold: false, steps: 40 });
          if (shade.scuffs !== silentBefore) problems.push(`falling into ${tag} with nothing pressed scuffed ${shade.scuffs - silentBefore} times`);
        }

        // -- From a hang, a blocked pull-up. No lip on this map has a lid over
        // it yet, so one is staged: a slab of real collision 0.6m above the
        // lip - clear of the hanging body, whose top sits under the lip since
        // B8, no room for the crouched one a pull-up needs - and taken away
        // afterwards to prove the lid was the block.
        const hangMin = S.standHeight * S.hangMinHeightRatio;
        const spot = findGroundLedge(h, hangMin, fullReach, { hangable: true });
        if (!spot) {
          problems.push('no hangable ground-level ledge was found');
        } else {
          const tag = spot.box.tag || 'the ledge';
          const top = spot.box.max.y;
          const hang = driveAtLedge(h, spot, { airborne: false, pressAt: 5, hold: false, steps: 90 });
          if (shade.state !== SHADE_STATE.HANG) {
            problems.push(`could not get into a hang at ${tag} (state ${shade.state}, states ${hang.states})`);
          } else {
            const collision = h.map.collision;
            const grabbed = shade._hangLedge;
            const lid = collision.addBox(
              { x: grabbed.hitX - 2, y: top + 0.6, z: grabbed.hitZ - 2 },
              { x: grabbed.hitX + 2, y: top + 0.9, z: grabbed.hitZ + 2 },
              { tag: 'b2-staged-lid', blocksSight: false }
            );
            collision.build();
            const hangScuffs = shade.scuffs;
            const heardBefore = heard.length;
            try {
              h.input.clearAll();
              h.stepFrames(15); // past the settle grace
              pressSpace(h);
              if (shade.state !== SHADE_STATE.HANG) problems.push(`a blocked pull-up left the hang (state ${shade.state})`);
              if (shade.scuffs - hangScuffs !== 1) problems.push(`a blocked pull-up scuffed ${shade.scuffs - hangScuffs} times, want 1`);
              const event = heard[heard.length - 1];
              if (heard.length > heardBefore && !event.hanging) problems.push('the hang scuff did not report itself as hanging');
              if (!(shade._scuffTimer > 0)) problems.push('the hang scuff set no pose');
              if (shade.feetY > top - 0.12) problems.push('a blocked pull-up went over anyway');
              // Holding the key does not hammer the lip.
              h.input.heldCodes.add('Space');
              h.stepFrames(30);
              h.input.heldCodes.delete('Space');
              if (shade.scuffs - hangScuffs !== 1) problems.push(`holding Space through a blocked pull-up scuffed ${shade.scuffs - hangScuffs} times in half a second`);
            } finally {
              collision.boxes.splice(collision.boxes.indexOf(lid), 1);
              collision.build();
            }
            // With the lid gone the identical press pulls up, so the lid was
            // the block and nothing else.
            pressSpace(h);
            h.stepFrames(60);
            if (shade.feetY < top - 0.12) problems.push(`with the lid gone, Space from the hang did not pull up onto ${tag} (feet ${shade.feetY.toFixed(2)}, state ${shade.state})`);
          }
        }

        // -- The sound, rendered to samples rather than counted as a voice.
        const audio = h.audio;
        if (!audio.unlock()) problems.push('no AudioContext available');
        else if (typeof OfflineAudioContext === 'undefined') problems.push('no OfflineAudioContext in this browser');
        else {
          const buffer = await audio.renderOffline('scuff', 0.4);
          if (!buffer) problems.push('the scuff rendered nothing');
          else {
            const data = buffer.getChannelData(0);
            let peak = 0;
            let last = 0;
            for (let i = 0; i < data.length; i++) {
              const v = Math.abs(data[i]);
              if (v > peak) peak = v;
              if (v > 0.002) last = i;
            }
            const audibleFor = last / buffer.sampleRate;
            if (peak < 0.001) problems.push(`the scuff rendered silence (peak ${peak.toExponential(1)})`);
            if (peak > 1.0) problems.push(`the scuff clips at ${peak.toFixed(2)}`);
            if (audibleFor > 0.3) problems.push(`the scuff is still sounding at ${audibleFor.toFixed(2)}s; a slap is short`);
            if (audibleFor > 0 && audibleFor < 0.02) problems.push(`the scuff is audible for only ${audibleFor.toFixed(3)}s`);
            if (problems.length === 0) {
              return {
                pass: true,
                detail: `a press into a ${(fullReach + 0.3).toFixed(1)}m+ face scuffed once: pushed off the face, not rising, arms up; `
                  + `a walk-off into it stayed silent; a blocked pull-up from a hang scuffed once on the press and not while held, `
                  + `and pulled up once the block was gone; the slap renders at peak ${peak.toFixed(2)} for ${audibleFor.toFixed(2)}s`,
              };
            }
          }
        }
      } finally {
        off();
        h.input.clearAll();
      }

      return { pass: false, detail: problems.join('; ') };
    },
  });

  debugTools.registerAutoTest({
    id: 'a-scuff-is-a-noise-the-warden-in-the-room-hears',
    spec: 'Section 7.2; D23 (B2b)',
    name: 'A failed climb puts a footstep-sized noise on the wall: a Warden within it turns to the wall, one beyond it does not',
    run: (h) => {
      const problems = [];
      const R = CONFIG.noise.radii;
      const fullReach = S.reach.standing + S.reach.jumpBonus;
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: false });
      const shade = h.shade;
      const warden = h.warden;
      const ai = h.wardenAI;
      const noise = h.detection.noise;

      const wall = findTallFace(h, fullReach + 0.3);
      if (!wall) return { pass: false, detail: `no ground-level face at least ${(fullReach + 0.3).toFixed(1)}m tall with a clear approach was found` };
      const tag = wall.box.tag || 'the wall';

      // Stand the Warden `distance` along the wall from where the hands will
      // land, on the floor, facing away from the Shade so nothing here is a
      // sighting. The scuff sits at the hands, up the wall, so the floor
      // distance that counts is the radius less that height.
      const handsY = CONFIG.map.groundY + Math.min(wall.box.max.y - CONFIG.map.groundY, fullReach);
      const hitX = wall.x - Math.sin(wall.yaw) * 0.8;
      const hitZ = wall.z - Math.cos(wall.yaw) * 0.8;
      const alongX = Math.cos(wall.yaw);
      const alongZ = -Math.sin(wall.yaw);
      const place = (distance) => {
        ai.reset();
        noise.clear();
        warden.reset(h.map.wardenSpawns[0]);
        warden.position.set(hitX + alongX * distance, CONFIG.warden.standHeight / 2 + 0.05, hitZ + alongZ * distance);
        warden.yaw = Math.atan2(-alongX, -alongZ);
        warden.velocity.set(0, 0, 0);
      };

      /** Drive the press and read, on the scuff step, what the Warden heard and knew. */
      const scuffAndRead = () => {
        const { x, z, yaw } = wall;
        shade.reset({ position: { x, y: CONFIG.map.groundY, z }, yaw });
        h.stepFrames(2);
        h.input.clearAll();
        h.input.heldCodes.add('KeyW');
        const start = shade.scuffs;
        let read = null;
        for (let i = 0; i < 40 && !read; i++) {
          if (i === 5) {
            h.input.heldCodes.add('Space');
            h.input.pressedCodes.add('Space');
          }
          h.stepFrames(1);
          h.input.clearEdges();
          h.input.heldCodes.delete('Space');
          if (shade.scuffs > start) {
            // The field has the event on the scuff step itself; the AI steps
            // before Detection in the fixed step, so it hears it on the next.
            const heard = noise.heard(warden.position);
            const at = shade.scuffedAt ? { ...shade.scuffedAt } : null;
            h.stepFrames(1);
            read = {
              at,
              heard: heard ? { type: heard.type, source: heard.source, radius: heard.radius } : null,
              lastKnown: ai.lastKnown ? { ...ai.lastKnown } : null,
              state: ai.state,
              sees: ai.sees,
            };
          }
        }
        h.input.clearAll();
        return read;
      };

      const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      try {
        // Within: a couple of metres along the wall.
        place(2.0);
        const near = scuffAndRead();
        if (!near) problems.push(`the press into ${tag} never scuffed`);
        else {
          if (!near.at) problems.push('the scuff step did not record scuffedAt');
          else if (Math.abs(near.at.y - handsY) > 0.6) problems.push(`the scuff sits at y=${near.at.y.toFixed(2)}, want the hands at about ${handsY.toFixed(2)}`);
          if (near.sees) problems.push('the Warden could see the Shade, so this read nothing about hearing');
          if (!near.heard) problems.push(`a Warden 2.0m along the wall heard nothing on the scuff step`);
          else {
            if (near.heard.type !== 'scuff') problems.push(`the Warden heard a ${near.heard.type}, not the scuff`);
            if (near.heard.radius !== R.shadeScuff) problems.push(`the scuff carried ${near.heard.radius}m, config says ${R.shadeScuff}`);
          }
          if (!near.lastKnown) problems.push('the Warden within earshot has no lastKnown after the scuff');
          else if (near.at && dist(near.lastKnown, near.at) > 0.3) {
            problems.push(`the Warden's lastKnown is ${dist(near.lastKnown, near.at).toFixed(2)}m from the hands on the wall`);
          }
          if (near.state !== AI_STATE.SUSPICIOUS) problems.push(`the Warden within earshot is ${near.state}, not suspicious`);
        }

        // Beyond: twice the radius along the wall.
        place(R.shadeScuff * 2 + 1);
        const far = scuffAndRead();
        if (!far) problems.push(`the second press into ${tag} never scuffed`);
        else {
          if (far.heard && far.heard.type === 'scuff') problems.push(`a Warden ${(R.shadeScuff * 2 + 1).toFixed(0)}m away heard the scuff (${far.heard.radius}m)`);
          if (far.lastKnown && far.at && dist(far.lastKnown, far.at) < 1.0) problems.push('a Warden beyond earshot still turned to the wall');
        }
      } finally {
        h.input.clearAll();
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
        h.menu.hide();
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `a scuff on ${tag} is a ${R.shadeScuff}m noise at the hands: a Warden 2.0m along the wall, facing away, heard it on the `
            + `scuff step, took it as last-known and went suspicious; one ${(R.shadeScuff * 2 + 1).toFixed(0)}m away heard nothing`
          : problems.join('; '),
      };
    },
  });
}

/** Press Space for one step, the way a tap arrives: held and pressed together, then released. */
function pressSpace(h) {
  h.input.heldCodes.add('Space');
  h.input.pressedCodes.add('Space');
  h.stepFrames(1);
  h.input.clearEdges();
  h.input.heldCodes.delete('Space');
}

/**
 * Stand in front of the face, hold forward, press Space, and step one frame
 * at a time until the controller scuffs. Reads the tell on that very step.
 */
function driveUntilScuff(h, spot) {
  const shade = h.shade;
  const { x, z, yaw } = spot;
  shade.reset({ position: { x, y: CONFIG.map.groundY, z }, yaw });
  h.stepFrames(2);
  h.input.clearAll();
  h.input.heldCodes.add('KeyW');
  const dirX = -Math.sin(yaw);
  const dirZ = -Math.cos(yaw);
  const start = shade.scuffs;
  let result = { scuffed: false };
  for (let i = 0; i < 40; i++) {
    if (i === 5) {
      h.input.heldCodes.add('Space');
      h.input.pressedCodes.add('Space');
    }
    h.stepFrames(1);
    h.input.clearEdges();
    h.input.heldCodes.delete('Space');
    if (shade.scuffs > start) {
      result = {
        scuffed: true,
        into: shade.velocity.x * dirX + shade.velocity.z * dirZ,
        rising: shade.velocity.y > 0,
        poseTimer: shade._scuffTimer,
      };
      break;
    }
  }
  h.input.clearAll();
  return result;
}

/**
 * A solid box standing on the ground at least `minRise` tall, with a spot
 * 0.8m off one of its faces where the Shade stands and its own probe reports
 * that face - and no ledge - ahead. The probe is the arbiter, as in
 * `findGroundLedge()`.
 */
export function findTallFace(h, minRise) {
  const ground = CONFIG.map.groundY;
  const shade = h.shade;
  for (const box of h.map.collision.boxes) {
    if (!box.solid) continue;
    if (Math.abs(box.min.y - ground) > 0.05) continue;
    if (box.max.y - ground < minRise) continue;
    const cx = (box.min.x + box.max.x) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    for (const [nx, nz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const x = nx === 0 ? cx : (nx < 0 ? box.min.x : box.max.x) + nx * 0.8;
      const z = nz === 0 ? cz : (nz < 0 ? box.min.z : box.max.z) + nz * 0.8;
      const yaw = Math.atan2(nx, nz);
      shade.reset({ position: { x, y: ground, z }, yaw });
      h.stepFrames(3);
      if (!shade.grounded || Math.abs(shade.feetY - ground) > 0.05) continue;
      shade.grounded = false;
      const ledge = shade._probeLedge(S.mantleReach);
      const face = shade._faceAhead;
      shade.grounded = true;
      if (ledge || !face || face.box !== box) continue;
      return { box, x, z, yaw };
    }
  }
  return null;
}
