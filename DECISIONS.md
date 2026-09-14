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
