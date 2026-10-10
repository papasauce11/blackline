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

### D50 — The second arc (Josh, interviewed 2026-09-25)
The first arc's block table was finished and the routine had run out of
anything it may decide (D49). Josh answered eight questions in two rounds:

| | |
|---|---|
| Target for the next sixty | **Friends can play it** — hosted, a tutorial, a gamepad, rebinding, settings that persist, quality presets, a real-GPU performance pass, a bug report with its seed |
| Also | **Audio** — *ambience only, no music*; **feel and juice**; a **third-sized Warden pass** |
| Section 19, now in | **Gamepad** (aim assist: *none*); vision modes — *"give shade night vision and xray vision that works through thin walls like vents, crates and such, not real regular walls"*, the **alarm camera's live feed**, the **Warden's torch on the night map** (not Warden night vision, not a motion tracker); **voice lines**, synthesised; **skeletal animation** |
| Hosting | **GitHub Pages** (D51 for the URL) |
| Looks | *"I'll decide as I play"* — D39–D46 stay provisional; the routine builds on them |

**decided:** as the table. Blocks H, K, M, J, I, L, N, O in `QUEUE.md`, in
that order; spec 20.34 amends Section 19.

---

## Provisional — done as recommended, override any time

### D72 — The Shade trails her own climb by a quarter of her height, and whether that reads wrong is a look

**Raised by:** H44, 2026-10-09. The measuring, the viewer and the pinned
profile were taken rather than asked, because none of them changes anything a
player sees. **What was deliberately *not* taken is the fix**, and this page is
why: how a body moves into a hang is a look, and looks are Josh's.

**What the queue expected, and what is actually there.** H44 was written from
H40's numbers — the drawn body "0.80m under the capsule one frame in, 0.20m at
a tenth of a second" — and those describe an *instantaneous* metre of
displacement, which is how H40 produced one. A real grab does not teleport the
capsule; it carries it up over the move. So the drawn body falls progressively
further behind **while the climb is happening** and only then catches up.
Measured in whole frames of the real loop, at a hangable ledge, driven through
the keys:

| frame | 1 | 4 | 7 | 10 | 15 | 45 |
|---|---|---|---|---|---|---|
| plant | 0.16 | 0.36 | **0.46** | 0.36 | 0.15 | 0.0015 |
| yard | 0.16 | 0.33 | **0.42** | 0.31 | 0.13 | 0.0013 |

Metres the drawn feet are below the capsule's. The grab lifts 0.90m on the
plant and 0.81m on the yard, the lag **peaks in the middle of the climb**
rather than at its start, and it is a quarter of a second before it is back
under 0.15m. The Shade is 1.8m tall, so the peak is about a quarter of her own
height.

**The reason it may not matter, and it is a real reason.** Every camera that
follows the Shade is derived from the *same* `_smoothPosition`. The
third-person rig's pivot is `_smoothPosition.y - half.y + up + dip + bob`, so
the camera carries the identical lag and **the body holds its place on
screen**. Nothing wobbles, nothing stutters, and the smoothing is doing exactly
the job it was put there to do for a 144Hz screen. What is displaced is the
body against the *world*, and the world is behind her.

**The reason it may matter, and it is also a real reason.** The gloves are part
of the body, so they carry the lag with it: for about a quarter of a second
the hands drawn gripping the lip are **up to 0.46m below that lip** — three
times the 0.15m that `tests/hang.js` calls "on the lip" once the body has
settled, and which it enforces. And the state reaches `hang` at frame 11 with
0.28m still to close, so the body is in the hang, drawn short of it, for a
sixth of a second after the climb is over. It happens on every grab, every
vault, every mantle and every pull-up, which is most of what the Shade does.

**What to look at.** `npm run shot -- --slide` writes one PNG per frame of the
first fifteen to `shots/look-<map>-slide-f01.png` upward, each line printing
the drop. **Frames 5 to 10 are the ones**; frame 7 is the worst.

**The options, if it reads wrong.**

1. **Leave it.** No cost anywhere, and the numbers above are what a player
   gets on every climb.
2. **A faster smoothing while a climb state owns the body** — a second
   constant, used when the state is one of GRAB, HANG, PULLUP, VAULT, MANTLE.
   Cheap and blunt: it also drops the jitter smoothing for the frames after a
   climb ends, where the body is moving normally again.
3. **No smoothing at all while a *timed move* owns the body**, which is the
   principled version of 2. The smoothing exists to hide a 60Hz step on a
   faster screen; a timed move (`_move`, with its own timer and duration)
   already interpolates the capsule smoothly, so there is no step to hide and
   nothing to gain by lagging it. Outside a move everything behaves as today.
4. **Shorten the smoothing everywhere.** Refused before it is offered: it is
   right as it is for the case it was written for, and H25 and H9 are both
   about not changing a thing for everyone to fix it for one.

**Recommendation: 3, as a job of its own (H48), on his word.** The cost of
doing it is the reason it is not a line in H44: four measured constants in
three modules rest on today's profile — `tests/hang.js`'s 150-frame settle and
the margin argued from it, `tests/positionreads.js`'s 0.794m ceiling and its
twelve-state table, and `tests/grabslide.js`'s own profile. Every one of them
would go red, correctly, and want re-measuring. That is a job, not an edit, and
it should be done once, after he has looked.

**decided:**

### D71 — The gate reports a frame cost it used to assert, because no clock in this page can price a draw

**Raised by:** H41, 2026-10-09. Taken rather than asked because it changes no
rule and no look: it changes who is allowed to judge a stopwatch. But it takes
an assertion **off** the gate, and that is the one kind of change this project
holds to needing an argument in writing, so here is the page.

**The background, which is H36's.** A wall clock wrapped round a render on this
machine reads the *submission* and not the drawing. Probed: nine queued draws
submit in 13-24ms, `gl.getError()` comes back 0.6ms later, and a real
`fenceSync` then waits **5.5 to 6.9 seconds** for those same nine — 610-761ms a
queued frame. `frame-budget-under-the-check-29-load` times 180 frames of the
smoke-flashbang-gunfire-ragdoll load and asserted their median against half the
60fps budget: **3.10ms against an 8.33ms ceiling**, 2.7x clear. That reading is
real, and it is a reading about queueing work rather than about doing it — the
frame it describes cost two thirds of a second. The clause could not fail for
the reason check 29 exists.

**What was done.** The clock stops setting the verdict and says so at the line;
the verdict moves to the runner whose clock can price a draw. `npm run bench`
runs this very check in a headed Chrome on the real GPU, refuses a software
rasteriser outright, and now asks for `?timedVerdict=1` — the second parameter
in the repo that one runner asks for and the gate's URL does not. On the GTX
1060 the same clause reads **0.90-2.00ms of CPU with 0.95-2.08ms of GPU beside
it against 16.67ms**, four to five times inside the budget on both maps at all
three levels. Everything in that check which does not need a clock is still the
gate's, every run: that the load assembled, that Section 15's sprite cap held
under it, that the pools neither grew nor leaked, that no runtime assertion
fired.

**The cost, and it is the line to read.** The gate no longer has a tripwire on
the CPU side of a frame. Something that made queueing a frame 2.7x more
expensive used to turn the gate red and now will not; what catches it instead is
a bench, which is manual and whose staleness **prints rather than reds** (D69).
The number is still in the gate's own output, and when it goes over the ceiling
the line says so in as many words — it is simply not a red.

**Two other ways it could have gone, both worse:**

1. *Make the whole check bench-only*, the H11 mechanism, as the sweep is.
   Rejected with a reason: `benchOnly` drops a check's whole verdict, so the
   gate would also stop counting the four clock-free clauses above — the only
   automated proof that check 29's load can still be assembled at all. Dodging
   one dishonest clause by dropping four honest ones is a loosening.
2. *Keep asserting it and document the clock in a comment.* Rejected: that is a
   true sentence about the wrong quantity, and the same mistake H36 had just
   finished taking out of the sweep next door.

**If you would rather keep a tripwire at the gate**, there is a real version of
one and it is not this: a ceiling on *how long it takes to queue a frame*,
argued from measurements of the submission path rather than borrowed from the
frame budget. Nobody has measured what that ceiling should be, and inventing a
number to keep an assertion alive is how the thing above happened, so it is not
in this job. Say the word and it is a job.

### D70 — A test now pins how far the Shade's breath moves her, because a census of margins is a census at one amplitude

**Raised by:** H33, 2026-10-07. Taken rather than asked because it changes no
rule and no look *today* — but it makes one look constant harder to change
tomorrow, and looks are yours, so here it is in one page.

**The background.** The Shade breathes standing still: `POSE.breath` lifts the
torso **4cm** at 0.9 rad/s, a 6.98s cycle, so over a whole breath the body
group rides **8cm**. H31 found that this is why a pixel reading moved between
two runs of one suite — the phase a check reads is a function of how many
frames the whole run drew before it — and H33 took the census of what that
reaches: twenty-three modules, eight phases, both maps.

**The thing worth your eye.** Four of those modules are declared **out of the
breath's reach**, and the census proves each reason behaviourally rather than
asserting it in a comment: it drives a whole breath through the body and
requires the torso to ride its 8cm *while* every limb rotation, the camera's
world height and the Warden's chest hold still. The first draft of that clause
required the ride to be **at least half of `2 * POSE.breath.lift`** — which
would have been satisfied by setting that constant to zero, with a body that
does not breathe, and all four proofs then trivially true about a mechanism
that no longer existed. So the ride is pinned **absolutely**: `MEASURED_RIDE`
is 0.080m with 0.020m of tolerance.

**The cost, which is the line to read.** If you ever want a deeper or shallower
breath — it is one number, `CONFIG`'s `POSE.breath.lift` — that check goes red
and says so in as many words: *"the Shade's torso moved Xm against the 0.08m
this census measured its table at; every margin in POSED above wants
re-measuring."* That is the intended behaviour and not an obstacle: the whole
table of margins is a set of readings taken at one amplitude, and a bigger
breath moves every one of them (the thinnest, `tests/hang.js`'s glove, already
sweeps **half** of its 0.15m tolerance at 4cm). But it does mean a look change
you would expect to be free now costs a measurement.

**Two other ways it could have gone, both worse:**

1. *Leave the clause relative.* Rejected above: it is a tautology, and the
   first draft is the worked example of how a clause can look like a check and
   assert nothing.
2. *Assert nothing about the amplitude and trust the table's prose.* This is
   what H30 explicitly stopped doing for pixel floors and F15 for the skip
   list: a census held by a comment is a census that rots, and the point of
   H33 was to leave numbers somebody can rely on.

So: **nothing shipped changed, nothing a player can see or feel changed**, and
if you want a different breath, say so and the job that changes it
re-measures — which is the correct amount of work for a change that moves
every margin in the figure checks.

### D69 — A bench-only check is answered by `npm run bench`, and a stale answer prints rather than reds

**Raised by:** H11, 2026-10-07, and taken rather than asked because nothing
here changes a rule or a look — it changes what the gate's output says about a
check the gate has never been able to run. It is yours to overturn and the cost
is named below.

**What was wrong with the old arrangement.** One check has been dropped from
every gate since F5: `the-frame-budget-holds-everywhere-not-just-at-site-a`,
the 92-viewpoint sweep, because headless draws with SwiftShader at ~400ms a
frame and a frame budget measured against that is not a reading. F15 made the
drop honest — `scripts/suite-skips.json` is a census, held both ways by a check
— but honest about the wrong thing. **A skip says "this machine cannot run
this", and then nobody owes an answer.** So `PLAYTEST.md` asked you to open the
game, press F4 then Y, and read one line by hand, and for a month nobody did,
and the project's only statement about its own frame budget was a CPU number
from a software rasteriser.

**What is built.** Two lists instead of one, because they are two claims:

- `scripts/suite-skips.json` keeps its meaning and is now **empty**.
- `scripts/bench-checks.json` carries the new one: *`npm run bench` runs this
  check instead, headed, on the real GPU, and the number is in
  `bench/<date>.json`.*

One file, two readers — `scripts/bench.mjs` runs what it names and
`scripts/suitereport.mjs` drops what it names — so the bench cannot drift from
the gate. `the-bench-only-list-holds-only-checks-the-bench-itself-runs` holds
both ends from inside the page, including that `bench.mjs` names no id in its
own code and that `package.json` really has the command. **And the gate's
summary now prints the date, commit and verdict of the newest bench**, or
`NO BENCH ON RECORD` when there is none.

**The line worth your eye, which is the cost.** A bench-only check is answered
only when somebody runs the bench, and **a stale answer prints rather than
going red**. So the gate can say "OK" beside a real-GPU number that is three
weeks old and belongs to a different commit, and nothing stops it. That is
deliberate — the gate runs on a machine that may not have the GPU the bench
needs, and a red for "nobody has benched lately" would be a red about a
calendar — but it is a judgement, and the two alternatives are real:

1. **Taken: print the staleness, never red on it.** The reader decides. The
   failure mode is a number nobody notices has rotted.
2. *Red when the newest bench is older than N days or names another commit.*
   Stronger, and it would have caught exactly the month this job closed. The
   objection is that it makes the gate's verdict depend on something the gate
   cannot do, and a routine that cannot clear it would stop building. Worth
   doing **as a line in the weekly audit instead**, which is where a
   calendar-shaped question belongs; that is **H37**.
3. *Run the bench from the gate.* Refused: the gate is headless by necessity
   (a scheduled run has no pane and should not be opening windows), and a
   headed Chrome inside a run that already takes half an hour is the kind of
   coupling that makes a gate fail for reasons that are not about the game.

**And the answer the first bench gave, which is the reason any of this
matters.** On this PC's GTX 1060, over both maps and all three levels, twelve
readings: **the frame budget holds everywhere, 3x to 6x under its ceiling.**
Spec check 29's load (smoke, flashbang, sustained gunfire and a ragdoll at
once) costs CPU 2.00ms + GPU 2.01ms against a 16.67ms budget on the plant at
`medium`. The numbers are in `HANDOFF.md` and `bench/2026-10-07.json`, and
`PLAYTEST.md` no longer asks you for them.

### D68 — `auto` remembers the lowest level any probe has picked, not the first

**Raised by:** H25, 2026-10-06, and taken rather than asked because the queue
said so in as many words — *"look rather than rule, so provisional either
way"*. It changes what a friend on `auto` is shown, so it is yours to overturn
and the cost is named below.

**The defect.** `auto`'s probe measures a median CPU frame and picks a preset.
H10's own verify measured this machine twice and nobody read what it implied:
**8.70ms on the plant, which picks `low`**, and **5.30ms on the yard, which
picks `medium`**. The plant is the heavier scene, so what the probe measures is
the machine **times the scene**. And the rule for remembering it was *store the
pick if nothing is stored yet* — the first boot that answers — so **whichever
map a friend happened to open first decided their quality for the life of that
browser.** Open the yard, get `medium`, then play the plant at a level that
machine cannot hold, until they clear their site data or find the settings row.

**Taken: keep the lower of what is stored and what was just picked.** It is the
only rule that is safe in both orders. A player whose plant needs `low` is not
left on `medium` because they opened the yard first, and a player who opens the
plant first is not raised by the easier scene afterwards. `rememberedPick` in
`quality.js` is the whole of it, the preset table's own order decides which is
lower (so a fourth preset is ordered by where it is put rather than by a list
somebody forgot), and a stored value the table does not recognise is treated as
nothing stored rather than compared against — which matters because H7's store
validates a key by type and not by range, and that is **H21**.

**The cost, which is the line worth your eye.** The level now only ever goes
**down** on its own. A machine that was briefly busy — a big download, a
compile, another game still shutting down — gets measured as slower than it is,
and that reading is remembered for good. The player fixes it in one click on the
settings row, and `auto` is a starting guess rather than a promise, so I think
that is the right way round: an honest `low` is playable and an optimistic
`medium` is not. But it is a real asymmetry and you may disagree.

**The two alternatives, and why not.** *A pick per map* is more faithful — each
scene gets its own reading — and was refused as more record than the problem is
worth: two keys, a migration for the one that exists, and a player who still
cannot say what their quality "is". *Letting it drift back up* (re-probe and
raise when several readings agree) is the honest fix for the transient-load
cost, and it is a feature rather than a bug fix: it needs a history, a rule for
how many agreeing readings count, and a decision about whether raising someone's
level mid-session is welcome. If the asymmetry above bothers you, that is the
shape of the answer and it wants its own job.

**Also fixed here, and it is why this went a month unnoticed.** The headless
runner's summary printed the quality line for the **first run only** and
silently dropped every other map's — so a two-map suite showed the plant's
probe and never the yard's, and the disagreement that is the entire problem was
invisible in the output everybody reads. It prints one line per map now.

decided:

### D67 — The code side of the `AudioContext` error is closed; a console error still does not fail the gate

**Raised by:** H32, 2026-10-06, and recorded rather than asked because it
changes nothing a player can do. It is here because it decides what the suite
notices, which D63 established is yours to overturn, and because it is the
second time this error has been written about with a conclusion attached.

**What was asked.** *"The AudioContext encountered an error from the audio device
or the WebAudio renderer."* has appeared in two of the six verifies on record
(H27 on the yard, H29 on the plant; H28, H30, H31 and H32 clean - the last
three in a row, which is exactly the shape of evidence H28 mistook for a
closure). H27 said it would
be a defect if it recurred on a cold run. H28 wrote *"that closes it as the
machine"* after one clean verify and H29 had to retract that. H32 was told to
stop writing it off and define the test instead, and to check one cheap
code-side hypothesis: can the audio graph be built more than once per page?

**The code side is closed, and the answer is no.** There is **exactly one**
module in the whole of `src/` that names the realtime constructor —
`src/systems/audio.js`, on three lines — and `unlock()` returns the existing
context when there is one. That is now a ban with one named owner, on F13's
model, so a second module reaching for it is red. And the other half of the
message, *"or the WebAudio renderer"*, is ruled out too: a run builds
**seventeen** offline contexts and every one has rendered correct samples in
every run on record, where a renderer that errored would have failed a render
and turned a sound check red. One live context, seventeen offline ones, all
correct. What is left is the device.

**One correction to H27's reasoning while we are here.** H27 argued in part that
*"headless Chrome has no audio device"*. It has one: the new check reads the
live context as **running at 48000Hz** on both maps. So the error is not a
context failing to find a device — it is a device that intermittently errors,
which is a smaller and more plausible claim.

**What is still unknown, and the joke in it.** Whether it ever happens on a cold
machine. **All six observations are end-of-session verifies**, taken after an
hour or more of driving Chrome — so the cold run H27 asked for has never been
recorded. And it happens twice a day already: **the GATE is a cold run**, and no
session has ever written down its gate's console-error count. `HANDOFF.md` now
asks every run to, **H35** closes it once three are on the record, and the
runner now stamps each error with the map, the run and the seconds into it, so
one occurrence is worth more than these five were.

**Taken, and this is the line for your eye: a console error still does not fail
the gate.** It is counted, it is now *printed* in the summary rather than left
in the JSON, and `HANDOFF.md` tells every run that a new one is a defect even
when every check passes — but the run still exits 0. The alternative is to make
the gate red on any console error, and it was refused for a specific reason:
**this error would have failed two of the last six verifies**, both of which
were correct runs of a correct game, and a gate that goes red on the machine's
audio service stops the project twice a week for something no player will ever
meet. The weaker version — fail only on an error attributed to a file in `src/`
— is better and is still not free, because the two occurrences are attributed to
the page URL and would pass it, so it would buy nothing today while adding a
rule to maintain. If you would rather the gate were strict about this, say so
and it is a few lines in `suitereport.mjs`.

decided:

### D66 — The hood's margin is 11%, the clause stands, and D64's account of why it moved was wrong

**Raised by:** H31, 2026-10-06, and recorded rather than asked because it
changes nothing a player can do. It is here for two reasons: it decides what the
suite will and will not notice, which D63 established is yours to overturn — and
it **corrects the mechanism D64 gave for its own numbers.** D64 cannot be
edited, so the correction lives here.

**What was measured.** Two shipped checks assert the Shade's hood is 1.5x the
neck under it, on a band three rows deep at the buffer they read. H29 had seen
the same body read a neck of 5px and of 6px, so a third reading of 7px would
have been 1.43x and red. H31 measured it before touching either: 48 readings,
six runs, both maps, face-on at 25m on the reference buffer.

| | |
|---|---|
| the hood | **10px in every one of the 48** |
| the neck | **4, 5 or 6px — never 7** |
| `hood/neck` | 1.67x to 2.50x, **worst 1.67x** against the 1.5x bar, in all six runs |
| the widest row of the same band | 8, 9 or 10px — so `HOOD_OVER_ALL_BELOW` read **exactly 1.00** against its 0.9 |

**Taken: the clause stands, with the margin named at its line, and a new check
holds the worst phase.** The queue offered a replacement clause if the neck
reached 7px; it did not. So nothing about either shipped check changed. What is
new is `the-hood-holds-its-ratio-at-every-phase-of-the-breath`, which sweeps the
breath and asserts **both** of that band's clauses at the worst of eight phases
— a claim neither shipped check makes, because each takes the one reading its
own arrival gave it. The margin is now *held* rather than merely documented.

**The correction, and it is the part worth your eye.** D64 explained H29's 8/4
against 8/6 by saying the neck band is *two rows* on a 30-row body and that the
measured height moving from 31 to 30 slid those rows onto the shoulders.
**The arithmetic does not support that.** `band()` measures down from the top
row and both ends scale together, so at 30 rows the band is **three** rows at
offsets 5, 6 and 7 from the top — and at 31 rows it is **the same three
offsets**. The other pair D64 quotes, 24 and 23 rows, is offsets 4 and 5 at
both. A one-row change in measured height moves that band in neither case.

What moves the reading is the **breath**. The Shade's torso rises and falls 4cm
at 0.9 rad/s standing still, `updateVisual` runs on the wall clock from the
render frame rather than from the fixed step, and `Agent.reset()` deliberately
leaves the phase alone — so the phase a check reads is a function of how many
frames the whole run drew before it. At 25m a row of this body is about 4.5cm,
so the breath is most of a row: it slides the body past the pixel grid and the
narrow part of the neck falls inside one row or straddles two. That is measured
at the reference. For the small buffers it is an inference, but a strong one —
the band arithmetic rules out the stated cause, and H29's instability reproduced
in these six runs (956x538 ran 1.33x to 2.00x, 896x503 ran 1.00x to 1.50x,
while the reference read 1.67x six times out of six).

**D64's conclusion is unaffected and is reinforced.** The hood-over-neck ratio
is not meaningful below the reference buffer and nothing asserts it there; your
one eyes-only question in `PLAYTEST.md` is unchanged and still the only thing
that can settle whether 30x8 pixels reads as a hood. Only D64's explanation of
its own disagreement changes, and it changes from "the band slid" to "the body
did".

**What was deliberately not done, in case you would rather it were.** The
alternative to sweeping the phase is to **anchor** it — zero the breath's phase
in `Agent.reset()` so every check reads the same one. That would make every
pose-reading check in the suite repeatable to the pixel, which is tempting. It
was refused because it buys stability without buying coverage: a player sees
every phase, so a clause that holds at one chosen phase is still a clause nobody
has bounded, and sweeping is the stronger claim. It would also change what a
reinserted body looks like for a fraction of a second, which is a look decision
this job had no need to take. If you would rather the suite were repeatable than
thorough here, say so and the anchor is about four lines.

decided:

### D65 — Three pixel floors stay absolute, because they are existence claims

**Raised by:** H30, 2026-10-06, and recorded rather than asked because it changes
nothing a player can do. It is the judgement half of a job whose other half was
mechanical, and it is the line a later reader is most likely to want to argue
with.

H28 scaled six pixel floors and left the rest, noting honestly that *none of them
is red at any level today, which means only that no level happens to cross them*.
H30 read every floor in the suite. There were **twelve**, and the census is:

- **eight scaled** - a body in `visual.js` and `presentation.js`, an alarm
  fixture, the killer in the death cam, a vent region and a route strip in
  `legibility.js`, and the rim in `presentation.js`. Each is a thing in the world
  projected into the frame, so the pixels it covers go with the square of the
  buffer height (`scaledCount`, H28).
- **one already correct** - `feedback.js`'s damage vignette, which was written as
  5% of the frame because it covers the whole view. It is the precedent the rest
  followed.
- **three left absolute**, which is this decision.

**The three, and why.** `visual.js`'s *"tripping the camera changed nothing on
screen"* at **10px**, and `feedback.js`'s hit marker and damage arc at **20px**
each. None is a claim about how big a thing is. Each is a claim that **something
was drawn at all**, with the size, placement and shape asserted properly in the
clauses immediately around it - the hit marker's extent is checked against
`F.hitMarkerOuter * height` two lines later, and the arc's radius against
`F.indicatorRadius` in half-heights, both already fractions.

**The argument, which is the bit worth your eye.** Scaling a tripwire makes it
**looser on a small buffer**, and that is backwards. The purpose of a floor of
twenty is to catch *nothing drawn*; if it scaled it would be ten on a 503-row
buffer and five on a 420-row one, so the smaller the window the less it would
take to satisfy it - the opposite of what you want from a canary. A fixed small
number is the honest statement of "this is not zero".

**The one that is genuinely arguable** is `presentation.js`'s rim at 200px, which
H30 **scaled** rather than leaving absolute. A rim is an edge, so the obvious
alternative was to make it a fraction of the body it rims (`masked`, which the
line already prints). That was considered and refused: the share of a silhouette
its edge occupies *falls* as the body grows, so a fraction of the body would be a
different and harder claim than the one that line has always made. If you would
rather it asserted the edge-to-body ratio, that is a real improvement and a
different check.

**Held by a check rather than a convention.** `every-pixel-floor-under-tests-is-a-
fraction-of-the-buffer-or-says-why-not` scans the source of every check module the
page loaded, fails on any count-against-a-bare-number it does not know, **and
fails if one of these three disappears** - an exemption for something that has
gone is an exemption the next line inherits without arguing, which is F13's rule.
It also exercises its own pattern every run, because a census whose regex rotted
would report zero floors and pass.

decided:

### D64 — A hood cannot be measured inside eight pixels, so below the reference buffer nothing asserts it

**Raised by:** H29, 2026-10-06, and recorded rather than asked because it changes
nothing a player can do. It is here because it **answers the question D63 left
open** - and the answer is not the one H29 set out to find.

**What D63 asked for.** D63 moved the two figure checks onto the resolution
`medium` ships, and recorded the cost: nothing was then asking whether a
genuinely small window keeps a body legible at 25m, and the red it replaced was
the only thing in the suite pointed anywhere near that question. H29 asked it
directly, of the drawing buffer rather than of the quality level, over five sizes
on both maps.

**What came back.** Face-on at 25m, the same body read twice in two runs of one
full suite:

| display | buffer | the Shade | run 1 | run 2 |
|---|---|---|---|---|
| 1920x1080 at `low` | 1344x756 | 43x12 / 42x12 | 10 / 6 = 1.67x | 10 / 6 = 1.67x |
| 1280x720 at `medium`, the reference | 1280x720 | 41x12 / 40x12 | 10 / 6 = 1.67x | 10 / 6 = 1.67x |
| 1366x768 at `low` | 956x538 | 31x8 / 30x8 | 8 / 4 = **2.00x** | 8 / 6 = **1.33x** |
| 1280x720 at `low` | 896x503 | 28x8 | 6 / 4 = **1.50x** | 6 / 6 = **1.00x** |
| 1024x600 at `low` | 746x420 | 24x8 / 23x8 | 6 / 4 = 1.50x | 6 / 4 = 1.50x |

**The two smallest-but-one rows disagree with themselves by a factor of 1.5.**
Eight consecutive runs of the check on its own had agreed to within one pixel of
neck, which is exactly why this is worth writing down: it looked like a stable
measurement for eight runs and was not one.

**Why, and it is not quantisation of one row.** `band()` in `tests/figure.js`
takes the neck as the rows between **14% and 22%** of the silhouette's height. At
25m in these buffers the silhouette is **30 rows tall and 8 pixels wide**, so that
band is *two rows* - and the body's measured height moving by one row (31 to 30,
24 to 23, which is all the two runs differ by) slides those two rows onto
different anatomy. `narrowest()` then returns the shoulders instead of the neck.
The two readings are not a noisy measurement of one thing; they are measurements
of two different things.

**So the honest answer is that the suite cannot answer the question.** A hood
cannot be told from a neck inside **eight pixels of width**, and no
band-by-fraction-of-height decomposition is meaningful on a body that small. That
is a stronger vindication of D63 than D63 claimed for itself: pinning the figure
checks to the shipped resolution was not a dodge around a one-pixel threshold, it
was the only place the instrument works at all.

**Taken.** The new check asserts only what held across both runs on both maps -
the body is **found**, it **covers its share of the buffer** (a fraction of it,
H28), and it **keeps its tall narrow proportions** (3.0:1 or better against a bar
of 2.2, because that is a ratio of the whole silhouette rather than of two bands
two rows tall). The hood and the neck go in the detail line and **nothing asserts
them**. A clause that reports 2.00x and 1.33x for the same body in one suite is
not a clause.

**What is NOT claimed, and this is the part that matters to you.** H29's first
draft of this entry said the hood reads at every size and that there is therefore
no minimum-resolution line to write into the spec. **That was wrong** and is
retracted here rather than quietly fixed: it rested on the run that read 4px
necks. What is true is narrower - at 1366x768 on `low` the Shade at 25m is
**30 pixels tall and 8 wide**, and whether that reads as a hooded figure to a
human eye is not something a pixel count can settle in either direction.

**So it is yours to settle, and it is a small specific ask rather than an open
worry.** It is in `PLAYTEST.md` under *Still needs a human*: open the game at
`?quality=low` in a window about 1366x768, look at a Shade at 25 metres, and say
whether you can tell it from a Warden. If you can, nothing needs doing. If you
cannot, that is a real finding about weak machines and **then** there is a
decision about a minimum resolution - which is why no such line was written on a
guess.

**And it sharpens D63's own open question.** D63 offered you the alternative of
holding `low` to the silhouette instead. H29 is the argument against it: at that
size the clause would be asserting which two rows a band happened to land on.
Note that this is not purely a small-buffer problem - at the **reference** buffer
the neck read 5px and 6px across runs, which is **H31**, and the two figure checks
that shipped assert 1.5x on exactly that number.

decided:

### D63 — A silhouette is read at the shipped resolution, not at the player's

**Raised by:** H28, 2026-10-05, and recorded rather than asked because it
changes nothing a player can do — but it decides what the suite will and will
not notice, and that is yours to overturn.

H24 ran the suite at `low` and `the-warden-and-the-shade-are-told-apart-by-
silhouette-at-25m` went red on **"the Shade's hood 6px is not 1.5x its neck
5px"**. At `low`'s 0.7 resolution scale in the runner's 1280x720 window the
Shade at 25m is **28x8 pixels**, and a hood cannot be told from a neck inside
eight of them: the neck bottoms out at the narrowest row a difference frame
resolves while the hood keeps shrinking, so the ratio collapses on
quantisation rather than on anything about the body.

**Taken:** the two figure checks read their silhouettes at **the resolution
`medium` ships**, whatever level is applied — `createLens(h, { pixelRatio })`,
and `restore()` puts it back. Their numbers are now identical at all three
levels (Shade 40x12, Warden 40x26 at 25m, measured at `low` and at `high`),
which is what a claim about *geometry* should be. Everything those two checks
assert — six parts on one material, tall and narrow, a hood over a neck, a
helmet under shoulders, a rifle out front — is about the shape of a body and
none of it is a claim about a buffer.

**The line worth your eye, because this reads like a dodge.** 896x503 is not
what a player at `low` sees. It is what a player at `low` sees **in a
1280x720 window**. On a 1080p display `low` draws 1344x756, which is *more*
pixels than the reference the checks now read at — so the red was a reading
about the runner's window, not about the level, and a player at low is not
getting the figure the red described.

**What nothing now asks, and that is the cost:** whether a genuinely small
window — a laptop at 1366x768 at `low`, say 956x538 — keeps a body legible at
25m. The old red was the wrong instrument for that question (it could not
tell a small window from a low preset) but it was the only thing pointed
anywhere near it. It is queued as **H29**, which would ask it directly at a
named buffer size and have an answer that means something. If you would
rather the figure checks stayed at the applied resolution and `low` were held
to the silhouette, say so here and H29 becomes the calibration job instead.

decided:

### D62 — The quality level is presentational again, and it took a second rng

**Raised by:** H27, 2026-10-05, and recorded rather than asked because nothing
in it changes what a player can do — it removes something that did.

H24 ran the suite at `low` for the first time and found that **the quality
setting was changing the game.** `effects.sparks()` drew three numbers per
particle from the one seeded `rng` and the preset scales the particle count, so
an impact cost 15 draws at `medium` and 6 at `low`, and every simulation draw
after the first bullet to hit anything came out different. The Warden's next
burst pause was 0.3745 against 0.3492 off the same impact.

Three ways out were on the queue. **Taken: a second stream.** `rng` is the
simulation's, `lookRng` is presentation's, `systems/effects.js` is its only
caller, and `rng.reseed()` seeds both from the match seed so a seed still
reproduces a match exactly. It is a layering rule rather than a patch on one
function: nothing presentational draws from the simulation's stream, so the next
effect somebody writes cannot reintroduce this.

Rejected, and the closer call than it looks: *draw the full unscaled count and
light only some of them.* It keeps one stream, fixes the level dependence, and
would have changed **no existing reading at all** — where splitting the stream
moves every simulation draw at every level and so risked every seed-sensitive
check in the suite. It was the safer option on the day. It was not taken because
it leaves presentation drawing from the simulation's stream, which means the bug
is one careless edit away forever and invisible until somebody runs the suite at
a level nobody runs it at. In the event the risk did not land: 28 of 28
seed-sensitive checks on the plant and 25 of 25 on the yard passed first time,
no threshold touched.

Also rejected: *take the particle scale out of the preset*, which is the only
one of the three that changes what a player gets — `low` would pay for every
spark. If you would rather have that, say so here and it is a small change.

**What this does change for you:** a given seed now produces a different match
than it did before 2026-10-05. It reproduces itself exactly, which is what the
seed was ever for; it just is not the same match the same number produced last
week. No recorded seed exists anywhere that this invalidates.

decided:

### D61 — A menu card does not honour the quality level, and is left that way

**Raised by:** H23, 2026-10-05. H23 held the quality level still for the length
of the strip of cards the main menu bakes, so that a first boot cannot draw one
card at the fallback and its neighbour at whatever `auto` then picked. Building
it turned up something the queue had assumed the other way, and it is a look
question rather than a rule, so the recommendation is taken and here it is.

**A card's picture does not depend on the level at all.** Measured with
`npm run probe` before anything was written: with the renderer demonstrably at
`low` — an 896x503 buffer, a 512 shadow map, 0 of 13 outlines shown, no post
pass — a card came back **byte-identical** to the same card at `medium`, on
both maps. None of the five knobs is in a card. The outlines are hidden by a
traverse of the *live* scene and the shadow map resized on the *live* map's key
light, while a card is a fresh map in a fresh scene with its own 1024 key light,
drawn into a fixed 480x270 render target that no pixel ratio reaches, with no
post and no particles.

So H23's race was real in the **record** and not in the picture, and the hold
is insurance rather than a repair. Three ways to go:

1. **Taken: leave a card level-agnostic, and hold the level anyway.** A card is
   a picture of a place, not a frame of a round — the same argument that turns
   the fog off in a thumbnail scene (D55) — and every friend seeing the same
   strip is worth more than a strip that previews their own machine. The hold
   stays because it is what makes `record.quality` a true sentence, it costs one
   string, and the day a knob *does* reach a card it is already the fix.
2. *Make a card honour the level* — hide the thumbnail map's own outline group
   and size its key light from the preset. Then `low` previews itself: a player
   on a weak laptop sees the game they are about to get. Against it: the card is
   where someone decides which map to play, and deciding that from the dimmest
   version of it is a worse card. That is **H26**, and it is one line here.
3. *Drop the hold and the recorded level.* Rejected: it leaves a real race
   unguarded on the argument that it does not show today, which is the argument
   that let it survive H10.

decided:

### D60 — Quality presets: the post is an AND, and what each level is worth

**Raised by:** H10, 2026-09-29. Low / medium / high / auto over five knobs.
Three things in it are look rather than rule, so they are taken and recorded
here; one is close enough to the line that it is the one worth your eye.

**The post already had a settings row** (E6), so a preset that names
`post: false` has to relate to it somehow. Three ways:

1. *The preset assigns `SETTINGS.post` when a level is chosen.* Rejected: it
   writes a player's stored record from a different row, the post row's label
   goes stale until something re-renders it, and the two then disagree about
   which is in charge. It also means a check that cycles the settings rows and
   puts `SETTINGS` back leaves the renderer wherever the row landed.
2. **Taken: the post is drawn when the row says on AND the level allows it.**
   `low` draws none whatever the row says; the row still remembers what the
   player chose, for when they come back up to medium; and the row says so, as
   `on, off at low quality`. `applyQuality` then writes no setting at all,
   which is what makes it safe to apply on any frame and what makes
   `syncQuality()` a one-string compare rather than a decision.
3. *Drop the post from the preset.* Rejected: it is the most expensive thing in
   the frame, so a `low` that keeps it is not a low.

**The table.** Medium is the shipped picture knob for knob, pinned by
`the-medium-preset-is-what-the-game-drew-before-there-were-presets` to the
constants each number came from, because every reading on record was taken at
it - the 92-viewpoint sweep, the thirteen pixel-reading modules, every
screenshot.

| | shadow map | resolution | particles | outlines | post |
|---|---|---|---|---|---|
| low | 512 | x0.7 | x0.35 | off | off |
| medium | **1024** | **x1** | **x1** | **on** | **on** |
| high | 2048 | x1.25 | x1 | on | on |

**High does nothing on a 2x display**, and the check asserts that rather than
letting the row pretend: the scale multiplies `devicePixelRatio` and
`maxPixelRatio` (1.75) caps the product, so 2 x 1.25 and 2 x 1 both land on
1.75. On a 1x display it is a real 1.25x supersample.

**`auto` is the default**, and it measures once per browser: the probe watches
ten frames it throws away (the first draws of a cold renderer are a shader
compile) and then up to forty, or two seconds of them, and picks from the
median against Section 2's 16.67ms budget - under half of it `high`, within it
`medium`, over it `low`. What it picks is stored (`SETTINGS.qualityAuto`), so a
second visit applies it without measuring again. Until it has answered, and on
a level this build does not have, the game draws `medium`.

**And auto is not as decided as it sounds.** The verify measured the same
machine on both maps: the plant reads **8.70ms median CPU and picks `low`**, the
yard **5.30ms and picks `medium`**, because the plant is the heavier scene and
what the probe measures is machine *times* scene. Since the pick is stored on
the first boot that answers, whichever map a friend opens first decides their
quality for the life of that browser. That is **H25**, and it is a real flaw
rather than a taste question - flagged here because the fix (keep the lowest
level any probe has picked) is the kind of thing worth a glance before it is
built.

**The one worth your eye: `low` turns the outlines off.** Everything else in
that row is pure cost, but the outline is how a body and a ledge separate from
the concrete behind them (Section 4), so a friend on a weak laptop might be
playing a *more readable* game at medium with a 512 shadow map than at low.
Options: leave it as built; or keep the outlines at low and take the
resolution to 0.6 instead, which costs about the same. One line.

decided:

### D59 — Look and camera settings: the FOV range, and a head-bob that ships off
H9 built the four settings the job named — sensitivity per axis, invert Y, a
field of view per role, head-bob on or off. Three judgements were left inside
it, and none of them changes a rule: every one is how the game *looks*, and
every one is a line here to overturn.

**The FOV sliders run 60 to 100 degrees, both defaulting to the engine's 70.**
This is the one of the three a player could gain something from — 100 degrees
sees more of the room than 60 does, on either side of the asymmetry — so it is
flagged rather than buried: narrow `CONFIG.settings.fovMin` / `fovMax` and both
sliders narrow with it. 70 as the default is not a preference, it is the FOV
every measurement on record was taken at, and
`each-role-draws-with-the-field-of-view-its-setting-asks-for` pins the two
defaults to `CONFIG.render.fov` so a check written before H9 that reads that
constant as the camera's resting field still reads the truth.

**Aiming down sights narrows to 52 degrees absolutely, from wherever the
player's FOV was.** It used to be `render.fov` → `adsFov`; it is now
`SETTINGS.fovWarden` → `adsFov`. So a player on 90 gets a bigger zoom than a
player on 60 and both get the same sight picture, which is the way every
shooter does it. The alternative — narrowing by the same *fraction* — would
give a wide-FOV player a permanently wider aim, which is the competitive edge
the range above is already being careful about.

**Head-bob ships off.** It is the option players most often turn off, and off
is also the camera every timing, pixel and feel reading on record was taken
against: on by default would have meant teaching
`the-camera-dips-on-a-climb-and-comes-back` the difference between a stride and
a dip in the same job that invented the stride. Turning it on is one row of the
settings page, and `PLAYTEST.md` asks Josh to. If he wants it on out of the
box, flip `headBob` in `CONFIG.settings.defaults` and that check gains a line
that switches it off before it measures.

The amplitudes are `CONFIG.shade.camera.bob` (0.018m) and the Warden's
(0.035m), at a full sprint, scaled down by speed and zero off the ground. The
Warden's is nearly twice the Shade's because an eye in a head swings only
itself where a boom 2.2m behind the body swings the whole picture. The bob is
**upward only**, in step with the body's own gait — the camera rises as a foot
plants and never goes below its rest height — because down is what a landing
and a climb mean on this camera (B8), and a stride borrowing that vocabulary
would make both harder to read.

**decided:**


### D58 — What a rebind does to the key it replaces, and to a key already taken
H8. Two judgements the controls page had to make, neither of which changes a
rule of the game — every action is rebindable either way, and nothing a
player can *do* moves. Both are one line to overturn.

**A rebind replaces the first key and leaves the alternate.** Six actions
ship with two keys (`forward: W / Up`), and press-to-bind writes slot 0, so
binding forward to T reads `T / Up` and the arrow a player never touched is
still there. The alternative — the pressed key becomes the action's only key
— is tidier to explain and quietly takes something away, and nothing in the
page would say it had. The alternate you *did* replace comes back with the
row's own **reset**, which is why every row has one rather than the page
having a single reset-all.

Escape is the way out of a capture, and so the one code nothing can be bound
to. A page you can walk into and not out of is worse than a pause key nobody
rebinds. A mouse button is bound by pressing it on the cell that is waiting,
which keeps `fire` on Mouse0 reachable by hand.

**A key bound to two actions is shown and never refused.** The game fires
both — `codeToActions` has always been a list — and a player who wants melee
and crouch on one key is entitled to them; there is no rule here to protect.
What the page owes them is knowing, so both rows name the other action. The
alternative, refusing the bind, would mean the page deciding for the player
which of two things they meant, with no way to say.

The part of this that is **not** a judgement, and is now a check: *binding a
key must not also fire it.* The keydown that binds J reaches the Input as
well as the menu, and which of the two window listeners runs first is not
ours to pick, so the Input is gated from the bind to the keyup
(`swallowPress()`). Without it the first J bound jump *and* jumped.

**Not kept across a reload.** A rebind lasts as long as the page, like the
bindings always have; H7's store holds settings, and the keymap is not one of
them. **H19** is the job that changes that, and it is a job rather than a
line here because a keymap is not a scalar: it wants its own record, its own
version, and a rule for a stored map naming an action this build no longer
has.

**decided:**

### D57 — What a browser keeps, and the one thing it does not
H7. Nothing here changes a rule; it changes what the game remembers, which is
a judgement you can overturn in one line.

**Kept**, in `localStorage` under `blackline.settings.v1`: mouse sensitivity,
invert Y, master volume, match length, difficulty, the round briefing,
post-processing, the **role** row and the **last map** (H5), and whether this
browser has been offered the **tutorial** (H6). Those last three are the
reason this job exists — three jobs in a row put a decision in `SETTINGS` and
had to write "until H7".

**Not kept: the debug gate**, and it is the only one. The gate is a property
of a page load and the URL owns it (`?debug=1`, C1); the AUTO suite turns it
on for the length of a run. Persisting it would mean one visit to the settings
page turns a friend's playtest build into a debug build for good, with the
test keys live and nothing on screen to say why. The list is a census
(`NOT_PERSISTED`), held against the defaults by a check in F15's shape, so a
setting added later is kept unless somebody writes down that it is not.

**A store that will not work is not an error.** `localStorage` throws rather
than returning null when site data is blocked, in some private windows and
inside a sandboxed frame. Every access is wrapped and every failure carries a
reason; the game runs on defaults. A game that will not start because it could
not remember a volume slider is a worse game than one that forgets.

**A version it does not know is ignored, not migrated**, and a record edited
by hand can only set a key the defaults have, at the type the defaults have.
What is stored is a handful of preferences: the cost of losing them on a
format change is one trip through the settings page, and the cost of a
migration path nobody exercises is a bug that only ever appears on somebody
else's machine.

**The reset row clears the record** rather than writing the defaults into it,
so a build that later changes a default gives that new default to whoever
asked to be reset.

**decided:**

### D55 — The main menu as built: a card per map, rendered from the map
H5. Nothing here changes a rule — every button does what a button already did
— so it is provisional, and all of it is look you can overrule by opening the
menu.

**The card's picture is the map, rendered at boot.** There are no asset files
in this project (Section 2) and this adds none: each card is a 480x270 PNG
data URL drawn out of the map's own geometry with the live renderer, so a card
cannot go stale against a map that moved and costs nothing on the wire.

**What it cost, and what was refused.** A map is built once per page load and
another map is another page load, so there is no yard in memory while you are
on the plant: a card per map means building every registered map. Baking each
one *whole* is 632ms on the plant and 200 on the yard, which is what the queue
warned would roughly double a boot. Stopping at the slices that put something
in a scene (`DRAWN_SLICES`, three of six) is 145ms and 80 — the three slices
skipped derive rooms, the Warden's ground and validation, and put nothing in
the scene, which `the-drawn-slices-are-every-slice-that-puts-anything-in-the-scene`
pins from both sides. And none of it is on the boot a player waits on:
`thumbnails.start()` is called after `window.BLACKLINE` is published, the menu
draws its cards empty and fills them in the way the footer fills in when the
stamp lands (H3). Total **5.0s headless on this PC, 4.0s of it a SwiftShader
readback that is milliseconds on a real GPU** — H11's bench is what will say
how long a friend actually sees an empty card.

**Two eyes were built and thrown away before this one, and both came back
black.** The first framed the whole site from a corner: the scene's `FogExp2`
is 0.018 in the clear colour, so at the 110m that frames an 81m site the
picture is 96% fog. Fog is off in a card. The second was the same eye with the
fog off, and that one is the maps themselves — they are lit for a dark stealth
interior, and an unlit roof at 100m reads at **luma 1**. So a card carries its
own key and hemisphere on top of the map's rig, which stays, because the
yard's floodlights are what the yard looks like. A third eye, at the Shade's
own spawn looking at the first site, was tried and dropped: **the plant is a
sealed shell and every exterior eye gives it a slab**, and an eye 12m back
from site A is outside the wall looking at it.

So the plant's card is a lit building in a fenced compound and the yard's is
plainly a container yard. That is enough to tell them apart, which is a card's
job, and it is honest about what the plant is. **If you want the plant's
inside on its card, that is the change to ask for** — it needs the roof
hidden for the render, and there is no generic rule for "the roof" that would
not also delete half the yard.

**The rest of the menu.** The title is the largest type on the card and sits
above the strip. The **role row** is new and picks what Play starts: `shade`
is the competitive match, `warden` is free roam — those are the two the game
actually has, and **D56** asks whether a competitive Warden should exist. The
*Free Roam* button stays as the shortcut it has always been and deliberately
does not move the role row. **How to play** and **Credits** are new pages; How
to play reads its objective and its controls from `ui/briefing.js` and the
live bindings, so it and the round-start card are one set of sentences and a
rebind (H8) moves both.

**The map row under the cards is now redundant** — the cards pick a map and
the row cycles to the next one. It was kept because it is what D1 built and
`the-menu-offers-every-map-and-its-map-row-asks-for-the-next-one` drives it;
say the word and it becomes a plain label.

**Every row is reachable from the keyboard**, on all five pages. That is not
decoration: `Tab` is in `SUPPRESSED_KEYS`, so the browser's own focus
traversal is off inside this game and without this there is no keyboard path
into the menu at all. Arrows walk and wrap, left and right change a value or
nudge a slider, **Enter** activates. Enter and not Space, because Space is the
jump key and a menu that swallowed it would still leave it held for the first
step after the menu closes.

**decided:**

### D54 — Easy's aim cone is 4.0 degrees, not 5.0
F17. A fresh seed turned the difficulty check red on the yard: easy at 16m,
119 rounds, 2 hits, the Shade alive after 30s of being shot at in the open.
Reading the shots, it is the cone and nothing else — at 16m the Shade's box
subtends ±1.22 degrees against a ±5 degree draw, the draw is held for a
whole burst of 3–7 rounds, so **one burst in six is on the body and a fight
is a run of coins**. Mean 6.3s, and about one engagement in sixty past 30s;
the check runs 48 of them a run, so roughly one fresh-seed audit in four
should have found this.

**Taken:** `ai.difficulty.easy.aimErrorDegrees` **5.0 → 4.0**, nothing else
touched. Over 40 seeds that is hit fraction 0.148 → 0.232, mean kill at 16m
6.29s → 3.51s, worst 26.05s → 13.8s, and easy is still plainly the slowest
preset at both ranges (16m: 3.88s against medium's 1.40 and hard's 0.93 on
the plant).

This is a number, not a rule — a player can do exactly what they could
before — so it is provisional and one line reverses it. What to weigh if you
want easy easier again: 5.0 is not "easy", it is "the Warden cannot reliably
kill you at range at all", which is a different and worse thing; and the
tail, not the average, is what a player actually meets.

**Two alternatives were measured and rejected, and both are worth knowing
about:**

- **3.5 degrees** shortens the tail further (worst 11.9s) but takes easy's
  kill at 8m to 0.71s against medium's 0.51s. The presets already separate
  by aim only at range (D33); 3.5 spends most of what is left up close.
- **Drawing the hold once per round instead of once per burst** is the
  better idea on paper and was built and then reverted. It kills the tail at
  *unchanged* accuracy — same cone, same hit fraction, same mean, just no
  clustering — which is exactly C5's argument one wavelength down. But once
  a bad round is no longer followed by five more bad ones, **medium and hard
  both saturate at 8m**: 32 of 32 hits, 0.39s each, a dead heat, because the
  body is wider than either cone at that range and the kill becomes four
  rounds at 600rpm. The check caught it. Separating those two up close is
  **K6**, and if K6 finds a way to do it that is not accuracy, the per-round
  draw becomes available again and is probably right.

**decided:**

### D53 — What boot says, and what it refuses
H4 as built. Nothing here changes a rule — a player who can run the game sees
the same game — so it is provisional, and all of it is wording and timing you
can overrule by looking at it.

- **The loading screen is markup, not a module** (`index.html`, `#bl-boot`),
  visible from the first paint. A module that drew it would itself be waiting
  on the network, which is the one moment a loading screen is for.
- **It names the slice, not a percentage**: `geometry · 1 of 6`, then
  collision, the climb rule, rooms, the Warden's ground, checking the map.
  Six, because that is where the bake's time measurably is — declaration is
  112ms on the plant against 762 for the tail (`mapfinish.js`). A bar would
  have to lie about the sizes; a label does not.
- **The bake yields with a `MessageChannel` message.** Not `setTimeout`, which
  Section 9 and 15 ban and F13's gate holds; not `requestAnimationFrame`,
  which never fires in a hidden document, so a boot that waited on one would
  never finish in the Browser pane.
- **No WebGL2 is a fatal panel with no way out**, and it takes the loading
  screen down with it, because "starting" behind a message saying nothing is
  starting is a lie. The test is `createRenderer()` returning null and there
  is deliberately no second one: a separate `getContext('webgl2')` probe
  either clobbers the real canvas's attributes (`getContext` ignores its
  second argument once a context exists) or costs a second SwiftShader
  device, measured at **16 seconds** headless, on every page load.
- **A touch device is told and boots anyway**, behind a *Continue anyway*
  button. The classifier is a coarse pointer *and* no hover, so a touchscreen
  laptop — which plays the game perfectly — is not caught by it.
- The two messages' text is in `NOTICES` (`src/bootscreen.js`) and the checks
  compare against that object, so rewording one is a one-line change and the
  checks follow it.

The thing only eyes can settle: whether the loading screen reads as
deliberate or as a flicker on a real GPU, and whether either message says the
right thing to somebody who just wanted to play.
**decided:**

### D52 — The build stamp with no workflow to write it
H3 asked for `version.json` to be written "by the deploy workflow (commit,
date) and by `npm run suite` locally as `dev`". H2 found there is no workflow
and cannot be one from this machine: the CLI token has `repo` and not
`workflow` scope, so Pages is a **branch deploy** of `phases-14-45` and the
only thing that reaches the deployed root is a commit. So both halves were
built differently, and this records it rather than quietly doing something
else:

- **The commit carries the stamp.** `scripts/version.mjs` (`npm run stamp`)
  writes `version.json` from git — commit, short, the committer date, branch —
  and **refuses to write while the working tree is dirty**. That is what makes
  it safe to call at the top of `npm run suite`, which it now is: a gate stamps
  HEAD, and a verify in the middle of a job leaves the file alone rather than
  dirtying the tree it is judging. The stamp for a job's *own* commit comes
  from `npm run stamp` in the `Record <job>` commit, exactly the way that
  commit already writes the job's hash into QUEUE.md. Between the two, the
  deployed stamp names the commit before the work — stated, and the reason the
  checks assert the stamp is *well formed* and never that it is HEAD, which a
  page cannot know anyway.
- **"dev" is the host's answer, not a field.** A `channel` baked in at stamp
  time is whatever the last person to stamp happened to have, and would say
  `build` on a local server serving the same bytes. So `src/version.js` decides
  from `location.hostname`: localhost, `127.0.0.1`, `file://`, a `.localhost`
  or `.test` name are a working copy and the footer opens with `dev`; anywhere
  else is the deploy. Locally the footer reads `dev · 97354db · 2026-09-27`,
  on Pages `97354db · 2026-09-27`, and with no stamp `build unknown`.
- **A missing stamp is loud.** The fetch of an absent `version.json` is a
  browser console error, which the runner counts — the same reason index.html
  carries an empty favicon (H2). Better than a quiet "unknown" in a corner.

Alternative not taken: ask Josh for a browser login so the token gains
`workflow` scope and an Actions deploy can write the file at deploy time. It
is one click and would make the stamp exact rather than one commit behind, but
it is a change to what the deploy *is* — H2 already moved it to a branch
deploy — and nothing here needs it. Say the word and H3's script becomes four
lines of a workflow.
**decided:**

### D46 — Post-processing as built: a bloom on the emissives, a vignette, a switch
E6 (2026-09-21), on D10's recommendation now that E1-E3 have landed: a
vignette and a light bloom on the emissives only, if the frame budget
allows. The numbers to argue:

- **Four passes, one file** (`src/post.js`): the scene into a
  full-size half-float multisampled target, a bright pass at half size
  keeping what is over 0.5 of linear luma (the route-lit stages and the
  lamp fixtures read 0.75-0.8, a floor under a lamp 0.13 - so the
  emissives and a flash bloom and a lit floor does not), two separable
  Gaussian blurs at half size, and a composite that adds the blur back
  at 0.8 and multiplies by an elliptical vignette falling from nothing
  at 0.55 of the half-diagonal to 0.3 off at 1.25. Then the feedback
  quad (C3) over the top on its own layer, so a white hit marker is not
  a bloom. three's EffectComposer is in the addons bundle the import map
  does not fetch; this is the sliver of it the game needs.
- **A body is not an emissive.** The first full verify was red on the
  two silhouette checks (E1, E2) on both maps: they stand the figure in
  flat white to read its shape, and the bloom grew the white a halo ten
  pixels wide - a 30px neck at 25m read 50. The Shade's rim at full
  meter is brighter than any lamp and would have done the same in
  play. So the bright pass reads the scene target's alpha as its mask:
  an opaque material writes 1, a body writes 0 (`NO_BLOOM`, a line
  after `opaque_fragment` on the Shade's rim material, the Warden's
  body and the checks' flat stand-in; `withoutBloom` in agentmesh.js),
  and the mask is a step at 0.999 rather than a multiply, because the
  multisample resolve leaves a body's edge pixels half covered and
  half bright. The canvas has no alpha channel, so with the post off
  the alpha changes nothing.
- **Half floats, because the game is dark.** The first targets were
  8-bit and linear; a floor at sRGB 8 is linear 0.002, which rounds to
  1/255 and comes back as 13 - every dark tone banded to grey. Half
  floats carry the darks.
- **"If the frame budget allows" is a GPU question**, and this machine
  renders the suite in software; `the-frame-budget-holds-everywhere`
  runs in a real browser (F4 then Y) with the post on, and answers it
  there. So the post is a settings row - *post-processing*, on by
  default - and off is the scene as drawn, one pass, no targets
  touched. If the budget fails on Josh's GPU, off is the answer and the
  default is one line.
- **What ships is what is read.** pixels.js's lens renders through the
  pipeline when it is on, so every pixel check reads the bloom and the
  vignette. What moved: the routes' landing edges read 158-182 luma
  against 224-227 (the emissive is spread by the blur, not clipped by
  it) and their contrasts 0.75-0.78 from 0.79-0.83; a lamp's halo takes
  a ceiling read under it from 101 to 105; the pools, the mouths and
  the rim to the digit or a level. And the site tint (C7, D44) darkened
  more for the same strength - the multiply is in linear light now, the
  physically right one, 12% on the vault's floor at 0.28 - so
  `siteTintStrength` went to 0.13: R/B up 1.09-1.13x, luma down 5-8%.
  D44's numbers are superseded by these; its choices stand.
- **The bloom is a glow, not a flare.** At 0.8 the ring ten pixels
  round a lamp fixture goes from 22 to 78 luma on the plant, 35 to 112
  on the yard; the lamps read as lamps in a frame (the probe's PNGs),
  the route strips glow a little, nothing else does. 1.5 flares; 0.4
  is barely there.

Override in `CONFIG.render.post`, or turn it off in the settings menu;
`post-processing-blooms-the-emissives-darkens-the-corners-and-is-a-
switch` (tests/post.js) holds whatever is there to a halo, darker
corners, an untouched centre, an unbloomed hit marker, the passes and
the switch.
**decided:**

### D45 — The yard's materials as built: corrugated containers, wet ground, rust, a box number
E5 (2026-09-21). The container yard on E4's kit, with its own set
(`CONFIG.map.yardFinishes`). The numbers to argue:

- **Every container is one finish, `corrugated`**, whatever tier colour
  it is (gunmetal, concrete, orange): a glossy ramp like paint's with a
  little more body in the flat, and a grime with `ridges` - a cosine
  profile across the tile, nine to 2.4m (a 27cm pitch), the troughs 22%
  darker - under fine vertical streaks and a broad stain. The
  world-projected UVs put u along every standing face, so the ridges
  are vertical on every box and continue across a row. The alternative
  was a ridge in the geometry (a box per corrugation); the grime is one
  texture and no draw calls.
- **The ground and the fence are `wet`**: a concrete lower in its
  mid-tones (0.45/0.6/0.7 against 0.55/0.7/0.8) with the full face kept,
  the sheen of wet asphalt under a floodlight, and a grime of broad
  puddles (an 8m tile, a stain that takes a fifth). The yard's light
  checks read the ground's pools against its gaps and the sky, so
  `wet` moves them together: the pools read 21.1/17.9/14.5 (24.7/22.6/19.4 before), the gaps 2.8/4.1/2.3 (3.0/4.9/3.0), the sky alone 5.8/2.3/5.0 - every relation the check holds (a gap under half the dimmest pool, the sky under a third of the brightest, nothing under 1) holds, and the site meter reads 57.9/58.2/41.8 as before, being the model's, not the pixels'.
- **Rust is a decal, not a finish.** Rust that pools at the ground is a
  fact about world height, and a tiling grime does not know where the
  ground is; a `rust` tile in the atlas (a band up from the tile's
  bottom, its top broken, pitted) laid at the foot of six rows does.
  Toon-lit paint on the paint ramp, so it shadows and dims with the
  night like everything else.
- **One box number.** A `stencil` tile: "BLKU 2607 1" in a 3x5 bitmap
  font drawn in code, worn through by noise, on four boxes at eye
  height. One number on four boxes is a yard that reuses a stencil;
  the alternative, a tile per number, is four tiles of a 4x2 atlas for
  a detail seen from 3m. The atlas went from 2x2 to 4x2 for the two new
  kinds; the plant's four tiles are where they were.
- **Where the marks are** (`src/maps/yarddecals.js`, seventeen): rust on
  the ring's north row west of bay A's stack, both lane rows on their
  bay side, the ring's east row across from the trailer, bay C's west
  row facing in, the ring's south row west of bay C; stencils on the
  lane rows, the ring's north row east of the arch, bay C's east row;
  tracks through both gates and a kerb inside the south one; oil under
  the trailer, in the west store and under the walkway's south edge; a
  drip down bay A's south row under its mast. Every container face on
  the yard is a climb (the tops are one deck), so Section 5's clause is
  kept the other way round: nothing on the first stage of a declared
  route or the ground at its foot, nothing within reach of a site's
  centre or the spots the light checks read.
- **The walkway is corrugated too** - its slab and parapet are
  `concrete`, which the yard's set maps to the container finish. A steel
  walkway in the same sheet as the boxes; the panes are glass, the
  masts and the rails paint.

Override in `CONFIG.map.yardFinishes` and `src/maps/yarddecals.js`;
`the-yard-is-corrugated-wet-and-numbered` and `the-yard-wears-its-
decals-on-its-faces-in-two-draw-calls` (tests/yardmaterials.js) hold
whatever is there.
**decided:**

### D44 — The site marking as built: a floor tint at 0.28, and the HUD line above the prompt
C7 (2026-09-21), on D8's answer: the ring went, the room's floor is
tinted slightly orange, and the HUD names the site. The numbers to
argue:

- **The tint is a multiply, not a paint.** `bakeSiteTints`
  (mapdecals.js) lays one quad per floor plate inside the site's room,
  a centimetre proud, in one mesh for every site, drawn as the grime
  decals are: the floor's own colour times white pulled toward hazard
  orange by `map.marking.siteTintStrength`. A painted (unlit) quad at
  any opacity would have lit the vault's floor by itself - a constant
  ten luma on a floor at ten - and `lit-pools` would have found a pool
  where there is no lamp; a multiply is as dark as the floor it is on.
- **0.28.** Measured on both maps: red over blue up by 1.14-1.17x on
  every site floor, luma down 7-9% (site A 24.5 to 22.7, the vault 10.2
  to 9.4; the yard's bays 26.9 to 24.7, 24.5 to 22.6, 21.0 to 19.4).
  0.35 read 1.21x and 9.2-9.8% darker, at the done-when's tenth; 0.28
  is the strength with margin under it. The check holds 1.08x and a
  tenth. Every relation the light checks hold is unchanged: the pools
  over ambient, the hall 2.42x the vault, the mouths and the routes to
  the digit but one landing edge's surround (26 to 25, contrast 0.62
  from 0.61).
- **Faint is the choice.** At 0.28 the tint is a warmth, not a colour:
  the floor reads concrete that is a shade orange, which is what "tinted
  slightly" asked for. If it does not read as the site from the
  doorway, the number to turn is `siteTintStrength` - 0.5 reads as
  paint - and the check's tenth ceiling goes with it.
- **The tint follows the plates, not the rectangle.** The vault's floor
  is nine quads, one per deck plate around the hatch, so the hatch is a
  hole and not a tinted plane hanging over the hall. A room whose floor
  is one slab is one quad.
- **The HUD line** is `#bl-site`, "SITE A - Turbine Hall", in the
  prompt's panel above the plant prompt at the bottom third of the
  screen, hazard orange, small, for either role while `siteNear`
  returns a site - the Warden's own position for the Warden, and the
  Warden never sees the plant prompt (it used to, for the Shade's
  position). The names are the briefing's (C2). An alternative was the
  top panel beside the timer; the prompt's place was chosen because
  the line answers the question the prompt asks.
- **The ring's readers** kept their spot: the floor checks sample 3.5m
  off the site centre (`SITE_SAMPLE_OFFSET`, tests/pixels.js), which was
  the ring's outer radius and a margin, so every reading before and
  after C7 is of the same square metre.
- **The damage vignette deepened with it.** `the-vignette-deepens-with-
  lost-health` (C3, D31) measures the vignette's darkening over site A's
  frame and wants 8 luma at half health; it read -9.0 before C7 and -7.6
  after, the floor a shade darker and the bright ring gone from the
  band - a red vignette over a floor darker than the red reddens without
  darkening. The check is D31's number for that backdrop and was not
  moved; the vignette was: `feedback.vignetteColor` 0x6e100c to
  0x580d0a, a deeper red, reads -11.8 at half health and -21.2 at low.
  Slightly stronger damage feedback than D31 built; the same shape.

Override by changing `siteTintStrength` or the line's place in hud.js;
`the-site-floor-is-tinted-warm-and-the-ring-is-gone` and
`the-hud-names-the-site-you-stand-in` (tests/sitetint.js) hold whatever
is there to a warmth step, a darkening ceiling and the DOM.
**decided:**

### D43 — The plant's materials as built: three finishes, a grime, twenty decals
E4 (2026-09-21). What the substation is made of, now that the bodies
are figures (D40-D42) and Block E has reached the map. The numbers to
turn are `CONFIG.map.finishes` and `CONFIG.map.decals` in
`src/config.js`, the places in `src/maps/plantdecals.js`. Nothing the
player can do changed; no collision box, rule or light moved, and the
yard is untouched until E5.

- **Three finishes by colour, not by box.** Concrete is the structure
  (walls, floors, the deck, the ground, the roof), paint is everything
  metal (crates, ducts, gantries, racks, housings, shutters), glass is
  glass; a colour that is not named is concrete. Alternative: a finish
  per solid, declared in the layout - more control, and one more thing
  for a box to get wrong; the colour already says what a thing is (B6).
- **A toon ramp per finish.** Concrete matte: eight gentle steps, no
  hard edge, the face square to a lamp as bright as before and the
  grazing faces a little darker. Paint glossy: three hard bands -
  shadow, a flat body at 0.45, and the full face from a quarter on. The
  actors keep the 4-step ramp. The pixel checks that read a crate or a
  duct against concrete are the ceiling on concrete's mid-tones and the
  floor on paint's: the first ramps put B6's thinnest mouth at 0.25
  against 0.25. Alternative: one ramp with more steps for everything -
  softer, and no difference between a wall and a crate, which is the
  point of the job.
- **Grime, generated, world-projected.** A tiling noise texture per
  finish, no image (Section 2), multiplied into the colour: concrete
  blotched with the odd larger stain (6m a tile), paint streaked with
  fine scratches (3m), glass smudged (2m); projected in world metres
  so a crate and its slab share one grain. It only darkens - a seventh
  off a lit floor at these numbers (site A 28.5 to 24.5 luma), a fifth
  at the first ones - and every relation the checks hold is unchanged
  or better. Alternative: no grime, the finishes by ramp alone; or a
  grime that lightens as well as darkens (a texel over 1 needs a float
  texture, or a base colour lowered to make room, which changes the
  palette D26 argues).
- **Twenty decals, dressing only.** Wheel tracks and a painted kerb at
  each roller door, leaks on the floors, drips down the walls from the
  roof line and the deck's underside. Nothing on or near a climb, a
  duct mouth or a site ring; Section 5 amended holds. Two draw calls
  for the lot. Alternative: none (the grime alone), or stencilled
  letters at the sites (a font, or a bitmap one drawn by hand - not
  today).
Josh: the numbers say every material is on its finish's ramp and
grime, the grime is on screen under a lamp (concrete varies by 4 luma
and darkens by 8, paint 2 and 6.5), every decal sits on a face, a stain
darkens the floor under it, a kerb is drawn, and every pixel check that
was green reads within a hundredth of where it was or better
(`the-plant-is-dressed-in-three-finishes-and-the-grime-is-on-the-wall`,
`the-plant-wears-its-decals-on-its-faces-in-two-draw-calls`); whether
concrete reads as concrete and paint as paint, whether the blotches
tile visibly along the 60m shell, whether a leak reads as a leak, and
whether the whole is darker than you want, is yours - PLAYTEST.md says
where to look.
**decided:**

### D42 — The animation as built: a pose for every state, a stride for every step, the rifle raised to the aim
E3 (2026-09-20). What the bodies do now that they are figures (D40, D41),
and the numbers to turn: the Shade's in `POSE` at the top of
`src/entities/agentvisual.js`, the Warden's in `POSE` at the top of
`src/entities/enforcer.js`, the blend in `src/entities/pose.js`. Nothing
the player can do changed; every state, timer and capsule is as it was,
and the frame reads them.

- **The legs swing by the ground covered, not by the clock.** Half a
  cycle per stride of the band's footstep (`footstepStride`, the crouch's
  and the sprint's), so a foot plants about when the step sounds and a
  body that stops stops mid-stride and eases to rest; the amplitude is by
  speed (0.57 rad at a walk, 0.85 at a sprint), the arms swing the other
  way by three quarters of it, the torso leans into the speed and bobs
  twice a cycle. Before, the phase ran on the clock at a rate by speed,
  so the feet slid. Alternative: the old clock, or the footstep sound's
  own residual so the two are in phase to the frame - not worth a field
  the simulation would have to expose.
- **A pose for every state, eased.** Standing (the breath), the crouch
  (leant forward, the thighs bent under the squash, the hands ahead), the
  slide (leant back, the legs out, one hand trailing), the air rising (a
  stride held, the arms trailing) and falling (the legs together, the
  arms out to the sides, by the fall speed), the reach (a press that has
  armed a climb with a face under the hands puts both arms up and forward
  for it), the vault (the hands planted ahead and down through the first
  half, pushing off behind by the end, the legs tucked over the top), the
  mantle (the hands over the lip above the head pressing down as the body
  comes up, the right knee over), the grab and the hang (B8's full
  stretch, unchanged), the pull-up (the hands stay on the lip and come
  over the FRONT of the body from straight up to ahead and down, the legs
  kicking - the ease follows a target that walks the long way round), the
  landing (a squat with the arms out, by the weight, for as long as the
  recovery holds the speed down). Each is a target the frame fills in
  place and every group is carried toward over `POSE_BLEND` 0.2s (nine
  tenths in a third of it), so a state change is a movement, not a
  replacement. Alternative: the snap the old poses had; or a longer blend
  (0.4s reads as underwater on a 0.28s vault).
- **The Warden raises the rifle to where it looks.** With the sights up
  (`adsBlend`, the same value the FOV and the speed read) both arms rise
  by the rifle's own carry pitch, so the barrel is level, and then by the
  aim's pitch within a radian of level, so the rifle points where the
  Warden looks; the swing leaves the arms; the head takes the whole pitch
  and drops a little to the sight. At the carry the head takes 0.3 of it
  as before. The Warden's gait is by the ground covered too, with the
  roll it had, a bob and a lean into a sprint; the stun drops the arms
  as before and now sags the body and the head. Alternative: the rifle
  to the shoulder (a second arm rest under the pauldron) - the arms
  cannot bend, and a straight arm at the shoulder points the rifle past
  the cheek, not along it.
Josh: the numbers say every state is drawn at least a quarter radian
from standing and from every other, the leg crosses the vertical once a
stride, and the sights lift the right hand 0.15m
(`the-shade-has-a-pose-for-every-state-and-a-stride-for-every-step`,
`the-warden-walks-heavy-and-raises-the-rifle-to-where-it-looks`); whether
a vault reads as a vault or a flail, and whether the Warden's raised
rifle reads as aiming at you, is yours - PLAYTEST.md says where to look.
**decided:**

### D41 — The Warden's figure as built: a helmet on the shoulders, a vest, a rifle at the low ready, a broad stance
E2 (2026-09-20). D3 stands (the Shade and the Warden first); this is what
the Warden came out as, and the numbers to turn, all in `WARDEN_FIGURE`
(`src/entities/wardenmesh.js`). Nothing the player can do changed; the
capsule the game simulates, the eye the rifle fires from and the AI are
untouched.

- **A domed helmet with a brim and a visor, sat on the shoulders.** The
  skull is a box under it and shows nowhere: the chest's top is a hand
  under the brim and a collar fills the gap, so the silhouette never
  steps in under the helmet - the Shade's hood over a neck in reverse,
  which is what the check reads (helmet 10 pixels over shoulders 26 at
  25m; the Shade's hood 10 over 6). The shoulder line is set so that at
  25m the top seventh of the figure is helmet and nothing else.
  Alternative: the old box head on a bare chest - a neck shows, and at
  25m the two tops read the same.
- **A vest over the orange chest**: gunmetal plates proud of its front
  and back, a belt of hips under it over the tops of the legs, so the
  body is one block from shoulder to thigh (the old figure had 25cm of
  nothing between the chest and the legs). Heavy pauldrons tilted down
  at the outer edge are the widest row: 1.2m, 26 pixels at 25m against
  the Shade's 12.
- **The rifle at the low ready, in the right hand.** Both arms forward
  and pulled in to the centreline, the hands together at the grip in
  front of the belly, the rifle pointing ahead and 20 degrees down; the
  elbows cannot bend, so the stock is short and the hands are close. It
  is a piece of the right arm's merged part, built in that arm's frame
  from the rest pose, so it goes where the right hand goes: the stun
  drops it, and E3's aim pose raises it by rotating the arm. From the
  side it reaches 0.8m past the helmet (41% of the height; the check
  wants 25%), and the Shade reaches nothing (-3%). Alternative: port
  arms across the chest with the muzzle over the left shoulder - it
  reads from the front but not the side, and the side is where a Shade
  watches a patrol from. A rifle in the torso's part would hold still
  in the hands but could never be raised.
- **The arms were behind the back.** The old carry set `rotation.x` to
  -1.15 "forward holding the weapon"; on this rig positive x is forward
  (the Shade's hang at -3.05 is straight up and a shade behind), so the
  Warden has patrolled with both arms held out behind it since it was
  first drawn (the makeRotationX matrix says so; nothing read it).
  The rest pose is `WARDEN_FIGURE.arm.rest`, read by enforcer.js, and
  the walk swings the arms a little about it.
- **A broad stance**: short legs set at 0.22 and splayed a tenth of a
  radian so the boots stand at 0.30, wider than the hips; 0.22 wide.
- **Six merged parts on one material**, as the Shade (D40): twelve draw
  calls where there were sixteen, two toon materials become one with
  vertex colours, and `parts.js` is the one place a part is built. The
  hull is grown 6mm, thicker than the Shade's 4mm: no rim shares the
  edge on the Warden. One palette entry added, `wardenSteel` (0x1b1e21),
  for the rifle and the visor: gunmetal on gunmetal lost the weapon
  against the vest.
Josh: the pixels say broad, flat-topped and carrying at 25m as a flat
shape (`the-warden-and-the-shade-are-told-apart-by-silhouette-at-25m`);
whether it reads as the Warden - a guard, not a barrel with a gun - is
yours, and PLAYTEST.md says where to look.
**decided:**

### D40 — The Shade's figure as built: a hood, a cowl, thin limbs, six merged parts
E1 (2026-09-19). D3 stands (the Shade and the Warden first); this is what
the Shade came out as, and the numbers to turn, all in `FIGURE`
(`src/entities/agentmesh.js`). Nothing the player can do changed; the
capsule the game simulates is untouched.

- **A hood, open at the face, and a short cowl over the shoulders**, both
  the torso's teal and one piece with it, so the hood turns with the
  body and the head turns inside it; a charcoal lining inside the hood so
  the opening shows a dark hood and not the room behind the head. The
  torso capsule narrowed from 0.19 to 0.14 and its top is the neck, just
  under the hood's rim: the silhouette steps in there, which is what
  reads as a hooded head at 25m (10 pixels over 6). Alternative: a hood
  that runs into the shoulders with no step, a cloaked shape - the
  figure reads bulkier and the head is lost at distance.
- **Thin long limbs**: the arms 0.05 and the legs 0.06 in radius (were
  0.058 and 0.068; 0.045 and 0.055 first, and the rim check below said
  why not), the same length and the same pivots, the oversized gloves
  and boots kept. The hanging glove lands on the lip as before
  (`a-hang-is-at-full-stretch-under-the-lip`, tests/hang.js).
- **Six merged parts on one material.** Each limb group holds one merged
  geometry with its colours in a vertex attribute, on one toon material
  that carries the rim, plus one hull on one outline material: twelve
  draw calls where there were twenty. Not a skinned mesh, which would be
  two: Section 4 forbids a rigged skeleton, and the six groups are what
  agentvisual.js poses. The queue's "merged geometry, one material" is
  read that way.
- **The hull is grown 4mm** on every side of every primitive about its
  own centre, before placement, instead of scaled 1.03 about a part's
  pivot (Section 4's words, written for a mesh per primitive): a shade
  under the old torso's edge and a visible one on a 5cm arm. The hull
  and the fresnel rim share the silhouette's outer pixels, and on a thin
  limb the hull takes them: at 1cm `the-rim-light-is-really-on-screen`
  read a wash, at 5mm on 4.5cm arms it read 1.5x one run and 1.6x the
  next against a 1.5x line (the idle pose moves between runs), and at
  4mm on 5cm arms it reads 2.0-2.1x. Thinner arms want a thinner hull
  than a pixel at 3m can draw.
Josh: the pixels say tall, narrow and hooded at 8m and 25m
(`the-shade-reads-as-a-hooded-figure-at-8m-and-25m`); whether it reads
as the Shade is yours - PLAYTEST.md says where to look.
**decided:**

### D39 — The yard's lighting as built: masts, one warm key from bay C, a dark sky
D4 (2026-09-18). D9 stands (night, floodlit from masts, pools of dark
between stacks); this is what it came out as, and the numbers to turn,
all in `src/maps/yarddata.js`:

- **Four masts and a fifth lamp.** A mast is a pole 0.3m square on the
  ground against a wall or in a corner off every lane, an arm from its
  top, the lamp at the arm's end 6.5m up (`MASTS`, `MAST`): bay A's
  against its south row with the arm out over the site, bay B's the
  mirror, bay C's against its east wall, the gate's in the open ground
  west of the lane north of the stair's foot with the arm over the lane.
  The fifth lamp hangs under the walkway's floor over the mid lane: the
  Warden's post lights the crossroads it looks down on. Five is the
  yard's count (`EXPECTS.lights`); Section 5's twelve are the plant's.
  Alternative: masts at the ring's corners like a real yard - 14m from
  the sites, past where a lamp lands a pool or the meter counts it.
- **The lamps are 2.5x the plant's pendants** (`MAST.lift`; bay C's is
  half that, the dimmest as the plant's is). A head at 6.5m over the
  yard's dark concrete needs it: at the plant's 26 candela the pool
  read 6.6 of luma against a day sky of 21. Now the lamps add 19 / 22 /
  13 at A / B / C over a sky of 8 / 3 / 8. The meter under a mast reads
  in the fifties; under the plant's hall it reads over 70 from five
  lamps. D5 tunes the AI to what the yard's lamps land.
- **The sky lands a third of the day's, a seventh in a shadow.** Hemisphere 0.2 (was 0.55), the
  fill 0.14 from straight overhead in the lamps' cool (`P.lightCool`;
  the plant's fill colour, `ambientSky`, is too dark a blue to land
  anything at any intensity - the shadows read at luma 0.07 with it),
  the key 0.3 (was 1.15). A shadow reads at luma 3, a key-lit floor at
  8. Alternative: a brighter fill, which makes the shadows a shade and
  costs the pools their contrast - the check line is that the sky alone
  lands under a third of the brightest pool (0.30 today).
- **The one shadowed key is bay C's floodlight.** "Pick the mast that
  covers the most": counted as Warden-ground cells inside the ring within
  the lamp's range of its head, bay C's mast covers 2274 to bay B's
  1906, A's 1731, the gate's 1544 (`the-yard-is-floodlit-from-masts-at-
  night` holds the name to the count). So the key is warm (`lightWarm`),
  aimed from that head at the yard's centre, 28 degrees up: every stack's
  shadow falls north-west, 5.5m for a one-high; bay B's site floor is in
  its south row's shadow (sky 3), A's and C's are key-lit (sky 8), and
  C stays the darkest by its lamp. Alternative: the gate's mast, from the
  north, which shadows bays B and C and lights the gate lane down its
  length - a different look, not a different rule. `KEY_MAST` is the
  name to change.
- **`addLightRig(rig)` takes the map's numbers** over `CONFIG.map.
  lighting`'s (the plant passes none) and `aimKeyLight(direction, at)`
  points the key; the rule that exactly one light casts stays in the kit.
**decided:**

### D37 — The walkway as built: where it is, what a slot is, what stops a knife
D3 (2026-09-18). D11 and D12 stand; this is what they came out as, and one
number that moved:

- **Where.** A glazed run 7.2m up over the mid lane's north edge (x -6..6,
  z -3.4..-1.0), reached by one flight of 24 treads up the west side of the
  gate lane beside bay A's lane row. The end faces look down the mid lane
  into the bays' open corners; the south face over bay C's gap. From the
  middle of the run the Warden sees all three sites through the glass.
  Alternative: over the gate lane, north-south - it covers the Warden's
  own approach and neither bay.
- **A slot is 0.4m wide and 0.95m tall, not 0.4m square.** D11 says "about
  0.4m". The Warden's eye is 1.755m over the floor and its body cannot get
  closer than 0.57m to a pane; a 0.4m square slot at eye height lets it aim
  at most 19° down, and site A's floor is 33° down from the west slot. The slot
  runs from the parapet's top (1.0m) to 1.95m, so it aims down to 53° and
  up to 19°, and sideways as far as the Warden steps off the slot's axis.
  Make it square in `WALKWAY.aperture` and the west slot no longer reaches
  site A (the check says so).
- **The door is the stair's mouth**, 2m wide in the north face, glass over
  it from 2.1m. It is the fourth opening and the check counts it: a Warden
  standing in it covers the stair and the gate lane north, and no bay.
- **A knife stops where a body does.** The knife had no world test at all -
  it was distance and arc - which nothing noticed while every wall was
  thicker than its reach. A pane is a hand's width. The swing now asks for
  open air from the Shade's torso to the Warden's, of every solid box, the
  same line a round is occluded on; glass stops it and a slot does not.
  `a-knife-stops-at-a-wall-a-body-cannot-pass` runs on every map.
- **The parapet is a metre and both stair rails are real.** Without the
  west rail the Warden's ground stepped off the ninth tread onto the lane
  row's top and walked the whole container deck from there.
**decided:**

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

### D56 — Should the Warden be playable competitively?
H5 put a role row on the main menu and found there are only two things the
game can do with it: the Shade in a competitive round, and the Warden in free
roam. There is no third, because **the AI is a Warden AI** — there is no Shade
AI to play a competitive Warden against, and `matchstate.js`'s `FREEROAM` is
`role: 'warden', ai: false, objective: false` for exactly that reason.

So the row as built is honest about the game and slightly odd to read: you
pick "warden" and Play gives you a map with nobody in it.

The options, in the order they cost:

1. **Leave it.** The row says what each role gets (`free roam - no opponent,
   no clock`) and nothing pretends otherwise. Costs nothing; a friend who
   picks Warden gets a walk around the level, which is a real thing to want.
2. **Take the Warden off the row** and leave free roam as its own button.
   Simpler, and gives up the one line that tells a new player the game has two
   sides at all.
3. **Build a Shade AI** and make the Warden a real side to play. That is a
   block, not a job: it needs an attacker that routes to a site, climbs the
   way the rule allows, plants, and then hides — most of Block K again, from
   the other end, and against the census rather than the Warden's ground.
4. **A competitive Warden against a scripted Shade** — a recorded run (H13's
   replays) played back as the opponent. Much cheaper than 3, deterministic,
   and it is the same round every time, which is either a tutorial or a
   disappointment depending on how it is framed.

**Recommendation: 1 for now, and 3 as a block after K if you want it.** This
changes what a player can *do*, so it is yours; nothing is blocked on it,
because the menu as built already offers both of the things that exist.

**decided:**

### D8 — Does the site ring still read, now the plant is the whole room?
The ring still looks like "plant here" while meaning "this room". Options:
keep it as a room marker; shrink it to a floor decal at the room centre;
tint the room's floor instead. Recommendation: look at it in play before
deciding. Nothing is blocked on this yet.
**decided:** tint the floor slightly orange instead, and the HUD should name the site (A / B / C) so the player knows which one they are in. Josh, 2026-09-21. (Queued as C7.)

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
**decided:** yes - the routine may move a site or a spawn, or merge two rooms, when a route needs it; it writes what it moved and why in PROGRESS.md and the decision entry. Josh, 2026-09-21.

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
**decided:** "that's fine going forward" - option 1, as built; the duct roofs are routes. Josh, 2026-09-21. (B5b dropped.)

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
**decided:** no. Josh, 2026-09-21. (Option 2, a clear line; B5d unblocked.)

### D38 — May the Shade walk up the Warden's stairs into the booth?
D3 built the walkway D12 asked for: nothing climbs to it, by the rule, and the
check proves it. But the Warden reaches it by a staircase, and a staircase is
walked - there is no rule in the game that lets one body up a stair and not
the other (the plant's two flights are walked by both). So the Shade can walk
up the same 24 treads, through the door, and stand in the booth: the one way
onto the walkway is open to both. D12's reason - "a Shade on the walkway
closes the gaps for free" - is about the Shade using it as a vantage, and
that is exactly what the stair allows. Nothing was built to stop it, because
anything that would is a new rule.

Options:
1. **As built.** The stair is the one way up, 9.6m long, railed, in the open
   gate lane, and the booth is a dead end: a Shade that climbs it is out of
   the bays, audible on every tread, and cornered if the Warden follows. A
   Warden camping the booth can be flushed by a Shade that climbs the stair,
   which is a fair answer to camping.
2. **A Warden-only door** at the stair's mouth (or its foot): a volume the
   Warden's body passes and the Shade's does not - the first role-gated
   collision in the game. One flag on a box, one line in the solver's
   filter, one check. It makes the booth the Warden's alone and makes a
   camped booth unanswerable except by planting somewhere it cannot see.
3. **A Warden-only door with a cost**: the Shade may open it (the interact
   key, a few seconds, a noise event), so the booth is enterable but never
   silently. More rule than 2.

Recommendation: 1, and play it before deciding - it is the option that adds
no rule, and D4 says Josh tests what the routine cannot. If 2 or 3, a
follow-up job (D3b in `QUEUE.md`) is sized S and blocked here.
**decided:** yes - the Shade can walk up the stairs, and can do anything a human should easily be able to do. Josh, 2026-09-21. (Option 1; D3b dropped. The second half is a design rule for every future question of this shape: no role-gated geometry where a person would simply walk, climb or step.)

### D47 — What is `HANDOFF.md`'s traps section worth, in lines?
G1 got the file from 1,846 lines to 533 and could not reach the under-400
its own done-when asks for. The arithmetic, with every kept section already
written as tightly as it can be stated: everything *except* Environment
traps is **345 lines** — the index the done-when itself requires (50),
Running it (69), the plant rule (39), the census (35), the redesign's
interview table (29), F3's split (26), the lesson (22), Where things stand
(20), Still needs a human (18), Last audit (13), where the runner lives
(10), and the header. So under 400 leaves the traps **55 lines** against
about thirty of them: under two lines each, which is a list of titles with
the content that saves the hour deleted.

The clean fix is closed to the routine. Moving the traps to a sibling
`TRAPS.md` would leave HANDOFF at 347 and lose nothing — but the scheduled
task's own `SKILL.md` tells every run to "read the 'Environment traps'
section of HANDOFF.md before you start", and that file lives outside this
repo in `~/.claude/scheduled-tasks/blackline-build/`. A job here cannot
change it, so moving the section would break the routine's instructions on
the next run.

Options:
1. **Accept 533 and amend the target.** The job's purpose was that a run
   stops paying to read 1,846 lines; 533 is a 71% cut and every removed
   section is indexed. Change G1's number in QUEUE.md to "under 550" and
   close it.
2. **Split the traps into `TRAPS.md`**, HANDOFF drops to 347, and **Josh
   edits SKILL.md in the same stroke** to point the "before you start" line
   at the new file. Nothing is lost, both files stay short, and the traps
   get a home that can grow without taxing every orientation read.
3. **Retire traps on purpose.** Several are now history rather than hazard
   — "a boot failure used to be a silent 60s timeout", "a check used to
   inherit the last check's menu", the flaky sound render — and survive
   only as their operative sentence. Josh names the ones that have earned
   retirement and the rest stay in full.

Recommendation: **2**. It is the only option that costs nothing — 1 keeps
a file bigger than the protocol wants, and 3 trades away hours already paid
for. The one thing it needs is the one thing the routine cannot do, which
is why this is here rather than decided. If 2, G2 in `QUEUE.md` is sized S
and blocked on this.
**decided:** option 2. The traps move to `TRAPS.md`; the routine's
prompt (`~/.claude/scheduled-tasks/blackline-build/SKILL.md`) was edited in
the same stroke to read `TRAPS.md` first and fall back to the section while
it still exists. Infrastructure, decided by the session that runs the
routine, 2026-09-25. G2 unblocked.

### D48 — A third of every run is the GPU catching up. Who pays it?
F11 found that `a-zero-size-viewport-does-not-blind-the-renderer` spends
265s on the plant and 149s on the yard inside one `gl.getError()`, while the
rest of the check — the staged resize and a whole rendered frame — is under
50ms. The call is the suite's first GL synchronisation, and a synchronisation
waits for the software renderer to finish building pipelines the run has
queued. It is 38.8s with only the runner's 60-frame warm-up behind it and
265s with 167 checks behind it, and it is a third of the run however the run
is configured (35% plant pinned to 4 cores, 33% plant on 8, 33% yard). The
full measurement is in `PROGRESS.md`, "F11".

The wait cannot be moved for free, and this was measured rather than
reasoned: a `gl.getError()` after every check makes the plant run **989s
against 753s** and still leaves a 251s check; a `gl.flush()` after every
check costs 0ms and changes nothing. Waiting is the only way to know the
pipeline work has finished, and whoever waits first pays for all of it.

So the choice is what the gate should do about a third of its own clock:

1. **Leave it, as it is now.** The check keeps its GL-error clause, the
   report names the wait in its detail line, and `--stall` stays at 600s
   because the floor under it is this tail. Costs nothing, changes nothing,
   and every future reader has the number and the reason in front of them.
2. **Drop the GL-error clause from that check.** Its other four assertions —
   the canvas unchanged, the drawing buffer intact, the aspect finite, a
   frame still drawn — are what the check is named for, and `gl.getError()`
   is already asserted in `presentation.js` and in the lost-context check
   next door. The plant run would lose most of the 265s, because the tail is
   never paid if nothing waits for it and the page is torn down. What is
   given up is one assertion, which is the thing the protocol says never to
   give up, so it is Josh's to give and not the routine's.
3. **Pay it where the gate names it.** The runner waits once, after the last
   check of each map, and reports the number as the run's own rather than a
   check's. No check is then over ~76s, `--stall` could come down from 600s
   to about 240s, and nothing is given up — but the run's wall clock does not
   improve, and it is honest bookkeeping rather than a saving.

Recommendation: **3**, with 1 as the do-nothing. It is the only option that
both takes the wait off a check that has nothing to do with it and buys the
thing F11 was for — a `--stall` default that reflects the slowest *check*
rather than the slowest *wait*, so a genuinely hung run is called hung in
four minutes instead of ten. 2 buys the most wall clock and is the one that
costs an assertion, which is why it is listed rather than taken.

F11 in `QUEUE.md` is `[~]` on this.
**decided:** option 3. The runner waits once after the last check of
each map and reports it as the run's own number; `--stall` comes down to
about 240s; no assertion retired. Infrastructure, decided by the session that
runs the routine, 2026-09-25. F11 unblocked.

### D49 — The planned arc is finished. What does Blackline get next?
Raised by the build run of 2026-09-24, which found the queue with no
unblocked job in it for the second run running.

`PLAN.md`'s block table — 0 prerequisites, 1 finish what is open, 2 playable
and testable, 3 a second map, 4 styling — is **done, every block**. Phases
1–49 of the original build and all fifty of the redesign are committed.
Blocks A, B, C, D, E and G of `QUEUE.md` are closed; F is the gate's own
housekeeping and is down to F11, which waits on D48. The only other open job
is G2, which waits on D47. Everything the routine can decide for itself, it
has decided.

`PLAN.md` says it plainly: *"an unanswered question costs nothing until it is
the only thing left."* It is now the only thing left. The routine can keep
sharpening the instrument — F12 in this queue is a real hole in it, and there
will be more — but it cannot decide what the **game** should become, because
every option below changes what a player sees, feels or can do, and
`PLAN.md`'s "What is Josh's, and only Josh's" reserves exactly that.

What the work so far suggests is available, none of it started:

1. **Play it, then fix what playing finds.** The largest known gap is not in
   the code: nothing has ever been *heard*, no frame has been timed on a real
   GPU, and the twelve Provisional entries D26–D46 are all of the shape "the
   pixels say it is drawn where it should be, not that it *reads*".
   `PLAYTEST.md` is written and waiting. This costs Josh an evening and would
   refill the queue from evidence rather than guesswork.
2. **A third map, or a map the players make.** D1's registry and D6's
   per-map gate mean a map is now additive, and the yard proved the census
   travels. A third is a known quantity of work; a map *format* is not.
3. **More game.** Nothing in the spec covers more than one Shade and one
   Warden, a round timer beyond the 45s fuse, loadout choice, or anything
   persistent between matches. Each is a rule change, and the asymmetry
   (spec 20.11: the Warden stays grounded) is the thing to protect.
4. **Ship what exists.** The branch `phases-14-45` has never been merged to
   `main` — D2 reserved merging for Josh and no run has asked for it since.
   If the game is to be played by anyone else, that is the first step, and it
   is one line: `git checkout main && git merge --ff-only phases-14-45`.
5. **Stop building and let it settle.** The audit runs weekly and would keep
   reporting; the builder would stop finding work and say so, which is what
   it is doing now.

Recommendation: **1, then decide the rest from what it tells you.** Every
other option spends sessions on a game nobody has played, and four of the
five open Provisional questions would answer themselves in the first ten
minutes of playing. 4 is worth doing in the same evening whatever else is
chosen, because an unmerged branch is the one piece of risk carried here that
no check can see.

This blocks no single job — F12 is unblocked and the routine will take it —
but it blocks every job after the gate's own, which is why it is here rather
than under Provisional.
**decided:** Josh, interviewed 2026-09-25 — D50. The second arc is
Blocks H to O in `QUEUE.md`, sixty jobs.

### D51 — The GitHub repo
H1 and H2 need a remote the routine cannot create. Josh: make an **empty**
repository on GitHub (any name, no README, public if friends are to play from
it), and in its *Settings → Pages* set **Source: GitHub Actions**. Then paste
the HTTPS URL here. The first push may ask for your GitHub login once in the
session that runs H1; after that the credential manager holds it.
**decided:** https://github.com/papasauce11/blackline - Josh, 2026-09-26. Pages was already set up; the session made it a **branch deploy** of `phases-14-45` (the CLI token cannot push workflow files, so an Actions deploy would have needed Josh to re-authorise it) and added the branch to the `github-pages` environment. The game is at https://papasauce11.github.io/blackline/.
