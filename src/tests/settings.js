/**
 * BLACKLINE - tests/settings.js
 *
 * AUTO suite (Section 16, Section 17.1): the Section 13 settings menu.
 *
 * These checks exist because a setting that changes a label and nothing else is
 * indistinguishable from one that works, right up until someone plays on "hard"
 * and wonders why it is not harder. So nothing here asserts that SETTINGS holds
 * the value it was given — it asserts that the *game* changed behaviour.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG, SETTINGS, resetSettings } from '../config.js';

const A = CONFIG.ai;

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'difficulty-preset-reaches-the-ai',
    spec: 'Section 11 / Section 13',
    name: 'All three presets change the AI fill rate, aim error and reaction delay',
    run: (h) => {
      const problems = [];
      const was = SETTINGS.difficulty;
      const names = Object.keys(A.difficulty);
      const seen = [];

      if (names.length !== 3) problems.push(`${names.length} difficulty presets, Section 11 asks for three`);

      for (const name of names) {
        SETTINGS.difficulty = name;
        // A new match is what re-reads the setting, which is the right moment:
        // difficulty must not change under a player mid-round.
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
        const live = h.wardenAI.difficulty;
        const want = A.difficulty[name];
        if (live !== want) {
          problems.push(`"${name}": the AI is running ${JSON.stringify(live)}, config says ${JSON.stringify(want)}`);
        }
        if (h.match.difficulty !== name) {
          problems.push(`"${name}": the match recorded difficulty "${h.match.difficulty}"`);
        }
        seen.push(`${name} fill ${live.fillRate}/s aim ${live.aimErrorDegrees}deg react ${live.reactionDelay}s`);
      }

      // The three must actually differ, or "three presets" is decoration.
      const fills = new Set(names.map((n) => A.difficulty[n].fillRate));
      const aims = new Set(names.map((n) => A.difficulty[n].aimErrorDegrees));
      const delays = new Set(names.map((n) => A.difficulty[n].reactionDelay));
      if (fills.size !== 3) problems.push('the presets do not all differ in fill rate');
      if (aims.size !== 3) problems.push('the presets do not all differ in aim error');
      if (delays.size !== 3) problems.push('the presets do not all differ in reaction delay');

      // Section 11: "Default is medium: 120ms reaction delay, 2.5 degree aim error."
      const medium = A.difficulty[A.defaultDifficulty];
      if (A.defaultDifficulty !== 'medium') problems.push(`default is "${A.defaultDifficulty}", spec says medium`);
      if (Math.abs(medium.reactionDelay - 0.12) > 1e-9) {
        problems.push(`medium reaction delay ${medium.reactionDelay}s, spec 0.12s`);
      }
      if (Math.abs(medium.aimErrorDegrees - 2.5) > 1e-9) {
        problems.push(`medium aim error ${medium.aimErrorDegrees}deg, spec 2.5deg`);
      }

      // An unknown value must fall back rather than leave the AI undefined.
      SETTINGS.difficulty = 'nonsense';
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      if (h.wardenAI.difficulty !== medium) problems.push('an unknown difficulty did not fall back to the default');

      SETTINGS.difficulty = was;
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${seen.join('; ')}; unknown falls back to ${A.defaultDifficulty}`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'match-length-reaches-the-scoreboard',
    spec: 'Section 10.5 / Section 13',
    name: 'Best of 5 and best of 11 change the wins needed everywhere they are shown',
    run: (h) => {
      const problems = [];
      const was = SETTINGS.matchLength;
      const lengths = Object.keys(CONFIG.match.lengths).map(Number);
      const seen = [];

      // Section 10.5: best of 5 (first to 3) by default, best of 11 (first to 6).
      if (CONFIG.match.lengths[5] !== 3) problems.push(`best of 5 needs ${CONFIG.match.lengths[5]} wins, spec 3`);
      if (CONFIG.match.lengths[11] !== 6) problems.push(`best of 11 needs ${CONFIG.match.lengths[11]} wins, spec 6`);

      for (const length of lengths) {
        SETTINGS.matchLength = length;
        const wanted = CONFIG.match.lengths[length];

        // The objective system is what actually ends a match.
        if (h.objective.target !== wanted) {
          problems.push(`best of ${length}: objective counts to ${h.objective.target}, want ${wanted}`);
        }
        // And the match state the composition root builds must agree with it.
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
        if (h.match.matchLength !== length) problems.push(`best of ${length}: match recorded ${h.match.matchLength}`);
        if (h.match.winsNeeded !== wanted) {
          problems.push(`best of ${length}: match wants ${h.match.winsNeeded} wins, objective wants ${wanted}`);
        }
        // And the intermission has to print the same number to the player.
        const wasOpen = h.scoreboard.open;
        h.scoreboard.show({ rounds: [], score: { shade: 0, warden: 0 }, matchOver: false });
        const printed = /first to (\d+)/.exec(h.scoreboard.root.textContent);
        if (!printed || Number(printed[1]) !== wanted) {
          problems.push(`best of ${length}: the scoreboard printed "${printed && printed[0]}", want first to ${wanted}`);
        }
        if (!wasOpen) h.scoreboard.hide();
        seen.push(`best of ${length} -> first to ${wanted}`);
      }

      // resetSettings() must put every live value back, not just some. That
      // includes the debug gate (C1), which the suite holds up for the run:
      // put it back after, or every check that presses F4 from here on
      // presses a dead key.
      const gate = SETTINGS.debug;
      SETTINGS.matchLength = 11;
      SETTINGS.difficulty = 'hard';
      resetSettings();
      for (const key of Object.keys(CONFIG.settings.defaults)) {
        if (SETTINGS[key] !== CONFIG.settings.defaults[key]) {
          problems.push(`resetSettings left ${key} at ${SETTINGS[key]}`);
        }
      }
      SETTINGS.debug = gate;

      SETTINGS.matchLength = was;
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${seen.join(', ')}; objective, match state and the intermission all agree; `
            + `resetSettings restored all ${Object.keys(CONFIG.settings.defaults).length} values`
          : problems.join('; '),
      };
    },
  });
}
