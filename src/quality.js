/**
 * BLACKLINE — quality.js
 *
 * Quality presets (H10): low / medium / high / auto over the five things that
 * actually cost a frame — the shadow map, the resolution, the post, the
 * particle counts and the outline pass — and a probe that picks one from what
 * this machine's own frames measured.
 *
 * **`medium` is exactly what the game drew before there were presets**, knob
 * for knob: a 1024 shadow map, the device's own pixel ratio, full particle
 * counts, outlines on, post on. Every reading on record was taken against
 * those numbers — the 92-viewpoint sweep, the thirteen pixel-reading test
 * modules, every screenshot — and a preset table that quietly moved one of
 * them would recalibrate the lot. `the-medium-preset-is-what-the-game-drew-
 * before-there-were-presets` pins each one to the constant it came from, the
 * same discipline H9 used to keep `fovShade`/`fovWarden` at `CONFIG.render.fov`.
 *
 * **What the probe picks and what the game applies are two different things,
 * on purpose.** The probe is a reading about this machine: it is always taken
 * and always recorded (`debugState.quality`, and the headless runner's own run
 * record). What is *applied* is `activeQuality()`, which answers the URL's
 * `?quality=` pin first, the player's setting second, and the probe's pick only
 * where the player asked for `auto`. That separation is what made this job
 * buildable at all. Under software WebGL a frame costs ~400ms, so the probe
 * picks `low` here every single time, deterministically — and a gate that then
 * ran with the post off, the outlines off and the resolution at 0.7 would turn
 * thirteen pixel-reading modules red for a reason with nothing to do with the
 * game. Not flaky, which is worse. So `scripts/suite.mjs` pins `quality=medium`
 * and the probe still records the `low` it would have chosen.
 *
 * **The applied level is asserted every frame, not set once.** `syncQuality()`
 * runs from `renderFrame` and reaches for the knobs only when `activeQuality()`
 * has moved, exactly as `cameraOwner.applyFov()` asserts the field of view
 * (H9). One decision in one place, and it is what makes the quality row safe:
 * a check that cycles the settings rows and puts `SETTINGS` back gets the
 * picture back on the next frame rather than leaving every check after it
 * drawing at whatever the row landed on.
 *
 * **And once in a page's life it is asked to stand still** (H23): something
 * drawing a *set* of pictures that must all be one level takes
 * `holdQuality()`, and `syncQuality` applies nothing until the release. The
 * one caller is the menu's cards; see `hold` below for why that is the fix and
 * not a waiting room.
 *
 * Layering (Section 3.1): imports config only, as `settingsstore.js` and
 * `version.js` do, so anything may reach it — `view.js` for the pixel ratio and
 * `systems/effects.js` for the particle counts both do.
 */

import { CONFIG, SETTINGS } from './config.js';

const Q = CONFIG.quality;

/** The preset names, in the order the settings row cycles them. */
export const QUALITY_LEVELS = Object.keys(Q.presets);

/** Everything the row and `?quality=` accept. `auto` is a way of choosing, not a preset. */
export const QUALITY_CHOICES = [...QUALITY_LEVELS, 'auto'];

/**
 * What `auto` draws at before its probe has answered, and what a name this
 * build does not have falls back to. Medium, because medium is the picture
 * every measurement on record was taken against: an unknown machine gets the
 * game as it has always been drawn and not a guess.
 */
export const QUALITY_FALLBACK = 'medium';

/** The live objects the knobs are on. Set once by `installQuality` at boot. */
const live = { renderer: null, post: null, scene: null, map: null, debugState: null, onProbed: null };

/** `?quality=` for this page load, or null. The URL wins over every setting. */
let pinned = null;

/** What is applied, why, and what the probe read. Published on `debugState.quality`. */
const state = { applied: null, from: 'nothing applied yet', pin: null, probe: null };

/** The probe, or null once it has answered. */
let probe = null;

/**
 * Who is holding the applied level still, or null (H23).
 *
 * The level in force keeps moving underneath a hold - a probe that answers
 * writes `SETTINGS.qualityAuto`, a player can still cycle the row - and the
 * first frame after the release applies whatever the answer is by then.
 * Nothing is remembered and nothing is refused; only the moment of applying
 * is deferred.
 *
 * It exists for one thing. The menu's cards (`thumbnails.js`) are a **set** of
 * pictures drawn one task apart, and on a first boot `auto`'s probe answers
 * eighteen frames in - which is about one card - so without this the first card
 * is drawn at the fallback and its neighbour at whatever the probe picked. Of
 * the two ways to stop that, holding the level is the cheaper and is the one a
 * player would rather have: the cards arrive now, at the level they are about
 * to play at, rather than the strip staying empty until a probe has finished
 * measuring.
 *
 * Not nestable, deliberately. Two holders and one release is a page stuck at
 * whatever level the menu happened to open at, so a second `holdQuality` is
 * refused rather than counted, and the check holds that.
 */
let hold = null;

/**
 * Does this URL query pin a quality level? `?quality=medium`, the way
 * `debugRequested` reads `?debug=1`. An unknown name is no pin rather than an
 * error: a typo must not silently become a level.
 *
 * @param {string} search
 * @returns {string|null}
 */
export function requestedQuality(search) {
  const query = typeof search === 'string' ? search : '';
  const match = /(?:^|[?&])quality=([a-z]+)(?:&|$)/.exec(query);
  if (!match) return null;
  return QUALITY_CHOICES.indexOf(match[1]) === -1 ? null : match[1];
}

/**
 * Read the pin off the URL, before the renderer is built — so a pinned page
 * makes its drawing buffer the right size once rather than resizing it a
 * moment later. Nothing is written to `SETTINGS`: a pin belongs to a page
 * load, and a pin that persisted would outlive the URL that asked for it.
 *
 * @param {string} search
 * @returns {string|null} the pin
 */
export function pinQuality(search) {
  pinned = requestedQuality(search);
  state.pin = pinned;
  // H24: the pin is part of what is published, because it is half of
  // `qualitySource()` - so moving it has to republish even though no knob
  // turned. Without this, a check that took the pin down and put it back left
  // `debugState.quality` naming the state it had in the middle, and the headless
  // runner copies that record into its own: the first suite run at `?quality=
  // high` reported "auto, from the probe" while drawing a pinned `high`,
  // because `syncQuality()` had nothing to apply on the way back and so never
  // published. A record that is only true when something moved is worse than no
  // record.
  publish();
  return pinned;
}

/** The level actually in force: the pin, then the player's choice, then the probe's. */
export function activeQuality() {
  const wanted = pinned ?? SETTINGS.quality;
  if (QUALITY_LEVELS.indexOf(wanted) !== -1) return wanted;
  const picked = SETTINGS.qualityAuto;
  return QUALITY_LEVELS.indexOf(picked) !== -1 ? picked : QUALITY_FALLBACK;
}

/**
 * The level the live objects are actually at, which is not always the one in
 * force: a hold is up, or nothing has been applied yet. This is the honest
 * answer to "what was that frame drawn at", and what a menu card records (H23).
 */
export function appliedQuality() {
  return state.applied;
}

/**
 * Hold the applied level still until `releaseQuality`. False if something
 * already holds it, which is not an error to recover from but a bug to report:
 * see the note on `hold`.
 *
 * @param {string} reason who is holding it, for the report
 * @returns {boolean} whether this call is now the holder
 */
export function holdQuality(reason) {
  if (hold) return false;
  hold = reason;
  publish();
  return true;
}

/**
 * Drop the hold and apply whatever the answer is now, in one frame's worth of
 * work rather than waiting for the next frame to notice.
 *
 * @returns {object|null} the readings, if the level had moved under the hold
 */
export function releaseQuality() {
  if (!hold) return null;
  hold = null;
  const applied = syncQuality();
  // `applyQuality` publishes; nothing moved means nothing published, and the
  // record would still say the level was held.
  if (!applied) publish();
  return applied;
}

/** What is holding the level still, or null. */
export function qualityHold() {
  return hold;
}

/** Where the level came from, for the report: the URL, the player, auto, or the fallback. */
export function qualitySource() {
  if (pinned) return `?quality=${pinned}`;
  if (QUALITY_LEVELS.indexOf(SETTINGS.quality) !== -1) return 'the settings row';
  if (QUALITY_LEVELS.indexOf(SETTINGS.qualityAuto) !== -1) return 'auto, from the probe';
  return `auto, not yet measured (${QUALITY_FALLBACK})`;
}

/** The row of knobs for a level. */
export function qualityPreset(level = activeQuality()) {
  return Q.presets[level] ?? Q.presets[QUALITY_FALLBACK];
}

/**
 * The pixel ratio the renderer should be at: the device's own, scaled by the
 * preset, still capped by `render.maxPixelRatio`. The cap is why `high` changes
 * nothing on a 2x display — 2 x 1.25 and 2 x 1 both land on 1.75 — which is
 * worth saying rather than pretending the slider does something there.
 *
 * @param {number} [deviceRatio] the display's, for a check that wants to ask
 *   about a display this machine is not
 */
export function pixelRatioNow(deviceRatio) {
  const dpr = deviceRatio ?? (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
  return Math.min(dpr * qualityPreset().resolutionScale, CONFIG.render.maxPixelRatio);
}

/**
 * A particle count, scaled by the preset. Never below one: a spark burst of
 * nothing is a bullet that hit nothing, and `low` is meant to cost less rather
 * than to say less.
 */
export function qualityParticles(count) {
  return Math.max(1, Math.round(count * qualityPreset().particleScale));
}

/**
 * Is the post drawn? The player's row **and** the preset (D60), not the preset
 * writing the row: `low` turns the bloom off whatever the row says, and the row
 * is still what the player chose when they come back up to `medium`.
 *
 * The alternative was a preset that assigned `SETTINGS.post` when a level was
 * chosen, and it is worse in every direction - the row's label goes stale until
 * something re-renders it, the two settings can disagree about which is in
 * charge, and applying a level would write to a player's stored record. This
 * way `applyQuality` touches no setting at all, which is what makes a check
 * that cycles the settings rows and puts `SETTINGS` back cost nothing.
 */
export function postEnabled() {
  return !!SETTINGS.post && qualityPreset().post;
}

/**
 * The one shadow caster's map (Section 4.1). three sizes the depth target from
 * `mapSize` the first time it draws the light and never looks again, so the old
 * target has to be disposed and dropped for a new size to take.
 */
function setShadowMap(light, size) {
  if (light.shadow.mapSize.x === size && light.shadow.mapSize.y === size) return;
  light.shadow.mapSize.set(size, size);
  if (light.shadow.map) {
    light.shadow.map.dispose();
    light.shadow.map = null;
  }
}

/**
 * The inverted-hull outlines (Section 4), which are exactly two things: the
 * map's `outlines` group (mapkit.js) and the hull child inside every part of
 * both figures (entities/parts.js). Each carries `userData.isOutline`, so this
 * is a traverse and a flag rather than a hunt for `side: BackSide` materials —
 * and an outline added later joins by saying what it is.
 */
function setOutlines(scene, visible) {
  scene.traverse((object) => {
    if (object.userData && object.userData.isOutline) object.visible = visible;
  });
}

/**
 * Apply a level to the live objects. Called by `syncQuality` when the answer
 * has moved, by `installQuality` at boot, and by the check with an explicit
 * level.
 *
 * @param {string} [level]
 * @param {string} [from] what asked, for the report
 */
export function applyQuality(level = activeQuality(), from = qualitySource()) {
  const name = QUALITY_LEVELS.indexOf(level) !== -1 ? level : QUALITY_FALLBACK;
  const preset = Q.presets[name];
  state.applied = name;
  state.from = from;
  if (live.renderer) {
    live.renderer.setPixelRatio(pixelRatioNow());
    // The CSS size the canvas already has, so the drawing buffer follows the
    // ratio and the element does not move. A viewport reporting zero is left
    // alone for the reason `resizeView` leaves it alone: taking it at face
    // value latches a 0x0 buffer and the game draws nothing until some later
    // resize rescues it.
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (width > 0 && height > 0) live.renderer.setSize(width, height, false);
    // The post's targets follow the drawing buffer, and it reallocates only
    // when the size actually moved (post.js).
    if (live.post) live.post.setSize();
  }
  if (live.map && live.map.keyLight) setShadowMap(live.map.keyLight, preset.shadowMapSize);
  if (live.scene) setOutlines(live.scene, preset.outlines);
  publish();
  return qualityReadings();
}

/**
 * The F3 bag, and through it the headless runner's own run record. Written when
 * something moved rather than every frame: a fresh object sixty times a second
 * for a line nothing reads between changes is an allocation Section 15 has no
 * use for.
 */
function publish() {
  if (live.debugState) live.debugState.quality = qualityState();
}

/**
 * Assert the applied level every frame, and reach for a knob only when it has
 * moved — a string compare per frame. Called from `renderFrame` before the
 * draw, so the frame is drawn at whatever the answer is now.
 *
 * Unless something is holding it (H23), in which case this is the frame that
 * does not move the picture — which is the whole of what a hold is.
 */
export function syncQuality() {
  if (hold) return null;
  const want = activeQuality();
  if (want === state.applied) return null;
  return applyQuality(want);
}

/**
 * What a level actually came out as, measured off the live objects rather than
 * read back out of the table. That difference is the lesson `tests/settings.js`
 * opens with: a setting that moves a field and a label is indistinguishable
 * from one that works.
 */
export function qualityReadings() {
  const canvas = live.renderer ? live.renderer.domElement : null;
  let shown = 0;
  let hidden = 0;
  if (live.scene) {
    live.scene.traverse((object) => {
      if (!object.userData || !object.userData.isOutline) return;
      if (object.visible) shown++; else hidden++;
    });
  }
  return {
    level: state.applied,
    from: state.from,
    pin: state.pin,
    pixelRatio: live.renderer ? live.renderer.getPixelRatio() : null,
    // The canvas's backing store *is* the drawing buffer, so this needs no
    // Vector2 to ask and no three import to hold one.
    buffer: canvas ? [canvas.width, canvas.height] : null,
    shadowMapSize: live.map && live.map.keyLight ? live.map.keyLight.shadow.mapSize.x : null,
    post: postEnabled(),
    postRow: !!SETTINGS.post,
    impactSparks: qualityParticles(CONFIG.effects.impactSparks),
    outlines: { shown, hidden },
  };
}

/**
 * The frame-time probe.
 *
 * **What it measures is the CPU cost of a frame** (`debugState.cpuMs`, the
 * clock around `post.render`), so it is judged against the CPU's share of the
 * budget and not the whole frame's - `performance.cpuBudgetFraction`, which
 * exists in config.js for exactly this reason: integrated graphics are usually
 * GPU-bound, so a CPU frame that eats most of the budget on a dev machine will
 * miss on a player's. Reading a CPU number against a GPU-inclusive budget is
 * the mistake that constant is there to prevent, and this probe would have made
 * it. The first headless run measured **6.30ms median** and picked `high` off
 * the full 16.67ms; against the 8.33ms a CPU frame is allowed it picks
 * `medium`, which is what a software renderer queueing a third of its work for
 * later actually deserves. `the-quality-probe-picks-the-level-its-frame-times-
 * ask-for` feeds it a median between the two budgets and requires `low`, so the
 * probe is pinned to the right constant rather than to a number that agrees.
 *
 * It draws nothing of its own: it watches frames the game was drawing anyway,
 * which is what keeps it off the boot H4 measured and inside the 60 seconds the
 * headless runner allows a page to load. A probe that rendered two seconds of
 * its own frames on a cold renderer would be timing a shader compile — the
 * first draw of a view this renderer has not seen costs tens of seconds
 * headless — and boot would have had to wait for it.
 *
 * `warmFrames` are discarded for the same reason, so what is left is the
 * steady-state cost of a frame. The **median** is taken and not the mean: one
 * frame that stalled on a collection or a pipeline build is a frame, not a
 * machine.
 *
 * It stops at two seconds of measured frame cost or `maxFrames` samples,
 * whichever comes first — and `maxFrames` is under the runner's 60 warm-up
 * frames on purpose, so the pick is in the run's record by the time the first
 * check runs.
 */
export function createQualityProbe(config = Q.probe) {
  const samples = [];
  let skipped = 0;
  let costMs = 0;
  return {
    get samples() {
      return samples.length;
    },
    get skipped() {
      return skipped;
    },
    get done() {
      return samples.length >= config.minFrames
        && (costMs >= config.budgetMs || samples.length >= config.maxFrames);
    },
    /** One frame's cost in milliseconds, as `debugState.cpuMs` measures it. */
    sample(ms) {
      if (this.done || !(ms >= 0)) return;
      if (skipped < config.warmFrames) { skipped++; return; }
      samples.push(ms);
      costMs += ms;
    },
    /** The middle sample, or null while there are none. */
    get medianMs() {
      if (samples.length === 0) return null;
      const sorted = [...samples].sort((a, b) => a - b);
      return sorted[sorted.length >> 1];
    },
    /** The CPU budget a frame is allowed, which is what these samples measured. */
    get budgetMs() {
      return CONFIG.performance.frameBudgetMs * CONFIG.performance.cpuBudgetFraction;
    },
    /** The level these frame times ask for. */
    get pick() {
      const median = this.medianMs;
      if (median === null) return null;
      const budget = this.budgetMs;
      if (median <= budget * config.highFraction) return 'high';
      if (median <= budget * config.mediumFraction) return 'medium';
      return 'low';
    },
    /** What the report carries. */
    reading() {
      const median = this.medianMs;
      return {
        pick: this.pick,
        medianMs: median === null ? null : Math.round(median * 100) / 100,
        samples: samples.length,
        skipped,
        why: median === null
          ? 'no frames measured'
          : `${median.toFixed(2)}ms median CPU over ${samples.length} frames, against the ${this.budgetMs.toFixed(2)}ms a CPU frame is allowed`,
      };
    },
  };
}

/**
 * One frame's cost, handed to the probe. Called from `renderFrame` after the
 * draw, with the number the F3 overlay and the frame-budget check already use.
 *
 * The probe's pick is **recorded whatever is applied**, so a report always says
 * what this machine would have chosen. It is *remembered* only on the first
 * boot of a browser that has never measured — after that a load applies the
 * stored pick without spending two seconds finding it again — and it is only
 * *applied* by `syncQuality`, which answers the pin and the player's row first.
 *
 * @param {number} ms
 */
export function sampleQualityFrame(ms) {
  if (!probe) return;
  probe.sample(ms);
  if (!probe.done) return;
  state.probe = probe.reading();
  probe = null;
  if (SETTINGS.qualityAuto === null && QUALITY_LEVELS.indexOf(state.probe.pick) !== -1) {
    SETTINGS.qualityAuto = state.probe.pick;
    if (live.onProbed) live.onProbed();
  }
  publish();
}

/** What `debugState.quality` carries, and the run record with it. */
export function qualityState() {
  return { ...qualityReadings(), source: qualitySource(), hold, probe: state.probe };
}

/**
 * Hand over the live objects and apply the level in force, at the end of the
 * bake — the map's light exists by then and so do both figures' hulls, which
 * is what an outline traverse needs to find.
 *
 * @param {object} parts
 * @param {() => void} [parts.onProbed] save the settings once auto has picked
 */
export function installQuality({ renderer, post, scene, map, debugState = null, onProbed = null }) {
  live.renderer = renderer;
  live.post = post;
  live.scene = scene;
  live.map = map;
  live.debugState = debugState;
  live.onProbed = onProbed;
  probe = createQualityProbe();
  // A fresh install is a fresh set of live objects, so nothing may still be
  // holding the level over them (H23).
  hold = null;
  return applyQuality();
}

