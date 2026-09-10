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
/** The same, between the foot of the menu list and the first message. */
const NAV_GAP_PX = 14;
/**
 * The tallest chat we would ever want, room permitting.
 *
 * Krunker's own is 250. This is a ceiling, not a target: what actually gets
 * used is whatever fits between the nav and the button block.
 */
const MAX_HEIGHT_PX = 340;
/**
 * And the shortest, at roughly two lines.
 *
 * Low on purpose. At a large UI scale the nav and the button block between
 * them leave very little, and a cramped chat you can still read past is
 * better than a full-size one drawn over Social and Community & Events.
 * Below this there is nothing sensible left to do and it will overlap.
 */
const MIN_HEIGHT_PX = 56;
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

/**
 * How tall the message list is allowed to be.
 *
 * The bottom of chat is pinned by the lift, so height is what decides where
 * the top lands, and a fixed height cannot be right: Krunker's UI scale is a
 * user setting, so the same 340px is 340 for one person and half the screen
 * for another. At 0.8 it reached up through Social and Community & Events.
 *
 * So it is fitted instead. Everything below is in the element's own unscaled
 * pixels, which is what max-height is set in; the two rects are screen
 * pixels, hence the division.
 */
function measureHeight(lift: number, scale: number): number {
  const nav = document.getElementById(KRUNKER_DOM_IDS.menuNav);
  if (!nav) return MAX_HEIGHT_PX;

  const navBottom = nav.getBoundingClientRect().bottom;
  if (navBottom <= 0) return MAX_HEIGHT_PX;

  // The input bar is part of chat's height but is not part of the list.
  const input = document.getElementById(KRUNKER_DOM_IDS.chatInputHolder);
  const inputHeight = input?.offsetHeight ?? 0;

  const room = (window.innerHeight - navBottom) / scale - NAV_GAP_PX - lift - inputHeight;
  if (!Number.isFinite(room)) return MAX_HEIGHT_PX;
  return Math.round(Math.min(MAX_HEIGHT_PX, Math.max(MIN_HEIGHT_PX, room)));
}

function applyLift(): void {
  const block = document.getElementById(KRUNKER_DOM_IDS.menuBottomBlock);
  const lift = measureLift();
  if (lift === null || block === null) return;

  const style = document.documentElement.style;
  style.setProperty('--nm-chat-lift', `${lift}px`);
  style.setProperty('--nm-chat-menu-height', `${measureHeight(lift, uiScale(block))}px`);
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
