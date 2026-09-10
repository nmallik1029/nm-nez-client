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
}

export interface ClanHighlight {
  /** Clan tag without its brackets, as it appears in `Name [TAG]`. */
  readonly tag: string;
  readonly color: string;
  /** Clans get weight as well as colour; people are colour alone. */
  readonly bold: boolean;
}

/** What to draw a given player in, once friend and clan have been weighed. */
export interface Highlight {
  readonly color: string;
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
 * A friend outranks their clan. If someone is in the list by name, that is a
 * deliberate choice about that person and it should not be overridden by a
 * clan rule that happens to also match them. They keep the clan's weight
 * though, so a bolded clan still reads as bolded.
 */
export function highlightFor(
  display: string,
  // Taken as arguments so the rules can be exercised without the real lists
  // having anyone in them. Callers pass nothing and get the lists below.
  friends: readonly FriendHighlight[] = FRIENDS,
  clans: readonly ClanHighlight[] = CLANS,
): Highlight | null {
  const { name, clan } = parsePlayerName(display);

  const clanRule = clan === null ? undefined : clans.find((c) => sameName(c.tag, clan));
  const friend = friends.find((f) => sameName(f.name, name));

  if (friend) return { color: friend.color, bold: clanRule?.bold ?? false };
  if (clanRule) return { color: clanRule.color, bold: clanRule.bold };
  return null;
}

// ── the lists ────────────────────────────────────────────────────────────
// Add people here. Name exactly as Krunker shows it; the colour can be any
// CSS colour, and hex is the convention.

/** Friends, by in-game name. */
export const FRIENDS: readonly FriendHighlight[] = [
  // { name: 'illegal', color: '#48eaff' },
];

/** Clans, by tag, without the brackets Krunker draws around them. */
export const CLANS: readonly ClanHighlight[] = [
  // { tag: 'Fame', color: '#e4552e', bold: true },
];
