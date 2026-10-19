/**
 * BLACKLINE - tests/outlierpose.js
 *
 * AUTO suite (H89): the pixel floors hold at a pose the pinned settle never
 * photographs.
 *
 * Since H81 every `quiesce()` caller opens one circuit, so the sites that
 * photograph the settle without stepping a frame always photograph the
 * dominant pose - the Warden on its spawn, facing where most circuits leave
 * it. The minority classes are real states of this game (17 and 37 of 400
 * circuits on the two maps, one of them on its spawn facing 130 degrees away)
 * and before H81 they were looked at by accident, 4% and 9% of runs. A pin
 * that is better as an instrument stopped sampling them at all.
 *
 * So this re-runs a few of those sites with the settle moved to an **outlier**
 * seed, and holds them to their own verdict - which says the floors are about
 * the Shade and the scene rather than about where the Warden happened to
 * stand. The seed is taken from `settlecircuit.js`'s pose census every run and
 * never written down (H80, H81): a map whose waypoints move moves it.
 *
 * **How a site is moved.** A site calls `quiesce(h)`, which opens its match at
 * `SETTLE_SEED`; for the length of the site's own `run`, `h.initMatch` is
 * wrapped to open that seed's matches at the outlier instead, and nothing else.
 * The wrap counts what it moved, so a site that stopped quiescing reads as a
 * site this check did not move rather than as a pass.
 *
 * The sites are the ones with the widest margins on record (the batch verify
 * of 2026-10-19): the post's bloom ring (22.5 -> 77.6 plant, 34.6 -> 111.9
 * yard), the key light's wall (2/0/2 crossings against a ceiling of 6), and the
 * dark between the yard's pools. The masts' coverage check quiesces nothing, so
 * it cannot be moved - the wrap's count is what said so. A narrow floor at an outlier would be
 * a reading about the outlier; a wide one is a reading about the floor.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { SETTLE_SEED } from './pixels.js';
import { settleClasses, settleFrames, dominantPose } from './settlecircuit.js';

/** The sites, by id. Each runs where its own `maps` says it does. */
const SITES = [
  'post-processing-blooms-the-emissives-darkens-the-corners-and-is-a-switch',
  'a-wall-the-key-lights-from-behind-reads-plain',
  'the-yard-is-dark-between-its-pools',
];

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-pixel-floors-hold-at-a-settle-pose-the-pinned-seed-never-photographs',
    spec: 'H81 / H89',
    name: "A site that photographs the settle, moved to an outlier seed from the pose census, still passes its own floor - so the floor is about the scene and not where the Warden stood",
    run: async (h) => {
      const problems = [];
      const read = await settleFrames();
      if (read.error) return { pass: false, detail: read.error };
      const classes = settleClasses(h, read.frames);
      const dominant = dominantPose(classes);
      // The outlier: the biggest class that is not the dominant one, at the
      // first seed that drew it. A census of one class has nothing to offer.
      const outlier = classes.poses.find((p) => dominant && p.pose !== dominant.pose);
      if (!outlier) {
        return { pass: false, detail: `${classes.scanned} seeds settle to ${classes.poses.length} pose(s) and none is outside the dominant one, so the census has stopped varying and this check moves nothing` };
      }
      const seed = outlier.first;
      if (seed === SETTLE_SEED || outlier.pose === dominant.pose) {
        problems.push(`the outlier seed ${seed} settles to the dominant pose, so this check photographs what every other site photographs (a census that has stopped varying)`);
      }

      const readings = [];
      const here = h.map.id;
      for (const id of SITES) {
        const site = debugTools._autoTests.find((t) => t.id === id);
        if (!site) { problems.push(`${id} is not registered, so this check has one site fewer than it says`); continue; }
        if (site.maps && site.maps.indexOf(here) === -1) continue;
        const real = h.initMatch;
        let moved = 0;
        h.initMatch = (options) => {
          if (options && options.seed === SETTLE_SEED) { moved++; return real({ ...options, seed }); }
          return real(options);
        };
        let result;
        try {
          if (typeof h.resetPresentation === 'function') h.resetPresentation();
          result = await site.run(h);
        } catch (error) {
          result = { pass: false, detail: `threw: ${error && error.message}` };
        } finally {
          h.initMatch = real;
        }
        if (!moved) problems.push(`${id} opened no match at ${SETTLE_SEED}, so it was not moved to the outlier and proves nothing here`);
        else if (!result || !result.pass) problems.push(`${id} at outlier seed ${seed} (${outlier.seeds}/${classes.scanned}: ${outlier.moved.toFixed(3)}m, yaw ${outlier.yaw.toFixed(2)}): ${result ? String(result.detail).slice(0, 160) : 'no verdict'}`);
        else readings.push(`${id.split('-').slice(0, 3).join('-')}: ${String(result.detail).slice(0, 80)}`);
      }
      if (!readings.length && !problems.length) problems.push(`none of the ${SITES.length} sites runs on ${here}, so no floor was read at an outlier here`);

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `outlier seed ${seed}, ${outlier.seeds}/${classes.scanned} circuits at ${outlier.moved.toFixed(3)}m yaw ${outlier.yaw.toFixed(2)} against the dominant ${dominant.seeds} at yaw ${dominant.yaw.toFixed(2)}; ${readings.join('; ')}`
          : problems.join('; '),
      };
    },
  });
}
