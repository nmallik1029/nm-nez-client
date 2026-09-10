/**
 * Lobby list parsing, filtering and ranking.
 *
 * No `fetch` and no DOM in here. A raw lobby is a positional array
 * with no field names, so this is where all the fiddly logic ends up, and that
 * makes it the part the tests need to be able to reach.
 */

/**
 * Gamemode names by the server's own id. `game[4].g` is a position in this
 * array, so the order matters. Appending is fine. Inserting or reordering
 * quietly mislabels every lobby.
 */
export const GAMEMODES: readonly string[] = [
  'Free for All', 'Team Deathmatch', 'Hardpoint', 'Capture the Flag', 'Parkour',
  'Hide & Seek', 'Infected', 'Race', 'Last Man Standing', 'Simon Says',
  'Gun Game', 'Prop Hunt', 'Boss Hunt', 'Classic FFA', 'Deposit',
  'Stalker', 'King of the Hill', 'One in the Chamber', 'Trade', 'Kill Confirmed',
  'Defuse', 'Sharp Shooter', 'Traitor', 'Raid', 'Blitz',
  'Domination', 'Squad Deathmatch', 'Kranked FFA', 'Team Defender', 'Deposit FFA',
  'Chaos Snipers', 'Bighead FFA',
];

/**
 * Modes offered as filter chips.
 *
 * A trimmed-down set. All 32 would be an unusable wall of chips and most are
 * events or variants that are never live anyway. Leaving one out doesn't hide
 * its lobbies, it just means you can't filter *for* it.
 */
export const MODE_FILTER_CHOICES: readonly string[] = [
  'Free for All',
  'Team Deathmatch',
  'Hardpoint',
  'Capture the Flag',
  'Parkour',
  'Infected',
  'Gun Game',
  'Kill Confirmed',
  'Sharp Shooter',
  'Raid',
  'Domination',
  'Prop Hunt',
  'Hide & Seek',
  'One in the Chamber',
];

/**
 * Short labels for the scan feed, where a full mode name would swamp the line.
 * Anything unlisted falls back to its uppercased name.
 */
const SHORT_MODES: Readonly<Record<string, string>> = {
  'Free for All': 'FFA',
  'Team Deathmatch': 'TDM',
  'Capture the Flag': 'CTF',
  Hardpoint: 'HP',
  'Kill Confirmed': 'KC',
  'One in the Chamber': 'OITC',
  'Last Man Standing': 'LMS',
  'King of the Hill': 'KOTH',
  'Gun Game': 'GG',
  'Sharp Shooter': 'SS',
  'Squad Deathmatch': 'SDM',
  'Classic FFA': 'CFFA',
  'Kranked FFA': 'KFFA',
  'Deposit FFA': 'DFFA',
  'Prop Hunt': 'PROP',
  'Hide & Seek': 'H&S',
};

export function shortMode(gamemode: string): string {
  return SHORT_MODES[gamemode] ?? gamemode.toUpperCase();
}

/**
 * Official maps in the order Krunker hosts their preview images. A map's
 * position here is its image index (map_0.png is Burg), so this is another
 * array where order matters. Community maps aren't indexed and have no
 * thumbnail at all.
 */
export const MAP_ICON_INDICES: readonly string[] = [
  'Burg', 'Littletown', 'Sandstorm', 'Subzero', 'Undergrowth', 'Shipment',
  'Freight', 'Lostworld', 'Citadel', 'Oasis', 'Kanji', 'Industry', 'Lumber',
  'Evacuation', 'Site', 'SkyTemple', 'Lagoon', 'Bureau', 'Tortuga', 'Tropicano',
  'Krunk_Plaza', 'Arena', 'Habitat', 'Atomic', 'Old_Burg', 'Throwback',
  'Stockade', 'Facility', 'Clockwork', 'Laboratory', 'Shipyard', 'Soul Sanctum',
  'Bazaar', 'Erupt', 'HQ', 'Khepri', 'Lush', 'Vivo', 'Slide Moonlight',
  'Eterno Simulator',
];

/** Maps offered in the settings picker. */
export const MAP_FILTER_CHOICES: readonly string[] = [
  'Burg', 'Littletown', 'Sandstorm', 'Subzero', 'Undergrowth', 'Freight',
  'Lostworld', 'Citadel', 'Oasis', 'Kanji', 'Industry', 'Lumber', 'Evacuation',
  'Site', 'SkyTemple', 'Lagoon', 'Tropicano', 'Habitat', 'Atomic', 'Old_Burg',
  'Throwback', 'Clockwork', 'Bazaar', 'Erupt', 'HQ', 'Lush', 'Vivo',
  'Slide Moonlight', 'Eterno Simulator', 'Eterno Jump',
];

/**
 * Compare-safe form of a map name. The live list and the picker disagree on
 * casing and separators (`slide_moonlight` against `Slide Moonlight`), so
 * flatten both before comparing.
 */
export function normalizeMapId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const MAP_ICON_BY_NORM = new Map(
  MAP_ICON_INDICES.map((name, index) => [normalizeMapId(name), index]),
);

/** Preview image URL, or null for a community map with no hosted icon. */
export function mapIconUrl(map: string): string | null {
  const index = MAP_ICON_BY_NORM.get(normalizeMapId(map));
  return index === undefined ? null : `https://assets.krunker.io/img/maps/map_${index}.png`;
}

/**
 * Region codes, read off the live game-list rather than copied from another
 * client.
 *
 * SSS ("supersecretserver") really is in service and was hosting 15 lobbies
 * when I checked, but it's missing from the lists both clients I looked at
 * use, so they quietly hide those lobbies any time a region filter is on.
 */
export const REGIONS: readonly string[] = [
  'SV', 'TOK', 'FRA', 'MBI', 'SYD', 'SIN', 'DAL', 'BHN', 'BRZ', 'NY', 'SSS',
];

export const REGION_NAMES: Readonly<Record<string, string>> = {
  SV: 'Silicon Valley',
  TOK: 'Tokyo',
  FRA: 'Frankfurt',
  MBI: 'Mumbai',
  SYD: 'Sydney',
  SIN: 'Singapore',
  DAL: 'Dallas',
  BHN: 'Bahrain',
  BRZ: 'Brazil',
  NY: 'New York',
  SSS: 'Secret Server',
};

/** Maps the ping endpoint's server keys onto the region codes in a game id. */
export const SERVER_REGION_KEYS: Readonly<Record<string, string>> = {
  'us-ca-sv': 'SV',
  'jb-hnd': 'TOK',
  'de-fra': 'FRA',
  'as-mb': 'MBI',
  'au-syd': 'SYD',
  sgp: 'SIN',
  'us-tx': 'DAL',
  'me-bhn': 'BHN',
  brz: 'BRZ',
  'us-nj': 'NY',
  sss: 'SSS',
};

export interface Lobby {
  readonly gameID: string;
  readonly region: string;
  readonly map: string;
  readonly gamemode: string;
  readonly playerCount: number;
  readonly playerLimit: number;
  /** Seconds left in the round. 0 means untimed, NOT "about to end". */
  readonly remainingTime: number;
}

export interface MatchmakerFilter {
  /** Empty means "any". */
  regions: string[];
  gamemodes: string[];
  /** Selected map names. Empty means any map. */
  maps: string[];
  minPlayers: number;
  maxPlayers: number;
  /** Skip rounds about to end. Seconds. */
  minRemainingTime: number;
  /** Untimed lobbies are usually hosted customs rather than public rounds. */
  allowUntimed: boolean;
  sortBy: 'ping' | 'players';
}

export const DEFAULT_FILTER: MatchmakerFilter = {
  regions: [],
  gamemodes: [],
  maps: [],
  minPlayers: 2,
  maxPlayers: 20,
  minRemainingTime: 60,
  allowUntimed: false,
  sortBy: 'ping',
};

/**
 * One raw `game-list` entry into a Lobby.
 *
 * The payload is positional with no field names, so every access is a guess
 * and has to be checked. If Krunker changes the shape we want to drop the
 * entry, not hand back a lobby full of undefined.
 *
 *   [0] game id, "REGION:xxxxx"   [2] players   [3] capacity
 *   [4] { i: map, g: gamemode }   [5] seconds remaining
 */
export function parseLobby(raw: unknown): Lobby | null {
  if (!Array.isArray(raw)) return null;
  // Array.isArray narrows unknown to any[], which makes every index below an
  // implicit any and undoes all the checking that follows.
  const entry = raw as unknown[];

  const gameID = entry[0];
  const playerCount = entry[2];
  const playerLimit = entry[3];
  const info = entry[4] as { i?: unknown; g?: unknown } | undefined;
  const remainingTime = entry[5];

  if (typeof gameID !== 'string' || gameID === '') return null;
  if (typeof playerCount !== 'number' || typeof playerLimit !== 'number') return null;
  if (info === null || typeof info !== 'object') return null;

  const region = gameID.split(':')[0] ?? '';
  if (region === '') return null;

  const modeIndex = typeof info.g === 'number' ? info.g : -1;

  return {
    gameID,
    region,
    map: typeof info.i === 'string' ? info.i : 'Unknown',
    // Krunker adds modes faster than a hardcoded table can keep up. Id 35 is
    // live right now and isn't on any published list. Naming the number keeps
    // those lobbies apart and filterable instead of dumping them all into one
    // useless "Unknown" pile.
    gamemode: GAMEMODES[modeIndex] ?? (modeIndex >= 0 ? `Mode ${modeIndex}` : 'Unknown'),
    playerCount,
    playerLimit,
    remainingTime: typeof remainingTime === 'number' ? remainingTime : 0,
  };
}

/** Human-friendly map name: `sand_storm` becomes `Sand Storm`. */
export function prettyMap(map: string): string {
  return map
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function passesFilter(
  lobby: Lobby,
  filter: MatchmakerFilter,
  currentGameID?: string,
): boolean {
  // Never offer the lobby you're already in.
  if (currentGameID !== undefined && currentGameID !== '' && lobby.gameID === currentGameID) {
    return false;
  }
  // Can't join a full server, however good it looks.
  if (lobby.playerCount >= lobby.playerLimit) return false;

  if (filter.regions.length > 0 && !filter.regions.includes(lobby.region)) return false;
  if (filter.gamemodes.length > 0 && !filter.gamemodes.includes(lobby.gamemode)) return false;

  if (filter.maps.length > 0) {
    // Both sides normalised. Server says slide_moonlight, picker says
    // Slide Moonlight.
    const wanted = filter.maps.map(normalizeMapId);
    if (!wanted.includes(normalizeMapId(lobby.map))) return false;
  }

  if (lobby.playerCount < filter.minPlayers) return false;
  if (lobby.playerCount > filter.maxPlayers) return false;

  // 0 means no round timer, not no time left. Read it as an expiring round
  // and you hide every parkour and custom lobby.
  if (lobby.remainingTime <= 0) return filter.allowUntimed;
  return lobby.remainingTime >= filter.minRemainingTime;
}

/** Unknown regions sort last rather than first. */
const UNKNOWN_PING = Number.MAX_SAFE_INTEGER;

export function sortLobbies(
  lobbies: readonly Lobby[],
  filter: MatchmakerFilter,
  pings: Readonly<Record<string, number>> = {},
): Lobby[] {
  const pingOf = (region: string): number => {
    const value = pings[region];
    return value === undefined || value < 0 ? UNKNOWN_PING : value;
  };

  // Copy first. Sorting the caller's array in place is a nasty surprise when
  // that same list is on screen.
  return [...lobbies].sort((a, b) => {
    if (filter.sortBy === 'players') {
      if (a.playerCount !== b.playerCount) return b.playerCount - a.playerCount;
      return pingOf(a.region) - pingOf(b.region);
    }
    const pa = pingOf(a.region);
    const pb = pingOf(b.region);
    if (pa !== pb) return pa - pb;
    return b.playerCount - a.playerCount;
  });
}

/** `185` becomes `3:05`; untimed rounds read as a dash. */
export function formatRemaining(seconds: number): string {
  if (seconds <= 0) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/** The URL that joins a lobby. */
export function joinUrl(gameID: string): string {
  return `https://krunker.io/?game=${encodeURIComponent(gameID)}`;
}

export interface ScanPlanOptions {
  /** Total wall time the whole animation may take. */
  readonly budgetMs?: number;
  /** Preferred gap between frames. */
  readonly baseTickMs?: number;
  /** Never go faster than this, or the feed is an unreadable blur. */
  readonly minTickMs?: number;
}

export interface ScanPlan {
  /** Lobby indices to show, in order. */
  readonly indices: readonly number[];
  readonly tickMs: number;
}

/**
 * Which lobbies the scan animation shows, and how fast.
 *
 * The list is often 400 long. Flipping through all of it at a readable speed
 * takes half a minute and nobody wants to sit through that before every match,
 * so the animation gets a time budget:
 *
 *  - Long list: sample evenly at a steady tick, so it still sweeps the whole
 *    list instead of stopping a fifth of the way in.
 *  - Short list: show everything and stretch the tick to fill the budget, down
 *    to a floor, so five lobbies don't flash past in 50ms.
 *
 * This is presentation only. Filtering always looks at every lobby; the feed
 * is a progress bar, not the search.
 */
export function planScan(total: number, options: ScanPlanOptions = {}): ScanPlan {
  const budgetMs = options.budgetMs ?? 1600;
  const baseTickMs = options.baseTickMs ?? 28;
  const minTickMs = options.minTickMs ?? 16;

  if (total <= 0) return { indices: [], tickMs: baseTickMs };

  const maxFrames = Math.max(1, Math.floor(budgetMs / baseTickMs));

  if (total > maxFrames) {
    const step = total / maxFrames;
    const indices: number[] = [];
    for (let i = 0; i < maxFrames; i += 1) {
      indices.push(Math.min(total - 1, Math.floor(i * step)));
    }
    // Always end on the last lobby, so "checked N of N" isn't a lie.
    if (indices[indices.length - 1] !== total - 1) indices.push(total - 1);
    return { indices, tickMs: baseTickMs };
  }

  const indices = Array.from({ length: total }, (_, i) => i);
  const tickMs = Math.max(minTickMs, Math.min(baseTickMs, Math.floor(budgetMs / total)));
  return { indices, tickMs };
}
