import { MAX_BADGES, type ClanBadges, type PlayerBadges } from './badges';
import { isPlainObject, normaliseSettingsPayload, type SettingsPayload } from './settings-import';

/**
 * What the team publishes for every client: who wears which badge, and the
 * settings library.
 *
 * One JSON file in the repo, `assets/content/client.json`, read by every
 * client at startup. So handing a content creator their badge, or adding a
 * pro's settings to the library, is an edit to that file on main, and every
 * client has it the next time it starts. No release. The pictures behind a
 * badge are the exception: those ship with the client, in `assets/badges/`,
 * so a new kind of badge still needs a release before anyone can see it.
 *
 * A release carries the file as it was at build time, which is what a client
 * that cannot reach either host falls back to. See main/client-content.ts for
 * the fetch and the cache, and assets/content/README.md for the format.
 *
 * The file comes off the network, so nothing in it is trusted: everything
 * below is checked and clamped, and anything that fails is dropped rather
 * than passed along. Settings from it go through the same checks as a paste.
 */

/**
 * The pro scenes each region's placements come from, shown as the server's
 * icon on a pick: NACK for North America, KPC for Europe. The icon is a badge
 * picture (`assets/badges/<badge>.png`), and the tag is what stands in for it
 * until one ships.
 */
export const LIBRARY_REGIONS = {
  NA: { tag: 'NACK', badge: 'nack', label: 'North America' },
  EU: { tag: 'KPC', badge: 'kpc', label: 'Europe' },
} as const;

export type LibraryRegion = keyof typeof LIBRARY_REGIONS;

/** The badge a pick marked as pro settings wears, the same picture as on the scoreboards. */
export const PRO_BADGE = 'pro';

/** 1st, 2nd or 3rd in a tournament, which is gold, silver and bronze on the pick. */
export type Placement = 1 | 2 | 3;

export interface LibraryEntry {
  /** Stable, so a client can tell entries apart across edits. */
  readonly id: string;
  /** Whose settings these are, as the pick is titled. */
  readonly name: string;
  /** When they were posted, `YYYY-MM-DD`. Every pick has one; the list is newest first. */
  readonly date: string;
  /** Where they placed with these, or null for settings posted outside a tournament. */
  readonly placement: Placement | null;
  /** Which region's pro scene, or null. */
  readonly region: LibraryRegion | null;
  /** Pro settings: wears the pro badge. */
  readonly pro: boolean;
  /** The tournament, or ''. */
  readonly event: string;
  /** Who posted them, if not the player themselves, or ''. */
  readonly author: string;
  /** A line about them, or ''. */
  readonly description: string;
  /**
   * An in-game screenshot with these settings, a file name in
   * `assets/content/screenshots/`, or ''. Fetched the first time the pick is
   * opened, not shipped: see main/client-content.ts.
   */
  readonly screenshot: string;
  readonly settings: SettingsPayload;
}

export interface ClientContent {
  readonly players: readonly PlayerBadges[];
  readonly clans: readonly ClanBadges[];
  readonly settings: readonly LibraryEntry[];
}

export const EMPTY_CLIENT_CONTENT: ClientContent = { players: [], clans: [], settings: [] };

/** The file in the repo. Main, not a commit: the point is that edits reach clients unreleased. */
export const CONTENT_REPO = {
  owner: 'nmallik1029',
  repo: 'nm-nez-client',
  branch: 'main',
  path: 'assets/content/client.json',
} as const;

/** The folder beside the content file the picks' screenshots live in, in the repo. */
export const SCREENSHOTS_PATH = 'assets/content/screenshots';

/**
 * Where to read a file in the repo from, in the order to try: GitHub's raw
 * server, then jsDelivr's copy of the same branch, for the networks that
 * block GitHub (the reason kill streak packs have the same fallback).
 * jsDelivr can lag main by a while, so it is only ever second.
 */
export function repoSources(path: string): string[] {
  const { owner, repo, branch } = CONTENT_REPO;
  return [
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`,
    `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${path}`,
  ];
}

/** The content file's own addresses. */
export function contentSources(): string[] {
  return repoSources(CONTENT_REPO.path);
}

/** Far past anything the team will write by hand. A cap, so a bad answer cannot be huge. */
export const MAX_CONTENT_BYTES = 1024 * 1024;

/**
 * A screenshot's file name: plain, and a picture. Checked before it goes into
 * an address or a path, so a pick cannot point anywhere but that folder.
 */
export const SCREENSHOT_NAME = /^[a-z0-9][a-z0-9_.-]{0,95}\.(png|jpe?g|webp)$/i;

/** A screenshot at a size worth showing is a few hundred KB; this is room to spare. */
export const MAX_SCREENSHOT_BYTES = 3 * 1024 * 1024;

const MAX_PLAYERS = 2000;
const MAX_CLANS = 500;
const MAX_LIBRARY = 200;
const MAX_NAME = 32;
const MAX_ENTRY_NAME = 48;
const MAX_DESCRIPTION = 300;
/** A badge id is a file name in assets/badges, without the extension. */
const BADGE_ID = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const ENTRY_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/**
 * The file as the client uses it, or null when it is not the file at all.
 *
 * Null only for something that is not an object, which is what tells the
 * caller to fall back to the copy it had. A file that is an object but has
 * nothing valid in a section is that section empty, which is a legitimate
 * thing for the team to publish.
 */
export function normaliseClientContent(raw: unknown): ClientContent | null {
  if (!isPlainObject(raw)) return null;
  const badges = isPlainObject(raw['badges']) ? raw['badges'] : {};
  return {
    players: badgeEntries(badges['players'], 'name', MAX_PLAYERS).map(([name, list]) => ({ name, badges: list })),
    clans: badgeEntries(badges['clans'], 'tag', MAX_CLANS).map(([tag, list]) => ({ tag, badges: list })),
    settings: libraryEntries(raw['settings']),
  };
}

function badgeEntries(raw: unknown, key: 'name' | 'tag', max: number): [string, string[]][] {
  if (!Array.isArray(raw)) return [];
  const out: [string, string[]][] = [];
  for (const item of raw) {
    if (out.length >= max) break;
    if (!isPlainObject(item)) continue;
    const who = cleanText(item[key], MAX_NAME);
    if (who === '' || !Array.isArray(item['badges'])) continue;
    const list: string[] = [];
    for (const id of item['badges'] as unknown[]) {
      if (typeof id !== 'string') continue;
      const clean = id.trim().toLowerCase();
      if (!BADGE_ID.test(clean) || list.includes(clean)) continue;
      list.push(clean);
      if (list.length === MAX_BADGES) break;
    }
    if (list.length > 0) out.push([who, list]);
  }
  return out;
}

/**
 * Every pick in the file that has what a pick needs: an id, a name, a real
 * date and settings. Anything less is dropped, so a typo in one entry costs
 * that entry and not the library. The rest of the fields are optional and
 * fall back to nothing when they are not something this client knows.
 */
function libraryEntries(raw: unknown): LibraryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: LibraryEntry[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (out.length >= MAX_LIBRARY) break;
    if (!isPlainObject(item)) continue;
    const id = typeof item['id'] === 'string' ? item['id'].trim().toLowerCase() : '';
    const name = cleanText(item['name'], MAX_ENTRY_NAME);
    const date = cleanDate(item['date']);
    if (!ENTRY_ID.test(id) || seen.has(id) || name === '' || date === '') continue;
    const settings = normaliseSettingsPayload(item['settings']);
    if (!settings) continue;
    seen.add(id);
    const screenshot = typeof item['screenshot'] === 'string' ? item['screenshot'].trim() : '';
    out.push({
      id,
      name,
      date,
      placement: cleanPlacement(item['placement']),
      region: cleanRegion(item['region']),
      pro: item['pro'] === true,
      event: cleanText(item['event'], MAX_ENTRY_NAME),
      author: cleanText(item['author'], MAX_NAME),
      description: cleanText(item['description'], MAX_DESCRIPTION),
      screenshot: SCREENSHOT_NAME.test(screenshot) ? screenshot : '',
      settings,
    });
  }
  return out;
}

/**
 * The order the library shows them in: newest first, and on the same day the
 * winner before second before third, then anything that did not place.
 */
export function sortLibrary(entries: readonly LibraryEntry[]): LibraryEntry[] {
  const rank = (entry: LibraryEntry): number => entry.placement ?? 4;
  return [...entries].sort(
    (a, b) => b.date.localeCompare(a.date) || rank(a) - rank(b) || a.name.localeCompare(b.name),
  );
}

/** `YYYY-MM-DD` and a day that exists, or ''. */
function cleanDate(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const text = raw.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return '';
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const real =
    parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  return real ? text : '';
}

/** 1, 2 or 3, as a number or the text of one. Null for anything else, which is "did not place". */
function cleanPlacement(raw: unknown): Placement | null {
  const value = typeof raw === 'string' ? Number(raw.trim()) : raw;
  return value === 1 || value === 2 || value === 3 ? value : null;
}

/** A region the client has a scene for, by its code (`NA`) or its tag (`NACK`). Null otherwise. */
function cleanRegion(raw: unknown): LibraryRegion | null {
  if (typeof raw !== 'string') return null;
  const wanted = raw.trim().toUpperCase();
  for (const [code, region] of Object.entries(LIBRARY_REGIONS)) {
    if (wanted === code || wanted === region.tag) return code as LibraryRegion;
  }
  return null;
}

/** One line of text, whitespace tidied, clamped. '' for anything that is not text. */
function cleanText(raw: unknown, max: number): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\s+/g, ' ').trim().slice(0, max).trim();
}
