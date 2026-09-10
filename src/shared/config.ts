import type { StoredAccount } from './accounts';
import { DEFAULT_FILTER, type MatchmakerFilter } from './matchmaker';
import { RANKED_MAPS, RANKED_REGIONS } from './ranked';

export type { MatchmakerFilter } from './matchmaker';

export interface RankedConfig {
  /** Ranked map ids to queue for. Empty means the queue cannot start. */
  maps: number[];
  regions: string[];
}

/**
 * The config contract, shared by main and preload.
 *
 * These live in `shared/` rather than under `main/` because preload needs them
 * too and the two halves compile under different tsconfigs (main has no DOM
 * lib, preload does). Anything both sides touch has to sit somewhere neither
 * of them owns.
 */

export type AngleBackend = 'default' | 'gl' | 'd3d11' | 'd3d11on12';

export const ANGLE_BACKENDS: readonly AngleBackend[] = ['default', 'gl', 'd3d11', 'd3d11on12'];

export interface PerformanceConfig {
  /** Remove the frame-rate limit. Needs the patched Electron to be safe. */
  readonly fpsUnlocked: boolean;
  /** Exact FPS cap. 0 = uncapped. Clamped to 30..1000. */
  readonly frameCap: number;
  /** Deeper compositor frame queue. Ignored while a cap is set. */
  readonly higherMaxFps: boolean;
}

export interface AdvancedConfig {
  readonly angleBackend: AngleBackend;
  readonly removeUselessFeatures: boolean;
  readonly perfTweaks: boolean;
}

export interface Keybind {
  /** `KeyboardEvent.key`, compared case-insensitively. Empty = unbound. */
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
}

export type HotkeyAction =
  | 'reload'
  | 'toggleFullscreen'
  | 'toggleDevTools'
  | 'toggleSettings'
  | 'togglePerfHud'
  | 'screenshot'
  | 'copyGameLink'
  | 'joinFromClipboard'
  | 'findMatch';

export type HotkeyConfig = Record<HotkeyAction, Keybind>;

export interface FeatureConfig {
  blockAds: boolean;
  hideBunnies: boolean;
  hideTurfBanners: boolean;
  resourceSwapper: boolean;
  userscripts: boolean;
  /** Show team and all chat together, prefixed [T] / [M]. */
  betterChat: boolean;
  /**
   * Hide the game's own menu promos: battle pass and daily spin rows, the
   * Twitch drops overlay, the top-corner slots. The season logo, the signup
   * rewards button, the register-now pitch and the end-of-match "Join
   * Krunker today" banner are taken out of the document rather than hidden.
   * Not the same thing as hideAdContainers, since none of this is
   * third-party advertising.
   */
  hideMenuPromos: boolean;
  /**
   * Restyle Krunker's main menu: one accent instead of five button colours, a
   * gradient backdrop instead of a text shadow on every label, and the frame
   * rate and ping set as numbers rather than prose.
   *
   * Paint only. It never moves anything the game lays out, so turning it off
   * puts the menu back exactly as Krunker ships it.
   */
  menuSkin: boolean;
  /**
   * Messages to keep. Krunker prunes old ones hard, so this puts them back and
   * trims to this number instead. 0 leaves the game's behaviour alone.
   */
  chatHistoryLimit: number;
  /**
   * Filename of the active CSS theme, or '' for none.
   *
   * One theme at a time rather than a set. Two stylesheets touching the same
   * selector fight over cascade order, and nothing in the UI shows you that,
   * so you end up debugging it blind.
   */
  activeTheme: string;
}

export interface FixConfig {
  /**
   * preventDefault on wheel events outside scrollable elements. Chromium paces
   * frames to vsync for the length of a scroll gesture, which drops an
   * uncapped framerate to the refresh rate, and in-game the wheel is your
   * weapon switch.
   */
  scrollFramePacing: boolean;
  /** Release pointer lock on Escape, which Krunker swallows. */
  escapePointerLock: boolean;
  /** Keep rendering at full rate while unfocused. */
  disableBackgroundThrottle: boolean;
  /**
   * Ask pointer lock for unaccelerated mouse deltas.
   *
   * Chromium's movementX/Y are OS-adjusted by default, so on Windows they
   * carry pointer ballistics ("Enhance pointer precision"), a non-linear curve
   * that multiplies fast movement more than slow. That's the aim flick.
   */
  rawInput: boolean;
}

export type HudCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface UiConfig {
  /**
   * Replace Krunker's estimated ping with a measured TCP round-trip to the
   * match server, in the game's own HUD element.
   */
  realPing: boolean;
  perfHud: boolean;
  perfHudCorner: HudCorner;
  perfHudDetail: 'fps' | 'full';
  hideAdContainers: boolean;
}

export interface UpdateConfig {
  /** Look for a new release shortly after launch. */
  autoCheck: boolean;
  /**
   * Version the patch notes were last shown for.
   *
   * Not a setting, just somewhere to remember it. Empty on a fresh install,
   * which is how the notes are kept from popping up the very first time you
   * open the client, when there is nothing new to read.
   */
  lastSeenVersion: string;
}

export interface WindowConfig {
  width: number;
  height: number;
  maximized: boolean;
  /** Undefined until the window has been moved once. */
  x?: number;
  y?: number;
}

export interface AppConfig {
  performance: PerformanceConfig;
  advanced: AdvancedConfig;
  features: FeatureConfig;
  fixes: FixConfig;
  ui: UiConfig;
  hotkeys: HotkeyConfig;
  matchmaker: MatchmakerFilter;
  ranked: RankedConfig;
  updates: UpdateConfig;
  window: WindowConfig;
  /**
   * Saved accounts, encrypted.
   *
   * Kept out of CONFIG_SECTIONS. That's the allowlist config:patch
   * checks against, so page script can't get at these through it, and they're
   * stripped from config:get as well. Accounts only move through their own
   * handlers, and those never decrypt anything except the one account you're
   * switching to.
   */
  accounts: StoredAccount[];
}

export const CONFIG_SECTIONS: readonly (keyof AppConfig)[] = [
  'performance',
  'advanced',
  'features',
  'fixes',
  'ui',
  'hotkeys',
  'matchmaker',
  'ranked',
  'updates',
  'window',
];

const bind = (key: string, mods: Partial<Omit<Keybind, 'key'>> = {}): Keybind => ({
  key,
  ctrl: mods.ctrl ?? false,
  shift: mods.shift ?? false,
  alt: mods.alt ?? false,
});

export const DEFAULT_HOTKEYS: HotkeyConfig = {
  reload: bind('F5'),
  toggleFullscreen: bind('F11'),
  toggleDevTools: bind('F12'),
  toggleSettings: bind('F1'),
  findMatch: bind('F6'),
  togglePerfHud: bind('F10'),
  screenshot: bind('F9'),
  copyGameLink: bind('l', { ctrl: true }),
  joinFromClipboard: bind('j', { ctrl: true }),
};

export const DEFAULT_CONFIG: AppConfig = {
  performance: {
    // Off unless you're on the patched build.
    //
    // --disable-frame-rate-limit on stock Chromium spins the compositor and
    // starves input dispatch: 50-300ms of aim lag, which is the exact bug the
    // patch fixes. On a stock binary this would feel worse than a browser tab.
    fpsUnlocked: false,
    frameCap: 0,
    higherMaxFps: false,
  },
  advanced: {
    angleBackend: 'default',
    removeUselessFeatures: true,
    // Off by default. Turns off driver bug workarounds and the software
    // rasteriser fallback, so anyone with a flaky GPU gets a working client
    // first and has to go looking for the risky switches.
    perfTweaks: false,
  },
  features: {
    blockAds: true,
    hideBunnies: false,
    hideTurfBanners: false,
    resourceSwapper: true,
    userscripts: false,
    betterChat: true,
    hideMenuPromos: true,
    menuSkin: true,
    chatHistoryLimit: 200,
    activeTheme: '',
  },
  fixes: {
    scrollFramePacing: true,
    escapePointerLock: true,
    disableBackgroundThrottle: true,
    rawInput: true,
  },
  ui: {
    realPing: true,
    perfHud: false,
    perfHudCorner: 'top-left',
    perfHudDetail: 'full',
    hideAdContainers: true,
  },
  hotkeys: DEFAULT_HOTKEYS,
  matchmaker: DEFAULT_FILTER,
  ranked: {
    // Everything on by default. A queue that matches nothing because you
    // haven't picked anything yet looks broken, not unconfigured.
    maps: RANKED_MAPS.map((m) => m.id),
    regions: RANKED_REGIONS.map((r) => r.id),
  },
  updates: {
    autoCheck: true,
    lastSeenVersion: '',
  },
  window: {
    width: 1600,
    height: 900,
    maximized: false,
  },
  accounts: [],
};
