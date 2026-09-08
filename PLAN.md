# Blackline — plan for autonomous continuation

Josh, 2026-09-08: *"get this game in a more playable/testable state. more
polished, a couple maps instead of 1. more styling / visual elements. build a
way using a routine or two to continue with the project mostly yourself, except
save important/critical design questions for me to approve/decide. you will hit
session usage limits, so your routine/plan should account for this."*

This file is the shape of that. `QUEUE.md` is the work, `DECISIONS.md` is what
waits on Josh, `HANDOFF.md` is the live state. A routine session reads all four
and nothing else to get oriented.

---

## The problem being solved

Every session starts cold and ends when its budget does. It must verify the
way the last fifty phases were verified — driving frames in the Browser pane
and reading pixels back — which only a session on this machine can do. And it
must never make a call that changes what the player can *do* without Josh;
that is the one thing he has asked to keep. How things look and sound it may
decide provisionally, and he overrides.

So the design is three files and a protocol:

| File | Owned by | What it is |
|---|---|---|
| `QUEUE.md` | the routine | Ordered, bounded jobs. Each has a *done-when* a machine can check, a size, and optionally a decision it is blocked on |
| `DECISIONS.md` | Josh | Questions with context, options and a recommendation. Josh writes one line under `decided:`. Nothing else in the repo needs to change for a decision to take effect — the next session reads it |
| `HANDOFF.md` | the routine | Current state, traps, how to run. Rewritten at the end of every session |
| `PROGRESS.md` | the routine | Append-only history. One entry per job |

The routine never edits `DECISIONS.md` except to **add** a question. Josh never
needs to touch anything else.

---

## Where the routine runs

Two mechanisms exist, and they differ in one thing that matters:

| | Local scheduled task | Cloud routine |
|---|---|---|
| Runs | on this PC, inside the desktop app, **only while the app is open** (a missed run fires on next launch) | on Anthropic's machines, unattended, from a clone of a GitHub remote |
| Sees | this working tree, the Browser pane, everything this session had | a fresh clone; no pane; only what the runner script can prove |
| Needs | nothing new | a GitHub remote, and the headless runner proven |
| Verification | the same `h.renderFrame` + pixel-readback path the last fifty phases used | headless Chromium with software WebGL |

**Recommendation: start local.** It needs no new infrastructure and verifies
the way the project already verifies. The cost is that Josh must leave the app
open — overnight, or during the day — for runs to happen. If that proves a
nuisance, the cloud routine is the upgrade, and the headless runner below is
what makes it possible. (Decided: D1 in `DECISIONS.md`.)

---

## Prerequisites

| # | What | Who | Gates |
|---|---|---|---|
| P1 | **The dirty tree verified and committed** | me | everything. Phases 8–11 and the plant-room change are done but uncommitted; a routine must start from a clean, known base |
| P2 | **`QUEUE.md` and `DECISIONS.md` written**, seeded from this plan | me | everything |
| P3 | **The routine prompts written**, installed disabled, then one run watched by Josh before enabling | me → Josh | the routines |
| P4 | **A headless suite runner** — `npm run suite`, Playwright + headless Chromium | me | the cloud option only, and a faster gate for the local one. Software WebGL is slow and a few checks are environment-sensitive (frame budget, audio); the runner carries a list of checks *skipped headless* with the reason |
| P5 | **A GitHub remote** | Josh creates; me pushes | the cloud option only — but worth doing regardless, as the only off-machine copy of the work |

---

## The two routines

### `blackline-build` — daily

One job per run. No exceptions.

```
1. ORIENT   read HANDOFF.md, QUEUE.md, DECISIONS.md, git log -5.
2. GATE     npm run suite. If anything is red that QUEUE.md does not list as
            deliberately red, STOP: write what broke to HANDOFF.md, commit,
            push, end. Never build on a broken base.
3. PICK     the first job in QUEUE.md that is not blocked on an undecided
            question. If every remaining job is blocked, STOP and say so.
4. DO       the job, in small commits. If the job needs a call that changes
            what the player sees, feels or can do: do NOT make it. Write it to
            DECISIONS.md, mark the job blocked, pick the next one.
5. VERIFY   npm run suite, twice. A check that answers differently between the
            two runs is flaky, and flaky is a bug in the check.
6. RECORD   PROGRESS.md entry. HANDOFF.md rewritten. Job marked done in
            QUEUE.md. New questions in DECISIONS.md.
7. CLEAN    commit everything; push if a remote exists. The tree is
            clean or the session is not over.
8. STOP.
```

**Budget rule.** A job is sized to one session (`S` = a third, `M` = most, `L`
= all of it). If the job is not done by the time most of the budget has gone:
commit as `WIP: <job>`, split the remainder into a new queue item with an exact
"resume from" note, update HANDOFF.md, push, stop. A half-done job with a
precise note beats a finished job that never got committed.

**Hard rules.**
- Never weaken a check to make it pass. Fix the game or revert the change.
- Never edit `BLACKLINE_SPEC.md` except to add to Section 20 (the changelog).
- Never add a feature that is not in `QUEUE.md`.
- Never merge to `main`. Everything lands on the working branch; Josh merges.
- Files over ~600 lines get split when touched, not ignored.

### `blackline-audit` — weekly

Builds nothing. Reads the week's commits and answers, in a short report
appended to `PROGRESS.md` and mirrored to the top of `HANDOFF.md`:

- What landed, what got queued, what is blocked on Josh and for how long.
- Suite health: count, any check that got *less* strict this week (diffed).
- Drift: files over 600 lines, `TODO`/`FIXME` counts, `Math.random` and
  `setTimeout` in `src/`.
- A fresh-seed run of the fuzz and soak checks, since the builder always runs
  the same seeds.
- One recommendation, if any, for what Josh should look at.

If the builder has been stopping on a broken base for more than two runs, the
audit says so loudly at the top.

---

## The work, in blocks

Detail is in `QUEUE.md`. The shape:

| Block | What | Sessions (est.) |
|---|---|---|
| 0 | Prerequisites above | 2–3, the first being this one |
| 1 | **Finish what is open.** The plant-must-be-defusable directive (6 phases, planned). The traversal redesign, phases 12–50 — hang as a held option, the bump-and-scuff, area rebuilds until the census is green, legibility, feel, spec amendment | 12–16 |
| 2 | **Playable and testable.** A round-start briefing, a controls card, hit and damage feedback, round and match end screens that explain what happened, a difficulty pass driven by the AI checks, and a playtest build with `DEBUG=false` and the test keys inert | 5–7 |
| 3 | **A second map.** First the plumbing: `buildMap(id)`, a registry, menu selection, every check parameterised over every map. Then the map itself, to the same five requirements, through the same census, into the same regression set | 6–9 |
| 4 | **Styling.** Whatever Josh decides "more styling" means — the options are in `DECISIONS.md` — within the draw-call and frame budgets the checks already enforce | 4–8 |

Roughly thirty to forty sessions. Nightly, that is five to eight weeks; twice
a day halves it, if the app is open that long. The audit reports weekly either
way.

Blocks 1 and 2 interleave: the game should be handed to a tester as early as
the second block allows, and the census work continues alongside.

---

## What is Josh's, and only Josh's

Anything that changes what the player sees, feels, or can do. Concretely, the
questions seeded in `DECISIONS.md` now:

- Where the second map is set, how big, and what its hook is.
- What "more styling" means — post-processing, material detail, props, colour.
- Who the testers are and on what hardware, since that sets the performance bar.
- Whether a plant on top of a crate is legal if the Warden can stand beside it.
- What a refused plant looks and sounds like.
- Local or cloud; the cadence; whether the routine may ever merge to `main`.

All seven were answered on 2026-09-08 and are recorded as D1-D7.

The routine adds to that list whenever it hits a fork it should not take. It
does not wait for answers — it picks another job — so an unanswered question
costs nothing until it is the only thing left.
