import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_FORTNITE, FORTNITE_PACK_ID, SOUNDPACK_BASE } from '../shared/soundpacks';
import { DEFAULT_VISUALS, type VisualsConfig } from '../shared/visuals';
import type { KillCatalog } from './killpack-install';
import { isSoundpackInstalled, resolveSoundpackRequest, soundpackStatus, soundSwapActive } from './soundpacks';

/**
 * What main answers a sound request with.
 *
 * Every request it answers here becomes a file read off disk, and two kinds
 * of URL reach it: the editor's previews, which name a pack and a file, and
 * Krunker's own sounds, whose answer is whatever the config picks. So the
 * cases are about never reading anything but a sound in the soundpack
 * folder, and about falling through to Krunker's own whenever there is no
 * file to answer with, rather than answering with nothing.
 */

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'soundpacks-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function install(sounds: string[] = ['assault-rifle-scar', 'bolt-action-sniper-rifle', 'hit-body']): void {
  const folder = join(dir, FORTNITE_PACK_ID);
  mkdirSync(folder, { recursive: true });
  for (const sound of sounds) writeFileSync(join(folder, `${sound}.ogg`), 'x');
  writeFileSync(join(folder, 'pack.json'), '{"name":"Fortnite"}');
}

function visuals(soundpacks: boolean, fortnite: boolean, guns: Record<string, string> = {}): VisualsConfig {
  return {
    ...DEFAULT_VISUALS,
    soundpacks: { on: soundpacks },
    fortnite: { ...DEFAULT_FORTNITE, on: fortnite, guns: { ...DEFAULT_FORTNITE.guns, ...guns } },
  };
}

const ON = (): VisualsConfig => visuals(true, true);
const sound = (key: string): string => `https://assets.krunker.io/sound/${key}.mp3?build=abc`;

describe('isSoundpackInstalled', () => {
  it('counts a pack only once its pack.json is there', () => {
    // The installer writes it last, so a folder without it is half a download.
    mkdirSync(join(dir, FORTNITE_PACK_ID));
    writeFileSync(join(dir, FORTNITE_PACK_ID, 'pistol.ogg'), 'x');
    expect(isSoundpackInstalled(dir, FORTNITE_PACK_ID)).toBe(false);
    install();
    expect(isSoundpackInstalled(dir, FORTNITE_PACK_ID)).toBe(true);
  });

  it('never looks outside the folder', () => {
    writeFileSync(join(dir, 'pack.json'), '{}');
    for (const id of ['', '.', '..', '../soundpacks', 'a/b']) expect(isSoundpackInstalled(join(dir, 'x'), id)).toBe(false);
  });
});

describe('soundpackStatus', () => {
  it('lists every pack in the catalog with what installing it costs', () => {
    const catalog: KillCatalog = {
      source: 'https://example/',
      packs: [
        { id: 'fortnite', name: 'Fortnite', files: [{ name: 'a.ogg', size: 100, sha512: '' }, { name: 'b.ogg', size: 23, sha512: '' }] },
        { id: 'other', name: 'Other', files: [] },
      ],
    };
    install();
    expect(soundpackStatus(dir, catalog)).toEqual([
      { id: 'fortnite', name: 'Fortnite', installed: true, bytes: 123 },
      { id: 'other', name: 'Other', installed: false, bytes: 0 },
    ]);
  });
});

describe('soundSwapActive', () => {
  it('needs both switches on and the pack installed', () => {
    expect(soundSwapActive(ON(), dir)).toBe(false);
    install();
    expect(soundSwapActive(ON(), dir)).toBe(true);
    expect(soundSwapActive(visuals(false, true), dir)).toBe(false);
    expect(soundSwapActive(visuals(true, false), dir)).toBe(false);
  });
});

describe('resolveSoundpackRequest: previews', () => {
  it('answers any sound of an installed pack, switched on or not', () => {
    install();
    const url = `${SOUNDPACK_BASE}fortnite/hit-body.ogg`;
    expect(resolveSoundpackRequest(url, () => visuals(false, false), dir)).toBe(join(dir, 'fortnite', 'hit-body.ogg'));
    expect(resolveSoundpackRequest(`${url}?t=1`, () => visuals(false, false), dir)).toBe(join(dir, 'fortnite', 'hit-body.ogg'));
  });

  it('answers nothing that is not a sound in a pack folder', () => {
    install();
    writeFileSync(join(dir, 'secret.ogg'), 'x');
    for (const path of [
      '../secret.ogg',
      'fortnite/../../secret.ogg',
      'fortnite/..%2F..%2Fsecret.ogg',
      '%2E%2E/secret.ogg',
      'fortnite/pack.json',
      'fortnite/missing.ogg',
      'fortnite/sub/hit-body.ogg',
      'fortnite\\hit-body.ogg',
      'Fortnite/hit-body.ogg',
      'secret.ogg',
    ]) {
      expect(resolveSoundpackRequest(`${SOUNDPACK_BASE}${path}`, ON, dir), path).toBeNull();
    }
  });
});

describe("resolveSoundpackRequest: Krunker's own sounds", () => {
  beforeEach(() => install());

  it('answers a gun, its skins, and the hit marker with what is picked', () => {
    expect(resolveSoundpackRequest(sound('weapon_2'), ON, dir)).toBe(join(dir, 'fortnite', 'assault-rifle-scar.ogg'));
    expect(resolveSoundpackRequest(sound('weapon_2_9'), ON, dir)).toBe(join(dir, 'fortnite', 'assault-rifle-scar.ogg'));
    expect(resolveSoundpackRequest(sound('weapon_1'), ON, dir)).toBe(join(dir, 'fortnite', 'bolt-action-sniper-rifle.ogg'));
    expect(resolveSoundpackRequest(sound('hit_0'), ON, dir)).toBe(join(dir, 'fortnite', 'hit-body.ogg'));
  });

  it("lets Krunker's own through when switched off, or not picked", () => {
    expect(resolveSoundpackRequest(sound('weapon_2'), () => visuals(false, true), dir)).toBeNull();
    expect(resolveSoundpackRequest(sound('weapon_2'), () => visuals(true, false), dir)).toBeNull();
    expect(resolveSoundpackRequest(sound('weapon_2'), () => visuals(true, true, { '2': '' }), dir)).toBeNull();
    expect(resolveSoundpackRequest(sound('weapon_2_reload'), ON, dir)).toBeNull();
  });

  it("lets Krunker's own through when the picked file is not there", () => {
    // pump-shotgun was never written: silence would be worse than Krunker's.
    expect(resolveSoundpackRequest(sound('weapon_6'), ON, dir)).toBeNull();
  });

  it('reads the config per request, so a pick made mid-game is the next answer', () => {
    let v = ON();
    const read = (): VisualsConfig => v;
    expect(resolveSoundpackRequest(sound('weapon_1'), read, dir)).toBe(join(dir, 'fortnite', 'bolt-action-sniper-rifle.ogg'));
    v = visuals(true, true, { '1': '' });
    expect(resolveSoundpackRequest(sound('weapon_1'), read, dir)).toBeNull();
  });

  it('leaves every other address alone', () => {
    expect(resolveSoundpackRequest('https://assets.krunker.io/textures/weapon_2.png', ON, dir)).toBeNull();
    expect(resolveSoundpackRequest('https://krunker.io/sound/weapon_2.mp3', ON, dir)).toBeNull();
  });
});
