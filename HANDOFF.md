# Blackline — handoff

**Read this first.** Then `QUEUE.md` (the work), `DECISIONS.md` (what waits
on Josh, and what he has decided), `PLAN.md` (the protocol a session follows).
`BLACKLINE_SPEC.md` is the contract; `PROGRESS.md` is the full append-only
history (3,000 lines) — read only the last entry.

**The project now runs itself.** Two scheduled tasks — `blackline-build` at
17:00 and 02:00, `blackline-audit` weekly — do one queue job per run under the
protocol in `PLAN.md`. A human session is welcome to do the same: take the
first unblocked job in `QUEUE.md`, finish it, record it, leave the tree clean.

---



## Where things stand

| | |
|---|---|
| Branch | `phases-14-45` — ahead of `main`, not merged; Josh merges |
| Merge with | `git checkout main && git merge --ff-only phases-14-45` |
| Working tree | clean |
| AUTO suite | headless, `npm run suite`: **106 passed, 2 failed** — the census (deliberate) and the frame-budget check (skipped headless, see Running it) |
| Next job | the first `[ ]` in `QUEUE.md` — A4, the "cannot plant here" HUD line |
| Runtime assertions | 8, zero failures |
| Map | 214 collision boxes, 65 climbable, 25,177 cells of Warden ground |

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
| Hang | A **held option you choose**, never a failed mantle |
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

**Phases 1 to 3 are built** (A1, `src/mapground.js`; A2, `canDefuseAt()` in
`systems/objective.js`; A3, the gate inside `_stepPlant()`); A4–A7 remain in
`QUEUE.md`, and this section is the reasoning behind them.

The rule is live now, which means a plant on a crate top inside a site room is
refused in play. Worth knowing before the next job: **two of the three tops the
A3 check proves refused are only 0.7m and 1.0m up.** They fail horizontally,
not vertically — the middle of a wide top is further than `DEFUSE_REACH.radius`
(2.0m) from any cell of Warden ground. So the live rule already reads "no plant
in the middle of anything wider than four metres", which nobody stated out
loud. That is A6's problem now, and its queue line says so.

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
| 4 | **Tell the player** — next. Same standard the redesign set for a failed climb: never silent. An interact key that does nothing is the marking problem inverted — an invisible rule. The plant already owns a HUD line and a noise interval; a refusal wants the line and nothing else — D6 settled it: no sound, no noise event, because a refused plant should not give the Shade away |
| 5 | **The check, census-shaped.** For every climbable surface top and every vent interior inside a site room, try to plant and assert refusal. Then the inverse: sample legal plant positions and assert a Warden can stand and defuse at each. `spotOffTheRing()` in `tests/objective.js` must pick from the legal set or every objective check starts failing for the wrong reason |
| 6 | **Re-examine `DEFUSE_REACH.dy`** (was the literal `dy < 2.5`; A2 named it and gave it one home, but did not touch the value) in the defuse proximity test. It was written when plant and defuse were both pinned to a site centre and it is now load-bearing: it is what decides whether a charge on a 2m crate is legal. Today it is — a Warden standing beside the crate is 2.0m below the charge and that passes. Reaching up to a bomb on a crate seems right, but it should be a decision rather than a leftover |

### Decided

- **Beside, or on?** Josh: *"warden must always be able to defuse."* Read as
  on **or** beside — legal exactly where the real defuse check would succeed
  for a Warden on reachable ground. D5 records the interpretation and the
  one-line override if he meant "on only".
- **What does refusal look like?** A HUD line, **"cannot plant here"**. No
  sound, no noise event. D6.

### The side benefit, now available

Phase 1 built the set as map data rather than an objective-system private, so it
is the honest answer to a question three other systems guess at: whether a
waypoint is standable, whether a DEFEND path can complete, whether a patrol
route is walkable end to end. `map.wardenGround.has(position)` answers all
three. B9's "the Warden never leaves `wardenGround`" check is now writable.

Nothing draws it, which is A7: 25,177 cells and no way to look at one.

## Running it

The suite, headless. This is what the routine runs, and what any session runs
before and after a job:

```bash
npm run suite
```

`scripts/suite.mjs` serves the repo in-process, drives the Chrome already on
this PC headless with software WebGL, warms 60 frames, runs the AUTO suite
twice and prints a JSON report. Exit 0 means nothing is red outside QUEUE.md's
Deliberately-red list and the two runs agree. `--runs 1` is a one-minute gate;
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
regression set. Run the suite **twice** — a flaky check shows as a different
answer, not a pass.

---

## Environment traps — these will cost you an hour each

**A loaded machine can cascade the pixel checks.** One A2 verify run came
back with *eight* pixel checks flaky at once — rim light, lit pools, the dim
meter, the outline, smoke/flash, the alarm fixture, the death camera and the
0×size viewport — while run 2 took 108s against run 1's 62s. It did not
reproduce: four later full runs (two on HEAD, two with A2) were identical,
and the eight run clean twice as a subset alongside the new check. Second
runs on this PC drift between 60s and 230s depending on what else is awake,
so **a flaky pixel set is worth re-running before you believe it** — the
same advice the audio check already carries. Queued as F1; if it recurs,
suspect `a-zero-size-viewport-does-not-blind-the-renderer` leaving the
canvas 0×0 for everything after it, which is the documented failure below.

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

**Never time `readPixels`.** It blocks on a GPU sync and copies megabytes; it
reported a 2ms frame as 14ms. Use `lens.renderOnly()`.

**Warm up before measuring — the AUTO suite counts as measuring.** The first
draw after a load compiles shaders. A suite run straight after a reload reported
`hall-north` at 17.80ms against an 8.33ms ceiling; warmed, the same viewpoint is
1.22ms. Drive 60 frames of `renderFrame(1/60)` before running the suite.

**Noise events come from a recycled pool of 48.** Copy the fields you need; a
retained event gets overwritten (a landing read 8m instead of 10m because a
Warden footstep reused the slot).

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
