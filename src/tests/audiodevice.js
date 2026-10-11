/**
 * BLACKLINE - tests/audiodevice.js
 *
 * AUTO suite (H35): the one audio device context, asked about itself.
 *
 * **What H35 was for.** *"The AudioContext encountered an error from the audio
 * device or the WebAudio renderer."* has appeared in three of the thirty-six
 * suite runs on record (H27 yard, H29 plant, H39 plant). H27 called it
 * environmental, H28 called it closed after one clean verify, H29 brought it
 * back, H32 closed the **code** side of it, and H35 was asked to collect three
 * cold gates' console-error counts and then either close it or name what to
 * look at next. Six cold gates now read 0 and the error sits at 3 of 36 runs
 * with nothing about position in a session predicting it, so the warming
 * hypothesis the record was built on is not what is left - and an intermittent
 * fault is not closed by an absence however long. What is left is the
 * **device**, which H32 left reading 48000Hz and otherwise unexamined, and
 * this check is the instrument for that answer rather than the answer.
 *
 * **Why the device has to keep its own journal.** The error arrives
 * asynchronously from Chrome's audio service, with no stack, attributed to the
 * page URL. `scripts/suite.mjs` stamps it with the map, the run and the
 * seconds into the run - the most the Node end can know - and nothing had ever
 * asked the context whether it was still running when it arrived. A check
 * cannot ask: every occurrence came minutes into a run that was otherwise
 * fine, so a question put at one moment answers about that moment.
 * `systems/audiodevice.js` therefore keeps a record from the unlock, and this
 * check reads it near the end of the run, where it covers the most ground.
 *
 * **And the reading is the finding.** The device's clock is advanced by the
 * thread that renders to the output device, so the wall clock it has not
 * gained since the unlock is time the device was not being fed. Measured here,
 * on a full plant run: the clock gained **461.6s of 814.7s** - the output
 * device went unrendered for **353.1s, 43% of the page**, with the context
 * reading `running` the whole way and no error event at all. A 16.5-second
 * subset of the same tree read 0.8s lost, so the loss is not a startup offset:
 * it accumulates with the run. This machine does not feed its audio device
 * while the suite is rasterising on four pinned cores, and that is a far better
 * candidate for an intermittent device error than anything in H32's list.
 * H35's `PROGRESS.md` entry argues it; `TRAPS.md` carries the sentence.
 *
 * **No floor rests on the ratio, and H50 measured before saying so** (D74).
 * H41's lesson applies one layer over - a wall clock on this machine cannot
 * price a draw (D71) and it cannot price the audio device either - but the
 * queue asked for readings rather than for that argument, and eleven full-run
 * readings now exist, each a solo suite run of one map: `fed` 0.5665, 0.6220,
 * 0.6411, 0.6503 and 0.6856 on the plant, 0.6844, 0.6844, 0.6941, 0.7119,
 * 0.7132 and 0.7481 on the yard. The arithmetic a floor would be argued from
 * is real - a device that stopped at a run's halfway point reads about half
 * its healthy value, 0.28 to 0.36, and 0.45 would separate that from every
 * reading taken - and it is still refused, because **the ratio is a total and
 * a total has no shape**. 0.57 is this machine with a device that stops
 * feeding and resumes some hundreds of times; 0.28 is a device that stopped
 * once and stayed stopped; 0.28 is also a *healthy* device on a machine twice
 * as loaded as this one. The total cannot tell the first from the second
 * without the shape it does not keep, and cannot tell the second from the
 * third at all - and the solo spread already on record is 32% wide with no
 * cause attributed, so 0.45 is 1.26x under the lowest healthy reading rather
 * than a margin. A false red here costs a whole run (the gate routes it to
 * `## BROKEN BASE`), which is the price of guessing. D74 is the page.
 *
 * **What a total does support is a sign, and that is asserted** (H50): over a
 * window of minutes the device's clock has advanced at all. A device that was
 * never fed reads exactly zero and goes red naming the window; a device
 * starved for 43% of the page gains 461.6s and says nothing, which is the
 * difference between a verdict about the build and a verdict about the
 * morning. It is the weakest clause this number carries and deliberately so:
 * `readDeviceClock()` is it, `CLOCK_CASES` puts it to all eleven readings, to
 * the halfway stop and to a dead device, and the halfway case is asserted
 * **green** - which is where a later job that wants a floor meets D74.
 *
 * **H54 built the shape the total has none of, and `readUnfedShape()` is the
 * reader of it.** The journal now keeps the longest wall interval across which
 * `currentTime` is **known** not to have moved, where it started, and how many
 * marks fell inside it. Held against the loss, that one number does the thing
 * D74 said no total could: the **concentration** - the worst stretch over
 * everything lost - is about 1.0 for a device that stopped once and stayed
 * stopped and three orders of magnitude under that for a machine losing the
 * same seconds a frame at a time. So the two cases D74 could not separate are
 * separated, and the third - a healthy device on a machine twice as loaded -
 * lands with the second rather than with the first, which is the right side.
 * The classification is **reported** and not asserted, for the reason
 * `readDeviceClock()`'s size is: see the honest limit below, and `D74`'s own
 * page for what H54 measured and what it decided about the floor.
 *
 * **The honest limit, and it is what the number has to be read through.** The
 * marks come from `AudioSystem.step()`, which runs on frames, and **the rAF
 * loop drives no frames while the AUTO suite runs** (F4) - so every mark comes
 * from a check that drove one, and they arrive in bursts with minutes of
 * unwatched page between them. `systems/audiodevice.js` therefore charges the
 * device only intervals bounded at both ends by marks that read the *same*
 * clock, and reports `samples`, `sampledToMs` and `maxGapMs` beside the
 * stretch so the blind spot is on the record with it. What follows is that this
 * instrument sees the shape of the loss **inside a burst of frames** and not
 * across a whole run, and the concentration it measures is a concentration over
 * what it watched. That is a reach a job could widen; it is not a reading that
 * misleads, because the three numbers that bound it go out beside it.
 *
 * What is asserted is therefore five things about the device, four of them true
 * whether or not it is being starved - there is exactly one of it, it is still
 * running, it is still the device the graph was built for, it entered no state
 * nobody asked for, and its clock has moved - plus, since H54, that the
 * stretch's **arithmetic** is sound: a stretch inside the window it was sampled
 * over, never charging the device a millisecond nobody looked at, and marks
 * arriving at all over a window of minutes. Nothing else in this suite holds
 * any of them.
 *
 * **Those four can go red for an environmental reason, and they are asserted
 * anyway** (D73). D67 decided the other way about the console message - a
 * device error is counted, printed and does not fail the gate, because it would
 * have failed correct runs of a correct game - and the line between them is
 * what the player gets. A message in Chrome's log is Chrome's; a context that
 * has **suspended itself** is a game with no sound in it, whoever's fault that
 * is, and a suite that stayed green through it would be lying about the build.
 * It has not happened in thirty-six runs. If it ever does, that red is the most
 * valuable thing this project could learn about this question, because it is
 * the occurrence H35 could not attribute, caught in the act.
 *
 * **The fifth clause is on the same line and well inside it.** A clock that
 * never moved is a device that never played a sample, which is the same game
 * with no sound in it that a suspended context is, read from the one side a
 * `running` context does not cover. What it would take to red it falsely is a
 * machine whose audio thread was starved for *all* of a window of minutes,
 * where this machine - the worst on record - still feeds 57% of the longest
 * run it has. The override is the same shape as D73's: one `problems.push`.
 *
 * **And the sixth group is about the instrument rather than the hardware**,
 * which is why it is asserted without D73's argument: a stretch that ends past
 * the last mark, or a negative one, or a journal handed no marks at all across
 * a window of minutes, is a sampler that has stopped working - the one way this
 * number could quietly become a reading about nothing.
 *
 * An empty `errors` list is reported, not read as health: `error` on a context
 * is young enough that it may never fire here, and the absence of an event
 * nobody has seen fire is not evidence.
 *
 * Registered from tests/index.js late in the run, beside tests/performance.js:
 * the journal's value is the window it covers, and every check before this one
 * is window. Nothing here imports main.js (Section 3.1).
 */

/**
 * Below this much wall clock since the unlock, the ratio is printed as what it
 * is rather than as a reading. The unlock happens at `tests/audio.js`, two
 * thirds of the way up the registration order, so in a suite run this window
 * is minutes - but a subset that reaches this check without reaching that one
 * unlocks the device here, and a window of milliseconds is a reading about the
 * first buffer. A check should know the difference between a measurement and
 * the lack of one - and since H50 one verdict rests on that difference, so the
 * constant is load-bearing rather than cosmetic: under this window a clock that
 * has not moved is a clock that has not been asked, and nothing is said.
 */
const MIN_WINDOW_SECONDS = 30;

/**
 * Below this many marks there is no shape to read (H54). The journal is handed
 * one mark per frame and a frame in the AUTO suite comes from a check that
 * drove one, so a subset that reaches this check without reaching the frame
 * drivers has a handful - and the longest stretch across a handful of marks is
 * an artefact of how rarely anyone looked rather than a fact about the device.
 * Thirty is the warm-up count `tests/performance.js` discards, borrowed for the
 * same reason: it is the smallest number of frames this project is willing to
 * read anything off.
 */
const MIN_SHAPE_SAMPLES = 30;

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
const CONCENTRATED = 0.5;

/** Transitions printed before the list is summarised, against the 400-character cut on a detail line. */
const STATES_SHOWN = 6;

/** A state a context enters without being asked, and what it would mean. */
const UNASKED = {
  closed: 'the device context closed itself; every sound in the game is gone and nothing else in this suite would have said so',
  suspended: 'the device context suspended itself after the unlock resumed it, which is the device going away under a running page',
};

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
 * Above 1.0 is not an error and is not clamped: a device that lost a tenth of a
 * second in total and stood still for most of a frame is honestly one stretch,
 * and the number says how much more than the total that stretch was. It is the
 * clearest sign that `shape` alone is not a verdict - the pair is.
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
 * The clauses above, put to every reading on record and to the breaks they
 * exist to tell apart. `gained` and `wall` are seconds, `stopped` is what
 * `readDeviceClock()` must answer, and `why` is printed when it answers the
 * other way.
 *
 * The eleven healthy rows are H35's, H46's and H47's verifies, each a solo
 * suite run of one map (`PROGRESS.md`); `gained` is the recorded `fed` times
 * the recorded window, so the fourth decimal of the quotient is rounding and
 * nothing here reads it. They are the floor's evidence and the sign's at once:
 * every one must stay green, and **so must the halfway stop**, because the
 * total cannot tell it from a loaded machine. A job that writes a floor turns
 * that row red and has D74 to answer.
 *
 * A row that also carries `worstMs`, `samples` and `shape` is one of **the
 * stretch's own cases** (H54), and `readUnfedShape()` is asked about it as
 * well: the eleven recorded readings predate the journal keeping any shape and
 * so carry none, while the rows below them are the pairs D74 says a total
 * cannot separate, with the shape separating them. `whyShape` is printed when
 * the word comes out wrong.
 */
const CLOCK_CASES = [
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
    gained: 461.6, wall: 814.7, stopped: false, worstMs: 760, samples: 1200, shape: 'many-stretches',
    why: 'H35\'s plant run again, now with a shape on it', whyShape: 'the 353.1s of loss arriving one slow frame at a time: 0.76s of it in the worst stretch is a concentration of 0.002, which is this machine on an ordinary morning',
  },
  {
    gained: 461.6, wall: 814.7, stopped: false, worstMs: 353100, samples: 1200, shape: 'one-stretch',
    why: 'the same total from a device that died', whyShape: 'the same 353.1s lost in ONE stretch - concentration 1.00 against the row above it at 0.002, identical in `fed` and opposite here, which is the whole of what D74 said a total could not do',
  },
  {
    gained: 230.8, wall: 814.7, stopped: false, worstMs: 583900, samples: 1200, shape: 'one-stretch',
    why: 'the halfway stop, which stays green', whyShape: 'the halfway stop with its shape: 583.9s lost and all of it one stretch, said in a word where the ratio alone could only say 0.283',
  },
  {
    gained: 230.8, wall: 814.7, stopped: false, worstMs: 900, samples: 1200, shape: 'many-stretches',
    why: 'fed 0.283 from a loaded machine rather than a fault', whyShape: 'the third case, which D74 says the total cannot tell from the second AT ALL: the same 0.283 with 0.9s in the worst stretch is a machine twice as loaded as this one, and it lands with the first row rather than with the halfway stop',
  },
  {
    gained: 0.0027, wall: 814.7, stopped: false, worstMs: 814000, samples: 1200, shape: 'one-stretch',
    why: 'the one-buffer device, whose sign is green', whyShape: 'the device a sign cannot catch, caught here: 814.0s of 814.7s lost in one stretch is 0.999, and this row is why the pair is worth more than either half',
  },
  {
    gained: 0, wall: 814.7, stopped: true, worstMs: 814700, samples: 1200, shape: 'one-stretch',
    why: 'a dead device, red on the sign', whyShape: 'a device never fed at all, where the sign is already red and the shape agrees with it',
  },
  {
    gained: 814.6, wall: 814.7, stopped: false, worstMs: 700, samples: 1200, shape: 'one-stretch',
    why: 'a healthy device on a machine that is not this one', whyShape: 'a tenth of a second lost in total and most of a frame of it in one stretch, so the concentration is above 1 and the word is still right - a shape is a shape of whatever was lost, which is why no verdict rests on it alone',
  },
  {
    gained: 814.7, wall: 814.7, stopped: false, worstMs: 0, samples: 1200, shape: 'unmeasured',
    why: 'a device fed across every mark of a quarter-hour run', whyShape: 'nothing lost at all, so there is no loss for a shape to be the shape of',
  },
  {
    gained: 461.6, wall: 814.7, stopped: false, worstMs: 760, samples: MIN_SHAPE_SAMPLES - 1, shape: 'unmeasured',
    why: 'the plant run as a subset would have sampled it', whyShape: `${MIN_SHAPE_SAMPLES - 1} marks is under the ${MIN_SHAPE_SAMPLES} this takes: the longest stretch across a handful of marks is an artefact of how rarely anyone looked`,
  },
];

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-audio-device-keeps-its-clock-and-journals-the-states-it-enters',
    spec: 'Section 14 / Section 15 / H35 / H50 / H54',
    name: 'There is one realtime audio context, it is running, it is still the device the graph was built for, it entered no state nobody asked for, its clock has moved at all over a window of minutes, and how much of that window it was fed for - and the longest stretch it is known to have gone unfed across - is on the record without a floor',
    run: (h) => {
      const problems = [];
      const audio = h.audio;

      // The existing context, never a new one: a spare device context is the
      // condition H32 was under suspicion of and this check must not create
      // its own subject. `unlock()` returns `this.context` when one exists.
      const context = audio.unlock();
      if (!context) {
        return { pass: false, detail: 'no realtime audio context available in this browser, so the device could not be asked about itself' };
      }
      const report = audio.deviceReport();
      if (!report) {
        return { pass: false, detail: 'a device context exists and no journal was opened for it, so systems/audio.js built one somewhere other than unlock()' };
      }
      // The wall-clock end of the ratio, taken here rather than in the journal
      // so that the one clock reading sits in the same file as the clause it
      // feeds - which is what H41's census is for, and this entry is declared
      // there as `sign` since H50.
      const wallSeconds = (performance.now() - report.openedAtMs) / 1000;

      // 1. One device, counted from the live side. `audiocontext.js` holds the
      //    ban that makes this count complete - if only unlock() may name the
      //    constructor, then what unlock() has counted is every context the
      //    page has - and its own header says it cannot count them itself.
      if (report.opened !== 1) {
        problems.push(`${report.opened} realtime contexts have been opened on this page; one graph per page is the whole of Section 15's autoplay handling`);
      }

      // 2. The rate the device is running at, held against the rate it opened
      //    at. A device swapped under a live page moves it, and nothing else
      //    in this suite would notice.
      if (report.sampleRate !== report.sampleRateAtOpen) {
        problems.push(`the device opened at ${report.sampleRateAtOpen}Hz and now reports ${report.sampleRate}Hz, so the output device is not the one the graph was built for`);
      }
      if (!(report.sampleRate > 0)) problems.push(`the device reports a sample rate of ${report.sampleRate}`);

      // 3. Every state it entered, and whether the game asked for it. The
      //    first entry is the state at the unlock, so a transition is anything
      //    after it, and a repeat of `running` is the resume landing.
      if (report.state !== 'running') {
        problems.push(`the device context is "${report.state}", want "running"`);
      }
      for (const entry of report.transitions.slice(1)) {
        if (entry.state === 'running') continue;
        if (entry.state === 'closed' && report.closeRequested) continue;
        const why = UNASKED[entry.state] || `the device context entered "${entry.state}"`;
        problems.push(`${entry.atMs}ms after the unlock: ${why}`);
      }

      // 4. The clock: the sign asserted, the size reported (H50, D74). The
      //    clause is a function so that the table below can ask it about the
      //    eleven readings on record and about the breaks, which is the
      //    only way a check whose subject has never occurred can be known to
      //    answer - every other clause here is in the same position and has no
      //    such table (the standing warning: the absence of an event nobody
      //    has seen fire is not evidence).
      const { lost, fed, measured, stopped } = readDeviceClock(report.clockGained, wallSeconds);
      if (stopped) {
        problems.push(`the device's clock has not advanced at all in ${wallSeconds.toFixed(1)}s since the unlock, so the output device has played nothing; the context reads "${report.state}" and ${report.errors.length} error events, which is a game with no sound in it from the one side a running context does not cover`);
      }
      for (const probe of CLOCK_CASES) {
        const answer = readDeviceClock(probe.gained, probe.wall);
        if (answer.stopped !== probe.stopped) {
          problems.push(`readDeviceClock(${probe.gained}, ${probe.wall}) answered stopped=${answer.stopped}, want ${probe.stopped}: ${probe.why}`);
        }
        // The stretch's own rows, which are the ones carrying a shape (H54).
        if (probe.shape === undefined) continue;
        const shaped = readUnfedShape(answer.lost, probe.worstMs, probe.samples);
        if (shaped.shape !== probe.shape) {
          problems.push(`readUnfedShape(${answer.lost.toFixed(4)}, ${probe.worstMs}, ${probe.samples}) answered "${shaped.shape}", want "${probe.shape}": ${probe.whyShape}`);
        }
      }

      // 5. The stretch itself: reported, with its arithmetic asserted (H54).
      //    None of these can be moved by a starved device - they are the
      //    sampler working or not working - so none of them needs D73's
      //    argument. What they catch is the one failure that would be silent:
      //    a shape that has quietly become a reading about nothing.
      const stretch = report.unfedWorst;
      let shaped = readUnfedShape(lost, 0, 0);
      if (!stretch || typeof stretch.ms !== 'number' || typeof report.samples !== 'number') {
        problems.push('the journal reports no worst unfed stretch, so the one statistic that can tell a device that died from a machine that is busy is gone again (H54, D74)');
      } else {
        shaped = readUnfedShape(lost, stretch.ms, report.samples);
        if (!(stretch.ms >= 0) || !(stretch.atMs >= 0) || !(stretch.samples >= 0) || !(report.maxGapMs >= 0)) {
          problems.push(`the stretch reads ${stretch.ms}ms at ${stretch.atMs}ms over ${stretch.samples} marks with a widest gap of ${report.maxGapMs}ms, and not one of those can be negative`);
        }
        // The whole of the honesty: a stretch is bounded by the marks that
        // measured it, so it cannot end past the last one. One millisecond of
        // slack, because every stamp in the journal is rounded to it.
        if (stretch.atMs + stretch.ms > report.sampledToMs + 1) {
          problems.push(`the worst unfed stretch ends at ${stretch.atMs + stretch.ms}ms and the sampling only reached ${report.sampledToMs}ms, so the journal is charging the device time nobody looked at`);
        }
        if (stretch.ms > 0 && !(stretch.samples > 0)) {
          problems.push(`the worst unfed stretch is ${stretch.ms}ms long with no mark inside it, which is a gap between marks rather than a stretch the device is known to have gone unfed across`);
        }
        // Marks arrive at all. Guarded by the same window the sign is, because
        // a subset that reaches this check before the frame drivers honestly
        // has none - and over a window of minutes a journal with none is
        // AudioSystem.step() no longer sampling.
        if (measured && !(report.samples > 0)) {
          problems.push(`${wallSeconds.toFixed(1)}s since the unlock and the journal has been handed ${report.samples} marks, so AudioSystem.step() is not sampling and the shape is a reading about nothing`);
        }
      }

      const latency = report.baseLatency === null && report.outputLatency === null
        ? 'no latency offered'
        : `latency ${report.baseLatency === null ? '-' : report.baseLatency.toFixed(4)}/${report.outputLatency === null ? '-' : report.outputLatency.toFixed(4)}`;
      const shown = report.transitions.slice(0, STATES_SHOWN).map((t) => `${t.state}@${t.atMs}ms`).join(' -> ');
      const states = report.transitions.length > STATES_SHOWN
        ? `${shown} (+${report.transitions.length - STATES_SHOWN} more)`
        : shown;
      // Kept short on purpose: the whole account has to clear the 400-character
      // cut `scripts/suite.mjs` puts on a detail, and this clause is 108 of it.
      const worst = stretch
        ? `worst unfed ${shaped.worstSeconds.toFixed(3)}s at ${stretch.atMs}ms, ${stretch.samples} marks${stretch.open ? ', open' : ''}`
          + `, conc ${shaped.concentration === null ? 'n/a' : shaped.concentration.toFixed(4)} "${shaped.shape}"`
          + `; ${report.samples} marks to ${report.sampledToMs}ms, gap<=${report.maxGapMs}ms`
        : 'no stretch reported';
      const account = `${report.opened} device${report.opened === 1 ? '' : 's'} at ${report.sampleRate}Hz, ${latency}; ${states}`
        + `; unfed ${lost.toFixed(1)}s of ${wallSeconds.toFixed(1)}s, fed ${fed === null ? 'n/a' : fed.toFixed(4)}`
        + `${measured ? '' : `, window under ${MIN_WINDOW_SECONDS}s`}, no floor on it (D74)`
        + `; ${worst}`
        + `; the clock moved, asserted as a sign over ${CLOCK_CASES.length} cases`
        + `; ${report.errors.length} error events, a count and not health`;

      return {
        pass: problems.length === 0,
        detail: problems.length === 0 ? account : `${problems.join('; ')} [${account}]`,
      };
    },
  });
}
