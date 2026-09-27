/**
 * BLACKLINE - tests/version.js
 *
 * AUTO suite (Section 17.1): the build stamp, and the footer that shows it (H3).
 *
 * Two checks, because there are two ways for "which build is this" to stop
 * being answerable. The stamp can go missing from the served root - which is
 * the half H3 wanted the deploy workflow to hold up, and holds it up on the
 * deploy itself when the gate is pointed at the Pages URL with `--url` (H2).
 * And the menu can stop showing it, which is the half a friend reporting a bug
 * actually depends on: a stamp nobody can read is a file nobody fetches.
 *
 * Neither asserts that the stamp names HEAD, because a page cannot know HEAD -
 * and because it deliberately does not. `scripts/version.mjs` writes only from
 * a clean tree, so between a job's commit and the `Record <job>` commit that
 * re-stamps it, the file names the commit before the work. What is asserted is
 * that it is a real commit, well formed, of a named branch.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { VERSION, loadVersion, versionLabel, isDevHost } from '../version.js';

/** Where the game fetches its stamp from, resolved the way the page does. */
const STAMP = 'version.json';

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-build-stamp-is-a-real-commit-the-site-serves',
    spec: 'Section 13, H3',
    name: 'version.json is served beside index.html, names a real commit of a named branch, and is what the page loaded',
    run: async () => {
      const problems = [];
      const url = new URL(STAMP, location.href);
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        // The one failure worth returning early on: with no file there is
        // nothing further to say, and the reason is the whole diagnostic.
        return {
          pass: false,
          detail: `${url.pathname}: HTTP ${response.status} - the served root carries no build stamp;`
            + ' `npm run stamp` writes it from a clean tree',
        };
      }

      let read = null;
      try {
        read = await response.json();
      } catch (err) {
        return { pass: false, detail: `${url.pathname} is not JSON: ${err && err.message}` };
      }

      if (!/^[0-9a-f]{40}$/.test(String(read.commit))) {
        problems.push(`commit "${read.commit}" is not a 40-character sha`);
      }
      if (read.short !== String(read.commit).slice(0, 7)) {
        problems.push(`short "${read.short}" is not the first seven of the commit`);
      }
      if (!Number.isFinite(Date.parse(read.date))) problems.push(`date "${read.date}" does not parse`);
      if (typeof read.branch !== 'string' || !read.branch.length) problems.push('the stamp names no branch');
      // A stamp from the future is a clock or a rebase, and either way the date
      // a bug report quotes would be a lie. An hour of slack for a timezone.
      if (Number.isFinite(Date.parse(read.date)) && Date.parse(read.date) > Date.now() + 3600e3) {
        problems.push(`the stamp is dated ${read.date}, which is in the future`);
      }

      // And that the game loaded that file, rather than a default nobody
      // notices is a default.
      await loadVersion();
      if (VERSION.source !== 'stamp') problems.push(`the page's VERSION.source is "${VERSION.source}", not "stamp"`);
      for (const key of ['commit', 'short', 'date', 'branch']) {
        if (VERSION[key] !== read[key]) problems.push(`VERSION.${key} is "${VERSION[key]}", the file says "${read[key]}"`);
      }

      // The label's own branches, driven by argument rather than by a page
      // whose stamp has been taken away: fetching a path that is not there
      // would be a 404, which is a console error the runner counts (H2).
      const label = versionLabel(read, 'papasauce11.github.io');
      if (label.indexOf(read.short) === -1) problems.push(`the deployed label "${label}" does not name the commit`);
      if (/dev/.test(label)) problems.push(`the deployed label "${label}" calls itself dev`);
      const local = versionLabel(read, 'localhost');
      if (local.indexOf('dev') !== 0) problems.push(`the local label "${local}" does not open with dev`);
      if (local.indexOf(read.short) === -1) problems.push(`the local label "${local}" does not name the commit`);
      const unstamped = versionLabel({ commit: null, short: null, date: null, branch: null }, 'papasauce11.github.io');
      if (!unstamped.length || unstamped.indexOf(read.short) !== -1) {
        problems.push(`an unstamped page's label is "${unstamped}"`);
      }
      // The host test itself, both ways, since everything above rests on it.
      if (!isDevHost('127.0.0.1') || !isDevHost('localhost') || !isDevHost('')) problems.push('isDevHost refuses a local host');
      if (isDevHost('papasauce11.github.io')) problems.push('isDevHost calls the Pages host local');

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${url.pathname}: ${read.short} on ${read.branch}, ${read.date}; the page loaded it; `
            + `the footer reads "${versionLabel(read)}" here and "${label}" deployed`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-main-menu-footer-names-the-build-it-is-running',
    spec: 'Section 13, H3',
    name: 'The main menu draws a footer carrying the build stamp, it survives a trip through the settings page, and it is visible',
    run: async (h) => {
      const problems = [];
      await loadVersion();
      const want = versionLabel();
      try {
        h.menu.show('main');
        const read = (root) => {
          const el = root.querySelector('#bl-version');
          return { el, text: el ? el.textContent.trim() : null };
        };

        let footer = read(h.menu.root);
        if (!footer.el) problems.push('the main menu has no #bl-version footer');
        else {
          if (footer.text !== want) problems.push(`the footer reads "${footer.text}", the module says "${want}"`);
          if (!VERSION.short || footer.text.indexOf(VERSION.short) === -1) {
            problems.push(`the footer "${footer.text}" does not name the commit (${VERSION.short})`);
          }
          // Drawn, not merely present: a footer at zero height or fully
          // transparent is a footer nobody reporting a bug can read.
          const rect = footer.el.getBoundingClientRect();
          if (rect.width < 1 || rect.height < 1) problems.push(`the footer is ${rect.width}x${rect.height}`);
          const style = getComputedStyle(footer.el);
          if (Number(style.opacity) < 0.2) problems.push(`the footer is drawn at opacity ${style.opacity}`);
          if (style.display === 'none' || style.visibility === 'hidden') problems.push('the footer is hidden by CSS');
          // Inside the card, so it cannot drift off the menu's own surface.
          const card = h.menu.root.querySelector('.card').getBoundingClientRect();
          if (rect.left < card.left - 1 || rect.right > card.right + 1) problems.push('the footer is outside the menu card');
        }

        // Every render of the main page draws it, not only the first: the
        // stamp arrives after boot and panels.js re-renders when it lands, so
        // a footer that survives only the first render would be blank in play.
        h.menu.show('settings');
        if (read(h.menu.root).el) problems.push('the settings page carries the main menu\'s footer');
        h.menu.show('main');
        footer = read(h.menu.root);
        if (!footer.el || footer.text !== want) {
          problems.push(`after settings the footer reads "${footer.text}", want "${want}"`);
        }

        // The pause overlay is the same surface (menu.js) and must not gain it.
        h.menu.show('pause');
        if (read(h.menu.root).el) problems.push('the pause overlay carries the main menu\'s footer');
      } finally {
        h.menu.hide();
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `the main menu's footer reads "${want}" on first render and after a trip through settings; `
            + 'the settings and pause pages do not carry it'
          : problems.join('; '),
      };
    },
  });
}
