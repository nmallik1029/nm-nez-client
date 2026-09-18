import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { packFileUrl } from '../shared/killstreak';
import { loadKillPacks, resolveKillPackFile } from './killsounds';

/**
 * The folder listing the kill streak editor is built from, and the lookup
 * that serves what the page then asks for.
 *
 * What matters is that it only ever lists something the page can actually
 * play from start to finish: a gap in the numbering, a folder name that is
 * not a safe URL segment, or a folder of banners with no sounds would each
 * be a pack that looks fine in the list and fails mid-streak. And with two
 * folders, that the list and the files served agree on which copy of a pack
 * is the one in use.
 */

let root: string;
/** The user's folder. */
let dir: string;
/** The packs the client ships. */
let shipped: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'killsounds-'));
  dir = join(root, 'user');
  shipped = join(root, 'shipped');
  mkdirSync(dir);
  mkdirSync(shipped);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function pack(
  id: string,
  sounds: number[],
  banners: number[] = [],
  meta?: unknown,
  into: string = dir,
): void {
  const folder = join(into, id);
  mkdirSync(folder, { recursive: true });
  for (const n of sounds) writeFileSync(join(folder, `${id}_${n}.mp3`), 'x');
  for (const n of banners) writeFileSync(join(folder, `${id}_${n}.png`), 'x');
  if (meta !== undefined) writeFileSync(join(folder, 'pack.json'), JSON.stringify(meta));
}

describe('loadKillPacks', () => {
  it('lists nothing when the folder does not exist yet', () => {
    expect(loadKillPacks([join(dir, 'missing')])).toEqual([]);
  });

  it('counts sounds and banners separately', () => {
    pack('vct-2025', [1, 2, 3, 4, 5, 6], [1, 2, 3]);
    expect(loadKillPacks([dir])).toEqual([{ id: 'vct-2025', name: 'Vct 2025', sounds: 6, banners: 3 }]);
  });

  it('stops at the first gap rather than skipping it', () => {
    // A request for tier 3 would 404 mid-streak, so the pack is two sounds long.
    pack('gappy', [1, 2, 4, 5]);
    expect(loadKillPacks([dir])[0]?.sounds).toBe(2);
  });

  it('leaves out a folder with no first sound', () => {
    pack('pictures', [], [1, 2, 3]);
    pack('late-start', [2, 3]);
    expect(loadKillPacks([dir])).toEqual([]);
  });

  it('lists a sound-only pack with no banners', () => {
    pack('mystbloom', [1, 2, 3, 4, 5]);
    expect(loadKillPacks([dir])[0]).toMatchObject({ sounds: 5, banners: 0 });
  });

  it('takes the name from pack.json when there is a usable one', () => {
    pack('gaia-s-vengeance', [1], [], { name: "Gaia's Vengeance" });
    pack('blank-name', [1], [], { name: '   ' });
    pack('bad-json', [1]);
    writeFileSync(join(dir, 'bad-json', 'pack.json'), '{not json');
    const names = loadKillPacks([dir]).map((p) => p.name);
    expect(names).toEqual(['Bad Json', 'Blank Name', "Gaia's Vengeance"]);
  });

  it('skips folders whose name is not a safe pack id, and stray files', () => {
    pack('Upper Case', [1]);
    pack('has.dot', [1]);
    writeFileSync(join(dir, 'loose_1.mp3'), 'x');
    pack('ok', [1]);
    expect(loadKillPacks([dir]).map((p) => p.id)).toEqual(['ok']);
  });

  it('sorts by the name people see, not the folder', () => {
    pack('zzz', [1], [], { name: 'Alpha' });
    pack('aaa', [1], [], { name: 'Zulu' });
    expect(loadKillPacks([dir]).map((p) => p.name)).toEqual(['Alpha', 'Zulu']);
  });

  it('lists the shipped packs alongside the user\'s own, sorted together', () => {
    pack('reaver', [1, 2], [1], { name: 'Reaver' }, shipped);
    pack('mine', [1], [], { name: 'Mine' });
    expect(loadKillPacks([dir, shipped]).map((p) => p.id)).toEqual(['mine', 'reaver']);
  });

  it('lets a user pack replace a shipped one of the same id, whole', () => {
    // Theirs has fewer sounds and no banners. Merging would ask for tiers
    // theirs does not have and show pictures from a pack they replaced.
    pack('prime', [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6], { name: 'Prime' }, shipped);
    pack('prime', [1, 2], [], { name: 'My Prime' });
    expect(loadKillPacks([dir, shipped])).toEqual([
      { id: 'prime', name: 'My Prime', sounds: 2, banners: 0 },
    ]);
  });

  it('keeps the shipped pack when the user folder of that name is not a pack', () => {
    pack('prime', [1, 2, 3], [1], { name: 'Prime' }, shipped);
    pack('prime', [], [1, 2]);
    expect(loadKillPacks([dir, shipped])).toEqual([
      { id: 'prime', name: 'Prime', sounds: 3, banners: 1 },
    ]);
  });

  it('lists the shipped packs when the user has no folder at all', () => {
    pack('ion', [1], [], undefined, shipped);
    expect(loadKillPacks([join(root, 'nobody'), shipped]).map((p) => p.id)).toEqual(['ion']);
  });
});

describe('resolveKillPackFile', () => {
  const url = (id: string, tier: number, kind: 'sound' | 'banner'): string =>
    packFileUrl(id, tier, kind);

  it('finds a shipped pack file from the URL the page builds', () => {
    pack('vct-2025', [1, 2], [1], undefined, shipped);
    expect(resolveKillPackFile(url('vct-2025', 2, 'sound'), [dir, shipped]))
      .toBe(join(shipped, 'vct-2025', 'vct-2025_2.mp3'));
    expect(resolveKillPackFile(url('vct-2025', 1, 'banner'), [dir, shipped]))
      .toBe(join(shipped, 'vct-2025', 'vct-2025_1.png'));
  });

  it('serves every file from the copy the list said was in use', () => {
    // The user's prime has no banner. Its streak must not borrow the shipped
    // one's, even though that file exists.
    pack('prime', [1, 2], [1], undefined, shipped);
    pack('prime', [1, 2]);
    expect(resolveKillPackFile(url('prime', 1, 'sound'), [dir, shipped]))
      .toBe(join(dir, 'prime', 'prime_1.mp3'));
    expect(resolveKillPackFile(url('prime', 1, 'banner'), [dir, shipped])).toBeNull();
  });

  it('answers nothing for a file that is not there', () => {
    pack('ion', [1], [], undefined, shipped);
    expect(resolveKillPackFile(url('ion', 2, 'sound'), [dir, shipped])).toBeNull();
    expect(resolveKillPackFile(url('gone', 1, 'sound'), [dir, shipped])).toBeNull();
  });

  it('answers only pack files at the pack address', () => {
    pack('ion', [1], [], { name: 'Ion' }, shipped);
    writeFileSync(join(shipped, 'ion', 'ion_1.txt'), 'x');
    // There on disk, but past anything the list would ever offer.
    writeFileSync(join(shipped, 'ion', 'ion_13.mp3'), 'x');
    const dirs = [dir, shipped];
    for (const bad of [
      // Another file in the folder, or the right name under the wrong pack.
      'https://assets.krunker.io/sounds/killstreak/ion/pack.json',
      'https://assets.krunker.io/sounds/killstreak/ion/ion_1.txt',
      'https://assets.krunker.io/sounds/killstreak/ion/other_1.mp3',
      'https://assets.krunker.io/sounds/killstreak/other/ion_1.mp3',
      // Past the tier cap, or tier zero.
      'https://assets.krunker.io/sounds/killstreak/ion/ion_13.mp3',
      'https://assets.krunker.io/sounds/killstreak/ion/ion_0.mp3',
      // The same path on another host, or somewhere else on this one.
      'https://user-assets.krunker.io/sounds/killstreak/ion/ion_1.mp3',
      'https://assets.krunker.io/sounds/ion/ion_1.mp3',
      // Anything that could climb out of the pack folders.
      'https://assets.krunker.io/sounds/killstreak/..%2F..%2Fion/ion_1.mp3',
      'https://assets.krunker.io/sounds/killstreak/ion/sub/ion_1.mp3',
      'not a url',
    ]) {
      expect(resolveKillPackFile(bad, dirs), bad).toBeNull();
    }
  });
});
