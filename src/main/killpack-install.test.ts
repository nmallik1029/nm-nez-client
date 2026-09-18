import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  installKillPack,
  listKillPackEntries,
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

function file(pack: string, name: string, body: string): { name: string; size: number; sha512: string } {
  const data = Buffer.from(body);
  SERVED.set(`${SOURCE}${pack}/${name}`, data);
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
    const tampered: FetchFile = (url) =>
      url.endsWith('ion_2.mp3') ? Promise.resolve(new Uint8Array(Buffer.from('SECOND'))) : serve(url);
    await expect(installKillPack('ion', installed, tampered, CATALOG)).rejects.toThrow(
      /ion_2\.mp3 is not the file/,
    );
    expect(readdirSync(installed)).toEqual([]);
    expect(listKillPackEntries(dirs, installed, CATALOG).installed).toEqual([]);
  });

  it('keeps nothing when a download fails partway', async () => {
    const flaky: FetchFile = (url) =>
      url.endsWith('ion_1.png') ? Promise.reject(new Error('connection reset')) : serve(url);
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
