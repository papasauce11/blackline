/**
 * BLACKLINE - tests/readability.js
 *
 * AUTO suite: Section 16 check 26.
 *
 * "Every vaultable, mantle-able, and hang-able ledge on the map is visibly
 * marked. Walk the map and confirm no unmarked usable ledge exists."
 *
 * `climbable-surfaces-are-derived-not-hand-flagged` already proves the
 * derivation is self-consistent — the flag and the stripe come from one pass,
 * so they cannot disagree. What that cannot prove is the thing a human walking
 * the map would actually notice: **whether the stripe you see is the move you
 * get**.
 *
 * The marking's band is computed once per box, from whatever surface
 * `_supportHeightBelow()` decides you would climb from. The controller's band
 * is computed at run time from where your feet actually are. A box reachable
 * from two heights can therefore wear a vault stripe and perform a mantle, and
 * nothing in the suite would have caught it.
 *
 * So this walks up to every climbable face on the map, stands where a player
 * would stand, runs the controller's own `_probeLedge()`, and compares the band
 * it returns against the band the map painted on.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';

const S = CONFIG.shade;
/** The widest the controller ever reaches for a ledge. */
const REACH = Math.max(S.vaultReach, S.mantleReach, S.hangReach);

/** The four horizontal faces of a box, as outward normals. */
const FACES = [
  { nx: 1, nz: 0 },
  { nx: -1, nz: 0 },
  { nx: 0, nz: 1 },
  { nx: 0, nz: -1 },
];

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'every-reachable-ledge-is-marked-with-the-move-it-gives',
    spec: 'Section 5 / check 26',
    name: 'Walk up to every climbable face: the stripe you see is the move you get',
    run: (h) => {
      const problems = [];
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      const shade = h.shade;
      const collision = h.map.collision;

      const climbable = collision.boxes.filter((box) => box.climbable);
      const half = { x: S.radius, y: S.standHeight / 2, z: S.radius };

      let approaches = 0;
      let probesReturned = 0;
      const reached = new Set();
      const unmarked = [];
      const mismatched = [];
      /** Ledges with more than one real band. Reported, not failed. */
      const ambiguous = new Set();
      const bandsSeen = { vault: 0, mantle: 0, hang: 0 };

      for (const box of climbable) {
        for (const face of FACES) {
          // Three stands along the face, so a long ledge is not judged by its
          // midpoint alone.
          for (let i = 1; i <= 3; i++) {
            const t = i / 4;
            const along = {
              x: face.nx !== 0 ? (face.nx > 0 ? box.max.x : box.min.x) : box.min.x + (box.max.x - box.min.x) * t,
              z: face.nz !== 0 ? (face.nz > 0 ? box.max.z : box.min.z) : box.min.z + (box.max.z - box.min.z) * t,
            };
            const stand = {
              x: along.x + face.nx * (S.radius + 0.3),
              z: along.z + face.nz * (S.radius + 0.3),
            };

            // What would you be standing on here? Drop a ray from the top of
            // the box; anything below that is a floor a player could occupy.
            const down = collision.raycast(
              { x: stand.x, y: box.max.y + 0.6, z: stand.z },
              { x: 0, y: -1, z: 0 },
              S.hangBand ? 60 : 60
            );
            if (!down) continue;
            const feet = down.y;
            const centre = { x: stand.x, y: feet + half.y + 0.02, z: stand.z };
            if (!collision.isClear(centre, half)) continue;

            approaches++;
            shade.reset({
              position: { x: stand.x, y: feet, z: stand.z },
              // Shade forward is (-sin yaw, -cos yaw); face into the box.
              yaw: Math.atan2(face.nx, face.nz),
            });
            const ledge = shade._probeLedge(REACH);
            if (!ledge || ledge.box !== box) continue;

            probesReturned++;
            reached.add(box);
            bandsSeen[ledge.band] = (bandsSeen[ledge.band] || 0) + 1;

            // Two different faults, and only one of them is the map's.
            //
            // Unmarked, or marked with a band this ledge never gives from any
            // height, is a bug: the player is told something untrue.
            //
            // Marked with a band it gives from a DIFFERENT height is not. A box
            // reachable from two floors has two bands and one stripe; the map
            // names the designed approach. Those are collected by name so they
            // are visible rather than silently accepted.
            const real = h.map.ledgeBandsFor(box);
            if (!box.ledgeBand) {
              unmarked.push(`${box.tag || 'box'} climbs as ${ledge.band} and carries no marking`);
            } else if (real.indexOf(box.ledgeBand) === -1) {
              mismatched.push(
                `${box.tag || 'box'} is marked ${box.ledgeBand}, which it gives from nowhere `
                + `(real bands: ${real.join('/') || 'none'})`
              );
            } else if (box.ledgeBand !== ledge.band) {
              ambiguous.add(
                `${box.tag || 'box'} marked ${box.ledgeBand}, also climbs as ${ledge.band} from y=${feet.toFixed(2)}`
              );
            }
          }
        }
      }

      // Deduplicate: a long ledge reports the same fault from every stand.
      const uniqueUnmarked = [...new Set(unmarked)];
      const uniqueMismatched = [...new Set(mismatched)];
      if (uniqueUnmarked.length) {
        problems.push(`${uniqueUnmarked.length} unmarked: ${uniqueUnmarked.slice(0, 3).join('; ')}`);
      }
      if (uniqueMismatched.length) {
        problems.push(`${uniqueMismatched.length} mis-marked: ${uniqueMismatched.slice(0, 3).join('; ')}`);
      }
      // Not a failure, but the player-facing consequence of a one-stripe-per-box
      // scheme, so it is named rather than swallowed.
      if (ambiguous.size) debugTools.logResult(`ledges climbable from two floors: ${[...ambiguous].join(' | ')}`);
      if (probesReturned === 0) problems.push('the sweep never reached a single ledge — it is testing nothing');

      // Every marked band the map claims to have must actually be walk-up-able
      // somewhere, or the marking is decoration on something unreachable.
      const markedBands = new Set(climbable.map((box) => box.ledgeBand).filter(Boolean));
      for (const band of markedBands) {
        if (!bandsSeen[band]) problems.push(`the map marks ${band} ledges but the sweep could not reach one`);
      }

      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `walked up to ${approaches} standing positions around ${climbable.length} climbable boxes; `
            + `the controller's own probe caught ${reached.size} of them (${probesReturned} approaches) as `
            + `vault ${bandsSeen.vault} / mantle ${bandsSeen.mantle} / hang ${bandsSeen.hang}; `
            + 'every one carried a marking naming a move it really gives'
            + (ambiguous.size
              ? `; ${ambiguous.size} ledge${ambiguous.size === 1 ? ' is' : 's are'} climbable from two floors `
                + 'and can only advertise one'
              : '')
          : problems.join('; '),
      };
    },
  });
}
