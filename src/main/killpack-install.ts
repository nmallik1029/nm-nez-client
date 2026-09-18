import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { net } from 'electron';
import {
  isPackId,
  MAX_TIERS,
  type AvailablePack,
  type KillPackListing,
} from '../shared/killstreak';
import catalogJson from './killstreak-catalog.json';
import { loadKillPacks, packFolder } from './killsounds';

/**
 * Kill streak packs as something you install, rather than something every
 * install carries.
 *
 * WHY. 0.1.53 to 0.1.59 put all 29 Valorant packs on every machine, 34 MB of
 * sound and art whether anyone ever switched kill streaks on or not. Now the
 * client knows them by name only. The catalog baked in at build time lists
 * each pack's files with their sizes and hashes; Install downloads that one
 * pack from the repo on GitHub, checks every file against the catalog, and
 * puts it in `%APPDATA%\nmnez\killstreak`, where it plays straight away
 * because pack files are looked up as they are asked for. Remove takes it off
 * the disk again.
 *
 * The catalog is written by scripts/killstreak-catalog.mjs, which says why
 * the files come from a fixed commit rather than from main.
 */

interface CatalogFile {
  readonly name: string;
  readonly size: number;
  /** Base64, the same form the no-installer update checks with. */
  readonly sha512: string;
}

interface CatalogPack {
  readonly id: string;
  readonly name: string;
  readonly files: readonly CatalogFile[];
}

export interface KillCatalog {
  /** Ends in a slash; a file is at `<source><id>/<name>`. */
  readonly source: string;
  readonly packs: readonly CatalogPack[];
}

export const KILL_CATALOG: KillCatalog = catalogJson;

/** Downloads one file whole. Injected so tests never reach the network. */
export type FetchFile = (url: string) => Promise<Uint8Array>;

/**
 * Long enough for the biggest file on a slow line, short enough that a
 * connection that has gone nowhere gives the button back.
 */
const FETCH_TIMEOUT_MS = 30_000;

const fetchFromGitHub: FetchFile = async (url) => {
  const res = await net.fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return new Uint8Array(await res.arrayBuffer());
};

/**
 * Every pack there is, sorted into what is on disk and what is not.
 *
 * `dirs` is the reading order `loadKillPacks` takes, the user's folder first;
 * `installed` is the one of them the client downloads into. A pack the user
 * has their own copy of is on disk, so it gets no Install button, and it is
 * not removable either: the copy that plays is theirs.
 */
export function listKillPackEntries(
  dirs: readonly string[],
  installed: string,
  catalog: KillCatalog = KILL_CATALOG,
): KillPackListing {
  const onDisk = loadKillPacks(dirs);
  const have = new Set(onDisk.map((pack) => pack.id));
  return {
    installed: onDisk,
    removable: onDisk
      .filter((pack) => packFolder(dirs, pack.id) === join(installed, pack.id))
      .map((pack) => pack.id),
    available: catalog.packs.filter((pack) => !have.has(pack.id)).map(describe),
  };
}

function describe(pack: CatalogPack): AvailablePack {
  const names = new Set(pack.files.map((file) => file.name));
  // Counted the way loadKillPacks counts the same files once they are on
  // disk, so the tile says the same thing before and after.
  const count = (ext: 'mp3' | 'png'): number => {
    let n = 0;
    while (n < MAX_TIERS && names.has(`${pack.id}_${n + 1}.${ext}`)) n++;
    return n;
  };
  return {
    id: pack.id,
    name: pack.name,
    sounds: count('mp3'),
    banners: count('png'),
    bytes: pack.files.reduce((sum, file) => sum + file.size, 0),
  };
}

/** One download per pack, however many times Install is pressed while it runs. */
const running = new Map<string, Promise<void>>();

/**
 * Download a catalog pack into `dir`, checked file by file.
 *
 * It is written to `<id>.download` beside where it goes and only renamed into
 * place once every file has arrived and matched, so a pack is either all
 * there or not there at all: the list never shows one that goes quiet on its
 * fourth kill because the fourth file never came. The dot keeps the
 * half-written folder out of the list, since no pack id has one.
 *
 * Rejects on anything short of that, with nothing left behind.
 */
export function installKillPack(
  id: string,
  dir: string,
  fetchFile: FetchFile = fetchFromGitHub,
  catalog: KillCatalog = KILL_CATALOG,
): Promise<void> {
  const pack = catalog.packs.find((entry) => entry.id === id);
  if (!pack) return Promise.reject(new Error(`${id} is not a pack the client knows`));

  const key = join(dir, id);
  const already = running.get(key);
  if (already) return already;

  const job = download(pack, dir, `${catalog.source}${pack.id}/`, fetchFile).finally(() =>
    running.delete(key),
  );
  running.set(key, job);
  return job;
}

async function download(
  pack: CatalogPack,
  dir: string,
  from: string,
  fetchFile: FetchFile,
): Promise<void> {
  const staging = join(dir, `${pack.id}.download`);
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });

  // All at once: a pack is a dozen small files. Settled rather than raced, so
  // no fetch is still writing into the folder after a failure has cleared it.
  const results = await Promise.allSettled(
    pack.files.map(async (file) => {
      const data = await fetchFile(`${from}${file.name}`);
      if (data.length !== file.size || sha512(data) !== file.sha512) {
        throw new Error(`${pack.id}/${file.name} is not the file this client was built with`);
      }
      writeFileSync(join(staging, file.name), data);
    }),
  );

  try {
    const failed = results.find((result) => result.status === 'rejected');
    if (failed) throw failed.reason;
    // The name the catalog has, for loadKillPacks to read like any other
    // pack's. Written here rather than downloaded: it is not the repo's file
    // that matters, it is the name this client lists the pack under.
    writeFileSync(join(staging, 'pack.json'), JSON.stringify({ name: pack.name }));
    const target = join(dir, pack.id);
    rmSync(target, { recursive: true, force: true });
    renameSync(staging, target);
  } catch (err) {
    rmSync(staging, { recursive: true, force: true });
    throw err;
  }
}

/**
 * Take a downloaded pack off the disk. Only ever in `dir`, the folder the
 * client downloads into, so a pack of the user's own is never touched.
 *
 * Retried briefly, because the page may still be reading the sound it just
 * previewed, and Windows will not delete a file that is open.
 */
export function removeKillPack(id: string, dir: string): boolean {
  if (!isPackId(id)) return false;
  const folder = join(dir, id);
  if (!existsSync(folder)) return false;
  rmSync(folder, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  return true;
}

function sha512(data: Uint8Array): string {
  return createHash('sha512').update(data).digest('base64');
}
