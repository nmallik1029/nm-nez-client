import { BLOCKABLE_ASSETS } from '../../krunker/constants';
import { EMPTY_SWAP_URL } from '../swapper/protocol';

/**
 * Network-layer blocking, in two stages.
 *
 * `FILTER_PATTERNS` goes to Electron's webRequest filter and is matched down
 * in C++, so a URL that doesn't match never reaches JavaScript. Only what
 * survives that gets to `decideRequest`. Widen the patterns and you pay for it
 * on the main process for every asset the game loads, so keep them narrow.
 */

/** Ad, analytics, telemetry and consent-management hosts. */
export const AD_HOST_PATTERNS: readonly string[] = [
  '*://*.pollfish.com/*',
  '*://storage.googleapis.com/pollfish_production/*',
  '*://*.doubleclick.net/*',
  '*://c.amazon-adsystem.com/*',
  '*://*.googlesyndication.com/*',
  '*://www.googletagmanager.com/*',
  '*://www.google-analytics.com/*',
  '*://*.google-analytics.com/*',
  '*://imasdk.googleapis.com/*',
  '*://apis.google.com/js/platform.js',
  '*://www.paypalobjects.com/*',
  '*://fran-cdn.frvr.com/*',
  '*://cdn.frvr.com/fran/*',
  '*://coeus.frvr.com/*',
  '*://*.cookiepro.com/*',
  '*://cookiepro.com/*',
  '*://*.onetrust.com/*',
  '*://*.adinplay.com/*',
  '*://*.playwire.com/*',
  '*://*.crazygames.com/*',
];

const AD_HOST_RE =
  /(?:^|\.)(?:pollfish\.com|doubleclick\.net|amazon-adsystem\.com|googlesyndication\.com|googletagmanager\.com|google-analytics\.com|paypalobjects\.com|cookiepro\.com|onetrust\.com|adinplay\.com|playwire\.com|crazygames\.com)$/;

const AD_PATH_RE = /^(?:https?:)?\/\/(?:imasdk\.googleapis\.com|(?:fran-)?cdn?\.frvr\.com|coeus\.frvr\.com|apis\.google\.com\/js\/platform\.js|storage\.googleapis\.com\/pollfish_production)/;

/** Build a matcher for a set of `user-assets.krunker.io` ids. */
function assetRegex(group: { folders: readonly number[]; models: readonly number[] }): RegExp | null {
  const alternatives: string[] = [];
  // A bare id blocks every file under that asset folder.
  if (group.folders.length > 0) alternatives.push(`(?:${group.folders.join('|')})\\/`);
  // Model-only ids drop the geometry but leave textures alone.
  if (group.models.length > 0) alternatives.push(`(?:${group.models.join('|')})\\/model\\.obj`);
  if (alternatives.length === 0) return null;
  return new RegExp(`user-assets\\.krunker\\.io\\/(?:${alternatives.join('|')})`);
}

export const BUNNY_RE = assetRegex(BLOCKABLE_ASSETS.bunnies);
export const TURF_BANNER_RE = assetRegex(BLOCKABLE_ASSETS.turfBanners);

/**
 * The game's own socket. Without this the handler never sees it and real ping
 * has nothing to aim at. `*://*` covers http and https only, hence its own
 * line.
 */
const GAME_SOCKET_PATTERN = 'wss://*.krunker.io/*';

/** Everything the game loads: the only way for the swapper to see an asset. */
const GAME_ASSET_PATTERN = '*://*.krunker.io/*';

/** Props live here, and nothing else we block does. */
const PROP_PATTERN = '*://user-assets.krunker.io/*';

/** What the filter has to cover, given what is switched on right now. */
export interface FilterNeeds {
  readonly blockAds: boolean;
  /** The swapper is on AND actually has a file to serve. */
  readonly swapping: boolean;
  /** Bunnies or turf banners are being culled. */
  readonly blockingProps: boolean;
}

/**
 * The patterns to hand Electron, for what is on right now.
 *
 * This used to be one fixed list with `*://*.krunker.io/*` in it, which meant
 * every texture, model and sound the game loaded woke the main process to be
 * looked at. A map load is thousands of requests and nearly every one of them
 * was asking three questions whose answer was already no: the swap index is
 * empty on a default install, prop culling is off, and an asset on
 * assets.krunker.io was never going to be an ad host.
 *
 * So the list is built from what is actually switched on. Nothing wants game
 * assets on a default profile, so none are intercepted at all and they are
 * matched and dropped in Chromium's C++ layer instead. What is left is a
 * handful of ad hosts and the socket.
 *
 * It has to be rebuilt whenever one of those answers changes: a feature
 * toggled, or a rescan that finds the first file in the swap folder. See
 * `installRequestFilter`.
 */
export function requestPatterns(needs: FilterNeeds): string[] {
  const patterns = [GAME_SOCKET_PATTERN];
  if (needs.blockAds) patterns.push(...AD_HOST_PATTERNS);

  // The broad pattern already covers user-assets, so the two are exclusive.
  if (needs.swapping) patterns.push(GAME_ASSET_PATTERN);
  else if (needs.blockingProps) patterns.push(PROP_PATTERN);

  return patterns;
}

export interface RequestContext {
  readonly blockAds: boolean;
  readonly hideBunnies: boolean;
  readonly hideTurfBanners: boolean;
  /** Returns a replacement URL for a swapped asset, or null. */
  readonly resolveSwap: (url: string) => string | null;
}

export type RequestDecision =
  | { readonly kind: 'allow' }
  | { readonly kind: 'cancel' }
  | { readonly kind: 'redirect'; readonly url: string };

const ALLOW: RequestDecision = { kind: 'allow' };
const CANCEL: RequestDecision = { kind: 'cancel' };

/**
 * Blocked models get redirected here rather than cancelled. Cancel one and
 * Krunker's loader swaps in a placeholder; an empty body parses as zero
 * geometry and the prop just isn't there.
 *
 * This was `data:,` and did not work. Chromium refuses a redirect to a data
 * URL from a web origin, so every blocked model failed with
 * ERR_UNSAFE_REDIRECT instead of loading empty -- the block silently did
 * nothing except log an error per asset. The swap scheme is registered
 * standard and secure, which is why the resource swapper's own redirects have
 * always worked, and this rides the same route.
 */
const EMPTY_RESPONSE = EMPTY_SWAP_URL;

export function isAdHost(url: string): boolean {
  if (AD_PATH_RE.test(url)) return true;
  try {
    return AD_HOST_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Decide what to do with a request that survived the C++ filter. */
export function decideRequest(url: string, ctx: RequestContext): RequestDecision {
  if (ctx.hideBunnies && BUNNY_RE?.test(url)) return { kind: 'redirect', url: EMPTY_RESPONSE };
  if (ctx.hideTurfBanners && TURF_BANNER_RE?.test(url)) {
    return { kind: 'redirect', url: EMPTY_RESPONSE };
  }

  const swapped = ctx.resolveSwap(url);
  if (swapped !== null) return { kind: 'redirect', url: swapped };

  if (ctx.blockAds && isAdHost(url)) return CANCEL;

  return ALLOW;
}
