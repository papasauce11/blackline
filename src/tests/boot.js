/**
 * BLACKLINE - tests/boot.js
 *
 * AUTO suite: what the page does before the game exists (H4).
 *
 * Three checks, one per thing that used to be invisible. A browser without
 * WebGL2 got a black page and a console line nobody would look for. A phone got
 * the same game with nothing to drive it. And the map bake - measured at 827ms
 * on the plant and 336 on the yard - held the main thread from the first module
 * to the first frame, so the loading screen this now has could have been
 * markup, correct in every respect, and never once drawn.
 *
 * Two of these are staged rather than observed, and the reason is worth stating
 * because it is the shape HANDOFF.md warns about. A check cannot make this
 * browser lose WebGL2, and it cannot rewind the page's own boot. So the refusals
 * are driven through the very functions the real boot calls - `createRenderer`
 * with a canvas that hands back no context, `isTouchOnly` with a stubbed
 * `matchMedia` - and each then asserts that the real boot **went through the
 * same one**: the live `h.renderer` is what `createRenderer` returned for
 * `#bl-canvas`, and `debugState.bootGate` is what the boot read off the device.
 * A check that only proved `createRenderer(stub) === null` would prove a
 * function works and say nothing about whether anything calls it.
 *
 * The bake check is the other way round: it reads what the real boot recorded
 * *and* drives a fresh bake itself, because the recording alone could be a
 * number written by code that no longer slices anything.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { createToonGradient, createRenderer } from '../view.js';
import { bakeMap, buildMap, BAKE_SLICES } from '../maps/index.js';
import { NOTICES, isTouchOnly, showNotice, hideNotice, yieldToPaint } from '../bootscreen.js';

/** A `matchMedia` of the given answers, for `isTouchOnly`. */
const media = (answers) => (query) => ({ matches: !!answers[query] });

/** The three devices that matter, and what `isTouchOnly` must say about each. */
const DEVICES = [
  { what: 'a phone', answers: { '(pointer: coarse)': true, '(hover: hover)': false }, touchOnly: true },
  // The one a naive coarse-pointer test gets wrong, and it plays perfectly.
  { what: 'a touchscreen laptop', answers: { '(pointer: coarse)': true, '(hover: hover)': true }, touchOnly: false },
  { what: 'a desktop', answers: { '(pointer: coarse)': false, '(hover: hover)': true }, touchOnly: false },
];

/** Read the notice panel: whether it is up, and what it says. */
function readNotice() {
  const panel = document.getElementById('bl-notice');
  if (!panel) return { panel: null };
  return {
    panel,
    up: !panel.hidden,
    kind: panel.dataset.kind,
    title: document.getElementById('bl-notice-title').textContent,
    body: document.getElementById('bl-notice-body').textContent,
    ok: document.getElementById('bl-notice-ok'),
  };
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-browser-without-webgl2-is-told-so-plainly',
    spec: 'Section 15 (the risk register), H4',
    name: 'createRenderer returns null for a canvas with no WebGL2 context and one that throws, the real boot got a renderer from it, and the refusal is a panel with no way out',
    run: (h) => {
      const problems = [];

      // The test is `createRenderer` itself, driven with a canvas that hands
      // back no context - because this browser has WebGL2 and there is no asking
      // it not to. Both ways a browser says no: null, and a throw.
      //
      // three logs `THREE.WebGLRenderer: Error creating WebGL context.` before
      // it throws, and the runner counts console errors, so a check that
      // provokes one on purpose has to account for it or every run carries two.
      // Captured rather than silenced (the idiom is tests/donedef.js's): what
      // three said is asserted below and reported, so nothing is hidden - and if
      // three ever stops logging, this notices.
      const said = [];
      const realError = console.error;
      console.error = (...args) => said.push(args.map(String).join(' '));
      try {
        const none = document.createElement('canvas');
        none.getContext = () => null;
        if (createRenderer(none) !== null) problems.push('a canvas whose getContext returns null got a renderer');

        const throws = document.createElement('canvas');
        throws.getContext = () => { throw new Error('blocked'); };
        if (createRenderer(throws) !== null) problems.push('a canvas whose getContext throws got a renderer');
      } finally {
        console.error = realError;
      }
      if (said.length !== 2) problems.push(`three logged ${said.length} errors for two refusals, expected 2`);
      if (!said.every((line) => /WebGLRenderer/.test(line))) {
        problems.push(`an error captured here is not three's: ${said.join(' | ')}`);
      }

      // The half that makes those two mean anything: the live renderer came out
      // of that same function, so the refusal is on the path the boot takes and
      // not beside it. There is no second WebGL2 test to drift from this one.
      if (!h.renderer) problems.push('the page has no renderer, on a page that booted');
      else if (!h.renderer.domElement || h.renderer.domElement.id !== 'bl-canvas') {
        problems.push('the live renderer is not drawing on #bl-canvas');
      }

      // The panel itself. Fatal, so no button and the loading screen goes with
      // it - "starting" behind a message saying nothing is starting is a lie.
      const boot = document.getElementById('bl-boot');
      if (!boot) problems.push('index.html has no #bl-boot loading screen');
      try {
        const shown = showNotice('webgl2');
        if (!shown) problems.push('showNotice("webgl2") drew nothing');
        const read = readNotice();
        if (!read.up) problems.push('the notice panel stayed hidden');
        if (read.kind !== 'webgl2') problems.push(`the panel is marked "${read.kind}"`);
        if (read.title !== NOTICES.webgl2.title) problems.push(`the title reads "${read.title}"`);
        if (read.body !== NOTICES.webgl2.body) problems.push('the body is not the one NOTICES declares');
        if (!/webgl2/i.test(read.title + read.body)) problems.push('the message never names WebGL2');
        if (read.ok && !read.ok.hidden) problems.push('a fatal notice offered a way out of it');
        if (boot && !boot.hidden) problems.push('the fatal notice left the loading screen up behind it');
        const rect = read.panel.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) problems.push(`the panel is ${rect.width}x${rect.height}`);
      } finally {
        hideNotice();
        // The real boot took the loading screen down; leave it that way.
        if (boot) boot.hidden = true;
      }
      if (readNotice().up) problems.push('the notice would not go away again');

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? 'createRenderer refuses a null context and a throwing one (three\'s 2 console errors captured here, '
            + 'not leaked to the run), and the live renderer is the one it built on #bl-canvas; the panel reads "'
            + NOTICES.webgl2.title + '", offers no way out and covers the loading screen'
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'a-touch-device-is-told-and-the-game-boots-behind-it',
    spec: 'Section 15, H4',
    name: 'A coarse pointer without hover is the only device called touch-only, the real boot asked, and that notice can be dismissed onto a running game',
    run: (h) => {
      const problems = [];

      for (const device of DEVICES) {
        const got = isTouchOnly(media(device.answers));
        if (got !== device.touchOnly) {
          problems.push(`${device.what}: isTouchOnly said ${got}, want ${device.touchOnly}`);
        }
      }
      // A matchMedia that throws is not a touch device, it is an old browser.
      if (isTouchOnly(() => { throw new Error('no matchMedia'); })) {
        problems.push('a throwing matchMedia was read as a touch device');
      }

      const gate = h.debugState.bootGate;
      if (!gate) problems.push('debugState.bootGate is missing; the boot never ran the gate');
      else if (typeof gate.touchOnly !== 'boolean') problems.push(`the boot recorded touchOnly ${gate.touchOnly}`);

      const boot = document.getElementById('bl-boot');
      try {
        showNotice('touch');
        const read = readNotice();
        if (!read.up) problems.push('the touch notice stayed hidden');
        if (read.title !== NOTICES.touch.title) problems.push(`the title reads "${read.title}"`);
        if (read.body !== NOTICES.touch.body) problems.push('the body is not the one NOTICES declares');
        if (!/keyboard/i.test(read.body)) problems.push('the message never says what is missing');
        if (!read.ok || read.ok.hidden) problems.push('a warning offered no way past it');
        // And it is a warning, not a refusal: the game is up behind it, and the
        // button leaves it up.
        if (boot && !boot.hidden) problems.push('the touch notice took the loading screen down with it');
        const sim = h.clock.sim;
        h.stepFrames(2);
        if (h.clock.sim <= sim) problems.push('the game was not running behind the touch notice');
        if (read.ok) read.ok.click();
        if (readNotice().up) problems.push('the button did not dismiss the notice');
        const after = h.clock.sim;
        h.stepFrames(2);
        if (h.clock.sim <= after) problems.push('the game stopped when the notice was dismissed');
      } finally {
        hideNotice();
        if (boot) boot.hidden = true;
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `${DEVICES.length} devices classified (a touchscreen laptop is not touch-only); the boot recorded `
            + `touchOnly ${gate ? gate.touchOnly : '?'}; the notice reads "${NOTICES.touch.title}", dismisses, `
            + 'and the game steps behind it and after it'
          : problems.join('; '),
      };
    },
  });

  debugTools.registerAutoTest({
    id: 'the-bake-yields-the-page-a-frame-to-paint',
    spec: 'Section 15, H4',
    // A GL sync would make this a wait rather than work, and it is neither: it
    // is one more bake, which is CPU and about a second of it.
    name: 'The map bake runs as slices with a real task boundary between them, the boot took them, and the straight-through driver builds the same map',
    run: async (h) => {
      const problems = [];

      // 1. What the real boot did. The recording alone proves nothing - it
      // could be written by code that slices nothing - which is what 2 is for.
      const bake = h.debugState.bootBake;
      if (!bake) {
        return { pass: false, detail: 'debugState.bootBake is missing; the boot did not bake in slices' };
      }
      if (bake.map !== h.map.id) problems.push(`the boot baked "${bake.map}" and the page is on "${h.map.id}"`);
      if (bake.slices !== BAKE_SLICES) problems.push(`the boot ran ${bake.slices} slices, BAKE_SLICES says ${BAKE_SLICES}`);
      if (!(bake.yields >= 1)) problems.push(`the boot yielded ${bake.yields} times during the bake; H4 wants at least one`);
      if (bake.yields !== bake.slices) problems.push(`${bake.slices} slices but ${bake.yields} yields`);
      if (!(bake.ms > 0)) problems.push(`the boot's bake measured ${bake.ms}ms`);

      // 2. A fresh bake, driven here, with one marker queued in each gap: if the
      // gap is a real task boundary, the marker queued during slice N has run
      // before slice N+1 starts, so exactly N markers have run by then. This is
      // "count the frames during boot" in the only form a page can honour after
      // its own boot is history - a frame is the browser getting a turn, and a
      // task that ran in the gap proves it got one.
      //
      // One marker per gap and not a batch up front: port messages queued
      // together are delivered together, so a batch counts one turn and reads as
      // five. The first attempt did exactly that and said 2 of 5.
      let ran = 0;
      const channel = new MessageChannel();
      channel.port1.onmessage = () => { ran++; };
      const marker = () => channel.port2.postMessage(0);

      const gradientMap = createToonGradient(CONFIG.render.toonSteps);
      const labels = [];
      const ticksAt = [];
      try {
        const sliced = bakeMap(h.map.id, { gradientMap });
        let label;
        while ((label = sliced.step()) !== null) {
          ticksAt.push(ran);
          labels.push(label);
          if (sliced.map !== null) problems.push(`the bake handed back a map at slice ${labels.length}, before it was finished`);
          // Queued before the yield and on another port, so it is ahead of the
          // yield's own message in the same queue and must have run by the time
          // the await resolves.
          marker();
          await yieldToPaint();
        }
        if (!sliced.map) problems.push('the bake finished without a map');
        else if (sliced.map.id !== h.map.id) problems.push(`the bake built "${sliced.map.id}"`);

        if (labels.length !== BAKE_SLICES) problems.push(`the bake yielded ${labels.length} slices, BAKE_SLICES says ${BAKE_SLICES}`);
        if (labels.some((l) => typeof l !== 'string' || !l.length)) problems.push('a slice yielded no label for the loading screen');
        if (new Set(labels).size !== labels.length) problems.push(`two slices share a label: ${labels.join(', ')}`);

        // The measurement: at slice N, exactly N markers have run, because each
        // gap is one turn of the event loop and each gap queued one marker. A
        // bake that did not let go would read 0 at every slice.
        const wrong = ticksAt.map((t, i) => (t === i ? null : `slice ${i + 1} saw ${t} of ${i}`)).filter(Boolean);
        if (wrong.length) problems.push(`the page did not get a turn in every gap: ${wrong.join(', ')}`);
        if (ran !== labels.length) problems.push(`${labels.length} gaps queued a marker and ${ran} ran`);

        // 3. And the straight-through driver is the same generator, not a
        // second build path: it must produce the map every other check gets.
        const whole = buildMap(h.map.id, { gradientMap });
        const same = [
          ['boxes', whole.collision.boxCount, sliced.map.collision.boxCount],
          ['ledges', whole.ledges.length, sliced.map.ledges.length],
          ['rooms', whole.rooms.length, sliced.map.rooms.length],
          ['routes', whole.routes.length, sliced.map.routes.length],
          ['ground cells', whole.wardenGround.count, sliced.map.wardenGround.count],
        ];
        for (const [what, a, b] of same) {
          if (a !== b) problems.push(`buildMap and bakeMap disagree on ${what}: ${a} against ${b}`);
        }
      } finally {
        channel.port1.close();
        gradientMap.dispose();
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `the boot took ${bake.slices} slices and ${bake.yields} yields over ${bake.ms}ms on ${bake.map}; `
            + `a bake driven here yielded the same ${labels.length} (${labels.join(', ')}) and a task queued in `
            + `each gap ran before the next slice, all ${ran} of them; buildMap agrees with bakeMap on every count`
          : problems.join('; '),
      };
    },
  });
}
