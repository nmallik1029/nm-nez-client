import { SHEETS, STYLE_IDS, UI_IDS } from '../../shared/ui';
import { defineStyle } from '../style';

/**
 * A section index down the left of the settings window.
 *
 * The Client tab is long — Performance, Content, Matchmaker with its map grid,
 * Chat, Customisation, Themes, Shortcuts — and Krunker's own Render and Game
 * tabs are longer. Finding one setting meant scrolling past everything above
 * it and, if you overshot, scrolling back. This lists the sections, jumps to
 * one on click, and highlights whichever you are looking at.
 *
 * Built from `.setHed` elements rather than from our own list of categories,
 * so it works on Krunker's tabs too. Those are the tabs that need it most, and
 * a nav that appears on one tab and not the others reads as broken.
 *
 * Three things about the settings window shape this:
 *
 *  - `#settHolder` is rebuilt from scratch on every tab change and on every
 *    keystroke in the search box, so the nav is rebuilt from the DOM each time
 *    rather than held as state. `sync()` is cheap and idempotent.
 *  - Which element scrolls is not ours to decide and has moved before, so it
 *    is found at runtime by walking up from the holder. If nothing scrollable
 *    turns up, the nav simply doesn't appear — a settings panel with no index
 *    is the status quo, a broken one is not.
 *  - The nav is a sibling of the scroll container, not a child of it. Inside,
 *    it would scroll away with the content; outside, `position:absolute`
 *    against a `position:relative` parent pins it with no scroll handler.
 */

const HOLDER_ID = 'settHolder';
/** Krunker's own class for a section header. Also what our categories use. */
const HEADER_CLASS = 'setHed';
/** Our collapsed-body marker, from the settings sheet. */
const COLLAPSED_CLASS = 'kc-setbod-collapsed';

/**
 * Krunker's headers carry a `material-icons` chevron whose text content is the
 * ligature name (`keyboard_arrow_down`), which would otherwise land in the
 * label. Stripping by element rather than by string, so a section legitimately
 * containing those words keeps them.
 */
export function sectionLabel(header: Element): string {
  const clone = header.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.material-icons, .plusOrMinus').forEach((el) => el.remove());
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Which section a given scroll position is inside.
 *
 * `tops` are section offsets in scroll coordinates, ascending. The last one at
 * or above the reading line wins, so the highlight changes as a header reaches
 * the top rather than when it leaves the viewport.
 *
 * Returns -1 for an empty list. Pure, so it is the part that gets tested.
 */
export function activeIndex(tops: readonly number[], scrollTop: number, lookahead = 24): number {
  if (tops.length === 0) return -1;
  let active = 0;
  for (let i = 0; i < tops.length; i++) {
    if (tops[i]! - lookahead <= scrollTop) active = i;
    else break;
  }
  return active;
}

/** The nearest scrollable ancestor, `start` included. */
function scrollContainer(start: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = start;
  while (el && el !== document.body) {
    const overflow = getComputedStyle(el).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

export interface SectionNav {
  /** Rebuild from whatever is in the holder now. Safe to call repeatedly. */
  sync(): void;
  /** Remove the nav and stop listening. */
  destroy(): void;
}

export function createSectionNav(): SectionNav {
  defineStyle(STYLE_IDS.sectionNav, SHEETS.sectionNav);

  let nav: HTMLElement | null = null;
  let scroller: HTMLElement | null = null;
  /** The element the nav is positioned against. */
  let host: HTMLElement | null = null;
  /** Headers are always looked up here, never in the scroller, which may be an
   * ancestor holding markup that is not part of this tab. */
  let holderEl: HTMLElement | null = null;
  let items: HTMLElement[] = [];
  let tops: number[] = [];
  let onScroll: (() => void) | null = null;
  let rafId: number | null = null;
  let resize: ResizeObserver | null = null;
  /** Content height when `tops` was last taken; see paint(). */
  let measuredHeight = 0;

  function detach(): void {
    if (onScroll && scroller) scroller.removeEventListener('scroll', onScroll);
    onScroll = null;
    resize?.disconnect();
    resize = null;
    measuredHeight = 0;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    scroller?.classList.remove('kc-has-sectnav');
    host?.classList.remove('kc-sectnav-host');
    scroller = null;
    host = null;
    holderEl = null;
    nav?.remove();
    nav = null;
    items = [];
    tops = [];
  }

  /**
   * Offsets of each header in the scroller's scroll coordinates.
   *
   * Measured against the scroller rather than read from `offsetTop`, which is
   * relative to whichever ancestor happens to be positioned and is wrong as
   * soon as anything between them gains a `position`.
   */
  function measure(headers: HTMLElement[]): number[] {
    if (!scroller) return [];
    const base = scroller.getBoundingClientRect().top - scroller.scrollTop;
    return headers.map((h) => Math.round(h.getBoundingClientRect().top - base));
  }

  function paint(): void {
    rafId = null;
    if (!scroller) return;

    /**
     * Re-measure whenever the content has changed height since last time.
     *
     * The Matchmaker section's map grid loads its thumbnails from Krunker's
     * CDN after the panel is already up, and every section below it moves when
     * they land. Checking here rather than observing for it covers every cause
     * — images, a section being collapsed, the window being resized — with one
     * cheap comparison, and it runs at the only moment the answer is read.
     */
    if (scroller.scrollHeight !== measuredHeight) {
      measuredHeight = scroller.scrollHeight;
      tops = measure(headersIn(holderEl));
    }

    const index = activeIndex(tops, scroller.scrollTop);
    items.forEach((item, i) => item.classList.toggle('kc-sectnav-on', i === index));
  }

  function schedulePaint(): void {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(paint);
  }

  function jump(header: HTMLElement, index: number): void {
    if (!scroller) return;

    // A nav entry for a collapsed section should show it, not just park the
    // header at the top of an empty gap.
    const body = header.nextElementSibling;
    if (body?.classList.contains(COLLAPSED_CLASS)) header.click();

    // Re-measure: expanding one section moves every section below it.
    tops = measure(headersIn(holderEl));

    const top = tops[index];
    if (top === undefined) return;
    scroller.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' });
    items.forEach((item, i) => item.classList.toggle('kc-sectnav-on', i === index));
  }

  function headersIn(root: HTMLElement | null): HTMLElement[] {
    if (!root) return [];
    return [...root.querySelectorAll<HTMLElement>(`.${HEADER_CLASS}`)].filter(
      (h) => sectionLabel(h) !== '',
    );
  }

  function sync(): void {
    const holder = document.getElementById(HOLDER_ID);
    if (!holder) {
      detach();
      return;
    }

    const found = scrollContainer(holder);
    const headers = headersIn(holder);

    // One section is not an index, and a panel that can't scroll doesn't need
    // one either. Either way, leave the settings window exactly as it was.
    if (!found || headers.length < 2) {
      detach();
      return;
    }

    detach();
    scroller = found;

    holderEl = holder;
    host = scroller.parentElement;
    if (!host) {
      scroller = null;
      holderEl = null;
      return;
    }
    host.classList.add('kc-sectnav-host');
    scroller.classList.add('kc-has-sectnav');

    nav = document.createElement('div');
    nav.id = UI_IDS.sectionNav;

    items = headers.map((header, index) => {
      const item = document.createElement('div');
      item.className = 'kc-sectnav-item';
      item.textContent = sectionLabel(header);
      item.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        jump(header, index);
      });
      nav?.appendChild(item);
      return item;
    });

    host.insertBefore(nav, scroller);

    tops = measure(headers);
    measuredHeight = scroller.scrollHeight;
    onScroll = schedulePaint;
    scroller.addEventListener('scroll', onScroll, { passive: true });

    /**
     * Nudge a repaint when the panel itself is resized. paint() re-measures
     * if the content height actually moved, so this only has to say "look
     * again" rather than work out what changed.
     */
    resize = new ResizeObserver(schedulePaint);
    resize.observe(scroller);

    paint();
  }

  return { sync, destroy: detach };
}
