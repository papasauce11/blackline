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
 *                          whose evidence **is** a string: `positioncensus.js`
 *                          holds three entries against the wording of the
 *                          problem a module reports, and a census that greps
 *                          its own explanation is a census about prose.
 *
 * The one thing a reader of either kind cannot do is tell you which it is, so
 * the names are the documentation: a grep written against `codeOf` is a grep
 * about code, and one written against `uncommented` is a grep that wanted the
 * strings and said so.
 *
 * Imported by `audiocontext.js`, `breathcensus.js`, `timedrenders.js` and
 * `positioncensus.js`. A helper rather than a check, so it is not registered
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
 * the file used to have one, which is why the comments go; three of its own
 * entries are held against the wording of the problem a module reports
 * (*"the grab lifted the capsule"*, *"it is not presentation only"*), which is
 * why the strings stay. H53 measured both against `codeOf` and both vanish
 * from it, so the two readers are not interchangeable and the difference is
 * not a tidy-up waiting to happen.
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
 * `classify` is what the census's greps make of a module's code, as a word or
 * the empty string; `sees` is lines of real code with the word each must come
 * back as; `ignores` is lines of real prose that must come back as nothing.
 * The problems are returned rather than thrown, so each census reports them
 * the way it reports its own.
 */
export function readerProblems(classify, sees, ignores) {
  const problems = [];
  for (const [line, want] of sees) {
    const got = classify(codeOf(line));
    if (got !== want) {
      problems.push(`the criteria read "${line.trim()}" as ${got || 'nothing'} and not ${want}; this census reads whatever it reads whether they work or not`);
    }
  }
  for (const line of ignores) {
    const got = classify(codeOf(line));
    if (got) {
      problems.push(`the criteria take the comment "${line.trim()}" for ${got}, so a module that only mentions the call is in this census (H53's whole subject)`);
    }
  }
  return problems;
}
