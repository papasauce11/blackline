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
 * **So no verdict here rests on the number**, and this is H41's lesson in a
 * second place: a wall clock on this machine cannot price a draw (D71), and it
 * cannot price the audio device either. A floor on the ratio would be a floor
 * on how busy the machine was, red on a loaded morning and green on a quiet
 * one, which is the kind of check that teaches a session to ignore it. The
 * number is printed - every run from now on puts the device's own account on
 * the record beside the Node-side stamp - and **H50** sets a measured floor
 * once a verify has the ratio for both maps and both runs of each.
 *
 * What is asserted is the four things about the device that are true whether or
 * not it is being starved: there is exactly one of it, it is still running, it
 * is still the device the graph was built for, and it entered no state nobody
 * asked for. Nothing else in this suite holds any of them.
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
 * the lack of one, even where it puts no verdict on either.
 */
const MIN_WINDOW_SECONDS = 30;

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
    spec: 'Section 14 / Section 15 / H35',
    name: 'There is one realtime audio context, it is running, it is still the device the graph was built for, it entered no state nobody asked for, and its clock against the wall clock is on the record',
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
      // there as `reported`.
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

      // 4. The clock, reported and not judged - see the header, and H50.
      const lost = wallSeconds - report.clockGained;
      const fed = wallSeconds > 0 ? report.clockGained / wallSeconds : null;
      const measured = wallSeconds >= MIN_WINDOW_SECONDS;

      const latency = report.baseLatency === null && report.outputLatency === null
        ? 'no latency offered'
        : `latency ${report.baseLatency === null ? '-' : report.baseLatency.toFixed(4)}/${report.outputLatency === null ? '-' : report.outputLatency.toFixed(4)}`;
      const shown = report.transitions.slice(0, STATES_SHOWN).map((t) => `${t.state}@${t.atMs}ms`).join(' -> ');
      const states = report.transitions.length > STATES_SHOWN
        ? `${shown} (+${report.transitions.length - STATES_SHOWN} more)`
        : shown;
      const account = `${report.opened} device${report.opened === 1 ? '' : 's'} at ${report.sampleRate}Hz, ${latency}; ${states}`
        + `; unfed ${lost.toFixed(1)}s of ${wallSeconds.toFixed(1)}s, fed ${fed === null ? 'n/a' : fed.toFixed(4)}`
        + `${measured ? '' : `, window under ${MIN_WINDOW_SECONDS}s`}, no verdict on it (H50)`
        + `; ${report.errors.length} error events, a count and not health`;

      return {
        pass: problems.length === 0,
        detail: problems.length === 0 ? account : `${problems.join('; ')} [${account}]`,
      };
    },
  });
}
