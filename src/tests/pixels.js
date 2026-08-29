/**
 * BLACKLINE - tests/pixels.js
 *
 * Reading the framebuffer back, so rendered output can be checked.
 *
 * The browser pane this project is built in has never composited: `document.hidden`
 * stays true, `requestAnimationFrame` never fires and screenshots time out. For
 * eighteen phases that meant nothing visual could be verified at all, and every
 * phase entry in PROGRESS.md ended with a paragraph saying so.
 *
 * `gl.readPixels` does not need a compositor. The renderer draws to the canvas
 * whether or not anything is presenting it, and the pixels are there to be read.
 * So the visual checks frame a subject, render, read the buffer, and measure —
 * which is not the same as looking at it, but is a great deal more than
 * asserting that a material's colour property was assigned.
 *
 * What this can and cannot settle, stated once here rather than in each check:
 *
 *  - It CAN prove something is drawn, where, how bright, in what colour, and
 *    that it changes when the game says it changed.
 *  - It CANNOT settle whether the result looks good, reads at a glance, or
 *    feels right. Those stay HUMAN, and the checks that use this say so.
 *
 * Layering (Section 3.1): imports config only; everything else arrives through
 * the harness. Nothing here imports main.js.
 */

import { CONFIG } from '../config.js';

/**
 * Take the camera, point it at something, and hand back a reader.
 *
 * The camera is detached to the scene for the duration — the Shade and Warden
 * rigs move it every frame, and a rig reparenting mid-measurement is a
 * measurement of the rig. `restore()` puts ownership back.
 *
 * @param {object} h harness
 */
export function createLens(h) {
  const renderer = h.renderer;
  const gl = renderer.getContext();
  const camera = h.camera;
  const width = renderer.domElement.width;
  const height = renderer.domElement.height;
  const owner = h.cameraOwner;
  const buffer = new Uint8Array(width * height * 4);

  h.setCameraOwner(null);
  h.scene.add(camera);

  return {
    width,
    height,
    pixels: width * height,

    /** Put the camera at `from` looking at `at`. */
    look(from, at) {
      camera.position.set(from.x, from.y, from.z);
      camera.lookAt(at.x, at.y, at.z);
      camera.updateMatrixWorld(true);
    },

    /** Render and read the whole framebuffer back. */
    grab() {
      renderer.render(h.scene, camera);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
      return buffer.slice();
    },

    /**
     * Render without reading back, for timing.
     *
     * `readPixels` blocks until the GPU has finished and then copies several
     * megabytes, so timing `grab()` measures the readback rather than the
     * frame — it reported a 2ms frame as 14ms.
     */
    renderOnly() {
      renderer.render(h.scene, camera);
    },

    glError() {
      return gl.getError();
    },

    restore() {
      h.setCameraOwner(owner);
    },
  };
}

/** Mean luminance of a frame, 0..255. */
export function meanLuma(frame) {
  let total = 0;
  const pixels = frame.length / 4;
  for (let i = 0; i < frame.length; i += 4) {
    total += 0.2126 * frame[i] + 0.7152 * frame[i + 1] + 0.0722 * frame[i + 2];
  }
  return total / pixels;
}

/** Mean luminance of a centred box, as a fraction of the frame. */
export function meanLumaIn(frame, width, height, fraction) {
  const halfW = Math.floor((width * fraction) / 2);
  const halfH = Math.floor((height * fraction) / 2);
  const cx = width >> 1;
  const cy = height >> 1;
  let total = 0;
  let count = 0;
  for (let y = cy - halfH; y < cy + halfH; y++) {
    for (let x = cx - halfW; x < cx + halfW; x++) {
      const i = (y * width + x) * 4;
      total += 0.2126 * frame[i] + 0.7152 * frame[i + 1] + 0.0722 * frame[i + 2];
      count++;
    }
  }
  return count ? total / count : 0;
}

/**
 * Pixels that differ between two frames of the same viewpoint.
 *
 * The workhorse: render with a thing, render without it, and the difference is
 * the thing. It sidesteps having to know where on screen anything landed.
 *
 * @returns {{mask: Uint8Array, count: number, meanDelta: number, bounds: object|null}}
 */
export function difference(a, b, width, height, threshold = 8) {
  const count = width * height;
  const mask = new Uint8Array(count);
  let changed = 0;
  let total = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let i = 0; i < count; i++) {
    const p = i * 4;
    const delta = Math.abs(a[p] - b[p]) + Math.abs(a[p + 1] - b[p + 1]) + Math.abs(a[p + 2] - b[p + 2]);
    if (delta <= threshold) continue;
    mask[i] = 1;
    changed++;
    total += delta;
    const x = i % width;
    const y = (i / width) | 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  return {
    mask,
    count: changed,
    meanDelta: changed ? total / changed : 0,
    bounds: maxX < 0 ? null : { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 },
  };
}

/** Signed brightness change over a mask: positive means it got brighter. */
export function brightnessDelta(before, after, mask) {
  let total = 0;
  let count = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const p = i * 4;
    total += (after[p] - before[p]) + (after[p + 1] - before[p + 1]) + (after[p + 2] - before[p + 2]);
    count++;
  }
  return count ? total / count : 0;
}

/** Erode a mask by one pixel, for separating an edge band from an interior. */
export function erode(source, width, height) {
  const out = new Uint8Array(source.length);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (!source[i]) continue;
      if (source[i - 1] && source[i + 1] && source[i - width] && source[i + width]) out[i] = 1;
    }
  }
  return out;
}

/**
 * Put both actors somewhere harmless and stop the AI interfering, so a
 * measurement is of the thing being measured. Returns a restore function.
 */
export function quiesce(h) {
  h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
  h.menu.hide();
  h.setPaused(false);
  h.input.clearAll();
  h.stepFrames(20);
  return () => {
    h.input.clearAll();
    h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
    h.menu.hide();
  };
}
