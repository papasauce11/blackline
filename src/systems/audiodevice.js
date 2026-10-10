/**
 * BLACKLINE - systems/audiodevice.js
 *
 * The one realtime audio context's account of its own health (H35).
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
 * This module therefore reports `clockGained` and the millisecond the journal
 * opened at, and takes **no clock of its own**: the wall-clock half of the
 * ratio belongs to the reader, which is `tests/audiodevice.js`, so that H41's
 * census can see the one clock reading in the same file as the clause that
 * rests on it. What that ratio turned out to be on this machine is in that
 * file and in H35's `PROGRESS.md` entry, and it is not what anyone expected.
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
 * half here and half at the three lines in `audio.js` that call it.
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
 * @returns {{ closing: () => void, report: () => object }}
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

  const sinceMs = () => Math.round(performance.now() - openedAtMs);
  context.addEventListener('statechange', () => {
    transitions.push({ state: context.state, atMs: sinceMs() });
  });
  context.addEventListener('error', (event) => {
    errors.push({ type: (event && event.type) || 'error', atMs: sinceMs() });
  });

  return {
    closing() {
      closeRequested = true;
    },
    report() {
      return {
        opened,
        openedAtMs,
        // Seconds the device's own clock has gained since the unlock. Held
        // against the wall clock by the reader; alone it says only that the
        // device has been fed at all.
        clockGained: context.currentTime - openedClock,
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
