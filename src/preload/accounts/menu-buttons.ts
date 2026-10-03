import { SHEETS, STYLE_IDS, UI_IDS } from '../../shared/ui';
import { defineStyle } from '../style';
import { coalesced } from '../schedule';

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
 * Krunker's October update dropped the Loadout button. The card is now a
 * clickable class chip and a lone Customize, side by side in #menuClassFooter,
 * and Customize opens window 3 on its third tab instead of window 53. So on
 * that shape Loadout is cloned from Customize, which brings the classes and
 * hover sound, and given the chip's onclick, which is Krunker's own way into
 * the Loadout tab. Still nothing hardcoded: if the chip ever stops carrying a
 * handler there is no Loadout to make, and the card is left alone.
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

const ROW_ID = UI_IDS.classButtonRow;
const ALT_ID = UI_IDS.altManagerButton;
/** The ID rule that carries these buttons' width and display mode. */
const BUTTON_SELECTOR = '#customizeButton';

/** Where the class card keeps its chip and Customize since the October update. */
const FOOTER_ID = 'menuClassFooter';
/** The chip: class name and weapon icon, clicking it opens Loadout. */
const CHIP_ID = 'menuClassContainerInner';

/** The two buttons to pair, and where the row that holds them goes. */
interface ClassButtons {
  readonly loadout: HTMLElement;
  readonly customize: HTMLElement;
  /** The row is inserted in front of this. */
  readonly before: Element;
}

/** Find one of the game's buttons by the window index its onclick opens. */
function findByWindowIndex(container: Element, index: number): HTMLElement | null {
  for (const el of container.querySelectorAll<HTMLElement>('.button')) {
    if ((el.getAttribute('onclick') ?? '').includes(`showWindow(${index})`)) return el;
  }
  return null;
}

/** Before the October update: Loadout and Customize, each in its own wrapper. */
function stackedButtons(container: Element): ClassButtons | null {
  const loadout = findByWindowIndex(container, 3);
  const customize = findByWindowIndex(container, 53);
  if (!loadout || !customize) return null;
  return { loadout, customize, before: loadout.parentElement ?? loadout };
}

/**
 * After it: no Loadout, so make one. Goes in the footer straight after the
 * chip, where the stacked card had its first button.
 */
function footerButtons(container: Element): ClassButtons | null {
  const footer = container.querySelector(`#${FOOTER_ID}`);
  const chip = footer?.querySelector(`#${CHIP_ID}`);
  const customize = footer?.querySelector<HTMLElement>(':scope > .button');
  const open = chip?.getAttribute('onclick');
  if (!chip || !customize || !open) return null;

  const loadout = customize.cloneNode(true) as HTMLElement;
  const label = [...loadout.childNodes].find(
    (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '',
  );
  const icon = loadout.querySelector('.material-icons');
  // Not the button we know. Better no Loadout than a mislabelled one.
  if (!label || !icon) return null;
  loadout.setAttribute('onclick', open);
  // The old button's label and glyph, word for word.
  label.textContent = 'Loadout ';
  icon.textContent = 'sync';
  return { loadout, customize, before: chip.nextElementSibling ?? customize };
}

/**
 * Krunker's own declarations for these buttons.
 *
 * `#customizeButton` is an ID rule with a static width: 449px and
 * display: inline-flex on it. Reading the rule beats measuring the element:
 * exact, no layout needed, and unaffected by the container's 0.7 transform or
 * the UI rescale that makes an early getBoundingClientRect() read short.
 *
 * Every rule with that selector, merged in document order, which is how the
 * cascade resolves them on the buttons themselves. There are two now: the
 * game's, which lost its width in the October update, then the classic sheet's
 * (shared/ui/krunker-classic.css), which puts the old width and padding back.
 * The first one alone would be the new, narrower button.
 *
 * Null if Krunker renames the rule, in which case we fall back to the
 * browser's own sizing rather than making a number up.
 */
function buttonRule(): CSSStyleDeclaration | null {
  let merged: CSSStyleDeclaration | null = null;
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // Cross-origin sheet; not ours to read.
    }
    for (const rule of rules) {
      if (!(rule instanceof CSSStyleRule) || rule.selectorText !== BUTTON_SELECTOR) continue;
      merged ??= document.createElement('div').style;
      for (const name of rule.style) {
        const priority = rule.style.getPropertyPriority(name);
        // A later plain declaration does not beat an earlier !important.
        if (merged.getPropertyPriority(name) === 'important' && priority !== 'important') continue;
        merged.setProperty(name, rule.style.getPropertyValue(name), priority);
      }
    }
  }
  return merged;
}

export interface MenuButtonDeps {
  readonly onAltManager: () => void;
}

function place(deps: MenuButtonDeps): void {
  const container = document.getElementById('menuClassContainer');
  if (!container) return;
  if (document.getElementById(ROW_ID)) return;

  // Stacked first: on the new card findByWindowIndex(3) finds Customize,
  // which opens window 3 now, but 53 is gone, so the old shape can't misfire.
  const buttons = stackedButtons(container) ?? footerButtons(container);
  // Menu isn't what we expect. Leave it be rather than half-rebuild it.
  if (!buttons) return;
  const { loadout, customize } = buttons;

  defineStyle(STYLE_IDS.menuButtons, SHEETS.menuButtons);

  const rule = buttonRule();

  const loadoutWrapper = loadout.parentElement;
  const customizeWrapper = customize.parentElement;

  const row = document.createElement('div');
  row.id = ROW_ID;
  buttons.before.insertAdjacentElement('beforebegin', row);
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
    const settle = coalesced(() => place(deps));
    new MutationObserver(settle).observe(root, { childList: true, subtree: true });
  }

  window.addEventListener('resize', () => requestAnimationFrame(applyWidth));
}
