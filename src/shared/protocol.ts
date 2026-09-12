import { KRUNKER_HOST } from '../krunker/constants';
import { BRANDING } from './branding';
import { SERVER_REGION_KEYS } from './matchmaker';

/**
 * `nmnez://` links, and what is allowed through one.
 *
 * A tournament bot posts a button in Discord, the browser hands the link to
 * Windows, Windows starts (or focuses) this client, and the client puts the
 * match lobby up with the right map, teams and rosters already filled in. It
 * is the same contract three other Krunker clients already answer to, which
 * is why the shape below is theirs rather than ours: `<scheme>://game?
 * action=host-comp&mapId=...`. Matching it means a bot that already builds
 * these links only has to learn our scheme name.
 *
 * Everything here is parsing, and it is deliberately strict. A link can come
 * from any page anyone clicks, so the values in one are not trusted input:
 * they are read, checked, clamped and, where they make no sense, dropped. The
 * browser asking "open NM/NZ?" is the consent step, and it is the only one, so
 * nothing past this file should ever see a string it has not been told is
 * sane.
 *
 * Pure, and in `shared/` rather than beside either half, because main reads
 * the command line for one of these and the page acts on it.
 */

export const PROTOCOL_SCHEME = BRANDING.protocolScheme;
export const PROTOCOL_PREFIX = `${PROTOCOL_SCHEME}://`;

/** The one action we answer to. Anything else is somebody else's link. */
const HOST_ACTION = 'host-comp';

/**
 * Caps, in characters. None of these is a limit Krunker publishes; they are
 * "longer than any real value, short enough that a pasted novel cannot end up
 * in a text input".
 */
const MAX_MAP = 64;
const MAX_NAME = 64;
const MAX_ROSTER = 512;
const MAX_URL = 512;
/** Per-class limit, i.e. how many of one weapon a team may field. */
const MAX_CLASS_LIMIT = 99;

export interface CompHostRequest {
  /** A map id or its display name; the host list is searched for both. */
  readonly mapId: string;
  readonly team1Name: string;
  readonly team2Name: string;
  /** `3v3`, as the bot sends it. Empty when it was absent or malformed. */
  readonly teamSize: string;
  /** Comma-separated player names, as Krunker's roster field wants them. */
  readonly team1Players: string;
  readonly team2Players: string;
  readonly spectators: string;
  /** Class name to how many of it a team may field. Empty when unset. */
  readonly classLimits: Readonly<Record<string, number>>;
  /** Where Krunker posts the scoreboard. https only; empty when unset. */
  readonly webhook: string;
  /** A Krunker server key such as `us-nj`. Empty when unset or unknown. */
  readonly region: string;
}

export interface ProtocolRequest {
  readonly kind: 'host-comp';
  readonly host: CompHostRequest;
}

/**
 * Krunker's own server keys, reachable from the short codes a game id uses.
 *
 * Inverted from the matchmaker's table rather than written out again: that
 * one was read off the live game list, and two copies of it would be two
 * things to fix the next time Krunker opens a datacentre.
 */
const REGION_KEY_BY_CODE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(SERVER_REGION_KEYS).map(([key, code]) => [code, key]),
);

/**
 * Short codes other clients use for the same servers.
 *
 * A bot that already builds links for another client will be sending its
 * codes, and being the one client that refuses `MUM` is not a principle worth
 * having.
 */
const REGION_ALIASES: Readonly<Record<string, string>> = {
  MUM: 'MBI',
  ME: 'BHN',
  BR: 'BRZ',
  BRA: 'BRZ',
  TOKYO: 'TOK',
  SYDNEY: 'SYD',
};

/** The `nmnez://` argument out of a command line, if this start came from one. */
export function findProtocolUrl(argv: readonly unknown[]): string | null {
  for (const arg of argv) {
    if (typeof arg !== 'string') continue;
    if (arg.toLowerCase().startsWith(PROTOCOL_PREFIX)) return arg;
  }
  return null;
}

/**
 * Read a link, or refuse it.
 *
 * Null for anything that is not ours and anything whose action we do not
 * implement, so a future `nmnez://` link aimed at some other feature is
 * ignored here rather than half-handled.
 *
 * The host part of the URL is not checked. The bot writes `://game?`, but the
 * action is what says what to do, and keying off a hostname as well would
 * mean two things to keep in step for no gain.
 */
export function parseProtocolUrl(raw: string): ProtocolRequest | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== `${PROTOCOL_SCHEME}:`) return null;

  const params = url.searchParams;
  if (params.get('action') !== HOST_ACTION) return null;

  return {
    kind: 'host-comp',
    host: {
      mapId: text(params, 'mapId', MAX_MAP),
      team1Name: text(params, 'team1Name', MAX_NAME),
      team2Name: text(params, 'team2Name', MAX_NAME),
      teamSize: teamSize(text(params, 'teamSize', MAX_NAME)),
      team1Players: text(params, 'team1Players', MAX_ROSTER),
      team2Players: text(params, 'team2Players', MAX_ROSTER),
      spectators: text(params, 'spectators', MAX_ROSTER),
      classLimits: classLimits(text(params, 'classes', MAX_ROSTER)),
      webhook: webhook(text(params, 'webhook', MAX_URL)),
      region: normaliseRegion(text(params, 'region', MAX_NAME)),
    },
  };
}

/**
 * One parameter, as something safe to put in a text input.
 *
 * Control characters go first. They are invisible in an input, so a name
 * carrying one looks identical to the name without it, and the difference
 * turns up later as a roster entry that never matches a player.
 */
function text(params: URLSearchParams, key: string, max: number): string {
  const raw = params.get(key);
  if (raw === null) return '';

  let out = '';
  for (const character of raw) {
    const code = character.codePointAt(0) ?? 0;
    out += code < 0x20 || code === 0x7f ? ' ' : character;
  }
  return out.trim().slice(0, max);
}

/**
 * `3v3`, or the index Krunker's own dropdown uses, or nothing.
 *
 * Both forms are allowed because the select holds indices and the bot sends
 * labels; whichever arrives, the page matches it against the live options
 * first and only falls back to treating it as an index.
 */
function teamSize(raw: string): string {
  if (/^\d{1,2}v\d{1,2}$/i.test(raw)) return raw.toLowerCase();
  if (/^\d{1,2}$/.test(raw)) return raw;
  return '';
}

/**
 * `{"ak":1,"sniper":2}` as sent, minus anything that is not a class Krunker
 * has a limit input for.
 *
 * A bad entry is dropped rather than failing the whole link: a typo in one
 * weapon name should not cost a match its lobby.
 */
function classLimits(raw: string): Readonly<Record<string, number>> {
  if (raw === '') return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

  const out: Record<string, number> = {};
  for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!(KRUNKER_HOST.classOrder as readonly string[]).includes(name)) continue;
    const limit = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(limit) || limit < 0) continue;
    out[name] = Math.min(Math.floor(limit), MAX_CLASS_LIMIT);
  }
  return out;
}

/**
 * The result webhook, https only.
 *
 * This one is worth being strict about: it is the one value in the link that
 * makes Krunker send data somewhere, and it is handed to the game rather than
 * used by us. http would put a scoreboard on the wire in clear text, and
 * anything else is not a thing to hand a URL field at all.
 */
function webhook(raw: string): string {
  if (raw === '') return '';
  try {
    return new URL(raw).protocol === 'https:' ? raw : '';
  } catch {
    return '';
  }
}

/**
 * A region as Krunker names it internally: `NY` and `us-nj` both land on
 * `us-nj`, and anything unrecognised comes back empty so the lobby goes up in
 * whatever region is already set rather than in a made-up one.
 */
export function normaliseRegion(raw: string): string {
  const value = raw.trim();
  if (value === '') return '';

  const key = value.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(SERVER_REGION_KEYS, key)) return key;

  const code = value.toUpperCase();
  const resolved = REGION_ALIASES[code] ?? code;
  return REGION_KEY_BY_CODE[resolved] ?? '';
}
