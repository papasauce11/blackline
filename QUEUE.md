# Blackline — work queue

The protocol is in `PLAN.md`. **Up to three jobs per run**, one at a time,
each gated, verified and committed before the next is picked (D19). Take the
first job whose
`blocked:` line is empty, or names a decision that has a `decided:` line in
`DECISIONS.md`. Blocks are ordered; jobs inside a block are ordered; a later
block may be started only when every earlier job is done or blocked.

Sizes: **S** a third of a session · **M** most of one · **L** all of one.
If a job outgrows its size, commit `WIP: <id>`, replace it with a `[~]` item
carrying an exact *resume from* note, and stop.

Marks: `[ ]` todo · `[~]` WIP · `[x]` done (move under Done, with the commit).

**Every job's done-when includes**, unstated: the full suite run twice with
identical answers, no check weakened, `PROGRESS.md` entry, `HANDOFF.md`
rewritten, tree clean.

## Deliberately red

The GATE step ignores these. Nothing else may be red.

(none — the census went green with B3 on 2026-09-12. A job that makes a
check deliberately red adds one backticked id per bullet here.)

---

## Block A — the plant must be defusable

Directive, not plan. Decided: D5 (on or beside), D6 (refusal is a HUD line).
Full reasoning in `HANDOFF.md` under "the plant must be defusable".


## Block F — the gate itself

Placed here, after A and before B, on purpose: the suite is the instrument
every later block is measured with, and a gate that answers differently on a
busy PC is a gate that will eventually wave something through. The letter is
a name, not a rank. **Closed 2026-09-11** - F1 to F4 are under Done; the
next gate job, if one is found, goes here.

## Block B — the traversal redesign, phases 12–50

The 50-phase plan is in `HANDOFF.md`. Decided: all of the interview table
there. The census is the contract; **never weaken it**.

- [ ] **B2b (S)** The scuff as a noise the Warden hears - **blocked: D23.**
  One `emit('noise', ...)` in `Shade._scuff()` with a radius named in
  `config.js`; the AI's hearing already turns toward noise events.
  *done-when:* a check scuffs within the radius and asserts the Warden's
  `lastKnown` moves to the wall, and outside it does not.
- [ ] **B4 (M)** Upper deck. Re-scoped after B3 closed the census: the
  three deck slabs it named are not climbable (their only exposed faces sit
  above the gantry's 1.3m of headroom; the deck is entered by its lips, and
  every lip climbs). What is left: (1) A5 found one clear floor cell of
  site C's room — the deck at (21, 17) — with no Warden ground within the
  defuse reach, so a plant there is refused; close it with geometry rather
  than rediscover it. (2) The lips overhang their gantries by 0.6m, so the
  only approach is crouched under the deck; the census makes it, a player
  may not find it — reshape so each lip has a standing approach, or record
  why not. *done-when:*
  `every-plant-spot-in-a-site-room-answers-to-the-defuse-rule` reports 0
  refused floor spots; the census stays green; for each `lip-*` at least
  one approach the rule names has standing headroom (extend
  `the-climb-rule-has-no-exceptions` or add a check).
- [ ] **B5 (L)** Area pass, worst first, by the "needs a leg up" count:
  make every stacked route intentional — a readable first step, no dead
  climbs that lead nowhere. Keep the five v2 requirements. **Do not** add or
  remove rooms, move a site, or change a spawn (that is D13; write the
  proposal there). *done-when:* "needs a leg up" ≤ 10 and every climbable top
  has at least one exit that is not the way you came.
- [ ] **B6 (M)** Legibility — material language. Metal where you pass, concrete
  where you don't; vents read by contrast (decided). *done-when:* a pixel
  check measures luminance contrast ≥ 0.25 between every vent interior and
  its surround from a camera at the approach.
- [ ] **B7 (M)** Legibility — edge profiles and route lighting. Climbable
  lips get a bevel or a lit edge; the main stairless route up in each area is
  lit a step brighter than its surround. *done-when:* pixel check per area
  from the route's foot; draw-call and frame-budget checks unchanged.
- [ ] **B8 (M)** Feel. Mantle camera dip, momentum carried into a vault,
  landing weight by fall height, input buffer window tuned; traversal fuzz
  over 10k steps with no stuck state. Also the hanging body: `hangDrop` 1.35
  puts the capsule top 0.5m *above* the lip, so a lip with anything less than
  that over it (hall-container's south face, under `gantry-hall`) cannot be
  hung from and goes over instead — decide whether a hanging body should sit
  lower, arms extended, and if so what the pose looks like. *done-when:* the fuzz check and a
  no-stuck check pass; timing constants named in `config.js`.
- [ ] **B9 (S)** Close. Amend spec Sections 5 and 6.1 via Section 20, re-sweep
  the regression set, Warden sanity (still grounded — a check asserts the
  Warden never leaves `map.wardenGround`, which A1 built; drive it with the AI
  over a soak, do not re-derive it), done-definition check updated.
  *done-when:* `donedef` passes; README climbing section matches.

## Block C — playable and testable

Decided: D4 (Josh tests what the routine cannot; do not halt for looks).
Anything here that changes a **rule** is blocking — write the question.
Anything that changes **presentation** is provisional — do it, log it under
Provisional in `DECISIONS.md`, move on.

- [ ] **C1 (M)** Playtest build. A `debug` gate — `?debug=1` or a settings
  toggle — **off by default**; with it off, F3/F4 and every `DEBUG_KEYS` code
  are inert and the harness still works for the suite. *done-when:* a check
  runs with the gate off and asserts every debug key does nothing.
- [ ] **C2 (M)** Round-start briefing and controls card. Per role: objective in
  one line, the three sites named, the controls. Any key dismisses; a setting
  to skip. *done-when:* a check reads the briefing text for both roles and
  that a keypress dismisses it within one step.
- [ ] **C3 (M)** Hit and damage feedback. Hit marker on a landed shot, damage
  direction indicator, screen-edge vignette scaling with lost health.
  *done-when:* pixel checks for each; `brightnessDelta` proves the vignette.
- [ ] **C4 (M)** Round and match end screens that explain: who won, how
  (defused / detonated / eliminated / time), a five-line timeline of the
  round. *done-when:* a check ends a round each way and reads the reason.
- [ ] **C5 (M)** Difficulty pass driven by the AI checks. Measure
  time-to-detect and time-to-kill per difficulty setting. *done-when:* a check
  asserts both are monotonic across settings, and the values live in
  `config.js` under `ai.difficulty`.
- [ ] **C6 (S)** `PLAYTEST.md` for Josh: how to run, what to look at, what
  cannot be verified without eyes, known issues. Update it every C/D/E job.
  *done-when:* the file exists and `HANDOFF.md` links it.

## Block D — the second map: the container yard

Decided: D2. Outdoors, similar size to the first. Container stacks give the
Shade vertical advantage that is hard for the Warden to close. The Warden has
a railed walkway reached by stairs with an overhead view, glazed, with only
small apertures to shoot through. Provisional: D9 (night, floodlit), D11
(three apertures ~0.4m), D12 (the walkway is out of the Shade's reach).

- [ ] **D1 (M)** Map plumbing. A registry `src/maps/index.js` keyed by id;
  `buildMap(id)`; `?map=` URL param; the menu offers the list; **every check
  is parameterised over the current map**, the regression set runs on all.
  *done-when:* map 1 (`plant`) through the plumbing, suite identical to
  before; a second id (`yard`) builds an empty ground plane and the suite
  reports it per map.
- [ ] **D2 (L)** Yard blockout. Ground, fence, container stacks 1–3 high
  (2.6m each: one is a jump-mantle, two needs a stack), three sites in
  yard bays, Warden spawn at a gatehouse, Shade starts outside the fence.
  The five v2 requirements re-read for outdoors: level 2 is one connected
  container-top deck; stairless routes up are stacks; every bay has 2+
  entries; the walkway plays the raised-ceiling role. *done-when:* nav,
  census and objective checks pass on `yard`; "needs a leg up" reported.
- [ ] **D3 (M)** The Warden's walkway. Stairs, railing, a glazed booth;
  glass blocks shots and knives except through the apertures; the
  walkway height exceeds `standing + jumpBonus` from every stack top within
  4m (D12). *done-when:* a check raycasts from the walkway to 40 sample
  points and hits glass except through the apertures; a check asserts no
  climbable surface reaches the walkway.
- [ ] **D4 (M)** Yard lighting. Night, floodlights on masts as the shadowed
  key (one shadowed light stays the rule — pick the mast that covers the
  most), fill from the sky, pools of dark between stacks. *done-when:*
  the lighting readability checks pass on `yard` within the frame budget.
- [ ] **D5 (M)** AI on the yard. Patrol routes over `wardenGround`, defend
  paths to all three sites, alarm placement. *done-when:* every AI check
  passes on `yard`; a soak of 3 matches with no stall.
- [ ] **D6 (S)** Both maps in the regression set; the menu defaults to
  `plant`; `PLAYTEST.md` gets a yard section. *done-when:* `runRegressionSet`
  covers both maps in under 20s.

## Block E — styling

Decided: D3 — the Shade and the Warden first, then the map. Provisional: D10
(no post-processing until the characters are done). Draw-call and frame
budget checks are the ceiling.

- [ ] **E1 (M)** The Shade. From primitives to an articulated toon figure:
  hood, narrow silhouette, long limbs; merged geometry, one material, rim
  light kept. *done-when:* silhouette pixel check at 8m and 25m; draw calls
  unchanged.
- [ ] **E2 (M)** The Warden. Helmet, vest, rifle silhouette, broad stance.
  *done-when:* the two figures are distinguishable by silhouette alone in a
  pixel check at 25m, in the dark.
- [ ] **E3 (M)** Animation. Procedural limb swing by speed; crouch, slide,
  climb, mantle, hang and landing poses; the Warden's aim pose. *done-when:*
  a check steps each state and asserts the pose changed; no per-frame
  allocation.
- [ ] **E4 (M)** Map materials, `plant`. A concrete / painted metal / glass
  set with grime and decals; toon ramps tuned per material. *done-when:*
  pixel checks unchanged or better; frame budget unchanged.
- [ ] **E5 (M)** Map materials, `yard`. Corrugated containers, rust, painted
  numbers, wet ground. *done-when:* as E4 on `yard`.
- [ ] **E6 (S)** Post-processing — **blocked: D10.**

---

## Done

- **B3** A support is somewhere you can stand and get your hands on the
  face: `supportApproaches()` in `mapclimb.js` replaces the footprint test
  with the controller's own hand sweep from a spot in front of each face;
  `deriveClimbableSurfaces` takes the tallest approach in reach; the census
  stands at the rule's spots too and `the-climb-rule-has-no-exceptions`
  recomputes from them. **Census green**: 56 climbable, 208 approaches, 173
  climbs, 20 need a leg up; nine surfaces (six deck slabs, three roof slabs)
  stop deriving, each for a reason the geometry gives. Deliberately-red list
  emptied; B4 re-scoped - `<hash>`, 2026-09-12.
- **B2** The bump-and-scuff: a press of Space that carries the hands onto a
  face they cannot get over - beyond reach, or a lip with no room above it -
  pushes the body back, throws the arms up and plays a slap
  (`shade:scuff` -> `audio.scuff`); a blocked pull-up from a hang gives the
  arms and the slap. `Shade._faceAhead`, `_scuff()`, `scuffBumpSpeed`,
  `scuffPoseTime`; D24 (how it looks and sounds, provisional), D23 raised
  (does the Warden hear it). Check
  `a-climb-beyond-reach-bumps-poses-and-sounds` (tests/scuff.js) - `0e81da5`,
  2026-09-11.
- **F4** The rAF loop is stopped for the length of a suite run (`FrameLoop`
  in `loop.js`, on the harness as `h.loop`; `AutoSuite.runChecks` stops it
  and puts it back, `initMatch` no longer starts it, the headless runner
  stops it for the whole session and reports `loopFrames` per run, which
  must be 0); check `the-loop-does-not-run-the-game-under-the-suite` -
  `7d0bd8c`, 2026-09-11.
- **F3** Every module under the ~600 guidance, `config.js` excepted and the
  exemption written into PLAN.md: `main.js` 1,145 -> 597 across eleven
  siblings (`loop`, `timestep`, `matchstate`, `view`, `cameraowner`,
  `intents`, `loadout`, `wiring`, `hudstate`, `debugfields`, `harness`);
  `entities/agent.js` -> `agenttraversal`/`agentvisual`/`agentstate`;
  `systems/ai.js` -> `aiperception`/`ainav`/`aistate`; `mapkit.js` ->
  `mapgen`/`mapclimb`; `map.js` -> `mapdata`/`mapvalidate`; `physics.js` ->
  `collisionbox`; `systems/objective.js` -> `plantrule`; `systems/gadgets.js`
  -> `gadgeteffects`. Check `no-source-file-outside-config-is-over-600-lines`
  - `3a4dbe8`, 2026-09-11.
- **F1** The cascade was a lost WebGL context, not the viewport check:
  counted in `main.js`, tagged and re-run once after restore by the suite
  runner, now `ui/autosuite.js` (split from `ui/debug.js`); `contextLosses`
  and `rerun` in the runner's report; check
  `a-lost-gl-context-is-caught-and-the-check-re-run` - `eb0ed88`,
  2026-09-11.
- **F2** The suite resets the presentation before every check
  (`harness.resetPresentation()`: menu, intermission, pause, HUD shown),
  `hud.update()` returns whether it drew and `hud-reads-the-meter` asks;
  check `a-hud-check-answers-the-same-alone-and-after-a-frame-behind-a-menu`
  - `707368c`, 2026-09-11.
- **B1** Hang as a held option, as Josh specified it (D21, D22): tap Space
  grabs and hangs, hold Space climbs over; a `GRAB` move starts every climb of
  a ledge ≥ 1.4 Shade-heights above where it started, lower ledges go straight
  over; check `tap-space-grabs-the-ledge-hold-space-climbs-it`; spec 20.4 —
  2026-09-10, built in Josh's session.
- **P1** Verify and commit redesign phases 8–11 and the plant-room change —
  `5c6d571`, 2026-09-08.
- **P2** The headless runner — `scripts/suite.mjs`, `npm run suite`, one
  skip (frame budget) with its reason — 2026-09-08, the commit that adds
  `scripts/`. First scheduled run had stopped at the gate: the pane cannot
  start a server unattended.
- **A1** Where the Warden can stand — `src/mapground.js`,
  `map.wardenGround`, two checks — `edf7362`, 2026-09-09.
- **A8** The last leg, planned - `WardenGround.route()` over edges the
  flood now records, `ai._pathTo` in segments under `ai.maxUnpathedLeg`,
  `nearestWaypoint` on its own floor; found and fixed A1's ground being two
  islands (the staircases) - `c1ecf00`, 2026-09-10. **Block A closed.**
- **A7** The Warden's ground, drawn - `src/groundview.js`, F4 then N, two
  checks - `89cc07e`, 2026-09-10.
- **A6** Nothing inside anything - D20 decided, `PLANT_HEADROOM` and
  `canPlantAt()`, spec 20.3, one check; census now 361 legal / 12 refused -
  `57033e6`, 2026-09-10.
- **A5** The census, and what it found in the ducts - two checks over 373
  plant spots, `spotOffTheRing` on the legal set, `tests/objective.js` split
  four ways - `fb9dc58`, 2026-09-10. Raised D20 (the commit message says D19;
  D19 had been taken by a concurrent session ten minutes earlier).
- **A4** A refused plant says so and says nothing else - `round.plantRefused`,
  `PLANT_REFUSED` on the prompt panel with the hold bar gone, one check that
  reads the HUD through a real frame - `804ffbe`, 2026-09-10.
- **A3** The plant refuses before it starts — `_stepPlant` gated on
  `canDefuseAt` every step, `WardenGround.someCellWithin()` so the per-step
  call allocates nothing, one check — `f21eace`, 2026-09-10.
- **A2** `canDefuseAt()` and one shared defuse reach — `DEFUSE_REACH`,
  `withinDefuseReach()`, one check — `aef542a`, 2026-09-09.
- **D17** A climb is a press of Space, never a side effect of moving — the
  airborne mantle now needs the jump behind it or a press during the fall;
  new check `a-climb-is-a-press-of-space-never-a-side-effect`; spec 20.2 —
  `92886ec`, 2026-09-09, Josh's directive, built in his session.
