/**
 * BLACKLINE - tests/defusestart.js
 *
 * AUTO suite (J13): a defuse that begins raises one event.
 *
 * `defuseProgress` is a field the HUD reads each frame, and a field cannot be
 * a feed line without the feed polling it. `objective:defuse-start` is raised
 * as the progress leaves 0, so this drives the two ways that can go wrong: an
 * event per frame of kneeling, and an event per kneel instead of per attempt.
 * An attempt is a run of progress that starts from nothing; the retain window
 * (Section 10.1) is what keeps a pulled-off Warden on the same one.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { CHARGE, withinDefuseReach } from '../systems/objective.js';
import { spotOffTheRing } from './plantspots.js';

const R = CONFIG.round;
const W = CONFIG.warden;

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-defuse-raises-one-event-when-it-begins-and-not-once-a-frame',
    maps: ['plant', 'yard'],
    spec: 'Section 10.1 / Block J13',
    name: 'objective:defuse-start fires once as progress leaves 0 with the site and the charge, again only after the progress has decayed away, and not when the Warden kneels again inside the retain window',
    run: (h) => {
      const problems = [];
      const dt = CONFIG.time.fixedDt;
      h.initMatch({ mode: 'competitive', role: 'shade', ai: false, objective: true });
      h.menu.hide();
      const objective = h.objective;
      const collision = h.map.collision;
      const site = h.map.sites.find((entry) => entry.room);
      if (!site) return { pass: false, detail: 'this map has no site with a room to stage a charge in' };
      const spot = spotOffTheRing(h, site, R.siteRadius * 3);

      const events = [];
      const off = h.emitter.on('objective:defuse-start', (event) => events.push({ site: event.site, at: { ...event.at } }));
      const standAt = (cell) => {
        h.warden.position.set(cell.x, cell.y + W.standHeight / 2 + 0.02, cell.z);
        h.warden.velocity.set(0, 0, 0);
      };
      const footOf = () => ({ x: h.warden.position.x, y: h.warden.feetY, z: h.warden.position.z });
      const second = Math.round(1 / dt);
      // A charge where a plant leaves it and the Warden beside it. No AI, so
      // nothing but the reach says whether the defuse goes.
      const stage = () => {
        objective.resetRound(1);
        events.length = 0;
        h.shade.reset(h.map.shadeSpawns[0]);
        h.warden.reset(h.map.wardenSpawns[0]);
        standAt(spot);
        const round = objective.round;
        round.charge = CHARGE.PLANTED;
        round.site = site.id;
        round.chargeAt = { x: spot.x, y: spot.y, z: spot.z };
        round.detonationTimer = R.detonationTime;
        return round;
      };
      const kneel = (round, seconds) => {
        for (let i = 0; i < Math.round(seconds * second); i++) h.stepFrames(1);
        return round.defuseProgress;
      };

      try {
        // (a) and (b): once, not per frame, and what it says.
        let round = stage();
        if (!withinDefuseReach(footOf(), round.chargeAt, collision)) {
          return { pass: false, detail: `the Warden stood beside the charge at ${site.id} is not within reach of it: the staging is wrong` };
        }
        const frames = 2 * second;
        const reached = kneel(round, 2);
        if (!(reached > 1)) problems.push(`only ${reached.toFixed(2)}s of defuse progress in ${frames} frames: no attempt to count events against`);
        if (events.length !== 1) problems.push(`${events.length} defuse-start events in ${frames} frames of one kneel, wanted exactly 1`);
        const first = events[0];
        if (first) {
          const at = round.chargeAt;
          if (first.site !== round.site || first.site !== site.id) problems.push(`the event named site ${first.site}, the charge is at ${site.id}`);
          if (Math.hypot(first.at.x - at.x, first.at.y - at.y, first.at.z - at.z) > 0.01) {
            problems.push(`the event's charge position (${first.at.x.toFixed(2)}, ${first.at.y.toFixed(2)}, ${first.at.z.toFixed(2)}) is not round.chargeAt (${at.x.toFixed(2)}, ${at.y.toFixed(2)}, ${at.z.toFixed(2)})`);
          }
        }

        // (c): a real interruption ends the attempt, and the next kneel is new.
        h.warden.reset(h.map.wardenSpawns[0]);
        if (withinDefuseReach(footOf(), round.chargeAt, collision)) {
          problems.push('the Warden spawn is within reach of the charge, so the interruption is not one');
        }
        let decayFrames = 0;
        while (round.defuseProgress > 0 && decayFrames < 40 * second) { h.stepFrames(1); decayFrames++; }
        if (round.defuseProgress > 0) problems.push(`defuse progress was still ${round.defuseProgress.toFixed(2)}s after 40s out of reach: it never decayed to 0`);
        if (events.length !== 1) problems.push(`${events.length} events by the time progress had decayed, wanted still 1: decaying is not beginning`);
        standAt(spot);
        kneel(round, 0.5);
        if (events.length !== 2) problems.push(`${events.length} events after kneeling again from 0, wanted 2: a new attempt raises its own`);

        // (d): inside the retain window it is the same attempt.
        round = stage();
        kneel(round, 2);
        h.warden.reset(h.map.wardenSpawns[0]);
        const away = 2;
        const held = kneel(round, away);
        if (!(held > 0)) problems.push('progress reached 0 inside the retain window: the interruption was not inside it');
        standAt(spot);
        const resumed = kneel(round, 1);
        if (!(resumed > held)) problems.push(`progress did not carry on after the Warden came back (${held.toFixed(2)}s then ${resumed.toFixed(2)}s)`);
        if (events.length !== 1) problems.push(`${events.length} events across an interruption of ${away}s inside the ${R.defuseRetainTime}s retain window, wanted 1: the same attempt raises no second`);

        return {
          pass: problems.length === 0,
          detail: problems.length === 0
            ? `at ${site.id}: 1 event in ${frames} frames while progress went 0 to ${reached.toFixed(2)}s, carrying the site and the charge; `
              + `a second only after ${(decayFrames / second).toFixed(1)}s out of reach had decayed it to 0; `
              + `none for a ${away}s interruption inside the ${R.defuseRetainTime}s retain window`
            : problems.join('; '),
        };
      } finally {
        off();
        objective.resetMatch();
        objective.resetRound(1);
        h.shade.reset(h.map.shadeSpawns[0]);
        h.warden.reset(h.map.wardenSpawns[0]);
      }
    },
  });
}
