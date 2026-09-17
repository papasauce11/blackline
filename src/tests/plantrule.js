/**
 * BLACKLINE - tests/plantrule.js
 *
 * AUTO suite (Section 16, Section 17.1): the plant rule, Block A.
 *
 * *A plant is legal exactly where a Warden could stand and defuse it* (D5).
 * These are the checks that the game asks that question - that one reach
 * answers for both sides of it (A2), that the gate asks it every step of the
 * hold rather than at the commit (A3), and that a refusal says so and says
 * nothing else (A4, D6), and that a charge cannot be left inside anything
 * (A6, D20). The census that asks it of the whole map is in
 * tests/plantcensus.js.
 *
 * Registered from tests/index.js. Checks reach the live game through the
 * harness `h`; nothing here imports main.js, which Section 3.1 forbids.
 */

import { CONFIG } from '../config.js';
import { CHARGE, DEFUSE_REACH, PLANT_HEADROOM } from '../systems/objective.js';
import { PLANT_REFUSED } from '../ui/hud.js';
import { createIntent } from '../entities/agent.js';
import { spotOffTheRing, plantAt, perchesInSiteRooms, plantableSpots, plantOutcomeAt } from './plantspots.js';

const R = CONFIG.round;

export function register(debugTools) {
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
      // Raise the vertical reach until a refused perch is legal, and hold
      // again. If the gate were reading anything but DEFUSE_REACH this would
      // go on refusing. The perch has to be one the REACH refuses: since D20
      // a top under a low lid is refused by headroom, and no reach opens that.
      // And it has to be one the VERTICAL reach can open: a top refused for
      // being more than arm's length from any ground on any floor (the middle
      // of `hall-container`, 1.5m from every face) stays refused at 40m. The
      // perch that used to be picked, `server-rack-0`, opened only because the
      // corridor floor six metres under the vault came into reach at dy 8;
      // B4 put Warden ground in the rack aisles and it is simply legal now.
      const baseDy = DEFUSE_REACH.dy;
      const opensUnder = (foot, limit) => {
        let dy = baseDy;
        try {
          while (dy < limit && !objective.canDefuseAt(foot)) {
            dy += 1;
            DEFUSE_REACH.dy = dy;
          }
          return objective.canDefuseAt(foot) ? dy : null;
        } finally {
          DEFUSE_REACH.dy = baseDy;
        }
      };
      const perch = refused.find((p) => objective.hasHeadroomAt(p.foot) && opensUnder(p.foot, 40) !== null);
      try {
        const opened = perch ? opensUnder(perch.foot, 40) : null;
        if (opened === null) {
          problems.push(
            `no vertical reach under 40m makes any of the ${refused.length} refused tops legal `
            + `(${refused.map((p) => p.tag).join(', ')}), so the opening step proves nothing`
          );
        } else {
          DEFUSE_REACH.dy = opened;
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
            + 'for ' + (R.plantHoldTime + 1) + `s each with no progress and no noise; ${perch.tag} planted `
            + 'once the vertical reach was opened'
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

  // A6 / D20: a charge cannot be inside anything. Josh, on being shown that
  // every duct in a site room was a legal plant: "can't plant inside things.
  // only on top." The clause is a headroom test, not a list of ducts, so this
  // proves it the way a mechanical rule has to be proved - by the constant.
  // Lower the headroom under a duct roof and the duct becomes plantable; put it
  // back and it is refused again; and no amount of defuse reach opens it,
  // because the reach is not what is refusing it.
  debugTools.registerAutoTest({
    id: 'a-charge-cannot-be-planted-inside-anything',
    spec: 'Section 10.1 amended / D20 / Block A6',
    name: 'Every enclosed interior in a site room - a duct, a crawl space - refuses the plant, by its lid and not by the reach',
    run: (h) => {
      const problems = [];
      h.initMatch({ mode: 'competitive', role: 'shade', ai: false, objective: true });
      const objective = h.objective;

      // "Inside anything" is whatever the map it runs on has: the plant's
      // ducts, the yard's crawl space under the trailer (D2). Both are the
      // same clause - a lid over the charge - and both come from
      // `plantableSpots`, so a map with neither is honestly red here.
      const ducts = plantableSpots(h).filter((spot) => spot.kind === 'vent' || spot.kind === 'crawl');
      if (!ducts.length) return { pass: false, detail: 'no duct interior or crawl space lies inside a site room, so there is nothing to refuse' };

      // --- every duct is refused, and the plant agrees ------------------
      for (const duct of ducts) {
        if (duct.legal) problems.push(`${duct.what} is a legal plant`);
        if (objective.hasHeadroomAt(duct.at)) problems.push(`${duct.what} has standing headroom, so nothing here is a lid`);
      }
      const held = plantOutcomeAt(h, ducts[0]);
      if (held.charge !== CHARGE.CARRIED) problems.push(`${ducts[0].what} planted anyway`);
      if (held.peak > 0) problems.push(`${ducts[0].what} accrued ${held.peak.toFixed(2)}s of progress before refusing`);

      // --- and it is the lid, not the reach -------------------------------
      // The defuse reach could never open a duct, however far it is raised.
      // Only the headroom does, and a duct that opens when the headroom drops
      // below its own height is a duct refused for exactly the stated reason.
      const duct = ducts.find((spot) => objective.canDefuseAt(spot.at)) || ducts[0];
      const baseDy = DEFUSE_REACH.dy;
      const baseHeight = PLANT_HEADROOM.height;
      try {
        DEFUSE_REACH.dy = 50;
        if (objective.canPlantAt(duct.at)) problems.push(`${duct.what} became plantable with the defuse reach at 50m, so the reach was refusing it, not the lid`);
        DEFUSE_REACH.dy = baseDy;

        // Under the duct roof: whatever height the duct is, a probe shorter
        // than the crouch will fit inside it.
        PLANT_HEADROOM.height = CONFIG.shade.crouchHeight * 0.5;
        const opened = objective.canDefuseAt(duct.at);
        if (opened && !objective.canPlantAt(duct.at)) {
          problems.push(`${duct.what} stayed refused with the headroom lowered to ${PLANT_HEADROOM.height.toFixed(2)}m, so the gate is not reading PLANT_HEADROOM`);
        }
        if (opened) {
          const now = plantOutcomeAt(h, duct);
          if (now.charge !== CHARGE.PLANTED) problems.push(`${duct.what}: with the headroom lowered the plant still never committed`);
        }
      } finally {
        DEFUSE_REACH.dy = baseDy;
        PLANT_HEADROOM.height = baseHeight;
      }
      if (objective.canPlantAt(duct.at)) problems.push('the duct did not go back to refused after the constants were restored');
      if (PLANT_HEADROOM.height !== CONFIG.warden.standHeight) {
        problems.push(`PLANT_HEADROOM.height is ${PLANT_HEADROOM.height}, not warden.standHeight (${CONFIG.warden.standHeight})`);
      }

      // --- on top is still fine -------------------------------------------
      // The clause must not take the crate tops with it: D20 says "only on
      // top", and a top with open air above it is exactly that.
      const tops = plantableSpots(h).filter((spot) => spot.kind === 'top' && objective.canDefuseAt(spot.at));
      const open = tops.filter((spot) => objective.hasHeadroomAt(spot.at));
      if (!open.length) problems.push('no climbable top inside a site room has standing headroom, so "on top" is not being honoured');
      for (const top of open) {
        if (!top.legal) problems.push(`${top.what} is defusable and open above but refused`);
      }

      objective.resetMatch();
      objective.resetRound(1);
      h.shade.reset(h.map.shadeSpawns[0]);

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${ducts.length} enclosed interiors inside site rooms (${ducts.filter((d) => d.kind === 'vent').length} in ducts, `
            + `${ducts.filter((d) => d.kind === 'crawl').length} in crawl spaces), all refused by their lid: unmoved by a 50m defuse `
            + `reach, opened by dropping the headroom to ${(CONFIG.shade.crouchHeight * 0.5).toFixed(2)}m, refused `
            + `again on restore. ${open.length} of ${tops.length} reachable tops have open air above and stay legal`
          : problems.join('; '),
      };
    },
  });
}
