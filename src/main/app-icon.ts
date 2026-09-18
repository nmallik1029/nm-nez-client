import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

/**
 * The window icon, or null when there isn't one yet.
 *
 * On Windows this is only needed while running unpackaged. In a packaged build
 * electron-builder embeds the icon in the exe and every window picks it up from
 * there, so setting it again would be redundant.
 *
 * .ico first because that's what Windows actually wants and what
 * electron-builder ships; .png is here because if you only have a png,
 * electron-builder will convert it, and it'd be odd for the dev window to be
 * the one place your icon didn't show up.
 *
 * Linux embeds nothing in the binary. A window there shows either the icon it
 * was given or the one in a desktop entry matched to it, and an AppImage only
 * has a desktop entry once something has integrated it into the menu. So the
 * packaged build sets it too, from the copy electron-builder puts in
 * resources/. Chromium on Linux can't read .ico, hence the PNGs.
 */
function candidates(): string[] {
  if (process.platform === 'linux') {
    return app.isPackaged
      ? [join(process.resourcesPath, 'icon.png')]
      : [join(app.getAppPath(), 'build', 'icons', '256x256.png')];
  }
  if (app.isPackaged) return [];
  return ['icon.ico', 'icon.png'].map((name) => join(app.getAppPath(), 'build', name));
}

let cached: string | null | undefined;

export function appIcon(): string | null {
  if (cached !== undefined) return cached;
  cached = candidates().find((path) => existsSync(path)) ?? null;
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
