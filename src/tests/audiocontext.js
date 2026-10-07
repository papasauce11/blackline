/**
 * BLACKLINE - tests/audiocontext.js
 *
 * AUTO suite (H32): there is exactly one audio *device* context in this page,
 * only one module is allowed to name its constructor, and an offline render
 * gives the live one back.
 *
 * **Why this exists.** Two of the last five verifies carried one console error
 * apiece: *"The AudioContext encountered an error from the audio device or the
 * WebAudio renderer."* H27 argued it was environmental, H28 called it closed
 * after a single clean verify, and H29 brought it back - so the queue asked
 * H32 to stop writing it off and instead define the test, and named one cheap
 * code-side hypothesis: **can the audio graph be built more than once per
 * page?** A second device context where Chrome has no audio device is exactly
 * that message.
 *
 * **The answer is no, and this check is what keeps it no.** `AudioSystem.unlock()`
 * returns `this.context` when one exists and is the only place in the game that
 * reaches for the realtime constructor, and `audio-graph-is-one-master-three-buses`
 * has been asserting the idempotence of *that one call* since Section 14's
 * check was written. What nothing asserted is the two ways the singularity can
 * be lost without that clause noticing:
 *
 *   1. **A second module** reaching for the constructor on its own. A new
 *      system wanting a sound of its own would do it in one line, and
 *      `unlock()`'s guard cannot see it. So the constructor is a **ban with one
 *      named owner**, on F13's model and H30's: the default is that no module
 *      may name it, `OWNER` is the single allowance, and the check is red both
 *      on a new namer **and** if the owner ever stops being one, because an
 *      allowance for something that has moved is an allowance the next line
 *      inherits without arguing.
 *   2. **An offline render not giving the live context back.** `renderOffline`
 *      swaps the whole graph onto a throwaway `OfflineAudioContext` and
 *      restores it in a `finally` - by design, so that what is measured is what
 *      plays rather than a re-implementation of it. If that restore were ever
 *      broken the live graph would be left pointing at a context that has
 *      finished rendering, **every sound in the game would stop, and no check
 *      would say so**: the sixteen sound checks all read the offline samples,
 *      which would still be perfect. So identity across a render is asserted
 *      here.
 *
 * **What this check does not and cannot do.** It does not count the realtime
 * contexts the page has ever built - nothing in a browser exposes that - and it
 * deliberately does not construct one to find out. A spare device context is
 * the very condition under suspicion, so building one to measure the building
 * of one would be the instrument creating its own subject. The ban plus the
 * idempotence clause next door is the honest reach of a test from inside the
 * page; the rest is H35, which is a cold run and not a check.
 *
 * The other half of that error message - *"or the WebAudio renderer"* - is
 * reported rather than asserted: a run builds **seventeen** offline contexts
 * (sixteen sounds in `tests/soak.js` and the scuff in `tests/scuff.js`), every
 * one of which has rendered correct samples in every run on record, which is
 * what rules the renderer out and leaves the device.
 *
 * Registered from tests/index.js beside the other census checks: it reads
 * source text and draws no frame. Nothing here imports main.js (Section 3.1).
 */

/**
 * The one module that may name the realtime constructor, and why. Read back
 * into the detail line rather than written twice.
 */
const OWNER = {
  path: 'src/systems/audio.js',
  why: 'AudioSystem.unlock() builds the one graph, guarded on this.context, and dispose() closes it',
};

/**
 * The identifiers a device context is reached through. **Built from pieces on
 * purpose**, so that this file's own code does not contain the contiguous name
 * and the census does not flag itself - H30's check caught itself exactly this
 * way, by spelling its own subject out as a literal, and `donedef.js` solves it
 * the same way.
 *
 * `\b` before the name is what keeps `OfflineAudioContext` out of this: the
 * character before its `A` is a word character, so it cannot match. That is the
 * distinction the whole check rests on - an offline context renders into a
 * buffer and never opens the device.
 */
const DEVICE = new RegExp(`\\b(?:${'Audio'}${'Context'}|${'webkitAudio'}${'Context'})\\b`);
/** The offline constructor, counted and reported rather than banned. */
const OFFLINE = new RegExp(`\\b${'OfflineAudio'}${'Context'}\\b`);

/**
 * The pattern's own instrument check, because **this census answers "none" both
 * when it is working and when it is broken.** F8's model: prove it can see the
 * thing before trusting it to report the thing's absence. Each string is built
 * the same way its subject is, for the same reason.
 */
const MUST_MATCH = `const Ctor = typeof ${'Audio'}${'Context'} !== 'undefined'`;
const MUST_NOT_MATCH = `typeof ${'OfflineAudio'}${'Context'} !== 'undefined'`;

/**
 * The suite is this many modules under `src/` or the Resource Timing list is
 * not the suite. `pixelfloors.js` uses the same floor for the same reason: an
 * empty or filtered list would otherwise read as a clean sweep of nothing.
 */
const MIN_MODULES = 60;

/**
 * Code, with comments and string literals taken out, decided line-locally and
 * never by parsing - `donedef.js`'s rule, because the thing being looked for
 * appears in prose and in error strings all over this suite (*"no ... available
 * in this browser"*) and none of those is a construction.
 */
function codeOnly(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('//')) return '';
  return line
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
    .replace(/\/\/.*$/, '');
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'one-module-owns-the-audio-device-and-an-offline-render-gives-it-back',
    spec: 'Section 14 / Section 15 / H32',
    name: 'Only src/systems/audio.js names the realtime audio constructor, that owner still names it, and rendering a sound offline leaves the live context the same object',
    run: async (h) => {
      const problems = [];
      const audio = h.audio;

      // ------------------------------------------------------------------
      // 1. The ban, with one named owner. The modules that actually ran,
      //    from the Resource Timing list, exactly as F13's bans read them -
      //    never a guess at the import graph.
      // ------------------------------------------------------------------
      const origin = location.origin;
      const modules = new Set();
      for (const entry of performance.getEntriesByType('resource')) {
        const url = entry.name.split('?')[0];
        if (!url.startsWith(origin) || !url.endsWith('.js') || url.indexOf('/src/') === -1) continue;
        modules.add(url.slice(url.indexOf('/src/') + 1));
      }
      if (modules.size < MIN_MODULES) {
        return { pass: false, detail: `Resource Timing lists ${modules.size} modules under src/; the suite is ${MIN_MODULES}+` };
      }

      if (!DEVICE.test(MUST_MATCH)) problems.push('the device-constructor pattern no longer matches the line it is built to match - the census below reads zero whether it works or not');
      if (DEVICE.test(MUST_NOT_MATCH)) problems.push('the device-constructor pattern matches the offline constructor, so the two are no longer being told apart');

      const namers = [];
      let offlineNamers = 0;
      for (const path of [...modules].sort()) {
        const text = await (await fetch(`${origin}/${path}`)).text();
        let device = 0;
        let offline = false;
        for (const line of text.split(/\r?\n/)) {
          const code = codeOnly(line);
          if (!code) continue;
          if (DEVICE.test(code)) device++;
          if (OFFLINE.test(code)) offline = true;
        }
        if (device) namers.push({ path, lines: device });
        if (offline) offlineNamers++;
      }

      const owner = namers.find((n) => n.path === OWNER.path);
      if (!owner) {
        problems.push(`${OWNER.path} no longer names the realtime constructor at all - the allowance is stale, and the thing it allowed has moved somewhere this check is about to call a new offender`);
      }
      for (const namer of namers) {
        if (namer.path === OWNER.path) continue;
        problems.push(`${namer.path} names the realtime audio constructor on ${namer.lines} line(s); only ${OWNER.path} may (${OWNER.why})`);
      }

      // ------------------------------------------------------------------
      // 2. The live context survives an offline render, by identity.
      // ------------------------------------------------------------------
      const context = audio.unlock();
      if (!context) {
        problems.push('no realtime audio context available in this browser, so the identity half of this check could not run');
      } else {
        // Idempotence, which `audio-graph-is-one-master-three-buses` also
        // asserts: kept here because this check is the one that says why it
        // matters, and a clause this cheap should not depend on the order two
        // modules happen to be registered in.
        if (audio.unlock() !== context) problems.push('a second unlock built a second device context');

        const buffer = await audio.renderOffline('plantBeep', 0.3);
        if (!buffer) problems.push('rendering a sound offline produced nothing, so the restore could not be read');
        if (audio.context !== context) {
          problems.push('an offline render did not give the live context back - every sound in the game is now going to a context that has finished rendering, and the sound checks would not notice because they read the offline samples');
        }
        if (audio.master && audio.master.context !== context) {
          problems.push('the master gain belongs to a different context than the live one after an offline render');
        }
        if (context.state === 'closed') problems.push('the live device context is closed');
      }

      const state = context ? `${context.state}, ${context.sampleRate}Hz` : 'none';
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${modules.size} modules under src/ scanned, ${namers.length} names the device constructor and it is ${OWNER.path}`
            + ` (${owner ? owner.lines : 0} lines); ${offlineNamers} modules name the offline one, which opens no device`
            + `; the live context is ${state} and is the same object after rendering a sound offline`
          : problems.join('; '),
      };
    },
  });
}
