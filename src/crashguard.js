/**
 * BLACKLINE - crashguard.js
 *
 * The crash guard (H14). Before it, a throw inside a frame left the canvas
 * frozen on the last picture with nothing on screen - the rAF callback died,
 * the loop scheduled itself again, and the same throw went to the console
 * sixty times a second where a friend never looks. Now a throw from a frame,
 * one that reaches the window, or a promise nobody caught all land here: the
 * loop is stopped, the match is paused where it was, and the menu's crash page
 * says what broke, with the seed and *Copy report* (H12) on it.
 *
 * **Three routes in, one record.** `FrameLoop.run` catches a frame's throw
 * and hands it to `caught(error, 'frame')`; `install()` listens for the
 * window's `error` and `unhandledrejection` the same way `index.html` does
 * for the boot, and sets `window.__blCrashGuarded` so that page's
 * "failed to start" panel stands aside once there is a game to stop. Every
 * crash is counted and the first few kept, and the report carries them.
 *
 * Logged with `console.warn`, not `console.error`: a frame's throw is caught
 * here and would otherwise never reach the console at all, and a warning
 * keeps the stack in devtools without turning the suite's console-error count
 * into a count of the crash guard's own checks.
 *
 * Layering (Section 3.1): imports nothing. What stopping the game means is
 * the root's, handed in as `halt` and `resume`.
 */

/** How many crashes a report names; every one is counted. */
const KEPT = 5;

/** A browser's own noise, which is not a crash (index.html skips it too). */
const NOT_A_CRASH = /^ResizeObserver loop/;

/** One crash, as the panel and the report say it. */
function describe(error) {
  if (error instanceof Error) {
    const at = (error.stack || '').split('\n').find((line) => /^\s+at /.test(line));
    return { message: `${error.name}: ${error.message}`, at: at ? at.trim() : '' };
  }
  return { message: String(error), at: '' };
}

/**
 * @param {object} root
 * @param {() => number} root.seed the seed the match was opened with
 * @param {(crash: object) => void} root.halt stop the loop, pause, show the page
 * @param {() => void} root.resume what *Try to continue* does
 */
export function createCrashGuard({ seed, halt, resume }) {
  const kept = [];
  let count = 0;
  let shown = null;

  const guard = {
    /** How many crashes this page has seen. */
    get count() { return count; },

    /** The crash that halted the game, until *Try to continue*: what the page shows. */
    get current() { return shown; },

    /**
     * A throw or a rejection, from anywhere. Counted every time; the game is
     * halted once - a second throw while the page is already up is a line in
     * the report, not a second halt.
     *
     * @param {*} error
     * @param {'frame'|'window'|'promise'} where
     */
    caught(error, where) {
      const said = describe(error);
      if (NOT_A_CRASH.test(said.message)) return;
      count++;
      const crash = { ...said, where, seed: seed(), n: count };
      if (kept.length < KEPT) kept.push(crash);
      console.warn(`[CRASH] ${where}: ${said.message}`, error);
      if (shown) return;
      shown = crash;
      halt(crash);
    },

    /** *Try to continue*: the match runs again, and the next throw halts again. */
    resume() {
      shown = null;
      resume();
    },

    /** The report's lines (H12): every crash counted, the first few named. */
    lines() {
      return kept.map((c) => `#${c.n} ${c.where}: ${c.message}${c.at ? ` ${c.at}` : ''}`);
    },

    /** Listen at the window, after the boot: before it, `index.html`'s panel is the one. */
    install(target = window) {
      target.addEventListener('error', (event) => guard.caught(event.error || event.message, 'window'));
      target.addEventListener('unhandledrejection', (event) => guard.caught(event.reason, 'promise'));
      target.__blCrashGuarded = true;
    },
  };
  return guard;
}
