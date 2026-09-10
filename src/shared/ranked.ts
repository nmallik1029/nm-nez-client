/**
 * Ranked matchmaking protocol.
 *
 * Krunker's ranked queue is a WebSocket the game page normally owns. The only
 * thing tying it to the page is an auth token in localStorage, so with that
 * token you can hold the queue anywhere. That's what makes an external queuer
 * work: close the game, keep your place in line.
 *
 * All pure functions here, so the message handling is testable without a
 * socket. The wire format isn't ours and can change under us, so parsing is
 * defensive and anything unfamiliar comes back as `other` rather than throwing.
 */

export const RANKED_QUEUE_WS = 'wss://gamefrontend.svc.krunker.io/v1/matchmaking/queue';

export interface RankedMap {
  /** The number the queue protocol uses. */
  readonly id: number;
  readonly label: string;
}

/** The ranked map pool. Ids are Krunker's, not indexes into this array. */
export const RANKED_MAPS: readonly RankedMap[] = [
  { id: 0, label: 'Burg' },
  { id: 2, label: 'Sandstorm' },
  { id: 4, label: 'Undergrowth' },
  { id: 11, label: 'Industry' },
  { id: 14, label: 'Site' },
  { id: 17, label: 'Bureau' },
  { id: 39, label: 'Eterno Simulator' },
];

export const RANKED_REGIONS: readonly { readonly id: string; readonly label: string }[] = [
  { id: 'na', label: 'North America' },
  { id: 'eu', label: 'Europe' },
  { id: 'as', label: 'Asia' },
];

export function rankedMapLabel(id: number): string {
  return RANKED_MAPS.find((m) => m.id === id)?.label ?? `Map ${id}`;
}

/**
 * Region label out of whatever the assignment carries.
 *
 * The server's region string isn't one of our ids, it comes with a prefix on
 * it, so try the raw value, then the value minus a two-character prefix, and
 * failing that show it as-is rather than making a name up.
 */
export function rankedRegionLabel(raw: string): string {
  const direct = RANKED_REGIONS.find((r) => r.id === raw.toLowerCase());
  if (direct) return direct.label;

  const trimmed = raw.slice(2).toLowerCase();
  const stripped = RANKED_REGIONS.find((r) => r.id === trimmed);
  if (stripped) return stripped.label;

  // Also handle the prefix being ours rather than theirs.
  const prefix = RANKED_REGIONS.find((r) => raw.toLowerCase().startsWith(r.id));
  return prefix ? prefix.label : raw;
}

export function buildQueueUrl(
  token: string,
  mapIds: readonly number[],
  regionIds: readonly string[],
): string {
  const params = new URLSearchParams({
    token,
    maps: [...mapIds].sort((a, b) => a - b).join(','),
    regions: [...regionIds].join(','),
  });
  return `${RANKED_QUEUE_WS}?${params.toString()}`;
}

/**
 * Coerce an untrusted field to text.
 *
 * String() on an unknown gives you "[object Object]" for anything nested, and
 * that ends up on screen as a region name. Non-primitives come back empty.
 */
function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

export type QueueMessage =
  | { readonly kind: 'matched'; readonly mapId: number; readonly region: string }
  | { readonly kind: 'queued' }
  | { readonly kind: 'cooldown'; readonly seconds: number }
  | { readonly kind: 'fatal'; readonly code: string }
  | { readonly kind: 'other' };

/**
 * Parse one frame from the queue socket. Never throws.
 *
 * A malformed or unfamiliar frame comes back as `other`. Dropping a frame we
 * don't understand beats tearing down a queue somebody has been sitting in for
 * ten minutes.
 */
export function parseQueueMessage(raw: string): QueueMessage {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { kind: 'other' };
  }
  if (data === null || typeof data !== 'object') return { kind: 'other' };

  const message = data as { type?: unknown; payload?: unknown };
  const payload = (message.payload ?? {}) as Record<string, unknown>;

  switch (message.type) {
    case 'QUEUE_STATUS': {
      if (payload['status'] !== 'MATCHED') return { kind: 'queued' };
      const assignment = payload['assignment'] as
        | { extensions?: { map?: unknown; region?: unknown } }
        | undefined;
      const extensions = assignment?.extensions;
      if (!extensions) return { kind: 'other' };

      // The map arrives as a string with stray whitespace.
      const raw = asText(extensions.map).trim();
      if (raw === '') return { kind: 'other' };
      const mapId = Number(raw);
      if (!Number.isInteger(mapId)) return { kind: 'other' };

      return { kind: 'matched', mapId, region: asText(extensions.region) };
    }

    case 'ERROR': {
      if (payload['code'] !== 'COOLDOWN') {
        return { kind: 'fatal', code: asText(payload['code']) || 'ERROR' };
      }
      const inner = (payload['payload'] ?? {}) as Record<string, unknown>;
      const seconds = Number(inner['cooldown']);
      return { kind: 'cooldown', seconds: Number.isFinite(seconds) ? seconds : 0 };
    }

    case 'INTERNAL_ERROR':
      return { kind: 'fatal', code: 'INTERNAL_ERROR' };

    default:
      return { kind: 'other' };
  }
}

/** Strip the quoting Krunker stores around the localStorage token. */
export function normaliseToken(raw: string): string {
  return raw.replace(/"/g, '').replace(/\//g, '').trim();
}

export function formatQueueTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
