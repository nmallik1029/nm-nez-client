import { describe, expect, it } from 'vitest';
import {
  capturePreset,
  inScope,
  normalisePresets,
  planPreset,
  PRESET_LIMIT,
  PRESET_NAME_MAX,
  presetName,
  presetScope,
  summarisePreset,
  type PresetScope,
} from './presets';

/**
 * The part worth testing is what a switch writes, because a wrong answer
 * there is a sensitivity you did not choose, applied mid-match. The rest is
 * DOM.
 */

function scope(id: string): PresetScope {
  const found = presetScope(id);
  if (!found) throw new Error(`no scope ${id}`);
  return found;
}

const SENS = scope('sensitivity');
const FOV = scope('fov');

/** A stand-in for the game's storage, keyed by setting id. */
function storage(values: Record<string, string>): {
  read: (id: string) => string | null;
  ids: string[];
} {
  return { read: (id) => values[id] ?? null, ids: Object.keys(values) };
}

describe('capturePreset', () => {
  it('records the default for a setting the game has never stored', () => {
    const game = storage({ sensitivityX: '1.2' });
    expect(capturePreset(SENS, game.read, game.ids)).toEqual({
      sensitivityX: '1.2',
      sensitivityY: '1',
      aimSensitivityX: '1',
      aimSensitivityY: '1',
    });
  });

  it('picks up per-weapon copies from storage, and only those in scope', () => {
    const game = storage({ fov: '110', fov_3: '120', fov_0: '90', sensitivityX_2: '4', crosshairSho: '0' });
    expect(capturePreset(FOV, game.read, game.ids)).toEqual({
      fov: '110',
      fov_0: '90',
      fov_3: '120',
      fpsFOV: '95',
      adsFovMlt: '1',
    });
  });

  it("treats the literal 'undefined' as unset, as the game does", () => {
    const game = storage({ fov: 'undefined' });
    expect(capturePreset(FOV, game.read, game.ids).fov).toBe('100');
  });
});

describe('planPreset', () => {
  it('writes only what differs', () => {
    const game = storage({ sensitivityX: '1.2', sensitivityY: '1.2' });
    const values = { sensitivityX: '1.2', sensitivityY: '0.8', aimSensitivityX: '1', aimSensitivityY: '1' };
    expect(planPreset(SENS, values, game.read, game.ids)).toEqual([['sensitivityY', '0.8']]);
  });

  it('is empty for the preset that is already in use', () => {
    const game = storage({ fov: '120', fov_2: '105', fpsFOV: '100' });
    const values = capturePreset(FOV, game.read, game.ids);
    expect(planPreset(FOV, values, game.read, game.ids)).toEqual([]);
  });

  it('puts a setting back to its default when the preset was taken at it', () => {
    // Taken with FOV untouched, applied after FOV was turned up.
    const before = storage({});
    const values = capturePreset(FOV, before.read, before.ids);
    const now = storage({ fov: '130' });
    expect(planPreset(FOV, values, now.read, now.ids)).toEqual([['fov', '100']]);
  });

  it('resets a per-weapon copy the preset did not have', () => {
    const values = { fov: '100', fpsFOV: '95', adsFovMlt: '1', fov_1: '120' };
    const game = storage({ fov_1: '120', fov_4: '140' });
    expect(planPreset(FOV, values, game.read, game.ids)).toEqual([['fov_4', '100']]);
  });

  it('writes a per-weapon copy the game has not stored yet', () => {
    const values = { sensitivityX: '1', sensitivityX_7: '2.5' };
    expect(planPreset(SENS, values, () => null, [])).toEqual([['sensitivityX_7', '2.5']]);
  });

  it('never writes anything outside the scope', () => {
    const values = { fov: '100', crosshairSho: '4', sensitivityX: '9', 'fov_1; x': '1' };
    const game = storage({ fov: '110', sensitivityX: '1' });
    expect(planPreset(FOV, values, game.read, game.ids)).toEqual([['fov', '100']]);
  });

  it('does not count 1 and 1.0 as a change', () => {
    const game = storage({ sensitivityX: '1' });
    expect(planPreset(SENS, { sensitivityX: '1.0' }, game.read, game.ids)).toEqual([]);
  });

  describe('write order, which decides the FOV you are left looking at', () => {
    const values = { fov: '110', fov_10: '110', fov_2: '110', fpsFOV: '100', fpsFOV_1: '100' };

    it('writes the plain settings last on All, since those are in force', () => {
      expect(planPreset(FOV, values, () => null, []).map(([id]) => id)).toEqual([
        'fov_2',
        'fov_10',
        'fpsFOV_1',
        'fov',
        'fpsFOV',
      ]);
    });

    it('writes each setting before its per-weapon copies on Per Weapon', () => {
      const game = storage({ vmSetts: '1' });
      expect(planPreset(FOV, values, game.read, game.ids).map(([id]) => id)).toEqual([
        'fov',
        'fov_2',
        'fov_10',
        'fpsFOV',
        'fpsFOV_1',
      ]);
    });

    it('reads the mode for its own scope', () => {
      // The viewmodel picker says nothing about sensitivity.
      const game = storage({ vmSetts: '1' });
      const sens = { sensitivityX: '2', sensitivityX_0: '2' };
      expect(planPreset(SENS, sens, game.read, game.ids).map(([id]) => id)).toEqual([
        'sensitivityX_0',
        'sensitivityX',
      ]);
    });
  });
});

describe('inScope', () => {
  it('knows per-weapon copies without being told how many weapons there are', () => {
    expect(inScope(SENS, 'aimSensitivityY_14')).toBe(true);
    expect(inScope(SENS, 'aimSensitivityY')).toBe(true);
    expect(inScope(SENS, 'fov_1')).toBe(false);
    expect(inScope(FOV, 'fov_01')).toBe(false);
    expect(inScope(FOV, 'fov_')).toBe(false);
    expect(inScope(FOV, 'fovx_1')).toBe(false);
  });
});

describe('summarisePreset', () => {
  it('collapses a matching X and Y into one number', () => {
    expect(
      summarisePreset(SENS, {
        sensitivityX: '1.2',
        sensitivityY: '1.2',
        aimSensitivityX: '0.8',
        aimSensitivityY: '0.8',
      }),
    ).toBe('Sens 1.2 · ADS 0.8');
  });

  it('shows both when they differ, and fills in defaults', () => {
    expect(summarisePreset(SENS, { sensitivityX: '1.2', sensitivityY: '1.5' })).toBe('Sens 1.2 / 1.5 · ADS 1');
  });

  it('says when a preset carries per-weapon values', () => {
    expect(summarisePreset(FOV, { fov: '120', fov_3: '100' })).toBe('FOV 120 · Weapon 95 · ADS × 1 · per weapon');
  });
});

describe('presetName', () => {
  it('tidies whitespace and caps the length', () => {
    expect(presetName('  sniper \n  sens  ')).toBe('sniper sens');
    expect(presetName('x'.repeat(100))).toHaveLength(PRESET_NAME_MAX);
    expect(presetName('   ')).toBe('');
  });
});

describe('normalisePresets', () => {
  const good = { id: 'a', name: 'Sniper', scope: 'sensitivity', values: { sensitivityX: '0.7' } };

  it('keeps a well-formed preset as it is', () => {
    expect(normalisePresets([good])).toEqual([good]);
  });

  it('drops anything that is not a list', () => {
    expect(normalisePresets(undefined)).toEqual([]);
    expect(normalisePresets({ 0: good })).toEqual([]);
  });

  it('drops malformed entries and keeps the rest', () => {
    const result = normalisePresets([
      good,
      null,
      'preset',
      { ...good, id: '' },
      { ...good, id: 'b', name: '   ' },
      { ...good, id: 'c', scope: 'crosshair' },
      { ...good, id: 'd', name: 42 },
      { ...good, name: 'Duplicate id' },
      { ...good, id: 'e', values: 'nope' },
    ]);
    expect(result).toEqual([good, { id: 'e', name: 'Sniper', scope: 'sensitivity', values: {} }]);
  });

  it('strips values the scope does not own, and values that are not strings', () => {
    const [preset] = normalisePresets([
      {
        id: 'x',
        name: 'Wide',
        scope: 'fov',
        values: { fov: '120', fov_2: '110', crosshairSho: '0', fpsFOV: 105, adsFovMlt: '1'.repeat(100) },
      },
    ]);
    expect(preset?.values).toEqual({ fov: '120', fov_2: '110' });
  });

  it('caps each scope separately', () => {
    const many = Array.from({ length: PRESET_LIMIT + 5 }, (_, i) => ({ ...good, id: `s${i}` }));
    const fov = { id: 'f', name: 'Wide', scope: 'fov', values: {} };
    const result = normalisePresets([...many, fov]);
    expect(result.filter((p) => p.scope === 'sensitivity')).toHaveLength(PRESET_LIMIT);
    expect(result.at(-1)).toEqual(fov);
  });
});
