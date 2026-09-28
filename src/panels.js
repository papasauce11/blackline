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
import { bindingConflicts } from './input.js';
import { COMPETITIVE, FREEROAM, TUTORIAL } from './matchstate.js';
import { loadVersion, versionLabel } from './version.js';
import { saveSettings, clearSettings } from './settingsstore.js';
import { createHud } from './ui/hud.js';
import { createMenu } from './ui/menu.js';
import { createScoreboard } from './ui/scoreboard.js';
import { createBriefing, keyLabel } from './ui/briefing.js';
import { createTutorialPanel } from './ui/tutorial.js';
import { tutorialSeen, tutorialFits } from './systems/tutorial.js';

/**
 * @param {object} root
 * @param {(options?: object) => void} root.initMatch
 * @param {(paused: boolean) => void} root.setPaused
 * @param {() => object} root.objective the live objective system
 * @param {() => object} root.audio the live audio system
 * @param {() => object} root.match the current match record
 * @param {() => object} root.map the map, for the sites the briefing names
 * @param {() => object} root.input the Input, for the bindings it shows
 * @param {{id: string, name: string}[]} root.maps every registered map, for the menu's cards (D1, H5)
 * @param {(id: string) => void} root.goToMap what a card does: another page load
 * @param {object} root.thumbnails the map pictures (H5, thumbnails.js): `get(id)`
 *   and a `ready` promise the menu is re-rendered on
 * @param {object} root.emitter the one emitter, for the tutorial's own events (H6)
 * @param {object} root.tutorial the first-run chain (H6, systems/tutorial.js)
 * @returns {{ hud: object, scoreboard: object, menu: object, briefing: object }}
 */
export function createPanels({
  initMatch, setPaused, objective, audio, match, map, input, maps, goToMap, thumbnails, emitter, tutorial,
}) {
  const hud = createHud();
  const briefing = createBriefing();
  const tutorialPanel = createTutorialPanel({ onSkip: () => tutorial && tutorial.skip() });

  // C2: the briefing goes up on the player's routes into a round - Play,
  // Free roam, Next round - and never from `initMatch`, which every AUTO
  // check calls. `SETTINGS.briefing` off is the click starting the round.
  const brief = () => {
    if (!SETTINGS.briefing) return;
    briefing.show({
      match: match(), round: objective().round.number, sites: map().sites, bindings: input().bindings,
      mapName: map().name,
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
    maps,
    // H3: which build this is, in the main menu's footer.
    version: () => versionLabel(),
    // H7: a decision was made. Every settings row and the role row end here,
    // and a blocked store is a `{ saved: false }` nobody has to handle.
    onSettingChanged: () => saveSettings(),
    onResetSettings: () => clearSettings(),
    // H5: a card's picture, null until it has been rendered. A getter, like
    // the stamp, so the menu can be drawn before they exist.
    thumbnail: (id) => (thumbnails ? thumbnails.get(id) : null),
    // H5: the live bindings, so How to play names the keys a rebind left.
    bindings: () => (input() ? input().bindings : null),
    // H8: the controls page. The map itself is the Input's, so the page asks
    // it three questions rather than keeping a copy that could drift - what
    // is bound, what is bound twice, and put this one back.
    conflicts: () => (input() ? bindingConflicts(input().bindings) : new Map()),
    onRebind: (action, code) => {
      if (!input()) return;
      input().rebind(action, code);
      // Binding a key must not also fire it. The keydown that bound it is
      // being delivered to the Input as well, and which listener runs first
      // is not ours to decide, so the Input is gated until the key comes
      // back up rather than merely cleared here.
      input().swallowPress();
    },
    onResetBinding: (action) => input() && input().resetBinding(action),
    mapId: () => map().id,
    onMap: (id) => goToMap(id),
    onFirstGesture: () => audio().unlock(),
    onVolume: (value) => audio().setMasterVolume(value),
    onPlay: () => {
      // A fresh match is Play's own business (C4): the score and the round
      // records go here, not on whichever route brought the menu up.
      objective().resetMatch();
      // H5: the map this page is on is the one the next page load opens on.
      SETTINGS.lastMap = map().id;
      saveSettings();
      // H6: the first time anyone presses Play, the eight moves first. It is
      // the same `initMatch` with a different configuration (Section 12), and
      // no briefing - the tutorial is the briefing, and the round's own one
      // goes up when the chain ends.
      if (tutorial && !tutorialSeen() && tutorialFits(map())) {
        initMatch(TUTORIAL);
        tutorial.start();
        return;
      }
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

  // H3: the stamp is a fetch, and the menu is drawn before it lands. Re-draw
  // the main page when it does, and only that page: a settings page open at
  // the time would be thrown away, and a check mid-run would lose its DOM.
  loadVersion().then(() => { if (menu.page === 'main') menu.render(); });

  // H5, the same shape: the cards are rendered after the harness is published
  // and arrive a moment after the menu is first drawn. Re-draw the main page
  // when they land, and only that page, for the reason above.
  if (thumbnails) thumbnails.ready.then(() => { if (menu.page === 'main') menu.render(); });

  // H6: the chain's one line on screen, and what happens when it ends. The
  // panel never decides anything - it draws the step the system is on.
  if (emitter) {
    // `[W]` rather than `W`, so the panel can pick the keys out of the
    // sentence; the labels are the live bindings, as the briefing card's are.
    const key = (action) => {
      const codes = (input() && input().bindings[action]) || [];
      return codes.length ? `[${keyLabel(codes[0])}]` : '[unbound]';
    };
    emitter.on('tutorial:step', ({ index, of }) => {
      tutorialPanel.show({ text: tutorial.steps[index].text(key), index, of });
    });
    emitter.on('tutorial:end', () => {
      tutorialPanel.hide();
      // Into the match they asked for when they pressed Play. The briefing
      // holds the round until a key, which is the beat between the two.
      objective().resetMatch();
      initMatch(COMPETITIVE);
      brief();
    });
  }

  return { hud, scoreboard, menu, briefing, tutorialPanel };
}
