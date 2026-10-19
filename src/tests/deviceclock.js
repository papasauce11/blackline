/**
 * BLACKLINE - tests/deviceclock.js
 *
 * What the audio device journal's numbers mean (H93): the three readers that
 * turn a run's clock, its worst unfed stretch and its widest unwatched gap into
 * verdicts and words, the constants each is argued from, and the two case
 * tables that put every one of them to the readings on record every suite run.
 *
 * Split out of `tests/audiodevice.js` at 597 of 600 lines, verbatim, on H75's
 * shape and `censustally.js`'s: pure functions and data that import nothing and
 * register nothing. What stayed is the device asked about itself - the two
 * checks, `UNASKED`, the registration-order constants - and it is the only
 * module that imports this one. The arguments for every number are where they
 * were written, beside the number; the module header that carries D74's and
 * H35's reasoning is still `audiodevice.js`'s.
 *
 * Nothing here imports main.js (Section 3.1), and nothing here is registered.
 */

/**
 * Below this much wall clock since the unlock, the ratio is printed as what it
 * is rather than as a reading. The unlock happens at `tests/audio.js`, two
 * thirds of the way up the registration order, so in a suite run this window
 * is minutes - but a subset that reaches this check without reaching that one
 * unlocks the device here, and a window of milliseconds is a reading about the
 * first buffer. Since H50 one verdict rests on that difference, so the
 * constant is load-bearing rather than cosmetic: under this window a clock
 * that has not moved is a clock that has not been asked, and nothing is said.
 */
export const MIN_WINDOW_SECONDS = 30;

/**
 * Below this many marks there is no shape to read (H54). A subset that reaches
 * this check without reaching the frame drivers has a handful, and the longest
 * stretch across a handful of marks is an artefact of how rarely anyone looked
 * rather than a fact about the device. Thirty is the warm-up count
 * `tests/performance.js` discards, borrowed for the same reason: the smallest
 * number of frames this project is willing to read anything off.
 */
export const MIN_SHAPE_SAMPLES = 30;

/**
 * At or above this fraction of everything lost in one stretch, the loss is
 * reported as **one** stretch rather than as many (H54). A device that stopped
 * once and stayed stopped puts all of it in one and reads 1.0; this machine,
 * losing the same seconds a frame at a time, reads three orders of magnitude
 * under that. So the line is a classification with a factor of two above the
 * first case and a factor of hundreds above the second, which is the kind of
 * margin this project argues a threshold from - and it decides a word in a
 * detail line and nothing else, because no verdict rests on it (D74).
 */
export const CONCENTRATED = 0.5;

/**
 * How much of everything lost the widest **unwatched** gap may be worth before
 * the concentration above stops being a concentration over the run (H66).
 * `CONCENTRATED` with a factor of ten under it, because a gap the device went
 * unfed across is charged to one stretch in full: a blind spot worth the line
 * itself could supply the line on its own. Measured here it is **1.00 and
 * 1.16** of the loss - twenty times this line (H94 is what would move it).
 */
export const RESOLVED = CONCENTRATED / 10;

/**
 * The device's clock against the wall clock, and the one verdict a total of it
 * supports.
 *
 * Pure, and exported so that `CLOCK_CASES` can put the clause to the readings
 * on record rather than to whatever this machine answers this morning - the
 * shape `timedrenders.js` uses for `timedVerdictAsked()`, and for the same
 * reason: a clause whose subject is intermittent needs a table under it.
 *
 * `stopped` is the whole of the verdict and it is a **sign**. The clock
 * advanced, or it did not. How far it advanced is `fed`, which is reported and
 * carries no floor (D74) - and the honest limit of a sign is in the table: a
 * device fed for one buffer of a quarter-hour run answers `stopped: false`,
 * because 2.7ms and 461.6s are the same sign and only a floor tells them
 * apart. Under `MIN_WINDOW_SECONDS` there is no reading to have, so `measured`
 * is false and `stopped` cannot be true: a subset that reaches this check
 * unlocks the device at it, and a window of milliseconds is a question about
 * the first buffer rather than about the device.
 *
 * @param {number} clockGained seconds the device's own clock has gained
 * @param {number} wallSeconds seconds of wall clock over the same window
 * @returns {{ measured: boolean, lost: number, fed: number|null, stopped: boolean }}
 */
export function readDeviceClock(clockGained, wallSeconds) {
  const measured = wallSeconds >= MIN_WINDOW_SECONDS;
  return {
    measured,
    lost: wallSeconds - clockGained,
    fed: wallSeconds > 0 ? clockGained / wallSeconds : null,
    stopped: measured && !(clockGained > 0),
  };
}

/**
 * The shape of the loss: one stretch, or many (H54).
 *
 * Pure and exported for `CLOCK_CASES`' reason, and the second half of the pair
 * D74 asked for. `lostSeconds` is `readDeviceClock()`'s total, `worstMs` is the
 * longest stretch the journal is **known** to have watched the clock stand
 * still across, and `samples` is how many marks it was handed at all.
 *
 * `concentration` is the worst stretch over everything lost, and it is the
 * whole of what this adds: a device that stopped once and stayed stopped puts
 * every lost second in one stretch and reads about 1.0, while a machine that
 * loses the same seconds a frame at a time reads near zero. Nothing is asserted
 * off it (D74): `shape` is a word in a detail line, and the reason it is only
 * that is the reach the module header sets out - the marks come in bursts, so
 * this is a concentration over what was watched.
 *
 * Above 1.0 is not an error and is not clamped: a device that lost a tenth of
 * a second in total and stood still for most of a frame is honestly one
 * stretch, and the number says how much more than the total that stretch was.
 *
 * @param {number} lostSeconds seconds of the window the device was not fed for
 * @param {number} worstMs the longest known-unfed stretch, in milliseconds
 * @param {number} samples marks the journal was handed
 * @returns {{ measured: boolean, worstSeconds: number, concentration: number|null, shape: string }}
 */
export function readUnfedShape(lostSeconds, worstMs, samples) {
  const worstSeconds = worstMs / 1000;
  const measured = samples >= MIN_SHAPE_SAMPLES && lostSeconds > 0;
  if (!measured) return { measured, worstSeconds, concentration: null, shape: 'unmeasured' };
  const concentration = worstSeconds / lostSeconds;
  return {
    measured,
    worstSeconds,
    concentration,
    shape: concentration >= CONCENTRATED ? 'one-stretch' : 'many-stretches',
  };
}

/**
 * What the journal's blind spot is worth against the loss, and so whether the
 * concentration beside it is a concentration over the **run** (H66).
 *
 * Pure and exported for `CLOCK_CASES`' reason, and the number the floor D74
 * refused would have to clear before it could be written. `blind` is the
 * widest interval between two marks over everything lost: at 1.00 the whole of
 * a run's loss fits inside the one interval nobody looked at, so the
 * distribution of that loss is not a thing this instrument measured - it is a
 * thing it assumed by having no mark in there. Nothing is asserted off
 * `resolves` either, and on this machine it is never true.
 *
 * @param {number} lostSeconds seconds of the window the device was not fed for
 * @param {number} maxGapMs the widest interval between two marks, in ms
 * @returns {{ measured: boolean, gapSeconds: number, blind: number|null, resolves: boolean }}
 */
export function readCoverage(lostSeconds, maxGapMs) {
  const gapSeconds = maxGapMs / 1000;
  if (!(lostSeconds > 0)) return { measured: false, gapSeconds, blind: null, resolves: false };
  const blind = gapSeconds / lostSeconds;
  return { measured: true, gapSeconds, blind, resolves: blind <= RESOLVED };
}

/**
 * The floor on the stretch (H92), and the only floor the journal carries: one
 * continuous span the device is **known** to have gone unfed across, longer
 * than this, is red. No `fed` term - D74's refusal of a floor on the total is
 * unchanged and still right.
 *
 * The margins, off the readings on record: the worst single stretch any
 * healthy full run has shown is **2.211s** (fourteen readings, H66), so this
 * line is **27x** above it; every synthetic fault in `CLOCK_CASES` is
 * **252-815s**, so it is **4-14x** under all of them. And a red cannot be a
 * sampling artefact, which is what lets a floor sit here at all: a stretch is
 * bounded by two marks reading one monotonic `currentTime`, so it is a proven
 * span and a lower bound - a wider blind spot makes it shorter, never longer.
 */
export const UNFED_FLOOR_SECONDS = 60;

/**
 * Whether one stretch is over the floor. Pure, for `CLOCK_CASES`' reason.
 *
 * @param {number} worstMs the longest known-unfed stretch, in milliseconds
 * @returns {{ seconds: number, over: boolean }}
 */
export function readUnfedFloor(worstMs) {
  const seconds = worstMs / 1000;
  return { seconds, over: seconds > UNFED_FLOOR_SECONDS };
}

/**
 * The clauses above, put to every reading on record and to the breaks they
 * exist to tell apart. `gained` and `wall` are seconds, `stopped` is what
 * `readDeviceClock()` must answer, and `why` is printed when it answers the
 * other way.
 *
 * The eleven healthy rows are H35's, H46's and H47's verifies, each a full
 * suite run of one map (`PROGRESS.md`); `gained` is the recorded `fed` times
 * the recorded window, so the fourth decimal of the quotient is rounding.
 * Every one must stay green, and **so must the halfway stop**, because the
 * total cannot tell it from a loaded machine.
 *
 * A row that also carries `worstMs`, `samples` and `shape` is one of **the
 * stretch's own cases** (H54, H66), and `readUnfedShape()` is asked about it
 * too: the eleven recorded readings predate the journal keeping any shape and
 * carry none, the next rows are the pairs D74 says a total cannot separate
 * with the shape separating them, and the last two are H66's - the pair the
 * *shape* cannot separate either. `whyShape` is printed when the word comes
 * out wrong.
 */
export const CLOCK_CASES = [
  { gained: 461.6, wall: 814.7, stopped: false, why: 'the plant run H35 measured: fed 0.5665, the lowest full-run reading on record, 353.1s of the page unfed' },
  { gained: 525.6, wall: 808.3, stopped: false, why: "H46's first plant run, fed 0.6503" },
  { gained: 1222.9, wall: 1966.0, stopped: false, why: "H46's second plant run, fed 0.6220 over a window of half an hour" },
  { gained: 563.8, wall: 822.4, stopped: false, why: "H47's first plant run, fed 0.6856" },
  { gained: 1287.3, wall: 2007.9, stopped: false, why: "H47's second plant run, fed 0.6411 over the longest window on record" },
  { gained: 383.3, wall: 538.4, stopped: false, why: "H35's yard run, fed 0.7119" },
  { gained: 922.9, wall: 1348.5, stopped: false, why: "H35's second yard run, fed 0.6844" },
  { gained: 399.1, wall: 533.5, stopped: false, why: "H46's first yard run, fed 0.7481, the highest full-run reading on record" },
  { gained: 941.2, wall: 1355.9, stopped: false, why: "H46's second yard run, fed 0.6941" },
  { gained: 384.0, wall: 538.4, stopped: false, why: "H47's first yard run, fed 0.7132" },
  { gained: 925.2, wall: 1351.6, stopped: false, why: "H47's second yard run, fed 0.6844" },
  { gained: 230.8, wall: 814.7, stopped: false, why: 'a device that stopped at the halfway point of H35\'s plant run: fed 0.283, and green on purpose - 0.283 is also a healthy device on a machine twice as loaded, so no floor separates them (D74)' },
  { gained: 0.0027, wall: 814.7, stopped: false, why: 'a device fed for one 128-sample buffer of a quarter-hour run: green, and this is the whole of what a sign cannot do' },
  { gained: 0, wall: 814.7, stopped: true, why: 'a device never fed at all over a window of minutes, which is the one thing a total proves and the reason this clause exists' },
  { gained: 0, wall: MIN_WINDOW_SECONDS, stopped: true, why: `a dead device at exactly the ${MIN_WINDOW_SECONDS}s window, which is a measurement and must be judged` },
  { gained: 0, wall: MIN_WINDOW_SECONDS - 0.1, stopped: false, why: 'a dead device a tenth of a second under the window: no measurement to have, so no verdict' },
  { gained: 0, wall: 1.8, stopped: false, why: "the 1.8s subset window H35 took as a control, with nothing fed in it - still not a reading about the device" },
  { gained: 0, wall: 0, stopped: false, why: 'the check reached before the unlock has had any wall clock at all, where fed is null and nothing is known' },

  // The stretch's own cases. The first two are the pair D74 names as the one a
  // total cannot tell apart, with the same `fed` and opposite shapes; the next
  // two are the pair it says a total cannot tell apart *at all*.
  {
    gained: 461.6, wall: 814.7, stopped: false, worstMs: 760, samples: 1200, shape: 'many-stretches', over: false,
    why: 'H35\'s plant run again, now with a shape on it', whyShape: 'the 353.1s of loss arriving one slow frame at a time: 0.76s of it in the worst stretch is a concentration of 0.002, which is this machine on an ordinary morning',
  },
  {
    gained: 461.6, wall: 814.7, stopped: false, worstMs: 353100, samples: 1200, shape: 'one-stretch', over: true,
    why: 'the same total from a device that died', whyShape: 'the same 353.1s lost in ONE stretch - concentration 1.00 against the row above it at 0.002, identical in `fed` and opposite here, which is the whole of what D74 said a total could not do',
  },
  {
    gained: 230.8, wall: 814.7, stopped: false, worstMs: 583900, samples: 1200, shape: 'one-stretch', over: true,
    why: 'the halfway stop, which stays green', whyShape: 'the halfway stop with its shape: 583.9s lost and all of it one stretch, said in a word where the ratio alone could only say 0.283',
  },
  {
    gained: 230.8, wall: 814.7, stopped: false, worstMs: 900, samples: 1200, shape: 'many-stretches', over: false,
    why: 'fed 0.283 from a loaded machine rather than a fault', whyShape: 'the third case, which D74 says the total cannot tell from the second AT ALL: the same 0.283 with 0.9s in the worst stretch is a machine twice as loaded as this one, and it lands with the first row rather than with the halfway stop',
  },
  {
    gained: 0.0027, wall: 814.7, stopped: false, worstMs: 814000, samples: 1200, shape: 'one-stretch', over: true,
    why: 'the one-buffer device, whose sign is green', whyShape: 'the device a sign cannot catch, caught here: 814.0s of 814.7s lost in one stretch is 0.999, and this row is why the pair is worth more than either half',
  },
  {
    gained: 0, wall: 814.7, stopped: true, worstMs: 814700, samples: 1200, shape: 'one-stretch', over: true,
    why: 'a dead device, red on the sign', whyShape: 'a device never fed at all, where the sign is already red and the shape agrees with it',
  },
  {
    gained: 814.6, wall: 814.7, stopped: false, worstMs: 700, samples: 1200, shape: 'one-stretch', over: false,
    why: 'a healthy device on a machine that is not this one', whyShape: 'a tenth of a second lost in total and most of a frame of it in one stretch, so the concentration is above 1 and the word is still right - a shape is a shape of whatever was lost, which is why no verdict rests on it alone',
  },
  {
    gained: 814.7, wall: 814.7, stopped: false, worstMs: 0, samples: 1200, shape: 'unmeasured', over: false,
    why: 'a device fed across every mark of a quarter-hour run', whyShape: 'nothing lost at all, so there is no loss for a shape to be the shape of',
  },
  {
    gained: 461.6, wall: 814.7, stopped: false, worstMs: 760, samples: MIN_SHAPE_SAMPLES - 1, shape: 'unmeasured', over: false,
    why: 'the plant run as a subset would have sampled it', whyShape: `${MIN_SHAPE_SAMPLES - 1} marks is under the ${MIN_SHAPE_SAMPLES} this takes: the longest stretch across a handful of marks is an artefact of how rarely anyone looked`,
  },

  // H66's pair, and neither half is imagined: both numbers come off one run of
  // the gate that landed this job. A gap whose marks read the same clock at
  // both ends is charged to one stretch in full, so a fault that happened
  // entirely inside the blind spot is still read as one - coverage costs where
  // and never whether. The second row is the control.
  {
    gained: 576.1, wall: 827.2, stopped: false, worstMs: 252141, samples: 401, shape: 'one-stretch', over: true,
    why: "the 2026-10-17 gate's plant run, fed 0.6964, with a fault inside its own blind spot",
    whyShape: 'that run\'s own widest unwatched gap of 252.141s put where its stretch goes, against its own 251.1s of loss: concentration 1.00 and `one-stretch`, because the two marks bracketing a gap charge all of it - so an outage nobody watched is still caught, and what the blind spot costs is where it fell (H66)',
  },
  {
    gained: 576.1, wall: 827.2, stopped: false, worstMs: 25214, samples: 401, shape: 'many-stretches', over: false,
    why: 'the same run with a blind spot a tenth of the size',
    whyShape: 'the same loss with the gap divided by ten reads 0.100 and comes back "many-stretches", so it is the span and not the loss that decides the word above - which is why a floor belongs on the span (H92) and not on the pair',
  },
  // H92: the floor, both sides of its line. The first is a fault the floor is
  // not for - 59s unfed in one stretch stays green, and the shape still calls
  // it what it is; the second is H35's healthy plant run with its worst
  // stretch raised to 61s, which is the only thing that changes and is red.
  {
    gained: 461.6, wall: 814.7, stopped: false, worstMs: 59000, samples: 1200, shape: 'many-stretches', over: false,
    why: 'a stretch one second under the floor', whyShape: '59s of 353.1s in one stretch is 0.167 of the loss, which is many stretches and under the line',
  },
  {
    gained: 461.6, wall: 814.7, stopped: false, worstMs: 61000, samples: 1200, shape: 'many-stretches', over: true,
    why: 'H35\'s plant run with its worst stretch one second past the floor', whyShape: '61s of 353.1s is 0.173, still many stretches - the floor reds it on the span alone, which is the point',
  },
];

/**
 * The coverage's own cases (H66): everything lost, the widest gap between two
 * marks, and whether `readCoverage()` calls what sits beside it a
 * concentration over the run. The first two are the readings this clause was
 * written from - both runs of the gate that landed it - and the rest are the
 * line from either side, including the gap a journal marked between checks
 * rather than on a frame would read (**H92**).
 */
export const COVERAGE_CASES = [
  { lost: 251.1, maxGapMs: 252141, resolves: false, why: "the gate's plant run: the blind spot is worth 1.00 of the loss, so all of it fits in the interval nobody watched" },
  { lost: 145.3, maxGapMs: 168308, resolves: false, why: "the gate's yard run: 1.16 of the loss, and the shorter run is the worse of the two" },
  { lost: 100, maxGapMs: 5000, resolves: true, why: `the line exactly: a gap worth ${RESOLVED} of the loss is the most that leaves the concentration a reading about the run` },
  { lost: 100, maxGapMs: 5100, resolves: false, why: 'a tenth of a second past the line, which must answer the other way or the line is not one' },
  { lost: 100, maxGapMs: 50000, resolves: false, why: 'a blind spot worth half the loss: it could supply CONCENTRATED on its own, so the concentration is not a reading over the run' },
  { lost: 100, maxGapMs: 500, resolves: true, why: 'the five-second gap a mark taken between checks would leave, which is what would make the concentration a reading over the run (H94)' },
  { lost: 0, maxGapMs: 252141, resolves: false, why: 'nothing lost at all, so there is no loss for a blind spot to be blind to and no coverage to read' },
];
