import { SHEETS, STYLE_IDS, UI_IDS } from '../../shared/ui';
import { defineStyle } from '../style';

/**
 * Shared hover tooltip.
 *
 * Not the native `title` attribute, which waits half a second, draws in the OS
 * theme and can't be styled. That's exactly the seam we're trying not to have
 * inside Krunker's UI.
 *
 * One element, reused for every target. A tooltip per row would mean hundreds
 * of absolutely-positioned nodes in the settings tree when only one is ever
 * on screen.
 */

const SHOW_DELAY_MS = 90;
const GAP_PX = 8;

/**
 * `--nm-font` is Krunker's own pixel face. It wants more line-height and no
 * letter-spacing compared to a normal UI font, and it has no real weight axis,
 * so font-weight buys nothing here and risks a synthesised bold.
 */

let tip: HTMLDivElement | null = null;
let showTimer: ReturnType<typeof setTimeout> | null = null;

function ensure(): HTMLDivElement | null {
  if (tip?.isConnected) return tip;
  if (!document.documentElement) return null;

  defineStyle(STYLE_IDS.tooltip, SHEETS.tooltip);

  tip = document.createElement('div');
  tip.id = UI_IDS.tooltip;

  document.documentElement.append(tip);
  return tip;
}

function place(target: HTMLElement, el: HTMLDivElement): void {
  const rect = target.getBoundingClientRect();

  // Measure before positioning. It has to be laid out to know its own size,
  // and reading that while hidden avoids a visible jump.
  el.style.left = '0px';
  el.style.top = '0px';
  const own = el.getBoundingClientRect();

  let left = rect.left;
  let top = rect.bottom + GAP_PX;

  // Flip above when there's no room below, then clamp into the viewport so a
  // row near an edge can't push it off screen.
  if (top + own.height > window.innerHeight - 4) top = rect.top - own.height - GAP_PX;
  if (top < 4) top = 4;
  if (left + own.width > window.innerWidth - 4) left = window.innerWidth - own.width - 4;
  if (left < 4) left = 4;

  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}

function hide(): void {
  if (showTimer !== null) {
    clearTimeout(showTimer);
    showTimer = null;
  }
  tip?.classList.remove('kc-tip-show');
}

/**
 * Show a tooltip when the pointer rests on `target`. `text` can be a function,
 * resolved at hover time, for content that changes after the element is built.
 * A keybind that later conflicts with another, for instance.
 */
export function attachTooltip(target: HTMLElement, text: string | (() => string)): void {
  if (text === '') return;
  target.classList.add('kc-tip-target');

  target.addEventListener('mouseenter', () => {
    if (showTimer !== null) clearTimeout(showTimer);
    // A short delay keeps it from strobing while the pointer sweeps down a
    // list of rows on its way somewhere else.
    showTimer = setTimeout(() => {
      showTimer = null;
      const resolved = typeof text === 'function' ? text() : text;
      if (resolved === '') return;
      const el = ensure();
      if (!el) return;
      el.textContent = resolved;
      place(target, el);
      el.classList.add('kc-tip-show');
    }, SHOW_DELAY_MS);
  });

  target.addEventListener('mouseleave', hide);
  // Clicking a row usually changes whatever the tooltip was describing, and
  // one left hanging over a toggle you just flipped looks stuck.
  target.addEventListener('mousedown', hide);
}

/** Hide right now. Call before tearing down the DOM it points at. */
export function hideTooltip(): void {
  hide();
}
