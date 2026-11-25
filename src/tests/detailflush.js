/**
 * BLACKLINE - tests/detailflush.js
 *
 * A run that is killed keeps the verdicts it had already earned (H134).
 *
 * `--details` used to be written once, at the very end of `suite.mjs`. The
 * watchdog killed three runs in one night, every one of them in its last ten
 * checks - 272 of 279, 269 of 279, 258 of 261 - and each left no file at all,
 * so two hundred and fifty-odd passed checks were thrown away three from the
 * finish. The file is now rewritten whenever a run settles more checks.
 *
 * Two halves, because the thing is two things.
 *
 * **The payload is run, not read.** `scripts/details.mjs` imports nothing
 * (the page imports it, as it imports `detaildrift.mjs`), so this builds the
 * file's value from a run that stops part way and holds that it serialises,
 * parses back, keeps every settled entry in order and ends on the last
 * settled check - and that a complete run is still the shape `detaildrift.mjs`
 * and `suitereport.mjs` read. `shapeResult` is run too, and handed to a second
 * evaluator as source the way the runner hands it to the page: the partial
 * entry and the finished one must be one shape, and that is the mechanism.
 *
 * **The wiring is read, because the page has no processes.** It cannot run
 * a suite inside a suite (`runnerguard.js`) and cannot kill one, so the three
 * links a kill depends on are held by reading their source: the page publishes
 * what has settled, the watchdog's poll hands it out **inside its loop**, and
 * the runner writes it through `writeDetails` from that hand-over and not only
 * after the last map. Move any one back out and the first check three from
 * the end of a run is a lost file again.
 *
 * Names a token in two halves where it quotes one, so this file does not
 * enrol itself in a census that reads for it (H131, TRAPS.md).
 *
 * Registered from tests/index.js; nothing imports main.js (Section 3.1).
 */

import { detailsPayload, shapeResult } from '../../scripts/details.mjs';
import { uncommented } from './sourcetext.js';

const RUNNER = '/scripts/suite.mjs';
const WATCHDOG = '/scripts/watchdog.mjs';
const PAGE = '/src/ui/autosuite.js';

/** Quoted in halves: the names this module reads for, and must not be read for. */
const WRITE = 'write' + 'Details';
const FLUSH = 'flush' + 'Details';
const HANDOVER = 'on' + 'Settled';
const PUBLISHED = 'suite' + 'Settled';
const RAW_WRITE = 'writeFile' + 'Sync';
const RUN_CHECKS = '_run' + 'Checks';
const PUBLISH = 'pub' + 'lish';

async function text(origin, rel) {
  const response = await fetch(`${origin}${rel}`);
  if (!response.ok) return { error: `${rel}: ${response.status}` };
  return { body: await response.text() };
}

const entry = (id, extra = {}) => ({ id, pass: true, detail: `${id} ok`, detailLength: id.length + 3, ms: 1, ...extra });

/** The source from the brace after `from` to its match, strings ignored (the loops read here hold none with a brace). */
function bodyAfter(source, from) {
  const open = source.indexOf('{', from);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(open, i + 1);
  }
  return null;
}

export function register(debugTools) {
  debugTools.registerAutoTest({
    id: 'a-killed-run-keeps-the-verdicts-it-already-earned',
    spec: 'Section 17.1 / H134',
    run: async (h) => {
      const problems = [];

      // 1. A run that stops part way. Two maps; the second has settled three of its five.
      const plant = ['p1', 'p2', 'p3', 'p4', 'p5'].map(id => entry(id));
      const yard = ['y1', 'y2', 'y3'].map(id => entry(id, id === 'y2' ? { pass: false } : {}));
      const partial = [
        { map: 'plant', ms: 12, passed: 5, results: plant },
        { map: 'yard', results: yard },
      ];
      const payload = detailsPayload(partial);
      let back = null;
      try {
        back = JSON.parse(JSON.stringify(payload, null, 2) + '\n');
      } catch (e) {
        problems.push(`a partial run does not serialise and parse back: ${e.message}`);
      }
      if (back) {
        const ids = back.flatMap(r => r.results.map(x => x.id)).join(',');
        if (ids !== 'p1,p2,p3,p4,p5,y1,y2,y3') problems.push(`a partial run kept "${ids}" and not every settled check in order`);
        const last = back[back.length - 1].results;
        if (!last.length || last[last.length - 1].id !== 'y3') problems.push('a partial run does not end on the last check that finished');
        if (last[1] && last[1].pass !== false) problems.push('a settled failure came back as something else');
        if (back.map(r => r.map).join(',') !== 'plant,yard') problems.push('a partial run lost a map, or reordered them');
        if (Object.keys(back[0]).sort().join() !== 'map,results') problems.push('an entry carries more than its map and results, which is not what the readers were written against');
      }
      // A finished run is byte for byte what the single write at the end produced.
      const oldWay = JSON.stringify(partial.map(r => ({ map: r.map, results: r.results })), null, 2);
      if (JSON.stringify(payload, null, 2) !== oldWay) problems.push('the payload of a complete run is not what --details held before H134');

      // 2. The shape of one entry, and that it survives being handed over as source.
      const long = { id: 'long', pass: 1, detail: 'x'.repeat(500), ms: 12.6 };
      const rich = { id: 'rich', pass: true, detail: 'd', ms: 0.4, ceiling: { c: 1 }, roster: ['a'], draws: { total: 3 } };
      const bare = { id: 'bare', pass: false, ms: 2, draws: { total: 0 } };
      const shaped = shapeResult(long);
      if (shaped.pass !== true || shaped.detail.length !== 400 || shaped.detailLength !== 500 || shaped.ms !== 13) {
        problems.push(`a long result is shaped as ${JSON.stringify({ pass: shaped.pass, cut: shaped.detail.length, was: shaped.detailLength, ms: shaped.ms })}`);
      }
      if (Object.keys(shaped).join() !== 'id,pass,detail,detailLength,ms') problems.push('a plain result gained a key it did not have, so two-hundred-odd lines each carry a null');
      if (Object.keys(shapeResult(rich)).join() !== 'id,pass,detail,detailLength,ms,ceiling,roster,draws') problems.push('a result with a ceiling, a roster and draws lost one');
      if (shapeResult(bare).detail !== '' || 'draws' in shapeResult(bare)) problems.push('a result with no detail and no draws is not the plain shape');
      let handed = null;
      try {
        handed = new Function('return ' + shapeResult.toString())();
      } catch (e) {
        problems.push(`the shaper cannot be handed over as source: ${e.message}`);
      }
      if (handed && JSON.stringify([long, rich, bare].map(x => handed(x))) !== JSON.stringify([long, rich, bare].map(x => shapeResult(x)))) {
        problems.push('the shaper handed over as source answers differently from the module\'s own');
      }

      // 3. The three links, read.
      const origin = window.location.origin;
      const [runner, watchdog, page] = await Promise.all([text(origin, RUNNER), text(origin, WATCHDOG), text(origin, PAGE)]);
      for (const [name, got] of [[RUNNER, runner], [WATCHDOG, watchdog], [PAGE, page]]) {
        if (got.error) problems.push(`${got.error} - this clause reads ${name}`);
      }
      if (!runner.error) {
        const said = uncommented(runner.body);
        if (!new RegExp(`import \\{[^}]*\\b${WRITE}\\b[^}]*\\} from '\\./details\\.mjs'`).test(said)) {
          problems.push(`${RUNNER} does not import ${WRITE} from ./details.mjs`);
        }
        if (new RegExp(`${RAW_WRITE}\\(\\s*DETAILS`).test(said)) problems.push(`${RUNNER} writes --details itself again, around ${WRITE}`);
        const helper = new RegExp(`function ${FLUSH}\\b`).exec(said);
        const helperBody = helper && bodyAfter(said, helper.index + helper[0].length);
        if (!helperBody || !helperBody.includes(`${WRITE}(`)) problems.push(`${FLUSH} does not go through ${WRITE}`);
        if (!helperBody || !/try\s*\{/.test(helperBody) || !/catch/.test(helperBody)) problems.push(`${FLUSH} is not wrapped, so a locked file could kill the run`);
        if (!helperBody || !/if \(!DETAILS\) return/.test(helperBody)) problems.push(`${FLUSH} is not a no-op without --details`);
        // Inside the per-check hand-over, which sits between a run's deadline and its push, and also after the last map.
        const from = said.indexOf('guard.withDeadline(');
        const to = said.indexOf('runs.push(');
        const between = from >= 0 && to > from ? said.slice(from, to) : '';
        if (!new RegExp(`${HANDOVER}\\s*:[^\\n]*${FLUSH}\\(`).test(between)) {
          problems.push(`no ${FLUSH}( sits in the ${HANDOVER} hand-over inside the per-run loop, so a run killed before it returns writes nothing`);
        }
        const after = to > 0 ? said.slice(to) : '';
        if (!new RegExp(`${FLUSH}\\(runs\\)`).test(after)) problems.push(`no ${FLUSH}(runs) after the last map, so a finished run's file is not complete`);
      }
      if (!watchdog.error) {
        const said = uncommented(watchdog.body);
        const loop = /while \(!settled\)/.exec(said);
        const body = loop && bodyAfter(said, loop.index);
        if (!body || !body.includes(`${HANDOVER}(`)) problems.push(`${WATCHDOG}'s poll does not hand settled checks out inside its loop`);
      }
      if (!page.error && !new RegExp(`state\\.${PUBLISHED}\\s*=`).test(uncommented(page.body))) {
        problems.push(`${PAGE} does not publish the checks it has settled on state.${PUBLISHED}`);
      }

      // 4. A run called directly must not take the carrier over (H136). Driven,
      // because the page can exercise this half with no process: `_runChecks` is
      // handed `top` true by hand, the way `pipelinewait.js` does, which the depth
      // counter cannot see. Read by identity, since in a one-check subset the outer
      // `results` is still empty and a length proves nothing. The break that reddens
      // this clause is `if (publish)` back to `if (top)` in the run's carrier line.
      const suite = h.debugTools.suite;
      const carrier = h.debugState[PUBLISHED];
      if (!Array.isArray(carrier)) {
        problems.push(`the page published nothing on state.${PUBLISHED} for the run this check is inside, so a kill would carry nothing out`);
      } else {
        const seenIn = {};
        const probe = (id) => ({
          id,
          spec: 'H136',
          run: () => {
            seenIn[id] = h.debugState[PUBLISHED];
            return { pass: true, detail: 'entered' };
          },
        });
        const direct = 'inline-a-direct-run-must-not-claim-the-carrier';
        const nested = 'inline-a-run-inside-a-check-must-not-claim-the-carrier';
        await suite[RUN_CHECKS]([probe(direct)], true);
        if (seenIn[direct] !== carrier) {
          problems.push(`a direct ${RUN_CHECKS}([t], true) took the carrier over while it ran, so every later watchdog poll slices a one-element array and the rest of the run is lost (H136)`);
        }
        if (h.debugState[PUBLISHED] !== carrier) {
          problems.push(`a direct ${RUN_CHECKS}([t], true) left the carrier replaced after it returned, so every later watchdog poll slices a one-element array and the rest of the run is lost (H136)`);
        }
        await suite.runChecks([probe(nested)]);
        if (seenIn[nested] !== carrier || h.debugState[PUBLISHED] !== carrier) {
          problems.push(`a runChecks inside a check replaced the carrier, so the rest of the run is lost to a watcher (H136)`);
        }
        if (carrier.some(r => r.id === direct || r.id === nested)) problems.push('a nested run appended its results into the outer run carrier');
      }

      // 4, continued. And the flag cannot be quietly re-defaulted: the third parameter is false, and the assignment follows it.
      if (!page.error) {
        const said = uncommented(page.body);
        const sig = new RegExp(`${RUN_CHECKS}\\(([^)]*)\\)\\s*\\{`).exec(said);
        const third = sig && sig[1].split(',')[2];
        if (!third || !new RegExp(`^\\s*${PUBLISH}\\s*=\\s*false\\s*$`).test(third)) {
          problems.push(`${PAGE}'s ${RUN_CHECKS} does not default its third parameter, ${PUBLISH}, to false, so a direct call is a publisher again (H136)`);
        }
        if (!new RegExp(`if \\(${PUBLISH}\\)\\s*this\\.state\\.${PUBLISHED}\\s*=`).test(said)) {
          problems.push(`${PAGE} does not guard the carrier assignment with ${PUBLISH}, so the depth counter alone decides who owns it (H136)`);
        }
      }

      return {
        pass: problems.length === 0,
        detail: problems.length === 0
          ? 'a run cut after 8 checks parses back in order ending on y3, and a complete run is the shape it was; '
            + 'the shaper survives hand-over as source; the page publishes what has settled, '
            + `the watchdog's loop hands it out, and ${RUNNER} writes it through ${WRITE} from inside the per-run loop and after it; `
            + 'a direct run keeps the outer carrier by identity, and the flag defaults to false'
          : problems.join('; '),
      };
    },
  });
}
