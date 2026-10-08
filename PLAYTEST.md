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

**`npm run bench`** (H11, 2026-10-07) is the one that needed you until now.
Everything else here is measured headless on software GL, which draws a frame
in about 400ms and so cannot say anything about a frame budget; this opens a
**real Chrome on this PC's GPU** (the window placed off the desktop, so it only
takes focus for a second), runs the frame-budget checks on both maps at all
three quality levels, prints the numbers and writes them to
`bench/<date>.json`. About two minutes. It refuses to run if `npm run suite` is
still going — a frame timed beside a sustained all-core load is a reading about
a busy machine — and it refuses to run at all if the browser comes up on a
software rasteriser, because that would be the gate's number wearing the word
bench. `--quality medium` or `--map yard` narrows it; `--onscreen` puts the
window where you can watch it.

## What to look at

Newest first. Each item says what the checks already prove and what is
left for you.

### The Shade breathes, and that is now a number the suite holds (H33, 2026-10-07)

**Nothing changed; this is one look detail you have never been told about,
because it only became visible by being measured.** Standing still, the Shade's
torso rises and falls **4cm on a 7-second cycle** — so over a whole breath the
body rides 8cm. You will see it if you stand still and watch her from the side;
at 25m it is worth about a pixel row, which is how it was found at all (it was
moving a pixel reading between two runs of one suite).

H33 took the census of everything that reading could affect: twenty-three test
modules, eight phases of the breath, both maps. **Everything passes at every
phase**, and the one clause spending real margin is a test's own (a hanging
glove against a ledge, 0.075m of a 0.15m tolerance) rather than anything you
would see. It also turned up a second thing with the same property — the
**gait**, the leg-swing phase, which moves a silhouette far more than the
breath does: a walking frame covers 24% more or fewer pixels depending on where
the legs are, which is as it should be and is only worth knowing if you ever
compare two screenshots of a walk.

**The one thing to be aware of:** the breath's depth is one number, and a test
now pins it at the 4cm the census measured everything else against. If you want
a deeper or shallower breath, say so — it is a one-line change plus a
re-measurement of the figure checks' margins, and **D70** explains why it is
worth that rather than being free.

**And a footnote the same day (H34), because it is the honest kind.** The
census first reported the Shade's neck at 8m as 10–12 pixels wide across the
breath, with a comfortable margin. A denser sweep — 32 phases instead of 8, on
both maps — found 13 and then 14, so the real margin is smaller than first
recorded (still 33% clear of its bar, and nothing shipped changed). The reason
is worth one line because it has now bitten three times: **how finely you
sample is part of what you measure.** At 25m the breath moves the body about
one pixel row, so eight samples find the worst case; at 8m it moves it about
three, the reading spreads over five values, and the extreme turns up once in
thirty-two. Nothing to look at here — it is on this page because the number in
the previous paragraph's neighbourhood changed, and this file should not quietly
hold the first version of a measurement.

**And the glove that was holding the ledge (H38, same day).** The one clause
above that was spending real margin — a test's own, a hanging hand measured
against the ledge it holds — now has a test that checks it at **every** point
of the breath rather than at whichever point the run happened to reach, and it
clears its limit with **56% to spare**. Two things came out of it worth one
line each. The margin is a little tighter than the census first said (2.26
times clear, not 2.75), because the census had read the hand while the Shade's
arms were **still swinging up into the hang** rather than once she was hanging
— nothing about the game changed, only when the ruler was held up. And the
grab itself takes about **a third of a second** for the arms to come from down
at her sides to straight overhead; that is the animation blend doing its job
and no test complains about it, but it is the kind of thing only your eyes can
call, so if a grab ever reads as an arm *snapping* up rather than reaching,
that is the number to change. `the-hanging-glove-holds-the-lip-at-every-phase-of-the-breath`
is the new one, and it runs in a hundredth of a second.

**And the rest of it is closed (H39, same day).** The breath question has been
running for four days across five jobs, so here is the end of it in one
paragraph. Twelve more tests looked at the Shade through a rendered frame and
nobody had checked whether her breathing moved what they measure. Ten of them
**cannot** be affected, for two reasons that are now tested rather than assumed:
a test that photographs the game does not advance the animation, so everything
it compares is the same instant; and the leg-swing is switched off entirely
while she stands still, which she does in all of these. The two that *are*
affected are nowhere near their limits — the closest is a test of the rim light
around her silhouette, which passes with about a third more margin than it
needs. **Nothing to look at and nothing changed.** The one thing worth knowing
if you ever read these numbers yourself: the amount her breathing shifts a
measurement depends on *where* on the body it is taken, and it is largest at the
hands, because they are furthest from the point the breath pivots on. That is
why the hanging-hand test was the only tight one in the whole census.

### Two tests were reading the Shade's hands at two different moments (H40, 2026-10-08)

**Nothing changed in the game, and nothing was broken — but two tests disagreed
about when to look, and only one of them was looking at the right thing.**

When the Shade grabs a ledge, the drawn body does not snap to the new position;
it slides there, so that a 60-a-second simulation does not look steppy on a
faster screen. That slide takes about **three quarters of a second** to finish,
and a grab moves her about a metre. One of the two tests about her hanging hands
was reading them **half a second** after the grab — while the body was still
sliding, about **9mm** below where it was going — and the other was waiting a
full two and a half seconds, which is settled. So the two were measuring the
same hands in two different states, and the earlier one was quietly reading the
slide.

They both wait the same time now, and the test says *why* that time is enough:
it is three times the slowest of the two animations feeding into it, and the
test watches the body arrive for itself and goes red if it ever stops arriving
in time. That matters because the previous explanation blamed the wrong
animation — her arms swinging up, which finishes in a fifth of a second and was
never the problem — and a test argued from the fast one looks settled when it is
not.

**Nothing for you to look at.** If you want to watch it anyway: hang from a lip
and look at the hands. They should sit on it, rising and falling about 8cm over
a seven-second breath, and the body should slide up into the hang rather than
snapping — that slide is the thing all of this was about.

### The frame budget holds on the real GPU, and you no longer have to check (H11, 2026-10-07)

**This closes the oldest thing on this page's "only you can judge" list.**
Since Section 2 was written the project's whole claim about performance was a
CPU number taken on a software rasteriser, and the one check that actually
times the draw was dropped from every gate because headless draws a frame in
400ms. `npm run bench` takes that reading properly. The first one, on this PC:

| | plant | yard |
|---|---|---|
| 92/96 viewpoints, mean draw | 1.27–1.83ms | 1.12–1.72ms |
| worst single viewpoint | 1.90–5.50ms | 2.60–3.90ms |
| check 29's load (smoke + flash + gunfire + ragdoll) | CPU 1.50–2.00ms, GPU 1.59–2.08ms | CPU 0.90–1.40ms, GPU 0.98–1.45ms |

against an **8.33ms** ceiling on the draw and a **16.67ms** budget for the
whole frame, at `low`, `medium` and `high`, two runs each. Twelve readings,
every one green, nothing closer than **1.5x** to its ceiling and most of them
4x or better. Peak 387 draw calls against a 600 cap, 10,950 triangles.
GPU: `NVIDIA GeForce GTX 1060 6GB` through ANGLE/D3D11.

**Three things in there are worth your eye.**

- **`high` is nearly free on this card.** Mean draw 1.71ms at `high` against
  1.75ms at `medium` on the plant, and check 29 costs 2.08ms of GPU against
  2.01ms. So on hardware like this the quality row is not a performance
  decision at all, which bears on **D60** — if you have been playing at
  `medium` out of caution, there is no reason to.
- **`auto` picks `high` here, and both maps now agree.** The probe read
  3.2–4.1ms of CPU across all six scenes, against the 8.33ms a CPU frame is
  allowed. That is the same probe that read **8.70ms on the plant and 5.30ms
  on the yard** under software GL — the disagreement **D68** is about. It is a
  3.4ms gap there and a 0.2ms gap here, so on this machine the map you open
  first no longer changes anything even before H25's fix; on a weaker one it
  still could, so the fix stands.
- **The "worst viewpoint" number does not reproduce and the mean does.** Over
  two runs the means agree to 0.12ms, and the worst moved 5.50ms → 2.60ms at
  `medium` and 2.60ms → 4.60ms at `high`, naming a different place on the map
  five times out of six. The sweep times **one frame per viewpoint**, so the
  worst is a single sample and a scheduling hiccup looks like a hot corner.
  Nothing to do about it on this GPU, where everything is 1.5x under at worst —
  queued as **H36** because on a weaker machine a one-sample worst is what
  would decide the check.

**What is still only yours:** whether 60fps *feels* like 60fps with the post
on, and whether a friend on weaker hardware agrees. The bench answers for this
PC and no other.

### The speed test no longer fails because of one unlucky frame (H36, 2026-10-07)

**This one is a real fix, and it had already bitten.** The test that walks the
camera to ninety-odd places around each map and times how long a frame takes
used to time **one** frame per place and judge the whole map on the slowest of
them. A frame is not always given the machine when it asks: once, while
measuring, a single frame took **13.8ms** at a spot by the yard's north bay -
against a limit of 8.3ms - and the test went **red on the real graphics card**.
The same spot measured again takes **2.3ms**. Nothing was wrong with the game;
one frame got pushed aside by something else on the PC, and the test called it a
performance failure.

It now times **nine** frames per place and takes the middle one, so a frame the
machine stole cannot decide anything - nine when `npm run bench` runs it on the
real graphics card, which is the only place the number means anything at all.
Two things worth knowing. The worst *place* on a map turns out not to be a real
thing - a dozen places are tied within a fraction of a millisecond, so which one
is "worst" changes every run, and the test now reports the busiest **three**
instead of crowning one. And the number that matters is unchanged and healthy:
the busiest views cost **1.9ms to 4.8ms** against the 8.3ms a frame is allowed,
on both maps at all three quality levels.

**Finished now, and the delay bought something.** What was left over on
2026-10-08 was the big automated suite agreeing, and it had stalled three times
getting there. The cause turned out to be about this project's test machinery
rather than about the game: when the suite draws without a graphics card, a
frame does not cost the millisecond or two the clock reports - it costs about
**two thirds of a second**, and no clock in the page can see that, because the
question "has this frame finished?" comes back "yes" while six seconds of work
is still queued behind it. So the test no longer tries to work out how many
readings it can afford. It is simply **told**: nine on the real card, one in the
automated suite, where its verdict is thrown away anyway. Nothing about the
readings above was ever in doubt, and the suite now agrees on both maps.

**Nothing for you to look at** unless you want the names: the busiest corners are
`deck-office-door` and `stair-hall-foot` on the plant, and `gate` and
`store-west-lane` on the yard. If the game ever feels like it hitches in one
specific spot, those are the ones already known to be working hardest.

### If quality is on Auto, the map you open first no longer decides it (H25, 2026-10-06)

**This one a friend could actually have felt**, and it is worth knowing about if
you have ever played on `auto`.

**What was wrong.** On `auto` the game measures a couple of seconds of frames
when it starts and picks `low`, `medium` or `high` from that. The catch is that
it measures your machine **and the map you happen to be in** — the plant is the
heavier of the two, and on this PC the plant measured 8.70ms and chose `low`
while the yard measured 5.30ms and chose `medium`. Same machine, two answers.

And the choice was remembered **the first time only.** So if a friend opened the
yard first, their browser wrote down `medium` and kept it — and then they played
the plant at a level their machine could not hold, for as long as that browser
kept its site data. If they had opened the plant first they would have got
`low` and been fine.

**What it does now.** It keeps the **lower** of the two. Open the yard, get
`medium`; open the plant later, and it quietly drops to `low` and stays there.
Open the plant first and nothing raises it afterwards.

**The cost, and tell me if you disagree.** The level can now only go *down* on
its own. If your machine happens to be busy when you start — a download, a
compile, something else closing — it gets measured as slower than it really is
and remembers that. One click on the quality row in Settings fixes it, and
`auto` is meant as a starting guess rather than a promise, so I would rather err
towards a level that definitely plays. But if you would rather it recovered on
its own, that is a real thing to build and D68 says what it would take.

**What is left for you:** if you play on `auto` and it ever feels blurrier or
flatter than you expect, check what the quality row says — and if it says `low`
on a machine you think should manage `medium`, that is this rule being cautious
and one click undoes it.

### The audio error in the test logs is the machine, and now we can prove half of it (H32, 2026-10-06)

**Nothing in the game changed and there is nothing here to judge.** The sound is
exactly as it was. This is about a line that keeps appearing in the test output,
because it has now been written off once, brought back once, and it was time to
stop guessing.

**The line.** *"The AudioContext encountered an error from the audio device or
the WebAudio renderer."* It has turned up in two of the last six full test
runs, once each time, and never in a way that made a sound check fail — all
sixteen sounds render correctly every time, on both maps.

**What was ruled out.** The obvious suspect was the game building its audio
system twice, because a second audio connection on a machine with no sound is
exactly this message. It does not: there is **one** place in the whole codebase
that opens the audio device, it refuses to do it twice, and a new check now
makes sure no future code sneaks a second one in. The other suspect was the
offline sound rendering the tests use — seventeen of those happen per run — and
every single one has produced correct audio every time, which it could not do if
the renderer were failing.

**So it is the sound hardware, or Windows' view of it**, under a headless
browser that has been running for hours. Worth knowing: the browser *does* give
the game a working 48kHz audio device, so this is not "no sound card" — it is a
sound device that occasionally complains.

**What is still open, and why it is slightly funny.** Nobody has ever checked
whether this happens on a *freshly started* machine, because every observation
came from a test run at the **end** of a long session. The test run at the
**start** of each session would answer it, and that has been happening twice a
day for weeks with nobody writing the number down. It is written down from now
on, and after three of them the question closes.

**What is left for you:** nothing. If you ever see this line in your own browser
while actually playing, that *would* be worth telling me — none of the above
applies to a real browser on a real machine.

### The Shade breathes, and that is why the checks kept changing their minds (H31, 2026-10-06)

**Nothing in the game changed and there is nothing here to judge.** This closes
the loose end the section below it left, and it is a better answer than that
section expected.

**The loose end.** The check that proves the Shade reads as a hooded figure
compares the width of the hood against the width of the neck beneath it. The
same body kept reading a 5-pixel neck in one run and a 6-pixel neck in the next,
and at 7 the check would have gone red — so it was running on about 11% of
margin that nobody had measured.

**It was measured, and it is fine.** 48 readings, six runs, both maps: the hood
came out at **10 pixels every single time** and the neck at **4, 5 or 6 — never
7**. So the check is calibrated rather than lucky, and nothing about it needed
changing.

**And the reason it wobbles is that he is breathing.** Standing still, the
Shade's torso rises and falls four centimetres. At 25 metres his whole body is
only forty pixels tall, so one pixel row is about four and a half centimetres —
**the breath is most of a row.** It slides his body past the pixel grid, so the
narrow part of his neck lands inside one row or straddles two, and the
measurement comes out a pixel different. Nothing is wrong with the figure; the
ruler is just nearly as coarse as the thing it is measuring.

**What is new.** A check now takes that reading at **eight points across a whole
breath** and requires the hood to hold up at the worst of them, rather than at
whichever moment the run happened to arrive at. That is a stronger promise than
the two older checks make, and it caught a second clause in the same place
running on the same thin margin.

**It also corrects something written yesterday.** The previous section explained
the wobble by saying the measuring band slid onto the Shade's shoulders. It
does not — the arithmetic says the band lands on the same rows either way. The
body moved, not the band. The conclusion that section reached is unaffected and
if anything stronger, and **the one thing it asks of you is unchanged**: the look
at a Shade at 25 metres on a small screen, described below.

**What is left for you:** nothing new. The one open look is in the next section.

### The checks now mean the same thing at any window size (H30, 2026-10-06)

**Nothing in the game changed and there is nothing here to judge.** This is a
note about how much to trust the checks, because two jobs running have been about
the same mistake and it is now closed.

**The mistake.** A check that counts pixels was comparing them against a fixed
number. But the frame is drawn at 70% of its size at `low` quality and 125% at
`high`, and at whatever your window is times your display's pixel ratio
everywhere else - so a figure covering 3,014 pixels on the reference frame covers
1,455 on a smaller one. Same figure, smaller frame, and a floor of 2,000 fails
it. H28 fixed the six of these that had actually gone off; H30 went looking for
the rest and found **twelve floors in total**, of which eight needed fixing.

**Three were left alone on purpose**, and they are the interesting ones: the
checks for *"tripping the camera changed something on screen"* and *"the hit
marker is visible"* and *"the damage arc is visible"*. Those do not measure how
big anything is - they measure that it is **not missing**. Scaling such a number
would make it easier to satisfy on a small screen, which is the wrong direction
for a tripwire. D65 has the argument if you want to disagree with it.

**What it buys you.** If you play at `low`, or on a small laptop, or on a
high-density display, the checks are now measuring the same things they measure
on the reference frame rather than silently becoming stricter or looser. And a
new check watches for the next fixed number somebody writes, so this does not
have to be found a third time.

**What is left for you:** nothing.

### A question for your eyes: does the Shade read at 25m on a small screen? (H29, 2026-10-06)

The section below this one left one question open, and this job tried to answer
it with a measurement and **found that it cannot be measured**. So this one is
genuinely for you, and it is a small specific thing to look at rather than an
open worry.

**The ask.** Open the game with `?quality=low` on the URL, in a window about
1366x768 (a small laptop screen). Find a Shade about 25 metres away. **Can you
tell it from a Warden?** If you can, nothing needs doing and you can say so. If
you cannot, that is a real finding about weak machines and there is a decision to
make about a minimum resolution.

**Why the suite cannot tell you.** At that window and that quality level the
Shade at 25 metres is drawn **30 pixels tall and 8 pixels wide**. The check that
reads a hooded figure works by comparing the width of the hood against the width
of the neck beneath it, taking the neck as a band between 14% and 22% of the
body's height - which on a 30-pixel body is only **three rows of pixels**. The
same body read as 2.00x in one run of the same suite and 1.33x in the other.
*(Corrected by the section above, written the day after this one: the reason is
that the Shade is breathing and the body slides past the pixel grid, not that
the measuring band moved. The band lands on the same rows either way.)* A hood
cannot be told from a neck inside eight pixels of width, by this instrument or
any like it.

**What the checks do still guarantee at that size**, because these held in every
run: the body is drawn, it covers the share of the frame it should, and it keeps
its tall narrow proportions (3:1 or better). So it is not a case of the figure
vanishing or going squat on a small screen. The open question is only whether
*you* can read a hood at that size.

**What this does not say.** An earlier draft of this section said the hood reads
fine at every size and there was no minimum resolution to worry about. That was
wrong and rested on the run that happened to measure the neck correctly; it is
corrected here rather than quietly removed. D64 has the numbers and the retraction.

**What is left for you:** the one look described above. That is all.

### The suite judges low and high too now, and five of its "level" bugs were not (H28, 2026-10-05)

The section below this one told you **low is a picture the suite does not
judge**. It is out of date by one job: the suite is now green at `low` and at
`high` on both maps, so if you play at low and something looks wrong, the
checks are at least watching.

**What the six "low is a different picture" reds turned out to be.** Five of
them were one bug and it had nothing to do with quality: a check that counts
pixels was comparing them against a **fixed number**, while `low` draws the
frame at 70% of the size and `high` at 125%. A figure that covers 3,014 pixels
at medium covers 1,455 at low — same figure, smaller frame — and a floor of
2,000 fails it. The same reds would have appeared on a resized window or a
different display. They are fractions of the frame now.

**The one that was diagnosed wrong twice.** The wall-banding check was written up
(by the last job, and by the queue) as a *"1024-only reading"* — a sharper shadow
map banding more. It was not. It reads a fixed rectangle of the frame, columns
700 to 1270, and at low the frame is only 896 wide: it was reading the end of one
row and then part of the row above, assembling a staircase out of two rows and
calling it shadow stripes. At high the columns were all in range and all in the
wrong place, landing on the bay instead of the wall. Nothing was wrong with the
wall at either level.

**Nothing in the game changed.** Every fix here is in the checks. No threshold
was loosened, nothing was added to the skip list, and the gate still runs at
`medium`.

**One thing for you, and it is in D63.** Two checks that read the Shade's and
Warden's *shape* at 25m now read it at the resolution medium ships, whatever
level you are playing at — because at low in a 1280x720 window the Shade at 25m
is **28 by 8 pixels**, and a hood cannot be told from a neck inside eight of
them. That red was about the window, not the level: at low on a 1080p screen the
game draws 1344x756, which is *more* pixels than the checks now use. But it does
mean **nothing currently asks whether a small laptop screen keeps a body legible
at 25m**, and that is a fair question about playing on a weak machine — it is
queued as H29. If you would rather the checks stayed at whatever you are playing
at and held `low` to the silhouette, say so at D63.

**What is left for you:** nothing to judge here. If you want to try it, the game
runs at `?quality=low` and `?quality=high` on the URL as before, and a low run of
the suite is about three times cheaper than a medium one if you ever want a quick
check.

### The quality row is cosmetic again, and a seed means what it says (H27, 2026-10-05)

Nothing here changes how the game plays, and that is the whole point: until
today **the quality row changed what the Warden did**, and now it cannot.

The game has one seeded random number generator, which is what makes
`?seed=12345` replay a match. The problem H24 found is that the spark particles
drew from it, and the quality preset decides how many sparks an impact makes —
so the level you played at decided how far along that stream the Warden's next
decision came from. There are **two** streams now: one for the simulation and
one for everything you only look at (sparks, smoke, footprints, a ragdoll's
tumble). Both come off the seed you type, so a seed still replays exactly; the
difference is that drawing can no longer reach the game.

`the-quality-level-cannot-move-the-simulation` holds it, and the half worth
knowing about is that it also insists the levels **still light different
numbers of particles** — otherwise the check would be satisfied by quietly
making every level draw the same sparks, which would "fix" the bug by deleting
the feature.

**One thing to know:** a given seed now produces a *different* match than it
did before today. It reproduces itself perfectly; it is just not the same match
that number gave you last week. If you had written a seed down because something
interesting happened, that match is gone. Nothing in the repo recorded one.

**What is left for you:** D62, if you would rather `low` kept all its sparks
and paid for them.

### What the suite judges is the medium picture, and now we know by how much (H24, 2026-10-05)

Worth knowing before you trust a green suite: **the checks are calibrated to
`medium`, and only to medium.** Nobody had ever run them at another level. Now
somebody has, once on each map at each level, and here is the honest shape of
it:

- At **low**, eight checks go red — six of them because low is a different
  picture on purpose (no post, no outlines, a 512 shadow map, 70% of the
  pixels), which is them working rather than failing. One was a check reading a
  constant that stopped being the answer, and that is fixed. **The eighth is a
  real bug, and it is not about pixels at all** — see below.
- At **high**, two go red. One is the same fixed constant. The other is the
  wall-banding check, which turns out to be a **1024-only** reading: a 2048
  shadow map has sharper steps and bands *more*, not less.
- So: **low was a picture the suite did not judge.** That changed the same day —
  **H28 closed it**, and the next section is what it found. If you are reading
  this bullet for the state of things, read that one instead.

**And the bug it found, which is fixed.** At low the Warden used to fire
differently — a measurably illegal pause between bursts. The cause had nothing
to do with drawing: the quality preset scales how many spark particles an impact
makes, every particle took three numbers from the game's one seeded random
stream, and the Warden takes its burst pause from that same stream. So fewer
sparks meant the Warden's next decision was a different number. One impact was
15 draws at medium and 6 at low. The quality row was not cosmetic, and
`?seed=12345` only replayed a match at the level it was recorded at.

**H27 fixed it the same session** by giving the effects their own random stream,
so drawing cannot reach the simulation at all — see the next section.

**What is left for you:** nothing to judge here. If you played at low before
2026-10-05 and the Warden felt different from what these notes describe, that is
why, and you were not imagining it.

### The map cards are all one picture of one game (H23, 2026-10-05)

Nothing to look at here unless it is wrong, which is the point of saying it.
The main menu bakes a card per map at boot, one after the other, and on your
**very first visit** the `auto` quality probe finishes measuring somewhere in
the middle of that — about one card in. So the strip could have come out with
the plant drawn at one level and the yard at another. It cannot now: the level
is held still until the whole strip is done, then released, so the cards are
one set drawn one way and the game catches up with whatever `auto` picked a
frame later.

While building it I measured something that makes this smaller than it sounds:
**a card's picture does not depend on the level at all.** With the renderer
provably at `low` — a 896x503 buffer, a 512 shadow map, every outline off, no
post — a card comes back pixel-for-pixel identical to the same card at
`medium`. None of the five knobs is actually inside a card: a card is a fresh
copy of the map in its own little scene with its own light, drawn at a fixed
480x270. So the hold is insurance rather than a repair.

Which leaves one question that is yours (**D61**): should a card preview the
level you are about to play at? I took *no* — a card is where you decide which
map to play, and deciding that from the dimmest version of it is a worse card,
and everyone you send the link to seeing the same strip is worth something. If
you would rather the card showed you your own game, that is **H26** and it is
one line in `DECISIONS.md`.

`every-menu-card-is-baked-at-one-quality-level` holds it, and the half of it
worth knowing about is that it **drops the hold and insists the strip then
breaks** — otherwise the check would be agreeing with itself.

**What is left for you:** D61, above. And whether the cards read as the places
they are of at all, which is D55 and older.

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
and-is-a-switch`). **The frame budget is answered** since H11: `npm run
bench` times the post-processed frame on the real GPU, and D10's "if the
frame budget allows" has its answer - it allows it, 3x to 6x over, at
every level on both maps (the numbers are under *What to look at*). What
only eyes can judge: whether the glow reads as light or as haze
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

- **Whether a hooded figure reads on a small screen** (H29, D64). At
  `?quality=low` in a 1366x768 window the Shade at 25m is **30 pixels tall and
  8 wide**, and the hood-over-neck measurement the checks use needs a band two
  rows deep - so it read the same body as 2.00x and 1.33x in two runs of one
  suite, because one row of body height slides the band onto the shoulders. The
  checks still hold that the body is drawn, covers its share of the frame and
  stays 3:1 narrow at that size; whether you can tell a Shade from a Warden
  there is the part only you can answer.
- ~~**The frame budget on a real GPU.**~~ **Answered, H11, 2026-10-07.**
  `the-frame-budget-holds-everywhere-not-just-at-site-a` is not a thing to
  read by hand any more: `npm run bench` runs it headed on this PC's GPU, on
  both maps at all three levels, and writes the numbers to
  `bench/<date>.json`. It holds everywhere, 3x to 6x under its ceiling, the
  smoke-flash-gunfire-ragdoll load included. The numbers are under *What to
  look at*. What is left is not a measurement: whether 60fps on **a friend's**
  hardware is 60fps, which wants a friend's bench and not yours.
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
