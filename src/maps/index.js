/**
 * BLACKLINE — maps/index.js
 *
 * The map registry (D1). Every map the game can build, keyed by a short id:
 * `plant` is "Meridian Substation" (`plant.js`, the first map, `src/map.js`
 * until D1) and `yard` is the container yard of Block D (`yard.js`,
 * blocked out by D2, its walkway D3, its night D4; the AI on it is D5).
 * `buildMap(id)` is the only way a map gets built — or `bakeMap(id)`, which is
 * the same generator driven a slice at a time so the loading screen can paint
 * between them (H4); `?map=<id>` on the URL picks one for the page load,
 * the main menu's map row does the same by reloading with it, and the
 * headless runner passes it per run (`npm run suite -- --map plant,yard`).
 *
 * A map is built once, at boot, and the whole world is built on it: every
 * system takes the map at construction and never expects it to change, so
 * switching maps is a page load and not a rebuild. That keeps `initMatch`
 * the one entry point Section 12 requires and the systems free of a
 * "map changed" path nothing else would exercise.
 *
 * The AUTO suite reads `map.id`: a check registered with `maps: ['plant']`
 * runs only there and is reported as "not for this map" elsewhere; a check
 * with no `maps` runs on every map (`ui/autosuite.js`).
 *
 * Layering (Section 3.1): as the maps it lists - mapkit, physics, config.
 */

import { SETTINGS } from '../config.js';
import { buildPlantMap } from './plant.js';
import { buildYardMap } from './yard.js';
import { FINISH_SLICES } from '../mapfinish.js';

/** The map the page opens on when the URL names none and none is remembered. */
export const DEFAULT_MAP_ID = 'plant';

/** `?map=<id>`, the one place the query is parsed. */
const MAP_QUERY = /(?:^|[?&])map=([a-z0-9-]+)(?:&|$)/i;

/**
 * In the order the menu offers them.
 * @type {{id: string, name: string, build: (options: object) => object}[]}
 */
const REGISTRY = [
  { id: 'plant', name: 'Meridian Substation', build: buildPlantMap },
  { id: 'yard', name: 'Container Yard', build: buildYardMap },
];

/** Every registered id, in menu order. */
export function mapIds() {
  return REGISTRY.map((entry) => entry.id);
}

/** `{ id, name }` for every registered map, in menu order - what the menu lists. */
export function listMaps() {
  return REGISTRY.map(({ id, name }) => ({ id, name }));
}

/** The registry entry for an id, or null. */
export function mapEntry(id) {
  return REGISTRY.find((entry) => entry.id === id) || null;
}

/**
 * Which map a URL query asks for: `?map=yard`. An id the registry does not
 * know falls back to the default with a warning rather than a blank page -
 * a typo in a playtest URL should still open the game - and the headless
 * runner checks `map.id` against what it asked for, so a fallback there is
 * never a silent pass on the wrong map.
 *
 * **A pure function of the query**, deliberately. H5 first put the remembered
 * map (`SETTINGS.lastMap`) in here as the no-query fallback, and the verify
 * caught it: `every-registered-map-builds-and-the-page-is-on-the-one-its-url-asked-for`
 * asserts that an empty query gives the default, and any check that clicks the
 * real Play writes `lastMap`, so the second run of a map read "yard" where the
 * first read "plant". Which map a *URL* asks for and which map a *browser*
 * opens with are two questions; this one answers the first and `bootMapId`
 * answers the second.
 *
 * @param {string} search `location.search`, or any query string
 * @returns {string} a registered id
 */
export function requestedMapId(search) {
  const query = typeof search === 'string' ? search : '';
  const match = MAP_QUERY.exec(query);
  if (!match) return DEFAULT_MAP_ID;
  const id = match[1].toLowerCase();
  if (mapEntry(id)) return id;
  console.warn(`[maps] no map "${id}"; opening ${DEFAULT_MAP_ID}`);
  return DEFAULT_MAP_ID;
}

/**
 * Which map this page load opens on (H5): the one the URL names, or the one
 * last chosen from the menu, or the default.
 *
 * This is the whole of "the last map is remembered". A map is a page load, so
 * there is nothing to switch - only a default to pick when the URL names
 * none. An explicit `?map=` always wins, because a link a friend was sent
 * must not be overruled by what this browser did last. It lasts beyond the
 * browser session once H7 puts SETTINGS in a store; until then it is this
 * page load's own memory.
 *
 * @param {string} search `location.search`
 * @returns {string} a registered id
 */
export function bootMapId(search) {
  const query = typeof search === 'string' ? search : '';
  if (MAP_QUERY.test(query)) return requestedMapId(query);
  return mapEntry(SETTINGS.lastMap) ? SETTINGS.lastMap : DEFAULT_MAP_ID;
}

/**
 * The query string that opens `id` while keeping everything else the URL
 * carried (`?seed=`, `?debug=1`): what the menu's map row navigates to.
 * Pure, so a check can ask it without leaving the page.
 *
 * @param {string} search the current `location.search`
 * @param {string} id a registered map id
 * @returns {string} a query string starting with `?`
 */
export function mapUrl(search, id) {
  const params = new URLSearchParams(typeof search === 'string' ? search : '');
  params.set('map', id);
  return `?${params.toString()}`;
}

/**
 * Every slice a bake yields: the declaration phase, then `mapfinish.js`'s
 * five. Held to a real bake by `the-bake-yields-the-page-a-frame-to-paint`,
 * so a step added or dropped shows up rather than quietly changing the
 * loading screen's arithmetic.
 */
export const BAKE_SLICES = 1 + FINISH_SLICES;

/**
 * Start a bake and drive it a slice at a time (H4). The builders are
 * generators; this is the driver that lets the caller hand the browser a frame
 * between slices, which is what makes the loading screen paint instead of
 * being a panel nobody ever sees behind a locked main thread.
 *
 * ```js
 * const bake = bakeMap(id, { gradientMap });
 * let label;
 * while ((label = bake.step()) !== null) await paint(label, bake.slices);
 * const map = bake.map;
 * ```
 *
 * @param {string} id
 * @param {object} options
 * @param {THREE.DataTexture} options.gradientMap the toon ramp from the composition root
 * @returns {{step: () => string|null, map: import('../mapkit.js').GameMap|null, slices: number}}
 */
export function bakeMap(id, { gradientMap }) {
  const entry = mapEntry(id);
  if (!entry) throw new Error(`bakeMap: no map "${id}" (have ${mapIds().join(', ')})`);
  const steps = entry.build({ id: entry.id, name: entry.name, gradientMap });
  let map = null;
  let partial = null;
  let slices = 0;
  return {
    /** The map, once the bake has finished; null until then. */
    get map() { return map; },
    /**
     * The map as far as the bake has got: every slice yields it (H5). Whole
     * once the bake is done, and never a second object - `map` and `partial`
     * are the same one, finished or not.
     */
    get partial() { return partial; },
    /** How many slices have run. */
    get slices() { return slices; },
    /**
     * Run the next slice. Returns its label, or null when the bake is done and
     * `map` is set.
     */
    step() {
      const { value, done } = steps.next();
      if (!done) {
        slices++;
        partial = value.map;
        return value.label;
      }
      map = value;
      partial = value;
      if (map.id !== entry.id) throw new Error(`bakeMap: "${entry.id}" built a map calling itself "${map.id}"`);
      return null;
    },
  };
}

/**
 * How many slices a bake has to run before everything the map *draws* exists:
 * the declaration (the geometry, the lights, the site tints, the decals), the
 * collision tree, and the climb rule with the route lighting B7 lays on top of
 * it. The three after it - rooms, the Warden's ground, validation - derive
 * facts nothing puts in the scene, and on the plant they are 408ms of a 632ms
 * bake (H5, measured).
 *
 * The constant is pinned from both sides by
 * `the-drawn-slices-are-every-slice-that-puts-anything-in-the-scene`: at this
 * cut a map holds exactly the meshes and lights a finished one holds, and one
 * slice earlier it does not. So it is a reading of the bake rather than a
 * number someone believed.
 */
export const DRAWN_SLICES = 3;

/**
 * Build a map as far as it is drawn, and no further (H5). This is what the
 * main menu's thumbnails are rendered from: a picture needs the scene and
 * none of the derivations, and paying for the derivations twice a page load
 * would put the cost of every registered map into the boot the loading screen
 * was built to shorten.
 *
 * The result is a real map object mid-bake: it has `root`, `collision` and
 * `ledges`, and it has no `wardenGround`, no room entries and no validation.
 * Nothing but a picture should take one.
 *
 * @param {string} id
 * @param {object} options
 * @param {THREE.DataTexture} options.gradientMap
 * @returns {import('../mapkit.js').GameMap}
 */
export function buildDrawnMap(id, options) {
  const bake = bakeMap(id, options);
  for (let i = 0; i < DRAWN_SLICES; i++) bake.step();
  return bake.partial;
}

/**
 * Build a registered map, every slice back to back. Throws on an unknown id:
 * by the time this is called the id has been through `requestedMapId()` or is
 * a check's own.
 *
 * This is the synchronous driver of the same generator `bakeMap` drives a
 * slice at a time — not a second build path. Every check that wants a map and
 * does not care about the loading screen calls this and sees exactly what it
 * always saw.
 *
 * @param {string} id
 * @param {object} options
 * @param {THREE.DataTexture} options.gradientMap the toon ramp from the composition root
 * @returns {import('../mapkit.js').GameMap}
 */
export function buildMap(id, options) {
  const bake = bakeMap(id, options);
  while (bake.step() !== null) { /* the next slice, with nothing in between */ }
  return bake.map;
}
