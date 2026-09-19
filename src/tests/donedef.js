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
 * and, since F3, Section 3.1's line guidance: a module that has grown past
 * ~600 lines is the kind of drift a weekly audit notices and a nightly build
 * does not.
 *
 * A stray font, a favicon, an analytics beacon or a deprecation warning added
 * three phases from now would not fail any other check in the suite.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';

/** The one host Section 2 allows: the pinned Three.js CDN. */
const ALLOWED_HOST = 'cdn.jsdelivr.net';

/**
 * Section 3.1: "anything past ~600 lines gets split". F3 brought every module
 * under it and this is what keeps them there. The one exemption is written
 * down in PLAN.md: config.js is a table, and a table is read by key, not by
 * scrolling.
 */
const SOURCE_LINE_GUIDANCE = 600;
const EXEMPT_TABLE = 'src/config.js';

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
    id: 'no-source-file-outside-config-is-over-600-lines',
    spec: 'Section 3.1 (split past ~600 lines)',
    name: 'Every module the game loaded is under the split guidance, config.js excepted',
    run: async () => {
      // The modules that actually ran, from the same Resource Timing list the
      // network check reads: nothing here guesses the import graph. Each is
      // fetched again from the origin (cached) and its lines counted.
      const origin = location.origin;
      const modules = new Set();
      for (const entry of performance.getEntriesByType('resource')) {
        const url = entry.name.split('?')[0];
        if (!url.startsWith(origin) || !url.endsWith('.js') || url.indexOf('/src/') === -1) continue;
        modules.add(url.slice(url.indexOf('/src/') + 1));
      }
      if (modules.size < 40) {
        return { pass: false, detail: `Resource Timing lists ${modules.size} modules under src/; expected the whole game` };
      }

      const sizes = [];
      for (const path of modules) {
        const text = await (await fetch(`${origin}/${path}`)).text();
        // A trailing newline is the end of the last line, not an extra one.
        sizes.push({ path, lines: text.replace(/\r?\n$/, '').split(/\r?\n/).length });
      }
      sizes.sort((a, b) => b.lines - a.lines);

      const over = sizes.filter((f) => f.lines > SOURCE_LINE_GUIDANCE && f.path !== EXEMPT_TABLE);
      const largest = sizes.find((f) => f.path !== EXEMPT_TABLE);
      const table = sizes.find((f) => f.path === EXEMPT_TABLE);
      return {
        pass: over.length === 0 && !!table,
        detail: over.length === 0
          ? `${sizes.length} modules loaded; the largest outside ${EXEMPT_TABLE} is ${largest.path} at `
            + `${largest.lines} lines (guidance ${SOURCE_LINE_GUIDANCE}); ${EXEMPT_TABLE} is ${table ? table.lines : '?'} `
            + 'and is the table PLAN.md exempts'
          : `over ${SOURCE_LINE_GUIDANCE} lines: ${over.map((f) => `${f.path} (${f.lines})`).join(', ')}`,
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

      // And the redesign's contract, named by id (20.11): every id is a
      // registered check, so a renamed census cannot quietly leave the set.
      const ids = new Set(dt._autoTests.map((test) => test.id));
      const byId = CONFIG.debug.regressionChecks;
      const unknown = byId.filter((id) => !ids.has(id));
      if (unknown.length) problems.push(`the regression set names check id(s) that do not exist: ${unknown.join(', ')}`);
      const withIds = dt._autoTests.filter((test) =>
        byId.indexOf(test.id) !== -1 || dt.checksCovered(test).some((number) => wanted.indexOf(number) !== -1)
      );
      if (withIds.length >= dt._autoTests.length) problems.push('with the redesign checks the regression set is the entire suite');

      // And on THIS map (D6): what F4-then-U and `npm run suite --regression`
      // actually run here. The set the page resolves is the set above less
      // the checks registered for other maps; it must agree with this
      // check's own count, run more than nothing, and name every check it
      // leaves out - the map's regression run is only as honest as that
      // line. Since D7 the set is WHOLE on every map: a check in it that
      // is registered for another map, or a Section 16 number in it that
      // no check running here covers, is red - the clause belongs in
      // tests/anymap.js, searching the map it is on, not behind a tag.
      const here = dt.suite.regressionSet();
      const applicable = withIds.filter((test) => !test.maps || test.maps.indexOf(h.map.id) !== -1);
      if (here.subset.length !== applicable.length) {
        problems.push(`on ${h.map.id} the page resolves the set to ${here.subset.length} checks, this check counts ${applicable.length}`);
      }
      if (here.subset.length === 0) problems.push(`on ${h.map.id} the regression set runs nothing`);
      if (here.subset.length + here.notForMap.length !== withIds.length) {
        problems.push(`on ${h.map.id} ${here.subset.length} run and ${here.notForMap.length} are not for the map, but the set is ${withIds.length}`);
      }
      const elsewhere = here.notForMap.map((test) => test.id);
      const named = new Set(dt._autoTests.map((test) => test.id));
      if (elsewhere.some((id) => !named.has(id))) problems.push('the set names a check for another map that is not registered');
      if (elsewhere.length) {
        problems.push(`on ${h.map.id} ${elsewhere.length} of the set ${elsewhere.length > 1 ? 'are' : 'is'} for other maps only: ${elsewhere.join(', ')} (D7: the set is whole on every map)`);
      }
      if (here.uncovered.length) {
        problems.push(`on ${h.map.id} no check in the set covers Section 16 check${here.uncovered.length > 1 ? 's' : ''} ${here.uncovered.join(', ')}`);
      }

      const claimed = [...coverage.keys()].sort((a, b) => a - b);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `on ${h.map.id} the regression set runs all ${here.subset.length} of its checks, none for another map, every number covered here`
            + `; the suite claims ${claimed.length} of Section 16's ${CONFIG.debug.specCheckCount} checks `
            + `(${claimed.join(', ')}); the set ${wanted.join(', ')} resolves to `
            + `${subset.length} of ${dt._autoTests.length} checks, all of them present, and with the `
            + `${byId.length} redesign checks by id to ${withIds.length}`
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

  debugTools.registerAutoTest({
    id: 'playtest-md-exists-is-linked-and-names-real-checks',
    spec: 'Section 16 (the HUMAN checks are a checklist for Josh), C6',
    name: 'PLAYTEST.md has its four sections, HANDOFF.md points at it, and every check it names exists',
    run: async (h) => {
      // C6: the notes Josh plays from. A file nothing reads rots like a
      // comment; this reads it. The headings are the queue's four
      // questions, the checks it names in backticks must be registered
      // (a renamed check would leave him a line that runs nothing), and
      // HANDOFF.md must link it or a session never finds it.
      const origin = location.origin;
      const problems = [];
      const response = await fetch(`${origin}/PLAYTEST.md`);
      if (!response.ok) return { pass: false, detail: `PLAYTEST.md: HTTP ${response.status}` };
      const text = await response.text();

      const sections = ['Run it', 'What to look at', 'What cannot be verified without eyes', 'Known issues'];
      for (const title of sections) {
        if (!new RegExp(`^## ${title}`, 'm').test(text)) problems.push(`no "## ${title}" section`);
      }

      // A backticked kebab word of four or more parts is a check id.
      const ids = new Set(h.debugTools._autoTests.map((test) => test.id));
      const named = new Set();
      const missing = [];
      for (const match of text.matchAll(/`([a-z0-9]+(?:-[a-z0-9]+){3,})`/g)) {
        named.add(match[1]);
        if (!ids.has(match[1])) missing.push(match[1]);
      }
      if (named.size === 0) problems.push('names no check at all');
      if (missing.length) problems.push(`names checks that do not exist: ${missing.join(', ')}`);

      const handoff = await (await fetch(`${origin}/HANDOFF.md`)).text();
      if (handoff.indexOf('PLAYTEST.md') === -1) problems.push('HANDOFF.md does not mention PLAYTEST.md');

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${text.split(/\r?\n/).length} lines, the ${sections.length} sections, ${named.size} checks named and every one registered, linked from HANDOFF.md`
          : problems.join('; '),
      };
    },
  });
}
