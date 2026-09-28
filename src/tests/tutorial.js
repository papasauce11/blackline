/**
 * BLACKLINE - tests/tutorial.js
 *
 * AUTO suite (Section 13, H6): the first-run tutorial's eight moves, driven.
 *
 * The chain's whole claim is that a prompt clears on the **act** and not on
 * the key, so a check that set `tutorial.reading` by hand would be testing
 * nothing at all. Every step below is cleared by driving the real controller
 * through `input.heldCodes` / `input.pressedCodes` and stepping the real
 * fixed step, which is where `sim:step` reaches the watcher.
 *
 * What is NOT driven is the walk between the features: the body is placed at
 * each ledge, lip and duct the way every traversal check in this project
 * places it (`driveAtLedge`, `findGroundLedge`), because the chain is about
 * the moves and not about crossing the map. The acts themselves are real.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG, SETTINGS } from '../config.js';
import { SHADE_STATE } from '../entities/agent.js';
import { TUTORIAL } from '../matchstate.js';
import { tutorialFits } from '../systems/tutorial.js';
import { driveAtLedge, findGroundLedge } from './movement.js';
import { spotOffTheRing } from './plantspots.js';
import { CHARGE } from '../systems/objective.js';

const S = CONFIG.shade;
const TUT = CONFIG.tutorial;

/** One fixed step through the real input path, edges cleared after, as the loop does. */
function step(h, count = 1) {
  for (let i = 0; i < count; i++) {
    h.stepFrames(1);
    h.input.clearEdges();
  }
}

/** The first code bound to an action, which is what a player would press. */
function code(h, action) {
  const codes = h.input.bindings[action] || [];
  return codes[0] || null;
}

/**
 * A duct at grade the chain can be slid into, and a run-up outside one of its
 * mouths: far enough back to reach a sprint, clear for a standing body, and
 * facing along the run. Derived from the map, never named.
 *
 * @returns {{vent: object, x: number, z: number, yaw: number}|null}
 */
export function findVentRunUp(h) {
  const ground = CONFIG.map.groundY;
  const standHalf = { x: S.radius, y: S.standHeight / 2, z: S.radius };
  for (const vent of h.map.vents) {
    const height = vent.max.y - vent.min.y;
    if (height < S.crouchHeight || height >= S.standHeight) continue;
    if (vent.min.y - ground >= 0.35) continue;
    const alongX = vent.axis === 'x';
    const cx = (vent.min.x + vent.max.x) / 2;
    const cz = (vent.min.z + vent.max.z) / 2;
    // Both mouths, at a few run-up lengths; the first that is clear wins.
    for (const sign of [-1, 1]) {
      for (const back of [7, 5.5, 4.5]) {
        const x = alongX ? (sign < 0 ? vent.min.x - back : vent.max.x + back) : cx;
        const z = alongX ? cz : (sign < 0 ? vent.min.z - back : vent.max.z + back);
        // Forward is (-sin yaw, -cos yaw), pointed into the run.
        const yaw = alongX ? (sign < 0 ? -Math.PI / 2 : Math.PI / 2) : (sign < 0 ? Math.PI : 0);
        if (!h.map.collision.isClear({ x, y: ground + standHalf.y + 0.02, z }, standHalf)) continue;
        // And the lane between here and the mouth, at a stride's spacing.
        let lane = true;
        for (let d = 0.8; d < back; d += 0.8) {
          const px = alongX ? x - sign * -d * 0 + (sign < 0 ? d : -d) : x;
          const pz = alongX ? z : (sign < 0 ? z + d : z - d);
          if (!h.map.collision.isClear({ x: px, y: ground + standHalf.y + 0.02, z: pz }, standHalf)) { lane = false; break; }
        }
        if (!lane) continue;
        return { vent, x, z, yaw };
      }
    }
  }
  return null;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-first-run-tutorial-clears-every-prompt-on-the-act',
    spec: 'Section 13, H6',
    // The plant's ducts at grade are what step 4 needs; `tutorialFits` is the
    // rule and this says which map it happens to be true of today.
    maps: ['plant'],
    name: 'All eight prompts are cleared by driving the real controller, each on the act and not on the key press, and the chain ends itself',
    run: (h) => {
      const problems = [];
      const tutorial = h.tutorial;
      const wasSeen = SETTINGS.tutorialSeen;
      const wasBriefing = SETTINGS.briefing;
      const wasGod = h.debugState.godMode;
      const done = [];
      try {
        SETTINGS.briefing = false;
        h.initMatch(TUTORIAL);
        h.debugState.godMode = true;
        tutorial.start();
        const shade = h.shade;
        const ground = CONFIG.map.groundY;

        /** The id of the step that is up, for a failure that names itself. */
        const at = () => (tutorial.step ? tutorial.step.id : '(none)');
        /** Assert the step that was up has been cleared, and record it. */
        const cleared = (id, note) => {
          if (tutorial.step && tutorial.step.id === id) {
            problems.push(`"${id}" did not clear: ${JSON.stringify({
              ...tutorial.reading, _climbFrom: undefined,
            })}`);
            return false;
          }
          done.push(`${id}${note ? ` (${note})` : ''}`);
          return true;
        };

        // ---- 1. move -------------------------------------------------------
        if (at() !== 'move') problems.push(`the chain opened on "${at()}", want "move"`);
        const spawn = h.map.shadeSpawns[0];
        /** Back to the spawn's clear apron: a run that ends at the shell wall
         *  is a run that never reaches a sprint, which is how this first read
         *  5.1m/s against a 6.5 sprint. */
        const fromSpawn = () => {
          shade.reset({ position: spawn.position, yaw: spawn.yaw });
          step(h, 2);
          h.input.clearAll();
        };

        fromSpawn();
        h.input.heldCodes.add(code(h, 'forward'));
        step(h, 90);
        // The note cannot read `tutorial.reading` after the step clears: by
        // then it is the NEXT step's, freshly zeroed, and a detail line that
        // prints the wrong number is worse than one that prints none.
        cleared('move', `${TUT.walkDistance}m on the ground`);

        // ---- 2. sprint -----------------------------------------------------
        fromSpawn();
        h.input.heldCodes.add(code(h, 'forward'));
        h.input.heldCodes.add(code(h, 'sprint'));
        let top = 0;
        for (let i = 0; i < 120 && tutorial.step && tutorial.step.id === 'sprint'; i++) {
          step(h, 1);
          top = Math.max(top, shade.speed);
        }
        cleared('sprint', `${top.toFixed(1)}m/s of ${S.sprintSpeed}`);
        h.input.clearAll();

        // ---- 3. crouch -----------------------------------------------------
        fromSpawn();
        h.input.heldCodes.add(code(h, 'crouch'));
        h.input.pressedCodes.add(code(h, 'crouch'));
        step(h, 20);
        cleared('crouch');
        h.input.clearAll();
        step(h, 10);

        // ---- 4. slide into the duct ---------------------------------------
        const run = findVentRunUp(h);
        if (!run) {
          problems.push('no duct at grade with a clear run-up: step 4 cannot be driven on this map');
        } else {
          shade.reset({ position: { x: run.x, y: ground, z: run.z }, yaw: run.yaw });
          step(h, 2);
          h.input.clearAll();
          h.input.heldCodes.add(code(h, 'forward'));
          h.input.heldCodes.add(code(h, 'sprint'));
          // Up to sprint first: a slide needs `slideMinEntrySpeed` behind it,
          // which is the whole reason a duct cannot be walked into.
          step(h, 60);
          const entry = shade.speed;
          h.input.heldCodes.add(code(h, 'crouch'));
          h.input.pressedCodes.add(code(h, 'crouch'));
          step(h, 1);
          h.input.clearEdges();
          const slid = shade.state === SHADE_STATE.SLIDE;
          step(h, 60);
          cleared('slide', `entered at ${entry.toFixed(1)}m/s${slid ? ', slid' : ', did not slide'}`);
          h.input.clearAll();
        }

        // ---- 5. jump -------------------------------------------------------
        fromSpawn();
        h.input.heldCodes.add(code(h, 'jump'));
        h.input.pressedCodes.add(code(h, 'jump'));
        step(h, 6);
        h.input.clearAll();
        step(h, 40);
        cleared('jump');

        // ---- 6. climb ------------------------------------------------------
        // A ledge a standing body can get onto, taken with a held jump, and
        // the tutorial wants the feet to end higher than they started.
        const low = findGroundLedge(h, S.reach.stepOver + 0.2, S.reach.standing);
        if (!low) problems.push('no ground-level ledge within standing reach: step 6 cannot be driven');
        else {
          const drive = driveAtLedge(h, low, { airborne: false, pressAt: 5, hold: true, steps: 120 });
          // Settle: the reading only banks the rise once the body is grounded
          // again, and `driveAtLedge` stops the moment the feet clear the lip.
          step(h, 20);
          const note = `${low.box.tag || 'a ledge'} ${(low.box.max.y - ground).toFixed(2)}m, `
            + `states ${drive.states}, feet ${drive.feet.toFixed(2)} from ${ground.toFixed(2)}, `
            + `grounded ${drive.grounded}`;
          if (tutorial.step && tutorial.step.id === 'climb') problems.push(`climb drive: ${note}`);
          cleared('climb', note);
        }

        // ---- 7. tap to hang ------------------------------------------------
        const high = findGroundLedge(h, S.standHeight * S.hangMinHeightRatio,
          S.reach.standing + S.reach.jumpBonus, { hangable: true });
        if (!high) problems.push('no hangable ground-level ledge: step 7 cannot be driven');
        else {
          driveAtLedge(h, high, { airborne: false, pressAt: 5, hold: false, steps: 90 });
          cleared('hang', `${high.box.tag || 'a lip'}, state ${shade.state}`);
          h.input.clearAll();
        }

        // ---- 8. plant ------------------------------------------------------
        // The real hold, at a spot the plant rule allows, through the fixed
        // step - so the objective system emits the event the chain listens
        // for, and the key that does it is the bound one.
        const site = h.map.sites[0];
        const spot = spotOffTheRing(h, site, CONFIG.round.siteRadius * 3);
        shade.reset(h.map.shadeSpawns[0]);
        shade.position.set(spot.x, spot.y + S.standHeight / 2 + 0.05, spot.z);
        step(h, 2);
        h.input.clearAll();
        h.input.heldCodes.add(code(h, 'interact'));
        step(h, Math.ceil(CONFIG.round.plantHoldTime / CONFIG.time.fixedDt) + 45);
        if (h.objective.round.charge === CHARGE.CARRIED) {
          problems.push(`the hold did not plant (charge ${h.objective.round.charge})`);
        }
        h.input.clearAll();
        cleared('plant');

        // ---- and the chain ends itself ------------------------------------
        if (!tutorial.finished) problems.push(`after eight moves the chain is on "${at()}" and not finished`);
        if (!SETTINGS.tutorialSeen) problems.push('a finished chain did not mark the browser as having seen it');
        if (h.tutorialPanel.open) problems.push('the prompt is still on screen after the chain ended');
        // And what it hands over to: the match Play was pressed for.
        if (h.match.mode !== 'competitive' || h.match.role !== CONFIG.match.humanRole) {
          problems.push(`the chain ended into a ${h.match.mode} match as the ${h.match.role}`);
        }
      } finally {
        h.debugState.godMode = wasGod;
        SETTINGS.tutorialSeen = wasSeen;
        SETTINGS.briefing = wasBriefing;
        h.input.clearAll();
        h.tutorialPanel.hide();
        h.objective.resetMatch();
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `all ${tutorial.steps.length} prompts cleared by driving the controller: ${done.join('; ')}; `
            + 'the chain ended itself into the competitive match'
          : `at "${done.length ? done[done.length - 1] : 'the start'}": ${problems.join('; ')}`,
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-tutorial-is-offered-once-and-can-be-skipped',
    spec: 'Section 13, H6',
    name: 'Play raises the chain on a browser that has not seen it, the Skip button ends it, and a second Play goes straight to the round',
    run: (h) => {
      const problems = [];
      const tutorial = h.tutorial;
      const wasSeen = SETTINGS.tutorialSeen;
      const wasBriefing = SETTINGS.briefing;
      const fits = tutorialFits(h.map);
      try {
        SETTINGS.briefing = false;

        // 1. Unseen: Play offers it, and the prompt is on screen and readable.
        SETTINGS.tutorialSeen = false;
        h.objective.resetMatch();
        h.menu.show('main');
        h.menu.root.querySelector('[data-action=play]').click();
        if (!fits) {
          // A map with no duct at grade cannot complete step 4, so it is not
          // offered there at all - and Play must still start the round.
          if (tutorial.running) problems.push('the chain was offered on a map that cannot finish it');
          if (h.match.mode !== 'competitive') problems.push(`Play started a ${h.match.mode} match instead of the round`);
        } else {
          if (!tutorial.running) problems.push('Play did not raise the chain on a browser that has not seen it');
          if (h.match.mode !== 'freeroam' || h.match.role !== 'shade' || !h.match.objectiveEnabled) {
            problems.push(`the chain runs in a ${h.match.mode} match as the ${h.match.role}, objective ${h.match.objectiveEnabled}`);
          }
          if (!h.tutorialPanel.open) problems.push('the chain is running with no prompt on screen');
          const text = h.tutorialPanel.root.textContent;
          if (text.indexOf('1 of ') === -1) problems.push(`the prompt does not say where in the chain it is: "${text.slice(0, 40)}"`);
          // The prompt names a key, and the key it names is a bound one.
          const forward = (h.input.bindings.forward || [])[0];
          if (forward && text.indexOf(forward.replace(/^(Key|Digit)/, '')) === -1) {
            problems.push(`the first prompt does not name the movement key (${forward})`);
          }

          // 2. Skip ends it, from the button a player would click.
          h.tutorialPanel.root.querySelector('#bl-tutorial-skip').click();
          if (tutorial.running) problems.push('Skip left the chain running');
          if (!SETTINGS.tutorialSeen) problems.push('Skip did not mark the browser as having been offered it');
          if (h.tutorialPanel.open) problems.push('Skip left the prompt on screen');
          if (h.match.mode !== 'competitive') problems.push(`Skip left a ${h.match.mode} match running`);
        }

        // 3. Seen: Play goes straight to the round. This is the "second boot"
        // half of the done-when - a reload is a fresh SETTINGS until H7 puts
        // them in a store, so what is testable is the flag the store will hold.
        SETTINGS.tutorialSeen = true;
        h.objective.resetMatch();
        h.menu.show('main');
        h.menu.root.querySelector('[data-action=play]').click();
        if (tutorial.running) problems.push('a browser that has seen it was offered it again');
        if (h.match.mode !== 'competitive' || h.match.role !== CONFIG.match.humanRole) {
          problems.push(`the second Play started a ${h.match.mode} match as the ${h.match.role}`);
        }
        if (h.tutorialPanel.open) problems.push('the second Play put the prompt up');
      } finally {
        SETTINGS.tutorialSeen = wasSeen;
        SETTINGS.briefing = wasBriefing;
        h.menu.hide();
        h.tutorialPanel.hide();
        h.input.clearAll();
        h.objective.resetMatch();
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? (fits
            ? 'Play raises the chain once, the prompt names the step and the key, Skip ends it into the round, and a second Play goes straight there'
            : `${h.map.id} has no duct at grade, so the chain is not offered here and Play starts the round`)
          : problems.join('; '),
      };
    },
  });
}
