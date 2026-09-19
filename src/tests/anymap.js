/**
 * BLACKLINE - tests/anymap.js
 *
 * The regression set, whole on every map (D7).
 *
 * Section 16's set - 1, 3, 9, 13, 17, 20, 22, 23, 27, and the redesign's
 * contract by id (20.11) - was written for the plant, and five of its
 * checks name the plant's geometry: a drive into the west wall at x=-30,
 * five routes by tag, the two low ducts, the Turbine Hall and the Server
 * Vault, the hall's east wall. D1 tagged them `maps: ['plant']`, and D6
 * found the yard's set ran 24 of 29 with check 3 held there by nothing.
 *
 * Each of the five has a clause that is about the RULE and a case that is
 * about the plant. The rule's clause is here, asked of whatever map the
 * page is on by searching it - the sites and spawns for somewhere to
 * drive from, `map.routes` for the routes, `clearLane` for a clear line,
 * the Warden's ground for the darkest place a body stands, the solids
 * themselves for cover. The plant's named cases stay where they were, as
 * they were, in the full suite; the set runs these.
 *
 *   1. A body driven into any solid at extreme speed never passes through
 *      (check 1's auto half). Every step's path is swept against every
 *      solid by hand, so a tunnel that lands in open air on the far side
 *      is caught, not only one that ends inside a wall.
 *   2. Every declared route is driven by the controller from walkable
 *      ground to its landing, each stage from the one below, and lands
 *      clean (check 3, "mantle to a catwalk, lands clean"). The rule's
 *      word on each stage is already good (tests/routes.js,
 *      tests/readability.js); this drives the whole way up as a chain and
 *      lets the body settle where it lands.
 *   3. No climb the rule names rises through a solid - `mantleClauses`,
 *      the three map-generic clauses of the plant's mantle check.
 *   4. The brightest site reads lit with headroom under the clamp, and
 *      the darkest place on the walking ground reads dark (checks 8 and
 *      9's auto half). The plant's lines are 70 and 25 at two named rooms;
 *      on any map "lit" is `LIT_METER` (half the meter, D5) and "dark" is
 *      the plant's 25.
 *   5. A round stops at the first solid between the muzzle and the body,
 *      and lands a headshot only above the head line, down a clear lane
 *      and across three pieces of cover the map is searched for.
 *
 * `the-regression-set-resolves-to-real-checks` (tests/donedef.js) holds
 * the set to zero "not for this map" and every number covered, on every
 * map, so a sixth plant-only check cannot creep back in.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { rayHitsActor } from '../systems/combat.js';
import { clearLane, alongLane, meterAt, LIT_METER } from './lanes.js';
import { usableApproaches, mantleClauses } from './routes.js';
import { attemptClimb, bodyHeightAt, onWalkableGround } from './readability.js';

const S = CONFIG.shade;
const W = CONFIG.warden;
const G = CONFIG.combat.gun;
/** Section 16 check 9's line: the Server Vault reads below this, and so does the darkest ground anywhere. */
const DARK_METER = 25;
/** The drive's four speeds: a sprint, and three nothing in the game reaches. */
const DRIVE_SPEEDS = [6.5, 50, 200, 1000];
const DRIVE_STEPS = 180;
/** How far outside a face the body is allowed to be and still count as touching it, not inside. */
const TUNNEL_SKIN = 0.02;
/** Every Nth ground cell each way is sampled for the darkest place: 0.5m cells, so a 2m grid. */
const DARK_GRID = 4;
/** How far either side of a piece of cover the shooter and the Shade stand. */
const COVER_STANDOFF = 3.0;
const COVERS_WANTED = 3;

const AXES = [
  { dx: 1, dz: 0 }, { dx: -1, dz: 0 }, { dx: 0, dz: 1 }, { dx: 0, dz: -1 },
];

/**
 * Does the segment from `p0` to `p1` enter the interior of `box` grown by
 * the body's half extents and shrunk by `skin` - would a body whose centre
 * moved along it have been inside the solid, not merely against it? A slab
 * test; touching an edge is not entering.
 */
function segmentEnters(p0, p1, box, half, skin) {
  let tmin = 0;
  let tmax = 1;
  for (const axis of ['x', 'y', 'z']) {
    const lo = box.min[axis] - half[axis] + skin;
    const hi = box.max[axis] + half[axis] - skin;
    if (lo >= hi) return false;
    const d = p1[axis] - p0[axis];
    if (Math.abs(d) < 1e-9) {
      if (p0[axis] <= lo || p0[axis] >= hi) return false;
      continue;
    }
    let t1 = (lo - p0[axis]) / d;
    let t2 = (hi - p0[axis]) / d;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin >= tmax) return false;
  }
  return true;
}

/**
 * Climb `box` from the approach the rule names and stay there: the census's
 * own drive (`attemptClimb`), then forty frames with the keys up so the
 * move finishes and gravity settles, and the feet are on the top with the
 * body in open air. "Lands clean", check 3's words.
 */
function climbClean(h, box, approach) {
  const stand = { x: approach.x, z: approach.z };
  const height = bodyHeightAt(h, stand, approach.y);
  if (height === null) return { ok: false, why: 'no body fits at the spot' };
  const scuffs = h.shade.scuffs;
  const face = { nx: approach.nx, nz: approach.nz };
  if (!attemptClimb(h, box, face, stand, approach.y, height)) {
    return { ok: false, why: h.shade.scuffs > scuffs ? 'scuffed' : 'did not get on top' };
  }
  h.input.clearAll();
  h.stepFrames(40);
  const landed = Math.abs(h.shade.feetY - box.max.y) < 0.35;
  const clear = h.map.collision.isClear(h.shade.position, h.shade.half);
  if (!landed) return { ok: false, why: `got on top and slid off to ${h.shade.feetY.toFixed(2)}m` };
  if (!clear) return { ok: false, why: 'landed inside geometry' };
  return { ok: true };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-body-driven-into-any-solid-never-passes-through',
    spec: 'check 1 (auto half) / Section 15',
    name: 'From every site and spawn, in four headings, at four speeds, the body stops at the first solid and is never inside one',
    run: (h) => {
      const world = h.map.collision;
      const half = { x: S.radius, y: S.standHeight / 2, z: S.radius };
      const dt = CONFIG.time.fixedDt;
      const solids = world.boxes.filter((box) => box.solid);
      const starts = [
        ...h.map.sites.map((site) => ({ at: site.position, from: `site ${site.id}` })),
        ...h.map.wardenSpawns.map((spawn) => ({ at: spawn.position, from: `spawn ${spawn.name}` })),
      ];
      const problems = [];
      let drives = 0;
      let stopped = 0;
      let stepped = 0;
      const p0 = { x: 0, y: 0, z: 0 };

      for (const { at, from } of starts) {
        for (const heading of AXES) {
          for (const speed of DRIVE_SPEEDS) {
            drives++;
            const position = { x: at.x, y: at.y + half.y + 0.05, z: at.z };
            const velocity = { x: 0, y: 0, z: 0 };
            let breach = null;
            for (let i = 0; i < DRIVE_STEPS && !breach; i++) {
              p0.x = position.x; p0.y = position.y; p0.z = position.z;
              velocity.x = heading.dx * speed;
              velocity.y = 0;
              velocity.z = heading.dz * speed;
              const moved = world.moveAndSlide(position, half, velocity, dt, {
                groundNormalY: S.groundNormalY,
                stepHeight: S.stepHeight,
                wasGrounded: true,
              });
              if (moved.stepped) stepped++;
              // A solid the body could step onto - its top within a step of
              // the feet, or under them - is walked over, not tunnelled; the
              // step's own path crosses its corner by design. Everything
              // taller must never have the body's path inside it.
              const feet = p0.y - half.y;
              for (const box of solids) {
                if (box.max.y <= feet + S.stepHeight + TUNNEL_SKIN) continue;
                if (segmentEnters(p0, position, box, half, TUNNEL_SKIN)) { breach = box; break; }
              }
            }
            const heading$ = `${heading.dx > 0 ? '+x' : heading.dx < 0 ? '-x' : heading.dz > 0 ? '+z' : '-z'}`;
            if (breach) {
              problems.push(`${from} ${heading$} at ${speed}m/s went through ${breach.tag || 'a solid'} `
                + `(ended ${position.x.toFixed(2)},${position.z.toFixed(2)})`);
              continue;
            }
            if (!world.isClear(position, half)) {
              problems.push(`${from} ${heading$} at ${speed}m/s ended inside ${(world.overlap(position, half) || {}).tag || 'a solid'}`);
              continue;
            }
            const travelled = Math.hypot(position.x - at.x, position.z - at.z);
            const free = speed * dt * DRIVE_STEPS;
            if (travelled < free - 0.5) stopped++;
            // A run of 150m or more that met nothing left the site: the
            // perimeter is a solid on every map.
            else if (free > CONFIG.map.siteWidth + CONFIG.map.siteDepth) {
              problems.push(`${from} ${heading$} at ${speed}m/s ran ${travelled.toFixed(1)}m and met nothing`);
            }
          }
        }
      }

      return {
        pass: problems.length === 0 && drives > 0,
        detail: problems.length === 0
          ? `${drives} drives from ${starts.length} starts at ${DRIVE_SPEEDS.join('/')}m/s, ${stopped} stopped by a solid, `
            + `${stepped} step-ups, every step's path outside every solid taller than a step`
          : `${problems.length} of ${drives} drives: ${problems.slice(0, 3).join('; ')}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'every-declared-route-is-driven-from-the-ground-to-its-landing',
    spec: 'v2 requirement 4 / check 3',
    name: 'The controller climbs every declared route, stage by stage from walkable ground, and lands clean where it says',
    run: (h) => {
      const routes = h.map.routes;
      if (!routes || !routes.length) return { pass: false, detail: 'the map declares no routes' };
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      h.setPaused(false);
      const god = h.debugState.godMode;
      h.debugState.godMode = true;

      const problems = [];
      const summaries = [];
      let hops = 0;
      for (const route of routes) {
        const every = route.stages.flat();
        const unresolved = every.filter((box) => typeof box === 'string');
        if (unresolved.length) { problems.push(`${route.id}: no box tagged ${unresolved.join(', ')}`); continue; }
        if (every.some((box) => /^stair-/.test(box.tag || ''))) { problems.push(`${route.id} uses a staircase`); continue; }

        let ok = true;
        let below = null;
        const rises = [];
        for (let i = 0; i < route.stages.length && ok; i++) {
          const stage = route.stages[i];
          for (const box of stage) {
            // The first stage is found on foot: from walkable ground, within
            // a standing reach. Every later one from a box of the stage below.
            const approach = i === 0
              ? usableApproaches(h, box, S.reach.standing).find((a) => onWalkableGround(h, { x: a.x, z: a.z }, a.y))
              : usableApproaches(h, box).find((a) => below.includes(a.box));
            if (!approach) {
              problems.push(`${route.id}: the rule names no way onto ${box.tag} from `
                + `${i === 0 ? 'walkable ground within a standing reach' : below.map((b) => b.tag).join('/')}`);
              ok = false;
              break;
            }
            const drove = climbClean(h, box, approach);
            if (!drove.ok) {
              problems.push(`${route.id}: ${approach.box.tag || 'ground'} -> ${box.tag} ${drove.why}`);
              ok = false;
              break;
            }
            hops++;
            rises.push(approach.rise.toFixed(1));
          }
          below = stage;
        }
        if (!ok) continue;

        // It lands where it says: a climbable top at the landing height the
        // rule names from some stage, driven from that stage.
        let landed = null;
        for (const box of h.map.collision.boxes) {
          if (!box.climbable || Math.abs(box.max.y - route.landing) >= 0.01) continue;
          const approach = usableApproaches(h, box).find((a) => every.includes(a.box));
          if (approach) { landed = { box, approach }; break; }
        }
        if (!landed) { problems.push(`${route.id}: nothing at ${route.landing}m is climbable from it`); continue; }
        const drove = climbClean(h, landed.box, landed.approach);
        if (!drove.ok) { problems.push(`${route.id}: ${landed.approach.box.tag} -> ${landed.box.tag} (the landing) ${drove.why}`); continue; }
        hops++;
        rises.push(landed.approach.rise.toFixed(1));
        summaries.push(`${route.id} (${rises.join('/')}m)`);
      }

      h.input.clearAll();
      h.debugState.godMode = god;
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${routes.length} routes driven from walkable ground to their landings, ${hops} climbs, every one landed clean: ${summaries.join('; ')}`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'no-climb-the-rule-names-rises-through-a-solid',
    spec: 'Section 6.1 (parkour safety rule) / B5c, B8, B8b, on every map',
    name: 'From where a climb starts to where it lands, the body is in open air - by the rule, by the geometry, and by the controller at whatever the sweep refuses',
    run: (h) => {
      const { problems, approaches, unswept, refused, summary } = mantleClauses(h, debugTools);
      h.input.clearAll();
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${approaches} approaches, none under a solid it lands over; the sweep and the geometry agree on all `
            + `${unswept}; the sweep refuses ${refused}`
            + (refused
              ? `, each through a solid the geometry names and a scuff under the top: ${summary.join(', ')}`
              : ' - nothing on this map for the controller clause to drive')
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'a-lamp-lit-site-reads-lit-and-the-darkest-ground-reads-dark',
    spec: 'Section 16 checks 8 and 9 (auto half), on every map',
    name: `The brightest site reads at least ${LIT_METER} with headroom under the clamp; the darkest walking ground reads under ${DARK_METER}`,
    run: (h) => {
      const ground = h.map.wardenGround;
      if (!ground) return { pass: false, detail: 'no Warden ground to search' };
      const problems = [];

      const sites = h.map.sites.map((site) => ({ id: site.id, meter: meterAt(h, site.position) }));
      const lit = sites.reduce((best, site) => (best === null || site.meter > best.meter ? site : best), null);
      if (!lit) problems.push('the map has no sites');
      else {
        if (lit.meter < LIT_METER) problems.push(`the brightest site ${lit.id} reads ${lit.meter.toFixed(1)}, under ${LIT_METER}`);
        // Headroom matters as much as the line: a meter pegged at the clamp
        // cannot show a light going out, which is check 10.
        if (lit.meter >= CONFIG.detection.meterMax - 5) problems.push(`site ${lit.id} reads ${lit.meter.toFixed(1)}, at the clamp`);
      }

      // The darkest place a body stands, on a 2m grid over the Warden's
      // ground - every floor of it, so the plant's deck counts.
      let darkest = null;
      let samples = 0;
      ground.forEach((x, y, z) => {
        const at = ground.indexAt(x, z);
        if (at.i % DARK_GRID || at.j % DARK_GRID) return;
        samples++;
        const meter = meterAt(h, { x, y, z });
        if (darkest === null || meter < darkest.meter) darkest = { x, y, z, meter };
      });
      if (!darkest) problems.push('no ground cell sampled');
      else if (darkest.meter >= DARK_METER) {
        problems.push(`the darkest ground (${darkest.x.toFixed(1)},${darkest.z.toFixed(1)}) reads ${darkest.meter.toFixed(1)}, not under ${DARK_METER}`);
      }

      h.shade.reset(h.map.shadeSpawns[0]);
      h.detection.reset(h.shade);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `sites ${sites.map((site) => `${site.id} ${site.meter.toFixed(1)}`).join(', ')} (lit is ${LIT_METER}+, clamp ${CONFIG.detection.meterMax}); `
            + `darkest of ${samples} ground samples ${darkest.meter.toFixed(1)} at ${darkest.x.toFixed(1)},${darkest.z.toFixed(1)} (dark is under ${DARK_METER})`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'a-round-stops-at-cover-and-reads-the-head-line',
    spec: 'Section 8.1, on every map',
    name: 'Down a clear lane a shot lands on the torso or, above the head line, the head; across cover the map is searched for, the solid takes it',
    run: (h) => {
      const problems = [];
      const shade = h.shade;
      const world = h.map.collision;
      const ground = h.map.wardenGround;

      // The clear line: a lane the map offers, the Shade 8m down it.
      const lane = clearLane(h, 9);
      if (!lane) return { pass: false, detail: 'no 9m clear lane on this map' };
      shade.reset({ position: alongLane(lane, 8), yaw: lane.yaw + Math.PI });
      const torsoY = shade.feetY + shade.height * 0.5;
      const headY = shade.feetY + shade.height * (G.headHeightRatio + 0.05);
      const direction = { x: lane.dx, y: 0, z: lane.dz };
      const body = rayHitsActor({ x: lane.x, y: torsoY, z: lane.z }, direction, shade, G.range);
      const bodyWorld = world.raycast({ x: lane.x, y: torsoY, z: lane.z }, direction, G.range);
      if (!body) problems.push('a clear torso shot missed');
      if (body && body.headshot) problems.push('a torso shot registered as a headshot');
      if (body && bodyWorld && bodyWorld.distance < body.distance) problems.push(`the lane from ${lane.from} is not clear: ${bodyWorld.box.tag} at ${bodyWorld.distance.toFixed(1)}m`);
      const head = rayHitsActor({ x: lane.x, y: headY, z: lane.z }, direction, shade, G.range);
      if (!head) problems.push('a clear head shot missed');
      if (head && !head.headshot) problems.push('a shot above the head line was not a headshot');

      // Cover: a solid with walking ground at its own foot three metres
      // either side, tall enough to hide a torso, the Shade behind it and
      // the muzzle before it on the same line. The first three the map has.
      const half = { x: S.radius, y: S.standHeight / 2, z: S.radius };
      const covers = [];
      for (const box of world.boxes) {
        if (!box.solid || covers.length >= COVERS_WANTED) continue;
        for (const axis of ['x', 'z']) {
          const cross = axis === 'x' ? 'z' : 'x';
          const mid = (box.min[cross] + box.max[cross]) / 2;
          const near = { x: 0, z: 0 };
          const far = { x: 0, z: 0 };
          near[axis] = box.min[axis] - COVER_STANDOFF; near[cross] = mid;
          far[axis] = box.max[axis] + COVER_STANDOFF; far[cross] = mid;
          const footOf = (spot) => ground.floorsAt(spot.x, spot.z).find((y) => Math.abs(y - box.min.y) <= 0.05);
          const feet = footOf(near);
          if (feet === undefined || footOf(far) === undefined) continue;
          const torso = feet + S.standHeight * 0.5;
          if (box.min.y > torso - 0.2 || box.max.y < torso + 0.2) continue;
          const fits = (spot) => world.isClear({ x: spot.x, y: feet + half.y + 0.05, z: spot.z }, half);
          if (!fits(near) || !fits(far)) continue;
          shade.reset({ position: { x: far.x, y: feet, z: far.z }, yaw: 0 });
          const origin = { x: near.x, y: torso, z: near.z };
          const along = { x: axis === 'x' ? 1 : 0, y: 0, z: axis === 'z' ? 1 : 0 };
          const onLine = rayHitsActor(origin, along, shade, G.range);
          if (!onLine) continue;
          const hit = world.raycast(origin, along, G.range);
          if (!hit || hit.distance >= onLine.distance) {
            problems.push(`across ${box.tag || 'a solid'} the round reached the Shade at ${onLine.distance.toFixed(1)}m`
              + (hit ? ` (the world at ${hit.distance.toFixed(1)}m)` : ' (the world nowhere)'));
          } else {
            covers.push(`${hit.box.tag || 'a solid'} at ${hit.distance.toFixed(1)}m of ${onLine.distance.toFixed(1)}m`);
          }
          break;
        }
      }
      if (!covers.length) problems.push('no solid on this map has walking ground three metres either side at torso height');

      shade.reset(h.map.shadeSpawns[0]);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `down the lane from ${lane.from}: torso hit at ${body.distance.toFixed(1)}m (headshot=false), head hit at `
            + `${head.distance.toFixed(1)}m (headshot=true); cover: ${covers.join(', ')}`
          : problems.join('; '),
      };
    },
  });
}
