import { KRUNKER_CHAT, KRUNKER_DOM_IDS } from '../krunker/constants';
import {
  decideChatTag,
  isChatNoise,
  isNearBottom,
  isTeamMode,
  overflowCount,
} from '../shared/chat';
import { defineStyle, toggleStyle } from './style';

/**
 * Chat: both channels at once, and history that survives Krunker's pruning.
 *
 * Three things the game's own chat does make this awkward, and each one shapes
 * the code below.
 *
 *  1. Only the active channel shows; the globe toggle swaps between team and
 *     all. CSS reveals both, and a [T]/[M] prefix carries the information the
 *     toggle used to.
 *  2. Krunker deletes old messages out of the DOM. We put them back as they
 *     go, then trim to our own larger limit so the list stays bounded.
 *  3. Krunker force-scrolls to the bottom on every new message, which yanks
 *     you down mid-read. If you've scrolled up, that scroll gets undone and
 *     your position held.
 */

const MERGE_STYLE_ID = 'kc-chat-merge';
/** Krunker hides the inactive channel. Overriding display shows both. */
const MERGE_CSS = `#${KRUNKER_DOM_IDS.chatList} > * { display: block !important; }`;

/**
 * The [T]/[M] prefixes. A stylesheet rather than the inline `cssText` this used
 * to set per message, so the colours live with every other colour and a theme
 * can reach them.
 */
const TAG_CSS = `
.kc-chat-tag{float:left;margin-right:4px;font-weight:bold}
.kc-chat-tag.kc-chat-team{color:var(--nm-chat-team)}
.kc-chat-tag.kc-chat-all{color:var(--nm-chat-all)}
`;

export interface ChatOptions {
  /** Show both channels with [T]/[M] prefixes. */
  readonly merged: boolean;
  /** Max messages to retain. 0 leaves Krunker's own pruning alone. */
  readonly historyLimit: number;
}

interface GameActivity {
  mode?: string;
}

let chatList: HTMLElement | null = null;
let observer: MutationObserver | null = null;
let options: ChatOptions = { merged: false, historyLimit: 0 };

/** Messages we removed ourselves, so the re-inserter doesn't bring them back. */
const selfRemoved = new WeakSet<Node>();
/** Guards against reacting to our own DOM writes. */
let reinserting = false;

let scrollPaused = false;
let savedScrollTop = 0;

function isMessage(node: Node): node is HTMLElement {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    (node as HTMLElement).id.startsWith(KRUNKER_CHAT.messageIdPrefix)
  );
}

function currentMode(): string | undefined {
  try {
    const getActivity = (window as unknown as { getGameActivity?: () => GameActivity })
      .getGameActivity;
    return getActivity?.().mode;
  } catch {
    // Game API isn't up yet, or the shape moved. Not worth throwing over.
    return undefined;
  }
}

function syncMergeStyle(): void {
  toggleStyle(MERGE_STYLE_ID, MERGE_CSS, options.merged);
}

function tagMessage(node: HTMLElement, teamMode: boolean): boolean {
  const body = node.querySelector(`.${KRUNKER_CHAT.messageBodyClass}`);
  if (!body) return false;

  if (isChatNoise(body.textContent ?? '')) {
    selfRemoved.add(node);
    node.remove();
    return true;
  }

  const item = node.querySelector(`.${KRUNKER_CHAT.itemClass}`);
  const tag = decideChatTag({
    teamMode,
    dataTab: node.dataset['tab'],
    itemText: item?.textContent ?? node.textContent ?? '',
  });
  if (!tag) return false;

  const label = document.createElement('span');
  label.className = `kc-chat-tag ${tag.cssClass}`;
  label.textContent = tag.label;
  body.insertBefore(label, body.firstChild);
  return true;
}

function reinsertRemoved(mutations: MutationRecord[]): boolean {
  if (options.historyLimit <= 0 || !chatList || !observer || reinserting) return false;

  const removed: HTMLElement[] = [];
  for (const mutation of mutations) {
    for (const node of mutation.removedNodes) {
      if (isMessage(node) && !selfRemoved.has(node)) removed.push(node);
    }
  }
  if (removed.length === 0) return false;

  reinserting = true;
  // Detach first. Re-inserting fires the observer again and we'd loop.
  observer.disconnect();

  const firstLive = chatList.firstChild;
  for (const node of removed) chatList.insertBefore(node, firstLive);

  // Reading scrollHeight forces layout, so only when we actually need it to
  // fix up the scroll anchor.
  const heightBeforeTrim = scrollPaused ? chatList.scrollHeight : 0;

  let toTrim = overflowCount(chatList.children.length, options.historyLimit);
  while (toTrim > 0 && chatList.firstChild) {
    selfRemoved.add(chatList.firstChild);
    chatList.removeChild(chatList.firstChild);
    toTrim -= 1;
  }

  if (scrollPaused) {
    // Trimming from the top shifts everything up by exactly the height lost.
    savedScrollTop = Math.max(0, savedScrollTop - (heightBeforeTrim - chatList.scrollHeight));
  }

  observer.observe(chatList, { childList: true });
  reinserting = false;
  return true;
}

function handleMutations(mutations: MutationRecord[]): void {
  let heightChanged = reinsertRemoved(mutations);

  if (options.merged) {
    const teamMode = isTeamMode(currentMode());
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (isMessage(node) && tagMessage(node, teamMode)) heightChanged = true;
      }
    }
  }

  if (!chatList) return;

  if (scrollPaused) {
    // Undo Krunker's force-scroll and hold your place.
    chatList.scrollTop = savedScrollTop;
  } else if (heightChanged) {
    // Following along, so Krunker's own scroll already hit the bottom. Only
    // re-pin if we changed the height after it ran.
    chatList.scrollTop = chatList.scrollHeight;
  }
}

function handleScroll(): void {
  if (!chatList || reinserting) return;

  const atBottom = isNearBottom(chatList.scrollTop, chatList.scrollHeight, chatList.clientHeight);
  scrollPaused = !atBottom;
  // Recorded on every scroll, so the next forced scroll-to-bottom can be put
  // back exactly where you were.
  if (scrollPaused) savedScrollTop = chatList.scrollTop;
}

/** Flip the outgoing channel, as if the globe button were clicked. */
export function toggleChatChannel(): void {
  const chatSwitch = document.getElementById(KRUNKER_CHAT.switchId);
  if (!chatSwitch) return;
  const switchChat = (window as unknown as { switchChat?: (el: HTMLElement) => void }).switchChat;
  // Use the game's own function where possible so whatever state it keeps
  // stays in step. Failing that, click the element, same thing.
  if (typeof switchChat === 'function') switchChat(chatSwitch);
  else chatSwitch.click();
}

let channelKeyInstalled = false;

/**
 * Tab switches the outgoing channel, but only while the chat box has focus.
 *
 * Krunker binds Tab to the scoreboard, so taking it globally would break that.
 * Scoped to the input it's free, since Tab does nothing useful in a one-field
 * chat box.
 *
 * Capture phase plus stopImmediatePropagation, or the game's handler still
 * sees the key and opens the scoreboard behind us.
 */
function installChannelKey(): void {
  if (channelKeyInstalled) return;
  channelKeyInstalled = true;

  document.addEventListener(
    'keydown',
    (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const input = document.getElementById(KRUNKER_CHAT.inputId);
      if (!input || document.activeElement !== input) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      toggleChatChannel();
    },
    { capture: true },
  );
}

/** Apply new settings. Safe to call before the chat element exists. */
export function setChatOptions(next: ChatOptions): void {
  options = next;
  syncMergeStyle();
}

/**
 * Attach to Krunker's chat list. False means the element isn't in the DOM yet,
 * which is why the caller polls: chat is built long after preload runs.
 */
export function attachChat(): boolean {
  const element = document.getElementById(KRUNKER_DOM_IDS.chatList);
  if (!element || element === chatList) return element !== null;

  observer?.disconnect();
  chatList = element;
  observer = new MutationObserver(handleMutations);
  observer.observe(chatList, { childList: true });
  chatList.addEventListener('scroll', handleScroll, { passive: true });

  syncMergeStyle();
  installChannelKey();
  return true;
}

/** Poll for the chat element, then attach. Gives up instead of spinning forever. */
export function initChat(initial: ChatOptions): void {
  defineStyle('kc-chat-tags', TAG_CSS);
  setChatOptions(initial);

  if (attachChat()) return;
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (attachChat() || attempts > 150) clearInterval(timer);
  }, 200);
}
