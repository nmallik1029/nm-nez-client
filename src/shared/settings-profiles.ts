import { presetName } from './presets';
import { normaliseSettingsPayload, type SettingsPayload } from './settings-import';

/**
 * Settings profiles: a whole set of Krunker settings under a name, saved on
 * this PC and switched between from the Presets tab.
 *
 * Bigger than a preset. A preset is one scope, sensitivity or FOV, written
 * straight into the game; a profile is everything Krunker's Export writes,
 * keybinds included, and switching to one is an import. That is what lets
 * someone keep a ranked setup and a pubs setup, or try a friend's settings
 * and go back, without pasting text around.
 *
 * Applying one keeps whatever the import switches say to keep (see
 * shared/settings-import.ts), the same as Krunker's Import button.
 *
 * Kept by the client rather than in the game's storage, like presets, so
 * Krunker's Reset Settings cannot take them with it.
 */

export interface SettingsProfile {
  readonly id: string;
  readonly name: string;
  /** As Export writes it, less `customize`; see normaliseSettingsPayload. */
  readonly settings: SettingsPayload;
  /** When it was saved or last updated, in ms. */
  readonly savedAt: number;
}

/**
 * How many one PC keeps. Each is a few KB of config, and the tab draws one
 * row each; this is far past what anyone switches between.
 */
export const PROFILE_LIMIT = 30;

/** The same tidying as a preset's name: one line, 32 characters at most. */
export const profileName = presetName;

/** "Settings 1", or the first number along that is free. */
export function unusedProfileName(profiles: readonly SettingsProfile[], base = 'Settings'): string {
  const taken = new Set(profiles.map((p) => p.name.toLowerCase()));
  let n = profiles.length + 1;
  while (taken.has(`${base} ${n}`.toLowerCase())) n += 1;
  return `${base} ${n}`;
}

export type RenameResult =
  | { readonly ok: true; readonly profiles: SettingsProfile[]; readonly name: string }
  | { readonly ok: false; readonly reason: 'empty' | 'taken' | 'missing' };

/**
 * The list with one profile renamed, or why not.
 *
 * Names are tidied the same way as when a profile is saved, and kept unique
 * without regard to case, since two "Ranked" rows would be two buttons nobody
 * can tell apart. Renaming one to what it is already called, in any case, is
 * not a clash with itself.
 */
export function renameProfile(
  profiles: readonly SettingsProfile[],
  id: string,
  rawName: string,
): RenameResult {
  const name = profileName(rawName);
  if (name === '') return { ok: false, reason: 'empty' };
  if (!profiles.some((p) => p.id === id)) return { ok: false, reason: 'missing' };
  if (profiles.some((p) => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, reason: 'taken' };
  }
  return { ok: true, name, profiles: profiles.map((p) => (p.id === id ? { ...p, name } : p)) };
}

/**
 * Make whatever came out of config safe to render and to apply.
 *
 * Untrusted the way presets are: the store never looks inside a list, and
 * page script can patch config through the channel the tab uses. Everything
 * in a profile ends up in the game's import, so its settings get the same
 * checks a paste does.
 */
export function normaliseProfiles(raw: unknown): SettingsProfile[] {
  if (!Array.isArray(raw)) return [];
  const out: SettingsProfile[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (out.length >= PROFILE_LIMIT) break;
    if (item === null || typeof item !== 'object') continue;
    const { id, name, settings, savedAt } = item as Record<string, unknown>;
    if (typeof id !== 'string' || id === '' || id.length > 64 || seen.has(id)) continue;
    if (typeof name !== 'string') continue;
    const cleanName = profileName(name);
    const clean = normaliseSettingsPayload(settings);
    if (cleanName === '' || !clean) continue;

    seen.add(id);
    out.push({
      id,
      name: cleanName,
      settings: clean,
      savedAt: typeof savedAt === 'number' && Number.isFinite(savedAt) ? savedAt : 0,
    });
  }
  return out;
}
