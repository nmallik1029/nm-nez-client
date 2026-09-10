import type { HotkeyAction, HotkeyConfig, Keybind } from '../../shared/config';
import { DEFAULT_HOTKEYS } from '../../shared/config';
import {
  eventToKeybind,
  findConflicts,
  formatKeybind,
  HOTKEY_LABELS,
  HOTKEY_ORDER,
} from '../../shared/keybind';
import { attachTooltip } from './tooltip';

/**
 * Shortcut rows, inline in the Client tab.
 *
 * Not a modal. Krunker puts its own keybinds inline in the
 * Controls tab as `setting settName` rows with a `keyIcon` and unbind/reset
 * icons, and matching that shape is what stops this looking bolted on.
 *
 * Capturing a key means fighting for it twice. In the page Krunker binds most
 * of them, so the listener runs in capture phase with preventDefault and
 * stopImmediatePropagation. In main the global hotkey handler would act on the
 * very key being bound, so pressing F11 to rebind it would toggle fullscreen;
 * `setCaptureLock` suspends dispatch while that's going on. Every exit path
 * calls `endCapture`, because a stuck lock quietly kills every hotkey until
 * you restart.
 */

export interface KeybindRowsDeps {
  readonly getHotkeys: () => HotkeyConfig;
  readonly onSave: (hotkeys: HotkeyConfig) => void;
  readonly setCaptureLock: (locked: boolean) => void;
}

export interface KeybindRows {
  /** Append the rows into a Krunker `setBodH` container. */
  render(body: HTMLElement): void;
  /** Release the capture lock. Call before the DOM is torn down. */
  cancel(): void;
}

export function createKeybindRows(deps: KeybindRowsDeps): KeybindRows {
  let working: HotkeyConfig = { ...deps.getHotkeys() };
  let capturing: HotkeyAction | null = null;
  let conflicting = new Set<HotkeyAction>();
  const keyIcons = new Map<HotkeyAction, HTMLElement>();

  function startCapture(action: HotkeyAction): void {
    if (capturing !== null) endCapture();
    capturing = action;

    const icon = keyIcons.get(action);
    if (icon) {
      icon.classList.add('kc-capturing');
      icon.textContent = '. . .';
    }

    deps.setCaptureLock(true);
    window.addEventListener('keydown', onCaptureKey, true);
  }

  function endCapture(): void {
    if (capturing === null) return;
    capturing = null;
    window.removeEventListener('keydown', onCaptureKey, true);
    deps.setCaptureLock(false);
    refresh();
  }

  function onCaptureKey(event: KeyboardEvent): void {
    // Krunker binds most keys, so claim the event before anything else sees it.
    event.preventDefault();
    event.stopImmediatePropagation();

    const action = capturing;
    if (action === null) return;

    if (event.key === 'Escape') {
      endCapture();
      return;
    }

    const bind = eventToKeybind({
      key: event.key,
      control: event.ctrlKey,
      shift: event.shiftKey,
      alt: event.altKey,
    });
    // Null while only modifiers are down, so keep waiting for the real key.
    if (bind === null) return;

    commit(action, bind);
  }

  function commit(action: HotkeyAction, bind: Keybind): void {
    working = { ...working, [action]: bind };
    deps.onSave(working);
    endCapture();
  }

  function refresh(): void {
    conflicting = new Set(findConflicts(working).flat());
    for (const [action, icon] of keyIcons) {
      icon.classList.remove('kc-capturing');
      icon.classList.toggle('kc-clash', conflicting.has(action));
      icon.textContent = formatKeybind(working[action]);
    }
  }

  function buildRow(action: HotkeyAction): HTMLElement {
    const row = document.createElement('div');
    row.className = 'setting settName kc-keyrow';

    const title = document.createElement('span');
    title.className = 'setting-title';
    title.textContent = HOTKEY_LABELS[action];

    const wrapper = document.createElement('span');
    wrapper.className = 'setting-input-wrapper kc-keywrap';

    const icon = document.createElement('span');
    icon.className = 'keyIcon kc-keyicon';
    icon.textContent = formatKeybind(working[action]);
    // Resolved on hover, so a binding that starts conflicting after this row
    // was built still explains itself.
    attachTooltip(icon, () =>
      conflicting.has(action)
        ? 'Bound to more than one action. The first in this list wins.'
        : 'Click, then press the key you want. Escape cancels.',
    );
    icon.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      startCapture(action);
    });
    keyIcons.set(action, icon);

    const unbind = iconButton('delete_forever', 'kc-unbind', 'Unbind', () => {
      commit(action, { key: '', ctrl: false, shift: false, alt: false });
    });

    const reset = iconButton('restore', 'kc-reset', 'Reset to default', () => {
      commit(action, { ...DEFAULT_HOTKEYS[action] });
    });

    wrapper.append(icon, unbind, reset);
    row.append(title, wrapper);
    return row;
  }

  function iconButton(
    glyph: string,
    className: string,
    tooltip: string,
    onClick: () => void,
  ): HTMLElement {
    const el = document.createElement('span');
    el.className = `material-icons ${className}`;
    el.textContent = glyph;
    attachTooltip(el, tooltip);
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return el;
  }

  return {
    render(body) {
      // A re-render replaces the DOM these point at, so drop them or refresh()
      // writes into elements that aren't on the page any more.
      keyIcons.clear();
      working = { ...deps.getHotkeys() };
      for (const action of HOTKEY_ORDER) body.appendChild(buildRow(action));
      refresh();
    },

    cancel: endCapture,
  };
}
