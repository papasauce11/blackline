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

No build step, no bundler, no npm dependencies. Any static server works.

```bash
npx serve
```

Then open the URL it prints (usually `http://localhost:3000`).

It is a static site, so it deploys to Vercel with no configuration.

### Reproducing a specific match

The match seed is shown in the F3 debug overlay. To replay a seed, append it to
the URL:

```
http://localhost:3000/?seed=2709321559
```

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

### Climbing

There are no affordance markings. If a surface has a top you could stand on and
your body can reach it, you climb it — about 2.6m from standing, about 3.8m out
of a jump. Nothing is tagged and nothing opts out.

A climb of a ledge at least 1.4× your height (about 2.6m — one you have to
jump for) starts with a grab of the lip. **Tap Space and you hang there; hold
Space and you carry on over.** From a hang, Space pulls up, crouch drops, A/D
shimmy along the edge. Anything lower goes straight over either way — there is
nothing worth hanging from.

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
| `G` | God mode |
| `H` | Kill the Shade instantly (exercises reinsert) |
| `J` | Instantly plant the charge |
| `K` | Cycle the Warden's FSM state |
| `L` | Refill all gadgets |
| `T` | Cycle time scale: 1x → 0.25x → 4x |
| `Y` | Run the full AUTO suite, printing pass/fail per check to the console |
| `U` | Run **only** Section 16's regression set (checks 1, 3, 9, 13, 17, 20, 22, 23, 27) |

`U` is the one to run after a change. It resolves the spec's named regression
set to the AUTO checks that cover those numbers and says
out loud if any of them has no cover rather than quietly skipping it.

A test-mode command whose subsystem has not been built yet reports
`no handler yet` in the panel rather than silently appearing to work.

All debug tooling is gated behind `DEBUG` in `src/config.js`. Set it to `false`
and every binding above goes inert.

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
| `ai` | FSM timings, perception cone, difficulty presets |
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
only and are imported by `main.js` alone. Any module past ~600 lines is split
(`config.js`, a table, excepted); a check in the AUTO suite holds the line.
