import { join } from 'node:path';
import { BrowserWindow, shell } from 'electron';
import { KRUNKER_URLS } from '../krunker/constants';
import { iconOption } from './app-icon';
import { BRANDING } from '../shared/branding';
import type { AppConfig, FixConfig } from '../shared/config';
import { GAME_WINDOW_BACKGROUND } from '../shared/palette';
import type { ConfigStore } from './config/store';

export interface MainWindowDeps {
  readonly config: ConfigStore<AppConfig>;
}

export function createMainWindow(deps: MainWindowDeps): BrowserWindow {
  const { config } = deps;
  const saved = config.get('window');
  const fixes: FixConfig = config.get('fixes');

  const win = new BrowserWindow({
    width: saved.width,
    height: saved.height,
    ...(saved.x !== undefined && saved.y !== undefined ? { x: saved.x, y: saved.y } : {}),
    minWidth: 640,
    minHeight: 480,
    backgroundColor: GAME_WINDOW_BACKGROUND,
    autoHideMenuBar: true,
    ...iconOption(),
    // Borderless fullscreen. maximize() only fills the work area and leaves
    // the titlebar and taskbar showing. This covers the screen outright and
    // is still an ordinary alt-tabbable window.
    fullscreen: true,
    title: BRANDING.productName,
    show: false,
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'index.js'),
      // Off because we hook page globals before Krunker's script runs, and
      // that means sharing the main world. Page script can therefore reach
      // the preload; what actually guards us is the origin check in
      // ipc/registry.ts, not this flag.
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: true,
      // Chromium halves the frame rate of an unfocused window, which on a
      // game you alt-tab out of constantly is a visible lurch every time you
      // come back.
      backgroundThrottling: !fixes.disableBackgroundThrottle,
      spellcheck: false,
      devTools: true,
    },
  });

  win.removeMenu();

  // Hold the title. Electron's `title` option is only the starting value, and
  // Krunker sets document.title on load, so without this the window reads
  // "Krunker.io - Free Online Multiplayer FPS Game" and you can't tell it from
  // a browser tab in the taskbar or in alt-tab.
  win.on('page-title-updated', (event) => event.preventDefault());

  win.once('ready-to-show', () => win.show());

  // External links go to the real browser. Never open a second Electron window
  // with our privileges pointed at some arbitrary page.
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });

  // Don't let the game window navigate off Krunker. A stray link or redirect
  // shouldn't turn it into a general browser with our preload still attached.
  win.webContents.on('will-navigate', (event, url) => {
    try {
      if (!new URL(url).hostname.endsWith('krunker.io')) {
        event.preventDefault();
        openExternal(url);
      }
    } catch {
      event.preventDefault();
    }
  });

  installBoundsPersistence(win, config);

  void win.loadURL(KRUNKER_URLS.game);
  return win;
}

function installBoundsPersistence(win: BrowserWindow, config: ConfigStore<AppConfig>): void {
  const save = (): void => {
    if (win.isDestroyed()) return;
    if (win.isMaximized()) {
      // Bounds while maximised are the maximised bounds, which isn't what we
      // want to come back to. Record the flag and nothing else.
      config.patch('window', { maximized: true });
      return;
    }
    if (win.isMinimized() || win.isFullScreen()) return;
    const { width, height, x, y } = win.getBounds();
    config.patch('window', { width, height, x, y, maximized: false });
  };

  win.on('resize', save);
  win.on('move', save);
  win.on('maximize', save);
  win.on('unmaximize', save);
}

/** Only ever hand http/https to the OS. No file:, no custom schemes. */
export function openExternal(url: string): void {
  try {
    const { protocol } = new URL(url);
    if (protocol === 'http:' || protocol === 'https:') void shell.openExternal(url);
  } catch {
    // Unparseable, drop it.
  }
}
