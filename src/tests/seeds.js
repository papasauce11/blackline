/**
 * BLACKLINE - tests/seeds.js
 *
 * One seed for the checks that explore, and none for the checks that pin.
 *
 * Two kinds of check draw on the seeded rng, and they want opposite things from
 * a seed. A check whose *subject* is determinism - the same seed replays, the
 * next seed does not - has to pin its seeds, because the comparison is the
 * assertion. A check that fuzzes or soaks does not care which seed it gets; it
 * cares that a different one explores somewhere new. Those pinned their seeds
 * too, and the 2026-09-20 audit found what that cost: the weekly fresh-seed run
 * (`--query "seed=N"`) had been re-running the builder's own seeds under a new
 * name since it started, because `initMatch` takes an explicit seed over the
 * URL's and every fuzz and soak check passed one.
 *
 * `exploreSeed(label, fallback)` is the fix, and it is deliberately not "always
 * use the URL seed": with no `?seed=` in the URL a site gets its pinned
 * fallback, byte for byte as before, so the gate - which never passes a seed -
 * answers exactly as it did, and no module's default seed changed when this
 * landed. A seed in the URL reaches every exploratory site, and each one lands
 * somewhere different.
 *
 * The **label**, not the fallback, is what makes a site distinct: two modules
 * had picked the same number (`tests/traversalfuzz.js` and
 * `tests/wardenground.js` both on 20260914), and keying off the number would
 * have sent them to the same fresh seed or forced one of them to change what it
 * runs by default. The label is also what the census below is written in.
 *
 * Every exploratory seed is taken **at module level**, as a named constant, so
 * the whole set is requested at import time and
 * `the-url-seed-reaches-every-exploratory-check` can read it without depending
 * on which checks have run, or in what order, or on which map.
 *
 * Registered from tests/index.js; also the home of `exploreSeed` itself.
 * Nothing here imports main.js (Section 3.1).
 */

import { mulberry32, seedInQuery } from '../config.js';

/**
 * Every site `exploreSeed` has been asked for, by label, mapped to what it
 * handed back. This is how the check reads the call sites: a site that goes
 * back to a bare literal stops appearing here, and the check names it.
 * @type {Map<string, number>}
 */
const handedOut = new Map();

/** The eight paired seeds tests/difficulty.js measures every preset with. */
const DIFFICULTY_PRESET_SEEDS = [0xd1f1, 0xd1f2, 0xd1f3, 0xd1f4, 0xd1f5, 0xd1f6, 0xd1f7, 0xd1f8];

/**
 * The exploratory sites this suite expects to exist. The check asserts the set
 * `exploreSeed` was asked for is exactly this, so a new fuzz that pins its own
 * seed fails until it is either routed through here or written down as a
 * deliberate pin in `PINNED_SEEDS`.
 */
export const EXPLORATORY_SEEDS = [
  { label: 'shade-fuzz', fallback: 8675309, where: 'tests/fuzz.js' },
  { label: 'traversal-fuzz', fallback: 20260914, where: 'tests/traversalfuzz.js' },
  { label: 'traversal-approach-sweep', fallback: 19770912, where: 'tests/traversalfuzz.js' },
  { label: 'ai-soak', fallback: 0xd5a1, where: 'tests/aisoak.js' },
  { label: 'difficulty-engagement', fallback: 0xb0b5, where: 'tests/difficulty.js' },
  { label: 'shade-random-input', fallback: 0xf0f0f0, where: 'tests/shade.js' },
  { label: 'warden-ground-soak', fallback: 20260914, where: 'tests/wardenground.js' },
  { label: 'prng-range-bounds', fallback: 0xa11ce, where: 'tests/engine.js' },
  ...DIFFICULTY_PRESET_SEEDS.map((fallback, i) => ({
    label: `difficulty-preset-${i}`,
    fallback,
    where: 'tests/difficulty.js',
  })),
];

/**
 * The seeds that must **stay** pinned, and why. A check whose subject is
 * reproducibility is broken by a seed that moves: `?seed=` would change what
 * "the same seed replays identically" was asked about, and a reported failure
 * could no longer be reproduced from the number in the report. The check
 * asserts none of these ever reached `exploreSeed`, which catches the opposite
 * mistake to the one this module exists to fix.
 */
export const PINNED_SEEDS = [
  { fallback: 0x5eed1234, where: 'tests/engine.js', why: 'the rng reproduces from a seed; the seed is the subject' },
  { fallback: 20250814, where: 'tests/determinism.js', why: 'a match replays identically from its seed' },
  { fallback: 0xa17ea5, where: 'tests/ai.js', why: 'the same seed reproduces the same patrol circuit' },
];

/**
 * And one that is pinned and deliberately **not** listed above: F17's
 * `STALL_SEEDS[0]` in `tests/difficulty.js`, the engagement the 2026-09-27
 * audit turned red. It must stay a literal for the same reason as the three
 * above - a seed that moved would take the regression with it - but it
 * cannot go in the list, because the number *is*
 * `exploreSeed('difficulty-preset-0', 0xd1f1)` under `?seed=20260927`, which
 * is how the audit found it. Clause (b) compares numbers, so listing it
 * would make this check red on exactly the run F17 has to pass. A pinned
 * seed that a URL seed can also produce is outside what (b) can police, and
 * saying so here is better than a false red once a week.
 */

/** FNV-1a over the label, so a site's fresh seed is its own and is stable. */
function hashLabel(label) {
  let h = 0x811c9dc5;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The seed an exploratory site should run from.
 *
 * Without `?seed=` in the URL: the site's own pinned `fallback`, unchanged -
 * this is what the gate sees, and it is why adding a URL seed cannot make the
 * gate flaky.
 *
 * With `?seed=N`: one mulberry32 draw from `N` mixed with a hash of the label.
 * The mix, rather than an XOR of the two numbers, is what makes `?seed=0`
 * something other than a no-op and what keeps two sites off the same seed. A
 * drawn seed could in principle land on its own fallback and make the URL look
 * ignored; the check asserts against that over a fixed set of URL seeds, so
 * such a coincidence is found the moment it is introduced rather than later.
 *
 * @param {string} label which site is asking; identity, and part of the mix
 * @param {number} fallback the site's pinned seed, used when the URL is silent
 * @param {string} [search] the query string; defaults to the live `location`
 * @returns {number} a uint32 seed
 */
export function exploreSeed(label, fallback, search) {
  const query = typeof search === 'string'
    ? search
    : (typeof location !== 'undefined' ? location.search : '');
  const url = seedInQuery(query);
  const drawn = url === null
    ? fallback >>> 0
    : (mulberry32((url ^ hashLabel(label)) >>> 0)() * 0x100000000) >>> 0;
  // Only a live call site is recorded; the check passing its own `search` to
  // measure the function is not a call site and must not pollute the census.
  if (search === undefined) handedOut.set(label, drawn);
  return drawn;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-url-seed-reaches-every-exploratory-check',
    // Deliberately claims no Section 16 number. `checksCovered` parses "check
    // <n>" out of this string, and a number here would both claim coverage this
    // check does not provide - 28 is the overlay and the patrol circuit, which
    // determinism.js and ai.js assert - and pull this check into the regression
    // set, whose size D7 holds equal on every map.
    spec: 'Section 2 (seeded RNG) / the 2026-09-20 audit',
    name: 'Every fuzz and soak seed moves with ?seed=, every pinned seed does not, and a URL without one changes nothing',
    run: () => {
      const problems = [];
      const urlSeeds = [1, 7, 0, 20260920, 4294967295];

      // (a) The call sites. Every exploratory seed is taken at module level, so
      // by the time any check runs the census is complete however the run was
      // subset, ordered, or mapped.
      const asked = new Set(handedOut.keys());
      const missing = EXPLORATORY_SEEDS.filter((s) => !asked.has(s.label));
      if (missing.length) {
        problems.push(`${missing.length} exploratory site(s) never went through exploreSeed: `
          + missing.map((s) => `${s.label} (${s.where})`).join(', '));
      }
      const extra = [...asked].filter((label) => !EXPLORATORY_SEEDS.some((e) => e.label === label));
      if (extra.length) {
        problems.push(`exploreSeed was asked for ${extra.length} site(s) this module does not list: `
          + `${extra.join(', ')} - add them to EXPLORATORY_SEEDS or pin them in PINNED_SEEDS`);
      }

      // (b) The pinned seeds stayed pinned - the opposite mistake to (a). They
      // are numbers, not labels, so this reads what was handed back.
      const handedBack = new Set(handedOut.values());
      const wronglyExplored = PINNED_SEEDS.filter((s) => handedBack.has(s.fallback >>> 0));
      if (wronglyExplored.length) {
        problems.push('a seed whose subject is reproducibility was routed through exploreSeed: '
          + wronglyExplored.map((s) => `${s.where} - ${s.why}`).join('; '));
      }

      // (c) A URL without a seed changes nothing. This is the clause that keeps
      // the gate's two runs agreeing, so it is asserted and not assumed.
      for (const { label, fallback, where } of EXPLORATORY_SEEDS) {
        for (const quiet of ['', '?map=yard', '?debug=1&map=plant', '?unseeded=5']) {
          const got = exploreSeed(label, fallback, quiet);
          if (got !== (fallback >>> 0)) {
            problems.push(`with no seed in "${quiet}", ${label} (${where}) got ${got} `
              + `instead of its own ${fallback >>> 0}`);
          }
        }
      }

      // (d) A URL seed moves every site, and (e) no two sites collide on one.
      // `seed=0` is in the list on purpose: a bare XOR of the two numbers would
      // hand every fallback straight back, and that is the mistake the mix
      // exists to avoid.
      for (const url of urlSeeds) {
        const seen = new Map();
        for (const { label, fallback, where } of EXPLORATORY_SEEDS) {
          const got = exploreSeed(label, fallback, `?seed=${url}`);
          if (got === (fallback >>> 0)) {
            problems.push(`?seed=${url} left ${label} (${where}) on its fallback ${fallback >>> 0} `
              + '- the URL bought that site nothing');
          }
          if (seen.has(got)) problems.push(`?seed=${url} sent ${label} and ${seen.get(got)} to the same seed ${got}`);
          seen.set(got, label);
        }
      }

      // (f) And a fresh seed is reproducible, which is the whole point of
      // ?seed=: a failure found on a Sunday has to be re-runnable on a Monday.
      const once = EXPLORATORY_SEEDS.map((s) => exploreSeed(s.label, s.fallback, '?seed=20260920'));
      const twice = EXPLORATORY_SEEDS.map((s) => exploreSeed(s.label, s.fallback, '?seed=20260920'));
      if (once.join(',') !== twice.join(',')) problems.push('?seed=20260920 did not reproduce its own seeds');

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${EXPLORATORY_SEEDS.length} exploratory sites all took their seed through exploreSeed, all moved and `
            + `all stayed distinct under every URL seed tried (${urlSeeds.join(', ')}); `
            + `${PINNED_SEEDS.length} reproducibility seeds still pinned; a URL without ?seed= returns every `
            + 'fallback unchanged, so the gate is unmoved'
          : problems.join('; '),
      };
    },
  });
}
