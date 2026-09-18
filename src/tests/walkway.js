/**
 * BLACKLINE - tests/walkway.js
 *
 * AUTO suite: D3, the Warden's walkway on the yard, and the one rule it
 * added to combat. Two checks name the yard's geometry (`WALKWAY`,
 * maps/yard.js) and are scoped to it; the third names none and runs on
 * every map:
 *
 *   - The walkway is glazed and shoots only through its apertures (D11):
 *     from a Warden's eye behind each slot and from the middle of the run,
 *     a ray to each of 40 sample points around the yard either stops at
 *     the walkway's own glass, parapet or roof, or leaves through a
 *     declared opening - a slot or the door - and nowhere else; each slot
 *     passes a ray to the site it serves; the glass a shot stops at is
 *     nothing to a line of sight. Then the real gun: the human Warden's
 *     round through the west slot lands at site A, and the same round from
 *     behind the pane beside it lands on the pane. And the real knife: a
 *     Shade at the slot cuts the Warden inside, a Shade at the pane does not.
 *
 *   - A knife stops at a wall a body cannot pass (D3, every map): in a
 *     clear lane a swing at arm's length lands; with a staged pane between
 *     the two it does not, glass or not, and the line of sight through the
 *     glass is still open; with the pane gone it lands again.
 *
 *   - Nothing climbs to the walkway, and the Warden walks up (D12): its
 *     floor is above `standing + jumpBonus` from every top within 4m; the
 *     rule names no way onto any piece of it; a perch staged in reach of
 *     the floor still gets nothing past the parapet, and one staged in
 *     reach of the roof does, so the rule is reading the geometry and not
 *     a flag; the Warden's ground includes the run; and the human Warden,
 *     holding W from the foot of the stair, arrives on the floor and walks
 *     it end to end.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { WALKWAY } from '../maps/yard.js';
import { clearLane, alongLane } from './lanes.js';
import { press } from './feel.js';

const S = CONFIG.shade;
const W = CONFIG.warden;
const K = CONFIG.combat.knife;
const G = CONFIG.map.groundY;
const DT = CONFIG.time.fixedDt;
const FULL_REACH = S.reach.standing + S.reach.jumpBonus;
/** D12's radius: every top this close to the walkway's footprint has to be out of reach of its floor. */
const NEAR = 4.0;
/** Where a body's torso is, the height a knife and a shot are traded at. */
const torso = (feetY, height) => feetY + height * CONFIG.detection.torsoHeightRatio;
const WARDEN_EYE = W.standHeight * W.eyeHeightRatio;
/** How far behind a pane a Warden's eye sits with its body against the glass. */
const EYE_BEHIND = W.radius + WALKWAY.pane + 0.05;

/** The outward normal of a face of the run. */
const NORMALS = {
  west: { x: -1, z: 0 }, east: { x: 1, z: 0 }, north: { x: 0, z: -1 }, south: { x: 0, z: 1 },
};

/** Where a face's pane sits: the plane's coordinate on the fixed axis, on the outside. */
function facePlane(face) {
  const K2 = WALKWAY;
  return { west: K2.x0, east: K2.x1, north: K2.z0, south: K2.z1 }[face];
}

/**
 * An opening in the run's skin, as a rectangle on its face: the three
 * slots and the door (the stair's mouth in the north face).
 */
function openings() {
  const K2 = WALKWAY;
  const floor = K2.floorY;
  const out = K2.apertures.map((ap) => ({
    id: ap.id, face: ap.face, site: ap.site,
    along: [ap.at - K2.aperture.width / 2, ap.at + K2.aperture.width / 2],
    y: [floor + K2.rail, floor + K2.aperture.top],
  }));
  out.push({ id: 'door', face: 'north', site: null, along: [K2.stair.x0, K2.stair.x1], y: [floor, floor + K2.door.height] });
  return out;
}

/** Is `point`, on the plane of `face`, inside this opening? */
function through(opening, point) {
  const along = opening.face === 'west' || opening.face === 'east' ? point.z : point.x;
  return along >= opening.along[0] && along <= opening.along[1] && point.y >= opening.y[0] && point.y <= opening.y[1];
}

/**
 * Where a ray from inside the run first crosses its skin: the nearest of
 * the four face planes it is heading toward, as a point on that plane.
 */
function exitPoint(eye, direction) {
  const K2 = WALKWAY;
  let best = null;
  for (const [face, n] of Object.entries(NORMALS)) {
    const along = direction.x * n.x + direction.z * n.z;
    if (along <= 1e-9) continue;
    const plane = facePlane(face);
    const t = n.x !== 0 ? (plane - eye.x) / direction.x : (plane - eye.z) / direction.z;
    if (t < 0) continue;
    if (!best || t < best.t) best = { t, face, x: eye.x + direction.x * t, y: eye.y + direction.y * t, z: eye.z + direction.z * t };
  }
  return best;
}

/**
 * Where a Warden stands to look through a slot at a target: its eye on the
 * line from the slot's centre to the target, `EYE_BEHIND` inside the pane.
 * The floor sets the eye's height; the line is solved for x and z.
 */
function standBehind(opening, target) {
  const n = NORMALS[opening.face];
  const centre = {
    x: opening.face === 'west' || opening.face === 'east' ? facePlane(opening.face) : (opening.along[0] + opening.along[1]) / 2,
    z: opening.face === 'west' || opening.face === 'east' ? (opening.along[0] + opening.along[1]) / 2 : facePlane(opening.face),
  };
  const dx = centre.x - target.x;
  const dz = centre.z - target.z;
  const alongNormal = -(dx * n.x + dz * n.z);
  const scale = EYE_BEHIND / alongNormal;
  return { x: centre.x + dx * scale, z: centre.z + dz * scale };
}

/** Point the Warden at `target` from where it stands: the actors' convention, forward is (-sin yaw, -cos yaw). */
function aim(warden, target) {
  const dx = target.x - warden.position.x;
  const dy = target.y - warden.eyeY;
  const dz = target.z - warden.position.z;
  warden.yaw = Math.atan2(-dx, -dz);
  warden.pitch = Math.atan2(dy, Math.hypot(dx, dz));
}

/** The walkway's own boxes: the run, its panes and parapet, the stair and its rails. */
function walkwayBoxes(h) {
  return h.map.collision.boxes.filter((box) => box.tag && (box.tag.startsWith('walkway-') || box.tag.startsWith('stair-walkway')));
}

/** A box staged for a check: added, built in, and taken out again by `unstage`. */
function stage(h, min, max, flags) {
  const collision = h.map.collision;
  const box = collision.addBox(min, max, flags);
  collision.build();
  return box;
}
function unstage(h, box) {
  const collision = h.map.collision;
  collision.boxes.splice(collision.boxes.indexOf(box), 1);
  collision.build();
}

/**
 * One swing of the knife through the real key, and what it did to the
 * Warden's health. Waits out the swing interval first so the swing is not
 * eaten by the cooldown.
 */
function swing(h) {
  h.stepFrames(Math.ceil(K.swingInterval / DT) + 2);
  const before = h.warden.health;
  let blocked = null;
  const off = h.emitter.on('combat:knife-miss', (event) => { blocked = event.blocked === true; });
  press(h, h.input.getBinding('melee')[0]);
  h.stepFrames(1);
  h.input.clearAll();
  off();
  return { landed: h.warden.health < before, lost: before - h.warden.health, blocked };
}

/** Feet on the ground at (x, z), the two facing each other `apart` metres along the lane. */
function faceOff(h, at, heading, apart) {
  const there = { x: at.x + heading.dx * apart, z: at.z + heading.dz * apart };
  h.shade.reset({ position: { x: at.x, y: at.y, z: at.z }, yaw: Math.atan2(-heading.dx, -heading.dz) });
  h.warden.reset({ position: { x: there.x, y: at.y, z: there.z }, yaw: Math.atan2(heading.dx, heading.dz) });
  h.stepFrames(5);
}

function backToCompetitive(h) {
  h.input.clearAll();
  h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-walkway-is-glazed-and-shoots-only-through-its-apertures',
    spec: 'Section 5 amended (20.19) / D3 / D11',
    name: 'From the walkway every ray to 40 points stops at its own glass or leaves through a slot or the door; each slot reaches its site; the glass a round stops at is clear to the eye and to nothing else',
    maps: ['yard'],
    run: (h) => {
      const problems = [];
      const collision = h.map.collision;
      const K2 = WALKWAY;
      const floor = K2.floorY;
      const eyeY = floor + WARDEN_EYE;
      const holes = openings();
      const sites = new Map(h.map.sites.map((site) => [site.id, { x: site.position.x, y: torso(site.position.y, S.standHeight), z: site.position.z }]));

      // The 40 points: the three sites, the waypoints, and a ring round the
      // yard, all at a standing Shade's torso.
      const targets = [];
      for (const [id, at] of sites) targets.push({ tag: `site ${id}`, ...at });
      for (const node of h.map.waypoints) {
        if (node) targets.push({ tag: `waypoint ${node.tag || node.id}`, x: node.position.x, y: torso(node.position.y, S.standHeight), z: node.position.z });
      }
      for (let i = 0; targets.length < 40; i++) {
        const angle = (i / 16) * Math.PI * 2;
        targets.push({ tag: `ring ${i}`, x: 20 * Math.cos(angle), y: torso(G, S.standHeight), z: 20 * Math.sin(angle) });
      }
      if (targets.length !== 40) problems.push(`${targets.length} sample points, wanted 40`);

      // The eyes: behind each slot, looking at its site, and mid-run.
      const eyes = [];
      for (const hole of holes) {
        if (!hole.site) continue;
        const stand = standBehind(hole, sites.get(hole.site));
        eyes.push({ tag: `behind the ${hole.id} slot`, hole, x: stand.x, y: eyeY, z: stand.z });
      }
      eyes.push({ tag: 'mid-run', hole: null, x: (K2.x0 + K2.x1) / 2, y: eyeY, z: (K2.z0 + K2.z1) / 2 });

      let stopped = 0;
      let left = 0;
      let seenThroughGlass = 0;
      const reached = new Map();
      for (const eye of eyes) {
        for (const target of targets) {
          const dx = target.x - eye.x;
          const dy = target.y - eye.y;
          const dz = target.z - eye.z;
          const distance = Math.hypot(dx, dy, dz);
          const direction = { x: dx / distance, y: dy / distance, z: dz / distance };
          const hit = collision.raycast(eye, direction, distance);
          const own = hit && hit.box.tag && (hit.box.tag.startsWith('walkway-') || hit.box.tag.startsWith('stair-walkway'));
          if (own) {
            stopped++;
            // What a round stops at, the eye looks straight through (glass), or not (the parapet, the roof).
            const sees = collision.lineOfSight(eye, target);
            if (hit.box.glass && !sees) {
              // Only a fault if nothing else is in the way past the pane.
              const beyond = collision.raycast({ x: hit.x + direction.x * 0.05, y: hit.y + direction.y * 0.05, z: hit.z + direction.z * 0.05 }, direction, distance - hit.distance - 0.05);
              if (!beyond) problems.push(`from ${eye.tag} to ${target.tag}: a round stops at ${hit.box.tag} and the eye cannot see past it`);
            }
            if (hit.box.glass && sees) seenThroughGlass++;
            continue;
          }
          // The ray left the run: through what?
          const exit = exitPoint(eye, direction);
          const opening = exit && holes.find((hole) => hole.face === exit.face && through(hole, exit));
          if (!opening) {
            problems.push(`from ${eye.tag} to ${target.tag}: the ray left the run through the ${exit ? exit.face : '?'} face at `
              + `(${exit ? exit.x.toFixed(2) : '?'}, ${exit ? exit.y.toFixed(2) : '?'}, ${exit ? exit.z.toFixed(2) : '?'}), which is no opening`);
            continue;
          }
          left++;
          if (!reached.has(opening.id)) reached.set(opening.id, { rays: 0, targets: new Set() });
          reached.get(opening.id).rays++;
          reached.get(opening.id).targets.add(target.tag);
        }
      }
      for (const hole of holes) {
        if (!hole.site) continue;
        const got = reached.has(hole.id) ? reached.get(hole.id).targets : new Set();
        if (!got.has(`site ${hole.site}`)) problems.push(`the ${hole.id} slot does not pass a ray to site ${hole.site} from behind it`);
      }
      if (seenThroughGlass === 0) problems.push('no ray was stopped by a pane the eye sees through');

      // The real gun: the human Warden, first through the west slot at site
      // A, then from behind the pane beside the slot.
      h.initMatch({ mode: 'freeroam', role: 'warden', ai: false, objective: false });
      const warden = h.warden;
      const impacts = [];
      const off = h.emitter.on('combat:impact', (event) => impacts.push(event));
      const fireAt = (stand, target) => {
        warden.reset({ position: { x: stand.x, y: floor, z: stand.z }, yaw: 0 });
        h.stepFrames(10);
        aim(warden, target);
        impacts.length = 0;
        h.input.heldCodes.add('Mouse0');
        h.stepFrames(1);
        h.input.heldCodes.delete('Mouse0');
        h.stepFrames(2);
        const impact = impacts[0];
        if (!impact) return null;
        const eye = { x: warden.position.x, y: warden.eyeY, z: warden.position.z };
        return { ...impact, distance: Math.hypot(impact.at.x - eye.x, impact.at.y - eye.y, impact.at.z - eye.z) };
      };
      const west = holes.find((hole) => hole.id === 'west');
      const siteA = sites.get(west.site);
      const throughSlot = fireAt(standBehind(west, siteA), siteA);
      const slotDistance = Math.hypot(siteA.x - warden.position.x, siteA.z - warden.position.z);
      if (!throughSlot) problems.push('through the west slot: the trigger fired no round');
      else if (throughSlot.distance < slotDistance - 1.5) {
        problems.push(`through the west slot: the round landed ${throughSlot.distance.toFixed(1)}m out, not the ${slotDistance.toFixed(1)}m to site A`);
      }
      const besideSlot = { x: standBehind(west, siteA).x, z: west.along[0] - 0.5 };
      const atPane = fireAt(besideSlot, siteA);
      if (!atPane) problems.push('beside the west slot: the trigger fired no round');
      else if (atPane.distance > EYE_BEHIND + 0.6) {
        problems.push(`beside the west slot: the round went ${atPane.distance.toFixed(2)}m, past the pane`);
      }
      off();

      // The real knife: a Shade on a perch outside the west pane at the
      // run's floor, the Warden inside, arm's length apart. At the slot the
      // blade lands; at the pane beside it, it does not.
      h.initMatch({ mode: 'competitive', role: 'shade', ai: false, objective: false });
      const perch = stage(h, { x: K2.x0 - 3.0, y: G, z: K2.z0 }, { x: K2.x0, y: floor, z: K2.z1 }, { tag: 'd3-staged-perch' });
      let atSlot = null;
      let atGlass = null;
      try {
        const apart = W.radius + S.radius + 0.6;
        const place = (z) => {
          h.warden.reset({ position: { x: K2.x0 + EYE_BEHIND, y: floor, z }, yaw: Math.PI / 2 });
          h.shade.reset({ position: { x: K2.x0 + EYE_BEHIND - apart, y: floor, z }, yaw: -Math.PI / 2 });
          h.stepFrames(5);
        };
        place((west.along[0] + west.along[1]) / 2);
        atSlot = swing(h);
        if (!atSlot.landed) problems.push(`the knife through the west slot did not land (blocked=${atSlot.blocked})`);
        place(west.along[0] - 0.5);
        atGlass = swing(h);
        if (atGlass.landed) problems.push(`the knife through the west pane cut the Warden for ${atGlass.lost}`);
        else if (atGlass.blocked !== true) problems.push('the knife at the pane missed for some reason other than the pane');
      } finally {
        unstage(h, perch);
        backToCompetitive(h);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${eyes.length} eyes x ${targets.length} points: ${stopped} rays stopped by the run's own skin (${seenThroughGlass} at glass the eye sees through), `
            + `${left} left through ${[...reached.entries()].map(([id, got]) => `the ${id} (${got.rays})`).join(', ')}; `
            + `a round through the west slot landed ${throughSlot.distance.toFixed(1)}m out at site A, one beside the slot at ${atPane.distance.toFixed(2)}m on the pane; `
            + `a knife through the slot cut ${atSlot.lost}, at the pane nothing`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'a-knife-stops-at-a-wall-a-body-cannot-pass',
    spec: 'Section 8.2 amended (20.19) / D3',
    name: 'A swing at arm\'s length lands; with a post between the two it does not, glass or not, and the glass is still clear to the eye; with the post gone it lands again',
    run: (h) => {
      const problems = [];
      h.initMatch({ mode: 'competitive', role: 'shade', ai: false, objective: false });
      const lane = clearLane(h, 6);
      if (!lane) return { pass: false, detail: 'no clear 6m lane on this map to stand in' };
      const at = alongLane(lane, 1.0);
      const heading = { dx: lane.dx, dz: lane.dz };
      const apart = W.radius + S.radius + 0.6;

      faceOff(h, at, heading, apart);
      const open = swing(h);
      if (!open.landed) problems.push(`in the open at ${apart.toFixed(2)}m the knife did not land (blocked=${open.blocked})`);

      // A pane between them, midway: a post a hand and a half across (the
      // lane may run diagonally, and a box cannot), taller than a body, on
      // the line their torsos trade the blade along. Neither body touches it.
      const mid = { x: at.x + heading.dx * apart / 2, z: at.z + heading.dz * apart / 2 };
      const post = 0.2;
      const paneMin = { x: mid.x - post, y: at.y, z: mid.z - post };
      const paneMax = { x: mid.x + post, y: at.y + W.standHeight + 0.5, z: mid.z + post };
      const results = {};
      for (const [kind, flags] of [['wall', { tag: 'd3-staged-wall' }], ['glass', { tag: 'd3-staged-glass', glass: true, blocksSight: false }]]) {
        const pane = stage(h, paneMin, paneMax, flags);
        try {
          faceOff(h, at, heading, apart);
          results[kind] = swing(h);
          if (results[kind].landed) problems.push(`through a staged ${kind} the knife cut the Warden for ${results[kind].lost}`);
          else if (results[kind].blocked !== true) problems.push(`at the staged ${kind} the knife missed for some reason other than the ${kind}`);
          const eye = { x: h.shade.position.x, y: torso(h.shade.feetY, S.standHeight), z: h.shade.position.z };
          const sees = h.map.collision.lineOfSight(eye, { x: h.warden.position.x, y: torso(h.warden.feetY, W.standHeight), z: h.warden.position.z });
          if (kind === 'glass' && !sees) problems.push('the staged glass is not clear to a line of sight');
          if (kind === 'wall' && sees) problems.push('the staged wall is clear to a line of sight');
        } finally {
          unstage(h, pane);
        }
      }

      faceOff(h, at, heading, apart);
      const again = swing(h);
      if (!again.landed) problems.push('with the pane gone the knife did not land again');

      backToCompetitive(h);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `in ${lane.from}'s lane at ${apart.toFixed(2)}m: open ${open.lost}, through a wall ${results.wall.lost} (blocked), through glass ${results.glass.lost} (blocked, seen through), open again ${again.lost}`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'nothing-climbs-to-the-walkway-and-the-warden-walks-up',
    spec: 'Section 5 amended (20.19) / D3 / D12',
    name: 'The walkway floor is out of a jump\'s reach from every top within 4m, the rule names no way onto any piece of it (and does once a perch is staged in reach of the roof), and the human Warden walks the stair and the run',
    maps: ['yard'],
    run: (h) => {
      const problems = [];
      const K2 = WALKWAY;
      const floor = K2.floorY;
      const collision = h.map.collision;
      const own = new Set(walkwayBoxes(h));
      if (own.size < 20) problems.push(`${own.size} walkway boxes; the stair alone is ${K2.stair.steps}`);

      // D12's sentence, over the geometry: every top a body could stand on
      // within 4m of the footprint is more than a jump's reach below the floor.
      const minSupport = S.radius * 2;
      let near = 0;
      let highest = null;
      for (const box of collision.boxes) {
        if (own.has(box) || !box.solid || box.tag === 'ground-plane') continue;
        if (box.max.x - box.min.x < minSupport || box.max.z - box.min.z < minSupport) continue;
        if (box.max.x < K2.x0 - NEAR || box.min.x > K2.x1 + NEAR) continue;
        if (box.max.z < K2.z0 - NEAR || box.min.z > K2.z1 + NEAR) continue;
        near++;
        if (!highest || box.max.y > highest.max.y) highest = box;
        if (floor - box.max.y <= FULL_REACH) {
          problems.push(`${box.tag} tops out at ${box.max.y.toFixed(2)}m within ${NEAR}m of the walkway, ${(floor - box.max.y).toFixed(2)}m under its floor (a jump reaches ${FULL_REACH})`);
        }
      }
      if (near === 0) problems.push(`no top within ${NEAR}m of the walkway at all - the sentence is vacuous`);

      // The rule: nothing on the walkway derives as climbable, and the floor
      // and the roof have no approach.
      const floorBox = collision.boxes.find((box) => box.tag === 'walkway-floor');
      const roofBox = collision.boxes.find((box) => box.tag === 'walkway-roof');
      if (!floorBox || !roofBox) return { pass: false, detail: 'no walkway-floor / walkway-roof box' };
      for (const box of own) {
        if (box.climbable) problems.push(`${box.tag} derives as climbable`);
      }
      const floorWays = h.map._supportApproaches(floorBox).length;
      const roofWays = h.map._supportApproaches(roofBox).length;
      if (floorWays) problems.push(`the rule names ${floorWays} approaches onto the floor`);
      if (roofWays) problems.push(`the rule names ${roofWays} approaches onto the roof`);

      // The other half: a perch in reach of the floor, outside the west
      // pane, still gets nothing over the parapet; a perch in reach of the
      // roof gets the rule onto the roof. So the answer above is the
      // geometry's, and the check would notice the walkway coming down.
      let withFloorPerch = null;
      let withRoofPerch = null;
      for (const [what, top, target] of [['floor', floor - 3.0, floorBox], ['roof', roofBox.max.y - 3.0, roofBox]]) {
        const perch = stage(h, { x: K2.x0 - 3.0, y: G, z: K2.z0 }, { x: K2.x0, y: top, z: K2.z1 }, { tag: `d3-staged-perch-${what}` });
        try {
          h.map.deriveClimbableSurfaces();
          const ways = h.map._supportApproaches(target).filter((a) => a.box === perch).length;
          if (what === 'floor') {
            withFloorPerch = ways;
            if (ways || target.climbable) problems.push(`with a perch ${(floor - top).toFixed(1)}m under the floor the rule got a body over the parapet (${ways} approaches)`);
          } else {
            withRoofPerch = ways;
            if (!ways || !target.climbable) problems.push(`with a perch ${(roofBox.max.y - top).toFixed(1)}m under the roof the rule still names no way onto it - is it reading the geometry?`);
          }
        } finally {
          unstage(h, perch);
          h.map.deriveClimbableSurfaces();
        }
      }
      if (roofBox.climbable || floorBox.climbable) problems.push('a walkway top stayed climbable once the perch was gone');

      // The Warden's ground reaches the run, from its spawn, on foot.
      const ground = h.map.wardenGround;
      const onRun = { x: (K2.x0 + K2.x1) / 2, y: floor, z: (K2.z0 + K2.z1) / 2 };
      if (!ground || !ground.has(onRun)) problems.push('the Warden\'s ground does not include the middle of the run');

      // And the human Warden does it: from the foot of the stair, W held,
      // facing up the flight; then east along the run to its far end.
      h.initMatch({ mode: 'freeroam', role: 'warden', ai: false, objective: false });
      const warden = h.warden;
      const foot = { x: (K2.stair.x0 + K2.stair.x1) / 2, y: G, z: K2.stair.start - 1.5 };
      warden.reset({ position: foot, yaw: Math.PI });
      h.stepFrames(10);
      h.input.heldCodes.add('KeyW');
      // Arrived: on the floor and through the door, the whole body inside the parapet.
      const inside = K2.z0 + K2.pane + W.radius + 0.05;
      let arrived = -1;
      for (let i = 0; i < 1500; i++) {
        h.stepFrames(1);
        if (warden.feetY >= floor - 0.05 && warden.position.z >= inside) { arrived = i; break; }
      }
      const top = { x: warden.position.x, y: warden.feetY, z: warden.position.z };
      if (arrived < 0) {
        problems.push(`holding W from the stair's foot for 25s the Warden got to feet ${top.y.toFixed(2)}m at (${top.x.toFixed(1)}, ${top.z.toFixed(1)}), not the run at ${floor}m`);
      }
      warden.yaw = -Math.PI / 2;
      let farEnd = -1;
      for (let i = 0; i < 900 && arrived >= 0; i++) {
        h.stepFrames(1);
        if (warden.position.x >= K2.x1 - W.radius - K2.pane - 0.3) { farEnd = i; break; }
      }
      h.input.clearAll();
      const end = { x: warden.position.x, y: warden.feetY, z: warden.position.z };
      if (arrived >= 0 && farEnd < 0) {
        problems.push(`along the run the Warden stopped at (${end.x.toFixed(1)}, ${end.z.toFixed(1)}) with feet at ${end.y.toFixed(2)}m, short of the east end`);
      }
      if (arrived >= 0 && Math.abs(end.y - floor) > 0.05) problems.push(`at the east end the Warden's feet are at ${end.y.toFixed(2)}m, not ${floor}m`);
      if (!collision.isClear(warden.position, warden.half)) problems.push('the Warden ended inside something');

      backToCompetitive(h);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${near} tops within ${NEAR}m, the highest ${highest.tag} at ${highest.max.y.toFixed(1)}m, ${(floor - highest.max.y).toFixed(1)}m under the floor (a jump reaches ${FULL_REACH}); `
            + `${own.size} walkway boxes, none climbable, no approach onto the floor or the roof; a perch 3m under the floor gets ${withFloorPerch} over the parapet, `
            + `one 3m under the roof gets ${withRoofPerch} onto the roof; the Warden's ground includes the run, and holding W the Warden climbed the stair in `
            + `${(arrived * DT).toFixed(1)}s and walked the run to x=${end.x.toFixed(1)} in ${(farEnd * DT).toFixed(1)}s`
          : problems.join('; '),
      };
    },
  });
}
