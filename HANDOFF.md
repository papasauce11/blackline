# Blackline — handoff

**Read this first.** Then `QUEUE.md` (the work), `DECISIONS.md` (what waits
on Josh, and what he has decided), `PLAN.md` (the protocol a session follows).
`BLACKLINE_SPEC.md` is the contract; `PROGRESS.md` is the full append-only
history (3,000 lines) — read only the last entry. `PLAYTEST.md` is Josh's:
how to run it, what to look at, what only eyes can judge, what is known to
be wrong - every Block C, D and E job updates it (C6).

## Last audit

2026-09-13. **Working tree broken by a reboot at 18:19** — `src/systems/plantrule.js` and `src/systems/objective.js` are zero-filled, the suite cannot boot; B5c is done but uncommitted; the two files were restored from HEAD `2e12d0e` that evening and the B5c tree verified: one census check red both runs, so it is committed as `WIP: B5c` and B5c is `[~]` again. HEAD itself: 128 passed, 1 failed (frame budget, skipped), 0 red, 0 flaky, 0 console errors — matches this file.
Week: 47 commits, 23 jobs done (A1–A8, F1–F4, B1–B6 and the P's), 8 queued, 0 WIP at HEAD. Blocked on Josh: D8 and D13 (5 days, nothing waits on them), D25 (under a day, blocks B5b).
Checks: none deleted, no threshold loosened, one skip (frame budget, documented). The census's `shouldClimb` was redefined this week (B3/B5) — a contract change, argued in PROGRESS, not a number.
Drift: config.js 1,282 lines (exempt), 0 TODO/FIXME, 1 Math.random (audio noise), 1 setTimeout (a performance check). Fresh seed 20260913: fuzz and the AI stuck checks green.
Full report: PROGRESS.md, "Audit — 2026-09-13".

**The project now runs itself.** Two scheduled tasks — `blackline-build` at
17:00 and 02:00, `blackline-audit` weekly — do up to three queue jobs per run,
one at a time, under the protocol in `PLAN.md`. A human session is welcome to do the same: take the
first unblocked job in `QUEUE.md`, finish it, record it, leave the tree clean.

---



## Where things stand

| | |
|---|---|
| Branch | `phases-14-45` — ahead of `main`, not merged; Josh merges |
| Merge with | `git checkout main && git merge --ff-only phases-14-45` |
| Working tree | clean after D6 (2026-09-19) |
| AUTO suite | headless, `npm run suite` - **both maps since D6**, twice each: plant **154 passed, 1 failed, 6 not for this map**, yard **137 passed, 1 failed, 23 not for this map** (2026-09-19, after D6), 0 red, 0 flaky, 0 console errors; the one failure on each is the frame-budget check, skipped headless (see Running it). The Deliberately-red list in `QUEUE.md` is empty. The regression set (`--regression`, or F4 then U): plant 29 checks in 60s headless, yard 24 in 24s, 5 of the set not for the yard (D7) |
| Next job | **D7** (M: the regression set whole on every map - five of its checks name the plant's geometry), the last of Block D but D3b (waits on D38); then Block E, styling, E1 first. **D6 done** 2026-09-19 (below): both maps in the gate. **D5 done** 2026-09-19 (below): the AI on the yard - a lit lane for the three hall-bound checks, a near goal planned over the ground, stuck means moving, a three-match soak on every map. **D4 done** 2026-09-18 (below): the yard at night. **D3 done** the same day (below): the Warden's walkway; D3b (a Warden-only door) waits on D38. **D2 done** 2026-09-17 (below): the yard blockout. D1 the same day: the map registry, `?map=`, the suite per map. **Block C is closed** 2026-09-16. B5b (rails) waits on D25; B5d (the defuse reach is a clear line) waits on D27. B8 and B9 done 2026-09-14 (**the redesign is closed** - spec 20.11), B7 and B5c the same day, B6 2026-09-13 (**Blocks A and F are closed**) |
| Source | no module in `src/` over 600 lines except `config.js` (a table, exempt in PLAN.md); the check `no-source-file-outside-config-is-over-600-lines` holds it |
| Runtime assertions | 8, zero failures |
| Map, plant | 214 collision boxes, 57 climbable (58 until B5c took the north duct's west lip, which is walked into level from the crate stack), Warden ground one connected component, with a column of cells down each vault rack aisle since B4. **8 declared routes, 22 stages** (`map.routes`, B5, B5c), 21 surfaces that need a leg up, every one a stage or landing of a route; **139 of 139** approaches the rule names climb (146 until B8 swept the way up: nine went, through a duct wall or the hall gantry) |
| Map, yard | 132 boxes (71 before the walkway's 53, 124 before the masts' 8), 58 climbable, 5 lamps (four on masts, one under the walkway), Warden ground 15,332 cells in one component (the run and its stair included), 21 waypoints, **9 declared routes, 20 stages**, 11 surfaces that need a leg up (the two arches and the nine upper tiers), every one on a route; **151 of 151** approaches climb; 44 container tops one connected deck; the walkway's floor and roof have no approach at all |

Phases 1–49 of the original build are done and committed. The **redesign**
(phases 1-50 of the plan below) is closed as of B9, 2026-09-14, but for two
jobs that wait on Josh (B5b on D25, B5d on D27). One directive arrived
outside it (the plant, below). **Block C is closed** (2026-09-16): C1,
the playtest build, C2, the round-start briefing, and C3, hit and damage
feedback, landed 2026-09-15; C4, the end screens, C5, the difficulty
pass, and C6, `PLAYTEST.md`, 2026-09-16 (below). Block D, the second
map, is under way: D1, the plumbing, and D2, the yard blocked out, both
2026-09-17 (below); D3, the walkway, and D4, the night, 2026-09-18
(below); D5, the AI on the yard, and D6, both maps in the gate,
2026-09-19 (below). D7, the regression set whole on every map, is next
and the last of Block D but D3b (waits on D38); then Block E, styling.

---

## Both maps in the gate - D6

`npm run suite` runs **every map the registry lists**, read from
`src/maps/index.js` by the runner (`registeredMapIds()`, scripts/
suite.mjs - the module imports three.js through the page's import map,
so it is read as text), so a third map is in the gate the day it is
registered; `--map` still narrows it. `--regression` runs the page's
own regression set (`runRegressionSet()`, F4 then U) per map instead
of the whole suite and prints its time on the run line. **The set is
asked per map** (`AutoSuite.regressionSet()`): the checks that cover
Section 16's numbers or are named by id, split into the ones that run
on this map and the ones registered for other maps only, and the
numbers no check running *here* covers; `runRegressionSet` says both
out loud, and `the-regression-set-resolves-to-real-checks` holds the
page's split to its own count on every map. Today: the plant runs all
29; **the yard runs 24, and 5 are the plant's** (`swept-collision-no-
tunnelling`, `shade-reaches-level-2-without-stairs`, `a-mantle-never-
passes-through-a-solid`, `visibility-reads-lit-and-dark-zones`,
`hitscan-respects-cover-and-the-head-line` - each names the plant's
geometry); the other four numbers are held on the yard by other
checks, and Section 16's check 3 is held there by nothing. D7 (M) is queued to make the set whole there.
Headless: plant 60s, yard 24s - the queue's "under 20s" is a GPU-tab
number nobody has read yet (PLAYTEST.md asks Josh for it).

## The AI on the yard - D5

**`litLane(h, length, stands)`** (tests/lanes.js) is `clearLane` with
the map's lamps on it: the first clear run whose visibility meter reads
at least `LIT_METER` (half the meter, 50) for a standing Shade at every
distance in `stands`, read as a spawn seeds the meter (`meterAt`,
through `detection.reset()`). The three AI checks that stood in the
Turbine Hall by coordinate - `ai-state-machine-follows-section-11`,
`each-difficulty-is-quicker-to-see-you-and-quicker-to-kill-you`,
`the-warden-fires-in-bursts-of-rounds-at-the-torso` - stand on it and
run on every map. They hold the meter at its maximum; the lane is what
makes "lit" true rather than a lie. On the plant the lane is from
`hall-north` (site A has no 17m run) and **D33's table is unchanged**;
on the yard it runs north from site C up the gate lane under the
walkway's lamp (meter 63 / 80 at 8 / 16m) and the kills land within a
third of a second of the plant's. `ai-perception-cone-and-accumulator`
stays plant-only: its through-wall case names the hall's east wall.

**Two AI fixes, on every map** (ainav.js; spec 20.21). A goal within
**`ai.directRouteRange`** (10m, flat) is planned by
`WardenGround.route()` from the Warden's own feet and the waypoint
graph is not consulted - routed through the node nearest the goal,
which on the yard stood beyond an 8m noise, the Warden walked past the
Shade making it, out of its own cone. And **stuck means moving**
(`_meansToMove`): Section 11's detector fires only while the AI has a
route it has not reached the end of (ENGAGE, which closes with no
route, always counts). Before, a Warden kneeling over a charge was
"stuck" every 2s of its 8s defuse, re-pathed from the nearest graph
node, stood up, walked there and came back - twelve re-paths in nine
rounds of the soak, every one at the charge, four to eight seconds a
round, in every playtest so far. `the-ai-walks-to-the-charge-and-
defuses-it` got quicker on both maps by exactly that.

**`the-warden-plays-three-matches-on-this-map-without-a-stall`**
(tests/aisoak.js, every map): three best-of-fives, each round through
`initMatch` with its round number and its own seed, the Warden from a
different spawn, a patrol of 6 / 10 / 14s, the plant at A, B, C in turn
(`plantAt`), the Shade to the farthest spawn, the defence on the
detonation clock. Every round defused and the Warden's, the match over
at 3-0, feet on `wardenGround` every step (`onGround`, now exported
from tests/wardenground.js), a camera hung every match, at most three
re-paths in all (0 on both maps). The rounds and every re-path (state,
distance to the charge, defuse progress) go to the F4 log; the
runner's detail line keeps 400 characters.

## The yard at night - D4

`RIG`, `MAST`, `MASTS` and `KEY_MAST` in `src/maps/yarddata.js` state
it; `placeLights` builds it. **Four floodlight masts** - a pole 0.3m
square on the ground against a wall or in a corner off every lane, an
arm from its top, the lamp at the arm's end 6.5m up: bay A's against
its south row with the arm out over the site, B's the mirror, C's
against its east wall, the gate's in the open ground west of the lane
north of the stair's foot - and a **fifth lamp under the walkway's
floor** over the mid lane. Both mast parts are thinner than a body, so
the climb rule finds nothing to stand on and nothing derives climbable
(the rule still names *approaches* onto their faces - that is what an
approach is; the top is what is too narrow). The lamps are **2.5x the
plant's pendants** (`MAST.lift`; C's half that): a head at 6.5m over
dark concrete needs it, and the meter under a mast reads in the
fifties. **The sky lands a third of the day's** (a seventh in a shadow): `addLightRig(rig)` (mapkit)
now takes a map's numbers over `CONFIG.map.lighting`'s - the yard's are
hemisphere 0.2, a fill 0.14 from straight overhead in `lightCool` (the
plant's fill colour `ambientSky` is too dark a blue to land anything;
with it the shadows read 0.07), and the key 0.3, warm, **aimed from bay
C's mast head at the yard's centre** (`aimKeyLight`), 28 degrees up. Bay
C's is the mast that covers the most Warden ground inside the ring (2274
cells to 1906 / 1731 / 1544), which is the job's rule for the one
shadowed light; `the-yard-is-floodlit-from-masts-at-night` counts the
cells and holds `KEY_MAST` to the count. Readings: pools A 26.9 / B
24.5 / C 21.0; the sky alone 8.1 / 3.0 / 8.1 (B's site floor is in its
south row's key shadow); a lane no lamp reaches 3.0, a stack's shadow
3.0. `lit-pools-and-dark-gaps-are-actually-contrasty` is green on the
yard for the first time; `the-yard-is-dark-between-its-pools` holds
the gaps under half the dimmest pool and above black and the sky under a
third of the brightest pool (0.30 - the tightest margin in the job; the
lamps' lift is what moved it, not the key). `EXPECTS.lights` is 5.
Spec 20.20, D39 (every number, and the alternatives).

## The Warden's walkway - D3

`WALKWAY` in `src/maps/yard.js` states it; `walkway(map)` builds it. A
glazed run 12 x 2.4m, its **floor 7.2m up over the mid lane's north
edge** (x -6..6, z -3.4..-1.0), between the bays: the end faces look
down the mid lane into bays A and B's open corners, the south face over
bay C's gap, and from the middle the Warden sees all three sites through
the glass. One flight of **24 treads** (`addStaircase` takes `steps`)
up the west side of the gate lane beside bay A's lane row, **rails both
sides** (the west rail is load-bearing: without it the Warden's ground
stepped off the ninth tread onto the row's top and walked the whole
container deck), the door the stair's mouth in the north face. A metre
of parapet, glass to a roof at 2.3m, and **three slots 0.4m wide from
the parapet's top to 1.95m** (D37 says why they are tall: the eye is at
1.755 and a square slot aims 19° down at most): west to bay A, east to
bay B, the middle of the south face to bay C.

**Glass** is `addSolid({ glass: true })`: `CollisionBox.glass`, solid to
a body, a round and a blade, `blocksSight` false so the eye, the AI and
the light model pass; `materials.glass()` (mapbake.js) at
`map.glassOpacity` 0.3, double-sided, no depth write, no shadow. The
rifle's raycast takes no filter, so a pane stops a round already. **The
knife stops where a body does** now: `Combat.knifeReaches()` asks for
open air torso to torso of every solid box (`lineOfSight` with a solid
filter), a blocked swing is `combat:knife-miss { blocked: true }`, the
alarm camera's knife listener asks the same. It had no world test at
all before; the plant's walls are thicker than its reach.

Checks, `tests/walkway.js`: the run's skin against 4 eyes x 40 points
(stopped, or out through a slot or the door, nowhere else), the real gun
through the west slot (19.5m, at site A) and at the pane (0.57m), the
real knife at the slot (cuts) and at the pane (blocked); D12's sentence
over every top within 4m, the rule on all 53 boxes with and without a
staged perch (3m under the floor: nothing, the parapet; 3m under the
roof: the roof, so the rule is reading the geometry), the Warden's
ground, and the human Warden up the stair (3.9s) and along the run;
and, on every map, a knife in a clear lane with and without a staged
post, glass or not. **D38 (blocking): the Shade can walk up the stair.**
A stair is walked by anyone and a door only one body passes is a new
rule; D3b is queued behind it. Spec 20.19, D37.

## The yard is blocked out - D2

`src/maps/yard.js` (the geometry) and `src/maps/yarddata.js` (sites,
spawns, lights, waypoints, routes, and `CONTAINER` / `TIERS`, which both
read). Inside the site fence a **60 x 42 working yard walled by a ring of
one-high containers**, a gate north and south, and a **40ft laid across
each gate as an arch**: the Warden walks under, the Shade climbs it from
the ring top either side and walks over, so the ring's tops stay one
surface. Bays A and B either side of the gate lane, each walled by the
ring and two 12m rows and open at the corner they leave (the Warden's
way in); C across the south with the lane's gap and the rear gate; stacks
in every bay and in the storage blocks either side of C. **Every row and
stack touches the ring or a row that does, so the one-high tops are one
connected deck** (v2 requirement 2, outdoors) -
`the-container-tops-are-one-connected-deck` (tests/yard.js) floods them by
touching and by the rule's climbs and names any island. **The container is
2.9m, a high cube (D35)**: past `shade.reach.standing` (2.6), so one high
is a jump and a grab; two high (5.8) is past the jump's 3.8 and needs the
one below - `one-high-is-a-jump-and-two-high-needs-a-stack` holds the
sentence and drives every upper tier from the tier below. Every route
starts on **pallets** (1.0m: a vault from the ground, a 1.9m mantle onto
the row beside them) because tests/routes.js wants a first step found on
foot within a standing reach. What the checks need at ground level and
where it is: the header comment of yard.js. **"Inside anything" on the
yard is the crawl space under bay B's trailer** (bed 1.2-1.5m): the
census (`plantableSpots`) enumerates crawl spaces on every map, kind
`crawl`, and the inside-anything checks take ducts and crawl spaces
alike; the plant has none, honestly.

Under it, two things that were not the yard's: the **room-entry
derivation merged runs of different sills** (a 9m gap and then a 12m row
was one entry at the row's centre; `maprooms.js` splits a run where the
sill changes - the plant's walls reach the ceiling, so it never showed),
and **five checks stood at the Turbine Hall's coordinates** for open
floor (speeds, the noise ladder, the taser, the knife) - `tests/lanes.js`,
`clearLane(h, length)`, finds a straight clear run on whatever map the
page is on; the hang-under-a-lid case searches for a lidded lip
(`findLiddedLip`, tests/hang.js) instead of naming hall-container. Three
AI checks that stand in the hall's LIT lane are `maps: ['plant']` until
D5 gives them a lane the yard's lamps light. Not built: lighting (D4;
`lit-pools` is red on the yard until then), the walkway (D3), the AI's
tuning (D5), the yard in the default gate (D6). Spec 20.18, D35.

## Two maps, one page load each - D1

`src/maps/index.js` is the registry: `plant` ("Meridian Substation" -
`maps/plant.js` and `maps/plantdata.js`, which were `src/map.js` and
`src/mapdata.js`) and `yard` ("Container Yard" - `maps/yard.js` and
`maps/yarddata.js`; an empty fenced plane under D1, blocked out by D2,
above). `buildMap(id, { gradientMap })` is the only way a map is
built, at boot, from `requestedMapId(location.search)` (`?map=yard`; an
unknown id opens `plant` with a warning); **another map is another page
load** (D34) - the main menu's *map* row calls `goToMap(id)`, which sets
`location.search` to `mapUrl(search, id)`, keeping the seed and the
gate. `GameMap` has `id` and `name`; `addSite`, `addShadeSpawn`,
`addWardenSpawn` and `addLightRig` are the kit's now; `validateMap(map,
expects)` takes each map's own counts (`EXPECTS` at the top of each
builder). Spec 20.17.

**The suite is parameterised over the map.** A check registered with
`maps: ['plant']` runs there and is reported *not for this map*
elsewhere - never run, never a pass; a check with no `maps` runs on
every map and reads `h.map`. 23 checks are scoped today, each with its
reason on the line: they name a tag, a coordinate, a Section 5 count or
a structure (lips, ducts, staircases) the yard will never have. The
rule for a new check: **name the map only if you name its geometry.** A
check that searches the map for a feature (a ledge in the hang band, a
wall near a waypoint) stays generic and is honestly red on a map with
none - 21 were, on the empty yard, and D2 turned all but D4's one.
`a-check-registered-for-another-map-is-reported-not-run` requires every
`maps` entry to name a registered id. The runner: `npm run suite --
--map plant,yard` loads the page once per map, runs each `--runs` times,
judges red and flaky **per map**, prints `run 1 (plant): ...` and tags
ids `[map]`; the default is `plant` alone until D6 puts the yard in the
gate. It refuses a page that booted a different map than it asked for.
Checks: tests/maps.js (three), and the briefing check names the map.

---

## The playtest build - C1

What you get by opening the page is now the **playtest build**: no F3, no
F4, every test key inert, no runtime assertions, no F3 fields recorded,
`?mode=freeroam` ignored (the menu's Free roam button is the player's way
in and is not gated). The gate is `SETTINGS.debug`, seeded `false` from
`CONFIG.settings.defaults.debug`; `?debug=1` on the URL
(`debugRequested()`, config.js, applied in main.js before `bootstrap()`) or
the settings menu's *debug tooling* row turns it on, and off again with a
panel up the next frame takes the panel down (`debugTools.hidePanels()`
from `update()`). `DEBUG` no longer exists. Spec 20.12.

`window.BLACKLINE` is set in **both** builds - it is the suite's way in -
and `AutoSuite.runChecks()` holds the gate up for the length of a run and
puts it back, the way it does the loop (F4). So `npm run suite` is
unchanged, `BLACKLINE.debugTools.runAutoTests()` from the console works in
a playtest tab, and a check that presses F4 through `pollKeys()` still
finds it live. `resetSettings()` resets the gate too (it is a setting);
the one check that calls it mid-suite snapshots and restores it. The
check: `with-the-debug-gate-off-every-debug-key-does-nothing`
(tests/debuggate.js) - on, F3, F4 and T do their thing; off, with the
panel left open, all 15 debug keys through the real path change nothing.
`panels.js` (the HUD, the scoreboard, the menu and their buttons) split
from main.js for the 600-line guard.

## The round opens on a briefing - C2

Every route into a round the player has - the main menu's Play and Free
roam, the intermission's Next round (`panels.js`, `brief()`) - raises
`ui/briefing.js`: the round number (or *Free roam*), the role, the
objective in one line with the round's own numbers (`CONFIG.round`,
`CONFIG.shade.lives`), the three sites as `id name` from `map.sites`, and
the controls for the role read from `input.bindings` (`keyLabel()` turns a
code into what is on the key). It is **never raised by `initMatch`**, which
every check calls, so the suite never sees it unless a check presses the
button. It **holds the round**: the frame feeds the step planner nothing
while it is up (`held = paused || briefing.open`, main.js), the HUD is not
drawn behind it, and `resetPresentation()` takes it down before every
check. **Any key or mouse button dismisses it**, read in the frame before
the pause key from `input.pressedCodes`, and `briefing.dismiss(input)`
spends the press: a Space is not a jump, an Esc is not a pause.
`SETTINGS.briefing` (seeded true) and the settings row *round briefing*
(`#bl-brief`) turn it off; off, the click starts the round. Spec 20.13,
D30 (provisional: the hold, the wording, every round).

Found under it: **Next round reset the round to 1.** The intermission goes
through `initMatch` (Section 15, every actor rebuilt), which called
`objective.resetRound(1)`; the HUD read `r1` all match and the scoreboard's
round column never moved. `initMatch` takes `round` (default 1), the
intermission passes `objective.round.number + 1`, and `match.roundNumber`
follows. Checks: `a-round-opens-on-a-briefing-that-any-key-dismisses` and
`the-briefing-follows-the-round-and-the-setting-skips-it`
(tests/briefing.js), both driving the real buttons and the real key path.

## Hit and damage feedback, in the frame - C3

`systems/feedback.js` is one full-screen quad with a `ShaderMaterial`
whose vertex shader passes clip coordinates straight through (no camera,
no FOV, no aspect; `frustumCulled` off), drawn last (`renderOrder` 1000,
no depth) over the scene. It is drawn by the **renderer**, not the DOM, so
`gl.readPixels` sees it and the checks prove it; the HUD's flash overlay
is DOM and no pixel check can see it. Three layers in one fragment shader,
`over`-composited: the vignette (elliptical, `feedback.vignetteInner` to
`vignetteOuter`, `vignetteMax` opacity times health lost), the direction
arc (a ring at `indicatorRadius` in aspect-corrected half-heights, an arc
`indicatorArc` either side of the bearing), the hit marker (four diagonal
strokes, `hitMarkerInner` to `hitMarkerOuter`). It listens: `combat:damage`
for the human's actor with an `at` sets the arc (the rifle now passes its
muzzle as `from`; a frag's `gadget:damage` carries the blast `at` and
wiring passes it to `combat.applyDamage(actor, amount, who, kind, from)`);
`combat:knife-hit` and `gadget:taser` mark for the Shade, `combat:impact`
on the Shade marks for a human Warden; `frame:render` runs the clocks and
writes the uniforms (the arc's bearing is `atan2(x, -z)` of the source in
camera space, recomputed every frame); `match:init` resets. `mesh.visible`
is false whenever every layer is zero, so the idle cost is nothing, and
`warm(renderer, scene)` compiles the program at boot because the soak
counts programs before and after a match. **A check that reads pixels
between two `renderer.render` calls with no step between them sees only
the feedback change** - that is how tests/feedback.js isolates each layer
(`feedback.update(0)` settles the uniforms without a frame; forcing
`hitTimer`/`indicatorTimer` to 0 is the "without" frame). The vignette is
measured at site A: a red over the dark apron reddens black, which is not
darker, and the queue's `brightnessDelta` wants a darkening. D31.

`boot.js` holds `bootWorld()`, the old `bootstrap()` body: main.js
destructures its return into the singletons. main.js is 470.

## The round closes on an end screen - C4

A round ends with an **outcome** as well as a reason: `OUTCOME`
(`systems/roundstate.js`, re-exported by objective.js: detonated /
defused / eliminated / time), set by `_end(winner, reason, outcome)` on
`round.outcome`, the round record and the `objective:round-end` event.
The objective keeps a **timeline** of its own round (`round.timeline`,
`{ t, text }` at `round.elapsed`: `round N begins`, `charge armed at A`,
`life lost - 1 left`, `reinserted`, `warden down` / `warden taken down`,
and the reason at the end), copied into the record. **The intermission
is not raised on `round-end` any more.** `_end` sets `round.endTimer` to
`CONFIG.round.roundEndDelay` (2.5s); `step()` on an ended round runs
`_stepEnded()`, which counts it on the sim clock and emits
`objective:intermission` once; the wiring shows the scoreboard and
restores the death camera on that, and puts a HUD line up on
`round-end`. A check that ends a round and wants the card steps
`2 + ceil(roundEndDelay / dt)` first (tests/briefing.js does). The death
camera now stays on the killer through the delay when the third life
ended the round, and the card takes it down - it used to stay up under
the card until the next `initMatch` or the wall-clock guard, because the
objective hears `combat:death` before the wiring begins the camera.
`ui/scoreboard.js` prints who and how (`sayOutcome(outcome, reason)`,
one sentence per Section 10.4 row; the match screen tallies the
winner's rounds), the timeline through `timelineLines()` (all of it up
to `TIMELINE_LINES` = 5, else the first and the last four) and a *how*
column. Play calls `objective().resetMatch()` itself (panels.js). Checks:
tests/roundend.js. Spec 20.15, D32.

## The Warden shoots straight, and the presets are measured - C5

**The Warden is much deadlier than any playtest so far has had.** The
difficulty pass changed no preset value (`ai.difficulty`: fill, aim cone,
reaction delay - Section 11's numbers); its instrument found the gun.
Until C5 ENGAGE aimed at `lastKnown.y`, the Shade's *feet* (the planner's
floor point), so half of every burst met the floor first and, with the
pitch bias drawn negative, all of it - 0 of 52 rounds hit at 8m on every
preset; and a "burst" was `engageBurstMin`-`Max` *steps* - one round,
sometimes two, then a 0.25-0.7s pause. Now `_stepEngage` aims `_aim` at
the torso the eye sees (`torsoHeightRatio`), a burst is 3-7 rounds
counted as the gun fires them (the AI subscribes to `combat:shot`, holds
`intent.fire` until the burst is out, then starts the pause), and the aim
error is a cone in yaw and pitch redrawn for every burst
(`_drawAimError`, `_aimYaw`/`_aimPitch`, applied in `_face` when aiming)
where it was a pitch-only bias held for the whole engagement. A lit,
still Shade at 8m on medium: engaged 4.97s after it is first seen, dead
0.51s after that; the table is in D33 and on the `difficulty` block in
config.js. `each-difficulty-is-quicker-to-see-you-and-quicker-to-kill-you`
(tests/difficulty.js) holds both times falling from preset to preset at
8m and 16m, eight paired seeds; `the-warden-fires-in-bursts-of-rounds-at-the-torso`
holds the burst, the aim point and god mode. **God mode covers the rifle
now** (`Combat.isGodMode`, from boot.js; `_damage` refuses for the Shade
while it is set) - since the test commands were wired it had guarded only
the frag, which nobody noticed while the rifle hit the floor. Spec 20.16.

---

## The redesign — read this before touching traversal or the map

Josh, after phase 49:

> *"endgame there should be no markings. should be able to do on a ledge what
> you would expect to be able to."*

This **amends the spec**. Section 5 mandated affordance markings and Section 6.1
fixed three traversal bands; both are being replaced. The direction was settled
by interview and is binding:

| Decision | Answer |
|---|---|
| Scope | All traversal aids gone: ledge stripes, chevrons, dashes, and the lit vent interiors. **Plant-site rings stay** — a bomb site is objective information, not an affordance |
| Climb rule | **Reach-based, athletic**: ~2.6m standing, ~3.8m with a jump. **And only on a press of Space** — never a side effect of moving (D17, spec 20.2) |
| Failed climb | A physical tell **plus audio**. Never silent. Built as B2: the bump-and-scuff (below) |
| Hang | A **held option you choose**, never a failed mantle. Built as B1 (D21, D22, spec 20.4): a climb of a ledge at least **1.4 Shade-heights (2.59m)** above where it started — one you had to jump for — begins with a grab: **tap Space and you hang, hold Space and you go over**; from a hang Space pulls up, crouch drops, A/D shimmy. Lower ledges go straight over. Since B8 the hanging body is at **full stretch** - arms up, gloves on the lip, the capsule's top under it (`hangDrop` 2.05) - so a lip under a low gantry hangs and its pull-up scuffs |
| Warden | **Stays grounded.** The asymmetry is the game |
| The test | **Purely mechanical.** Standable top + within reach ⇒ climbable. No tags, no exceptions, no `noClimb`. The map obeys the rule |
| Map freedom | Keep the five v2 requirements (Shade starts outside, level 2 is one connected deck, stairless routes up, every room 2+ entries, raised ceilings). Reshape everything else freely |
| Vents | Read as passable by **material contrast** — metal against concrete. Built as B6 (D26, spec 20.7): `palette.ductMetal` on every piece of a run, and `every-vent-mouth-reads-by-contrast-from-its-approach` measures it from the pixels |
| Spec | **Amended** — Section 20.11 (B9, 2026-09-14) is what Sections 5, 6.1, 16 and 18 now read as, pointing at 20.2-20.10 for the pieces. Nothing above Section 20 is ever edited |

---

## The 50-phase plan

| Phases | Block | Status |
|---|---|---|
| 1–7 | **Strip and measure** | ✅ done, committed |
| 8–11 | **Reach-based traversal** — jump-extended reach, ground climbs, approach tolerance, input buffering | ✅ done, committed `5c6d571` |
| 12–18 | **Hang as a held option, and the bump-and-scuff** | ✅ B1 (D21, D22) and B2 done 2026-09-10/11 |
| 19–34 | **Area rebuild, lockstep** — geometry + controller together, worst area first | ✅ B5 done 2026-09-13: measured honestly, nothing to rebuild; two rule/controller bugs fixed, routes declared, D25 raised |
| 35–41 | **Legibility without markings** — material language, edge profiles, metal ducts, route lighting, contrast measured from pixels | ✅ B6 (2026-09-13) and B7 (2026-09-14): the ducts are galvanised sheet, the routes are lit and their landing edges carry a strip, both held from the pixels |
| 42–46 | **Feel** — camera, momentum, weight, timing, traversal fuzz | ✅ B8 (2026-09-14): momentum into a vault, landing weight, the camera dip, the buffer in every state, the hanging body, the 10k-step traversal fuzz; and the way up is swept (spec 20.10, D29) |
| 47–50 | **Close** — amend the spec, re-sweep, Warden sanity, done-definition | ✅ B9 (2026-09-14): spec 20.11 amends Sections 5, 6.1, 16 and 18 by reference; the regression set carries the redesign's checks by id; `the-warden-never-leaves-its-ground` watches the AI on its ground and found it planning from its centre - it walked off the deck - fixed in `_pathTo()` |

Outside that numbering, and **first** because it is a directive rather than a
plan item: **the plant must be defusable** — Block A in `QUEUE.md`, reasoning
below. Phases 12–50 are Block B there.

---

## The census is green, and what the climb rule now says

```
PASS  every-climbable-surface-can-actually-be-climbed
      58 climbable surfaces, 226 approaches from every surface the rule
      derives them from, 191 climbs; the controller got onto all 58
      reachable surfaces (0 enclosed); 22 need a leg up first
```

(Those were B4's numbers. Since B5 the census counts "from the floor"
honestly and stops trying a box once it climbs from the floor, so its
approach and climb counts move with what succeeds first; the stable number
is the per-approach check's **151 of 151**, below.)

It went green with B3 (2026-09-12), and it must stay green: it approaches
every climbable face from every place the rule says a body can stand —
three positions along the face at three distances back, **and every spot
the rule itself names** — standing or crouched, and drives the real
controller. Named failures are logged to the F4 panel
(`debugTools._testLog`). **Do not "fix" a future red by weakening it.**

The rule, in `src/mapclimb.js`, is now the controller's sentence and not a
footprint test. `supportApproaches(collision, box)`: for every wide solid
lower than the box's top by at least `stepOver`, and every face of the box,
the rectangle where a body's centre can be (footprint fully on the support,
a body radius clear of the box, no further out than the probe reaches),
sampled at its quarter points; at each, the body fits and the controller's
own hand sweep — `PROBE_STEP` 0.12 up from the feet, stop where the hand is
not in open air, keep sweeping past anything that is not this box — meets
this box's face. A face above the ceiling over the only place you can
stand is not climbable, and nothing has to say so. The old test ("any wide
surface within `vaultReach` of the footprint is below") named a gantry
touching a deck slab at one corner, a duct roof diagonally beside a
container, and server racks three metres under the roof; the census stood
where the rule said and found nothing in reach. Nine surfaces stopped
deriving — six deck slabs (entered by their lips, which all still climb),
`roof-1` (a corner), `roof-4` and `roof-5` (the ceiling) — and every
designed route kept its move.

Its sibling `the-climb-rule-has-no-exceptions` recomputes "should climb"
from the same approaches and passes; it is what makes the rule the single
source of truth. `GameMap._supportApproaches(box)` is how a check reads the
spots; `_supportCandidates(box)` is still the heights.

"21 need a leg up first" is reported, not failed — Josh's call. A surface
you climb something else to reach is the point of a stacked route. Since B5
"from the floor" means *from ground a walking body reaches* — a stand spot
within a metre of a `map.wardenGround` cell at its height — and not, as it
did, "from the lowest thing a short ray found under the spot", which
counted the office desks and missed two fire-escape flights. The 21 are the
deck slabs and lips every route lands on, the intermediate stages only
reachable from the stage below, and the roof strip and its lip; the full
list is in the F4 log after the census runs.

## The routes are declared, and the rule's every sentence is proven — B5

Three checks hold the stacked routes now (`tests/routes.js`, and one in
`tests/readability.js`):

- `every-approach-the-rule-names-is-a-climb-the-controller-makes` stands
  at every spot the rule names, on the support it names, holds W and Space,
  and requires the climb: **151 of 151**. The census needs one climb per box
  and that hid two disagreements for four phases — the duct roofs are a
  3.57m jump from the hall floor by the rule, and the controller scuffed
  there because its sweep stopped at the duct *floor's* side (climbable by
  its mouth, unclimbable from here) and never looked higher; and the rule
  reached 1.44m ahead for every rise where the air probe reaches 1.29m.
  `_climbAhead()` now sweeps past a refused climb; `handReach(rise)` in
  mapclimb.js picks the controller's distance. Spec 20.6.
- `every-stacked-climb-is-a-step-of-a-declared-route`: `map.routes`
  (mapdata.js `placeRoutes`) is eight chains of stages — the five designed
  routes, the two the duct roofs make (lip, roof, void edge), the fire
  escape split at its deck landing — each first stage a standing climb from
  walkable ground, each later stage climbable by the rule from the stage
  below, each landing where it says; and every climbable surface with no
  walkable approach is on one of them. Not a tag: nothing in the rule or the
  controller reads it. `stairlessRouteMin` (5) is asserted at build.
- `every-climbable-top-has-an-exit-that-is-not-the-way-you-came`: onward
  climb, a surface at its level to walk onto, or a second clear edge to
  drop from. No dead climbs today; a staged crate walled on three sides is
  one.

What B5 did **not** do is move geometry: measured honestly the map had no
dead climb and no accident the rule does not read as a route. Whether the
void edges should refuse anywhere but at a lip — which would make the lips
mean what B7 assumes they mean — is **D25**, and B5b is queued behind it.

Since B4b an approach also carries its **landing**: `landingSpot()` is
where `Shade._ledgeDestination` puts the body (a radius and 0.3m past the
face), and `landingFits()` asks whether the crouched capsule is clear there
— the capsule `_commitMove()` validates. A spot the body cannot land from
is not an approach, and the old "standable somewhere on the top" test at
the box's quarter points is gone: on a 38m deck slab it could be 20m from
the face. (B4 met exactly that — a void flush against `office-wall-s` made
`deck-14` derive from the gantry with a wall for a landing — and closed it
with geometry before B4b closed it in the rule.) The derivation resets
`climbable` on every box before deciding; nothing declared on a box
survives it, and `addSolid()` no longer takes a `climbable` option. The
rule's sentence: *a surface is climbable when the body could reach its
face from somewhere it can stand, get its hands over the top in open air
(B5c), and fit on top where it lands.*

## The material language, and what the pixels say - B6

Concrete is what you do not pass through: walls, floors, the deck, the
ground. Metal is what you pass through or climb: the ducts in galvanised
sheet (`palette.ductMetal`, 0xc6d0d6 - D26, provisional), gantries, deck
lips and the fire escape in gunmetal. The palette comment in `config.js`
says so, and `addVentRun()` paints every piece of a run - floor, lips,
walls, roof - the one metal; before B6 a duct was the floor's own dark
concrete, and a duct on the floor was the floor.

`every-vent-mouth-reads-by-contrast-from-its-approach`
(`tests/legibility.js`) is the instrument: for each of the nine mouths
(`vent.mouths` - a lip is climbed into, a grade run is walked into at both
ends) it stands where a body arrives - for a lip, the lowest spot the climb
rule names on that face; for a walk-in, level floor straight out, as far
back as there is floor - renders, hides the run (`vent.boxes`) and renders
again, and reads three regions from the difference: what is seen *through*
the projected opening (the interior), everything the run draws (the body),
and a band 0.6 openings wide around it (the surround). Both the interior
and the body must be at least **0.25 Michelson** against the surround.
Today: 0.27 to 0.81; the thinnest is the north duct's west mouth, walked
into from the top of `stack-hall-mid` with orange crates as its surround.
With concrete ducts, eight of nine read 0.01 to 0.23 - that is the check
proving it measures the material. It costs ~30s a run on SwiftShader.

## The way up is swept, and the feel - B8

B8 (2026-09-14) built the plan's phases 42-46 - every one a number in
`config.js` under `shade`, recorded as D29 with the line to turn:

- **Momentum into a vault**: `vaultDurationAtSprint` 0.28 (from
  `vaultDuration` 0.42 at a walk), `vaultCarry` 0.85 of the entry speed on
  the exit, floored at `vaultExitSpeed`. A sprint leaves a crate at 5.5, a
  walk at 4.2 as before.
- **Landing weight**: `shade.landing` - nothing under `softFall` 1.2m, all
  of it from `hardFall` 4m; `speedLoss` 0.5 cut on the landing step and the
  ground speed held there for `recovery` 0.4s; the camera dips
  `camera.landDip` and the body squashes `landing.squash`. The one item
  that changes what a player can do by a hair (0.4s off a deck drop);
  `speedLoss` 0 is a landing that is only seen.
- **The camera dip**: `_dipKick` written by the step, `_settleDip()` in
  agentvisual.js a critically damped spring (`camera.climbDip` 0.22,
  `landDip` 0.3, `dipRecovery` 0.26). Not on a grab.
- **The buffer in every state**: `jumpBuffer` counts down in `step()`, is
  set by a press on the ground, in the air and through a vault or mantle
  (not a grab), and is spent by the climb or the scuff it becomes.
- **The hanging body at full stretch**: `hangDrop` 2.05, `HANG_ARM_ANGLE`,
  `hangPullUpDuration` 0.65.

**And the rule it found: the way up is swept.** The hang under `gantry-hall`
worked and the pull-up went *through the gantry* - the landing is beyond
the gantry's edge and valid, `handsOverTop` clears the column to the top of
the face, and the body is taller than a hand. `riseIsClear()` in
climbprobe.js sweeps the capsule along the move's own path (`movePath`,
shared with `_stepTraversal` so the sweep and the drawing agree) against
every solid whose top is above the landing's; `riseFits` (mapclimb.js) and
`_climbOnto` (agenttraversal.js) both say it, the grab does not. Nine
approaches went: the gantry one, and every low duct lip's two side faces
from the ground beside the mouth, where `addVentRun()` stands a wall on the
lip's edge and the mantle went through it. 146 -> 139; the same 22 stacked
climbs; every top still climbed. The rule's sentence is now: *a surface is
climbable when the body could reach its face from somewhere it can stand,
get its hands over the top in open air, rise to the landing through
nothing, and fit on top where it lands.* Spec 20.10. B8b (2026-09-15) holds
the sweep to the geometry: `supportApproaches(collision, box, { sweep:
false })` names what the rule named before B8, and
`a-mantle-never-passes-through-a-solid` asks of every one of those 159
whether the crouched body along `movePath` meets a solid above the landing
- overlap written by hand, no call to `riseIsClear` - and requires the
rule's answer to match exactly both ways (9 refused, 150 named), then
drives the controller at each of the nine and requires a scuff with the
feet never over the top. Turning either sweep off puts it red.

Seven checks: tests/feel.js (four), tests/hang.js, and tests/traversalfuzz.js
- `traversal-fuzz-ten-thousand-steps-never-sticks` starts every episode at
a spot the rule names and drives twelve behaviours through real keys for
10,000 steps with "stuck" defined (a move past 41 steps, a hang with no
ledge, 3s airborne, at rest in a solid, below the floor, not finite), and
`after-any-traversal-the-body-can-be-put-back-on-the-ground` asks, after one
episode per approach, that nothing pressed (crouch from a hang) grounds the
body within 3s. `agentslide.js` split from agent.js for the 600-line guard.

## The routes are lit - B7

`src/maproutelight.js`, after the climb rule and before validation. Every
stage box of every declared route has its four sides painted with its own
colour as emissive (`map.routeLighting.emissive`, 0.12; the material
cache's `lit` variant; two material groups per box, so 20 more draw calls)
- the sides, not the top, because the top is what you see standing on it
and what B6's mouth check reads the north duct's west mouth against (the
first cut lit the tops and put that check red at 0.21). And the edge each
route goes over at the top - where the rule names an approach onto the
landing from the last stage, a body's reach either side of the spots -
carries a warm-white unlit strip, 15 of them in one mesh, one draw call.
Paint, not lamps: the detection model reads point lights and there are
still twelve. `every-route-reads-lit-from-its-foot` stands at each route's
foot, reads the first stage against the same stage painted unlit in the
same frame (a step of at least 10 luma; 16-27 today) and against its
surround (0.25 Michelson; 0.30-0.61), then reads each strip from the last
stage (0.5; 0.72-0.98). D28 is the look; the strips on `deck-7`, `deck-19`,
`deck-21`, the bay slabs and the hatch are D25's routes drawn, and go if
Josh picks option 2 there. Spec 20.9.

**B5c closes the bug B6 found.** The rule named a climb onto
`vent-low-north-lip-from` from the ground *under* the duct, by the lip's
+x face exposed beneath the floor slab (1.4-2.1m), and the controller made
it: W + Space at (-11.11, 0, -16) facing west mantled the body up through
`vent-low-north-floor` into the mouth - five approaches, all under a duct
floor. Now `handsOverTop()` in `src/climbprobe.js` - the hand sweep's
constants and the one sentence the rule (`mapclimb.js`) and the controller
(`agenttraversal.js`) share, since neither may import the other - asks
that the column above the body be open air up to the top of the face the
hands met; a face whose top edge is under a solid is a wall under a
ceiling, and the press scuffs. `a-mantle-never-passes-through-a-solid`
(tests/routes.js) asks the geometry (nothing over the spot and under the
landing) and then drives the controller from under each low duct's floor
without asking the rule. Spec 20.8. The rule's sentence is now: *a surface
is climbable when the body could reach its face from somewhere it can
stand, get its hands over the top in open air, and fit on top where it
lands.*

**And what finishing it found: the Warden walks off a pulled line.** B5c
changed which top the plant census sends the Warden to in room A (the
north duct's *roof*, 3.59m up, once its lip stopped being climbable), and
the Warden fell off the deck on the way: `WardenGround.route()` pulled a
straight segment across the hall void's corner because `walkable()` rests
a body on any top face its footprint overlaps and this line had six
millimetres of deck under it, and the follower cuts every bend from
`ai.waypointArriveRadius` (0.9m) away on the inside. Now a pulled segment
keeps ground under the two lines `ai.routeEdgeMargin` (0.6m) to either
side of it (`groundUnder()` in mapground.js: support only - a wall beside
the line is a slide, a void is a fall), the AI passes the margin from
`_pathTo()`, and `the-last-leg-to-every-legal-plant-is-planned-and-short`
asks the same of every pulled segment by ray; on the old routes it is red
at the hall void *and* at three lines grazing the vault hatch. Cell steps
are not held to the margin - they are flood-proven edges - so a rim cell
(a centre up to 0.15m over an edge) is still somewhere the follower will
aim; nothing has walked off one yet.

**What the Warden then did is D27.** It stood on the deck directly above
the roof plant - 2.41m up, inside `DEFUSE_REACH.dy` - and defused it
through the slab in 11.8s, which is D5 as written and not as meant. The
fix (the reach needs a clear line from the Warden's body to the charge)
changes where the Shade may plant, so it waits: D27, and B5d behind it.

---

## The plant is a room, not a circle

Josh, mid-session: *"able to plant the bomb anywhere in the room. not just in
the circle."* Spec amended — Section 10.1, recorded in the new Section 20.

A site knows its room (derived by containment, never declared twice) and the
plant is allowed anywhere in that volume, floor to ceiling. The room's own
bounds do the vertical separation the old hardcoded 2.5m did: site C is on the
deck directly above the Loading Bay.

**The charge now sits where it was planted** — `round.chargeAt`. The site id is
only which room. The beep, the AI defend target and the defuse proximity all
read it. The defuse radius is untouched: it is arm's length, not a marking.

Open, and Josh's call: the ring now says "this room" while looking exactly like
it used to say "plant here". Whether a room-sized marking reads better is not
settled.

---

## The plant must be defusable — Block A

Josh, straight after the room change:

> *"actually should only be plantable where the ward is able to defuse."*

**Phases 1 to 6 are built** (A1, `src/mapground.js`; A2, `canDefuseAt()` in
`systems/objective.js`; A3, the gate inside `_stepPlant()`; A4, the HUD line;
A5, the census; A6, `canPlantAt()` = defusable **and not inside anything**,
D20; A7, the ground drawn — **F4 then N**; A8, the AI's last leg planned over
that ground). **Block A is closed.**

### What the rule actually excludes, measured

A5 counted it, and it is not what this section assumed; A6 then changed it,
and B4 changed the map. Of **377 places a charge can go inside a site
room** — 347 floor cells on a 2m grid, 22 climbable tops, 8 vent interiors
— the rule refuses **ten**: the 8 ducts by their lid (D20, below), and these
two by the reach:

| Refused | Why |
|---|---|
| `hall-container` (room A), 0.7m up | the middle of a wide top, >2m from any Warden ground — horizontal, not vertical |
| `gantry-hall` (room A), 1.0m up | same |

Two more were refused until B4: `server-rack-0`'s top, and the deck floor at
(21, 17) — and behind that one cell, 150 spots at 0.1m in the two rack
aisles, which took the 0.68m Shade and never a 0.84m Warden ground cell.
The aisles are 1.5m now and `no-clear-floor-in-a-site-room-refuses-the-plant`
(`tests/deck.js`) scans every site-room floor at 0.1m for the next one.

So the reach reads "no plant in the middle of anything wider than four
metres" far more than it reads "no plant up high" — the horizontal reach does
almost all of that excluding, and the vertical one none. What it did not
exclude was a charge inside a duct: the ducts run at y=2.3 against a 2.5m
vertical reach, a Warden underneath reaches up, and A5 watched the AI do it in
9.6s. Josh's answer (D20): *"can't plant inside things. only on top."* Built as
A6: `canPlantAt()` is `canDefuseAt()` **and** `hasHeadroomAt()` — a standing
body's worth of open air above the charge, `PLANT_HEADROOM`. A duct fails by
its roof; a crate top passes by the air above it; nothing is named.

The two questions at the end are **decided** — D5 and D6 in `DECISIONS.md`;
the one A1 raised is D16.

### Why the room rule alone is wrong

The redesign put this hole here on purpose and then walked into it. The Warden
**stays grounded** — that is the asymmetry, and it is binding. The Shade is not:
it now climbs anything within 3.8m. So inside a site's room the Shade can get
onto a gantry, a crate stack, a vent roof or a deck lip and plant where no
Warden can ever kneel. That is an unloseable plant, and it is worse than a
balance problem — `setDefendTarget(round.chargeAt)` sends the AI at a charge it
cannot reach, so it paths as far as it can and stalls in DEFEND for the whole
45s fuse.

### The rule

> A plant is legal exactly where a Warden could stand and defuse it.

Not a second authored zone. It answers to the defuse check itself, so the two
cannot drift — the same trick `classifyReach()` plays for the map and the
controller. The room stays as the outer bound; this carves out of it.

Worth knowing before starting: on a flat room floor this changes nothing at all.
It excludes the climbs, the vents and the ledges, which is exactly the list the
Warden cannot follow the Shade onto.

### Phases

| # | Work |
|---|---|
| 1 | ✅ **done** — `src/mapground.js`, `map.wardenGround`. 0.5m column grid, flooded from the Warden spawns; 25,177 standable cells in 18,550 columns, 6,627 of them carrying two floors. The step limit is symmetric, so a one-way drop is not in it (D16). This is the file that *states* "the Warden stays grounded" |
| 2 | ✅ **done** — `Objective.canDefuseAt(at)`. The reach is one exported object, `DEFUSE_REACH` (`radius`, from `round.siteRadius`, and `dy`), and one predicate, `withinDefuseReach(foot, at)`. The defuse asks it of the Warden; `canDefuseAt` asks it of every cell of `map.wardenGround` near the point. Legal at all three site centres. Conservative by up to half a cell — D18 |
| 3 | ✅ **done** — `_stepPlant()` asks `canDefuseAt()` of the Shade's feet every step of the hold, under the site-and-interact gate and *above* the noise interval, so a refusal costs no progress and emits nothing (D6). `WardenGround.someCellWithin()` makes the per-step call allocation-free |
| 4 | ✅ **done** — `round.plantRefused`, out through `objective.hud`, onto the prompt panel the plant already owns as `PLANT_REFUSED` (`ui/hud.js`) with the hold bar hidden. No sound, no noise event (D6). Not a latch: recomputed every step, so releasing interact clears it |
| 5 | ✅ **done** — two checks in `tests/plantcensus.js`: the game against the rule at all 373 spots, and the rule against the map (ground exists, the waypoint graph reaches it, the AI arrives). `spotOffTheRing()` picks from the legal set. Old text: | For every climbable surface top and every vent interior inside a site room, try to plant and assert refusal. Then the inverse: sample legal plant positions and assert a Warden can stand and defuse at each. `spotOffTheRing()` in `tests/objective.js` must pick from the legal set or every objective check starts failing for the wrong reason |
| 6 | ✅ **done** — D20 decided "not inside things"; `PLANT_HEADROOM` + `hasHeadroomAt()`, `canPlantAt()` the whole rule, `dy` kept at 2.5 with the reason as its comment, spec 20.3. Old text: re-examine `DEFUSE_REACH.dy` (was the literal `dy < 2.5`; A2 named it and gave it one home, but did not touch the value) in the defuse proximity test. It was written when plant and defuse were both pinned to a site centre and it is now load-bearing: it is what decides whether a charge on a 2m crate is legal. Today it is — a Warden standing beside the crate is 2.0m below the charge and that passes. Reaching up to a bomb on a crate seems right, but it should be a decision rather than a leftover |

### Decided

- **Beside, or on?** Josh: *"warden must always be able to defuse."* Read as
  on **or** beside — legal exactly where the real defuse check would succeed
  for a Warden on reachable ground. D5 records the interpretation and the
  one-line override if he meant "on only".
- **What does refusal look like?** A HUD line, **"cannot plant here"**. No
  sound, no noise event. D6.

### What A8 found under A1

A1's ground was **two islands**. Treads rise 0.3m every 0.4m and the grid is
0.5m, so two cell centres can sit two risers apart and the flood refused the
edge; nothing climbed either staircase, and the deck was ground only because
two spawns are on it. A1's check asserted coverage — every spawn, waypoint and
site on the ground — and every one of them was on *some* island. The flood
now walks a too-tall edge in quarter-cell sub-steps and proves it if the body
arrives; the check walks the edges from spawn 0 and requires every cell. The
edges are recorded (`WardenGround.edges`) and `route()` plans over them, which
is what the AI's last leg uses.

### The side benefit, now available

Phase 1 built the set as map data rather than an objective-system private, so it
is the honest answer to a question three other systems guess at: whether a
waypoint is standable, whether a DEFEND path can complete, whether a patrol
route is walkable end to end. `map.wardenGround.has(position)` answers all
three. B9 wrote the check: `the-warden-never-leaves-its-ground`
(tests/wardenground.js) plays 70s of AI patrol, hunt and a defended plant
and requires the feet on the ground every step (airborne, within a metre
over it - a stair walked down at 3 m/s is a series of short falls). Its
first run caught the AI planning from its *centre*: `nearestWaypoint()`'s
"own floor" is two steps of height, a centre is a metre up, so from the
deck a corridor node six metres below won and the body walked off the
deck edge. `_pathTo()` plans from the feet now.

A7 draws it: **F4, then N** puts every cell on the floor as a teal quad at
its own height, with an orange marker under the human's actor when it is
standing on a reachable cell. `src/groundview.js`; off by default and off
again on every `initMatch`.

## Where the plant-rule checks live

Block A's checks were one 1,382-line file and are now four, each under the ~600
line guidance:

| File | What |
|---|---|
| `tests/plantspots.js` | where a charge can go — `spotOffTheRing`, `plantAt`, `perchesInSiteRooms`, `plantableSpots`, `plantOutcomeAt`. All four files share these |
| `tests/plantrule.js` | A2, A3, A4 — one reach, the gate every step, the refusal's HUD line |
| `tests/plantcensus.js` | A5 — the whole map, both directions |
| `tests/objective.js` | round flow: detonation, defuse retention, lives, reinsert, milestones, state not bleeding |

## Where the code went — F3's split

Eight modules were past the ~600 guidance; every one is under it now and a
check keeps it so. Nothing moved changes an order or a name a check reaches:

| Was | Now |
|---|---|
| `main.js` (1,145) | `main.js` (597): singletons, `initMatch`, pause, bootstrap, `fixedStep`, `renderFrame` — the spec order untouched. Beside it: `loop.js` (`FrameLoop`, the rAF scheduler), `timestep.js` (`computeStepPlan`), `matchstate.js` (options, `createMatchState`, `COMPETITIVE`/`FREEROAM`), `view.js` (renderer, scene, the one camera and its guard, toon ramp, resize, lost-context watch), `cameraowner.js` (whose rig the camera is on, mouse look, ADS FOV), `intents.js` (input → intent), `loadout.js` (the gadget slots), `wiring.js` (the emitter listeners between systems), `hudstate.js` (what the HUD is told), `debugfields.js` (what the F3 overlay is told), `harness.js` (`createHarness(live, loop)` — one getter per live object), `panels.js` (C1, C2: the HUD, the scoreboard, the menu and the briefing, and what their buttons do), `boot.js` (C3: `bootWorld()`, building the world) |
| `entities/agent.js` (1,051) | `agent.js` (546): state machine, ground, air, the landing. `agentslide.js` (B8): the slide. `agenttraversal.js`: every climb. `agentvisual.js`: how it is drawn, and the camera's dip. `agentstate.js`: `SHADE_STATE` |
| `systems/ai.js` (788) | `ai.js` (498): the state machine. `aiperception.js`, `ainav.js` (route, steering, stuck). `aistate.js`: `AI_STATE`, `angleDelta`, `DEFUSE_SNAP` |
| `mapkit.js` (821) | `mapkit.js` (380): `GameMap`, `addSolid`, decals, rooms, lights, waypoints. `mapgen.js`: walls with openings, floor plates, staircases, vent runs. `mapclimb.js`: `deriveClimbableSurfaces`, `supportApproaches` (B3), `supportCandidates` |
| `map.js` (810) | `maps/plant.js` (was `map.js`, 537): the geometry. `maps/plantdata.js` (was `mapdata.js`): sites, spawns, lights, waypoints, routes. `mapvalidate.js`. Since D1 `maps/index.js` is the registry and `maps/yard.js` the second map |
| `physics.js` (735) | `physics.js` (600): `CollisionWorld`, gravity, `classifyReach`. `collisionbox.js`: the box and the ray-slab test |
| `systems/objective.js` (646) | `objective.js` (536). `plantrule.js`: `DEFUSE_REACH`, `PLANT_HEADROOM`, `withinDefuseReach`, `canDefuseAt(map, at)`, `hasHeadroomAt`, `canPlantAt` — re-exported and wrapped as methods, so every existing import and call still works |
| `mapground.js` (628, after B5c) | `mapground.js` (539): `WardenGround`, `route()`, `deriveWardenGround`. `groundprobe.js`: the column probes the flood and the planner share — `standableFloors`, `walkable`, `groundUnder` |
| `systems/gadgets.js` (633) | `gadgets.js` (506). `gadgeteffects.js`: `EffectRegistry`, `Projectile` |

The class splits (`agent`, `ai`, `mapkit`) are **prototype mixins**: the
sibling file exports an object of methods and the class file ends with
`Object.assign(X.prototype, ...)`. `this` is the same object, every private
field keeps its name, and `shade._probeLedge`, `ai._pathTo`,
`map._supportCandidates` still exist for the checks that call them. A method
that needs a module constant imports it from the shared `*state.js`, never
from the class file — that would be a cycle.

Two things changed shape on purpose. God mode is `debugState.godMode` now —
the `G` command toggles it in `testcommands.js` and `wiring.js` reads it —
rather than a `let` in `main.js`. And `harness.cameraOwner` still returns the
owner string; the object behind it is `cameraowner.js`.

`main.js` is 470 (C3 moved `bootstrap()` out as `boot.js`'s `bootWorld()`,
which returns every singleton for main.js to destructure) and `physics.js`
is 600: the next job that touches physics.js splits it rather than adding
to it.

## A failed climb is never silent - B2

A press of Space that carries the hands onto a face they cannot get over -
too tall for the reach the body has right now, a lip with no room above it,
a face with nothing standable on top - used to do nothing at all. Now
`_probeLedge()` remembers the highest solid face the hands met
(`Shade._faceAhead`), and when the air step's mantle finds nothing to get
over with the climb armed and the body heading in, `_scuff()` pushes the
body straight back off the face at `scuffBumpSpeed`, stops it rising, holds
the hands-up pose for `scuffPoseTime` (agentvisual.js) and emits
`shade:scuff`, which audio.js plays as `scuff` - a 90ms low-passed slap.
One tell per press: the scuff spends the arm. A blocked pull-up from a hang
gives the pose and the sound without the push, on the press and on the
first step if Space was held through the grab, never repeating while held.
D24 records the look and sound as provisional. D23 (decided 2026-09-12,
built as B2b) makes it a noise the Warden hears: the controller records
`scuffedAt` on the step, Detection emits a `scuff` event of
`noise.radii.shadeScuff` there in the same fixed step, the way the landing
works. Checks: tests/scuff.js, which stages a lid of real collision over a
hangable lip to make a blocked pull-up, since no lip on this map has one;
and `a-scuff-is-a-noise-the-warden-in-the-room-hears`, which stands a Warden
along the wall inside and outside the radius, facing away.

## The game does not play itself under the suite - F4

Headless Chrome fires animation frames (`document.hidden` is false there),
so until F4 the live rAF loop ran the real game between every `await` in a
check and through the 45s cooldown between runs - ~135 frames of the AI
hunting an idle Shade that the next check inherited. Now: `FrameLoop`
(`loop.js`) is on the harness as `h.loop`; `AutoSuite.runChecks()` stops it
for the length of the run and puts it back as found; `initMatch` does not
start it (boot does, once); the runner stops it as soon as the harness
appears and reports `loopFrames` per run, and any non-zero fails the run
(`LOOP RAN N frame(s)` in the summary). `h.nextFrame()` is the browser's
tick, not the loop's, and still resolves while the loop is stopped; it
draws nothing - a check that needs a frame drawn calls `h.renderFrame()`,
which counts itself in `debugState.harnessFrames`. In a real tab F4-then-Y
stops the game while the suite runs and it resumes after.

## Where the suite runner lives

`ui/autosuite.js` (`AutoSuite`): the registry, `runAutoTests`, the regression
set, the lost-context tiebreak (F1) and the presentation reset before every
check (F2). `ui/debug.js` composes it and forwards, so checks still reach it
as `h.debugTools.runAutoTests()` / `_autoTests`; a check that must drive the
runner directly uses `h.debugTools.suite.runChecks()`.

---

## Running it

The suite, headless. This is what the routine runs, and what any session runs
before and after a job:

```bash
npm run suite
```

`scripts/suite.mjs` serves the repo in-process, drives the Chrome already on
this PC headless with software WebGL, loads the page once per registered
map (D6: every map in `src/maps/index.js`; `--map plant` to narrow), warms
60 frames, runs the AUTO suite twice on each and prints a JSON report. Exit
0 means nothing is red outside QUEUE.md's Deliberately-red list and the two
runs agree, judged per map. Each run in the report carries
`contextLosses` and `rerun`, the checks re-run after the GPU was taken away
and given back (F1); the summary prints them as `GL CONTEXT LOST`. Zero is
the normal reading; a non-zero one is the machine, not the game, unless the
same check is in the list every run. `--runs 1` is the gate (about 11
minutes for both maps: 450s for the plant, 190s for the yard, a 45s
cooldown between - see the traps; the full `npm run suite` is four runs,
about 24 minutes); `--regression` the regression set per map instead (60s
and 24s); `--subset "<regex on check ids>"` while iterating; `--query "seed=N"` to reseed
the match; `--details <file>` (B8) writes every check's id, outcome and
detail line per run - the readings a PROGRESS entry quotes, which the
stdout report never carried for a green check.
`scripts/suite-skips.json` lists checks that cannot pass headless,
with reasons (today: the frame-budget check; SwiftShader draws a frame in
~400ms). They are reported, never counted. Needs `npm install` once:
`playwright-core` only, no browser download.

In a real browser, for what headless cannot prove (the frame budget on a GPU,
how it looks, how it sounds):

```bash
npx serve -l 5173 .
```

Open it with **`?debug=1`** for F3 and F4 (C1: the page without it is the
playtest build, every debug key inert; the settings menu's *debug tooling*
row also turns the gate on). `?map=yard` for the container yard (D2). In the browser console (`window.BLACKLINE` is
the harness in both builds; the suite holds the gate up while it runs):

```js
await BLACKLINE.debugTools.runAutoTests();      // full suite (~6s)
await BLACKLINE.debugTools.runRegressionSet();  // Section 16's set: 29 checks on the plant, 24 on the yard
```

In-game: **F3** overlay · **F4** test mode · then **Y** full suite, **U**
regression set, **N** the Warden's ground on the floor. Run the suite **twice** — a flaky check shows as a different
answer, not a pass. Add **`?map=yard`** (or click the menu's *map* row)
for the second map; Y there runs the checks that are not the
substation's and the banner counts the rest as *not for this map* (D1).

---

## Environment traps — these will cost you an hour each

**A loaded machine can take the GPU away mid-suite.** One A2 verify run
came back with *eight* pixel checks flaky at once (rim light, lit pools,
the dim meter, the outline, smoke/flash, the alarm fixture, the death camera
and the 0x0 viewport) and never reproduced. F1 found it: a **lost WebGL
context**. Chrome kills a starved SwiftShader GPU process and hands the
context back a moment later; in the window every draw is a no-op, every
`readPixels` reads black, and the drawing buffer reports 0x0 against a
1280x720 canvas. Staging a loss fails exactly those eight and nothing else.
Since F1 the suite counts losses (`debugState.contextLosses`, an F3 row),
tags every check that ran in the window, waits for the restore and re-runs
them once (`ui/autosuite.js`); the runner prints `GL CONTEXT LOST Nx` and
lists the re-runs, so read that line before believing any red pixel check.
If you ever see a 0x0 drawing buffer with the canvas still sized, it is
this, not a resize. A check that needs to lose the context on purpose
registers with `losesContext: true`.

**A plant run can take 450s, and since D6 `npm run suite` is four runs -
about 24 minutes - and even the gate (`--runs 1`, both maps) is 11.**
Nothing of that fits the Bash tool's 10-minute cap. Start it with
`run_in_background` writing to a file and wait on the file (`until grep
-q "suite: " <file>`, itself backgrounded or in a Monitor - a foreground
wait hits the same cap), or split it into `--runs 1 --map <id>` runs with
`--details` and compare the answers yourself. Stopping a
backgrounded run from the tool does not stop the runner: node and its
headless Chrome carry on, still writing to the redirected file, and a
second run started beside them fights for the four pinned cores.

**Two sessions in this repo will collide on decision numbers.** A5 raised its
question as D19 while, ten minutes earlier and unseen, another session had
committed a different D19. Renumbered to D20 by hand; the A5 commit message
still says D19. Before adding to `DECISIONS.md`, `git log --oneline -5` and
re-read the file - the number you are about to use may have been taken since
you loaded it.

**The routine may be running while you are.** `blackline-build` fires at
17:00 and 02:00 and a run can last hours. Before you commit from a human
session, look at `git status`: a file you did not touch is the routine's
in-flight work. Never `git add -A` then — add your own files by name. (A
`zzz-probe` check was swept into a docs commit this way on 2026-09-10 and had
to be reset out.)

**A scheduled run cannot use the Browser pane at all.** It refuses to start a
dev server from an unattended session, by rule. `npm run suite` is the only
gate a routine has; the pane is for humans.

**The browser pane never composites.** `document.hidden` is always true,
`requestAnimationFrame` never fires, screenshots time out. So:
- Drive frames with `h.renderFrame(1/60)`, never by waiting for rAF.
- Verify anything visual with `gl.readPixels` — see `src/tests/pixels.js`.
- The one time this bit hard: an emulated resize left the canvas 0×0 and *all
  eight* pixel checks went black at once. The obvious reading (the last commit
  broke rendering) was wrong.

**The runner keeps 400 characters of a check's detail, and the F4 log
is not in the report.** A diagnostic that matters goes at the front of
the failure line, compact; D5 lost two runs to a trace that was cut off
before the interesting part. `debugTools.logResult()` reaches the F4
panel in a tab, never the runner.

**The working copy is mixed: some files CRLF, some LF.** A patch script
that assumes one fails silently on the other (D5's first patch matched
nothing in the CRLF `tests/difficulty.js`). Detect per file: read with
`newline=""`, note whether `\r\n` is in it, work in LF, write back the
way it was.

**Bash heredocs fail on JS content** in this shell — `unexpected EOF`. Use the
Write tool for new files and a `python - <<'PY'` block for edits.

**A coverage check cannot see a connectivity fault.** Three times now: the
A1 constant that stayed green with the step at 2m, the HUD check that was
green only because of who ran before it, and A1's ground that was two islands
while every spawn, waypoint and site sat happily on one of them. Before
believing a check on a *set*, ask whether it would notice the set being cut
in half.

**`renderFrame` and a lens do not mix.** The frame re-parents the camera to
the actor's rig every time it runs, so a lens pointed at the floor is pointed
at the floor no longer after one `h.renderFrame()`. Press debug keys with
`debugTools.pollKeys()` while a lens is up (the same real path; it is the first
thing the frame does), and do anything that needs the frame after
`lens.restore()`. A7 lost twenty minutes to a 114-level "darkening" that was
the camera moving.

**Never time `readPixels`.** It blocks on a GPU sync and copies megabytes; it
reported a 2ms frame as 14ms. Use `lens.renderOnly()`.

**Warm up before measuring — the AUTO suite counts as measuring.** The first
draw after a load compiles shaders. A suite run straight after a reload reported
`hall-north` at 17.80ms against an 8.33ms ceiling; warmed, the same viewpoint is
1.22ms. Drive 60 frames of `renderFrame(1/60)` before running the suite.

**Noise events come from a recycled pool of 48.** Copy the fields you need; a
retained event gets overwritten (a landing read 8m instead of 10m because a
Warden footstep reused the slot).

**A check that awaits `h.nextFrame()` hangs where frames never fire.** The
browser pane is such a place. F4's check reads `document.hidden` first and
fails with a reason instead; do the same in any check that awaits a frame.

**A check used to inherit the last check's menu, pause and HUD.**
`hud.setVisible()` runs *inside* the frame, from `!menu.open`, and
`hud.update()` draws nothing while hidden - so a check that rendered a frame
behind a menu left every HUD-reading check after it reading a stale DOM, and
at boot the menu is up, so the first HUD read in any subset was of a HUD
nothing had drawn. `hud-reads-the-meter-it-is-shown-beside` was green in the
full suite only because of who ran before it and red straight after
`the-rim-light-is-really-on-screen`. Since F2 the runner calls
`h.resetPresentation()` before every check (menu hidden, intermission
hidden, unpaused, HUD shown), `hud.update()` returns whether it drew, and the
HUD check asks. A check may still leave whatever it likes behind; the next
one no longer cares. Presentation only - match state is still the check's
own business, and `initMatch` at the top remains the way to start clean.

**The pulsing site ring pollutes pixel samples.** It sits dead centre under a
camera pointed at a site and swings 0.35–0.9 opacity. Sample off it.

**Four rifle rounds kill the Shade, and since C5 the Warden lands them.**
God-mode it (`h.debugState.godMode = true`) in any long test or the AI ends
your measurement window - and put it back. Until C5 god mode guarded only
the frag, so a check that set it and survived did so because the rifle was
aimed at the floor.

**Smoke blocks AI sight entirely and a seen flashbang blinds it** — so the
check-29 load only coexists with gunfire if the smoke is off the firing line.

**`SETTINGS.x` is the live value. `CONFIG.settings.defaults.x` is a seed.**
Reading the latter compiled fine and silently broke the difficulty and match
length controls for thirty phases.

**One console warning during the suite is expected** — the death-camera check
deliberately fires its own wall-clock guard.

**`every-sound-renders-to-samples-that-match-section-14` used to be flaky**
("the Warden's footstep peaks at 0.049 against the Shade's 0.050", then
green). The cause was the instrument, not the threshold: `renderOffline()`
drew its noise texture from `Math.random`, so two renders were two different
signals. Since B2 it seeds a private `mulberry32` (`RENDER_NOISE_SEED` in
audio.js) and a rendered sound is the same samples every time. If it ever
answers differently between two runs again, something else is random.

**A wall-clock guard and a cold view do not mix.** The death camera's
guard (`reinsert.wallClockGuard`, 16.5s) is measured on the wall clock
by design; the first draw of a view the renderer has not seen compiles
for tens of seconds headless (39s at site A, measured by F5), and
`readPixels` blocks until it is done. A check that starts a guarded
state and then reads pixels through it for the first time gets the
guard, not the picture - and red only when run alone, because in the
full suite an earlier check paid the compile. Warm the view (a
`renderFrame` and a `readPixels`) before starting anything guarded,
and listen for `deathcam:guard` so the check says so if it fires.

**A check that emits half an event leaves the other half behind.** The
audio check emits a synthetic `gadget:detonate` for the sound; effects hears
it too and spawns a cloud with no gadget behind it, and the runtime
assertion `effects-drain-when-idle` calls that a leak once its 10s idle
window has passed - which, with the loop stopped under the suite (F4),
depends only on what ran before. Pair the event with the registry effect
(visual.js and performance.js do) or clean up after it (audio.js does now).

**Bash heredocs fail on some JS content even inside `python - <<'PY'`.** One
patch died with `unexpected EOF` for no visible reason. Write the patch script
to the scratchpad with the Write tool and run `python <path>` instead.

**The working copy is CRLF, the repo is LF** (`core.autocrlf=true`). A
Python patch that reads in text mode and writes with `newline="
"` is fine
— git normalises on commit — but a byte-exact match against `
` content
fails silently, and `wc -l` on a file ending `}

` is one more than
the last `}`. F3 lost two script runs to each.

**A boot failure used to be a silent 60s timeout.** The runner now prints
the page's first errors under `suite: crashed:` (`  page: pageerror: P is
not defined`). If it says nothing, the harness never loaded for a reason the
page did not report — look at index.html's import map first.

**A moved method can reference a module constant that did not move.** Both
F3 boot failures were this (`P`, `THREE` used in `mapgen.js` without an
import); `node --check` cannot see it and only the code path that runs at
boot reports it. After moving code between modules, grep the new file for
every bare identifier the old module declared at top level.

---

## The lesson that keeps repeating

Three separate bugs — the Phase 3 ledge hang, the Phase 21 slide, and the
Phase 47 match score — were all **wired, tested, green, and impossible in play**.
Every one came from a check that drove the game differently from how a player
does.

A held key and its press edge arrive on the **same step**. A test that sets
`intent.crouchPressed` without `intent.crouch` is testing a machine nobody is
sitting at. Drive `input.heldCodes` / `input.pressedCodes` — see
`src/tests/fuzz.js`.

**And its cousin, from A1 and again in A3: a check that reads the constant the derivation read
can only ever agree with it.** `the-warden-never-climbs-to-reach-its-ground`
first asked whether a climbable top had ground beside it within
`warden.stepHeight` — and stayed green with the step temporarily at 2.00m while
the fill walked up crate stacks. It asks "is the ground beside it *level* with
it" now, which is a fact about the geometry. Before believing a derived-data
check, raise the constant it derives from and watch it go red.

A3 hit the same shape: it *selects* the perches to try with `canDefuseAt` and
then asserts `canDefuseAt` refused them, which on its own proves nothing. The
way out was to open `DEFUSE_REACH.dy` a metre at a time until the same perch is
legal and require that the identical hold then plants — the gate proved to be
reading the live reach rather than carrying a private exclusion. Any Block A
check that picks its own inputs owes the suite that second half.

---

## Still needs a human

These are D8, D25, D26, D27, D28, D30, D31, D38, D39 and the Provisional section of `DECISIONS.md`; Josh answers there.

- **D39**: the yard's lighting as built - four masts, a fifth lamp under
  the walkway, the lamps 2.5x the plant's, a dark sky, the one shadowed
  key warm from bay C's mast. Provisional; the pixels say the pools
  out-light the sky and the gaps are dark, not that it reads as a yard
  at night rather than a black screen with four spots.
- **D38**: whether the Shade may walk up the Warden's stair into the
  booth. Today it can - nothing climbs to the walkway, but the stair is
  walked by both bodies and there is no such thing as a door only one
  passes. Recommendation is to play it as built; a Warden-only door
  (D3b) is a new rule and sized S if wanted.

- **D25**: whether the deck's void edges should carry a rail except at the
  lips, so the duct roofs stop being routes up and a lit lip (B7) means
  *the* way. Recommendation is to accept what the rule found; nothing is
  blocked on it.
- **D26**: what the ducts look like - galvanised sheet, one colour, no
  rim. Provisional; the pixels say it contrasts, not that it reads as a
  duct.
- **D27**: whether a Warden may defuse through a floor. Today it may - the
  reach is two distances - and the census's room-A sample is defused from
  the deck above it. Recommendation is a clear-line reach (B5d, one
  predicate); it removes the duct roofs under the deck from the legal
  plants, so it is Josh's.
- **D28**: how the routes are lit - emissive sides on every stage, a
  warm-white strip on every landing edge. Provisional; the pixels say it
  is a step brighter, not that it reads as a route.
- **D30**: the round-start briefing - that it holds the round until a
  key, what it says, that it shows every round. Provisional; the check
  reads the words, nobody has read the card at a real screen size.
- **D31**: the hit marker, the damage arc and the red vignette - sizes,
  colours, times, and that the arc sits at 0.32 half-heights. Provisional;
  the pixels say each is drawn where it should be, not that it reads.

- Whether the **site ring** still reads correctly now that the plant is the
  whole room. Nobody has looked at it since the meaning changed.
- How any of it **looks**. Pixels prove things are drawn, not that they read.
- How any of it **sounds**. Samples are the right length, level and register;
  nobody has heard it.
- The **vsync framerate** on integrated graphics. CPU 1.7ms mean / 5.4ms worst
  across 92 viewpoints against a 16.67ms budget says there is room, not what a
  real GPU does with it.
