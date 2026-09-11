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
| AUTO suite | headless, `npm run suite`: **116 passed, 2 failed** — the census (deliberate) and the frame-budget check (skipped headless, see Running it) |
| Next job | the first `[ ]` in `QUEUE.md` is F3, the `main.js` split (F1 and F2 done 2026-09-11); **Block A is closed** |
| Runtime assertions | 8, zero failures |
| Map | 214 collision boxes, 65 climbable, 25,299 edge-bearing cells of Warden ground, one connected component |

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
| Failed climb | A physical tell **plus audio**. Never silent |
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
| 12–18 | **Hang as a held option, and the bump-and-scuff** | pending |
| 19–34 | **Area rebuild, lockstep** — geometry + controller together, worst area first | pending |
| 35–41 | **Legibility without markings** — material language, edge profiles, metal ducts, route lighting, contrast measured from pixels | pending |
| 42–46 | **Feel** — camera, momentum, weight, timing, traversal fuzz | pending |
| 47–50 | **Close** — amend the spec, re-sweep, Warden sanity, done-definition | pending |

Outside that numbering, and **first** because it is a directive rather than a
plan item: **the plant must be defusable** — Block A in `QUEUE.md`, reasoning
below. Phases 12–50 are Block B there.

---

## The one red check IS the work queue

```
FAIL  every-climbable-surface-can-actually-be-climbed
      12 of 65 climbable surfaces cannot be climbed (9 with nothing in reach
      of them). By area: upper deck 5, loading-bay 3, turbine-hall 2,
      server-vault 2; 20 need a leg up first
```

**Do not "fix" this by weakening it.** It stays red until the geometry closes
it. It approaches every climbable face from every surface the rule derives it
from — three distances back, three positions along the face, standing or
crouched — and drives the real controller. Named failures are logged to the F4
panel (`debugTools._testLog`).

**All twelve are now geometry, not controller.** Nine are
`_supportCandidates()` counting a neighbour within `vaultReach` of the footprint
as "below" when it is really "beside" — the rule naming a support you cannot
stand on. Three (`deck-1`, `deck-16`, `deck-21`) are deck slabs reachable only
from a gantry with 1.3m of headroom, where a crouched body genuinely cannot make
a 2.0m rise; you get onto the deck by its lip, which does climb. Also waiting
for the rebuild: the deck lips overhang their gantries by 0.6m, so there is no
spot on the gantry within 0.8m of the lip where a body can stand up.

"20 need a leg up first" is reported, not failed — Josh's call. A surface you
climb something else to reach is the point of a stacked route.

Its sibling `the-climb-rule-has-no-exceptions` passes and must keep passing: it
is what makes the rule the single source of truth.

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

A5 counted it, and it is not what this section assumed; A6 then changed it.
Of **373 places a charge can go inside a site room** — 344 floor cells on a
2m grid, 21 climbable tops, 8 vent interiors — the rule refuses **twelve**:
the 8 ducts by their lid (D20, below), and these four by the reach:

| Refused | Why |
|---|---|
| `server-rack-0` (room C) | the middle of a wide top, >2m from any Warden ground |
| `hall-container` (room A), 0.7m up | same — horizontal, not vertical |
| `gantry-hall` (room A), 1.0m up | same |
| the deck floor at (21, 17), room C | clear floor with no reachable ground near it; B4's rebuild should close it |

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

**`every-sound-renders-to-samples-that-match-section-14` is flaky.** It failed
once ("the Warden's footstep peaks at 0.045 against the Shade's 0.049") and has
passed every run since with nothing audio-related changed. Two peaks 0.004 apart
is a threshold sitting on the value it tests. If you see it, run again before
believing it.

**Bash heredocs fail on some JS content even inside `python - <<'PY'`.** One
patch died with `unexpected EOF` for no visible reason. Write the patch script
to the scratchpad with the Write tool and run `python <path>` instead.

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
