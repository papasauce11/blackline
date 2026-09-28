/**
 * BLACKLINE — ui/menucss.js
 *
 * The main menu's stylesheet (Section 13). Split out of `menu.js` when H5 gave
 * the menu cards, a keyboard focus ring and three more pages: the rules were
 * about to be half the module, and a stylesheet is the part of a menu that
 * never needs reading to follow the logic.
 *
 * Layering (Section 3.1): imports config only, as `menu.js` does.
 */

import { CONFIG } from '../config.js';

const P = CONFIG.palette;
const T = CONFIG.menu.thumbnail;
const hex = (value) => `#${value.toString(16).padStart(6, '0')}`;

/**
 * One rule for the focus ring, used by every focusable row. The menu is driven
 * by arrow keys as well as the mouse (H5) and `Tab` is one of the suppressed
 * keys (config.js), so the browser's own focus outline never appears here and
 * the ring has to be drawn by the menu itself.
 */
const FOCUS = `
#bl-menu .focused { outline: none; }
#bl-menu button.focused, #bl-menu .mapcard.focused {
  background: rgba(47,214,195,0.14); border-color: ${hex(P.shadeTeal)};
}
#bl-menu .row.focused { border-bottom-color: ${hex(P.shadeTeal)}; }
#bl-menu .row.focused span { opacity: 1; }
#bl-menu .row.focused .value::after { content: ' ‹›'; opacity: 0.6; }
`;

export const MENU_CSS = `
#bl-menu {
  position: fixed; inset: 0; z-index: 40; display: flex; align-items: center;
  justify-content: center; background: rgba(10,13,16,0.94);
  font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: ${hex(P.shadeTeal)}; letter-spacing: 0.1em; text-transform: uppercase;
  overflow: auto;
}
#bl-menu.hidden { display: none; }
#bl-menu .card { min-width: 340px; max-width: 560px; padding: 24px 0; }
#bl-menu h1 { font-size: 30px; letter-spacing: 0.42em; margin: 0 0 4px; }
#bl-menu .tag { opacity: 0.5; font-size: 11px; margin-bottom: 28px; letter-spacing: 0.2em; }
#bl-menu button {
  display: block; width: 100%; margin: 0 0 8px; padding: 12px 16px; cursor: pointer;
  background: transparent; color: inherit; font: inherit; letter-spacing: 0.14em;
  text-transform: uppercase; text-align: left;
  border: 1px solid rgba(47,214,195,0.35);
}
#bl-menu button:hover { background: rgba(47,214,195,0.12); border-color: ${hex(P.shadeTeal)}; }
#bl-menu .row { display: flex; justify-content: space-between; align-items: center;
  padding: 9px 0; border-bottom: 1px solid rgba(47,214,195,0.14); }
#bl-menu .row span { opacity: 0.7; }
#bl-menu .row .value { opacity: 1; color: ${hex(P.hazardOrange)}; cursor: pointer; }
#bl-menu input[type=range] { width: 150px; accent-color: ${hex(P.shadeTeal)}; }
#bl-menu .back { margin-top: 20px; opacity: 0.6; }
#bl-menu .footer { margin-top: 22px; font-size: 10px; letter-spacing: 0.18em; opacity: 0.4; }

/* H5: a card per registered map, its picture rendered at boot from the map's
   own geometry (thumbnails.js). The strip is a grid so a third map lands
   beside the two rather than stretching them. */
#bl-menu .maps {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 10px; margin: 0 0 18px;
}
#bl-menu .mapcard {
  width: 100%; margin: 0; padding: 0; overflow: hidden; text-align: left;
  border: 1px solid rgba(47,214,195,0.35); background: transparent;
  color: inherit; font: inherit; cursor: pointer;
}
#bl-menu .mapcard[aria-current=true] { border-color: ${hex(P.shadeTeal)}; }
#bl-menu .mapcard .thumb {
  display: block; width: 100%; aspect-ratio: ${T.width} / ${T.height};
  background: #05070a; object-fit: cover;
}
#bl-menu .mapcard .label { display: block; padding: 8px 12px 10px; }
#bl-menu .mapcard .mapname { display: block; font-size: 12px; letter-spacing: 0.16em; }
#bl-menu .mapcard .mapnote {
  display: block; margin-top: 3px; font-size: 10px; letter-spacing: 0.18em; opacity: 0.5;
}
#bl-menu .mapcard[aria-current=true] .mapnote { color: ${hex(P.hazardOrange)}; opacity: 0.9; }

/* The how-to-play and credits pages: running text, so the menu's uppercase
   tracking is turned off for the body of them. */
#bl-menu .prose { text-transform: none; letter-spacing: 0.03em; opacity: 0.8; font-size: 12px; line-height: 1.8; }
#bl-menu .prose p { margin: 0 0 12px; }
#bl-menu table { width: 100%; border-collapse: collapse; }
#bl-menu td { padding: 4px 0; border-top: 1px solid rgba(255,255,255,0.08); }
#bl-menu td.key { width: 34%; }
#bl-menu td.does { opacity: 0.7; text-transform: none; letter-spacing: 0.03em; }
${FOCUS}
`;
