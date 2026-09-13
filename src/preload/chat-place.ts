import { KRUNKER_DOM_IDS } from '../krunker/constants';
import { SHEETS, STYLE_IDS } from '../shared/ui';
import { defineStyle } from './style';
import { coalesced } from './schedule';

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


/**
 * How much smaller Krunker is drawing its UI than it has laid it out.
 *
 * The game scales the whole interface to the window with a transform, so
 * `getBoundingClientRect` returns screen pixels while `bottom` is set in the
 * element's own unscaled ones. Mixing the two silently loses whatever the
 * scale is: around 15% at 1920x1080, which was enough to leave chat sitting
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
  // Every trigger comes through here, so this is where a menu rebuild gets
  // noticed and the size watcher is pointed at the new elements.
  watchGeometry();

  const block = document.getElementById(KRUNKER_DOM_IDS.menuBottomBlock);
  const lift = measureLift();
  if (lift === null || block === null) return;

  const style = document.documentElement.style;
  style.setProperty('--nm-chat-lift', `${lift}px`);
  style.setProperty('--nm-chat-menu-height', `${measureHeight(lift, uiScale(block))}px`);
}

/** Coalesce the bursts of calls a resize or a menu rebuild produces. */
const scheduleLift = coalesced(applyLift);

/**
 * Re-measure when the things being measured change size.
 *
 * This is the fix for chat going up and staying there. The trigger used to be
 * a childList observer over #uiBase, which only fires when a node is added or
 * removed, and most of what moves this doesn't do that:
 *
 *   the map name wraps to a second line   text, not nodes
 *   a badge appears next to it            text, not nodes
 *   the block is shown or hidden          an attribute, not nodes
 *   Krunker rescales its UI               neither
 *
 * So the block would change height, the lift would not be re-taken, and chat
 * stayed where the last measurement had put it: usually too high, since it is
 * lifted for the tallest thing it has seen. It only dropped back when
 * something unrelated happened to add a node under #uiBase, which is a chat
 * message or a killfeed line arriving.
 *
 * A ResizeObserver is exactly the question being asked: tell me when the box
 * I measure is a different size. It covers all four cases above, and it costs
 * two elements instead of every mutation in the game's UI.
 *
 * Only the two elements the measurement reads, and deliberately not the chat
 * input: applying a measurement resizes chat, and observing chat would be a
 * loop.
 */
const sizeWatcher =
  typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleLift) : null;
/** The node currently observed for each id, so a rebuild can be noticed. */
const watched = new Map<string, Element>();

/**
 * Attach to the measured elements, and re-attach when the game replaces one.
 *
 * The re-attaching is the part that matters. Krunker rebuilds its menu as you
 * navigate (see item 11 in krunker/constants.ts), and an observer left holding
 * a node that has been swapped out never fires again: it would have traded one
 * stale-measurement bug for a quieter one.
 *
 * Removal is what catches it. A ResizeObserver reports an element going to
 * nothing when it leaves the document, so the swap wakes us and this then
 * finds the new node. Called from the measurement itself, which is the one
 * thing guaranteed to run on every trigger there is.
 *
 * Returns true once both are attached, which is what the mount observer in
 * `installChatPlacement` is waiting for.
 */
function watchGeometry(): boolean {
  const ids = [KRUNKER_DOM_IDS.menuBottomBlock, KRUNKER_DOM_IDS.menuNav];
  let all = true;

  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) {
      all = false;
      continue;
    }
    const previous = watched.get(id);
    if (previous === el) continue;
    if (previous) sizeWatcher?.unobserve(previous);
    sizeWatcher?.observe(el);
    watched.set(id, el);
  }

  return all;
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

  const ui = document.getElementById(KRUNKER_DOM_IDS.uiBase);

  /*
   * Going back to the menu is the moment a stale lift becomes visible, since
   * the rule that uses it is scoped to that class, and nothing measured while
   * a match was on screen is worth keeping: the block is hidden then, so the
   * last reading is however things looked before you joined.
   */
  if (ui) {
    new MutationObserver(scheduleLift).observe(ui, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  /*
   * The elements are built by Krunker's own script, so on an early call they
   * may not be there. This waits for them and then gets out of the way: it is
   * the one broad observer here and it should not outlive its errand.
   */
  if (watchGeometry()) return;
  const root = ui ?? document.body;
  const mount: MutationObserver = new MutationObserver(() => {
    scheduleLift();
    if (watchGeometry()) mount.disconnect();
  });
  mount.observe(root, { childList: true, subtree: true });
}
