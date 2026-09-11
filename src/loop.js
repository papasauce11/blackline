/**
 * BLACKLINE — loop.js
 *
 * The requestAnimationFrame scheduler and nothing else. It measures the wall
 * delta between frames and hands it to `renderFrame` in main.js, which owns
 * everything a frame does. Kept apart so it can be stopped and started
 * without touching the frame — the suite runner will want that (F4).
 */

export class FrameLoop {
  /** @param {(wallDelta: number) => void} renderFrame unscaled seconds since the last frame */
  constructor(renderFrame) {
    this._renderFrame = renderFrame;
    this._handle = 0;
    this._last = 0;
    this.running = false;
    this._frame = (now) => this.frame(now);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = 0;
    this._handle = requestAnimationFrame(this._frame);
  }

  stop() {
    this.running = false;
    if (this._handle) cancelAnimationFrame(this._handle);
    this._handle = 0;
  }

  frame(now) {
    this._handle = requestAnimationFrame(this._frame);
    const wallDelta = this._last === 0 ? 0 : (now - this._last) / 1000;
    this._last = now;
    this._renderFrame(wallDelta);
  }
}
