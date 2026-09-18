import { KRUNKER_BOARD_RANKS } from '../../krunker/constants';
import {
  nextRankIcons,
  rankIconFor,
  type RankIcons,
  type RankSighting,
} from '../../shared/board-ranks';
import { SHEETS, STYLE_IDS, UI_CLASSES } from '../../shared/ui';
import { nameAndClan } from '../name-highlights';
import { defineStyle, removeStyle } from '../style';

/**
 * Rank icons beside the names on the corner leaderboard, the way FACEIT's old
 * in-game board carried each player's level.
 *
 * Krunker draws them already, on the centre board you hold Tab for, and this
 * copies each one across to the same name in the corner. No requests, no
 * rank table of our own: an icon here is exactly the one the game drew, so it
 * cannot disagree with Krunker, and outside a ranked match the centre board
 * has none to copy and the corner stays as it was.
 *
 * Two observers. The centre board's says who has what, and the corner's puts
 * the icons back every time Krunker rebuilds its rows, which it does whenever
 * a score or the order changes. What was learnt is kept between the two (see
 * `nextRankIcons`) rather than read fresh each time, because the centre board
 * is not necessarily filled while it is off screen: the corner is drawn from
 * whatever the centre last showed.
 *
 * So the icons appear from the first time the centre board is drawn in a
 * match. If Krunker only draws it while you hold Tab, that is the first time
 * you do.
 */

const K = KRUNKER_BOARD_RANKS;
const ICON = UI_CLASSES.rankIcon;

let icons: RankIcons = new Map();
let centreObserver: MutationObserver | null = null;
let cornerObserver: MutationObserver | null = null;
let poll: ReturnType<typeof setInterval> | null = null;

/** Every player on the centre board, with the icon beside them if any. */
function readCentre(centre: Element): RankSighting[] {
  const out: RankSighting[] = [];
  for (const row of centre.querySelectorAll(K.centreRow)) {
    const nameEl = row.querySelector(K.centreName);
    if (!nameEl) continue;
    const img = row.querySelector<HTMLImageElement>(K.centreIcon);
    // `src` rather than the attribute, so it is a full URL: a relative path
    // in their markup would still load once it is on the other board.
    const src = img?.src ?? '';
    out.push({ name: nameAndClan(nameEl).name, icon: src === '' ? null : src });
  }
  return out;
}

/** Our icon sitting directly in front of this name, if there is one. */
function iconBefore(nameEl: Element): HTMLImageElement | null {
  const prev = nameEl.previousElementSibling;
  return prev instanceof HTMLImageElement && prev.classList.contains(ICON) ? prev : null;
}

/**
 * Make the corner board match the table.
 *
 * Only writes where something is wrong, and that matters twice over. The
 * insert is itself a mutation of the board being watched, so a pass that
 * always wrote would wake its own observer forever; and a pass that changes
 * nothing is a few reads per row, which is the cost of every score tick.
 */
function drawCorner(corner: Element): void {
  for (const nameEl of corner.querySelectorAll(K.cornerName)) {
    const want = rankIconFor(icons, nameAndClan(nameEl).name);
    const have = iconBefore(nameEl);

    if (want === null) {
      have?.remove();
      continue;
    }
    if (have) {
      if (have.src !== want) have.src = want;
      continue;
    }

    defineStyle(STYLE_IDS.boardRanks, SHEETS.boardRanks);
    const img = document.createElement('img');
    img.className = ICON;
    img.src = want;
    // The name is right beside it; the icon has nothing to add to a screen
    // reader that the rank on the centre board does not already say.
    img.alt = '';
    img.draggable = false;
    nameEl.before(img);
  }

  // Anything left in front of something that is no longer a name, say a row
  // Krunker reused for someone else, rather than rebuilt.
  for (const stray of corner.querySelectorAll(`.${ICON}`)) {
    if (!stray.nextElementSibling?.matches(K.cornerName)) stray.remove();
  }
}

/** Learn from the centre board, and redraw the corner only if that taught us anything. */
function readAndDraw(centre: Element, corner: Element): void {
  const next = nextRankIcons(icons, readCentre(centre));
  if (next === icons) return;
  icons = next;
  drawCorner(corner);
}

/**
 * Hook both boards, once they exist.
 *
 * They are in the page from load, empty until a match fills them (see
 * KRUNKER_NAMES.boardContainerIds), so on a normal start this succeeds the
 * first time. `characterData` on both because a name or a score written into
 * an existing text node is not a child-list change.
 */
function attach(): boolean {
  const centre = document.getElementById(K.centreId);
  const corner = document.getElementById(K.cornerId);
  if (!centre || !corner) return false;

  // Turned on mid-match, the centre board may already hold everyone.
  icons = nextRankIcons(icons, readCentre(centre));
  drawCorner(corner);

  const options = { childList: true, subtree: true, characterData: true };
  centreObserver = new MutationObserver(() => readAndDraw(centre, corner));
  centreObserver.observe(centre, options);
  cornerObserver = new MutationObserver(() => drawCorner(corner));
  cornerObserver.observe(corner, options);
  return true;
}

const POLL_MS = 500;
const GIVE_UP_AFTER = 120; // a minute, the same patience as the name colours

function stopPolling(): void {
  if (poll !== null) clearInterval(poll);
  poll = null;
}

/** Live, both ways: on hooks the boards, off takes every icon back out. */
export function setBoardRankIcons(on: boolean): void {
  if (!on) {
    stopPolling();
    centreObserver?.disconnect();
    cornerObserver?.disconnect();
    centreObserver = null;
    cornerObserver = null;
    for (const icon of document.querySelectorAll(`.${ICON}`)) icon.remove();
    removeStyle(STYLE_IDS.boardRanks);
    icons = new Map();
    return;
  }

  if (centreObserver !== null || poll !== null) return;
  if (attach()) return;

  let attempts = 0;
  poll = setInterval(() => {
    attempts += 1;
    if (attach() || attempts >= GIVE_UP_AFTER) stopPolling();
  }, POLL_MS);
}
