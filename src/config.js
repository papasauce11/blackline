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
// Debug flag (Section 17.1). Test-mode bindings are inert when this is false.
// ---------------------------------------------------------------------------

export const DEBUG = true;

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
 * Derive a match seed. Prefers ?seed=<n> in the URL so a human can reproduce a
 * reported bug (Section 16 check 28), otherwise time-derived.
 * Deliberately not Math.random().
 */
export function deriveSeed(search) {
  const query = typeof search === 'string' ? search : '';
  const match = /(?:^|[?&])seed=(\d+)/.exec(query);
  if (match) return parseInt(match[1], 10) >>> 0;
  return Date.now() >>> 0;
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
    /** Tight frustum fitted to the play area (Section 4.1). */
    shadowFrustum: { left: -38, right: 38, top: 30, bottom: -30, near: 1, far: 120 },
    /** Section 4: 4-step gradient map generated in code via DataTexture. */
    toonSteps: 4,
    /** Section 4: inverted-hull outline scale. */
    outlineScale: 1.03,
  },

  // -------------------------------------------------------------------------
  // Palette (Section 4). Faction teal / hazard orange / concrete grey.
  // -------------------------------------------------------------------------
  palette: {
    shadeTeal: 0x2fd6c3,
    shadeCharcoal: 0x232a30,
    wardenOrange: 0xf07a25,
    wardenGunmetal: 0x4a5158,
    concrete: 0x6b7076,
    concreteDark: 0x3d4247,
    hazardOrange: 0xf28c1a,
    hazardStripe: 0x1c1f22,
    signageTeal: 0x2fd6c3,
    outline: 0x08090b,
    ambientSky: 0x33414d,
    ambientGround: 0x14181c,
    lightWarm: 0xffe6bd,
    lightCool: 0xbfd9ff,
    brokenGlass: 0x191c1f,
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
    /** Above this cosine the surface counts as ground, not wall. */
    groundNormalY: 0.6,

    /** Vault: obstacles 0.4m to 1.2m, sprint + forward into a flagged ledge. */
    vaultMinHeight: 0.4,
    vaultMaxHeight: 1.2,
    vaultReach: 1.1,
    vaultDuration: 0.42,
    vaultExitSpeed: 4.2,

    /** Mantle: ledges 1.2m to 2.4m, auto-triggered when airborne near a ledge. */
    mantleMinHeight: 1.2,
    mantleMaxHeight: 2.4,
    mantleReach: 0.95,
    mantleDuration: 0.62,
    /** Headroom required above the destination before the move commits. */
    mantleClearance: 0.12,

    /** Slide: from sprint + crouch, 8.0 m/s decaying over 0.8s. */
    slideSpeed: 8.0,
    slideDuration: 0.8,
    /** Sprint speed must be at least this to start a slide. */
    slideMinEntrySpeed: 5.2,
    slideCooldown: 0.5,

    /** Ledge hang: failed mantle above 2.4m. */
    hangMaxHeight: 4.2,
    hangReach: 0.85,
    /** Body offset below the grabbed edge while hanging. */
    hangDrop: 1.35,
    hangPullUpDuration: 0.55,
    /**
     * A hang is almost always entered mid-jump with the jump key still held, so
     * the pull-up cannot require a fresh keypress — there would never be one.
     * Hang inputs read the HELD key, and this grace period keeps a held jump
     * from pulling up on the same frame the ledge is grabbed, so the grab still
     * reads as a distinct beat. Release the key within the grace to stay hanging.
     */
    hangInputGrace: 0.18,
    /** Lateral shimmy speed along a grabbed ledge. */
    hangShimmySpeed: 1.15,
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
     * scalar maps the physical sum into the 0-100 meter range. Tuned so
     * Turbine Hall reads above 70 and the Server Vault below 25
     * (Section 16, checks 8 and 9).
     */
    scoreScale: 1.85,
    /** Ray origin height on the torso, as a fraction of capsule height. */
    torsoHeightRatio: 0.62,
    /** Lateral spread of the sample rays around the torso, in metres. */
    torsoSpread: 0.22,
    /** Ambient floor. The Shade is never perfectly invisible in the open. */
    ambientFloor: 3,
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
    engageBurstMin: 3,
    engageBurstMax: 7,
    engageBurstPauseMin: 0.25,
    engageBurstPauseMax: 0.7,
    /** One stun grenade thrown into a likely hiding spot during SEARCH. */
    searchStunGrenades: 1,

    /** Stuck handling: <0.3m over 2s in a moving state forces a re-path. */
    stuckDistance: 0.3,
    stuckTime: 2,
    /** Distance at which a waypoint counts as reached. */
    waypointArriveRadius: 0.9,
    /** Turn rate, radians per second. */
    turnRate: 3.4,

    /** Three difficulty presets (Section 11). Default is medium. */
    difficulty: {
      easy: { fillRate: 26, aimErrorDegrees: 5.0, reactionDelay: 0.28 },
      medium: { fillRate: 38, aimErrorDegrees: 2.5, reactionDelay: 0.12 },
      hard: { fillRate: 52, aimErrorDegrees: 1.2, reactionDelay: 0.05 },
    },
    defaultDifficulty: 'medium',
  },

  // -------------------------------------------------------------------------
  // Map: "Meridian Substation" (Section 5)
  // -------------------------------------------------------------------------
  map: {
    /** Roughly 60m x 45m footprint, two floors. */
    width: 60,
    depth: 45,
    /**
     * Vertical layout. Every height in the map derives from these, so the
     * traversal chains stay inside the Section 6.1 bands by construction:
     * ground -> mantle 2.3m onto a vent lip -> crouch the vent -> mantle 1.7m
     * onto the catwalk.
     */
    groundY: 0,
    catwalkY: 4.0,
    ceilingY: 8.0,
    ventFloorY: 2.3,
    groundFloorHeight: 4.0,
    upperFloorHeight: 4.0,
    wallThickness: 0.4,
    floorThickness: 0.35,

    /** Ledge classification bands. These drive BOTH collision and markings. */
    vaultBand: [0.4, 1.2],
    mantleBand: [1.2, 2.4],
    hangBand: [2.4, 4.2],

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
    stairSteps: 13,
    stairRise: 4.0 / 13,
    stairRun: 0.4,

    ventHeight: 1.15,
    ventWidth: 1.1,
    /**
     * The roof is inset this far from each end, so the mouth of a run has full
     * standing headroom. Without it a mantle onto the vent lip can never commit
     * — the destination capsule is standing height and would not fit — and the
     * vents would be unreachable.
     */
    ventMouthLength: 1.3,

    /** Counts, asserted at build time so the map cannot silently drift. */
    destructibleLightCount: 12,
    waypointCount: 14,
    wardenSpawnCount: 4,
    /**
     * Section 5 specifies 1 fixed Shade spawn; Section 10.2 and Section 15
     * require multiple candidates to score for reinsert. Index 0 is the fixed
     * round-start spawn, 1..3 are reinsert-only insert points.
     */
    shadeSpawnCount: 4,
    plantSiteCount: 3,

    /** Section 4.1: contact darkness faked with baked vertex tint. */
    vertexTintStrength: 0.45,
    vertexTintHeight: 1.2,

    /** Affordance markings (Section 5). Generated from the collision flags. */
    marking: {
      stripeThickness: 0.035,
      stripeInset: 0.01,
      vaultIntensity: 0.35,
      mantleIntensity: 0.75,
      hangIntensity: 0.75,
      /** Dashed pattern for hang edges. */
      hangDashLength: 0.3,
      hangGapLength: 0.22,
      /** Chevron decal on the face below a mantle ledge. */
      chevronWidth: 0.42,
      chevronHeight: 0.18,
      chevronCount: 2,
      /** Vent interiors are self-illuminated so the run reads as passable. */
      ventPanelIntensity: 0.22,
      /** Plant site: flat ring decal, 2m diameter, hazard orange, pulsing. */
      siteRingInner: 0.86,
      siteRingOuter: 1.0,
      siteRingPulsePeriod: 2.4,
      siteRingPulseMin: 0.35,
      siteRingPulseMax: 0.9,
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
    /** Section 17 assertion: active effects must return to 0 within 10s. */
    idleAssertionWindow: 10,
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
    /** Number of PRNG values compared in the determinism check. */
    prngCompareCount: 2000,
  },

  settings: {
    /** Defaults for the runtime-adjustable settings (Section 13). */
    mouseSensitivity: 0.0022,
    mouseSensitivityMin: 0.0004,
    mouseSensitivityMax: 0.008,
    adsSensitivityMultiplier: 0.65,
    invertY: false,
    masterVolume: 0.7,
    matchLength: 5,
    difficulty: 'medium',
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
export const SETTINGS = {
  mouseSensitivity: CONFIG.settings.mouseSensitivity,
  invertY: CONFIG.settings.invertY,
  masterVolume: CONFIG.settings.masterVolume,
  matchLength: CONFIG.settings.matchLength,
  difficulty: CONFIG.settings.difficulty,
};

/** Restore every setting to its CONFIG default. */
export function resetSettings() {
  SETTINGS.mouseSensitivity = CONFIG.settings.mouseSensitivity;
  SETTINGS.invertY = CONFIG.settings.invertY;
  SETTINGS.masterVolume = CONFIG.settings.masterVolume;
  SETTINGS.matchLength = CONFIG.settings.matchLength;
  SETTINGS.difficulty = CONFIG.settings.difficulty;
}
