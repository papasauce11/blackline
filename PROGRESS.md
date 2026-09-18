# Blackline — build progress

> **Starting a new session? Read [HANDOFF.md](HANDOFF.md) first.** It is one
> page: current state, the redesign now in progress, the work queue, how to run
> the suite, and the environment traps. This file is the full history and is
> long — come here for the detail behind a specific phase, not to get oriented.
>
> The live entry is the last one, **THE ENDGAME REDESIGN**.

Append-only log. One entry per phase. Read this and the relevant sections of
`BLACKLINE_SPEC.md` before touching any code, especially after a context
compaction.

**Three.js pinned to `0.180.0` (r180).** Rationale in `README.md`.

---

## Open questions for Josh

### Q1 — How many Shade spawn points? (blocks Phase 2 map data)

The spec contradicts itself:

- **Section 5** — *"Shade spawn: 1 fixed, ground floor perimeter, dark"*
- **Section 10.2** — reinsert goes to *"the spawn point furthest from the
  Warden's current position, never the one just used"*
- **Section 15** — *"scores all candidates by distance from the Warden and
  excludes the most recently used spawn"*

One fixed spawn cannot satisfy either of the last two.

**Proceeding under this assumption** (`CONFIG.map.shadeSpawnCount = 4`): author
four Shade insert points. Index 0 is the fixed round-start spawn from Section 5;
indices 1–3 are dark reinsert-only points. Round start always uses index 0;
reinserts score all four by Warden distance and exclude the last used.

Changing this later is one config number plus the spawn array in `map.js`.

---

## Phase 1 — engine core

**Status:** complete. Tagged `phase-01`.

### What was built

- **`index.html`** — import map pinned to three r180, full-window canvas, and an
  on-screen boot-error panel so a module that fails to parse or resolve is
  visible rather than console-only.
- **`src/config.js`** — every tuning number in the spec, front-loaded for all
  13 phases so later phases never introduce a magic number. Organised by spec
  section. Deep-frozen at load. Contains the mulberry32 PRNG (`rng`), the
  rebindable `DEFAULT_BINDINGS` map, `DEBUG_KEYS`, and the mutable `SETTINGS`
  object for runtime-adjustable options.
- **`src/input.js`** — keyboard, mouse, pointer lock, rebindable action map.
  Edge model designed around the fixed timestep: a `pressed` edge is consumed by
  exactly one physics step and survives a frame that runs no steps. Clears held
  keys on blur and on pointer-lock exit so keys cannot stick. Never
  `preventDefault`s a modified key, so reload and devtools keep working.
- **`src/ui/debug.js`** — F3 overlay, F4 test mode, runtime assertion registry,
  AUTO test registry and runner.
- **`src/main.js`** — composition root. Event emitter, renderer, scene, the one
  camera, the fixed-timestep loop, `initMatch()` mode router, the match-state
  defaults factory, three runtime assertions and eight AUTO checks.

### Risk-register items addressed in this phase

| Risk (Section 15) | How |
|---|---|
| Player falls through the floor | `computeStepPlan()` is a pure function; step size is always exactly `CONFIG.time.fixedDt`, the frame delta is clamped before scaling, and step count is capped at 5/frame with a drain rather than a carry. Covered by AUTO `fixed-timestep-invariants`. |
| Camera state leaks between roles | `createCamera()` throws if called a second time. Covered by AUTO `single-camera-object` and the `single-camera` runtime assertion. |
| Round state bleeds into the next round | `createMatchState()` is a defaults factory; `initMatch()` rebuilds every mutable field. Covered by AUTO `match-state-rebuilt-on-init`. |
| Gadget effects never expire | No `setTimeout`/`setInterval` anywhere in `src/` (verified by grep). |
| Shadow-casting point lights | Overlay counts shadow-casting lights live by traversing the scene, flagged unless the count is exactly 1. Reads 0 until the map lands in Phase 2. |

### Files touched

```
index.html
.gitignore
.claude/launch.json
BLACKLINE_SPEC.md      (copied into the repo)
README.md
PROGRESS.md
src/config.js
src/input.js
src/main.js
src/ui/debug.js
```

### Deviations from spec

1. **`src/ui/debug.js` is an additional file not listed in Section 3.**
   Section 17 requires an F3 overlay, four runtime assertions and an F4 test
   mode with a scripted AUTO suite, but Section 3 provides no home for them.
   Folding all of that into `main.js` would push the composition root well past
   the ~600-line limit in Section 3.1. It is a DOM overlay, which is what `ui/`
   is for, and it imports `config` only, so the layering rule holds. **Say the
   word and I will fold it into `main.js`.**

2. **`CONFIG.detection.scoreScale` added (value 1.85).** Not a number in the
   spec. Since r155 Three.js light intensity is physical (candela, `decay = 2`),
   so raw intensities are in the tens and Section 7.1's summed score would clamp
   to 100 permanently. This scalar maps the physical sum into the 0–100 meter
   range. The formula shape from Section 7.1 is unchanged. Will be tuned in
   Phase 5 against checks 8 and 9.

3. **`CONFIG.map.shadeSpawnCount = 4`.** See Q1 above.

4. **`?seed=` URL parameter.** Debug-only, needed so a human can run Section 16
   check 28 ("restarting with the same seed reproduces identical AI patrol
   order") without editing source.

### Known issues

- The scene is empty, so the canvas renders as flat fog colour and `draw calls`
  reads 0. Correct for this phase — geometry arrives in Phase 2.
- `shadow lights` reads `0 (want 1)` in the overlay until the map exists.
- Several overlay rows (visibility, AI state, effect count, noise events, Shade
  position) do not appear yet. The overlay is data-driven and renders only the
  fields present in `debugState`; systems add their own as they come online.
  This is deliberate — a partial build reports honestly rather than showing
  dead rows.

### Verification actually performed

Served with `npx serve` on port 5173 and driven in a real Chromium browser.

- **Boot:** zero console errors, zero warnings. Logged
  `BLACKLINE three r180 seed 2709321559 F3 debug F4 test mode`.
- **Render path:** WebGL 2.0 context, `renderer.render()` does not throw,
  `gl.getError()` returns 0, `outputColorSpace` is `srgb`, tone mapping is
  `NoToneMapping`, shadow map enabled with `PCFSoftShadowMap`.
- **AUTO suite (F4 → Y): 8 passed, 0 failed.** Output pasted below.
- **F3 / F4 / test-mode keys:** verified by dispatching real `KeyboardEvent`s on
  `window` and running the same `pollKeys()` the loop calls. F3 toggles the
  overlay (9 rows of live data), F4 toggles the test panel, `T` cycles the time
  scale 1 → 0.25 → 4 through a live handler, `1` reports `no handler yet`, and
  test-mode keys are confirmed **inert** when the panel is closed.
- **Static:** `Math.random` — 0 occurrences in `src/` (comments only).
  `setTimeout`/`setInterval`/`TODO`/`FIXME` — 0 occurrences. Import graph
  verified acyclic and downward-only.

```
PASS  prng-determinism              check 28 (part)      2000/2000 identical on same seed, 2000/2000 differ on seed+1
PASS  prng-range-bounds             Section 2            0 out-of-range values across 8000 draws
PASS  fixed-timestep-invariants     Section 15           0 violations over 48 plans, max 5 steps/frame (cap 5)
PASS  timescale-scales-feed-not-dt  Section 8.3 / 15     1s of wall clock -> 60 steps at 1x, 15 at 0.25x, 3 at 0.05x
PASS  single-camera-object          Section 15           1 camera(s) in graph, isEngineCamera=true, second instantiation refused=true
PASS  emitter-contract              Section 3.1          firstEmit=2/reported 2, once fired 1x, lastEmit reported 4, survivedThrow=1, residual=0
PASS  no-nan-after-sustained-stepping Section 17         600 steps, sim=10.00s, finite=true, new assertion failures=0
PASS  match-state-rebuilt-on-init   Section 15           newObject=true score=0/0 round=1 rounds=0 seed preserved=true

8 passed, 0 failed
```

### Not verified (needs a human)

The browser pane used for the checks above was not compositing frames, so
`document.hidden` was `true` and `requestAnimationFrame` never fired. Everything
above was driven synchronously instead. Two links in the chain were therefore
**not observed running**:

- `requestAnimationFrame` actually calling `frame()` each tick, and with it the
  measured FPS / frame-ms readout.
- Anything visual on the canvas.

Both are single call sites that read correctly, but I did not watch them run.
See the checklist in the response for what to look at.

### Exact next action

Phase 2 — map and physics. **Done, see below.**

---

## Phase 2 — map geometry, collision, spawns, sites, lights, markings

**Status:** complete. Tagged `phase-02`.

### What was built

- **`src/physics.js`** — swept AABB solver. A depenetration pass runs first so
  the solver never starts from an invalid state, then the actor box is swept
  along its whole displacement (Minkowski-expanded slab test), stopped at the
  first time of impact, and slid along the surface for up to four passes.
  Uniform-grid broadphase over XZ with a stamp table, so a query allocates
  nothing. Also provides `raycast()` and `lineOfSight()` — needed later by light
  sampling, AI perception, hitscan and the grenade tunnelling check — plus
  `overlap()`/`isClear()`, which is the API the Phase 3 parkour safety rule will
  call before committing any vault, mantle or pull-up. `classifyLedge()` lives
  here so the controller and the marking pass share one implementation.
- **`src/map.js`** — "Meridian Substation". 71 collision boxes. Turbine Hall
  (site A, brightly lit), Loading Bay (site B, two roller doors, crate stacks),
  corridor ring, Server Vault (site C, darkest), two office rooms with
  waist-high cover, three catwalks over the hall plus a cross walkway, three
  vent runs, two crate-stack mantle routes, and a one-way drop shaft.
  12 destructible point lights each with a `lightId`, emissive fixture and
  separate glass element; one hemisphere, one shadowed directional key and one
  unshadowed fill. 14 waypoints with bidirectional links. 4 Shade insert points,
  4 Warden spawns, 3 pulsing site rings.
- **Freefly camera** in `main.js` for the Phase 2 exit gate. It moves the one
  existing camera; it never creates another.
- **Toon gradient** — 4-step `DataTexture`, `RedFormat`, nearest filtering.
  Verified against the r180 shader chunk, which samples
  `texture2D(gradientMap, coord).r`.

### How marking/collision drift is made structurally impossible

`addSolid()` creates the mesh and the `CollisionBox` from one spec — this file
never creates one without the other. `generateAffordanceMarkings()` then runs a
single pass over the collision boxes: for each box flagged `climbable` it
computes the rise above the surface you would stand on to climb it, classifies
that with the same `classifyLedge()` the controller calls, and emits the marking
the spec assigns to that band. No ledge is marked by hand and no band is
authored. Flip `climbable` and the stripe appears; move the box and the band
reclassifies. Currently 25 climbable boxes → 25 marked (14 vault, 8 mantle,
3 hang).

### Vertical layout

Ground 0, catwalk/upper floor 4.0, ceiling 8.0, vent floor 2.3. Chosen so the
traversal chain lands inside the Section 6.1 bands by construction:
ground → **mantle 2.3m** onto a vent lip → crouch the vent → **mantle 1.7m**
onto the catwalk. Crate stacks give the second route: **vault 1.0** → **mantle
1.3** → **mantle 1.7**.

### Bugs the build-time validation caught (and I fixed)

1. `catwalk-east` classified into no band. The vent's 0.12m-thick side walls
   passed underneath it and were being treated as a standing surface, collapsing
   its rise to 0.1m. Fixed by requiring a support candidate to be at least an
   actor-diameter wide in both axes, and by trimming the vent walls to the
   height of the roof.
2. AI waypoint 3 was embedded inside `vent-exit-platform-0` — and despite its
   `corridor-nw` tag was actually inside the Turbine Hall. Moved to the corridor.
3. The drop shaft was a box floating in mid-air: there was no upper floor at
   those coordinates to put a hole in. Rebuilt the office floor in four pieces
   with a real opening, ringed by hazard lip bars.
4. Three "Loading Bay" lights were at y 6.4, above the office floor at y 4.0 —
   they were lighting the upper rooms and leaving the bay dark. Dropped to 3.5.

### Files touched

```
src/physics.js   (new)
src/map.js       (new)
src/main.js      (map wiring, toon gradient, freefly, 6 new AUTO checks)
src/config.js    (vertical layout constants)
src/ui/debug.js  (3 new overlay fields)
```

### Deviations from spec

5. **Inverted-hull outlines are applied to props, not the static shell.**
   Section 4 lists the technique without scoping it. Outlining all 71 shell
   boxes would roughly double draw calls against a 60fps-on-integrated-graphics
   target, for silhouettes that read fine from the vertex tint and the emissive
   stripes. Crates, cover and racks — the things you read as interactive — do
   get outlines, as will both characters. Easy to extend if you want it
   everywhere.
6. **Step-up (`CONFIG.shade.stepHeight`, 0.32m) added to the solver.** Not in
   the spec. Without it a swept-AABB actor snags on every sub-vault lip. It
   validates the raised destination is clear before committing, same as the
   parkour rule.
7. **Vent height gain.** Section 5 says the vents "connect ground corridor to
   upper catwalks" but not how the 4m is gained, and there is no climb mechanic
   in scope. Resolved with the mantle → vent → mantle chain described above.

### Known issues

- The Loading Bay's east strip (x 26–30) is open to the ceiling while the rest
  of the bay is capped by the office floor. Intentional but worth an eye during
  the walkthrough.
- No entities yet, so the freefly camera has no collision — it flies through
  walls by design.

### Verification actually performed

**AUTO suite: 14 passed, 0 failed.** Run in a real browser. Six checks are new
this phase:

```
PASS  exactly-one-shadow-caster       | 15 lights, 1 shadow caster(s), 0 shadowed point lights, shadow map 1024x1024
PASS  markings-match-collision-flags  | 25 climbable, 25 marked, 0 band mismatches (vault 14, mantle 8, hang 3)
PASS  waypoint-graph-valid            | 14 nodes, 0 asymmetric links, 14 reachable from node 0, 3/3 sites covered
PASS  swept-collision-no-tunnelling   | 0 breaches; 6.5m/s -> x=-29.659, 50m/s -> x=-29.659, 200m/s -> x=-29.659, 1000m/s -> x=-29.659 (wall face at x=-30)
PASS  spawns-and-sites-clear          | 4 shade spawns, 4 warden spawns, 3 sites, 14 waypoints all clear
PASS  light-break-is-permanent        | active 12 -> 11, intensity 26 -> 0, repeat break returned null=true
```

The tunnelling result is the one worth noting: an actor driven at **1000 m/s**
into a wall for 180 fixed steps ends at x = -29.659 against a wall face at
x = -30, which is exactly resting contact for a 0.34m radius. It does not pass
through at any speed tested.

Render cost from the freefly start position: **171 draw calls, 2520 triangles,
4 shader programs, 2 textures, GL error 0.** Zero console errors, zero warnings.

Drop shaft verified by raycast: straight down through the opening reaches
`ground-floor` at y=0; the same ray 4m to the west hits office geometry at
y=4.95.

### Not verified (needs a human)

Everything visual. As in Phase 1, the browser pane was not compositing, so
`requestAnimationFrame` never ran and nothing was rendered to a screen I could
look at. I have not seen this map. Specifically unverified: whether it *looks*
right, whether the markings read at distance, whether the light pools give the
high-contrast language Section 4 asks for, and the freefly feel.

### Exact next action

Phase 3 — the Shade controller. **Done, see below.**

---

## Phase 3 — Shade controller  ⟵ CHECKPOINT

**Status:** complete. Tagged `phase-03`.

### What was built

- **`src/entities/agent.js`** — the Shade. A seven-state machine (GROUND, AIR,
  SLIDE, VAULT, MANTLE, HANG, PULLUP) driven from the fixed step by an `intent`
  object rather than by reading input directly, which is what makes it
  headlessly fuzzable. Gravity with terminal velocity, ground/air acceleration
  and friction, coyote time and jump buffering, crouch with validated stand-up,
  sprint, slide, vault, mantle, ledge hang with pull-up and drop, procedural
  limb animation, ground blob, and the collision-aware third-person camera rig.
- **`main.js`** — Shade wiring, intent translation from input, `setCameraOwner()`
  reparenting between the freefly rig and the Shade rig, three new runtime
  assertions and seven new AUTO checks.

### Parkour safety rule

`_commitMove()` is the only path into VAULT, MANTLE or PULLUP. It calls
`collision.isClear()` on the destination capsule and returns false without
touching state if blocked, so a refused move leaves position, velocity and state
exactly as they were. `_tryHang()` validates its own destination the same way.
`_resize()` validates headroom before growing, so standing up inside a vent
fails rather than pushing the player through the roof. Verified by
`parkour-safety-gate` and `crouch-blocked-under-vent-roof`.

Ledge detection calls the same `classifyLedge()` map.js used to place the
stripes, so what is marked is exactly what is climbable.

### Phase 2 bugs that Phase 3 exposed (and I fixed)

Building the controller made three latent map errors visible:

1. **The vent runs were unusable.** They spanned x -6..6.4, which starts inside
   the Turbine Hall's east wall, and their exit platforms were at x ≈ -9.8 to
   -14.6 on the far side — so they connected nothing and could not be entered.
   Rebuilt: three runs from x -13 (hall) to x -1 (corridor), with the hall east
   wall now **generated around them** from the same run list, so a vent can
   never again end up buried in a wall. Added a `catwalk-spine` linking all
   three exit platforms into the catwalk network.
2. **`ventHeight` was 1.0m but `crouchHeight` is 1.05m** — the vents were
   impassable, not crouch-only. Raised to 1.15m. Also inset the roof 1.3m from
   each mouth (`ventMouthLength`): a mantle commits at *standing* height, so a
   roof flush to the end made the lip unmantle-able and the run unreachable.
3. **No hang-band ledge was actually reachable.** The only hang-band edges were
   catwalks at 4.0m, whose faces sit above the probe range, so check 6 could
   never fire. Added `hall-container` (3.0m) in the Turbine Hall — jumping at it
   fails the mantle and drops into a hang, which is now tested end to end.

### Files touched

```
src/entities/agent.js  (new)
src/main.js            (Shade wiring, camera reparenting, assertions, 7 AUTO checks)
src/map.js             (vent rebuild, hall wall generation, catwalk spine, container)
src/config.js          (ventHeight, ventMouthLength)
src/ui/debug.js        (grounded field)
```

### Deviations from spec

8. **Freefly is retained but disabled.** It is the Phase 2 verification tool and
   still useful for map inspection. Re-enable from the console with
   `BLACKLINE.freefly.enabled = true`. No new keybinding was invented for it.
9. **`hall-container` and `catwalk-spine` are geometry the spec does not list.**
   Both were added to make spec'd mechanics reachable (ledge hang; vents
   reaching the catwalks) rather than to add content.

### Known issues

- The fuzz run reaches GROUND, AIR and SLIDE but never randomly triggers VAULT,
  MANTLE or HANG — random input rarely lines a sprint up square with a ledge.
  Those three have dedicated deterministic tests instead, but they are not
  covered by the fuzz.
- Camera pull-out smoothing uses a fixed 1/60 rate rather than the real frame
  delta. Snap-in is immediate (correct); ease-out is very slightly frame-rate
  dependent. Cosmetic.
- No noise emission yet (Phase 5). `strideDistance` and `landedFallHeight` are
  tracked and ready for it.
- Section 4.2 rim-light feedback is Phase 5, as scheduled. The Shade currently
  uses plain `MeshToonMaterial`.

### Verification actually performed

**AUTO suite: 21 passed, 0 failed.** Run in a real browser. Zero console errors
and zero warnings on a fresh tab. Seven checks are new this phase:

```
PASS  shade-invariants-under-fuzz  | 7200 steps: 0 NaN, 0 below floor, 0 bad states, lowest feet y=0.001 (limit -0.5), peak speed 8.00m/s, states seen [ground air slide]
PASS  parkour-safety-gate          | blocked destination refused=true, state/position untouched=true, clear destination accepted=true
PASS  failed-mantle-becomes-hang   | band=hang rise=2.50, hang state=hang clear=true feetY=1.65, pullup entered=true landed on top=true clear=true, crouch drop=true
PASS  sprint-vault-clears-a-crate  | crate rise 1.00m (vault) top y=1.00, vault entered=true, landed feetY=1.120 z=-11.36 (crate z -12..-9.8), capsule clear=true
PASS  vent-runs-are-crouch-only-and-enterable | 3 runs crouch-only and enterable; chain ground -> lip 2.30m (mantle) -> platform -> catwalk 1.70m (mantle)
PASS  shade-speeds-match-spec      | walk 3.50/3.5, sprint 6.50/6.5, crouch 1.60/1.6 m/s
PASS  crouch-blocked-under-vent-roof | crouched capsule fits vent=true, stand-up refused=true, height unchanged=true
```

The phase-3 exit gate is `shade-invariants-under-fuzz`: two simulated minutes of
seeded random input across all four spawns, **0 NaN, 0 frames below the floor,
0 invalid states**, lowest feet position y=0.001 against a limit of -0.5.

### Not verified (needs a human)

Still nothing visual. The browser pane never composited, so
`requestAnimationFrame` never ran. **I have never seen this game rendered.**
Unverified: how any of it looks, and — importantly — how the movement *feels*,
which no assertion can measure.

### Post-checkpoint fix: ledge hang was inescapable

Reported from play: while hanging, Space did nothing and Ctrl only worked after
a couple of attempts.

**Cause.** Both hang inputs read the *edge* flags (`jumpPressed`,
`crouchPressed`), but a hang is almost always entered mid-jump with Space still
held down. A held key generates no new keydown, so `pressed('jump')` stays false
and the pull-up waited for a press the player had no reason to make. Ctrl had
the same fault: if it was already held, it needed a release and re-press, which
is exactly "works after a couple of attempts".

This was invisible to the old AUTO check because the test set `jumpPressed`
directly, which is the one thing real play never produces.

**Fix.** Hang inputs now read the held key (`intent.jump` / `intent.crouch`),
gated by `CONFIG.shade.hangInputGrace` (0.18s) so a held jump does not resolve
on the same frame the ledge is caught. Release the key within the grace to stay
hanging. Also added a defensive guard so a HANG state with no stored ledge drops
to AIR rather than freezing the player.

Audited the other edge-triggered inputs: ground jump and slide entry are both
correctly edge-driven, because in each case the key is necessarily released
before the state is entered. The hang was the only one affected.

The AUTO check now reproduces the reported failure exactly — jump HELD and never
freshly pressed — and additionally asserts that idling leaves you hanging, that
a held crouch drops you, and that a fresh grab waits out the grace:

```
PASS  failed-mantle-becomes-hang | band=hang rise=2.50, hang clear=true feetY=1.65, idle stays hanging=true,
      HELD jump pulled up=true, landed on top=true clear=true, HELD crouch dropped=true,
      fresh grab waited 11 steps (grace 11, ok=true)
```

Suite still 21 passed, 0 failed.

### Post-checkpoint fix 2: traversal dead ends

Reported from play, with a screenshot: stranded on top of the tall container,
unable to climb anywhere; and pull-up from a hang still sometimes did nothing,
while Ctrl-then-W worked.

Three separate causes:

1. **A vault-band ledge could only be climbed by sprinting at it.** `_tryVault`
   requires sprint plus forward, and the airborne auto-climb `_tryMantle` only
   handled the mantle and hang bands. So jumping at a 0.4–1.2m ledge did
   nothing, and on a small platform there is no room to build sprint speed.
   `_tryMantle` now climbs vault-band ledges from the air as well.
2. **`hall-container` was an isolated island.** It was added in Phase 3 purely
   as a hang target and never connected to anything, so its top was a trap.
   Moved to x -21.5..-18.5, half a metre from the catwalk spine: from 3.0m the
   spine at 4.0m is now a 1.0m vault.
3. **Climbs had no crouched fallback.** Every climb committed a standing-height
   capsule, so any ledge with a low ceiling silently failed with no feedback —
   which is why dropping and re-mantling (Ctrl then W) found a different ledge
   and worked. New `_climbOnto()` tries standing, then crouched, and the
   traversal adopts the height it validated against. Pull-up also re-probes from
   the current position before giving up, since the stored ledge goes stale
   after a shimmy.

### Added by request: shimmy while hanging

10. **Lateral movement while hanging** (`CONFIG.shade.hangShimmySpeed`, 1.15
    m/s). Not in the spec — Josh asked for it. `_shimmy()` refuses to move
    unless the body still fits *and* the ledge actually continues at the
    destination, so you cannot shimmy off the end of an edge into thin air.
    Say the word and it comes out.

New AUTO checks, suite now **23 passed, 0 failed**:

```
PASS  container-top-is-not-a-dead-end | container top 3.0 -> spine 4.0 is 1.00m (vault); climbed without sprint=true, reached spine=true, clear=true
PASS  hang-shimmy-stays-on-the-ledge  | z -8.50 -> -10.00 (ledge z -10..-7), moved=true, still hanging=true, clear=true, stayed on ledge=true
```

Markings reclassified consistently after the container move: 27 climbable, 27
marked, 0 band mismatches (vault 16, mantle 10, hang 1).

### Post-checkpoint fix 3: auto-climb hauled you back up when dropping off

Reported from play: stepping backwards off a ledge automatically pulled the
Shade back onto it.

**Cause.** `_probeLedge()` casts along the direction the Shade is *facing*,
which is not necessarily where it is *going*. Backing off a ledge leaves you
still looking at the face you just left, so the airborne auto-climb — which runs
every step in AIR — found it and climbed straight back up. Getting down off
anything you were facing was impossible.

**Fix.** `_tryMantle()` now takes the intent and requires `_isApproaching()`:
either forward input, or at least `CONFIG.shade.mantleApproachSpeed` (0.6 m/s)
of velocity into the ledge. Deliberately approaching still climbs and still
hangs; drifting or stepping away no longer does. This also gates `_tryHang()`,
since it is reached through the same path.

New AUTO check, suite now **24 passed, 0 failed**:

```
PASS  backing-off-a-ledge-does-not-re-climb
      walked backwards off a 3.0m ledge: re-climbed=false, ended feetY=0.00 grounded=true;
      approaching forwards still grabs=true
```

The check asserts both halves — that backing off falls to the floor, and that
approaching forwards still grabs — so the fix cannot be "solved" by breaking
climbing altogether.

### Post-checkpoint fix 4: climbability is now derived, not hand-flagged

Reported from play, with a screenshot: a catwalk surface could not be climbed.

**Cause.** Only boxes I had typed `climbable: true` on were ledges. That is the
same failure Section 5 warns about, just one level up — the marking was
generated from a flag, but the flag itself was authored by hand, so any surface
I missed became an invisible wall on something that plainly looks climbable.

**Fix.** `deriveClimbableSurfaces()` runs after `collision.build()` and decides
climbability from the geometry. A surface qualifies when its top is at least an
actor-diameter across in both axes (somewhere to land), has at least crouch
headroom above it, and rises into a traversal band. Climbable surfaces went from
**27 to 36**, and all 36 are marked.

`noClimb` opts a surface out, used only on the office floor to keep the drop
shaft one-way as Section 5 requires.

Headroom is sampled at three points along the surface rather than at its centre
alone. With a single centre sample, `vent-north-roof` was excluded because that
one point sits under `catwalk-east`, while the other two vent roofs were
included — a long ledge that passes under one obstruction is still climbable
everywhere else.

Remaining exclusions are all justified and asserted to be: the ground plane
(rise 0), full-height walls (no headroom), thin walls and trim from 0.12m to
0.4m (nowhere to land), and the `noClimb` office floor.

New AUTO check, suite now **25 passed, 0 failed**:

```
PASS  climbable-surfaces-are-derived-not-hand-flagged
      36 climbable surfaces derived and marked; 28 obvious traversal surfaces all climbable;
      every exclusion justified (too thin, out of band, no headroom, or noClimb)
```

It walks every non-climbable solid and fails if any is wide enough to stand on,
in a band, has headroom, and is not explicitly opted out — so a surface cannot
silently become unclimbable again.

Two test-harness faults were fixed alongside, both mine rather than the game's:
one call site was still invoking `_tryMantle()` with no intent, and the
backing-off check originally used the container's east edge, which the catwalk
spine overhangs, so the Shade could not walk off at all. It also reported
`grounded` sampled after a later repositioning, which described a different
moment than the assertion it accompanied.

### Exact next action

Phase 4 — the Warden controller. **Done, see below.**

---

## Phase 4 — Warden first-person controller

**Status:** complete. Tagged `phase-04`.

### What was built

- **`src/entities/enforcer.js`** — the Warden. First person, heavy, no crouch.
  Walk 3.0 / sprint 5.0 / ADS 1.8 m/s, gravity and ground handling through the
  same swept solver, `stun()` for the taser and stun grenade, `lookAt()` and
  `forwardVector()` for the AI to aim with, bulky procedural mesh (wide box
  chest, short legs, dominant helmet, heavy pauldrons), ground blob.
- **`main.js`** — role-based camera ownership, Warden wiring, free-roam routing,
  four new overlay fields, three new AUTO checks.

### One controller, two drivers

Section 6.2 calls the Warden "AI-controlled, and human-controlled in free-roam
only" and Section 12 requires free-roam to be "a configuration, never a
duplicated code path". So `Warden` never reads input and never runs AI — it
consumes an `intent` object. `readWardenIntent()` fills it from the keyboard in
free-roam; the Phase 6 AI will fill the identical structure. There is one
`step()`.

### Camera handover (the exit gate)

`setCameraOwner('freefly' | 'shade' | 'warden')` reparents the single camera and
resets local position, rotation, scale and FOV on every handover. The leak this
guards is concrete: the Warden's ADS narrows FOV to 52, and without the reset,
swapping away mid-aim would leave the Shade permanently zoomed. `initMatch()`
clears the owner so nothing survives a match boundary either.

### Files touched

```
src/entities/enforcer.js  (new)
src/main.js               (camera owner, warden wiring, freeroam routing, 3 AUTO checks)
src/ui/debug.js           (4 overlay fields)
```

### Deviations from spec

11. **`?mode=freeroam` URL parameter**, debug-gated. Section 12 puts free-roam
    behind a menu entry, and the menu is Phase 10. This selects the same
    `initMatch({ mode: 'freeroam', role: 'warden', ai: false, objective: false })`
    config in the meantime, so the Warden can be driven by hand now.

### Known issues — one is a Phase 6 blocker

- **The Warden has no way to change floors.** Section 6.2 gives it walk, sprint
  and ADS, explicitly denies crouch, and says nothing about jumping. The map's
  vertical routes are all Shade-only: vents are crouch-only, the mantle chains
  need a climb, and the drop shaft is one-way down. But the waypoint graph links
  ground nodes to upper nodes (0↔10, 3↔10, 9↔13) across a 4m gap, and
  `waypoint-graph-valid` asserts that graph is connected.

  So in Phase 6 the AI will path across links it cannot physically walk. The
  spec-faithful fix is a **walkable staircase or ramp** between floors — the
  Warden is heavy and walks, so the level should accommodate it rather than the
  Warden gaining a climb. Free-roam ("map learning") needs it too. I have not
  built it: it is map scope that Phase 2 did not call for and I would rather not
  add geometry unasked. **Flagging for a decision before Phase 6.**
- No weapon, no firing, no reload yet — that is Phase 7. `intent.fire` and
  `intent.reload` are carried on the intent and currently unread.
- No AI, so in competitive the Warden stands on its spawn. It is still stepped
  each frame so gravity settles it.

### Verification actually performed

**AUTO suite: 28 passed, 0 failed.** Zero console errors. Three new:

```
PASS  camera-swap-leaks-no-state   | 7 handovers across shade/warden/freefly: parent, local transform, scale and FOV reset every time; ADS fov 52.0 restored to 70; exactly 1 camera throughout
PASS  warden-speeds-and-no-crouch  | walk 3.00/3, sprint 5.00/5, ads 1.80/1.8 m/s; no crouch api=true, capsule height fixed=true
PASS  warden-shared-by-ai-and-human| freeroam config=true, moved by intent alone=true, stunned freeze=true state=true, recovered=true, returned to competitive=true
```

The camera check deliberately dirties position, rotation, scale and FOV before
every handover, so it fails if any one of them survives.

Free-roam boot verified live at `?mode=freeroam`: mode/role/ai/objective correct,
camera parented to `warden-camera-rig`, body hidden in first person, walking
5.84m in two seconds, eye height 1.76 matching the rig at 1.77, FOV 70.

### Not verified (needs a human)

Weapon feel is not applicable yet. Unobserved: how the Warden looks and moves on
screen, whether first person sits at a comfortable height, and whether the ADS
FOV transition reads well.

### Post-phase-4 fix: staircases so the Warden can change floors

Approved by Josh. Two walkable staircases, generated by one `addStaircase()`
helper from `CONFIG.map.stairSteps / stairRise / stairRun`:

- **`stair-hall`** — Turbine Hall west wall, ascending north-to-south onto
  `catwalk-north`.
- **`stair-vault`** — south-east strip, ascending west-to-east onto a landing at
  the Server Vault's south entrance. Without it site C is undefendable: the
  vault is otherwise cut off from the rest of the upper floor.

Step rise is 4.0/13 = 0.308m, deliberately under **both** actors' step-up
heights (Shade 0.32, Warden 0.35), so the swept solver carries either over the
lip. Tread depth 0.4m is under an actor diameter, so
`deriveClimbableSurfaces()` skips the steps and they carry no affordance
stripes — a staircase is walked, not vaulted.

Also widened `office-wall-w`, which ran to z = -6 and left a 0.4m slot the
Warden's 0.84m capsule could not pass, sealing the upper east rooms off
entirely. It now stops at z = -9, leaving a proper doorway onto the cross
walkway.

```
PASS  warden-can-walk-between-floors
      2 staircases, step rise 0.308m under both step-ups (shade 0.32, warden 0.35)=true;
      stair-hall: reached=true feetY=4.00/4.00 clear=true;
      stair-vault: reached=true feetY=4.00/4.00 clear=true
```

The check actually drives the Warden up each flight from the floor rather than
measuring the geometry. Suite: **29 passed, 0 failed.** Collision boxes 79 → 106.

Clearance spot-checks on the new route: office doorway, office interior, cross
walkway, both stair tops, catwalk-north, the vault landing, the vault entrance
and site C all admit a standing Warden capsule.

---

## REQUESTED: Meridian Substation v2 — map redesign (do this BEFORE Phase 5)

Josh requested this after Phase 4. It is a redesign of `map.js`, not a tweak: it
changes the vertical layout, the building shell, the spawn model and every
traversal chain. **Done — see the entry below.** The plan as written is left
intact for comparison against what was actually built.

### Requirements, verbatim intent

1. **Raise level 2 / higher ceilings on level 1.** Level 1 currently has 4.0m to
   the catwalk deck, which is cramped.
2. **Level 2 is ONE level the Warden can roam entirely.** Today the upper floor
   is fragments — catwalks, offices and the vault — stitched by a cross walkway
   and two staircases. It must become a single connected deck.
3. **The Shade starts OUTSIDE the building.** All Shade spawns move to an
   exterior area; the building becomes a shell to infiltrate.
4. **More stairless routes between levels for the Shade.** Vents, mantle chains,
   drop shafts — the Shade should never need the Warden's stairs.
5. **Every room has more than one Shade entry.** No single-door rooms.

### Layout plan

**Heights** (`CONFIG.map`): `catwalkY` 4.0 → **6.0**, `ceilingY` 8.0 → **11.0**.
Level 1 gains ~2m of headroom; level 2 gets 5.0m. Consequences to work through:

- `stairSteps` must rise 6.0 now. At the 0.32/0.35 step-up ceiling, 20 steps of
  0.30m over 8.0m of run. Both staircases need the extra run length.
- The Shade's chain to level 2 no longer fits one hop: 6.0m is above `hangBand`
  max (4.2), so **intermediate platforms are mandatory**. Target chain:
  ground → 1.0 (vault) → 2.3 (mantle) → 4.0 (mantle) → 6.0 (mantle).
- Vent runs want two tiers: keep one at 2.3, add one at 4.3.
- Light fixture heights, the shadow frustum (`CONFIG.render.shadowFrustum`) and
  fog density all key off the old ceiling and need re-checking.

**Level 2 as one deck.** Lay a continuous floor plate at y=6.0 over the whole
footprint, then subtract voids — over the Turbine Hall (so the catwalks still
overlook it) and over the shaft. Walk the perimeter to confirm the remaining
plate is one connected region. This replaces the current fragment-plus-walkway
approach, which is what forced the 0.4m doorway bug.

**Exterior.** Extend the ground plane to roughly 80×65 and make the current
perimeter walls a building shell with multiple breaches: the two roller doors,
at least two vent mouths at grade, and a roof/upper entry. Move all four Shade
insert points outside; keep the four Warden spawns inside.

### AUTO checks to write alongside it

These make the requirements enforceable rather than aspirational, in the same
spirit as `climbable-surfaces-are-derived-not-hand-flagged`:

- `warden-upper-deck-fully-connected` — flood-fill the walkable upper surface
  from one stair top on a coarse grid; assert every upper waypoint and every
  upper room centre is reached. This is requirement 2, and it is the one most
  likely to silently regress.
- `shade-spawns-are-outside-the-shell` — assert every Shade spawn lies beyond
  the building footprint, and that each has a clear standing capsule.
- `shade-reaches-level-2-without-stairs` — drive the Shade up a non-stair chain
  and assert it reaches y=6.0; explicitly exclude staircase boxes from the
  route.
- `every-room-has-two-entries` — declare rooms with their entry apertures in the
  map data; assert each has ≥2 that admit a Shade capsule. Derive from geometry
  where possible so it cannot drift.
- Existing `warden-can-walk-between-floors` and `spawns-and-sites-clear` must
  keep passing.

### Risk

The current 29-check suite pins a lot of this map's geometry (ledge bands, vent
clearances, the container-to-spine vault, spawn clearances). Expect several to
fail during the rework — that is the suite doing its job. Re-derive rather than
loosen the assertions.

---

---

## Meridian Substation v2 — map redesign

**Status:** complete. All five requirements are enforced by AUTO checks rather
than trusted. Suite: **34 passed, 0 failed.**

### What was built

- **`src/mapkit.js` (new)** — the construction kit. `addSolid()` is still the
  only way to make geometry, and everything above it generates calls into it:
  `addWall()` subtracts openings from a wall plane, `addFloorPlate()` subtracts
  voids from a slab, `addStaircase()` derives its own stairwell, `addVentRun()`
  builds a duct and hands back the opening every wall it crosses needs.
- **`src/map.js` (rewritten)** — the level. 214 collision boxes, an 80×65 site
  with the building as a shell inside it, one continuous upper deck, five
  stairless routes up, and five declared rooms whose entries are derived.

### The five requirements, and how each is held in place

| Requirement | Built | Enforced by |
|---|---|---|
| 1. Raise level 2 | `catwalkY` 4.0 → **6.0**, `ceilingY` 8.0 → **11.0**. Level 1 gains 2m, level 2 gets 5m. | The traversal chains below; a rise out of band fails at build time |
| 2. Level 2 is one deck | One plate at y=6.0 over the whole footprint, minus six voids | `warden-upper-deck-fully-connected` |
| 3. Shade starts outside | All four spawns on the apron; Warden spawns stay inside | `shade-spawns-are-outside-the-shell` |
| 4. Stairless routes | Five, driven end to end by the controller | `shade-reaches-level-2-without-stairs` |
| 5. No single-door rooms | 5 rooms, 3–7 entries each | `every-room-has-two-entries` |

### Vertical layout

A 6m deck is above `hangBand`, so intermediate tiers are structural, not
decorative — the Shade physically cannot reach level 2 in one move. Both chains
land inside the Section 6.1 bands by construction:

```
crates   ground -> 1.0 vault -> 2.3 mantle -> 3.0 vault -> 4.0 vault -> 6.0 mantle
vents    ground -> 2.3 mantle -> 4.3 mantle -> 6.0 mantle
```

The five ways up, all verified by driving the controller through every hop:

| Route | Rises |
|---|---|
| Turbine Hall crates → gantry → deck lip | 1.3 / 0.7 / 1.0 / 2.0 |
| Lower vent → maintenance platform → deck lip | 2.0 / 1.7 |
| Loading Bay crates → gantry → deck lip | 1.3 / 1.7 / 2.0 |
| Corridor crates → upper vent → hatch in the vault floor | 1.3 / 2.0 / 1.7 |
| Fire escape (outside the north wall) → roof | 1.3 / 2.0 / 1.7 / 2.0 / 2.0 / 1.4 |

### Two decisions worth stating

**The deck is `noClimb` except at four declared lips.** A 6m edge is not
something to scramble up, and without the flag every cell that happened to have
a gantry beneath it would silently become a ledge. Climbing onto level 2 happens
only where a route arrives, which is what makes the routes mean anything. The
lips hang deeper than the slab so the Shade's ledge probe gets more than one ray
into the face — see the bug below.

**Stairwells are derived, not authored.** `addStaircase()` finds the first step
whose tread plus standing headroom breaks the deck underside and opens the hole
from there, backed off by a radius, a tread and a step-height. Move a flight or
change the deck height and the hole follows.

### Bugs this found (three were latent in v1)

1. **Every v1 vent lip was unclimbable.** The ledge probe samples six fixed
   heights above the feet; from the ground those are 0.25/0.6/1.0/1.45/1.9/2.35,
   and a 0.2m floor slab at 2.1–2.3 falls between the last two. The lip
   classified as a mantle, was marked as one, and could never be climbed. Fixed
   with `lipAt`, which thickens the floor at a mouth the Shade climbs into. This
   is the exact class of failure Section 5 warns about, one level lower down —
   the marking and the collision flag agreed with each other and both disagreed
   with the controller.
2. **A redundant vent roof puts the next ledge in the wrong band.** A roof slab
   is wide enough to count as a standing surface, so the marking pass measured
   the vault lip against the roof (0.55m, vault) instead of the vent floor
   (1.7m, mantle). The upper run has no roof: the deck 1.35m above it already
   makes it crouch-only.
3. **A staircase dead-ends two treads from the top** if the stairwell opens at
   the step that breaks headroom. The solver lifts an actor by a full step
   height to test the next tread while it is still centred over the previous
   one, and its body reaches a radius further back again.
4. **Lip cells were split by unrelated cut lines.** The plate tiler cut at every
   void edge on the map, so a lip could be sliced into an offcut narrower than
   an actor and quietly stop being climbable. Lips are now emitted whole.
5. **A fire-escape landing offset above the deck collapses its own climb.** The
   support search takes the tallest nearby surface, so a landing at 6.3 measured
   against the deck at 6.0 read as a 0.3m step, not a 2.0m mantle. The landing
   is now flush.

### Draw calls

The map roughly doubled in footprint and gained a full upper floor, and draw
calls went 171 → 624 worst case. 372 of the 586 meshes were affordance stripes,
dashes and chevrons — decoration, one draw call each. They are now baked into
one mesh per band (three total), which is safe because they never move and share
a material per band. Worst case is **310 calls / 11k triangles**, 102 on the
deck, GL error 0, 6 programs. Section 16 check 29 is still a human check.

Three's `BufferGeometryUtils` lives in the addons bundle, which `index.html`
deliberately does not fetch, so `mergeGeometries()` in `mapkit.js` is the sliver
of it this needs.

### Files touched

```
src/mapkit.js   (new — GameMap and the generators)
src/map.js      (rewritten — Meridian Substation v2)
src/config.js   (vertical layout, stair/vent/room constants, shadow frustum)
src/main.js     (5 new AUTO checks, 8 re-derived)
PROGRESS.md
```

### Deviations from spec

12. **`src/mapkit.js` is an additional file not listed in Section 3.** Section
    3.1 also requires anything past ~600 lines to be split, and the v2 level
    data alone is larger than that. The split is builder vs. level: mapkit knows
    how to make geometry, map.js is the layout. It imports physics and config
    only, so the layering rule holds. **Say the word and I will fold it back in.**
13. **`CONFIG.map.waypointCount` 14 → 20.** Section 5 specifies 14. On an 80×65
    site with a single upper deck, 14 nodes cannot express a graph whose every
    link is a route the Warden can walk — which is the Phase 4 blocker. The
    extra six are stair feet and heads and the deck's ring. If you want 14 back,
    the graph has to accept links that cross the Turbine Hall void.
14. **A site fence.** The play space has to be closed now that the Shade starts
    outside it; without it the apron is an open edge to walk off, and the fuzz
    check duly walked off it. Thin, so it is correctly not climbable, and 4.5m
    so it sits above the hang band.
15. **Affordance markings are one merged mesh per band.** See draw calls above.
    They are still generated in one pass from the collision flags; the merge is
    the last step. Individual stripes can no longer be hidden or moved at
    runtime, which nothing needs.
16. **`src/tests/` is a directory Section 3 does not list.** Section 3 gives the
    AUTO suite no home and Section 3.1 caps a module at ~600 lines; the suite
    reached ~2400 inside `main.js`. Same class of deviation as `ui/debug.js`
    (deviation 1) and `mapkit.js` (deviation 12). Nothing there imports
    `main.js`, so the layering rule holds.
18. **Smoke and footprints are one batched object each, not N sprites.**
    Section 9.1 says "a capped 200-sprite pool on one shared material". The cap
    and the shared material are honoured exactly; the rendering is one
    `THREE.Points` and one `InstancedMesh`, because 200 sprites is 200 draw
    calls and that is the very thing the Section 15 row is guarding against.
17. **`Math.random` fills the audio noise buffer.** Section 2 bans it so that
    gameplay is reproducible from a seed. A one-off audio texture carries no
    gameplay meaning, and drawing 44,100 values from the seeded stream would
    shift every downstream draw and break Section 16 check 28. It is the only
    occurrence in `src/` and is called out at the line.

### New AUTO checks

```
PASS  warden-upper-deck-fully-connected
      5056 walkable deck squares at 0.6m, all 5056 reachable from stair-hall;
      every upper waypoint and room on the same region
PASS  shade-spawns-are-outside-the-shell
      4 shade spawns outside the shell (x -30.4..30.4, z -22.9..22.9) and clear;
      4 warden spawns inside
PASS  shade-reaches-level-2-without-stairs
      5 stairless routes driven end to end: turbine hall crates (1.3/0.7/1.0/2.0m);
      lower vent to hall deck (2.0/1.7m); loading bay crates (1.3/1.7/2.0m);
      upper vent into the vault (1.3/2.0/1.7m); fire escape to the roof
      (1.3/2.0/1.7/2.0/2.0/1.4m)
PASS  every-room-has-two-entries
      5 rooms, all with >= 2 verified entries: turbine-hall 3 (east/south/ceiling);
      loading-bay 7 (west/west/east/east/south/ceiling/ceiling);
      server-vault 3 (east/north/floor); office-west 4 (west/east/north/south);
      office-east 3 (west/east/north)
PASS  waypoint-links-are-walkable
      20 links, 965 samples at 0.3m: floor found everywhere, Warden capsule fits,
      no rise above 0.35m
```

`waypoint-links-are-walkable` is not one of the five requirements. It closes the
Phase 4 known issue — the AI was going to path across links it could not walk —
so Phase 6 starts from a graph that has been proven, not assumed.

Room entries are **derived**, not declared: the boundary is walked at a range of
sill heights looking for an opening a crouched Shade can pass through, and the
floor and ceiling planes are sampled for holes. A ceiling hole always counts. A
floor hole only counts when a climbable lip borders it, which is exactly what
separates the vault's hatch from the deliberately one-way drop shaft — the drop
shaft is correctly not counted as an entry to Office East.

### Checks that were re-derived rather than loosened

Eight existing checks pinned v1 geometry. As predicted, several failed. None
were relaxed:

- `hall-container` tests stopped hard-coding `z = -8.5` and now read the box's
  own centre. The container's east face is deliberately kept clear of the gantry
  so a hang has a body's worth of air below the lip.
- `container-top-is-not-a-dead-end` compared against `catwalk-spine`, which v2
  does not have. It now uses `gantry-hall`, and derives its start point and
  facing from the two boxes rather than typing a coordinate.
- The two speed tests moved their run-up lane clear of the new grade vent.
- `vent-runs-are-crouch-only-and-enterable` sampled one midpoint; it now walks
  the whole length of all five runs, skipping samples under a deck void (where
  a run has deliberately opened into the room above), and asserts the two-tier
  chain.
- `waypoint-links-are-walkable` excludes stair treads from its clearance test.
  A capsule standing on a tread always overlaps the risers ahead of it; the
  per-sample rise limit is what proves the flight is walkable.

### Known issues

- **Level 2 is dark.** Only the vault light and the hall pendants (which hang at
  deck level in the void) reach it. Thematically right, but if it reads as
  broken rather than dark, the fix is a light or two on the deck — that costs
  nothing structurally but I did not want to spend the destructible-light budget
  without asking, since Section 5 fixes it at 12.
- **The Turbine Hall's east strip** and the deck above the offices are the two
  places where I am least confident the light contrast reads. Worth an eye.
- **`CONFIG.detection.scoreScale` (1.85) has not been retuned.** It was fitted to
  the v1 light heights. The hall lights kept their height above the floor, so
  check 8 should be close, but Phase 5 owns tuning this against checks 8 and 9.
- Room-entry derivation costs 75ms at build time. One-off; the page loads in
  300ms.
- **Two files are over the ~600-line guidance in Section 3.1.** `map.js` came
  down 1222 → 793 by splitting the kit out, but `mapkit.js` is 1190 and
  `main.js` is 2441. main.js is the older problem and it is almost entirely the
  AUTO suite — roughly 1700 of those lines are the 34 checks, which Section 3
  gives no home to, the same gap that produced `ui/debug.js` in Phase 1. The
  obvious split is a `tests/` module the composition root registers, and
  `mapkit.js` divides cleanly into generators and the derivation passes. Neither
  is v2 scope, so I have not done it unasked. **Say the word.**
- The v2 plan suggested keeping a vent tier at 2.3 and adding one at 4.3. Built
  as two lower runs at 2.3 and one upper at 4.3, plus two at grade — five runs
  against the spec's three. The extra two are the shell breaches.

### Verification actually performed

Served on port 5173 and driven in a real browser.

- **AUTO suite: 34 passed, 0 failed.** Run after every change, not once at the end.
- **Boot:** zero console errors, zero warnings, on a fresh tab and at
  `?mode=freeroam&seed=12345`. Free-roam config correct; the Warden holds deck
  height while walking on level 2.
- **Render path:** driven synchronously (see below). 295–310 draw calls worst
  case, 102 on the deck, 11k triangles, 6 programs, 2 textures, `gl.getError()`
  returns 0 from every viewpoint.
- **Spot checks by raycast:** the roof hatch drops onto the deck at 6.0; the
  drop shaft drops to the ground and has no climbable lip, so it stays one-way;
  the vault hatch drops onto the upper vent floor at 4.3; the hall void drops to
  the ground.
- **Counts:** 214 collision boxes, 49 climbable surfaces all marked (19 vault,
  30 mantle), 20 waypoints, 5 vent runs, 2 staircases, 12 destructible lights.

### Not verified (needs a human)

Still nothing visual. The browser pane was not displayed, so it never
composited: `document.hidden` stayed `true`, `requestAnimationFrame` never
fired, and screenshots time out. Everything above was driven synchronously by
calling `renderer.render()` directly. **I have still never seen this map on a
screen.**

Specifically unverified, and worth your eye when you walk it:

1. Whether the exterior reads as a building to break into, or as a box in a car
   park.
2. Whether the upper deck reads as one place. It is provably connected; that is
   not the same as legible.
3. Whether the affordance stripes still read at distance now that they are
   merged into one mesh per band — the geometry is identical, but I have not
   seen it.
4. Light contrast on level 2 and in the Turbine Hall (see Known issues).
5. Whether a 6m hall feels good or cavernous, and whether the four-hop climb to
   the deck is satisfying or a chore. No assertion can measure that.
6. The fire escape: five platforms is a lot of climbing. It may want to be
   shorter.

### Post-v2 fix: affordance chevrons were floating in mid-air

Reported from play, with a screenshot: two teal chevrons hanging in space near
the Turbine Hall gantry, unattached to anything.

**Cause.** Section 5 puts the chevrons "on the face below" a mantle ledge, and
`_addChevrons()` put them halfway between the ledge top and the surface it was
measured against. That assumed every climbable box stands on the ground, which
was true in v1. Every v2 lip, gantry, duct floor and fire-escape platform
*hangs* — a thin slab with air beneath it — so the midpoint was empty space.
**22 of 30 mantle ledges** had chevrons floating up to 1.04m below their own
geometry.

**Fix.** The decal is clamped into the box's own vertical span, and also *sized*
to it: a duct roof is 0.12m thick, thinner than the 0.18m decal, so the chevron
shrinks to fit rather than overhanging a face that is not there.

The check asserts against the placement the map actually recorded, not a second
copy of the formula, so it cannot agree with a bug by sharing it:

```
PASS  markings-sit-on-real-geometry
      30 mantle ledges: every chevron sits within the face of the box it marks
```

Also audited while in there: the top-edge stripes ride the ledge's own top face
and cannot drift, and the site rings are floor decals. Chevrons were the only
marking with a free vertical parameter.

---

## Phase 5 — detection: light, visibility, feedback, noise

**Status:** complete. Suite: **41 passed, 0 failed**, zero console warnings or
errors.

### What was built

**`src/systems/detection.js` (new).** Three responsibilities that share one tick
and the same two actors:

- **The visibility meter (7.1).** Sampled every 100ms, never per frame, with a
  hard cap of 5 rays per light and only lights within 20m considered. Score per
  light is `intensity * (1 - distance/range) * unobstructedFraction`, summed,
  scaled, floored, then multiplied by the crouch (0.75) and vent (0) modifiers
  and clamped. Smoothed toward the target with a 250ms time constant.
- **Section 4.2 feedback.** The body colour and the outline brightness are
  written from `this.smoothed` in one function, on the Shade only. They cannot
  disagree with the meter because there is no second source for them to
  disagree from.
- **Noise (7.2).** A fixed pool of 48 events aged down on the fixed step. No
  timers anywhere.

### Three things worth stating

**Breaking a light goes through detection, not the map.** `detection.breakLight()`
is the only route: it calls `map.breakLight()`, invalidates the cache and emits
the 20m noise. Section 15 requires the invalidate to be explicit; routing every
caller through one function is what makes it impossible to forget rather than
merely documented. Verified by breaking a light *mid-interval* — a system that
only resampled on the tick would still have been serving the stale value.

**The sample cadence uses an accumulator, not a reset.** Six 1/60 steps fall a
float's hair short of 100ms, so zeroing the timer silently sampled at 8.6Hz
instead of 10Hz — 18 samples in two seconds rather than 20. Subtracting the
interval keeps the phase. Same discipline as the fixed step itself.

**Silence emits nothing.** A crouch-walking Shade and a Shade in a vent produce
no event at all, rather than a zero-radius event occupying a pool slot that the
AI then has to filter.

### scoreScale, fitted rather than guessed

The Phase 1 placeholder of 1.85 pegged the Turbine Hall at 100 on the v2 map. A
clamped meter passes check 8 and fails the mechanic: it cannot show a light
going out, which is check 10 and half the point of destructible lights.

Measured the unscaled sums on the built map — site A 68.0, site B 28.3, site C
5.0 — and picked **1.2**:

| Where | Meter | Reads as |
|---|---|---|
| Turbine Hall (site A) | 84.6 | exposed, 15 points below the clamp |
| Loading Bay (site B) | 37.0 | mixed |
| Corridor ring | 13.4 | hidden |
| Server Vault (site C) | 9.0 | hidden |
| Inside a vent | 0.0 | unlit regardless of what is outside |

Breaking site A's own fixture now drops the raw value 84.6 → 60.0 on the very
next step. At 1.85 the same break moved it 100 → 90.9, because it had been
sitting against the clamp.

### Files touched

```
src/systems/detection.js  (new)
src/config.js             (feedback constants, scoreScale 1.85 -> 1.2)
src/entities/agent.js     (one shared outline material instead of nine)
src/main.js               (wiring, 5 overlay fields, 6 AUTO checks)
```

`agent.js` gave every outlined part its own `MeshBasicMaterial`. Section 4.2
drives edge brightness every frame, and that should be one assignment, not a
walk over nine materials.

### New AUTO checks

```
PASS  visibility-sampling-stays-in-budget
      20 samples over 2s at 100ms (120 steps); 6 lights in range, 30 rays (cap 5/light)
PASS  visibility-reads-lit-and-dark-zones
      Turbine Hall 84.6 (want >70, unclamped=true), Server Vault 9.0 (want <25),
      inside a vent 0.0 (want 0); scoreScale 1.2
PASS  light-break-invalidates-the-cache
      raw 84.6 -> 60.0 on the next step (no wait for the 100ms tick)=true;
      smoothed 84.6 -> 71.1 within 200ms=true; 20m noise emitted=true
PASS  shade-is-quieter-than-the-warden
      shade walk 4m (4 steps) / sprint 12m (7) / crouch silent;
      warden walk 8m (4) / sprint 18m (6); vent silent
PASS  noise-events-expire-and-are-capped
      flooded 144 -> 48 active (cap 48), pool fixed at 48; silence took no slot;
      drained to 0 in 0.42s (lifetime 0.4s); heard at 4m, not at 12m past an 8m radius
PASS  visibility-feedback-matches-the-meter
      body lightness 0.05 -> 0.35, rim 0.07 -> 0.35 across meter 0..100;
      monotonic, near-black at 0, teal edge still visible at 0,
      driven by smoothed not raw
```

Checks 8, 9 and 10 were **HUMAN** in Section 16. The first two now have an AUTO
half that pins the numbers; you still confirm the on-screen meter agrees with
what you see, which is the part no assertion can make.

### Known issues

- **Level 2 and the corridor read as "hidden" (13 and 8).** That is the lighting
  gap flagged in the v2 entry, not a detection bug — there is little light up
  there to sample. If the deck should be riskier it needs fixtures, and Section 5
  fixes the destructible count at 12, so that is a call for you.
- **Outside is 3 (the ambient floor) everywhere.** Section 7.1 counts point
  lights only, and the apron has none, so infiltration is unlit until you are
  inside. Reads correct to me; worth confirming it does not feel like the meter
  is broken before you enter.
- The Shade's rim is the inverted-hull outline recoloured, not a shader fresnel.
  Section 4.2 asks for "rim light intensity and outline brightness"; this drives
  the second and reads as the first. A true fresnel needs `onBeforeCompile` on
  MeshToonMaterial, which I did not want to take on unasked.
- `main.js` is now 2832 lines, of which roughly 2100 are the 41 AUTO checks. The
  split flagged in the v2 entry is overdue.

### Verification actually performed

- **AUTO suite: 41 passed, 0 failed.** Zero console warnings, zero errors.
- Draw calls unchanged by this phase: 278–310 worst case, GL error 0. The
  feedback is two colour writes per frame on existing materials.
- Sample budget measured live: 20 samples per 2 seconds, 30 rays for 6 lights in
  range at site A.

### Not verified (needs a human)

- **Whether the Shade visibly dims in step with the meter** — Section 16 check
  27, and the whole point of 4.2. I can prove the numbers move together and that
  both come from one value; I cannot see it.
- Whether `silhouetteDarkness` 0.14 is too dark to read the character against a
  dark floor, or `rimMin` 0.2 too faint to find yourself in shadow.
- Whether the noise cadence *feels* right. The radii are spec'd; the stride
  lengths that trigger them are not.

### Post-phase-5 fixes: found by actually running the game

First time the game has been driven on a real screen. Two bugs, both surfaced
by Phase 5 rather than caused by it.

**1. Limb outlines were stranded at the shoulders and hips.** `outlined()` added
the inverted-hull duplicate to the *group*, then the caller repositioned the
mesh it got back — `segment.position.y = -length / 2 - radius` — and the outline
stayed at the pivot. The four limb segments on each actor were therefore
outlined in the wrong place: the Shade's arm hulls sat 0.336m high, its leg
hulls 0.438m high, and the Warden had the same fault.

This had been wrong since Phase 3 and was invisible while the outline was
painted near-black on a near-black background. Section 4.2 recolours the Shade's
outline teal, which lit four floating capsules up like signal flares.

The outline is now a **child of the mesh** rather than a sibling, so it inherits
the transform and cannot drift no matter what a caller does afterwards.

```
PASS  outlines-sit-on-the-body-they-outline
      18 body meshes across both actors, 18 outlines, all coincident with the
      mesh they hull
```

The check also fails an outline that is missing entirely, so "does not drift"
cannot be satisfied by not existing.

**2. Half the Phase 5 overlay fields were being silently dropped.** The overlay
renders from a field table keyed by name, and I wrote `visibility`,
`noiseEvents` and `lightsSampled` where it expects `visibilitySmoothed` and
`activeNoise` — and wrote pre-formatted strings into slots with numeric
formatters. Section 17 requires raw *and* smoothed visibility and the active
noise count; only the raw value was appearing. Fixed to the keys and types the
table consumes.

Suite: **42 passed, 0 failed.**

### What running it actually showed

- Boots and renders in Chrome: 310 draw calls, 11,092 triangles, `shadow lights
  1 (want 1)`, `assert failures 0`, 214 collision boxes, 49 marked ledges.
- F3 toggles the overlay from a real keypress — input, tooling and DOM all wired.
- Holding W walks the Shade 5.13m in 1.5s (≈3.4 m/s against a 3.5 spec walk),
  stops dead on release, and emits 2 footstep noise events on the way. Phase 5
  works from real input, not just from the harness.
- At the spawn the Shade is a near-black silhouette with a faint teal edge, on an
  unlit apron reading 3.0. That is Section 4.2 at the bottom of its range, and it
  looks right.

**Still not measured: framerate.** The tab throttles `requestAnimationFrame`
whenever it is not the focused window, so every FPS reading I could take was 0
with a ~4.8s frame time — an artefact of driving it through tooling, not a
performance result. Section 16 check 29 remains yours to run, with the window
focused.

---

## Phase 6 — Warden AI

**Status:** complete. Suite: **47 passed, 0 failed**, zero console warnings or
errors.

### What was built

**`src/systems/ai.js` (new).** The Section 11 state machine, A* over the
waypoint graph, and perception fed by the Phase 5 meter and noise field.

The load-bearing decision: **the AI never touches the Warden's position.** It
fills the same `intent` object a human fills in free-roam and hands it back, and
the composition root steps the controller with it. Section 12 requires free-roam
to be "a configuration, never a duplicated code path", and the only way to
guarantee that is to give the AI no privileged route into the controller. If the
AI can do something the player cannot, it is because the intent has a field for
it.

| State | Implemented as |
|---|---|
| PATROL | Randomised circuit from the seeded stream, 2-4s pauses, scanning |
| SUSPICIOUS | Stop, turn to the noise, hold 1.5s |
| INVESTIGATE | Path to it, scan 4s on arrival, 12s timeout to SEARCH |
| ENGAGE | Close to 18m, burst fire, break line of sight between bursts, call a frag on a 2s-static target |
| SEARCH | Three nearest waypoints to the last known position over 15s, one stun grenade |
| DEFEND | Path to the charge and hold it |
| STUNNED | Observes the controller's own stun timer; exits to SEARCH |

### The bug that wedged the browser

The first run hung the tab so hard that `1 + 1` timed out. A* had

```js
if (tentative >= (gScore.get(next) || Infinity)) continue;
```

The start node's score is `0`, and `0 || Infinity` is **Infinity** — so every
relaxation back into the start looked like an improvement. That wrote
`cameFrom[start]`, which put a cycle in the parent chain, and the path
reconstruction walked that cycle forever.

Fixed with `has()` instead of `||`, plus a bound on the reconstruction: a parent
chain can visit each node at most once, so anything longer is a cycle. The check
walks **all 400 node pairs** and asserts each route starts and ends where asked,
never repeats a node, and only steps along declared links — a cycle shows up
there as a repeat rather than as a hung tab.

### Two gaps the state-machine check exposed

- **ENGAGE did not re-path when it lost sight.** It called `_followRoute` on
  whatever route it happened to be on, which was the patrol circuit — so a
  Warden that lost the Shade walked off to its next patrol node instead of
  pushing to the last known position.
- **"Use cover" was not implemented.** Now sampled on a ring between bursts:
  eight probes for a spot that breaks the Shade's line back without leaving
  effective range, strafed into so the gun stays on target. Sampled rather than
  read from authored cover points, so it works anywhere and cannot go stale when
  the map changes.

### What is deferred, and why it is not a stub

Section 3.2 forbids stubs, so it is worth being precise about the seams:

- **Firing sets `intent.fire`** in bursts of 3-7 with 0.25-0.7s pauses. Nothing
  reads it until Phase 7 wires the gun. That is the same field a human's mouse
  button fills — the Phase 4 notes already carried `fire` and `reload` unread.
- **Frag and stun-grenade decisions emit `ai:throw`.** The decision is made
  here and is complete; Phase 9 owns the throw. Cross-system messaging goes
  through the emitter by Section 3.1 anyway.
- **DEFEND is implemented but cannot be entered yet**, because nothing plants a
  charge until Phase 10. `setDefendTarget()` is the seam, and the state is
  drivable through it today.

### New AUTO checks

```
PASS  ai-paths-between-every-waypoint-pair
      400 node pairs, every route valid and acyclic, longest 11 nodes
PASS  ai-patrols-without-getting-stuck
      walked 135.7m over 60s (net 29.0m), states [patrol], stuck re-paths 0,
      feet 0.02, capsule clear=true
PASS  ai-perception-cone-and-accumulator
      ahead acc 7.9; behind/out-of-range/through-wall all unseen;
      peaked 38.9 then drained 15.0/s (spec 15)
PASS  ai-state-machine-follows-section-11
      noise -> suspicious -> investigate; accumulator 100 -> engage;
      sight lost 2.5s -> search; search timeout -> patrol;
      stun freezes then -> search
PASS  ai-patrol-order-is-seed-reproducible
      same seed identical, seed+1 differs, circuit covers all 20 nodes
```

The last one is the AUTO half of Section 16 check 28.

`ai-state-machine-follows-section-11` drives the whole escalation the way play
drives it — a noise, then a walk-in, then the accumulator carrying it to ENGAGE
— rather than assigning the accumulator. Assigning it does not work and should
not: the drain runs before the threshold test, so a poked-in 100 is already
below the line by the time the state is read back. Two earlier versions of this
check failed for reasons that were the test's fault, not the AI's, including one
where the test never ticked the noise field so a stale event lived forever and
the Warden kept re-investigating it.

### Known issues

- **The accumulator only builds while the Shade is inside the cone**, and a
  patrolling Warden turns away quickly. Filling from 0 to 100 on a still,
  fully-lit Shade at 8m takes about 5s at medium. That reads right to me — a
  glimpse should not be an instant engage — but it is a feel question and it is
  the number most likely to want tuning once you can play against it.
- `main.js` is 3182 lines and about 2400 of that is the 47 AUTO checks. This is
  the third phase in a row I have flagged the split. It should happen before
  Phase 7 adds more.
- ENGAGE has never been seen against a moving human. The cover-seeking in
  particular is asserted only through its own geometry, not by watching whether
  it looks like taking cover or like jittering.

### Verification actually performed

- **AUTO suite: 47 passed, 0 failed.** Zero warnings, zero errors.
- 120 fixed steps of live AI cost 12.5ms.
- A minute of patrol: 135.7m walked, stays in PATROL throughout with no Shade to
  notice, never leaves the floor, capsule always clear, 0 stuck re-paths.

### Not verified (needs a human)

- Whether the patrol *reads* as a patrol — pacing, scan speed, whether the
  pauses land somewhere sensible.
- Whether losing a Warden feels fair: the 2.5s sight-loss grace and the 15s
  search are spec'd, but whether they produce good hide-and-seek is a play
  question.
- Framerate with the AI live, for the same reason as Phase 5: a backgrounded tab
  reports nothing useful.

---

## The AUTO suite moved out of the composition root

Flagged for three phases, done before Phase 7 could add to it. `main.js` was
3182 lines, ~2400 of it the suite; Section 3.1 caps a module at roughly 600 and
the composition root had become the largest file in the project.

The suite now lives in `src/tests/`, one module per subject, each under the cap:
engine 266, map 412, navigation 431, shade 503, warden 218, detection 343,
ai 293, plus a registrar. **`main.js`: 3182 → 838.**

No check changed behaviour — 47 registered, 47 passing, same results. Checks
reach the game through the harness rather than importing `main.js`, which
Section 3.1 forbids, so `createCamera` joined the harness and two checks that
had taken no harness (they only needed CONFIG) now take one.

Deviation 16 in the list below.

---

## Phase 7 — combat

**Status:** complete. Suite after Phases 7 and 8: **57 passed, 0 failed.**

### What was built

**`src/systems/combat.js` (new).** Hitscan, damage, the knife, death and the
Section 8.3 finisher.

- **Gun (8.1).** 30 rounds at 600rpm. Damage 25 to 15m, falling linearly to 12
  at 30m, flat beyond. Headshots 2x, measured against a head line at 86% of the
  capsule. Spread 0.6° growing 0.25°/shot to a 4.0° cap, recovering 3°/s once
  the trigger is off. Recoil climbs and decays exponentially, so a long burst
  ends up higher than several short ones.
- **Knife (8.2).** Front and side arc for 50, two hits to kill, 0.5s between
  swings, 12m of noise. Rear cone within 1.8m is an instant takedown.
- **Death.** The Warden dies, then respawns after 12s at the spawn furthest from
  the Shade's **last known** position — the AI's belief, not the truth.
  Respawning against the truth would hand it information it has not earned.
- **Finisher (8.3).** Hit-stop, slow-mo with a 40° camera orbit, snap-back.

### Spread and recoil are deliberately separate

Spread is where the bullet goes relative to the aim; recoil is where the aim
goes. Only recoil moves the camera, so the player can fight it. Spread cannot be
fought, which is what makes holding the trigger worse than tapping it.

### The finisher's hard requirement

Section 8.3: the cinematic must never own the only path back to normal play. So
the timeout is on the **wall clock**, not the sim clock — the finisher itself
scales time to 0.05, and a guard measured against a clock the thing being
guarded controls is not a guard. `_restore()` is idempotent and is called from
both the final beat and the guard.

The check proves both halves: the beats run to completion in 1.20s and restore,
and a finisher whose start time is rewound past the 1.5s timeout hands control
back on the very next step.

### Bugs found

- **The rear-takedown cone was inverted.** Behind the Warden read as in front
  and vice versa, so you could take one down by walking up and waving at it.
  `toTarget` runs attacker→target, so the vector from target back to attacker is
  its negation; the attacker is behind when that opposes the Warden's facing,
  and the two negations cancel to a plain dot product. I had negated once.
- **The finisher's orbit pivot was never added to the scene.** Parenting the
  camera to a detached pivot lifted the only camera out of the graph — the check
  caught it as "0 cameras after the finisher". The pivot is now added before the
  camera is parented, and the camera is handed back to the scene before the
  pivot is dropped.

---

## Phase 8 — audio

**Status:** complete. All synthesized (Section 14); no files, no fetches.

### What was built

**`src/systems/audio.js` (new).** One master gain, three buses (sfx, ambience,
ui), and a builder per row of the Section 14 table: both footsteps, gunfire with
its delayed-copy tail, knife swing, takedown, taser, alarm, plant beep, life
lost, landing, light break and reload.

- **Autoplay (Section 15).** A context built before a user gesture starts
  suspended and drops everything silently, so `unlock()` is the only thing that
  builds the graph and it is wired to the first click. Before it, `play()`
  returns false rather than throwing.
- **Spatialisation.** A `PannerNode` per world sound; UI and the tension pad go
  straight to their bus, because the pad is telling the player about the AI's
  mind rather than about a place.
- **No leaks.** Every voice registers, releases on `onended`, and is capped at
  24 — a flood of 200 footsteps yields 24 active and 176 refused rather than an
  unbounded graph.

It listens on the emitter and never reaches into another system: footsteps come
from the Phase 5 noise field, gunfire and the takedown from Phase 7's events.

### One deliberate use of Math.random

The shared white-noise buffer is filled with `Math.random`. Section 2 bans it so
that gameplay is reproducible from a seed; a one-off audio texture has no
gameplay meaning, and drawing 44,100 values from the seeded stream would shift
every downstream draw and break check 28. Called out in the code at the line.

### New AUTO checks

```
PASS  gun-damage-falloff-and-lethality
      0m 25, 15m 25, 22.5m 18.5, 30m 12, beyond 12; 4 body shots kill, headshot x2
PASS  gun-spread-recoil-and-reload
      30 rounds, spread 0.6 -> 4.00 (cap 4), reload 2.20s refilled to 30,
      recoil decayed to 0.0000
PASS  hitscan-respects-cover-and-the-head-line
PASS  rear-takedown-needs-the-wardens-back
PASS  finisher-always-returns-control
      beats ran to completion in 1.20s (spec 1.2s) and restored; wall-clock guard
      at 1.5s restored on the next step; 1 camera throughout
PASS  warden-respawns-furthest-from-last-known
      died, held dead for 12s, returned at "server vault" (50.7m from the last
      known position) on full health
PASS  audio-graph-is-one-master-three-buses
PASS  audio-spatialises-everything-but-ui
PASS  audio-voices-are-capped-and-released
      12 sounds all produce a voice; flooded 200 -> 24 active (cap 24, 176 refused);
      reset drained to 0
PASS  audio-tension-tracks-the-ai-accumulator
      silent at 40, 58Hz pad running at 75 (threshold 50, max gain 0.22)
```

### Known issues

- **Nothing fires the gun in competitive yet.** The AI fills `intent.fire` and
  combat reads it, but the Shade is the human role, so the only way to see the
  gun today is free-roam — where the human intent is not yet routed into combat.
  Wiring free-roam's trigger is a one-line change I have not made because it
  belongs with the Phase 9 gadget loadout and the Phase 13 crosshair.
- **The Shade cannot die properly yet.** Combat takes it to 0 health and emits
  `combat:death`; lives, the death camera and reinsert are Section 10.2, which
  Phase 10 owns.
- **Audio has never been heard.** Everything below is graph assertions.

### Verification actually performed

- **AUTO suite: 57 passed, 0 failed.**
- Live: 10s of competitive sim with all systems on — AI in INVESTIGATE, audio
  context `running` with 12 live voices from Warden footsteps, one camera, time
  scale 1, both actors on full health.

### Not verified (needs a human)

- **Everything about how it sounds.** I can prove the graph is one master and
  three buses, that each builder starts a voice, that voices are capped and
  released, and that the pad tracks the accumulator. I cannot hear any of it.
  Whether the gunfire reads as a gun is entirely yours.
- Weapon feel: check 15 (fire a full magazine in free-roam, watch spread grow
  and recoil climb) needs the free-roam trigger wired first.
- Check 13: the takedown finisher on screen — whether 1.2s reads as a payoff or
  an interruption, and whether the orbit is legible.

---

## Phases 9 to 12 — gadgets, objective, effects, UI

**Status:** complete. Suite: **69 passed, 0 failed**, zero warnings or errors.
Every file in `src/` is now written.

### Phase 9 — `systems/gadgets.js`

One registry, all six gadgets. Every effect is plain data with an elapsed time
and a duration, ticked from the one fixed step — **no `setTimeout` anywhere in
`src/`**, which is the Section 9 and Section 15 requirement. Nothing schedules
itself, so nothing can outlive a round or fire during a pause.

Grenades sweep the segment they actually travelled each step, not just their
endpoint, so a fast one cannot pass through a wall (check 18). Verified at 1x,
4x and 12x the spec throw speed into the perimeter wall: never crossed it.

Other systems never reach into the effect list. They ask questions —
`blocksSight()`, `aiBlinded()`, `shadeSpeedMultiplier()` — and gadgets answers.
That is what let smoke and flashbangs feed the AI's perception without
`ai.js` importing `gadgets.js`, which Section 3.1 forbids.

### Phase 10 — `systems/objective.js`

Plant, defuse, lives and reinsert, the two time-extension milestones, win
conditions and the match score.

`createRoundState()` is a defaults factory and `resetRound()` replaces the whole
object. Section 10.5 says nothing carries between rounds except the score, and
this is the only way to guarantee it: there is no field to forget to clear,
because clearing is not how it works. The check dirties every field, resets, and
compares all 22 against a fresh factory object.

Two rules worth stating because they are easy to get backwards:

- **Reinsert does not refill gadgets** (Section 10.2), deliberately, so dying
  still costs something real. Asserted.
- **The Warden's knowledge resets to the death location**, not the reinsert
  point. It should be searching where it killed you.

### Phase 11 — `systems/effects.js`

Footprints (60, recycled oldest-first, fading over 6s), particles (120) and
smoke (200). Three rows of the risk register live here, and each pool is fixed
at construction, floods by recycling rather than growing, and drains to zero.

Ragdoll-lite is exactly that: one impulse, damped tumble, frozen after 2s. The
check drives it and asserts it froze on time, never went non-finite, never sank
below the floor, and genuinely stopped afterwards.

**Deviation 18:** the smoke pool is one `THREE.Points` object rather than 200
`THREE.Sprite`s. Same cap, same one shared material — but 200 sprites is 200
draw calls, which is precisely what that row of the risk register exists to
prevent. Same for the footprints, which are one `InstancedMesh`.

### Phase 12 — `ui/hud.js`, `ui/menu.js`, `ui/scoreboard.js`

DOM overlay, flat and high contrast. The Shade HUD carries the visibility bar,
three life pips, health, gadget counts with the taser recharge ring, the round
timer and charge state, the objective prompt with its hold bar, the kill feed
and the score; on death the reinsert countdown replaces the centre. Free-roam
gets the crosshair whose gap is the live spread.

**The HUD computes nothing.** It reads the smoothed meter Section 4.2 drives the
character with, rather than deriving its own — that is the disagreement 4.2
forbids, and the check drives the meter to 0/25/60/100 and asserts the bar
matches exactly.

**The menu is the audio gate.** Section 13 and the risk register: the Play
button is the first user gesture and the `AudioContext` is created there.
Verified live — clicking Play took the context from *not created* to *running*.
Both Play and Free Roam route through the same `initMatch`, so Section 12's
"free-roam is a configuration, never a duplicated code path" still holds.

### New AUTO checks

```
PASS  gadget-effects-all-expire
PASS  grenades-do-not-tunnel-through-walls
      thrown at 1x, 4x and 12x the spec speed into a wall at x=-30: never crossed
PASS  flashbang-needs-line-of-sight
PASS  taser-stuns-costs-a-charge-and-recharges
PASS  plant-holds-four-seconds-and-extends-the-round
      planted in 4.02s at site A, +45s, detonated after 45.0s, shade wins 1-0
PASS  defuse-wins-and-partial-progress-decays
PASS  lives-reinsert-and-the-all-lives-rule
      3 lives, reinsert after 15s on full health with gadgets untouched, AI
      resent to the death spot; all lives lost ends the round unplanted and
      does not once planted
PASS  round-state-carries-nothing-but-the-score
PASS  effect-pools-are-fixed-and-drain
PASS  ragdoll-is-lite-and-freezes
PASS  hud-reads-the-meter-it-is-shown-beside
PASS  menu-is-the-audio-gate-and-the-only-entry
```

That covers the AUTO half of checks 17, 18, 20, 21, 22, 23, 24 and 25.

### A bug the checks caused rather than caught

Running the suite left the intermission scoreboard open over the game, because
the objective checks end real rounds and the composition root shows a scoreboard
on `objective:round-end`. Two fixes: the checks put the UI back as they found
it, and `initMatch` now hides the scoreboard — a new match should never start
behind a stale intermission regardless of who opened it.

### Known issues

- **The Shade cannot throw anything yet.** `intent.gadget` is filled from keys
  1-3 and gadgets exposes `throwGadget` / `fireTaser`, but the two are not
  joined: the throw needs an aim direction and a release, which is a feel
  decision I would rather make with you than guess at. The AI's frags and stun
  grenades *are* wired and fly.
- **Free-roam does not route its trigger into combat**, so check 15 still cannot
  be run. Same one-line gap as last time, now the only thing between you and
  firing the gun.
- **The Shade's death is emitted but not dramatised.** Objective takes the life
  and reinserts; there is no death camera (Section 10.2's free-look camera on
  the killing Warden) and no ragdoll on the Shade yet.
- `main.js` is 998 lines. It is all composition now — no logic — but it is over
  the guidance again.

### Verification actually performed

- **AUTO suite: 69 passed, 0 failed**, zero warnings, zero errors, and the suite
  leaves the UI as it found it.
- Live in Chrome: menu renders, Play starts a competitive match and unlocks
  audio in the same click, HUD draws the full Shade layout and is correctly
  hidden behind the menu, round timer counts down from 4:00.
- No `setTimeout`, `setInterval`, `TODO` or `FIXME` anywhere in `src/`.

### Not verified (needs a human)

- **How any of it plays.** Everything above is structure. Whether the round
  timer creates pressure, whether 3 lives is too generous, whether the AI is fun
  to hide from — none of that is assertable.
- Whether the HUD is legible at speed, and whether the visibility bar is where
  the eye wants it.
- Everything audio, still.
- Framerate with all systems live, for the same reason as before.

### Exact next action

Superseded — see the play-testing session below.

---

## First play-testing session

Josh played it. Four things came back, three of them real bugs and one a gap I
had left open on purpose. All fixed and committed; suite still **69 passing**.

### Wired the Section 17.1 test-mode commands

Six of the eight test-mode shortcuts emitted events nothing listened to and
printed "no handler yet". The panel was honest about it, but the tools were not
there — and Section 17.1 asks for them in Phase 1. Most of what remains in
Section 16 is HUMAN checks, and they are hard enough to run without the setup
costing more than the check.

`1`/`2`/`3` teleport to sites A/B/C · `4` teleport behind the Warden (the
takedown setup for check 13) · `G` god mode · `H` kill the Shade to exercise
reinsert · `J` instant plant · `K` cycle the AI state · `L` refill gadgets and
health · `T` time scale · `Y` run the suite.

### "F to knife doesn't work"

It did work. A single `KeyF` press fired the swing, the takedown and the damage,
verified live. **What was missing was any way to tell**: no arm animation, no
hit marker, no HUD line. Swing at empty air and nothing at all happens on
screen, so "doesn't work" was the only reasonable conclusion.

The Shade now plays a knife arc — fast wind-up, slower follow-through, slight
torso turn — driven from combat at the moment the swing is *committed*, so a
swing eaten by the 0.5s cooldown correctly draws nothing. `combat:knife-hit`
and `combat:knife-miss` are emitted, and a hit reports the Warden's remaining
health to the kill feed.

A duplicated config number surfaced on the way: the swing duration briefly
existed under both `combat.knife` and `shade`, and the alias silently failed to
apply, which made the animation a no-op. `agent.js` reads
`CONFIG.combat.knife.swingAnimTime` directly now.

### "F behind the Warden made it basically disappear"

`setFirstPerson()` had hidden the mesh whenever `state === DEAD` since Phase 4.
Defensible when there was nothing to leave behind — but Phase 11 built a ragdoll
and **nothing ever called it**. Death now ragdolls the body and it stays visible.

A second fault underneath: `updateVisual()` rewrites the mesh transform every
frame, so it would have overwritten the tumble immediately. It now steps aside
while a ragdoll owns the transform. The controller runs later in the frame than
the effects step, so without that it always won.

### "No animation other than an arm moving"

The Section 8.3 camera orbit never played. `frame()` reasserted camera ownership
**every frame**, so combat parented the camera to its orbit pivot and the next
frame yanked it back to the Shade rig. What Josh saw was the hit-stop and
slow-mo timing with the camera glued behind his own back.

The frame loop now leaves the camera alone while the finisher owns it, and does
not steer it either — it is not the player's camera for those 1.2s.

**Not observed.** This one is a guard in the frame loop, and the frame loop only
runs with the window focused, which the tooling cannot do. The logic is
straightforward but nobody has yet watched the orbit play.

### Gadget throwing, wired

Slots `1`/`2`/`3` are smoke, flashbang and taser, thrown from the eye along the
camera facing so what you are looking at is what you are throwing at. Each
pushes a HUD line saying what happened and what is left. Verified: smoke goes
2 → 1 with a projectile in flight and a 200-sprite cloud on landing.

### Still open

- **Free-roam does not route its trigger into combat**, so Section 16 check 15
  (fire a full magazine, watch spread grow and recoil climb) still cannot be
  run. One line, deliberately unwritten — it wants the Phase 13 crosshair work
  beside it.
- **The Shade's death is not dramatised.** The life is taken and the reinsert
  happens, but there is no death camera on the killing Warden (Section 10.2) and
  no ragdoll on the Shade.
- **Framerate has still never been measured.** Every reading taken through
  tooling was 0 FPS with a ~4.8s frame time, which is a backgrounded tab, not a
  result. Check 29 needs the window focused.
- **No audio has ever been heard.**

### Exact next action

Ask Josh what the play session actually felt like before writing more code. The
open items above are known; what is not known is whether the map reads, whether
the meter and the character agree on screen (check 27), whether the finisher
lands now that the camera is free, and what the framerate is. Those answers
should decide the next phase, not the backlog.

---

## Phase 4 (superseded planning note)

Phase 4 — `src/entities/enforcer.js`. The Warden first-person controller,
written as a shared controller driven by an intent object so the AI (Phase 6)
and the free-roam human (Phase 12) feed the same interface. Exit gate: swapping
the camera between Shade and Warden leaks no state — reuse `setCameraOwner()`
and assert the camera count stays at 1 and FOV is restored.

---

## Phases 14 to 23 — closing out Section 16 and Section 18

**Status:** complete. Suite: **69 → 85 passed, 0 failed.** Runtime assertions
6 → 8. Zero console warnings or errors across 90 simulated seconds of live play.

Every phase below traces to something already in the spec. Nothing new was
invented: Section 3 says the scope is frozen, so these ten phases are the
remaining distance between what the spec asks for and what the build did.

### The ten phases

| Phase | What it closed |
|---|---|
| 14 | Free-roam combat and the Warden HUD (check 15) |
| 15 | The difficulty and match-length settings actually taking effect |
| 16 | The Shade's death: ragdoll and the free-look death camera (Section 10.2) |
| 17 | The alarm camera end to end (check 19), and the rest of Section 14's audio |
| 18 | A real performance harness for check 29 |
| 19 | AUTO coverage for detection checks 11 and 12 |
| 20 | A full best-of-five played end to end (check 22) |
| 21 | The mechanical half of movement checks 1, 5 and 7 |
| 22 | Modules back toward the Section 3.1 line |
| 23 | The Section 18 definition-of-done sweep |

### The bug that matters most: the slide could not be performed

Section 6.1 gives the Shade a slide "from sprint plus crouch". It was
unreachable from the keyboard, and had been since Phase 3.

`_stepGround()` applied the crouch first and only then tested for a slide:

```js
this._applyCrouch(intent.crouch);
const sprinting = intent.sprint && !this.crouching && ...;
if (intent.crouchPressed && sprinting && ...) this._enterSlide();
```

A keydown adds the code to the held set **and** the pressed set in the same
event, so on the step the crouch edge fires, `intent.crouch` and
`intent.crouchPressed` are both true. Applying the crouch first set
`this.crouching`, which cleared `sprinting`, which meant the branch could never
be taken. Holding Shift and tapping Ctrl produced a crouch-walk, every time.

This is the Phase 3 ledge-hang bug again in a different place — an edge flag
read after the held flag has already changed the state it depends on. And it
survived for the same reason: `shade-invariants-under-fuzz` reported
`states seen [ground air slide]`, because random input cheerfully produces a
crouch *edge* with the key not *held*, which no player can produce.

Slide entry is now tested before the crouch is applied, and the check drives it
through `input.heldCodes` / `input.pressedCodes` rather than a hand-built intent,
so a test can no longer pass by picking a key combination that does not exist.

```
PASS  slide-into-a-vent-lowers-the-capsule
      vent-grade-west: 10m run-up, slid from 2.43m short of the mouth at 6.50 m/s,
      slide began at 8.00 (spec 8), capsule dropped to 0.85m from 1.85m,
      travelled 6.47m inside a 1.15m duct with 0 clips
```

### Two settings that moved a label and nothing else

`ai.js` read `CONFIG.settings.difficulty` and `objective.js` read
`CONFIG.settings.matchLength`. Both compiled, both looked right, and both
returned the frozen **default** forever — so the Section 13 difficulty control
did nothing to the Section 11 presets, and best-of-11 still ended at three wins.

Rather than patch the two call sites, the trap was removed: the seed values now
live under `CONFIG.settings.defaults`, so `CONFIG.settings.difficulty` is
`undefined` and a stale read fails loudly. That immediately surfaced a third
site nobody had noticed — `ui/scoreboard.js` printing "first to 3" regardless of
the setting.

The checks assert behaviour, not storage: they set the value, start a match, and
read what the AI and the objective system are actually running.

### The death camera, and why the guard forces a reinsert

Section 10.2 asks for "a free-look death camera on the killing Warden" and
Section 15 lists reinsert leaving stale state as its own risk, mitigated by a
`respawnShade()` with "a hard wall-clock guard like the finisher". The config
constants had been there since Phase 10; nothing used them.

`systems/deathcam.js` now owns the ragdoll, the camera, and the restore. Two
decisions worth stating:

**The restore lives in one function, injected into objective.** Objective still
chooses *where* the Shade comes back (Section 10.2's spawn scoring) but no
longer performs the reinsert itself — it calls a `respawnShade` handed in by the
composition root. Splitting a four-part restore across two files is exactly how
three of the four parts get done.

**The guard forces the reinsert rather than merely dropping the camera.** The
countdown runs on the sim clock, which the time scale can stretch and a stalled
frame can stop. Handing back a camera attached to a still-dead Shade is not
"control restored" — it just moves where the player is stuck.

The check proves the unhappy path, not the happy one: it freezes the countdown
at its full 15s, rewinds the wall clock past the guard, and asserts the player
gets everything back on the next step.

### Section 14 had six sounds that could not be heard

Builders existed for the taser, the alarm and the plant beep, and nothing ever
called them; smoke, flashbang and grenade had no builder at all. A builder with
no trigger is silent in play and indistinguishable from one that was never
written, so the audio check now walks the Section 14 table and, for each row,
**emits the real game event** and asserts a voice started. Rows triggered by a
real event: **8 → 14**.

The plant beep needed an interval that shortens as the detonation clock runs
down, which is the clock made audible — so objective owns the interval and audio
only sounds it.

### Check 29, measured rather than reasoned about

Section 16 classes check 29 AUTO and says to build the harness. `frame()` was
split so `renderFrame(wallDelta)` is callable synchronously — the benchmark runs
*the* frame function, not a copy of it — and the check assembles the exact load
the spec names, then times 180 of them.

```
PASS  frame-budget-under-the-check-29-load
      180 frames with 100 smoke sprites, a live flashbang, a ragdoll and 26 rounds:
      CPU 1.90ms median / 4.10ms p95, GPU 2.26ms against a 16.67ms budget;
      peak 98 draw calls, 6096 triangles, 137 live effects; pools held and drained to 0
```

**This is the first performance number this project has ever produced.** Read it
for what it is: CPU cost and GPU cost of a real frame under the check-29 load, on
this machine. It is not a vsync-paced frame rate on integrated graphics, and
check 29 stays HUMAN for that reason.

Assembling the load surfaced two genuine interactions worth knowing:

- **Smoke blocks AI line of sight entirely** (Section 9.1), so a cloud on the
  target stops the gunfire. The four loads only coexist when the smoke is
  somewhere else in the room — which is where a real one gets thrown.
- **A flashbang the AI saw disables its perception**, same result. The benchmark
  uses a flash the player sees and the Warden does not, which Section 9.1 models
  explicitly and which costs exactly the same to render.

### Checks 11 and 12 as a controlled experiment

The two checks are the same approach run twice down the same lane — crouch, then
sprint — so anything that could confound them hits both runs equally and the
difference isolates the Section 7.2 noise radii, which is what they are about.

The Warden is held at its node facing away, because over five seconds a patrol
scan sweeps far enough to simply *look* at the Shade, and that is a sight
detection, not a hearing one. The check asserts `wardenAI.sees` stayed false for
both runs and fails loudly if it did not, so it can never quietly become a test
of something else.

```
PASS  crouch-approaches-unheard-sprint-does-not
      crouch-walked to 0.0m: silent, states [patrol], accumulator 0.0;
      sprinted the same lane to 5.4m: 3 noise events, states [patrol,suspicious,investigate]
```

### A hazard found by a test getting it wrong

The 8m-fall check captured a noise event object and read its radius afterwards.
It reported 8m for a landing that is spec'd at 10m — because noise events come
from a **fixed pool of 48 that recycles**, and a later Warden footstep (radius 8)
had overwritten the slot.

Every production listener reads the fields immediately, so nothing was broken.
But it is a real trap for the next listener that wants to keep one, and it is now
called out at the two sites that hold on to an event.

### Module splits (Section 3.1)

Flagged as overdue for four phases. Six modules came out, all pure moves with
no behaviour change — the suite reported the same checks, 214 collision boxes
and 49 marked ledges before and after:

| New file | Out of | Why it is a real seam |
|---|---|---|
| `src/emitter.js` | main.js | Imports nothing; belongs at the bottom of the graph |
| `src/freefly.js` | main.js | Debug flycam, reads input, moves the one camera |
| `src/testcommands.js` | main.js | Section 17.1 handlers; the panel knows no game, these know no keys |
| `src/mapbake.js` | mapkit.js | The half that knows nothing about a map |
| `src/entities/agentmesh.js` | agent.js | Build time vs. run time |
| `src/tests/assertions.js` | main.js | The Section 17 assertions, beside the rest of the checks |

main.js 1133 → 918, mapkit.js 1103 → 991, agent.js 869 → 790.

Moving the assertions out surfaced that **two of Section 17's four were never
written**: "the round state machine is in exactly one valid state" and "active
effect count returns to 0 within 10s of the last gadget expiring". Both exist
now, which is why the assertion count went 6 → 8.

**Still over the ~600 line guidance**, with reasons rather than excuses:

- **`config.js` (1059) — deliberately exempt.** Section 3 makes it "ALL tuning
  constants, single source of truth" and Section 3.1's stated rationale for the
  cap is that "long files are where bugs hide". It is pure data with no logic.
  Splitting it would trade the property the spec explicitly asks for against a
  guideline aimed at a problem it does not have. **Say the word and it becomes
  `config/` with a barrel.**
- **`main.js` (918)** — composition root, and now almost entirely wiring. Every
  further split makes the one file whose job is to show how the pieces connect
  show less of it.
- **`mapkit.js` (991), `map.js` (714), `physics.js` (656), `ai.js` (606)** —
  mapkit's remaining bulk is the room-entry and climbability derivation, which
  are methods on `GameMap`; moving them means free functions taking the map plus
  delegating methods, which is a larger and riskier edit than the rest and buys
  nothing functional. Flagged rather than rushed.

### Deviations from spec added by these phases

19. **Bullet impact sparks** on `combat:impact`, from the existing pooled
    particle system. Check 15 asks the player to watch spread grow and recoil
    climb, and neither is observable without seeing where the rounds land. Five
    sprites per shot from the existing 120 pool; no new subsystem. **Say the
    word and it comes out.**
20. **`src/emitter.js`, `src/freefly.js`, `src/testcommands.js`,
    `src/mapbake.js`, `src/entities/agentmesh.js`, `src/systems/deathcam.js`,
    `src/tests/assertions.js`** are files Section 3 does not list. Same class as
    deviations 1, 12 and 16: Section 3.1's line cap and Section 3's file list
    cannot both be satisfied, and the cap is the one with a stated reason.
21. **One `setTimeout` in `src/tests/performance.js`.** Section 9 and the risk
    register ban it for anything affecting gameplay. This yields the thread so a
    GPU timer-query fence can resolve inside a test; it ends when the query does
    and touches no game state. Called out at the line, as the audio noise
    buffer's `Math.random` is.
22. **The Shade is not a target in free-roam.** Section 12 says free-roam has no
    opponent, so the gun interacts with the world only.

### Section 16 after these phases

| Check | Was | Now |
|---|---|---|
| 1 sprint into a wall | HUMAN | AUTO half: 0 overlaps, rests 0.341m off a 0.34m radius, 0.00mm/step |
| 5 slide into a vent | HUMAN | AUTO half — and it did not work at all until this phase |
| 7 fall 8m | HUMAN | AUTO half: lowest feet y=0.001, 10m landing noise, 1m drop silent |
| 11 crouch-walk unnoticed | none | AUTO |
| 12 sprint noticed | none | AUTO |
| 15 free-roam magazine | blocked | AUTO, and now actually playable |
| 19 alarm camera | none | AUTO: siren, re-trigger interval, gunfire/taser/knife, silence after |
| 22 best of 5 | partial | AUTO: full match, every scoreboard row checked against what was played |
| 29 performance | reasoned about | AUTO: measured, with an honest statement of what it cannot prove |

### Verification actually performed

- **AUTO suite: 85 passed, 0 failed**, run after every change rather than once
  at the end. 8 runtime assertions, 0 failures.
- **`a-live-match-logs-nothing`**: 90 simulated seconds of competitive play with
  the AI, gadgets, deaths and reinserts running produced 0 warnings, 0 errors and
  0 assertion failures. (The one warning the suite prints is the death-camera
  check deliberately firing its own guard.)
- **`no-network-beyond-the-three-cdn`**: 47 requests, 45 same-origin, 2 from
  jsdelivr — `three@0.180.0` module and core, both pinned. Nothing else.
- **Static:** `Math.random` — one occurrence, the documented audio buffer.
  `setTimeout` — one, the documented GPU fence. `TODO`/`FIXME` — none. One empty
  `on('combat:damage', () => {})` handler was removed, which Section 3.2 forbids.
- **Live in Chrome:** free-roam boots as a configuration of `initMatch` with
  unlimited gadgets; an alarm camera places on a real wall through the slot-3 key
  path and its fixture appears; a held trigger empties the magazine and the HUD
  reads `stun ∞  frag ∞  cam set` with the timer and score correctly absent;
  competitive returns with exactly 1 camera and 0 assertion failures.

### Not verified (still needs a human)

- **Nothing has been seen on a screen.** The browser pane still does not
  composite — `document.hidden` stays true, `requestAnimationFrame` never fires,
  screenshots time out. Everything visual in these ten phases is unobserved: the
  death camera's orbit, the ragdoll, the alarm camera fixture and its blinking
  lens, the impact sparks, the Warden HUD's layout.
- **The framerate you will actually see.** CPU and GPU cost per frame are now
  measured and have ample headroom, but a vsync-paced number on integrated
  graphics is yours to read with the window focused.
- **Audio has still never been heard.** Six more sounds now fire in play; whether
  any of them reads as the thing it is meant to be is entirely unverified.
- **Whether the slide feels right.** It works now, which it did not before, but
  `slideLead` (2.5m) — how far short of a vent mouth you have to commit — is a
  number I picked, not one the spec gives.

### Exact next action

Play it. Specifically: slide into a vent (new), die to the Warden and watch the
death camera (new), fire a magazine in free-roam and place an alarm camera (new),
and read the framerate with the window focused. Those four are the whole of what
these ten phases changed that no assertion can settle.

---

## Phases 24 to 33 — the gaps behind the green ticks

**Status:** complete. Suite: **85 → 94 passed, 0 failed**, run twice end to end
to catch flakiness. Runtime assertions 8, 0 failures. Section 16 coverage
claimed: **29 of 29 checks**.

The last ten phases closed the distance between the spec and the build. These
ten closed the distance between *passing* and *working* — five of the ten found
something that was wired, tested, green, and did not actually happen in play.

### The ten phases

| Phase | What it closed |
|---|---|
| 24 | The AI's alarm camera: it never placed one, and a trip told it nothing |
| 25 | DEFEND never pathed to the charge, so check 21 could not happen |
| 26 | Section 4.2's rim light, and the first pixel-level verification in the project |
| 27 | Pause (Esc had a binding and no handler) |
| 28 | Check 26 as a walk-up sweep of every climbable face on the map |
| 29 | Check 28 end to end: a whole match replays from its seed |
| 30 | The AI's grenades, from decision to damage |
| 31 | Section 16's named regression set, runnable in one keypress |
| 32 | Two more Section 3.1 splits, both behaviour-neutral |
| 33 | Final sweep |

### The one that mattered most: DEFEND never went to the charge

Section 11 gives DEFEND one job — "path directly to the charge" — and
`setDefendTarget()` set the state without ever calling `_pathTo()`. The Warden
kept walking whatever patrol route it happened to be on and only reached the
charge by coincidence.

This is the third time this exact fault has appeared in this codebase. Phase 6
found it in ENGAGE ("ENGAGE did not re-path when it lost sight"). It is easy to
miss because entering a state and going somewhere look the same in a state
diagram and are unrelated in code.

Nothing caught it because `defuse-wins-and-partial-progress-decays` drives the
defuse timer directly — it proves the objective system's arithmetic, not that a
Warden ever arrives. Check 21 ("plant a charge, let the AI defuse it, Warden
wins") had no AUTO cover at all.

```
PASS  the-ai-walks-to-the-charge-and-defuses-it
      planted at A and hid: the Warden pathed 9.0m to the charge, held an 8s defuse
      and won the round 12.8s after the plant, with 32.2s left on the detonation clock
```

DEFEND also gained the exit Section 11 lists and it did not have: "break off to
ENGAGE if fired upon". `ai.js` subscribed to no events at all, so a Warden being
knifed mid-defuse had no way to notice. `combat:damage` now carries where the
attack came from — the AI has to break off *toward* something, and a Warden that
knows it was hit but not from where can only spin on the spot.

### The alarm camera the AI never had

Section 9.2 gives the Warden an alarm camera, one per round, for AI use.
`ai.js` did not mention it. In competitive nobody ever placed one, so a gadget
with a mesh, a cone, a siren, three destruction routes and its own AUTO check
had never once appeared in a match.

The second half is subtler. Section 9.2 says a detection marks the Shade "on the
Warden's HUD for 2s" — but in competitive the Warden *is* the AI and has no HUD.
The mark was driving a DOM element nobody was looking at. It now arrives as
knowledge: the AI learns where the **Shade** was, not where the camera is, which
is the difference between a tripwire and a noise.

Where it gets placed is a decision worth stating: it sweeps for a wall as it
*walks* through SEARCH and DEFEND rather than only where it stops. Waypoints sit
in open space by design — that is what makes them walkable — so a Warden
standing on one is almost never within arm's reach of a wall, and the first
version placed nothing across 40 seconds of searching.

### A rim light, and the first thing in this project ever verified on screen

Section 4.2 asks for "rim light intensity **and** outline brightness" driven by
the smoothed meter. Phase 5 shipped the outline and flagged the rim as absent —
a recoloured inverted hull reads as a thicker edge, not as light catching a
shoulder.

It is a fresnel term added to the Shade's toon materials by token replacement.
Every injection point was verified present, and unique, in the pinned r180
program *before* the code was written, which is what Section 2 asks for: "verify
the API names for that exact version rather than recalling them." The view
vector rides on varyings this project declares, so nothing depends on which
internal varyings three happens to expose for toon.

Then the part that matters more than the feature. **The browser pane still does
not composite** — `requestAnimationFrame` never fires and screenshots time out,
which is why nothing in eighteen phases had ever been seen. But `readPixels`
does not need a compositor. So the check renders the Shade twice, once with the
rim off and once with it at full, and reads the framebuffer back:

```
PASS  the-rim-light-is-really-on-screen
      read back 1280x720: the Shade covers 8568 pixels, the rim brightened 5466 of
      them by +131.7 at the silhouette against +58.2 in the interior (2.3x);
      strength 0.18 -> 1.35 across meter 0..100
```

The silhouette-versus-interior comparison is the point. A flat brightening would
also raise the pixel count; only a rim raises the *edge* 2.3x more than the
middle. **This is the first rendered output this project has verified.** The
technique generalises — anything with a visible signature can now be checked the
same way, which closes some of the "needs a human" list permanently.

### The map sweep found a ledge that lies to you

Check 26 asks a human to walk the map confirming no unmarked usable ledge
exists. `climbable-surfaces-are-derived-not-hand-flagged` proves the derivation
agrees with itself — the flag and the stripe come from one pass, so they cannot
disagree. It cannot prove the thing a human would actually notice: whether the
stripe you see is the move you get.

So the sweep walks up to every climbable face on the map, stands where a player
would stand, and runs the controller's own `_probeLedge()`:

```
PASS  every-reachable-ledge-is-marked-with-the-move-it-gives
      walked up to 480 standing positions around 49 climbable boxes; the controller's
      own probe caught 39 of them (297 approaches) as vault 175 / mantle 116 / hang 6;
      every one carried a marking naming a move it really gives; 1 ledge is climbable
      from two floors and can only advertise one
```

It failed on its first run: `hall-container` marked vault, climbing as hang.

The first fix made it worse — marking by the lowest approach put ten multi-tier
route ledges wrong instead of one. That was the useful failure, because it showed
the premise was wrong. **A box reachable from two floors genuinely has two bands
and one stripe cannot say both.** The container is a 0.7m vault from the crate
stack beside it (a designed step in the Turbine Hall route) and a 3.0m hang from
the floor (what it was added for in Phase 3). Both are real moves.

So the marking keeps naming the tallest approach, which is the designed one on
every multi-tier route, and the check now holds it to "a move this ledge actually
gives" — hard-failing on a marking no approach produces, and *naming* the
ambiguous one rather than swallowing it. The check prints it every run:

```
  -> ledges climbable from two floors: hall-container marked vault, also climbs as hang from y=0.00
```

**Worth your eye on the walkthrough.** Standing on the Turbine Hall floor you
will see a vault stripe on a 3m container you cannot vault. Options are to move
the crate stack off its south face, or to accept it — I did not want to reshape a
route to satisfy a stripe without asking.

### Determinism, measured over a match rather than a shuffle

`ai-patrol-order-is-seed-reproducible` covers the circuit — the first draw from
the stream and the easiest thing to get right. A match is where the stream is
actually spent: patrol pauses, aim error, burst lengths, spread offsets, grenade
decisions, smoke puff positions.

```
PASS  a-match-replays-identically-from-its-seed
      1200 steps of a live match (AI, detection, objective, scripted input) sampled
      240 times: seed 20250814 replayed identically on every sample,
      seed 20250815 differed on 225 of them
```

The input is scripted by step index rather than drawn from the PRNG, so driving
the Shade does not perturb the stream it is testing.

### The regression set, and what labelling it exposed

Section 16 names a set to run after any patch — checks 1, 3, 9, 13, 17, 20, 22,
23, 27 — and nothing ran it. F4 → **U** now runs exactly that subset: 16 of 94
checks, and it says out loud which named checks nothing covers rather than
quietly skipping them.

Building it found that three of the nine had coverage that never declared it.
Check 3 (mantle to a catwalk) was covered by the stairless-routes check labelled
"v2 requirement 4"; check 13 (the finisher) by two combat checks labelled only
with their spec sections; check 27 (the character dims with the meter) by the
feedback check. Coverage is parsed out of each check's own `spec` string rather
than a second field, so the label a check prints is the label it is counted by
and the two cannot drift.

Section 16 coverage claimed went **28 → 29 of 29**. "Claimed" is the honest word:
many are the AUTO half of a check whose other half is still a human looking at a
screen.

### Module splits (Section 3.1)

Two more, both pure moves, both proven behaviour-neutral — 214 collision boxes,
49 marked ledges and identical room entries before and after:

| New file | Out of | Why it is a real seam |
|---|---|---|
| `src/maprooms.js` | mapkit.js | The Section 5 room-entry derivation. Needs the collision world and the room list, nothing else from GameMap |
| `src/systems/astar.js` | ai.js | Pure: nodes in, ids out. The one piece of navigation with no knowledge of a Warden — and the piece that once hung the tab so hard that `1 + 1` timed out |

**Still over the ~600 line guidance**, unchanged in reasoning from the last
round and now with the honest note that this round's features grew three of
them:

- `config.js` (1165) — deliberately exempt. Section 3 makes it the single source
  of truth for every tuning number; Section 3.1's stated rationale for the cap is
  that "long files are where bugs hide", and this is pure data with no logic.
- `main.js` (1083) — composition root, almost entirely wiring. Grew this round
  by the pause handling and the death-camera and alarm wiring.
- `mapkit.js` (945), `agent.js` (905), `ai.js` (754), `map.js` (793),
  `physics.js` (737), `gadgets.js` (633) — what remains in each is cohesive.
  Splitting `ai.js` further means converting eight methods that share instance
  state into free functions taking the AI, which makes the code harder to read,
  not easier — the opposite of what the rule is for.

### Deviations from spec added by these phases

23. **`src/maprooms.js`, `src/systems/astar.js`** — files Section 3 does not
    list. Same class as deviations 1, 12, 16 and 20.
24. **A rim light implemented with `onBeforeCompile`.** Section 4 specifies
    `MeshToonMaterial`; this extends it rather than replacing it, and every
    injection token was verified against the pinned build first. The material is
    still a toon material and the gradient map still drives the banding.
25. **`U` in test mode**, running the Section 16 regression set. Not in the
    Section 17.1 table — added because the spec names a subset "to run after any
    patch" and the full suite is now large enough that people stop running it.
26. **A pause page on the existing menu**, reached by the already-bound `Escape`.
    Section 13 lists the menus and does not name a pause; the binding existed
    with no handler, which is worse than either having it or not.

### Verification actually performed

- **AUTO suite: 94 passed, 0 failed**, run after every change, and **run twice
  in succession at the end** — a flaky check shows up as a different answer, not
  as a passing one. (That is how the stun-grenade assertion in the new grenade
  check was caught: it was reading a rifle round as the grenade's damage.)
- 8 runtime assertions, 0 failures across 600 stepped frames of live competitive.
- **Both modes after the refactors:** free-roam boots with unlimited gadgets and
  a full magazine; competitive holds exactly 1 camera, 1 shadow-casting light,
  3 lives, AI in patrol.
- **Render path:** 313 draw calls, 11,212 triangles, 9 programs (one more than
  before — the rim variant), `gl.getError()` 0.
- **Static:** `Math.random` — one occurrence, the documented audio buffer.
  `setTimeout` — one, the documented GPU fence. `TODO`/`FIXME` — none.

### Not verified (still needs a human)

Shorter than last time, and more specific.

- **Everything visual except the rim light.** The pane still does not composite.
  The rim is now proven by framebuffer readback; the death camera's orbit, the
  ragdoll, the alarm fixture and its blinking lens, the impact sparks and the
  Warden HUD layout are not.
- **Audio has still never been heard.** Fourteen Section 14 rows now fire from
  real game events. Whether any of them reads as the thing it is meant to be is
  entirely unverified.
- **The framerate you will actually see.** CPU 1.9ms and GPU 2.3ms per frame
  under the check-29 load leave a lot of headroom against 16.67ms, but a
  vsync-paced number on integrated graphics is yours to read with the window
  focused.
- **`hall-container`'s stripe** — see the map sweep above. This is a real
  readability call and it is yours.
- **Whether the AI's alarm camera lands somewhere sensible.** It provably hangs
  on a wall and provably works. Whether the walls it picks are ones you would
  have picked is a judgement no assertion makes.

### Exact next action

Play it, and specifically look at the five things above. The regression set (F4
then `U`) is the thing to run after any change from here — 16 checks, a few
seconds, and it covers what Section 16 says matters.

---

## Phases 34 to 45 — looking at it

**Status:** complete. Suite: **94 → 105 passed, 0 failed.** Section 16 coverage
claimed: 29 of 29.

Every entry in this file up to now ended with the same paragraph: *nothing has
been seen on a screen.* The browser pane never composites — `document.hidden`
stays true, `requestAnimationFrame` never fires, screenshots time out — so for
thirty-odd phases the rendered output was the one thing no check could reach.

`gl.readPixels` does not need a compositor. The renderer draws to the canvas
whether or not anything is presenting it, and the pixels are there to be read.
That is what these twelve phases are: the visual and audible half of the build,
measured for the first time.

It is not the same as looking at it. Every check below says which half it is
settling, and the HUMAN list at the end is shorter and more specific than it has
ever been.

### The ten phases, and the one that mattered

| Phase | What it settled |
|---|---|
| 34 | `tests/pixels.js` — frame a subject, render, read back, measure |
| 35 | The affordance stripes are drawn, and brighter than the surface |
| 36 | **Section 4's lit pools and dark gaps — and the bug that was flattening them** |
| 37 | Check 27's visual half: the body dims with the meter, monotonically |
| 38 | The death camera really is pointed at the killer; the ragdoll tumbles then stops |
| 39 | Smoke obscures; the flashbang whiteout reaches the HUD |
| 40 | The alarm fixture renders on its wall, its lens changes, it goes when destroyed |
| 41 | The inverted hull is what draws the silhouette rim |
| 42 | Every Section 14 sound rendered to samples and inspected |
| 43 | The HUD fits on screen and does not overlap itself |
| 44 | The frame budget across 92 viewpoints, not one |
| 45 | A five-round soak: nothing grew |

### The building had no lid

Section 4 calls high contrast between lit pools and dark gaps "the core visual
language". Measuring it found the opposite: with the destructible lights off,
the **Server Vault floor rendered brighter than the Turbine Hall's** — 36.3
against 26.9 — when Section 5 calls the vault "tight, dark ... lowest light".
The detection meter read 72 and 18 for the same two places. The screen and the
meter disagreed, which is precisely what Section 4.2 exists to forbid.

The cause was two layers deep.

`addSolid()` decided what casts a shadow with `height > 0.5`, which is right for
walls and wrong for the things that make an interior an interior — a roof slab
is 0.4m thick. And `addFloorPlate()`, which builds both the roof and the upper
deck, passed `castShadow: false` outright.

So the one shadowed directional light Section 4.1 allows shone **straight
through the roof** onto everything inside the building. Every interior was lit
as though the shell had no lid, and the point lights — the whole basis of the
visibility mechanic — were a small addition on top of a flat wash.

Both are fixed. `addSolid()` now judges an occluder by its footprint rather than
its thickness, so slabs cast however thin they are while trim and stair treads
stay out of the shadow pass; and the plate generator no longer opts its cells
out. Measured after:

```
PASS  lit-pools-and-dark-gaps-are-actually-contrasty
      floor luma: site A 38.2 (+29.3 from its lights), site B 26.8 (+17.9),
      site C 26.1 (+15.7); with every destructible light off the interiors fall
      to 8.9/8.9/10.4, so the pools are what light the rooms; the Turbine Hall
      is 1.46x the Server Vault, which is the darkest
```

Interiors fell from 27–36 to 9–10 on ambient alone. The point lights now
contribute more than the ambient floor everywhere, which is the measurable form
of "the pools are what light the room" — and it means shooting a light out
changes something, which is half the point of destructible lights.

Cost: 24 more shadow casters, 84 → 108. The check-29 benchmark went 1.8ms to
2.0ms median against a 16.67ms budget.

**This is the single most consequential thing found in forty-five phases**, and
nothing but reading the pixels could have found it. Every geometric check
passed throughout: the roof existed, was in the right place, and had a
collision volume. It just was not in the shadow pass.

### What the other visual checks settled

```
PASS  affordance-markings-actually-render
      vault stripe on "stack-hall-low": 51215 pixels drawn, +251.7 brighter than
      the bare surface; 2 band materials at luma 0.184 / 0.395, all distinct

PASS  the-shade-visibly-dims-with-the-meter
      23205 body pixels: luma 37.6 -> 57.5 -> 71.1 -> 82 -> 91.2 across meter
      0/25/50/75/100, monotonic, near-black (37.6) when hidden

PASS  the-outline-darkens-the-silhouette-edge
      10 hulls over 10 body meshes and 23212 pixels: hiding them moved the
      silhouette edge by 54.2 against 4.1 in the interior, so the hull is what
      draws the rim; that rim runs 46.1 hidden to 92.6 lit

PASS  smoke-obscures-and-the-flash-whites-out
      100 sprites covered 918314 pixels (99.6% of frame) and shifted them by
      320.2; the flashbang whiteout reaches opacity 1 and clears to 0

PASS  the-alarm-fixture-is-visible-and-changes-state
      the fixture drew 5287 pixels on its wall, tripping it changed 1541 of them
      (the lens), and destroying it left 1057

PASS  the-death-camera-frames-the-killer
      the killer covers 64769 pixels, centred within 0% of frame centre;
      the body tumbled 3.45 then froze to 0.00000 drift
```

Check 27 is worth singling out. Its AUTO half already proved the numbers moved
together; this proves the *pixels* do, across five points on the meter, without
a band where hiding makes you brighter. That is the disagreement Section 4.2
says would make players stop trusting the mechanic, and it is now measured
rather than reasoned about.

### Audio, rendered to samples

Nobody has heard this game. The suite could prove a voice started and was
released, which is the difference between a graph that exists and a graph that
makes the right noise — a builder with its envelope inverted or its frequency
an order of magnitude out passes every one of those checks.

`audio.renderOffline(name, seconds)` swaps the whole graph onto an
`OfflineAudioContext` and runs the same builder, so what is measured is exactly
what plays rather than a re-implementation of it.

```
PASS  every-sound-renders-to-samples-that-match-section-14
      15 sounds rendered to samples, none silent, none clipping, all decaying:
      shadeFootstep 8051Hz/0.02s, wardenFootstep 1446Hz/0.03s, gunfire 2381Hz/0.05s,
      knifeSwing 3191Hz/0.05s, takedown 60Hz/0.18s...; the Warden's footstep is
      louder (0.05 vs 0.04) and lower (1446 vs 8051Hz)
```

The takedown renders at 60Hz against Section 14's "sub-bass sine thud at 55Hz".
The Shade's footstep sits at 8kHz and the Warden's at 1.4kHz — Section 14 asks
for a high-passed 800Hz burst and a low-passed 400Hz one, and Section 7.2's
design pillar that the Warden is the loud one is now true **in the mix** and not
only in the noise radii.

Pitch is only asserted where the builder is a single oscillator. A thud that is
a 55Hz sine mixed with a 900Hz noise crack has no single pitch, and asking for
one is asking a question the signal does not answer.

### Three checks that were wrong before the game was

Worth recording, because in each case the first result looked like a defect and
was not:

- **The frame sweep reported 14.3ms frames.** It was timing `readPixels`, which
  blocks until the GPU finishes and then copies 3.5MB. Timing the render alone
  gives **mean 1.70ms, worst 5.40ms across 92 viewpoints**.
- **Five sounds looked badly mistuned.** The zero-crossing counter divided
  crossings from the whole buffer by only the audible span, so a 660Hz alarm
  read as 16kHz. Windowing both to the same span fixed it.
- **The soak reported 9 leaked effects.** It was counting footprints, which the
  AI lays continuously as it walks. That is the pool working, not leaking.

The lesson is the one from the slide bug in Phase 21, pointed the other way: a
check that disagrees with the game is not automatically right about it.

### Two findings for you rather than for the code

- **The map has no hang-band markings.** Bands on the map are vault 19 and
  mantle 30; nothing is marked hang, so `_addDashedStripe` never runs. Section 5
  specifies a dashed stripe for ledges above 2.4m. The ledge that should carry
  one is `hall-container`, which the Phase 28 sweep already flagged: a 0.7m
  vault from the crate stack beside it and a 3.0m hang from the Turbine Hall
  floor, both real, and one stripe. Moving the crate stack off its south face
  would give the map its hang marking back.
- **Mantle and hang share a marking intensity** (both 0.75). That is
  spec-faithful — Section 5 distinguishes hang by its *dashed pattern*, not by
  brightness — but it is worth knowing that if the dashes do not read at
  distance, the two bands are identical to the eye.

### Verification actually performed

- **AUTO suite: 105 passed, 0 failed.**
- **`the-frame-budget-holds-everywhere-not-just-at-site-a`**: 92 viewpoints
  across 23 places, mean 1.70ms, worst 5.40ms at "hall-north" (219 draw calls),
  peak 241 calls / 9220 triangles.
- **`a-whole-match-leaks-nothing`**: five rounds with smoke, flashbangs and
  deaths — scene 361 nodes, 272 geometries, 2 textures, 10 programs and 14
  emitter listeners, all unchanged; every fixed pool still its declared size and
  every live count drained to 0.
- **`the-hud-fits-on-screen-and-does-not-overlap-itself`**: 6 panels, all inside
  the viewport, none overlapping, and the overlay passes the mouse through.

### Not verified (still needs a human)

For the first time this is a short list, and none of it is "does it draw".

- **Whether any of it looks good.** Every check here proves something is drawn,
  where, how bright and that it changes on cue. None of them can tell you the
  Turbine Hall reads as a place, the stripes read at a glance, or the finisher's
  orbit is legible.
- **Whether any of it sounds right.** The samples are the right length, level
  and register. Whether the gunfire reads as a gun is still entirely yours.
- **The vsync framerate on integrated graphics.** 1.70ms mean and 5.40ms worst
  against a 16.67ms budget says there is room; it does not say what your GPU
  does with it.
- **`hall-container`'s stripe, and the missing hang band.** A level decision.

### Exact next action

Open `http://localhost:5173`, press Play, and walk the Turbine Hall — the
lighting is materially different from anything described in earlier entries in
this file, and it is the thing most worth a first look.

---

## Phases 46 to 49 — adversarial, and the end of the spec-traceable work

**Status:** complete. Suite: **105 → 108 passed, 0 failed.**

Four phases, not the twenty-five asked for. The reason is in the last section
and it is not a complaint: after forty-eight phases the spec is implemented,
Section 16 is covered, Section 18 is met, and the honest remaining work is a
level decision and a judgement call about file sizes. What was left that had
real value was **adversarial** — every bug found in the last thirty phases came
from a path the tests drove differently from the way a player does, so these
three go looking for more of exactly that.

### Phase 46 — random input, through the keys

The Phase 3 ledge hang and the Phase 21 slide were both unreachable from a
keyboard while every check covering them passed. Both had the same cause: the
checks set intent fields directly, so they could choose a combination no player
can produce. A held key and its press edge arrive on the **same step**; a test
that sets one without the other is testing a machine nobody is sitting at.

`random-real-input-never-breaks-anything` drives `input.heldCodes` and
`input.pressedCodes` — the real binding layer — for a simulated minute, checking
every invariant that has to hold no matter what: no NaN in either actor, nothing
below the floor, exactly one camera, a valid Shade state, a positive time scale,
a finite meter.

The first version churned keys uniformly at 8% per step and reached only
`ground` and `air`. That is a player having a seizure, not a player. Real input
arrives in **bursts** — a run held for a second, then a crouch, then a jump — so
the generator now picks a behaviour (walk, sprint, slide, crouch-walk, jump-run,
strafe, knife-run, gadget-spam) and holds it for 30-120 steps, turning to face
somewhere new each time.

```
PASS  random-real-input-never-breaks-anything
      3600 steps of bursty real key input, 120 invariant sweeps across 10 behaviours:
      no NaN, nothing through the floor, one camera throughout, every state valid;
      reached [air ground slide]
```

Reaching `slide` matters: that is the Phase 21 fix holding up under input
generated without knowing the fix exists.

### Phase 47 — the state machines driven into each other

Everything in this game has been tested alone. The round machine, the match
score, the finisher, the death camera and the pause each work. What had never
been tried is two of them at once.

Eight collisions, each a thing that works alone meeting another thing that works
alone: pausing during the death camera, dying while already dead, `initMatch`
mid-death-camera, `initMatch` while paused, a round ending while a reinsert is
pending, a finisher interrupted by a match reset, a plant completing on the step
the round timer expires, and scoring after the match is already decided.

**One of them was a real bug.** `_end()` incremented the score unconditionally,
so a round ending after the match was already over pushed the score past the
target — 4 against a best-of-5 target of 3. `matchOver` is only cleared by
`resetMatch()`, so anything that started another round without resetting the
match would keep scoring into a finished one. It is hard to reach through the
menu, which offers "Main menu" rather than "Next round" once the match is over,
but it is exactly the kind of thing that becomes reachable the moment someone
adds a rematch button.

`_end()` now refuses once `matchOver` is set.

```
PASS  the-state-machines-survive-each-other
      8 collisions between the round, match, cinematic and pause state machines:
      every one left one camera, a valid state, time scale 1 and control with the player
```

### Phase 48 — other window shapes

Section 2 targets 1080p and nothing had ever been rendered at any size but the
pane's own. Verified live at **1024x768 (4:3)** and **2560x1080 (21:9)**: the
camera aspect follows the viewport, the canvas resizes with it, all five HUD
panels stay inside the frame with no overlaps, 313 draw calls, `gl.getError()`
zero at both.

Worth recording how that was checked, because the first reading looked like a
bug: setting the viewport through devtools emulation does **not** dispatch a
`resize` event, so the camera kept its old aspect and the canvas its old size.
Dispatching the event by hand corrected everything immediately, which says the
handler is right and the emulation is quiet. A real window resize fires it.

### Phase 49 — a zero-size viewport used to blind the renderer

Found by accident while doing Phase 48, which is the best way to find things.
After the emulated viewport was reset, **all eight pixel-readback checks
returned zero pixels at once** — every frame black.

The canvas backing store was 0x0 while CSS still reported 1280x720.
`onResize()` reads `window.innerWidth`, and the emulation had fired a resize at
a moment it reported 0, so the renderer latched a 0x0 drawing buffer and an
infinite camera aspect. Nothing recovers from that until another resize happens
to arrive.

A viewport reporting zero is not exotic — a minimised window, a tab dragged
between displays, and devtools all do it. `onResize()` now ignores a
non-positive size, and there is a check that fires a zero-width resize at the
live renderer and asserts the canvas, the aspect and the draw calls all survive
it.

```
PASS  a-zero-size-viewport-does-not-blind-the-renderer
      a resize reporting a 0 width left the canvas at 1280x720, the aspect at 1.778
      and 313 draw calls on the next frame
```

Worth noting what nearly happened here: eight checks went red at once and the
obvious reading was that something in the last commit had broken rendering. It
had not. The checks were right, the game was wrong, and the cause was two
layers away from anything that had just changed.

### Why four and not twenty-five

The spec is frozen — Section 3 says so in its second line. After forty-eight
phases:

- All 29 Section 16 checks have AUTO coverage, and the named regression set runs
  from one keypress.
- Section 18's definition of done is met except for the items that require a
  person: how it looks, how it sounds, and the framerate on your machine.
- 107 AUTO checks, 8 runtime assertions, zero failures.

What genuinely remains is two things, and both are **yours**, not mine:

1. **The map has no hang-band markings.** Bands are vault 19, mantle 30, hang 0,
   so Section 5's dashed stripe is code that never runs. The ledge that should
   carry one is `hall-container` — a 0.7m vault from the crate stack beside it
   and a 3.0m hang from the Turbine Hall floor, both real moves, one stripe.
   Moving `stack-hall-mid` off its south face would restore the third band, but
   that stack is the 0.7m step in the Turbine Hall route that
   `shade-reaches-level-2-without-stairs` drives end to end. Reshaping a
   verified route to satisfy a stripe is a level-design call, and I have flagged
   it three times rather than make it.

2. **Six files are over Section 3.1's ~600 lines** (config.js 1165, main.js
   1083, mapkit.js 945, agent.js 905, ai.js 754, map.js 793, physics.js 737).
   Eight modules have already been split out and each was a real seam. What is
   left in each of these is cohesive: splitting `ai.js` further means turning
   eight methods that share instance state into free functions that take the AI,
   which makes the code harder to read rather than easier — the opposite of what
   the rule exists for. `config.js` is exempt by Section 3's own single-source-
   of-truth requirement.

Everything beyond that would be **new features**, which Section 3 forbids
without a decision from you. Say what you want built and I will build it; ask
for more phases against this spec and I would be inventing work to fill a
number, which is worse than saying so.

### Verification actually performed

- **AUTO suite: 108 passed, 0 failed**, run twice in succession.
- 8 runtime assertions, 0 failures.
- Live at three viewport shapes; camera, canvas and HUD correct at each.
- The fuzz reaches `ground`, `air` and `slide` from generated key input alone.

### Not verified (still needs a human)

Unchanged and short: how it looks, how it sounds, the vsync framerate on
integrated graphics, and the `hall-container` stripe decision above.

---

# THE ENDGAME REDESIGN — no markings, reach-based traversal

Josh, after phase 49: *"endgame there should be no markings. should be able to
do on a ledge what you would expect to be able to."*

That is a spec change, not a tweak. Section 5 mandates affordance markings and
Section 6.1 fixes three traversal bands; both go. Interviewed and settled:

| Decision | Answer |
|---|---|
| Scope | All traversal aids: ledge stripes, chevrons, dashes AND the lit vent interiors. Plant-site rings stay — a bomb site is objective information, not an affordance |
| Climb rule | Reach-based, athletic: ~2.6m standing, ~3.8m with a jump |
| Failed climb | A physical tell plus audio. Never silent |
| Hang | A held option you choose, not a failed mantle |
| Warden | Stays grounded. The asymmetry is the game |
| The test | **Purely mechanical.** Standable top + within reach ⇒ climbable. No tags, no exceptions, no `noClimb` |
| Map | Keep the five v2 requirements, reshape everything else freely |
| Vents | Read as passable by material contrast — metal against concrete |
| Spec | Amend Sections 5 and 6.1 with a changelog |

Fifty phases in six blocks: strip and measure (1–7), reach-based traversal
(8–18), area-by-area rebuild (19–34), legibility without markings (35–41), feel
(42–46), close (47–50).

## Phases 1 to 7 — strip and measure

**Status:** complete. Suite: 108 → **102 passed, 1 failed** — and the one
failure is deliberate. See the census below.

### What came out

- `generateAffordanceMarkings()`, `_addChevrons()`, `_addDashedStripe()` and
  `ledgeBandsFor()` — 168 lines of marking generation.
- The vent interiors' self-illuminated panels.
- `noClimb`, entirely. It is gone from `addSolid`, from `addFloorPlate`, from
  the collision box, and from the map.
- `vaultBand` / `mantleBand` / `hangBand`, and every marking constant except
  the plant-site ring.
- Six AUTO checks that asserted markings exist or that a failed mantle becomes
  a hang.

### What went in

**The reach model** (`CONFIG.shade.reach`) replaces the three bands. Standing
2.6m, a jump adds 1.2m, anything under 0.32m is not a climb because the solver
already carries it, and at or below 1.15m it reads as a vault rather than a
mantle. `classifyLedge(height)` became `classifyReach(rise, reach)`.

**The probe became a sweep.** It was six fixed heights — 0.25, 0.6, 1.0, 1.45,
1.9, 2.35 — and a 0.2m floor slab sitting between the last two was invisible to
it, which is exactly how the v2 vent lips classified, marked, and could never be
climbed. A ladder of fixed samples has gaps by construction. It now steps
continuously at 0.12m up to whatever the body can reach.

**Hang stopped being a failure.** Overreaching used to catch the ledge. It now
does nothing, and hanging becomes something you choose (block B).

### The census — the new contract

With no markings there is nothing to keep in sync, so the whole contract is one
mechanical rule with no exceptions:

> A surface is climbable when you could stand on top of it and the body could
> reach it from whatever is below. If it is climbable, the controller must
> actually climb it.

Two checks hold it. The first is cheap and passes:

```
PASS  the-climb-rule-has-no-exceptions
      214 boxes, 65 climbable, 0 disagreements with "standable top within 3.8m";
      no opt-out flags remain, and the 6m deck stays out of reach on its own merits
```

Climbable surfaces went **49 → 65**: athletic reach opened sixteen that the old
bands excluded. And the deck's one-way routes are now enforced by the vertical
layout rather than by a flag — 6m against 3.8m of reach — so a future change to
a floor height cannot silently make the drop shaft two-way without this
noticing.

The second check is the census. It walks the Shade up to all four faces of every
climbable surface on the map and drives the real controller at it: hold forward,
and jump if it is above standing reach.

```
FAIL  every-climbable-surface-can-actually-be-climbed
      49 of 65 climbable surfaces cannot be climbed. Worst area: "turbine-hall"
      with 14. By area: turbine-hall 14, loading-bay 14, interior 8,
      server-vault 7, exterior 4, upper deck 2
```

**This failure is the deliverable.** It is the honest baseline the whole
redesign is measured against, and its per-area breakdown is the work queue for
blocks B and C. It will stay red until the traversal work and the area rebuilds
close it, and leaving it red is the point — a contract nobody is failing is a
contract nobody is holding.

The first area is decided by the numbers rather than by taste: **the Turbine
Hall**, with the Loading Bay level alongside it.

### One thing found on the way

The lighting check had been quietly measuring the wrong thing. It samples a site
floor from straight above, and a plant site carries a 2m hazard ring pulsing
between 0.35 and 0.9 opacity — sitting exactly in the crop. In the dark rooms it
dominated the reading, and because the lit and unlit samples are taken moments
apart it was caught at different points in its pulse, which is how an "ambient
floor" came out brighter than the same floor with the lights on.

Sampling 3.5m off the ring gives the real picture, and it is a much better one
than the number recorded last round:

```
PASS  lit-pools-and-dark-gaps-are-actually-contrasty
      floor luma: site A 28.4 (+27.4 from its lights), site B 20.2 (+19.1),
      site C 12.7 (+10.0); with every destructible light off the interiors fall
      to 1.1/1.1/2.6, so the pools are what light the rooms; the Turbine Hall is
      2.24x the Server Vault, which is the darkest
```

Interiors at 1.1 luma with the lights off, and 2.24x between the brightest and
darkest room. The 1.45x recorded in the previous entry was ring, not room.

### Verification actually performed

- **102 passed, 1 deliberate failure.** No syntax errors across 40 modules.
- 214 collision boxes unchanged; climbable 49 → 65 by the new rule.
- The census drives ~250 real climb attempts through the input layer in 0.9s.

### Exact next action

Block B, phases 8–18: make the controller generous enough that the obvious thing
works — jump-extended reach at the probe, approach tolerance, input buffering,
and the bump-plus-scuff when a climb genuinely cannot happen. Then block C takes
the Turbine Hall first, because the census says so.

## Phases 8 to 11 - the controller reaches the way the rule says it does

**Status:** complete. Suite: **102 passed, 1 deliberate failure**. The census
went **49 -> 12**, and what is left in it is no longer controller work.

### What a climb is now

Two things were wrong, and the second was hiding behind the first.

**The jump was being spent twice.** The probe read "airborne means full stretch
from the current feet". A jump lifts the feet 0.46m, so measuring the whole 3.8m
from up there put the real ceiling at 4.26m - a controller quietly climbing what
`deriveClimbableSurfaces()` calls out of reach, with the site fence sitting at
4.5m. `_reachNow()` measures the bonus against the take-off height instead, so
the ceiling is `launch + 3.8` for the whole arc: the same number the map derives
from. The jump extends the reach, it does not multiply it.

**Nothing could be climbed from the ground.** The only ground path was
`intent.sprint && forward && _tryVault()`, and `_tryVault()` took the vault band
alone. A 1.0m crate could not be climbed without sprinting at it, and nothing
above 1.15m could be climbed from a standing start at all, because the mantle
lived exclusively in `_stepAir()`. A 2.3m lip, well inside a 2.6m standing
reach, ate every step of held forward and did nothing. The census had counted 58
vault-band and 57 mantle-band faces in exactly that state and I had read the
number as "the map is wrong".

`_tryClimbFromGround()` replaces it. Sprint is gone from the gate - it never made
a climb possible, only permitted, and "hold shift to be allowed onto a crate" is
a marking by another name.

**What replaced it, decided by Josh:** the jump. Walking into a crate does not
climb it; jumping into anything within reach does. Asked directly, because a
climb on contact costs you waist-high cover - walk up to a crate with a rifle
pointed at you and you go over it instead of behind it. The gate reads the jump
BUFFER rather than the press edge, so a jump pressed slightly early still climbs
instead of being spent in front of the wall. That is block B's input buffering,
arriving for free.

### The bug both of those were standing on

The probe casts a horizontal ray at each sample height. A ray whose origin is
already inside a slab passes straight through it and reports the face of
whatever it is buried in. So the sweep could see through concrete, and the
controller would climb through it - demonstrated from inside a duct, where 1.15m
of roof overhead and the lip on TOP of that roof came back as the ledge ahead,
and the body mantled through the slab onto it. `_commitMove()` had no objection:
it validates where a move ENDS, not what it passes through.

The sweep now stops where the hand does. Once the column above the body is
blocked, everything higher is unreachable, so it breaks rather than skipping.

Two green checks turned out to be resting on that bug:

- `shade-reaches-level-2-without-stairs` started each hop 0.55m from the ledge -
  inside the probe's own reach, so it never tested walking up to anything. On the
  two gantry-to-deck hops the deck lip overhangs its gantry by 0.6m, so 0.55m
  back put the body under the overhang, crouched, with concrete overhead. The hop
  only ever succeeded by probing from inside that concrete. From a real standoff
  both hops climb; the overhang is noted for the area rebuild.
- `sprint-vault-clears-a-crate` asserted the sprint gate. It now runs at the
  crate and jumps, which is what the amended rule says a vault is.

### The census was testing a different sentence than the rule states

The rule reads "the body could reach it **from whatever is below**". The census
stood in one spot per face - the middle, `radius + 0.25` out - and dropped a ray.
For anything on the floor that is right and complete. For anything stacked it was
not: `lip-bay` got approached from the bay floor 6m down, which the rule already
calls out of reach, while `gantry-bay` at 4m - the surface the rule derived it
from, and the one the stairless route climbs from - was never stood on at all.
Three of `lip-bay`'s four faces came back with a rise of 0.00, because the ray
landed on the deck the lip is part of. The box was recorded as unclimbable while
the body was standing on it.

Three fixes, all of them making the check test the sentence:

- Approach heights come from `_supportCandidates()`, the same list the rule
  reads, each confirmed to be real ground at that spot.
- Three distances back, furthest first, because a player backs up.
- Three positions along each face, because judging a 6.6m gantry by its midpoint
  excludes the whole thing - which `standableTop()` had already learned on the
  other side of the same problem.

A crouched approach counts too. Several surfaces in the stacked routes sit under
the deck with only crouch headroom, and that is where the controller leaves you.

Out of reach from a given surface is no longer a failure - it is the rule
agreeing with itself. A box only fails if the rule says a body standing
somewhere could make it and the controller cannot.

```
FAIL  every-climbable-surface-can-actually-be-climbed
      12 of 65 climbable surfaces cannot be climbed (9 with nothing in reach
      of them). By area: upper deck 5, loading-bay 3, turbine-hall 2,
      server-vault 2; 20 need a leg up first
```

The nine are `_supportCandidates()` counting a neighbour within `vaultReach` of
the footprint as "below" when it is really "beside" - the rule naming a support
you cannot stand on. The other three (`deck-1`, `deck-16`, `deck-21`) are deck
slabs reachable only from a gantry with 1.3m of headroom, where a crouched body
genuinely cannot make a 2.0m rise - you get onto the deck by its lip instead.
All of it is geometry, and all of it belongs to the area rebuild.

"20 need a leg up first" is reported rather than failed, at Josh's call. A
surface you have to climb something else to reach is the point of a stacked
route; it is only worth knowing how much of the map is behind one.

## The plant is a room, not a circle

Josh, mid-session: *"able to plant the bomb anywhere in the room. not just in
the circle."*

Spec amended - Section 10.1, and a new Section 20 to hold the amendments the
redesign has been promising since phase 47 was written down.

The plant needed the body within 2m of a site centre, which made the hazard ring
a target rather than a label and left the Warden three square metres of floor to
watch. A site now knows its room, derived by containment so a site that moves
cannot point at the room it used to be in, and the plant is allowed anywhere in
that volume. The room's own floor and ceiling do the vertical separation that a
hardcoded 2.5m tolerance used to: site C is on the deck directly above the
Loading Bay, and standing under a floor is not standing in the room above it.

The consequence that mattered more than the change: **the charge now sits where
it was planted.** `round.chargeAt` is the position, the site id is only which
room. The beep, the AI's defend target and the defuse proximity all read it. The
defuse radius itself is untouched - it is arm's length, not a marking.

And every objective check planted on the ring's centre pixel, the one spot where
"the charge" and "the site" are the same point. The whole file would have gone
on passing with the charge tracked at the site centre and the Warden defusing
thin air ten metres from the bomb. `plantAt()` now plants as far off the ring as
the room allows, and `the-ai-walks-to-the-charge-and-defuses-it` fails if the
plant lands within a site radius of the centre - too close to prove anything.

```
PASS  the-ai-walks-to-the-charge-and-defuses-it
      planted at A but 6.0m off the ring, then hid: the Warden pathed 12.8m to
      the charge, held an 8s defuse and won the round 17.1s after the plant
```

### Verification actually performed

- **102 passed, 1 deliberate failure**, twice, with identical answers.
- Plant driven through the real key layer from four positions: on the ring, both
  far corners of the Turbine Hall (18.6m and 13.4m off it) and outside the shell.
  The three inside plant at A; the one outside does not plant at all.
- Vertical separation driven the same way: the bay floor plants B, the deck above
  it plants C, and the ground directly under site C plants nothing.
- Census timing: 0.5s -> 1.9s for roughly four times the approaches. Suite 5.4s.

### Two things that cost time, for whoever is next

**A cold suite reports a false frame-budget failure.** `hall-north` came back at
17.80ms against an 8.33ms ceiling on a suite run straight after a reload, and
1.22ms mean on every warmed run. Drive 60 frames of `renderFrame()` before the
suite. The handoff already says warm up before measuring; it is worth saying
that the AUTO suite counts as measuring.

**`every-sound-renders-to-samples-that-match-section-14` is flaky.** It failed
once with "the Warden's footstep peaks at 0.045 against the Shade's 0.049" and
has passed every run since, with nothing audio-related changed in between. Two
peaks 0.004 apart is a threshold sitting on top of the value it is testing.

### The hole the room rule left, found immediately

Josh, straight after seeing it work: *"actually should only be plantable where
the ward is able to defuse."*

He is right and it is the redesign's own asymmetry biting. The Warden stays
grounded; the Shade now climbs anything within 3.8m. So inside a site's room the
Shade can get onto a gantry, a crate stack, a vent roof or a deck lip and plant
where no Warden can kneel - an unloseable plant, and one that also strands the
AI, because `setDefendTarget(round.chargeAt)` sends it at a charge it cannot
reach and it stalls in DEFEND for the whole fuse.

The rule agreed: **a plant is legal exactly where a Warden could stand and
defuse it.** Not a second authored zone - it answers to the defuse check itself,
so the two cannot drift.

**Planned, deliberately not started** (Josh: "put into plan but dont start next
steps yet"). Six phases, written up in `HANDOFF.md`: derive the Warden's
reachable ground as map data, express `canDefuseAt()` against it, gate the plant
every step of the hold rather than at commit, give refusal a tell, a
census-shaped check over every climbable top and vent interior in a site room,
and a decision on the `dy < 2.5` defuse tolerance that this makes load-bearing.

### Exact next action

The plant-must-be-defusable block, above, before anything else.

Then block B, which is not finished: hang as a held option and the
bump-plus-scuff are still to do, and neither has a check. Then block C, which
now has an honest queue - the twelve, and the deck-lip overhang the route test
walked into.


## The gate, headless (2026-09-08)

The routine's first scheduled run, 17:00, stopped where the plan said it would
stop if the base were broken, except the base was fine: the Browser pane
refuses to start a dev server from an unattended session, by rule. No pane,
no page, no `window.BLACKLINE`, no gate. It wrote D14 and left the tree clean
(`b340bf4`), which is the protocol working. The verification path was the
thing that did not exist.

**Built:** `scripts/suite.mjs`, `npm run suite`. An in-process static server
for the repo; `playwright-core` driving the Chrome already on this PC,
headless, with `--use-angle=swiftshader`; wait for the harness; warm 60
frames; `runAutoTests()` N times (default 2); one JSON report. Exit 0 only if
nothing is red outside QUEUE.md's Deliberately-red list (parsed from the
bullet list there, one source of truth) and every run agrees.
`scripts/suite-skips.json` lists checks that cannot pass headless, with a
reason each; they are reported with their outcome, never counted.

**Verified:** first run, 101 passed / 2 failed, twice, identical. The two
failures: the census (expected) and
`the-frame-budget-holds-everywhere-not-just-at-site-a` (415.80ms at
`stair-hall-foot` against 8.33ms; SwiftShader). The second is the one skip.
With the skip in place, `--runs 1` exits 0. Renderer string confirms
software: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))`.
Every pixel-readback check passed headless, which is the thing that had to be
true for any of this to work.

**Found, open:** the second of two runs takes four times the first (238s
against 60s) with identical results. Not a correctness problem; worth
knowing before anyone reads the `ms` field as a benchmark. The four console
errors per run were all `favicon.ico` 404s; the runner's server now answers
that with 204, so `consoleErrors` is a real signal.

**Changed:** both routine prompts gate on `npm run suite -- --runs 1` and
verify on `npm run suite`, and are told not to touch the pane. The build
task was paused while this was built and is enabled again. No Chromium
download was needed (D15). No permission allowlist was written: the
session's own guardrails refused to let Claude write one, which is the
right answer, and it would not have helped, since the refusal is the tool's
rule rather than a permission.


## A1 — where the Warden can stand (2026-09-09)

The first job of Block A, and the one the other five lean on. The directive is
*"should only be plantable where the ward is able to defuse"*, and answering it
needs a thing the codebase did not have: a statement of where a Warden can be.
The asymmetry the whole redesign rests on — the Shade climbs, the Warden does
not — was true only because no controller had ever implemented a climb for it.
That is a fact about the code, not a property of the map.

**Built:** `src/mapground.js`. `deriveWardenGround(collision, spawns)` floods a
0.5m column grid over the site footprint outward from the Warden spawns and
returns a `WardenGround`. Each column holds every floor height in it the Warden
can walk to, lowest first, so a cell under the upper deck carries both the deck
and the floor six metres below it. An edge between two cells exists when the
floors are within `warden.stepHeight` of each other **and** the standing capsule
fits in the gap between them — the two halves of what the swept solver's
`_tryStep()` does, asked once at build instead of every frame. Called from
`buildMap()` beside `deriveClimbableSurfaces()` and `deriveRoomEntries()`;
reachable as `map.wardenGround`.

It is map data, not an objective-system private, because three systems already
guess at the same question: whether a waypoint is standable, whether a DEFEND
path can complete, whether a patrol route is walkable end to end.

`WardenGround` exposes `has(position, tolerance)`, `floorsAt(x, z)`,
`cellsWithin(position, radius)` and `forEach(fn)`. `cellsWithin` is the one A2
wants: it returns foot positions and leaves the vertical test to the caller,
because what counts as close enough differs between a defuse reach and a patrol.

A new module rather than more of `mapkit.js`, which is already past the ~600-line
guidance and already split twice (`mapbake.js`, `maprooms.js`). `mapkit.js` gains
a four-line delegating method, in the shape `deriveRoomEntries()` set.

**Decided, provisionally (D16):** the step limit is symmetric, so the set is
ground the Warden can walk to *and walk back from*. A one-way drop off the deck
is not in it. The set exists to answer "could a Warden defuse here", and a
Warden that falls somewhere it cannot leave has not defended the site — it has
removed itself from the round. The conservative direction can only ever make
fewer plants legal, which is the safe side of D5.

**Verified:** two new AUTO checks in `src/tests/map.js`.

`the-warden-can-walk-to-every-spawn-waypoint-and-site` — 25,177 standable cells
in 18,550 columns (6,627 carrying two or more floors), and all 4 Warden spawns,
all 20 patrol waypoints and all 3 site centres are on it. 18,550 of 20,800
columns means the Warden can walk out onto the apron as well as round both
floors, which is right: the shell has doors.

`the-warden-never-climbs-to-reach-its-ground` — no cell sits inside any of the 5
vent runs (the standing capsule does not fit in a crouch-only duct, and this
asserts it against the vent volumes rather than trusting it). Of 65 climbable
surfaces, 17 are reached, every one of them at y=6.00: the deck lips, flush with
the deck the Warden already patrols. None was climbed onto.

Suite: **103 passed, 2 failed**, twice, identical. Same two as before — the
census (deliberately red) and the frame-budget check (skipped headless).
`consoleErrors` 0.

**Found:** the second check was wrong twice before it was right, both times by
reading the derivation's own constants back at it.

First version asked whether a climbable top had walkable ground beside it
"within `warden.stepHeight`". A check that reads the constant the derivation
read can only agree with it: raising the Warden's step to 2.00m left the check
green while the fill happily walked up crate stacks. Now it asks whether the
ground beside is *level* with the top — a fact about the geometry.

Second version called a cell "beside" the surface when its centre was past the
footprint edge. But `standableFloors()` matches the swept solver, which rests a
body on any top face its footprint overlaps — so a cell 0.25m past a crate's
edge is standing *on the crate*, and counted as proof the crate was walkable.
Every climbed surface vouched for itself. "Beside" now means the body is clear
of the surface altogether, by a full `warden.radius`.

The teeth test that settles it: with `warden.stepHeight` temporarily at 2.00m,
the check names what the Warden got onto — `vent-low-north-roof`,
`vent-grade-west-roof`, four `office-cover` slabs, the crate stacks. At 0.35m it
is green. Reverted.

**Left:** A2 is next and wants nothing that is not here. Two things worth
knowing: the fill reaches the apron, so `cellsWithin` near the shell will return
cells outside the building; and `forEach`/`columns` are the only way to enumerate
the set, which is fine at 25k cells but is not an index — if A5's census needs
"the nearest reachable cell to an arbitrary point" it should add one rather than
scan.

## D17 — a climb is a press of Space (2026-09-09)

Josh: *"climbing things again without a choice. must press space to
climb/vault etc..."*

**Where it came from.** The ground path was already gated on the jump buffer
(phase 9: "the jump took sprint's place"). The airborne path was not:
`_stepAir()` called `_tryMantle()` on every step, and `_isApproaching()` counts
a held forward as approaching, so stepping off any edge while holding W climbed
the first face within 3.8m. Under the old banded rule few faces qualified; under
the reach rule most do, which is why it came back.

**Built.** One flag, `_climbArmed`. Set by the jump launch and by a press of
Space while airborne; cleared by the coyote walk-off, a hang drop, the defensive
no-ledge exit, and every landing. `_stepAir()` mantles only while armed. The
ground path and step-overs are untouched.

**Verified.** New check `a-climb-is-a-press-of-space-never-a-side-effect`
drives the real input at a ground-level ledge the controller's own probe agrees
is in reach (`stack-hall-mid`, about 2m): forward alone on the ground, nothing;
Space, climbs; airborne 0.6m up in front of it holding forward, falls and lands;
Space during the fall, climbs. Against the pre-change controller (stashed) the
check is red with *"falling past stack-hall-mid while holding forward climbed
it without Space"*, which is the bug in one line. Full suite 104 passed / 2
failed, twice, identical; census unchanged at 12 of 65; console errors 0.

**Recorded.** Spec 20.2; decision D17. B1 (hang as a held option) should read
the same press, noted in 20.2.



## A2 — one defuse reach, asked of the map (2026-09-09)

The plant rule Block A is building — *a plant is legal exactly where a Warden
could stand and defuse it* (D5) — only works while the plant side and the
defuse side measure the same reach. Two copies of the numbers is two rules, and
the one a player meets is whichever drifted. So A2 is less a feature than a
de-duplication with a predicate on top.

**Built.** Three things in `systems/objective.js`:

- `DEFUSE_REACH`, exported: `radius` (from `round.siteRadius`) and `dy` (the
  literal 2.5 that used to sit inline). Deliberately not frozen — see Verified.
- `withinDefuseReach(foot, at)`, the one place the reach is measured.
- `Objective.canDefuseAt(at)` — asks `withinDefuseReach()` of every cell of
  A1's `map.wardenGround` inside the radius. The defuse now asks the same
  predicate of the Warden, through a module-scope `FOOT` scratch so the
  per-frame path still allocates nothing.

The value of `dy` was left alone on purpose: A6 owns whether 2.5m is the right
answer to "can a Warden reach up to a charge on a crate". A2 only gave it one
home. A6's queue line was rewritten to say so, since half of what it asked for
now exists.

**Verified.** New check `candefuseat-and-the-defuse-measure-one-reach`. It
does the done-when — `canDefuseAt` true at all three site centres — and then
proves the sharing the way HANDOFF.md says derived data has to be proved: by
moving the constant and watching both sides move. Radius to 0 kills the defuse
and every site centre; radius to 3× makes a Warden at 1.5× start defusing;
`dy` to 0 kills both; `dy` to 2.5+2 pulls a point 3.5m up into reach. Restored
in a `finally`, because a leaked reach would silently rewrite every check after
it.

It is a real check: reverting the defuse to its own copy of the two numbers
turns it red with *"with the radius at 0 the defuse still ticked; with the
radius at 6.0m the defuse still refused 3.00m; with dy at 0 the defuse still
ticked"* — the drift the job exists to prevent, in one line.

Full suite **105 passed / 2 failed, twice, identical**; flaky empty; console
errors 0; census unchanged at 12 of 65.

**Found — the gate can lie on a loaded machine.** One verify run came back with
*eight* pixel checks flaky at once and its second run at 108s against the
first's 62s. It did not reproduce: two full runs on stashed HEAD were clean,
two more with A2 in were clean, and the eight ran green twice as a subset
alongside the new check. Second runs on this PC now drift between 60s and 230s.
So the gate's answer depends on what else is awake, which makes a green run
worth less than it should be. Queued as **F1** with the first suspect named
(`a-zero-size-viewport-does-not-blind-the-renderer` restoring the canvas late,
which is the documented cascade), and the trap written up in HANDOFF.md.
Whoever takes it: do not settle it by weakening a pixel check.

**Raised.** D18, provisional: `canDefuseAt` reads cell *centres* off a 0.5m
grid, so it is exact only to about 0.35m. Never over-permissive — every cell
came from a flood that proved a standing body fits — but it can refuse a plant
the Warden could just barely have reached. Left conservative, for D16's reason:
the set exists to keep D5's promise, and fewer legal plants can only ever keep
it. Override by testing the cell rectangle instead of its centre.

**Left.** A3 is next and now has everything it needs: gate `_stepPlant` on
`canDefuseAt(shade foot)` every step of the hold, not at commit. Worth knowing
before starting: `_stepPlant` already zeroes `plantProgress` whenever the site
or the interact goes away, so a refusal wants that same branch, plus D6's HUD
line and *no* noise emit — the noise is emitted before the progress check
today, so the refusal has to return above it or a refused plant gives the Shade
away.

## A3 — the plant refuses before it starts (2026-09-10)

**Why.** Block A's rule is one sentence: *a plant is legal exactly where a
Warden could stand and defuse it* (D5). A1 built the ground and A2 built the
predicate; A3 is where the game finally asks. The queue was specific about
*when* it asks — every step of the hold, never at the commit. Four seconds of
progress and then a refusal is the worst answer available: it reads as "nearly"
while it means "never", and it costs the Shade the four seconds as well.

**Built.** `_stepPlant()` in `systems/objective.js` now has a second gate under
the site-and-interact one. It fills a module-scope `SPOT` with the Shade's feet
— the same point the commit would record, not the site centre and not the
body's middle — and returns unless `canDefuseAt(SPOT)` says a Warden could
kneel there. The refusal reuses the existing lost-progress branch, so partial
progress is zeroed the way Section 10.2 already required, and it returns
*above* the noise interval: D6 says no sound and no noise event, and a refused
plant that pinged the Warden's ears would be worse than a silent one.

Because that call is now per-step rather than per-plant, `canDefuseAt()` stopped
allocating. `WardenGround` gained `someCellWithin(position, radius, test,
context)` — the same scan as `cellsWithin()` without the array, handing the test
one reused cell and stopping at the first yes. The test is a module constant
(`REACHES`) rather than a closure, so the gate allocates nothing at all on the
step it runs. `cellsWithin()` stays for the callers that want the list; A5's
census will want it.

**Verified.** New check
`a-plant-never-starts-where-the-warden-could-not-defuse-it`. It takes the
census's own ledge list, keeps every climbable top a standing body fits on
inside a site's room, and asks which of them `canDefuseAt` refuses. Then it
drives the game the way a player does — `h.input.heldCodes.add('KeyE')` and
`h.stepFrames`, through the real loop, not `intent.interact = true` — for
`plantHoldTime + 1` seconds on each of the first three, and asserts progress
never left zero, the charge never committed, and no `plant` noise event
escaped.

Then the part that keeps it honest. Selecting the perches with `canDefuseAt`
and asserting `canDefuseAt` refused them would be the A1 mistake: a check that
reads the constant the derivation read can only agree with it. So it opens
`DEFUSE_REACH.dy` a metre at a time until the same perch is legal, holds again,
and requires that it plants — the gate is proved to be reading the live reach
rather than carrying a private exclusion. Restored in a `finally`. Finally, an
ordinary floor plant at site A still works, so the gate is not refusing
everything.

It is a real check. With the gate disabled it goes red with *"server-rack-0
(1.9m up, room C) planted anyway; server-rack-0 emitted 5 plant noise events
while being refused; hall-container (0.7m up, room A) planted anyway; ...
gantry-hall (1.0m up, room A) planted anyway"* — both halves of the job, and
D6's noise, in one line.

Full suite **106 passed / 2 failed, twice, identical**; `red` and `flaky`
empty; console errors 0; census unchanged at 12 of 65. Run 1 162s, run 2 349s —
the second-run drift F1 is queued for, not a different answer anywhere.

**Found — the refusals are not the ones you would guess.** Two of the three
perches the gate turns away are barely off the floor: `hall-container` at 0.7m
and `gantry-hall` at 1.0m, both well inside `DEFUSE_REACH.dy`. They are refused
horizontally, not vertically — the plant is at the middle of a wide top, and
the nearest cell of Warden ground is further than `radius` (2.0m) away. That
is D5 working exactly as written, and it means the standing rule is already
"you may not plant in the middle of anything wider than four metres", which
nobody has stated out loud. It is evidence for A6, whose brief was the
*vertical* reach: the horizontal one turns out to be doing more of the
excluding. A6's queue line now says so. It is not a change anyone should make
without Josh, because widening `radius` widens the *defuse* too.

**Left.** A4 next: the HUD line "cannot plant here" (D6) on a refused hold. The
gate it hangs off is in place and already takes the refusal branch alone, so
A4 is a message and a check that reads it; the no-noise half of A4's done-when
is already asserted here and can be extended rather than rewritten.

## A4 — a refused plant says so, and says nothing else (2026-09-10)

**Why.** A3 made the plant refuse. An interact key that does nothing is the
marking problem inverted — the redesign took the stripes off the ledges because
a rule should be legible from the world, and then Block A added a rule with no
tell at all. D6 decided what the tell is, and just as carefully what it is not:
a HUD line, "cannot plant here". No sound. No noise event. A refused plant must
not give the Shade away, which is the one way a tell could cost more than the
silence.

**Built.** `round.plantRefused`, recomputed from scratch at the top of
`_stepPlant()` every step and set true only in the gate's own branch. Not a
latch: releasing interact or stepping off the crate clears it without anything
having to remember to, and `_onShadeDeath()` clears it too, because a death
mid-hold is the one path that never runs another `_stepPlant`. It leaves the
system through `objective.hud`, which is the only way the HUD is allowed to
learn anything.

`ui/hud.js` exports the decided string as `PLANT_REFUSED` and the refusal
borrows the prompt panel the plant already owns rather than opening a second
one — it is the answer to "hold E to plant", so it belongs in the same place
the question was asked. Under a `refused` class the text goes hazard orange and
the hold bar is hidden, because a bar sitting at zero reads as a hold that is
not filling rather than as a refusal. That is presentation, so it is taken
rather than asked (D4).

**Verified.** New check `a-refused-plant-says-so-and-says-nothing-else`. It
reads the HUD through a real frame — `h.input.heldCodes.add('KeyE')` and
`h.renderFrame()`, not `hud.update()` with a state object the check wrote —
because the whole risk in a HUD job is main.js gathering the wrong field, and a
hand-fed HUD passes with that wire cut. It asserts the panel is shown, the text
is exactly `PLANT_REFUSED`, the bar is gone, progress is zero and no `plant`
noise event escaped; then that one step after release clears all three; then
that the same hold on the floor of the same site prompts and noises normally,
so the line is the plant rule speaking rather than the panel's only remaining
state.

Cutting one line out of main.js turns it red with *"the HUD read "hold E to
plant" on server-rack-0, want "cannot plant here"; the hold bar was still drawn
under a refusal"*.

The perch finder A3 grew is now a helper, `perchesInSiteRooms(h)`, shared by
both checks.

Full suite ****107 passed / 2 failed, twice, identical** (runs of 175s and 382s)**; `red` and `flaky` empty; console errors 0; census
unchanged at 12 of 65.

**Found — a check that drives a real frame owns what it leaves behind.** The
first subset run failed two checks, and only one of them was mine:
`hud-reads-the-meter-it-is-shown-beside` went red with every readout at zero.
`hud.update()` returns early when the HUD is hidden, and `hud.setVisible()`
runs *inside* the frame from `!menu.open`. So the HUD had been visible for that
check only because nothing before it had ever rendered a frame with a menu up.
A4 rendered one, and poisoned its neighbour — the F1 cascade shape exactly, in
a check with no pixels in it. Fixed by hiding the menu at the top the way every
frame-driving check already does, and by putting the HUD back visible at the
bottom, with the reason written next to it. Worth knowing for F1: the shared
state that lets one check spoil the next is not only the canvas.

**Left.** A5 next, and it is the big one in Block A: the census-shaped check
over every climbable top *and vent interior* in a site room, the inverse
(sample legal positions, assert a Warden can path to a cell that defuses each),
and `spotOffTheRing()` taught to pick from the legal set. `perchesInSiteRooms()`
in `tests/objective.js` is half of its first half already.

## A5 — the census, and what it found in the ducts (2026-09-10)

**Why.** A2 built the predicate, A3 made the game ask it, A4 made the refusal
speak. All three were proved at spots a check picked. A5 is the one that asks
the whole map, and — more importantly — the one that asks whether the rule
itself is telling the truth. Everything before it tests the game against the
rule; nothing yet had tested the rule against the map.

**Built.** Two checks, and they are deliberately the two *halves* rather than
two views of one half.

`every-plant-spot-in-a-site-room-answers-to-the-defuse-rule` enumerates every
place inside a site room a Shade could leave a charge — the room floors on a
2m grid, the climbable tops, the vent interiors — and drives a real hold at
each, asserting the game's answer is the rule's answer. **373 spots: 344 floor,
21 climbable tops, 8 vent interiors.** 369 committed, each landing within 5cm
of where the body stood (a charge that drifted to a site centre would defeat
the whole amendment quietly); 4 refused with no progress. It carries a guard
against its own circularity: if every spot answers the same way it fails
outright, because a census where nothing is refused proves something about the
map and nothing about the rule.

`every-legal-plant-has-a-warden-who-can-reach-it` is the half that is not
circular. For each of the 369 it names the cell the defuse would happen from,
asserts that cell is ground the flood actually reached, and asserts the AI's
waypoint graph connects a Warden spawn to it. Then, for one spot per room, it
plants for real, hands the AI the charge the way a plant does, and watches:
**A:vent 9.6s, B:top 4.0s, C:top 0.7s, 3 of 3 arrived and began defusing.**

`spotOffTheRing()` now also requires `canDefuseAt`. It changes nothing today —
which is the point. It is there so a room reshaped by B4 or B5 cannot quietly
break every check in the file for a reason that has nothing to do with what
they test.

**Verified.** Full suite ****109 passed / 2 failed, twice, identical** (runs of 176s and 354s)**; `red` and `flaky` empty; console
errors 0; census unchanged at 12 of 65.

Both checks were falsified deliberately, and they fail differently, which is
the whole design. Disable the gate and only the first goes red, naming all four
refused spots. Make `canDefuseAt()` return true unconditionally and the first
goes red on its own anti-circularity guard — *"all 373 plant spots are legal,
so nothing here exercises the gate"* — while the second goes red naming the
same four as *"legal but no cell of Warden ground is within the defuse reach"*.
A rule that lies is invisible to the first check by construction and caught by
the second.

**Found — every duct in a site room is a legal plant, and that is not a bug.**
Zero of the 8 vent interiors are refused. HANDOFF.md has said since A1 that the
rule "excludes the climbs, the vents and the ledges"; it excludes 3 of 21
climbs and none of the vents. The reason is arithmetic: `vent-low-north` and
`vent-low-south` run at y=2.3, `DEFUSE_REACH.dy` is 2.5, so a Warden standing
on the floor beneath a duct is inside the vertical reach and within arm's
length horizontally of a charge in it. And it is not theoretical — the sample
above sent the AI at a charge inside `vent-low-north` and it walked over and
started defusing it in 9.6 seconds, standing underneath and reaching up.

So D5 is being kept exactly as written. Whether "the Warden must always be able
to defuse" should mean *reaching 2.3m up into a duct* is a different question,
and it is the one A6 was queued to ask about a number. **Raised as D20,
blocking, with the measurements**, and A6 is marked blocked on it: A6 has
nothing left in it that is not that question.

**Found — a straight line is not the same as a walk.** The first version of the
second check asserted that the last, unpathed leg from the AI's final waypoint
to the defuse cell stayed on Warden ground the whole way. It failed on five
ordinary floor spots in room A. It was wrong, not the map: the Warden's solver
slides along walls and the stuck-detector repaths, so a straight line crossing
a crate is not a cell that cannot be reached. Replaced with driving the AI,
which is the only thing that actually answers it. The leg length is now
*reported* rather than asserted — **worst 14.9m** — because how far the AI
freewheels on the solver alone is worth watching even though it is not a
failure. Queued as **A8**.

**Found — one floor cell of site C's room is unplantable.** The upper deck at
(21, 17): clear floor, inside the room, and no Warden ground within reach. It
is a correct refusal, and it is the deck B4 is already rebuilding; noted on
B4 so the rebuild closes it rather than discovering it.

**Split.** `tests/objective.js` had reached 1,382 lines, well past the ~600
guidance, and it had been over since A3. Now four files, each under 600:
`plantspots.js` (where a charge can go — the helpers all four use),
`plantrule.js` (A2, A3, A4: the gate and its tell), `plantcensus.js` (A5's two
checks), and `objective.js` (round flow, 575). Registered in that order in
`tests/index.js`.

**Left.** A6 is blocked on D20. A7 next: draw the Warden's reachable ground.
It is now the only thing in Block A that nobody can look at — 25,177 cells, and
this session proved four of them matter enough to refuse a plant.

## A6 — nothing inside anything (2026-09-10)

**Why.** A5 put the duct finding in front of Josh as D20 and he answered
within the hour, and not with any of the three options offered: *"can't plant
'inside' things. only on top."* So the vertical reach was never the question.
A crate top is fine; a duct is not; and the difference between them is not
height, it is whether there is a lid.

**Built.** `PLANT_HEADROOM` in `systems/objective.js` — a 0.15m column,
`warden.standHeight` tall, probed above the charge — and `hasHeadroomAt()`,
which asks the collision world whether it is clear. `canPlantAt()` is now the
whole rule, D5 and D20 together: `canDefuseAt(at) && hasHeadroomAt(at)`. The
gate in `_stepPlant()` asks that instead. Mechanical, no tags: a duct fails by
its roof, a crate top or a floor passes by the air above it, and the redesign's
binding rule — the map obeys tests and carries no names — holds. `DEFUSE_REACH.dy`
stays 2.5 and its comment now records why: the census measured that the
vertical reach refuses nothing on its own, and shrinking it would have taken
the crate tops with the ducts.

Spec Section 20.3 written: the plant zone as it now is, with what it excludes
on the first map and why.

**Verified.** New check `a-charge-cannot-be-planted-inside-anything`. All 8
duct interiors inside site rooms refused, and refused *by the lid*: a 50m
defuse reach does not open one; dropping `PLANT_HEADROOM.height` to 0.53m does,
and the plant then commits; restoring it refuses again. All 18 reachable tops
have open air above and stay legal. The census re-counts to **373 spots, 361
legal, 12 refused: 1 floor, 3 tops, 8 ducts (8 by headroom)**, and its AI
sample now walks to A:top instead of A:vent because the vent is no longer a
legal plant to sample. `spotOffTheRing()` and every `legal` flag in
`tests/plantspots.js` read `canPlantAt` now, and A3's reach-opening experiment
picks a perch the *reach* refuses, since no reach opens a lid.

Full suite **110 passed / 2 failed, twice, identical** (200s, 347s); exit 0;
census unchanged at 12 of 65.

**Left.** A7 and A8. Block A is otherwise closed.

## A7 — the Warden's ground, drawn (2026-09-10)

**Why.** 25,177 cells decide whether a plant is legal and, until now, nobody
could look at one. A wrong cell was invisible until a plant was refused in play
for no apparent reason — and A5 just proved four of them refuse plants on the
first map, one of them a plain deck floor.

**Built.** `src/groundview.js`: `WardenGroundView`, one merged mesh of flat
quads, one per (column, floor) at the floor's own height, plus a marker quad
that follows the human's actor onto the reachable floor nearest its feet and
hides when it is somewhere the Warden could never stand. Hidden it costs no draw
call; shown it costs four (two meshes, two passes). Toggled from the F4 panel
with **N** (`DEBUG_KEYS.test.toggleWardenGround`), through the same
key → command → emitter → handler chain as every other test command, and
listed on the panel. Off by default, and `initMatch()` hides it: a debugging
view of map data never survives into a new match. It is not a marking — the
redesign's rule is that the world carries none — so it lives with the F3/F4
tools and nowhere near the HUD.

**Verified.** Two checks in `tests/groundview.js`.
`the-warden-ground-overlay-is-off-by-default`: hidden after init, in the scene,
25,177 quads in one mesh, draw calls 306 hidden / 310 shown / 306 hidden again,
off after `initMatch`. `the-warden-ground-overlay-draws-the-set-on-the-floor`:
F4 then N through the real key path changes **71%** of a floor-facing frame at
site A by **+128 per channel**, a second N hides it back to 0.0% difference,
and the marker sits under the Shade on the floor and is gone on
`server-rack-0`.

Full suite ****112 passed / 2 failed, twice, identical****; exit 0.

**Found — `renderFrame` and a lens do not mix.** The first version pressed the
keys with `h.renderFrame()`, and the frame re-parents the camera to the actor's
rig every time (documented; it is what makes the finisher orbit visible). The
lens was pointed at the floor no longer, every pixel differed, and the check
read a 114-level *darkening*. The keys now go through `debugTools.pollKeys()` —
the first thing the frame does, and the same real path — while the lens is up,
and the marker half runs after `lens.restore()` through the real frame. Written
into `tests/pixels.js`'s neighbourhood as a comment on the helper.

**Left.** A8, the last job in Block A.

## A8 — the last leg, planned; and the staircase A1 could not climb (2026-09-10)

**Why.** The AI paths over twenty waypoints and then walked straight from its
last node to the goal with only the solver to steer it. A5 measured that leg at
up to 14.9m across the legal plants. It worked on this map; on a map with more
in it, it is a DEFEND stall. The queue offered two answers — twenty hand-placed
waypoints, or planning the leg over the ground A1 built — and the second is the
one that also works on the container yard.

**Built.** `WardenGround` now knows how it connects, not only where it is.
The flood records every edge it proves — a step the Warden can make with a
standing body fitting the gap — as a bitmask per cell, both ways.
`route(from, to, maxLeg, snap)` walks those edges breadth-first and pulls the
result straight, keeping a point only where a standing body cannot walk the
line: the pull asks `walkable()`, the same quarter-cell rest-and-step the flood
uses, of the collision world, so a crate corner bends the line at a cell
centre rather than being cut. No segment is longer than `ai.maxUnpathedLeg`
(6m, `config.js`). `standAt()` names the ground under a point, snapping a
charge on a crate top to the nearest cell within the defuse reach.

`ai._pathTo()` uses it for the last leg, and chooses the goal waypoint by
where the Warden will *stand* rather than where the charge is.
`map.nearestWaypoint()` prefers a node on its own floor. `DEFUSE_REACH.dy`
now reads `round.defuseReachY` from config so the AI can read the same number
for its snap without importing objective.js across the layer.

**Found — A1's ground was two islands.** Treads rise 0.3m every 0.4m and the
grid is 0.5m, so two adjacent cell centres can sit two risers apart: more than
a step, and the flood refused the edge. No edge climbed either staircase. The
deck was ground only because two of the four Warden spawns are on it, and A1's
check — every spawn, waypoint and site is *on* the ground — could not see it,
because every one of them was on some island. The A1 lesson, a third time: a
coverage check cannot see a connectivity fault. Fixed in the flood: an edge
whose rise is more than a step and less than two is walked in quarter-cell
sub-steps, resting on the highest tread under the body at each, and proven if
the walk arrives. Cells went from 25,177 to 25,299 edge-bearing (the treads). The A1 check
now also walks the edges from spawn 0 and requires every cell; with the fix
reverted it reads *"reaches 17583 of 25177 cells; the rest is an island"*.

**Found — the AI was climbing to the deck to reach a charge on the floor.**
`nearestWaypoint` was nearest in three dimensions, so a charge 2.3m up on a
vent lip was nearer to `stair-hall-head` (6m up, 7.8m away) than to the floor
node beside it (9.8m). With the last leg planned honestly the Warden climbed
the staircase and walked back down it: a 55m route, 17.9s. Before A8 the same
choice took 9.3s, because the straight leg went off the deck edge and the
Warden *fell* to the charge. It takes 7.0s now.

**Found — a snapped route stalled DEFEND at 2.2m.** The first version ended
the tail at the cell beside the crate; the Warden arrived, was outside
`defendHoldRadius`, re-pathed to the same cell, arrived again. The tail ends
at the charge itself now, as it always did: the short walk at the crate the
solver stops it at.

**Verified.** New check `the-last-leg-to-every-legal-plant-is-planned-and-short`
in `tests/plantcensus.js`: all 361 legal plants routed from their nearest
waypoint; longest segment **6.0m** against the 6m bound where the straight leg
was up to 16.3m; every segment walked by an independent raycast rest-and-step
— five rays, centre and footprint corners, because the swept AABB steps up
onto a tread corner the centre ray misses — with a standing capsule fitting at
every sample; every route ending inside the defuse reach; and the AI's own
`_pathTo` producing a tail of short segments. Restoring the straight leg turns
it red with *"a 9.6m segment after its last waypoint"*. The A5 sample still
arrives: A:top 7.0s, B:top 4.1s, C:top 0.7s.

Full suite ****113 passed / 2 failed, twice, identical****; census unchanged at 12 of 65; plant census unchanged
at 373 / 361 / 12.

**Left.** Block A is closed. Three files over the 600 guidance were touched
with small changes and not split — `ai.js` (788), `mapkit.js`, `config.js` —
and are listed on F3 with main.js, for the same reason: the split is its own
job, not a side effect of a one-line change.

## B1 — tap Space grabs, hold Space climbs (2026-09-10)

Josh, playing: *"Looks like hanging isnt working."* It was not built: phase 3
of the redesign removed hang-as-failed-mantle and B1 was three jobs down the
queue. Offered three inputs; he chose a fourth: *"tapping space grabs first
always. holding space climbs."* D21.

**Built.** A `GRAB` traversal state. Every mantle-height climb — ground or air
— now goes through `_climbLedge()`: vault height goes straight over; mantle
height commits a grab, a 0.18s move to hanging position below the lip that
ends in `HANG`. `_stepHang()` then reads Space *before* the settle grace and
as a held key: still down means hold, and a hold pulls straight up, so the
climb reads as grab-then-over in one motion (0.18 + 0.55s against the old
0.62s mantle). Released means hang: Space later pulls up, crouch drops, A/D
shimmy. A grab with no room below the lip falls back to the direct mantle, so
a low ledge is never unclimbable for being unhangable. `hangGrabDuration` is
the tap window; there is no hold timer and no delay on the climb.

**Verified.** New check `tap-space-grabs-the-ledge-hold-space-climbs-it`
drives the real keys at `stack-hall-mid` (2.0m): tap → hangs at feet
top−1.35, stays put for a second, Space pulls up; tap → crouch drops to the
floor; hold → over, through a grab; the same split mid-fall; and a tap at a
vault-height crate goes straight over with no grab. Against the pre-change
controller it is red with the old behaviour in its own words ("a tap on the
ground went over stack-hall-mid instead of hanging"). The D17 check now holds
Space for its climbs. Full suite 114 passed / 2 failed, twice, identical,
zero console errors.

**Found.** The census taps Space every 22 steps, so under D21 every mantle
spent a hang beat waiting for the next tap and one face missed the 90-step
budget; `attemptClimb()` now holds Space, which is what getting on top means.
After that, one surface still moved from "straight off the floor" to "needs a
leg up": `vent-low-south-roof`. Measured in real Chrome, step by step: from
the vent's end the vent *floor* lip (2.3m) sits directly below the roof lip
and is within standing reach, so the press grabs it — the first thing in
reach, which is the rule. Old code tried to mantle that lip, was blocked by
the duct's 1.15m headroom, and fell through to a plain jump that happened to
reach the roof; that path was an accident, not a design. The roof still
climbs from inside the duct. The twelve failures are unchanged. A blocked
pull-up is silent today; added to B2's scope.

**Recorded.** Spec 20.4; D21; README controls and climbing; HANDOFF.

## D22 — no hang below 1.4 Shade-heights (2026-09-10, same evening)

Josh, minutes after trying D21: *"shouldnt be able to hang on anything shorter
than 1.4x the height of the shade from the vault position."* With D21 alone a
2m crate offered a hang with your feet half a metre off the floor.

**Built.** `hangMinHeightRatio: 1.4` (2.59m at a 1.85m Shade). `_climbLedge()`
grabs only when `ledge.topY - _launchY` clears it — the surface the climb
started on, not wherever the body is in its jump, so the same ledge answers the
same way from the ground and from the apex. Below the line a mantle-height
ledge goes straight over on tap or hold, as it did before 20.4. Since standing
reach is 2.6m, a hang is in practice a ledge you had to jump for.

**Verified.** `tap-space-grabs-the-ledge-hold-space-climbs-it` now has three
tiers: above the line (`hall-container`, 3.0m) tap hangs at feet 1.65, hold
goes over through a grab, Space pulls up, crouch drops, the same mid-fall;
below it (`stack-hall-mid`, 2.3m) and at vault height (`stack-hall-low`, 1.0m)
a tap goes over with no grab. Red on the D21-only controller for exactly the
new rule ("a tap at stack-hall-mid (2.30m) grabbed — below 2.59m nothing
should"); the same three checks pass in real Chrome through the pane. Full suite 114 passed / 2 failed, twice, identical, zero console
errors; the census unchanged at 12 of 65.

**Found.** The D22 line gives the vent-roof floor path back: the vent-floor
lip (2.3m) is below it, so the press mantles, is blocked by the duct, and the
jump falls through to the roof as before — "needs a leg up" is 20 again. And
the check's first pick of a hang ledge was hall-container's *south* face, where
`gantry-hall` (3.3–4.0m) sits over the lip; the hanging capsule tops out 0.5m
above the lip (`hangDrop` 1.35 against a 1.85m body), so the grab could not fit
and the controller went over. Right answer; the check now asks for a face with
room to hang. Whether the hanging body should sit lower is noted in B8.

## F1 — the cascade was a lost GPU (2026-09-11)

The gate's one recorded lie: an A2 verify run with *eight* pixel checks flaky
at once — rim light, lit pools, the dim meter, the outline, smoke/flash, the
alarm fixture, the death camera and the 0×size viewport — unreproducible in
four later full runs. The suspect on file was the viewport check restoring
the canvas late.

**Found.** It was not the viewport check; it was the WebGL context. Staging a
loss with `WEBGL_lose_context` under the ten checks nearest the incident fails
*exactly* the eight named and nothing else, each in the words the incident
would have used ("the Shade covered only 0 pixels", "the hall renders at 0.0
and the vault at 0.0", "the drawing buffer collapsed to 0x0") — and reports a
0×0 drawing buffer against a 1280×720 canvas, which is the very observation
the pane incident was diagnosed from. The mechanism: on a loaded PC Chrome's
watchdog kills a starved SwiftShader GPU process and hands every context
back a moment later; in the window every draw is a no-op and every
`readPixels` reads black. three.js prevents the default so the restore
happens, rebuilds its state when it does, and tells nobody — it logs via
`console.log`, which the runner does not collect. So the suite saw eight
wrong answers, no error, and a clean re-run.

**Built.** `main.js` listens for `webglcontextlost` / `webglcontextrestored`
on the canvas, counts into `debugState.contextLosses` (an F3 row), and emits
`view:contextlost` / `view:contextrestored`. The suite runner moved out of
`ui/debug.js` (601 lines after the change) into `ui/autosuite.js`; `DebugTools`
composes it and forwards, so `h.debugTools.runAutoTests()` and `_autoTests`
are unchanged. `AutoSuite.runChecks()` tags any check whose run overlapped a
lost context (`contextLost`), waits for the `webglcontextrestored` event —
bounded by `CONFIG.debug.contextRestoreFrames` animation frames, no
`setTimeout` — and re-runs those checks once, the second answer standing
(`rerun`). Once only: a check that loses the context every time has a defect
of its own. `runAutoTests()` returns `contextLosses`; `scripts/suite.mjs`
carries `contextLosses` and `rerun` per run into the JSON and prints `GL
CONTEXT LOST Nx during run N; re-ran after restore: ...` in the summary, so a
green run that needed the tiebreak is never silent. A check registered with
`losesContext: true` stages a loss on purpose; its loss is counted as
`staged`, not as the machine's, and it is not re-run for it.

**Verified.** New check `a-lost-gl-context-is-caught-and-the-check-re-run`
stages a real loss through the real runner: an inline probe loses the context
on its first run, asks for it back one task later (a `MessageChannel` hop —
Chrome only honours a restore requested after the lost event has finished
dispatching, and an `await` on the event resumes inside it), renders and
reads back. The probe must read black, be tagged, be re-run after the
restore, and read a lit frame the second time; the counter must go up by one;
the emitter must see lost then restored; the context must be usable after.
With the tagging and re-run removed by `--pre` it is red in its own words
("the probe ran 1 time, not twice; the probe was not tagged contextLost; ...
the context is still lost afterwards") and the runner's summary shows the
loss as the machine's. Full suite **115 passed / 2 failed, twice, identical**,
flaky empty, zero console errors, zero context losses, zero re-runs. The two
runs took 293s and 365s against the gate's 180s — the machine was busy — and
nothing wavered.

**Also found, queued.** The rAF loop runs the real game *under* the suite in
headless Chrome: `document.hidden` is false there, 9 frames drew in 3 idle
seconds, 7 frames ran inside the audio check (the only one that yields), and
the 45s cooldown between runs is ~135 frames of the AI hunting an idle Shade.
Every check that starts from `initMatch` is immune; anything else inherits a
state that depends on the wall clock. Queued as F4. And F2 confirmed on HEAD
before this change: `hud-reads-the-meter-it-is-shown-beside` is red when run
straight after `the-rim-light-is-really-on-screen`, green in the full order.

**Left.** The suspect on file was wrong and HANDOFF's trap is rewritten.
`ui/debug.js` is 416 lines, `ui/autosuite.js` 242. `main.js` gained 23 lines
and is 1,129 — F3's job.

## F2 — every check starts from the same screen (2026-09-11, same run)

**Found.** The trap as recorded was half the story. `hud.setVisible()` runs
inside the frame from `!menu.open` and `hud.update()` returns early when
hidden, so a check that rendered a frame behind a menu hid the HUD for every
check after it — that part was known. The other half: at boot the menu is
up, and the headless runner's 60 warm frames (and, F4, the live rAF loop)
derive `hud.visible = false` from it. So the *first* HUD read in any subset
was of a DOM nothing had ever drawn. On the commit before this,
`hud-reads-the-meter-it-is-shown-beside` was red straight after
`the-rim-light-is-really-on-screen` — which opens no menu; it just renders
through the lens instead of the frame, so nothing had ever shown the HUD —
and green in the full order only because `pause-stops-the-world` had hidden
the menu and driven a frame first.

**Built.** `harness.resetPresentation()` in `main.js`: menu hidden,
intermission hidden, unpaused, HUD shown — the presentation layer and
nothing else; match state stays each check's business. `AutoSuite._runOne()`
calls it before every check, re-runs included, so an answer cannot depend on
who ran before. `hud.update()` now returns whether it drew, and the HUD
check asks on the first read and says "the HUD is hidden, so nothing here
reads anything" rather than reporting the stale numbers as a wrong meter.

**Verified.** New check
`a-hud-check-answers-the-same-alone-and-after-a-frame-behind-a-menu` drives
the real HUD check through the real runner three times — from the clean
state, after a frame rendered behind the pause menu (asserting first that
the frame did hide the HUD, so the trap is still real), and from the boot
state (main menu up, paused) — and wants one answer, and the menu closed and
the game unpaused when the last run ends. With the runner's reset removed by
`--pre` it is red in its own words: *"after a frame behind a menu: the HUD
is hidden, so nothing here reads anything; from the boot state: ...; the
menu was still open when the last run ended; the game was still paused"*.
The done-when's own pair — `hud-reads` alone, and after
`a-refused-plant-says-so-and-says-nothing-else` — plus rim-light directly
before it, run green as a subset. Full suite **116 passed / 2 failed, twice,
identical**, flaky empty, zero console errors, zero context losses.

**Left.** A4's local fix in the plant-refused check (hide the menu, render a
frame, check `hud.visible`) is now redundant but harmless and stays: it
documents the mechanism at the place it was met. F3 is next: `main.js` is
1,145 lines.

## F3 — the composition root, and everything else past 600, split (2026-09-11, 17:00 run)

**Built.** Eight modules were over the ~600 guidance; none is now, and a
check holds the line. The done-when said "no file in `src/` outside
`config.js`", so it was all eight, not the four the job named.

`main.js`, 1,145 → 597. What stays is what has to: the singletons,
`initMatch`, pause, bootstrap in its construction order, `fixedStep` and
`renderFrame` with the spec's step order untouched. Eleven siblings took the
cohesive blocks: `loop.js` (`FrameLoop`, the rAF scheduler — F4 will want
its `start()`/`stop()`), `timestep.js` (`computeStepPlan`), `matchstate.js`
(`resolveMatchOptions`, `createMatchState`, `bootMatchOptions`, the
`COMPETITIVE`/`FREEROAM` presets the menu now uses too), `view.js` (renderer,
scene, the one camera and its refuse-a-second guard, toon ramp, resize, the
F1 lost-context watch), `cameraowner.js` (`set`/`forget`/`look`/`applyAdsFov`
— whose rig the camera is on and where the mouse goes, which was three
separate blocks of `renderFrame` about one thing), `intents.js` (pure
readers: `readShadeIntent(input, intent)`), `loadout.js` (the gadget slots),
`wiring.js` (the emitter listeners between systems), `hudstate.js` (the bag
`hud.update()` takes), `debugfields.js` (the F3 overlay's keys), and
`harness.js` (`createHarness(live, loop)`: `main.js` passes one getter per
live object and the loop functions themselves, so `h.shade` is still live
and `h.renderFrame` is still the real frame). Dead code went with it: the
`APPROACHING`/`S_WALK` constants and four unused imports had survived from a
test file that moved out long ago. God mode became `debugState.godMode`,
toggled in `testcommands.js` and read by `wiring.js`, rather than a `let` in
the root; `cycleTimeScale` moved to `testcommands.js` with it, built from the
harness. `wireTestCommands({ harness })` takes nothing else now.

The class-shaped files split as **prototype mixins**: the sibling exports an
object of methods, the class file ends `Object.assign(X.prototype, ...)`.
Same `this`, same field names, so `shade._probeLedge`, `ai._pathTo`,
`ai._route`, `map._supportCandidates` — all called by checks — still exist.
Constants both halves need moved to a shared `*state.js` (`SHADE_STATE`,
`AI_STATE`, `angleDelta`, `DEFUSE_SNAP`) so neither imports the class file.
`entities/agent.js` 1,051 → 527 + `agenttraversal.js` (every climb, 399) +
`agentvisual.js` (165). `systems/ai.js` 788 → 498 + `aiperception.js` +
`ainav.js` (route, steering, `_checkStuck`). `mapkit.js` 821 → 380 +
`mapgen.js` (walls with openings, floor plates, staircases, vent runs — the
`addSolid()` emitters) + `mapclimb.js` (`deriveClimbableSurfaces(collision,
ledges)`, `supportCandidates` — plain functions like `maprooms.js`, wrapped
by `GameMap` so `map._supportCandidates(box)` survives; **B3's fix lands
there**). `map.js` 810 → 537 + `mapdata.js` (`placeSites`/`placeSpawns`/
`placeLights`/`placeWaypoints`, called after the rooms because a site finds
its room by containment) + `mapvalidate.js` (and an empty `for` loop left
over from the markings, deleted). `physics.js` 735 → 600 + `collisionbox.js`
(`CollisionBox`, `raySlab`, `EPSILON`; re-exported). `systems/objective.js`
646 → 536 + `plantrule.js` (`DEFUSE_REACH`, `PLANT_HEADROOM`,
`withinDefuseReach`, `canDefuseAt(map, at)`, `hasHeadroomAt`, `canPlantAt`;
re-exported, and wrapped as the same three methods, so every check's import
and every `objective.canPlantAt()` is unchanged). `systems/gadgets.js` 633 →
506 + `gadgeteffects.js` (`EffectRegistry`, `Projectile`).

`config.js` (1,249) is exempt and PLAN.md now says so: it is a table, read
by key. `README.md`'s architecture block names the root's siblings.

**Verified.** New check `no-source-file-outside-config-is-over-600-lines`
(tests/donedef.js) lists every module the game actually loaded from the same
Resource Timing entries the network check reads — no guessed import graph —
fetches each and counts lines; `config.js` is exempt by name and must be
present. With the guidance lowered to 500 it is red in its own words
(*"over 500 lines: src/physics.js (600), src/main.js (597),
src/mapground.js (577), ..."*), so it sees the whole tree, tests included.
Full suite **117 passed / 2 failed, twice, identical** (332s and 390s), flaky
empty, zero console errors, zero context losses, zero re-runs; the census
reads the same *12 of 65, upper deck 5, loading-bay 3, turbine-hall 2,
server-vault 2, 20 need a leg up* it read before the split, which is the
"suite is identical" the done-when asked for.

**Found.** Two boot failures, both a moved method using a module constant
that did not move (`P`, then `THREE`, in `mapgen.js`); `node --check` is
blind to it. The runner reported each as a bare 60s `waitForFunction`
timeout, so it now prints the page's first errors under `suite: crashed:`
(`scripts/suite.mjs`, `bootErrors`) — a tool change, not a check change.
And the working copy is CRLF under `core.autocrlf=true` while the repo is
LF: a byte-exact Python match against `\r\n` content fails silently, and a
file ending `}\r\n\r\n` has one more line than its last brace. Both are in
HANDOFF's traps now.

**Left.** `main.js` at 597 and `physics.js` at 600 have no headroom; the
next job that touches either splits rather than adds. F4 is next and is
easier for this: the loop is an object.

## F4 — the game does not play itself under the suite (2026-09-11, same run)

**Built.** The rAF scheduler F3 had just made an object, `FrameLoop`, is on
the harness as `h.loop`. `AutoSuite.runChecks()` — the one path every check
takes, the F1 tiebreak's direct callers included — stops it if it was
running and puts it back in a `finally`, so a throwing check cannot leave
the game frozen. `initMatch` no longer starts the loop: every check calls
`initMatch`, and a start there would have put the live game straight back
under the suite; boot starts it once, after the first `initMatch`. The
headless runner stops the loop the moment the harness appears — the 45s
cooldown between runs was ~135 frames of the AI hunting an idle Shade, and
that is outside `runAutoTests` — and reports `loopFrames` per run from
`FrameLoop.frames`; any non-zero fails the run and prints `LOOP RAN N
frame(s)`. `h.nextFrame()` is unchanged in mechanism and now says what it
is: the browser's next animation frame, resolving whether or not the game
loop runs, drawing nothing. `h.renderFrame()` counts itself in
`debugState.harnessFrames`, so a frame a check drove is distinguishable
from one the loop ran. Nothing was fixed by adding `initMatch` to a check.

**Verified.** New check `the-loop-does-not-run-the-game-under-the-suite`
(tests/engine.js). It bails with a reason where `document.hidden` (no
frames fire there — the browser pane), then: asserts the loop is off while
it, a check, runs; proves the instrument with a second `FrameLoop` of its
own that ticks on two awaited animation frames; starts the game's loop and
calls the real `suite.runChecks()` with a probe that awaits two frames
inside and reads `loop.running` and `clock.frame` — wants stopped and 0 —
then wants the loop running again after and stops it, all synchronously
around the call so `loop.frames` must not have moved; then `initMatch` and
wants the loop still stopped. With the suite's stop disabled it is red in
its own words: *"the loop was still running inside runChecks; clock.frame
advanced 2 under runChecks with no check driving it; the loop drove 2
frame(s) around the probe"*. The runner's `loopFrames` read 0 on every
run. Full suite **118 passed / 2 failed, twice, identical** (305s and 367s),
flaky empty, zero console errors, zero context losses, `loopFrames` 0 on
both runs; the census unchanged at 12 of 65.

**Found.** The done-when's "clock.frame is the same before and after minus
what checks drove themselves" is measured two ways now: the check, inside;
the runner, over the whole run. Both must read zero.

**Left.** Block F is closed. B2 is next: the bump-and-scuff, an S.

## B2 — the bump-and-scuff: a failed climb is never silent (2026-09-11, same run)

**Built.** Two silent cases. A press of Space that carried the hands onto a
face too tall for the reach — the site fence at 4.5m against a 3.8m jump
reach, any shell wall — did nothing at all; the body slid down the face as
if the key had not been pressed. And since D21, a hold from a hang whose
pull-up was blocked did nothing either. `_probeLedge()` now remembers the
highest solid face its hand sweep met, climbable or not, as
`Shade._faceAhead` (any solid face taller than `reach.stepOver`; the sweep
rises, so the last written is the highest). In `_stepAir()`, when the
armed mantle finds nothing to get over and `_faceAhead` is set and the body
is heading into it, `_scuff(face, true)`: velocity set straight back off
the face at `scuffBumpSpeed` (1.6 m/s), any rise zeroed, `_scuffTimer` set
to `scuffPoseTime` (0.35s), `shade:scuff` emitted with where the hands hit,
the rise, the reach and the box's tag; the arm is spent, so one press is
one tell and the next press re-arms. `_stepHang()`'s blocked branch calls
`_scuff(ledge, false)` — pose and sound, no push — on the press edge and on
the first hang step when Space was held through the grab, never repeating
while the key stays down. agentvisual.js draws the pose: both arms thrown
straight up, dropping over the timer. audio.js subscribes `shade:scuff` and
plays `scuff`: a 90ms noise burst low-passed at 650Hz (`audio.scuff`),
added to the Section 14 render table in soak.js. Nothing is added to the
noise field: whether the Warden hears a failed climb is a rule, and it is
D23, with B2b queued behind it. How it looks and sounds is D24, provisional.

**Verified.** New check `a-climb-beyond-reach-bumps-poses-and-sounds`
(tests/scuff.js; movement.js exports `driveAtLedge` and `findGroundLedge`
for it). It finds a ground-level solid face at least `reach + 0.3` tall
whose approach the controller's own probe reports as a face and no ledge
(it picks `site-fence`), then drives through the input codes: a tap of
Space heading in scuffs exactly once and climbs nothing; driving frame by
frame, on the scuff step the velocity along the face normal is negative,
the body is not rising, the pose timer is set and the left arm reads below
−1.5 rad after `updateVisual`; a walk-off into the same face with nothing
pressed scuffs zero times (D17). For the hang: it hangs from a real ledge,
stages a lid of real collision 0.6m above the lip (room for the hanging
body, whose top is 0.5m up; none for the crouched one a pull-up needs),
presses Space — one scuff, still hanging, pose set, event says `hanging` —
holds Space half a second with no further scuff, removes the lid and presses
again, and wants the body on top: the lid was the block. Then
`renderOffline('scuff', 0.4)`: peak in (0.001, 1.0], audible for under
0.3s. With `_scuff()` made a no-op it is red in its own words: *"one press
into site-fence scuffed 0 times, want exactly 1; no shade:scuff event
reached the emitter; ...; a blocked pull-up scuffed 0 times, want 1; the
hang scuff set no pose"*. Full suite **119 passed / 2 failed, twice, identical** (314s and 385s),
flaky empty, zero console errors, zero context losses, `loopFrames` 0;
the census unchanged at 12 of 65. Spec 20.5 appended.

**Found, and fixed on the way.** The first verify came back with the known
flaky, `every-sound-renders-to-samples-that-match-section-14` (*"the
Warden's footstep peaks at 0.049 against the Shade's 0.050"*, then green).
It was never a threshold problem: `renderOffline()` filled its noise buffer
from `Math.random`, so every render was different samples and a comparison
of two peaks was a comparison of two draws. The render now seeds a private
`mulberry32` (`RENDER_NOISE_SEED`, not the game's stream) and a rendered
sound is the same samples every time; the trap in HANDOFF is closed. Then a
three-run subset with a 5s cooldown showed ten console errors from the
runtime assertion `effects-drain-when-idle`: *"100 smoke sprites still
alive 12.5s after the last gadget expired"*. `audio-voices-are-capped-and-
released` emits a synthetic `gadget:detonate` to prove the smoke sound has
a trigger; effects heard the same event and spawned a cloud with no gadget
behind it, and once the assertion's idle window had passed it rightly
called that a leak. Before F4 the live loop usually stepped the leftovers
away before anyone looked. The check resets effects after its triggers now:
it wanted the voices, not the cloud. Also: `CONFIG` is deep-frozen, so the
A3 trick of moving a constant to stage a condition does not work on
`shade.*`; staging geometry in the collision world (`addBox` / splice /
`build()`) does, and is the honest version of "a lip with a lid on it".

**Left.** B2b (the scuff as a noise event) waits on D23. B3 is next — the
`supportCandidates()` fix, now in `mapclimb.js` — and it is the one that
starts moving the census.

## B3 — a support is somewhere you can stand and reach the face (2026-09-12, 02:00 run)

**Built.** `supportCandidates()` in `mapclimb.js` decided "what is below"
a surface by footprint: any wide solid whose footprint came within
`vaultReach` of the box's, and was lower, was a support. That named nine
supports a body could not climb from — `gantry-hall` for `deck-10`, touching
it at one corner under a 5.3m lip; `hall-container` for the duct roof beside
it diagonally; the server racks for `roof-4` and `roof-5`, the roof slabs
three metres of ceiling above them; `fire-escape-4` for `roof-1`, which it
touches only at a corner — and the census, which stood exactly where the
rule said, reported "nothing in reach" of surfaces the rule called
climbable. The job as queued said "overlap the footprint"; a strict overlap
would have orphaned `gantry-hall` (climbed from the container that touches
it) and `gantry-bay` (from a stack 0.2m away) and needed the map reshaped
around a rule that is still not what the body does. What the body does is
in `_probeLedge()`: stand in front of a face, sweep the hands up from the
feet, stop at a ceiling, climb the face they meet. So that is the rule now.
`supportApproaches(collision, box)`: for every wide solid lower than the
box's top by at least `stepOver`, and every face of the box, the rectangle
where a body's centre can be — footprint fully on the support, a body
radius clear of the box, no further out than the probe reaches — sampled at
its quarter points; at each, the body fits (crouched at least) and the
controller's own hand sweep (`PROBE_STEP` 0.12, hand-half 0.05, ray of
`vaultReach + radius`, stop where the hand is not in open air, keep sweeping
past anything that is not this box) meets this box's face. One entry per
(support, face) with the spot it succeeded at. `deriveClimbableSurfaces()`
takes the tallest approach in reach; `supportCandidates()` is the heights,
still with the ground plane, so every caller reads as before;
`supportHeightBelow()` is the tallest, ground if none. `GameMap` exposes
`_supportApproaches()`. The derivation costs 60ms at boot for 214 boxes.

**Verified.** The census stands at the rule's spots as well as its own
(`rule:<tag>` in its tried-set) — the 38m deck edges it sampled at quarter
points never stood on the 2m landings the rule derived them from — and
`the-climb-rule-has-no-exceptions` recomputes "should climb" from the same
approaches, so a box the rule names with nothing in reach is a disagreement
again. Result: **the census is green** — *"56 climbable surfaces, 208
approaches from every surface the rule derives them from, 173 climbs; the
controller got onto all 56 reachable surfaces (0 enclosed); 20 need a leg
up first"*. Nine surfaces stopped deriving as climbable, each for a reason
the geometry gives: `deck-1` (the shell wall between it and the fire
escape), `deck-10/12/14/16/20` (deck slabs whose only exposed faces sit
above the 1.3m of headroom on the gantry under a lip — you enter the deck
by its lip, and every lip still derives and still climbs), `roof-1` (a
corner), `roof-4`, `roof-5` (the ceiling). `roof-0` stays, honestly: a 3.4m
jump from the third fire-escape landing, and the controller makes it. Every
designed route keeps its move: the stacks vault then mantle, the gantries
vault from the container and mantle from the stack, the fire escape
alternates 2.0 and 1.7. A dense re-derivation (every 0.25m along each
approach, three depths, scratch only) agrees on all 56 verdicts, so the
three samples are not hiding a surface on this map. Full suite **120
passed / 1 failed (the headless-skipped frame budget), twice, identical**
(329s and 389s), flaky empty, zero console errors, zero context losses,
`loopFrames` 0; `unexpectedGreen` empty because the Deliberately-red line
came out in the same commit. `mapLedges` on the F3 overlay reads 56.

**Found.** The queue expected B3 to leave three deck slabs red for B4.
They are not red; they are not climbable, and were never climbable from
where the old rule said. What B4 has left is the plant cell at (21, 17) and
the ergonomics of the overhanging lips — a crouched approach the census
makes and a player may not find — which is legibility, not the census.
Two coplanar faces tie in `raycast()` (whichever the grid lists first), so
`vent-up-vault-floor` derives as climbable through the lip that shares its
face plane; same top height, same climb, harmless. B4 re-scoped in
QUEUE.md; the Deliberately-red list is empty for the first time.

**Left.** B2b still waits on D23. B4 as re-scoped, then B5.

## B4 — the upper deck: an aisle the Warden can walk, a lip you walk up to (2026-09-12, 17:00 run)

**Built.** Two pieces of geometry in `map.js`, no rule touched. (1) The
server racks in site C's vault stood in two pairs 0.7m and 1.1m apart. The
Shade is 0.68m across and the Warden 0.84m on a 0.5m ground grid, so each
aisle was a slot the Shade could stand in that no `wardenGround` cell ever
reached, and `canPlantAt()` refused every spot deeper in it than the 2.0m
defuse reach — correctly. A5 counted one such floor cell on its 2m grid,
the deck at (21, 17); the same rule asked every 0.1m refused 150, in both
aisles. Both aisles are `RACK_AISLE` = 1.5m now (racks at x 10.6, 13.2,
19.4, 22.0), each carries a column of ground cells at x 12.25 and 21.25,
and every clear floor spot in all three site rooms — 132,870 of them at
0.1m — is legal. `server-rack-0`'s top is legal too as a side effect (the
aisle is 1.1m from its centre), so the refused tops are `hall-container`
and `gantry-hall` only. (2) `gantry-bay` sat wholly under the deck, 1.65m
of slab over its west 1.0m and the 1.3m of lip over the rest, so the only
approach the rule named for `lip-bay` was crouched at (17.9, −4.1) with the
hands up into the underside — the census made it, a player would not. The
bay void is now the gantry's width plus a body (x 17.4..21.4), the gantry
stands inside it open to the roof (17.4..20.6), and the lip is the void's
east edge (21.4..22.6); the rule names a standing approach at (20.1, −2.9).
The void, gantry, lip and both stacks moved 1.2m south (z −4.4..−1.4)
because `office-wall-s`'s face is at z=−5.6 and a void flush with it left
the deck between them zero metres wide — see Found. The other four lips
already had a standing approach: the queue's "the lips overhang their
gantries, so the only approach is crouched" was true of the bay alone;
`gantry-hall`'s lip overhangs only its last 0.6m and the rest is in the
hall's full-height void.

**Verified.** Two checks in the new `tests/deck.js`.
`every-deck-lip-is-climbed-from-a-standing-approach`: for every `lip-*`,
some approach `_supportApproaches()` names fits a standing body, and from
that spot the controller — W held, Space held, pressed every 22 steps — gets
on top without ever crouching; *"5 lips, each climbed standing from a spot
the rule names: lip-hall-east from gantry-hall (2.0m); lip-hall-south from
gantry-hall-south (1.7m); lip-bay from gantry-bay (2.0m); lip-vault from
vent-up-vault-floor (1.7m); lip-roof from fire-escape-4 (1.4m)"*.
`no-clear-floor-in-a-site-room-refuses-the-plant`: the census's own floor
spots have zero refusals (B4's done-when as written), and every 0.1m spot
in every site room where the standing capsule fits is `canPlantAt` — 113ms
for 132,870 spots. Both were run against the pre-B4 map first and failed
with the diagnoses above (*"lip-bay: none of its 1 approaches has standing
headroom [gantry-bay (17.9, -4.1)]"*; *"150 of 132870 clear floor spots are
refused"*). The census: **58 climbable, 226 approaches, 191 climbs, all 58
reached, 22 need a leg up** (was 56/208/173/20 — `deck-14` and `deck-16`,
the slabs north and west of the void, now derive from the gantry and the
controller climbs them). Full suite **122 passed / 1 failed (the headless-skipped frame budget), twice, identical (292s and 369s), flaky empty, zero console errors, zero context losses, `loopFrames` 0**.

**Found.** Two things, one of them a real hole in the rule. First, the
opening step of `a-plant-never-starts-where-the-warden-could-not-defuse-it`
(A3) raises `DEFUSE_REACH.dy` until a refused perch is legal and requires
the identical hold then to plant. It picked `server-rack-0`, which opened
only because the corridor floor six metres under the vault came within 2.0m
horizontally at dy 8 — an accident of the map. With the rack legal it
picked `hall-container`, refused for being 1.5m from every face, which no
vertical reach opens, and the check went red saying so. It now picks the
first refused perch with headroom that some dy under 40m opens
(`gantry-hall`, at dy 5, over the hall floor), and fails naming every
refused perch if none does. Not weakened: the same proof, on an input that
can carry it. Second, and queued: the rule's "somewhere to stand once you
are up" is sampled at the box's quarter points, and its "somewhere to climb
from" at the approach — two somewheres on a 38m deck slab. With the void
flush against the office wall, `deck-14` derived as climbable from the
gantry (its top is standable 20m away) and the controller, rightly, would
not mantle into a wall face; the census went red on it. Geometry fixed it
here, but the rule should ask for standing room at the landing, where the
approach puts the body, not anywhere on the box — filed as B4b. Also
noted: the census's floor count is 347 (was 344; the stacks moved off
three cells of its grid) and its tops 22 (was 21).

**Left.** B4b (the landing test) queued under B; B2b still waits on D23;
then B5, whose "needs a leg up" count starts at 22, not 20 — the two new
slabs are the stacked route's own landing, climbed from the gantry that is
the route.

## B4b — the rule's standing room is at the landing (2026-09-12, same run)

**Built.** `deriveClimbableSurfaces()` asked two questions in two places:
"somewhere to climb from" of the approach, and "somewhere to stand once you
are up" of the box's quarter points. On a 38m deck slab the quarter points
can be twenty metres from the face being climbed, and B4 met the case: the
bay void flush against `office-wall-s` made `deck-14` derive as climbable
from the gantry — its top is standable near the corridor — while the only
landing the gantry offered was the wall's face. The controller refused at
`_commitMove()`; the rule did not; the census went red. Now the landing is
part of the approach. `landingSpot(box, face, x, z)` in `mapclimb.js` is
`Shade._ledgeDestination` for the rule: a radius and 0.3m past the point on
the face straight ahead of where the body stands; `landingFits()` asks
whether the crouched capsule is clear there, `mantleClearance` above the
top, which is the capsule `_commitMove()` validates. `supportApproaches()`
drops a spot whose landing does not fit, so every entry it returns has a
foothold, a hand-hold and a landing; the quarter-point loop is gone from
the derivation and `standableTop()` from the check, which recomputes the
landing itself through the exported `landingSpot`. The derivation also
resets `box.climbable` and `reachMove` on every box before deciding, so a
re-derivation over a changed world forgets what it said — and so a
`climbable: true` declared on a box cannot survive it. `hall-container`
had carried one since the phase-3 hang test; it is gone from `map.js`,
`addSolid()` no longer accepts the option, and the derivation is the only
thing that has ever decided it since. The rule's sentence is now: *a
surface is climbable when the body could reach its face from somewhere it
can stand, and fit on top where it lands.*

**Verified.** `a-face-with-nowhere-to-land-is-not-climbable`
(`tests/deck.js`): a lid of real collision 0.3–0.6m over the landing strip
of `lip-bay`'s west face; with the box still flagged climbable from boot,
the controller from the rule's own spot — W held, Space held — does not get
on top (its own gate refuses the capsule); re-derived, the rule names no
approach and the lip does not derive; lid gone, the approach count is what
it was and the same press climbs. Without the `landingFits` line the check
reads *"lip-bay still has 1 approaches with its landing under a lid;
lip-bay still derives as climbable"*. The census is identical to B4's: **58
climbable, 226 approaches, 191 climbs, all reached, 22 need a leg up** —
the same 58 tags — so on this map the landing test changes nothing except
what it would have refused. `the-climb-rule-has-no-exceptions`: *"214
boxes, 58 climbable, 0 disagreements"*. Full suite **123 passed / 1 failed (the headless-skipped frame budget), twice, identical (312s and 373s), flaky empty, zero console errors, zero context losses, `loopFrames` 0**.

**Found.** Nothing new. The staged lid is itself a wide solid 0.6m above
the deck and derives as a vault while it is there; the check re-derives
after removing it, and `h.map.ledges` is rebuilt each time, so nothing is
left behind for `perchesInSiteRooms` to find.

**Left.** B2b waits on D23. B5 is next and is an L: its own run.

## B2b — the scuff is a noise the Warden hears (2026-09-12, Josh's session)

Josh answered D23 in one line: the quiet option. A failed climb's slap on
the wall goes into the noise field at a footstep's radius, so a Warden in
the room looks up and one two rooms away hears nothing.

**Built.** Not as the queue item literally said - "one `emit('noise')` in
`_scuff()`" - because the noise field is Detection's and an entity does not
reach up into a system (Section 3.1). Instead the landing's pattern: the
controller records `Shade.scuffedAt` (where the hands hit, at the hands'
height) on the scuff step and clears it at the top of the next; Detection's
`_emitShadeNoise()` reads it in the same fixed step and emits a `scuff`
event of `noise.radii.shadeScuff` (4m, beside `shadeLanding`) there, or the
vent radius inside a duct like everything else. Audio already plays the slap
from `shade:scuff` and ignores the `scuff` noise type, so nothing sounds
twice. The AI's hearing needed nothing: it is a distance test against live
events, and the event is where the hands hit, up the wall - so on the floor
the effective radius is a little under the nominal 4m. Spec 20.5's open
paragraph closed.

**Verified.** New check `a-scuff-is-a-noise-the-warden-in-the-room-hears`:
the AI on, the Warden stood 2.0m along the wall from the hands, on the floor,
facing away so nothing is a sighting; the press drives the real keys; on the
scuff step the field reports a `scuff` of the configured radius at the
Warden's position, and one step later - the AI steps before Detection in the
fixed step, so it hears on the next - `lastKnown` is within 0.3m of the hands
and the state is SUSPICIOUS. Then the Warden 9m along the wall hears nothing
and does not turn. With Detection's emission stubbed out it is red in its own
words ("a Warden 2.0m along the wall heard nothing on the scuff step; ...
patrol, not suspicious"). Full suite **124 passed / 1 failed, twice,
identical**, flaky empty, zero console errors.

**Found.** The approach walk emits no footstep before the press - a reset
rewinds the odometer and the body moves under half a metre in five steps -
which is what lets the check attribute what the Warden heard to the scuff
and nothing else. Worth knowing for any future hearing check: a Warden
within 4m of the Shade's feet hears the *walk* first.

**Left.** B5 is next, an L: the area pass.

## B5 — the area pass, measured honestly (2026-09-13, scheduled run)

The job said: worst area first by the census's "needs a leg up" count, make
every stacked route intentional, no dead climbs, and get the count to 10 or
under. The first thing the pass did was read the count, and the count was
not measuring what anyone thought.

**Found, before building anything.** The census called a climb "from the
floor" when it succeeded from `heights[0]` — the lowest surface a 0.5m ray
found under the stand spot. Under anything on the deck that ray finds the
ground floor six metres down, so the four server racks and three of the
four office desks — a 1.9m mantle and a 0.95m vault you walk up to — were
"a leg up". And over a crate the ray starts inside the crate and finds
nothing, so `fire-escape-2` and `-4`, whose one stand spot lies above the
base crate, were "from the floor" while `-3` beside them was not, and
`gantry-hall` (climbable only from the container) and `gantry-bay` (only
from the crate stack) were "from the floor" for the same reason. Of the 22
reported, 7 were walk-up climbs and 5 real leg-ups were missing. The done-
when's "≤ 10" was written against that number.

**Built.** Four things, none of them geometry.

1. *"From the floor" means from ground a walking body reaches.* The census
   asks `map.wardenGround` (A1's flood from the spawns: floors, the deck,
   stair treads, the apron, the fire-escape landing flush with the deck),
   with a metre's tolerance because the ground was flooded for a 0.84m
   Warden and the 0.68m Shade walks into a duct mouth no Warden cell lands
   in (`onWalkableGround`, readability.js). The full leg-up list goes to the
   F4 log the way the failure list does, since it is the work queue. The
   honest count is **21**: the deck slabs and lips every route lands on (11),
   the intermediate stages that are only reachable from the stage below
   (`gantry-hall`, `gantry-hall-south`, `gantry-bay`, `vent-up-vault-lip-from`
   and `-floor`, `fire-escape-1`, `-2`, `-4`) and the roof strip and its lip.

2. *The controller sweeps past a climb it cannot commit.* Measured honestly
   the two duct roofs showed as leg-ups, and the rule says they are a 3.57m
   jump from the hall floor. Traced: standing beside a duct, `_probeLedge`'s
   hand sweep meets the duct *floor's* side face first — a climbable box, by
   its mouth — `_climbLedge` tries to mantle into the duct, the crouched
   capsule plus `mantleClearance` (1.17m) does not fit the 1.15m interior,
   and the press ends in a scuff with the roof never probed. The rule's own
   sweep (`handsReachFace`) keeps going past anything that is not the face
   it is asking about; now the controller does too: `_climbAhead()` in
   agenttraversal.js sweeps again past every box a climb was refused on
   (`_probeLedge(forward, past)`), lowest first, until one commits or nothing
   is left. Bounded, and a refused climb changes nothing, so the retry is
   free. Both ground and air paths go through it.

3. *The rule reaches as far as the controller does.* `approachRect` and
   `handsReachFace` used `vaultReach` (1.44m with the radius) for every
   rise; a rise that needs the jump is caught in the air by `_tryMantle`,
   which probes `mantleReach` (1.29m). `handReach(rise)` in mapclimb.js
   picks the one the controller will use. It mattered once: the rule named
   a 3.7m jump from the mouth of the south duct's lip onto `deck-21` from a
   spot 1.41m out, standing between the duct's walls with `wall-b` 0.3m in
   front of the hands; the controller met the wall and scuffed.

4. *The routes are data.* `map.routes` (mapdata.js `placeRoutes`, eight
   routes: the five designed, the two the duct roofs make, and the fire
   escape split at its deck landing because that landing is walkable
   ground), each a chain of stages ending at a height; `stairlessRouteMin`
   (5) and every tag asserted at build; spec 20.6 says why this is not a
   tag. The map's five stairless routes were a comment in map.js listing
   rises. They are now something a check can walk.

**Verified.** Three new checks, `tests/routes.js` and one in readability.js:
- `every-approach-the-rule-names-is-a-climb-the-controller-makes`: every
  approach the rule names within reach, from the rule's own spot on the
  rule's own support, with W and Space held — **151 of 151**. Before 2 and
  3 it read *"5 of 151 approaches the rule names do not climb:
  vent-low-north-roof from ground-plane (+z face, rise 3.57 …): scuffed …
  deck-21 from vent-low-south-lip-from (-z face, rise 3.70 …): scuffed"*.
  This is the check the census could not be: the census needs one climb per
  box and both roofs climbed from the vent floor.
- `every-stacked-climb-is-a-step-of-a-declared-route`: each route's first
  stage is a standing climb (≤ 2.6m) from walkable ground, every later stage
  is climbable by the rule from a box of the stage below, it lands where it
  says, and every climbable surface with no walkable approach — 22 by the
  rule, the census's 21 plus `deck-26`, which the controller also climbs from
  the corridor stairs' treads though the rule does not name a tread as a
  support — is a stage or a landing of some route. With `hall-vent-north`
  removed it reads *"1 stacked climbs no route explains: deck-7"*.
- `every-climbable-top-has-an-exit-that-is-not-the-way-you-came`: an onward
  climb by the rule (28 tops), a wide surface at its level to walk onto (12:
  the lips, the vent lips, the roof strip), or a face to drop from that is
  not the only way up (18; no fall damage, so any clear edge). A staged
  crate with 2.5m walls on three sides reads *"1 dead climbs: neg-crate (1
  clear face, 1 way up)"*; `server-rack-0` correctly cannot leave by the
  face 0.2m from the vault wall.
The five rule checks together run in 1.9s. Full suite **127 passed / 1 failed (the headless-skipped frame budget), twice, identical (317s and 392s), flaky empty, zero console errors, zero context losses, `loopFrames` 0**.

**Not built, and why.** No geometry moved. Measured honestly the map has no
dead climb and no stacked climb the rule does not read as a route; what it
has is two routes nobody drew — the duct roofs to the void edge — and a
lip mechanism the rule no longer reads. Whether the void edges should
refuse anywhere but a lip is a question about what the player can do, so it
is D25, with the rail design and its costs written out and B5b queued
behind it. The "≤ 10" target is not reachable under any honest measure
without deleting steps of designed routes (a five-flight fire escape is
four leg-ups by itself); the census's number now means what the sentence
says, and the job's contract is the route check, which is what the number
was for.

**Left.** D25 for Josh; B5b if he takes the rails. B6 is next. Worth
knowing for B6/B7: `map.routes` is the list of what to light, and the census
stops at the first floor climb per box (as designed), so its "approaches"
count moves with what succeeds first — the per-approach check's 151 is the
stable number.

## B6 — legibility: the material language (2026-09-13, scheduled run)

The job said: metal where you pass, concrete where you don't; vents read
by contrast, which the interview decided. Done-when: a pixel check measures
luminance contrast ≥ 0.25 between every vent interior and its surround from
a camera at the approach.

**Found, before building anything.** The ducts were `P.concreteDark` — the
same colour as the ground plane, the deck, and the fence. A duct through a
`P.concrete` wall was a slightly darker patch of the wall; a duct sitting
on the floor was the floor. The comment in `addVentRun()` already said what
it should be ("a duct says it is passable by being visibly a duct - metal,
rimmed, person-sized") and nothing had built it.

**Built.** Small, on purpose: the vocabulary and one use of it.

1. *The palette states the language.* `palette.ductMetal` (0xc6d0d6,
   galvanised sheet) joins the table, and the comment above the palette
   says what the colours mean now: concrete is structure you do not pass
   through — walls, floors, the deck, the ground; metal is what you pass
   through or climb — ducts in galvanised sheet, gantries, deck lips and
   the fire escape in the gunmetal they already were. The gantries and lips
   were already metal; the ducts were the one thing you pass through that
   was painted as a thing you do not.

2. *Every piece of a vent run is that metal.* Floor, lips, walls, roof, in
   `addVentRun()` — one material, so the interior is the same sheet as the
   outside and the mouth reads as a tube with an inside. The run record
   now carries `boxes` (every collision box it built, so a check can hide
   it) and `mouths` (which ends a body arrives at: a lip is climbed into, a
   run at grade is walked into at both ends; the upper vent's far end,
   which opens upward through the vault hatch, is not a mouth).

3. *The check, `every-vent-mouth-reads-by-contrast-from-its-approach`*
   (`tests/legibility.js`, a new file — B7's checks go there too). For each
   mouth it stands where a body arrives: for a lip, the lowest spot the
   climb rule itself names on the mouth's face (`_supportApproaches`), so
   the camera is where the census stands; for a walk-in, level floor
   straight out along the run, as far back as there is floor — 3m on the
   hall floor, 2.5m at the west grade mouth (the fence is at 3), 1m at the
   north duct's west mouth, which opens onto the top of `stack-hall-mid`
   and is walked into from the crate. Eye height, looking at the opening's
   centre. Then: render, hide the run's boxes, render again; the difference
   is the duct's pixels. The opening's four corners are projected through
   the camera into a quad; duct pixels inside it are the **interior** (what
   is seen through the mouth), all duct pixels are the **body**, and every
   other pixel in a band 0.6 openings wide around the quad is the
   **surround** — the wall it goes through, the floor under it, nothing
   further. Michelson contrast, |a−b|/(a+b) of the mean lumas, for interior
   and body against the surround, each ≥ 0.25. Michelson rather than a luma
   difference because a duct in the dark vault and one in the lit hall are
   the same material and should read the same; the vault mouth reads 31
   against 3 and a difference would have called that invisible.

**Verified.**
- With the metal, nine mouths: north duct west 0.27 / 0.28 (117 and 118
  against 67 — the crate-top approach, where the surround is the orange
  stack, not concrete), north east 0.55, south west 0.48, south east
  0.52 / 0.41, vault 0.81, grade-west 0.63 / 0.53, grade-south 0.53 / 0.47.
- With the ducts put back to `concreteDark`: eight of nine mouths red, the
  readings 0.01 to 0.23 (*"vent-low-north (to): the interior reads 22.7
  against a surround of 24.6, contrast 0.04"*). The one that passes is the
  crate-top mouth, where a dark duct against orange paint contrasts the
  other way. So the check measures the material and not the lighting.
- The check takes ~30s on SwiftShader (19 full-frame grabs); the full run
  grows by about that.
- Full suite **128 passed / 1 failed (the headless-skipped frame budget), twice,
  identical (326s and 402s), flaky empty, zero console errors, zero context
  losses, `loopFrames` 0**.

**Found, and queued as B5c.** Surveying the approaches to the lips, the
rule names a climb onto `vent-low-north-lip-from` from the ground *under
the duct*, by the lip's +x face, which is exposed beneath the floor slab
from 1.4 to 2.1m. Traced with the real controller (W + Space from
(-11.11, 0, -16) facing west): state `mantle` from the ground, feet 2.29 at
x −12.85 — inside `vent-low-north-floor` (y 2.1–2.3) — landing in the
mouth at 2.43. The body passes through the duct floor. The same four
approaches exist at the south duct's lip-from and both lips-to. The
landing capsule is clear (that is what B4b validates) and the path is not;
Section 6.1's safety rule speaks of the destination only, and `handsReachFace`
sweeps past the slab because it is "not this box". Fixing it changes no
rule of the game — nobody meant a duct floor to be climbed through from
underneath — but it touches the rule, the controller and the
`hall-vent-north` route declaration (its only ground approach is this
one; the honest first stage is the crate stack), so it is its own job, S.

**Not built.** No rim or flange at the mouths (baked decoration; D26 lists
it as the alternative if the flat sheet does not read), no change to
gantries, lips or the fire escape (already gunmetal), no lighting — that is
B7, and B7 should know the thinnest reading is the crate-top mouth at 0.27,
with orange paint as its surround.

**Left.** D26 for Josh (how the metal looks). B5c is next; B7 after it.

## B5c — a mantle never passes through a solid (2026-09-13, same run)

The job B6 wrote for itself: the rule and the controller both mantle onto
a duct lip from the ground *under* the duct, through its floor slab.

**Traced first.** W + Space at (-11.11, 0, -16) facing west, the real
controller: state `mantle` on the first step, straight from the ground (a
2.3m rise is inside standing reach), feet 2.29 at x -12.85 - inside
`vent-low-north-floor`, y 2.1 to 2.3 - and the body lands crouched in the
mouth at 2.43 and walks on out of it. The lip's +x face is exposed beneath
the slab from 1.4 to 2.1m; the hands meet it, the landing capsule inside
the mouth is clear (B4b's test, honestly passed), and nothing asks about
the 0.2m of concrete in between. The same at the south duct's west lip and
both ducts' east lips, and - which B6's survey did not list - at
`stack-hall-mid` from under the north duct, whose top is level with the
duct floor and whose landing is inside the mouth too. Five approaches.

**Built.** One sentence, said in both places.

1. *`src/climbprobe.js`.* The hand sweep's constants (`PROBE_STEP`,
   `HAND_HALF`) were declared twice, once in `mapclimb.js` and once in
   `entities/agenttraversal.js`, each with a comment saying they were kept
   identical on purpose; the map and an entity may not import each other
   (Section 3.1). They now have one home at the physics layer, importing
   nothing, alongside the new `handsOverTop(collision, x, z, fromY, topY)`:
   from a hand on a face at `fromY`, is the column above the body open air
   up to just over the top of that face. A hand that meets a ceiling on the
   way up never gets over the edge, whatever the landing looks like.

2. *The rule.* `handsReachFace()` returns `handsOverTop(...)` where it
   returned `true`. Everything higher is behind the same ceiling, so the
   answer is final.

3. *The controller.* `_probeLedge()` asks the same before it returns a
   ledge, and `break`s on `false` the way it already breaks when a sample
   is not in open air - the sweep stops where the hand does. `_faceAhead`
   was recorded at the hit, so the press is a scuff on the duct floor (20.5).

4. *The route.* `vent-low-north-lip-from` had exactly one approach, this
   one: its west mouth opens level onto the top of `stack-hall-mid` (a
   walk-in, not a climb) and the crates cover its other faces. It is not
   climbable now, and `hall-vent-north` is declared honestly: `stack-hall-low`,
   `stack-hall-mid`, then `vent-low-north-roof` from the mouth (a 1.27m
   vault the rule names from the crate top). Eight routes, 22 stages.

**Verified.**
- `a-mantle-never-passes-through-a-solid` (tests/routes.js), two halves.
  By the geometry: for every approach the rule names, no solid other than
  the box is over the spot (footprint contains it, underside above the
  feet) and under the landing (top at or below the box's top). By the
  controller, without asking the rule: from under each low duct's floor, a
  hand's reach short of each lip, facing it, W + Space for 90 steps - the
  body never rises within 5cm of the slab's underside, and the press
  scuffs. With `handsOverTop` stubbed to `true` both halves go red: five
  *"... is over the spot (2.10-2.30m) and under the 2.30m landing"* and
  four *"the body rose to 2.80m, into a floor slab whose underside is
  2.10m"* (the south lip-from reads 4.44: from inside the duct it went on
  up the roof). With the fix, 146 approaches and 4 presses, green.
- The done-when asked for a crouched-capsule sweep along every mantle's
  path, and that was tried first, twice. A vertical column at the spot
  flagged the fire escape (the flight above overhangs the one you stand
  on), `hall-container` from under `gantry-hall` and `stack-bay-mid` from
  under `gantry-bay` - bodies that brush an overhang on a diagonal they
  never actually take vertically. The controller's real path (`_stepTraversal`:
  eased line plus a 0.18 arc) flagged every duct mouth instead, because the
  floor slab is coincident with the lip's top and going over the lip's
  corner is going over the slab's. Neither says "through". "Starts under
  it and lands over it" does, and it is a fact about the geometry that
  does not read the rule's sweep, which is the shape HANDOFF asks for.
- Census: 214 boxes, **57 climbable** (was 58 - the north duct's west
  lip), 123 approaches / 105 climbs from the floor, all 57 reached, **21
  need a leg up**, the same 21; `the-climb-rule-has-no-exceptions` 0
  disagreements; **146 of 146** approaches climbed (was 151); 8 routes, 22
  stages, 22 stacked climbs every one on a route; 57 tops all with an exit.
- Full suite: red on the census's room-A sample both runs after the reboot; finished under "B5c - resumed" below.

**Not built.** Nothing else moved. The gantry and fire-escape brushes the
column sweep found are real but small - a standing body's head passing an
overhang's corner for a few frames of a move that ends validated - and they
are B8's (feel: the mantle's path and pose), not a rule.

**Left.** B7 is next (route lighting; `map.routes` has 22 stages to light).
Nothing for Josh from this one.

## Audit — 2026-09-13

**BROKEN BASE — the working tree, not HEAD.** The PC rebooted at 18:19:43
today, in the middle of the 17:00 build run. `src/systems/plantrule.js` and
`src/systems/objective.js` are zero-filled on disk (10,389 and 19,600 NUL
bytes, both written 18:19:18, 25 seconds before boot), and `npm run suite` in
the tree crashes at boot: `pageerror: Invalid or unexpected token`, the
harness never appears. B5c is finished but **uncommitted** (11 modified files,
`src/climbprobe.js` untracked; QUEUE.md, HANDOFF.md, PROGRESS.md and the spec
already record it as done). A further edit was in flight when the machine went
down: `src/tests/plantcensus.js` now passes `h.map.collision` to
`withinDefuseReach`, and the matching half in `plantrule.js` is gone with the
zeroing. HEAD `2e12d0e` (B6) is intact and green (below). The 02:00 run will
GATE on this tree and stop. The way back is `git checkout HEAD --
src/systems/plantrule.js src/systems/objective.js`, then VERIFY the B5c tree
twice before it is committed as B5c. The audit fixed nothing and committed
only its own two hunks.

**Landed.** Week 2026-09-06 → 09-13; oldest commit `5c6d571` (2026-09-08).
47 commits. 23 entries under Done in QUEUE.md, all of them this week (the
queue itself dates from 09-08): P1, P2, A1–A8, F1–F4, B1, B2, B2b, B3, B4,
B4b, B5, B6, and the D17 commit. Queued during the week: F1–F4, B2b, B4b,
B5b, B5c (8). At HEAD: 23 `[ ]` open, 0 `[~]` WIP. Blocks A and F closed; B
is at B5c (done in the tree, uncommitted) then B7.

**Blocked on Josh** (`decided:` empty): D8 site ring, 5 days (added
2026-09-08; nothing blocked on it). D13 map-change placeholder, 5 days
(nothing blocked on it). D25 deck void edges, under 1 day (added 2026-09-13
02:59; blocks B5b only; the recommendation, option 1, is what is built).
Decided but still filed under the Blocking heading: D14, D15, D20, D23.

**Suite health.** HEAD `2e12d0e`, run in a scratch worktree of the commit
(the project tree cannot boot, above): 128 passed, 1 failed, red [], flaky
[], expectedRed [], skipped 1 (the frame-budget check, outcome fail),
consoleErrors 0, contextLosses 0, 377s. Matches HANDOFF.md (128/1) and the
empty Deliberately-red list: **pass**. Checks registered: 129. Diff
`5c6d571..HEAD -- src/tests scripts/suite-skips.json`: +3,458 / −91 across
21 files. Looked for looser thresholds, removed assertions, deleted checks,
new skips:
- `scripts/suite-skips.json` is new this week, one entry:
  `the-frame-budget-holds-everywhere-not-just-at-site-a`, "SwiftShader draws
  a frame in ~400ms". Reported, never counted. The only skip.
- No check deleted; no numeric threshold loosened. The 91 removed lines are
  `tests/objective.js`'s `spotOffTheRing`/`plantAt` helpers moved to
  `tests/plantspots.js`, and comments.
- Two acceptances widened, both following D21's new grab state:
  `tests/shade.js` fuzz, `+ h.shade.state === SHADE_STATE.GRAB ||` beside
  MANTLE/VAULT/HANG, twice.
- **The census's definition moved** (`tests/readability.js`, B3/B4b/B5):
  `- const shouldClimb = box.solid && standableTop(h, box) && move !== null && move !== 'step';`
  `+ const shouldClimb = wideTop(box) && reachable;` where `reachable` is any
  support approach with a real move whose landing fits. This is the change
  that turned the census green on 09-12. It is a redefinition of the
  contract, argued in B3's and B5's PROGRESS entries, not a loosened number;
  flagged because the census is the thing QUEUE.md says never to weaken.

**Drift.** Over 600 lines: `src/config.js` 1,282 (exempt). TODO/FIXME: 0.
`Math.random`: 1 real use, `systems/audio.js:97`, the documented noise
buffer. `setTimeout`: 1 real use, `tests/performance.js:82`, documented as
deliberate and inside a check, not the game.

**Fresh seeds.** `--query "seed=20260913" --subset "fuzz|soak"` on HEAD: one
check matched, `shade-invariants-under-fuzz`, passed. Widened to
`fuzz|soak|getting-stuck|never-climbs`: 3 passed, 0 failed. Nothing to queue.

**Recommendation.** Before 02:00: restore the two zeroed files from HEAD, run
the suite twice on the B5c tree, commit B5c. Then one line under D25 so B5b
either happens or leaves the top of Block B. And read B5's PROGRESS entry
once: the census's sentence changed this week, and it is the contract.

## B5c — committed as WIP after the reboot (2026-09-13, evening, Josh's session)

The entry above was written before the 17:00 run's VERIFY finished. The PC
rebooted at 18:19:43 with the run mid-fix; `src/systems/plantrule.js` and
`src/systems/objective.js` came back zero-filled and were restored from
`2e12d0e`. The B5c tree then ran the suite twice: **128 passed, 2 failed**
both times, no flake. Besides the skipped frame budget, one red:
`every-legal-plant-has-a-warden-who-can-reach-it` -
*"vent-low-north-roof (top, room A): the Warden never started defusing in
30s from its nearest spawn - it got to 0.5m and stayed in defend"*. The run
had started on it: `tests/plantcensus.js` now passes `h.map.collision` into
`withinDefuseReach()`, and the other half of that change was in the zeroed
`plantrule.js` and is lost. Committed as `WIP: B5c`; the `[~]` item in
`QUEUE.md` carries the resume note. Nothing else touched.

## B5c — resumed: the census red was the route, not the rule (2026-09-14, scheduled run)

The 02:00 run. The gate came back exactly as the WIP note said it would -
128 passed, 2 failed, the frame budget skipped and
`every-legal-plant-has-a-warden-who-can-reach-it` red on
*"vent-low-north-roof (top, room A): the Warden never started defusing in
30s ... it got to 0.5m and stayed in defend"* - so this is the mid-job
state ORIENT describes and not a broken base, and the job was finished
rather than the run stopped.

**Traced first.** A throwaway check (not kept) planted the roof spot the
way the census does and printed the AI's route and its position every two
seconds. Two things, one of them the bug:

- The sample changed because B5c changed the ledge list. The census sends
  the Warden to the least obvious legal spot per room, tops before floors,
  first in ledge order; in room A that was `vent-low-north-lip-from` (2.3m
  up, defused from the hall floor) and is now, with the lip no longer
  climbable, `vent-low-north-roof` at (-7, 3.59, -16). Nothing on the hall
  floor is within 2.5m of it vertically. It is legal because the **deck**
  is 2.41m above it and a Warden standing on the deck directly over the
  charge is within `DEFUSE_REACH` by both distances - through 0.3m of slab.
  That is D27 (below), not this job.
- The Warden went for the deck, as `standAt()` told it to, and its route
  was `(-11.3, 6, -21.3) -> (-7.3, 6, -18.3)`: one pulled segment from the
  last deck waypoint, cutting across the corner of the hall void at
  (-8.6, -20). `route()`'s pull asks `walkable()` of the line, and
  `walkable()` rests the body on any top face its footprint overlaps - the
  solver's own policy, argued in `standableFloors()`. The line passes
  0.414m inside the void at its deepest; the Warden's radius is 0.42. Six
  millimetres of deck, and the pull said yes. The follower then advances
  to the next point from `waypointArriveRadius` (0.9m) away and turns at
  3.4 rad/s - a 0.9m circle at walk speed - so it cut that bend by a third
  of a metre on the inside, which is where the void was. At t=10 it was at
  (-10.28, 6.98, -20.22), 0.2m off the line; at t=12 it was on the hall
  floor, 3.6m under a charge it could no longer reach, in DEFEND for the
  rest of the fuse. Exactly the stall Block A exists to prevent, from a
  leg Block A8 planned.

**Built.**

1. *`ai.routeEdgeMargin`* (config.js, 0.6, beside the arrival radius it
   answers to): how far off a planned line the Warden actually walks.
2. *`WardenGround.route(from, to, maxLeg, snap, margin)`* (mapground.js):
   a pulled segment must also have ground under the two lines `margin` to
   either side of it, sampled every quarter cell - `groundUnder()`, a top
   face within a step of the line's own height, support only, no
   footprint and no headroom. A wall beside the line is a slide and passes;
   a void beside it is a fall and refuses the pull, so the line bends at a
   cell centre instead. The seam test is inclusive (a point on the joint
   between two deck slabs is over both): the first cut sampled a seam
   exactly and refused a straight run down the middle of the deck for no
   reason, three cell steps long. The AI passes its margin from
   `_pathTo()`; the flood and the cell steps are untouched.
3. *`the-last-leg-to-every-legal-plant-is-planned-and-short`*
   (tests/plantcensus.js) asks the same of every pulled segment by ray -
   from a step above the line to a step below, at each strayed point -
   independently of the planner's box query. A cell step is held to what
   it always was (both centres standable, the gap clear): it is a
   flood-proven edge, not a line the planner drew.
4. The two `withinDefuseReach(cell, spot.at, h.map.collision)` call sites
   the reboot left in the census are back to two arguments. The third was
   the start of D27's option 2 and it waits for D27.
5. *`src/groundprobe.js`.* The first full verify was green everywhere but
   the 600-line guard: mapground.js had reached 628. The three column
   probes the flood and the planner share - `standableFloors()`,
   `walkable()`, and the new `groundUnder()` - and their constants are
   their own module now (112 lines; mapground.js 539). Nothing renamed;
   `deriveWardenGround` and `WardenGround` stay where mapkit.js imports
   them.

**Verified.**

- With `_pullStraight()` handed a margin of 0 (the old behaviour, restored
  after): the census sample red as before, and the last-leg check red on
  *five* routes - the roof's, and three floor spots in room C whose lines
  grazed the vault hatch the same way (`(14.0, 9.2)`, `(14.9, 11.1)`,
  `(14.9, 9.8)`), which nobody had walked yet. With the margin: the route
  bends at (-7.3, 6, -20.8), the Warden stays on the deck and defuse
  progress starts at 11.8s.
- Census unchanged from the WIP: 57 climbable, 146 of 146 approaches, 8
  routes, 22 stages; `a-mantle-never-passes-through-a-solid` green.
- Full suite, before the split: 128 passed, 2 failed both runs, the
  census green, the only red the 600-line guard on mapground.js (628).
  After it: **129 passed, 1 failed** both runs (334s, 404s) - the frame
  budget skipped headless - 0 red, 0 flaky, 0 console errors, 0 context
  losses, 0 loop frames.

**Not built.** The margin is only asked of pulled segments. A route that
cannot pull - along the 1.2m deck strip beside the bay void, say - falls
back to cell steps, and a rim cell (one whose centre is up to 0.15m over
an edge, standable by footprint overlap) is still a cell the follower aims
at. Nothing walked off one in the soak or the patrol check; if one does,
the fix is a two-pass search in `route()` that prefers cells with the
margin's ground all round and takes the rim only where there is no other
way. Noted here rather than queued.

**Left.** D27 raised, B5d queued behind it; B7 is next.

## B7 — legibility: the routes are lit (2026-09-14, same run)

The second job of the 02:00 run, after B5c. The plan's phases 35-41 asked
for "edge profiles and route lighting"; B5 turned the routes into data
(`map.routes`) so there is something to light that is not a list of names.

**The question first.** What "lit a step brighter" may mean. A lamp in the
scene is a thing Section 7.1's detection model reads and Section 5 counts
(twelve, destructible), so lighting a route with a lamp would make every
route a riskier place to stand - a rule, and Josh's. Paint is not: emissive
is seen and not counted. So the light is paint, provisionally (D28), and
the one number to turn is `map.routeLighting.emissive`.

**Built.**

1. *`src/maproutelight.js`, `lightRoutes(map)`*, run from map.js after
   `deriveClimbableSurfaces()` (it reads the rule's approaches) and before
   validation. Two devices, both derived, nothing named:
   - Every stage box of every route: `lightSides()` reorders the box's
     index so its four sides are one group and its caps another, and the
     mesh takes two materials - the material cache's new `lit` variant of
     its own colour (mapbake.js: the colour as emissive at 0.12) on the
     sides, the plain one on the caps. The outline mesh shares the geometry
     with one material and ignores the groups. 20 boxes; 20 more draw
     calls.
   - The landing edges: for every climbable surface at a route's landing
     height, every face the rule names an approach onto from a box of the
     route's last stage, a strip along that face over the spots it names
     and `edgeReach` (1.0m) either side, clipped to the face; a thin box
     (0.06 x 0.05) standing a centimetre proud of the face just under the
     top, all of them merged into one `MeshBasicMaterial` mesh in the
     lamps' warm white. 15 strips: the four deck lips, the fire escape's
     deck and roof landings, and the slabs the reach rule found itself -
     `deck-7`, `deck-19`, `deck-21` from the duct roofs, three round the bay
     gantry, three round the vault hatch. That is D25 drawn: today a lip is
     *a* way up and the strips say so.
2. *`every-route-reads-lit-from-its-foot`* (tests/legibility.js). For each
   route: the foot is the lowest spot the rule names for a climb onto the
   first stage that is on ground a walking body reaches; eye there, look at
   the stage, render, hide the stage and render, the difference is the
   stage; then paint the stage with its plain material in the same frame
   and render again - the same pixels unlit, which is the instrument
   reading the light and not the crate's own orange. Requires a step of at
   least 10 luma over unlit and 0.25 Michelson against the band round it.
   Then from the last stage, where the rule says a body stands to go over,
   each strip's pixels (shown minus hidden) against a band round them,
   at least 0.5. And the strips cost exactly one draw call. With
   `emissive` at 0 every route is red at "a step of 0.0 < 10".

**Verified.**

- Readings, from the foot: stack-hall-low 65 lit / 48 unlit against 35
  (0.30); vent-low-south-lip-from 116 / 89 against 28 (0.61); stack-bay-low
  51 / 25 against 18 (0.46); stack-vault-low 43 / 19 against 11 (0.59);
  fire-escape-base 51 / 31 against 13 (0.61); fire-escape-3 35 / 19 against
  13 (0.46). Steps 16 to 27. Strips 222 to 230 against 2 to 38, 0.72 to
  0.98.
- The first cut lit the whole box, tops included, at 0.22 and then 0.12,
  and put B6's `every-vent-mouth-reads-by-contrast-from-its-approach` red
  where HANDOFF said it would: the north duct's west mouth is read against
  the top of `stack-hall-mid`, a lit stage, and the surround went from 68
  to 76 against the duct's 118 - 0.21, then 0.23 at 0.08. The margin was
  0.02 and the top of a crate is not what tells you it is a route from
  below; the sides carry the light now, the top is as it was, and the mouth
  reads 0.27 as before. The check was not touched.
- Subset (performance, visual, detection, climb, routes, census, the
  600-line guard): 29 passed, the frame budget skipped. Full suite
  **130 passed, 1 failed** both runs (391s, 456s), the frame budget
  skipped headless, 0 red, 0 flaky, 0 console errors, 0 context losses.

**Not built.** A bevel on the lips: the strip is the edge profile, and a
chamfer reads only in a raking light this rig does not have. Whether the
strips should be dimmer, or the emissive lower, is D28's; the numbers are
there to turn.

**Left.** B8 (feel) is next. D25 now has a picture to decide against: the
strips on `deck-7`, `deck-19`, `deck-21` and round the hatch and the bay are
the reach rule's routes, lit.

## B8 — feel: momentum, weight, the buffer, the hanging body, and the way up (2026-09-14, scheduled run)

The 17:00 run. The gate: 130 passed, 1 failed (the frame budget, skipped),
0 red, 0 flaky, 0 console errors. B5b and B5d wait on D25 and D27, so B8,
the plan's phases 42-46 in one M job.

**What "feel" is allowed to be.** Every item in the job is a number in
`config.js`, and none of them is a new thing a player can do - except one,
by a hair, flagged below. The rest is presentation and timing, provisional
by D4, and recorded as D29 with the one line to turn for each.

**Built.**

1. *Momentum carries into a vault.* `_commitMove()` remembers the speed the
   body brought (`move.entrySpeed`); a vault's duration slides from
   `vaultDuration` (0.42) at a walk to `vaultDurationAtSprint` (0.28) at a
   sprint (`_vaultDuration()`), and on the exit the body leaves with
   `vaultCarry` (0.85) of what it brought, floored at `vaultExitSpeed` 4.2
   and capped at a sprint. A walk over `stack-hall-low` is 26 steps and 4.20
   out, as it was; a sprint is 17 steps and 5.52 out.
2. *A landing has weight.* `_land()` puts the fall on `shade.landing`'s ramp
   - nothing under `softFall` 1.2m, all of it from `hardFall` 4.0m - and
   cuts the horizontal speed by that much of `speedLoss` (0.5), holds the
   ground speed there for `recovery` (0.4s, scaled) in `_stepGround()`, and
   hands the same weight to the visual: the camera pivot dips
   `camera.landDip` (0.3m) and the body squashes `landing.squash` (0.12).
   At a sprint: a 1.0m hop keeps 1.04 of its speed, 2.6m keeps 0.77, 5.0m
   keeps 0.51; 0.15s after the hard one the sprint is 3.25 m/s and 0.7s
   after it is 6.5 again. **This is the hair:** a Shade dropping off the
   deck to break contact is 0.4s slower for it. It is the queue's own words
   ("landing weight by fall height"), so it is built, and `speedLoss` at 0
   is a landing that is only seen (D29).
3. *The camera dips on a climb.* `_dipKick` is written by the step (a
   vault, mantle or pull-up committing: `camera.climbDip` 0.22; a hard
   landing: `landDip` by the weight) and `_settleDip()` in agentvisual.js
   runs it through a critically damped spring on the pivot's height -
   the kick lands as a velocity impulse sized so the spring bottoms out at
   exactly the depth `dipRecovery` (0.26s) later, then eases home with no
   overshoot. Same shape as `_scuffTimer`: the step says what happened, the
   frame shows it, the simulation never reads it. A grab does not dip - a
   hang is a reach, not a rise - and the pull-up after it does. Measured
   from the rig, not pixels: over `stack-hall-mid` the pivot dips 0.194m
   (Euler at 60Hz undershoots the analytic 0.22 by 12%) and is level within
   two seconds; the grab at `hall-container` moves it 0.000.
4. *The jump buffer runs in every state.* `jumpBuffer`'s own comment said
   "buffered this long before landing still fires" and it never had: the
   buffer was set and read only in `_stepGround()`, so a press in the air
   was lost on the landing and a press in the last of a vault was lost at
   the top. Now the countdown is in `step()`, `_stepAir()` and
   `_stepTraversal()` set it on a press (not during a grab, where Space is
   read as held by the hang it ends in), `_commitMove()` spends it (the
   press became the climb) and `_scuff()` spends it (the press became the
   tell - or the body would jump again off the landing it is pushed back
   to). A press 0.06s before a landing jumps off it; 0.32s before does not;
   the same at the end of a vault; a press spent on a scuff at `site-fence`
   does not jump.
5. *The hanging body is at full stretch.* `hangDrop` 2.05 (was 1.35): on
   this rig the hands are 2.08m above the feet with the arms raised, so
   this is where a body hanging by its hands is - the capsule's top 0.2m
   under the lip where it stood 0.5m proud. Arms straight up
   (`HANG_ARM_ANGLE` -3.05 in agentvisual.js), the gloves drawn within
   0.15m of the lip, `hangPullUpDuration` 0.65 for the longer pull. And the
   lip the job named - `hall-container`'s south face, 0.30m under
   `gantry-hall` - hangs now: a jump-tap from under the gantry grabs, Space
   scuffs once and stays hanging, crouch drops to the floor.
6. *The way up is swept - the rule B8 found.* The first cut of 5 put the
   hang under the gantry and then watched the pull-up **go through the
   gantry**: `_climbOnto()` validates the crouched capsule at the landing,
   which is beyond the gantry's edge, and `handsOverTop` (B5c) clears the
   column to the top of the face, which is under the gantry's underside;
   the body, taller than a hand, travelled the diagonal between them
   through 0.7m of gantry. So had the mantle from the air, before B8 - the
   queue's "goes over instead" was through. `riseIsClear()` in
   climbprobe.js sweeps the capsule along the move's own path (`movePath`,
   the ease-out and the arc `_stepTraversal` draws, now shared so the sweep
   and the drawing cannot disagree) against every solid whose top is above
   the landing's - the things the body could be going up *through*, and
   not the box it climbs over the corner of, nor a duct floor coincident
   with a lip's top. The rule says it (`riseFits`, mapclimb.js, after
   `landingFits`) and the controller says it (`_climbOnto`, per height).
   Not the grab: a hang is a reach, which is what makes the gantry case a
   hang and not a scuff. What went, by a dump of the rule's approaches
   before and after: **nine**, `hall-container` from the ground under the
   gantry, and every low duct lip's two *side* faces from the ground beside
   the mouth (`vent-low-north-lip-to`, `vent-low-south-lip-from`,
   `vent-low-south-lip-to`, both sides each, and `vent-up-vault-lip-from`'s
   two, out of reach anyway) - `addVentRun()` stands a wall on each lip's
   long edges from the lip's top up, and the mantle onto the lip from
   beside it went through the wall. 146 -> 139 approaches within reach;
   22 stacked climbs by the rule, the same 22; the census's 57 tops all
   still climbed. Spec 20.10.
7. *The checks.* tests/feel.js: `a-vault-carries-the-speed-you-brought-to-it`
   (a walk and a sprint from a 4m runway the finder proves clear, pressed
   when the face is in the probe's distance),
   `a-landing-is-heavier-the-further-you-fell` (three falls at a sprint,
   the ratio on the landing step, the hold and the recovery, the dip and
   the squash from the rig and the mesh, and a hop that dips nothing),
   `the-camera-dips-on-a-climb-and-comes-back` (a held mantle, a tapped
   grab, the pull-up, standing still),
   `a-jump-pressed-just-before-landing-still-fires` (inside and outside the
   window, in a fall and in a vault, and spent by a scuff). tests/hang.js:
   `a-hang-is-at-full-stretch-under-the-lip`. tests/traversalfuzz.js:
   `traversal-fuzz-ten-thousand-steps-never-sticks` - every episode starts
   at a spot the rule names (`map._supportApproaches`, 139 of them), facing
   the face with a little yaw jitter, and drives one of twelve behaviours
   through real key codes (hold-climb, tap-hang-drop, tap-hang-pull, two
   shimmies, sprint-jump, jump-back, crouch-off, spin-jump, crouch-jump,
   slide-in, mash) for 60 to 150 steps; "stuck" is defined: a traversal
   state past 41 steps, a hang with no ledge, three seconds airborne, at
   rest inside a solid, below the floor, not finite. 10,000 steps, 95
   episodes, 2,726 steps mid-move, 73 hanging, 77 episodes reached the top,
   states [air grab ground hang mantle slide vault], nothing stuck. And
   `after-any-traversal-the-body-can-be-put-back-on-the-ground`: 139
   episodes, one per approach, every behaviour in turn, and after each one
   nothing pressed (crouch from a hang) has the body grounded within 3s -
   139 of 139. CONFIG is frozen, so the A1 lesson is met by comparing two
   inputs that differ only in what the number acts on (a walk and a
   sprint, a hop and a fall).
8. *Housekeeping.* `agentslide.js` split from agent.js (601 -> 546; the
   600-line guard would have gone red). `findGroundLedge({hangable})` also
   requires the pull-up to clear, or the hang checks pick the gantry face
   and wait for a pull-up that cannot come. `findTallFace` exported from
   tests/scuff.js. The runner takes `--details FILE` and writes every
   check's id, outcome and detail per run - the readings above; the stdout
   report only ever carried what was red.

**Verified.**

- Subset while iterating: the two frozen-CONFIG halves of the feel checks
  threw and were replaced by the two-input comparisons; the hang check's
  first cut pressed Space with the edge never cleared (30 scuffs, and a
  drop that re-grabbed every 0.3s - the check's stale press, not the
  game); the first rise clause (the crouched capsule over the *spot* at the
  landing height) refused `fire-escape-1` from `fire-escape-0`, because
  `fire-escape-2` is 3.0m over the spot and a body risen in place would
  meet it - but the body does not rise in place, it goes up the diagonal,
  and the path sweep clears the flight and refuses the gantry.
- Full suite, `npm run suite`: **137 passed, 1 failed** both runs (408s,
  443s), the frame budget skipped headless, 0 red, 0 flaky, 0 console
  errors, 0 context losses, 0 loop frames; every B8 check's detail line
  identical between the two runs (`--details`). Census 57 of 57; the rule's
  139 of 139 approaches climbed; `a-mantle-never-passes-through-a-solid`
  139 approaches, 4 duct presses all scuffs; the input fuzz reached
  [air ground slide] as before.

**Not built.** A geometric clause in the B5c check for the gantry case (B8b,
queued). Anything the hanging body does that the rig cannot show - a
one-handed hang, a swing. The buffer's window itself is not retuned: 0.12s
is seven steps and nobody has felt it long or short.

**Left.** B9 (close) is next. D29 has the numbers to turn. The nine climbs
the sweep removed were through solids; if one of them was a route somebody
meant, the map is where it is fixed, not the sweep.

## B9 — close: the redesign amended into the spec, and the Warden watched on its ground (2026-09-14, same run)

The second job of the 17:00 run, after B8. B9 was the plan's phases 47-50
in one S job: amend Sections 5 and 6.1 via Section 20, re-sweep the
regression set, a Warden sanity check driven by the AI and not re-derived,
the done-definition check updated, the README to match.

**Built.**

1. *Spec 20.11.* What Sections 5, 6.1, 16 and 18 now read as, in one
   entry, pointing at the pieces (20.2, 20.4-20.10): the markings table
   withdrawn in full and replaced by material and light; the traversal
   line rewritten round the eight declared routes; the three band rows of
   6.1 withdrawn for one reach rule, the press, the hang as a held option,
   the tell, the feel and the Warden's ground; check 6 and check 26 of
   Section 16 rewritten for what they now test and which AUTO checks hold
   them; the regression set widened; the definition of done made to
   include the rule. Nothing above Section 20 was edited.
2. *The regression set re-swept.* Section 16's numbers were written for
   marked bands; `CONFIG.debug.regressionChecks` names the redesign's
   contract by id - the census, the rule with no exceptions, every
   approach climbed, the routes, a mantle through nothing, the tap and the
   hold, the tell, the Warden on its ground, the traversal fuzz - and
   `runRegressionSet()` runs them with the numbered set: 20 checks by
   number, 29 with the ids, of 139. `the-regression-set-resolves-to-real-
   checks` requires every id to be a registered check and the union to
   still be a proper subset, so a renamed census cannot quietly leave the
   set. `U` in the README says so.
3. *`the-warden-never-leaves-its-ground`* (tests/wardenground.js). A1's
   ground is data; this does not re-derive it. It plays: 20s of patrol,
   20s of the Shade dropped five metres from the Warden and sprinting in
   circles (SUSPICIOUS, INVESTIGATE, SEARCH - the phase must have moved the
   AI, or it says so), then a plant at site A off the ring and 30s of the
   AI walking its last leg and defusing (DEFEND). 4,200 steps through the
   real fixed step, and on every one the Warden's feet are on
   `map.wardenGround`: standing, a floor of its column or of a cell within
   one cell's reach, within a step; airborne, the same no more than a
   metre below the feet - walking *down* a stair at 3 m/s the Warden
   clears a 0.4m tread before it has fallen 0.3m and lands two down, so a
   descent is a series of short falls over ground a little under the feet
   (136 of the 4,200 steps), and a deck edge is six metres of nothing.
4. *What it found, first cut.* The Warden **walked off the deck**. Left on
   the deck by the hunt, handed the plant, it planned a route that began
   at `corridor-n` - a ground node six metres below it and three metres
   over - walked the deck above that ground route, and at the last leg
   stepped off the edge into the hall void and fell six metres onto site A
   (where, being unhurt, it began defusing). `_pathTo()` asked
   `nearestWaypoint()` for the node nearest the Warden's *centre*, and the
   "own floor" preference A8 wrote there is two steps (0.7m) of height,
   which a centre a metre above its feet never satisfies; so the nearest
   node anywhere won, and from the deck that is the corridor. The goal
   end was already a foot position. `_pathTo()` now asks from the feet.
   Reverting that one line puts the check red at "defend, step 549: the
   Warden's feet are off its ground at (-9.32, 5.87, -3.92)".
5. *README.* The climbing section rewritten to what the game does now:
   material and light instead of markings, the press, vault and mantle,
   the tell, the hang at full stretch, the buffer, the landing, the Warden
   grounded, and where the numbers are.

**Verified.**

- Subset: the new check, every `ai-*` check, both plant-route checks, the
  regression-set check, the live-match and whole-match soaks and the
  state-machine collisions: 13 of 13 after the fix (the AI's route to the
  room-A sample still tails in 2 segments; the 366 legal plants still
  routed).
- Full suite, `npm run suite`: **138 passed, 1 failed** both runs (392s,
  449s), the frame budget skipped headless, 0 red, 0 flaky, 0 console
  errors, 0 context losses, 0 loop frames; the Warden check's detail
  identical between the runs.

**Not built.** Section 16's HUMAN checks stay HUMAN; 20.11 says which
AUTO checks hold the rewritten 6 and 26 and leaves "does it read" to Josh.

**Left.** Block B is closed but for B5b (D25), B5d (D27) and B8b. Block C
(playable and testable) is next: C1, the playtest build with the debug
gate off by default.

## B8b — the B5c check asks the gantry case of the geometry (2026-09-15, scheduled run)

The first job of the 02:00 run. B8 swept the way up (`riseIsClear`,
climbprobe.js) and nine approaches went - one under the hall gantry and
eight through the walls that stand on every low duct lip's long edges.
B5c's check `a-mantle-never-passes-through-a-solid` asked the geometry
about a solid *under* the landing and could not see any of those nine: a
duct wall and the gantry are *above* the landing, and the body goes
through them on the way. Until now only tests/hang.js drove one such face,
and the sweep itself was the only thing that said the other eight were
refused for a reason.

**Built.**

1. *The rule can be asked without the sweep.* `supportApproaches(collision,
   box, { sweep = true })` in mapclimb.js; `sweep: false` leaves out
   `riseFits` and names what the rule named before B8. `GameMap.
   _supportApproaches(box, opts)` passes it through. Nothing in the game
   asks for it; the derivation, the census and every other check call it
   as before.
2. *The geometric clause* (tests/routes.js, the same check). For every
   wide solid, every approach the unswept rule names - 159 today - is
   handed to `riseThrough()`: the crouched capsule along `movePath` from
   the spot to the landing (the same start and end `riseFits` uses), 16
   samples to the sweep's 6, and at each an AABB overlap written by hand
   against every solid whose top is above the landing's. No call to
   `riseIsClear`. The two must agree exactly, both ways: an approach the
   rule names that the geometry sends through a solid is B8's bug back; an
   approach the sweep refuses with nothing in the way is a rule that has
   grown an exception. 159 asked, 9 refused, 150 named, no disagreement.
3. *The controller clause.* At each of the nine, `driveAtFace()` stands
   the body on the support at the spot, faces the face and holds W and
   Space with the press repeated for 90 steps, and requires a scuff with
   the feet never over the top. All nine scuff: the eight duct-lip side
   faces from the ground beside the mouths (the two on
   `vent-up-vault-lip-from` are out of reach from the corridor floor and
   scuff as "too tall"), and hall-container's +z face from the ground
   under gantry-hall, where the body hangs and its pull-up scuffs. A
   refused set that came back empty is itself a failure - the controller
   clause would have proven nothing.
4. *The list.* The F4 log carries every refused approach with its
   solid and the highest the feet got; the detail line groups them by the
   box climbed (the runner cuts a detail at 400 characters, and the full
   form was 480): `vent-low-north-lip-to +z/-z, vent-low-south-lip-from
   +z/-z, vent-low-south-lip-to +z/-z, vent-up-vault-lip-from +x/-x (out
   of reach), hall-container +z through gantry-hall` - B8's nine, by name.

**Verified.**

- Two mutations, each run against the subset and reverted: the rule's
  sweep off (`if (false && !riseFits...)`) puts the check red at every
  duct lip with "the rule names it and the body rises through
  vent-low-north-wall-b"; the controller's sweep off (`_climbOnto` without
  `riseIsClear`) puts it red with "the controller got the feet to 2.44m,
  over the 2.30m top, through vent-low-north-wall-b". Each side holds the
  other.
- Subset, the check alone: green, 1.6s.
- Full suite, `npm run suite`: **138 passed, 1 failed** both runs (386s, 441s), the frame budget skipped headless, 0 red, 0 flaky, 0 console errors, 0 context losses, 0 loop frames; the check's detail identical between the runs.

**Not built.** The runner's 400-character detail cap was left alone; the
check's detail was fitted to it instead (399 characters), and the F4 log
has the long form.

**Left.** Block B is closed but for B5b (D25) and B5d (D27), both waiting
on Josh. Block C is next: C1, the playtest build with the debug gate off
by default.

## C1 — the playtest build: the debug gate is off by default (2026-09-15, same run)

The second job of the 02:00 run, after B8b, and the first of Block C. What
you got by opening the page was the debug build: `DEBUG = true` in
config.js, F3 and F4 live, every test key a press away from teleporting the
Shade or planting the charge. Section 17.1 said *"defaulting to true during
development"*; a playtest is not development.

**Built.**

1. *The gate is a live setting.* `DEBUG` is gone; `SETTINGS.debug`, seeded
   `false` from `CONFIG.settings.defaults.debug`, is the gate, and the
   three places that read the flag (`main.js`: the F3 fields and the
   assertions in the step; `ui/debug.js`: the overlay refresh, `pollKeys`,
   the assertion step; `matchstate.js`: `?mode=freeroam`) read it live.
   `debugRequested(search)` in config.js reads `?debug=1` (or `debug=true`)
   and main.js sets the gate from it before `bootstrap()`; the settings
   menu has a *debug tooling* row (`#bl-dbg`, on/off) that flips it at any
   time. Off with a panel up - the settings row mid-match - the next
   frame's `debugTools.update()` takes both panels down (`hidePanels()`).
2. *The harness is always there.* `window.BLACKLINE` is set in both builds:
   it is the AUTO suite's way in, and `AutoSuite.runChecks()` turns the
   gate on for the length of a run and puts it back as found, the way it
   does the loop (F4) - so `npm run suite` needed no URL change, a
   playtest tab that ran the suite from the console is a playtest tab
   after, and every check that presses F4 through the real path still
   does. The console banner prints only under the gate.
3. *`resetSettings()` resets the gate too*, which is right - it is a
   setting - and `match-length-reaches-the-scoreboard` (tests/settings.js)
   calls it mid-suite: it now snapshots the gate and puts it back, or every
   check after it that presses F4 presses a dead key. Not a weakening: the
   check still requires every default restored, the gate included (six
   values now).
4. *`panels.js`.* main.js went to 603 with the gate and the handle, and
   HANDOFF said the next job that touched it splits rather than adds. The
   HUD, the scoreboard and the menu, and what their buttons do, moved out
   as `createPanels({ initMatch, setPaused, objective, audio, match })` -
   getters for the live objects, as wiring.js does, because the menu is
   built before the first match. main.js is 583.
5. *The check* `with-the-debug-gate-off-every-debug-key-does-nothing`
   (tests/debuggate.js): the default is false; `debugRequested` reads the
   URL forms and refuses `debug=0`; the settings row turns the gate on and
   off; then with the gate ON, F3 shows the overlay, F4 opens the panel and
   T changes the time scale (so a dead key cannot pass as gated) and
   `?mode=freeroam` boots free-roam; then with the gate OFF and the panel
   left open, all 15 debug keys pressed through `pollKeys()` change nothing
   - the Shade's position and health, god mode, the time scale, the AI
   state, the plant, the ground overlay, the panels and the F4 log as one
   snapshot - Y and U start no suite (spied), free-roam does not boot, and
   a frame takes the panels down in state and in the DOM. Everything it
   touches is put back in a `finally`.
6. *README* (the playtest build and the debug build; `?debug=1` in the
   seed example; the tooling section rewritten), **spec 20.12** (17.1
   amended: the gate, its two switches, what off means, the handle in both
   builds).

**Verified.**

- Subset (the new check, the 600-line guard, the settings checks, the
  ground overlay's F4-then-N, the HUD read, free-roam, the regression-set
  check): 9 of 9.
- Mutation: `pollKeys()` without the gate puts the check red at "with the
  gate off, F3 changed something: ... overlay true panel true"; reverted.
- Full suite, `npm run suite`: **139 passed, 1 failed** both runs (394s, 426s), the frame budget skipped headless, 0 red, 0 flaky, 0 console errors, 0 context losses, 0 loop frames.

**Not built.** Nothing hides the harness from a playtester who opens the
console; the queue did not ask and the suite needs it. `PLAYTEST.md` is
C6's, and C6 says every C job updates it once it exists.

**Left.** C2 (the round-start briefing and controls card) is next.

## C2 — the round opens on a briefing (2026-09-15, scheduled run)

The 17:00 run. The playtest build opens on the main menu, and Play dropped
you into the turbine hall with no word of what to do or which key does it;
the README had the controls, the game did not. Block C's second job.

**Built.**

1. *`ui/briefing.js`.* A DOM card in the scoreboard's style: the round
   number (or *Free roam*), *you are the Shade / Warden*, the objective in
   one line, the sites, the controls, and *any key to start*. The numbers
   are the round's own - `CONFIG.round.plantHoldTime`, `detonationTime`,
   `defuseHoldTime`, `duration`, `CONFIG.shade.lives` - so the card cannot
   drift from the rule; the sites are `map.sites` as `A Turbine Hall · B
   Loading Bay · C Server Vault`; the controls are read from
   `input.bindings` through `keyLabel()` (`KeyW` → `W`, `ControlLeft` →
   `Ctrl`, `Mouse0` → `LMB`), every binding of an action shown, so a rebind
   shows the key you would press. Per role: the Shade's card lists crouch,
   jump/climb (tap to hang, hold to go over), plant, knife, smoke/flash/
   taser; the Warden's lists fire, aim, reload, defuse (only with the
   objective on), stun/frag/alarm; both list move, look, sprint, pause. The
   Warden's card is in the Warden's orange.
2. *Where it is raised, and where it is not.* `panels.js` calls `brief()`
   after `initMatch` in the three handlers that are a player's way into a
   round - Play, Free roam, Next round - and nowhere else. `initMatch` does
   not know it exists: every AUTO check calls `initMatch`, and a card that
   went up on each would hold every check. The suite sees it only when a
   check presses the button, and `resetPresentation()` (harness.js) takes
   it down before every check with the menu and the scoreboard.
3. *It holds the round.* In `renderFrame` (main.js) `held = paused ||
   briefing.open` feeds the step planner nothing, as the pause does, and
   clears the edges; the HUD is not drawn behind it. The dismissal is read
   in the frame before the pause key, from `input.pressedCodes` - any code,
   keyboard or mouse - and `briefing.dismiss(input)` hides the card and
   `clearAll()`s the Input, so the Space that took the card down is not the
   round's first jump and an Esc is not a pause. The same frame then steps
   the round: "within one step" is literal. Eleven lines in main.js (594).
4. *The setting.* `SETTINGS.briefing`, seeded true from
   `CONFIG.settings.defaults.briefing`; the settings menu's *round briefing*
   row (`#bl-brief`) flips it; off, `brief()` returns and the click starts
   the round.
5. *Found: Next round started round 1 again.* The intermission's button
   called `objective.resetRound()` (number + 1) and then `initMatch`, which
   called `objective.resetRound(1)`. The HUD's `r1` never moved and the
   scoreboard's round column was `1, 1, 1`; no check went through the
   button. `resolveMatchOptions` has `round: 1`, `initMatch` passes it to
   `resetRound`, `createMatchState` records it as `roundNumber`, and the
   button passes `objective.round.number + 1`. The card said *Round 1* for
   round 2 and that is how it was seen.
6. *Two checks*, tests/briefing.js, both through the real buttons
   (`button.click()`) and the real key path (`press()` into
   `pressedCodes`, then `renderFrame`):
   `a-round-opens-on-a-briefing-that-any-key-dismisses` - Play raises the
   Shade's card and it carries the role, `W A S D`, `Shift`, `Esc`, the
   three sites by id and name, *Round 1*, `E`, `4 seconds`, `45 seconds`,
   `3 lives`, `Space`, `F`, `Ctrl`, and not *reload*; five frames with W
   held and no press move neither `clock.sim` nor `round.elapsed`, the
   card stays, the HUD is hidden; a Space takes it down in one frame, that
   frame steps, the Input is empty after, the Shade's feet and vertical
   speed say it was not a jump, the HUD is back. Free roam raises the
   Warden's card (`LMB`, `RMB`, `R`, *free roam*, *no clock*, no *plant*)
   and `Mouse0` takes it down. Play again and `Escape` takes it down
   without pausing or raising the menu.
   `the-briefing-follows-the-round-and-the-setting-skips-it` - round 1
   from Play, its clock run out through the step, the intermission up,
   Next round: round 2 in the objective and the match record, the score
   kept, the card says *Round 2*; the settings row turns the setting off
   and on; off, Play raises no card and the first frame steps, and Next
   round raises none and starts round 2.
7. *Spec 20.13* (Section 13 gains the briefing; the round-number fix),
   *D30* (provisional: the hold, the press spent, the wording, every
   round), *README* (a paragraph under Controls).

**Verified.**

- Subset (the two new checks, the debug gate, the HUD read, the 600-line
  guard, the difficulty presets): 6 of 6.
- Mutation: `held = paused` alone puts the first check red at "shade: the
  simulation ran 0.083s behind the card; shade: the round ran behind the
  card; warden: the simulation ran 0.083s behind the card"; reverted. (The
  revert was a `git checkout` of main.js, which also took C2's edits with
  it; re-applied from the patch scripts, subset green again, 594 lines.)
- Full suite, `npm run suite`: **141 passed, 1 failed** both runs (405s,
  455s), the frame budget skipped headless, 0 red, 0 flaky, 0 console
  errors, 0 context losses, 0 loop frames.

**Not built.** No pixel check: the card is DOM over the canvas, as the menu
and the scoreboard are, and `readPixels` cannot see it; the check reads
the words. Nothing shortens the card after round 1; the setting is the way
off. `CONFIG.round.roundEndDelay` is still read by nothing (noted on C4).

**Left.** C3 (hit and damage feedback) is next; then C4, which the
round-number fix and the `roundEndDelay` note feed.

## C3 — hit and damage feedback, in the frame (2026-09-15, same run)

The second job of the 17:00 run, after C2. Getting shot in Blackline was
a number on the health bar and a HUD line; landing a knife was the
Warden's health in the kill feed. Block C's third job: a hit marker, a
damage direction, a vignette by lost health - and, the queue said, pixel
checks for each with `brightnessDelta` proving the vignette.

**Built.**

1. *In the frame, not the DOM.* `readPixels` cannot see a DOM overlay (the
   HUD's flashbang white is one), so `systems/feedback.js` draws all three
   with the renderer: one full-screen quad, a `ShaderMaterial` whose vertex
   shader passes clip coordinates straight through - no camera, no FOV, no
   aspect, `frustumCulled` off - drawn last with no depth test. The
   fragment shader composites three layers with a straight-alpha `over`:
   the vignette (`smoothstep(vignetteInner, vignetteOuter, |ndc|)` times
   `vignetteMax` times health lost), the direction arc (a ring at
   `indicatorRadius` in aspect-corrected half-heights, `indicatorArc`
   either side of `dirAngle`), the hit marker (four diagonal strokes,
   `|abs(x)-abs(y)| < thickness` between `hitMarkerInner` and `Outer`).
   Every number is `CONFIG.feedback`. `mesh.visible` is false whenever all
   three are zero, so the idle cost is no draw call; `warm(renderer,
   scene)` compiles the program at boot, because the soak counts
   `renderer.info.programs` before and after a match and a program first
   compiled when the Shade is first shot is a leak to it. The first
   `ShaderMaterial` in the project.
2. *What it listens to.* `combat:damage` for the human's actor with an
   `at` sets the arc's source; `frame:render` runs the clocks and writes
   the uniforms, the bearing recomputed every frame as `atan2(x, -z)` of
   the source in camera space (`camera.worldToLocal`), so the arc stays on
   the source as the camera turns; `combat:knife-hit` and `gadget:taser`
   mark for the Shade, `combat:impact` on the Shade marks for a human
   Warden; `match:init` resets. The vignette reads the human actor's
   health each frame and is nothing while dead - the death camera's view
   is not the body's.
3. *Where damage comes from.* `combat:damage` carried `at` only for the
   knife on the Warden (the AI's reason to break off DEFEND). The rifle
   now passes its muzzle (`this._origin`) as `from` for the Shade; the
   frag's `gadget:damage` carries the blast `at` and wiring passes it
   through `combat.applyDamage(actor, amount, who, kind, from)`. The AI's
   listener filters on `target === 'warden'`, so nothing there moved.
4. *`boot.js`.* main.js was 594 and HANDOFF said the next touch splits it.
   `bootstrap()`'s body is `bootWorld({ emitter, debugState, harness,
   initMatch, setPaused, setTimeScale, match })`, which builds the world
   in the same order and returns every singleton for main.js to
   destructure into its lets; main.js keeps the match, the loop, the step
   and the frame. main.js is 470; boot.js 183. The "moved method references
   a module constant" trap was checked by hand (`CONFIG`, `Shade`,
   `Warden` imported; `objective` and `input` late-bound as lets, as they
   were).
5. *Three checks*, tests/feedback.js, each reading the framebuffer
   between two `renderer.render` calls with no simulation step between
   them, so the only thing that can differ is the feedback
   (`feedback.update(0)` settles the uniforms; forcing a timer to 0 is the
   "without" frame):
   `the-vignette-deepens-with-lost-health-and-leaves-the-centre-alone` -
   the Shade at site A (somewhere lit: a red over the dark apron reddens
   black, which is not darker), `combat.applyDamage` to half then to a
   tenth, the changed pixels reach every edge, the centre 40% is
   untouched, `brightnessDelta` over the frame's outer 10% band is under
   -8 at half and at least 1.3x that at a tenth (-11.6 and -20.8), the
   deeper vignette reaches at least as many pixels, and at full health
   after a new match the quad is invisible and a forced draw of it changes
   no pixel.
   `a-landed-knife-puts-a-hit-marker-at-the-centre-and-a-miss-does-not` -
   the Warden in front at 1.2m, F into `pressedCodes`, one step: the
   Warden's health drops, the marker's clock starts, the difference
   against the same frame with the clock at 0 is centred within 4px of
   the screen centre, no wider than `hitMarkerOuter` (45x45 px of 720),
   hundreds brighter; `update(hitMarkerTime + 0.01)` runs it out; the
   Warden out of range, F again, no clock starts.
   `damage-draws-an-arc-toward-where-it-came-from` - `applyDamage` with a
   source 6m along each of the camera's own axes, health held at 90 so
   the vignette is the same in every frame: the arc's pixels are entirely
   right of centre, entirely left, entirely below (behind) and entirely
   above (ahead), each ~2550 px at 0.31-0.32 half-heights from the centre
   against `indicatorRadius` 0.32; no source, no arc; gone after
   `indicatorTime`.
6. *Spec 20.14* (Section 13 gains the three), *D31* (provisional: drawn in
   the frame, the sizes, the colours, red not black, nothing while dead),
   *README* (a paragraph under Controls).

**Verified.**

- Subset (the three new checks, the briefing pair, the knife
  classification, the visibility feedback, the 600-line guard): 8 of 8
  after two rounds on the vignette's instrument - the first measured
  darkening over the changed mask at the dark spawn (-8.4 vs -12.1, no
  clear step), the second over the outer band somewhere lit.
- Mutation: the arc's bearing mirrored (`atan2(-x, -z)`) puts the arc
  check red at "right: the arc is not entirely right of centre ...
  cx 526.5; left: ... cx 752.5" - the two swapped; reverted.
- Full suite, `npm run suite`: **144 passed, 1 failed** run 1 (432s), **144 passed, 1 failed** run 2
  (461s), the frame budget skipped headless, 0 red, 0 flaky, 0 console
  errors, 0 context losses, 0 loop frames.

**Not built.** The human-Warden hit marker (`combat:impact` on the Shade)
has no check: a Warden with an opponent is not a configuration the menu
offers, and emitting the event by hand spawns effects' sparks with it. One
arc, the latest source; a frag and a rifle from two sides show one. The
HUD's flashbang white stays DOM; it was never asked to be measured.

**Left.** C4 (round and match end screens) is next; then C5, C6.

## C4 — the round and match end screens say how (2026-09-16, scheduled run)

The 02:00 run, gate green at 144/1. The intermission said `Round 2 to the
warden` over a reason string and a table; the match screen was the same
with a different heading; both went up in the very step the round ended,
over whatever killed you, and `CONFIG.round.roundEndDelay` (2.5s) was read
by nothing. Block C's fourth job: who won, how, a five-line timeline, the
delay honoured, and Play resetting the score itself.

**Built.**

1. *The outcome is a word the objective records.* `OUTCOME`
   (detonated / defused / eliminated / time) beside `CHARGE` and `ROUND`;
   `_end(winner, reason, outcome)` records it on the round and in the
   round record, and the `objective:round-end` event carries it. The
   reason strings are untouched - `a-full-best-of-five` compares them
   by value - and the fuzz's `_end('warden', 'test')` records no outcome,
   which the screen prints as the reason. The vocabulary and
   `createRoundState` moved to `systems/roundstate.js` (99 lines) when
   objective.js reached 602; objective.js re-exports them and is 521.
2. *The timeline is the objective's own log.* `round.timeline` is
   `{ t, text }` from `round N begins` at 0: the plant (`charge armed at
   A`), each life lost (`life lost - 1 left`), each reinsert, each Warden
   down (`warden taken down` for a takedown), and the end (the reason).
   `_log()` stamps `round.elapsed`; the record takes a copy. Nothing the
   objective does not hear is on it - the alarm and the first sighting
   belong to detection, and would need the wiring to log them (D32).
3. *The delay.* `step()` on an ended round runs `_stepEnded(dt)`:
   `endTimer` (set to `roundEndDelay` by `_end`) counts down on the sim
   clock and, once, emits `objective:intermission`. The wiring shows the
   scoreboard on that event and not on `round-end`; `round-end` puts one
   line on the HUD (`round 1 to the warden - the clock ran out with no
   plant`, `sayOutcome()` from ui/scoreboard.js). The death camera moves
   to the intermission too - and that fixed something: the objective
   subscribes to `combat:death` before the wiring does, so on the third
   life `round-end` restored a death camera the wiring had not yet
   begun, and the camera then stayed on the killer under the card until
   the next `initMatch` or the 16.5s wall-clock guard and its
   `console.warn`. Now it stays for the 2.5s and the intermission takes
   it down; the check asserts both.
4. *The screens.* `ui/scoreboard.js`: the heading is `round 3 to the
   warden · the Warden defused the charge` (or `warden wins the match ·
   1 clock, 1 defused, 1 eliminated`, a tally of the winner's rounds), in
   the winner's colour; the timeline as an `<ol>` with the round's clock
   on each line, `timelineLines()` printing all of it up to
   `TIMELINE_LINES` (5), else the first and the last four; the table has
   a *how* column. `first to N` stays. The wording is one table,
   `OUTCOMES`, exported as `sayOutcome(outcome, reason)`.
5. *Play is a fresh match.* `panels.js` `onPlay` calls
   `objective().resetMatch()` before `initMatch(COMPETITIVE)`. Every route
   back to the main menu already reset, so nothing changed for the
   player; a check now holds it on its own.
6. *Two checks*, tests/roundend.js.
   `the-end-screen-says-who-won-and-how-each-way` plays one match of four
   rounds through the objective's step: the clock (`timeRemaining` 0.5
   and stepped), a plant at A and the fuse run down, a plant at B with
   the Warden on the charge and `sees` false for the hold, and three
   deaths each through the real 15s reinsert countdown. After each end:
   the outcome on the round and the record, the record's timeline,
   nothing on the screen in the ending step nor one real step later
   (`h.stepFrames` - fixedStep, objective, wiring), the death camera on
   the killer during the delay for the third-life round, the screen up
   after `ceil(2.5/dt)` more steps with the death camera down; then the
   text: `round N to the <winner>`, the sentence, the score with its
   dash, the timeline's line count equal to `min(5, record.timeline
   .length)` (2/3/3/5 - the elimination round logs seven), its first
   line the round beginning, its last the reason, the plant or the last
   life on it, a clock on every line; the last table row's number and
   winner; and on the fourth round, which ends a first-to-3 for the
   Warden 3-1, `warden wins the match`, the tally words and the Main
   menu button. `SETTINGS.matchLength` pinned to the default for the
   run and restored.
   `play-from-the-main-menu-starts-a-fresh-match` puts a round on the
   books through the step, starts round 2, raises the main menu with
   `menu.show('main')` - the one route that resets nothing - and clicks
   Play: 0-0, no records, round 1, the charge carried, the match not
   over. Reverting the `resetMatch()` in `onPlay` is a 1-0 on the card.
   `the-briefing-follows-the-round-and-the-setting-skips-it` steps
   `2 + ceil(roundEndDelay/dt)` before looking for the intermission
   (it stepped 1); the first cut stepped `1 + ceil` and 150 × 1/60 did
   not reach 2.5 in floating point.
7. *Spec 20.15*, *D32* (provisional: the delay, the death camera through
   it, the sentences, the five-line rule, the match tally), *README*
   (a paragraph under Controls after the briefing's).

**Verified.**

- Subset (the two new checks, the briefing pair, best-of-five, the defuse
  check, match length, the 600-line guard, the death camera pair): 12 of
  12 after two fixes - the timeline `<li>` printed `0:00round 1 begins`
  with no space between the span and the text, and the briefing check's
  step count above.
- Full suite, first pass: 145 passed, 2 failed both runs, one red both
  times - `the-state-machines-survive-each-other`, "the death camera
  outlived the round". Its *round ends while awaiting reinsert* scenario
  killed the Shade, ended the round by hand and expected the camera gone
  60 steps later; the round has a 2.5s tail now and the camera holds the
  killer through it by design (D32). The scenario asks more than it
  did: the camera still up at 60 steps, and gone `ceil(2.5/dt) + 2`
  steps after the end. Not loosened - the moment it measures at moved
  with the rule, and it gained an assertion.
- Full suite, `npm run suite`: **146 passed, 1 failed** run 1 (429s), **146 passed, 1 failed** run 2
  (495s), the frame budget skipped headless, 0 red, 0 flaky,
  0 console errors, 0 context losses, 0 loop
  frames.

**Found.** `the-death-camera-frames-the-killer` (tests/visual.js) is red
run alone - `--subset "death-camera-frames"` on HEAD before this job, the
same detail: *the killer covered 0 pixels; the ragdoll moved 0.000* - and
green in the full suite, so it is inheriting something from a check
before it. The same shape as the F2 lesson. Queued as F5, a gate job; not
touched here, it is not this job's.

**Not built.** The HUD line at the round end has no check of its own (the
feed is DOM and the screen's text is the proof the queue asked for). One
timeline, the objective's; the alarm and the sighting are not on it.

**Left.** F5 (the visual check red alone) is next, then C5 (the
difficulty pass), C6.

## F5 — the death-camera pixel check warms its own view (2026-09-16, same run)

The second job of the 02:00 run, after C4, which found it: C4's subset
runs put `the-death-camera-frames-the-killer` (tests/visual.js) red -
*the killer covered 0 pixels; the ragdoll moved 0.000* - and it was red
alone on HEAD before C4 too, green in the full suite. The F2 shape.

**Found.** Not a HUD or a menu this time: the clock. Instrumented, the
check's first `grab()` - `deathCam.step`, `renderer.render`,
`readPixels` - took 38.4s, all of it in the `readPixels`, which blocks
until the software renderer has finished the draw, and that draw was the
first of this view: the Shade and the Warden stood at site A, which the
runner's 60 warm frames at the spawn never look at. SwiftShader compiles
what it has not drawn, and headless on this machine that was 39s. The
death camera's wall-clock guard (`reinsert.wallClockGuard`, 16.5s,
Section 15, measured on the wall clock on purpose) fired inside the
read: `forceReinsert`, the Shade back on a spawn with no ragdoll, the
camera restored to the origin, and the two grabs after it (0.57s each,
warm now) read a view with no killer in it. In the full suite the
vignette check (C3) and others had stood at site A first and paid the
compile; alone, this check paid it under the guard. Moving one
`renderFrame` + `readPixels` to before the kill moved the 39s with it
(`warmMs` 39058, the grabs 580/558/539ms, no guard).

**Built.** The check warms its own view before the kill - one
`h.renderFrame(1/60)` and a `readPixels`, with the reason in a comment -
listens for `deathcam:guard` for the length of its reads and names the
guard in its problems if it fires (before, a guard under the reads was
inferred from two wrong numbers), and reports the warm time in its
detail (`the view warmed in 38.5s before the kill`). No threshold moved,
nothing skipped. HANDOFF gains the trap: a wall-clock guard and a cold
view do not mix.

**Verified.**

- Alone, `--subset "death-camera-frames"`, twice: green both, `the killer
  covers 54753 pixels, centred within 0% of frame centre; the body
  tumbled 2.83 then froze`.
- Full suite, `npm run suite`: **146 passed, 1 failed** run 1 (419s), **146 passed, 1 failed** run 2 (473s),
  the frame budget skipped headless, 0 red, 0 flaky, 0 console errors,
  0 context losses, 0 loop frames. In the full suite the view warms in
  0.8s - already compiled by the checks before it.

**Left.** C5 (the difficulty pass) is next; then C6. Every other pixel
check that starts a guarded state should be read with this in mind; none
does today (the finisher's guard is under combat's own check, which does
not read pixels).

## C5 — the difficulty pass, driven by the checks (2026-09-16, scheduled run)

The first job of the 17:00 run. The queue asked for time-to-detect and
time-to-kill measured per preset, a check that holds both monotonic
across the presets, and the values in `config.js` under `ai.difficulty`.
The values were there already - `fillRate`, `aimErrorDegrees`,
`reactionDelay`, medium's two being Section 11's - so the job was the
instrument, and the instrument found the gun.

**Built.** `tests/difficulty.js`, two checks.

- `each-difficulty-is-quicker-to-see-you-and-quicker-to-kill-you`: for
  each preset in `config.js` order, eight seeds, two ranges (8m and 16m,
  both inside `engageRange`), `engage()` stands the Warden at the south
  end of the Turbine Hall lane facing +Z and a lit, still Shade up it,
  holds the Warden's spot (and its facing until it engages), withholds
  the frag (`gadgets.loadout.frag = 0`: a 60-damage blast at the 2s
  static mark would put every preset at the same number), and counts
  steps from the first in view to ENGAGE (detect) and from ENGAGE to the
  death (kill). The comparison is paired - the same seeds for every
  preset - and the means must fall from each preset to the next, both
  numbers, at both ranges. Per-seed kills go to the F4 log; the detail
  line is `detect/kill hits/shots` per preset per range (the runner
  keeps 400 characters).
- `the-warden-fires-in-bursts-of-rounds-at-the-torso`: on the tightest
  preset at 8m, god mode on, 3.5s of ENGAGE (short of a magazine):
  `combat:shot` times grouped by the gun's own interval into bursts,
  every finished burst 3-7 rounds, every pause 0.25-0.7s, no two rounds
  faster than the gun; the `combat:impact` heights on the Shade average
  within 0.3m of the torso the eye sees; and the Shade's health stays
  100.

**Found, and fixed.** The first run of the first check: *0 of 52 rounds
hit at 8m* - on every preset, including hard - and the kill stalled at
30s.

1. **The gun was aimed at the feet.** `_stepEngage` faced `lastKnown`
   with the aim flag, and `lastKnown.y` is `shade.feetY` (the planner
   needs the floor). A round aimed at the floor line meets the floor at
   the same distance as the capsule's bottom face, and the floor wins;
   the ones that hit were the half of the spread that went up, and with
   the pitch bias drawn negative for the engagement, none. ENGAGE now
   aims `this._aim` at `lastKnown.y + height * torsoHeightRatio` - the
   same point perception sees - with no allocation per step. Aim fixed
   alone: easy 4.67s / medium 1.81s / hard 1.58s to kill at 8m (5 seeds),
   and the first round 0.3-0.6s after ENGAGE, which was wrong too.
2. **A burst was steps.** `_fireBurst` set `_burstRemaining` to 3-7 and
   decremented it every step it ran, so a burst was 3-7 sixtieths of a
   second - one round at 600rpm, sometimes two - then a 0.25-0.7s pause:
   about 100 rounds a minute, and 30s of ENGAGE fired 52. The AI now
   holds the trigger and counts `combat:shot` events for the Warden
   (subscribed beside the DEFEND break-off), starting the pause when the
   burst's rounds are out. `config.js` says "rounds per burst".
3. **The aim error was a pitch-only bias held for the whole engagement**,
   one `rng.unit()` at ENGAGE entry. One draw decided the fight and a
   bigger cone could be a luckier one (a +5 degree lift on an aim at the
   feet put easy's rounds in the body). `_drawAimError()` draws yaw and
   pitch, on entering ENGAGE and again for every burst, from the seeded
   stream (`_aimYaw`, `_aimPitch`; `_face` applies the yaw to the
   desired bearing and the pitch as before). A preset's degrees now
   govern its hit fraction.
4. **God mode did not cover the rifle.** Section 17.1 says the Shade
   ignores damage; `wiring.js` guarded `gadget:damage` (the frag) and
   nothing guarded `_stepWarden`'s `_damage`. It has been that way since
   the test commands were wired (`53808d6`) and nobody noticed while the
   rifle hit the floor; `the-warden-never-leaves-its-ground` sets it
   expecting to survive a 20s hunt. `Combat` takes `isGodMode` (boot.js
   passes the one reader of `debugState.godMode`) and `_damage` refuses
   for the Shade while it is set; the frag's guard in wiring.js is gone,
   `applyDamage` goes through the same `_damage`.

**Measured** (lit, still, frag withheld, 8 seeds; detect from the first
step in view, kill from ENGAGE):

| | 8m detect | 8m kill | 8m hit | 16m detect | 16m kill | 16m hit |
|---|---|---|---|---|---|---|
| easy | 7.35s | 0.86s | 26/52 | 13.63s | 7.21s | 34/249 |
| medium | 4.97s | 0.51s | 32/39 | 9.27s | 1.40s | 34/70 |
| hard | 3.60s | 0.35s | 32/32 | 6.73s | 0.93s | 38/50 |

Detect is the formula (reaction delay, then `fillRate * 0.68 * 0.8` per
second at 8m) and does not vary with the seed; kill does, by the burst
and the cone: hard's 0.35s is four rounds at 600rpm every seed, easy's
at 16m runs from 0.35s to 18.5s (a reload). The presets separate by aim
only at range and by the fill everywhere; at 8m hard and medium are a
machine. The preset values are unchanged; D33 records what was changed
instead and the line to turn if the Warden is now too deadly - it is
much deadlier than the one every playtest so far has had.

**Verified.**

- Alone, `--subset "bursts-of-rounds|each-difficulty"`: green, *20
  rounds in 3.5s as bursts of [6 3 7] with pauses of [0.32 0.58 0.38]s;
  19 hit at a mean height of 1.20m (torso 1.15m); health stayed 100
  under god mode*. The first check takes 20s (the 16m detect phases).
- Full suite once with the aim and the burst fixed, before the god-mode
  change: 147 passed, 1 failed (the frame budget, skipped), 0 red.
- Full suite twice, `npm run suite`: **148 passed, 1 failed** run 1 (428s),
  **148 passed, 1 failed** run 2 (503s), the frame budget skipped
  headless, 0 red, 0 flaky, 0 console errors, 0 context losses, 0 loop
  frames.

**Not built.** No preset value moved: the order the check requires held
once the gun worked, and the spread between presets is Josh's to widen
(D33 lists the levers). The check measures one lane and a still Shade;
a moving one, a crouched one and a dark one are the meter's and the
noise model's business and have their own checks.

**Left.** C6 (`PLAYTEST.md`) is next; it should tell Josh the Warden
shoots straight now.

## C6 — PLAYTEST.md, the notes Josh plays from (2026-09-16, same run)

The second job of the 17:00 run, after C5, and the last of Block C. The
queue asked for a file for Josh - how to run, what to look at, what
cannot be verified without eyes, known issues - updated by every C, D and
E job, linked from HANDOFF.md.

**Built.** `PLAYTEST.md`, 148 lines: *Run it* (the playtest build,
`?debug=1`, `?seed=`, the settings menu, Y and U from the F4 panel, the
*gl context lost* row to read before believing a red); *What to look at*
newest first - the Warden shooting straight (C5, with D33's table and the
warning that it is much deadlier than any playtest before), the briefing
and the end screens (C2, C4), the feedback (C3), climbing without
markings (Block B), where you may plant (Block A) - each naming the
checks that hold its mechanics and saying what is left for eyes; *What
cannot be verified without eyes* (the frame budget on a GPU and how to
run that check in a tab, looks, sounds, feel - spec checks 1-7 and 13-16
as the redesign rewrote them - and the Warden as an opponent); *Known
issues and open questions* (the defuse through the floor D27, the duct
roofs D25, the ring D8, hard a machine at 8m D33, settings apply at the
next match, the one expected console warning); *How to answer* (a line
under `decided:`; provisional decisions override the same way). README's
*Running it* and HANDOFF's first paragraph point at it.

**Check.** `playtest-md-exists-is-linked-and-names-real-checks`
(tests/donedef.js, beside the other definition-of-done readers): fetches
`PLAYTEST.md` from the origin the suite is served from, requires the four
`##` sections, takes every backticked kebab word of four or more parts as
a check id and requires it registered in `_autoTests` (a renamed check
would leave Josh a line that runs nothing), and requires `HANDOFF.md` to
mention the file. Seven ids named today, all registered. The file
missing, a section missing, a stale id or the link gone each put it red.

**Verified.**

- Alone, `--subset "playtest-md"`: green, *148 lines, the 4 sections, 7
  checks named and every one registered, linked from HANDOFF.md*.
- Full suite twice, `npm run suite`: **149 passed, 1 failed** run 1 (441s),
  **149 passed, 1 failed** run 2 (475s), the frame budget skipped headless, 0 red,
  0 flaky, 0 console errors, 0 context losses, 0 loop frames.

**Not built.** No section for the yard: there is no yard. D6 adds it.

**Left.** Block C is closed. D1 (map plumbing, M) is next, then D2 (the
yard blockout, L - a whole run).

## D1 — map plumbing: the registry, `?map=`, the suite per map (2026-09-17, scheduled run)

The first job of Block D and the 17:00 run. The queue asked for a
registry keyed by id, `buildMap(id)`, a `?map=` parameter, the menu
offering the list, every check parameterised over the current map, and a
second id that builds an empty ground plane and is reported per map.

**Built.**

- `src/maps/index.js`, the registry: `plant` ("Meridian Substation") and
  `yard` ("Container Yard"), in menu order; `mapIds()`, `listMaps()`,
  `mapEntry()`, `buildMap(id, { gradientMap })` (throws on an unknown id
  and on a map that calls itself something else), `requestedMapId(search)`
  (`?map=`, case-insensitive; an unknown id opens the default with a
  console warning - a playtest typo should not be a blank page - and the
  runner checks `map.id` against what it asked for so that fallback can
  never be a green run on the wrong map), `mapUrl(search, id)` (the
  query the menu's map row navigates to, keeping `seed` and `debug`;
  pure, so a check can ask it without leaving the page).
- `src/map.js` -> `src/maps/plant.js` (`buildPlantMap`), `src/mapdata.js`
  -> `src/maps/plantdata.js`. Section 3's "map.js" is the registry and
  its maps now (spec 20.17). `GameMap(gradientMap, id, name)` carries
  both; the site, the spawns and the ambient rig moved into the kit
  (`addSite` - the room by containment, the ring; `addShadeSpawn`,
  `addWardenSpawn`; `addLightRig` - the hemisphere, the one casting key,
  the fill) because the yard needs the same three and a second copy is
  how they drift. `validateMap(map, expects)`: Section 5's counts are the
  plant's promise (`EXPECTS` in plant.js, from `CONFIG.map`); the yard
  states its own. The JSDoc types that said `import('../map.js').GameMap`
  say `mapkit.js`, where the class always was.
- `src/maps/yard.js`: an 80 x 65 ground plane and the fence, three open
  bays declared as rooms (so each site has one; the entry derivation
  counts every open edge, honestly), a site at each centre, the Shade at
  the four apron corners outside the working yard (`map.shell`), the
  Warden at the gate and in each bay, a lamp over each site and one at
  the gate, eight waypoints in a ring through the bays. Five boxes,
  20,224 ground cells, 0 routes, builds in 137ms. Every number is a
  placeholder D2 owns.
- Boot: `main.js` reads `requestedMapId(location.search)` and hands
  `bootWorld` the id and `goToMap` (`location.search = mapUrl(...)`);
  boot builds that one map and every system takes it as before. Another
  map is another page load (D34): the systems take the map at
  construction and `initMatch` rebuilds the actors on it, and a live
  rebuild would be a teardown path nothing else exercises.
- The menu: the tag under the title is the map's name; a *map* row
  (`#bl-map`) names it and lists the rest in its tooltip; a click hands
  the next id in registry order to the page-load handler (with one map
  registered the row is a label). The briefing names the map after the
  sites. The F3 overlay has a `map` row.
- The suite (`ui/autosuite.js`): `registerAutoTest` takes `maps`, a list
  of registry ids; `applicable(tests)` splits a list by the map the page
  is on; `runAutoTests` runs the applicable ones and returns `map` and
  `notForMap` with the counts, and the banner says both. Nothing about
  the run order or the result shape changed for a check with no `maps`.
  `runRegressionSet` goes through the same filter.
- The runner (`scripts/suite.mjs`): `--map plant,yard`, default `plant`;
  one page load per map with `?map=<id>` merged into `--query`, `RUNS`
  runs each with the cooldown between; the report has `maps`, `map` and
  `notForMap` on every run and `map` on every red, flaky, expected-red
  and skipped entry; `judge()` groups by map, so flaky is two answers on
  the same map and a check red on one map is red there, named. The
  summary prints `run 1 (plant): ...` and tags ids with `[map]` when more
  than one ran. `--details` writes `{ map, results }` per run. A page
  that boots a different map than asked crashes the run (exit 2).
- **The census of what is the substation's.** Ran the whole suite on the
  empty yard: 153 checks, 110 green, 43 red. Read every red: 23 name the
  first map's geometry - a tag (`hall-container`, `hall-site-a`,
  `stack-hall-low`), a coordinate (the west wall at x=-30, the hall's
  east wall), a Section 5 count (20 waypoints, two grade duct mouths), a
  structure the yard will never have (the deck's lips, the ducts, the
  staircases) - and are now `maps: ['plant']`, each with the reason on
  the line. Two of those had been *green* on the yard by luck
  (`ai-perception-cone-and-accumulator`'s through-wall case and
  `flashbang-needs-line-of-sight`'s unseen case put the Shade 22-30m off
  on open ground, which is unseen for the wrong reason), which is why
  the census read the passes too. `the-vignette-deepens-with-lost-health`
  is scoped as well: it measures over the plant's site A and its
  darkening threshold is that backdrop's (D31). The other 20 red - the
  ledge searches (tests/feel.js, hang.js, scuff.js, movement.js), the
  routes (`every-stacked-climb...`, `every-route-reads-lit...`), the
  alarm mounts (no wall within 3m of any waypoint), the plant-rule four
  (no perch, no duct interior in a site room), the traversal fuzz (0
  approaches), `lit-pools-and-dark-gaps` (D4's) - read the map they are
  on and say honestly that it has nothing; they are D2's list. And one
  that is neither: `a-match-replays-identically-from-its-seed` requires
  `seed+1` to produce a different 20s slice, and on an 8-node graph the
  two seeds' shuffles began 4, 2 both times, so the Warden walked the
  same two legs (probed by hand: circuits `42307516` and `42163075`).
  Not a determinism bug; a weak instrument on a small graph, noted for
  D5 (the AI on the yard) rather than loosened here.

**Checks.** tests/maps.js, on every map:

- `every-registered-map-builds-and-the-page-is-on-the-one-its-url-asked-for`:
  the registry has at least two ids, the default among them, none
  duplicated; the page is on `requestedMapId(location.search)`, its
  map's root is in the scene, the F3 field agrees; every registered map
  builds off the scene with its own toon ramp and has collision, both
  spawn kinds, sites each in a room, Warden ground with every Warden
  spawn and every site on it, a key light and waypoints; an unknown id
  throws; seven `?map=` / `mapUrl` cases and the round trip for every id.
  Building the plant inside a check costs 0.4-8s (the first build after
  boot pays the material cache).
- `the-menu-offers-every-map-and-its-map-row-asks-for-the-next-one`: the
  main menu names the map the page is on and its row's tooltip names
  every registered map; a real click on the row, with the page-load
  handler stood in for (the real one leaves the page), asks for the map
  after this one in registry order, once.
- `a-check-registered-for-another-map-is-reported-not-run`:
  `applicable()` keeps a check with no `maps` and one naming this map,
  reports one naming another map and one naming none; and every `maps`
  entry across the registered suite names a registered id - a typo there
  is a check that never runs anywhere, silently.
- `a-round-opens-on-a-briefing-that-any-key-dismisses` (tests/briefing.js)
  now requires the map's name on the card.

**Verified.**

- Subset on `plant` and on `yard` (`--map yard`): the three new checks,
  the two briefing checks, the shadow-caster and spawn checks, 7 of 7
  green on both.
- Full suite on `yard`, once, after the scoping: **108 passed, 22 failed,
  23 not for this map** (52s - an empty map is quick), the 21 red above
  plus the frame budget skipped; the same 21 before the scoping, so no
  check changed its answer by being left generic.
- Full suite on `plant`, twice, `npm run suite`: **152 passed, 1 failed** run 1 (437s), **152 passed, 1 failed** run 2 (506s) - 149 before D1 and three new checks; the frame budget skipped headless, 0 red, 0 flaky, 0 console errors, 0 context losses, 0 loop frames.

**Not built.** The yard is not in the default gate; `--map yard` runs it
and is red until D2, by the list above. The regression set filters by
map but nothing runs it on both in one go - D6. The menu switches maps
by reloading, not in place (D34).

**Left.** D2, the yard blockout (L, a whole run), then D3-D6.

## D2 — the yard blockout: a ring, two arches, three bays, stacks to three high (2026-09-17, scheduled run)

The 17:00 run's one job, sized L. The queue asked for the yard's
geometry: ground, fence, container stacks one to three high, three
sites in bays, the Warden at a gatehouse, the Shade outside; the five v2
requirements re-read for outdoors; and the 21 checks D1 left honestly
red on the empty plane green, or made to read the map they run on.

**Built.**

- `src/maps/yard.js`, the geometry, and `src/maps/yarddata.js`, the
  data (sites, spawns, lights, waypoints, routes, and the container's
  numbers - `CONTAINER`, `TIERS` - which both files read). 71 boxes,
  builds in 145ms. The shape (D35, provisional): inside the site fence a
  **working yard of 60 x 42 walled by a ring of one-high containers**
  laid end to end, a gate north and south, and a **40ft container laid
  across each gate as an arch** - the Warden walks under at a
  container's headroom, the Shade climbs it from the ring top either
  side and walks over, and the ring's tops stay one surface. Bays A and
  B either side of the lane from the north gate, each walled by the
  ring on two sides, a 12m row on the south and a 12m row on the lane
  side, open at the corner where those two do not meet (the Warden's
  way in, an L of 9.4m and 4.6m); bay C across the south with the
  lane's gap in its north row and the rear gate behind it; a storage
  block of stacks either side of C. **Every row and every stack touches
  the ring or a row that does**, so the one-high tops are one connected
  deck. In the bays: a two-high stack against the ring (two 20ft side by
  side, a second tier on the northern one), pallets against it, a skip
  (bay A), a flatbed trailer (bay B); on bay C's west wall a 20ft and a
  10ft on that, the three-high; the gatehouse in the lane beside the
  north gate with a slot behind it holding a pallet stack with one open
  face; loose pallets in the mid lane. West storage: a 40ft against bay
  C's wall with a 20ft and a 10ft stepping up its east end, a two-high
  in the ring's corner, a loose 20ft; east: a two-high in the corner, a
  20ft with a 10ft on it.
- **The container is a high cube, 2.9m**, not the queue's 2.6 (D35):
  `shade.reach.standing` is 2.6, so a 2.6m top is a standing mantle at
  the exact limit; at 2.9 one high is a jump and a grab (the hang line
  is 2.59), two high (5.8) is past the jump's 3.8 and needs the one
  below, which is what the queue's sentence says. Tier colours step
  (gunmetal, concrete, orange) so a stack reads by height and the
  orange pallets read against the dark rows; E5 replaces them.
- **Nine routes**, one per stack and one per arch, every one starting
  on pallets (1.0m: a vault from the ground, a 1.9m mantle onto the row
  beside them - tests/routes.js wants a first step found on foot within
  a standing reach, and a container is not one). 21 waypoints down the
  lanes; 4 placeholder lamps (D4 lights it); Shade spawns at the apron
  corners, the Warden at the gatehouse and one in each bay. `EXPECTS`:
  4 lights, 21 waypoints, 3 sites in 3 rooms, at least 9 routes.
- **"Inside anything" on the yard is the crawl space under the
  trailer** (bed 1.2-1.5m: a crouched Shade fits under, a standing
  Warden's headroom does not). `plantableSpots` (tests/plantspots.js)
  gained `crawlSpaces()`: every solid in a site room whose underside
  clears a crouch and not `PLANT_HEADROOM`, sampled along its length;
  kind `crawl`. `a-charge-cannot-be-planted-inside-anything` and the
  census take ducts and crawl spaces alike as the third kind of place.
  On the plant it enumerates nothing new (the ducts hang at 2.3m), and
  the plant census's numbers are what they were.
- **The room-entry derivation splits a run where its sill changes**
  (`maprooms.js`). Bay B's south edge is a 9m gap and then a 12m row,
  and the boundary walk recorded them as ONE entry at the row's centre
  (the gap at sill 0, the row at sill 3.0 - a Shade comes in over it -
  merged because a run only ended where nothing passed at any sill), so
  `every-room-has-two-entries` found its "entry" inside the row. The
  plant never showed it: its walls reach the ceiling. The check's
  "blocked" message names the entry now.
- **Checks that only need open floor find it on the map they run on.**
  `warden-speeds-and-no-crouch`, `shade-speeds-match-spec`,
  `shade-is-quieter-than-the-warden`, `taser-stuns-costs-a-charge-and-recharges`
  and `a-landed-knife-puts-a-hit-marker...` stood at the Turbine Hall's
  coordinates - open floor on the empty yard by luck, inside a container
  row on the built one. `tests/lanes.js`: `clearLane(h, length)`, a
  straight run of floor a standing Warden walks without touching
  anything, on the Warden's ground, from the sites first and then the
  waypoints and spawns, eight headings, the first that fits (the same
  every run on a map); `alongLane()`. The knife stands on site A's
  floor, open on every map. Three that stand in the hall's LIT lane -
  `ai-state-machine-follows-section-11`, `each-difficulty-...`,
  `the-warden-fires-in-bursts...` - are `maps: ['plant']` with the
  reason (D33's table was measured there; a lane the yard's lamps light
  is D5's, queued under it).
- **The hang under a lid searches the map** (`findLiddedLip`,
  tests/hang.js): a ground-level lip in the hang band with a solid less
  than a crouch over its landing. On the plant it finds hall-container's
  south face under gantry-hall, as the check named by tag before; the
  yard has no such lip by design, and the check proves the stretch on
  any hangable lip (ring-west-0) and says the lid case is not this
  map's.
- Docs: spec 20.18, D35 (provisional), README's map paragraph,
  PLAYTEST.md's yard paragraphs (how to run, what the suite says there,
  what only eyes can judge).

**Checks.** tests/yard.js, both `maps: ['yard']` because both name the
container's height:

- `the-container-tops-are-one-connected-deck`: union-find over every
  climbable top at a tier height - an edge where two touch at a level,
  one where the rule names a climb from one onto the other (the drop is
  its reverse) - must be one component; and each arch must be climbable
  from the ring on both sides of its gate, since the gates are where the
  ring is cut. **44 tops at 2.9/5.8/8.7: 31 touch, 20 climbs, one
  deck.** Cut any row loose and it names the island.
- `one-high-is-a-jump-and-two-high-needs-a-stack`: the container is past
  a standing reach, inside a jump's, over the hang line; two high is
  not; every climbable top is at a tier or under the first, every tier
  is built; every top above the first tier has no usable approach from
  walkable ground and one from the tier below; and the controller,
  stood at that approach, gets on top. **33 tops one high, 9 two high,
  2 three high; 11 above the first tier, 11 climbed.**

**Verified, on the yard** (`--map yard`, the run before VERIFY): **127
passed, 2 failed, 26 not for this map** - the frame budget, skipped
headless, and `lit-pools-and-dark-gaps-are-actually-contrasty` (the
lamps add 6.6 over a sky of 21.4; D4's, night). Of D1's 21: 19 green
(the ledge searches find the ring, the skip, the pallets; the routes and
their lighting - pallets against the rows read 0.43-0.45, the landing
edges 0.74-0.75; the alarm mounts on a container; the plant-rule four
with 19 tops and 5 crawl spaces in the site rooms, 13 tops and all 5
crawl spaces refused; the fuzz at 151 approaches; `a-match-replays...`
differs on 226 of 240 samples at seed+1 on the 21-node graph), 1 made to
read the map (the hang under a lid), 1 D4's. The census: **58 climbable
surfaces, 163 approaches, the controller onto all 58, 11 need a leg up**
(the two arches and the nine second and third tiers, every one a stage
or a landing of a route; the first cut counted bay C's west wall too,
because its pallets sat on the one spot the rule samples a quarter of
the way along the wall - moved 2m, and the wall is a climb from the
ground again);
`every-approach...`: **151 of 151**; no dead climbs (58 tops: 33 lead
on, 15 walk off, 10 drop); `a-mantle-never-passes-through-a-solid`
green; the Warden's ground 15,335 cells, one component, every spawn,
waypoint and site on it; the last leg to all 186 legal plants planned
within 6m; the AI walked to and began defusing 3 of 3 sampled tops.

**Verified, VERIFY.** `npm run suite -- --map plant,yard` (two runs
each): yard **127 passed, 2 failed, 26 not for this map** both runs
(152s, 148s), 0 flaky, 0 console errors; plant 151 passed, 2 failed both
runs, with `frame-budget-under-the-check-29-load` red at a CPU median of
9.55 / 14.45ms - and those two plant runs took 1080s and 892s against
the gate's 437s that afternoon: the machine was loaded (by what, not
found; the load was gone after), and a CPU-timing check on a loaded
machine measures the machine. Alone, a minute later: 3.50ms median,
green. Then `npm run suite` (the gate, plant, twice): **152 passed, 1
failed, 2 not for this map** run 1 (440s), **152 passed, 1 failed, 2
not for this map** run 2 (486s) - the frame budget skipped headless, the
two yard checks not for this map, 0 red, 0 flaky, 0 console errors, 0
context losses, 0 loop frames, exit 0. 155 checks registered, 153
before D2.

**Found.** Two of my own: the first cut put the second tier at the same
end of a base as the pallets, so the rule refused the base (the landing
was under the tier) - moved; and the pallets in the gatehouse slot are
under the north arch, so the ring's top there is roofed and the rule
names no climb onto it - the arch's route starts on pallets in bay B
instead, and the slot's pallets stay as the one-face box the lid check
wants. One the plant hid: the merged-sill entry above.

**Not built.** Lighting (D4), the walkway (D3), the AI's tuning for the
yard (D5, and the three lit-lane checks it owes), the yard in the
default gate (D6). No 40ft container is a single box longer than 12m;
no container is anything but a box.

**Left.** D3 next.

## D36 — a tap of Space can be 250ms (2026-09-17)

Josh, playing: *"tap to hang not working."* The tap/hold check was green and
drives the real input layer — but with a one-step tap. Reproduced with real
`KeyboardEvent`s through `renderFrame`, which is the path play uses: the grab
starts on the step the key goes down and the hand lands 0.18s later, and that
was the whole tap window. 100ms and 200ms taps hung; a 250ms tap went over.
An ordinary press of a spacebar is 150–250ms, so in play most taps were holds.

**Built.** `hangHoldDelay: 0.12`. In `_stepHang()` a key held since the grab
counts as a hold only once `_hangTimer` has passed it — 0.30s from key-down
all told, the usual tap/hold split. A fresh press from a settled hang pulls up
at once, as before; the B2 slap on a blocked pull-up fires on the press, or
once on the first honoured held step. The rule (D21) is untouched; a hold now
pulls up 0.12s after the hand lands instead of on the same step, which reads
as grab-then-pull. Provisional D36 records the number.

**Verified.** `tap-space-grabs-the-ledge-hold-space-climbs-it` gained two
tiers — 250ms down then released still hangs, 500ms down goes over — and
`driveAtLedge()` a `holdFor`. Red on the previous traversal with exactly the
complaint ("a 250ms tap went over hall-container instead of hanging"). Real
keys in the pane at hall-container: 100, 250 and 280ms taps hang; 400ms and
500ms holds go over, sprinting in from 2.5m the same. The hang, feel and
scuff checks unchanged. Full suite 152 passed / 1 failed (the frame budget,
skipped headless), twice, identical, zero console errors.

## D3 — the Warden's walkway: a stair, a glazed run, three slots (2026-09-18, scheduled run)

The 02:00 run's first job, sized M. The queue asked for the walkway
Josh described in D2 - railed, reached by stairs, glazed, with only
small apertures to shoot through - under the provisional D11 (three
apertures, about 0.4m, at the ends and the middle) and D12 (out of the
Shade's reach: above `standing + jumpBonus` from every stack top within
4m), and two checks: rays from the walkway to 40 points hit glass except
through the apertures; no climbable surface reaches it.

**Built.**

- **Where it is.** `WALKWAY` in `maps/yard.js`: a run 12m long and 2.4
  wide, its floor 7.2m up, over the mid lane's north edge (x -6..6,
  z -3.4..-1.0) - between the bays, so its end faces look west and east
  down the mid lane straight into bays A and B's open corners and its
  south face over bay C's gap. From the middle the Warden sees all three
  sites through the glass. Considered and not built: over the gate
  lane north-south, which covers the Warden's own approach and neither
  bay. The stair is one flight of **24 treads** (`addStaircase` takes
  `steps`; 20 was the plant's deck and 6.0m is not enough - 6.0 - 2.9 is
  under a jump's 3.8) up the west side of the gate lane beside bay A's
  lane row, arriving at the run's north-west corner; the door is the
  stair's mouth, 2m wide, glass over it from 2.1m. Rails both sides,
  six boxes each, a metre over the treads. The run: a slab, a parapet
  a metre high on every side, glass from there to a roof at 2.3m, and
  the three slots.
- **A slot is 0.4m wide and 0.95m tall** (D37), not the square D11's
  "about 0.4m" reads as: the Warden's eye is 1.755m over the floor and
  its body stops 0.57m short of a pane, so a square slot at eye height
  aims 19° down at most and site A's floor is 33° down from the west
  slot. The slot runs from the parapet's top to 1.95m: 53° down, 19°
  up, and sideways as far as the Warden steps off its axis. West slot
  to bay A, east to bay B, the middle of the south face to bay C; to
  cover another bay the Warden walks to another slot, which is D11's
  reason.
- **Glass** is a new kind of solid: `addSolid({ glass: true })` (the
  kit; `CollisionBox.glass`, `materials.glass()` in mapbake.js, a toon
  material at `map.glassOpacity` 0.3, double-sided, no depth write, no
  shadow). Solid to a body, a round and a blade; `blocksSight` false,
  so a line of sight - the AI's, the light model's - passes. The
  rifle's world raycast takes no filter and already stops at every
  solid box, so a pane stops a round with no change to combat.
- **The knife stops where a body does.** The knife had no world test
  at all: `classifyKnife` is distance and arc, and nothing noticed
  because every wall in the plant is thicker than its 1.9m reach. A pane
  is a hand's width; a Warden behind it was in range and cut. `_swingKnife`
  now asks `knifeReaches()` - open air from the Shade's torso to the
  Warden's, of every solid box, glass included (`lineOfSight` with a
  solid filter, the same line a round is occluded on) - and a blocked
  swing is a `combat:knife-miss` with `blocked: true`. The alarm
  camera's knife listener asks the same. Spec 20.19 amends 8.2.
- 53 boxes, 124 on the yard now. `EXPECTS` unchanged: no new light,
  waypoint, spawn, room or route. D5 gives the run its waypoints.

**Verified.** Three checks, `src/tests/walkway.js`:

- `the-walkway-is-glazed-and-shoots-only-through-its-apertures`
  (yard): from an eye behind each slot, placed on the line from the
  slot's centre to its site, and from mid-run, a ray to each of 40
  points (the 3 sites, the 21 waypoints, 16 on a ring) either stops at
  the walkway's own skin or leaves through a declared opening and
  nowhere else; each slot passes a ray to its site; a ray a pane stops
  is one the eye sees through. Then the real gun in free roam, the
  trigger held one step: through the west slot the round lands 19.5m
  out at site A; from beside the slot it lands 0.57m out, on the pane.
  Then the real knife, the Shade on a staged perch at the run's floor
  outside the west pane, the Warden inside, 1.36m apart: at the slot it
  cuts 50, at the pane nothing, and the miss says `blocked`. 145 rays
  stopped (42 at glass the eye sees through), 15 left through the slots.
- `nothing-climbs-to-the-walkway-and-the-warden-walks-up` (yard): D12's
  sentence over the geometry - every body-wide top within 4m of the
  footprint is more than 3.8m under the floor (two are: the lane rows,
  4.3m under); the rule names none of the 53 boxes climbable and no
  approach onto the floor or the roof; then the other half, so the
  answer is the geometry's and not a flag: a perch staged 3m under the
  floor outside the west pane gets 0 approaches (the parapet stops the
  rise), a perch 3m under the roof gets 1 onto the roof, and both go
  when the perch does; the Warden's ground includes the run; and the
  human Warden, W held from 1.5m short of the first tread, is on the
  run and through the door in 3.9s and at its east end 3.4s later.
- `a-knife-stops-at-a-wall-a-body-cannot-pass` (every map): in a clear
  lane (tests/lanes.js), the two at 1.36m facing: open, 50; with a
  staged post between them, 0 and `blocked`; with the post glass, 0,
  `blocked`, and the line of sight through it still open; post gone,
  50. Runs in the default gate on the plant, so the knife's world test
  cannot be reverted quietly.

Found under it: **the Warden walked the container deck.** The first
build railed only the stair's open side, and `one-high-is-a-jump-and-two-
high-needs-a-stack` went red with "arch-north is climbable from walkable
ground": the flight passes bay A's lane row's top at 2.9m 0.2m away, the
Warden's ground stepped off the ninth tread (3.0m) onto the row, and
from there every one-high top in the yard was Warden ground. The west
rail is why there is a west rail; the check that caught it is D2's, on
the deck, not D3's. Also: the first arrival test turned the Warden east
while its body was still in the doorway, and it stood against the
parapet's end - the check now waits for the whole body inside.

Yard suite: 130 passed, 2 failed (the frame budget, skipped headless;
`lit-pools-and-dark-gaps-are-actually-contrasty`, D4's), 26 not for
this map - D2's 127 plus these three. Plant suite: **153 passed, 1 failed (the frame budget, skipped
headless), 4 not for this map**, twice, identical, zero console errors.

**Left.** D38, blocking: the Shade can walk up the stair into the
booth - a stair is walked by anyone and a door only one body passes is
a new rule. D3b (a Warden-only door) is queued behind it, sized S.
Josh's eyes: whether a 0.4m slot is usable with a mouse, whether 30%
opacity reads as glass, whether the run reads as the Warden's from the
floor (PLAYTEST.md). The three AI checks scoped to the plant are still
D5's; the run has no waypoints until then.
