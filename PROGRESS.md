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
