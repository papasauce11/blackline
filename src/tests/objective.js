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
    spec: 'Section 10.2, 10.4 / checks 23, 24, 25',
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
