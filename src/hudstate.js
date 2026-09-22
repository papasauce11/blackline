/**
 * BLACKLINE — hudstate.js
 *
 * What the HUD is told each frame, gathered from the systems that own it. The
 * HUD (ui/hud.js) reads only this bag, so it never imports a system; the
 * frame in main.js builds it once per frame, on the wall clock, because the
 * HUD presents the simulation rather than being part of it.
 */

import { CONFIG } from './config.js';

/** @returns {object} the state bag `hud.update()` takes */
export function gatherHudState({ match, shade, warden, gadgets, detection, combat, objective }) {
  const objectiveHud = objective.hud;
  // The site the player is standing in (C7): named for either role; the
  // plant prompt is the Shade's alone.
  const site = match.role === 'warden'
    ? objective.siteNear(warden.position, CONFIG.warden.standHeight)
    : objective.siteNear(shade.position);
  return {
    role: match.role,
    freeroam: match.mode === 'freeroam',
    unlimitedGadgets: gadgets.unlimited,
    alarmPlaced: !!gadgets.alarm,
    shadeMarked: gadgets.shadeMarked,
    visibility: detection.smoothed,
    health: match.role === 'warden' ? warden.health : shade.health,
    lives: objectiveHud.lives,
    loadout: gadgets.loadout,
    taserCharge: gadgets.taserCharge,
    taserRecharge: gadgets.taserRecharge,
    magazine: combat.weapon.magazine,
    reloading: combat.weapon.reloading,
    spread: combat.weapon.spread,
    timeRemaining: objectiveHud.timeRemaining,
    planted: objectiveHud.planted,
    site: objectiveHud.site,
    plantProgress: objectiveHud.plantProgress,
    plantRefused: objectiveHud.plantRefused,
    defuseProgress: objectiveHud.defuseProgress,
    promptInRange: match.role !== 'warden' && !!site,
    siteHere: site ? { id: site.id, name: site.name } : null,
    awaitingReinsert: objectiveHud.awaitingReinsert,
    reinsertIn: objectiveHud.reinsertIn,
    score: objectiveHud.score,
    roundNumber: objectiveHud.roundNumber,
    blind: gadgets.playerBlindFraction(),
  };
}
