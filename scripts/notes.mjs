#!/usr/bin/env node
/**
 * BLACKLINE - scripts/notes.mjs
 *
 * `npm run notes` (H16): release notes from `PROGRESS.md`, into `RELEASES.md`.
 *
 * A release is the span between two tags - Josh tags when he merges - and its
 * notes are the `PROGRESS.md` entries that span added: the `## ` headings in
 * the file at the later end that were not in it at the earlier, each with the
 * first sentence under it. The top section is everything since the last tag,
 * which is what the next merge ships.
 *
 * **The file is rebuilt whole from git on every run**, so it says nothing the
 * history does not and is never edited by hand. Both ends are read from
 * commits (`git show <ref>:PROGRESS.md`), never from the working tree, so a
 * half-written entry is not a release note until it is committed.
 *
 * Reads no flags. Node built-ins only, like every runner here.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'RELEASES.md');
const SOURCE = 'PROGRESS.md';
/** A note is one sentence; a sentence longer than this is cut at a word. */
const SENTENCE_CHARS = 300;
/** A phase entry's first line, which says the entry is finished and nothing else. */
const STATUS = /^\*\*Status:\*\*/;

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 << 20 }).replace(/\s+$/, '');
}

/** `PROGRESS.md` as it was at a commit, or empty where it did not exist yet. */
function progressAt(ref) {
  try {
    return git('show', `${ref}:${SOURCE}`);
  } catch {
    return '';
  }
}

/** The first sentence of a paragraph, cut at a word if it runs long. */
export function firstSentence(paragraph) {
  // A paragraph that is a list reads as its first item.
  const flat = paragraph.replace(/\s+/g, ' ').trim().replace(/^[-*] /, '');
  const m = /^(.+?[.!?])(?=\s+[A-Z*`(]|\s*$)/.exec(flat);
  const sentence = m ? m[1] : flat;
  if (sentence.length <= SENTENCE_CHARS) return sentence;
  const cut = sentence.slice(0, SENTENCE_CHARS);
  return `${cut.slice(0, cut.lastIndexOf(' '))} ...`;
}

/** Every entry of a `PROGRESS.md`: its `## ` heading and its first sentence. */
export function entries(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^## (.+)$/.exec(lines[i]);
    if (!m) continue;
    // The first paragraph that says something, inside this entry: a phase
    // entry opens with a `**Status:** complete.` line and a `### ` heading,
    // which are facts about the entry and not a note.
    let j = i + 1;
    let paragraph = [];
    while (j < lines.length && !/^## /.test(lines[j])) {
      while (j < lines.length && (!lines[j].trim() || /^###/.test(lines[j]))) j++;
      paragraph = [];
      while (j < lines.length && lines[j].trim() && !/^#/.test(lines[j])) paragraph.push(lines[j++]);
      if (!STATUS.test(paragraph.join(' ').trim())) break;
    }
    out.push({ heading: m[1].trim(), sentence: firstSentence(paragraph.join(' ')) });
  }
  return out;
}

/** The entries `later` has that `earlier` did not, in `later`'s order. */
export function added(earlier, later) {
  const had = new Set(entries(earlier).map((e) => e.heading));
  return entries(later).filter((e) => !had.has(e.heading));
}

/** One ref, as a section's line names it. */
function describe(ref) {
  const [hash, date] = git('log', '-1', '--format=%h %cs', ref).split(' ');
  return { hash, date };
}

function section(title, from, to, notes) {
  const out = [`## ${title}`, ''];
  const span = from ? `From \`${from.hash}\` (${from.date}) to` : 'Up to';
  out.push(`${span} \`${to.hash}\` (${to.date}): ${notes.length} ${notes.length === 1 ? 'entry' : 'entries'}.`, '');
  for (const note of notes) out.push(`- **${note.heading}.** ${note.sentence}`.replace(/\.\.\*\*/, '.**'));
  if (!notes.length) out.push('- Nothing new in PROGRESS.md.');
  out.push('');
  return out;
}

function build() {
  const tags = git('tag', '--sort=creatordate', '--merged', 'HEAD').split('\n').filter(Boolean);
  const sections = [];
  let earlier = '';
  let from = null;
  for (const tag of tags) {
    const later = progressAt(tag);
    const to = describe(tag);
    sections.push({ title: `${tag} - ${to.date}`, lines: section(`${tag} - ${to.date}`, from, to, added(earlier, later)) });
    earlier = later;
    from = to;
  }
  const head = describe('HEAD');
  const since = tags.length ? `since ${tags[tags.length - 1]}` : 'since the first commit';
  const unreleased = section(`Unreleased - ${since}`, from, head, added(earlier, progressAt('HEAD')));
  const out = [
    '# Blackline - release notes',
    '',
    'Built by `npm run notes` (`scripts/notes.mjs`) from `PROGRESS.md` and the tags. A',
    'release is the span between two tags, and its notes are the `PROGRESS.md`',
    'entries that span added, each with its first sentence. The file is rebuilt',
    'whole on every run, so do not edit it by hand: change `PROGRESS.md`, or tag.',
    '',
    ...unreleased,
    ...sections.reverse().flatMap((s) => s.lines),
  ];
  return { text: `${out.join('\n').replace(/\n+$/, '')}\n`, tags: tags.length, unreleased: unreleased.filter((l) => l.startsWith('- **')).length };
}

const { text, tags, unreleased } = build();
writeFileSync(OUT, text);
console.log(`notes: RELEASES.md written - ${unreleased} unreleased ${unreleased === 1 ? 'entry' : 'entries'}, ${tags} tagged release${tags === 1 ? '' : 's'}, ${text.split('\n').length} lines`);
