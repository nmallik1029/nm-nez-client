import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IMPORT_KEEP,
  describeSettings,
  keepCurrent,
  keepGroupOf,
  normaliseImportKeep,
  normaliseSettingsPayload,
  parseSettingsText,
  sameSettings,
  type ImportKeep,
} from './settings-import';

const NONE: ImportKeep = { sensitivity: false, sounds: false, keybinds: false };

/** A game's storage, as `kro_setngss_` keys with the prefix taken off. */
function storage(values: Record<string, string>): {
  read: (id: string) => string | null;
  ids: string[];
} {
  return { read: (id) => values[id] ?? null, ids: Object.keys(values) };
}

describe('keepGroupOf', () => {
  it('puts every sensitivity there is in the sensitivity group', () => {
    for (const id of [
      'sensitivityX',
      'sensitivityY',
      'aimSensitivityX',
      'aimSensitivityY',
      'sensitivityX_3',
      'aimSensitivityY_12',
      'sensitivityXCntrl',
      'aimSensitivityYMbl',
    ]) {
      expect(keepGroupOf(id), id).toBe('sensitivity');
    }
  });

  it('keeps the All / Per Weapon choice with the sensitivity, since it decides which values are used', () => {
    expect(keepGroupOf('gpSetts')).toBe('sensitivity');
  });

  it('puts the whole Audio category in sounds', () => {
    for (const id of ['sound', 'gunsVolume', 'uiVolume', 'micQuality', 'voiceChatType', 'muteSpec']) {
      expect(keepGroupOf(id), id).toBe('sounds');
    }
  });

  it('leaves everything else to the import', () => {
    for (const id of ['fov', 'shadows', 'controls', 'customize', 'vmSetts', 'crosshairSho']) {
      expect(keepGroupOf(id), id).toBeNull();
    }
  });
});

describe('keepCurrent', () => {
  it('takes keybinds out, because an import without them leaves them alone', () => {
    const { read, ids } = storage({});
    const out = keepCurrent({ fov: 120, controls: { jump: 32 } }, { ...NONE, keybinds: true }, read, ids);
    expect(out).toEqual({ fov: 120 });
  });

  it('writes your sensitivity over the imported one', () => {
    const { read, ids } = storage({ sensitivityX: '0.5', aimSensitivityX: '0.4' });
    const out = keepCurrent(
      { sensitivityX: 2, aimSensitivityX: 1.5, fov: 120 },
      { ...NONE, sensitivity: true },
      read,
      ids,
    );
    expect(out).toEqual({ sensitivityX: '0.5', aimSensitivityX: '0.4', fov: 120 });
  });

  it('writes in a kept setting the import does not mention, which it would otherwise reset', () => {
    const { read, ids } = storage({ gunsVolume: '0.3', sensitivityY_4: '0.7' });
    const out = keepCurrent({ fov: 120 }, { ...NONE, sensitivity: true, sounds: true }, read, ids);
    expect(out).toEqual({ fov: 120, gunsVolume: '0.3', sensitivityY_4: '0.7' });
  });

  it('takes out a kept setting you never changed, since the import then leaves it at the same default', () => {
    const { read, ids } = storage({});
    const out = keepCurrent({ sensitivityX: 2, sound: 0.1 }, { ...NONE, sensitivity: true, sounds: true }, read, ids);
    expect(out).toEqual({});
  });

  it('reads a stored "undefined" as never changed, the way the game does', () => {
    const { read, ids } = storage({ sensitivityX: 'undefined' });
    expect(keepCurrent({ sensitivityX: 2 }, { ...NONE, sensitivity: true }, read, ids)).toEqual({});
  });

  it('only keeps the groups that are switched on', () => {
    const { read, ids } = storage({ sensitivityX: '0.5', sound: '0.2' });
    const out = keepCurrent(
      { sensitivityX: 2, sound: 1, controls: { jump: 32 } },
      { ...NONE, sounds: true },
      read,
      ids,
    );
    expect(out).toEqual({ sensitivityX: 2, sound: '0.2', controls: { jump: 32 } });
  });

  it('keeps nothing with every switch off', () => {
    const { read, ids } = storage({ sensitivityX: '0.5' });
    const payload = { sensitivityX: 2, controls: { jump: 32 } };
    expect(keepCurrent(payload, NONE, read, ids)).toEqual(payload);
  });

  it('never changes the payload it was handed', () => {
    const { read, ids } = storage({ sensitivityX: '0.5' });
    const payload = { sensitivityX: 2, controls: { jump: 32 } };
    keepCurrent(payload, DEFAULT_IMPORT_KEEP, read, ids);
    expect(payload).toEqual({ sensitivityX: 2, controls: { jump: 32 } });
  });
});

describe('normaliseSettingsPayload', () => {
  it('keeps settings and keybinds, and never loadouts', () => {
    expect(
      normaliseSettingsPayload({
        fov: 120,
        shadows: false,
        crosshairSho: '2',
        controls: { jump: [32] },
        customize: { loadouts: { a: {} } },
      }),
    ).toEqual({ fov: 120, shadows: false, crosshairSho: '2', controls: { jump: [32] } });
  });

  it('drops anything that is not a plain value of a setting the game could have', () => {
    expect(
      normaliseSettingsPayload({
        fov: 120,
        nested: { a: 1 },
        list: [1, 2],
        notANumber: Number.NaN,
        nothing: null,
        'bad id': 1,
        _private: 1,
        huge: 'x'.repeat(5000),
      }),
    ).toEqual({ fov: 120 });
  });

  it('never assigns __proto__, whatever the text says', () => {
    const out = normaliseSettingsPayload(JSON.parse('{"__proto__":{"polluted":true},"fov":100}'));
    expect(out).toEqual({ fov: 100 });
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('drops keybinds that are not an object, or far too big to be real', () => {
    expect(normaliseSettingsPayload({ fov: 1, controls: [1, 2] })).toEqual({ fov: 1 });
    expect(normaliseSettingsPayload({ fov: 1, controls: { x: 'y'.repeat(70_000) } })).toEqual({ fov: 1 });
  });

  it('is null for nothing usable, so an empty profile never resets everything', () => {
    expect(normaliseSettingsPayload({})).toBeNull();
    expect(normaliseSettingsPayload({ customize: {} })).toBeNull();
    expect(normaliseSettingsPayload([])).toBeNull();
    expect(normaliseSettingsPayload('fov')).toBeNull();
    expect(normaliseSettingsPayload(null)).toBeNull();
  });
});

describe('sameSettings', () => {
  it('sees values the way the game does', () => {
    expect(sameSettings({ a: true, b: 1, c: 'x' }, { a: 'true', b: '1.0', c: 'x' }, NONE)).toBe(true);
    expect(sameSettings({ a: 1 }, { a: 2 }, NONE)).toBe(false);
  });

  it('counts a setting one side leaves at its default as different', () => {
    expect(sameSettings({ fov: 120 }, {}, NONE)).toBe(false);
  });

  it('leaves out the kept groups, which an import would not change', () => {
    expect(sameSettings({ fov: 120, sensitivityX: 2 }, { fov: 120, sensitivityX: 0.5 }, NONE)).toBe(false);
    expect(
      sameSettings({ fov: 120, sensitivityX: 2 }, { fov: 120, sensitivityX: 0.5 }, { ...NONE, sensitivity: true }),
    ).toBe(true);
  });

  it('compares keybinds only when they are not kept', () => {
    const a = { fov: 1, controls: { jump: [32] } };
    const b = { fov: 1, controls: { jump: [70] } };
    expect(sameSettings(a, b, NONE)).toBe(false);
    expect(sameSettings(a, b, { ...NONE, keybinds: true })).toBe(true);
  });

  it('ignores loadouts, which the library never applies', () => {
    expect(sameSettings({ fov: 1 }, { fov: 1, customize: { loadouts: {} } }, NONE)).toBe(true);
  });
});

describe('the small parts', () => {
  it('reads settings text, and nothing else, as an object', () => {
    expect(parseSettingsText('{"fov":120}')).toEqual({ fov: 120 });
    expect(parseSettingsText('[1]')).toBeNull();
    expect(parseSettingsText('not json')).toBeNull();
  });

  it('describes a payload in a line', () => {
    expect(describeSettings({ fov: 1, shadows: false, controls: {}, customize: {} })).toBe('2 settings · keybinds');
    expect(describeSettings({ fov: 1 })).toBe('1 setting');
  });

  it('keeps a switch it cannot read, rather than dropping something someone meant to keep', () => {
    expect(normaliseImportKeep(undefined)).toEqual(DEFAULT_IMPORT_KEEP);
    expect(normaliseImportKeep({ sounds: false, keybinds: 'no' })).toEqual({
      sensitivity: true,
      sounds: false,
      keybinds: true,
    });
  });
});
