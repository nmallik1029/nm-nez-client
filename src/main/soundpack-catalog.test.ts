import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isPackId } from '../shared/killstreak';
import { FORTNITE_PACK_ID, FORTNITE_SOUNDS } from '../shared/soundpacks';
import { SOUNDPACK_CATALOG } from './soundpacks';

/**
 * The soundpack catalog held to the folder it was made from, as
 * killstreak-catalog.test.ts holds the kill streak one: a sound changed in
 * assets/soundpacks without `npm run packs:catalog` afterwards is a pack
 * every client downloads, refuses as not matching, and reports as failed.
 *
 * And held to the picks as well. A sound the editor offers that the pack
 * does not have is a pick that silently plays Krunker's own; one the pack
 * has that nothing offers is a download nobody hears.
 */

const ROOT = join(import.meta.dirname, '..', '..');
const PACKS = join(ROOT, 'assets', 'soundpacks');

/** As in killstreak-catalog.test.ts: null where git cannot say, which is CI. */
function lastPackCommit(): string | null {
  try {
    const git = (...args: string[]): string =>
      execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
    if (git('rev-parse', '--is-shallow-repository') !== 'false') return null;
    const commit = git('log', '-1', '--format=%H', '--', 'assets/soundpacks');
    return /^[0-9a-f]{40}$/.test(commit) ? commit : null;
  } catch {
    return null;
  }
}
const packCommit = lastPackCommit();

const sha512 = (data: Buffer): string => createHash('sha512').update(data).digest('base64');

const folders = readdirSync(PACKS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

describe('the soundpack catalog', () => {
  it('fetches from this repo at a fixed commit, never a branch', () => {
    expect(SOUNDPACK_CATALOG.source).toMatch(
      /^https:\/\/raw\.githubusercontent\.com\/nmallik1029\/nm-nez-client\/[0-9a-f]{40}\/assets\/soundpacks\/$/,
    );
  });

  it.skipIf(packCommit === null)('points at the commit that last changed the packs', () => {
    expect(SOUNDPACK_CATALOG.source).toContain(`/${packCommit}/`);
  });

  it('has every pack folder in the repo, and nothing that is not one', () => {
    expect(folders.length).toBeGreaterThan(0);
    expect(SOUNDPACK_CATALOG.packs.map((pack) => pack.id)).toEqual(folders);
  });

  it.each(SOUNDPACK_CATALOG.packs.map((pack) => [pack.id, pack] as const))(
    '%s matches its folder byte for byte',
    (id, pack) => {
      expect(isPackId(id)).toBe(true);
      const folder = join(PACKS, id);

      const meta = JSON.parse(readFileSync(join(folder, 'pack.json'), 'utf8')) as { name: string };
      expect(pack.name).toBe(meta.name.trim());

      const onDisk = readdirSync(folder).filter((file) => /^[a-z0-9-]+\.ogg$/.test(file)).sort();
      expect(pack.files.map((file) => file.name).sort()).toEqual(onDisk);

      for (const file of pack.files) {
        const data = readFileSync(join(folder, file.name));
        expect({ name: file.name, size: file.size, sha512: file.sha512 }).toEqual({
          name: file.name,
          size: data.length,
          sha512: sha512(data),
        });
      }
    },
  );

  it('has exactly the Fortnite sounds the editor offers', () => {
    const fortnite = SOUNDPACK_CATALOG.packs.find((pack) => pack.id === FORTNITE_PACK_ID);
    expect(fortnite?.files.map((file) => file.name.replace(/\.ogg$/, '')).sort()).toEqual(
      Object.keys(FORTNITE_SOUNDS).sort(),
    );
  });
});
