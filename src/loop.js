/**
 * BLACKLINE — loop.js
 *
 * The requestAnimationFrame scheduler and nothing else. It measures the wall
 * delta between frames and hands it to `renderFrame` in main.js, which owns
 * everything a frame does. Kept apart so it can be stopped and started
 * without touching the frame: the AUTO suite stops it for the length of a
 * run (F4), because a game that keeps playing itself underneath the checks
 * hands each one a state that depends on the wall clock.
 */

export class FrameLoop {
  /**
   * @param {(wallDelta: number) => void} renderFrame unscaled seconds since the last frame
   * @param {(error: *) => void} [onThrow] where a frame's throw goes (H14); absent, it is rethrown
   */
  constructor(renderFrame, onThrow) {
    this._renderFrame = renderFrame;
    this._onThrow = onThrow || null;
    this._handle = 0;
    this._last = 0;
    this.running = false;
    /** Frames this loop has driven, ever. The suite reads it to prove zero ran under a check. */
    this.frames = 0;
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
    this.frames++;
    this.run(wallDelta);
  }

  /**
   * One frame's work, guarded (H14). Without this a throw killed the callback
   * after it had already asked for the next one, so the same throw went to
   * the console every frame over a canvas that never moved again.
   */
  run(wallDelta) {
    if (!this._onThrow) return this._renderFrame(wallDelta);
    try {
      this._renderFrame(wallDelta);
    } catch (error) {
      this._onThrow(error);
    }
  }
}
