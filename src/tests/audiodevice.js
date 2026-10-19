/**
 * BLACKLINE - tests/audiodevice.js
 *
 * AUTO suite (H35): the one audio device context, asked about itself.
 *
 * **What H35 was for.** *"The AudioContext encountered an error from the audio
 * device or the WebAudio renderer."* has appeared in three of the thirty-six
 * suite runs on record (H27 yard, H29 plant, H39 plant). H32 closed the
 * **code** side of it and H35 ruled out the warming hypothesis the record was
 * built on - an intermittent fault is not closed by an absence however long -
 * so what is left is the **device**, which H32 left reading 48000Hz and
 * otherwise unexamined. This check is the instrument for that answer rather
 * than the answer, and H35's `PROGRESS.md` entry is the rest of the history.
 *
 * **Why the device has to keep its own journal.** The error arrives
 * asynchronously from Chrome's audio service, with no stack, attributed to the
 * page URL, and every occurrence came minutes into a run that was otherwise
 * fine - so a question put at one moment answers about that moment.
 * `systems/audiodevice.js` therefore keeps a record from the unlock, and this
 * check reads it near the end of the run, where it covers the most ground.
 *
 * **And the reading is the finding.** The device's clock is advanced by the
 * thread that renders to the output device, so wall clock it has not gained
 * since the unlock is time the device was not being fed. On a full plant run
 * the clock gained **461.6s of 814.7s** - unrendered for **353.1s, 43% of the
 * page**, the context reading `running` the whole way and no error event at
 * all - where a 16.5s subset read 0.8s lost, so the loss accumulates with the
 * run rather than being a startup offset. This machine does not feed its audio
 * device while the suite rasterises on four pinned cores. H35's `PROGRESS.md`
 * entry argues it; `TRAPS.md` carries the sentence.
 *
 * **No floor rests on the ratio, and H50 measured before saying so** (D74).
 * Twenty-five full-run readings sit between `fed` 0.5225 and 0.7481, and the
 * arithmetic a floor would be argued from is real: a device stopped at a run's
 * halfway point reads 0.28-0.36, and 0.45 would separate that from every
 * reading taken. It is refused because **the ratio is a total and a total has
 * no shape** - 0.28 is a device that stopped once and stayed stopped, and 0.28
 * is also a *healthy* device on a machine twice as loaded, which the total
 * cannot tell apart at all. The spread on record is 32% wide with no cause
 * attributed, so 0.45 is 1.16x under the lowest healthy reading rather than a
 * margin, and a false red costs a whole run (the gate routes it to
 * `## BROKEN BASE`). D74 is the page and has every reading.
 *
 * **What a total does support is a sign, and that is asserted** (H50): over a
 * window of minutes the clock has advanced at all. A device never fed reads
 * exactly zero and goes red naming the window; one starved for 43% of the page
 * gains 461.6s and says nothing. `readDeviceClock()` is it, `CLOCK_CASES` puts
 * it to every recorded reading, to the halfway stop and to a dead device, and
 * **the halfway stop is asserted green** - which is where a job that wants a
 * floor meets D74, and where H66 met it.
 *
 * **H54 built the shape the total has none of, and `readUnfedShape()` is the
 * reader of it.** The journal keeps the longest wall interval across which
 * `currentTime` is **known** not to have moved, where it started and how many
 * marks fell inside it; the **concentration** - that stretch over everything
 * lost - is about 1.0 for a device that stopped once and stayed stopped and
 * three orders of magnitude under it for a machine losing the same seconds a
 * frame at a time. So the two cases D74 could not separate are separated, and
 * the third, a healthy device on a machine twice as loaded, lands with the
 * second rather than the first. It is **reported** and not asserted, for the
 * reason below and on D74's own page.
 *
 * **The honest limit, and H66 priced it in both directions.** The marks come
 * from `AudioSystem.step()`, which runs on frames, and **the rAF loop drives
 * no frames while the AUTO suite runs** (F4), so they arrive in bursts with
 * minutes of unwatched page between them. `readCoverage()` holds that blind
 * spot against the loss and it is worth **1.00 of the plant's loss and 1.16 of
 * the yard's**, so the concentration above is a concentration over the two
 * thirds of the page that had marks in it. **But the limit is one-sided**: a
 * stretch is bounded by two marks reading the same monotonic clock, so it is a
 * *proven* unfed span and a **lower bound** - a wider blind spot makes it
 * smaller, never larger, and a verdict on its size can be missed and never
 * invented, which is the opposite of D71's case. And a gap whose marks read
 * the same clock at both ends is charged to one stretch **in full**, so a
 * fault entirely inside the blind spot is still caught, bracketed by the marks
 * either side - `CLOCK_CASES`' H66 row is that, from one run's own numbers. So
 * coverage costs *where* a fault was and never *whether*: **H92** writes the
 * floor, on the stretch and not on the pair, and **H94** shrinks the gap.
 *
 * What is asserted is therefore five things about the device - there is exactly
 * one of it, it is still running, it is still the device the graph was built
 * for, it entered no state nobody asked for, and its clock has moved at all -
 * plus the **arithmetic** of the two numbers the shape is read through: a
 * stretch inside the window its own marks measured, never a millisecond nobody
 * looked at charged to the device, marks arriving at all over a window of
 * minutes, and (H66) a blind spot no wider than the span it is a gap in.
 * Nothing else in this suite holds any of them.
 *
 * **The first four can go red for an environmental reason and are asserted
 * anyway** - D73 is that line, and it is where D67 drew the other one about the
 * console message. A context that has **suspended itself** is a game with no
 * sound in it whoever's fault it is; a clock that never moved is the same game
 * read from the one side a `running` context does not cover, and what it would
 * take to red that falsely is a machine starved for *all* of a window of
 * minutes, where the worst run on record still feeds 52%. **The arithmetic
 * group is about the instrument rather than the hardware**, which is why it
 * needs none of D73's argument: a stretch that ends past the last mark, a
 * negative one, a journal handed no marks at all, or a gap wider than the
 * sampling it falls inside, is a sampler that has stopped working - the one way
 * these numbers could quietly become readings about nothing.
 *
 * An empty `errors` list is reported, not read as health: the absence of an
 * event nobody has seen fire is not evidence.
 *
 * Registered from tests/index.js **last** in the run, after
 * tests/performance.js since H65: every check before this one is window, and
 * this one drives no frames of its own so it costs the checks after it
 * nothing. The second check below holds that order. Nothing here imports
 * main.js (Section 3.1).
 */

import { MIN_WINDOW_SECONDS, readDeviceClock, readUnfedShape, readCoverage, readUnfedFloor, UNFED_FLOOR_SECONDS, CLOCK_CASES, COVERAGE_CASES } from './deviceclock.js';

/**
 * The second check's subject (H65): the three registrations the window above
 * is made of, in the order it needs them, and the registrar whose body that
 * order is read out of. Named rather than spelled into the clause, because a
 * problem has to say which call moved. `MIN_REGISTRATIONS` is the floor
 * `tests/registry.js` holds its own census to: an order read off a handful of
 * calls is an order read off nothing.
 */
const ORDER_SELF = 'the-device-journal-is-read-after-the-frames-that-feed-it';
const REGISTRAR = 'export function registerAutoTests';
const UNLOCKS_IT = 'registerAudio';
const FEEDS_IT = 'registerPerformance';
const READS_IT = 'registerAudioDevice';
const MIN_REGISTRATIONS = 50;

/** Transitions printed before the list is summarised, against the 400-character cut on a detail line. */
const STATES_SHOWN = 6;

/** A state a context enters without being asked, and what it would mean. */
const UNASKED = {
  closed: 'the device context closed itself; every sound in the game is gone and nothing else in this suite would have said so',
  suspended: 'the device context suspended itself after the unlock resumed it, which is the device going away under a running page',
};

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-audio-device-keeps-its-clock-and-journals-the-states-it-enters',
    spec: 'Section 14 / Section 15 / H35 / H50 / H54 / H66',
    name: 'There is one realtime audio context, it is running, it is still the device the graph was built for, it entered no state nobody asked for, its clock has moved at all over a window of minutes, and how much of that window it was fed for - the longest stretch it is known to have gone unfed across, and what the widest interval nobody watched is worth against it - is on the record without a floor',
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
        // H92: the floor answers every shaped row the way the row says.
        if (readUnfedFloor(probe.worstMs).over !== probe.over) {
          problems.push(`readUnfedFloor(${probe.worstMs}) answered over=${!probe.over}, want ${probe.over}: ${probe.why}`);
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
        // H92: one proven-unfed span over the floor is a device that went away.
        const floor = readUnfedFloor(stretch.ms);
        if (floor.over) {
          problems.push(`the device went unfed for one stretch of ${floor.seconds.toFixed(1)}s at ${stretch.atMs}ms, over the ${UNFED_FLOOR_SECONDS}s floor - a span two marks of one clock prove, so a lower bound (H92)`);
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

      // 6. The coverage, which is why the pair above still carries no floor
      //    (H66). Reported, like the shape it qualifies, with the one piece of
      //    arithmetic there is: the widest interval between two marks cannot
      //    be wider than the span those marks cover, both of its ends being
      //    marks. A gap that beat the span is a sampler whose two numbers are
      //    about two different windows.
      const covered = readCoverage(measured ? lost : 0, report.maxGapMs);
      if (report.maxGapMs > report.sampledToMs + 1) {
        problems.push(`the widest gap between two marks is ${report.maxGapMs}ms and the marks cover only ${report.sampledToMs}ms, so the journal's blind spot is wider than the window it sampled and the two cannot both be about this run`);
      }
      for (const probe of COVERAGE_CASES) {
        const answer = readCoverage(probe.lost, probe.maxGapMs);
        if (answer.resolves !== probe.resolves) {
          problems.push(`readCoverage(${probe.lost}, ${probe.maxGapMs}) answered resolves=${answer.resolves}, want ${probe.resolves}: ${probe.why}`);
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
          + `${covered.blind === null ? ', nothing lost for it to be blind to' : ` = ${covered.blind.toFixed(2)}x the loss`}`
          + `${covered.blind === null ? '' : `, ${covered.resolves ? 'which resolves it' : 'no floor on the pair either (H66)'}`}`
        : 'no stretch reported';
      const account = `${report.opened} device${report.opened === 1 ? '' : 's'} at ${report.sampleRate}Hz, ${latency}; ${states}`
        + `; unfed ${lost.toFixed(1)}s of ${wallSeconds.toFixed(1)}s, fed ${fed === null ? 'n/a' : fed.toFixed(4)}`
        + `${measured ? '' : `, window under ${MIN_WINDOW_SECONDS}s`}, no floor on fed (D74), ${UNFED_FLOOR_SECONDS}s on one stretch (H92)`
        + `; ${worst}`
        + `; the clock moved, asserted as a sign over ${CLOCK_CASES.length} cases`
        + `; ${report.errors.length} error events, a count and not health`;

      return {
        pass: problems.length === 0,
        detail: problems.length === 0 ? account : `${problems.join('; ')} [${account}]`,
      };
    },
  });

  // ------------------------------------------------------------------
  // The registration order the window above rests on (H65). The window covers
  // exactly the checks registered before the one that reads it, and
  // `tests/performance.js`'s **210** frames - the densest block of marks in
  // the suite and the only one dense enough to resolve a stretch to the frame
  // - were registered **after** the read until H65. **The import order says
  // the opposite and is not the registration order**, which is the half-hour
  // H54's measurement paid for. Three clauses, the last being the second half
  // a check that reads a file it chose owes the suite (HANDOFF.md): the two
  // calls in the order the window needs, the unlock still before both, and a
  // parse required to have seen a registration order at all - or "A before B"
  // is two absences agreeing.
  // ------------------------------------------------------------------
  debugTools.registerAutoTest({
    id: ORDER_SELF,
    spec: 'Section 14 / H54 / H65',
    name: 'The device journal is read after every registration that drives frames into it, so the suite\'s densest block of marks is inside the window rather than after it',
    run: async () => {
      const problems = [];
      const index = await (await fetch(`${location.origin}/src/tests/index.js`)).text();
      // The calls and never the imports: the two disagree here by design,
      // which is the whole subject. Line-anchored, so a commented-out call is
      // not a call - the same read `tests/registry.js` makes of the same file,
      // and sliced from the registrar's body so an import cannot match.
      const body = index.slice(index.indexOf(REGISTRAR));
      const called = [...body.matchAll(/^\s*(\w+)\(debugTools\);/gm)].map((match) => match[1]);
      if (called.length < MIN_REGISTRATIONS) {
        return { pass: false, detail: `the registrar's body reads ${called.length} calls and the suite registers ${MIN_REGISTRATIONS}+, so this order was not read off the tree` };
      }
      const at = (name) => called.indexOf(name);
      for (const name of [UNLOCKS_IT, FEEDS_IT, READS_IT]) {
        if (at(name) === -1) problems.push(`${name} is called nowhere in the registrar, so the order this journal's window rests on cannot be read`);
      }
      if (problems.length === 0) {
        if (!(at(FEEDS_IT) < at(READS_IT))) {
          problems.push(`${FEEDS_IT} is called at ${at(FEEDS_IT) + 1} of ${called.length} and ${READS_IT} at ${at(READS_IT) + 1}, so the 210 frames of the heaviest check land after the journal is read and the densest block of marks in the suite is outside the window (H65)`);
        }
        if (!(at(UNLOCKS_IT) < at(FEEDS_IT))) {
          problems.push(`${UNLOCKS_IT} is called at ${at(UNLOCKS_IT) + 1} and ${FEEDS_IT} at ${at(FEEDS_IT) + 1}; the journal opens at the unlock, so frames driven before it are frames no journal ever saw`);
        }
      }
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${called.length} registrations, read off the calls and not the imports (which disagree by design): ${UNLOCKS_IT} at ${at(UNLOCKS_IT) + 1} opens the journal, `
            + `${FEEDS_IT} at ${at(FEEDS_IT) + 1} drives the densest block of marks into it, ${READS_IT} at ${at(READS_IT) + 1} reads it`
          : problems.join('; '),
      };
    },
  });
}
