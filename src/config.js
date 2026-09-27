/**
 * BLACKLINE — config.js
 *
 * Single source of truth for every tuning number in the game.
 * This module imports NOTHING (Section 3.1 layering rule).
 *
 * Rules enforced here:
 *  - No magic numbers anywhere else in src/. If a number matters, it lives here.
 *  - Math.random() must not appear anywhere in src/. All randomness goes
 *    through the seeded `rng` exported below (Section 2, Section 15).
 *
 * Section references in comments point at BLACKLINE_SPEC.md.
 */

// ---------------------------------------------------------------------------
// Debug gate (Section 17.1, amended - 20.12, C1). The F3 overlay, the F4
// panel and every test-mode key are inert unless `SETTINGS.debug` is true.
// It is OFF by default - a playtest build is what you get by opening the
// page - and `?debug=1` on the URL or the settings menu's "debug tooling"
// row turns it on. The live value is `SETTINGS.debug`, below with the other
// settings; `CONFIG.settings.defaults.debug` is only its seed. The AUTO
// suite turns it on for the length of a run (`ui/autosuite.js`), so the
// harness works whichever way the page was opened.
// ---------------------------------------------------------------------------

/** Does this URL query ask for the debug tooling? `?debug=1` or `debug=true`. */
export function debugRequested(search) {
  const query = typeof search === 'string' ? search : '';
  return /(?:^|[?&])debug=(?:1|true)(?:&|$)/.test(query);
}

// ---------------------------------------------------------------------------
// Seeded PRNG (Section 2, Section 15)
//
// mulberry32. One generator for the whole codebase. The seed is set at match
// start and surfaced in the F3 overlay so any bug can be reproduced.
// ---------------------------------------------------------------------------

const MULBERRY_INC = 0x6d2b79f5;
const MULBERRY_DIV = 4294967296;
const DEFAULT_SEED = 0x424c4b4c; // "BLKL"

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + MULBERRY_INC) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / MULBERRY_DIV;
  };
}

const rngState = {
  seed: DEFAULT_SEED,
  next: mulberry32(DEFAULT_SEED),
  calls: 0,
};

export const rng = {
  /** Re-seed the generator. Called once per match from initMatch(). */
  reseed(seed) {
    const s = (seed >>> 0) || DEFAULT_SEED;
    rngState.seed = s;
    rngState.next = mulberry32(s);
    rngState.calls = 0;
    return s;
  },

  /** Current seed, for the debug overlay and the scoreboard. */
  get seed() {
    return rngState.seed;
  },

  /** How many values have been drawn. Determinism canary. */
  get calls() {
    return rngState.calls;
  },

  /** Float in [0, 1). */
  next() {
    rngState.calls++;
    return rngState.next();
  },

  /** Float in [min, max). */
  range(min, max) {
    return min + (max - min) * rng.next();
  },

  /** Integer in [min, max] inclusive. */
  int(min, max) {
    return min + Math.floor(rng.next() * (max - min + 1));
  },

  /** Uniform element from a non-empty array. */
  pick(array) {
    return array[Math.floor(rng.next() * array.length)];
  },

  /** True with probability p. */
  chance(p) {
    return rng.next() < p;
  },

  /** -1 or +1. */
  sign() {
    return rng.next() < 0.5 ? -1 : 1;
  },

  /** Float in [-1, 1). */
  unit() {
    return rng.next() * 2 - 1;
  },

  /**
   * Fisher-Yates shuffle, in place, using the seeded stream.
   * Used for the randomised patrol circuit (Section 11).
   */
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const tmp = array[i];
      array[i] = array[j];
      array[j] = tmp;
    }
    return array;
  },
};

/**
 * The seed `?seed=<n>` names in a query string, or null when it names none.
 * Split out of deriveSeed so tests/seeds.js can tell "no seed in the URL" from
 * "a seed of zero" without keeping a second copy of the pattern.
 */
export function seedInQuery(search) {
  const query = typeof search === 'string' ? search : '';
  const match = /(?:^|[?&])seed=(\d+)/.exec(query);
  return match ? parseInt(match[1], 10) >>> 0 : null;
}

/**
 * Derive a match seed. Prefers ?seed=<n> in the URL so a human can reproduce a
 * reported bug (Section 16 check 28), otherwise time-derived.
 * Deliberately not Math.random().
 */
export function deriveSeed(search) {
  const named = seedInQuery(search);
  return named === null ? Date.now() >>> 0 : named;
}

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

export const CONFIG = {
  // -------------------------------------------------------------------------
  // Timing (Section 15: fixed timestep at 60Hz with an accumulator)
  // -------------------------------------------------------------------------
  time: {
    /** Fixed physics step. Never integrate with a raw frame delta. */
    fixedDt: 1 / 60,
    /** Frame deltas above this are clamped (tab-switch, breakpoint, GC hitch). */
    maxFrameDelta: 0.25,
    /** Hard cap on physics steps per frame. Prevents the spiral of death. */
    maxStepsPerFrame: 5,
    /** F4 "T" cycles through these (Section 17.1). */
    timeScaleCycle: [1, 0.25, 4],
  },

  // -------------------------------------------------------------------------
  // Renderer and art direction (Section 4, Section 4.1)
  // -------------------------------------------------------------------------
  render: {
    fov: 70,
    near: 0.1,
    far: 160,
    /** Capped so integrated graphics are not asked to draw a 4K buffer. */
    maxPixelRatio: 1.75,
    antialias: true,
    /** Toon shading is destroyed by filmic tone mapping. Keep it off. */
    toneMappingExposure: 1.0,
    clearColor: 0x0a0d10,
    fogColor: 0x0a0d10,
    /** Exponential, low density (Section 4). */
    fogDensity: 0.018,
    /** Section 4.1: exactly one shadow-casting light, 1024x1024. */
    shadowMapSize: 1024,
    shadowBias: -0.0006,
    shadowNormalBias: 0.02,
    /**
     * Tight frustum fitted to the play area (Section 4.1). Sized to the v2 site
     * (80 x 65 exterior, 11m tall) rather than the building alone, or the
     * approach apron and the fire escape fall outside the shadow map.
     */
    shadowFrustum: { left: -52, right: 52, top: 46, bottom: -46, near: 1, far: 150 },
    /** Section 4: 4-step gradient map generated in code via DataTexture. */
    toonSteps: 4,
    /** Section 4: inverted-hull outline scale. */
    outlineScale: 1.03,
    /**
     * Post-processing (E6, D10): a bloom on the emissives and a vignette,
     * `SETTINGS.post` the switch (post.js). The bright pass keeps what is
     * over `bloomThreshold` of linear luma - the route-lit stages and the
     * lamp fixtures read 0.75-0.8 linear, a floor under a lamp 0.13 - and
     * the blur is `blurPasses` separable Gaussians at half size, added
     * back at `bloomStrength`. The vignette falls from nothing at
     * `vignetteInner` of the half-diagonal to `vignetteStrength` off at
     * `vignetteOuter`. `samples` is the scene target's multisampling, the
     * canvas's antialias carried over. Costs the same at every quality
     * level (D10), so the switch is the player's; the frame-budget check
     * on a real GPU is where the budget clause is answered. Argued under
     * D46.
     */
    post: {
      samples: 4,
      bloomThreshold: 0.5,
      bloomStrength: 0.8,
      blurPasses: 2,
      vignetteInner: 0.55,
      vignetteOuter: 1.25,
      vignetteStrength: 0.3,
    },
    /** The layer the feedback quad draws on, over the post-processed frame (E6). */
    overlayLayer: 1,
  },

  // -------------------------------------------------------------------------
  // Palette (Section 4). Faction teal / hazard orange / concrete grey.
  //
  // The material language (B6, Section 5 amended): concrete is structure you
  // do not pass through - walls, floors, the deck, the ground. Metal is what
  // you pass through or climb - ducts in galvanised sheet, gantries, lips and
  // the fire escape in gunmetal. A duct says it is passable by being visibly
  // not the wall it goes through; nothing is painted on it to say so.
  // -------------------------------------------------------------------------
  palette: {
    shadeTeal: 0x2fd6c3,
    shadeCharcoal: 0x232a30,
    wardenOrange: 0xf07a25,
    wardenGunmetal: 0x4a5158,
    /** Blued steel (E2): the Warden's rifle and visor, darker than the gunmetal so the weapon reads against the vest. */
    wardenSteel: 0x1b1e21,
    concrete: 0x6b7076,
    concreteDark: 0x3d4247,
    /** Galvanised sheet: the ducts. Light and cool against every concrete. */
    ductMetal: 0xc6d0d6,
    hazardOrange: 0xf28c1a,
    hazardStripe: 0x1c1f22,
    signageTeal: 0x2fd6c3,
    outline: 0x08090b,
    ambientSky: 0x33414d,
    ambientGround: 0x14181c,
    lightWarm: 0xffe6bd,
    lightCool: 0xbfd9ff,
    brokenGlass: 0x191c1f,
    /** Glazing (D3): the walkway's panes, pale and cool, drawn translucent. */
    glass: 0xa9d6e8,
  },

  // -------------------------------------------------------------------------
  // Shade — human player, third person (Section 6.1)
  // -------------------------------------------------------------------------
  shade: {
    health: 100,
    lives: 3,
    /** Capsule dimensions. Radius drives the swept AABB half-extents. */
    radius: 0.34,
    standHeight: 1.85,
    crouchHeight: 1.05,
    /** Slide and vent-crawl height. Section 6.1: slide lowers to vent height. */
    slideHeight: 0.85,
    eyeHeightRatio: 0.92,

    walkSpeed: 3.5,
    crouchSpeed: 1.6,
    sprintSpeed: 6.5,
    jumpSpeed: 4.5,

    /** Ground and air handling. */
    groundAccel: 42,
    airAccel: 9,
    groundFriction: 11,
    airDrag: 0.4,
    gravity: -22,
    /** Terminal fall speed, keeps the swept solver well conditioned. */
    maxFallSpeed: 45,
    /** Grace window after leaving ground where a jump still registers. */
    coyoteTime: 0.11,
    /** Jump buffered this long before landing still fires. */
    jumpBuffer: 0.12,
    /** Max step-up height handled silently without a vault. */
    stepHeight: 0.32,

    /**
     * Reach (Section 6.1, amended). What the Shade can climb is a property of
     * its body, not of three authored height bands.
     *
     * The bands were `vault 0.4-1.2 / mantle 1.2-2.4 / hang 2.4-4.2`, and they
     * decided BOTH what was possible and what the map painted a stripe on. With
     * the markings gone the map has to explain itself, so the only question
     * left is the honest one: can this body get up there?
     *
     * Athletic, and a jump extends it. Standing, the Shade mantles anything up
     * to `standing`; at the apex of a jump it gets `jumpBonus` more. A rise
     * under `stepOver` is not a climb at all, the solver just carries it.
     *
     * The consequence worth knowing: 6m is the upper deck and 4.5m is the site
     * fence, so both stay out of reach and the vertical layout still enforces
     * the one-way routes that `noClimb` used to fake.
     */
    reach: {
      standing: 2.6,
      jumpBonus: 1.2,
      stepOver: 0.32,
      /**
       * At or below this it reads as a vault - you plant a hand and swing
       * over. Above it you pull yourself up. Chest height on a 1.85m body,
       * which puts the classic 1.0m crate on the vault side where it
       * belongs; at 0.95 it read as a mantle and felt wrong.
       */
      vaultTop: 1.15,
    },
    /** Above this cosine the surface counts as ground, not wall. */
    groundNormalY: 0.6,

    /** Vault: obstacles 0.4m to 1.2m, sprint + forward into a flagged ledge. */
    vaultMinHeight: 0.4,
    vaultMaxHeight: 1.2,
    vaultReach: 1.1,
    /**
     * Momentum carries into a vault (B8). The duration slides from
     * `vaultDuration` at a walk (and below) to `vaultDurationAtSprint` at
     * `sprintSpeed`, and the body leaves with `vaultCarry` of the speed it
     * arrived with - never less than `vaultExitSpeed`, never more than a
     * sprint. A vault taken at a walk is exactly what it was.
     */
    vaultDuration: 0.42,
    vaultDurationAtSprint: 0.28,
    vaultCarry: 0.85,
    vaultExitSpeed: 4.2,

    /** Mantle: the climb over a ledge above vault height. Starts with a grab; see hangGrabDuration. */
    mantleMinHeight: 1.2,
    mantleMaxHeight: 2.4,
    mantleReach: 0.95,
    mantleDuration: 0.62,
    /** Headroom required above the destination before the move commits. */
    mantleClearance: 0.12,

    /** Slide: from sprint + crouch, 8.0 m/s decaying over 0.8s. */
    slideSpeed: 8.0,
    slideDuration: 0.8,
    /**
     * How far short of a vent mouth a slide has to start to carry you in. A
     * duct is crouch-height, so a standing sprint at one stops dead against the
     * wall above it.
     */
    slideLead: 2.5,
    /** Sprint speed must be at least this to start a slide. */
    slideMinEntrySpeed: 5.2,
    slideCooldown: 0.5,

    /**
     * Ledge hang (Section 6.1, amended 20.3). Every mantle-height climb starts
     * with a GRAB: a short reach to hanging position below the lip. Tap Space
     * and you stay there; hold it and the body carries on over. The grab's
     * duration is therefore the tap window — a key still down when it ends is
     * a hold. Longer than a human tap (about 0.1s), shorter than reads as a
     * pause.
     */
    hangGrabDuration: 0.18,
    /**
     * How long Space has to stay down AFTER the hand lands before a key held
     * through the grab counts as a hold. The grab starts on the step the key
     * goes down, so grab + this is the tap window from key-down: 0.30s. With
     * the grab alone as the window a 250ms tap went over (Josh, 2026-09-17,
     * "tap to hang not working"). A fresh press from a settled hang ignores
     * this and pulls up at once.
     */
    hangHoldDelay: 0.12,
    /**
     * Josh: "shouldn't be able to hang on anything shorter than 1.4x the height
     * of the shade from the vault position." A ledge lower than this many
     * Shade-heights above the surface the climb started on is not grabbed; it
     * goes straight over. 1.4 × 1.85 = 2.59m, so a hang is for a ledge you had
     * to jump for.
     */
    hangMinHeightRatio: 1.4,
    hangMaxHeight: 4.2,
    hangReach: 0.85,
    /**
     * Feet below the grabbed edge while hanging. The hanging body sits at
     * full stretch, arms straight up and the gloves on the lip (B8): on this
     * rig the hands are 2.08m above the feet with the arms raised, so the
     * capsule's top is 0.2m UNDER the lip and a lip with a gantry 0.3m over
     * it (hall-container's south face) can be hung from - the pull-up is
     * what the gantry blocks, and it scuffs. At 1.35 the capsule stood 0.5m
     * proud of the lip, and that face went over instead, or nowhere.
     */
    hangDrop: 2.05,
    /** The pull is a body-length now, so it takes a little longer. */
    hangPullUpDuration: 0.65,
    /**
     * A settled hang ignores everything but Space for this long, so a crouch
     * still held from a crouch-jump does not let go on the frame the hand
     * lands.
     */
    hangInputGrace: 0.18,
    /** Lateral shimmy speed along a grabbed ledge. */
    hangShimmySpeed: 1.15,
    /**
     * The bump-and-scuff (B2; Section 6.1, amended: a failed climb is never
     * silent). A press of Space that carries the hands onto a face they
     * cannot get over - too high for the reach the body has, or a lip with
     * no room above it - pushes the body back off the face at this speed,
     * stops it rising, holds the hands-up pose for `scuffPoseTime` and
     * sounds `audio.scuff`. A hang whose pull-up is blocked gives the pose
     * and the sound without the push; letting go is the crouch key's job.
     */
    scuffBumpSpeed: 1.6,
    scuffPoseTime: 0.35,
    /**
     * The airborne auto-climb probes along the direction the Shade is FACING,
     * which is not necessarily where it is going. Without an approach test,
     * stepping backwards off a ledge while still looking at it re-grabs the
     * face you just left and hauls you back up. A climb therefore needs either
     * forward input or this much velocity into the ledge.
     */
    mantleApproachSpeed: 0.6,

    /** Fall above this distance emits the landing noise (Section 7.2). */
    landingNoiseFallHeight: 2.0,
    /**
     * Landing weight (B8). A fall costs something to land. Below `softFall`
     * nothing - a hop off a crate - and from `hardFall` up the whole cost,
     * ramped between. The cost is `speedLoss` of the horizontal speed cut on
     * the landing step and the ground speed held to that fraction for
     * `recovery` seconds (both scaled by the ramp) while the legs take it;
     * the camera dips `camera.landDip` and the body squashes `squash` of
     * its height, scaled the same way. `speedLoss` at 0 is a landing that
     * is only seen.
     */
    landing: {
      softFall: 1.2,
      hardFall: 4.0,
      speedLoss: 0.5,
      recovery: 0.4,
      squash: 0.12,
    },
    /** Cadence of footstep noise/audio events, in metres travelled. */
    footstepStride: 2.1,
    crouchFootstepStride: 1.6,
    sprintFootstepStride: 2.6,

    /** Third-person rig (Section 6.1). */
    camera: {
      back: 2.2,
      up: 1.4,
      /** Lateral offset so the body does not sit under the crosshair. */
      side: 0.45,
      /** Collision-aware pullback. */
      collisionRadius: 0.22,
      minDistance: 0.55,
      /** Seconds for the boom to ease back out after an obstruction clears. */
      pullOutSmoothing: 0.18,
      pullInSmoothing: 0.0,
      followSmoothing: 0.08,
      /**
       * The dip (B8): a critically damped spring on the pivot's height,
       * kicked down `climbDip` metres when a vault, mantle or pull-up
       * commits and `landDip` (scaled by `landing`'s ramp) when the body
       * lands hard; it bottoms out `dipRecovery` seconds after the kick and
       * is back to rest in about four times that. The camera's weight; the
       * body's is `landing`.
       */
      climbDip: 0.22,
      landDip: 0.3,
      dipRecovery: 0.26,
      pitchMin: -1.15,
      pitchMax: 1.05,
    },
  },

  // -------------------------------------------------------------------------
  // Warden — AI-controlled, human-controlled in free-roam only (Section 6.2)
  // -------------------------------------------------------------------------
  warden: {
    health: 100,
    /** Respawns 12s after death, furthest spawn from Shade's last known pos. */
    respawnDelay: 12,
    radius: 0.42,
    standHeight: 1.95,
    eyeHeightRatio: 0.9,

    walkSpeed: 3.0,
    sprintSpeed: 5.0,
    adsSpeed: 1.8,
    /** Crouch is not available. Wardens are heavy (Section 6.2). */
    canCrouch: false,

    groundAccel: 30,
    airAccel: 7,
    groundFriction: 10,
    gravity: -22,
    maxFallSpeed: 45,
    stepHeight: 0.35,
    groundNormalY: 0.6,

    footstepStride: 2.0,
    sprintFootstepStride: 2.4,

    camera: {
      /** First person. FOV narrows while aiming down sights. */
      adsFov: 52,
      fovSmoothing: 0.09,
      pitchMin: -1.4,
      pitchMax: 1.4,
    },
  },

  // -------------------------------------------------------------------------
  // Detection: light and visibility (Section 7.1)
  // -------------------------------------------------------------------------
  detection: {
    /** Sample every 100ms, not every frame. Cached between samples. */
    sampleInterval: 0.1,
    /** Maximum 5 short rays from the torso toward each light. */
    raysPerLight: 5,
    /** Only lights within this radius are considered. */
    lightRadius: 20,
    /** Smooth toward the target over 250ms so the meter does not flicker. */
    smoothingTime: 0.25,
    /** Crouching applies a 0.75 multiplier. */
    crouchMultiplier: 0.75,
    /** Inside a vent the Shade is unlit regardless of nearby fixtures. */
    ventMultiplier: 0.0,
    meterMin: 0,
    meterMax: 100,
    /**
     * Section 7.1 scores each light as
     *   intensity * (1 - distance/range) * unobstructedRayFraction
     * Three.js r155+ light intensity is physical (candela), so raw values are
     * in the tens and the summed score would peg at 100 permanently. This
     * scalar maps the physical sum into the 0-100 meter range.
     *
     * Fitted in Phase 5 against the measured light sums on the v2 map, not
     * guessed: site A sums to 68.0, site B to 28.3, site C to 5.0. At 1.2 that
     * reads 85 / 37 / 9, which clears Section 16 checks 8 and 9 (>70 and <25)
     * and — the reason it is not higher — leaves the Turbine Hall 15 points of
     * headroom below the clamp. Pegged at 100 the meter cannot show a light
     * going out, which is check 10 and half the point of destructible lights.
     */
    scoreScale: 1.2,
    /** Ray origin height on the torso, as a fraction of capsule height. */
    torsoHeightRatio: 0.62,
    /** Lateral spread of the sample rays around the torso, in metres. */
    torsoSpread: 0.22,
    /** Ambient floor. The Shade is never perfectly invisible in the open. */
    ambientFloor: 3,

    /**
     * Section 4.2 feedback. The meter and what is on screen must never
     * disagree, so both are driven from the smoothed value by one function.
     * At visibility 0 the body sits at `silhouetteDarkness` of its palette
     * colour with a faint teal edge; at 100 it is fully lit with a bright rim.
     */
    feedback: {
      silhouetteDarkness: 0.14,
      rimMin: 0.2,
      rimMax: 1.0,
      /**
       * The fresnel rim itself (Section 4.2: "rim light intensity"). Driven by
       * the same smoothed value as everything else, so it cannot disagree.
       * `power` tightens the band to the silhouette edge; higher is narrower.
       */
      rimPower: 2.6,
      rimStrengthMin: 0.18,
      rimStrengthMax: 1.35,
    },
  },

  // -------------------------------------------------------------------------
  // Detection: noise (Section 7.2)
  // -------------------------------------------------------------------------
  noise: {
    /** Noise events live for 0.4s then expire. */
    lifetime: 0.4,
    /** Hard cap on simultaneously tracked events. */
    maxEvents: 48,
    radii: {
      shadeCrouchWalk: 0,
      shadeWalk: 4,
      shadeSprint: 12,
      shadeLanding: 10,
      /**
       * A failed climb's slap on the wall (D23): a footstep's worth, so the
       * Warden in the room looks up and the one two rooms away hears nothing.
       */
      shadeScuff: 4,
      shadeSlide: 6,
      shadeVent: 0,
      wardenWalk: 8,
      wardenSprint: 18,
      gunfire: 45,
      gadgetDetonation: 30,
      lightDestroyed: 20,
      plant: 15,
      knifeSwing: 12,
    },
    /** Planting emits 15m on a 1s interval. */
    plantInterval: 1.0,
  },

  // -------------------------------------------------------------------------
  // Combat (Section 8)
  // -------------------------------------------------------------------------
  combat: {
    gun: {
      magazine: 30,
      /** 600 rpm. */
      roundsPerMinute: 600,
      damageNear: 25,
      damageFar: 12,
      damageNearRange: 15,
      damageFarRange: 30,
      headshotMultiplier: 2.0,
      /** Degrees. */
      spreadBase: 0.6,
      spreadPerShot: 0.25,
      spreadMax: 4.0,
      spreadRecovery: 3.0,
      /** Recoil: vertical climb with mild horizontal drift. */
      recoilVertical: 0.42,
      recoilHorizontal: 0.16,
      recoilRecoveryRate: 5.5,
      /** Fraction of accumulated recoil that recovers between bursts. */
      recoilRecoveryFraction: 0.7,
      reloadTime: 2.2,
      range: 90,
      /** Vertical fraction of the capsule counted as head. */
      headHeightRatio: 0.86,
    },
    knife: {
      /** Front or side arc: 2 hits to kill, 0.5s between swings. */
      damage: 50,
      swingInterval: 0.5,
      range: 1.9,
      /** Front/side arc half-angle, degrees, measured from attacker forward. */
      arcDegrees: 100,
      /** Rear takedown: within a 100 deg cone behind the target, range 1.8m. */
      rearConeDegrees: 100,
      rearRange: 1.8,
      /**
       * How long the swing animation reads for. Shorter than swingInterval so
       * the arm is back at rest before the next swing is allowed - a knife
       * with no visible swing looks like a knife that does not work.
       */
      swingAnimTime: 0.28,
    },
  },

  // -------------------------------------------------------------------------
  // Takedown finisher cinematic (Section 8.3)
  // -------------------------------------------------------------------------
  finisher: {
    duration: 1.2,
    hitStopEnd: 0.08,
    slowMoEnd: 0.9,
    hitStopTimeScale: 0.05,
    slowMoTimeScale: 0.25,
    /** Camera detaches and orbits 40 deg around the pair at 1.8m. */
    orbitDegrees: 40,
    orbitRadius: 1.8,
    orbitHeight: 1.25,
    /**
     * Hard wall-clock timeout (Section 8.3, Section 15). On expiry, force
     * restore camera parent, FOV, time scale and input regardless of progress.
     */
    wallClockTimeout: 1.5,
  },

  // -------------------------------------------------------------------------
  // Gadgets (Section 9). All effects live in one registry, no setTimeout.
  // -------------------------------------------------------------------------
  gadgets: {
    /** Throw physics shared by all thrown gadgets. */
    throw: {
      speed: 13,
      upBias: 0.22,
      gravity: -18,
      restitution: 0.32,
      friction: 0.7,
      radius: 0.09,
      /** Below this speed a resting grenade stops integrating. */
      sleepSpeed: 0.35,
      /** Fuse from release to detonation. */
      fuse: 1.6,
    },
    smoke: {
      count: 2,
      duration: 8,
      radius: 5,
      /** Hard cap of 200 sprites, one shared material, pooled (Section 15). */
      spriteCap: 200,
      spriteSizeMin: 1.5,
      spriteSizeMax: 3.2,
      spriteOpacity: 0.34,
      growTime: 1.2,
      fadeTime: 1.5,
      driftSpeed: 0.18,
    },
    flashbang: {
      count: 2,
      duration: 4,
      /** Radius within which the detonation can blind. */
      radius: 12,
      /** AI perception is hard-disabled if it had line of sight. */
      aiBlindDuration: 4,
      /** Player screen white-out fade. */
      playerWhiteoutHold: 0.35,
      ringFrequency: 4000,
    },
    taser: {
      /** 1 charge, recharges over 25s. */
      charges: 1,
      rechargeTime: 25,
      range: 6,
      stunDuration: 3,
      /** Also permanently destroys a targeted light. */
      destroysLights: true,
      /** Aim cone half-angle in degrees for target acquisition. */
      aimConeDegrees: 12,
    },
    stunGrenade: {
      count: 2,
      duration: 2.5,
      radius: 7,
      /** Slows the Shade to 40% speed and blurs the screen. Non-lethal. */
      speedMultiplier: 0.4,
      blurPixels: 6,
    },
    frag: {
      count: 2,
      /** 60 damage at the centre, falling to 0 at 6m. */
      damageCentre: 60,
      radius: 6,
      /** Damage multiplier when line of sight to the centre is blocked. */
      noLineOfSightMultiplier: 0.35,
    },
    alarmCamera: {
      /** 1 per round. Proximity alarm only, renders no live feed. */
      count: 1,
      radius: 8,
      coneDegrees: 100,
      /** Shade is marked on the Warden HUD for 2s after a detection. */
      markDuration: 2,
      health: 1,
      placeRange: 3.0,
      /** Re-trigger interval so the siren does not machine-gun. */
      retriggerInterval: 1.5,
      /** Hit sphere for gunfire and the knife. The fixture is small. */
      hitRadius: 0.26,
      /** Fixture dimensions, built from primitives (Section 2). */
      bodyLength: 0.34,
      bodyRadius: 0.1,
      mountRadius: 0.09,
      mountDepth: 0.08,
      lensRadius: 0.055,
      /** How far off the wall the fixture floats, so it does not z-fight. */
      surfaceOffset: 0.06,
    },
  },

  // -------------------------------------------------------------------------
  // Objective and round flow (Section 10)
  // -------------------------------------------------------------------------
  round: {
    /** Base timer 240s. */
    duration: 240,
    plantHoldTime: 4,
    detonationTime: 45,
    defuseHoldTime: 8,
    /** Defuse progress is retained for 5s, then decays. */
    defuseRetainTime: 5,
    defuseDecayRate: 0.5,
    /**
     * How far above or below its feet a Warden can work on a charge. With
     * `siteRadius`, the whole defuse reach; `DEFUSE_REACH` in
     * systems/objective.js is where it is measured, and the AI reads it here
     * to know where to walk to. 2.5m is decided (A6, D5): a Warden beside a
     * 2m crate reaches up to a charge on top of it.
     */
    defuseReachY: 2.5,
    /** Plant/defuse interaction radius around a site. */
    siteRadius: 2.0,
    /** Milestones (Section 10.3), each fires at most once per round. */
    plantExtension: 45,
    takedownExtension: 30,
    /** Delay between round end and the intermission scoreboard. */
    roundEndDelay: 2.5,
  },

  reinsert: {
    /** 15s countdown with a free-look death camera on the killing Warden. */
    delay: 15,
    /** Hard wall-clock guard, mirrors the finisher (Section 15). */
    wallClockGuard: 16.5,
    /** Death camera orbit distance from the killer. */
    deathCamDistance: 3.4,
    deathCamHeight: 1.9,
    deathCamOrbitSpeed: 0.18,
    /** Free-look pitch: starts slightly above and is clamped either side. */
    deathCamPitch: 0.24,
    deathCamPitchMin: -0.35,
    deathCamPitchMax: 1.1,
    /** Reinsert restores full health, does NOT refill gadgets (Section 10.2). */
    restoreHealth: true,
    refillGadgets: false,
    /** Spawn scoring: candidates are ranked by distance from the Warden. */
    excludeLastUsedSpawn: true,
    /** Brief invulnerability so a reinsert cannot be instantly punished. */
    spawnProtection: 1.5,
  },

  match: {
    /** Best of 5 by default (first to 3). Best of 11 selectable (first to 6). */
    lengths: { 5: 3, 11: 6 },
    defaultLength: 5,
    /** The human is always the Shade. No side swap. */
    humanRole: 'shade',
  },

  // -------------------------------------------------------------------------
  // Warden AI (Section 11)
  // -------------------------------------------------------------------------
  ai: {
    /** Perception: 90 deg cone, 25m range, requires an unobstructed ray. */
    fovDegrees: 90,
    viewRange: 25,
    /** Detection accumulator drains at 15/s with no line of sight. */
    drainRate: 15,
    /** Accumulator thresholds. */
    suspicionThreshold: 40,
    engageThreshold: 100,
    accumulatorMax: 100,
    /** Movement multiplier applied to the fill rate. */
    movementMultiplier: { crouch: 1.0, walk: 1.6, sprint: 2.4, still: 0.8 },

    /** State timings. */
    patrolPauseMin: 2,
    patrolPauseMax: 4,
    patrolScanDegrees: 55,
    patrolScanSpeed: 0.9,
    suspiciousHold: 1.5,
    investigateScanTime: 4,
    investigateTimeout: 12,
    engageLoseSightTime: 2.5,
    searchDuration: 15,
    searchWaypointCount: 3,
    /** Throw a frag if the Shade is static for 2s (Section 11, ENGAGE). */
    fragStaticTime: 2,
    /** Effective firing range the AI closes to before shooting. */
    engageRange: 18,
    /** Rounds per burst (Section 11), and the pause between bursts, seconds. */
    engageBurstMin: 3,
    engageBurstMax: 7,
    engageBurstPauseMin: 0.25,
    engageBurstPauseMax: 0.7,
    /** One stun grenade thrown into a likely hiding spot during SEARCH. */
    searchStunGrenades: 1,
    /**
     * "Use cover" in ENGAGE. Sampled on a ring around the Warden between
     * bursts rather than read from authored cover points, so it works anywhere
     * and cannot go stale when the map changes. Kept small: this is a handful
     * of rays, and only while a burst is paused.
     */
    coverProbeCount: 8,
    coverProbeDistance: 2.2,

    /** Stuck handling: <0.3m over 2s in a moving state forces a re-path. */
    stuckDistance: 0.3,
    stuckTime: 2,
    /** Distance at which a waypoint counts as reached. */
    waypointArriveRadius: 0.9,
    /**
     * How far the AI may have to walk from its last waypoint to a goal with
     * only the solver to steer it - the one leg nothing plans (Block A8). A
     * bound on the waypoint graph's density, measured from the ground a
     * Warden would defuse on for every legal plant: past it, a crate between
     * the last node and the charge is a DEFEND stall.
     */
    maxUnpathedLeg: 6,
    /**
     * A goal this close, flat, is walked to over the ground planner from
     * the Warden's own feet, and the waypoint graph is not consulted (D5).
     * The graph is for the long haul; routed through it, a goal eight
     * metres up a lane was reached by way of the node nearest it, which on
     * the yard stood a metre and a half beyond it, so the Warden walked
     * past the noise it was investigating - and past the Shade making it,
     * out of its cone - and came back. Past this range the graph's route
     * ends at that node as before and the planner does the last leg.
     */
    directRouteRange: 10,
    /**
     * How far off a planned line the Warden actually walks, and so how much
     * ground a pulled segment of `WardenGround.route()` keeps to either side
     * of itself (B5c). The follower advances to the next point from
     * `waypointArriveRadius` away and turns at `turnRate`, so a bend is cut
     * on the inside by about a third of a metre at a walk (a 0.9m turning
     * circle) and by more at a sprint. A line that grazed the hall void's
     * corner by a footprint's sliver had the Warden off the deck.
     */
    routeEdgeMargin: 0.6,
    /** Turn rate, radians per second. */
    turnRate: 3.4,

    /** Directions swept looking for a wall to hang the alarm camera on. */
    alarmPlacementProbes: 8,
    /** How often that sweep runs while searching or defending. */
    alarmPlacementInterval: 0.5,
    /**
     * How often DEFEND, arrived somewhere the defuse cannot run from (the
     * reach itself says, line and all - B5d), plans its way again.
     */
    defendRepathInterval: 1.5,

    /**
     * Three difficulty presets (Section 11), listed easiest first: the
     * accumulator's fill per second at point-blank on a lit, sprinting
     * Shade; the aim error cone, degrees either way in yaw and in pitch,
     * drawn afresh for every burst; the delay before a sighting starts to
     * fill. Default is medium. What each is worth (C5, D33), a lit, still
     * Shade in plain view: engaged 7.35 / 4.97 / 3.60s after it is first
     * seen at 8m and dead 0.86 / 0.51 / 0.35s after that; at 16m, 13.6 /
     * 9.3 / 6.7s and 7.2 / 1.4 / 0.9s.
     * `each-difficulty-is-quicker-to-see-you-and-quicker-to-kill-you`
     * holds the order.
     *
     * **Easy's cone was 5.0 until F17** (D54), and 5.0 at 16m is wider than
     * the body is: the Shade's box subtends 1.22 degrees either way there
     * against a 5 degree draw, so one burst in six was on it, and because
     * the draw is held for the burst's 3-7 rounds a burst is one trial and
     * not seven. That makes the time-to-kill geometric - mean 6.3s, and a
     * 30s engagement about once in sixty - and the 2026-09-27 audit drew
     * one: 23 bursts, 119 rounds, 2 hits, alive. At 4.0 the same measure
     * over 40 seeds reads hit fraction 0.148 -> 0.232 and worst 26.1s ->
     * 13.8s, while easy stays clearly the slowest preset at both ranges.
     * Narrowing it further buys a shorter tail with the thing this preset
     * is for: at 3.5 easy kills at 8m in 0.71s against medium's 0.51s, and
     * the two are no longer telling a player much apart.
     */
    difficulty: {
      easy: { fillRate: 26, aimErrorDegrees: 4.0, reactionDelay: 0.28 },
      medium: { fillRate: 38, aimErrorDegrees: 2.5, reactionDelay: 0.12 },
      hard: { fillRate: 52, aimErrorDegrees: 1.2, reactionDelay: 0.05 },
    },
    defaultDifficulty: 'medium',
  },

  // -------------------------------------------------------------------------
  // Map: "Meridian Substation" (Section 5)
  // -------------------------------------------------------------------------
  map: {
    /** Building footprint, roughly 60m x 45m, two floors (Section 5). */
    width: 60,
    depth: 45,
    /**
     * Exterior site. The Shade starts outside and infiltrates, so the ground
     * plane extends past the shell to give an approach apron on every face.
     */
    siteWidth: 80,
    siteDepth: 65,
    /**
     * Vertical layout. Every height in the map derives from these, so the
     * traversal chains stay inside the Section 6.1 bands by construction.
     *
     * Level 1 is 6m to the underside of the upper deck and level 2 is 5m to
     * the ceiling. A 6m rise is above hangBand, so the Shade cannot reach the
     * deck in one move and the intermediate tiers below are mandatory, not
     * decorative:
     *
     *   ground -> 1.0 crate  (vault  1.0)
     *          -> 2.3 stack  (mantle 1.3)
     *          -> 4.0 gantry (mantle 1.7)
     *          -> 6.0 deck   (mantle 2.0)
     *
     * and the vent chain, which is the silent version of the same climb:
     *
     *   ground -> 2.3 lower vent (mantle 2.3)
     *          -> 4.3 upper vent (mantle 2.0)
     *          -> 6.0 deck       (mantle 1.7)
     */
    groundY: 0,
    catwalkY: 6.0,
    ceilingY: 11.0,
    ventFloorY: 2.3,
    ventUpperY: 4.3,
    /** Intermediate mantle tier between the crate stacks and the deck. */
    gantryY: 4.0,
    /**
     * Route lighting (B7, D28). Every stage of every declared route
     * (`map.routes`) is drawn a step brighter than the same surface would be
     * unlit - its own colour as emissive, so it holds in shadow and in the
     * dark vault alike - and the edge each route goes over at the top, the
     * part of the landing's face the rule names a climb onto from the last
     * stage, carries a thin unlit strip in the lamps' warm white. Paint,
     * not lamps: nothing here is a light the detection model reads
     * (Section 7.1), so a lit route is no riskier to stand on. The check
     * `every-route-reads-lit-from-its-foot` (tests/legibility.js) measures
     * both from the pixels. `edgeReach` is how far past the support's own
     * span the strip runs, a body radius either side, so a landing edge is
     * lit where you arrive at it and not along a 38m slab.
     */
    routeLighting: {
      emissive: 0.12,
      edgeThickness: 0.06,
      edgeHeight: 0.05,
      edgeReach: 1.0,
    },
    groundFloorHeight: 6.0,
    upperFloorHeight: 5.0,
    wallThickness: 0.4,
    floorThickness: 0.35,
    /**
     * Deck edges are climbable only where the level design puts a lip, and a
     * lip hangs deeper than the floor slab so the Shade's forward ledge probe
     * (which samples six fixed heights) gets more than one ray into its face.
     */
    deckLipWidth: 1.2,
    deckLipDepth: 0.7,

    /** Ledge classification bands. These drive BOTH collision and markings. */

    /**
     * Vent runs are crouch-only and silent. Interior height must clear the
     * crouch capsule (1.05m) but not the standing one (1.85m), or the run is
     * impassable rather than crouch-only.
     */
    /**
     * Staircases. The Warden has walk, sprint and ADS and nothing else
     * (Section 6.2) — no crouch, no climb — so walking up is its only route to
     * the upper floor. Step rise must stay below BOTH actors' step-up heights
     * (Shade 0.32, Warden 0.35) or the solver will not carry them over the lip.
     */
    stairSteps: 20,
    stairRise: 6.0 / 20,
    stairRun: 0.4,
    stairWidth: 2.0,
    /**
     * Headroom a staircase needs under the deck it climbs through. The stairwell
     * opening is derived from this rather than authored: the first step whose
     * tread plus this clearance breaks the deck underside is where the hole
     * starts. Sized to the taller actor.
     */
    stairHeadroom: 1.95,
    /** How much of a glazed pane is pane (D3): enough to read as glass, not enough to hide the yard behind it. */
    glassOpacity: 0.3,

    /**
     * Material finishes (E4, D43). A map that opts in (`plant` does; the
     * yard waits for E5) draws every solid in the finish its palette colour
     * names here - concrete, painted metal or glass - and a finish is a
     * toon ramp of its own and a grime texture (mapmaterials.js).
     *
     * `ramp` is the Section 4 gradient map with its steps tuned: eight
     * texels, each a quarter of dotNL from -1 to 1, so `ramp[4]` is the
     * light just on the surface and `ramp[7]` the light square to it.
     * Concrete is matte: eight gentle steps, a roll-off with no hard edge,
     * the face square to a lamp as bright as the shared 4-step ramp had it
     * and the grazing faces a little darker. Paint is glossy: three hard
     * bands - shadow, a flat body at 0.45, and the full face from a quarter
     * on - the cel look a painted crate has and a wall does not. Glass
     * never falls to black; a pane catches the sky from both sides. The
     * pixel checks that read a crate or a duct against concrete
     * (tests/legibility.js) are the ceiling on the concrete's mid-tones
     * and the floor on paint's: B6's thinnest mouth sits at 0.26 against
     * a 0.25 threshold.
     *
     * `grime` is the tiling multiplier: `tile` metres per repeat of the
     * world-projected UVs, `layers` of value noise (`cells` per tile in u
     * and v - unequal cells stretch the grain into streaks) mapped onto
     * [`low`, `high`], and an optional `stain`, a low-frequency blotch that
     * darkens by `depth` above `threshold`. Every value is below 1, so grime
     * only darkens - and by more on screen than the texel says, since the
     * texel is sRGB and the multiply is linear: concrete's mean texel of
     * 0.94 took a fifth off a lit floor at 0.88, a tenth at this. `seed`
     * feeds the hash, not the rng (Section 2).
     */
    finishes: {
      fallback: 'concrete',
      byPalette: {
        concrete: 'concrete',
        concreteDark: 'concrete',
        ductMetal: 'paint',
        wardenGunmetal: 'paint',
        wardenSteel: 'paint',
        hazardOrange: 'paint',
        hazardStripe: 'paint',
        glass: 'glass',
        brokenGlass: 'glass',
      },
      concrete: {
        ramp: [0.0, 0.2, 0.4, 0.55, 0.7, 0.8, 0.9, 1.0],
        grime: {
          size: 128, tile: 6.0, seed: 11, low: 0.86, high: 1.0,
          layers: [{ cells: [4, 4], weight: 0.5 }, { cells: [9, 9], weight: 0.3 }, { cells: [23, 23], weight: 0.2 }],
          stain: { cells: [3, 3], threshold: 0.62, depth: 0.1 },
        },
      },
      paint: {
        ramp: [0.0, 0.0, 0.45, 0.45, 0.45, 1.0, 1.0, 1.0],
        grime: {
          size: 128, tile: 3.0, seed: 23, low: 0.86, high: 1.0,
          layers: [{ cells: [32, 3], weight: 0.6 }, { cells: [7, 7], weight: 0.4 }],
        },
      },
      glass: {
        ramp: [0.4, 0.4, 0.6, 0.6, 0.8, 0.8, 1.0, 1.0],
        grime: {
          size: 64, tile: 2.0, seed: 37, low: 0.9, high: 1.0,
          layers: [{ cells: [3, 3], weight: 1.0 }],
        },
      },
    },

    /**
     * The yard's finishes (E5, D45): the same kit, its own set. Every
     * container is `corrugated` - a glossy ramp like paint's and a grime
     * with `ridges`: a cosine profile across the tile (`count` ridges per
     * `tile` metres, the troughs `depth` darker) under fine vertical
     * streaks and a stain - so the world-projected UVs (u along the face)
     * draw the same corrugation on every box, 2.4m a repeat, 9 ridges
     * to it. The ground and the fence are `wet`: a concrete a step lower
     * in its mid-tones with a hot band near square-on - the sheen of wet
     * asphalt under a floodlight - and a grime of broad dark puddles.
     * Glass and paint are the plant's. The yard's checks
     * (tests/yardlight.js) read the ground's pools and gaps against each
     * other and the sky, so `wet` moves them together.
     */
    yardFinishes: {
      fallback: 'corrugated',
      byPalette: {
        wardenGunmetal: 'corrugated',
        concrete: 'corrugated',
        hazardOrange: 'corrugated',
        concreteDark: 'wet',
        wardenSteel: 'paint',
        ductMetal: 'paint',
        hazardStripe: 'paint',
        glass: 'glass',
        brokenGlass: 'glass',
      },
      corrugated: {
        ramp: [0.0, 0.0, 0.4, 0.45, 0.5, 1.0, 1.0, 1.0],
        grime: {
          size: 128, tile: 2.4, seed: 41, low: 0.84, high: 1.0,
          layers: [{ cells: [48, 2], weight: 0.5 }, { cells: [5, 5], weight: 0.5 }],
          stain: { cells: [2, 2], threshold: 0.6, depth: 0.12 },
          ridges: { count: 9, depth: 0.22 },
        },
      },
      wet: {
        ramp: [0.0, 0.15, 0.3, 0.45, 0.6, 0.7, 0.8, 1.0],
        grime: {
          size: 128, tile: 8.0, seed: 43, low: 0.78, high: 1.0,
          layers: [{ cells: [3, 3], weight: 0.6 }, { cells: [11, 11], weight: 0.4 }],
          stain: { cells: [2, 2], threshold: 0.5, depth: 0.45 },
        },
      },
      paint: {
        ramp: [0.0, 0.0, 0.45, 0.45, 0.45, 1.0, 1.0, 1.0],
        grime: {
          size: 128, tile: 3.0, seed: 23, low: 0.86, high: 1.0,
          layers: [{ cells: [32, 3], weight: 0.6 }, { cells: [7, 7], weight: 0.4 }],
        },
      },
      glass: {
        ramp: [0.4, 0.4, 0.6, 0.6, 0.8, 0.8, 1.0, 1.0],
        grime: {
          size: 64, tile: 2.0, seed: 37, low: 0.9, high: 1.0,
          layers: [{ cells: [3, 3], weight: 1.0 }],
        },
      },
    },

    /**
     * Decals (E4): the marks a place picks up, as quads a centimetre proud
     * of a face, drawn from a 2x2 atlas mapdecals.js paints in code (a
     * stain, a drip, a wheel scuff, a hazard kerb). `lift` is that
     * centimetre; `seed` feeds the atlas's noise. Where they go is each
     * map's own list (`maps/plantdecals.js`), and Section 5 amended still
     * holds: none of them marks a climb.
     */
    decals: {
      atlasSize: 256,
      lift: 0.012,
      seed: 53,
    },

    /**
     * A box this wide AND this deep casts a shadow however thin it is. Roofs,
     * floor plates and decks are thin slabs; without this they sat out of the
     * shadow pass and the key light lit the building's interior as if it had
     * no roof (Section 4.1).
     */
    shadowCasterMinSpan: 2.0,

    ventHeight: 1.15,
    ventWidth: 1.1,
    /** Thickness of the duct floor where it spans a room. */
    ventFloorDepth: 0.2,
    /**
     * A mouth the Shade mantles into thickens to this, over this length. The
     * ledge probe samples six fixed heights above the feet and a thin slab can
     * fall between two of them, which made every v1 vent lip unclimbable
     * despite being correctly classified and marked.
     */
    ventLipDepth: 0.9,
    ventLipLength: 1.0,
    /**
     * The roof is inset this far from each end, so the mouth of a run has full
     * standing headroom. Without it a mantle onto the vent lip can never commit
     * — the destination capsule is standing height and would not fit — and the
     * vents would be unreachable.
     */
    ventMouthLength: 1.3,

    /** Counts, asserted at build time so the map cannot silently drift. */
    destructibleLightCount: 12,
    /**
     * Section 5 specifies 14. The v2 redesign grew the map to an 80x65 site
     * with a single continuous upper deck, and 14 nodes cannot express a graph
     * whose every link is a route the Warden can actually walk — which is the
     * failure Phase 4 flagged. See PROGRESS.md deviation 13.
     */
    waypointCount: 20,
    wardenSpawnCount: 4,
    /**
     * Section 5 specifies 1 fixed Shade spawn; Section 10.2 and Section 15
     * require multiple candidates to score for reinsert. Index 0 is the fixed
     * round-start spawn, 1..3 are reinsert-only insert points.
     */
    shadeSpawnCount: 4,
    plantSiteCount: 3,
    /**
     * Declared rooms, and the minimum number of independent Shade entries each
     * must have. A single-door room is a chokepoint the Warden can simply stand
     * in, so the requirement is enforced rather than trusted: entries are
     * derived from geometry by sampling the room boundary and floor.
     */
    roomCount: 5,
    roomMinEntries: 2,
    /**
     * v2 requirement 4: ways up that are not the Warden's staircases,
     * declared as `map.routes` (B5) and asserted at build. A minimum, not a
     * count: the reach rule finds routes the designer did not draw, and a
     * found route is declared, not deleted (D25).
     */
    stairlessRouteMin: 5,
    /** Spacing used when walking a room boundary looking for openings. */
    roomEntrySample: 0.3,
    /**
     * Sill heights above a room floor tested for a crouch-height opening, so a
     * window counts as an entry and not only a doorway. Capped well below the
     * ceiling: an opening the Shade cannot reach is not a way in.
     */
    roomEntrySillStep: 0.5,
    roomEntrySillMax: 4.0,
    /**
     * Grid spacing used when looking for holes in a room's floor or ceiling.
     * Finer than the boundary walk: a vertical shaft can be as narrow as a vent
     * (1.1m), and a coarse grid puts every sample point close enough to a duct
     * wall that the capsule clips it, hiding a hatch that is genuinely usable.
     */
    roomVerticalSample: 0.3,

    /**
     * Grid spacing for the Warden's reachable ground (`mapground.js`). Half a
     * metre: a third of the narrowest doorway, so a corridor is always several
     * cells across, and coarse enough that probing a column is cheap. Finer
     * buys nothing - the body it carries is 0.84m wide, so the grid is already
     * the more precise of the two.
     */
    wardenGroundCell: 0.5,

    /** Section 4.1: contact darkness faked with baked vertex tint. */
    vertexTintStrength: 0.45,
    vertexTintHeight: 1.2,

    /** Affordance markings (Section 5). Generated from the collision flags. */
    marking: {
      /**
       * Section 5, amended: there are no affordance markings.
       *
       * The stripes, chevrons, dashed hang edges and self-illuminated vent
       * panels are gone. A ledge is climbable because the geometry says so and
       * the body can reach it, and it has to LOOK climbable for the same
       * reason. Painting a hint on a shape that does not read is treating the
       * symptom.
       *
       * The plant site is marked, because a bomb site is information about
       * the objective, not a hint about traversal - but as the room (C7,
       * D8): the 2m pulsing ring said "plant here" while the plant is
       * anywhere in the room (20.1), so it went. The room's floor is tinted
       * instead: a multiply quad over every floor plate inside the site's
       * room (mapdecals.js, `bakeSiteTints`), white pulled toward
       * `hazardOrange` by this much. A multiply, so the tint is as dark as
       * the floor it is on - a dark vault stays dark, a lit hall reads
       * warm - and the lit-pools numbers move by a few percent, not by a
       * pool. 0.28 measured through the plain renderer: R over B up
       * 1.14-1.17x, luma down 7-9%. E6's post pipeline multiplies in linear
       * light, which darkens more for the same strength (0.2 read 12% on
       * the vault's floor), so 0.13: R over B up 1.09-1.13x, luma down
       * 5-8% on the plant's site floors. Argued under D44.
       */
      siteTintStrength: 0.13,
    },

    /** Lighting rig (Section 4, Section 4.1). */
    lighting: {
      hemisphereIntensity: 0.55,
      /** 12 destructible point lights. castShadow is false on all of them. */
      pointIntensity: 26,
      pointDistance: 18,
      pointDecay: 2,
      /** 2 directional fills; exactly one of them casts shadows. */
      keyIntensity: 1.15,
      fillIntensity: 0.35,
      keyDirection: [-0.45, -1.0, -0.35],
      fillDirection: [0.6, -0.55, 0.5],
      /** Emissive fixture mesh brightness, and its broken state. */
      fixtureEmissive: 1.4,
      fixtureEmissiveBroken: 0.0,
    },
  },

  // -------------------------------------------------------------------------
  // Audio (Section 14). All synthesized, three buses.
  // -------------------------------------------------------------------------
  audio: {
    masterGain: 0.7,
    busGain: { sfx: 0.85, ambience: 0.35, ui: 0.6 },
    /** Spatialisation defaults for PannerNode. */
    panner: { refDistance: 2.5, maxDistance: 55, rolloffFactor: 1.15 },

    shadeFootstep: { highpass: 800, duration: 0.025, gain: 0.11 },
    wardenFootstep: { lowpass: 400, duration: 0.06, gain: 0.34, clickFreq: 2200, clickGain: 0.09 },
    gunfire: { duration: 0.09, sweepFrom: 5200, sweepTo: 380, gain: 0.42, tailCount: 3, tailDelay: 0.055, tailFalloff: 0.45 },
    knifeSwing: { duration: 0.13, bandpass: 1800, gain: 0.2 },
    takedown: { subFreq: 55, subDuration: 0.5, crackDuration: 0.09, gain: 0.6 },
    taser: { freq: 120, duration: 0.35, amRate: 42, gain: 0.3 },
    smoke: { duration: 1.5, sweepFrom: 4200, sweepTo: 260, gain: 0.22 },
    flashbang: { transientDuration: 0.06, ringFreq: 4000, ringDuration: 4, gain: 0.5 },
    grenade: { duration: 0.4, sweepFrom: 900, sweepTo: 60, gain: 0.5 },
    alarm: { freqLow: 660, freqHigh: 880, toneDuration: 0.3, gain: 0.28 },
    plantBeep: { freq: 1200, duration: 0.05, gain: 0.25, intervalStart: 1.2, intervalEnd: 0.12 },
    /** Low sine pad fading in as the detection accumulator rises above 50. */
    tension: { freq: 58, threshold: 50, maxGain: 0.22, fadeTime: 0.6 },
    lifeLost: { freqStart: 320, freqEnd: 90, duration: 0.9, gain: 0.4 },
    /** Hands slapping a face they cannot get over (B2): a dull, short thud. */
    scuff: { lowpass: 650, duration: 0.09, gain: 0.26 },
  },

  // -------------------------------------------------------------------------
  // Effects and pools (Section 15)
  // -------------------------------------------------------------------------
  effects: {
    /** Fixed pool of 60 footprint decals, oldest recycled, fade over 6s. */
    footprintPoolSize: 60,
    footprintFadeTime: 6,
    footprintSize: 0.16,
    footprintLift: 0.012,
    /** Ragdoll-lite: single impulse, damped tumble, freeze after 2s. */
    ragdollDuration: 2,
    ragdollImpulse: 5.5,
    ragdollAngularDamping: 0.94,
    ragdollLinearDamping: 0.985,
    ragdollGravity: -18,
    /** Grounding blob under each actor (Section 4.1). */
    groundBlobRadius: 0.45,
    groundBlobMaxHeight: 3.0,
    groundBlobOpacity: 0.42,
    /** Generic particle pool shared by impacts and sparks. */
    particlePoolSize: 120,
    particleLifetime: 0.7,
    /** Sparks per bullet impact. Small: a burst of 30 must not flood the pool. */
    impactSparks: 5,
    /** Sparks per gadget detonation. */
    detonationSparks: 18,
    /** Section 17 assertion: active effects must return to 0 within 10s. */
    idleAssertionWindow: 10,
  },

  // -------------------------------------------------------------------------
  // Performance budget (Section 2 target, Section 16 check 29)
  // -------------------------------------------------------------------------
  performance: {
    /** "60fps on integrated graphics at 1080p" (Section 2). */
    targetFps: 60,
    /** The frame budget that target implies, in milliseconds. */
    frameBudgetMs: 1000 / 60,
    /**
     * How much of the budget the CPU side may take before the frame is at
     * risk. Integrated graphics are usually GPU-bound, so a CPU frame that
     * eats most of the budget on a dev machine will miss on Josh's.
     */
    cpuBudgetFraction: 0.5,
    /**
     * Frames the benchmark measures, and untimed frames it discards first.
     * 180 frames is 3s, which at 600rpm is exactly one magazine downrange.
     */
    benchmarkFrames: 180,
    benchmarkWarmupFrames: 30,
    /** Rounds that must actually be fired during the check-29 stress load. */
    stressRounds: 25,
  },

  // -------------------------------------------------------------------------
  // HUD and UI (Section 13)
  // -------------------------------------------------------------------------
  hud: {
    visibilityBarHeight: 190,
    killFeedMaxLines: 4,
    killFeedLineDuration: 5,
    /** Crosshair spread scale, pixels per degree. */
    crosshairPixelsPerDegree: 9,
    crosshairMinGap: 4,
    /** Lives pips (Section 13). */
    livesPips: 3,
    /** Objective prompt appears within this distance of a usable site. */
    promptRange: 3.0,
    /** Colour thresholds for the visibility bar. */
    visibilityHiddenBelow: 25,
    visibilityExposedAbove: 70,
  },

  // -------------------------------------------------------------------------
  // Hit and damage feedback (Section 13, amended - C3). One screen-space
  // quad drawn over the scene in the frame (systems/feedback.js), so the
  // pixel checks can see it where a DOM overlay would be invisible to them.
  // Sizes are in half screen heights (1 = from the centre to the top edge);
  // times are wall-clock seconds.
  // -------------------------------------------------------------------------
  feedback: {
    /** The hit marker: four diagonal strokes round the centre, on a landed knife, taser or round. */
    hitMarkerTime: 0.18,
    hitMarkerInner: 0.025,
    hitMarkerOuter: 0.065,
    hitMarkerThickness: 0.007,
    hitMarkerColor: 0xffffff,
    /** The damage direction: an arc on a ring round the centre, toward where it came from. */
    indicatorTime: 1.1,
    indicatorRadius: 0.32,
    indicatorWidth: 0.045,
    /** Half the arc, radians. */
    indicatorArc: 0.38,
    indicatorColor: 0xf07a25,
    /**
     * The vignette: the screen edge, from `vignetteInner` out, at
     * `vignetteMax` opacity when health is gone. The red is dark on
     * purpose: it takes light away from what it covers, and over a floor
     * darker than the red a vignette reddens without darkening. It went
     * from 0x6e100c to this with C7 (D44) - the site floors are a shade
     * darker and the bright ring left the frame, and the darkening the
     * check measures over site A (-9.0 luma at half health) fell to -7.6
     * against its 8; the vignette deepened rather than the check.
     */
    vignetteInner: 0.55,
    vignetteOuter: 1.35,
    vignetteMax: 0.85,
    vignetteColor: 0x580d0a,
  },

  // -------------------------------------------------------------------------
  // Debug tooling (Section 17, 17.1)
  // -------------------------------------------------------------------------
  debug: {
    /** Overlay DOM refresh rate, Hz. Refreshing every frame is wasteful. */
    overlayRefreshHz: 10,
    /** FPS is averaged over this many frames so the readout is stable. */
    fpsSampleFrames: 30,
    /** Lines kept in the test-mode command log. */
    testLogLines: 6,
    /** Each distinct assertion message is logged at most this many times. */
    assertionLogLimit: 3,
    /** Assertions run every Nth fixed step rather than every step. */
    assertionInterval: 6,
    /** Floor plane tolerance: player Y is never below floorY minus this. */
    floorTolerance: 0.5,
    /** Frames the AUTO suite advances per stepFrames() unit of work. */
    autoTestMaxFrames: 2400,
    /**
     * Animation frames the suite waits for a lost WebGL context to be handed
     * back before giving up on re-running the checks it spoiled. Chrome
     * restores in well under a second once its GPU process is up again.
     */
    contextRestoreFrames: 600,
    /**
     * Wall-clock bound on the suite's pipeline drain (F11, D48). The drain
     * polls a fence so it can publish the heartbeat while it waits, and the
     * bound is only there so a fence that never signals cannot wait forever;
     * the blocking `getError` behind it finishes the job either way. Ten
     * minutes, which is twice the worst reading on record (265s).
     */
    pipelineWaitBudgetMs: 600000,
    /** Number of PRNG values compared in the determinism check. */
    prngCompareCount: 2000,
    /**
     * Section 16: "Regression set after any patch: 1, 3, 9, 13, 17, 20, 22,
     * 23, 27." Verbatim, so the runner is the spec rather than a paraphrase.
     */
    regressionSet: [1, 3, 9, 13, 17, 20, 22, 23, 27],
    /**
     * The redesign's contract, by check id, run with the set above (spec
     * 20.11, B9). Section 16's numbers were written for marked bands; these
     * are what a climb is now - the census, the rule with no exceptions,
     * the declared routes, a mantle through nothing, the tap and the hold,
     * the tell, the Warden on its ground, and the traversal fuzz. Every id
     * here runs on every map (D7): the mantle clauses and the cover clause
     * are tests/anymap.js, which searches the map it is on; the plant's
     * named checks stay in the full suite and out of the set.
     */
    regressionChecks: [
      'every-climbable-surface-can-actually-be-climbed',
      'the-climb-rule-has-no-exceptions',
      'every-approach-the-rule-names-is-a-climb-the-controller-makes',
      'every-stacked-climb-is-a-step-of-a-declared-route',
      'no-climb-the-rule-names-rises-through-a-solid',
      'tap-space-grabs-the-ledge-hold-space-climbs-it',
      'a-climb-beyond-reach-bumps-poses-and-sounds',
      'the-warden-never-leaves-its-ground',
      'traversal-fuzz-ten-thousand-steps-never-sticks',
      'a-round-stops-at-cover-and-reads-the-head-line',
    ],
    /** How many Section 16 checks there are, for coverage reporting. */
    specCheckCount: 29,
    /**
     * Cell size for the upper-deck flood fill. Small enough to find a Warden-
     * width gap, large enough that a 60x45 deck is a few thousand cells.
     */
    deckFloodCell: 0.6,
    /** Spacing used when sampling a waypoint link for walkability. */
    linkWalkSample: 0.3,
  },

  settings: {
    /** Bounds and fixed scalars. Not user-adjustable, so they live here. */
    mouseSensitivityMin: 0.0004,
    mouseSensitivityMax: 0.008,
    adsSensitivityMultiplier: 0.65,

    /**
     * Seed values for SETTINGS, nested deliberately.
     *
     * These used to sit at this level, next to the bounds, and two call sites
     * read `CONFIG.settings.difficulty` / `CONFIG.settings.matchLength` when
     * they meant the LIVE value. Both compiled, both looked right, and both
     * returned the default forever — so the Section 13 difficulty and match
     * length controls moved a label on screen and changed nothing in the game.
     *
     * Under `defaults` there is no name left to read by accident: a stale site
     * now reads `undefined` and fails loudly instead of quietly.
     */
    defaults: {
      mouseSensitivity: 0.0022,
      invertY: false,
      masterVolume: 0.7,
      matchLength: 5,
      difficulty: 'medium',
      /** The debug gate (Section 17.1, amended): off is the playtest build. */
      debug: false,
      /**
       * The round-start briefing and controls card (C2). On, it goes up on
       * every route into a round - Play, Free roam, Next round - and holds
       * the round until any key; off, the round starts on the click.
       */
      briefing: true,
      /** Post-processing (E6): the bloom and the vignette. Off is the scene as drawn. */
      post: true,
    },
  },
};

// ---------------------------------------------------------------------------
// Keybindings (Section 2: rebindable map)
//
// Values are KeyboardEvent.code strings, or Mouse0/Mouse1/Mouse2. An action may
// have several bindings. input.js consumes this and exposes rebind().
// ---------------------------------------------------------------------------

export const DEFAULT_BINDINGS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  crouch: ['ControlLeft', 'KeyC'],
  sprint: ['ShiftLeft'],
  fire: ['Mouse0'],
  ads: ['Mouse2'],
  reload: ['KeyR'],
  interact: ['KeyE'],
  melee: ['KeyF'],
  gadget1: ['Digit1'],
  gadget2: ['Digit2'],
  gadget3: ['Digit3'],
  gadget4: ['Digit4'],
  pause: ['Escape'],
};

/**
 * Keys the browser default is suppressed for while the canvas has focus.
 * Deliberately excludes F5, F12 and anything with a modifier so reload and
 * devtools keep working.
 */
export const SUPPRESSED_KEYS = [
  'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'F3', 'F4',
];

/** Debug tooling keys (Section 17, 17.1). Not rebindable. */
export const DEBUG_KEYS = {
  toggleOverlay: 'F3',
  toggleTestMode: 'F4',
  test: {
    siteA: 'Digit1',
    siteB: 'Digit2',
    siteC: 'Digit3',
    toWarden: 'Digit4',
    godMode: 'KeyG',
    killShade: 'KeyH',
    instantPlant: 'KeyJ',
    cycleAiState: 'KeyK',
    refillGadgets: 'KeyL',
    cycleTimeScale: 'KeyT',
    runAutoTests: 'KeyY',
    /**
     * Section 16's regression set only. Not in the Section 17.1 table — added
     * because the spec names a subset "to run after any patch" and the full
     * suite is now large enough that people stop running it.
     */
    runRegressionSet: 'KeyU',
    /**
     * Block A7: draw `map.wardenGround`, the set that decides whether a plant
     * is legal. A debugging view of map data, never a marking, so it lives
     * here with the other test-mode keys and is inert unless F4 is open.
     */
    toggleWardenGround: 'KeyN',
  },
};

// ---------------------------------------------------------------------------
// Deep freeze so a stray assignment cannot silently retune the game.
// Runtime state never lives in CONFIG; mutable settings live in SETTINGS.
// ---------------------------------------------------------------------------

function deepFreeze(object) {
  for (const key of Object.getOwnPropertyNames(object)) {
    const value = object[key];
    if (value && typeof value === 'object') deepFreeze(value);
  }
  return Object.freeze(object);
}

deepFreeze(CONFIG);
deepFreeze(DEFAULT_BINDINGS);
deepFreeze(DEBUG_KEYS);
Object.freeze(SUPPRESSED_KEYS);

/**
 * Mutable, user-adjustable settings (Section 13 settings menu). Seeded from
 * CONFIG.settings defaults. This is the only mutable export in this module.
 */
export const SETTINGS = { ...CONFIG.settings.defaults };

/** Restore every setting to its CONFIG default. */
export function resetSettings() {
  Object.assign(SETTINGS, CONFIG.settings.defaults);
}
