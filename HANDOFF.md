# Blackline — handoff

**Read this first.** Then `QUEUE.md` (the work), `DECISIONS.md` (what waits
on Josh, and what he has decided), `PLAN.md` (the protocol a session follows),
and `TRAPS.md` before you touch anything — thirty-odd environment traps, an
hour each, which lived in this file until G2. `BLACKLINE_SPEC.md` is the
contract; `PROGRESS.md` is the full append-only history — read the last entry,
and the entry named in the index below for whatever you are about to touch.
`PLAYTEST.md` is Josh's: how to run it, what to look at, what only eyes can
judge, what is known to be wrong — every Block C, D, E and H job updates it.

This file is orientation, not history: every run reads it and pays for every
line, so a job's write-up goes in `PROGRESS.md` and gets one line in the index
here (G1). `traps-md-holds-the-traps-and-handoff-points-at-it` keeps it under
**400 lines**, and a job that adds to it takes something out — which is the
point.

## Last audit

2026-09-27, HEAD `c5856f8`: plant 184 / 1 / 8, yard 165 / 1 / 27, 0 red, 0
flaky, 0 console errors; live site 29/29 per map, Pages built at HEAD, stamp
one behind (normal); 62 commits and 26 jobs that week, 0 WIP, 0 blocked on
Josh; no check deleted, no threshold loosened; 0 TODO/FIXME. Its one finding —
`20260927` turning the yard's difficulty check red — was **F17, done the same
day**: easy's aim cone, wider at 16m than a body is. The 09-18 orphan runner
is 9 days old and still competes with every run. Full report: PROGRESS.md.

## Where things stand

| | |
|---|---|
| Branch | `phases-14-45` — ahead of `main`, not merged; Josh merges |
| Merge with | `git checkout main && git merge --ff-only phases-14-45`, then `git push origin main` |
| Hosted | **https://papasauce11.github.io/blackline/** — a branch deploy of `phases-14-45`, rebuilt on every push (H2). Remote https://github.com/papasauce11/blackline; every commit is pushed (H1). `npm run suite -- --url https://papasauce11.github.io/blackline/ --regression` checks the live copy. **Which build a friend is on** is the main menu's footer, from `version.json` (H3) — live and reading `2af44b2 · 2026-09-27`, both H3 checks 2/2 per map against the Pages URL: `npm run stamp` writes it from git and only from a clean tree, so `npm run suite` stamps HEAD at the gate and leaves it alone mid-job — **and the `Record <job>` commit runs `npm run stamp`** so the deployed stamp names the job rather than the commit before it (D52; there is no deploy workflow and cannot be one from here) |
| Working tree | clean after H9 (2026-09-29) |
| AUTO suite | headless, `npm run suite`, **both maps since D6**, twice each. **2026-09-29, after H9: plant 201 passed, 1 failed, 8 not for this map (1,075,014ms, 1,080,531ms), yard 181 / 1 / 28 (752,439ms, 743,908ms), exit 0, 0 red, 0 flaky, 0 console errors, 0 context losses, 0 skips withheld.** Three more per map than the pair after H8 (plant 198, yard 178): H9's three. Every run line names how much of it was the renderer's pipeline tail (plant 470,599ms and 471,972ms, yard 351,630ms and 343,346ms) instead of leaving it inside one check (F11), and a line per map names the spread between its runs — **plant 5,517ms (1% of the longer) and yard 8,531ms (1%)**, against 177,215ms and 23% in the last pair before F11 (F16). **Read the spread line before comparing any timing here to a `PROGRESS.md` number, and read the total against nothing at all**: the gate before this verify took nearly two hours of wall clock for 1,719s of measured work, on a machine with **four** orphaned runners on it rather than two and the same `throttle: 4/8 cores (9 processes pinned)`. The one failure on each map is the frame-budget check, skipped headless, and since F15 that skip is honoured only where `the-headless-skip-list-holds-only-the-check-it-declares` is green. The Deliberately-red list in `QUEUE.md` is empty. The regression set (`--regression`, or F4 then U) is whole on every map since D7: plant 29 checks in 58s headless, yard 29 in 25s |
| Next job | **The second arc** (2026-09-25, D50): Blocks H, K, M, J, I, L, N, O in `QUEUE.md`, in that order. H5 to H9 are done, so the next job is **H10** (quality presets: low / medium / high / auto over the shadow map, the post, the resolution scale, the particle caps and the outline, with auto picking from a two-second frame-time probe on first boot, M). H9 left `CONFIG.settings.defaults` the place a setting is declared and `_changed()` the one call that saves it, so a preset row H10 adds joins both lists by existing — and it left two follow-ups of its own, **H21** (H7's store validates a stored number by type and not by range, so a hand-edited `fovShade: 500` is accepted) and **H22** (the settings page is thirteen rows and wants the grouping H20 was written for). Every H job proceeds; nothing in the block is blocked. H17 and H18 are H5's follow-ups and wait on D55 |
| Waiting on Josh | nothing blocking. **D59** (H9) is the newest Provisional and the one with a number a player can feel: the FOV sliders run **60–100**, which is the only range in the settings a player could gain something from — narrow `CONFIG.settings.fovMin`/`fovMax` and both sliders narrow with it. It also holds the Warden's aim narrowing to 52 **absolutely** from whatever FOV was set, and **head-bob shipping off** (it is the option players most often turn off, and off is the camera every reading on record was taken against; `PLAYTEST.md` asks him to switch it on). Then **D58** (H8: a rebind replaces the first key and keeps the alternate) and **D57** (what a browser keeps, and that the debug gate is not kept). **D55** (the main menu as built) is the one with a real question inside it: the plant is a sealed shell, so its card is its roof, and showing its inside needs the roof hidden for the render — that is **H17**, and it waits on his word. **D56** is the newest Blocking and is genuinely a rule: there is no Shade AI, so "play the Warden" can only mean free roam; nothing is blocked on it. **D54** (easy's aim cone 5.0 → 4.0) is the one a player can feel; **D52** (the build stamp) and **D53** (what boot says) are worth a glance. The Provisional section stays open for override, and the things only eyes can settle are under *Still needs a human* |
| Source | no module in `src/` over 600 lines except `config.js` (a table, exempt in PLAN.md, 1,809 lines after H9); `no-source-file-outside-config-is-over-600-lines` holds it, and it counts **every module the page loaded, `tests/` included**. H9 added `src/tests/camerasettings.js` (423) and left `src/entities/pose.js` at 126, `src/cameraowner.js` 133, `src/ui/menupages.js` 378, `src/input.js` 398. **`src/physics.js` is at exactly 600 and `tests/movement.js` at 599** (then `systems/combat.js` 593, `tests/visual.js` 589, `maps/plant.js` 585) — the next line added to any of them turns that check red, so the job that touches one splits it first rather than discovering this halfway through a verify. `src/main.js` is 538, `src/mapground.js` 543, `src/mapkit.js` 532, `src/ui/autosuite.js` 499, `src/tests/donedef.js` 504, `tests/menu.js` 489, `tests/difficulty.js` 554. Outside `src/`, `scripts/suite.mjs` is 549 and `scripts/watchdog.mjs` 205. **This page is kept under the 400 lines `traps-md-holds-the-traps-and-handoff-points-at-it` allows** — a job that adds to it takes something out, which is the point of G1 and G2: H9 paid for itself out of the Block H paragraph. 0 TODO/FIXME; one `Math.random` (the audio noise buffer) and one `setTimeout` (the performance check), both documented exceptions, and since F13 the gate holds that census |
| Runtime assertions | 8, zero failures |
| Map, plant | 214 collision boxes, 57 climbable, Warden ground one connected component with a column of cells down each vault rack aisle. **8 declared routes, 22 stages** (`map.routes`); 21 surfaces that need a leg up, every one a stage or landing of a route; **139 of 139** approaches the rule names climb |
| Map, yard | 132 boxes, 58 climbable, 5 lamps, Warden ground 15,332 cells in one component, 21 waypoints, **9 declared routes, 20 stages**, 11 surfaces that need a leg up, every one on a route; **151 of 151** approaches climb; 44 container tops one connected deck; the walkway's floor and roof have no approach at all |

Phases 1–49 of the original build are done and committed. The **redesign** (the
50-phase plan, below) closed at B9, 2026-09-14; its two remaining questions went
2026-09-21 (B5b dropped on D25, B5d built on D27). Blocks A–G are all closed.

## What was built, and where it is written up

Every `PROGRESS.md` entry is titled with its job id — `grep "^## E4" PROGRESS.md`
— and holds the whole write-up. Read the one for whatever you are about to touch.

**Block A — the plant must be defusable.** A1 the Warden's ground · A2 the reach ·
A3 the gate on every step · A4 the HUD refusal · A5 the census · A6 no plant inside
things (D20) · A7 the ground drawn · A8 the AI's last leg planned over it. The
rule is kept below.

**Block B — the traversal redesign, phases 12–50.** B1 hang as a held option · B2
the bump-and-scuff, so a failed climb is never silent · B3, B4 the climb census goes
green and the map answers it · B5, B5c the area pass measured honestly, routes
declared · B5d the defuse reach is a clear line (D27) · B6 the material language ·
B7 the routes are lit · B8 feel · B9 closed, spec 20.11. B5b dropped, D25.

**Block C — playable and testable.** C1 the playtest build, the debug gate off by
default · C2 the briefing · C3 hit and damage feedback · C4 the round and match
end screens · C5 the difficulty pass · C6 `PLAYTEST.md` · C7 the site is a
tinted floor and the HUD names it (D8).

**Block D — the second map.** D1 the registry, `?map=`, the suite per map · D2 the
yard blocked out · D3 the Warden's walkway · D4 the yard at night · D5 the AI on
the yard · D6 both maps in the gate · D7 the regression set whole on every map.
D3b dropped, D38.

**Block E — styling.** E1 the Shade's figure · E2 the Warden's · E3 animation ·
E4 the plant's materials · E5 the yard's · E6 post-processing.

**Block F — the gate itself.** F1 a lost GL context is caught and the check
re-run · F2 the presentation reset before every check · F3 eight modules split
under the ~600 guidance (the map is kept below) · F4 the game does not play
itself under the suite · F5 the headless runner · F6 `npm run shot` · F7 a
look at a pose · F8 the key light gives nothing to a face it lights from
behind · F9 `npm run probe` · F10 a hung gate dies and says which check hung ·
F11 a quarter of a run was one `gl.getError()` waiting, and D48 put that wait
on the run's clock rather than inside a check (`glSync: true`; `--stall` 600s
→ 240s) · F12 `?seed=` reaches every fuzz and soak site through
`exploreSeed(label, fallback)`, the fallback keeping the gate unmoved · F13
the gate holds the spec's two bans, one `Math.random(` and one `setTimeout(`,
each argued at its own line · F14 the suite counts itself, so a dropped
`register` call cannot shrink every run silently · F15 the skip list is a
census and not a lever — the runner honours a skip only on a map where that
check passed, so the policeman cannot be exempted · F16 read every run-pair on
record: the pairs agree since F11 and the runner prints the spread per map.
**Each has a PROGRESS entry; that is where the argument is.**

**F17 / F18** a fresh seed turned the yard's difficulty check red and the cone was why: at 16m the Shade subtends ±1.22 degrees against easy's ±5, held for a whole burst, so a kill was a run of coins. `easy.aimErrorDegrees` 5.0 → **4.0** (D54), and F18 gave the check the clause F17 could not calibrate — **count bursts, not rounds**, and god-mode the Shade so an engagement stops sampling when the cone succeeds rather than when it lands. Two alternatives were measured and rejected; the per-round draw is right in principle and is **K6**'s.

**Block G — the record.** G1 this file back to one page, 1,846 lines to 533 · G2
the last 200 of them out to `TRAPS.md` (D47, option 2), which put this file under
the 400 G1 could not reach and gave the traps a home that can grow. G is closed.

**Block H — friends can play it.** One line a job; the argument is in the `PROGRESS.md` entry of the same name.

- **H1** the remote · **H2** Pages from the working branch, a branch deploy.
- **H3** a version you can see: `version.json` from `scripts/version.mjs` (`npm run stamp`, and once at the top of every `npm run suite`), written **only from a clean tree** so a gate stamps HEAD and a verify mid-job leaves it alone; `src/version.js` decides `dev` from the host, not from a field. D52 has what H3 could not build.
- **H4** boot: each map's builder is a generator with its shared tail in `mapfinish.js`, run straight through by `buildMap` and a slice at a time by `bakeMap` — one build path, two drivers — so `#bl-boot` names each of the **6 slices** while the page paints between them (a `MessageChannel` yield: `setTimeout` is banned and rAF never fires in a hidden document). **No WebGL2 is `createRenderer()` returning null**, never a `getContext` probe, which cost a second SwiftShader device and 16s a page load. D53 is the wording.
- **H5** the main menu: a card per registered map, rendered at boot from that map's own geometry with the live renderer and the one camera — no asset file — and the bake gained a cut, `DRAWN_SLICES` (3 of 6), because the three slices after it put nothing in a scene. Two eyes came back black and a third found there is no exterior eye that shows the plant's inside: **D55**, H17. Plus the role row (D56), How to play, Credits, and a keyboard that walks all five pages.
- **H6** the first-run tutorial: eight prompts, each cleared by the **act** and never by the key press — `systems/tutorial.js` reads the controller's state after each fixed step and no input at all — offered where the geometry is derived (`tutorialFits`) rather than named, so the plant has two ducts at grade and the yard's check asserts the opposite.
- **H7** settings that survive a reload: one versioned record under one key, a version it does not know ignored rather than migrated, a hand-edited one able to set only a key the defaults have at the type they have, and **every access wrapped** because `localStorage` throws rather than returning null when site data is blocked. The one setting deliberately not kept is the debug gate (`NOT_PERSISTED`, D57).
- **H8** rebinding: a **Controls** page, a row per action, press-to-bind, the row's own reset, a rebind writing the first key and leaving the alternate, and a key on two actions **shown rather than refused** (`bindingConflicts()`, D58). The defect worth reading: **binding a key also fired it**, because the keydown reaches the `Input` as well as the menu and the listener order is not ours — the gate is `swallowPress()`, held to the keyup.
- **H9** the camera is the player's: sensitivity **per axis**, a **field of view per role** (`fovShade`, `fovWarden`, 60–100, both defaulting to `CONFIG.render.fov`, which is what lets a pre-H9 check read that constant as the resting field and be right), and a **head-bob** that did not exist. The FOV became one decision in one place — `cameraOwner.applyFov(owner)` asserts it every frame and `set()` resets a handover to the next owner's *resting* field, so a cinematic handing the camera back at the engine's FOV by contract is corrected next frame instead of leaving a wide-FOV player narrow until a handover that never comes. The aim narrows from the player's own FOV to `adsFov` **absolutely**. The bob is `headBobLift` in `entities/pose.js`, one rule for both bodies, on the gait phase the legs already swing on and **upward only** — down on this camera means a landing or a mantle (B8). **D59**; it ships **off**.

Also on the record and not a numbered job: **the plant is a room, not a circle**
(Josh — *"able to plant the bomb anywhere in the room. not just in the circle"*).
Spec 10.1 amended: a site knows its room by containment and the charge sits where
it was planted (`round.chargeAt`); D8 settled the marking, C7 built it.

## The redesign — read this before touching traversal or the map

Josh, after phase 49: *"endgame there should be no markings. should be able to do
on a ledge what you would expect to be able to."* This **amends the spec**: Section
5 mandated affordance markings and Section 6.1 fixed three traversal bands, and both
are replaced. The direction was settled by interview and is binding:

| Decision | Answer |
|---|---|
| Scope | All traversal aids gone: ledge stripes, chevrons, dashes, lit vent interiors. **Plant-site marking stays** — a bomb site is objective information, not an affordance |
| Climb rule | **Reach-based, athletic**: ~2.6m standing, ~3.8m with a jump. **And only on a press of Space** — never a side effect of moving (D17, spec 20.2) |
| Failed climb | A physical tell **plus audio**. Never silent (B2) |
| Hang | A **held option you choose**, never a failed mantle (B1; D21, D22, spec 20.4). A climb of a ledge at least **1.4 Shade-heights (2.59m)** above where it started begins with a grab: **tap Space and you hang, hold Space and you go over**; from a hang Space pulls up, crouch drops, A/D shimmy. Lower ledges go straight over. Since B8 the hanging body is at **full stretch** (`hangDrop` 2.05), so a lip under a low gantry hangs and its pull-up scuffs |
| Warden | **Stays grounded.** The asymmetry is the game |
| The test | **Purely mechanical.** Standable top + within reach ⇒ climbable. No tags, no exceptions, no `noClimb`. The map obeys the rule |
| Map freedom | Keep the five v2 requirements (Shade starts outside, level 2 is one connected deck, stairless routes up, every room 2+ entries, raised ceilings). Reshape everything else freely |
| Vents | Read as passable by **material contrast** — metal against concrete (B6; D26, spec 20.7) |
| Spec | **Amended** — Section 20.11 (B9) is what Sections 5, 6.1, 16 and 18 now read as, pointing at 20.2–20.10 for the pieces. Nothing above Section 20 is ever edited |

The 50-phase plan that carried this out is **closed at B9, every phase done**;
the table is in `PROGRESS.md` and phases 12–50 are Block B in `QUEUE.md`.

## The census is green, and what the climb rule now says

`every-climbable-surface-can-actually-be-climbed` went green with B3 (2026-09-12)
and **must stay green**. It approaches every climbable face from every place the
rule says a body can stand — three positions along the face at three distances
back, and every spot the rule itself names — standing or crouched, and drives the
real controller. Named failures go to the F4 panel (`debugTools._testLog`). **Do
not "fix" a future red by weakening it.** The stable numbers are the per-approach
check's **139 of 139** on the plant and **151 of 151** on the yard.

The rule, in `src/mapclimb.js`, is the controller's sentence and not a footprint
test. `supportApproaches(collision, box)`: for every wide solid lower than the
box's top by at least `stepOver`, and every face of the box, the rectangle where a
body's centre can be (footprint fully on the support, a body radius clear of the
box, no further out than the probe reaches), sampled at its quarter points; at
each, the body fits and the controller's own hand
sweep — `PROBE_STEP` 0.12 up from the feet, stop where the hand is not in open
air, keep sweeping past anything that is not this box — meets this box's face.
A face above the ceiling over the only place you can stand is not climbable, and
nothing has to say so. The old test ("any wide surface within `vaultReach` of the
footprint is below") named a gantry touching a deck slab at one corner, a duct
roof diagonally beside a container, and server racks three metres under the roof;
nine surfaces stopped deriving and every designed route kept its move.
`the-climb-rule-has-no-exceptions` recomputes "should climb" from the same
approaches and passes, which makes the rule the single source of truth.
`GameMap._supportApproaches(box)` is how a check reads the spots.

"Needs a leg up first" is reported, not failed — Josh's call; a surface you climb
something else to reach is the point of a stacked route. Since B5 "from the floor"
means *from ground a walking body reaches* — a stand spot within a metre of a
`map.wardenGround` cell at its height — not "from the lowest thing a short ray
found under the spot", which counted the office desks and missed two fire escapes.

## The plant must be defusable — the rule, and where its checks live

Josh, straight after the room change: *"actually should only be plantable
where the ward is able to defuse."*

> **A plant is legal exactly where a Warden could stand and defuse it.**

Not a second authored zone: it answers to the defuse check itself, so the two
cannot drift — the same trick `classifyReach()` plays for the map and the
controller. The room stays as the outer bound; this carves out of it. **Block A is
closed** (A1–A8). D20 added the second half — *"can't plant inside things. only on
top."* — so `canPlantAt()` is `canDefuseAt()` **and** `hasHeadroomAt()`, a
standing body's worth of open air above the charge. A duct fails by its roof, a
crate top passes by the air above it, nothing is named.

Why the room alone is not enough: the Warden stays grounded and the Shade climbs
anything within 3.8m, so the Shade could plant on a gantry or a vent roof where
no Warden can kneel — an unloseable plant, and worse,
`setDefendTarget(round.chargeAt)` would send the AI at a charge it cannot reach
and stall it in DEFEND for the whole 45s fuse.

What it actually excludes, measured (A5, after B4): of **377 places a charge can
go inside a site room** it refuses **ten** — the 8 ducts by their lid, and two
wide tops whose middles are over 2m from any Warden ground. So it reads "no plant
in the middle of anything wider than four metres" far more than "no plant up
high", and on a flat room floor it changes nothing. Detail in `PROGRESS.md`.

Block A's checks were one 1,382-line file and are now four: `tests/plantspots.js`
(where a charge can go — `spotOffTheRing`, `plantAt`, `perchesInSiteRooms`,
`plantableSpots`, `plantOutcomeAt`, shared by all four), `tests/plantrule.js`
(A2–A4: one reach, the gate every step, the refusal's HUD line),
`tests/plantcensus.js` (A5, the whole map both directions) and
`tests/objective.js` (round flow: detonation, defuse retention, lives, reinsert,
milestones, state not bleeding).

## Where the code went — F3's split

Eight modules were past the ~600 guidance; every one is under it and a check keeps
it so. Nothing moved changes an order or a name a check reaches. H4 added
`mapfinish.js` (the bake's tail) and `bootscreen.js`; H3 added `version.js`:

| Was | Now |
|---|---|
| `main.js` (1,145) | `main.js` (470): singletons, `initMatch`, pause, bootstrap, `fixedStep`, `renderFrame` — the spec order untouched. Beside it: `loop.js` (`FrameLoop`), `timestep.js` (`computeStepPlan`), `matchstate.js` (options, `createMatchState`, `COMPETITIVE`/`FREEROAM`), `view.js` (renderer, scene, the one camera and its guard, toon ramp, resize, lost-context watch), `cameraowner.js`, `intents.js` (input → intent), `loadout.js`, `wiring.js` (the emitter listeners between systems), `hudstate.js`, `debugfields.js`, `harness.js` (`createHarness(live, loop)`), `panels.js` (C1, C2: HUD, scoreboard, menu, briefing), `boot.js` (C3: `bootWorld()`) |
| `entities/agent.js` (1,051) | `agent.js` (546): state machine, ground, air, the landing. `agentslide.js`, `agenttraversal.js` (every climb), `agentvisual.js` (how it is drawn, the camera's dip), `agentstate.js` (`SHADE_STATE`) |
| `systems/ai.js` (788) | `ai.js` (498): the state machine. `aiperception.js`, `ainav.js` (route, steering, stuck), `aistate.js` (`AI_STATE`, `angleDelta`, `DEFUSE_SNAP`) |
| `mapkit.js` (821) | `mapkit.js` (380): `GameMap`, `addSolid`, decals, rooms, lights, waypoints. `mapgen.js` (walls with openings, floor plates, staircases, vent runs), `mapclimb.js` (`deriveClimbableSurfaces`, `supportApproaches`, `supportCandidates`) |
| `map.js` (810) | `maps/plant.js` (537, the geometry), `maps/plantdata.js` (sites, spawns, lights, waypoints, routes), `mapvalidate.js`. Since D1 `maps/index.js` is the registry and `maps/yard.js` the second map |
| `physics.js` (735) | `physics.js` (600): `CollisionWorld`, gravity, `classifyReach`. `collisionbox.js`: the box and the ray-slab test |
| `systems/objective.js` (646) | `objective.js` (536). `plantrule.js`: `DEFUSE_REACH`, `PLANT_HEADROOM`, `withinDefuseReach`, `canDefuseAt(map, at)`, `hasHeadroomAt`, `canPlantAt` — re-exported and wrapped as methods, so every existing import and call still works |
| `mapground.js` (628) | `mapground.js` (539): `WardenGround`, `route()`, `deriveWardenGround`. `groundprobe.js`: the column probes the flood and the planner share |
| `systems/gadgets.js` (633) | `gadgets.js` (506). `gadgeteffects.js`: `EffectRegistry`, `Projectile` |

The class splits (`agent`, `ai`, `mapkit`) are **prototype mixins**: the sibling
file exports an object of methods and the class file ends with
`Object.assign(X.prototype, ...)`. `this` is the same object, every private field
keeps its name, and `shade._probeLedge`, `ai._pathTo`, `map._supportCandidates`
still exist for the checks that call them. A method needing a module constant
imports it from the shared `*state.js`, never from the class file — that would be
a cycle. God mode is `debugState.godMode`, not a `let` in `main.js`.

## Where the suite runner lives

`ui/autosuite.js` (`AutoSuite`): the registry, `runAutoTests`, the regression
set, the lost-context tiebreak (F1), the presentation reset before every check
(F2), the heartbeat (F10) and the pipeline drain (F11). `ui/debug.js` composes it
and forwards, so checks reach it as `h.debugTools.runAutoTests()` / `_autoTests`;
one that must drive the runner uses `suite.runChecks()`. `scripts/suite.mjs` is
the headless runner, `scripts/watchdog.mjs` its deadline, teardown and orphan
warning, `scripts/version.mjs` the build stamp it writes first (H3).

## Running it

```bash
npm run suite
```

`scripts/suite.mjs` serves the repo in-process, drives the Chrome already on this
PC headless with software WebGL, loads the page once per registered map (D6: every
map in `src/maps/index.js`), warms 60 frames, runs the AUTO suite twice on each and
prints a JSON report. Exit 0 means nothing is red outside QUEUE.md's
Deliberately-red list and the two runs agree, judged per map. Each run carries
`contextLosses` and `rerun` (F1), printed as `GL CONTEXT LOST`; zero is normal, and
a non-zero one is the machine, not the game, unless the same check is in the list
every run.

**What a pair of run times means (F16).** The two runs of a map share one page, and
until F11 the first left its renderer tail for the second to carry, so the plant's
second run is the slower in *every* pair on record (by 30-98s at 130 checks,
145-190s at 177) and no entry says which position it sat in. They agree within 14s
now and the summary prints the spread per map: read that before comparing anything
to a `PROGRESS.md` number, and prefer a first run.

- `--runs 1` is the gate: about 25 minutes for both maps (963s plant, 646s yard
  since F11, which pays a tail per map that used to be dropped at teardown or
  charged to the next run). The full `npm run suite` is four runs, about 55
  minutes. **Each map alone is past the Bash tool's 10-minute cap — background
  it.**
- `--map plant` to narrow · `--regression` for the regression set per map
  (plant 29 checks in 58s, yard 29 in 25s) · `--subset "<regex>"` while
  iterating · `--query "seed=N"` to reseed · `--stall SECONDS` and `--stall-wait SECONDS`, below.
- `--details <file>` writes every check's id, outcome, detail line and **ms** per
  run — the readings a PROGRESS entry quotes, which the stdout report never
  carried for a green check. Since F11 the slowest is
  `every-route-reads-lit-from-its-foot` at **77s on the plant**, then the
  pipeline-wait check at 30s.
- `scripts/suite-skips.json` lists checks that cannot pass headless with
  reasons (today: the frame-budget check; SwiftShader draws a frame in
  ~400ms). They are reported, never counted. **Since F15 it is a census, not
  a lever**: `the-headless-skip-list-holds-only-the-check-it-declares` holds
  the file and its `ALLOWED` list to the same set both ways, and the runner
  honours a skip only on a map where that check passed — skipping the guard
  withholds every skip and prints `SKIPS WITHHELD`, so a `--subset` naming a
  skipped check names the guard too. Needs `npm install` once
  (`playwright-core`, no browser download).

**A hung run dies (F10).** The run is raced against a heartbeat the page
publishes (`beat()` in `ui/autosuite.js`, on `debugState.suiteProgress`). When
it stands still for `--stall` seconds — **240 since F11/D48**, the floor being
the slowest *check* (77s); a pipeline wait beats while it waits and carries
`--stall-wait` (600s) — the run is abandoned with `suite: crashed: run timed
out` naming that check, browser and server are closed, exit code 2. Against
the beat standing still, never wall-clock total: a cold plant run is
legitimately 960s. `--stall 0` disables it; `SIGINT`/`SIGTERM` close the same
way. A `suite.mjs` older than this process is named at startup and in `OTHER
RUNNERS ALIVE` — its Chrome competes for the same cores.

Four more headless tools, each with a PROGRESS entry:

```bash
npm run shot -- --map plant                  # F6: both figures from five eyes
npm run shot -- --map plant --pose vault,aim # F7: one pose, or --pose all
npm run probe -- --map plant probe.js        # F9: a question asked of the game
npm run stamp                                # H3: version.json, from a clean tree only
```

`shot.mjs` writes `shots/look-<map>-<eye>.png` (gitignored) in about 30s a map,
read with the Read tool — the Browser pane's job without the pane. `probe.mjs`
runs a file's text as the body of an async function with `h` and `THREE` in
scope and prints what it returns as JSON (and writes any `pngs`); every "what
does this read" goes through it, and a finding that should stay true becomes a
check — F17 is the worked example. `version.mjs` is H3's, and refuses a dirty tree.

In a real browser, for what headless cannot prove (the frame budget on a GPU
with the post on, how it looks, how it sounds): `npx serve -l 5173 .`, then
**`?debug=1`** for F3 and F4 (C1: without it the page is the playtest build,
every debug key inert) and `?map=yard` for the second map. `window.BLACKLINE`
is the harness in both builds; in-game **F3** overlay · **F4** test mode ·
**Y** full suite · **U** regression set · **N** the Warden's ground. Run it
**twice** — a flaky check shows as a different answer, not a pass.

## Environment traps

**They live in `TRAPS.md` now** — about thirty of them, each one an hour somebody
has already paid. Read that file before you start; the heading stays here because
the scheduled task's prompt falls back to it (G2, D47).
`traps-md-holds-the-traps-and-handoff-points-at-it` holds both ends.

Two of them in one line each, because a reader of this page should not be without
them; the argument for both is in `TRAPS.md`. **Verify anything visual by reading
pixels back** (`src/tests/pixels.js`) — no screenshot is available to a scheduled
run or to the Browser pane. **Warm 60 frames of `renderFrame(1/60)` before
measuring anything**, or you measure a shader compile.

## The lesson that keeps repeating

Three separate bugs — the Phase 3 ledge hang, the Phase 21 slide, the Phase 47
match score — were **wired, tested, green, and impossible in play**, every one
from a check that drove the game differently from how a player does. A held key
and its press edge arrive on the **same step**; a test that sets
`intent.crouchPressed` without `intent.crouch` is testing a machine nobody is
sitting at. Drive `input.heldCodes` / `input.pressedCodes`.

**And its cousin, from A1 and again in A3: a check that reads the constant the
derivation read can only ever agree with it.**
`the-warden-never-climbs-to-reach-its-ground` first asked whether a climbable top
had ground beside it within `warden.stepHeight`, and stayed green with the step
temporarily at 2.00m while the fill walked up crate stacks; it asks "is the ground
beside it *level* with it" now, which is a fact about the geometry. Before
believing a derived-data check, raise the constant it derives from and watch it go
red. A3 was the same shape — it *selects* the perches to try with `canDefuseAt`
then asserts `canDefuseAt` refused them, which proves nothing — and the way out
was to open `DEFUSE_REACH.dy` until the same perch is legal and require that the
identical hold then plants. **H4's is the same debt paid up front**: the WebGL2
refusal is driven with a stubbed canvas, so it also asserts that the live renderer
came out of that same function. Any check that picks its own inputs owes the suite
that second half.

## Still needs a human

Josh answers in `DECISIONS.md`, and its **Provisional** section is the live list
and the authority — nothing is *blocking*, so no job is waiting on any of this.
The ones a fresh pair of eyes would settle fastest: **D26** the ducts' material,
**D28** how a route is lit, **D30** the briefing card, **D31** hit feedback,
**D39** the yard's lighting, **D40–D46** the two figures, the animation, both
maps' materials, the site tint and the post, **D52** the build stamp and **D53**
what boot says. Every one is the same shape: the pixels say a thing is drawn
where it should be, not that it *reads*.

Standing beyond those:

- How any of it **looks**, and how any of it **sounds**. Samples are the right
  length, level and register; nobody has heard it.
- The **frame budget on a real GPU**, with the post on. CPU 1.7ms mean / 5.4ms
  worst across 92 viewpoints against a 16.67ms budget says there is room, not
  what a real GPU does with it. `PLAYTEST.md` says how to answer it — and since
  H4, whether a player waits on the sub-second bake or on the first draw.
- The **orphaned node processes**, and there are now **four**: pids 9608 and
  4792 from the 09-18 17:00 build (Chrome 8920, its renderer 11756 at 1,970
  CPU-seconds), and a second pair **12396 and 7812 from 2026-09-26 23:32**,
  which nothing had noticed until H9 listed the processes. The routine cannot
  kill them; `TRAPS.md` has the command and why Josh has to run it.
