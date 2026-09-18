import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC } from '../../shared/ipc';
import { DEFAULT_FORTNITE } from '../../shared/soundpacks';
import { DEFAULT_VISUALS, type VisualsConfig } from '../../shared/visuals';
import { applyFortnite, initFortnite, reloadGameSounds, reloadPickedSounds } from './soundpacks';

/**
 * Making the game pick up a changed sound.
 *
 * Krunker keeps every sound it has loaded, under its name with what kind of
 * play it was for on the end, and never asks main for it again. So a pick
 * reaches the game only if every copy of that sound is let go of, and only
 * after main can answer with it: let go of too early and the next shot loads
 * the old answer and keeps that instead.
 */

const invoke = vi.fn<(channel: string, ...args: unknown[]) => unknown>();
vi.mock('electron', () => ({
  ipcRenderer: { invoke: (channel: string, ...args: unknown[]) => invoke(channel, ...args) },
}));

class FakeHowl {
  unloaded = false;
  unload(): void {
    this.unloaded = true;
  }
}

let sounds: Record<string, FakeHowl>;

beforeEach(() => {
  sounds = {};
  for (const key of ['weapon_2', 'weapon_23d', 'weapon_2_53dv', 'weapon_2asset', 'weapon_1', 'hit_0', 'headshot_0hckd', 'footstep_0']) {
    sounds[key] = new FakeHowl();
  }
  vi.stubGlobal('window', { SOUND: { sounds } });
  invoke.mockReset();
  invoke.mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function visuals(soundpacks: boolean, fortnite: boolean, guns: Record<string, string> = {}): VisualsConfig {
  return {
    ...DEFAULT_VISUALS,
    soundpacks: { on: soundpacks },
    fortnite: { ...DEFAULT_FORTNITE, on: fortnite, guns: { ...DEFAULT_FORTNITE.guns, ...guns } },
  };
}

describe('reloadGameSounds', () => {
  it('lets go of every copy of a sound, whatever it was loaded for', () => {
    const before = { ...sounds };
    expect(reloadGameSounds((key) => key.startsWith('weapon_2'))).toBe(4);
    expect(Object.keys(sounds).sort()).toEqual(['footstep_0', 'headshot_0hckd', 'hit_0', 'weapon_1']);
    for (const key of ['weapon_2', 'weapon_23d', 'weapon_2_53dv', 'weapon_2asset']) expect(before[key]?.unloaded).toBe(true);
    expect(before.weapon_1?.unloaded).toBe(false);
  });

  it('tests the sound by its name, without what it was loaded for', () => {
    const seen: string[] = [];
    reloadGameSounds((key) => (seen.push(key), false));
    expect(seen.sort()).toEqual(['footstep_0', 'headshot_0', 'hit_0', 'weapon_1', 'weapon_2', 'weapon_2', 'weapon_2', 'weapon_2_5']);
  });

  it('does nothing before the game has any sounds, and survives a Howl that throws', () => {
    vi.stubGlobal('window', {});
    expect(reloadGameSounds(() => true)).toBe(0);
    vi.stubGlobal('window', { SOUND: { sounds: { weapon_2: { unload: () => { throw new Error('gone'); } } } } });
    expect(reloadGameSounds(() => true)).toBe(1);
  });
});

describe('applyFortnite', () => {
  it('saves first, and lets go of the sounds only once main has the change', async () => {
    initFortnite(visuals(true, false));
    let saved: () => void = () => {};
    invoke.mockImplementation(() => new Promise<void>((resolve) => (saved = resolve)));

    const done = applyFortnite(visuals(true, true));
    expect(invoke).toHaveBeenCalledWith(IPC.configPatch, 'visuals', {
      soundpacks: { on: true },
      fortnite: { ...DEFAULT_FORTNITE, on: true },
    });
    expect(sounds.weapon_2).toBeDefined();

    saved();
    await done;
    expect(sounds.weapon_2).toBeUndefined();
    expect(sounds.hit_0).toBeUndefined();
    expect(sounds.footstep_0).toBeDefined();
  });

  it('lets go of only what the change changed', async () => {
    initFortnite(visuals(true, true));
    await applyFortnite(visuals(true, true, { '1': 'heavy-sniper-rifle' }));
    expect(sounds.weapon_1).toBeUndefined();
    expect(sounds.weapon_2).toBeDefined();
    expect(sounds.hit_0).toBeDefined();
  });

  it('lets go of nothing when only the switch it already obeyed changes', async () => {
    // Fortnite off either way: the Soundpacks switch flipping changes no sound.
    initFortnite(visuals(false, false));
    await applyFortnite(visuals(true, false));
    expect(Object.keys(sounds)).toHaveLength(8);
  });

  it('still lets go of the sounds when the save fails', async () => {
    initFortnite(visuals(true, true));
    invoke.mockRejectedValue(new Error('main is busy'));
    await applyFortnite(visuals(false, true));
    expect(sounds.weapon_2).toBeUndefined();
  });

  it('measures two quick changes each from the one before', async () => {
    initFortnite(visuals(true, true));
    let saved: () => void = () => {};
    invoke.mockImplementation(() => new Promise<void>((resolve) => (saved = resolve)));
    const first = applyFortnite(visuals(true, true, { '1': 'heavy-sniper-rifle' }));
    const release = saved;
    invoke.mockResolvedValue(true);
    await applyFortnite(visuals(true, true, { '1': 'heavy-sniper-rifle', '2': 'assault-rifle' }));
    // The second changed only the AR; the Sniper is the first's to reload.
    expect(sounds.weapon_2).toBeUndefined();
    expect(sounds.weapon_1).toBeDefined();
    release();
    await first;
    expect(sounds.weapon_1).toBeUndefined();
  });
});

describe('reloadPickedSounds', () => {
  it('lets go of every picked sound, since the file behind each one came or went', () => {
    initFortnite(visuals(true, true));
    reloadPickedSounds(visuals(true, true, { '2': '' }));
    expect(sounds.weapon_1).toBeUndefined();
    expect(sounds.hit_0).toBeUndefined();
    expect(sounds.weapon_2).toBeDefined();
    expect(sounds.footstep_0).toBeDefined();
  });
});
