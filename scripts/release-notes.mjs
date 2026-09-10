/**
 * Print the newest changelog entry as markdown, for the GitHub release body.
 *
 * The changelog is already written before every tag, so the release notes are
 * generated from it rather than typed a second time. One place to edit, and
 * the notes on the release page can't drift from the ones in the client.
 *
 * Reads the TypeScript source directly rather than importing it, because this
 * runs from a workflow step with no build output to import from. The shape it
 * depends on is small and pinned by a test.
 *
 *   node scripts/release-notes.mjs            # newest entry
 *   node scripts/release-notes.mjs 0.1.2      # a specific version
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'src', 'shared', 'changelog.ts');

/** `{ kind: 'added', text: '...' }` in either the one-line or block form. */
const CHANGE_RE = /kind:\s*'(added|changed|fixed)'\s*,\s*text:\s*(['"`])([\s\S]*?)\2\s*,?\s*\}/g;

/** Split the file on version headers, keeping each entry's body with it. */
function entries(source) {
  const found = [];
  const header = /version:\s*'([^']+)'\s*,\s*date:\s*'([^']+)'/g;
  const marks = [...source.matchAll(header)];

  for (const [i, mark] of marks.entries()) {
    const start = mark.index ?? 0;
    const end = i + 1 < marks.length ? (marks[i + 1].index ?? source.length) : source.length;
    const body = source.slice(start, end);

    const changes = [...body.matchAll(CHANGE_RE)].map((m) => ({
      kind: m[1],
      // The source is TypeScript, so an apostrophe inside a single-quoted
      // string arrives escaped. Nothing else needs unescaping here.
      text: m[3].replace(/\\'/g, "'").replace(/\s+/g, ' ').trim(),
    }));

    found.push({ version: mark[1], date: mark[2], changes });
  }
  return found;
}

/** Grouped under headings, because a flat list of fifteen reads as noise. */
const HEADINGS = { added: 'Added', changed: 'Changed', fixed: 'Fixed' };

function markdown(entry) {
  const lines = [];
  for (const kind of ['added', 'changed', 'fixed']) {
    const group = entry.changes.filter((c) => c.kind === kind);
    if (group.length === 0) continue;
    lines.push(`### ${HEADINGS[kind]}`, '');
    for (const change of group) lines.push(`- ${change.text}`);
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

const wanted = process.argv[2];
const all = entries(readFileSync(SOURCE, 'utf8'));
const entry = wanted ? all.find((e) => e.version === wanted) : all[0];

if (!entry) {
  console.error(`no changelog entry for ${wanted ?? '(newest)'}`);
  process.exit(1);
}
if (entry.changes.length === 0) {
  console.error(`changelog entry ${entry.version} has no changes in it`);
  process.exit(1);
}

process.stdout.write(`${markdown(entry)}\n`);
