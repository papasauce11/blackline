# Blackline — build progress

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

### Exact next action

Phase 4 — `src/entities/enforcer.js`. The Warden first-person controller,
written as a shared controller driven by an intent object so the AI (Phase 6)
and the free-roam human (Phase 12) feed the same interface. Exit gate: swapping
the camera between Shade and Warden leaks no state — reuse `setCameraOwner()`
and assert the camera count stays at 1 and FOV is restored.
