import { app, BrowserWindow, ipcMain, session, type WebContents } from 'electron';
import * as clip from './clipboard';
import { isKrunkerOrigin } from '../krunker/constants';
import { gameFontBase64 } from './game-font';
import { BRANDING } from '../shared/branding';
import { IPC } from '../shared/ipc';
import { DEFAULT_CONFIG, type AppConfig, type HotkeyAction } from '../shared/config';
import { findAction } from '../shared/keybind';
import { ConfigStore } from './config/store';
import { hotkeyLock } from './hotkey-lock';
import { registerHandlers } from './ipc/handlers';
import { ServerPinger } from './net/ping';
import { RankedQueue, type QueueState } from './ranked/queue';
import { createRankedWindow, type RankedWindow } from './ranked/window';
import { normaliseToken, rankedMapLabel, rankedRegionLabel } from '../shared/ranked';
import { installRequestFilter } from './net/request-filter';
import { appPaths, ensureUserDirs, migrateUserData } from './paths';
import { applySwitches, computeSwitches } from './platform/flags';
import { browserUserAgent } from './platform/user-agent';
import { loadThemes, watchThemes } from './themes';
import {
  buildSwapIndex,
  resolveSwapUrl,
  scanSwapDir,
  type SwapIndex,
  EMPTY_SWAP_INDEX,
} from './swapper';
import { handleSwapProtocol, registerSwapScheme, SwapServer } from './swapper/protocol';
import { createMainWindow } from './window';

// ── Identity ──
// Has to happen before getPath('userData'), which is derived from the app
// name, and before the first window, or Windows taskbar pins won't stick.
app.setName(BRANDING.userDataDirName);
app.setAppUserModelId(BRANDING.appId);

// Drop `<app>/<version>` and `Electron/<version>` from the UA. Those are what
// the bot check in front of krunker.io flags, and getting flagged means a
// verification page on every launch. After setName (the app token is built
// from it), before the first request goes out.
app.userAgentFallback = browserUserAgent(app.userAgentFallback);

const log = (...args: unknown[]): void => console.log(BRANDING.logPrefix, ...args);

// Renaming the product moves %APPDATA%. Before appPaths(), which is the first
// thing to resolve userData and so the first thing to create it.
const migratedFrom = migrateUserData(
  BRANDING.legacyUserDataDirNames,
  BRANDING.userDataDirName,
);
if (migratedFrom !== null) log(`migrated settings from "${migratedFrom}"`);

const paths = appPaths();
const config = new ConfigStore<AppConfig>({
  filePath: paths.config,
  defaults: DEFAULT_CONFIG,
  onError: (err) => console.error(BRANDING.logPrefix, 'config write failed:', err),
});

// ── Chromium switches ──
// Module load, not whenReady. Chromium reads its command line during early C++
// startup and silently ignores anything appended after that.
applySwitches(app.commandLine, computeSwitches(config.get('performance'), config.get('advanced')));

// Custom schemes must also be declared before ready.
registerSwapScheme();

let mainWindow: BrowserWindow | null = null;
const swapServer = new SwapServer();
let swapIndex: SwapIndex = EMPTY_SWAP_INDEX;
let disposeThemeWatch: (() => void) | null = null;

// ── Ranked queue ──
// Main owns the socket, not a page, so closing or reloading the game window
// doesn't drop you out of the queue. That's the whole reason to queue
// externally and the one thing Krunker's own queue can't do.
let rankedWindow: RankedWindow | null = null;
let rankedToken = '';

const rankedQueue = new RankedQueue({
  onState: (state) => pushRankedState(state),
  onMatch: (mapId, region) => {
    // Bring the window forward. Ten minutes of doing something else is the
    // reason to queue externally in the first place.
    rankedWindow?.focus();
    log(`ranked match: ${rankedMapLabel(mapId)} in ${rankedRegionLabel(region)}`);
  },
});

/** Decorate raw state with labels the window can render directly. */
function pushRankedState(state: QueueState): void {
  const ranked = config.get('ranked');
  const decorated: Record<string, unknown> = {
    ...state,
    regions: ranked.regions,
  };

  if (state.status === 'matched') {
    decorated['mapLabel'] = rankedMapLabel(state.mapId);
    decorated['regionLabel'] = rankedRegionLabel(state.region);
  }
  if (state.status === 'error') {
    decorated['message'] =
      state.code === 'NO_TOKEN'
        ? 'Not signed in. Open Krunker and log in first'
        : state.code === 'NO_SELECTION'
          ? 'Pick at least one map and region in settings'
          : `Queue error: ${state.code}`;
  }

  rankedWindow?.send(IPC.rankedState, decorated);
}

const pinger = new ServerPinger({
  onSample: (ms) => {
    const contents = mainWindow?.webContents;
    // The frame can go away mid-navigation while the window survives, and
    // send() throws when it has.
    if (!contents || contents.isDestroyed()) return;
    try {
      contents.send(IPC.serverPing, ms);
    } catch {
      /* frame gone */
    }
  },
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(start).catch((err: unknown) => {
    console.error(BRANDING.logPrefix, 'startup failed:', err);
    app.quit();
  });
}

function start(): void {
  ensureUserDirs(paths);

  if (config.get('features').resourceSwapper) rescanSwap();
  handleSwapProtocol(swapServer);

  installRequestFilter(session.defaultSession, {
    getFeatures: () => config.get('features'),
    resolveSwap: (url) => resolveSwapUrl(url, swapIndex, (abs) => swapServer.urlFor(abs)),
    onGameSocket: (host, port) => {
      if (config.get('ui').realPing) pinger.setTarget(host, port);
      else pinger.reset();
    },
  });

  mainWindow = createMainWindow({ config });

  registerHandlers({
    ipcMain,
    config,
    paths,
    getWindow: () => mainWindow,
    log,
    rescanSwap,
  });

  installHotkeys(mainWindow.webContents);
  installRankedIpc();

  // Edit a stylesheet in a text editor and it shows up in-game on save. A
  // theme is just a <style> element, so there's nothing to reload.
  disposeThemeWatch = watchThemes(paths.themes, () => {
    const contents = mainWindow?.webContents;
    if (!contents || contents.isDestroyed()) return;
    contents.send(IPC.themesChanged, loadThemes(paths.themes));
  });

  // Recover from a renderer crash rather than leaving a blank window up.
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error(BRANDING.logPrefix, 'renderer gone:', details.reason);
    if (details.reason !== 'clean-exit' && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.reload();
    }
  });

  log('ready');
}

/**
 * Straight `ipcMain.on` rather than the origin-checked registry, because two
 * of these come from our own queue window and it has no Krunker origin to
 * check against. The channels the game page uses still verify the sender.
 */
function installRankedIpc(): void {
  ipcMain.on(IPC.rankedToken, (event, token: unknown) => {
    // Only the real game page may hand us an auth token.
    const url = event.senderFrame?.url ?? '';
    if (!isKrunkerOrigin(url)) return;
    if (typeof token !== 'string') return;
    rankedToken = normaliseToken(token);
  });

  ipcMain.on(IPC.rankedOpen, (event) => {
    const url = event.senderFrame?.url ?? '';
    if (!isKrunkerOrigin(url)) return;
    void openRankedWindow();
  });

  ipcMain.on(IPC.rankedStart, () => {
    const ranked = config.get('ranked');
    rankedQueue.start(rankedToken, ranked.maps, ranked.regions);
  });

  ipcMain.on(IPC.rankedStop, () => rankedQueue.stop());

  ipcMain.on(IPC.rankedSetRegions, (_event, regions: unknown) => {
    if (!Array.isArray(regions)) return;
    const valid = regions.filter((r): r is string => typeof r === 'string');
    config.patch('ranked', { regions: valid });
  });
}

async function openRankedWindow(): Promise<void> {
  if (rankedWindow?.isAlive()) {
    rankedWindow.focus();
    return;
  }
  // Cached after the first fetch, so this only costs anything the once.
  const font = await gameFontBase64();
  // They might have closed it again while the font was in flight.
  if (rankedWindow?.isAlive()) {
    rankedWindow.focus();
    return;
  }

  rankedWindow = createRankedWindow(font, () => {
    rankedWindow = null;
    // Closing the window drops the queue. A socket still running with no way
    // to see or cancel it would be worse.
    rankedQueue.stop();
  });
  // Paint current state as soon as the window can take it.
  rankedWindow.window.webContents.once('did-finish-load', () => {
    pushRankedState(rankedQueue.current);
  });
}

/**
 * Re-read the swap folder. Runs at startup and from the settings tab, so
 * dropping in a texture doesn't mean restarting.
 *
 * URL ids already handed out stay valid: a path that's still there keeps its
 * id, and one that's gone just stops resolving, so nothing in flight breaks.
 */
function rescanSwap(): number {
  swapIndex = buildSwapIndex(scanSwapDir(paths.swap));
  log(`swapper: ${swapIndex.size} file(s)`);
  return swapIndex.size;
}

/**
 * Hotkeys come off `before-input-event`, not `globalShortcut`. globalShortcut
 * takes the key from every other app on the machine while we're only sitting
 * in the background, and pressing F5 in a browser shouldn't reload the game.
 */
function installHotkeys(contents: WebContents): void {
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    // Rebind dialog is capturing. Let the key through to the page so it can
    // be bound, and don't act on it.
    if (hotkeyLock.locked) return;

    const action = findAction(
      {
        key: input.key,
        control: input.control,
        shift: input.shift,
        alt: input.alt,
      },
      config.get('hotkeys'),
    );
    if (action === null) return;

    // Forward what the renderer owns, handle the rest here.
    if (
      action === 'toggleSettings' ||
      action === 'togglePerfHud' ||
      action === 'findMatch'
    ) {
      event.preventDefault();
      contents.send(IPC.hotkeyAction, action);
      return;
    }

    event.preventDefault();
    void runMainAction(action, contents);
  });
}

async function runMainAction(action: HotkeyAction, contents: WebContents): Promise<void> {
  const win = mainWindow;
  switch (action) {
    case 'reload':
      contents.reload();
      return;
    case 'toggleFullscreen':
      win?.setFullScreen(!win.isFullScreen());
      return;
    case 'toggleDevTools':
      contents.toggleDevTools();
      return;
    case 'screenshot': {
      if (!win) return;
      const image = await contents.capturePage();
      if (image.isEmpty()) return;
      await clip.writePng(image.toPNG());
      contents.send(IPC.toast, 'Screenshot copied');
      return;
    }
    case 'copyGameLink': {
      await clip.writeText(contents.getURL());
      contents.send(IPC.toast, 'Link copied');
      return;
    }
    case 'joinFromClipboard': {
      const text = await clip.readText();
      if (!/^https:\/\/(?:[a-z0-9-]+\.)*krunker\.io\//i.test(text)) {
        contents.send(IPC.toast, 'No Krunker link on the clipboard');
        return;
      }
      void win?.loadURL(text);
      return;
    }
    // Renderer-owned, handled before we get here.
    case 'toggleSettings':
    case 'togglePerfHud':
    case 'findMatch':
      return;
  }
}

// A debounced config write still pending is lost if we exit first.
app.on('before-quit', () => {
  config.flush();
  disposeThemeWatch?.();
  pinger.stop();
  rankedQueue.stop();
});

// The queue window is supposed to outlive the game window, so only quit once
// every window is gone, that one included.
app.on('window-all-closed', () => app.quit());
