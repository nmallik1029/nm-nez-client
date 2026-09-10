import { net } from 'electron';
import { parseLobby, SERVER_REGION_KEYS, type Lobby } from '../shared/matchmaker';
import { tcpPing } from './net/ping';

/**
 * Talks to Krunker's matchmaker service.
 *
 * In main rather than the page, which keeps the network work off the render
 * thread while a scan runs. Region latency uses the same TCP probe as the
 * real-ping feature rather than shelling out to `ping`: ICMP is routinely
 * deprioritised or dropped, and a connect to the actual game port is closer
 * to how the game will feel anyway.
 */
const GAME_LIST_URL = 'https://matchmaker.krunker.io/game-list?hostname=krunker.io';
const PING_LIST_URL = 'https://matchmaker.krunker.io/ping-list?hostname=krunker.io';

const REQUEST_TIMEOUT_MS = 10_000;
/** Region latency barely moves, and re-probing ten servers per scan is silly. */
const PING_CACHE_MS = 60_000;

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await net.fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

/** Every joinable lobby the service knows about. Filtering happens elsewhere. */
export async function fetchLobbies(): Promise<Lobby[]> {
  const payload = await fetchJson(GAME_LIST_URL);
  const games = (payload as { games?: unknown }).games;
  if (!Array.isArray(games)) throw new Error('Unexpected game-list shape');

  const lobbies: Lobby[] = [];
  for (const entry of games) {
    const lobby = parseLobby(entry);
    // Skip a malformed entry rather than failing the scan. One bad lobby
    // shouldn't cost you a match.
    if (lobby) lobbies.push(lobby);
  }
  return lobbies;
}

let pingCache: Record<string, number> = {};
let pingCacheAt = 0;

/**
 * Round-trip to each region, keyed by the region code in game ids. Never
 * rejects. Sorting by player count alone is still useful, so a failed probe
 * costs you ranking quality and not the feature.
 */
export async function fetchRegionPings(force = false): Promise<Record<string, number>> {
  if (!force && Date.now() - pingCacheAt < PING_CACHE_MS && Object.keys(pingCache).length > 0) {
    return pingCache;
  }

  let servers: Record<string, unknown>;
  try {
    servers = (await fetchJson(PING_LIST_URL)) as Record<string, unknown>;
  } catch {
    return pingCache;
  }
  if (servers === null || typeof servers !== 'object') return pingCache;

  const results: Record<string, number> = {};

  await Promise.all(
    Object.entries(servers).map(async ([serverKey, address]) => {
      const region = SERVER_REGION_KEYS[serverKey];
      if (region === undefined || typeof address !== 'string') return;

      // Addresses arrive as "host:port".
      const separator = address.lastIndexOf(':');
      const host = separator === -1 ? address : address.slice(0, separator);
      const port = separator === -1 ? 443 : Number(address.slice(separator + 1));
      if (host === '' || !Number.isInteger(port) || port <= 0) return;

      const ms = await tcpPing(host, port);
      if (ms >= 0) results[region] = ms;
    }),
  );

  // Every probe failed, so keep what we had. A blip shouldn't wipe good data.
  if (Object.keys(results).length > 0) {
    pingCache = results;
    pingCacheAt = Date.now();
  }
  return pingCache;
}

/** Drop the ping cache. For tests and manual refresh. */
export function clearPingCache(): void {
  pingCache = {};
  pingCacheAt = 0;
}
