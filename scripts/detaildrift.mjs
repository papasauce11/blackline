// BLACKLINE - scripts/detaildrift.mjs
//
// H79: which checks answered differently between the two runs of a map, and
// by how much.
//
// `flaky` compares **verdicts**, so a reading can drift twenty percent and
// stay green. H74 measured eleven pixel checks across the two runs of each map
// on one tree and ten answered differently - a body of 19,228 or 19,260 pixels
// on the plant, a smoke cloud of 794,510 or 861,269 - and nothing in the suite
// said so. A floor set just under one run's reading is a floor that will go red
// on a Tuesday, and until this file there was no way to know which floors those
// were.
//
// The comparison is between two detail **strings**, so it has to decide what a
// difference is. A detail line is prose with numbers in it, and the two kinds
// of difference are not the same thing: numbers that moved under prose that did
// not is a **reading** that drifted, and prose that moved is a check saying
// something else entirely - usually a different branch taken. Both are
// reported; only the first has a magnitude.
//
// Nothing here imports a node builtin, which is what lets `src/tests/
// detaildrift.js` import this module in the page and drive it (H58's rule, and
// `args.mjs` is the precedent). It is a reading and never a verdict - D48's
// shape, the same as `spreadMs`: a threshold on how much a reading may drift is
// a rule nobody has argued yet, and the point of the report is to earn it.

/** The placeholder a number leaves behind, which no detail line contains. */
const SLOT = '\u0000';

/**
 * A detail line split into the prose and the numbers in it.
 *
 * Integers, decimals and exponents, **with a leading `+` or `-` taken as part
 * of the number, and the two treated alike**. That symmetry is the whole
 * reason this is a function rather than a regex at the call site: the first
 * draft ate a minus and left a plus in the prose, so `glove-lip +0.066` and
 * `glove-lip -0.012` - the same reading, one of them on the other side of
 * zero - came back as *the wording differs* and the drift they were the
 * clearest case of went unmeasured. A sign is part of the number.
 *
 * The cost is that a dash between two numbers reads as a sign. It is paid
 * both times: the two runs read the same line the same way, so a hyphen
 * counted as a minus cancels and the pair is still compared like for like.
 */
export function skeleton(detail) {
  const numbers = [];
  const prose = String(detail ?? '').replace(
    /[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g,
    (found) => { numbers.push(found); return SLOT; },
  );
  return { prose, numbers };
}

/** How big a move is against the pair it moved between, as a share of 1. */
function share(from, to) {
  const widest = Math.max(Math.abs(from), Math.abs(to));
  return widest === 0 ? 0 : Math.abs(to - from) / widest;
}

/**
 * Two detail lines, compared.
 *
 * `kind` is `'same'`, `'numbers'` (the prose held and at least one number
 * moved) or `'wording'` (the prose itself differs, so the numbers are not
 * comparable position by position and none is reported). `changes` carries one
 * entry per number that moved, widest share first, and `widest` is the first
 * of them.
 */
/**
 * How much of two strings is a common prefix, as a share of the longer.
 *
 * Reported with every `wording` verdict because of a case the measurement
 * found: a detail line is cut at 400 characters (H42), so a number early in
 * the line that gains a digit pushes the cut and the two lines part company at
 * the very end having said the same thing. A prefix of 0.98 is that; a prefix
 * of 0.3 is a check that took a different branch.
 */
function prefixShare(a, b) {
  const longest = Math.max(a.length, b.length);
  if (!longest) return 1;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i / longest;
}

export function compareDetails(before, after) {
  const a = skeleton(before);
  const b = skeleton(after);
  if (a.prose !== b.prose) {
    return { kind: 'wording', changes: [], widest: null, prefix: prefixShare(a.prose, b.prose) };
  }
  const changes = [];
  for (let i = 0; i < a.numbers.length; i++) {
    if (a.numbers[i] === b.numbers[i]) continue;
    const from = Number(a.numbers[i]);
    const to = Number(b.numbers[i]);
    changes.push({ at: i, from: a.numbers[i], to: b.numbers[i], delta: to - from, share: share(from, to) });
  }
  if (!changes.length) return { kind: 'same', changes: [], widest: null };
  changes.sort((x, y) => y.share - x.share);
  return { kind: 'numbers', changes, widest: changes[0] };
}

/**
 * Every check that answered differently across the runs of one map.
 *
 * The baseline is the first run of the map and every later run is compared
 * against it, which is what makes this honest on a `--runs 3`: the widest pair
 * is the reading, not the last one. A check missing from a run is not drift -
 * a `--subset` or a map that does not register it is a different question, and
 * `flaky` already owns "answered on one run and not the other".
 */
export function driftOnMap(runsOfOneMap) {
  if (runsOfOneMap.length < 2) return [];
  const byRun = runsOfOneMap.map(r => new Map((r.results || []).map(x => [x.id, x])));
  const [first, ...rest] = byRun;
  const drifted = [];
  for (const [id, base] of first) {
    let worst = null;
    for (const later of rest) {
      const other = later.get(id);
      if (!other) continue;
      const seen = compareDetails(base.detail, other.detail);
      if (seen.kind === 'same') continue;
      if (seen.kind === 'wording') { worst = { ...seen, from: base.detail, to: other.detail }; break; }
      if (!worst || worst.kind === 'numbers' && seen.widest.share > worst.widest.share) {
        worst = { ...seen, from: base.detail, to: other.detail };
      }
    }
    if (worst) drifted.push({ id, ...worst });
  }
  drifted.sort((a, b) => (b.widest ? b.widest.share : 1) - (a.widest ? a.widest.share : 1));
  return drifted;
}

/** The same, per map, in the shape `judge()` reports its other readings in. */
export function driftByMap(runs, maps) {
  return maps.map(map => {
    const drifted = driftOnMap(runs.filter(r => r.map === map));
    return { map, runs: runs.filter(r => r.map === map).length, count: drifted.length, drifted };
  });
}

/** One number moved, said in one phrase. */
export function sayChange(change) {
  const pct = (change.share * 100);
  const amount = pct >= 10 ? pct.toFixed(0) : pct >= 1 ? pct.toFixed(1) : pct.toFixed(2);
  return `${change.from} -> ${change.to} (${amount}%)`;
}

/**
 * One line a drifting check, for the runner's summary.
 *
 * The widest move only: a detail line can carry eight numbers and the point of
 * the summary is which checks to look at, not every digit in them. The whole
 * list is in the report, which is where a reader who wants the rest goes.
 */
export function sayDrift(entry) {
  if (entry.kind === 'wording') {
    const where = entry.prefix >= 0.9
      ? `the wording differs in its last ${(100 - entry.prefix * 100).toFixed(0)}%, which is where the 400-character cut lands`
      : 'the wording differs, so no number is comparable';
    return `${entry.id}: ${where}`;
  }
  const more = entry.changes.length > 1 ? `, and ${entry.changes.length - 1} more` : '';
  return `${entry.id}: ${sayChange(entry.widest)}${more}`;
}
