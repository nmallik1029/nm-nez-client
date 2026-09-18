/**
 * Rank icons on the corner leaderboard: the half that needs no page.
 *
 * In a ranked match Krunker already knows everyone's rank, and draws it as an
 * icon beside each name on the big scoreboard in the middle of the screen.
 * The running board in the corner, the one that is actually in front of you
 * all match, gets names and scores only. FACEIT's old in-game leaderboard had
 * each player's level right there beside their name, and this puts Krunker's
 * rank icons in the same place.
 *
 * Nothing is looked up. The icon a player gets in the corner is the one the
 * game drew for them in the middle, matched by name, so it cannot disagree
 * with Krunker and costs no requests. What is here is the bookkeeping for
 * that, pure so it can be tested without a ranked match to sit in.
 */

/** Name key to the icon Krunker drew for that player, or null for none. */
export type RankIcons = ReadonlyMap<string, string | null>;

/** One row of the centre board: who, and the icon beside them if any. */
export interface RankSighting {
  readonly name: string;
  readonly icon: string | null;
}

/**
 * The key a name is filed under.
 *
 * Case-folded and trimmed, and stripped of the invisible direction marks
 * Krunker wraps names in elsewhere (chat has them). Both boards are built from
 * the same player data, so the marks are belt and braces rather than a known
 * difference between the two.
 */
export function rankKey(name: string): string {
  return name.replace(/[\u200b\u200e\u200f]/g, '').trim().toLowerCase();
}

/** The icon for this name, or null when the centre board gave them none. */
export function rankIconFor(icons: RankIcons, name: string): string | null {
  return icons.get(rankKey(name)) ?? null;
}

/**
 * What the table should be after a read of the centre board.
 *
 * A board with anyone on it replaces the table outright, and an empty one
 * leaves it alone.
 *
 * Replacing is what stops an icon outliving the match it was drawn for: the
 * centre board lists everyone in the game you are in, so a name that is not
 * on it has no business wearing an icon, and a pub after a ranked match
 * starts clean the first time its board is drawn.
 *
 * Leaving it alone is for the board being empty, which it is before a match
 * fills it and may well be whenever it is off screen. Wiping the table then
 * would strip every icon from the corner the moment you let go of Tab.
 *
 * Returns `current` itself when nothing changed, so the caller can tell a
 * rebuild that moved a score from one that moved a rank, and skip the redraw.
 */
export function nextRankIcons(current: RankIcons, sightings: readonly RankSighting[]): RankIcons {
  const next = new Map<string, string | null>();
  for (const { name, icon } of sightings) {
    const key = rankKey(name);
    if (key === '') continue;
    // A name seen twice keeps the icon if either sighting had one. Names are
    // unique in a game, so this should never decide anything; if it ever
    // does, showing a rank beats hiding it.
    if (icon !== null || !next.has(key)) next.set(key, icon);
  }

  if (next.size === 0) return current;
  if (next.size === current.size && [...next].every(([key, icon]) => current.get(key) === icon)) {
    return current;
  }
  return next;
}
