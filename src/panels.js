/**
 * BLACKLINE — panels.js
 *
 * The DOM panels the composition root puts on the page - the HUD, the
 * intermission scoreboard, the menu and the round-start briefing (C2) - and
 * what their buttons do. Split from main.js (C1) for the 600-line guard. Every handler reaches the live
 * objects through a getter, as wiring.js does: the menu is built before the
 * first match exists, and a scoreboard button outlives the match it was
 * drawn for.
 *
 * Layering (Section 3.1): imports ui/ and config. Nothing here imports
 * main.js; what it needs from the root - `initMatch`, `setPaused` - arrives
 * as arguments.
 */

import { rng, SETTINGS } from './config.js';
import { COMPETITIVE, FREEROAM } from './matchstate.js';
import { createHud } from './ui/hud.js';
import { createMenu } from './ui/menu.js';
import { createScoreboard } from './ui/scoreboard.js';
import { createBriefing } from './ui/briefing.js';

/**
 * @param {object} root
 * @param {(options?: object) => void} root.initMatch
 * @param {(paused: boolean) => void} root.setPaused
 * @param {() => object} root.objective the live objective system
 * @param {() => object} root.audio the live audio system
 * @param {() => object} root.match the current match record
 * @param {() => object} root.map the map, for the sites the briefing names
 * @param {() => object} root.input the Input, for the bindings it shows
 * @returns {{ hud: object, scoreboard: object, menu: object, briefing: object }}
 */
export function createPanels({ initMatch, setPaused, objective, audio, match, map, input }) {
  const hud = createHud();
  const briefing = createBriefing();

  // C2: the briefing goes up on the player's routes into a round - Play,
  // Free roam, Next round - and never from `initMatch`, which every AUTO
  // check calls. `SETTINGS.briefing` off is the click starting the round.
  const brief = () => {
    if (!SETTINGS.briefing) return;
    briefing.show({
      match: match(), round: objective().round.number, sites: map().sites, bindings: input().bindings,
    });
  };

  const scoreboard = createScoreboard({
    onNextRound: () => {
      // The next round, not round 1 again: `initMatch` rebuilds the round
      // (Section 15) and is told which one.
      initMatch({ ...match(), seed: rng.seed, round: objective().round.number + 1 });
      brief();
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
    onPlay: () => {
      // A fresh match is Play's own business (C4): the score and the round
      // records go here, not on whichever route brought the menu up.
      objective().resetMatch();
      initMatch(COMPETITIVE);
      brief();
    },
    onFreeRoam: () => {
      initMatch(FREEROAM);
      brief();
    },
    onResume: () => setPaused(false),
    onQuit: () => {
      setPaused(false);
      objective().resetMatch();
    },
  });

  return { hud, scoreboard, menu, briefing };
}
