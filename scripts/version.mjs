// The build stamp. `npm run stamp`, and once at the top of `npm run suite`.
//
// Writes `version.json` at the repo root — the commit this checkout is on, the
// date of that commit, and the branch — so the page can say which build it is
// (H3). `src/version.js` fetches it and the main menu's footer shows it; H12's
// bug report reads the same object.
//
// H3 asked for the deploy workflow to write this file. There is no workflow:
// the CLI token cannot push one (H2), so Pages is a **branch deploy** of
// `phases-14-45` and the only thing that reaches the deployed root is a
// commit. So the commit carries the stamp, exactly the way QUEUE.md carries a
// job's own hash: the `Record <job>` commit that writes the hash also runs
// `npm run stamp`, and by then the job's commit is HEAD.
//
// **It refuses to write while the working tree is dirty**, which is what makes
// it safe to call from `scripts/suite.mjs`. A gate run must not dirty the tree
// it is judging, and a stamp taken in the middle of a job would name the
// commit *before* the work and call it the build. So version.json is always a
// real commit of this branch, never a guess — and the page decides "dev" for
// itself, from the host it was served by, rather than from a channel field
// somebody has to remember to flip.
//
//   node scripts/version.mjs [root]
//
// The root defaults to this file's parent, which is the repo. A patch script
// in TRAPS.md must take its root as an argument and refuse without one; this
// is not one of those — it is committed, it writes exactly one known file, and
// resolving the root from `import.meta.url` is what every other script here
// does (suite.mjs, shot.mjs, probe.mjs).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The file this writes, relative to the root, and the name the page fetches. */
export const VERSION_FILE = 'version.json';

function git(root, argv) {
  return execFileSync('git', argv, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/**
 * What git says this checkout is, or null where there is no git to ask (a
 * downloaded zip, a copy without `.git`). Never throws: a missing stamp is a
 * footer that says so, not a boot failure.
 *
 * @param {string} root
 * @returns {{commit:string, short:string, date:string, branch:string}|null}
 */
export function readGitVersion(root = HERE) {
  try {
    const commit = git(root, ['rev-parse', 'HEAD']);
    if (!/^[0-9a-f]{40}$/.test(commit)) return null;
    return {
      commit,
      short: commit.slice(0, 7),
      // The committer date, not the author date: it is when this commit came
      // into being on this branch, which is what a build date means here.
      date: git(root, ['log', '-1', '--format=%cI']),
      branch: git(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
    };
  } catch {
    return null;
  }
}

/** Whether git has anything uncommitted — tracked or not. */
function treeIsDirty(root) {
  try {
    return git(root, ['status', '--porcelain']).length > 0;
  } catch {
    // No git, no claim either way. `readGitVersion` will have returned null
    // too, so nothing is written.
    return true;
  }
}

/**
 * Stamp `version.json`, or say why not. Idempotent: the same HEAD produces the
 * same bytes, so calling this at the top of every gate run leaves a clean tree
 * clean.
 *
 * @param {string} [root]
 * @returns {{written:boolean, reason:string, version:object|null}}
 */
export function stampVersion(root = HERE) {
  const version = readGitVersion(root);
  if (!version) return { written: false, reason: 'no git in this checkout', version: null };
  if (treeIsDirty(root)) {
    return { written: false, reason: 'the working tree is dirty', version: null };
  }
  const file = path.join(root, VERSION_FILE);
  const text = `${JSON.stringify(version, null, 2)}\n`;
  let was = null;
  try {
    was = fs.readFileSync(file, 'utf8');
  } catch { /* not written yet */ }
  if (was === text) return { written: false, reason: 'already current', version };
  fs.writeFileSync(file, text, 'utf8');
  return { written: true, reason: 'stamped', version };
}

// CLI. One line, so a routine's log says what happened.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : HERE;
  const result = stampVersion(root);
  const where = `${VERSION_FILE}`;
  if (result.version) {
    process.stdout.write(`${where}: ${result.reason} - ${result.version.short} on ${result.version.branch}`
      + ` (${result.version.date})\n`);
  } else {
    process.stdout.write(`${where}: left alone - ${result.reason}\n`);
  }
}
