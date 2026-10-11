// BLACKLINE - scripts/args.mjs
//
// The command line, read the same way by every runner (H58), and the one
// module in scripts/ with no node builtin in it - so the AUTO suite can
// import it and test the behaviour rather than grep for its shape.
//
// It exists because `npm run shot -- --pose mantle --pose pullup` wrote only
// the pull-up, on both maps, and printed "1 poses" while doing it. The parser
// assigned `out[key] = next` for every option, so a flag given twice kept the
// last one and the earlier value was gone before `listArg` ever saw it. A
// session asking for three poses got one and a line of output that agreed
// with itself; H52 lost two runs to it and worked around it by running three
// times. The interesting half, which is why this is a module and not a
// one-line fix: **nothing said so**. A runner that drops an argument it was
// given is the same class of defect as a gate that warns and builds anyway
// (H45), and the answer is the same - collect it, or refuse.
//
// So there are exactly two ways to read a flag here and a runner must pick
// one at the line:
//
//   listArg(value)        a flag that may be given more than once, or as one
//                         comma-separated value, or both. Returns the names
//                         or null.
//   scalarArg(args, key)  a flag that takes one value and **refuses** a
//                         second rather than keeping either one silently.
//
// `scripts/suite.mjs` carried its own copy of the parser and now imports this
// one, which is the duplicate that mattered: headless.mjs's header asks for
// the two to be kept in step, and a parser is the part where "in step" is not
// something a reader can see.

/**
 * `--key value` pairs and bare `--flag`s into an object; anything that is not
 * an option is a positional, under `_`.
 *
 * **A flag given twice collects into an array.** That is the whole repair:
 * what a caller typed is what the runner has, and deciding whether two values
 * are allowed belongs to the flag's own reader below rather than to the
 * parser, which cannot know.
 */
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const key = a.slice(2);
    const next = argv[i + 1];
    let value = true;
    if (next !== undefined && !next.startsWith('--')) { value = next; i++; }
    if (key === '_') continue; // `--_` is not a flag any runner reads
    out[key] = Object.hasOwn(out, key) ? [].concat(out[key], value) : value;
  }
  return out;
}

/**
 * A repeatable option as a list of trimmed names, or null if absent.
 *
 * Takes the three shapes a caller can produce: one value, one
 * comma-separated value, and the same flag more than once (which used to be
 * the shape that lost). A bare `--pose` with no value returns null rather
 * than the string "true", which is what it used to do - `String(true)` is a
 * pose name nothing will ever match, and a runner that photographs nothing
 * should say the flag was empty rather than that the pose was missing.
 */
export function listArg(value) {
  if (value === undefined || value === null || value === true) return null;
  const names = []
    .concat(value)
    // A bare occurrence is `true` and carries no name, whether it is the
    // whole value or one of several - `--pose --pose mantle` is one pose.
    .filter((one) => one !== true && one !== null && one !== undefined)
    .flatMap((one) => String(one).split(','))
    .map((one) => one.trim())
    .filter(Boolean);
  return names.length ? names : null;
}

/**
 * A scalar option's one value - and a refusal if it was given twice.
 *
 * Throws rather than returning a problem, because every runner reads its
 * flags at module top level before it has anything to report with, and a
 * usage error that reaches the user as a thrown message naming the flag is
 * better than one that reaches them as a photograph of the wrong pose. Each
 * runner catches it and exits 2: a bad command line is this runner failing to
 * run, not a red check (1) and not the H45 refusal to measure (3).
 */
export function scalarArg(args, key) {
  const value = args[key];
  if (Array.isArray(value)) {
    throw new Error(
      `--${key} was given ${value.length} times (${value.join(', ')}) and takes one value.`
      + ` Pass it once, or use a comma-separated value if this flag takes a list.`,
    );
  }
  return value;
}

/**
 * The cases, here rather than in the check that runs them, so that the
 * behaviour and its examples cannot drift apart - and so the table reads as
 * documentation of what each shape does. `tests/args.js` runs every one of
 * them in the page, which is why this module has no node builtin in it.
 *
 * `want` is compared field by field against `parseArgs(argv)`; `list` is what
 * `listArg` makes of the named key; `refuses` is the key `scalarArg` must
 * refuse.
 */
export const ARG_CASES = [
  {
    why: 'the H58 case: a flag given twice keeps both values',
    argv: ['--pose', 'mantle', '--pose', 'pullup'],
    want: { pose: ['mantle', 'pullup'] },
    list: ['pose', ['mantle', 'pullup']],
    refuses: 'pose',
  },
  {
    why: 'three times is three, not the last one',
    argv: ['--pose', 'walk', '--pose', 'sprint', '--pose', 'hang'],
    want: { pose: ['walk', 'sprint', 'hang'] },
    list: ['pose', ['walk', 'sprint', 'hang']],
    refuses: 'pose',
  },
  {
    why: 'one value is still one value and not a list of one',
    argv: ['--pose', 'mantle'],
    want: { pose: 'mantle' },
    list: ['pose', ['mantle']],
    refuses: null,
  },
  {
    why: 'a comma-separated value, which is how this was always meant to be written',
    argv: ['--map', 'plant,yard'],
    want: { map: 'plant,yard' },
    list: ['map', ['plant', 'yard']],
    refuses: null,
  },
  {
    why: 'both shapes at once, flattened and in the order given',
    argv: ['--map', 'plant,yard', '--map', 'roof'],
    want: { map: ['plant,yard', 'roof'] },
    list: ['map', ['plant', 'yard', 'roof']],
    refuses: 'map',
  },
  {
    why: 'a bare flag is true, and listArg makes nothing of it rather than "true"',
    argv: ['--slide'],
    want: { slide: true },
    list: ['slide', null],
    refuses: null,
  },
  {
    why: 'a bare flag before another flag does not eat it',
    argv: ['--slide', '--map', 'plant'],
    want: { slide: true, map: 'plant' },
    list: ['map', ['plant']],
    refuses: null,
  },
  {
    why: 'an absent flag is absent, not empty',
    argv: [],
    want: {},
    list: ['pose', null],
    refuses: null,
  },
  {
    why: 'positionals are still positionals, which is how probe.mjs takes a file',
    argv: ['probe.js', '--map', 'plant'],
    want: { _: ['probe.js'], map: 'plant' },
    list: ['map', ['plant']],
    refuses: null,
  },
  {
    why: 'a repeated bare flag collects too, so a scalar reader can refuse it',
    argv: ['--regression', '--regression'],
    want: { regression: [true, true] },
    list: ['regression', null],
    refuses: 'regression',
  },
];
