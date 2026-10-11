/**
 * BLACKLINE - systems/audiodevice.js
 *
 * The one realtime audio context's account of its own health (H35), and the
 * shape of what it loses (H54).
 *
 * **Why a journal and not a check.** *"The AudioContext encountered an error
 * from the audio device or the WebAudio renderer."* has arrived at three of the
 * thirty-six suite runs on record. H32 closed the code side of it: one module
 * names the realtime constructor, one context exists per page, and the
 * seventeen `OfflineAudioContext`s a run builds have never rendered a wrong
 * sample - so the renderer is ruled out and what is left is the **device**.
 * The device is the one party to that error with nothing on the record. The
 * message arrives asynchronously from Chrome's audio service with no stack and
 * is attributed to the page URL; `scripts/suite.mjs` stamps it with the map,
 * the run and the seconds into it, which is as much as the Node end can know.
 * Nobody had ever asked the context whether it was still running when it
 * happened.
 *
 * So this is the page's half of that stamp, and it has to be a journal rather
 * than a check because the error is **intermittent and asynchronous**: a check
 * that asks "are you well?" at one moment answers about that moment, and every
 * occurrence on record arrived minutes into a run that was otherwise fine. A
 * record kept from the unlock answers about the whole page.
 *
 * **The device's clock is the reading worth keeping.** A realtime context's
 * `currentTime` is advanced by the thread that renders to the output device, so
 * it is the one number in this page that moves only while the device is being
 * fed, and a stall in it is **cumulative** - seconds lost are carried for ever
 * after, which is the property a record of an intermittent fault needs and a
 * sample does not have. A suspended context does not advance it either, which
 * is the same statement from the other side and is why the state transitions
 * are kept beside it.
 *
 * **A total has no shape, and the shape is the thing a floor would need**
 * (H54, D74). `clockGained` cannot tell *one* stall of 353s from a thousand
 * stalls adding to 353s, and the first of those is a device that died while the
 * second is this machine on an ordinary morning. So the journal also keeps the
 * **longest wall interval across which `currentTime` did not move**, the
 * millisecond it started at, and how many marks fell inside it. A device that
 * is gone has one such stretch running to the end of the run; a starved one has
 * many short ones however bad the total. `tests/audiodevice.js` reads the pair
 * and D74 is the page that asked for it.
 *
 * **The sampler is the caller's clock and not the journal's.** `sample()` is
 * called once a frame from `AudioSystem.step()`, which `main.js` already drives
 * on the wall delta, so this module still constructs nothing and starts
 * nothing: it takes a mark when it is handed one.
 *
 * **What a mark can and cannot prove, which decides the arithmetic.** Two
 * consecutive marks that read the same `currentTime` prove the clock did not
 * move between them: that interval is known unfed, and it is the only kind of
 * interval that is. A mark that reads a *larger* `currentTime` than the one
 * before proves only that the device was fed somewhere in the gap, and nothing
 * about where - so a stretch **closes at the last mark that still read the
 * stale value, never at the mark that saw it move**, and a stretch with no
 * unmoved mark inside it is a stretch of zero rather than the width of the gap.
 * That is what makes this honest under the sampling the suite actually
 * provides: the rAF loop drives no frames while the AUTO suite runs (F4), so
 * every mark comes from a check that drove one, and the marks arrive in bursts
 * with minutes of unwatched page between them. Charging one of those gaps to
 * the device because the clock had moved by the far end of it would invent the
 * exact statistic D74 is waiting for.
 *
 * Three numbers therefore go out beside the stretch, because without them it
 * cannot be read: `samples` is how many marks the journal was handed at all,
 * `sampledToMs` is how far into the page the last of them was, and `maxGapMs`
 * is the widest interval between two marks - the shape's blind spot, and the
 * one number that says how much of a run this instrument never looked at.
 * The resolution at the other end is the frame: inside a burst of frames
 * closer together than the device's 128-sample render quantum, two marks read
 * the same clock because nothing *could* have moved, so the smallest stretches
 * are an artefact of fast frames and `unfedWorst.samples` is what tells those
 * from a stall.
 *
 * This module therefore reports `clockGained` and the millisecond the journal
 * opened at, and **constructs no clock of its own**: the wall-clock half of the
 * ratio belongs to the reader, which is `tests/audiodevice.js`, so that H41's
 * census can see the one clock reading in the same file as the clause that
 * rests on it. What that ratio turned out to be on this machine is in that
 * file and in H35's `PROGRESS.md` entry, and it is not what anyone expected.
 * The stretch is the one number here measured against the wall, and it is
 * measured on the caller's frames.
 *
 * `error` on a context is young enough that it may never fire in the browser
 * this runs in. Listening for it costs nothing, and an empty list is
 * **reported** rather than read as meaning the device was well - the absence
 * of an event nobody has seen fire is not evidence (the standing warning in
 * `HANDOFF.md`, which has predicted its own violation once).
 *
 * Layering (Section 3.1): imports nothing. It is handed the context that
 * `systems/audio.js` built and names no constructor of its own, which is what
 * keeps `one-module-owns-the-audio-device-and-an-offline-render-gives-it-back`
 * green with this module in the page - an offline render opens no device and
 * neither does a journal of one. The whole argument lives here rather than
 * half here and half at the four lines in `audio.js` that call it.
 */

/**
 * Realtime contexts this page has opened a journal for, which is every one it
 * has: `AudioSystem.unlock()` is the only place in `src/` allowed to name the
 * constructor (`one-module-owns-the-audio-device-...` holds that), and it opens
 * a journal for each context it builds. Module-level on purpose - the count is
 * per **page**, so a second `AudioSystem` built over the top of the first is
 * exactly the thing it should still be counting. `audiocontext.js`'s header
 * says a check inside the browser cannot find this number out for itself; this
 * is how it can.
 */
let opened = 0;

/**
 * Start keeping the device's account. Called once, from the unlock that built
 * the context, with the context itself.
 *
 * @param {AudioContext} context the one realtime context this page has
 * @returns {{ sample: () => void, closing: () => void, report: () => object }}
 *   `sample()` is the one frame-driven mark, taken from `AudioSystem.step()`;
 *   `closing()` is how `dispose()` says a `closed` state was asked for rather
 *   than suffered; `report()` is the whole account, read by
 *   `tests/audiodevice.js` and by anyone looking at a run that errored
 */
export function openDeviceJournal(context) {
  opened++;
  // The one clock reading in this module, and it is a mark rather than a
  // measurement: every stamp below is an offset from it, and the reader takes
  // the other end itself.
  const openedAtMs = performance.now();
  const openedClock = context.currentTime;
  const sampleRateAtOpen = context.sampleRate;
  // The state at the unlock is the first entry, so a journal is never empty
  // and the first transition has something to be a transition from.
  const transitions = [{ state: context.state, atMs: 0 }];
  const errors = [];
  let closeRequested = false;

  // The shape of the loss (H54). `lastMoveAtMs` opens the first stretch at the
  // unlock so the account covers the same page `clockGained` does; `worst` is
  // the longest stretch that has closed, and the one still running is folded in
  // at `report()` so a device that died and stayed dead reports the stretch it
  // is in rather than nothing.
  let samples = 0;
  let sampledToMs = 0;
  let prevSampleAtMs = 0;
  let maxGapMs = 0;
  let lastClock = openedClock;
  let lastMoveAtMs = 0;
  let unmovedSamples = 0;
  let worst = { ms: 0, atMs: 0, samples: 0, open: false };

  const sinceMs = () => Math.round(performance.now() - openedAtMs);
  context.addEventListener('statechange', () => {
    transitions.push({ state: context.state, atMs: sinceMs() });
  });
  context.addEventListener('error', (event) => {
    errors.push({ type: (event && event.type) || 'error', atMs: sinceMs() });
  });

  return {
    sample() {
      const atMs = sinceMs();
      if (samples > 0 && atMs - prevSampleAtMs > maxGapMs) maxGapMs = atMs - prevSampleAtMs;
      samples++;
      if (context.currentTime > lastClock) {
        // The clock moved somewhere in the gap between the previous mark and
        // this one and nothing says where, so the stretch that just ended runs
        // to the **previous** mark. With no unmoved mark in it there is no
        // stretch to have: see the header.
        const ms = prevSampleAtMs - lastMoveAtMs;
        if (unmovedSamples > 0 && ms > worst.ms) {
          worst = { ms, atMs: lastMoveAtMs, samples: unmovedSamples, open: false };
        }
        lastClock = context.currentTime;
        lastMoveAtMs = atMs;
        unmovedSamples = 0;
      } else {
        unmovedSamples++;
      }
      prevSampleAtMs = atMs;
      sampledToMs = atMs;
    },
    closing() {
      closeRequested = true;
    },
    report() {
      // The stretch still open at the moment of reading, bounded by the last
      // mark and not by now - a check that runs for a minute without driving a
      // frame is time nobody looked at. With no unmoved mark inside it there is
      // nothing known, which is what a stretch of zero says.
      const openMs = unmovedSamples > 0 ? sampledToMs - lastMoveAtMs : 0;
      const unfedWorst = openMs > worst.ms
        ? { ms: openMs, atMs: lastMoveAtMs, samples: unmovedSamples, open: true }
        : { ...worst };
      return {
        opened,
        openedAtMs,
        // Seconds the device's own clock has gained since the unlock. Held
        // against the wall clock by the reader; alone it says only that the
        // device has been fed at all.
        clockGained: context.currentTime - openedClock,
        // How many frames handed this journal a mark, how far into the page the
        // last of them was, and the widest gap between two of them. All three
        // are needed to read `unfedWorst` honestly: the first two are its reach
        // and the third is what it could not see.
        samples,
        sampledToMs,
        maxGapMs,
        // The longest stretch the device is known to have gone unfed across, in
        // ms, the millisecond it started at, how many marks fell inside it, and
        // whether it was still running when this was read (H54).
        unfedWorst,
        sampleRateAtOpen,
        sampleRate: context.sampleRate,
        state: context.state,
        // Both are the device's own numbers, and both are absent on some
        // implementations; null says "not offered" rather than zero.
        baseLatency: typeof context.baseLatency === 'number' ? context.baseLatency : null,
        outputLatency: typeof context.outputLatency === 'number' ? context.outputLatency : null,
        transitions: transitions.slice(),
        errors: errors.slice(),
        closeRequested,
      };
    },
  };
}
