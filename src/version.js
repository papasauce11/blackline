/**
 * BLACKLINE — version.js
 *
 * Which build this is (H3). A friend reports a bug; this is how Josh knows
 * which commit they were playing.
 *
 * `scripts/version.mjs` writes `version.json` beside `index.html` from git,
 * and only ever from a clean tree, so the file always names a real commit of
 * the branch GitHub Pages is deploying (H2 is a branch deploy — there is no
 * workflow, the commit carries the stamp). This module fetches it once and
 * hands the main menu's footer a line; H12's bug report reads the same object.
 *
 * **Whether this is a build or a dev page is the host's answer, not the
 * file's.** A `channel` field baked in at stamp time would be whatever the
 * last person to stamp happened to have, and would say `build` on a local
 * server serving the same bytes. The host cannot be wrong: served from
 * localhost you are looking at a working copy, served from anywhere else you
 * are looking at the deploy.
 *
 * Layering (Section 3.1): imports nothing. `panels.js` starts the load and
 * passes the label down, so `ui/` keeps its one import.
 */

/** Where the stamp is, relative to this module rather than to the document. */
const VERSION_URL = new URL('../version.json', import.meta.url);

/**
 * The live stamp. Empty until `loadVersion()` resolves; mutated in place so a
 * holder of this object (H12) never has a stale copy.
 */
export const VERSION = {
  commit: null,
  /** The first seven of `commit` — what a footer and a bug report quote. */
  short: null,
  /** The commit's committer date, ISO 8601. */
  date: null,
  branch: null,
  /** 'unread' until the fetch settles, then 'stamp' or 'missing'. */
  source: 'unread',
};

/** Hosts that mean "this is somebody's working copy", not the deploy. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1', '']);

/**
 * @param {string} [host] defaults to the host this page was served by
 * @returns {boolean} true for a working copy — localhost, a file:// page, or a
 *   `.localhost`/`.test` name
 */
export function isDevHost(host) {
  const name = host === undefined ? (typeof location === 'undefined' ? '' : location.hostname) : String(host);
  if (LOCAL_HOSTS.has(name)) return true;
  return name.endsWith('.localhost') || name.endsWith('.test');
}

/** @type {Promise<typeof VERSION>|null} memoised: one fetch per page load. */
let pending = null;

/**
 * Read `version.json` into `VERSION`. Safe to call from anywhere and any number
 * of times; resolves to `VERSION` either way, so a caller never has to handle a
 * rejection to draw a footer.
 *
 * A missing file is a console error the browser logs on its own, which the
 * suite runner counts (the same reason index.html carries an empty favicon,
 * H2). That is deliberate: the stamp going missing from a deploy should be
 * loud, not a quiet 'unknown' in a corner.
 */
export function loadVersion() {
  if (pending) return pending;
  pending = (async () => {
    try {
      if (typeof fetch !== 'function') throw new Error('no fetch');
      // no-store: a cached stamp on the deploy is a footer naming last week's
      // build, which is worse than no footer.
      const response = await fetch(VERSION_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const read = await response.json();
      VERSION.commit = typeof read.commit === 'string' ? read.commit : null;
      VERSION.short = typeof read.short === 'string' ? read.short : (VERSION.commit ? VERSION.commit.slice(0, 7) : null);
      VERSION.date = typeof read.date === 'string' ? read.date : null;
      VERSION.branch = typeof read.branch === 'string' ? read.branch : null;
      VERSION.source = VERSION.commit ? 'stamp' : 'missing';
    } catch {
      VERSION.source = 'missing';
    }
    return VERSION;
  })();
  return pending;
}

/**
 * The one line the main menu's footer shows, and the line H12's report quotes.
 *
 * Pure in its arguments so a check can read every branch of it without a page
 * that is missing its stamp — which cannot be staged by fetching a path that is
 * not there, because that 404 is a console error the runner counts.
 *
 * @param {object} [version] defaults to the live stamp
 * @param {string} [host] defaults to this page's host
 * @returns {string}
 */
export function versionLabel(version = VERSION, host) {
  const dev = isDevHost(host);
  const short = version && typeof version.short === 'string' ? version.short : null;
  if (!short) return dev ? 'dev' : 'build unknown';
  const day = version.date && /^\d{4}-\d{2}-\d{2}/.test(version.date) ? version.date.slice(0, 10) : 'undated';
  return dev ? `dev · ${short} · ${day}` : `${short} · ${day}`;
}
