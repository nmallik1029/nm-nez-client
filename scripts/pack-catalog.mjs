/**
 * Writes the catalogs of packs the client offers to install, and where it
 * downloads them from:
 *
 *   src/main/killstreak-catalog.json   assets/killstreak, the kill streak packs
 *   src/main/soundpack-catalog.json    assets/soundpacks, the other games' sounds
 *
 * The packs live in this repo and nowhere else: not in the installer and not
 * in the no-installer update. The client knows them by name from these files,
 * and fetches one when somebody presses Install on it, straight from the repo
 * on GitHub.
 *
 * AT A COMMIT, NOT A BRANCH. Every client out there was built against these
 * files as they were on the day, and main moves on without them: a pack
 * renamed, re-encoded or dropped would leave those clients asking for a file
 * that is no longer there, or a different one. At the commit that last
 * touched the folder, the files a client expects are there as long as the
 * repo is. Each catalog pins its own folder's commit.
 *
 * Every file's size and SHA-512 go in beside it, so what arrives is checked
 * against what the client was built with before any of it is used.
 *
 * Run it after changing anything in either folder, once that change is
 * committed:
 *
 *   npm run packs:catalog
 *
 * and commit what it writes. It refuses while a folder has uncommitted
 * changes, since the commit it would point at would not have them.
 * Forgetting to run it is loud too: src/main/killstreak-catalog.test.ts and
 * src/main/soundpack-catalog.test.ts fail whenever a catalog and its folder
 * disagree.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** Where the repo is on GitHub. Matches `publish` in electron-builder.yml. */
const REPO = 'nmallik1029/nm-nez-client';

function fail(message) {
  console.error(`pack-catalog: ${message}`);
  process.exit(1);
}

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const sha512 = (data) => createHash('sha512').update(data).digest('base64');
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)}MB`;

function describe(folder, file) {
  const data = readFileSync(join(folder, file));
  return { name: file, size: data.length, sha512: sha512(data) };
}

/**
 * A kill streak pack: only what the client would ever ask for, which is also
 * what it counts, `<id>_<n>.mp3` and `.png` numbered from 1 with no gaps, and
 * its other themes `<id>_v<k>_<n>.png`, numbered from 2 with no gaps and each
 * with every banner the first theme has, and a theme's own sounds
 * `<id>_v<k>_<n>.mp3` where it has them.
 */
function killStreakFiles(id, folder) {
  const tier = new RegExp(`^${id}(?:_v([2-8]))?_([1-9][0-9]?)\\.(mp3|png)$`);
  const files = readdirSync(folder)
    .map((file) => ({ file, match: tier.exec(file) }))
    .filter(({ match }) => match !== null)
    .sort(
      (a, b) =>
        Number(a.match[1] ?? 1) - Number(b.match[1] ?? 1) ||
        Number(a.match[2]) - Number(b.match[2]) ||
        a.match[3].localeCompare(b.match[3]),
    )
    .map(({ file }) => describe(folder, file));
  const parsed = files.map((f) => tier.exec(f.name));
  const numbers = (ext, variant) =>
    parsed.filter((m) => m[3] === ext && Number(m[1] ?? 1) === variant).map((m) => Number(m[2]));
  for (const ext of ['mp3', 'png']) {
    if (numbers(ext, 1).some((n, i) => n !== i + 1)) fail(`${id} skips a number in its .${ext} files`);
  }
  if (!files.some((f) => f.name === `${id}_1.mp3`)) fail(`${id} has no first sound`);
  const banners = numbers('png', 1).length;
  const variants = [...new Set(parsed.map((m) => Number(m[1] ?? 1)))].sort((a, b) => a - b);
  variants.forEach((variant, i) => {
    if (variant !== i + 1) fail(`${id} skips a colour: there is no v${i + 1}`);
    const have = numbers('png', variant);
    if (variant > 1 && (have.length !== banners || have.some((n, j) => n !== j + 1))) {
      fail(`${id} theme v${variant} does not have the same ${banners} banners as its first theme`);
    }
    // A theme's own sounds, if it has any, from 1 with no gaps like the first theme's.
    if (numbers('mp3', variant).some((n, j) => n !== j + 1)) fail(`${id} theme v${variant} skips a sound`);
  });
  return files;
}

/** A soundpack: every sound in it, each named by what it is (`pump-shotgun.ogg`). */
function soundpackFiles(id, folder) {
  const files = readdirSync(folder)
    .filter((file) => /^[a-z0-9-]+\.ogg$/.test(file))
    .sort()
    .map((file) => describe(folder, file));
  if (files.length === 0) fail(`${id} has no sounds`);
  return files;
}

function writeCatalog(dir, out, listFiles) {
  if (git('status', '--porcelain', '--', dir) !== '') {
    fail(`${dir} has uncommitted changes. Commit them first, so the commit this points at has them.`);
  }
  const commit = git('log', '-1', '--format=%H', '--', dir);
  if (!/^[0-9a-f]{40}$/.test(commit)) fail(`no commit has touched ${dir}`);

  // Not fatal: a branch that is merged with a merge commit brings its commits
  // onto main as they are. But a pack commit that never reaches GitHub is one
  // every Install button would 404 on, so say so.
  try {
    git('merge-base', '--is-ancestor', commit, 'origin/main');
  } catch {
    console.warn(`pack-catalog: ${commit.slice(0, 7)} is not on origin/main yet; it has to be pushed before anyone can install from it`);
  }

  const packs = [];
  for (const id of readdirSync(join(ROOT, dir), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()) {
    const folder = join(ROOT, dir, id);
    let name;
    try {
      name = JSON.parse(readFileSync(join(folder, 'pack.json'), 'utf8')).name;
    } catch {
      // Handled below.
    }
    if (typeof name !== 'string' || name.trim() === '') fail(`${id} has no pack.json with a name in it`);
    packs.push({ id, name: name.trim(), files: listFiles(id, folder) });
  }

  // One file to a line, so a changed pack reads as the lines that changed.
  const lines = [
    '{',
    `  "source": ${JSON.stringify(`https://raw.githubusercontent.com/${REPO}/${commit}/${dir}/`)},`,
    '  "packs": [',
  ];
  packs.forEach((pack, i) => {
    lines.push(`    {"id": ${JSON.stringify(pack.id)}, "name": ${JSON.stringify(pack.name)}, "files": [`);
    pack.files.forEach((file, j) => lines.push(`      ${JSON.stringify(file)}${j < pack.files.length - 1 ? ',' : ''}`));
    lines.push(`    ]}${i < packs.length - 1 ? ',' : ''}`);
  });
  lines.push('  ]', '}', '');
  writeFileSync(join(ROOT, out), lines.join('\n'));

  const total = packs.reduce((sum, pack) => sum + pack.files.reduce((s, f) => s + f.size, 0), 0);
  console.log(`pack-catalog: ${out}: ${packs.length} packs, ${mb(total)}, at ${commit.slice(0, 7)}`);
}

writeCatalog('assets/killstreak', 'src/main/killstreak-catalog.json', killStreakFiles);
writeCatalog('assets/soundpacks', 'src/main/soundpack-catalog.json', soundpackFiles);
