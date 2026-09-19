/**
 * BLACKLINE - tests/aisoak.js
 *
 * AUTO suite (Section 16, Section 17.1): the Warden AI at match length, on
 * whatever map the page is on (D5).
 *
 * Every other AI check asks one question in one place: a path between two
 * nodes, a patrol for sixty seconds, one plant at site A. This one plays
 * three matches the way a match is played - the Warden live and
 * unmodified from a spawn, patrolling until the Shade plants, defending
 * whichever site it is, hanging its camera on the way, kneeling, defusing
 * - and requires that nothing stalls: every round ends the way it was set
 * up to end, on the sim clock, with the Warden's feet on its own ground
 * every step and the stuck detector quiet. The sites rotate so all three
 * are defended from wherever the patrol left the Warden, and every round
 * starts from a different spawn. The yard is the first map whose lanes
 * are containers and whose sites are bays walled on three sides, and "the
 * AI reaches site A on the plant" said nothing about it.
 *
 * Registered from tests/index.js. Checks reach the live game through the
 * harness `h`; nothing here imports main.js, which Section 3.1 forbids.
 */

import { CONFIG } from '../config.js';
import { AI_STATE } from '../systems/ai.js';
import { CHARGE, ROUND } from '../systems/objective.js';
import { plantAt } from './plantspots.js';
import { onGround } from './wardenground.js';

const R = CONFIG.round;
/** Matches played, and the most rounds one may run to. */
const MATCHES = 3;
const ROUND_CAP = 5;
/** Seconds of patrol before the plant, per round of a match: the Warden is somewhere else each time. */
const PATROL_SECONDS = [6, 10, 14, 8, 12];
/** The seed the first match is played from; each round of each match draws its own. */
const SEED = 0xd5a1;
/**
 * The most stuck re-paths (Section 11: 0.3m in 2s while meaning to move) the
 * whole soak may take. A re-path is the recovery, not the stall - the patrol
 * check allows four in a minute - but a Warden that needs one every round
 * is wedging on the map, and this is where it shows.
 */
const STUCK_CAP = MATCHES;

/** The Shade spawn farthest from a site: out of the Warden's way, and its sight, while it defuses. */
function hideout(h, site) {
  return h.map.shadeSpawns.reduce((far, spawn) => (
    spawn.position.distanceTo(site.position) > far.position.distanceTo(site.position) ? spawn : far
  ), h.map.shadeSpawns[0]);
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-warden-plays-three-matches-on-this-map-without-a-stall',
    spec: 'Section 11 / Section 10 / D5',
    name: 'Three matches, every site defended from wherever the patrol was: every round defused on the clock, the Warden on its ground throughout',
    run: (h) => {
      const problems = [];
      const dt = CONFIG.time.fixedDt;
      const ground = h.map.wardenGround;
      if (!ground) return { pass: false, detail: 'map.wardenGround was never derived' };
      const sites = h.map.sites;
      const spawns = h.map.wardenSpawns;

      let stuck = 0;
      let alarms = 0;
      // Every re-path: the state, how far from the charge, how far into a
      // defuse. The first run's twelve were all DEFEND, under a metre from
      // the charge, mid-defuse - the detector reading a kneeling Warden as
      // wedged (fixed in `_meansToMove`, ainav.js).
      const stuckWhere = [];
      let chargeNow = null;
      const offs = [
        h.emitter.on('ai:stuck', (e) => {
          stuck++;
          const d = chargeNow ? Math.hypot(e.at.x - chargeNow.x, e.at.z - chargeNow.z) : NaN;
          stuckWhere.push(`${h.wardenAI.state} ${d.toFixed(1)}m from the charge, defuse ${h.objective.round.defuseProgress.toFixed(1)}s`);
        }),
        h.emitter.on('gadget:alarm-placed', () => { alarms++; }),
      ];

      const at = { x: 0, y: 0, z: 0 };
      let off = 0;
      let steps = 0;
      const states = new Set();
      // One fixed step, watched: the Warden's feet against its ground.
      const watch = (label) => {
        h.stepFrames(1);
        steps++;
        states.add(h.wardenAI.state);
        at.x = h.warden.position.x;
        at.y = h.warden.feetY;
        at.z = h.warden.position.z;
        if (!onGround(ground, at, h.warden.grounded)) {
          if (off < 3) {
            problems.push(`${label} (${h.wardenAI.state}): the Warden's feet are off its ground at `
              + `(${at.x.toFixed(2)}, ${at.y.toFixed(2)}, ${at.z.toFixed(2)}), grounded=${h.warden.grounded}`);
          }
          off++;
        }
      };

      const rounds = [];
      const scores = [];
      for (let m = 0; m < MATCHES; m++) {
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true, seed: SEED + m * 16 });
        h.menu.hide();
        h.input.clearAll();
        const objective = h.objective;
        objective.resetMatch();

        let n = 1;
        while (!objective.matchOver && n <= ROUND_CAP) {
          // The way the intermission starts a round (Section 15: every
          // actor rebuilt), from a different spawn each time.
          if (n > 1) {
            h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true, seed: SEED + m * 16 + n, round: n });
            h.menu.hide();
          }
          const spawn = spawns[(m + n - 1) % spawns.length];
          h.warden.reset(spawn);
          h.wardenAI.reset();
          const label = `match ${m + 1} round ${n}`;
          const alarmsBefore = alarms;
          const stuckBefore = stuck;

          // Patrol, the Shade parked at its spawn.
          const patrol = Math.round(PATROL_SECONDS[(n - 1) % PATROL_SECONDS.length] / dt);
          for (let i = 0; i < patrol; i++) watch(`${label}, patrol step ${i}`);

          // The plant, at the round's site, and the Shade gone.
          const site = sites[(m + n - 1) % sites.length];
          plantAt(h, site.id);
          if (objective.round.charge !== CHARGE.PLANTED) {
            problems.push(`${label}: the charge never planted at ${site.id}`);
            break;
          }
          h.shade.reset(hideout(h, site));
          h.input.clearAll();
          const charge = objective.round.chargeAt;
          chargeNow = charge;
          const distanceTo = () => Math.hypot(h.warden.position.x - charge.x, h.warden.position.z - charge.z);
          const from = distanceTo();
          if (h.wardenAI.state !== AI_STATE.DEFEND) {
            problems.push(`${label}: the plant left the AI in ${h.wardenAI.state}, want defend`);
          }

          // The defence, on the detonation clock.
          let closest = from;
          let engaged = false;
          let took = 0;
          const limit = Math.round((R.detonationTime + 2) / dt);
          for (let i = 0; i < limit && objective.round.state === ROUND.ACTIVE; i++) {
            watch(`${label}, defend step ${i}`);
            took = (i + 1) * dt;
            closest = Math.min(closest, distanceTo());
            if (h.wardenAI.state === AI_STATE.ENGAGE) engaged = true;
          }

          const round = objective.round;
          if (round.state !== ROUND.ENDED) {
            problems.push(`${label}: the round did not end in ${(limit * dt).toFixed(0)}s (charge ${round.charge}, `
              + `the Warden ${distanceTo().toFixed(1)}m from it in ${h.wardenAI.state}, closest ${closest.toFixed(1)}m)`);
          } else if (round.charge !== CHARGE.DEFUSED || round.winner !== 'warden') {
            problems.push(`${label}: ended ${round.charge}, ${round.winner} wins, ${round.reason} - `
              + `from ${from.toFixed(1)}m the Warden got within ${closest.toFixed(1)}m`);
          }
          if (engaged) problems.push(`${label}: the Warden engaged the Shade hidden at ${hideout(h, site).name || 'its spawn'}`);
          rounds.push({
            label, site: site.id, spawn: spawn.name, from, took,
            alarms: alarms - alarmsBefore, stuck: stuck - stuckBefore,
            outcome: round.charge,
          });
          n++;
        }
        if (!objective.matchOver) problems.push(`match ${m + 1} was not over after ${n - 1} rounds`);
        scores.push(`${objective.score.warden}-${objective.score.shade}`);
      }

      for (const unsubscribe of offs) unsubscribe();
      h.objective.resetMatch();
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });

      if (off) problems.push(`${off} of ${steps} steps had the Warden off its ground`);
      if (stuck > STUCK_CAP) problems.push(`${stuck} stuck re-paths over ${rounds.length} rounds, the cap is ${STUCK_CAP}`);
      // Section 9.2: one camera a round, and DEFEND is where it is spent.
      // Every match must have hung at least one; a map whose walls are
      // never in reach on the way to a charge would show here.
      for (let m = 0; m < MATCHES; m++) {
        const hung = rounds.filter((r) => r.label.startsWith(`match ${m + 1} `)).reduce((sum, r) => sum + r.alarms, 0);
        if (!hung) problems.push(`match ${m + 1}: the Warden never hung its camera`);
      }

      // The runner keeps 400 characters of a detail line; the rounds go to
      // the F4 log as well.
      const played = rounds.map((r) => (
        `${r.site}<${r.spawn} ${r.from.toFixed(0)}m/${r.took.toFixed(1)}s${r.alarms ? '' : ' no cam'}${r.stuck ? ` stuck${r.stuck}` : ''}`
      )).join(', ');
      for (const r of rounds) {
        debugTools.logResult(`${r.label}: ${r.site} from ${r.spawn}, ${r.from.toFixed(1)}m at the plant, ${r.outcome} in ${r.took.toFixed(1)}s, ${r.alarms} camera, ${r.stuck} stuck`);
      }
      for (const where of stuckWhere) debugTools.logResult(`stuck: ${where}`);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${MATCHES} matches ${scores.join(' ')}, ${rounds.length} rounds all defused, ${steps} steps on the ground, `
            + `${alarms} cameras hung, ${stuck} stuck re-paths, states [${[...states].join(' ')}]; `
            + `site<spawn distance/time: ${played}`
          : `${problems.join('; ')} - ${played}${stuckWhere.length ? ` - stuck: ${stuckWhere.join('; ')}` : ''}`,
      };
    },
  });
}
