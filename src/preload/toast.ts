import { defineStyle } from './style';

/**
 * Transient status messages.
 *
 * Krunker has its own notifications, but hooking those means depending on an
 * internal that moves around between updates. Our own element is a few lines
 * and can't break when the game changes.
 */
const CSS = `
#kc-toast{position:fixed;left:50%;bottom:46px;transform:translateX(-50%) translateY(8px);
  z-index:2147483200;padding:8px 15px;border-radius:var(--nm-radius);
  background:var(--nm-toast-bg);border:1px solid var(--nm-toast-border);color:var(--nm-text);
  font-family:var(--nm-font);font-size:13px;line-height:1.2;
  pointer-events:none;opacity:0;transition:opacity .16s,transform .16s}
#kc-toast.kc-show{opacity:1;transform:translateX(-50%) translateY(0)}
`;

let element: HTMLDivElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function ensure(): HTMLDivElement | null {
  if (element) return element;
  if (!document.documentElement) return null;

  defineStyle('kc-toast-css', CSS);

  element = document.createElement('div');
  element.id = 'kc-toast';

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
