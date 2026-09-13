import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isPackId, MAX_TIERS, nameFromId, type KillPack } from '../shared/killstreak';

/**
 * List the kill streak packs in `swap/sounds/killstreak`.
 *
 * Read each time the QoL editor opens rather than cached at startup, so a
 * pack dropped into the folder shows up the next time you look without a
 * restart. The swapper still has to know about the new files before they can
 * be played, which is why the editor asks for a rescan alongside this.
 *
 * Tiers are counted up from 1 and stop at the first gap. A pack that skips
 * its third sound is a five-sound pack whose fourth file is never reached,
 * rather than a six-sound pack that goes silent on the third kill -- and the
 * page asks for tiers by number, so a gap would be a request that 404s mid
 * streak.
 */
export function loadKillPacks(dir: string): KillPack[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    // No folder yet. Not an error: it is created on first launch, and until
    // somebody puts a pack in it there is nothing to list.
    return [];
  }

  const packs: KillPack[] = [];
  for (const id of entries) {
    // Folder names become URL paths in the page, so the same rule as config.
    if (!isPackId(id)) continue;
    const folder = join(dir, id);
    try {
      if (!statSync(folder).isDirectory()) continue;
    } catch {
      continue;
    }

    const sounds = countTiers(folder, id, 'mp3');
    // Banners without sounds is a folder of pictures, not a pack.
    if (sounds === 0) continue;

    packs.push({
      id,
      name: readName(folder) ?? nameFromId(id),
      sounds,
      banners: countTiers(folder, id, 'png'),
    });
  }

  return packs.sort((a, b) => a.name.localeCompare(b.name));
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
