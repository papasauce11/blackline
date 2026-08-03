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
