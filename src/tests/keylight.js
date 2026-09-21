/**
 * BLACKLINE - tests/keylight.js
 *
 * AUTO suite (F8): the one shadow-casting light, on the faces it lights
 * from behind.
 *
 * Three's shadow pass draws back faces, so the depth it stores for a wall
 * the key lights from behind is that wall's own, and the shadow term there
 * is a depth compared with itself - the 1024-map's texel staircase, fine
 * diagonal stripes across the whole face. A toon ramp lights the back half
 * of dotNL, so the stripes showed where a Lambert would have drawn black.
 * `noKeyLightFromBehind` (mapbake.js) gives the key nothing to a face that
 * faces away from it. This check reads such a wall and holds it plain, and
 * then takes the fix off at runtime to prove the instrument would have seen
 * the stripes: a smoothness reading that cannot fail is not a reading.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { createLens, quiesce } from './pixels.js';

/**
 * E4's probe eye: inside the loading bay, looking down the east shell wall
 * (`shell-east-2`, x = 30, z -16..-8, its inner face normal -x) at a grazing
 * angle. The wall fills the right half of the frame from x = 700 on.
 */
const EYE = { x: 28.5, y: 1.6, z: -8 };
const AT = { x: 30, y: 1.2, z: -16 };
const ROWS = [200, 300, 400];
const X0 = 700;
const X1 = 1270;
/** The smoothed copy is a box mean this many pixels either side. */
const SMOOTH_RADIUS = 15;
/** A residual has to leave this band before it counts as a side. */
const BAND = 0.5;
/**
 * Level-crossings a plain wall may show on one row. Measured: 0-2 with the
 * fix, 12-23 without (the stripes are about a luma deep, on a wall at 25).
 */
const CEILING = 6;

/** Luma along one row, x0 inclusive to x1 exclusive. */
function lumaRow(frame, width, y, x0, x1) {
  const row = [];
  for (let x = x0; x < x1; x++) {
    const i = (y * width + x) * 4;
    row.push(0.2126 * frame[i] + 0.7152 * frame[i + 1] + 0.0722 * frame[i + 2]);
  }
  return row;
}

/**
 * How many times the row crosses its own smoothed copy. The residual has to
 * leave a band of `BAND` on one side and then the other for a crossing to
 * count, so the ramp's own level steps (half a luma, one way) do not.
 */
function levelCrossings(row) {
  let side = 0;
  let count = 0;
  for (let i = 0; i < row.length; i++) {
    let total = 0;
    let n = 0;
    for (let k = Math.max(0, i - SMOOTH_RADIUS); k <= Math.min(row.length - 1, i + SMOOTH_RADIUS); k++) {
      total += row[k];
      n++;
    }
    const residual = row[i] - total / n;
    const now = residual > BAND ? 1 : residual < -BAND ? -1 : 0;
    if (now === 0) continue;
    if (side !== 0 && now !== side) count++;
    side = now;
  }
  return count;
}

/** Crossings and mean luma per row of the wall in `frame`. */
function readWall(frame, width) {
  return ROWS.map((y) => {
    const row = lumaRow(frame, width, y, X0, X1);
    return { y, crossings: levelCrossings(row), mean: row.reduce((a, b) => a + b, 0) / row.length };
  });
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-wall-the-key-lights-from-behind-reads-plain',
    maps: ['plant'], // the eye is the plant's east shell wall; the rule is every map's
    spec: 'Section 4.1 (F8)',
    name: 'The east shell wall, seen from inside the bay with the key behind it, carries no shadow stripes - and does again with the fix taken off',
    run: (h) => {
      const problems = [];
      const restore = quiesce(h);
      const lens = createLens(h);
      h.shade.mesh.visible = false;
      h.warden.mesh.visible = false;
      h.shade.groundBlob.visible = false;
      h.warden.groundBlob.visible = false;

      // The fix is not the shadow off, and the wall really is behind the key.
      const key = h.map.keyLight;
      if (!key || !key.castShadow) problems.push('the key light casts no shadow');
      if (!h.renderer.shadowMap.enabled) problems.push('the shadow map is off');
      const direction = key ? key.userData.direction : null;
      if (!direction || !(direction[0] < 0)) problems.push(`the key travels ${direction ? direction.map((v) => v.toFixed(2)).join(',') : 'nowhere'}: the east wall's inner face is not behind it`);
      const materials = h.map.materials.entries().map(([, material]) => material);
      const unpatched = materials.filter((material) => !material.customProgramCacheKey || material.customProgramCacheKey() !== 'bl-no-key-from-behind');
      if (unpatched.length) problems.push(`${unpatched.length} of ${materials.length} map materials take the key from behind`);

      lens.look(EYE, AT);
      lens.grab(); // the first draw of a view compiles
      const fixed = readWall(lens.grab(), lens.width);
      for (const row of fixed) {
        if (row.crossings > CEILING) problems.push(`row ${row.y} crosses its smoothed copy ${row.crossings} times with the fix on (ceiling ${CEILING})`);
      }

      // The other half: take the fix off every map material and the stripes
      // must come back, or the ceiling is proving nothing.
      const saved = materials.map((material) => [material, material.onBeforeCompile, material.customProgramCacheKey]);
      for (const material of materials) {
        material.onBeforeCompile = () => {};
        material.customProgramCacheKey = () => 'bl-key-from-behind';
        material.needsUpdate = true;
      }
      const striped = readWall(lens.grab(), lens.width);
      for (const [material, onBeforeCompile, cacheKey] of saved) {
        material.onBeforeCompile = onBeforeCompile;
        material.customProgramCacheKey = cacheKey;
        material.needsUpdate = true;
      }
      const stripedRows = striped.filter((row) => row.crossings > CEILING).length;
      if (stripedRows < ROWS.length) problems.push(`with the fix off only ${stripedRows} of ${ROWS.length} rows show the stripes (${striped.map((row) => row.crossings).join('/')}): the instrument cannot see them`);

      // And back: the restored materials draw the plain wall again.
      const again = readWall(lens.grab(), lens.width);
      for (let i = 0; i < ROWS.length; i++) {
        if (again[i].crossings !== fixed[i].crossings) problems.push(`row ${ROWS[i]} reads ${again[i].crossings} crossings after the materials were restored, ${fixed[i].crossings} before`);
      }
      if (lens.glError() !== 0) problems.push('GL error during the reads');

      h.shade.mesh.visible = true;
      h.warden.mesh.visible = true;
      h.shade.groundBlob.visible = true;
      h.warden.groundBlob.visible = true;
      lens.restore();
      restore();
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `the east shell wall from the bay: rows ${ROWS.join('/')} cross their smoothed copy `
            + `${fixed.map((row) => row.crossings).join('/')} times at luma ${fixed.map((row) => row.mean.toFixed(1)).join('/')} `
            + `(ceiling ${CEILING}); with the key lighting it from behind ${striped.map((row) => row.crossings).join('/')} `
            + `at ${striped.map((row) => row.mean.toFixed(1)).join('/')}; ${materials.length} map materials patched, the shadow on`
          : problems.join('; '),
      };
    },
  });
}
