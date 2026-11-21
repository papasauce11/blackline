/**
 * BLACKLINE - tests/dustlight.js
 *
 * AUTO suite: dust and light (J6) - the marks a landing, a failed climb, a
 * shot and a hand on a rail leave on the picture.
 *
 * `systems/effects.js` listens for four events and `systems/dust.js` is what
 * two of them draw: a landing's puff, whose count and spread are the fall, a
 * scuff's, which is the landing's smallest, a muzzle flash that is one point
 * light switched on for one frame, and sparks from a hand on metal. None of it
 * is a thing a check can see by asserting a field was written, so each clause
 * reads the pool or the picture the way the player gets them: the fall is a
 * body dropped from a height and stepped, the scuff is a press of Space into a
 * wall, the shot is the trigger held, the hand is a tap at a ledge.
 *
 * The caps are the last clause because they are what the rest could break
 * by being generous: the pools are fixed (Section 15), and a flash that was
 * added to the scene per shot would recompile every lit material per shot.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { qualityParticles } from '../quality.js';
import { createLens, meanLumaIn } from './pixels.js';
import { findGroundLedge, driveAtLedge } from './climbpress.js';
import { findTallFace } from './scuff.js';

const S = CONFIG.shade;
const E = CONFIG.effects;
const D = E.dust;
const DT = CONFIG.time.fixedDt;

/** A quiet competitive match with the AI off, so nothing but the check moves. */
function quiet(h) {
  h.input.clearAll();
  h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });
  h.menu.hide();
  h.setPaused(false);
  h.stepFrames(10);
  h.effects.reset();
}

/** Motes the dust has spawned across `step()`, which is all of one landing's puff. */
function dropFrom(h, drop) {
  const shade = h.shade;
  const spawn = h.map.shadeSpawns[0];
  shade.reset(spawn);
  h.stepFrames(10);
  const floorY = shade.feetY;
  shade.reset({ position: { x: shade.position.x, y: floorY + drop, z: shade.position.z }, yaw: 0 });
  const before = h.effects.dust.spawned;
  let fell = 0;
  for (let i = 0; i < Math.round(5 / DT); i++) {
    h.stepFrames(1);
    if (shade.landedFallHeight > 0) fell = shade.landedFallHeight;
    if (shade.grounded && i > 4) break;
  }
  return { count: h.effects.dust.spawned - before, fell };
}

/** Live motes in a pool of `{life}` slots. */
function live(slots) {
  let n = 0;
  for (const slot of slots) if (slot.life > 0) n++;
  return n;
}

/** The scene's point lights: the number three compiles every lit material against. */
function pointLights(h) {
  let n = 0;
  h.scene.traverse((object) => { if (object.isPointLight) n++; });
  return n;
}

/**
 * Hold the trigger until a round leaves, one frame at a time through the
 * frame the loop runs, and let go. Returns the aim of the shot.
 */
function fire(h) {
  let aim = null;
  const off = h.emitter.on('combat:shot', (event) => { aim = { ...event.direction }; });
  const before = h.combat.shots;
  h.input.heldCodes.add('Mouse0');
  for (let i = 0; i < 8 && h.combat.shots === before; i++) h.renderFrame();
  h.input.heldCodes.delete('Mouse0');
  off();
  return h.combat.shots > before ? aim : null;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-landing-a-scuff-and-a-shot-leave-a-mark-you-can-see',
    spec: 'Section 15 (particles), Section 4.1 (one shadowed light); J6',
    name: 'A fall puffs dust by its height and a step down none, a scuff puffs at the hands, a shot lights one unshadowed frame, a hand on metal sparks and on concrete does not, and every pool holds its cap',
    run: async (h) => {
      const problems = [];
      const notes = [];
      const effects = h.effects;
      const dust = effects.dust;

      try {
        // -- (a) Dust by fall height. ---------------------------------------
        quiet(h);
        const step = dropFrom(h, 0.2);
        const low = dropFrom(h, 1.0);
        const tall = dropFrom(h, 3.0);
        if (low.count <= 0) problems.push(`a ${low.fell.toFixed(2)}m fall made no dust`);
        if (tall.count <= 0) problems.push(`a ${tall.fell.toFixed(2)}m fall made no dust`);
        if (!(tall.count > low.count)) problems.push(`the ${tall.fell.toFixed(2)}m fall made ${tall.count} motes and the ${low.fell.toFixed(2)}m one ${low.count}, want the taller to make more`);
        if (step.count !== 0) problems.push(`a ${step.fell.toFixed(2)}m step down made ${step.count} motes, want none under ${D.minFall}m`);
        if (tall.count > qualityParticles(D.countMax)) problems.push(`the tallest fall made ${tall.count} motes, past the ${qualityParticles(D.countMax)} a full ring is`);
        notes.push(`dust by fall: ${step.fell.toFixed(2)}m ${step.count} motes, ${low.fell.toFixed(2)}m ${low.count}, ${tall.fell.toFixed(2)}m ${tall.count} (floor ${D.minFall}m)`);

        // -- (d) The scuff's puff. -----------------------------------------
        quiet(h);
        const reach = S.reach.standing + S.reach.jumpBonus;
        const wall = findTallFace(h, reach + 0.3);
        if (!wall) {
          problems.push(`no ground-level face ${(reach + 0.3).toFixed(1)}m tall was found to scuff against`);
        } else {
          const shade = h.shade;
          shade.reset({ position: { x: wall.x, y: CONFIG.map.groundY, z: wall.z }, yaw: wall.yaw });
          h.stepFrames(2);
          h.input.clearAll();
          h.effects.reset();
          h.input.heldCodes.add('KeyW');
          const scuffs = shade.scuffs;
          let read = null;
          for (let i = 0; i < 40 && !read; i++) {
            if (i === 5) {
              h.input.heldCodes.add('Space');
              h.input.pressedCodes.add('Space');
            }
            const before = dust.spawned;
            h.stepFrames(1);
            h.input.clearEdges();
            h.input.heldCodes.delete('Space');
            if (shade.scuffs > scuffs && shade.scuffedAt) {
              const at = { ...shade.scuffedAt };
              let nearest = Infinity;
              let fresh = 0;
              for (const slot of dust.slots) {
                if (!(slot.life > 0) || slot.age > DT * 1.5) continue;
                fresh++;
                nearest = Math.min(nearest, Math.hypot(slot.x - at.x, slot.y - at.y, slot.z - at.z));
              }
              read = { spawned: dust.spawned - before, fresh, nearest, at };
            }
          }
          h.input.clearAll();
          if (!read) problems.push(`the press into ${wall.box.tag || 'the wall'} never scuffed`);
          else {
            if (read.fresh === 0) problems.push('the scuff step left no fresh mote anywhere');
            else if (!(read.nearest <= 0.06)) problems.push(`the scuff's nearest mote is ${(read.nearest * 100).toFixed(1)}cm from the hands, want within 6cm`);
            if (read.spawned > qualityParticles(D.countMin)) problems.push(`the scuff made ${read.spawned} motes, more than the landing's smallest ${qualityParticles(D.countMin)}`);
            notes.push(`scuff: ${read.spawned} motes, nearest ${(read.nearest * 100).toFixed(1)}cm from the hands at y=${read.at.y.toFixed(2)}`);
          }
        }

        // -- (e) Sparks on a hand-plant: metal and concrete. ----------------
        quiet(h);
        const hangMin = S.standHeight * S.hangMinHeightRatio;
        const spot = findGroundLedge(h, hangMin + 0.05, S.hangMaxHeight, { hangable: true });
        if (!spot) {
          problems.push(`no ground-level ledge between ${(hangMin + 0.05).toFixed(2)}m and ${S.hangMaxHeight}m to hang from was found`);
        } else {
          const planted = [];
          const off = h.emitter.on('shade:grab', (event) => {
            // The effects subscribed first, so the sparks of this very grab are in the pool.
            planted.push({ surface: event.surface, sparks: live(effects.particles) });
          });
          const plant = (surface) => {
            const was = spot.box.surface;
            if (surface) spot.box.surface = surface;
            effects.reset();
            planted.length = 0;
            const run = driveAtLedge(h, spot, { airborne: false, pressAt: 5, hold: false, steps: 40 });
            spot.box.surface = was;
            return { run, grab: planted[0] || null };
          };
          const metal = plant(null);
          // No ledge that can be hung from is concrete on either map (the decks
          // are 2.7m over the nearest roof), so the same lip is called what it
          // is not for one grab: the hand and the geometry are the metal's.
          const concrete = plant('concrete');
          off();
          const tag = spot.box.tag || 'the ledge';
          if (!metal.grab) problems.push(`the tap at ${tag} never planted a hand`);
          else {
            if (!E.metalFinishes.includes(metal.grab.surface)) problems.push(`${tag} reports its surface as "${metal.grab.surface}", which is not one of ${E.metalFinishes.join('/')}`);
            if (metal.grab.sparks < 1) problems.push(`a hand on ${metal.grab.surface} ${tag} threw ${metal.grab.sparks} sparks`);
          }
          if (!concrete.grab) problems.push(`the tap at ${tag} called concrete never planted a hand`);
          else if (concrete.grab.sparks !== 0) problems.push(`a hand on concrete threw ${concrete.grab.sparks} sparks, want none`);
          notes.push(`hand-plant on ${tag}: ${metal.grab ? `${metal.grab.surface} threw ${metal.grab.sparks} sparks` : 'no grab'}, concrete ${concrete.grab ? `${concrete.grab.sparks}` : 'no grab'}`);
        }

        // -- (b), (c) The muzzle flash. -------------------------------------
        h.input.clearAll();
        h.initMatch({ mode: 'freeroam', role: 'warden', ai: false, objective: false });
        h.menu.hide();
        h.setPaused(false);
        h.stepFrames(30);
        h.renderFrame();
        const light = dust.muzzleLight;
        const lights = pointLights(h);
        if (light.castShadow) problems.push('the muzzle flash casts a shadow');
        if (!light.parent) problems.push('the muzzle flash is not in the scene before a shot');
        if (light.intensity !== 0) problems.push(`the muzzle flash is lit (${light.intensity}) with nothing fired`);

        const aim = fire(h);
        if (!aim) {
          problems.push('holding the trigger fired nothing in 8 frames');
        } else {
          const lit = light.intensity;
          if (!(lit > 0)) problems.push('on the frame of the shot the flash is dark');
          if (pointLights(h) !== lights) problems.push(`a shot changed the scene's point lights from ${lights} to ${pointLights(h)}`);

          // (b) The picture of that frame, against the same one with the lamp out.
          const lens = createLens(h);
          let onLuma = 0;
          let offLuma = 0;
          try {
            const m = light.position;
            const right = { x: aim.z, z: -aim.x };
            const norm = Math.hypot(right.x, right.z) || 1;
            lens.look(
              { x: m.x + (right.x / norm) * 1.4 - aim.x * 0.8, y: m.y + 0.5, z: m.z + (right.z / norm) * 1.4 - aim.z * 0.8 },
              { x: m.x + aim.x * 1.5, y: m.y, z: m.z + aim.z * 1.5 }
            );
            onLuma = meanLumaIn(lens.grab(), lens.width, lens.height, 0.5);
            light.intensity = 0;
            offLuma = meanLumaIn(lens.grab(), lens.width, lens.height, 0.5);
            light.intensity = lit;
          } finally {
            lens.restore();
          }
          if (!(onLuma - offLuma >= 4)) problems.push(`the flash frame reads ${onLuma.toFixed(2)} near the muzzle against ${offLuma.toFixed(2)} without it, want at least 4 brighter`);
          notes.push(`flash near the muzzle: lit ${onLuma.toFixed(2)}, out ${offLuma.toFixed(2)}, +${(onLuma - offLuma).toFixed(2)} luma`);

          // (c) Lit for exactly the frame of the shot.
          h.renderFrame();
          if (light.intensity !== 0) problems.push(`the frame after the shot still has the flash at ${light.intensity}`);
          h.renderFrame();
          if (light.intensity !== 0) problems.push('the flash came back with nothing fired');
          notes.push(`flash: ${lit} cd on the frame of the shot, 0 on the next, castShadow ${light.castShadow}, ${lights} point lights before and after`);
        }

        // -- (f) The caps. --------------------------------------------------
        quiet(h);
        const poolDust = dust.slots.length;
        const poolSparks = effects.particles.length;
        const attrDust = dust.mesh.geometry.attributes.position.count;
        const lightsBefore = pointLights(h);
        const at = { x: h.shade.position.x, y: h.shade.feetY, z: h.shade.position.z };
        const direction = { x: 0, y: 0, z: -1 };
        let peakDust = 0;
        let peakSparks = 0;
        for (let i = 0; i < 200; i++) {
          h.emitter.emit('shade:land', { ...at, fall: 4 });
          h.emitter.emit('combat:shot', { actor: 'warden', origin: { x: at.x, y: at.y + 1.6, z: at.z }, direction, spread: 0 });
          h.emitter.emit('combat:impact', { at: { x: at.x, y: at.y + 1, z: at.z - 3 }, target: 'world' });
          h.stepFrames(1);
          peakDust = Math.max(peakDust, live(dust.slots));
          peakSparks = Math.max(peakSparks, live(effects.particles));
        }
        if (dust.slots.length !== poolDust || attrDust !== D.poolSize) problems.push(`the dust pool is ${dust.slots.length} slots and ${attrDust} vertices, want ${D.poolSize}`);
        if (effects.particles.length !== poolSparks) problems.push(`the spark pool grew from ${poolSparks} to ${effects.particles.length}`);
        if (peakDust > D.poolSize) problems.push(`${peakDust} motes live in a pool of ${D.poolSize}`);
        if (peakSparks > E.particlePoolSize) problems.push(`${peakSparks} sparks live in a pool of ${E.particlePoolSize}`);
        if (peakDust < D.poolSize) problems.push(`200 full landings only filled ${peakDust} of ${D.poolSize} dust slots, so the cap was never reached`);
        if (pointLights(h) !== lightsBefore) problems.push(`200 shots changed the scene's point lights from ${lightsBefore} to ${pointLights(h)}`);
        let idleAt = -1;
        const window = Math.round(E.idleAssertionWindow / DT);
        for (let i = 0; i < window; i++) {
          if (effects.activeCount === 0) { idleAt = i; break; }
          h.stepFrames(1);
        }
        if (idleAt < 0) problems.push(`${effects.activeCount} effects still active ${E.idleAssertionWindow}s after the last of 200 landings and shots`);
        notes.push(`caps: 200 landings, shots and impacts peaked at ${peakDust}/${D.poolSize} dust and ${peakSparks}/${E.particlePoolSize} sparks, idle in ${idleAt < 0 ? 'never' : `${(idleAt * DT).toFixed(2)}s`} (window ${E.idleAssertionWindow}s)`);
      } finally {
        h.input.clearAll();
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
        h.menu.hide();
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0 ? notes.join('; ') : problems.join('; '),
      };
    },
  });
}
