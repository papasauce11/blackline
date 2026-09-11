/**
 * BLACKLINE - tests/plantspots.js
 *
 * Where a charge can go, for the checks that ask about it.
 *
 * Section 10.1 as amended lets the plant happen anywhere in a site's room, and
 * Block A carves the Warden's reach out of that room. Four files of checks now
 * need to talk about the same set of places - the round-flow checks want one
 * ordinary spot to plant on, and the plant-rule and census checks want all of
 * them - so the places live here rather than in whichever file asked first.
 *
 * Everything here is a FOOT position, because that is what the plant records
 * (`round.chargeAt`) and what the defuse reach is measured from. `legal` is
 * the whole rule - `canPlantAt()`, D5 and D20 together - not one clause of it.
 *
 * Layering (Section 3.1): imports config and systems, like the checks it
 * serves. It reaches the live game only through the harness handed in.
 */

import { CONFIG } from '../config.js';
import { CHARGE } from '../systems/objective.js';
import { createIntent } from '../entities/agent.js';

const R = CONFIG.round;

/**
 * Somewhere in a site's room that is NOT the ring: as far off it as the room
 * and the furniture allow, up to `want` metres.
 *
 * Section 10.1 as amended lets the plant happen anywhere in the room, and
 * every check here used to plant on the ring's centre pixel. That is the one
 * spot where "the charge" and "the site" are the same point, so the whole
 * file would have gone on passing with the charge tracked at the site centre
 * and the Warden defusing thin air ten metres from the bomb.
 */
export const spotOffTheRing = (h, site, want) => {
  const room = site.room;
  const margin = CONFIG.shade.radius + 0.5;
  const half = { x: CONFIG.shade.radius, y: CONFIG.shade.standHeight / 2, z: CONFIG.shade.radius };
  const centre = { x: site.position.x, y: site.position.y, z: site.position.z };
  if (!room) return centre;

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  for (let out = want; out >= R.siteRadius + 1; out -= 1) {
    for (const dir of [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]) {
      const spot = {
        x: clamp(centre.x + dir.x * out, room.min.x + margin, room.max.x - margin),
        y: centre.y,
        z: clamp(centre.z + dir.z * out, room.min.z + margin, room.max.z - margin),
      };
      const away = Math.hypot(spot.x - centre.x, spot.z - centre.z);
      if (away < R.siteRadius + 1) continue;
      const feet = { x: spot.x, y: spot.y + half.y + 0.05, z: spot.z };
      if (!h.map.collision.isClear(feet, half)) continue;
      // A5: and somewhere the plant is actually allowed. Every check in this
      // file plants here, so a spot the gate refuses would fail all of them
      // for a reason that has nothing to do with what they test. It happens
      // to change nothing on today's map - every clear floor cell of all
      // three rooms is legal - which is the point: it is here so that a room
      // reshaped by B4 or B5 cannot quietly break the file.
      if (!h.objective.canPlantAt(spot)) continue;
      return spot;
    }
  }
  return centre;
};

/**
 * Every climbable top a standing body fits on inside a site's room, as a
 * foot position at its centre, with whether the plant rule allows a charge
 * there. Taken from the census's own ledge list, so a map rebuild that moves
 * a crate moves the checks that use this with it.
 */

/** Put the Shade in a site's room, off the ring, and hold interact. */
/** Put the Shade in a site's room, off the ring, and hold interact. */
export const plantAt = (h, siteId) => {
  const objective = h.objective;
  const dt = CONFIG.time.fixedDt;
  const site = h.map.sites.find((entry) => entry.id === siteId);
  const spot = spotOffTheRing(h, site, R.siteRadius * 3);
  h.shade.reset(h.map.shadeSpawns[0]);
  h.shade.position.set(spot.x, spot.y + CONFIG.shade.standHeight / 2 + 0.05, spot.z);
  const intent = createIntent();
  intent.interact = true;
  let steps = 0;
  while (objective.round.charge === CHARGE.CARRIED && steps++ < 20 / dt) {
    objective.step(dt, { shade: h.shade, warden: h.warden, intent });
  }
  return steps * dt;
};

/**
 * Every climbable top a standing body fits on inside a site's room, as a
 * foot position at its centre, with whether the plant rule allows a charge
 * there. Taken from the census's own ledge list, so a map rebuild that moves
 * a crate moves the checks that use this with it.
 */
export const perchesInSiteRooms = (h) => {
  const objective = h.objective;
  const half = { x: CONFIG.shade.radius, y: CONFIG.shade.standHeight / 2, z: CONFIG.shade.radius };
  const perches = [];
  for (const ledge of h.map.ledges) {
    const box = ledge.box;
    const foot = {
      x: (box.min.x + box.max.x) / 2,
      y: box.max.y + 0.02,
      z: (box.min.z + box.max.z) / 2,
    };
    const body = { x: foot.x, y: foot.y + half.y, z: foot.z };
    if (!h.map.collision.isClear(body, half)) continue;
    const site = objective.siteNear(body);
    if (!site) continue;
    perches.push({
      tag: box.tag || 'untagged',
      rise: ledge.rise,
      foot,
      body,
      site: site.id,
      legal: objective.canPlantAt(foot),
    });
  }
  return perches;
};

/**
 * Every place inside a site room a Shade could leave a charge: the room
 * floors on a coarse grid, the climbable tops, and the vent interiors. A
 * spot is a FOOT position, because that is what the plant records and what
 * the defuse reach is measured from.
 *
 * The body is placed by its feet and the objective is driven directly, which
 * means a duct sample carries a standing capsule poking through the duct
 * roof. Nothing in `objective.step()` looks at the capsule - it reads the
 * feet and the room - and whether a body physically fits in a duct is
 * `tests/map.js`'s question, answered there. What is filtered here is
 * whether a *crouched* Shade fits, so the census never enumerates a spot no
 * Shade could occupy.
 */

/**
 * Every place inside a site room a Shade could leave a charge: the room
 * floors on a coarse grid, the climbable tops, and the vent interiors. A
 * spot is a FOOT position, because that is what the plant records and what
 * the defuse reach is measured from.
 *
 * The body is placed by its feet and the objective is driven directly, which
 * means a duct sample carries a standing capsule poking through the duct
 * roof. Nothing in `objective.step()` looks at the capsule - it reads the
 * feet and the room - and whether a body physically fits in a duct is
 * `tests/map.js`'s question, answered there. What is filtered here is
 * whether a *crouched* Shade fits, so the census never enumerates a spot no
 * Shade could occupy.
 */
export const plantableSpots = (h) => {
  const objective = h.objective;
  const S = CONFIG.shade;
  const standHalf = { x: S.radius, y: S.standHeight / 2, z: S.radius };
  const crouchHalf = { x: S.radius, y: S.crouchHeight / 2, z: S.radius };
  const spots = [];
  const add = (kind, what, foot) => {
    const body = { x: foot.x, y: foot.y + S.standHeight / 2, z: foot.z };
    const site = objective.siteNear(body);
    if (!site) return;
    spots.push({
      kind,
      site: site.id,
      what: `${what} (${kind}, room ${site.id})`,
      at: foot,
      body,
      legal: objective.canPlantAt(foot),
    });
  };

  // The floors, coarsely. Fine enough that a room whose ground the Warden
  // cannot reach shows up, coarse enough that the census is not a soak.
  const FLOOR_STEP = 2;
  for (const site of h.map.sites) {
    const room = site.room;
    if (!room) continue;
    for (let x = room.min.x + FLOOR_STEP / 2; x < room.max.x; x += FLOOR_STEP) {
      for (let z = room.min.z + FLOOR_STEP / 2; z < room.max.z; z += FLOOR_STEP) {
        const foot = { x, y: room.floorY + 0.02, z };
        const body = { x, y: foot.y + standHalf.y, z };
        if (!h.map.collision.isClear(body, standHalf)) continue;
        add('floor', `${x.toFixed(0)},${z.toFixed(0)}`, foot);
      }
    }
  }

  // The climbable tops - the list the census check derives its own from.
  for (const perch of perchesInSiteRooms(h)) add('top', perch.tag, perch.foot);

  // The vent interiors, along the run rather than across it.
  for (const vent of h.map.vents) {
    const alongX = vent.axis === 'x';
    const from = alongX ? vent.min.x : vent.min.z;
    const to = alongX ? vent.max.x : vent.max.z;
    const cross = alongX ? (vent.min.z + vent.max.z) / 2 : (vent.min.x + vent.max.x) / 2;
    for (let t = 0.1; t <= 0.91; t += 0.2) {
      const along = from + (to - from) * t;
      const foot = {
        x: alongX ? along : cross,
        y: vent.min.y + 0.02,
        z: alongX ? cross : along,
      };
      const crouched = { x: foot.x, y: foot.y + crouchHalf.y, z: foot.z };
      if (!h.map.collision.isClear(crouched, crouchHalf)) continue;
      add('vent', vent.tag, foot);
    }
  }

  return spots;
};

/** Stand at a spot and hold interact until the plant commits or the hold is over. */

/** Stand at a spot and hold interact until the plant commits or the hold is over. */
export const plantOutcomeAt = (h, spot) => {
  const objective = h.objective;
  const dt = CONFIG.time.fixedDt;
  objective.resetRound(1);
  h.shade.reset(h.map.shadeSpawns[0]);
  h.shade.position.set(spot.body.x, spot.body.y, spot.body.z);
  const intent = createIntent();
  intent.interact = true;
  const limit = Math.ceil((R.plantHoldTime + 0.5) / dt);
  let peak = 0;
  for (let i = 0; i < limit && objective.round.charge === CHARGE.CARRIED; i++) {
    objective.step(dt, { shade: h.shade, warden: h.warden, intent });
    peak = Math.max(peak, objective.round.plantProgress);
  }
  return { charge: objective.round.charge, peak, at: objective.round.chargeAt };
};

/** Put the Shade in a site's room, off the ring, and hold interact. */
/** Put the Shade in a site's room, off the ring, and hold interact. */
