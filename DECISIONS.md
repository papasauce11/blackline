# Blackline — decisions

Two kinds. **Blocking**: the routine does not do the job until `decided:` is
filled. **Provisional**: the routine has proceeded with the recommendation;
Josh may override at any time and the next session will honour it.

To decide, write one line after `decided:`. Nothing else needs to change.

The routine adds questions; it never edits or removes them.

---

## Decided

### D1 — Where does the routine run?
Local scheduled task (needs the app open) or cloud routine (needs a remote
and a headless runner).
**decided:** local. Josh leaves the app open. (2026-09-08)

### D2 — The second map
**decided:** outdoors, a shipping-container yard, similar size to the first.
Lots of ways for the Shade to take vertical advantage; hard for the Warden to
close the gaps. The Warden gets a railed walkway reached by stairs with an
overhead view, but only difficult places to actually shoot from — e.g. a
small hole in glass. (2026-09-08)

### D3 — What "more styling" means
**decided:** overall detail of the Shade and the Warden themselves first,
then the map. (2026-09-08)

### D4 — Who tests, and when may the routine halt?
**decided:** Josh tests what the routine cannot. Do not halt without him
unless needed. (2026-09-08) — *Read as: presentation choices are provisional,
rule changes block.*

### D5 — A plant on a crate top the Warden can only stand beside
**decided:** the Warden must always be able to defuse. (2026-09-08)
*Interpreted as: a plant is legal exactly where the real defuse check would
succeed for a Warden standing on reachable ground — on or beside. So a charge
on a 2m crate is legal if the Warden can stand at its foot within the defuse
radius and vertical tolerance. If you meant "the Warden must be able to stand
at the charge", change this line to "on only" and A6 will tighten `dy`.*

### D6 — What a refused plant looks like
**decided:** a HUD line, "cannot plant here". (2026-09-08) — No sound, no
noise event.

### D7 — Cadence and merge policy
**decided:** 5pm and 2am. (2026-09-08) The routine never merges to `main`;
Josh merges with `git checkout main && git merge --ff-only phases-14-45`.

### D17 — A climb is a press of Space, never a side effect of moving
Josh, 2026-09-09: *"climbing things again without a choice. must press space
to climb/vault etc..."* The ground path already required it; the airborne
path did not: `_stepAir` tried a mantle on every airborne step, so walking
off any edge while holding forward climbed whatever face was within reach.
**decided:** the Shade climbs only after a press of Space. On the ground,
within the jump buffer, as before. In the air, only if Space was pressed
since it left the ground: the jump that launched it counts for the whole arc,
and a press during a fall arms the rest of the fall. Walking or falling off
an edge without a press never climbs. Step-overs (rises under
`reach.stepOver`) remain automatic; they are walking, not climbing.
Built the same day by the session Josh raised it in.

### D19 — How much a run does
Josh, 2026-09-10: *"not running long enough. maybe 2-3 subphases at a time or
something?"* One job per run was leaving most of each session unused,
especially with S-sized jobs.
**decided:** up to three jobs per run, one at a time, each gated, verified and
committed before the next is picked; the previous verify is the next gate; an
L job is a whole run; stop when a third of the budget is left rather than start
a job that cannot be finished. Prompt, `PLAN.md`, `QUEUE.md` and `HANDOFF.md`
updated the same day.

### D21 — How you ask for a hang
Josh, 2026-09-10, playing: *"Looks like hanging isnt working."* It was not
built: the redesign removed hang-as-failed-mantle and B1 (hang as a held
option) had not been reached. Three inputs were offered — hold Space to hang,
crouch+Space to hang, or grab-first-always.
**decided:** *"tapping space grabs first always. holding space climbs."* Every
mantle-height climb starts with a grab; a tap leaves you hanging, a hold
carries on over. From a hang, Space pulls up, crouch drops, A/D shimmy.
Vault-height ledges go straight over on either. Built the same evening as B1;
spec 20.4.

### D22 — How high a ledge has to be before you can hang from it
Josh, minutes after trying D21: *"shouldnt be able to hang on anything shorter
than 1.4x the height of the shade from the vault position."* With D21 alone a
2m crate offered a hang with your feet half a metre off the floor.
**decided:** no grab below 1.4 Shade-heights (2.59m) measured from the surface
the climb started on; those ledges go straight over. A hang is for a ledge you
had to jump for. `hangMinHeightRatio` in `config.js`; spec 20.4, amended.

---

## Provisional — done as recommended, override any time

### D36 — How long a tap of Space can be
Josh, 2026-09-17, playing: *"tap to hang not working."* Reproduced with real
key events: the grab starts on the step the key goes down and the hand lands
0.18s later, and that was the whole tap window — 200ms hung, 250ms went over.
An ordinary press of a spacebar is 150–250ms.
Taken: a key held through the grab counts as a hold only after
`hangHoldDelay` (0.12s) past the hand landing — **0.30s from key-down**, the
usual tap/hold split. A fresh press from a settled hang still pulls up at
once. The rule (D21) is unchanged; only the number moved. Widen or narrow it
in `config.js`.
**decided:**

### D9 — Yard time of day
Night, floodlit from masts, pools of dark between stacks. Reason: stealth
reads best against hard light, and one shadowed key light is the rule.
Alternative: overcast day, flatter, easier to read at a glance.
**decided:**

### D10 — Post-processing
None until E1–E3 land; then a vignette and a light bloom on the emissives
only, if the frame budget allows. Reason: post costs the same at every
quality level and hides character detail behind glow.
**decided:**

### D11 — The walkway's shooting apertures
Three, each about 0.4m, at the ends and the middle of the glazed run, so the
Warden must move along the walkway to cover a bay. Reason: "difficult to
shoot from" should mean repositioning, not a lucky angle.
**decided:**

### D12 — Can the Shade reach the walkway?
No. It sits above `standing + jumpBonus` from every stack top within 4m, so
the rule keeps it out without an exception. Reason: Josh wants the gaps hard
to close for the Warden; a Shade on the walkway closes them for free.
**decided:**

### D16 — Does a one-way drop count as ground the Warden can reach?
A1 floods the Warden's reachable ground from its spawns. Stepping *up* is capped
at `warden.stepHeight` by the directive; stepping *down* was not specified, and
the two readings differ. Unlimited drops would add everywhere the Warden can
fall to — under a deck edge, into a pit, onto a crate below a gantry — and so
make a plant legal there. The symmetric limit adds only ground it can walk to
and walk back from.

Taken: **symmetric.** A one-way drop is not reachable ground. Reason: the set
exists to answer "could a Warden defuse here", and a Warden that falls somewhere
it cannot leave has not defended the site, it has removed itself from the round.
The AI paths over waypoints and never deliberately drops off a ledge, so a plant
legal only by a fall would strand it in DEFEND exactly the way the room rule
already does — the bug Block A exists to fix. It is also the conservative
direction: it can only ever make fewer plants legal, which is the safe side of
D5's "the Warden must always be able to defuse".

To override, change the line below to "drops allowed" and A1's step test in
`src/mapground.js` becomes one-sided (`ny - y <= step`, no floor on the drop).
**decided:**

### D18 — `canDefuseAt()` is conservative by up to half a cell
A2 answers "could a Warden defuse here" by asking every cell of
`map.wardenGround` within the defuse radius. The ground is a 0.5m grid and
`cellsWithin()` returns cell **centres**, so the answer is exact only to
within half a diagonal — about 0.35m. It is never over-permissive: every
cell returned is a spot the flood proved a standing body fits. It can be
over-strict, refusing a plant the Warden could just barely have reached.

Taken: **leave it conservative.** Reason: it is the same direction D16 chose
for the same reason — the set exists to answer D5's "the Warden must always
be able to defuse", and erring toward fewer legal plants can only ever keep
that promise. A player meets this as a plant refused a hand's width from
where it would have worked, at a room's edge, which reads as "not here"
rather than as a bug.

To override, test the cell's rectangle rather than its centre in
`Objective.canDefuseAt()`, or drop `map.wardenGroundCell` below 0.5m — the
fill cost rises roughly as the square.
**decided:** fine, leave it conservative. Josh, 2026-09-09.

---

### D24 — What a failed climb looks and sounds like
B2. Taken: the body is pushed straight back off the face at 1.6 m/s and
stops rising (`scuffBumpSpeed`); both arms are thrown straight up and drop
over 0.35s (`scuffPoseTime`); the sound is a 90ms low-passed (650Hz) noise
slap at footstep-plus level (`audio.scuff`). From a hang only the arms and the
sound - the body is where it should be, and letting go is the crouch key's
job. Reason: a slap of hands on concrete is dull and short, and the push-back
is the smallest movement that reads as "the wall won" without costing the
player their position. Alternative: a longer slide down the face with a
scrape, which reads better but hands the Warden a longer look at a stationary
target. Nobody has seen or heard it; Josh overrides here.
**decided:**

### D26 — What the ducts are made of
B6. Taken: every piece of a vent run - floor, lips, walls, roof - is one
material, galvanised sheet, `palette.ductMetal` 0xc6d0d6: light and cool,
against concrete 0x6b7076 and the dark concrete 0x3d4247 of every floor.
The interior is the same sheet as the outside; it reads lighter than the
wall it goes through from every approach (the check's readings: 0.27 to
0.81 Michelson, the thinnest at the north duct's west mouth, which opens
onto the orange crate stack rather than onto concrete). Reason: Josh's
interview answer was "metal against concrete", and galvanised is the metal
a duct is actually made of; a lighter surface also makes the mouth read as
a tube with an inside rather than as a dark hole. Alternatives: a darker
gunmetal duct (the gantries' colour) - it would sit at 0.02 to 0.23 against
the dark floors, which is what the check measured for the concrete ducts
and is why it went red; or a rib or flange at each mouth, which is baked
decoration and can come with B7 if the flat sheet does not read. Nobody has
looked at it; Josh overrides here.
**decided:**

### D28 — How a route is lit
B7. Taken: **paint, not lamps.** Every stage of every declared route
(`map.routes` - the crates, the container, the gantries, the low vent lip,
the upper vent's floor, the fire escape's flights) has its four sides drawn
with its own colour as emissive at `map.routeLighting.emissive` (0.12): a
step brighter than the identical surface beside it that is not a route, in
every light and in shadow. Not its top - a body standing on it sees the top,
and the north duct's mouth is read against the crate top it opens onto (B6)
and stopped reading at the first attempt. And the edge each route goes over
at the top - the part of the landing's face the rule names a climb onto from
the last stage, a body's reach either side of the spots it names - carries a
thin strip in the lamps' warm white, unlit, one mesh for the map. Fifteen
strips today: the four deck lips, the fire escape's deck and roof landings,
and the slabs the reach rule found as landings itself - `deck-7`, `deck-19`,
`deck-21` from the duct roofs, three round the bay gantry, three round the
vault hatch. That last list is D25's: with option 2 there those strips go
with the routes. Reason for paint over lamps: a light in the scene is a
thing the detection model reads (Section 7.1) and Section 5 fixes the
count at twelve, so lighting a route with a lamp would make the route a
riskier place to stand, which is a rule and not a look; emissive is seen
and not counted. Reason for the sides: it is what you see from the foot,
and what the check measures. Alternatives: real lamps, at a rule's cost;
a bevel on the lips instead of a strip, which reads only in a raking light;
a lower emissive (0.08 reads as 11 to 20 of luma against 16 to 27 at 0.12).
Nobody has looked at it; Josh overrides here, and the one number to turn is
`emissive`.
**decided:**

### D29 — How a climb and a landing feel
B8. Taken, every number in `config.js` under `shade`:

- **A vault keeps what you brought.** `vaultDurationAtSprint` 0.28s (from
  `vaultDuration` 0.42 at a walk, sliding with the entry speed) and
  `vaultCarry` 0.85 of the entry speed on the exit, floored at
  `vaultExitSpeed` 4.2. A sprint at 6.5 leaves a crate at 5.5; a walk leaves
  it at 4.2 as it always did. Reason: a vault is a run interrupted, and a
  sprint that came out of every crate at 4.2 read as a stop. Alternatives: a
  fixed duration and no carry (as it was); carry 1.0 (a sprint costs nothing
  at all, which makes the crate free).
- **A landing costs by the fall.** `landing`: nothing under `softFall` 1.2m
  (a hop off a crate), everything from `hardFall` 4.0m, ramped between;
  `speedLoss` 0.5 of the horizontal speed cut on the landing step and the
  ground speed held there for `recovery` 0.4s; the camera dips `landDip`
  0.3m and the body squashes `squash` 0.12 of its height. A 5m drop at a
  sprint lands at 3.25 m/s and is sprinting again 0.4s later. Reason: a
  fall from the deck that lands at full sprint reads as no fall at all, and
  the Warden already hears it (7.2); half a second of legs is the smallest
  cost that reads as weight. **This one changes what a player can do** by a
  hair - a Shade dropping off the deck to break contact is 0.4s slower for
  it - and it is in the queue's own words ("landing weight by fall height"),
  so it is taken and flagged: `speedLoss` at 0 is a landing that is only
  seen. Alternatives: a longer recovery with a smaller cut (reads as
  stumbling); no cost, camera and squash only.
- **The camera dips** `climbDip` 0.22m on a vault, mantle or pull-up and
  `landDip` on a hard landing, a critically damped spring bottoming out
  `dipRecovery` 0.26s after the kick, level again in about a second, never
  overshooting. Not on a grab. Reason: a camera that rises with the body at
  the instant of the pull reads as the body being lifted; the dip is the
  body doing the lifting. Alternative: a lag on the follow instead of a dip
  (cheaper to read, but it also lags every jump).
- **The hanging body sits at full stretch.** `hangDrop` 2.05m (was 1.35),
  arms straight up (`HANG_ARM_ANGLE` in agentvisual.js), the gloves on the
  lip, the capsule's top 0.2m under it; `hangPullUpDuration` 0.65 (was
  0.55) for the longer pull. Reason: the rig's hands are 2.08m above its feet
  with the arms raised, so this is where a body hanging by its hands is; and
  at 1.35 the capsule stood half a metre proud of the lip, which made a lip
  under a low gantry unhangable for a reason no player could see. The one
  such lip (hall-container's south face) now hangs and its pull-up scuffs.
  Alternative: keep the body high and the arms bent (a chin-up), which
  reads as stronger and hides the gantry case again.
- **The buffer window** stays `jumpBuffer` 0.12s; what changed is that it
  is honoured in the air and through a climb, not only on the ground.

Nobody has felt any of it; Josh overrides here, and every number is one
line. The rule B8 found - the way up is swept, 20.10 - is not provisional:
it removes nine climbs that went through a duct wall or a gantry, which the
parkour safety rule already forbade.
**decided:**

### D30 — What the round-start briefing is, and that it holds the round
C2. The queue asked for a briefing and controls card, per role, any key
dismisses, a setting to skip. Taken:

- **It holds the round.** No simulation step runs while the card is up -
  the same hold as the pause menu - and the HUD is not drawn behind it.
  Reason: a card over a running round is a card the Warden hunts you
  through while you read it; and a first round that starts on a click you
  made on a menu button is a round that starts before you have found the
  keys. This is flow, not a rule: nothing a player can do changed. The
  alternative - the clock runs, the card is a translucent overlay - was
  not taken because the spec's 240s are the Shade's, not the card's.
- **Any key or mouse button, and the press is spent.** The key that takes
  the card down is not also a jump, a shot or a pause. Alternative: Space
  or Enter only, which makes every other key a dead key on the one screen a
  new player sees first.
- **What it says.** The heading is the round number (or *Free roam*), the
  role, one line of objective with the round's own numbers (the plant
  hold, the detonation clock, the lives, the minutes to plant - from
  `CONFIG.round` and `CONFIG.shade`, so the card cannot disagree with the
  rule), the three sites as `id name` from `map.sites`, and a table of the
  controls for the role read from `input.bindings` so a rebind shows the
  key you would press. The Warden's card is in the Warden's orange.
- **Every round, not the first only.** A best-of-5 shows it five times; it
  is one key each. Alternative: first round only, or a short form after
  round 1. The setting (*round briefing*, on by default) is the way off.
- **The round number bug** the card exposed is fixed, not decided: Next
  round went through `initMatch`, which reset the round to 1, so the HUD
  read `r1` all match and the scoreboard's round column never moved.
  `initMatch` takes `round` now.

Josh overrides any of it; the text is `ui/briefing.js`, the numbers are
the round's own.
**decided:**

### D31 — What hit and damage feedback looks like
C3. The queue asked for a hit marker, a damage direction indicator and a
screen-edge vignette scaling with lost health, each proven from the
pixels. Taken, every number in `config.js` under `feedback`:

- **Drawn by the renderer, not the DOM.** One full-screen quad with a
  shader (`systems/feedback.js`), because `readPixels` cannot see the DOM
  and the queue asks for pixel checks. A side effect worth knowing: it is
  the first `ShaderMaterial` in the project, and the toon look is
  untouched (D10 still holds - this is HUD in the frame, not a post pass).
- **The hit marker** is four diagonal strokes round the centre, white,
  0.025-0.065 half-heights out, for 0.18s. Alternative: a colour per
  target (light, alarm, Warden), or a marker that grows with damage dealt.
- **The direction** is an arc on a ring 0.32 half-heights from the centre
  (inside the Shade's silhouette in third person, outside the crosshair
  in first), Warden orange, 0.76 radians wide, 1.1s, fading over the last
  0.44s; one arc, the latest source. Alternatives: several arcs at once
  (a frag and a rifle from two sides is rare); a full-width screen-edge
  flash on the source's side instead of a ring.
- **The vignette** is `0x6e100c` - a red, not a black - at up to 0.85
  opacity from 0.55 of the way to the edge out, in proportion to health
  lost, and nothing at all at full health. Red rather than dark because
  the map is dark: a dark vignette over a dark apron is invisible, and
  the number the check takes is measured somewhere lit. Alternatives: a
  pulse at low health; a desaturation.
- **Nothing while dead.** The death camera's view is not the body's; the
  vignette would otherwise sit at full strength for the 15s countdown.

Josh overrides any of it; nobody has seen it at a real screen size.
**decided:**

### D32 — What the round and match end screens say, and when
C4. The queue asked for end screens that explain who won, how, and a
five-line timeline of the round, and to honour `roundEndDelay`. Taken:

- **The delay is 2.5s** (`round.roundEndDelay`, already in config and read
  by nothing until now), counted on the sim clock by the objective from the
  step that ended the round; the intermission goes up on a new event,
  `objective:intermission`, and nothing else moves to it. During it the
  HUD carries one line, `round N to the warden - the charge was defused`,
  over the scene. Alternatives: no delay (as it was: the card over
  whatever killed you); a longer one with the scene slowed.
- **The death camera stays up through the delay** when the third life was
  the end, and the intermission takes it down. Before, the round end
  restored a camera the death had not yet begun (the objective hears the
  death first), so the death camera stayed up under the intermission
  until the next round's `initMatch` - or the 16.5s wall-clock guard, with
  its console warning, if the player sat on the card that long. A fix, not
  a choice, but it changes what is on screen for those seconds.
- **How, in a sentence,** one per Section 10.4 row: *the charge
  detonated*, *the Warden defused the charge*, *the Shade lost all 3
  lives before planting*, *the clock ran out with no plant*; one word per
  row in the table's new *how* column (detonated / defused / eliminated /
  clock). The wording lives in `ui/scoreboard.js` (`sayOutcome`); the
  objective records only the outcome key and the reason it always kept.
- **The timeline** is the objective's own log (`round.timeline`): the round
  begins, the plant, each life lost, each reinsert, each Warden down, the
  end, each with the round's clock. The screen prints at most five: all of
  them when there are five or fewer, else the first and the last four, so
  the end and what led to it always show. Alternatives: every line, with
  a scroll; the five "most important" by a weighting; the detection
  events too (the alarm, the first sighting) - those belong to systems
  the objective does not hear, and would need the wiring to log them.
- **The match screen** is the round screen with *Warden wins the match*
  and a tally of how the winner took its rounds (*1 clock, 1 defused, 1
  eliminated*), the last round's timeline under it, and *Main menu*.

Josh overrides any of it.
**decided:**

### D33 — How the Warden shoots, and what the difficulty presets are worth
C5. The queue asked for time-to-detect and time-to-kill measured per
preset, held monotonic by a check, the values in `config.js` under
`ai.difficulty`. The values were already there (`fillRate`,
`aimErrorDegrees`, `reactionDelay`; medium's two are Section 11's) and are
**unchanged**. The measurement found the gun, not the numbers, and two
fixes changed how the Warden shoots on every preset:

- **The gun aims at the torso.** ENGAGE aimed at `lastKnown.y`, which is
  the Shade's *feet* (kept there for the planner), so half of every burst
  went into the floor and, with the pitch bias drawn negative, all of it:
  0 of 52 rounds hit at 8m on every preset. It aims now where the eye
  looks (`torsoHeightRatio`, the perception point).
- **A burst is rounds.** `engageBurstMin`-`Max` (3-7) was decremented per
  *step*, so a "burst" was a sixtieth of a second's worth - one round,
  sometimes two - then a 0.25-0.7s pause: about 100 rounds a minute from a
  600rpm gun. The AI now holds the trigger until the gun has fired the
  burst's rounds (`combat:shot`). This is what Section 11 says, and it
  makes the Warden much deadlier than the one in every playtest so far:
  a lit, still Shade at 8m dies **0.51s** after ENGAGE begins on medium
  (was 1.8s with the aim fixed alone; effectively never with both bugs).
  The line to turn if that is too much: `ai.engageBurstMin`/`Max` and the
  pauses, or the gun's own numbers in `combat.gun` (Section 8.1).
- **The aim error is a cone in yaw and pitch, redrawn per burst**
  (`_drawAimError`), where it was a pitch-only bias held for the whole
  engagement: one draw decided a fight, and a bigger cone could mean a
  luckier one. Now a preset's degrees govern its hit fraction: at 16m
  easy lands 14%, medium 49%, hard 76%.

Measured (`each-difficulty-is-quicker-to-see-you-and-quicker-to-kill-you`,
lit, still, frag withheld, 8 seeds; detect is from the first step in view,
kill from ENGAGE):

| | 8m detect | 8m kill | 16m detect | 16m kill |
|---|---|---|---|---|
| easy | 7.35s | 0.86s | 13.6s | 7.2s |
| medium | 4.97s | 0.51s | 9.3s | 1.4s |
| hard | 3.60s | 0.35s | 6.7s | 0.9s |

Not changed, and worth a look in play: hard's cone (1.2 degrees) makes it
a machine at 8m - 32 of 32 - and medium is close behind it there; the
presets separate by aim only at range, and by the fill everywhere.
Alternatives if the spread between presets should be wider: a bigger easy
cone (8 degrees), a per-preset burst size, a per-preset `engageRange`.
Also found: god mode (Section 17.1, `G`) only ever guarded the frag; the
rifle now honours it too (`Combat.isGodMode`), which is what the checks
that set it were assuming.
**decided:**

### D34 — How a map is chosen, and what the yard is until D2
D1. Two maps exist (`plant`, the substation; `yard`, the container yard)
and the page is built on one of them. Provisional, done as recommended:

- **Another map is another page load.** `?map=yard` on the URL, or the
  main menu's *map* row, which reloads with the next map in the registry
  keeping the seed and the debug gate. Every system takes the map at
  construction and `initMatch` rebuilds the actors on it (Section 15); a
  live switch would need a teardown path nothing else exercises, and a
  reload is the honest version of the same thing. Alternative: rebuild
  the world in place from the menu - more code, no visible difference
  but the flash of a load.
- **The menu names the map** under the title (where "meridian substation"
  was) and the briefing names it after the sites, in italics.
- **The yard, until D2, is an empty fenced plane** with three open bays as
  rooms, a site at each centre, a lamp over each and one at the gate, the
  Shade at the apron corners, the Warden at the gate and in each bay, and
  a ring of eight waypoints. Every number is a placeholder D2 owns; the
  registry entry exists so the plumbing is exercised by a second map that
  is not the first with a different name.
- **`npm run suite` still runs `plant` alone.** `--map plant,yard` runs
  both and reports per map. The yard is not in the default gate until D6
  puts both maps in the regression set, because a check registered for
  the plant's geometry is reported *not for this map* on the yard rather
  than run, and how many of the 150 are scoped that way is D1's census
  (PROGRESS.md).
**decided:**

### D35 — The yard's shape: high-cube containers, a ring with two arches
D2 (2026-09-17). The queue says "container stacks 1-3 high (2.6m each:
one is a jump-mantle, two needs a stack)". Built as recommended, with one
number changed to make the sentence true:

- **The container is 2.9m, a high cube, not 2.6.** `shade.reach.standing`
  is 2.6, so a 2.6m top is a standing mantle at the very limit and a
  floating-point coin toss; at 2.9 one high is a jump and a grab (over
  the hang height, 2.59), two high (5.8) is past the jump's 3.8 and needs
  the one below as a stage, three high is 8.7. `CONTAINER` in
  maps/yarddata.js; `one-high-is-a-jump-and-two-high-needs-a-stack`
  (tests/yard.js) holds the sentence. Alternative: 2.6 with the reach
  lowered - a rule change, not taken.
- **The working yard is a ring of one-high containers** (60 x 42, inside
  the site fence) with a gate north and south and a container laid
  across each as an arch: the Warden walks under, the Shade over, and
  the ring's tops stay one surface. Every bay wall and every stack
  touches the ring or a row that does, so the one-high tops are one
  connected deck (`the-container-tops-are-one-connected-deck`). The
  Shade climbs in anywhere; the Warden uses the gates. Alternative: a
  chain-link fence with gates and containers straddling it - fewer
  boxes, but the fence is a wall to the Shade too (thin, nothing to
  stand on), which makes the gates chokepoints.
- **The bays open at a corner.** A and B are walled by the ring on two
  sides, a 12m row on the south and a 12m row on the lane side, and the
  corner where those two do not meet is the Warden's way in (an L of
  9.4m and 4.6m); C has the lane's gap in its north row and the rear
  gate behind it. A second ground entry each would cut a row's top off
  the deck, so the second entry is the sky.
- **The routes start on pallets** (1.0m, a vault from the ground, a 1.9m
  mantle onto the row beside them): tests/routes.js wants a first step
  found on foot within a standing reach, and a container is not. Nine
  routes, one per stack and one per arch.
- **"Inside anything" on the yard is the crawl space under the flatbed
  trailer** in bay B (bed 1.2-1.5m: a crouched Shade fits under, a
  standing Warden's headroom does not, so the plant is refused there by
  the lid, D20). The census (`plantableSpots`) enumerates crawl spaces
  on every map - the plant has none, honestly - and the two
  inside-anything checks take ducts and crawl spaces alike.
- **Colours are the blockout's**: rows gunmetal, second tier concrete,
  third orange, so a stack reads by height and the orange pallets read
  against the rows (B7's contrast check measures it). E5 replaces them.
- **Lighting is D4's.** Four placeholder lamps; `lit-pools-and-dark-gaps`
  is red on the yard until D4 gives it a night rig.
**decided:**

## Blocking — waiting on Josh

### D8 — Does the site ring still read, now the plant is the whole room?
The ring still looks like "plant here" while meaning "this room". Options:
keep it as a room marker; shrink it to a floor decal at the room centre;
tint the room's floor instead. Recommendation: look at it in play before
deciding. Nothing is blocked on this yet.
**decided:**

### D20 — Should a charge inside a duct be a legal plant?
A5 measured what D5 actually allows, and the answer surprised the plan.
`HANDOFF.md` has said since A1 that the plant rule "excludes the climbs, the
vents and the ledges". It excludes 3 of the 21 climbable tops inside site rooms
and **none of the 8 vent interiors**.

The arithmetic: the two ducts that pass through site A's room run at y=2.3, and
`DEFUSE_REACH.dy` is 2.5. A Warden standing on the floor underneath one is
inside the vertical reach and within arm's length horizontally of a charge in
it, so `canDefuseAt` says yes and the real defuse agrees. It is not theoretical:
A5 planted inside `vent-low-north`, handed the AI the charge the way a plant
does, and the Warden walked over and started defusing it in 9.6 seconds,
standing underneath and reaching up into the duct.

So this is D5 working exactly as written — "the Warden must always be able to
defuse", and it can. The question is whether *reaching 2.3m up into a duct*
is what that sentence was meant to buy, because it is also the Shade's best
hiding place and the one spot the Warden cannot follow it into.

Options:

1. **Leave it.** `dy` stays 2.5, ducts stay plantable, and the duct is a
   high-risk high-reward plant: hard for the Warden to see, easy for it to
   defuse once found, and the Shade cannot defend it from inside without
   being shot through the mouth.
2. **Lower `dy` to about 2.0.** Ducts at 2.3 become illegal; a charge on a 2m
   crate stays legal (the Warden stands beside it at dy 2.0 — which is the
   case D5's own wording was written for, so this is the tightest value that
   still honours it). Costs nothing else: the census's other 369 spots are
   floors and low tops.
3. **Exclude ducts by name.** Rejected before it is asked, but recorded so
   nobody re-proposes it: the redesign's binding rule is that the test is
   purely mechanical, with no tags and no exceptions. A `noVent` flag is the
   `noClimb` flag the redesign spent seven phases deleting.

Recommendation: **1, leave it**, and let a playtest say otherwise. A duct plant
is legible — the beep comes from a hole in the wall — and it is defusable,
which is the whole promise. Option 2 is a one-character change if it plays
badly, and A6 is sized for it.

This changes what a player can do either way, so it waits. A6 is blocked on it
and is now nothing but this question; nothing else in the queue is.
**decided:** no plant *inside* things; on top of things is fine. Josh,
2026-09-10: *"can't plant 'inside' things. only on top."* — none of the three
options as written. `dy` stays 2.5 (a crate top stays legal), and a fourth
clause joins the rule: the charge needs standing headroom above it. Read
mechanically, not by name: a spot is "inside" something when there is a lid on
it lower than a standing body, which is the same headroom test A1's ground
already applies to the Warden. Ducts fail it by their roof; crate tops, floors
and open gantries pass. No tags, no exceptions, which keeps the redesign's
binding rule. Built as A6.

### D23 — Does the Warden hear a failed climb?
B2 built the bump-and-scuff: a press of Space that carries the hands onto a
face they cannot get over pushes the body back, throws the arms up and plays a
short slap. The spec's line is "a physical tell plus audio, never silent", and
that is the player's audio. Whether the slap is also a *noise* - an event in
the noise field the Warden can hear and turn toward, like a footstep or a
landing - is a rule of the stealth game, so B2 did not decide it: today the
scuff is heard by the player and by nobody else.

Options:

1. **Silent to the Warden.** As built. A misjudged climb costs the attempt and
   nothing more; the tell is feedback, not a penalty.
2. **A noise event, quiet.** Around the Shade footstep's radius. A wall is a
   loud thing to hit and a Warden two rooms away should not hear it, but one in
   the same room should look up. Fits Section 7.2's "movement makes noise" and
   punishes a sloppy approach the way a landing already does.
3. **A noise event, loud.** The landing's radius. Turns every misjudged climb
   into a detection risk; probably too harsh while the reach has no markings
   and the player is still learning it by trying.

Recommendation: **2**. It is one `emit('noise', ...)` in `_scuff()` with a
radius named in `config.js`, and the existing noise checks would cover it. Not
blocking anything; a follow-up job takes it when decided.
**decided:** option 2, a quiet noise event around the Shade footstep's
radius. Josh, 2026-09-12, in session. Built as B2b.

### D13 — Rooms, sites and spawns on the first map
B5 may want to move a site or a spawn, or merge two rooms, to make a stacked
route work. The routine will not do that on its own. If it hits the case it
writes the specific proposal here as D13a, D13b… and picks another job.
**decided:**

### D14 — The routine cannot start a dev server, so it cannot verify anything
The 17:00 run of 2026-09-08 could not run its GATE. `preview_start` is refused
in an unattended session ("nobody is present to approve the command"), and a
direct `navigate` to `http://localhost:5173/` was denied because nothing was
serving. D1 chose "local, Josh leaves the app open"; leaving the app open turns
out not to be enough — a scheduled task may not spawn a process.

Nothing in the queue can proceed until one of these is true. Options:

1. **Leave a server running.** Josh runs `npx serve -l 5173 .` in a terminal and
   leaves it up. The routine then only navigates to an already-serving port.
   Cheapest, but unverified — this session could not test whether `navigate`
   to a live localhost port is allowed from an unattended run, and the refusal
   message above suggests the restriction may be on the pane, not the spawn.
2. **Serve as a Windows service / scheduled startup task**, outside Claude, so
   the port is always up. Same as 1 but survives reboots and does not depend on
   Josh remembering.
3. **Build the headless runner (P4 in `PLAN.md`)** — `npm run suite` over
   Playwright + headless Chromium with software WebGL, driven by the Bash tool
   instead of the pane. This is the durable answer: it removes the pane from the
   protocol entirely and is also the prerequisite for the cloud routine (D1's
   alternative). Cost: one to two sessions, and a documented list of checks
   skipped headless (frame budget, audio) with reasons. Pixel readback should
   survive; the frame-budget checks will not.
4. **Give up on unattended runs** and do the work in human sessions only.

Recommendation: **1 now, 3 soon.** Try the standing server first because it costs
one terminal window and unblocks tonight's 02:00 run if it works; queue the
headless runner regardless, because it is the only option that does not depend
on the desktop app's permission model staying the way it is. If Josh picks 3,
the first job of the next working session is P4 and the queue waits behind it.
**decided:** option 3, building now (2026-09-08, the session that set the
routine up). Options 1 and 2 cannot work: the refusal is a rule of the Browser
pane tool itself ("Dev servers can't be started from unattended sessions"), not
a permission that an allowlist or a standing server would satisfy; and the
session's own guardrails will not let a permission allowlist be written by
Claude in any case. The headless runner removes the pane from the protocol.
The build task is paused until it exists.

### D15 - Install Playwright and a headless Chromium for the runner
`npm i -D playwright` plus `npx playwright install chromium` downloads a
Chromium build (roughly 170 MB) from Playwright's CDN into
`%LOCALAPPDATA%\ms-playwright`. Josh must say yes to the download.
Alternative: point Playwright at an installed Chrome or Edge instead of
downloading, if one is present (checked in the same session).
**decided:** no download was needed. Chrome and Edge are both installed;
`playwright-core` (npm, a few MB, no bundled browser) drives the installed
Chrome with `channel: 'chrome'`. Decided by the session, 2026-09-08.

### D25 — Should the deck's void edges refuse a climb anywhere but at a lip?
B5 measured the map's stacked routes honestly (the old "needs a leg up"
count was an artifact of where a ray happened to land; it counted the office
desks and missed two fire-escape flights) and found that the reach rule has
drawn two routes up that nobody designed. The two low ducts run at 2.3m from
the Turbine Hall into the corridor, and where they cross the hall void's
edge their roofs (3.57m, a vault from the duct's lip or a jump from the
floor) sit 2.43m under the deck edge — a standing mantle. So: floor → lip →
roof → deck, silently, at the void's east edge (`deck-7` from the north duct,
`deck-19` and `deck-21` from the south one). The Loading Bay's open gantry
(B4) lands on three slabs beside `lip-bay` the same way, and the vault hatch
on all four of its edges.

The lips were built as "the deck edge is climbable only here", and the rule
no longer reads them: they are geometry that hangs 0.7m instead of 0.35m, and
the plan's B7 ("climbable lips get a bevel or a lit edge") assumes they still
mean *the* way up. Today they mean *a* way up.

B5 declared what is there (`map.routes` in mapdata.js: the five designed
routes and the two duct-roof ones, eight with the fire escape split at its
deck landing) and a check holds the map to it. Nothing is blocked on this.
Options:

1. **Accept.** The duct roofs are routes; a player on a roof 2.4m under a
   mezzanine edge would expect to get over it, and does. Lips stay as the
   drawn entries; B7 lights the declared routes rather than the lips. The
   map has 7 stairless ways up instead of 5. (As built.)
2. **Rail the void edges except at the lips.** A 1.0m rail, thin enough not
   to be a surface and set so the mantle's landing capsule meets it, along
   the hall void, the bay void and three sides of the vault hatch. The
   controller then scuffs on those edges (the B2 tell), the rule stops
   deriving the slabs (B4b's landing test), the lips become the only way
   onto the deck from below, and B7's lit lip means what it says. Costs:
   cover along the deck edges that was not there (a crouched Shade behind a
   rail is hidden from the floor), the Warden's ground and patrol width along
   the edges, and the duct-roof routes become perches. The honest stacked
   count drops from 21 to about 14.
3. **Rail only where a duct passes under** — the hall void's east and south
   edges near the two ducts. Half of 2, without the hatch or the bay.

Recommendation: **1**. It is what the reach rule says, and the redesign's
whole point was that the map obeys the rule rather than the other way
round; a rail is the fence's trick, and the fence is there to close the
site, not to edit a route. If the lips should mean "only here", 2 is a
one-session job (B5b) and the declared routes tell it exactly which slabs to
stop.
**decided:**

### D27 — Can a Warden defuse through a floor?
B5c's census red was a pathing bug (the planner pulled a line across the
hall void's corner and the Warden walked off it - fixed, below), but what
the Warden was walking *to* is the question. The sample plant in room A is
now the north duct's roof at (-7, 3.59, -16): 3.57m up, under the deck,
which is at 6.0. No Warden on the hall floor reaches it - `DEFUSE_REACH.dy`
is 2.5 - so `canDefuseAt()` calls it legal because a Warden standing on the
deck **directly above it** is 2.41m away vertically and within arm's length
horizontally. The AI does exactly that: walks up the stairs, stands on the
deck over the charge and defuses it in 11.8s, through 0.3m of concrete
slab. The real defuse in `objective.js` agrees, because `withinDefuseReach()`
is two distances and knows nothing about what is between them.

That is D5 as written - "legal exactly where the real defuse check would
succeed" - and it is not what "the Warden must always be able to defuse"
means to anyone watching. It also cuts the other way: the same reach lets a
Warden on the floor defuse a charge on a 2m crate top it cannot see over,
which D5 wanted, and one on the far side of a thin wall, which nobody did.

Options:

1. **Leave it.** Two distances. A plant on a duct roof under the deck is
   defused from the deck; the Shade learns that the deck above counts.
   Costs nothing; reads as a bug the first time it happens in play.
2. **A clear line.** `withinDefuseReach(foot, at, collision)`: the charge
   must be in open air from some point of the Warden's body - the segment
   from its feet to its raised hands (`dy` up) - as well as within the two
   distances. Reaching up onto a crate top passes (the hands clear the
   crate's edge); reaching down through a slab, or through a wall, fails.
   Same predicate on both sides, so `canPlantAt()` moves with it: the north
   and south duct roofs stop being legal plants where they run under the
   deck (a Warden on the floor is 3.57m below them), and nothing else on
   today's census is expected to change - the check will say. The 17:00
   run of 2026-09-13 had started building this when the PC rebooted; the
   census's two call sites carried the third argument and were reverted by
   B5c.
3. **Lower `dy`.** Rejected before it is asked, for D20's reason: a 2.5m
   reach is what makes a crate top legal, and 2.41 is not a number to
   legislate by.

Recommendation: **2**. It is the reading of D5 the game has been claiming
all along, the change is one predicate, and the census proves what it
buys before it is kept. This changes where the Shade may plant and where
the Warden may defuse, so it waits for a line here; B5d in `QUEUE.md` is
sized for it and blocked on this.
**decided:**
