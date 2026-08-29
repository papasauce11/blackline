/**
 * BLACKLINE — emitter.js
 *
 * The one event emitter (Section 3.1).
 *
 * Layering: imports nothing, so it sits alongside config.js at the bottom of
 * the graph and anything may take one. It is still *created* in main.js and
 * passed down — Section 3.1 requires cross-system messages to go through an
 * emitter the composition root owns, not through a module-level singleton that
 * every system could reach for on its own.
 */

export class Emitter {
  constructor() {
    this._handlers = new Map();
  }

  /** @returns {() => void} unsubscribe */
  on(event, handler) {
    if (!this._handlers.has(event)) this._handlers.set(event, []);
    this._handlers.get(event).push(handler);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    const wrapped = (payload) => {
      this.off(event, wrapped);
      handler(payload);
    };
    return this.on(event, wrapped);
  }

  off(event, handler) {
    const list = this._handlers.get(event);
    if (!list) return;
    const index = list.indexOf(handler);
    if (index !== -1) list.splice(index, 1);
    if (list.length === 0) this._handlers.delete(event);
  }

  /**
   * Invoke every listener. A throwing listener is reported and the rest still
   * run, so one broken system cannot silently disable the ones after it.
   * @returns {number} how many listeners were invoked
   */
  emit(event, payload) {
    const list = this._handlers.get(event);
    if (!list || list.length === 0) return 0;
    // Copy: a listener may unsubscribe itself or others during dispatch.
    const snapshot = list.slice();
    for (let i = 0; i < snapshot.length; i++) {
      try {
        snapshot[i](payload);
      } catch (error) {
        console.error(`[emitter] listener for "${event}" threw:`, error);
      }
    }
    return snapshot.length;
  }

  listenerCount(event) {
    const list = this._handlers.get(event);
    return list ? list.length : 0;
  }
}
