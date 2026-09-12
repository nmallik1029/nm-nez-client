import type { StoredAccount } from './accounts';
import { DEFAULT_FILTER, type MatchmakerFilter } from './matchmaker';
import { RANKED_MAPS, RANKED_REGIONS } from './ranked';
import { DEFAULT_VISUALS, type VisualsConfig } from './visuals';

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
  /**
   * Filenames in the scripts folder that are switched off, from the QoL
   * panel.
   *
   * An opt-out list rather than an opt-in one, so a file dropped in the
   * folder still runs without having to be enabled somewhere first, which is
   * what the folder meant before there was a panel listing it. A name that
   * no longer exists is simply never matched, so deleting a file cannot
   * leave a setting behind.
   */
  disabledUserscripts: readonly string[];
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
   * Restyle Krunker's menu and the windows it opens: one accent instead of
   * five button colours, a gradient backdrop instead of a text shadow on
   * every label, the frame rate and ping set as numbers, and one settings
   * section on screen at a time.
   *
   * OFF by default, and that is the point. Krunker's own look is what people
   * came for, and a client that rearranges it before you have agreed is doing
   * something to you rather than for you. This is offered in Themes, beside
   * the CSS themes, because "how the client looks" is one question and it
   * should have one place to answer it.
   *
   * Everything it does is reversible: a stylesheet, plus a handful of element
   * moves that are recorded and put back. Turning it off restores the menu
   * exactly as the game ships it, with no reload.
   */
  menuSkin: boolean;
  /**
   * Ids of the built-in scripts that are switched on, from QoL Features in
   * the left menu. Ids rather than a flag each, so a script that is removed
   * later just stops being listed instead of leaving a dead setting.
   */
  enabledScripts: readonly string[];

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
  /**
   * Show how many enemies are standing on the hardpoint, in the top-right
   * counters. Hardpoint only, and it hides itself in every other mode.
   */
  hardpointCounter: boolean;
  perfHudCorner: HudCorner;
  perfHudDetail: 'fps' | 'full';
  hideAdContainers: boolean;
  /**
   * Whether the first-run walkthrough has been answered.
   *
   * Written once, when the walkthrough is finished or skipped, and never
   * cleared by an update: someone who has already said how they want the
   * client to look should not be asked again every time they update. The
   * button in Settings is the way back to it.
   *
   * Here rather than in FeatureConfig for the same reason as
   * UpdateConfig.lastSeenVersion below - it does not switch anything on,
   * it only records that we have asked.
   */
  setupDone: boolean;
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
  /**
   * Crosshair, hitmarker and sky colour, from the QoL panel.
   *
   * Its own section rather than more fields on `features`, because none of
   * these is a switch: each is an object with a shape, a colour and a handful
   * of measurements, and the editors patch the whole object at a time.
   */
  visuals: VisualsConfig;
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
  'visuals',
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
    disabledUserscripts: [],
    betterChat: true,
    hideMenuPromos: true,
    menuSkin: false,
    enabledScripts: [],
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
    hardpointCounter: true,
    perfHudCorner: 'top-left',
    perfHudDetail: 'full',
    hideAdContainers: true,
    // False on a fresh install, which is what makes the walkthrough run.
    setupDone: false,
  },
  hotkeys: DEFAULT_HOTKEYS,
  matchmaker: DEFAULT_FILTER,
  ranked: {
    // Everything on by default. A queue that matches nothing because you
    // haven't picked anything yet looks broken, not unconfigured.
    maps: RANKED_MAPS.map((m) => m.id),
    regions: RANKED_REGIONS.map((r) => r.id),
  },
  // Every one of these is off until someone turns it on in the QoL panel, so
  // a fresh client draws Krunker's own crosshair, hitmarker and sky.
  visuals: DEFAULT_VISUALS,
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
