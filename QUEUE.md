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
- [ ] **H10 (M)** Quality presets. Low / medium / high / auto — shadow map
  size, post on/off, resolution scale, particle caps, the outline pass; auto
  runs a two-second frame-time probe on first boot and picks. *done-when:*
  each preset changes the measured draw cost in a check; auto's pick is
  recorded in the report.
  **Read this before starting it — H9's run scoped it and stopped rather than
  half-build it.** The job is not "five knobs"; its central risk is that its
  own default path silently recalibrates the suite. **Auto is the hazard.**
  `qualityProbed` starts false, the headless runner gives every map a fresh
  context, and a two-second frame-time probe under SwiftShader (a frame is
  ~400ms) will pick **low** every time, deterministically — so the gate would
  then run with the post off, the outlines off and the resolution at 0.7,
  which is a different picture from the one **13 pixel-reading test modules**
  were calibrated against (`feedback`, `figure`, `groundview`, `keylight`,
  `legibility`, `look`, `materials`, `post`, `sitetint`, `soak`, `visual`,
  `yardlight`, `yardmaterials` — post.js's own comment is the reason: "every
  pixel check reads through this when it is on"). Not flaky, which is worse:
  consistently red, and re-reading every one of them as the fix.
  The way out that keeps both halves of the done-when true: the probe **runs
  and records its pick** (`debugState`, into the run record `scripts/suite.mjs`
  builds at line ~412 beside `contextLosses`, and the printed summary), while
  a **`?quality=` pin** decides what is actually applied — one line at
  `scripts/suite.mjs:357`, which already composes `?seed=&map=`, pinning the
  gate to **medium**. A check drives `probeQuality()` directly and asserts its
  pick; nothing about the gate's picture moves.
  So: **`medium` must be exactly what the game draws today** — `shadowMapSize`
  1024, resolution scale 1, full particles, outlines on, post on — the same
  discipline H9 used to keep `fovShade`/`fovWarden` at `CONFIG.render.fov`.
  Suggested table: low 512 / 0.7 / 0.35 particles / no outlines / no post ·
  medium 1024 / 1 / 1 / on / on · high 2048 / 1.25 / 1 / on / on (the scale is
  a multiplier on `devicePixelRatio` and `maxPixelRatio` 1.75 still caps it, so
  high changes nothing on a 2x display — say so rather than pretending).
  The knobs are reachable: shadow map at `mapkit.js:417` (one caster, one
  line), resolution at `view.js`'s two `setPixelRatio` calls, post at
  `SETTINGS.post`, particles at `E.impactSparks` / `E.detonationSparks` in
  `effects.js`, and outlines in exactly two places — `parts.js:115`'s
  `hullMesh` (both figures) and `mapkit.js:204`'s `_outlineGroup` — so one
  `userData.isOutline = true` at each and a scene traverse is the whole rule,
  rather than hunting `side: BackSide` materials. A row on the settings page
  makes fourteen; see **H22**. Sizing: this is a **full** M, and the verify is
  the expensive part, not the build.
- [ ] **H11 (M)** `npm run bench`: the real GPU. Headed Chrome (the window
  placed off-screen), the frame-budget check and the 92-viewpoint sweep on
  both maps, results to `bench/<date>.json`; the frame-budget check leaves
  `suite-skips.json` for a `bench-only` list it is honest about.
  *done-when:* a bench run on this PC produces numbers the HANDOFF quotes,
  and `PLAYTEST.md` stops asking Josh to run it by hand.
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
- [ ] **H22 (S)** The settings page is thirteen rows and two buttons, and H20
  was written for the controls page's thirty-five. The same grouping serves
  both: **look, audio, match, system**, with the group headings rows the ring
  skips. Do it once, in `_rows()`, and let H20 be the controls page's turn.
  Look only; nothing a player can do changes. *done-when:* the reachability
  check still counts every control on both pages and neither needs scrolling
  in a 720p window.

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
