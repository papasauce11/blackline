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
 * **And since H51 it holds where the Section 14 recipes live**, which is the
 * same question as the ban one step over: this check already decides which
 * module may do what with the audio graph, and the recipes came out of
 * `systems/audio.js` into `systems/audiosounds.js` to get that file off 589 of
 * 600 before a job was forced to do it mid-verify. A split nothing asserts is
 * a split the next edit undoes without noticing - the table is 145 lines and
 * reads perfectly well pasted back - so the clause is: every recipe the live
 * system answers to is declared in `audiosounds.js`, none is declared in
 * `audio.js`, and `audio.js` imports the table rather than keeping a copy.
 * **It is written against the live enumeration** (`audio._builders`, which is
 * what `tests/audio.js` plays every row of) rather than against a list here,
 * so a seventeenth sound is in this clause the day it is written.
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
 * Where the Section 14 recipes live since H51, and where they may not (the
 * owner above). `RECIPE` is how a recipe is spelled in either file: a method
 * shorthand at the table's own indent, which is the one form all sixteen are
 * written in. Built per name from the live enumeration rather than listed.
 */
const RECIPES = { path: 'src/systems/audiosounds.js', exports: 'SOUND_BUILDERS' };
const RECIPE = (name) => new RegExp(`^  ${name}\\(`, 'm');

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
    spec: 'Section 14 / Section 15 / H32 / H51',
    name: 'Only src/systems/audio.js names the realtime audio constructor, that owner still names it, every Section 14 recipe is declared in systems/audiosounds.js and none in the owner, and rendering a sound offline leaves the live context the same object',
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
      // 2. Where the Section 14 recipes live (H51). The names come from the
      //    live system, so this clause covers a sound written tomorrow; the
      //    two files come off the origin the way the ban above reads modules.
      //    Both halves are asserted, because a split has two ways to come
      //    undone: the table moves back, or a copy is left behind.
      // ------------------------------------------------------------------
      const recipeNames = Object.keys(audio._builders);
      if (recipeNames.length < 1) {
        problems.push('the live audio system answers to no recipe at all, so there is nothing to say about where they live');
      }
      const [ownerText, recipeText] = await Promise.all(
        [OWNER.path, RECIPES.path].map((path) => fetch(`${origin}/${path}`).then((r) => (r.ok ? r.text() : null))),
      );
      if (recipeText === null) {
        problems.push(`${RECIPES.path} is not served; H51 moved the Section 14 table there to get ${OWNER.path} off 589 of 600`);
      } else if (ownerText === null) {
        problems.push(`${OWNER.path} is not served, and it is this check's named owner`);
      } else {
        // The instrument first, on F8's model and the pattern clause above:
        // this clause answers "none misplaced" both when it works and when
        // the spelling it looks for has gone, so it proves it can see a
        // recipe where one is before trusting it about where one is not.
        const first = recipeNames[0];
        if (first && !RECIPE(first).test(recipeText)) {
          problems.push(`the recipe pattern cannot find "${first}" in ${RECIPES.path}, where the live system says it is - the two clauses below read zero whether they work or not`);
        }
        const missing = recipeNames.filter((name) => !RECIPE(name).test(recipeText));
        const strays = recipeNames.filter((name) => RECIPE(name).test(ownerText));
        if (missing.length) {
          problems.push(`${missing.length} recipe(s) the live system answers to are not declared in ${RECIPES.path}: ${missing.join(', ')}`);
        }
        if (strays.length) {
          problems.push(`${strays.length} recipe(s) are declared in ${OWNER.path}: ${strays.join(', ')}; H51 moved the Section 14 table out of it and that file has 150 lines of headroom, not 11`);
        }
        // The seam itself, and spelled loosely on purpose: what matters is
        // that the owner reaches the table through an import rather than
        // keeping a copy, not which of the three import forms it uses.
        if (!/^import .*from '\.\/audiosounds\.js';$/m.test(ownerText)) {
          problems.push(`${OWNER.path} imports nothing from ./audiosounds.js, so either the table is reached some other way or there are two of it`);
        }
        if (!new RegExp(`^export const ${RECIPES.exports} = \\{$`, 'm').test(recipeText)) {
          problems.push(`${RECIPES.path} does not export ${RECIPES.exports} as the table, which is the name ${OWNER.path} and tests/audio.js both read it through`);
        }
      }

      // ------------------------------------------------------------------
      // 3. The live context survives an offline render, by identity.
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
            + `; all ${recipeNames.length} Section 14 recipes are declared in ${RECIPES.path} and none in the owner (H51)`
            + `; the live context is ${state} and is the same object after rendering a sound offline`
          : problems.join('; '),
      };
    },
  });
}
