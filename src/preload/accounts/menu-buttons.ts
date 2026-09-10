import { defineStyle } from '../style';

/**
 * Rearranges the two buttons under the class preview in Krunker's main menu.
 *
 * They ship stacked, each in its own wrapper inside `#menuClassContainer`, and
 * both carry id="customizeButton" (a duplicate id in the game's own markup, so
 * the id is no use for telling them apart). Go by what their onclick opens:
 *
 *   Loadout    showWindow(3)
 *   Customize  showWindow(53)
 *
 * They get moved rather than recreated, so the onclick, the hover sound and
 * all the game styling come along. Rebuilding them would mean hardcoding
 * showWindow(3), which is the kind of coupling that rots without telling you.
 *
 *   before                    after
 *   ┌────────────────────┐    ┌─────────┬──────────┐
 *   │      Loadout       │    │ Loadout │Customize │
 *   ├────────────────────┤    ├─────────┴──────────┤
 *   │     Customize      │    │    Alt Manager     │
 *   └────────────────────┘    └────────────────────┘
 *
 * Sizes are read out of Krunker's stylesheet rather than measured, for two
 * reasons. `#menuClassContainer` is scale(0.7), so getBoundingClientRect()
 * says 318px for a button whose CSS width is 449px, and feeding a rect width
 * back into a style shrinks it by 0.7 every pass. And Krunker rescales its UI
 * after load, so any single reading at inject time lands mid-settle and comes
 * back short. The width sits on the #customizeButton ID rule, so reading the
 * rule dodges both and is exact.
 *
 * Then there's the box model. That 449px is content-box, so a real button is
 * 449 + 30 padding + 8 border = 487px wide, while the row is a bare div whose
 * 449px is already its outer width. Forcing border-box on the alt button to
 * match collapses its height, because the same rule sets an explicit height
 * that would then have to swallow the vertical padding. So the alt keeps the
 * game's box model and the row gets widened instead, which is the footprint
 * the pair is supposed to fill anyway.
 */

const ROW_ID = 'kc-class-buttons';
const ALT_ID = 'kc-alt-manager-button';
const STYLE_ID = 'kc-class-buttons-css';
/** The ID rule that carries these buttons' width and display mode. */
const BUTTON_SELECTOR = '#customizeButton';

const CSS = `
/* Block with an explicit width and auto left margin, reproducing the right
   alignment the game's text-align:right wrapper gave the stacked buttons. */
#${ROW_ID}{display:flex;gap:8px;margin:8px 0 0 auto}
#${ROW_ID} > *{flex:1 1 0;width:auto !important;min-width:0;margin:0}
/* Krunker sizes these for a full-width button. At half the width the label
   plus its icon no longer fits, so both come down proportionally. */
#${ROW_ID} .button{font-size:21px;padding-left:8px;padding-right:8px;
  justify-content:center;white-space:nowrap}
#${ROW_ID} .material-icons{font-size:24px !important;margin-left:4px !important}
/* No height here: the shared .button class already supplies the
   padding and line box that make the other two 44px tall, and an explicit
   height fights it. */
#${ALT_ID}{margin:8px 0 0 auto;cursor:pointer;white-space:nowrap;
  justify-content:center}
`;

/** Find one of the game's buttons by the window index its onclick opens. */
function findByWindowIndex(container: Element, index: number): HTMLElement | null {
  for (const el of container.querySelectorAll<HTMLElement>('.button')) {
    if ((el.getAttribute('onclick') ?? '').includes(`showWindow(${index})`)) return el;
  }
  return null;
}

/**
 * Krunker's own declarations for these buttons.
 *
 * `#customizeButton` is an ID rule with a static width: 449px and
 * display: inline-flex on it. Reading the rule beats measuring the element:
 * exact, no layout needed, and unaffected by the container's 0.7 transform or
 * the UI rescale that makes an early getBoundingClientRect() read short.
 *
 * Null if Krunker renames the rule, in which case we fall back to the
 * browser's own sizing rather than making a number up.
 */
function buttonRule(): CSSStyleDeclaration | null {
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // Cross-origin sheet; not ours to read.
    }
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule && rule.selectorText === BUTTON_SELECTOR) return rule.style;
    }
  }
  return null;
}

export interface MenuButtonDeps {
  readonly onAltManager: () => void;
}

function place(deps: MenuButtonDeps): void {
  const container = document.getElementById('menuClassContainer');
  if (!container) return;
  if (document.getElementById(ROW_ID)) return;

  const loadout = findByWindowIndex(container, 3);
  const customize = findByWindowIndex(container, 53);
  // Menu isn't what we expect. Leave it be rather than half-rebuild it.
  if (!loadout || !customize) return;

  defineStyle(STYLE_ID, CSS);

  const rule = buttonRule();

  const loadoutWrapper = loadout.parentElement;
  const customizeWrapper = customize.parentElement;

  const row = document.createElement('div');
  row.id = ROW_ID;
  loadoutWrapper?.insertAdjacentElement('beforebegin', row);
  row.append(loadout, customize);

  // Krunker's own button classes, so the alt manager matches the two above it
  // exactly: height, hover, shadowed text, all of it.
  const alt = document.createElement('div');
  alt.id = ALT_ID;
  alt.className = customize.className;
  alt.textContent = 'Alt Manager';
  // The class on its own isn't enough. Width, display and sizing all come off
  // the #customizeButton ID rule, which this element doesn't match. Copying
  // the whole block is what makes it a pixel match instead of an approximation
  // somebody has to keep tuning.
  if (rule !== null) {
    alt.style.cssText += rule.cssText;
    // Copied inline styles beat our stylesheet, so say it again here.
    alt.style.margin = '8px 0 0 auto';
    alt.style.cursor = 'pointer';
    alt.style.justifyContent = 'center';
    // Not border-box. The rule sets an explicit height as well and switching
    // the box model collapses it; applyWidth sorts out the width instead.
  }
  alt.addEventListener('mouseenter', () => {
    const tick = (window as unknown as { playTick?: () => void }).playTick;
    if (typeof tick === 'function') tick();
  });
  alt.addEventListener('click', () => {
    const select = (window as unknown as { playSelect?: (v: number) => void }).playSelect;
    if (typeof select === 'function') select(0.1);
    deps.onAltManager();
  });
  row.insertAdjacentElement('afterend', alt);

  // The empty wrappers leave two 8px gaps behind otherwise.
  if (loadoutWrapper?.childElementCount === 0) loadoutWrapper.remove();
  if (customizeWrapper?.childElementCount === 0) customizeWrapper.remove();

  applyWidth();
  // Again next frame. Krunker is still settling its UI scale on the first
  // pass and the rule reads short until it's done.
  requestAnimationFrame(applyWidth);
}

/**
 * Match the row and the alt button to one of Krunker's full-width buttons.
 *
 * Re-read off the live rule rather than cached. It's been 449px in every state
 * I've looked at, so this is insurance rather than a fix for anything I've
 * actually seen go wrong. Costs one stylesheet walk on resize.
 */
function applyWidth(): void {
  const width = buttonRule()?.width;
  if (width === undefined || width === '') return;
  const outer = Number.parseFloat(width);
  if (!Number.isFinite(outer)) return;

  // Left as the rule declares it, so the alt is exactly a Krunker button.
  const alt = document.getElementById(ALT_ID);
  if (alt) alt.style.width = width;

  const row = document.getElementById(ROW_ID);
  if (!row) return;
  // The row has no padding or border of its own, so to take up the same space
  // as one button it needs that button's chrome added to the declared width.
  // Measured off the alt, which has the same .button padding and border.
  const inset = alt === null ? 0 : horizontalChrome(alt);
  row.style.width = `${outer + inset}px`;
}

/** Padding plus border on the horizontal axis, in CSS px. */
function horizontalChrome(el: HTMLElement): number {
  const style = getComputedStyle(el);
  const total =
    Number.parseFloat(style.paddingLeft) +
    Number.parseFloat(style.paddingRight) +
    Number.parseFloat(style.borderLeftWidth) +
    Number.parseFloat(style.borderRightWidth);
  return Number.isFinite(total) ? total : 0;
}

/**
 * Krunker rebuilds the class container whenever the loadout changes and throws
 * our arrangement out with it, so an observer puts it back. `place()` bails
 * after one getElementById in the normal case where it's already there.
 */
export function installMenuButtons(deps: MenuButtonDeps): void {
  place(deps);

  const root = document.getElementById('menuHider') ?? document.body;
  if (root) {
    new MutationObserver(() => place(deps)).observe(root, { childList: true, subtree: true });
  }

  window.addEventListener('resize', () => requestAnimationFrame(applyWidth));
}
