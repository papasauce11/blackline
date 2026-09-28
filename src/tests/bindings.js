/**
 * BLACKLINE - tests/bindings.js
 *
 * AUTO suite (Section 2, Section 13, H8): rebinding in the settings menu.
 *
 * These exist because of the lesson HANDOFF keeps repeating: a rebind that
 * moves a label is indistinguishable from one that moves the game. So the
 * first check does not assert that `input.bindings.jump` holds `KeyJ` - it
 * presses J at a ledge and requires the body to go over it, then presses
 * Space at the same ledge and requires it not to. The card is the other half
 * of the same bug: a controls table that still says Space is a card that has
 * gone stale against the keys, so the How to play page is read after the
 * rebind and has to have moved with it.
 *
 * Both drive the menu the way a player does - the focus ring, Enter, then the
 * key - rather than calling `rebind()`, because press-to-bind is the part
 * that can be wrong.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG, DEFAULT_BINDINGS } from '../config.js';
import { bindingConflicts } from '../input.js';
import { driveAtLedge, findGroundLedge } from './movement.js';

/** A real key press at the window, the way a player's arrives. */
function press(code) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true, cancelable: true }));
}

/**
 * Rebind one action from the keyboard, on the controls page: put the ring on
 * that action's row, press Enter to start the capture, press the key. Returns
 * what went wrong, so a caller can say which half failed.
 */
function rebindFromTheKeyboard(menu, action, code) {
  const problems = [];
  const index = menu.rows.findIndex((row) => row.el.id === `bl-bind-${action}`);
  if (index === -1) return [`the controls page has no ${action} row`];
  menu.focus = index;
  press('Enter');
  if (menu.binding !== action) problems.push(`Enter on the ${action} row started no capture (binding is ${menu.binding})`);
  press(code);
  if (menu.binding) problems.push(`the capture for ${action} did not end on a key press`);
  return problems;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-rebound-key-is-the-key-that-climbs-and-the-card-says-so',
    spec: 'Section 2, Section 13, H8',
    name: 'Jump rebound to J from the controls page climbs a ledge on J, no longer climbs on Space, and the How to play card names J',
    run: (h) => {
      const problems = [];
      const menu = h.menu;
      const input = h.input;
      let detail = '';
      try {
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: false, objective: false });

        // The page, reached the way a player reaches it: Settings, then
        // Controls. A rebinding page nothing links to is not in the menu.
        menu.show('settings');
        const toControls = menu.root.querySelector('[data-action=controls]');
        if (!toControls) problems.push('the settings page has no controls button');
        else toControls.click();
        if (menu.page !== 'controls') problems.push(`the controls button left the menu on "${menu.page}"`);

        problems.push(...rebindFromTheKeyboard(menu, 'jump', 'KeyJ'));

        const bound = input.getBinding('jump');
        if (bound[0] !== 'KeyJ') problems.push(`jump is bound to [${bound.join(', ')}] after pressing J`);
        // Binding a key must not also fire it. The Input's own listener runs
        // before the menu's and `preventDefault` does not unsend the event,
        // so J is held and pressed at this moment on the key that has just
        // become jump - and the first step after the menu closes would climb
        // on it. This is how the ledge hunt below found nothing at all the
        // first time: `findGroundLedge` steps three frames per candidate and
        // the body was airborne for every one of them.
        if (input.heldCodes.size || input.pressedCodes.size) {
          problems.push(`the bind left [${[...input.heldCodes, ...input.pressedCodes].join(', ')}] on the input`);
        }
        const row = menu.root.querySelector('#bl-bind-jump');
        if (!row) problems.push('the controls page lost its jump row');
        else if (row.textContent.trim() !== 'J') problems.push(`the jump row reads "${row.textContent.trim()}"`);

        // The card. `controlRows()` is shared with the briefing C2 puts up at
        // round start, so this is both of them.
        menu.show('howto');
        const cells = [...menu.root.querySelectorAll('tr')].map((tr) => [...tr.children].map((td) => td.textContent.trim()));
        const card = cells.find(([, does]) => does && does.indexOf('jump, climb') === 0);
        if (!card) problems.push('the How to play card has no jump row');
        else if (card[0] !== 'J') problems.push(`the How to play card calls jump "${card[0]}" after the rebind`);
        menu.hide();

        // And the half that matters: the key plays. A ledge inside a standing
        // reach, climbed on a hold, first on J and then on the key J replaced.
        const spot = findGroundLedge(h, 1.2, 2.4);
        if (!spot) {
          problems.push('no ground ledge between 1.2m and 2.4m to climb');
        } else {
          const rise = (spot.box.max.y - CONFIG.map.groundY).toFixed(2);
          const onJ = driveAtLedge(h, spot, { airborne: false, pressAt: 5, hold: true, steps: 90, code: 'KeyJ' });
          if (!onJ.onTop) problems.push(`holding J at a ${rise}m ledge did not climb it (${onJ.states})`);
          const onSpace = driveAtLedge(h, spot, { airborne: false, pressAt: 5, hold: true, steps: 90, code: 'Space' });
          if (onSpace.onTop) problems.push('Space still climbed the ledge after jump was rebound away from it');
          detail = `a ${rise}m ledge: J climbs it (${onJ.feet.toFixed(2)}m), Space no longer does (${onSpace.feet.toFixed(2)}m)`;
        }
      } finally {
        // Bindings are game state, not presentation, so the runner will not
        // put them back (F2, TRAPS.md): a check that left jump on J would
        // hand it to every check after it.
        input.resetBindings();
        menu.binding = null;
        menu.hide();
      }
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${detail}; the How to play card says J`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'a-key-bound-twice-is-shown-on-both-rows-and-a-row-restores-its-own-default',
    spec: 'Section 2, Section 13, H8',
    name: 'Binding melee to jump\'s key marks both rows, both actions really fire on it, and resetting one row restores that row alone',
    run: (h) => {
      const problems = [];
      const menu = h.menu;
      const input = h.input;
      const clashText = (action) => {
        const el = menu.root.querySelector(`#bl-clash-${action}`);
        return el ? el.textContent.trim() : '(no row)';
      };
      try {
        menu.show('controls');
        // Space is jump's, and melee is asked for it. A conflict is shown and
        // never refused (H8): the game will fire both, and a player who wants
        // two things on one key is entitled to them. What the page owes is
        // that they know.
        problems.push(...rebindFromTheKeyboard(menu, 'melee', 'Space'));

        const clashes = bindingConflicts(input.bindings);
        const onSpace = clashes.get('Space') || [];
        if (onSpace.indexOf('jump') === -1 || onSpace.indexOf('melee') === -1) {
          problems.push(`Space reads as bound to [${onSpace.join(', ')}]`);
        }
        if (clashText('melee').indexOf('jump') === -1) problems.push(`the melee row says "${clashText('melee')}"`);
        if (clashText('jump').indexOf('melee') === -1) problems.push(`the jump row says "${clashText('jump')}"`);

        // The conflict is a fact about the game and not a label: one press of
        // the code, and the input answers for both actions.
        input.clearAll();
        input.pressedCodes.add('Space');
        input.heldCodes.add('Space');
        if (!input.pressed('jump') || !input.pressed('melee')) {
          problems.push('a code bound to two actions did not fire both');
        }
        input.clearAll();

        // Defaults restored per row: melee back, jump untouched.
        const reset = menu.root.querySelector('#bl-bindreset-melee');
        if (!reset) problems.push('the melee row has no reset');
        else reset.click();
        const melee = input.getBinding('melee');
        if (melee.join(',') !== DEFAULT_BINDINGS.melee.join(',')) {
          problems.push(`resetting the melee row left it on [${melee.join(', ')}]`);
        }
        const jump = input.getBinding('jump');
        if (jump.join(',') !== DEFAULT_BINDINGS.jump.join(',')) {
          problems.push(`resetting the melee row moved jump to [${jump.join(', ')}]`);
        }
        if (clashText('melee') !== '' || clashText('jump') !== '') {
          problems.push(`the rows still read "${clashText('melee')}" / "${clashText('jump')}" once the clash is gone`);
        }
        // Every action has a row, or "every action" is a claim the page does
        // not keep.
        for (const action of Object.keys(DEFAULT_BINDINGS)) {
          if (!menu.root.querySelector(`#bl-bind-${action}`)) problems.push(`no row for "${action}"`);
          if (!menu.root.querySelector(`#bl-bindreset-${action}`)) problems.push(`no reset for "${action}"`);
        }
      } finally {
        input.resetBindings();
        menu.binding = null;
        menu.hide();
      }
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${Object.keys(DEFAULT_BINDINGS).length} actions each with a row and a reset; `
            + 'a shared code is shown on both rows and fires both; one reset moves one row'
          : problems.join('; '),
      };
    },
  });
}
