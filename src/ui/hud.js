/**
 * BLACKLINE — ui/hud.js
 *
 * The in-game overlay (Section 13). DOM, not rendered in the 3D scene.
 *
 * Layering (Section 3.1): ui may import from systems, entities and config. It
 * imports config only and reads everything else from the state object the
 * composition root passes to `update()`, so the HUD cannot drive the game — it
 * can only describe it.
 *
 * Section 4.2 matters here as much as in the renderer: the visibility bar and
 * the Shade's on-screen brightness are two readouts of the same smoothed value.
 * The bar reads it; it never computes its own.
 */

import { CONFIG } from '../config.js';

const H = CONFIG.hud;
const P = CONFIG.palette;

/**
 * What a refused plant says (D6). The whole of what it produces: no sound, no
 * noise event, no progress that starts and then stops - a line, so that an
 * interact key doing nothing is never left to be read as a broken key. It is
 * the marking problem inverted: an unmarked rule the player cannot see.
 */
export const PLANT_REFUSED = 'cannot plant here';

const hex = (value) => `#${value.toString(16).padStart(6, '0')}`;

const CSS = `
#bl-hud {
  position: fixed; inset: 0; pointer-events: none; z-index: 20;
  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: ${hex(P.shadeTeal)}; user-select: none;
}
#bl-hud .panel { position: absolute; }
#bl-vis { left: 26px; top: 50%; transform: translateY(-50%); width: 10px;
  height: ${H.visibilityBarHeight}px; background: rgba(255,255,255,0.07);
  border: 1px solid rgba(47,214,195,0.35); }
#bl-vis-fill { position: absolute; left: 0; right: 0; bottom: 0; height: 0%;
  background: ${hex(P.shadeTeal)}; transition: none; }
#bl-vis-label { position: absolute; left: 0; top: -18px; font-size: 10px; opacity: 0.7; }
#bl-bottom-left { left: 26px; bottom: 26px; }
#bl-lives { display: flex; gap: 6px; margin-bottom: 8px; }
#bl-lives i { width: 14px; height: 14px; border: 1px solid ${hex(P.shadeTeal)};
  background: ${hex(P.shadeTeal)}; display: block; }
#bl-lives i.spent { background: transparent; opacity: 0.25; }
#bl-health { width: 150px; height: 4px; background: rgba(255,255,255,0.12); margin-bottom: 10px; }
#bl-health span { display: block; height: 100%; width: 100%; background: ${hex(P.shadeTeal)}; }
#bl-gadgets { display: flex; gap: 14px; align-items: center; }
#bl-gadgets div { opacity: 0.85; }
#bl-taser { position: relative; width: 26px; height: 26px; }
#bl-taser svg { position: absolute; inset: 0; }
#bl-top { left: 50%; top: 22px; transform: translateX(-50%); text-align: center; }
#bl-timer { font-size: 22px; letter-spacing: 0.14em; }
#bl-charge { font-size: 11px; opacity: 0.8; margin-top: 4px; }
#bl-charge.armed { color: ${hex(P.hazardOrange)}; opacity: 1; }
#bl-score { position: absolute; right: 26px; top: 22px; text-align: right; }
#bl-prompt { left: 50%; bottom: 30%; transform: translateX(-50%); text-align: center;
  font-size: 13px; display: none; }
#bl-prompt .bar { width: 180px; height: 3px; background: rgba(255,255,255,0.15); margin-top: 6px; }
#bl-prompt .bar span { display: block; height: 100%; width: 0%; background: ${hex(P.hazardOrange)}; }
#bl-prompt.refused .text { color: ${hex(P.hazardOrange)}; }
#bl-prompt.refused .bar { display: none; }
#bl-centre { left: 50%; top: 50%; transform: translate(-50%,-50%); text-align: center; display: none; }
#bl-centre .big { font-size: 46px; letter-spacing: 0.1em; }
#bl-feed { right: 26px; top: 70px; text-align: right; }
#bl-feed div { opacity: 0.75; margin-bottom: 3px; font-size: 11px; }
#bl-crosshair { left: 50%; top: 50%; transform: translate(-50%,-50%);
  width: 40px; height: 40px; display: none; }
#bl-crosshair i { position: absolute; background: ${hex(P.wardenOrange)}; }
/* Section 13's Warden HUD: ammo, gadget counts, health, crosshair. */
#bl-w-panel { display: none; color: ${hex(P.wardenOrange)}; }
#bl-w-ammo { font-size: 24px; letter-spacing: 0.1em; line-height: 1.1; }
#bl-w-ammo.reloading { opacity: 0.45; }
#bl-w-gadgets { font-size: 11px; opacity: 0.85; margin-top: 3px; }
#bl-flash { position: fixed; inset: 0; background: #fff; opacity: 0; pointer-events: none; z-index: 25; }
/* Section 9.2: the alarm camera marks the Shade on the Warden HUD for 2s. */
#bl-marked { color: ${hex(P.hazardOrange)}; font-size: 11px; margin-top: 4px; display: none; }
`;

export class Hud {
  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'bl-hud';
    this.root.innerHTML = `
      <div class="panel" id="bl-vis"><div id="bl-vis-label">seen</div><div id="bl-vis-fill"></div></div>
      <div class="panel" id="bl-bottom-left">
        <div id="bl-lives"></div>
        <div id="bl-health"><span></span></div>
        <div id="bl-gadgets">
          <div id="bl-g-smoke">smk 0</div>
          <div id="bl-g-flash">fsh 0</div>
          <div id="bl-taser" title="taser"></div>
        </div>
        <div id="bl-w-panel">
          <div id="bl-w-ammo">30</div>
          <div id="bl-w-gadgets">stun 2 &nbsp; frag 2 &nbsp; cam 1</div>
          <div id="bl-marked">&#9679; shade marked</div>
        </div>
      </div>
      <div class="panel" id="bl-top"><div id="bl-timer">4:00</div><div id="bl-charge">charge carried</div></div>
      <div class="panel" id="bl-score">0 - 0</div>
      <div class="panel" id="bl-feed"></div>
      <div class="panel" id="bl-prompt"><div class="text">hold E to plant</div><div class="bar"><span></span></div></div>
      <div class="panel" id="bl-centre"><div class="big">15</div><div class="sub">reinserting</div></div>
      <div class="panel" id="bl-crosshair"><i></i><i></i><i></i><i></i></div>
    `;

    this.style = document.createElement('style');
    this.style.textContent = CSS;
    document.head.appendChild(this.style);
    document.body.appendChild(this.root);

    this.flash = document.createElement('div');
    this.flash.id = 'bl-flash';
    document.body.appendChild(this.flash);

    this.el = {
      visFill: this.root.querySelector('#bl-vis-fill'),
      lives: this.root.querySelector('#bl-lives'),
      health: this.root.querySelector('#bl-health span'),
      smoke: this.root.querySelector('#bl-g-smoke'),
      flashbang: this.root.querySelector('#bl-g-flash'),
      taser: this.root.querySelector('#bl-taser'),
      timer: this.root.querySelector('#bl-timer'),
      charge: this.root.querySelector('#bl-charge'),
      score: this.root.querySelector('#bl-score'),
      feed: this.root.querySelector('#bl-feed'),
      prompt: this.root.querySelector('#bl-prompt'),
      promptText: this.root.querySelector('#bl-prompt .text'),
      promptBar: this.root.querySelector('#bl-prompt .bar span'),
      centre: this.root.querySelector('#bl-centre'),
      centreBig: this.root.querySelector('#bl-centre .big'),
      centreSub: this.root.querySelector('#bl-centre .sub'),
      crosshair: this.root.querySelector('#bl-crosshair'),
      crossBars: [...this.root.querySelectorAll('#bl-crosshair i')],
      shadeGadgets: this.root.querySelector('#bl-gadgets'),
      wardenPanel: this.root.querySelector('#bl-w-panel'),
      wardenAmmo: this.root.querySelector('#bl-w-ammo'),
      wardenGadgets: this.root.querySelector('#bl-w-gadgets'),
      marked: this.root.querySelector('#bl-marked'),
      top: this.root.querySelector('#bl-top'),
      scorePanel: this.root.querySelector('#bl-score'),
    };

    // Section 13: three pips, dimming as they are spent.
    this._pips = [];
    for (let i = 0; i < H.livesPips; i++) {
      const pip = document.createElement('i');
      this.el.lives.appendChild(pip);
      this._pips.push(pip);
    }

    this.el.taser.innerHTML =
      `<svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="11" fill="none" stroke="rgba(47,214,195,0.25)" stroke-width="2"/>` +
      `<circle id="bl-taser-arc" cx="13" cy="13" r="11" fill="none" stroke="${hex(P.shadeTeal)}" stroke-width="2"` +
      ` stroke-dasharray="69.1" stroke-dashoffset="0" transform="rotate(-90 13 13)"/></svg>`;
    this.el.taserArc = this.el.taser.querySelector('#bl-taser-arc');

    /** @type {{text:string, life:number}[]} */
    this.feed = [];
    this.visible = true;
  }

  setVisible(visible) {
    this.visible = visible;
    this.root.style.display = visible ? 'block' : 'none';
  }

  dispose() {
    this.root.remove();
    this.flash.remove();
    this.style.remove();
  }

  /** Section 13: a kill feed of at most four lines, each living 5s. */
  push(text) {
    this.feed.unshift({ text, life: H.killFeedLineDuration });
    while (this.feed.length > H.killFeedMaxLines) this.feed.pop();
  }

  /**
   * @param {number} dt wall delta
   * @param {object} state everything the HUD shows, gathered by main.js
   */
  update(dt, state) {
    if (!this.visible) return;

    for (let i = this.feed.length - 1; i >= 0; i--) {
      this.feed[i].life -= dt;
      if (this.feed[i].life <= 0) this.feed.splice(i, 1);
    }

    const warden = state.role === 'warden';
    this.el.crosshair.style.display = warden ? 'block' : 'none';
    this.root.querySelector('#bl-vis').style.display = warden ? 'none' : 'block';
    this.root.querySelector('#bl-lives').style.display = warden ? 'none' : 'flex';
    this.el.shadeGadgets.style.display = warden ? 'none' : 'flex';
    this.el.wardenPanel.style.display = warden ? 'block' : 'none';

    if (warden) this._updateWarden(state);
    else this._updateShade(state);

    this._updateCommon(state);
  }

  _updateShade(state) {
    // Section 4.2: the bar reads the smoothed meter. It never computes its own,
    // or it could disagree with the character on screen.
    const visibility = Math.max(0, Math.min(100, state.visibility || 0));
    this.el.visFill.style.height = `${visibility}%`;
    this.el.visFill.style.background =
      visibility >= H.visibilityExposedAbove ? hex(P.hazardOrange)
        : visibility <= H.visibilityHiddenBelow ? 'rgba(47,214,195,0.45)'
          : hex(P.shadeTeal);

    for (let i = 0; i < this._pips.length; i++) {
      this._pips[i].classList.toggle('spent', i >= (state.lives || 0));
    }
    this.el.health.style.width = `${Math.max(0, state.health || 0)}%`;

    const loadout = state.loadout || {};
    this.el.smoke.textContent = `smk ${loadout.smoke || 0}`;
    this.el.flashbang.textContent = `fsh ${loadout.flashbang || 0}`;
    // The taser ring fills as it recharges (Section 13).
    const charged = state.taserCharge > 0 ? 1 : (state.taserRecharge || 0) / CONFIG.gadgets.taser.rechargeTime;
    this.el.taserArc.style.strokeDashoffset = `${69.1 * (1 - charged)}`;
    this.el.taserArc.style.stroke = state.taserCharge > 0 ? hex(P.shadeTeal) : 'rgba(47,214,195,0.5)';
  }

  _updateWarden(state) {
    // Section 13: crosshair with dynamic spread. The gap is the live spread in
    // degrees, so what you see is what the gun is actually doing.
    const gap = H.crosshairMinGap + (state.spread || 0) * H.crosshairPixelsPerDegree;
    const bars = this.el.crossBars;
    const setBar = (index, x, y, w, h) => {
      bars[index].style.left = `${20 + x}px`;
      bars[index].style.top = `${20 + y}px`;
      bars[index].style.width = `${w}px`;
      bars[index].style.height = `${h}px`;
    };
    setBar(0, -gap - 6, -0.5, 6, 1);
    setBar(1, gap, -0.5, 6, 1);
    setBar(2, -0.5, -gap - 6, 1, 6);
    setBar(3, -0.5, gap, 1, 6);

    this.el.health.style.width = `${Math.max(0, state.health || 0)}%`;

    // Ammo and the Section 9.2 gadget counts. Free-roam is unlimited
    // (Section 12), so the counts read as such rather than ticking down.
    const magazine = state.magazine !== undefined ? state.magazine : 0;
    this.el.wardenAmmo.textContent = state.reloading ? '- -' : String(magazine);
    this.el.wardenAmmo.classList.toggle('reloading', !!state.reloading);

    const loadout = state.loadout || {};
    const count = (value) => (state.unlimitedGadgets ? '∞' : String(value || 0));
    this.el.wardenGadgets.innerHTML =
      `stun ${count(loadout.stunGrenade)} &nbsp; frag ${count(loadout.frag)}` +
      ` &nbsp; cam ${state.alarmPlaced ? 'set' : count(loadout.alarmCamera)}`;

    // Section 9.2: the alarm camera marks the Shade here for 2s.
    this.el.marked.style.display = state.shadeMarked ? 'block' : 'none';
  }

  _updateCommon(state) {
    // Section 12: free-roam has "no objective, no timer, no score", so the
    // chrome that reports them is not merely zeroed, it is absent.
    const objective = !state.freeroam;
    this.el.top.style.display = objective ? 'block' : 'none';
    this.el.scorePanel.style.display = objective ? 'block' : 'none';
    if (!objective) {
      this.el.prompt.style.display = 'none';
      this.el.centre.style.display = 'none';
      this.el.feed.innerHTML = this.feed.map((line) => `<div>${line.text}</div>`).join('');
      this.flash.style.opacity = String(Math.min(1, state.blind || 0));
      return;
    }

    const seconds = Math.max(0, Math.ceil(state.timeRemaining || 0));
    const minutes = Math.floor(seconds / 60);
    this.el.timer.textContent = `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
    this.el.timer.style.color = state.planted ? hex(P.hazardOrange) : hex(P.shadeTeal);

    this.el.charge.textContent = state.planted
      ? `charge armed${state.site ? ` at ${state.site}` : ''}`
      : 'charge carried';
    this.el.charge.classList.toggle('armed', !!state.planted);

    const score = state.score || { shade: 0, warden: 0 };
    this.el.score.textContent = `${score.shade} - ${score.warden}   r${state.roundNumber || 1}`;

    // Objective prompt, with the hold bar (Section 13). A refused plant (D6)
    // borrows the same line rather than opening a second one: it is the answer
    // to the prompt above it, and the bar goes away because there is no hold
    // in progress to describe.
    const holding = state.plantProgress > 0 || state.defuseProgress > 0;
    const refused = !!state.plantRefused && !state.planted;
    const inRange = state.promptInRange && !state.planted;
    if (inRange || holding || refused) {
      this.el.prompt.style.display = 'block';
      this.el.promptText.textContent = state.planted ? 'defusing'
        : refused ? PLANT_REFUSED : 'hold E to plant';
      this.el.promptBar.style.width = `${Math.min(1, state.plantProgress || state.defuseProgress || 0) * 100}%`;
    } else {
      this.el.prompt.style.display = 'none';
    }
    this.el.prompt.classList.toggle('refused', refused);

    // On death, the reinsert countdown replaces the centre (Section 13).
    if (state.awaitingReinsert) {
      this.el.centre.style.display = 'block';
      this.el.centreBig.textContent = String(Math.max(0, Math.ceil(state.reinsertIn || 0)));
      this.el.centreSub.textContent = `reinserting  ${state.lives} lives left`;
    } else {
      this.el.centre.style.display = 'none';
    }

    this.el.feed.innerHTML = this.feed.map((line) => `<div>${line.text}</div>`).join('');

    // Flashbang whiteout (Section 9.1), fading with the effect.
    this.flash.style.opacity = String(Math.min(1, state.blind || 0));
  }
}

export function createHud() {
  return new Hud();
}
