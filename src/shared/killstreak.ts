/**
 * Kill streak sounds: what main and the page have to agree on.
 *
 * A pack is a folder under `swap/sounds/killstreak`, named by its id, holding
 * `<id>_1.mp3` for the first kill of a streak, `<id>_2.mp3` for the second,
 * and so on, with an optional `<id>_N.png` banner beside each. The client
 * ships none. Main lists what is there; the page plays it.
 *
 * The files are fetched from a krunker.io address that does not exist. That
 * is deliberate: the resource swapper answers any krunker.io request whose
 * path matches a file in the swap folder, so `sounds/killstreak/<id>/<id>_3.mp3` is
 * served straight off disk, and only the pack in use is ever loaded. It needs
 * no second route into the filesystem, and the page never sees a path.
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
}

/**
 * How far a scan counts before it stops looking.
 *
 * Valorant's own go to six. The cap is not a rule about packs, it is what
 * stops a folder with a thousand numbered files turning a listing into a
 * thousand existence checks.
 */
export const MAX_TIERS = 12;

/** Where the swapper serves pack files from. See the note at the top. */
export const KILL_PACK_BASE = 'https://assets.krunker.io/sounds/killstreak/';

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

export function packFileUrl(id: string, tier: number, kind: 'sound' | 'banner'): string {
  return `${KILL_PACK_BASE}${id}/${id}_${tier}.${kind === 'sound' ? 'mp3' : 'png'}`;
}

/** `prelude-to-chaos` to `Prelude To Chaos`, for a pack with no name of its own. */
export function nameFromId(id: string): string {
  return id
    .split('-')
    .filter((word) => word !== '')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
