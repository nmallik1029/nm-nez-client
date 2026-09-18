import { describe, expect, it } from 'vitest';
import { decideRequest, isAdHost, requestPatterns, type RequestContext } from './blocklist';
import { EMPTY_SWAP_URL } from '../swapper/protocol';

const ctx = (over: Partial<RequestContext> = {}): RequestContext => ({
  blockAds: true,
  hideBunnies: false,
  hideTurfBanners: false,
  resolveKillPack: () => null,
  resolveSwap: () => null,
  ...over,
});

const KILL_PACK_PATTERN = '*://assets.krunker.io/sounds/killstreak/*';
const SOUNDPACK_PATTERN = '*://assets.krunker.io/sounds/soundpacks/*';
const KRUNKER_SOUND_PATTERN = '*://assets.krunker.io/sound/*';

describe('isAdHost', () => {
  it('matches known ad and analytics hosts', () => {
    expect(isAdHost('https://www.googletagmanager.com/gtag/js')).toBe(true);
    expect(isAdHost('https://ads.pollfish.com/thing.js')).toBe(true);
    expect(isAdHost('https://static.doubleclick.net/x.png')).toBe(true);
    expect(isAdHost('https://imasdk.googleapis.com/js/sdkloader/ima3.js')).toBe(true);
  });

  it('does not match the game or its asset hosts', () => {
    expect(isAdHost('https://krunker.io/')).toBe(false);
    expect(isAdHost('https://assets.krunker.io/textures/wall.png')).toBe(false);
    expect(isAdHost('https://api.krunker.io/seek-game')).toBe(false);
  });

  it('is anchored to the registrable domain, not a substring', () => {
    // A naive `hostname.includes('doubleclick.net')` would block this.
    expect(isAdHost('https://doubleclick.net.example.com/x')).toBe(false);
    // ...and a naive suffix check would block a lookalike domain.
    expect(isAdHost('https://notpollfish.com/x')).toBe(false);
  });

  it('survives an unparseable URL', () => {
    expect(isAdHost('::::')).toBe(false);
  });
});

describe('decideRequest', () => {
  it('allows ordinary game traffic', () => {
    expect(decideRequest('https://assets.krunker.io/x.png', ctx())).toEqual({ kind: 'allow' });
  });

  it('cancels ad hosts only when blocking is on', () => {
    const url = 'https://www.googletagmanager.com/gtag/js';
    expect(decideRequest(url, ctx()).kind).toBe('cancel');
    expect(decideRequest(url, ctx({ blockAds: false })).kind).toBe('allow');
  });

  it('empties blocked props rather than cancelling them', () => {
    // Cancelling makes Krunker's loader substitute a placeholder; an empty
    // body parses as zero geometry and the prop disappears cleanly.
    const bunny = 'https://user-assets.krunker.io/61806/model.obj';
    expect(decideRequest(bunny, ctx({ hideBunnies: true }))).toEqual({
      kind: 'redirect',
      url: EMPTY_SWAP_URL,
    });
  });

  it('blocks a whole folder for folder-scoped asset ids', () => {
    expect(decideRequest('https://user-assets.krunker.io/60585/texture.png', ctx({ hideBunnies: true })).kind)
      .toBe('redirect');
    // A model-scoped id must not take its textures with it.
    expect(decideRequest('https://user-assets.krunker.io/61806/texture.png', ctx({ hideBunnies: true })).kind)
      .toBe('allow');
  });

  it('leaves props alone when their toggle is off', () => {
    const bunny = 'https://user-assets.krunker.io/61806/model.obj';
    expect(decideRequest(bunny, ctx({ hideBunnies: false })).kind).toBe('allow');
  });

  it('honours turf banners independently of bunnies', () => {
    const banner = 'https://user-assets.krunker.io/64295/model.obj';
    expect(decideRequest(banner, ctx({ hideBunnies: true })).kind).toBe('allow');
    expect(decideRequest(banner, ctx({ hideTurfBanners: true })).kind).toBe('redirect');
  });

  it('redirects swapped assets', () => {
    const decision = decideRequest('https://assets.krunker.io/textures/wall.png', ctx({
      resolveSwap: (u) => (u.endsWith('wall.png') ? 'swap://asset/wall.png' : null),
    }));
    expect(decision).toEqual({ kind: 'redirect', url: 'swap://asset/wall.png' });
  });

  it('prefers a prop block over a swap for the same URL', () => {
    // Otherwise "hide bunnies" would silently stop working for anyone who
    // happens to have a file of the same name in their swap folder.
    const bunny = 'https://user-assets.krunker.io/61806/model.obj';
    const decision = decideRequest(bunny, ctx({ hideBunnies: true, resolveSwap: () => 'swap://x' }));
    expect(decision).toEqual({ kind: 'redirect', url: EMPTY_SWAP_URL });
  });

  it('redirects a kill pack file to where main found it', () => {
    const url = 'https://assets.krunker.io/sounds/killstreak/prime/prime_1.mp3';
    const decision = decideRequest(url, ctx({
      resolveKillPack: (u) => (u === url ? 'swap://f/7' : null),
    }));
    expect(decision).toEqual({ kind: 'redirect', url: 'swap://f/7' });
  });

  it('asks for a kill pack before a swap, and falls through when there is none', () => {
    const url = 'https://assets.krunker.io/sounds/killstreak/prime/prime_1.mp3';
    expect(decideRequest(url, ctx({ resolveKillPack: () => 'swap://f/1', resolveSwap: () => 'swap://f/2' })))
      .toEqual({ kind: 'redirect', url: 'swap://f/1' });
    expect(decideRequest(url, ctx({ resolveSwap: () => 'swap://f/2' })))
      .toEqual({ kind: 'redirect', url: 'swap://f/2' });
  });

  it("answers one of Krunker's sounds with the soundpack's, ahead of a swap", () => {
    // A sound the user swapped by hand and also picked a Fortnite gun for:
    // the pick is the newer, more specific choice, and it can be undone in
    // the editor without touching the swap folder.
    const url = 'https://assets.krunker.io/sound/weapon_2.mp3?build=abc';
    const both = ctx({ resolveSoundpack: () => 'swap://f/3', resolveSwap: () => 'swap://f/2' });
    expect(decideRequest(url, both)).toEqual({ kind: 'redirect', url: 'swap://f/3' });
    expect(decideRequest(url, ctx({ resolveSoundpack: () => null, resolveSwap: () => 'swap://f/2' })))
      .toEqual({ kind: 'redirect', url: 'swap://f/2' });
    expect(decideRequest(url, ctx({ resolveSoundpack: () => null }))).toEqual({ kind: 'allow' });
  });
});

describe('requestPatterns', () => {
  const NEEDS = { blockAds: false, swapping: false, blockingProps: false };

  it('always covers the game socket, which is what real ping aims at', () => {
    expect(requestPatterns(NEEDS)).toContain('wss://*.krunker.io/*');
  });

  it('leaves game assets alone when nothing wants them', () => {
    // The point of the whole exercise: on a default profile a map load is
    // thousands of requests, and none of them should reach our JavaScript.
    const patterns = requestPatterns({ ...NEEDS, blockAds: true });
    expect(patterns).not.toContain('*://*.krunker.io/*');
    expect(patterns).not.toContain('*://user-assets.krunker.io/*');
    expect(patterns).toContain('*://*.doubleclick.net/*');
  });

  it('covers the game origin once the swapper has something to serve', () => {
    expect(requestPatterns({ ...NEEDS, swapping: true })).toContain('*://*.krunker.io/*');
  });

  it('covers only the prop host when props are being culled', () => {
    const patterns = requestPatterns({ ...NEEDS, blockingProps: true });
    expect(patterns).toContain('*://user-assets.krunker.io/*');
    expect(patterns).not.toContain('*://*.krunker.io/*');
  });

  it('does not ask for the prop host twice when swapping covers it', () => {
    const patterns = requestPatterns({ ...NEEDS, swapping: true, blockingProps: true });
    expect(patterns).not.toContain('*://user-assets.krunker.io/*');
    expect(patterns).toHaveLength(new Set(patterns).size);
  });

  it('always covers the kill pack address, and nothing else of the asset host', () => {
    // Every profile has the shipped packs, so this is on a default profile,
    // and the reason it is safe there is that the game never asks for it.
    for (const blockingProps of [true, false]) {
      const patterns = requestPatterns({ ...NEEDS, blockAds: true, blockingProps });
      expect(patterns).toContain(KILL_PACK_PATTERN);
      expect(patterns).not.toContain('*://*.krunker.io/*');
      expect(patterns).not.toContain('*://assets.krunker.io/*');
    }
  });

  it('leaves the kill pack address to the broad pattern when swapping', () => {
    expect(requestPatterns({ ...NEEDS, swapping: true })).not.toContain(KILL_PACK_PATTERN);
  });

  it('leaves the ad hosts out when ad blocking is off', () => {
    expect(requestPatterns(NEEDS)).toEqual(['wss://*.krunker.io/*', KILL_PACK_PATTERN, SOUNDPACK_PATTERN]);
  });

  it("covers Krunker's own sounds only while a soundpack is replacing them", () => {
    expect(requestPatterns(NEEDS)).not.toContain(KRUNKER_SOUND_PATTERN);
    expect(requestPatterns({ ...NEEDS, soundpacks: false })).not.toContain(KRUNKER_SOUND_PATTERN);
    const patterns = requestPatterns({ ...NEEDS, soundpacks: true });
    expect(patterns).toContain(KRUNKER_SOUND_PATTERN);
    expect(patterns).not.toContain('*://assets.krunker.io/*');
  });

  it('leaves the soundpack addresses to the broad pattern when swapping', () => {
    const patterns = requestPatterns({ ...NEEDS, swapping: true, soundpacks: true });
    expect(patterns).not.toContain(SOUNDPACK_PATTERN);
    expect(patterns).not.toContain(KRUNKER_SOUND_PATTERN);
  });

  it('never hands Electron an empty list, which would match everything', () => {
    for (const blockAds of [true, false]) {
      for (const swapping of [true, false]) {
        for (const blockingProps of [true, false]) {
          expect(requestPatterns({ blockAds, swapping, blockingProps }).length).toBeGreaterThan(0);
        }
      }
    }
  });
});
