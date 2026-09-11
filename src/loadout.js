/**
 * BLACKLINE — loadout.js
 *
 * The human's gadget slots, Section 9. `intent.gadget` carries a slot number
 * out of the input readers; the fixed step in main.js hands it here, where it
 * becomes a throw, a taser shot or an alarm placement on the Gadgets system,
 * and a HUD line saying what happened. The AI reaches the same throws through
 * `ai:throw`, so there is one implementation and free-roam remains a
 * configuration (Section 12).
 */

import { CONFIG } from './config.js';

/** Where an actor is looking from, and along what, for a throw or a shot. */
function aim(eye, yaw, pitch) {
  const cosPitch = Math.cos(pitch);
  return {
    eye,
    direction: {
      x: -Math.sin(yaw) * cosPitch,
      y: Math.sin(pitch),
      z: -Math.cos(yaw) * cosPitch,
    },
  };
}

/**
 * Section 9.1's Shade loadout, on slots 1-3. Everything is thrown or aimed
 * along the camera's facing, from the Shade's eye, so what you are looking at
 * is what you are throwing at.
 */
export function useShadeGadget(slot, { shade, warden, gadgets, hud }) {
  const { eye, direction } = aim({
    x: shade.position.x,
    y: shade.feetY + shade.height * CONFIG.shade.eyeHeightRatio,
    z: shade.position.z,
  }, shade.yaw, shade.pitch);

  if (slot === 3) {
    const hit = gadgets.fireTaser(shade, warden, direction);
    hud.push(hit === 'warden' ? 'taser - warden stunned'
      : hit === 'light' ? 'taser - light destroyed'
        : gadgets.taserCharge > 0 ? 'taser - nothing in range' : 'taser recharging');
    return;
  }

  const type = slot === 1 ? 'smoke' : 'flashbang';
  const thrown = gadgets.throwGadget(type, eye, direction, 'shade');
  hud.push(thrown ? `${type} thrown - ${gadgets.loadout[type]} left` : `no ${type} left`);
}

/** Section 9.2's Warden loadout, driven by the free-roam human. */
export function useWardenGadget(slot, { warden, gadgets, hud }) {
  const { eye, direction } = aim(
    { x: warden.position.x, y: warden.eyeY, z: warden.position.z },
    warden.yaw, warden.pitch
  );

  // Section 9.2: the alarm camera is "placed on a wall", so it goes where the
  // Warden is looking, on the surface, facing back out along that surface's
  // normal. No wall in reach means no placement — it is not a floating turret.
  if (slot === 3) {
    // The same call the AI makes (Section 9.2). One implementation, so a
    // camera the AI hangs is one a player could have hung.
    const placed = gadgets.placeAlarmOnWall(eye, direction);
    hud.push(placed ? 'alarm camera placed'
      : gadgets.alarm ? 'alarm camera already placed'
        : gadgets.loadout.alarmCamera > 0 ? 'no wall in range' : 'no alarm camera left');
    return;
  }

  const type = slot === 1 ? 'stunGrenade' : slot === 2 ? 'frag' : null;
  if (!type) return;
  const thrown = gadgets.throwGadget(type, eye, direction, 'warden');
  hud.push(thrown ? `${type} thrown - ${gadgets.loadout[type]} left` : `no ${type} left`);
}
