/**
 * BLACKLINE — panels.js
 *
 * The three DOM panels the composition root puts on the page - the HUD, the
 * intermission scoreboard and the menu - and what their buttons do. Split
 * from main.js (C1) for the 600-line guard. Every handler reaches the live
 * objects through a getter, as wiring.js does: the menu is built before the
 * first match exists, and a scoreboard button outlives the match it was
 * drawn for.
 *
 * Layering (Section 3.1): imports ui/ and config. Nothing here imports
 * main.js; what it needs from the root - `initMatch`, `setPaused` - arrives
 * as arguments.
 */

import { rng } from './config.js';
import { COMPETITIVE, FREEROAM } from './matchstate.js';
import { createHud } from './ui/hud.js';
import { createMenu } from './ui/menu.js';
import { createScoreboard } from './ui/scoreboard.js';

/**
 * @param {object} root
 * @param {(options?: object) => void} root.initMatch
 * @param {(paused: boolean) => void} root.setPaused
 * @param {() => object} root.objective the live objective system
 * @param {() => object} root.audio the live audio system
 * @param {() => object} root.match the current match record
 * @returns {{ hud: object, scoreboard: object, menu: object }}
 */
export function createPanels({ initMatch, setPaused, objective, audio, match }) {
  const hud = createHud();

  const scoreboard = createScoreboard({
    onNextRound: () => {
      objective().resetRound();
      initMatch({ ...match(), seed: rng.seed });
    },
    onMenu: () => {
      objective().resetMatch();
      menu.show('main');
    },
  });

  // Section 12: both modes boot through the same initMatch, so the menu
  // picks a configuration rather than a code path.
  const menu = createMenu({
    onFirstGesture: () => audio().unlock(),
    onVolume: (value) => audio().setMasterVolume(value),
    onPlay: () => initMatch(COMPETITIVE),
    onFreeRoam: () => initMatch(FREEROAM),
    onResume: () => setPaused(false),
    onQuit: () => {
      setPaused(false);
      objective().resetMatch();
    },
  });

  return { hud, scoreboard, menu };
}
