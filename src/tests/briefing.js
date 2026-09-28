/**
 * BLACKLINE - tests/briefing.js
 *
 * AUTO suite: C2, the round-start briefing and controls card. It goes up on
 * the player's routes into a round - the menu's Play and Free roam, the
 * intermission's Next round - so the checks press those buttons rather
 * than calling `briefing.show()`; it holds the round, so frames drawn
 * behind it must move nothing; and any key dismisses it within one step,
 * through the real path: the code goes into `input.pressedCodes` and the
 * frame reads it, the way Esc is read.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG, SETTINGS } from '../config.js';
import { keyLabel } from '../ui/briefing.js';
import { press } from './feel.js';

const R = CONFIG.round;

/** Click a menu button the way the player does. */
function click(root, action) {
  const button = root.querySelector(`[data-action=${action}]`);
  if (!button) throw new Error(`no [data-action=${action}] button on the panel`);
  button.click();
}

/** Every string the card must carry for this match, and why. */
function expectedLines(h) {
  const b = h.input.bindings;
  const key = (action) => keyLabel(b[action][0]);
  const lines = [
    ['the role', h.match.role === 'warden' ? 'you are the warden' : 'you are the shade'],
    ['the move keys', ['forward', 'left', 'back', 'right'].map(key).join(' ')],
    ['the sprint key', key('sprint')],
    ['the pause key', key('pause')],
  ];
  for (const site of h.map.sites) lines.push([`site ${site.id}`, `${site.id} ${site.name}`]);
  lines.push(['the map', h.map.name]);
  if (h.match.role === 'warden') {
    lines.push(['the fire key', key('fire')], ['the aim key', key('ads')], ['the reload key', key('reload')]);
  } else {
    lines.push(['the jump key', key('jump')], ['the knife key', key('melee')], ['the crouch key', key('crouch')]);
  }
  if (h.match.objectiveEnabled) {
    lines.push(['the round number', `round ${h.objective.round.number}`]);
    lines.push(['the interact key', key('interact')]);
    lines.push(['the detonation clock', `${R.detonationTime} seconds`]);
    if (h.match.role === 'warden') lines.push(['the defuse hold', `${R.defuseHoldTime} seconds`]);
    else lines.push(['the plant hold', `${R.plantHoldTime} seconds`], ['the lives', `${CONFIG.shade.lives} lives`]);
  } else {
    lines.push(['free roam', 'free roam'], ['no clock', 'no clock']);
  }
  return lines;
}

/** What the card says, against what this match needs it to say. */
function readCard(h, label, problems) {
  if (!h.briefing.open) {
    problems.push(`${label}: no briefing went up`);
    return;
  }
  const text = h.briefing.text.replace(/\s+/g, ' ').toLowerCase();
  for (const [what, want] of expectedLines(h)) {
    if (!text.includes(want.toLowerCase())) problems.push(`${label}: the card does not name ${what} ("${want}")`);
  }
  if (h.match.role === 'warden' && text.includes('plant -')) problems.push(`${label}: a Warden card lists the plant`);
  if (h.match.role !== 'warden' && text.includes('reload')) problems.push(`${label}: a Shade card lists the reload`);
}

/** Frames drawn behind the card: the round must not move. */
function holds(h, label, problems) {
  const elapsed = h.objective.round.elapsed;
  const sim = h.clock.sim;
  press(h, 'KeyW');
  h.input.pressedCodes.clear();
  for (let i = 0; i < 5; i++) h.renderFrame();
  h.input.clearAll();
  if (!h.briefing.open) problems.push(`${label}: five frames with no press took the card down`);
  if (h.clock.sim !== sim) problems.push(`${label}: the simulation ran ${(h.clock.sim - sim).toFixed(3)}s behind the card`);
  if (h.objective.round.elapsed !== elapsed) problems.push(`${label}: the round ran behind the card`);
  if (h.hud.visible) problems.push(`${label}: the HUD is drawn behind the card`);
}

/** A press of `code`, one frame: the card is down and the round has stepped. */
function dismiss(h, code, label, problems) {
  const sim = h.clock.sim;
  press(h, code);
  h.renderFrame();
  if (h.briefing.open) problems.push(`${label}: ${code} did not dismiss the card within one frame`);
  if (h.clock.sim <= sim) problems.push(`${label}: the frame that took the card down ran no step`);
  if (h.input.heldCodes.size || h.input.pressedCodes.size) problems.push(`${label}: the dismissing press was not spent`);
  if (h.paused || h.menu.open) problems.push(`${label}: ${code} paused the game or raised the menu`);
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-round-opens-on-a-briefing-that-any-key-dismisses',
    spec: 'Section 13, amended (20.13; C2)',
    name: 'Play and Free roam raise a per-role briefing naming the objective, the sites and the live bindings; it holds the round; any key or mouse button dismisses it within one step',
    run: (h) => {
      const problems = [];
      const was = SETTINGS.briefing;
      SETTINGS.briefing = true;
      // H6: on a browser that has not seen it, Play offers the eight-move
      // tutorial before the round. This check is about the round's briefing,
      // so it states its precondition rather than depending on whatever a
      // check before it left `tutorialSeen` at (`tests/settings.js` calls
      // `resetSettings`). `the-first-run-tutorial-...` is what proves the
      // other branch.
      const wasSeen = SETTINGS.tutorialSeen;
      SETTINGS.tutorialSeen = true;
      try {
        // The Shade, from the main menu's Play button.
        h.menu.show('main');
        click(h.menu.root, 'play');
        if (h.menu.open) problems.push('Play left the menu open');
        if (h.match.role !== CONFIG.match.humanRole || !h.match.objectiveEnabled) problems.push('Play did not start the competitive match');
        readCard(h, 'shade', problems);
        holds(h, 'shade', problems);
        // Space dismisses, and is spent: the Shade does not leave the ground.
        const feetY = h.shade.feetY;
        dismiss(h, 'Space', 'shade', problems);
        h.renderFrame();
        if (h.shade.velocity.y > 0.01 || h.shade.feetY > feetY + 0.01) problems.push('the Space that dismissed the card was also a jump');
        if (!h.hud.visible) problems.push('the HUD did not come back after the card');

        // The Warden, from Free roam; a mouse button is a key here too.
        h.menu.show('main');
        click(h.menu.root, 'freeroam');
        if (h.match.role !== 'warden' || h.match.mode !== 'freeroam') problems.push('Free roam did not start free-roam');
        readCard(h, 'warden', problems);
        holds(h, 'warden', problems);
        dismiss(h, 'Mouse0', 'warden', problems);

        // Esc is a key like any other while the card is up: it does not pause.
        h.menu.show('main');
        click(h.menu.root, 'play');
        dismiss(h, 'Escape', 'esc', problems);
      } finally {
        SETTINGS.briefing = was;
        SETTINGS.tutorialSeen = wasSeen;
        h.briefing.hide();
        h.input.clearAll();
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      }
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `Play: the Shade's card names the objective, ${h.map.sites.length} sites and ${expectedLines(h).length - h.map.sites.length} required lines, `
            + 'holds the round for 5 frames, Space takes it down in one and is not a jump; '
            + 'Free roam: the Warden\'s card, LMB takes it down; Esc takes it down without pausing'
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-briefing-follows-the-round-and-the-setting-skips-it',
    spec: 'Section 13, amended (20.13; C2)',
    name: 'Next round raises the briefing for round 2 and the round number moves with it; with the setting off, Play and Next round start the round on the click',
    run: (h) => {
      const problems = [];
      const was = SETTINGS.briefing;
      // H6: Play offers the tutorial on a browser that has not seen it; this
      // check is about the round, so it says so rather than inheriting it.
      const wasSeen = SETTINGS.tutorialSeen;
      SETTINGS.tutorialSeen = true;
      try {
        // Round 1 from Play, ended on the clock through the real step, then
        // the intermission's Next round.
        SETTINGS.briefing = true;
        h.menu.show('main');
        click(h.menu.root, 'play');
        h.briefing.dismiss(h.input);
        h.objective.round.timeRemaining = 0.001;
        // C4: the intermission comes `roundEndDelay` after the end.
        h.stepFrames(2 + Math.ceil(R.roundEndDelay / CONFIG.time.fixedDt));
        if (!h.scoreboard.open) problems.push('the round end did not raise the intermission');
        click(h.scoreboard.root, 'next');
        if (h.scoreboard.open) problems.push('Next round left the intermission open');
        if (h.objective.round.number !== 2) problems.push(`Next round started round ${h.objective.round.number}, want 2`);
        if (h.match.roundNumber !== 2) problems.push(`the match record says round ${h.match.roundNumber}, want 2`);
        if (h.objective.score.warden !== 1) problems.push(`the score did not survive Next round (warden ${h.objective.score.warden})`);
        readCard(h, 'round 2', problems);
        dismiss(h, 'KeyE', 'round 2', problems);

        // The setting, from its row, and what it skips.
        h.menu.show('settings');
        const row = h.menu.root.querySelector('#bl-brief');
        if (!row) problems.push('the settings menu has no round briefing row');
        else {
          row.click();
          if (SETTINGS.briefing !== false) problems.push('the settings row did not turn the briefing off');
        }
        SETTINGS.briefing = false;
        h.objective.resetMatch();
        h.menu.show('main');
        click(h.menu.root, 'play');
        if (h.briefing.open) problems.push('with the setting off, Play raised the briefing');
        const sim = h.clock.sim;
        h.renderFrame();
        if (h.clock.sim <= sim) problems.push('with the setting off, the first frame after Play ran no step');
        h.objective.round.timeRemaining = 0.001;
        h.stepFrames(2 + Math.ceil(R.roundEndDelay / CONFIG.time.fixedDt));
        click(h.scoreboard.root, 'next');
        if (h.briefing.open) problems.push('with the setting off, Next round raised the briefing');
        if (h.objective.round.number !== 2) problems.push(`with the setting off, Next round started round ${h.objective.round.number}, want 2`);
        if (row) {
          h.menu.show('settings');
          h.menu.root.querySelector('#bl-brief').click();
          if (SETTINGS.briefing !== true) problems.push('the settings row did not turn the briefing back on');
        }
      } finally {
        SETTINGS.briefing = was;
        SETTINGS.tutorialSeen = wasSeen;
        h.menu.hide();
        h.scoreboard.hide();
        h.briefing.hide();
        h.input.clearAll();
        h.objective.resetMatch();
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      }
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? 'round 1 ended on the clock, Next round raised the card for round 2 with the score kept and the round number at 2; '
            + 'the settings row turns the briefing off, and off, Play and Next round step on the click'
          : problems.join('; '),
      };
    },
  });
}
