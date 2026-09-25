import { describe, expect, it } from 'vitest';
import {
  changedSounds,
  DEFAULT_FORTNITE,
  effectiveFortnite,
  FORTNITE_SOUNDS,
  fortniteSoundFor,
  HEADSHOT_OPTIONS,
  HIT_OPTIONS,
  KRUNKER_GUNS,
  fortniteFileUrl,
  fortniteVolume,
  MAX_VOLUME,
  normaliseFortnite,
  soundKeyFromUrl,
  type FortniteConfig,
} from './soundpacks';

/**
 * The Fortnite picks, from the config to the file main reads.
 *
 * Two things matter. A pick becomes a file name in the main process, and the
 * config it comes from can be patched by page script, so nothing that is not
 * one of that gun's own options may survive normalising. And a gun is every
 * sound Krunker has for it, skins included: a pick that only reached the
 * default skin would be the pick half the lobby never hears.
 */

const ON: FortniteConfig = { ...DEFAULT_FORTNITE, on: true };

describe('the Fortnite gun list', () => {
  it('offers only sounds the pack has', () => {
    for (const id of [...KRUNKER_GUNS.flatMap((gun) => gun.options), ...HIT_OPTIONS, ...HEADSHOT_OPTIONS]) {
      expect(FORTNITE_SOUNDS, id).toHaveProperty([id]);
    }
  });

  it('offers every sound the pack has somewhere', () => {
    // One nobody can pick is a download nobody hears.
    const offered = new Set([...KRUNKER_GUNS.flatMap((gun) => gun.options), ...HIT_OPTIONS, ...HEADSHOT_OPTIONS]);
    expect(Object.keys(FORTNITE_SOUNDS).filter((id) => !offered.has(id))).toEqual([]);
  });

  it('names every sound as a plain file name', () => {
    for (const id of Object.keys(FORTNITE_SOUNDS)) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('lists each Krunker gun once, with something to pick', () => {
    const weapons = KRUNKER_GUNS.map((gun) => gun.weapon);
    expect(new Set(weapons).size).toBe(weapons.length);
    expect(new Set(KRUNKER_GUNS.map((gun) => gun.name)).size).toBe(weapons.length);
    for (const gun of KRUNKER_GUNS) {
      expect(gun.options.length).toBeGreaterThan(0);
      expect(new Set(gun.options).size).toBe(gun.options.length);
    }
  });

  it('gives the Assault Rifle the SCAR and the Sniper the bolt-action first', () => {
    const first = (weapon: number): string | undefined => KRUNKER_GUNS.find((gun) => gun.weapon === weapon)?.options[0];
    expect(first(2)).toBe('assault-rifle-scar');
    expect(first(1)).toBe('bolt-action-sniper-rifle');
    expect(DEFAULT_FORTNITE.guns['2']).toBe('assault-rifle-scar');
  });
});

describe('normaliseFortnite', () => {
  it('starts off, with every gun on its best fit', () => {
    expect(normaliseFortnite(undefined)).toEqual(DEFAULT_FORTNITE);
    expect(normaliseFortnite(null)).toEqual(DEFAULT_FORTNITE);
    expect(DEFAULT_FORTNITE.on).toBe(false);
  });

  it("keeps a pick that is one of that gun's options, and Krunker's own", () => {
    const f = normaliseFortnite({ on: true, guns: { '2': 'assault-rifle', '1': '' }, hit: '', headshot: 'hit-crit-elimination' });
    expect(f.on).toBe(true);
    expect(f.guns['2']).toBe('assault-rifle');
    expect(f.guns['1']).toBe('');
    expect(f.hit).toBe('');
    expect(f.headshot).toBe('hit-crit-elimination');
  });

  it("drops a pick that belongs to another gun, or to nothing, rather than cleaning it", () => {
    // Each of these would be a file name main reads.
    for (const pick of ['pump-shotgun', '../../config', 'assault-rifle-scar.ogg', 'ASSAULT-RIFLE', 7, null]) {
      expect(normaliseFortnite({ guns: { '2': pick } }).guns['2']).toBe('assault-rifle-scar');
    }
    expect(normaliseFortnite({ hit: 'hit-critical' }).hit).toBe('hit-body');
    expect(normaliseFortnite({ headshot: '../x' }).headshot).toBe('hit-critical');
  });

  it("gives a gun the saved config never heard of its best fit, not Krunker's own", () => {
    // What a release adding a gun looks like to a config saved before it.
    const { ['23']: _dropped, ...older } = DEFAULT_FORTNITE.guns;
    expect(normaliseFortnite({ on: true, guns: { ...older, '2': '' } }).guns).toEqual({
      ...DEFAULT_FORTNITE.guns,
      '2': '',
    });
  });

  it('keeps only the guns it knows', () => {
    expect(normaliseFortnite({ guns: { '13': 'assault-rifle', __proto__: 'x' } }).guns).toEqual(DEFAULT_FORTNITE.guns);
  });

  it('only a real true switches it on', () => {
    expect(normaliseFortnite({ on: 'yes' }).on).toBe(false);
    expect(normaliseFortnite({ on: 1 }).on).toBe(false);
  });

  it('survives the shapes a hostile patch would actually take', () => {
    for (const raw of [5, 'x', [], { guns: 'x' }, { guns: null }, { guns: [] }]) {
      expect(() => normaliseFortnite(raw)).not.toThrow();
    }
  });
});

describe('soundKeyFromUrl', () => {
  it("reads the key out of one of Krunker's sounds", () => {
    expect(soundKeyFromUrl('https://assets.krunker.io/sound/weapon_2_5.mp3?build=abc')).toBe('weapon_2_5');
    expect(soundKeyFromUrl('https://assets.krunker.io/sound/hit_0.mp3')).toBe('hit_0');
  });

  it('is null for anything else', () => {
    expect(soundKeyFromUrl('https://assets.krunker.io/sounds/soundpacks/fortnite/pistol.ogg')).toBeNull();
    expect(soundKeyFromUrl('https://assets.krunker.io/sound/weapon_2.ogg')).toBeNull();
    expect(soundKeyFromUrl('https://assets.krunker.io/sound/../textures/weapon_2.mp3')).toBeNull();
    expect(soundKeyFromUrl('https://evil.example/sound/weapon_2.mp3')).toBeNull();
    expect(soundKeyFromUrl('https://assets.krunker.io/sound/weapon_2.mp3.png')).toBeNull();
  });
});

describe('fortniteSoundFor', () => {
  it("answers a gun's own sound and every skin's with the pick for that gun", () => {
    const f = { ...ON, guns: { ...ON.guns, '2': 'heavy-assault-rifle' } };
    expect(fortniteSoundFor('weapon_2', f)).toBe('heavy-assault-rifle');
    expect(fortniteSoundFor('weapon_2_5', f)).toBe('heavy-assault-rifle');
    expect(fortniteSoundFor('weapon_1_12', f)).toBe('bolt-action-sniper-rifle');
  });

  it("answers the Charge Rifle's charged shot as the Charge Rifle", () => {
    expect(fortniteSoundFor('weapon_29_blast', ON)).toBe(fortniteSoundFor('weapon_29', ON));
    expect(fortniteSoundFor('weapon_29_blast', ON)).not.toBeNull();
  });

  it('answers the hit marker, and the headshot as both of the sounds Krunker has for one', () => {
    expect(fortniteSoundFor('hit_0', ON)).toBe('hit-body');
    // A headshot that lands, which in Krunker is hit_0's file under another
    // name, and a kill with one. Answering only the kill left every other
    // headshot sounding like a body hit.
    expect(fortniteSoundFor('crit_0', ON)).toBe('hit-critical');
    expect(fortniteSoundFor('headshot_0', ON)).toBe('hit-critical');
  });

  it("leaves Krunker's own where that is the pick", () => {
    const f = { ...ON, guns: { ...ON.guns, '2': '' }, hit: '', headshot: '' };
    expect(fortniteSoundFor('weapon_2', f)).toBeNull();
    expect(fortniteSoundFor('hit_0', f)).toBeNull();
    expect(fortniteSoundFor('crit_0', f)).toBeNull();
    expect(fortniteSoundFor('headshot_0', f)).toBeNull();
  });

  it('leaves guns it has no pick for, and every other sound', () => {
    // Reloads as Krunker names them (weapon_5_11_r_1), and near misses.
    for (const key of [
      'weapon_13', 'weapon_2_reload', 'reload_2', 'weapon_5_11_r_1', 'weapon_29_blast_r_1', 'weapon_2_blast2',
      'footstep_0', 'weapon_', 'hit_1', 'crit_1', 'instantkill_0', 'weapon_2_5_1',
    ]) {
      expect(fortniteSoundFor(key, ON), key).toBeNull();
    }
  });

  it('refuses a pick that is not one of the gun options, even unnormalised', () => {
    expect(fortniteSoundFor('weapon_2', { ...ON, guns: { '2': '../../x' } })).toBeNull();
  });

  it('answers nothing while it is off', () => {
    for (const key of ['weapon_2', 'weapon_2_5', 'weapon_29_blast', 'hit_0', 'crit_0', 'headshot_0']) {
      expect(fortniteSoundFor(key, DEFAULT_FORTNITE)).toBeNull();
    }
  });
});

describe('changedSounds', () => {
  it('reloads only the gun that changed, skins and all', () => {
    const changed = changedSounds(ON, { ...ON, guns: { ...ON.guns, '2': 'assault-rifle' } });
    expect(changed('weapon_2')).toBe(true);
    expect(changed('weapon_2_7')).toBe(true);
    expect(changed('weapon_1')).toBe(false);
    expect(changed('hit_0')).toBe(false);
  });

  it('reloads every replaced sound when it is switched on or off', () => {
    for (const changed of [changedSounds(DEFAULT_FORTNITE, ON), changedSounds(ON, DEFAULT_FORTNITE)]) {
      expect(changed('weapon_2')).toBe(true);
      expect(changed('weapon_21')).toBe(true);
      expect(changed('headshot_0')).toBe(true);
      expect(changed('crit_0')).toBe(true);
      expect(changed('weapon_13')).toBe(false);
      expect(changed('footstep_0')).toBe(false);
    }
  });

  it('with nothing before, reloads whatever is picked now', () => {
    const changed = changedSounds(null, { ...ON, guns: { ...ON.guns, '2': '' } });
    expect(changed('weapon_1')).toBe(true);
    expect(changed('weapon_2')).toBe(false);
  });
});

describe('effectiveFortnite', () => {
  it('is on only while the Soundpacks switch is on too', () => {
    expect(effectiveFortnite(true, ON).on).toBe(true);
    expect(effectiveFortnite(false, ON).on).toBe(false);
    expect(effectiveFortnite(true, DEFAULT_FORTNITE).on).toBe(false);
    // Off keeps the picks, so switching back on brings them back.
    expect(effectiveFortnite(false, ON).guns).toEqual(ON.guns);
  });
});

describe('the Fortnite volume', () => {
  const loud: FortniteConfig = { ...ON, volume: 1.5 };

  it("defaults to Krunker's own level, and normalises to it", () => {
    expect(DEFAULT_FORTNITE.volume).toBe(1);
    expect(normaliseFortnite({}).volume).toBe(1);
    expect(normaliseFortnite({ volume: 'loud' }).volume).toBe(1);
    expect(normaliseFortnite({ volume: NaN }).volume).toBe(1);
  });

  it('keeps a volume in range and clamps one outside it', () => {
    expect(normaliseFortnite({ volume: 0 }).volume).toBe(0);
    expect(normaliseFortnite({ volume: 1.5 }).volume).toBe(1.5);
    expect(normaliseFortnite({ volume: 99 }).volume).toBe(MAX_VOLUME);
    expect(normaliseFortnite({ volume: -1 }).volume).toBe(0);
  });

  it('leaves the call alone at 1, where the multiply would do nothing', () => {
    expect(fortniteVolume('weapon_2', ON, undefined)).toBeNull();
    expect(fortniteVolume('weapon_2', ON, 0.5)).toBeNull();
  });

  it('leaves alone every sound the pack does not replace', () => {
    // A gun with no Fortnite sound, a reload, and the pack switched off.
    expect(fortniteVolume('weapon_99', loud, undefined)).toBeNull();
    expect(fortniteVolume('weapon_2_r_1', loud, undefined)).toBeNull();
    expect(fortniteVolume('weapon_2', { ...loud, on: false }, undefined)).toBeNull();
  });

  it('scales a replaced sound, and reads a missing volume as 1 the way Krunker does', () => {
    expect(fortniteVolume('weapon_2', loud, undefined)).toBeCloseTo(1.5);
    expect(fortniteVolume('weapon_2', loud, 0.4)).toBeCloseTo(0.6);
    // Krunker's own `(volume || 1)`: a falsy volume is 1 to it, so to us too.
    expect(fortniteVolume('weapon_2', loud, 0)).toBeCloseTo(1.5);
    expect(fortniteVolume('hit_0', loud, undefined)).toBeCloseTo(1.5);
  });

  it('never returns a volume Krunker would read back as full', () => {
    // `(volume || 1)` turns a 0 into full volume, so all the way down has to
    // be sent as very nearly nothing instead.
    const silent = fortniteVolume('weapon_2', { ...ON, volume: 0 }, undefined);
    expect(silent).not.toBeNull();
    expect(silent).toBeGreaterThan(0);
    expect(silent).toBeLessThan(0.001);
  });
});

describe('fortniteFileUrl', () => {
  it('is an address main answers from the pack on disk', () => {
    expect(fortniteFileUrl('hand-cannon')).toBe(
      'https://assets.krunker.io/sounds/soundpacks/fortnite/hand-cannon.ogg',
    );
  });
});
