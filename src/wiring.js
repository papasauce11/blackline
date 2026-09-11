/**
 * BLACKLINE — wiring.js
 *
 * The emitter listeners the composition root hangs between systems: a
 * message from one system that becomes a call on another, or a line on the
 * HUD. Systems never import each other (Section 3.1); this is where their
 * events meet. Called once from bootstrap after every system exists.
 */

/**
 * @param {object} s the built systems and actors, by name
 * @param {() => boolean} s.isGodMode Section 17.1 test mode, read live
 */
export function wireMatchEvents(s) {
  const { emitter, hud, audio, combat, shade, warden, deathCam, effects, scoreboard, objective, gadgets } = s;

  // Frag blasts are damage from outside combat; combat still owns applying it.
  emitter.on('gadget:damage', (event) => {
    if (s.isGodMode()) return;
    if (event.target === 'shade') combat.applyDamage(shade, event.amount, 'shade', event.source);
  });
  emitter.on('objective:life-lost', (event) => {
    hud.push(`life lost - ${event.remaining} left`);
    audio.play('lifeLost');
  });
  emitter.on('deathcam:guard', (event) => {
    // Loud on purpose. This firing means the countdown stopped advancing, which
    // is a bug somewhere upstream; the guard is the safety net, not the design.
    console.warn(`[deathcam] wall-clock guard fired after ${event.after.toFixed(2)}s — forced the reinsert`);
  });
  emitter.on('objective:planted', (event) => hud.push(`charge armed at ${event.site}`));
  // Section 9.2: the siren, the HUD ping, and the Shade marked for 2s. The
  // marking itself lives on gadgets; this is the ping.
  emitter.on('gadget:alarm', () => hud.push('ALARM - shade detected'));
  emitter.on('gadget:alarm-destroyed', (event) => hud.push(`alarm camera destroyed (${event.by})`));
  emitter.on('combat:takedown', () => hud.push('takedown'));
  emitter.on('combat:knife-hit', (event) => hud.push(`knife hit - warden ${Math.round(event.remaining)}`));
  // Section 10.2: the Shade's death takes a life, ragdolls the body and hands
  // the camera to a free-look view of the killer for the countdown.
  emitter.on('combat:death', (event) => {
    if (event.target !== 'shade') return;
    deathCam.begin(shade, warden);
  });
  emitter.on('objective:round-end', () => deathCam.restore());
  // Section 15's ragdoll-lite. A body that stays is also the only feedback
  // that a takedown actually landed on something.
  emitter.on('combat:death', (event) => {
    if (event.target !== 'warden') return;
    warden.ragdolled = true;
    const dx = warden.position.x - shade.position.x;
    const dz = warden.position.z - shade.position.z;
    const length = Math.hypot(dx, dz) || 1;
    warden.mesh.position.set(warden.position.x, warden.feetY, warden.position.z);
    effects.ragdoll(warden.mesh, { x: dx / length, z: dz / length });
    hud.push('warden down');
  });
  emitter.on('objective:round-end', () => {
    scoreboard.show({ rounds: objective.rounds, score: objective.score, matchOver: objective.matchOver });
  });
  emitter.on('ai:throw', (event) => {
    const from = { x: warden.position.x, y: warden.eyeY, z: warden.position.z };
    const dx = event.at.x - from.x;
    const dz = event.at.z - from.z;
    const length = Math.hypot(dx, dz) || 1;
    gadgets.throwGadget(event.type, from, { x: dx / length, y: 0.2, z: dz / length }, 'warden');
  });
}
