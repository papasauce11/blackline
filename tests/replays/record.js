// BLACKLINE - tests/replays/record.js
//
// The program the shipped replays were recorded from (H13). A probe file,
// not a module: `npm run probe -- --map <id> tests/replays/record.js` runs it
// in the page with `h` in scope and prints the replay it returns, which is
// the file - `tests/replays/<id>.json` - once the probe's JSON is written
// compact (PROGRESS.md, H13, has the one-liner).
//
// Sixteen seconds of a competitive round against the live AI, played through
// the input layer the way a keyboard plays it: keys go down and up between
// steps, a press edge reaches the one step after it, and the mouse is a
// `look` between steps. The route is the same on every map - it is input,
// not a path - so what it hits and where it ends is each map's own.
//
// Re-record only when a change to the game moves a recorded end on purpose,
// and say so in the job that did it: a replay that is re-recorded whenever it
// goes red asserts nothing.

const C = h.config;
h.initMatch({ mode: 'competitive', role: C.match.humanRole, ai: true, objective: true });
h.menu.hide();
h.setPaused(false);
h.input.clearAll();
const input = h.input;
const actor = C.match.humanRole === 'warden' ? h.warden : h.shade;

/** Hold these codes for `steps` steps, turning by `turn` every sixth step. */
function hold(codes, steps, turn = 0) {
  for (const code of codes) {
    input.heldCodes.add(code);
    input.pressedCodes.add(code);
  }
  for (let i = 0; i < steps; i++) {
    if (turn && i % 6 === 0) actor.look(turn, 0);
    h.stepFrames(1);
    input.clearEdges();
  }
  for (const code of codes) input.heldCodes.delete(code);
}

/** Nothing held, for `steps` steps. */
const wait = (steps) => hold([], steps);

hold(['KeyW'], 120);
hold(['KeyW', 'ShiftLeft'], 90, 0.05);
hold(['KeyD'], 60);
hold(['Space'], 6);
wait(30);
hold(['KeyW', 'KeyA'], 120, -0.04);
hold(['ControlLeft'], 60);
hold(['KeyW'], 180, 0.03);
hold(['Digit1'], 2);
wait(20);
hold(['KeyW', 'ShiftLeft'], 150, -0.05);
hold(['KeyE'], 60);
hold(['KeyS'], 62);

return h.replays.save();
