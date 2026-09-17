/**
 * BLACKLINE - tests/maps.js
 *
 * AUTO suite: D1, the map registry. Every registered map builds and calls
 * itself by its id; the page is on the map its URL asked for; `?map=` and
 * the menu's map row agree on what the next page load will open; and a
 * check registered for other maps is reported as not for this one rather
 * than run, or passed. These run on every map: they read the registry and
 * `h.map`, never a coordinate of either.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { createToonGradient } from '../view.js';
import { buildMap, mapIds, listMaps, requestedMapId, mapUrl, DEFAULT_MAP_ID } from '../maps/index.js';

/** Click a menu control the way the player does. */
function click(root, selector) {
  const control = root.querySelector(selector);
  if (!control) throw new Error(`no ${selector} on the panel`);
  control.click();
}

/** What every map, whatever its shape, has to have for a match to run on it. */
function inspect(id, map, problems) {
  const at = (what) => `${id}: ${what}`;
  if (map.id !== id) problems.push(at(`built a map calling itself "${map.id}"`));
  if (!map.name) problems.push(at('has no name'));
  if (!map.collision.boxCount) problems.push(at('has no collision'));
  if (!map.shadeSpawns.length) problems.push(at('has no Shade spawn'));
  if (!map.wardenSpawns.length) problems.push(at('has no Warden spawn'));
  if (!map.sites.length) problems.push(at('has no plant site'));
  for (const site of map.sites) {
    if (!site.room) problems.push(at(`site ${site.id} is in no room`));
  }
  if (!map.wardenGround || !map.wardenGround.count) problems.push(at('has no Warden ground'));
  else {
    for (const spawn of map.wardenSpawns) {
      if (!map.wardenGround.has(spawn.position)) problems.push(at(`Warden spawn "${spawn.name}" is off its own ground`));
    }
    for (const site of map.sites) {
      if (!map.wardenGround.has(site.position)) problems.push(at(`site ${site.id} is off the Warden's ground`));
    }
  }
  if (!map.keyLight) problems.push(at('has no key light'));
  if (!map.waypoints.length) problems.push(at('has no waypoints'));
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'every-registered-map-builds-and-the-page-is-on-the-one-its-url-asked-for',
    spec: 'Section 5, amended (D1)',
    name: 'Every map in the registry builds under its own id with spawns, sites in rooms and Warden ground; the page booted the map its URL names; ?map= and the map row\'s URL agree',
    run: (h) => {
      const problems = [];
      const ids = mapIds();
      if (ids.length < 2) problems.push(`the registry lists ${ids.length} map(s); D1 wants plant and yard`);
      if (ids.indexOf(DEFAULT_MAP_ID) === -1) problems.push(`the default map "${DEFAULT_MAP_ID}" is not registered`);
      if (new Set(ids).size !== ids.length) problems.push(`duplicate ids: ${ids.join(', ')}`);

      // The page: on the map the URL named, and the scene holds that map.
      const wanted = requestedMapId(typeof location !== 'undefined' ? location.search : '');
      if (h.map.id !== wanted) problems.push(`the URL asks for "${wanted}", the page is on "${h.map.id}"`);
      if (h.map.root.parent !== h.scene) problems.push('the map on the page is not in the scene');
      if (h.debugState.map !== h.map.id) problems.push(`the F3 map field says "${h.debugState.map}"`);

      // Every map builds, off the scene, with its own ramp: the one the page
      // is on too, so a registry entry that only works because boot did
      // something first is caught.
      const gradientMap = createToonGradient(CONFIG.render.toonSteps);
      const built = [];
      for (const id of ids) {
        const t0 = performance.now();
        try {
          const map = buildMap(id, { gradientMap });
          inspect(id, map, problems);
          built.push(`${id} "${map.name}": ${map.collision.boxCount} boxes, ${map.sites.length} sites, `
            + `${map.wardenGround ? map.wardenGround.count : 0} ground cells, ${map.routes.length} routes, `
            + `${(performance.now() - t0).toFixed(0)}ms`);
        } catch (error) {
          problems.push(`${id} does not build: ${error && error.message}`);
        }
      }
      gradientMap.dispose();
      let unknownThrew = false;
      try { buildMap('no-such-map', { gradientMap }); } catch (error) { unknownThrew = true; }
      if (!unknownThrew) problems.push('buildMap of an unknown id did not throw');

      // The URL side: what `?map=` reads, and what the map row writes.
      const url = [
        [requestedMapId(''), DEFAULT_MAP_ID, 'no query'],
        [requestedMapId('?map=yard'), 'yard', '?map=yard'],
        [requestedMapId('?seed=3&map=YARD&debug=1'), 'yard', 'map among other params, upper case'],
        [requestedMapId('?map=no-such-map'), DEFAULT_MAP_ID, 'an unknown id falls back'],
        [mapUrl('?seed=5&debug=1', 'yard'), '?seed=5&debug=1&map=yard', 'the row keeps the seed and the gate'],
        [mapUrl('?map=plant', 'yard'), '?map=yard', 'the row replaces the map'],
        [mapUrl('', 'plant'), '?map=plant', 'the row from a bare URL'],
      ];
      for (const [got, want, what] of url) {
        if (got !== want) problems.push(`${what}: got "${got}", want "${want}"`);
      }
      for (const id of ids) {
        if (requestedMapId(mapUrl('?debug=1', id)) !== id) problems.push(`mapUrl and requestedMapId disagree on "${id}"`);
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `page on ${h.map.id} as asked; built ${built.join('; ')}; ?map= and mapUrl agree on ${ids.length} ids`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-menu-offers-every-map-and-its-map-row-asks-for-the-next-one',
    spec: 'Section 13, amended (D1)',
    name: 'The main menu names the map the page is on, lists every registered map, and a click on the map row hands the next id to the page-load handler',
    run: (h) => {
      const problems = [];
      const maps = listMaps();
      h.menu.show('main');
      const root = h.menu.root;
      const row = root.querySelector('#bl-map');
      if (!row) problems.push('the main menu has no map row');
      const text = root.textContent.replace(/\s+/g, ' ').toLowerCase();
      if (!text.includes(h.map.name.toLowerCase())) problems.push(`the menu does not name "${h.map.name}"`);
      const offered = row ? String(row.title || '') : '';
      for (const entry of maps) {
        if (!offered.includes(entry.name)) problems.push(`the map row does not offer "${entry.name}"`);
      }

      // The click, through the real DOM, to the handler the composition root
      // wired - stood in for, because the real one is a page load. The row
      // asks for the map after this one in the registry's order.
      const handlers = h.menu.handlers;
      const real = handlers.onMap;
      const asked = [];
      handlers.onMap = (id) => asked.push(id);
      try {
        click(root, '#bl-map');
      } finally {
        handlers.onMap = real;
        h.menu.hide();
      }
      const index = maps.findIndex((entry) => entry.id === h.map.id);
      const next = maps[(index + 1) % maps.length].id;
      if (asked.length !== 1) problems.push(`the click asked for ${asked.length} maps (${asked.join(', ')})`);
      else if (asked[0] !== next) problems.push(`the click asked for "${asked[0]}", the next after ${h.map.id} is "${next}"`);
      if (typeof real !== 'function') problems.push('no page-load handler is wired to the row');

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `the menu says ${h.map.name}, offers ${maps.map((entry) => entry.name).join(' / ')}, and the row asks for ${next}`
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'a-check-registered-for-another-map-is-reported-not-run',
    spec: 'Section 16, amended (D1)',
    name: 'The suite runs a check with no maps everywhere, one naming this map here, and reports one naming other maps as not for this map; every maps entry in the registry names a real map',
    run: (h) => {
      const problems = [];
      const suite = h.debugTools.suite;
      const probe = [
        { id: 'zz-everywhere', run: () => ({ pass: true, detail: '' }) },
        { id: 'zz-here', maps: [h.map.id], run: () => ({ pass: true, detail: '' }) },
        { id: 'zz-elsewhere', maps: ['no-such-map'], run: () => ({ pass: true, detail: '' }) },
        { id: 'zz-nowhere', maps: [], run: () => ({ pass: true, detail: '' }) },
      ];
      const { tests, notForMap } = suite.applicable(probe);
      const ran = tests.map((test) => test.id);
      if (ran.join(',') !== 'zz-everywhere,zz-here') problems.push(`applicable ran ${ran.join(', ')}; want zz-everywhere, zz-here`);
      if (notForMap.join(',') !== 'zz-elsewhere,zz-nowhere') problems.push(`not for this map: ${notForMap.join(', ')}; want zz-elsewhere, zz-nowhere`);

      // The registered suite: a `maps` list that names no registered map is
      // a check that never runs anywhere, silently.
      const ids = new Set(mapIds());
      let scoped = 0;
      for (const test of h.debugTools._autoTests) {
        if (!test.maps) continue;
        scoped++;
        if (!Array.isArray(test.maps) || !test.maps.length) problems.push(`${test.id}: maps is not a non-empty list`);
        else for (const id of test.maps) if (!ids.has(id)) problems.push(`${test.id}: maps names "${id}", not registered`);
      }
      const here = h.debugTools._autoTests.filter((test) => !test.maps || test.maps.indexOf(h.map.id) !== -1).length;

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `applicable() keeps the unscoped and the ${h.map.id} check and reports the other two; `
            + `${scoped} of ${h.debugTools._autoTests.length} registered checks are scoped, ${here} run on ${h.map.id}`
          : problems.join('; '),
      };
    },
  });
}
