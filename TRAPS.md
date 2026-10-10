# Blackline — environment traps

Each of these has cost a session about an hour. A run reads this file before it
starts, by its own instructions; `HANDOFF.md` points here and keeps two of them
for the reader who only has that page.

They lived in `HANDOFF.md` until G2 (D47, option 2), where they were 206 lines
of 578 — two thirds of the file every run pays to read, against a section a run
needs once and deliberately. Here they can grow without taxing an orientation
read.

**Nothing in here is deleted quietly.** A trap that has become history rather
than hazard — the fault is fixed, the tool is gone — is retired in a
`PROGRESS.md` entry that names it and says on whose word, exactly as a check is.
Several below are already written that way: the sentence that still holds, with
the history that produced it kept because it is the part that makes it
believable.

---

**The runner serves the live tree, so editing `src/` while a gate runs changes
what the gate is measuring — and two checks read the tree rather than the
page.** H9 started the gate in the background, by the book, and then wrote its
code while it ran, reasoning that the page had already loaded. The page had;
`the-registry-holds-every-check-its-modules-declare` had not, because it
`fetch`es `src/tests/index.js` and every module's text from the origin **at the
moment it runs** and compares what they declare against what the loaded page
registered. A module registered in a file the page loaded before the edit is a
check declared and not held, which is the exact hole F14 exists to report, and
it reported it. `tests/donedef.js` reads source text the same way for the line
counts and the two bans. So the gate's verdict was about a tree that no longer
existed, and the run — forty minutes of it — proved nothing either way.

**Do the ORIENT and GATE steps on a clean tree and write nothing until the gate
is back.** If a gate has already been compromised this way, say so rather than
reading it: the VERIFY at the end of the job, two runs on the finished tree, is
the only reading that was ever load-bearing, and a gate is there to stop you
building on a base somebody else broke. The base's own proof is the previous
job's VERIFY, which is what step 8 of the protocol already says stands as the
next job's gate.

**A number of pixels is a reading about the drawing buffer, not about the thing
you are measuring.** The buffer is 896x503 at `low`, 1280x720 at `medium` and
1600x900 at `high` in the runner's window, and it is whatever the player's window
is times their pixel ratio everywhere else. So a floor of 2,000 pixels fails a
figure that is drawn perfectly, and a fixed rectangle of the frame reads
somewhere else entirely. H28 found five checks doing one or the other, and the
nastier half is the coordinate: **columns 700 to 1270 of an 896-wide buffer are
the end of one row and then part of the row above it**, because the index is
`y * width + x` and nothing bounds-checks `x`. That check had been written up
twice — once by the job that found it and once by the queue — as a shadow-map
effect, because the staircase it assembled out of two rows looked exactly like
one. Use `scaledCount`, `scaledColumn` and `scaledRow` from `src/tests/pixels.js`
for anything measured on the reference buffer, and remember that a count scales
with the **square of the buffer height** (the vertical field of view is fixed and
the horizontal follows the aspect), not with its area. The two agree on 16:9 and
nowhere else.

**A check about geometry should pin the buffer it reads in; a check about the
picture should scale its floors.** The corollary of the trap above, and the line
between them is worth getting right before you reach for either tool. The shape
of a hood is the same shape at every resolution, so reading it in a buffer the
preset shrank is reading the resolution — at `low` in a 1280x720 window the Shade
at 25m is 28x8 pixels and its hood and its neck are the same two of them, which
is a fact about 8 pixels and not about the body. `createLens(h, { pixelRatio })`
pins it and restores it. But the outline's rim, the post's bloom and a pose
photographed *are* the live picture, and those scale their floors instead, or
they stop reading what the player sees.

**A count can be a reading about the shadow map, the same way.** F8's wall check
proves its own instrument by taking the fix off and requiring the stripes back,
and the stripes are the shadow map's texel staircase: 14/9/6 crossings at a 512
map, 23/21/12 at 1024, 50/44/25 at 2048. Halve the map and you halve the count,
so a floor in crossings silently becomes a floor on the quality level. The
amplitude does not move (0.81/0.43/0.30 luma at 512 against 0.76/0.58/0.47 at
2048), so measure how deep a thing is rather than how many of it there are.
This is the third time the same shape of bug has turned up since H10 made the
shadow map a preset knob — see `exactly-one-shadow-caster` in H24.

**A check that hides something must put it back the way the preset wants it, not
the way it found it written.** `the-outline-darkens-the-silhouette-edge` ended
`hull.visible = true` for every hull, unconditionally. At `low` the preset has
the outlines off, so that check *turned them on* and left them on for every check
after it in the run. Nothing caught it and nothing would have: the suite was
pinned to `medium`, where the restore happens to be correct. Restore to
`qualityPreset()`, and if a check changes something the preset owns, say so in
its detail line so the next reader can see it was deliberate.

**A check's detail line is cut at 400 characters, and the cut is invisible.**
`scripts/suite.mjs` does `detail: String(x.detail ?? '').slice(0, 400)` where it
collects a run's results, so it applies to the report's red lines **and to the
`--details <path>` file alike**. H29's check reads five drawing-buffer sizes and
prints one reading each; three of the five vanished, and because a failing check
puts its problems first and its readings last, what came back was a complaint
followed by two readings that did not support it - which reads exactly like a
check that broke out of its own loop early. If a check has more than three or
four numbers to report, make each reading terse (`956x538 body 31x8 hood
8/4=2.00x` is twenty-eight characters and says everything) and count the line
before trusting what came back. There is no warning and no ellipsis.

**A passing check's numbers are not in the report at all.** The report carries a
`detail` only for a check that went red or flaky, which is right for a gate and
wrong for writing up a job: the measurements a PROGRESS entry needs are usually
from checks that **passed**. Run `npm run suite -- --runs 1 --map <one>
--details <path> --subset "^<id>$"` - about a minute - and read the file.
Do not copy a number out of an earlier entry instead: H28 did, from notes that
disagreed with each other, and the time went on deciding which was a typo when
the answer was that two instruments had been quoted in one sentence.

**And a job whose own finding *is* a number runs its VERIFY with `--details`.**
H35 is the worked example and it cost an extra pair of runs. Its whole result
was a ratio the new check measures, it ran the verify the way every other job
runs it, all four runs passed - and because a passing check's detail is not in
the report, **the four readings the verify took do not exist**. Only the fact
that they were inside a band nothing asserted. The follow-up the job wrote
asked the next session to read numbers that had never been written down, which
is worse than not having them, and a second map's pair had to be run
afterwards to make that follow-up answerable. The verify is the only reading
this project takes on a finished tree; if what the job found is a quantity,
that is the run to capture it from, and `--details <path>` costs nothing.

**A loaded machine can take the GPU away mid-suite.** One verify came back
with *eight* pixel checks flaky at once and never reproduced. F1 found it: a
**lost WebGL context**. Chrome kills a starved SwiftShader GPU process and
hands it back a moment later; in the window every draw is a no-op, every
`readPixels` reads black, and the drawing buffer reports 0x0 against a
1280x720 canvas. The suite now counts losses, tags the checks that ran in the
window and re-runs them once; the runner prints `GL CONTEXT LOST Nx`. Read
that line before believing any red pixel check. A check that needs to lose the
context on purpose registers `losesContext: true`.

**A slow check may be a wait, not work — look before you optimise it.** A GL
synchronisation waits for SwiftShader to finish building the pipelines the
whole run has queued, so whichever check calls one first pays for all of it:
`a-zero-size-viewport-does-not-blind-the-renderer` read 265s on the plant and
5ms run alone. It cannot be moved for free — `getError` after every check
takes the plant run 753s → 989s and `flush` after every check costs 0ms and
changes nothing — so F11/D48 named it instead: the suite waits, a check
declares `glSync: true` to be waited for, and the ms is on the run line. That
one is handled; the lesson is not. Before reading a check's ms as that
check's cost, put the suspect call on its own clock — `--details` gives the
total and nothing else. And two runs of a map share a page, so a tail one run
leaves behind is a tail the next one pays (F16).

**Timing `renderOnly()` measures submitting a draw, not drawing it, and a
budget built on it bounds nothing.** H36 gave the viewpoint sweep a
per-viewpoint wall-clock budget so it would take nine samples where nine were
affordable and one where they were not. Under SwiftShader it took nine, queued
nine times the commands, and the pipeline tail ran past the 600s `--stall-wait`
and killed a verify forty minutes in. The reason is F11's tail seen from the
inside: **a draw submits in about 1.7ms and the work lands later**, at whichever
check next synchronises, so a clock wrapped round `renderOnly()` reads the
submission and the budget is spent in microseconds however expensive the frame
really is.

Two false starts are worth as much as the fix. **The GPU timer extension is
present under this SwiftShader build**, so gating the sample count on
`getExtension('EXT_disjoint_timer_query_webgl2')` gated nothing - H11's claim
was that it returns *usable* timings on a real driver, not that it is absent on
a software one, and presence is not usefulness. The second false start was to
believe `glError()`. This entry used to say that it **waits for everything
queued, not for the draw just issued**, so that timing a draw behind a backlog
measures the backlog - which is how a probe reading "eight seconds a draw" came
to be dismissed as really being sixty warmed frames of somebody else's queue.
That reading was the right order of magnitude and the dismissal was wrong.

And the third false start, which is the one worth the whole entry: **drain,
then time one synced draw, then decide** does not work either, because
`glError()` is **not a barrier on this renderer**. Measured with `npm run
probe`, at three viewpoints of the plant: nine queued draws submit in 13-24ms,
`getError()` returns **0.6-0.8ms** later, and a real `fenceSync` /
`clientWaitSync` wait then takes **5,480-6,834ms** for those same nine, which
is **610-761ms a queued draw**. So a sweep that drained and timed one "synced"
draw read 2.6-3.6ms of submission and bought all nine samples over again. H36's
first explanation was that the probe never called `lens.look()` and so timed an
empty camera; looking at a real viewpoint reads **lower**, not higher (2.6-3.6ms
against 5.1ms), so the camera was never it. The barrier was.

What works is **not timing it at all**. The only barrier in this page that
really waits is `drainPipeline()`'s fence, and it must **yield to the event
loop** to poll - so it cannot live inside a synchronous per-viewpoint timer,
and there is no honest wall clock here to decide affordability with. A count
that has to be affordable is therefore **declared and not measured**: H36 put
the frame-budget sweep's sample count in the URL, `?viewpointSamples=9`, which
only `npm run bench` asks for and nothing else does. A check that genuinely
wants the renderer drained still declares `glSync: true` so the wait lands on
the run's clock rather than in its own ms (D48) - without the flag the drain
stands the heartbeat still and `--stall` kills the run instead of
`--stall-wait`. The general rule survives in a stronger form: **before timing
anything on this renderer, ask whether the thing you are timing has finished -
and do not believe `getError()` when it says it has.**

**A second WebGL context costs sixteen seconds here, and `getContext` will not
give you a first one twice.** H4 needed to know whether this browser has WebGL2
and probed a throwaway canvas for it. That probe measured **16,240ms**: under
SwiftShader a context is a whole software device, and the cost is paid again for
every one. The real boot would have paid it and then the renderer would have
paid it again, on every page load, inside the runner's 60s harness timeout. And
the obvious fix is worse than the bug: probing the *real* canvas hands three
back the context that canvas already has, because `canvas.getContext('webgl2',
attributes)` **ignores its second argument once a context exists** — so
`antialias`, `powerPreference` and `stencil: false` vanish from `createRenderer`
silently, and nothing fails. The way out was to stop asking separately:
`createRenderer()` returns null when three's own constructor throws, which costs
nothing and cannot disagree with itself. Before adding any WebGL query to this
project, ask whether the renderer already answers it.

**A batch of queued tasks is one turn of the event loop, not many.** H4's first
measurement of "the bake lets go of the main thread between slices" posted ten
`MessageChannel` messages up front and counted how many had arrived at each
slice. Messages queued together are *delivered* together, so one turn read as
five and the check reported "the page got a turn in 2 of the 5 gaps" — a real
number measuring the wrong thing. Queue one marker per gap and require that at
slice N exactly N have run. The same caution applies to any "did something else
get a chance" test: what you are counting is turns, and a batch is one.

**A per-run number printed once is a per-run number nobody can compare, and a
`break` in a summary loop hides a whole map.** The runner's quality line - the
one that says what `auto` *would* have picked on this machine - ran over
`r.runs` and `break`ed after the first. The suite runs two maps, the probe reads
the machine **times the scene**, and the two maps disagree: 8.70ms and `low` on
the plant against 5.30ms and `medium` on the yard. The summary showed one of
them. So the fact that one machine gets two answers - which turned out to be a
real defect in what a friend's browser remembers, **H25** - sat invisible in the
output every session reads for a month, while `HANDOFF.md` dutifully quoted the
single number it was shown. When a measurement is per map or per run, print it
per map or per run; the whole value of two readings is in their difference, and
a loop that stops at the first one throws that away while still looking like it
reported something.

**One `AudioContext` device error per run pair is the machine, and the code
side of it is closed — do not re-litigate it from the count alone.** *"The
AudioContext encountered an error from the audio device or the WebAudio
renderer."* has turned up in two of the seven verifies on record (H27 on the
yard, H29 on the plant; H28, H30, H31, H32 and H25 clean - the last **four in a
row**, which is the exact shape of evidence H28 mistook for a closure once
already, and a longer streak is not a different kind of evidence). It has been written off once
and brought back once, which is the real trap: **an intermittent fault is not
closed by an absence**, and H28's entry said "that closes it as the machine"
after a single clean verify. What H32 established, so that nobody measures it
again:

- **Exactly one realtime audio context exists per page.** `AudioSystem.unlock()`
  returns `this.context` when one exists, and it is the **only** place in the
  whole of `src/` that names the constructor — one module, three lines, held now
  by `one-module-owns-the-audio-device-and-an-offline-render-gives-it-back` on
  F13's model. The "second context on a device Chrome has no audio for"
  hypothesis is **false**.
- **The "WebAudio renderer" half is ruled out too.** A run builds **seventeen**
  `OfflineAudioContext`s (sixteen sounds in `tests/soak.js`, the scuff in
  `tests/scuff.js`), and every one has rendered correct samples in every run on
  record. A renderer that errored would have failed a render, and
  `every-sound-renders-to-samples-that-match-section-14` would be red. It never
  has been.
- So what is left is the **device**: one live context, resumed, in a headless
  Chrome launched with `--mute-audio` and `--autoplay-policy=no-user-gesture-required`,
  on a Windows box whose audio endpoint is nobody's business here.

**And H39 is the third occurrence, which arrived the moment the record claimed
a streak.** 2026-10-07, plant run 1, **336s in** - the twelfth verify on
record, and the third to show it (H27 yard, H29 plant, H39 plant). What makes
it worth a paragraph is the timing of the *writing* rather than of the error:
one job earlier, H38 had updated `HANDOFF.md` to say the clean run was "eight
in a row, which is the exact shape of evidence H28 mistook for a closure once
already, so do not take it" - and the next verify showed the error. Nobody has
to argue the point again. **An intermittent fault is not closed by an absence,
and the length of the absence is not an argument**; eight in a row was not
evidence of anything except eight observations of the same condition. The
occurrence also fits the standing hypothesis rather than straining it: it is an
end-of-session verify, 336s into a run, on a session whose own cold GATE
reported **0** console errors that morning. H35 is still three gates, and this
is not one of them.

**And H35 asked the device, which turned out to be starved.** The cold-run
census closed at **six gates, every one at 0** (H11, H38, H36, H42, H43 and
H35's own), so the error sits at 3 of 36 runs with the clean ones no longer
concentrated anywhere - which does not confirm the warming story below so much
as dissolve the pattern it was built on. What H35 built instead is a journal the
device keeps from the unlock (`systems/audiodevice.js`), and the number it
produced is the entry worth remembering: **this machine does not feed its audio
device while the suite is rasterising.** On a full plant run the context's own
`currentTime` gained **461.6s of 814.7s** - the output device went unrendered
for **353.1s, 43% of the page** - with the state reading `running` the whole
way and no error event at all. A 16.5-second subset of the same tree lost 0.8s,
so it is not a startup offset: it accumulates with the run. Two consequences.
**A duration measured against this page's audio clock is a reading about four
pinned cores**, the same way a wall clock round a draw is (F11, D71), so no
verdict rests on it and `H50` decides whether one honestly can. And the
starvation is now the leading candidate for the error itself, which fits every
property of the thing - intermittent, no stack, mid-run, invisible to code,
never in a cold gate's first seconds. It is **not** a closure, and the
paragraphs below stand as the account of why nobody should write that word.

**What was still unknown before H35, and it was cheap to settle.** Whether it
ever happens on a *cold* machine. All six recorded observations are **end-of-session verifies**,
taken after an hour or more of driving Chrome — so the cold run H27 asked for has
never been recorded. And the joke is that it happens twice a day already: **the
GATE is a cold run**, and no session has ever written its console-error count
down. HANDOFF.md now asks every run to, and **H35** closes the error or names a
new hypothesis once three are on the record.

Two things make a future occurrence worth more than these five. The runner
**stamps every console error with the map, the run and how many seconds into it
the error arrived** — a device error arrives asynchronously from Chrome's audio
service with no stack and is attributed to the page URL, so the Node end is the
only one that knows where the suite was. And the summary **prints the messages**
rather than only the count, which is how the first two got written off by
sessions that had seen a number and not a sentence.

**`npm run bench` must not run beside `npm run suite`, and it refuses to
(H11).** The bench opens a headed Chrome on the real GPU and times frames; the
suite is half an hour of sustained all-core software rasterising. A frame timed
beside one is a reading about a busy machine, and nothing in the number says
so. So `bench.mjs` calls `otherRunners()` before it launches anything and exits
2 naming the pid. The order in a run is: gate, build, **bench**, verify —
the bench goes in the gap, never alongside. It also refuses if the browser
comes up on a software rasteriser, because that is the gate's number wearing
the word bench, and it writes nothing in either case.

**And a cold gate's first seconds are not a reading about this machine.** H11's
gate recorded `auto would pick low here (215.40ms median CPU over 8 frames)` on
the plant. Twenty minutes later, on a byte-identical tree, a three-check subset
read **5.90ms over 9 frames** — and the real GPU reads 3.2-4.1ms. 215ms is a
reading about whatever else was starting on the machine while the page booted,
over eight frames, and the probe takes it once per page load with no way to
know. Two consequences: a probe median from a gate is not comparable with one
from a subset or a bench, and **a run's own timings are not comparable with the
numbers in `PROGRESS.md` unless the probe line looks sane**. This gate's plant
run took 1,078s against the 963s on record, and that is the same fact.

**A plant run can take 960s, and `npm run suite` is four runs.** Nothing of
that fits the Bash tool's 10-minute cap. Start it with `run_in_background`
writing to a file and wait on the file (`until grep -q "suite: " <file>`,
itself backgrounded or in a Monitor — a foreground wait hits the same cap).
Stopping a backgrounded run from the tool does not stop the runner.

**Writing to a file means `> file 2>&1`, and the background `timeout` is a
kill and not a wait.** H31 started its gate as `npm run suite -- --runs 1 2>&1
| tail -60` with `run_in_background` and a 15-minute `timeout`, on a gate that
takes 35. At fifteen minutes the tool killed the wrapper and the pipeline with
it, so **the whole run's output went nowhere**: `tail` buffers to the end by
design, there was no partial output to read, and the output file held the four
characters `[killed]`. The runner itself carried on exactly as the trap above
says, to the end of its run, with its stdout pointed at a pipe nobody was
holding — forty minutes of work with no verdict, and no gate for the job. Two
rules out of it: **redirect, never pipe** (`> out.txt 2>&1`, so a killed
wrapper still leaves everything the runner printed up to that moment on disk),
and **set `timeout` above the longest the run could take** — the cap is
7,200,000ms, a two-run `npm run suite` is about 3,000,000ms of it, and there is
no cost to asking for more than you need. Then wait on the file in a second
backgrounded command. And when waiting on the *process* instead, do not use
`tasklist /FI "PID eq N" | grep N` from the Bash tool: it matched nothing and
returned "exited" immediately on a process that had half an hour left.
`Wait-Process -Id N -Timeout <s>` in PowerShell is the one that answers. And
**`kill -0 <pid>` from the Bash tool lies the same way**: H41 used it as a
liveness guard inside a Monitor loop and it reported a `suite.mjs` with fifteen
minutes left to run as gone, because Git Bash's `kill` looks in its own process
table and not Windows'. One false alarm mid-gate, and it would have been a
wrong conclusion about a dead runner if the file it was watching had not
disagreed. Liveness is `Get-Process -Id N` or `Get-CimInstance Win32_Process
-Filter "ProcessId=N"`.

**And an orphaned runner never dies on its own — it has to be killed by hand,
and a scheduled session can do it.** *(F10 closed one way of making them: a run
whose heartbeat stands still dies naming the check, and SIGINT/SIGTERM tear the
tree down. **H41 found the way that is still open, and paid for it** — the
session that launched a healthy runner simply ending. The 2026-10-08 17:10 run
started a gate at 09:01 and ended at 09:02 with it still drawing, so H41's own
plant gate ran beside a second full suite for 38 of its minutes and took
**2,215,508ms against the 1,105,958ms of the four runs before it**, with `auto`
picking `low` off a 10.30ms probe where this machine reads 5-7ms. **Since H45 the runner refuses
rather than telling you**: it exits **3** before launching anything, naming the
other pid, two ways to end it, and `--allow-other-runners`, which is the only
way past and exists for the reader who means it and will read the report
knowing. **Exit 3 is a refusal, 2 is a crash and 1 is red** - three different
mornings, and until H45 the third did not exist, so a run beside an orphan came
back green with its timings doubled. If you pass the flag you get the old
`OTHER RUNNERS ALIVE: pid N (started) - every timing above was measured against
them` in the summary, `otherRunners` in the report and `besideOtherRunners`
true; read that line before reading any timing. The warning alone was read past
twice before it became a refusal. The two pids below are from
2026-09-23, are no longer on this machine, and the history is kept because it
is what makes the sentence believable.)* The 09-18 17:00 build's runner was still alive
on 2026-09-23: `npm run suite` (pid **9608**) → `node scripts/suite.mjs` (pid
**4792**, a server still listening on 127.0.0.1:54315) → a headless Chrome
tree (pid **8920**) whose renderer had burned 1,975 CPU-seconds. Resist the
obvious inference: it does *not* follow that this is why a plant run went 450s
→ 850s, because E6's run and every gate since were measured with it alive.
Contention is a constant across every timing on record, not something that
separates them. The clean test is a gate run once the processes are dead, and
**H41 finally had one**: killed mid-gate, the yard run that followed came in 3%
over the four runs before it while the plant run taken beside the orphan was
**100% over**. So contention on this machine is worth a factor of two on a
plant run and nothing measurable on a run taken after it, and the paragraph
above is right that it does not explain 450s -> 850s - those two were measured
beside the same thing. F11's run stopped a verify from the tool and briefly
had a second pair (pids 10316 and 11820, 2026-09-23 18:55): stopping kills
the `npm` wrapper only, and `suite.mjs` carried on to the end of its four
runs — about forty minutes — before tearing its own tree down and exiting.
So **F10's teardown holds and nothing new leaked**, but a stopped gate is not
a stopped gate: it keeps the cores it had, and the next run measured beside
it is measured beside it. Let a backgrounded gate finish rather than stopping
it. Find them with

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Select ProcessId,CreationDate,CommandLine
```

and end one with **`Stop-Process -Id <pid> -Force` in PowerShell**. This entry
used to say `taskkill /PID <pid> /T /F` and that **Josh had to run it himself**,
because a scheduled session's sandbox refuses `taskkill` as interfering with a
workload. That refusal is real and `Stop-Process` is **not** refused: H41
cleared a whole orphan tree with it in one call — the `npm` wrapper, the
`suite.mjs`, the Chrome parent and its eight children, eleven pids named
explicitly — and the yard run that followed came in at 790,979ms against
765,105ms, 3% over, which is how we know the contention was the whole of the
plant's doubled figure. Take the tree off `ParentProcessId` first
(`Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Select
ProcessId,ParentProcessId,CreationDate`) and be sure of the pids: the ordinary
`chrome.exe` tree is Josh's own browser, the desktop app's renderers are in it,
and a stray `npx serve` from another chat is not a suite.

**A new setting must join H7's round-trip census, and a subset that does not
name it will not tell you.** `changedValues()` in `tests/settingsstore.js` builds
a non-default value for every key in `CONFIG.settings.defaults` and **returns the
name of any key it has none for**, so `a-setting-changed-now-is-the-setting-a-
reload-reads` goes red the moment a setting is added without one. That is the
census working; the trap is what it costs. H10 added two settings, ran three
green subsets first, and none of their regexes reached that check id — so the
failure arrived at the end of a **65-minute** verify instead of in the first
minute. **A job that adds a key to `CONFIG.settings.defaults` runs
`--subset "setting"` before it runs anything else.** H9 was caught by the same
census and got away with it by happening to look.

**A setting outlives the page now.** Since H7, `SETTINGS` is written to
`localStorage` whenever a player makes a decision - a settings row, the role
row, a map card, the end of the tutorial - and read once at boot. A check that
clicks one of those rows has made that decision: put the setting back in a
`finally` *and* save, or the next page load in the same browser context starts
somewhere nobody chose. The headless runner gives each map its own context
(`browser.newPage()` is a new context in Playwright, not a new tab), so the
blast radius today is one page and the two runs that share it - and the two
runs do not reload, so they never read it back. A check that ever reloads a
page widens this to everything after it. The list of what is kept is
`NOT_PERSISTED` in `settingsstore.js`, and the debug gate is deliberately
outside it.

**Two sessions in this repo will collide on decision numbers.** A5 raised its
question as D19 while, ten minutes earlier and unseen, another session had
committed a different D19. Before adding to `DECISIONS.md`, `git log --oneline
-5` and re-read the file — the number you are about to use may have been taken
since you loaded it.

**The routine may be running while you are.** `blackline-build` fires at 17:00
and 02:00 and a run can last hours. Before you commit from a human session,
look at `git status`: a file you did not touch is the routine's in-flight
work. Never `git add -A` then — add your own files by name.

**A scheduled run cannot use the Browser pane at all.** It refuses to start a
dev server unattended, by rule. `npm run suite` is the only gate a routine
has; for a look, `npm run shot`.

**The browser pane never composites.** `document.hidden` is always true,
`requestAnimationFrame` never fires, screenshots time out. Drive frames with
`h.renderFrame(1/60)`, never by waiting for rAF, and verify anything visual
with `gl.readPixels` — see `src/tests/pixels.js`. The one time this bit hard:
an emulated resize left the canvas 0×0 and *all eight* pixel checks went black
at once, and the obvious reading (the last commit broke rendering) was wrong.

**A check that awaits `h.nextFrame()` hangs where frames never fire**, and the
browser pane is such a place. Read `document.hidden` first and fail with a
reason instead. Since F10 the headless runner kills such a run rather than
hanging with it, but the check is still wrong.

**A run of checks never yields a task on its own.** `await` on an
already-settled promise is a microtask, so a stretch of synchronous checks
holds the main thread from the first to the last and nothing outside the page
can see how far it has got. Hence `yieldTask()` at every check boundary (F10);
anything observing a run from outside depends on it.

**The runner keeps 400 characters of a check's detail, and the F4 log is not
in the report.** A diagnostic that matters goes at the front of the failure
line, compact; D5 lost two runs to a trace cut off before the interesting
part. `debugTools.logResult()` reaches the F4 panel in a tab, never the runner.

**The working copy is mixed CRLF and LF**, with `core.autocrlf` true. A patch
script that assumes one fails silently on the other. Detect per file: read with
`newline=""`, note whether `\r\n` is in it, work in LF, write back the way it
was. A byte-exact match against `\n` content fails silently on a CRLF file.

**Bash heredocs fail on JS content** in this shell — `unexpected EOF` — and
sometimes even inside `python - <<'PY'`. Use the Write tool for new files, and
write a patch script to the scratchpad with the Write tool and run `python
<path>` rather than piping it in. **A patch script must take its root as an
argument and refuse to run without one:** G1's own predecessor defaulted it to
an empty string, which resolved to the current directory and patched the live
tree in the middle of a gate run.

**And the reason to reach for the file every time is what a backtick does on
the way there.** Markdown prose about this project is full of backticked
identifiers, and a backtick inside a double-quoted shell string is **command
substitution** — so an inline `python -c "…"` carrying a sentence about
`scripts/suite.mjs` makes bash *run* `scripts/suite.mjs`, and what comes back is
`//: Is a directory` and a syntax error at line 5 of a file nobody was editing.
H9 lost a few minutes reading that as the runner having broken. The edit itself
never happened, which is the one mercy: the script reached python with a mangled
string and its own anchor assertion refused. Write the script to the scratchpad
and run `python <path>`, and keep the anchor assertion that made the failure
loud.

**And H38 found the failure mode that has no mercy in it.** The paragraph above
describes the loud case, where what bash hands python is nonsense and the anchor
refuses. The quiet case is the common one: a backticked *identifier* with no
slash in it - `auto`, `medium`, `bench only` - is run as a command, the shell
prints `auto: command not found` to stderr among the rest of the output, and
command substitution replaces it with **the empty string**. The script then
succeeds. It patches the file, prints `ok`, and leaves prose with holes in it
reading "would have picked  on both" - which is exactly what a sentence looks
like when nobody reads it again. Nothing failed, the exit code was 0, and the
only sign was four `command not found` lines above a success message. So the
rule is not "write it to a file when the content looks dangerous"; it is to
write **every** markdown patch to a file, because the content that bites is
ordinary prose about this project, and then read the patched lines back.

**Python's default encoding here is cp1252.** A script that opens a markdown
file containing an em dash without `encoding='utf-8'` reads a different string,
and an `anchor in s` that should be true is false. Open with `encoding='utf-8'`
both ways.

**`git checkout --` does not revert a file git has never seen, so the loop
that proves a check load-bearing silently stops reverting the moment the check
is new.** H39 wrote a new module and proved it by breaking it three ways in a
loop - patch, run the subset, read the red, `git checkout --` the file, next
break. The first two breaks were in the new module, which was **untracked**:
`git checkout` printed `error: pathspec ... did not match any file(s) known to
git` on stderr, among a page of suite output, and the break stayed in. So the
second run was measured on a tree carrying the first break, and the third on a
tree carrying both. The reds still named their own lines, which is the only
reason this was recoverable rather than three proofs that proved nothing - the
misclassified entry's complaint was in every run after the one it belonged to,
which is what gave it away. Two rules. **`git add -N <file>` (or a first
commit) before a break-and-revert loop on a new file**, so checkout has
something to go back to. And **read `git status --short` between breaks, not
only at the end**: a revert that did nothing looks exactly like a revert that
worked, and a loop is where that costs the most.

**And `git checkout --` reverts to HEAD, which is not "before my break" when
the work is uncommitted.** The trap above is its mirror and H36 paid the other
side of it an hour later. The break-and-revert loop that proves a check
load-bearing was run against a file that was **tracked but modified**: the
break landed, the red was read, `git checkout -- <file>` ran - and took the
file back to the last commit, throwing away the whole job's implementation
along with the break. The next two breaks then failed to find their anchors,
which is the only reason it was noticed at all. So the rule for a
break-and-revert loop is **keep your own copy and restore from that**: `cp
<file> <scratchpad>/good.js` before the first break, `cp
<scratchpad>/good.js <file>` after each one, and diff the two at the end of
every iteration. `git checkout` is the right tool only when the thing you
want back is what is committed, which during a job it never is.
**And copy every file you intend to break, not only the new ones.** H43 obeyed
the entry above — it copied the two modules it had just written before the
first break — and then broke a *tracked* file it had edited that same hour and
reverted it with `git checkout --`, losing the job's own two edits to it. The
next proof run still reported that file carrying the thing the job had removed,
which reads like a second bug rather than like a lost edit. Partial compliance
with these two entries is the shape the trap takes now: the rule is about every
file the loop touches, whatever git thinks of it.

**A gap between a drawn body and its capsule is a gap between two feet or two
centres, never one of each.** `agent.position` is the capsule's **centre**;
`agent.mesh.position` is written as `_smoothPosition.y - half.y`, which is its
**feet** (`positionreads.js`'s `feel.js` entry quotes the expression).
Subtracting the two raw vectors adds the capsule's half-height to every reading,
and the arithmetic is silent about it. H46 measured all twelve strike states
that way and got `hang` at **0.94m** where H43's table says 0.014m, with
`crouch` at exactly half the standing states - that halving is the tell, because
a crouched capsule is half as tall and nothing else in this model scales with
posture. The wrong numbers were the cheap half of it. The expensive half is that
the same check was placing six candidate eyes off that point to ask `isClear`
about them, so its eyes were 0.9m too high and it **found two states moving that
do not move**, which read exactly like a finding. `feetY` is the accessor the
entity already has. And the reason this was caught rather than shipped is worth
as much as the rule: the new reading was held against H43's independently
measured table and disagreed with it everywhere. **Measure something a previous
job measured, and compare, before you measure the thing nobody has.**

**A coverage check cannot see a connectivity fault.** Three times now: the A1
constant that stayed green with the step at 2m, the HUD check that was green
only because of who ran before it, and A1's ground that was two islands while
every spawn, waypoint and site sat happily on one of them. Before believing a
check on a *set*, ask whether it would notice the set being cut in half.

**`renderFrame` and a lens do not mix.** The frame re-parents the camera to the
actor's rig every time it runs, so a lens pointed at the floor is pointed at it
no longer after one `h.renderFrame()`. Press debug keys with
`debugTools.pollKeys()` while a lens is up, and do anything needing the frame
after `lens.restore()`.

**Never time `readPixels`.** It blocks on a GPU sync and copies megabytes; it
reported a 2ms frame as 14ms. Use `lens.renderOnly()`.

**Warm up before measuring — the AUTO suite counts as measuring.** The first
draw after a load compiles shaders. A run straight after a reload reported
`hall-north` at 17.80ms against an 8.33ms ceiling; warmed, the same viewpoint
is 1.22ms. Drive 60 frames of `renderFrame(1/60)` first.

**A wall-clock guard and a cold view do not mix.** The death camera's guard
(16.5s) is measured on the wall clock by design; the first draw of a view the
renderer has not seen compiles for tens of seconds headless (39s at site A),
and `readPixels` blocks until it is done. Such a check gets the guard, not the
picture — and red only when run alone, because in the full suite an earlier
check paid the compile. Warm the view first, and listen for `deathcam:guard`.

**Noise events come from a recycled pool of 48.** Copy the fields you need; a
retained event gets overwritten (a landing read 8m instead of 10m because a
Warden footstep reused the slot).

**A check may leave anything behind except presentation.** Since F2 the runner
calls `h.resetPresentation()` before every check, because one that rendered a
frame behind a menu used to leave every HUD-reading check after it reading a
stale DOM. Match state is still the check's own business, and `initMatch` at
the top remains the way to start clean.

**The pulsing site marking pollutes pixel samples.** Sample off it.

**Four rifle rounds kill the Shade, and since C5 the Warden lands them.**
God-mode it (`h.debugState.godMode = true`) in any long test or the AI ends
your measurement window — and put it back.

**Smoke blocks AI sight entirely and a seen flashbang blinds it** — so the
check-29 load only coexists with gunfire if the smoke is off the firing line.

**`SETTINGS.x` is the live value. `CONFIG.settings.defaults.x` is a seed.**
Reading the latter compiled fine and silently broke the difficulty and match
length controls for thirty phases.

**One console warning during the suite is expected** — the death-camera check
deliberately fires its own wall-clock guard.

**A check that emits half an event leaves the other half behind.** The audio
check emits a synthetic `gadget:detonate` for the sound; effects hears it too
and spawns a cloud with no gadget behind it, which
`effects-drain-when-idle` calls a leak. Pair the event with the registry
effect, or clean up after it.

**If a rendered sound ever answers differently between two runs, something is
random.** `every-sound-renders-to-samples-that-match-section-14` was flaky
until B2 found `renderOffline()` drawing its noise from `Math.random`; it
seeds a private `mulberry32` now.

**If the runner says `suite: crashed:` with no page error under it**, the
harness never loaded for a reason the page did not report — look at
index.html's import map first.

**A backtick inside a CSS template literal is valid JavaScript**, so
`node --check` says nothing and the page dies at load. `menucss.js` and
`briefing.js` hold their stylesheets in template literals; H8 wrote a CSS
comment mentioning two class names in backticks, the way every other comment
in the project names an identifier, and the first of them closed the literal.
What followed became a tagged template, and the browser reported
`hex(...)hex(...).value is not a function` from a file with no such call in
it — a minute of staring at the interpolations before the comment. **Never
put a backtick in a comment inside a template literal**, and read any
`is not a function` naming a helper twice over as a literal that ended early.

**Which of two `window` listeners runs first is not yours to choose, and
`preventDefault` does not unsend an event.** `Input` and `Menu` both listen
for `keydown` on `window`; whichever was constructed first runs first, and an
event dispatched straight at `window` — which is how a check presses a key —
runs both of them whatever phase they asked for, so `stopPropagation` does
not help either. H8's press-to-bind hit this: the key that bound jump was
also *pressed* as jump, and a `clearAll()` at the moment of the bind was
undone by the very event that caused it. The fix that works whichever way
round they run is a gate held open to the keyup (`Input.swallowPress()`).
Before writing "the menu swallows this key", check who else is listening.

**A moved method can reference a module constant that did not move.** Both F3
boot failures were this (`P`, `THREE` used in `mapgen.js` without an import);
`node --check` cannot see it and only the code path that runs at boot reports
it. After moving code between modules, grep the new file for every bare
identifier the old module declared at top level.

**And the mirror of it, which is what the subset misses.** H46 carved the eye
choice out of `photographHere` into `chooseEye`, inside the same file. `focus`
moved with it; `lens.look(eye, focus)` stayed behind, pointing a lens at an
undefined variable. Every check that photographs a pose threw *"Cannot read
properties of undefined (reading 'isVector3')"* - and the job's own subsets were
all green, because they ran the **new** check, which never calls the function
the code came out of. Two rules. **A function extracted from another is a change
to the caller**, so the identifiers to grep for are the ones the caller still
uses and the extraction took away - and if the extracted piece decides two
things together (where the eye is *and* what it was required to see), it returns
both or the second one is lost. And **the subset to run after moving code is the
one that exercises what you moved it out of**, not the one that exercises what
you wrote; it cost a 65-minute verify to learn which of those two is the real
test.

**`MultiplyBlending` needs `premultipliedAlpha: true` on the material in
r180.** Without it three logs a warning once a frame and draws the mesh with
normal blending — a white texel lands as opaque white. E4's first subset had
161 console errors; the runner's `consoleErrors` count is where it shows first.

**A dark surface hides its texture in a level or two.** Measure a texture under
a lamp (a surface at luma 80–100), and by difference — the frame with the map
minus the same frame with `material.map = null` — so the lighting's bands
cancel and what is left is the texture.

**An sRGB texture multiplies harder than its texel says.** A grey texel of 0.88
is 0.75 linear, and the surface it multiplies is lit in linear: E4's first
grime took a fifth off a lit floor where the texel promised a tenth. Budget the
darkening from the pixels, not the texel.

**`npm run suite --details out.txt` writes no details, and says nothing.** A
flag has to come after npm's own `--` to reach the script: without it npm reads
`--details out.txt` as its own config and `scripts/suite.mjs` is handed no
arguments at all. H23 lost a verify's worth of per-check readings that way -
the run itself was perfectly valid, four runs at the defaults, but the file it
was told to write never appeared and nothing complained, because a runner
cannot tell a flag it was never given from a flag nobody wanted. The same
swallow applies to `--runs`, `--subset`, `--map` and `--query`, where the cost
is worse: `npm run suite --runs 1` is a silent **four-run** suite. Every
example in `HANDOFF.md` has the `--` in it; copy one rather than typing it. And
when a run is meant to produce a file, check the file exists before reading the
run as the measurement you asked for.

**An object spread copies a getter's value, not the getter.** H27 split the
seeded rng into two streams and built the simulation's as
`export const rng = { ...streamOver(rngState), reseed, get seed() {} }`. The
helpers came across fine, because they are functions closing over the state —
but `calls` is a **getter**, and spreading evaluates it once and writes the
number. `rng.calls` was therefore frozen at 0 for the life of the page, and
`debugState.rngCalls`, the determinism canary the F3 overlay shows, read zero
draws forever. **No check would have caught it**, because nothing asserts that
field: it exists to be looked at by a human. It was found by a six-line
`node -e` script run against the module before the suite ever saw it, asserting
the properties two streams owe each other. Use `Object.defineProperty`, or
build the object and attach, and keep the reason at the line. And the wider
lesson, which this project keeps meeting from the other side: **a field nothing
reads is a field that can die quietly** — if a value is a canary, something has
to assert it, or it is decoration.
