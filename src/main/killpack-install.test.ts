import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  installKillPack,
  listKillPackEntries,
  outdatedKillPacks,
  refreshKillPacks,
  removeKillPack,
  type FetchFile,
  type KillCatalog,
} from './killpack-install';
import { resolveKillPackFile } from './killsounds';
import { packFileUrl } from '../shared/killstreak';

/**
 * Installing a pack on demand, and taking it away again.
 *
 * What matters: a pack is either all on disk and matching the catalog, or not
 * on disk at all. A half-downloaded or tampered pack in the list would be one
 * that looks installed and goes quiet mid-streak. And removing one can only
 * ever reach the folder the client downloads into, never the user's own.
 */

const sha512 = (data: Buffer): string => createHash('sha512').update(data).digest('base64');

const SOURCE = 'https://example.test/packs/';
const SERVED = new Map<string, Buffer>();

function file(
  pack: string,
  name: string,
  body: string,
  source = SOURCE,
): { name: string; size: number; sha512: string } {
  const data = Buffer.from(body);
  SERVED.set(`${source}${pack}/${name}`, data);
  return { name, size: data.length, sha512: sha512(data) };
}

const CATALOG: KillCatalog = {
  source: SOURCE,
  packs: [
    {
      id: 'ion',
      name: 'Ion',
      files: [
        file('ion', 'ion_1.mp3', 'first'),
        file('ion', 'ion_1.png', 'banner one'),
        file('ion', 'ion_2.mp3', 'second'),
      ],
    },
    {
      id: 'gaia-s-vengeance',
      name: "Gaia's Vengeance",
      files: [file('gaia-s-vengeance', 'gaia-s-vengeance_1.mp3', 'gaia')],
    },
  ],
};

/** A pack with more files than go at once. Kept out of CATALOG so the listing tests stay as they are. */
const BIG: KillCatalog = {
  source: SOURCE,
  packs: [
    {
      id: 'prime',
      name: 'Prime',
      files: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => file('prime', `prime_${n}.mp3`, `tier ${n}`)),
    },
  ],
};

const serve: FetchFile = (url) => {
  const data = SERVED.get(url);
  return data ? Promise.resolve(new Uint8Array(data)) : Promise.reject(new Error(`404 ${url}`));
};

let root: string;
/** The user's own folder. */
let own: string;
/** Where the client downloads to. */
let installed: string;
let dirs: string[];

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'killpack-install-'));
  own = join(root, 'own');
  installed = join(root, 'installed');
  mkdirSync(own);
  dirs = [own, installed];
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function ownPack(id: string, sounds: number): void {
  mkdirSync(join(own, id), { recursive: true });
  for (let n = 1; n <= sounds; n++) writeFileSync(join(own, id, `${id}_${n}.mp3`), 'x');
}

describe('listKillPackEntries', () => {
  it('offers the whole catalog on a fresh install, with nothing on disk', () => {
    // The download folder is not even there yet: it is made by the first install.
    expect(listKillPackEntries(dirs, installed, CATALOG)).toEqual({
      installed: [],
      removable: [],
      available: [
        { id: 'ion', name: 'Ion', sounds: 2, banners: 1, bytes: 5 + 10 + 6 },
        { id: 'gaia-s-vengeance', name: "Gaia's Vengeance", sounds: 1, banners: 0, bytes: 4 },
      ],
    });
  });

  it('moves an installed pack out of the offer and makes it removable', async () => {
    await installKillPack('ion', installed, serve, CATALOG);
    const listing = listKillPackEntries(dirs, installed, CATALOG);
    expect(listing.installed).toEqual([{ id: 'ion', name: 'Ion', sounds: 2, banners: 1 }]);
    expect(listing.removable).toEqual(['ion']);
    expect(listing.available.map((pack) => pack.id)).toEqual(['gaia-s-vengeance']);
  });

  it('counts a pack of the user\'s own as on disk, and not the client\'s to remove', async () => {
    await installKillPack('ion', installed, serve, CATALOG);
    ownPack('ion', 3);
    ownPack('mine', 1);
    const listing = listKillPackEntries(dirs, installed, CATALOG);
    // Their ion is the one that plays, so removing the downloaded copy would
    // change nothing anyone can hear.
    expect(listing.installed.map((pack) => [pack.id, pack.sounds])).toEqual([
      ['ion', 3],
      ['mine', 1],
    ]);
    expect(listing.removable).toEqual([]);
    expect(listing.available.map((pack) => pack.id)).toEqual(['gaia-s-vengeance']);
  });
});

describe('installKillPack', () => {
  it('puts every file in place, named the way the catalog names it', async () => {
    await installKillPack('gaia-s-vengeance', installed, serve, CATALOG);
    expect(readdirSync(join(installed, 'gaia-s-vengeance')).sort()).toEqual([
      'gaia-s-vengeance_1.mp3',
      'pack.json',
    ]);
    // Straight from the name the client listed it under, apostrophe and all,
    // rather than one made up from the id.
    expect(listKillPackEntries(dirs, installed, CATALOG).installed[0]?.name).toBe("Gaia's Vengeance");
  });

  it('is playable the moment it lands, with no restart', async () => {
    await installKillPack('ion', installed, serve, CATALOG);
    expect(resolveKillPackFile(packFileUrl('ion', 2, 'sound'), dirs)).toBe(
      join(installed, 'ion', 'ion_2.mp3'),
    );
  });

  it('refuses a file that is not the one the catalog describes, and keeps nothing', async () => {
    const tampered: FetchFile = (url, size) =>
      url.endsWith('ion_2.mp3') ? Promise.resolve(new Uint8Array(Buffer.from('SECOND'))) : serve(url, size);
    await expect(installKillPack('ion', installed, tampered, CATALOG)).rejects.toThrow(
      /ion_2\.mp3 is not the file/,
    );
    expect(readdirSync(installed)).toEqual([]);
    expect(listKillPackEntries(dirs, installed, CATALOG).installed).toEqual([]);
  });

  it('keeps nothing when a download fails partway', async () => {
    const flaky: FetchFile = (url, size) =>
      url.endsWith('ion_1.png') ? Promise.reject(new Error('connection reset')) : serve(url, size);
    await expect(installKillPack('ion', installed, flaky, CATALOG)).rejects.toThrow('connection reset');
    expect(readdirSync(installed)).toEqual([]);
  });

  it('downloads once however many times it is asked for while running', async () => {
    const fetchFile = vi.fn(serve);
    await Promise.all([
      installKillPack('ion', installed, fetchFile, CATALOG),
      installKillPack('ion', installed, fetchFile, CATALOG),
    ]);
    expect(fetchFile).toHaveBeenCalledTimes(3);
  });

  it('downloads a few files at a time, not the whole pack at once', async () => {
    // Behind a proxy that makes GitHub HTTP/1.1, past six a file waits for a
    // connection with its stall timer running.
    let now = 0;
    let most = 0;
    const counting: FetchFile = async (url, size) => {
      most = Math.max(most, ++now);
      await new Promise((resolve) => setImmediate(resolve));
      now--;
      return serve(url, size);
    };
    await installKillPack('prime', installed, counting, BIG);
    expect(most).toBeGreaterThan(1);
    expect(most).toBeLessThanOrEqual(4);
    expect(readdirSync(join(installed, 'prime'))).toHaveLength(11);
  });

  it('shares the four between packs installed at the same time', async () => {
    // Two Install presses are one host's connections all the same.
    let now = 0;
    let most = 0;
    const counting: FetchFile = async (url, size) => {
      most = Math.max(most, ++now);
      await new Promise((resolve) => setImmediate(resolve));
      now--;
      return serve(url, size);
    };
    const both: KillCatalog = { source: SOURCE, packs: [...CATALOG.packs, ...BIG.packs] };
    await Promise.all([
      installKillPack('prime', installed, counting, both),
      installKillPack('ion', installed, counting, both),
    ]);
    expect(most).toBeLessThanOrEqual(4);
    expect(readdirSync(installed).sort()).toEqual(['ion', 'prime']);
  });

  it('starts no more files once one has failed', async () => {
    const fetchFile = vi.fn<FetchFile>((url, size) =>
      url.endsWith('prime_1.mp3') ? Promise.reject(new Error('gone')) : serve(url, size),
    );
    await expect(installKillPack('prime', installed, fetchFile, BIG)).rejects.toThrow('gone');
    expect(fetchFile.mock.calls.length).toBeLessThan(10);
    expect(readdirSync(installed)).toEqual([]);
  });

  it('replaces an earlier copy whole rather than merging into it', async () => {
    mkdirSync(join(installed, 'ion'), { recursive: true });
    writeFileSync(join(installed, 'ion', 'ion_3.mp3'), 'left over');
    await installKillPack('ion', installed, serve, CATALOG);
    expect(existsSync(join(installed, 'ion', 'ion_3.mp3'))).toBe(false);
  });

  it('refuses a pack the catalog does not have, without fetching', async () => {
    const fetchFile = vi.fn(serve);
    await expect(installKillPack('nope', installed, fetchFile, CATALOG)).rejects.toThrow(
      /not a pack the client knows/,
    );
    expect(fetchFile).not.toHaveBeenCalled();
  });
});

describe('removeKillPack', () => {
  it('takes a downloaded pack off the disk', async () => {
    await installKillPack('ion', installed, serve, CATALOG);
    expect(removeKillPack('ion', installed)).toBe(true);
    expect(existsSync(join(installed, 'ion'))).toBe(false);
    expect(listKillPackEntries(dirs, installed, CATALOG).available.map((p) => p.id)).toContain('ion');
  });

  it('never reaches the user\'s own folder', () => {
    ownPack('ion', 2);
    expect(removeKillPack('ion', installed)).toBe(false);
    expect(existsSync(join(own, 'ion', 'ion_1.mp3'))).toBe(true);
  });

  it('refuses anything that is not a pack id', () => {
    mkdirSync(join(root, 'outside'));
    expect(removeKillPack('../outside', installed)).toBe(false);
    expect(removeKillPack('', installed)).toBe(false);
    expect(existsSync(join(root, 'outside'))).toBe(true);
  });
});

describe('bringing installed packs up to date', () => {
  /**
   * A later release's catalog with Ion's second sound fixed. Pinned to a
   * later commit, as the real one is, so it is served from its own address.
   */
  const LATER = 'https://example.test/later/';
  const fixed: KillCatalog = {
    source: LATER,
    packs: CATALOG.packs.map((pack) => ({
      ...pack,
      files: pack.files.map((f) =>
        pack.id === 'ion' && f.name === 'ion_2.mp3'
          ? file('ion', 'ion_2.mp3', 'second, fixed', LATER)
          : file(pack.id, f.name, SERVED.get(`${SOURCE}${pack.id}/${f.name}`)?.toString() ?? '', LATER),
      ),
    })),
  };

  it('counts nothing as out of date straight after installing it', async () => {
    await installKillPack('ion', installed, serve, CATALOG);
    expect(outdatedKillPacks(installed, CATALOG)).toEqual([]);
  });

  it('counts a pack as out of date once the catalog has a different version of it', async () => {
    await installKillPack('ion', installed, serve, CATALOG);
    await installKillPack('gaia-s-vengeance', installed, serve, CATALOG);
    expect(outdatedKillPacks(installed, fixed)).toEqual(['ion']);
  });

  it('counts one installed before versions were recorded as out of date', async () => {
    // What 0.1.60 wrote: a name and nothing else.
    await installKillPack('ion', installed, serve, CATALOG);
    writeFileSync(join(installed, 'ion', 'pack.json'), JSON.stringify({ name: 'Ion' }));
    expect(outdatedKillPacks(installed, CATALOG)).toEqual(['ion']);
  });

  it('leaves alone anything that is not a catalog pack', () => {
    mkdirSync(join(installed, 'someone-elses'), { recursive: true });
    mkdirSync(join(installed, 'ion.download'), { recursive: true });
    expect(outdatedKillPacks(installed, CATALOG)).toEqual([]);
    expect(outdatedKillPacks(join(root, 'nowhere'), CATALOG)).toEqual([]);
  });

  it('fetches only the out-of-date ones, and they are current afterwards', async () => {
    await installKillPack('ion', installed, serve, CATALOG);
    await installKillPack('gaia-s-vengeance', installed, serve, CATALOG);
    const fetchFile = vi.fn(serve);
    expect(await refreshKillPacks(installed, () => {}, fetchFile, fixed)).toEqual(['ion']);
    expect(fetchFile).toHaveBeenCalledTimes(3);
    expect(outdatedKillPacks(installed, fixed)).toEqual([]);
    expect(readFileSync(join(installed, 'ion', 'ion_2.mp3'), 'utf8')).toBe('second, fixed');
  });

  it('keeps the old files, which still play, when the new ones cannot be fetched', async () => {
    await installKillPack('ion', installed, serve, CATALOG);
    const offline: FetchFile = () => Promise.reject(new Error('offline'));
    const log = vi.fn();
    expect(await refreshKillPacks(installed, log, offline, fixed)).toEqual([]);
    expect(readFileSync(join(installed, 'ion', 'ion_2.mp3'), 'utf8')).toBe('second');
    expect(outdatedKillPacks(installed, fixed)).toEqual(['ion']);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('ion not brought up to date'));
  });
});
