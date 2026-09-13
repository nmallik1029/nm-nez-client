/**
 * Badges beside a name on the scoreboards.
 *
 * Two halves, and both are meant to be easy:
 *
 *   the picture   drop a file in `assets/badges/`. Its name is its id, so
 *                 `owner.png` is the badge called `owner`. Nothing else to
 *                 register, and no list of files to keep in step.
 *   who wears it  the two lists at the bottom of this file, the same shape
 *                 as the ones in `highlights.ts`: a person by name, or a
 *                 whole clan by tag.
 *
 * Everything above those lists is machinery and you should not need to touch
 * it to hand someone a badge.
 *
 * Client-side, so these show up for everyone running this client and for
 * nobody else. That is worth saying out loud because it cuts both ways: it
 * is not Krunker's badge system and cannot pretend to be, and it also cannot
 * be spoofed by the player wearing it.
 */

export interface PlayerBadges {
  /** In-game name, matched as Krunker renders it. Case is ignored. */
  readonly name: string;
  /** Badge ids, i.e. file names in `assets/badges/` without the extension. */
  readonly badges: readonly string[];
}

export interface ClanBadges {
  /** Clan tag without its brackets, as it appears in `Name [TAG]`. */
  readonly tag: string;
  readonly badges: readonly string[];
}

/**
 * How many one player can wear at once.
 *
 * The name they sit next to is `overflow:hidden; white-space:nowrap` in
 * Krunker's own stylesheet, so badges do not push a long name into a second
 * line, they eat it. Three is what fits beside a full name at the board's
 * width without the name starting to disappear.
 */
export const MAX_BADGES = 3;

/** Ids are file names, so they are compared the way file names should be. */
function sameId(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Which badges this player wears, in the order they should be drawn.
 *
 * Theirs first, then their clan's, because a badge given to a person is the
 * more specific of the two and should sit closest to their name. Duplicates
 * are dropped, so a clan badge someone also has individually appears once.
 *
 * The lists are arguments so the rules can be tested without putting real
 * people in them; callers pass nothing and get the lists below.
 */
export function badgesFor(
  name: string,
  clan: string | null,
  players: readonly PlayerBadges[] = PLAYER_BADGES,
  clans: readonly ClanBadges[] = CLAN_BADGES,
): readonly string[] {
  const mine = players.find((entry) => sameName(entry.name, name))?.badges ?? [];
  const theirs = clan === null ? [] : (clans.find((entry) => sameId(entry.tag, clan))?.badges ?? []);

  const out: string[] = [];
  for (const id of [...mine, ...theirs]) {
    const clean = id.trim().toLowerCase();
    if (clean === '' || out.some((seen) => sameId(seen, clean))) continue;
    out.push(clean);
    if (out.length === MAX_BADGES) break;
  }
  return out;
}

// ── the lists ────────────────────────────────────────────────────────────
// Add people here. The name is exactly as Krunker shows it, and each badge
// id is the name of a file in `assets/badges/`, without the `.png`.

/** Badges given to a person. */
export const PLAYER_BADGES: readonly PlayerBadges[] = [
  // { name: 'PvlseFN', badges: ['owner'] },
];

/** Badges given to everyone in a clan. */
export const CLAN_BADGES: readonly ClanBadges[] = [
  // { tag: 'Bnto', badges: ['clan'] },
];
