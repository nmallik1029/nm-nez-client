import type { Session } from 'electron';
import type { FeatureConfig } from '../../shared/config';
import { decideRequest, requestPatterns } from './blocklist';
import { gameSocketTarget } from './ping';

export interface RequestFilterDeps {
  /** Read live, so toggling a feature takes effect without a restart. */
  readonly getFeatures: () => FeatureConfig;
  /** Returns a `swap://` URL for a swapped asset, or null. */
  readonly resolveSwap: (url: string) => string | null;
  /** How many files the swap folder has right now. */
  readonly swapFileCount: () => number;
  /** Called when the game opens its match-server WebSocket. */
  readonly onGameSocket: (host: string, port: number) => void;
}

export interface RequestFilter {
  /**
   * Rebuild the URL patterns from what is switched on now.
   *
   * Call after anything that changes the answer: one of the four features
   * being toggled, or a swap folder rescan that finds its first file.
   */
  refresh(): void;
}

/**
 * The one `onBeforeRequest` handler.
 *
 * Electron only allows a single listener per session here, and a second one
 * quietly replaces the first, so ad blocking, prop blocking and the resource
 * swapper all have to share this callback. That's why the actual decision is
 * a pure function over in `blocklist.ts`: three features tangled into one
 * callback are otherwise untestable.
 *
 * The URL patterns go to Electron so anything that doesn't match is rejected
 * in C++ and never wakes JavaScript up, and they are now the narrowest set
 * that covers what is actually switched on. On a default profile that means
 * the thousands of asset requests in a map load are never handed over at all,
 * rather than being handed over to be allowed.
 *
 * Re-registering is how a filter is changed: the same call with a new filter
 * replaces the listener, which is the behaviour that makes one listener per
 * session workable in the first place.
 */
export function installRequestFilter(session: Session, deps: RequestFilterDeps): RequestFilter {
  function register(): void {
    const features = deps.getFeatures();
    const urls = requestPatterns({
      blockAds: features.blockAds,
      swapping: features.resourceSwapper && deps.swapFileCount() > 0,
      blockingProps: features.hideBunnies || features.hideTurfBanners,
    });

    session.webRequest.onBeforeRequest({ urls }, (details, callback) => {
      // The match-server socket is how we find out what to ping. It's the only
      // place the host shows up; the game never tells us.
      if (details.resourceType === 'webSocket') {
        const target = gameSocketTarget(details.url);
        if (target) deps.onGameSocket(target.host, target.port);
        callback({});
        return;
      }

      const live = deps.getFeatures();
      const decision = decideRequest(details.url, {
        blockAds: live.blockAds,
        hideBunnies: live.hideBunnies,
        hideTurfBanners: live.hideTurfBanners,
        resolveSwap: live.resourceSwapper ? deps.resolveSwap : () => null,
      });

      switch (decision.kind) {
        case 'cancel':
          callback({ cancel: true });
          return;
        case 'redirect':
          callback({ redirectURL: decision.url });
          return;
        case 'allow':
          callback({});
          return;
      }
    });
  }

  register();
  return { refresh: register };
}
