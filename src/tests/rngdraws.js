/**
 * BLACKLINE - tests/rngdraws.js
 *
 * AUTO suite (H77): who spends the simulation's shared stream, and when.
 *
 * **The hypothesis, and why it was still open.** A live AI draws from the same
 * seeded stream the patrol order was shuffled out of, so a check that steps
 * frames beside one and then reads anything the stream feeds is reading
 * numbers another system has been pulling on. H74 proposed that as the reason
 * its pixel readings moved between an AI-on and an AI-off run - and then
 * withdrew it, because H79 showed that ten of those eleven readings drift run
 * to run on their own, by as much as or more than the A/B deltas. So the
 * hypothesis survived the measurement that was supposed to settle it, which is
 * the worst state for one to be in: nothing in that experiment could tell an
 * rng channel from the breath.
 *
 * **It was cheap to settle directly, and the answer is a number rather than an
 * inference.** How many values something other than a check drew while it ran
 * is a counter. Three readings, all of them derived here and none of them
 * written down as a literal:
 *
 *   - **A match opening spends the shuffle and nothing else.** `rng.calls` the
 *     instant `initMatch` returns is exactly `circuit.length - 1`, which is
 *     Fisher-Yates over the waypoints: **19 of a 20-node circuit on the plant,
 *     20 of a 21-node circuit on the yard**. Same every time, so it is a cost
 *     and not a perturbation.
 *   - **A live patrol draws about one number a minute of simulated time.**
 *     Over 3,600 frames at three seeds: **4, 4 and 2 draws on the plant; 5, 3
 *     and 2 on the yard**, every one of them a single draw, at the frame the
 *     Warden arrives at a patrol node and asks how long to stand there. At
 *     seed 12345 the first one lands on frame **523** of the plant and frame
 *     **59** of the yard.
 *   - **With the AI off the same frames draw nothing at all**: 0 over 3,600,
 *     both maps, both seeds, and the look stream 0 beside it.
 *
 * **Which closes H74's hypothesis rather than confirming it.** The rng *is* a
 * channel - the AI is the only thing that spends this stream during a step, so
 * turning it off changes the stream - but the channel is open for one frame in
 * about twelve hundred. The eleven sites that step a frame before they grab
 * step one to fifteen of them, so the odds that a live AI drew a single number
 * under one of them are a little over one percent, and the twelve sites that
 * step none cannot be touched at all. A one-draw phase shift one run in eighty
 * cannot produce a reading that moves every run, which is what H79 measured.
 * The breath is the channel; this one is a trickle, and now it is a counted
 * trickle - `_runOne` records the three per check and the report prints which
 * checks had a live AI spending the stream underneath them.
 *
 * **What is held here, and the reason it is a census rather than a floor.** A
 * rate first measured this morning is not a rule (H71's lesson, and H74's),
 * and the useful thing the measurement turned up is not the rate at all: it is
 * that **every draw from this stream outside config and this suite is one of
 * nine call sites, and every one of them is a decision** - a circuit shuffled,
 * a pause chosen, a burst sized, a shot aimed, a round's recoil and spread.
 * That is a sentence a new system can falsify by accident, which is exactly
 * what a clause is for: the day something ambient starts drawing here, the
 * number under every stepping check stops being a trickle and nothing else in
 * the suite would notice. So the census is the clause, the two streams are
 * both in it (a census of one of them is half a census, and H27's layering
 * rule is the reason there are two), and the rate is reported beside it.
 *
 * Nothing here renders a frame - it steps the simulation and reads the tree.
 * Registered from tests/index.js; nothing imports main.js (Section 3.1).
 */

import { CONFIG, rng, lookRng } from '../config.js';
import { moduleTexts, ranModules } from './moduletexts.js';
import { codeOf, readerProblems } from './sourcetext.js';

/**
 * The two streams, and the reader for each. A method list and not `\w+`,
 * because `rng.reseed(` and `rng.calls` are not draws and the difference is
 * the whole subject: one spends the stream and the others only name it.
 *
 * The lookbehind keeps `this.rng.` and `foo.rng.` out, and the case of
 * `lookRng` is what keeps the look stream out of the simulation reader - which
 * is luck rather than design, so the reader proof below holds both directions
 * against real lines of both files.
 */
const DRAWS = '(?:next|range|int|pick|chance|sign|unit|shuffle)';
const STREAMS = [
  { stream: 'rng', label: 'the simulation stream', pattern: new RegExp(`(?<![\\w$.])rng\\.${DRAWS}\\(`, 'g') },
  { stream: 'lookRng', label: 'the look stream', pattern: new RegExp(`(?<![\\w$.])lookRng\\.${DRAWS}\\(`, 'g') },
];

/**
 * Every draw from either stream in `src/`, outside `config.js` (which defines
 * them) and `src/tests/` (where a fuzz check drawing its own input is the
 * suite and not the game), with the decision each one is.
 *
 * Declared as a flat list and compared as a multiset per file and stream, so
 * two draws of the same method in one file are two rows here - which they
 * should be, because they are two different decisions and the second one is
 * the one a reader of the file would miss. No line numbers: those drift on
 * every edit and would make this a census of formatting.
 *
 * **And by what each draw feeds** (H87): the identifier on the left of the
 * `=` (or the `:` of an object literal, or the argument of an in-place
 * `shuffle`), without a leading `this.`. Compared as method-and-target pairs,
 * because three ragdoll spins of `unit` were three identical rows - a reorder
 * or a fourth spin was a change a method tally could not see - and the
 * target is what a reorder keeps and a new draw does not.
 *
 * **The `when` column is the load-bearing one.** A method name says what kind
 * of number came out; what this census is about is that there is a decision
 * behind it. A row whose `when` could not be written is a draw nobody can
 * account for, which is the state the whole stream was in before this job.
 */
const SPENDERS = [
  { file: 'src/systems/ai.js', stream: 'rng', method: 'shuffle', when: 'a match opens: the patrol circuit, shuffled once in reset()', feeds: '_circuit' },
  { file: 'src/systems/ai.js', stream: 'rng', method: 'range', when: 'a patrol node is reached: how long the Warden stands there and scans', feeds: '_pauseTimer' },
  { file: 'src/systems/ai.js', stream: 'rng', method: 'range', when: "a burst's last round leaves: how long before the next burst", feeds: '_burstPause' },
  { file: 'src/systems/ai.js', stream: 'rng', method: 'int', when: 'a burst opens: how many rounds it is', feeds: '_burstRemaining' },
  { file: 'src/systems/ai.js', stream: 'rng', method: 'unit', when: 'a burst is aimed: the yaw inside the difficulty cone', feeds: '_aimYaw' },
  { file: 'src/systems/ai.js', stream: 'rng', method: 'unit', when: 'a burst is aimed: the pitch inside the same cone', feeds: '_aimPitch' },
  { file: 'src/systems/combat.js', stream: 'rng', method: 'unit', when: "a round is fired: the horizontal half of the weapon's recoil kick", feeds: 'recoilYaw' },
  { file: 'src/systems/combat.js', stream: 'rng', method: 'unit', when: "a round is fired: the yaw offset inside the gun's spread cone", feeds: 'yawOffset' },
  { file: 'src/systems/combat.js', stream: 'rng', method: 'unit', when: 'a round is fired: the pitch offset inside the same cone', feeds: 'pitchOffset' },
  { file: 'src/systems/effects.js', stream: 'lookRng', method: 'range', when: 'a footprint is placed: its yaw, where the Warden has none', feeds: 'slot.yaw' },
  { file: 'src/systems/effects.js', stream: 'lookRng', method: 'unit', when: "a spark leaves: its sideways velocity", feeds: 'slot.vx' },
  { file: 'src/systems/effects.js', stream: 'lookRng', method: 'range', when: 'a spark leaves: its upward velocity', feeds: 'slot.vy' },
  { file: 'src/systems/effects.js', stream: 'lookRng', method: 'unit', when: 'a spark leaves: its other sideways velocity', feeds: 'slot.vz' },
  { file: 'src/systems/effects.js', stream: 'lookRng', method: 'next', when: "a smoke puff is placed: its radius inside the cloud's", feeds: 'radius' },
  { file: 'src/systems/effects.js', stream: 'lookRng', method: 'next', when: 'a smoke puff is placed: its angle around the cloud', feeds: 'theta' },
  { file: 'src/systems/effects.js', stream: 'lookRng', method: 'unit', when: 'a smoke puff is placed: its angle up the cloud', feeds: 'phi' },
  { file: 'src/systems/effects.js', stream: 'lookRng', method: 'unit', when: 'a smoke puff drifts: one axis of the drift', feeds: 'slot.vx' },
  { file: 'src/systems/effects.js', stream: 'lookRng', method: 'range', when: 'a smoke puff drifts: the vertical axis of it', feeds: 'slot.vy' },
  { file: 'src/systems/effects.js', stream: 'lookRng', method: 'unit', when: 'a smoke puff drifts: the third axis of it', feeds: 'slot.vz' },
  { file: 'src/systems/effects.js', stream: 'lookRng', method: 'range', when: 'a smoke puff is drawn: how big the sprite is', feeds: 'slot.size' },
  { file: 'src/systems/effects.js', stream: 'lookRng', method: 'unit', when: 'a ragdoll tumbles: its spin about x', feeds: 'spinX' },
  { file: 'src/systems/effects.js', stream: 'lookRng', method: 'unit', when: 'a ragdoll tumbles: its spin about y', feeds: 'spinY' },
  { file: 'src/systems/effects.js', stream: 'lookRng', method: 'unit', when: 'a ragdoll tumbles: its spin about z', feeds: 'spinZ' },
];

/** The two files this census does not read, and why, as data. */
const NOT_READ = [
  { path: 'src/config.js', why: 'it defines both streams, so every mention of one is its own machinery' },
  { path: 'src/tests/', why: "a fuzz check drawing its own input is the suite spending the stream, not the game" },
];

/**
 * A floor on the modules read, on `registry.js`'s and `donedef.js`'s model: an
 * empty census and a blind one look identical from here, and this one answers
 * "nothing else draws" - which a reader that fetched nothing would also say.
 */
const MIN_MODULES = 40;

/** What a line is, to the two readers above, or nothing. */
const SEEN_AS = (text) => {
  for (const { label, pattern } of STREAMS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) return label;
  }
  return '';
};

/**
 * Real lines of this tree, both ways round. Every `ignores` line is one this
 * census would be wrong about if the method list were `\w+` or the lookbehind
 * were dropped: a reseed, a counter read, the state the counter lives on, and
 * - the one that has bitten three other censuses (H35, H47, H52) - a sentence
 * in another module's header naming the call it is about.
 */
const READER_SEES = [
  ['    rng.shuffle(this._circuit);', 'the simulation stream'],
  ['      this._pauseTimer = rng.range(A.patrolPauseMin, A.patrolPauseMax);', 'the simulation stream'],
  ['    this.recoilYaw += G.recoilHorizontal * DEG * rng.unit();', 'the simulation stream'],
  ['      slot.vx = lookRng.unit() * 4;', 'the look stream'],
  ['      slot.size = lookRng.range(GA.smoke.spriteSizeMin, GA.smoke.spriteSizeMax);', 'the look stream'],
];
const READER_IGNORES = [
  // A reseed spends nothing; it replaces the generator.
  '  const seed = rng.reseed(',
  // Reading a counter is not drawing from the stream it counts.
  '  debugState.rngCalls = rng.calls;',
  // The state the counters live on, which is config's own machinery.
  'const rngState = {',
  // Prose from tests/settlecircuit.js's header, naming the first row above.
  ' * between that and `rng.shuffle(this._circuit)` in `ai.reset()` draws from it -',
  // A member of something that is not the stream.
  '      const drew = this.rng.next();',
];

/**
 * The match this check opens, and the seed it names.
 *
 * Named because the frames below are a function of it: the circuit the shuffle
 * draws decides which node the Warden walks to first and therefore when it
 * first arrives anywhere, which is the only thing a patrol draws for. H80 is
 * the worked example of a reading taken in whichever circuit the clock
 * happened to pick, and this check's whole subject is the stream that circuit
 * came out of, so leaving it to `Date.now()` would be the same mistake twice.
 */
const SEED = 12345;
const START = { mode: 'competitive', role: CONFIG.match.humanRole, objective: true };

/**
 * How far to walk a live patrol looking for its first draw, and the bar.
 *
 * `autoTestMaxFrames` is one `stepFrames` call's own bound and is read rather
 * than copied; the frames are stepped one at a time anyway, because the
 * finding is *which* frame and a bulk call cannot say. At seed 12345 the first
 * draw lands on frame 523 of the plant and 59 of the yard, and the three seeds
 * measured put every first draw inside 1,450 - so the bound is the budget and
 * the bar is **that a patrol reaches a drawing decision at all**, with the
 * frame reported. A bar near 523 would be a floor under map data: the frame is
 * the walk to the first node, and the node is whatever the shuffle drew.
 */
const WALK_CAP = CONFIG.debug.autoTestMaxFrames;

/** Draws taken directly, to prove the two counters are two counters. */
const SAMPLES = 8;

/** Open a match the way every check does, at a seed this one names. */
function open(h, ai) {
  h.initMatch({ ...START, ai, objective: true, seed: SEED });
  h.menu.hide();
  h.setPaused(false);
  h.input.clearAll();
}

/** The three cumulative counts, read at one instant. */
function ledger(h) {
  return {
    drawn: rng.drawn,
    underAi: h.debugState.rngUnderAi || 0,
    withoutAi: h.debugState.rngWithoutAi || 0,
    look: lookRng.drawn,
  };
}

/** What moved between two readings of it. */
const since = (a, b) => ({
  drawn: b.drawn - a.drawn,
  underAi: b.underAi - a.underAi,
  withoutAi: b.withoutAi - a.withoutAi,
  look: b.look - a.look,
});

/**
 * Walk a patrol one frame at a time until the stream is drawn from, or until
 * the budget runs out. Returns the frame it first happened on, how many frames
 * were stepped, and what the ledger did over all of them.
 */
function walkToADraw(h, cap) {
  const before = ledger(h);
  let first = 0;
  let frames = 0;
  for (let i = 1; i <= cap; i++) {
    const at = rng.drawn;
    h.stepFrames(1);
    frames = i;
    if (!first && rng.drawn > at) first = i;
    if (first) break;
  }
  return { first, frames, moved: since(before, ledger(h)) };
}

/** Step a fixed number of frames and report what the ledger did. */
function walk(h, frames) {
  const before = ledger(h);
  for (let i = 0; i < frames; i++) h.stepFrames(1);
  return { frames, moved: since(before, ledger(h)) };
}

/**
 * Which modules the page loaded under `src/`, from Resource Timing (H63) -
 * through `tests/moduletexts.js` since H96, which reads the buffer once a page
 * for the eight censuses that want this list.
 */
function loadedModules(origin) {
  return ranModules(origin) || [];
}

/**
 * What one draw feeds (H87), read off the line it is on: the target of the
 * first assignment or object key the line opens with, else - a bare call like
 * `rng.shuffle(this._circuit)` - the call's first argument. `this.` is
 * dropped so the table reads as the decisions do.
 */
const ASSIGNS = /^\s*(?:(?:const|let|var)\s+)?([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*(?:[-+*\/%]?=(?!=)|:(?!:))/;
const ARGUMENT = /^\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/;
function feedOf(code, index, end) {
  const line = code.slice(code.lastIndexOf('\n', index - 1) + 1, index);
  const target = ASSIGNS.exec(line) || ARGUMENT.exec(code.slice(end));
  return target ? target[1].replace(/^this\./, '') : '?';
}

/** The draws one stream makes in one module, as `method feeds` pairs. */
function feedsIn(code, pattern) {
  pattern.lastIndex = 0;
  return [...code.matchAll(pattern)].map((m) => {
    const method = m[0].slice(m[0].indexOf('.') + 1, -1);
    return `${method}->${feedOf(code, m.index, m.index + m[0].length)}`;
  });
}

/** A multiset of method names, as a sorted string, for comparing two. */
const tally = (methods) => [...methods].sort().join(', ') || 'nothing';

/** What is in one multiset and not the other, by name, each way. */
function difference(found, declared) {
  const left = [...declared];
  const extra = [];
  for (const item of found) {
    const at = left.indexOf(item);
    if (at === -1) extra.push(item);
    else left.splice(at, 1);
  }
  return { extra, missing: left };
}

/**
 * The target reader's proof, on real lines of this tree run through `codeOf`
 * the way the census reads them: an assignment, a compound one, a `const`, an
 * object key, a line whose right side holds a `===`, and the bare shuffle.
 */
const FEEDS_PROOF = [
  ['    rng.shuffle(this._circuit);', 'shuffle->_circuit'],
  ['      this._pauseTimer = rng.range(A.patrolPauseMin, A.patrolPauseMax);', 'range->_pauseTimer'],
  ['    this.recoilYaw += G.recoilHorizontal * DEG * rng.unit();', 'unit->recoilYaw'],
  ['    const yawOffset = rng.unit() * cone;', 'unit->yawOffset'],
  ["    slot.yaw = source === 'warden' ? 0 : lookRng.range(-0.4, 0.4);", 'range->slot.yaw'],
  ['      const radius = GA.smoke.radius * Math.cbrt(lookRng.next());', 'next->radius'],
  ['      spinX: lookRng.unit() * 6,', 'unit->spinX'],
];

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-simulations-stream-is-drawn-from-only-by-a-decision',
    census: true,
    spec: 'Section 11 / Section 16 check 28 / H77',
    name: "Every draw from the simulation's stream and the look stream outside config and this suite is one of a declared set of decisions, a live patrol spends the simulation's stream only on arriving somewhere, and the same frames with the AI off spend nothing",
    run: async (h) => {
      const problems = [];
      const origin = location.origin;

      // ------------------------------------------------------------------
      // 1. The two readers, before anything they report is believed, on
      //    `sourcetext.js`'s instrument (F8's model). Five real lines each
      //    way, one of them another module's prose about the first of them.
      // ------------------------------------------------------------------
      problems.push(...readerProblems(SEEN_AS, READER_SEES, READER_IGNORES, codeOf));

      // ------------------------------------------------------------------
      // 2. The counters, which every number below is a difference of. One is
      //    the match's and one is the page's, and the question H77 asked
      //    cannot be put to the first: a check that opens a match of its own
      //    reseeds in the middle of the span being measured.
      // ------------------------------------------------------------------
      const drawnBefore = rng.drawn;
      for (let i = 0; i < SAMPLES; i++) rng.next();
      const callsBefore = rng.calls;
      if (rng.drawn !== drawnBefore + SAMPLES) {
        problems.push(`${SAMPLES} draws moved rng.drawn by ${rng.drawn - drawnBefore}; it is meant to count every value this page has taken from the simulation's stream`);
      }
      // Reseeded through the real path rather than by calling config's own
      // reseed: what a check does to this stream is open a match.
      open(h, false);
      const shuffle = h.wardenAI._circuit.length - 1;
      if (rng.calls !== shuffle) {
        problems.push(`a match opening left rng.calls at ${rng.calls} and the circuit is ${h.wardenAI._circuit.length} nodes, so the shuffle is ${shuffle} draws - either initMatch now spends the stream on something besides the patrol order, or the match count no longer restarts at a reseed (it was ${callsBefore})`);
      }
      if (rng.drawn !== drawnBefore + SAMPLES + shuffle) {
        problems.push(`a match opening left rng.drawn ${rng.drawn - drawnBefore} past where it was and the only draws since were the ${SAMPLES} taken here and the ${shuffle} of the shuffle; a reseed must not reset it, or a check that opens its own match zeroes the span it is being measured over`);
      }

      // ------------------------------------------------------------------
      // 3. A live patrol, walked one frame at a time until it spends the
      //    stream. The bar is that it ever does - the frame is the walk to
      //    whichever node the shuffle drew first, and that is map data.
      // ------------------------------------------------------------------
      open(h, true);
      const live = walkToADraw(h, WALK_CAP);
      if (!live.first) {
        problems.push(`a live patrol at seed ${SEED} drew nothing from the simulation's stream over ${live.frames} frames; the AI is the only thing that spends it during a step, so either no AI is running or the one decision a patrol draws for - how long to stand at a node - has stopped drawing`);
      }
      if (live.first && live.moved.underAi !== live.moved.drawn) {
        problems.push(`the patrol drew ${live.moved.drawn} value(s) and ${live.moved.underAi} of them were attributed to a step the AI drove; the whole point of the split is that a check can tell its own draws from the ones taken underneath it`);
      }
      if (live.moved.withoutAi !== 0) {
        problems.push(`${live.moved.withoutAi} of the patrol's draws were attributed to a step the AI did not drive, over frames it drove every one of`);
      }

      // ------------------------------------------------------------------
      // 4. And the control, which is what makes the reading above about the
      //    AI rather than about a simulation that draws as it goes: the same
      //    frames, the same seed, the flag the only difference.
      // ------------------------------------------------------------------
      open(h, false);
      const quiet = walk(h, live.frames);
      if (quiet.moved.drawn !== 0) {
        problems.push(`with the AI off the same ${quiet.frames} frames drew ${quiet.moved.drawn} value(s) from the simulation's stream, and nothing but the AI is meant to spend it during a step - the census below says which nine call sites exist and every one of them is the AI's or its gun's`);
      }

      // ------------------------------------------------------------------
      // 5. The census. Every module the page loaded, read as code, against
      //    the declared table - and every module that is not in the table
      //    holding no draw at all, which is the half that catches a new
      //    system quietly joining the stream.
      // ------------------------------------------------------------------
      const modules = loadedModules(origin);
      if (modules.length < MIN_MODULES) {
        return { pass: false, detail: `Resource Timing lists ${modules.length} modules under src/ and the game is ${MIN_MODULES}+, so this census is not reading the tree` };
      }
      const declared = new Map();
      for (const row of SPENDERS) {
        const key = `${row.file} ${row.stream}`;
        if (!declared.has(key)) declared.set(key, []);
        declared.get(key).push(`${row.method}->${row.feeds}`);
        if (!row.feeds) problems.push(`${row.file} draws ${row.stream}.${row.method}() (${row.when}) and this table does not say what it feeds; a row without a target is three identical rows to a reorder (H87)`);
        if (!row.when) problems.push(`${row.file} draws ${row.stream}.${row.method}() and this table does not say what decision it is; a draw nobody can account for is the state this stream was in before H77`);
      }
      const skip = (path) => NOT_READ.some((n) => path === n.path || path.startsWith(n.path));
      const read = [];
      const found = new Map();
      for (const module of await moduleTexts(origin, modules.filter((path) => !skip(path)))) {
        if (module.error) { problems.push(module.error); continue; }
        const path = module.path;
        read.push(path);
        for (const { stream, pattern } of STREAMS) {
          const methods = feedsIn(module.code, pattern);
          if (methods.length) found.set(`${path} ${stream}`, methods);
        }
      }
      for (const [line, want] of FEEDS_PROOF) {
        const stream = STREAMS.find(({ pattern }) => { pattern.lastIndex = 0; return pattern.test(line); });
        const got = stream ? feedsIn(codeOf(line), stream.pattern).join(', ') : 'no draw';
        if (got !== want) problems.push(`the target reader reads \`${line.trim()}\` as ${got}, want ${want}, so every row it compares is about a different line`);
      }
      for (const [key, methods] of found) {
        if (!declared.has(key)) {
          problems.push(`${key.split(' ')[0]} draws from ${key.split(' ')[1]} (${tally(methods)}) and is not in this census; declare each draw with the decision it is, or move it to the other stream (H27: a value that decides something a player can lose to belongs on the simulation's)`);
        }
      }
      for (const [key, methods] of declared) {
        const file = key.split(' ')[0];
        if (!read.includes(file)) {
          problems.push(`${key} is declared here and ${file} is not one of the ${read.length} modules this page loaded, so this row is about a file that no longer runs`);
          continue;
        }
        const mine = found.get(key) || [];
        const { extra, missing } = difference(mine, methods);
        if (extra.length || missing.length) {
          problems.push(`${key} draws ${extra.length ? extra.join(', ') : 'nothing more'} that this census does not declare`
            + `${missing.length ? `, and declares ${missing.join(', ')} that it does not draw` : ''}; every draw is a decision and the table is where the decision is written down`);
        }
      }

      // And leave the run in a live match of nobody's particular seed, which
      // is what every check after a pixel check already inherits (H57): this
      // one takes eight draws of its own and then names a seed twice, and a
      // check that leaves the stream somewhere it chose is a check the next
      // one is reading through.
      h.initMatch({ ...START, ai: true });
      h.menu.hide();

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${SPENDERS.length} declared draws over ${declared.size} file-and-stream pairs, and ${read.length} of ${modules.length} modules read: nothing else draws from either stream; `
            + `a match opening spends ${shuffle} on the ${h.wardenAI._circuit.length}-node circuit and nothing else; `
            + `a live patrol at seed ${SEED} first spent it on frame ${live.first} of ${live.frames}, all ${live.moved.drawn} of those draws under the AI and ${live.moved.look} from the look stream; `
            + `the same ${quiet.frames} frames with the AI off spent ${quiet.moved.drawn}`
          : problems.join('; '),
      };
    },
  });
}
