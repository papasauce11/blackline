/**
 * BLACKLINE - tests/autopick.js
 *
 * AUTO suite (H25): the map a friend opens first must not decide their quality
 * for the life of that browser.
 *
 * **The defect this holds closed.** `auto`'s probe measures a median CPU frame
 * and picks a preset from it, and H10's own verify measured the same machine
 * twice without anybody reading what it implied: **8.70ms on the plant, which
 * picks `low`**, and **5.30ms on the yard, which picks `medium`**. The plant is
 * the heavier scene. So the probe is a reading about this machine *times this
 * scene* - and the old rule stored the pick only when nothing was stored yet
 * (`SETTINGS.qualityAuto === null`, the first boot that answers), which means
 * **whichever map you happened to open first decided your level for good.**
 * Open the yard, get `medium`, then play the plant at a level your machine
 * cannot hold, for as long as that browser keeps its site data.
 *
 * `rememberedPick` in `quality.js` keeps the **lower** of what is stored and
 * what was just picked, which is the only rule that is safe in both orders, and
 * **D68** has the argument and the cost.
 *
 * **What this check does and does not drive.** It feeds two *real* probes two
 * different medians and holds the rule against their two picks - which is the
 * measurement the queue asked for - and it reads `quality.js` to confirm the
 * storing path goes through that rule. It deliberately does **not** drive the
 * module's own probe through `sampleQualityFrame`, and the reason is worth
 * keeping: the live probe's reading is `state.probe`, which the headless
 * runner's **run record** carries and `HANDOFF.md` quotes as *"what auto would
 * have picked"*. A check that completed a synthetic probe would overwrite it
 * and the report would then lie about this machine - which is exactly the class
 * of bug H24 found in H23's check, where the record named a level the run was
 * not drawing. So the rule is a pure function, tested as one, and the one line
 * that calls it is held by reading the source.
 *
 * Its own module rather than a block in `tests/quality.js`, which is at 544
 * lines and would have gone past the ~600 the spec allows.
 *
 * Registered from tests/index.js beside the other quality checks. Nothing here
 * imports main.js (Section 3.1).
 */

import { CONFIG, SETTINGS } from '../config.js';
import { QUALITY_LEVELS, createQualityProbe, rememberedPick, qualityState } from '../quality.js';

const P = CONFIG.quality.probe;

/**
 * A median a probe will judge against the **CPU's** share of the frame budget,
 * not the whole frame's - derived from the constants the probe itself reads,
 * because a check that reads the constant the derivation read can only ever
 * agree with it (HANDOFF.md), and `cpuBudgetFraction` is the one H10 got wrong.
 */
const BUDGET = CONFIG.performance.frameBudgetMs * CONFIG.performance.cpuBudgetFraction;

/** Enough frames that a probe has thrown the warm ones away and answered. */
const ENOUGH = P.warmFrames + P.maxFrames;

/** A fresh probe fed `count` frames of `ms`, and what it picked. */
function pickFrom(ms, count = ENOUGH) {
  const probe = createQualityProbe();
  for (let i = 0; i < count; i++) probe.sample(ms);
  return probe.pick;
}

/**
 * The storing path in `quality.js`, held by its text. **This is the clause that
 * makes the job revert-detectable**: everything else here is about a pure
 * function, and a pure function nobody calls is decoration - the lesson H27
 * wrote down when a spread froze `rng.calls` at zero and no check noticed,
 * because nothing asserted the field.
 *
 * The old line is named as well as the new one, so putting the `=== null` guard
 * back is red rather than quietly equivalent.
 */
const STORES_THROUGH_THE_RULE = 'rememberedPick(SETTINGS.qualityAuto, state.probe.pick)';
const THE_OLD_FIRST_BOOT_GUARD = 'SETTINGS.qualityAuto === null &&';

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-second-maps-probe-cannot-raise-the-level-the-first-one-stored',
    spec: 'Section 16 check 29, H10 / H25',
    name: 'Two probes with two different medians store the lower of their picks whichever order they answer in, the rule is the lower of every pair in the preset table, and quality.js stores through it',
    run: async () => {
      const problems = [];

      // ------------------------------------------------------------------
      // 1. The instrument, before anything that leans on it (F8). Two real
      //    probes, two different medians, and they must pick two *different*
      //    levels or every clause below is comparing a thing with itself.
      // ------------------------------------------------------------------
      const slowMs = BUDGET * P.mediumFraction * 4;
      const fastMs = BUDGET * P.highFraction * 0.5;
      const slow = pickFrom(slowMs);
      const fast = pickFrom(fastMs);
      if (slow === fast) {
        return {
          pass: false,
          detail: `both probes picked ${slow} (${slowMs.toFixed(2)}ms and ${fastMs.toFixed(2)}ms medians)`
            + ' - this check cannot say anything about the lower of two picks until two medians pick differently',
        };
      }
      const lower = QUALITY_LEVELS.indexOf(slow) < QUALITY_LEVELS.indexOf(fast) ? slow : fast;

      // ------------------------------------------------------------------
      // 2. The rule, in both orders. This is the defect: one of these two
      //    orders is what a friend who opens the yard first gets.
      // ------------------------------------------------------------------
      const firstBoot = rememberedPick(null, slow);
      if (firstBoot !== slow) problems.push(`a first boot that measured ${slow} stored ${firstBoot}`);

      const heavyThenLight = rememberedPick(slow, fast);
      const lightThenHeavy = rememberedPick(fast, slow);
      if (heavyThenLight !== lower) {
        problems.push(`stored ${slow} then probed ${fast} and kept ${heavyThenLight}, not ${lower} - the easier scene raised the level`);
      }
      if (lightThenHeavy !== lower) {
        problems.push(`stored ${fast} then probed ${slow} and kept ${lightThenHeavy}, not ${lower} - the heavier scene did not bring it down`);
      }
      if (heavyThenLight !== lightThenHeavy) {
        problems.push(`the two orders disagree (${heavyThenLight} against ${lightThenHeavy}) - which map a player opens first still decides their level`);
      }

      // ------------------------------------------------------------------
      // 3. Every pair in the table, not three hand-picked ones, so a fourth
      //    preset is covered the day it is added rather than the day somebody
      //    remembers this check exists.
      // ------------------------------------------------------------------
      for (const stored of QUALITY_LEVELS) {
        for (const picked of QUALITY_LEVELS) {
          const want = QUALITY_LEVELS.indexOf(stored) <= QUALITY_LEVELS.indexOf(picked) ? stored : picked;
          const got = rememberedPick(stored, picked);
          if (got !== want) problems.push(`stored ${stored} + picked ${picked} kept ${got}, want the lower (${want})`);
        }
      }

      // A value the table does not know is nothing stored (H21: H7's store
      // validates a key by type and not by range, so a hand-edited one gets
      // this far), and a pick it does not know changes nothing.
      const unknown = 'ultra';
      if (rememberedPick(unknown, QUALITY_LEVELS[1]) !== QUALITY_LEVELS[1]) {
        problems.push(`a stored "${unknown}" was compared against instead of replaced`);
      }
      if (rememberedPick(QUALITY_LEVELS[1], unknown) !== QUALITY_LEVELS[1]) {
        problems.push(`a picked "${unknown}" changed what is stored`);
      }
      if (rememberedPick(null, null) !== null) problems.push('nothing stored and nothing picked did not stay nothing');

      // ------------------------------------------------------------------
      // 4. And the one line that calls it, by its text - a pure function
      //    nothing calls is decoration (H27).
      // ------------------------------------------------------------------
      const source = await (await fetch(`${location.origin}/src/quality.js`)).text();
      if (source.indexOf(STORES_THROUGH_THE_RULE) === -1) {
        problems.push('quality.js does not store the probe\'s pick through rememberedPick - the rule above is tested and unused');
      }
      if (source.indexOf(THE_OLD_FIRST_BOOT_GUARD) !== -1) {
        problems.push('quality.js still has the first-boot guard that H25 removed, so the first map to answer decides the level again');
      }

      // ------------------------------------------------------------------
      // 5. The live boot, reported and held to one invariant: whatever is
      //    stored is already at or below what this machine just measured.
      //    True under the old rule too on a one-map page, so it proves
      //    nothing about the change - it is here because it is the real
      //    state and a report should carry it.
      // ------------------------------------------------------------------
      const live = qualityState();
      const stored = SETTINGS.qualityAuto;
      const livePick = live.probe ? live.probe.pick : null;
      if (stored !== null && livePick !== null && rememberedPick(stored, livePick) !== stored) {
        problems.push(`this page stored ${stored} while its own probe picked ${livePick}, which is lower`);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${slowMs.toFixed(2)}ms picks ${slow} and ${fastMs.toFixed(2)}ms picks ${fast}; either order stores ${lower}`
            + `; every one of the ${QUALITY_LEVELS.length * QUALITY_LEVELS.length} pairs over [${QUALITY_LEVELS.join(', ')}] keeps the lower`
            + `; quality.js stores through the rule and the first-boot guard is gone`
            + `; this page: stored ${stored === null ? 'nothing' : stored}, its own probe picked ${livePick ?? 'nothing yet'}`
          : problems.join('; '),
      };
    },
  });
}
