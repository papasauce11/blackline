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

---

## Provisional — done as recommended, override any time

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
