# Blackline — handoff

**Read this first.** Then `QUEUE.md` (the work), `DECISIONS.md` (what waits
on Josh, and what he has decided), `PLAN.md` (the protocol a session follows).
`BLACKLINE_SPEC.md` is the contract; `PROGRESS.md` is the full append-only
history (3,000 lines) — read only the last entry.

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
| Working tree | clean |
| AUTO suite | headless, `npm run suite`: **124 passed, 1 failed** — the frame-budget check (skipped headless, see Running it). **The census is green** since B3 (2026-09-12); the Deliberately-red list in `QUEUE.md` is empty |
| Next job | the first `[ ]` in `QUEUE.md` is B5 (L: the area pass, a whole run); B2b done 2026-09-12 (**Blocks A and F are closed**) |
| Source | no module in `src/` over 600 lines except `config.js` (a table, exempt in PLAN.md); the check `no-source-file-outside-config-is-over-600-lines` holds it |
| Runtime assertions | 8, zero failures |
| Map | 214 collision boxes, 58 climbable (56 after B3; B4's open bay gantry adds the two deck slabs beside its void), Warden ground one connected component, with a column of cells down each vault rack aisle since B4 |

Phases 1–49 of the original build are done and committed. A **redesign** is now
in progress, 11 phases in, and one directive arrived outside it (the plant, below).

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
| Hang | A **held option you choose**, never a failed mantle. Built as B1 (D21, D22, spec 20.4): a climb of a ledge at least **1.4 Shade-heights (2.59m)** above where it started — one you had to jump for — begins with a grab: **tap Space and you hang, hold Space and you go over**; from a hang Space pulls up, crouch drops, A/D shimmy. Lower ledges go straight over |
| Warden | **Stays grounded.** The asymmetry is the game |
| The test | **Purely mechanical.** Standable top + within reach ⇒ climbable. No tags, no exceptions, no `noClimb`. The map obeys the rule |
| Map freedom | Keep the five v2 requirements (Shade starts outside, level 2 is one connected deck, stairless routes up, every room 2+ entries, raised ceilings). Reshape everything else freely |
| Vents | Read as passable by **material contrast** — metal against concrete |
| Spec | **Amend** Sections 5 and 6.1 with a changelog (phase 47). The changelog exists now — Section 20 — but it holds only the 10.1 plant amendment; 5 and 6.1 are still unamended |

---

## The 50-phase plan

| Phases | Block | Status |
|---|---|---|
| 1–7 | **Strip and measure** | ✅ done, committed |
| 8–11 | **Reach-based traversal** — jump-extended reach, ground climbs, approach tolerance, input buffering | ✅ done, committed `5c6d571` |
| 12–18 | **Hang as a held option, and the bump-and-scuff** | ✅ B1 (D21, D22) and B2 done 2026-09-10/11 |
| 19–34 | **Area rebuild, lockstep** — geometry + controller together, worst area first | pending |
| 35–41 | **Legibility without markings** — material language, edge profiles, metal ducts, route lighting, contrast measured from pixels | pending |
| 42–46 | **Feel** — camera, momentum, weight, timing, traversal fuzz | pending |
| 47–50 | **Close** — amend the spec, re-sweep, Warden sanity, done-definition | pending |

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

"22 need a leg up first" is reported, not failed — Josh's call. A surface
you climb something else to reach is the point of a stacked route.

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
face from somewhere it can stand, and fit on top where it lands.*

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
three. B9's "the Warden never leaves `wardenGround`" check is now writable.

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
| `main.js` (1,145) | `main.js` (597): singletons, `initMatch`, pause, bootstrap, `fixedStep`, `renderFrame` — the spec order untouched. Beside it: `loop.js` (`FrameLoop`, the rAF scheduler), `timestep.js` (`computeStepPlan`), `matchstate.js` (options, `createMatchState`, `COMPETITIVE`/`FREEROAM`), `view.js` (renderer, scene, the one camera and its guard, toon ramp, resize, lost-context watch), `cameraowner.js` (whose rig the camera is on, mouse look, ADS FOV), `intents.js` (input → intent), `loadout.js` (the gadget slots), `wiring.js` (the emitter listeners between systems), `hudstate.js` (what the HUD is told), `debugfields.js` (what the F3 overlay is told), `harness.js` (`createHarness(live, loop)` — one getter per live object) |
| `entities/agent.js` (1,051) | `agent.js` (527): state machine, ground, air, slide. `agenttraversal.js`: every climb. `agentvisual.js`: how it is drawn. `agentstate.js`: `SHADE_STATE` |
| `systems/ai.js` (788) | `ai.js` (498): the state machine. `aiperception.js`, `ainav.js` (route, steering, stuck). `aistate.js`: `AI_STATE`, `angleDelta`, `DEFUSE_SNAP` |
| `mapkit.js` (821) | `mapkit.js` (380): `GameMap`, `addSolid`, decals, rooms, lights, waypoints. `mapgen.js`: walls with openings, floor plates, staircases, vent runs. `mapclimb.js`: `deriveClimbableSurfaces`, `supportApproaches` (B3), `supportCandidates` |
| `map.js` (810) | `map.js` (537): the geometry. `mapdata.js`: sites, spawns, lights, waypoints. `mapvalidate.js` |
| `physics.js` (735) | `physics.js` (600): `CollisionWorld`, gravity, `classifyReach`. `collisionbox.js`: the box and the ray-slab test |
| `systems/objective.js` (646) | `objective.js` (536). `plantrule.js`: `DEFUSE_REACH`, `PLANT_HEADROOM`, `withinDefuseReach`, `canDefuseAt(map, at)`, `hasHeadroomAt`, `canPlantAt` — re-exported and wrapped as methods, so every existing import and call still works |
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

`main.js` is 596 and `physics.js` is 600: the next job that touches either
splits it further rather than adding to it.

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
this PC headless with software WebGL, warms 60 frames, runs the AUTO suite
twice and prints a JSON report. Exit 0 means nothing is red outside QUEUE.md's
Deliberately-red list and the two runs agree. Each run in the report carries
`contextLosses` and `rerun`, the checks re-run after the GPU was taken away
and given back (F1); the summary prints them as `GL CONTEXT LOST`. Zero is
the normal reading; a non-zero one is the machine, not the game, unless the
same check is in the list every run. `--runs 1` is a one-minute gate;
`--subset "<regex on check ids>"` while iterating; `--query "seed=N"` to reseed
the match. `scripts/suite-skips.json` lists checks that cannot pass headless,
with reasons (today: the frame-budget check; SwiftShader draws a frame in
~400ms). They are reported, never counted. Needs `npm install` once:
`playwright-core` only, no browser download.

In a real browser, for what headless cannot prove (the frame budget on a GPU,
how it looks, how it sounds):

```bash
npx serve -l 5173 .
```

In the browser console (`window.BLACKLINE` is the harness):

```js
await BLACKLINE.debugTools.runAutoTests();      // full suite (~6s)
await BLACKLINE.debugTools.runRegressionSet();  // Section 16's set, 16 checks
```

In-game: **F3** overlay · **F4** test mode · then **Y** full suite, **U**
regression set, **N** the Warden's ground on the floor. Run the suite **twice** — a flaky check shows as a different
answer, not a pass.

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

**Four rifle rounds kill the Shade.** God-mode it in any long test or the AI
ends your measurement window.

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

These are D8 and the Provisional section of `DECISIONS.md`; Josh answers there.

- Whether the **site ring** still reads correctly now that the plant is the
  whole room. Nobody has looked at it since the meaning changed.
- How any of it **looks**. Pixels prove things are drawn, not that they read.
- How any of it **sounds**. Samples are the right length, level and register;
  nobody has heard it.
- The **vsync framerate** on integrated graphics. CPU 1.7ms mean / 5.4ms worst
  across 92 viewpoints against a 16.67ms budget says there is room, not what a
  real GPU does with it.
