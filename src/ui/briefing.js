/**
 * BLACKLINE — ui/briefing.js
 *
 * The round-start briefing and controls card (C2). Per role: the objective
 * in one line, the three sites named, the controls. It goes up on the
 * player's routes into a round - Play, Free roam, Next round - never from
 * `initMatch` itself, which every AUTO check calls; and it holds the round
 * until any key or mouse button, which the frame reads through the Input
 * the way it reads Esc and spends, so the key that starts the round is not
 * also a jump. `SETTINGS.briefing` is the setting that skips it.
 *
 * Layering (Section 3.1): imports config only. It is handed the match, the
 * round number, the sites and the live bindings and renders them; the
 * controls are read from the bindings so a rebind shows the key you would
 * press, and the numbers are the round's own, so the card cannot disagree
 * with the rule it describes.
 */

import { CONFIG } from '../config.js';

const P = CONFIG.palette;
const R = CONFIG.round;
const hex = (value) => `#${value.toString(16).padStart(6, '0')}`;

const CSS = `
#bl-briefing {
  position: fixed; inset: 0; z-index: 30; display: none; align-items: center;
  justify-content: center; background: rgba(10,13,16,0.9);
  font: 12px/1.7 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: ${hex(P.shadeTeal)}; letter-spacing: 0.1em; text-transform: uppercase;
}
#bl-briefing.open { display: flex; }
#bl-briefing.warden { color: ${hex(P.wardenOrange)}; }
#bl-briefing .card { min-width: 460px; max-width: 560px; }
#bl-briefing h1 { font-size: 22px; letter-spacing: 0.3em; margin: 0 0 2px; }
#bl-briefing .sub { opacity: 0.55; font-size: 11px; margin-bottom: 18px; }
#bl-briefing .objective { font-size: 13px; line-height: 1.6; margin-bottom: 14px; }
#bl-briefing .sites { margin-bottom: 18px; opacity: 0.85; }
#bl-briefing .sites b { font-weight: normal; color: ${hex(P.hazardOrange)}; }
#bl-briefing table { width: 100%; border-collapse: collapse; }
#bl-briefing td { padding: 4px 0; border-top: 1px solid rgba(255,255,255,0.08); }
#bl-briefing td.key { width: 34%; opacity: 1; }
#bl-briefing td.does { opacity: 0.7; }
#bl-briefing .foot { margin-top: 22px; opacity: 0.55; font-size: 11px; }
`;

/** What a `KeyboardEvent.code` (or MouseN) reads as on the card. */
const KEY_LABELS = {
  Space: 'Space', Escape: 'Esc', Tab: 'Tab', Enter: 'Enter',
  ControlLeft: 'Ctrl', ControlRight: 'Ctrl', ShiftLeft: 'Shift', ShiftRight: 'Shift',
  AltLeft: 'Alt', AltRight: 'Alt',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB',
};

export function keyLabel(code) {
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  return code.replace(/^(Key|Digit)/, '');
}

/** Every key bound to an action, `W / Up`; the first alone for a cluster. */
function keys(bindings, action, firstOnly = false) {
  const codes = bindings[action] || [];
  if (!codes.length) return 'unbound';
  return (firstOnly ? codes.slice(0, 1) : codes).map(keyLabel).join(' / ');
}

/** The one line that says what this round is for. */
function objectiveLine(match, bindings) {
  const interact = keys(bindings, 'interact', true);
  if (!match.objectiveEnabled) {
    return 'Free roam: no opponent, no clock, no score. Learn the map, feel the gun, try the gadgets.';
  }
  if (match.role === 'warden') {
    return `Find the Shade before it plants. Once it has, stand at the charge and hold ${interact} `
      + `for ${R.defuseHoldTime} seconds to defuse it before the ${R.detonationTime}-second clock runs out.`;
  }
  return `Plant the charge anywhere in a site room - hold ${interact} for ${R.plantHoldTime} seconds - `
    + `and keep the Warden off it for ${R.detonationTime} seconds. ${CONFIG.shade.lives} lives; `
    + `${Math.round(R.duration / 60)} minutes to plant.`;
}

/** The rows of the controls table for a role: `[keys, what it does]`. */
function controlRows(match, bindings) {
  const b = bindings;
  const move = ['forward', 'left', 'back', 'right'].map((a) => keys(b, a, true)).join(' ');
  const rows = [
    [move, 'move'],
    ['Mouse', 'look'],
    [keys(b, 'sprint'), 'sprint'],
  ];
  if (match.role === 'warden') {
    rows.push(
      [keys(b, 'fire'), 'fire'],
      [keys(b, 'ads'), 'aim down sights'],
      [keys(b, 'reload'), 'reload'],
    );
    if (match.objectiveEnabled) rows.push([keys(b, 'interact'), 'defuse - hold at the charge']);
    rows.push([[1, 2, 3].map((n) => keys(b, `gadget${n}`, true)).join(' '), 'stun grenade, frag, alarm camera']);
  } else {
    rows.push(
      [keys(b, 'crouch'), 'crouch - slide from a sprint'],
      [keys(b, 'jump'), 'jump, climb - at a high ledge tap to hang, hold to go over'],
    );
    if (match.objectiveEnabled) rows.push([keys(b, 'interact'), 'plant - hold in a site room']);
    rows.push(
      [keys(b, 'melee'), 'knife'],
      [[1, 2, 3].map((n) => keys(b, `gadget${n}`, true)).join(' '), 'smoke, flashbang, taser'],
    );
  }
  rows.push([keys(b, 'pause'), 'pause']);
  return rows;
}

export class Briefing {
  constructor() {
    this.style = document.createElement('style');
    this.style.textContent = CSS;
    document.head.appendChild(this.style);

    this.root = document.createElement('div');
    this.root.id = 'bl-briefing';
    document.body.appendChild(this.root);
  }

  dispose() {
    this.root.remove();
    this.style.remove();
  }

  get open() {
    return this.root.classList.contains('open');
  }

  /** Everything on the card, as one string a check can read. */
  get text() {
    return this.root.textContent;
  }

  hide() {
    this.root.classList.remove('open');
  }

  /**
   * The press that starts the round. Spent - held keys and edges dropped -
   * so a Space that dismissed the card is not also the round's first jump,
   * and an Esc is not also a pause.
   * @param {import('../input.js').Input} input
   */
  dismiss(input) {
    this.hide();
    input.clearAll();
  }

  /**
   * @param {object} state
   * @param {object} state.match the match record (`role`, `mode`, `objectiveEnabled`)
   * @param {number} state.round the round about to start
   * @param {{id:string,name:string}[]} state.sites the map's plant sites
   * @param {Record<string,string[]>} state.bindings the Input's live action map
   * @param {string} [state.mapName] the map's name, after the sites (D1)
   */
  show({ match, round, sites, bindings, mapName }) {
    const warden = match.role === 'warden';
    const heading = match.objectiveEnabled ? `Round ${round}` : 'Free roam';
    const where = mapName ? ` &middot; <i>${mapName}</i>` : '';
    this.root.classList.toggle('warden', warden);
    this.root.innerHTML = `
      <div class="card">
        <h1>${heading}</h1>
        <div class="sub">you are the ${warden ? 'Warden' : 'Shade'}</div>
        <div class="objective">${objectiveLine(match, bindings)}</div>
        <div class="sites">${(sites || []).map((site) => `<span><b>${site.id}</b> ${site.name}</span>`).join(' &middot; ')}${where}</div>
        <table><tbody>
          ${controlRows(match, bindings).map(([key, does]) => `
            <tr><td class="key">${key}</td><td class="does">${does}</td></tr>`).join('')}
        </tbody></table>
        <div class="foot">any key to start &middot; the briefing can be turned off in settings</div>
      </div>`;
    this.root.classList.add('open');
  }
}

export function createBriefing() {
  return new Briefing();
}
