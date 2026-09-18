/**
 * Writes src/main/killstreak-catalog.json: the kill streak packs the client
 * offers to install, and where it downloads them from.
 *
 * The packs live in this repo, in assets/killstreak, and nowhere else: not in
 * the installer and not in the no-installer update. The client knows them by
 * name from this file, and fetches one when somebody presses Install on it,
 * straight from the repo on GitHub.
 *
 * AT A COMMIT, NOT A BRANCH. Every client out there was built against this
 * file as it was on the day, and main moves on without it: a pack renamed,
 * re-encoded or dropped would leave those clients asking for a file that is
 * no longer there, or a different one. At the commit that last touched the
 * folder, the files a client expects are there as long as the repo is.
 *
 * Every file's size and SHA-512 go in beside it, so what arrives is checked
 * against what the client was built with before any of it is used.
 *
 * Run it after changing anything in assets/killstreak, once that change is
 * committed:
 *
 *   npm run packs:catalog
 *
 * and commit what it writes. It refuses while the folder has uncommitted
 * changes, since the commit it would point at would not have them. Forgetting
 * to run it is loud too: src/main/killstreak-catalog.test.ts fails whenever
 * this file and the folder disagree.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKS = 'assets/killstreak';
const OUT = join(ROOT, 'src', 'main', 'killstreak-catalog.json');
/** Where the repo is on GitHub. Matches `publish` in electron-builder.yml. */
const REPO = 'nmallik1029/nm-nez-client';

function fail(message) {
  console.error(`killstreak-catalog: ${message}`);
  process.exit(1);
}

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const sha512 = (data) => createHash('sha512').update(data).digest('base64');

if (git('status', '--porcelain', '--', PACKS) !== '') {
  fail(`${PACKS} has uncommitted changes. Commit them first, so the commit this points at has them.`);
}
const commit = git('log', '-1', '--format=%H', '--', PACKS);
if (!/^[0-9a-f]{40}$/.test(commit)) fail(`no commit has touched ${PACKS}`);

// Not fatal: a branch that is merged with a merge commit brings its commits
// onto main as they are. But a pack commit that never reaches GitHub is one
// every Install button would 404 on, so say so.
try {
  git('merge-base', '--is-ancestor', commit, 'origin/main');
} catch {
  console.warn(`killstreak-catalog: ${commit.slice(0, 7)} is not on origin/main yet; it has to be pushed before anyone can install from it`);
}

const packs = [];
for (const id of readdirSync(join(ROOT, PACKS), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()) {
  const folder = join(ROOT, PACKS, id);

  let name;
  try {
    name = JSON.parse(readFileSync(join(folder, 'pack.json'), 'utf8')).name;
  } catch {
    // Handled below.
  }
  if (typeof name !== 'string' || name.trim() === '') fail(`${id} has no pack.json with a name in it`);

  // Only what the client would ever ask for, which is also what it counts:
  // <id>_<n>.mp3 and .png, numbered from 1 with no gaps.
  const tier = new RegExp(`^${id}_([1-9][0-9]?)\\.(mp3|png)$`);
  const files = readdirSync(folder)
    .map((file) => ({ file, match: tier.exec(file) }))
    .filter(({ match }) => match !== null)
    .sort((a, b) => Number(a.match[1]) - Number(b.match[1]) || a.match[2].localeCompare(b.match[2]))
    .map(({ file }) => {
      const data = readFileSync(join(folder, file));
      return { name: file, size: data.length, sha512: sha512(data) };
    });

  for (const ext of ['mp3', 'png']) {
    const numbers = files.filter((f) => f.name.endsWith(`.${ext}`)).map((f) => Number(tier.exec(f.name)[1]));
    if (numbers.some((n, i) => n !== i + 1)) fail(`${id} skips a number in its .${ext} files`);
  }
  if (!files.some((f) => f.name === `${id}_1.mp3`)) fail(`${id} has no first sound`);

  packs.push({ id, name: name.trim(), files });
}

// One file to a line, so a changed pack reads as the lines that changed.
const lines = [
  '{',
  `  "source": ${JSON.stringify(`https://raw.githubusercontent.com/${REPO}/${commit}/${PACKS}/`)},`,
  '  "packs": [',
];
packs.forEach((pack, i) => {
  lines.push(`    {"id": ${JSON.stringify(pack.id)}, "name": ${JSON.stringify(pack.name)}, "files": [`);
  pack.files.forEach((file, j) => lines.push(`      ${JSON.stringify(file)}${j < pack.files.length - 1 ? ',' : ''}`));
  lines.push(`    ]}${i < packs.length - 1 ? ',' : ''}`);
});
lines.push('  ]', '}', '');
writeFileSync(OUT, lines.join('\n'));

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)}MB`;
const total = packs.reduce((sum, pack) => sum + pack.files.reduce((s, f) => s + f.size, 0), 0);
console.log(`killstreak-catalog: ${packs.length} packs, ${mb(total)}, at ${commit.slice(0, 7)}`);
