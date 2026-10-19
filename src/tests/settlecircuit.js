/**
 * BLACKLINE - tests/settlecircuit.js
 *
 * AUTO suite (H80, H81): which patrol circuit the settle got, who chose it,
 * and which **pose** that leaves the Warden in.
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
 * **Which made this a census and not a repair.** There is nothing wrong with
 * an unseeded match drawing a fresh circuit; that is what a new match should
 * do. What was wrong is a clause whose premise - *the Warden turns before it
 * steps, so the settle leaves it on its spawn* - was true of twenty circuits
 * out of twenty-one and was never established by the check that rested on it.
 *
 * **H81 took the other half, and found that distance was the wrong currency.**
 * The settle's reading above is a distance and an *absolute* turn, so a Warden
 * that turned 1.1333 rad left and one that turned 1.1333 rad right are one row
 * in that table and two different bodies in a photograph. Grouped by **pose** -
 * the distance and the **end yaw** - over 400 seeds a map, the settle has two
 * classes on the plant and **three** on the yard:
 *
 *   plant  383/400 at 0.000000m, yaw 1.2229 - 17/400 at 0.368476m, yaw 3.4895
 *   yard   363/400 at 0.000000m, yaw 2.0083 - **22/400 at 0.000000m, yaw
 *          4.2749** - 15/400 at 0.836667m, yaw 3.1850
 *
 * The middle yard row is the finding. It is on its spawn to the micrometre and
 * facing **2.27 radians** the other way, so the distance census above counted
 * it with the majority and the check passed. **One yard run in eighteen
 * photographed a Warden turned 130 degrees from the one the other seventeen
 * photographed**, and no instrument in this suite could see it - H80's least of
 * all, which is the point: a census is only as fine as the quantity it groups
 * by, and the first draft of this one grouped by the quantity the flake had
 * happened to move.
 *
 * **So the helper names a seed** (`SETTLE_SEED` in `pixels.js`, H81), which
 * pins all thirty of its callers to one circuit and therefore to one pose. The
 * seed is in the dominant class on both maps, which is the class 91% and 96% of
 * runs were already getting, so the change to what thirty checks measure is the
 * removal of the outlier rather than a move. **That constant is what this
 * module now holds**: it is read back off `pixels.js`, its pose is driven here,
 * and it must be the biggest group - a map whose waypoints move cannot leave
 * the helper pinned to an outlier in silence.
 *
 * Nothing here renders a frame, and nothing is held: the AI is the only thing
 * driving. Registered from tests/index.js; nothing imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { codeOf } from './sourcetext.js';
import { SETTLE_SEED } from './pixels.js';

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
/**
 * A yaw difference, wrapped, so a turn through pi reads as a turn - and
 * **signed** (H88): two seeds that drew one node are held to the same settle by
 * comparing this, and an absolute value made a left and a right of one size
 * agree, which is H81's class in the one place H81 did not reach.
 */
const turn = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/**
 * How finely a pose is compared (H81). Four places of a metre and of a radian,
 * which is a tenth of a millimetre and about two hundredths of a degree - far
 * below anything a photograph could resolve and far above the float noise two
 * runs of one circuit differ by, which is nothing: the same seed settles to the
 * same bits.
 *
 * **The yaw is the whole reason this exists.** Grouping by distance alone put
 * the yard's node 0 - on its spawn, facing 2.27 rad away - in with the
 * majority, and that is what H81 found.
 */
const POSE_PLACES = 4;
const poseOf = (warden) => `${warden.position.x.toFixed(POSE_PLACES)},${warden.position.z.toFixed(POSE_PLACES)},${warden.yaw.toFixed(POSE_PLACES)}`;

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
export function settleOnce(h, settle, seed) {
  h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true, seed });
  h.menu.hide();
  h.setPaused(false);
  h.input.clearAll();
  const node = h.wardenAI._circuit[0];
  const from = { x: h.warden.position.x, z: h.warden.position.z, yaw: h.warden.yaw };
  h.stepFrames(settle);
  return {
    node,
    moved: flat(h.warden.position, from),
    turned: turn(h.warden.yaw, from.yaw),
    yaw: h.warden.yaw,
    pose: poseOf(h.warden),
  };
}

export function settleClasses(h, settle) {
  const byNode = new Map();
  const byPose = new Map();
  for (let seed = 1; seed <= SCAN_SEEDS; seed++) {
    const read = settleOnce(h, settle, seed);
    const { node, moved, turned } = read;
    // H81: and the group that matters to a photograph, which is the body and
    // not the distance it is from somewhere.
    const sharing = byPose.get(read.pose);
    if (sharing) { sharing.seeds++; sharing.nodes.add(node); }
    else byPose.set(read.pose, { pose: read.pose, moved, yaw: read.yaw, seeds: 1, nodes: new Set([node]), first: seed });
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
  const poses = [...byPose.values()]
    .map((p) => ({ ...p, nodes: [...p.nodes].sort((a, b) => a - b) }))
    .sort((a, b) => b.seeds - a.seeds);
  return {
    scanned: SCAN_SEEDS,
    nodes,
    poses,
    onSpawn: nodes.filter((n) => n.moved <= ON_SPAWN),
    offSpawn,
    disagreed: nodes.filter((n) => n.disagreed),
    seedsOffSpawn: offSpawn.reduce((total, n) => total + n.seeds.length, 0),
  };
}

/**
 * The pose the most circuits settle into (H81) - the one a caller that names a
 * seed should be pinned to, because it is the picture the overwhelming majority
 * of unseeded runs were already taking. Null when the scan found none, which is
 * a red where it is asked for and never a fallback.
 */
export function dominantPose(classes) {
  return classes.poses.length ? classes.poses[0] : null;
}

/**
 * How many times the helper's body must pass the seed (H81): **two**, the call
 * and the restore, for H57's reason - the restore is the match the next check
 * inherits, so a helper that pinned the way in and left the way out to the
 * clock would hand half its callers an unpinned circuit.
 *
 * The constant itself is **imported** rather than grepped, so the clause below
 * measures the pose of the value the helper really uses and not of a copy. What
 * cannot be imported is whether the body passes it, which is what this is for:
 * an exported constant nothing passes would satisfy an import and leave thirty
 * callers on the clock.
 */
const SEED_NAME = 'SETTLE_SEED';
const PASSES_THE_SEED = new RegExp(`\\bseed:\\s*${SEED_NAME}\\b`, 'g');
const PASSES_IT_TIMES = 2;

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
  const body = codeOf(source.slice(at, close === -1 ? source.length : close + 2));
  const found = SETTLES.exec(body);
  if (!found) return { error: `${HELPER}()'s body no longer steps a fixed number of frames, so there is no settle to census (H73)` };
  PASSES_THE_SEED.lastIndex = 0;
  return { frames: Number(found[1]), passesSeed: (body.match(PASSES_THE_SEED) || []).length };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-settle-is-a-function-of-the-circuit-and-the-helper-names-the-seed',
    spec: 'Section 17.1 / H73, H80, H81',
    name: 'The frames quiesce() settles leave the Warden in a pose decided by the node its patrol circuit starts with and by nothing else, the circuits fall into more than one pose, and the seed the helper names is in the one the most of them share',
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

      // ------------------------------------------------------------------
      // 3. H81: the pose, which is the currency a photograph is in. Grouped
      //    by where the body ended and which way it faces, because the
      //    reading above takes the turn's absolute value and so cannot tell
      //    a Warden that turned left from one that turned right - which is
      //    how the yard's node 0, on its spawn and facing 2.27rad away, sat
      //    inside the majority for a whole job.
      // ------------------------------------------------------------------
      const dominant = dominantPose(classes);
      if (!dominant) {
        return { pass: false, detail: `${classes.scanned} seeds produced no settle pose at all, so this scan is driving nothing` };
      }
      if (classes.poses.length < 2) {
        problems.push(`every circuit of ${classes.scanned} settles into the same pose, and both maps have at least two - so either the walk gate has moved, a map's Warden spawn no longer faces a waypoint, or this census has stopped reading the yaw (H81's whole subject)`);
      }
      if (dominant.seeds * 2 <= classes.scanned) {
        problems.push(`the most common settle pose is only ${dominant.seeds} of ${classes.scanned} seeds, so there is no majority for ${HELPER}()'s seed to be pinned to and naming one picks a minority picture`);
      }

      // ------------------------------------------------------------------
      // 4. And the seed itself. The constant is imported, so this drives the
      //    pose of the value the helper really uses; what the import cannot
      //    say is that the body passes it, which `settleFrames` reads back.
      // ------------------------------------------------------------------
      if (read.passesSeed !== PASSES_IT_TIMES) {
        problems.push(`${HELPER}()'s body passes seed: ${SEED_NAME} ${read.passesSeed} time(s) and this census wants ${PASSES_IT_TIMES} - the call and the restore; the restore is the match the next check inherits (H57), so half of thirty callers would be back on the clock`);
      }
      const named = settleOnce(h, settle, SETTLE_SEED);
      if (named.pose !== dominant.pose) {
        const where = classes.poses.find((c) => c.pose === named.pose);
        problems.push(`${HELPER}() names seed ${SETTLE_SEED}, which draws node ${named.node} and settles to ${named.moved.toFixed(6)}m/yaw ${named.yaw.toFixed(4)} - a pose ${where ? `${where.seeds} of ${classes.scanned}` : 'no'} scanned circuits share, against the ${dominant.seeds} that share ${dominant.moved.toFixed(6)}m/yaw ${dominant.yaw.toFixed(4)} - so thirty callers are pinned to a picture the map does not usually take (H81)`);
      }

      // The scan leaves the last seed's match up, so leave the run in the state
      // every check after a pixel check already inherits: a live match on
      // whatever seed the clock is on now.
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      h.menu.hide();

      const worst = classes.offSpawn.reduce((far, n) => (n.moved > far ? n.moved : far), 0);
      const poses = classes.poses.map((c) => `${c.seeds}x ${c.moved.toFixed(6)}m/yaw ${c.yaw.toFixed(4)} (node${c.nodes.length > 1 ? 's' : ''} ${c.nodes.length > 3 ? `${c.nodes[0]}..${c.nodes[c.nodes.length - 1]}` : c.nodes.join(', ')})`).join('; ');
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${classes.scanned} seeds drew ${classes.nodes.length} distinct first nodes and every node settles to one reading; `
            + `${classes.poses.length} pose(s) over the ${settle} frames: ${poses}; `
            + `${classes.onSpawn.length} node(s) on spawn and ${classes.offSpawn.length} not, worst ${worst.toFixed(6)}m; `
            + `${HELPER}() names ${SETTLE_SEED} (x${read.passesSeed}), drawing node ${named.node} into the ${dominant.seeds}/${classes.scanned} pose, so its thirty callers all photograph that one (H81)`
          : problems.join('; '),
      };
    },
  });
}
