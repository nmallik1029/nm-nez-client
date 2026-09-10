import { ipcRenderer } from 'electron';
import { BRANDING } from '../shared/branding';
import type { AppConfig, HotkeyAction, HotkeyConfig, HudCorner } from '../shared/config';
import { IPC, type Capabilities, type OpenableFolder, type ThemeFile } from '../shared/ipc';
import { initChat, setChatOptions } from './chat';
import {
  installFixes,
  setAdContainerHiding,
  setMenuPromoHiding,
  setRawInput,
} from './fixes';
import { installChangelogItem, showPatchNotes } from './changelog';
import { createPerfHud, type PerfHud } from './hud/perf-hud';
import { createMatchSearch, type MatchSearch } from './matchmaker/scan';
import { installMenuButtons } from './accounts/menu-buttons';
import { installChatPlacement } from './chat-place';
import { setHardpointCounter } from './hud/hardpoint-counter';
import { installNameHighlights } from './name-highlights';
import { installMenuSkin, setMenuSkin } from './menu-skin';
import { toggleAltManager } from './accounts/modal';
import { watchSessionEnd } from './accounts/login';
import { installRankedLaunchButton } from './ranked-button';
import { installRealPing } from './ping';
import { hookKrunkerSettings, type SettingsTab } from './settings/krunker-tab';
import { installTokens } from './style';
import { activeTheme, knownThemes, setActiveTheme, setThemes } from './themes';
import { showToast } from './toast';
import { installWatermark } from './watermark';
import { checkForUpdatesNow, installUpdatePrompt } from './update';

/**
 * Runs in the page's main world (contextIsolation is off) ahead of Krunker's
 * own script, which is what lets the fixes get at page events first. Page
 * script can reach anything we put on `window`, so nothing secret or
 * privileged lives here. The real boundary is the origin check in main.
 *
 * Order matters: event hooks go in synchronously at document-start, since a
 * listener added after Krunker's is too late to intercept anything. Anything
 * that needs config has to wait for an IPC round-trip and so can't sit in
 * that path.
 */

const log = (...args: unknown[]): void => console.log(BRANDING.logPrefix, ...args);

// Tells Krunker a client is present. This used to be what got us the "Client"
// tab in its settings window. The settings redesign ignores it now and we
// inject that tab ourselves, but other parts of the game still read the flag.
(window as unknown as { OffCliV: boolean }).OffCliV = true;

// Design tokens go in first and synchronously, before anything that references
// them. Doing it inside bootstrap would be too late: that function starts with
// an await, so another surface could define its stylesheet ahead of the tokens
// and land above them in the cascade.
installTokens();

let hud: PerfHud | null = null;
let settingsTab: SettingsTab | null = null;
let matchSearch: MatchSearch | null = null;
/** Mirror of config, kept in step so the UI can render without a round-trip. */
let config: AppConfig | null = null;

void bootstrap();

async function bootstrap(): Promise<void> {
  try {
    config = (await ipcRenderer.invoke(IPC.configGet)) as AppConfig;
  } catch (err) {
    // Better a plain game window than a dead page.
    console.error(BRANDING.logPrefix, 'failed to read config:', err);
    return;
  }

  // Never fatal. If main can't answer, assume the stock binary and tell the
  // user the FPS cap needs a restart; overstating the cost is the safe way to
  // get this wrong.
  const capabilities: Capabilities = await ipcRenderer
    .invoke(IPC.capabilities)
    .then((c: unknown) => c as Capabilities)
    .catch(
      (): Capabilities => ({
        liveFrameCap: false,
        canStoreAccounts: false,
        canUpdate: false,
        version: '',
        lastSeenVersion: '',
      }),
    );

  const cfg = config;
  installFixes(cfg.fixes, cfg.ui.hideAdContainers, cfg.features.hideMenuPromos);
  // Listener only. It sits idle until main reports a sample, so installing it
  // unconditionally costs nothing and saves a reload when the setting goes on.
  installRealPing();

  // Hand the ranked auth token to main. It's in this origin's localStorage so
  // only the page can read it, and the queue socket won't connect without it.
  try {
    const stored = window.localStorage.getItem('__FRVR_auth_access_token');
    if (stored !== null) ipcRenderer.send(IPC.rankedToken, stored);
  } catch {
    // Storage blocked or unavailable; the queue reports NO_TOKEN instead.
  }

  onDomReady(() => {
    hud = createPerfHud({ corner: cfg.ui.perfHudCorner, detail: cfg.ui.perfHudDetail });
    if (cfg.ui.perfHud) hud.show();

    setHardpointCounter(cfg.ui.hardpointCounter);

    installNameHighlights();

    settingsTab = hookKrunkerSettings({
      config: cfg,
      capabilities,
      onChange: (section, key, value) => {
        applyLocal(section, key, value);
        void ipcRenderer.invoke(IPC.configPatch, section, { [key]: value });
      },
      onHotkeysChange: (hotkeys: HotkeyConfig) => {
        cfg.hotkeys = hotkeys;
        void ipcRenderer.invoke(IPC.configPatch, 'hotkeys', hotkeys);
      },
      setCaptureLock: (locked) => {
        void ipcRenderer.invoke(IPC.hotkeyCaptureLock, locked);
      },
      openFolder: (folder: OpenableFolder) => {
        void ipcRenderer.invoke(IPC.openFolder, folder);
      },
      relaunch: () => {
        void ipcRenderer.invoke(IPC.relaunch);
      },
      checkForUpdates: checkForUpdatesNow,
      reloadPage: () => window.location.reload(),
      rescanSwap: () => ipcRenderer.invoke(IPC.swapperRescan) as Promise<number>,
      getThemes: knownThemes,
      getActiveTheme: activeTheme,
      onThemeSelect: (name) => {
        const applied = setActiveTheme(name);
        cfg.features.activeTheme = name;
        void ipcRenderer.invoke(IPC.configPatch, 'features', { activeTheme: name });

        if (name === '') showToast('Theme cleared');
        else if (applied) showToast(`Theme applied: ${name.replace(/\.css$/i, '')}`);
        else showToast(`Could not find "${name}"`);
      },
    });

    matchSearch = createMatchSearch({
      getFilter: () => cfg.matchmaker,
      onToast: showToast,
    });

    // Adds the launcher into Krunker's own ranked panel, beside FIND MATCH.
    installRankedLaunchButton();

    // Krunker allows one sign-in per page load, so a logout has to be caught
    // as it happens or the alt manager can't explain itself later.
    watchSessionEnd();

    // Puts the client name and version under the in-game round timer.
    installWatermark();

    // Adds a changelog row at the top of Krunker's own left menu.
    installChangelogItem();

    installUpdatePrompt();
    announceUpdate(capabilities);

    // Splits Loadout/Customize into one row and adds Alt Manager below.
    installMenuButtons({
      onAltManager: () => toggleAltManager({ canStore: capabilities.canStoreAccounts }),
    });

    // After installMenuButtons, which is what creates the Alt Manager button
    // the skin then moves into the header.
    installMenuSkin(cfg.features.menuSkin);

    initChat({
      merged: cfg.features.betterChat,
      historyLimit: cfg.features.chatHistoryLimit,
    });

    // Not part of initChat: this is about where the menu puts chat, which is
    // true whether or not the chat features are on.
    installChatPlacement();

    void applyThemes();
    void runUserscripts();
  });

  log('preload ready');
}

/**
 * Mirror a change into the local config and apply whatever can take effect now.
 *
 * Nothing handled here should carry a restart or reload asterisk in the
 * settings tab. If the two lists disagree the UI is lying about what a toggle
 * costs.
 */
function applyLocal(section: keyof AppConfig, key: string, value: unknown): void {
  if (config) {
    (config[section] as unknown as Record<string, unknown>)[key] = value;
  }

  if (section === 'ui') {
    if (key === 'perfHud' && hud) {
      if (value === true) hud.show();
      else hud.hide();
    } else if (key === 'perfHudCorner' && hud && typeof value === 'string') {
      hud.setOptions({ corner: value as HudCorner });
    } else if (key === 'perfHudDetail' && hud && (value === 'fps' || value === 'full')) {
      hud.setOptions({ detail: value });
    } else if (key === 'hardpointCounter') {
      setHardpointCounter(value === true);
    } else if (key === 'hideAdContainers') {
      setAdContainerHiding(value === true);
    }
    return;
  }

  if (section === 'fixes') {
    // Applies on the next pointer-lock request, so no reload asterisk.
    if (key === 'rawInput') setRawInput(value === true);
    return;
  }

  if (section === 'features') {
    if (key === 'betterChat' || key === 'chatHistoryLimit') {
      const features = config?.features;
      setChatOptions({
        merged: features?.betterChat === true,
        historyLimit: features?.chatHistoryLimit ?? 0,
      });
    } else if (key === 'hideMenuPromos') {
      // Just a stylesheet, so it toggles without a reload.
      setMenuPromoHiding(value === true);
    } else if (key === 'menuSkin') {
      // A stylesheet and two element moves, both reversible, so this one
      // toggles live as well.
      setMenuSkin(value === true);
    } else if (key === 'resourceSwapper' && value === true) {
      // The folder is only scanned at startup, so enabling the swapper mid-
      // session would otherwise match nothing until the next launch.
      void ipcRenderer.invoke(IPC.swapperRescan);
    }
  }
}

async function applyThemes(): Promise<void> {
  try {
    const themes = (await ipcRenderer.invoke(IPC.themesGet)) as ThemeFile[];
    setThemes(themes);
    const wanted = config?.features.activeTheme ?? '';
    if (wanted !== '' && !setActiveTheme(wanted)) {
      // Theme was deleted while the client was closed. Mention it once and
      // clear the selection, or the warning comes back every launch forever
      // for a file that isn't.
      showToast(`Theme "${wanted}" is missing, selection cleared`);
      if (config) config.features.activeTheme = '';
      void ipcRenderer.invoke(IPC.configPatch, 'features', { activeTheme: '' });
    }
    log(`themes: ${themes.length} file(s), active "${activeTheme() || 'none'}"`);
  } catch (err) {
    console.error(BRANDING.logPrefix, 'theme load failed:', err);
  }
}

async function runUserscripts(): Promise<void> {
  try {
    const scripts = (await ipcRenderer.invoke(IPC.userscriptsGet)) as {
      name: string;
      title: string;
      source: string;
    }[];

    for (const script of scripts) {
      try {
        // Running user JavaScript is the whole feature, so implied-eval isn't
        // telling us anything. What actually keeps this sane: the feature is
        // off by default, source only comes from a local folder the user
        // controls, and main still origin-checks any IPC a script attempts.
        //
        // One function scope each, so a `const` collision between two scripts
        // doesn't take both of them down.
        // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call
        new Function(script.source)();
        log(`userscript: ${script.title}`);
      } catch (err) {
        console.error(BRANDING.logPrefix, `userscript "${script.name}" threw:`, err);
      }
    }
  } catch (err) {
    console.error(BRANDING.logPrefix, 'userscript load failed:', err);
  }
}

// ── Messages from main ──

ipcRenderer.on(IPC.hotkeyAction, (_event, action: HotkeyAction) => {
  if (action === 'toggleSettings') {
    settingsTab?.open();
  } else if (action === 'findMatch') {
    void matchSearch?.run();
  } else if (action === 'togglePerfHud') {
    const visible = hud?.toggle() ?? false;
    applyLocal('ui', 'perfHud', visible);
    void ipcRenderer.invoke(IPC.configPatch, 'ui', { perfHud: visible });
  }
});

ipcRenderer.on(IPC.toast, (_event, message: unknown) => {
  if (typeof message === 'string') showToast(message);
});

// Themes folder changed on disk, so swap the stylesheets in place. This is
// what makes editing a theme in a text editor show up when you save.
ipcRenderer.on(IPC.themesChanged, (_event, themes: unknown) => {
  if (!Array.isArray(themes)) return;
  setThemes(themes as ThemeFile[]);
  // Rebuild the dropdown too, in case a file appeared or vanished.
  settingsTab?.refresh();
});

/**
 * Show what changed, once, after an update.
 *
 * The version is compared against the one the notes were last shown for
 * rather than against anything the updater says, so this fires whichever way
 * the new build arrived: through the in-client updater, or by running a fresh
 * installer over the top.
 *
 * A blank lastSeenVersion means a fresh install, and there is nothing to
 * catch up on then, so it records the version and stays quiet.
 */
function announceUpdate(capabilities: Capabilities): void {
  const { version, lastSeenVersion } = capabilities;
  if (version === '' || version === lastSeenVersion) return;

  if (lastSeenVersion !== '') {
    // A beat after the menu settles, or the panel opens against a page that
    // is still building itself.
    setTimeout(() => showPatchNotes(version), 1200);
  }
  void ipcRenderer.invoke(IPC.updateNotesSeen, version);
}

function onDomReady(fn: () => void): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}
