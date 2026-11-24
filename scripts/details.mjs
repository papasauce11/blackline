// BLACKLINE - scripts/details.mjs
//
// H134: what `--details` holds, and the one place it is written.
//
// Until now the file was written once, at the very end of `suite.mjs`, so a
// run the watchdog killed left **nothing**. Tonight three died in their last
// ten checks (272 of 279 on the plant, 269 of 279, 258 of 261 on the yard) and
// each took every verdict it had already earned with it. The file is now
// rewritten whenever the run settles more checks, so what is on disk is always
// an account of everything settled so far, and a run that dies three checks
// from the end hands over the rest.
//
// The page holds the results until a run returns, so a kill throws before the
// runner has seen one. The page therefore publishes them as they settle
// (`debugState.suiteSettled`, src/ui/autosuite.js) and the watchdog's poll
// carries them out (scripts/watchdog.mjs). `shapeResult` below is what both
// ends use, so a partial entry and a finished one are the same bytes.
//
// `detailsPayload` and `shapeResult` import nothing and touch no clock, which
// is what lets `src/tests/detailflush.js` import this module in the page and
// drive it (H58's rule; `detaildrift.mjs` is the precedent). `writeDetails`
// needs the file system and takes it from the process only when it is called,
// so the page never meets it.

/**
 * One check's line in the file: what the page returns and what the watchdog
 * carries out of a run that never returns.
 *
 * Self-contained on purpose. `suite.mjs` hands its source to the page
 * (`shapeResult.toString()`), because the page cannot import a module that
 * is written for node and the shape must exist once and not twice - a
 * partial entry that differed from a finished one by a field would be a
 * drift nobody looks for in a file read only after a failure.
 */
export function shapeResult(x) {
  return {
    id: x.id, pass: !!x.pass, detail: String(x.detail ?? '').slice(0, 400),
    // H91: how long the line was before the cut above (CONFIG.debug.
    // detailBudget, held equal by runnerguard.js), so a cut is visible.
    detailLength: String(x.detail ?? '').length,
    // What --details quotes, and the evidence the stall budget
    // rests on: the slowest single check is the longest gap
    // between two beats (F10).
    ms: Math.round(x.ms),
    // A check may hand the runner numbers beside its verdict, and
    // one does: the source ceiling's cluster, which the summary
    // prints per run so a passing check's finding reaches a reader
    // with no flag (H63). Spread only where it exists, so the other
    // two-hundred-odd results do not each gain a null in --details.
    ...(x.ceiling ? { ceiling: x.ceiling } : {}),
    // H91: a census's names, kept out of its detail line so the
    // readings are what the cut leaves.
    ...(Array.isArray(x.roster) ? { roster: x.roster } : {}),
    // H77: what this check took from the simulation's shared stream,
    // and how much of it was taken under a live AI. The runner's
    // number and not the check's (`_runOne` writes it after the
    // spread). Carried only where something was drawn, so the
    // hundred-odd checks that touch no match stay one line each.
    ...(x.draws && x.draws.total ? { draws: x.draws } : {}),
  };
}

/**
 * The value `--details` serialises: one entry a map run, with the results
 * that run has settled. Pure, and the same for a finished run and a partial
 * one - the last map's `results` simply stops where the run did.
 *
 * @param {{map: string, results: object[]}[]} runs
 */
export function detailsPayload(runs) {
  return runs.map(r => ({ map: r.map, results: r.results }));
}

/**
 * Write the file. Byte-identical to the single write at the end of a run
 * before H134.
 *
 * @param {string} path
 * @param {{map: string, results: object[]}[]} runs
 */
export function writeDetails(path, runs) {
  const fs = process.getBuiltinModule('node:fs');
  fs.writeFileSync(path, JSON.stringify(detailsPayload(runs), null, 2) + '\n');
}
