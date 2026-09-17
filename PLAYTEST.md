# Blackline — playtest notes for Josh

What to run, what to look at, what only eyes can judge, and what is known
to be wrong. The routine updates this with every Block C, D and E job;
the date at the top of each section is the last time it changed. The
checks named in backticks are AUTO checks (`F4` then `Y`, or `npm run
suite`) - they hold the mechanics; you hold the rest.

## Run it

```bash
npx serve -l 5173 .
```

Open `http://localhost:5173`. That is the **playtest build**: no debug
keys, no overlay, no assertions. Add **`?debug=1`** for the F3 overlay and
the F4 test panel (or turn on *debug tooling* in the settings menu);
`?seed=12345` replays a match - the same seed is the same patrol order and
the same shots. **`?map=yard`** opens the second map (D1, 2026-09-17), or
click the *map* row on the main menu, which reloads the page on the next
map and keeps the seed. The menu names the map you are on; the briefing
names it after the sites. The yard is **blocked out** (D2, 2026-09-17):
a ring of one-high containers round a 60 x 42 working yard with a gate
north and south and a container laid across each as an arch, three bays
(A and B either side of the lane from the gate, C across the south),
stacks one to three high, pallets, a skip, a flatbed trailer, a
gatehouse. A container is 2.9m: a jump and a grab from the ground, and
the second tier needs the first. Every one-high top connects to every
other - along the rows, up a stack and down again, over the arches - so
once you are up you can cross the whole yard without touching the
ground, and the Warden can never follow. Day lighting from four
placeholder lamps until D4; no walkway until D3; the Warden patrols it
on a 21-node graph but has not been tuned for it (D5).
The settings menu has the difficulty (easy / medium /
hard), the match length (best of 5 or 11), the round briefing on or off,
mouse sensitivity and volume. Controls, gadget slots and the climbing
rules are in `README.md`.

The AUTO suite, from the F4 panel: **Y** runs everything (about seven
minutes on this PC's software GL; seconds on a GPU), **U** the regression
set. `npm run suite` is the same thing headless. Both are green at every
commit; if one is red in your tab, the F3 overlay's *gl context lost* row
says whether the GPU was taken away mid-run. On the yard, Y runs only the
checks that are not about the substation's geometry (26 are, and the
banner counts them as *not for this map*) and one of the rest is red
there until D4: `lit-pools-and-dark-gaps-are-actually-contrasty`, which
wants the lamps to out-light the sky. `npm run suite -- --map yard` is
the same headless; the yard is not in `npm run suite`'s default gate
until D6.

## What to look at

Newest first. Each item says what the checks already prove and what is
left for you.

### The Warden shoots straight now (C5, 2026-09-16)

Until 2026-09-16 the Warden aimed at your **feet** and fired one round a
burst - it could barely kill you. Now it aims at your chest, fires bursts
of 3-7 at 600rpm, and the difficulty presets mean what they say
(`each-difficulty-is-quicker-to-see-you-and-quicker-to-kill-you`): a lit,
still Shade at 8m is engaged 7.4 / 5.0 / 3.6s after it is first seen on
easy / medium / hard and dead 0.9 / 0.5 / 0.35s after that; at 16m, 13.6 /
9.3 / 6.7s and 7.2 / 1.4 / 0.9s. **This is much deadlier than any
playtest before it.** Look at: whether a fight at close range is over too
fast to read on medium; whether easy is easy; whether the difference
between medium and hard is felt at all up close (it is only in the fill
there). The levers are in D33 (`DECISIONS.md`).

### The round has a beginning and an end (C2, C4, 2026-09-15/16)

A briefing card opens every round (objective, sites, controls; any key
starts the round) and an end screen closes it 2.5s after the end, saying
who and how, with a five-line timeline. The mechanics are held
(`a-round-opens-on-a-briefing-that-any-key-dismisses`,
`the-end-screen-says-who-won-and-how-each-way`). Look at: whether the
briefing is worth its pause every round or only on round 1 (D30);
whether the timeline says the right five things (D32); the wording.

### Being hit, and hitting (C3, 2026-09-15)

A hit marker on the centre when your knife or taser lands (or your round,
as the Warden); an arc round the centre toward where damage came from;
the screen edge reddening with lost health. Drawn in the frame, so the
checks read the pixels (`damage-draws-an-arc-toward-where-it-came-from`).
Look at: whether the arc reads at a glance in a firefight; whether the
vignette is too much at one life; colours (D31).

### Climbing without markings (Block B, closed 2026-09-14)

No ledge stripes, no chevrons. If a top is standable and within reach
(2.6m standing, 3.8m from a jump) a press of Space climbs it; ducts are
metal, the stairless routes up are lit a step brighter with a pale strip
on the edge you go over; a press that finds nothing bumps you back with a
slap the Warden hears; a high ledge is a grab - tap to hang, hold to go
over; a vault keeps your speed, a landing has weight, the camera dips.
Every bit of that is measured (the census
`every-climbable-surface-can-actually-be-climbed`, the routes, the pixels
of the mouths and the strips, the 10,000-step traversal fuzz). What is
not: whether **you** can tell, walking the map for the first time, which
way is up - spec check 26 as the redesign rewrote it - and whether the
feel numbers (D29: vault carry, landing cut, the dips) feel right. The
hang at full stretch (B8) and the scuff (D24) are yours to judge too.

### Where you may plant (Block A, closed 2026-09-10)

Anywhere in a site's room - floor to ceiling - **where a Warden could
stand and defuse it**: not on the gantry, not in a duct, not in the
middle of a wide top. A refused spot says *cannot plant here* and nothing
else. Held by the census (`every-plant-spot-in-a-site-room-answers-to-the-defuse-rule`).
Look at: whether the refusal is understood the first time it happens;
whether the site ring, which still looks like *plant here*, misleads now
that it means *this room* (D8).

## What cannot be verified without eyes

The suite drives frames and reads pixels, so most of Section 16 is AUTO
now. What is not, and why:

- **The frame budget on a real GPU.** `the-frame-budget-holds-everywhere-not-just-at-site-a`
  is skipped headless (software GL draws a frame in 400ms). Run it in
  your tab: `?debug=1`, F4, Y, and read its line. It wants 8.33ms
  everywhere, the smoke-flash-gunfire-ragdoll load included.
- **How anything looks.** The checks measure contrast, luma steps and
  pixel counts; whether the result is *legible* - a duct reads as a duct,
  a lit route reads as a route, the strip reads as an edge, the Shade
  reads as dimmer in shadow (spec 27) - is a judgment.
- **How anything sounds.** Every sound is synthesised and rendered to
  samples the checks compare against Section 14, but nobody has said
  whether the scuff sounds like a scuff or the plant beep is too loud.
- **Feel.** Spec checks 1-7 (movement) and 13-16 (combat) as rewritten by
  the redesign: sprinting into a wall, vaulting, mantling, the hang, the
  fall; the takedown from behind and the finisher; the Warden's magazine
  in free roam. The mechanics are asserted; whether they feel good is not.
- **The Warden as an opponent.** The AI's states, its ground and its
  shooting are held by checks; whether it is fun to hide from - whether
  it searches where you would, gives up too soon, stands too still - is
  a playtest question.

## Known issues and open questions

- **The Warden defuses through the floor** (D27, blocking B5d). The
  defuse reach is two distances and no line of sight, so a charge on the
  north duct's roof under the deck is defused by a Warden standing on the
  deck above it, through the slab. Rare in play (you would have to plant
  there) but wrong when it happens. One line under D27 fixes it.
- **The duct roofs are routes up** (D25, blocking B5b). The reach rule
  makes the low ducts' roofs a way onto the deck beside the lips. Left as
  built pending your call.
- **The site ring says *plant here* and means *this room*** (D8).
- **Hard is a machine at 8m** (D33): 32 of 32 rounds hit. Medium and hard
  separate by aim only at range.
- **Difficulty and match length apply at the next match**, not
  mid-round, by design.
- **One console warning per suite run** is expected: the death-camera
  check fires its own wall-clock guard on purpose. In play, that guard
  fires only if a death camera has been up 16.5s - which the end screen
  now prevents (C4).
- **The yard is a blockout** (D2, D35): the shape is there and the
  checks hold it (`the-container-tops-are-one-connected-deck`,
  `one-high-is-a-jump-and-two-high-needs-a-stack`, and the census, the
  routes and the plant rule all run on it), but it is lit like noon
  (D4), has no walkway (D3), and the Warden has not been tuned for it
  (D5). What only eyes can judge: whether a 2.9m container feels like a
  jump-and-grab you would expect, whether the bays read as bays from the
  lane, whether the arches over the gates read as arches. Switching
  maps reloads the page; that is by design.

## How to answer

Every open question is in `DECISIONS.md`. Write one line after
`decided:` and the next scheduled run reads it; nothing else in the repo
needs touching. Provisional decisions (the routine's own calls on looks
and sounds - D24, D26, D28-D33) work the same way: a line overrides them.
Anything that changes what a player can *do* the routine will not decide
without you; anything that changes how a thing looks or sounds it has
already decided, provisionally, and told you where.
