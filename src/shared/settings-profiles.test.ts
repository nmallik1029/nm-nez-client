import { describe, expect, it } from 'vitest';
import { normaliseProfiles, PROFILE_LIMIT, renameProfile, unusedProfileName } from './settings-profiles';

describe('normaliseProfiles', () => {
  it('keeps a good profile as it is', () => {
    const profile = { id: 'a', name: 'Ranked', settings: { fov: 120 }, savedAt: 5 };
    expect(normaliseProfiles([profile])).toEqual([profile]);
  });

  it('cleans names and settings, and dates a profile from an old config as 0', () => {
    expect(
      normaliseProfiles([{ id: 'a', name: '  Ranked   setup ', settings: { fov: 1, customize: {} } }]),
    ).toEqual([{ id: 'a', name: 'Ranked setup', settings: { fov: 1 }, savedAt: 0 }]);
  });

  it('drops profiles with nothing to apply, no name, or an id already used', () => {
    expect(
      normaliseProfiles([
        { id: 'a', name: 'One', settings: { fov: 1 } },
        { id: 'a', name: 'Same id', settings: { fov: 2 } },
        { id: 'b', name: '', settings: { fov: 1 } },
        { id: 'c', name: 'Empty', settings: {} },
        { id: '', name: 'No id', settings: { fov: 1 } },
        null,
        'profile',
      ]).map((p) => p.id),
    ).toEqual(['a']);
    expect(normaliseProfiles('not a list')).toEqual([]);
  });

  it('stops at the limit, so a hand-edited config cannot hand the tab a thousand rows', () => {
    const many = Array.from({ length: PROFILE_LIMIT + 5 }, (_, i) => ({
      id: `p${i}`,
      name: `P ${i}`,
      settings: { fov: i + 1 },
    }));
    expect(normaliseProfiles(many)).toHaveLength(PROFILE_LIMIT);
  });
});

describe('renameProfile', () => {
  const ranked = { id: 'a', name: 'Ranked', settings: { fov: 1 }, savedAt: 1 };
  const pubs = { id: 'b', name: 'Pubs', settings: { fov: 2 }, savedAt: 2 };

  it('renames one and leaves the rest alone', () => {
    const result = renameProfile([ranked, pubs], 'a', '  Ranked   v2 ');
    expect(result).toEqual({
      ok: true,
      name: 'Ranked v2',
      profiles: [{ ...ranked, name: 'Ranked v2' }, pubs],
    });
  });

  it('refuses a name another one has, whatever the case', () => {
    expect(renameProfile([ranked, pubs], 'a', 'PUBS')).toEqual({ ok: false, reason: 'taken' });
  });

  it('lets one change only the case of its own name', () => {
    expect(renameProfile([ranked, pubs], 'a', 'RANKED')).toMatchObject({ ok: true, name: 'RANKED' });
  });

  it('refuses an empty name, and one that is not in the list', () => {
    expect(renameProfile([ranked], 'a', '   ')).toEqual({ ok: false, reason: 'empty' });
    expect(renameProfile([ranked], 'nope', 'New')).toEqual({ ok: false, reason: 'missing' });
  });
});

describe('unusedProfileName', () => {
  it('numbers on from how many there are, skipping a name already taken', () => {
    expect(unusedProfileName([])).toBe('Settings 1');
    const one = { id: 'a', name: 'settings 2', settings: { fov: 1 }, savedAt: 0 };
    expect(unusedProfileName([one])).toBe('Settings 3');
  });
});
