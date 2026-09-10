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
  changelogModal: 'kc-changelog-modal',
  /** The changelog row added to Krunker's left menu. */
  changelogItem: 'kc-changelog-item',
  /** Wrapper that puts Loadout and Customize on one line. */
  classButtonRow: 'kc-class-buttons',
  altManagerButton: 'kc-alt-manager-button',
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
  changelog: 'kc-changelog-css',
  menuButtons: 'kc-class-buttons-css',
  chatTags: 'kc-chat-tags',
  chatMerge: 'kc-chat-merge',
} as const;
