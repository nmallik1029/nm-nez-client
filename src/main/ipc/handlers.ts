import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, shell, type BrowserWindow } from 'electron';
import { isKrunkerOrigin } from '../../krunker/constants';
import { BRANDING } from '../../shared/branding';
import { CONFIG_SECTIONS, type AppConfig } from '../../shared/config';
import { IPC, type Capabilities, type OpenableFolder, type ScanResult } from '../../shared/ipc';
import { clampFrameCap } from '../platform/flags';
import { createAccountStore } from '../accounts';
import { canUpdate, currentUpdateState, type UpdaterControls } from '../updater';
import type { Credentials } from '../../shared/accounts';
import { fetchLobbies, fetchRegionPings } from '../matchmaker';
import { loadUserscripts } from '../assets';
import { loadThemes } from '../themes';
import * as clip from '../clipboard';
import type { ConfigStore } from '../config/store';
import { hotkeyLock } from '../hotkey-lock';
import type { AppPaths } from '../paths';
import { createIpcRegistry, type IpcMainLike, type IpcRegistry } from './registry';

export interface HandlerDeps {
  readonly ipcMain: IpcMainLike;
  readonly config: ConfigStore<AppConfig>;
  readonly paths: AppPaths;
  readonly getWindow: () => BrowserWindow | null;
  readonly log: (...args: unknown[]) => void;
  /** Re-read the swap folder; returns the new file count. */
  readonly rescanSwap: () => number;
  readonly updater: UpdaterControls;
}

/** Structural check on credentials arriving from the renderer. */
function isCredentials(value: unknown): value is Credentials {
  if (value === null || typeof value !== 'object') return false;
  const { username, password } = value as { username?: unknown; password?: unknown };
  return typeof username === 'string' && username !== '' && typeof password === 'string';
}

export function registerHandlers(deps: HandlerDeps): IpcRegistry {
  const { config, paths, getWindow, log } = deps;

  const accounts = createAccountStore({
    read: () => config.get('accounts'),
    // set(), not patch(). patch spreads, which would turn the array into an
    // object keyed by index.
    write: (next) => config.set('accounts', next),
    log,
  });

  const registry = createIpcRegistry(deps.ipcMain, {
    isTrustedOrigin: isKrunkerOrigin,
    onRejected: (channel, url) =>
      console.warn(BRANDING.logPrefix, `blocked IPC "${channel}" from ${url ?? 'a dead frame'}`),
  });

  // `accounts` is stripped out. It's encrypted passwords, and page script has
  // no business seeing even the ciphertext. The rest is just settings.
  registry.handle(IPC.configGet, () => {
    const { accounts: _accounts, ...rest } = config.all();
    return rest;
  });

  registerAccountHandlers();

  registry.handle(IPC.configPatch, (_e, section: unknown, partial: unknown) => {
    // Arguments cross a trust boundary even from a trusted origin, since a
    // hostile userscript runs at the same origin as the game. Check the shape
    // instead of taking the caller's word for the section name.
    if (typeof section !== 'string' || !isConfigSection(section)) {
      throw new Error(`Unknown config section: ${String(section)}`);
    }
    if (partial === null || typeof partial !== 'object' || Array.isArray(partial)) {
      throw new Error('Config patch must be an object');
    }
    config.patch(section, partial);
    applyLiveMainSideEffects(section, partial as Record<string, unknown>);
    return config.get(section);
  });

  registry.handle(IPC.capabilities, (): Capabilities => ({
    liveFrameCap: hasLiveFrameCap(),
    canStoreAccounts: accounts.canEncrypt,
    canUpdate: canUpdate(),
    version: app.getVersion(),
    lastSeenVersion: config.get('updates').lastSeenVersion,
  }));

  registry.handle(IPC.updateCurrent, () => currentUpdateState());
  registry.handle(IPC.updateCheck, () => deps.updater.check(true));
  registry.handle(IPC.updateDownload, () => deps.updater.download());
  registry.handle(IPC.updateInstall, () => deps.updater.install());
  // Written once the notes have actually been shown, so a crash between
  // updating and reading them means you still get them next launch.
  registry.handle(IPC.updateNotesSeen, (_e, version: unknown) => {
    if (typeof version !== 'string' || version === '') return false;
    config.patch('updates', { lastSeenVersion: version });
    return true;
  });

  /**
   * Every argument gets checked. These run at the same origin as any
   * userscript you've enabled, and a loose `id` here would be a way to fish
   * for another account's password.
   */
  function registerAccountHandlers(): void {
    registry.handle(IPC.accountsList, (_e, activeUsername: unknown) =>
      accounts.list(typeof activeUsername === 'string' ? activeUsername : ''),
    );

    registry.handle(IPC.accountsSave, (_e, label: unknown, credentials: unknown) => {
      if (typeof label !== 'string') throw new Error('Malformed label');
      if (!isCredentials(credentials)) throw new Error('A username and password are required');
      return accounts.save(label, credentials);
    });

    registry.handle(IPC.accountsRemove, (_e, id: unknown) =>
      typeof id === 'string' && accounts.remove(id),
    );

    registry.handle(IPC.accountsRename, (_e, id: unknown, label: unknown) =>
      typeof id === 'string' && typeof label === 'string' && accounts.rename(id, label),
    );

    registry.handle(IPC.accountsReveal, (_e, id: unknown) =>
      typeof id === 'string' ? accounts.reveal(id) : null,
    );
  }

  /**
   * Settings main can apply without a restart.
   *
   * Background throttling looks like a window-creation flag, since it's set
   * through webPreferences at startup, but Electron has a runtime setter for
   * it too, so making anyone restart would be silly. Same story for the frame
   * cap on the patched build.
   */
  function applyLiveMainSideEffects(
    section: keyof AppConfig,
    partial: Record<string, unknown>,
  ): void {
    const has = (key: string): boolean => Object.prototype.hasOwnProperty.call(partial, key);

    if (section === 'fixes' && has('disableBackgroundThrottle')) {
      const contents = getWindow()?.webContents;
      if (!contents || contents.isDestroyed()) return;
      contents.setBackgroundThrottling(partial['disableBackgroundThrottle'] !== true);
      return;
    }

    if (section === 'performance' && has('frameCap')) {
      applyFrameCap(clampFrameCap(partial['frameCap']));
    }
  }

  /**
   * Retune the cap on the live window. Only the patched Electron has this. On
   * a stock binary the method isn't there and the cap stays whatever the
   * launch flag set, which is why the settings UI asks before dropping the
   * "restart" tag.
   */
  function applyFrameCap(fps: number): void {
    const win = getWindow();
    if (!win || win.isDestroyed()) return;
    const patched = win as BrowserWindow & { setFrameCap?: (fps: number) => void };
    if (typeof patched.setFrameCap !== 'function') return;
    patched.setFrameCap(fps);
    log(`frame cap -> ${fps === 0 ? 'uncapped' : String(fps)}`);
  }

  function hasLiveFrameCap(): boolean {
    const win = getWindow();
    if (!win || win.isDestroyed()) return false;
    return typeof (win as BrowserWindow & { setFrameCap?: unknown }).setFrameCap === 'function';
  }

  // Every theme, whatever the cssThemes toggle says. The renderer needs the
  // full list to draw the per-theme switches, and keeping the text in memory
  // is what makes switching instant.
  registry.handle(IPC.themesGet, () => loadThemes(paths.themes));

  registry.handle(IPC.swapperRescan, () => deps.rescanSwap());

  registry.handle(IPC.matchmakerScan, async (): Promise<ScanResult> => {
    // Pings run alongside the list rather than after. They're cached for a
    // minute, so most scans settle as fast as the list on its own.
    const [lobbies, pings] = await Promise.all([
      fetchLobbies(),
      // A ping failure shouldn't sink the scan. An unranked list still works.
      fetchRegionPings().catch(() => ({})),
    ]);
    return { lobbies, pings };
  });

  registry.handle(IPC.userscriptsGet, () =>
    config.get('features').userscripts ? loadUserscripts(paths.scripts) : [],
  );

  registry.handle(IPC.hotkeyCaptureLock, (_e, locked: unknown) => {
    hotkeyLock.set(locked === true);
    return hotkeyLock.locked;
  });

  registry.handle(IPC.openFolder, (_e, which: unknown) => {
    const dir = folderPath(paths, which);
    if (dir === null) throw new Error(`Unknown folder: ${String(which)}`);
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // Already there, or we can't make it. openPath reports either one.
    }
    void shell.openPath(dir);
    return dir;
  });

  registry.handle(IPC.relaunch, () => {
    // Chromium reads its switches once at process start, so anything that
    // changes them needs a restart to land.
    config.flush();
    app.relaunch();
    app.exit(0);
  });

  registry.handle(IPC.copyGameLink, async () => {
    const url = getWindow()?.webContents.getURL() ?? '';
    if (url === '') return null;
    await clip.writeText(url);
    return url;
  });

  registry.handle(IPC.joinFromClipboard, async () => {
    const text = await clip.readText();
    // Krunker only. Pasting some other URL shouldn't turn a window with our
    // preload attached into a general browser.
    if (!isKrunkerOrigin(text)) return null;
    void getWindow()?.loadURL(text);
    return text;
  });

  registry.handle(IPC.screenshot, async () => {
    const win = getWindow();
    if (!win) return null;

    const image = await win.webContents.capturePage();
    if (image.isEmpty()) return null;

    const png = image.toPNG();
    await clip.writePng(png);

    try {
      mkdirSync(paths.screenshots, { recursive: true });
      const file = join(paths.screenshots, `krunker-${timestamp()}.png`);
      writeFileSync(file, png);
      log('screenshot saved:', file);
      return file;
    } catch (err) {
      // Clipboard copy already worked, so this is a partial success, not
      // something worth putting an error in front of anyone for.
      log('screenshot: saved to clipboard only:', err);
      return 'clipboard';
    }
  });

  return registry;
}

function isConfigSection(value: string): value is keyof AppConfig {
  // Off the shared list, so a config section added later can't quietly end up
  // unpatchable.
  return (CONFIG_SECTIONS as readonly string[]).includes(value);
}

function folderPath(paths: AppPaths, which: unknown): string | null {
  const map: Record<OpenableFolder, string> = {
    swap: paths.swap,
    themes: paths.themes,
    scripts: paths.scripts,
    backgrounds: paths.backgrounds,
    screenshots: paths.screenshots,
  };
  if (typeof which !== 'string') return null;
  return Object.prototype.hasOwnProperty.call(map, which)
    ? map[which as OpenableFolder]
    : null;
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}
