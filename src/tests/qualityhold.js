/**
 * BLACKLINE - tests/qualityhold.js
 *
 * AUTO suite (Section 13, H23): the quality level held still for the length of
 * a set of pictures, and the menu's cards as the one thing that asks for it.
 *
 * The race this holds shut. `thumbnails.start()` runs right after boot and the
 * cards are drawn one task apart, with the game rendering frames in between;
 * `auto`'s probe answers `warmFrames + minFrames` frames in, which is about one
 * card. So on a first boot the first card would be drawn at the fallback and
 * its neighbour at whatever the probe then picked - and the headless gate's
 * `?quality=` pin hides that from every other check in the suite, which is
 * exactly how it survived H10.
 *
 * **What the hold is worth, measured, and it is not a picture.** At `low` the
 * renderer is demonstrably at low - an 896x503 buffer, a 512 shadow map, 0 of
 * 13 outlines shown, no post pass - and a card still comes back byte-identical
 * to the same card at `medium`, because none of those knobs is in a card: the
 * outlines are hidden by a traverse of the *live* scene, the shadow map is
 * resized on the *live* map's key light, and a card is a fresh map in a fresh
 * scene with its own 1024 key light drawn into a fixed 480x270 target that no
 * pixel ratio reaches. So what the hold makes true is `record.quality` - the
 * claim that a strip of cards is one picture of one game - and the day a knob
 * does reach a card it is already the fix. That is why this check reads the
 * *recorded* level rather than comparing pixels: a pixel comparison would pass
 * today for a reason that has nothing to do with the hold.
 *
 * Separate from `tests/quality.js` because that file was at 599 lines and
 * Section 3.1 splits past ~600 (F3), and because the subject is different: that
 * one is the five knobs read off the renderer, this one is the moment they are
 * allowed to turn.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG, SETTINGS } from '../config.js';
import {
  QUALITY_FALLBACK, activeQuality, appliedQuality, holdQuality, pinQuality,
  qualityHold, qualityReadings, releaseQuality, syncQuality,
} from '../quality.js';
import { listMaps } from '../maps/index.js';
import { createThumbnails } from '../thumbnails.js';
import { yieldToPaint } from '../bootscreen.js';
import { createToonGradient } from '../view.js';

/**
 * Bake a fresh set of menu cards the way boot does, with `auto`'s probe
 * answering in the middle of the set - which is where it lands on a real first
 * boot, for the reason in this file's opening paragraph.
 *
 * The interleaving rests on the one ordering this page already depends on.
 * `yieldToPaint` posts a port message, messages posted earlier are delivered
 * earlier, and `the-bake-yields-the-page-a-frame-to-paint` counts its markers
 * with exactly that (tests/boot.js). `start()` posts its first yield before
 * this function posts one, so this resumes after the first card has been drawn
 * and before the second.
 *
 * @param {object} h
 * @param {object} gradientMap the toon ramp, as boot hands it over
 * @param {string} picked what the probe answers with
 * @param {boolean} dropHold let the hold go first, which is the build H23
 *   replaced - the control that says the hold is what made the set one level
 */
async function bakeCards(h, gradientMap, picked, dropHold) {
  const cards = createThumbnails({ renderer: h.renderer, camera: h.camera, gradientMap });
  const done = cards.start();
  await yieldToPaint();
  if (dropHold) releaseQuality();
  // The one thing `sampleQualityFrame` does when the probe answers, and the
  // whole of what a first boot does differently from every later one.
  SETTINGS.qualityAuto = picked;
  // The frame the running game draws next. `syncQuality` has exactly one
  // caller in the game and this is it, so a level that moves between two cards
  // moves here.
  h.renderFrame(1 / 60);
  await done;
  return cards;
}

/** The level each card of a set was drawn at, in registry order. */
function cardLevels(cards, ids) {
  return ids.map((id) => (cards.record.maps[id] || {}).quality);
}

/** Back to whatever the URL and the player's record say, and drawn once at it. */
function putBack(h, was) {
  SETTINGS.quality = was.quality;
  SETTINGS.post = was.post;
  SETTINGS.qualityAuto = was.auto;
  pinQuality(location.search);
  syncQuality();
  h.renderFrame(1 / 60);
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'every-menu-card-is-baked-at-one-quality-level',
    spec: 'Section 13, H23',
    // It renders to a target and reads it back, so it synchronises: without
    // this the run's whole queued tail lands on its clock. Measured at
    // 40,572ms on the plant against 169ms once the pipeline was drained
    // (F11, D48) - a wait and not work, which is the trap it is named for.
    glSync: true,
    name: 'A first boot bakes every menu card at the one level the set started at, although auto answers in the middle of it; the set names that level; and the same drive without the hold splits the set',
    run: async (h) => {
      const problems = [];
      const seen = [];
      const was = { quality: SETTINGS.quality, post: SETTINGS.post, auto: SETTINGS.qualityAuto };
      const before = qualityReadings();
      const gradientMap = createToonGradient(CONFIG.render.toonSteps);
      const ids = listMaps().map((entry) => entry.id);

      // The live path first, and it costs nothing: the set this page's own boot
      // baked. H4's discipline - a check that drives its own inputs owes the
      // suite the reading the real boot produced - and the only clause here
      // that would notice `start()` dropping the hold altogether.
      const boot = h.thumbnails.record;
      const bootLevels = cardLevels(h.thumbnails, ids);
      if (!boot.quality) problems.push("the boot's own set recorded no level");
      if (new Set(bootLevels).size !== 1 || bootLevels[0] !== boot.quality) {
        problems.push(`the boot drew its cards at ${ids.map((id, i) => `${id} ${bootLevels[i]}`).join(', ')}`
          + ` and recorded ${boot.quality}`);
      }
      seen.push(`the boot's own ${ids.length} cards all at ${boot.quality}`);

      try {
        // A first boot: nothing stored, the row on `auto`, no pin. That draws
        // the fallback until the probe answers, which is the state the race
        // needs and the only state a friend's first visit is ever in.
        pinQuality('');
        SETTINGS.post = true;
        SETTINGS.quality = 'auto';
        SETTINGS.qualityAuto = null;
        syncQuality();
        if (activeQuality() !== QUALITY_FALLBACK) {
          problems.push(`a first boot draws ${activeQuality()}, not ${QUALITY_FALLBACK}`);
        }

        const held = await bakeCards(h, gradientMap, 'low', false);
        const levels = cardLevels(held, ids);
        if (!held.record.done) problems.push('the set never finished');
        if (new Set(levels).size !== 1 || levels[0] !== QUALITY_FALLBACK) {
          problems.push(`the cards were drawn at ${ids.map((id, i) => `${id} ${levels[i]}`).join(', ')}`
            + `, and the set started at ${QUALITY_FALLBACK}`);
        }
        if (held.record.quality !== levels[0]) {
          problems.push(`the set records ${held.record.quality} and its cards were drawn at ${levels.join('/')}`);
        }
        // And it let go. A set that held the level for good would leave a
        // player on the fallback whatever their machine measured.
        if (qualityHold()) problems.push(`the set finished and "${qualityHold()}" still holds the level`);
        if (appliedQuality() !== 'low') {
          problems.push(`the release left the game at ${appliedQuality()}, and auto had picked low`);
        }
        seen.push(`${ids.length} cards all at ${QUALITY_FALLBACK} with auto picking low in the middle of the set`
          + `, then the game at ${appliedQuality()}`);

        // The other half, which nothing above can prove: that the hold is what
        // made the set one level. A check that picks its own inputs owes the
        // suite the reading that says its subject is load-bearing (HANDOFF.md),
        // and this is the build H23 replaced, driven.
        if (ids.length < 2) {
          seen.push('one map registered, so there is no second card for the control to split');
        } else {
          SETTINGS.qualityAuto = null;
          syncQuality();
          const split = await bakeCards(h, gradientMap, 'low', true);
          const splitLevels = cardLevels(split, ids);
          if (new Set(splitLevels).size < 2) {
            problems.push(`with the hold dropped the set was still one level (${splitLevels.join('/')})`
              + ', so the hold is not what makes it one');
          }
          seen.push('with the hold dropped the same drive draws '
            + ids.map((id, i) => `${id} at ${splitLevels[i]}`).join(' and '));
        }

        // One holder at a time, and a release that catches up with what moved.
        SETTINGS.qualityAuto = null;
        syncQuality();
        if (!holdQuality('this check')) problems.push('an unheld level refused a hold');
        if (holdQuality('somebody else')) problems.push('the level took a second holder, and one release would drop both');
        const whileHeld = appliedQuality();
        SETTINGS.qualityAuto = 'high';
        if (syncQuality() !== null) problems.push('a held level reached for the knobs');
        if (appliedQuality() !== whileHeld) problems.push(`a held level moved from ${whileHeld} to ${appliedQuality()}`);
        releaseQuality();
        if (appliedQuality() !== 'high') {
          problems.push(`the release did not apply the level that moved under it (${appliedQuality()})`);
        }
        seen.push('one holder at a time, nothing applied while held, and the release applies what moved');
      } finally {
        putBack(h, was);
      }

      // This check draws frames at a level a player chose, so it resizes the
      // drawing buffer as `tests/quality.js` does, and it owes the same census:
      // thirteen pixel-reading modules run beside it and a botched put-back
      // should be loud where it happened.
      if (qualityHold()) problems.push(`left "${qualityHold()}" holding the level`);
      const after = qualityReadings();
      if (after.level !== before.level) problems.push(`left the game at ${after.level}, which was ${before.level}`);
      if (after.pixelRatio !== before.pixelRatio) problems.push(`left the pixel ratio at ${after.pixelRatio}, which was ${before.pixelRatio}`);
      if (String(after.buffer) !== String(before.buffer)) {
        problems.push(`left the buffer ${after.buffer.join('x')}, which was ${before.buffer.join('x')}`);
      }
      if (after.shadowMapSize !== before.shadowMapSize) {
        problems.push(`left the shadow map at ${after.shadowMapSize}, which was ${before.shadowMapSize}`);
      }
      if (after.post !== before.post) problems.push(`left the post ${after.post ? 'on' : 'off'}, which was ${before.post ? 'on' : 'off'}`);
      if (after.outlines.hidden !== before.outlines.hidden) {
        problems.push(`left ${after.outlines.hidden} outlines hidden, which was ${before.outlines.hidden}`);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${seen.join('; ')}; put back at ${after.level}, ${after.buffer.join('x')}`
          : problems.join('; '),
      };
    },
  });
}
