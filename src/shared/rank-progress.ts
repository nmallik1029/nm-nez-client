import { KRUNKER_RANK_LADDER } from '../krunker/constants';

/**
 * How far you are from the next rank.
 *
 * Pure, so the arithmetic can be tested without a ranked menu to read: the
 * menu itself needs an account, and the profiles this repo measures with are
 * guests, so the DOM half is verified by looking and this half is verified
 * here.
 */

export interface RankStep {
  readonly name: string;
  readonly elo: number;
}

export interface RankStanding {
  readonly current: RankStep;
  /** Null at the top of the ladder, where there is nothing left to climb. */
  readonly next: RankStep | null;
  /** Elo still to earn. 0 at the top. */
  readonly toGo: number;
  /** 0 to 1 through the current rank. 1 at the top. */
  readonly fraction: number;
}

/**
 * Where `elo` puts you, or null when it says nothing.
 *
 * Null rather than a guess for anything below the bottom of the ladder. That
 * covers the two ways this gets called with a number that is not a rating:
 * an unranked account still in placements, and a misread of the wrong figure
 * out of the stats row.
 */
export function standing(elo: number): RankStanding | null {
  if (!Number.isFinite(elo)) return null;

  const ladder = KRUNKER_RANK_LADDER;
  let current: RankStep | null = null;
  let next: RankStep | null = null;
  for (let i = ladder.length - 1; i >= 0; i--) {
    const step = ladder[i];
    if (step && elo >= step.elo) {
      current = step;
      next = ladder[i + 1] ?? null;
      break;
    }
  }
  // Below the bottom rank, so there is no standing to report.
  if (!current) return null;
  if (!next) return { current, next: null, toGo: 0, fraction: 1 };

  const span = next.elo - current.elo;
  const gained = elo - current.elo;
  const fraction = span > 0 ? Math.min(1, Math.max(0, gained / span)) : 0;
  return { current, next, toGo: Math.max(0, Math.ceil(next.elo - elo)), fraction };
}

/**
 * Is Krunker's own rank label the same rank this table thinks you are?
 *
 * The comparison is deliberately loose. The card is styled, so the label can
 * arrive upper-cased or spaced differently, and a division could be printed
 * in roman numerals; none of those are a disagreement. A real one, Gold 2
 * against Gold 3, means the thresholds have moved and the caller should stay
 * quiet rather than show a number it cannot stand behind.
 */
export function sameRankName(a: string, b: string): boolean {
  return normaliseRank(a) === normaliseRank(b);
}

function normaliseRank(raw: string): string {
  const words = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ');
  return words.map((word) => ROMAN[word] ?? word).join(' ');
}

/** Only as far as the ladder goes, which is three divisions. */
const ROMAN: Record<string, string> = { i: '1', ii: '2', iii: '3' };
