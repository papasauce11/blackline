# Blackline — handoff

**Read this first, then `BLACKLINE_SPEC.md`.** `PROGRESS.md` is the full
append-only history (2,800 lines); read only the sections you need — the last
entry, "THE ENDGAME REDESIGN", is the live one.

---

## Where things stand

| | |
|---|---|
| Branch | `phases-14-45` — **3 commits ahead of `main`, not merged** |
| Merge with | `git checkout main && git merge --ff-only phases-14-45` |
| Working tree | clean |
| AUTO suite | **102 passed, 1 failed** — the failure is deliberate, see below |
| Runtime assertions | 8, zero failures |
| Map | 214 collision boxes, 65 climbable |

Phases 1–49 of the original build are done and committed. A **redesign** is now
in progress and it is only 7 phases in.

---

## The redesign — read this before touching traversal or the map

Josh, after phase 49:

> *"endgame there should be no markings. should be able to do on a ledge what
> you would expect to be able to."*

This **amends the spec**. Section 5 mandated affordance markings and Section 6.1
fixed three traversal bands; both are being replaced. The direction was settled
by interview and is binding:

| Decision | Answer |
|---|---|
| Scope | All traversal aids gone: ledge stripes, chevrons, dashes, and the lit vent interiors. **Plant-site rings stay** — a bomb site is objective information, not an affordance |
| Climb rule | **Reach-based, athletic**: ~2.6m standing, ~3.8m with a jump |
| Failed climb | A physical tell **plus audio**. Never silent |
| Hang | A **held option you choose**, never a failed mantle |
| Warden | **Stays grounded.** The asymmetry is the game |
| The test | **Purely mechanical.** Standable top + within reach ⇒ climbable. No tags, no exceptions, no `noClimb`. The map obeys the rule |
| Map freedom | Keep the five v2 requirements (Shade starts outside, level 2 is one connected deck, stairless routes up, every room 2+ entries, raised ceilings). Reshape everything else freely |
| Vents | Read as passable by **material contrast** — metal against concrete |
| Spec | **Amend** Sections 5 and 6.1 with a changelog (phase 47, not yet done) |

---

## The 50-phase plan

| Phases | Block | Status |
|---|---|---|
| 1–7 | **Strip and measure** | ✅ done, committed |
| 8–18 | **Reach-based traversal** — jump-extended reach at the probe, approach tolerance, input buffering, hang as a held option, the bump-and-scuff | ⬅ **next** |
| 19–34 | **Area rebuild, lockstep** — geometry + controller together, worst area first | pending |
| 35–41 | **Legibility without markings** — material language, edge profiles, metal ducts, route lighting, contrast measured from pixels | pending |
| 42–46 | **Feel** — camera, momentum, weight, timing, traversal fuzz | pending |
| 47–50 | **Close** — amend the spec, re-sweep, Warden sanity, done-definition | pending |

---

## The one red check IS the work queue

```
FAIL  every-climbable-surface-can-actually-be-climbed
      49 of 65 climbable surfaces cannot be climbed.
      By area: turbine-hall 14, loading-bay 14, interior 8,
               server-vault 7, exterior 4, upper deck 2
```

**Do not "fix" this by weakening it.** It is the honest baseline for the whole
redesign and it stays red until blocks B and C close it. It walks the Shade up
to all four faces of every climbable surface and drives the real controller at
it. Named failures are logged to the F4 panel (`debugTools._testLog`).

Start with the **Turbine Hall** — the census picked it, not taste.

Its sibling `the-climb-rule-has-no-exceptions` passes and must keep passing: it
is what makes the rule the single source of truth.

---

## Running it

```bash
npx serve -l 5173 .
```

In the browser console (`window.BLACKLINE` is the harness):

```js
await BLACKLINE.debugTools.runAutoTests();      // full suite (~6s)
await BLACKLINE.debugTools.runRegressionSet();  // Section 16's set, 16 checks
```

In-game: **F3** overlay · **F4** test mode · then **Y** full suite, **U**
regression set. Run the suite **twice** — a flaky check shows as a different
answer, not a pass.

---

## Environment traps — these will cost you an hour each

**The browser pane never composites.** `document.hidden` is always true,
`requestAnimationFrame` never fires, screenshots time out. So:
- Drive frames with `h.renderFrame(1/60)`, never by waiting for rAF.
- Verify anything visual with `gl.readPixels` — see `src/tests/pixels.js`.
- The one time this bit hard: an emulated resize left the canvas 0×0 and *all
  eight* pixel checks went black at once. The obvious reading (the last commit
  broke rendering) was wrong.

**Bash heredocs fail on JS content** in this shell — `unexpected EOF`. Use the
Write tool for new files and a `python - <<'PY'` block for edits.

**Never time `readPixels`.** It blocks on a GPU sync and copies megabytes; it
reported a 2ms frame as 14ms. Use `lens.renderOnly()`.

**Warm up before measuring.** The first draw after a load compiles shaders and
is not representative.

**Noise events come from a recycled pool of 48.** Copy the fields you need; a
retained event gets overwritten (a landing read 8m instead of 10m because a
Warden footstep reused the slot).

**The pulsing site ring pollutes pixel samples.** It sits dead centre under a
camera pointed at a site and swings 0.35–0.9 opacity. Sample off it.

**Four rifle rounds kill the Shade.** God-mode it in any long test or the AI
ends your measurement window.

**Smoke blocks AI sight entirely and a seen flashbang blinds it** — so the
check-29 load only coexists with gunfire if the smoke is off the firing line.

**`SETTINGS.x` is the live value. `CONFIG.settings.defaults.x` is a seed.**
Reading the latter compiled fine and silently broke the difficulty and match
length controls for thirty phases.

**One console warning during the suite is expected** — the death-camera check
deliberately fires its own wall-clock guard.

---

## The lesson that keeps repeating

Three separate bugs — the Phase 3 ledge hang, the Phase 21 slide, and the
Phase 47 match score — were all **wired, tested, green, and impossible in play**.
Every one came from a check that drove the game differently from how a player
does.

A held key and its press edge arrive on the **same step**. A test that sets
`intent.crouchPressed` without `intent.crouch` is testing a machine nobody is
sitting at. Drive `input.heldCodes` / `input.pressedCodes` — see
`src/tests/fuzz.js`.

---

## Still needs a human

- How any of it **looks**. Pixels prove things are drawn, not that they read.
- How any of it **sounds**. Samples are the right length, level and register;
  nobody has heard it.
- The **vsync framerate** on integrated graphics. CPU 1.7ms mean / 5.4ms worst
  across 92 viewpoints against a 16.67ms budget says there is room, not what a
  real GPU does with it.
