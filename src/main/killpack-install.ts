import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { net } from 'electron';
import {
  isPackId,
  MAX_TIERS,
  MAX_VARIANTS,
  RETIRED_PACKS,
  type AvailablePack,
  type KillPackListing,
} from '../shared/killstreak';
import catalogJson from './killstreak-catalog.json';
import historyJson from './killstreak-history.json';
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
 * The catalog is written by scripts/pack-catalog.mjs, which says why
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
  const banners = count('png');
  let variants = 1;
  while (
    banners > 0 &&
    variants < MAX_VARIANTS &&
    Array.from({ length: banners }, (_, i) => `${pack.id}_v${variants + 1}_${i + 1}.png`).every((name) => names.has(name))
  ) {
    variants++;
  }
  const own = (variant: number): number => {
    let n = 0;
    while (n < MAX_TIERS && names.has(`${pack.id}_v${variant}_${n + 1}.mp3`)) n++;
    return n;
  };
  return {
    id: pack.id,
    name: pack.name,
    sounds: count('mp3'),
    banners,
    variants,
    variantSounds: Array.from({ length: variants - 1 }, (_, i) => own(i + 2)),
    // Names are in pack.json, which the tile reads once the pack is on disk.
    variantNames: [],
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
    // pack's, and which version of the pack this is (see packStamp). Written
    // here rather than downloaded: it is not the repo's file that matters, it
    // is what this client lists the pack as.
    writeFileSync(
      join(staging, 'pack.json'),
      JSON.stringify({ name: pack.name, stamp: packStamp(pack) }),
    );
    const target = join(dir, pack.id);
    rmSync(target, { recursive: true, force: true });
    renameSync(staging, target);
  } catch (err) {
    rmSync(staging, { recursive: true, force: true });
    throw err;
  }
}

/**
 * Which version of a catalog pack a download is, written into its pack.json.
 *
 * A hash of the pack's files as the catalog lists them, so any change to a
 * pack's files in a later release, a sound put back in kill order or a banner
 * that was empty, makes every copy already installed out of date.
 */
export function packStamp(pack: CatalogPack): string {
  const files = pack.files.map((file) => [file.name, file.sha512]);
  return createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 16);
}

function readStamp(folder: string): string | null {
  try {
    const parsed = JSON.parse(readFileSync(join(folder, 'pack.json'), 'utf8')) as unknown;
    const stamp = parsed !== null && typeof parsed === 'object' && 'stamp' in parsed ? parsed.stamp : null;
    return typeof stamp === 'string' ? stamp : null;
  } catch {
    return null;
  }
}

/**
 * Downloaded packs that are not the version this client's catalog has.
 *
 * WHY. Installed means on disk, so without this a pack fixed in a later
 * release stays broken for everyone who installed it before: 0.1.60 shipped
 * four packs playing the wrong kill's sound, and fixing the files in the repo
 * reaches nobody who already has them. Anything installed before stamps
 * existed has none, and counts as out of date, which is exactly those.
 *
 * Only catalog packs in the download folder. A pack of the user's own is not
 * the client's to replace, and one the catalog has since dropped is left as
 * it is.
 */
export function outdatedKillPacks(dir: string, catalog: KillCatalog = KILL_CATALOG): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names.filter((id) => {
    const pack = catalog.packs.find((entry) => entry.id === id);
    return pack !== undefined && readStamp(join(dir, id)) !== packStamp(pack);
  });
}

/**
 * Download the current version of every out-of-date pack, one after another
 * and without a word, as installing does. Run at launch. One that cannot be
 * fetched now keeps its old files, which still play, and is tried again at
 * the next launch.
 */
export async function refreshKillPacks(
  dir: string,
  log: (...args: unknown[]) => void,
  fetchFile: FetchFile = fetchFromGitHub,
  catalog: KillCatalog = KILL_CATALOG,
): Promise<string[]> {
  const updated: string[] = [];
  for (const id of outdatedKillPacks(dir, catalog)) {
    try {
      await installKillPack(id, dir, fetchFile, catalog);
      updated.push(id);
      log(`kill streak pack ${id} brought up to date`);
    } catch (err) {
      log(`kill streak pack ${id} not brought up to date: ${(err as Error).message}`);
    }
  }
  return updated;
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

/**
 * Delete the downloaded copies of packs that are now a theme of another (see
 * RETIRED_PACKS). The catalog has no entry to keep them up to date, and left
 * on disk each would still be a card of its own beside the pack it became.
 * Run at launch; the config's pick has already moved to the new pack, so the
 * player fetches that one if it is not installed. Only `dir`, never the
 * user's own folder.
 */
export function retireKillPacks(dir: string, log: (...args: unknown[]) => void): string[] {
  const gone: string[] = [];
  for (const id of Object.keys(RETIRED_PACKS)) {
    try {
      if (removeKillPack(id, dir)) {
        gone.push(id);
        log(`kill streak pack ${id} removed: it is a theme of ${RETIRED_PACKS[id]?.id} now`);
      }
    } catch (err) {
      log(`kill streak pack ${id} not removed: ${(err as Error).message}`);
    }
  }
  return gone;
}

/**
 * Every sound and banner any catalog pack has ever had, by the first 16 hex of
 * its git blob id: every version of assets/killstreak in the repo's history.
 * Written by scripts/pack-catalog.mjs.
 */
const SHIPPED: ReadonlySet<string> = new Set(historyJson.blobs);

/** A file's git blob id, the way `git hash-object` makes it, cut to 16 hex. */
export function gitBlobId(data: Uint8Array): string {
  return createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex').slice(0, 16);
}

/**
 * Move out of the user's own pack folder every pack that is only a copy of one
 * of ours, so the current one plays instead.
 *
 * From 0.1.46 to 0.1.52 the client shipped no packs and said to put them in
 * swap/sounds/killstreak, and people did, with the packs this repo has. A pack
 * there replaces the downloaded one of the same id whole, as it should for a
 * pack of their own; but these are not theirs. They are ours as they were
 * then, and they hid every fix, colour and theme since: Forsaken without its
 * Gold, Bolt with its kills out of order. Updating could never reach them.
 *
 * So a folder there is set aside if its id is one of ours (in the catalog, or
 * retired into a theme) and every sound and banner in it is byte for byte a
 * file some version of that repo folder had. One file of their own, a sound
 * swapped or a banner redrawn, and it is theirs and stays. pack.json is not
 * compared: a text file, line endings differ by checkout.
 *
 * Moved to `aside`, not deleted, so nothing is lost if somebody did want the
 * old copy. Run at launch, before the window, so the page never lists a pack
 * half moved; the player then downloads the current one if it is the pick.
 */
export function setAsideCopiedPacks(
  own: string,
  aside: string,
  log: (...args: unknown[]) => void,
  catalog: KillCatalog = KILL_CATALOG,
  shipped: ReadonlySet<string> = SHIPPED,
): string[] {
  const ours = new Set([...catalog.packs.map((pack) => pack.id), ...Object.keys(RETIRED_PACKS)]);
  let names: string[];
  try {
    names = readdirSync(own);
  } catch {
    return [];
  }
  const moved: string[] = [];
  for (const id of names) {
    if (!isPackId(id) || !ours.has(id)) continue;
    const folder = join(own, id);
    try {
      const media = readdirSync(folder).filter((file) => /\.(mp3|png)$/i.test(file));
      if (!media.includes(`${id}_1.mp3`)) continue;
      if (!media.every((file) => shipped.has(gitBlobId(readFileSync(join(folder, file)))))) continue;
      mkdirSync(aside, { recursive: true });
      rmSync(join(aside, id), { recursive: true, force: true });
      renameSync(folder, join(aside, id));
      moved.push(id);
      log(`kill streak pack ${id} in the user's folder is a copy of an old one of ours; moved to ${aside}`);
    } catch (err) {
      log(`kill streak pack ${id} in the user's folder not checked: ${(err as Error).message}`);
    }
  }
  return moved;
}

function sha512(data: Uint8Array): string {
  return createHash('sha512').update(data).digest('base64');
}
