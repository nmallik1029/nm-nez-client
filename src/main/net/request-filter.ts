import type { Session } from 'electron';
import type { FeatureConfig } from '../../shared/config';
import { decideRequest, FILTER_PATTERNS } from './blocklist';
import { gameSocketTarget } from './ping';

export interface RequestFilterDeps {
  /** Read live, so toggling a feature takes effect without a restart. */
  readonly getFeatures: () => FeatureConfig;
  /** Returns a `swap://` URL for a swapped asset, or null. */
  readonly resolveSwap: (url: string) => string | null;
  /** Called when the game opens its match-server WebSocket. */
  readonly onGameSocket: (host: string, port: number) => void;
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
 * The URL filter goes to Electron so anything that doesn't match is rejected
 * in C++ and never wakes JavaScript up. On a map load that's thousands of
 * requests costing nothing.
 */
export function installRequestFilter(session: Session, deps: RequestFilterDeps): void {
  session.webRequest.onBeforeRequest({ urls: [...FILTER_PATTERNS] }, (details, callback) => {
    // The match-server socket is how we find out what to ping. It's the only
    // place the host shows up; the game never tells us.
    if (details.resourceType === 'webSocket') {
      const target = gameSocketTarget(details.url);
      if (target) deps.onGameSocket(target.host, target.port);
      callback({});
      return;
    }

    const features = deps.getFeatures();

    const decision = decideRequest(details.url, {
      blockAds: features.blockAds,
      hideBunnies: features.hideBunnies,
      hideTurfBanners: features.hideTurfBanners,
      resolveSwap: features.resourceSwapper ? deps.resolveSwap : () => null,
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
