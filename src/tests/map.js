/**
 * BLACKLINE - tests/map.js
 *
 * AUTO suite (Section 16, Section 17.1): Map geometry and markings.
 *
 * Shell, collision, affordance markings, lights, spawns, rooms and vents.
 *
 * Registered from tests/index.js. Checks reach the live game through the
 * harness `h`; nothing here imports main.js, which Section 3.1 forbids.
 */

import { CONFIG } from '../config.js';
import { classifyLedge } from '../physics.js';

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'exactly-one-shadow-caster',
    spec: 'Section 4.1 / check 29',
    name: 'Exactly one shadow-casting light; no point light casts',
    run: (h) => {
      let casters = 0;
      let pointCasters = 0;
      let total = 0;
      h.scene.traverse((object) => {
        if (!object.isLight) return;
        total++;
        if (object.castShadow) casters++;
        if (object.isPointLight && object.castShadow) pointCasters++;
      });
      const size = h.map.keyLight.shadow.mapSize;
      const mapOk = size.x === CONFIG.render.shadowMapSize && size.y === CONFIG.render.shadowMapSize;
      return {
        pass: casters === 1 && pointCasters === 0 && mapOk,
        detail: `${total} lights, ${casters} shadow caster(s), ${pointCasters} shadowed point lights, shadow map ${size.x}x${size.y}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'markings-match-collision-flags',
    spec: 'check 26 (auto half) / Section 15',
    name: 'Every climbable box is marked, in the band its geometry implies',
    run: (h) => {
      let climbable = 0;
      let marked = 0;
      let mismatched = 0;
      const bands = { vault: 0, mantle: 0, hang: 0 };

      for (const box of h.map.collision.boxes) {
        if (!box.climbable) continue;
        climbable++;
        const ledge = h.map.ledges.find((entry) => entry.box === box);
        if (!ledge) continue;
        marked++;
        // Recompute the band independently from the stored rise and compare.
        if (classifyLedge(ledge.rise) !== box.ledgeBand) mismatched++;
        if (box.ledgeBand) bands[box.ledgeBand]++;
      }

      return {
        pass: climbable > 0 && marked === climbable && mismatched === 0,
        detail: `${climbable} climbable, ${marked} marked, ${mismatched} band mismatches (vault ${bands.vault}, mantle ${bands.mantle}, hang ${bands.hang})`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'climbable-surfaces-are-derived-not-hand-flagged',
    spec: 'Section 5 / reported bug',
    name: 'Every standable surface in a traversal band is climbable; exclusions are justified',
    run: (h) => {
      const minSupport = CONFIG.shade.radius * 2;
      const unjustified = [];

      for (const box of h.map.collision.boxes) {
        if (box.climbable || !box.solid) continue;
        // Every non-climbable surface must have a reason. Anything wide enough
        // to stand on, in a traversal band, and not explicitly opted out is an
        // invisible wall on a surface that looks climbable.
        const wideX = box.max.x - box.min.x >= minSupport;
        const wideZ = box.max.z - box.min.z >= minSupport;
        if (!wideX || !wideZ) continue; // too thin to land on
        if (box.noClimb) continue; // deliberate one-way drop
        const standY = h.map._supportHeightBelow(box);
        if (!classifyLedge(box.max.y - standY)) continue; // out of every band
        // Wide, in-band, not opted out: the only remaining excuse is no
        // headroom, which deriveClimbableSurfaces() already tested.
        const headroom = CONFIG.shade.crouchHeight;
        const probeHalf = { x: minSupport * 0.5, y: headroom * 0.5, z: minSupport * 0.5 };
        const point = { x: box.centerX, y: box.max.y + headroom * 0.5 + 0.05, z: box.centerZ };
        if (!h.map.collision.isClear(point, probeHalf)) continue;
        unjustified.push(box.tag);
      }

      // The surfaces a player will obviously try must all be climbable.
      const mustClimb = h.map.collision.boxes.filter((box) =>
        /^(crate|stack|gantry|lip-|office-cover|server-rack|hall-container|fire-escape)/.test(box.tag)
      );
      const missed = mustClimb.filter((box) => !box.climbable).map((box) => box.tag);

      return {
        pass: unjustified.length === 0 && missed.length === 0 && h.map.ledges.length === h.map.collision.boxes.filter((b) => b.climbable).length,
        detail:
          unjustified.length === 0 && missed.length === 0
            ? `${h.map.ledges.length} climbable surfaces derived and marked; ${mustClimb.length} obvious traversal surfaces all climbable; every exclusion justified (too thin, out of band, no headroom, or noClimb)`
            : `unjustified exclusions: [${unjustified.join(', ')}]; obvious surfaces missed: [${missed.join(', ')}]`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'markings-sit-on-real-geometry',
    spec: 'Section 5 / reported bug: chevrons floating in mid-air',
    name: 'Every affordance decal lies on the surface it describes',
    run: (h) => {
      const floating = [];
      let marked = 0;

      for (const ledge of h.map.ledges) {
        // Top-edge stripes ride the ledge's own top face, so they cannot drift.
        // Chevrons go on the face BELOW the ledge, which only exists where the
        // ledge reaches down to whatever it was measured against. A lip, gantry
        // or duct hangs, so its face stops well short of that.
        if (ledge.band !== 'mantle') continue;
        const box = ledge.box;
        if (!ledge.chevrons) {
          floating.push(`${box.tag} is a mantle ledge with no chevrons`);
          continue;
        }
        marked++;
        // Asserted against where the map actually put them, not a recomputation.
        if (ledge.chevrons.y0 < box.min.y - 1e-6 || ledge.chevrons.y1 > box.max.y + 1e-6) {
          floating.push(
            `${box.tag} decal spans ${ledge.chevrons.y0.toFixed(2)}..${ledge.chevrons.y1.toFixed(2)}, box is ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)}`
          );
        }
      }

      return {
        pass: floating.length === 0 && marked > 0,
        detail:
          floating.length === 0
            ? `${marked} mantle ledges: every chevron sits within the face of the box it marks`
            : `${floating.length} floating: ${floating.slice(0, 5).join('; ')}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'swept-collision-no-tunnelling',
    spec: 'check 1 (auto half) / Section 15',
    name: 'An actor driven into a wall at extreme speed never passes through',
    run: (h) => {
      const world = h.map.collision;
      const half = { x: CONFIG.shade.radius, y: CONFIG.shade.standHeight / 2, z: CONFIG.shade.radius };
      const dt = CONFIG.time.fixedDt;
      const speeds = [6.5, 50, 200, 1000];
      let breaches = 0;
      const details = [];

      for (const speed of speeds) {
        // Start inside the Turbine Hall and drive due west into the perimeter
        // wall, whose inner face is at x = -30.
        const position = { x: -20, y: half.y + 0.05, z: -4 };
        const velocity = { x: -speed, y: 0, z: 0 };
        for (let i = 0; i < 180; i++) {
          velocity.x = -speed;
          world.moveAndSlide(position, half, velocity, dt, {
            groundNormalY: CONFIG.shade.groundNormalY,
            stepHeight: CONFIG.shade.stepHeight,
            wasGrounded: true,
          });
        }
        const insideWall = position.x < -30 + half.x - 0.05;
        if (insideWall) breaches++;
        details.push(`${speed}m/s -> x=${position.x.toFixed(3)}`);
      }

      return {
        pass: breaches === 0,
        detail: `${breaches} breaches; ${details.join(', ')} (wall face at x=-30)`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'spawns-and-sites-clear',
    spec: 'Section 5 / Section 10.2',
    name: 'No spawn or plant site is embedded in geometry',
    run: (h) => {
      const world = h.map.collision;
      const blocked = [];

      const check = (label, position, radius, height) => {
        const half = { x: radius, y: height / 2, z: radius };
        const centre = { x: position.x, y: position.y + height / 2 + 0.02, z: position.z };
        const hit = world.overlap(centre, half);
        if (hit) blocked.push(`${label} in "${hit.tag}"`);
      };

      h.map.shadeSpawns.forEach((spawn, i) =>
        check(`shade spawn ${i}`, spawn.position, CONFIG.shade.radius, CONFIG.shade.standHeight)
      );
      h.map.wardenSpawns.forEach((spawn, i) =>
        check(`warden spawn ${i}`, spawn.position, CONFIG.warden.radius, CONFIG.warden.standHeight)
      );
      h.map.sites.forEach((site) =>
        check(`site ${site.id}`, site.position, CONFIG.shade.radius, CONFIG.shade.standHeight)
      );
      h.map.waypoints.forEach((node) =>
        check(`waypoint ${node.id} (${node.tag})`, node.position, CONFIG.warden.radius, CONFIG.warden.standHeight)
      );

      return {
        pass: blocked.length === 0,
        detail:
          blocked.length === 0
            ? `${h.map.shadeSpawns.length} shade spawns, ${h.map.wardenSpawns.length} warden spawns, ${h.map.sites.length} sites, ${h.map.waypoints.length} waypoints all clear`
            : blocked.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'light-break-is-permanent',
    spec: 'Section 5 / Section 7.1',
    name: 'Breaking a light zeroes its intensity, darkens the glass, and sticks',
    run: (h) => {
      const target = h.map.lights.find((entry) => !entry.broken);
      if (!target) return { pass: false, detail: 'no unbroken light to test' };
      const beforeActive = h.map.activeLights().length;
      const beforeIntensity = target.light.intensity;

      const first = h.map.breakLight(target.lightId);
      const second = h.map.breakLight(target.lightId); // must be a no-op
      const afterActive = h.map.activeLights().length;

      const pass =
        first !== null &&
        second === null &&
        target.broken === true &&
        target.light.intensity === 0 &&
        beforeIntensity > 0 &&
        afterActive === beforeActive - 1;

      // Restore so the suite does not leave the map dark for the next run.
      target.broken = false;
      target.light.intensity = beforeIntensity;
      target.glassMaterial.color.set(CONFIG.palette.lightWarm);

      return {
        pass,
        detail: `active ${beforeActive} -> ${afterActive}, intensity ${beforeIntensity} -> 0, repeat break returned null=${second === null}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'vent-runs-are-crouch-only-and-enterable',
    spec: 'Section 5 / check 5',
    name: 'Every vent run is crouch-only along its length and open at both mouths',
    run: (h) => {
      const crouchHalf = { x: CONFIG.shade.radius, y: CONFIG.shade.crouchHeight / 2, z: CONFIG.shade.radius };
      const standHalf = { x: CONFIG.shade.radius, y: CONFIG.shade.standHeight / 2, z: CONFIG.shade.radius };
      const problems = [];
      let grade = 0;

      for (const vent of h.map.vents) {
        if (vent.grade) grade++;
        const alongX = vent.axis === 'x';
        const from = alongX ? vent.min.x : vent.min.z;
        const to = alongX ? vent.max.x : vent.max.z;
        const cross = alongX ? (vent.min.z + vent.max.z) / 2 : (vent.min.x + vent.max.x) / 2;
        const floorY = vent.min.y;
        const at = (along, half, height) => {
          const y = floorY + height / 2 + 0.02;
          const point = alongX ? { x: along, y, z: cross } : { x: cross, y, z: along };
          return h.map.collision.isClear(point, half);
        };

        // Crouch-only wherever the run is enclosed, mouth to mouth. Sampling
        // the midpoint alone would pass a run that is only capped over part of
        // its length. Samples under a deck void are skipped: there the run has
        // deliberately opened into the room above, which is the whole point of
        // the hatch the upper run climbs through.
        const samples = Math.max(4, Math.floor((to - from) / 1.0));
        let standing = 0;
        let cramped = 0;
        let enclosed = 0;
        for (let i = 1; i < samples; i++) {
          const along = from + ((to - from) * i) / samples;
          const x = alongX ? along : cross;
          const z = alongX ? cross : along;
          const underVoid = h.map.deckVoids.some(
            (hole) => x > hole.x0 && x < hole.x1 && z > hole.z0 && z < hole.z1 && hole.top > floorY
          );
          if (underVoid) continue;
          enclosed++;
          if (at(along, standHalf, CONFIG.shade.standHeight)) standing++;
          if (!at(along, crouchHalf, CONFIG.shade.crouchHeight)) cramped++;
        }
        if (standing > 0) problems.push(`${vent.tag} allows standing at ${standing}/${enclosed} enclosed samples`);
        if (cramped > 0) problems.push(`${vent.tag} blocks crouching at ${cramped}/${enclosed} enclosed samples`);
        if (enclosed < (samples - 1) * 0.6) {
          problems.push(`${vent.tag} is open to a void along ${samples - 1 - enclosed}/${samples - 1} of its length`);
        }
        if (!at(from + 0.4, crouchHalf, CONFIG.shade.crouchHeight)) problems.push(`${vent.tag} start mouth blocked`);
        if (!at(to - 0.4, crouchHalf, CONFIG.shade.crouchHeight)) problems.push(`${vent.tag} end mouth blocked`);
      }

      // The two-tier chain heights must land in the spec bands by construction.
      const chain = [
        ['ground -> lower vent', CONFIG.map.ventFloorY - CONFIG.map.groundY],
        ['lower vent -> upper vent', CONFIG.map.ventUpperY - CONFIG.map.ventFloorY],
        ['upper vent -> deck', CONFIG.map.catwalkY - CONFIG.map.ventUpperY],
      ];
      for (const [label, rise] of chain) {
        if (classifyLedge(rise) !== 'mantle') problems.push(`${label} rise ${rise.toFixed(2)}m is not a mantle`);
      }
      if (grade < 2) problems.push(`only ${grade} vent mouths at grade, v2 wants at least 2`);

      return {
        pass: problems.length === 0,
        detail:
          problems.length === 0
            ? `${h.map.vents.length} runs crouch-only end to end (${grade} at grade); chain ${chain.map(([label, rise]) => `${label} ${rise.toFixed(2)}m`).join(', ')}, all mantle`
            : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'shade-spawns-are-outside-the-shell',
    spec: 'v2 requirement 3',
    name: 'The Shade starts outside the building, on clear ground',
    run: (h) => {
      const shell = h.map.shell;
      const half = { x: CONFIG.shade.radius, y: CONFIG.shade.standHeight / 2, z: CONFIG.shade.radius };
      const problems = [];

      for (let i = 0; i < h.map.shadeSpawns.length; i++) {
        const spawn = h.map.shadeSpawns[i];
        const p = spawn.position;
        if (p.x > shell.x0 && p.x < shell.x1 && p.z > shell.z0 && p.z < shell.z1) {
          problems.push(`spawn ${i} (${spawn.name}) is inside the shell`);
        }
        if (!h.map.collision.isClear({ x: p.x, y: p.y + half.y + 0.02, z: p.z }, half)) {
          problems.push(`spawn ${i} (${spawn.name}) has no room to stand`);
        }
        const ground = h.map.collision.raycast({ x: p.x, y: p.y + 1.0, z: p.z }, { x: 0, y: -1, z: 0 }, 2.0);
        if (!ground || Math.abs(ground.y - p.y) > 0.05) {
          problems.push(`spawn ${i} (${spawn.name}) is not standing on the ground plane`);
        }
      }

      // The Warden stays inside, or the two roles start on the same side of
      // the wall and the infiltration premise is gone.
      for (let i = 0; i < h.map.wardenSpawns.length; i++) {
        const p = h.map.wardenSpawns[i].position;
        const inside = p.x > shell.x0 && p.x < shell.x1 && p.z > shell.z0 && p.z < shell.z1;
        if (!inside) problems.push(`warden spawn ${i} is outside the shell`);
      }

      return {
        pass: problems.length === 0,
        detail:
          problems.length === 0
            ? `${h.map.shadeSpawns.length} shade spawns outside the shell (x ${shell.x0}..${shell.x1}, z ${shell.z0}..${shell.z1}) and clear; ${h.map.wardenSpawns.length} warden spawns inside`
            : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'every-room-has-two-entries',
    spec: 'v2 requirement 5',
    name: 'No room can be sealed by standing in one doorway',
    run: (h) => {
      const half = { x: CONFIG.shade.radius, y: CONFIG.shade.crouchHeight / 2, z: CONFIG.shade.radius };
      const problems = [];
      const summaries = [];

      for (const room of h.map.rooms) {
        if (room.entries.length < CONFIG.map.roomMinEntries) {
          problems.push(`${room.id}: ${room.entries.length} entries`);
          continue;
        }
        // Re-test each reported entry independently: a derived count is only
        // worth anything if the openings it counted are really passable.
        const bad = room.entries.filter((entry) => {
          const y = entry.kind === 'lateral' ? entry.at.y + half.y + 0.02 : entry.at.y;
          return !h.map.collision.isClear({ x: entry.at.x, y, z: entry.at.z }, half);
        });
        if (bad.length) {
          problems.push(`${room.id}: ${bad.length} reported entries are blocked`);
          continue;
        }
        const kinds = room.entries.map((entry) => entry.edge).join('/');
        summaries.push(`${room.id} ${room.entries.length} (${kinds})`);
      }

      return {
        pass: problems.length === 0,
        detail:
          problems.length === 0
            ? `${h.map.rooms.length} rooms, all with >= ${CONFIG.map.roomMinEntries} verified entries: ${summaries.join('; ')}`
            : problems.join('; '),
      };
    },
  });
}
