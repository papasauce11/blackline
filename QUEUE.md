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
F5 (2026-09-16), F6 and F7 (2026-09-20), F8 and F9 (2026-09-21); the next gate job, if one is found, goes here.
**Reopened 2026-09-22 by F10**, found by the build run of that date.

- [x] **F10 (M)** A hung gate must die, and say so. — done 2026-09-23, under Done.

- [x] **F11 (S)** One check is a quarter of the plant run, and the quarter is a wait. — done 2026-09-25, under Done.

- [x] **F12 (M)** Make `?seed=` mean something to the fuzz and soak checks. — done 2026-09-24, under Done.

- [x] **F13 (S)** The two bans the spec states, held by the gate. — done 2026-09-24, under Done.

- [x] **F14 (M)** The suite cannot tell that it has shrunk. — done 2026-09-24, under Done.

- [x] **F15 (S)** The one documented way past a red gate, closed. — done 2026-09-25, under Done.

- [x] **F16 (S)** The second run of a map is the first run's bill. — done
  2026-09-25, under Done.

- [x] **F17 (S)** A fresh seed turns the yard's difficulty check red. — done
  2026-09-27, under Done (`3316d07`).

- [x] **F18 (S)** A rate held by a check that counts bursts, not rounds. —
  done 2026-09-27, under Done (`443a4a7`).


## Block B — the traversal redesign, phases 12–50

The 50-phase plan is in `HANDOFF.md`. Decided: all of the interview table
there. The census is the contract; **never weaken it**.

(**Block B is closed** 2026-09-21: B5b dropped on D25, B5d done on D27.)

- [x] ~~**B5b (M)** Rail the deck's void edges except at the lips~~ —
  **dropped 2026-09-21: D25 decided option 1, as built.** The duct roofs
  are routes; nothing to build. Kept for the record:
  Only if Josh had picked option 2 or 3 there. A 1.0m rail, thinner than
  a body, set so the mantle's landing capsule meets it, along the hall void,
  the bay void and three sides of the vault hatch (option 2) or the hall
  void's duct crossings only (option 3); the duct-roof routes and the extra
  hatch/bay slabs come out of `map.routes`; the Warden's ground, waypoints
  and the deck patrol re-checked. *done-when:*
  `every-stacked-climb-is-a-step-of-a-declared-route` green with those
  routes removed, the census's "need a leg up" at the number D25 predicts,
  `the-warden-never-climbs-to-reach-its-ground` and the AI soak unchanged.
## Block C — playable and testable

Decided: D4 (Josh tests what the routine cannot; do not halt for looks).
Anything here that changes a **rule** is blocking — write the question.
Anything that changes **presentation** is provisional — do it, log it under
Provisional in `DECISIONS.md`, move on.

(C1-C6 done 2026-09-16; C7 reopened the block 2026-09-21 on D8's answer
and closed it the same day. `PLAYTEST.md` is updated by every Block C, D
and E job - the queue's own done-whens include it.)

## Block E — styling

Decided: D3 — the Shade and the Warden first, then the map. Provisional: D10
(no post-processing until the characters are done), D40 (the Shade's
figure as built). Draw-call and frame budget checks are the ceiling.

(E1 done 2026-09-19; E2 and E3 done 2026-09-20; E4, E5 and E6 2026-09-21.
**Block E is closed.** D10 was provisional and its condition - E1-E3
landed - was met, so E6 was not blocked on a `decided:` line.)

## Block G — the record

Opened 2026-09-22, **closed 2026-09-25 with G2**. The documents the routine
reads to orient itself are themselves work, and they have drifted. Nothing
here touches the game. The block opened saying a job in it "may never change
a file under `src/`"; G2 amended that to *may never change the game*, because
the protocol above it requires every job to end with a check that would fail
if the job were reverted, and a check that fetches a markdown file and counts
its lines is not the game. G1 had no such check and said so; G2 has one.

- [x] **G1 (S)** `HANDOFF.md` back to one page. — done 2026-09-23, under
  Done. **The under-400 half of its done-when was not met and cannot be**:
  see G2.

- [x] **G2 (S)** Decide what the traps section costs. — done 2026-09-25,
  under Done.


## The second arc — 2026-09-25

The first arc is done (D49). Josh, interviewed 2026-09-25 (D50): **friends
can play it** is the target; audio as ambience only; feel and juice; a
third-sized pass on the Warden; and four things Section 19 refused are now
in — gamepad (no aim assist), vision modes for the *Shade* (night vision and
an x-ray through thin things), the alarm camera's live feed, the Warden's
torch on the night map, synthesised voice lines, and a skeleton under the
figures. Looks stay provisional; Josh decides as he plays. Eight blocks, in
this order: H, K, M, J, I, L, N, O. Every job still ends with a check that
would fail if it were reverted, a `PROGRESS.md` entry, and a `PLAYTEST.md`
line where a player would notice it.

## Block H — friends can play it

Hosting is GitHub Pages (D50). Two jobs wait on **D51** — the repo's URL and
one setting only Josh can click; everything else here proceeds.

- [x] **H1 (S)** The remote. — done 2026-09-27, under Done.
- [x] **H2 (M)** GitHub Pages from the working branch. — done 2026-09-27, under Done.
- [x] **H3 (S)** A version you can see. — done 2026-09-27, under Done. **There
  is no deploy workflow and cannot be one from here** (H2: the CLI token has no
  `workflow` scope), so the commit carries the stamp and the *host* decides
  `dev`: **D52**.
- [x] **H4 (M)** Boot. — done 2026-09-27, under Done. Both halves of the
  done-when met; the WebGL2 test is `createRenderer()` returning null rather
  than a `getContext` probe, and why is **D53**.
- [x] **H5 (M)** The main menu. — done 2026-09-28, under Done. The card
  per map is rendered from the map at boot and the bake has a cut in it
  (`DRAWN_SLICES`); the look is **D55** and the role row raised **D56**.
- [x] **H6 (M)** The first-run tutorial. — done 2026-09-28, under Done. The
  "once per browser" half is a flag `SETTINGS.tutorialSeen`; **H7** is what
  makes it survive a reload, and nothing about the chain changes when it does.
- [x] **H7 (S)** Settings persist. — done 2026-09-28, under Done. What is
  kept and the one thing that is not are **D57**.
- [x] **H8 (M)** Rebinding in the settings menu. — done 2026-09-28, under
  Done. What a rebind does to the key it replaces and to a key already
  taken is **D58**; **H19** is the keymap surviving a reload.
- [x] **H9 (S)** Look and camera settings. — done 2026-09-29, under Done.
  The FOV range, the absolute ADS narrowing and the head-bob shipping off are
  **D59**; **H21** and **H22** are what the work revealed.
- [x] **H10 (M)** Quality presets. - done 2026-09-29, under Done. The five
  knobs, the probe, and the `?quality=` pin that keeps the gate's picture
  still. What each level is worth, and the post being the player's row **AND**
  the level rather than the level rewriting it, are **D60**; **H23** and
  **H24** are what the work revealed. It also took `scripts/suite.mjs` past
  600 lines, so the verdict and the summary moved to `scripts/suitereport.mjs`.
- [x] **H23 (S)** The menu's cards and auto's probe race. — done 2026-10-05,
  under Done. The level is held for the length of the strip. What the job
  measured is that a card's picture does not depend on the level at all, so the
  hold makes the *record* true rather than repairing a picture: **D61**, and
  **H26** is the option it leaves open.

- [ ] **H26 (S)** Should a menu card honour the quality level? Today it cannot:
  H23 measured a card as **byte-identical at `low` and at `medium`** while the
  renderer was demonstrably at low, because the outlines are hidden by a
  traverse of the live scene and the shadow map resized on the live map's key
  light, and a card is a fresh map in a fresh scene with its own 1024 key light
  drawn into a fixed 480x270 target. D61 took "leave it level-agnostic" - a card
  is a picture of a place and every friend should see the same strip. The other
  option is to hide the thumbnail map's own outline group and size its key light
  from the preset, so `low` previews itself. Only worth doing on D61's second
  line, and the first thing it needs is a reason a player would want the dimmest
  version of the map they are choosing between. **blocked: D61** — option 1 is
  what is built, so there is nothing to do here unless Josh moves that line.
  *done-when:* D61 says option 2, and a check reads two cards baked at two
  levels and asserts their pixels differ by more than the noise H23 measured
  between two sets at the same level (80 bytes of PNG).
- [x] **H24 (S)** Nobody has ever run the suite at `low` or `high`. — done
  2026-10-05, under Done. Eight checks answer differently at low and two at
  high, and **one of the eight is not a level effect at all**: the preset scales
  the particle count, `effects.sparks()` takes three shared-rng draws per
  particle, and the Warden draws its burst pause from that same stream, so the
  quality level moves the simulation. That is **H27**. The picture checks that
  are honestly medium-only readings are **H28**.

- [x] **H27 (M)** The quality level moves the simulation. — done 2026-10-05,
  under Done. Two streams off one seed: `rng` for the simulation, `lookRng` for
  presentation, `systems/effects.js` its only caller, both seeded by
  `rng.reseed()`. **D62** records why the second option was the close call and
  was not taken.

- [x] **H28 (S)** Six checks read a picture only `medium` draws. — done
  2026-10-06, under Done. Five of the six were one bug and it was not about
  quality: **absolute pixel geometry against a resizable drawing buffer**. The
  wall check was diagnosed wrongly twice before this (by H24 and by this
  queue): it was not "a 1024-only reading", it was reading **columns 700-1270
  of an 896-wide buffer**, which runs off the end of each row and into the next.
  Fixing that exposed F8's instrument clause underneath, where a crossing count
  turned out to be a count of the shadow map's texels — the amplitude is the
  scale-free reading and is what the clause uses now. The seventh,
  `frame-budget-under-the-check-29-load`, is **green at low on both maps**
  (CPU 3.10ms median against a 16.67ms budget) and goes on the record as
  machine load. Left: **H29** and **H30**, below, and **D63**.

- [x] **H29 (S)** Does a small window keep a body legible at 25m? — done
  2026-10-06, under Done. **The suite cannot tell, and establishing that is the
  finding.** At 1366x768 on `low` the Shade at 25m is **30 rows tall and 8
  pixels wide**, and the hood-over-neck reading needs a band 14%-22% of the
  body's height — *two rows* at that size. One row of measured body height
  slides those two onto the shoulders, so the same body read **8/4 = 2.00x in
  one run of a suite and 8/6 = 1.33x in the other**, after eight isolated runs
  had agreed to within a pixel. So the ratio is reported and asserted nowhere
  below the reference buffer; what is asserted is what held in every run — the
  body is found, covers its share of the buffer, and stays 3:1 narrow. **D64**
  has the numbers and **retracts this job's own first conclusion**, which was
  that the hood reads everywhere and no minimum-resolution line was needed.
  Whether 8 pixels of width reads as a hood is now an eyes-only question in
  `PLAYTEST.md`. Left: **H31**, below, which this strengthened.
- [x] **H31 (S)** The two figure checks assert a 1.5x ratio on a band three
  rows deep. — done 2026-10-06, under Done. **Measured first, as the queue
  insisted, and the measurement said leave the clause alone**: over 48 readings
  on both maps the hood was 10px every time and the neck 4, 5 or 6px, never 7,
  so the worst case is 1.67x against the 1.5x bar. What moves the reading is the
  **breath** — 4cm of torso on a body drawn at 4.5cm a row — and not `band()`
  sliding, which corrects **D64**'s account of its own numbers. The deeper
  option was refused with a reason, a second clause on the same 11% turned up,
  and the margin is now *held* rather than documented by
  `the-hood-holds-its-ratio-at-every-phase-of-the-breath`. **D66**; the
  follow-ups are **H33** and **H34**.
- [x] **H32 (S)** The `AudioContext` error, and what would settle it. — done
  2026-10-06, under Done. **The code side is closed and the test is defined.**
  Exactly one module in `src/` names the realtime constructor (three lines,
  guarded) and it is now a ban with one named owner; the seventeen offline
  contexts a run builds have all rendered correctly in every run on record, so
  the *"WebAudio renderer"* half is out too, leaving the device - which, against
  H27's reasoning, **exists and reads as running at 48000Hz**. What nobody had
  noticed is that the cold run H27 asked for **is the GATE**, which happens twice
  a day and whose console-error count no session has ever written down: all five
  observations are end-of-session verifies. So it is **not closed**, `HANDOFF.md`
  now asks every run to record its gate's count, the runner stamps each error
  with the map, the run and the seconds into it, the summary prints the messages
  instead of only the count, and **H35** decides it on three gates. **D67**;
  `TRAPS.md` has the standing account.
- [x] **H30 (S)** The pixel floors H28 did not reach. — done 2026-10-06,
  under Done. The census is **twelve floors**: eight scaled with `scaledCount`,
  one already a fraction of the frame (`feedback.js`'s vignette, 5%, the
  precedent), and **three left absolute on purpose** because they are existence
  tripwires and scaling one would make it *looser* on a small buffer - **D65**.
  The queue named four modules and was wrong about one: **`readability.js` has
  no pixel floors at all** and never calls `createLens`. One new check,
  `every-pixel-floor-under-tests-is-a-fraction-of-the-buffer-or-says-why-not`,
  holds the census the way F13 holds the spec's bans - a table of allowances
  with reasons, red on a new floor **and** red when an allowance goes stale.
- [x] **H25 (S)** Auto's pick depends on which map you open first, and it is
  stored for good. — done 2026-10-06, under Done. The cheapest honest fix was
  the right one: `rememberedPick` keeps the **lower** of what is stored and what
  a probe just found, which is the only rule safe in both orders, and a stored
  value the preset table does not recognise is treated as nothing stored rather
  than compared against (**H21** is why that matters). **D68** has the cost - the
  level now only ever goes down on its own, so a machine that was briefly busy
  is remembered as slower than it is - and the two alternatives with why not.
  The second half of the done-when turned out to be a one-word bug: the runner's
  summary **broke after the first run**, so a two-map suite printed the plant's
  probe and silently dropped the yard's, which is how a disagreement between two
  maps on one machine went a month without being noticed in the output everybody
  reads.
- [x] **H11 (M)** `npm run bench`: the real GPU. — done 2026-10-07, under
  Done. **The frame budget holds, 3x to 6x under its ceiling**, over twelve
  readings on `NVIDIA GeForce GTX 1060 6GB` — both maps, all three levels, two
  runs. `suite-skips.json` is **empty** and the drop lives in
  `scripts/bench-checks.json`, one file read by the bench (what to run) and by
  the gate (what not to count), held both ways by
  `the-bench-only-list-holds-only-checks-the-bench-itself-runs` — which also
  holds that `bench.mjs` names no id in its own code, so the two cannot drift.
  **D69** is the one judgement: a stale bench prints rather than reds.
  **H36** and **H37** are what the work revealed.
- [x] **H36 (S)** The sweep's "worst viewpoint" is one frame, and it does not
  reproduce. — done 2026-10-08, under Done.
- [ ] **H37 (S)** The weekly audit says how old the bench is. D69 took "print
  the staleness, never red on it" and named the alternative it refused: a gate
  that goes red when the newest `bench/<date>.json` is older than N days or
  names another commit would make the gate's verdict depend on hardware the
  gate may not have, and a routine that cannot clear it would stop building.
  A **calendar-shaped question belongs in the weekly audit**, which already
  reports drift it cannot fix (files over 600 lines, TODO counts, the skip
  list unchanged). Add the bench: the newest file's date and commit, how many
  commits have landed since, whether every `benchOnly` id has a reading in it,
  and one line of recommendation when it is stale. `scripts/suitereport.mjs`'s
  `latestBench()` is the reader; `benchOnlyById()` is the set it must cover.
  **Two things H36 found that this job needs.** `bench/<date>.json` is named
  from `run.at`, which is **UTC**, so a bench taken at 21:26 EDT files under the
  next day — a staleness report in local days will be off by one for any
  evening bench. And the newest file is now `bench/2026-10-08.json` with
  **twelve readings from the shipped check** (H36 rewrote what it measures), so
  a dry run names that rather than 2026-10-07.
  **This is the one job in Block H that edits a file outside this repo** — the
  audit task's own prompt, at
  `~/.claude/scheduled-tasks/blackline-audit/SKILL.md`. A scheduled session
  that is not comfortable changing another standing task's instructions
  unattended should leave it for Josh and say so in its summary, which is what
  the 2026-10-07 run did.
  *done-when:* the audit prompt asks for it, and a dry run against this repo
  names the newest bench file's date and commit.
- [x] **H33 (S)** Which other checks read a posed body at whatever phase the
  run arrived in? — done 2026-10-07, under Done. **There are two phases, not
  one**: `_animTime`, the gait, has the same property and is the bigger lever
  (24% of a pixel count on `look.js`'s walk and sprint poses against the
  breath's 1-3%). Of eleven modules that pose a body, **1 is held at the worst
  phase, 5 are measured here, 4 are out of reach by a proof the check now
  runs**, and twelve more read a body off a rendered frame and are declared
  unmeasured (**H39**). The one clause spending real margin is `hang.js`'s
  glove — **0.075m of a 0.15m tolerance**, invisible to the first instrument
  because a passing check's numbers are not in its detail line — which is
  **H38**. It also answers **H34** from the other end. **D70** pins the ride
  the table was measured at.
- [x] **H38 (S)** Hold `hang.js`'s glove at the worst phase of the breath. —
  done 2026-10-07, under Done. It is bounded now at **2.26x** with 56% of the
  tolerance left, and the job **corrected the census's number by a centimetre**:
  swept from a settled pose the offset runs -0.014m to +0.066m, not H33's
  -0.021m to +0.055m, because the hang pose was still easing when the census
  read it. Eight phases is the right density here and a **dense sweep of all
  419 frames proves it** (0.0663m against 0.066m) — the opposite answer to
  H34's, for a measured reason: this quantity is continuous where a pixel count
  is an integer. **H40** is what it found and left alone.
- [x] **H39 (S)** The twelve modules that read a body off a frame they
  rendered. — done 2026-10-07, under Done. **Two facts answered ten of them
  before a pixel was counted**, and both are proved: a lens grab never calls
  `updateVisual`, so every grab in a check is at one pose and a difference
  between two grabs cancels the body; and the gait is multiplied by `walking`,
  so it reaches no standing body at all, which every body in this group is.
  The two that are reached are wide — the thinnest is the rim's
  edge-over-interior at **1.39x** — and the list is classified in
  `tests/breathdrawn.js`, which `tests/breathcensus.js` now imports rather
  than keeping a second copy. **The queue was wrong about one module** for the
  third time in this block: the death camera is `visual.js`'s, not
  `feedback.js`'s, and is out of reach twice over.
- [x] **H40 (S)** The shipped glove clause reads a transient, not the hang. —
  done 2026-10-08, under Done. The queue was right that it read a transient and
  wrong about which: the pose blend was innocent and the mesh's own chase was
  the slow ease.
- [x] **H41 (S)** Which other checks time something on this renderer, and do
  any of them assert on it? — done 2026-10-09, under Done. **Nine clauses in
  eight modules read a duration and two put a verdict on the size of one**; one
  was already bench-only (the sweep, H11) and the other is the one the queue
  predicted. The clock in `frame-budget-under-the-check-29-load` was measured
  here rather than quoted: **one frame submits in 7.70ms and the fence waits
  1,159ms for it, 151x** (plant; 5.40ms / 730ms, 135x on the yard), so the
  verdict moved to `npm run bench` and the gate reports the number. **D71**
  says what that costs. **H45** is what the run's own hour found.
- [x] **H42 (S)** The bench asks for nine samples and nothing proves it got
  them. — done 2026-10-09, under Done. Built as the bench's **fourth honesty
  clause**: the count comes back out of each check's detail line, into every
  scene of `bench/<date>.json`, and under five it ends the bench non-zero
  naming the scene and what it got. Proved both ways with a new `--samples`
  flag, which exists because a card that always affords nine cannot show the
  clause firing. One exported line took `soak.js` to 589 of 600, so the
  sampling statistics are `tests/viewpointsamples.js` now and `bench.mjs`
  imports the floor rather than copying it.
- [x] **H43 (S)** Which checks read a world position off a mesh before the
  drawn body has got there? — done 2026-10-09, under Done. **Twelve modules**:
  three handle the chase, one is measured, eight are out of reach by six
  proofs. The structural answer is that **the suite cannot advance the chase
  by accident** — `stepFrames()` renders nothing, so a check that drives a
  state change with it reads a body that has not moved at all — and the one
  read inside the band is `look.js`'s, deliberately, at a gap **far deeper
  than nine millimetres** (all twelve states open, worst `landing` 0.794m).
  It also found the Warden chasing on its own copy of the law. **H46** and
  **H47** are what it found and left alone.
- [x] **H44 (S)** Does the grab's slide read as the body floating up into
  the hang? — done 2026-10-09, under Done. **No, and the shape this entry
  expected was wrong**: a grab carries the capsule over its move rather than
  teleporting it, so the drawn body trails the climb and the lag **builds**
  to 0.42-0.46m at frame 7 before closing, where this entry predicted 0.80m
  at frame 1 decaying. It can be seen — the gloves drawn gripping the lip are
  up to 0.46m under it — and whether it reads wrong is **D72**, with the
  frames to look at in `PLAYTEST.md` and `npm run shot -- --slide`. **H48** is
  the fix, blocked on his word.
- [x] **H45 (S)** The gate names another runner and builds anyway. — done
  2026-10-09, under Done. It **refuses** now and exits **3**, naming the pid,
  two ways to end it and `--allow-other-runners`, which is the only way past.
  Exit 3 is deliberate: 1 is red, 2 is a crash, and a run that declined to
  measure is neither. Proved both ways on a live pid. **H49** is what it
  found: the build task's own prompt does not know about the third code.
- [x] **H35 (S)** Three gates with their console-error counts written down,
  then close the `AudioContext` error or name a new hypothesis. — done
  2026-10-10, under Done. **Six** cold gates exist and all six read 0; the
  error is at 3 of 36 runs with no pattern left, and what the job found is
  the device: it goes **unrendered for 43% of a run** on this machine.
- [x] **H46 (S)** What the chase does to a pose photograph's *surroundings*.
  — done 2026-10-10, under Done. **It moves three eyes and every one is a
  climb**: the plant's `vault`, the yard's `mantle` and `pullup`. A census
  holds the set per map; **H52** is the fix if Josh wants one.
- [x] **H47 (S)** `deathcam.js` asserts the body did not move, and reads a
  mesh nothing could have moved. — done 2026-10-10, under Done. It reads the
  **capsule** now as well; proved by walking the corpse 0.75m, which the old
  clause did not notice. The census entry moved `frozen` → `ragdoll`.
- [ ] **H48 (M)** No position smoothing while a timed move owns the body.
  **blocked: D72** — it is a look, Josh has the numbers and the frames, and
  nobody should do this until he has said the slide reads wrong.
  H44 measured what a grab does: the drawn body trails the climb by 0.16m at
  frame 1, **0.46m at frame 7**, 0.15m at frame 15 and 1.5mm at 45, so for a
  quarter of a second the gloves drawn gripping a lip are up to 0.46m under
  it, against the 0.15m `tests/hang.js` enforces once settled. D72 has the
  four options and recommends the third: `positionSmoothing` exists to hide a
  60Hz step on a faster screen, and a timed move (`_move`, with its own timer
  and duration) already interpolates the capsule smoothly — there is no step
  to hide and nothing to gain by lagging it. Outside a move, unchanged.
  **Sized M because of what it moves, not because of the edit**, which is one
  branch in `updateVisual` on each body. Four measured constants in three
  modules rest on today's profile and all four go red, correctly:
  `tests/hang.js`'s `SETTLE_FRAMES` of 150 and the 2.26x margin argued from
  it (H38, H40); `tests/positionreads.js`'s `LOOK_GAP_CEILING` of 1.2m and the
  twelve-state table under it (H43) — four of those twelve states are timed
  moves and their gaps should collapse; and `tests/grabslide.js`'s own
  `PROFILE` and `PEAK_FRAME`, which is the point. Re-measure each rather than
  widening any, and the Warden gets the same branch as the Shade or
  `positioncensus.js`'s one-law clause is a lie.
  *done-when:* a grab's drop is under the band D72 settles on at every frame
  of the first fifteen, measured the same way; the four constants above are
  re-measured with their new numbers in `PROGRESS.md`; `PLAYTEST.md`'s H44
  section says what changed and `npm run shot -- --slide` shows it; and the
  60Hz jitter the smoothing exists for is shown still smoothed outside a move.
- [ ] **H49 (S)** The *build* task's prompt does not know about exit 3.
  H45 gave `npm run suite` a third exit code: **1 is red, 2 is a crash, 3 is
  "another runner is alive and this run declined to measure"**. The scheduled
  task's own prompt, at `~/.claude/scheduled-tasks/blackline-build/SKILL.md`,
  says only that a non-zero gate means write the red text under `## BROKEN
  BASE` and that "exit code 2 means the runner itself crashed". A refusal
  filed as a broken base is a wrong verdict in the record: the base is fine,
  the machine is busy, and the right move is to read the pid out of the
  stderr line, clear it, and start the gate again rather than to commit a
  BROKEN BASE and stop. Add the third branch, and the two ways to clear a pid
  that `TRAPS.md` now carries.
  **This is the second job in Block H that edits a file outside this repo**,
  and the same rule applies as to **H37**: a scheduled session with nobody
  present should not change another standing prompt, including its own. A
  session Josh is watching can take both in one sitting — they are two lines
  in two files, and H37's dry run is the harder half.
  *done-when:* the build task's prompt routes exit 3 to "clear the pid and
  re-gate" rather than to BROKEN BASE, and says which code means what.
- [x] **H50 (S)** A floor on the device's fed ratio, if one can be set
  honestly - and the `sign` count H35 found short. - done 2026-10-10, under
  Done. **No floor, and the readings are why rather than the argument**
  (D74): fifteen solo full-run readings between `fed` 0.5665 and 0.7481, a
  halfway stop would read 0.28-0.36, and 0.45 would separate them - but the
  ratio is a **total** and 0.28 is also a healthy device on a machine twice
  as loaded, so the line divides machines rather than faults. What is
  asserted is the sign: the clock moved at all over a window of minutes,
  over eighteen cases including the halfway stop, green on purpose. The
  census counts `sign` across both groups now and its tally must add up.
  **H54** is the measurement that would make a floor possible.
- [x] **H51 (S)** `src/systems/audio.js` is at 589 of 600. - done
  2026-10-10, under Done. `AudioSystem.BUILDERS` came out **verbatim** (142
  lines, diffed against HEAD) into `src/systems/audiosounds.js` and audio.js
  is **450**. The table keeps its name, so the three call sites and
  `tests/audio.js`'s enumeration are untouched, and
  `one-module-owns-the-audio-device-...` now holds the seam against the live
  recipe list. **H55** and **H56** are what it found: `src/physics.js` is at
  exactly 600 with zero headroom, and the gate's detail line has been saying
  so at every run.
- [x] **H52 (S)** Two strikes of a moving state land the capsule a metre
  apart, and the pose eye that a lag chooses. - done 2026-10-10, under Done.
  **The carried quantity is `_animTime`, the drawn gait's phase, and D66
  keeps it on purpose** - `breathcensus.js` holds a clause that `reset()`
  does not move it - so the fix is test-side and the restriction is now in
  `animation.js`'s header with the 0.975m. Which states it applies to is
  measured every run by a new census: **two**, `walk` and `sprint`, not the
  climbs and **not the slide**, which was declared on the argument and
  measured out. The look is **D75**, Provisional with six PNGs named and
  `decided:` empty on purpose; `photographHere` untouched. **H57**, **H58**
  and **H59** are what it found.
- [x] **H56 (M)** `src/physics.js` is at exactly 600 of 600. - done
  2026-10-13, under Done. **Option (b), and not the shape this entry
  recommended for it.** The queue named free functions taking the world
  (`mapclimb.js`'s shape) as the one that fits this codebase; the number says
  otherwise, because there are **53** call sites of `world.raycast` and
  `world.lineOfSight` under `src/` and that is 53 edits through the hot path
  in the job whose whole promise is that nothing behaves differently. So the
  two went out as a **prototype mixin** on F3's model, as `agenttraversal.js`,
  `ainav.js` and `mapgen.js` already are, and **not one caller changed**.
  `physics.js` **600 to 520**, `physicsquery.js` 113, `physicsscratch.js` 46;
  both method bodies and the scratch literal diffed **byte-identical** against
  HEAD. **The third file is the point**: the five scratch vectors are
  *aliases* shared with the sweep, and a sibling with its own copies would be
  a behaviour change in the swept solver that no existing check could see.
  The new check holds that by driving each half and reading the one exported
  object back. **Five breaks, five reds, each naming its own clause - and the
  fifth was a finding**: a `raycast()` pasted back into the class body leaves
  the identity clause **green**, because `Object.assign` writes through
  `[[Set]]` and changes an existing property's value and not its attributes,
  so only the enumerability clause can see it. The ceiling line now reads
  *"11 modules within 50 of 600, nearest src/tests/movement.js at 599 (1
  left) - of 184 this run loaded"*, which is **H70**.
- [x] **H57 (M)** Make a strike a function of its argument. - done
  2026-10-14, under Done. **The order, not a new condition**: drive to the leg
  furthest *forward*, `reset()` to the lane (D66 keeps the phase, snaps the
  place), then a measured count of frames - 37 at the walk, 27 at the sprint,
  both landing on the leg's furthest reach. All twelve states now land
  **0.000000000m** apart on both maps and `CARRIED` is empty. The three
  readings this entry was sized with all held, and **the parity was the real
  prize**: the old `Math.abs` detector made the pose reproducible only up to a
  mirror, and pinning it moved every walk and sprint gallery frame once (D76).
  **What cost the afternoon was not in this entry at all** - `strike()` drives
  a body through a *live* match, and `strikerepeat.js` was the one caller with
  no match of its own, so twenty-four strikes ran in front of a hunting Warden
  and the longer alignment got the Shade shot dead, intermittently, on the
  frame count. **H71** and **H72** are what that left behind.

- [x] **H71 (S)** `quiesce()` says it stops the AI interfering and does the
  opposite. - done 2026-10-14, under Done. **The sentence moved and the flag
  did not**, which is what the entry recommended, and the measurement behind
  it is the job's own finding: at the moment `quiesce` returns the Warden is
  **0.000m** off its spawn on both maps, because the AI takes about
  twenty-five frames to start walking and this settles twenty - so the frame a
  pixel check draws next is the same frame either way. The entry's "three
  callers" is **twenty callers and thirty calls**, twelve of which never name
  `initMatch` anywhere. `tests/quiesce.js` (337) reads the flag off the source
  as code and the sentence out of the comment above the body as prose, with
  the table keyed by the flag so flipping the body swaps which reading is
  demanded; four breaks, each naming its own line. **H73** and **H74** are
  what it left. `src/tests/pixels.js`: the docstring is *"Put both actors somewhere
  harmless and stop the AI interfering, so a measurement is of the thing being
  measured"*, and the body is `initMatch({ ai: true, objective: true })` -
  twice, once on the way in and once in the restore. So a check that quiesces
  gets a *fresh* match and a **live** Warden, and `look.js`,
  `positioncensus.js` and `poseeye.js` all rest on that sentence. H57 found it
  the expensive way: `strikerepeat.js` runs after `poseeye.js`, inherits that
  `ai: true` restore, and had the Shade shot dead mid-strike - `combat:shot`,
  `damage/headshot`, `combat:death`, twenty-two events inside one sprint.
  Nothing is wrong with the three callers today; what is wrong is that the one
  sentence a reader would trust is false, and the next check to rely on it
  pays what H57 paid. Either pass `ai: false` (and measure what moves - the
  AI's own frames are part of every pixel reading those checks take, so this
  is not a comment change wearing a code change's clothes) or correct the
  sentence to say what it does: puts both actors on their spawns and gives you
  a *live* match. Recommend the second plus a clause, because the first moves
  numbers in three pixel checks and the honest fix for a false comment is a
  true one.
  *done-when:* `quiesce`'s docstring and its body agree about the AI, a clause
  reads the flag it passes out of `pixels.js`'s source so the two cannot drift
  apart again, and `PROGRESS.md` says which of the two was done and why.

- [x] **H72 (S)** A strike that fails because the body died says it never
  swung a leg. - done 2026-10-14, under Done. One question at the top of
  `done()`, and the report is now *"the Shade was killed during the strike
  (health 0 of 100, ragdolled); the walk did not bring a leg furthest
  forward..."* - **the exact sentence H59's entry quotes as a mystery, with its
  cause in front of it**. The symptom is kept behind the death rather than
  replaced, and the check counts the 179 characters of it so that "kept" is a
  reading. The death is driven on purpose and not by a Warden: a listener on
  `sim:step` counts to twenty and lands a round through `combat.applyDamage`,
  the public door onto the `_damage` the rifle calls, because four rounds
  inside ninety frames is a function of where a Warden stands and a clause that
  waited for one would be flaky on a slower machine. Four breaks; break 3 found
  that the source clause was green on the strength of the `shot` branch while
  the `killed` one was gutted, and the **`shot` branch has no runtime case in
  this suite at all**, so both are asked for by name now. **H75** is what it
  left: `animation.js` is 592 of 600. `strike()` reports its failures through `why`, and every one of
  them is about what the body did not do - *"the walk never swung a leg (speed
  0.0)"*, *"a crouch at 0.0 m/s did not slide"*. H57 spent an afternoon on
  exactly that sentence while the actual cause was `health` 0 and `ragdolled`
  true: the Warden had shot the Shade during the run-up, and a dead body
  reports a stationary one. The cheap fix is a check of its own at the top of
  `done()`: if the Shade's health is not full, say so first - *"the Shade was
  killed during the strike (health 0, ragdolled)"* - because that names the
  cause instead of the symptom, and it is the same shape as H63's lesson that
  a break reddening for the wrong reason has proved nothing. Worth the lines
  for every future caller: the three that survive today survive on exposure
  time, not on a guarantee, and a slower machine is a longer exposure.
  *done-when:* a strike whose body died reports the death rather than the
  stillness, with health in the text, and a check drives a strike beside a
  Warden that kills the Shade and asserts the reported reason names it.

- [x] **H73 (S)** The five frames that make every quiesced reading
  reproducible, and nothing watches them. - done 2026-10-14, under Done.
  **It is not a wait, it is a turn**, which changed what got asserted: the AI
  is awake on the first frame and a patrol's first act is to face its first
  route node, so the Warden rotates a flat **0.0567 rad a frame** from frame 1
  and translates nothing until it is round. The angle is map data, so the
  frames are: the plant's first node is 1.83 rad off its nose and the body
  first moves on frame **4 or 5** after the helper returns, the yard's is 1.13
  rad off and it first moves on frame **17** - and on the plant two probes of
  the same question read 4 and 5, so an exact frame would have been a flaky
  bar. **The mechanism is pinned instead of the margin**: over the settle the
  yaw moves and the position does not, both asserted, the first moving frame
  reported, and the settle count read off `pixels.js`'s source so a helper that
  grew it past the turn is driven as it really is. Two breaks - a sixty-frame
  settle puts the Warden **1.62m** into its patrol and reds both clauses, and
  the settle driven with the AI off reds the turn clause. H71 measured why a live Warden in
  `quiesce()`'s match has never shown up in a pixel reading: at the moment the
  helper returns the Warden is **0.000m** off its spawn on both maps, because
  the AI takes about twenty-five frames to start walking and `quiesce` settles
  **twenty**. Twelve of its twenty callers draw a frame straight after it and
  name `initMatch` nowhere, so that five-frame margin is the whole reason their
  numbers are stable - and it is a coincidence of two constants in two files,
  with no clause on it. Measure the margin properly first (the frame the Warden
  first moves on, both maps, over several runs - it is 20 to 30 from one probe
  and that is not a measurement), then decide: pin it as a relation the way
  `the-frame-budget-asserts-a-median-frame-and-not-an-unlucky-one` pins its
  budget against its samples, or leave it reported with the reason. **A floor
  on a number first measured this morning is a rule nobody argued**, which is
  why H71 reported it and queued this.
  *done-when:* the frame the Warden first leaves its spawn on is measured on
  both maps over at least four runs and written in `PROGRESS.md`; either a
  clause holds the margin as a relation between `quiesce`'s settle and that
  frame, or the entry says why it is reported and not asserted.

- [x] **H74 (S)** Twelve checks take the match `quiesce()` leaves, and none of
  them says so. - done 2026-10-15, under Done. **The question could not be
  answered the way it was posed, and finding that out is the result.** Ten of
  the eleven readings involved drift run to run anyway - at HEAD too, on a
  breath that advances on the render frame's wall clock - so no single-run A/B
  can attribute anything, and only the death camera's 2,870 pixels sit outside
  that band. Eleven lines added on the rule's own argument, a thirty-one-site
  census to hold them, and **H79** is the drift the suite cannot see.


- [x] **H77 (M)** The rng is a *candidate* channel, and it turned out to be
  real and almost never open. - done 2026-10-16, under Done.

- [x] **H64 (S)** The flag census in `tests/args.js` is written down by hand. -
  done 2026-10-14, under Done. **Both holes the entry predicted were already
  open.** Five of the nine `.mjs` under `scripts/` were outside the census -
  the entry named two - and **seven flags on two runners that are in it were
  missing from the table**: `--url`, `--regression`, `--query`, `--pre`,
  `--allow-other-runners` on the suite, `--onscreen` and `--window-position` on
  the bench. All seven already go through `one(...)`, so **no runner's
  behaviour changed**: the table was the only thing out of date, which is the
  whole case for deriving one. `/scripts/` is a 404 from the page, so the
  runners come off `package.json`'s commands and the import graph (five
  commands reach all nine) and the flags off each runner's source, four
  patterns deep because a flag read only through its reader never appears as
  `args.<name>`. 27 flags across 5 named files to **34 across 9 derived** ones.

- [x] **H81 (S)** Should `quiesce()` name a seed? Yes, and the measurement
  that said so found a defect nobody was looking for. - done 2026-10-16,
  under Done.

- [x] **H59 (S)** A strike's **success** is not a function of its argument
  either, and the thing that was wrong was not the skip. - done 2026-10-16,
  under Done.

- [x] **H60 (S)** A census whose headline counts one set and whose tally
  counts another. - done 2026-10-17, under Done. **Five detail lines print a
  total beside a breakdown and they are four different shapes**:
  `breathcensus.js`'s counted the set the tree was *found* to pose a body in
  against the set its table *declares* (the defect - fifteen against twelve,
  green since H33, the difference being `OWN_FILES`); `positioncensus.js` and
  `breathdrawn.js` take their parts off one declared table with a `filter` on
  a word nothing validated; `quiescesites.js` sorts four ways, prints three
  and holds the fourth empty, so it has always added up by construction;
  `poseeye.js` prints a named *part* of its total and wanted nothing.
  `tests/censustally.js` is the two clauses all four now call. **The
  expensive find is that line's own length** - 516 characters of a
  400-character budget, so two of its five readings had never reached a
  report: **H91**.

- [x] **H65 (S)** The shape's densest block of marks lands after the journal
  is read. - done 2026-10-17, under Done. Two lines swapped in
  `tests/index.js`, and the order is a **clause** now rather than a comment:
  `the-device-journal-is-read-after-the-frames-that-feed-it` reads the
  registrar's calls, because the imports say the opposite and are not the
  registration order. The queue's numbers were H54's and the suite has grown -
  **93** calls today, the pair at 92 and 93 rather than 84 and 85 of 86 - and
  `tests/registry.js`'s own comment said *"registerPerformance is deliberately
  called last"*, H71's shape in a third file, corrected in the same diff.
- [x] **H66 (S)** The floor D74 refused, on the pair rather than on the
  total. - done 2026-10-17, under Done. **The floor is writable and this entry
  specified the wrong shape of it.** Put to D74's own eight shaped rows before
  being written, `fed` low **and** the loss concentrated leaves **row two
  green** - a device that died with the same total a healthy machine reads,
  which is the one case D74 says only a shape can catch. An absolute floor on
  the stretch answers all eight, 27x clear of the worst stretch ever observed
  (2.211s) and 6-14x under every fault, against the total's 1.16x. **And the
  coverage objection runs one way only**: a proven unfed span is a *lower
  bound*, so a verdict on its size can be missed and never invented - coverage
  limits sensitivity, not safety, which H54 and this entry both had backwards.
  `readCoverage()` reports the blind spot (1.00 of the plant's loss, 1.16 of
  the yard's). **H92** writes the floor, **H93** is the ceiling this cost,
  **H94** the coverage.

- [x] **H67 (S)** Three censuses read a buffer that is full. - done
  2026-10-17, under Done. **It was not full, it was four times over.** Measured
  with the buffer temporarily at 65,536: one run of one map makes **991
  requests** against the 250 default, so **741 of every 991 - three quarters -
  had been dropped in silence**. The readings that want *which modules ran*
  survived by position (193 modules inside the first 197 entries); the one
  genuinely exposed is the network ban, whose job is to see every request. And
  the entry's census count was wrong: **seven call sites in five modules**, not
  three, the four it missed being the four that joined after it was written.
  `index.html` raises the buffer to **16,384** before a module is asked for -
  a module cannot be early enough, the graph being most of the requests - and
  records `resourcetimingbufferfull`, which
  `the-resource-timing-buffer-has-room-for-every-request-the-page-makes` reds
  on. Four breaks; the first reproduces the defect, the count pinned at exactly
  250 after fetching 193 modules.

- [ ] **H82 (S)** `quiescesites.js`'s header is wrong about the yard, and H78
  measured it. The header argues the death camera's case with H73's headroom -
  "steps fifteen frames, which H73 says was only ever valid for four of them on
  the plant" - which reads as though the yard had seventeen frames in hand.
  **It has none.** H73's four and seventeen are about a Warden standing on its
  *spawn* when a match begins, with a route node to turn to and nothing to walk
  to yet. That check does not reset to a spawn: it teleports a Warden that has
  already been patrolling for thirty frames onto a spot 2.5m from the site, and
  such a body translates on frame **one**. H78 measured 0.0926m after five
  steps and **0.135427m** after six, *the same number to ten significant
  figures on both maps*, because the travel is a function of the walk ramp and
  the frame count and not of the place. So the sentence understates its own
  case and does it in the one direction that matters, and the number it should
  carry is not H73's. The twelve one-frame sites' sentence is unaffected - they
  step nothing - but the eleven that step are not four-and-seventeen either.
  *done-when:* the header says what H73's margin is about and what it is not,
  with H78's number beside it; the sites census is still green; and a clause or
  the header itself says which of the eleven stepping sites reset a body
  (teleport, no headroom) and which drive one from its spawn.
- [ ] **H83 (S)** Which other checks pick their own input and never check it
  stayed picked? A1, A3 and now H78 are three instances of one shape, and the
  answer has been found three times by hand. Every check that calls an actor's
  `reset()` and then measures something about where that actor is, is a
  candidate; `codeOf` over `src/tests/` finds the resets, and the question of
  each is whether anything between the reset and the read asserts the body is
  still on the spot. H78 is the worked example and the cheap one - the clause
  is three lines and a 1e-6 tolerance once the match has no AI in it. **Count
  first**: the census before any clause, because a floor on a number first
  measured this morning is a rule nobody argued (H71, H74, H77).
  *done-when:* every `reset(` on an actor under `src/tests/` is classified -
  the body is read back, the body is not read back, or the reset is the
  subject - with the count per class on both maps in `PROGRESS.md`; and the
  checks in the first class that assert nothing are either given H78's clause
  or carry the reason they cannot.

- [ ] **H84 (S)** Pin the crossing count, on whichever map the coin is on.
  `the-warden-walks-heavy-and-raises-the-rifle-to-where-it-looks` counts how
  many times the leg crosses the vertical over a 4.4m walk and wants **two or
  more**, and the count moves between the two runs of a map, so it is **one
  crossing from red**. H75 recorded it on the plant, "reproducibly, the same
  way on two different trees"; H79's census has the plant at **2 and 2** and
  the **yard** at **3 then 2**. So it is a coin and not a map fact, and a pin
  written against the plant pins the wrong map. There is no wall clock in this
  check, which is what makes it the cheapest honest case in the whole census -
  no pixels, no breath. **Find the quantity first** (H71, H74, H77): what
  decides whether the last crossing lands inside the 4.4m is the phase the
  gait starts at and where the walk stops, and `_animTime` is the lever H33
  measured at 24% of a pixel count. H31's shape is the likely fix - drive the
  walk from a known phase, or sample the cycle and report the worst - but the
  count is the thing to measure before anything is written down.
  *done-when:* the crossing count reads the same in both runs of both maps
  over three verifies, or the check reports the count and asserts something
  that is not one crossing from its own reading; `scripts/detaildrift.mjs` no
  longer lists it; and `PROGRESS.md` says which of the two it was and why.
- [ ] **H85 (S)** A green check has been printing a negative count. H79's
  drift census put `the-last-leg-to-every-legal-plant-is-planned-and-short` at
  the top of both maps, and the reason is not drift: the detail prints
  `tails in ${ai._route.length - Math.max(0, tailStart)} segments` and nothing
  floors that subtraction, so the plant read **"tails in -1 segments"** in one
  run and "2" in the other, the yard "1" then **"-2"**. `plantcensus.js:453`
  guards `tailStart < 0` and **nothing guards `tailStart > route.length`**, so
  the one case that makes the number meaningless is the one case that is not
  caught, and the check is green while it says it. The route sampled is the
  live AI's, drawn from the unseeded clock (H80), which is why which route it
  is moves run to run. Two things to settle and they are different: what the
  number should say when the tail is empty or shorter than the index, and
  whether a route that tails in no planned segments at all is a thing this
  census should report rather than print.
  *done-when:* the printed segment count cannot be negative and says what it
  means when there is no tail; a clause holds that - driven, not asserted
  about a string; and the entry says whether the sampled route should be
  seeded (H81's question, in this one place) or stay a reading.

- [ ] **H86 (S)** The per-check draw counts are a reading with no clause over
  them. H77 put three numbers on every check - what it drew from the
  simulation's stream, how much of that was under a step the AI drove, and by
  subtraction what a match opening spent - and the report prints them per run.
  Nothing holds them. The honest clause is a **budget**: no check may have
  more than N draws taken under a live AI without declaring that it does, the
  way `quiescesites.js` makes a site declare its Warden. The number N is the
  thing this job must measure rather than pick: H77's own verify is the first
  full-run census, and `determinism.js` is already at 3 on a subset because it
  plays two seeded slices with the AI live - which is immune to the channel by
  construction and is exactly the kind of row a budget must be able to accept.
  **Read H77's PROGRESS entry first**, and the `draws` block under each run in
  the report. *done-when:* the full-run census of per-check `underAi` counts
  is in `PROGRESS.md` for both maps, a clause holds a declared budget or a
  declared list, and a check that steps frames beside a live AI and reads the
  stream cannot be added without appearing in one of them.

- [ ] **H87 (S)** Three rows of H77's census cannot be told apart. The look
  stream's fourteen draws in `effects.js` are declared by method and by the
  decision each one is, and the ragdoll's three spins are `unit` with `when`
  lines differing by one letter - so a reorder, or a fourth spin, is a change
  the multiset comparison cannot see. The same is true of the two halves of
  the AI's aim and the two of the gun's spread. The comparison is a multiset
  on purpose (line numbers drift on every edit and would make it a census of
  formatting), so the fix is not line numbers: it is to declare each draw by
  **what it is assigned to** - the identifier on the left of the `=` - which
  `codeOf` already hands over and which a reorder does not change but a new
  draw does. *done-when:* every row of `SPENDERS` names the assignment its
  draw feeds, the comparison is on those rather than on bare method names, and
  a fifth `lookRng.unit()` added to `effects.js` reds the census by name
  rather than by count.

- [ ] **H88 (S)** An absolute value that hides a sign is how H81's class stayed
  invisible for a job, and `turn()` is not the only reading in this suite that
  takes one. `Math.abs` over a signed quantity is right when the clause is
  *how far*, and wrong the moment the reading is **grouped** or **compared
  across cases**, because two opposite answers become one. H81 is the worked
  example and it cost a whole job: `tests/settlecircuit.js` grouped the settle
  by `Math.abs(...)` of a yaw difference and so put a Warden facing 2.27rad
  away in with the majority. The census this job wants is of every reading in
  `src/tests/` that takes an absolute value of a signed quantity, split by
  whether the clause that consumes it is a magnitude (fine, and most are) or a
  grouping or a comparison across cases (not fine, and that is the list). H79's
  own first draft is the other instance on record - it ate a leading minus and
  read one quantity either side of zero as two different sentences - so there
  are at least two and nobody has looked for a third.
  *done-when:* the census is in `PROGRESS.md` for both maps, a clause holds
  that every grouping or cross-case comparison in it is on a signed quantity,
  and a `Math.abs` put back into one of them reds that clause by name.

- [ ] **H89 (S)** A pinned instrument stops sampling, and H81 pinned one. Since
  H81 the thirty `quiesce()` callers all open the same circuit, so the twelve
  sites that photograph the settle without stepping a frame will now **never**
  take the minority picture - 17/400 of the plant's circuits and 37/400 of the
  yard's, including the yard class that is on its spawn facing 130 degrees away.
  That picture is a real state of this game and nothing looks at it any more;
  before H81 it was looked at 4% and 9% of the time by accident, which is worse
  as an instrument and better than never. The cheap shape is a check rather than
  a flag: drive the two or three sites with the widest pixel margin at an
  **outlier** seed taken from `settlecircuit.js`'s pose census, and assert the
  reading is still inside the floor it is held to - which says the floors are
  about the Shade and the scene rather than about where the Warden happened to
  stand. The seed must come from the census and never be written down, for the
  reason H80 and H81 both give. *done-when:* at least one check reads a pixel
  floor's own measurement at a non-dominant pose on each map and holds it to the
  same floor, the numbers are in `PROGRESS.md`, and pinning that check to the
  dominant pose instead reds it as a census that has stopped varying.

- [ ] **H90 (S)** Two of the four strikers still answer H59's question their
  own way, in the safe direction. `look.js` and `poseeye.js` push a refused
  strike into `problems` **unconditionally**, so a state a map one day
  genuinely cannot strike would be declared in `CANNOT_STRIKE_HERE` and still
  red in two of the four callers - which is one answer too many to the same
  question and exactly the shape H59 closed in the other direction. The fix is
  three lines each: collect the refusals and hand them to `refusalProblems()`
  with the states that reached, as `strikerepeat.js` and `positioncensus.js`
  do. It is small, and the reason it is a job rather than a footnote is that
  it cannot be verified while both lists are empty: the only way to see it work
  is to declare a state, run the four, and take the declaration back out - so
  the job is the break as much as the change. **Read H59's PROGRESS entry
  first**, and note that `look.js` photographs each state once while
  `poseeye.js` takes a pair, so what counts as "reached" differs between them.
  *done-when:* all four callers route a refusal through `refusalProblems()`,
  a state declared in `CANNOT_STRIKE_HERE` reds none of the four while it is
  genuinely refused and reds all four the moment it strikes, and both
  directions are shown in `PROGRESS.md` with the declaration put back.

- [ ] **H91 (S)** The pose census's detail line is a third longer than the
  budget, and it is not the only one near it. H60 measured rather than guessed:
  `every-check-that-poses-a-body-declares-what-the-breath-and-the-gait-do-to-it`
  prints **537** characters, `scripts/suite.mjs` keeps **400** with no
  ellipsis, and before H60 the two readings at the end of it - the Warden's
  chest and the 8m hood - **had never reached a report in any run**, including
  the four every `PROGRESS.md` number of this check was taken from. H60 bought
  the readings back by moving H61's five-name proxy roster behind them, which
  is a reordering and not a fix: the roster is 141 characters, the readings end
  at 396, and the next sentence anybody adds puts one out of sight again. The
  other census lines are 296, 312, 334 and **393**, so one of them is four
  characters from the same hole.
  The question is what such a line is **for**, and the job is to pick an
  answer with a reason. Three: print the roster only when its membership
  *moves* (a criterion is interesting the day it changes and never otherwise);
  print the count and leave the names to `--details`; or give a report a second
  field for a census's roster, so a detail line is the measurements and nothing
  else. **Read H29 first** - it lost three of five readings to this cut and is
  where the 400 is written down - and H42, which was bitten by it while adding
  to a line.
  *done-when:* every census detail line is inside 400 characters on both maps,
  read off a `--details` file rather than argued, and a check holds those lines
  to the budget so one that grows past it is red rather than quietly cut.

- [ ] **H92 (S)** Write the floor, on the stretch rather than on the pair.
  H66 measured every candidate against the eight shaped rows of
  `CLOCK_CASES` and the answer is not the one D74 or H54 expected: **red when
  the device is known to have gone unfed across one continuous span longer
  than about a minute**, with no `fed` term in it at all. The pair this entry
  used to name (`fed` low AND concentrated) leaves a dead device green
  whenever its total matches a healthy machine's, which is D74's row two and
  the whole of its argument. The margins are the ones this project argues a
  threshold with: the worst single stretch ever observed is **2.211s** over
  fourteen full-run readings, so a 60s line is **27x** above the worst healthy
  reading, and every synthetic fault is 353-814s, so the same line is **6-14x**
  under all of them - against `fed`'s 0.45, which is 1.16x under the lowest
  healthy reading and why D74 said no. **A red cannot be a sampling
  artefact**, which is the clause this rests on: `unfedWorst.ms` is bounded by
  two marks reading the same monotonic `currentTime`, so it is a *proven*
  unfed span and a lower bound - a wider blind spot makes it smaller, never
  larger (H66). What it costs is a **fifth word in `timedrenders.js`'s verdict
  vocabulary**: H41's ban on a `size` verdict is argued about a timed *draw*
  (*"a submission time is cheap however expensive the frame is"*) and that
  census states it about any duration, so a floor on a wall-clock interval
  that brackets no draw reds it as written. One entry, one word, one clause -
  and the word has to carry its own criterion, the way `PROOFS` does.
  **Read H66's entry first**, which has the eight rows and both candidates.
  *done-when:* a constant in `tests/audiodevice.js` with its multiples argued
  from the readings on record, the verdict red on D74's rows two, three, five
  and six and green on the other four, **`CLOCK_CASES`' halfway row red** and
  D74's page carrying the override; `timedrenders.js`'s audiodevice entry
  moves the stretch's verdict off `reported` and its new word is held to a
  criterion rather than declared; and the floor broken both ways - a fault one
  second under the line stays green, a healthy run's own numbers with the
  stretch raised past it goes red.
- [ ] **H93 (S)** `src/tests/audiodevice.js` is at 597 of 600 and the cluster
  is twelve. H66 put 94 lines of reader, constants, cases and clause into it
  and bought 29 back out of a header that was carrying D74's and H35's
  arguments twice; the file was 548 before, 636 mid-job, and is **597** - three
  lines of headroom in the file H65's entry had already named as one of three
  within three of joining the cluster. The seam is the subject and not the
  prose, which is **H75's shape**: the module is two things, *the device asked
  about itself* (the two checks, `UNASKED`, the registration-order constants)
  and *what the journal's numbers mean* (`readDeviceClock`, `readUnfedShape`,
  `readCoverage`, `MIN_WINDOW_SECONDS`, `MIN_SHAPE_SAMPLES`, `CONCENTRATED`,
  `RESOLVED`, `CLOCK_CASES`, `COVERAGE_CASES`) - three pure functions and two
  case tables that import nothing and register nothing, which is
  `censustally.js`'s shape exactly (H60). **H66 did not split, on purpose**: a
  new module under `src/tests/` was a 251st request against a Resource Timing
  buffer of 250, whose last entry is dropped in silence. **H67 closed that and
  this is unblocked** - the buffer is 16,384 and a check reds if a page ever
  fills it. If H92 lands before this, it arrives with more lines to place and
  the seam is the same one.
  *done-when:* no module the page loads is over 600 lines, the runner's
  `ceiling:` line is read after the move and its cluster count is in
  `PROGRESS.md`, the three exported readers answer identically (their case
  tables run every suite and are the proof), nothing imports the new module
  but `audiodevice.js`, and the request count is in `PROGRESS.md` beside the
  buffer size.
- [ ] **H94 (S)** The journal is marked on frames and the gap is between
  bursts. H66 measured the blind spot: the widest interval between two marks
  is **1.00 of everything the plant loses and 1.16 of everything the yard
  loses**, so the whole of a run's loss would fit inside the one interval
  nobody watched, and the concentration the check reports is a concentration
  over the two thirds of the page that had marks in it. H65 added 210 marks a
  run and could not move that gap, and this is why the two are independent - a
  mark is handed to the journal by `AudioSystem.step()`, which runs on frames,
  and the gap is the quiet **between** bursts of frames, where the AUTO suite
  drives none at all (F4). **But a mark needs no frame**: `sample()` reads
  `context.currentTime` and advances nothing, which is H76's finding about
  `grab()` in another currency, so the suite can hand the journal a mark
  between checks for the price of a call. The seam is the runner that already
  brackets every check, `ui/autosuite.js`'s `runAutoTests` loop, which beats
  the heartbeat per check (F10) and is the one place that knows a check has
  ended; no `setTimeout` and no rAF frame is involved, so neither ban is
  touched (F13, F4), and the stretch arithmetic H54 wrote is unchanged -
  a mark between checks is a mark like any other.
  **Sized honestly: this is worth less than H66 thought when it started.**
  H92's floor does not need it, because a proven span is a lower bound
  whatever the coverage. What it buys is the *concentration* becoming a
  reading over a whole run, which is what would let the shape carry a verdict
  of its own and what would make the stretch's `atMs` mean something.
  *done-when:* the journal is handed a mark at the end of every check as well
  as on every drawn frame, `maxGapMs` on a full run of both maps is **under 5%
  of the loss** (`readCoverage()`'s `RESOLVED`, which H66 wrote for this), both
  numbers are in `PROGRESS.md` with the mark counts, and the shape is still
  `many-stretches` with its concentration now a reading over the run.
- [ ] **H12 (S)** A bug report. Pause → *Copy report*: map, seed, version,
  settings, the last thirty seconds of input, the last twenty log lines, to
  the clipboard as text. The version is `VERSION` / `versionLabel()` in
  `src/version.js` (H3) — quote the commit, not just the label.
  *done-when:* a check reads the produced text.
- [ ] **H13 (M)** Replays. Record the per-step input codes with map and
  seed; `?replay=` or a dropped file replays deterministically; files under
  `tests/replays/` are run by the suite as checks that assert their recorded
  outcome. *done-when:* a recorded match replays to the same end state, and
  one replay ships in `tests/replays/`.
- [ ] **H14 (S)** A crash guard. `window.onerror` and unhandled rejections
  pause the sim and show a panel with the seed and *Copy report*; runtime
  assertion failures are counted into the report. *done-when:* a check
  throws from inside a step and reads the panel.
- [ ] **H15 (S)** The pause menu: restart round, restart match, change map,
  quit to menu, with a confirm mid-round. *done-when:* a check drives each.
- [ ] **H16 (S)** `npm run notes`: release notes from `PROGRESS.md` since
  the last tag into `RELEASES.md`; Josh tags when he merges. *done-when:*
  the script runs and the file reads.
- [ ] **H17 (S)** The plant's card shows a slab, because the plant is a
  sealed shell and every exterior eye gives one (H5, D55). If Josh asks for
  its inside: hide the roof for the thumbnail render only. There is no
  generic "the roof" rule — a height cut deletes half the yard's containers —
  so it wants a per-map hint on the registry entry (`thumbHide: ['roof']`, a
  tag prefix) rather than a clever derivation. *done-when:* the plant's card
  is measurably more than the roof (a lit-pixel floor raised, and a check that
  the yard's card is unchanged by the same code path).
  **blocked: D55** — only worth doing if he wants it.
- [ ] **H18 (S)** The map row under the cards does the same job the cards do
  (H5). Make it a plain label, or drop it. It is kept today because
  `the-menu-offers-every-map-and-its-map-row-asks-for-the-next-one` drives it
  and `BLACKLINE_SPEC.md` names that check by id, so this job rewrites the
  check to drive the cards instead — same assertions plus per-map
  reachability, which is strictly stronger, and the id stays. *done-when:*
  the check drives a named card rather than a cycle and the menu has one way
  to pick a map. **blocked: D55.**
- [ ] **H19 (S)** A rebind survives a reload. H7's store keeps settings and
  a keymap is not one: it wants its own versioned record beside them, and a
  rule for a stored map naming an action or a code this build no longer has
  (ignore that entry, keep the rest — the settings store's "only a key the
  defaults have, at the type they have" in the shape a map needs). H8's
  controls page and `resetBinding` are the UI it needs; nothing there
  changes. *done-when:* a check writes a rebind, throws the live map away
  the way `resetSettings` does, loads, and drives a climb on the restored
  key; and a record naming a dead action applies the rest of itself.
- [ ] **H20 (S)** The controls page at seventeen actions is thirty-five
  keyboard rows and one flat list (H8). Group it — move, fight, gadgets,
  system — with the groups as headings the ring skips, or put the reset
  cells behind the row's own sideways keys and halve the list. Look only;
  nothing about what a player can do changes. *done-when:* the reachability
  check still counts every control, and the page fits a 720p window without
  scrolling.
- [ ] **H21 (S)** A stored number outside its bounds. H7's store validates a
  loaded record by **type** and not by range, so a hand-edited
  `{"fovShade": 500}` or a `mouseSensitivity` of 9 is accepted and the camera
  is broken with no way back but *reset to defaults*. H9 added three more
  numbers with published ends (`fovMin`/`fovMax`, the two sensitivity bounds),
  which is what makes this worth doing now rather than when it bites. The
  bounds belong beside the defaults so the store can find them from the key,
  not in a second table: a value outside them is **clamped and the rest of the
  record kept**, the way a dead action is dropped in H19. *done-when:* a check
  writes an out-of-range record for every bounded setting, loads it, and finds
  each one at its nearest end with every other setting intact.
- [ ] **H22 (S)** The settings page is fourteen rows and two buttons (H10 made
  the fourteenth), and H20
  was written for the controls page's thirty-five. The same grouping serves
  both: **look, audio, match, system**, with the group headings rows the ring
  skips. Do it once, in `_rows()`, and let H20 be the controls page's turn.
  Look only; nothing a player can do changes. *done-when:* the reachability
  check still counts every control on both pages and neither needs scrolling
  in a 720p window.

- [ ] **H95 (S)** Four reported problems say *"in code"* where the clause read
  the weak reader. H68 fixed the names and left the wordings: `benchlist.js`
  twice (*"scripts/bench.mjs:N names "id" in code"*, *"scripts/suite.mjs asks
  for samples in code"*), `grabslide.js` once (*"scripts/shot.mjs does not
  mention X in code"*) and `timedrenders.js` once (*"scripts/suite.mjs asks for
  timedVerdict in code"*). Every one of those reads `uncommented`, so the
  evidence is a URL parameter or a quoted id - text with the comments out, and
  not code. It is the alias's lie moved from a name to a sentence, and the
  sentence is the half a human reads: a reader told "in code" who then greps
  the file as code will not find what the check found.
  Say what was read. The phrase this suite has for it is *with its comments
  out* (`sourcetext.js`'s header, H53's entry), and `requestbuffer.js:210` is
  the fifth site to check - it says *"in code"* and genuinely reads `codeOf`,
  so it is the control rather than a defect.
  **The hard half is holding it**, and it may not be holdable: the wording of a
  problem is prose, and `positioncensus.js` already holds two entries against
  the wording of a reported problem, which is the only precedent. The cheap
  version is a clause in `readernames.js` that reads each module's problem
  strings beside the reader its clause used - the two are usually in the same
  `else if`, which is a parse and so not allowed (`donedef.js`'s rule).
  *done-when:* the four wordings name the reader they read, the fifth is left
  alone with a line saying why, and either a clause holds the rule or
  `readernames.js`'s header says in one paragraph why a message cannot be held
  the way a name can.

- [ ] **H96 (S)** Seven censuses walk the same tree of modules independently.
  H67's entry named this as worth a later look and H68 made it seven: each one
  calls `getEntriesByType('resource')` for the modules that ran and then
  `fetch`es every one of them for its text. The browser serves them from its
  cache, which is why 991 requests cost nothing measurable, but it is seven
  times the work and seven copies of the same four lines - the shape H53 and
  H58 collapsed twice already, one level up.
  A shared reader in `tests/sourcetext.js` (or beside it) that fetches each
  module under `src/` **once** and hands back a map of path to text, with the
  two readings memoised, and the seven censuses asking it instead:
  `audiocontext.js`, `donedef.js` (three sites), `pixelfloors.js`,
  `posecriterion.js`, `readernames.js`, `requestbuffer.js`, `rngdraws.js`.
  **Two things it must not break.** `requestbuffer.js`'s own census counts call
  sites of the buffer read per module and declares them, so collapsing seven
  reads into one moves six rows of its table and the counts in them - that is
  the point, and the table has to move with it. And `requestbuffer.js`'s clause
  3 measures the live entry count *after* the census has fetched every module,
  as the proof that the raise took effect; a cache that fetches once would make
  that measurement smaller and it has 41x of headroom, so it survives, but the
  number in its detail line moves.
  *done-when:* one module owns the fetch, the seven ask it, `requestbuffer.js`'s
  declared sites match the new shape, and a check holds that no census under
  `src/tests/` fetches a module's text for itself - read off the tree, the way
  H68 holds the readers.

- [ ] **H97 (S)** And the *line-local* comment test has three copies of its
  own. `codeOnly(line)` is the one place that decides whether a line is a
  comment - that is its first statement, and `tests/sourcetext.js` argues the
  decision at length - and three censuses that need a **line number** rather
  than a whole stripped file wrote the test again instead:
  `benchlist.js:233`, `donedef.js:311` and `pixelfloors.js:153`, all three
  `/^\s*(\/\/|\/\*|\*)/.test(line)`. H68 found them while collapsing the two
  whole-file readers and left them, because they are not either reader and its
  clause is about the readers.
  **They are not even the same test.** `codeOnly` guards on `[\t ]*` and these
  three on `\s*`; per line the difference is nothing, which is exactly why
  three copies of a four-character divergence can sit in a suite whose whole
  subject is that two readers are not interchangeable.
  `codeOnly(line) === ''` already answers it, and an `isCommentLine(line)`
  beside it would say so at the call site - the question each of the three is
  asking in words.
  *done-when:* one module decides whether a line is a comment, the three ask
  it, every clause answers as it did (`benchlist.js`'s id census,
  `donedef.js`'s prose-or-code split and `pixelfloors.js`'s floor census all
  quote readings in `PROGRESS.md`), and `readernames.js` grows a clause that
  holds the line-local test the way it holds the whole-file ones.

- [ ] **H98 (S)** A device event in a page's first run reds its second run too,
  and nothing says which run it was in. H70's first verify went red on
  `the-audio-device-keeps-its-clock-and-journals-the-states-it-enters` [plant]
  with *"238263ms after the unlock: the device context suspended itself after
  the unlock resumed it"* - **the same sentence, to the millisecond, in both
  plant runs**, because the page is loaded once a map and the journal spans
  both runs of it (F16's rule for anything cumulative; H67 measured the same
  thing in the request count). The console error beside it is attributed
  properly - *"[plant run 1, 309s in]"* - so the runner knows which run it
  happened in and the journal does not say.
  What that costs: a **transient** device event and a device that is genuinely
  gone read identically, `flaky` cannot see the difference (both runs answer
  the same, which is what flaky means by stable), and the reader of a red run
  cannot tell whether the second run cleared. D73 decided a suspended device is
  red and that is not in question here; what is missing is **which run**.
  The journal already carries wall-clock marks, and `suitereport.mjs` already
  stamps a console error with its run - so the fix is to say it: the state
  transitions in the detail line name the run each landed in, and the last
  clause says whether anything happened in **this** run as against earlier in
  the page's life.
  *done-when:* the journal's detail names the run of the page each transition
  landed in, a clause holds that it does (the shape H65's own check has), and
  the entry says in one line why a per-run verdict is still D73's and not this
  job's.

- [ ] **H99 (S)** A fresh seed ties medium and hard at 8m on the yard, and the
  tie is red. The 2026-10-18 audit's widened fresh-seed run (`--subset
  "fuzz|soak|stall|stuck|leaks-nothing|random-real-input|never-climbs|difficulty|seed"
  --query "seed=20261018"`) turned
  `each-difficulty-is-quicker-to-see-you-and-quicker-to-kill-you` red on the
  **yard**: *"at 8m hard kills in 0.49s, not sooner than medium's 0.49s"* -
  medium 4.97s/0.49s **32/32**, hard 3.60s/0.49s **32/32**; every other row
  ordered (8m easy 7.35s/0.64s 27/38; 16m easy 13.63s/3.39s, medium
  9.27s/1.74s, hard 6.73s/0.85s). The plant passed under the same seed, the
  `fuzz|soak` pair the audit is asked for passed 4/4, and the 10-11 audit's
  seed passed this subset 24/24. One run, so not established as
  deterministic for the seed. **F17 named this exact shape and left it**: at
  8m the body subtends ±2.43 degrees, wider than medium's 2.5-degree cone
  and hard's 1.2, so once both land every round they saturate at the gun's
  rate-of-fire floor and no aim model separates them - F17 measured the
  per-round draw producing 0.39s/0.39s and rejected it for that reason, and
  wrote the separation at 8m down as **K6's** (difficulty at range). What is
  new is that the per-burst draw, under this seed, reaches the same tie:
  `tests/difficulty.js:335` asserts `harder.kill < easier.kill` strictly,
  and the detect column (3.60s against 4.97s) already orders the two. Not
  fixed by the audit.
  *done-when:* the same command with `seed=20261018` is green on both maps
  without a kill time being compared less strictly than today, by one of:
  the kill clause at a range where both presets read a full-hits tie at the
  rate-of-fire floor is a reading and the detect clause is the verdict there
  (argued in the check's header, with F17's geometry, and the floor itself
  named from config rather than observed); or K6 gives the two presets a
  separation at 8m that is not the aim cone. Either way the entry says which
  seeds (20261018 and F17's 1637054825) it was run under, and
  `the-widest-cone-kills-at-range-and-not-once-in-a-while` is unchanged.

## Block K — the Warden as an opponent

A third-sized pass (D50). The rule to protect: the Warden stays grounded.

- [ ] **K1 (M)** Search like a person. From the last-known position, a
  sweep of the room's hiding spots ranked by distance and cover — behind
  crates, under the deck — and a look *up*: it aims at climbable tops it
  cannot reach and fires on a Shade it sees there. *done-when:* a check
  hides the Shade behind a crate and on a top; the Warden checks both
  within a bounded time; the AI soak unchanged.
- [ ] **K2 (M)** Hearing with memory. Noise raises an attention level per
  room that decays; a heard noise sends it to the room, not the point;
  metal footsteps louder (I2). *done-when:* attention curves in a check;
  the detection checks unchanged.
- [ ] **K3 (M)** The torch, on the night map. A rifle-mounted spot, no
  shadows (spec 4.1 keeps the one shadowed light), a visible cone; the
  Shade inside it counts as lit for detection; the AI sweeps it where it
  looks; a key for the human Warden; off on the plant. *done-when:* a pixel
  check sees the cone; a detection check catches a Shade in it that the dark
  hid; frame budget unchanged.
- [ ] **K4 (S)** Alarm response. A trip sends it along the route past the
  camera, and it places the camera on the likeliest approach. *done-when:*
  the placement is on a declared route in a check.
- [ ] **K5 (S)** Giving up. A search timer by difficulty; back to patrol
  with a bark (N2); faster to re-alert the second time. *done-when:* a check
  times both.
- [ ] **K6 (M)** Difficulty at range. Aim error grows with distance and the
  target's speed and shrinks with time on target, so medium and hard part
  at 8m (D33 found hard a machine there). **Read F17's PROGRESS entry
  first**: medium and hard are 0.02s apart at 8m on the yard and 0.16s on
  the plant, both within a frame or two of the gun's own floor of four
  rounds at 600rpm, so *no aim model separates them there* — at 8m the body
  is wider than either cone and both presets already hit with everything
  they fire. Whatever parts them up close has to be something other than
  accuracy. F17 also measured, built and reverted the **per-round aim
  draw** (D54): it removes the time-to-kill's tail at unchanged accuracy and
  is probably right, but it is what tips medium and hard into a dead heat at
  8m, so it becomes available again the moment this job separates them.
  *done-when:* time-to-kill per distance per preset is monotonic and
  separated in the existing checks.
- [ ] **K7 (S)** Patrol variety. Route order and pauses from the seed; a
  site room checked when the round clock is low. *done-when:* two seeds
  give two orders in a check; determinism check unchanged.

## Block M — vision

Josh (D50): the *Shade* gets night vision and an x-ray "that works through
thin walls like vents, crates and such, not real regular walls"; the alarm
camera gets a live feed; the Warden a torch (K3). Parameters are
provisional; the rule for "thin" is mechanical, never a tag.

- [ ] **M1 (M)** The Shade's night vision. `V` toggles; a post effect on the
  Shade's view — exposure lift, a green cast, grain — no cost to the body
  (provisional; the Shade's problem is being seen, not seeing); the HUD
  shows it; off in menus. *done-when:* a pixel check measures the lift on
  the yard; detection of the Shade unchanged.
- [ ] **M2 (M)** The x-ray rule. `seeThroughAlong(from, to)` in the map: a
  solid is see-through if its top is below its room's ceiling by a body's
  height (or it stands under the sky), and the sightline's total thickness
  in such solids is under `xray.maxThickness`; a room wall or the shell
  never is. *done-when:* a check proves ducts, crates and containers pass
  and every shell and room wall does not, on both maps.
- [ ] **M3 (M)** The x-ray, drawn. `X` toggles; the Warden, its camera and
  the charge drawn as silhouettes where M2 says yes, within a range; draw
  calls counted. *done-when:* a pixel check sees the Warden through a crate
  and not through the west wall; frame budget unchanged.
- [ ] **M4 (S)** Vision-mode bookkeeping. Keys in the controls card and the
  tutorial (H6), HUD state, spec 20.x, a provisional entry for every number.
  *done-when:* the card and the spec say it; the check for the card reads it.
- [ ] **M5 (M)** The alarm camera's live feed. A second low-res render — no
  shadows, no post — into a texture, picture-in-picture on the Warden's HUD
  while a camera stands; dark when the taser kills it. *done-when:* a pixel
  check reads the feed; the frame budget with a feed up is measured and
  within the ceiling.
- [ ] **M6 (S)** What the feed means. Seeing the Shade on the feed is the
  human Warden's to notice; the AI trips on proximity as before. *done-when:*
  the AI checks unchanged; `PLAYTEST.md` says so.
- [ ] **M7 (S)** The camera seen. A placed camera is visible and has a
  small lens light, so a Shade can find and taser it. *done-when:* a pixel
  check from 6m.

## Block J — feel and juice

- [ ] **J1 (S)** Camera collision. The third-person boom sphere-casts to the
  wall and eases back. *done-when:* a check backs the Shade into a wall and
  the camera never enters geometry.
- [ ] **J2 (S)** Hit-stop and shake. 70ms of wall-clock stop on a knife or
  finisher; shake on a grenade by distance; both under a setting.
  *done-when:* the fixed step count is unchanged by hit-stop in a check.
- [ ] **J3 (M)** Ragdoll polish. Limb flail from the hit direction, a
  settle, no jitter, the death cam framing the body. *done-when:* a check
  measures settle time and zero post-settle motion.
- [ ] **J4 (S)** An event feed. Planted, defusing, alarm tripped, reinsert,
  the round's outcome — timed lines top-right. *done-when:* a check reads
  each line on its event.
- [ ] **J5 (M)** The killing shot, replayed. On death, two seconds from the
  Warden's eye via the input log (H13), then the ragdoll; skippable.
  *done-when:* a check dies and reads the replay's frames.
- [ ] **J6 (S)** Dust and light. Landing dust by fall height, a muzzle
  flash light (unshadowed, one frame), sparks on a metal hand-plant, the
  scuff's puff. *done-when:* pixel checks; particle caps hold.
- [ ] **J7 (S)** Reactions. The Warden flinches on damage and staggers on a
  taser; the Shade flinches in third person. *done-when:* pose checks.
- [ ] **J8 (S)** Idle life. Breathing sway; the Warden's head turns before
  its body; the Shade's hood moves in the yard's wind. *done-when:* a check
  sees motion at rest and none in a menu.
- [ ] **J9 (S)** Sprint FOV kick and the crouch camera's easing, under H9's
  toggles. *done-when:* a check reads the FOV over a sprint.

## Block I — audio, ambience only

Josh (D50): no music. The map's own sound carries it.

- [ ] **I1 (M)** Ambience beds. The plant: transformer hum, drips,
  ventilation; the yard: wind, a distant port, rain on steel when D9's
  night wants it. Synthesised, seeded, looping without a seam; louder in
  bigger rooms. *done-when:* `renderOffline` proves each bed and the seam.
- [ ] **I2 (S)** Footstep materials. Concrete, metal, grate, wet from the
  finish under the feet (E4/E5). *done-when:* a check walks each and
  compares the samples.
- [ ] **I3 (S)** Room acoustics. A delay sized by the room's volume;
  outdoors dry with a slap off the ring. *done-when:* the tail length per
  room in a check.
- [ ] **I4 (S)** The mixer. Master, effects, ambience, voice; persists (H7);
  mute on blur. *done-when:* a check reads each gain through the graph.
- [ ] **I5 (S)** Spatial polish. The beep occluded by walls, the Warden's
  reload and torch click positional, the alarm's trip. *done-when:* a check
  measures occlusion from the next room.
- [ ] **I6 (S)** Menu and round sounds. Clicks, round start and end stings,
  the last ten seconds' beep quickening. *done-when:* samples proved.

## Block L — gamepad, no aim assist

- [ ] **L1 (M)** The pad. Gamepad API, deadzones and curves, hot-plug,
  buttons to actions, a synthetic pad for the suite. *done-when:* a check
  drives a climb and a plant from a synthetic pad.
- [ ] **L2 (S)** Glyphs. Prompts, the briefing and the controls card show
  pad glyphs after the last input was a pad. *done-when:* a check flips it.
- [ ] **L3 (S)** Menus on the pad. Stick and d-pad, A/B, the settings rows.
  *done-when:* a check walks the menu.
- [ ] **L4 (S)** Pad rebinding and stick sensitivity in H8's UI.
  *done-when:* a check rebinds a button.

## Block N — voice lines, synthesised

- [ ] **N1 (M)** A radio voice. Formant bursts with a squelch, one recipe
  per line, seeded within the recipe so it never repeats exactly; rendered
  offline for the checks. *done-when:* samples proved distinct per line.
- [ ] **N2 (S)** Barks wired. Contact, lost him, heard something, the site
  called by name on the beep, back on duty; subtitles on the Warden's HUD;
  positional for the Shade. *done-when:* each event produces its bark once.
- [ ] **N3 (S)** The Shade hears it. A bark is a positional cue at the
  Warden's position; a subtitles setting. *done-when:* a check reads the
  panner.
- [ ] **N4 (S)** Never a chatterbox. Cooldowns and priority; a check holds
  the maximum rate. *done-when:* the rate check.

## Block O — a skeleton under the figures

Last, on purpose: the routine cannot judge the result, so every job here
ends with a gallery Josh looks at (`npm run shot -- --pose all`).

- [ ] **O1 (L)** The rig. A `SkinnedMesh` per figure, about fourteen bones,
  the existing merged parts skinned to the nearest bone; one material; the
  outline pass and the draw-call count unchanged. *done-when:* the E1/E2
  silhouette checks pass on the rig.
- [ ] **O2 (M)** Poses on bones. E3's pose library as bone rotations, the
  0.2s blend kept. *done-when:* every E3 pose check passes.
- [ ] **O3 (M)** Locomotion. The stride from ground covered on the legs,
  arms counter-swinging, a crouch walk. *done-when:* a check sees the cycle.
- [ ] **O4 (M)** Climb IK. Hands on the lip through grab, hang and pull-up;
  feet on the treads. *done-when:* a check measures hand-to-lip distance.
- [ ] **O5 (S)** Ragdoll on the rig (J3 bone-driven). *done-when:* J3's check.
- [ ] **O6 (S)** Galleries. `npm run shot -- --pose all` per figure, linked
  from `PLAYTEST.md`. *done-when:* the images exist per commit.
- [ ] **O7 (S)** Skinning cost within budget, and a check that holds it.
  *done-when:* the frame-budget check unchanged; a skin-time number quoted.

---

## Done

- **H70** Two checks about one key, and the seam made checkable.
  `src/tests/movement.js` was **599 of 600** and the leader of the cluster the
  moment H56 landed. It is the mechanical half of Section 16's checks 1, 5 and
  7; the two checks that took it there are about the climb **key** - D17's
  *a climb is a press of Space* and D21's *a tap grabs, a hold climbs* - and
  arrived later. None of the length was prose, so the cut was along the
  subject: `src/tests/climbpress.js` is **314** lines and `movement.js` is
  **331**. **The two drivers came across, and that is the argument of the
  split**: `driveAtLedge` and `findGroundLedge` are what every climb check in
  the suite reaches a ledge with - `bindings.js`, `hang.js`, `scuff.js` and
  `tutorial.js` take both, `feel.js`, `grabslide.js` and `strikedrive.js` the
  finder - and **none of `movement.js`'s three remaining checks calls either**.
  Seven import lines changed, one word each, plus one sentence of
  `strikedrive.js`'s prose; `movement.js`'s `riseIsClear` import went with the
  finder that used it, checked rather than assumed (H75's `alongLane`). Not a
  line of what the checks drive changed - both go through `input.heldCodes` and
  `input.pressedCodes`, and `driveAtLedge` is where that is done.
  **The clause is the seam itself**, in `registry.js`, the check whose subject
  already is the suite counting itself: *a module that registers checks may not
  export something none of its own checks use, unless the census declares it
  with why.* Measured before it was written - exactly **two** modules on this
  tree are that shape and both are right, `figure.js`'s `flatShadeSilhouette`
  and `look.js`'s `POSE_EYE_NAMES`, both rows rather than exemptions - and it
  holds the other direction, so a row that stops being that shape is reported.
  It reds on this job's own revert: `findGroundLedge` put back as an export
  `movement.js`'s checks do not call, red on both maps. **Two tempting rules
  were measured and refused**: *one place presses the climb key* is false
  (fifteen modules press Space), and a tighter ceiling for a split module is
  **D77**, which H69 raised an hour earlier and is Josh's.
  **The first verify went red on the audio device** - it suspended itself for
  317 seconds under a running plant page (D73's red, nothing to do with this
  job), the same sentence to the millisecond in both plant runs because the
  journal spans both runs of a page, which is **H98**. The second verify, same
  tree, clean: plant **240 / 1 / 8** (1,111,738ms, 1,121,404ms), yard **220 / 1 / 28** (805,798ms, 774,996ms), spreads **1%** and **4%**, 0 red, 0 flaky, 0 skipped, 0 unexpectedly green, **0 console errors**, no other runner, ceiling **10 of 600** over **195 modules** in all four runs; all five checks one distinct detail line over
  two runs of each map; the ceiling line names a different leader,
  `audiodevice.js` at 597 (**H93**). — done 2026-10-18, commit `8545cfa`

- **H69** The argument moved to the thing it is about, and the one rule a prose
  job can hold. H62 took `positioncensus.js` from 547 lines to **593 of 600**
  and almost none of the growth was code: two reader swaps and a line count, and
  the rest the paragraph saying why, written into the check's header a hundred
  lines above the patterns it was about. Five paragraphs out. The two about
  **mechanisms** went beside the patterns that are those mechanisms - H40's
  measurement of the chase law and *both bodies chase and only one read the law*
  above `THE_LAW`, and *the suite cannot advance the chase by accident* above
  `ADVANCES_THE_CHASE`, which had carried a one-line summary of it. The two
  about **one module each** belonged in that module's `note`, which already
  carried them in its own words: `look.js`'s twelve measured states and H47's
  closed hole in `deathcam.js`; the one sentence the notes lacked was `look.js`'s
  own header quoted, and it is in that note now. The fifth was a summary of
  H62's reader split, a page `positionreads.js` already holds whole, and is
  three lines pointing at it. What stayed is the paragraph a check cannot
  delegate: what it holds and what it does not. **548** lines, out of the cluster
  by 52, and the runner's `ceiling:` line reads **11 modules within 50 of 600**
  where it read twelve - re-read, as the entry asked, not assumed.
  **Nothing was deleted, measured rather than asserted**: of 43 sentences in the
  old header 32 survive with a verbatim run intact and the other 11 were checked
  one at a time against the notes. The detail line is **one distinct string**
  across the eight runs of this verify and H68's.
  And the clause: a prose move has no behaviour to hold, so two candidates were
  measured and dropped - a **no-duplicate-sentence** rule between a check and
  its table (it catches nothing: the pair shares **zero** sentences of six words
  or more, before the move and after, because the duplication was paraphrase)
  and a **tighter line ceiling** for a split module (a threshold nobody has
  argued, which is **D77** now). What is held instead is the rule H69 is an
  instance of, where it is mechanical: **every pattern `positionreads.js`
  exports carries the job that measured it in the comment above it** - three
  names as data, a job id and not a word count, read raw because the evidence
  *is* the comment. Folded into `criteriaProblems()`, so the check gained one
  `await` and no lines. Broken to see it red: `THE_LAW`'s one-line comment back,
  both maps red at *"THE_LAW carries no job id in the comment above it"*.
  Verified plant **240 / 1 / 8** (1,121,223ms, 1,117,301ms), yard **220 / 1 / 28** (792,342ms, 778,301ms), spreads **0%** and **2%**, 0 red, 0 flaky, 0 skipped, 0 unexpectedly green, **0 console errors**, no other runner, ceiling **11 of 600** over 194 modules in all four runs; counts unchanged at 240 / 220. — done 2026-10-18,
  commit `c667be8`

- **H68** The alias was the smaller half: three live copies of the reader, two of
  them under the other one's name. `benchlist.js` held `const code =
  uncommented;` - the weak reader under the strong one's name, with four correct
  lines above it explaining that this census wants the strings kept. Dropped
  rather than renamed: `uncommented` is called by name at all three sites and
  the two `benchCode` locals are `benchSaid`. **Then the entry's "check the
  other censuses the same way" paid for itself.** H62's grep had read every
  *call site of the two shared readers* and could not see a module with its
  **own copy**, and there were three, two jobs after the collapse that was meant
  to end them: `runnerguard.js` and `detaildrift.js` each declared `function
  code(body)`, and `grabslide.js` wrote the replace inline into `const code`.
  All three byte-identical to `uncommented`, so importing it changed no reading;
  `grabslide.js`'s `code` is `said` and `runnerguard.js`'s two `*Code` locals
  are `*Said`. `sourcetext.js` had listed four importers and has **nineteen**.
  Built: `tests/readernames.js`,
  `only-sourcetext-owns-the-two-source-readers-and-no-name-claims-the-wrong-one`,
  over every module under `src/tests/` the page loaded - **only `sourcetext.js`
  may spell either reader**, and **no name may claim the reader it did not
  get**, where a name claims one by carrying its vocabulary (`code`, or
  `said`/`says`/`prose`/`wording`) and a name claiming neither is not its
  business. Six cases through `readerProblems`, a floor of 10 claimed bindings
  against the tree's 21 of 30 in 15 modules, and the owner read for both
  spellings so a stale needle cannot make the copy clause vacuous. **The strong
  reader cannot read its own line** - its first span is a pattern over
  single-quoted text, so it strips itself - which is why the copy clause asks
  the weak reader, and why the spellings are assembled from fragments and appear
  nowhere in the file entire. Broken twice through the runner: the alias back
  reds the name clause, `detaildrift.js`'s copy back reds the copy clause while
  the name clause stays silent, which is the pair they exist as. Verified plant **240 / 1 / 8** (1,118,025ms, 1,112,357ms), yard **220 / 1 / 28** (769,615ms, 775,966ms), spreads **1%** and **1%**, 0 red, 0 flaky, 0 skipped, 0 unexpectedly green, **0 console errors**, no other runner, ceiling **12 of 600** over **194 modules** in all four runs.
  Reading: `30 reader bindings in 106 modules under src/tests/, 21 under a name
  claiming one of the two readers (floor 10) and every one agreeing, across 15
  modules`, identical in all four runs, 344-386ms. Found **H95** (four problems
  that say *"in code"* where the clause read the weak reader), **H96** (seven
  censuses walking the same tree of modules independently, H67's note) and
  **H97** (three copies of the line-local comment test). — done 2026-10-18, commit `c3a6003`

- **H67** The buffer was not full, it was four times over, and three quarters of
  every run was invisible. `no-network-beyond-the-three-cdn` had begun printing
  *"250 requests"*, which is the Resource Timing buffer's **default size** and
  not a count - nothing raised it and nothing listened for
  `resourcetimingbufferfull`. Measured with the buffer temporarily at 65,536:
  one run of one map makes **991 requests**, so **741 of them had been dropped
  in silence**, against a historical reading of 47. Nothing had broken because
  the module graph is requested first and sits at the front of the buffer - 193
  modules inside the first 197 entries - which is luck of a specific kind; what
  was genuinely exposed is the one census whose job is to see every request.
  **The queue entry's own census was stale too**: seven call sites in five
  modules, not three, every one reading the buffer for the modules that
  *actually ran* rather than guessing the import graph (F13's rule). Built:
  `index.html`'s inline script raises the buffer to **16,384** and records the
  overflow, and it has to be `index.html` because the graph that loads
  `src/main.js` is itself 193 of the requests being protected - a module cannot
  be early enough. 16,384 is the measured 991 times sixteen, and about 6.8x a
  two-run page with this check's own 193 fetches in it; it costs nothing in
  play, a buffer size being a cap and not an allocation. `tests/requestbuffer.js`
  (300) holds four clauses - the ask read as code, the flag that turns the next
  crossing into a red, the live count above the default (which the check's own
  census guarantees by fetching every module that ran, so the clause is a
  measurement), and the readers census both ways with each module's call-site
  count. Two readers instrumented, because membership is `codeOf` and the
  resource type is a string only `uncommented` can see (H62). Two defects of its
  own: the comment above the raise was written in a form `codeOnly` does **not**
  strip, so clause 1 would have passed on the explanation (H43's bite, caught by
  reading the stripper), and the census declared this module with one call site
  where it has two. Four breaks, each red on its own clause; the first
  reproduces the defect with the count pinned at exactly 250 after 193 fetches,
  and the second is the one this entry named by hand. It **unblocks H93**.
  - done 2026-10-17, `fe63333`.

- **H66** The floor is writable, the pair is the wrong shape for it, and the
  coverage objection was one-sided. D74 refused a floor on the `fed` total
  because a total has no shape; H54 built the shape and left the floor on
  **coverage**; this job was briefed to take eight readings and then write the
  pair-floor. **It put that floor to D74's own eight shaped rows first and it
  gets one wrong** - a device that died with `fed` 0.5666, the same total a
  healthy machine reads, which is the one case D74 says only a shape can
  catch. `fed` is above any line D74's arithmetic would draw there, so the
  conjunction never fires: the pair is `fed`'s 1.16x floor with a second
  condition that can only make it fire less often. **An absolute floor on the
  stretch answers all eight**, 27x clear of the worst stretch ever observed
  (2.211s, H54) and 6-14x under every fault - the multiples D74 could not get
  from a total - and it is **H92**, specified down to its constant and its one
  cost, a fifth word in `timedrenders.js`'s vocabulary, because H41's ban on a
  `size` verdict is argued about a timed *draw* and that census states it about
  any duration. **And the coverage objection runs one way only**, which nobody
  had said: `unfedWorst.ms` is bounded by two marks reading the same monotonic
  clock, so it is a *proven* unfed span and a **lower bound** - a wider blind
  spot makes it smaller, never larger, so a verdict on its size can be missed
  and can never be invented. That is the opposite of D71's case, and it means
  coverage limits a floor's sensitivity and not its safety, which H54 and this
  job's own brief both had backwards. What was built is the reading:
  `readCoverage()`, holding the widest interval between two marks against the
  loss - **1.00 of the plant's loss and 1.16 of the yard's**, 251.1s lost
  against a 252.141s gap on the plant, the same number twice - with `RESOLVED`
  (`CONCENTRATED / 10`) the line that would make the concentration a reading
  over a run, cleared by twenty times. Seven coverage cases, two `CLOCK_CASES`
  rows built from the gate's own numbers (one of which says the useful half:
  **a fault entirely inside the blind spot is still caught**, bracketed by the
  marks either side, so coverage costs *where* and never *whether*), one new
  arithmetic clause, and four breaks each red on its own clause. Found on the
  way: `timedrenders.js` called the reach one *"a job could widen"* and carried
  two stale numbers, and the first draft of the new reading told a probe with a
  millisecond window that its blind spot was fine. **H93** is the ceiling this
  cost - 548 to 636 to 597, and the cluster is twelve.
  - done 2026-10-17, `63bb8a6`.

- **H65** The suite's densest block of marks was landing after the journal was
  read. The device journal is handed one mark per drawn frame and the rAF loop
  drives none under the AUTO suite (F4), so its window covers exactly the
  checks registered before the one that reads it - and
  `tests/performance.js`'s **210 frames**, the densest block in the suite and
  the only one dense enough to resolve a stretch to the frame, were registered
  *after* the read. Two lines swapped, and the order is held by a clause now
  rather than described by a comment, because the **import** order says the
  opposite and is not the registration order (the half-hour H54 paid). Three
  clauses - the two calls in the order the window needs, the unlock still
  before both, and a parse required to have seen a registration order at all -
  and three breaks, each red on its own clause. **The second break was green
  the first time and that is the lesson**: it moved the unlock to the line
  *above* the feeder, which satisfies the clause instead of breaking it, and
  only the detail line said so. Found on the way: the queue's 84-of-86 was
  H54's and the registrar makes **93** calls today, and
  `tests/registry.js`'s own census carried a sentence saying the opposite of
  what the code now does - H71's shape, in the one file whose subject is the
  registration order, corrected in the same diff.
  - done 2026-10-17, `21ad8b0`.

- **H60** A census whose headline counts one set and whose tally counts
  another. `breathcensus.js` ended every run since H33 with *"15 pose a body: 2
  held at the worst phase, 4 measured, 6 out of reach by proof"* - and every
  fact in it was right: the fifteen is every module the **tree** was found to
  drive `updateVisual` in, the twelve the table **declares**, and the three
  between them are the census modules `OWN_FILES` excludes by name because a
  census that declares itself is a census of one thing. The sentence still
  invited one subtraction and got it wrong, which is **H50's finding in a
  sibling**. It names the difference now, every number in it comes off the
  array it is about, and `tests/censustally.js` holds both sums for the four
  censuses that have one. **The other four were read for the same fault and are
  three other shapes** - two take their parts off one table with a `filter` on
  a word nothing validated, one sorts four ways and prints three with the
  fourth held empty (`14 + 0 + 13 + 5 = 32`, measured), one prints a named part
  of its total and wanted nothing, and `donedef.js`'s derives its part by
  subtraction and cannot disagree. Five breaks, each red on the clause it was
  aimed at, the second of them **H60's own defect restated** - the parts put
  back to the narrower set, *"the line counts 12 of 15 - 12 declared"*. Found
  on the way: `breathdrawn.js` was the one table of three that already refused
  an undeclared word, so the sum is the new half there; and the pose census's
  line is **516 characters of a 400-character cut**, which is **H91**.
  - done 2026-10-17, `640e040`.

- **H59** A strike's success is not a function of its argument either, and the
  thing that was wrong was not the skip. The entry suspected the 0.3 m/s a
  `stand()` leaves behind; **the cause was the Warden and H57 had already named
  it** - `strike` walks a real Shade several metres down a lit lane in a live
  match, a hunting Warden lands four rounds, and a dead body does not
  accelerate, so the strike reports a gait that never swung. H57 gave
  `strikerepeat.js` a fresh `ai: false` match before **every** strike and the
  other three callers had always opened one, so the exposure is gone from all
  four by construction - measured, not assumed: **12 of 12 states struck on six
  consecutive runs of each map** through a probe and on all four runs of the
  H81 verify. **Which leaves what was actually worth fixing.** Of the four
  callers, `look.js` and `poseeye.js` made a refused strike a **problem** and
  `strikerepeat.js` and `positioncensus.js` printed it as a **reading** - *"2
  not on this map"*, *"N unreachable"* - so **the same event was a red in half
  the suite and a passing detail line in the other half**, and a passing detail
  line is invisible without `--details`, which is why the original report was
  queued as a mystery instead of caught as a failure. A state that cannot be
  struck is a fact about the map, in which case it is declared with its reason,
  or a defect, in which case it is red; there is no third thing and a green
  line was the third thing. `CANNOT_STRIKE_HERE`, `NOT_A_STATE` and
  `refusalProblems()` in `strikedrive.js` are one table and one rule for all
  four: a refusal nothing declared reds, **and** a declaration nothing refused
  reds, so the table cannot outlive its reason, and a map with no row at all is
  its own problem. **Both lists are empty, which is the finding and not a
  placeholder.** The instrument, because a clause over two empty lists is worth
  nothing: `strikerepeat.js` strikes a name no `case` dispatches and reds if it
  comes back reached. Three breaks - a stale declaration and a staged refusal
  red **both** censuses, and the refusal path made to report success reds the
  one that holds the instrument and correctly not the other.
  - done 2026-10-16, `37e2270`.

- **H81** Should `quiesce()` name a seed? Yes, and the measurement that said
  so found a defect nobody was looking for. H80 censused the settle by
  **distance** and found two classes a map; H81 censused it by **pose** - where
  the body ended *and which way it faces* - because H80's turn is an absolute
  value, so a Warden that turned 1.1333rad left and one that turned 1.1333rad
  right are one row in that table and two different bodies in a photograph.
  Over 400 seeds a map the plant has two poses (383 at 0.000000m/yaw 1.2229, 17
  at 0.368476m/yaw 3.4895) and **the yard has three**: 363 at 0.000000m/yaw
  2.0083, 15 at 0.836667m/yaw 3.1850, and **22 at 0.000000m/yaw 4.2749** - on
  its spawn to the micrometre and facing **130 degrees the other way**, which
  H80's census counted with the majority. **One yard run in eighteen
  photographed a Warden a third of a turn from the one the other seventeen
  photographed and nothing in this suite could see it.** A census is only as
  fine as the quantity it groups by, and H80's grouped by the quantity its
  flake had happened to move. **H77 made the decision cheap**: the settle
  depends on the seed only through the seeded stream, and H77 had just
  enumerated every draw from it - over twenty frames with no engagement the
  only one that fires is the circuit shuffle, so the circuit is the whole of
  what a seed pins. `SETTLE_SEED = 20261016` in `pixels.js`, passed by the call
  **and the restore** (H57's reason, held as a clause), landing in the dominant
  class on both maps; `settlecircuit.js` drives 48 seeds, groups by pose and
  reds if the constant is not in the biggest group, so a map whose waypoints
  move cannot leave thirty callers on an outlier in silence. **A removal, not a
  move**: the dominant class is the picture 96% (plant) and 91% (yard) of
  unseeded runs already took, so no floor needed re-setting and none was
  touched. Two breaks, and the first is the finding: `SETTLE_SEED = 4` - the
  yard's invisible class - reds the pose clause while **the first draft of
  `quiesce.js`'s bar stayed green**, because it compared the distance and the
  distance is zero in both; that is the old defect reproduced inside the fix,
  caught by its own break, and `quiesce.js`'s bar is a pose now. Verify four
  runs exit 0, nothing red or flaky, and **H79's drift fell 33 to 32 on the
  plant and 36 to 34 on the yard**, with `quiesce-says-what-it-does-about-the-
  ai` leaving the list on both. The twelve one-frame sites did not leave it,
  which is right: their drift is the breath, every run. All 31 caller ids
  re-read with `--details`, 27 green a map, every reading inside its H79 band.
  - done 2026-10-16, `eb6335c`.

- **H77** The rng is a candidate channel, and it turned out to be real and
  almost never open. H74 proposed a live AI's draws as the reason its pixel
  readings moved and withdrew it; H79 showed ten of the eleven drift on their
  own. Settled with a counter instead of pixels, and the counter the entry
  named could not do it: `debugState.rngCalls` is zeroed by every `initMatch`
  and written only on a **render** frame, and a check that steps the world
  renders nothing. So `rng.drawn` and `lookRng.drawn` are the page's totals
  beside `calls`, the match's, and no reseed touches them; `recordStepDraws`
  splits each step's draws by whether the AI drove it; `_runOne` records the
  three per check and the report prints which checks had a live AI spending
  the stream underneath them. **Three readings, both maps.** A match opening
  spends exactly `circuit.length - 1` on the shuffle - **19 of 20 nodes on the
  plant, 20 of 21 on the yard** - and nothing else. A live patrol over 3,600
  frames spends **4, 4 and 2 (plant) and 5, 3 and 2 (yard)** at three seeds,
  every one a single draw at the frame the Warden arrives at a node; at seed
  12345 the first is frame **523** of the plant and **59** of the yard. The
  same frames with the AI off spend **0**, both maps, both seeds, the look
  stream 0 beside it. **So the channel is open about one frame in twelve
  hundred**: the eleven sites that step before they grab step one to fifteen
  frames, so a little over one percent of runs, and the twelve that step none
  cannot be touched - which closes H74's hypothesis rather than confirming it,
  because a one-draw shift one run in eighty cannot move a reading every run.
  **The clause is a census, because a rate measured this morning is not a
  rule** (H71, H74): every draw from either stream outside `config.js` and
  this suite is one of **23 declared sites in three files**, each carrying the
  decision it is - nine on the simulation's stream (`ai.js` 6, `combat.js` 3:
  a circuit, a pause, a burst's length and its gap, two halves of an aim, a
  round's recoil and the two halves of its spread) and fourteen on the look
  stream (`effects.js`), with H27's layering rule finally checkable because
  both sides are enumerated. Four breaks, each red on one clause, each through
  a probe at 445ms: a reseed zeroing `drawn`, the ledger crediting an
  AI-driven step to the quiet bucket, a row taken out of the table, and
  `rng.next()` added to `detection.js`. - done 2026-10-16, `cdc3f7a`.

- **H79** A reading that drifts while passing, and the three kinds of number
  it turns out to be. `flaky` compares **verdicts**, so a check could answer
  19,228 pixels on one run and 19,260 on the next and the suite would say
  nothing. `scripts/detaildrift.mjs` (167 lines, no node builtin so the page
  can import it) splits a detail line into prose and numbers, answers
  **`same` / `numbers` / `wording`**, and carries with a `wording` verdict how
  much of the two lines is a **common prefix** - because the 400-character cut
  (H42) makes two lines that said the same thing part company at the very end
  when a number upstream gains a digit. `judge()` reports it per map beside
  `spreads`, `summary()` prints one line a map and one a check, and **it is a
  reading and never a verdict** (D48): the new check reads the runner's own
  `const ok = ...` line and reds if drift is ever in it.
  **The first draft was wrong and the data said so.** It ate a leading minus
  and left a leading plus in the prose, so `glove-lip +0.066` against
  `glove-lip -0.012` - one reading on either side of zero - came back as *the
  wording differs*, and the clearest drift in the suite went unmeasured. A
  sign is part of the number; the pair is written out in the check.
  **The census is not ten. It is 32 of 236 on the plant and 36 of 216 on the
  yard**, and H74's ten are all in it - the 25m silhouette at 347 then 359 is
  H74's own number to the digit. Three classes, and naming them is the
  deliverable: **thirteen deliberate absolutes** (a clock, a frame index, an
  elapsed total - two runs share one page and must disagree; `a-lens-grab-...`
  reads frame 216 then 675 and H76's entry already says so); **seventeen
  weather** (a pixel reading at whatever phase of the breath and gait the run
  arrived in - and the two H74 called built-to-be-stable are in this class and
  only just, `a-small-window-...` holding its reference 351px while two of its
  five buffers move a pixel, and the breath checks' *worst* holding while
  their eight per-phase samples rotate); and **two counts that should not
  wobble**, which are the pins.
  **Those two are H84 and H85.** The crossing count is **one crossing from
  red** and H75's record of it is wrong in a way that matters - it had the
  plant, "reproducibly, on two different trees", and this census has the plant
  at 2 and 2 and the **yard** at 3 then 2, so it is a coin and a pin written
  against the plant pins the wrong map. And the widest row on both maps is not
  drift at all: `the-last-leg-...` prints `tails in -1 segments`, because
  nothing floors `route.length - Math.max(0, tailStart)` and only the other
  sign of it is guarded - **a green check printing a negative count, which no
  instrument in this suite could see before this one**.
  Three breaks, each red on its own clause, each through a probe at 43ms a run
  against 2.5 minutes of subset: the sign fix reverted, `drift` computed and
  left out of the report, and `ok` taught to read it. And two of the check's
  own expectations were wrong before the module was - the sign pair moves
  three numbers and not five, and `1280x720` is two numbers.
  **And the first verify was red on a census the trap list does not name**:
  a new module under `scripts/` is a row in H64's flag census as well as in
  the four under `src/tests/`, so `/scripts/detaildrift.mjs` had to be
  declared as reading no flags - the census working as built, and a whole
  verify to learn it. `TRAPS.md` names the check now.
  — done 2026-10-16, `3b6f17f`.

- **H78** A check that puts the Warden somewhere asserts it is still there.
  `the-death-camera-frames-the-killer` resets the Warden to a spot 2.5m from
  the Shade **because the camera must have a killer to frame**, and then read
  the frame without ever asking whether the body it framed was still that spot.
  The clause is three lines: `mark` is named once and handed to `reset()`, each
  of the three grabs records `Math.hypot` of the horizontal offset from it, and
  the worst is held to **`ON_ITS_MARK` = 1e-6m**. Horizontal because the only
  travel `reset` leaves is the 2cm it sets the capsule above the floor, which
  is all in y (H74).
  **The tolerance is an exact zero rather than a band, measured before it was
  written.** A probe drove the check's own setup on both maps and read the
  Warden at the reset, after the five steps, after the warm frame, after the
  death and at each of the three grabs: **0.000000m at every one of them**, on
  both maps, with the whole 0.019m of travel in y.
  **The break is the AI put back on, and the result is the job's point**: it
  reds at **0.135427m** on both maps - and it reds on the **new clause alone**.
  The pixel floor and the centring clause stayed green, because the death
  camera follows the killer wherever it goes, so the old check really would
  have passed on a body somewhere else. That was the entry's claim and it is
  now a measurement.
  **And the measurement refused the entry's mechanism, for the fourth job
  running.** The entry carried H73's headroom - four frames on the plant - and
  the yard's seventeen implies this check was safe there. It is not: H73's
  numbers are about a Warden on its *spawn* at the start of a match, and this
  one is teleported into a patrol thirty frames old, so it translates on frame
  **one**. 0.0926m after five steps, 0.135427m after six, **the same to ten
  significant figures on both maps**, because the travel is the walk ramp times
  the frame count and has nothing of the place in it. **H82** is the header
  that says otherwise; **H83** is the census of the shape.
  Counts re-read as the entry asked, both runs of each map: the killer covers
  **50,942 / 50,977 pixels on the plant** and **90,182 / 90,215 on the yard**,
  bracketing the 50,951 / 50,977 the `quiescesites.js` header quotes for the
  plant with the AI off. The new number is **identical in all four runs**,
  which puts it with `settlecircuit.js`'s and `grabworld.js`'s and against the
  ten H74 found drifting - while the same check's ragdoll travel is one of the
  ten (3.03 / 3.87 and 2.35 / 2.71). That band is H79's and this job did not
  touch it.
  — done 2026-10-16, `7241a06`.

- **H76** The sentence twelve checks rested on, and the break that only trips
  half of it. `lens.grab()` renders, reads the framebuffer back and **advances
  nothing** - the whole argument for leaving H74's twelve one-frame sites alone,
  and it lived in `quiescesites.js`'s header where the sites census
  **structurally cannot see it**, because that census reads the *caller's*
  source and never the helper's. A `grab()` that grew a `stepFrames` would have
  made twelve classifications wrong in silence.
  **The clause** is `a-lens-grab-advances-neither-the-clock-nor-the-picture` in
  a new `src/tests/grabworld.js` (235 lines). It reads what `grab()` may call
  off `pixels.js`'s own body - sliced out of the object `createLens` returns,
  with the forbidden names a **list and not a regex literal**, which is the trap
  `quiescesites.js`'s header names - then takes **three grabs in a row** in the
  live match the helper leaves and holds the clock (`frame`, `wall`, `sim`), the
  Warden (**0.000000000m and 0.000000000rad**) and the picture (**all three
  identical over 3,686,400 bytes**). The picture's control is a **second eye**:
  the same lens looked 7m higher differs by **2,440,586 bytes on the plant and
  2,562,024 on the yard**, which proves the comparison can see a difference and
  advances nothing to prove it - *the two pictures are the same* passes just as
  well when the comparison has gone blind.
  **And the measurement split the sentence in two, which is the result.** The
  entry asked for a clause that goes red when a `stepFrames` is put inside
  `grab()`. Measured first: **a frame stepped between two grabs leaves the
  buffers byte-identical**, 0 of 3,686,400 on both maps, because what moves the
  drawn body is `updateVisual` and stepping the simulation is not that. So
  *advances nothing* is **two guarantees with two detectors**, and the break
  reds the **source** and **clock** clauses - *"clock.sim 1.4166666666666665 to
  1.4666666666666663, the Warden turned 0.170000000rad"* - and leaves the
  **picture** clause green. A clause written as *the two pictures are the same*,
  which is how the sentence it holds is phrased, would have passed the exact
  mutation it was written for. In TRAPS.md; and 0.170rad over three grabs is
  three frames at H73's 0.0567 rad a frame, to the digit, so the break
  re-measures H73 for free.
  **The header says which world the grab is of now** (H80): the grab advances
  nothing, so the world at it is the world `quiesce()` returned, and that world
  is the Warden on its spawn for twenty circuits of twenty-one and **0.368m**
  (plant) or **0.837m** (yard) off it for the twenty-first, about one run in
  twenty-four. The twelve are safe in the sense this file means; the thing the
  helper left is not always the spawn their prose assumes.
  **Every number the check asserts is identical across both runs of both maps**
  - 0 bytes, 0.000000000m/rad, the same second-eye figure to the byte - which
  puts it with `settlecircuit.js`'s and against the ten H74 found drifting. It
  costs 4.1s on the plant and 3.4s on the yard. The clock's absolute values are
  reported and move (frame 216 then 675); what is asserted is that three grabs
  did not move them.
  — done 2026-10-15, `7571d08`.

- **H75** Two jobs in one file, and the number the job is actually about.
  `src/tests/animation.js` was E3's two checks **plus** `strike` - the driver
  `look.js`, `poseeye.js`, `positioncensus.js` and `strikerepeat.js` all import
  - and had been at 592 of 600 since H72. The driver is
  `src/tests/strikedrive.js` now (**327** lines) with `STRIKES`, `GAIT_STRIKE`,
  `frame`, `frameUntil`, `climb`, `hurtMidStrike`, `SETTLE` and the three
  paragraphs arguing that a strike is a function of its argument;
  `animation.js` is **309** and is E3's two checks again. `alongLane` had been
  imported there and never used. **The seam was not prose** - H69's kind of
  length is an argument that can move to the thing it is about, and this was two
  unrelated jobs in one module, for which the cheap test is *does anything
  import the second half?*
  **The move cost exactly three hand-written file names and all three announced
  themselves.** Nothing else knew where `strike` lived, because the import graph
  is machinery and the proxy criterion is read off the tree. (1) **Two clauses
  in `strikerepeat.js`** read `strike`'s own source - that the three lines
  pinning the gait are present and the `Math.abs` mirror read absent, and that
  the killed-body sentence is still carried - and both went **red on both maps**
  naming the moved mechanism in their own words: *"or the mechanism has moved
  and this clause wants rewriting with it"*. H62's string rule working. They
  read a `DRIVER_FILE` constant now instead of a path in two fetches and two
  messages. (2) **`breathcensus.js`'s guard**, which required `animation.js` to
  contribute a proxy, because a discovery that stops seeing `frame` and `strike`
  drops three real members of that census in silence (H53). It is `PROXY_HOME`,
  and it lives in `posecriterion.js` with the rest of the criterion. (3) Prose,
  in `grabslide.js` twice, `look.js` once and `posecriterion.js`'s proxy table
  and two test vectors.
  **And the thing the job nearly shipped having not done.** After the split
  `animation.js` was 309 and the runner still printed **12 modules within 50 of
  600**, the same number as before: `PROXY_HOME` and its comment took eleven
  lines in `breathcensus.js`, which sat at **550**, one line outside the
  cluster, so one module left and another walked in - against a deliverable
  which *is* that number. Moving the constant to `posecriterion.js` (331) was
  the better design anyway and the count is **11**, the first fall since H56.
  **Read the runner's `ceiling:` line after the edit, never the split file's
  `wc -l`.** In TRAPS.md, with the threshold that makes it bite: within 50 of
  600 is **551 and up**, so 550 is outside by one line.
  **The equivalence bar in the entry could not be met as written**, and H74 is
  why: "byte-identical detail lines" is impossible for checks that answer
  differently between two runs of one map on any tree, which ten of these do. So
  the baseline was **both runs of each map** - free from `--details` - and each
  check held against its own spread. **14 of 24 readings identical character for
  character**, including all four strike-driven geometry checks, both
  `strikerepeat.js` clauses and the two source censuses; the other ten already
  drifted and every one landed inside its band, the worst being the plant's
  grab-slide photograph at **6px of movement against a 216px spread of its
  own**. The breath census proves it from the other side: its proxy list reads
  `strikedrive.frame, strikedrive.strike` off the tree over 100 modules where it
  read `animation.frame, animation.strike` over 99 - five names, same
  membership, new address, nothing maintained by hand.
  **Found, for H79**: `the-warden-walks-heavy-and-raises-the-rifle-to-where-it-looks`
  reports 3 leg crossings on the plant's first run and 2 on its second,
  reproducibly on both trees - a *count* disagreeing with itself in a geometry
  check, one crossing from its bar, invisible to `flaky`. H79's entry carries it.
  — done 2026-10-15, `08f5f62`.

- **H80** The thing being inherited was the clock, and the circuit was
  innocent. H74's third verify left `quiesce-says-what-it-does-about-the-ai`
  flaky - one of two yard runs read a Warden that had translated **0.836667m**
  against a bar of 0.000001m and turned **0.0435rad** against 0.05rad - and the
  entry read that as a dependence on what had run before the check, naming the
  patrol **circuit** and the rng stream position at the moment it is drawn as
  what was left to rule out. **Both are innocent, and one grep ruled them
  out**: `initMatch` calls `rng.reseed()`, which zeroes `rngState.calls`, and
  nothing between that and `rng.shuffle(this._circuit)` in `ai.reset()` draws
  from the stream - `createMatchState`, `shade.reset`, `warden.reset` and
  `detection.reset` contain no `rng` reference at all - so the shuffle is
  always a match's first draw and the circuit is a function of the seed alone.
  **The seed is the wall clock.** `deriveSeed()` returns `Date.now() >>> 0`
  when the URL names no `?seed=`, the suite names none, and `initMatch` calls
  it every match: the first probe printed eight successive seeds 1099333811,
  ...812, ...813 with `_circuit[0]` moving with them. Nothing is wrong with
  that - a new match should draw a new patrol order - and it means the asserted
  reading was taken in whichever circuit the clock had just handed it.
  **The census, driven once per seed over 400 seeds a map, has exactly two
  readings:** yard **385/400** at 0.000000m and 1.1333rad against **15/400** at
  **0.836667m and 0.0435rad**; plant **383/400** at 0.000000m and 1.1333rad
  against **17/400** at **0.368476m and 1.1333rad**. In **all 32** of the
  walking readings the circuit's first node is **node 1**, which on both maps is
  the node the Warden's spawn is already facing - a Warden with nothing to turn
  walks. `0.0435rad` is H74's failing detail line to four places, so the
  mechanism is the same reading rather than an inference, and the rate is 3.75%
  a run on the yard and 4.25% on the plant: about one red in seven full
  verifies, against H74's one failure in twelve runs. **And the plant's half had
  never been seen**, at the higher rate, because there the Warden turns the full
  1.1333rad *and* walks and so trips the position bar alone where the yard's
  case trips both - a flake observed on one map is not a one-map flake.
  **The fix is to name the seed, and no bar moved.** Two bars rested on *the
  settle leaves the Warden on its spawn*, true of twenty circuits of twenty-one
  and never established by the check that leaned on it - the A1/A3 shape, with
  the clock as the somebody else - so `whatTheSettleDoes` takes a seed from the
  new `tests/settlecircuit.js`, whose census drives the settle per circuit and
  hands back the first that only turns. 1e-6m and 0.05rad are unchanged and are
  now asserted about a circuit the check chose. **The third bar could not be
  pinned and should not have been**: `wardenSettled` reads the live `quiesce(h)`
  call, which asks for no seed exactly as all thirty callers do, so "on its
  spawn" is **false** of it one run in twenty-four, and a false bar is not fixed
  by pinning what it measures. It asserts instead that the distance is one the
  census **accounts for** - an unaccounted distance being a settle no circuit
  explains, which is what the old bar was really for - and the detail line names
  the node the clock drew and its class.
  **The new check**, `the-settle-is-a-function-of-the-circuit-and-the-clock-draws-the-circuit`,
  holds three things over seeds 1 to 48: that two seeds drawing the same first
  node settle to the same metre and radian, which a wall-clock read or an
  unseeded draw under the settle breaks and nothing else here does; that at
  least one circuit leaves the Warden on its spawn, the premise twelve one-frame
  sites rest on; and that at least one does not, which is the finding and may
  not quietly empty. **Forty-eight** because the first walking circuit is seed
  26 on the yard and **36 on the plant**, so a scan stopping at 32 reports an
  empty class on the plant and calls it clean. It costs 19ms on the yard and
  23ms on the plant, and both censuses read identically to the 400-seed probe.
  **The break**: the walk gate in `ainav.js._followRoute` widened from
  `Math.PI / 3` to `Math.PI`, so the Warden never turns on the spot, reds both
  checks with the sentences they were written for.
  **And the method note, because it is what made this cheap.** The entry handed
  this run a hypothesis and a 28-second reproduction; the reproduction **did not
  reproduce** - the real check eight times in a fresh page passed 8/8, iteration
  0 included - and that was the finding, because a failure that moves with the
  clock does not depend on its predecessor. H74's rule that a before-and-after
  is worth nothing until the quantity's spread is known is the same rule about a
  *reproduction*. The instrument that answered it was a 400-seed scan in
  **205ms**. **H81** is what follows, and **H77 is half answered**: the rng is
  no longer a candidate channel into the pixel band but a confirmed one.
  — done 2026-10-15, `c8d4b0c`.

- **H74** Eleven sites that owe themselves a quiet Warden, and a band nobody
  had measured. H71 counted twelve
  modules that call `quiesce()` and never open a match of their own and asked
  whether a walking Warden could be in their frames; H73 sharpened it to the
  frames each one drives against four of headroom on the plant and seventeen on
  the yard. The unit that answers it is a **site** - the span from one
  `quiesce(h)` call to whichever comes first of the next one, the next
  `registerAutoTest(` and the end of the file - because `visual.js` holds five
  and they differ, while two sites live in exported helpers a registration-only
  reader would never see. **Thirty-one sites in three classes, all derived:**
  **14** step the simulation and then read the framebuffer (and **11 of those 14
  did not say so** - one `initMatch({ ai: false })` line each, with `mode`,
  `role` and `objective` exactly as `quiesce` passes them), **12** grab without
  stepping a frame and are left alone because `lens.grab()` advances nothing, so
  a static Warden cancels out of a toggle difference, and **5** read no frame.
  **Then the eleven were measured rather than argued about, and the measurement
  refused the question.** Run through the real runner on both maps with and
  without the AI, most detail lines moved by a few pixels in a few thousand -
  and read across the **two runs of each map on one tree**, **ten of the eleven
  answer differently anyway**: 19,228 or 19,260 body pixels on the plant, 18,654
  or 18,974 on the yard, a 25m silhouette of 347 or 359, a smoke cloud of
  794,510 or 861,269. HEAD's own `visual.js` and `outline.js`, restored from a
  `cp` snapshot and run twice, give the same band, so **it is old and not a
  regression**, and the mechanism is already written down: the breath advances on
  the **wall clock of the render frame** (H31, H33, H40). So every A/B delta is
  inside that band or comparable to it and **nothing in it is attributable** -
  the first draft of the entry said nine readings moved because of the Warden,
  on one run of each condition, which is the mistake H43's rule exists to
  prevent pointed at the instrument instead of the subject. **One exception, and
  it is the one worth having:** the death camera's killer covers 53,813 /
  53,827 / 53,851 pixels with the AI live, a band of about thirty, and 50,951 /
  50,977 with it off - **2,870 pixels, two orders of magnitude outside the
  band** - because that check resets the Warden 2.5m from the Shade *because it
  wants it in frame* and then steps fifteen frames, valid for four of them.
  **So the rule rests on what a check guarantees and not on its pixel counts**,
  which is where it should have rested: a site that steps the world after a
  quiesce has a Warden in its frame at a position it never states. The drift is
  **H79**, and it matters more than this job did: `flaky` compares **verdicts**,
  so a reading can drift twenty percent and stay green.
  **Displacement off the spawn, horizontal, four passes a map:** plant 0 / 0 / 0
  / 0.025 / 0.222 / 0.465 / 0.699 / 1.148 / 2.356m and yard 0 / 0 / 0 / 0 / 0 /
  0 / 0.083 / 0.560 / 3.000m at 1, 2, 3, 5, 10, 15, 20, 30 and 60 frames; the
  first moving frame read 4, 4, 4, 4 and 17, 17, 17, 17, tighter than H73's own
  probes. A 3D hypot read 0.05m at frame 1 on the yard and 0.000m at frame 5,
  which is the ground snap in `y` and not a body - a displacement about a
  settling body is horizontal or it is noise. The clause is
  `a-check-that-drives-the-world-after-a-quiesce-owns-the-warden` in a **new
  module**, `tests/quiescesites.js`, because the check written inside
  `quiesce.js` put it at **604 lines** and the subject is the other one anyway -
  that file holds the helper's sentence, this one holds its callers. **Two
  self-exclusions a source census needs:** the site pattern is built from
  `HELPER` rather than written as a literal, because `codeOf` strips strings and
  leaves a regex literal where it is, so a pattern spelling `quiesce(h)` is a
  site in its own census - and the first draft's literal `/renderFrame\(/` put
  that identifier in this module's code and reddened
  `every-check-that-poses-a-body-...` with *"quiescesites.js renders a frame"*,
  correctly by its own rule. The names are a list now, which says what is true.
  **H52's seventy minutes paid in two**, because TRAPS.md's recipe - run the four
  censuses as a subset before the verify - was run first. Three breaks, each
  naming its own clause: a line removed names `visual.js:326` and nothing else,
  the driver reader blinded trips its own two vectors and the empty-class
  clause, and the lookbehind removed makes `pixels.js:296` a site.
  — done 2026-10-15, `678722c`.

- **H73** The margin was not a wait, it was a turn. H71 left the Warden sitting
  **0.000m** off its spawn when `quiesce()` returns and explained it as the AI
  being slow to wake - twenty-five frames to start walking against a settle of
  twenty - with a five-frame margin nothing watched. Measured one frame at a
  time, four passes a map: **the AI is awake on the first frame and what it does
  first is turn.** A patrol's first act is to face its first route node, so the
  Warden rotates a flat **0.0567 rad a frame** from frame 1, `state` reading
  `patrol` throughout with no pause timer in it, and translates **nothing** until
  it is round. The angle is map data, so the frames are too: the plant's first
  node is **1.83 rad** off its spawn nose and the body first moves on frame **4
  or 5**, the yard's is **1.13 rad** off and it first moves on frame **17**;
  over the twenty frames the helper settles the Warden turns **1.1333 rad** on
  both maps, twenty times the per-frame rate to the digit, and translates
  **0.000000m**. **So the mechanism is pinned and the margin is not**: an exact
  frame is map data *and* unstable within a map (two probes of the plant read 4
  and 5, the crossing falling near a frame boundary), while what twelve callers
  actually lean on - the yaw moves and the position does not - is exact. Both
  halves asserted in H71's check, neither alone being enough (a body that has
  not moved might be a body nobody is driving; a yaw that moved might belong to
  a Warden already walking), the first moving frame reported per map, and the
  settle count **read off `pixels.js`'s source** so that a helper which grew its
  settle past the turn is driven as it really is - not D70's vacuous shape,
  because the bars are a distance of zero and a turn and only the frame count
  comes from the tree. H71's hand-written `SETTLE_FRAMES = 20` is gone with it,
  which was the copy this job existed to find. Two breaks, each naming its own
  line: a **sixty-frame** settle puts the Warden **1.622576m** into its patrol
  and reds both clauses at once, and the settle driven with the AI off reds the
  turn clause. The docstring now says the mechanism rather than the effect, and
  H71's "five frames" is **three to four on the plant and sixteen on the yard**.
  — done 2026-10-14, `bb82665`.

- **H72** A strike that was shot reports being shot, and the sentence H57
  chased for an afternoon. Every `why` `strike()` reports is about what the body
  did not *do*, and it drives a real Shade through a live match where four
  rounds kill her - so a Shade shot dead in the run-up came back as *"the walk
  never swung a leg (speed 0.0)"*. One question at the top of `done()` asks
  whether the body is still alive, and the report is now *"the Shade was killed
  during the strike (health 0 of 100, ragdolled); the walk did not bring a leg
  furthest forward ..."*, the death first because it is the cause and the
  symptom kept behind it because a dead body may have failed for a second
  reason too. Two wordings - *killed* for a body the ragdoll has, *shot* for one
  with rounds in it and still standing - because a reader given only a health
  number cannot tell which they have. **The death is driven and not waited
  for**: a `sim:step` listener counts twenty steps into the strike and lands a
  round through `combat.applyDamage`, the public door onto the very `_damage`
  the rifle calls, with `combat:death` as the evidence it went through combat
  rather than into a field, in `fresh()`'s match (`ai: false, objective:
  false`) so nothing else shoots and no reinsert revives her, and with god mode
  forced off and put back because `_damage` is a no-op for the Shade while it is
  on. A Warden cannot be asked to kill on cue and a clause that waited for one
  would be flaky on a slower machine, which is the thing H57 was bitten by
  rather than a way to test for it. The control is the half that makes it mean
  anything: the same strike with nobody shooting reaches the walk, leaves her at
  100 of 100 and names no wound. Four breaks, each reverted and each naming its
  own line - the fix reverted, the death **appended** instead of first (red on
  the ordering alone), the health dropped, and the `shot` branch reworded. The
  third of those **found a hole**: one pattern for both wordings stayed green
  while the `killed` half was gutted, because the `shot` half still matched -
  and the `shot` half has **no runtime case in this suite at all**, so both are
  now asked for by name, which is `posecriterion.js`'s rule for a clause about
  something nothing can drive. And one mistake of its own: the first source
  clause asked the module for the *rendered* sentence and went red with the
  sentence sitting there, because a template literal and the string it renders
  are not the same text (H53's class). — done 2026-10-14, `655d513`.

- **H71** The sentence a dozen checks trusted, and the five frames that made it
  harmless. `quiesce()` in `tests/pixels.js` opened *"Put both actors somewhere
  harmless and stop the AI interfering"* and its body asked `initMatch` for
  `ai: true` **twice**, once on the way in and once in the restore - so the one
  helper whose stated job is to take the Warden out of a measurement handed back
  a match with a live one in it, which is what shot the Shade dead in the middle
  of H57's strike. **The entry's second option, taken for a measured reason**:
  at the moment `quiesce` returns the Warden is **0.000m** off its spawn on both
  maps, because the AI takes about twenty-five frames to start walking and this
  settles twenty, so passing `ai: false` would have changed what thirty calls
  measure in exchange for a comment. `tests/quiesce.js` (337) holds the sentence
  against the flag: the flag read off the source as **code**, the sentence
  sliced out of the comment directly above the body and read as **prose**, each
  required to name the other's answer, and the table **keyed by the flag** so
  that flipping the body swaps which reading is demanded. It is the one clause
  in this suite whose subject really is a comment, and the division is
  load-bearing rather than tidy - the corrected sentence names the flag it
  passes, so a reader that kept the prose would count that mention as a third
  flag and read a disagreement as agreement. A banned phrasing is banned
  outright, **negated or not**, because no line-local reader can see a *not* in
  front of a claim. Plus the behavioural half: `aiEnabled` after the call and
  after the restore, and the Warden's own body - 9.9m, 12.7m (plant) and 15.3m
  (yard) over 420 frames with nothing held, against **0.000m and 0.000rad**
  every time in a control match this check starts with `ai: false` itself, moved
  **or** turned because a live AI pauses two to four seconds at every node of
  its circuit and there is no number of frames in which it must have walked.
  Four breaks, each reverted and each naming its own line, the third of them the
  one worth having: both flags flipped with the sentence untouched went red with
  the **`false` row** applied, which is the proof that the table is read off the
  tree rather than reciting today's wording. The entry was wrong about one
  number for the fourth time in this block - three callers is **twenty**, and
  twelve of them name `initMatch` nowhere - which is **H74**; the five-frame
  margin is **H73**. — done 2026-10-14, `e8a2296`.

- **H64** The flag census reads the tree, and the seven flags nobody had
  decided about. `FLAGS` was four runners and twenty-seven flags typed out by
  hand: anything on the list was held against the runner's own source and
  anything off it was invisible. **Both ways it could be wrong, it was.** Five
  of the nine `.mjs` files under `scripts/` were outside the census altogether
  (`watchdog.mjs`, `version.mjs`, `suitereport.mjs`, `args.mjs`,
  `headless.mjs` - the entry named two of them), and seven flags on two
  censused runners were missing from the table, among them the suite's
  `--allow-other-runners`, which is the flag `TRAPS.md` sends every reader of
  an exit-3 refusal to. **All seven were already read through `one(...)`**, so
  every one of them already refused a second value and **no runner's behaviour
  changed** - the tools were right and the list was wrong and nothing could
  tell, which is the argument for this job in one sentence. The page cannot
  list a directory (`/scripts/` is a **404**, measured first), so the runners
  are derived from `package.json`'s own commands plus the `from './x.mjs'`
  graph - **five commands reach all nine files** - and each module's flags from
  its source: `args.<name>`, `args['<name>']`, `scalarArg(args, '<name>')` and
  `one('<name>')`, four patterns because a flag read only through its reader
  never appears as `args.<name>` at all. Read from `said` and not `code`, which
  is H53's division, with `NOT_A_FLAG` holding the four names that look like a
  flag read and are not - `_` for the positionals and `mjs`/`js`/`json`,
  because `from './args.mjs'` is a string and survives there on purpose. Every
  clause is now both ways, and the crawl has an instrument of its own: a graph
  walk that reached no more than its entry points is a hand-written list
  wearing a derivation. **Two clauses were scoped rather than widened** - the
  parser import and the `REFUSED:` sentence are asked of a module that reads a
  command line, because five of the nine read none and demanding it of them
  reds on the day the census grew rather than on the day something broke. Four
  breaks, each reverted and each naming its own clause, including the one the
  entry asked for by name: a flag declared **and** read with neither reader
  touching it. 27 flags across 5 named files to **34 across 9 derived**;
  `tests/args.js` 224 to 361 lines. — done 2026-10-14, `29aee97`.

- **H57** A strike becomes a function of its argument, and the live match
  nobody had declared. `strike`'s `walk` and `sprint` ran to a condition on the
  carried gait phase, so the ground covered getting there was whatever the last
  check to walk a body left behind - 1.167m and 0.217m on one run of the plant,
  0.292m and 0.000m on the next. **The fix inverts the order rather than
  replacing the condition**, and it is D66 that makes it possible: `reset()`
  keeps the drawn gait's phase and snaps the place, so the strike drives until
  the drawn leg is furthest **forward**, resets to the lane, and runs a pinned
  count of frames from a known phase at a known place - 37 at the walk, 27 at
  the sprint, measured to land on the leg's furthest reach, which is what the
  old one promised. Position reads no phase at all, so all twelve states land
  **0.000000000m** apart, on both maps, and `CARRIED` is **empty**.
  **Signed, because the old header was wrong about its own restriction**: the
  `Math.abs` read stopped at whichever half-cycle arrived first, so a walk's
  pose was reproducible only up to a **mirror** - `legL` -0.5626 against
  +0.5626, the same silhouette with the other leg forward, which a 3,000-pixel
  floor against 7,891-9,818px could never catch. Pinning the parity moved every
  walk and sprint gallery frame once, deliberately (**D76**), and moved the
  yard's walk onto the other front eye - the fourth entry in `EYE_MOVES` and
  the first that is not a climb. **The afternoon went on something the entry
  never mentioned.** `strike()` drives a body through a *live* match;
  `strikerepeat.js` was the one of four callers with no match of its own, and
  it runs after `poseeye.js`, whose `quiesce()` restore ends `ai: true`. So
  twenty-four strikes were being driven down a lit lane in front of a hunting
  Warden, and the fifty extra frames of alignment were enough for it to land
  four rounds: `combat:shot/warden`, `impact`, `damage/body`,
  `damage/headshot`, `combat:death` - and the strike reporting *"the sprint did
  not bring a leg furthest forward"*, because a dead body does not walk. It was
  **intermittent on the frame count**, which is the worst way for a check to be
  wrong. Fixed with the line the other three callers already have, per strike;
  the hazard is now in `strike()`'s own contract, and **H71** and **H72** are
  the two jobs it left. Three breaks, and two of them found faults in the new
  check rather than in the tree: an instrument counting off the verdict instead
  of off what was struck, and a "declared but no longer carrying" clause that
  could never fire - removed rather than fixed, because H52 had already
  measured that redding on it reddens a correct build. — done 2026-10-14,
  `e99064c`.

- **H56** The solver's read-only half moves out, and the clause that caught
  what identity could not. `src/physics.js` stood at **600 of 600** - the
  number H63 had been printing on every build's summary - in the swept solver,
  the hottest code in the game and the one module where a behaviour change is
  a rule change. `raycast`, `lineOfSight` and `defaultSightFilter` went out to
  `src/physicsquery.js` (113) and the five scratch vectors to
  `src/physicsscratch.js` (46); `physics.js` is **520**. **Not the shape the
  entry recommended**: free functions taking the world would have been **53**
  edits to call sites through the hot path, so the two went out as a
  **prototype mixin** on F3's model - `Object.assign(CollisionWorld.prototype,
  QUERY)` at the foot of the file - and **not one of the 53 changed**. Both
  method bodies and the scratch literal were diffed **byte-identical** against
  HEAD rather than eyeballed. **The third file is the argument**: the vectors
  are *aliases* the sweep writes too, and a sibling with its own copies would
  be a behaviour change no existing check could see, so
  `the-solvers-read-only-queries-live-next-door-and-share-its-scratch` proves
  the sharing by **driving each half and reading the one exported object
  back** - the swept bounds, the ray's delta, the sight line's normal - rather
  than by grepping an import list. Its live clause came off `npm run probe` in
  **31ms and 10ms** before a line of it was trusted: plant 8/12 drops land
  own-box at 2m with ny 1, 15 blocked and 9 clear agree; yard 12/12 and 12/12.
  **Five breaks, five reds, each naming its own clause - and the fifth was a
  finding.** A dead `raycast()` pasted back into the class body was written as
  the control, expected to leave the identity clause green and be caught by
  the source grep. It did leave identity green, and the **enumerability**
  clause caught it, which the file's own header said it could not:
  `Object.assign` writes through `[[Set]]`, which changes an existing writable
  data property's **value and not its attributes**, so the prototype holds the
  exported function in a slot the class body shaped. The two clauses are not
  redundant and enumerability is the stronger; the header now says so with the
  measurement rather than the reasoning. One self-inflicted scare written down
  because the shape recurs: the proof driver printed `consoleErrors=2` on all
  five breaks, which was `len()` of a `{count, first}` **object** - two keys,
  not two errors - and a number constant across five different breaks was the
  tell. The ceiling line now reads *"11 modules within 50 of 600, nearest
  src/tests/movement.js at 599 (1 left) - of 184 this run loaded"*, a
  different leader with one line of headroom, which is **H70**. — done
  2026-10-13, `553d9a1`.

- **H63** A passing check's number reaches a reader, and the control that was
  a finding. The runner's stderr summary is all a reader of a run sees without
  a flag, and **a passing check's detail is not in the report at all** - so
  H55's ceiling line, the one that says which modules are near the 600
  guidance, reached only a reader who passed `--details`, which every run this
  month happened to do. It is on the summary now, **per run, with no flag**:
  *"ceiling: 12 modules within 50 of 600, nearest src/physics.js at 600 (0
  left) - of 181 this run loaded"*. **The number is the check's own and that
  was free**: `_runOne` already spread a check's result into the report, so an
  extra field had always survived and nothing in the harness changed - only
  the JSDoc, which promised `{pass, detail}` while the spread said otherwise.
  Nothing in the report measures a line, and `suitereport.mjs` quotes **neither
  threshold**, because both arrive inside the object. A new check in
  `runnerguard.js` - no new module, so no new row in four censuses, measured -
  holds the chain in five clauses, the load-bearing one being that the check's
  **prose and its object agree on all seven numbers**, parsed back out of its
  own detail line: one measurement rendered twice, and nothing else in the
  suite could say they had stopped agreeing. **Five breaks, five reds - and the
  one meant to be a control was a finding, which is the second run in a row.**
  The clause grepped the per-run loop for the substring `run.ceiling`, and a
  break reading `run.ceilingButNotRead` printed nothing and **passed**: one
  name contains the other, which is H61's finding one job later in a different
  currency. Fixed with the idiom the module already had - `GUARD` and
  `positionreads.js`'s `snapper` hold **named expressions**, not names - so
  `PRINTS_THE_CLUSTER` holds the whole shape and the break reds. Measured and
  contrary to the entry: **both maps report 181 and an identical cluster**, so
  the per-run line prints the same sentence twice today and the shape is for
  the day they diverge. Stated rather than papered over: `suitereport.mjs`
  reads files, so the page cannot import and run it, and three of the five
  clauses are readings of text. `donedef.js` 568 to 587, `runnerguard.js` 252
  to 438, the cluster still twelve. And **an hour lost to reverting a break
  with `git checkout --`**, which reverts to HEAD and threw away the
  uncommitted job, so four breaks ran against a tree that had lost the work
  they tested - recovered from the scratchpad patch scripts, and `TRAPS.md`
  gains the hazard, the remedy and the lesson that a break must red for **its
  own** clause. — done 2026-10-13, `a706543`.

- **H62** A census right by luck, and the two string reads nobody had counted.
  H53 gave this project two source readers and a rule about naming them, and
  left the position census asking both its questions through the weaker one:
  `codeOf` takes comments **and** quoted strings out, `uncommented` takes only
  comments. The documented reason covers two clauses of seventeen - two entries
  are held against the *wording* of a reported problem and a string-stripping
  reader cannot see one - and does not cover **membership**, which asks what a
  module *does*. **The probe came first and its answer is the finding: both
  readers put the same fifteen modules in the census.** None joins, none
  leaves, every `reads`, `control` and `snapper` pattern still matches as code,
  so the defect was real in principle with **no member on this tree** - the
  criterion moved and the census did not, which is H61's shape one run later.
  **What the entry had wrong is where the strings are**: there is no third
  prose *entry*, there are two prose entries and two **clauses**, each of which
  would have broken on the obvious move - a check's own `id: '...'` (all seven
  of `presentation.js`'s vanish under `codeOf`, so the `frozen` slice is never
  cut) and `combat:death` (vanishes, turning a held `ragdoll` proof into a
  reported problem). So membership and every expression pattern read `codeOf`;
  an entry whose evidence is prose carries a **`says`** field, the field name
  being the declaration; the two clause-level string reads keep `uncommented`
  and say at the line why the strong reader is blind to them. The `frozen`
  proof **cuts with one reader and tests with the other**. **The one clause
  whose arithmetic had to change is the `ragdoll` ordering**: it compared two
  character offsets into one string, which stop being comparable once the two
  ends come from two reads, and now compares two **line numbers** - both
  readers are line-local and neither drops a line, measured (`deathcam.js` 238
  lines raw, uncommented and as code; `visual.js` 515). The instrument is
  **three** questions, not two, and `readerProblems` now takes the reader it is
  instrumenting (defaulting to the strong one, so all four callers before H62
  are untouched): `codeOf` must see a real read and miss one named in a string
  or a comment, `uncommented` must see a reported problem's wording and still
  miss a comment quoting it, and **the same wording read as code must come back
  as nothing** - H53's hand measurement as a clause. All three red when the
  readers are swapped. Found by auditing rather than probing, and the first
  would have shipped a **false red**: `entry.snapper.test(source)` was the use
  site the two readings missed, and a regex put to `{ code, said }` tests
  `"[object Object]"`, so both `snaps` entries would have reported a module
  that had not changed. `readerProblems` has **four** callers and the record
  said three (`posecriterion.js`, one run old). Found in passing:
  `benchlist.js` names the weak reader `code` - **H68**. `positioncensus.js`
  **547 to 593** and the cluster back to twelve, the argument's home being the
  sibling (`positionreads.js` 279 to 368) - **H69**. And the **gate was
  compromised**, the third occurrence of a trap `TRAPS.md` records twice: the
  background gate was read past and the job written beside it, so its verdict
  was about a tree that half existed and was **not read** - the base's proof is
  H61's VERIFY, which step 8 says stands as this job's gate anyway - and the
  runner was killed by hand, because `TaskStop` takes the `npm` wrapper and
  `suite.mjs` carries on. — done 2026-10-13, `b3cda3d`.

- **H61** A name in a regex became a set the tree decides, and there were
  five of them. The breath census's membership rule was *"calls `updateVisual`,
  or `animation.js`'s `strike`"* - H53's fix for a criterion it had found wrong
  in **both** directions, and honest about today while silent about tomorrow: a
  second helper that drove a frame on a caller's behalf would put its callers in
  the census by accident or out of it by accident, and nothing would say so. The
  proxy set is now read off the tree: **every module under `src/tests/` that
  exports a function whose own code reaches `updateVisual`**, with the module
  list from Resource Timing (`donedef.js`'s rule - the modules that actually
  ran, never a guess at the import graph), which is the half that covers
  **helpers**, and a proxy is exactly the kind of module that registers no check
  of its own. **The reading is the finding: five names in three modules where
  the entry said one in one** - `animation.frame`, `animation.strike`,
  `look.photograph`, `look.photographPose`, `positionreads.draw` - and
  **membership did not move**, because every caller of all five already calls
  `updateVisual` or `strike` in its own code. So the criterion changed and the
  census did not, which is the right kind of change: it buys nothing today and
  it cannot be wrong tomorrow. The entry's own example of a second proxy,
  `figure.js`'s `standAndEyes`, **is not one** - every `updateVisual` in that
  module is inside its `register` - which is the case a hand-written list gets
  wrong in the other direction. `register` is exempt by name and **break D
  shows why**: without it `engine.js` and `boot.js` join the census by accident.
  `posecriterion.js` (313) is the criterion, its discovery, seven source cases
  for the proxy it does not have yet, and both reader tables; `breathcensus.js`
  **shrank 569 to 550** and the 600-line cluster went twelve to eleven. Five
  breaks, five reds - and **the fifth was meant to be a control and was a
  finding**: dropping the lookbehind that makes a proxy call a free call left
  the census green with `lens.draw(` and `drawCalls(`, so two **code** cases
  joined `READER_IGNORES` and `sourcetext.js` says an ignore may be code naming
  something that is not the call. Found in passing: the page makes **250
  requests** against a Resource Timing buffer whose default size is 250, which
  three censuses read and nothing raises - **H67**. — done 2026-10-11, `6a791e8`.

- **H54** The shape the total had none of, and a new low on the ratio. D74
  refused a floor on the audio device's `fed` ratio because **a total has no
  shape** - 0.57 is this machine losing seconds a frame at a time, 0.28 is a
  device that stopped once and stayed stopped, and 0.28 is also a healthy
  device on a machine twice as loaded. The journal now keeps the **longest wall
  interval across which `currentTime` is known not to have moved**, where it
  started and how many marks fell inside it, sampled once a frame from
  `AudioSystem.step()`. **The whole of the design is one decision about what a
  mark can prove**: two marks reading the same clock prove it did not move
  between them, a mark reading a larger one proves only that the device was fed
  somewhere in the gap - so a stretch closes at the **last stale mark**, never
  at the mark that saw it move, and a gap with no unmoved mark in it is a
  stretch of zero. That is load-bearing rather than fussy, because the rAF loop
  drives no frames under the suite (F4): the probe measured a **265-second**
  gap while the pipeline tail drained and the honest arithmetic charged the
  device none of it. **Four full-run readings, every one `many-stretches`**,
  concentration **0.0002 to 0.0026** against the 1.00 a device that died must
  read - so this machine's 42-48% loss is thousands of sub-frame stalls and the
  worst single stretch in any of it is **2.211s**. The pair separates all four
  of D74's cases and `CLOCK_CASES` is now **twenty-seven**. **The floor is
  still not written and the reason moved from shape to coverage** (191 and 652
  marks, widest gap 167-275s); D74 carries the answer and **H66** is the job.
  Found on the way: **`fed` 0.5225**, a new low under H35's 0.5665, which puts
  0.45 at 1.16x under the lowest healthy reading where D74 said 1.26x - more
  data made that floor worse, not better. And the *import* order in
  `tests/index.js` is not the registration order, which cost two subset runs
  and is **H65**. Five breaks, five reds, three in the suite and two against
  the live table. — done 2026-10-11, `85acd36`.

- **H58** A runner that drops an argument it was given, and the parser
  nobody could test. `npm run shot -- --pose mantle --pose pullup` wrote the
  pull-up and printed *"1 poses"* while doing it, on both maps: `parseArgs`
  did `out[key] = next`, so a repeated flag kept the last value and the
  earlier one was gone before `listArg` ever saw it. **The queue's "one call
  changed" was the one thing it was not** - the repair is in the parser. Two
  ways to read a flag now, chosen at the line: `listArg` for one that may
  repeat, `scalarArg` for one that takes a single value and **refuses** a
  second, printing `<runner>: REFUSED: --runs was given 2 times (1, 2)` and
  exiting 2 - a bad command line is the runner failing to run, not a red
  check (1) and not H45's refusal to measure (3). Twenty-seven flags across
  four runners, every one decided about. **And there were two parsers**,
  one in `headless.mjs` and one inside `suite.mjs` under a header asking for
  the two to be kept in step - which they were not: one kept positionals and
  the other discarded them. Both import `scripts/args.mjs` now, the one
  module in `scripts/` with no node builtin in it, which is what lets
  `tests/args.js` **import the parser and test the behaviour** where
  `runnerguard.js` can only read source. Ten cases, four giving a flag
  twice, with their own instrument: fewer than two repeats in the table is
  red. Five breaks, five reds, the first restoring the original defect.
  Found on the way: `benchlist.js` asserted `bench.mjs`'s exact spelling of
  a read this job changed (H46's lesson, caught by grepping every test for a
  quoted runner expression), and carried a **fifth** copy of the comment
  stripper H53 collapsed four of. D75's six frames are unblocked and
  `PLAYTEST.md`'s three commands are one. Follow-up H64, because the flag
  census is written down by hand. — done 2026-10-11, `48ca405`.
- **H55** A number beside an identical number does not look like a warning.
  The ceiling check printed *"the largest outside src/config.js is
  src/physics.js at 600 lines (guidance 600)"* and had printed exactly that
  for weeks, in a detail line every run with `--details` writes down - the
  measurement right and the report unreadable. **H53, one job earlier in the
  same run, is the cost**: it wrote `tests/breathcensus.js` up to exactly 600
  and learned it from `wc -l`. The line is now the **headroom** as its own
  number and the nearest three rather than the leader, 220 characters of the
  runner's 400: *"179 modules loaded; 12 within 50 of the 600 guidance,
  nearest 3: src/physics.js 600 (0 left), src/tests/movement.js 599 (1 left),
  src/systems/combat.js 593 (7 left)"*. The guidance stays 600 and the
  verdict stays "over 600 is red" (D71). **And the cluster is twelve, where
  this entry and HANDOFF both said three** - twelve of 179 modules inside
  fifty lines of the ceiling, six of them under `src/tests/`, which is the
  number H56 is really about and was on no record anywhere. Three clauses
  hold the report honest: the arithmetic, the nearest-first order, and that a
  module **already over** the guidance is inside the cluster rather than off
  the far side of it - the last being the mistake a band written as a
  distance invites, `Math.abs(600 - lines) <= 50`, which looks right and
  hides the only files that matter. Four breaks, the fourth a control that
  pads a file over the line with the band correct and shows the cluster
  clause staying silent. Follow-up H63, because a passing check's detail is
  not in the report at all. — done 2026-10-11, `7295313`.
- **H53** Two censuses decided membership by grepping prose, and the
  stripped read was half the repair. Both read the **raw** text of every
  module, so a comment naming the identifier enrolled it: H35, H47 and H52
  each paid for that, the last with a seventy-minute verify. A probe over
  the live tree before anything was written found the other half - the
  stripped read dropped `poseeye.js`, `strikerepeat.js` and
  `positioncensus.js`, every one of which poses all twelve strike states
  through `animation.js`'s `strike` and calls `updateVisual` nowhere in its
  own code, so each had been in the census by its comments alone. So the
  criterion is the call **or the one proxy that makes it for you**, and the
  membership under both together is 15/15, 13/13 and 6/6 against the raw
  read: narrower, and the same answer. `tests/sourcetext.js` owns what were
  four copies of the stripper in two strengths - `codeOf` (comments and
  strings out) and `uncommented` (comments only, for a clause whose evidence
  **is** a string) - plus `readerProblems`, the instrument both censuses run
  before trusting themselves. H47's workaround is out of `tests/deathcam.js`
  and that file is the live proof: two sentences naming both calls, code
  calling neither, in neither census. Two holes in a stripped read are now
  documented and one of them cost a subset run - a `${...}` is kept because
  an interpolation is code, and a module **path** cannot be seen at all,
  because a path is a string. Five breaks, five reds. Follow-ups H61, H62.
  — done 2026-10-11, `9911b18`.
- **H52** A strike is reproducible in its pose and not in its place, and
  which states that is true of. H46's own control caught two `sprint`
  photographs being of capsules **0.975m apart**; the carried quantity is
  `_animTime`, the drawn gait's phase, advanced inside `updateVisual` by the
  ground covered and **deliberately not** cleared by `reset()` - D66, with a
  clause in `breathcensus.js` holding that refusal, walked forty frames first
  so that "reset did not move it" is not `0 === 0`. So the obvious fix was
  closed before it was tried: zeroing the phase reds a shipped clause that is
  a decision written down, which makes it a change to the game's reset rather
  than a line in a test-side job. The restriction is named instead, in
  `animation.js`'s header, with the 0.975m and the D66 reference - **and the
  half a comment cannot do is a census**:
  `a-strike-of-a-state-puts-the-capsule-in-the-same-place-twice-except-where-the-gait-is-carried`
  strikes all twelve states twice every run and asserts the undeclared ones
  to **1e-9**. Two states a reader would have declared are not in the set and
  measuring was the only way to know: the **climbs** are reproducible because
  their position is a function of a probed ledge, and the **slide** reads no
  phase at all - declared on the argument, measured at 0.000m, taken out. The
  spread is reported and never asserted, which was also measured: two runs of
  the plant inside one pass read walk 1.167m / sprint 0.217m and then walk
  0.292m / **sprint 0.000m**, so a clause reddening when a declared state
  reproduced would have reddened a correct build - caught by running the
  subset twice before the verify. The set is held stale-proof from the
  mechanism instead, reading `strike`'s own peak-detection line out of source.
  The look is **D75**: the eye a climb is photographed from, Provisional, six
  PNGs named, `decided:` left empty on purpose, `photographHere` untouched.
  **Found: H57** (the real fix, M, and it has to re-measure look.js's floors
  because H33 found the phase moves a walk silhouette 24%), **H58** (`npm run
  shot` takes the last `--pose` and drops the rest, saying "1 poses") and
  **H59** (a strike's *success* is not a function of its argument either -
  crouch and slide failed to reach on one plant run in four).
  — commit `7de81bc`

- **H51** The Section 14 recipes come out of `audio.js`, and the file at
  exactly 600 that nobody read. `systems/audio.js` stood at 589 of the 600
  the ceiling check allows, with H35 having spent three of the eleven left,
  so the next job to touch it would have found out mid-verify - the thing
  H42, H43 and H44 each avoided by splitting early, and this is the fourth.
  `AudioSystem.BUILDERS` was the seam the queue named and it cut clean: a
  recipe is called as `builder.call(audioSystem, position)` from three
  sites, so it reaches nothing but `this._noiseBurst()`, `this._tone()` and
  its own row of `CONFIG.audio`. The 142 lines moved **verbatim**, diffed
  against HEAD rather than eyeballed, into `src/systems/audiosounds.js`
  (184 with its header); `audio.js` is **450**; the table keeps its name
  (`AudioSystem.BUILDERS = SOUND_BUILDERS`) so the three call sites and
  `tests/audio.js`'s `Object.keys(audio._builders)` are untouched. The
  seam is **asserted** rather than left to hold itself, in
  `one-module-owns-the-audio-device-...` because that is already the check
  deciding which module may do what with the audio graph: every recipe the
  live system answers to is declared in `audiosounds.js`, none in
  `audio.js`, and `audio.js` reaches the table through an import - written
  against the live enumeration, so a seventeenth sound is covered the day
  it is written, and carrying its own instrument clause. Proved by planting
  a `plantBeep` back into `audio.js`, which reds it by name. **Found:**
  `src/physics.js` is at **exactly 600**, with `tests/movement.js` at 599
  and `systems/combat.js` at 593 - zero headroom where audio.js had eleven,
  and the gate's own detail line has been printing it at every run because
  a 600 beside a 600 does not read as a warning. **H55** (S) makes the line
  report headroom and the nearest three; **H56** (M) splits physics.js, and
  names the two seams and the re-export mechanism already in the file.
  — commit `72cabaa`

- **H50** The floor that cannot be written, and the word a census could not
  count. The queue asked whether the audio device's `fed` ratio - the share
  of a run its own clock gained, which H35 measured at 0.5665 on a plant
  run with the context reading `running` throughout - can carry an honest
  floor, and said seven readings were enough to write one from. Fifteen
  exist now - eleven when the clause was written and four more from this
  job's own verify - every one a solo suite run, every one between 0.5665
  and 0.7481, windows 533.5s to 2,007.9s, and the answer is **no** (D74), on a sharper
  objection than the one the queue expected: **a total has no shape.** 0.28
  is a device that stopped once and stayed stopped, and 0.28 is also a
  healthy device on a machine twice as loaded, so a line at 0.45 divides
  *machines* rather than *faults* - and the solo spread is already 32% wide
  with nothing attributed, putting 0.45 at 1.26x under the lowest healthy
  reading, against a false red that costs a whole run. **What is asserted
  instead is the sign**: over a window of at least 30s the clock moved at
  all, which catches a device that played nothing and stays quiet about one
  merely starved. `readDeviceClock()` holds it and `CLOCK_CASES` runs it
  over **eighteen** readings - the eleven real ones, the halfway stop
  (green on purpose, so a later floor turns a row red and lands on D74), a
  device fed for one buffer of a quarter-hour run, and a dead one at and
  either side of the window. **And that made the second half bite**: the
  audio device's entry in H41's clock census moved `reported` to **`sign`**,
  the census's first `sign` entry in `CLOCKED`, where `sign` was counted as
  `READS.filter(...)` because the word was documented over `READS` alone -
  so the detail line would have said nine clauses of ten with nothing red.
  The four words moved up into one `VERDICTS` constant, every verdict is
  counted over both groups, and **the tally must add up**, which is the
  clause that would fail if this job were reverted. Found in passing: the
  census was miscounting itself in prose, "nine clauses in eight modules"
  against ten in nine, corrected here and in `HANDOFF.md`. **H54** is the
  measurement that would make D74's floor writable.
  — commit `d7d9848`

- **H47** The death camera's clause reads the body it could actually move.
  `death-camera-watches-the-killer`'s *"free-look moved the body"* clause
  read `shade.mesh.position` across a free-look, and H43 found that nothing
  in that check advances the position chase - so the drawn body was frozen
  for the whole of it and the clause could only catch a write that went
  straight to the mesh transform. A free-look that walked the **capsule** a
  metre passed it. It reads both now: the capsule, which is what the camera
  is actually holding and what a cinematic writing back through it would
  move, and the mesh, kept as the direct-write guard the clause was named
  for. **Proved by walking the corpse**: `deathCam.step()` was made to move
  the capsule 0.75m and the check went red naming the distance - with **no
  complaint from the mesh clause in the same report**, which is H43's
  finding demonstrated rather than argued. The census entry moved from proof
  `frozen` to proof **`ragdoll`**, the stronger reason and always the true
  one: `combat:death` hands the mesh to the ragdoll forty lines before the
  read and a ragdolled `updateVisual` returns before writing position, which
  holds even if somebody adds a frame to the check where `frozen` would
  quietly stop holding. `presentation.js` is the only module under `frozen`
  now and the clause that holds it still does, and
  `positioncensus.js`'s header no longer claims a hole it no longer has.
  — commit `b008641`

- **H46** The chase moves three eyes, and all three are climbs. H43 left
  the question: the eye a pose is photographed from is the first of six
  candidates `isClear` and `lineOfSight` both accept, and both are asked
  about a point placed off a body up to 0.794m from where the capsule is,
  so the lag can change which eye is picked and what occludes the body from
  it. **It does.** The plant's `vault` (0.43m, `front-left` where the
  capsule says `front-right`), the yard's `mantle` (0.40m, `right` against
  `front-right`) and `pullup` (0.49m, `left` against `front-left`); nine of
  twelve states agree on both maps, and the three that move are **climbs**,
  which is where the body is up against something for a candidate eye to be
  inside. Proved causal rather than coincident: snap the chase and `vault`'s
  eye stops moving. Held as a census keyed by map, on
  `positioncensus.js`'s model - a state joining reds, a declared state that
  stops moving reds - because choosing off the drawn body is *correct* for a
  photograph of the drawn body and what the flip costs is the angle; **H52**
  is the fix on Josh's word. **The queue's method was built and does not
  work**, measured twice: settling 150 frames of `updateVisual` also
  advances the breath, so `landing` covered 9,451 pixels shipped and 9,996
  settled, 5.77% apart from the same eye and none of it occlusion; and two
  strikes of `sprint` are of capsules 0.975m apart, so two photographs are
  never two frames of one moment (**H52** again). The sound instrument asks
  the geometry once, through `look.js`'s own `chooseEye` exported rather
  than copied, for all twelve states rather than the three the queue named -
  and `vault` is not one of the three. `photographPose` has the `settle`
  option the queue asked for anyway, defaulting to zero so `npm run shot` is
  unchanged. One hour lost and one `TRAPS.md` entry bought: `position` is a
  capsule centre and `mesh.position` is feet, so subtracting them adds
  half a height to every gap - it read `hang` at 0.94m against H43's 0.014m
  and invented two eye moves - and it was caught only because the new
  readings were held against H43's table, which they now match to the
  millimetre on both maps.
  — commit `9974109`

- **H35** The device answers for itself, and it is being starved. The job
  was a reading: three cold gates' console-error counts, then close the
  `AudioContext` device error or name what to look at next. **Six** cold
  gates are on the record and every one reads 0 (H11, H38, H36, H42, H43,
  this run's), against the error at **3 of 36 runs** — and the clean runs
  are no longer concentrated anywhere, so the warming-machine hypothesis
  did not hold up: it was a story about where three occurrences sat, and
  nine clean end-of-session runs in one session dissolved the pattern
  under it. Not closed either. What the queue told the job to weigh third
  was the **device**, which had nothing on the record at all, and that is
  what was built: `systems/audiodevice.js` (124) keeps a journal from the
  unlock — every `statechange` with its millisecond, any `error` event, the
  rate it opened at, its own clock — and `tests/audiodevice.js` (173) reads
  it late in the run. **The reading is the finding**: the device clock
  gained 461.6s of 814.7s on a full plant run, so the output device went
  **unrendered for 353.1s, 43% of the page**, with the context reading
  `running` throughout and no error event — against 0.8s lost on a
  16.5-second subset, so it accumulates and is starvation, not a startup
  offset. This machine does not feed its audio device while the suite
  rasterises on four pinned cores, which fits every property of the error
  (intermittent, no stack, mid-run, invisible to code, never in a cold
  gate's first seconds). The ratio is **reported and never judged** for
  D71's reason (D73; H50 sets a floor if one can be set honestly); the
  four clauses that decide the check touch no duration — one context, the
  state `running`, the rate it opened at, no state nobody asked for.
  Four breaks, each naming its own line, including the **count
  `audiocontext.js`'s own header says a browser test cannot take** (it can
  now: the one module allowed to name the constructor counts what it
  builds) and a journal catching a device that went away for 875ms and came
  back while the state at read time was `running`. H41's clock census went
  red on the new module and was right to; the entry is `reported` and the
  wall-clock half of the ratio moved into the check so the one
  `performance.now()` sits beside the clause it feeds.
  — commit `383dddc`

- **H45** The gate refuses rather than warns, and exit 3 is a third kind of
  morning. `npm run bench` has refused to run beside a suite since H11 with
  the right argument; the suite had the same exposure and only warned, and
  **the warning was read past twice** — H41's gate took 2,215,508ms against
  the 1,105,958ms of the four runs before it, on the same tree with the same
  instrument, with `auto` calling for `low` off a 10.30ms probe where this
  machine reads 5-7ms. `scripts/suite.mjs` now refuses before it launches
  anything and exits **3**, naming the other pid, `taskkill` **and**
  `Stop-Process` (H41 found the first is not refused to a scheduled session,
  which `TRAPS.md` had wrong), and `--allow-other-runners`. **Exit 3 is the
  argued part**: 1 is red, 2 is a crash, a refusal is neither, and a
  scheduled session reads a code before it reads anything else. With the flag
  it warns, proceeds, and the report carries `besideOtherRunners` beside
  `otherRunners`. The distinction it rests on: a **verdict** is honest beside
  another runner (a draw-call count is the same number on a busy machine), no
  **timing** is, and the report is full of them. **Proved by starting one**:
  refused at pid 14004 with exit 3 before a browser existed, and the same
  command with the flag came back exit 0 with the warning, the summary's
  `OTHER RUNNERS ALIVE` line and `besideOtherRunners: true`.
  `tests/runnerguard.js` (252) holds the mechanism where it lives, the way
  `benchlist.js` holds `bench.mjs`'s — the page has no processes and the
  module says so rather than pretending: the exit is an exit and not a
  warning, it names the pid and the flag, the code is 3, `ALLOW_OTHER_RUNNERS`
  is read **exactly twice** so a third reader is a second way past it,
  `package.json` does not carry the flag, `bench.mjs` still refuses so the
  pair cannot drift, `otherRunners()` still looks for `suite.mjs` at all, and
  `TRAPS.md` names the flag. Every grep reads the source with its comments
  stripped (H41's rule, H43's bite). Three breaks, each naming its own line —
  including the exact second-way-past this is written against, making
  `otherRunners()` itself conditional on the flag. One inconsistency named
  and left: the bench refuses with 2 where the suite now refuses with 3.
  — commit `0de451e`

- **H44** The grab's slide, and the shape the queue had wrong. The entry
  carried H40's numbers — the drawn body 0.80m low one frame in, 0.20m at a
  tenth of a second — and those describe an **instantaneous** metre of
  displacement, which is how H40 produced one. A real grab carries the
  capsule up over its move, so the drawn body falls further behind **while
  the climb is happening** and only then catches up: 0.16m at frame 1, a peak
  of **0.46m (plant) and 0.42m (yard) at frame 7**, under 0.15m by frame 15,
  1.5mm at 45. The Shade is 1.8m, so the peak is a quarter of her height, and
  the `hang` state arrives at frame 11 with 0.28m still to close. **Two real
  arguments, so it is D72 and not a fix**: every camera that follows her is
  derived from the same `_smoothPosition`, so the body holds its place on
  screen — but the gloves carry the lag too, so the hands drawn gripping the
  lip are up to 0.46m under it, against the 0.15m `hang.js` enforces settled.
  `tests/grabslide.js` (342) is the instrument and the check: whole frames of
  the real loop (`stepFrames` draws nothing and a draw steps nothing, which
  is H43's census in a second currency), five pinned frames within 0.08m, the
  **shape** held as well as the sizes because four numbers would pass a
  plateau, the arrival read at the chase's own settle, and `shot.mjs`'s
  source read for the viewer `PLAYTEST.md` sends a human to.
  `scripts/shot.mjs --slide` writes fifteen PNGs; `photographHere()` was
  split out of `photographPose` so a sequence can be photographed mid-flight,
  which is the seam H46 wants too. Two breaks, each naming its own line — and
  the smoothing break instructively does **not** red frame 1, because that
  frame's drop is the capsule's own travel. — commit `31c0b1e`

- **H43** The drawn body arrives after the capsule, and the census of who
  reads it on the way. `tests/positioncensus.js` (538) and its table and
  instruments `tests/positionreads.js` (247). Criterion a grep for three
  expressions, held both ways off the registrar's import list. **Twelve
  modules: three handle the chase, one measured, eight out of reach by six
  proofs**, each proof proved by a mechanism *and* a per-entry half. The big
  structural fact: `updateVisual` runs only from `main.js`'s frame or a
  `reset()` that snaps, and `stepFrames()` renders nothing — measured, sixty
  steps move the drawn body **0.000000000m** with a metre of gap open where
  ninety drawn frames close that metre to 1e-9 of the law's own prediction.
  `look.js` is the one read inside the band and all twelve states it
  photographs are open, worst `landing` **0.794m**, the moving states deeper
  than the climbs and nine of twelve rows identical on both maps; it passes
  on an argument held against its source (eye and focus are offsets from the
  same read) and the residual is **H46**. The Warden was chasing on its own
  copy of the law and `agentvisual.js` carried a third for the camera
  pull-out; the law is `pose.js`'s now, no behaviour changed. One hole
  reported rather than fixed (**H47**). Seven breaks, each naming its own
  line; two self-inflicted finds (a census grepping for a banned expression
  found it in the comment saying it used to be there; the ragdoll clause's
  control caught the instrument). Split at 672 of 600. — commit `b31428a`

- **H42** The bench asks for nine samples and nothing proves it got them. Built
  as the bench's **fourth honesty clause**: `sampleSummary()` in the new
  `tests/viewpointsamples.js` owns the two sentences the sweep has ever written,
  `scripts/bench.mjs` reads the count back out of each check's detail line with
  one pattern, stores `{id, asked, leanest}` per scene, and ends **non-zero**
  naming the scene, the check, what it asked and what it got — the verdict taken
  before the run record so `ok` in the file and the exit code cannot disagree,
  and no check id in that code, so the clause cannot drift from the list the
  gate dropped. **A judgement about the count and never about the ms.** Proved
  from both ends: `--samples 2` exits 1 naming `plant medium ... asked 2 ...
  came back on 2, under the 5`, and the flag exists for exactly that, because a
  card that always affords nine cannot show the clause firing; without it, 92
  viewpoints, **828 timed draws, `median of 9-9`**, exit 0, and a full bench of
  **12 readings with `asked 9 / leanest 9` in all six scenes**. The page holds
  the reader, which is the half a regex over somebody else's prose cannot do
  for itself: `the-bench-only-list-holds-only-checks-the-bench-itself-runs`
  lifts the pattern out of `bench.mjs`'s source, compiles it here and requires
  the right count out of both forms at 1, 4, 5 and 9, plus that the floor is the
  page's constant and not a second five. **One exported line took `soak.js` to
  589 of 600**, so the sampling statistics moved out whole into
  `tests/viewpointsamples.js` (134), taking soak.js to **478** — and because
  that module has no imports, node and the browser read the same file, so the
  floor and the default are imported by `bench.mjs` rather than copied and
  `benchlist.js`'s duplicate five became an import. Two self-inflicted finds
  written up: the **400-character cut** hid H42's own sentence in its own
  detail line (403 → rebuilt at 384, `SPIKE_MS` named once), and `asking` doing
  two jobs leaked `viewpointSamples=${SAMPLES}` into a sentence a human reads.
  The reader reaches back to H36's wording and no further, measured: 10-08 gives
  7 counts all 9, 10-07 gives none because at `e95fe4b` the sweep still timed
  one draw and said so by saying nothing.
  Done 2026-10-09, commit `f0ba7b5`.
- **H41** Which other checks time something on this renderer, and do any of
  them assert on it. **Nine clauses in eight modules read a duration and two
  put a verdict on the size of one.** One was already resolved the other way —
  the 92-viewpoint sweep is bench-only with a hardware reason since H11, so the
  gate drops its verdict — and the other is the one the queue predicted:
  `frame-budget-under-the-check-29-load` timed 180 frames of the check-29
  load and asserted their median against half the frame budget **at every gate
  since F5**, 3.10ms against an 8.33ms ceiling, 2.7x clear of a ceiling on a
  number that leaves out the 610-761ms a queued frame really costs here.
  **Branch two taken, not branch one**: making the whole check bench-only would
  have dropped its four clock-free clauses off the gate as well (the load
  assembling, Section 15's caps, the pools, the runtime assertions), which is a
  loosening and buys nothing. So the clock stops setting the verdict and says
  so at the line, and the verdict moves to the runner whose clock can price a
  draw — `npm run bench` refuses software outright and now asks for
  `?timedVerdict=1`, the second thing in the repo that one URL asks and the
  gate's does not. That is H36's lesson in a second currency: a sample count
  that must be affordable is declared by whoever is measuring, and a verdict
  that needs a trustworthy clock is declared by the runner that has one —
  neither is sniffed from inside the page. `tests/timedrenders.js` holds the
  census both ways, every entry's proof, the reader's default of off, the two
  runners' two URLs, and **the measurement the rule rests on**: drain, time one
  frame, drain again. Four findings: **H45** (the gate is not refused beside
  another runner and this run's own plant gate went 2,215s against 1,105s
  because of one), and three corrections written up in the entry.
  Done 2026-10-09, commit `76c6e50`.
- **H40** Two clauses read the same hands at two different moments, and the
  slow ease was never the pose. H38 left a finding: the shipped glove clause
  reads `|gloveY - lip|` thirty frames after a grab, which its probe of the
  settle put *inside* the pose ease, so the clause was bounding the tail of the
  arm's swing rather than the hang. **The premise is right and its mechanism is
  wrong**, and this job's own first answer was wrong the same way. Measured:
  the pose ease is innocent — `torso.y - (baseY + lift)` against the live
  `_breathTime` is 0.0006m at frame 30 and 0.0006m at frame 150, the arm's error
  against `HANG_ARM_ANGLE` is 9.6e-8 rad by frame 30, and `POSE_BLEND` is 0.2s,
  twelve frames to 99.9%. What was still moving is the ease nobody had named:
  `updateVisual` lerps **`_smoothPosition` toward the capsule** at 0.1423 a
  frame, **45 frames** to 99.9%, and a grab lifts the capsule a metre — so at
  frame 30 the drawn body is **9.3mm (plant) / 8.3mm (yard)** below where it is
  going. That is the centimetre H33's band sat below H38's, and it is why 150
  frames was right all along. Option 1 taken: `SETTLE_FRAMES` is 150,
  `SWEEP_SETTLE_FRAMES` is gone, both clauses read the same position in the same
  state of arrival, and the count is argued from the **slower** of the two eases
  (3.3 of 45) with `positionSmoothing()` exported so the check holds the law and
  not a copy of its answer. Option 2 refused with a number: the glove is 2.19m
  off the lip at the grab and the worst excursion in the first thirty frames is
  **14.6x the tolerance**, so a bound on the transition would have to be 2.2m.
  `the-hang-pose-has-arrived-before-the-glove-is-read` holds the relation, a
  control asserted before the settle, the arrival watched frame by frame, and
  the pose cleared rather than assumed — **four breaks**, each naming its own
  line, including H38's own mis-subtraction reproduced on demand at **0.03999m**
  against a breath depth of 0.04m. Two follow-ups queued: **H43** (the census of
  world-position reads inside the chase) and **H44** (whether the slide is
  visible, which is a look and so Josh's).
  Done 2026-10-08, commit `d87e6ec`.
- **H36** The worst viewpoint was one frame, and no clock in this page can
  price a draw. The sweep timed **one** draw per viewpoint and asserted the
  highest against the 8.33ms ceiling, so its verdict was a single frame — and
  H11 had already watched that frame move 5.50ms → 2.60ms between two benches
  of a byte-identical tree. Measured over four benches of this PC's GTX 1060 at
  fifteen draws a viewpoint: the worst **place** reproduces at no sample count
  (the top is a dozen near-ties inside the 0.1ms `performance.now()` is clamped
  to, while the top **ten as a set** does reproduce, 7–10 of 10), the worst
  **value** settles as a **median** — within 0.3ms between benches from five
  samples and 0.2ms from nine, where max-of-N agreed nowhere and *grew* worse
  with more samples — and **a single draw had already turned this check red on
  the real GPU**, 13.80ms at `bay-a-north`, at a place whose median is 2.30ms.
  So a viewpoint costs the median of the draws it was asked for, the worst
  single draw is reported and never asserted, and the busiest **three** are
  named instead of one crowned winner.
  **The second half took three dead runs and is the more useful finding.** The
  sample count was meant to come from a per-viewpoint wall-clock budget, which
  bought all nine headless, queued 736 extra draws and killed three runs at the
  600s `--stall-wait`. Probed: nine queued draws of a real viewpoint submit in
  13–24ms, `gl.getError()` returns **0.6–0.8ms** later, and a real `fenceSync`
  then waits **5,480–6,834ms** for those same nine — **610–761ms a queued
  draw**. So `getError()` is not a barrier here, the only barrier that is must
  yield to the event loop to poll, and **no synchronous clock in this page can
  price a draw at all.** The count is therefore declared and not measured:
  `?viewpointSamples=9`, which `scripts/bench.mjs` asks for and nothing else
  does, one otherwise, the budget demoted from the decision to a cap. The
  parked note's own diagnosis — a probe that never called `lens.look()` — is
  disproved in passing, since looking at a real viewpoint reads *lower*
  (2.6–3.6ms against 5.1ms), and `TRAPS.md`'s claim that a `glError()` waits
  for everything queued is corrected rather than extended.
  `the-frame-budget-asserts-a-median-frame-and-not-an-unlucky-one` holds both
  constants as a relation, the median both ways, **seven URLs buying what they
  should**, that the sweep reads the URL and declares no `glSync`, and that
  `bench.mjs` asks while `suite.mjs` does not — proved by **five breaks**, each
  naming its own line. Pipeline tail of a subset containing the sweep:
  **224,968ms**, the parked base's 224s to the second, so the gate costs what
  it always cost.
  Done 2026-10-08, commit `181a7f3`.
- **H39** The other twelve, and the two facts that answered ten of them. H33
  declared `ALSO_DRAWN` — the modules that read a body off a frame they rendered
  rather than posing one — and measured none of them. **Two structural facts,
  both now proved behaviourally, answer ten of the twelve**: a lens `grab()` is
  `h.post.render(...)` plus a `readPixels` and never calls `updateVisual`, so
  every grab inside a check is at **one** pose and a difference between two
  grabs cancels the body exactly (twelve grabs move the body under 0.0001m
  where twelve real frames move it 0.0064m); and `_posture` multiplies the whole
  gait by `walking`, so a standing body's limbs are at rest whatever
  `_animTime` reached (1.08 rad of swing walking, under 0.0001 rad standing
  across a whole turn of it) — and every body in this group stands, so the
  *bigger* of H33's two levers reaches none of them. A third fact explains why
  nothing here needed H38's settle: `Agent.reset()` ends in `updateVisual(0)`
  and `blendFactor(0)` is **1**, so a reset body is re-posed at the run's phase
  with the ease snapped, where H38's hang was driven into and had a live ease on
  top of the breath. **What is left is two clauses and both are wide**: the
  dim-with-the-meter check covers 18,579–19,763px over a 400 floor (46x) and
  reads near-black at 36.7–42.8 against 90, and the rim check masks
  7,376–8,109px over 500, brightens 4,872–5,118 over 200, and reads its
  silhouette **2.08–2.39x** the interior against a bar of 1.5 — **1.39x, the
  thinnest in the group**, the breath moving it 7%. The opposite shape to H38's
  answer for a reason rather than by luck: a body's own pixels are counted in
  the thousands or averaged over its mask, where H38's glove was a point two
  metres from the pivot the breath turns. Ten out of reach by five proofs —
  `onepose`, `hidden`, `nobody`, `onebit`, `cost` — three held behaviourally
  with their second halves (hidden bodies move **0** pixels across a crest-to-
  trough where shown bodies move 18,470; draw calls **449** at both ends of an
  exact 0.080m lift) and two from the module's own text, as `donedef.js` reads
  source. **Its own control caught its instrument**: the first draft advanced
  half a cycle from wherever the run arrived, which moves the body by
  `2A·|sin θ|` — the whole ride at a crest and nothing at a crossing — so it
  would have been vacuous in six runs of eight and green in all of them. The
  phases are absolute now. Proved load-bearing by three breaks, each naming its
  own line, including the cross-module wiring in both directions. **The queue
  was wrong about one module**, the third time in this block: the death camera
  is `visual.js`'s and is out of reach twice over, by the Warden and by the
  breath living inside the mesh.
  Done 2026-10-07, commit `5380adc`.
- **H38** The hanging glove, held at the worst phase of the breath, and the
  centimetre the census missed. H33 named `tests/hang.js` the thinnest
  breath-reached clause in the suite — `|gloveY - lip| <= 0.15m` on a world
  position inside the body group the breath lifts, half the tolerance spent on
  a quantity nothing bounded — and this is the bound:
  `the-hanging-glove-holds-the-lip-at-every-phase-of-the-breath` hangs at the
  ledge the controller's own probe reports, samples eight phases of the 6.98s
  breath and asserts the **worst**, at **2.26x with 56% of the tolerance
  left** (the offset runs -0.014m to +0.066m on both maps). It costs **10-17ms**
  because the glove is a world position off the matrix and nothing renders.
  **It corrects H33's number by a centimetre**, and the cause is a settle, not
  the breath: the span agrees (0.079m and 0.080m, with a dense sweep at
  0.0800m, twice `POSE.breath.lift` to the millimetre) but the arm's *angle*
  arrives by frame 30 while the pose's contribution to the glove's *height* is
  still moving — -0.016m at frame 30 against +0.0263m settled — so the census
  swept the ease and the breath together and called the sum the breath. The
  sweep settles **150** frames and the constant says why. **Eight phases is
  right here and a dense sweep of all 419 frames proves it** (0.0663m against
  0.066m), which is the opposite of H34's answer for a measured reason: an
  offset in metres is continuous, so eight samples miss a sinusoid's peak by at
  most `1 - cos(pi/8)` — 3mm — where a pixel count is an integer whose extremes
  are rare. **A sweep's density has to be chosen against its quantity's own
  graininess.** The map does not enter it: both maps' dense sweeps are
  identical on lips 0.10m apart, because the lip cancels out of
  `gloveAboveFeet - hangDrop`. Proved load-bearing by breaking each clause
  alone — zeroing the breath reds only the ride control while the worst-phase
  clause reports a comfortable **5.70x** on eight readings of one phase, and
  `hangDrop` 2.05 → 2.25 reds only the worst-phase clause while the ride
  passes. Left alone and queued as **H40**: the shipped clause's own reading is
  of the ease rather than of the hang.
  Done 2026-10-07, commit `c9e70f9`.
- **H34** The 13px neck at 8m is real, there is a 14, and eight phases was too
  coarse. H31 saw a 13 once in six runs and H33's eight-phase sweep on one map
  read 10-12 and recorded 2.33x of margin. **32 phases on each map** - the same
  stand, the same lane yaw, the same reference buffer, `figure.js`'s own
  `flatShadeSilhouette` - read the neck at 10-13 on the plant (13 in 5 of 32)
  and **10-14 on the yard** (14 in 1 of 32), so the real worst is **2.00x**
  against the clause's 1.5x. The **hood held at 28px in all 64 readings** on
  both maps and both lanes read a yaw of -3.142, so neither the hood nor the
  viewing angle was the variable: the neck is the only thing the breath moves
  at 8m, and the sweep was simply too coarse to find its own extremes. **Why
  eight is enough at 25m and not at 8m**, which is the real content of this
  job's "wrong way round": the breath is worth about one row at 25m, so the
  worst value is common (a 6px neck in six or seven of eight samples, which is
  what lets `breath.js` assert it from eight), and about three rows at 8m, so
  the reading spreads over five integers and the extremes are rare. **A finer
  measurement needs more samples to find its own worst case, not fewer.** The
  judgement is **no dense clause** - 33% of margin is left, the neck would have
  to reach 19px to fail, and 64 readings is too much to spend in a check that
  already runs 33s - so `tests/breathcensus.js` asserts the fact the margin
  rests on: the 8m hood is **one width at every phase**, swept over eight,
  with the worst ratio over them clearing the bar. Third time a pixel reading
  has turned out to be about how it was measured rather than about the body
  (H29's two readings, D64's band, H33's own eight phases).
  Done 2026-10-07, commit `bf8cf98`.
- **H33** Two phases survive a reset, and the census of what they reach.
  H31 found the mechanism — `updateVisual` runs on the wall clock from the
  render frame, `reset()` leaves the breath's phase alone, so the phase a check
  reads is a function of how many frames the whole run drew before it — and
  this is the census the queue asked for: eight entry phases of the 6.98s
  breath, every candidate check run through the registry exactly as the suite
  runs it, both maps. **Everything passed at every phase.** Three results.
  **There are two phases, not one**: `_animTime`, the gait, is advanced inside
  `updateVisual` by the ground covered, is zeroed in the constructor and not by
  `reset()` either, and it is the bigger lever — 24% of a pixel count on
  `look.js`'s walk and sprint poses (7,891-9,818px against a floor of 3,000)
  against the breath's 1-3% — and the harder to reason about, because it
  advances only while something walked. **The margins are wide except one**:
  figure.js reads 2,996-3,089px over a 2,000 floor at 8m and a neck of 10-12px
  under a hood that was 28px at every phase (2.33x of 1.5x), smallwindow 116-121
  over 51, bufferscale 1.7% of spread over a 10% tolerance because its law is a
  ratio between counts and the common part cancels — and **`hang.js`'s glove
  sweeps 0.075m of a 0.15m tolerance**, half of it, passing at 2.75x. That one
  was **invisible to the first instrument**: the census began as a diff of the
  numbers in each check's own detail line, and a passing check's numbers are not
  in its detail line at all (TRAPS.md), so it had to be read out of the module
  by eye and measured directly. **And four reasons a clause cannot be reached
  are now proved rather than asserted** — the Warden does not breathe (and held
  to the pixel at all eight phases, agreeing with `enforcer.js:407`
  independently), the camera's pivot has no `pose.lift` in it, the breath is a
  position and not one of the eleven rotations `animation.js` compares, and a
  difference taken inside the group cancels it. `tests/breathcensus.js` holds
  the census on H30's model, both ways, and proves each reason behaviourally in
  a window where the torso is shown to have ridden its 0.080m. **It caught
  three flaws in itself**: it declared itself, its camera clause was vacuous
  because the suite leaves camera ownership wherever the last check put it (a
  metre of body moved the camera 0.000m, and the control said so), and its
  "the body really moved" clause scaled with the very constant it was guarding,
  so zeroing that constant would have satisfied it with a body that does not
  breathe. It also answers **H34** from the other end and holds **D66**'s
  refusal. **D70**; the follow-ups are **H38** and **H39**.
  Done 2026-10-07, commit `d63abdc`.
- **H11** `npm run bench`: the frame budget on the real GPU, and the oldest
  eyes-only item on `PLAYTEST.md` closed with a measurement. Everything in
  this repo is verified headless on SwiftShader, which draws a frame in about
  400ms, so one check had been dropped from every gate since F5 and
  `PLAYTEST.md` asked Josh to press F4 then Y and read its line by hand - and
  for a month nobody did, which left the project's only statement about its own
  performance a CPU number from a software rasteriser. `scripts/bench.mjs`
  opens a **headed** Chrome on this PC's GPU (the window off the desktop),
  loads every registered map at every quality level, runs the checks
  `scripts/bench-checks.json` names and writes `bench/<date>.json`. **The
  answer: the frame budget holds everywhere, 3x to 6x under its ceiling** -
  twelve readings on `NVIDIA GeForce GTX 1060 6GB`, mean draw 1.12-1.83ms
  against 8.33ms, check 29's whole load CPU 2.00ms + GPU 2.01ms against 16.67ms
  at the worst of them, peak 387 draw calls against a 600 cap. The **GPU timer
  worked for the first time** (`EXT_disjoint_timer_query_webgl2` needs a real
  driver), so the project has GPU milliseconds at all now. Two findings beyond
  the budget: **`high` is nearly free here** (1.71ms against `medium`'s 1.75ms),
  and **`auto` picks `high` on both maps, 3.2-4.1ms, the two agreeing to
  0.2ms** where software GL had them 3.4ms apart - the gap D68 is about is
  mostly an artefact of the renderer the gate uses, though its mechanism is
  real and H25's fix stands. Three honesty clauses in the runner: it refuses to
  bench a software rasteriser, refuses to run beside a live `suite.mjs`, and
  runs exactly what the list names. `suite-skips.json` is **empty** now and
  `skiplist.js` holds it empty both ways; the drop moved to a list that makes a
  stronger claim and is held to a stronger standard -
  `the-bench-only-list-holds-only-checks-the-bench-itself-runs` requires every
  entry registered, argued from hardware, naming `npm run bench`, absent from
  the skip list, and **absent from `bench.mjs`'s own code**, so what the bench
  runs cannot drift from what the gate stopped counting. Proved by breaking
  both clauses at once and watching it name `bench.mjs:83` while leaving the
  same id in that file's doc comment alone. The gate's summary prints the
  newest bench's date, commit and verdict, or `NO BENCH ON RECORD`. **D69** is
  the judgement that a stale bench prints rather than reds; **H36** (the worst
  viewpoint is one frame and does not reproduce) and **H37** (the audit says how
  old the bench is) are the follow-ups.
  Done 2026-10-07, commit `209b420`.
- **H25** Auto's pick depended on which map you opened first, and was then
  stored for the life of that browser. H10's verify had measured the same
  machine twice - **8.70ms on the plant picking `low`, 5.30ms on the yard
  picking `medium`** - so the probe reads the machine **times the scene**, and
  the storing rule was *write the pick if nothing is stored yet*: the first boot
  that answered decided everything after it. A friend who opened the yard first
  got `medium` and then played the heavier map at a level their machine could
  not hold. **`rememberedPick(stored, picked)` in `quality.js` keeps the lower
  of the two**, which is the only rule safe in both orders - the easier scene
  cannot raise the level and the heavier one brings it down - with the preset
  table's own order deciding which is lower, so a fourth preset is ordered by
  where it is put rather than by a list somebody forgot to update, and an
  unrecognised stored value treated as nothing stored rather than compared
  against (**H21**). **D68** records the cost, which is real: the level now only
  goes **down** by itself, so a machine that was briefly busy is remembered as
  slower than it is, fixable in one click on the settings row. The two
  alternatives - a pick per map, and letting it drift back up on agreeing
  readings - are argued and refused there, the second as a feature rather than a
  fix.
  **The second half of the done-when turned out to be a one-word bug.** The
  runner's summary `break`s after the first run, so a two-map suite printed the
  plant's quality line and **silently dropped the yard's** - which is how a
  disagreement between two maps on one machine survived a month in the output
  every session reads. It prints one line per map now, and the confirming run
  shows both: *plant ... auto would pick medium (5.10ms over 8 frames)* and
  *yard ... auto would pick medium (4.80ms over 14 frames)*.
  One new check, `a-second-maps-probe-cannot-raise-the-level-the-first-one-stored`
  in `tests/autopick.js` (its own module because `tests/quality.js` is at 544
  lines and a block would have taken it past 600). It feeds **two real probes
  two different medians**, proves they pick differently before leaning on them
  (F8), holds the rule in **both orders** and over **every pair in the preset
  table**, and reads `quality.js` to confirm the storing path goes through the
  rule **and that the old first-boot guard is gone** - which is the clause that
  makes the job revert-detectable, because a pure function nobody calls is
  decoration (H27's frozen `rng.calls`). It deliberately does **not** complete a
  synthetic probe through `sampleQualityFrame`: that would overwrite
  `state.probe`, which the run record carries and `HANDOFF.md` quotes as *what
  auto would have picked*, and a check that makes the report lie about the
  machine is the exact class of bug H24 found in H23's check.
  Done 2026-10-06, commit `f4b031c`.
- **H32** The `AudioContext` device error, and the test nobody had defined. It
  had appeared in two of six verifies (H27 yard, H29 plant), been written off
  by H28 after a single clean one and brought back by H29 the same day, so the
  queue asked for a definition rather than another verdict. **The code side is
  closed.** The queue's cheap hypothesis - that the audio graph can be built
  more than once per page - is **false**: `AudioSystem.unlock()` returns
  `this.context` when one exists, and `src/systems/audio.js` is the **only**
  module in the whole of `src/` that names the realtime constructor, on three
  lines of 163 modules scanned. That is now a ban with one named owner on F13's
  model, red on a new namer **and** red if the owner stops being one. The other
  half of the message, *"or the WebAudio renderer"*, is ruled out by arithmetic
  already on the record: a run builds **seventeen** `OfflineAudioContext`s
  (sixteen sounds in `tests/soak.js`, the scuff in `tests/scuff.js`) and every
  one has rendered correct samples in every run ever recorded, where a failing
  renderer would have turned a sound check red. **And one correction to H27**,
  which argued in part that headless Chrome has no audio device: it has one, and
  the new check reads the live context as **running at 48000Hz** on both maps -
  so this is a device that intermittently errors, not a context that cannot find
  one. **What is still unknown is whether it ever happens cold**, and the finding
  there is that nobody had noticed the test already runs twice a day: **every one
  of the six observations is an end-of-session verify**, and the **GATE** is a
  cold run whose console-error count no session has ever written down. So
  `HANDOFF.md` now asks every run to record it, and **H35** closes the question
  on three gates rather than on another guess. Two changes make the next
  occurrence worth more than these five: the runner **stamps every console
  error with the map, the run and how many seconds into it the error arrived**
  (a device error arrives asynchronously with no stack, attributed to the page
  URL, so the Node end is the only one that knows where the suite was), and the
  summary **prints the messages** rather than only the count - which is how the
  first two came to be written off by sessions that had seen a number and not a
  sentence. Both halves of the stamp were proved by injecting a console error
  before a run and during one with `--pre`, because an error path nothing has
  exercised is not an error path. One new check,
  `one-module-owns-the-audio-device-and-an-offline-render-gives-it-back` in
  `tests/audiocontext.js`, which also holds a thing nothing held before: **an
  offline render gives the live context back by identity**, because
  `renderOffline` swaps the whole graph onto a throwaway context and restores it
  in a `finally`, and a broken restore would silence every sound in the game
  while the sixteen sound checks stayed green - they read the offline samples.
  Its census pattern is built from pieces so it does not flag its own source,
  which is H30's lesson, and it carries the must-match / must-not-match pair
  that keeps a census from reading zero when it breaks. **D67** records the one
  judgement: a console error is counted and printed but still does not fail the
  gate, because this one would have failed two of the last six correct runs.
  Done 2026-10-06, commit `9e94697`.
- **H31** The two figure checks asserted a 1.5x hood-over-neck ratio on a band
  three rows deep, and H29 had watched that band read 5px and 6px for the same
  body in different runs — a third reading of 7px would have been 1.43x and red.
  The queue insisted on the measurement first and the measurement settled it:
  **48 readings, six runs, both maps, face-on at 25m on the reference buffer —
  the hood 10px in every single one and the neck 4, 5 or 6px, never 7**, so the
  clause reads **1.67x at worst** against its 1.5x in all six runs to the digit.
  The two shipped checks agree independently, six readings each. So the first of
  the queue's three outcomes: **a comment naming the margin, not an edit**, and
  neither shipped clause was touched. **What moves the reading is the breath**,
  and that is the finding: the Shade's torso lifts 4cm standing still,
  `updateVisual` runs on the wall clock from the render frame rather than from
  `fixedStep`, and `reset()` deliberately leaves the phase alone — so the phase
  a check reads is a function of how many frames the whole run drew first, and
  at 25m a row is 4.5cm, so the breath is most of one. It slides the body past
  the pixel grid and the narrow part of the neck falls in one row or straddles
  two. **This corrects D64's account of its own numbers** and is **D66**: D64
  blamed a one-row height change sliding a two-row band onto the shoulders, and
  `band()` measures down from the top with both ends scaling together, so at 30
  rows the band is *three* rows at offsets 5-7 and at 31 rows it is **the same
  three offsets** — the pair D64 quotes cannot have moved it. D64's conclusion
  is untouched and reinforced: H29's instability reproduced here across six runs
  (1.33x-2.00x at 956x538, 1.00x-1.50x at 896x503, against 1.67x six-for-six at
  the reference), so the ratio still means nothing below the reference and
  nothing asserts it there. **The deeper option was measured and refused**: a
  fixed number of rows for the neck would not touch a variation that happens
  inside one row, and would change a helper two shipped checks depend on.
  **A second clause on the same band and the same 11% turned up**:
  `HOOD_OVER_ALL_BELOW` read exactly 1.00 against its 0.9 bar, thinner in
  character than the ratio. One new check,
  `the-hood-holds-its-ratio-at-every-phase-of-the-breath` in `tests/breath.js`,
  advances the breath an eighth of a cycle at a time through `updateVisual` at
  the fixed step and asserts **both** clauses at the worst of eight phases — a
  claim neither shipped check makes, since each takes the one reading its own
  arrival gave it. It is stable because the worst value is common, not rare: a
  6px neck came up in six or seven of eight samples every run, so six runs read
  1.67x and 1.00 to the digit while the individual phases moved. `figure.js`
  gained a row `profile` so a check can print **where the bands actually fell**
  rather than only what they returned, which is what made the sub-pixel reading
  legible in 347 of the 400 characters a detail line keeps. Its follow-ups are
  **H33** and **H34**. The gate for this job was H30's own VERIFY, byte-identical
  tree, because this run's gate was lost to a background timeout shorter than
  the gate — two rules in `TRAPS.md`. Done 2026-10-06, commit `7d73ed0`.
- **H30** Every pixel floor under `src/tests/` is a fraction of the drawing
  buffer, or says why it is not. H28 scaled the six floors H24's off-level runs
  had caught and left the rest with an honest note: *none of them is red at any
  level today, which means only that no level happens to cross them* - which was
  exactly true of H28's six before anybody ran the suite at `low`. The census
  came to **twelve**. **Eight scaled**: a body in `visual.js` and in
  `presentation.js`, an alarm fixture, the killer in the death cam, a vent region
  and a route strip in `legibility.js`, and the rim in `presentation.js` - each a
  thing in the world projected into the frame, so its pixel count goes with the
  square of the buffer height. **One was already right**: `feedback.js`'s damage
  vignette, written as 5% of the frame because it covers the whole view, and the
  precedent the rest followed. **Three stay absolute** and that is **D65**:
  `visual.js`'s *"tripping the camera changed nothing on screen"* at 10px and
  `feedback.js`'s hit marker and damage arc at 20px each, none of them a claim
  about size - each says *something was drawn at all*, with the size and
  placement asserted as fractions of the height in the clauses right beside it.
  Scaling a tripwire makes it **looser on a small buffer**, which is backwards.
  One judgement went the other way and is in D65 for argument: the rim at 200px
  was **scaled** rather than made a fraction of the body it rims, because the
  share of a silhouette its edge occupies falls as the body grows, so a fraction
  of the body would be a harder claim than the line has ever made. **One thing
  the queue had wrong**: it named `readability.js` as holding floors and it holds
  none - it never calls `createLens`. The smoke floor is the one that did not
  take `scaledCount`: *obscuring* is a share of what the player can see, so it
  reads the fraction of the frame the check already computed and printed,
  derived from its own 5,000 pixels over the reference buffer. One new check,
  `every-pixel-floor-under-tests-is-a-fraction-of-the-buffer-or-says-why-not` in
  `tests/pixelfloors.js`, built on F13's model rather than a comment convention:
  a table of allowances with reasons, red on any new count-against-a-bare-number,
  **and red when an allowance goes stale**, because an exemption for something
  that has gone is one the next line inherits without arguing. It was proved by
  reverting one floor and watching it name the file and line, and it **caught
  itself** doing it - the first draft spelled its own test string out as a
  literal, which `donedef.js` solves the same way, by not spelling its subject
  out. It also exercises its pattern every run, because a census whose regex
  rotted would report zero floors and pass. Done 2026-10-06, commit `4a977a2`.
- **H29** Does a small window keep a body legible at 25m? **No measurement can
  say, and that is the result.** D63 moved the two figure checks onto the
  resolution `medium` ships and recorded the cost: nothing was then asking
  whether a genuinely small window keeps a body readable. Asked directly, of the
  drawing buffer rather than of the level, over five sizes face-on at 25m on both
  maps — and the answer came back **unstable between two runs of one suite**:
  8/4 = 2.00x against 8/6 = **1.33x** at 956x538, and 6/4 = 1.50x against 6/6 =
  **1.00x** at 896x503. Eight consecutive isolated runs had agreed to within one
  pixel of neck first, which is why it is worth recording: it looked like a stable
  measurement and was not one. **The cause is not quantisation of a row.**
  `band()` takes the neck as the rows between 14% and 22% of the silhouette's
  height, and at 25m in those buffers the silhouette is **30 rows tall and 8
  pixels wide** — so the band is *two rows*, and the body's measured height
  moving by one (31 to 30, 24 to 23, all the runs differ by) slides them onto
  different anatomy, where `narrowest()` returns the shoulders. The two readings
  measure two different things. **A hood cannot be told from a neck inside eight
  pixels of width**, which vindicates D63 more strongly than D63 claimed: pinning
  the figure checks to the shipped resolution was not a dodge around a threshold,
  it was the only buffer the instrument works in. So the check asserts only what
  held in both runs on both maps — the body is found, covers its share of the
  buffer (a fraction of it, H28), and keeps its proportions at 3.0:1 or better
  against a bar of 2.2, which is stable because it is a ratio of the whole
  silhouette and not of two bands two rows tall. The hood and neck are in the
  detail line and nothing asserts them. **D64** records it and **retracts this
  job's own first conclusion** — that the hood reads at every size and no
  minimum-resolution line was needed — which rested on the run that read 4px
  necks; the honest statement is that at 1366x768 on `low` the Shade is 30x8
  pixels and whether that reads is not a thing a pixel count settles. It is an
  eyes-only ask in `PLAYTEST.md` now, one specific look. One new check,
  `a-small-window-keeps-the-shade-a-hooded-figure-at-25m` in
  `tests/smallwindow.js`, reading through `flatShadeSilhouette`,
  `silhouetteFloor`, `yawToward` and `NARROW` rather than copies, restoring
  through `applyQuality()`. Two traps cost a run each: **a detail line is cut at
  400 characters** with no ellipsis, in `--details` as well as the report, and **a
  passing check's numbers are not in the report at all**. And a third lesson that
  is not a trap: **eight agreeing runs of a check in isolation did not predict a
  full suite**, because the body's measured height moves by a row in full-suite
  context — a new check's flakiness has to be proved where it will live. Done
  2026-10-06, commit `fa064e2`.
- **H28** Six checks read a picture only `medium` draws — and **five of them
  were not about the level at all**. The runner's window is 1280x720 and
  `resolutionScale` is 0.7 / 1 / 1.25, so the drawing buffer is 896x503 at
  `low` and 1600x900 at `high`, and five checks held **absolute pixel geometry**
  against it: a figure's coverage floor of 2,000 that a correctly drawn Shade
  cleared with **3,014px at `medium`** and missed with **1,455 at `low`**, a
  pose's 3,000 read at 2,459, the two-body frames' 300/2,000/6,000, the post's
  20-pixel fixture and 500-pixel corner band, and the outline's 400.
  `scaledCount` / `scaledColumn` / `scaledRow` in `tests/pixels.js` are the fix,
  and the law is that a count scales with the **square of the buffer height**
  and not with its area — `render.fov` is vertical and the horizontal follows
  the aspect — measured at 5,750.8 / 5,814.0 / 5,730.9 pixels per
  megapixel-of-height across the three buffers, a spread of 1.4%. **The sixth
  had been diagnosed wrongly twice**, by H24 and by this queue, as a
  *"1024-only reading"* of a sharper shadow map: it reads columns 700-1270 of a
  896-wide buffer at `low`, which runs off the end of each row and 374 pixels
  into the row above, so the check assembled a staircase out of two rows and
  called it shadow stripes. Fixing the window exposed **F8's instrument clause**
  underneath, where a crossing count turns out to be a count of the shadow map's
  texels (14/9/6 at 512, 23/21/12 at 1024, 50/44/25 at 2048) — the amplitude
  is the scale-free reading, so the clause requires every row's residual to
  deepen **2.5x** when the fix comes off, measured 0.16/0.10/0.11 luma to
  0.71/0.48/0.37. The outline and post checks **assert the absence** at a level
  that draws neither, which is the stronger half of each pair and caught a defect
  nothing else could: the outline check ended `hull.visible = true`
  unconditionally, so at `low` it turned the outlines on and left them on for
  every check after it. One new check,
  `a-pixel-reading-is-a-fraction-of-the-drawing-buffer`, reads the Shade at the
  three buffer sizes **through the figure check's own floor function** rather
  than a copy of its numbers, so a floor that stops scaling fails at the pin
  without anyone running another level — and its last clause asserts that the
  smallest buffer's 1,455px is *under* the reference floor of 2,000, which is
  "a fixed number would have failed here" proved rather than remembered.
  `tests/visual.js` was at 589 lines against the ~600 guidance, so the outline
  block came out into `tests/outline.js` (180) and took it to 485. **D63** is
  the one judgement and it records a cost: the two figure checks read a
  silhouette at the resolution `medium` ships, because at `low` the Shade at 25m
  is 28x8 pixels and a hood cannot be told from a neck inside eight of them —
  a reading about the runner's **window**, not the level, since `low` on a 1080p
  display draws more pixels than the reference — but nothing now asks whether a
  genuinely small window keeps a body legible, which is **H29**. The seventh red
  H27 left, `frame-budget-under-the-check-29-load`, is **green at `low` on both
  maps** and goes on the record as machine load. Done 2026-10-06, commit
  `de439c3`.

- **H27** Two streams off one seed, so the picture cannot move the game.
  `effects.sparks()` drew three numbers per particle from the one seeded `rng`
  and the preset scales the count, so an impact cost **15 draws at `medium` and
  6 at `low`** and every simulation draw after the first bullet to land came out
  different — the Warden's next burst pause 0.3745 against 0.3492. That made the
  quality row a thing that changes the game, made `?seed=N` reproduce a match
  only at its own level against what Section 16 check 28 promises, and would
  have made H13's replays wrong by construction. Now `rng` is the simulation's
  and **`lookRng` is presentation's**, with `systems/effects.js` its only caller
  across all fourteen draw sites, and `rng.reseed()` seeds both from the match
  seed because two reseed functions is one a caller can forget. It is a layering
  rule rather than a patch on one function: nothing presentational draws from
  the simulation's stream, so the next effect somebody writes cannot bring this
  back. **D62** holds the three options; the rejected one — draw the full
  unscaled count, light some — was the safer call on the day, since splitting the
  stream moves every simulation draw at every level, and the risk did not land:
  **28 of 28 seed-sensitive checks on the plant and 25 of 25 on the yard passed
  first time**, `a-match-replays-identically-from-its-seed` included, with no
  threshold touched. One check,
  `the-quality-level-cannot-move-the-simulation`, drives one seed through all
  three levels and requires the simulation's draw count, its next number, the
  Warden's pose and the AI's state to be identical **while requiring the levels
  to light different particle counts** — or it would pass just as well with
  `particleScale` 1 everywhere, which would fix H27 by deleting the feature.
  Two of its own mistakes are written up because neither was caught by a check:
  an object spread froze `rng.calls`, the determinism canary, at 0 (now a trap),
  and a `smokeBurst()` with no gadget behind it left 200 sprites alive and spent
  a whole low run asserting about it — the half of a trap already in `TRAPS.md`
  that this check walked into from the other side. Done 2026-10-05, commit
  `8d5b81a`.

- **H24** The suite run at `low` and at `high` for the first time, on both maps.
  **At low, eight checks answer differently** (seven of them real level
  effects): `exactly-one-shadow-caster`, `the-outline-darkens-the-silhouette-
  edge`, `post-processing-blooms-...-and-is-a-switch`,
  `the-shade-reads-as-a-hooded-figure-at-8m-and-25m`,
  `the-warden-and-the-shade-are-told-apart-by-silhouette-at-25m`,
  `a-look-at-a-pose-photographs-the-state-named`, plus
  `a-wall-the-key-lights-from-behind-reads-plain` on the plant and
  `the-warden-fires-in-bursts-of-rounds-at-the-torso` on the yard. **At high,
  two**: `exactly-one-shadow-caster` on both maps and `a-wall-...` on the
  plant, which turns out to be a **1024-only** reading rather than a
  medium-or-better one - 7 crossings at 512 and 11 at 2048 against a ceiling of
  6. Two were fixed here, because the done-when allows a check to read the
  level: `exactly-one-shadow-caster` compared the live shadow map to
  `CONFIG.render.shadowMapSize`, which stopped being the answer when H10 made
  it a preset knob, and reads `qualityPreset().shadowMapSize` now - green at all
  three levels and strictly stronger, since it catches a level that failed to
  apply its map. And the high run exposed a defect in **H23's own** check: the
  run record said `drawing high quality (auto, from the probe)` while drawing a
  pinned `high`, because `syncQuality()` publishes only when a knob turns and
  the pin came back to the level already applied - so `pinQuality()` publishes
  now, held by a new check. **The finding that matters is none of that**: the
  eighth red is not a level effect. The preset scales the particle count,
  `effects.sparks()` takes three shared-`rng` draws per particle (15 at medium,
  6 at low) and the AI's burst pause comes off the same stream, so the quality
  level moves the simulation - **H27**, with the proof measured. Also now on
  record, and nobody had it: the suite costs **384s / 210s at low, 1,014s /
  698s at medium, 1,560s / 1,138s at high** (plant / yard), so low is 2.6-3.3x
  faster and high 1.5-1.6x slower. The remaining six are **H28**. Done
  2026-10-05, commit `daf15db`.

- **H23** One level for the whole strip of cards. `thumbnails.start()` takes
  `holdQuality()` for the length of the set it bakes, so `syncQuality()` applies
  nothing until the release — and on a first boot, where `auto`'s probe answers
  about one card in, the strip can no longer come out at two levels. The level
  in force keeps moving underneath the hold (the probe still writes
  `SETTINGS.qualityAuto`, the row still works) and the release applies whatever
  the answer is by then; a second holder is **refused** rather than counted,
  because two holders and one release is a page stuck at whatever level the menu
  opened at. Each card records the level it was drawn at —
  `appliedQuality()`, not `activeQuality()`, because what a card can be asked
  about is the picture it got. **The finding is that the picture was never at
  stake**: measured before a line was written, a card is byte-identical at
  `low` and at `medium` while the renderer is demonstrably at low (896x503
  buffer, 512 shadow map, 0 of 13 outlines shown, no post), because none of the
  five knobs is in a card. So the hold makes `record.quality` a true sentence
  rather than repairing a strip — insurance, kept because the day a knob does
  reach a card it is already the fix. **D61**; **H26** is the other option.
  One check in a new `src/tests/qualityhold.js` (`tests/quality.js` was at 599
  lines and the block took it to 606): it reads the real boot's own set for
  free, drives a first boot with the probe's one assignment landing between the
  first card and the second, and then **drops the hold and requires the set to
  split** — `plant at medium and yard at low` — which is what says the hold is
  load-bearing. It declares `glSync: true`, because the first
  `readRenderTargetPixels` of an extra set read **40,572ms against a 171ms
  build** and 266ms moments later: F11's queued pipeline tail in a new place,
  a wait and not work. Done 2026-10-05, commit `ca5b762`.

- **H10** Quality presets: **low / medium / high / auto** over the shadow map,
  the resolution scale, the post, the particle counts and the outline pass.
  `src/quality.js` is the rule and `CONFIG.quality` the table, and **`medium`
  is exactly what the game drew before there were presets** — 1024 shadow map,
  the device's own pixel ratio, full particle counts, outlines on, post on —
  pinned knob for knob to the constants each number came from, because every
  reading on record was taken there. Low is 512 / x0.7 / a third of the sparks
  / no outlines / no post; high is 2048 / x1.25, and `maxPixelRatio` caps the
  product so **high asks for no more pixels than medium on a 2x display**,
  which the check asserts rather than the row pretending. The probe **records
  and does not decide**: what is applied is `activeQuality()` — the URL's
  `?quality=` first, the settings row second, auto's stored pick third,
  `medium` before there is one — asserted every frame by `syncQuality()` as
  H9 asserts the field of view, which is what makes the settings row safe
  against a census that clicks it. The post is the player's row **AND** the
  level rather than the level rewriting the row (D60), so `applyQuality`
  writes no setting at all. The queue predicted auto would pick `low` under
  software WebGL; it picked **`high`**, because the probe samples the CPU clock
  around the draw and a software renderer queues a third of its work for the
  pipeline tail F11 named — so it is judged against `cpuBudgetFraction`'s
  8.33ms now, and a check feeds it a median between the two budgets to pin it
  to the right constant. Four checks in a new `tests/quality.js`, each ending
  at a live object (the drawing buffer's own width, `shadow.mapSize`,
  `post.passes`, the frame's draw calls, the particles a burst lit) and each
  asserting its own restore, because this is the one module in the suite that
  resizes the drawing buffer. It also took `scripts/suite.mjs` past 600 lines,
  so the verdict and the printing are `scripts/suitereport.mjs` and
  `tests/pipelinewait.js` followed them, gaining the other half of its pair.
  Done 2026-09-29, commit `53b52c6`. Follow-ups **H23** (the menu's cards and
  the probe race on a first boot), **H24** (nobody has run the suite at `low`
  or `high`) and **H25** (auto's pick depends on which map you open first: the
  plant reads 8.70ms and picks `low`, the yard 5.30ms and picks `medium`).

- **H9** Look and camera settings, five rows at the top of the settings page:
  **sensitivity per axis** (`mouseSensitivity` turns, `mouseSensitivityY`
  pitches, equal by default so no feel changes until one moves), **invert Y**
  (already there, now read through the camera), a **field of view per role**
  (`fovShade` for the 2.2m boom, `fovWarden` for the eye, 60–100, both
  defaulting to the `CONFIG.render.fov` every reading on record was taken at),
  and **head-bob**, which did not exist and now does. The FOV became one
  decision made in one place: `cameraOwner.applyFov(owner)` asserts it every
  frame and `set()` resets a handover to the next owner's *resting* field, so
  a cinematic that hands the camera back at the engine's FOV by contract is
  corrected on the next frame instead of leaving a wide-FOV player narrow
  until the next handover. The Warden's aim now narrows from the player's own
  FOV to `adsFov` **absolutely**, so a wide view buys a bigger zoom and the
  same sight picture. The bob is `headBobLift` in `entities/pose.js`, one rule
  for both bodies, on the gait phase the legs already swing on and **upward
  only** — down on this camera means a landing or a mantle (B8). D59 holds the
  three judgements; it ships **off**. Three checks in a new
  `tests/camerasettings.js`, each ending at the one camera: its world aim, its
  **projection matrix**, its world height. The bob's is the one worth reading —
  it sprints each body down the same lane twice, off and on, and takes the
  difference of the two camera traces, which cancels the ground, the landing
  dip and the boom's pullback and simultaneously proves the bob moves the body
  by nothing at all. H7's own census caught the four new settings before the
  suite did: `changedValues()` in `tests/settingsstore.js` returns the name of
  any persisted setting it has no round-trip value for, so the four had to be
  given one. Done 2026-09-29, commit `94385d7`. Follow-ups **H21** (a stored
  number outside its bounds is accepted by type) and **H22** (thirteen rows
  want H20's grouping).

- **H8** Rebinding: a Controls page off the settings menu with a row per
  action, press-to-bind, conflicts shown on both rows, and defaults restored
  per row. A rebind writes the action's **first** key and leaves the
  alternate, so `W / Up` becomes `T / Up`; the row's own reset brings the
  shipped pair back. A key bound twice is **shown, never refused** — the
  game fires both and the page's job is that the player knows — from
  `bindingConflicts()` in `input.js`, so the rule is a fact about the input
  map and not about the page. Escape leaves a capture and is therefore the
  one code nothing can be bound to; a mouse button is bound by pressing it
  on the waiting cell. D58 is the judgement. The defect the check found:
  **binding a key also fired it** — the keydown reaches the Input as well as
  the menu and the listener order is not ours, so the Input is gated from
  the bind to the keyup (`swallowPress()`). Two checks, plus a third in
  H7's file for a gap this found there: the keyboard sliders moved a setting
  and never reported it, so a keyboard-only player's sensitivity and volume
  were the two a reload forgot. — `77fdad0`

- **H7** Settings that survive a reload, which is what three jobs in a row
  had been writing "until H7" about: the role row and the last map (H5) and
  whether this browser has been offered the tutorial (H6). A versioned record
  under one key; a version it does not know is ignored rather than migrated;
  a record edited by hand can only set a key the defaults have at the type
  the defaults have. **Every access is wrapped** — `localStorage` throws
  rather than returning null when site data is blocked — and a failure
  carries a reason instead of stopping the boot. The one setting deliberately
  not kept is the **debug gate**, named in `NOT_PERSISTED` and held against
  the defaults by a check in F15's shape, so a setting added later is kept
  unless somebody writes down that it is not. A reset row on the settings
  page clears the record rather than filling it with defaults. Three checks.
  — `de878a6`

- **H6** The first-run tutorial: eight moves, each cleared by doing it. The
  design is one sentence — a prompt clears on the **act**, not on the key —
  so `systems/tutorial.js` watches the controller's state after each fixed
  step and never reads the input. Two of the eight carry the argument: a
  climb counts only when the feet end 0.4m above where it began, and "slide
  into a duct" is being inside one within 1.5s of a slide step, because a
  slide that ends one step past the mouth taught the move all the same. Where
  it is offered is derived (`tutorialFits`: a duct a crouched body fits and a
  standing one does not) — the plant has two at grade, the yard none, so the
  yard asserts the opposite rather than skipping. `TUTORIAL` is a third
  configuration of `initMatch`, never a third code path. The hazard was the
  same shape as H5's: `tutorialSeen` starts false, so the three checks that
  click the real Play now state their precondition instead of inheriting it.
  Two checks, one of which drives all eight prompts through the real
  controller. — `812f16a`

- **H5** The main menu: a card per map, rendered from the map. The fork the
  job named — bake every registered map, or draw a card from something
  cheaper — was priced with four probes before a line was written. Each bake
  slice on its own clock says the last three (rooms, the Warden's ground,
  validation) are 408ms of the plant's 632 and **put nothing in a scene**, so
  the bake gained a cut: `DRAWN_SLICES` 3 of 6, `buildDrawnMap`, every slice's
  yield carrying the map so a half-built one is reachable, and a check that
  pins the cut from both sides (266 meshes at 3 slices, 265 at 2). Two eyes
  came back black — the fog is 96% of the picture at 110m, and the maps are
  lit for a dark interior — and a third, at the Shade's spawn and then at the
  site, found that **there is no exterior eye that shows the plant's inside**.
  `start()` is called after `window.BLACKLINE` is published, so nothing of the
  5.0s (4.0s of it a SwiftShader readback that is 4ms of work) is on the boot
  H4 measured. Plus the role row, How to play, Credits, and a keyboard that
  walks all five pages, which the game had no path to at all because `Tab` is
  suppressed. Five checks. — `841c66c`

- **F18** A rate held by a check that counts bursts, not rounds — F17's
  second clause, done properly. Its first form was a floor under the *hit
  fraction* and was red the day it was written (0.181 against a line of 0.19),
  because **the rounds of a burst share one aim draw**: twelve engagements are
  ~300 rounds but only ~65 trials, and a fraction over 65 moves five points
  for nothing. Counting bursts fixes the unit; **god mode** fixes the bias
  that mattered more — an engagement ends at its first landing burst, so the
  sampler stops exactly when the cone succeeds. Forty 30s windows on a Shade
  that cannot die is ~1,070 independent bursts at a standard error of 0.015,
  which reads 0.400/0.432 at the old cone and 0.541/0.579 at the new one and
  leaves [0.477, 0.495] for a line; `MIN_BURST_LANDING_RATE` is **0.486**,
  3.6 standard errors clear on both sides on both maps. A window also asserts
  it ended in ENGAGE and that the Shade came out unhurt, so a broken god mode
  cannot read as a worse cone. Proved by putting the cone back to 5.0: red on
  both maps on the rate clause alone. Costs 15s a plant run and 9s a yard run,
  1.5% of each. — `443a4a7`

- **F17** A fresh seed turned the yard's difficulty check red, and the cone
  was the reason — reproduced to the round (yard, easy, 16m, seed
  `1637054825`: 23 bursts, 119 rounds, 2 hits, alive at 30s), then read shot
  by shot: **not one of the 119 came near the body**, and seven hit the
  ground at 11.5–14.9m, exactly where a 5-degree-low round from the eye
  meets the floor. No geometry, just the cone: at 16m the Shade subtends
  ±1.22 degrees against a ±5 degree draw held for the burst's 3–7 rounds, so
  a burst is **one trial** and the kill is geometric — mean 6.3s, 1.6% of
  engagements past the 30s limit, about one fresh-seed run in four.
  `easy.aimErrorDegrees` **5.0 → 4.0** (D54) and nothing else; 3.5 and the
  per-round draw were both measured and both rejected for spending the
  separation between presets (the per-round draw ties medium and hard at 8m
  at the gun's rate-of-fire floor — that is K6's).
  `the-widest-cone-kills-at-range-and-not-once-in-a-while` drives twelve
  pinned engagements and asserts none is a stall, two of them the regression
  itself, one per map (`1637054825` the yard's, `4196849476` the plant's,
  hunted through 82 seeds at the old cone). `KILL_LIMIT` and `DETECT_LIMIT`
  untouched. — `3316d07`

- **H4** Boot — a loading screen in `index.html` (markup, so it is up from the
  first paint) naming each of the **six bake slices**; the bake is a generator
  per map with the shared tail in `mapfinish.js`, driven straight through by
  `buildMap` and a slice at a time by `bakeMap`, so there is one build path and
  two drivers; a `MessageChannel` yield between slices, because `setTimeout` is
  banned and `requestAnimationFrame` never fires in a hidden document; boot is
  a promise and `window.BLACKLINE` is published at the end, so the runner's own
  wait needed no change. No WebGL2 is `createRenderer()` returning null and a
  fatal panel — **that took 16s off every headless page load** against the
  `getContext` probe it replaced; a touch device is told and boots behind a
  dismissible one. `a-browser-without-webgl2-is-told-so-plainly`,
  `a-touch-device-is-told-and-the-game-boots-behind-it`,
  `the-bake-yields-the-page-a-frame-to-paint` — `d191a9b`, 2026-09-27,
  scheduled run.
- **H3** A version you can see — `version.json` at the root (commit, short,
  committer date, branch), written by `scripts/version.mjs` / `npm run stamp`
  and **only from a clean tree**, so `npm run suite` stamps HEAD at the gate
  and leaves the file alone mid-job; the main menu's footer reads
  `dev · 97354db · 2026-09-27` locally and `97354db · 2026-09-27` on Pages,
  because the *host* decides dev, not a field. No deploy workflow exists
  (H2), so the `Record <job>` commit runs `npm run stamp` alongside writing
  the job's hash — D52. `the-build-stamp-is-a-real-commit-the-site-serves`
  and `the-main-menu-footer-names-the-build-it-is-running` — `2af44b2`,
  2026-09-27, scheduled run.
- **H2** GitHub Pages from the working branch — a branch deploy of
  `phases-14-45` (`.nojekyll`, the branch allowed in the `github-pages`
  environment; an Actions workflow was built and refused: the CLI token has
  no `workflow` scope), an empty favicon so no host 404s, and `npm run suite
  -- --url <origin>`. Live: plant 29/29 and yard 29/29 of the regression set
  against https://papasauce11.github.io/blackline/, 0 console errors — `ab9cc59`, 2026-09-27, Josh's
  session.
- **H1** The remote — https://github.com/papasauce11/blackline, `main` and
  `phases-14-45` pushed, a repo-local credential helper (`gh auth
  git-credential`) so the routine pushes unattended; both routine prompts push
  after every commit — 2026-09-26, Josh's session.
- **F16** Every run-pair on record, and a correction to F11. F11 closed earlier
  the same run with a finding attached - two runs of a map share one page, so
  the renderer tail it had called "never paid, because the page is torn down
  first" was carried by the next run - which makes every pair of run times in
  this repo two measurements of different things. Read: the second run of the
  plant is the slower one in **every pair on record**, by 30-98s at 130 checks
  and 145-190s at 177, and the yard's gap is smaller and sometimes negative.
  The arithmetic of the close: plant run 1 went 757s → 963s (+206s, the drain
  F11 added) while run 2 went 935s → 957s (+22s), so run 2's actual checking
  got ~184s faster - that 184s was the burden, and paying it at the end of run 1
  removed it. **What falls is F11's account of where run 2 paid it**: F5's own
  verify already had `a-zero-size-viewport-does-not-blind-the-renderer` -
  run 2's first synchronisation - at 268,927ms in run 1 and **252,906ms** in
  run 2, sixteen seconds cheaper while run 2 was 189s longer. The burden is
  real and sized; where it lands is not established, and F16 names no mechanism
  rather than name a second wrong one. Flagged and unsettleable from the
  record: F11's three-placement table (753s / 989s / 765s, "each a full plant
  run") never says which run of a pair each came from, against a 178s gap - the
  conclusion survives on the within-run half of the same evidence. `judge()` in
  `scripts/suite.mjs` now reports `spreads` per map and the summary prints the
  spread in ms, as a share of the longest run, and in the pipeline wait;
  reported, never judged. `the-pipeline-wait-is-the-runs-number-and-not-a-checks`
  gained the two clauses this rests on and F11 left unheld: a **top-level** run
  drains after its last check (through `_runChecks(tests, true)`, the only way
  a check inside a run can be one), and the runner still computes the spread.
  Commit `ac96f2b`.

- **G2** The traps got a home, and this page got under 400 lines. D47 chose
  option 2: `HANDOFF.md`'s Environment traps - 203 lines of its 578, two thirds
  of the page every run pays to read, against a section a run reads once and
  deliberately - moved to a sibling `TRAPS.md` with a header saying what the
  file is and that a trap is retired by name in `PROGRESS.md` and never by
  deletion. `HANDOFF.md` is **394 lines**, which is G1's unreachable target
  reached; the pointer left behind keeps the heading (the scheduled task's
  prompt falls back to it while it exists) and keeps two traps in full, the two
  a reader of that page should never be without. The one thing the move needed
  was the line in the routine's own prompt, outside this repo, which is what
  made it Josh's and not the routine's; it was edited in the same stroke.
  Nothing was retired. New check `traps-md-holds-the-traps-and-handoff-points-at-it`
  in `src/tests/donedef.js` holds both ways it could be undone - TRAPS.md gone
  or emptied below a floor of 25 traps, and HANDOFF.md back over 400 - and
  proved red with the file moved aside. Commit `3d355be`.

- **F11** One check was a quarter of the plant run, and the quarter was a
  wait. D48 chose option 3 and this carried it out.
  `AutoSuite.drainPipeline()` is the suite's own synchronisation in two halves:
  a **polled fence** (`fenceSync` plus `clientWaitSync(sync, 0, 0)`, which
  answers at once) that yields a task and beats four times a second while it
  waits, and the bounded `getError` drain behind it that clears the error
  state. A check declaring `glSync: true` is drained for by the runner before
  its own clock starts; a top-level `runChecks` drains once more after its last
  check; the total comes back as `pipelineWaitMs` and the run line prints it. A
  nested `runChecks` does not drain at the end, or a check driving the runner
  would pay the very wait this moves off a check.
  `a-zero-size-viewport-does-not-blind-the-renderer` keeps all five assertions
  and 265,944ms became **24ms** (yard 174,279ms → 19ms); the slowest check in
  the suite is now `every-route-reads-lit-from-its-foot` at 77s, so `--stall`
  came down 600s → **240s**, with `--stall-wait` (600s) for the declared wait.
  The fence does see the tail and does poll: the new check's own drain answered
  in 30,306ms across **61 beats**, one every 250ms as written. And it found
  what the wait had been costing - two runs of a map share a page, so run 1 left
  its tail behind and run 2 carried it, which is why the second run of a map had
  always been ~180s slower. The pairs now agree (963s/957s, 646s/653s) for one
  tail per map per suite. New `src/tests/pipelinewait.js` holds all of it,
  including both halves of who is drained for. Commit `645370a`. **F16 corrected
  one clause of this**: the burden is ~184s and real, but it is spread through
  run 2 and not paid in its first synchronisation, which F5's own readings
  already showed.

- **F15** The one documented way past a red gate, closed. `judge()` in
  `scripts/suite.mjs` dropped every id in `scripts/suite-skips.json` before it
  computed red or flaky - `skipped.push`, `continue` - so a check named there
  left the run green whatever it answered. Right for the one entry in it, and
  also a one-line way to make any red check vanish; the rule about what may go
  there lives in the scheduled task's `SKILL.md`, outside this repo, and
  nothing held it. Proved before it was fixed, two runs of one command with a
  deliberately-failing check registered through `--pre`: untouched file
  `"ok": false` and exit 1, two lines of JSON added `"ok": true` and exit 0.
  Two halves built, because either alone can be walked around. New
  `src/tests/skiplist.js` (143 lines) holds the file and its own `ALLOWED`
  list to the same set **both ways**, every skipped id to being a check the
  registry actually holds, every reason to being present, 40+ characters and
  naming the hardware that is the only ground the rule allows, and its own id
  to being absent from the file. `scripts/suite.mjs` honours a skip on a map
  only while that check ran and passed there: `guardGreen` per map, absent
  counting as not green, a withheld skip judged like anything else and named
  in `skipsWithheld` and in a `SKIPS WITHHELD` summary line. Red proved four
  ways, each a real edit reverted after - an undeclared entry (all three
  clauses at once), the real entry deleted, and the guard's own id added,
  which came back red *and* took its own skip away, the frame-budget check
  with it. What it cannot see is said plainly: whether a reason is true. 4ms
  then 3ms a map, 0 flaky. Commit `1c92f48`.

- **F14** The suite counts itself. Nothing asserted the AUTO registry's size
  or its wiring: delete one `registerX(debugTools);` line from
  `registerAutoTests()` in `tests/index.js`, leave the import alone, and
  `node --check` passes, the page boots, that module's checks are registered
  nowhere and the gate exits 0 on the smaller suite - nothing red not being
  the same as everything run. Measured first through `npm run probe`, because
  the arithmetic had to be a fact before a check could assert it: 56
  registrars imported and all 56 called, 185 registrations declared in the
  modules' text against 184 live. Both ends of that gap are real -
  `a-staged-hang-never-returns` is registered only under `?hang=1` (F10), and
  `heartbeat.js:63` writes its id as a file-local const, so the first probe
  regex read 184 against 184 and **balanced by coincidence**, one miss
  cancelling one conditional. New `src/tests/registry.js` (131 lines) holds
  four things: every imported registrar called exactly once and nothing else
  called (order deliberately not asserted - `registerPerformance` is last on
  purpose); every declared check registered; every registered check declared;
  and the conditional ones named with their reason and still declared, since
  an entry for something that has gone is an entry the next missing check
  hides behind. An id the census cannot read is red with its file and line,
  never skipped - skipping is what a careful author does and it is wrong
  here, because the failure being closed is a count that quietly falls. What
  it cannot see is said plainly: a module dropped from both lists at once
  leaves nothing in `index.js` to compare against, and `MIN_TEST_MODULES`
  only catches the registrar collapsing. Red proved by deleting
  `registerScuff` and by making `SELF` unreadable while keeping it valid.
  892ms cold, 346ms warm, 0 flaky. Commit `be232ec`.

- **F13** The two bans the spec states, held by the gate at last. Section 18's
  definition of done carries "`Math.random()` appears nowhere in `src/`";
  Section 9 and the Section 15 risk register carry "no `setTimeout` for any
  gameplay-affecting timer". Both are why the seeded rng and the ticked effect
  registry exist, and both were gated by nothing - the weekly audit greps the
  tree and reports a count, the suite never looked, so a run that landed a
  third call passed green and the drift surfaced up to seven days later.
  `no-source-file-calls-math-random-or-sets-a-timer` in `tests/donedef.js`
  reads every module the page loaded - the Resource Timing list the two checks
  beside it read, 135 of them; a file nothing imports never executes, so the
  loaded set is the set the bans are about - and holds three things: no call
  to `Math.random(`, `setTimeout(` or `setInterval(` outside the one file each
  ban allows; each allowance still exactly one call, because an exemption for
  something that has gone is one the next call inherits without arguing; and
  each allowed call argued in a comment within eight lines above it, because
  an exemption living only in a table is one nobody reading the code can see.
  Prose is told from code line-locally - a banned word on a line starting `//`,
  `/*` or `*` is a mention - rather than by a comment-and-string scanner, which
  can desync, and desyncs read green. The check scans itself: the first version
  spelled the three calls out beside their patterns and went red on its own
  table, and the fix was to delete the field rather than exempt the file -
  `callName()` reads each label back off its pattern's source. Red proved three
  ways, each a real edit reverted after: a call added to `timestep.js`, the
  word "deliberately" removed from over `audio.js:97`, and `audio.js`'s draw
  replaced so the allowance named nothing. 389ms a run, 0 flaky, and its green
  detail line is a census a later run can read without running anything.
  Commit `8ce149b`.

- **F12** `?seed=` reaches the fuzz and soak checks. The 2026-09-20 audit's
  own recommendation, which had been written into `PROGRESS.md` and never
  transcribed into this queue; it sat there four days while the queue emptied.
  `--query "seed=N"` reached nothing, because `initMatch` prefers an explicit
  seed and all sixteen exploratory seeds across seven modules passed one - so
  the weekly fresh-seed run had been re-running the builder's own seeds under
  a new name since it started, and two audits' "14 checks green on a fresh
  seed" meant only that the pinned seeds were still green. New
  `src/tests/seeds.js` (214 lines) owns `exploreSeed(label, fallback)`: the
  fallback when the URL names no seed, so the gate is unmoved and cannot
  become flaky, and a mulberry32 draw from the URL seed mixed with a hash of
  the **label** when it does - the label and not the number, because
  `traversalfuzz.js` and `wardenground.js` had both picked 20260914. Every
  exploratory seed is now a module-level named constant, so the census is
  complete before any check runs whatever the run was subset to.
  `src/config.js` grew `seedInQuery`, and `deriveSeed` is written in terms of
  it. The three seeds whose *subject* is reproducibility (`engine.js`
  0x5eed1234, `determinism.js` 20250814, `ai.js` 0xa17ea5) are untouched and
  the check asserts they stay that way. **Both directions of the check were
  driven red on purpose** before being believed. Verified: plant 174 / 1 / 8
  (760,649ms, 942,528ms), yard 155 / 1 / 27 (468,644ms, 604,053ms), exit 0,
  0 red, 0 flaky, 0 console errors - one more check per map than the gate
  that opened the run, and the same run times. Full write-up in
  `PROGRESS.md`, "F12". Commit `49c8f67`.

- **G1** `HANDOFF.md` back to one page. **1,846 lines to 533**, a 71% cut.
  The ~30 per-job narrative sections are gone and replaced by an index
  naming every one; because every `PROGRESS.md` entry is titled with its job
  id, the index needs no second column. Before deleting, each of the 27
  removed job ids was confirmed to have a PROGRESS entry — 27 of 27, by
  script. The three sections carrying something found nowhere else (the
  plant-rule checks' locations, F3's split, the census's climb rule) were
  kept, the first folded into the plant rule. Drift fixed: the old file
  claimed both that Josh decided D13 and that D13 still blocked; in fact
  **every entry under DECISIONS.md's Blocking heading is decided**, so
  nothing is blocking, and Provisional entries are no longer written up as
  open questions. **The under-400 target was not met** — 345 lines is
  everything but the traps, so 400 would leave them 55 lines for thirty
  traps, and they cannot move out because the routine's own SKILL.md names
  that section. G2 and D47 carry the choice. Suite unchanged. `3e129f2`,
  2026-09-23.

- **F10** A hung gate dies, and says which check hung. `src/ui/autosuite.js`:
  `beat()` publishes a monotonic `seq`, `done`, `total` and the id in
  flight on `debugState.suiteProgress`, one beat before every check and
  one after; `yieldTask()` gives up a whole task at each boundary,
  because a run of synchronous checks only ever yields microtasks and
  the watcher's second `page.evaluate` needs a task to run in — without
  it the heartbeat reads as standing still through a healthy run.
  `scripts/watchdog.mjs` (new): `withDeadline` races the run against
  the beat standing still and throws, naming the check in flight, for
  `suite: crashed: run timed out` and exit 2; a bounded `teardown()` on
  the `finally`, on the catch and on SIGINT/SIGTERM/SIGBREAK;
  `otherRunners()` names an older `suite.mjs` at startup, in the report
  and in the summary. `--stall SECONDS` (default 600), `--details` now
  carries per-check `ms`. suite.mjs 507 lines after the split,
  autosuite.js 404, watchdog.mjs 181.
  `the-suite-heartbeat-advances-and-names-the-check-in-flight`
  (tests/heartbeat.js, every map) holds the beat it is itself run under
  to its own id and three probes through `runChecks` to their ids,
  counts and a strictly rising sequence; red when `beat()` is stubbed.
  The staged hang (`?hang=1`, off by default) made the runner exit 2 in
  130s naming `a-staged-hang-never-returns`, leaving no orphan. Verify:
  plant 173/1/8 (748s, 938s), yard 154/1/27 (467s, 613s), 0 red, 0
  flaky, 0 console errors. Found: the slowest single check is 269s, so
  the stall default is measured, not guessed — F11. `35f9d62`, 2026-09-23.

- **E6** Post-processing (D10, D46). `src/post.js`: the scene into a
  half-float multisampled target, a bright pass at half size over 0.5
  linear luma (the emissives, never a lit floor), two Gaussian blurs,
  a composite adding the blur at 0.8 under an elliptical vignette (0.55
  to 1.25 of the half-diagonal, 0.3 off), then C3's feedback quad over
  the top on its own layer. `SETTINGS.post` is a settings row, on by
  default; off is one pass. pixels.js's lens reads through it, so every
  pixel check reads what ships: the route edges 158-182 (224-227) with
  contrasts 0.75-0.78 (0.79-0.83), the site tint down to 0.13 for the
  linear multiply (D44 superseded). `renderer.info` is reset once a
  frame in `post.render`, so a frame's draw calls count the passes.
  `post-processing-blooms-the-emissives-darkens-the-corners-and-is-a-
  switch` (tests/post.js, every map): the ring round a lamp fixture 22
  to 78 luma (plant), 35 to 112 (yard); the corners of a floor view at
  0.85x, the centre within 2%; the hit marker 45px either way; 7 passes
  on, 0 off; the row switches. The frame-budget clause is Josh's GPU's
  (PLAYTEST.md). Spec 20.32. — 2026-09-21, scheduled run, Josh present,
  commit `07942d7`.
- **E5** Map materials, `yard`. The yard opts into E4's kit with its own
  set (`CONFIG.map.yardFinishes`): every container `corrugated` (a
  glossy ramp, a grime with `ridges` - a cosine profile across the tile,
  nine to 2.4m, the troughs 22% darker - `grimeAt` in mapmaterials.js),
  the ground and the fence `wet` (a lower concrete with puddles), paint
  and glass the plant's. The decal atlas is 4x2 with `rust` (a band up
  from the foot, broken and pitted) and `stencil` ("BLKU 2607 1", a 3x5
  font in code), both toon-lit paint; `src/maps/yarddecals.js` lays
  seventeen: six rust bands, four stencils, tracks through both gates, a
  kerb, three oil stains, a drip. `the-yard-is-corrugated-wet-and-
  numbered` (every material on its finish, the ridges by difference and
  as crossings, the puddles by difference) and `the-yard-wears-its-
  decals-on-its-faces-in-two-draw-calls` (tests/yardmaterials.js; the
  plant's helpers exported from materials.js). Container side: grime spread 2.61, darkens 5.8, ridges 19/19/23 crossings; wet ground spread 1.80, darkens 3.4 at luma 25; the pools 21.1/17.9/14.5 (24.7/22.6/19.4), every relation held; the plant's checks to the digit. — 2026-09-21,
  scheduled run, Josh present, commit `02212df`.
- **C7** The site is a tinted floor, and the HUD names it (D8). The
  ring, `M.marking.siteRing*`, `site.ring`, `addDecal` and the pulse in
  `map.update` are gone; `bakeSiteTints` (src/mapdecals.js, laid by
  `addSite`) tints every floor plate inside a site's room - one multiply
  quad per plate, one mesh for every site - white pulled toward hazard
  orange by `siteTintStrength` 0.28 (D44): R/B up 1.14-1.17x, luma down
  7-9% on every site floor of both maps; lit-pools, the mouths and the
  routes unchanged in every relation. `#bl-site` in the HUD's prompt
  panel reads "SITE A - Turbine Hall" for either role by its own
  position (`siteHere` in hudstate.js); the plant prompt is the Shade's
  alone. `SITE_SAMPLE_OFFSET` (tests/pixels.js) keeps the floor checks
  on the ring's old spot. `the-site-floor-is-tinted-warm-and-the-ring-
  is-gone` and `the-hud-names-the-site-you-stand-in` (tests/sitetint.js,
  every map; visual.js is at 588 lines). Spec 20.30. — 2026-09-21,
  scheduled run, Josh present, commit `a1a8c40`.
- **B5d** The defuse reach is a clear line (D27: no defusing through a
  floor). `withinDefuseReach(foot, at, collision)` (systems/plantrule.js)
  is the two distances and then a line: from one of six points on the
  segment from the Warden's feet to its raised hands (`DEFUSE_LINE`,
  each a 0.1 skin off the floor) to the charge 0.1 off its surface, no
  solid box between, glass included. The world is required, so no
  caller measures the distances alone; the defuse in objective.js and
  `canDefuseAt` both pass it, and the census's two call sites do. The
  census: 366 legal spots to 364 of 381, the two duct roofs under the
  deck and nothing else; the AI's DEFEND stands where the reach accepts
  (`defuseSnapFor`, `standAt`'s `accepts`), arrives by the reach, and
  the room-A sample is the south duct's lip in 8.2s, not the roof
  through the deck.
  `the-warden-defuses-along-a-clear-line-never-through-a-floor`
  (tests/defuseline.js, plant): a charge on `vent-low-north-roof`, the
  Warden stood on the deck cell over it inside the distances, no defuse
  in a second; beside a crate top from below, the defuse starts; the
  slab the line meets made non-solid, the reach accepts the deck cell.
  — 2026-09-21, scheduled run, Josh present, commit `88d0813`.
- **F9** A probe. `npm run probe -- [--map id] [--out dir] [--query q]
  <file.js> [...]` (scripts/probe.mjs): loads the page on one map, stops
  the loop, warms 60 frames, runs each file's text as an async function
  body with `h` and `THREE` in scope, prints what it returns as JSON and
  writes any `pngs: [{ name, dataUrl }]` to shots/ first; a throw is
  exit 1. The server, the launch, the page and the map load are
  `scripts/headless.mjs`, shared with shot.mjs (which now imports it);
  suite.mjs keeps its own copy with a keep-in-step note, since it runs
  on import and adds a throttle token. Proven on F8's own probe
  (`a-wall-the-key-lights-from-behind-reads-plain`'s readings, the PNG
  of the wall) and `a-look-at-both-figures-photographs-every-eye`
  through the shared launch. — 2026-09-21, scheduled run, Josh present,
  commit `f503551`.
- **F8** The key light gives nothing to a face it lights from behind.
  E4's stripes were the shadow term on a wall the key lights from
  behind: three's shadow pass draws back faces, so the depth stored for
  the east shell wall's inner face was its own, and a toon ramp lights
  the back half of dotNL where a Lambert would have hidden the
  comparison of a depth with itself. `noKeyLightFromBehind(material)`
  (src/mapbake.js, every material the cache makes, one program key)
  resolves `lights_fragment_begin` and multiplies the key's shadow term
  by `step(0, n.L)`; the fill, the hemisphere and the lamps still wrap.
  `a-wall-the-key-lights-from-behind-reads-plain` (src/tests/keylight.js,
  plant): three rows across the wall from E4's eye cross their smoothed
  copy 2/0/1 times (ceiling 6), 23/21/12 with the patch stripped at
  runtime and 2/0/1 again restored; the shadow on, the key behind the
  wall, every map material patched. Every plant light reading unchanged
  to the digit but one landing edge's surround, darker (contrast 0.83
  from 0.80); the yard's the same. — 2026-09-21, scheduled run, Josh
  present, commit `84315c3`.
- **E4** Map materials, `plant`. Three finishes by palette colour
  (`src/mapmaterials.js`, `CONFIG.map.finishes`; a map opts in with
  `new GameMap(..., { finishes })`, the plant does): concrete matte on
  an eight-step ramp, paint glossy on three hard bands, glass never
  black; a grime texture per finish generated from a hashed lattice
  noise (no image, no rng), world-projected by `applyWorldUVs` so boxes
  share a grain, multiplied into the colour. Decals (`src/mapdecals.js`,
  `src/maps/plantdecals.js`): a 2x2 atlas drawn in code - stain, drip,
  scuff, hazard kerb - twenty quads on the plant merged into two meshes,
  the grime kinds a multiply (`premultipliedAlpha: true`, r180 insists),
  the kerb toon-lit; none near a climb, a mouth or a ring.
  `the-plant-is-dressed-in-three-finishes-and-the-grime-is-on-the-wall`
  (every material on its finish's ramp and grime, ramps as configured,
  the grime by difference under a lamp: concrete spread 4.1 / darkens
  7.8, paint 2.0 / 6.5) and
  `the-plant-wears-its-decals-on-its-faces-in-two-draw-calls` (every
  decal on a face clear of the sites, every floor stain a tenth darker
  and the deepest 4 luma, the kerb drawn, two calls). Pixel checks:
  mouths 0.26-0.88 (0.26-0.81), routes 0.29-0.63 (0.30-0.61), lit pools
  site A 24.5 (28.5) with hall over vault 2.40x (2.24x) - the grime
  takes a seventh off a lit floor, D43. — 2026-09-21, scheduled run,
  commit `2c25f18`.
- **F7** A look at a pose. `npm run shot -- --pose <names|all>`
  (scripts/shot.mjs) calls `photographPose(h, name)` (src/tests/look.js)
  per name: `strike(h, name)` (tests/animation.js, factored out of E3's
  check, which now drives through it) puts the Shade in the state
  through the real keys - walk and sprint mid-stride, crouch, slide,
  rise, fall, landing, vault 44%, mantle 40%, grab 56%, hang, pullup 51%
  - or free roam holds the Warden's sights up for `aim`; the other actor
  hidden, the eye 4.5m off the body at the first of six three-quarter /
  side angles in open air with sight of its middle, the drawing buffer
  as `shots/look-<map>-pose-<name>.png`, one line per pose with the state
  the body was in. `a-look-at-a-pose-photographs-the-state-named` (every
  map): every one of the thirteen reaches its state, finds an eye and
  returns a PNG with the body on at least 3000 pixels (plant 4397-20489,
  yard 4480-20489). `photograph()` untouched; the plain shot's coverage
  moves a dozen pixels between runs with E3's breath (27630 / 22753 /
  28106 / 8570 / 887 on the plant), not byte-identical. — 2026-09-20,
  scheduled run, commit `f7091c3`.
- **E3** Animation. `src/entities/pose.js`: one target record per body,
  filled in place every frame, every limb group eased toward it the
  shortest way round over `POSE_BLEND` 0.2s - a state change is a
  movement, no frame allocates. The gait's phase advances by the ground
  covered, half a cycle per stride of the band's footstep, amplitude by
  speed (agentvisual.js `_posture`, enforcer.js `_posture`; the numbers
  in each file's `POSE`). The Shade: the breath, the crouch, the slide,
  the air rising and falling, the reach when a press has armed a climb
  at a face, the vault, the mantle, the grab and the hang (as B8), the
  pull-up with the hands over the front, the landing while the legs take
  it. The Warden: the roll, a bob, a sprint lean; the sights raise both
  arms by the rifle's carry pitch and then the aim's, so the rifle points
  where it looks and the head takes the aim; the stun sags.
  `the-shade-has-a-pose-for-every-state-and-a-stride-for-every-step` and
  `the-warden-walks-heavy-and-raises-the-rifle-to-where-it-looks`
  (tests/animation.js, every map): every state through the real keys,
  each pose at least 0.25 rad from standing and from every other (the
  closest pair, rise and fall, 0.46), the leg across the vertical once a
  stride of the ground covered (walking, crossings 2.10m apart against
  the 2.1m stride; sprinting 2.60 against 2.6; a swing on the clock
  reads 2.5 and 3.4), no swing standing, the pull-up's left arm at 1.97 rad half way, the
  sights raising the right arm 0.70 -> 1.05 rad and the hand 0.15m,
  looking up 0.6 raising it to 1.65, the carry back within 0.000 after.
  Spec 20.26, D42 provisional. — 2026-09-20, scheduled run, commit
  `db988e2`.
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
  `fc2bebe`.
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
