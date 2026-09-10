import { describe, expect, it } from 'vitest';
import { DEFAULT_HOTKEYS, type HotkeyConfig, type Keybind } from './config';
import {
  eventToKeybind,
  findAction,
  findConflicts,
  formatKeybind,
  HOTKEY_LABELS,
  HOTKEY_ORDER,
  matchesKeybind,
  type KeyInput,
} from './keybind';

const input = (over: Partial<KeyInput> = {}): KeyInput => ({
  key: 'F5',
  control: false,
  shift: false,
  alt: false,
  ...over,
});

const bind = (over: Partial<Keybind> = {}): Keybind => ({
  key: 'F5',
  ctrl: false,
  shift: false,
  alt: false,
  ...over,
});

describe('matchesKeybind', () => {
  it('matches a plain key', () => {
    expect(matchesKeybind(input(), bind())).toBe(true);
  });

  it('is case-insensitive on the key name', () => {
    expect(matchesKeybind(input({ key: 'L', control: true }), bind({ key: 'l', ctrl: true })))
      .toBe(true);
  });

  it('requires modifiers to match exactly, not just be present', () => {
    // A "contains" check would fire Ctrl+L here and steal Ctrl+Shift+L from
    // the game.
    const ctrlL = bind({ key: 'l', ctrl: true });
    expect(matchesKeybind(input({ key: 'l', control: true }), ctrlL)).toBe(true);
    expect(matchesKeybind(input({ key: 'l', control: true, shift: true }), ctrlL)).toBe(false);
    expect(matchesKeybind(input({ key: 'l', control: true, alt: true }), ctrlL)).toBe(false);
  });

  it('does not fire a plain binding when a modifier is held', () => {
    expect(matchesKeybind(input({ control: true }), bind())).toBe(false);
  });

  it('treats an empty key and a missing bind as unbound', () => {
    expect(matchesKeybind(input({ key: '' }), bind({ key: '' }))).toBe(false);
    expect(matchesKeybind(input(), undefined)).toBe(false);
  });
});

describe('findAction', () => {
  it('resolves the default bindings', () => {
    expect(findAction(input({ key: 'F5' }), DEFAULT_HOTKEYS)).toBe('reload');
    expect(findAction(input({ key: 'F11' }), DEFAULT_HOTKEYS)).toBe('toggleFullscreen');
    expect(findAction(input({ key: 'l', control: true }), DEFAULT_HOTKEYS)).toBe('copyGameLink');
  });

  it('returns null for an unbound key', () => {
    expect(findAction(input({ key: 'q' }), DEFAULT_HOTKEYS)).toBeNull();
  });

  it('does not hijack a bare letter that is only bound with Ctrl', () => {
    // Typing "l" in chat must not copy the game link.
    expect(findAction(input({ key: 'l' }), DEFAULT_HOTKEYS)).toBeNull();
  });
});

describe('formatKeybind', () => {
  it('renders modifiers in a stable order', () => {
    expect(formatKeybind(bind({ key: 'l', ctrl: true, shift: true }))).toBe('Ctrl+Shift+L');
    expect(formatKeybind(bind({ key: 'F5' }))).toBe('F5');
  });

  it('labels an empty binding', () => {
    expect(formatKeybind(bind({ key: '' }))).toBe('Unbound');
  });
});

describe('eventToKeybind', () => {
  it('captures the key plus held modifiers', () => {
    expect(eventToKeybind(input({ key: 'k', control: true, shift: true }))).toEqual({
      key: 'k',
      ctrl: true,
      shift: true,
      alt: false,
    });
  });

  it('returns null while only modifiers are held', () => {
    // Reaching for Ctrl+Shift+K necessarily presses Ctrl first. Committing
    // "Ctrl" at that moment would make modified combinations unbindable.
    for (const key of ['Control', 'Shift', 'Alt', 'Meta']) {
      expect(eventToKeybind(input({ key, control: true }))).toBeNull();
    }
  });

  it('accepts a function key with no modifiers', () => {
    expect(eventToKeybind(input({ key: 'F9' }))).toEqual({
      key: 'F9',
      ctrl: false,
      shift: false,
      alt: false,
    });
  });

  it('round-trips through matchesKeybind', () => {
    const captured = eventToKeybind(input({ key: 'p', alt: true }));
    expect(captured).not.toBeNull();
    expect(matchesKeybind(input({ key: 'p', alt: true }), captured!)).toBe(true);
    expect(matchesKeybind(input({ key: 'p' }), captured!)).toBe(false);
  });
});

describe('findConflicts', () => {
  it('finds none in the shipped defaults', () => {
    expect(findConflicts(DEFAULT_HOTKEYS)).toEqual([]);
  });

  it('groups actions sharing a combination', () => {
    const clashing: HotkeyConfig = { ...DEFAULT_HOTKEYS, togglePerfHud: bind({ key: 'F5' }) };
    expect(findConflicts(clashing)).toEqual([['reload', 'togglePerfHud']]);
  });

  it('ignores unbound actions', () => {
    const unbound: HotkeyConfig = {
      ...DEFAULT_HOTKEYS,
      screenshot: bind({ key: '' }),
      togglePerfHud: bind({ key: '' }),
    };
    expect(findConflicts(unbound)).toEqual([]);
  });
});

describe('hotkey UI metadata', () => {
  it('labels and orders every action exactly once', () => {
    const actions = Object.keys(DEFAULT_HOTKEYS).sort();
    expect(Object.keys(HOTKEY_LABELS).sort()).toEqual(actions);
    // A missing entry here would silently drop a row from the rebinding UI.
    expect([...HOTKEY_ORDER].sort()).toEqual(actions);
  });
});
