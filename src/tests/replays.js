/**
 * BLACKLINE - tests/replays.js
 *
 * AUTO suite (H13): every replay under `tests/replays/` is played back
 * through the same fixed steps it was recorded on, and must reach the end it
 * recorded - the two bodies to six decimals, the round, the score and the
 * match's rng count. `tests/replays/index.json` is the list, because a page
 * cannot list a directory; a file not in it is a file this check never runs,
 * and a name in it with no file is red.
 *
 * Two things more than the end, because an end that matches can still prove
 * nothing. **The journal is the file**: the round the playback journals as it
 * goes must be the file's own events, step for step, which is what says the
 * feed and the journal are each other's inverse rather than two halves that
 * happen to agree on one file. And **a replay is about its input**: the same
 * file with its first key press taken out must end somewhere else, or the
 * recorded end is a fact about the seed and the round would have reached it
 * with nobody at the keys.
 *
 * Re-recording, when a change to the game moves a recorded end on purpose, is
 * `npm run probe -- --map <id> tests/replays/record.js`, whose output
 * `tests/replays/compact.mjs` writes as the file. Registered from tests/index.js. Nothing here imports main.js.
 */

import { CONFIG } from '../config.js';
import { endDiff } from '../replay.js';

const INDEX = '/tests/replays/index.json';

/** Play a replay to its end, synchronously, and say how it ended. */
function playThrough(h, replay) {
  let ended = null;
  const started = h.replays.play(replay, { onEnd: (result) => { ended = result; } });
  if (!started.ok) return { why: started.why };
  for (let left = replay.steps; left > 0 && !ended;) left -= h.stepFrames(Math.min(left, CONFIG.debug.autoTestMaxFrames));
  return ended ? { ...ended, journal: h.replays.save().events } : { why: `the playback did not end after ${replay.steps} steps` };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'every-shipped-replay-replays-to-its-recorded-end',
    spec: 'H13',
    name: 'Every replay in tests/replays/ for this map plays back to the end state it recorded, journals its own events as it goes, and ends elsewhere with its first key press taken out',
    run: async (h) => {
      const problems = [];
      const read = [];
      let names = [];
      try {
        const response = await fetch(INDEX);
        if (!response.ok) throw new Error(`${response.status}`);
        names = (await response.json()).replays || [];
      } catch (error) {
        return { pass: false, detail: `${INDEX} will not load: ${error.message}` };
      }
      let ran = 0;
      try {
        for (const name of names) {
          let replay;
          try {
            const response = await fetch(`/tests/replays/${name}`);
            if (!response.ok) throw new Error(`${response.status}`);
            replay = await response.json();
          } catch (error) {
            problems.push(`${name} is in the index and will not load: ${error.message}`);
            continue;
          }
          if (replay.map !== h.map.id) continue;
          ran++;
          const played = playThrough(h, replay);
          if (played.why) {
            problems.push(`${name}: ${played.why}`);
            continue;
          }
          if (played.diff.length) problems.push(`${name} ended elsewhere: ${played.diff.join('; ').slice(0, 220)}`);
          if (JSON.stringify(played.journal) !== JSON.stringify(replay.events)) {
            const at = played.journal.findIndex((e, i) => JSON.stringify(e) !== JSON.stringify(replay.events[i]));
            problems.push(`${name}'s playback journaled ${played.journal.length} events against its ${replay.events.length}, first apart at ${at}`);
          }
          // Its first key press, out: the round must not reach the same end.
          const first = replay.events.findIndex((e) => e[1] === '+');
          if (first === -1) problems.push(`${name} presses no key, so it is a replay of nobody playing`);
          else {
            const code = replay.events[first][2];
            const up = replay.events.findIndex((e, i) => i > first && e[1] === '-' && e[2] === code);
            const cut = { ...replay, events: replay.events.filter((_, i) => i !== first && i !== up) };
            const without = playThrough(h, cut);
            if (without.why) problems.push(`${name} without its first press: ${without.why}`);
            else if (!endDiff(replay.end, without.end).length) problems.push(`${name} ends at its recorded end with ${code} never pressed, so the end is not about the input`);
          }
          read.push(`${name} ${replay.steps} steps, ${replay.events.length} events, shade at ${replay.end.shade.slice(0, 3).map((v) => v.toFixed(2)).join(',')}`);
        }
      } finally {
        h.input.clearAll();
        h.menu.hide();
      }
      if (!ran) problems.push(`no replay in ${INDEX} is of ${h.map.id}`);
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${ran} of ${names.length} replays are of ${h.map.id}: ${read.join('; ')}; each reached its recorded end, journaled its own events, and ended elsewhere without its first press`
          : problems.join('; '),
      };
    },
  });
}
