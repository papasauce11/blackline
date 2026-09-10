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

## Blocking — waiting on Josh

### D8 — Does the site ring still read, now the plant is the whole room?
The ring still looks like "plant here" while meaning "this room". Options:
keep it as a room marker; shrink it to a floor decal at the room centre;
tint the room's floor instead. Recommendation: look at it in play before
deciding. Nothing is blocked on this yet.
**decided:**

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
