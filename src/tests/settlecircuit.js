/**
 * BLACKLINE - tests/settlecircuit.js
 *
 * AUTO suite (H80): which patrol circuit the settle got, and who chose it.
 *
 * **The flake H74's verify found, and what it was not.** One of two yard runs
 * read *"over the 20 frames `quiesce()` settles the Warden translated
 * 0.836667m ... turned 0.0435rad"* against bars of 0.000001m and 0.05rad - a
 * Warden already round and walking from the first frame, where H73 had measured
 * the yard's first node at 1.13 rad off the spawn nose and the first step on
 * frame 17. The entry that queued it read that as a dependence on what had run
 * before the check, and named the patrol circuit and the stream position at the
 * moment it is drawn as the thing left to rule out. **Both are innocent.**
 * `initMatch` calls `rng.reseed()`, which zeroes the stream, and nothing
 * between that and `rng.shuffle(this._circuit)` in `ai.reset()` draws from it -
 * `createMatchState`, `shade.reset`, `warden.reset` and `detection.reset`
 * contain no draw at all - so the shuffle is always the first draw of a match
 * and the circuit is a function of the seed alone.
 *
 * **The seed is the wall clock.** `deriveSeed()` returns `Date.now() >>> 0`
 * when the URL names none, the suite names none, and so every `initMatch` in
 * every run gets a seed no two of which are alike. The circuit is therefore
 * redrawn every match, and whether the Warden spends the settle turning or
 * walking is decided by which node the shuffle put first. Driven once per seed
 * over seeds 1 to 400, both maps, the settle has exactly **two** readings:
 *
 *   yard   385/400 turned 1.1333rad and translated 0.000000m - 15/400 turned
 *          0.0435rad and translated 0.836667m
 *   plant  383/400 turned 1.1333rad and translated 0.000000m - 17/400 turned
 *          1.1333rad and translated 0.368476m
 *
 * and in **every** one of those 32 readings the circuit's first node is
 * **node 1**, which is the node each map's Warden spawn is already facing. So
 * the rate is 3.75% a run on the yard and 4.25% on the plant, the plant's
 * half had never been seen because it fails the position bar alone, and over
 * the four runs of a full verify the check reds about one time in seven -
 * against the one failure in twelve runs H74 counted, which is the same number.
 *
 * **Which makes this a census and not a repair.** There is nothing wrong with
 * an unseeded match drawing a fresh circuit; that is what a new match should
 * do. What was wrong is a clause whose premise - *the Warden turns before it
 * steps, so the settle leaves it on its spawn* - was true of twenty circuits
 * out of twenty-one and was never established by the check that rested on it.
 * `tests/quiesce.js` now names the seed its settle is measured at and takes
 * that premise from here, and this module holds the two things the premise
 * rests on: that a settle reading is a function of the circuit's first node and
 * of nothing else, and that there is a circuit for which the Warden does not
 * leave its spawn at all.
 *
 * **What is left over, and it is bigger than this job.** Twelve of `quiesce()`'s
 * sites grab a frame without stepping one (H74), which is to say at the end of
 * exactly this settle - so in about one run in twenty-four those twelve pixel
 * readings are taken with the Warden 0.37m or 0.84m off the spawn their prose
 * assumes. That is a second channel into the band H74 measured and could not
 * attribute, and it is the one H77 was queued to look for. It is in the queue.
 *
 * Nothing here renders a frame, and nothing is held: the AI is the only thing
 * driving. Registered from tests/index.js; nothing imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { codeOf } from './sourcetext.js';

/**
 * The helper this censuses the settle of, and the file it lives in. Named here
 * rather than imported from `quiesce.js` because that module imports this one -
 * it takes its premise from this census - and a cycle between a clause and the
 * thing it rests on is how a premise stops being checked.
 */
const HELPER = 'quiesce';
const HELPER_FILE = 'src/tests/pixels.js';

/**
 * How many frames the helper settles, read off its own body so that a helper
 * which grew its settle past the turn is censused as it really is (H73's rule,
 * and `quiesce.js` holds the same number against its own clause).
 *
 * **The name is data and not a regex literal**, which is the trap the sites
 * census paid seventy minutes for and names in its header: `codeOf` strips a
 * string and leaves a regex literal where it is, so a pattern spelled with the
 * identifier in it puts that identifier in *this* module's code, where another
 * census reads it as a call.
 */
const STEPPER = 'stepFrames';
const SETTLES = new RegExp(`\\b${STEPPER}\\((\\d+)\\)`);

/**
 * Seeds driven, from 1. Forty-eight because both classes have to be reached on
 * both maps for the census to be held both ways, and the first circuit that
 * walks is seed 26 on the yard and seed 36 on the plant - so a scan that
 * stopped at 32 would report an empty class on the plant and call it clean.
 * The scan costs about 25ms: forty-eight matches and twenty frames each.
 */
const SCAN_SEEDS = 48;

/**
 * A settle that left the Warden where `initMatch` put it. The same metre as
 * `quiesce.js`'s `ON_SPAWN`, and deliberately not imported from it: this module
 * is what that one takes its premise from, and a circular import between a
 * clause and its premise is how a premise stops being checked.
 */
const ON_SPAWN = 1e-6;

/** Horizontal distance, because a settling body's travel is all in y (H74). */
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** A yaw difference, wrapped, so a turn through pi reads as a turn. */
const turn = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/**
 * Drive the settle once per seed and group the readings by the node the circuit
 * starts with.
 *
 * The match is the one `quiesce()` starts, frame for frame, with a seed named
 * instead of left to the clock - so what comes back is what a caller would have
 * got had the clock handed it that circuit.
 *
 * @param {object} h the harness
 * @param {number} settle frames, read off the helper's own source by the caller
 * @returns {{scanned: number, nodes: object[], onSpawn: object[],
 *   offSpawn: object[], disagreed: object[], seedsOffSpawn: number}}
 */
export function settleClasses(h, settle) {
  const byNode = new Map();
  for (let seed = 1; seed <= SCAN_SEEDS; seed++) {
    h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true, seed });
    h.menu.hide();
    h.setPaused(false);
    h.input.clearAll();
    const node = h.wardenAI._circuit[0];
    const from = { x: h.warden.position.x, z: h.warden.position.z, yaw: h.warden.yaw };
    h.stepFrames(settle);
    const moved = flat(h.warden.position, from);
    const turned = turn(h.warden.yaw, from.yaw);
    const seen = byNode.get(node);
    if (!seen) {
      byNode.set(node, { node, moved, turned, seeds: [seed], disagreed: null });
      continue;
    }
    seen.seeds.push(seed);
    // Two seeds that drew the same first node must settle identically, or the
    // settle is reading something the seed does not decide.
    if (!seen.disagreed && (Math.abs(seen.moved - moved) > ON_SPAWN || Math.abs(seen.turned - turned) > ON_SPAWN)) {
      seen.disagreed = { seed, moved, turned, against: seen.seeds[0] };
    }
  }
  const nodes = [...byNode.values()];
  const offSpawn = nodes.filter((n) => n.moved > ON_SPAWN);
  return {
    scanned: SCAN_SEEDS,
    nodes,
    onSpawn: nodes.filter((n) => n.moved <= ON_SPAWN),
    offSpawn,
    disagreed: nodes.filter((n) => n.disagreed),
    seedsOffSpawn: offSpawn.reduce((total, n) => total + n.seeds.length, 0),
  };
}

/**
 * The circuit a caller would want to be measuring in: one whose settle leaves
 * the Warden on its spawn, which is the premise twelve of `quiesce()`'s sites
 * and one of `quiesce.js`'s clauses rest on. Null when no scanned circuit has
 * that property, which is a red where it is asked for and not a fallback.
 */
export function aCircuitThatOnlyTurns(classes) {
  return classes.onSpawn.length ? classes.onSpawn[0] : null;
}

/**
 * The frames the helper settles, off its own source. Returns the count, or the
 * reason it could not be read - which is a red where it is asked for, never a
 * default, because a census that drove a number of its own would be censusing
 * a settle the tree does not have.
 */
export async function settleFrames() {
  const source = await (await fetch(`${location.origin}/${HELPER_FILE}`)).text();
  const at = source.indexOf(`export function ${HELPER}(`);
  if (at === -1) return { error: `${HELPER_FILE} no longer exports a function called ${HELPER}(), and this census is about what its settle does` };
  const close = source.indexOf('\n}', at);
  const found = SETTLES.exec(codeOf(source.slice(at, close === -1 ? source.length : close + 2)));
  if (!found) return { error: `${HELPER}()'s body no longer steps a fixed number of frames, so there is no settle to census (H73)` };
  return { frames: Number(found[1]) };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-settle-is-a-function-of-the-circuit-and-the-clock-draws-the-circuit',
    spec: 'Section 17.1 / H73, H80',
    name: 'The frames quiesce() settles leave the Warden somewhere decided by the node its patrol circuit starts with and by nothing else, there is a circuit for which it does not leave its spawn at all, and there is one for which it does',
    run: async (h) => {
      const problems = [];
      // The settle, off the helper's own source, so a helper that grew it past
      // the turn is censused as it really is rather than as it was written up.
      const read = await settleFrames();
      if (read.error) return { pass: false, detail: read.error };
      const settle = read.frames;
      const classes = settleClasses(h, settle);

      // ------------------------------------------------------------------
      // 1. The clause. A settle reading is decided by the circuit's first
      //    node: two seeds that drew the same node must settle to the same
      //    metre and the same radian. A wall-clock read or an unseeded draw
      //    anywhere under the settle breaks this and nothing else here.
      // ------------------------------------------------------------------
      for (const n of classes.disagreed) {
        problems.push(`seeds ${n.disagreed.against} and ${n.disagreed.seed} both drew node ${n.node} first and the settle came out ${n.moved.toFixed(6)}m/${n.turned.toFixed(4)}rad against ${n.disagreed.moved.toFixed(6)}m/${n.disagreed.turned.toFixed(4)}rad - the settle is reading something the seed does not decide`);
      }

      // ------------------------------------------------------------------
      // 2. And the other half a census of a set always owes (H11, H74):
      //    both classes are populated on this tree, so a scan that has
      //    stopped reaching one names itself instead of passing. The
      //    off-spawn class is the one the prose about twelve one-frame
      //    sites is wrong about, and it is why it may not quietly empty.
      // ------------------------------------------------------------------
      if (!classes.onSpawn.length) {
        problems.push(`no circuit of ${classes.scanned} leaves the Warden on its spawn over the ${settle} settling frames, and twelve of quiesce()'s sites grab their frame there - so either the turn-before-step the premise rests on is gone or this scan is driving nothing`);
      }
      if (!classes.offSpawn.length) {
        problems.push(`every circuit of ${classes.scanned} leaves the Warden on its spawn, and on both maps one node of twenty-one does not - so either a map's Warden spawn no longer faces a waypoint, the walk gate has moved, or this scan has stopped varying the circuit (H80)`);
      }
      if (classes.nodes.length < 2) {
        problems.push(`${classes.scanned} seeds drew ${classes.nodes.length} distinct first node(s), so the seed is not reaching the shuffle and every reading below is one circuit over again`);
      }

      // The scan leaves the last seed's match up, so leave the run in the state
      // every check after a pixel check already inherits: a live match on
      // whatever seed the clock is on now.
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();

      const worst = classes.offSpawn.reduce((far, n) => (n.moved > far ? n.moved : far), 0);
      const nodes = classes.offSpawn.map((n) => `${n.node} (${n.moved.toFixed(6)}m, ${n.turned.toFixed(4)}rad)`).join(', ');
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${classes.scanned} seeds drew ${classes.nodes.length} distinct first nodes and every node settles to one reading; `
            + `${classes.onSpawn.length} node(s) leave the Warden on its spawn over the ${settle} frames, ${classes.offSpawn.length} do not: ${nodes}; `
            + `${classes.seedsOffSpawn}/${classes.scanned} seeds draw one of those, worst ${worst.toFixed(6)}m off spawn - the clock picks the seed, so that is the rate at which twelve one-frame sites grab a Warden off its mark (H77)`
          : problems.join('; '),
      };
    },
  });
}
