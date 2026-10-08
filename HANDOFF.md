# Blackline — handoff

**Read this first.** Then `QUEUE.md` (the work), `DECISIONS.md` (what waits on
Josh, and what he has decided), `PLAN.md` (the protocol), and `TRAPS.md` before
you touch anything — thirty-odd environment traps, an hour each, which lived in
this file until G2. `BLACKLINE_SPEC.md` is the contract; `PROGRESS.md` is the
append-only history — read the last entry, and the entry named in the index
below for whatever you are about to touch. `PLAYTEST.md` is Josh's: how to run
it, what to look at, what only eyes can judge, what is known to be wrong —
every Block C, D, E and H job updates it.

This file is orientation, not history: every run reads it and pays for every
line, so a job's write-up goes in `PROGRESS.md` and gets one line in the index
here (G1). `traps-md-holds-the-traps-and-handoff-points-at-it` keeps it under
**400 lines**, and a job that adds to it takes something out.

## Last audit

2026-09-27, HEAD `c5856f8`: plant 184 / 1 / 8, yard 165 / 1 / 27, 0 red, 0 flaky,
0 console errors; live site 29/29 per map; 62 commits and 26 jobs, 0 WIP, 0 blocked
on Josh; no check deleted, no threshold loosened; 0 TODO/FIXME. **Both its findings
are closed** (F17's aim cone; the 09-18 orphan runner, gone since H23). Report:
PROGRESS.md. **It is ten days old** — the next one is overdue.

## Where things stand

| | |
|---|---|
| Branch | `phases-14-45` — ahead of `main`, not merged; Josh merges |
| Merge with | `git checkout main && git merge --ff-only phases-14-45`, then `git push origin main` |
| Hosted | **https://papasauce11.github.io/blackline/** — a branch deploy of `phases-14-45`, rebuilt on every push (H2). Remote https://github.com/papasauce11/blackline; every commit is pushed (H1). `npm run suite -- --url https://papasauce11.github.io/blackline/ --regression` checks the live copy. **Which build a friend is on** is the main menu's footer, from `version.json` (H3) — live and reading `2af44b2 · 2026-09-27`, both H3 checks 2/2 per map against the Pages URL: `npm run stamp` writes it from git and only from a clean tree, so `npm run suite` stamps HEAD at the gate and leaves it alone mid-job — **and the `Record <job>` commit runs `npm run stamp`** so the deployed stamp names the job rather than the commit before it (D52; there is no deploy workflow and cannot be one from here) |
| Working tree | clean. **H36 is `[~]`**: its write-up and its real-GPU readings are committed, its code is in `3baf549` and was then **reverted out of the tree on purpose** so this base is the one H39 verified - the sweep as written tipped three runs past the 600s `--stall-wait`, and a next run that inherits that gets a crashed GATE instead of a session. `git checkout 3baf549 -- src/tests/soak.js src/tests/benchlist.js` brings it back. H38 and H39 are done and verified |
| AUTO suite | headless, `npm run suite`, **both maps since D6**, twice each. **2026-10-07, after H39: plant 218 passed, 1 failed, 8 not for this map (1,142,663ms, 1,097,414ms), yard 198 / 1 / 28 (773,105ms, 769,357ms), exit 0, 0 red, 0 flaky, 0 context losses, 0 loop frames, 0 skips withheld, 0 bench drops withheld, 0 unexpectedly green, 0 re-runs and no other runner on the machine - and 1 console error, the audio one, read the row below** - and both runs of each map agree exactly on every count. One check more than the pair after H38 on each map, which is H39's drawn census; three jobs landed in this run (H38, H39) and each added one. **The one failure on each map is the frame-budget check, and since H11 it is reported as `bench only` rather than `skipped headless`** - a different claim, held by a different census, and the line under it names the newest real-GPU reading (`last bench 2026-10-07 (e95fe4b) on ... GTX 1060 ...: OK, 12 readings`). A stale one prints and does not red (D69). The Deliberately-red list in `QUEUE.md` is empty. **The `AudioContext` device error is at three of the last twelve verifies** (H27 yard, H29 plant and now **H39 plant, run 1, 336s in** - the nine between them clean). **Read what just happened here before reading anything else into the count**: the line in this row, one job earlier, said the clean run was "eight in a row, which is the exact shape of evidence H28 mistook for a closure once already, so do not take it" - and the error turned up on **the very next verify**. The record predicted itself, which is the strongest form the warning has ever had, so it stands exactly as written: an intermittent fault is not closed by an absence, however long. The newest occurrence also fits the standing hypothesis rather than straining it - it is an **end-of-session verify at 336s in**, where this session's own cold GATE was 0 (H38's entry) - intermittent, attributed to the page URL and never to a file in `src/`, with no sound check red. Since H32 its **code side is closed**: one module in all of `src/` names the realtime constructor and the seventeen offline contexts a run builds have rendered correctly in every run on record, so it is the device, which exists and reads as **running at 48000Hz**. What is left is whether it ever happens *cold*. **So write the GATE's console-error count into your `PROGRESS.md` entry**: the gate is the only cold suite run this project ever does, and until H11 no run had ever written its count down. **H11's gate was 0 and H38's was 0**, the first two of the three **H35** waits for - one more and it can be decided. The runner stamps every console error with the map, the run and the seconds into it, and the summary prints the messages rather than only the count (D67; `TRAPS.md` has the standing account). Every run line names how much of it was the renderer's pipeline tail rather than work (F11) - **about 40% of each run here** (451,873ms and 443,881ms on the plant, 337,220ms and 341,584ms on the yard, 44% of the yard's) - and a line per map names the spread between its runs: **plant 45,249ms (4%) and yard 3,748ms (0%)**, against pipeline-wait spreads of 7,992ms and 4,364ms. **The plant's 4% is the widest pair on record since F11 and the wait does not explain it** (45s of spread against 8s of wait), so unlike H32's yard pair this one is not the tail - it is the machine, and the audio error landed inside the slower of the two runs; treat both plant totals as load readings and neither as a cost. When a spread moves, read it against the *pipeline-wait* spread beside it before reading it as work: H32's yard pair moved 15,722ms and its wait moved 17,077ms, so the work had not moved at all, which is F16's point exactly. **Read the spread line before comparing any timing here to a `PROGRESS.md` number, and read the total against nothing at all** - H11's own cold gate went 1,078s on the plant against these 1,051s, with a probe median of 215.40ms against 5.90ms, which is machine load and not work (`TRAPS.md`). Every run is **pinned to `?quality=medium`** since H10, and since **H28 both off-levels exit 0 on both maps**, so a `low` run is a cheap *and* honest way to find out whether something is broken before paying for a medium one (2.6-3.3x faster: 384s plant, 210s yard, against 1,560s and 1,138s at `high`) - and since **H30 every pixel floor in the suite is a fraction of the drawing buffer**, so those runs mean the same thing the pinned one does. The summary says what auto *would* have picked: 8.70ms and 5.30ms (H10), 6.90ms/8.10ms/5.40ms (H23), 5.10ms (H28), 5.20ms (H29), 6.20ms (H30), 5.00ms/4.70ms (H31), 5.30ms/5.00ms (H32), 6.50ms/4.80ms (H25), 5.90ms/4.80ms (H11), 5.10ms/5.60ms (H33), 6.10ms/5.70ms (H34), 5.40ms/4.80ms (H38) and **6.10ms on the plant with 4.30ms on the yard** here, both `medium` - and since H25 it names **both maps** rather than only the first run, which is how you see one machine give two readings 35% apart. **H11 asked the same question of the real GPU and got 3.2-4.1ms on both maps, picking `high`, the two agreeing to 0.2ms** - so the gap D68 is about is mostly this renderer. The regression set (`--regression`, or F4 then U) is whole on every map since D7: plant 29 checks in 58s headless, yard 29 in 25s. `--details <path>` writes every check's own detail line to a file, which is how a **passing** check's numbers are read - the report carries a detail only for a red or flaky one - and every detail is **cut at 400 characters** with no ellipsis (H29) |
| Next job | **The second arc** (2026-09-25, D50): Blocks H, K, M, J, I, L, N, O in `QUEUE.md`, in that order. H5 to H11, H23 to H25 and H27 to H34 are done, so the next job is **finishing H36**, which is `[~]` in `QUEUE.md` with an exact resume note: two steps, a subset that must read `1 sample, NOT a median` headless and then the full verify, with nothing known to be wrong. After it, **H37** (S), which wants a line added to the *audit* task's prompt and so is the one job here that edits a file outside this repo - a session that is not comfortable doing that unattended should say so and take **H40** (S, H38's own finding): `a-hang-is-at-full-stretch-under-the-lip` reads the glove thirty frames after the grab, which H38's probe of the settle shows is **inside the ease** - the arm's angle has arrived by then but the part of the glove's height that is not the breath is still moving, -0.016m at frame 30 against +0.0263m settled - so that clause is bounding the tail of the arm's swing and not the hang, at 24% of its tolerance where the hang sits at 17%. Two options and it must pick one with a measurement. Then **H37** (H11/D69: the weekly audit says how old the bench is) and **H35** (three gates' console-error counts, then close the `AudioContext` error or do not — **it says in as many words not to be started early**, because its evidence is three runs, and H11's gate is the first of them at **0**). Every H job proceeds; nothing in the block is blocked. H17 and H18 are H5's follow-ups and wait on D55, and **H26** waits on D61. The other open small ones are **H21** (H7's store validates a stored number by type and not by range) and **H22** (the settings page is fourteen rows since H10) |
| Waiting on Josh | **nothing blocking, and one piece of actual good news at the head of it.** **D69** (H11) is the newest Provisional, and it is the first entry in weeks that *closes* something rather than asking: the frame budget on a real GPU, the oldest eyes-only item on `PLAYTEST.md`, is **answered** — `npm run bench` on this PC's GTX 1060 says it holds everywhere, **3x to 6x under its ceiling**, over twelve readings on both maps at all three levels. Two things in there are worth a glance of his even though neither is a decision: **`high` is nearly free on this card** (1.71ms against `medium`'s 1.75ms), so if he has been playing at `medium` out of caution there is no reason to, which is a line under D60 nobody could write before; and **`auto` picks `high` here with both maps agreeing to 0.2ms**, where software GL had them 3.4ms apart — so the gap D68 is about is mostly an artefact of the renderer the gate uses, though its mechanism is real and H25's fix stands. The decision D69 actually asks him to accept is small: a bench-only check is answered only when somebody runs the bench, and **a stale bench prints its date rather than going red**, so the gate can say OK beside a real-GPU number from another commit. The refused alternative (red on a stale bench) is **H37**, moved to the weekly audit where a calendar question belongs. Then **D68** (H25), the one of these a friend could have *felt*: on `auto`, the map you opened first used to decide your quality for the life of that browser, because the probe reads the machine **times the scene** (8.70ms and `low` on the plant against 5.30ms and `medium` on the yard, one machine). It now keeps the **lower** of what is stored and what it just measured. **The line worth his eye is the cost**: the level only ever goes *down* on its own, so a machine that was briefly busy is remembered as slower than it is until he clicks the settings row. The alternative - letting it drift back up once several readings agree - is a real feature and D68 says what it would take. Then **D67** (H32) is the newest Provisional and the line worth his eye is a refusal: a console error is counted and now *printed* in the summary, and it still **does not fail the gate** - because the `AudioContext` device error would have failed two of the last six verifies, both of them correct runs of a correct game. Its code side is closed (one module in all of `src/` opens the audio device; the seventeen offline renders a run does have never failed), so what is left is the machine, and whether it ever happens on a *cold* run is now a procedure rather than a guess. Then **D66** (H31) is the newest Provisional and it is short: the hood-over-neck clause was measured before it was touched, the hood came back 10px in all 48 readings and the neck 4-6px, so the clause stands at 1.67x of margin at worst and nothing shipped changed - and **it corrects the mechanism D64 gave for its own numbers**, which was a band sliding and is really the Shade breathing. Nothing in D66 changes a rule or a look; the line worth a glance is that **a one-row change in measured height does not move that band**, which D64 said it did. Then **D64** (H29), which is the **answer to the question D63 raised** - except that the answer is *the suite cannot tell*, so the last step is his. Asked directly, over five drawing-buffer sizes face-on at 25m on both maps, the hood-over-neck reading came back **unstable between two runs of one suite**: 8/4 = 2.00x against **8/6 = 1.33x** at 956x538, and 6/4 = 1.50x against **6/6 = 1.00x** at 896x503 - after eight isolated runs had agreed to within a pixel. The cause is not quantisation of a row, and **not the band sliding either, which is what D64 says and what D66 corrects**: at 25m in those buffers the silhouette is **30 rows tall and 8 pixels wide**, and H31 measured the real cause to be the Shade's own breath moving the body past the pixel grid. **A hood cannot be told from a neck inside eight pixels**, which vindicates D63 more strongly than D63 claimed for itself, and is what both entries agree on. So the ask in `PLAYTEST.md` under *Still needs a human* is one look: **open the game at `?quality=low` in a window about 1366x768, find a Shade at 25m, and say whether he can tell it from a Warden.** If he can, nothing needs doing; if he cannot, *then* there is a minimum-resolution decision, which is why none was written on a guess. D64 also **retracts H29's own first conclusion** - that the hood reads everywhere and no such line was needed - because it rested on the run that read 4px necks. Then **D63** itself, still open for override, and H29 is the argument against the alternative it offered (hold `low` to the silhouette): at that size the clause asserts which sub-pixel alignment a three-row band happened to catch. Then **D62** (H27): the quality level was changing the game through the shared rng and now cannot, by having two streams off one seed - the line worth his eye is that **a given seed produces a different match than it did before 2026-10-05**; it reproduces itself exactly, which is all a seed ever promised, but it is not the same match that number gave last week. Then **D61** (H23): a menu card's picture does not depend on the quality level at all, measured byte-identical at `low` and at `medium`, and it is left that way because a card is a picture of a place and every friend seeing the same strip beats a strip that previews their machine; the other option is **H26**. Then **D60** (H10), where the line worth his eye is that **`low` turns the outlines off**: everything else in that row is pure cost, but the outline is how a body separates from the concrete behind it (Section 4), so a friend on a weak laptop might be playing a *more readable* game at medium with a 512 shadow map than at low. D60 also holds the post being the player’s row **AND** the level, and that `high` does nothing on a 2x display (the 1.75 cap). Then **D59** (H9: the FOV sliders run 60–100, the Warden’s aim narrows to 52 absolutely, head-bob ships off and `PLAYTEST.md` asks him to switch it on), **D58** (a rebind replaces the first key and keeps the alternate) and **D57** (what a browser keeps). **D55** (the main menu as built) is the one with a real question inside it: the plant is a sealed shell, so its card is its roof, and showing its inside needs the roof hidden for the render - that is **H17**, and it waits on his word. **D56** is the newest Blocking and is genuinely a rule: there is no Shade AI, so “play the Warden” can only mean free roam; nothing is blocked on it. **D54** (easy’s aim cone 5.0 → 4.0) is the one a player can feel. The Provisional section stays open for override, and the things only eyes can settle are under *Still needs a human* |
| Source | no module in `src/` over 600 lines except `config.js` (a table, exempt in PLAN.md, 1,974 lines); `no-source-file-outside-config-is-over-600-lines` holds it, and it counts **every module the page loaded, `tests/` included** — 159 of them. H10 added `src/quality.js` (522) and `src/tests/quality.js` (437) and took `src/main.js` to 557, `src/ui/menupages.js` to 413 and `src/systems/effects.js` to 461; H23 added `src/tests/qualityhold.js` (222), H28 `src/tests/bufferscale.js` (170), H29 `src/tests/smallwindow.js` (232), H31 `src/tests/breath.js` (191), which took `tests/figure.js` to 494, H32 `src/tests/audiocontext.js` (205) and H25 `src/tests/autopick.js` (185), which also took `src/quality.js` from 522 to **566** - the next job to touch it should know it has 34 lines of room. H11 added `src/tests/benchlist.js` (235) and, outside `src/`, `scripts/bench.mjs` (321), taking `scripts/suitereport.mjs` to 311; H33 added `src/tests/breathcensus.js`, which H34 took to 480, H38 to 488 and H39 to **501**; H38 took `src/tests/hang.js` from 156 to **343**, H39 added `src/tests/breathdrawn.js` (**475**) and H36 took `src/tests/soak.js` to **515** and `src/tests/benchlist.js` to **319**, all well inside the guidance. **`src/physics.js` is at exactly 600 and `tests/movement.js` at 599** (then `systems/combat.js` 593, `maps/plant.js` 585, `tests/ai.js` 576, `tests/objective.js` 575, `systems/audio.js` 573) — the next line added to any of them turns that check red, so the job that touches one splits it first rather than discovering this halfway through a verify. **H23 and H28 are the worked examples**: H23's check took `tests/quality.js` to 606 and H28 needed a clause in `tests/visual.js` at 589, and both times the block came straight back out into a sibling named for its own subject — `tests/outline.js` (180) is H28's, and it took `visual.js` down to 485. H29 kept its own check out of `tests/figure.js` (459) for the same reason and took four exports from it rather than copies: `flatShadeSilhouette`, `silhouetteFloor`, `yawToward`, `HOOD_OVER_NECK` and `NARROW`. `src/mapground.js` is 543, `src/mapkit.js` 537, `tests/difficulty.js` 554, `tests/donedef.js` 504, `src/ui/autosuite.js` 499, `tests/menu.js` 489. Outside `src/`, **H10 split `scripts/suite.mjs` at 599**: the verdict and the printing are `scripts/suitereport.mjs` (189) and the runner is 455, with `watchdog.mjs` 205 and `headless.mjs` 132. **This page is kept under the 400 lines `traps-md-holds-the-traps-and-handoff-points-at-it` allows** — a job that adds to it takes something out, which is the point of G1 and G2. 0 TODO/FIXME; one `Math.random` (the audio noise buffer) and one `setTimeout` (the performance check), both documented exceptions, and since F13 the gate holds that census |
| Runtime assertions | 8, zero failures |
| Map, plant | 214 collision boxes, 57 climbable, Warden ground one connected component with a column of cells down each vault rack aisle. **8 declared routes, 22 stages** (`map.routes`); 21 surfaces that need a leg up, every one a stage or landing of a route; **139 of 139** approaches the rule names climb |
| Map, yard | 132 boxes, 58 climbable, 5 lamps, Warden ground 15,332 cells in one component, 21 waypoints, **9 declared routes, 20 stages**, 11 surfaces that need a leg up, every one on a route; **151 of 151** approaches climb; 44 container tops one connected deck; the walkway's floor and roof have no approach at all |

Phases 1–49 of the original build are done and committed. The **redesign** (the
50-phase plan, below) closed at B9, 2026-09-14, its last two questions on
2026-09-21 (B5b dropped, D25; B5d built, D27). Blocks A–G are all closed.

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
check passed, so the policeman cannot be exempted (H11 gave the bench list the
same rule) · F16 read every run-pair on record: the pairs agree since F11 and
the runner prints the spread per map.
**Each has a PROGRESS entry; that is where the argument is.**

**F17 / F18** a fresh seed turned the yard's difficulty check red and the cone was why: at 16m the Shade subtends ±1.22 degrees against easy's ±5, held for a whole burst, so a kill was a run of coins. `easy.aimErrorDegrees` 5.0 → **4.0** (D54), and F18 gave the check the clause F17 could not calibrate — **count bursts, not rounds**, and god-mode the Shade so an engagement stops sampling when the cone succeeds rather than when it lands. Two alternatives were measured and rejected; the per-round draw is right in principle and is **K6**'s.

**Block G — the record.** G1 this file back to one page, 1,846 lines to 533 · G2 the last 200 of them out to `TRAPS.md` (D47, option 2), which reached the 400 G1 could not and gave the traps a home that can grow. Closed.

**Block H — friends can play it.** One line a job; the argument is in the `PROGRESS.md` entry of the same name.

- **H1** the remote · **H2** Pages from the working branch, a branch deploy.
- **H3** a version you can see: `version.json` from `scripts/version.mjs` (`npm run stamp`, and once at the top of every `npm run suite`), written **only from a clean tree** so a gate stamps HEAD and a verify mid-job leaves it alone; `src/version.js` decides `dev` from the host, not from a field. D52 has what H3 could not build.
- **H4** boot: each map's builder is a generator with its shared tail in `mapfinish.js`, run straight through by `buildMap` and a slice at a time by `bakeMap` — one build path, two drivers — so `#bl-boot` names each of the **6 slices** while the page paints between them (a `MessageChannel` yield: `setTimeout` is banned and rAF never fires in a hidden document). **No WebGL2 is `createRenderer()` returning null**, never a `getContext` probe, which cost a second SwiftShader device and 16s a page load. D53 is the wording.
- **H5** the main menu: a card per registered map, rendered at boot from that map's own geometry with the live renderer and the one camera — no asset file — and the bake gained a cut, `DRAWN_SLICES` (3 of 6), because the three slices after it put nothing in a scene. Two eyes came back black and a third found there is no exterior eye that shows the plant's inside: **D55**, H17. Plus the role row (D56), How to play, Credits, and a keyboard that walks all five pages.
- **H6** the first-run tutorial: eight prompts, each cleared by the **act** and never by the key press — `systems/tutorial.js` reads the controller's state after each fixed step and no input at all — offered where the geometry is derived (`tutorialFits`) rather than named, so the plant has two ducts at grade and the yard's check asserts the opposite.
- **H7** settings that survive a reload: one versioned record under one key, a version it does not know ignored rather than migrated, a hand-edited one able to set only a key the defaults have at the type they have, and **every access wrapped** because `localStorage` throws rather than returning null when site data is blocked. The one setting deliberately not kept is the debug gate (`NOT_PERSISTED`, D57).
- **H8** rebinding: a **Controls** page, a row per action, press-to-bind, the row's own reset, a rebind writing the first key and leaving the alternate, and a key on two actions **shown rather than refused** (`bindingConflicts()`, D58). The defect worth reading: **binding a key also fired it**, because the keydown reaches the `Input` as well as the menu and the listener order is not ours — the gate is `swallowPress()`, held to the keyup.
- **H10** quality presets: low / medium / high / auto over the shadow map, the resolution, the post, the particle counts and the outlines — `src/quality.js`, with `CONFIG.quality` the table and **`medium` exactly what the game drew before there were presets**. The probe **records and does not decide**: what is applied is `activeQuality()`, the URL's `?quality=` first, the row second, auto's stored pick third, `medium` before there is one, asserted every frame by `syncQuality()` as H9 asserts the FOV. The queue predicted auto would pick `low` headless; it picked **`high`**, because a CPU clock round a draw says nothing about a software renderer that queues, and `cpuBudgetFraction` is the constant that exists to say so. It also split `scripts/suite.mjs` and left **H23**, **H24** and **D60**.
- **H33** two phases survive a reset, and the census of what they reach. The queue asked which other checks read a posed body at whatever phase the run arrived in; the answer took eight entry phases of the 6.98s breath on both maps, every candidate run through the registry as the suite runs it, and **everything passed at every phase**. Three results. **There are two phases, not one**: `_animTime`, the gait, is advanced inside `updateVisual` by the ground covered, is zeroed in the constructor and **not** by `reset()` either - and it is the **bigger lever**, 24% of a pixel count on `look.js`'s walk and sprint poses (7,891-9,818px against a floor of 3,000) against the breath's 1-3%, and the harder to reason about because it advances only while something walked. **The margins are wide except one**: 8m count 2,996-3,089 over a 2,000 floor and a neck of 10-12px under a hood that read 28px at every phase (2.33x of 1.5x - **H34 corrected this to 10-14px and 2.00x**: eight phases is too coarse at 8m), 25m count 345-359 over 150, smallwindow 116-121 over 51 and aspect 2.9-3.0 over 2.2, bufferscale 1.7% of spread over a 10% tolerance **because its law is a ratio between counts and the common part cancels** - and **`hang.js`'s glove sweeps 0.075m of a 0.15m tolerance**, half of it, with the lift delivering its full ±0.037m at the read; it passes at 2.75x, which is **H38**. That one was **invisible to the first instrument**: the census began as a diff of the numbers in each check's own detail line, and a passing check's numbers are not in its detail line at all, so it had to be found by reading the module and measured directly - two instruments, and the second is the one that mattered. **And four reasons a clause cannot be reached are now proved rather than asserted**: the Warden does not breathe (`enforcer.js:407` sets `pose.lift` from the walk bob, and its readings held **to the pixel at all eight phases**, agreeing independently), the camera's pivot is `_smoothPosition.y - half.y + cam.up + _dip + bob` with no `pose.lift` in it, the breath is a **position** and not one of the eleven rotations `animation.js` compares, and a difference taken inside the group cancels it. `tests/breathcensus.js` holds all of it on H30's model, both ways, each proof read in a window where the torso is shown to have ridden its 0.080m. **It caught three flaws in itself**, which is the argument for writing it this way: it declared itself; its camera clause was **vacuous** because the suite leaves camera ownership wherever the last check put it, and the control said so (a metre of body moved the camera 0.000m); and its "the body really moved" clause **scaled with the very constant it was guarding**, so zeroing that constant would have satisfied it with a body that does not breathe. Twelve more modules read a body off a frame they rendered and are declared **unmeasured** (`ALSO_DRAWN`, **H39**), which is scope stated rather than a claim made. It holds **D66**'s refusal; **D70** pins the ride. **H34 is the correction to it, and the lesson is that a sweep's density is part of the instrument**: 32 phases at 8m on each map read the neck at 10-13 on the plant and **10-14 on the yard** against H33's 10-12 from eight phases on one, so the recorded margin is **2.00x** and not 2.33x. The hood held at 28px in all 64 readings and both lanes read the same yaw, so neither was the variable. **Why eight phases is enough at 25m and not at 8m**: the breath is worth about one row at 25m, so the worst value is common - a 6px neck in six or seven of eight samples, which is what lets `breath.js` assert it from eight - and about three rows at 8m, where the reading spreads over five integers and 14px came up once in 32. A finer measurement needs *more* samples to find its own worst case. No dense clause (33% of margin, and 64 readings is too much for a 33s check); what the census asserts instead is the invariance the margin rests on, that **the 8m hood is one width at every phase**. Third time a pixel reading was about how it was measured rather than about the body.
- **H36 (in flight: measured and written up, code parked in `3baf549`, NOT in this tree)** the sweep's worst viewpoint was one frame, and it had already gone red on the real GPU. The 92-viewpoint sweep timed **one** draw per viewpoint and asserted the highest of them, so its verdict was a single frame. Benched twice with fifteen draws each and asked what a sample count would have to be for that verdict to reproduce: **the worst PLACE never reproduces at any count up to fifteen** (top-three overlap 1-2 of 3 in every one of six scenes) because the top is **a dozen near-ties inside the 0.1ms `performance.now()` is clamped to** - 4 to 13 viewpoints of 92 within 0.2ms of the top - so it is not a quantity the bench can measure, while the top **ten as a set** does reproduce, 7-10 of 10. **The worst VALUE settles as a median and never as a maximum**: two benches within 0.3ms from five samples and 0.2ms from nine, against a max-of-N gap still 1.0-1.1ms at fifteen that *grew* with the count, because a longer run gives a spike more chances. And the thing that settled it: **a spike had already turned this check red on the real GPU** - 13.80ms at `bay-a-north` on the yard at `medium`, where the same place reads a median of 2.30ms and a max of 2.40 over fifteen draws. So a viewpoint now costs the **median of up to nine timed draws inside a 120ms budget**, the budget rather than a flat count so one check is honest on two renderers at once (2.5ms draws buy all nine, a draw at the 8.33ms ceiling still buys nine, a 400ms SwiftShader draw buys one - **so the gate pays exactly what it always paid**, which matters because it runs this check and drops only its verdict). The worst single draw is **reported and never asserted**, and the busiest **three** are named instead of crowning one. Held headless by `the-frame-budget-asserts-a-median-frame-and-not-an-unlucky-one`, which holds the constants as a *relation* (the budget must afford every sample at the ceiling: 9 x 8.33 = 75ms of 120) and proves the statistic both ways - a 13.8ms spike among 2ms draws must cost 2ms **and** nine draws all over the ceiling must still read over, without which the first clause is satisfied by a statistic deaf to everything. Three breaks, each naming its own line. **The honest residue**: a median survives a descheduled frame and not a sustained stall - a fourth bench read `deck-office-door@0` at **4.80ms across all nine draws** where two others read it at 2.20ms with a max of 2.30, so four readings of that scene's worst median go 2.60, 2.40, 4.80, 2.60. Nine samples buy about 20ms of window and nothing inside it can see past it; what makes the clause safe is the **headroom**, the worst of those four being 58% of the ceiling. Twelve fresh readings are in `bench/2026-10-08.json`, the first taken by the shipped check rather than by an instrument.
- **H39** the other twelve, and the two facts that answered ten of them. H33 declared `ALSO_DRAWN` - the modules that read a body off a frame they rendered rather than posing one - and measured none. **Two structural facts, now proved behaviourally, answer ten of the twelve**: a lens `grab()` is `h.post.render(...)` plus a `readPixels` and **never calls `updateVisual`**, so every grab inside a check is at **one** pose and a difference between two grabs cancels the body exactly (12 grabs move the body under 0.0001m where 12 real frames move it 0.0064m); and `_posture` multiplies the whole gait by `walking`, so a standing body's limbs are at rest whatever `_animTime` reached (1.08 rad walking, under 0.0001 rad standing across a whole turn of it) - and every body in this group stands, so the **bigger** of H33's two levers reaches none of them. A third fact says why nothing here needed H38's settle: **`Agent.reset()` ends in `updateVisual(0)` and `blendFactor(0)` is 1**, so a reset body is re-posed at the run's phase with the ease snapped, where H38's hang was driven into and had a live ease on top of the breath. **What is left is two clauses and both are wide**: dim-with-the-meter covers 18,579-19,763px over a 400 floor (46x) and reads near-black 36.7-42.8 against 90; the rim masks 7,376-8,109px over 500, brightens 4,872-5,118 over 200, and reads its silhouette **2.08-2.39x** the interior against 1.5 - **1.39x, the thinnest in the group**, the breath moving it 7%. The opposite shape to H38's answer for a reason: a body's own pixels are counted in the thousands or averaged over its mask, where H38's glove was a point 2m from the pivot the breath turns. Ten out of reach by five proofs - `onepose`, `hidden`, `nobody`, `onebit`, `cost` - three held behaviourally with their second halves (hidden bodies move **0** pixels crest-to-trough where shown bodies move 18,470; draw calls **449** at both ends of an exact 0.080m lift) and two from the module's own text as `donedef.js` reads source. `tests/breathdrawn.js` owns the table and `tests/breathcensus.js` imports it, so the two censuses cannot disagree about which file is in which group. **Its own control caught its instrument**: the first draft advanced half a cycle from wherever the run arrived, which moves the body `2A*|sin(entry)|` - the whole ride at a crest, **nothing at a crossing** - so it would have been vacuous in six runs of eight and green in all of them; the phases are absolute now. Three breaks, each naming its own line, the cross-module wiring both ways. And **the queue was wrong about one module** for the third time in this block (H30's `readability.js`, H34's own sweep density): the death camera is `visual.js`'s, not `feedback.js`'s, and is out of reach twice over - the killer is the Warden, and the ragdoll clauses read `mesh.position`, which the breath never touches because it moves a group **inside** the mesh.
- **H38** the hanging glove, held at the worst phase of the breath, and the centimetre the census missed. H33 named `tests/hang.js` the thinnest breath-reached clause in the suite - `|gloveY - lip| <= 0.15m` on a world position inside the body group the breath lifts, half the tolerance spent on a quantity nothing bounded - and this is the bound: eight phases of the 6.98s breath at the ledge the controller's own probe reports, the **worst** asserted, **2.26x with 56% of the tolerance left** (the offset runs -0.014m to +0.066m on both maps). It costs **10-17ms**, because the glove is a world position off the matrix and nothing renders. **It corrects H33's number by a centimetre and the cause is a settle, not the breath**: the span agrees (0.079m and 0.080m, a dense sweep at 0.0800m - twice `POSE.breath.lift` to the millimetre) but the arm's *angle* arrives by frame 30 while the pose's contribution to the glove's *height* is still moving, so the census swept the ease and the breath together and called the sum the breath. The sweep settles **150** frames and the constant says why; the shipped clause keeps its thirty untouched, which is **H40**. **Eight phases is right here and a dense sweep of all 419 frames proves it** (0.0663m against 0.066m) - the opposite of H34's answer, for a measured reason: an offset in metres is continuous, so eight samples miss a sinusoid's peak by at most `1 - cos(pi/8)`, 3mm, where a pixel count is an integer whose extremes are rare. **A sweep's density has to be chosen against its quantity's own graininess.** The map does not enter it - both maps' dense sweeps are identical on lips 0.10m apart, because the lip cancels out of `gloveAboveFeet - hangDrop`. Proved by breaking each clause alone: zeroing the breath reds only the ride control while the worst-phase clause reports a comfortable **5.70x** on eight readings of one phase, and `hangDrop` 2.05 to 2.25 reds only the worst-phase clause while the ride passes.
- **H11** the frame budget on the real GPU, and the oldest eyes-only item on `PLAYTEST.md` closed with a measurement. `npm run bench` opens a **headed** Chrome on this PC's own GPU (window off the desktop), loads every map at every level and writes `bench/<date>.json`. **It holds everywhere, 3x to 6x under its ceiling**: twelve readings on `NVIDIA GeForce GTX 1060 6GB`, mean draw **1.12-1.83ms** against 8.33ms, check 29's whole load **CPU 2.00ms + GPU 2.01ms** against 16.67ms at the worst of them, peak 387 draw calls against a 600 cap. The **GPU timer worked for the first time** (`EXT_disjoint_timer_query_webgl2` needs a real driver), so the project has GPU milliseconds at all now. Three findings past the budget: **`high` is nearly free** (1.71ms against `medium`'s 1.75ms, which is a line under D60); **`auto` picks `high` on both maps, 3.2-4.1ms, agreeing to 0.2ms** where software GL had them 3.4ms apart, so D68's gap is mostly the gate's renderer and not the machine; and **the sweep's "worst viewpoint" does not reproduce while its mean does** - 5.50ms→2.60ms at `medium` and 2.60ms→4.60ms at `high` over two benches, a different place named five times in six, because the check times **one** frame per viewpoint and that one frame is what it asserts. That is **H36** and it matters on a weaker machine, not this one. The mechanism change is that **a skip and a bench-only drop are now different claims**: `suite-skips.json` ("this machine cannot run this") is empty, `bench-checks.json` ("`npm run bench` answers this, and here is where") holds the frame budget, one file read by the bench and by the gate so they cannot drift, and `the-bench-only-list-holds-only-checks-the-bench-itself-runs` holds it to more than F15 asks - hardware **and** the command named in the reason, no id in both files, no id in `bench.mjs`'s own **code** (prose decided line-locally, as `donedef.js` does it), and `package.json` really carrying the script. Proved by breaking two clauses at once and watching it name `bench.mjs:83` while leaving the same id in that file's doc comment alone. **D69**; the follow-ups are **H36** and **H37**.
- **H31** what the neck actually does, and the breath that moves it. Two shipped checks assert a 1.5x hood-over-neck ratio on a band three rows deep, and the queue insisted on measuring before touching either. **48 readings, six runs, both maps, face-on at 25m on the reference buffer: the hood 10px every single time and the neck 4, 5 or 6px, never 7**, so the clause reads **1.67x at worst** against its 1.5x in all six runs to the digit - and the two shipped checks agree independently, six readings each. So the first of the queue's three outcomes, **a comment naming the margin and no edit**; neither shipped clause was touched. **The finding is what moves it.** `updateVisual` runs on the wall clock from the render frame, never from `fixedStep`, and `reset()` deliberately leaves `_breathTime` alone - so the phase a check reads is a function of how many frames the whole run drew before it, which is why a subset and a full suite disagree. **This corrects D64** (`D66`): D64 blamed a one-row height change sliding a two-row band onto the shoulders, and the band is three rows at both 30 and 31 and at the *same offsets*, so that cannot be it. D64's conclusion is untouched and reinforced - H29's instability reproduced across six runs (1.33x-2.00x at 956x538, 1.00x-1.50x at 896x503, against 1.67x six-for-six at the reference), so nothing asserts the ratio below the reference. The **deeper option was refused with a measurement**: a fixed row count would not touch a variation that happens inside one row. A **second clause on the same band and the same 11%** turned up - `HOOD_OVER_ALL_BELOW` read exactly 1.00 against 0.9 - and `tests/breath.js` holds both at the **worst of eight phases** of the breath, which is a claim neither shipped check makes. It is stable because the worst value is common rather than rare. `figure.js` gained a row `profile` so a check can print *where the bands fell* rather than only what they returned. Follow-ups **H33** and **H34**. Its gate was H30's VERIFY on a byte-identical tree, because this run's own gate was lost to a background timeout shorter than the gate - two rules now in `TRAPS.md`.
- **H30** every pixel floor under `src/tests/` is a fraction of the drawing buffer, or says why it is not. H28 scaled the six H24's off-level runs caught and left the rest with an honest note - *none is red at any level today, which means only that no level happens to cross them* - which was exactly true of H28's six beforehand. The census is **twelve**: **eight scaled** (a body in `visual.js` and `presentation.js`, the alarm fixture, the death cam's killer, a vent region and a route strip in `legibility.js`, the rim), **one already right** (`feedback.js`'s vignette at 5% of the frame, the precedent), and **three left absolute**, which is **D65**: the alarm tripwire at 10px and the hit marker and damage arc at 20px are **existence** claims, not size ones, and scaling a tripwire makes it *looser* on a small buffer. The smoke floor is the one that did not take `scaledCount` - *obscuring* is a share of what the player can see, so it reads the fraction of the frame the check already computed. **The queue was wrong about one module**: `readability.js` holds no floors and never calls `createLens`. Held by `every-pixel-floor-under-tests-is-a-fraction-of-the-buffer-or-says-why-not` on F13's model rather than a comment convention - a table of allowances with reasons, red on a new floor **and** red when an allowance goes stale - proved by reverting one floor and watching it name the line, and it **caught itself** doing so, because the first draft spelled its own test string out as a literal. It exercises its pattern every run, since a census whose regex rotted would report zero and pass.
- **H29** does a small window keep a body legible at 25m? **The suite cannot tell, and establishing that is the result.** Asked of the buffer rather than of the level, five sizes face-on at 25m on both maps - and the hood-over-neck reading came back **unstable across two runs of one suite**: 2.00x against **1.33x** at 956x538 and 1.50x against **1.00x** at 896x503, after eight isolated runs had agreed to within a pixel of neck. Not quantisation of a row - and **not what this bullet used to say either**: H31 measured the cause and it is the **breath**, 4cm of torso on a body drawn at 4.5cm a row, sliding the body past the pixel grid. `band()` measures down from the top row with both ends scaling together, so at 30 rows and at 31 the band is the *same three* offsets and a one-row height change cannot have moved it (D66 has the arithmetic). The two readings measure the same neck at two sub-pixel alignments. **A hood cannot be told from a neck inside eight pixels of width**, which vindicates D63 more strongly than D63 claimed. So the check asserts only what held in every run - the body is found, covers its share of the buffer (H28), and stays 3:1 narrow against a bar of 2.2, stable because it is a ratio of the whole silhouette and not of a three-row band - and the hood and neck are reported, asserted nowhere. **D64** records it and **retracts this job's own first conclusion**, that the hood reads everywhere and no minimum-resolution line was needed; whether 30x8 pixels reads as a hood is now one specific eyes-only ask in `PLAYTEST.md`. Three lessons: a detail line is **cut at 400 characters** with no ellipsis (in `--details` too), a **passing check's numbers are not in the report at all**, and **eight agreeing runs in isolation did not predict a full suite**, because the body's measured height moves a row in full-suite context. Its follow-up **H31** is strengthened: at the *reference* buffer the neck read 5px and 6px across runs, and the two shipped figure checks assert 1.5x on exactly that number.
- **H28** six medium-only readings, and five of them were readings about the drawing buffer. The buffer is 896x503 at `low` and 1600x900 at `high`, so a floor in pixels fails a figure that is drawn correctly (3,014px at `medium` against 1,455 at `low`, floor 2,000) and a fixed rectangle of the frame reads somewhere else. `scaledCount` / `scaledColumn` / `scaledRow` in `tests/pixels.js` are the fix, and a count scales with the **square of the buffer height** - measured 5,750.8 / 5,814.0 / 5,730.9 per megapixel-of-height across the three, a spread of 1.4%. **The wall check had been diagnosed wrongly twice**, by H24 and by the queue, as "a 1024-only reading": it was reading columns 700-1270 of an 896-wide buffer, which is the end of one row and then part of the row above, and the staircase it assembled looked exactly like a shadow-map one. Fixing it exposed F8's instrument clause underneath - **a crossing count is a count of the shadow map's texels** (14/9/6 at 512, 23/21/12 at 1024, 50/44/25 at 2048) and the amplitude is what does not move, so the clause reads swing now. The outline and post pair **assert the absence** at a level that draws neither, which caught a bug nobody could have: the outline check restored `hull.visible = true` unconditionally, so a `low` run came out of it drawing outlines the level had turned off. **D63** is the one judgement - the two figure checks read a silhouette at the resolution `medium` ships, because at `low` the Shade at 25m is 28x8 pixels and a hood cannot be told from a neck inside eight of them; that red was about the runner's window and not the level, and **H29** asks the question it was accidentally pointed at. The seventh, `frame-budget-under-the-check-29-load`, is green at `low` on both maps and goes down as machine load. `tests/visual.js` was split at 589 lines and the outline block is `tests/outline.js`.
- **H27** two streams off one seed, so the picture cannot move the game. `effects.sparks()` drew three numbers per particle from the one seeded `rng` and the preset scales the count — 15 draws an impact at `medium`, 6 at `low` — so the quality row decided what the Warden did next (0.3745 against 0.3492 on the AI's very next draw), `?seed=N` replayed only at its own level, and H13's replays would have been wrong by construction. **`rng` is the simulation's and `lookRng` is presentation's**, `systems/effects.js` is its only caller, and `rng.reseed()` seeds both: a layering rule, not a patch, so the next effect cannot bring it back. **D62** has the three options and why the safer one was refused. Splitting the stream moves every simulation draw at every level and recalibrated **nothing** — 28/28 and 25/25 seed-sensitive checks first time. Its check drives one seed through all three levels and requires the simulation identical **while** requiring the particle counts to differ, or it would pass with the feature deleted. Two mistakes of its own are on the record because no check caught either: an object spread froze `rng.calls` at 0 (now a trap) and a gadget-less `smokeBurst()` leaked 200 sprites through a whole low run.
- **H24** the suite run at `low` and at `high` for the first time. **Eight checks answer differently at low, two at high**, and the headline is that one of the eight is not a level effect: the preset scales the particle count, `effects.sparks()` takes three shared-`rng` draws per particle (15 at medium, **6 at low**) and the AI draws its burst pause off that same stream, so **the quality level moves the simulation** and `?seed=` only replays at the level it was recorded at. That is **H27** and it would make H13's replays wrong by construction. Fixed here: `exactly-one-shadow-caster` read `CONFIG.render.shadowMapSize`, which stopped being the answer when H10 made the shadow map a preset knob, and reads `qualityPreset().shadowMapSize` now — red at 512 *and* 2048 before, green at all three levels after. Also fixed, and found by the high run, a defect in H23's own check: the run record named `auto, from the probe` while drawing a pinned `high`, because `syncQuality()` publishes only when a knob turns, so `pinQuality()` publishes now. The six honest medium-only picture readings are **H28**, which found five of them were about the drawing buffer rather than the level - including this line's own "1024-only reading", which was not one. And the cost nobody had: **low 384s/210s, medium 1,014s/698s, high 1,560s/1,138s** (plant/yard).
- **H23** one level for the whole strip of cards: `thumbnails.start()` takes `holdQuality()` for the length of the set, so `syncQuality()` applies nothing until the release and a first boot — where `auto` answers about one card in — cannot draw the strip at two levels. A second holder is refused, not counted. The finding is that **the picture was never at stake**: a card is byte-identical at `low` and at `medium` while the renderer is demonstrably at low, because none of the five knobs is in a card. So the hold makes `record.quality` true rather than repairing a strip — **D61**, and **H26** is the other option. Its check drops the hold and requires the set to split, which is what makes the hold load-bearing, and declares `glSync: true` because the first extra set read 40,572ms against a 171ms build (F11's tail, a wait and not work).
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
footprint is below") named a gantry touching a deck slab at one corner and server
racks three metres under the roof; nine surfaces stopped deriving and every
designed route kept its move. `the-climb-rule-has-no-exceptions` recomputes
"should climb" from the same approaches and passes, which makes the rule the
single source of truth. `GameMap._supportApproaches(box)` reads the spots.

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
anything within 3.8m, so the Shade could plant where no Warden can kneel — an
unloseable plant, and `setDefendTarget(round.chargeAt)` would stall the AI in
DEFEND at a charge it cannot reach for the whole 45s fuse. What it actually
excludes, measured (A5, after B4): of **377 places a charge can go inside a site
room** it refuses **ten** — the 8 ducts by their lid, and two wide tops whose
middles are over 2m from any Warden ground. So it reads "no plant in the middle
of anything wider than four metres" far more than "no plant up high", and on a
flat room floor it changes nothing. Detail in `PROGRESS.md`.

Block A's checks were one 1,382-line file and are now four: `tests/plantspots.js`
(where a charge can go — `spotOffTheRing`, `plantAt`, `perchesInSiteRooms`,
`plantableSpots`, `plantOutcomeAt`, shared by all four), `tests/plantrule.js`
(A2–A4: one reach, the gate every step, the refusal's HUD line),
`tests/plantcensus.js` (A5, the whole map both directions) and
`tests/objective.js` (round flow: detonation, defuse retention, lives,
reinsert, milestones, state not bleeding).

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
exports an object of methods and the class file ends with
`Object.assign(X.prototype, ...)`, so `this` is the same object, every private
field keeps its name, and `shade._probeLedge`, `ai._pathTo` and
`map._supportCandidates` still exist for the checks that call them. A moved
method takes a module constant from the shared `*state.js`, never from the class
file — that would be a cycle. God mode is `debugState.godMode`.

## Where the suite runner lives

`ui/autosuite.js` (`AutoSuite`): the registry, `runAutoTests`, the regression
set, the lost-context tiebreak (F1), the presentation reset before every check
(F2), the heartbeat (F10) and the pipeline drain (F11). `ui/debug.js` composes it
and forwards, so checks reach it as `h.debugTools.runAutoTests()` / `_autoTests`;
one that must drive the runner uses `suite.runChecks()`. `scripts/suite.mjs` is
the headless runner and `scripts/suitereport.mjs` its verdict and summary (H10:
`judge`, `summary`, the Deliberately-red list, the skip and bench censuses and
the newest bench's date — the half with no Chrome in it). `scripts/watchdog.mjs`
is the deadline, teardown and orphan warning, `scripts/version.mjs` the build
stamp (H3), and `scripts/bench.mjs` the one runner that is **headed** (H11).

## Running it

`npm run suite`. `scripts/suite.mjs` serves the repo in-process, drives the
Chrome already on this PC headless with software WebGL, loads the page once per
registered map (D6: every map in `src/maps/index.js`), warms 60 frames, runs the
AUTO suite twice on each and prints a JSON report. Exit 0 means nothing is red
outside QUEUE.md's Deliberately-red list and the two runs agree, judged per map.
Each run carries `contextLosses` and `rerun` (F1), printed as `GL CONTEXT LOST`;
zero is normal, and a non-zero one is the machine, not the game, unless the same
check is in the list every run.

**What a pair of run times means (F16).** The two runs of a map share one page,
and until F11 the first left its renderer tail for the second to carry, so the
plant's second run is the slower in *every* pair on record. They agree within
14s now and the summary prints the spread per map: **read that before comparing
anything to a `PROGRESS.md` number**, and prefer a first run.

- `--runs 1` is the gate: 25-30 minutes for both maps (963s plant, 646s yard
  since F11; H11's cold gate went 1,078s and 737s, which is load and not work —
  `TRAPS.md`). The full `npm run suite` is four runs, about an hour. **Each map
  alone is past the Bash tool's 10-minute cap — background it.**
- **Every run is pinned to `?quality=medium`** (H10), the picture every reading
  on record was taken at; `--query quality=low` overrides it, and no run has
  ever been done at another level (**H24**). `npm run shot` and `npm run probe`
  pin the same way.
- `--map plant` to narrow · `--regression` per map (plant 29 checks in 58s,
  yard 29 in 25s) · `--subset "<regex>"` while iterating · `--query "seed=N"` to
  reseed · `--stall` and `--stall-wait SECONDS`, below.
- `--details <file>` writes every check's id, outcome, detail line and **ms** per
  run — the readings a PROGRESS entry quotes, which the stdout report never
  carries for a green check. The slowest since F11 is
  `every-route-reads-lit-from-its-foot` at **77s on the plant**.
- **Two lists say what the gate does not count, and they are different claims
  (H11).** `suite-skips.json` is "this machine cannot run this" and is **empty
  since H11**; `bench-checks.json` is "`npm run bench` runs this one instead, on
  the real GPU, and the number is in `bench/<date>.json`", and holds the
  92-viewpoint frame budget. Both are reported, never counted, and **both are
  censuses and not levers**: `the-headless-skip-list-holds-only-the-check-it-declares`
  (F15) and `the-bench-only-list-holds-only-checks-the-bench-itself-runs` (H11)
  hold each file to its `ALLOWED` list both ways, and a drop is honoured only on
  a map where its guard passed — skipping a guard withholds every drop it owns
  and prints `SKIPS WITHHELD` / `BENCH DROPS WITHHELD`, so a `--subset` naming a
  dropped check names its guard too. The bench list is held to more because it
  claims more: a reason must name hardware **and** `npm run bench`, no id in both
  files, `bench.mjs` must read the file and **name no id in its own code**, and
  `package.json` must have the command. The summary prints the newest bench's
  date, commit and verdict, or `NO BENCH ON RECORD`; **a stale bench prints and
  does not red** (D69), and **H37** moves that calendar question to the audit.
  Needs `npm install` once (`playwright-core`, no browser download).

**A hung run dies (F10).** The run is raced against the heartbeat the page
publishes (`beat()` in `ui/autosuite.js`). When it stands still for `--stall`
seconds — **240 since F11/D48**, the floor being the slowest *check* (77s); a
pipeline wait beats while it waits and gets `--stall-wait` (600s) — the run is
abandoned naming that check, the tree is closed, exit 2. Against the beat
standing still, **never wall-clock total**: a cold plant run is legitimately
960s or more. `SIGINT`/`SIGTERM` close the same way, and an older `suite.mjs`
is named in `OTHER RUNNERS ALIVE` — its Chrome competes for the same cores.
`scripts/watchdog.mjs`'s header has the rest.

Five more headless tools, each with a PROGRESS entry:

```bash
npm run shot -- --map plant                  # F6: both figures from five eyes
npm run shot -- --map plant --pose vault,aim # F7: one pose, or --pose all
npm run probe -- --map plant probe.js        # F9: a question asked of the game
npm run stamp                                # H3: version.json, from a clean tree only
npm run bench                                # H11: the frame budget, headed, on the real GPU
```

`bench.mjs` is the one that is **not** headless: a real Chrome on this PC's GPU
with the window off the desktop, every map at every level, about two minutes,
appending to `bench/<date>.json`. It refuses to run beside a live `suite.mjs`
and refuses to bench a software rasteriser, writing nothing either way — **run
it in the gap between a gate and a verify, never alongside**. `--quality medium`
or `--map yard` narrows it, `--onscreen` shows the window.

`shot.mjs` writes `shots/look-<map>-<eye>.png` (gitignored) in about 30s a map,
read with the Read tool — the Browser pane's job without the pane. `probe.mjs`
runs a file's text as the body of an async function with `h` and `THREE` in
scope and prints what it returns as JSON (and writes any `pngs`); every "what
does this read" goes through it, and a finding that should stay true becomes a
check — F17 is the worked example. `version.mjs` is H3's, and refuses a dirty tree.

In a real browser, for what neither headless nor the bench can prove (how it
looks, how it sounds): `npx serve -l 5173 .`, then **`?debug=1`** for F3 and F4
(C1: without it the page is the playtest build, every debug key inert) and
`?map=yard`. `window.BLACKLINE` is the harness in both builds; in-game **F3**
overlay · **F4** test mode · **Y** full suite · **U** regression set · **N** the
Warden's ground. Run it **twice** — a flaky check shows as a different answer,
not a pass.

## Environment traps

**They live in `TRAPS.md` now** — about thirty, each one an hour somebody has
already paid. Read that file before you start; the heading stays here because the
scheduled task's prompt falls back to it (G2, D47), and
`traps-md-holds-the-traps-and-handoff-points-at-it` holds both ends.

Two of them here, because a reader of this page should not be without them.
**Verify anything visual by reading pixels back** (`src/tests/pixels.js`) — no
screenshot reaches a scheduled run or the Browser pane. **Warm 60 frames of
`renderFrame(1/60)` before measuring anything**, or you measure a shader compile.

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
red. A3 was the same shape — it *selects* the perches with `canDefuseAt` then
asserts `canDefuseAt` refused them, which proves nothing. **H4 and H11 paid the
same debt up front**: the WebGL2 refusal also asserts the live renderer came out
of that function, and H11's census was proved by breaking two clauses and
watching each name its own line. Any check that picks its own inputs owes the
suite that second half.

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
- The **frame budget on a real GPU is answered** (H11, 2026-10-07) and off this
  list: `npm run bench` on a GTX 1060 says it **holds everywhere, 3x to 6x
  under its ceiling** over twelve readings. What is left is **a friend's**
  hardware, which wants a friend's bench — and, still only eyes, whether a
  player waits on the sub-second bake or on the first draw (H4).
