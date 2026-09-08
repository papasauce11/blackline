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

---

## Provisional — done as recommended, override any time

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

---

## Blocking — waiting on Josh

### D8 — Does the site ring still read, now the plant is the whole room?
The ring still looks like "plant here" while meaning "this room". Options:
keep it as a room marker; shrink it to a floor decal at the room centre;
tint the room's floor instead. Recommendation: look at it in play before
deciding. Nothing is blocked on this yet.
**decided:**

### D13 — Rooms, sites and spawns on the first map
B5 may want to move a site or a spawn, or merge two rooms, to make a stacked
route work. The routine will not do that on its own. If it hits the case it
writes the specific proposal here as D13a, D13b… and picks another job.
**decided:**
