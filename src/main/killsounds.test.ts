import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadKillPacks } from './killsounds';

/**
 * The folder listing the kill streak editor is built from.
 *
 * What matters is that it only ever lists something the page can actually
 * play from start to finish: a gap in the numbering, a folder name that is
 * not a safe URL segment, or a folder of banners with no sounds would each
 * be a pack that looks fine in the list and fails mid-streak.
 */

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'killsounds-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function pack(id: string, sounds: number[], banners: number[] = [], meta?: unknown): void {
  const folder = join(dir, id);
  mkdirSync(folder, { recursive: true });
  for (const n of sounds) writeFileSync(join(folder, `${id}_${n}.mp3`), 'x');
  for (const n of banners) writeFileSync(join(folder, `${id}_${n}.png`), 'x');
  if (meta !== undefined) writeFileSync(join(folder, 'pack.json'), JSON.stringify(meta));
}

describe('loadKillPacks', () => {
  it('lists nothing when the folder does not exist yet', () => {
    expect(loadKillPacks(join(dir, 'missing'))).toEqual([]);
  });

  it('counts sounds and banners separately', () => {
    pack('vct-2025', [1, 2, 3, 4, 5, 6], [1, 2, 3]);
    expect(loadKillPacks(dir)).toEqual([{ id: 'vct-2025', name: 'Vct 2025', sounds: 6, banners: 3 }]);
  });

  it('stops at the first gap rather than skipping it', () => {
    // A request for tier 3 would 404 mid-streak, so the pack is two sounds long.
    pack('gappy', [1, 2, 4, 5]);
    expect(loadKillPacks(dir)[0]?.sounds).toBe(2);
  });

  it('leaves out a folder with no first sound', () => {
    pack('pictures', [], [1, 2, 3]);
    pack('late-start', [2, 3]);
    expect(loadKillPacks(dir)).toEqual([]);
  });

  it('lists a sound-only pack with no banners', () => {
    pack('mystbloom', [1, 2, 3, 4, 5]);
    expect(loadKillPacks(dir)[0]).toMatchObject({ sounds: 5, banners: 0 });
  });

  it('takes the name from pack.json when there is a usable one', () => {
    pack('gaia-s-vengeance', [1], [], { name: "Gaia's Vengeance" });
    pack('blank-name', [1], [], { name: '   ' });
    pack('bad-json', [1]);
    writeFileSync(join(dir, 'bad-json', 'pack.json'), '{not json');
    const names = loadKillPacks(dir).map((p) => p.name);
    expect(names).toEqual(['Bad Json', 'Blank Name', "Gaia's Vengeance"]);
  });

  it('skips folders whose name is not a safe pack id, and stray files', () => {
    pack('Upper Case', [1]);
    pack('has.dot', [1]);
    writeFileSync(join(dir, 'loose_1.mp3'), 'x');
    pack('ok', [1]);
    expect(loadKillPacks(dir).map((p) => p.id)).toEqual(['ok']);
  });

  it('sorts by the name people see, not the folder', () => {
    pack('zzz', [1], [], { name: 'Alpha' });
    pack('aaa', [1], [], { name: 'Zulu' });
    expect(loadKillPacks(dir).map((p) => p.name)).toEqual(['Alpha', 'Zulu']);
  });
});
