import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc';
import {
  changedSounds,
  effectiveFortnite,
  FORTNITE_PACK_ID,
  SOUNDPACK_BASE,
  type FortniteConfig,
} from '../../shared/soundpacks';
import type { VisualsConfig } from '../../shared/visuals';

/**
 * The page's half of soundpacks: what is installed, previews, and making the
 * game pick up a changed sound. See shared/soundpacks.ts.
 *
 * Main answers Krunker's sound requests; the one thing it cannot do is make
 * the game ask again. Krunker loads each sound once and keeps it, as a Howl in
 * `window.SOUND.sounds`, and Howler keeps the decoded audio too, by URL. So a
 * new pick only reaches the game once both are let go of: the Howl unloaded,
 * which drops Howler's copy as well, and its entry deleted, so the next shot
 * builds a new one and asks main for the file.
 */

export interface SoundpackStatus {
  readonly id: string;
  readonly name: string;
  readonly installed: boolean;
  readonly bytes: number;
}

export async function listSoundpacks(): Promise<readonly SoundpackStatus[]> {
  try {
    return (await ipcRenderer.invoke(IPC.soundpacksGet)) as SoundpackStatus[];
  } catch {
    return [];
  }
}

/** True once it is on disk and checked; main logs why when not. */
export async function installSoundpack(id: string): Promise<boolean> {
  try {
    return (await ipcRenderer.invoke(IPC.soundpacksInstall, id)) === true;
  } catch {
    return false;
  }
}

export async function removeSoundpack(id: string): Promise<boolean> {
  try {
    return (await ipcRenderer.invoke(IPC.soundpacksRemove, id)) === true;
  } catch {
    return false;
  }
}

/** One Fortnite sound, straight away, for the editor. */
export function previewFortniteSound(id: string, volume = 0.5): void {
  const audio = new Audio(`${SOUNDPACK_BASE}${FORTNITE_PACK_ID}/${id}.ogg`);
  audio.volume = volume;
  void audio.play().catch(() => {});
}

interface HowlLike {
  unload?: () => void;
}

/**
 * Let the game's copy of every sound `test` picks go, so the next time it
 * plays it asks main again. Returns how many were let go.
 *
 * A cache entry is the sound's name with what kind of play it was for on the
 * end (`3d` or `3dv` for a sound placed in the world, `hckd`, `asset`), so
 * one sound can have three; all of them go.
 */
export function reloadGameSounds(test: (key: string) => boolean): number {
  const cache = (window as unknown as { SOUND?: { sounds?: Record<string, HowlLike | undefined> } }).SOUND
    ?.sounds;
  if (!cache || typeof cache !== 'object') return 0;
  let count = 0;
  for (const entry of Object.keys(cache)) {
    const name = entry.replace(/asset$/, '').replace(/hckd$/, '').replace(/3dv?$/, '');
    if (!test(name)) continue;
    try {
      cache[entry]?.unload?.();
    } catch {
      // Gone either way once the entry is.
    }
    delete cache[entry];
    count++;
  }
  return count;
}

/** What the page last put in effect, so a change only reloads what it changed. */
let applied: FortniteConfig | null = null;

/**
 * Put a Fortnite change in effect: saved first, then the game's copies let
 * go of. In that order because main decides what a sound request gets from
 * the saved config, and visuals are otherwise saved a moment after a change:
 * a shot inside that moment would load the old answer and keep it.
 */
export async function applyFortnite(visuals: VisualsConfig): Promise<void> {
  const next = effectiveFortnite(visuals.soundpacks.on, visuals.fortnite);
  // Taken before the wait, so two changes in quick succession each reload
  // what they changed from the one before, not from something older.
  const before = applied;
  applied = next;
  try {
    await ipcRenderer.invoke(IPC.configPatch, 'visuals', {
      soundpacks: visuals.soundpacks,
      fortnite: visuals.fortnite,
    });
  } catch {
    // Saved with the rest a moment later; the reload below may just be early.
  }
  reloadGameSounds(changedSounds(before, next));
}

/** At startup: the game loads its sounds after this, from a config main already has. */
export function initFortnite(visuals: VisualsConfig): void {
  applied = effectiveFortnite(visuals.soundpacks.on, visuals.fortnite);
}

/**
 * After the pack is installed or removed: every picked sound changes, from
 * Krunker's own to the pick or back, though the config did not.
 */
export function reloadPickedSounds(visuals: VisualsConfig): void {
  const next = effectiveFortnite(visuals.soundpacks.on, visuals.fortnite);
  reloadGameSounds(changedSounds(null, next));
  applied = next;
}
