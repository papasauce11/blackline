/**
 * BLACKLINE - tests/nightvision.js
 *
 * AUTO suite (M1, D50): the Shade's night vision. `V` puts a screen effect on
 * her view - an exposure lift, a green cast, grain - and it costs the body
 * nothing. One check, three readings:
 *
 *   - **It lifts and it is green.** The same pose photographed with it off and
 *     on, through the lens every pixel check reads through: the frame's mean
 *     luma rises by a factor, and its mean green rises over its red and blue.
 *     A second pair with the post row off, and a third at the `low` preset,
 *     where `post.js` draws no post at all and the effect has to bring its own
 *     two draws (nightvision.js) - the same lift in each, because the player
 *     who chose `low` is the one who needs the dark lifted. With the post on,
 *     it is a stage of the composite and adds no pass; with it off, no pass.
 *   - **It costs her nothing.** The same seeded round run twice for a window
 *     of fixed steps with the Shade walking, once with the goggles on and once
 *     without: the meter's smoothed and raw readings, the Warden's detection
 *     accumulator, her health and the draws taken from the seeded stream are
 *     the same numbers at every step. Detection reads a map and a body, never
 *     a picture, and this holds it to that.
 *   - **It is off where it should be.** A second press turns it off and the
 *     picture is the unlifted one; behind the pause page and behind the
 *     briefing the picture is the unlifted one; a new round starts without it;
 *     and the Warden's key does nothing to a Warden in free roam. The HUD
 *     shows a tag while it is on and not otherwise.
 *
 * Read on whichever map the page is on. The floors are ratios and channel
 * means of one frame, so they are the buffer's own (TRAPS.md: a count scales
 * with the square of the buffer and a mean does not), and the pose is a lane
 * found on the map rather than a place named on it.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG, DEFAULT_BINDINGS, SETTINGS } from '../config.js';
import { activeQuality, pinQuality, postEnabled, syncQuality } from '../quality.js';
import { gatherHudState } from '../hudstate.js';
import { alongLane, clearLane, litLane } from './lanes.js';
import { createLens, meanLuma } from './pixels.js';

/**
 * The goggles' key, as the Input's own map has it. Pressed the way a player's
 * arrives, one step with the code down.
 */
const KEY = DEFAULT_BINDINGS.nightVision[0];

/**
 * The mean luma (0-255) of the frame with it on, over the same pose with it
 * off. Measured with `npm run probe` on the first clear lane of each map,
 * 1280x720 at `medium`, gain 4 and lift 0.03: the yard 2.96x (19.9 -> 58.8),
 * the plant 2.84x (21.9 -> 62.2), and over four lanes of each map 2.58x to
 * 4.05x; the post row off and `low` read the same to two figures. The floor
 * is 2.0x. The break (gain 1, lift 0, tint white) reads 1.1x.
 */
const LIFT_MIN = 2.0;

/**
 * How far the mean green must sit over the mean red and over the mean blue
 * with it on (channel means, 0-255). Measured on the same lanes: the yard
 * G-R 28.5 and G-B 22.8 (the least over four lanes: 25.6 and 20.5), the plant
 * G-R 29.7 and G-B 23.7. Off, the same differences read -4.8 to 6.3 over all
 * eight lanes. The floor is 12, just over half the least measured; the
 * break's white tint reads 0.
 */
const GREEN_MIN = 12;

/** A frame read twice of one unlifted pose agrees to well inside this (luma, 0-255): the grab advances nothing and the effect is off. */
const SAME_LUMA = 0.5;

/**
 * The seeded round the detection clause runs twice, and how many fixed steps it
 * watches (three seconds). The Shade starts on a lane the lamps light and walks
 * down it and out of the pool: probed on both maps the meter reads 34.2-57.8
 * on the yard and 43.5-84.4 on the plant over the window, and the plant's
 * Warden accumulates 10.9, so the two rounds have something to agree about.
 */
const SEED = 20261103;
const WINDOW = 180;
/** The lit lane the Shade is put on: metres of floor, and the distances down it that must read lit (`litLane`). */
const LANE = { length: 6, stands: [0, 3, 6] };

/** The channel means and the luma of one frame. */
function means(frame) {
  let r = 0;
  let g = 0;
  let b = 0;
  const n = frame.length / 4;
  for (let i = 0; i < frame.length; i += 4) {
    r += frame[i];
    g += frame[i + 1];
    b += frame[i + 2];
  }
  return { r: r / n, g: g / n, b: b / n, luma: meanLuma(frame) };
}

/** The player's press of the goggles' key: one step with the code down, then up. */
function press(h) {
  h.input.pressedCodes.add(KEY);
  h.stepFrames(1);
  h.input.pressedCodes.delete(KEY);
}

/** A fresh round for the Shade with the AI off, so nothing but the picture moves. */
function openRound(h) {
  h.initMatch({ mode: 'competitive', role: 'shade', ai: false, objective: false });
  h.menu.hide();
  h.briefing.hide();
  h.input.clearAll();
}

/**
 * One photographed pose: the lens on a lane, the frame's means and the post's
 * pass count, read with the goggles in whatever state they are in.
 */
function snap(h, lens) {
  const reading = means(lens.grab());
  return { ...reading, passes: h.post.passes };
}

/** The off and on readings of one pose, the goggles left ON; the lift, and what the green margins are. */
function pair(h, lens) {
  lens.grab();
  const off = snap(h, lens);
  press(h);
  const on = snap(h, lens);
  return { off, on, lift: on.luma / off.luma, gr: on.g - on.r, gb: on.g - on.b, offGr: off.g - off.r, offGb: off.g - off.b };
}

/** What a pair says is wrong with it, as sentences for the level it was read at. */
function pairProblems(what, p) {
  const out = [];
  if (!(p.lift >= LIFT_MIN)) out.push(`${what} lift ${p.lift.toFixed(2)}x (${p.off.luma.toFixed(1)}->${p.on.luma.toFixed(1)}), under ${LIFT_MIN}x`);
  if (!(p.gr >= GREEN_MIN && p.gb >= GREEN_MIN)) out.push(`${what} green +${p.gr.toFixed(1)} over red, +${p.gb.toFixed(1)} over blue, under ${GREEN_MIN}`);
  if (p.offGr >= GREEN_MIN || p.offGb >= GREEN_MIN) out.push(`${what} unlifted frame already green +${p.offGr.toFixed(1)}/+${p.offGb.toFixed(1)}`);
  return out;
}

/**
 * The Shade at the head of a lit lane, facing down it, and the meter seeded
 * from there. The one placement of a body in this check, and it is made before
 * the window and never read back: nothing here asks where she is.
 */
function standOnLitLane(h) {
  const lane = litLane(h, LANE.length, LANE.stands);
  if (!lane) return false;
  h.shade.reset({ position: alongLane(lane, 0), yaw: lane.yaw });
  h.detection.reset(h.shade);
  return true;
}

/**
 * One seeded round, the Shade walking down a lit lane for `WINDOW` steps, and
 * at every step the meter's two readings, the Warden's accumulator, her health
 * and the draws taken from the seeded stream since the round opened (the
 * counter itself is cumulative across rounds, which is history and not
 * behaviour). The goggles are pressed on at step 0 or not; the other round
 * steps once without a key, so both have taken the same number of steps.
 */
function watch(h, goggles) {
  h.initMatch({ mode: 'competitive', role: 'shade', ai: true, objective: true, seed: SEED });
  h.menu.hide();
  h.briefing.hide();
  h.input.clearAll();
  if (!standOnLitLane(h)) return null;
  const drawnAt = h.rng.drawn;
  if (goggles) press(h);
  else h.stepFrames(1);
  const forward = h.input.bindings.forward[0];
  h.input.heldCodes.add(forward);
  const series = [];
  for (let i = 0; i < WINDOW; i++) {
    h.stepFrames(1);
    series.push([h.detection.smoothed, h.detection.raw, h.wardenAI.accumulator, h.shade.health, h.rng.drawn - drawnAt]);
  }
  h.input.heldCodes.delete(forward);
  return { series, still: h.post.nightVision };
}

/** The first step at which two series disagree, or -1. */
function firstDifference(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return i;
  }
  return -1;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-shades-night-vision-lifts-the-dark-and-costs-her-nothing',
    spec: 'Section 4 / M1, D50',
    name: 'V puts the Shade\'s night vision on and off: the frame lifts and goes green with the post on, with the post row off and at the low preset (where post draws nothing), the HUD tags it, the same seeded round reads the same detection numbers on and off, and it is off behind the pause page and the briefing, in a new round and for a Warden',
    run: (h) => {
      const problems = [];
      const readings = [];
      const was = { quality: SETTINGS.quality, post: SETTINGS.post, auto: SETTINGS.qualityAuto };
      const level = activeQuality();
      const bodies = [h.shade.mesh, h.warden.mesh, h.shade.groundBlob, h.warden.groundBlob];
      const shown = bodies.map((body) => body.visible);
      const hide = () => bodies.forEach((body) => { body.visible = false; });
      let lens = null;
      try {
        // -------------------------------------------------------------------
        // 1. The post on: a stage of the composite. Lifted, green, no extra
        //    pass; a second press puts the picture back; the pause page, the
        //    briefing and a new round each show none.
        // -------------------------------------------------------------------
        openRound(h);
        const lane = clearLane(h, 12);
        if (!lane) return { pass: false, detail: `no clear lane on ${h.map.id} with 12m of floor to photograph` };
        const eye = { x: lane.x, y: lane.y + 1.6, z: lane.z };
        const at = { x: lane.x + lane.dx * 10, y: lane.y + 1.3, z: lane.z + lane.dz * 10 };
        lens = createLens(h);
        hide();
        lens.look(eye, at);
        SETTINGS.post = true;
        // At a level whose preset draws no post this pose is the effect's own
        // path, and the pass count says so (zero and one) instead of "none added".
        const drawsPost = postEnabled();
        const hud = h.hud;
        const hudTag = () => {
          hud.setVisible(true);
          hud.update(0, gatherHudState({
            match: h.match, shade: h.shade, warden: h.warden, gadgets: h.gadgets, detection: h.detection,
            combat: h.combat, objective: h.objective, post: h.post,
          }));
          return hud.root.querySelector('#bl-nv').style.display;
        };
        if (hudTag() !== 'none') problems.push('the HUD tags it before the key is pressed');

        const medium = pair(h, lens);
        problems.push(...pairProblems('post on', medium));
        if (!h.post.nightVision) problems.push(`${KEY} did not put it on`);
        if (drawsPost ? medium.on.passes !== medium.off.passes : (medium.off.passes !== 0 || medium.on.passes !== 1)) {
          problems.push(`passes ${medium.off.passes} off, ${medium.on.passes} on; a stage of the composite adds none, and with no post it is one`);
        }
        if (hudTag() !== 'block') problems.push('the HUD shows no tag while it is on');

        // A second press: off, and the picture is the unlifted one.
        press(h);
        const again = snap(h, lens);
        if (h.post.nightVision) problems.push(`a second ${KEY} did not turn it off`);
        if (Math.abs(again.luma - medium.off.luma) > SAME_LUMA) problems.push(`second press luma ${again.luma.toFixed(1)}, unlifted ${medium.off.luma.toFixed(1)}`);
        if (hudTag() !== 'none') problems.push('the HUD still tags it when off');

        // On again, then behind the pause page and behind the briefing: the
        // picture under a panel is the unlifted one.
        press(h);
        h.menu.show('pause');
        const paused = snap(h, lens);
        h.menu.hide();
        h.briefing.show({ match: h.match, round: 1, sites: h.map.sites, bindings: h.input.bindings, mapName: h.map.name });
        const briefed = snap(h, lens);
        h.briefing.hide();
        for (const [what, seen] of [['the pause page', paused], ['the briefing', briefed]]) {
          if (Math.abs(seen.luma - medium.off.luma) > SAME_LUMA) problems.push(`behind ${what} luma ${seen.luma.toFixed(1)}, unlifted ${medium.off.luma.toFixed(1)}`);
        }

        // A new round starts without it, whatever the last one left.
        if (!h.post.nightVision) problems.push('not on going into the new round');
        h.initMatch({ mode: 'competitive', role: 'shade', ai: false, objective: false });
        if (h.post.nightVision) problems.push('a new round started with it on');

        // -------------------------------------------------------------------
        // 2. The post row off, same pose: the effect draws the scene itself,
        //    two draws and only while it is on.
        // -------------------------------------------------------------------
        hide();
        lens.look(eye, at);
        SETTINGS.post = false;
        const rowOff = pair(h, lens);
        problems.push(...pairProblems('post row off', rowOff));
        if (rowOff.off.passes !== 0 || rowOff.on.passes !== 1) problems.push(`row off passes ${rowOff.off.passes} unlifted, ${rowOff.on.passes} lifted, not 0 and 1`);
        press(h);
        SETTINGS.post = was.post;
        if (lens.glError() !== 0) problems.push('GL error in the post and row-off reads');
        lens.restore();
        lens = null;

        // -------------------------------------------------------------------
        // 3. The low preset, the way tests/quality.js puts it up: its own
        //    buffer, and no post whatever the row says. Same pose, same lift.
        // -------------------------------------------------------------------
        pinQuality('');
        SETTINGS.post = true;
        SETTINGS.quality = 'low';
        syncQuality();
        if (postEnabled()) problems.push('low drew the post, so this reads nothing of the effect alone');
        openRound(h);
        lens = createLens(h);
        hide();
        lens.look(eye, at);
        const low = pair(h, lens);
        problems.push(...pairProblems('low', low));
        if (low.off.passes !== 0 || low.on.passes !== 1) problems.push(`low passes ${low.off.passes} unlifted, ${low.on.passes} lifted, not 0 and 1`);
        press(h);
        if (lens.glError() !== 0) problems.push('GL error in the low reads');
        lens.restore();
        lens = null;

        readings.push(`luma ${medium.off.luma.toFixed(1)}->${medium.on.luma.toFixed(1)} ${medium.lift.toFixed(2)}x, G-R ${medium.gr.toFixed(1)} G-B ${medium.gb.toFixed(1)}, row off ${rowOff.lift.toFixed(2)}x, low ${low.lift.toFixed(2)}x ${low.on.passes} pass; panel ${paused.luma.toFixed(1)}/${briefed.luma.toFixed(1)}`);
      } finally {
        if (lens) lens.restore();
        bodies.forEach((body, i) => { body.visible = shown[i]; });
        SETTINGS.quality = was.quality;
        SETTINGS.post = was.post;
        if (was.auto !== undefined) SETTINGS.qualityAuto = was.auto;
        pinQuality(location.search);
        syncQuality();
        h.menu.hide();
        h.briefing.hide();
      }
      if (activeQuality() !== level) problems.push(`quality went ${level} -> ${activeQuality()} and was not put back`);

      // ---------------------------------------------------------------------
      // 4. The Warden has no goggles: the key does nothing in free roam.
      // ---------------------------------------------------------------------
      h.initMatch({ mode: 'freeroam', role: 'warden', ai: false, objective: false });
      h.input.clearAll();
      press(h);
      if (h.post.nightVision) problems.push(`${KEY} put it on a Warden in free roam`);

      // ---------------------------------------------------------------------
      // 5. It costs her nothing: one seeded round, twice.
      // ---------------------------------------------------------------------
      const without = watch(h, false);
      const goggled = watch(h, true);
      if (!without || !goggled) {
        problems.push(`no lane on ${h.map.id} that the lamps light for ${LANE.length}m to watch the Shade walk`);
      } else {
        if (without.still) problems.push('it came on in the round that never pressed the key');
        if (!goggled.still) problems.push('it did not stay on through the watched window');
        const differs = firstDifference(without.series, goggled.series);
        if (differs !== -1) {
          problems.push(`step ${differs} reads ${JSON.stringify(without.series[differs])} without, ${JSON.stringify(goggled.series[differs])} with`);
        }
        const meter = without.series.map((row) => row[0]);
        const peak = Math.max(...meter);
        const floor = Math.min(...meter);
        const accumulated = Math.max(...without.series.map((row) => row[2]));
        if (!(peak - floor > 1)) problems.push(`the meter held ${floor.toFixed(1)}-${peak.toFixed(1)} over the window, so there is little to agree about`);
        readings.push(`${WINDOW} steps the same on and off, meter ${floor.toFixed(1)}-${peak.toFixed(1)}, accumulator ${accumulated.toFixed(1)}`);
      }

      h.input.clearAll();
      h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
      return {
        pass: problems.length === 0,
        detail: `${problems.length ? `${problems.join('; ')} [` : ''}${readings.join('; ')}${problems.length ? ']' : ''}`,
      };
    },
  });
}
