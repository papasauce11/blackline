/**
 * BLACKLINE - tests/solverquery.js
 *
 * AUTO suite (H56): the swept solver's read-only queries live next door, the
 * world answers them from there, and both halves write one set of scratch.
 *
 * **Why this exists.** `src/physics.js` stood at exactly 600 of Section 3.1's
 * ~600 lines - zero headroom in the hottest code in the game, where a
 * behaviour change is a rule change - so H56 moved the two methods that only
 * *read* the world, `raycast` and `lineOfSight`, into `physicsquery.js`, and
 * the five scratch vectors they share with the sweep into `physicsscratch.js`.
 * A move like that has three ways to come undone, and H51's lesson is that a
 * split nothing asserts is a split the next edit undoes without noticing:
 *
 *   1. **The methods are pasted back.** 69 lines read perfectly well in the
 *      class body; that is where they were. The clause is not a grep for a
 *      name, which cannot tell a live line from a dead one: the installed
 *      methods are asserted to be **the very function objects**
 *      `physicsquery.js` exports, and to be *enumerable* own properties of the
 *      prototype, which is what `Object.assign` makes and what a class body
 *      cannot. F3's three other mixins are the same shape and would read the
 *      same way.
 *
 *      **Those two are not the same clause, and the enumerability one is the
 *      stronger** - measured, not reasoned. Pasting a `raycast()` back into
 *      the class body and leaving the `Object.assign` in place was written as
 *      a break expecting the identity clause to stay green and the source
 *      clause to catch it. The identity clause *did* stay green, and the
 *      enumerability clause went red: a class body makes the property
 *      non-enumerable, and `Object.assign` writes through `[[Set]]`, which
 *      changes an existing writable data property's **value and not its
 *      attributes**. So the prototype ends up holding the exported function
 *      in a slot the class body shaped, and the only clause in this file that
 *      can see the difference is the one that asks how the slot was made.
 *   2. **The sibling grows its own scratch.** This is the one that would be a
 *      real defect rather than a tidiness one. The vectors exist so that a
 *      query allocates nothing, and they are *aliases*: `raycast` writes
 *      `scratch.delta`, `scratch.min` and `scratch.max`, and the sweep writes
 *      `min` and `max` too. Two sets would make the move a behaviour change
 *      wearing the clothes of a file move. So this check drives each half and
 *      reads the one exported object back - the sweep's bounds, the ray's
 *      delta, the sight line's normal - which is a fact about the live
 *      aliasing and not about anybody's import list.
 *   3. **The solver follows them out.** `sweep` is still asserted to be
 *      declared in `physics.js`, on `audiocontext.js`'s model: an allowance
 *      for something that has moved is an allowance the next line inherits
 *      without arguing.
 *
 * **And the queries still answer.** The three clauses above are structural, and
 * a structural check over code that no longer works is the F8 trap from the
 * other end. So the last clause drives both of them against whatever this map
 * really built: a ray dropped onto a box's top face lands on that box at the
 * height it was dropped from with a normal of exactly 1, a point inside a
 * sight-blocking box cannot be seen from above it, and `lineOfSight` agrees
 * with `raycast` under the live default filter on every pair - having been seen
 * to answer both ways, because an agreement clause that only ever sees one
 * answer is agreeing about nothing (the coverage lesson in `TRAPS.md`).
 *
 * Registered from tests/index.js beside the other census checks: it reads
 * source text, drives no frame and draws nothing. Nothing here imports
 * main.js (Section 3.1).
 */

import { CollisionWorld } from '../physics.js';
import { QUERY, defaultSightFilter } from '../physicsquery.js';
import { scratch } from '../physicsscratch.js';
import { codeOf, uncommented } from './sourcetext.js';

/** The three files H56 left behind, and what each is required to hold. */
const SOLVER = 'src/physics.js';
const QUERIES = 'src/physicsquery.js';
const VECTORS = 'src/physicsscratch.js';

/**
 * The methods that moved, and the ones that did not. The second list is this
 * check's own instrument (F8): a class method is a *non*-enumerable own
 * property of the prototype and a mixed-in one is enumerable, so if any of
 * these reads enumerable the distinction the clause rests on has gone and the
 * clause reads green whether it works or not.
 */
const MOVED = ['raycast', 'lineOfSight'];
const KEPT = ['sweep', 'depenetrate', 'moveAndSlide', 'query', 'overlap', 'isClear'];

/** How a method is spelled in a class body and in the exported table alike. */
const DECLARES = (name) => new RegExp(`^  ${name}\\(`, 'm');
/**
 * A module declaring scratch vectors of its own. Exactly one may. `\r?$` on
 * both of these because `uncommented` leaves a CRLF file's line endings where
 * it found them and this working copy is mixed (`TRAPS.md`); `codeOf` joins
 * with `\n` and would not need it.
 */
const OWNS_SCRATCH = /^(?:export )?const scratch = \{\r?$/m;
/** Reached by import rather than by a copy. */
const IMPORTS = (path) => new RegExp(`^import .*from '\\./${path}';\\r?$`, 'm');

/**
 * The declaration pattern's own proof, built the way its subject is. `codeOf`
 * empties quoted strings, so this is a line of code and not a line about one.
 */
const MUST_DECLARE = '  raycast(origin, direction, maxDistance, filter) {';

/** How many of the map's boxes the live clause probes, and from how high. */
const PROBES = 12;
const DROP = 2;

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-solvers-read-only-queries-live-next-door-and-share-its-scratch',
    spec: 'Section 3.1 / Section 15 / H56',
    name: 'raycast and lineOfSight are declared in physicsquery.js and in no class body, installed on CollisionWorld.prototype as the objects it exports, write the one scratch set physicsscratch.js owns, and still answer about the live map',
    run: async (h) => {
      const problems = [];
      const origin = location.origin;
      const world = h.map.collision;
      const proto = CollisionWorld.prototype;

      // ------------------------------------------------------------------
      // 1. Installed, and installed as a mixin. The instrument first: the
      //    whole clause rests on enumerable meaning "assigned" and
      //    non-enumerable meaning "written in the class body".
      // ------------------------------------------------------------------
      const stayed = KEPT.filter((name) => typeof proto[name] === 'function');
      const leaked = stayed.filter((name) => proto.propertyIsEnumerable(name));
      if (stayed.length !== KEPT.length) {
        problems.push(`${KEPT.length - stayed.length} of the solver's own methods are not on the prototype at all (${KEPT.filter((name) => !stayed.includes(name)).join(', ')})`);
      }
      if (leaked.length) {
        problems.push(`${leaked.join(', ')} read as enumerable own properties, so a class method and a mixed-in one are no longer being told apart - every clause below reads green whether it works or not`);
      }

      for (const name of MOVED) {
        if (typeof world[name] !== 'function') {
          problems.push(`the live collision world has no ${name}() at all`);
          continue;
        }
        if (proto[name] !== QUERY[name]) {
          problems.push(`CollisionWorld.prototype.${name} is not the function physicsquery.js exports, so the world answers ${name}() from somewhere else`);
        }
        if (!proto.propertyIsEnumerable(name)) {
          problems.push(`${name} is a non-enumerable own property of CollisionWorld.prototype, which is what a class body makes - H56 moved it out and physics.js installs it with Object.assign`);
        }
      }

      // ------------------------------------------------------------------
      // 2. One scratch set, proved by driving each half and reading the one
      //    exported object back. Each reading is taken immediately after its
      //    own call, because the next call overwrites the vectors - and the
      //    three calls are deliberately pointed at nothing in particular,
      //    since what is being read is which object they wrote.
      // ------------------------------------------------------------------
      const near = (a, b) => Math.abs(a - b) <= 1e-12;
      const half = { x: 0.4, y: 0.9, z: 0.4 };
      const centre = { x: 3.25, y: 7.5, z: -11.75 };
      const delta = { x: 1.5, y: -2.25, z: 0.75 };
      world.sweep(centre, half, delta);
      const sweptLow = Math.min(centre.x, centre.x + delta.x) - half.x;
      const sweptHigh = Math.max(centre.z, centre.z + delta.z) + half.z;
      if (!near(scratch.min.x, sweptLow) || !near(scratch.max.z, sweptHigh)) {
        problems.push(`sweep() did not write the scratch ${VECTORS} owns: min.x ${scratch.min.x} and max.z ${scratch.max.z} against the ${sweptLow} and ${sweptHigh} it had just swept`);
      }

      const far = 9.5;
      world.raycast(centre, { x: 0, y: -1, z: 0 }, far);
      if (!near(scratch.delta.y, -far) || !near(scratch.delta.x, 0)) {
        problems.push(`raycast() wrote its delta (${scratch.delta.x}, ${scratch.delta.y}, ${scratch.delta.z}) into a scratch the solver does not share - H56's move is a behaviour change if the two halves alias different vectors`);
      }

      world.lineOfSight(centre, { x: centre.x, y: centre.y, z: centre.z + 4 });
      if (!near(scratch.normal.z, 1) || !near(scratch.normal.x, 0)) {
        problems.push(`lineOfSight() wrote its direction (${scratch.normal.x}, ${scratch.normal.y}, ${scratch.normal.z}) into a scratch the solver does not share`);
      }

      // ------------------------------------------------------------------
      // 3. Where the three files say they are. `codeOf` for a declaration and
      //    `uncommented` for an import, whose evidence is a quoted path - the
      //    division H62 wrote down.
      // ------------------------------------------------------------------
      const [solverRaw, queriesRaw, vectorsRaw] = await Promise.all(
        [SOLVER, QUERIES, VECTORS].map((path) => fetch(`${origin}/${path}`).then((r) => (r.ok ? r.text() : null))),
      );
      if (queriesRaw === null || vectorsRaw === null) {
        problems.push(`${queriesRaw === null ? QUERIES : VECTORS} is not served; H56 split it out of ${SOLVER}, which had no headroom left`);
      } else if (solverRaw === null) {
        problems.push(`${SOLVER} is not served, and it is the file this check is about`);
      } else {
        const solver = codeOf(solverRaw);
        const queries = codeOf(queriesRaw);
        if (!DECLARES('raycast').test(MUST_DECLARE)) {
          problems.push('the declaration pattern no longer matches the line it is built to match, so the clauses below read zero whether they work or not');
        }
        for (const name of MOVED) {
          if (!DECLARES(name).test(queries)) problems.push(`${QUERIES} does not declare ${name}(), which is what H56 moved there`);
          if (DECLARES(name).test(solver)) problems.push(`${SOLVER} declares ${name}() again; H56 moved it out to get that file off 600 of 600`);
        }
        if (!DECLARES('sweep').test(solver)) {
          problems.push(`${SOLVER} no longer declares sweep(), so the seam this check is written about has moved and what it allows is stale`);
        }
        const owners = [[SOLVER, solver], [QUERIES, queries], [VECTORS, codeOf(vectorsRaw)]]
          .filter(([, text]) => OWNS_SCRATCH.test(text))
          .map(([path]) => path);
        if (owners.length !== 1 || owners[0] !== VECTORS) {
          problems.push(`${owners.length} of the three solver files declare scratch vectors of their own (${owners.join(', ') || 'none'}); only ${VECTORS} may, or the halves stop aliasing`);
        }
        const said = uncommented(solverRaw);
        for (const path of ['physicsquery.js', 'physicsscratch.js']) {
          if (!IMPORTS(path).test(said)) problems.push(`${SOLVER} imports nothing from ./${path}, so either it is reached some other way or there are two of it`);
        }
      }

      // ------------------------------------------------------------------
      // 4. And they still answer about the live map. Both probes come off
      //    whatever this map actually built, never off a coordinate written
      //    down here.
      // ------------------------------------------------------------------
      const boxes = world.boxes.filter((box) => box.solid && box.blocksSight).slice(0, PROBES);
      let landed = 0;
      let blocked = 0;
      let clear = 0;
      let disagreed = 0;
      let seenInside = 0;
      for (const box of boxes) {
        const from = { x: (box.min.x + box.max.x) / 2, y: box.max.y + DROP, z: (box.min.z + box.max.z) / 2 };
        const down = world.raycast(from, { x: 0, y: -1, z: 0 }, DROP * 2);
        if (down && down.box === box) {
          landed++;
          if (down.ny !== 1 || Math.abs(down.distance - DROP) > 1e-9) {
            problems.push(`a ray dropped ${DROP}m onto the top of "${box.tag}" reads ny ${down.ny} at ${down.distance.toFixed(6)}m`);
          }
        }
        // A corner inside the box, and a metre straight up away from it. The
        // first has a geometric answer; the second may go either way, and is
        // here so that the agreement clause sees both.
        const inside = { x: box.min.x + 0.01, y: box.min.y + 0.01, z: box.min.z + 0.01 };
        for (const target of [inside, { x: from.x, y: from.y + 1, z: from.z }]) {
          const dx = target.x - from.x;
          const dy = target.y - from.y;
          const dz = target.z - from.z;
          const span = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const sees = world.lineOfSight(from, target);
          // The two queries are one definition, asked of the live default
          // filter rather than of a copy of it.
          const hit = world.raycast(from, { x: dx / span, y: dy / span, z: dz / span }, span, defaultSightFilter);
          if (sees !== (hit === null)) disagreed++;
          if (sees) clear++; else blocked++;
          if (target === inside && sees) seenInside++;
        }
      }
      if (!world.lineOfSight(centre, { ...centre })) {
        problems.push('lineOfSight() says a point cannot see itself, so the degenerate branch below EPSILON has gone');
      }
      if (boxes.length < 2) problems.push(`this map built ${boxes.length} solid sight-blocking boxes, so the live clause has nothing to probe`);
      if (!landed) problems.push(`no ray dropped ${DROP}m onto a box top landed on that box, so the raycast clause measured nothing`);
      if (seenInside) problems.push(`${seenInside} of ${boxes.length} sight-blocking boxes were seen into from ${DROP}m above their own top face`);
      if (disagreed) problems.push(`${disagreed} of ${boxes.length * 2} pairs had lineOfSight and raycast disagreeing about the same line`);
      if (!blocked || !clear) problems.push(`the agreement clause saw ${blocked} blocked and ${clear} clear lines; it has to see both or it is agreeing about nothing`);

      return {
        pass: problems.length === 0,
        // Terse on purpose: a detail line is cut at 400 characters and the cut
        // is invisible, so the problems come first when there are any.
        detail: problems.length === 0
          ? `${MOVED.join('/')} in ${QUERIES}, none in a class body, installed as its own objects`
            + `; ${stayed.length} kept methods all non-enumerable; one scratch, ${VECTORS}, written by sweep+raycast+lineOfSight`
            + `; ${landed}/${boxes.length} drops landed own-box at ${DROP}m ny 1; ${blocked} blocked/${clear} clear agreed`
          : problems.join('; '),
      };
    },
  });
}
