import type { HotkeyAction, HotkeyConfig, Keybind } from './config';

/** The subset of a key event both Electron and the DOM provide. */
export interface KeyInput {
  readonly key: string;
  readonly control: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
}

/** Keys that can never be a binding on their own. */
const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock']);

/**
 * Modifiers have to match exactly, not just be present.
 *
 * A "contains" check fires Ctrl+L (copy link) on Ctrl+Shift+L, and that's how
 * you end up eating keystrokes the game or the OS wanted. An empty `key` means
 * unbound and never matches anything.
 */
export function matchesKeybind(input: KeyInput, bind: Keybind | undefined): boolean {
  if (!bind || bind.key === '') return false;
  return (
    input.key.toLowerCase() === bind.key.toLowerCase() &&
    input.control === bind.ctrl &&
    input.shift === bind.shift &&
    input.alt === bind.alt
  );
}

/**
 * First action whose binding matches, in declaration order. `HotkeyConfig` is
 * a plain object literal so that order is stable, which means two actions on
 * the same key resolve the same way every time.
 */
export function findAction(input: KeyInput, hotkeys: HotkeyConfig): HotkeyAction | null {
  for (const [action, bind] of Object.entries(hotkeys) as [HotkeyAction, Keybind][]) {
    if (matchesKeybind(input, bind)) return action;
  }
  return null;
}

/** Human-readable form, e.g. `Ctrl+Shift+L`. */
export function formatKeybind(bind: Keybind): string {
  if (bind.key === '') return 'Unbound';
  const parts: string[] = [];
  if (bind.ctrl) parts.push('Ctrl');
  if (bind.shift) parts.push('Shift');
  if (bind.alt) parts.push('Alt');
  parts.push(bind.key.length === 1 ? bind.key.toUpperCase() : bind.key);
  return parts.join('+');
}

/** Actions sharing a combination. The UI warns about these. */
export function findConflicts(hotkeys: HotkeyConfig): HotkeyAction[][] {
  const groups = new Map<string, HotkeyAction[]>();
  for (const [action, bind] of Object.entries(hotkeys) as [HotkeyAction, Keybind][]) {
    if (bind.key === '') continue;
    const id = `${bind.ctrl ? 'c' : ''}${bind.shift ? 's' : ''}${bind.alt ? 'a' : ''}:${bind.key.toLowerCase()}`;
    const existing = groups.get(id);
    if (existing) existing.push(action);
    else groups.set(id, [action]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

/**
 * Turn a captured key event into a binding.
 *
 * Null while only modifiers are down. Anyone reaching for Ctrl+Shift+K presses
 * Ctrl first, and taking "Ctrl" as the answer right then would make modified
 * combinations impossible to bind at all.
 */
export function eventToKeybind(event: KeyInput): Keybind | null {
  if (MODIFIER_KEYS.has(event.key)) return null;
  return {
    key: event.key,
    ctrl: event.control,
    shift: event.shift,
    alt: event.alt,
  };
}

/** Human-readable action names for the rebinding UI. */
export const HOTKEY_LABELS: Record<HotkeyAction, string> = {
  toggleSettings: 'Open client settings',
  findMatch: 'Find match',
  togglePerfHud: 'Toggle frame-time HUD',
  screenshot: 'Screenshot',
  reload: 'Reload page',
  toggleFullscreen: 'Toggle fullscreen',
  toggleDevTools: 'Developer tools',
  copyGameLink: 'Copy game link',
  joinFromClipboard: 'Join from clipboard',
};

/** Display order in the rebinding UI. Most-used first, not object order. */
export const HOTKEY_ORDER: readonly HotkeyAction[] = [
  'toggleSettings',
  'findMatch',
  'togglePerfHud',
  'screenshot',
  'copyGameLink',
  'joinFromClipboard',
  'reload',
  'toggleFullscreen',
  'toggleDevTools',
];
