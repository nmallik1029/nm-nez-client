import { SHEETS, STYLE_IDS, UI_IDS } from '../shared/ui';
import { defineStyle } from './style';

/**
 * Transient status messages.
 *
 * Krunker has its own notifications, but hooking those means depending on an
 * internal that moves around between updates. Our own element is a few lines
 * and can't break when the game changes.
 */

let element: HTMLDivElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function ensure(): HTMLDivElement | null {
  if (element) return element;
  if (!document.documentElement) return null;

  defineStyle(STYLE_IDS.toast, SHEETS.toast);

  element = document.createElement('div');
  element.id = UI_IDS.toast;

  document.documentElement.append(element);
  return element;
}

/** Show a message for `durationMs`. Text only, never parsed as markup. */
export function showToast(message: string, durationMs = 1800): void {
  const el = ensure();
  if (!el) return;

  el.textContent = message;
  el.classList.add('kc-show');

  if (hideTimer !== null) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    hideTimer = null;
    el.classList.remove('kc-show');
  }, durationMs);
}
