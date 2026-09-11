/**
 * Names worth picking out of a crowd: friends, and the clans we care about.
 *
 * Edit the two lists at the bottom. Everything above them is the machinery
 * and you should not need to touch it to add a person.
 *
 * This is the one file outside `ui/tokens.ts` allowed to hold raw hex, and
 * the reason is that these are not design values. A friend's colour is theirs
 * because they picked it; it does not belong on a scale with the accent and
 * the border greys, and putting it there would mean a token per person. The
 * guard in `ui/tokens.test.ts` exempts this file by name for that reason.
 *
 * Krunker writes a player with a clan as `Name [CLAN]` in the leaderboard and
 * player list, which is what `parsePlayerName` is for. A name on its own is
 * the common case and parses to a null clan.
 */

export interface FriendHighlight {
  /** In-game name, matched exactly as Krunker renders it. */
  readonly name: string;
  /** Any CSS colour. Hex is what these are written in. */
  readonly color: string;
  /**
   * Weight as well as colour. Off when left out.
   *
   * Optional because this list gets edited by hand between matches, and a
   * required field turns "add a friend quickly" into a build error over
   * something that is false most of the time.
   */
  readonly isBolded?: boolean;
}

export interface ClanHighlight {
  /** Clan tag without its brackets, as it appears in `Name [TAG]`. */
  readonly tag: string;
  readonly color: string;
  /** Same as a friend's: optional, off when left out. */
  readonly isBolded?: boolean;
}

/**
 * What to draw a given player in, once friend and clan have been weighed.
 *
 * Two colours rather than one because Krunker draws the clan tag as its own
 * span beside the name, and the two can come from different rules: a friend
 * keeps their own colour while their clan tag keeps the clan's. Null on
 * either means leave that part as the game has it.
 */
export interface Highlight {
  readonly nameColor: string | null;
  readonly clanColor: string | null;
  readonly bold: boolean;
}

/** A display name split into the person and the clan they carry. */
export interface ParsedName {
  readonly name: string;
  /** Null when they are not in a clan, or not showing one. */
  readonly clan: string | null;
}

/**
 * Split `Name [CLAN]` into its parts.
 *
 * Tolerant of the spacing because it is not worth being strict about, and it
 * only takes a trailing bracket group: a name that happens to contain
 * brackets earlier on keeps them.
 */
export function parsePlayerName(display: string): ParsedName {
  const match = /^(.*?)\s*\[([^[\]]+)\]\s*$/.exec(display.trim());
  if (!match) return { name: display.trim(), clan: null };
  return { name: (match[1] ?? '').trim(), clan: (match[2] ?? '').trim() };
}

/** Case-insensitive, because nobody types a clan tag the same way twice. */
function sameName(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * How to draw this player, or null to leave them as Krunker has them.
 *
 * Takes the name and clan apart rather than a display string, because both
 * places this is used already have them as separate elements and joining
 * them up just to split them again would be silly.
 *
 * A friend outranks their clan on colour: naming a person is the more
 * specific choice of the two. Bold is an or, not a precedence — a bolded
 * friend is bold whatever their clan says, and a bolded clan bolds its
 * members whether or not they are also named individually.
 */
export function highlightFor(
  name: string,
  clan: string | null,
  // Taken as arguments so the rules can be exercised without the real lists
  // having anyone in them. Callers pass nothing and get the lists below.
  friends: readonly FriendHighlight[] = FRIENDS,
  clans: readonly ClanHighlight[] = CLANS,
): Highlight | null {
  const clanRule = clan === null ? undefined : clans.find((c) => sameName(c.tag, clan));
  const friend = friends.find((f) => sameName(f.name, name));
  if (!friend && !clanRule) return null;

  return {
    nameColor: friend?.color ?? clanRule?.color ?? null,
    clanColor: clanRule?.color ?? null,
    bold: (friend?.isBolded ?? false) || (clanRule?.isBolded ?? false),
  };
}

// ── the lists ────────────────────────────────────────────────────────────
// Add people here. Name exactly as Krunker shows it; the colour can be any
// CSS colour, and hex is the convention.

/** Friends, by in-game name. */
export const FRIENDS: readonly FriendHighlight[] = [
  // { name: 'illegal', color: '#48eaff', isBolded: true },
  { name: 'drainciity', color: '#c24658' },
  { name: 'YBG_Wallace', color: '#492769' },
];

/** Clans, by tag, without the brackets Krunker draws around them. */
export const CLANS: readonly ClanHighlight[] = [
  // { tag: 'Fame', color: '#e4552e', isBolded: true },
];
