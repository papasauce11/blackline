/**
 * BLACKLINE - tests/objective.js
 *
 * AUTO suite (Section 16, Section 17.1): Objective and round flow.
 *
 * Plant and detonation, defuse with its retained progress, lives and reinsert,
 * the time-extension milestones, and round state not bleeding.
 *
 * Registered from tests/index.js. Checks reach the live game through the
 * harness `h`; nothing here imports main.js, which Section 3.1 forbids.
 */

import { CONFIG } from '../config.js';
import { CHARGE, ROUND, createRoundState, DEFUSE_REACH } from '../systems/objective.js';
import { createIntent } from '../entities/agent.js';
import { PLANT_REFUSED } from '../ui/hud.js';

const R = CONFIG.round;

export function register(debugTools) {
  /**
   * Somewhere in a site's room that is NOT the ring: as far off it as the room
   * and the furniture allow, up to `want` metres.
   *
   * Section 10.1 as amended lets the plant happen anywhere in the room, and
   * every check here used to plant on the ring's centre pixel. That is the one
   * spot where "the charge" and "the site" are the same point, so the whole
   * file would have gone on passing with the charge tracked at the site centre
   * and the Warden defusing thin air ten metres from the bomb.
   */
  const spotOffTheRing = (h, site, want) => {
    const room = site.room;
    const margin = CONFIG.shade.radius + 0.5;
    const half = { x: CONFIG.shade.radius, y: CONFIG.shade.standHeight / 2, z: CONFIG.shade.radius };
    const centre = { x: site.position.x, y: site.position.y, z: site.position.z };
    if (!room) return centre;

    const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
    for (let out = want; out >= R.siteRadius + 1; out -= 1) {
      for (const dir of [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]) {
        const spot = {
          x: clamp(centre.x + dir.x * out, room.min.x + margin, room.max.x - margin),
          y: centre.y,
          z: clamp(centre.z + dir.z * out, room.min.z + margin, room.max.z - margin),
        };
        const away = Math.hypot(spot.x - centre.x, spot.z - centre.z);
        if (away < R.siteRadius + 1) continue;
        const feet = { x: spot.x, y: spot.y + half.y + 0.05, z: spot.z };
        if (h.map.collision.isClear(feet, half)) return spot;
      }
    }
    return centre;
  };

  /**
   * Every climbable top a standing body fits on inside a site's room, as a
   * foot position at its centre, with whether the plant rule allows a charge
   * there. Taken from the census's own ledge list, so a map rebuild that moves
   * a crate moves the checks that use this with it.
   */
  const perchesInSiteRooms = (h) => {
    const objective = h.objective;
    const half = { x: CONFIG.shade.radius, y: CONFIG.shade.standHeight / 2, z: CONFIG.shade.radius };
    const perches = [];
    for (const ledge of h.map.ledges) {
      const box = ledge.box;
      const foot = {
        x: (box.min.x + box.max.x) / 2,
        y: box.max.y + 0.02,
        z: (box.min.z + box.max.z) / 2,
      };
      const body = { x: foot.x, y: foot.y + half.y, z: foot.z };
      if (!h.map.collision.isClear(body, half)) continue;
      const site = objective.siteNear(body);
      if (!site) continue;
      perches.push({
        tag: box.tag || 'untagged',
        rise: ledge.rise,
        foot,
        body,
        site: site.id,
        legal: objective.canDefuseAt(foot),
      });
    }
    return perches;
  };

  /** Put the Shade in a site's room, off the ring, and hold interact. */
  const plantAt = (h, siteId) => {
    const objective = h.objective;
    const dt = CONFIG.time.fixedDt;
    const site = h.map.sites.find((entry) => entry.id === siteId);
    const spot = spotOffTheRing(h, site, R.siteRadius * 3);
    h.shade.reset(h.map.shadeSpawns[0]);
    h.shade.position.set(spot.x, spot.y + CONFIG.shade.standHeight / 2 + 0.05, spot.z);
    const intent = createIntent();
    intent.interact = true;
    let steps = 0;
    while (objective.round.charge === CHARGE.CARRIED && steps++ < 20 / dt) {
      objective.step(dt, { shade: h.shade, warden: h.warden, intent });
    }
    return steps * dt;
  };

  debugTools.registerAutoTest({
    id: 'the-ai-walks-to-the-charge-and-defuses-it',
    spec: 'Section 11 DEFEND / check 21',
    name: 'Plant it and leave: the Warden paths to the charge, defuses, and wins',
    run: (h) => {
      const problems = [];
      const dt = CONFIG.time.fixedDt;
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      const objective = h.objective;
      objective.resetMatch();
      objective.resetRound(1);

      // Plant at site A, then put the Shade far away and out of sight so the
      // Warden is free to kneel — Section 11 only defuses when it cannot see
      // you, which is the whole tension of the mechanic.
      plantAt(h, 'A');
      if (objective.round.charge !== CHARGE.PLANTED) {
        return { pass: false, detail: 'the charge never planted' };
      }
      const site = h.map.sites.find((entry) => entry.id === 'A');

      const hideout = h.map.shadeSpawns.reduce((far, spawn) => (
        spawn.position.distanceTo(site.position) > far.position.distanceTo(site.position) ? spawn : far
      ), h.map.shadeSpawns[0]);
      h.shade.reset(hideout);

      // Measured against where the charge actually IS, which since Section 10.1
      // was amended is wherever the Shade was standing, not the middle of the
      // room. A Warden that walks to the ring and kneels there has not found
      // the bomb.
      const at = objective.round.chargeAt;
      const offRing = Math.hypot(at.x - site.position.x, at.z - site.position.z);
      const distanceTo = (position) => Math.hypot(position.x - at.x, position.z - at.z);

      // The Warden starts wherever it was; DEFEND was set by the plant.
      const startedAt = h.warden.position.clone();
      const startDistance = distanceTo(startedAt);
      if (h.wardenAI.state !== 'defend') {
        problems.push(`the plant left the AI in ${h.wardenAI.state}, want defend`);
      }

      let steps = 0;
      let closest = startDistance;
      let sawDefuseProgress = false;
      const limit = Math.round((CONFIG.round.detonationTime - 1) / dt);
      while (objective.round.state === ROUND.ACTIVE && steps++ < limit) {
        h.stepFrames(1);
        closest = Math.min(closest, distanceTo(h.warden.position));
        if (objective.round.defuseProgress > 0) sawDefuseProgress = true;
      }
      const took = steps * dt;

      if (offRing < R.siteRadius) {
        problems.push(`the charge went down ${offRing.toFixed(1)}m from the site centre - too close to prove anything`);
      }
      if (closest > CONFIG.round.siteRadius) {
        problems.push(`the Warden got no closer than ${closest.toFixed(1)}m to the charge (needs ${CONFIG.round.siteRadius}m)`);
      }
      if (!sawDefuseProgress) problems.push('the Warden reached the charge but never started defusing');
      if (objective.round.charge !== CHARGE.DEFUSED) {
        problems.push(`the charge ended ${objective.round.charge}, not defused (after ${took.toFixed(1)}s)`);
      }
      if (objective.round.winner !== 'warden') {
        problems.push(`the round went to ${objective.round.winner}`);
      }
      if (objective.score.warden !== 1) problems.push(`the Warden scored ${objective.score.warden}`);

      objective.resetMatch();
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `planted at A but ${offRing.toFixed(1)}m off the ring, then hid: the Warden pathed `
            + `${startDistance.toFixed(1)}m to the charge, `
            + `held an ${CONFIG.round.defuseHoldTime}s defuse and won the round ${took.toFixed(1)}s after the plant, `
            + `with ${(CONFIG.round.detonationTime - took).toFixed(1)}s left on the detonation clock`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'defend-breaks-off-when-the-warden-is-attacked',
    spec: 'Section 11 DEFEND',
    name: 'Knifing a defusing Warden makes it stop and turn on you',
    run: (h) => {
      const problems = [];
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      const objective = h.objective;
      objective.resetMatch();
      objective.resetRound(1);

      plantAt(h, 'A');
      const site = h.map.sites.find((entry) => entry.id === 'A');
      if (h.wardenAI.state !== 'defend') {
        return { pass: false, detail: `the plant left the AI in ${h.wardenAI.state}` };
      }

      // Stand the Shade behind the Warden and swing. Section 8.2: the front and
      // side arc is 2 hits to kill, so one lands damage without ending it.
      h.warden.reset({ position: site.position, yaw: 0 });
      h.stepFrames(10);
      h.wardenAI._enter('defend');
      const stateBefore = h.wardenAI.state;
      const healthBefore = h.warden.health;

      const at = {
        x: h.warden.position.x - Math.sin(h.warden.yaw) * 1.0,
        y: h.warden.feetY,
        z: h.warden.position.z - Math.cos(h.warden.yaw) * 1.0,
      };
      h.shade.reset({ position: at, yaw: h.warden.yaw + Math.PI });
      h.stepFrames(2);
      h.wardenAI._enter('defend');

      h.emitter.emit('combat:damage', {
        target: 'warden', amount: 10, kind: 'knife', remaining: h.warden.health - 10,
        at: { x: h.shade.position.x, y: h.shade.feetY, z: h.shade.position.z },
      });

      if (stateBefore !== 'defend') problems.push(`was in ${stateBefore} before the hit`);
      if (h.wardenAI.state !== 'engage') {
        problems.push(`took a knife while defending and stayed in ${h.wardenAI.state}`);
      }
      const known = h.wardenAI.lastKnown;
      if (!known) problems.push('broke off but has nowhere to go');
      else if (Math.hypot(known.x - h.shade.position.x, known.z - h.shade.position.z) > 0.5) {
        problems.push('broke off toward somewhere other than the attacker');
      }

      // A Warden that is not defending is unaffected by this path — it escalates
      // through perception like anything else.
      h.wardenAI._enter('patrol');
      h.emitter.emit('combat:damage', {
        target: 'warden', amount: 10, kind: 'knife', remaining: 50,
        at: { x: 0, y: 0, z: 0 },
      });
      if (h.wardenAI.state !== 'patrol') {
        problems.push('the break-off fired outside DEFEND, which Section 11 scopes it to');
      }
      // And damage to the Shade never moves the Warden.
      h.wardenAI._enter('defend');
      h.emitter.emit('combat:damage', { target: 'shade', amount: 10, kind: 'gun', remaining: 90, at: null });
      if (h.wardenAI.state !== 'defend') problems.push('the Warden broke off when the SHADE was hit');

      void healthBefore;
      objective.resetMatch();
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? 'defend -> engage on a knife hit, aimed at the attacker; unchanged outside DEFEND '
            + 'and unchanged when the Shade is the one taking damage'
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'a-full-best-of-five-completes-accurately',
    spec: 'Section 10.5 / check 22',
    name: 'Play a match to its end; every scoreboard row matches what happened',
    run: (h) => {
      const objective = h.objective;
      const dt = CONFIG.time.fixedDt;
      const problems = [];

      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      objective.resetMatch();
      objective.resetRound(1);
      const target = objective.target;

      let matchOverEvents = 0;
      const offOver = h.emitter.on('match:over', () => { matchOverEvents++; });

      // What the test believes happened, kept independently of what the game
      // recorded — comparing the game against its own bookkeeping would prove
      // nothing.
      const expected = [];
      let guard = 0;

      while (!objective.matchOver && guard++ < 20) {
        const number = objective.round.number;
        h.warden.reset(h.map.wardenSpawns[0]);

        // Alternate how the round is won so the scoreboard has to record more
        // than one reason, one winner and one site.
        const shadeShouldWin = number % 2 === 1;
        if (shadeShouldWin) {
          // Shade: plant, then let the detonation clock run out.
          const site = ['A', 'B', 'C'][(number - 1) % 3];
          plantAt(h, site);
          let steps = 0;
          while (objective.round.state === ROUND.ACTIVE && steps++ < (R.detonationTime + 5) / dt) {
            objective.step(dt, { shade: h.shade, warden: h.warden, intent: null });
          }
          expected.push({ number, winner: 'shade', site, reason: 'charge detonated' });
        } else {
          // Warden: the Shade loses all three lives before planting. Let the
          // round actually run for a few seconds first — a round that ends at
          // elapsed zero is not a round anyone played.
          for (let i = 0; i < 3 / dt; i++) {
            objective.step(dt, { shade: h.shade, warden: h.warden, intent: null });
          }
          for (let i = 0; i < CONFIG.shade.lives; i++) {
            objective.round.awaitingReinsert = false;
            h.emitter.emit('combat:death', { target: 'shade', kind: 'test' });
          }
          expected.push({
            number, winner: 'warden', site: null,
            reason: 'shade lost all lives before planting',
          });
        }

        if (objective.round.state !== ROUND.ENDED) {
          problems.push(`round ${number} never ended`);
          break;
        }
        if (objective.matchOver) break;

        // Section 10.5: the next round rebuilds everything except the score.
        const scoreBefore = { ...objective.score };
        objective.resetRound();
        const fresh = createRoundState(objective.round.number);
        for (const key of Object.keys(fresh)) {
          if (key === 'number') continue;
          const carried = JSON.stringify(objective.round[key]);
          if (carried !== JSON.stringify(fresh[key])) {
            problems.push(`round ${objective.round.number} started with ${key} = ${carried}`);
          }
        }
        if (objective.score.shade !== scoreBefore.shade || objective.score.warden !== scoreBefore.warden) {
          problems.push('the score did not survive the round reset');
        }
        // And the gadget loadout comes back full for a new round, unlike a
        // reinsert (Section 10.2), which deliberately does not refill.
        if (h.gadgets.loadout.smoke !== CONFIG.gadgets.smoke.count) {
          problems.push(`round ${objective.round.number} started with ${h.gadgets.loadout.smoke} smoke`);
        }
      }

      offOver();

      // The match ended when someone reached the target, and not before.
      const winner = objective.score.shade > objective.score.warden ? 'shade' : 'warden';
      if (!objective.matchOver) problems.push(`the match never ended (score ${objective.score.shade}-${objective.score.warden})`);
      if (objective.score[winner] !== target) {
        problems.push(`the winner has ${objective.score[winner]} wins, the target is ${target}`);
      }
      if (matchOverEvents !== 1) problems.push(`match:over fired ${matchOverEvents} times`);

      // Every recorded round must match what the test made happen.
      if (objective.rounds.length !== expected.length) {
        problems.push(`${objective.rounds.length} rounds recorded, ${expected.length} played`);
      }
      let shadeWins = 0;
      let wardenWins = 0;
      for (let i = 0; i < Math.min(objective.rounds.length, expected.length); i++) {
        const got = objective.rounds[i];
        const want = expected[i];
        if (got.number !== want.number) problems.push(`row ${i}: number ${got.number}, played ${want.number}`);
        if (got.winner !== want.winner) problems.push(`row ${i}: winner ${got.winner}, want ${want.winner}`);
        if (got.reason !== want.reason) problems.push(`row ${i}: reason "${got.reason}", want "${want.reason}"`);
        if (got.site !== want.site) problems.push(`row ${i}: site ${got.site}, want ${want.site}`);
        // Section 10.5 lists round duration on the scoreboard; it has to be a
        // real elapsed time, not zero and not the whole round timer.
        if (!(got.duration > 0)) problems.push(`row ${i}: duration ${got.duration}`);
        if (got.winner === 'shade') shadeWins++; else wardenWins++;
      }
      // The tally on the scoreboard has to equal the tally in the rows.
      if (shadeWins !== objective.score.shade || wardenWins !== objective.score.warden) {
        problems.push(`rows say ${shadeWins}-${wardenWins}, the score says ${objective.score.shade}-${objective.score.warden}`);
      }

      // And the intermission has to print all of it.
      const wasOpen = h.scoreboard.open;
      h.scoreboard.show({ rounds: objective.rounds, score: objective.score, matchOver: objective.matchOver });
      const printed = h.scoreboard.root.textContent;
      for (const row of objective.rounds) {
        if (printed.indexOf(String(row.number)) === -1) problems.push(`round ${row.number} is missing from the scoreboard`);
      }
      if (printed.indexOf(`${objective.score.shade}`) === -1) problems.push('the scoreboard does not show the final score');
      if (!wasOpen) h.scoreboard.hide();

      // Read everything the report needs before the reset clears it.
      const played = objective.rounds.length;
      objective.resetMatch();
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `best of ${Object.keys(CONFIG.match.lengths).find((k) => CONFIG.match.lengths[k] === target)} `
            + `played to ${played} rounds, final ${shadeWins}-${wardenWins} to the ${winner}; `
            + `every row's winner, reason, site and duration matches what was played; `
            + 'each round started from a fresh defaults object with only the score carried'
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'plant-holds-four-seconds-and-extends-the-round',
    spec: 'Section 10.1, 10.3 / check 20',
    name: 'A 4s hold arms the charge, adds 45s once, and detonating wins the round',
    run: (h) => {
      const objective = h.objective;
      const dt = CONFIG.time.fixedDt;
      const problems = [];
      objective.resetMatch();
      objective.resetRound(1);
      h.warden.reset(h.map.wardenSpawns[0]);

      const before = objective.round.timeRemaining;
      const held = plantAt(h, 'A');
      if (objective.round.charge !== CHARGE.PLANTED) problems.push('never planted');
      if (Math.abs(held - R.plantHoldTime) > 0.3) {
        problems.push(`plant took ${held.toFixed(2)}s, spec is a ${R.plantHoldTime}s hold`);
      }
      // Section 10.3: +45s, once.
      const gained = objective.round.timeRemaining - (before - held);
      if (Math.abs(gained - R.plantExtension) > 0.5) {
        problems.push(`gained ${gained.toFixed(1)}s, spec is ${R.plantExtension}s`);
      }
      if (!objective.round.milestones.plant) problems.push('the plant milestone did not latch');
      if (objective.round.site !== 'A') problems.push(`recorded site ${objective.round.site}`);

      // Detonation clock becomes the effective timer (Section 10.4).
      if (Math.abs(objective.hud.timeRemaining - R.detonationTime) > 0.3) {
        problems.push(`hud shows ${objective.hud.timeRemaining.toFixed(1)}s, want the ${R.detonationTime}s fuse`);
      }

      // Run the fuse down with the Warden parked far away so it cannot defuse.
      h.warden.position.set(24, CONFIG.warden.standHeight / 2 + 0.05, -10);
      let steps = 0;
      while (objective.round.state === ROUND.ACTIVE && steps++ < 60 / dt) {
        objective.step(dt, { shade: h.shade, warden: h.warden, intent: null });
      }
      if (objective.round.winner !== 'shade') problems.push(`detonation gave the round to ${objective.round.winner}`);
      if (objective.score.shade !== 1) problems.push(`score reads ${objective.score.shade} for the shade`);

      const fuse = steps * dt;
      objective.resetMatch();
      objective.resetRound(1);
      h.shade.reset(h.map.shadeSpawns[0]);
      h.warden.reset(h.map.wardenSpawns[0]);
      // Ending a round really does open the intermission, so put it away.
      if (h.scoreboard) h.scoreboard.hide();

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `planted in ${held.toFixed(2)}s at site A, +${gained.toFixed(0)}s, detonated after ${fuse.toFixed(1)}s (fuse ${R.detonationTime}s), shade wins 1-0`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'defuse-wins-and-partial-progress-decays',
    spec: 'Section 10.1 / check 21',
    name: 'An 8s hold defuses; interrupting retains progress for 5s, then it decays',
    run: (h) => {
      const objective = h.objective;
      const dt = CONFIG.time.fixedDt;
      const problems = [];
      objective.resetMatch();
      objective.resetRound(1);
      h.warden.reset(h.map.wardenSpawns[0]);

      plantAt(h, 'A');
      // On the charge, which is wherever the Shade was standing in the room -
      // not the site centre (Section 10.1, amended).
      const at = objective.round.chargeAt;
      const onTheCharge = () => h.warden.position.set(
        at.x, at.y + CONFIG.warden.standHeight / 2 + 0.05, at.z
      );
      // The AI must not be able to see the Shade or it would be shooting
      // instead of kneeling (Section 11 DEFEND).
      h.wardenAI.sees = false;
      h.shade.position.set(at.x + 40, CONFIG.shade.standHeight / 2 + 0.05, at.z);
      onTheCharge();

      // Half a defuse, then walk away.
      for (let i = 0; i < (R.defuseHoldTime / 2) / dt; i++) {
        objective.step(dt, { shade: h.shade, warden: h.warden, intent: null });
      }
      const partial = objective.round.defuseProgress;
      if (partial <= 0) problems.push('no defuse progress at the charge');

      h.warden.position.set(at.x + 20, CONFIG.warden.standHeight / 2 + 0.05, at.z);
      // Retained for 5s (Section 10.1).
      for (let i = 0; i < (R.defuseRetainTime - 0.5) / dt; i++) {
        objective.step(dt, { shade: h.shade, warden: h.warden, intent: null });
      }
      const retained = objective.round.defuseProgress;
      if (Math.abs(retained - partial) > 1e-6) problems.push('progress was not retained through the window');

      // Then it decays.
      for (let i = 0; i < 3 / dt; i++) {
        objective.step(dt, { shade: h.shade, warden: h.warden, intent: null });
      }
      const decayed = objective.round.defuseProgress;
      if (decayed >= retained) problems.push('progress did not decay after the retain window');

      // Now finish it.
      onTheCharge();
      let steps = 0;
      while (objective.round.state === ROUND.ACTIVE && steps++ < 30 / dt) {
        objective.step(dt, { shade: h.shade, warden: h.warden, intent: null });
      }
      if (objective.round.winner !== 'warden') problems.push(`defuse gave the round to ${objective.round.winner}`);
      if (objective.round.charge !== CHARGE.DEFUSED) problems.push(`charge state ${objective.round.charge}`);

      objective.resetMatch();
      objective.resetRound(1);
      h.shade.reset(h.map.shadeSpawns[0]);
      h.warden.reset(h.map.wardenSpawns[0]);
      if (h.scoreboard) h.scoreboard.hide();

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${partial.toFixed(1)}s banked, held through the ${R.defuseRetainTime}s window, decayed to ${decayed.toFixed(2)}s, then defused for the warden`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'lives-reinsert-and-the-all-lives-rule',
    spec: 'Section 10.2, 10.4 / checks 16, 23, 24, 25',
    name: 'Three lives, reinsert away from the Warden, gadgets not refilled',
    run: (h) => {
      const objective = h.objective;
      const dt = CONFIG.time.fixedDt;
      const problems = [];
      objective.resetMatch();
      objective.resetRound(1);
      h.warden.reset(h.map.wardenSpawns[0]);

      // Spend a gadget so the reinsert rule has something to fail to refill.
      h.gadgets.loadout.smoke = 1;

      objective.markDeathPosition({ x: -18, y: 0, z: -4 });
      h.emitter.emit('combat:death', { target: 'shade', kind: 'test' });
      if (objective.round.lives !== 2) problems.push(`lives went to ${objective.round.lives}, want 2`);
      if (!objective.round.awaitingReinsert) problems.push('no reinsert was scheduled');

      // Not early (Section 10.2: a 15s countdown).
      for (let i = 0; i < (CONFIG.reinsert.delay - 0.5) / dt; i++) {
        objective.step(dt, { shade: h.shade, warden: h.warden, intent: null });
      }
      if (!objective.round.awaitingReinsert) problems.push('reinserted early');
      for (let i = 0; i < 1 / dt; i++) {
        objective.step(dt, { shade: h.shade, warden: h.warden, intent: null });
      }
      if (objective.round.awaitingReinsert) problems.push('never reinserted');
      if (h.shade.health !== CONFIG.shade.health) problems.push('reinsert did not restore health');
      // Section 10.2, deliberately: gadgets are NOT refilled.
      if (h.gadgets.loadout.smoke !== 1) problems.push('reinsert refilled gadgets');
      // And the Warden's knowledge resets to the death location.
      if (!h.wardenAI.lastKnown || Math.abs(h.wardenAI.lastKnown.x + 18) > 0.01) {
        problems.push('the AI was not sent to the death location');
      }
      if (h.wardenAI.accumulator !== 0) problems.push('the AI kept its accumulator through a kill');

      // Section 10.4: all three lives gone BEFORE a plant ends the round.
      objective.resetRound(2);
      for (let i = 0; i < CONFIG.shade.lives; i++) {
        objective.round.awaitingReinsert = false;
        h.emitter.emit('combat:death', { target: 'shade', kind: 'test' });
      }
      const endedUnplanted = objective.round.state === ROUND.ENDED && objective.round.winner === 'warden';
      if (!endedUnplanted) problems.push('losing every life before a plant did not end the round');

      // And AFTER a plant, the round continues on the detonation clock.
      objective.resetRound(3);
      plantAt(h, 'B');
      for (let i = 0; i < CONFIG.shade.lives; i++) {
        objective.round.awaitingReinsert = false;
        h.emitter.emit('combat:death', { target: 'shade', kind: 'test' });
      }
      if (objective.round.state !== ROUND.ACTIVE) {
        problems.push('losing every life AFTER a plant ended the round');
      }

      objective.resetMatch();
      objective.resetRound(1);
      h.gadgets.reset();
      h.shade.reset(h.map.shadeSpawns[0]);
      h.warden.reset(h.map.wardenSpawns[0]);
      if (h.scoreboard) h.scoreboard.hide();

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `3 lives, reinsert after ${CONFIG.reinsert.delay}s on full health with gadgets untouched, AI resent to the death spot; all lives lost ends the round unplanted and does not once planted`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'round-state-carries-nothing-but-the-score',
    spec: 'Section 10.5 / check 22 / Section 15',
    name: 'resetRound rebuilds every mutable field from the defaults factory',
    run: (h) => {
      const objective = h.objective;
      const problems = [];
      objective.resetMatch();
      objective.resetRound(1);

      // Dirty everything a round owns.
      const round = objective.round;
      round.charge = CHARGE.PLANTED;
      round.site = 'C';
      round.lives = 1;
      round.takedowns = 4;
      round.plantProgress = 3;
      round.defuseProgress = 5;
      round.milestones.plant = true;
      round.milestones.takedown = true;
      round.timeRemaining = 12;
      objective.score.shade = 2;

      const before = objective.round;
      objective.resetRound(2);
      const after = objective.round;

      if (after === before) problems.push('resetRound mutated the old object instead of replacing it');
      const fresh = createRoundState(2);
      for (const key of Object.keys(fresh)) {
        if (key === 'milestones') continue;
        if (JSON.stringify(after[key]) !== JSON.stringify(fresh[key])) {
          problems.push(`${key} carried over as ${JSON.stringify(after[key])}`);
        }
      }
      if (after.milestones.plant || after.milestones.takedown) problems.push('milestones carried over');
      // The one thing that must survive.
      if (objective.score.shade !== 2) problems.push('the score was reset with the round');

      objective.resetMatch();
      objective.resetRound(1);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${Object.keys(fresh).length} fields rebuilt from the factory, new object, score preserved at 2`
          : problems.join('; '),
      };
    },
  });

  // A2: canDefuseAt() is the plant rule's half of the defuse reach. It is only
  // worth anything while it and the defuse measure the same thing, so this
  // check proves the sharing the way HANDOFF.md says derived data has to be
  // proved - by moving the constant and watching both sides move - rather than
  // by reading the same number twice and agreeing with itself.
  debugTools.registerAutoTest({
    id: 'candefuseat-and-the-defuse-measure-one-reach',
    spec: 'Section 10.1 amended / D5 / Block A2',
    name: 'canDefuseAt is true at every site centre, and moves with the constants the defuse reads',
    run: (h) => {
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: true });
      const objective = h.objective;
      const dt = CONFIG.time.fixedDt;
      const problems = [];

      if (!h.map.wardenGround) return { pass: false, detail: 'map.wardenGround was never derived' };

      // A real plant, so the charge sits where a body stood rather than where
      // a test wrote it. The Warden then works on it from a measured offset.
      objective.resetMatch();
      objective.resetRound(1);
      plantAt(h, 'A');
      if (objective.round.charge !== CHARGE.PLANTED) {
        return { pass: false, detail: 'the charge never planted at site A' };
      }
      const at = objective.round.chargeAt;

      /** Put the Warden this far from the charge and see whether the defuse ticks. */
      const defuseTicks = (out, up) => {
        const round = objective.round;
        round.defuseProgress = 0;
        round.defuseRetain = 0;
        h.warden.position.set(
          at.x + out, at.y + up + CONFIG.warden.standHeight / 2, at.z
        );
        const intent = createIntent();
        for (let i = 0; i < 5; i++) objective.step(dt, { shade: h.shade, warden: h.warden, intent });
        return round.defuseProgress > 0;
      };

      const siteCentres = h.map.sites.map((site) => ({
        id: site.id,
        at: { x: site.position.x, y: site.position.y, z: site.position.z },
      }));
      const centresLegal = () => siteCentres.filter((site) => objective.canDefuseAt(site.at));

      // --- The done-when: legal at every site centre --------------------
      const legal = centresLegal();
      if (legal.length !== siteCentres.length) {
        const missing = siteCentres.filter((site) => !objective.canDefuseAt(site.at)).map((s) => s.id);
        problems.push(`canDefuseAt is false at site centre ${missing.join(', ')}`);
      }

      // The near offset must defuse and the far one must not, or the
      // perturbations below prove nothing.
      const near = DEFUSE_REACH.radius * 0.5;
      const far = DEFUSE_REACH.radius * 1.5;
      if (!defuseTicks(near, 0)) problems.push(`the defuse did not tick at ${near.toFixed(2)}m, inside the radius`);
      if (defuseTicks(far, 0)) problems.push(`the defuse ticked at ${far.toFixed(2)}m, outside the radius`);

      // --- The sharing, proved by moving the constants -------------------
      // Each is restored in `finally`: a leaked reach would silently rewrite
      // every check that runs after this one.
      const baseRadius = DEFUSE_REACH.radius;
      const baseDy = DEFUSE_REACH.dy;
      try {
        // Shrink the radius to nothing. Both sides must go dead.
        DEFUSE_REACH.radius = 0;
        if (defuseTicks(near, 0)) problems.push('with the radius at 0 the defuse still ticked');
        if (centresLegal().length) problems.push('with the radius at 0 canDefuseAt was still true at a site centre');

        // Open it up. The offset that was too far must now work - which needs
        // the value read, not merely tested for truth.
        DEFUSE_REACH.radius = baseRadius * 3;
        if (!defuseTicks(far, 0)) problems.push(`with the radius at ${(baseRadius * 3).toFixed(1)}m the defuse still refused ${far.toFixed(2)}m`);
        DEFUSE_REACH.radius = baseRadius;

        // Same for the vertical bound. At dy 0 nothing is close enough
        // vertically, including a Warden standing on the charge.
        DEFUSE_REACH.dy = 0;
        if (defuseTicks(near, 0)) problems.push('with dy at 0 the defuse still ticked');
        if (centresLegal().length) problems.push('with dy at 0 canDefuseAt was still true at a site centre');

        // And a charge a floor above the ground the Warden can stand on is
        // out of reach until the bound is raised past the gap.
        DEFUSE_REACH.dy = baseDy;
        const high = { x: at.x, y: at.y + baseDy + 1.0, z: at.z };
        if (objective.canDefuseAt(high)) {
          problems.push(`canDefuseAt was true ${(baseDy + 1).toFixed(1)}m above the charge, past the ${baseDy}m bound`);
        }
        DEFUSE_REACH.dy = baseDy + 2.0;
        if (!objective.canDefuseAt(high)) {
          problems.push(`raising dy to ${(baseDy + 2).toFixed(1)}m did not make the point ${(baseDy + 1).toFixed(1)}m up reachable`);
        }
      } finally {
        DEFUSE_REACH.radius = baseRadius;
        DEFUSE_REACH.dy = baseDy;
      }

      // Restored, and the horizontal reach is still the one config states.
      if (DEFUSE_REACH.radius !== CONFIG.round.siteRadius) {
        problems.push(`DEFUSE_REACH.radius is ${DEFUSE_REACH.radius}, not round.siteRadius (${CONFIG.round.siteRadius})`);
      }
      if (!defuseTicks(near, 0)) problems.push('the defuse did not come back after the constants were restored');
      if (centresLegal().length !== siteCentres.length) {
        problems.push('canDefuseAt did not come back after the constants were restored');
      }

      objective.resetMatch();
      objective.resetRound(1);
      h.shade.reset(h.map.shadeSpawns[0]);
      h.warden.reset(h.map.wardenSpawns[0]);

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `legal at all ${siteCentres.length} site centres (${siteCentres.map((s) => s.id).join(', ')}); `
            + `radius ${baseRadius}m and dy ${baseDy}m each move the defuse and canDefuseAt together`
          : problems.join('; '),
      };
    },
  });

  // A3: the plant is gated on canDefuseAt EVERY step of the hold, not at the
  // commit. The rule is D5's - a plant is legal exactly where a Warden could
  // stand and defuse it - and this drives it the way a player meets it: stand
  // on a crate top inside a site's room, hold the interact key, and watch
  // nothing happen. Not `intent.interact = true`: `input.heldCodes`, through
  // the real loop, because the bug this file keeps rediscovering is a check
  // that drives the game differently from the hands on the keyboard.
  //
  // The perches come from the census's own ledge list, so a map rebuild that
  // moves a crate moves this check with it. And the refusal is proved to be
  // the LIVE reach rather than a hardcoded exclusion by opening `dy` up until
  // the same perch is legal and holding again: it plants.
  debugTools.registerAutoTest({
    id: 'a-plant-never-starts-where-the-warden-could-not-defuse-it',
    spec: 'Section 10.1 amended / D5 / D6 / Block A3',
    name: 'Holding interact on a climbable top inside a site room never starts plant progress',
    run: (h) => {
      const problems = [];
      const dt = CONFIG.time.fixedDt;
      h.initMatch({ mode: 'competitive', role: 'shade', ai: false, objective: true });
      const objective = h.objective;
      if (!h.map.wardenGround) return { pass: false, detail: 'map.wardenGround was never derived' };

      const holdSteps = Math.round((R.plantHoldTime + 1) / dt);

      const perches = perchesInSiteRooms(h);
      const refused = perches.filter((perch) => !perch.legal);
      if (!perches.length) {
        return { pass: false, detail: 'no climbable top stands inside a site room, so the gate is untested' };
      }
      if (!refused.length) {
        return {
          pass: false,
          detail: `all ${perches.length} climbable tops inside a site room are already legal plants, `
            + 'so nothing here exercises the gate',
        };
      }

      /**
       * Put the Shade on this perch and hold the interact key. Returns what the
       * hold produced: how far plant progress got, whether it committed, and
       * how many plant noise events escaped (D6 says none, on a refusal).
       */
      const holdInteractAt = (perch, steps) => {
        objective.resetRound(1);
        h.shade.reset(h.map.shadeSpawns[0]);
        h.shade.position.set(perch.body.x, perch.body.y, perch.body.z);
        h.shade.velocity.set(0, 0, 0);
        let noises = 0;
        // Copy the field on arrival: the pool of 48 recycles slots.
        const off = h.emitter.on('noise', (event) => {
          if (event.type === 'plant') noises++;
        });
        let peak = 0;
        h.input.heldCodes.add('KeyE');
        try {
          for (let i = 0; i < steps; i++) {
            h.stepFrames(1);
            peak = Math.max(peak, objective.round.plantProgress);
            if (objective.round.charge !== CHARGE.CARRIED) break;
          }
        } finally {
          h.input.heldCodes.delete('KeyE');
          off();
        }
        return { peak, charge: objective.round.charge, noises, at: objective.round.chargeAt };
      };

      // --- the done-when: progress never starts on a refused perch --------
      const tried = refused.slice(0, 3);
      for (const perch of tried) {
        const held = holdInteractAt(perch, holdSteps);
        if (held.charge !== CHARGE.CARRIED) {
          problems.push(`${perch.tag} (${perch.rise.toFixed(1)}m up, room ${perch.site}) planted anyway`);
        } else if (held.peak > 0) {
          problems.push(
            `${perch.tag} refused only after ${held.peak.toFixed(2)}s of progress; `
            + 'the gate has to run every step, not at the commit'
          );
        }
        // D6: a refused plant is a HUD line and nothing else. A noise event
        // would give the Shade away for a plant that never happened.
        if (held.noises) {
          problems.push(`${perch.tag} emitted ${held.noises} plant noise events while being refused`);
        }
      }

      // --- the refusal is the live reach, not an exclusion ----------------
      // Raise the vertical reach until the first refused perch is legal, and
      // hold again. If the gate were reading anything but DEFUSE_REACH this
      // would go on refusing.
      const perch = tried[0];
      const baseDy = DEFUSE_REACH.dy;
      try {
        let opened = baseDy;
        while (opened < 40 && !objective.canDefuseAt(perch.foot)) {
          opened += 1;
          DEFUSE_REACH.dy = opened;
        }
        if (!objective.canDefuseAt(perch.foot)) {
          problems.push(`no vertical reach under 40m makes ${perch.tag} legal, so the opening step proves nothing`);
        } else {
          const held = holdInteractAt(perch, holdSteps);
          if (held.charge !== CHARGE.PLANTED) {
            problems.push(
              `with the reach opened to ${opened}m, ${perch.tag} was still refused - `
              + 'the gate is not reading DEFUSE_REACH'
            );
          }
        }
      } finally {
        DEFUSE_REACH.dy = baseDy;
      }

      // --- and the ordinary plant still works -----------------------------
      objective.resetRound(1);
      h.input.heldCodes.clear();
      plantAt(h, 'A');
      if (objective.round.charge !== CHARGE.PLANTED) {
        problems.push('the gate refused an ordinary plant on the floor of site A');
      }

      objective.resetMatch();
      objective.resetRound(1);
      h.shade.reset(h.map.shadeSpawns[0]);
      h.warden.reset(h.map.wardenSpawns[0]);

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${refused.length} of ${perches.length} climbable tops inside a site room are out of the `
            + `Warden's reach; held interact on ${tried.length} (${tried.map((p) => p.tag).join(', ')}) `
            + 'for ' + (R.plantHoldTime + 1) + 's each with no progress and no noise, and each planted '
            + 'once the reach was opened'
          : problems.join('; '),
      };
    },
  });

  // A4: a refused plant is never silent. The redesign's standard for a failed
  // climb - a tell, never nothing - applies to an interact key that does
  // nothing, which is the marking problem inverted: a rule the player cannot
  // see. D6 decided what the tell is and, just as importantly, what it is not.
  // A HUD line. No sound, no noise event, because a refused plant must not
  // give the Shade away.
  //
  // Read through the real frame, not by calling `hud.update()` with a state
  // object a check wrote: the whole risk here is main.js gathering the wrong
  // field, and a hand-fed HUD would pass with that wire cut.
  debugTools.registerAutoTest({
    id: 'a-refused-plant-says-so-and-says-nothing-else',
    spec: 'Section 13 / D6 / Block A4',
    name: 'Holding interact somewhere illegal puts "cannot plant here" on the HUD and emits no noise',
    run: (h) => {
      const problems = [];
      h.initMatch({ mode: 'competitive', role: 'shade', ai: false, objective: true });
      // The frame hides the HUD behind a menu, and initMatch leaves one up.
      // Every check that drives real frames does this; the difference is that
      // this one then has to put the HUD back, or the next check to read it
      // finds it hidden.
      h.menu.hide();
      h.setPaused(false);
      h.input.clearAll();
      const objective = h.objective;
      const hud = h.hud;
      if (!hud) return { pass: false, detail: 'no HUD' };
      // One frame before anything is read: `setVisible` runs inside the frame,
      // so `hud.visible` is stale until the loop has turned over once.
      h.renderFrame(1 / 60);
      if (!hud.visible) return { pass: false, detail: 'the HUD is hidden, so nothing here reads anything' };

      const refused = perchesInSiteRooms(h).filter((perch) => !perch.legal);
      if (!refused.length) {
        return { pass: false, detail: 'no climbable top inside a site room is refused, so there is no refusal to read' };
      }
      const perch = refused[0];

      /** Hold the interact key here for `frames` rendered frames and read the HUD. */
      const holdAndRead = (at, frames) => {
        objective.resetRound(1);
        h.shade.reset(h.map.shadeSpawns[0]);
        h.shade.position.set(at.x, at.y, at.z);
        h.shade.velocity.set(0, 0, 0);
        let noises = 0;
        const off = h.emitter.on('noise', (event) => {
          if (event.type === 'plant') noises++;
        });
        h.input.heldCodes.add('KeyE');
        try {
          for (let i = 0; i < frames; i++) h.renderFrame(1 / 60);
        } finally {
          h.input.heldCodes.delete('KeyE');
          off();
        }
        return {
          text: hud.el.promptText.textContent,
          shown: hud.el.prompt.style.display === 'block',
          barHidden: hud.el.prompt.classList.contains('refused'),
          noises,
          progress: objective.round.plantProgress,
        };
      };

      // --- the done-when -------------------------------------------------
      const held = holdAndRead(perch.body, 6);
      if (!held.shown) {
        problems.push(`the prompt panel was hidden while the plant was being refused on ${perch.tag}`);
      }
      if (held.text !== PLANT_REFUSED) {
        problems.push(`the HUD read "${held.text}" on ${perch.tag}, want "${PLANT_REFUSED}"`);
      }
      if (!held.barHidden) {
        problems.push('the hold bar was still drawn under a refusal, which reads as a hold that is not filling');
      }
      if (held.noises) {
        problems.push(`${held.noises} plant noise events escaped a refused hold (D6: no noise, no sound)`);
      }
      if (held.progress > 0) problems.push(`plant progress reached ${held.progress.toFixed(2)}s on a refusal`);

      // --- and it goes away again ----------------------------------------
      // A line that outlives its cause is a rule the player cannot un-trigger.
      // One step with the key released has to clear it.
      h.stepFrames(1);
      h.renderFrame(1 / 60);
      if (objective.round.plantRefused) problems.push('the refusal latched after interact was released');
      if (hud.el.promptText.textContent === PLANT_REFUSED) {
        problems.push('the HUD still read the refusal a frame after interact was released');
      }
      if (hud.el.prompt.classList.contains('refused')) {
        problems.push('the refusal styling outlived the refusal');
      }

      // --- a legal hold says the opposite --------------------------------
      // Proves the line is the plant rule speaking and not the panel's only
      // remaining state: same key, same panel, a spot the Warden can reach.
      const site = h.map.sites.find((entry) => entry.id === perch.site) || h.map.sites[0];
      const legal = spotOffTheRing(h, site, R.siteRadius * 3);
      const onFloor = {
        x: legal.x,
        y: legal.y + CONFIG.shade.standHeight / 2 + 0.05,
        z: legal.z,
      };
      const good = holdAndRead(onFloor, 6);
      if (good.text === PLANT_REFUSED) {
        problems.push(`an ordinary plant on the floor of site ${site.id} was refused too`);
      }
      if (!good.noises) {
        problems.push('a legal plant hold emitted no noise, so the refusal proves nothing about the silence');
      }

      h.input.clearAll();
      objective.resetMatch();
      objective.resetRound(1);
      h.shade.reset(h.map.shadeSpawns[0]);
      h.warden.reset(h.map.wardenSpawns[0]);
      h.menu.hide();
      h.renderFrame(1 / 60);
      // Left visible on purpose: `hud-reads-the-meter-it-is-shown-beside`
      // calls `update()` directly, and `update()` returns early when the HUD
      // is hidden. A check that drives a real frame owns what it leaves behind.
      hud.setVisible(true);

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `holding interact on ${perch.tag} (${perch.rise.toFixed(1)}m up, room ${perch.site}) reads `
            + `"${PLANT_REFUSED}" with the hold bar gone, no progress and 0 noise events; it clears one `
            + `frame after release, and the same hold on the floor of site ${site.id} prompts and `
            + `noises normally`
          : problems.join('; '),
      };
    },
  });
}
