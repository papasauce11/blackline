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

### 20.4 Section 6.1 - tap Space grabs the ledge, hold Space climbs it

> *"tapping space grabs first always. holding space climbs"*

Section 6.1 made the hang the outcome of a failed mantle above 2.4m. The
redesign removed that (a climb you cannot make does not happen) and left the
hang to be "a held option you choose". This is the option.

Every climb at mantle height - anything above vault height, from the ground or
from the air - starts with a **grab**: a short reach to hanging position below
the lip. What happens next is decided by the key:

| | Tap Space | Hold Space |
|---|---|---|
| Vault-height ledge (up to `reach.vaultTop`) | goes straight over - nothing to hang from | the same |
| Mantle-height ledge | grabs and **hangs** | grabs and **carries on over** |
| From a settled hang | Space pulls up; crouch drops; A/D shimmy | |

The tap window is the grab (`hangGrabDuration`, 0.18s) plus `hangHoldDelay`
(0.12s) after the hand lands - 0.30s from key-down. A key still down at the end
of it is a hold; released before it, a hang. A fresh press from a settled hang
pulls up at once. (At first the grab alone was the window, and a 250ms tap -
an ordinary press of a spacebar - went over; 2026-09-17.)

Consequences. A grab that has no room below the lip (a ledge too low to hang
from, something under it) goes straight over, so a low mantle is never
unclimbable for being unhangable. A hang lasts as long as nothing is pressed;
letting go is a crouch, and the fall catches nothing without a fresh press
(20.2). The climb rule itself - standable top within reach - is untouched;
this only changes what one press asks for.

Amended the same night: *"shouldnt be able to hang on anything shorter than
1.4x the height of the shade from the vault position."* A grab is only offered
on a ledge at least `hangMinHeightRatio` (1.4) Shade-heights - 2.59m - above
the surface the climb started from. Below that a mantle-height ledge goes
straight over on tap or hold alike, as it did before 20.4; a hang is for a
ledge you had to jump for.

### 20.5 Section 6.1 - a failed climb is never silent

> *"Failed climb: a physical tell plus audio. Never silent."* (the redesign
> interview, 2026-09)

A press of Space that carries the hands onto a face they cannot get over -
too tall for the reach the body has right now (2.6m standing, 3.8m with the
jump behind it), a lip with no room above it, a face with nothing standable
on top - is a **failed climb**, and it is felt and heard: the body is pushed
straight back off the face at `scuffBumpSpeed` and stops rising, both arms
are thrown up for `scuffPoseTime`, and a short slap (`audio.scuff`) plays
where the hands hit. One tell per press. A pull-up from a hang whose
destination is blocked gives the arms and the slap without the push; letting
go remains the crouch key's job (20.4). A walk-off into a face with nothing
pressed is not a climb (20.2) and gets no tell.

The slap is the player's audio, and (D23, 2026-09-12) also a **noise** in
Section 7.2's sense: a footstep's worth, `noise.radii.shadeScuff`, placed
where the hands hit - up the wall, not at the feet, so on the floor it
carries a little less far than a footstep of the same radius. A Warden in
the room looks up; one two rooms away hears nothing. Inside a duct it is as
silent as everything else there.

### 20.6 Sections 5 and 6.1 - the hands sweep past a climb that cannot commit, and the routes are declared

Two things B5 (2026-09-13) settled while measuring the stacked routes.

The ledge probe is a sweep from the feet to the top of reach, and it now
goes on past a climbable face whose climb refuses to commit - a duct
floor's side, met from the hall floor, whose landing is inside the duct -
the way it already went past a wall, and the way the map's own derivation
(`handsReachFace`) always has. So 20.5's "a lip with no room above it" is a
failed climb only when nothing higher is in reach; when the duct's roof is,
the roof is what the press climbs. And the hands reach `vaultReach` ahead
for a rise within standing reach and `mantleReach` for one that needs the
jump, in the derivation exactly as in the controller, so a face the rule
names is a face the controller gets over from the spot the rule names -
held by `every-approach-the-rule-names-is-a-climb-the-controller-makes`.

The stairless routes up (v2 requirement 4) are **declared** as data,
`map.routes`, each a chain of stages ending at a height. This is not a
marking and not a tag: nothing in the climb rule or the controller reads
it, and declaring a route cannot make a surface climbable or stop one being
so. It is the map stating what it means, so a check can hold it to that -
every stage climbs from the stage below by the rule, the first from ground a
walking body reaches within a standing reach, and every stacked climb the
rule allows is on some route. A stacked climb no route explains is a
decision (D25), not an accident.

### 20.7 Sections 4 and 5 - vents read by material, not by a marking

> *"Vents: read as passable by material contrast - metal against concrete."*
> (the redesign interview, 2026-09)

Section 5's marking table gave a vent entrance a dim self-illuminated
interior panel; Section 5 amended took every affordance marking away and
left the duct the same concrete as the floor it sits on. B6 (2026-09-13)
gives the environment a **material language**: concrete is structure you do
not pass through - walls, floors, the deck, the ground; metal is what you
pass through or climb - the ducts in galvanised sheet (`palette.ductMetal`),
gantries, deck lips and the fire escape in gunmetal. A duct says it is
passable by being visibly not the wall it goes through. Nothing is painted
on it, nothing glows, and the collision flags do not know the colour.

Held by `every-vent-mouth-reads-by-contrast-from-its-approach`
(tests/legibility.js): from where a body arrives at each mouth - the spot
the climb rule names for a lip, or level floor straight out from a walk-in
- the duct and what is seen through its opening each read at Michelson
contrast >= 0.25 against the concrete around the opening, measured from the
rendered pixels. Michelson because a duct in the dark vault and one in the
lit hall are the same material and should read the same; a difference in
luma would call the dark one invisible. Whether metal-against-concrete
*reads as a duct* to a person is not a pixel question and stays with Josh
(D26).

### 20.8 Section 6.1 - the hands go over the top, or it is not a ledge

> *"every vault, mantle, slide, and pull-up must validate the destination
> capsule is clear of geometry before committing"* (Section 6.1)

The destination was validated; the way there was not, and B6's approach
survey found where that mattered (B5c, 2026-09-13): the two low ducts' lips
were climbable from the hall floor *underneath* the duct, by the face each
lip exposes beneath the floor slab, and the mantle carried the body straight
up through the floor into the mouth. The rule and the controller now say the
same extra sentence: once the hands meet a face, the column above the body
must be open air up to the top of that face (`handsOverTop`, climbprobe.js,
which both import). A face whose top edge is under another solid is a wall
under a ceiling, not a ledge; the hands stop there, everything higher is
behind the same ceiling, and the press is a scuff (20.5). Five approaches
went, all of them under a duct floor; the north duct's west lip, which opens
level onto the hall's crate stack and had no other approach, is no longer
climbable at all - it is walked into - and `hall-vent-north` is declared as
the crates, then the roof from the mouth. Held by
`a-mantle-never-passes-through-a-solid` (tests/routes.js), which asks the
geometry - nothing over the spot and under the landing - and then drives the
controller from under each low duct's floor without asking the rule.

### 20.9 Section 5 - the routes are lit

> *"endgame there should be no markings"* (the redesign interview, 2026-09)

Section 5 amended took the affordance markings away and asked the map to
read by material and light instead. B6 gave it the material; B7
(2026-09-14) gives it the light. Every stage of every declared stairless
route (`map.routes`, 20.6) is drawn a step brighter than it would be unlit
- its own colour as emissive on its four sides, `map.routeLighting` - and
the edge each route goes over at the top, where the climb rule names an
approach onto the landing from the last stage, carries a thin unlit strip
in the lamps' warm white. Both are derived: a surface is lit because it is
a stage, an edge because the rule says a body arrives there, and a lip is
lit only where a route lands on it (D25). It is paint and not a lamp: the
count of lights stays twelve and the detection model (Section 7.1) does not
see it, so a lit route is no riskier to stand on. Held by
`every-route-reads-lit-from-its-foot` (tests/legibility.js): from the
lowest spot the rule names on walkable ground for each route's first stage,
that stage reads at least 10 of luma brighter than the same stage painted
unlit in the same frame and at least 0.25 Michelson against its surround;
from the last stage, the strip on each landing edge reads at least 0.5
against what is round it; and every strip on the map is one draw call. How
it looks is D28.

### 20.10 Section 6.1 - feel: momentum, weight, the buffer, the hanging body, and the way up

> *"Feel - camera, momentum, weight, timing, traversal fuzz"* (the 50-phase
> plan, phases 42-46; built as B8, 2026-09-14)

Section 6.1's table gives speeds and heights and nothing about how a move
feels; the redesign left phases 42-46 for that. Five things, every one a
number in `config.js` under `shade`, none a new thing a player can do:

- **Momentum carries into a vault.** A vault is over sooner the faster the
  body arrives (`vaultDuration` at a walk sliding to `vaultDurationAtSprint`
  at a sprint) and the body leaves with `vaultCarry` of the speed it
  brought, never under `vaultExitSpeed`, never over a sprint. A vault at a
  walk is exactly what it was. A mantle is a pull, not a run, and carries
  nothing.
- **A landing has weight.** Below `landing.softFall` (1.2m) it costs nothing;
  from `landing.hardFall` (4m) up the whole cost; ramped between. The cost
  is `speedLoss` of the horizontal speed on the landing step and the ground
  speed held there for `recovery` while the legs take it; the camera dips
  `camera.landDip` and the body squashes `landing.squash`, scaled the same
  way. The landing noise (7.2) is unchanged.
- **The camera takes the weight of a climb.** A vault, mantle or pull-up
  committing dips the pivot `camera.climbDip`; a critically damped spring
  (`camera.dipRecovery`) brings it back with no overshoot. A grab does not
  dip: a hang is a reach, not a rise.
- **The jump buffer runs in every state.** `jumpBuffer` (0.12s) was only ever
  honoured on the ground. Now a press of Space in the last of a fall jumps
  off the landing, and one in the last of a vault or a mantle jumps off its
  top; a press spent on a climb, or on a scuff (20.5), is spent. A hold of
  Space through a climb is not a press and jumps nothing. Not during a grab,
  where Space is read as held or not by the hang it ends in (20.4).
- **The hanging body is at full stretch.** `hangDrop` is 2.05m: the feet that
  far under the lip, the arms straight up, the gloves drawn on the lip, and
  the capsule's top 0.2m *under* it (it stood 0.5m proud). So a lip with a
  gantry 0.3m over it - hall-container's south face - can be hung from, and
  its pull-up is what the gantry refuses, with the tell of 20.5; crouch
  drops. The pull-up takes `hangPullUpDuration` (0.65s), a body-length now.

And one thing the hanging body found, which is a rule and is recorded as
one: **the way up is swept.** 20.8 clears the column above the hands to the
top of the face and the parkour safety rule validates where a move ends;
between them the body travels the move's own path (`movePath`, an ease-out
with a small arc) and it is taller than a hand. `riseIsClear`
(climbprobe.js) sweeps the capsule along that path against every solid
whose top is above the landing's - the things the body could be going up
*through* - and the rule (`riseFits`, mapclimb.js) and the controller
(`_climbOnto`) both say it. Nine approaches went: hall-container's south
face from under the gantry, and every duct lip's two *side* faces from the
ground beside the mouth, where the duct's wall stands on the lip's edge and
the mantle went through it (146 -> 139 approaches, 22 stacked climbs by the
rule, none new). A grab is not swept - a hang is a reach - which is what
makes the gantry case a hang and not a scuff.

Held by `a-vault-carries-the-speed-you-brought-to-it`,
`a-landing-is-heavier-the-further-you-fell`,
`the-camera-dips-on-a-climb-and-comes-back`,
`a-jump-pressed-just-before-landing-still-fires` (tests/feel.js),
`a-hang-is-at-full-stretch-under-the-lip` (tests/hang.js), and the traversal
fuzz: `traversal-fuzz-ten-thousand-steps-never-sticks` and
`after-any-traversal-the-body-can-be-put-back-on-the-ground`
(tests/traversalfuzz.js) - ten thousand steps of real key input at every
spot the rule names, no move outliving its duration, no hang from nothing,
no endless fall, no body at rest in a solid, and after every burst the body
back on the ground within three seconds. How any of it feels is D29.

### 20.11 Sections 5, 6.1, 16 and 18 - the traversal redesign, closed

> *"endgame there should be no markings. should be able to do on a ledge
> what you would expect to be able to."* (Josh, after phase 49)

The redesign ran from 2026-09-08 to 2026-09-14 as phases 1-50 and this is
the amendment it was for; the entries before it (20.2, 20.4-20.10) are the
pieces, and this is what Sections 5 and 6.1 now read as. B9.

**Section 5, "Affordance markings"** is withdrawn in full. There are no
stripes, chevrons, dashes or lit vent panels, and the row that said *a
ledge is marked because it is flagged* is replaced by its own principle
one level down: **a ledge is climbable because a body could climb it**, and
nothing is flagged at all. What makes traversal readable instead:

- *Material* (20.7): concrete is what you do not pass through, metal is
  what you pass through or climb. Every duct is galvanised sheet against
  the concrete it runs through; gantries, deck lips and the fire escape are
  gunmetal. Measured from the pixels at every duct mouth.
- *Light* (20.9): every stage of every declared stairless route is a step
  brighter than the same surface unlit, and the edge a route goes over at
  the top carries a thin warm-white strip. Paint, not lamps; the twelve
  lights and the detection model are untouched.
- The plant-site ring stays: it is objective information, not an
  affordance. The destructible-light fixture's cracked-glass state stays:
  it is a state, not a marking.

**Section 5, "Traversal"** reads: 3 vent runs, crouch-only and silent, read
by material; **eight declared stairless routes** (`map.routes`, 20.6) - the
five designed and the three the reach rule found (the two duct roofs onto
the deck, the fire escape split at its landing), every one a chain of
stages the rule climbs in order, every stacked climb on the map on one of
them (D25 is whether the found ones stay); 1 drop-down shaft, one-way.

**Section 6.1's Vault, Mantle and Ledge hang rows** are withdrawn and the
climb is one rule with no bands:

| Property | Value |
|---|---|
| Reach | A surface is climbable when the body could reach its face from somewhere it can stand, get its hands over the top in open air (20.8), rise to the landing through nothing (20.10), and fit on top where it lands. Standing that is 2.6m; a jump adds 1.2m, measured from where the feet left the ground, so the ceiling is 3.8m for the whole arc (`shade.reach`). A rise under 0.32m is a step and is walked |
| The press | Only a press of Space climbs (20.2). On the ground, buffered; in the air, the jump that launched the body or a press during the fall. Walking off an edge climbs nothing. The buffer runs in every state (20.10) |
| Vault / mantle | Under `reach.vaultTop` (1.15m, chest height) the body plants a hand and goes over, keeping the speed it brought; above it the body pulls itself up. The map derives which is which from the rise; no surface is authored either way |
| Ledge hang | A held option (20.4): a climb of a ledge at least 1.4 Shade-heights (2.59m) above where it started begins with a grab. Tap Space and you hang, at full stretch (20.10); hold and you go over. Space pulls up, crouch drops, A/D shimmy. Lower ledges go straight over |
| Failed climb | Never silent (20.5): the body is pushed back, the arms go up, the hands slap - a noise a Warden in the room hears |
| Feel | 20.10: momentum into a vault, a landing that costs by the fall, a camera that takes the weight of a climb |
| The Warden | Stays grounded. `map.wardenGround` (A1) is every cell a walking Warden reaches from its spawns by its own step, symmetric (D16); the plant rule reads it (20.3), the AI plans its last leg over it, and `the-warden-never-leaves-its-ground` watches the AI patrol, hunt, defend and defuse and requires its feet on that ground every step. Finishing that check found the AI planning from its centre rather than its feet, which from the deck chose a corridor node six metres below and walked the body off the deck edge; fixed in `_pathTo()` |

The parkour safety rule stands, and is now two halves: the destination is
validated before a move commits, and the way there is swept (20.10).

**Section 16.** Check 6 ("Fail a mantle above 2.4m. Ledge hang triggers")
reads: *tap Space at a ledge you had to jump for. You hang; hold and you go
over; Space pulls up and crouch drops* - AUTO, `tap-space-grabs-the-ledge-
hold-space-climbs-it`. Check 26 ("every ledge is visibly marked") reads:
*every climbable surface climbs by the rule and reads by material and
light* - AUTO for the rule (the census, `every-climbable-surface-can-
actually-be-climbed`, and `the-climb-rule-has-no-exceptions`) and for the
contrast (20.7, 20.9), HUMAN for whether it reads. The regression set
after any patch is the numbered list **and** the redesign's contract by
check id, `CONFIG.debug.regressionChecks`: the census, the rule with no
exceptions, every approach climbed, the routes, a mantle through nothing,
the tap and the hold, the tell, the Warden on its ground, and the
traversal fuzz. `runRegressionSet()` runs both; `the-regression-set-
resolves-to-real-checks` requires every id to exist.

**Section 18.** "All 29 test script checks pass" reads them as amended
here, and adds: *the census is green and the regression set's named checks
are all present* - the definition of done includes the rule.

### 20.12 Section 17.1 - the debug gate is off by default

Section 17.1 reads *"Test mode is gated behind a `DEBUG` flag in
`config.js`, defaulting to true during development."* Development is over
for the purposes of a playtest, and the flag is now a gate that is **off by
default** and live: `SETTINGS.debug`, seeded false from
`CONFIG.settings.defaults.debug`. `?debug=1` on the URL turns it on for a
page load; the settings menu's *debug tooling* row turns it on or off at any
time. Off, the F3 overlay, the F4 panel and every key in the 17.1 table are
inert, the Section 17 runtime assertions do not run, the F3 fields are not
recorded, `?mode=freeroam` boots the competitive match (the menu's Free roam
button is the player's way in and is not gated), and a frame drawn with a
panel up takes it down. The console handle `window.BLACKLINE` is present in
both builds: it is the AUTO suite's way in, and the suite turns the gate on
for the length of a run and puts it back. C1, 2026-09-15; the check is
`with-the-debug-gate-off-every-debug-key-does-nothing`.

### 20.13 Section 13 - the round opens on a briefing

Section 13 lists the menus: main, settings, the intermission scoreboard,
the match end screen. There is one more: a **round-start briefing and
controls card**, raised on every route into a round - the main menu's Play
and Free roam, the intermission's Next round - and never by `initMatch`
itself. Per role it says the objective in one line, names the three sites,
and lists the controls read from the live bindings; it holds the round
(no simulation step runs while it is up, as under the pause menu, and the
HUD is not drawn behind it) until any key or mouse button, which is spent
- the Space that takes it down is not the round's first jump, and Esc is
a key like any other while the card is up. A setting, *round briefing*
(`SETTINGS.briefing`, on by default), turns it off, and off the round
starts on the click. Next round now starts the next round: `initMatch`
takes `round`, and the intermission passes the number, where before it
reset every round to 1. C2, 2026-09-15; the checks are
`a-round-opens-on-a-briefing-that-any-key-dismisses` and
`the-briefing-follows-the-round-and-the-setting-skips-it`.

### 20.14 Section 13 - hit and damage feedback

Section 13's HUD says nothing about being hit or hitting. Three things are
added, drawn by the renderer over the scene rather than in the DOM (one
screen-space quad, `systems/feedback.js`, invisible and costing no draw
call while it has nothing to show), so the pixel checks can prove them:
a **hit marker** - four short diagonal strokes on the screen centre for
`feedback.hitMarkerTime` when a shot of yours lands (the Shade's knife or
taser; the Warden's round on the Shade); a **damage direction** - an arc on
a ring round the centre, toward where the damage came from, recomputed
every frame as the camera turns, for `feedback.indicatorTime`, from
`combat:damage` events that carry a source (a rifle round carries its
muzzle, a frag its blast); and a **vignette** - the screen edge tinted
toward `feedback.vignetteColor`, `vignetteMax` opaque at no health, in
proportion to the health lost, while the actor is alive (a dead actor's
view is the death camera's). All three are for whichever actor the human
is driving. C3, 2026-09-15; the checks are
`the-vignette-deepens-with-lost-health-and-leaves-the-centre-alone`,
`a-landed-knife-puts-a-hit-marker-at-the-centre-and-a-miss-does-not` and
`damage-draws-an-arc-toward-where-it-came-from`.

### 20.15 Sections 10.4, 10.5 and 13 - the round and match end screens say how

Section 10.5's scoreboard between rounds listed the round number, winner,
duration, takedowns and plant site; the match end screen was that with a
different heading. Both now **explain**: who took the round and how, one
of Section 10.4's four outcomes as a sentence (the charge detonated; the
Warden defused the charge; the Shade lost all lives before planting; the
clock ran out with no plant) and as a word in a *how* column of the
table; and a **timeline of the round** from the objective's own record
(`round.timeline`: the round begins, the plant, each life lost and
reinsert, each Warden down, the end, each with the round's clock), five
lines at most - the first and the last four when there are more. The
match screen says the same of the match, with a tally of how the winner
took its rounds. Each round record carries `outcome` (one of `OUTCOME` in
`systems/roundstate.js`) beside the reason it kept. And the screen comes
**`roundEndDelay` (2.5s) after the end**, counted by the objective on the
sim clock and raised on `objective:intermission`, not in the step that
ended the round; the HUD carries the result as a line meanwhile, and the
death camera, if the third life was the end, stays on the killer until
the screen takes it down (before, it stayed up under the card until the
next round or the wall-clock guard). The main menu's Play starts a fresh
match itself (`resetMatch()`), whichever route raised the menu. C4,
2026-09-16; the checks are `the-end-screen-says-who-won-and-how-each-way`
and `play-from-the-main-menu-starts-a-fresh-match`, and
`the-briefing-follows-the-round-and-the-setting-skips-it` and the
*round ends while awaiting reinsert* scenario of
`the-state-machines-survive-each-other` step through the delay.

### 20.16 Sections 11 and 17.1 - the difficulty presets, measured, and the gun aimed

Section 11's difficulty line stands: three presets adjusting the fill
rate, the aim error cone and the reaction delay, medium 120ms and 2.5
degrees. What they are worth is now measured and held:
`each-difficulty-is-quicker-to-see-you-and-quicker-to-kill-you` stands a
lit, still Shade 8m and 16m up a clear lane from a Warden and requires
time-to-detect (the first step in view to ENGAGE) and time-to-kill
(ENGAGE to the death) both to fall from each preset to the next in the
order `config.js` lists them, eight seeds each. Building it found the gun
rather than the numbers, and Section 11's ENGAGE row reads as it always
meant to: the Warden **aims at the torso** (the point its perception
sees), where it aimed at the floor line the planner keeps; **fires in
bursts of 3-7 rounds** at the gun's rate with a 0.25-0.7s pause between,
where a burst was 3-7 sixtieths of a second - one round, sometimes two;
and its **aim error is a cone in yaw and pitch, drawn afresh for every
burst**, where it was a pitch-only bias held for the whole engagement.
Measured on medium: a lit, still Shade at 8m is engaged 4.97s after it
is first seen and dead 0.51s after that; at 16m, 9.3s and 1.4s. Section
17.1's god mode now covers the rifle as well as the frag, which is what
it said. `the-warden-fires-in-bursts-of-rounds-at-the-torso` holds the
burst, the aim point and the god mode. C5, 2026-09-16; D33.

### 20.17 Sections 3, 5, 13 and 16 - the map registry

Section 3 lists `map.js` as the level. There is a registry now
(`src/maps/index.js`, D1): every map the game can build, keyed by a short
id - `plant` is "Meridian Substation" (`maps/plant.js`, Section 5's map,
its data in `maps/plantdata.js`) and `yard` is Block D's container yard
(`maps/yard.js`; D2 blocks it out - until then an empty, fenced ground
plane with three bays, three sites and the spawns a match needs).
`buildMap(id)` is the only way a map gets built. A map is built once, at
boot, and the world is built on it: `?map=<id>` on the URL picks it for
the page load (an unknown id opens the default, `plant`, with a warning),
the main menu names the map the page is on and its **map** row reloads
with the next one, keeping the seed and the debug gate, and the briefing
names it after the sites. Section 5's counts are what the plant map
promises (`validateMap(map, expects)`); another map promises its own.
Section 16's suite is parameterised over the map: a check registered
with `maps: ['plant']` runs there and is reported *not for this map*
elsewhere, never as a pass; one with no `maps` runs on every map; and
the headless runner takes `--map plant,yard` and reports per map, with
red and flaky judged per map. `npm run suite` alone still runs `plant`.
Checks: `every-registered-map-builds-and-the-page-is-on-the-one-its-url-asked-for`,
`the-menu-offers-every-map-and-its-map-row-asks-for-the-next-one`,
`a-check-registered-for-another-map-is-reported-not-run` (tests/maps.js).
D1, 2026-09-17; D34.

### 20.18 Section 5 - the second map, the container yard, blocked out

`yard`, "Container Yard" (`maps/yard.js`, its data in `maps/yarddata.js`;
D2, 2026-09-17), is built to Section 5's five v2 requirements re-read for
outdoors: the Shade starts on the apron outside a working yard walled by
a ring of one-high containers (requirement 3); the tops of the one-high
containers are one connected deck - every bay wall and every stack
touches the ring or a row that does, and a container laid across each of
the two gates as an arch keeps the ring one surface over them
(requirement 2); the stairless routes up are stacks, pallets to a row
top to a second tier to a third, declared as `map.routes` (requirement
4); every bay has two entries, one of them the sky (requirement 5); the
raised ceiling is the Warden's walkway, D3's. The container is a high
cube, 2.9m (D35): above `shade.reach.standing`, so one high is a jump
and a grab, and two high is past the jump's reach, so it needs the one
below. Section 5's counts are the plant's; the yard promises its own
(`EXPECTS`: 4 lights, 21 waypoints, 3 sites in 3 rooms, 9 routes).
Section 10.1's "not inside anything" (20.3, D20) has a second reading
here: the crawl space under bay B's trailer, refused by the same headroom
clause; the census enumerates crawl spaces on every map. Section 16: two
checks on the yard alone, `the-container-tops-are-one-connected-deck`
and `one-high-is-a-jump-and-two-high-needs-a-stack` (tests/yard.js); the
checks that only need open floor find a lane on the map they run on
(tests/lanes.js) instead of standing at the Turbine Hall's coordinates;
the hang-under-a-lid case searches the map for a lidded lip; three AI
checks that stand in the hall's lit lane are the plant's until D5. The
room-entry derivation splits a run where its sill changes (a gap beside
a row is two entries, not one at the row's centre). D2, 2026-09-17; D35.

### 20.19 Sections 5 and 8.2 - the Warden's walkway on the yard, and what stops a knife

The yard's raised ceiling (20.18) is the Warden's walkway (D3,
2026-09-18): a glazed run 7.2m up over the mid lane's north edge,
reached by one flight of 24 treads up the west side of the gate lane,
with a parapet a metre high, glass from there to a roof at 2.3m, and
three apertures - a slot 0.4m wide from the parapet's top to 1.95m in
each end face, looking down the mid lane into bays A and B's open
corners, and one in the middle of the south face over bay C's gap (D11,
D37). The door is the stair's mouth in the north face. Its floor is
above `standing + jumpBonus` from every top within 4m, so Section 6.1's
rule names no way onto it and nothing has to say so (D12); the stair is
walked, by both bodies, and whether the Shade may is D38. Glazing is a
new kind of solid (`addSolid`'s `glass`, `CollisionBox.glass`): solid
to a body, a round and a blade, and nothing to a line of sight
(`blocksSight` false), drawn translucent; the Warden sees the whole yard
through it and shoots only through the slots. **Section 8.2 amended:**
the knife lands only with open air from the Shade's torso to the
Warden's, asked of every solid box - the same line Section 8.1's round
is occluded on. It had no world test before, which nothing noticed while
every wall was thicker than its reach. Section 16: three checks,
`the-walkway-is-glazed-and-shoots-only-through-its-apertures` and
`nothing-climbs-to-the-walkway-and-the-warden-walks-up` on the yard,
`a-knife-stops-at-a-wall-a-body-cannot-pass` on every map
(tests/walkway.js). `addStaircase` takes `steps`. D3, 2026-09-18; D37,
D38.

### 20.20 Sections 4, 4.1 and 5 - the yard at night

The yard (20.18) is lit at night (D4, 2026-09-18; D9, D39): Section 4's
"one dim hemisphere, 12 destructible point lights, 2 directional fills"
is the rig's shape on every map and the plant's numbers; a map may pass
its own numbers (`addLightRig(rig)`, mapkit.js) and the yard does - a
hemisphere a third of the day's and a fill less than half, the fill from straight
overhead in the lamps' cool so a shadow is a shade and not a hole, and
the key a floodlight: warm, 0.3, aimed from the head of the mast that
covers the most of the Warden's ground inside the ring at the yard's
centre, 28 degrees up, so every stack throws a long hard shadow.
Section 4.1 is untouched: that key is the one shadow caster, and the
point lights cast none. The yard's destructible lights are five: four
floodlights on masts (`MASTS`, maps/yarddata.js - a pole and an arm
thinner than a body, so Section 6.1's rule finds nothing to stand on)
over the sites and the gate, and one under the walkway's floor over the
mid lane; each is 2.5 times the plant's pendant (bay C's half that), the
inverse square of a head at 6.5m over dark concrete. Section 4's "high
contrast between lit pools and dark gaps" is held on the yard by the
same check as the plant, `lit-pools-and-dark-gaps-are-actually-
contrasty` (each site's lamp adds more than the sky lands), and by two
of its own (Section 16): `the-yard-is-floodlit-from-masts-at-night`
(the masts, the key's mast by count, its aim, colour and elevation) and
`the-yard-is-dark-between-its-pools` (a lane no lamp reaches and a
stack's key shadow read under half the dimmest pool and above black;
the sky alone lands under a third of the brightest pool on every site).
tests/yardlight.js. D4, 2026-09-18; D39.

### 20.21 Section 11 - the AI on the yard: a near goal over the ground, and stuck means moving

The Warden AI plays the yard (D5, 2026-09-19) with two amendments to
Section 11's navigation, both of them on every map. **A goal within
`ai.directRouteRange` (10m, flat) is walked to over the Warden's ground
from its own feet** (`WardenGround.route()`, the planner that already
did the last leg since Block A8), and the waypoint graph is not
consulted; past that range the route is A-star over the graph to the
node nearest the goal and the planned leg from there, as before. Routed
through the graph, a noise eight metres up the yard's lane was
investigated by way of the node nearest it, which stood beyond it, so
the Warden walked past the Shade making the noise - out of its own
90-degree cone at a metre - and came back. **"Stuck handling ... while
in a moving state" reads as: while the AI means to move** - a moving
state, not paused at a patrol node, and a route it has not reached the
end of (ENGAGE, which closes on the Shade with no route, always means
to move). A Warden that has arrived and is holding - kneeling over a
charge for the eight seconds of a defuse, scanning at a noise - is not
stuck; the detector read it as wedged every two seconds, re-pathed it
from the nearest graph node, and it stood up, walked there and came
back to begin the defuse again (twelve re-paths in nine rounds of D5's
soak, every one at the charge). A wedged Warden has not arrived, so the
detector still sees it. Section 16: `the-warden-plays-three-matches-on-
this-map-without-a-stall` (tests/aisoak.js) plays three matches on
whatever map the page is on - a patrol from a different spawn each
round, the plant at a different site, the Warden defending from
wherever the patrol left it - and holds every round defused on the
detonation clock, the Warden's feet on its ground every step, a camera
hung every match, and no more than three re-paths in all. The three
checks Section 16 stood in the Turbine Hall by coordinate
(`ai-state-machine-follows-section-11`, `each-difficulty-is-quicker-to-
see-you-and-quicker-to-kill-you`, `the-warden-fires-in-bursts-of-
rounds-at-the-torso`) stand on `litLane()` (tests/lanes.js) - a clear
run the map's lamps light to at least half the meter at every range
they measure - and run on every map; D33's table is unchanged on the
plant. D5, 2026-09-19.

### 20.22 Section 16 - the gate runs every registered map, and the regression set is asked per map

`npm run suite` (Section 16's headless gate since P4) loads the page once
per map the registry lists (`src/maps/index.js`; 20.17) and runs the
suite twice on each, judged per map; a map is in the gate the day it is
registered. "Regression set after any patch" is asked of the map the
page is on: the checks that cover the set's numbers or are named by id
(20.11), less those registered for other maps, which `runRegressionSet`
names in the console along with any of the set's numbers no check on
that map covers; `the-regression-set-resolves-to-real-checks` holds
that split on every map. On the yard today five of the set's 29 are
the plant's by geometry (Section 16's check 3 is held there by nothing); D7 in the queue is to make the set whole. `--regression` runs
the set headless per map. D6, 2026-09-19.

### 20.23 Section 16 - the regression set is whole on every map

"Regression set after any patch" is held on every registered map by
checks that search the map they are on (`src/tests/anymap.js`), and
`the-regression-set-resolves-to-real-checks` is red on any map where a
check in the set is registered for another map or a number in the set
is covered by nothing running there. The five checks of the set that
named the plant's geometry (20.22) stay in the full suite as they were,
out of the set; each one's rule clause is in the set asked of the map:
check 1's auto half drives a body from every site and Warden spawn in
four headings at 6.5, 50, 200 and 1000 m/s and sweeps every step's
path against every solid taller than a step; check 3 drives every
declared route (`map.routes`, 20.11) from walkable ground to its
landing through the controller and lets the body settle where it
lands; the mantle-through-nothing clauses (20.6, 20.8, 20.10) run on
every map and report a map where the sweep refuses nothing as that;
checks 8 and 9's auto half asks that the brightest site read at least
half the meter with headroom under the clamp and the darkest place on
the Warden's ground under 25; and a round stops at the first solid
between the muzzle and the body, and lands a headshot only above the
head line, down a clear lane and across three pieces of cover the map
is searched for. The set is 29 checks on both maps. D7, 2026-09-19.

### 20.24 Section 4 - the Shade's silhouette: a hood, and six merged parts

The Shade's figure (E1, D40): to the lanky body Section 4 describes,
a hood round the head open at the face over a dark lining and a short
cowl over the shoulders, the torso narrowed so the silhouette steps in
at the neck under the hood, the limbs thinner at the same length and
pivots. "Animate by rotating and translating primitive limb groups"
stands - the six groups the controller poses are unchanged - but each
group now holds ONE merged geometry with its colours in a vertex
attribute, and the whole body is one toon material carrying the rim
and one outline material: twelve draw calls where there were twenty.
No skeleton, as Section 4 says. The inverted hull is grown 4mm on
every side of each primitive about its own centre before placement
rather than scaled 1.03 about a part - a shade under the old torso's
edge and a visible one on a 5cm arm; thicker, and the hull takes the
outer pixels the fresnel rim needs on a thin limb.
`the-shade-reads-as-a-hooded-figure-at-8m-and-25m` (tests/figure.js)
reads the silhouette back on every map: tall and narrow, a hood wider
than the neck under it at both distances, six parts on one material,
at most twelve draw calls. E1, 2026-09-19.

### 20.25 Section 4 - the Warden's silhouette: a helmet on the shoulders, a vest, a rifle, and six merged parts

The Warden's figure (E2, D41): to the bulky body Section 4 describes,
a domed helmet with a brim and a visor sat on the shoulders with no
neck showing (a collar fills it), gunmetal vest plates proud of the
orange chest, a belt of hips over the legs so the body is one block,
the pauldrons the widest row, short legs splayed to a broad stance,
and a rifle carried at the low ready in the right hand, a piece of that
arm's part so it goes where the hand goes. "Animate by rotating and
translating primitive limb groups" stands - the six groups the
controller poses are unchanged, and the carry is a rest pose the walk
swings about (`WARDEN_FIGURE.arm.rest`; the arms were held behind the
back before) - but each group holds ONE merged geometry with its
colours in a vertex attribute, on one toon material and one outline
material: twelve draw calls where there were sixteen. No rim (4.2 is
the Shade's) and no skeleton. The hull is grown 6mm per primitive
(the Shade's 4mm shares its edge with the rim; the Warden's has no
rim to share it with). One palette entry, `wardenSteel`, for the rifle
and the visor. `the-warden-and-the-shade-are-told-apart-by-silhouette-
at-25m` (tests/figure.js) reads both figures back on every map as flat
shapes at 25m: the Warden broad (1.5:1) with a top narrower than the
shoulders under it and its middle reaching ahead of its helmet from the
side; the Shade narrow (3.3:1), hooded, reaching nothing; each the
other's opposite by a margin. E2, 2026-09-20.
