import { SHEETS, STYLE_IDS, UI_IDS } from '../../shared/ui';
import { defineStyle } from '../style';

/**
 * A section index down the left of the settings window.
 *
 * Clicking a section SHOWS that section and hides the rest. It does not scroll
 * to it.
 *
 * That distinction is the whole design, and it arrived after four attempts at
 * the scrolling version. Krunker's settings are one long column, so an index
 * that jumps has to answer three questions every time you touch it: where is
 * that section in scroll coordinates, how do I hold the index still while the
 * content moves under it, and which entry should be lit right now. Each of
 * those was wrong at least once, and the last of them cannot be right at all —
 * an element inside a scrolling box that corrects its own position is a frame
 * behind by construction, which is exactly what the sliding was.
 *
 * Showing one section at a time answers none of those questions, because it
 * never asks them. There is nothing to scroll to, nothing to keep in place,
 * and the lit entry is simply the one you clicked. Roughly two hundred lines
 * of measuring went away with it, along with every bug they carried.
 *
 * What is left is still shaped by the running client:
 *
 *  - `#settHolder` is rebuilt from scratch on every tab change and on every
 *    keystroke in the search box, so this is rebuilt from the DOM each time
 *    rather than held as state. `sync()` is cheap and idempotent.
 *  - The window is not laid out when Krunker's hooks fire — `#menuWindow`
 *    reports a height of zero at that moment — hence the retries.
 *  - The index is mounted OUTSIDE the scrolling box. Inside it, it scrolls
 *    with the content, and `position:fixed` does not save it either, because
 *    `#menuWindow` centres itself with a transform and a transformed ancestor
 *    becomes the containing block for fixed descendants.
 *  - Searching filters rows across every section, so while there is a query
 *    the whole column is shown and the index steps aside.
 */

const HOLDER_ID = 'settHolder';
/** Krunker's own class for a section header. Also what our categories use. */
const HEADER_CLASS = 'setHed';

/** Retries while the settings window is still opening. About a second. */
const RETRY_LIMIT = 4;

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
  '.material-icons-outlined',
  '.plusOrMinus',
  'select',
  'option',
  'input',
  'button',
  'textarea',
  '.settingsBtn',
  '.switch',
  '.switchsml',
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
 * Which run of children belongs to each section.
 *
 * The holder is a flat list — header, its rows, the next header, its rows —
 * with no element wrapping a section, so a section is a RANGE rather than a
 * subtree. `end` is exclusive. Anything before the first header belongs to no
 * section and is left alone, which is what keeps Krunker's own preamble in
 * place.
 *
 * Pure, so it is the part that gets tested.
 */
export function sectionRanges(isHeader: readonly boolean[]): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  for (let i = 0; i < isHeader.length; i++) {
    if (isHeader[i] !== true) continue;
    let end = i + 1;
    while (end < isHeader.length && isHeader[end] !== true) end += 1;
    out.push({ start: i, end });
  }
  return out;
}

/**
 * The nearest scrolling ancestor, `start` included.
 *
 * Deliberately does NOT require the element to be overflowing right now. It
 * used to, and that made the index fail to appear at all on a cold open: the
 * settings window is measured while it is still coming up, when `#menuWindow`
 * reports a height of zero and therefore cannot overflow, so nothing scrollable
 * was found and the whole thing gave up until the next tab change.
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

/**
 * Visual pixels per layout pixel inside the settings window.
 *
 * Krunker scales its entire UI with a transform on `#uiBase` — matrix(0.869)
 * at the default UI Scale. `getBoundingClientRect` reports POST-transform
 * pixels while `top`/`left` are written in PRE-transform ones, so placing the
 * index means converting between them.
 */
function uiScale(el: HTMLElement): number {
  const layout = el.offsetHeight;
  if (layout <= 0) return 1;
  const scale = el.getBoundingClientRect().height / layout;
  return scale > 0.01 ? scale : 1;
}

/** True while the settings search box has something in it. */
function searching(root: HTMLElement): boolean {
  for (const input of root.querySelectorAll<HTMLInputElement>('input')) {
    const kind = `${input.placeholder} ${input.id} ${input.className}`.toLowerCase();
    if (!kind.includes('search')) continue;
    if (input.value.trim() !== '') return true;
  }
  return false;
}

export interface SectionNav {
  /** Rebuild from whatever is in the holder now. Safe to call repeatedly. */
  sync(): void;
  /** Remove the nav and stop listening. */
  destroy(): void;
}

export function createSectionNav(): SectionNav {
  let nav: HTMLDivElement | null = null;
  let items: HTMLElement[] = [];
  let groups: HTMLElement[][] = [];
  let scroller: HTMLElement | null = null;
  let host: HTMLElement | null = null;
  let resize: ResizeObserver | null = null;
  let retries = RETRY_LIMIT;
  /** Layout px from the scroller's top edge to where the settings start. */
  let holderTopInset = 0;
  /** Remembered by name, because a rebuild hands back different elements. */
  let openLabel = '';
  /**
   * Each element's own inline display, as Krunker left it.
   *
   * Krunker hides the sections that do not apply to you with an inline
   * display:none — KPD and Developer on the General tab. Showing a section by
   * blanking inline display therefore un-hid whichever of those had been
   * swept into its range, and they reappeared under the section above them.
   * Putting back what was there instead of clearing it keeps their hiding
   * intact.
   */
  const originalDisplay = new Map<HTMLElement, string>();

  function detach(): void {
    resize?.disconnect();
    resize = null;
    host?.classList.remove('kc-has-sectnav');
    // Anything hidden stays hidden without this, and Krunker reuses the nodes.
    for (const group of groups) {
      for (const el of group) {
        const was = originalDisplay.get(el);
        if (was === undefined || was === '') el.style.removeProperty('display');
        else el.style.display = was;
      }
    }
    originalDisplay.clear();
    scroller = null;
    host = null;
    nav?.remove();
    nav = null;
    items = [];
    groups = [];
  }

  /**
   * Put the index beside the panel.
   *
   * Parked at 0,0 first so where that landed can be measured, then moved by
   * the difference. The containing block is whatever it is — this does not
   * need to know, which is what stops it repeating the version that ended up
   * in the corner of the page.
   */
  function place(): void {
    if (!nav || !scroller) return;
    const scale = uiScale(scroller);
    nav.style.top = '0px';
    nav.style.left = '0px';
    const origin = nav.getBoundingClientRect();
    const panel = scroller.getBoundingClientRect();
    nav.style.left = `${(panel.left - origin.left) / scale}px`;
    nav.style.top = `${(panel.top - origin.top) / scale + Math.max(0, holderTopInset)}px`;
  }

  function fit(): void {
    if (!nav || !scroller) return;
    // A window still opening measures zero, and writing max-height:0 then
    // leaves the index invisible until something else happens to resize it.
    if (scroller.clientHeight <= 0) return;
    nav.style.maxHeight = `${scroller.clientHeight}px`;
  }

  /** Show one section and hide the others. `-1` shows everything. */
  function show(index: number): void {
    groups.forEach((group, i) => {
      const on = index < 0 || i === index;
      for (const el of group) {
        if (!on) {
          el.style.display = 'none';
          continue;
        }
        const was = originalDisplay.get(el);
        if (was === undefined || was === '') el.style.removeProperty('display');
        else el.style.display = was;
      }
    });
    items.forEach((item, i) => item.classList.toggle('kc-sectnav-on', i === index));
    if (index >= 0) openLabel = items[index]?.textContent ?? '';
    if (scroller) scroller.scrollTop = 0;
    fit();
    place();
  }

  function sync(): void {
    const holder = document.getElementById(HOLDER_ID);
    if (!holder) {
      detach();
      retrySoon();
      return;
    }

    const found = scrollContainer(holder);
    const children = [...holder.children] as HTMLElement[];
    // Krunker hides sections that do not apply to you — KPD and Developer on
    // the General tab, for instance — and an index that lists them offers
    // pages with nothing on them. Read before anything is hidden here, which
    // is why detach() puts every display back first.
    const isHeader = children.map(
      (el) =>
        el.classList.contains(HEADER_CLASS) &&
        sectionLabel(el) !== '' &&
        getComputedStyle(el).display !== 'none',
    );
    const ranges = sectionRanges(isHeader);

    // One section is not an index. Leave the window exactly as it was — and
    // try again shortly, because "not yet" and "never" look the same here.
    if (!found || ranges.length < 2) {
      detach();
      retrySoon();
      return;
    }

    detach();
    retries = 0;
    scroller = found;
    host = holder;
    holder.classList.add('kc-has-sectnav');

    groups = ranges.map((r) => children.slice(r.start, r.end));
    // Recorded before anything here touches them.
    for (const group of groups) for (const el of group) originalDisplay.set(el, el.style.display);

    nav = document.createElement('div');
    nav.id = UI_IDS.sectionNav;

    items = ranges.map((range, index) => {
      const header = children[range.start];
      const item = document.createElement('div');
      item.className = 'kc-sectnav-item';
      const label = header ? sectionLabel(header) : '';
      item.textContent = label;
      // Long names wrap rather than being clipped, and the full one is on
      // hover either way — an index you cannot read the end of is not much of
      // an index.
      item.title = label;
      item.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        show(index);
      });
      nav?.appendChild(item);
      return item;
    });

    // Outside the scroller, so it cannot scroll with the content. See the note
    // at the top of the file for why inside never worked.
    (scroller.parentElement ?? document.body).appendChild(nav);

    holderTopInset =
      (holder.getBoundingClientRect().top - scroller.getBoundingClientRect().top) /
        uiScale(scroller) +
      scroller.scrollTop;

    // A query filters rows across every section, so hiding all but one would
    // hide most of the results.
    const wanted = searching(scroller)
      ? -1
      : Math.max(
          0,
          items.findIndex((item) => item.textContent === openLabel),
        );
    show(wanted);

    resize = new ResizeObserver(() => {
      fit();
      place();
    });
    resize.observe(scroller);
  }

  /**
   * Try again shortly, for a settings window that has not finished opening.
   *
   * `sync()` runs off Krunker's own hooks, which fire before the window has
   * laid out — measured on the running client, `#menuWindow` reports a height
   * of zero at that point and the rows are not in yet.
   */
  function retrySoon(): void {
    if (retries <= 0) return;
    retries -= 1;
    setTimeout(sync, 250);
  }

  defineStyle(STYLE_IDS.sectionNav, SHEETS.sectionNav);

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
