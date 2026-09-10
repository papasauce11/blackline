# Blackline — work queue

The protocol is in `PLAN.md`. **One job per session.** Take the first job whose
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

- `every-climbable-surface-can-actually-be-climbed` — 12 of 65, geometry.
  Closed by B3–B4. **Remove this line the run it goes green.**

---

## Block A — the plant must be defusable

Directive, not plan. Decided: D5 (on or beside), D6 (refusal is a HUD line).
Full reasoning in `HANDOFF.md` under "the plant must be defusable".

- [ ] **A4 (S)** Tell the player: HUD line **"cannot plant here"** (D6) while
  interact is held somewhere illegal; no noise event; no sound. The gate is
  in place (A3) and the refusal already has a branch of its own to hang the
  message off; the no-noise half is already asserted by A3's check, which can
  be extended rather than rewritten. *done-when:* a check reads the HUD text
  during a refused hold and asserts no noise event was emitted.
- [ ] **A5 (M)** The census-shaped check: for every climbable top and vent
  interior inside a site room, try to plant, assert refusal; then sample
  legal positions and assert a Warden path exists to a cell that can defuse
  each. Fix `spotOffTheRing()` in `tests/objective.js` to pick from the legal
  set. *done-when:* the new check passes and every existing objective check
  still passes for the right reason (read their details).
- [ ] **A6 (S)** Re-examine the **value** of `DEFUSE_REACH.dy` (2.5m) against
  D5. A2 made it a named constant referenced from both sides; what is left
  is whether 2.5m is the right answer to "can a Warden reach up to a charge
  on a crate", and the comment recording that decision. **A3 found the
  horizontal reach is doing more of the excluding than the vertical one:**
  two of the three tops it proved refused are 0.7m and 1.0m up, well inside
  `dy`, and are turned away because the middle of a wide top is further than
  `radius` (2.0m) from any Warden ground. So the live rule already reads "no
  plant in the middle of anything wider than four metres". Read `radius`
  alongside `dy`, and remember widening it widens the *defuse* too — if the
  answer is to change it, that is a question for Josh, not a job. *done-when:*
  the value is decided with the decision as its comment, and the spec
  Section 20 records the rule.
- [ ] **A7 (S)** Draw the Warden's reachable ground. 25,177 cells exist and
  nobody can look at them; a wrong one is invisible until a plant is refused in
  play for no apparent reason. An F3/F4 overlay: the set as flat quads at their
  floor height, the current role's cell highlighted. *done-when:* a pixel check
  reads the overlay on and off at one viewpoint and measures a difference, and
  a check asserts it is off by default.

## Block F — the gate itself

Placed here, after A and before B, on purpose: the suite is the instrument
every later block is measured with, and a gate that answers differently on a
busy PC is a gate that will eventually wave something through. The letter is
a name, not a rank.

- [ ] **F1 (S)** The pixel checks can cascade on a loaded machine: one run
  had eight flaky at once, unreproducible in four later full runs (see
  "Environment traps" in `HANDOFF.md`). Either find the shared state that
  lets one pixel check spoil the next — first suspect is
  `a-zero-size-viewport-does-not-blind-the-renderer` restoring the canvas
  late — or make the runner re-run a flaky check a third time and report
  the tiebreak, so a loaded PC cannot turn a green gate red. **Do not**
  weaken a pixel check to settle it. *done-when:* either the shared state is
  named and fixed with a check that catches it, or the runner's tiebreak is
  in `scripts/suite.mjs` and documented in `HANDOFF.md`.

## Block B — the traversal redesign, phases 12–50

The 50-phase plan is in `HANDOFF.md`. Decided: all of the interview table
there. The census is the contract; **never weaken it**.

- [ ] **B1 (M)** Hang as a held option. Holding jump (or interact — pick
  whichever the input map leaves free and record it) at a ledge you could
  mantle instead hangs; release drops, forward pulls up. Never a failed-mantle
  outcome. *done-when:* a check drives `input.heldCodes` through hang → drop
  and hang → pull-up, and the fuzz cannot produce a hang without the hold.
- [ ] **B2 (S)** The bump-and-scuff. A climb attempted beyond reach gets a
  physical tell (a short bump back, a hand-slap pose) **plus** a sound.
  Never silent. *done-when:* a check asserts a rise of `reach + 0.3` yields
  the pose and a rendered sample; `renderOffline` proves the sample.
- [ ] **B3 (M)** `_supportCandidates()` counts a neighbour within
  `vaultReach` of the footprint as "below" when it is "beside". Fix the rule
  so a support must overlap the footprint, then rebuild any surface the
  fix orphans. *done-when:* census ≤ 3 failing, all three on the upper deck.
- [ ] **B4 (M)** Upper deck: the three deck slabs reachable only from a 1.3m
  gantry, and lips that overhang their gantries by 0.6m. Reshape the deck so
  every lip has a standable approach. *done-when:* **census green.** Remove
  the Deliberately-red line.
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
  over 10k steps with no stuck state. *done-when:* the fuzz check and a
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

- **P1** Verify and commit redesign phases 8–11 and the plant-room change —
  `5c6d571`, 2026-09-08.
- **P2** The headless runner — `scripts/suite.mjs`, `npm run suite`, one
  skip (frame budget) with its reason — 2026-09-08, the commit that adds
  `scripts/`. First scheduled run had stopped at the gate: the pane cannot
  start a server unattended.
- **A1** Where the Warden can stand — `src/mapground.js`,
  `map.wardenGround`, two checks — `edf7362`, 2026-09-09.
- **A3** The plant refuses before it starts — `_stepPlant` gated on
  `canDefuseAt` every step, `WardenGround.someCellWithin()` so the per-step
  call allocates nothing, one check — `f21eace`, 2026-09-10.
- **A2** `canDefuseAt()` and one shared defuse reach — `DEFUSE_REACH`,
  `withinDefuseReach()`, one check — `aef542a`, 2026-09-09.
- **D17** A climb is a press of Space, never a side effect of moving — the
  airborne mantle now needs the jump behind it or a press during the fall;
  new check `a-climb-is-a-press-of-space-never-a-side-effect`; spec 20.2 —
  `92886ec`, 2026-09-09, Josh's directive, built in his session.
