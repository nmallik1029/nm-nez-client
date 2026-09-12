/**
 * The ids the client puts into the page.
 *
 * Here rather than beside each component because `sheets.ts` builds its
 * selectors from them and the component that mounts the element needs the same
 * string. Two copies of `'kc-alt-modal'` in two files is a rule that silently
 * stops matching the day one of them is edited.
 *
 * Ids Krunker owns (`#matchInfo`, `#spectButton`, the chat list) are not here.
 * Those belong to the game and live in `krunker/constants.ts`, which is the
 * file you check when an update breaks something.
 */

/** Elements the client mounts. Referenced by both the sheets and the DOM code. */
export const UI_IDS = {
  toast: 'kc-toast',
  tooltip: 'kc-tip',
  /** Client name and version, inside Krunker's top-left HUD stack. */
  watermark: 'nm-hud-version',
  perfHud: 'kc-perf-hud',
  /** The match-search overlay's root. */
  scan: 'kc-scan',
  /** Queue launcher in Krunker's ranked footer. */
  queueButton: 'kc-ranked-launch',
  altModal: 'kc-alt-modal',
  /** Section index down the left of the settings window. */
  sectionNav: 'kc-sectnav',
  changelogModal: 'kc-changelog-modal',
  /** The changelog row added to Krunker's left menu. */
  changelogItem: 'kc-changelog-item',
  /** Wrapper that puts Loadout and Customize on one line. */
  classButtonRow: 'kc-class-buttons',
  altManagerButton: 'kc-alt-manager-button',
  /** Enemies standing on the hardpoint, in the top-right HUD counters. */
  hardpointCounter: 'kc-hp-counter',
  /** The ranked queue, in the page rather than its own window. */
  rankedPanel: 'kc-ranked-panel',
  /** Shown while the queue runs and the panel is shut. */
  rankedPill: 'kc-ranked-pill',
  /** The update prompt, bottom right. */
  updatePanel: 'kc-update',
  /** Client wordmark and version at the top of Krunker's left menu. */
  menuMark: 'kc-menu-mark',
  /** The first-run walkthrough, drawn over the menu. */
  setupWizard: 'kc-setup',
  /** QoL Features, at the bottom of Krunker's left menu. */
  qolItem: 'kc-qol-item',
  /** The panel that row opens: userscripts, and our own features. */
  qolPanel: 'kc-qol-panel',
  /**
   * The client's own crosshair, in the middle of the screen.
   *
   * Ours rather than the game's, because Krunker draws its crosshair in the
   * canvas and the `<img>` that looks like one is dead. See KRUNKER_LOOK in
   * krunker/constants.ts, which is where that was measured.
   */
  crosshair: 'nm-crosshair',
  /**
   * The client's own hitmarker, same place.
   *
   * Also ours, for a different reason: the game's hitmarker element may or
   * may not still be live, and its hit *sound* certainly is, so the client
   * listens for that and draws its own.
   */
  hitmarker: 'nm-hitmarker',
} as const;

/**
 * `<style>` element ids, one per sheet.
 *
 * `defineStyle` dedupes on these, so a component that re-runs on a re-render
 * updates its stylesheet instead of stacking a second copy. They also make the
 * cascade legible in devtools, which is the other reason not to leave them
 * anonymous.
 */
export const STYLE_IDS = {
  tokens: 'nm-tokens',
  settings: 'kc-settings-style',
  toast: 'kc-toast-css',
  tooltip: 'kc-tip-style',
  watermark: 'nm-hud-version-css',
  perfHud: 'kc-perf-hud-css',
  scan: 'kc-scan-css',
  queueButton: 'kc-ranked-launch-css',
  altModal: 'kc-alt-modal-css',
  rankedPanel: 'kc-ranked-panel-css',
  hardpointCounter: 'kc-hp-counter-css',
  sectionNav: 'kc-sectnav-css',
  changelog: 'kc-changelog-css',
  menuButtons: 'kc-class-buttons-css',
  chatTags: 'kc-chat-tags',
  chatMerge: 'kc-chat-merge',
  chatPlace: 'kc-chat-place',
  update: 'kc-update-css',
  menuSkin: 'kc-menu-skin-css',
  krunkerWindows: 'kc-krunker-windows-css',
  hudMinimal: 'kc-hud-minimal-css',
  setupWizard: 'kc-setup-css',
  qolPanel: 'kc-qol-panel-css',
  /*
   * The two sheets that size Krunker's own crosshair and hitmarker images.
   *
   * Each is one rule against one id, carrying `!important`, which is what
   * takes the size off the game's inline style without having to write over
   * it every time it writes. See preload/look/slot.ts.
   */
  crosshair: 'kc-crosshair-css',
  hitmarker: 'kc-hitmarker-css',
} as const;
