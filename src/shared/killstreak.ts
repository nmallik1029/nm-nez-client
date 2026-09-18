/**
 * Kill streak sounds: what main and the page have to agree on.
 *
 * A pack is a folder named by its id, holding `<id>_1.mp3` for the first kill
 * of a streak, `<id>_2.mp3` for the second, and so on, with an optional
 * `<id>_N.png` banner beside each. The client knows a set of them by name and
 * downloads one when somebody installs it (main/killpack-install.ts), and
 * anyone can add their own to `swap/sounds/killstreak`; one of theirs with the
 * same id as an installed pack replaces it. Main lists what is there; the page
 * plays it.
 *
 * The files are fetched from a krunker.io address that does not exist, and
 * main answers it from disk the same way the resource swapper answers a
 * swapped asset, so only the pack in use is ever loaded and the page never
 * sees a path. It is its own narrow route rather than a job for the swapper,
 * because the swapper having anything to serve means intercepting every
 * asset the game loads, and shipping packs to everyone would otherwise mean
 * doing that on every profile.
 */

export interface KillPack {
  /** The folder name, and the prefix on every file in it. */
  readonly id: string;
  /** From `pack.json` if the folder has one, otherwise made from the id. */
  readonly name: string;
  /** Contiguous from 1. A pack with none is not listed at all. */
  readonly sounds: number;
  /** Contiguous from 1, and 0 for a pack that is sound only. */
  readonly banners: number;
  /**
   * How many themes it comes in, 1 for most. Valorant sells some skin lines
   * in several colours or themes, each with its own banner: the first is
   * `<id>_<n>.png`, and theme k is `<id>_v<k>_<n>.png` beside it, numbered
   * from 2 with no gaps and each with as many banners as the first.
   */
  readonly variants: number;
  /**
   * For each theme past the first, how many sounds of its own it has, or 0
   * for one that plays the first theme's. Most share them; a few lines sound
   * different per theme (ORA by OneTap, Forsaken's Gold), and those have
   * `<id>_v<k>_<n>.mp3` beside their banners.
   */
  readonly variantSounds: readonly number[];
  /** What each theme is called, from `pack.json`, or none: every theme or no theme. */
  readonly variantNames: readonly string[];
}

/** A pack the client can download, and has not. */
export interface AvailablePack extends KillPack {
  /** The whole download, for the tile to say what pressing Install costs. */
  readonly bytes: number;
}

/** What the editor draws: every pack there is, each either on disk or not. */
export interface KillPackListing {
  /** On disk and playable: the ones installed and the user's own. */
  readonly installed: readonly KillPack[];
  /**
   * The installed ones the client downloaded, which it can take off the disk
   * again. Not the user's own: those are theirs to delete, from their folder.
   */
  readonly removable: readonly string[];
  /** The rest of the catalog, each one an Install button. */
  readonly available: readonly AvailablePack[];
}

/**
 * How far a scan counts before it stops looking.
 *
 * Valorant's own go to six. The cap is not a rule about packs, it is what
 * stops a folder with a thousand numbered files turning a listing into a
 * thousand existence checks.
 */
export const MAX_TIERS = 12;

/** The most colours a pack is looked for in. Valorant's go to four. */
export const MAX_VARIANTS = 8;

/** Where the page asks for pack files. See the note at the top. */
export const KILL_PACK_BASE = 'https://assets.krunker.io/sounds/killstreak/';

/**
 * The pack played when none has been picked: Valorant's own stock sounds,
 * which are the ones anyone switching this on expects to hear first.
 */
export const DEFAULT_PACK_ID = 'default';

/**
 * The pack a config means: the one it names if it is still there, otherwise
 * the stock one, otherwise the first there is. So switching this on with
 * nothing picked yet still plays something, and deleting the chosen folder
 * does not leave it silent.
 */
export function pickPack(id: string, list: readonly KillPack[]): KillPack | null {
  return (
    list.find((pack) => pack.id === id) ??
    list.find((pack) => pack.id === DEFAULT_PACK_ID) ??
    list[0] ??
    null
  );
}

/**
 * Is this safe to use as a pack id?
 *
 * It is a folder name on one side and part of a URL on the other, and it is
 * stored in config the page can write to, so it is checked rather than
 * escaped: no dots, no slashes, nothing that needs encoding.
 */
export function isPackId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value);
}

/**
 * Which tier to play for this streak, or 0 for nothing.
 *
 * Past the last one, the last one again. A pack with five sounds on a
 * seven-kill streak plays its fifth for the sixth and seventh, which is what
 * every script these packs came from did, and is a better answer than going
 * quiet at the moment the streak is most worth hearing.
 */
export function tierFor(streak: number, count: number): number {
  if (count <= 0 || streak <= 0) return 0;
  return Math.min(Math.floor(streak), count);
}

/**
 * A pack file's address, in theme `variant`. For a sound, pass the theme only
 * if it has sounds of its own: see `soundVariant`.
 */
export function packFileUrl(id: string, tier: number, kind: 'sound' | 'banner', variant = 1): string {
  return `${KILL_PACK_BASE}${id}/${id}${variant > 1 ? `_v${variant}` : ''}_${tier}.${kind === 'sound' ? 'mp3' : 'png'}`;
}

/** The theme whose sounds theme `variant` plays: its own, or the first's. */
export function soundVariant(pack: Pick<KillPack, 'variantSounds'>, variant: number): number {
  return variant > 1 && (pack.variantSounds[variant - 2] ?? 0) > 0 ? variant : 1;
}

/** How many sounds theme `variant` plays. */
export function soundCount(pack: Pick<KillPack, 'sounds' | 'variantSounds'>, variant: number): number {
  const own = soundVariant(pack, variant);
  return own > 1 ? (pack.variantSounds[own - 2] ?? 0) : pack.sounds;
}

/**
 * Packs that became a theme of another. Each was its own card until it turned
 * out to be the same line: the same sounds with another banner, or a theme
 * Valorant shows on the same gun. Its old id, and colour k of it, are theme
 * `variants[k - 1]` of `id` now. A pick of one moves across (see visuals.ts)
 * and an installed copy is deleted (see killpack-install.ts), since the
 * catalog no longer has it to keep up to date.
 */
export const RETIRED_PACKS: Readonly<Record<string, { readonly id: string; readonly variants: readonly number[] }>> = {
  'bubblegum-deathwish-pink': { id: 'bubblegum-deathwish', variants: [1] },
  'bubblegum-deathwish-orange': { id: 'bubblegum-deathwish', variants: [2] },
  'bubblegum-deathwish-red': { id: 'bubblegum-deathwish', variants: [3] },
  'bubblegum-deathwish-green': { id: 'bubblegum-deathwish', variants: [4] },
  'prime-2-0': { id: 'prime', variants: [2] },
  // Reaver Ep 5 was Reaver, byte for byte; V25's first colour is Prelude to Chaos's.
  'reaver-ep-5': { id: 'reaver', variants: [1] },
  'reaver-v26': { id: 'reaver', variants: [2, 3, 4, 5] },
  'prelude-to-chaos-v25': { id: 'prelude-to-chaos', variants: [1, 2, 3, 4] },
  'ora-by-onetap-renegade': { id: 'ora-by-onetap', variants: [2] },
  'ora-by-onetap-raja': { id: 'ora-by-onetap', variants: [3] },
  'ora-by-onetap-lawyer': { id: 'ora-by-onetap', variants: [4] },
  'ora-by-onetap-ignition': { id: 'ora-by-onetap', variants: [5] },
  'radiant-entertainment-system-knockout': { id: 'radiant-entertainment-system', variants: [2] },
  'radiant-entertainment-system-dance-fever': { id: 'radiant-entertainment-system', variants: [3] },
};

/** Where a retired pack's theme `variant` lives now, or null for a pack that is not retired. */
export function retiredPack(id: string, variant = 1): { id: string; variant: number } | null {
  const to = Object.prototype.hasOwnProperty.call(RETIRED_PACKS, id) ? RETIRED_PACKS[id] : undefined;
  if (!to) return null;
  return { id: to.id, variant: to.variants[variant - 1] ?? to.variants[0] ?? 1 };
}

/**
 * The colour a pack's banners show in: the one picked for it, if the pack has
 * that many, and its first otherwise. A pick outlives the pack it was made on
 * being replaced by one of the user's own with fewer colours.
 */
export function variantFor(pack: Pick<KillPack, 'id' | 'variants'>, picks: Readonly<Record<string, number>>): number {
  const pick = picks[pack.id];
  return typeof pick === 'number' && Number.isInteger(pick) && pick >= 1 && pick <= pack.variants ? pick : 1;
}

/** `prelude-to-chaos` to `Prelude To Chaos`, for a pack with no name of its own. */
export function nameFromId(id: string): string {
  return id
    .split('-')
    .filter((word) => word !== '')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
