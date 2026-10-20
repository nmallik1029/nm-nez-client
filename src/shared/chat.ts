import { KRUNKER_CHAT, TEAM_MODES } from '../krunker/constants';

/**
 * Decisions the chat features make, kept free of the DOM so they can be
 * tested. The `preload/chat.ts` side does nothing but observe mutations and
 * apply what these functions return.
 */

export type ChatChannel = 'team' | 'all';

export interface ChatTag {
  readonly channel: ChatChannel;
  readonly label: string;
  /** Which of the two tag classes the preload puts on the label. */
  readonly cssClass: string;
}

const TEAM_TAG: ChatTag = { channel: 'team', label: '[T]', cssClass: 'kc-chat-team' };
const ALL_TAG: ChatTag = { channel: 'all', label: '[M]', cssClass: 'kc-chat-all' };

/**
 * Which channel the chat box will send to, from `#chatSwitch`'s `data-tab`.
 *
 * The switch doesn't use the same values a message does: 'groups'/'public'
 * here against '1'/'0' there. Mixing them up is easy and silent, so both sets
 * are pinned by tests.
 */
export function channelFromSwitch(dataTab: string | undefined): ChatChannel {
  return dataTab === KRUNKER_CHAT.switchTeamValue ? 'team' : 'all';
}

export function isTeamMode(mode: string | undefined | null): boolean {
  return mode != null && TEAM_MODES.has(mode);
}

export interface TagInput {
  /** Whether the current gamemode has teams at all. */
  readonly teamMode: boolean;
  /** The message element's `data-tab` attribute. */
  readonly dataTab: string | undefined;
  /** Full text of the message item, sender name included. */
  readonly itemText: string;
}

/**
 * Which prefix a message gets, or null to leave it alone. Null in a
 * free-for-all, where there are no teams, every line is all-chat, and tagging
 * all of them [M] tells you nothing.
 */
export function decideChatTag(input: TagInput): ChatTag | null {
  if (!input.teamMode) return null;
  if (input.dataTab === undefined || input.dataTab === '') return null;
  // System lines ("X joined", killfeed) have no sender, so don't label them
  // as though someone said them.
  if (!input.itemText.includes(KRUNKER_CHAT.senderMarker)) return null;

  return input.dataTab === KRUNKER_CHAT.teamTabValue ? TEAM_TAG : ALL_TAG;
}

/** Chat lines Krunker emits that are pure clutter. */
const NOISE_PATTERNS = ['Text & Voice Chat'];

export function isChatNoise(text: string): boolean {
  return NOISE_PATTERNS.some((pattern) => text.includes(pattern));
}

/**
 * How many to drop off the top once history goes over the cap.
 *
 * Krunker prunes hard, so the history feature puts back what it took and then
 * trims to our own limit. That keeps the list bounded instead of growing until
 * the tab stutters.
 */
export function overflowCount(currentCount: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.max(0, currentCount - limit);
}

/**
 * Where a message Krunker took out of the list goes back in. Returns the node
 * to insert before; null means append.
 *
 * Krunker removes from two places. Its 35-message cap takes from the top, but
 * its Chat Timer expires messages wherever they sit, and with history kept
 * those are below everything already put back. Putting every removal back at
 * the top sent each expired message up past the whole history, so the bottom
 * of chat, the part you read, showed older lines than the ones that had just
 * arrived.
 *
 * So a removal goes back next to the sibling it had, which the mutation record
 * names. The caller undoes records newest first, so that sibling has already
 * been restored when it was itself removed in the same batch.
 */
export function restoreAnchor<T>(
  previous: T | null,
  next: T | null,
  isInList: (node: T) => boolean,
  after: (node: T) => T | null,
  first: T | null,
): T | null {
  if (next !== null && isInList(next)) return next;
  if (previous !== null && isInList(previous)) return after(previous);
  return first;
}

/**
 * How long after a wheel turn or a press on the list its scroll events still
 * count as yours.
 *
 * A wheel notch scrolls smoothly over a couple of hundred milliseconds, and a
 * touchpad keeps sending wheel events while it coasts, so the scroll events a
 * gesture causes trail the input that caused them. A second covers that with
 * room to spare.
 */
export const USER_SCROLL_MS = 1000;

/**
 * What a scroll event means for following along:
 *
 *   follow  at the bottom, so follow new messages
 *   hold    stay where you are
 *   repin   something other than you moved chat off the bottom; go back
 *
 * Only a scroll you made can stop chat following. A scroll event is handed
 * over on the next frame, and the position it is judged by is read then, not
 * when the scroll happened. Anything that shrinks chat in between reads as you
 * having scrolled up. Dying does exactly that: the line saying who killed you
 * arrives, chat scrolls down to it, and the death screen cuts chat to 165px
 * before the event is delivered. Following stopped, and from then on every new
 * message was pinned back to the held position. Mid-game the pointer is locked
 * and there is no way to scroll chat free, so it sat frozen.
 *
 * Once paused, any scroll keeps the pause and records where it landed, since
 * that is the browser keeping your place.
 */
export type ScrollOutcome = 'follow' | 'hold' | 'repin';

export function judgeScroll(atBottom: boolean, byUser: boolean, paused: boolean): ScrollOutcome {
  if (atBottom) return 'follow';
  if (byUser || paused) return 'hold';
  return 'repin';
}

/** True when a scroll position is close enough to the bottom to keep following. */
export function isNearBottom(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  slackPx = 24,
): boolean {
  return scrollHeight - (scrollTop + clientHeight) <= slackPx;
}
