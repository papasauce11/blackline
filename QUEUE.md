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
a name, not a rank. **Closed 2026-09-11** - F1 to F4 are under Done, and
F5 (2026-09-16) and F6 (2026-09-20); the next gate job, if one is found, goes here.

## Block B — the traversal redesign, phases 12–50

The 50-phase plan is in `HANDOFF.md`. Decided: all of the interview table
there. The census is the contract; **never weaken it**.

- [ ] **B5b (M)** Rail the deck's void edges except at the lips — **blocked:
  D25.** Only if Josh picks option 2 or 3 there. A 1.0m rail, thinner than
  a body, set so the mantle's landing capsule meets it, along the hall void,
  the bay void and three sides of the vault hatch (option 2) or the hall
  void's duct crossings only (option 3); the duct-roof routes and the extra
  hatch/bay slabs come out of `map.routes`; the Warden's ground, waypoints
  and the deck patrol re-checked. *done-when:*
  `every-stacked-climb-is-a-step-of-a-declared-route` green with those
  routes removed, the census's "need a leg up" at the number D25 predicts,
  `the-warden-never-climbs-to-reach-its-ground` and the AI soak unchanged.
- [ ] **B5d (S)** The defuse reach is a clear line — **blocked: D27.**
  Only if Josh picks option 2 there. `withinDefuseReach(foot, at, collision)`
  in `systems/plantrule.js`: within the two distances *and* the charge in
  open air from some point of the segment from the Warden's feet to its
  raised hands (`DEFUSE_REACH.dy` up), asked of `map.collision`; the defuse
  in `objective.js` and `canDefuseAt()` both pass the world, so the plant
  rule moves with it. *done-when:* the census
  (`every-plant-spot-in-a-site-room-answers-to-the-defuse-rule`, tests/plantcensus.js)
  reports the duct roofs under the deck refused and says what else moved;
  a new check plants on `vent-low-north-roof`, stands a Warden on the deck
  over it and asserts no defuse starts, then stands one beside a crate top
  and asserts it does; the room-A sample of
  `every-legal-plant-has-a-warden-who-can-reach-it` is no longer defused
  through the deck; suite twice with identical answers.

## Block C — playable and testable

Decided: D4 (Josh tests what the routine cannot; do not halt for looks).
Anything here that changes a **rule** is blocking — write the question.
Anything that changes **presentation** is provisional — do it, log it under
Provisional in `DECISIONS.md`, move on.

(C1-C6 done; **Block C is closed** 2026-09-16. `PLAYTEST.md` is updated
by every Block D and E job - the queue's own done-whens include it.)

## Block D — the second map: the container yard

Decided: D2. Outdoors, similar size to the first. Container stacks give the
Shade vertical advantage that is hard for the Warden to close. The Warden has
a railed walkway reached by stairs with an overhead view, glazed, with only
small apertures to shoot through. Provisional: D9 (night, floodlit), D11
(three apertures ~0.4m), D12 (the walkway is out of the Shade's reach),
D37 (the walkway as built), D39 (the lighting as built).

(D1-D7 done; **Block D is closed but for D3b** 2026-09-19, which waits
on D38.)

- [ ] **D3b (S)** A Warden-only door at the stair's mouth — **blocked:
  D38.** Only if Josh picks option 2 or 3 there. A box the Warden's body
  passes and the Shade's does not (the first role-gated collision:
  a flag on `CollisionBox`, a filter in the swept solver's move for the
  Shade, nothing else), across the door in `WALKWAY`; option 3 adds the
  interact key, a hold time and a noise event. *done-when:* a check
  drives the Shade up the stair through `input.heldCodes` and asserts it
  stops at the door while the Warden, driven the same way, walks through;
  `nothing-climbs-to-the-walkway-and-the-warden-walks-up` unchanged.
## Block E — styling

Decided: D3 — the Shade and the Warden first, then the map. Provisional: D10
(no post-processing until the characters are done), D40 (the Shade's
figure as built). Draw-call and frame budget checks are the ceiling.

(E1 done 2026-09-19; E2 done 2026-09-20.)

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

- **F6** A look, headless. `npm run shot -- [--map id] [--out dir]`
  (scripts/shot.mjs: the suite runner's server and launch, repeated) loads
  the page once per map and calls `photograph()` (src/tests/look.js):
  both actors on the figure checks' stand (`standAndEyes`, exported from
  tests/figure.js), spread across each eye's line of sight so neither
  hides the other, a frame from every eye in open air - front, side and
  three-quarter at 4.5m, down the lane at 8m and 25m -
  `renderer.domElement.toDataURL()` after the lens's render, written to
  `shots/look-<map>-<eye>.png` (gitignored), ~30s a map.
  `a-look-at-both-figures-photographs-every-eye` (every map): a PNG from
  the front, 8m and 25m eyes always and the side eyes when in open air,
  the bodies on at least 6000 / 2000 / 300 pixels (plant 27590 / 8610 /
  886, yard 27882 / 8244 / 864). — 2026-09-20, scheduled run, commit
  `TBD`.
- **E2** The Warden. `WARDEN_FIGURE` (entities/wardenmesh.js, split out
  of enforcer.js): a domed helmet with a brim and a `wardenSteel` visor
  sat on the shoulders over a collar, no neck showing; gunmetal vest
  plates proud of the orange chest, a belt of hips over the legs (25cm
  of nothing between chest and legs before), pauldrons the widest row;
  short legs at 0.22 splayed to boots at 0.30; a rifle at the low ready
  in the right hand's part, built in that arm's frame from the rest
  pose (`riflePieces`), so the stun drops it and E3's aim can raise it.
  The carry is `arm.rest`, read by enforcer.js - the old -1.15 held the
  arms behind the back. Six merged parts on one material with vertex
  colours and six hulls grown 6mm (`part`, now in entities/parts.js,
  shared with the Shade): 12 draw calls, were 16.
  `the-warden-and-the-shade-are-told-apart-by-silhouette-at-25m`
  (tests/figure.js, every map): both figures as flat shapes from the
  same 25m eye, front and side - the Warden 40x26 (1.5:1), helmet 10px
  over shoulders 26, its middle 41% of its height ahead of its helmet
  from the side; the Shade 40x12 (3.3:1), hood 10 over 6, -3%; each
  bound the other's opposite. Spec 20.25, D41 provisional. — 2026-09-20,
  scheduled run, commit `41fb56c`.
- **E1** The Shade. `FIGURE` (entities/agentmesh.js): a hood round the
  head open at the face over a charcoal lining, a short cowl over the
  shoulders, the torso narrowed to 0.14 with its top the neck under the
  hood's rim, thin long limbs at the old pivots and reach (the hang's
  glove still lands on the lip), gloves and boots kept. Each of the six
  limb groups holds ONE merged geometry with vertex colours
  (`mergePieces`, `part`) on one toon material carrying the rim, plus
  one hull on one outline material grown 4mm per primitive
  (`grown`): 12 draw calls, were 20; no skeleton (Section 4), so
  agentvisual.js poses the same six groups unchanged.
  `materials` is `{ body, outline }` and detection scales `body.color`.
  `the-shade-reads-as-a-hooded-figure-at-8m-and-25m` (tests/figure.js,
  every map): a flat-white silhouette from a clear lane, 3.4:1 tall,
  hood 28px over neck 11px at 8m and 10 over 6 at 25m, six parts, one
  material, 12 calls. Spec 20.24, D40 provisional. — 2026-09-19,
  scheduled run, commit `d063252`.
- **D7** The regression set whole on every map. `src/tests/anymap.js`:
  five checks that search the map they are on, one for each clause the
  plant's five named checks held in the set -
  `a-body-driven-into-any-solid-never-passes-through` (check 1: from
  every site and Warden spawn, four headings, 6.5/50/200/1000 m/s,
  every step's path swept by hand against every solid taller than a
  step, so a tunnel that lands in open air is caught),
  `every-declared-route-is-driven-from-the-ground-to-its-landing`
  (check 3: `map.routes` stage by stage through the controller from
  walkable ground, forty frames to settle, feet on the top in open
  air), `no-climb-the-rule-names-rises-through-a-solid` (the mantle
  check's three generic clauses, factored to `mantleClauses` in
  tests/routes.js and shared with the plant's check),
  `a-lamp-lit-site-reads-lit-and-the-darkest-ground-reads-dark`
  (checks 8 and 9: the brightest site at least `LIT_METER` with
  headroom, the darkest of a 2m grid over the Warden's ground under
  25), `a-round-stops-at-cover-and-reads-the-head-line` (a clear lane
  for the head line, three pieces of cover found among the solids).
  The plant's five stay in the full suite as they were and out of the
  set (their spec lines no longer claim the number; `regressionChecks`
  names the generic ids). `the-regression-set-resolves-to-real-checks`
  is red on any map where the set has a check for another map or an
  uncovered number. U: 29 checks on the plant and 29 on the yard, 0 not
  for this map, every number covered. Spec 20.23. — 2026-09-19,
  scheduled run, commit `83ec7fc`.
- **D6** Both maps in the gate. `npm run suite` runs every map the
  registry lists (`registeredMapIds()`, scripts/suite.mjs, reads
  `src/maps/index.js` as text), twice each, judged per map; `--map`
  narrows, `--regression` runs the page's regression set per map and
  times it. `AutoSuite.regressionSet()` resolves the set for the map the
  page is on - what runs here, what is registered for other maps, which
  Section 16 numbers only those cover - `runRegressionSet` says it in
  the console, and `the-regression-set-resolves-to-real-checks` holds
  the split on every map. The menu's default was `plant` already (D1,
  `DEFAULT_MAP_ID`). Measured headless: the plant's set 29 checks in
  60s, the yard's 24 in 24s (5 are the plant's - D7); the done-when's
  "under 20s" is a GPU-tab number this machine cannot read, and
  PLAYTEST.md asks Josh for it. Plant 154 passed, 1 failed, 6 not for this map, yard 137 passed, 1 failed, 23 not for this map, twice
  each, 0 red, 0 flaky. — 2026-09-19, scheduled run, commit
  `ddb702a`.
- **D5** AI on the yard. `litLane(h, length, stands)` (tests/lanes.js):
  a clear run the map's lamps light to half the meter at every stand;
  `ai-state-machine-follows-section-11`,
  `each-difficulty-is-quicker-to-see-you-and-quicker-to-kill-you` and
  `the-warden-fires-in-bursts-of-rounds-at-the-torso` stand on it and
  run on every map (the plant: `hall-north`, D33's table unchanged; the
  yard: north from site C up the gate lane, 63 / 80 on the meter, kills
  within a third of a second of the plant's). Two AI fixes on every map
  (ainav.js, spec 20.21): a goal within `ai.directRouteRange` (10m) is
  planned over the ground from the Warden's feet, not by way of the
  graph node nearest it (which on the yard stood beyond the noise - the
  Warden walked past the Shade); and stuck means a route not yet reached
  (`_meansToMove`) - a kneeling Warden was re-pathed every 2s of its
  defuse and walked off to the nearest node and back, twelve times in
  nine rounds. `the-warden-plays-three-matches-on-this-map-without-a-
  stall` (tests/aisoak.js, every map): three best-of-fives, every round
  from a different spawn to a different site, all defused on the clock,
  feet on the ground every step, a camera every match, at most three
  re-paths (0 on both maps). — 2026-09-19, scheduled run, commit
  `fa57703`.
- **D4** Yard lighting. Night (D9): four floodlight masts (`MASTS`,
  `MAST`, maps/yarddata.js - a pole and an arm thinner than a body, the
  lamp 6.5m up over bays A, B, C and the gate) and a fifth lamp under
  the walkway's floor; the lamps 2.5x the plant's pendants (C's half);
  `addLightRig(rig)` takes the map's numbers (hemisphere 0.2, a cool
  fill 0.14 from overhead, the key 0.3 warm) and `aimKeyLight` points
  the one shadowed key from bay C's mast head - the mast that covers the
  most Warden ground inside the ring, 2274 cells - at the centre, 28°
  up. `lit-pools-and-dark-gaps-are-actually-contrasty` green on the
  yard: 26.9 / 24.5 / 21.0 over a sky of 8.1 / 3.0 / 8.1. Checks
  (tests/yardlight.js): `the-yard-is-floodlit-from-masts-at-night`
  (the masts, the key's mast by count, its aim, colour, elevation),
  `the-yard-is-dark-between-its-pools` (gaps and a key shadow under half
  the dimmest pool and above black, the sky under a third of the
  brightest pool). Found: the plant's fill colour lands nothing.
  Spec 20.20, D39 provisional — 2026-09-18, scheduled run, commit
  `e5e55cb`.
- **D3** The Warden's walkway. A glazed run 7.2m up over the mid lane's
  north edge (`WALKWAY`, maps/yard.js), one flight of 24 treads up the
  west side of the gate lane (`addStaircase` takes `steps`), rails both
  sides, a metre of parapet, glass to a roof at 2.3m, three slots (0.4 x
  0.95m: end faces to bays A and B, the south face to C), the door the
  stair's mouth. Glass is `addSolid({ glass })`: solid to a body, a round
  and a blade, nothing to a line of sight. The knife gained the world
  test it never had (open air torso to torso, every solid box; spec
  20.19). Checks (tests/walkway.js): `the-walkway-is-glazed-and-shoots-
  only-through-its-apertures` (4 eyes x 40 points, the real gun through
  the west slot and at the pane, the real knife the same),
  `nothing-climbs-to-the-walkway-and-the-warden-walks-up` (D12's
  sentence over the geometry, the rule with and without a staged perch,
  the human Warden up the stair and along the run),
  `a-knife-stops-at-a-wall-a-body-cannot-pass` (every map). Found: the
  Warden's ground walked the container deck from the ninth tread until
  the stair got its west rail. D37 provisional (as built), D38 blocking
  (may the Shade walk the stair) — 2026-09-18, scheduled run, commit
  `8d189d4`.
- **D36** The tap window for a hang is 0.30s from key-down (grab +
  `hangHoldDelay`), not the 0.18s grab alone — a 250ms tap went over; the
  tap/hold check now has a 250ms tap and a 500ms hold — 2026-09-17, Josh's
  session.
- **D2** Yard blockout. `maps/yard.js` and `maps/yarddata.js`: inside
  the site fence a 60 x 42 working yard walled by a ring of one-high
  containers with a gate north and south and a 40ft laid across each as
  an arch (the Warden under, the Shade over; the ring's tops one
  surface); bays A and B either side of the gate lane, each walled by
  the ring and two 12m rows and open at the corner they leave, C across
  the south with the lane's gap and the rear gate; a two-high stack in
  A and B, a three-high on C's west wall, storage blocks of stacks
  either side of C; pallets (every route's first step on foot), a skip,
  a flatbed trailer (its crawl space the yard's "inside anything"), a
  gatehouse with a one-face pallet slot. The container is a 2.9m high
  cube (D35): one high a jump and a grab, two high needs a stack. 71
  boxes, 21 waypoints, 9 routes; every row and stack touches the ring
  so the one-high tops are one connected deck. Checks (tests/yard.js):
  `the-container-tops-are-one-connected-deck`,
  `one-high-is-a-jump-and-two-high-needs-a-stack`; `plantableSpots`
  enumerates crawl spaces and the inside-anything checks take them; the
  room-entry derivation splits a run at a sill change (found under bay
  B); five open-floor checks find a lane on the map they run on
  (tests/lanes.js) and the hang-under-a-lid case searches for a lidded
  lip; three lit-lane AI checks scoped to plant for D5. On the yard:
  127 passed, 2 failed (the frame budget skipped; `lit-pools`, D4's),
  26 not for this map; the census 58 surfaces, 163 approaches, 11 leg
  ups all on routes; 151 of 151 approaches climbed. Spec 20.18.
  `cafc97f`, 2026-09-17, scheduled run.
- **D1** Map plumbing. `src/maps/index.js` is the registry (`plant`:
  "Meridian Substation", `src/map.js` and `mapdata.js` moved to
  `maps/plant.js` and `maps/plantdata.js`; `yard`: "Container Yard",
  `maps/yard.js`, an empty fenced plane with three open bays, three
  sites, the spawns, four lamps and eight waypoints - D2's to replace);
  `buildMap(id)`, `requestedMapId(search)` for `?map=`, `mapUrl()` for
  the menu's *map* row, which reloads the page on the next map keeping
  the seed and the gate (D34). `GameMap` carries `id` and `name` and
  places sites and spawns (`addSite`, `addShadeSpawn`, `addWardenSpawn`)
  and the shared light rig (`addLightRig`) itself; `validateMap(map,
  expects)` takes each map's own counts. The suite is parameterised over
  the map: `maps: ['plant']` on the 23 checks that name the substation's
  geometry, reported *not for this map* elsewhere and never run there;
  the runner takes `--map plant,yard`, loads the page per map, judges
  red and flaky per map and refuses a page that booted a different map
  than asked. Yard census: 108 green, 21 honestly red (nothing to climb,
  no wall to mount on, no perch in a site room), listed under D2. Checks
  (tests/maps.js): `every-registered-map-builds-and-the-page-is-on-the-one-its-url-asked-for`,
  `the-menu-offers-every-map-and-its-map-row-asks-for-the-next-one`,
  `a-check-registered-for-another-map-is-reported-not-run`; the briefing
  check requires the map's name. Spec 20.17. `5ee5798`, 2026-09-17,
  scheduled run.
- **C6** `PLAYTEST.md` for Josh: how to run it (the playtest build,
  `?debug=1`, `?seed=`, the settings), what to look at newest first (the
  Warden shooting straight with D33's numbers, the briefing and end
  screens, the feedback, climbing without markings, where you may plant -
  each with the checks that hold its mechanics and what is left for
  eyes), what cannot be verified without eyes (the frame budget on a GPU,
  looks, sounds, feel, the Warden as an opponent), known issues and open
  questions (D27, D25, D8, D33), and how to answer. `HANDOFF.md` links it
  at the top. Check `playtest-md-exists-is-linked-and-names-real-checks`
  (tests/donedef.js): the four sections, every backticked check id
  registered, HANDOFF.md mentions it. `866b2c2`, 2026-09-16, scheduled
  run.
- **C5** The difficulty pass, driven by the checks. The preset values
  (`ai.difficulty`: fill, aim cone, reaction delay) were already in
  config and are unchanged; the instrument found the gun.
  `each-difficulty-is-quicker-to-see-you-and-quicker-to-kill-you`
  (tests/difficulty.js): a lit, still Shade 8m and 16m up the hall lane,
  eight seeds per preset, time-to-detect and time-to-kill both required
  to fall from each preset to the next in config order. Its first run:
  0 of 52 rounds hit on every preset - ENGAGE aimed at `lastKnown.y`,
  the Shade's feet; a "burst" was 3-7 steps, one round, sometimes two;
  the aim error was a pitch-only bias held for the whole fight. Now the
  gun aims at the torso the eye sees, a burst is 3-7 rounds counted as
  the gun fires them (`combat:shot`), the cone is yaw and pitch redrawn
  per burst (`_drawAimError`); and god mode covers the rifle
  (`Combat.isGodMode`), which only ever guarded the frag. Measured:
  8m detect 7.35/4.97/3.60s, kill 0.86/0.51/0.35s; 16m 13.6/9.3/6.7s and
  7.2/1.4/0.9s. `the-warden-fires-in-bursts-of-rounds-at-the-torso`
  holds the burst, the aim point and the god mode. Spec 20.16, D33
  (provisional: the Warden is much deadlier than any playtest has had).
  `072cc8d`, 2026-09-16, scheduled run.
- **F5** `the-death-camera-frames-the-killer` was red run alone because
  the first draw of its view at site A compiles for 39s headless, the
  first `readPixels` blocked on it, and the death camera's 16.5s
  wall-clock guard fired under the read: the Shade was force-reinserted,
  the camera went to the origin, the check read nothing. In the full
  suite an earlier check at site A had paid the compile. The check warms
  its own view (one `renderFrame` and a `readPixels`) before the kill,
  listens for `deathcam:guard` and names it if it fires, and reports the
  warm time. No threshold moved. `6bef575`, 2026-09-16, scheduled run.
- **C4** The round and match end screens say how. `OUTCOME` (detonated /
  defused / eliminated / time) recorded by `_end()` on the round and the
  record; `round.timeline` (`{ t, text }`: begins, the plant, each life
  lost and reinsert, each Warden down, the end) logged by the objective
  and copied into the record; `roundEndDelay` honoured - `_stepEnded()`
  counts it on the sim clock and emits `objective:intermission`, which
  the wiring shows the scoreboard on and restores the death camera on
  (it used to stay up under the card after the third life, until the
  next round or the wall-clock guard); `round-end` is a HUD line.
  `ui/scoreboard.js`: `round 3 to the warden · the Warden defused the
  charge`, the match's tally of how, the timeline (five lines: all, or
  the first and the last four), a *how* column; `sayOutcome()` exported.
  Play calls `resetMatch()` itself. `systems/roundstate.js` split from
  objective.js (602 -> 521). Checks (tests/roundend.js):
  `the-end-screen-says-who-won-and-how-each-way` (four rounds, one
  match, each way through the step; the delay, the death camera, the
  text, the cap; the match screen) and
  `play-from-the-main-menu-starts-a-fresh-match`; the briefing check and
  the state-machine fuzz step through the delay. Spec 20.15, D32 (provisional), README.
  `a5d8918`, 2026-09-16, scheduled run.
- **C3** Hit and damage feedback. `systems/feedback.js`: one screen-space
  quad with a shader, drawn by the renderer over the scene (so the pixels
  see it), invisible while idle; the hit marker (four strokes on the
  centre, `hitMarkerTime`) on `combat:knife-hit`, `gadget:taser` and, as
  the Warden, `combat:impact` on the Shade; the damage arc (a ring at
  `indicatorRadius`, toward the source, recomputed as the camera turns,
  `indicatorTime`) on `combat:damage` events that carry `at` - the rifle
  passes its muzzle, the frag its blast through `gadget:damage.at` and
  `combat.applyDamage(..., from)`; the vignette (`vignetteColor`,
  `vignetteMax` at no health) from the human actor's health, nothing
  while dead. `feedback.warm()` compiles the program at boot so the soak's
  program count holds. `boot.js` split from main.js (`bootWorld()`,
  594 -> 470). Three checks (tests/feedback.js): the vignette measured
  over the outer band somewhere lit, monotonic, the centre 40% untouched,
  nothing drawn at full health; the knife through F, the mark centred and
  bounded, a miss draws none; the arc right/left/behind/ahead from
  `applyDamage` with a source at the camera's own axes, no source no arc,
  gone on its clock. Spec 20.14, D31 (provisional), README. `3510bf4`,
  2026-09-15, scheduled run.
- **C2** Round-start briefing and controls card. `ui/briefing.js`: a DOM
  card raised by `panels.js` on the player's routes into a round (Play,
  Free roam, Next round) and never by `initMatch`; per role the objective
  in one line with the round's own numbers, the three sites as `id name`
  from `map.sites`, the controls read from `input.bindings`; it holds the
  round (`held = paused || briefing.open` in the frame) and the HUD is
  not drawn behind it; any key or mouse button dismisses it through the
  Input in the frame, and the press is spent (`briefing.dismiss(input)`).
  `SETTINGS.briefing` (default true) and the settings row *round briefing*
  (`#bl-brief`). Found and fixed: Next round reset the round number to 1
  through `initMatch` - it takes `round` now. Checks
  `a-round-opens-on-a-briefing-that-any-key-dismisses` and
  `the-briefing-follows-the-round-and-the-setting-skips-it`
  (tests/briefing.js). Spec 20.13, D30 (provisional), README. `f9c249d`,
  2026-09-15, scheduled run.
- **C1** Playtest build. `DEBUG` is gone; the gate is `SETTINGS.debug`,
  seeded false (`CONFIG.settings.defaults.debug`), read live by the step,
  `ui/debug.js` and `bootMatchOptions`; `?debug=1` (`debugRequested()` in
  config.js, applied in main.js before bootstrap) or the settings menu's
  *debug tooling* row turns it on; off with a panel up, the next frame
  takes it down. `window.BLACKLINE` in both builds; `AutoSuite.runChecks()`
  holds the gate up for a run and puts it back, so `npm run suite` and the
  console still work. `panels.js` split from main.js (603 -> 583). Check
  `with-the-debug-gate-off-every-debug-key-does-nothing` (tests/debuggate.js):
  on, F3/F4/T are live; off, 15 keys through `pollKeys()` change nothing.
  Spec 20.12; README. `b430771`, 2026-09-15, scheduled run.
- **B8b** The B5c check asks the gantry case of the geometry.
  `supportApproaches(collision, box, { sweep })` (mapclimb.js) can name
  what the rule named before B8's sweep; `a-mantle-never-passes-through-a-solid`
  (tests/routes.js) takes every such approach - 159 - and asks the geometry
  on its own (`riseThrough`: the crouched capsule along `movePath`, 16
  samples, AABB overlap by hand, no call to `riseIsClear`) whether the body
  rises through a solid above the landing; the rule's answer must match
  exactly both ways (9 refused, 150 named, no disagreement); and at each of
  the nine it drives the controller (`driveAtFace`: W and Space held from
  the spot) requiring a scuff with the feet never over the top. The nine
  are B8's nine by name: vent-low-north-lip-to +z/-z, vent-low-south-lip-from
  +z/-z, vent-low-south-lip-to +z/-z, vent-up-vault-lip-from +x/-x (out of
  reach), hall-container +z through gantry-hall. Two mutations proven red
  (the rule's sweep off; the controller's sweep off). `db695ed`,
  2026-09-15, scheduled run.
- **B9** Close. Spec 20.11: Sections 5 (the markings withdrawn for material
  and light, the traversal line round the eight declared routes), 6.1 (the
  band rows withdrawn for one reach rule, the press, the hang, the tell,
  the feel, the Warden's ground), 16 (checks 6 and 26 rewritten, the
  regression set widened) and 18 amended by reference to 20.2-20.10.
  `CONFIG.debug.regressionChecks` names the redesign's nine checks by id
  and `runRegressionSet()` runs them with the numbered set (20 -> 29 of
  139); `the-regression-set-resolves-to-real-checks` requires every id to
  exist. `the-warden-never-leaves-its-ground` (tests/wardenground.js):
  4,200 steps of AI-driven patrol, hunt and a defended plant, the feet on
  `map.wardenGround` every step (airborne only within a metre over it - a
  stair walked down). It found the AI planning from its centre, which from
  the deck picked a corridor node six metres below and walked the body off
  the deck edge onto site A; `_pathTo()` plans from the feet now. README
  climbing and `U` sections rewritten. `f4c2f8d`, 2026-09-14, scheduled run.
- **B8** Feel. Momentum carries into a vault (`vaultDurationAtSprint` 0.28,
  `vaultCarry` 0.85: a sprint leaves a crate at 5.5 m/s, a walk at 4.2 as
  before); a landing has weight (`shade.landing`: nothing under 1.2m, all of
  it from 4m, half the speed cut and held for 0.4s, the camera and the body
  showing it); the camera dips on a vault, mantle or pull-up and not on a
  grab (`camera.climbDip` 0.22, `landDip` 0.3, `dipRecovery` 0.26, a
  critically damped spring in agentvisual.js); the jump buffer runs in
  every state (a press in the last 0.12s of a fall or a climb fires on the
  landing or the top; spent by a climb or a scuff); the hanging body is at
  full stretch (`hangDrop` 2.05, arms straight up, gloves on the lip, the
  capsule's top under it; `hangPullUpDuration` 0.65), so hall-container's
  south face under gantry-hall hangs and its pull-up scuffs. And the rule
  that found: **the way up is swept** - `riseIsClear` / `movePath` in
  climbprobe.js, said by `riseFits` (mapclimb.js) and `_climbOnto`
  (agenttraversal.js): the capsule along the move's own path against every
  solid above the landing; nine approaches went (146 -> 139), one under the
  gantry and eight through the duct walls that stand on every lip's side
  edges. `agentslide.js` split from agent.js (601 -> 546); the runner takes
  `--details FILE`. Seven checks: tests/feel.js (four), tests/hang.js,
  tests/traversalfuzz.js (the 10k-step fuzz at every spot the rule names,
  and the recovery check). Spec 20.10, D29 (provisional). `fb68243`,
  2026-09-14, scheduled run.
- **B7** Legibility — route lighting. `src/maproutelight.js`, `lightRoutes()`
  after the climb rule: every stage of every declared route (`map.routes`)
  has its four sides painted with its own colour as emissive
  (`map.routeLighting.emissive` 0.12, the material cache's `lit` variant,
  two material groups per box), and the edge each route goes over at the
  top - the part of the landing's face the rule names a climb onto from the
  last stage, `edgeReach` either side of the spots - carries a warm-white
  unlit strip, 15 of them in one mesh. Paint, not lamps: nothing the
  detection model reads. Check `every-route-reads-lit-from-its-foot`
  (tests/legibility.js): from each route's foot the first stage reads ≥ 10
  luma over the same stage painted unlit (16-27 measured) and ≥ 0.25
  Michelson against its surround (0.30-0.61); from the last stage each
  strip reads ≥ 0.5 (0.72-0.98); the strips are one draw call. Spec 20.9,
  D28 (provisional). The first cut lit the tops too and put B6's mouth
  check red at the north duct's west mouth (surround 76 against 118); the
  sides only, and it reads 0.27 as before. No bevel: the strip is the edge
  profile. `d063701`, 2026-09-14, scheduled run.
- **B5c** A mantle never passes through a solid. `handsOverTop()` in the
  new `src/climbprobe.js` - the hand sweep's constants and the one sentence
  the rule (`mapclimb.js`) and the controller (`agenttraversal.js`) share:
  once the hands meet a face, the column above the body must be open air to
  the top of that face, or the press is a scuff. Five approaches went, all
  from under a duct floor (151 -> 146); `vent-low-north-lip-from` is no
  longer climbable (58 -> 57); `hall-vent-north` redeclared (8 routes, 22
  stages); check `a-mantle-never-passes-through-a-solid` (tests/routes.js);
  spec 20.8. The census red it left was a pathing bug the new room-A sample
  exposed: `WardenGround.route()` pulled a line across the hall void's
  corner with six millimetres of deck under the footprint, and the follower,
  cutting the bend from `waypointArriveRadius` away, walked off the deck.
  `ai.routeEdgeMargin` (0.6): a pulled segment keeps ground under the two
  lines that far to either side of it (`groundUnder()`, support only, a
  wall beside is a slide); `the-last-leg-to-every-legal-plant-is-planned-and-short`
  asks the same of every pulled segment by ray and went red on the old
  routes at the hall void and the vault hatch. `src/groundprobe.js` split
  from mapground.js (628 -> 539) for the 600-line guard. Raised D27 (the Warden now
  defuses that roof plant from the deck above it, through the slab) and
  B5d behind it. WIP `069bc08`, then `6d13f68`, 2026-09-13/14, scheduled
  runs.
- **B6** Legibility — material language. `palette.ductMetal` (galvanised
  sheet, 0xc6d0d6) on every piece of every vent run, where the ducts were the
  floor's own dark concrete; the palette comment states the language
  (concrete is what you do not pass through, metal is what you pass through
  or climb). The vent record carries its `boxes` and `mouths`. Check
  `every-vent-mouth-reads-by-contrast-from-its-approach`
  (tests/legibility.js): from the spot the rule names for a lip or level
  floor out from a walk-in, the duct and what is seen through the opening
  each ≥ 0.25 Michelson against the surround, nine mouths, 0.27–0.81 (was
  0.01–0.23 at eight of nine with concrete ducts). Spec 20.7, D26
  (provisional). Found B5c - `2e12d0e`, 2026-09-13, scheduled run.
- **B5** The area pass, measured honestly. The census's "needs a leg up"
  was an artifact (it counted the office desks and missed two fire-escape
  flights); it now means "no climb from ground a walking body reaches"
  (`map.wardenGround`), and the honest count is **21**, every one a stage or
  a landing of a declared route. Two rule/controller disagreements the
  one-climb-per-box census could not see, both fixed: the controller's
  sweep stopped at a climbable face whose climb could not commit (a duct
  floor's side) and never reached the roof the rule promised from the hall
  floor — `_climbAhead()` sweeps past it; and the rule reached
  `vaultReach` for every rise where the air probe reaches `mantleReach` —
  `handReach()` in mapclimb.js. `map.routes` declared (mapdata.js, eight
  routes, `stairlessRouteMin` 5 asserted at build); spec 20.6; D25 raised
  (rail the void edges, or accept the duct-roof routes). No geometry
  changed: measured honestly, the map had no dead climb and no accidental
  route the rule does not read as a route. Three checks:
  `every-approach-the-rule-names-is-a-climb-the-controller-makes` (151 of
  151), `every-stacked-climb-is-a-step-of-a-declared-route`,
  `every-climbable-top-has-an-exit-that-is-not-the-way-you-came`
  (tests/routes.js). The done-when's "≤ 10" was written against the
  artifact and is not reachable without deleting route steps; replaced by
  "every stacked climb is on a declared route", which is what it was for -
  `542436b`, 2026-09-13, scheduled run.
- **B2b** The scuff as a noise the Warden hears (D23: quiet, a footstep's
  worth): `Shade.scuffedAt` on the step, Detection emits `scuff` at the hands
  with `noise.radii.shadeScuff`; spec 20.5 amended; check
  `a-scuff-is-a-noise-the-warden-in-the-room-hears` - `ae8725e`,
  2026-09-12, Josh's session.
- **B4b** The landing is part of the approach: `landingSpot()` /
  `landingFits()` in `mapclimb.js` mirror `Shade._ledgeDestination` and
  `_commitMove`, `supportApproaches()` drops a spot the body cannot land
  from, the quarter-point "standable somewhere" test is gone from the
  derivation and the check, the derivation resets `climbable` on every box
  (so the last declared `climbable: true`, on `hall-container`, is gone with
  the option). Census identical, 58/226/191/22. Check
  `a-face-with-nowhere-to-land-is-not-climbable` - `34b0510`, 2026-09-12.
- **B4** Upper deck: the vault's rack aisles widened to 1.5m (`RACK_AISLE`)
  so a Warden ground cell runs down each and every clear floor spot in every
  site room is a legal plant (0 refused at 0.1m; was 150 across both aisles,
  one on the census grid); the bay void, gantry and lip re-laid so the gantry
  stands in the open and `lip-bay` is climbed standing from a spot the rule
  names, the whole route 1.2m south of `office-wall-s` so the deck beside the
  void has a landing. Census 58 climbable / 226 approaches / 191 climbs / 22
  need a leg up. Two checks in `tests/deck.js`; A3's opening step re-picks
  its perch. B4b raised - `7bec4fc`, 2026-09-12.
- **B3** A support is somewhere you can stand and get your hands on the
  face: `supportApproaches()` in `mapclimb.js` replaces the footprint test
  with the controller's own hand sweep from a spot in front of each face;
  `deriveClimbableSurfaces` takes the tallest approach in reach; the census
  stands at the rule's spots too and `the-climb-rule-has-no-exceptions`
  recomputes from them. **Census green**: 56 climbable, 208 approaches, 173
  climbs, 20 need a leg up; nine surfaces (six deck slabs, three roof slabs)
  stop deriving, each for a reason the geometry gives. Deliberately-red list
  emptied; B4 re-scoped - `ce75dce`, 2026-09-12.
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
