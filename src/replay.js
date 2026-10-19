/**
 * BLACKLINE - replay.js
 *
 * Replays (H13). Every round is journaled as it is played - the keys held, the
 * keys pressed and where the human looked, step by step - beside the map, the
 * seed and the match it was opened with, and a journal played back through the
 * same steps reaches the same end. That is the whole claim, and
 * `every-shipped-replay-replays-to-its-recorded-end` holds it for every file
 * under `tests/replays/`.
 *
 * **What is journaled is what a step reads.** The controllers read the input
 * layer's two sets, `heldCodes` and `pressedCodes`, and the human actor's
 * `yaw` and `pitch`, which the mouse moves once per frame between steps. So a
 * journal is three kinds of event keyed by step: a code going down or up
 * (`+`, `-`), the press edges a step saw (`p`, exactly the set, because a key
 * tapped inside one frame is pressed and never held), and an orientation the
 * human was given between two steps (`look`). The look is recorded as where
 * the actor *was*, not as a mouse delta: a delta goes through the live
 * sensitivity and `invertY`, and a replay must not depend on a setting. And
 * only the change between the end of one step and the start of the next is a
 * look - a turn the simulation makes inside a step is the simulation's own, and
 * replaying it would hide the very divergence a replay exists to show.
 *
 * **Codes, with the keymap they were pressed under.** A journal names codes,
 * as the bug report does (H12), and carries the bindings in force, which a
 * playback puts back for its length: a replay recorded before a rebind (H8,
 * H19) still means what it meant.
 *
 * **One round at a time.** `initMatch` is where a journal starts - every
 * route into a round passes through it - so a journal is a round, opened with
 * the score it started on.
 *
 * Playback overwrites the input sets before every step and pins the actor to
 * where the journal says, so a live keyboard or mouse during a replay moves
 * nothing. Layering (Section 3.1): config only, plus the DOM routes at the
 * bottom (`?replay=` and a dropped file), which boot.js installs.
 */

import { rng } from './config.js';

export const REPLAY_VERSION = 1;

/** Six decimals: the end state is compared as numbers a file can carry exactly. */
const fix = (v) => Math.round(v * 1e6) / 1e6;

/** The end of a round, as a replay asserts it. */
export function endState({ shade, warden, objective }) {
  const at = (a) => [a.position.x, a.position.y, a.position.z, a.yaw].map(fix);
  const round = objective.round;
  return {
    shade: at(shade),
    shadeHealth: fix(shade.health),
    warden: at(warden),
    wardenState: warden.state,
    round: { number: round.number, state: round.state, outcome: round.outcome || null, timeRemaining: fix(round.timeRemaining), charge: round.charge },
    score: { shade: objective.score.shade, warden: objective.score.warden },
    rngCalls: rng.calls,
  };
}

/** Where two end states differ, by key, or an empty list. */
export function endDiff(want, got) {
  const keys = new Set([...Object.keys(want || {}), ...Object.keys(got || {})]);
  const out = [];
  for (const key of keys) {
    const a = JSON.stringify(want ? want[key] : undefined);
    const b = JSON.stringify(got ? got[key] : undefined);
    if (a !== b) out.push(`${key} ${a} -> ${b}`);
  }
  return out;
}

/** Why a parsed file is not a replay this build can play, or null. */
export function refuse(replay) {
  if (!replay || typeof replay !== 'object') return 'not a replay';
  if (replay.v !== REPLAY_VERSION) return `replay version ${replay.v}, this build plays ${REPLAY_VERSION}`;
  if (!Array.isArray(replay.events) || !Number.isInteger(replay.steps) || !replay.match || !replay.map) return 'a replay with no events, steps, match or map';
  return null;
}

/**
 * @param {object} live getters the composition root hands down
 * @param {() => object} live.match @param {() => object} live.map
 * @param {() => object} live.shade @param {() => object} live.warden
 * @param {() => object} live.objective @param {() => object} live.input
 * @param {(options: object) => object} live.initMatch
 * @param {() => string} live.build the commit the journal was recorded on
 */
export function createReplays(live) {
  let header = null;
  let step = 0;
  let held = new Set();
  let events = [];
  /** The human's orientation when the last step ended. */
  let after = null;
  /** The replay being played, or null. */
  let playing = null;

  const human = () => {
    const m = live.match();
    if (!m) return null;
    return m.role === 'warden' ? live.warden() : live.shade();
  };

  function journal(input, actor) {
    const before = events.length;
    for (const code of input.heldCodes) if (!held.has(code)) events.push([step, '+', code]);
    for (const code of held) if (!input.heldCodes.has(code)) events.push([step, '-', code]);
    // A copy only when something moved: this runs every step.
    if (events.length !== before) held = new Set(input.heldCodes);
    if (input.pressedCodes.size) events.push([step, 'p', ...input.pressedCodes]);
    if (actor && (!after || actor.yaw !== after[0] || actor.pitch !== after[1])) events.push([step, 'look', actor.yaw, actor.pitch]);
  }

  function feed(input, actor) {
    const p = playing;
    let look = null;
    input.pressedCodes.clear();
    while (p.at < p.events.length && p.events[p.at][0] === step) {
      const [, kind, ...rest] = p.events[p.at++];
      if (kind === '+') p.held.add(rest[0]);
      else if (kind === '-') p.held.delete(rest[0]);
      else if (kind === 'p') for (const code of rest) input.pressedCodes.add(code);
      else if (kind === 'look') look = rest;
    }
    input.heldCodes.clear();
    for (const code of p.held) input.heldCodes.add(code);
    // Pinned every step, not only on a look: between two looks the actor ends
    // one step where it starts the next, whatever a live mouse did meanwhile.
    const at = look || after;
    if (actor && at) {
      actor.yaw = at[0];
      actor.pitch = at[1];
    }
  }

  function finish() {
    const done = playing;
    playing = null;
    const input = live.input();
    for (const action of Object.keys(done.keep)) input.setBinding(action, done.keep[action]);
    input.clearAll();
    const end = endState({ shade: live.shade(), warden: live.warden(), objective: live.objective() });
    if (done.onEnd) done.onEnd({ end, diff: endDiff(done.replay.end, end) });
  }

  return {
    get playing() { return !!playing; },
    get steps() { return step; },

    /** A round opened (`match:init`): the journal starts over. */
    begin() {
      const m = live.match();
      const input = live.input();
      const bindings = {};
      if (input) for (const action of Object.keys(input.bindings)) bindings[action] = input.bindings[action].slice();
      header = {
        v: REPLAY_VERSION,
        build: live.build(),
        map: live.map().id,
        seed: m.seed,
        match: {
          mode: m.mode, role: m.role, ai: m.aiEnabled, objective: m.objectiveEnabled,
          matchLength: m.matchLength, difficulty: m.difficulty, round: m.roundNumber,
        },
        score: { ...live.objective().score },
        bindings,
      };
      step = 0;
      held = new Set();
      events = [];
      after = null;
    },

    /** Before a fixed step: feed a playback in, then journal what the step will read. */
    before(input) {
      const actor = human();
      if (playing) feed(input, actor);
      journal(input, actor);
    },

    /** After a fixed step (`sim:step`): where the human ended it. */
    after() {
      const actor = human();
      after = actor ? [actor.yaw, actor.pitch] : null;
      step++;
      if (playing && step >= playing.replay.steps) finish();
    },

    /** This round's journal so far, as a file, with the end it has reached. */
    save() {
      const end = endState({ shade: live.shade(), warden: live.warden(), objective: live.objective() });
      return { ...header, steps: step, events: events.map((e) => e.slice()), end };
    },

    /**
     * Play a replay from its first step. The round is opened as it was - the
     * match, the seed, the score, the keymap - and from here every step is the
     * journal's. `onEnd` hears the end state and how it differs from the file's.
     *
     * @returns {{ok: boolean, why: string}}
     */
    play(replay, { onEnd } = {}) {
      const why = refuse(replay);
      if (why) return { ok: false, why };
      if (replay.map !== live.map().id) return { ok: false, why: `this page is on ${live.map().id} and the replay is of ${replay.map}` };
      const input = live.input();
      const keep = {};
      for (const action of Object.keys(input.bindings)) keep[action] = input.bindings[action].slice();
      for (const action of Object.keys(replay.bindings || {})) {
        if (action in input.bindings && Array.isArray(replay.bindings[action])) input.setBinding(action, replay.bindings[action]);
      }
      input.clearAll();
      live.initMatch({ ...replay.match, seed: replay.seed });
      Object.assign(live.objective().score, replay.score || {});
      playing = { replay, events: replay.events, at: 0, held: new Set(), keep, onEnd };
      if (replay.steps === 0) finish();
      return { ok: true, why: 'playing' };
    },
  };
}

/** The file name a saved journal goes by. */
function fileName(replay) {
  return `blackline-${replay.map}-seed${replay.seed}-r${replay.match.round}.json`;
}

/**
 * The routes a player has to a replay: `?replay=<path>` on the page's own
 * origin, a file dropped on the window, and the pause menu's *Save replay*.
 * A replay of another map is another page load (D1): it is kept in this
 * tab's session store across it and played when that page is up.
 *
 * @param {object} root
 * @param {ReturnType<typeof createReplays>} root.replays
 * @param {() => object} root.map @param {object} root.menu
 * @param {(paused: boolean) => void} root.setPaused
 * @param {(id: string) => void} root.goToMap
 * @param {object} root.emitter the one emitter, for the first frame
 */
export function installReplayRoutes({ replays, map, menu, setPaused, goToMap, emitter }) {
  const KEY = 'blackline.replay.pending';
  const start = (replay) => {
    const why = refuse(replay);
    if (why) return console.warn(`[REPLAY] refused: ${why}`);
    if (replay.map !== map().id) {
      try { sessionStorage.setItem(KEY, JSON.stringify(replay)); } catch { return console.warn('[REPLAY] another map, and no session store to carry it across'); }
      return goToMap(replay.map);
    }
    menu.hide();
    setPaused(false);
    const result = replays.play(replay, {
      onEnd: ({ diff }) => {
        setPaused(true);
        console.info(diff.length ? `[REPLAY] ended, and differs from its recording: ${diff.join('; ')}` : '[REPLAY] ended at its recorded end state');
      },
    });
    if (!result.ok) console.warn(`[REPLAY] refused: ${result.why}`);
    else console.info(`[REPLAY] playing ${replay.steps} steps of ${replay.map}, seed ${replay.seed}`);
    return undefined;
  };

  // On the first frame, which is after the composition root's own first
  // `initMatch` - that would otherwise open over the replay's - and needs no
  // timer (Section 15: no `setTimeout` for anything in the game).
  emitter.once('frame:begin', () => {
    let pending = null;
    try {
      pending = sessionStorage.getItem(KEY);
      if (pending) sessionStorage.removeItem(KEY);
    } catch { pending = null; }
    if (pending) {
      try { start(JSON.parse(pending)); } catch (error) { console.warn(`[REPLAY] the carried replay will not parse: ${error.message}`); }
      return;
    }
    const path = new URLSearchParams(location.search).get('replay');
    if (!path) return;
    // The page's own origin only: a replay is a file of this project's.
    const url = new URL(path, location.href);
    if (url.origin !== location.origin) return console.warn(`[REPLAY] ${path} is not on this page's origin`);
    fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then(start, (error) => console.warn(`[REPLAY] could not load ${path}: ${error.message}`));
    return undefined;
  });

  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', (event) => {
    const file = event.dataTransfer && event.dataTransfer.files[0];
    if (!file) return;
    event.preventDefault();
    file.text().then((text) => start(JSON.parse(text))).catch((error) => console.warn(`[REPLAY] the dropped file is not a replay: ${error.message}`));
  });

  /**
   * *Save replay*: this round so far, as a file the browser saves. The file's
   * URL is let go on the next save rather than at once, which can cancel the
   * download it was made for, and rather than on a timer.
   */
  let lastUrl = null;
  return {
    download() {
      const replay = replays.save();
      if (lastUrl) URL.revokeObjectURL(lastUrl);
      const link = document.createElement('a');
      link.href = lastUrl = URL.createObjectURL(new Blob([JSON.stringify(replay)], { type: 'application/json' }));
      link.download = fileName(replay);
      link.click();
      return link.download;
    },
  };
}
