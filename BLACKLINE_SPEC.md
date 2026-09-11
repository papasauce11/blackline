# BLACKLINE — Build Specification v1.1

**Status:** Scope frozen. Do not add features not listed here.
**v1.1 changes:** Shade now has 3 lives per round with timed reinsert. Shadow policy added. Visibility now drives visual feedback on the Shade. Seeded RNG required. Affordance markings added to traversal and objectives.
**Working title:** Blackline
**Factions:** Shades (agent) vs Wardens (enforcer)

---

## 1. Overview

An original asymmetric stealth-vs-shooter. One human player controls a Shade (third person, agile, lightly armed, one life per round). One AI opponent controls a Warden (first person, heavily armed, respawns). The Shade must plant an explosive charge at one of three sites and let it detonate. The Warden must kill the Shade or defuse the charge.

Genre inspiration is acknowledged. All names, geometry, art, audio, and copy in this build must be original. Do not reference or reproduce any existing commercial game's names, characters, logos, level layouts, UI, or audio.

---

## 2. Non-negotiable constraints

| Constraint | Detail |
|---|---|
| Engine | Three.js only, loaded via CDN import map |
| Version pinning | Pin **one** specific Three.js release (r160 or later) in the import map. Record it in the README. Before writing rendering code, verify the API names for that exact version rather than recalling them. Three.js has renamed public API across releases (colour space handling, lighting flags, geometry classes). Assume nothing, check |
| Build step | None. `index.html` plus ES modules, served by any static server |
| External assets | Zero. No images, no models, no audio files, no fonts beyond system stack |
| Geometry | Primitives and procedural geometry only (Box, Cylinder, Capsule, Sphere, Plane, Lathe, ExtrudeGeometry) |
| Audio | Web Audio API synthesis only |
| Input | Keyboard and mouse. Pointer lock |
| Target | 60fps on integrated graphics at 1080p |
| Deployment | Static, Vercel-compatible with no config |
| Randomness | One seeded PRNG (mulberry32 or equivalent) exported from `config.js`. Every random call in the codebase routes through it. `Math.random()` must not appear anywhere in `src/`. Seed is set at match start and shown in the debug overlay so any bug can be reproduced |

---

## 3. File structure

```
index.html
src/
  main.js              boot, render loop, mode router
  config.js            ALL tuning constants, single source of truth
  input.js             keyboard/mouse, pointer lock, rebindable map
  map.js               level geometry, collision volumes, spawns, sites, lights
  physics.js           swept AABB collision, gravity, ground checks
  entities/
    agent.js           Shade controller (third person)
    enforcer.js        Warden controller (first person, shared by AI and free-roam)
  systems/
    detection.js       light sampling, visibility meter, noise emitters
    ai.js              Warden FSM, waypoint navigation, perception
    combat.js          hitscan, damage, death, takedown, finisher cinematic
    gadgets.js         effect registry, all six gadget types
    objective.js       plant, defuse, round state machine, scoring
    audio.js           synthesized SFX bus
    effects.js         ragdoll-lite, footprints, particles, object pools
  ui/
    hud.js
    menu.js
    scoreboard.js
```

`config.js` is mandatory. Every number in this document lives there as a named constant. No magic numbers anywhere else in the codebase.

### 3.1 Module dependency rules

Circular imports are the most common structural failure in a no-bundler ES module project. Enforce a strict layering. Imports may only flow downward.

```
  ui/          may import from systems, entities, config
  systems/     may import from entities, physics, config
  entities/    may import from physics, config
  map.js       may import from physics, config
  physics.js   may import from config only
  input.js     may import from config only
  config.js    imports nothing
  main.js      may import from anything (it is the composition root)
```

- No module may import `main.js`
- Cross-system communication (for example combat notifying audio) goes through a small event emitter created in `main.js` and passed in, never through direct sibling imports
- Any module exceeding roughly 600 lines gets split. Long files are where bugs hide

### 3.2 No stubs

A phase is complete only when its systems are functionally complete. Do not write placeholder functions, `// TODO` markers, empty handlers, or hardcoded return values with the intent of filling them in later. If a phase cannot be completed as specified, stop and say so rather than stubbing it and reporting progress.

---

## 4. Art direction

Stylized cartoon realism. Saturated palette, strong rim lighting, exaggerated proportions. Readable silhouettes above all else.

| Element | Direction |
|---|---|
| Shading | `MeshToonMaterial` with a 4-step gradient map generated in code via `DataTexture` |
| Outlines | Inverted-hull technique. Duplicate mesh, `BackSide`, scaled 1.03, flat dark material |
| Shade silhouette | Lanky. Tall capsule torso, long limbs, small head, oversized boots and gloves. Teal and charcoal |
| Warden silhouette | Bulky. Wide box chest, short legs, helmet dominates head, heavy pauldrons. Orange and gunmetal |
| Environment | Industrial substation. Concrete grey base, orange hazard stripes, teal emergency signage |
| Lighting | One dim hemisphere ambient, 12 destructible point lights, 2 directional fills. High contrast between lit pools and dark gaps is the core visual language |
| Fog | Exponential, low density, matched to ambient. Sells depth and hides draw distance |

Do not attempt facial features, hair, cloth, or rigged skeletal animation. Animate by rotating and translating primitive limb groups procedurally.

### 4.1 Shadow policy (performance critical)

Twelve shadow-casting point lights will destroy the framerate. Do not do it.

- The 12 destructible point lights cast **no** shadows. `castShadow = false` on all of them
- Exactly **one** directional light casts shadows, at 1024x1024, with a tight frustum fitted to the play area
- Contact darkness and ambient occlusion are faked with baked vertex tint on floor and wall geometry, applied once at map build time
- Character grounding is sold with a single flat dark circle mesh under each actor, scaled by height off the ground

### 4.2 Visibility feedback (must match the meter)

The visibility meter and what the player sees on screen must never disagree. If the meter reads "hidden" while the character looks brightly lit, the player will stop trusting the mechanic and the entire stealth loop fails.

- The Shade's rim light intensity and outline brightness are driven directly by the smoothed visibility value each frame
- At visibility 0 the Shade is a near-black silhouette with a faint teal edge. At visibility 100 the Shade is fully lit with a bright rim
- This is a per-frame material uniform update on the Shade only. It is not optional polish, it is the readability of the core mechanic

---

## 5. Map spec: "Meridian Substation"

Two floors, roughly 60m x 45m footprint. Blocked out entirely from boxes.

**Ground floor**
- Turbine Hall: large open bay, brightly lit, plant site A. High risk, fast approach
- Loading Bay: medium, mixed light, plant site B, two roller doors, stacked crates for vaulting
- Corridor ring connecting both, with four alcoves and three destructible ceiling lights

**Upper floor**
- Server Vault: tight, dark, plant site C. Lowest light, longest approach
- Catwalks overlooking Turbine Hall, mantle-accessible from crates
- Two office rooms with waist-high cover

**Traversal**
- 3 vent runs (crouch-only, silent, connect ground corridor to upper catwalks)
- 2 ladder-free mantle routes (crate stack to catwalk)
- 1 drop-down shaft, one-way, ground to upper is blocked

**Placements**
- Shade spawn: 1 fixed, ground floor perimeter, dark
- Warden spawns: 4, distributed, used for respawn selection furthest from last known Shade position
- 12 destructible point lights, each with a `lightId`, an emissive fixture mesh, and a break state
- 14 AI waypoints with explicit bidirectional links, covering both floors and all three sites

**Affordance markings (readability, not decoration)**

The player cannot use traversal they cannot see. Every interactive surface is visually marked at map build time:

| Element | Marking |
|---|---|
| Vaultable ledge (0.4m to 1.2m) | Thin emissive stripe along the top edge, faction teal, low intensity |
| Mantle ledge (1.2m to 2.4m) | Same stripe, brighter, plus a subtle chevron decal on the face below |
| Ledge-hang edge (above 2.4m) | Same stripe, dashed pattern |
| Vent entrance | Interior lit with a dim self-illuminated panel so the run reads as passable from outside |
| Plant site | Flat ring decal on the floor, 2m diameter, hazard orange, pulsing slowly |
| Destructible light | Fixture mesh has a visible glass element that changes to a cracked dark material when broken |

All markings are generated procedurally from the same flags that drive the collision logic. A ledge is marked because it is flagged vaultable, never marked by hand. If the flag and the marking can drift apart, the implementation is wrong.

---

## 6. Roles and controllers

### 6.1 Shade (human, third person)

| Property | Value |
|---|---|
| Camera | Third person, orbit offset 2.2m back / 1.4m up, collision-aware pullback |
| Health | 100. Three lives per round, timed reinsert. See Section 10.2 |
| Walk | 3.5 m/s |
| Crouch | 1.6 m/s |
| Sprint | 6.5 m/s |
| Jump | 4.5 m/s initial |
| Vault | Obstacles 0.4m to 1.2m. Triggered by forward input plus sprint into a flagged ledge |
| Mantle | Ledges 1.2m to 2.4m. Auto-triggered when airborne near a flagged ledge |
| Slide | From sprint plus crouch. 8.0 m/s initial, decays over 0.8s. Lowers capsule to vent height |
| Ledge hang | On failed mantle above 2.4m, grab and hang. Pull up with jump, drop with crouch |

**Parkour safety rule:** every vault, mantle, slide, and pull-up must validate the destination capsule is clear of geometry *before* committing. If blocked, abort the move and return to the previous state. Never teleport a player into unvalidated space.

### 6.2 Warden (AI-controlled, and human-controlled in free-roam only)

| Property | Value |
|---|---|
| Camera | First person |
| Health | 100. Respawns 12s after death at the spawn furthest from the Shade's last known position |
| Walk | 3.0 m/s |
| Sprint | 5.0 m/s |
| ADS | 1.8 m/s, tighter spread, narrower FOV |
| Crouch | Not available. Wardens are heavy |

---

## 7. Detection systems

### 7.1 Light and visibility

The Shade has a visibility meter, 0 to 100.

- Sample every 100ms, not every frame. Cache the result between samples
- Cast a maximum of 5 short rays from the Shade's torso toward each active point light within 20m
- Score contribution per light = `intensity * (1 - distance/range) * unobstructedRayFraction`
- Sum, clamp to 0-100, then smooth toward the target over 250ms so the meter does not flicker
- Crouching applies a 0.75 multiplier. Prone is not in scope
- **When a light is destroyed, immediately invalidate the cache.** Do not wait for the next sample tick

Visibility feeds directly into AI detection speed. It is not merely cosmetic.

### 7.2 Noise

Every movement emits a noise event with a world position and a radius. The AI hearing check is a simple distance test against active noise events.

| Actor and stance | Noise radius |
|---|---|
| Shade crouch-walk | 0 (silent) |
| Shade walk | 4m |
| Shade sprint | 12m |
| Shade landing (fall > 2m) | 10m |
| Shade slide | 6m |
| Shade in vent | 0 |
| Warden walk | 8m |
| Warden sprint | 18m |

Gunfire is 45m. Gadget detonations are 30m. Destroying a light is 20m. Planting emits 15m on a 1s interval.

Noise events live for 0.4s then expire. The Shade being quieter than the Warden is a core design pillar and must be preserved in tuning.

---

## 8. Combat

### 8.1 Warden machine gun

| Property | Value |
|---|---|
| Type | Hitscan |
| Magazine | 30 |
| Rate | 600 rpm |
| Damage | 25 at 0-15m, falling linearly to 12 at 30m |
| Headshot | 2.0x multiplier |
| Spread | 0.6 deg base, grows 0.25 deg per shot to a 4.0 deg cap, recovers 3.0 deg/s |
| Recoil | Vertical climb with mild horizontal drift, partially recovers between bursts |
| Reload | 2.2s |

Four body shots kill a Shade. Time-to-kill is fast on purpose: the Shade's defence is not being seen.

### 8.2 Shade knife

- Front or side arc: 2 hits to kill, 0.5s between swings, loud (12m noise)
- Rear arc (Warden facing away, within 100 deg cone behind, range 1.8m): instant takedown, triggers finisher

### 8.3 Takedown finisher cinematic

Instant trigger, cinematic payoff. Total duration 1.2s.

| Beat | Timing | Effect |
|---|---|---|
| Hit-stop | 0 to 0.08s | Time scale drops to 0.05 |
| Slow-mo | 0.08 to 0.9s | Time scale 0.25, camera detaches and orbits 40 deg around the pair at 1.8m |
| Snap-back | 0.9 to 1.2s | Time scale eases to 1.0, camera lerps back to the standard third-person rig |

Audio: a low impact thud, a brief filtered noise sweep, and a single sub-bass hit.

**Hard safety requirement:** the finisher is a state in the round state machine with a wall-clock timeout of 1.5s. On timeout, force-restore camera parent, camera FOV, time scale, and input handling regardless of animation progress. Never allow the cinematic to own the only path back to normal play.

---

## 9. Gadgets

All gadget effects are managed by a single central registry in `gadgets.js`. Each active effect is an object with a start timestamp and duration, ticked once per frame from one loop. **Do not use `setTimeout` for any gameplay-affecting timer.**

### 9.1 Shade loadout

| Gadget | Count | Effect |
|---|---|---|
| Smoke grenade | 2 | 8s cloud, 5m radius. Blocks AI line of sight entirely. Renders as a capped 200-sprite pool on one shared material |
| Flashbang | 2 | 4s effect. AI perception hard-disabled if it had line of sight to the detonation. If the player has line of sight, screen whites out and fades with a ringing tone |
| Taser | 1 charge, recharges over 25s | 6m range, requires line of sight. Stuns the Warden for 3s (no movement, no fire). Also permanently destroys a targeted light |
| Knife | Unlimited | See 8.2 |

### 9.2 Warden loadout (AI use)

| Gadget | Count | Effect |
|---|---|---|
| Stun grenade | 2 | 2.5s. Slows the Shade to 40% speed and blurs the screen. Non-lethal |
| Frag grenade | 2 | 60 damage at the centre, falling to 0 at 6m. Line of sight required for full damage |
| Alarm camera | 1 per round | Placed on a wall. 8m radius, 100 degree cone. On detecting the Shade: loud two-tone siren, HUD ping for the Warden, and the Shade is marked on the Warden's HUD for 2s. Destructible by gunfire, taser, or knife. **Renders no live camera feed. It is a proximity alarm, not a second viewport** |

**Grenade physics:** raycast between the previous and current position every physics step to prevent tunnelling through walls.

---

## 10. Objective and round flow

### 10.1 Round

- Base timer: 240s
- The Shade carries a charge from spawn. Plant takes a 4s hold **anywhere in a site's room** (amended - see 20) - not only inside the ring, which labels the room rather than marking a spot
- Once planted, the charge detonates after 45s. Detonation = Shade wins the round
- Once planted, the charge sits **where it was planted**. The Warden can defuse with an 8s hold, standing at the charge itself
- Defusing can be interrupted and the progress is retained for 5s, then decays

### 10.2 Shade lives and reinsert

The Shade has **3 lives per round**. Dying is a setback, not an instant loss.

| Rule | Detail |
|---|---|
| Reinsert delay | 15s. A countdown is shown, with a free-look death camera on the killing Warden |
| Reinsert location | The spawn point furthest from the Warden's current position, never the one just used |
| Reinsert state | Full health. Gadget counts are **not** refilled. Taser recharge continues running |
| Charge | If unplanted, the charge respawns with the Shade. If already planted, the plant stands |
| Plant progress | Partial plant progress is lost on death |
| Warden knowledge | The Warden's detection accumulator resets to 0 and it drops to SEARCH at the death location, not at the reinsert point |
| Round loss | Losing the third life ends the round for the Shade, unless the charge is already planted |

HUD shows remaining lives at all times. Losing a life plays a distinct low descending tone.

Not refilling gadgets on reinsert is deliberate. It means dying still costs you something real, so the tension survives having three lives.

### 10.3 Time extensions (milestones)

| Milestone | Extension |
|---|---|
| First successful plant | +45s (the detonation clock becomes the effective timer) |
| First Warden takedown by the Shade | +30s |

Each milestone fires at most once per round. Deaths do not affect the clock.

### 10.4 Win conditions

| Outcome | Winner |
|---|---|
| Charge detonates | Shade |
| Charge defused | Warden |
| Shade loses all 3 lives before planting | Warden |
| Shade loses all 3 lives after planting | Round continues. Warden must still defuse before the detonation clock |
| Timer expires with no plant | Warden |

### 10.5 Match

- Best of 5 by default (first to 3). Best of 11 selectable in the menu (first to 6)
- No side swap. The human is always the Shade
- Scoreboard between rounds: round number, winner, round duration, takedowns, plant site used
- `resetRound()` rebuilds every mutable state object from a defaults factory. Nothing carries between rounds except the score

---

## 11. Warden AI

Finite state machine. No pathfinding library. Navigation is a 14-node waypoint graph with explicit links, walked with A-star over the graph.

| State | Entry | Behaviour | Exit |
|---|---|---|---|
| PATROL | Default | Walk a randomised waypoint circuit, pausing 2-4s at nodes, scanning left and right | Noise heard, or detection accumulator > 40 |
| SUSPICIOUS | Noise heard | Stop, turn toward the noise, hold 1.5s | Move to INVESTIGATE, or back to PATROL |
| INVESTIGATE | From suspicious | Path to the noise position, scan on arrival for 4s | Visual contact, or timeout to SEARCH |
| ENGAGE | Detection accumulator = 100 | Sprint to effective range, fire in bursts, use cover, throw a frag if the Shade is static for 2s | Line of sight lost for 2.5s |
| SEARCH | Lost target | Check 3 nearest waypoints to the last known position over 15s, throw one stun grenade into a likely hiding spot | Timeout to PATROL, or re-acquire |
| DEFEND | Charge planted | Path directly to the charge, defuse if the Shade is not visible, break off to ENGAGE if fired upon | Round end |
| STUNNED | Taser or stun grenade | No input for the duration | Timer expiry, to SEARCH |

**Perception:** 90 degree cone, 25m range, requires an unobstructed ray. A detection accumulator fills 0 to 100. Fill rate = `base * visibilityMeter/100 * (1 - distance/25) * movementMultiplier` where the movement multiplier is 1.0 crouched, 1.6 walking, 2.4 sprinting. Drains at 15/s when there is no line of sight.

**Stuck handling:** if the AI's position changes less than 0.3m over 2s while in a moving state, force a re-path from the nearest waypoint. Log it to the debug overlay.

**Difficulty:** three presets in `config.js` adjusting accumulator fill rate, aim error cone, and reaction delay. Default is medium: 120ms reaction delay, 2.5 degree aim error.

---

## 12. Free-roam mode

A separate menu entry. Loads the same map with `initMatch({ mode: 'freeroam', role: 'warden', ai: false, objective: false })`.

- The human controls a Warden in first person
- No AI opponent, no objective, no timer, no score
- Unlimited ammo and gadgets, instant recharge
- Purpose: weapon feel, gadget testing, map learning
- Both modes must boot through the same `initMatch(config)` entry point. Free-roam is a configuration, never a duplicated code path

---

## 13. HUD and menus

**Shade HUD:** visibility meter (vertical bar, left), health, **lives remaining (3 pips, dimming as they are spent)**, gadget counts with taser recharge ring, objective prompt, round timer, charge state, kill feed, round score. On death, a reinsert countdown replaces the centre of the HUD.

**Warden HUD (free-roam):** crosshair with dynamic spread, ammo, gadget counts, health.

**Menus:** main menu (Play, Free Roam, Settings), settings (mouse sensitivity, match length 5 or 11, difficulty, master volume), round intermission scoreboard, match end screen.

Style: flat, high contrast, minimal. Faction colour accents. No skeuomorphism, no heavy borders. HUD is DOM overlay, not rendered in the 3D scene.

**Audio gate:** the main menu Play button is the first user gesture. Initialise `AudioContext` there. Never attempt to create or resume audio before a click.

---

## 14. Audio spec

All synthesized. One master gain, three buses: SFX, ambience, UI.

| Sound | Synthesis approach |
|---|---|
| Footstep, Shade | Short filtered noise burst, high-pass 800Hz, 25ms, low gain. Silent when crouched |
| Footstep, Warden | Noise burst, low-pass 400Hz, 60ms, plus a metallic click transient. Noticeably heavier and louder |
| Gunfire | Noise burst plus a fast low-pass sweep, 90ms, with a short convolution-free tail via delayed lower-gain copies |
| Knife swing | Filtered noise whoosh |
| Takedown impact | Sub-bass sine thud at 55Hz plus a mid noise crack |
| Taser | Rapid square wave burst around 120Hz with amplitude modulation |
| Smoke | Sustained noise with a slow low-pass sweep over 1.5s |
| Flashbang | Sharp white noise transient plus a 4kHz sine that decays over 4s (the ring) |
| Grenade | Low noise burst with a pitched-down tail |
| Alarm camera | Two-tone siren, alternating 660Hz and 880Hz square waves |
| Plant beeps | Single 1200Hz blip, interval shortening as the detonation timer runs down |
| Detection tension | A low sine pad that fades in as the AI detection accumulator rises above 50 |

Every sound is spatialised with `PannerNode` except UI and the tension pad.

---

## 15. Risk register (code against these explicitly)

| Risk | Required mitigation |
|---|---|
| Player falls through the floor | Fixed timestep at 60Hz with an accumulator. Swept AABB collision. Never integrate with raw frame delta |
| Vault or mantle clips into geometry | Validate the destination capsule is clear before committing. Abort on block |
| Camera state leaks between roles or after the finisher | One camera object. Reparent and adjust FOV only. Never instantiate a second camera. Finisher has a hard wall-clock restore |
| Light sampling tanks framerate | 100ms sample interval, 5 ray cap, cached between samples |
| Destroyed light does not update visibility | Breaking a light calls an explicit cache invalidate |
| AI stuck on corners | Waypoint graph only. Stuck timer forces re-path |
| Gadget effects stack or never expire | Single central effect registry, ticked from one loop. No `setTimeout` |
| Grenades tunnel through walls | Raycast between previous and current position each physics step |
| Audio blocked by autoplay policy | Initialise `AudioContext` on the menu Play click |
| Smoke and particles tank framerate | Hard cap of 200 sprites, one shared material, object pooled |
| Footprint trails leak memory | Fixed pool of 60 decals, oldest recycled, fade over 6s |
| Ragdoll goes unstable | Ragdoll-lite only: disable the controller, apply a single impulse, tumble limb groups with damped angular velocity, freeze after 2s. Do not build a real physics solver |
| Round state bleeds into the next round | One `resetRound()` rebuilding all mutable state from a defaults factory |
| Free-roam diverges from competitive | Single `initMatch(config)` entry point |
| Shadow-casting point lights destroy the framerate | Point lights never cast shadows. One shadowed directional light only. See Section 4.1 |
| Reinsert leaves stale state (dead flag, ragdoll, camera on the death cam) | Reinsert runs a `respawnShade()` that resets controller state, clears the ragdoll, reparents the camera to the standard rig, and re-enables input, with a hard wall-clock guard like the finisher |
| Reinsert spawns the Shade in the Warden's face | Spawn selection scores all candidates by distance from the Warden and excludes the most recently used spawn |
| Visibility material update runs before the meter is sampled | The material uniform reads the smoothed value, which always has a valid cached result. Initialise the cache at spawn, never null |
| Affordance markings drift out of sync with collision flags | Markings are generated from the same flags the collision logic reads, at map build time, in one pass |

---

## 16. Test script

Run in order. All must pass before the build is considered done.

**Verification classes.** Every check below is one of three kinds. Report each check with its class and never claim to have observed something you could not observe.

| Class | Meaning | Who runs it |
|---|---|---|
| **AUTO** | Verifiable by code: a runtime assertion, a headless console check, a static grep, or a scripted state-machine exercise | The agent, and it must actually be run |
| **ASSUMED** | The implementation looks correct on inspection but was not observed at runtime | The agent, clearly labelled as unverified |
| **HUMAN** | Requires a person looking at a screen and using a mouse. Feel, readability, visual correctness | Josh only |

Checks 1 to 7, 13 to 16, and 26 to 27 are **HUMAN**. The agent must not report these as passing. Present them as a checklist for me to run, with a note on what to look for.

Checks 17, 18, 22, 23, 25, 28, and 29 are **AUTO**. Build the harness needed to actually run them (see Section 17.1 test mode) rather than reasoning about them.

**Movement**
1. Sprint into a wall at full speed. No clipping, no jitter
2. Vault a 1.0m crate. Lands clean
3. Mantle to a catwalk. Lands clean
4. Attempt a mantle with a wall directly above the ledge. Move aborts, no clipping
5. Slide into a vent. Capsule lowers, passes through
6. Fail a mantle above 2.4m. Ledge hang triggers. Pull up and drop both work
7. Fall 8m. Landing noise fires, no floor clip

**Detection**
8. Stand in Turbine Hall under lights. Meter reads above 70
9. Stand in the Server Vault. Meter reads below 25
10. Shoot out a light while standing under it. Meter drops within 200ms
11. Crouch-walk within 5m of a patrolling Warden. It does not react
12. Sprint within 15m of a patrolling Warden. It enters SUSPICIOUS then INVESTIGATE

**Combat**
13. Approach a Warden from behind. Takedown triggers, finisher plays, control returns cleanly within 1.5s
14. Approach a Warden from the front. Takedown does not trigger. Knife requires 2 hits
15. As Warden in free-roam, fire a full magazine. Spread grows, recoil climbs, reload works
16. Die to the Warden before planting. Round ends, Warden scores

**Gadgets**
17. Throw each of the six gadget types. Each applies its effect and expires cleanly. Effect registry returns to zero active
18. Throw a frag at a wall. It does not pass through
19. Place an alarm camera in free-roam, walk into its cone. Siren fires. Destroy it. Siren stops

**Round flow**
20. Plant a charge. Timer extends by 45s. Let it detonate. Shade wins
21. Plant a charge. Let the AI defuse it. Warden wins
22. Complete a full best of 5 match. Scoreboard is accurate. Round 2 starts with zero state carried over

**Lives and reinsert**
23. Die as the Shade. Death camera shows the killer, countdown runs 15s, reinsert happens away from the Warden, HUD pips decrement, control is fully restored
24. Die with gadgets partially spent. Counts do not refill on reinsert
25. Lose all 3 lives before planting. Warden wins the round. Lose all 3 after planting. Round continues

**Readability**
26. Every vaultable, mantle-able, and hang-able ledge on the map is visibly marked. Walk the map and confirm no unmarked usable ledge exists
27. Stand in bright light then walk into shadow. The character visibly dims in step with the meter, with no lag or disagreement between the two
28. Confirm the debug overlay shows the match seed, and that restarting with the same seed reproduces identical AI patrol order

**Performance**
29. Trigger smoke, a flashbang, sustained gunfire, and a ragdoll simultaneously. Framerate stays at or above 60 on integrated graphics

**Regression set after any patch:** 1, 3, 9, 13, 17, 20, 22, 23, 27.

---

## 17. Debug tooling

Toggle with F3. Overlay showing: FPS, frame time, match seed, visibility meter raw and smoothed, Shade lives remaining, AI state, AI detection accumulator, active effect count, active noise events, player position and velocity, AI stuck counter, shadow-casting light count (must read 1).

Runtime assertions in the debug build:
- Player Y is never below the floor plane minus 0.5
- Position and velocity never contain NaN
- Active effect count returns to 0 within 10s of the last gadget expiring
- The round state machine is in exactly one valid state

### 17.1 Test mode (build this in Phase 1, not at the end)

Toggle with F4. Without it, verifying phase 9 means playing a full four minute round every time, which neither of us will do properly.

| Key | Action |
|---|---|
| 1 / 2 / 3 | Teleport the Shade to plant site A / B / C |
| 4 | Teleport the Shade to the Warden's current position, facing away (takedown setup) |
| G | God mode toggle for the Shade |
| H | Kill the Shade instantly (exercises reinsert) |
| J | Instantly plant the charge |
| K | Force the Warden into a chosen FSM state, cycling on each press |
| L | Refill all gadgets |
| T | Time scale cycle: 1x, 0.25x, 4x |
| Y | Run the AUTO test suite and print results to the console |

Test mode is gated behind a `DEBUG` flag in `config.js`, defaulting to true during development. All bindings are inert when the flag is false.

The `Y` suite is the deliverable for the AUTO checks in Section 16. It drives the game through scripted state transitions and asserts outcomes, printing a pass/fail line per check.

---

## 18. Definition of done

- [ ] Runs from a static server with no build step
- [ ] Zero console errors and zero warnings during a full match
- [ ] Holds 60fps on integrated graphics during a smoke plus flashbang plus gunfire moment
- [ ] All 29 test script checks pass
- [ ] Every tuning number lives in `config.js`
- [ ] `Math.random()` appears nowhere in `src/`
- [ ] Exactly one shadow-casting light in the scene
- [ ] No external asset requests in the network tab beyond the Three.js CDN
- [ ] A best of 5 match completes end to end with an accurate scoreboard
- [ ] `README.md` documents controls, how to run, and where to tune

---

## 19. Explicitly out of scope for v1

Online multiplayer. Human-controlled Warden in competitive play. Vision modes (night vision, motion tracker). Live camera feeds. Multiple maps. Progression, unlocks, or loadout customisation. Gamepad support. Skeletal animation. Voice lines. Wall-running. Prone.

Do not implement any of the above. If a system seems to require one of them, stop and flag it rather than building it.

---

## 20. Amendments

Changes to the spec made after the original build, each with the reason. The
sections above carry the amended rule; this is the record of what moved and why.

### 20.1 Section 10.1 - the plant is a room, not a circle

> *"able to plant the bomb anywhere in the room. not just in the circle."*

The plant needed the body within 2m of a site's centre. That made the hazard
ring a target rather than a label: three circles on a whole map, and a Warden
who only ever had to watch three square metres of floor. The room is the unit
the objective is about.

| | Before | After |
|---|---|---|
| Plant zone | 2m radius of the site centre | The site's room, floor to ceiling |
| Which room | - | Derived by containment from the site position, never declared twice |
| Charge position | The site centre | Where the Shade was standing |
| Defuse | 2m of the site centre | 2m of the charge - unchanged in size, it is arm's length, not a marking |
| Site ring | Says "plant here" | Says "this room" |

Site C sits on the upper deck directly above the Loading Bay, so the room's own
floor and ceiling do the vertical separation that a hardcoded 2.5m tolerance
used to: standing under a floor is not standing in the room above it.

Consequences worth knowing. The Warden can no longer camp a circle - it has to
search a room, and after a plant it paths to the charge's actual position. The
ring's meaning has changed under it, and whether a room-sized marking now reads
better than a 2m ring is an open question, not a settled one.

**Agreed, not yet built:** the room is too generous on its own. The Warden stays
grounded and the Shade climbs, so a plant on a gantry, crate stack, vent roof or
deck lip inside the room is one no Warden can ever kneel at. The plant zone
becomes *"anywhere in the room a Warden could stand and defuse"* - derived from
the defuse check rather than authored a second time. Planned in six phases in
`HANDOFF.md`; until it lands, the rule above is the rule as implemented.

### 20.2 Section 6.1 - a climb is a press of Space, never a side effect of moving

> *"climbing things again without a choice. must press space to climb/vault etc..."*

Section 6.1 said the mantle was "auto-triggered when airborne near a ledge".
Once the reach rule made every standable top within 3.8m a ledge, that meant
walking off any edge while holding forward climbed whatever was in front of you.
The ground path had already been gated on the jump; the airborne path is now
gated the same way.

| | Before | After |
|---|---|---|
| On the ground | Space (buffered) + forward into a face in reach | unchanged |
| In the air, after a jump | any face in reach, every step | unchanged - the press that launched the jump is the choice, for the whole arc |
| In the air, after walking off an edge | any face in reach, every step | nothing, until Space is pressed; a press during the fall arms the rest of it |
| Dropping from a hang | could catch the next ledge down | catches nothing without a fresh press |
| Step-overs (under `reach.stepOver`) | automatic | automatic - that is walking |

The controller carries one flag, `_climbArmed`, set by the jump and by a press
in the air, cleared by a walk-off, a hang drop and a landing. Ledge hang
(Section 6.1's held option, redesign phases 12-18) will read the same press.


### 20.3 Section 10.1 - a plant is legal where a Warden could defuse it, and never inside anything

> *"actually should only be plantable where the ward is able to defuse."*
> *"can't plant 'inside' things. only on top."*

The room (20.1) was too generous on its own, as 20.1 already said. The Warden
stays grounded and the Shade climbs, so inside a site's room there are tops and
ducts where a plant could never be answered. The zone is now carved out of the
room by two mechanical clauses, neither of which names a duct or a crate.

| | Before | After |
|---|---|---|
| Plant zone | The site's room, floor to ceiling | The room, where **a Warden could stand and defuse** (D5) **and the charge is not inside anything** (D20) |
| "Could defuse" | - | The real defuse predicate, `withinDefuseReach`, asked of every cell of the Warden's reachable ground within arm's length: 2.0m horizontally, 2.5m vertically. On *or* beside - a charge on a 2m crate is legal because a Warden beside it reaches up |
| "Not inside" | - | A standing body's worth of open air above the charge (a 0.15m column, `warden.standHeight` tall). A duct fails by its roof; a top, a floor or an open gantry passes by the air above it |
| The Warden's ground | - | Map data (`map.wardenGround`): a 0.5m grid flooded from the Warden spawns with a symmetric step limit, so a one-way drop is not in it (D16) |
| When it is asked | - | Every step of the hold, never at the commit. Progress that never starts is the difference between "not yet" and "never" |
| A refusal | - | A HUD line, "cannot plant here". No sound, no noise event (D6) - a refused plant must not give the Shade away |

What it excludes, measured on the first map (A5): of 373 places a charge can go
inside a site room - 344 floor cells on a 2m grid, 21 climbable tops, 8 duct
interiors - the rule refuses 12. The 8 ducts, by their lid. Three tops, because
the middle of a wide top is further than arm's length from any ground the
Warden can stand on. One deck floor cell in site C, which the Warden's ground
does not reach. The vertical reach on its own refuses nothing; the horizontal
one and the lid do all the excluding.

Consequences worth knowing. A charge on a crate top is a legal plant and the
Warden defuses it from the floor beside the crate. A charge inside a duct is
not, however low the duct - the reason is the lid, not the height, so lowering
a duct does not make it plantable and raising a crate does not make it
illegal until the crate itself leaves the reach. The AI is sent at the charge's
real position, and every legal plant is one it can walk to and kneel at,
which is what the rule was for.
