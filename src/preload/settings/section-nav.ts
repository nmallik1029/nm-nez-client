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
 * Four things about the settings window shape this, each of them learned the
 * hard way from the running client rather than from reading Krunker's markup:
 *
 *  - `#settHolder` is rebuilt from scratch on every tab change and on every
 *    keystroke in the search box, so the nav is rebuilt from the DOM each time
 *    rather than held as state. `sync()` is cheap and idempotent.
 *  - The window is not laid out when Krunker's hooks fire. `#menuWindow`
 *    reports a height of zero at that moment, so anything that measures it
 *    then gets a useless answer. Hence the retries in `sync()`, and hence
 *    `scrollContainer()` not asking whether a box currently overflows.
 *  - The nav goes INSIDE `#settHolder`. The scroller is several levels up, and
 *    an earlier version positioned against ITS parent — which put the whole
 *    index in the top-left corner of the page, over Krunker's own menu. A
 *    child of the holder cannot land outside the settings window whatever the
 *    scroller turns out to be.
 *  - Nothing about where the index sits is derived from scroll arithmetic any
 *    more. `pin()` measures. Three versions computed it instead and each was
 *    wrong about something invisible — see the comment there.
 */

const HOLDER_ID = 'settHolder';
/** Krunker's own class for a section header. Also what our categories use. */
const HEADER_CLASS = 'setHed';
/** Our collapsed-body marker, from the settings sheet. */
const COLLAPSED_CLASS = 'kc-setbod-collapsed';

/** Retries while the settings window is still opening. About a second. */
const RETRY_LIMIT = 4;

/** Breathing room left above a section the index jumps to. Layout pixels. */
const LANDING_GAP = 12;

/**
 * Visual pixels per layout pixel inside the settings window.
 *
 * THIS IS THE ONE. Krunker scales its entire UI with a transform on #uiBase —
 * matrix(0.869) at the default UI scale, and it moves with the UI Scale
 * setting. getBoundingClientRect reports POST-transform pixels; scrollTop,
 * scrollBy and a translateY all take PRE-transform ones. Mixing the two is
 * why four separate attempts at this index landed short by a constant
 * fraction of however far they travelled — measured on the running client,
 * every jump ended up 13.1% of its own distance below where it was aimed,
 * and 1 - 0.869 = 0.131.
 *
 * Every place below that reads a rect and writes a scroll or a transform
 * divides by this.
 */
function uiScale(el: HTMLElement): number {
  const layout = el.offsetHeight;
  if (layout <= 0) return 1;
  const scale = el.getBoundingClientRect().height / layout;
  // A window still opening measures zero; 1 is the harmless answer.
  return scale > 0.01 ? scale : 1;
}

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

/**
 * The nearest scrolling ancestor, `start` included.
 *
 * Deliberately does NOT require the element to be overflowing right now. It
 * used to, and that made the index fail to appear at all on a cold open: the
 * settings window is measured while it is still coming up, when `#menuWindow`
 * reports a height of zero and therefore cannot overflow, so nothing scrollable
 * was found and the whole thing gave up until the next tab change.
 *
 * A box with `overflow-y: auto` is the scroller whether or not today's content
 * happens to fill it.
 */
function scrollContainer(start: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = start;
  while (el && el !== document.body) {
    const overflow = getComputedStyle(el).overflowY;
    if (overflow === 'auto' || overflow === 'scroll') return el;
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
  /**
   * The transform currently on the index, so `pin()` can recover its layout
   * position by subtracting it rather than by trusting a remembered offset.
   */
  let appliedY = 0;
  /** rAF handle for the pin loop that runs while a smooth scroll is playing. */
  let settleId: number | null = null;
  /** Retries left for a settings window that has not finished opening. */
  let retries = 0;
  /** The index's own height, refreshed by fit() rather than read per frame. */
  let navHeight = 0;
  /** Content height when `tops` was last taken; see paint(). */
  let measuredHeight = 0;

  function detach(): void {
    if (onScroll && scroller) scroller.removeEventListener('scroll', onScroll);
    onScroll = null;
    resize?.disconnect();
    resize = null;
    measuredHeight = 0;
    appliedY = 0;
    navHeight = 0;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    if (settleId !== null) cancelAnimationFrame(settleId);
    settleId = null;
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
    const scale = uiScale(scroller);
    const top = scroller.getBoundingClientRect().top;
    const { scrollTop } = scroller;
    // Rect difference is visual, scrollTop is layout, so the first is
    // converted before the two are added.
    return headers.map((h) =>
      Math.round(scrollTop + (h.getBoundingClientRect().top - top) / scale),
    );
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
   * Hold the index against the top of the visible panel.
   *
   * Measured, not derived. Three previous versions computed where the index
   * ought to go from scroll offsets — `position:sticky`, then `top` from
   * `scrollTop`, then a transform from `scrollTop` minus the holder's offset —
   * and each was wrong about something it could not see: an ancestor's
   * `overflow:hidden`, which element was the containing block, whether the
   * holder's own box reflected its content's height. Every one of those was a
   * belief about the surrounding DOM baked into arithmetic.
   *
   * This asks instead. It reads where the index actually is, works out where it
   * should be, and moves it by the difference. It does not care which element
   * scrolls, what the holder's overflow is, or what is positioned where — and
   * because it re-reads every frame, anything that knocks it out of place is
   * corrected on the next one rather than accumulating.
   *
   * The two bounds are the ones that matter: never above its own resting place
   * (so it does not climb into the tab strip), and never past the bottom of the
   * holder (so it does not trail below the last setting).
   */
  function pin(): void {
    if (!nav || !scroller || !holderEl) return;

    // Undo the transform we last applied to recover the layout position. Doing
    // it this way rather than remembering an offset means an outside change —
    // a re-render, a resize, Krunker moving the panel — is absorbed instead of
    // drifting.
    // Everything here is read from rects, so it is all in visual pixels; the
    // transform we write is not, hence the scale at the end.
    const scale = uiScale(scroller);
    const layoutTop = nav.getBoundingClientRect().top - appliedY * scale;

    const viewportTop = scroller.getBoundingClientRect().top;
    const holderBottom = holderEl.getBoundingClientRect().bottom;
    const lowest = Math.max(layoutTop, holderBottom - navHeight * scale);

    const target = Math.min(Math.max(viewportTop, layoutTop), lowest);
    const next = Math.round((target - layoutTop) / scale);

    // Only write when it actually moves. This runs every frame for the length
    // of a jump, and an unchanged style write still costs a style recalc.
    if (next === appliedY) return;
    appliedY = next;
    nav.style.transform = `translateY(${appliedY}px)`;
  }

  /**
   * Size the index to the visible panel, so a long one scrolls inside itself
   * rather than running past the bottom of the window.
   *
   * Separate from `pin()` because that runs every frame during a jump, and
   * writing a style then reading `offsetHeight` back forces a synchronous
   * layout each time. This only has to happen when the panel's size changes.
   */
  function fit(): void {
    if (!nav || !scroller) return;
    nav.style.maxHeight = `${scroller.clientHeight}px`;
    navHeight = nav.offsetHeight;
  }

  /**
   * Keep pinning for the length of a smooth scroll.
   *
   * `scroll` events are coalesced and are not guaranteed once per frame, so
   * during the animation `scrollTo` starts the index is repositioned less often
   * than the content moves — which looks exactly like the index sliding down
   * the page as you click an entry. Driving it from rAF instead holds it still
   * for the whole animation, and stops once the scroll has settled so nothing
   * runs per-frame while you are only reading.
   */
  function pinUntilSettled(): void {
    if (settleId !== null) cancelAnimationFrame(settleId);

    let last = Number.NaN;
    let stillFor = 0;
    let frames = 0;

    const step = (): void => {
      settleId = null;
      if (!scroller || !nav) return;

      pin();

      const now = scroller.scrollTop;
      stillFor = now === last ? stillFor + 1 : 0;
      last = now;
      frames += 1;

      // Settled once it has not moved for a few frames. The frame cap is the
      // backstop for a scroll that never arrives — a target already in view,
      // or a browser that ignores the request.
      if (stillFor < 4 && frames < 120) settleId = requestAnimationFrame(step);
    };

    settleId = requestAnimationFrame(step);
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

    // Re-measure: expanding one section moves every section below it. The
    // highlight reads these; the scroll below no longer does.
    tops = measure(headersIn(holderEl));

    /**
     * Move the scroller by the gap between where the header is and where it
     * should be. Relative, so no box model comes into it.
     *
     * Two wrong answers came before this one, and both are worth keeping:
     *
     *  - An absolute scrollTo, computed as the header's rect against the
     *    scroller's rect plus its scrollTop. Every term there has to agree
     *    about which box is which — rects are border boxes, scrollTop counts
     *    from the padding box, and #menuWindow carries 20px of padding — so it
     *    landed short by whatever sat between them.
     *  - scrollIntoView, which is right about all of that and still wrong
     *    here: it scrolls EVERY scrollable ancestor, so it took the document
     *    with it and pushed the whole game off the top of the window.
     *
     * scrollBy on the scroller itself can do neither. Both rects are read in
     * viewport coordinates in the same frame, so their difference is exactly
     * how far this one box has to move, and nothing else is touched.
     */
    const scale = uiScale(scroller);
    const visual = header.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollBy({ top: visual / scale - LANDING_GAP, behavior: 'smooth' });

    // Hold the index still for the length of the animation. Without this it is
    // only repositioned when a scroll event happens to arrive, which is less
    // often than the content moves — and that reads as the index sliding down
    // the page every time you click an entry.
    pinUntilSettled();

    items.forEach((item, i) => item.classList.toggle('kc-sectnav-on', i === index));
  }

  function headersIn(root: HTMLElement | null): HTMLElement[] {
    if (!root) return [];
    return [...root.querySelectorAll<HTMLElement>(`.${HEADER_CLASS}`)].filter(
      (h) => sectionLabel(h) !== '',
    );
  }

  /**
   * Try again shortly, for a settings window that has not finished opening.
   *
   * `sync()` runs off Krunker's own hooks, which fire before the window has
   * laid out — measured on the running client, `#menuWindow` reports a height
   * of zero at that point and the rows are not in yet. One attempt therefore
   * misses, and with nothing to try again the index simply never appears until
   * something else happens to trigger a re-render. A handful of retries covers
   * the opening animation without leaving a timer running afterwards.
   */
  function retrySoon(): void {
    if (retries <= 0) return;
    retries -= 1;
    setTimeout(sync, 250);
  }

  function sync(): void {
    const holder = document.getElementById(HOLDER_ID);
    if (!holder) {
      detach();
      retrySoon();
      return;
    }

    const found = scrollContainer(holder);
    const headers = headersIn(holder);

    // One section is not an index, and a panel with nothing to scroll does not
    // need one. Either way, leave the settings window exactly as it was — and
    // try again shortly, because "not yet" and "never" look the same here.
    if (!found || headers.length < 2) {
      detach();
      retrySoon();
      return;
    }

    detach();
    retries = 0;
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
     * Pinning does not depend on that choice: `pin()` measures where the index
     * ended up and moves it, so it holds whether the holder scrolls itself or
     * something above it does.
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

    // fit() before measure(), not after: it sets the index's max-height, and
    // the index is a float in the holder, so sizing it can move the very
    // headers we are about to record the positions of.
    fit();
    tops = measure(headers);
    measuredHeight = scroller.scrollHeight;
    onScroll = schedulePaint;
    scroller.addEventListener('scroll', onScroll, { passive: true });

    /**
     * Nudge a repaint when the panel itself is resized. paint() re-measures
     * if the content height actually moved, so this only has to say "look
     * again" rather than work out what changed.
     */
    resize = new ResizeObserver(() => {
      fit();
      schedulePaint();
    });
    resize.observe(scroller);

    paint();
  }

  return {
    sync() {
      // Armed on every call rather than once, because each hook that calls
      // sync is a fresh chance for the window to still be opening.
      retries = RETRY_LIMIT;
      sync();
    },
    destroy: detach,
  };
}
