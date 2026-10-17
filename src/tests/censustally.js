/**
 * BLACKLINE - tests/censustally.js
 *
 * The arithmetic a census's own detail line rests on (H60).
 *
 * Several modules under `src/tests/` end a run by printing a total and the
 * classes it breaks into - *"15 pose a body: 2 held at the worst phase, 4
 * measured, 6 out of reach by proof"* - and a reader of such a line does one
 * subtraction with it. There are two ways that goes wrong and this project has
 * now met both.
 *
 * **H50 found the first**, in `timedrenders.js`: one of four verdicts was
 * counted over a narrower set than the other three, so a clause could have
 * been counted nowhere and the line would have under-reported the census by
 * one with nothing red. The fix was a tally that must add up.
 *
 * **H60 found the second**, in `breathcensus.js`: the total counted every
 * module the tree was **found** to pose a body in and the three classes
 * counted the ones its table **declares** - fifteen against a tally of twelve,
 * every run, green. Nothing was wrong; the three census modules are excluded
 * by name three lines above. The line still invited the subtraction and got it
 * wrong, which is H50's finding in a sibling: there a verdict was counted in
 * one group of two, here a total was counted over a different set from its
 * parts.
 *
 * So the two halves live here, each a function a census calls once where it
 * builds its line:
 *
 *   countByWord  every entry carries one of the words this census counts, and
 *                the counts of those words are the census's own length
 *   addsUp       the parts a line prints add up to the total beside them,
 *                whoever counted them and however they were counted
 *
 * Neither decides a census's **membership**. That is the thing worth being
 * careful about, it is different in every census, and it belongs with the one
 * that owns it - `posecriterion.js` is the worked example of how much argument
 * a membership rule can need. What these two hold is the part a reader cannot
 * check by reading: that a fourth class or a fourth exclusion cannot appear
 * without the sum saying so.
 *
 * Imported by the census modules; imports nothing (Section 3.1).
 */

/**
 * The three words `breathcensus.js` and `positioncensus.js` classify a
 * module's reach with. Declared once because both censuses count the same
 * three and a fourth word in either is a class counted nowhere.
 */
export const REACHES = ['held', 'measured', 'none'];

/**
 * Count `entries` by the word each declares at `key` and hold both halves of
 * the arithmetic: a word this census does not count is a problem naming the
 * entry, and the words it does count must come to the census's own length.
 *
 * `what` opens every problem, because a line read in a report has to name the
 * census it came from.
 */
export function countByWord(what, entries, words, key = 'reach') {
  const counts = {};
  for (const word of words) counts[word] = 0;
  const problems = [];
  for (const entry of entries) {
    const word = entry[key];
    if (word in counts) counts[word] += 1;
    else problems.push(`${what}: ${entry.module || entry.check || 'an entry'} is declared "${word}", which is not one of the ${words.length} this census counts (${words.join(', ')})`);
  }
  return { counts, problems: [...problems, ...addsUp(what, entries.length, counts)] };
}

/**
 * The parts a detail line prints must add up to the total it prints beside
 * them. `parts` is labelled rather than a list of numbers because the problem
 * has to say which class fell short, and the label to use is the one the line
 * itself uses - a reader comparing the two should not have to guess which
 * number is which.
 */
export function addsUp(what, total, parts) {
  const names = Object.keys(parts);
  const summed = names.reduce((sum, name) => sum + parts[name], 0);
  if (summed === total) return [];
  return [`${what}: the line counts ${summed} of ${total} - ${names.map((name) => `${parts[name]} ${name}`).join(', ')} - so a class is counted over a narrower set than the total printed beside it, which under-reports the census and nothing else would say so (H50, H60)`];
}
