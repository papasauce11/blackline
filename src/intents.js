/**
 * BLACKLINE — intents.js
 *
 * Raw input to controller intent. Each reader fills the one intent object it
 * is handed, so the fixed step stays allocation-free; edge flags are true only
 * on the first step of a frame, because main.js clears input edges after each
 * step. The AI fills the same Warden intent by its own route (systems/ai.js);
 * Section 12 requires free-roam to be a configuration, never a second path
 * into the controller, and these are the human's half of that.
 */

/** The human driving the Shade. */
export function readShadeIntent(input, intent) {
  intent.forward = input.axis('back', 'forward');
  intent.strafe = input.axis('left', 'right');
  intent.jump = input.down('jump');
  intent.jumpPressed = input.pressed('jump');
  intent.crouch = input.down('crouch');
  intent.crouchPressed = input.pressed('crouch');
  intent.sprint = input.down('sprint');
  intent.melee = input.pressed('melee');
  intent.interact = input.down('interact');
  intent.gadget = input.pressed('gadget1') ? 1
    : input.pressed('gadget2') ? 2
      : input.pressed('gadget3') ? 3 : 0;
  return intent;
}

/** Neutral Shade intent, for when the human is driving something else. */
export function idleShadeIntent(intent) {
  intent.forward = 0;
  intent.strafe = 0;
  intent.jump = false;
  intent.jumpPressed = false;
  intent.crouch = false;
  intent.crouchPressed = false;
  intent.sprint = false;
  return intent;
}

/** Section 12: free-roam feeds the same controller the AI will feed. */
export function readWardenIntent(input, intent) {
  intent.forward = input.axis('back', 'forward');
  intent.strafe = input.axis('left', 'right');
  intent.sprint = input.down('sprint');
  intent.ads = input.down('ads');
  intent.fire = input.down('fire');
  intent.reload = input.pressed('reload');
  intent.gadget = input.pressed('gadget1') ? 1
    : input.pressed('gadget2') ? 2
      : input.pressed('gadget3') ? 3 : 0;
  return intent;
}
