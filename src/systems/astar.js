/**
 * BLACKLINE — systems/astar.js
 *
 * A* over the waypoint graph (Section 11: "no pathfinding library. Navigation
 * is a 14-node waypoint graph with explicit links, walked with A-star").
 *
 * Pure: a node list in, a list of node ids out. Split out of ai.js — which was
 * over the ~600 line guidance — because this is the one piece of that file with
 * no knowledge of a Warden, a state machine or a frame, and because it is the
 * piece that has already gone wrong once. The Phase 6 version hung the tab so
 * hard that `1 + 1` timed out; the two comments below are the scar tissue, and
 * they are easier to protect in a file that does nothing else.
 *
 * Layering (Section 3.1): imports nothing.
 */

/**
 * @param {{position: {distanceTo: (other: object) => number}, links: number[]}[]} nodes
 * @param {number} startId
 * @param {number} goalId
 * @returns {number[]} node ids from start to goal; `[startId]` if unreachable
 */
export function findPath(nodes, startId, goalId) {
  if (startId === goalId) return [startId];
  const goal = nodes[goalId].position;

  const open = [startId];
  const cameFrom = new Map();
  const gScore = new Map([[startId, 0]]);
  const fScore = new Map([[startId, nodes[startId].position.distanceTo(goal)]]);
  // `has` and not `||`. The start node's score is 0, and `0 || Infinity` is
  // Infinity — so every relaxation back into the start looked like an
  // improvement, which wrote cameFrom[start] and put a cycle in the parent
  // chain. Reconstruction then walked that cycle forever and wedged the tab.
  const score = (table, id) => (table.has(id) ? table.get(id) : Infinity);

  while (open.length) {
    let bestIndex = 0;
    for (let i = 1; i < open.length; i++) {
      if (score(fScore, open[i]) < score(fScore, open[bestIndex])) bestIndex = i;
    }
    const current = open.splice(bestIndex, 1)[0];

    if (current === goalId) {
      const path = [current];
      let node = current;
      // Bounded: a parent chain can visit each node at most once, so anything
      // longer is a cycle. Belt and braces after the above.
      for (let guard = 0; cameFrom.has(node) && guard <= nodes.length; guard++) {
        node = cameFrom.get(node);
        path.unshift(node);
      }
      return path;
    }

    for (const next of nodes[current].links) {
      const tentative =
        score(gScore, current) + nodes[current].position.distanceTo(nodes[next].position);
      if (tentative >= score(gScore, next)) continue;
      cameFrom.set(next, current);
      gScore.set(next, tentative);
      fScore.set(next, tentative + nodes[next].position.distanceTo(goal));
      if (open.indexOf(next) === -1) open.push(next);
    }
  }
  // Disconnected: the map asserts this cannot happen, but never walk blind.
  return [startId];
}
