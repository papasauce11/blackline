/**
 * BLACKLINE - tests/navigation.js
 *
 * AUTO suite (Section 16, Section 17.1): Navigation.
 *
 * The waypoint graph, the connected upper deck, and the routes each actor is
 * expected to be able to take.
 *
 * Registered from tests/index.js. Checks reach the live game through the
 * harness `h`; nothing here imports main.js, which Section 3.1 forbids.
 */

import { CONFIG } from '../config.js';
import { SHADE_STATE, createIntent } from '../entities/agent.js';
import { createWardenIntent } from '../entities/enforcer.js';

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'waypoint-graph-valid',
    maps: ['plant'], // Section 5's node count is the plant's
    spec: 'Section 5 / Section 11',
    name: '14 waypoints, links bidirectional, graph fully connected',
    run: (h) => {
      const nodes = h.map.waypoints;
      let asymmetric = 0;
      for (const node of nodes) {
        for (const other of node.links) {
          if (nodes[other].links.indexOf(node.id) === -1) asymmetric++;
        }
      }
      const seen = new Set([0]);
      const queue = [0];
      while (queue.length) {
        const current = queue.shift();
        for (const next of nodes[current].links) {
          if (!seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      const siteTags = ['site-a', 'site-b', 'site-c'];
      const sitesCovered = siteTags.filter((tag) => nodes.some((n) => n.tag === tag)).length;
      const pass =
        nodes.length === CONFIG.map.waypointCount &&
        asymmetric === 0 &&
        seen.size === nodes.length &&
        sitesCovered === 3;
      return {
        pass,
        detail: `${nodes.length} nodes, ${asymmetric} asymmetric links, ${seen.size} reachable from node 0, ${sitesCovered}/3 sites covered`,
      };
    },
  });

  // -------------------------------------------------------------------------
  // v2 map redesign. Each of the five requirements is asserted rather than
  // trusted, in the same spirit as the derived-climbability check: the map is
  // large enough that a hand walkthrough would not reliably catch a regression.
  // -------------------------------------------------------------------------
  debugTools.registerAutoTest({
    id: 'warden-upper-deck-fully-connected',
    maps: ['plant'], // the plant's deck
    spec: 'v2 requirement 2',
    name: 'Every walkable square of the upper deck is one connected region',
    run: (h) => {
      const cell = CONFIG.debug.deckFloodCell;
      const deck = CONFIG.map.catwalkY;
      const half = { x: CONFIG.warden.radius, y: CONFIG.warden.standHeight / 2, z: CONFIG.warden.radius };
      const world = h.map.collision;
      const x0 = -CONFIG.map.width / 2;
      const z0 = -CONFIG.map.depth / 2;
      const nx = Math.ceil(CONFIG.map.width / cell);
      const nz = Math.ceil(CONFIG.map.depth / cell);

      // A square counts when a standing Warden fits there AND the thing under
      // its feet is the deck surface itself — not a stair tread on the way up,
      // not a crate top, not thin air over a void.
      const walkable = [];
      let total = 0;
      for (let j = 0; j < nz; j++) {
        walkable.push(new Array(nx).fill(false));
        for (let i = 0; i < nx; i++) {
          const x = x0 + (i + 0.5) * cell;
          const z = z0 + (j + 0.5) * cell;
          const floor = world.raycast({ x, y: deck + 0.5, z }, { x: 0, y: -1, z: 0 }, 1.0);
          if (!floor || Math.abs(floor.y - deck) > 0.05) continue;
          if (!world.isClear({ x, y: deck + half.y + 0.05, z }, half)) continue;
          walkable[j][i] = true;
          total++;
        }
      }

      // Flood from the top of a staircase: if the Warden can walk up, it must
      // be able to reach everything up there.
      const head = h.map.staircases[0];
      const seed = {
        i: Math.round((((head.axis === 'x' ? head.top : (head.crossMin + head.crossMax) / 2) - x0) / cell) - 0.5),
        j: Math.round((((head.axis === 'x' ? (head.crossMin + head.crossMax) / 2 : head.top) - z0) / cell) - 0.5),
      };
      // Nudge onto the nearest walkable square; the exact top step may straddle
      // the stairwell edge.
      let start = null;
      for (let r = 0; r <= 8 && !start; r++) {
        for (let dj = -r; dj <= r && !start; dj++) {
          for (let di = -r; di <= r && !start; di++) {
            const i = seed.i + di;
            const j = seed.j + dj;
            if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
            if (walkable[j][i]) start = { i, j };
          }
        }
      }
      if (!start) return { pass: false, detail: 'no walkable deck square near the stair head' };

      const seen = [];
      for (let j = 0; j < nz; j++) seen.push(new Array(nx).fill(false));
      const stack = [start];
      seen[start.j][start.i] = true;
      let reached = 0;
      while (stack.length) {
        const { i, j } = stack.pop();
        reached++;
        const neighbours = [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]];
        for (const [ni, nj] of neighbours) {
          if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue;
          if (!walkable[nj][ni] || seen[nj][ni]) continue;
          seen[nj][ni] = true;
          stack.push({ i: ni, j: nj });
        }
      }

      // Name what was stranded, so a failure points at a place rather than a count.
      const stranded = [];
      for (let j = 0; j < nz && stranded.length < 4; j++) {
        for (let i = 0; i < nx && stranded.length < 4; i++) {
          if (walkable[j][i] && !seen[j][i]) {
            stranded.push(`(${(x0 + (i + 0.5) * cell).toFixed(1)}, ${(z0 + (j + 0.5) * cell).toFixed(1)})`);
          }
        }
      }

      // And every upper waypoint and room must actually be on that region.
      const missed = [];
      for (const node of h.map.waypoints) {
        if (Math.abs(node.position.y - deck) > 0.05) continue;
        const i = Math.floor((node.position.x - x0) / cell);
        const j = Math.floor((node.position.z - z0) / cell);
        if (!(seen[j] && seen[j][i])) missed.push(`waypoint ${node.id} (${node.tag})`);
      }
      for (const room of h.map.rooms) {
        if (Math.abs(room.floorY - deck) > 0.05) continue;
        let found = false;
        for (let j = 0; j < nz && !found; j++) {
          for (let i = 0; i < nx && !found; i++) {
            const x = x0 + (i + 0.5) * cell;
            const z = z0 + (j + 0.5) * cell;
            if (x < room.min.x || x > room.max.x || z < room.min.z || z > room.max.z) continue;
            if (seen[j][i]) found = true;
          }
        }
        if (!found) missed.push(`room ${room.id}`);
      }

      const pass = total > 0 && reached === total && missed.length === 0;
      return {
        pass,
        detail: pass
          ? `${total} walkable deck squares at ${cell}m, all ${reached} reachable from ${h.map.staircases[0].tag}; every upper waypoint and room on the same region`
          : `${reached}/${total} reachable; stranded near ${stranded.join(' ') || 'n/a'}; unreached: [${missed.join(', ')}]`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'shade-reaches-level-2-without-stairs',
    maps: ['plant'], // names the plant's five routes by tag
    spec: 'v2 requirement 4 / check 3',
    name: 'Four routes climb to the upper deck without using a staircase',
    run: (h) => {
      const deck = CONFIG.map.catwalkY;
      const roof = CONFIG.map.ceilingY + CONFIG.map.wallThickness;

      /**
       * Drive the Shade from the top of one box onto the top of the next,
       * starting from the point on the lower surface closest to the upper one.
       * No teleporting into the destination: the move has to be committed by
       * the controller, through the same parkour gate real play uses.
       */
      const hop = (from, to) => {
        const mid = (box, axis) => (box.min[axis] + box.max[axis]) / 2;
        // Walk at the ledge along the axis the two surfaces are separated on.
        // A ledge probe is a ray at a face; approaching diagonally puts the
        // face outside its reach even when the climb itself is fine.
        const gapX = Math.max(from.min.x - to.max.x, to.min.x - from.max.x);
        const gapZ = Math.max(from.min.z - to.max.z, to.min.z - from.max.z);
        const useX =
          gapX > gapZ ||
          (gapX === gapZ && Math.abs(mid(to, 'x') - mid(from, 'x')) >= Math.abs(mid(to, 'z') - mid(from, 'z')));
        const axis = useX ? 'x' : 'z';
        const cross = useX ? 'z' : 'x';
        const sign = mid(to, axis) >= mid(from, axis) ? 1 : -1;
        const inset = CONFIG.shade.radius + 0.06;

        // Stand back far enough that the approach is actually walked. This was
        // a flat 0.55m, which is INSIDE the probe's own reach — the body was
        // spawned already touching the ledge, so the check never exercised
        // walking up to one. On the two gantry-to-deck hops it was worse than
        // that: the deck lip overhangs its gantry by 0.6m, so 0.55m back put
        // the body under the overhang, crouched, with concrete directly
        // overhead, and the hop only ever succeeded because the probe used to
        // cast its rays from inside that concrete. From a real standoff both
        // hops climb; the overhang is noted for the area rebuild.
        const standoff = CONFIG.shade.radius + CONFIG.shade.vaultReach + 0.3;
        const along = Math.min(
          Math.max((sign > 0 ? from.max[axis] : from.min[axis]) - sign * standoff, from.min[axis] + inset),
          from.max[axis] - inset
        );
        const lo = Math.max(from.min[cross], to.min[cross]);
        const hi = Math.min(from.max[cross], to.max[cross]);
        const across =
          lo < hi
            ? (lo + hi) / 2
            : Math.min(Math.max(mid(to, cross), from.min[cross] + inset), from.max[cross] - inset);
        const start = { x: useX ? along : across, z: useX ? across : along };
        const dir = { x: useX ? sign : 0, z: useX ? 0 : sign };

        h.shade.reset(h.map.shadeSpawns[0]);
        // Some surfaces in these chains sit under the deck with only crouch
        // headroom. Start the way the controller would leave you there.
        const place = (height) => {
          h.shade.height = height;
          h.shade.half.y = height / 2;
          h.shade.crouching = height < CONFIG.shade.standHeight;
          h.shade.position.set(start.x, from.max.y + height / 2 + 0.05, start.z);
          return h.map.collision.isClear(h.shade.position, h.shade.half);
        };
        if (!place(CONFIG.shade.standHeight) && !place(CONFIG.shade.crouchHeight)) {
          return { ok: false, why: `no room to stand on ${from.tag}` };
        }
        h.shade.velocity.set(0, 0, 0);
        h.shade.yaw = Math.atan2(-dir.x, -dir.z);
        h.shade.state = SHADE_STATE.GROUND;

        const intent = createIntent();
        intent.forward = 1;
        for (let i = 0; i < 300; i++) {
          intent.jumpPressed = i % 22 === 0;
          intent.jump = intent.jumpPressed;
          h.shade.step(CONFIG.time.fixedDt, intent);
          if (Math.abs(h.shade.feetY - to.max.y) < 0.3) {
            // Let the traversal finish and gravity settle before believing it.
            for (let k = 0; k < 40; k++) h.shade.step(CONFIG.time.fixedDt, createIntent());
            const landed = Math.abs(h.shade.feetY - to.max.y) < 0.35;
            const clear = h.map.collision.isClear(h.shade.position, h.shade.half);
            return { ok: landed && clear, why: landed ? (clear ? '' : 'landed inside geometry') : 'slid off' };
          }
        }
        return { ok: false, why: `never reached ${to.max.y.toFixed(1)}m (ended ${h.shade.feetY.toFixed(2)})` };
      };

      const box = (tag) => h.map.collision.boxes.find((entry) => entry.tag === tag);
      const routes = [
        { name: 'turbine hall crates', top: deck, tags: ['stack-hall-low', 'stack-hall-mid', 'hall-container', 'gantry-hall', 'lip-hall-east'] },
        { name: 'lower vent to hall deck', top: deck, tags: ['vent-low-south-lip-from', 'gantry-hall-south', 'lip-hall-south'] },
        { name: 'loading bay crates', top: deck, tags: ['stack-bay-low', 'stack-bay-mid', 'gantry-bay', 'lip-bay'] },
        { name: 'upper vent into the vault', top: deck, tags: ['stack-vault-low', 'stack-vault-mid', 'vent-up-vault-floor', 'lip-vault'] },
        { name: 'fire escape to the roof', top: roof, tags: ['fire-escape-base', 'fire-escape-0', 'fire-escape-1', 'fire-escape-2', 'fire-escape-3', 'fire-escape-4', 'lip-roof'] },
      ];

      const problems = [];
      const summaries = [];
      for (const route of routes) {
        const boxes = route.tags.map(box);
        const missing = route.tags.filter((tag, i) => !boxes[i]);
        if (missing.length) {
          problems.push(`${route.name}: missing [${missing.join(', ')}]`);
          continue;
        }
        if (boxes.some((entry) => /^stair-/.test(entry.tag))) {
          problems.push(`${route.name} uses a staircase`);
          continue;
        }
        let ok = true;
        for (let i = 0; i < boxes.length - 1 && ok; i++) {
          const result = hop(boxes[i], boxes[i + 1]);
          if (!result.ok) {
            problems.push(`${route.name}: ${boxes[i].tag} -> ${boxes[i + 1].tag} ${result.why}`);
            ok = false;
          }
        }
        if (!ok) continue;
        const reached = boxes[boxes.length - 1].max.y;
        if (Math.abs(reached - route.top) > 0.05) {
          problems.push(`${route.name} ends at ${reached.toFixed(2)}m, not ${route.top.toFixed(2)}m`);
          continue;
        }
        const rises = [];
        for (let i = 0; i < boxes.length - 1; i++) rises.push((boxes[i + 1].max.y - boxes[i].max.y).toFixed(1));
        summaries.push(`${route.name} (${rises.join('/')}m)`);
      }

      h.shade.reset(h.map.shadeSpawns[0]);

      return {
        pass: problems.length === 0,
        detail:
          problems.length === 0
            ? `${summaries.length} stairless routes driven end to end: ${summaries.join('; ')}`
            : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'waypoint-links-are-walkable',
    spec: 'Section 11 / phase 4 known issue',
    name: 'Every waypoint link is a straight line the Warden can actually walk',
    run: (h) => {
      const step = CONFIG.debug.linkWalkSample;
      const half = { x: CONFIG.warden.radius, y: CONFIG.warden.standHeight / 2, z: CONFIG.warden.radius };
      const maxRise = CONFIG.warden.stepHeight;
      const world = h.map.collision;
      const problems = [];
      let checked = 0;
      let samples = 0;

      // Stair treads are the floor of a flight, not obstacles in it. A capsule
      // standing on one always overlaps the risers ahead of it, so they are
      // excluded from the clearance test — the per-sample rise limit below is
      // what proves the flight is actually walkable.
      const treads = new Set();
      for (const stair of h.map.staircases) for (const step of stair.steps) treads.add(step);

      for (const node of h.map.waypoints) {
        for (const other of node.links) {
          if (other < node.id) continue; // each undirected link once
          const a = node.position;
          const b = h.map.waypoints[other].position;
          const length = Math.hypot(b.x - a.x, b.z - a.z);
          const count = Math.max(2, Math.ceil(length / step));
          let previous = null;
          let failed = null;

          for (let i = 0; i <= count && !failed; i++) {
            const t = i / count;
            const x = a.x + (b.x - a.x) * t;
            const z = a.z + (b.z - a.z) * t;
            // Probe around the height the route is expected to be at, so a
            // staircase is traced along its treads rather than measured
            // against the deck slab passing overhead.
            const expected = a.y + (b.y - a.y) * t;
            const floor = world.raycast({ x, y: expected + 1.5, z }, { x: 0, y: -1, z: 0 }, 4.0);
            samples++;
            if (!floor) {
              failed = `no floor at (${x.toFixed(1)}, ${z.toFixed(1)})`;
              break;
            }
            // Ignore stair treads and anything low enough to walk over.
            const passable = (box) => !treads.has(box) && box.max.y > floor.y + maxRise;
            if (!world.isClear({ x, y: floor.y + half.y + 0.05, z }, half, passable)) {
              failed = `blocked at (${x.toFixed(1)}, ${z.toFixed(1)})`;
              break;
            }
            if (previous !== null && Math.abs(floor.y - previous) > maxRise + 1e-6) {
              failed = `${(floor.y - previous).toFixed(2)}m step at (${x.toFixed(1)}, ${z.toFixed(1)})`;
              break;
            }
            previous = floor.y;
          }

          checked++;
          if (failed) problems.push(`${node.id}(${node.tag}) -> ${other}(${h.map.waypoints[other].tag}): ${failed}`);
        }
      }

      return {
        pass: problems.length === 0,
        detail:
          problems.length === 0
            ? `${checked} links, ${samples} samples at ${step}m: floor found everywhere, Warden capsule fits, no rise above ${maxRise}m`
            : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'warden-can-walk-between-floors',
    maps: ['plant'], // the plant's staircases
    spec: 'Section 6.2 / Section 5',
    name: 'The Warden walks up every staircase to the upper floor unaided',
    run: (h) => {
      const dt = CONFIG.time.fixedDt;
      const intent = createWardenIntent();
      const results = [];
      let failures = 0;

      for (const stair of h.map.staircases) {
        const alongZ = stair.axis === 'z';
        const cross = (stair.crossMin + stair.crossMax) / 2;

        // Start one metre short of the first step, facing up the flight.
        const startAlong = stair.bottom - 1.0;
        h.warden.reset(h.map.wardenSpawns[0]);
        h.warden.position.set(
          alongZ ? cross : startAlong,
          stair.baseY + CONFIG.warden.standHeight / 2 + 0.05,
          alongZ ? startAlong : cross
        );
        h.warden.velocity.set(0, 0, 0);
        // Face +Z or +X, the direction the flight ascends.
        h.warden.yaw = alongZ ? Math.PI : -Math.PI / 2;

        intent.forward = 1;
        intent.sprint = false;
        intent.ads = false;

        let reached = false;
        for (let i = 0; i < 900; i++) {
          h.warden.step(dt, intent);
          if (h.warden.feetY >= stair.topY - 0.2) {
            reached = true;
            break;
          }
        }
        const clear = h.map.collision.isClear(h.warden.position, h.warden.half);
        if (!reached || !clear) failures++;
        results.push(`${stair.tag}: reached=${reached} feetY=${h.warden.feetY.toFixed(2)}/${stair.topY.toFixed(2)} clear=${clear}`);
      }

      h.warden.reset(h.map.wardenSpawns[0]);

      // Rise must clear both actors' step-up, or one of them cannot use it.
      const riseOk =
        CONFIG.map.stairRise < CONFIG.warden.stepHeight && CONFIG.map.stairRise < CONFIG.shade.stepHeight;
      if (!riseOk) failures++;

      return {
        pass: failures === 0 && h.map.staircases.length >= 2,
        detail: `${h.map.staircases.length} staircases, step rise ${CONFIG.map.stairRise.toFixed(3)}m under both step-ups (shade ${CONFIG.shade.stepHeight}, warden ${CONFIG.warden.stepHeight})=${riseOk}; ${results.join('; ')}`,
      };
    },
  });
}
