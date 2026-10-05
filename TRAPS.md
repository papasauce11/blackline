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

**A plant run can take 960s, and `npm run suite` is four runs.** Nothing of
that fits the Bash tool's 10-minute cap. Start it with `run_in_background`
writing to a file and wait on the file (`until grep -q "suite: " <file>`,
itself backgrounded or in a Monitor — a foreground wait hits the same cap).
Stopping a backgrounded run from the tool does not stop the runner.

**And an orphaned runner never dies on its own — it has to be killed by hand,
and a routine cannot do it.** *(Since F10 the gate no longer makes them: a run
whose heartbeat stands still dies naming the check, and SIGINT/SIGTERM tear
the tree down. The two below predate that, are still alive, and are named at
the start of every run since.)* The 09-18 17:00 build's runner was still alive
on 2026-09-23: `npm run suite` (pid **9608**) → `node scripts/suite.mjs` (pid
**4792**, a server still listening on 127.0.0.1:54315) → a headless Chrome
tree (pid **8920**) whose renderer had burned 1,975 CPU-seconds. Resist the
obvious inference: it does *not* follow that this is why a plant run went 450s
→ 850s, because E6's run and every gate since were measured with it alive.
Contention is a constant across every timing on record, not something that
separates them. The clean test is a gate run once the processes are dead, and
nobody has had one yet. F11's run stopped a verify from the tool and briefly
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

and end one with `taskkill /PID <suite.mjs pid> /T /F` — **Josh has to run
this himself**: a scheduled session's sandbox refuses `taskkill` as
interfering with a workload. Be sure of the pid first; the ordinary
`chrome.exe` tree is Josh's own browser.

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

**Python's default encoding here is cp1252.** A script that opens a markdown
file containing an em dash without `encoding='utf-8'` reads a different string,
and an `anchor in s` that should be true is false. Open with `encoding='utf-8'`
both ways.

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
