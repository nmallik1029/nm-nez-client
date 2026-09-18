import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isPackId,
  KILL_PACK_BASE,
  MAX_TIERS,
  MAX_VARIANTS,
  nameFromId,
  type KillPack,
} from '../shared/killstreak';

/**
 * List the kill streak packs across `dirs`, most preferred folder first.
 *
 * That is the user's `swap/sounds/killstreak` and then the packs installed
 * from the catalog, so a folder of their own with an installed pack's id
 * replaces it outright -- sounds, banners and name -- rather than being merged
 * with it.
 * `packFolder` is the rule, and serving a file goes through the same one, so
 * the list and what actually plays can never disagree about which copy it is.
 *
 * Read each time the QoL editor opens rather than cached at startup, so a
 * pack dropped into the folder shows up the next time you look without a
 * restart. Files are looked up when they are asked for, so it plays straight
 * away too.
 *
 * Tiers are counted up from 1 and stop at the first gap. A pack that skips
 * its third sound is a five-sound pack whose fourth file is never reached,
 * rather than a six-sound pack that goes silent on the third kill -- and the
 * page asks for tiers by number, so a gap would be a request that 404s mid
 * streak.
 */
export function loadKillPacks(dirs: readonly string[]): KillPack[] {
  const ids = new Set<string>();
  for (const dir of dirs) {
    try {
      for (const id of readdirSync(dir)) ids.add(id);
    } catch {
      // No folder. Not an error: the user's is created on first launch, and
      // until somebody puts a pack in it there is nothing to list.
    }
  }

  const packs: KillPack[] = [];
  for (const id of ids) {
    // Folder names become URL paths in the page, so the same rule as config.
    if (!isPackId(id)) continue;
    // Banners without sounds is a folder of pictures, not a pack.
    const folder = packFolder(dirs, id);
    if (folder === null) continue;

    const banners = countTiers(folder, id, 'png');
    packs.push({
      id,
      name: readName(folder) ?? nameFromId(id),
      sounds: countTiers(folder, id, 'mp3'),
      banners,
      variants: banners > 0 ? countVariants(folder, id, banners) : 1,
    });
  }

  return packs.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The file on disk a pack URL asks for, or null.
 *
 * Only `<id>/<id>_<n>.mp3` and `.png`, and a banner's other colours
 * `<id>_v<k>_<n>.png`, under the kill pack address, in the folder
 * `packFolder` picks: the page never asks for anything else, so nothing else
 * is answered, and the id rule keeps a crafted URL from reaching outside the
 * pack folders.
 */
export function resolveKillPackFile(url: string, dirs: readonly string[]): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.hostname !== BASE.hostname || !parsed.pathname.startsWith(BASE.pathname)) return null;

  const match = PACK_FILE.exec(parsed.pathname.slice(BASE.pathname.length));
  if (match === null) return null;
  const [, id, fileId, variant, tier, ext] = match;
  if (id === undefined || !isPackId(id) || fileId !== id) return null;
  if (Number(tier) > MAX_TIERS || (ext !== 'mp3' && ext !== 'png')) return null;
  // A colour is a banner's; there is one set of sounds.
  if (variant !== undefined && (ext !== 'png' || Number(variant) > MAX_VARIANTS)) return null;

  const folder = packFolder(dirs, id);
  if (folder === null) return null;
  const file = join(folder, `${id}${variant === undefined ? '' : `_v${variant}`}_${tier}.${ext}`);
  return existsSync(file) ? file : null;
}

/** The address `packFileUrl` builds on, so the two cannot drift apart. */
const BASE = new URL(KILL_PACK_BASE);
/**
 * `<id>/<id>_<n>.<ext>`, or `<id>/<id>_v<k>_<n>.<ext>`. Loose here and checked
 * properly after the match. An id has no underscores, so the two cannot be
 * read as each other.
 */
const PACK_FILE = /^([^/_]+)\/([^/_]+)(?:_v([2-9]))?_([1-9][0-9]?)\.([a-z0-9]+)$/;

/**
 * Which copy of a pack is the one in use: the first folder holding its first
 * sound. A folder without one is not a pack, so it does not hide an installed
 * pack of the same name behind a silent one.
 */
export function packFolder(dirs: readonly string[], id: string): string | null {
  for (const dir of dirs) {
    const folder = join(dir, id);
    if (existsSync(join(folder, `${id}_1.mp3`))) return folder;
  }
  return null;
}

/**
 * Its first colour and each one after it that has every banner the first
 * has. A colour missing a banner would show the first colour's on that
 * kill, so it and anything numbered after it do not count.
 */
function countVariants(folder: string, id: string, banners: number): number {
  let count = 1;
  while (count < MAX_VARIANTS) {
    const k = count + 1;
    for (let tier = 1; tier <= banners; tier++) {
      if (!existsSync(join(folder, `${id}_v${k}_${tier}.png`))) return count;
    }
    count = k;
  }
  return count;
}

function countTiers(folder: string, id: string, ext: 'mp3' | 'png'): number {
  let count = 0;
  while (count < MAX_TIERS && existsSync(join(folder, `${id}_${count + 1}.${ext}`))) count++;
  return count;
}

/**
 * The display name from `pack.json`, if there is one worth using.
 *
 * Optional because a folder id is readable enough on its own, and a pack
 * that somebody made by hand should not need a JSON file to show up.
 */
function readName(folder: string): string | null {
  try {
    const parsed = JSON.parse(readFileSync(join(folder, 'pack.json'), 'utf8')) as unknown;
    const name =
      parsed !== null && typeof parsed === 'object' && 'name' in parsed
        ? parsed.name
        : null;
    if (typeof name !== 'string') return null;
    const trimmed = name.trim();
    return trimmed !== '' && trimmed.length <= 60 ? trimmed : null;
  } catch {
    return null;
  }
}
