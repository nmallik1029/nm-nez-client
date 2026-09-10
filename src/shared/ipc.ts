/**
 * IPC channel names, shared by main and preload so the two can't drift apart.
 *
 * Listing a channel here doesn't make it callable. It still has to be
 * registered through the origin-checked registry in `main/ipc/registry.ts`.
 */
export const IPC = {
  /** Renderer -> main. Returns the full AppConfig. */
  configGet: 'config:get',
  /**
   * Renderer -> main. What the running binary can do, as opposed to what the
   * user has turned on. Only main can feature-detect the patched Electron
   * APIs, and the settings UI needs to know whether a change costs a restart
   * before it can say so.
   */
  capabilities: 'app:capabilities',
  /** Renderer -> main. Shallow-merge into one section; returns the new section. */
  configPatch: 'config:patch',
  /** Renderer -> main. Reveal a user folder in Explorer. */
  openFolder: 'app:open-folder',
  /** Renderer -> main. Restart to apply Chromium switch changes. */
  relaunch: 'app:relaunch',
  /** Renderer -> main. Copy the current game link to the clipboard. */
  copyGameLink: 'app:copy-game-link',
  /** Renderer -> main. Read a game link from the clipboard and navigate. */
  joinFromClipboard: 'app:join-from-clipboard',
  /** Renderer -> main. Capture the window to a PNG; returns the saved path. */
  screenshot: 'app:screenshot',
  /** Renderer -> main. Every `.css` in the themes folder, with its contents. */
  themesGet: 'themes:get',
  /** Renderer -> main. Re-scan the swap folder; returns the new file count. */
  swapperRescan: 'swapper:rescan',
  /** Renderer -> main. Live lobby list plus per-region latency. */
  matchmakerScan: 'matchmaker:scan',

  /**
   * Game page -> main. Hands over the ranked auth token from localStorage.
   * The queue socket needs it and only the page can see it.
   */
  rankedToken: 'ranked:token',
  /** Game page -> main. Open the standalone queue window. */
  rankedOpen: 'ranked:open',
  /** Queue window -> main. Begin queueing with the configured selection. */
  rankedStart: 'ranked:start',
  /** Queue window -> main. Leave the queue. */
  rankedStop: 'ranked:stop',
  /** Queue window -> main. Persist the region selection. */
  rankedSetRegions: 'ranked:set-regions',
  /** Main -> queue window. Current queue state. */
  rankedState: 'ranked:state',

  /*
   * Accounts get their own channels rather than riding on config:get and
   * config:patch. Those two are wide open to the settings UI, and these are
   * passwords. This way the only route to a decrypted password is asking for
   * one account by id.
   */
  accountsList: 'accounts:list',
  accountsSave: 'accounts:save',
  accountsRemove: 'accounts:remove',
  accountsRename: 'accounts:rename',
  /** Renderer -> main. Decrypt one account so the page can sign in with it. */
  accountsReveal: 'accounts:reveal',

  /** Renderer -> main. Userscript sources from the scripts folder. */
  userscriptsGet: 'userscripts:get',
  /** Renderer -> main. Suspend global hotkeys while the rebind dialog captures. */
  hotkeyCaptureLock: 'hotkeys:capture-lock',

  /** Main -> renderer. A hotkey fired; payload is a HotkeyAction. */
  hotkeyAction: 'hotkey:action',
  /** Main -> renderer. Transient status text for the in-page toast. */
  toast: 'app:toast',
  /** Main -> renderer. Measured round-trip to the match server, in ms. */
  serverPing: 'ping:sample',
  /**
   * Main -> renderer. Themes folder changed on disk; payload is the fresh
   * list. Edit a stylesheet in an editor and it lands in-game on save.
   */
  themesChanged: 'themes:changed',
} as const;

export interface ThemeFile {
  readonly name: string;
  readonly css: string;
}

/** Result of one matchmaker scan. */
export interface ScanResult {
  readonly lobbies: readonly import('./matchmaker').Lobby[];
  readonly pings: Readonly<Record<string, number>>;
  /** Present when the scan failed; `lobbies` is then empty. */
  readonly error?: string;
}

/** What the binary we're running on supports. */
export interface Capabilities {
  /**
   * `BrowserWindow.setFrameCap()` exists, i.e. this is the patched Electron.
   * When true the FPS cap applies immediately instead of on restart.
   */
  readonly liveFrameCap: boolean;
  /**
   * OS-level encryption is available. When false the alt manager hides its
   * save button rather than writing passwords somewhere readable.
   */
  readonly canStoreAccounts: boolean;
}

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

/** Folders the settings UI can reveal. Keep in sync with `main/paths.ts`. */
export type OpenableFolder = 'swap' | 'themes' | 'scripts' | 'backgrounds' | 'screenshots';
