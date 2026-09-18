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

/**
 * Downloads one file whole, given the size the catalog expects of it.
 * Injected so tests never reach the network.
 */
export type FetchFile = (url: string, size: number) => Promise<Uint8Array>;

/**
 * How long a download may go without a single byte arriving before it is
 * given up. A stall, not a deadline: several of a pack's files download at
 * once and share the line, so on a slow connection the biggest ones take a
 * while, and that is fine for as long as they are moving. One that has gone
 * nowhere gives the button back.
 *
 * This was a 30 second deadline on each file, which let a pack whose files
 * add up to 4 MB never install on anything under about 130 KB/s: every file
 * was still arriving when its time ran out.
 */
const STALL_MS = 30_000;

const fetchFromGitHub: FetchFile = async (url, size) => {
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const wait = (): void => {
    clearTimeout(timer);
    timer = setTimeout(
      () => abort.abort(new Error(`nothing from ${url} for ${STALL_MS / 1000}s`)),
      STALL_MS,
    );
  };
  wait();
  try {
    const res = await net.fetch(url, { signal: abort.signal });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${url}`);
    const reader = res.body.getReader();
    const out = new Uint8Array(size);
    let got = 0;
    for (;;) {
      wait();
      const { done, value } = await reader.read();
      if (done) break;
      // Past its size it is not the file the catalog means, so stop reading
      // rather than hold however much a wrong answer would send.
      if (got + value.length > size) {
        void reader.cancel();
        throw new Error(`${url} is bigger than the catalog says`);
      }
      out.set(value, got);
      got += value.length;
    }
    // Short is caught by the caller's size check, with the rest of the checks.
    return got === size ? out : out.subarray(0, got);
  } finally {
    clearTimeout(timer);
  }
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

/**
 * Files downloaded at once, across every pack being installed. Under the six
 * connections Chromium opens to a host over HTTP/1.1, which is what a proxy
 * or antivirus that intercepts TLS turns GitHub's HTTP/2 into: past that, a
 * file would sit waiting for a connection with its stall timer running and
 * nothing able to reset it, and on a slow line give up before it had started.
 * Across every pack, not per pack, because two Installs pressed together are
 * one host's connections all the same.
 */
const PARALLEL = 4;

let slotsTaken = 0;
const waitingForSlot: (() => void)[] = [];

/**
 * Run `work` once one of the PARALLEL slots is free. A slot that frees up is
 * handed straight to the next in line rather than released and retaken, so
 * nothing arriving in between can take it and make five.
 */
async function inSlot<T>(work: () => Promise<T>): Promise<T> {
  if (slotsTaken < PARALLEL) slotsTaken++;
  else await new Promise<void>((resolve) => waitingForSlot.push(resolve));
  try {
    return await work();
  } finally {
    const next = waitingForSlot.shift();
    if (next) next();
    else slotsTaken--;
  }
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

  // A few at a time (see PARALLEL), and every one finished before anything
  // is cleared, so no fetch is still writing into the folder after a failure
  // has emptied it. After a failure no new file is started: the pack is not
  // going in anyway.
  const failures: unknown[] = [];
  await Promise.all(
    pack.files.map((file) =>
      inSlot(async () => {
        if (failures.length > 0) return;
        try {
          const data = await fetchFile(`${from}${file.name}`, file.size);
          if (data.length !== file.size || sha512(data) !== file.sha512) {
            throw new Error(`${pack.id}/${file.name} is not the file this client was built with`);
          }
          writeFileSync(join(staging, file.name), data);
        } catch (reason) {
          failures.push(reason);
        }
      }),
    ),
  );

  try {
    if (failures.length > 0) throw failures[0];
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
