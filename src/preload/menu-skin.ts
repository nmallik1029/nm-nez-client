import { BRANDING } from '../shared/branding';
import { CHANGELOG } from '../shared/changelog';
import { SHEETS, STYLE_IDS, UI_IDS } from '../shared/ui';
import { toggleStyle } from './style';

/**
 * The main-menu skin: one stylesheet, one backdrop element, one moved button.
 *
 * Almost all of it is CSS, which is the whole design of this module. A skin
 * that is a stylesheet toggles in one assignment, costs nothing per frame, and
 * cannot leave the menu in a half-applied state — which matters on a client
 * whose entire reason to exist is frame pacing. The two things CSS genuinely
 * cannot do are the parts that live here:
 *
 *   - the backdrop, because Krunker has no element in the right place to hang
 *     three gradients on, and
 *   - Alt Manager, because moving it into the header is a DOM move, not a
 *     restyle.
 *
 * Both are reversible, so turning the skin off puts the menu back exactly as
 * the game shipped it rather than leaving debris behind.
 */

const SCRIM_ID = UI_IDS.menuScrim;
const MARK_ID = UI_IDS.menuMark;
/** Same source the in-game watermark uses, so the two cannot disagree. */
const VERSION = CHANGELOG[0]?.version ?? '';
/** Krunker's own left menu list; the wordmark goes in at the top of it. */
const NAV_ID = 'menuItemContainer';
/**
 * Contact / Terms / Changelog, bottom right, under everything else.
 *
 * NOT `#baseLinks` — that one ships empty and lives inside the ad holder.
 * These are spans, not anchors:
 *
 *   #termsInfo > span.terms x3
 *
 * which is why a querySelectorAll('a') over the wrong container found
 * nothing at all and this silently did nothing on first release.
 */
const FOOTER_ID = 'termsInfo';
/** Footer links that go away. Compared lowercased against link text. */
const FOOTER_HIDDEN = ['contact', 'terms'];
/** The one footer link that moves up beside More Krunker instead. */
const FOOTER_MOVED = 'changelog';
/** Marks the moved link so the sheet can style it as a header item. */
const HEADER_LINK_CLASS = 'kc-menu-headerlink';
/**
 * More Krunker's icon. Material icons carry their ligature name as text
 * content, which is also the only way to tell the two header nav items apart
 * — neither has an id and their classes are Svelte-hashed and identical.
 */
const MORE_KRUNKER_ICON = 'travel_explore';

/** Where the Changelog link came from, so turning the skin off puts it back. */
let footerHome: { parent: Element; nextSibling: ChildNode | null } | null = null;
const ALT_ID = UI_IDS.altManagerButton;
/** Krunker's menu root. Static markup, so it survives its own re-renders. */
const HOLDER_ID = 'menuHolder';
/** Where the class card keeps Loadout and Customize; Alt Manager's home. */
const CLASS_ROW_ID = UI_IDS.classButtonRow;
const CLASS_CONTAINER_ID = 'menuClassContainer';
/**
 * Where Alt Manager goes: the left end of the top bar, beside Login or
 * Register, so the client's own controls sit together rather than being
 * mixed in with Krunker's nav on the right.
 *
 * The signed-out bar is the usual case. Signed in, Krunker renders a
 * different bar, so the header itself is the fallback and the button lands at
 * its left end either way.
 */
const HEADER_LEFT_SELECTORS = ['#signedOutHeaderBar', '#playerHeaderEl'];

function headerHome(): Element | null {
  for (const selector of HEADER_LEFT_SELECTORS) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return null;
}

let enabled = false;
let observer: MutationObserver | null = null;

/** Put the backdrop in, or take it out. */
function placeScrim(): void {
  const existing = document.getElementById(SCRIM_ID);

  if (!enabled) {
    existing?.remove();
    return;
  }

  const holder = document.getElementById(HOLDER_ID);
  if (!holder) return;
  // Already first child of the right parent; nothing to do on the common pass.
  if (existing?.parentElement === holder && holder.firstChild === existing) return;

  const scrim = existing ?? document.createElement('div');
  scrim.id = SCRIM_ID;
  // First child so it sits under everything the menu draws, and so a
  // re-insert after a rebuild lands in the same place.
  holder.insertBefore(scrim, holder.firstChild);
}

/**
 * Alt Manager belongs beside Settings and More Krunker, not stacked under the
 * class card.
 *
 * `querySelectorAll` rather than `getElementById` on purpose: if Krunker
 * rebuilds the class card while ours is parked in the header, `menu-buttons`
 * builds a second one, and two elements share the id. Keeping the first and
 * dropping the rest is what stops them accumulating.
 */
function placeAltManager(): void {
  const all = document.querySelectorAll<HTMLElement>(`#${ALT_ID}`);
  const alt = all[0];
  if (!alt) return;
  all.forEach((duplicate, index) => {
    if (index > 0) duplicate.remove();
  });

  if (enabled) {
    const header = headerHome();
    if (!header || alt.parentElement === header) return;
    // menu-buttons copies Krunker's 449px button rule onto this element as an
    // inline style. The sheet overrides what matters with !important, but
    // clearing it first keeps devtools honest about where the size comes from.
    alt.style.cssText = '';
    header.appendChild(alt);
    return;
  }

  // Off: back under Loadout and Customize, where menu-buttons put it.
  const row = document.getElementById(CLASS_ROW_ID);
  if (row?.nextElementSibling === alt) return;
  if (row) {
    row.insertAdjacentElement('afterend', alt);
    return;
  }
  const container = document.getElementById(CLASS_CONTAINER_ID);
  if (container && alt.parentElement !== container) container.appendChild(alt);
}

/**
 * Client wordmark and version above Krunker's menu list.
 *
 * Goes inside the list rather than before it: the list is positioned by
 * Krunker's own (Svelte-hashed) CSS, so a sibling inserted ahead of it lands
 * at the top-left of the containing block instead of above the rail. As its
 * first child it simply flows with the rows.
 *
 * The changelog row also inserts itself at the front, so on a rebuild the two
 * can briefly swap. Both re-run from the same observer and settle with the
 * wordmark on top.
 */
function placeMark(): void {
  const existing = document.getElementById(MARK_ID);

  if (!enabled) {
    existing?.remove();
    return;
  }

  const nav = document.getElementById(NAV_ID);
  if (!nav) return;
  if (existing?.parentElement === nav && nav.firstChild === existing) return;

  const mark = existing ?? document.createElement('div');
  if (!existing) {
    mark.id = MARK_ID;
    const name = document.createElement('b');
    // The slash is the one piece of colour in the wordmark, and GameFont has
    // a slash where it has no ampersand.
    const [before, after] = BRANDING.productName.split('/');
    name.append(before ?? BRANDING.productName);
    if (after !== undefined) {
      const slash = document.createElement('i');
      slash.textContent = '/';
      name.append(slash, after);
    }
    const version = document.createElement('span');
    version.textContent = VERSION;
    mark.append(name, version);
  }
  nav.insertBefore(mark, nav.firstChild);
}

/**
 * Krunker's footer links.
 *
 * Contact and Terms go; Changelog moves up beside More Krunker. That empties
 * the strip along the bottom of the screen, which is what lets the command bar
 * sit on the floor instead of stopping 139px short of it.
 *
 * Matched on link text rather than position, because nth-child would silently
 * hide the wrong two the day Krunker adds a link.
 */
function placeFooterLinks(): void {
  const links = document.getElementById(FOOTER_ID);
  if (!links) return;

  // Every leaf under the container, whatever tag it turns out to be. Matching
  // the text rather than a position or a tag is what survives Krunker
  // reordering these or changing what they are made of.
  const leaves = [...links.querySelectorAll<HTMLElement>('*')].filter(
    (el) => el.childElementCount === 0,
  );
  const textOf = (el: HTMLElement): string => (el.textContent ?? '').trim().toLowerCase();

  for (const link of leaves) {
    if (!FOOTER_HIDDEN.includes(textOf(link))) continue;
    if (enabled) link.style.display = 'none';
    else link.style.removeProperty('display');
  }

  const moved = [...document.querySelectorAll<HTMLElement>(`.${HEADER_LINK_CLASS}`)][0];
  const source = moved ?? leaves.find((el) => textOf(el) === FOOTER_MOVED);
  if (!source) return;

  if (enabled) {
    const header = document.querySelector('.headerBarRight');
    if (!header || source.parentElement === header) return;
    if (!footerHome && source.parentElement) {
      footerHome = { parent: source.parentElement, nextSibling: source.nextSibling };
    }
    source.classList.add(HEADER_LINK_CLASS);
    header.appendChild(source);
    return;
  }

  source.classList.remove(HEADER_LINK_CLASS);
  if (footerHome?.parent.isConnected) {
    footerHome.parent.insertBefore(source, footerHome.nextSibling);
    footerHome = null;
  }
}

/** More Krunker keeps its label; the globe beside it goes. */
function placeMoreKrunkerIcon(): void {
  for (const icon of document.querySelectorAll<HTMLElement>(
    '#playerHeaderEl .headerBarRight [class*="nav-mat-icon"]',
  )) {
    if ((icon.textContent ?? '').trim() !== MORE_KRUNKER_ICON) continue;
    if (enabled) icon.style.display = 'none';
    else icon.style.removeProperty('display');
  }
}

function apply(): void {
  placeScrim();
  placeMark();
  placeAltManager();
  placeFooterLinks();
  placeMoreKrunkerIcon();
}

/**
 * Turn the skin on or off. Takes effect immediately — no reload, because
 * everything it does is a stylesheet and two element moves.
 */
export function setMenuSkin(on: boolean): void {
  enabled = on;
  toggleStyle(STYLE_IDS.menuSkin, SHEETS.menuSkin, on);
  apply();
}

/**
 * Krunker rebuilds its menu markup as you navigate, same as its settings
 * window, so anything injected once is gone the first time you open a submenu
 * and come back. The observer puts it back.
 *
 * Installed once and left running even while the skin is off, because the
 * "off" path is what restores Alt Manager after a rebuild recreates it. Both
 * placements early-return once things are where they belong, so the steady
 * state is a couple of lookups per mutation batch.
 */
export function installMenuSkin(on: boolean): void {
  setMenuSkin(on);

  if (observer) return;
  const root = document.getElementById('uiBase') ?? document.body;
  if (!root) return;

  observer = new MutationObserver(() => apply());
  observer.observe(root, { childList: true, subtree: true });
}
