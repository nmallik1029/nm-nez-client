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
/** The packs installed from the catalog. */
let installed: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'killsounds-'));
  dir = join(root, 'user');
  installed = join(root, 'installed');
  mkdirSync(dir);
  mkdirSync(installed);
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

/** A banner's other colour: `<id>_v<k>_<n>.png` beside the first. */
function colour(id: string, variant: number, banners: number[], into: string = dir): void {
  for (const n of banners) writeFileSync(join(into, id, `${id}_v${variant}_${n}.png`), 'x');
}

describe('loadKillPacks', () => {
  it('lists nothing when the folder does not exist yet', () => {
    expect(loadKillPacks([join(dir, 'missing')])).toEqual([]);
  });

  it('counts sounds and banners separately', () => {
    pack('vct-2025', [1, 2, 3, 4, 5, 6], [1, 2, 3]);
    expect(loadKillPacks([dir])).toEqual([{ id: 'vct-2025', name: 'Vct 2025', sounds: 6, banners: 3, variants: 1, variantSounds: [], variantNames: [] }]);
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

  it('lists the installed packs alongside the user\'s own, sorted together', () => {
    pack('reaver', [1, 2], [1], { name: 'Reaver' }, installed);
    pack('mine', [1], [], { name: 'Mine' });
    expect(loadKillPacks([dir, installed]).map((p) => p.id)).toEqual(['mine', 'reaver']);
  });

  it('lets a user pack replace an installed one of the same id, whole', () => {
    // Theirs has fewer sounds and no banners. Merging would ask for tiers
    // theirs does not have and show pictures from a pack they replaced.
    pack('prime', [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6], { name: 'Prime' }, installed);
    pack('prime', [1, 2], [], { name: 'My Prime' });
    expect(loadKillPacks([dir, installed])).toEqual([
      { id: 'prime', name: 'My Prime', sounds: 2, banners: 0, variants: 1, variantSounds: [], variantNames: [] },
    ]);
  });

  it('keeps the installed pack when the user folder of that name is not a pack', () => {
    pack('prime', [1, 2, 3], [1], { name: 'Prime' }, installed);
    pack('prime', [], [1, 2]);
    expect(loadKillPacks([dir, installed])).toEqual([
      { id: 'prime', name: 'Prime', sounds: 3, banners: 1, variants: 1, variantSounds: [], variantNames: [] },
    ]);
  });

  it("counts a banner's colours, each only with every banner the first has", () => {
    pack('aeris', [1, 2, 3], [1, 2, 3]);
    colour('aeris', 2, [1, 2, 3]);
    colour('aeris', 3, [1, 2, 3]);
    // Missing its third banner: that kill would show another colour's.
    colour('aeris', 4, [1, 2]);
    colour('aeris', 5, [1, 2, 3]);
    expect(loadKillPacks([dir])[0]).toMatchObject({ banners: 3, variants: 3 });
  });

  it('stops counting colours at the first one missing', () => {
    pack('bolt', [1], [1]);
    colour('bolt', 3, [1]);
    expect(loadKillPacks([dir])[0]?.variants).toBe(1);
  });

  it("counts a theme's own sounds, and names the themes from pack.json", () => {
    pack('ora-by-onetap', [1, 2, 3], [1], { name: 'ORA by OneTap', variants: ['Watch', 'Renegade', 'Raja'] });
    colour('ora-by-onetap', 2, [1]);
    colour('ora-by-onetap', 3, [1]);
    // Renegade sounds like itself; Raja plays Watch's.
    for (const n of [1, 2]) writeFileSync(join(dir, 'ora-by-onetap', `ora-by-onetap_v2_${n}.mp3`), 'x');
    expect(loadKillPacks([dir])[0]).toMatchObject({
      sounds: 3,
      variants: 3,
      variantSounds: [2, 0],
      variantNames: ['Watch', 'Renegade', 'Raja'],
    });
  });

  it('names no theme unless pack.json names every one', () => {
    pack('aeris', [1], [1], { name: 'Aeris', variants: ['Blue'] });
    colour('aeris', 2, [1]);
    expect(loadKillPacks([dir])[0]?.variantNames).toEqual([]);
    pack('bolt', [1], [1], { name: 'Bolt', variants: ['Blue', ''] });
    colour('bolt', 2, [1]);
    expect(loadKillPacks([dir]).find((p) => p.id === 'bolt')?.variantNames).toEqual([]);
  });

  it('counts no colours for a pack with no banners', () => {
    pack('quiet', [1, 2]);
    colour('quiet', 2, [1]);
    expect(loadKillPacks([dir])[0]).toMatchObject({ banners: 0, variants: 1 });
  });

  it('lists the installed packs when the user has no folder at all', () => {
    pack('ion', [1], [], undefined, installed);
    expect(loadKillPacks([join(root, 'nobody'), installed]).map((p) => p.id)).toEqual(['ion']);
  });
});

describe('resolveKillPackFile', () => {
  const url = (id: string, tier: number, kind: 'sound' | 'banner', variant?: number): string =>
    packFileUrl(id, tier, kind, variant);

  it("finds a banner in another colour, from the copy in use", () => {
    pack('aeris', [1, 2], [1, 2], undefined, installed);
    colour('aeris', 2, [1, 2], installed);
    expect(resolveKillPackFile(url('aeris', 2, 'banner', 2), [dir, installed]))
      .toBe(join(installed, 'aeris', 'aeris_v2_2.png'));
    // The user's own aeris has one colour, and it is the copy in use.
    pack('aeris', [1, 2], [1, 2]);
    expect(resolveKillPackFile(url('aeris', 2, 'banner', 2), [dir, installed])).toBeNull();
  });

  it("finds a theme's own sound", () => {
    pack('ora-by-onetap', [1], [1], undefined, installed);
    colour('ora-by-onetap', 2, [1], installed);
    writeFileSync(join(installed, 'ora-by-onetap', 'ora-by-onetap_v2_1.mp3'), 'x');
    expect(resolveKillPackFile(url('ora-by-onetap', 1, 'sound', 2), [dir, installed]))
      .toBe(join(installed, 'ora-by-onetap', 'ora-by-onetap_v2_1.mp3'));
  });

  it('answers a theme only as far as themes go', () => {
    pack('aeris', [1], [1], undefined, installed);
    colour('aeris', 2, [1], installed);
    writeFileSync(join(installed, 'aeris', 'aeris_v9_1.png'), 'x');
    const dirs = [dir, installed];
    for (const bad of [
      'https://assets.krunker.io/sounds/killstreak/aeris/aeris_v9_1.png',
      'https://assets.krunker.io/sounds/killstreak/aeris/aeris_v1_1.png',
      'https://assets.krunker.io/sounds/killstreak/aeris/aeris_v_1.png',
      'https://assets.krunker.io/sounds/killstreak/aeris/aeris_v2_v2_1.png',
      'https://assets.krunker.io/sounds/killstreak/aeris/other_v2_1.png',
    ]) {
      expect(resolveKillPackFile(bad, dirs), bad).toBeNull();
    }
  });

  it('finds an installed pack file from the URL the page builds', () => {
    pack('vct-2025', [1, 2], [1], undefined, installed);
    expect(resolveKillPackFile(url('vct-2025', 2, 'sound'), [dir, installed]))
      .toBe(join(installed, 'vct-2025', 'vct-2025_2.mp3'));
    expect(resolveKillPackFile(url('vct-2025', 1, 'banner'), [dir, installed]))
      .toBe(join(installed, 'vct-2025', 'vct-2025_1.png'));
  });

  it('serves every file from the copy the list said was in use', () => {
    // The user's prime has no banner. Its streak must not borrow the installed
    // one's, even though that file exists.
    pack('prime', [1, 2], [1], undefined, installed);
    pack('prime', [1, 2]);
    expect(resolveKillPackFile(url('prime', 1, 'sound'), [dir, installed]))
      .toBe(join(dir, 'prime', 'prime_1.mp3'));
    expect(resolveKillPackFile(url('prime', 1, 'banner'), [dir, installed])).toBeNull();
  });

  it('answers nothing for a file that is not there', () => {
    pack('ion', [1], [], undefined, installed);
    expect(resolveKillPackFile(url('ion', 2, 'sound'), [dir, installed])).toBeNull();
    expect(resolveKillPackFile(url('gone', 1, 'sound'), [dir, installed])).toBeNull();
  });

  it('answers only pack files at the pack address', () => {
    pack('ion', [1], [], { name: 'Ion' }, installed);
    writeFileSync(join(installed, 'ion', 'ion_1.txt'), 'x');
    // There on disk, but past anything the list would ever offer.
    writeFileSync(join(installed, 'ion', 'ion_13.mp3'), 'x');
    const dirs = [dir, installed];
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
