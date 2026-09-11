import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

/**
 * Every path the client uses, resolved once.
 *
 * The user-facing folders sit next to the config rather than in the install
 * directory, so reinstalling doesn't wipe your swapped textures and a portable
 * build behaves the same as an installed one.
 */
export interface AppPaths {
  readonly userData: string;
  readonly config: string;
  /** Resource swapper root. Mirrors Krunker's own URL paths. */
  readonly swap: string;
  /** `.css` files applied to the game. */
  readonly themes: string;
  /** `.js` userscripts. */
  readonly scripts: string;
  /** Images used as loading-screen backgrounds. */
  readonly backgrounds: string;
  /** Sounds the client plays. `match-found.mp3` is the only one so far. */
  readonly sounds: string;
  readonly screenshots: string;
}

let cached: AppPaths | null = null;

export function appPaths(): AppPaths {
  if (cached) return cached;

  const userData = app.getPath('userData');
  const swap = join(userData, 'swap');

  cached = {
    userData,
    config: join(userData, 'config.json'),
    swap,
    themes: join(swap, 'themes'),
    scripts: join(swap, 'scripts'),
    backgrounds: join(swap, 'backgrounds'),
    sounds: join(swap, 'sounds'),
    screenshots: join(app.getPath('pictures'), 'Krunker'),
  };
  return cached;
}

/** Create the folders up front so they're there to find before first use. */
export function ensureUserDirs(paths: AppPaths): void {
  for (const dir of [paths.swap, paths.themes, paths.scripts, paths.backgrounds, paths.sounds]) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // Non-fatal. Whatever uses the folder just sees no files.
    }
  }
}

/**
 * Move an older release's %APPDATA% folder onto the current name. Returns the
 * folder it came from, or null if there was nothing to do.
 *
 * Has to run before anything resolves `userData`, so right after
 * `app.setName`. `appData` is the roaming root and doesn't depend on the app
 * name, which is why it's safe to read this early.
 */
export function migrateUserData(
  legacyNames: readonly string[],
  currentName: string,
): string | null {
  let appData: string;
  try {
    appData = app.getPath('appData');
  } catch {
    return null;
  }

  const target = join(appData, currentName);
  if (existsSync(target)) return null;

  // Newest first. If the name changed more than once, the most recent folder
  // is the one with the live session and config in it.
  for (const name of [...legacyNames].reverse()) {
    const source = join(appData, name);
    if (!existsSync(source)) continue;
    try {
      renameSync(source, target);
      return name;
    } catch {
      // Nearly always another instance holding a lock on the old folder.
      // Starting fresh beats not starting.
      return null;
    }
  }
  return null;
}
