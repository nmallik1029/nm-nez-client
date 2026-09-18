import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isPackId } from '../shared/killstreak';
import {
  effectiveFortnite,
  FORTNITE_PACK_ID,
  fortniteSoundFor,
  SOUNDPACK_BASE,
  soundKeyFromUrl,
} from '../shared/soundpacks';
import type { VisualsConfig } from '../shared/visuals';
import type { KillCatalog } from './killpack-install';
import catalogJson from './soundpack-catalog.json';

/**
 * The main-process half of soundpacks: which of them are installed, and the
 * file on disk a sound request is answered with. See shared/soundpacks.ts.
 *
 * A soundpack installs, checks and updates itself exactly as a kill streak
 * pack does, through killpack-install.ts with this catalog and folder in
 * place of the kill streak ones: a pack there is just files with sizes and
 * hashes, whatever they are for.
 */

export const SOUNDPACK_CATALOG: KillCatalog = catalogJson;

export interface SoundpackStatus {
  readonly id: string;
  readonly name: string;
  readonly installed: boolean;
  /** The whole download, for the Install button to say what it costs. */
  readonly bytes: number;
}

/**
 * Installed means its folder is there with its pack.json, which the
 * installer writes last and renames into place with everything else, so a
 * half-downloaded pack never counts.
 */
export function isSoundpackInstalled(dir: string, id: string): boolean {
  return isPackId(id) && existsSync(join(dir, id, 'pack.json'));
}

export function soundpackStatus(dir: string, catalog: KillCatalog = SOUNDPACK_CATALOG): SoundpackStatus[] {
  return catalog.packs.map((pack) => ({
    id: pack.id,
    name: pack.name,
    installed: isSoundpackInstalled(dir, pack.id),
    bytes: pack.files.reduce((sum, file) => sum + file.size, 0),
  }));
}

/**
 * Whether Krunker's sounds need answering at all: the Fortnite pack is on
 * and installed. The request filter only covers Krunker's sound folder while
 * this is true, so on every other profile the game's sounds load untouched
 * and never reach JavaScript.
 */
export function soundSwapActive(visuals: VisualsConfig, dir: string): boolean {
  return effectiveFortnite(visuals.soundpacks.on, visuals.fortnite).on && isSoundpackInstalled(dir, FORTNITE_PACK_ID);
}

/** `<pack>/<sound>.ogg`, the only shape a preview ever asks for. */
const PREVIEW_FILE = /^([a-z0-9][a-z0-9-]{0,63})\/([a-z0-9][a-z0-9-]{0,63}\.ogg)$/;

/**
 * The file on disk that answers a request, or null to let it through.
 *
 * Two kinds. The editor's preview, at SOUNDPACK_BASE, is any sound of an
 * installed pack. And one of Krunker's own sounds, which is answered with the
 * Fortnite sound picked for it while the Fortnite pack is on; anything not
 * picked, or a pick whose file is missing, goes through to Krunker's own.
 *
 * `visuals` is read per request, since a pick changes while the game runs.
 */
export function resolveSoundpackRequest(
  url: string,
  visuals: () => VisualsConfig,
  dir: string,
): string | null {
  if (url.startsWith(SOUNDPACK_BASE)) {
    const m = PREVIEW_FILE.exec(url.slice(SOUNDPACK_BASE.length).split(/[?#]/)[0] ?? '');
    if (!m || !isPackId(m[1])) return null;
    const file = join(dir, m[1], m[2] ?? '');
    return existsSync(file) ? file : null;
  }

  const key = soundKeyFromUrl(url);
  if (key === null) return null;
  const v = visuals();
  const sound = fortniteSoundFor(key, effectiveFortnite(v.soundpacks.on, v.fortnite));
  if (sound === null) return null;
  const file = join(dir, FORTNITE_PACK_ID, `${sound}.ogg`);
  return existsSync(file) ? file : null;
}
