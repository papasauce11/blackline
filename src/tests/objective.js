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
import { CHARGE, ROUND, createRoundState } from '../systems/objective.js';
import { createIntent } from '../entities/agent.js';

const R = CONFIG.round;

export function register(debugTools) {
  /** Put the Shade on a site and hold interact until it plants. */
  const plantAt = (h, siteId) => {
    const objective = h.objective;
    const dt = CONFIG.time.fixedDt;
    const site = h.map.sites.find((entry) => entry.id === siteId);
    h.shade.reset(h.map.shadeSpawns[0]);
    h.shade.position.set(site.position.x, site.position.y + CONFIG.shade.standHeight / 2 + 0.05, site.position.z);
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

      // The Warden starts wherever it was; DEFEND was set by the plant.
      const startedAt = h.warden.position.clone();
      const startDistance = startedAt.distanceTo(site.position);
      if (h.wardenAI.state !== 'defend') {
        problems.push(`the plant left the AI in ${h.wardenAI.state}, want defend`);
      }

      let steps = 0;
      let closest = startDistance;
      let sawDefuseProgress = false;
      const limit = Math.round((CONFIG.round.detonationTime - 1) / dt);
      while (objective.round.state === ROUND.ACTIVE && steps++ < limit) {
        h.stepFrames(1);
        closest = Math.min(closest, h.warden.position.distanceTo(site.position));
        if (objective.round.defuseProgress > 0) sawDefuseProgress = true;
      }
      const took = steps * dt;

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
          ? `planted at A and hid: the Warden pathed ${startDistance.toFixed(1)}m to the charge, `
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
      const site = h.map.sites.find((entry) => entry.id === 'A');
      // Warden on the charge; the AI must not be able to see the Shade or it
      // would be shooting instead of kneeling (Section 11 DEFEND).
      h.wardenAI.sees = false;
      h.shade.position.set(site.position.x + 40, CONFIG.shade.standHeight / 2 + 0.05, site.position.z);
      h.warden.position.set(site.position.x, site.position.y + CONFIG.warden.standHeight / 2 + 0.05, site.position.z);

      // Half a defuse, then walk away.
      for (let i = 0; i < (R.defuseHoldTime / 2) / dt; i++) {
        objective.step(dt, { shade: h.shade, warden: h.warden, intent: null });
      }
      const partial = objective.round.defuseProgress;
      if (partial <= 0) problems.push('no defuse progress at the charge');

      h.warden.position.set(site.position.x + 20, CONFIG.warden.standHeight / 2 + 0.05, site.position.z);
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
      h.warden.position.set(site.position.x, site.position.y + CONFIG.warden.standHeight / 2 + 0.05, site.position.z);
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
}
