# Blackline — playtest notes for Josh

What to run, what to look at, what only eyes can judge, and what is known
to be wrong. The routine updates this with every Block C, D and E job;
the date at the top of each section is the last time it changed. The
checks named in backticks are AUTO checks (`F4` then `Y`, or `npm run
suite`) - they hold the mechanics; you hold the rest.

## Run it

**Play it at https://papasauce11.github.io/blackline/** — the working branch, rebuilt on
every push the routine makes (H2, 2026-09-27), so it is always the last
green commit. Send that link to anyone; it needs a desktop browser with
WebGL2 and a keyboard and mouse. The rest of this section is for running
it from this PC:

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

### There is a quality row, and it can measure your machine (H10, 2026-09-29)

Settings, one new row: **quality**, cycling `low`, `medium`, `high`, `auto`.
It ships on **auto**, which means the first time you open the page the game
watches fifty of its own frames and picks; the row then reads `auto (high)` or
whatever it settled on, and it remembers that pick so it never measures twice.

Five things move with it, and **medium is exactly the game you have been
playing**: a 1024 shadow map, your display's own pixel ratio, full spark
bursts, the outlines on, the post on. Every screenshot and every number in
`PROGRESS.md` was taken there.

| | shadow map | resolution | sparks | outlines | post |
|---|---|---|---|---|---|
| low | 512 | x0.7 | a third | off | off |
| medium | 1024 | x1 | all | on | on |
| high | 2048 | x1.25 | all | on | on |

Two honest warnings. **High does nothing on a high-DPI display** - the game
caps its pixel ratio at 1.75 and a 2x screen is already there, so the row
moves and the picture does not; on an ordinary 1080p monitor it is a real
supersample and the shadow edges tighten. And **low turns the outlines off**,
which is the change you will notice most and the one I am least sure is right:
it is the cheapest thing in the frame to keep and the most useful thing to
see. That is **D60**, and it is one line.

The post row now reads `on, off at low quality` when the level has overruled
it, rather than saying `on` while nothing glows.

You can also pin a level on the URL: **`?quality=low`** opens the page at low
whatever the row says, which is how to see one without changing your settings
(the row then reads `medium (low)` - the level you asked for and the level you
are getting). The headless suite runs pinned to medium for exactly that
reason: auto picks `low` under software WebGL every time, and a suite that
quietly drew with the post and the outlines off would have recalibrated
thirteen pixel-reading checks against a picture nobody chose.

`the-medium-preset-is-what-the-game-drew-before-there-were-presets` pins every
number in the medium row to the constant it came from;
`each-quality-preset-changes-what-a-frame-costs` draws one frame at each level
and reads the drawing buffer, the key light's shadow map, the post passes, the
draw calls and the particles a burst lit;
`the-quality-probe-picks-the-level-its-frame-times-ask-for` feeds the probe
three machines' worth of frame times and also reads what the real boot's own
probe recorded; `a-quality-pin-decides-what-is-applied-and-the-probe-only-records`
holds the pin against every row.

One thing auto gets wrong, and it is queued (**H25**): what it measures is your
machine *times the scene it measured on*. This PC reads 8.70ms on the plant and
picks `low`, and 5.30ms on the yard and picks `medium` - and because the pick is
remembered from the first boot that answers, whichever map you open first
decides it for good. If auto lands somewhere that feels wrong, that is probably
why, and the row still lets you say.

**What is left for you:** whether low should keep the outlines (**D60**).
Whether high is worth having at all on your monitor - if you are on a 2x
display it is a row that does nothing and I would rather drop it than ship a
lie. Whether auto's pick on your machine is the one you would have chosen: the
main menu's footer does not say, but `?debug=1` then **F3** does, and so does
the line the suite prints. And the settings page is fourteen rows now.

### The camera is yours now (H9, 2026-09-29)

Settings, five new rows at the top.

**Look sensitivity, turn** and **look sensitivity, pitch** are separate
sliders. They ship equal, so nothing changes until you move one; drag the
pitch one down if the vertical feels twitchier than the horizontal, which on
a wide monitor it usually does. Both are scaled the same way while the Warden
aims, so the aim still tracks 1:1.

**Field of view, shade** and **field of view, warden**, 60 to 100 degrees,
both shipping at the 70 the game has always drawn at. Two of them because
they are two pictures: a boom 2.2m behind the Shade and an eye in the
Warden's head. Set one and look through the other role to see that it did not
move.

The Warden's **aim** narrows to 52 degrees whatever you set — so a wide FOV
buys a bigger zoom and the same sight picture, which is the way every shooter
does it. Worth a minute with the FOV at 100 and then at 60 with the right
mouse button down.

**Head-bob**, and it ships **off**. Turn it on and sprint: the camera rides up
a couple of centimetres as each foot plants, 1.8cm on the Shade and 3.5cm on
the Warden's eye. It never goes *below* where it rests, because down on this
camera means a landing or a mantle taking its weight (B8) and a stride
borrowing that would make both harder to read.

`look-sensitivity-is-per-axis-and-invert-y-turns-only-the-pitch` moves a
mouse at the two sliders' ends and reads the camera's own world aim;
`each-role-draws-with-the-field-of-view-its-setting-asks-for` reads the
**projection matrix** the renderer draws with, holds the aim down through
forty blends, and dirties the FOV mid-frame to prove a frame puts it back;
`head-bob-rides-the-stride-only-when-it-is-switched-on` sprints each body
down the same lane twice, off and on, and the difference between the two
camera traces is the bob with the ground, the dip and the pullback cancelled
out — which also proves the bob moves the body not at all.

**What is left for you:** whether 60–100 is the right range, or too generous
for a game where one side is hiding — **D59**, one line. Whether the bob
should ship on rather than off. Whether 1.8cm on a third-person boom reads as
weight or as a wobble; it is the one of the two I am least sure of, because a
boom swings the whole picture where an eye swings only itself. And the
settings page is now thirteen rows and wants the grouping **H20** was written
for the controls page — say if it has outgrown your window.

### You can rebind every key (H8, 2026-09-28)

Settings → **Controls**. Seventeen rows, one per action. Click a row (or put
the ring on it and press Enter), then press the key you want: that key
becomes the action's first binding. Six actions ship with two keys — forward
is `W / Up` — and a rebind replaces the first and leaves the second, so
forward becomes `T / Up`. **Escape** backs out of a capture without binding
anything, which is also why Escape is the one key nothing can be moved onto.
For a mouse button, press it *on the cell that is waiting* — that is how
`fire` goes back to Mouse0 by hand.

Every row has its own **reset**, which puts that action's shipped keys back
and touches nothing else.

**A key on two actions is shown, not refused.** Put melee on Space and both
rows say `also jump` / `also melee`, and the game will genuinely do both. If
you would rather it refused the second bind, that is one line — **D58**.

The controls card at round start and the *How to play* page both read the
live keys, so a rebind moves them with it; that was already true before this
job and is checked.

**A rebind does not survive a reload yet** — that is **H19**, the next
settings job. Everything else in Settings does (H7).

`a-rebound-key-is-the-key-that-climbs-and-the-card-says-so` rebinds jump to J
from the page the way you would, then climbs a ledge on J and requires Space
*not* to;
`a-key-bound-twice-is-shown-on-both-rows-and-a-row-restores-its-own-default`
does the conflict and the per-row reset.

**What is left for you:** thirty-five rows is a long flat list and it wants
grouping (**H20**) — tell me if it reads badly at your window size. And
whether the *also jump* note is loud enough to be a warning, or should be.

### The game remembers you now (H7, 2026-09-28)

Change anything in Settings, reload, and it is still there: sensitivity,
volume, match length, difficulty, invert Y, the briefing, post-processing —
and the three from the last two jobs, the **role** row, the **map** you last
picked (a URL with no `?map=` opens on it) and whether you have been offered
the **tutorial**. Since H8 the two sliders keep their value when you set them
with the arrow keys too, which they did not: that was the one gap in this. So H6's "once per browser" is now actually once per browser,
and the tutorial will not come back when you refresh.

There is a new **reset to defaults** row at the bottom of Settings. It clears
the stored record rather than writing today's defaults into it, so if a later
build changes one you get the new one.

The **debug gate is deliberately not kept** — it is the only setting that is
not. `?debug=1` is a property of the page load, and a persisted debug flag
would quietly turn your friends' builds into debug builds with the test keys
live.

`a-setting-changed-now-is-the-setting-a-reload-reads`,
`a-blocked-store-degrades-to-defaults-and-never-throws` and
`the-persisted-settings-are-a-census-and-name-what-they-leave-out` hold it.

**What is left for you:** whether anything in that list should *not* follow
you around — difficulty is the one to think about, since it is the setting
most likely to have been changed for one evening rather than for good (D57).
And if you play in a private window or with site data blocked, the game should
run exactly as it always did and simply forget; that path is checked but has
never been walked by a person.

### The first time you press Play, eight moves (H6, 2026-09-28)

On the plant, with a fresh browser, Play does not start a round — it drops you
into free roam as the Shade with one line at the bottom of the screen, and
eight of them in a row: move, sprint, crouch, slide into a duct, jump, climb,
tap to hang, plant. Each clears when you **do the thing**, never when you press
the key, which is the whole point: `C` standing still is a crouch, not a slide,
and a slide that stops at the duct's mouth has not got you in. There is a
*Skip the tutorial* button under the line. Finish it or skip it and you go
straight into the round you pressed Play for, with the usual briefing.

The yard does not offer it, and that is deliberate rather than unfinished: the
chain needs a duct a crouched body fits into and a standing one does not, the
plant has two at grade and the yard has none, so it would be a prompt you
could never clear.

`the-first-run-tutorial-clears-every-prompt-on-the-act` drives all eight
through the real controller and
`the-tutorial-is-offered-once-and-can-be-skipped` holds the offer, the Skip
button and the second time.

**What is left for you:** whether the order is the right order, whether eight
is too many before someone just wants to play, and whether the line at the
bottom of the screen is where your eyes are. Also, right now it is offered
once per **page load**, not once per browser — `SETTINGS` does not survive a
reload until **H7**, the next job — so it will come back if you refresh.

### The main menu has a card per map (H5, 2026-09-28)

Open the menu and wait a second. Two cards fill in, each a picture of that
map rendered out of its own geometry at boot — there are no image files in
this project and these are not an exception; they are drawn with the game's
renderer and handed to the page as data. The plant's card is a lit building
in a fenced compound, the yard's is plainly a container yard. Click the other
one to switch (still a page load, by design); the one you are on is outlined
and says *selected*.

Also new: a **role** row, which is what Play starts — `shade` is the
competitive match and `warden` is free roam, because those are the two the
game has (D56 asks whether a competitive Warden should exist). **How to play**
and **Credits** pages. And the whole menu is **driven by the keyboard**:
arrows walk the rows and wrap, left and right change a value or nudge a
slider, Enter activates. That is worth a minute of your time because there was
no keyboard path into this menu at all before — `Tab` is switched off
game-wide on purpose.

`the-main-menu-draws-a-rendered-thumbnail-for-every-map` decodes what each
card is actually showing and proves it is a picture of that map and not of
the other one or of nothing; `the-main-menu-title-is-drawn-above-the-cards`,
`every-main-menu-row-is-reachable-and-actionable-from-the-keyboard`,
`the-menu-remembers-the-map-and-role-it-last-played` and
`the-drawn-slices-are-every-slice-that-puts-anything-in-the-scene` hold the
rest.

**What is left for you:** whether the plant's card reads as a place or as a
grey box. It is a sealed shell from outside and every exterior eye gives you
its roof — three were tried. Showing its *inside* needs the roof hidden for
the render, which is **H17** and waits on your word (D55). Also: whether the
cards are bright enough (they carry their own key light, because the maps are
lit for a dark interior and an unlit roof reads as black), whether the map
row under the cards should stay now the cards do its job (**H18**), and how
long the cards take to appear on a real GPU — 4 of the 5 seconds here is the
software rasteriser.

### The page says Blackline before the game exists (H4, 2026-09-27)

Reload and watch the first second. You should see the title and a line
naming what is being built — `geometry · 1 of 6`, then collision, the climb
rule, rooms, the Warden's ground, checking the map — and then the menu. The
map bake is 827ms on the plant and 336 on the yard, and until H4 it held the
main thread for all of it, so a loading screen would have been correct and
never once drawn; it hands the browser a turn between the six slices now.
`the-bake-yields-the-page-a-frame-to-paint` proves the turn is real.

Two refusals you should not see and might want to provoke. A browser without
WebGL2 gets *WebGL2 required* and a sentence, instead of a black page and a
stack trace — in Chrome you can produce it with `chrome://settings` →
hardware acceleration off, or `--disable-gpu --disable-software-rasterizer`.
A phone or tablet gets *Keyboard and mouse* with a **Continue anyway**
button, and the game does boot behind it; there are no touch controls, so
you can look at it and not play it.
`a-browser-without-webgl2-is-told-so-plainly` and
`a-touch-device-is-told-and-the-game-boots-behind-it` hold both.

**What is left for you:** whether the loading screen is long enough to read
or a flicker on a real GPU, and whether the two messages say the right
thing — the wording is provisional (D53) and changing it changes no rule.

### The menu says which build you are on (H3, 2026-09-27)

Bottom of the main menu, under the *map* row, small and dim. On
https://papasauce11.github.io/blackline/ it reads a short commit and a
date — `97354db · 2026-09-27` — and that is the line to ask a friend for
when they report something, because it says exactly which push they were
playing. Run it from this PC and it opens with `dev` instead, because the
host decides that, not a field in the file (D52). `build unknown` means
`version.json` did not load; that also shows as a console error, on
purpose. `the-build-stamp-is-a-real-commit-the-site-serves` proves the
file is served and well formed and that the page loaded it;
`the-main-menu-footer-names-the-build-it-is-running` proves the footer
draws it, at a size and opacity a check measures. **What is left for
you:** whether it is legible at that size, and whether you would rather
it were on the pause overlay too (H12's *Copy report* will carry the
commit either way).

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

### The frame is post-processed (E6, 2026-09-21)

Either map. The lamps glow, the route-lit strips glow a little, the
corners of the frame are a shade darker; the settings menu has a
*post-processing* row, and off is the frame as it was. The checks prove:
a lamp's halo (a ring ten pixels round a fixture reads three to four
times brighter), the corners darker by a sixth and the centre untouched,
the hit marker no bigger, seven passes a frame and none off, the row
switching (`post-processing-blooms-the-emissives-darkens-the-corners-
and-is-a-switch`). What only eyes and a GPU can judge: **the frame
budget** - run F4 then Y in a real browser with the post on and read
`the-frame-budget-holds-everywhere-not-just-at-site-a`; if it is red,
turn the row off and run it again, and D10's "if the frame budget
allows" has its answer; whether the glow reads as light or as haze
(`render.post.bloomStrength`, 0.8; 0.4 is barely there, 1.5 flares);
whether the vignette reads as a frame or as dirt on the lens
(`vignetteStrength`, 0.3); whether the site tint, now multiplied in
linear light and turned down to 0.13, still reads as the site. D46
argues the numbers.

### The yard is dressed (E5, 2026-09-21)

`?map=yard`, either role, a competitive round or free roam. Every
container is corrugated - vertical ridges, 27cm apart, under streaks
and a stain - the ground is wet concrete with puddles, the rows wear
rust at the foot, four boxes carry a number, the trucks' tracks run
through both gates with a kerb inside the south one, oil lies under
the trailer and in the west store, a drip runs down bay A's south row.
The checks prove: every material is on its finish, the ridges are on
screen as ridges (the difference row across a container face crosses its mean 19-23 times, a dozen wanted), the puddles are on screen, every
decal sits on a face clear of the sites, the rust and the stencil are
drawn, the lot costs two draw calls, and the yard's pools, gaps, masts
and walkway read as they did (`the-yard-is-corrugated-wet-and-
numbered`, `the-yard-wears-its-decals-on-its-faces-in-two-draw-calls`).
What only eyes can judge: whether the ridges read as corrugation or as
stripes (the pitch and depth are `yardFinishes.corrugated.grime.ridges`);
whether wet reads as wet or as dark; whether the rust reads as rust at
3m and as a band at 20m; whether a number on four boxes reads as a
yard's stencil or as a copy; whether the walkway in the containers'
sheet reads as steel. D45 argues it; `CONFIG.map.yardFinishes` and
`src/maps/yarddecals.js` are the places to turn.

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
easy / medium / hard and dead 0.8 / 0.5 / 0.35s after that; at 16m, 13.6 /
9.3 / 6.7s and 3.9 / 1.4 / 0.9s. **This is much deadlier than any
playtest before it.** Look at: whether a fight at close range is over too
fast to read on medium; whether easy is easy; whether the difference
between medium and hard is felt at all up close (it is only in the fill
there). The levers are in D33 (`DECISIONS.md`).

**Easy's number at range moved on 2026-09-27** (F17, D54): its aim cone was
5.0 degrees and is 4.0, which took the 16m kill from 7.2s to 3.9s. At 5.0
the cone was wider than a body is at 16m, so a whole burst went the same
wrong way and one fight in sixty never ended at all — a fresh seed drew one
where the Shade stood lit and still in the open, took 119 rounds and lived.
**What to look at: whether easy still feels easy at range.** It should feel
like a Warden who misses a lot, not like one that cannot hurt you; if it now
feels sharp, the one line to turn is in D54.

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
- **The site is a tinted floor, and the HUD names it** (D8, decided
  2026-09-21; C7 the same day). The ring is gone; the site room's floor
  is a shade orange (a multiply at 0.28 - a warmth, not a paint), and
  while you stand in a site the HUD says "SITE A - Turbine Hall" above
  the plant prompt, for either role. What only eyes can judge: whether
  the tint reads as the site from the doorway or only underfoot (turn
  `map.marking.siteTintStrength`; 0.5 reads as paint), whether the
  vault's nine plates around the hatch read as one floor, whether the
  line is where you look; and whether the damage vignette, a deeper red
  since C7 (it darkened less over the darker floor, so the red went
  darker rather than the check), is too heavy at low health. D44 has the
  numbers.
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
