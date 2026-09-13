import { KRUNKER_RANKED_MENU, KRUNKER_RANK_LADDER } from '../../krunker/constants';
import { BRANDING } from '../../shared/branding';
import { type RankStanding, sameRankName, standing } from '../../shared/rank-progress';
import { SHEETS, STYLE_IDS, UI_IDS } from '../../shared/ui';
import { defineStyle } from '../style';
import { watchRankedMenu } from './menu-watch';

/**
 * How far you are from the next rank, on Krunker's own rank card.
 *
 * The card tells you your elo and your rank and stops there, so the one thing
 * you actually want to know before queueing, how much further it is, is
 * something you work out yourself. This is that number and a bar for it.
 *
 * The arithmetic is in `shared/rank-progress.ts` and tested there. What is
 * here is the reading and the drawing, both of which are guesswork until the
 * markup underneath is confirmed: the ranked menu needs an account and this
 * repo measures with guest profiles, so the selectors come from two other
 * clients rather than from looking. See KRUNKER_RANKED_MENU.
 *
 * Hence the checking. Nothing is drawn unless the rank this client works out
 * from the elo it read agrees with the rank Krunker has printed on the card
 * itself. A misread figure, a stale threshold and an account still in
 * placements all come out as a disagreement, and a disagreement draws
 * nothing: no bar is a fair answer, a confident wrong bar is not.
 */

const ID = UI_IDS.rankProgress;

/** Said once, so a menu that re-renders every frame cannot flood the log. */
let warned = false;
function warnOnce(message: string): void {
  if (warned) return;
  warned = true;
  console.warn(BRANDING.logPrefix, 'rank progress:', message);
}

/**
 * Your elo, off the row of small figures.
 *
 * Both reference clients take the first `.quick-stat-value` and trust it.
 * This takes the first one that is a number, which is the same thing when the
 * row starts with elo and better than a crash when it does not, and then
 * leans on the agreement check rather than on having guessed the right cell.
 */
function readElo(card: Element): number | null {
  for (const cell of card.querySelectorAll(KRUNKER_RANKED_MENU.quickStatValue)) {
    // Their figures can carry separators and a suffix; take the leading number.
    const text = (cell.textContent ?? '').replace(/,/g, '').trim();
    const match = /^-?\d+(\.\d+)?/.exec(text);
    if (!match) continue;
    const value = Number(match[0]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

/** Every rank Krunker might print, plus the one that means "no rank yet". */
const KNOWN_LABELS = [...KRUNKER_RANK_LADDER.map((step) => step.name), 'Unranked'];

/**
 * Does the card itself say what rank you are?
 *
 * Deliberately not looking for a class name. The card is Svelte with hashed
 * classes and nothing here has been seen running, so this looks for the thing
 * that cannot be renamed by a rebuild: a leaf element whose text is one of
 * Krunker's own rank names.
 */
function printedRank(card: Element): string | null {
  for (const el of card.querySelectorAll('*')) {
    if (el.childElementCount > 0) continue;
    const text = (el.textContent ?? '').trim();
    if (text === '' || text.length > 24) continue;
    if (KNOWN_LABELS.some((name) => sameRankName(name, text))) return text;
  }

  // Failing that, the badge. Its file names the tier but not the division,
  // which is half a check: enough to catch reading the wrong figure, not
  // enough to catch a threshold moving inside a tier.
  const badge = card.querySelector('img[src*="rank_"]');
  const src = badge?.getAttribute('src') ?? '';
  const tier = /rank_([a-z]+)\.svg/i.exec(src);
  return tier?.[1] ?? null;
}

/** Is the rank we worked out the rank the game is showing? */
function agrees(card: Element, computed: string): boolean {
  const printed = printedRank(card);
  if (printed === null) {
    warnOnce('the rank card does not name a rank anywhere this can find');
    return false;
  }
  if (sameRankName(printed, computed)) return true;

  // The badge case: compare the tier word only.
  const tier = computed.split(' ')[0] ?? computed;
  if (sameRankName(printed, tier)) return true;

  warnOnce(`Krunker says "${printed}", this worked out "${computed}". Thresholds are stale.`);
  return false;
}

function setText(el: Element | null, text: string): void {
  if (el && el.textContent !== text) el.textContent = text;
}

function build(): HTMLElement {
  const root = document.createElement('div');
  root.id = ID;

  const ends = document.createElement('div');
  ends.className = 'ends';
  const now = document.createElement('span');
  now.className = 'now';
  const to = document.createElement('span');
  to.className = 'to';
  ends.append(now, to);

  const track = document.createElement('div');
  track.className = 'track';
  const fill = document.createElement('span');
  fill.className = 'fill';
  track.appendChild(fill);

  root.append(ends, track);
  return root;
}

function draw(host: Element, at: RankStanding): void {
  let bar = host.querySelector<HTMLElement>(`#${ID}`);
  if (!bar) {
    defineStyle(STYLE_IDS.rankProgress, SHEETS.rankProgress);
    bar = build();
    // Above the figures, the same place both reference clients put theirs:
    // it reads as a summary of the row rather than another stat in it.
    const stats = host.querySelector(KRUNKER_RANKED_MENU.quickStats);
    if (stats) host.insertBefore(bar, stats);
    else host.appendChild(bar);
  }

  setText(bar.querySelector('.now'), at.current.name);
  setText(
    bar.querySelector('.to'),
    at.next === null ? 'Top rank' : `${at.toGo} to ${at.next.name}`,
  );

  const fill = bar.querySelector<HTMLElement>('.fill');
  const width = `${Math.round(at.fraction * 100)}%`;
  // Only when it moved. Writing it every pass would mutate the subtree this
  // is watching, on every pass, forever.
  if (fill && fill.style.width !== width) fill.style.width = width;
}

function place(): void {
  const card = document.querySelector(KRUNKER_RANKED_MENU.card);
  // The normal case: the ranked menu is not open. One miss and out.
  if (!card) return;

  const host = document.querySelector(KRUNKER_RANKED_MENU.stats) ?? card;
  const existing = host.querySelector(`#${ID}`);

  const elo = readElo(card);
  const at = elo === null ? null : standing(elo);
  if (at === null || !agrees(card, at.current.name)) {
    existing?.remove();
    return;
  }

  draw(host, at);
}

export function installRankProgress(): void {
  watchRankedMenu(place);
}
