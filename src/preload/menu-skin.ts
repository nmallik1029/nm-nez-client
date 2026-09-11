import { BRANDING } from '../shared/branding';
import { CHANGELOG } from '../shared/changelog';
import { SHEETS, STYLE_IDS, UI_IDS } from '../shared/ui';
import { setHudStyle } from './hud-skin';
import { toggleScripts } from './scripts/modal';
import { toggleStyle } from './style';

/**
 * The main-menu skin: one stylesheet and a handful of moved elements.
 *
 * Almost all of it is CSS, which is the whole design of this module. A skin
 * that is a stylesheet toggles in one assignment, costs nothing per frame, and
 * cannot leave the menu in a half-applied state — which matters on a client
 * whose entire reason to exist is frame pacing. What lives here is the work
 * CSS genuinely cannot do: Alt Manager, the wordmark, the match-actions line
 * and the footer links are DOM moves, not restyles.
 *
 * All of them are reversible, so turning the skin off puts the menu back
 * exactly as the game shipped it rather than leaving debris behind.
 */

const MARK_ID = UI_IDS.menuMark;
/** Same source the in-game watermark uses, so the two cannot disagree. */
const VERSION = CHANGELOG[0]?.version ?? '';
/** Krunker's own left menu list; the wordmark goes in at the top of it. */
const NAV_ID = 'menuItemContainer';
/** Invite and Join, which Krunker puts on the line below the map name. */
const MATCH_ACTIONS_SELECTOR = '[class*="match-info-actions"]';
/** The map name's own wrapper, once the actions have joined it. */
const MATCH_LINE_CLASS = 'kc-menu-matchline';
/** Where the actions came from, so turning the skin off puts them back. */
let actionsHome: { parent: Element; nextSibling: ChildNode | null } | null = null;

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
/** Krunker's settings window. Its contents are built by its own script. */
const SETTINGS_WINDOW_ID = 'menuWindow';
/**
 * Controls in the settings header, found by their label.
 *
 * Their markup is written by Krunker's script rather than shipped in the
 * page, so there is no id or stable class to read off the source — the same
 * problem the footer links had, and the same answer. Text is what they are.
 */
const SETTINGS_HIDDEN = ['manage ads'];

/** Marks a window panel the sheet paints. See `tagModals`. */
const MODAL_CLASS = 'kc-menu-modal';
/**
 * Where a modal can be, shallow on purpose.
 *
 * Krunker opens its windows near the top of the tree, and the alternative is
 * walking every div in the document on each mutation, which is not a thing to
 * do on a client whose whole point is frame time.
 */
const MODAL_ROOTS = [
  'body > div',
  '#uiBase > div',
  '#uiBase > div > div',
  '#windowHolder > div',
  '#popupHolder > div',
  '#menuWindowHider > div',
];
/** Where the Changelog link came from, so turning the skin off puts it back. */
let footerHome: { parent: Element; nextSibling: ChildNode | null } | null = null;
const ALT_ID = UI_IDS.altManagerButton;
const SCRIPTS_ID = UI_IDS.scriptsButton;
const SEPARATOR_ID = UI_IDS.headerSeparator;
/** The backdrop older builds drew, kept only so it can be cleaned up. */
const SCRIM_ID_LEGACY = 'kc-menu-scrim';
/** Where the class card keeps Loadout and Customize; Alt Manager's home. */
const CLASS_ROW_ID = UI_IDS.classButtonRow;
const CLASS_CONTAINER_ID = 'menuClassContainer';
/**
 * Where Alt Manager goes: the front of Krunker's own nav group, just left of
 * Inbox.
 *
 * It used to aim for the left end of the whole bar, taking the first of
 * `#signedOutHeaderBar` then `#playerHeaderEl` that existed. Signed out that
 * lands inside the login bar and looks right, which is why it seemed fine.
 * Signed in it is not: Krunker leaves `#signedOutHeaderBar` in the document
 * and hides it, so "the first one that exists" picks a hidden element and the
 * button goes in there and is never seen again.
 *
 * `.headerBarRight` is present signed in and signed out and is never the
 * hidden one, so there is no login state left to get wrong. Appending to
 * `#playerHeaderEl` would be visible too, but that row is
 * `justify-content:space-between` and a third child drags the nav in off the
 * right edge — measured at 1385px to 732px on a 1920 viewport.
 */
const HEADER_NAV_SELECTOR = '.headerBarRight';

function headerHome(): Element | null {
  return document.querySelector(HEADER_NAV_SELECTOR);
}

let enabled = false;
let observer: MutationObserver | null = null;
/** Pending coalesced pass; 0 when none is scheduled. */
let raf = 0;

/**
 * Take out the backdrop this skin used to draw.
 *
 * It was three gradients down the top, left and bottom edges, there to make
 * the menu legible over a live 3D render. It also dimmed a third of the
 * screen, which is the part nobody asked for. Krunker's own labels already
 * carry the text shadow they need, so the render can just be the render.
 *
 * A removal rather than a deletion: anyone updating from a build that drew
 * one still has the element in their DOM, and it has to go on the next pass
 * whether the skin is on or off.
 */
function clearScrim(): void {
  document.getElementById(SCRIM_ID_LEGACY)?.remove();
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

  // Under Loadout and Customize, where menu-buttons put it, skin or not.
  // It used to move up into the header; Scripts has that slot now.
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
 * Scripts, at the front of Krunker's nav with a rule after it.
 *
 * Built here rather than cloned from one of the game's buttons: this one is
 * ours, it is a plain div, and the header rule in the sheet gives it its
 * whole appearance. Krunker hides its own separators in this bar, so the
 * divider is an element of ours rather than one of theirs turned back on.
 *
 * The hover and click sounds are the game's own, looked up at call time.
 * They live on `window` and are not always there, so a missing one is no
 * sound rather than a broken button.
 */
function placeScriptsButton(): void {
  const existing = document.getElementById(SCRIPTS_ID);
  const existingRule = document.getElementById(SEPARATOR_ID);

  if (!enabled) {
    existing?.remove();
    existingRule?.remove();
    return;
  }

  const header = headerHome();
  if (!header) return;
  // Already in place. The observer runs this on every mutation batch, so the
  // steady state has to be cheap.
  if (existing?.parentElement === header && existingRule?.parentElement === header) return;

  const button = existing ?? document.createElement('div');
  if (!existing) {
    button.id = SCRIPTS_ID;
    // Uppercased by the sheet, like the nav labels it stands with.
    button.textContent = 'Scripts';
    button.addEventListener('mouseenter', () => {
      const tick = (window as unknown as { playTick?: () => void }).playTick;
      if (typeof tick === 'function') tick();
    });
    button.addEventListener('click', () => {
      const select = (window as unknown as { playSelect?: (v: number) => void }).playSelect;
      if (typeof select === 'function') select(0.1);
      toggleScripts();
    });
  }

  const rule = existingRule ?? document.createElement('div');
  rule.id = SEPARATOR_ID;

  header.insertBefore(rule, header.firstChild);
  header.insertBefore(button, rule);
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

/**
 * The settings window's own header strip.
 *
 * Only Manage Ads needs script. The Advanced switch used to be handled here
 * too and never worked: its label is a ::after `content` string rather than a
 * text node, so there is no element saying "Advanced" to find. The sheet
 * styles it by class instead.
 *
 * Scoped to the window and matched on exact label text, and only against
 * elements with no children of their own, so a section further down that
 * happens to share a name is not caught.
 */
function placeSettingsChrome(): void {
  const win = document.getElementById(SETTINGS_WINDOW_ID);
  if (!win) return;

  for (const el of win.querySelectorAll<HTMLElement>('.settingsBtn, .button, label, span, div')) {
    if (el.childElementCount > 1) continue;
    const label = (el.textContent ?? '').trim().toLowerCase();

    if (SETTINGS_HIDDEN.includes(label)) {
      // A class, not an inline style: the sheet sizes .settingsBtn with
      // display:inline-flex !important, which an inline display:none loses to.
      el.classList.toggle('kc-menu-hidden', enabled);
    }
  }
}

/**
 * Find Krunker's windows by their shape rather than by their name.
 *
 * The first version of the window sheet scoped every rule to a container id
 * taken from Krunker's stylesheet — `#menuWindow` and a handful of popups. The
 * settings window happened to be on that list; the login modal was not, and
 * came through completely unstyled. Guessing at ids for markup written by
 * someone else's script is not a strategy that finishes.
 *
 * Krunker centres every one of these the same way: absolutely positioned,
 * `left:50%` with a `translate(-50%,-50%)`. The transform is not readable back
 * from computed style — it comes out as a matrix with the percentages already
 * resolved — so this measures the result instead. A positioned, visible box
 * that is horizontally centred in the viewport and large enough to be a window
 * is one, whatever it is called.
 */
function looksLikeModal(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  if (style.position !== 'absolute' && style.position !== 'fixed') return false;
  if (style.display === 'none' || style.visibility === 'hidden') return false;

  const box = el.getBoundingClientRect();
  // Wide enough to be a panel, narrow enough not to be a full-screen scrim.
  if (box.width < 320 || box.width > window.innerWidth - 80) return false;
  if (box.height < 160) return false;

  const centre = box.left + box.width / 2;
  return Math.abs(centre - window.innerWidth / 2) < 6;
}

function tagModals(): void {
  if (!enabled) {
    for (const el of document.querySelectorAll<HTMLElement>(`.${MODAL_CLASS}`)) {
      el.classList.remove(MODAL_CLASS);
    }
    return;
  }

  for (const el of document.querySelectorAll<HTMLElement>(MODAL_ROOTS.join(','))) {
    // The menu itself is centred and large; it is not a window.
    if (el.id === 'menuHolder' || el.id === 'uiBase') continue;
    el.classList.toggle(MODAL_CLASS, looksLikeModal(el));
  }
}

/**
 * Invite and Join, moved up beside the map name.
 *
 * Krunker lays the match info out as two rows — the mode and map on the first,
 * these two on the second — which leaves them orphaned under a line they
 * belong to. They go in next to the map name instead, and the wrapper gets a
 * class so the sheet can lay that pair out on one baseline.
 */
function placeMatchActions(): void {
  const actions = document.querySelector<HTMLElement>(MATCH_ACTIONS_SELECTOR);
  if (!actions) return;

  const mapInfo = document.getElementById('mapInfoHld');
  const line = mapInfo?.parentElement ?? null;

  if (enabled) {
    if (!line || actions.parentElement === line) return;
    if (!actionsHome && actions.parentElement) {
      actionsHome = { parent: actions.parentElement, nextSibling: actions.nextSibling };
    }
    line.classList.add(MATCH_LINE_CLASS);
    line.appendChild(actions);
    return;
  }

  line?.classList.remove(MATCH_LINE_CLASS);
  if (actionsHome?.parent.isConnected) {
    actionsHome.parent.insertBefore(actions, actionsHome.nextSibling);
    actionsHome = null;
  }
}

function apply(): void {
  clearScrim();
  placeScriptsButton();
  placeMark();
  placeAltManager();
  placeMatchActions();
  placeFooterLinks();
  placeSettingsChrome();
  tagModals();
}

/**
 * Turn the skin on or off. Takes effect immediately — no reload, because
 * everything it does is a stylesheet and two element moves.
 */
export function setMenuSkin(on: boolean): void {
  enabled = on;
  toggleStyle(STYLE_IDS.menuSkin, SHEETS.menuSkin, on);
  // Krunker's own windows ride the same switch. They are a separate sheet
  // only because they are a separate surface to read, not a separate setting:
  // a menu in one palette opening a settings window in another is worse than
  // either on its own.
  toggleStyle(STYLE_IDS.krunkerWindows, SHEETS.krunkerWindows, on);
  // And the in-game HUD. One look rather than a menu skin you then have to
  // find a second switch for: a client that restyles the menu and leaves the
  // match looking like stock is two half-decisions.
  setHudStyle(on);
  apply();
}

/**
 * Coalesce a mutation burst into one pass.
 *
 * This matters more here than anywhere else in the preload. The observer below
 * watches #uiBase with subtree:true, and in a match that fires on every
 * killfeed line, chat message, ammo tick and leaderboard update -- dozens of
 * batches a second. `apply()` ends in `tagModals()`, which runs a six-selector
 * querySelectorAll and then `getComputedStyle` plus `getBoundingClientRect` on
 * each hit: two forced synchronous layouts per candidate, per batch, on the
 * main thread. On a client built around frame pacing that is the worst possible
 * place to spend time, and none of it is needed while a match is on screen.
 *
 * Same shape as `scheduleLift` in chat-place.ts. One pass per frame at most,
 * whatever the mutation rate.
 */
function schedule(): void {
  if (raf !== 0) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    apply();
  });
}

/**
 * Krunker rebuilds its menu markup as you navigate, same as its settings
 * window, so anything injected once is gone the first time you open a submenu
 * and come back. The observer puts it back.
 *
 * Installed once and left running even while the skin is off, because the
 * "off" path is what restores Alt Manager after a rebuild recreates it. Both
 * placements early-return once things are where they belong, so the steady
 * state is a couple of lookups per frame.
 */
export function installMenuSkin(on: boolean): void {
  setMenuSkin(on);

  if (observer) return;
  const root = document.getElementById('uiBase') ?? document.body;
  if (!root) return;

  observer = new MutationObserver(schedule);
  observer.observe(root, { childList: true, subtree: true });
}
