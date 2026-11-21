/**
 * BLACKLINE - tests/cameraclip.js
 *
 * AUTO suite (Section 6.1, J1): the third-person boom and the world.
 *
 * The camera is a ball 0.22m across on the end of a 2.2m pole, and the check
 * asks the only question that matters to the picture: where is that ball,
 * after `_updateCamera`, against the collision boxes? It backs the Shade into a
 * tall face with the S key, at several yaws around the face and at the
 * steepest pitch the camera allows each way, because the boom swings with
 * pitch and the floor is the surface a horizontal ray never meets.
 *
 * What is asserted, per frame, on the rig's own world position - the one the
 * camera is parented to, shoulder and all:
 * - it is never inside a solid box;
 * - unless the boom was pulled all the way to the pivot (`d = 0`, the body's own
 *   centre, in clear air), its nearest surface is at least `collisionRadius`
 *   away.
 *
 * **The order of events, so the break below is read right.** `minDistance` is a
 * floor, and the rays cannot see past it: pressed to a thin fence the sweeps
 * ask for 0.55m with 0.16m of air left, and 0.16 is under a radius. The
 * rays (five of them, and a second pass from the shoulder) decide only which
 * distance the box test STARTS from; `boomClear`, which tests the camera's own
 * volume at the real rig position and steps in until it is clear, is what
 * guarantees the air, wherever the surface is - behind the camera or beside it.
 *
 * **The break to make** is `boomClear` returning `desired` unchanged (its last
 * line, `return found ? d : 0;` becoming `return desired;`): the pull-in is gone
 * and the fence frame goes red on the clearance clause. Cutting the sweep back
 * to the centre ray is the old break and now only moves a reading.
 *
 * **Why the offset-ray count is a reading and not an assertion.** An earlier
 * version of this check failed when no frame was set by an offset ray. That was
 * a self-test of the sweep, not something a player can see, and with `boomClear`
 * doing the work it would have gone red for a one-ray boom that is just as
 * clear of the world - a clause that asserts the implementation and blocks the
 * simplification. It is removed, and nothing is loosened by it: the floor the
 * check now stands on, a radius of real air on every frame, is strictly harder
 * than what the offset clause demanded. The counts of frames an offset ray won,
 * and the shoulder pass beat the axis pass, lead the detail so a later cut to
 * one ray has the numbers in hand.
 *
 * **What it tests (J12).** It used to take `findTallFace`'s first face, and on
 * both maps that is the shared perimeter `site-fence` (declared at the same
 * coordinates), so the plant and the yard read identically: one structure driven
 * twice. It now drives `FACES` faces per map from `findTallFaces`: the fence,
 * which is the geometry J1's numbers were measured on, then others spread
 * through the remaining tags in sorted order, one box per tag, so they are
 * different pieces of the world and the two maps' details differ. Every face gets
 * every clause at the same thresholds; no floor assumes another face behaves like
 * the fence. Poses with a pitch are driven head-on only: the five rays are the sphere's
 * four compass points, and an oblique wall at an oblique pitch lies between two
 * of them.
 *
 * **Along the wall (J10).** The same face, run beside instead of into: the Shade
 * walks parallel to it with the wall on the shoulder side and then the other,
 * at lateral distances from inside her own body (0.15m, which the physics
 * pushes out to 0.34) to past the shoulder's reach (0.60m), then presses in,
 * then strafes off so the boom eases out, then stands. The second sweep's origin
 * is `side * d / back` (up to 0.45m) off the axis, so inside 0.45m it is inside
 * the fence, where `raycast` returns nothing. Three things are asserted per frame:
 * the camera is not inside a box and its own volume is clear (`isClear` at the rig
 * position, the terminal test), and the cast origin the rig took - read from
 * `_boomProbe.originAt` - is clear too, or is the pivot. The last is the one the
 * **break** below turns red: the box test cannot catch a sweep that cannot see.
 * The pose is proved driven, independent of the fix: the origin the rig *asked*
 * for must have been inside the wall on some frames, or the clause fails.
 *
 * **The break to make for it** is `boomOrigin` taking the first origin
 * unchecked (`if (collision.isClear(CAMERA_AT, CAMERA_HALF)) return s * sign;`
 * becoming `if (true) return s * sign;`, agentvisual.js).
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { BOOM_CASTS_PER_FRAME } from '../entities/agentvisual.js';
import { findTallFaces } from './scuff.js';

const CAM = CONFIG.shade.camera;
const DT = CONFIG.time.fixedDt;
/** Metres of slack on a clearance: float noise and the ease, not the 0.057 the minDistance floor loses at the fence. */
const EPS = 0.005;
/** Fixed steps held on S per pose: 2m of walk at walk speed, and the push against the face after. */
const STEPS = 60;
/** Faces driven per map: bounded so the frames stay near what one fence cost. The walk to the face is 2m at 3.5m/s, 34 steps, so 60 still presses in. */
const FACES = 3;
const WORLD = new THREE.Vector3();
/** The camera's volume less a hair: the rig's own test is strict, and a world matrix is not bit-for-bit the position it was set from. */
const HALF = { x: CAM.collisionRadius - 1e-4, y: CAM.collisionRadius - 1e-4, z: CAM.collisionRadius - 1e-4 };
const ORIGIN = { x: 0, y: 0, z: 0 };
/** Lateral distances from the fence to the body centre, metres: inside the body, at it, inside the reach, past it. */
const LATERALS = [0.15, 0.25, 0.34, 0.40, 0.45, 0.52, 0.60];
/** Legs of the run along the wall: parallel, pressed in, strafing off (the boom eases out), standing. */
const LEGS = [{ steps: 20, keys: [] }, { steps: 12, keys: ['in'] }, { steps: 20, keys: ['away'] }, { steps: 12, keys: ['stop'] }];

/**
 * Signed distance from a point to a box, metres: positive outside (the gap to
 * the nearest face, edge or corner), negative inside (how far in from the
 * nearest face).
 */
export function pointToBox(p, box) {
  const dx = Math.max(box.min.x - p.x, 0, p.x - box.max.x);
  const dy = Math.max(box.min.y - p.y, 0, p.y - box.max.y);
  const dz = Math.max(box.min.z - p.z, 0, p.z - box.max.z);
  if (dx > 0 || dy > 0 || dz > 0) return Math.hypot(dx, dy, dz);
  return -Math.min(p.x - box.min.x, box.max.x - p.x, p.y - box.min.y, box.max.y - p.y, p.z - box.min.z, box.max.z - p.z);
}

/**
 * The faces to drive: the `site-fence` first when the map has one, then the
 * rest spread evenly through the other tags in sorted order, one box per tag.
 * Spread rather than the first few, so a map is not given only its neighbours
 * in the alphabet; deterministic because `findTallFaces` is.
 */
export function pickFaces(all, count) {
  const byTag = new Map();
  for (const face of all) if (!byTag.has(face.box.tag || '')) byTag.set(face.box.tag || '', face);
  const fence = byTag.get('site-fence');
  byTag.delete('site-fence');
  const rest = [...byTag.values()];
  const picked = fence ? [fence] : [];
  const want = count - picked.length;
  for (let i = 0; i < want && i < rest.length; i++) picked.push(rest[Math.floor(i * rest.length / want)]);
  return picked;
}

/** The nearest solid box to a point, and the signed distance to it. */
function nearest(boxes, p) {
  let best = { box: null, gap: Infinity };
  for (const box of boxes) {
    if (!box.solid) continue;
    const gap = pointToBox(p, box);
    if (gap < best.gap) best = { box, gap };
  }
  return best;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-third-person-boom-never-puts-the-camera-inside-the-world',
    spec: 'Section 6.1 / J1',
    name: 'Backed into a wall at every yaw and pitch, the camera never enters a box, and clear of the boom floor it stays a camera radius off every surface',
    run: (h) => {
      const problems = [];
      h.initMatch({ mode: 'competitive', role: 'shade', ai: false, objective: false });
      h.menu.hide();
      h.input.clearAll();
      const shade = h.shade;
      const boxes = h.map.collision.boxes;
      try {
        const walls = pickFaces(findTallFaces(h, 2.5), FACES);
        if (walls.length === 0) return { pass: false, detail: 'no ground-level face at least 2.5m tall with a clear approach was found' };
        // Several distinct pieces of geometry, or this is one fence driven twice again.
        if (new Set(walls.map((w) => w.box.tag || '')).size < 2) problems.push(`only ${walls.length} face${walls.length === 1 ? '' : 's'} driven (${walls.map((w) => w.box.tag || 'untagged').join(', ')}), want at least two different tags`);
        const total = { frames: 0, offsetWon: 0, shoulderWon: 0, worst: Infinity, pulledIn: 0, atPivot: 0, mostTests: 0, along: 0, alongAsked: 0, alongMoved: 0, alongBoxOnly: 0, alongBlind: 0, alongEased: 0, alongAtPivot: 0, alongWorst: Infinity };
        const named = [];
        for (const wall of walls) {
          const tag = wall.box.tag || 'untagged';
          // Face the other way: the boom (behind the Shade) then points at the wall.
          const away = wall.yaw + Math.PI;
          const nx = Math.sin(wall.yaw);
          const nz = Math.cos(wall.yaw);
          const ground = CONFIG.map.groundY;

          const poses = [];
          for (const turn of [0, 0.5, -0.5, 1.0, -1.0]) poses.push({ turn, pitch: 0 });
          poses.push({ turn: 0, pitch: CAM.pitchMax }, { turn: 0, pitch: CAM.pitchMin }, { turn: 0, pitch: CAM.pitchMax * 0.5 });

          let frames = 0;
          let offsetWon = 0;
          let shoulderWon = 0;
          let worst = Infinity;
          let pulledIn = 0;
          let atPivot = 0;
          let mostTests = 0;
          for (const pose of poses) {
            // 2m off the face: the probe stood 0.8 out, so 1.2 further.
            shade.reset({ position: { x: wall.x + nx * 1.2, y: ground, z: wall.z + nz * 1.2 }, yaw: away + pose.turn });
            h.stepFrames(2);
            shade.pitch = pose.pitch;
            h.input.clearAll();
            h.input.heldCodes.add('KeyS');
            const label = `yaw ${(away + pose.turn).toFixed(2)} pitch ${pose.pitch.toFixed(2)}`;
            for (let i = 0; i < STEPS; i++) {
              h.stepFrames(1);
              h.input.clearEdges();
              shade.updateVisual(DT);
              shade.cameraRig.updateWorldMatrix(true, false);
              shade.cameraRig.getWorldPosition(WORLD);
              const probe = shade._boomProbe;
              frames++;
              const ray = probe.pulledBy === 2 ? probe.ray2 : probe.ray1;
              if (probe.pulledBy && ray > 0) offsetWon++;
              if (probe.pulledBy === 2) shoulderWon++;
              const { box, gap } = nearest(boxes, WORLD);
              const atZero = shade._cameraDistance <= 0;
              if (atZero) atPivot++;
              if (probe.clearedTo < probe.sweptTo - 1e-9) pulledIn++;
              if (probe.clearTests > mostTests) mostTests = probe.clearTests;
              if (gap < worst) worst = gap;
              const where = `${label}, frame ${i}, at (${WORLD.x.toFixed(2)}, ${WORLD.y.toFixed(2)}, ${WORLD.z.toFixed(2)}), boom ${shade._cameraDistance.toFixed(2)}m`;
              if (gap <= 0) {
                problems.push(`the camera was inside ${box.tag || 'a box'} by ${(-gap).toFixed(3)}m: ${where}`);
                break;
              }
              if (!atZero && gap < CAM.collisionRadius - EPS) {
                problems.push(`the camera sat ${gap.toFixed(3)}m off ${box.tag || 'a box'}, want ${CAM.collisionRadius}: ${where}`);
                break;
              }
            }
          }
          // -- Along the wall, wall on the right (the shoulder side) and on the left.
          const along = { frames: 0, asked: 0, moved: 0, boxOnly: 0, blind: 0, eased: 0, atPivot: 0, worst: Infinity };
          const collision = h.map.collision;
          for (const side of [1, -1]) {
            // Yaw puts the right vector at the wall (side 1) or away from it; `in` is the key that strafes toward it.
            const yaw = wall.yaw + side * Math.PI / 2;
            const keyIn = side === 1 ? 'KeyD' : 'KeyA';
            const keyAway = side === 1 ? 'KeyA' : 'KeyD';
            for (const lateral of LATERALS) {
              shade.reset({ position: { x: wall.x + nx * (lateral - 0.8), y: ground, z: wall.z + nz * (lateral - 0.8) }, yaw });
              h.stepFrames(2);
              h.input.clearAll();
              const label = `wall on the ${side === 1 ? 'right' : 'left'} at ${lateral.toFixed(2)}m`;
              const movedBefore = shade._boomProbe ? shade._boomProbe.originMoved : 0;
              let bad = false;
              let frame = 0;
              for (const leg of LEGS) {
                h.input.clearAll();
                if (!leg.keys.includes('stop')) h.input.heldCodes.add('KeyW');
                if (leg.keys.includes('in')) h.input.heldCodes.add(keyIn);
                if (leg.keys.includes('away')) h.input.heldCodes.add(keyAway);
                for (let i = 0; i < leg.steps && !bad; i++, frame++) {
                  h.stepFrames(1);
                  h.input.clearEdges();
                  shade.updateVisual(DT);
                  shade.cameraRig.updateWorldMatrix(true, false);
                  shade.cameraRig.getWorldPosition(WORLD);
                  const probe = shade._boomProbe;
                  along.frames++;
                  const rightX = Math.cos(shade.yaw);
                  const rightZ = -Math.sin(shade.yaw);
                  const piv = probe.pivot;
                  ORIGIN.x = piv.x + rightX * probe.originAsked;
                  ORIGIN.y = piv.y;
                  ORIGIN.z = piv.z + rightZ * probe.originAsked;
                  if (!collision.isClear(ORIGIN, HALF)) along.asked++;
                  // The pull-in the rays did not ask for: the box test alone, or the closing test at the rig's own shoulder.
                  if (probe.clearedTo < probe.sweptTo - 1e-9 || probe.eased) {
                    along.boxOnly++;
                    if (!probe.pulledBy) along.blind++;
                  }
                  if (probe.eased) along.eased++;
                  const { box, gap } = nearest(boxes, WORLD);
                  if (gap < along.worst) along.worst = gap;
                  const atZero = shade._cameraDistance <= 0;
                  if (atZero) along.atPivot++;
                  const where = `${label}, frame ${frame}, camera (${WORLD.x.toFixed(2)}, ${WORLD.y.toFixed(2)}, ${WORLD.z.toFixed(2)}), boom ${shade._cameraDistance.toFixed(2)}m`;
                  if (gap <= 0) {
                    problems.push(`the camera was inside ${box.tag || 'a box'} by ${(-gap).toFixed(3)}m: ${where}`);
                    bad = true;
                  } else if (!atZero && !collision.isClear(WORLD, HALF)) {
                    problems.push(`the camera's volume overlapped ${box.tag || 'a box'} (${gap.toFixed(3)}m off), want clear: ${where}`);
                    bad = true;
                  }
                  if (probe.originAt !== 0) {
                    ORIGIN.x = piv.x + rightX * probe.originAt;
                    ORIGIN.z = piv.z + rightZ * probe.originAt;
                    if (!collision.isClear(ORIGIN, HALF)) {
                      problems.push(`the second sweep was cast from inside the world, ${Math.abs(probe.originAt).toFixed(2)}m off the axis: ${where}`);
                      bad = true;
                    }
                  }
                }
              }
              along.moved += shade._boomProbe.originMoved - movedBefore;
            }
          }
          // A clause that never reached the pose proves nothing: some frames must have asked from inside the fence.
          if (along.asked === 0) problems.push(`no frame along ${tag} asked for a shoulder origin inside it: the pose was never reached`);

          named.push(`${tag} ${worst.toFixed(3)}m/${along.worst.toFixed(3)}m`);
          total.frames += frames; total.offsetWon += offsetWon; total.shoulderWon += shoulderWon; total.pulledIn += pulledIn;
          total.atPivot += atPivot; total.mostTests = Math.max(total.mostTests, mostTests);
          total.worst = Math.min(total.worst, worst);
          total.along += along.frames; total.alongAsked += along.asked; total.alongMoved += along.moved;
          total.alongBoxOnly += along.boxOnly; total.alongBlind += along.blind; total.alongEased += along.eased;
          total.alongAtPivot += along.atPivot; total.alongWorst = Math.min(total.alongWorst, along.worst);
        }

        // Readings first: the suite cuts a detail at 400 characters.
        const faces = `${walls.length} faces, worst head-on/along: ${named.join(', ')}`;
        const lead = `offset ${total.offsetWon}, shoulder ${total.shoulderWon}, worst ${total.worst.toFixed(3)}m, d0 ${total.atPivot}`;
        const beside = `along ${total.along}f: origin inside ${total.alongAsked}, moved back ${total.alongMoved}, box test alone ${total.alongBoxOnly} (${total.alongBlind} rays blind, ${total.alongEased} closing), worst ${total.alongWorst.toFixed(3)}m, d0 ${total.alongAtPivot}`;
        return {
          pass: problems.length === 0,
          detail: problems.length === 0
            ? `${faces}; ${lead}; ${beside}; ${total.frames}f ${poses.length}p, ${BOOM_CASTS_PER_FRAME} casts + up to ${total.mostTests} tests, ${total.pulledIn} pulled in by the box test`
            : `${faces}; ${lead}; ${problems.length} bad, first: ${problems[0]}`,
        };
      } finally {
        h.input.clearAll();
        h.initMatch({ mode: 'competitive', role: 'shade', ai: false, objective: false });
      }
    },
  });
}
