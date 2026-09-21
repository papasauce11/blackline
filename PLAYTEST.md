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
ground, and the Warden can never follow. **Night** (D4, 2026-09-18):
four floodlights on masts over the sites and the gate, a fifth under
the walkway, and dark between the stacks; the walkway is up (D3); the
Warden patrols it on a 21-node graph and defends every bay (D5).
The settings menu has the difficulty (easy / medium /
hard), the match length (best of 5 or 11), the round briefing on or off,
mouse sensitivity and volume. Controls, gadget slots and the climbing
rules are in `README.md`.

The AUTO suite, from the F4 panel: **Y** runs everything (about seven
minutes on this PC's software GL; seconds on a GPU), **U** the regression
set. `npm run suite` is the same thing headless, **on both maps** since
D6 (2026-09-19): the page is loaded once per map, the suite run twice on
each, and every map the registry lists is in the gate the day it is
added. Both are green at every commit; if one is red in your tab, the F3
overlay's *gl context lost* row says whether the GPU was taken away
mid-run. On the yard, Y runs only the checks that are not about the
substation's geometry (23 are, and the banner counts them as *not for
this map*); every one of the rest is green there. **U runs the whole
regression set on both maps** since D7 (2026-09-19): 29 checks on
each, none of them the other map's - the five that named the plant's
walls, ducts and rooms are still in Y on the plant, and the set holds
what they held by searching whatever map it is on (a body driven into
every solid from every site and spawn, every declared route driven to
its landing, the brightest site and the darkest ground, cover found
among the solids). **One number only your tab can give:** the queue
asked for the regression set to run in under 20 seconds; headless it
is about a minute on the plant and half that on the yard, all of it
software GL. On each map, in the console with `?debug=1`:
`console.time('U'); await BLACKLINE.debugTools.runRegressionSet();
console.timeEnd('U')` - if a GPU tab is under 20s the bar is met, and if
not, say so under D6 in `QUEUE.md`.

**`npm run shot`** (F6, 2026-09-20) writes PNGs of both figures side by
side from five eyes - front, side, three-quarter, 8m and 25m - to
`shots/`, one map or every map, without opening the game. It is how the
routine looks at what it built; if a figure note below says "the pixels
say" and you want to see the same frame, that is the command. **`npm run
shot -- --pose all`** (F7, 2026-09-20) does the same for a pose: the
Shade driven into each state (walk, sprint, crouch, slide, rise, fall,
landing, vault, mantle, grab, hang, pullup) and the Warden aiming, one
PNG each, `--pose vault,aim` for a few.

## What to look at

Newest first. Each item says what the checks already prove and what is
left for you.

### The plant is concrete, paint and glass (E4, 2026-09-21)

The plant only (`?map=plant`, the default); the yard is still flat until
E5. Walk the Turbine Hall and the Loading Bay and look at the surfaces
rather than the bodies. Every solid is now drawn in one of three
finishes by what it is: concrete (the walls, floors, the deck, the
ground, the roof) is matte, its toon ramp softened to five bands with
no hot top, and blotched with a grime that darkens it here and there
and pools in the odd larger stain; painted metal (the crates, the
ducts, the gantries, the racks, the light housings, the roller
shutters) is glossy, its body flat with one narrow bright band where a
light is nearly square to it, and streaked with fine scratches; glass
(none on the plant yet - the walkway's panes are the yard's) would
never fall to black. The grime is projected in world metres, so a
crate and the slab under it share one grain and no box has a stretched
or a seamed texture. Then the marks: wheel tracks in through both
roller doors and on the apron outside the north one, an orange-and-
dark kerb painted across each door's threshold, leaks on the floors of
the bay, the hall, the corridor, the deck and the vault, rain drips
from the roof line down the hall's west wall above the catwalk, and
drips from the deck's underside down the bay's north wall and the
hall's east wall. None of them is on or near a climb, a duct mouth or
a site ring. The checks prove: every material is on its finish's ramp
and grime and the ramps differ as configured; a concrete wall and a
painted crate vary across their faces with the grime and not without
it; every decal sits on the face of a solid clear of the sites; a stain
darkens the floor under it; a kerb is drawn; the lot costs two draw
calls; and the readings of every pixel check that was green before are
within a few levels of where they were
(`the-plant-is-dressed-in-three-finishes-and-the-grime-is-on-the-wall`,
`the-plant-wears-its-decals-on-its-faces-in-two-draw-calls`). What only
eyes can judge: whether the grime reads as concrete or as dirt on a
render; whether paint's hot band reads as gloss or as a stripe; whether
the blotches tile visibly (six metres a repeat on concrete, three on
paint - look along the 60m shell wall for a rhythm); whether the
stains and drips read as leaks or as smudges; whether the kerbs read as
paint on the floor or float; whether the whole is darker than you want
(the grime takes about a tenth off concrete on average, and the
lit-pools numbers moved a level or two). The numbers to turn are
`CONFIG.map.finishes` and `CONFIG.map.decals` in `src/config.js`, the
places in `src/maps/plantdecals.js`, argued under D43.

Since F8 (the same day) the key light gives nothing to a face it lights
from behind: the fine diagonal stripes E4's probe found on the east
shell wall from inside the bay were the shadow map comparing that wall
with itself, and they are gone; the price is that every face with the
key behind it and nothing else shading it - the shell walls' inner
faces, the exterior's west and north faces - is about a third darker
(luma 25 to 17 on that wall), lit now only by the fill, the sky and
the lamps. What only eyes can judge: whether those faces read as the
shadow side of a wall or as a hole; look along the east and south
walls from inside, and at the building's north-west corner from the
apron. The check is `a-wall-the-key-lights-from-behind-reads-plain`.

### The bodies move (E3, 2026-09-20)

Either map. As the Shade, in a competitive match or free roam: walk,
sprint, stop; crouch; sprint and tap crouch for the slide; jump; run at
a crate and press Space for the vault, at a chest-high ledge for the
mantle, jump-tap at a high lip for the hang and press Space again for
the pull-up; drop off the deck or a stack for the landing. Every one of
those is now drawn as its own pose, and the body moves INTO each pose
over a fifth of a second rather than being replaced by it: the crouch
leans forward with the thighs bent and the hands ahead; the slide leans
back with the legs out and one hand trailing; a jump holds a stride
with the arms back and, falling, spreads the arms; a press at a face
puts both arms up for it; the vault plants the hands and tucks the
legs; the mantle reaches over the lip and brings a knee up; the pull-up
brings the hands over the front of the body as it rises; a hard
landing squats with the arms out while the legs take it (B8's
recovery). The legs swing by the ground covered - once a stride, so a
foot plants about when the step sounds - and further at a sprint. As
the Warden in free roam (or watching one): the walk rolls and bobs, a
sprint leans; hold the right mouse button and both arms rise, the
rifle comes level and follows where you look; let go and the carry
comes back; the stun drops the arms and sags the body. The checks
prove: every state at least a quarter radian from standing and from
every other, the leg across the vertical once a stride at a walk and a
sprint, no swing standing, the pull-up's hands in front, the sights
raising the right hand 0.15m and the aim's pitch raising it further
(`the-shade-has-a-pose-for-every-state-and-a-stride-for-every-step`,
`the-warden-walks-heavy-and-raises-the-rifle-to-where-it-looks`). What
only eyes can judge: whether a vault reads as a vault or a flail with
straight limbs; whether the pull-up's arms going over the front read as
a pull or a windmill; whether the fifth-of-a-second blend is a body
moving or a body underwater; whether the crouch's raised boots (the
squash shortens the legs, the pose bends them) show; whether the
Warden's raised rifle reads as aimed AT you from down a lane; whether
the feet still slide anywhere (a foot that plants once a stride is
the claim). The numbers to turn are `POSE` at the top of
`src/entities/agentvisual.js` and of `src/entities/enforcer.js`,
argued under D42.

### The Warden has a helmet and a rifle (E2, 2026-09-20)

Either map, a competitive match as the Shade: watch a patrol from a
container top or the deck. The Warden is rebuilt: a domed gunmetal
helmet with a brim and a dark visor sat straight on the shoulders, no
neck, an orange chest with vest plates front and back, a belt of hips
over short splayed legs, heavy pauldrons, and a rifle held at the low
ready in front of the belly, pointing ahead and a little down - both
arms forward and pulled in to it (they were held behind the back
before; nobody had noticed). It is still the six groups the controller
poses (since E3, above, the walk is by the ground covered, the sights
raise the rifle, and the stun sags); each group is one merged mesh on
one material, twelve draw calls where there were sixteen. The checks prove: at 25m as flat shapes, the Warden
is broad (1.5:1) with a helmet narrower than the shoulders under it
and, from the side, a middle that reaches 0.8m ahead of the helmet,
while the Shade is narrow (3.3:1) and hooded and reaches nothing
(`the-warden-and-the-shade-are-told-apart-by-silhouette-at-25m`); the
hulls still sit on their parts (`outlines-sit-on-the-body-they-outline`).
What only eyes can judge: whether it reads as the Warden - a guard, not
a barrel with a gun; whether the rifle reads as a rifle at 25m in a dark
lane, or as a stick; whether the arms, which cannot bend, look like
they hold it or like they point at it; whether the stunned Warden with
its arms dropped and the rifle pointing at the floor reads as "not a
threat"; whether the walk's body roll looks right with the wider
shoulders. The numbers to turn are all in `WARDEN_FIGURE`
(`src/entities/wardenmesh.js`), argued under D41.

### The Shade has a hood (E1, 2026-09-19)

Either map, any mode. The third-person camera is always on the Shade;
the free-fly camera (`?debug=1`, then `BLACKLINE.freefly.enabled = true`
in the console) walks round it. The body is rebuilt: a
narrow teal torso with a hood round the head, open at the face over a
dark lining, a short cowl over the shoulders, thin long charcoal limbs,
the big gloves and boots kept. It is still six groups the controller
poses (E3, above, gave every state its own and the run its stride);
what changed here is what each group holds: one merged mesh on
one material, twelve draw calls for the body where there were twenty.
The checks prove: tall and narrow (3.4:1) and a hood wider than the
neck under it at 8m and at 25m, on both maps, from a flat silhouette
(`the-shade-reads-as-a-hooded-figure-at-8m-and-25m`); the rim still
sits at the edge and the hull still owns the outline (`the-rim-light-
is-really-on-screen`, `the-outline-darkens-the-silhouette-edge`); the
meter still darkens the whole body (`the-shade-visibly-dims-with-the-
meter`). What only eyes can judge: whether it reads as the Shade - a
hooded figure, not a bottle with a collar; whether the hood's dark
opening reads as a face turned toward you or as a hole; whether the
4mm outline is enough on the thin arms at distance; whether the cowl
sits right when the arms swing. The numbers to turn are all in
`FIGURE` (`src/entities/agentmesh.js`), argued under D40.

### The Warden plays the yard (D5, 2026-09-19)

`?map=yard`, a competitive match. The Warden patrols the lanes and the
bays, investigates a noise, hangs its camera on a container, defends a
plant in any bay from wherever it was. Two things changed on **both**
maps and you will see them on the plant too: a Warden investigating a
noise or a sighting within ten metres walks straight to it over the
ground rather than by way of the nearest waypoint (it used to walk
past you to a node beyond and come back), and a Warden kneeling over
your charge stays kneeling - until D5 its own stuck detector read the
eight-second defuse as "wedged" every two seconds, re-pathed it, and it
stood up, walked to the nearest waypoint and came back to start again
(the defuse took four to eight seconds longer than it should, in every
playtest so far). The checks prove: three matches on each map, every
round from a different spawn, the plant at a different site, every one
defused on the clock with the Warden's feet on its ground every step
and no re-paths (`the-warden-plays-three-matches-on-this-map-without-a-
stall`); the difficulty table holds on the yard's lit lane within a
third of a second of the plant's (D33); the state machine walks its
escalation on the yard (`tests/ai.js`, `tests/difficulty.js`,
`tests/aisoak.js`). What only eyes can judge: whether it reads as
patrolling a yard or pacing lanes; whether a defence across forty
metres of yard against a 45-second clock feels fair from the Shade's
side (the soak's longest was 25.5s from 40m); whether the Warden under
a mast, in the fifties on the meter, sees you the way the plant's
Warden does in the seventies; whether a Warden that now walks straight
at a noise is too sharp on medium. The numbers to turn:
`ai.directRouteRange` (10m) in `src/config.js`, and the presets as
before.

### The yard is lit at night (D4, 2026-09-18)

`?map=yard`. Stand in the gate lane and look: four floodlight masts, a
pole against a wall and an arm out over the site, in bays A, B and C
and beside the gate, and a lamp under the walkway's floor over the mid
lane. The sky is nearly nothing; one warm low light from bay C's mast
(the one that covers the most yard, by the checks' count) throws every
stack's shadow north-west and long; the pools under the lamps are the
sites. The checks prove: the lamps out-light the sky at every site
(`lit-pools-and-dark-gaps-are-actually-contrasty`, +13 to +22 of luma
over a sky of 3 to 8), a lane no lamp reaches and a stack's shadow read
under half the dimmest pool and above black, the sky alone lands under a
third of the brightest pool, and no mast is anything the rule lets you
climb (`tests/yardlight.js`). What only eyes can judge: whether it reads
as a *yard at night* or as a black screen with four spots - the fill is
less than half the day's and the shadows read at luma 3, which is navigable
by the number and may not be by the eye; whether the warm key on the
container faces sells "floodlit" or looks like sunset; whether the
meter's reading under a mast (in the fifties) matches how lit you look, and
whether standing in a shadow at the meter's floor looks as hidden as it
reads. Shoot a mast's lamp out and the pool goes; the sky stays. The
numbers to turn are `RIG`, `MAST.lift` and the masts' `dim` flag in
`src/maps/yarddata.js` (D39).

### The yard has the Warden's walkway (D3, 2026-09-18)

`?map=yard`, or the menu's *map* row. Free roam as the Warden: from the
gatehouse turn west, the stair is against bay A's lane row, 24 treads up
to a glazed run over the mid lane. The checks prove: the glass stops a
round and a knife and not your eye; the three slots (each end, the
middle of the south face) are the only way a round leaves, and each
looks down into its bay's open corner or bay C's gap; nothing climbs to
the run, by the rule, from anything within 4m; the Warden walks it end
to end. What only eyes can judge: whether the slots are usable at all
with a mouse - they are 0.4m wide and you have to put the muzzle in one
and aim down (D37 says why they are tall); whether 30% opacity reads as
glass or as haze; whether the run reads as *the Warden's* from the yard
floor. As the Shade: walk up the stair. You can, all the way into the
booth - that is D38, and it is yours.

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

- **The Warden no longer defuses through the floor** (D27, decided
  2026-09-21: no; B5d the same day). The defuse reach is two distances
  and a clear line from the Warden's body to the charge, so the north
  duct's roof under the deck is no longer a legal plant and a Warden on
  the deck does nothing to a charge under it. What only eyes can judge:
  whether a Warden beside a crate top reaching up to a charge on it
  reads right, and whether anywhere you expect to be able to plant now
  refuses - the HUD says "cannot plant here" (D6); tell the routine
  where.
- **The duct roofs are routes up** (D25, decided 2026-09-21: as built).
- **The site ring says *plant here* and means *this room*** (D8, decided
  2026-09-21: a faint floor tint and a HUD line naming the site - C7).
- **Hard is a machine at 8m** (D33): 32 of 32 rounds hit. Medium and hard
  separate by aim only at range.
- **Difficulty and match length apply at the next match**, not
  mid-round, by design.
- **One console warning per suite run** is expected: the death-camera
  check fires its own wall-clock guard on purpose. In play, that guard
  fires only if a death camera has been up 16.5s - which the end screen
  now prevents (C4).
- **The Shade can walk up the Warden's stair** (D38, decided 2026-09-21:
  yes, and the Shade can do anything a human should easily be able to
  do). As built; the booth is open to a Shade that takes the 24 treads.
- **The yard is a blockout** (D2, D35): the shape is there and the
  checks hold it (`the-container-tops-are-one-connected-deck`,
  `one-high-is-a-jump-and-two-high-needs-a-stack`, and the census, the
  routes and the plant rule all run on it), the walkway is up (D3), it
  is lit at night (D4), and the Warden plays it (D5); it is not in the
  default gate until D6. What only eyes can judge: whether a 2.9m container feels like a
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
