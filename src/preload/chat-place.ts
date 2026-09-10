import { KRUNKER_DOM_IDS } from '../krunker/constants';
import { SHEETS, STYLE_IDS } from '../shared/ui';
import { defineStyle } from './style';

/**
 * Keeps the menu's chat clear of the buttons Krunker draws over it.
 *
 * Krunker pins chat to `bottom:20px` and then puts the map name, Invite, Join
 * and the five big buttons across the bottom of the same screen. On the menu
 * the last few messages end up behind Quick Match. In a match that corner is
 * empty, so the game's own placement is right there and this only applies to
 * the menu; the scoping is in the stylesheet, not here.
 *
 * The lift is measured rather than written down because Krunker rescales its
 * whole UI to the window: the block is 159px tall at 1920x1080 and something
 * else at every other size, so a fixed number is right once and wrong after
 * the first resize.
 */

/** Breathing room between the top of the button block and the last message. */
const GAP_PX = 12;
/**
 * Below this, assume the measurement is wrong rather than the screen tiny.
 *
 * A rect read while Krunker is mid-rescale can come back at nearly nothing,
 * and a lift of ~0 would drop chat straight back under the buttons. The token
 * default is a better answer than a bad reading.
 */
const MIN_PLAUSIBLE_LIFT_PX = 60;

let raf = 0;

/**
 * How much smaller Krunker is drawing its UI than it has laid it out.
 *
 * The game scales the whole interface to the window with a transform, so
 * `getBoundingClientRect` returns screen pixels while `bottom` is set in the
 * element's own unscaled ones. Mixing the two silently loses whatever the
 * scale is — around 15% at 1920x1080, which was enough to leave chat sitting
 * on the map name instead of above it.
 *
 * Read off the button block rather than parsed out of a transform matrix:
 * the ratio is the same and it does not care how the scale was applied.
 */
function uiScale(block: HTMLElement): number {
  const laidOut = block.offsetHeight;
  if (laidOut === 0) return 1;
  const scale = block.getBoundingClientRect().height / laidOut;
  // A nonsense ratio means something is mid-layout. 1 is wrong but safe.
  return Number.isFinite(scale) && scale > 0.1 ? scale : 1;
}

/**
 * Distance from the bottom of the window to the top of the button block, in
 * the units `bottom` is actually set in.
 *
 * Null when there is nothing sensible to say, in which case the caller leaves
 * the stylesheet's own fallback in place.
 */
function measureLift(): number | null {
  const block = document.getElementById(KRUNKER_DOM_IDS.menuBottomBlock);
  if (!block) return null;

  const rect = block.getBoundingClientRect();
  // Hidden, or not laid out yet.
  if (rect.height === 0) return null;

  const lift = (window.innerHeight - rect.top) / uiScale(block) + GAP_PX;
  if (!Number.isFinite(lift) || lift < MIN_PLAUSIBLE_LIFT_PX) return null;
  return Math.round(lift);
}

function applyLift(): void {
  const lift = measureLift();
  if (lift === null) return;
  document.documentElement.style.setProperty('--nm-chat-lift', `${lift}px`);
}

/** Coalesce the bursts of calls a resize or a menu rebuild produces. */
function scheduleLift(): void {
  if (raf !== 0) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    applyLift();
  });
}

/**
 * Krunker rebuilds the bottom block whenever the match info changes, and
 * rescales the whole UI on resize, so the measurement is re-taken rather than
 * cached. `getBoundingClientRect` on one element per batch is cheap, and this
 * only runs while the menu is up.
 */
export function installChatPlacement(): void {
  defineStyle(STYLE_IDS.chatPlace, SHEETS.chatPlace);

  applyLift();
  // Again next frame: the first pass lands while Krunker is still settling
  // its UI scale, and the rect reads short until it has finished.
  scheduleLift();

  window.addEventListener('resize', scheduleLift);

  const root = document.getElementById(KRUNKER_DOM_IDS.uiBase) ?? document.body;
  if (root) new MutationObserver(scheduleLift).observe(root, { childList: true, subtree: true });
}
