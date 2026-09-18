import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC } from '../../shared/ipc';
import type { KillPack, KillPackListing } from '../../shared/killstreak';
import type { KillStreakConfig } from '../../shared/visuals';

/**
 * When the player downloads a pack nobody pressed Install on.
 *
 * It follows the config: a pack the config names that is in the catalog and
 * not on disk gets fetched, once a session. Each case here is one that went
 * wrong in review before 0.1.60 shipped, or would if the rule drifted:
 * someone updating from a version that shipped every pack gets their pick
 * back even with a pack of their own to fall back on, a pack being installed
 * by hand does not have Default fetched beside it, and a failed download is
 * not retried on every volume nudge.
 */

const invoke = vi.fn<(channel: string, id?: string) => unknown>();
vi.mock('electron', () => ({
  ipcRenderer: { invoke: (channel: string, id?: string) => invoke(channel, id) },
}));
const showToast = vi.fn<(message: string, durationMs?: number) => void>();
vi.mock('../toast', () => ({
  showToast: (message: string, durationMs?: number) => showToast(message, durationMs),
}));

const CATALOG: Record<string, string> = { default: 'Default', reaver: 'Reaver', ion: 'Ion' };

/** Main, as far as the player can tell: what is on disk, and what it was asked to fetch. */
let own: Set<string>;
let installed: Set<string>;
let installs: string[];
let answer: 'ok' | 'fail' | 'hold';
let held: Map<string, (ok: boolean) => void>;

function entry(id: string): KillPack {
  return { id, name: CATALOG[id] ?? id, sounds: 1, banners: 0 };
}

function listing(): KillPackListing {
  const onDisk = [...new Set([...own, ...installed])].map(entry);
  onDisk.sort((a, b) => a.name.localeCompare(b.name));
  return {
    installed: onDisk,
    removable: [...installed].filter((id) => !own.has(id)),
    available: Object.keys(CATALOG)
      .filter((id) => !own.has(id) && !installed.has(id))
      .map((id) => ({ ...entry(id), bytes: 1 })),
  };
}

function main(channel: string, id?: string): unknown {
  if (channel === IPC.killPacksGet) return Promise.resolve(listing());
  if (channel === IPC.killPacksRemove && id !== undefined) {
    return Promise.resolve(installed.delete(id));
  }
  if (channel === IPC.killPacksInstall && id !== undefined) {
    installs.push(id);
    if (answer === 'hold') {
      return new Promise((resolve) =>
        held.set(id, (ok) => {
          if (ok) installed.add(id);
          resolve(ok);
        }),
      );
    }
    if (answer === 'ok') installed.add(id);
    return Promise.resolve(answer === 'ok');
  }
  return Promise.reject(new Error(`unexpected ${channel}`));
}

const config = (over: Partial<KillStreakConfig> = {}): KillStreakConfig => ({
  on: true,
  pack: '',
  volume: 0.3,
  banners: true,
  ...over,
});

/** Let every IPC answer and everything waiting on it run. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
}

let player: typeof import('./killstreak');

beforeEach(async () => {
  own = new Set();
  installed = new Set();
  installs = [];
  answer = 'ok';
  held = new Map();
  invoke.mockReset();
  invoke.mockImplementation((channel: string, id?: string) => main(channel, id));
  showToast.mockReset();
  // The player re-attaches to Krunker's HUD on an interval while it is on.
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  vi.stubGlobal('document', { getElementById: () => null, body: null });
  vi.stubGlobal(
    'Audio',
    class {
      volume = 1;
      preload = '';
      play(): Promise<void> {
        return Promise.resolve();
      }
    },
  );
  vi.stubGlobal('Image', class {});
  vi.resetModules();
  player = await import('./killstreak');
});

afterEach(() => {
  player.setKillStreak(config({ on: false }));
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('fetching the pack the config wants', () => {
  it('fetches the picked pack back after an update, even with a pack of the user\'s own to fall back on', async () => {
    // 0.1.59 played Reaver from the packs it shipped. The update took them
    // away, and the user's own pack must not quietly take its place.
    own.add('mine');
    player.setKillStreak(config({ pack: 'reaver' }));
    await settle();
    expect(installs).toEqual(['reaver']);
    expect(player.resolvePack('reaver')?.id).toBe('reaver');
  });

  it('reads an empty pick as Default, which is what it has always played', async () => {
    player.setKillStreak(config());
    await settle();
    expect(installs).toEqual(['default']);
  });

  it('falls back to Default when the pick is gone and nothing else can play', async () => {
    // A pack of the user's own, since deleted from their folder.
    player.setKillStreak(config({ pack: 'mine' }));
    await settle();
    expect(installs).toEqual(['default']);
  });

  it('leaves a pick of the user\'s own alone', async () => {
    own.add('mine');
    player.setKillStreak(config({ pack: 'mine' }));
    await settle();
    expect(installs).toEqual([]);
  });

  it('fetches nothing while switched off', async () => {
    player.setKillStreak(config({ on: false, pack: 'reaver' }));
    await settle();
    expect(installs).toEqual([]);
  });
});

describe('alongside Install pressed by hand', () => {
  it('does not fetch Default while another pack is downloading', async () => {
    answer = 'hold';
    player.setKillStreak(config({ on: false }));
    await settle();

    // What the editor does: start the download, pick it, then the switch.
    const done = player.installKillPack('reaver');
    player.setKillStreak(config({ on: false, pack: 'reaver' }));
    player.setKillStreak(config({ on: true, pack: 'reaver' }));
    await settle();
    expect(installs).toEqual(['reaver']);

    // Even with nothing picked, nothing joins it while it runs.
    player.setKillStreak(config({ on: true, pack: '' }));
    await settle();
    expect(installs).toEqual(['reaver']);

    player.setKillStreak(config({ on: true, pack: 'reaver' }));
    held.get('reaver')?.(true);
    expect(await done).toBe(true);
    await settle();
    expect(installs).toEqual(['reaver']);
    expect(player.resolvePack('reaver')?.id).toBe('reaver');
  });
});

describe('when a download fails', () => {
  it('does not retry on every change, and says so once', async () => {
    answer = 'fail';
    player.setKillStreak(config({ pack: 'reaver' }));
    await settle();
    for (const volume of [0.4, 0.5, 0.6]) player.setKillStreak(config({ pack: 'reaver', volume }));
    await player.listKillPacks();
    await settle();
    expect(installs).toEqual(['reaver']);
    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it('still downloads when Install is pressed afterwards', async () => {
    answer = 'fail';
    player.setKillStreak(config({ pack: 'reaver' }));
    await settle();
    answer = 'ok';
    expect(await player.installKillPack('reaver')).toBe(true);
    expect(installs).toEqual(['reaver', 'reaver']);
  });
});
