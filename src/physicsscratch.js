/**
 * BLACKLINE — physicsscratch.js
 *
 * The swept solver's scratch vectors, and the one setter that writes them.
 *
 * Small vector helpers on plain objects. No allocation in the hot paths —
 * which is the whole reason these are five module-level objects and not five
 * literals at each call site.
 *
 * Why they live in a file of their own (H56). `physics.js` stood at exactly
 * 600 of Section 3.1's ~600 lines, so its two read-only queries moved next
 * door into `physicsquery.js`. Those two reuse the same vectors the sweep
 * does, and a second set in the sibling would be a second set of *aliases* —
 * a behaviour change in the hottest code in the game, wearing the clothes of a
 * file move. So the vectors live here, both halves import them, and the
 * aliasing after the move is the aliasing before it, object for object.
 *
 * Nothing in this solver may ask the world a second question in the middle of
 * the first, and that was already true before the split: `CollisionWorld.query()`
 * hands back one reused candidate array, so a filter that called back into the
 * world would clobber the very list it was being asked about. One set of
 * scratch for both files is therefore enough, and `tests/solverquery.js`
 * asserts that it is one set by driving each half and reading these objects.
 *
 * Layering (Section 3.1): imports nothing.
 */

/**
 * Shared by `physics.js`'s sweep, depenetration and step-up and by
 * `physicsquery.js`'s raycast and line of sight. `remaining` is the slide
 * loop's alone; `min`, `max`, `delta` and `normal` are used by both halves.
 */
export const scratch = {
  min: { x: 0, y: 0, z: 0 },
  max: { x: 0, y: 0, z: 0 },
  delta: { x: 0, y: 0, z: 0 },
  remaining: { x: 0, y: 0, z: 0 },
  normal: { x: 0, y: 0, z: 0 },
};

export function set(out, x, y, z) {
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}
