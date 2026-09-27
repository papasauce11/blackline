/**
 * BLACKLINE — bootscreen.js
 *
 * What a player sees before the game exists (H4): the loading screen while the
 * map bakes, and the two plain messages for a browser that cannot run this at
 * all.
 *
 * The panels themselves are in `index.html`, visible from the first paint,
 * because everything here arrives over the network and a loading screen that
 * loads is not one. This module only writes into them.
 *
 * **There is no WebGL2 probe here.** Whether this browser can draw the game is
 * `createRenderer()` in `view.js` returning null, which is the question that
 * matters and costs nothing to ask; a separate probe either clobbered the real
 * canvas's context attributes or cost 16 seconds headless for a second
 * SwiftShader device. This module owns what the player is *told*, not what is
 * true. `boot.js` hands the refusal up and `main.js` shows it.
 *
 * Every function takes what it inspects as an argument, defaulted — which is
 * what lets a check drive the touch message with a stubbed `matchMedia` instead
 * of having to be run on a phone.
 *
 * Layering (Section 3.1): imports nothing. The composition root calls it.
 */

/**
 * The two messages, as data, so the check that reads the panel compares
 * against the same strings the panel was written from rather than a copy of
 * them that can drift.
 *
 * `fatal` decides what the panel does, not how it looks: WebGL2 is missing and
 * there is no game to show, so that one has no way out. Touch is a warning —
 * the game runs, it just cannot be played without a keyboard — so that one has
 * a button and boots behind it. Josh may disagree about the wording; it is
 * provisional (D53) and changing it changes no rule.
 */
export const NOTICES = {
  webgl2: {
    fatal: true,
    title: 'WebGL2 required',
    body: 'Blackline draws with WebGL2, and this browser does not offer it. '
      + 'Chrome, Edge, Firefox or Safari 15+ on a desktop will run it. '
      + 'If you are on one of those, hardware acceleration may be switched off.',
  },
  touch: {
    fatal: false,
    title: 'Keyboard and mouse',
    body: 'Blackline is played with a keyboard and a mouse, and this looks like '
      + 'a touch device. There are no touch controls. It will run, but you will '
      + 'not be able to move, look or plant.',
  },
};

const el = (id) => (typeof document === 'undefined' ? null : document.getElementById(id));

/**
 * A device with a coarse pointer and no hover is a phone or a tablet: there is
 * no keyboard to drive this with. Both halves are asked because a laptop with
 * a touchscreen answers yes to the first and yes to hover as well, and that
 * machine plays the game perfectly.
 *
 * @param {(query: string) => {matches: boolean}} [query] `window.matchMedia` by default
 * @returns {boolean}
 */
export function isTouchOnly(query) {
  const ask = query || (typeof window !== 'undefined' && window.matchMedia
    ? (q) => window.matchMedia(q)
    : null);
  if (!ask) return false;
  try {
    return !!ask('(pointer: coarse)').matches && !ask('(hover: hover)').matches;
  } catch {
    return false;
  }
}

/**
 * What the composition root asks before it builds anything, and what it records
 * in `debugState.bootGate` — so a check can see that the real boot consulted
 * this rather than only that the function works.
 *
 * `webgl2` is not here: it is not knowable without trying, and trying is
 * `createRenderer()` inside the boot. This is only what can be read off the
 * device.
 *
 * @param {object} [options]
 * @param {(query: string) => {matches: boolean}} [options.query] passed to `isTouchOnly`
 * @returns {{touchOnly: boolean}}
 */
export function bootGate({ query } = {}) {
  return { touchOnly: isTouchOnly(query) };
}

/**
 * The loading screen's one line. Called between bake slices (H4): the label is
 * what has just finished, so the player reads progress rather than a spinner.
 *
 * @param {string} label
 * @param {number} [done] slices finished
 * @param {number} [of] slices in total
 */
export function bootStage(label, done, of) {
  const line = el('bl-boot-stage');
  if (!line) return;
  line.textContent = done && of ? `${label} · ${done} of ${of}` : String(label);
}

/** Take the loading screen down. The game is up behind it. */
export function bootDone() {
  const panel = el('bl-boot');
  if (panel) panel.hidden = true;
}

/**
 * Show one of `NOTICES`. A fatal one has no way out; a warning gets its button,
 * which hides the panel and leaves the game running behind it.
 *
 * @param {'webgl2'|'touch'} kind
 * @returns {HTMLElement|null} the panel, for a check to read
 */
export function showNotice(kind) {
  const notice = NOTICES[kind];
  const panel = el('bl-notice');
  if (!notice || !panel) return null;
  el('bl-notice-title').textContent = notice.title;
  el('bl-notice-body').textContent = notice.body;
  const ok = el('bl-notice-ok');
  ok.hidden = notice.fatal;
  ok.onclick = notice.fatal ? null : () => hideNotice();
  // A fatal notice covers the loading screen rather than sitting behind it:
  // nothing more is coming, so "starting" would be a lie.
  if (notice.fatal) bootDone();
  panel.hidden = false;
  panel.dataset.kind = kind;
  return panel;
}

/** Take the notice down. */
export function hideNotice() {
  const panel = el('bl-notice');
  if (panel) {
    panel.hidden = true;
    delete panel.dataset.kind;
  }
}

/**
 * Hand the browser a turn, so the loading screen it has been told to draw
 * actually gets drawn.
 *
 * A `MessageChannel` message and not a timer, because Section 9 and 15 ban
 * `setTimeout` outright and F13's `no-source-file-calls-math-random-or-sets-a-timer`
 * holds the ban: adding a second `setTimeout` to `src/` turns the gate red. And
 * not `requestAnimationFrame`, which never fires in a hidden document — the
 * Browser pane is one, and a boot that waited for a frame there would never
 * finish. A posted message is a real task boundary that always arrives.
 *
 * @returns {Promise<void>}
 */
export function yieldToPaint() {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(0);
  });
}
