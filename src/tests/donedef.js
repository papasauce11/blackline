/**
 * BLACKLINE - tests/donedef.js
 *
 * AUTO suite: the Section 18 definition of done, for the lines a machine can
 * actually settle.
 *
 * Section 18 is a checklist and most of it has been asserted elsewhere — one
 * shadow-casting light in tests/map.js, the scoreboard in tests/objective.js,
 * the frame budget in tests/performance.js. Two items had nothing watching
 * them, and both are the kind that rot quietly:
 *
 *   - "No external asset requests in the network tab beyond the Three.js CDN"
 *   - "Zero console errors and zero warnings during a full match"
 *
 * A stray font, a favicon, an analytics beacon or a deprecation warning added
 * three phases from now would not fail any other check in the suite.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';

/** The one host Section 2 allows: the pinned Three.js CDN. */
const ALLOWED_HOST = 'cdn.jsdelivr.net';

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'no-network-beyond-the-three-cdn',
    spec: 'Section 2 / Section 18',
    name: 'Every request is same-origin or the pinned Three.js CDN, and nothing else',
    run: () => {
      const problems = [];
      if (typeof performance === 'undefined' || !performance.getEntriesByType) {
        return { pass: false, detail: 'no Resource Timing API to inspect' };
      }

      const entries = performance.getEntriesByType('resource');
      const origin = location.origin;
      const external = [];
      const three = [];

      for (const entry of entries) {
        if (entry.name.startsWith(origin) || entry.name.startsWith('data:') || entry.name.startsWith('blob:')) continue;
        if (entry.name.indexOf(ALLOWED_HOST) !== -1) {
          three.push(entry.name);
          continue;
        }
        external.push(entry.name);
      }

      if (external.length) {
        problems.push(`external requests beyond the CDN: ${external.slice(0, 4).join(', ')}`);
      }
      // Section 2: "Zero external assets. No images, no models, no audio files,
      // no fonts", and "pin ONE specific Three.js release". So the CDN may
      // serve exactly two files — the module and the core it re-exports — and
      // the version in the path must be an explicit semver rather than a tag
      // that could float underneath us.
      const PINNED_BUILD = /\/three@\d+\.\d+\.\d+\/build\/three(\.module|\.core)\.js$/;
      for (const url of three) {
        if (!PINNED_BUILD.test(url)) {
          problems.push(`the CDN served something other than a pinned Three build file: ${url}`);
        }
      }
      // And every one of them must be the SAME release.
      const versions = new Set(three.map((url) => (/three@(\d+\.\d+\.\d+)/.exec(url) || [])[1]));
      if (versions.size > 1) problems.push(`two Three versions loaded: ${[...versions].join(', ')}`);

      const local = entries.length - external.length - three.length;
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${entries.length} requests: ${local} same-origin, ${three.length} from ${ALLOWED_HOST} `
            + `(three@${[...versions][0]} module and core, both pinned), 0 anything else`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-regression-set-resolves-to-real-checks',
    spec: 'Section 16',
    name: 'Every check in the named regression set maps onto AUTO coverage',
    run: (h) => {
      const problems = [];
      const dt = h.debugTools;
      const wanted = CONFIG.debug.regressionSet;

      // Which Section 16 checks the suite claims, parsed from what each check
      // prints about itself — so the claim and the report cannot disagree.
      const coverage = new Map();
      for (const test of dt._autoTests) {
        for (const number of dt.checksCovered(test)) {
          if (!coverage.has(number)) coverage.set(number, []);
          coverage.get(number).push(test.id);
        }
      }

      const missing = wanted.filter((number) => !coverage.has(number));
      if (missing.length) {
        problems.push(`the regression set names check${missing.length > 1 ? 's' : ''} ${missing.join(', ')}, which nothing covers`);
      }

      // The subset must be a real, proper subset — not everything, and not
      // nothing. A "regression set" that runs the whole suite is not one.
      const subset = dt._autoTests.filter((test) =>
        dt.checksCovered(test).some((number) => wanted.indexOf(number) !== -1)
      );
      if (subset.length === 0) problems.push('the regression set resolved to no checks at all');
      if (subset.length >= dt._autoTests.length) problems.push('the regression set resolved to the entire suite');

      // Nothing may parse to a check number outside the spec's 29.
      const outOfRange = [...coverage.keys()].filter(
        (number) => number < 1 || number > CONFIG.debug.specCheckCount
      );
      if (outOfRange.length) {
        problems.push(`checks claim Section 16 number(s) ${outOfRange.join(', ')}, which do not exist`);
      }

      const claimed = [...coverage.keys()].sort((a, b) => a - b);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `the suite claims ${claimed.length} of Section 16's ${CONFIG.debug.specCheckCount} checks `
            + `(${claimed.join(', ')}); the regression set ${wanted.join(', ')} resolves to `
            + `${subset.length} of ${dt._autoTests.length} checks, all of them present`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'a-live-match-logs-nothing',
    spec: 'Section 18',
    name: 'Minutes of competitive play produce no console errors and no warnings',
    run: (h) => {
      const problems = [];
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });

      const captured = [];
      const realWarn = console.warn;
      const realError = console.error;
      console.warn = (...args) => captured.push(`warn: ${args.map(String).join(' ')}`);
      console.error = (...args) => captured.push(`error: ${args.map(String).join(' ')}`);

      let simulated = 0;
      try {
        // A real round's worth of every system running together: AI patrolling
        // and engaging, gadgets thrown and expiring, the Shade dying and
        // reinserting, the round clock running down.
        const seconds = 90;
        const steps = Math.round(seconds / CONFIG.time.fixedDt);

        const eye = { x: h.shade.position.x, y: h.shade.feetY + 1.4, z: h.shade.position.z };
        const forward = { x: 0, y: 0.2, z: -1 };
        for (let i = 0; i < steps; i++) {
          // Something happening every few seconds, rather than a quiet idle.
          if (i % 900 === 300) h.gadgets.throwGadget('smoke', eye, forward, 'shade');
          if (i % 900 === 600) h.gadgets.throwGadget('flashbang', eye, forward, 'shade');
          if (i % 1800 === 1200) {
            h.shade.health = 0;
            h.emitter.emit('combat:death', { target: 'shade', kind: 'test' });
          }
          h.stepFrames(1);
          simulated++;
        }
      } finally {
        console.warn = realWarn;
        console.error = realError;
      }

      if (captured.length) {
        problems.push(`${captured.length} console messages: ${captured.slice(0, 3).join(' | ')}`);
      }
      if (h.debugTools.assertionFailures > 0) {
        problems.push(`${h.debugTools.assertionFailures} runtime assertion failures`);
      }

      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${(simulated * CONFIG.time.fixedDt).toFixed(0)}s of competitive play with the AI, gadgets, `
            + 'deaths and reinserts running: 0 warnings, 0 errors, 0 assertion failures'
          : problems.join('; '),
      };
    },
  });
}
