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

import { createLens, quiesce, scaledColumn, scaledRow } from './pixels.js';

/**
 * E4's probe eye: inside the loading bay, looking down the east shell wall
 * (`shell-east-2`, x = 30, z -16..-8, its inner face normal -x) at a grazing
 * angle. The wall fills the right half of the frame from x = 700 on.
 *
 * The rows and columns are **the reference buffer's** (1280x720, pixels.js) and
 * are scaled to whatever buffer is in front of us by `wallWindow` below. They
 * were plain numbers until H28, and the damage that did is worth stating
 * because it does not look like a resolution bug: at `low`'s 896-wide buffer,
 * columns 700 to 1270 of row 200 are the last 196 pixels of that row and then
 * 374 pixels of the rows above it, so the check read a staircase it had
 * assembled itself and called it shadow stripes - 7 crossings against a ceiling
 * of 6. At `high` the columns are all in range and all in the wrong place,
 * landing left of the wall on the bay behind it: 11 crossings. Neither reading
 * was about the key light, and neither was about the shadow map.
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
 *
 * This is the PLAIN wall's ceiling and it does not depend on the shadow map:
 * a wall with no stripes on it has none at any map size.
 */
const CEILING = 6;
/**
 * The other half - *the stripes come back when the fix comes off* - used to be
 * this same ceiling, and H28 found that it cannot be. **A crossing count is a
 * count of the shadow map's texels**, so halving the map halves it: the third
 * row read 12 crossings at 1024 and 6 at 512, which is at the ceiling rather
 * than over it, and the check reported that its instrument had gone blind when
 * what had happened was that `low` has a 512 map. Same shape as H24's
 * `exactly-one-shadow-caster`: a number that was the answer until the shadow
 * map became a preset knob.
 *
 * So the instrument is demonstrated by the residual's **amplitude** instead,
 * which is scale-free - the stripes are about a luma deep whether there are six
 * of them across the window or twenty-four. A row's swing with the fix off is
 * at least this many times its swing with the fix on.
 */
const SWING_RATIO = 2.5;

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
 * How a row departs from its own smoothed copy, two ways.
 *
 * `crossings` counts the times the residual leaves a band of `BAND` on one side
 * and then the other, so the ramp's own level steps (half a luma, one way) do
 * not count. It is how many stripes are in the window.
 *
 * `swing` is the mean size of the residual, in luma. It is how DEEP they are,
 * and it is the reading that does not move with the shadow map (above).
 */
function residuals(row) {
  let side = 0;
  let crossings = 0;
  let swing = 0;
  for (let i = 0; i < row.length; i++) {
    let total = 0;
    let n = 0;
    for (let k = Math.max(0, i - SMOOTH_RADIUS); k <= Math.min(row.length - 1, i + SMOOTH_RADIUS); k++) {
      total += row[k];
      n++;
    }
    const residual = row[i] - total / n;
    swing += Math.abs(residual);
    const now = residual > BAND ? 1 : residual < -BAND ? -1 : 0;
    if (now === 0) continue;
    if (side !== 0 && now !== side) crossings++;
    side = now;
  }
  return { crossings, swing: row.length ? swing / row.length : 0 };
}

/**
 * The window on the wall in the buffer `lens` reads: the constants above are
 * fractions of the reference buffer and this is what they come to here. The
 * right edge is clamped, so a buffer narrower than the scaling expects reads a
 * short row rather than the next row along.
 *
 * Exported for `tests/bufferscale.js`, which asserts the window fits at every
 * buffer size - the weakest thing worth saying about it, and enough to catch
 * the constants coming back.
 */
export function wallWindow(lens) {
  return {
    rows: ROWS.map((y) => scaledRow(lens, y)),
    x0: scaledColumn(lens, X0),
    x1: Math.min(scaledColumn(lens, X1), lens.width),
  };
}

/** Crossings and mean luma per row of the wall in `frame`. */
function readWall(frame, lens) {
  const window = wallWindow(lens);
  return window.rows.map((y) => {
    const row = lumaRow(frame, lens.width, y, window.x0, window.x1);
    return { y, ...residuals(row), mean: row.reduce((a, b) => a + b, 0) / row.length };
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
      const window = wallWindow(lens);
      const fixed = readWall(lens.grab(), lens);
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
      const striped = readWall(lens.grab(), lens);
      for (const [material, onBeforeCompile, cacheKey] of saved) {
        material.onBeforeCompile = onBeforeCompile;
        material.customProgramCacheKey = cacheKey;
        material.needsUpdate = true;
      }
      // Every row's residual has to deepen when the fix comes off, by a factor
      // rather than to a count: a count is the shadow map's and this is not.
      const blind = [];
      for (let i = 0; i < fixed.length; i++) {
        if (!(striped[i].swing >= fixed[i].swing * SWING_RATIO)) {
          blind.push(`row ${fixed[i].y} swings ${striped[i].swing.toFixed(2)} luma with the fix off against ${fixed[i].swing.toFixed(2)} with it on, not ${SWING_RATIO}x`);
        }
      }
      if (blind.length) problems.push(`the instrument cannot see the stripes: ${blind.join('; ')}`);

      // And back: the restored materials draw the plain wall again.
      const again = readWall(lens.grab(), lens);
      for (let i = 0; i < fixed.length; i++) {
        if (again[i].crossings !== fixed[i].crossings) problems.push(`row ${fixed[i].y} reads ${again[i].crossings} crossings after the materials were restored, ${fixed[i].crossings} before`);
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
          ? `the east shell wall from the bay, columns ${window.x0}-${window.x1} of a ${lens.width}x${lens.height} buffer: rows ${fixed.map((row) => row.y).join('/')} cross their smoothed copy `
            + `${fixed.map((row) => row.crossings).join('/')} times (ceiling ${CEILING}) and swing ${fixed.map((row) => row.swing.toFixed(2)).join('/')} luma `
            + `at luma ${fixed.map((row) => row.mean.toFixed(1)).join('/')}; with the key lighting it from behind ${striped.map((row) => row.crossings).join('/')} `
            + `crossings swinging ${striped.map((row) => row.swing.toFixed(2)).join('/')} at ${striped.map((row) => row.mean.toFixed(1)).join('/')}; `
            + `${materials.length} map materials patched, the shadow on`
          : problems.join('; '),
      };
    },
  });
}
