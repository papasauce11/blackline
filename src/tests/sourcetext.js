/**
 * BLACKLINE - tests/sourcetext.js
 *
 * The two readers a census greps a module's source with, in one place (H53).
 *
 * Fifteen modules under `src/tests/` fetch a file and read it as text, and the
 * ones that grep **source** for a call do it to make their membership
 * checkable rather than a matter of opinion. Every one of those wants *code*
 * and not prose, and H41's rule says so - but until H53 two of them had two
 * different answers to what that means and two had none at all. `breathcensus.js`
 * (`/updateVisual/`) and `timedrenders.js` (`/performance\.now\(\)/`) tested the
 * **raw** text, so a module was in the census the moment its header *mentioned*
 * the identifier, and it cost three jobs in two runs: **H35** was pulled into
 * the clock census by a sentence explaining what its clock measures, **H47**
 * into the breath census by a comment saying that a ragdolled body's
 * `updateVisual` writes nothing - a module that drives no frame at all, and so
 * a false entry in a census whose whole value is that its membership is
 * checkable - and **H52** paid a whole seventy-minute verify to learn that
 * three comments naming the call had enrolled its new module. H47's workaround
 * was to not spell the identifier, which left every future header in
 * `src/tests/` with two words it may not use and nothing to say so.
 *
 * **Two readers, because there are two questions.** Both decide line-locally
 * and never by parsing, which is `donedef.js`'s rule and the reason either is
 * safe to point at a file this suite is still being written in:
 *
 *   `codeOnly` / `codeOf`  comments **and** quoted strings out. The reader for
 *                          a census asking *does this module make this call* -
 *                          the call cannot be in a string, and the identifier
 *                          turns up in error messages all over this suite.
 *   `uncommented`          comments out, strings kept. The reader for a clause
 *                          whose evidence **is** a string - the wording of a
 *                          reported problem, a check's own `id: '...'`, an
 *                          event name, a module path - and a census that greps
 *                          its own explanation is a census about prose.
 *
 * The one thing a reader of either kind cannot do is tell you which it is, so
 * the names are the documentation: a grep written against `codeOf` is a grep
 * about code, and one written against `uncommented` is a grep that wanted the
 * strings and said so. **H62 is the worked example of a census holding clauses
 * on both** - `positioncensus.js` decides its membership and every expression
 * entry off `codeOf` and asks `uncommented` only the four questions whose
 * answer is a string literal - and it is why `readerProblems` takes the reader
 * it is instrumenting rather than assuming the strong one.
 *
 * Imported across `src/tests/` - nineteen modules by H68, which collapsed the
 * last three copies of the weak reader into this one and holds the rule that
 * no other module may spell either (`tests/readernames.js`). A helper rather
 * than a check, so it is not registered
 * in `tests/index.js` and is in no census's membership - `pixels.js`,
 * `assertions.js` and `positionreads.js` are the same shape. Nothing here
 * imports main.js (Section 3.1).
 */

/**
 * One line of code, with its comments and its quoted strings taken out.
 *
 * A line that *is* a comment returns empty; a trailing `//` is cut; a single-,
 * double- or back-quoted span is emptied where it opens and closes on the one
 * line, which is as far as a line-local reader can honestly see. A template
 * literal that opens on one line and closes on another is therefore left
 * alone, and that is the documented edge: it reads as code, which errs toward
 * catching a call rather than toward missing one.
 *
 * **An interpolation is kept.** `${...}` inside a template literal is code -
 * it is the one place in a string where a call really is a call - and dropping
 * it was not a free simplification: `timedrenders.js` holds `menu.js` to
 * reading `record.ms`, and the only place `menu.js` reads it is inside the
 * detail line it builds. H53 measured that before changing anything; a reader
 * that emptied the whole span turned that entry stale and would have been
 * "fixed" by rewriting the clause instead of the reader.
 *
 * **A module path is a string, so this reader cannot see one.** That is not a
 * defect and cannot be repaired here: `from './timedrenders.js'` is a quoted
 * span, and a clause looking for an import is looking at text rather than at
 * code. H53 found it the expensive way - one subset run after a probe said
 * every other clause survived, `timedrenders.js`'s own import clause went red
 * - and the answer is to ask such a clause through `uncommented` and say at
 * the line that it is asking what a module imports and not what it does. The
 * same goes for a parameter inside a URL.
 */
export function codeOnly(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('//')) return '';
  return line
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, (span) => `\`${(span.match(/\$\{[^{}]*\}/g) || []).join('')}\``)
    .replace(/\/\/.*$/, '');
}

/**
 * A whole module's text, read as code: every line through `codeOnly`, joined
 * back so that a pattern anchored to a line start still works. Line numbers
 * survive, which matters only when a problem has to name one.
 */
export function codeOf(text) {
  return text.split(/\r?\n/).map(codeOnly).join('\n');
}

/**
 * A whole module's text with its comment lines taken out and its strings left
 * where they are.
 *
 * The weaker reader, and deliberately so. `positioncensus.js` grepped
 * `enforcer.js` for a copy of the chase law and found it in the comment saying
 * the file used to have one, which is why the comments go; two of its own
 * entries are held against the wording of the problem a module reports
 * (*"the grab lifted the capsule"*, *"it is not presentation only"*), which is
 * why the strings stay. H53 measured both against `codeOf` and both vanish
 * from it, so the two readers are not interchangeable and the difference is
 * not a tidy-up waiting to happen.
 *
 * **It is the right reader for four questions and the wrong one for the rest**
 * (H62). A census asking what a module *does* wants `codeOf`, because an
 * identifier inside a string is not a call - and H62 measured that, on this
 * tree, as a defect with no member: both readers put the same fifteen modules
 * in the position census, so the weak read was wrong in principle and right by
 * luck. The four it is genuinely for are the two prose entries above, a
 * check's own `id: '...'` (which `codeOf` erases, taking all seven of
 * `presentation.js`'s with it) and an event name like `combat:death` (which
 * `codeOf` erases, turning a held proof into a reported problem).
 */
export function uncommented(text) {
  return text.replace(/^[\t ]*(\/\/|\/\*|\*).*$/gm, '');
}

/**
 * A grep's own instrument, on `audiocontext.js`'s MUST_MATCH / MUST_NOT_MATCH
 * model (F8), and here rather than in each census because both of them need
 * the same two questions asked: a census answers "nothing new" both when its
 * greps work and when they have stopped seeing anything, and a **stripped**
 * read can fail by stripping too much as easily as too little - H53 found
 * three real members one strip away from falling out of one census.
 *
 * `classify` is what the census's greps make of a line, as a word or the empty
 * string; `sees` is lines with the word each must come back as; `ignores` is
 * lines that must come back as **nothing**, and there are two kinds of those -
 * prose that names the call, which is H53's subject, and **code that names
 * something which is not it**, which is H61's: a method or a longer word that
 * happens to start with a proxy's name. The problems are returned rather than
 * thrown, so each census reports them the way it reports its own.
 *
 * **`read` is the reader being instrumented, and it is an argument because a
 * census may hold clauses on both of them** (H62). It defaults to `codeOf`,
 * which is what the three callers before H62 wanted and the only reader a
 * membership grep should ever get. The one thing a reader cannot do is say
 * which it is, so the problems name it: `read.name` is the whole difference
 * between "this line is prose and the strong reader drops it", which is the
 * point, and "this line is prose and the weak reader drops it", which is a
 * broken clause. The same line is usually a `sees` for one reader and an
 * `ignores` for the other, and a census that asks both ways has proved its two
 * readers are not interchangeable rather than assumed it.
 */
export function readerProblems(classify, sees, ignores, read = codeOf) {
  const problems = [];
  for (const [line, want] of sees) {
    const got = classify(read(line));
    if (got !== want) {
      problems.push(`${read.name} read "${line.trim()}" as ${got || 'nothing'} and not ${want}; this census reads whatever it reads whether its criteria work or not`);
    }
  }
  for (const line of ignores) {
    const got = classify(read(line));
    if (got) {
      problems.push(`${read.name} read "${line.trim()}" as ${got} and nothing is the only right answer, so a module is in this census for naming the call rather than for making it (H53's whole subject, H61's for a name that is not the call, and H62's for a call named inside a string)`);
    }
  }
  return problems;
}
