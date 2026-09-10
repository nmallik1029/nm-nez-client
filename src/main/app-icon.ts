import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

/**
 * The window icon, or null when there isn't one yet.
 *
 * Only needed while running unpackaged. In a packaged build electron-builder
 * embeds the icon in the exe and every window picks it up from there, so
 * setting it again would be redundant.
 *
 * .ico first because that's what Windows actually wants and what
 * electron-builder ships; .png is here because if you only have a png,
 * electron-builder will convert it, and it'd be odd for the dev window to be
 * the one place your icon didn't show up.
 */
const CANDIDATES = ['icon.ico', 'icon.png'];

let cached: string | null | undefined;

export function appIcon(): string | null {
  if (cached !== undefined) return cached;

  cached = null;
  if (!app.isPackaged) {
    for (const name of CANDIDATES) {
      const path = join(app.getAppPath(), 'build', name);
      if (existsSync(path)) {
        cached = path;
        break;
      }
    }
  }
  return cached;
}

/**
 * Spread into BrowserWindow options. Separate from appIcon() because
 * exactOptionalPropertyTypes means `icon: undefined` is not the same as
 * leaving the key off, and only leaving it off gets the default behaviour.
 */
export function iconOption(): { icon?: string } {
  const icon = appIcon();
  return icon === null ? {} : { icon };
}
