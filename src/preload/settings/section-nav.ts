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
 *  - The nav goes INSIDE `#settHolder`, never against the scroller's parent.
 *    The scroller can be several levels up — in the live game it resolved to a
 *    page-level wrapper, and positioning against that parent put the nav in
 *    the top-left corner of the page, over Krunker's own menu. A child of the
 *    holder cannot land outside the settings window whatever the scroller
 *    turns out to be. `position: sticky` still pins it, because sticky
 *    resolves against the nearest scrolling ancestor rather than the parent.
 */

const HOLDER_ID = 'settHolder';
/** Krunker's own class for a section header. Also what our categories use. */
const HEADER_CLASS = 'setHed';
/** Our collapsed-body marker, from the settings sheet. */
const COLLAPSED_CLASS = 'kc-setbod-collapsed';

/**
 * Everything in a section header that is not its name.
 *
 * Two kinds of passenger, and both ended up in the index before this list
 * existed:
 *
 *  - The collapse chevron is a `material-icons` ligature, so its text content
 *    is the ligature NAME (`keyboard_arrow_down`).
 *  - Krunker puts controls in some headers — the Controls tab's "Gameplay
 *    Settings" carries an All/dropdown — and their text ran straight into the
 *    label, giving entries that did not match any section on screen.
 *
 * Stripped by element rather than by matching strings, so a section genuinely
 * called "All Chat" keeps its name.
 */
const HEADER_PASSENGERS = [
  '.material-icons',
  '.plusOrMinus',
  'select',
  'option',
  'input',
  'button',
  'textarea',
  '.settingsBtn',
  '.switch',
  '.slider',
  '.setting-input-wrapper',
].join(',');

/**
 * Krunker's own restart/reload legend, which sits in a bare `<span>` inside the
 * header it applies to — the General tab's Localization heading reads
 * "Localization * requires restart" in the DOM. It cannot be matched by class
 * because it has none, so it is matched by what it says.
 */
const LEGEND = /^\s*\*?\s*requires?\s+(restart|reload)\s*$/i;

export function sectionLabel(header: Element): string {
  const clone = header.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(HEADER_PASSENGERS).forEach((el) => el.remove());
  clone.querySelectorAll('span').forEach((el) => {
    if (LEGEND.test(el.textContent ?? '')) el.remove();
  });
  return (clone.textContent ?? '')
    .replace(/\s+/g, ' ')
    // A header left with a dangling separator once its control is gone.
    .replace(/^[\s:·|/-]+|[\s:·|/-]+$/g, '')
    .trim();
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

/**
 * True when the scroller cannot go any further down.
 *
 * Without this the last sections are unreachable by the highlight: clicking
 * "Shortcuts" scrolls as far as it can, which stops short of that section's
 * own offset, so the reading line is still inside the section above and the
 * highlight snaps back to it the moment the scroll settles. At the bottom the
 * answer is always the last section, whatever the arithmetic says.
 *
 * The slack absorbs fractional scroll heights, which browsers report on
 * fractional device pixel ratios and at non-integer zoom.
 */
export function isAtEnd(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  slack = 2,
): boolean {
  return scrollTop + clientHeight >= scrollHeight - slack;
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
    host?.classList.remove('kc-has-sectnav');
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

    pin();

    const index = isAtEnd(scroller.scrollTop, scroller.clientHeight, scroller.scrollHeight)
      ? items.length - 1
      : activeIndex(tops, scroller.scrollTop);
    items.forEach((item, i) => item.classList.toggle('kc-sectnav-on', i === index));
  }

  /**
   * Hold the index at the top of whatever part of the holder is on screen.
   *
   * `position:sticky` did this until it didn't: it fails silently as soon as
   * any ancestor between the element and the scrolling box has
   * `overflow:hidden`, because that ancestor becomes the sticky context. The
   * settings window has one, so the index scrolled away with the rows.
   *
   * Doing it here works whichever element turns out to scroll. When the holder
   * IS the scroller its own `scrollTop` is the answer; when something above it
   * scrolls, the answer is how far that has scrolled past the holder's top.
   * Both are the same expression once the holder's offset inside the scrolled
   * content is known, and both clamp inside the holder, so the index cannot
   * ride out of the window.
   */
  function pin(): void {
    if (!nav || !scroller || !holderEl) return;

    const holderOffset =
      holderEl === scroller
        ? 0
        : holderEl.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top +
          scroller.scrollTop;

    // Only as tall as the visible part of the panel, so a long index scrolls
    // inside itself instead of running past the bottom of the window.
    nav.style.maxHeight = `${scroller.clientHeight}px`;

    /*
     * The travel limit comes from the scroller, not from the holder.
     *
     * It used to be `holder.clientHeight - nav.offsetHeight`, which sounds
     * right and is not: `#settHolder` has `overflow: visible`, so its own box
     * stays short while its rows spill out of it. Measured on the running
     * client that box was 478px against a 1590px scroll range, so the index
     * held for 216px and then rode away with everything else — which is
     * exactly what it looked like.
     *
     * The scroller can never be scrolled further than its own range, so this
     * bound does not normally bite. It is here so a bad measurement can't
     * translate the index off the end of the content.
     */
    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const limit = Math.max(0, maxScroll - holderOffset);
    const y = Math.min(Math.max(scroller.scrollTop - holderOffset, 0), limit);

    // A transform, not `top`. `top` needs the holder to be the containing
    // block, and the rule saying so lost to Krunker's own #settHolder rule on
    // specificity — so the offset was applied against the window and pushed
    // the index down the page instead of holding it still. A transform is
    // measured from the element's own layout position, which nothing above it
    // can take away.
    nav.style.transform = `translateY(${Math.round(y)}px)`;
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
    host = holder;

    /**
     * Mounted INSIDE the holder, never against the scroller's parent.
     *
     * The scroller can be an ancestor several levels up — in the live game it
     * resolved to a page-level wrapper — and positioning against that parent
     * put the whole nav in the top-left corner of the page, on top of
     * Krunker's own menu. A child of the holder cannot land outside the
     * settings window whatever the scroller turns out to be, which is the
     * property worth having when the surrounding DOM is not ours.
     *
     * Pinning still works: `position: sticky` resolves against the nearest
     * scrolling ancestor, not against the parent, so it holds whether the
     * holder scrolls itself or something above it does.
     */
    holder.classList.add('kc-has-sectnav');

    nav = document.createElement('div');
    nav.id = UI_IDS.sectionNav;

    items = headers.map((header, index) => {
      const item = document.createElement('div');
      item.className = 'kc-sectnav-item';
      const label = sectionLabel(header);
      item.textContent = label;
      // Long names wrap to a second line rather than being clipped, and the
      // full one is on hover either way — an index you cannot read the end of
      // is not much of an index.
      item.title = label;
      item.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        jump(header, index);
      });
      nav?.appendChild(item);
      return item;
    });

    holder.insertBefore(nav, holder.firstChild);

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
