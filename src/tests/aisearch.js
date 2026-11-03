/**
 * BLACKLINE - tests/aisearch.js
 *
 * AUTO suite (K1): the Warden searches the way a person does.
 *
 * The sweep it replaced looked at the three waypoints nearest the spot the
 * Shade was lost, and waypoints sit in open space by design, so a Shade
 * crouched behind a crate two metres from the Warden, or lying on a stack it
 * cannot climb, was never looked at. SEARCH now sweeps the hiding spots round
 * the last-known position and looks up at the tops it cannot reach
 * (`systems/aisearch.js`). This holds both, each on whatever map the page is
 * on, in a place it finds at runtime: it names no coordinate and no tag.
 *
 *   behind cover  a crate-sized box stands on the ground; the Shade crouches
 *                 beside its far face and the last-known position is three
 *                 metres out from the near one, where the box hides her.
 *   on a top      a stack the Warden cannot stand on; the Shade crouches on
 *                 it. Twice: with the last-known position on the ground at its
 *                 foot, where the lip of the stack is between the Warden and
 *                 her and it has to walk to see; and with the Warden already
 *                 standing where she can be seen from, so that the look up is
 *                 the first thing it does and nothing else can meet her first.
 *
 * Each scene is held to two things. **The plan**, read the moment SEARCH is
 * entered through the AI's own entry point: the sweep must contain a hiding
 * spot within three metres of her, or a top whose perch is hers. And **the
 * outcome**: the Warden's own eyes find her inside one search
 * (`CONFIG.ai.searchDuration`) - it had her in view and its detection of her
 * rose - and, in the scene that puts the look up first, it got there by
 * looking up: the gaze rested on the top and the head was raised toward it.
 * The plan is what turns red when a sweep stops looking where she is; the gaze
 * is what turns red when it plans to look and never lifts its head.
 *
 * The meter is held at its maximum, as the other AI checks do, so the numbers
 * are the preset's and not a lamp's: this is about where the Warden looks.
 *
 * Registered from tests/index.js. Nothing here imports main.js (Section 3.1).
 */

import { CONFIG } from '../config.js';
import { AI_STATE } from '../systems/ai.js';
import { angleDelta } from '../systems/aistate.js';

const A = CONFIG.ai;
const S = CONFIG.shade;
const W = CONFIG.warden;
const M = CONFIG.map;
const dt = CONFIG.time.fixedDt;

/** A crouching Shade's torso above her feet, and the Warden's eye above its. */
const TORSO = S.crouchHeight * CONFIG.detection.torsoHeightRatio;
const EYE = W.standHeight * W.eyeHeightRatio;
const BODY = { x: S.radius, y: S.crouchHeight / 2, z: S.radius };
const WARDEN = { x: W.radius, y: W.standHeight / 2, z: W.radius };
const FACES = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
/** A plan check this close, flat, to where she is, is a check on her. */
const NEAR = 3;
/** The gaze counts as on the top when yaw and pitch are within this of it (the AI's own is searchAlign). */
const ON_IT = 0.3;

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const at = (p, dy = 0) => ({ x: p.x, y: p.y + dy, z: p.z });
const stands = (h, p, half) => h.map.collision.isClear(at(p, half.y + 0.02), half);
const sees = (h, from, to) => h.map.collision.lineOfSight(at(from, EYE), at(to, TORSO));

/** The ground a Warden walks from one foot position to another, or nothing. */
const walkable = (h, from, to) => {
  const ground = h.map.wardenGround;
  return ground.has(from) && ground.has(to) && ground.route(from, to) !== null;
};

/**
 * A crate-sized box on the ground, a place to crouch behind it and a place to
 * have lost her from: the far face and the near one, the box between. Null if
 * the map has no such box.
 */
function findCover(h) {
  for (const box of h.map.collision.boxes) {
    const w = box.max.x - box.min.x;
    const d = box.max.z - box.min.z;
    const height = box.max.y - box.min.y;
    if (!box.solid || !box.blocksSight || box.min.y > M.groundY + 0.05) continue;
    if (height < 1 || height > 3 || w < 1 || d < 1 || w > 4 || d > 4) continue;
    for (const face of FACES) {
      const reach = (face.x ? w : d) / 2;
      const hide = { x: box.centerX + face.x * (reach + S.radius + 0.5), y: box.min.y, z: box.centerZ + face.z * (reach + S.radius + 0.5) };
      const known = { x: box.centerX - face.x * (reach + 3), y: box.min.y, z: box.centerZ - face.z * (reach + 3) };
      if (!stands(h, hide, BODY) || !stands(h, known, WARDEN)) continue;
      if (!walkable(h, known, hide) || sees(h, known, hide)) continue;
      return { name: box.tag || 'a crate', hide, known, height };
    }
  }
  return null;
}

/**
 * A stack on the ground the Warden cannot stand on, with room to crouch on it,
 * the ground beside its foot to have lost her from (`known`), and ground the
 * Warden can see her from, looking up (`vantage`, the nearest to the foot,
 * with a line to her and to a point a little lower, as the AI asks). Prefers
 * a foot from which she cannot be seen, so the Warden has to walk to look;
 * takes one from which she can if the map has no other. Null if the map has
 * no such stack.
 */
function findPerch(h) {
  const ground = h.map.wardenGround;
  let seen = null;
  for (const box of h.map.collision.boxes) {
    const w = box.max.x - box.min.x;
    const d = box.max.z - box.min.z;
    const top = box.max.y;
    if (!box.climbable || box.min.y > M.groundY + 0.05 || top < 2 || top > 4.5) continue;
    if (w < 1.5 || d < 1.5 || w > A.searchMaxSide || d > A.searchMaxSide) continue;
    const perch = { x: box.centerX, y: top, z: box.centerZ };
    if (ground.cellsWithin(perch, 1).some((cell) => Math.abs(cell.y - top) <= W.stepHeight)) continue;
    if (!stands(h, perch, BODY)) continue;
    const lower = at(perch, -A.searchVantageMargin);
    // Below the top, or looking at it would not be looking up.
    const cells = ground.cellsWithin(perch, A.searchLookUpRadius)
      .filter((cell) => cell.y + EYE < top && sees(h, cell, perch) && sees(h, cell, lower));
    if (!cells.length) continue;
    for (const face of FACES) {
      const reach = (face.x ? w : d) / 2;
      const foot = { x: perch.x + face.x * (reach + W.radius + 1), y: box.min.y, z: perch.z + face.z * (reach + W.radius + 1) };
      if (!stands(h, foot, WARDEN) || !ground.has(foot)) continue;
      const vantage = cells.reduce((near, cell) => (flat(cell, foot) < flat(near, foot) ? cell : near));
      const scene = { name: box.tag || 'a stack', hide: perch, known: foot, vantage, height: top };
      if (!sees(h, foot, perch)) return scene;
      seen = seen || scene;
    }
  }
  return seen;
}

/**
 * Hide the Shade where the scene says, put the Warden at the last-known
 * position facing away from her, enter SEARCH the way the AI does, and step
 * until its detection of her rises or the bound is up. Everything it saw on
 * the way is in the returned story.
 */
function search(h, scene, up, strict = false) {
  const { shade, warden, wardenAI: ai } = h;
  h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: false });
  h.menu.hide();
  h.input.clearAll();

  // Crouched first and still, so the torso the Warden is looking for is the
  // low one for every step of the search.
  shade.reset({ position: scene.hide, yaw: 0 });
  h.input.heldCodes.add('ControlLeft');
  h.stepFrames(8);
  const crouched = shade.crouching;

  const away = Math.atan2(-(scene.hide.x - scene.known.x), -(scene.hide.z - scene.known.z)) + Math.PI;
  warden.reset({ position: scene.known, yaw: away });
  ai.reset();
  ai.lastKnown = { x: scene.known.x, y: scene.known.y, z: scene.known.z };
  ai._enterSearch();

  const story = {
    crouched,
    entered: ai.state === AI_STATE.SEARCH,
    planned: ai._searchSpots.map((check) => check.kind),
    onHer: ai._searchSpots.some((check) => check.kind === (up ? 'top' : 'spot') && flat(up ? check.aim : check.position, scene.hide) <= (up ? 0.5 : NEAR)),
    sawAt: null,
    roseAt: null,
    lookedAt: null,
    pitch: 0,
  };
  // A strict search runs until it has both: the cone can take her in a few
  // frames before the head has finished coming round, and the detection rises
  // a reaction delay after.
  const bound = Math.ceil(A.searchDuration / dt);
  for (let i = 0; i < bound && (story.roseAt === null || (strict && story.lookedAt === null)); i++) {
    h.input.heldCodes.add('ControlLeft');
    h.detection.smoothed = CONFIG.detection.meterMax;
    h.stepFrames(1);
    const t = (i + 1) * dt;
    if (ai.sees && story.sawAt === null) story.sawAt = t;
    if (story.roseAt === null && ((ai.sees && ai.accumulator > 0) || ai.state === AI_STATE.ENGAGE)) story.roseAt = t;

    // The head, against where the top really is and not where the AI aimed.
    const look = ai.lookingAt;
    if (up && look && look.kind === 'top' && story.lookedAt === null) {
      const eyeY = warden.feetY + EYE;
      const bearing = Math.atan2(-(scene.hide.x - warden.position.x), -(scene.hide.z - warden.position.z));
      const raised = Math.atan2(scene.hide.y + TORSO - eyeY, flat(scene.hide, warden.position));
      if (Math.abs(angleDelta(warden.yaw, bearing)) <= ON_IT && warden.pitch > 0 && Math.abs(raised - warden.pitch) <= ON_IT) {
        story.lookedAt = t;
        story.pitch = warden.pitch;
      }
    }
  }
  return story;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'the-warden-searches-behind-cover-and-looks-up-at-tops-it-cannot-reach',
    spec: 'Section 11 (SEARCH) / K1',
    name: 'Lost behind a crate or on a stack it cannot climb, the Shade is found inside one search: the Warden sweeps the cover round where she was last known, and looks up',
    run: (h) => {
      const problems = [];
      const cover = findCover(h);
      const perch = findPerch(h);
      if (!cover) problems.push('this map has no crate-sized box with ground to crouch behind it and ground to have lost her from');
      if (!perch) problems.push('this map has no stack the Warden cannot stand on with room to crouch on it and a place to see her from');
      if (problems.length) return { pass: false, detail: problems.join('; ') };

      const bound = A.searchDuration;
      let behind;
      let walk;
      let look;
      try {
        behind = search(h, cover, false);
        walk = search(h, perch, true);
        look = search(h, { ...perch, known: perch.vantage }, true, true);
      } finally {
        h.input.clearAll();
        h.initMatch({ mode: 'competitive', role: CONFIG.match.humanRole, ai: true, objective: true });
        h.menu.hide();
      }

      const scenes = [
        ['behind cover', behind, cover],
        ['on a top, lost at its foot', walk, perch],
        ['on a top, in sight of it', look, perch],
      ];
      for (const [label, story, scene] of scenes) {
        if (!story.crouched) problems.push(`${label}: the Shade was not crouching, so the torso looked for was not the low one`);
        if (!story.entered) problems.push(`${label}: SEARCH was not entered`);
        if (!story.onHer) problems.push(`${label}: the sweep [${story.planned.join(' ')}] holds no check on ${scene.name} where she is`);
        if (story.roseAt === null) {
          problems.push(`${label}: ${scene.name} - the Warden's detection of her did not rise in ${bound}s (in view at ${story.sawAt === null ? 'never' : `${story.sawAt.toFixed(1)}s`})`);
        }
      }
      // Only from a place it can see her from does the look-up come first, with
      // nothing but the head turning ahead of it; from the foot the Warden may
      // meet her on its way, and what holds there is the plan.
      if (look.lookedAt === null) problems.push('on a top, in sight of it: the Warden never rested its gaze on the top with its head raised toward it');

      const secs = (t) => (t === null ? 'never' : `${t.toFixed(1)}s`);
      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? `behind ${cover.name} (${cover.height.toFixed(1)}m): sweep [${behind.planned.join(' ')}], in view ${secs(behind.sawAt)}, detection rose ${secs(behind.roseAt)}; `
            + `on ${perch.name} (${perch.height.toFixed(1)}m): from its foot sweep [${walk.planned.join(' ')}], in view ${secs(walk.sawAt)}, rose ${secs(walk.roseAt)}; `
            + `in sight of it, gaze up ${secs(look.lookedAt)} at pitch ${look.pitch.toFixed(2)}, in view ${secs(look.sawAt)}, rose ${secs(look.roseAt)}; bound ${bound}s`
          : problems.join('; '),
      };
    },
  });
}
