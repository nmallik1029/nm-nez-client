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

/** True when a scroll position is close enough to the bottom to keep following. */
export function isNearBottom(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  slackPx = 24,
): boolean {
  return scrollHeight - (scrollTop + clientHeight) <= slackPx;
}
