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
const ALT_ID = UI_IDS.altManagerButton;
/** Krunker's menu root. Static markup, so it survives its own re-renders. */
const HOLDER_ID = 'menuHolder';
/** Where the class card keeps Loadout and Customize; Alt Manager's home. */
const CLASS_ROW_ID = UI_IDS.classButtonRow;
const CLASS_CONTAINER_ID = 'menuClassContainer';
/** The top bar's right-hand group: notifications, settings, more Krunker. */
const HEADER_RIGHT_SELECTOR = '.headerBarRight';

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
    const header = document.querySelector(HEADER_RIGHT_SELECTOR);
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

function apply(): void {
  placeScrim();
  placeAltManager();
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
