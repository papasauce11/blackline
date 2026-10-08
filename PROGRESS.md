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

## D4 — the yard at night: four masts, a fifth lamp, one warm key from bay C (2026-09-18, scheduled run)

The 17:00 run's first job, sized M. The queue asked for night (D9):
floodlights on masts as the shadowed key - one shadowed light stays the
rule, pick the mast that covers the most - fill from the sky, pools of
dark between stacks; and for `lit-pools-and-dark-gaps-are-actually-
contrasty`, red on the yard since D2, to go green within the frame
budget with `every-route-reads-lit-from-its-foot` still green. The
baseline said why it was red: the lamps added 6.6 / 6.6 / 3.2 of luma
at the sites over a sky of 21.4 - the plant's rig outdoors, with no
roof to shadow its key, lit the whole yard like noon, and the plant's
sites read 28.5 / 20.2 / 12.7 over a sky of 1.8 / 1.8 / 2.6.

**Built.**

- **The rig is the map's.** `addLightRig(rig)` (mapkit.js) takes a
  map's numbers over `CONFIG.map.lighting`'s - intensities, directions,
  and `hemisphereSky` / `hemisphereGround` / `keyColor` / `fillColor`
  where the palette's defaults are not the map's; the plant passes none
  and is unchanged. `aimKeyLight(direction, at)` points the key and
  records its unit vector in `keyLight.userData.direction` for the
  checks. The rule that exactly one light casts stays in the kit.
- **Four masts** (`MASTS`, `MAST`, yarddata.js): a pole 0.3m square on
  the ground, an arm 0.15 from its top, the lamp at the arm's end 6.5m
  up - both parts thinner than a body, so the rule finds nothing to
  stand on and neither derives climbable. Bay A's against its south row
  with the arm out over the site, B's the mirror, C's against its east
  wall, the gate's in the open ground west of the lane north of the
  stair's foot with the arm over the lane. Each stands against a wall
  or in a corner, off every lane the Warden walks and every waypoint
  link. Considered and not built: masts at the ring's corners as a real
  yard has them - 14m from the sites, past where a lamp lands a pool or
  the meter counts it.
- **A fifth lamp under the walkway's floor** over the mid lane: the
  Warden's post lights the crossroads it looks down on, so the mid lane
  is a pool and not a gap. `EXPECTS.lights` is 5.
- **The lamps are 2.5x the plant's pendants** (`MAST.lift`; C's half
  that, the dimmest as the plant's is). The inverse square of a head at
  6.5m over the yard's darker concrete: at 26 candela a lamp at 6m landed
  6.6. The meter under a mast reads in the fifties (the plant's hall,
  over 70, has five lamps on it); D5 tunes the AI to the yard's.
- **The sky** (`RIG`): hemisphere 0.2, a fill 0.14 from straight
  overhead in `lightCool`, the key 0.3 in `lightWarm`. Found on the way:
  the plant's fill colour, `ambientSky`, is too dark a blue to land
  anything at any intensity - the first night read its shadows at luma
  0.07, a hole by Section 4's own words, with the fill at 0.08 in that
  colour; in the lamps' cool at 0.14 a shadow reads 3.0.
- **The key is bay C's floodlight.** "The mast that covers the most",
  counted as Warden-ground cells inside the ring within the lamp's range
  of its head: bay C 2274, bay B 1906, bay A 1731, the gate 1544. So the
  key is aimed from C's head at the yard's centre, 28° up: every stack's
  shadow falls north-west, 5.5m for a one-high. Bay B's site floor sits
  in its south row's shadow (sky 3.0); A's and C's are key-lit (8.1); C
  stays the darkest by its lamp, 21.0 to B's 24.5. `KEY_MAST` is
  declared, not derived, and the check holds the name to the count.

**Verified.** `lit-pools-and-dark-gaps-are-actually-contrasty` on the
yard: **site A 26.9 (+18.9), B 24.5 (+21.5), C 21.0 (+12.9)** over a sky
of 8.1 / 3.0 / 8.1, C the darkest, A 1.28x C. `every-route-reads-lit-
from-its-foot`: the pallets read 84 lit / 72 unlit against 31 at A
(contrast 0.46), 69 / 51 against 29 at B (0.41), 49 / 28 against 18 at
C - the step is the emissive's and the surround went darker, so every
contrast rose. Two new checks, `src/tests/yardlight.js`, both on the
yard:

- `the-yard-is-floodlit-from-masts-at-night`: every mast has a pole on
  the ground and an arm that reaches its head, both under a body's
  width, neither climbable, a lamp at the head; the key casts, is
  `lightWarm`, points within 0.999 of the line from `KEY_MAST`'s head to
  the centre, under 45° up; and the coverage count names `KEY_MAST`
  first with no tie. The first draft also required the rule to name no
  approach onto a pole and went red on all four: the rule names an
  approach onto any face a body can put its hands on, and it is the top
  that is too narrow - the assertion was wrong, not the mast.
- `the-yard-is-dark-between-its-pools`: read straight down as lit-pools
  does, a lane no lamp reaches (the west store's, 3.0), the ground west
  of bay C (4.9) and a stack's key shadow found from the key's own
  direction (`shadowGap`: the ring's south row's, 3.0) all read under
  half the dimmest pool (10.5) and above 1; the sky alone lands under a
  third of the brightest pool on every site (0.30 today - the tightest
  margin in the job; the lamps' lift is what moved it from 0.335, not
  the key).

Yard suite: **133 passed, 1 failed, 26 not for this map**, twice, identical (0 red, 0 flaky, 0 console errors; the one failure the frame budget, skipped headless; 130 passed after D3 - these two checks and lit-pools). Plant suite: **153 passed, 1 failed, 6 not for this map** (the two new checks are the yard's), twice as two `--runs 1` runs - two plant runs at 420-450s each no longer fit the tool's 10-minute cap, and a backgrounded run stopped from the tool left a dead runner behind; the 154 outcomes identical between them, 0 red, 0 console errors, 0 context losses.

**Left.** D39 (provisional): every number, and the alternatives - the
gate's mast as the key, from the north. Josh's eyes: whether it reads as
a yard at night or a black screen with four spots, whether the warm key
on the container faces sells "floodlit", whether the meter's fifties
under a mast match how lit you look (PLAYTEST.md). D5 next: the AI on
the yard, and the three plant-scoped AI checks given a lane the yard's
lamps light.

## D5 — the AI on the yard: a lit lane, a near goal over the ground, stuck means moving (2026-09-19, scheduled run)

The 02:00 run's first job, sized M. The queue asked for the Warden on
the yard - patrol over `wardenGround`, defend paths to all three sites,
alarm placement - for the three AI checks that stood in the Turbine
Hall by coordinate since D2 to be given a lane the yard's lamps light
and their `maps: ['plant']` taken off, and for a soak of three matches
with no stall. The gate was green (153 passed, 1 failed - the frame
budget, skipped - 0 red, 0 console errors, 446s).

**Built.**

- **`litLane(h, length, stands)`** (tests/lanes.js): `clearLane`'s
  search - the sites, the waypoints, the spawns, eight headings, the
  first clear run wins - and the visibility meter has to read at least
  `LIT_METER` (half its range, 50) for a standing Shade at every
  distance in `stands` down it, read through `detection.reset()` as a
  spawn seeds the meter (`meterAt`). The AI checks that measure a "lit,
  still" Shade hold the meter at its maximum so their numbers are the
  preset's and not the lamp's; the lane is what makes that an
  approximation and not a lie. Half is the line: Section 16 draws the
  plant's lit and dark at 70 and 25, a mast's pool reads in the fifties
  and sixties (D39), a gap between stacks reads the ambient floor.
- **The three checks stand on it and run on every map.**
  `each-difficulty-is-quicker-to-see-you-and-quicker-to-kill-you` and
  `the-warden-fires-in-bursts-of-rounds-at-the-torso` ask for 17m lit
  at 8 and 16; `ai-state-machine-follows-section-11` for 9m lit at 8.
  On the plant the first two moved from (-24, -19) to `hall-north`
  under hall-1 (meter 78 / 58) - site A has no 17m run - and **D33's
  table is unchanged to the hundredth** (8m: 7.35/0.86, 4.97/0.51,
  3.60/0.35; 16m: 13.64/7.21, 9.27/1.40, 6.74/0.93). On the yard the
  lane runs north from site C up the gate lane, under the walkway's
  lamp (meter 63 at 8m, 80 at 16m): **8m: easy 7.35s/1.16s, medium
  4.97s/0.43s, hard 3.60s/0.41s; 16m: easy 13.63s/7.36s, medium
  9.27s/1.25s, hard 6.73s/0.82s** - the detects identical (the meter is
  held), the kills within a third of a second, the order held. D33's
  table needs no yard column. The burst check: 20 rounds as [6 3 6] at
  a mean height of 1.10m against a torso at 1.15.
- **A near goal is walked to over the ground** (`ai.directRouteRange`,
  10m; `_pathTo`, ainav.js). The state-machine check went red on the
  yard first: the noise 8m up the lane from site A, and the Warden
  investigated it by way of the graph node nearest it, `bay-a-north`,
  a metre and a half *beyond* it - walked past the Shade making the
  noise, out of its own cone at a metre (the trace: 65-87 degrees off
  its facing), the accumulator peaked at 81 and drained, SEARCH,
  PATROL. Now a goal within 10m flat is planned by `WardenGround.route()`
  from the Warden's own feet - the planner that has done the last leg
  since A8 - and the graph is not consulted; past that, the graph as
  before. A goal the planner cannot reach (off the ground, past the
  snap) falls through to the graph.
- **Stuck means moving** (`_meansToMove`, ainav.js). The soak's first
  run: twelve stuck re-paths in nine rounds on the yard, thirteen on
  the plant, and every one of them in DEFEND, under a metre from the
  charge, 2.7 to 7.9 seconds into the defuse. Section 11's detector
  ("less than 0.3m over 2s while in a moving state") read a kneeling
  Warden as wedged, re-pathed it, and the route began at the nearest
  graph node: it stood up, walked there, and came back to begin the
  defuse again - four to eight seconds a round, and it did it in every
  playtest so far. A moving state now means a route the AI has not
  reached the end of (ENGAGE, which closes on the Shade with no route,
  always counts), so a Warden that has arrived and holds - the defuse,
  INVESTIGATE's scan - is not stuck, and a wedged one, which has not
  arrived, still is. Spec 20.21 for both.
- **`the-warden-plays-three-matches-on-this-map-without-a-stall`**
  (tests/aisoak.js, every map): three best-of-fives, each round the
  way the intermission starts one (`initMatch` with the round number,
  its own seed), the Warden from a different spawn each round, a
  patrol of 6 / 10 / 14 seconds, the plant at A, B, C in turn from
  `plantAt`, the Shade to the farthest spawn, and the defence on the
  detonation clock. Holds: every round ends defused and the Warden's
  (a Shade seen on the way is a problem, not an excuse), the match
  over at 3-0, the Warden's feet on `wardenGround` every step
  (`onGround`, exported from tests/wardenground.js), a camera hung
  every match, and at most three re-paths in all - the cap that would
  have said twelve. The rounds and every re-path (state, distance to
  the charge, defuse progress) go to the F4 log.

**Verified.** The AI subset on both maps after the two fixes: 28 passed
on the yard, 31 on the plant, 0 failed. The soak on the yard: 3-0 3-0
3-0, 9 rounds defused, 14,579 steps on the ground, 9 cameras, **0
re-paths**; from 10 to 40m the defuse landed 11.6 to 25.5s after the
plant. The plant: 9 rounds, 16,279 steps, 9 cameras, 0 re-paths, 8 to
34m in 10.9 to 31.4s. `the-ai-walks-to-the-charge-and-defuses-it` got
quicker on both maps by the re-path it no longer takes (plant 17.1 to
15.9s, yard 26.4 to 24.5s); `ai-patrols-without-getting-stuck` reads 0
re-paths on both. Full suite, both maps, twice: plant **154 passed, 1 failed, 6 not for this map** (409s and 507s), yard **137 passed, 1 failed, 23 not for this map** (192s and 197s), every outcome identical between runs, 0 red, 0 flaky, 0 console errors, 0 context losses; the one failure is the frame budget, skipped headless. 153 and 133 before D5: the soak is new, and on the yard the three unscoped checks are three more passes and three fewer *not for this map*.

**Found.** Two AI defects on every map, above, neither the yard's:
the overshoot to the node beyond a near goal, and the kneeling Warden
counted as stuck. Both were invisible to the checks that existed - the
hall's lane had its nearest node short of the Shade, and no check
counted re-paths through a defuse.

**Left.** D6 (both maps in the gate). Josh's eyes on the yard's Warden:
whether it reads as patrolling a yard or pacing lanes, whether a defence
across 40m of yard feels fair against a 45s clock (PLAYTEST.md).
`ai-perception-cone-and-accumulator` stays `maps: ['plant']` - its
through-wall case names the hall's east wall.

## D6 — both maps in the gate, the regression set asked per map (2026-09-19, scheduled run)

The 02:00 run's second job, sized S, after D5. The queue asked for both
maps in the regression set, the menu defaulting to `plant`, a yard
section in PLAYTEST.md, and for `npm run suite` with no arguments to
gate both maps; D5's verify (154/1/6 and 137/1/23) stood as the gate.

**Built.**

- **The runner's default is every registered map.** `registeredMapIds()`
  (scripts/suite.mjs) reads the `REGISTRY` entries out of
  `src/maps/index.js` as text - the module imports three.js through the
  page's import map, so node cannot load it - and `npm run suite` loads
  the page once per id and runs the suite twice on each, judged per map
  as D1 built it; `--map` narrows as before. A third map is in the gate
  the day it is registered. **`--regression`** runs the page's own
  `runRegressionSet()` (F4 then U) per map instead of the whole suite
  and the run line says so with its time.
- **The regression set is asked per map.** `AutoSuite.regressionSet()`
  resolves the set for the map the page is on: every check that covers
  one of Section 16's numbers or is named by id, split into the ones
  `applicable()` keeps here and the ones registered for other maps, and
  the numbers no check running here covers. `runRegressionSet` prints
  both in the console before it runs (it used to count coverage over
  every registered check, so a number held only by a plant check read
  as covered on the yard). `the-regression-set-resolves-to-real-checks`
  (tests/donedef.js, every map) holds the page's split to its own
  count: the set on this map is the set less the other maps' checks,
  runs more than nothing, and every check it leaves out is registered;
  its line names them and the numbers covered only elsewhere.
- **The menu's default was `plant` already** (`DEFAULT_MAP_ID`, D1) and
  `the-menu-offers-every-map-and-its-map-row-asks-for-the-next-one`
  holds it; PLAYTEST.md's yard text is in *Run it* since D2 and its
  gate paragraph is rewritten for D6.

**Verified.** `--regression --runs 1`: **plant 29 checks in 59.5s, yard
24 in 24.4s, 5 not for this map** - `swept-collision-no-tunnelling`,
`shade-reaches-level-2-without-stairs`, `a-mantle-never-passes-through-
a-solid`, `visibility-reads-lit-and-dark-zones`, `hitscan-respects-
cover-and-the-head-line`, each naming the plant's geometry; the other
numbers are held on the yard by other checks, and Section 16's check 3
by nothing, which the check now says. `npm run suite`, no arguments, both maps twice: plant
**154 passed, 1 failed, 6 not for this map**, yard **137 passed, 1 failed, 23 not for this map**, every outcome identical between
runs, 0 red, 0 flaky, 0 console errors, 0 context losses (433s, 487s, 185s, 216s).

**Found.** The done-when's "under 20s" is not met headless and cannot
be measured here: 60s on the plant and 24s on the yard under software
GL, where a frame is 400ms and five of the set's checks read pixels.
PLAYTEST.md asks Josh to time U in a GPU tab on each map; if it is over
20s there, the set is too big and that is a job. And the set is not
whole on the yard: D7 (M), queued in Block D ahead of styling, splits
the five plant-bound checks into a generic clause and the plant's
named cases.

**Left.** D7; Block E after it (D3b waits on D38).

## D7 — the regression set whole on every map (2026-09-19, scheduled run)

The 17:00 run's job, sized M. D6 left the yard's U running 24 of the
set's 29 and Section 16's check 3 held there by nothing: five of the
set's checks name the plant's geometry - a drive into the west wall at
x=-30, five routes by tag, the two low ducts, the Turbine Hall and the
Server Vault, the hall's east wall. The queue asked for each to be
split into a clause that searches the map it is on and the plant's
named case kept as it is, with the generic one in the set. The gate
(`--runs 1`, both maps) was plant 154/1/6, yard 137/1/23, 0 red.

**Built.** `src/tests/anymap.js`, five checks with no `maps`, each the
rule's clause asked of whatever map the page is on by searching it:

- **`a-body-driven-into-any-solid-never-passes-through`** (check 1's
  auto half). From every site and Warden spawn, in the four axis
  headings, at 6.5, 50, 200 and 1000 m/s, 180 steps of
  `moveAndSlide` with the Shade's body; and at every step the path
  from where the body was to where it is, swept by hand
  (`segmentEnters`, a slab test against the box grown by the body and
  shrunk by 2cm) against every solid whose top is above a step from
  the feet. The plant's check reads the final x against a wall face it
  knows; this one has no face to know, and the sweep is what catches a
  tunnel that lands in open air on the far side - at 1000 m/s a step
  is 16m and the ring is 2.4 thick. Solids within a step of the feet
  are excluded because a step-up's own path crosses their corner by
  design. A drive of 150m or more that met nothing is a body that left
  the site, and red. 112 drives on each map, 107 stopped (five
  6.5 m/s runs from a spawn find nothing in 19.5m), 0 breaches, and no
  step-up on either map's lines.
- **`every-declared-route-is-driven-from-the-ground-to-its-landing`**
  (check 3). Every route in `map.routes`, stage by stage: the first
  from walkable ground within a standing reach (`onWalkableGround`),
  every later one from a box of the stage below, the landing a
  climbable top at `route.landing` the rule names from some stage -
  each climbed with the census's own drive (`attemptClimb`, exported
  from tests/readability.js with `bodyHeightAt`), then forty frames
  with the keys up so the move finishes and gravity settles, and the
  feet within 0.35 of the top with the body in open air: "lands clean".
  No stair tread on any route. God mode on for the drive (the Warden
  lands its rounds since C5) and put back. Plant: 8 routes, 31 climbs;
  yard: 9 routes, 29 climbs, every rise 1.0 / 1.9 / 2.9 as the tiers
  say. The rule's word on each stage was already good
  (`every-stacked-climb-...`, `every-approach-...`); what this adds is
  the chain driven and the landing settled, on every map.
- **`no-climb-the-rule-names-rises-through-a-solid`.** The plant's
  mantle check had four clauses and three of them read the map they
  are on: by the rule, by the geometry (the sweep and `riseThrough`
  agree exactly), by the controller at each approach the sweep
  refuses. Those are **`mantleClauses(h, debugTools)`** in
  tests/routes.js now, called by both checks; the plant's keeps its
  fourth clause (the four presses under the duct floors) and its
  demand that the sweep refused something. On the yard the sweep
  refuses nothing - 152 approaches, agreement on all 172 unswept, no
  solid above any landing on the path - and the check says so rather
  than failing a map for its geometry.
- **`a-lamp-lit-site-reads-lit-and-the-darkest-ground-reads-dark`**
  (checks 8 and 9's auto half). `meterAt` (D5) at every site: the
  brightest reads at least `LIT_METER` (half the meter) and under the
  clamp less five, check 10's headroom; and the darkest of a 2m grid
  over every floor of the Warden's ground reads under 25, the plant's
  Server Vault line. Plant: A 84.4, B 36.9, C 9.0, darkest 3.0 at -27.8, 21.8
  (the ground floor's south-west corner); yard: A 57.9, B 58.2, C
  41.8, darkest 3.0 at 0.3, 23.8, outside the ring's south face.
  Bay C's site reads under the line - its mast is the shadowed key and
  its lamp is half lift (D39) - which the check reports and does not
  hold; the plant's C is the vault, dark by design.
- **`a-round-stops-at-cover-and-reads-the-head-line`.** Down
  `clearLane(h, 9)` with the Shade 8m along: a torso ray hits and is
  not a headshot, a ray above the head line is, and the world has
  nothing before the body. Then cover: the first three solids with
  walking ground at their own foot three metres either side, tall
  enough to hide a torso, the Shade behind and the muzzle before; the
  round must be on the Shade's line (`rayHitsActor`) and the world's
  first hit closer. The plant's shell walls and the yard's ring, at 3m
  of 6.1 and 8.1.

The plant's five checks stay in the full suite exactly as they were,
and leave the set: their `spec` lines name the number in words rather
than as "check N" (which is what `checksCovered` reads) and name the
set's check that holds the clause; `regressionChecks` swaps the plant's
mantle id for the generic one and adds the cover clause.
**`the-regression-set-resolves-to-real-checks` is red** on any map
where the set has a check registered for another map or a number no
check running there covers - D6 reported those; D7 fails them, so a
sixth plant-only check cannot creep back behind a tag. U on both maps:
**29 checks, 0 not for this map, every number covered.** Spec 20.23.
PLAYTEST.md's gate paragraph rewritten; the 20s question still waits
on a GPU tab.

**Verified.** `--subset` of the eleven checks touched, both maps, first: the plant's five named checks unchanged in their readings, the five new ones green, the resolve check reporting 29 of 29 on each map. Then `npm run suite`, no arguments, both maps twice: plant **159 passed, 1 failed, 6 not for this map** (443s, 498s), yard **142 passed, 1 failed, 23 not for this map** (182s, 208s), every outcome identical between runs, 0 red, 0 flaky, 0 console errors, 0 context losses; the one failure on each is the frame-budget check, skipped headless. `--regression --runs 1`: **plant 29 passed in 58s, yard 29 passed in 25s**, nothing not for this map on either.

**Found.** The plant's regression set is the same size it was (five
out, five in), and the full suite grew by five on each map. Nothing
the plant's checks held is held less: they run in Y as before; U on
the plant runs the searched clauses in their place, which on the plant
find the hall (A at 84), the shell walls and the same nine refused
approaches. The yard has nothing the sweep refuses, so the mantle
check's controller clause proves nothing there today; it will the day
a lip is built under something.

**Left.** Block D is closed but for D3b (waits on D38). Block E, the
styling, is next: E1, the Shade.

## E1 — the Shade: a hood, a cowl, thin limbs, six merged parts on one material (2026-09-19, scheduled run)

The 17:00 run's second job, sized M, after D7; Block E opens with it
(D3: the Shade and the Warden first). D7's verify (159/1/6 and 142/1/23)
stood as the gate. The queue asked for an articulated toon figure - a
hood, a narrow silhouette, long limbs - from merged geometry on one
material with the rim kept, held by a silhouette pixel check at 8m and
25m and draw calls unchanged.

**The reading of "merged geometry, one material".** A merged mesh
cannot bend an elbow; the only merged AND articulated body is a skinned
one, and Section 4 forbids a rigged skeleton ("animate by rotating and
translating primitive limb groups"). So the six groups agentvisual.js
poses - torso, head, two arms, two legs - are unchanged, and what each
group holds is what changed: ONE merged geometry with its colours in a
vertex attribute, on the one toon material that carries the rim, plus
ONE hull on the one outline material. Twelve draw calls for the body
where there were twenty (ten primitives, ten hulls). Two would need a
skeleton; twelve is what the spec allows. D40 records the choice.

**Built** (`FIGURE`, entities/agentmesh.js; every number is there):

- **The hood.** A sphere shell of 0.21 round the head, open at the face
  (0.3 pi, centred on -z, the way the Shade faces) and below a drape of
  0.7 pi, and a second shell of 0.2 inside it facing inward in charcoal
  (`inward`: mirrored in x, its normals turned), so the opening shows a
  dark hood with the dark head in it and not the room behind. A cowl
  (an open cylinder 0.05 to 0.25 over 0.14m) over the shoulders, its
  apex under the hood's rim. Hood and cowl are the torso's teal and the
  torso's piece, so the hood turns with the body and the head turns
  inside it as it did.
- **The neck.** The torso capsule narrowed from 0.19 to 0.14 and set so
  its rounded top IS the neck, ending just under the hood's rim: between
  the hood's widest row and the cowl the silhouette steps in to a third
  of the hood's width. That step is what "hooded" is at 25m, where the
  whole body is forty pixels tall.
- **The limbs.** Arms 0.05 and legs 0.06 in radius (were 0.058 and
  0.068), the same length, the same pivots, the same reach to the glove
  and the boot - the hanging glove lands on the lip as before, and
  `a-hang-is-at-full-stretch-under-the-lip` reads it. The last child of
  a limb group is an empty at the glove or boot, which is what that
  check reads and what E3 will want.
- **The hull.** Grown per primitive, `FIGURE.outline` on every side about
  the primitive's own centre before it is placed, then merged like the
  body. Not scaled 1.03 about the part: a limb group's origin is its
  pivot and a hull scaled about the shoulder sat 2cm off the glove. The
  hull and the fresnel rim share the silhouette's outer two pixels, and
  on a thin limb the hull takes them: at 1cm `the-rim-light-is-really-
  on-screen` read "edge +44 vs core +51, a wash"; at 5mm on 4.5cm arms
  it read 1.6x in the subset and then **1.48x in one run of the verify
  and 1.56x in the other** against its 1.5x line - flaky, because the
  idle pose the check frames moves with how many frames have been
  rendered, and the margin was gone. The fix was the figure, not the
  line: arms 0.05 and legs 0.06 (from 0.045 / 0.055) and the hull 4mm,
  and it reads 2.0x twice on the plant and 2.3x twice on the yard, with
  the hull still owning the outline (141 against 8, 120 against 9).
- **`materials` is `{ body, outline }`.** `Detection._applyFeedback`
  scales `body.color` from white, which darkens teal and charcoal
  together; `visibility-feedback-matches-the-meter` reads it there.

**`the-shade-reads-as-a-hooded-figure-at-8m-and-25m`** (tests/figure.js,
every map). The structure first: six body meshes, all on the one
material, every one with a colour attribute, six hulls. Then the
silhouette: the Shade at the near end of the first clear lane facing
down it, an eye 8m down the lane and one 25m away in open air that sees
it (`standAndEyes`, searched over `clearLanes` and the eight headings -
the plant has no 25m lane, it has 25m of sight), the body on a flat
unlit white for the two frames with its shadow off, the difference
frame the shape. Tall and narrow (height over width at least 2.2:1; it
is 3.4), and the widest row of the top 14% at least 1.5x the narrowest
row of the 14-22% band under it. Plant: 8m ~3000px, 124x35, hood 28px
over neck 12; 25m ~350px, 40x12, 10 over 6. Yard: the same to a pixel
(the idle bob moves the neck reading a row or two between runs; the
line is 1.5x and it reads 2.3x).
Draw calls with the body shown less hidden: 12, at most 12, at least
the twelve meshes. The old figure fails it three ways: ten parts, no
colour attribute, a head narrower than the capsule under it.

Found on the way: the difference frame lit by the map's own lamps found
659 of the body's 3000 pixels on the yard at night - the charcoal limbs
were within eight levels of the container behind them - hence the flat
white; and `clearLane(h, 26)` does not exist on the plant, hence sight.

**Verified.** the touched pixel checks in a subset first (the rim check at 5mm/4.5cm: 1.6x on the plant, 1.7x on the yard; the figure check green on both maps). Then `npm run suite`, both maps twice: **plant 159 passed, 2 failed then 160 passed, 1 failed** - `the-rim-light-is-really-on-screen` flaky at 1.48x / 1.56x - so the figure was changed (above) and the suite run again in full: plant **160 passed, 1 failed, 6 not for this map** (460s, 501s), yard **143 passed, 1 failed, 23 not for this map** (203s, 202s), every outcome identical between runs, 0 red, 0 flaky, 0 console errors, 0 context losses; the one failure on each is the frame-budget check, skipped headless. `a-hang-is-at-full-stretch-under-the-lip` reads the gloves at the lip on both maps as before; `the-outline-darkens-the-silhouette-edge` 141 against 8; `visibility-feedback-matches-the-meter` and `the-shade-visibly-dims-with-the-meter` unchanged in shape (luma 42 to 110 across the meter).

**Left.** E2, the Warden, next; then E3, animation - the limb-end
empties and the six groups are there for it. Josh looks at the figure
(PLAYTEST.md, D40).

## E2 — the Warden: a helmet on the shoulders, a vest, a rifle at the low ready, six merged parts (2026-09-20, scheduled run)

The 02:00 run's one job, sized M, the second of Block E (D3: the Shade
and the Warden first). The gate stood at 160/1/6 and 143/1/23 (exit 0;
it was started before the first file was touched, and the yard's page
load eight minutes in may have seen the tree mid-edit - it came back
at HEAD's numbers with the new check not yet registered, so it read as
the base either way). The queue asked for a helmet, a vest, a rifle
silhouette and a broad stance, held by a pixel check that tells the
two figures apart by silhouette alone at 25m, in the dark.

**"In the dark" is read as "shape and nothing else."** The check draws
each body on a flat unlit white and takes the difference frame, as E1
did: the figure with no colour, no shading and no rim to help it, which
is what a figure is in the dark. A literal reading - both bodies under
the map's night at visibility zero - measures the lamps, not the
figures: E1 found the yard's night hides a third of the Shade against
the container behind it. Whether the lamps show either body is the
lighting checks' question.

**Built** (`WARDEN_FIGURE`, entities/wardenmesh.js, split out of
enforcer.js as agentmesh.js was out of agent.js; every number is there):

- **The helmet.** A dome of 0.21 on a band of 0.13 with a brim of 0.245
  and a `wardenSteel` visor, over a box skull that shows nowhere: the
  chest's top is a hand under the brim and a collar fills the neck, so
  the silhouette never steps in under the helmet - the Shade's hood over
  a neck in reverse, which is the front-view reading.
- **The vest and the block.** Gunmetal plates proud of the orange
  chest's front and back, and a belt of hips under the chest over the
  tops of the legs: the old figure had 25cm of nothing between its chest
  (bottom at 0.96) and its legs (top at 0.70). Pauldrons of 0.26 x 0.20
  x 0.42 tilted down at the outer edge: the widest row, 1.2m.
- **The stance.** Short legs of 0.22 at x 0.22, each tilted a tenth of
  a radian about the hip so the boots stand at 0.30 (the leg box is
  translated to hang from the pivot before `part` rotates it, so the
  tilt is about the hip and the boot lands where the tilted leg ends).
- **The rifle**, at the low ready. Both arms forward and pulled in to
  the centreline (`arm.rest`: left x 1.0 / z 0.6, right x 0.7 / z -0.5),
  the hands together at the grip in front of the belly, the rifle from
  the right hand ahead and 20 degrees down; the elbows cannot bend, so
  the stock is short (0.18 behind the hand) and the hands are close. It
  is a piece of the right arm's merged part: `riflePieces` puts the
  hand where the rest pose puts it (`handAt`, the arm's Euler as a
  quaternion), points the rifle by `rifle.pitch` / `yaw`, and takes the
  centre and the orientation into the arm's frame by the inverse of the
  rest quaternion - so at the rest pose it is in the hands, and it goes
  where the right hand goes: the stun drops it, and E3's aim pose will
  raise it by rotating the arm. Port arms across the chest, tried first,
  reads from the front and not the side, and the side is where a Shade
  watches a patrol from.
- **The arms were behind the back.** The old carry set `rotation.x =
  -1.15` "forward holding the weapon"; positive x is forward on this rig
  (makeRotationX: y=-1 goes to z=-sin, and forward is -z), so the
  Warden has walked with both arms held out behind it since it was
  first drawn. The rest pose is read by `_animate` and the walk swings
  a little about it. D41 records it.
- **Six merged parts on one material**, six hulls grown 6mm: 12 draw
  calls, were 16 (eight meshes, eight scaled hulls, two toon materials).
  `part`, `grown`, `mergePieces` and `inward` moved to
  entities/parts.js, shared with the Shade; `part` takes the growth as
  an argument (the Shade's 4mm shares its edge with the rim, the
  Warden's has no rim) and a piece may carry a `quaternion` for the
  rifle. One palette entry, `wardenSteel` 0x1b1e21: gunmetal on
  gunmetal lost the weapon against the vest.

**`the-warden-and-the-shade-are-told-apart-by-silhouette-at-25m`**
(tests/figure.js, every map). The structure first, for the Warden as
for the Shade (`structure`: six parts on the one material with vertex
colours, six hulls). Then the same stand and 25m eye E1's check finds
(`standAndEyes`), each figure turned to face the eye and then side-on
(`yawToward`), on the flat white with the other hidden; the Warden is
placed and drawn, never stepped - a stepped frame is the AI's and it
would walk off the stand. Front: the Shade narrow (at least 2.2:1; 3.3)
with its hood 1.5x the neck (10 over 6) and at least 0.9x anything in
the band under it; the Warden broad (at most 2:1; 1.5) with its helmet
at most 0.6x the widest row of the band under it (10 over 26); the
Shade's aspect 1.5x the Warden's and the Warden's widest row 1.5x the
Shade's (26 over 12). Side: the middle band (30-70% of the height)
reaches at least 25% of the height ahead of the helmet on the Warden
(41%; the rifle) and at most 10% ahead of the hood on the Shade (-2 to
-3%). Twelve draw calls at most and at least the twelve meshes. The
readings lead the failure line, in brackets after the problems: a red
line has to say what it saw. `silhouette`, `band`, `rowExtents` (now
left, right and width per row), `structure`, `flatten` and `drawCalls`
are E1's check taken apart and shared; its readings are unchanged to
the pixel (8m 122-126x35, hood 28 over 11-12; 25m 39-40x12, 10 over 5-6).

**Found on the way.** Three wrong readings, each the geometry and not
the check: `head.pivot` and `arm.pivot` were written in metres where
the code multiplied by the standing height (the helmet at 2.38m, 49
rows tall, the "shoulders" the skull box at 6px); then, with the head
right, the helmet band read 22px - the top 14% of forty rows is seven
rows, rounded, 0.34m, and the pauldrons' top corners at 1.645m were in
it. The chest came down 5cm and the pauldrons 9cm so the top seventh of
the figure is helmet and nothing else. A figure's proportions are
argued against the band it is measured in. And a look: a scratch script
that served the repo, loaded the page headless and wrote
`renderer.domElement.toDataURL()` after a `render` from a placed camera
gave PNGs this session could read - the figures at 4.5m front, side and
three-quarter, and at 8m. The Warden reads as a helmeted guard with a
gun in the side view; from the front the rifle is a short bar in the
hands, as it would be. Not committed (it is not in the queue); a queue
item asks whether it should be.

**Verified.** The new check in a subset on the plant through three
figure fixes (above), green at 40x26 / 40x12; then `npm run suite`,
both maps twice: **plant 161 passed, 1 failed, 6 not for this map
(454s, 508s), yard 144 passed, 1 failed, 23 not for this map (206s,
202s)**, every outcome identical between runs, 0 red, 0 flaky, 0
console errors, 0 context losses; the one failure on each is the
frame-budget check, skipped headless. `outlines-sit-on-the-body-they-
outline`: 12 body meshes across both actors, 12 outlines, coincident.
`ragdoll-is-lite-and-freezes` unchanged. `the-rim-light-is-really-on-
screen` 1.9x / 2.3x, `the-outline-darkens-the-silhouette-edge` 117-141
against 8-9: the Shade's numbers, where they were.

**Left.** E3, animation, next: the six groups, the limb-end empties and
the rest pose are there for it, and the rifle rises with the right arm.
Josh looks at the figure (PLAYTEST.md, D41).

## F6 — a look, headless: `npm run shot` (2026-09-20, scheduled run)

The 02:00 run's second job, sized S, queued by E2 an hour earlier and
first by block order (Block F is the gate, and this is the gate's eye).
E2's verify (161/1/6 and 144/1/23) stood as the gate. E2 had seen the
Warden before committing it through a scratch script - the runner's
Chrome, the page loaded once, a camera placed by hand and
`renderer.domElement.toDataURL()` after a `render` - and every Block E
job will want the same, so it is kept, in two halves.

**`photograph(h)`** (src/tests/look.js) is the page's half. The stand is
the figure checks' own (`standAndEyes`, now exported from
tests/figure.js: the near end of the first clear lane with a 25m eye in
open air that sees it), so the photographs are of the place the numbers
were read at. Five eyes: front, side and three-quarter at 4.5m, and
down the lane at 8m and 25m; a side eye may be in a wall on some map
and is skipped with a reason, the other three are the stand's own. For
each eye both actors are placed side by side facing down the lane and
**spread across that eye's line of sight** - the first cut spread them
across the lane, and from the side eye the Shade stood in front of the
Warden - then drawn (never stepped: a stepped frame is the AI's and it
walks the Warden off the stand), rendered without and with them through
the lens, the difference counted, and the drawing buffer read as a PNG
data URL. **`scripts/shot.mjs`** (`npm run shot -- [--map id] [--out
dir] [--query ...]`) is the node half: the suite runner's server and
launch repeated (suite.mjs runs the suite on import, so nothing can be
imported from it), the page loaded once per registered map, the loop
stopped and 60 frames warmed as the suite does, `photograph` imported
through the page's own import map and its frames written to
`shots/look-<map>-<eye>.png` (gitignored), one line per eye with the
pixels the bodies cover. About 30s a map.

**`a-look-at-both-figures-photographs-every-eye`** (every map): a PNG
data URL from the front, 8m and 25m eyes always and from the side eyes
when they are in open air, the bodies on at least 6000 pixels at 4.5m,
2000 at 8m and 300 at 25m. Plant: front 27590, side 22910,
three-quarter 28366, eight 8610, far 886, no eye skipped; yard: 27882,
33349, 29122, 8244, 864, none skipped. Revert the job and the check
goes with it, which is what a check of a tool can say.

**Verified.** The three figure checks in a subset on both maps (3 / 3,
57s and 26s), `npm run shot -- --map plant` twice (30s, five PNGs, the
three-quarter frame read back: a helmeted guard with a rifle at the low
ready beside a hooded figure), then `npm run suite`, both maps twice:
**plant 162 passed, 1 failed, 6 not for this map (482s, 512s), yard 145 passed, 1 failed, 23 not for this map (207s, 214s)**, every outcome identical between
runs, 0 red, 0 flaky, 0 console errors, 0 context losses; the one
failure on each is the frame-budget check, skipped headless.

**Left.** E3, animation, next. The routine can now look at a pose
before it commits one.

## E3 — animation: a pose for every state, a stride for every step, the rifle raised to the aim (2026-09-20, scheduled run)

The 17:00 run's first job, sized M, the first unblocked in block order
after F6. The gate: `npm run suite -- --runs 1` on `7c71c70`, plant 162
/ 1 / 6 and yard 145 / 1 / 23, 0 red, 0 flaky, 0 console errors. (A
suite runner from the 09-18 17:00 run, the one the audit found, was
still there, idle at 1.7s of CPU in two days; this session was not
allowed to end it either.)

**What was there.** The Shade's `_animate` had a swing whose phase ran
on the clock at a rate by speed - the feet slid - and three poses that
replaced it on a snap: the hang, the air, the slide. A vault, a mantle,
a pull-up and a crouch had no pose at all (a crouch was the squash of
the whole mesh and nothing else; a vault was a standing body carried
over the crate). The Warden had the swing and the stun.

**`src/entities/pose.js`** is the mechanism (D42 argues the numbers):
one target record per body, twelve fields (the body group's lean,
roll and lift, the head's pitch, each limb's x and z), filled in place
every frame by the state and every group eased toward it by `easePose`
the shortest way round over `POSE_BLEND` 0.2s - all of it when `wallDt`
is 0, which is what `reset()` passes, so a reset draws the pose it is
given. A state change is a movement rather than a replacement, and
nothing allocates after construction: the record is the body's, the
ease is arithmetic on the groups' own Euler fields, and `_posture` in
both controllers reads `POSE` tables that are module constants. The
gait's phase advances by the ground covered, `speed * wallDt * pi /
stride` with the band's footstep stride, so a foot plants about when
the step sounds and a body that stops stops mid-stride and eases to
rest; the amplitude is by speed as before. Both mesh builders carry
`userData.baseY` on the body group for the lift.

**The Shade** (agentvisual.js `_posture`, 100 lines over the old 60):
the breath standing; the crouch leant forward with the thighs bent under
the squash and the hands ahead; the slide leant back, legs out, the
left hand trailing; the air rising with a stride held and the arms
back, falling with the legs together and the arms out by the fall
speed; the reach - a press that has armed a climb with a face under the
hands (`_climbArmed && _faceAhead`) puts both arms up and forward, so
the grab that follows comes up over the front (from the old air pose
the short way to straight-up was through the back, a windmill); the
vault with the hands planted ahead and down through the first half and
pushing off behind by the end, the legs tucked and the torso leant by a
bell over the move; the mantle with the hands over the lip above the
head pressing down as the body comes up, the right knee over; the grab
and the hang as B8 left them; the pull-up, whose arms walk from
straight up the LONG way to ahead-and-down - the target goes down
through -pi, the ease keeps every angle in (-pi, pi] and takes the short
way to a target that never moves far in a frame, so it goes round with
it and the hands pass in front of the body; the landing as a squat with
the arms out by `_landRecovery / landing.recovery`, the weight while the
recovery holds the speed down. The scuff and the knife arc still write
their arms over the top as the timed tells they are; the ease takes the
arm back when they end.

**The Warden** (enforcer.js `_posture`): the roll it had, a bob, a lean
into a sprint; the carry swung a little by the gait; the sights
(`adsBlend`, the value the FOV and the speed already read) raise both
arms by the rifle's carry pitch (0.35, so the barrel is level) and then
by the aim's pitch within a radian, so the rifle - a piece of the right
arm's part since E2 - points where the Warden looks, and the swing
leaves the arms; the head takes 0.3 of the pitch at the carry, all of
it plus a drop to the sight with them up. The stun drops the arms as
before and sags the chest and the head.

**The checks** (tests/animation.js, every map).
`the-shade-has-a-pose-for-every-state-and-a-stride-for-every-step`
drives every state through the real keys - the first clear lane for
the walk, the sprint, the crouch, the slide, the jump and a 5m drop;
`findGroundLedge` for a vault-height, a mantle-height and a hangable
ledge - and reads the twelve fields after each (mid-move for the timed
ones, at 40% of a vault and a mantle, 50% of a grab and a pull-up).
Every pose at least 0.25 rad from standing and from every other in
some limb: plant and yard alike, ten poses, the closest pair rise and
fall at 0.46. The leg across the vertical once a stride of the ground
covered - the ground between one crossing and the next within 15% of
the band's stride: walking 5.1m, crossings 2.10m apart against 2.1;
sprinting 7.7m, 2.60 against 2.6 (a swing on the clock, which is what
the first cut of the check could not tell apart by counting crossings,
reads 2.5 and 3.4 here); reaching 0.56 rad walking and 0.85 sprinting;
straying 0.000 standing. The hanging arms straight up; the pull-up's
left arm at 1.97 rad half way - over the front.
`the-warden-walks-heavy-and-raises-the-rifle-to-where-it-looks` (free
roam as the Warden): the carry at `REST` standing, the leg once a stride
(4.4m, crossings 2.00m apart against 2.0), the body rolling 0.050; Mouse2 held raising the right
arm 0.70 -> 1.05 rad and the right hand 0.15m in the world (the
gauntlet's `limb-end`, as tests/hang.js reads the glove); `look(0, 0.6)`
raising the arm to 1.65 and the head to 0.45; the carry back within
0.000 rad a second after the release; the stun dropping the arm to
0.10. Revert the job and both are red on the first pose.

**What did not move.** E1's and E2's silhouette readings are what they
were to the pixel at 25m (the Shade 40x12, the Warden 40x26; at 8m the
Shade's aspect reads 3.6:1 against 3.4 - the breath, which D40 already
noted moves between runs); the hang's glove is on the lip; the scuff's
arm is up on the scuff step; the camera's dips are what they were.
`npm run shot -- --map plant` read back: both at rest, drawn as before
(the rest pose is the carry and the stand, unchanged).

**Verified.** A ten-check subset on the plant (10 / 10, 55s) and a
six-check subset on the yard (6 / 6, 23s), the shot, then `npm run
suite`, both maps twice: **plant 164 passed, 1 failed, 6 not for this map (469s, 523s; the plant's two runs loaded the check before its stride measure was tightened, so the plant ran twice more on the final text: 164 / 1 / 6, 467s and 537s), yard 147 passed, 1 failed, 23 not for this map (232s, 208s)**, every
outcome identical between runs, 0 red, 0 flaky, 0 console errors, 0
context losses; the one failure on each is the frame-budget check,
skipped headless.

**Left.** Nobody has seen a vault posed: `npm run shot` draws the
figures at rest, and a look at a pose mid-move wants the photograph to
step the Shade into one first - queued as F7 (S), which block order
puts before E4, the plant's materials. The pose numbers are all in the
two `POSE` tables and D42.

## F7 — a look at a pose: `npm run shot -- --pose` (2026-09-20, scheduled run)

The 17:00 run's second job, sized S, queued by E3 an hour earlier and
first by block order (Block F is the gate, and this is its eye on a
pose). E3's verify (164/1/6 and 147/1/23) stood as the gate.

**`strike(h, name)`** (tests/animation.js) is E3's driving, factored
out: the walk and the sprint left mid-stride (to speed, then to the
frame after the leg's furthest reach), the crouch held, the slide from
a sprint, the jump on the way up and on the way down, a hard landing
while the legs take it, and the climbs at the ledges `findGroundLedge`
finds - a vault and a mantle 40% through, a grab and a pull-up 50%
through, a hang settled - every one through the real keys, the keys
cleared after and nothing stepped since, so the body is where the
state left it. `STRIKES` names them in order. E3's check now drives
through it (the same readings to the digit: closest pair 0.46, crossings
2.10 / 2.60 / 2.00 apart, the pull-up's arm 1.97), so the photograph
and the check cannot disagree about what a state is.

**`photographPose(h, name)`** (tests/look.js): the Shade struck, or the
Warden in free roam with Mouse2 held sixty frames (`aim`, first person
hides the body and it is shown for the frame); the other actor hidden;
the eye 4.5m off the body's smoothed position at the first of six
angles - front-left, front-right, left, right, back-left, back-right -
that is in open air and sees the body's middle (a vault is over a
crate and the front-left eye is in it; a hang is at a face and the
front eyes are in the wall: those two frames come from the side); the
drawing buffer as a PNG, the pixels the body covers, and the state the
body was in with the move's progress. `npm run shot -- --pose
<names|all>` (scripts/shot.mjs) writes `shots/look-<map>-pose-<name>.png`
with one line per pose. The plain shot's path is untouched.

**`a-look-at-a-pose-photographs-the-state-named`** (every map): all
thirteen reach their state, find an eye and return a PNG with the body
on at least 3000 pixels. Plant: walk 7945, sprint 8080, crouch 4894,
slide 4397, rise 8557, fall 8975, landing 9429, vault 6438, mantle
6509, grab 7792, hang 7786, pullup 6321, aim 20489; yard 4480 to 20489,
the mantle from the right eye there. Revert the job and the check goes
with it, which is what a check of a tool can say.

**What the frames say** (read back with the Read tool): the sprint is
a full stride with the arms swinging and a lean; the crouch is low and
forward with the boots a hand off the floor (the squash shortens the
legs and the pose bends them - PLAYTEST.md's question); the slide is
flat, legs out, one hand trailing; the vault at 44% is a hurdle over
the crate's edge with the hands down and the legs out ahead; the
mantle at 40% has the hands on the lip at shoulder height and a knee
up; the pull-up at 51% has the hands on the lip in front and the body
rising past it, a leg kicked back; the aim holds the rifle level at
the chest with the head down on it. Two small teal squares on the
plant's floor near site A are the map's, in the frame at every pose
there and not a limb.

**Verified.** `npm run shot -- --map plant --pose all` (13 PNGs, 35s),
the plain shot (five frames, coverage within a dozen pixels of E3's
run: the breath), a four-check subset on the yard (4 / 4, 28s), then
`npm run suite`, both maps twice: **plant 165 passed, 1 failed, 6 not for this map (489s, 552s), yard 148 passed, 1 failed, 23 not for this map (237s, 222s)**, every
outcome identical between runs, 0 red, 0 flaky, 0 console errors, 0
context losses; the one failure on each is the frame-budget check,
skipped headless.

**Left.** E4, the plant's materials, next; a Block E job can now look
at a pose as well as a figure before it commits.

## Audit — 2026-09-20

**Landed.** Week 2026-09-12 → 09-20; oldest commit `7bec4fc` (B4,
2026-09-12 17:44). 53 commits, 43 of them since the last audit
(`c57e5a9`, 09-13). 29 entries under Done in QUEUE.md carry a date in
the window: B3, B4, B4b, B2b, B5, B6, B5c, B7, B8, B9, B8b, C1, C2, C3,
C4, F5, C5, C6, D1, D2, D36, D3, D4, D5, D6, D7, E1, E2, F6 — 23 of
them since the last audit. Blocks C and D closed this week (D3b waits on
D38); B is closed but for B5b (D25) and B5d (D27); F took F5 and F6; E is
open at E3. Queued during the week, by id, against the queue at
`7bec4fc`: 9 (B5b, B5c, B5d, B8b, D36, D3b, D7, F5, F6), 6 of them
already done. At HEAD: 7 `[ ]` open (B5b, B5d, D3b, E6 blocked; E3, E4,
E5 free), 0 `[~]` WIP. B5c, `[~]` for one run at the last audit, closed
2026-09-14. E6 says *blocked: D10*, and D10 sits under the Provisional
heading with an empty `decided:`; nothing reads that as blocking yet.

**Blocked on Josh** (`decided:` empty, under the Blocking heading): D8
site ring, 12 days (2026-09-08; nothing waits on it). D13 map-change
placeholder, 12 days (nothing waits). D25 deck void edges, 7 days
(2026-09-13; blocks B5b — the recommendation, option 1, is what is
built). D27 defuse through a floor, 6 days (2026-09-14; blocks B5d;
recommendation option 2). D38 the Shade on the Warden's stair, 2 days
(2026-09-18; blocks D3b; recommendation option 1, as built). Decided
but still filed under Blocking: D14, D15, D20, D23, as last week.

**Suite health.** HEAD `ae89df1`, `npm run suite -- --runs 1`, both maps:
plant **162 passed, 1 failed, 6 not for this map** (488s); yard **145
passed, 1 failed, 23 not for this map** (213s); red [], flaky [],
expectedRed [], unexpectedGreen [], skipped 2 (the frame-budget check,
once per map, outcome fail), consoleErrors 0, contextLosses 0. Matches
HANDOFF.md (162/1/6, 145/1/23) and the empty Deliberately-red list:
**pass**. The run took 12 minutes with the 45s cooldown, past the
10-minute limit the audit task gives the Bash tool; it survived only
because it was backgrounded. Diff `7bec4fc..HEAD -- src/tests
scripts/suite-skips.json`: 40 files, +6,607 / −110. Looked for looser
thresholds, removed assertions, deleted checks, new skips:
- `scripts/suite-skips.json` unchanged: the one frame-budget entry. No
  check deleted; no numeric comparison loosened (every changed `<`/`>`
  line in the diff is an addition). The census predicate
  (`tests/readability.js:278`, `wideTop(box) && reachable`) is as the
  last audit left it.
- **23 checks were scoped to one map this week** — `+ maps: ['plant'],`
  on each, e.g. `swept-collision-no-tunnelling`: `+    maps: ['plant'],
  // drives into the plant's west perimeter wall at x=-30`. Total now 24
  plant-only, 6 yard-only. On the plant nothing got looser; on the yard
  the five clauses those checks held in the regression set are held by
  D7's `tests/anymap.js` (`a-body-driven-into-any-solid-never-passes-
  through` etc.), and `the-regression-set-resolves-to-real-checks` is
  red on any map where a number goes uncovered. Flagged because a
  scoped check is one that stopped running somewhere.
- Two preconditions widened by definition, both D2: `tests/plantcensus.js`
  `- if (!kinds.floor || !kinds.top || !kinds.vent) {` → `+ if
  (!kinds.floor || !kinds.top || !inside) {` where `inside` is ducts plus
  crawl spaces; `tests/plantrule.js` `a-charge-cannot-be-planted-inside-
  anything`: `- .filter((spot) => spot.kind === 'vent')` → `+ ... ===
  'vent' || spot.kind === 'crawl'`. The clause (a lid over the charge) is
  the same; the yard's crawl space now counts as "inside".
- Five checks that stood at Turbine Hall coordinates now search for a
  lane (`clearLane` / `litLane`, tests/lanes.js) — the removed lines are
  `h.warden.position.set(-24, ...)` and the like in ai.js, detection.js,
  gadgets.js, shade.js, warden.js. Same assertions, found geometry.
- Tighter, not looser: `tests/movement.js` `- if (!hold)
  h.input.heldCodes.delete('Space');` → `+ if (i >= releaseAt) ...` with
  D36's 250ms tap and 500ms hold asserted; `tests/visual.js` (F5) asserts
  the death camera's wall-clock guard did not fire.
- Game numbers, not check numbers (B8, D29 provisional): `config.js`
  `hangDrop` 1.35 → 2.05, `hangPullUpDuration` 0.55 → 0.65.

**Drift.** Over 600 lines: `src/config.js` 1,465 (was 1,282; exempt).
TODO/FIXME: 0. `Math.random`: 1 real use, `systems/audio.js:97`, the
noise buffer. `setTimeout`: 1 real use, `tests/performance.js:82`, in a
check. Both as documented.

**Fresh seeds.** `--subset "fuzz|soak" --query "seed=20260920"`: 2 checks
per map (`shade-invariants-under-fuzz`, `traversal-fuzz-ten-thousand-
steps-never-sticks`), 4 passed. Widened to `fuzz|stall|stuck|leaks-
nothing|random-real-input|never-climbs`: 7 per map, **14 passed, 0
failed** (the yard's soak 3-0 3-0 3-0, 0 re-paths; the traversal fuzz
10,000 steps at 139 / 152 approaches). Nothing to queue. **But the seed
never reached them**: every fuzz and soak check pins its own —
`tests/fuzz.js:69` `seed: 8675309`, `tests/traversalfuzz.js:217,260`
`seed: 20260914` and `197…`, `tests/aisoak.js:107` `SEED + m * 16`,
`tests/shade.js:39` `rng.reseed(0xf0f0f0)`, `tests/wardenground.js:58`,
`tests/difficulty.js:225` — and `initMatch` takes an explicit seed over
the URL's (`main.js:124`). The weekly fresh-seed run has been re-running
the builder's seeds under a new name since it started.

**Environment.** A `npm run suite` from the 2026-09-18 17:00 build
(started 17:40:19, `node scripts/suite.mjs` plus a headless Chrome,
listening on 127.0.0.1:54315) was still alive at 10:22 today, 41 hours
on, and shared the CPU with this audit's suite. The audit tried to end
it and the session's permission classifier refused; it is Josh's to
close (Task Manager: node.exe and its chrome from 09-18). The likely
cause is the same as above: a run that outlived its Bash timeout and
kept going.

**Recommendation.** Make `?seed=` mean something to the fuzz and soak
checks: have each take `deriveSeed(location.search)` when the URL names
one and fall back to its pinned seed otherwise (one line in `initMatch`
or in each check), so the weekly run explores a new week. Until then the
"Fresh seeds" line above is the builder's own seeds, green again. And
two lines under D25 and D27 would close Block B.

## E4 — map materials, the plant: concrete, paint and glass, grime and decals (2026-09-21, scheduled run)

The 02:00 run's first job, sized M, the first unblocked in block order
(B5b, B5d and D3b wait on D25, D27 and D38). The gate: `npm run suite
-- --runs 1` on `298aaca`, plant 165 / 1 / 6 and yard 148 / 1 / 23, 0
red, 0 flaky, 0 console errors; then a `--details` subset of every
pixel check on the plant, for the readings to hold the job to.

**What was there.** One 4-step ramp for everything (`createToonGradient`,
view.js, boot's), every solid a flat colour with the contact tint, and
the material language of B6 - concrete is what you do not pass through,
metal what you do - carried by colour alone. No texture anywhere, by
Section 2's rule against images.

**Finishes** (`src/mapmaterials.js`, `CONFIG.map.finishes`; D43 argues
the numbers). A map that opts in - `new GameMap(..., { finishes })`,
the plant does, the yard waits for E5 - draws every solid in one of
three finishes by its palette colour (`byPalette` names entries, not
hex, so a retuned colour keeps its finish; anything unnamed is
concrete): concrete, paint (`ductMetal`, `wardenGunmetal`,
`wardenSteel`, the hazard pair) and glass. A finish is a **ramp** and a
**grime**. The ramp is `createRamp(levels)`, the Section 4 gradient map
from a list - eight texels, a quarter of dotNL each: concrete matte,
eight gentle steps `[0, .2, .4, .55, .7, .8, .9, 1]`; paint glossy,
three hard bands `[0, 0, .45, .45, .45, 1, 1, 1]` - shadow, a flat body,
the full face from a quarter on; glass `[.4 … 1]`, never black. The
grime is a 128-texel tiling `DataTexture` from a hashed lattice noise
(`hash2`, `valueNoise` - deterministic by coordinate, not a random
call, so Section 2's one rng is untouched), layers of cells per tile
mapped onto [low, high], concrete with a low-frequency stain that
darkens further above a threshold: concrete blotched (6m a tile, 0.86
to 1), paint streaked (32 cells across and 3 down, 3m, 0.86 to 1),
glass smudged (2m, 0.9 to 1). sRGB, since the multiply is against the
palette's colours - which is why it darkens more than the texel says
(a mean texel of 0.94 took a fifth off a lit floor at 0.88, a seventh
at this). **`applyWorldUVs`** (called from `addSolid`) writes every
box's UVs from its world position along the two axes each face lies
in, so a crate and the slab under it wear one grain and a 38m plate
does not stretch a tile; the texture's `repeat` turns metres into
tiles. `createMaterialCache(gradientMap, finishes)` (mapbake.js) puts
each colour on its finish's ramp and map; the lit variant (B7) keeps
the finish, and emissive is untouched by a map in three, so a lit
stage still steps up by exactly `routeLighting.emissive`. `entries()`
on the cache is for the check.

**Decals** (`src/mapdecals.js`, `src/maps/plantdecals.js`,
`CONFIG.map.decals`). A 2x2 atlas drawn in code from the same noise: a
stain (a blotch with a noise-broken edge), a drip (streaks hanging from
the top edge, each its own length), a scuff (two wheel tracks, broken,
trailing off) and a hazard kerb (orange and dark blocks, aged, with a
clear margin). Each decal is a `PlaneGeometry` laid 1.2cm proud of a
face by `face` and `along` (its v axis in the world: up on a wall,
north on a floor unless told), UVs moved into its tile, merged into two
meshes for two draw calls: the grime kinds on a `MeshBasicMaterial`
with `MultiplyBlending` so the surface's own lighting shows through
(fog off - a fogged multiplier darkens the whole quad at distance;
`premultipliedAlpha: true`, which r180 requires for a multiply and
without which it logs an error a frame and draws the quad opaque
white: the first subset run had 161 console errors and a stain at
luma 188 over a floor at 8), the hazard on a `MeshToonMaterial` on
paint's ramp cut out by `alphaTest`. `mergeGeometries` now carries uv
when every part has it. Twenty on the plant: wheel tracks in through
both roller doors and on the apron outside the north one, a kerb across
each threshold, leaks in the bay, the hall, the corridor, the deck and
the vault, rain drips from the roof line down the hall's west wall,
deck drips down the bay's north wall and the hall's east. None within
reach of a climb, a duct mouth or a site ring: the map's list says
where, `map.decals` records each for the checks, nothing in the game
reads them. Section 5 amended still holds - nothing marks a climb.

**The checks** (`tests/materials.js`, plant only):
1. *`the-plant-is-dressed-in-three-finishes-and-the-grime-is-on-the-wall`*:
   three finishes; the palette sorted as configured; every ramp's
   texels are its configured levels and concrete's is not paint's;
   every material the map made (eight: two concrete, six paint) is on
   its finish's ramp and grime, lit variants and glass included; then
   the pixels - the deck's underside over the north corridor under its
   lamp (concrete) and the south duct's outer wall in the hall (paint),
   each read square on from 2.5m, the crop with the grime minus the
   same crop with the texture taken off every material of that finish
   (and put back) is the grime itself, whatever the lighting's own
   bands do: it varies pixel to pixel by at least 1 luma and darkens by
   at least 2. Readings: concrete spread 4.13, darkens 7.8 at luma
   101; paint 1.95, 6.5 at 80. The first instrument was the crop's own
   standard deviation grimed against plain, on the hall's west wall at
   luma 20: 1.48 against 1.30 - a surface that dark hides a tenth of
   itself in a level, and the ramp's bands were most of the spread
   either way. Read under a lamp, by difference, it is the grime.
2. *`the-plant-wears-its-decals-on-its-faces-in-two-draw-calls`*: at
   least twelve decals, every kind used, each with its surface point
   inside a solid and its lifted point in clear air (`isClear` on a
   centimetre box either side), none within the ring's clearance of a
   site; two draw calls shown minus hidden from the bay; every floor
   stain read from 2.2m over it takes at least a tenth off the floor's
   luma and the deepest at least 3 (hall-leak-west 16.6 to 12.3,
   deck-leak-north 14.7 to 11.2, the corridor's 2.9 to 2.2); the kerb
   changes 287,265 pixels when hidden. With the multiply broken the
   stain check went red at "188.2 against 8.0 bare".

**The pixel checks that were green, before and after** (the plant,
`--details`): vent mouths 0.26 to 0.81 → 0.26 to 0.88, the thinnest
(the north duct's west mouth against the crates) 0.26 both times;
routes from the foot: stack-hall-low 0.30 → 0.29, stack-bay-low 0.46 →
0.51, stack-vault-low 0.59 → 0.60, fire-escape-base 0.61 → 0.63,
fire-escape-3 0.46 → 0.48, steps 16-27 → 15-30; lit pools site A 28.5
→ 24.5, B 20.2 → 17.5, C 12.7 → 10.2, ambient 1.8/1.8/2.6 → 1.1/1.1/
1.9, hall over vault 2.24x → 2.40x; the rim +112.1 → +110.6 at the
silhouette against +54.4 → +52.5 inside (2.1x both); the dim 42 → 42.3
hidden and 109.7 → 110.7 lit; the outline's edge 144.4 → 145.3; the
alarm fixture 5280 pixels both times, 1352 → 988 of them left after it
is destroyed; the death camera, the figures and the poses within a few
dozen pixels of the same frames. The first ramps
(concrete brighter at mid angles, paint darker at grazing) put the
north mouth at 0.25 against 0.25 and stack-hall-low at 0.26; the
crates and the ducts read against concrete, so concrete's mid-tones
have a ceiling and paint's a floor, and the config says so. The
darkening is the grime: a seventh off a lit floor. Every relation the
checks hold - pools over ambient, hall over vault, a step over unlit,
a duct against its wall - is unchanged or better; the absolute level is
lower, and D43 says so for Josh.

**Draw calls and the budget.** Two more draw calls for every decal on
the map; no new material per box (the cache is still by colour); three
more textures and three programs (the map variants of toon, lit toon
and glass) in the leak check's snapshot, unchanged across its five
rounds. The frame budget is not measurable headless (SwiftShader draws
a frame in 400-600ms); the CPU side of the sweep is as it was. A GPU
reading is Josh's.

**What the frames say** (the probe's PNGs, read with the Read tool):
the crates and the ducts carry fine vertical streaks and the ducts show
the three hard bands - a dark underside, a flat side, a bright top;
the concrete walls and the deck's underside are softly blotched, the
odd larger stain; the drips hang from the roof line down the hall's
west wall; the kerbs read as painted blocks across the door; the wheel
tracks are faint on a floor that dark. One thing seen that is not
E4's: the east shell wall, at a grazing angle, carries fine diagonal
stripes - the key light's shadow map on a wall nearly parallel to the
light, there with the old ramp and gone with the shadow off. Queued as
F8.

**Verified.** Subsets while iterating (three runs of the affected
checks on the plant, 130s each); then `npm run suite`, both maps
twice: **167 passed, 1 failed, 6 not for this map, 148 passed, 1 failed, 25 not for this map**, every outcome identical between
runs, 0 red, 0 flaky, 0 console errors, 0 context losses; the one
failure on each is the frame-budget sweep, skipped headless.

**Left.** E5, the yard's materials (containers, rust, painted numbers,
wet ground): the kit is there - a finish is a ramp and a grime spec, a
map opts in with its own `byPalette`, and decals are a list. F8, the
shadow stripes. Whether any of it reads is D43.

## F8 — the key light gives nothing to a face it lights from behind (2026-09-21, scheduled run, Josh present)

**Gate.** Yard 148 passed / 1 failed / 25 not for this map, 0 red, 0
console errors. The plant's gate was E4's verify at `2c25f18`: the
three commits since (`1702579`, `650b44f`, `44405da`) touch only
QUEUE.md, HANDOFF.md, DECISIONS.md and PLAYTEST.md. Josh interrupted
the plant run and said to run the next six jobs; his decision commit
(`44405da`, D8, D13, D25, D27, D38) landed while F8 was under way.

**What the stripes were.** E4's probe left the question at "the ramps'
back-light times the shadow term". The first thing this run measured
settled why the shadow term varies at all on a wall under a roof: it
does not compare against the roof. The key comes in over the shell
wall's top from +x (`shell-east-2`, x 30-30.4, the key travelling
(-0.39, -0.87, -0.30)) and the only thing between the light and the
wall's inner face is the wall itself - and three's shadow pass draws
**back faces**, so the depth it stores for that texel is the inner
face's own. The receiver compares its depth with itself: the 1024-map's
texel staircase, ±half a texel of 10cm stretched to 26cm along a wall
at 67° to the light, which is why a normal bias of 0.15 (6cm along the
light) did nothing. A Lambert never shows it (dotNL < 0 is black); a
toon ramp lights the back half of dotNL and shows all of it. Along
row 300 from the probe's eye the wall read 22-28 luma in a sawtooth
with the shadow on and a flat 29-31 with it off.

**The fix** is option 2 of the three queued: `noKeyLightFromBehind
(material)` in `src/mapbake.js`, an `onBeforeCompile` that resolves
`lights_fragment_begin` and multiplies the shadow-casting directional's
term by `step(0, n.L)` - a face behind itself is in its own shadow,
which is the answer a map of infinite resolution would give. Only the
key: the fill, the hemisphere and the lamps still wrap round to the
shadow side of everything (the toon ramps are as E4 left them). The
material cache applies it to every material it makes - toon, lit toon,
glass - under one program key (`bl-no-key-from-behind`), so the program
count moves by at most one per map (the map's toon program no longer
shares with an unpatched toon material's: the yard's leak check reads
14 programs, 13 before, unchanged across its five rounds). The actors
keep their own materials. Not chosen: zeroing the ramps' back texels
(it would take the lamps' wrap off every shadow side too) and a larger
back-facing normal bias (it is the wall's own depth whatever the bias).

**What it does to the numbers.** The east wall from the bay: rows
200/300/400 at luma 24.2/25.0/25.9 with 23/21/12 level-crossings before,
16.3/16.9/17.9 with 2/0/1 after - a third darker and plain. That
darkening is exactly the key's noisy wrap on faces the key lights from
behind that nothing else shadows: the shell walls' inner faces, the
exterior's west and north faces. Every check that reads the plant's
light is unchanged to the digit - `lit-pools` 24.5/17.5/10.2 over
1.1/1.1/1.9, the sites 84.4/36.9/9.0, the nine mouths, the twenty lit
stages - but one landing edge, `lip-hall-south` 224 against 20 (25
before), contrast 0.83 (0.80): the surround was such a face. The yard's
floodlights, pools, gaps and walkway read the same to the digit.

**The check** is `a-wall-the-key-lights-from-behind-reads-plain`
(`src/tests/keylight.js`, plant - the done-when said tests/visual.js,
which is at 588 lines, so the check has its own module and index.js
registers it after visual's). From E4's eye it reads three rows across
the wall and counts the crossings of each against its own smoothed
copy (a box mean 15 either side, a band of 0.5 luma before a side
counts, so the ramp's own level steps do not), ceiling 6 a row; holds
the key casting, the shadow map on, the key really travelling toward
-x so the wall is behind it, and every map material on the patched
program key. Then the second half: it strips the patch off every map
material at runtime, requires all three rows over the ceiling, restores
them and requires the plain readings back - a smoothness reading that
cannot fail is not a reading. Read: 2/0/1 on, 23/21/12 off.

**Also this run.** The suite runner from the 09-18 17:00 build (`node
scripts/suite.mjs`, pid 4792) is still alive at 41+ hours; the audit
could not end it and neither could this run (the auto-mode classifier
refuses `Stop-Process`). It is Josh's to kill. `find /` from a Bash
call ran past its cap looking for a local three build; there is none,
the import map pins the CDN, and the shader chunk text came out of the
page through the probe instead.

**Verified.** Subsets while iterating (the F8 subset on the plant, 9
checks in 138s; the yard's light and walkway checks, 9 in 22s); then
`npm run suite`, both maps twice: **168 passed, 1 failed, 6 not for this map**, **148 passed, 1 failed, 26 not for this map**,
every outcome identical between runs, 0 red, 0 flaky, 0
console errors, 0 context losses; the one failure on each
is the frame-budget sweep, skipped headless.

**Left.** F9, the probe in the repo (this run used E4's scratch copy
again). Whether a wall a third darker on its shadow side reads right is
eyes' work, under D43.

## F9 — a probe: `npm run probe` (2026-09-21, scheduled run, Josh present)

**Gate.** F8's verify at `84315c3`: plant 168/1/6 twice, yard 148/1/26
twice, 0 red, 0 flaky, 0 console errors.

**What was built.** `scripts/probe.mjs` - `npm run probe -- [--map id]
[--out dir] [--query q] <file.js> [...]`: loads the page on one map (the
first registered without `--map`), stops the loop, warms 60 frames, and
runs each file's text as the body of an async function with `h` and
`THREE` in scope, so top-level `await` and `await import('/src/tests/
pixels.js')` work; prints what it returns as JSON to stdout, writes any
`pngs: [{ name, dataUrl }]` it returns to `shots/` first (and says so on
stderr), and a file that throws prints the error and exits 1, no file
exits 2. Several files run in turn in the same page. E4 and F8 were
diagnosed with a scratch copy of this in two sessions' scratchpads; an
instrument lives in the repo.

**`scripts/headless.mjs`** is the server, the launch, the page and the
map load, shared: `ROOT`, `MIME`, `parseArgs` (positionals under `_`
now), `listArg`, `registeredMapIds`, `serve`, `launch`, `openPage`,
`loadMap`, `writePng`. shot.mjs imports it and is 60 lines shorter for
it; probe.mjs imports it. suite.mjs keeps its own copy - it runs the
suite on import and adds the throttle token to the launch - with a
note in its header to keep the two in step, which is the note shot.mjs
used to carry.

**Verified.** The probe on F8's own p3.js on the plant: the same
readings the check quotes (2/0/1 crossings on, 23/21/12 off) and two
PNGs in shots/, 28s; a file that throws exits 1 with the stack on
stderr; no file exits 2 with the usage. `npm run shot -- --map plant`
through the shared launch: five frames from the lane at site A, 35s.
The two look checks through the suite on the plant: 2 passed. No
source under src/ changed, so F8's four-run verify stands for the
suite; B5d's verify, next, runs on this tree.

**Left.** Nothing of F9's. Block F is closed again.

## B5d — the defuse reach is a clear line (2026-09-21, scheduled run, Josh present)

**Gate.** F8's verify at `84315c3` (F9 changed no source under src/):
plant 168/1/6 twice, yard 148/1/26 twice, 0 red, 0 flaky, 0 console
errors.

**D27** (Josh, 2026-09-21): "no" - a Warden may not defuse through a
floor. The reach was two distances and knew nothing of what lay between
them, so the north duct's roof under the deck (3.6m up, the deck 2.4m
over it) was a legal plant and the AI defused it from the deck through
0.3m of slab.

**The rule.** `withinDefuseReach(foot, at, collision)`
(systems/plantrule.js) is the distances and then a line: `DEFUSE_LINE`
= six points on the segment from the Warden's feet to its raised hands
(`DEFUSE_REACH.dy` up), each a 0.1 skin off the floor it stands on, to
the charge 0.1 off the surface it rests on - so neither end starts
inside the box it touches; `collision.lineOfSight` from any one of them
with every solid box in the way counts, glass too. The world is
required: a caller that measures the distances alone throws, so the two
sides cannot drift. The defuse in objective.js passes `this.map.
collision`; `canDefuseAt` passes `map.collision` through
`someCellWithin`'s context, a reused module object (nothing allocated
on the plant hold's step); the census's two call sites pass
`h.map.collision`. A Warden beside a crate reaches the charge on top of
it from its hands over the crate's edge; one over a floor does not; one
behind a thin wall does not.

**What moved.** The census went from 366 legal plant spots to 364 of
381: the north and south duct roofs under the deck (4 of 21 tops out of
reach, 2 before), and nothing else - the prediction under D27, to the
spot.

**The AI had to move with it.** The first subset had two reds, both
the same thing: the room-A sample of `every-legal-plant-has-a-warden-
who-can-reach-it` became the south duct's lip, the Warden walked to
1.0m of it and stood in DEFEND for 30s without kneeling, and the
last-leg check's route ended "1.3m from the charge, outside the defuse
reach". DEFEND walked to the charge's own XZ and held by a radius
(`defendHoldRadius`, 1.4m), which under the duct is a cell the line
through the duct's floor refuses. Now `standAt(position, snap)`
(mapground.js) takes an optional `snap.accepts(cell, position)`;
`defuseSnapFor(map)` (aistate.js) is the reach itself with the map's
world; `setDefendTarget` finds `_defendStand`, the nearest cell the
reach accepts, and paths there; `_stepDefend`, arrived, asks
`withinDefuseReach` of its own feet and re-paths to the stand if the
answer is no - so arriving means the defuse in objective.js agrees.
`defendHoldRadius` is gone from config. The last-leg check plans with
the same snap. The room-A sample now defuses the lip from beside it in
8.2s (the roof through the deck took 11.8s); the three-match soak on
the plant: 9 rounds, all defused, 0 stuck re-paths.

**The check** is `the-warden-defuses-along-a-clear-line-never-through-
a-floor` (`src/tests/defuseline.js`, plant; tests/plantrule.js is at
532 lines): a charge put on `vent-low-north-roof` the way a plant leaves
it, the Warden stood on the nearest deck cell over it inside the
distances, a second of the round with no AI, no progress; the same
beside the first legal crate top with Warden ground below it (the
south lip, 2.3m below), 1.00s of progress; then the slab the line from
the deck cell meets (`deck-7`) made non-solid, and the reach accepts
the deck cell - asked of the predicate, since a Warden stood on a slab
that is no longer solid falls through it - and refuses it again with
the slab back.

**Verified.** Subsets on the plant (8 checks in 45s after the DEFEND
fix; 6 of 8 before it); then `npm run suite`, both maps twice:
**169 passed, 1 failed, 6 not for this map**, **148 passed, 1 failed, 27 not for this map**, every outcome identical between
runs, 0 red, 0 flaky, 0 console errors, 0
context losses; the one failure on each is the frame-budget sweep,
skipped headless.

**Left.** Block B is closed. Whether a Warden reaching up beside a
crate reads right, and whether anywhere refuses that should not, is
eyes' work (PLAYTEST.md).

## C7 — the site is a tinted floor, and the HUD names it (2026-09-21, scheduled run, Josh present)

**Gate.** B5d's verify at `88d0813`: plant 169/1/6 twice, yard 148/1/27
twice, 0 red, 0 flaky, 0 console errors.

**D8** (Josh, 2026-09-21): "tint the floor slightly orange instead, and
the HUD should name the site (A / B / C) so the player knows which one
they are in." The 2m pulsing ring said "plant here" while the plant has
been the room since 20.1.

**The tint.** `bakeSiteTints(map)` (src/mapdecals.js), called by
`addSite` so a site that moves takes its tint with it: for every site
with a room, one quad per solid whose top is the room's floor (within
5cm) and whose footprint meets the room's rectangle, clipped to it, a
centimetre proud (`M.decals.lift`); the plates rather than the
rectangle, so the vault's hatch is a hole and not a tinted plane
hanging over the hall - nine quads in the vault, one in the hall, one
in the bay, one per yard bay. Merged into one mesh (`site-tints`,
`map.siteTintMesh`), each site's `tint` listing its quads for the
checks. A multiply, as the grime decals: `MeshBasicMaterial`,
`MultiplyBlending`, `premultipliedAlpha`, fog off, colour white lerped
toward `hazardOrange` by `M.marking.siteTintStrength`. The first
thought was a painted quad at a low opacity; the arithmetic killed it
before it was drawn - an unlit orange at 12% adds ten luma to a vault
floor at ten, a pool with no lamp, and `lit-pools` would have found the
ambient floor brighter than the lamps' contribution. A multiply is as
dark as the floor it lies on. The ring, `M.marking.siteRing*`,
`site.ring`, `GameMap.addDecal` and the pulse in `map.update` (and its
call in main.js's fixed step) are gone.

**The number.** 0.35 first: R/B up 1.21x on every plant site floor,
luma down 9.2-9.8% - at the done-when's tenth. 0.28: R/B 1.14-1.17x,
luma down 7-9% (site A 24.5 to 22.7, B 17.5 to 15.9, the vault 10.2 to
9.4; the yard's bays 26.9 to 24.7, 24.5 to 22.6, 21.0 to 19.4). Kept,
under D44. Every relation the light checks hold is unchanged: the pools
over ambient (1.1/1.1/1.9 with the lamps off, as before), the hall
2.42x the vault, the sites 84.4/36.9/9.0 to the digit, the nine mouths
to the digit, the twenty lit stages to the digit but one surround a
level darker (contrast 0.62 from 0.61); the yard's floodlights, gaps
and walkway to the digit, its pools two luma lower. The plant's decal
check reads its floor stains a little darker, the tint being under
them. The program count: the plant 16 to 15 (the ring's two basic
materials went, the tint's one came), the yard 14 to 15.

**The HUD line.** `#bl-site` in the prompt panel, "SITE A - Turbine
Hall", hazard orange, small, above the plant prompt. `gatherHudState`
(hudstate.js) finds the site by the player's own role - the Warden's
position at the Warden's stand height - and hands `siteHere: { id,
name }`; `promptInRange` is now the Shade's alone, where before the
Warden was shown "hold E to plant" whenever the *Shade* stood in a
site. `hud._updateCommon` shows the panel while there is a site or a
prompt, the line while there is a site, the text and the bar while
there is a prompt. The names are the sites' own, which are the
briefing's (C2).

**The ring's readers.** Four floor checks sampled "off the ring" at its
outer radius plus 2.5m; `SITE_SAMPLE_OFFSET` (tests/pixels.js, 3.5m)
keeps them on the same square metre, so every reading before and after
C7 compares. The decal clearance check reads the same constant.

**The checks** (tests/sitetint.js, every map; the done-when said
tests/visual.js, which is at 588 lines):
`the-site-floor-is-tinted-warm-and-the-ring-is-gone` - one `site-tints`
mesh on the root, a premultiplied multiply, no site with a ring, every
site with quads, every quad inside its room with a solid under it and
air over it; the lit-pools spot on every site floor read with the mesh
visible and hidden, R/B up 1.08x on the brightest site and no floor
darker than a tenth (plant: A 1.169x / 7.3%, B 1.157x / 9.0%, C 1.135x
/ 7.8%; yard: 1.143x / 8.4%, 1.159x / 7.6%, 1.174x / 7.8%).
`the-hud-names-the-site-you-stand-in` - the Shade reset 1.5m outside a
site room's first floor-level lateral entry, facing in, W held through
`input.heldCodes` until `siteNear` answers (0.5s, site A's east entry
on both maps), the frame drawn and `#bl-site` read off the DOM ("SITE
A - Turbine Hall"; "SITE A - Bay A"), S held until it does not and the
line hidden; then the Warden placed in site B, its line read and the
plant prompt hidden.

**The first full verify was red on one check**, and the subsets had
not included it: `the-vignette-deepens-with-lost-health-and-leaves-the-
centre-alone` (C3) reads the damage vignette's darkening over site A's
frame and wants 8 luma at half health; it read -9.0/-9.2 before C7 and
-7.6 after. A red vignette over a floor darker than the red reddens
without darkening, and the band had lost the bright ring as well as a
shade off the floor. The check is D31's number for that backdrop and
stayed; the vignette went deeper: `feedback.vignetteColor` 0x6e100c to
0x580d0a, -11.8 at half health and -21.2 at low, the centre untouched,
the hit marker and the meter feedback unchanged. Recorded under D44.

**Verified.** Subsets (the plant's light and HUD checks, 9 in 138s at
0.35, the two at 0.28 in 52s; the yard's 8 in 20s; the three feedback
checks after the vignette, 54s); the first `npm run suite` (plant 170
passed / 2 failed twice with the vignette red, yard 150/1/27 twice,
green); then again on both maps: **171 passed, 1 failed, 6 not for this map**, **150 passed, 1 failed, 27 not for this map**, every
outcome identical between runs, 0 red, 0 flaky, 0 console
errors, 0 context losses; the one failure on each is the
frame-budget sweep, skipped headless.

**Left.** Block C is closed again. Whether the tint reads as the site
from the doorway, and whether the line is where you look, is D44's for
Josh's eyes.

## E5 — map materials, the yard: corrugated, wet, rust, a box number (2026-09-21, scheduled run, Josh present)

**Gate.** C7's verify at `a1a8c40`: plant 171/1/6 twice, yard 150/1/27
twice, 0 red, 0 flaky, 0 console errors.

**The set.** `CONFIG.map.yardFinishes`, and `buildYardMap` opts in
(`new GameMap(..., { finishes: M.yardFinishes })`). Four finishes:
**corrugated** for every container whatever its tier colour (gunmetal,
concrete, orange), a glossy ramp `[0 0 .4 .45 .5 1 1 1]` and a grime
with **ridges** - `grimeAt` (mapmaterials.js) gained an optional
`ridges: { count, depth }`, a cosine profile along u, `count` to the
tile and the troughs `depth` darker (9 to 2.4m, a 27cm pitch, 0.22) -
under fine vertical streaks (48 cells across, 2 down) and a broad
stain; `applyWorldUVs` puts u along every standing face, so the ridges
stand vertically on every box and run on across a row, and along x on
the tops. **wet** for the ground and the fence (`concreteDark`): a
concrete lower in its mid-tones `[0 .15 .3 .45 .6 .7 .8 1]` with the
full face kept - the sheen of wet asphalt under a floodlight - and a
grime of broad puddles: an 8m tile, three cells to it, a stain that
takes 0.45 above 0.5. The first puddles (0.2 above 0.55) read a spread
of 0.6-0.8 on a floor at luma 20 from any height; a texture on a dark
floor hides in a level, as E4 found, and the ground here is dark by
design (D9). Deeper puddles, and the read moved to the brightest
ground in the yard, the lane under the gate mast (luma 25): spread
1.80, darkens 3.4. **paint** and **glass** are the plant's, for the
walkway's steel and its panes; the walkway's slab and parapet are
`concrete` and so in the containers' sheet.

**The atlas is 4x2.** `ATLAS_COLS`/`ATLAS_ROWS` in mapdecals.js, the
tile still `D.atlasSize / 2`; the plant's four tiles are where they
were and its checks read to the digit. Two paint kinds join: **rust**,
a band up from the tile's foot with its top broken by noise and pitted
within (`rustAt`, a brown-orange), and **stencil**, "BLKU 2607 1" in a
3x5 bitmap font drawn in code across the tile's middle, worn through
by noise (`stencilAt`, a pale grey; the first wear at 0.3 ate whole
letters - "B LU 2607 1" in the probe's PNG - 0.18 now). Both on the
paint finish's ramp where the map has one, so they shadow and dim with
the night. Rust is a decal and not a finish because rust that pools at
the ground is a fact about world height, and a tiling grime does not
know where the ground is.

**`src/maps/yarddecals.js`**, seventeen: six rust bands at the foot of
the rows (the ring's north row west of bay A's stack, both lane rows
on their bay side, the ring's east row across from the trailer, bay
C's west row facing in, the ring's south row west of bay C), four
stencils at eye height, tracks through both gates, a kerb inside the
south one, oil where the trailer backs into bay B, in the west store
and under the walkway's south edge, a drip down bay A's south row
under its mast. The first oil was *under* the trailer bed, where the
check's eye 2.2m up saw the bed's top and not the ground - moved
beside it. Every container face on the yard is a climb (the tops are
one deck), so Section 5's clause is kept the other way round: nothing
on a declared route's first stage or the ground at its foot, nothing
within `SITE_SAMPLE_OFFSET` plus half a decal of a site's centre, and
nothing on the spots `the-yard-is-dark-between-its-pools` reads.

**What the frames say** (`npm run probe`, F9's, on the yard): the
container side reads as vertical ridges under streaks, the stencil as
a stencil at 3m; the ground from 6m up is dark with a faint mottle
of puddles and the container tops' ridges bright along the frame's
edges.

**What it did to the numbers.** The yard's pools 24.7/22.6/19.4 to
21.1/17.9/14.5, the gaps 3.0/4.9/3.0 to 2.8/4.1/2.3, the sky alone
7.3/2.9/7.3 to 5.8/2.3/5.0 - the wet ramp's mid-tones - and every
relation the check holds (a gap under half the dimmest pool, the sky
under a third of the brightest, nothing under 1) holds; the site meter
57.9/58.2/41.8 as before, being the model's; the masts, the deck, the
walkway's rays and the Warden's stair to the digit; the tint check's
ratios 1.16-1.17x. Programs 15 to 18 on the yard (four finishes' toon,
lit toon and glass in place of one ramp's), textures 2 to 11, all
unchanged across the leak check's rounds.

**The checks** (`src/tests/yardmaterials.js`, yard; `hideActors`,
`rampLevels`, `readGrain` - with a `standOff` argument now - and the
thresholds exported from materials.js):
`the-yard-is-corrugated-wet-and-numbered` - the four finishes, the
palette sorted into them, every ramp as configured, wet under concrete
in two of three mid-tones, the corrugated grime with ridges, every
material on its finish's ramp and grime (9 on 4); bay A's lane row on
the bay side read by difference from 2.5m (spread 2.61, darkens 5.8 at
luma 13.9) and as ridges - the difference row across the middle of the
face, at three heights, crossing its own mean 19/19/23 times against a
floor of 12; the lane under the gate mast from 6m (spread 1.80,
darkens 3.4 at 24.9). `the-yard-wears-its-decals-on-its-faces-in-two-
draw-calls` - 17 decals of six kinds on two meshes, every one on a
solid's face clear of the sites, two draw calls from the lane, the
rust changing 26,890 pixels and the stencil 6,877 from 2.5m off their
faces, every ground stain a tenth darker (15.9 to 12.4, 5.5 to 3.9,
20.0 to 16.0).

**Verified.** Subsets on the yard (11 checks in 39s, the two material
checks red on their instruments; 2 in 30s green after; the plant's
three material checks in 67s); then `npm run suite`, both maps twice:
**152 passed, 1 failed, 27 not for this map**, **171 passed, 1 failed, 8 not for this map**, every outcome identical between
runs, 0 red, 0 flaky, 0 console errors, 0
context losses; the one failure on each is the frame-budget sweep,
skipped headless.

**Left.** E6, post-processing, is what remains of Block E. Whether
corrugation reads as corrugation, wet as wet, and one number on four
boxes as a yard's stencil, is D45's for Josh's eyes.

## E6 — post-processing: a bloom on the emissives, a vignette, a switch (2026-09-21, scheduled run, Josh present)

**Gate.** E5's verify at `02212df`: plant 171/1/8 twice, yard 152/1/27
twice, 0 red, 0 flaky, 0 console errors.

**Why it was unblocked.** QUEUE.md said `blocked: D10`; D10 is in the
Provisional section, with the recommendation "none until E1-E3 land;
then a vignette and a light bloom on the emissives only, if the frame
budget allows". E1-E3 landed 2026-09-19/20, so its condition was met
and no `decided:` line was wanted. The budget clause cannot be answered
on this machine (SwiftShader draws a frame in 400-600ms), so it became
a switch and a line in PLAYTEST.md.

**What was built.** `src/post.js`, `createPost(renderer)`: four passes
in one file, since three's EffectComposer is in the addons bundle the
import map does not fetch. The scene into a full-size **half-float**
multisampled target (the first targets were 8-bit linear, and every
dark tone banded to grey: a floor at sRGB 8 is linear 0.002, rounds to
1/255, and comes back as 13 - the probe read the wall at (13,13,13)
against (8,9,9) raw); a **bright pass** at half size keeping what is
over `bloomThreshold` 0.5 of linear luma with a 0.1 smoothstep - the
route-lit stages and the lamp fixtures read 0.75-0.8, a floor under a
lamp 0.13, so the emissives and a flash bloom and nothing else does;
two separable **Gaussian blurs** at half size, ping-ponging; a
**composite** to the canvas, the scene plus the blur at `bloomStrength`
0.8 under an elliptical **vignette** from `vignetteInner` 0.55 to
`vignetteOuter` 1.25 of the half-diagonal, `vignetteStrength` 0.3 off
at the corner, `colorspace_fragment` applying the output transform
once. Then **C3's feedback quad** over the composite on its own layer
(`render.overlayLayer`, 1; `feedback.mesh.layers.set`, the camera
`layers.enable`d so the one-pass path still draws it), with the camera's
mask borrowed and given back and the scene's background lifted for the
pass - the first composite came out as the clear colour everywhere,
and the probe found why: a Color background makes three clear the
canvas whatever `autoClear` says, and the overlay pass wiped the
composite. `SETTINGS.post` is the switch (`settings.defaults.post`
true; a *post-processing* row in the menu, live); off is
`renderer.render`, one pass, no target touched. `post.render` resets
`renderer.info` once a frame with `autoReset` off, so a frame's draw
calls are the frame's: the checks that count calls by difference (the
routes' strips, the decals) read as before once this was in - before
it, the last render of a frame was the overlay pass and they read
"0 -> 0".

**What ships is what is read.** pixels.js's lens (`grab`, `renderOnly`)
and tests/feedback.js's reader render through `h.post.render`. What
moved: the routes' landing edges 158-182 luma from 224-227 (the
emissive spread by the blur, not clipped), contrasts 0.75-0.78 from
0.79-0.83, every one over its floor; the deck's underside under its
lamp 105 from 101 (the halo); pools, mouths, the rim, the figures,
the damage vignette (-11.0 from -11.8) to the digit or a level. And
**the site tint darkened more**: the multiply now happens in linear
light, which is the physically right one and harsher for the same
strength - 0.28 read 12% off the vault's floor against C7's 7.8% -
so `siteTintStrength` went to 0.13 (R/B up 1.09-1.13x, luma down 5-8%
on the plant, 1.09-1.12x and 6-7% on the yard), the tint check's
warmth floor from 1.08 to 1.05 with the re-measure recorded in it,
and D44's numbers are superseded under D46. The suite is a good deal slower
headless - every pixel check draws seven passes on SwiftShader: the
plant's run 850-1000s from 590-660s, the yard's 490-660s from 290-310s;
HANDOFF.md's Running it has the new times.

**A body is not an emissive.** The first full verify was red on the
two silhouette checks (`the-shade-reads-as-a-hooded-figure-at-8m-and-
25m`, `the-warden-and-the-shade-are-told-apart-by-silhouette-at-25m`)
on both maps: "at 8m the hood is 50px over a neck of 50px". They stand
the figure in flat white to read its shape by difference, and the
bloom grew the white a halo ten pixels wide - the probe's PNG showed
the Shade glowing like a lamp, 6977 changed pixels against 2997 raw.
The Shade's own rim at full meter is brighter than any lamp and would
do the same in play. So the bright pass reads the scene target's alpha
as its mask: an opaque material writes 1, a body writes 0 - `NO_BLOOM`,
one line after `opaque_fragment`, on the Shade's rim material, the
Warden's body (`withoutBloom`, agentmesh.js) and the checks' flat
stand-in (figure.js's `flatten`). A step at 0.999 rather than a
multiply: the multisample resolve leaves a body's edge pixels half
covered and half bright, and a ring of those would bloom. The canvas
has no alpha channel, so with the post off the alpha changes nothing;
the rim and the dimming checks read as before. The silhouettes read as
before E6: hood 28 over neck 12 at 8m, 10 over 6 at 25m.

**The look** (the probe's PNGs): the lamps glow softly, the route
strips glow a little, the corners are a shade darker; nothing flares.

**The check** is `post-processing-blooms-the-emissives-darkens-the-
corners-and-is-a-switch` (`src/tests/post.js`, every map): a lamp with
an eye 3m off it in open air with sight of the glass; the frame raw
(`SETTINGS.post` off, 0 passes) and with the post (7); the fixture's
pixels over 200 luma dilated ten pixels, the ring round them brighter
by 3 luma at least (22.5 to 77.6 on the plant's hall-1, 34.6 to 111.9
on the yard's bay-a); the first site's floor from 2.2m, the four 6%
corner squares' post/raw median at 0.9 or under (0.847 plant, 0.857
yard - the first instrument read the whole outer band and got 0.89,
because the vignette is elliptical and the top and bottom edges'
middles sit inside its inner radius) and the centre 10% within 3%
(2%); the hit marker's span within 3px raw against post (45/45);
`#bl-post` in the settings menu switching `SETTINGS.post` off and on.

**Verified.** Subsets (the plant's light, feedback and material checks,
10 in 238s with four red on the draw-call count and the tint; 5 in
188s with one red on the tint; 3 in 87s green; the yard's 8 in 84s
green); the first `npm run suite` red on the two silhouette checks on
both maps (plant 170/3/8 twice, yard 151/3/27 twice, 0 flaky); the
figure, rim, dimming, smoke and alarm checks after the mask, 7 in
111s green; then `npm run suite` again, both maps twice: **172 passed, 1 failed, 8 not for this map**,
**153 passed, 1 failed, 27 not for this map**, every outcome identical between runs, 0 red, 0
flaky, 0 console errors, 0 context losses;
the one failure on each is the frame-budget sweep, skipped headless.

**Left.** Block E is closed; the queue has no unblocked job. The frame
budget with the post on is Josh's GPU's to answer (PLAYTEST.md: F4
then Y, and the row off if it is red). Whether the glow reads as light
is D46's.

## The gate can hang forever, and did — F10 and G1 queued (2026-09-22 17:00, scheduled run)

**No job was built.** The queue was empty: Blocks A, B, C, D and E
closed, F closed since 09-11, nothing `[ ]` anywhere. The 02:00 run of
the same day had already found that, run the regression set and stopped.
Rather than build nothing twice in one day, this run took the one thing
the 09-20 audit had left open — "a suite runner from the 09-18 17:00
build was still running 41 hours later; the audit could not end it" —
and asked why.

**It was still running.** Four days on: `npm run suite` (pid 9608) →
`node scripts/suite.mjs` (pid 4792), an in-process server still
listening on 127.0.0.1:54315, holding a headless Chrome tree (pid 8920)
whose renderer had burned **1,975 CPU-seconds** and a second process 429
more. Not an idle zombie — a SwiftShader renderer spinning against the
same four cores every run since has been timed on.

It is tempting to read it as the explanation for a number recorded in
E6's entry as the post pipeline's cost — the plant's run going 450s →
850s — and the first draft of this entry did. That is not supported:
E6's 850s was itself measured with this same runner alive, and so was
this run's 819s. Contention is a constant across every measurement we
have, not a variable that separates them. **The clean test is a gate run
after the processes are killed**; until someone does that, how much of
the climb is seven SwiftShader passes and how much is a stolen core is
unknown, and neither number in HANDOFF's Running it should be trusted to
better than "about".

**The cause is in the gate, not the machine.** suite.mjs drives a whole
run through one `page.evaluate` (~line 303). `page.evaluate` takes no
`timeout` option — its only option is `{ exposeFunctions }`, checked
against `playwright-core/types/types.d.ts` — and `setDefaultTimeout`
changes the default only for methods that *accept* one, so the call
above it (`page.setDefaultTimeout(TIMEOUT)`, 600s) does not cover it. A
check that hangs in the page therefore hangs the runner forever, with no
output; the `finally { browser.close(); server.close(); }` never runs;
and node and Chrome are orphaned. There is no signal handler either, so
stopping a backgrounded run orphans the same tree. The documented trap
"a check that awaits `h.nextFrame()` hangs where frames never fire" is
exactly the shape that triggers it.

**A routine cannot clear one.** The sandbox refuses `taskkill` (and a
backgrounded `nohup … &`) to a scheduled session as interfering with a
workload — tried, denied, not worked around. So the gate has to stop
making them, which is **F10 (M)**, queued: a heartbeat (`runAutoTests`
publishes checks-done and the id in flight, so slow is never mistaken
for hung), a deadline against the heartbeat standing still rather than
wall-clock total (a cold plant run is legitimately 850s), a signal
teardown, and a startup warning when an older `suite.mjs` is alive,
since its Chrome invalidates every timing in the report. Block F is
reopened for it.

**And the file the routine reads first has drifted.** HANDOFF.md is
1,831 lines against step 6's "keep it one page"; ~30 per-job narrative
sections that PROGRESS.md already holds in full. The cost is not just
the reading: three questions Josh decided on 09-21 (D25, D27, D38) were
still listed as open under "Still needs a human", the D3 section still
said D3b was queued behind D38, and the same paragraph called Block E
open and closed four lines apart. All fixed here by hand; **G1 (S)**,
queued under a new Block G — the record, does the structural half, with
a done-when that no statement in the file is contradicted by
DECISIONS.md or QUEUE.md.

**Also recorded.** `src/physics.js` is at *exactly* 600 lines, with
movement.js 599, combat.js 593, visual.js 589 and plant.js 588 behind
it: the next line added to any of them turns
`no-source-file-outside-config-is-over-600-lines` red, so the job that
touches one splits it first instead of finding out halfway through a
verify. config.js is 1,648 (exempt), up from the audit's 1,465. 0
TODO/FIXME; one `Math.random` and one `setTimeout` in `src/`, both the
documented exceptions.

**Verified.** Nothing under `src/` was touched, so there is nothing for
a check to catch; the gate was run anyway as a witness that the base is
sound. `npm run suite -- --runs 1`, both maps, exit 0: **plant 172
passed, 1 failed, 8 not for this map (819s); yard 153, 1, 27 (470s)**;
0 red, 0 flaky, 0 console errors, 0 context losses, 0 loop frames, and
the `expectedRed` and `unexpectedGreen` lists both empty. The one
failure on each map is the frame-budget check, skipped headless. Those
counts match E6's verify exactly, so the base is where E6 left it and
the docs commit before this one changed nothing that runs. Throttle:
4 of 8 cores, 9 processes pinned, 45s cooldown.

**Left.** F10 and G1, both unblocked, for the 02:00 run. **Two node
processes (9608, 4792) need Josh to kill them by hand** — `taskkill /PID
4792 /T /F`, then 9608; the ordinary `chrome.exe` tree on this machine
is Josh's own browser, not the suite's. Until they are gone every
timing this gate reports is against three-quarters of a machine.

## F10 — a hung gate dies, and says which check hung (2026-09-23 02:00, scheduled run)

**What was built.** The three parts the queue asked for, plus the one
that makes the first of them work at all.

*The heartbeat* (`src/ui/autosuite.js`). `AutoSuite.beat(fields)` merges
onto `debugState.suiteProgress` and bumps a `seq` that only ever goes
up; `_runChecks` publishes one beat before every check, naming it in
`inFlight` with `done`/`total`, and one after it, and `runAutoTests`
brackets the run with a `start` and a `done` beat. The retry pass after
a lost context beats too, so the one place that waits on an event rather
than on work is not a silent gap. Every beat carries the `total` of the
run that published it, because a check may drive `runChecks` itself
(three do) and its count must not be left behind for the run around it
to report.

*The task yield* (same file). Publishing the beat is not enough on its
own, and this is the part the queue's description did not anticipate: the
watcher reads the beat with a second `page.evaluate`, which needs a
**task** to run in, and a run of checks never lets the event loop turn.
`await` on an already-settled promise is a microtask, so a stretch of
synchronous checks holds the main thread from the first of them to the
last and nothing outside the page can see how far it has got — the
heartbeat would have read as standing still through a perfectly healthy
run, and the deadline would have killed good runs. So `yieldTask()` gives
up one whole task at every check boundary, just after the beat that names
what is about to run, and the runner's 60-frame warm-up does the same
between frames (a cold map's first draw compiles for tens of seconds,
F5, and that would otherwise be one unreadable gap). A `MessageChannel`,
because `setTimeout` is not allowed in `src/` and animation frames do not
fire everywhere this code runs. Cost: 658 check-runs across the verify,
none of it visible against run-to-run variance.

*The deadline, the teardown and the warning* (`scripts/watchdog.mjs`,
new). `withDeadline(page, work, where)` races the run's `page.evaluate`
against a watcher that reads the beat every 5s — that read itself raced
against the same interval, so a page too busy to answer counts as a beat
that has not moved rather than hanging the watcher the way it hung the
run — and throws when the beat stands still for `--stall` seconds. The
throw reaches suite.mjs's catch, which prints `suite: crashed: …` and
exits 2 after the teardown. `teardown()` closes the browser and the
server once and **bounded** (a close that itself hung would reproduce the
bug), and `closeAllConnections()` drops the keep-alive sockets that hold
the port. `SIGINT`, `SIGTERM` and `SIGBREAK` run the same teardown and
exit 2, so stopping a backgrounded run stops the tree. `otherRunners()`
scans for an older `suite.mjs` at startup and prints its pid, its start
time and the `taskkill` line; it is also in the report as
`otherRunners`, and in the summary as `OTHER RUNNERS ALIVE`, because a
timing taken beside one is measured against it and a report that does not
say so invites the wrong conclusion.

Its own module because folding it into suite.mjs put that file at 638
lines, past the ~600 split guidance. suite.mjs is 507 after the split,
autosuite.js 404, watchdog.mjs 181.

*The check* (`src/tests/heartbeat.js`, new).
`the-suite-heartbeat-advances-and-names-the-check-in-flight` first asks
the beat it is **itself** running under to name it — nothing else proves
that the id published is the id of the check actually running — then
drives `suite.runChecks()` with three probes that each copy the beat they
are run under, and holds every one to its own id, its own `done` index
and the run's total, with the sequence strictly increasing throughout.
Green: `seq 66 -> 72 across 3 probes, named
heartbeat-probe-a/heartbeat-probe-b/heartbeat-probe-c, under a beat
naming the-suite-heartbeat-advances-and-names-the-check-in-flight (1/2,
map yard)`. Reverted (`beat()` stubbed to return null, the file restored
byte-for-byte afterwards and the md5 checked), it goes red with `run 1
(yard): 0 passed, 1 failed` and `RED (unexpected):
the-suite-heartbeat-advances-and-names-the-check-in-flight`.

**What was verified.** Gate before the job, on `71ef9da` with no change
in the tree: exit 0, plant **172 passed / 1 failed / 8 not for this map
(823,034ms)**, yard **153 / 1 / 27 (494,488ms)**, 0 red, 0 flaky, 0
console errors, 0 context losses, 0 loop frames — the same counts as the
09-22 gate, so the base was where E6 left it.

Verify, `npm run suite` (four runs): exit 0, plant **173 / 1 / 8
(748,004ms and 937,517ms)**, yard **154 / 1 / 27 (467,292ms and
613,467ms)**, **0 red, 0 flaky, 0 console errors, 0 context losses, 0
loop frames**. One more pass per map than the gate: the new check. The
one failure on each map is the frame-budget check, skipped headless.

The staged hang, demonstrated once and the flag left off:
`npm run suite -- --runs 1 --map yard --query "hang=1" --subset
"a-staged-hang" --stall 90` gave, in 130 seconds wall,

```
suite: crashed: Error: run timed out: the suite heartbeat stood still for 90s
  on map yard, run 1; the check in flight was "a-staged-hang-never-returns"
  (0/1, phase running). Raise --stall if the run was merely slow.
```

and exit 2. Afterwards the process table held **no new node and no new
suite Chrome** — the only survivors were the 09-18 orphans (9608, 4792,
Chrome 8920, token `blackline-suite-4792-…`). The check that hangs is
registered only behind `?hang=1`, so no gate carries a check that cannot
finish.

**What was found.** Two things, both from the per-check `ms` this job
added to `--details` (the report on stdout has never carried a time for a
green check, and the stall budget is a claim about check times that
nobody had ever measured).

*The stall budget rests on one check.* The gap between two beats is one
whole check, so the slowest single check is the floor under `--stall`.
Across the verify's 658 check-runs it is
`a-zero-size-viewport-does-not-blind-the-renderer` at **268,927ms on the
plant** (252,906ms the second run; 168,993ms and 168,438ms on the yard) —
**a quarter of a whole plant run inside one check**. Next is
`every-route-reads-lit-from-its-foot` at 76,262ms, then
`frame-budget-under-the-check-29-load` at 43,023ms; only **6 of 658**
check-runs exceed 60s. So the default `--stall 600` is a 2.2x margin over
the worst observed, and a tighter default that looked reasonable on the
average — 300s, which was this job's first instinct — would have been a
false positive waiting for a warm cache miss. The number is now measured
rather than guessed, and `--stall` lowers it for a demonstration.

*The 269s check is worth a job of its own.* F11 queued.

**What was left.** The two orphans are still alive — this run tried
`taskkill /PID 4792 /T /F` once and the sandbox refused it, as the trap
says it would. F10 stops the gate making new ones; it cannot clear these.
Every timing above was measured with them running, which is now printed
on every run rather than left to be remembered. The clean comparison the
09-22 entry asked for — a gate run with the machine to itself — still
needs Josh's hand on those two pids first.

## G1 — HANDOFF.md back to one page (2026-09-23 02:00, scheduled run)

**What was built.** `HANDOFF.md` went from **1,846 lines / 118KB to 533**, a
71% cut, with nothing dropped that is not written up in full somewhere else.

The shape is the one the queue asked for. Kept, in order: Last audit, Where
things stand, a new index, the redesign's rule, the census and the climb rule,
the plant rule and where its checks live, F3's split, where the suite runner
lives, Running it, Environment traps, The lesson that keeps repeating, Still
needs a human. Removed: the ~30 per-job narrative sections (E6, E5, C7, B5d,
F8, E4, E3, E2, E1, D7, D6, D5, D4, D3, D2, D1, C1–C5, B5, B6, B7, B8, B2, F4,
Block A's phase tables, the 50-phase plan, "the plant is a room"), every one
of which `PROGRESS.md` already held in full.

**What was verified, before anything was deleted.** For each of the 27 job
ids whose section was removed, that `PROGRESS.md` carries an entry titled with
it — checked by script, 27 of 27 present, none missing. The index then names
every one of them. Because every PROGRESS entry is titled with its job id, the
index needed no second column: it says so once and a reader greps `^## E4`.

The three sections the queue named as carrying something found nowhere else —
the plant-rule checks' locations, F3's split, the census's climb rule — were
kept rather than indexed, the first folded into the plant-rule section it
belongs to. Every check id the file cites was confirmed registered in
`src/tests/` (and `effects-drain-when-idle`, which is not, is named as what it
is: a runtime assertion).

**Drift found and fixed, which is the point of the job.** The old file said,
two paragraphs apart, both that Josh decided D13 on 2026-09-21 and that "what
waits on Josh is D13's rule (may move a site)". Reading `DECISIONS.md`
properly: **every entry under its *Blocking* heading is decided** — D8, D13,
D20, D23, D25, D27, D38 and the two runner ones — so nothing is blocking at
all, and the new file says that instead of naming a phantom blocker. The old
"Still needs a human" also listed D40–D46 as though they were open questions
rather than Provisional entries Josh may override at leisure; the new one
distinguishes the two. Two stale "Next job" sentences and a paragraph of
09-20 audit snapshot that "Where things stand" already contradicted are gone.

**What was verified.** `npm run suite`, four runs: exit 0, plant **173 passed / 1 failed / 8 not for this map (762,898ms and
921,187ms)**, yard **154 / 1 / 27 (496,006ms and 597,669ms)**, 0 red, 0 flaky,
0 console errors, 0 context losses, 0 loop frames — the same counts as F10's
verify an hour earlier, which is what a documentation job should do. G1 touched
no file under `src/` and no file the game loads, so the suite is a witness
rather than a proof; the real check is that the next run can orient from the
file. The one check that reads this file at all,
`playtest-md-exists-is-linked-and-names-real-checks`, requires HANDOFF.md to
mention `PLAYTEST.md`, and it does, three times.

**What was found, and not done: the 400-line target is not reachable.** The
queue's done-when asks for under 400 lines. It cannot be met together with the
same done-when's other half — keep these named sections, and lose nothing —
and the arithmetic says so plainly. Everything in the file *except* the
Environment traps, with each section already rewritten as tightly as it can be
stated, is **345 lines**: the index (50, and required by the done-when
itself), Running it (69), the plant rule (39), the census (35), the redesign's
interview table (29), F3's split (26), the lesson (22), Where things stand
(20), Still needs a human (18), Last audit (13), where the runner lives (10),
and the header. For the total to come under 400 the traps section would have
to fit in **55 lines**, and there are about thirty traps in it — under two
lines each, which is a list of titles with the hour-saving content deleted.

The obvious escape — move the traps to a sibling `TRAPS.md` and link it, which
would leave HANDOFF at 347 and lose nothing — is closed for a reason worth
recording: **the scheduled task's own SKILL.md instructs each run to "read the
'Environment traps' section of HANDOFF.md before you start"**, and that file
lives outside the repo, in `~/.claude/scheduled-tasks/blackline-build/`, where
a job in this repo cannot change it. Moving the section would break the
routine's own instructions on the next run.

So the file is delivered at its honest floor rather than gutted to hit a
number, and **G2 is queued** with the three ways out for Josh to pick: accept
533 and amend the target, split the traps and have Josh update SKILL.md in the
same stroke, or decide which traps have earned retirement. The last is a real
option — several are now historical ("a boot failure used to be a silent 60s
timeout", "a check used to inherit the last check's menu") and survive only as
the operative sentence already.

**What was left.** The two orphaned node processes, still Josh's to kill; F10
stopped the gate making new ones and this file now names them in *Where things
stand*, in the traps section and in *Still needs a human*.

## F11 — the quarter of a run is a wait, not a check (2026-09-23 17:00, scheduled run)

`a-zero-size-viewport-does-not-blind-the-renderer` takes 265s on the plant
and 149s on the yard — a third of a whole run inside one check. F11 asked
where the time goes. It goes into one call, `gl.getError()`, and everything
else the check does — the staged resize, every read it makes, and a whole
rendered frame — comes to under 50ms together.

**What was measured.** The check was instrumented to put each of its own
steps on its own clock, and the plant suite run with it, twice.

| step | ms, two runs |
|---|---|
| `gl.getError()` | 268,911 · 274,693 |
| `h.renderFrame(1/60)` | 9 · 6 |
| the staged resize, the canvas reads, the aspect, the draw-call read | 0 each |
| a second `getError`, a second frame, a third `getError`, a `gl.finish()` | 0 · 5 · 1 · 0 |

Moving the `getError` to the check's first line moved the whole cost with it
(`syncAtEntry=274,693`), which is what settles it: the check inherits the
wait rather than causing it. The same body run alone through `npm run probe`
on a freshly loaded page is **5ms**; in a 12-check subset ending on it,
**10ms**.

**What the wait is.** A probe asked the two candidates separately. The first
`gl.getError()` after a page load, with nothing behind it but the runner's
60-frame warm-up, costs **38,760ms**. After that: 3,600 fixed steps cost
**0ms** of wait, 200 rendered frames whose pixels are never read cost
**1ms**, 200 more cost **3ms**. So it is not proportional to simulation and
not proportional to frames drawn. It is a tail of pipeline work the software
renderer (SwiftShader through ANGLE-on-Vulkan) builds lazily, and a
synchronisation is a wait for it to finish — 38.8s with the warm-up behind
it, 265s with 167 checks behind it, which have between them asked for far
more pipeline variants than the warm-up did. It is the trap already on the
record — "the first draw of a view the renderer has not seen compiles for
tens of seconds headless (39s at site A)" — read from the other end.

**Why it cannot be moved for free.** Three placements, each a full plant run:

| placement | slowest check | run |
|---|---|---|
| as found — one lazy `getError` at check 167 | 265s | 753s |
| `gl.getError()` after **every** check | 251s | **989s** |
| `gl.flush()` after every check | 271s | 765s |

Synchronising after every check makes the run **236s longer** and does not
even lower the slowest check: the cost lands on two unrelated ones instead —
`a-whole-match-leaks-nothing` at 247s, which renders nothing at all, and
`frame-budget-under-the-check-29-load` at 251s, which is the last check in
the run and whose wait is normally never paid because the page is torn down
first. Flushing is free (0ms every time) and changes nothing, so the work is
not sitting unsubmitted; it is being built, and waiting is the only way to
know it has finished. Unpinning the browser (`--cores 8` against the default
4) halves everything in proportion — the wait 150s, the run 452s. The wait is
35% of the plant run pinned, 33% unpinned, 33% of the yard run: the same
third however the run is configured, which is what a tail looks like and not
what contention looks like.

**What was built.** The check keeps all five of its assertions and one of
them gets honest. It now drains and clears the GL error state *before* it
stages the resize, so the read at the end is about the resize and not about
whatever ran before it. The check was exactly the shape the A1/A3 lesson
warns about: it asserted `gl.getError() !== 0` without ever having cleared
the state, so a green answer meant "nothing in the run so far raised an
error", not "the resize did not". The drain is bounded at 64 reads and bails
on a lost context, because a lost context answers `CONTEXT_LOST_WEBGL` to
every call and an unbounded drain would spin on it forever (F1). Its ms now
leads the detail line, so every report says what the 265s is instead of
leaving the next reader to spend a session's worth of instrumentation finding
out.

**What was not built, and why F11 stays open.** The done-when asks for the
check's ms at or under 60s. Nothing measured here gets it there without
moving the wait onto a neighbour, which is bookkeeping and not a fix, and
both placements tried made the run worse or left it unchanged. The wait is
the suite's, not the check's, and the lever that would remove it is not
inside this check. The `--stall` half of the done-when is answered and the
answer is that the default **stays at 600s**: the floor under it is not a
slow check that could be made fast but a tail that scales with the machine —
265s on four cores, 150s on eight — so the budget has to clear a number that
moves. 600s clears the worst reading on record a little better than twice
over.

D48 puts the remaining choice to Josh: leave it as it is with the number
named in the report, drop the GL-error clause (the assertion is duplicated in
`presentation.js` and in the lost-context check next door, and the plant run
would lose most of the 265s because a tail nothing waits for is never paid),
or wait once at the end of each map's run and report it as the run's own
number, which puts no check over ~76s and would let `--stall` come down to
about 240s. Recommendation 3, with 1 as the do-nothing; 2 is the one that
costs an assertion, which is Josh's to give and not the routine's. F11 is
`[~]` in `QUEUE.md` with the resume-from note.

**Found along the way.** Stopping a backgrounded gate with the task tool
kills the `npm` wrapper only: `suite.mjs` ran on to the end of its four runs,
about forty minutes, before tearing its own tree down and exiting. F10's
teardown held and nothing leaked, but a stopped gate keeps its cores until it
finishes, so a run started beside one is measured beside one. That is now a
line in the orphaned-runner trap.

**Verified.** `npm run suite`, four runs: plant 173 passed / 1 failed / 8 not
for this map (753s, 898s), yard 154 / 1 / 27 (481s, 637s), exit 0, 0 red, 0
flaky, 0 console errors, 0 context losses — the same counts as G1's verify
and F10's before it. The one failure on each map is the frame-budget check,
skipped headless. The check's own line now reads `[265944ms of this check is
the pipeline drain, F11]` on the plant and `[174279ms ...]` on the yard.

## F12 — `?seed=` reaches the fuzz and soak checks (2026-09-24 02:00, scheduled run)

The 02:00 run found nothing it could take: F11 was `[~]` on D48, G2 blocked on
D47, both still undecided, and Blocks A, B, C, D, E and G closed. The gate was
run anyway and was green. Rather than stop on "everything is blocked", the run
went looking for something the project had already decided it wanted and lost,
and found one: **the 2026-09-20 audit's own recommendation, written into this
file and never transcribed into `QUEUE.md`.** It sat in the history for four
days while the queue emptied. Queued as F12 and built here.

**The hole.** `--query "seed=N"` reached nothing. `initMatch` prefers an
explicit seed over the URL's (`main.js:126`) and every exploratory check passed
one, so the weekly fresh-seed run had been re-running the builder's own seeds
under a new name since it started. Two audits' "14 checks green on a fresh
seed" therefore said only that the pinned seeds were still green — a line that
looked like coverage and was not. Seven modules, sixteen seeds:
`tests/fuzz.js` 8675309 · `tests/traversalfuzz.js` 20260914 and 19770912 ·
`tests/aisoak.js` `SEED + m * 16` from 0xd5a1 · `tests/shade.js`
`reseed(0xf0f0f0)` · `tests/wardenground.js` 20260914 · `tests/difficulty.js`
0xb0b5 and eight paired preset seeds · `tests/engine.js` `reseed(0xa11ce)`.

**What was built.** `src/config.js` grew `seedInQuery(search)`, which returns
the seed `?seed=` names or `null` when it names none; `deriveSeed` is written in
terms of it, so one place parses the pattern and a caller can now tell "no seed"
from "a seed of zero". A new `src/tests/seeds.js` (214 lines) owns
`exploreSeed(label, fallback)`:

- **No `?seed=` in the URL ⇒ the fallback, unchanged.** This is the clause that
  matters most, because the gate never passes a seed: the default run is the run
  it always was, and this change cannot make it flaky. It is asserted, not
  assumed.
- **A `?seed=N` ⇒ one mulberry32 draw from `N` mixed with a hash of the label.**

The **label**, not the number, is the site's identity. Two modules had picked
the same number — `tests/traversalfuzz.js` and `tests/wardenground.js` both on
20260914 — so keying off the number would either have sent them to one fresh
seed, exploring less than the pinned set did, or forced one of them to change
what it runs by default. A bare `N ^ fallback` was rejected for a second
reason: `?seed=0` would hand every fallback straight back and look like a URL
that was ignored.

Every exploratory seed is now taken at **module level**, as a named constant
with a comment — `FUZZ_SEED`, `SWEEP_SEED`, `SEED`, `ENGAGEMENT_SEED`,
`INPUT_SEED`, `SOAK_SEED`, `BOUNDS_SEED`, and `SEEDS` mapped over its eight.
That was not tidiness: it means the whole census exists before any check runs,
so the check below reads it without depending on which checks ran, in what
order, or on which map.

**What was deliberately not touched.** Three seeds whose *subject* is
reproducibility: `tests/engine.js` 0x5eed1234, `tests/determinism.js` 20250814,
`tests/ai.js` 0xa17ea5. A seed that moved under `?seed=` would change what "the
same seed replays identically" was asked about, and a reported failure could no
longer be reproduced from the number in the report. `tests/warden.js` passes
`before.seed` from a live match and was already correct.

**The check.** `the-url-seed-reaches-every-exploratory-check`, 1ms, both maps.
It asserts seven clauses: every listed site went through `exploreSeed`; no
unlisted site did; no reproducibility seed did; a URL without `?seed=` returns
every fallback unchanged, over four quiet query strings; every site moves under
each of five URL seeds including 0; no two sites collide on one; and the same
URL seed reproduces its own seeds. It claims **no Section 16 number on
purpose** — `checksCovered` parses "check <n>" out of the `spec` string, and a
number there would both claim coverage this check does not provide (28 is the
overlay and the patrol circuit, which `determinism.js` and `ai.js` assert) and
pull this check into the regression set, whose size D7 holds equal on every map.

**That the check can fail was proved, not assumed** — the A1/A3 lesson says a
check that picks its own inputs owes the suite that second half. Both
directions were driven:

| what was broken on purpose | what the check said |
|---|---|
| `tests/fuzz.js` back to a bare `const FUZZ_SEED = 8675309` | red: *"1 exploratory site(s) never went through exploreSeed: shade-fuzz (tests/fuzz.js)"* |
| a reproducibility seed routed through `exploreSeed` | red: *"exploreSeed was asked for 1 site(s) this module does not list: rng-reproducible … a seed whose subject is reproducibility was routed through exploreSeed: tests/engine.js"* |

**What the fix actually buys, measured on the real game** rather than a replica,
through `npm run probe`. On `?map=plant`, with no seed in the URL, all 16 sites
return their own fallback (`liveEqualsFallback: true`) — `shade-fuzz=8675309`,
`traversal-fuzz=20260914`, `ai-soak=54689`, `prng-range-bounds=659918`, and so
on. Under `?seed=20260920` all 16 move, all 16 are distinct, and none is left on
its fallback: `shade-fuzz=1683039948`, `traversal-fuzz=721918168`,
`traversal-approach-sweep=2793789379`, `ai-soak=3751533347`. Under `?seed=0`,
which a bare XOR would have made a no-op, they move too
(`shade-fuzz=2039753067`). The three pinned seeds read back unchanged
(1592594996, 20250814, 10583717). Wider than the check goes: a sweep of 5,000 URL seeds across
all 16 sites, run against the same arithmetic offline before any of it was
applied, found no collision and no site left on its fallback. The check itself
asserts five seeds in the game, which is the assertion that will keep holding.

**Verified.** `npm run suite`, four runs: **plant 174 passed, 1 failed, 8 not for this map (760,649ms and 942,528ms), yard 155 / 1 / 27 (468,644ms and 604,053ms), exit 0, 0 red, 0 flaky, 0 console errors, 0 context losses, 0 loop frames.** One more passing check per map than the gate that opened this run on `5eeacc5` (plant 173, yard 154), which is this job's own check and nothing else. The one failure on each map is the frame-budget check, skipped headless. The new check costs **1ms, 0ms** on the plant and **1ms, 0ms** on the yard. And the run times are the ones the gate had before the change - 760s against 769s on the plant, 468s against 450s on the yard - which is the measured half of "the default gate is unmoved"; the clause is asserted in the check as well, over four query strings that name no seed.

**What is left.** Nothing in F12. But the thing to say plainly is that this
job makes the weekly fresh-seed run *capable* of finding something and has not
yet found anything: the next audit that runs `--query "seed=N"` will be the
first one whose green means what the line has claimed for two weeks. If it comes
back red, that is the job working, not a regression.

**And the run's real finding is D49**, raised alongside F12: `PLAN.md`'s entire
block table is done, every block, and the routine has run out of anything it is
allowed to decide. F12 was a hole in the instrument, and there will be more of
those, but the instrument is not the game. D49 lays out five directions and
recommends playing it first — four of the five open Provisional questions would
answer themselves in ten minutes of play — and merging `phases-14-45` in the
same evening whatever else is chosen, since an unmerged branch is the one risk
carried here that no check can see.

## F13 — two of Section 18's own lines, held by the gate at last (2026-09-24 17:00, scheduled run)

The 17:00 run found the queue where the 02:00 run left it: F11 `[~]` on D48,
G2 on D47, both undecided, every other block closed, and nothing to pick. The
02:00 run's advice was to go looking rather than stop at once, and it recorded
that the two known unqueued recommendations were spent — so this run looked at
the instrument instead of the history, and found a hole in it.

**The hole.** `BLACKLINE_SPEC.md` Section 18, the definition of done, carries
the line "`Math.random()` appears nowhere in `src/`". Section 9 carries "**Do
not use `setTimeout` for any gameplay-affecting timer**" and the Section 15
risk register repeats it. These are not stylistic: they are why the seeded rng
in `config.js` and the single ticked effect registry in `gadgets.js` exist at
all, and the whole reproducibility claim — a bug replayed from the seed in the
overlay — rests on the first. **Both were gated by nothing.** The weekly audit
greps the tree and reports a count (1 and 1, the two documented exceptions);
the suite never looked. A run that landed a third call would pass the gate
green and the drift would surface up to seven days later in a report no job is
blocked by. That is the same shape as the two items `tests/donedef.js` was
opened for — "the kind that rot quietly" — and the same shape as F12's finding
a week earlier: a line that reads like coverage and is not.

**What was built.** One check in `src/tests/donedef.js`,
`no-source-file-calls-math-random-or-sets-a-timer`, no `maps` (it runs on
both), claiming no Section 16 number on purpose — as F12's did, because
`checksCovered` parses "check <n>" out of the `spec` string and a number
there would pull this into the regression set, whose size D7 holds equal on
every map.

It reads **every module the page actually loaded**, from the same Resource
Timing list the network and line-count checks beside it read — never a guess at
the import graph. That is not only convenience: a file under `src/` that
nothing imports never executes, so a draw or a timer hiding in one cannot reach
a match. The loaded set is the set the bans are *about*. Today it is the whole
tree regardless: 135 modules under `src/`, and the only one nothing imports is
`main.js`, which `index.html` loads. The floor is `MIN_MODULES` 120, set far
above the line-count check's 40 so an import graph collapsed to a handful reads
as a failure rather than as a clean sweep of nothing.

Three things are asserted, and the second and third are what make the first
worth having:

1. **No call to `Math.random(`, `setTimeout(` or `setInterval(`** outside the
   one file each ban allows. `setInterval` is on the list because it is the
   same call with a repeat; there has never been one, so it cost nothing to
   close.
2. **Each allowance is still exactly one call.** An exemption for something
   that has gone is an exemption the next call inherits without arguing for
   itself — the same reason F12 asserted "no unlisted site" as well as "every
   listed site".
3. **Each allowed call is argued in a comment at its own line**, within eight
   lines above it and matching `/deliberate/i`. Both already were, in the words
   `src/tests/performance.js` used: *"Called out at the line, as the audio
   noise buffer's `Math.random` is."* An exemption that lives only in a table
   in this file is one nobody reading the code can see.

**Prose is not a call, and the rule for telling them apart is line-local.** A
banned word on a line whose first non-space characters are `//`, `/*` or `*` is
counted as a mention and skipped; anything else is a call. The obvious
alternative — strip comments and strings properly, then match — needs a scanner
that can tell a regex literal from a division, and a scanner that desyncs
swallows real code and reads **green**. This rule cannot desync. Its cost is
the opposite error: a banned word inside a string on a code line would read as
a call, which is a red somebody rewords. There are none today, and a false red
is the direction to fail in.

**The check scans itself, which took a rewrite.** The first version spelled the
three calls out in a `what:` field beside each pattern, and went red on its own
table, naming six lines of `donedef.js` — the check working on its first run,
against its author. The fix was not an exemption for the file (that would be a
hole exactly where somebody would think to hide one) but to delete the field:
`callName(ban)` reads the label back off the pattern's own source,
`/Math\s*\.\s*random\s*\(/` → `Math.random(`, so the file never spells the call
and is scanned like every other. That is the trick `checksCovered` already
plays with a `spec` string, and for the same stated reason: a second field is
one more thing to forget to update. The check's own `spec` and `name` strings
had to lose the literal text too, which is the rule holding its author to
itself.

**That it can fail was proved, not assumed**, in all three directions, each a
real edit to the real tree, reverted after:

| what was broken on purpose | what the check said |
|---|---|
| `function __f13Probe() { return Math.random(); }` added to `src/timestep.js` | red: *"src/timestep.js:2 calls Math.random()"* |
| the word "Deliberately" removed from the comment over `audio.js:97` | red: *"src/systems/audio.js:97: Math.random() is allowed, but no comment within 8 lines above it argues for it"* |
| `audio.js`'s noise draw replaced with an alternating constant | red: *"src/systems/audio.js no longer calls Math.random() — the one-second noise texture; drop it from the allowance"* |

**Verified.** `npm run suite`, four runs: **plant 175 passed, 1 failed, 8 not for this map (752,903ms and 928,579ms), yard 156 / 1 / 27 (462,613ms and 607,128ms), exit 0, 0 red, 0 flaky, 0 console errors, 0 context losses, 0 loop frames**. One more passing
check per map than the gate that opened this run on `a23c39e` (plant 174, yard
155), which is this job's own and nothing else. The one failure on each map is
the frame-budget check, skipped headless. The new check costs **389ms and 389ms on the plant, 376ms and 368ms on the yard**, four readings that agree — it
fetches 135 cached modules and reads them — against a plant run of three
quarters of an hour.

Its green detail line, which is the census a later run can read without running
anything: *"135 modules read; 2 calls to Math.random() / setTimeout() /
setInterval(), each the one allowance and argued at the line (systems/audio.js
the one-second noise texture; tests/performance.js a yield so a GPU fence can
resolve); 5 more named in prose"*.

**What is left.** Nothing in F13, and one thing worth saying plainly: this
closes the two Section 18 lines a machine can settle, and the drift the weekly
audit reports is now a subset of what the gate holds — `TODO`/`FIXME` counts
and files over 600 lines being the rest, the latter already held by F3's check.
The audit's drift section still has a job, but it is no longer the only thing
standing between a build run and an unseeded draw.

**And the position has not changed.** D47, D48 and D49 are all still open, and
D49 is the one that matters: `PLAN.md`'s whole block table is finished and the
routine has run out of anything it is allowed to decide. F12 was a hole in the
instrument and so is F13, and there will be more of those — but the instrument
is not the game, and two runs running have now been spent sharpening it because
there was nothing else the routine could take.

## F14 — the suite counts itself (2026-09-24 17:00, scheduled run)

The second job of the run, and it came out of writing up the first. F13 needed
to know how many modules the page loads; asking that question made it obvious
that nobody had ever asked the matching one about the checks.

**The hole.** Delete one `registerX(debugTools);` line from
`registerAutoTests()` in `src/tests/index.js` and leave its `import` where it
is. `node --check` passes. The page boots. That module's checks are registered
nowhere, every run from then on is smaller, and **the gate exits 0**, because
nothing red is not the same as everything run. The runner prints a count, the
summary quotes it and no check compares it to anything. `HANDOFF.md` names
this as the lesson that keeps repeating — *"before believing a check on a set,
ask whether it would notice the set being cut in half"* — and lists three
times it has bitten. The set nothing was watching this time was the suite.

It is not a hypothetical shape either: F3 split eight modules and both of its
boot failures were code that moved without something that had to move with it.
A `register` call is exactly that kind of line.

**What was measured first.** Through `npm run probe`, because the arithmetic
had to be a fact before a check could assert it: `tests/index.js` imported
**56** registrars and called all 56; their source text declared **185**
registrations while **184** were live. Both ends of that gap are real and a
naive census gets both wrong:

- `heartbeat.js` registers `a-staged-hang-never-returns` only under
  `?hang=1` — a check that never returns has no business in a gate (F10). It
  is declared and not live **on purpose**.
- `heartbeat.js:63` writes its other check's id as `id: SELF`, a file-local
  constant. The first probe regex only matched string literals, so it read 184
  declared against 184 live and **balanced by coincidence** — one miss
  cancelling one conditional. That is the kind of green this check exists to
  stop, and it happened here in the measuring tool before it could happen in
  the check.

**What was built.** `src/tests/registry.js`, 131 lines, one check —
`the-registry-holds-every-check-its-modules-declare` — registered from
`tests/index.js` like every other, which makes it one of the registrations it
counts. It holds four things:

1. **The registrar's wiring.** Every `import { register as NAME } from
   './FILE.js'` is called exactly once inside `registerAutoTests`, and nothing
   is called that was not imported. Order is deliberately **not** asserted:
   `registerPerformance` is called last, out of import order, with a comment
   saying why ("it is the heaviest check and it leaves the world in a known
   state"), and a check that forbade that would be inventing a rule.
2. **Everything declared is registered.** Each imported module's text is
   fetched and every `registerAutoTest({ id: ... })` read out of it, the id
   either a literal or a file-local `const NAME = '...'` this resolves.
3. **Everything registered was declared** — the other direction, which catches
   a check appearing from somewhere that is not a module `index.js` names.
4. **The conditional ones are named, and still declared.** `CONDITIONAL` holds
   `a-staged-hang-never-returns` with its reason. Whether it is *live* is the
   URL's business and is not asserted — under `?hang=1` it is, and that run is
   the whole point of it — but it must still be declared somewhere, because an
   entry for something that has gone is an entry the next missing check hides
   behind. That is F13's allowance discipline, a day old and already the
   house style.

**An id the census cannot read is red, with its file and line**, never skipped.
This is the one decision in the check worth arguing for: skipping is what a
careful author does and it is wrong here, because the failure being closed is a
count that quietly falls. A registration the census cannot read is a
registration it cannot vouch for, and the fix — write the id as a literal or a
file-local const — costs the next author nothing.

**What it cannot see**, said plainly rather than left for the next run to
discover: a module dropped from *both* the import list and the call list. It
leaves no trace in `index.js` to compare against, and the page cannot list a
directory. `MIN_TEST_MODULES` (50, against 57 today) catches the registrar
having collapsed, not one line removed from it. The realistic slip — a call
line lost while the import stays, or a module split without its registration
following — is caught.

**That it can fail was proved**, both directions the done-when named, each a
real edit to the real tree and reverted after:

| what was broken on purpose | what the check said |
|---|---|
| `registerScuff(debugTools);` deleted from `tests/index.js` | red: *"scuff.js: imported as registerScuff and never called - its checks are registered nowhere"*, then each of that module's checks named — *"scuff.js:24 declares "a-climb-beyond-reach-bumps-poses-and-sounds" and the registry does not hold it"* |
| `const SELF` rewritten as a `join()` of two parts — still valid, still the same id at runtime | red: *"heartbeat.js:62: registers an id this census cannot read (SELF); write it as a literal or a file-local const"* |

The wiring diagnostic comes first in the failure line on purpose: the runner
keeps 400 characters and the per-check consequences ran off the end, which is
the trap D5 lost two runs to.

**Verified.** `npm run suite`, four runs: **plant 176 passed, 1 failed, 8 not for this map (769,937ms and 948,876ms), yard 157 / 1 / 27 (462,458ms and 608,664ms), exit 0, 0 red, 0 flaky, 0 console errors, 0 context losses, 0 loop frames**. One more passing
check per map than F13's verify (plant 175, yard 156), which is this job's own
and nothing else. The one failure on each map is the frame-budget check,
skipped headless. The check costs **892ms then 346ms on the plant, 849ms then 335ms on the yard** — the first run of each map pays a cold fetch of 57 modules and the second reads them from cache. Not flaky: the answer and the detail line are identical across all four.

Its green detail line, which is the census: *"57 registrars imported and each
called once; 186 checks declared, 185 registered, the difference being
a-staged-hang-never-returns (registered only under ?hang=1; it never returns
by design (F10))"*.

**What is left.** Nothing in F14. Two jobs this run, both of them the gate
inspecting itself, and that is worth naming as a pattern rather than a
coincidence: F12, F13 and F14 are all the same finding in different places —
a number that reads like coverage and is not. The seam is real and it is also
thinning, which is the honest thing to tell the next run. **The position is
unchanged and D49 is still the question**: `PLAN.md`'s block table is finished,
three runs running have now had nothing in the queue they could pick, and the
routine has spent all three sharpening an instrument pointed at a game nobody
has played.

## F15 — the way past a red gate, closed (2026-09-25 02:00, scheduled run)

The fourth run in a row to find the queue with nothing unblocked in it, and
`HANDOFF.md` had told it what to expect: *"a fourth run should expect that
seam thinner again and should say so rather than manufacture a job."* So the
search was for a hole and not for a feature, and there was one, in the last
place the gate had never been pointed — at its own exemptions.

**The hole.** `judge()` in `scripts/suite.mjs` reads
`scripts/suite-skips.json`, and the first thing it does with a skipped id is
drop it:

```js
if (skips.has(id)) {
  skipped.push({ id, map, reason: skips.get(id), outcome: ... });
  continue;
}
```

`continue` — before red, before flaky, before the deliberately-red list is
consulted. The check is reported with its outcome and counted nowhere. That
is the right behaviour for the one entry in the file, a frame budget measured
against SwiftShader at ~400ms a frame, and it is also, in one line of JSON, a
way to make **any** red check disappear.

The rule about it exists and lives entirely outside the repo. The scheduled
task's own `SKILL.md` says *"only a check that measures this machine's GPU or
audio hardware belongs there, and adding one is a change to record in
PROGRESS.md with the reason, never a way past a red gate."* Nothing held
either half. No module under `src/tests/` so much as named the file — the
only readers were the runner and the weekly audit, which greps it and reports
it unchanged, which is precisely the shape F13 closed for the two spec bans a
day earlier: a grep is not a gate, and the drift surfaces up to seven days
later.

**Measured rather than argued**, the way F14's arithmetic was. Two runs of
one command, a deliberately-failing check registered through `--pre` and
`--subset` narrowed to it alone:

| `scripts/suite-skips.json` | report |
|---|---|
| untouched | `"ok": false`, `RED (unexpected): a-deliberate-red-for-f15`, exit 1 |
| two lines added | `"ok": true`, `skipped headless: a-deliberate-red-for-f15 (fail)`, exit 0 |

Nothing else differed between the two. And this run's own gate log carries the
live case of the same mechanism working as intended, which is what makes it
hard to see: the frame-budget check's outcome is `fail` on both maps and the
gate is green.

Two smaller holes in the same file, both the discipline F13 and F14 had
already settled elsewhere: a skip whose id no module registers any more is a
dead exemption nothing reports, and a `reason` was free text nothing read
back.

**What was built.** Two halves, because one of them alone can be walked
around.

`src/tests/skiplist.js`, 143 lines, one check —
`the-headless-skip-list-holds-only-the-check-it-declares` — which fetches
`/scripts/suite-skips.json` from the origin the way `donedef.js` and
`registry.js` read source, and holds four things:

1. **The file and the check's declared list are the same set, both ways.**
   `ALLOWED` carries one entry with the hardware reading that is the whole of
   the argument for it. An id the file has and `ALLOWED` does not is red and
   named; an id `ALLOWED` has and the file no longer carries is red too,
   because an exemption for something that has gone is one the next skip
   inherits without arguing — F13's allowance discipline, now three jobs old
   and the house style.
2. **Every skipped id is a check the registry holds.** Read against
   `_autoTests` rather than against this run's results, so a `--subset`
   cannot make a real id look like a stale one.
3. **Every reason is an argument about hardware.** Present, 40 characters or
   more, and naming GPU / SwiftShader / a software renderer / hardware /
   audio — the only ground the rule allows. This is the weakest of the four
   and it is here to keep the file's own sentence honest; the set equality in
   (1) is what actually gates.
4. **The check's own id is not in the file.** The policeman is not
   exemptible.

And `scripts/suite.mjs` carries the other half, which is what makes (4) mean
something: a skip is honoured on a map **only while that check ran and passed
there**. `guardGreen` is computed per map before the id loop, absent counts as
not green, and a withheld skip falls through to be judged like anything else
and is named in the report (`skipsWithheld`) and in the summary
(`SKIPS WITHHELD`). Without this, adding one line of JSON naming the guard
would have taken every other skip with it — the hole closing itself.

**That it can fail was proved four ways**, each a real edit to the real tree,
reverted after, and each run against the real runner:

| what was broken on purpose | what the run said |
|---|---|
| an entry added for `a-check-that-does-not-exist-anywhere`, reason `"too short"` | red on all three clauses at once: *"skipped headless and this check does not declare it"*, *"no module registers it; the exemption names nothing"*, *"the reason is 9 characters; 40+ is..."* |
| the real entry deleted, the file left `[]` | red: *"`the-frame-budget-holds-everywhere-not-just-at-site-a` is declared skippable (...) and the file does not skip it; drop it from ALLOWED"* |
| the guard's own id added to the file, with a long reason naming GPU and audio | red: *"skips the check that holds the skip list; the runner withholds every skip on a map where this one did not pass"* |
| (the same run) | `SKIPS WITHHELD: the-frame-budget..., the-headless-skip-list...` and `RED (unexpected)` naming both — the runner refused to drop either, including the one that had asked to be dropped |

The third and fourth rows are the same run and are the point of the pair: the
attempt to exempt the guard is the attempt that fails loudest.

**What it cannot see**, said plainly rather than left for the next run to
find: whether a reason is *true*. It holds that a reason is there, is a
sentence rather than a label, and appeals to hardware. Whether SwiftShader
really draws in 400ms is a measurement, and the check that measures it is the
one being skipped. Nor does it stop a determined edit that changes `ALLOWED`
and the file together — nothing can, and nothing should; what it removes is
the *quiet* version, where a red goes away in one line that reads like
configuration.

**Verified.** `npm run suite`, four runs: **plant 177 passed, 1 failed, 8 not for this map (757,383ms and 934,598ms), yard 158 / 1 / 27 (466,425ms and 600,348ms), exit 0, 0 red, 0 flaky, 0 console errors, 0 context losses, 0 loop frames, and `skipsWithheld` empty**. One more passing check
per map than the gate that opened this run (plant 176, yard 157), which is
this job's own and nothing else. The one failure on each map is the
frame-budget check, skipped headless. The check costs **4ms then 3ms on the plant, 4ms then 3ms on the yard** - one fetch of a file the page has already been served, and the only check in the suite that reads the runner's own configuration. Not flaky: the
answer and the detail line are identical across all four runs.

Its green detail line, which is the census: *"1 check skipped headless, each declared here, registered, and argued from hardware (the-frame-budget-holds-everywhere-not-just-at-site-a measures this machine's GPU against an 8.33ms ceiling, and headless draws with SwiftShader in ~400ms); the runner honours a skip only where this check is green"*.

**What is left.** Nothing in F15. And the seam is now visibly thin: F12, F13,
F14 and F15 are four versions of one finding — a number that reads like
coverage and is not — and this one was the last structural place left to look,
the gate's own exemptions. **D49 is still the question, and it is now the
whole of it.** `PLAN.md`'s block table is finished; four runs running have had
nothing in the queue they could pick; the routine has spent all four
sharpening an instrument pointed at a game nobody has played. A fifth run
should not expect to find a fifth hole of this kind, and should say so rather
than invent one.

## The second arc — 2026-09-25

The first arc ran out: every block in `PLAN.md`'s table done, the queue
empty for four runs, D49 asking what next. Josh answered in two rounds of
interview (D50): friends can play it; ambience, not music; feel; a
third-sized Warden pass; and five things Section 19 refused are now in -
gamepad without aim assist, night vision and a thin-wall x-ray for the
Shade, the alarm camera's feed and the Warden's torch, synthesised voice
lines, a skeleton. Looks stay provisional; he decides as he plays.

**Queued.** Sixty jobs in eight blocks - H, K, M, J, I, L, N, O - each with
a size and a done-when, ordered so the game reaches friends with a Warden
worth hiding from before the rest is layered on. Spec 20.34 amends Section
19. `PLAN.md` carries the second table.

**Decided by the session, as infrastructure.** D47: the traps move to
`TRAPS.md` (G2), and the routine's own prompt was edited to read it - the
one thing the routine said it could not do. D48: the runner pays the GPU
wait once per map and names it (F11, option 3), no assertion retired.

**Waiting on Josh.** D51 only: an empty GitHub repository with Pages set to
GitHub Actions, and its URL. H1 and H2 wait on it; nothing else does.


## F11, closed — the wait is the suite's, and it beats while it waits (2026-09-25 17:00, scheduled run)

D48 answered F11's remaining choice with option 3: the runner waits, the
runner reports the number, and no check carries a wait it did not cause. This
carried it out, and in doing so found what the wait had actually been costing.

**What was built.** `AutoSuite.drainPipeline(inFlight)` (`src/ui/autosuite.js`)
is the suite's own synchronisation, in two halves:

- A **polled fence**, which is the half that matters. `gl.fenceSync` plus
  `clientWaitSync(sync, 0, 0)` answers at once, so the wait becomes a loop
  that yields a task and publishes the heartbeat four times a second. A wait
  that stands still is a wait `--stall` cannot tell from a hang; a wait that
  beats is one it can. Bounded by `CONFIG.debug.pipelineWaitBudgetMs` (600s)
  so a fence that never signals cannot wait forever.
- The **bounded `getError` drain** behind it — the call F11 measured, and the
  one that clears the error state, 64 reads and bailing on a lost context (F1).

A check declares `glSync: true` and the runner drains for it *before its own
clock starts*; a top-level `runChecks` drains once more after its last check;
both totals come back as `pipelineWaitMs`, which `runAutoTests` says out loud
in a tab and `scripts/suite.mjs` prints on the run line. A **nested**
`runChecks` deliberately does not drain at the end — a check that drives the
runner itself would otherwise pay, inside its own clock, the very wait this
moves off a check.

`a-zero-size-viewport-does-not-blind-the-renderer` keeps all five assertions
and loses its drain to the one word `glSync: true`. `--stall` comes down from
**600s to 240s**, with `--stall-wait` (600s) for the declared wait phase:
two budgets, because a check that has stopped answering and a suite waiting on
the renderer are different things, and the first is now called hung in four
minutes rather than ten.

**The fence does reflect the tail, and it polls.** This was the risk in the
design and it is settled by measurement: the new check's own drain answered in
**30,306ms across 61 beats** on the plant and 27,109ms across 63 on the yard.
Sixty-one beats over thirty seconds is one every 250ms, exactly as written —
so the wait is real, the fence sees it, and the heartbeat advanced all the way
through it. A 265s wait would publish ~1,060 beats and never come near 240s of
standing still.

**The check's ms, before and after.** 265,944ms → **24ms** on the plant (26ms
on the second run), 174,279ms → **19ms** on the yard (18ms). The slowest check
in the suite is now `every-route-reads-lit-from-its-foot` at **77,294ms**,
which is the number D48 predicted and which 240s clears three times over.

**What it cost, and the thing that was hiding.** The plant run went 755s → 963s
and the yard 473s → 646s, which looks like the bookkeeping charging 200s a run
for nothing. It is not. Compare the *pairs*, because two runs of a map share
one page:

| | run 1 | run 2 | difference |
|---|---|---|---|
| plant, before (F15's verify) | 757s | 935s | **+178s** |
| plant, after | 963s | 957s | -6s |
| yard, before | 466s | 600s | **+134s** |
| yard, after | 646s | 653s | +7s |

F11 wrote that the last check's tail "is normally never paid because the page
is torn down first". That is true of the *last* run on a page and false of
every other one: run 1 left its tail behind and **run 2 paid it**, inside run
2's own first synchronisation, which is why the second run of a map had always
been the slower one. The pipeline wait per run is now 463s and 461s on the
plant, 339s and 349s on the yard — the same number twice, where before it was
one run's 265s and the next run's 265s plus its predecessor's leftovers. The
real added cost is one tail per map per suite (plant 1,692s → 1,920s, yard
1,066s → 1,299s, about +230s each), and what is bought for it is two runs that
are measured the same way. A gate whose two runs differ by 178s of invisible
wait is a gate comparing two different things.

**What was not built.** Nothing was retired: the check has its five
assertions and the GL-error clause is one of them. The run's wall clock did not
improve, which D48 said in advance and is the honest half of option 3.

**The check.** `src/tests/pipelinewait.js` (119 lines),
`the-pipeline-wait-is-the-runs-number-and-not-a-checks`: `drainPipeline` exists,
answers with its own ms, leaves the error state clear and publishes at least
two beats; an inline check declaring `glSync` is entered under phase
`pipeline-waited` and one declaring nothing under `running` — both halves, because
the first alone would also pass if the runner drained before every check, which
F11 measured at 236s of added run; `runChecks` returns `pipelineWaitMs`; and
`a-zero-size-viewport-does-not-blind-the-renderer` still declares `glSync`.
Registered straight after `fuzz.js`, where the run's tail has been paid once,
so its own drains are seconds rather than minutes. It costs 30s on the plant
and 27s on the yard, which is the tail of the two checks between it and the
one that drained last, and it says so in its own detail line.

**Verified.** `npm run suite`, four runs: plant 178 passed / 1 failed / 8 not
for this map (963,216ms, 463,324ms of it the wait; 957,125ms, 461,237ms), yard
159 / 1 / 27 (645,687ms, 338,878ms; 652,848ms, 348,650ms), exit 0, 0 red, 0
flaky, 0 console errors, 0 context losses, 0 loop frames, 0 skips withheld.
One more check per map than the gate that opened the run (plant 177, yard 158),
which is this job's and nothing else. The one failure on each map is the
frame-budget check, skipped headless. Gate at the head of the run, on
`3f19d03`: plant 177 / 1 / 8 in 755,052ms, yard 158 / 1 / 27 in 473,233ms,
exit 0.

## G2 — the traps get a home, and HANDOFF.md gets under 400 (2026-09-25 17:00, scheduled run)

G1 was asked for `HANDOFF.md` under 400 lines, reached 533, and proved with
arithmetic that the remaining gap was the Environment traps and nothing else:
every other section, already written as tightly as it could be stated, came to
345 lines, which left the traps 55 against about thirty of them. D47 put the
three ways out to Josh and he took option 2 — move them to a sibling — which
was the one option the routine could not take on its own, because the scheduled
task's own prompt told every run to read "the Environment traps section of
HANDOFF.md" and that file lives outside this repo.

**What was built.** `TRAPS.md`, 223 lines: a header saying what the file is,
why it is not in `HANDOFF.md` any more, and the rule that a trap is retired by
name in a `PROGRESS.md` entry and never quietly deleted — then all 203 lines of
the section, verbatim. `HANDOFF.md` is **394 lines**, from 597 at the start of
this job. The heading stays, with a pointer under it, for two reasons: the
routine's prompt falls back to the section while it exists, and a reader who
only has that page should still be handed the two traps that bite most often —
read pixels back rather than trusting a screenshot, and warm sixty frames
before measuring anything. The file's own opening paragraph now names
`TRAPS.md` beside `QUEUE.md`, `DECISIONS.md` and `PLAN.md` as something to read
before starting, and quotes its own line count.

**What holds it.** `traps-md-holds-the-traps-and-handoff-points-at-it`, in
`src/tests/donedef.js` beside the check that holds `PLAYTEST.md`. There are
exactly two ways to undo this job and it is both of them: delete or hollow out
`TRAPS.md` (a floor of 25 traps, counted by the bold sentence each one opens
with — 36 today), or paste the traps back into `HANDOFF.md` (a limit of 400
lines, and the traps are 203). It also holds `HANDOFF.md` to mentioning
`TRAPS.md`, since a file nothing points at is a file the next run never opens.
**Proved red**: with `TRAPS.md` moved aside, one run of that check alone,
`suite: FAIL`, `RED (unexpected): traps-md-holds-the-traps-and-handoff-points-at-it`,
exit 1; the file was moved back and the same subset is green.

**A rule this job had to amend, rather than quietly break.** Block G opened
with "a job in this block may never change a file under `src/`", and the
protocol above it requires every job to end with a check under `src/tests/`
that would fail if the job were reverted. G1 resolved the collision by having
no new check and writing down that it had none. That is the right answer once
and the wrong answer twice: the documents are now load-bearing — the traps are
a file a run is instructed to read, and G1's line count is a target a future
session can silently blow. So the block's rule is amended in `QUEUE.md` to *may
never change the game*, which is what it meant, and a check that fetches a
markdown file and counts its lines is not the game.

**What was not done.** No trap was retired. D47's option 3 was to retire the
several that are now history rather than hazard — the silent boot timeout, the
check that inherited the last check's menu, the flaky sound render — and Josh
did not take it, so they stay in full. They are the ones that read as history
with an operative sentence at the end, and the sentence is what they are for.

**Verified.** `npm run suite`, four runs: plant 179 passed / 1 failed / 8 not
for this map (954,461ms, 457,062ms of it the pipeline wait; 951,437ms,
457,377ms), yard 160 / 1 / 27 (652,274ms, 345,315ms; 638,087ms, 336,725ms),
exit 0, 0 red, 0 flaky, 0 console errors, 0 context losses, 0 loop frames, 0
skips withheld. One more check per map than F11's verify an hour earlier (178,
159), which is this job's and nothing else; every other count identical, which
is what a documentation job should do. The check reads two markdown files and
nothing the game loads at runtime changed. The four table rows in
`HANDOFF.md`'s *Where things stand* were rewritten with these numbers after the
run, which leaves what the check reads — the line count and the pointer at
`TRAPS.md` — exactly as it was verified, because each of those rows is one
line.

## F16 — every run-pair on record, and a correction to F11 (2026-09-25 17:00, scheduled run)

F11 closed earlier in this run with a finding attached: two runs of a map share
one page, so the renderer tail F11 had called "never paid, because the page is
torn down first" was in fact carried by the next run. That makes every pair of
run times in this repo two measurements of different things, and several entries
reason from the difference between them. F16 read the pairs.

**Every pair since F5 put the headless runner in charge.** Plant then yard, run
1 → run 2, the gap in the last column of each half.

| entry | plant 1 | plant 2 | gap | yard 1 | yard 2 | gap |
|---|---|---|---|---|---|---|
| F10 | 748,004 | 937,517 | **+189,513** | 467,292 | 613,467 | **+146,175** |
| G1 | 762,898 | 921,187 | +158,289 | 496,006 | 597,669 | +101,663 |
| F11, first half | 753s | 898s | +145s | 481s | 637s | +156s |
| F12 | 760,649 | 942,528 | +181,879 | 468,644 | 604,053 | +135,409 |
| F13 | 752,903 | 928,579 | +175,676 | 462,613 | 607,128 | +144,515 |
| F14 | 769,937 | 948,876 | +178,939 | 462,458 | 608,664 | +146,206 |
| F15 | 757,383 | 934,598 | +177,215 | 466,425 | 600,348 | +133,923 |
| **F11, closed** | 963,216 | 957,125 | **−6,091** | 645,687 | 652,848 | **+7,161** |
| **G2** | 954,461 | 951,437 | −3,024 | 652,274 | 638,087 | −14,187 |

Before F5, when the suite was smaller and run from the page: plant +65s, +55s,
+32s, +98s, +54s, +30s, +54s, +63s; yard −4s, +5s, +7s, −15s. So the second run
of the plant has been the slower one in **every pair on record**, by an amount
that grew with the suite — 30-98s at 130-160 checks, 145-190s at 172-177 — and
the yard's gap was smaller and sometimes negative. It is now ±14s on both maps,
and the spread is printed on every run.

**The arithmetic of the close, which is what makes the reading solid.** From
F15's verify to F11's: plant run 1 went 757s → 963s, **+206s**, which is the
end-of-run drain F11 added and nothing else. Run 2 went 935s → 957s, **+22s**.
If run 2 also pays a ~206s drain of its own — and it does, its reported wait is
461s against run 1's 463s — then run 2's actual *checking* got about 184s
faster. That 184s is the burden it had been carrying, and paying it at the end
of run 1 is what removed it.

**What falls: F11's account of where run 2 paid.** F11's entry, its QUEUE line,
its HANDOFF line and its commit message all said run 2 paid the inherited tail
"inside its own first synchronisation". The record already refuted that and this
session did not look: F5's own verify reported
`a-zero-size-viewport-does-not-blind-the-renderer` — run 2's first
synchronisation — at **268,927ms in run 1 and 252,906ms in run 2**, sixteen
seconds *cheaper*, while run 2's total was 189s longer. The burden is real and
the arithmetic above sizes it, but it is spread through run 2 and its mechanism
is not established by anything on record. Candidates the data does not separate:
pipeline work still being built while run 2's checks compete for four cores, a
page that has run the suite once, and heat. Naming one would be the same mistake
twice, so F16 names none. The corrected sentence, everywhere it appears: *run 1
left its tail behind and run 2 carried it, ~184s of it, spread through the run.*

**What is flagged, and cannot be settled from the record.** F11's three-placement
table — as found 753s, `getError` after every check 989s, `flush` after every
check 765s, "each a full plant run" — does not say which run of a pair each came
from, and the pair gap is 178s against a 236s effect. The conclusion survives on
other evidence in the same paragraph: that experiment also moved the cost onto
two named unrelated checks, 247s and 251s, which is a within-run observation the
gap cannot manufacture. The same caution applies to every per-check ms quoted
from `--details` without saying which run it came from: a check's ms in a second
run carried its share of up to 190s, so prefer the first run of a map.

**What stands.** Every "the same counts as the previous verify" (pass/fail
counts, not times). The orphaned-runner trap's refusal to blame contention for
450s → 850s, which reasons from absolute times all measured with the orphan
alive. F5's `--stall` margin, which used the run-1 number and would reach the
same verdict with the run-2 one — and which F11 has since made moot.

**Corrected in the living documents.** `HANDOFF.md`'s "a cold plant run is
legitimately 850s" was the middle of a contaminated pair; it reads 960s and both
runs now agree. Its F11 index line and `QUEUE.md`'s F11 Done entry lose the
"inside its own first synchronisation" clause. `PROGRESS.md` is append-only, so
F11's entry keeps its text and this entry is the correction.

**What was built.** `judge()` in `scripts/suite.mjs` computes a `spreads` entry
per map — `spreadMs`, `waitSpreadMs`, `runs`, `longestMs` — and the summary
prints one line per map: the spread in ms, as a share of the longest run, and
the spread in the pipeline wait. Reported and never judged: a spread is a
reading about the machine, and a red would be a threshold nobody has grounds for
yet. `the-pipeline-wait-is-the-runs-number-and-not-a-checks` gains the two
clauses F16 depends on and F11 left unheld — that a **top-level** run drains
after its last check (driven through `_runChecks(tests, true)`, the only way a
check running inside a run can be a top-level run; a nested run skips the drain
by design, so `runChecks` could not show it), and that the runner still computes
the spread.

**Verified.** `npm run suite`, four runs: plant 179 passed / 1 failed / 8 not
for this map (957,174ms, 460,768ms of it the wait; 948,218ms, 456,839ms), yard
160 / 1 / 27 (641,760ms, 335,845ms; 643,604ms, 339,704ms), exit 0, 0 red, 0
flaky, 0 console errors, 0 context losses, 0 loop frames, 0 skips withheld. The
check counts are G2's exactly, because F16 extended a check rather than adding
one. And the new lines say the thing the job is about: **plant, 2 runs spread
8,956ms (1% of the longest), pipeline wait spread 3,929ms** · **yard, 1,844ms
(0%), 3,859ms**. Against the last pair measured before F11 — plant 757s and
935s, a 177,215ms spread, 23% of the longest — that is the whole finding in one
line of output.

**Left.** `HANDOFF.md` is 399 lines of the 400 its own check allows, and the
Source row says so: the next job to add a paragraph takes one out, which is what
G1 and G2 were for. The mechanism behind the ~184s is open and deliberately
unnamed; if it is ever worth knowing, the experiment is a pair of runs on a
fresh page each versus a shared one, and the orphaned 09-18 runner should be
dead first.

## H1, H2 — on GitHub, and live (2026-09-26/27)

Josh made the repo and pasted its URL (D51); Pages was already set to
GitHub Actions.

**H1.** `origin` is https://github.com/papasauce11/blackline; `main` pushed
first (the default branch), then `phases-14-45`. The GitHub CLI was already
logged in, so a repo-local credential helper (`credential.https://github.com.
helper = !gh auth git-credential`, `.git/config` only) lets an unattended run
push without the Windows credential manager's window. Both routine prompts
now push after every commit, never `main`, never force.

**H2.** Built as an Actions workflow first — stage `index.html` and `src/`,
deploy — and GitHub refused the push: *refusing to allow an OAuth App to
create or update workflow without `workflow` scope*. The CLI token has
`repo`, not `workflow`, and widening it is a browser login only Josh can do.
The rejected commit had never left this machine, so it was rebuilt without
the workflow, and Pages switched to a **branch deploy** of `phases-14-45`:
GitHub rebuilds on every push, no file of ours involved. `.nojekyll` keeps
the build from treating the repo as a Jekyll site. The `github-pages`
environment allowed only `main` to deploy; the working branch is added.
`index.html` gains an empty favicon — the suite's server answers
`/favicon.ico` with 204, every other host with a 404 that is a console error.
`scripts/suite.mjs --url <origin>` runs the gate against a deployed copy.

**Verified.** Local, both maps twice: plant 179 passed / 1 failed / 8 not for
this map, yard 160 / 1 / 27, identical, 0 console errors. Live, the first
build (`ab9cc59`, *built*, no error): the regression set 29/29 on plant and
29/29 on yard against the Pages URL, 0 console errors. The whole repo is
served, docs included; it was public on GitHub already.

**Found.** The orphaned runner from 2026-09-18 (pid 4792) is still alive and
was measured against in every run tonight; HANDOFF's trap stands.


## H3 — a version you can see, with no workflow to write it (2026-09-27 02:00, scheduled run)

**The job.** "A `version.json` at the root written by the deploy workflow
(commit, date) and by `npm run suite` locally as `dev`; the main menu's footer
shows it; the bug report (H12) includes it." Written before H2 discovered there
is no deploy workflow and cannot be one from this machine: the CLI token has
`repo` and not `workflow` scope, so Pages is a **branch deploy** of
`phases-14-45` and the only thing that reaches the deployed root is a commit.
Both halves of the done-when were therefore built differently, and the
difference is D52 rather than a quiet substitution.

**The commit carries the stamp.** `scripts/version.mjs` (`npm run stamp`, 116
lines) writes `version.json` at the root from git — `commit`, `short`, the
committer date, `branch` — and **refuses to write while the working tree is
dirty**. That refusal is the whole design, not a safety net: it is what makes
the script safe to call at the top of `scripts/suite.mjs`, which it now is. A
gate run on a clean tree stamps HEAD; a verify in the middle of a job leaves the
file alone rather than dirtying the tree it is judging, and rather than writing
the commit *before* the work and calling it the build. The suite says which on
stderr (`suite: version.json: already current (97354db on phases-14-45)`, or
`the working tree is dirty`). The exact stamp for a job's own commit comes from
`npm run stamp` in the `Record <job>` commit, exactly the way that commit
already writes the job's hash into QUEUE.md — so the idiom is one the routine
already runs, and both routine prompts now say so.

It writes the same bytes for the same HEAD, so it is idempotent: there is no
`stampedAt`, deliberately, because a timestamp would make every gate run dirty
the tree. A checkout with no `.git` gets no file and no error.

**"dev" is the host's answer, not a field.** `src/version.js` (108 lines,
importing nothing) fetches the file once — `new URL('../version.json',
import.meta.url)`, so it resolves against the module and not the document, and
`cache: 'no-store'`, because a cached stamp on the deploy is a footer naming
last week's build. It exports `VERSION` (mutated in place, so H12's report never
holds a stale copy), `loadVersion()` (memoised), `isDevHost()` and
`versionLabel(version, host)`. A `channel` baked in at stamp time would be
whatever the last person to stamp happened to have and would say `build` on a
local server serving the same bytes; `location.hostname` cannot be wrong.
localhost, `127.0.0.1`, `file://`, `.localhost` and `.test` are a working copy
and the label opens with `dev`; anything else is the deploy. So the footer reads
`dev · 97354db · 2026-09-27` from `npx serve` and the suite, and
`97354db · 2026-09-27` on Pages — which satisfies the "locally as `dev`" half
without the suite having to write anything.

`versionLabel` takes its version and host as arguments so a check can read every
branch of it, including the unstamped one. It cannot be staged by fetching a path
that is not there: that 404 is a browser console error and the runner counts them
(the same reason index.html carries an empty favicon, H2). A missing stamp being
loud is the point — better than a quiet "unknown" in a corner — so the fallback
is tested by argument and never by taking the file away.

**The footer.** `ui/menu.js` gains one `.footer` div in `_renderMain()` and
`_version()`, which reads `handlers.version()`. A getter and not a value because
the stamp arrives over the network after the menu is first drawn: `panels.js`
passes `version: () => versionLabel()` and re-renders on `loadVersion()`,
guarded to `menu.page === 'main'` so a settings page open at the time is not
thrown away and a check mid-run does not lose its DOM. `ui/` keeps its one
import (Section 3.1) — the label comes down from the root, the module does not
go up.

**Two new checks**, `src/tests/version.js`, registered after `registerSettings`:

- `the-build-stamp-is-a-real-commit-the-site-serves` fetches `version.json`
  relative to the page — so under `--url` it is the **deployed** file being
  judged, which is as close as this gets to the workflow half of the done-when —
  and holds it to a 40-hex commit, a `short` that is its first seven, a date
  that parses and is not in the future, and a named branch; then that the page
  loaded that file (`VERSION.source === 'stamp'`, every field equal); then every
  branch of `versionLabel` and both directions of `isDevHost`. 33ms.
- `the-main-menu-footer-names-the-build-it-is-running` opens the real menu,
  reads `#bl-version`, and requires it to equal `versionLabel()` and to contain
  the commit; then that it is *drawn* — a bounding box over 1x1, computed opacity
  over 0.2, not `display: none`, inside the card's own width — because a footer
  nobody reporting a bug can read is not a version you can see. Then a trip
  through the settings page and back, since the stamp lands after boot and only
  a re-render shows it; and that neither the settings page nor the pause overlay
  (the same surface, `menu.js`) has gained it. 9ms.

Neither asserts the stamp names HEAD. A page cannot know HEAD, and by design it
sometimes does not: between a job's commit and the record commit that re-stamps
it, the file names the commit before the work. What is asserted is that it is a
real, well-formed commit of a named branch.

**Verified.** Both maps twice, exit 0, 0 red, 0 flaky, 0 console errors, 0
context losses, 0 skips withheld. **Plant 181 passed / 1 failed / 8 not for
this map (977,468ms and 978,010ms), yard 162 / 1 / 27 (654,280ms and
655,418ms)** — two more per map than the gate that opened the run (179 and
160), which are these two. The pairs agree to 542ms on the plant (0% of the
longest) and 1,138ms on the yard, and the one failure per map is the
frame-budget check, skipped headless. The new checks read **8-9ms and 2-3ms**
on the plant and 58ms and 3ms on the yard (the 58 is the first fetch of the
run paying for the connection, not the check). The suite printed
`version.json: the working tree is dirty` on every run and left the file
alone, which is the refusal working.

**And verified on the deploy**, which is the half only the live site can
answer. After the record commit stamped `2af44b2` — the H3 commit itself, so
the design worked end to end — Pages rebuilt and
`npm run suite -- --runs 1 --url https://papasauce11.github.io/blackline/`
ran both new checks against it: **2/2 on the plant and 2/2 on the yard, 0
console errors**, reading `/blackline/version.json: 2af44b2 on phases-14-45`
with the footer at `2af44b2 · 2026-09-27` — no `dev`, because the host is not
local. So the served root carries the stamp, the relative URL resolves under
the `/blackline/` base, and the host test does the job a `channel` field would
have got wrong.

**Found.** Nothing new. The orphaned runner from 2026-09-18 (pid 4792) is still
alive and every timing above was measured against it.

**Left.** D52's alternative, one line for Josh: a browser login widening the
token to `workflow` scope would let an Actions deploy write the stamp at deploy
time, making it exact rather than one commit behind. Nothing needs it; H3's
script becomes four lines of a workflow if he wants it.

## H4 — boot: a page that says Blackline before the game exists (2026-09-27 02:00, scheduled run)

**Measured first, and the reading changed the design.** A probe
(`scripts/probe.mjs`) rebuilt each map with the four `GameMap` derivations
instrumented. The bake is **827/905ms on the plant and 439/336 on the yard**,
and almost none of it is the geometry:

| | plant | yard |
|---|---|---|
| declaration (214 / 132 `addSolid`) | 112ms | 83ms |
| `collision.build()` | 11ms | ~0ms |
| `deriveClimbableSurfaces()` | 86ms | 6ms |
| `deriveRoomEntries()` | 332ms | 104ms |
| `deriveWardenGround()` | 333ms | 263ms |

So the slice boundaries belong in the six-line "Finish" block both map builders
already ended with, and nowhere else. Sub-slicing the two 330ms derivations
would mean opening `mapground.js` and `maprooms.js` for no player-visible gain;
three paints during a sub-second bake is what "the page paints" needs.

**One build path, two drivers.** Both builders are generators now
(`function* buildPlantMap`, `function* buildYardMap`), and the tail they shared
is `src/mapfinish.js` — `finishSteps(map, expects)`, yielding a label after
each of the five steps, in the order both maps already had and for the reasons
both already carried (the routes are lit after the climb rule and before
validation, B7). `maps/index.js` gains `bakeMap(id)`, which drives it a slice at
a time and exposes `.step()`, `.slices` and `.map`; **`buildMap` is now that
same generator run to the end**, so every check that wants a map sees exactly
what it always saw and there is no "loading" build beside a real one to drift
from it. `BAKE_SLICES` is 6 and a check holds a real bake to it.

**The yield is a `MessageChannel` message.** Not `setTimeout` — Section 9 and
15 ban it and F13's `no-source-file-calls-math-random-or-sets-a-timer` would go
red on a second one. Not `requestAnimationFrame` — it never fires in a hidden
document, and the Browser pane is one, so a boot that waited for a frame there
would never finish. A posted message is a real task boundary that always
arrives.

**Boot is a promise, and nothing needed to know.** `bootWorld` is `async` and
takes `onSlice`; `bootstrap()` awaits it and returns a refusal or null;
`window.BLACKLINE` is published at the *end* of the `.then`. Every way into the
game already waited for that object — the runner's
`waitForFunction(() => !!window.BLACKLINE)`, `headless.mjs`'s `loadMap`, the
console — so `scripts/` needed no change at all, which was the thing most
likely to have gone wrong here.

**The loading screen is markup.** `#bl-boot` in `index.html`, visible from the
first paint, because a module that drew it would itself be waiting on the
network at the one moment a loading screen is for. `src/bootscreen.js` only
writes the stage line into it (`geometry · 1 of 6`, …) and takes it down.

**The WebGL2 refusal cost 16 seconds and now costs nothing.** The first shape
was `webgl2Supported(canvas)` in bootscreen.js, probing a throwaway canvas —
throwaway because `canvas.getContext('webgl2', attributes)` hands back the
context a canvas already has and *ignores the second argument*, so probing
`#bl-canvas` would have silently dropped `antialias`, `powerPreference` and
`stencil: false` from `createRenderer`. It worked, and the check measured
**16,240ms**: a second SwiftShader device. Worse, the real boot would have paid
it and then the renderer would have paid it again, on every page load, inside
the runner's 60s harness timeout.

So the WebGL2 test is now `createRenderer()` in `view.js` returning **null**
instead of letting three's `Error creating WebGL context` reach the page as a
stack trace. It costs nothing, it cannot disagree with itself, and it is the
question that actually matters. `boot.js` hands `{ unsupported: 'webgl2' }` up
and `main.js` shows the panel and publishes no harness. The same check now
reads **19ms**.

**Two messages, in one place.** `NOTICES` in `bootscreen.js` carries the title,
body and whether it is fatal. WebGL2 is fatal: no button, and it takes the
loading screen down with it, because "starting" behind a message saying nothing
is starting is a lie. Touch is a warning with *Continue anyway*, and the game
boots behind it. The classifier is a coarse pointer **and** no hover, so a
touchscreen laptop — which plays this perfectly — is not caught.

**Three new checks**, `src/tests/boot.js`, registered second, before the world:

- `a-browser-without-webgl2-is-told-so-plainly` drives `createRenderer` with a
  canvas returning null and one that throws, and asserts the *live* renderer is
  what that same function built on `#bl-canvas` — so the refusal is on the path
  the boot takes and not beside it. Then the panel: the text against `NOTICES`,
  no way out, the loading screen down behind it, a box over 1x1. three logs
  before it throws, so the two deliberate errors are **captured and asserted**
  rather than silenced (the `tests/donedef.js` idiom) — they were 4 console
  errors in a two-run subset before that, which is a defect even when every
  check passes.
- `a-touch-device-is-told-and-the-game-boots-behind-it` classifies a phone, a
  touchscreen laptop and a desktop through a stubbed `matchMedia`, reads what
  the real boot recorded in `debugState.bootGate`, then shows the notice, steps
  the sim behind it, clicks the button and steps again.
- `the-bake-yields-the-page-a-frame-to-paint` reads what the boot recorded
  (`debugState.bootBake`: 6 slices, 6 yields, 578-614ms) *and* drives a fresh
  bake, because a recording alone could be written by code that slices nothing.
  It queues one marker per gap and requires that at slice N exactly N have run —
  which is "count the frames during boot" in the only form a page can honour
  after its own boot is history. **The first version of this measurement was
  wrong**: it queued ten markers up front, and port messages queued together are
  delivered together, so one turn read as five and the check said "2 of 5". One
  marker per gap is the honest form. It also asserts `bakeMap` and `buildMap`
  agree on boxes, ledges, rooms, routes and ground cells, which is what keeps
  the two drivers one path.

**Verified.** Both maps twice, exit 0, 0 red, 0 flaky, 0 console errors, 0
context losses, 0 skips withheld. **Plant 184 passed / 1 failed / 8 not for this
map (986,020ms and 980,584ms), yard 165 / 1 / 27 (658,688ms and 658,562ms)** —
three more per map than H3's gate (181 and 162), which are these three. The
pairs agree to 5,436ms on the plant (1%) and 126ms on the yard, and the one
failure per map is the frame-budget check, skipped headless. Per check:
`a-browser-without-webgl2-is-told-so-plainly` **4-16ms** (16,240 before the
redesign), the touch one 1-3ms, and the bake one 1.0-1.9s — it drives two extra
bakes on purpose. The real boot reports **6 slices and 6 yields over 630ms on
the plant and 407ms on the yard**, which is the bake measured from inside the
page rather than from a probe, and agrees with the probe's 827/905 and 439/336
once the probe's own instrumentation is taken off.

**And verified on the deploy.** Pages rebuilt at `d191a9b` and
`npm run suite -- --runs 1 --regression --url https://papasauce11.github.io/blackline/`
ran **29/29 on the plant and 29/29 on the yard, exit 0, 0 console errors**. That
is worth more than a repeat of the local gate: the runner reaches the game
through `waitForFunction(() => !!window.BLACKLINE)`, so a green regression set
against the live copy is proof that the *async* boot publishes the harness
properly over a real network, on the build a friend will open — the one thing
about H4 that could have been fine locally and broken in the place it matters.

**Found.** Two things worth keeping. The bake is under a second on both maps,
so **the loading screen is mostly for the first draw, not the bake** — headless,
the first draw of an unseen view compiles for tens of seconds (TRAPS); on a real
GPU both are fast, and which of the two a player actually waits on is a question
only H11's bench can answer. And creating a second WebGL context under
SwiftShader costs 16 seconds, which is worth knowing before anything else here
reaches for one.

**Left.** D53, all of it wording and timing Josh can overrule by looking.

## Audit — 2026-09-27

**Landed.** Week 2026-09-19 → 09-27; oldest commit `83ec7fc` (D7,
2026-09-19). 62 commits, 54 of them since the last audit (`7c71c70`,
09-20). The Done section of QUEUE.md grew from 43 entries at `83ec7fc` to
68: **26 jobs in the window** — D7, E1, E2, F6, E3, F7, E4, F8, F9, B5d,
C7, E5, E6, F10, G1, F11, F12, F13, F14, F15, G2, F16, H1, H2, H3, H4 —
22 of them since the last audit. Blocks B, C, D, E, F and G all closed
this week (B5d on D27, C7 on D8, D3b dropped on D38); the first arc
finished (D49) and the second was interviewed and queued (D50, 09-25);
H is open at H5 with 4 of 16 done. Queued during the week, by id, against
the queue at `83ec7fc`: **69** — F10–F16, G1, G2 (all nine already done)
and the second arc's sixty (H1–H16, K1–K7, M1–M7, J1–J9, I1–I6, L1–L4,
N1–N4, O1–O7), four of them done. At HEAD: 56 `[ ]` open, **0 `[~]`
WIP**, 0 blocked. No job has been WIP at any audit since B5c (09-13).

**Blocked on Josh.** **None.** Every entry under the Blocking heading
carries a `decided:` line (D8, D13, D14, D15, D20, D23, D25, D27, D38,
D47, D48, D49, D51 — the last two answered 09-25 and 09-26). Provisional
and undecided, not blocking: D52 (the build stamp) and D53 (what boot says
and refuses), both 09-27, 0 days, and the D9–D46 looks set from earlier
weeks; HANDOFF names D52 and D53 as the two worth a glance.

**Suite health.** HEAD `c5856f8`, `npm run suite -- --runs 1`, both maps:
plant **184 passed, 1 failed, 8 not for this map** (985,528ms, 471,700 of
it the pipeline tail); yard **165 passed, 1 failed, 27 not for this map**
(680,792ms, 358,829 tail); red [], flaky [], expectedRed [],
unexpectedGreen [], skipped 2 (the frame-budget check, once per map,
outcome fail), skipsWithheld [], consoleErrors 0, contextLosses 0, exit 0.
Matches HANDOFF.md (184/1/8, 165/1/27) and the empty Deliberately-red
list: **pass**. Against the last audit that is +22 checks on the plant and
+20 on the yard. Diff `83ec7fc..HEAD -- src/tests scripts/suite-skips.json`:
33 files, +4,045 / −30; `scripts/suite-skips.json` unchanged (the one
frame-budget entry). Every one of the 30 removed lines read:
- **No check deleted, none added to the skip list, no threshold loosened.**
  Sixteen new test modules registered in `tests/index.js` (boot, seeds,
  defuseline, version, keylight, sitetint, post, figure, animation, look,
  materials, yardmaterials, pipelinewait, heartbeat, registry, skiplist);
  `donedef.js` grew by 178 lines and two new limits, `HANDOFF_LINE_LIMIT =
  400` and `MIN_MODULES = 120`, both new assertions.
- Seeds re-plumbed, not moved (F12): nine pinned constants became
  `exploreSeed('<label>', <the same value>)` — e.g. `tests/fuzz.js` `- seed:
  8675309` → `+ seed: FUZZ_SEED` with `FUZZ_SEED = exploreSeed('shade-fuzz',
  8675309)`; likewise aisoak `0xd5a1`, difficulty's eight `0xd1f1…` and
  `0xb0b5`, engine `0xa11ce`, shade `0xf0f0f0`, traversalfuzz `20260914` /
  `19770912`, wardenground `20260914`. The fallback is the old value, so the
  gate is unmoved, and `the-url-seed-reaches-every-exploratory-check` holds
  that a URL without `?seed=` returns every fallback unchanged.
- Same spot, new name (C7): `- const OFF_RING = CONFIG.map.marking.siteRingOuter
  + 2.5;` → `+ const OFF_RING = SITE_SAMPLE_OFFSET;` in visual.js, yardlight.js
  and groundview.js; `siteRingOuter` was 1.0 at `83ec7fc` and
  `SITE_SAMPLE_OFFSET` is 3.5, the same square metre.
- Tighter (B5d): `tests/plantcensus.js` `- if (!withinDefuseReach(cell,
  spot.at)) continue;` → `+ if (!withinDefuseReach(cell, spot.at,
  h.map.collision)) continue;` (three sites) — the reach now needs a clear
  line, and the AI's snap accepts a cell only through the same predicate.
- Moved, not loosened (F11/D48): `tests/fuzz.js`
  `a-zero-size-viewport-does-not-blind-the-renderer` gained `+ glSync: true,`;
  the 265s pipeline wait is charged to the run, the assertion is the same.
- Reads what ships (E6): `tests/pixels.js` and `tests/feedback.js`
  `- renderer.render(h.scene, camera);` → `+ h.post.render(h.scene, camera);`.
  E1's rename: `tests/detection.js` `materials.teal` → `materials.body`.

**Drift.** Over 600 lines: `src/config.js` 1,665 (was 1,465; exempt).
`src/physics.js` sits at exactly 600, `tests/movement.js` 599,
`systems/combat.js` 593, `tests/visual.js` 589, `maps/plant.js` 585 — as
HANDOFF says, the next line in any of them is a split first. TODO/FIXME:
0. `Math.random`: 1 real use, `systems/audio.js:97`, the noise buffer.
`setTimeout`: 1 real use, `tests/performance.js:82`, in a check. Both as
documented, and since F13 `no-source-file-calls-math-random-or-sets-a-timer`
holds that census in the gate (143 modules read, one of each, each argued
at its own line).

**The live site** (H2, H3). `npm run suite -- --runs 1 --regression --url
https://papasauce11.github.io/blackline/`: plant **29 passed, 0 failed**
(99,376ms), yard **29 passed, 0 failed** (65,978ms), 0 console errors,
exit 0 — the deploy agrees with this checkout's rules on both maps. Pages
`builds/latest`: status `built`, commit `c5856f8` = HEAD, 20.9s, finished
2026-09-27T09:28:50Z, error null. Live `version.json` reads `8411f9d`
against HEAD `c5856f8`: **one behind**, which is what D52 says a `Record`
stamp does (the committed `version.json` at HEAD is `8411f9d` too, so the
live copy is exactly what is committed; nothing skipped `npm run stamp`).

**Fresh seeds.** `--subset "fuzz|soak" --query "seed=20260927"`: 2 checks
per map (`shade-invariants-under-fuzz`, `traversal-fuzz-ten-thousand-steps-
never-sticks`), **4 passed, 0 failed**, 0 console errors — and this time
the seed reached them: F12's `the-url-seed-reaches-every-exploratory-check`
reports 16 exploratory sites all moved and distinct under every URL seed
tried, so this is the first fresh-seed green on record that means anything.
Widened, as last week, to `fuzz|soak|stall|stuck|leaks-nothing|random-real-
input|never-climbs|difficulty|seed` with the same seed: 12 checks per map,
plant **12 passed**, yard **11 passed, 1 failed**, exit 1. The red:
`each-difficulty-is-quicker-to-see-you-and-quicker-to-kill-you` on the
**yard**, detail: *"easy at 16m: seed 0: not dead after 30s of ENGAGE (2 of
120 shots hit, state engage)"* — lit, still, from site C, meter 63/80 at
8/16m; the same check under the same URL seed passed on the plant (easy at
16m 5.71s, 37/222), and the yard's other rows read 8m easy 2.52s 28/102,
medium 0.50s, hard 0.49s; 16m medium 2.79s 36/113, hard 0.82s 40/44. One
run, so not established as deterministic for the seed; not fixed. **Queued
as F17** in QUEUE.md with the seed in its done-when. Under the builder's
pinned seeds this check is green on both maps (the gate above).

**Broken base.** No. No `BROKEN BASE` heading in HANDOFF.md; the last two
build commits (`c5856f8` H4 verified on the deploy, `8411f9d` two traps H4
paid for) are neither WIP nor stop notes; 0 `[~]`.

**Environment.** The `npm run suite` from the 2026-09-18 17:00 build is
still alive at **9 days**: node 9608 and 4792 (started 17:40:19–20) and
Chrome 8920. Every one of this audit's four runs printed `OTHER RUNNERS
ALIVE: pid 4792`, so every timing above — and every timing in HANDOFF.md
since 09-18 — was measured against it. The routine cannot end it (the
permission classifier refused last week); it is one Task Manager action
or `taskkill /PID 4792 /T /F` and the same for 9608.

**Recommendation.** End the three 09-18 orphans (above): every run-time
on record for the second arc will be measured beside them until someone
does, and H11's bench will be too. Then, since the game is live with a
footer and a loading screen as of today, open
https://papasauce11.github.io/blackline/ once on the real GPU: D53's
wording is the first thing a friend reads, and whether the wait is the
bake or the first draw is the question H4 left for eyes.

---

## F17 — a fresh seed turned the yard's difficulty check red, and the cone was the reason (2026-09-27 17:00, scheduled run)

**Reproduced first, exactly.** The 2026-09-27 audit's red was
`each-difficulty-is-quicker-to-see-you-and-quicker-to-kill-you` on the **yard**
under `--query "seed=20260927"`: *"easy at 16m: seed 0: not dead after 30s of
ENGAGE (2 of 120 shots hit, state engage)"*. Seed 0 there is
`exploreSeed('difficulty-preset-0', 0xd1f1)` under that URL seed, which is
**1637054825**; a probe drove that one engagement and read every round it
fired. It reproduces to the round: 13.63s to engage, then **23 bursts, 119
rounds, 2 hits, alive at 30s**.

**What the shots said.** Of the 119 rounds, measured as the offset where each
ray passes the Shade's range: 30 were off across the lane only, 24 off
vertically only, 65 off in both, and **not one** came within 0.35m across and
0.4m up of the torso. Seven struck the ground at **11.5–14.9m**, short of a
16m target — which is exactly where a 5-degree-low round from an eye at 1.6m
aiming at a torso at 1.17m meets the floor (14.0m). So nothing on the yard ate
the rounds and no geometry is involved: the misses are the aim cone and only
the aim cone.

**The mechanism, and why the mean hid it.** The Shade's box subtends
**±1.22 degrees** across and spans −4.18 to +2.25 degrees vertically at 16m.
Against easy's ±5 degree draw that is 0.243 × 0.644 = **0.157** of draws on
the body, and the measured hit fraction was 0.148–0.151 — the model is the
game. The draw is held for the burst's 3–7 rounds, so **a burst is one trial,
not seven**, bursts come about 1.1s apart, and the time-to-kill is geometric:
mean 6.3s, and `(1 − 0.15)^26 = 1.6%` of engagements past 30s. The check runs
eight engagements per preset per range per map, so **about one fresh-seed run
in four** should have drawn one. It is not the limit being short; it is a
preset whose worth was published as a mean over a distribution with a tail
that crosses it.

**Two fixes were measured, and the one that looked better lost.** Over 40
seeds on the yard, easy at 16m:

| | hit fraction | mean | p90 | worst |
|---|---|---|---|---|
| 5.0 degrees, one draw per burst (as built) | 0.151 | 6.29s | 15.3s | **26.05s** |
| 4.0 degrees | 0.232 | 3.51s | 9.6s | 13.8s |
| 3.5 degrees | 0.292 | 2.80s | 5.6s | 11.9s |
| 5.0 degrees, **one draw per round** | 0.157 | 5.99s | 10.7s | 16.2s |

Drawing the hold **per round instead of per burst** was the better-looking
answer and was built: it is C5's own argument one wavelength down (C5 moved
the draw from per-engagement to per-burst because "one draw decided a fight"),
and it removes the tail at *unchanged* accuracy — the hit fraction and the
mean do not move, only the variance. Measured on both maps, the scatter inside
a burst went from 0.675 / 0.614 of the overall scatter to 0.896 / 0.926.

**It was reverted, because the check caught what it cost.** With the hold drawn
per round, medium and hard both went to **32 of 32 hits at 8m and 0.39s each**
— a dead heat, and `each-difficulty-...` went red on the yard: *"at 8m hard
kills in 0.39s, not sooner than medium's 0.39s"*. The reason is the same
geometry read the other way: at 8m the body subtends ±2.43 degrees, which is
wider than medium's 2.5-degree cone and hard's 1.2, so once a bad round is no
longer followed by five more bad ones **both presets saturate at the gun's
rate of fire** and no aim model can separate them. D33 had already written
that hard is "a machine at 8m ... and medium is close behind it there"; per-
round drawing spends the last of that margin. Separating medium and hard up
close is **K6**, and this is an S job, so the change came out.

**What shipped is one number.** `ai.difficulty.easy.aimErrorDegrees` **5.0 →
4.0** (D54), with the measurement written into `config.js` beside it. It is
the only preset whose cone is wider than the body at the range the check
measures, so it is the only one with a tail, and 4.0 does not touch medium or
hard at all. 3.5 was rejected on the same grounds as per-round drawing: it
takes easy's kill at 8m to 0.71s against medium's 0.51s, and two presets a
metre apart on the clock are not two presets.

**The check.** `the-widest-cone-kills-at-range-and-not-once-in-a-while`
(`tests/difficulty.js`) drives the widest preset at the longer range through
**twelve pinned engagements** and asserts that not one of them is a stall. It
never averages — the sibling check averages eight seeds and compares the
presets, and averaging is precisely what hid this. Two of the twelve are the
regression itself, one per map, each a 30s engagement at 5.0 degrees and a
kill at 4.0: **1637054825** is the yard's, the audit's own; **4196849476** is
the plant's, found by walking 82 seeds through the same engagement at the old
cone — 3 of 119 at 5.0, dead in 12.40s at 4.0. Without the second one a revert
would be red on the yard only, and the plant would wave it through.

**A trap the seed census set.** The yard's seed was first added to
`PINNED_SEEDS` in `tests/seeds.js`, which is where a seed that must not move
is written down. That would have been red on the one run this job exists to
pass: clause (b) of `the-url-seed-reaches-every-exploratory-check` compares
**values**, and 1637054825 is by construction the value
`exploreSeed('difficulty-preset-0', 0xd1f1)` hands back under `?seed=20260927`
— so the census would have called a pinned seed wrongly explored. A pinned
seed that a URL seed can also produce is outside what that clause can police;
the entry came back out and the argument is written beside `PINNED_SEEDS` and
beside `STALL_SEEDS`.

**Verified.** Gate at `db50935`, before any change: plant 184 passed / 1
failed / 8 not for this map, yard 165 / 1 / 27, red [], flaky [], exit 0.
After, `--runs 2 --subset "difficulty|widest-cone|url-seed"`, both maps, twice
each, **unseeded and under `--query "seed=20260927"`**: 4 passed, 0 failed
every run, red [], flaky [], 0 console errors, exit 0 both times — which is
F17's done-when, with `KILL_LIMIT` and `DETECT_LIMIT` untouched at 30 and 40.
Full suite, two runs a map: plant **185 passed, 1 failed, 8 not for this map** (979,051ms and 980,627ms, 468s and 473s of it the pipeline tail), yard **166 / 1 / 27** (663,687ms and 665,012ms, 348s and 349s); red [], flaky [], expectedRed [], unexpectedGreen [], skipsWithheld [], consoleErrors 0, contextLosses 0, exit 0. One more check a map than the gate that opened the run, and the one failure on each is the frame-budget check, skipped headless as always. Run spreads 1,576ms on the plant and 1,325ms on the yard, both 0% of the longest (F16).

The presets as they now read (`--details`, one run, 8 seeds each):

| | 8m detect | 8m kill | 16m detect | 16m kill |
|---|---|---|---|---|
| easy, plant | 7.35s | 0.82s | 13.64s | **3.88s** (was 7.2) |
| medium, plant | 4.97s | 0.51s | 9.27s | 1.40s |
| hard, plant | 3.60s | 0.35s | 6.74s | 0.93s |
| easy, yard | 7.35s | 0.75s | 13.63s | **4.43s** |
| medium, yard | 4.97s | 0.43s | 9.27s | 1.25s |
| hard, yard | 3.60s | 0.41s | 6.73s | 0.82s |

The new check reads: plant worst **12.40s** of 30s, median 3.88s, 54 of 281
rounds landed; yard worst **9.72s**, median 5.43s, 54 of 307.

**Left.** Two things this turned up and did not fix, both queued. **F18**: an
earlier version of the new check asserted a floor under the hit fraction and
was red at 0.181 against a line set at 0.19 from a 40-seed reading of 0.232 —
the fraction over twelve engagements carries about five points of noise
because the rounds are clustered by burst, so it is reported now and not
asserted; a check that wants to hold a rate needs to count bursts, not rounds.
**K6 should read this entry first**, and in particular: medium and hard are
0.02s apart at 8m on the yard (0.43 against 0.41) and 0.16s on the plant, both
of them within a frame or two of the gun's floor of four rounds at 600rpm. The
check passes there on pinned seeds and is one small change away from not, and
no aim model fixes it — separating them up close has to come from something
other than accuracy.

---

## F18 — a rate held by a check that counts bursts, not rounds (2026-09-27 17:00, scheduled run)

**The hole F17 left.** F17's check asserts that none of twelve pinned
engagements is a stall. That catches a widened cone only where a pinned seed
happens to draw badly, so it needed a second clause measuring the cone's worth
directly. F17 wrote one — a floor under the **hit fraction**, rounds on the
body over rounds fired — set at 0.19 from a 40-seed reading of 0.232. It was
red on the day it was written, at **0.181**, and the reason is the whole of
this job: **the rounds of a burst share one aim draw, so a round is not an
independent trial.** Twelve engagements are ~300 rounds but only ~65 bursts,
and a fraction over 65 trials carries about five points of noise — most of the
distance between the old cone (0.148) and the new one (0.232). The statistic
was not wrong, it was being counted in the wrong unit.

**Count bursts.** The trial is the burst, and the question a burst answers is
*did it put a round on the body*. Two things had to change to make that
measurable:

- **Sample size.** At 60 engagements the bands still overlapped: plant 0.399
  ±0.025 at 5.0 against 0.573 ±0.031 at 4.0, yard 0.402 ±0.024 against 0.527
  ±0.029 — a gap of 0.12 against a combined three-sigma width of 0.16. No line
  exists there.
- **Bias.** Worse than the noise: an engagement **ends at its first landing
  burst**, so the sampler stops exactly when the cone succeeds and the
  fraction it reports depends on how long the check let it run. That is not a
  measurement of the cone at all.

Both go away with **god mode**. The Shade cannot die, so a window runs its full
30s, every burst in it is an independent draw, and the sample is bursts rather
than engagements. Forty windows is **~1,070 bursts and a standard error of
0.015**:

| | cone 5.0 (F17's) | cone 4.0 (D54) |
|---|---|---|
| plant | 0.400, 3se band 0.355–0.445 | 0.541, band 0.495–0.586 |
| yard | 0.432, band 0.387–0.477 | 0.579, band 0.534–0.624 |

The bands leave **[0.477, 0.495]** for a threshold and `MIN_BURST_LANDING_RATE`
is **0.486**, the middle of it — 3.6 standard errors above the worst old
reading and 3.6 below the worst new one, on both maps. The fill is skipped
(`accumulator = engageThreshold`, as the burst check already does) because it
is the sibling check's subject and costs 14s of simulation a window. **It is
not free even so**: `--details` puts the whole check at 16.6-17.0s on the plant
and 10.2-10.6s on the yard against 1.55s and 1.05s for the stall half alone, so
the rate half is ~15s and ~9s — 1.5% of a plant run. Estimated at 2.6s from the
difference between two run totals before it was measured properly, which is the
smaller version of the mistake this whole job is about.

**And the half a check that picks its own inputs owes the suite.** A window
asserts it ended in ENGAGE and that the Shade came out unhurt. Without those,
a god mode that stopped working or an AI that wandered off would both read as
a cone that had got worse — the check would go red for the right number and
the wrong reason, which is the failure mode HANDOFF's "lesson that keeps
repeating" is about.

**Proved by breaking it.** `easy.aimErrorDegrees` was put back to 5.0 and the
subset run: red on **both** maps, and on the rate clause independently of the
stall clause — plant *"428 of 1069 bursts put a round on the body — 0.400,
under 0.486 (5.7 standard errors)"*, yard *"472 of 1092 — 0.432 (3.6 standard
errors)"*. The cone was restored and the tree checked before anything else.
That is F18's done-when, clause for clause.

**Verified.** `--runs 2 --subset "difficulty|widest-cone|url-seed"`, both maps,
twice each: 4 passed, 0 failed every run, exit 0, red [], flaky [], 0 console
errors. Full suite, two runs a map: plant **185 passed, 1 failed, 8 not for this map**
(993,949ms and 996,396ms), yard **166 / 1 / 27** (676,491ms and 672,546ms); red
[], flaky [], expectedRed [], unexpectedGreen [], skipsWithheld [],
consoleErrors 0, contextLosses 0, exit 0. The check's own detail line is
**identical in both runs of each map** — plant 578 of 1069 bursts, 0.541, 3.6 se
clear; yard 632 of 1092, 0.579, 6.2 se clear — which is what a pinned-seed
measurement should look like.

**Left.** The check now reads two things about the same preset in two ways —
twelve real engagements for the tail and forty artificial windows for the rate
— and the second is the one that will catch a regression. Nothing here touches
the presets themselves; **K6 still owns medium and hard at 8m**, where they are
0.02s apart on the yard and both at the gun's rate-of-fire floor, and F17's
entry says why no aim model fixes that.

## H5 — the main menu: a card per map, rendered from the map (2026-09-28 02:00, scheduled run)

**The job named the fork and asked for it to be priced first.** "A map is
built once per page load and another map is another page load, so *there is no
yard in memory while you are on the plant* — a thumbnail per map means either
baking every registered map at boot or drawing the card from something cheaper
than the map." Four probes answered it, and three of the four eyes they tried
came back unusable.

**What each bake slice costs, measured as the bake yields them** (`npm run
probe`, against the 09-18 orphan runner as everything here is):

| | plant | yard |
|---|---|---|
| geometry (the solids, the lights, the site tints, the decals) | 179ms | 52ms |
| collision | 1ms | 1ms |
| the climb rule, and B7's route lighting | 166ms | 21ms |
| rooms | 118ms | 60ms |
| the Warden's ground | 286ms | 77ms |
| checking the map | 4ms | 0ms |
| **whole** | **632ms** | **200ms** |

The last three derive facts and put **nothing in a scene**, and they are 408ms
of the plant's 632. So the bake has a cut in it: `DRAWN_SLICES` (3 of
`BAKE_SLICES`' 6) and `buildDrawnMap(id)`, which is what a card is rendered
from. Getting at a half-built map needed one small change to make it reachable
— every slice's yield carries the map now (`{ label, map }`, in both builders
and `mapfinish.js`) and `bakeMap` hands it out as `partial`. It is the same
object the bake finishes with, not a copy, and a clause of the new check says
so.

**The constant is pinned from both sides, not asserted.**
`the-drawn-slices-are-every-slice-that-puts-anything-in-the-scene` censuses
meshes, lights and triangles of a whole map, a map at `DRAWN_SLICES`, and one
at `DRAWN_SLICES - 1`, and requires the first two to be equal and the third to
differ. On the plant that is **266 meshes / 15 lights / 5,258 triangles at 3
slices and 265 / 15 / 5,078 at 2** — the one mesh is B7's merged route
lighting; the yard is 170 / 8 / 2,920 against 169 / 8 / 2,812. So if a later
slice ever starts adding geometry the cards do not quietly lose it, and if the
cut could be earlier the check says that too.

**Two eyes came back black before one worked, and for different reasons.** The
first framed the whole site from a corner and read **mean luma 1.4, peak 208,
3.7% of the frame anything at all**. The scene's `FogExp2` is 0.018 in the
clear colour: at the 110m that frames an 81m site, fog is 96% of the picture.
Fog is off in a card. The second was the same eye with fog off and read mean
luma 1.4 as well — that one is the maps, which are lit for a dark stealth
interior, and an unlit roof at 100m is luma 1 whatever the fog does. So a card
carries **its own key (12) and hemisphere (5)** on top of the map's rig; the
rig stays, because the yard's floodlights are what the yard looks like. With
both fixed the plant reads **18.6% lit, mean luma 11.1** and the yard **8.0%
lit, mean luma 6.6**.

**A third eye was built and dropped, and it is the one worth recording.** An
aerial of the plant is a grey slab, because the plant is a sealed shell — that
is the map. So the eye was moved to somewhere the map itself declares: the
Shade's own spawn, looking at the first site. Still a slab, because the spawn
is outside the shell. Then to the site itself, pulled back along the line to
the spawn — and 12m back from site A is **outside the wall, looking at the
wall**. There is no exterior eye that shows the plant's inside, and no generic
rule for "the roof" that would not also delete half the yard's containers. The
plant's card is a lit building in a fenced compound and the yard's is
unmistakably a container yard; that is enough to tell them apart, which is
what a card is for. D55 says what to ask for if the inside is wanted.

**None of it is on the boot a player waits on.** `createThumbnails` is built in
`boot.js` and **`start()` is called from `main.js` after `window.BLACKLINE =
harness`**, fire and forget; the menu draws its cards with an empty frame at
the right aspect and re-renders when they land, which is exactly the shape H3
gave the build stamp. A real task boundary (`yieldToPaint`, H4's posted
message — `await` on a settled promise is a microtask and would not yield at
all) goes between maps and never inside one, because the render borrows **the
one camera** and `renderFrame` re-parents it every frame. It is borrowed and
put back inside a single synchronous task, the way `tests/pixels.js` borrows
it; no second camera is made and no second WebGL context, which TRAPS.md
prices at 16 seconds here.

The whole thing is **5.0s headless, 4.0s of it the `readRenderTargetPixels`
waiting on SwiftShader** (plant 145ms build + 2.9s draw, yard 80ms + 1.0s).
The probe's own warm draw of the same scene was **4ms**, so that 4s is the
software rasteriser and not the work; how long a friend actually sees an empty
card is a question only H11's bench can answer.

**The menu itself.** Title, a card per registered map with `aria-current` on
the one this page is on, a role row, Play, Free Roam, Settings, How to play,
Credits, the map row D1 built, and H3's footer. Three files, because one would
have been past the guidance: `ui/menucss.js` (the stylesheet),
`ui/menupages.js` (pause, settings, how to play, credits, installed on
`Menu.prototype` as F3's mixins are) and `ui/menu.js` (the class, the main
page, the keyboard). How to play reads `objectiveLine` and `controlRows` out
of `ui/briefing.js` rather than retyping them, so the menu page and the
round-start card are one set of sentences and H8's rebinding will move both.

**The role row is the one thing here a player could call a rule, and it is
not one.** `shade` is the competitive match and `warden` is free roam, which
are the two things the game has; Play reads the row. The *Free Roam* button
stays exactly as it was and **deliberately does not move the row** — a check
clicks it, and a button that wrote `SETTINGS.role` would have left the role
behind for every check after it, which is the one thing a check may not leave
(F2). Whether a competitive Warden should exist at all is **D56**; it needs a
Shade AI, which is most of Block K again from the other end.

**The keyboard is not decoration.** `Tab` is in `SUPPRESSED_KEYS`, so the
browser's own focus traversal is switched off inside this game on purpose, and
before this there was no keyboard path into the menu at all. Every page
declares its focusable rows through `_rows()`; arrows walk and wrap, left and
right change a value or nudge a slider (so sensitivity and volume are
reachable without a mouse), **Enter** activates. Enter and not Space: Space is
the jump key, and a menu that swallowed it would still leave it held for the
first step after the menu closes.

**Five new checks**, `src/tests/menu.js`, registered after `registerVersion`:

- `the-main-menu-draws-a-rendered-thumbnail-for-every-map` **decodes what the
  card is showing** — `img.decode()` into a 2D canvas — and measures it: the
  right size, a `data:image/png` src and not a file, at least 4.5% of it lit
  geometry, a mean luma over 2, something brighter than 60 in it, a laid-out
  box, and **at least 5% of its pixels different from the next card's**, which
  is the clause that catches one picture wired to every card.
  **Its first version was wrong and is worth recording**: it measured "not the
  clear colour" and called a card that is 60% black margin *100% drawn*,
  because a render target clears to black and black differs from `0x0a0d10`
  in every channel. A metric that cannot fail is worse than no metric. It
  measures lit pixels now.
- `the-drawn-slices-are-every-slice-that-puts-anything-in-the-scene`, above.
- `the-main-menu-title-is-drawn-above-the-cards`: the word, the box, the
  computed opacity, that it is the **largest type on the card**, that its ink
  has luma over 60 against a near-black menu, and that the card strip starts
  below it. It says in its own header that this is layout and not pixels —
  the menu is a DOM overlay in front of the GL canvas and `gl.readPixels`
  cannot see it — which is the standard H3's footer check already set.
- `every-main-menu-row-is-reachable-and-actionable-from-the-keyboard` walks
  **all five pages**, counts the elements that have a click handler and
  requires the same number to be declared reachable (so a page cannot gain a
  control the keyboard cannot get to), drives the ring with real
  `KeyboardEvent`s at the window, checks it wraps both ways and is *drawn*,
  then sets the role row with the right key and presses Enter on Play as each
  role and reads which of the two started.
- `the-menu-remembers-the-map-and-role-it-last-played`: `bootMapId('')` comes
  from `SETTINGS.lastMap`, an explicit `?map=` still beats it, a remembered
  map the registry has dropped falls back, `requestedMapId` stays a pure
  question about the URL, the other map's card records the choice and asks for
  the page load, and the card for this page's own map asks for nothing and is
  marked `aria-current`. A map is a page load, so "remembered" is a default a
  later load picks up; it survives the browser once **H7** puts SETTINGS in a
  store, and the wiring is what is testable now.

**Verified.** Both maps twice, exit 0, 0 red, 0 flaky, 0
console errors, 0 context losses, 0 skips withheld. **Plant 190 passed / 1
failed / 8 not for this map (999,588ms and 997,377ms), yard 171 / 1 / 27
(672,654ms and 672,969ms)** - five more per map than the gate that opened the
run (185 and 166), which are these five. The pairs agree to **2,211ms on the
plant (0% of the longest) and 315ms on the yard**, and the one failure per map
is the frame-budget check, skipped headless. Per check: the thumbnail one
**7,445ms on its first run of a page and 59-68ms on the second** (the first
waits for the cards, the second finds them made), the drawn-slices one
**520-955ms** (it builds four maps on purpose), and the title, keyboard and
remembered-map ones **2-9ms**. The cards read **identically on both maps and
in all four runs** - plant 18.6% lit at mean luma 11.1, yard 8.0% at 6.6 -
which is the point of building every map's picture the same way rather than
taking the current one off the live scene.

**The verify caught a regression this job had introduced, and it is the most
useful thing in the entry.** "Remembered map" went into `requestedMapId` as
the no-query fallback, which is the obvious place and is wrong:
`every-registered-map-builds-and-the-page-is-on-the-one-its-url-asked-for`
asserts that an empty query gives the default, and **any check that clicks the
real Play writes `SETTINGS.lastMap`** (`panels.js`, `onPlay`). So the yard's
first run read "plant" for an empty query and its second read "yard", and the
report said `FLAKY` rather than red - the two runs of a map share a page, and
the leak only exists on the second. Which map a *URL* asks for and which map a
*browser* opens with are two questions: `requestedMapId` is pure and answers
the first, `bootMapId` answers the second and is what `main.js` boots from. A
clause of the new check now holds `requestedMapId` to being pure, so the same
mistake cannot be made again quietly.

**Found.** Two more things worth keeping. **A render target clears to black,
not to `scene.background`** — the margin of a thumbnail is `#000`, not the clear
colour, which is what made the first coverage metric meaningless. And the
`readRenderTargetPixels` behind a card is F11's wait in miniature: 4ms of work
billed as 4 seconds, because it blocks until SwiftShader has drained
everything queued behind it.

**Left.** D55 is all look, with one real question inside it — whether the
plant's card should show its inside, which needs the roof hidden and has no
generic rule. D56 is the rule-shaped one: there is no Shade AI, so "play the
Warden" can only mean free roam today.

## H6 — the first-run tutorial: eight moves, each cleared by doing it (2026-09-28 02:00, scheduled run)

**The whole design is in one sentence: a prompt clears on the act, not on the
key.** A chain that advanced when you pressed the bound key would teach
nothing and would lie — the key is bound, the move may not have happened. So
`systems/tutorial.js` watches the controller's own state after each fixed step
and never reads the input at all. `slide into the vent` is the case that
proves it: `KeyC` standing still is a crouch, a slide that stops at the mouth
never gets in, and neither is the move being taught.

**It watches and never drives.** The system has no intent, writes nothing on
the Shade, and its only output is which prompt is up. A tutorial is the most
tempting place in a codebase to write a second control path; this one cannot
make the game unplayable if it breaks, and `initMatch` is still the one entry
point (Section 12).

**What it runs in.** `TUTORIAL` in `matchstate.js`:
`{ mode: 'freeroam', role: 'shade', ai: false, objective: true }` — free roam
so there is nobody to be shot by and no clock, the **Shade** because every
move the chain teaches is the Shade's, and the objective **on** because the
last thing it teaches is the plant. A third configuration of the same call,
not a third code path.

**The chain, and what clears each one:**

| | prompt | cleared by |
|---|---|---|
| 1 | move | 4m walked on the ground |
| 2 | sprint | grounded at 95% of `sprintSpeed` |
| 3 | crouch | `shade.crouching`, grounded |
| 4 | slide into a duct | the body's centre inside a declared duct run, within 1.5s of a `SLIDE` step |
| 5 | jump | off the ground with upward velocity |
| 6 | climb | the feet end **0.4m above where the climb began** |
| 7 | tap to hang | `SHADE_STATE.HANG` |
| 8 | plant | `objective:planted` |

Two of those are worth the argument. **Six is not "a climb started"**: a climb
you fall out of has taught nothing and touching a ledge is not climbing it, so
the reading banks the rise only once the body is grounded again. **Four is two
conditions with a grace on one of them** — a duct run is several metres and a
slide is about a second, so the body is usually still sliding when it is
inside, but a slide that ends one step past the mouth taught the move all the
same and failing it would be a lie about what the player just did.

**Where it is offered is derived, not named.** `tutorialFits(map)` asks
whether the map has a duct at grade that a crouched body fits in and a
standing one does not — which is what step 4 needs. The plant has two
(`vent-grade-west`, `vent-grade-south`, floors at ground, 1.15m against a
1.05m crouch and a 1.85m stand, measured by probe before any of this was
written); **the yard has none, so the chain is not offered there** and Play
goes straight to the round. A third map gets the tutorial or not by its own
geometry, which is D1's rule.

**One line on screen, and no closing line.** `ui/tutorial.js` draws the step,
`3 of 8`, and a Skip button. The keys in the sentence are the live bindings
(`[W]`, bolded by the panel), so H8's rebinding will move them, as it will the
briefing card's. There is no "well done" held up for two seconds because there
is no timer to hold one up with — Section 9 and 15 ban `setTimeout` and F13's
check holds the ban. What follows the chain is the round briefing (C2), which
holds until a key, and that is the beat.

**The hazard this job had to solve, and it is the same one as H5's.**
`SETTINGS.tutorialSeen` starts false, so **the first check in the suite that
clicks the real Play would get the tutorial instead of a round** — and
`tests/settings.js` calls `resetSettings()` partway through every run, so it
would come back false again afterwards. The fix is not a test-only path: the
three checks that click Play (`briefing.js` ×2, `roundend.js`) now **state
their precondition** — `SETTINGS.tutorialSeen = true`, restored in their own
`finally` — which makes each of them say which branch it means instead of
inheriting whatever ran before it. They assert exactly what they asserted
before. The other branch is a check of its own.

**Two new checks**, `src/tests/tutorial.js`, registered after the menu's:

- `the-first-run-tutorial-clears-every-prompt-on-the-act` drives all eight
  through `input.heldCodes` / `input.pressedCodes` and the real fixed step,
  which is where `sim:step` reaches the watcher. It reuses the traversal
  checks' own machinery — `findGroundLedge`, `driveAtLedge` — and a
  `findVentRunUp` that derives a clear run-up outside a duct mouth from the
  map. What it does **not** drive is the walk between features: the body is
  placed at each ledge, lip and duct the way every traversal check places it,
  because the chain is about the moves and not about crossing the map. Reads,
  on the plant: sprint **6.3m/s of 6.5**, the duct entered at **6.5m/s** and
  slid, `stack-hall-low` climbed through `ground,vault`, `hall-container`
  hung. 80ms. Plant only, because that is where `tutorialFits` is true today.
- `the-tutorial-is-offered-once-and-can-be-skipped`: Play raises it on a
  browser that has not seen it and in the right match configuration, the
  prompt says `1 of 8` and names the movement key from the live bindings, the
  **Skip button a player would click** ends it into the round and marks the
  browser, and a second Play goes straight to the round. On a map
  `tutorialFits` refuses it asserts the opposite — not offered, and Play still
  starts the round — so the yard tests the other half rather than being
  skipped. 853ms on the plant, 16ms on the yard.

`resetPresentation()` (F2) now takes the prompt down too: it is presentation
like any other panel, and a check that left it up would hand it to every check
after it.

**Verified.** Both maps twice, exit 0, 0 red, 0 flaky, 0
console errors, 0 context losses, 0 skips withheld. **Plant 192 passed / 1
failed / 8 not for this map (991,824ms and 992,997ms), yard 172 / 1 / 28
(684,109ms and 677,969ms)** - two more per map than the gate that opened the
job (190 and 171), which are these two; the yard's "not for this map" went
from 27 to 28, which is the plant-only one being reported rather than passing
somewhere it cannot run. The pairs agree to **1,173ms on the plant (0% of the
longest) and 6,140ms on the yard (1%)**, and the one failure per map is the
frame-budget check, skipped headless. Per check: driving all eight prompts is
**27-29ms** and the offer-and-skip one **3-4ms** - the chain is simulation
with nothing rendered, so eight moves cost less than a single frame does
here.

**Found.** Two things, both about driving a check rather than about the game.
**A run-up that ends at a wall never reaches a sprint** — the first version
walked 3 seconds from the spawn and then asked for 95% of `sprintSpeed`, and
read 5.1m/s because the body was against the shell; each step now starts from
the spawn's clear apron. And **a detail line must not read the watcher after
the step it describes has cleared**: by then `tutorial.reading` is the *next*
step's, freshly zeroed, so the first version printed `rise 0.00` for a climb
that plainly happened. A wrong number in a detail line is worse than none —
D5 lost two runs to one.

**Left.** The "once per browser" half is a flag, not a store: `SETTINGS`
does not survive a reload until **H7**, which is the next job and is what
makes it true. Nothing about the chain changes when it does.

## H7 — settings that survive a reload (2026-09-28 02:00, scheduled run)

**Three jobs in a row had written "until H7".** H5 put the role row and the
last map chosen into `SETTINGS`; H6 put `tutorialSeen` there and had to say in
`PLAYTEST.md` that the tutorial comes back if you refresh. `settingsstore.js`
is what makes those three sentences true, and it is the smallest module in the
project that has to think about failure.

**Everything degrades, and that is the design rather than a safety net.**
`localStorage` **throws** rather than returning null in a browser with site
data blocked, in some private windows and inside a sandboxed frame — reading
the property itself throws in the last case, which is why even
`defaultStorage()` is wrapped. Every access returns a reason instead of
raising one, and the boot records it in `debugState.settingsStore` for H12's
report. A game that will not start because it could not remember a volume
slider is a worse game than one that forgets.

**Versioned, and a version it does not know is ignored rather than migrated.**
The version is in the key *and* in the record: the key catches a change this
code knows about, the field catches a record written by something that did
not. What is stored is a handful of preferences, so the cost of losing them on
a format change is one trip through the settings page, against the cost of a
migration path nobody exercises — a bug that only ever appears on somebody
else's machine.

**It stores a declared list, not "whatever is in `SETTINGS`".** A value is
applied only when the defaults have that key *and* the type matches, so a
record edited by hand cannot put a string where the game reads a number. The
one default that is `null` is `lastMap`, whose type is "a registry id or
nothing", and it is spelled out rather than inferred.

**One setting is deliberately not kept, and it is the point of the list.**
`NOT_PERSISTED` is `['debug']`. The gate belongs to a page load and the URL
owns it (`?debug=1`, C1); the suite turns it on for the length of a run.
Persisting it would mean one visit to the settings page turns a friend's
playtest build into a debug build for good, with the test keys live and
nothing on screen to say why. `persistedKeys()` is the defaults minus that
list, so **a setting added later is kept by existing** and the only way to
leave one out is to write it down — F15's shape, applied to settings.

**Saved on a decision, never on a timer.** There is no timer to save on
(Section 9 and 15 ban `setTimeout`, F13 holds the ban), and there should not
be one anyway. Every settings row and the role row end at `Menu._changed()`,
which is one call site rather than a dozen — which is what makes "a row added
later cannot forget to persist" true rather than hopeful. The map card and the
map row save *before* they navigate, because `onMap` is a page load and
nothing after it runs. The tutorial saves inside its own `_end`.

**The reset row clears the record** rather than writing the defaults into it,
so a build that later changes a default gives it to whoever asked to be reset.
It also puts the debug gate back to whatever this page load had, so resetting
the stored settings does not close the tooling under a session that opened it
with `?debug=1`.

**Three new checks**, `src/tests/settingsstore.js`, registered before the
version ones:

- `a-setting-changed-now-is-the-setting-a-reload-reads` is the done-when. A
  page cannot reload itself inside a check, so what is driven is what a reload
  actually does: set every persisted key to something that is *not* its
  default, save, `resetSettings()` to throw the live values away, load again,
  and require every one back. Then: an empty store leaves the shipped
  defaults; a record stamped one version ahead applies **nothing** rather than
  half of it; a hand-edited record with `masterVolume: 'loud'`,
  `difficulty: 7`, `invertY: 'yes'` and an invented key applies **only** the
  one good value and reports the rest; and reset leaves no readable record.
  Every store it touches is a scratch `Storage`-shaped object it owns — the
  page's own record belongs to whoever is playing.
- `a-blocked-store-degrades-to-defaults-and-never-throws` drives a store that
  throws on `getItem`, `setItem` and `removeItem` through all four entry
  points, because the one that throws is the one nobody wrapped. Then with no
  store at all. Then it reads what the **real boot** recorded, so the check
  sees that the live page went through this and not only that the functions
  work — H4's debt, paid the same way.
- `the-persisted-settings-are-a-census-and-name-what-they-leave-out` holds
  `persistedKeys()` + `NOT_PERSISTED` to exactly the defaults, both ways;
  requires the debug gate to be in the second list; requires `role`, `lastMap`
  and `tutorialSeen` to be in the first, since they are why this job exists;
  and checks the reset row is on the settings page, does something, is drawn,
  and is reachable from the keyboard like every other row (H5).

**Verified.** `npm run suite`, both maps twice, 2026-09-28: plant **195
passed, 1 failed, 8 not for this map** (1,078s and 1,019s), yard **175 / 1 /
28** (690s, 685s), exit 0, 0 red, 0 flaky, 0 console errors, 0 context losses,
0 skips withheld. Three more checks per map than the gate H6 left (plant 192,
yard 172) — this job's three, and all three are simulation with nothing
rendered, so they cost single-digit milliseconds. The one failure on each map
is the frame-budget check, skipped headless as always.

The run *times* are 9% and 1% above H6's pair and none of that is this job:
the runner reported `throttle: 4/8 cores (9 processes pinned)` and the 09-18
orphan runner is still alive, so the machine had less of itself to give than
it did on 09-27. Worth one line for whoever reads the numbers next: the
plant's two runs spread **59,792ms (6% of the longer)**, of which 36,980ms is
the pipeline wait, against the 1,173ms F16 recorded — the yard's is 5,652ms
(1%). The *answers* agree exactly (0 flaky); what moved is how long the same
work took, which is what F16 says to expect from a contended machine and why
it prints the spread rather than burying it.

**Found.** One thing, and it is now a trap in `TRAPS.md`: **a setting outlives
the page now.** A check that clicks a settings row has made a player's
decision and written it, so it has to put the setting back *and* save, or the
next page load in that browser context starts somewhere nobody chose. Today
the blast radius is one page — Playwright's `browser.newPage()` is a new
*context*, not a tab, so each map gets its own storage, and the two runs that
share a page never reload and so never read it back. A check that ever reloads
a page widens it to everything after it.

**Left.** Nothing this job set out to do. D57 is the one judgement worth a
look: difficulty is the setting most likely to have been changed for one
evening rather than for good, and it follows you around now.

## H8 — rebinding, and the key that bound itself (2026-09-28 17:00, scheduled run)

**What was built.** A **Controls** page, reached from the settings menu and
returning to it, with a row for every one of the seventeen actions
`DEFAULT_BINDINGS` declares. The row shows every key bound to the action;
activating it — Enter from the keyboard, a click from the mouse — puts it in
*press a key*, and the next key becomes that action's **first** binding. A
second cell on each row restores that one row's shipped keys.

Three rules the page had to pick, all in **D58**:

- **A rebind replaces the first key and leaves the alternate.** Six actions
  ship with two (`forward: W / Up`); binding forward to T reads `T / Up`.
  The tidier alternative — the pressed key becomes the only key — quietly
  takes something away and nothing on the page would say so. The alternate
  you *did* replace comes back from the row's own reset, which is why every
  row has one rather than the page having a single reset-all.
- **Escape leaves a capture, and is therefore the one code nothing can be
  bound to.** A page you can walk into and not out of is worse than a pause
  key nobody rebinds. A mouse button is bound by pressing it *on the cell
  that is waiting*, so `fire` can be put back on Mouse0 by hand, and a press
  anywhere else is that row's click and cancels this one — there is no way
  to bind a button by accident.
- **A key bound to two actions is shown, never refused.** `codeToActions`
  has always been a list and the game fires both; a player who wants melee
  and crouch on one key is entitled to them, and there is no rule here to
  protect. Both rows name the other action. The rule itself is
  `bindingConflicts(bindings)` in `input.js` — pure, taking the map rather
  than reading `this` — and the page is handed it by the composition root
  like every other live reading, because `ui/` does not import `input.js`
  (Section 3.1). That also lets a check assert the conflict without a DOM.

`Input` gained `resetBinding(action)` and `swallowPress()`; `panels.js` wires
`conflicts`, `onRebind` and `onResetBinding` beside H5's `bindings`. Nothing
that reads a binding needed touching: the briefing card C2 puts up and H5's
*How to play* page both go through `controlRows()` on the live map, so a
rebind moves both, which is the half of this job that was already done.

**What was found, and it is the job.** The first run of the check reported
*no ground ledge between 1.2m and 2.4m to climb* — on the plant, where there
are dozens. **Binding a key also fired it.** The keydown that binds J is
delivered to the `Input` as well as to the menu; both listen on `window`,
whichever was added first runs first, and an event dispatched straight at
`window` runs both whatever phase they asked for — so `preventDefault` and
`stopPropagation` cannot keep `KeyJ` out of `pressedCodes`. Jump was `KeyJ`
by then, so `findGroundLedge` stepped three frames per candidate with the
body airborne for every one of them and rejected all 214 boxes.

The first fix was a `clearAll()` inside `onRebind`, and it only worked half
the time — the menu's listener turned out to run *first* here, so the Input
recorded the key immediately after the clear. What works whichever way round
they run is a gate: `swallowPress()` clears and then ignores everything until
the key comes back up. The rule it spells is the one that matters and is now
asserted: **binding a key must not also fire it.**

This is the HANDOFF lesson again from the other side. The usual failure is a
check that drives the game differently from a player; this was a check that
drove it *exactly* as a player does — a real `KeyboardEvent` at the window —
and so found a bug that a `rebind('jump', 'KeyJ')` call could never have
found.

**And a gap in H7, found while rewriting the same `_rows()` call.** The two
sliders on the settings page applied their value on the left and right keys
and never called `_changed()`, so a keyboard-only player's **sensitivity and
volume were the two settings a reload forgot** — H7's own promise, missed by
the one row type that has a second code path. Both call it now, and rather
than two more lines of assertion the fix got a census, because the same
omission is available to every row added after this one:
`every-settings-row-that-moves-a-setting-reports-it-for-saving` drives each
row of the settings page from the keyboard, sees whether any key of
`CONFIG.settings.defaults` moved, and requires the save handler to have been
called when one did — with the unpersisted debug gate excused by name and a
slider already at its maximum nudged the other way rather than passed
silently. It stubs the handlers rather than letting them run, because the
real ones write the player's own record (TRAPS.md).

**Checks.** Two new in `tests/bindings.js`, one new in `tests/settingsstore.js`,
one extended in `tests/menu.js`:

- `a-rebound-key-is-the-key-that-climbs-and-the-card-says-so` walks Settings →
  Controls, puts the ring on the jump row, presses Enter and then J — real
  `KeyboardEvent`s at the window, never `rebind()` — and then asserts the
  three things that can each be true without the others: the row reads `J`,
  the *How to play* card reads `J` (and so the briefing does, same
  `controlRows`), and **J climbs a ledge while Space no longer does**. That
  last pair is the one that would fail if the job were reverted in the way
  that matters. `driveAtLedge` in `tests/movement.js` took a `code` option to
  make it possible — line-for-line, because that file sits at 599 of the 600
  the split guard allows.
- `a-key-bound-twice-is-shown-on-both-rows-and-a-row-restores-its-own-default`
  binds melee onto Space, requires both rows to name the other, requires the
  conflict to be **real** — one `pressedCodes.add('Space')` and the Input
  answers `pressed('jump')` and `pressed('melee')` both — then resets the one
  row and requires melee back, jump untouched, and both notes gone. It also
  counts a row and a reset for every action in `DEFAULT_BINDINGS`, so "every
  action" is a claim the page keeps rather than one this file makes.
- `every-main-menu-row-is-reachable-and-actionable-from-the-keyboard` walks
  the controls page too, which is thirty-five rows: seventeen key cells,
  seventeen resets and Back.

Both new checks restore the bindings in a `finally`. Bindings are game state,
not presentation, so the runner will not put them back (F2) — a check that
left jump on J would hand it to every check after it.

**One look fix, free.** `#bl-menu .row.focused .value::after` has never
matched anything: `_rows()` is handed the `.value` span, not the `.row`
around it, so the focus ring was invisible on every settings row and has been
since H5. `.value.focused::after` draws it now. Provisional, under D58's
heading in spirit; noticed only because the controls page has thirty-five of
them.

**Verified.** `npm run suite`, both maps twice, 2026-09-28: plant **198
passed, 1 failed, 8 not for this map** (1,002s and 1,010s), yard **178 / 1 /
28** (678s, 679s), exit 0, 0 red, 0 flaky, 0 console errors, 0 context
losses, 0 skips withheld. Three more per map than the pair that gated this
job (plant 195, yard 175) — this job's two plus H7's census — and the one
failure on each map is still the frame-budget check, skipped headless.

The pair agreement came back: **plant 7,637ms (1% of the longer) and yard
1,470ms (0%)**, against 59,792ms and 6% in the H7 verify three hours
earlier, with the same orphan alive and the same `throttle: 4/8 cores` in
both. So the H7 spread was the machine having a worse hour and not something
this project did, which is the reading F16 asks for: compare the spread, not
the total. The run took about three wall-clock hours against the H7
verify's one, for the same reason — the 09-18 orphan Chrome has now burned
**8,234 CPU-seconds** and is still burning them.

**Left.** A rebind does not survive a reload — **H19**, and a job rather
than a line because a keymap is not a scalar: it wants its own versioned
record and a rule for a stored map naming an action this build no longer has.
And the page is one flat list of thirty-five rows, which is **H20**, look
only.

## H9 — the camera is the player's, and a stride you can switch off (2026-09-29 02:00, scheduled run)

**What was built.** The four look-and-camera settings H9 named, and one of
them did not exist yet.

**Sensitivity per axis.** `lookDelta()` read one `mouseSensitivity` for both
axes; it reads `mouseSensitivity` for the turn and `mouseSensitivityY` for the
pitch. The old key keeps its name deliberately — it is in a player's stored
record already and H7's store has no migration, so renaming it would throw
away the one setting that has existed since Section 13. Both default to 0.0022,
so nothing about the feel changes until somebody moves one, and the ADS
multiplier scales both: it is there to keep a narrowed FOV tracking 1:1, and
that is as true vertically as horizontally.

**A field of view per role, and one place that decides it.** Two settings,
because the Shade looks through a boom 2.2m behind its body and the Warden
through an eye in its head; both default to `CONFIG.render.fov`, which is the
FOV every timing, pixel and feel reading on record was taken at. The
interesting half is not the setting but where it is applied. `main.js` used to
call `cameraOwner.applyAdsFov()` only when the Warden had the camera, and
`set()` reset every handover to `CONFIG.render.fov`; combat's finisher and the
death camera each reset the same constant on their way out, because their
contract is to leave nothing behind. Four places, one constant, and a Shade on
95 degrees would have come out of a finisher on 70 and stayed there until its
next handover — which, since `set()` returns early when the owner has not
changed, is *never*. So the FOV became one decision asserted every frame:
`applyFov(owner)`, which is the player's setting for the role with Section
6.2's ADS blend inside it for the Warden, and `set()` resets to the next
owner's **resting** field so an aim still cannot come across with the camera.
Nothing about combat's or the death camera's contract changed; the frame after
them puts the player's own back.

**And the aim narrows absolutely.** `desiredFov()` was
`render.fov → adsFov`; it is `SETTINGS.fovWarden → adsFov`. A player on 90
degrees therefore gets a bigger zoom than a player on 60 and both get the same
52-degree sight picture, which is how every shooter does it. The alternative —
narrowing by the same *fraction* — would hand a wide-FOV player a permanently
wider aim, and that is precisely the competitive edge D59 is already being
careful about with the 60–100 range.

**Head-bob, which had to be built before it could be switched off.** There was
no camera bob: the two bodies bob (`POSE.gait.bob` lifts the torso group) and
the two camera rigs sat at a fixed height over the feet. `headBobLift()` in
`entities/pose.js` is the rule, one copy for both bodies for the same reason
`easePose` is — two copies is how the Shade's camera and the Warden's come to
disagree. It rides the **gait phase the legs already swing on**, which is
advanced by ground covered rather than by a clock, so the camera rises as a
foot plants and a body that stops stops mid-stride. It is **upward only**,
`abs(sin)` exactly as the body's own bob: down on this camera means a landing
or a mantle taking its weight (B8), and a stride borrowing that vocabulary
would have made both harder to read. 1.8cm on the Shade's boom, 3.5cm on the
Warden's eye — nearly double, because an eye in a head swings only itself
where a boom two metres back swings the whole picture.

**What was judged, and it is all look (D59).** The FOV range 60–100 is the one
of the three a player could gain something from, so it is flagged rather than
buried: narrow `fovMin`/`fovMax` and both sliders narrow with it. The absolute
ADS narrowing, above. And **head-bob ships off** — it is the option players
most often turn off, and off is also the camera every reading on record was
taken against: on by default would have meant teaching
`the-camera-dips-on-a-climb-and-comes-back` the difference between a stride and
a dip in the same job that invented the stride, and that is a check worth not
touching. `PLAYTEST.md` asks Josh to turn it on.

**What was found.** Two things, and the second one is mine.

**H7's census caught the four new settings before the suite ran.**
`changedValues()` in `tests/settingsstore.js` builds a non-default value for
every persisted key and **returns the name of any key it has none for** rather
than skipping it, so `mouseSensitivityY`, `fovShade`, `fovWarden` and `headBob`
each had to be given a round-trip value. That is a census written in F15's
shape working exactly as intended on the first job to test it: a setting cannot
join the store without joining the check that proves the store keeps it. The
two sensitivities move by different amounts and the two FOVs to different
degrees, because a round trip that wrote the same value into both halves of a
pair would pass with the pair swapped.

**And the gate was measured against a tree that no longer existed.** The run
started `npm run suite -- --runs 1` in the background, by the book, and then
wrote this job's code while it ran — reasoning that the page had already
loaded, which was true and beside the point.
`the-registry-holds-every-check-its-modules-declare` does not read the page's
modules; it `fetch`es `src/tests/index.js` and every module's text **from the
origin at the moment it runs** and compares what they declare against what the
loaded page registered. A new module registered in an index the page loaded
before the edit is a check declared and not held — the exact hole F14 exists to
report — and `tests/donedef.js` reads source text the same way. So the gate's
verdict was about neither tree and the forty minutes it was still running for
proved nothing either way. Written up in `TRAPS.md`: **do ORIENT and GATE on a
clean tree and write nothing until the gate is back.** What actually stood as
this job's gate is what step 8 of the protocol already says stands — H8's
VERIFY, two runs green on the commit this one started from.

**Checks.** Three new, in `tests/camerasettings.js`, and one extended in
`tests/settingsstore.js`. Every one of the three ends at the one camera,
because the whole Section 13 lesson is that a setting which moves a field and a
label is indistinguishable from one that works:

- `look-sensitivity-is-per-axis-and-invert-y-turns-only-the-pitch` puts a mouse
  delta on the locked input and drives a real frame, which is the only route
  `cameraOwner.look()` is reached by, then reads the camera's **own world
  direction**. With the turn at the slider's minimum and the pitch at its
  maximum the two come out 20:1 apart, and with them swapped, 20:1 the other
  way — so neither reading can be the other axis standing in for it. On the
  defaults the two are equal to the last bit. Invert Y reverses the pitch and
  leaves the turn *identical*, which is the half of "invert Y" that has never
  been asserted.
- `each-role-draws-with-the-field-of-view-its-setting-asks-for` reads
  `projectionMatrix.elements[5]`, which is `1 / tan(fovY / 2)` — the matrix the
  renderer draws with and not the field that asked for it, because a missing
  `updateProjectionMatrix()` is exactly the gap between them. The Shade at 95
  and the Warden at 62 in the same check; the FOV dirtied to 12 mid-run and put
  back by the next frame, which is the cinematic-restore path without staging a
  finisher; the aim held down for forty frames with the drawn FOV required to
  equal `90 + (52 - 90) * blend` at **every** blend, which is the assertion
  that says the narrowing starts from the player's 90 and not from the shipped
  70; and a handover to an aiming Warden required to land on 90 rather than 52.
  It also pins `defaults.fovShade` and `defaults.fovWarden` to
  `CONFIG.render.fov`, which is what lets `tests/warden.js`'s handover check go
  on reading that constant as the camera's resting field and be right.
- `head-bob-rides-the-stride-only-when-it-is-switched-on` is the one worth
  reading. It sprints each body down the same `clearLane` **twice**, once with
  the bob off and once on, from the same `initMatch` with the same keys, and
  takes the difference of the two camera-height traces frame by frame. The
  simulation is deterministic and the bob writes nothing it reads, so that
  difference is the bob with the ground under the feet, the landing dip and the
  boom's pullback all cancelled — and the same pair of runs proves the bob is
  presentation only, because the two body traces are required to agree to
  1e-9. Then: the peak is the body's amplitude scaled by the fastest speed the
  run saw; the minimum is never below zero; it is zero on every frame the body
  was off the ground, and zero on every frame it was barely moving.

The three are registered after `tests/bindings.js`, and `MIN_TEST_MODULES`'s
comment in `tests/registry.js` now says 58.

**Verified.** `npm run suite`, both maps twice, 2026-09-29: plant **201
passed, 1 failed, 8 not for this map** (1,075,014ms and 1,080,531ms), yard
**181 / 1 / 28** (752,439ms, 743,908ms), exit 0, 0 red, 0 flaky, 0 console
errors, 0 context losses, 0 skips withheld. Three more per map than the pair
that gated this — plant 198, yard 178 — which is this job's three and nothing
else. The one failure on each map is the frame-budget check, skipped headless.
The runs of a map agree to **5,517ms on the plant (1% of the longer) and
8,531ms on the yard (1%)**, so the pair is comparable (F16); read the totals
against nothing, because the gate that preceded them took nearly two hours of
wall clock for the same 1,719s of measured work, against four orphaned node
processes rather than two.

The three readings, identical on both maps and in both runs of each:

| check | reading |
|---|---|
| `look-sensitivity-is-per-axis-and-invert-y-turns-only-the-pitch` | `20.0:1 apart at the slider's ends, either way round; invert turns -0.0660 into 0.0660 and leaves the turn at -0.0660` |
| `each-role-draws-with-the-field-of-view-its-setting-asks-for` | `shade 95 drawn, and put back after a dirty 12; warden 90 narrows to 52 through all 40 blends; a handover takes the resting field, not the aimed one` |
| `head-bob-rides-the-stride-only-when-it-is-switched-on` | `shade peak +0.0180m at 6.50m/s (amplitude 0.018) ... warden peak +0.0350m at 5.00m/s (amplitude 0.035), never lower than +0.0002m, 0 airborne, body identical to 1e-9` |

The bob's peak is its configured amplitude to four decimal places at exactly
each body's sprint speed, which is what `amplitude * min(1, speed/sprint)`
promises and would not be true of a bob on a clock of its own. "Never lower
than +0.0002m" is the least the bob ever was over 150 frames, not how far it
went down: it is above zero because the sine passes through zero between two
sampled frames, and it is the one figure in the line that moves from run to
run — by a ten-thousandth of a metre, and `flaky` is empty, because what the
check asserts about it is a sign and not a value. Costs: 0.03–0.4s for the
look, 0.3–0.8s for the bob, **1.9–6.4s** for the FOV, which is forty rendered
frames under SwiftShader and the price of holding an aim down the way a player
does.

**And H10 was scoped rather than started.** The run had budget for a second job
and H10 is the next unblocked one, so it was designed far enough to size it -
which was far enough to find that it is not a five-knobs job. **Auto is the
hazard.** A two-second frame-time probe under SwiftShader, where a frame is
~400ms, picks **low** every time and deterministically; `qualityProbed` starts
false and the headless runner gives every map a fresh context, so the gate would
then run with the post off, the outlines off and the resolution at 0.7 - which is
not the picture the **13 pixel-reading test modules** were calibrated against
(post.js's own comment is the reason: "every pixel check reads through this when
it is on"). Not flaky, which is worse: consistently red, with a re-reading of all
thirteen as the apparent fix.

The way out keeps both halves of the done-when - the probe **runs and records its
pick**, and a `?quality=` **pin** decides what is actually applied, one line where
`scripts/suite.mjs` already composes `?seed=&map=` - and `medium` must be exactly
what the game draws today, which is the same discipline this job used to keep both
FOV defaults at `CONFIG.render.fov`. That, a preset table, and the line number of
each of the five knobs (the one shadow caster at `mapkit.js:417`, the two
`setPixelRatio` calls, `SETTINGS.post`, the two spark counts, and the only two
places an outline is built - `parts.js:115` and `mapkit.js:204`, so one
`userData.isOutline` at each is the whole rule) are now in H10's queue item.

Stopping was the judgement step 8 asks for rather than a shortfall: a failed
verify costs an hour, an M job whose risk is spread across every pixel check earns
one, and there was not an hour of margin left. A note that saves the next run the
discovery beats a half-built job that has to be understood before it can be
finished.

**What was left.** `PLAYTEST.md` asks Josh three things: whether 60–100 is too
generous a range for a game where one side is hiding, whether the bob should
ship on, and whether 1.8cm on a third-person boom reads as weight or as a
wobble — the last is the one I am least sure of, because a boom swings the
whole picture where an eye swings only itself. **H21** and **H22** are in the
queue. And the orphaned node processes are now **four**: the 09-18 pair this
file has named for a week, and a second pair, pids 12396 and 7812 from
**2026-09-26 23:32**, which nothing had noticed until this run listed the
processes. Every timing above was measured against all four. Still Josh's to
kill.

## H10 — quality presets, and a probe that records without deciding (2026-09-29 17:00, scheduled run)

**What was built.** Low / medium / high / auto over the five things that cost a
frame, a probe that picks one from what this machine measured, and a
`?quality=` pin that decides what is actually applied. `src/quality.js` is the
whole rule; `CONFIG.quality` is the table.

**The central risk was named before the job started and it was the right call.**
H9's run scoped H10 and stopped rather than half-build it, because auto's own
default path would have recalibrated the suite: `qualityProbed` starts false,
every headless page gets a fresh context, and a preset applied from a probe
would have run the gate at whatever a software renderer measures. The way out
it wrote down is what was built — **the probe runs and records, and
`activeQuality()` decides** — and that separation turned out to matter more
than predicted, because the prediction about *which* level was wrong (below).

**`medium` is the shipped picture, knob for knob.** A 1024 shadow map, the
device's own pixel ratio, full spark bursts, outlines on, post on. Every
reading on record was taken there — the 92-viewpoint sweep, the thirteen
pixel-reading test modules, every screenshot — so
`the-medium-preset-is-what-the-game-drew-before-there-were-presets` pins each
number to the constant it came from, exactly as H9 pinned `fovShade` to
`CONFIG.render.fov`. Low is 512 / x0.7 / a third of the sparks / no outlines /
no post; high is 2048 / x1.25 / full / on / on.

**The five knobs, and where each one lives.** The shadow map is the one
caster's `shadow.mapSize`, and three sizes its depth target once and never
looks again, so the old target is disposed and dropped for a new size to take.
The resolution is one rule — `pixelRatioNow()` — read by `createRenderer`, by
`resizeView` and by a level being applied, because three call sites computing
`min(dpr * scale, maxPixelRatio)` separately is how they come to disagree about
how big the buffer is. The particles are scaled inside `effects.sparks()`
rather than at its two call sites, so a third caller joins the rule by
existing, and never below one: a burst of nothing is a bullet that hit nothing.
The outlines are `userData.isOutline` at the two places an inverted hull is
made — `mapkit.js`'s outline group and `parts.js`'s hull, which every part of
both figures comes through — and a scene traverse, rather than a hunt for
`side: BackSide` materials.

**The post is an AND, not an assignment (D60).** It already had a settings row
of its own (E6), and the obvious shape — the preset writes `SETTINGS.post` when
a level is chosen — is worse in three directions: it writes a player's stored
record from a different row, the post row's label goes stale until something
re-renders it, and the two rows then disagree about which is in charge. Worse
than any of those, it would mean the settings-row census
(`every-settings-row-that-moves-a-setting-reports-it-for-saving`, which clicks
every row and restores `SETTINGS`) left the renderer wherever the row landed,
for every check after it. So `postEnabled()` is the row **and** the level: low
draws none whatever the row says, the row still remembers what the player
chose, and it reads `on, off at low quality` rather than saying `on` while
nothing glows. `applyQuality` then writes **no setting at all**.

**Which is what lets the level be asserted every frame rather than applied
once.** `syncQuality()` runs from `renderFrame` before the draw and reaches for
a knob only when `activeQuality()` has moved — a string compare per frame,
`cameraOwner.applyFov()`'s discipline from H9. One decision in one place, and
it is what makes the settings row safe: a check that cycles the rows and puts
`SETTINGS` back gets the picture back on the next frame.

**Auto measures once per browser, and it draws nothing of its own.** The probe
watches frames the game was already drawing — `debugState.cpuMs`, the clock
already around `post.render` — which is what keeps it off the boot H4 measured
and inside the 60 seconds the runner allows a page to load. A probe that
rendered two seconds of its own frames on a cold renderer would have been
timing a shader compile, and boot would have had to wait for it. Ten frames are
discarded for the same reason, then up to forty or two seconds of them,
whichever comes first — forty because the runner's warm-up is sixty, so the
pick is in the run's record before the first check. The median is taken and not
the mean: one frame that stalled on a collection is a frame, not a machine.
What it picks goes in `SETTINGS.qualityAuto`, so a second visit applies it
without measuring again; null is the whole record of "never measured", because
a second flag could disagree with this one and the probe always picks
something.

**What was found.**

**The queue's prediction was that auto picks `low` headless. It picked
`high`.** The first run of the finished probe read a **6.30ms median** and
chose `high` off Section 2's 16.67ms frame budget — which would have run the
gate at a 2048 shadow map and a 1600x900 buffer, a bigger recalibration of the
thirteen pixel modules than `low` would have been. The reason is the whole F11
finding turned round: under SwiftShader `renderer.render()` *queues*, and a
third of a headless run is the pipeline tail the suite waits for afterwards, so
the CPU clock around a draw says nothing about what the machine can draw.
`CONFIG.performance.cpuBudgetFraction` exists in this project for exactly that
reason — "integrated graphics are usually GPU-bound, so a CPU frame that eats
most of the budget on a dev machine will miss on Josh's" — and the probe was
reading a CPU number against a GPU-inclusive budget, which is the mistake that
constant is there to prevent. The thresholds are fractions of the **CPU's**
share now (8.33ms): under half of it `high`, within it `medium`, over it `low`.
The same 6.30ms reads as `medium`. And the check gained the clause that pins it
to the right constant rather than to a number that agrees with it — a median
*between* the CPU's share and the whole frame's must pick `low`, and would pick
`medium` off the frame budget.

**The pin earned itself twice over.** Not because the prediction was right, but
because it was wrong in the other direction and nothing had to change to
survive that. `?quality=medium` on the runner's URL held the picture still
through both mistakes, and `a-quality-pin-decides-what-is-applied-and-the-probe-only-records`
holds the pin against every row and against auto. `scripts/headless.mjs` pins
the same level, so `npm run shot` and `npm run probe` draw the picture the gate
judges rather than whatever auto fancies.

**And `scripts/suite.mjs` was at 599 lines.** Adding the pin, the run record's
`quality` field and the summary line would have taken it past the ~600 PLAN.md
allows a module, so the verdict and the printing moved to
`scripts/suitereport.mjs` — `judge()`, `summary()`, `expectedRedIds()`,
`skipsById()` and `SKIP_GUARD`: the half of that file with no Chrome in it, and
the half a reader comes to when they want to know what "OK" meant. suite.mjs is
455 lines now, suitereport.mjs 189. One check reads the runner's text
(`pipelinewait.js`, holding F16's spread contract) and it follows the code —
and gained the other half of the pair while it was there: it now asserts both
that `suitereport.mjs` still computes the spread **and** that `suite.mjs` still
imports it, which is `tests/registry.js`'s import-and-call pairing and is
strictly more than it held before.

**H7's census caught the two new settings, and it cost a whole verify.** The
first `npm run suite` on the finished tree came back **red on both maps, both
runs**: `a-setting-changed-now-is-the-setting-a-reload-reads` with
`this check has no changed value for the setting "quality"`. `changedValues()`
in `tests/settingsstore.js` builds a non-default value for every persisted key
and **returns the name of any key it has none for** rather than skipping it, so
`quality` and `qualityAuto` each had to be given a round-trip value — `high`
and `low`, deliberately different levels, because a pair written with the same
value would pass with the pair swapped, and `quality` deliberately not `auto`,
which is what it ships as. This is the second job running to be caught by that
census (H9's four settings were the first), and the second to record that it
worked. What it also shows is a gap in how this job was smoke-tested: three
subset runs went green before the verify and none of their regexes reached this
check id. A subset that names the new settings should have named
`a-setting-changed` too, and the cheap rule is that **a job adding a key to
`CONFIG.settings.defaults` runs `--subset "setting"` before it runs anything
else.**

**`high` does nothing on a 2x display**, and the check says so rather than
letting a row pretend: the scale multiplies `devicePixelRatio` and
`maxPixelRatio` (1.75) caps the product, so 2 x 1.25 and 2 x 1 both land on
1.75. Asserted, not commented.

**Checks.** Four new, in `tests/quality.js`, and one extended in
`tests/pipelinewait.js`. Every one ends at a live object — the drawing buffer's
own width, the key light's `shadow.mapSize`, `post.passes` after a frame, the
frame's draw calls, the particle slots a burst lit — because a preset that
wrote five fields and a label would look identical from the table.

- `the-medium-preset-is-what-the-game-drew-before-there-were-presets` pins every
  number in the medium row to the constant it came from, requires the three
  shadow maps to be a strictly rising sequence (or two levels are one picture
  under two labels), asserts the 2x-display cap, and then reads the live
  picture: `1280x720` buffer, 1024 shadow map, **13 outlines**, 7 post passes,
  5 sparks.
- `each-quality-preset-changes-what-a-frame-costs` drives each level the way a
  player would — the settings row, with the pin taken down the way boot puts it
  up — draws one frame at each and reads what it cost: buffers
  **896x503 / 1280x720 / 1600x900**, shadow maps **512 / 1024 / 2048**, draw
  calls **290 / 332 / 332**, and at low 0 post passes, 13 outlines off and 2
  sparks against medium's 5. High is allowed to equal medium's pixel count
  (the cap) and not to fall below it, which would mean the scale went the wrong
  way. It **asserts its own restore** — level, ratio, buffer, shadow map, post
  and outline census all back where they were — because this is the one module
  in the suite that resizes the drawing buffer and thirteen pixel-reading
  modules run beside it: a botched put-back should be loud where it happened
  rather than mysterious four checks later.
- `the-quality-probe-picks-the-level-its-frame-times-ask-for` feeds three
  machines' worth of frame times (**2.1 / 6.3 / 33.3ms** → high / medium / low),
  requires the warm frames to be *thrown away* rather than averaged in (a
  compile then forty fast frames must still pick high), requires no answer
  before the floor, requires it to stop, pins it to the CPU budget, and then
  reads what the **real boot's** probe recorded — H4's discipline, that a check
  picking its own inputs owes the suite the reading the live path produced.
- `a-quality-pin-decides-what-is-applied-and-the-probe-only-records` holds the
  pin against all four row settings and against a stored auto pick, requires a
  frame under the pin to reach for nothing, rejects `?quality=ultra` and
  `?equality=low` as pins, and then checks the unpinned path: the row decides,
  auto falls through to its stored pick, and `medium` before there is one.

**And a verify died of the machine rather than of the game.** The second attempt
came back `suite: crashed: run timed out` — F10's watchdog, 240s without a
heartbeat on `every-sound-renders-to-samples-that-match-section-14` at 191/206.
Run alone on the plant that check takes **16,738ms**, so a 240s gap is a stall
and not a slow check, and raising `--stall` would have been moving the
instrument without grounds. No orphan of this session's making: the process list
holds only the known 09-18 pair (pids 9608/4792, its headless Chrome 8920/11756)
and a `serve -l 5173` from 2026-09-26 that is another session's dev server, so
F10's teardown held through eight runs of this job. Re-run at the default and it
did not recur.

**And the pick is not as decided as it sounds.** The green verify measured the
same machine on both maps: the plant reads **8.70ms median CPU and picks `low`**,
the yard **5.30ms and picks `medium`**. The plant is the heavier scene, so what
the probe measures is machine *times* scene — and because `SETTINGS.qualityAuto`
is written on the first boot that answers, whichever map a friend happens to open
first decides their quality for the life of that browser. It is not flaky for any
check (all four assert the pick is one of the three levels, never which one), and
the pin means the gate never cared, which is exactly how a flaw like this stays
invisible. **H25**, with the cheapest honest fix named: keep the *lowest* level
any probe has picked, so a player whose plant needs `low` is not left on `medium`
because they opened the yard first.

**What was verified.** `npm run suite`, two runs per map, on the finished tree:
**plant 205 passed / 1 failed / 8 not for this map (1,081,742ms and
1,098,396ms), yard 185 / 1 / 28 (756,754ms and 794,260ms), exit 0, 0 red, 0
flaky, 0 console errors, 0 context losses, 0 loop frames, 0 skips withheld.**
Four more per map than the pair after H9 (plant 201, yard 181), which is H10's
four exactly. The renderer's pipeline tail was 476,675ms and 478,857ms on the
plant, 354,331ms and 347,241ms on the yard (F11), and the run pairs agree within
**16,654ms on the plant (2% of the longer) and 37,506ms on the yard (5%)** — the
yard's 5% is the widest spread since F11 and is the machine, not the suite. The
one failure on each map is the frame-budget check, skipped headless. **Three
attempts were spent on it**: the first red on H7's census, the second killed by
F10's watchdog, the third green.

Before it, a gate on the base: plant 201 / 1 / 8, yard 181 / 1 / 28, exit 0, and
it was run and read on a **clean tree** before a line was written, which is the
trap H9 paid for.

**What was left.** Two follow-ups, both queued. **H23**: `thumbnails.start()`
runs right after boot and the probe needs eighteen frames to answer, so on a
first boot on a real machine a card can be baked at `medium` and its neighbour
at whatever auto then picked — the pin hides this from the gate entirely.
**H24**: nobody has ever run the suite at `low` or `high`.
`npm run suite -- --query quality=low` does it today and it has never been
done, so which of the thirteen pixel-reading modules survive a picture with no
post and no outlines is simply unknown — and that is the honest limit of what
this job proved. **D60** is the decision, and the line in it worth Josh's eye
is that `low` turns the outlines off: everything else in that row is pure cost,
but the outline is how a body separates from the concrete behind it, so a
friend on a weak laptop might be playing a *more readable* game at medium with
a 512 shadow map than at low.

## H23 — one level for the whole strip of cards (2026-10-05 02:00, scheduled run)

**What was built.** `holdQuality()` / `releaseQuality()` in `src/quality.js`,
and `thumbnails.start()` taking the hold for the length of the set it bakes.
While a hold is up `syncQuality()` applies nothing; the level in force keeps
moving underneath it — a probe that answers still writes
`SETTINGS.qualityAuto`, a player can still cycle the row — and the release
applies whatever the answer is by then. Each card now records the level it was
actually drawn at (`record.maps[id].quality`, from `appliedQuality()` and not
`activeQuality()`, because what a card can be asked about is the picture it
got), and the set records the one level it started at.

**The race, and where it comes from.** `thumbnails.start()` runs right after
`window.BLACKLINE` is published, the cards are drawn one task apart, and the
game is rendering frames in the gaps. `auto`'s probe answers
`warmFrames + minFrames` frames in — eighteen, about 300ms, which is about one
card — so on a first boot the first card is drawn at the fallback and its
neighbour at whatever the probe then picked. H10's `?quality=` pin hides it
from the suite completely, which is how it survived that job and why it was
queued rather than found.

Of the two fixes the queue named — hold the cards until the probe has answered,
or hold the level until the cards are done — the second is what was built, for
the reason the queue gave: the cards arrive at once, at the level about to be
played at, rather than the strip staying empty while a probe measures.

**What was found, and it changes what the job is worth.** *The level does not
reach a card's pixels at all.* Measured with `npm run probe` before a line was
written: with the renderer demonstrably at `low` — an **896x503 buffer, a 512
shadow map, 0 of 13 outlines shown, no post pass** — a card came back
**byte-identical** to the same card at `medium`, on both maps (71,770 and
68,546 bytes either way). None of the five knobs is in a card. The outlines are
hidden by a traverse of the *live* scene and the shadow map resized on the
*live* map's key light, while a card is a fresh `buildDrawnMap` in a fresh
scene with its own 1024 key light, drawn into a fixed 480x270 render target
that no pixel ratio reaches, with no post and no particles.

So the race was real in the **record** and not in the picture, and the hold is
what makes `record.quality` true rather than what repairs a strip of cards.
That is worth saying plainly because it is the difference between a fix and
insurance — and it is insurance worth holding, because the day a knob does
reach a card the hold is already the fix and the check already names the
invariant. Whether a card *should* honour the level is a look question and a
new one: **D61**, recommendation taken as built, with **H26** queued if Josh
would rather see the game he is about to play.

**The 40-second card that was a wait, not work.** The first extra thumbnail set
the probe baked read **40,572ms on the plant with a 171ms build** — 40 seconds
inside one `readRenderTargetPixels`. The second set, moments later, cost
**266ms for both maps**. That is F11's finding in a new place: under
SwiftShader `render()` queues, `readRenderTargetPixels` blocks on a GPU sync,
and whichever call synchronises first pays for everything the run has queued —
here the 60 warm frames the probe drives before it hands over. TRAPS.md says to
put the suspect call on its own clock before reading its ms as its cost, and
that is exactly what the second set was. The check declares `glSync: true`, so
the runner drains before it and the wait lands on the run rather than on the
check; it reads **1,842ms on the plant and 1,230ms on the yard**.

Also measured and deliberately not asserted: two sets at the *same* level are
**not** byte-identical across boot and later (71,690 against 71,770 bytes). So
a check comparing one set's pixels to another's would be flaky, and this one
reads the recorded level instead. A pixel comparison would also have passed
today for a reason with nothing to do with the hold, which is the better
argument against it.

**Checks.** One new, in a new `src/tests/qualityhold.js`, because
`tests/quality.js` was at 599 lines and the block took it to 606 — Section 3.1
splits past ~600 (F3), and the subject is different anyway: that file is the
five knobs read off the renderer, this one is the moment they are allowed to
turn.

- `every-menu-card-is-baked-at-one-quality-level` reads the real boot's own set
  first and for free (H4's discipline, and the only clause that would notice
  `start()` dropping the hold altogether), then drives a first boot — nothing
  stored, the row on `auto`, the pin down — with the probe's one assignment
  landing between the first card and the second. The interleaving rests on the
  ordering this page already depends on: `yieldToPaint` posts a port message,
  messages posted earlier are delivered earlier, and
  `the-bake-yields-the-page-a-frame-to-paint` counts its markers with exactly
  that. Then **the control**: the same drive with the hold dropped, which must
  split the set, or the hold is not what made it one. It does split —
  `plant at medium and yard at low`. Then one holder at a time (a second
  `holdQuality` is refused rather than counted, because two holders and one
  release is a page stuck at whatever level the menu opened at), nothing
  applied while held, and a release that catches up with what moved. And it
  owes the same restore census as its neighbour, since it resizes the drawing
  buffer and thirteen pixel-reading modules run beside it: level, pixel ratio,
  buffer, shadow map, post and the outline count all back where they were. It
  reads, on both maps: *the boot's own 2 cards all at medium; 2 cards all at
  medium with auto picking low in the middle of the set, then the game at low;
  with the hold dropped the same drive draws plant at medium and yard at low;
  one holder at a time, nothing applied while held, and the release applies
  what moved; put back at medium, 1280x720* — 1,842ms on the plant, 1,230ms on
  the yard.

**What was verified.** A gate on the base first, on a clean tree, read before a
line was written: **plant 205 passed / 1 failed / 8 not for this map
(1,017,882ms), yard 185 / 1 / 28 (704,456ms), exit 0, 0 red, 0 flaky, 0 console
errors, 0 context losses, 0 skips withheld** — and for the first time since
2026-09-18 **no `OTHER RUNNERS ALIVE` line**: the orphan pair from that date is
gone, so every timing here is the first on record measured without it. Then a
smoke subset on the finished tree (9 checks, both maps, all green) before the
verify, which is the habit H10 paid 65 minutes to learn.

Then `npm run suite`, two runs per map on the finished tree: **plant 206 passed
/ 1 failed / 8 not for this map (1,014,154ms and 1,023,599ms), yard 186 / 1 /
28 (698,044ms and 696,721ms), exit 0, 0 red, 0 flaky, 0 console errors, 0
context losses, 0 loop frames, 0 skips withheld.** One more per map than the
base gate (plant 205, yard 185), which is H23's one check exactly. The run
pairs agree within **9,445ms on the plant (1% of the longer) and 1,323ms on the
yard (0%)** — the tightest pair on record against H10's 2% and 5%, and the
first taken with no orphaned runner beside them, which is at least consistent
with that being what the 09-18 pair was costing. The pipeline tail was 439,814
and 453,923ms on the plant, 334,851 and 328,387ms on the yard. The one failure
on each map is the frame-budget check, skipped headless. Auto's own reading
moved again — 5.80ms on the plant and 4.90ms on the yard, both `medium`,
against H10's 8.70 and 5.30 — which is **H25** saying the same thing a third
time and is now also a statement about machine load rather than scene alone.

**And a flag was swallowed, which is the new trap.** The verify was started as
`npm run suite --details <file>` without npm's own `--`, so npm read the flag
as its config and `scripts/suite.mjs` was handed no arguments: a perfectly
valid four-run verify at the defaults that silently wrote no details file. So
the per-check detail line and ms quoted above come from the smoke subset run on
the identical tree, not from the verify. It was not re-run, because stopping a
backgrounded runner leaves `suite.mjs` alive to the end of its runs and the
replacement would have been measured beside it (TRAPS.md), which is a worse
reading than a missing file. The trap is written up with its sharper sibling:
**`npm run suite --runs 1` is a silent four-run suite.**

**What was left.** **H26**, whether a card should honour the level at all,
which is D61's other option and the only part of this the measurement makes
interesting. **H24** and **H25** are untouched and still the next two jobs in
the block. The orphan question in `HANDOFF.md` is now one line shorter and
wants Josh's confirmation rather than his `taskkill`.

## H24 — the suite at low and at high, and the preset that moves the game (2026-10-05 02:00, scheduled run)

**What was asked.** The gate has been pinned to `?quality=medium` since H10, by
design, so nobody had ever run the suite at another level and which of the
pixel-reading modules survive a picture with no post and no outlines was
unknown. Run it once per map at `low` and once at `high`, record what answers
differently, and decide per check whether it should read the level or is
honestly a medium-only reading.

**What answered differently.** Eight checks at low, two at high, nothing flaky,
no console errors at either. The medium baseline is the verify of two hours
earlier on the same tree: everything green but the declared headless skip.

| Check | low (512 / x0.7 / no post / no outlines) | high (2048 / x1.25) | what moved |
|---|---|---|---|
| `exactly-one-shadow-caster` | red, 512 | red, 2048 | read `CONFIG.render.shadowMapSize` |
| `a-wall-the-key-lights-from-behind-reads-plain` (plant) | red, 7 crossings / 6 | red, 11 / 6 | a **1024-only** reading |
| `the-outline-darkens-the-silhouette-edge` | red, "the hull is not drawing" | green | low has no outlines |
| `post-processing-blooms-...-and-is-a-switch` | red, "0 passes, not 7" | green | low draws no post |
| `the-shade-reads-as-a-hooded-figure-at-8m-and-25m` | red, 1,476px / 3,000 | green | an absolute pixel floor |
| `a-look-at-a-pose-photographs-the-state-named` | red, 2,459px / 3,000 | green | the same floor |
| `the-warden-and-the-shade-are-told-apart-by-silhouette-at-25m` | red, 104px and 6 draw calls / 12 | green | the floor, and the missing hulls |
| `the-warden-fires-in-bursts-of-rounds-at-the-torso` (yard) | red, a 0.18s pause / 0.25-0.7 | green | **not a level effect** |

**The finding is the last row, and it is not about pixels.** The quality preset
scales the particle count (`qualityParticles`, 5 sparks at medium and 2 at
low), `effects.sparks()` takes **three draws from the shared seeded `rng` per
particle**, and the Warden's burst pause is
`rng.range(engageBurstPauseMin, engageBurstPauseMax)` off that same stream. So
the level changes how far the stream has advanced, and the AI's next decision
is a different number. Probed rather than argued, one impact from a fresh seed:

| level | particles lit | shared-rng draws | the next burst pause the AI would draw |
|---|---|---|---|
| low | 2 | **6** | 0.3492 |
| medium | 5 | 15 | 0.3745 |
| high | 5 | 15 | 0.3745 |

Which also explains the shape of the census: `particleScale` is 1 at both
medium and high, so the stream only diverges at `low` — and the burst check is
red at low and green at high, exactly as the draw counts predict.

Three things follow, and none of them is small. **`?quality=` is not
presentational**, which is what H10's module header and D60 both say it is, and
what the pin was built on. **`?seed=N` reproduces a match only at the level it
was recorded at**, which is not what Section 16 check 28 promises a seed does.
And **H13's replays would be wrong by construction** — a recorded input stream
replayed at another quality level diverges from the first impact onward. It is
**H27**, with three ways out named and measured: a private stream for
`systems/effects.js` (recommended — the only one that also covers an effect
nobody has written yet), always drawing the full `count` and using `lit` of
them, or taking the particle scale out of the preset, which is the one option
that changes what a player gets and so would be a decision rather than a fix.

The 0.18s pause itself is a *consequence* and not the bug: `rng.range(0.25,
0.7)` cannot return 0.18, so what the check measured was a gap in an engagement
that unfolded differently, classified as a pause. Which of the two it is — a
diverged burst structure, or the path at `ai.js:161` that zeroes `_burstPause` —
is the first question H27 answers, and this entry does not claim to know.

**What was fixed here, because the done-when allows a check to read the
level.** `exactly-one-shadow-caster` compared the live shadow map to
`CONFIG.render.shadowMapSize`. That constant was the answer until H10 made the
shadow map a preset knob, and after it the clause was green only at whichever
level the gate happened to be pinned to — red at 512 and red at 2048. It reads
`qualityPreset().shadowMapSize` now, which is also **strictly stronger**: it
catches a level that failed to apply its shadow map, which a constant never
could. Green at all three levels, naming both numbers: *"shadow map 512x512 and
low asks for 512"*.

This is the same lesson HANDOFF.md already carries — *a check that reads the
constant the derivation read can only ever agree with it* — arriving from the
other side. Here the check kept reading a constant the derivation had
**stopped** reading, and the only thing that could have exposed it is running
the suite at a level nobody had run it at. Which is the argument for H24
existing, and for doing it again after any job that turns a constant into a
table.

**And the high run found a defect in H23's own check, four hours old.** The run
record read `drawing high quality (auto, from the probe)` while the page was
demonstrably drawing a pinned `high` — a true level beside a false source. The
cause: `syncQuality()` publishes only when a knob actually turns, and
`putBack()` restores the pin to a level that is already applied, so nothing
published and `debugState.quality` kept the state it had in the middle of the
check. At `medium` it never showed, because there the restore *does* move the
level and so does publish. The runner copies that record into its own run
record, so the first suite run ever done at `high` recorded a sentence that was
not true of anything. `pinQuality()` publishes now — the pin is half of
`qualitySource()`, so moving it is a change to the published state whether or
not a knob turned.

**Checks.** One new and one extended.

- `the-published-quality-record-names-the-pin-in-force` (new, in
  `tests/qualityhold.js`) pins to `high`, to nothing, and then **twice to the
  level already applied**, which is the case that went stale, and requires the
  record's `pin`, `source` and `level` to agree with `qualitySource()` and
  `appliedQuality()` every time. It would go red if `pinQuality()` stopped
  publishing.
- `exactly-one-shadow-caster` (extended, `tests/map.js`) reads the preset.

**What was verified.** The three-level smoke first, 8 checks per map at each
level, all green — which is the reading that matters for this job, because it
says the two fixes hold at the levels that exposed them: *"shadow map 512x512
and low asks for 512"*, *"1024x1024 and medium asks for 1024"*, *"2048x2048 and
high asks for 2048"*, and the record check putting the pin back as
`?quality=low` / `medium` / `high` in turn.

Then `npm run suite`, two runs per map on the finished tree: **plant 207 passed
/ 1 failed / 8 not for this map (1,011,646ms and 1,020,270ms), yard 187 / 1 /
28 (699,967ms and 706,901ms), exit 0, 0 red, 0 flaky, 0 console errors, 0
context losses, 0 loop frames, 0 skips withheld.** One more per map than H23's
pair (206 and 186), which is this job's one new check. The pairs agree within
**8,624ms on the plant (1%) and 6,934ms on the yard (1%)**, and the pipeline
tail was 450,872 / 454,755ms and 332,734 / 333,610ms. The one failure on each
map is the frame-budget check, skipped headless.

The `--details` flag reached the script this time, which is the trap H23 wrote
up an hour earlier being read by the next job rather than paid for twice. And
the run record's own line is the `pinQuality` fix showing its work: it reads
`drawing medium quality (?quality=medium)` where H24's first high run read
`auto, from the probe`.

**And the cost of a run per level, which nobody had.** Plant / yard, one run
each: **low 383,936ms / 210,084ms, medium 1,014,154ms / 698,044ms, high
1,559,986ms / 1,138,459ms.** Low is **2.6x and 3.3x faster** than medium and
high is 1.5x and 1.6x slower, almost all of it the renderer's pipeline tail
(96,312ms at low against 439,814ms at medium and 711,680ms at high on the
plant). That is not an argument for moving the pin — eight checks are red at
low and six of them honestly — but a `low` run is now a known-cheap way to find
out whether something is broken before paying for a medium one, and that is
worth having written down.

**What was left.** **H27**, above, and it is the next job. **H28**: the six
remaining checks that read a picture only `medium` draws. The valuable half of
H28 is the three absolute pixel floors — 3,000px for a figure's coverage is a
reading about the drawing buffer rather than about the figure, so they would
break on a resized canvas too, and scaling them by buffer area makes them more
honest rather than merely level-agnostic. The outline and post pair should
assert the **absence** at low rather than be excused from it, which is a
stronger check than either has today. Nothing was weakened and nothing was
added to `suite-skips.json`.

## H27 — two streams off one seed, so the picture cannot move the game (2026-10-05 02:00, scheduled run)

**What was wrong.** One seeded generator served the whole codebase, and
`effects.sparks()` drew three numbers from it per particle with a particle count
the quality preset scales. So an impact cost **15 draws at `medium` and 6 at
`low`**, and from the first impact of a round every simulation draw after it was
a different number. H24 measured the consequence on the very next draw the AI
would make — the Warden's burst pause, 0.3745 against 0.3492 — and found it
because `the-warden-fires-in-bursts-of-rounds-at-the-torso` went red on the yard
at low and nowhere else.

Three things that were believed about this game were therefore false. **The
quality setting was not presentational**, which `quality.js`'s own header and
D60 both say it is and which the `?quality=medium` pin was built on. **`?seed=N`
reproduced a match only at the level it was recorded at**, where Section 16
check 28 promises a seed reproduces a match. And **H13's replays would have been
wrong by construction** — a recorded input stream replayed at another level
diverges at the first bullet that hits anything.

**What was built.** Two streams off one seed. `rng` is the simulation's and is
what the F3 overlay counts; **`lookRng` is presentation's, and
`systems/effects.js` is its only caller** — all fourteen draw sites: a
footprint's yaw, a spark's velocity, a smoke puff's placement and drift and
size, a ragdoll's tumble. `rng.reseed()` seeds **both**, because two reseed
functions is one a caller can forget and a look stream nobody reseeded would
hand every match the same sparks; the look stream is salted with the golden
ratio constant so the two never hand out the same sequence.

The rule is deliberately a layering rule and not a patch on `sparks()`:
*nothing presentational draws from the simulation's stream.* The alternative
considered and rejected was to draw the full unscaled count and light only
`lit` of them, which keeps one stream and would have fixed the level dependence
without changing a single existing reading — attractive, and it was the safer
option on the day — but it leaves every future effect one careless edit from
the same bug, and the bug is invisible until somebody runs the suite at a level
nobody runs it at. Which had never happened before H24. The third option on the
queue, taking the particle scale out of the preset, was not taken because it is
the only one that changes what a player gets: `low` would pay for every spark.

Both surfaces come from one factory (`streamOver(state)`), so `lookRng.unit()`
cannot drift from `rng.unit()` and a call site moved between them needs no
rewriting.

**What was found.**

**The first draft froze the determinism canary, and no check would have caught
it.** `export const rng = { ...streamOver(rngState), reseed, get seed() }`
looks right and is not: an object spread copies `calls` as **the number the
getter returned at spread time**, so `rng.calls` was permanently 0 and the F3
overlay's draw counter read zero for the life of the page. Nothing asserts
`debugState.rngCalls`, so the suite would have gone green on it. It was caught
by a six-line node script run against the module before the suite ever saw it,
asserting the seven properties two streams owe: each reproducible from a reseed,
the two different from each other, the counters resetting, forty look draws not
moving the simulation's next number, and the seed getter still answering.
`Object.defineProperty` for the getter now, with the reason written at the line
so the spread cannot come back.

The general lesson is the one this project keeps relearning from the other
direction: **a check that nothing reads is a field that can die quietly.**
`rng.calls` exists as a determinism canary and is read only by an overlay a
headless run never draws.

**And the stream split cost no recalibration at all**, which was the real risk
and the reason this was sized M. Splitting the stream moves every simulation
draw at *every* level, `medium` included, so every seed-sensitive check could
have shifted — and the ones here are rates, cones, patrol orders and soaks
measured over many samples with tolerances, so **28 of 28 on the plant and 25
of 25 on the yard passed first time**, `a-match-replays-identically-from-its-
seed` and `ai-patrol-order-is-seed-reproducible` included. No threshold was
touched. That is worth recording as evidence that F18's discipline — count
bursts rather than rounds, measure a rate and not a coin — is what made a
change like this affordable.

**Checks.** One new, in `tests/quality.js`.

- `the-quality-level-cannot-move-the-simulation` seeds one match per level,
  steps all three the same 120 fixed steps, and fires the presentation calls an
  impact makes on a fixed cadence (the methods and not the events — half an
  emitted event leaves the other half behind). Then it requires the simulation's
  **draw count**, the **next number it would hand out**, the Warden's position
  and yaw to six places, and the AI's state to be identical across levels. The
  draw count is the sharpest of the four: it cannot be equal by luck.
  **And the second half is what keeps it honest** — it also requires the levels
  to have lit a *different* number of particles, because otherwise the check
  would pass just as well with `particleScale` 1 everywhere, which would "fix"
  H27 by deleting the feature it is about. It reads: *one seed, 3 levels, 19
  simulation draws and the Warden at the same place in all of them, while a
  burst lit low 10 / medium 25 / high 25.*

**The done-when, at the level that found the bug.** `npm run suite -- --runs 1
--query quality=low`, the whole suite on both maps:
`the-warden-fires-in-bursts-of-rounds-at-the-torso` is **green at low on both**
- *18 rounds in 3.5s as bursts of [6 3 5] with pauses of [0.48 0.60 0.42]s* on
the plant, *[6 6 3]* and *[0.30 0.27 0.53]s* on the yard, every pause inside
config's 0.25-0.7 - and `the-quality-level-cannot-move-the-simulation` is green
at low as well as at the pin.

**And the off-level census is now exactly what H28 says it is**, which is the
other thing this run bought. At low: **plant 201 passed / 8 failed, yard 183 /
6**, and the reds are H28's six (the outline, the post, the wall's banding, and
the three pixel floors) plus two frame-budget readings - the declared headless
skip, and `frame-budget-under-the-check-29-load` on the plant, which was **not**
red in H24's low run and is red in both of H27's. It is a wall-clock perf check
and these two runs were taken on a machine that had been running headless Chrome
for five hours with nine processes pinned, so the honest reading is "unexplained,
probably load" and not "H27 made the plant slower" - H27 removes draws, it adds
none. It is named in H28 so that job judges it with the rest rather than
inheriting it silently.

**What was verified.** The seed-sensitive smoke first, at the pin: **28 of 28
on the plant and 25 of 25 on the yard**, which was the whole risk of the job.
Then `npm run suite`, two runs per map on the finished tree: **plant 208 passed
/ 1 failed / 8 not for this map (1,019,974ms and 1,037,783ms), yard 188 / 1 / 28
(731,415ms and 713,430ms), exit 0, 0 red, 0 flaky, 0 context losses, 0 loop
frames, 0 skips withheld.** One more per map than H24's pair (207 and 187),
which is this job's one check. The pairs agree within **17,809ms on the plant
(2%) and 17,985ms on the yard (2%)**.

**One console error, and it is the machine.** *"The AudioContext encountered an
error from the audio device or the WebAudio renderer."*, once, on the yard page.
Every previous verify on record reported zero, so it is reported here rather
than waved past. The argument that it is environmental: it is attributed to the
**page URL** and not to a file in `src/`, where the smoke leak's assertions were
attributed to `src/ui/debug.js`; H27 touched no audio path; and
`every-sound-renders-to-samples-that-match-section-14` is green on both maps
with all sixteen sounds rendering, none silent and none clipping. Headless
Chrome has no audio device and this machine had been driving it for five hours.
If it recurs on a cold run it is a defect and not a condition.

**What was left.** **H28**, unchanged in scope by this: six checks that read a
picture only `medium` draws, of which the three absolute pixel floors are the
valuable half. The quality row's own description in `PLAYTEST.md` and D60 no
longer need the warning H24 put on them, and both were corrected here rather
than left to contradict the code.

## H28 — six medium-only readings, and five of them were about the drawing buffer (2026-10-05 17:00, scheduled run; finished and verified in the 2026-10-06 02:00 run)

**What the job was handed.** H24 ran the suite at `low` and at `high` for the
first time and listed eight checks that answer differently at low and two at
high. H27 took one of the eight — the Warden's bursts, which was the quality
level moving the simulation through a shared rng. That left **six honest picture
readings** and the queue's description of them: *checks that read a picture only
`medium` draws, which should say which level they read instead of just going
red.* The queue also named the valuable half correctly and for the right reason:
a 3,000-pixel coverage floor for a figure *is a reading about the drawing
buffer*, so it would break on a resized window too, and scaling it is more
honest than making it level-aware.

**What it turned out to be.** Five of the six were one bug, and the bug is not
about quality at all. The runner's window is 1280x720 and `resolutionScale` is
0.7 / 1 / 1.25, so the drawing buffer is **896x503 at `low`, 1280x720 at
`medium` and 1600x900 at `high`** — and it is the player's window times their
pixel ratio everywhere else. Against that, five checks held **absolute pixel
geometry**:

- a figure's coverage floor of 2,000 pixels, which a correctly drawn Shade
  cleared with 3,014 at `medium` and missed with 1,455 at `low`;
- a pose's floor of 3,000, read at 2,459 at `low`;
- the two-body frames' 300 / 2,000 / 6,000, never red because the near eyes
  clear them, and the same reading all the same;
- the post's 20-pixel fixture, its 10-pixel halo dilation and its 500-pixel
  corner band;
- the outline's 400-pixel body floor.

`scaledCount`, `scaledColumn` and `scaledRow` in `tests/pixels.js` are the fix,
and the law they encode is the half of this worth remembering: **a count scales
with the square of the buffer *height*, not with its area.** `render.fov` is a
vertical field of view and the horizontal one follows the aspect, so a body's
pixel height goes with the buffer's height and so does its width. On the 16:9
the runner drives, height-squared and area give the same number; on anything
else only the first is right. Measured across the three buffers on the plant:
**5,750.8 / 5,814.0 / 5,730.9 pixels per megapixel-of-height, a spread of
1.4%** — so the law is not approximately right, it is right.

**What had been diagnosed wrongly, twice.** The sixth was the wall-banding
check, and H24's write-up and this queue both recorded it as *"a 1024-only
reading"*: a sharper shadow map banding more. It was not that. It reads
**columns 700 to 1270 of row 200**, and at `low` the buffer is 896 wide — so
the read ran off the end of each row and 374 pixels into the row above it, and
the check assembled a staircase out of two rows and reported shadow stripes, 7
crossings against a ceiling of 6. At `high` every column was in range and all
of them were in the wrong place, landing left of the wall on the bay behind it:
11 crossings. The index is `y * width + x` and nothing bounds-checks `x`. The
reason the misdiagnosis was so easy is that **the artefact looks exactly like
the thing it was blamed on** — two interleaved rows of a luma ramp are a
staircase, and so is a shadow map's texel edge. It is in `TRAPS.md` now with
that said out loud, because the lesson is not "scale your columns", it is that
a plausible cause for a staircase is not evidence of one.

**And under it, F8's instrument clause.** Fixing the window exposed a second
bug in the same check that nothing had been pointed at. F8 proves its own
instrument by taking the key-light fix off and requiring the stripes to come
back — *as a count of crossings over the same ceiling*. But **a crossing count
is a count of the shadow map's texels**: 14/9/6 crossings at a 512 map, 23/21/12
at 1024, 50/44/25 at 2048. Halve the map and you halve the count, so at `low`'s
512 map the third row read 6 crossings, which is *at* the ceiling rather than
over it, and the check reported that its instrument had gone blind when what had
happened was that the preset had changed the shadow map. Same shape as H24's
`exactly-one-shadow-caster`, and the third time this shape has appeared since
H10 made the shadow map a preset knob.

The reading that does not move is the **amplitude**: the stripes are about a
luma deep whether there are six of them across the window or fifty
(0.81/0.43/0.30 luma at 512 against 0.76/0.58/0.47 at 2048). So the clause reads
swing now — every row's residual must deepen by **2.5x** when the fix comes off
— and the plain wall's ceiling in crossings stays, because a wall with no
stripes on it has none at any map size. That split is the point: one of the two
numbers was scale-free all along and the check was using the other one.

**The pair that asserts an absence, and the bug it caught.** The outline and the
post are the two checks whose subject is the live picture at a level that draws
neither of them — `low` has `outlines: false` and `post: false` (D60). Going red
there is wrong and skipping is worse, so both now **assert the absence**: at a
level that draws no outlines every hull must be hidden, and at a level that
draws no post the frame must report 0 passes, the ring round a fixture must not
move, and the corners must not darken even with the settings row on. That is the
stronger half of each pair — a row that could switch the bloom on at `low` would
be the preset not being honoured, and nothing else in the suite would notice.

It also caught a defect nobody could have found any other way. The outline check
ended `hull.visible = true` for every hull, **unconditionally**. At `low` the
preset has the outlines off, so that check *turned them on* and left them on for
every check after it in the run. Nothing caught it and nothing would have: the
suite is pinned to `medium`, where the restore happens to be correct. It
restores to `qualityPreset().outlines` now. The general rule — *a check that
hides something puts it back the way the preset wants it, not the way it found
it written* — is in `TRAPS.md`.

**The one judgement, and it is D63.** The two figure checks were the awkward
case. Their red at `low` was *"the Shade's hood 6px is not 1.5x its neck 5px"*,
and at 0.7 in a 1280x720 window the Shade at 25m is **28 by 8 pixels**: the neck
bottoms out at the narrowest row a difference frame resolves while the hood keeps
shrinking, so the ratio collapses on quantisation and not on anything about the
body. Everything those two checks assert — six parts on one material, tall and
narrow, a hood over a neck, a helmet under shoulders, a rifle out front — is
**geometry**, and geometry is the same shape at every resolution. So they read
at the resolution `medium` ships, whatever level is applied
(`createLens(h, { pixelRatio })`, restored on the way out), and their numbers are
now identical at all three levels: Shade 40x12, Warden 40x26 at 25m, measured at
`low` and at `high`.

**The line that keeps this from being a dodge, and it is the one for Josh.**
896x503 is not what a player at `low` sees — it is what a player at `low` sees
*in a 1280x720 window*. On a 1080p display `low` draws 1344x756, which is **more**
pixels than the reference these checks now read at. The red was a reading about
the runner's window, not about the level. But the cost is real and is recorded
rather than buried: **nothing now asks whether a genuinely small window keeps a
body legible at 25m.** The old red was the wrong instrument for that question —
it could not tell a small window from a low preset — but it was the only thing
pointed anywhere near it. That is **H29**, which asks it directly at a named
buffer (1366x768 at `low` is 956x538) and has an answer that means something
either way. D63 says that if Josh would rather the figure checks stayed at the
applied resolution and `low` were held to the silhouette, H29 becomes the
calibration job instead.

**The seventh, which was not one of the six.** H27 left
`frame-budget-under-the-check-29-load` red at low on the plant and asked this job
to judge it with the rest. It is **green at `low` on both maps** — CPU 3.10ms
median against a 16.67ms budget — so it goes on the record as machine load,
which is what H27 suspected and could not show. Nothing was changed for it.

**Checks.** One new module, one split, and clauses in five existing checks.

- `a-pixel-reading-is-a-fraction-of-the-drawing-buffer`
  (`tests/bufferscale.js`, new) is what makes the scaling load-bearing instead
  of merely present. At the pin it drives the renderer's pixel ratio to the
  three the presets ask for and reads the Shade's silhouette at each **through
  the figure check's own floor function** rather than a copy of its numbers — so
  a floor that goes back to being absolute fails here, at `medium`, without
  anyone running the suite at another level again. It asserts the
  height-squared law across the three buffers, asserts the key-light window
  fits every one, and its last clause is the sentence the job exists for: the
  smallest buffer's reading is **below** the reference floor, so *"a fixed 2,000
  would have failed here"* is asserted rather than remembered. It restores
  through `applyQuality()`, for the reason the outline bug above exists.
- `the-outline-darkens-the-silhouette-edge` moved out of `tests/visual.js` into
  **`tests/outline.js`**: the module was at 589 lines against the ~600 guidance
  and this job needed to add a clause to it, so the block came out into a
  sibling named for its own subject, as H23's did. `visual.js` is 485 now and
  `outline.js` 180.
- Clauses: the preset's own outline state (outline), the absence of post at a
  level that draws none plus a non-vacuous marker reading (post), swing rather
  than crossings (keylight), and scaled floors with the buffer named in every
  detail line (figure, look, post, outline).

**This entry was written by the run after the one that did the work.** The
17:00 run of 2026-10-05 built all of it, wrote D63, the queue, `PLAYTEST.md`
and `TRAPS.md`, and then stopped before `PROGRESS.md` and before any commit -
so the 02:00 run of 2026-10-06 found a dirty tree with no WIP note in it and
finished the job rather than committing it as WIP, which is the first branch
of step 1 of the protocol. Everything under *What was verified* is this
run's, and the suite had not been run twice on the finished tree before it.
Nothing in the code or the docs was changed on the way except the four
disagreeing numbers at the end of that section. The lesson for the protocol
is small and worth having: a run that dies between the work and the commit
leaves a tree that looks exactly like a run that died in the middle of the
work, and the only thing that told them apart here was that every file the
job touches was already coherent.

**What was verified.** `npm run suite`, two runs per map on the
finished tree: **plant 209 passed / 1 failed / 8 not for this map (1,026,004ms
and 1,019,166ms), yard 189 / 1 / 28 (704,077ms and 703,601ms), exit 0, 0 red, 0
flaky, 0 console errors, 0 context losses, 0 loop frames, 0 skips withheld, 0
unexpectedly green.** One more per map than H27's pair (208 and 188), which is
this job's one check. The pairs agree within **6,838ms on the plant (1%) and
476ms on the yard (0%)** - the tightest pair on record, beating H23's.

**And H27's console error did not recur.** H27 reported one `AudioContext`
device error on the yard page where every earlier verify had none, argued it was
environmental, and said that if it came back on a cold run it was a defect. It
did not come back: **0 console errors** across four runs. That closes it as the
machine, which is the outcome H27 predicted but could not show.

The numbers in this entry are the checks' own, read with `--details <path>` -
worth knowing because the report JSON carries a detail line only for a check
that went **red**, so a passing check's measurements need a subset run to see at
all. The readings quoted above come from
`a-pixel-reading-is-a-fraction-of-the-drawing-buffer` on the plant at the pin:
*x0.7 896x503: 1455px over a floor of 976, the wall window 490-889 on rows
140/210/279; x1 1280x720: 3014px over a floor of 2000, the window 700-1270 on
200/300/400; x1.25 1600x900: 4642px over a floor of 3125, the window 875-1588 on
250/375/500.*

**One correction made on the way, and what it turned out to be.** The notes
this job inherited quoted the figure's coverage in five places and the pairs
did not agree: `pixels.js` and `bufferscale.js` said 3,012px at `medium` falling to
1,476 at `low`, `figure.js` said 1,476 against a floor of 2,000, `HANDOFF.md`
said 3,014 to 1,455 and `PLAYTEST.md` said 3,012 to 1,455. The first reading of
that was a transcription error somewhere, and it is not: **they are two
instruments measuring nearly the same thing.** 1,476px is what the figure
check itself read at `low` when H24 found the red; 1,455px is what
`a-pixel-reading-is-a-fraction-of-the-drawing-buffer` reads at x0.7 today,
from its own stand with its own frame count. They differ by 1.4%, which is
the same 1.4% the height-squared law holds to across the three buffers - the
thin limbs a smaller buffer resolves differently against an 8-luma
threshold. 3,012 and 3,014 are the same story one run apart, and the figure
check's own reading at `medium` is a third number again, **3,072px**, because it
poses the body for longer.

So nothing was wrong except the prose, which had put two instruments' numbers
in one sentence. What was changed is small: `pixels.js` and `bufferscale.js` now
quote the pair `bufferscale` itself prints (3,014 and 1,455) so a reader can run
the check and see them, `figure.js` keeps H24's 1,476 because that is the figure
check's own history, and `PLAYTEST.md` is made to match. **The real lesson is the
precision.** None of these numbers is stable to four significant figures - a
pixel count off a software rasteriser moves a percent between runs - and
quoting one to four digits in five places invites exactly the hour this cost:
a reader cannot tell a drifting measurement from a typo, so they go looking
for a bug in the record instead of reading what the record is for. A floor, a
ratio and an order of magnitude are what these sentences needed.

**The paragraph above replaced a wrong one.** As first written this entry said
three of the four numbers were wrong and guessed they came from a draft taken
before the pose settled. H24's own table says otherwise, and the guess is on
the record as a guess rather than quietly deleted.

**What was left.** **H29** and **H30**, both S, both in the queue, and **D63**
open for override. H30 is the census this job did not do: four more modules hold
absolute pixel numbers — `visual.js`'s 5,000-pixel smoke-occlusion floor and its
400-pixel alarm-fixture reads, plus floors in `legibility.js`, `readability.js`
and `presentation.js` — and none of them is red at any level today, which means
only that no level happens to cross them. That is exactly what was true of these
six before anybody ran the suite at `low`. The half of H30 that is a judgement
and not an edit: a floor genuinely about a fixed-size thing (a HUD element in CSS
pixels) should stay absolute and carry a comment saying so.

## H29 — does a small window keep a body legible at 25m? The suite cannot tell, and that is the finding (2026-10-06 02:00, scheduled run)

**Why this job existed.** H24 ran the suite at `low` and
`the-warden-and-the-shade-are-told-apart-by-silhouette-at-25m` went red on *"the
Shade's hood 6px is not 1.5x its neck 5px"*. H28 moved both figure checks onto
the resolution `medium` ships, on the grounds that everything they assert is the
**geometry** of a body and a hood is the same shape at every resolution — and
that the red was a reading about the runner's 1280x720 window rather than about
the level, since a player at `low` on a 1080p display draws 1344x756 and gets
*more* pixels than the reference. D63 recorded that and recorded its cost
honestly: the old red was the wrong instrument for a real question, and it was
the only thing in the suite pointed anywhere near it. H29 is that question asked
properly.

**How it was asked.** The queue named one buffer (1366x768 at `low`, which is
956x538). What is read instead is a **sweep of five**, because the question is
about the buffer and not about any display: a window height times a preset's
`resolutionScale` is the only thing that reaches the rasteriser, so a 1080p
display at `low` and a 756-row window at `medium` draw the same body out of the
same pixels. The sweep contains the size the queue named and brackets it both
ways.

Read **face-on**, which mattered and nearly did not happen. The first draft stood
the Shade at the lane's yaw and got comfortable ratios everywhere — a cheerful
finding about a question nobody had asked. The red being explained came from the
told-apart check's `front` view, where the Shade is turned to the camera and its
hood is read across its full width against the narrowest neck row under it.
`yawToward` is exported from `tests/figure.js` for it.

**What came back, and it is not what the first draft of this entry said.**

| display | buffer | the Shade | run 1 | run 2 |
|---|---|---|---|---|
| 1920x1080 at `low` | 1344x756 | 43x12 / 42x12 | 10 / 6 = 1.67x | 10 / 6 = 1.67x |
| 1280x720 at `medium`, the reference | 1280x720 | 41x12 / 40x12 | 10 / 6 = 1.67x | 10 / 6 = 1.67x |
| 1366x768 at `low` | 956x538 | 31x8 / 30x8 | 8 / 4 = **2.00x** | 8 / 6 = **1.33x** |
| 1280x720 at `low` | 896x503 | 28x8 | 6 / 4 = **1.50x** | 6 / 6 = **1.00x** |
| 1024x600 at `low` | 746x420 | 24x8 / 23x8 | 6 / 4 = 1.50x | 6 / 4 = 1.50x |

**Two runs of one suite read the same body as 2.00x and 1.33x.** The check went
**flaky on both maps** in the verify, which is how this was found at all.

**And it had looked stable.** Before that verify the check was run **eight
consecutive times in isolation**, four per map, and all eight agreed: the hood
rock-steady at 10 / 10 / 8 / 6 / 6 and only the neck wobbling between 4 and 5,
with every reading clearing the threshold. Eight agreeing runs did not predict
the ninth, because the full suite is where the body's measured height moves.

**The cause, and it is not quantisation of one row.** `band()` in
`tests/figure.js` takes the neck as the rows between **14% and 22%** of the
silhouette's height — 8% of it. At 25m in these buffers the silhouette is **30
rows tall and 8 pixels wide**, so that band is *two rows*. The body's measured
height moving by a single row — 31 to 30, 24 to 23, which is all the two runs
differ by — slides those two rows onto different anatomy, and `narrowest()`
returns the shoulders instead of the neck. **The two readings are not a noisy
measurement of one thing; they are measurements of two different things.** That
is why the hood looked so steady while the neck jumped by half its own value:
the hood is the *widest* row of a four-row band, which barely moves, and the neck
is the *narrowest* row of a two-row one, which moves entirely.

**So the answer to the question is that this instrument cannot answer it.** A
hood cannot be told from a neck inside eight pixels of width, and no
band-by-fraction-of-height decomposition is meaningful on a body that small.
That is a **stronger vindication of D63 than D63 claimed for itself**: pinning
the figure checks to the shipped resolution was not a dodge around a one-pixel
threshold, it was the only buffer where the instrument works at all.

**What the check asserts, therefore.** Only the readings that held across both
runs on both maps: the body is **found**, it **covers its share of the buffer**
(a fraction of it, H28, not a number of pixels — floors of 165 / 150 / 83 / 73 /
51 against counts in the hundreds), and it **keeps its tall narrow proportions**,
measured 3.58 / 3.42 / 3.88 / 3.50 / 3.00 in one run and 3.50 / 3.33 / 3.75 /
3.50 / 2.88 in the other against a bar of 2.2. That last is stable precisely
because it is a ratio of the **whole silhouette** rather than of two bands two
rows deep. The hood and the neck go in the detail line and **nothing asserts
them**: a clause that reports 2.00x and 1.33x for one body in one suite is not a
clause.

**The wrong conclusion this job published first, and why it is named here.** The
first versions of D64, `PLAYTEST.md` and this entry all said the hood reads at
every size tested and that there is therefore **no minimum-resolution line to
write into the spec**. That was wrong. It rested entirely on the eight runs that
happened to measure 4px necks, and it was written before the verify disagreed.
It is retracted in D64 and in `PLAYTEST.md` rather than quietly deleted, for the
same reason H28's own retraction is on the record: a reader who finds the old
sentence quoted somewhere needs to be able to find out it was withdrawn. The
honest statement is narrower — at 1366x768 on `low` the Shade at 25m is **30
pixels tall and 8 wide**, and whether that reads as a hooded figure to a human
eye is not a thing a pixel count settles in either direction.

**Which makes it Josh's, and as one specific look rather than an open worry.**
`PLAYTEST.md` has it under *Still needs a human*: open the game at
`?quality=low` in a window about 1366x768, find a Shade at 25 metres, and say
whether you can tell it from a Warden. If he can, nothing needs doing. If he
cannot, *then* there is a minimum-resolution decision — which is exactly why no
such line was written on the strength of eight agreeing runs.

**Checks.** One new module, `tests/smallwindow.js` (238 lines), registered after
the pixel-reading modules beside the other three that resize the drawing buffer.
It is kept out of `tests/figure.js` (459) for the reason H23's and H28's splits
were, and reads through **four exports of that module rather than copies of
them** — `flatShadeSilhouette`, `silhouetteFloor`, `yawToward` and `NARROW`. It
restores through `applyQuality()` for the reason H28's outline bug exists, and
declares `glSync: true` because five buffer resizes put the renderer's pipeline
tail on the run's clock rather than inside one check (F11, D48).
`HOOD_OVER_NECK` was exported for a first draft that asserted it and is a
module-local constant again, now carrying a comment saying why it is read at one
resolution and nowhere else.

**Three things learned, two of them traps.**

**A check's detail line is cut at 400 characters, with no ellipsis, in
`--details` as well as in the report.** `scripts/suite.mjs:415` does
`String(x.detail ?? '').slice(0, 400)`. This check prints one reading per buffer
and **three of the five vanished** — and because a failing check puts its
problems first and its readings last, what came back was a complaint followed by
two readings that did not support it, which reads exactly like a check that broke
out of its own loop early.

**A passing check's numbers are not in the report at all.** The report carries a
`detail` only for a check that went red or flaky — right for a gate, wrong for
writing up a job, because the measurements an entry needs come from checks that
passed. `npm run suite -- --runs 1 --map <one> --details <path> --subset "^<id>$"`
is about a minute and is how every number above was read.

**And the one that is not a trap but a method: a new check's flakiness has to be
proved where the check will live.** Eight isolated runs agreed and the ninth, in
a full suite, did not — because `quiesce()` re-inits the match and normalises the
simulation, but the body's *measured* height still moves by a row in full-suite
context. A subset run is the right tool for reading numbers and the wrong one for
believing them.

**What was verified.** `npm run suite`, two runs per map on the finished
tree: **plant 210 passed / 1 failed / 8 not for this map (1,042,320ms and
1,049,080ms), yard 190 / 1 / 28 (722,454ms and 714,857ms), exit 0, 0 red, **0
flaky**, 0 context losses, 0 loop frames, 0 skips withheld, 0 unexpectedly
green.** One more per map than H28's pair (209 and 189), which is this job's one
check. Both runs of each map agree **exactly** on every count, which is the
result that mattered here: the first verify of this job had the new check flaky on
both maps, and the second has it reading the same thing twice. The pairs agree
within **6,760ms on the plant (1%) and 7,597ms on the yard (1%)**; the tails were
450,110ms and 451,229ms on the plant, 333,735ms and 333,917ms on the yard.

**And one console error, which corrects something written earlier today.** H27
reported an `AudioContext` device error on the **yard** page and argued it was
environmental, saying it would be a defect if it recurred on a cold run. H28's
verify had none, and H28's entry concluded *"that closes it as the machine"*.
**That was premature and this run is why**: the same error is here, once, on the
**plant** page. The standing record is now two occurrences in three verifies
(H27 yard, H28 none, H29 plant). What has not changed is the evidence that it is
environmental: it is attributed to the **page URL** and not to any file in
`src/`, no sound check is red on either map, and this machine had been driving
headless Chrome for most of a session each time. What has changed is that nobody
should write "closed" against it again on the strength of a single clean verify -
it is intermittent, so one absence proves nothing and H28's sentence should have
said so. It is queued as **H32**, which names what a cold run would have to be
to settle it.

The numbers in the table above come from `--details` on a two-run full-suite pass
of the plant, which is where the disagreement was caught; the per-size readings on
the finished tree are *1344x756 42x12 402px 3.5:1 hood 10/6; 1280x720 (ref) 41x12
356px 3.4:1 hood 10/5; 956x538 31x8 207px 3.9:1 hood 8/4; 896x503 28x8 184px
3.5:1 hood 6/4; 746x420 24x8 120px 3.0:1 hood 6/4*, against floors of 165 / 150 /
83 / 73 / 51 and a narrowness bar of 2.2.

**What was left.** **H30** (S), the pixel-floor census H28 did not reach, is next
and unchanged by this. **H31** (S) was rewritten by what this job found and is
the more interesting one: the two figure checks assert 1.5x on a band that is
*three rows deep* at the reference buffer, where the neck measured **5px and 6px
across runs** against a hood of 10px — so a third reading of 7px would be 1.43x
and red. Both are green and have been for every run on record, so it is not a
defect; it is a clause running on a margin nobody had measured. H31 is told to
measure before touching either, and the deeper option it now names is to take the
neck as a **fixed number of rows** below the hood rather than a fraction of the
height, which would stop the band moving at all — a change to a helper two
shipped checks depend on, and the reason it is not an XS.

## H30 — the pixel-floor census, and the three that are not about size (2026-10-06 02:00, scheduled run)

**What it was handed.** H28 scaled the six pixel floors H24's off-level runs had
caught, and left the rest with an honest note: *none of them is red at any level
today, which means only that no level happens to cross them.* That was exactly
true of H28's own six before anybody ran the suite at `low`, so the note was a
prediction as much as a disclaimer. H30 is the census it asked for, and the queue
sized it right: *a census and an edit rather than a design, with the judgement in
which floors should stay absolute.*

**The census: twelve floors.**

| | |
|---|---|
| **8 scaled** with `scaledCount` | a body in `visual.js` and another in `presentation.js`, the alarm fixture, the death cam's killer, a vent region and a route strip in `legibility.js`, and the rim in `presentation.js` |
| **1 already correct** | `feedback.js`'s damage vignette, written as **5% of the frame** because it covers the whole view - the precedent the rest followed |
| **3 left absolute** | `visual.js`'s alarm tripwire at **10px**, and `feedback.js`'s hit marker and damage arc at **20px** each - **D65** |

Each of the eight is a thing in the world projected into the frame, so the pixels
it covers go with the square of the buffer height, which is H28's law and not a
new one.

**The three that stayed, which is the judgement half.** None is a claim about how
big anything is. Each says **something was drawn at all**, with the size,
placement and shape asserted properly in the clauses immediately around it - the
hit marker's extent against `F.hitMarkerOuter * height` two lines later, the arc's
radius against `F.indicatorRadius` in half-heights, both already fractions. And
the argument for leaving them is not inertia: **scaling a tripwire makes it looser
on a small buffer.** A floor of twenty exists to catch *nothing drawn*; scaled, it
would be ten at 503 rows and five at 420, so the smaller the window the less it
would take to satisfy - the opposite of what a canary is for. A small fixed number
is the honest way to say "this is not zero".

**The one that went the other way, and is in D65 to be argued with.**
`presentation.js`'s rim at 200px was **scaled** rather than left absolute or made
a fraction of the body it rims. A fraction of `masked` was the obvious
alternative - the line already prints it - and was refused because the share of a
silhouette its edge occupies *falls* as the body grows, so a fraction of the body
would be a different and harder claim than that line has ever made. It is a real
improvement available to somebody who wants a different check.

**The one floor that did not take `scaledCount`.** The smoke cloud's 5,000
pixels. The claim there is that the cloud *obscures*, which is a share of what the
player can see - so a wider frame showing more smoke genuinely is more obscured,
where a taller frame showing a bigger body is not a bigger body. The check was
already computing `diff.count / lens.pixels` and printing it, and now asserts it;
`SMOKE_COVERS` derives the fraction from the original 5,000 over the reference
buffer, so the provenance of the number survives the change. The two laws agree
on the 16:9 the runner drives and part company only off it, but the one that
states this particular claim is the fraction.

**What the queue had wrong.** It named four modules holding floors:
`tests/visual.js`, `legibility.js`, `readability.js` and `presentation.js`.
**`readability.js` holds none** - it never calls `createLens` and reads no pixels
at all. Checked rather than assumed, which is the only reason it is in this entry;
the census also turned up `feedback.js`, which the queue had not named.

**Checks.** One new module, `tests/pixelfloors.js` (195 lines), registered beside
the other census checks because it reads source text and draws no frame.

- `every-pixel-floor-under-tests-is-a-fraction-of-the-buffer-or-says-why-not`
  scans the source of every check module the page loaded - the Resource Timing
  list, as F13's bans do, never a guess at the import graph - and matches a
  count-ish name compared against a bare integer. **It is built on F13's model
  rather than a comment convention**: the fixed floor is the default-illegal
  thing, every allowance is named in a table with its reason, and the check fails
  on a new floor **and fails when an allowance goes stale**, because an exemption
  for something that has gone is one the next line inherits without arguing.
  A comment convention would let the next fixed floor be written with the magic
  words above it and read by nobody.

**Three things found in the building of it.**

**It was proved rather than assumed.** One floor was reverted to its absolute
form and the check named `src/tests/visual.js:276` with the number and the fix to
apply. Then restored. A census that has never been seen to fail is a census
nobody should trust.

**And it caught itself.** That same run also flagged `src/tests/pixelfloors.js:58`
- its own instrument string, `'if (diff.count < 5000) {'`, written as a literal.
Which is correct behaviour and a hole in the design: a census that cannot survive
describing its own subject has to either excuse its own file or stop spelling the
subject out. `donedef.js` has exactly this problem with `Math.random` and solves
it the second way, reading the call's name back off its own regex, so the number
is interpolated here now and this file is scanned like every other.

**The pattern is exercised every run, because this check fails quiet.** If
`FLOORS` ever matched nothing - a typo, a dropped flag, somebody tidying the
character class - the census would report *zero absolute floors* and pass, which
is the answer it gives when everything is correct. So it runs the pattern against
a line that must match and a line that must not, the second being the scaled form
the H30 fix produced. F8's instrument clause is the model, and H28's wall check is
the cautionary tale: an instrument nobody checks is an instrument that goes blind
without saying so.

**What was verified.** `npm run suite`, two runs per map on the finished tree:
**plant 211 passed / 1 failed / 8 not for this map (1,034,863ms and 1,026,224ms),
yard 191 / 1 / 28 (723,021ms and 719,414ms), exit 0, 0 red, 0 flaky, 0 console
errors, 0 context losses, 0 loop frames, 0 skips withheld, 0 unexpectedly
green.** One more per map than H29's pair (210 and 190), which is this job's one
check, and both runs of each map agree exactly on every count. The pairs agree
within **8,639ms on the plant (1%) and 3,607ms on the yard (0%)**; the tails were
448,548ms and 444,812ms on the plant, 333,774ms and 334,621ms on the yard.

Before the verify, the new check was run on its own on both maps and the three
checks it most directly affects were run with it; the legibility and presentation
floors it rewrote are exercised by the full pass.

**And the `AudioContext` error did not appear this time**, which makes the
standing tally **two of the last four verifies** (H27 yard, H28 none, H29 plant,
H30 none). That is the shape of something intermittent and environmental rather
than a defect in a code path, but it is explicitly *not* closed - H28 called it
closed after one clean verify and H29 brought it straight back. **H32** holds it
and says what a cold run would have to be.

**What was left.** **H31** (S) is next and is the more interesting of the two
things H29 and H30 both point at: the two figure checks assert a 1.5x
hood-over-neck ratio on a band that is **three rows deep** at the pinned
resolution, where the neck measured 5px and 6px across runs against a hood of
10px - so a third reading of 7px would be 1.43x and red. Both are green and have
been on every run on record, so it is a margin nobody has measured rather than a
defect. The deeper option H31 now names is to take the neck as a **fixed number of
rows** below the hood rather than a fraction of the height, which would stop the
band moving at all - a change to a helper two shipped checks depend on, and the
reason it is not an XS. Then **H32** (the `AudioContext` error), **H25** and
**H11**.

## H31 — what the neck actually does, and the breath that moves it (2026-10-06 17:00, scheduled run)

**What it was handed.** Two shipped checks assert that the Shade's hood is 1.5x
the neck under it, where the neck is the narrowest row of a band 14% to 22% of
the silhouette's height — three rows on the 40-row body the reference buffer
draws at 25m. H29 had seen the same body read a neck of 5px and of 6px in
different runs, against a hood of 10, so a third reading of 7px would be 1.43x
and red. Both checks were green and had been on every run on record, so this
was never a defect: it was a clause running on a margin nobody had measured.
The queue was explicit about the order — **measure before touching either** —
and offered three outcomes: a comment if the neck is stable at 5-6, a
replacement clause if it reaches 7, or the deeper change of taking the neck as a
fixed number of rows.

**The measurement, which is the job.** Three runs per map of the two figure
checks plus a new one that sweeps the breath, read through `--details` because
**a passing check's numbers are not in the report at all** (TRAPS.md). At the
reference buffer, face-on at 25m, 48 phase readings across six runs on both
maps (and 96 by the end of the verify, which agreed without moving a pixel):

| | |
|---|---|
| the hood | **10px in every one of the 48** |
| the neck | **4, 5 or 6px — never 7**, so `hood/neck` ran 1.67x to 2.50x |
| worst case | **1.67x** against the 1.5x bar, in all six runs, to the digit |
| the body | 39, 40 or 41 rows by 12 columns |

The two shipped checks agree, read six times each at the same buffer: the hooded
figure check read the 25m neck at 5, 6, 6, 6, 5, 6 and the told-apart check at
6, 6, 5, 6, 6, 6 — **5 or 6, never 7**. At 8m the same clause has no margin
problem at all: a hood of 28px over a neck of 12, 13, 12, 12, 12 and 10, which
is 2.15x at worst.

**So the answer is the first of the queue's three: a comment, not an edit.** The
clause is calibrated rather than lucky, and `HOOD_OVER_NECK` now carries the
measurement at its own line.

**What moves the reading, and it is not what anybody thought.** The Shade
breathes standing still — `POSE.breath` lifts the torso **4cm at 0.9 rad/s**, a
6.98s cycle — and `updateVisual` runs on the **wall clock from the render
frame**, never from `fixedStep`. `Agent.reset()` deliberately does not zero
`_breathTime`, which is right (a reinserted body keeps breathing), so **the
phase a check reads is a function of how many frames the whole run drew before
it.** At 25m on this buffer the Shade is forty rows tall for 1.8 metres: a row
is about 4.5cm and the breath is most of one. That is why a subset and a full
suite disagree, why two runs of one suite can disagree, and why eight isolated
runs agreed with each other — they arrived at similar phases.

**And it corrects D64's stated cause, which was arithmetically wrong.** D64
explained H29's 8/4 against 8/6 by saying the band is *two rows* at 30 rows and
that the measured height moving from 31 to 30 slid those rows onto the
shoulders. `band()` says otherwise, and it is worth checking rather than
believing: at **30 rows the band is three rows at offsets 5, 6, 7 from the top,
and at 31 rows it is the same three offsets.** The pair D64 quotes for the
smallest buffer, 24 and 23 rows, is likewise offsets 4 and 5 at both. A one-row
change in measured height does not move the band in either pair, because
`band()` measures down from the top row and both ends scale together. The band
*does* change between 39 and 40 rows (it gains offset 6 at 39), but in the
direction that adds a wider hood row, which `narrowest()` ignores.

What actually varies is the body's **sub-pixel** alignment: the breath slides a
4.5cm row of body past the pixel grid, so the narrow part of the neck falls
inside one row or straddles two, and the band — which always contains the
neck's narrowest row at this buffer — returns 4, 5 or 6 for the same neck. That
explains the reference wobble, which is measured here, and it is the strong
inference for the small buffers, where the band arithmetic rules out the stated
cause and H29's instability reproduced in these same six runs: at 956x538 the
ratio ran **1.33x to 2.00x** and at 896x503 **1.00x to 1.50x**, while the
reference read 1.67x six times out of six. **D64's conclusion stands and is
reinforced** — the ratio is not meaningful below the reference and nothing
asserts it there. Only its explanation of its own numbers changes. **D66.**

**Why the deeper option was measured and refused.** The queue's third outcome
was to take the neck as a fixed number of rows below the hood, "which would stop
the band moving at all". The band is not what is moving. A fixed row count would
leave the 4/5/6 variation exactly where it is, because that variation happens
*inside* one row, and it would cost a change to a helper two shipped checks
depend on. It is in the comment at `HOOD_OVER_NECK` so the next reader does not
re-derive it.

**The second clause nobody had noticed, on the same band and the same margin.**
`HOOD_OVER_ALL_BELOW` requires the hood to be at least 0.9 of the widest row of
the neck band. Over the same 48 readings that row was 8, 9 or 10px against a
hood of 10, so the clause read **exactly 1.00 at worst** — the same 11% as the
ratio, and thinner in character: a band row of 11px still passes by a tenth of a
pixel and 12px, the body's full width, would fail. It never reaches a 12px row
here because the band stops at the ninth or tenth row from the top. It is
asserted at the worst phase alongside the ratio, and the measurement is at its
line too.

**The check.** One new module, `src/tests/breath.js` (191 lines), registered
beside the figure checks.

- `the-hood-holds-its-ratio-at-every-phase-of-the-breath` stands the Shade at
  the figure checks' own stand, face-on to their own 25m eye, on their own
  pinned reference buffer, and then **advances the breath an eighth of a cycle
  at a time through `updateVisual` at the fixed step** — the way a frame
  advances it, so the eased pose lags as it really does rather than being
  teleported to a phase. It asserts both of the band's clauses at the **worst**
  of the eight phases, which is a claim neither shipped check makes: each of
  those takes the one reading its own arrival gave it.
- It would fail if the job were reverted in the sense that matters: the clause
  it holds did not exist, and the quantity it bounds was unbounded.
- **It is not flaky although its first sample is arbitrary.** Eight samples
  cover one cycle from wherever the run came in, so the set of phases rotates
  between runs. That would matter if the worst value were rare; a 6px neck came
  up in six or seven of the eight samples in every run, so the maximum is hit
  many times over whatever the rotation. Six runs read a worst case of 1.67x and
  1.00 to the digit while the individual phases moved.
- It reads `flatShadeSilhouette`, `silhouetteFloor`, `yawToward`,
  `HOOD_OVER_NECK` and `HOOD_OVER_ALL_BELOW` from `figure.js` rather than copies,
  and the breath's period from `POSE` rather than from two constants written
  again. `figure.js` gained a `profile` on its silhouette record — every row's
  width, top first — so a check can print **where the bands actually fell**
  instead of only what they returned. That is what made the sub-pixel reading
  legible: `40|4689aa8869aaa|10/6-9` is a whole phase in twenty-two characters,
  which matters because a detail line is cut at 400 with no ellipsis.
- No `glSync`: it reads the buffer the figure checks just read, at the same
  pixel ratio, so nothing is resized and no pipeline is built.
- Cost: **19.9s on the plant, 16.2s on the yard**, against 23s and 18s for the
  hooded-figure check beside it.

**What was not done, with the reason.** The obvious alternative to sweeping the
phase is to **anchor** it — zero `_breathTime` in `Agent.reset()` so every check
reads the same phase. It was refused twice over: it would change what a
reinserted body looks like for a fraction of a second, which is a presentational
decision this job did not need to take; and it would buy stability without
buying coverage, since a player sees every phase of the breath and a clause that
holds at one chosen phase is still a clause nobody has bounded. Sweeping is the
stronger claim and it needs nothing outside `src/tests/`.

**The gate, which was lost, and the trap that is now written down.** This run's
gate was started as `npm run suite -- --runs 1 2>&1 | tail -60` in the
background with a **15-minute** limit on a **35-minute** gate. At fifteen
minutes the tool killed the wrapper and the pipeline with it, and because `tail`
buffers to the end there was no partial output: forty minutes of work with no
verdict. The runner itself behaved exactly as F10 promises — it ran to
completion and tore its own Chrome tree down, and `node.exe` and the headless
Chrome processes were both confirmed gone afterwards. `src/`, `scripts/` and
`package.json` are **byte-identical** to the tree H30's VERIFY proved this
morning (`git diff 4a977a2 HEAD -- src/ scripts/ package.json` is empty), so
that two-run-per-map pass stands as this job's gate exactly as step 8 of the
protocol intends, and the VERIFY below is the load-bearing reading. Two rules
are in `TRAPS.md`: **redirect, never pipe**, and set the background `timeout`
above the longest the run could take. Also recorded there: `tasklist /FI "PID eq
N" | grep N` from the Bash tool reported a live process as exited, and
`Wait-Process -Id N -Timeout <s>` is the one that answers.

**What was verified.** `npm run suite`, two runs per map on the finished tree:
**plant 212 passed / 1 failed / 8 not for this map (1,062,214ms and
1,049,942ms), yard 192 / 1 / 28 (730,789ms and 724,018ms), exit 0, 0 red, **0
flaky**, 0 unexpectedly green, **0 console errors**, 0 context losses, 0 loop
frames, 0 skips withheld, 0 re-runs, and no other runner on the machine.** Both
runs of each map agree exactly on every count, and each map is one check up on
H30's pair (211 and 191) — this job's. The one failure on each is the
frame-budget check, skipped headless, with its reason in `suite-skips.json`.
Run-pair spreads: **plant 12,272ms (1% of the longer), yard 6,771ms (1%)**, and
the pipeline tails were 452,727ms and 446,276ms on the plant, 332,320ms and
327,726ms on the yard — a little over **40% of each run is the renderer's tail
and not work** (F11, D48), which is the only way to read those totals. Auto
would have picked `medium` on both maps this time (5.00ms median over 9 samples
on the plant, 4.70ms over 32 on the yard), where H10's verify had the plant at
8.70ms picking `low`: one machine, several answers, which is **H25**.

**And the new check's own numbers are the result.** Across the four verify runs
its worst phase read **1.67x and over-below 1.00 in all four, to the digit**,
while the best phase moved 2.50x / 1.67x / 2.00x / 2.50x. That is the stability
claim proved in full-suite context, which is precisely what H29's check could
not do — and the reason is in the distribution. Over all **96 phase readings
this job took (twelve runs of the check, both maps: six subset runs, two
confirming runs and the four of the verify)** the hood was **10px in every one**
and the neck was 6px in 71, 5px in 19 and 4px in 6 — **never 7**. The worst
value is the *common* one, so eight samples hit it many times over whatever
phase the run came in at. The clause was settled on the first 48 of those, and
the verify's own 32 agreed without moving a pixel.

**One console-error data point, for H32 and not for this job.** Zero on both
maps. The `AudioContext` device error now stands at **two of the last five
verifies** (H27 yard, H28 none, H29 plant, H30 none, H31 none). H32 is unchanged
by this and should stay queued as written: an intermittent fault is not closed
by absences — that is the exact mistake H28's entry made after one of them — and
three clean verifies in a row is still not the cold-run test H32 defines.

**One thing to know about this verify's own standing.** `donedef.js` fetches
`PLAYTEST.md`, `HANDOFF.md` and `TRAPS.md` **at the moment its checks run**, so
editing those three mid-run is the same hazard as editing `src/` mid-run. All of
this job's document edits landed within the first five minutes of a sixty-minute
run and those checks register late in the suite, so every run read the settled
text — and the empty `flaky` list is the evidence rather than the assumption,
since two runs reading two different documents is exactly what it would report.
`src/` was untouched from the moment the verify started. The protocol already
has every job write its `PROGRESS.md` entry *after* its verify, so a document
edit after a verify is the normal case; the thing to avoid is editing one in the
middle, and that is worth knowing before the next job does it on purpose.

**What was left.** **H32** (S) is next, the `AudioContext` console error, which
H28 called closed one verify too early; this run's console-error count is one
more data point for it. Then **H25** and **H11**. Nothing here is blocked.
Two follow-ups the work revealed are in `QUEUE.md`: **H33**, the other checks
that read a posed body at whatever phase the run arrived in — `tests/look.js`,
`tests/animation.js` and `tests/smallwindow.js` all pose and read once, and
whether any of their clauses is near a margin is unmeasured; and **H34**, the
8m half of the hooded-figure clause, whose neck read 10 to 13px across six runs
— a 30% spread against the 25m reading's 20%, on a band ten rows deep, which is
a wider variation than the thin end of the same check and nobody knows why.

## H32 — the AudioContext error: the code side closed, and the test was the gate all along (2026-10-06 17:00, scheduled run)

**What it was handed.** *"The AudioContext encountered an error from the audio
device or the WebAudio renderer."* - one console error per run pair, in two of
the six verifies on record. H27 reported it, argued it was environmental and
said it would be a defect if it recurred **on a cold run**. H28 saw none and
wrote *"that closes it as the machine."* H29 brought it straight back and had to
retract H28's sentence. So the queue stopped asking for a verdict and asked for
a definition: *"What nobody has done is define the test. Do that"* - plus one
cheap code-side hypothesis to check, whether the audio graph can be built more
than once per page, because a second device context where Chrome has no audio is
exactly this message.

**The code side is closed, and the hypothesis is false.**

| | |
|---|---|
| realtime contexts per page | **one.** `AudioSystem.unlock()` returns `this.context` when one exists |
| modules in `src/` that name the realtime constructor | **one** - `src/systems/audio.js`, on **3 lines of 163 modules scanned** |
| offline contexts a run builds | **seventeen** - sixteen sounds in `tests/soak.js`, the scuff in `tests/scuff.js` |
| offline renders that have ever failed | **none, in any run on record** |
| the live context, measured | **running, 48000Hz**, on both maps |

The second row is the one that needed building: `unlock()`'s guard cannot see a
*different* module reaching for the constructor, and a new system wanting a
sound of its own would do it in one line. So it is a ban with one named owner
now, on F13's model and H30's - red on a new namer **and** red if
`systems/audio.js` ever stops being one, because an allowance for something that
has moved is an allowance the next line inherits without arguing.

The third and fourth rows rule out the *other* half of the message by arithmetic
already on the record. *"or the WebAudio renderer"* - an `OfflineAudioContext`
**is** a WebAudio renderer, and a run builds seventeen of them. Every one has
rendered correct samples in every run ever recorded; a renderer that errored
would have failed a render and turned
`every-sound-renders-to-samples-that-match-section-14` red, and it never has
been. One live context and seventeen correct offline ones leaves the device.

**And one correction to H27, which is the sort of thing worth measuring rather
than assuming.** H27 argued in part that *"headless Chrome has no audio
device"*. It has one. The new check reads the live context as **running at
48000Hz** on both maps - it is not suspended, not closed, and not failing to
find a sink. So the claim shrinks from "a context with nowhere to go" to "a
device that intermittently errors", which is both smaller and more plausible,
and it is in **D67**.

**What is still unknown, and the finding is that the test has been running twice
a day for weeks.** Whether it ever happens on a **cold** machine. Every single
one of the six observations - H27 yard, H29 plant, and H28, H30, H31 and H32 clean
- is an **end-of-session verify**, taken after an hour or more of driving
headless Chrome. H27 asked for a cold run and nobody noticed that the project
already does one twice a day: **the GATE is a cold run.** It is the first thing
every scheduled session does, on a machine that has been idle, and **no session
has ever written down its console-error count** - the gate's numbers are read
for red and flaky and then discarded, while `PROGRESS.md` and `HANDOFF.md` record
only the verify.

So the test is now defined and costs nothing: `HANDOFF.md` asks every run to put
its gate's console-error count into its entry, and **H35** closes the question
on three of them rather than on another guess. H35 also says, in as many words,
not to be started early - three gates is three runs, and picking it up sooner
would produce exactly the premature "that closes it" that H28 wrote.

**Two changes make the next occurrence worth more than these five were.**

- The runner **stamps every console error with the map, the run and how many
  seconds into it the error arrived.** A device error arrives asynchronously
  from Chrome's audio service with no stack of its own and is attributed to the
  page URL, so the Node end is the only thing that knows where the suite was;
  until now two occurrences could not be placed beyond "somewhere in that pair".
- The summary **prints the messages** instead of only the count. `HANDOFF.md`
  has told every run for weeks that *a new console error is a defect even when
  every check passes*, while reading one meant parsing the JSON report - which
  is how the first two came to be written off by sessions that had seen a number
  and not a sentence.

**Both were proved rather than assumed**, because an error path nothing has
exercised is not an error path. `--pre` injected a `console.error` before the
first run and another twenty seconds into it, and the summary came back with
`[yard run -, before its first run]` and `[yard run 1, 25s in]`. That is F8's
rule applied to plumbing: prove the instrument can see the thing before trusting
it to report the thing's absence.

**The check.** One new module, `src/tests/audiocontext.js` (205 lines),
registered beside the other census checks because it reads source text.

- `one-module-owns-the-audio-device-and-an-offline-render-gives-it-back` holds
  the ban above, and also a thing nothing held before: **an offline render gives
  the live context back by identity.** `renderOffline` swaps the whole graph onto
  a throwaway context and restores it in a `finally` - deliberately, so what is
  measured is what plays rather than a re-implementation of it - and if that
  restore were ever broken, **every sound in the game would stop and no check
  would say so**, because the sixteen sound checks read the offline samples and
  those would still be perfect. The master gain's own context is checked too.
- Its pattern is **built from pieces** so the file does not contain the
  contiguous identifier and the census does not flag itself; H30's check caught
  itself exactly that way and `donedef.js` solves it the same way. It carries the
  must-match / must-not-match pair for the same reason H30's does: **this census
  answers "none" both when it is working and when it is broken**, so the pattern
  is exercised every run on a line that must match and one that must not. The
  line that must not match is the offline constructor, which is the distinction
  the whole check rests on - `\b` before the name is what keeps
  `OfflineAudioContext` out, since the character before its `A` is a word
  character.
- **What it deliberately does not do** is count the realtime contexts the page
  has built. Nothing in a browser exposes that, and the obvious instrument -
  patch the global constructor, build one, count it - would have the test
  creating its own subject, since a spare device context is the exact condition
  under suspicion. The ban plus the idempotence clause next door is the honest
  reach of a test from inside the page; the rest is a cold run, which is not a
  check.

**What was verified.** `npm run suite`, two runs per map on the finished tree:
**plant 213 passed / 1 failed / 8 not for this map (1,056,276ms and
1,063,802ms), yard 193 / 1 / 28 (729,602ms and 745,324ms), exit 0, 0 red, **0
flaky**, 0 unexpectedly green, **0 console errors**, 0 context losses, 0 loop
frames, 0 skips withheld, 0 re-runs, and no other runner on the machine.** Both
runs of each map agree exactly on every count, and each map is one check up on
H31's pair (212 and 192) - this job's. The one failure on each is the
frame-budget check, skipped headless. Auto would have picked `medium` on both
(5.30ms median over 9 samples on the plant, 5.00ms over 32 on the yard).

**And the spread is this run's one thing worth reading.** Plant 7,526ms (1% of
the longer), yard **15,722ms (2%)** - the widest yard spread on record, and the
reason is in the line beside it: the yard's **pipeline-wait** spread is
17,077ms, which is *larger than the whole run spread*. So the work did not move
and the renderer's tail did, which is precisely what F16 put that line there to
let a reader see. The tails were 456,581ms and 457,998ms on the plant, 326,473ms
and 343,550ms on the yard - a little over 40% of every run.

**And the gate's own count, which is the thing this job asks every run for from
now on: this run has no gate reading.** H31 lost it to a background timeout
shorter than the gate, H32 ran under H31's verify as its gate by step 8, and so
the first entry in the record H35 needs will be the next run's. That is an
unsatisfying start to a census this job created, and it is written down rather
than quietly skipped: the three gates H35 waits for are the next three runs',
not this one's.

**What the new check reads**, identically on both maps and in all four runs:
*163 modules under src/ scanned, 1 names the device constructor and it is
src/systems/audio.js (3 lines); 3 modules name the offline one, which opens no
device; the live context is running, 48000Hz and is the same object after
rendering a sound offline.*

**And the error did not appear**, which is the third clean verify in a row (H30,
H31, H32) and the reason the tally is now **two of six**. It changes nothing:
three absences are the exact shape of evidence H28 mistook for a closure after
one, and all six observations are still end-of-session verifies. The numbers
written into `D67`, `TRAPS.md`, `QUEUE.md` and `PLAYTEST.md` earlier in this job
said *five*, and were corrected to six after this verify rather than left to
rot - a stale count is the whole thing this job exists to stop people reasoning
from.

**One judgement, and it is D67.** A console error is counted and now printed,
and it still **does not fail the gate**. Making it fail was considered and
refused with a number: **this error would have failed two of the last six
verifies**, both of which were correct runs of a correct game, and a gate that
goes red on the machine's audio service stops the project twice a week over
something no player will ever meet. The narrower version - fail only on an error
attributed to a file in `src/` - is better and still buys nothing today, because
both occurrences are attributed to the page URL and would pass it. D67 has it
either way for Josh to overturn.

**What was left.** **H25** (S) is next: auto's pick depends on which map a
friend opens first and is then stored for good. Then **H11** (`npm run bench`,
M), then H31's and H32's follow-ups **H33**, **H34** and **H35**. Nothing in
Block H is blocked on Josh. `TRAPS.md` carries the standing account of this
error so that the next reader does not re-litigate it from the count alone,
which is the thing that has now happened twice.

## H25 — auto remembers the lowest, and the summary was hiding the evidence (2026-10-06 17:00, scheduled run)

**What it was handed.** H10's verify had measured the same machine twice -
**8.70ms median CPU on the plant, which picks `low`**, and **5.30ms on the yard,
which picks `medium`** - and the queue had read what that implies: the probe is
a reading about this machine **times this scene**, the plant being the heavier
of the two. The storing rule was *write the pick if nothing is stored yet*
(`SETTINGS.qualityAuto === null`, the first boot that answers), so **whichever
map a friend happened to open first decided their quality for the life of that
browser.** Open the yard, get `medium`, then play the plant at a level that
machine cannot hold until you clear your site data or find the settings row.

**Taken: keep the lower of what is stored and what was just picked.** One
exported function, `rememberedPick(stored, picked)` in `quality.js`, and
`sampleQualityFrame` stores through it. It is the only rule that is safe in both
orders - the easier scene cannot raise the level, the heavier one brings it down
- and the **preset table's own order** decides which is lower, so a fourth
preset is ordered by where it is slotted into `CONFIG.quality.presets` rather
than by a list somebody forgot to update. A stored value the table does not
recognise is treated as nothing stored rather than compared against, which
matters because H7's store validates a key by type and not by range and a
hand-edited `"ultra"` gets this far - that is **H21**, still open, and this is
one place it would have bitten.

**The cost is real and is in D68 rather than buried.** The level now only ever
goes **down** on its own. A machine that was briefly busy - a download, a
compile, another game still shutting down - is measured as slower than it is and
remembers that for good. One click on the settings row fixes it, and `auto` is a
starting guess rather than a promise, so an honest `low` beats an optimistic
`medium`; but it is an asymmetry and Josh may want the other side of it. The two
alternatives are argued there and refused: **a pick per map** is more faithful
and more record than the problem is worth (two keys, a migration, and a player
who cannot say what their quality *is*), and **letting it drift back up** is the
honest answer to the transient-load cost but is a feature - it needs a history,
a rule for how many agreeing readings count, and a decision about whether
raising somebody's level mid-session is welcome.

**And the second half of the done-when turned out to be a one-word bug, which is
the part worth remembering.** The queue asked that *"the runner's summary names
both"*. It named one: the loop over `r.runs` printing the quality line
**`break`ed after the first run**, so a two-map suite printed the plant's probe
and silently dropped the yard's. The disagreement between two maps on one
machine - the entire defect this job exists to fix - sat invisible for a month
in the output every session reads, while `HANDOFF.md` dutifully quoted the
single number it was shown. One line per map now, and the confirming run shows
it: *plant ... auto would pick medium (5.10ms over 8 frames)*, *yard ... auto
would pick medium (4.80ms over 14 frames)*. It is in `TRAPS.md` as the general
lesson, because the whole value of two readings is in their difference and a
loop that stops at the first still looks like it reported something.

**The check.** One new module, `src/tests/autopick.js` (185 lines) - its own
rather than a block in `tests/quality.js`, which is at 544 lines and would have
gone past the ~600 the spec allows.

- `a-second-maps-probe-cannot-raise-the-level-the-first-one-stored` feeds **two
  real probes two different medians** (33.33ms picks `low`, 2.08ms picks `high`,
  both derived from the constants the probe itself reads rather than typed
  beside the threshold), **proves they pick differently before leaning on them**
  (F8: if both picked the same level every clause below would be comparing a
  thing with itself, and the check says so and stops), then holds the rule in
  **both orders** and over **every one of the nine pairs** in the preset table
  rather than three hand-picked cases.
- **The clause that makes the job revert-detectable** reads `quality.js` and
  requires the storing path to go through the rule **and the old first-boot
  guard to be gone**. A pure function nobody calls is decoration - H27's
  `rng.calls` froze at zero behind an object spread and no check noticed,
  because nothing asserted the field.
- **What it deliberately does not do**, and the reason is worth keeping: it does
  not complete a synthetic probe through `sampleQualityFrame`. That would
  overwrite `state.probe`, which the headless runner's **run record** carries
  and which `HANDOFF.md` quotes as *what auto would have picked* - so the report
  would then lie about this machine, which is the exact class of bug H24 found
  in H23's check, where the record named a level the run was not drawing. The
  rule is a pure function, tested as one, and the single line that calls it is
  held by its text.

**What was verified.** `npm run suite`, two runs per map on the finished tree:
**plant 214 passed / 1 failed / 8 not for this map (1,065,586ms and
1,067,175ms), yard 194 / 1 / 28 (730,891ms and 737,424ms), exit 0, 0 red, **0
flaky**, 0 unexpectedly green, **0 console errors**, 0 context losses, 0 loop
frames, 0 skips withheld, 0 re-runs, and no other runner on the machine.** Both
runs of each map agree exactly on every count, and each map is one check up on
H32's pair (213 and 193) - this job's. The one failure on each is the
frame-budget check, skipped headless. The run-pair spreads are the tightest on
record: **plant 1,589ms (0% of the longer), yard 6,533ms (1%)**, with pipeline
tails of 456,149ms and 454,679ms on the plant, 328,689ms and 336,458ms on the
yard.

**And the done-when's second half is proved in the real thing rather than in a
subset.** The summary names both maps now:

```
plant: ... auto would pick medium here (6.50ms median CPU over 9 frames ...)
yard:  ... auto would pick medium here (4.80ms median CPU over 32 frames ...)
```

**One machine, two readings 35% apart, in the output every session reads** -
which is the sentence this job exists to make visible. Both happen to pick
`medium` tonight, so the new rule changes nothing on this machine in this run;
that is what it looks like when a defect is about a *rule* rather than about
today's numbers, and the check holds the rule rather than the numbers.

**The gate's console-error count, which H32 asked every run for: this run still
has none to give.** H25 ran under H32's verify as its gate by step 8, so no
cold run was taken. The record H35 waits for starts with the next session's
gate, and that is now said twice - in H32's entry and here - because a census
nobody feeds is the thing H32 was created out of.

**And the `AudioContext` error did not appear again**, which makes it **two of
seven verifies** and **four clean in a row** (H30, H31, H32, H25). That streak
is now long enough to be tempting, and `TRAPS.md` says in as many words not to
take it: H28 called this closed on one absence and H29 brought it back the same
day. Four absences from end-of-session verifies are four observations of the
same condition, not evidence about a cold machine. The counts in `HANDOFF.md`
and `TRAPS.md` were moved to seven; **D67** was left at six on purpose, because
a decision entry is a snapshot of what was known when it was written and this
project does not edit them.

**What was left.** **H11** (M) is next, `npm run bench` on the real GPU, and it
is a whole run. Then the three follow-ups this week left: **H33** (every other
check that reads a posed body at whatever phase the run arrived in), **H34** (the
8m neck's wider spread) and **H35** (three gates' console-error counts, and it
says not to be started early). H21 is worth reading beside this job: the stored
quality level is exactly the kind of value its range check would have caught,
and `rememberedPick` now defends itself against one case of it.

## H11 — the frame budget on the real GPU, and a list that owes a number (2026-10-07 02:00, scheduled run)

**What it was handed.** `npm run bench`: headed Chrome with the window
off-screen, the frame-budget check and the 92-viewpoint sweep on both maps,
results to `bench/<date>.json`, and "the frame-budget check leaves
`suite-skips.json` for a `bench-only` list it is honest about". Done when a
bench on this PC produces numbers the HANDOFF quotes and `PLAYTEST.md` stops
asking Josh to run it by hand.

**Why it mattered more than it reads.** Every reading in this repo is taken
headless on SwiftShader, which draws a frame in about 400ms, so
`the-frame-budget-holds-everywhere-not-just-at-site-a` has been dropped from
every gate since F5. F15 made the drop *honest* — `scripts/suite-skips.json` is
a census held both ways by a check, not a lever — but honest about the wrong
thing. **A skip says "this machine cannot run this", and then nobody owes an
answer.** `PLAYTEST.md` asked Josh to press F4 then Y and read one line; for a
month nobody did; and the project's only statement about its own performance
was a CPU number from a software rasteriser, with `HANDOFF.md` saying in as
many words that it "says there is room, not what a real GPU does with it".

### What was built

`scripts/bench.mjs` (321 lines), `scripts/bench-checks.json`,
`src/tests/benchlist.js` (235 lines), plus readers in
`scripts/suitereport.mjs` and one line in `package.json`.

**Two lists instead of one, because they are two claims.**
`scripts/suite-skips.json` keeps its meaning and is now `[]`;
`scripts/bench-checks.json` carries the new one — *`npm run bench` runs this
check instead, headed, on the real GPU, and the number is in
`bench/<date>.json`*. **One file, two readers**: `bench.mjs` runs what it names
and `suitereport.mjs` drops what it names, so the bench cannot drift from the
gate. `judge()` files a bench-only id under `benched` with the outcome it got
*here* (the frame budget reads `fail` under software GL, and a reader should
see that the number is being set aside rather than that nobody ran it), and
honours the drop only where `BENCH_GUARD` passed on that map — F15's
fail-closed rule, applied to the second list.

**Three honesty clauses in the runner**, because a bench that lies is worse
than no bench. It **refuses to bench software**: if the unmasked renderer names
SwiftShader or a software rasteriser it writes nothing and exits 2, because
that is the gate's own number wearing the word bench. It **refuses to run
beside a live `suite.mjs`** (`otherRunners()`, F10's reader), because a frame
timed beside half an hour of all-core software rasterising is a reading about a
busy machine and nothing in the number would say so. And it **runs exactly what
the list names**, with no id of its own.

Headed and not headless-with-the-GPU on purpose: a headless Chrome has no
window and so no swap chain, and whether it uses the GPU at all has changed
between Chrome versions more than once. No `--ignore-gpu-blocklist` either — if
Chrome refuses this card, a friend's Chrome refuses it too, and the bench
should say so rather than override it. Three backgrounding switches are passed
because Chrome throttles a window it believes nobody can see, which would be an
artefact of the window being off the desktop rather than anything about the
game; nothing here draws through rAF, so no vsync flag is needed. The viewport
is pinned to the suite's 1280x720 so a number here sits beside a number there.

### The answer

`NVIDIA GeForce GTX 1060 6GB` through ANGLE/D3D11, on an i7-2600. Twelve
readings — both maps, `low`/`medium`/`high`, two runs twenty minutes apart on a
byte-identical tree. **Every one green. The frame budget holds everywhere, 3x
to 6x under its ceiling.**

| | plant low | plant medium | plant high | yard low | yard medium | yard high |
|---|---|---|---|---|---|---|
| sweep, mean draw | 1.32 / 1.27 | 1.75 / 1.72 | 1.71 / 1.83 | 1.12 / 1.14 | 1.59 / 1.69 | 1.59 / 1.72 |
| sweep, worst | 1.90 / 1.90 | **5.50** / 2.60 | 2.60 / **4.60** | 3.00 / 2.60 | 3.00 / 3.10 | 3.00 / 3.90 |
| check 29, CPU median | 1.50 / 1.50 | 2.00 / 2.00 | 2.00 / 2.00 | 0.90 / 0.90 | 1.30 / 1.40 | 1.30 / 1.40 |
| check 29, GPU | 1.60 / 1.59 | 2.01 / 2.01 | 2.08 / 2.04 | 1.00 / 0.98 | 1.39 / 1.44 | 1.36 / 1.45 |

(milliseconds, run 1 / run 2, against an **8.33ms** draw ceiling and a
**16.67ms** whole-frame budget. 92 viewpoints across 23 places on the plant, 96
across 24 on the yard. Peak 387 draw calls against a 600 cap, 10,950
triangles.) **The GPU timer worked for the first time** —
`EXT_disjoint_timer_query_webgl2` needs a real driver, so until now
`performance.js` had always taken its `no GPU timer` branch and the project had
no GPU milliseconds at all.

### Three findings the budget was not the point of

**`high` is nearly free on this card.** Mean draw 1.71ms at `high` against
1.75ms at `medium` on the plant; check 29 costs 2.08ms of GPU against 2.01ms.
`high` doubles the shadow map and supersamples at 1.25x and it is inside the
noise. So on hardware like this the quality row is not a performance decision,
which is a line under **D60** that nobody could write before.

**`auto` picks `high` here, and the two maps agree.** The probe read 3.2, 4.0
and 4.1ms on the plant and 3.4, 3.8 and 3.7ms on the yard, all over forty
samples, against the 8.33ms a CPU frame is allowed. The same probe under
software GL reads **8.70ms on the plant and 5.30ms on the yard** — the 3.4ms
disagreement **D68** is about. Here it is 0.2ms. So the gap's *size* is largely
an artefact of the renderer the gate runs on; its *mechanism* — the probe
measures the machine times the scene — is real, and H25's `rememberedPick`
stands, because a weaker machine would still straddle a threshold the way this
one does not.

**The "worst viewpoint" does not reproduce, and the mean does.** The means
agree to **0.12ms** in all six scenes. The worst moved **5.50ms → 2.60ms** at
`medium` and **2.60ms → 4.60ms** at `high`, and named a different place on the
map in five of six scenes. The sweep does one untimed draw then times **one**
frame per viewpoint, so the worst is a single sample and a scheduling hiccup is
indistinguishable from a hot corner — and the worst is what the clause asserts.
It does not matter on this GPU, where nothing came within 1.5x of its ceiling,
which is exactly why it is worth settling before it does: on a weaker machine a
one-sample worst is what decides the check, and a check whose verdict is one
frame is the flaky shape this project calls a bug in the check. That is **H36**,
and it carries H31's rule — measure what N makes the worst reproduce before
touching the clause, and do not take the mean on its own, because a map with
one unaffordable corner and ninety-one cheap ones passes on a mean.

### The check, and proving it load-bearing

`the-bench-only-list-holds-only-checks-the-bench-itself-runs` in
`tests/benchlist.js` — a census on F15's model, held to a stronger standard
than the skip list's because the claim is stronger. Every entry must be
declared there with the same `benchOnly` boolean, be a check some module
registers, carry a reason of 80+ characters that **names hardware** *and*
**names `npm run bench`** (so a reader of the gate's output can find the
number), and be absent from `suite-skips.json` — one exemption, one home, or
the two reasons eventually disagree. Then the honest half, which is what the
queue's "honest about it" had to mean: `bench.mjs` must read the file, and
**must not name any of the ids in its own code**, so what it runs cannot drift
from what the gate dropped; `suitereport.mjs` must read the same file; and
`package.json` must really have the command, because a bench-only list with no
`npm run bench` behind it is the exemption without the number.

Code or prose is decided **line-locally**, as `donedef.js` decides it for the
two spec bans: an id on a line beginning `//`, `/*` or `*` is prose. That is
deliberate — `bench.mjs`'s own doc comment names the frame-budget check,
because a reader of that file should be told what it is for.

**Proved by breaking both novel clauses at once** and watching it name each:
flipping `benchOnly` to `false` in the file and adding one line of code to
`bench.mjs` holding the id produced *"benchOnly=false in the file and true
here; scripts/bench.mjs:83 names ... in code"*. It named line 83, the line
added, and left the same id in that file's doc comment alone.

`skiplist.js` keeps its job over an empty file — the comparison runs both ways,
so a new skip is still an edit there — and its detail line says so in words
now rather than printing empty parentheses.

### What was verified

**GATE** (`--runs 1`, HEAD `e95fe4b`, cold): **OK**, plant 214 passed / 1
failed, yard 194 passed / 1 failed — the one being the frame-budget check,
skipped — 0 red, 0 flaky, **0 console errors**, no `OTHER RUNNERS ALIVE`. For
**H35**'s census: **this gate's console-error count is 0**, the first cold-run
count ever written down, and the `AudioContext` error did not appear.

Two readings from that gate are worth keeping. It recorded `auto would pick low
here (215.40ms median CPU over 8 frames)` on the plant, against 5.90ms from a
three-check subset twenty minutes later on the same tree and 4.0ms from the
real GPU. 215ms is a reading about whatever else was starting on this machine
while the page booted, taken over eight frames; the plant run's 1,078s against
the 963s on record is the same fact. Both are now in `TRAPS.md`, because a
probe median from a cold gate is not comparable with one from anywhere else.

### What was left

**H36** (the worst viewpoint is one frame) and **H37** (the weekly audit says
how old the bench is — D69's refused alternative, moved to where a
calendar-shaped question belongs). **D69** records the one judgement: a stale
bench *prints* rather than reds, and the cost is that the gate can say OK
beside a real-GPU number belonging to a different commit. Of the earlier
follow-ups, **H33** (every other check that reads a posed body at whatever
phase the run arrived in) is next, then **H34**; **H35** now has one of its
three gates.

## H33 — two phases survive a reset, and the census of what they reach (2026-10-07 02:00, scheduled run)

**What it was handed.** H31 found the mechanism behind a reading that moved
between two runs of one suite - `updateVisual` runs on the **wall clock from
the render frame**, never from `fixedStep`, and `Agent.reset()` deliberately
leaves `_breathTime` alone - and fixed one instance of it. The queue asked for
the rest: *which other checks read a posed body at whatever phase the run
arrived in, what is each one's thinnest clause, what does that clause read at
the phase it happens to get, and can a whole breath move it.* It said, twice,
**do the census, not the fix**, and pointed at D66 for the cheap global
alternative already refused with reasons.

**Three things came out of it, and the first was not in the queue.**

### One: there are two phases, not one

`_animTime`, the gait, has **exactly the same property**. It is advanced inside
`updateVisual` (by the ground covered, so only while the body walks), it is
zeroed in the constructor at `agent.js:156` and **`reset()` clears neither** -
`reset()` does clear `_dip`, `_dipKick`, `_dipVel` and `_smoothPosition`, so
the two phases are a deliberate exception rather than a reset that does
nothing.

And it is the **bigger lever of the two**. Over eight phases the breath moves a
pixel count by 1-3%; the gait moves
`a-look-at-a-pose-photographs-the-state-named`'s walk and sprint frames by
**24%** - 7,891 to 9,818px and 8,065 to 9,788px, in a strict alternation,
against a floor of 3,000 - because a leg at the top of its swing is a different
silhouette from a leg under the body. Every other pose in that check moved 1-5%.
The gait is also the harder of the two to reason about: a clock advances
whatever the run does, where the gait advances only while something walked, so
its value at any check is a function of how much walking the whole run did
before it.

### Two: the numbers, and one clause that spends real margin

Eight entry phases of the 6.98s breath, set by advancing the body the way a
frame advances it, with each check then run through the registry exactly as the
suite runs it. **Everything passed at every phase on both maps**; what follows
is how much room each has.

| check | what moves over a breath | against |
|---|---|---|
| `figure.js` 8m | count 2,996-3,089 · aspect 3.5-3.6 · **neck 10, 11 or 12px under a 28px hood** | floor 2,000 · 2.2 · **2.33x of 1.5x** |
| `figure.js` 25m | count 345-359 · aspect 3.3-3.4 · neck 4-6px under a 10px hood | floor 150 · 2.2 · 1.67x of 1.5x, **held by breath.js** |
| `told-apart` | the Shade's half only; the Warden held **to the pixel at all eight** | 1.44x to 1.5x |
| `smallwindow.js` | count 116-121 and aspect 2.9-3.0 at the smallest buffer | floor 51 · 2.2 |
| `look.js` five eyes | every count by 1.1%; thinnest eye 877-887px | floor 300 |
| `look.js` poses | **the gait**, 24% on walk and sprint; 1-5% elsewhere | floor 3,000 |
| `bufferscale.js` | each count by 3.3%, but the law is a **ratio between** them, so the common part cancels: 1.7% of spread | 10% tolerance |
| `hang.js` | **-0.021m to +0.055m, a span of 0.075m** | **0.15m tolerance** |

**`hang.js` is the one, and the first instrument could not see it.** The census
started as a diff of the numbers in each check's own detail line across the
eight phases, which is cheap and covers every reported quantity - and it came
back `1 numbers, 0 moved` for `a-hang-is-at-full-stretch-under-the-lip`,
because **a passing check's numbers are not in its detail line at all**
(TRAPS.md, and H29 recorded the same thing). Reading the module found the
clause by eye: `|gloveY - lip| <= 0.15m`, where `gloveY` is the **world**
position of a mesh hanging off an arm inside the body group the breath lifts.
Measured directly with hang.js's own helpers, the offset ran **-0.021m to
+0.055m across eight phases** with the lift delivering its full ±0.037m at the
read. So **the breath sweeps half the tolerance**, and the worst phase sits at
2.75x of it. It passes everywhere today and wants nothing done - but it was
unbounded, which is exactly the state the two figure clauses were in before
H31. **H38** proposes holding it at the worst phase, with these numbers.

**And H34 is answered from the other end.** H34 asked why the 8m neck varies
30% across runs where the 25m neck varies 20%, calling a better-resolved
measurement varying more in relative terms "the wrong way round". Over one
breath on one tree the 8m neck reads **10, 11 or 12px** and the 25m neck reads
**4, 5 or 6px** - so in relative terms the 8m reading varies **17%** and the
25m one **33%**, which is the right way round after all. H34's puzzle was two
six-sample cross-run spreads at two distances, each sampling six arbitrary
phases of the same cycle; the one reading it has that this sweep never saw is a
13px neck, one count outside a range of three. Its queue item is rewritten to
that single remaining question rather than left as written.

### Three: four reasons a clause cannot be reached, each now proved

The census's useful half is what it rules **out**, and prose would rot:

- **The Warden does not breathe.** `enforcer.js:407` sets `pose.lift` from the
  walk bob, which is zero at a stand. The measurement agreed independently -
  every Warden reading in `told-apart` (554px, 40x26, 1.5:1, helmet 10 over
  shoulders 26, side 41x28, reach 41%) held to the pixel across all eight
  phases.
- **The camera never reads the breath.** Its pivot is
  `_smoothPosition.y - half.y + cam.up + _dip + bob` and `pose.lift` is not in
  it, which is why `camerasettings.js` and `feel.js` are out of reach.
- **The breath is a position, not a rotation.** `animation.js` compares poses
  over eleven rotations with no `lift` among them, and its one world-height
  reading is the rifle hand of a body that does not breathe; `scuff.js` reads
  an arm angle.
- **A difference taken inside the group cancels it**, which is `warden.js`'s
  outline drift.

### The check

`every-check-that-poses-a-body-declares-what-the-breath-and-the-gait-do-to-it`
in `tests/breathcensus.js` (393 lines), on H30's model: a table with reasons,
red on a new entry and red when an entry goes stale. The census criterion is a
grep - a module whose text names `updateVisual` poses a body - so it is
checkable rather than a matter of opinion, read from the registrar's own import
list the way `registry.js` reads it. Both directions: a module that starts
posing a body is red until declared, and a declared module that stops is red
until dropped. **11 modules pose a body: 1 held at the worst phase, 5 measured,
4 out of reach by proof.**

The four reasons are **behavioural clauses, not comments**: a whole breath is
driven through the body and the check requires the torso to ride its 0.080m
while every limb rotation, the camera's world height and the Warden's chest all
hold inside 0.0001m. Each carries the second half HANDOFF.md demands of a check
that picks its own inputs - the camera is first shown to move a full metre when
the body does, the gait is **walked and not merely drawn**, and the Warden's
speed is asserted to be zero, because the bob is zero only at a stand.

**It caught three flaws in itself, which is the whole argument for writing it
this way.** It declared itself (it drives `updateVisual` to prove things *about*
the phases rather than to read a clause off a posed body, so it is excluded by
name and a clause holds that it stays excluded). Its camera clause was
**vacuous**: a metre of body moved the camera 0.000m, because the suite leaves
camera ownership wherever the last check put it, and the control said so before
anybody believed the clause. And its "the body really moved" clause **scaled
with the very constant it was guarding** - at least half of `2 *
POSE.breath.lift` - so zeroing that constant would have satisfied it with a
body that does not breathe and made all four proofs trivially true about a
mechanism that no longer existed. It is pinned absolutely now, to the 0.080m
ride the table's numbers were measured at (**D70**).

Proved load-bearing by breaking both halves at once: dropping `hang.js` from
the table and setting `pose.lift = 0` in `agentvisual.js` produced *"hang.js
poses a body and this census does not declare it; over a whole breath the
Shade's torso moved 0.0000m against the 0.08m this census measured its table
at"*. The check also now holds **D66**'s refusal - `reset()` keeps both phases -
so a job that changes that changes this line in the same diff.

**The scope it does not cover, said plainly.** Twelve more modules read a body
off a frame they rendered rather than posing one, and they inherit the run's
phase too. They are declared in `ALSO_DRAWN` and **none of them is measured**.
That is **H39**, not a claim made here, and the census is red if one of them
appears or disappears so the gap cannot widen quietly.

### What was verified

Its own gate was H11's VERIFY on this branch (protocol step 8).

**VERIFY**: **OK**, plant **216 passed / 1 failed / 8 not for this map**
(1,054,992ms and 1,050,331ms), yard **196 / 1 / 28** (734,857ms and 735,911ms),
exit 0, 0 red, 0 flaky, **0 console errors**, 0 context losses, 0 loop frames,
and both runs of each map agreeing exactly on every count. One more check per
map than H11's pair, which is this census. The run-pair spreads are **4,661ms
and 1,054ms, both 0% of the longer and the tightest on record**, against
pipeline waits of 1,415ms and 2,913ms. The census check reads **341 characters**
of detail, under the 400 the report keeps - which it needed two passes to
manage, because the first draft lost the Warden's reading to the silent cut.

### What was left

**H38** (hold hang.js's glove at the worst phase - 0.075m of a 0.15m tolerance,
2.75x today), **H39** (the twelve modules that read a body off a rendered frame,
declared and unmeasured) and **H34**, rewritten to the one question this census
did not answer. **D70** records the ride being pinned. H36 and H37 are H11's and
untouched; **H35** still waits for three gates and has one.

## H34 — the 13px neck is real, there is a 14, and eight phases was too coarse (2026-10-07 02:00, scheduled run)

**What it was handed.** H31 read the 8m neck at 10, 12, 12, 12, **13** and 12px
over six runs on both maps and asked why the 8m half of
`the-shade-reads-as-a-hooded-figure-at-8m-and-25m` varies more than the 25m
half, when the 8m band is ten rows deep against three. H33's census answered
the comparison from the other end - over eight phases of one breath the 8m neck
read 10-12 and the 25m neck 4-6, so in relative terms 17% against 33%, which is
the right way round - and the queue rewrote this job down to the one reading
that was left: **the 13 nobody had reproduced.** Two candidates were open: a
sweep too coarse to catch it, or something other than the breath.

### The answer: both of H33's numbers were under-sampled

**32 phases of the breath at 8m, on each map**, reproducing that check exactly
- its stand, its **lane yaw**, its reference buffer, its own
`flatShadeSilhouette`. Sixty-four readings:

| | neck, by count | range | worst ratio |
|---|---|---|---|
| plant (site A) | 10×3 · 11×6 · **12×18** · 13×5 | 10-13 | 2.154x |
| yard (site C) | 10×5 · 11×5 · **12×19** · 13×2 · **14×1** | 10-**14** | **2.000x** |

So **the 13 is real and common enough** - 5 of 32 phases on the plant, 2 of 32
on the yard - and the yard goes one further to **14px, once in 32**. H33's
eight phases on one map simply missed both, and the 2.33x it recorded is
wrong: **the measured worst is 2.00x** (28/14) against the clause's 1.5x. The
census table in `tests/breathcensus.js` is corrected to 10-14px and 2.00x, and
says in the same line that eight phases is too coarse at 8m so the next reader
does not repeat it.

**The yaw was not the variable**, which was the other candidate and is now
ruled out: both maps' lanes read a yaw of **-3.142** (π), so H31's six readings
across two maps were not six readings at two angles. What differs between the
maps is the stand and what is behind the body, and the spread is the same shape
on both.

**And the hood never moved.** 28px in all 64 readings, on both maps, with the
body's height at 122-127 - the same invariance H31 found at 25m (10px in 48
readings). The neck is the only thing the breath moves here.

### Why eight phases is enough at 25m and not at 8m

This is the real content of H34's "wrong way round", and it is about sampling
rather than about anatomy. The breath lifts the torso 4cm. At 25m a row is
about 4.5cm, so the breath is worth **about one row** and the body spends most
of the cycle at one of two alignments: a worst-case 6px neck came up in six or
seven of eight samples in every run H31 took, which is exactly why
`tests/breath.js` can assert the 25m worst case from eight samples and not be
flaky. At 8m a row is about 1.5cm, so the breath is worth **about three rows**,
the reading is spread over five integers instead of two, and the extremes are
rare - 12px is 18 of 32 and 14px is 1 of 32. **A finer measurement needs more
samples to find its own worst case, not fewer**, and reading eight phases at
both distances was the mistake rather than anything the body did.

### The judgement: no dense clause, and what is asserted instead

The honest answer to "is this worth a check" is **no, not as a ratio**. At
2.00x against 1.5x the clause keeps **33% of margin** and is still the widest
in that check; the neck would have to reach 19px - a third wider than anything
in 64 readings - to fail, and a dense sweep costs 64 readings of the reference
buffer in a check that already runs 33 seconds.

What is worth asserting is the fact the margin **rests on**: the hood holds
still. If the hood ever starts riding the breath the way the neck does, the 8m
margin becomes a product of two moving numbers and every reading above wants
taking again. Eight phases is ample to catch a hood that moves, so
`tests/breathcensus.js` gained a clause that sweeps eight phases at 8m, reads
through `figure.js`'s own exports, and asserts that **the hood is one width at
every phase** and that the worst ratio over them clears `HOOD_OVER_NECK`. It
reads `the 8m hood holds at 28px over 8 phases, worst 2.15x of 1.5x` on both
maps.

### What was verified

Its own gate was H33's VERIFY on this branch (protocol step 8).

**VERIFY**: **OK**, plant **216 passed / 1 failed / 8 not for this map**
(1,070,794ms and 1,078,579ms), yard **196 / 1 / 28** (746,071ms and 744,803ms),
exit 0, 0 red, 0 flaky, **0 console errors**, 0 context losses, 0 loop frames,
both runs of each map agreeing exactly on every count. The same check count as
H33's pair, because this extended that census rather than adding one. Run-pair
spreads 7,785ms and 1,268ms against pipeline waits of 980ms and 439ms, the
tightest waits on record.

The census check's detail hit **exactly 400 characters** when the new reading
was appended - the silent cut (TRAPS.md), for the second time in two jobs - and
five readings were shortened to bring it to 362. The check costs 33s on the
plant and 24s on the yard with the 8m sweep in it.

### What was left

Nothing of H34. **H38** (hold `hang.js`'s glove at the worst phase) and
**H39** (the twelve modules that read a body off a rendered frame) are H33's
and open; **H36** and **H37** are H11's; **H35** has one of its three gates.
One lesson for all of them: **a sweep's density is part of the instrument**,
and this is the third time a pixel reading turned out to be about how it was
measured rather than about the body - H29's two readings, D64's band, and now
H33's own eight phases.

## H38 — the hanging glove held at the worst phase, and the centimetre the census missed (2026-10-07 17:00, scheduled run)

**What it was handed.** H33's census named `tests/hang.js` the thinnest
breath-reached clause in the suite and the one its first instrument was blind
to. `a-hang-is-at-full-stretch-under-the-lip` asserts
`|gloveY - lip| <= 0.15m` on a **world** position of a mesh hanging off an arm
inside the body group the Shade's breath lifts, and over eight phases the
census read the offset running -0.021m to +0.055m — a span of 0.075m, half the
tolerance, passing at 2.75x on its worst phase. No bug and no urgency: the job
was to bound a quantity the check samples and does not bound, which is the
state the two figure clauses were in before H31, and the reason to bother at
all is that the margin is the product of three independent numbers —
`hangDrop`, the arm's length and the breath's amplitude — with nothing watching
it.

**What was built.** A second check in the same module,
`the-hanging-glove-holds-the-lip-at-every-phase-of-the-breath`, written the way
`tests/breath.js` is: hang at the first hangable ground-level ledge the
controller's own probe reports, sample the glove's offset at eight phases of
the 6.98s breath by driving `updateVisual` at the fixed step, and assert the
**worst** of them. It costs nothing to sweep — the glove is a world position
off the matrix, so there is no render and no `readPixels` anywhere in it, and
it runs in **10-17ms** against the 28-36s `tests/breath.js` pays for eight
reads of the reference buffer. Both checks now reach the lip through one
`hangAtGroundLedge` and the glove through one `hangingGloveY`, so they cannot
drift into reading two different quantities, and the tolerance is one named
constant rather than a literal in two places.

The clause it asserts is **2.26x** at worst, with **56% of the tolerance
left**: over eight phases the offset runs -0.014m to +0.066m on both maps,
worst 0.066m of 0.15m. And it carries the second half HANDOFF.md demands of a
check that picks its own inputs, because without it the whole thing is
decoration: **the glove's own ride is asserted absolutely**, 0.078m with
0.012m of tolerance, so a worst-of-eight read off a body that is not breathing
is caught rather than passed. That is not hypothetical — see below.

**It corrects the census by a centimetre, and the cause is a settle.** The
span agrees with H33 (0.079m and 0.080m against 0.075m, and a dense sweep puts
it at 0.0800m, twice `POSE.breath.lift` to the millimetre) but the whole band
sits a centimetre higher, so the margin is 2.26x and not 2.75x. A probe of the
settle says why. The arm's **angle** arrives by frame 30 — `armL.rotation.x`
reads -3.04 at frame 20 and -3.05 at 30, 60 and 120 — but the pose's
contribution to the glove's **height** is still moving well past it:

| frames of `updateVisual` after the grab | glove − lip | of which is not the breath |
|---|---|---|
| 0 | -2.079m | — (arms still down, `armX` 0.000) |
| 3 | -0.911m | — (`armX` -2.086) |
| 5 | -0.691m | — |
| 10 | -0.435m | — |
| 20 | -0.188m | — |
| **30** (what the shipped clause reads) | **-0.036m** | **-0.016m** |
| 60 | -0.007m | +0.018m |
| 120 | -0.009m | +0.027m |
| settled (dense sweep's mid) | — | **+0.0263m** |

So a sweep that began at frame 30 would be sweeping the ease and the breath
together and calling the sum the breath, which is what the census did. The new
check settles **150** frames before its first sample, five times the shipped
clause's thirty, and the constant says in as many words why they differ. The
lesson is H34's in a different currency: **a sweep inherits whatever its first
sample inherited**, and here that was a transient rather than a phase.

**Eight phases is the right density here, and that is a measurement and not a
habit.** H34 had just finished showing that eight phases is too coarse at 8m,
so this job owed the opposite proof rather than the same assumption. A dense
sweep of **all 419 frames** of one cycle reads a worst of **0.0663m** against
the eight-phase check's **0.066m** — the same number to the millimetre. The
reason the two jobs come out differently is the quantity, not the sweep: an
offset in metres is **continuous**, so eight samples of a sinusoid can only
miss its peak by `1 - cos(pi/8)`, which is 7.6% of a 0.040m amplitude and
therefore 3mm; a pixel count is an **integer**, and at 8m the breath spreads
the neck over five of them with the extremes turning up once in thirty-two.
**A sweep's density has to be chosen against its quantity's own graininess.**

**And the map does not enter it, which the done-when asked for and this
explains.** Both maps' dense sweeps are identical — -0.0137m to +0.0663m, span
0.0800m, mid +0.0263m — on lips of **3.00m** (the plant's `hall-container`)
and **2.90m** (the yard's `ring-west-0`). They have to be: the offset is the
glove's height above the feet minus `hangDrop`, and the lip cancels out of it.
So the two maps are two readings of the body and one reading of the rule, not
two readings of two geometries.

**Proved load-bearing by breaking each clause on its own**, which is the only
way to know the pair is not one clause and a comment:

- `POSE.breath.lift` 0.04 → 0 reds *only* the control — *"over 8 phases the
  glove rode 0.0000m against the 0.078m this clause was measured at"* — while
  the worst-phase clause reported a perfectly comfortable **5.70x** on eight
  identical readings of one phase and would have passed. That is exactly the
  hole the control exists to close, and it is worth noting that the reading it
  would have published (82% of the tolerance left) is *better* than the true
  one.
- `hangDrop` 2.05 → 2.25 reds *only* the worst-phase clause — *"the worst of 8
  phases draws the hanging glove 0.211m off the lip, over 0.15m"* — while the
  ride read 0.075m and the control passed. One of the three numbers the margin
  is a product of, moved, and named.

**Stability.** The set of eight phases rotates with wherever the run came in,
so the worry is the same one `tests/breath.js` answers: four subset runs
entered at breath phases from 12.72s to 19.73s and the worst read 0.065m,
0.066m, 0.066m and 0.066m. It is stable for a better reason than breath.js's
— the worst of eight samples of a smooth sinusoid is within 3mm of its peak
wherever the samples fall, where breath.js depends on a worst-case pixel count
being *common*.

**What was found and left alone.** The shipped clause reads a **transient, not
the hang**: at frame 30 the glove is 0.036m under the lip, which is 24% of its
tolerance spent on the tail of the arm's swing, where the hang itself settles
at 0.026m over it. Nothing is wrong today and nothing was touched — H31's
precedent is that a clause gets measured before it gets edited, and the new
check now covers the hang properly — but the shipped clause's one reading is
about the ease and would redden if the ease ever slowed, which is a false red
about the blend rather than about the body. That is **H40**, sized S.

**No decision raised.** The settle split and the sweep's density are instrument
choices with their measurements written at the line, and the absolute pin on
the breath's amplitude rests on **D70**, which already says that changing the
breath's depth is a one-line change plus a re-measurement of the margins that
were taken at it. This is now the second place that re-measurement would be
demanded from, and the second is the point.

**And one line given back.** `HANDOFF.md` was at 399 of the 400 lines
`traps-md-holds-the-traps-and-handoff-points-at-it` allows, and G1's rule is
that a job which adds to that page takes something out. This job's index line
is paid for by the **orphaned-runner paragraph** under *Still needs a human*,
which is a closed finding rather than anything needing a human - the runner has
been gone since H23 and `TRAPS.md` holds the standing version with the same
history, by the rule that a trap is retired by name and not deleted quietly.
The page is 396 lines now, which leaves the next three jobs somewhere to go.

**And a trap paid again, with a half of it that was not on the record.**
`TRAPS.md` warns that a backtick inside a double-quoted shell string is command
substitution, and that the way out is to write the patch script to a file. This
entry's own VERIFY paragraph was written with an inline `python -c "..."`
instead, and the trap as written describes the loud failure - bash hands python
nonsense and the anchor assertion refuses, "which is the one mercy". The quiet
failure is the one that happened: `auto`, `medium` and `bench only` are
identifiers with no slash in them, so bash ran each as a command, printed
`command not found` to stderr among the rest of the output, substituted **the
empty string**, and the patch *succeeded* - leaving a sentence reading "would
have picked  on both" and an exit code of 0. The trap now carries that half
too, because "the edit never happened" and "the edit happened with holes in it"
want different habits: the second one is only caught by reading the patched
lines back.

**Verified.** GATE (cold, HEAD `0d08664`): OK, plant 216 passed / 1 failed / 8
not for this map (1,070,494ms, 449,994ms of it the renderer's pipeline tail),
yard 196 / 1 / 28 (749,101ms, 338,275ms tail), 0 red, 0 flaky, 0 context
losses, and **0 console errors on either map** — which is the point of writing
it down: H35 wants three gates' counts and this is the **second**, H11's being
the first and also 0. `auto` would have picked `medium` on both maps (5.20ms
and 5.30ms), and the runner throttled itself to 4 of 8 cores with a 45s
cooldown.

VERIFY (two runs of each map, on the finished tree): **OK**. Plant **217
passed / 1 failed / 8 not for this map** on both runs (1,060,802ms and
1,076,531ms, 445,989ms and 449,506ms of it the pipeline tail), yard **197 / 1 /
28** on both (737,811ms and 753,325ms, 326,972ms and 335,141ms tail). **0 red,
0 flaky, 0 console errors, 0 context losses, 0 loop frames, 0 re-runs, 0 skips
withheld, 0 bench drops withheld, 0 unexpectedly green and no other runner on
the machine** - and both runs of each map agree exactly on every count, which
for a check whose eight samples rotate with the run's entry phase is the claim
worth having. One check more than the pair after H34 on each map, which is this
one. Run-pair spreads 15,729ms (1%) on the plant and 15,514ms (2%) on the yard,
against pipeline-wait spreads of 3,517ms and 8,169ms - so read the work as
unmoved (F16). `auto` would have picked `medium` on both (5.40ms, 4.80ms).

The one failure on each map is the frame-budget check, reported as `bench only`
against a real-GPU reading from `e95fe4b` (D69), exactly as it was at the gate.

## H39 — the other twelve, and the two facts that answered ten of them (2026-10-07 20:00, scheduled run)

**What it was handed.** H33's census covered every module that **poses** a body
— a grep for `updateVisual` is the whole criterion, which is what makes that
list checkable — and said plainly that it was not the whole of what inherits
the run's phase. A check that renders a frame and reads pixels out of it gets
whatever phase the run is at, through the same `updateVisual` inside the frame.
Twelve such modules sat in `ALSO_DRAWN`, **declared and unmeasured**. The job
was to reclassify every one: measured with its numbers, or out of reach with
the proof that covers it.

**Two facts about the machinery answered ten of the twelve before any pixel was
counted, and both are now proved rather than asserted.**

- **A lens does not advance the pose.** `grab()` in `tests/pixels.js` is
  `h.post.render(...)` and a `readPixels`; it never calls `updateVisual`. So
  every grab inside one check is at **one** pose, and a difference between two
  grabs — which is how nearly every picture check in the suite isolates what it
  is about — cancels the body exactly. Measured: twelve grabs move the body
  under 0.0001m where twelve real frames move it 0.0064m.
- **The gait reaches nothing while a body stands.** `_posture` multiplies the
  whole gait by `walking`, so a standing body's limbs are at rest whatever
  `_animTime` has reached. Every body in this group stands. Measured: the legs
  and arms swing **1.08 rad** while walking and under **0.0001 rad** across a
  whole turn of `_animTime` standing still. So the gait — which H33 found to be
  the *bigger* lever, 24% of a pixel count on `look.js`'s walk and sprint poses
  — is out of reach of all twelve for one structural reason, and no entry in the
  table needs a gait note.

**And a third fact, which is why nothing here needed H38's settle.**
`Agent.reset()` ends with `this.updateVisual(0)`, and `blendFactor(0)` is
**1** — so a reset body is re-posed at the run's current phase with the ease
snapped all the way to its target. A check that resets a body and then reads it
reads a *settled* pose. H38's hang is driven into rather than reset into, which
is precisely why it had a live ease riding on top of the breath and needed 150
frames of it out of the way. The two jobs are the same mechanism from opposite
ends.

**What was left is two clauses, and both are wide.** Over eight entry phases on
both maps, run through the registry exactly as the suite runs them, with the
lift shown to have ridden 0.0787m and 0.0798m across the sweep:

| clause | reads | against | margin |
|---|---|---|---|
| `the-shade-visibly-dims-with-the-meter`, body | 18,579–19,763px | a floor of 400 | **46x**, moving 4–5% |
| the same, near-black | luma 36.7–42.8 | a bar of 90 | **2.1–2.4x**, moving under one step |
| `the-rim-light-is-really-on-screen`, body | 7,376–8,109px | a floor of 500 | **14.8x** |
| the same, rim | 4,872–5,118px | a floor of 200 | **24x** |
| the same, **edge over interior** | **2.08–2.39x** | a bar of 1.5 | **1.39x**, moving 7% |

So the group's answer is the opposite shape to H38's, and the reason is not
luck: a body's own pixels are **counted in the thousands or averaged over its
mask**, where H38's glove was a single point two metres from the pivot the
breath turns. The thinnest thing here is the rim's edge-over-interior at
**1.39x**, which is the clause that says a rim light is an edge and not an
ambient add wearing a rim's name — and it is thin because 1.5 is a demanding
bar for that claim, not because the breath is near it.

**The queue was wrong about one module, which is the third time.** It named
"`feedback.js`'s death-cam killer" as the third thing worth reading. The death
camera is `the-death-camera-frames-the-killer` in **`visual.js`**, not
`feedback.js` — and it is structurally out of reach twice over: the killer it
isolates is the **Warden**, which does not breathe (H33 proved that), and the
ragdoll clauses beside it read `mesh.position` and `mesh.rotation`, which the
breath never touches because it moves a group *inside* the mesh. H30's entry
said the same of `readability.js` and H33's own sweep density was the second;
**a queue line written from memory of a module is a guess, and the module is
the authority.**

**The twelve, classified.** `tests/breathdrawn.js` holds the table, which is
now the one source of truth — `tests/breathcensus.js` imports it rather than
keeping a second copy, so the two censuses cannot come to disagree about which
file is in which group:

- **measured (2)**: `visual.js` (one of its five clauses; the other four are
  covered by `hidden`, `onepose` twice and the Warden), `presentation.js` (one
  of its seven).
- **out of reach (10)**, by five proofs: `onepose` — `feedback.js`, every
  clause a difference between two grabs with only the feedback quad toggled.
  `hidden` — `sitetint.js` and `groundview.js`, which hide both bodies for the
  length of the reading. `nobody` — `quality.js`, `qualityhold.js`,
  `plantrule.js`, `briefing.js`, `debuggate.js`, which read no framebuffer and
  no part of a posed body at all. `onebit` — `fuzz.js`, whose one framebuffer
  read reduces a whole frame to **whether any pixel is non-zero**, to tell a
  live context from a lost one (F1); where a body is drawn cannot move one bit.
  `cost` — `performance.js`, whose one clause is a frame cost in milliseconds.

**Each proof is held, and three of the five behaviourally with the second half
HANDOFF demands.** `onepose` and `standing` are above. `hidden`: with both
bodies hidden, a crest-to-trough move of the breath changes **0 pixels**, and
with them shown the same move changes **18,470** on the plant and **16,976** on
the yard — the pair is the proof, because the first half alone would pass on a
renderer that had stopped drawing. `cost`: the draw calls read **449** on the
plant and **332** on the yard at both ends of an exact 0.080m lift, so the
breath moves a transform and nothing a frame budget is made of. `nobody` and
`onebit` are held from the module's own text, the way `tests/donedef.js` reads
source for its line counts and its two bans. And the table is held as a
classification rather than a list: an entry naming a proof this check does not
hold is red, and so is **a proof no entry rests on**, which is H30's rule about
allowances going stale.

**Its own control caught the instrument, which is the part worth keeping.** The
first draft advanced the body **half a cycle** from wherever the run arrived,
and the control fired on both maps: *"the body moved 0.0239m between the two
draw-call counts, under one lift of 0.04m, so equal counts say nothing."* It
was right, and the arithmetic is the lesson — advancing half a period from
phase θ moves the body by `2A·|sin θ|`, which is the whole ride at a crest and
**nothing at all** at a crossing. A proof whose window depends on the phase the
run happened to start at is a proof that is vacuous at two phases in eight, and
the suite would have reported it green in six runs out of eight. The phases are
**absolute** now — `CREST`, `TROUGH` and `CROSSING`, set on the clock and
snapped with `updateVisual(0)` — so every clause here is the same measurement
in every run. That is the second time in two jobs that a sweep's own control
has been the thing that found the flaw, and the first draft would have passed
its gate.

**Proved load-bearing by three breaks, each naming its own line.**
Misclassifying `feedback.js` as `nobody` produced *"feedback.js is declared out
of reach because it reads no body, and it reads the framebuffer"* **and** *"the
proof `onepose` is held below and no entry rests on it"* — both halves of the
table's census at once. Renaming `visual.js` out of the table produced
`breathcensus.js`'s *"visual.js renders a frame and is in neither list"* and
*"visualGONE.js is in ALSO_DRAWN and no longer renders a frame of its own"*,
which is the cross-module wiring proved in both directions. And zeroing
`POSE.breath.lift` emptied the controls in both censuses at once.

**A trap out of that loop.** `git checkout --` does not revert a file git has
never seen, so the break-and-revert loop silently stopped reverting the moment
the file under test was **new and untracked**: two breaks accumulated, the
second and third runs were measured on a tree carrying earlier breaks, and the
only reason it was recoverable is that each red named its own line and the
stale complaint appeared in runs it did not belong to. `TRAPS.md` has it, with
`git add -N` and reading `git status --short` *between* breaks rather than only
at the end.

**What was left.** Nothing in this group wants doing. `ALSO_DRAWN` is empty of
unmeasured modules, which is the done-when, and the honest residue is one line
rather than a job: `performance.js`'s clause is answered by `npm run bench` and
not here (H11), so its margin is a real-GPU number — 3x to 6x under its ceiling
over twelve readings — and the `cost` proof is what says the breath cannot
reach it either way.

**No decision raised.** Every choice here is an instrument choice with its
measurement at the line, and the pin on the breath's amplitude is still
**D70**'s, now read from a third place.

**Verified. GATE: none of its own, by protocol step 8** — H38's VERIFY, two
runs of each map on a tree this job started from, stands as it. So this entry
has no cold console-error count to add to H35's three; the one this session
produced is in H38's entry, and it was **0**.

VERIFY: **OK**. Plant **218 passed / 1 failed / 8 not for this map** on both
runs (1,142,663ms and 1,097,414ms, 451,873ms and 443,881ms of it the pipeline
tail), yard **198 / 1 / 28** on both (773,105ms and 769,357ms, 337,220ms and
341,584ms tail). **0 red, 0 flaky, 0 context losses, 0 loop frames, 0 re-runs,
0 skips withheld, 0 bench drops withheld, 0 unexpectedly green and no other
runner**, both runs of each map identical on every count. One check more than
the pair after H38, which is this one. `auto` would have picked `medium` on
both (6.10ms, 4.30ms).

**One console error, and it is the audio one — so the streak that HANDOFF.md
described one job ago is over.** *"The AudioContext encountered an error from
the audio device or the WebAudio renderer"*, **plant run 1, 336s in**, the
third occurrence in twelve verifies (H27 yard, H29 plant, this). The thing
worth recording is not the error, whose code side H32 closed, but that H38 had
just written into `HANDOFF.md` that the clean run was "eight in a row, which is
the exact shape of evidence H28 mistook for a closure once already, so do not
take it" — and it broke on the **very next verify**. The record predicted
itself, so the warning stands in the strongest form it has ever had: **an
intermittent fault is not closed by an absence, and the length of the absence
is not an argument.** The occurrence fits the standing hypothesis rather than
straining it — an end-of-session verify, 336s into a run, on a session whose
own cold gate was 0 that morning — and `TRAPS.md` carries it. It does not fail
the gate, by D67.

**And one timing worth reading rather than quoting.** The plant's run pair
spread **45,249ms, 4% of the longest** — the widest since F11 — against a
pipeline-wait spread of only 7,992ms, where the yard's pair spread 3,748ms
against a 4,364ms wait. So unlike H32's yard pair, this one is **not** the
renderer's tail: 45s of spread with 8s of wait behind it is the machine, and
the audio error landed inside the slower of the two runs. F16's rule says read
the spread before the total; read here, it says both plant totals are load
readings and neither is a cost, so nothing in this entry's timings should be
compared with a `PROGRESS.md` number.

The five checks that read source text and markdown were re-run against the
committed tree after these records were written, as the protocol orders them.

## H36 — the worst viewpoint was one frame, and no clock in this page can price a draw (2026-10-07 22:00 and 2026-10-08 02:00, two scheduled runs)

**What it was handed.** `the-frame-budget-holds-everywhere-not-just-at-site-a`
walks the camera to every waypoint and site on a map, looks four ways from each
— 92 viewpoints on the plant, 96 on the yard — and times a frame at each. It
timed **one** draw per viewpoint and asserted the highest of them against the
8.33ms ceiling, so **its verdict was a single frame**. H11 benched it twice
twenty minutes apart on a byte-identical tree: the mean agreed to 0.12ms in all
six scenes, the worst moved 5.50ms → 2.60ms on the plant at `medium` and named
a different place in five of six. The queue's instruction was H31's rule —
measure what sample count makes the worst reproduce before proposing anything —
and its own note said that on this GPU it did not matter, nothing having come
within 1.5x of the ceiling.

**That note is false, and finding out was the job.** The instrumented bench
caught the thing the queue thought was still hypothetical: at `bay-a-north` on
the yard at `medium` a single timed draw read **13.80ms** against the 8.33ms
ceiling, and **the check went red on the real GPU**. The same place in the next
bench reads a **median of 2.30ms with a maximum of 2.40ms over fifteen draws**.
So the red was a frame the scheduler took away, reported as a frame budget
failure, on a machine where that viewpoint costs 28% of its allowance.

**The measurement.** Two benches on this PC's GTX 1060 with the sweep
instrumented to take **fifteen** timed draws per viewpoint and report every one
of them — the bench stores a check's whole detail line rather than the suite's
400-character cut, which is what made this affordable — and then, offline, what
every sample count from one to fifteen *would* have concluded. Three answers.

**One: the worst PLACE never reproduces, at any count.** The top-three places
overlapped one or two of three in every one of the six scenes, at fifteen
samples as at one. It is not noise in the instrument — it is that **the top of
the distribution is a plateau inside the clock's own resolution**.
`performance.now()` is clamped to 0.1ms, and at a median of fifteen, **4 to 13
viewpoints of 92 sit within 0.2ms of the top** and 18 to 41 within 0.5ms. So
"which viewpoint is worst" is a choice among a dozen ties decided by one or two
ticks, and no sample count can fix a tie. What *does* reproduce is the top
**ten as a set** — 7 to 10 of 10 across the two benches — so the busiest
*neighbourhood* is a real finding and the busiest *viewpoint* never was one.

**Two: the worst VALUE settles as a median and never as a maximum.** Median-of-N
agreed between the two benches within 0.3ms in all six scenes from **five**
samples and within 0.2ms from nine. Max-of-N agreed nowhere: the gap was still
1.0–1.1ms at fifteen on the yard, and on the plant at `medium` it **grew** from
0.1ms at nine to 0.6ms at fifteen — because a longer run gives a spike more
chances to happen. **More samples make a maximum worse.** That is the whole
argument for the median, and it is the opposite of the intuition that more
sampling makes any statistic steadier.

**Three, and this is the honest residue: a median survives a descheduled frame
and not a sustained stall.** The first bench taken with the *shipped* code read
`deck-office-door@0` on the plant at `medium` at **4.80ms across all nine of its
draws**, where both instrumented benches read that same viewpoint at a median of
**2.20ms with a maximum of 2.30** — unusually tight — and the next bench put its
worst *single* draw at 3.80ms. Four readings of that scene's worst median go
**2.60, 2.40, 4.80, 2.60**. Nine draws at 2.2ms buy about **20ms** of window, and
anything that slows the machine for longer than the window is inside every
sample in it. No count reaches past that. What makes the clause safe is not
reproducibility but **headroom**: the worst of those four readings is 58% of the
ceiling.

**What was built.** A viewpoint now costs the **median of the timed draws it was
asked for**, up to nine and capped by a 120ms budget, and the worst of those
medians is what is asserted. The count comes from the **URL** —
`?viewpointSamples=9`, which `scripts/bench.mjs` asks for and nothing else in
the repo does — and is **one** otherwise, so the gate pays precisely what it
always paid, which matters because the gate runs this check and drops only its
verdict. That the count is *declared* rather than measured is the whole second
half of this job, and the section below is why; the first attempt had a 120ms
wall-clock budget decide it, and that is what killed three runs. The budget
keeps the only honest job left for it: a **cap**, so a real GPU slower than this
one takes the samples 120ms affords (nine at 2.5ms spend 22ms of it, nine right
at the 8.33ms ceiling spend 75ms, a card needing 15ms a frame gets eight)
rather than nine regardless of what it can afford.

The detail line says how many draws each median rests on and says `NOT a median`
when it is fewer than five — **on the red as well as the pass**, which the first
draft got wrong and the iteration caught: it said "the worst viewpoint's median
frame" on every red, and headless, where this check is red by design and the
count is one, that is a claim about a statistic nobody took. The red the gate
prints every run now reads `costs 37.10ms on 1 sample, NOT a median`.

Two things are now **reported and not asserted**: the worst single draw, because
13.80ms was a scheduling artefact and not a cost, and the busiest **three**
places rather than one crowned winner, because the winner is a tie. The
readings, twelve of them in `bench/2026-10-08.json` and the first ever taken by
the shipped check rather than by an instrument: worst medians **1.90ms** (plant
low), **4.80ms** (plant medium), **2.60ms** (plant high), **2.40ms** (yard low),
**2.90ms** (yard medium), **2.80ms** (yard high), against 8.33ms — and the
busiest corners are `deck-office-door` and `stair-hall-foot` on the plant,
`gate` and `store-west-lane` on the yard.

**The check that makes it revert-detectable at the gate**, which needed thought
because the sweep itself is bench-only and fails headless by design, so the gate
cannot see a change in it. `the-frame-budget-asserts-a-median-frame-and-not-an-unlucky-one`
runs headless in **4ms** and holds three things. The constants as a
**relation** rather than as copies of themselves, which is HANDOFF's standing
lesson about a check that reads the number the code read: the budget must afford
every sample at the ceiling (9 × 8.33 = 75ms of 120), or a machine at its
ceiling would be judged on fewer samples than one well inside it. The statistic
**both ways** — a 13.8ms spike among nine 2ms draws must cost 2ms, *and* nine
draws all over the ceiling must still read over it, without which the first
clause is satisfied by a statistic deaf to everything. And that the sweep
actually calls it, read from `soak.js`'s own text the way `donedef.js` reads
source, because a statistic nothing calls is decoration.

**Proved load-bearing by three breaks, each naming its own line.** Putting the
statistic back to the old maximum: *"9 draws of 2ms with one of 13.8ms cost
13.8ms; a descheduled frame is reaching the verdict."* Making it deaf (return
0): that complaint **and** *"every draw at 9.33ms costs 0.00ms, under the
ceiling; the median is hiding a real overrun"* — both halves at once, which is
the point of having both. Cutting the budget to 40ms: *"the per-viewpoint budget
is 40ms, and 9 draws at the 8.33ms ceiling need 75ms — a machine at its ceiling
would be judged on fewer samples than one well inside it."*

**A trap, and it is the mirror of the one H39 recorded an hour earlier.** H39's
break loop failed to revert because the file was **untracked**; this one
reverted too far. `git checkout -- src/tests/soak.js` took the file back to
**HEAD**, which during a job is not "before my break" but "before the job" — so
it silently threw away the whole implementation along with the break, and the
next two breaks failed to find their anchors, which is the only reason it was
noticed. The work came back from a copy made for an earlier `node --check`.
`TRAPS.md` now has both sides: **keep your own copy and restore from that**, and
diff the two at the end of every iteration.

**One small thing for H37's benefit.** `bench/<date>.json` is named from
`run.at`, which is **UTC** — so a bench taken at 21:26 EDT files under
`2026-10-08`. H37 is the job that reports how old the newest bench is, and a
calendar question wants to know that the calendar is not the local one.

**The second half: three dead runs, and `gl.getError()` is not a barrier.** The
2026-10-07 run left this `[~]` with the measurement above complete and the
two-run verify not: three runs had died in `phase pipeline-wait` at **601s**,
one second past `--stall-wait`, because the budget bought all nine samples
headless and queued 736 extra draws. Two explanations had been measured and both
were wrong. This run measured the third, with `npm run probe` on the plant —
nine queued draws at a viewpoint, then each candidate barrier in turn:

| at | nine draws submit in | `getError()` then waits | a real `fenceSync` then waits |
|---|---|---|---|
| `hall-north@0` | 24.2ms | **0.8ms** | **5,940.6ms** |
| `site-b@1` | 13.1ms | **0.6ms** | **5,480.4ms** |
| `deck-vault-door@2` | 17.7ms | **0.6ms** | **6,833.9ms** |

So **`gl.getError()` is not a barrier on this renderer**: it returns in 0.6ms
with six seconds of work still queued behind it. A queued draw of a real
viewpoint costs **610–761ms**, which at nine samples across 92 viewpoints is
some **560s** of pipeline on top of the plant's own ~450s tail — the 600s
deadline, with a number in place of a suspicion. And the one thing in the page
that *does* wait is `drainPipeline()`'s `fenceSync`, which has to **yield to the
event loop** to poll `clientWaitSync`; it cannot live inside a synchronous
per-viewpoint timer. **There is no honest wall clock here to decide
affordability with, at any sample count.** That is why the count is declared.

**The parked note's own diagnosis was wrong, and that is worth as much as the
fix.** It said the 2.5–4.1ms reading came from a probe that never called
`lens.look()`, so it timed an empty camera rather than a map viewpoint.
Measured: a drained, "synced" draw with no `look()` reads **5.1ms**, and the
same instrument pointed at five real viewpoints reads **2.6–3.6ms** — *lower*,
not higher. The camera was never it. The barrier was, and the probe had been
measuring submissions in both cases. `TRAPS.md` now carries all three false
starts, and its own claim that a `glError()` waits for everything queued is
**corrected rather than extended**: the probe it dismissed as "really sixty
warmed frames of somebody else's queue" had the right order of magnitude all
along, and the dismissal was the error.

**Of the queue's two candidates, the first — and the second is now dead by
measurement rather than by argument.** `?viewpointSamples=9` on the page, one
otherwise, `scripts/bench.mjs` the only URL in the repo that asks. The sweep
lost both its synchronisations and its `glSync: true` with them, and the
*absence* of that flag is asserted rather than assumed, read off the registry
the way `tests/pipelinewait.js` reads the other direction.

**The holder check, extended, and proved by five breaks** — each naming its own
line and nothing else. `the-frame-budget-asserts-a-median-frame-and-not-an-unlucky-one`
runs headless in **9ms** and now holds, beyond the constants-as-a-relation and
the median-both-ways it already held: **seven URLs buying what they should**
(nothing asked buys 1, `?viewpointSamples=0`, `=1` and `=nine` buy 1, `=9` buys
9, 500 clamps to 9), that the sweep reads the URL rather than a clock, that it
declares no `glSync`, and that `bench.mjs` asks for a median while `suite.mjs`
does not. The breaks: defaulting the reader to nine — *"\"(no query)\" buys 9
timed draws a viewpoint and should buy 1 - the gate is the page that asks for
nothing"*, and four more rows with it; putting `glSync: true` back — *"declares
glSync again; the sweep only ever needed a drain in order to time its own
draws"*; hard-coding a flat nine — *"no longer takes its sample count from the
URL, so it is deciding one from a clock, and no clock here can"*; taking the
parameter out of `bench.mjs` — *"the bench times one draw a viewpoint and calls
it a median"*; and putting it into `suite.mjs` — *"headless a sample costs
610-761ms of queued pipeline and the gate drops this verdict anyway"*. The
breaks were applied and reverted from copies made at the start, never with `git
checkout --`, which is the trap this job recorded the first time round.

**Verified.** `npm run suite`, two runs of each map, exit 0: **plant 219
passed, 1 failed, 8 not for this map** (1,109,493ms and 1,108,098ms, of which
448,791ms and 453,151ms the renderer's pipeline tail) and **yard 199 / 1 / 28**
(782,636ms and 774,548ms, 338,787ms and 338,102ms of tail). 0 red, 0 flaky, 0
context losses, 0 loop frames, 0 skips withheld, 0 bench drops withheld, 0
unexpectedly green, 0 re-runs, no other runner on the machine — and **0 console
errors in all four runs**. Both runs of each map agree exactly on every count,
and the spreads are the tightest on record since F11: **plant 1,395ms (0% of
the longest)** against 4,360ms of pipeline-wait spread, **yard 8,088ms (1%)**
against 685ms. One check more than the gate on each map, which is this job's
holder. Auto would have picked `medium` on both (5.00ms, 4.70ms).

The one failure on each map is the sweep, bench-only by design, and its red is
worth quoting because it is the fix talking: *"the worst viewpoint ("site
B@0") costs 676.70ms on 1 sample, NOT a median - a median wants
`?viewpointSamples=9`, which only `npm run bench` asks for, over the 8.33ms
ceiling"*, with `site-c@2` at **846.10ms** on the yard. **Those two numbers are
themselves a finding.** The sweep's own wall clock read 2.6-3.6ms in the probe
and 37.10ms in the iteration subset, and **676.70ms and 846.10ms** here. A
submission clock sometimes catches the real cost — when the queue ahead of it is
deep enough that the driver blocks on the submit — and sometimes misses it by
two orders of magnitude. It is not a slow instrument. It is an instrument whose
error is **unbounded**, which is a stronger argument for not letting it decide
anything than "it reads low".

**The cost is unchanged, measured rather than hoped.** A subset containing the
sweep, both exemption policemen, the registry census, the two document checks
and the known tail-payer: **9 passed, 1 failed** (the sweep, bench-only by
design), pipeline tail **224,968ms** — the parked base's 224s to the second, so
the sweep costs exactly what it cost before H36 touched it.

**The gate's console-error count was 0** (both maps, cold, 2026-10-08 02:12),
which `HANDOFF.md` asks every run to write down. **That is the third of the
three H35 waits for** — H11's was 0, H38's was 0 — so H35 is ready, and
`QUEUE.md` says what it is now deciding between. It is not a closure: three
clean cold gates against an error seen at three of the last twelve
end-of-session verifies is the warming-machine hypothesis holding.

**Two follow-ups, both from what this had to measure.** **H41**: no synchronous
clock here can price a draw, and the frame-budget sweep was not the only check
holding one — `frame-budget-under-the-check-29-load` times a render and is
**not** bench-only, so a census of every timed render in `src/tests/` wants
taking, with a verdict-depends-on-it column. **H42**: the bench asks for nine
samples and nothing proves it got them, because the 120ms cap is live by design;
a bench whose sweep fell under five samples should exit non-zero rather than
file a one-sample reading as a median.

**No decision raised.** What a viewpoint costs, and who declares how many draws
it rests on, are instrument choices with their measurements at the line; no rule
and no look changed, and the ceiling (`frameBudgetMs` × `cpuBudgetFraction`) is
untouched. The one judgement worth Josh's eye is in `PLAYTEST.md` rather than
here: the busiest corners are named now, so if the game ever hitches in one
specific place there is a list to check it against.
