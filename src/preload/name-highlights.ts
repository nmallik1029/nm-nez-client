import { KRUNKER_NAMES, PLAYER_LIST_WINDOW_INDEX } from '../krunker/constants';
import { highlightFor, type Highlight } from '../shared/highlights';
import { applyBadges } from './badges';

/**
 * One pass over every name Krunker draws on a board, for the two things we
 * do to names: colour them, and put badges on them.
 *
 * The boards and the player list only, on purpose. Chat and the killfeed
 * carry names as well, but they scroll: a colour there is gone before you
 * have read it, and the killfeed already colours by team. A board is
 * something you look *at*, which is where either of these earns its keep.
 *
 * Badges go on the boards and not the player list, which is what was asked
 * for, and is also where they read as badges rather than as clutter in a
 * table you opened to look somebody up.
 *
 * Boards and player list need different treatment because Krunker builds
 * them differently. The boards are standing markup that the game rewrites as
 * scores move, so they get observers. The player list does not exist until it
 * is opened: `windows[22].genList()` returns a string of HTML, so that gets
 * wrapped and the string is edited on the way past.
 *
 * Both give the clan as its own `<span>` inside the name, so nothing here
 * parses `Name [CLAN]` out of a blob of text.
 */

/** Marks what we have already touched, so a re-run is cheap and idempotent. */
const DONE_ATTR = 'data-nm-highlight';

/**
 * Pull the player's name and clan out of one name element.
 *
 * The name is the element's own text; the clan, when there is one, is a
 * nested span holding something like " [FAME]". Reading the text nodes
 * directly rather than `textContent` is what keeps the two apart.
 *
 * Exported for the rank icons, which have to match a name on one board to
 * the same name on another and should read it exactly the way this does.
 */
export function nameAndClan(el: Element): { name: string; clan: string | null } {
  let name = '';
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) name += node.textContent ?? '';
  }

  const span = el.querySelector('span');
  const clanText = span?.textContent ?? '';
  const clan = /\[([^\]]+)\]/.exec(clanText)?.[1] ?? null;

  return { name: name.trim(), clan };
}

/**
 * Apply a highlight to one name element.
 *
 * `setProperty` with `important` because Krunker writes the clan span's
 * colour as an inline style, and an inline style is exactly what a plain
 * assignment would be fighting on equal terms.
 */
function paint(el: HTMLElement, highlight: Highlight): void {
  if (highlight.nameColor !== null) {
    el.style.setProperty('color', highlight.nameColor, 'important');
  }
  if (highlight.bold) el.style.setProperty('font-weight', 'bold', 'important');

  const span = el.querySelector('span');
  if (span instanceof HTMLElement && highlight.clanColor !== null) {
    span.style.setProperty('color', highlight.clanColor, 'important');
  }
}

/**
 * Decorate every name inside a root that has not been done already.
 *
 * `badges` is off for the player list and on for the boards. That is the
 * whole of the difference between the two callers, and it is deliberate: a
 * badge is meant to be something you notice about someone on a scoreboard,
 * and the player list is a different kind of screen, one you open to look
 * something up rather than one that is in front of you all match.
 */
function paintNames(root: ParentNode, selector: string, badges = false): void {
  for (const el of root.querySelectorAll<HTMLElement>(selector)) {
    if (el.hasAttribute(DONE_ATTR)) continue;
    // Marked whether or not it matched: an unlisted player is a result too,
    // and re-deciding it on every score tick is wasted work.
    el.setAttribute(DONE_ATTR, '');

    const { name, clan } = nameAndClan(el);
    if (name === '') continue;

    const highlight = highlightFor(name, clan);
    if (highlight) paint(el, highlight);
    if (badges) applyBadges(el, name, clan);
  }
}

// ── the boards ───────────────────────────────────────────────────────────

const boardObservers: MutationObserver[] = [];

/** Every board element that is in the page right now. */
function boards(): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const id of KRUNKER_NAMES.boardContainerIds) {
    const el = document.getElementById(id);
    if (el) out.push(el);
  }
  return out;
}

function paintBoard(root: ParentNode): void {
  paintNames(root, KRUNKER_NAMES.boardNameSelector, true);
}

/**
 * Krunker rebuilds board rows whenever the order or a score changes, which
 * throws our colours and badges out with them. One observer per board puts
 * them back; `DONE_ATTR` means the common case is one attribute check per row.
 *
 * All three boards are in the page from the start, empty until a match fills
 * them, so this can be set up on the menu and never has to be redone.
 */
function watchBoards(): boolean {
  if (boardObservers.length > 0) return true;

  const found = boards();
  if (found.length === 0) return false;

  for (const board of found) {
    paintBoard(board);
    const observer = new MutationObserver(() => paintBoard(board));
    observer.observe(board, { childList: true, subtree: true });
    boardObservers.push(observer);
  }
  return true;
}

/**
 * Do every board again from scratch.
 *
 * For the badge pictures arriving after the first pass has already run: they
 * come from main over IPC, and a board drawn before they land has no badges
 * on it and no reason to redraw. Clearing the marks is what makes the next
 * pass reconsider rows it has already decided about.
 */
export function repaintBoards(): void {
  for (const board of boards()) {
    for (const el of board.querySelectorAll(`[${DONE_ATTR}]`)) el.removeAttribute(DONE_ATTR);
    paintBoard(board);
  }
}

// ── player list ──────────────────────────────────────────────────────────

/** Set on our wrapper so re-running never stacks two of them. */
const PATCHED = '__nmHighlightPatched';
let listPoll: ReturnType<typeof setInterval> | null = null;

interface PlayerListWindow {
  genList?: (() => string) & { [PATCHED]?: boolean };
}

/**
 * Wrap `genList` so the HTML it returns comes back coloured.
 *
 * Parsed and re-serialised rather than pattern-matched on the string.
 * Names come from players, so a regex over that HTML is a regex over
 * attacker-controlled text; going through a parser means a name full of
 * angle brackets is text, not markup.
 *
 * The parse happens in a detached document, so nothing in it runs.
 */
function patchPlayerList(): boolean {
  const windows = (window as unknown as { windows?: PlayerListWindow[] }).windows;
  const target = windows?.[PLAYER_LIST_WINDOW_INDEX];
  const original = target?.genList;
  if (!target || typeof original !== 'function') return false;
  if (original[PATCHED] === true) return true;

  const wrapped = function (this: unknown): string {
    const html = original.call(this);
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      paintNames(doc, KRUNKER_NAMES.playerListNameSelector);
      return doc.body.innerHTML;
    } catch {
      // Never cost someone their player list over a colour.
      return html;
    }
  } as (() => string) & { [PATCHED]?: boolean };

  wrapped[PATCHED] = true;
  target.genList = wrapped;
  return true;
}

// ── install ──────────────────────────────────────────────────────────────

/**
 * Neither hook can be taken at preload time: the leaderboard container and
 * `windows[]` are both built by the game's own script. Polling until they
 * turn up is the cheap way to wait for two things with no ready event
 * between them, and it stops as soon as it has both.
 */
const POLL_MS = 500;
const GIVE_UP_AFTER = 120; // a minute, then assume the page is not the game

export function installNameHighlights(): void {
  if (listPoll !== null) return;
  let attempts = 0;

  /** True once there is nothing left to wait for. */
  const settled = (): boolean => {
    const listDone = patchPlayerList();
    const boardsDone = watchBoards();
    attempts += 1;
    return (listDone && boardsDone) || attempts >= GIVE_UP_AFTER;
  };

  if (settled()) return;
  listPoll = setInterval(() => {
    if (!settled()) return;
    if (listPoll !== null) clearInterval(listPoll);
    listPoll = null;
  }, POLL_MS);
}
