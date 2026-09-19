# Blackline

An original asymmetric stealth game. One human **Shade** (third person, agile,
three lives per round) plants a charge at one of three sites in the Meridian
Substation. One AI **Warden** (first person, heavily armed, respawning) tries to
kill the Shade or defuse the charge.

Built to `BLACKLINE_SPEC.md`, which is the contract for this repo.

> **Build status:** in progress, mid-redesign. See [HANDOFF.md](HANDOFF.md) to
> get oriented in one page, and [PROGRESS.md](PROGRESS.md) for the full history.
> The affordance markings described in Section 5 of the spec have been removed
> and traversal is being rebuilt around physical reach — HANDOFF.md explains.

---

## Running it

Playing it rather than building it? `PLAYTEST.md` is the short version:
what to look at, what only eyes can judge, what is known to be wrong.

No build step, no bundler, no npm dependencies. Any static server works.

```bash
npx serve
```

Then open the URL it prints (usually `http://localhost:3000`).

It is a static site, so it deploys to Vercel with no configuration.

### The playtest build, and the debug build

What you get by opening the page is the **playtest build**: no overlay, no
test mode, every debug key inert. The debug tooling is behind a gate that is
off by default. To turn it on for a page load, add `?debug=1`:

```
http://localhost:3000/?debug=1
```

or flip **debug tooling** in the settings menu at any time. Off again, any
open panel comes down on the next frame.

### Reproducing a specific match

The match seed is shown in the F3 debug overlay (debug build). To replay a
seed, append it to the URL:

```
http://localhost:3000/?debug=1&seed=2709321559
```

### Choosing a map

Two maps are registered (`src/maps/index.js`): `plant`, Meridian
Substation, and `yard`, the container yard - a ring of containers with a
gate at each end, three bays and stacks one to three high; a container
is 2.9m, a jump and a grab, and the second tier needs the first (D2; the
Warden's walkway, the night lighting and the AI's yard are D3-D5). The
page opens on `plant`; `?map=yard` opens the other,
and the main menu's *map* row reloads the page on the next one, keeping
the seed and the debug gate. The headless suite runs on one map at a
time: `npm run suite` is `plant`, `npm run suite -- --map plant,yard`
both, reported per map.

---

## Three.js version

**Pinned to `three@0.180.0` (r180)**, loaded from jsDelivr via the import map in
`index.html`. This is the only external request the game makes.

```html
<script type="importmap">
{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js" } }
</script>
```

`build/three.module.js` re-exports `build/three.core.js` using a relative
specifier, so that second file resolves against the same CDN path automatically.
No addons are used.

**Do not float this version.** r180 was chosen deliberately:

- It is after **r175**, which renamed `CapsuleGeometry`'s `length` parameter to
  `height`. The signature here is
  `CapsuleGeometry(radius, height, capSegments, radialSegments, heightSegments)`.
- It is after **r152** (`outputEncoding` → `outputColorSpace`) and **r165**
  (removal of `useLegacyLights`), so there are no deprecation warnings.
- It is *before* **r185**, which changed `Object3D.updateWorldMatrix()` to honour
  the `matrixWorldNeedsUpdate` flag — a semantics change that would affect the
  hand-rolled camera rig.
- Light intensity is physical (candela, `decay = 2`), which the visibility
  scoring in `config.js` accounts for via `detection.scoreScale`.

---

## Controls

| Key | Action |
|---|---|
| `W` `A` `S` `D` | Move |
| `Mouse` | Look |
| `Space` | Jump. A jump extends how high you can climb. At a ledge: tap to grab and hang, hold to climb over |
| `Ctrl` or `C` | Crouch / slide (from a sprint) |
| `Shift` | Sprint |
| `Left mouse` | Fire (Warden) |
| `Right mouse` | Aim down sights (Warden) |
| `R` | Reload |
| `E` | Interact — plant the charge |
| `F` | Knife |
| `Esc` | Pause — releases the mouse and stops the simulation; Resume, Settings or Main menu |

Gadget slots depend on which faction you are driving. They fire on the press;
there is no separate throw button.

| Slot | Shade (competitive) | Warden (free roam) |
|---|---|---|
| `1` | Smoke grenade | Stun grenade |
| `2` | Flashbang | Frag grenade |
| `3` | Taser (also destroys lights) | Alarm camera — placed on the wall you are looking at, within 3m |

Everything is thrown or aimed from the eye along the camera's facing, so what
you are looking at is what you are throwing at.

Click the canvas to capture the mouse. Bindings are rebindable at runtime via
`input.rebind(action, code)`; the defaults live in `DEFAULT_BINDINGS` in
`src/config.js`.

When a knife, a taser or (as the Warden) a round lands, a small mark
flashes on the screen centre; when you take damage, an arc round the centre
points at where it came from, and the edge of the screen reddens with the
health you have lost.

Every round opens on a **briefing**: your objective in a line, the three
sites by name, and this table for the role you are playing, read from the
live bindings. The round waits until you press any key or mouse button (the
press starts the round and does nothing else). Turn it off with **round
briefing** in the settings menu.

Every round closes on an **end screen**, two and a half seconds after the
round ends (the scene, and the death camera if the last life ended it, stay
up for that long): who took the round and how - the clock, a detonation, a
defuse or the third life - the score, a timeline of the round (the plant,
each life lost and reinsert, each Warden down, the end; five lines at most),
and the table of rounds so far. The match screen says the same of the
match, with a tally of how the winner took its rounds.

### Climbing

There are no affordance markings. If a surface has a top you could stand on and
your body can reach it, you climb it — about 2.6m from standing, about 3.8m out
of a jump. Nothing is tagged and nothing opts out. What reads instead: ducts
are metal against the concrete they run through, and the stairless routes up
are a step brighter than the surfaces beside them, with a pale strip on the
edge each one goes over at the top.

A climb is always a press of Space — walking or falling off an edge climbs
nothing. Below chest height you vault, keeping the speed you brought; above it
you pull yourself up. A press that finds nothing to get over is never silent:
you bump back off the face, your hands go up, and the slap is a noise a Warden
in the room hears.

A climb of a ledge at least 1.4× your height (about 2.6m — one you have to
jump for) starts with a grab of the lip. **Tap Space and you hang there, at full
stretch under the lip; hold Space and you carry on over.** From a hang, Space
pulls up, crouch drops, A/D shimmy along the edge. Anything lower goes straight
over either way — there is nothing worth hanging from. A pull-up with no room
above the lip slaps and leaves you hanging; crouch is the way down.

A press of Space just before you land, or just before a climb ends, still
counts: you jump off the landing or the ledge top. A fall over about a metre
costs something to land — the further, the more — and a big one puts you at
half speed for a moment. The Warden climbs nothing; every place it can stand
was walked to from its spawn, and a bomb is only legal where it could kneel.
All of the numbers are `shade.reach`, `shade.landing`, `shade.camera` and the
`vault*`/`hang*` keys in `src/config.js`; the reasons are D29 in `DECISIONS.md`.

### Debug tooling

| Key | Action |
|---|---|
| `F3` | Toggle the debug overlay |
| `F4` | Toggle test mode |

Test-mode keys are **inert unless the F4 panel is open**, which is what keeps
`1`–`4` from colliding with gadget select during play.

| Key (test mode) | Action |
|---|---|
| `1` `2` `3` | Teleport the Shade to plant site A / B / C |
| `4` | Teleport the Shade behind the Warden (takedown setup) |
| `G` | God mode: the Shade ignores the rifle and the frag |
| `H` | Kill the Shade instantly (exercises reinsert) |
| `J` | Instantly plant the charge |
| `K` | Cycle the Warden's FSM state |
| `L` | Refill all gadgets |
| `T` | Cycle time scale: 1x → 0.25x → 4x |
| `Y` | Run the full AUTO suite, printing pass/fail per check to the console |
| `U` | Run **only** the regression set: Section 16's checks 1, 3, 9, 13, 17, 20, 22, 23, 27, plus the redesign's own checks by id (`CONFIG.debug.regressionChecks`: the census, the routes, the tap and the hold, the Warden on its ground, the traversal fuzz) |

`U` is the one to run after a change. It resolves the spec's named regression
set to the AUTO checks that cover those numbers, adds the named ones, and says
out loud if any of them has no cover rather than quietly skipping it. The set
is the same 29 checks on every map (D7): the clauses that named the plant's
geometry are held by checks that search whatever map the page is on
(`src/tests/anymap.js`), and the plant's named cases stay in `Y`.

A test-mode command whose subsystem has not been built yet reports
`no handler yet` in the panel rather than silently appearing to work.

All debug tooling is behind the gate `SETTINGS.debug` (seeded from
`CONFIG.settings.defaults.debug`, which is `false`): `?debug=1` on the URL or
the settings menu's **debug tooling** row turns it on; off, every binding
above is inert and `?mode=freeroam` boots the ordinary match (the menu's
Free roam button still works). The AUTO suite turns the gate on for the
length of a run and puts it back, so `BLACKLINE.debugTools.runAutoTests()`
from the console works in either build, and so does `npm run suite`.

---

## Where to tune

**`src/config.js` is the single source of truth for every tuning number.** No
magic numbers live anywhere else. The file is organised by spec section:

| Section in `config.js` | Covers |
|---|---|
| `time` | Fixed timestep, frame clamp, time-scale cycle |
| `render` | FOV, fog, shadow map size and frustum, outline scale, toon steps |
| `palette` | Every colour in the game |
| `shade` | Speeds, gravity, slide, **`reach`** (how high this body can climb), camera rig |
| `warden` | Speeds, respawn delay, first-person camera |
| `detection` | Light sampling interval, ray cap, smoothing, `scoreScale` |
| `noise` | Every noise radius and event lifetime |
| `combat` | Gun ballistics, spread, recoil, reload, knife arcs |
| `finisher` | Cinematic beat timings and the wall-clock restore timeout |
| `gadgets` | All six gadgets, plus shared throw physics |
| `round` | Round timer, plant / defuse / detonation times, milestones |
| `reinsert` | Lives, reinsert delay, spawn scoring, wall-clock guard |
| `match` | Best-of-N lengths |
| `ai` | FSM timings, perception cone, burst sizes, difficulty presets (what each is worth in seconds is in D33 and measured by `each-difficulty-is-quicker-to-see-you-and-quicker-to-kill-you`) |
| `map` | Dimensions, vertical layout, shadow casters, plant-site rings, lighting |
| `audio` | Synthesis parameters for every sound |
| `effects` | Pool sizes, ragdoll damping, footprint fade, impact sparks |
| `hud` | Meter sizes, kill feed, crosshair scaling |
| `performance` | The 60fps frame budget and the check-29 benchmark |
| `debug` | Overlay refresh rate, assertion throttling |

`CONFIG` is deep-frozen at load, so a stray assignment fails loudly instead of
silently retuning the game.

### `SETTINGS` vs `CONFIG.settings.defaults`

Runtime-adjustable settings — mouse sensitivity, volume, match length,
difficulty, invert Y — live in the **mutable `SETTINGS` export**. That is the
one to read if you want what the player has chosen.

`CONFIG.settings.defaults` holds only the values `SETTINGS` is seeded with. The
two used to sit at the same level, and reading `CONFIG.settings.difficulty`
where the live value was meant compiled fine, looked right, and returned the
default forever — so the settings menu changed a label and nothing else. The
defaults are nested now specifically so that mistake has no name to reach for.

**Read `SETTINGS.x` for the live value. `CONFIG.settings.defaults.x` is a seed,
not state.**

### Randomness

There is exactly one PRNG (mulberry32), exported as `rng` from `config.js`.
`Math.random()` appears nowhere in `src/`. The seed is set once per match in
`initMatch()` and shown in the F3 overlay.

---

## Architecture

Strict downward-only layering. Circular imports are the most common structural
failure in a no-bundler ES module project, so the rule is enforced by hand:

```
ui/        may import from systems, entities, config
systems/   may import from entities, physics, config
entities/  may import from physics, config
map.js     may import from physics, config
physics.js may import from config only
input.js   may import from config only
config.js  imports nothing
main.js    may import from anything (it is the composition root)
```

No module imports `main.js`. Cross-system messages go through a small event
emitter created in `main.js` and passed down — never through sibling imports.
The composition root's own pieces beside it — `view.js`, `loop.js`,
`timestep.js`, `matchstate.js`, `cameraowner.js`, `intents.js`, `loadout.js`,
`wiring.js`, `hudstate.js`, `debugfields.js`, `harness.js` — import config
only and are imported by `main.js` alone; `panels.js` (the HUD, scoreboard
and menu, and their buttons) imports `ui/` as well. Any module past ~600 lines is split
(`config.js`, a table, excepted); a check in the AUTO suite holds the line.
