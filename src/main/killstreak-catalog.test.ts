import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isPackId, MAX_TIERS } from '../shared/killstreak';
import { KILL_CATALOG } from './killpack-install';

/**
 * The catalog the client installs packs from, held to the folder it was made
 * from.
 *
 * Every Install button trusts this file: it is what a download is checked
 * against, byte for byte. So a pack changed in assets/killstreak without
 * running `npm run packs:catalog` afterwards is not a small drift. It is a
 * pack every client would download, refuse as not matching, and report as
 * failed. This is what makes forgetting fail the build instead.
 */

const ROOT = join(import.meta.dirname, '..', '..');
const PACKS = join(ROOT, 'assets', 'killstreak');

/**
 * The last commit that touched the packs, or null where git cannot say: CI
 * checks out one commit and nothing before it, so there it is always HEAD.
 */
function lastPackCommit(): string | null {
  try {
    const git = (...args: string[]): string =>
      execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
    if (git('rev-parse', '--is-shallow-repository') !== 'false') return null;
    const commit = git('log', '-1', '--format=%H', '--', 'assets/killstreak');
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

describe('the kill streak catalog', () => {
  it('fetches from this repo at a fixed commit, never a branch', () => {
    // A branch moves under clients that are already out there; see
    // scripts/killstreak-catalog.mjs.
    expect(KILL_CATALOG.source).toMatch(
      /^https:\/\/raw\.githubusercontent\.com\/nmallik1029\/nm-nez-client\/[0-9a-f]{40}\/assets\/killstreak\/$/,
    );
  });

  // The bytes matching is not enough on its own. Run the script, then amend
  // or rebase the pack commit, and the catalog names a commit that never
  // reaches GitHub while everything above still passes: every Install in
  // that release would 404. Only checkable with the history, so the full
  // clone preflight runs in, not CI's single commit.
  it.skipIf(packCommit === null)('points at the commit that last changed the packs', () => {
    expect(KILL_CATALOG.source).toContain(`/${packCommit}/`);
  });

  it('has every pack folder in the repo, and nothing that is not one', () => {
    expect(folders.length).toBeGreaterThan(0);
    expect(KILL_CATALOG.packs.map((pack) => pack.id)).toEqual(folders);
  });

  it.each(KILL_CATALOG.packs.map((pack) => [pack.id, pack] as const))(
    '%s matches its folder byte for byte',
    (id, pack) => {
      expect(isPackId(id)).toBe(true);
      const folder = join(PACKS, id);

      const meta = JSON.parse(readFileSync(join(folder, 'pack.json'), 'utf8')) as { name: string };
      expect(pack.name).toBe(meta.name.trim());

      // Every file the client could ask for is listed, and nothing else.
      const tier = new RegExp(`^${id}_([1-9][0-9]?)\\.(mp3|png)$`);
      const onDisk = readdirSync(folder).filter((file) => tier.test(file)).sort();
      expect(pack.files.map((file) => file.name).sort()).toEqual(onDisk);

      for (const file of pack.files) {
        const data = readFileSync(join(folder, file.name));
        expect({ name: file.name, size: file.size, sha512: file.sha512 }).toEqual({
          name: file.name,
          size: data.length,
          sha512: sha512(data),
        });
        expect(Number(tier.exec(file.name)?.[1])).toBeLessThanOrEqual(MAX_TIERS);
      }
      expect(pack.files.some((file) => file.name === `${id}_1.mp3`)).toBe(true);
    },
  );
});
