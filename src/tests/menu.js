/**
 * BLACKLINE - tests/menu.js
 *
 * AUTO suite (Section 13, Section 17.1): the main menu H5 built - the title,
 * a card per registered map with a thumbnail rendered from that map's own
 * geometry, the role row, and every row reachable from the keyboard.
 *
 * Two of these read pixels, which is the only honest way to tell a picture
 * from an element that has a `src` attribute: the first thumbnail this job
 * produced was a 480x270 rectangle of pure black, and every property of it -
 * the width, the aspect, the data URL, the img in the DOM - was exactly right.
 * What was wrong was the fog. So these decode what the card is actually
 * showing and measure it.
 *
 * The title cannot be read that way and this says so rather than pretending:
 * the menu is a DOM overlay in front of the GL canvas, so `gl.readPixels`
 * cannot see it. What is measured instead is what the browser laid out - the
 * box, the computed opacity, the type size against everything else on the
 * card - which is the same standard `the-main-menu-footer-names-the-build-it-
 * is-running` (H3) holds the footer to.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG, SETTINGS } from '../config.js';
import {
  listMaps, mapEntry, requestedMapId, bootMapId, bakeMap, buildMap,
  DEFAULT_MAP_ID, DRAWN_SLICES, BAKE_SLICES,
} from '../maps/index.js';
import { ROLES } from '../ui/menu.js';
import { createToonGradient } from '../view.js';

const T = CONFIG.menu.thumbnail;

/** Brighter than this and a pixel is geometry someone can see, not margin. */
const LIT_FLOOR = 24;

/**
 * How much of a card has to be lit geometry. Measured at 18.6% on the plant
 * and 8.0% on the yard with the eye config.js holds; the floor is a little
 * over half the smaller, because what it guards against is a picture of
 * nothing, not a framing someone may want to change. The yard is the darker
 * of the two because it is a night map and half its card is wet ground.
 */
const LIT_MINIMUM = 0.045;

/** Every element on a menu page that does something when it is clicked. */
function controlsOn(root) {
  return [...root.querySelectorAll('button, input, .value')].filter(
    (el) => el.onclick || el.oninput || el.tagName === 'INPUT'
  );
}

/** A real key press at the window, the way a player's arrives. */
function press(code) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true, cancelable: true }));
}

/**
 * Decode what a card is showing into pixels. The `<img>` holds a data URL, so
 * this is the picture on screen and not a second render of it.
 *
 * @param {HTMLImageElement} img
 * @returns {Promise<{data: Uint8ClampedArray, width: number, height: number}>}
 */
async function readImage(img) {
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const read = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data: read.data, width: canvas.width, height: canvas.height };
}

/**
 * How much of a picture is lit geometry, and how bright it is.
 *
 * The measure is deliberately "brighter than LIT_FLOOR" and not "different
 * from the clear colour". The first version of this check asked the second
 * question and reported a picture that is 60% black margin as 100% drawn: the
 * render target clears to black rather than to `CONFIG.render.clearColor`, and
 * black differs from that colour in every channel. A useless pass on a metric
 * that cannot fail is worse than no check.
 */
function measure(pixels) {
  let lit = 0;
  let sum = 0;
  let max = 0;
  const count = pixels.length / 4;
  for (let i = 0; i < pixels.length; i += 4) {
    const luma = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
    sum += luma;
    if (luma > max) max = luma;
    if (luma > LIT_FLOOR) lit++;
  }
  return {
    lit: lit / count,
    meanLuma: sum / count,
    maxLuma: max,
  };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-main-menu-draws-a-rendered-thumbnail-for-every-map',
    spec: 'Section 13, H5',
    name: 'Every registered map has a card whose picture is a data URL rendered from that map, carries geometry rather than an empty frame, and is not the same picture as another map',
    run: async (h) => {
      const problems = [];
      const maps = listMaps();
      await h.thumbnails.ready;
      const shots = [];
      try {
        h.menu.show('main');
        for (const entry of maps) {
          const card = h.menu.root.querySelector(`.mapcard[data-map="${entry.id}"]`);
          if (!card) {
            problems.push(`no card for "${entry.id}"`);
            continue;
          }
          if (card.textContent.indexOf(entry.name) === -1) problems.push(`the ${entry.id} card does not name it`);
          const img = card.querySelector('img');
          const src = img ? String(img.getAttribute('src') || '') : '';
          if (src.indexOf('data:image/png') !== 0) {
            // Section 2 forbids asset files outright, so a card that had
            // fetched one would be a defect and not merely a different design.
            problems.push(`the ${entry.id} card's picture is "${src.slice(0, 40)}", not a rendered data URL`);
            continue;
          }
          const read = await readImage(img);
          if (read.width !== T.width || read.height !== T.height) {
            problems.push(`the ${entry.id} picture is ${read.width}x${read.height}, config says ${T.width}x${T.height}`);
          }
          const seen = measure(read.data);
          shots.push({ id: entry.id, read, seen });
          // A black rectangle satisfies every other assertion here, and was
          // what the first two eyes of this job produced.
          if (seen.lit < LIT_MINIMUM) {
            problems.push(`${entry.id}: only ${(seen.lit * 100).toFixed(1)}% of the picture is lit geometry `
              + `(floor ${(LIT_MINIMUM * 100).toFixed(1)}%) - it is a picture of nothing`);
          }
          if (seen.meanLuma < 2) problems.push(`${entry.id}: mean luma ${seen.meanLuma.toFixed(1)}, too dark to read as a place`);
          if (seen.maxLuma < 60) problems.push(`${entry.id}: nothing in it is brighter than ${Math.round(seen.maxLuma)}`);
          // Drawn, not merely present.
          const box = img.getBoundingClientRect();
          if (box.width < 40 || box.height < 20) problems.push(`the ${entry.id} card's picture is laid out at ${Math.round(box.width)}x${Math.round(box.height)}`);
        }

        // And that they are pictures of different places. One thumbnail wired
        // to every card passes everything above.
        for (let i = 1; i < shots.length; i++) {
          const a = shots[i - 1];
          const b = shots[i];
          if (a.read.data.length !== b.read.data.length) continue;
          let differ = 0;
          for (let p = 0; p < a.read.data.length; p += 4) {
            if (Math.abs(a.read.data[p] - b.read.data[p]) > 8
              || Math.abs(a.read.data[p + 1] - b.read.data[p + 1]) > 8
              || Math.abs(a.read.data[p + 2] - b.read.data[p + 2]) > 8) differ++;
          }
          const fraction = differ / (a.read.data.length / 4);
          if (fraction < 0.05) {
            problems.push(`${a.id} and ${b.id} differ in ${(fraction * 100).toFixed(1)}% of their pixels - one picture is on two cards`);
          }
        }

        // Every registered map, including the ones this page did not build.
        for (const entry of maps) {
          if (!h.thumbnails.get(entry.id)) problems.push(`no thumbnail was rendered for "${entry.id}"`);
        }
        if (!h.thumbnails.record.done) problems.push('the thumbnails never finished');
      } finally {
        h.menu.hide();
      }

      const said = shots.map((shot) => (
        `${shot.id} ${(shot.seen.lit * 100).toFixed(1)}% lit, mean luma ${shot.seen.meanLuma.toFixed(1)}, peak ${Math.round(shot.seen.maxLuma)}`
      )).join('; ');
      const cost = Object.entries(h.thumbnails.record.maps).map(
        ([id, row]) => `${id} ${row.buildMs}+${row.ms - row.buildMs}ms`
      ).join(', ');
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${maps.length} cards, each a ${T.width}x${T.height} data URL of its own map: ${said}; `
            + `built and drawn in ${h.thumbnails.record.ms}ms (${cost}), 0 files fetched`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-drawn-slices-are-every-slice-that-puts-anything-in-the-scene',
    spec: 'Section 13, H5',
    name: 'A map baked to DRAWN_SLICES holds exactly the meshes and lights a finished one holds, and one slice fewer does not',
    run: (h) => {
      // Why this check is the constant and not a comment: `buildDrawnMap` is
      // what a thumbnail is rendered from, and it stops the bake early to save
      // 408ms of derivation per map. If a future slice ever puts something in
      // the scene, the cards quietly lose it and nothing else would notice.
      // So the cut is pinned from both sides - at DRAWN_SLICES the scene is
      // whole, at DRAWN_SLICES - 1 it is not.
      const problems = [];
      const id = h.map.id;
      // Its own ramp, off the scene, as tests/maps.js builds maps: a map that
      // only works because boot did something first would be missed otherwise.
      const gradientMap = createToonGradient(CONFIG.render.toonSteps);

      const census = (map) => {
        let meshes = 0;
        let lights = 0;
        let triangles = 0;
        map.root.traverse((object) => {
          if (object.isMesh) {
            meshes++;
            const index = object.geometry && object.geometry.index;
            const position = object.geometry && object.geometry.attributes && object.geometry.attributes.position;
            triangles += Math.round(((index ? index.count : (position ? position.count : 0))) / 3);
          }
          if (object.isLight) lights++;
        });
        return { meshes, lights, triangles };
      };

      const whole = census(buildMap(id, { gradientMap }));

      const cut = (slices) => {
        const bake = bakeMap(id, { gradientMap });
        for (let i = 0; i < slices; i++) bake.step();
        return census(bake.partial);
      };
      const drawn = cut(DRAWN_SLICES);
      const early = cut(DRAWN_SLICES - 1);

      for (const key of ['meshes', 'lights', 'triangles']) {
        if (drawn[key] !== whole[key]) {
          problems.push(`at ${DRAWN_SLICES} slices the map has ${drawn[key]} ${key}, finished it has ${whole[key]} - the cut is too early`);
        }
      }
      const earlyDiffers = ['meshes', 'lights', 'triangles'].some((key) => early[key] !== whole[key]);
      if (!earlyDiffers) {
        problems.push(`${DRAWN_SLICES - 1} slices already draws everything, so DRAWN_SLICES is one too many`);
      }
      if (DRAWN_SLICES >= BAKE_SLICES) problems.push(`DRAWN_SLICES ${DRAWN_SLICES} is not short of the bake's ${BAKE_SLICES}`);
      // The partial map really is the same object the bake finishes with, not
      // a copy the thumbnail path could drift from.
      const bake = bakeMap(id, { gradientMap });
      bake.step();
      const first = bake.partial;
      while (bake.step() !== null) { /* to the end */ }
      if (bake.partial !== bake.map || first !== bake.map) problems.push('bakeMap handed out a different object mid-bake than it finished with');

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${id}: at ${DRAWN_SLICES} of ${BAKE_SLICES} slices the scene is whole (${whole.meshes} meshes, `
            + `${whole.lights} lights, ${whole.triangles} triangles); at ${DRAWN_SLICES - 1} it is `
            + `${early.meshes}/${early.lights}/${early.triangles}`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-main-menu-title-is-drawn-above-the-cards',
    spec: 'Section 13, H5',
    name: 'The title says Blackline, is the largest type on the card, is visible, and sits above the map cards',
    run: (h) => {
      const problems = [];
      try {
        h.menu.show('main');
        const root = h.menu.root;
        const title = root.querySelector('#bl-title');
        if (!title) return { pass: false, detail: 'the main menu has no #bl-title' };
        if (title.textContent.trim().toLowerCase() !== 'blackline') {
          problems.push(`the title reads "${title.textContent.trim()}"`);
        }
        const box = title.getBoundingClientRect();
        if (box.width < 80 || box.height < 16) problems.push(`the title is laid out at ${Math.round(box.width)}x${Math.round(box.height)}`);
        const style = getComputedStyle(title);
        if (Number(style.opacity) < 0.9) problems.push(`the title is drawn at opacity ${style.opacity}`);
        if (style.display === 'none' || style.visibility === 'hidden') problems.push('the title is hidden by CSS');
        const size = parseFloat(style.fontSize);
        // The largest type on the page, which is what makes it the title
        // rather than a line that happens to be first.
        for (const el of root.querySelectorAll('.card *')) {
          if (el === title) continue;
          if (parseFloat(getComputedStyle(el).fontSize) > size) {
            problems.push(`"${el.textContent.trim().slice(0, 20)}" is set larger than the title`);
            break;
          }
        }
        // Contrast against the surface it is on, since a title the colour of
        // its background is laid out perfectly and cannot be read.
        const ink = style.color.match(/\d+/g).map(Number);
        const luma = 0.2126 * ink[0] + 0.7152 * ink[1] + 0.0722 * ink[2];
        if (luma < 60) problems.push(`the title's ink reads at luma ${Math.round(luma)} on a near-black menu`);

        const cards = root.querySelector('#bl-cards');
        if (!cards) problems.push('the main menu has no card strip');
        else if (cards.getBoundingClientRect().top < box.bottom) problems.push('the cards are drawn over the title');
      } finally {
        h.menu.hide();
      }
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? 'the title reads Blackline, is the largest type on the card, is opaque and sits above the map strip'
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'every-main-menu-row-is-reachable-and-actionable-from-the-keyboard',
    spec: 'Section 13, H5',
    name: 'Every page of the menu declares as many rows as it drew controls, the arrow keys walk and wrap them, and Enter activates the focused one',
    run: (h) => {
      const problems = [];
      const menu = h.menu;
      const wasHandlers = menu.handlers;
      const wasRole = SETTINGS.role;
      const wasMap = SETTINGS.lastMap;
      let played = 0;
      let freeRoamed = 0;
      try {
        // Every page, including the ones only the pause overlay reaches. Tab
        // is suppressed game-wide (config.js SUPPRESSED_KEYS), so a control
        // the menu did not declare is a control no keyboard can reach at all.
        for (const page of ['main', 'settings', 'controls', 'howto', 'credits', 'pause']) {
          menu.show(page);
          const drew = controlsOn(menu.root);
          const declared = menu.rows.map((row) => row.el);
          if (declared.length !== drew.length) {
            const missing = drew.filter((el) => declared.indexOf(el) === -1);
            problems.push(`the ${page} page drew ${drew.length} controls and declared ${declared.length}`
              + (missing.length ? ` (${missing.map((el) => el.id || el.textContent.trim().slice(0, 14)).join(', ')} unreachable)` : ''));
          }
          // The ring walks the whole list and comes back to the top.
          const count = menu.rows.length;
          const walked = [];
          for (let i = 0; i < count; i++) {
            walked.push(menu.focus);
            press('ArrowDown');
          }
          if (menu.focus !== 0) problems.push(`the ${page} page's ring did not wrap: ${count} presses left it on ${menu.focus}`);
          if (walked.join(',') !== walked.map((_, i) => i).join(',')) {
            problems.push(`the ${page} page's ring went ${walked.join(',')}`);
          }
          press('ArrowUp');
          if (menu.focus !== count - 1) problems.push(`the ${page} page's ring did not wrap backwards`);
          // And the ring is drawn, not just counted.
          if (!menu.rows[menu.focus].el.classList.contains('focused')) {
            problems.push(`the ${page} page draws no ring on the focused row`);
          }
        }

        // The role row answers the sideways keys, and Play does what it says.
        menu.handlers = {
          ...wasHandlers,
          onPlay: () => { played++; },
          onFreeRoam: () => { freeRoamed++; },
          onFirstGesture: () => {},
        };
        SETTINGS.role = 'shade';
        menu.show('main');
        const roleIndex = menu.rows.findIndex((row) => row.el.id === 'bl-role');
        if (roleIndex === -1) problems.push('the main page has no role row');
        else {
          menu.focus = roleIndex;
          press('ArrowRight');
          if (SETTINGS.role === 'shade') problems.push('the right key did not move the role row');
          const names = ROLES.map((role) => role.id);
          for (let i = 1; i < names.length; i++) press('ArrowRight');
          if (SETTINGS.role !== 'shade') problems.push(`${names.length} presses did not bring the role row back to "shade" (it is "${SETTINGS.role}")`);
        }

        // Enter on the Play row starts the role the row is showing.
        const playIndex = menu.rows.findIndex((row) => row.el.dataset && row.el.dataset.action === 'play');
        if (playIndex === -1) problems.push('the main page has no Play row');
        else {
          SETTINGS.role = 'shade';
          menu.show('main');
          menu.focus = menu.rows.findIndex((row) => row.el.dataset && row.el.dataset.action === 'play');
          press('Enter');
          if (played !== 1 || freeRoamed !== 0) problems.push(`Enter on Play as the Shade ran ${played} matches and ${freeRoamed} free roams`);
          if (menu.open) problems.push('Enter on Play left the menu open');

          SETTINGS.role = 'warden';
          menu.show('main');
          menu.focus = menu.rows.findIndex((row) => row.el.dataset && row.el.dataset.action === 'play');
          press('Enter');
          if (played !== 1 || freeRoamed !== 1) problems.push(`Enter on Play as the Warden ran ${played} matches and ${freeRoamed} free roams`);
        }
      } finally {
        menu.handlers = wasHandlers;
        SETTINGS.role = wasRole;
        SETTINGS.lastMap = wasMap;
        menu.hide();
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? 'main, settings, how to play, credits and pause each declare every control they draw; the ring walks and wraps both ways and is drawn; '
            + 'the role row answers the sideways keys and Enter on Play starts what it says'
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-menu-remembers-the-map-and-role-it-last-played',
    spec: 'Section 13, H5',
    name: 'Choosing a map records it as the one a page load with no map= opens, an explicit map= still wins, and which map a URL asks for stays a pure question',
    run: (h) => {
      const problems = [];
      const wasMap = SETTINGS.lastMap;
      const wasRole = SETTINGS.role;
      const wasHandlers = h.menu.handlers;
      try {
        // A map is a page load, so "remembered" is a default a later load
        // picks up, never a switch. It survives the browser once H7 stores
        // SETTINGS; what is testable now is that the wiring is real.
        SETTINGS.lastMap = null;
        if (bootMapId('') !== DEFAULT_MAP_ID) {
          problems.push(`with nothing remembered the page opens on "${bootMapId('')}", want ${DEFAULT_MAP_ID}`);
        }
        for (const entry of listMaps()) {
          SETTINGS.lastMap = entry.id;
          if (bootMapId('') !== entry.id) problems.push(`remembering "${entry.id}" opened "${bootMapId('')}"`);
          // An explicit ?map= still wins: a link a friend was sent is not
          // overruled by what this browser did last.
          const other = listMaps().find((row) => row.id !== entry.id);
          if (other && bootMapId(`?map=${other.id}`) !== other.id) problems.push('?map= lost to the remembered map');
          // And the question "which map does this URL ask for" stays a
          // question about the URL. The first version of H5 answered it with
          // the remembered map and made the answer depend on whether a check
          // had clicked Play, which the verify caught as a flaky run.
          if (requestedMapId('') !== DEFAULT_MAP_ID) {
            problems.push(`requestedMapId('') reads SETTINGS.lastMap - it is not a pure question about the URL any more`);
          }
        }
        // A map the registry no longer knows is not honoured.
        SETTINGS.lastMap = 'no-such-map';
        if (mapEntry(bootMapId('')) === null) problems.push('a stale remembered map opened a map the registry does not have');

        // The click that records it: the card for the other map.
        SETTINGS.lastMap = null;
        const asked = [];
        h.menu.handlers = { ...wasHandlers, onMap: (id) => asked.push(id) };
        h.menu.show('main');
        const other = listMaps().find((entry) => entry.id !== h.map.id);
        if (other) {
          const card = h.menu.root.querySelector(`.mapcard[data-map="${other.id}"]`);
          if (!card) problems.push(`no card to click for "${other.id}"`);
          else {
            card.click();
            if (asked.join(',') !== other.id) problems.push(`the ${other.id} card asked for "${asked.join(',')}"`);
            if (SETTINGS.lastMap !== other.id) problems.push(`the card did not record "${other.id}" as the map last chosen`);
          }
          // And the card for the map already loaded starts no page load.
          const here = h.menu.root.querySelector(`.mapcard[data-map="${h.map.id}"]`);
          if (here) {
            here.click();
            if (asked.length !== 1) problems.push('the card for this page\'s own map asked for a page load');
            if (here.getAttribute('aria-current') !== 'true') problems.push('the card for this page\'s own map is not marked as the one you are on');
          }
        }
      } finally {
        h.menu.handlers = wasHandlers;
        SETTINGS.lastMap = wasMap;
        SETTINGS.role = wasRole;
        h.menu.hide();
      }
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `a page load with no ?map= comes from SETTINGS.lastMap, an explicit ?map= still wins, and `
            + `requestedMapId stays a pure question about the URL; the card records it; `
            + `the role row feeds Play (${ROLES.map((role) => role.id).join('/')})`
          : problems.join('; '),
      };
    },
  });
}
