# Blackline — handoff

**Read this first.** Then `QUEUE.md` (the work), `DECISIONS.md` (what waits
on Josh, and what he has decided), `PLAN.md` (the protocol a session follows).
`BLACKLINE_SPEC.md` is the contract; `PROGRESS.md` is the full append-only
history — read the last entry, and the entry named in the index below for
whatever you are about to touch. `PLAYTEST.md` is Josh's: how to run it, what
to look at, what only eyes can judge, what is known to be wrong — every Block
C, D and E job updates it (C6).

This file is orientation, not history. It is kept to one page on purpose
(G1): every run reads it, and a run pays for every line. A job's write-up
goes in `PROGRESS.md` and gets one line in the index here.

## Last audit

2026-09-20. HEAD `ae89df1`: plant 162 passed / 1 failed / 6 not for this map,
yard 145 / 1 / 23, 0 red, 0 flaky, 0 console errors; the one failure per map
is the frame-budget check, skipped headless. Week: 53 commits, 29 jobs done,
0 WIP. Checks: none deleted, no threshold loosened, the one skip unchanged.
Drift: 0 TODO/FIXME, 1 `Math.random` (audio noise), 1 `setTimeout` (a
performance check). Fresh seed 20260920: 14 checks green on both maps — but
every fuzz and soak check pinned its own seed, so `?seed=` never reached them
(the recommendation — **closed by F12**, 2026-09-24; the next fresh-seed
run is the first whose green means anything). It also flagged a suite runner from 09-18 still alive
41 hours on and could not end it; that became F10. Full report: PROGRESS.md,
"Audit — 2026-09-20".

## Where things stand

| | |
|---|---|
| Branch | `phases-14-45` — ahead of `main`, not merged; Josh merges |
| Merge with | `git checkout main && git merge --ff-only phases-14-45` |
| Working tree | clean after F13 (2026-09-24) |
| AUTO suite | headless, `npm run suite`, **both maps since D6**, twice each. **2026-09-24, after F13: plant 175 passed, 1 failed, 8 not for this map (753s, 929s), yard 156 / 1 / 27 (463s, 607s), exit 0, 0 red, 0 flaky, 0 console errors, 0 context losses.** One more check per map than F12's verify, which is F13's own and nothing else. The one failure on each map is the frame-budget check, skipped headless. The Deliberately-red list in `QUEUE.md` is empty. The regression set (`--regression`, or F4 then U) is whole on every map since D7: plant 29 checks in 58s headless, yard 29 in 25s |
| Next job | **Nothing is unblocked, and D49 is why it matters.** F11 is `[~]` on **D48** and G2 on **D47**, and those are the only open jobs; Blocks A, B, C, D, E and G are closed. Two runs running have now found this and neither stopped at once: the 02:00 run took an unqueued recommendation out of `PROGRESS.md` (F12) and this one, with those spent, looked at the instrument instead and found a spec line the gate held nothing to (F13). A third run in this position should expect that seam to be thinner again — the honest read is that the routine is sharpening a tool nobody has yet played with, which is exactly what D49 asks Josh to settle |
| Waiting on Josh | **Three blocking answers, and D49 is the one that matters: PLAN.md's whole block table is finished and the routine has run out of anything it is allowed to decide** — D49 lays out the five directions and recommends playing it first. Then **D47** (what the traps section costs, G2) and **D48** (a third of every run is the GPU catching up; leave it, drop the assertion, or pay it where the gate names it — F11). Every older entry under DECISIONS.md's *Blocking* heading is decided (D8, D13, D20, D23, D25, D27, D38 and the two runner ones). The **Provisional** section is open for override any time, and the things only eyes can settle are under *Still needs a human*. **And two orphaned node processes still need killing by hand**, see the orphaned-runner trap |
| Source | no module in `src/` over 600 lines except `config.js` (a table, exempt in PLAN.md, 1,648 lines); `no-source-file-outside-config-is-over-600-lines` holds it. **`src/physics.js` is at exactly 600** (then `tests/movement.js` 599, `systems/combat.js` 593, `tests/visual.js` 589, `maps/plant.js` 588) — the next line added to any of them turns that check red, so the job that touches one splits it first rather than discovering this halfway through a verify. Outside `src/`, `scripts/suite.mjs` is 507 and `scripts/watchdog.mjs` 181. 0 TODO/FIXME; one `Math.random` (the audio noise buffer) and one `setTimeout` (the performance check), both documented exceptions — and since F13 the gate holds that census rather than the weekly audit: a third call, or either of these two losing the comment that argues for it, is red |
| Runtime assertions | 8, zero failures |
| Map, plant | 214 collision boxes, 57 climbable, Warden ground one connected component with a column of cells down each vault rack aisle. **8 declared routes, 22 stages** (`map.routes`); 21 surfaces that need a leg up, every one a stage or landing of a route; **139 of 139** approaches the rule names climb |
| Map, yard | 132 boxes, 58 climbable, 5 lamps, Warden ground 15,332 cells in one component, 21 waypoints, **9 declared routes, 20 stages**, 11 surfaces that need a leg up, every one on a route; **151 of 151** approaches climb; 44 container tops one connected deck; the walkway's floor and roof have no approach at all |

Phases 1–49 of the original build are done and committed. The **redesign**
(the 50-phase plan, below) closed at B9, 2026-09-14; its two remaining
questions went 2026-09-21 (B5b dropped on D25, B5d built on D27). Blocks A,
B, C, D, E and G are closed; F is open on F11.

## What was built, and where it is written up

Every `PROGRESS.md` entry is titled with its job id — `grep "^## E4"
PROGRESS.md` — and holds the whole write-up: what was built, what was
verified, what was found, what was left. Read the one for whatever you are
about to touch. All of these are closed.

**Block A — the plant must be defusable.** A1 the Warden's ground · A2 the
reach · A3 the gate on every step · A4 the HUD refusal · A5 the census · A6
no plant inside things (D20) · A7 the ground drawn, F4 then N · A8 the AI's
last leg planned over it. The rule is kept below.

**Block B — the traversal redesign, phases 12–50.** B1 hang as a held option ·
B2 the bump-and-scuff, so a failed climb is never silent · B3, B4 the climb
census goes green and the map answers it · B5, B5c the area pass measured
honestly, routes declared · B5d the defuse reach is a clear line (D27) · B6
the material language, the ducts galvanised · B7 the routes are lit · B8
feel — momentum, weight, the buffer, the hanging body, the way up swept · B9
closed, spec 20.11. B5b was dropped on D25.

**Block C — playable and testable.** C1 the playtest build, the debug gate off
by default · C2 the round opens on a briefing · C3 hit and damage feedback ·
C4 the round and match end screens · C5 the difficulty pass, the Warden shoots
straight · C6 `PLAYTEST.md` · C7 the site is a tinted floor and the HUD names
it (D8).

**Block D — the second map.** D1 the registry, `?map=`, the suite per map · D2
the yard blocked out · D3 the Warden's walkway · D4 the yard at night · D5 the
AI on the yard · D6 both maps in the gate · D7 the regression set whole on
every map. D3b was dropped on D38.

**Block E — styling.** E1 the Shade's figure · E2 the Warden's · E3 animation ·
E4 the plant's materials · E5 the yard's · E6 post-processing.

**Block F — the gate itself.** F1 a lost GL context is caught and the check
re-run · F2 the presentation reset before every check · F3 eight modules split
under the ~600 guidance (the map is kept below) · F4 the game does not play
itself under the suite · F5 the headless runner · F6 `npm run shot` · F7 a
look at a pose · F8 the key light gives nothing to a face it lights from
behind · F9 `npm run probe` · F10 a hung gate dies and says which check hung.
**F11 is `[~]` on D48** — it found that the quarter of a run inside one check
is one `gl.getError()`, a wait and not work; what is left is whose clock it
goes on. F12 `?seed=` reaches the fuzz and soak checks: `tests/seeds.js` owns
`exploreSeed(label, fallback)`, the fallback when the URL names no seed so the
gate is unmoved, a draw mixed from the URL seed and the label when it does, and
three seeds stay pinned because reproducibility is their subject. F13 the gate holds the two bans the spec states: `no-source-file-calls-math-random-or-sets-a-timer` reads all 135 loaded modules and allows one `Math.random(` (the audio noise texture) and one `setTimeout(` (a fence yield in `tests/performance.js`), each still present, exactly once, and argued in a comment at its own line.

**Block G — the record.** G1 this file back to one page. **G2 is on D47.**

Also on the record and not a numbered job: **the plant is a room, not a
circle** (Josh, mid-session — *"able to plant the bomb anywhere in the room.
not just in the circle"*). Spec 10.1 amended: a site knows its room by
containment and the charge sits where it was planted (`round.chargeAt`). D8
settled how that room is marked; C7 built it.

## The redesign — read this before touching traversal or the map

Josh, after phase 49:

> *"endgame there should be no markings. should be able to do on a ledge what
> you would expect to be able to."*

This **amends the spec**. Section 5 mandated affordance markings and Section
6.1 fixed three traversal bands; both are replaced. The direction was settled
by interview and is binding:

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

The 50-phase plan that carried this out — strip and measure, reach-based
traversal, hang and scuff, the area rebuild, legibility without markings,
feel, close — is **closed at B9, every phase done**. The phase-by-phase table
is in `PROGRESS.md`; the index above names the job for each band. Phases
12–50 are Block B in `QUEUE.md`.

## The census is green, and what the climb rule now says

`every-climbable-surface-can-actually-be-climbed` went green with B3
(2026-09-12) and **must stay green**. It approaches every climbable face from
every place the rule says a body can stand — three positions along the face at
three distances back, and every spot the rule itself names — standing or
crouched, and drives the real controller. Named failures go to the F4 panel
(`debugTools._testLog`). **Do not "fix" a future red by weakening it.** The
stable numbers are the per-approach check's **139 of 139** on the plant and
**151 of 151** on the yard.

The rule, in `src/mapclimb.js`, is the controller's sentence and not a
footprint test. `supportApproaches(collision, box)`: for every wide solid
lower than the box's top by at least `stepOver`, and every face of the box,
the rectangle where a body's centre can be (footprint fully on the support, a
body radius clear of the box, no further out than the probe reaches), sampled
at its quarter points; at each, the body fits and the controller's own hand
sweep — `PROBE_STEP` 0.12 up from the feet, stop where the hand is not in open
air, keep sweeping past anything that is not this box — meets this box's face.
A face above the ceiling over the only place you can stand is not climbable,
and nothing has to say so. The old test ("any wide surface within `vaultReach`
of the footprint is below") named a gantry touching a deck slab at one corner,
a duct roof diagonally beside a container, and server racks three metres under
the roof; nine surfaces stopped deriving and every designed route kept its
move. `the-climb-rule-has-no-exceptions` recomputes "should climb" from the
same approaches and passes, which is what makes the rule the single source of
truth. `GameMap._supportApproaches(box)` is how a check reads the spots.

"Needs a leg up first" is reported, not failed — Josh's call; a surface you
climb something else to reach is the point of a stacked route. Since B5 "from
the floor" means *from ground a walking body reaches* — a stand spot within a
metre of a `map.wardenGround` cell at its height — and not "from the lowest
thing a short ray found under the spot", which counted the office desks and
missed two fire-escape flights.

## The plant must be defusable — the rule, and where its checks live

Josh, straight after the room change: *"actually should only be plantable
where the ward is able to defuse."*

> **A plant is legal exactly where a Warden could stand and defuse it.**

Not a second authored zone: it answers to the defuse check itself, so the two
cannot drift — the same trick `classifyReach()` plays for the map and the
controller. The room stays as the outer bound; this carves out of it. **Block
A is closed** (A1–A8). D20 added the second half — *"can't plant inside
things. only on top."* — so `canPlantAt()` is `canDefuseAt()` **and**
`hasHeadroomAt()`, a standing body's worth of open air above the charge. A
duct fails by its roof, a crate top passes by the air above it, nothing is
named.

Why the room alone is not enough: the Warden stays grounded and the Shade
climbs anything within 3.8m, so the Shade could plant on a gantry or a vent
roof where no Warden can kneel — an unloseable plant, and worse,
`setDefendTarget(round.chargeAt)` would send the AI at a charge it cannot
reach and stall it in DEFEND for the whole 45s fuse.

What the rule actually excludes, measured (A5, after B4 changed the map): of
**377 places a charge can go inside a site room** it refuses **ten** — the 8
ducts by their lid, and two wide tops (`hall-container`, `gantry-hall`) whose
middles are over 2m from any Warden ground. So it reads "no plant in the
middle of anything wider than four metres" far more than "no plant up high":
the horizontal reach does almost all of the excluding and the vertical one
none, and on a flat room floor it changes nothing. The counts and what A8
found are in `PROGRESS.md`.

Block A's checks were one 1,382-line file and are now four:
`tests/plantspots.js` (where a charge can go — `spotOffTheRing`, `plantAt`,
`perchesInSiteRooms`, `plantableSpots`, `plantOutcomeAt`, shared by all four),
`tests/plantrule.js` (A2–A4: one reach, the gate every step, the refusal's HUD
line), `tests/plantcensus.js` (A5, the whole map both directions) and
`tests/objective.js` (round flow: detonation, defuse retention, lives,
reinsert, milestones, state not bleeding).

## Where the code went — F3's split

Eight modules were past the ~600 guidance; every one is under it and a check
keeps it so. Nothing moved changes an order or a name a check reaches:

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

The class splits (`agent`, `ai`, `mapkit`) are **prototype mixins**: the
sibling file exports an object of methods and the class file ends with
`Object.assign(X.prototype, ...)`. `this` is the same object, every private
field keeps its name, and `shade._probeLedge`, `ai._pathTo`,
`map._supportCandidates` still exist for the checks that call them. A method
that needs a module constant imports it from the shared `*state.js`, never
from the class file — that would be a cycle. God mode is `debugState.godMode`
now, not a `let` in `main.js`.

## Where the suite runner lives

`ui/autosuite.js` (`AutoSuite`): the registry, `runAutoTests`, the regression
set, the lost-context tiebreak (F1), the presentation reset before every check
(F2), and the heartbeat (F10). `ui/debug.js` composes it and forwards, so
checks still reach it as `h.debugTools.runAutoTests()` / `_autoTests`; a check
that must drive the runner directly uses `h.debugTools.suite.runChecks()`.
`scripts/suite.mjs` is the headless runner and `scripts/watchdog.mjs` its
deadline, teardown and orphan warning.

## Running it

```bash
npm run suite
```

`scripts/suite.mjs` serves the repo in-process, drives the Chrome already on
this PC headless with software WebGL, loads the page once per registered map
(D6: every map in `src/maps/index.js`), warms 60 frames, runs the AUTO suite
twice on each and prints a JSON report. Exit 0 means nothing is red outside
QUEUE.md's Deliberately-red list and the two runs agree, judged per map. Each
run carries `contextLosses` and `rerun` (F1), printed as `GL CONTEXT LOST`;
zero is normal, and a non-zero one is the machine, not the game, unless the
same check is in the list every run.

- `--runs 1` is the gate: about 22 minutes for both maps (823s plant, 494s
  yard). The full `npm run suite` is four runs, about 50 minutes. **Each map
  alone is past the Bash tool's 10-minute cap — background it.**
- `--map plant` to narrow · `--regression` for the regression set per map
  (plant 29 checks in 58s, yard 29 in 25s) · `--subset "<regex>"` while
  iterating · `--query "seed=N"` to reseed · `--stall SECONDS`, below.
- `--details <file>` writes every check's id, outcome, detail line and **ms**
  per run — the readings a PROGRESS entry quotes, which the stdout report
  never carried for a green check. The slowest is
  `a-zero-size-viewport-does-not-blind-the-renderer` at **265s on the plant**,
  then `every-route-reads-lit-from-its-foot` at 76s; only 6 of 658 check-runs
  pass 60s. That first number is not a slow check but a wait — see the trap
  below and F11.
- `scripts/suite-skips.json` lists checks that cannot pass headless with
  reasons (today: the frame-budget check; SwiftShader draws a frame in
  ~400ms). They are reported, never counted. Needs `npm install` once:
  `playwright-core` only, no browser download.

**A hung run dies (F10).** The run is raced against a heartbeat the page
publishes (`beat()` in `ui/autosuite.js`, on `debugState.suiteProgress`: a
monotonic sequence and the id of the check in flight). When it stands still
for `--stall` seconds — **600 by default, and F11 re-examined it and left it
there**: the floor under it is not the slowest check but the pipeline wait
inside one, 265s on four cores and 150s on eight, so the budget has to clear
a number that moves with the machine — the run is abandoned with `suite: crashed: run timed out`
naming that check, the browser and server are closed, and the exit code is 2.
Against the beat standing still, never wall-clock total: a cold plant run is
legitimately 850s. `--stall 0` disables it. `SIGINT`/`SIGTERM` close the same
way. A `suite.mjs` older than this process is named at startup, in the
report's `otherRunners` and in the summary's `OTHER RUNNERS ALIVE` — its
Chrome competes for the same cores, so every timing beside it is measured
against it.

Three more headless tools, each with a PROGRESS entry:

```bash
npm run shot -- --map plant                  # F6: both figures from five eyes
npm run shot -- --map plant --pose vault,aim # F7: one pose, or --pose all
npm run probe -- --map plant probe.js        # F9: a question asked of the game
```

`shot.mjs` writes `shots/look-<map>-<eye>.png` (gitignored) in about 30s a
map, which a session reads with the Read tool — the Browser pane's job done
without the pane. `probe.mjs` runs a file's text as the body of an async
function with `h` and `THREE` in scope, prints what it returns as JSON and
writes any `pngs: [{ name, dataUrl }]`; every "what does this read" of a
scheduled run goes through it, and a finding that should stay true becomes a
check.

In a real browser, for what headless cannot prove (the frame budget on a GPU
with the post on, how it looks, how it sounds): `npx serve -l 5173 .`, then
**`?debug=1`** for F3 and F4 (C1: without it the page is the playtest build,
every debug key inert) and `?map=yard` for the second map. `window.BLACKLINE`
is the harness in both builds; in-game **F3** overlay · **F4** test mode ·
**Y** full suite · **U** regression set · **N** the Warden's ground. Run it
**twice** — a flaky check shows as a different answer, not a pass.

## Environment traps — these will cost you an hour each

**A loaded machine can take the GPU away mid-suite.** One verify came back
with *eight* pixel checks flaky at once and never reproduced. F1 found it: a
**lost WebGL context**. Chrome kills a starved SwiftShader GPU process and
hands it back a moment later; in the window every draw is a no-op, every
`readPixels` reads black, and the drawing buffer reports 0x0 against a
1280x720 canvas. The suite now counts losses, tags the checks that ran in the
window and re-runs them once; the runner prints `GL CONTEXT LOST Nx`. Read
that line before believing any red pixel check. A check that needs to lose the
context on purpose registers `losesContext: true`.

**A slow check may be a wait, not work — look before you optimise it.** All
265s of `a-zero-size-viewport-does-not-blind-the-renderer` on the plant are
one `gl.getError()`; the rest of the check is under 50ms and the same check
run alone is 5ms. A GL synchronisation waits for SwiftShader to finish
building pipelines the whole run has queued — 38.8s with only the warm-up
behind it, 265s with 167 checks behind it, a third of every run however it is
configured. It cannot be moved for free: `getError` after every check takes
the plant run from 753s to 989s and still leaves a 251s check, and `flush`
after every check costs 0ms and changes nothing (F11, D48). Before reading a
check's ms as that check's cost, put the suspect call on its own clock —
`--details` gives the total and nothing else.

**A plant run can take 850s, and `npm run suite` is four runs.** Nothing of
that fits the Bash tool's 10-minute cap. Start it with `run_in_background`
writing to a file and wait on the file (`until grep -q "suite: " <file>`,
itself backgrounded or in a Monitor — a foreground wait hits the same cap).
Stopping a backgrounded run from the tool does not stop the runner.

**And an orphaned runner never dies on its own — it has to be killed by hand,
and a routine cannot do it.** *(Since F10 the gate no longer makes them: a run
whose heartbeat stands still dies naming the check, and SIGINT/SIGTERM tear
the tree down. The two below predate that, are still alive, and are named at
the start of every run since.)* The 09-18 17:00 build's runner was still alive
on 2026-09-23: `npm run suite` (pid **9608**) → `node scripts/suite.mjs` (pid
**4792**, a server still listening on 127.0.0.1:54315) → a headless Chrome
tree (pid **8920**) whose renderer had burned 1,975 CPU-seconds. Resist the
obvious inference: it does *not* follow that this is why a plant run went 450s
→ 850s, because E6's run and every gate since were measured with it alive.
Contention is a constant across every timing on record, not something that
separates them. The clean test is a gate run once the processes are dead, and
nobody has had one yet. F11's run stopped a verify from the tool and briefly
had a second pair (pids 10316 and 11820, 2026-09-23 18:55): stopping kills
the `npm` wrapper only, and `suite.mjs` carried on to the end of its four
runs — about forty minutes — before tearing its own tree down and exiting.
So **F10's teardown holds and nothing new leaked**, but a stopped gate is not
a stopped gate: it keeps the cores it had, and the next run measured beside
it is measured beside it. Let a backgrounded gate finish rather than stopping
it. Find them with

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Select ProcessId,CreationDate,CommandLine
```

and end one with `taskkill /PID <suite.mjs pid> /T /F` — **Josh has to run
this himself**: a scheduled session's sandbox refuses `taskkill` as
interfering with a workload. Be sure of the pid first; the ordinary
`chrome.exe` tree is Josh's own browser.

**Two sessions in this repo will collide on decision numbers.** A5 raised its
question as D19 while, ten minutes earlier and unseen, another session had
committed a different D19. Before adding to `DECISIONS.md`, `git log --oneline
-5` and re-read the file — the number you are about to use may have been taken
since you loaded it.

**The routine may be running while you are.** `blackline-build` fires at 17:00
and 02:00 and a run can last hours. Before you commit from a human session,
look at `git status`: a file you did not touch is the routine's in-flight
work. Never `git add -A` then — add your own files by name.

**A scheduled run cannot use the Browser pane at all.** It refuses to start a
dev server unattended, by rule. `npm run suite` is the only gate a routine
has; for a look, `npm run shot`.

**The browser pane never composites.** `document.hidden` is always true,
`requestAnimationFrame` never fires, screenshots time out. Drive frames with
`h.renderFrame(1/60)`, never by waiting for rAF, and verify anything visual
with `gl.readPixels` — see `src/tests/pixels.js`. The one time this bit hard:
an emulated resize left the canvas 0×0 and *all eight* pixel checks went black
at once, and the obvious reading (the last commit broke rendering) was wrong.

**A check that awaits `h.nextFrame()` hangs where frames never fire**, and the
browser pane is such a place. Read `document.hidden` first and fail with a
reason instead. Since F10 the headless runner kills such a run rather than
hanging with it, but the check is still wrong.

**A run of checks never yields a task on its own.** `await` on an
already-settled promise is a microtask, so a stretch of synchronous checks
holds the main thread from the first to the last and nothing outside the page
can see how far it has got. Hence `yieldTask()` at every check boundary (F10);
anything observing a run from outside depends on it.

**The runner keeps 400 characters of a check's detail, and the F4 log is not
in the report.** A diagnostic that matters goes at the front of the failure
line, compact; D5 lost two runs to a trace cut off before the interesting
part. `debugTools.logResult()` reaches the F4 panel in a tab, never the runner.

**The working copy is mixed CRLF and LF**, with `core.autocrlf` true. A patch
script that assumes one fails silently on the other. Detect per file: read with
`newline=""`, note whether `\r\n` is in it, work in LF, write back the way it
was. A byte-exact match against `\n` content fails silently on a CRLF file.

**Bash heredocs fail on JS content** in this shell — `unexpected EOF` — and
sometimes even inside `python - <<'PY'`. Use the Write tool for new files, and
write a patch script to the scratchpad with the Write tool and run `python
<path>` rather than piping it in. **A patch script must take its root as an
argument and refuse to run without one:** G1's own predecessor defaulted it to
an empty string, which resolved to the current directory and patched the live
tree in the middle of a gate run.

**Python's default encoding here is cp1252.** A script that opens a markdown
file containing an em dash without `encoding='utf-8'` reads a different string,
and an `anchor in s` that should be true is false. Open with `encoding='utf-8'`
both ways.

**A coverage check cannot see a connectivity fault.** Three times now: the A1
constant that stayed green with the step at 2m, the HUD check that was green
only because of who ran before it, and A1's ground that was two islands while
every spawn, waypoint and site sat happily on one of them. Before believing a
check on a *set*, ask whether it would notice the set being cut in half.

**`renderFrame` and a lens do not mix.** The frame re-parents the camera to the
actor's rig every time it runs, so a lens pointed at the floor is pointed at it
no longer after one `h.renderFrame()`. Press debug keys with
`debugTools.pollKeys()` while a lens is up, and do anything needing the frame
after `lens.restore()`.

**Never time `readPixels`.** It blocks on a GPU sync and copies megabytes; it
reported a 2ms frame as 14ms. Use `lens.renderOnly()`.

**Warm up before measuring — the AUTO suite counts as measuring.** The first
draw after a load compiles shaders. A run straight after a reload reported
`hall-north` at 17.80ms against an 8.33ms ceiling; warmed, the same viewpoint
is 1.22ms. Drive 60 frames of `renderFrame(1/60)` first.

**A wall-clock guard and a cold view do not mix.** The death camera's guard
(16.5s) is measured on the wall clock by design; the first draw of a view the
renderer has not seen compiles for tens of seconds headless (39s at site A),
and `readPixels` blocks until it is done. Such a check gets the guard, not the
picture — and red only when run alone, because in the full suite an earlier
check paid the compile. Warm the view first, and listen for `deathcam:guard`.

**Noise events come from a recycled pool of 48.** Copy the fields you need; a
retained event gets overwritten (a landing read 8m instead of 10m because a
Warden footstep reused the slot).

**A check may leave anything behind except presentation.** Since F2 the runner
calls `h.resetPresentation()` before every check, because one that rendered a
frame behind a menu used to leave every HUD-reading check after it reading a
stale DOM. Match state is still the check's own business, and `initMatch` at
the top remains the way to start clean.

**The pulsing site marking pollutes pixel samples.** Sample off it.

**Four rifle rounds kill the Shade, and since C5 the Warden lands them.**
God-mode it (`h.debugState.godMode = true`) in any long test or the AI ends
your measurement window — and put it back.

**Smoke blocks AI sight entirely and a seen flashbang blinds it** — so the
check-29 load only coexists with gunfire if the smoke is off the firing line.

**`SETTINGS.x` is the live value. `CONFIG.settings.defaults.x` is a seed.**
Reading the latter compiled fine and silently broke the difficulty and match
length controls for thirty phases.

**One console warning during the suite is expected** — the death-camera check
deliberately fires its own wall-clock guard.

**A check that emits half an event leaves the other half behind.** The audio
check emits a synthetic `gadget:detonate` for the sound; effects hears it too
and spawns a cloud with no gadget behind it, which
`effects-drain-when-idle` calls a leak. Pair the event with the registry
effect, or clean up after it.

**If a rendered sound ever answers differently between two runs, something is
random.** `every-sound-renders-to-samples-that-match-section-14` was flaky
until B2 found `renderOffline()` drawing its noise from `Math.random`; it
seeds a private `mulberry32` now.

**If the runner says `suite: crashed:` with no page error under it**, the
harness never loaded for a reason the page did not report — look at
index.html's import map first.

**A moved method can reference a module constant that did not move.** Both F3
boot failures were this (`P`, `THREE` used in `mapgen.js` without an import);
`node --check` cannot see it and only the code path that runs at boot reports
it. After moving code between modules, grep the new file for every bare
identifier the old module declared at top level.

**`MultiplyBlending` needs `premultipliedAlpha: true` on the material in
r180.** Without it three logs a warning once a frame and draws the mesh with
normal blending — a white texel lands as opaque white. E4's first subset had
161 console errors; the runner's `consoleErrors` count is where it shows first.

**A dark surface hides its texture in a level or two.** Measure a texture under
a lamp (a surface at luma 80–100), and by difference — the frame with the map
minus the same frame with `material.map = null` — so the lighting's bands
cancel and what is left is the texture.

**An sRGB texture multiplies harder than its texel says.** A grey texel of 0.88
is 0.75 linear, and the surface it multiplies is lit in linear: E4's first
grime took a fifth off a lit floor where the texel promised a tenth. Budget the
darkening from the pixels, not the texel.

## The lesson that keeps repeating

Three separate bugs — the Phase 3 ledge hang, the Phase 21 slide, the Phase 47
match score — were all **wired, tested, green, and impossible in play**. Every
one came from a check that drove the game differently from how a player does.
A held key and its press edge arrive on the **same step**; a test that sets
`intent.crouchPressed` without `intent.crouch` is testing a machine nobody is
sitting at. Drive `input.heldCodes` / `input.pressedCodes`.

**And its cousin, from A1 and again in A3: a check that reads the constant the
derivation read can only ever agree with it.**
`the-warden-never-climbs-to-reach-its-ground` first asked whether a climbable
top had ground beside it within `warden.stepHeight`, and stayed green with the
step temporarily at 2.00m while the fill walked up crate stacks; it asks "is
the ground beside it *level* with it" now, which is a fact about the geometry.
Before believing a derived-data check, raise the constant it derives from and
watch it go red. A3 was the same shape — it *selects* the perches to try with
`canDefuseAt` then asserts `canDefuseAt` refused them, which proves nothing —
and the way out was to open `DEFUSE_REACH.dy` until the same perch is legal
and require that the identical hold then plants. Any check that picks its own
inputs owes the suite that second half.

## Still needs a human

Josh answers in `DECISIONS.md`, and its **Provisional** section is the live
list and the authority — nothing is *blocking*, so no job is waiting on any
of this. The ones a fresh pair of eyes would settle fastest: **D26** the
ducts' material, **D28** how a route is lit, **D30** the briefing card,
**D31** hit feedback, **D39** the yard's lighting, **D40–D46** the two
figures, the animation, both maps' materials, the site tint and the post.
Every one is the same shape: the pixels say a thing is drawn where it should
be, not that it *reads*.

Standing beyond those:

- How any of it **looks**, and how any of it **sounds**. Samples are the right
  length, level and register; nobody has heard it.
- The **frame budget on a real GPU**, with the post on. CPU 1.7ms mean /
  5.4ms worst across 92 viewpoints against a 16.67ms budget says there is
  room, not what a real GPU does with it. `PLAYTEST.md` says how to answer it.
- The **two orphaned node processes** above — pids 9608 and 4792, and Chrome
  8920. The routine cannot kill them.
