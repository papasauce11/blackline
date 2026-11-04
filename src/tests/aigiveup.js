/**
 * BLACKLINE - tests/aigiveup.js
 *
 * AUTO suite (K5): the Warden gives up, says so, and is quicker to suspect
 * the second time.
 *
 * A search used to end at one shared fifteen seconds, in silence, and leave
 * the Warden exactly as easily fooled as before. Now each difficulty preset
 * carries its own patience (`ai.difficulty[...].searchDuration`), every way
 * out of SEARCH goes through `_giveUpSearch` (which barks `ai:bark` for N2 to
 * voice), and each give-up scales the suspicion threshold down
 * (`_suspicionThreshold`).
 *
 *   the timer      for each preset the Warden is stood on the ground, told the
 *                  Shade was last at the ground cell farthest from it - so
 *                  the sweep is a long walk that cannot finish before the
 *                  timer does, which makes this a reading of the timer and not
 *                  of the sweep - and put into SEARCH. It must give up within
 *                  two frames of that preset's own duration, with checks still
 *                  to make, and easy < medium < hard.
 *   the bark       over one of those runs exactly one `ai:bark` fires, a
 *                  `giveUp`, at the Warden's position.
 *   the second time  at the default difficulty an accumulator between the
 *                  reduced threshold and the base one leaves the Warden on its
 *                  rounds before a give-up and sends it to INVESTIGATE after
 *                  one that the live code drove.
 *
 * Each map is read as the page is on it: no coordinate and no tag is named.
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG, SETTINGS } from '../config.js';
import { AI_STATE } from '../systems/ai.js';

const A = CONFIG.ai;
const dt = CONFIG.time.fixedDt;
/** The reading may be this many frames either side of the duration. */
const SLACK = 2 * dt;
/** Past the longest preset, so a Warden that never gives up fails and does not hang. */
const CEILING = Math.round((Math.max(...Object.values(A.difficulty).map((d) => d.searchDuration)) + 3) / dt);
/** The bark is the Warden's own position, to within this. */
const BARK_NEAR = 1;

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const fresh = (h) => h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
const hide = (h) => { h.menu.hide(); h.input.clearAll(); };

/** The Warden's ground cell farthest from `from`, flat. */
function farthest(ground, from) {
  let best = null;
  let bestAway = -1;
  ground.forEach((x, y, z) => {
    const away = flat({ x, z }, from);
    if (away > bestAway) {
      best = { x, y, z };
      bestAway = away;
    }
  });
  return best;
}

/**
 * Put the Warden into SEARCH for a Shade last known as far from it as the map
 * allows, and step until it leaves. Returns the seconds taken, the sweep still
 * unfinished at that moment, where it stood, and the state it left to.
 */
function giveUp(h) {
  const { wardenAI, warden } = h;
  wardenAI.lastKnown = farthest(h.map.wardenGround, warden.position);
  wardenAI._enterSearch();
  let frames = 0;
  while (wardenAI.state === AI_STATE.SEARCH && frames < CEILING) {
    h.stepFrames(1);
    frames++;
  }
  const p = warden.position;
  return { seconds: frames * dt, left: wardenAI._searchSpots.length, at: { x: p.x, y: p.y, z: p.z }, state: wardenAI.state };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-warden-gives-up-sooner-on-easy-and-re-alerts-faster-the-second-time',
    spec: 'Block K / K5',
    name: 'The Warden gives up after its difficulty\'s own search time, barks, and is quicker to suspect the next time',
    run: (h) => {
      const problems = [];
      const was = SETTINGS.difficulty;
      const names = Object.keys(A.difficulty);
      const readings = [];
      let barks = [];
      let barkAt = null;

      // (1) The timer, per preset; (2) the bark, over the last of them.
      for (const name of names) {
        SETTINGS.difficulty = name;
        fresh(h);
        hide(h);
        const want = A.difficulty[name].searchDuration;
        const mine = [];
        const off = h.emitter.on('ai:bark', (e) => mine.push(e));
        const r = giveUp(h);
        off();
        readings.push(r.seconds);
        if (r.state === AI_STATE.SEARCH) {
          problems.push(`${name}: still searching after ${r.seconds.toFixed(2)}s, want ${want}s`);
        } else if (Math.abs(r.seconds - want) > SLACK) {
          problems.push(`${name}: gave up after ${r.seconds.toFixed(2)}s, want ${want}s (within ${SLACK.toFixed(2)}s)`);
        } else if (r.left === 0) {
          problems.push(`${name}: the sweep had emptied by ${r.seconds.toFixed(2)}s, so that is not the timer's reading`);
        }
        if (name === 'medium') {
          barks = mine;
          barkAt = r.at;
        }
      }
      SETTINGS.difficulty = was;
      if (!(readings[0] < readings[1] && readings[1] < readings[2])) {
        problems.push(`gave up in ${readings.map((s) => s.toFixed(2)).join('s, ')}s on ${names.join(', ')}, want each longer than the last`);
      }

      if (barks.length !== 1) {
        problems.push(`${barks.length} ai:bark events over one give-up, want exactly one`);
      } else if (barks[0].kind !== 'giveUp') {
        problems.push(`the bark's kind was "${barks[0].kind}", want "giveUp"`);
      } else if (!barks[0].at || flat(barks[0].at, barkAt) > BARK_NEAR) {
        problems.push(`the bark came from (${barks[0].at && barks[0].at.x.toFixed(1)}, ${barks[0].at && barks[0].at.z.toFixed(1)}), the Warden stood at (${barkAt.x.toFixed(1)}, ${barkAt.z.toFixed(1)})`);
      }

      // (3) Faster the second time: the same accumulator, before and after a real give-up.
      fresh(h);
      hide(h);
      const { wardenAI, warden } = h;
      const base = A.suspicionThreshold;
      const reduced = base * A.reAlertFactor;
      const mid = (base + reduced) / 2;
      const poke = () => {
        // Out of her sight and somewhere reachable: only the accumulator moves her.
        wardenAI._enter(AI_STATE.PATROL);
        wardenAI.lastKnown = { x: warden.position.x, y: warden.position.y, z: warden.position.z };
        wardenAI.accumulator = mid;
        h.stepFrames(1);
        return wardenAI.state;
      };
      const before = poke();
      if (before !== AI_STATE.PATROL) problems.push(`with no search given up, ${mid} against a threshold of ${base} left the Warden in ${before}, want patrol`);
      const first = giveUp(h);
      if (first.state !== AI_STATE.PATROL || wardenAI._giveUps !== 1) {
        problems.push(`the give-up before the second reading left ${first.state} with ${wardenAI._giveUps} counted, want patrol and 1`);
      }
      const after = poke();
      if (after !== AI_STATE.INVESTIGATE) problems.push(`after a give-up, ${mid} against a threshold of ${reduced} left the Warden in ${after}, want investigate`);

      fresh(h);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `gave up after ${names.map((n, i) => `${readings[i].toFixed(2)}s on ${n}`).join(', ')}; one giveUp bark at the Warden; accumulator ${mid} (threshold ${base}, then ${reduced}): ${before}, then ${after}`
          : problems.join('; '),
      };
    },
  });
}
