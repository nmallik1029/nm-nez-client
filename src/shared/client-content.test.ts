import { describe, expect, it } from 'vitest';
import { contentSources, normaliseClientContent, sortLibrary } from './client-content';

describe('normaliseClientContent', () => {
  it('is null only for something that is not the file at all', () => {
    expect(normaliseClientContent(null)).toBeNull();
    expect(normaliseClientContent([])).toBeNull();
    expect(normaliseClientContent('{}')).toBeNull();
    expect(normaliseClientContent({})).toEqual({ players: [], clans: [], settings: [] });
  });

  it('reads badges by name and by clan tag', () => {
    const content = normaliseClientContent({
      badges: {
        players: [{ name: ' SomeCreator ', badges: ['Creator', 'beta'] }],
        clans: [{ tag: 'Fame', badges: ['clan'] }],
      },
    });
    expect(content?.players).toEqual([{ name: 'SomeCreator', badges: ['creator', 'beta'] }]);
    expect(content?.clans).toEqual([{ tag: 'Fame', badges: ['clan'] }]);
  });

  it('drops badge ids that could not be a file name, duplicates, and anything past three', () => {
    const content = normaliseClientContent({
      badges: {
        players: [
          { name: 'a', badges: ['../owner', 'ok', 'ok', 'two', 'three', 'four', 5] },
          { name: 'nobody', badges: ['../x'] },
          { name: '', badges: ['ok'] },
          { badges: ['ok'] },
          'not an entry',
        ],
      },
    });
    expect(content?.players).toEqual([{ name: 'a', badges: ['ok', 'two', 'three'] }]);
  });

  it('reads a pick, with its settings checked like a paste', () => {
    const content = normaliseClientContent({
      settings: [
        {
          id: 'Pro-One',
          name: 'Pro one',
          date: '2026-10-25',
          placement: 2,
          region: 'EU',
          pro: true,
          event: 'KPC Autumn Cup',
          author: 'Someone',
          description: 'Low graphics.',
          screenshot: 'pro-one.png',
          settings: { fov: 120, customize: { loadouts: {} } },
        },
      ],
    });
    expect(content?.settings).toEqual([
      {
        id: 'pro-one',
        name: 'Pro one',
        date: '2026-10-25',
        placement: 2,
        region: 'EU',
        pro: true,
        event: 'KPC Autumn Cup',
        author: 'Someone',
        description: 'Low graphics.',
        screenshot: 'pro-one.png',
        settings: { fov: 120 },
      },
    ]);
  });

  it('fills a pick’s optional parts with nothing when they are missing', () => {
    const [pick] = normaliseClientContent({
      settings: [{ id: 'bare', name: 'Bare', date: '2026-01-02', settings: { fov: 1 } }],
    })?.settings ?? [];
    expect(pick).toMatchObject({ placement: null, region: null, pro: false, event: '', author: '', screenshot: '' });
  });

  it('takes a region by its code or its tag, and a placement as text too', () => {
    const picks = normaliseClientContent({
      settings: [
        { id: 'a', name: 'A', date: '2026-01-01', region: 'nack', placement: '1', settings: { fov: 1 } },
        { id: 'b', name: 'B', date: '2026-01-01', region: 'kpc', placement: 3, settings: { fov: 1 } },
        { id: 'c', name: 'C', date: '2026-01-01', region: 'ASIA', placement: 4, settings: { fov: 1 } },
      ],
    })?.settings;
    expect(picks?.map((p) => [p.region, p.placement])).toEqual([
      ['NA', 1],
      ['EU', 3],
      [null, null],
    ]);
  });

  it('drops a screenshot name that is not a plain picture in the folder', () => {
    const picks = normaliseClientContent({
      settings: ['../../x.png', 'shot.gif', 'https://x.com/a.png', 'ok-shot.webp'].map((screenshot, i) => ({
        id: `p${i}`,
        name: `P${i}`,
        date: '2026-01-01',
        screenshot,
        settings: { fov: 1 },
      })),
    })?.settings;
    expect(picks?.map((p) => p.screenshot)).toEqual(['', '', '', 'ok-shot.webp']);
  });

  it('drops picks with no usable id, name, date or settings, and repeated ids', () => {
    const content = normaliseClientContent({
      settings: [
        { id: 'one', name: 'One', date: '2026-10-01', settings: { fov: 1 } },
        { id: 'one', name: 'One again', date: '2026-10-01', settings: { fov: 2 } },
        { id: 'bad id!', name: 'Bad', date: '2026-10-01', settings: { fov: 1 } },
        { id: 'noname', name: '  ', date: '2026-10-01', settings: { fov: 1 } },
        { id: 'nodate', name: 'No date', settings: { fov: 1 } },
        { id: 'baddate', name: 'Feb 30', date: '2026-02-30', settings: { fov: 1 } },
        { id: 'textdate', name: 'Written out', date: 'October 1st', settings: { fov: 1 } },
        { id: 'empty', name: 'Empty', date: '2026-10-01', settings: {} },
        { id: 'loadouts', name: 'Only loadouts', date: '2026-10-01', settings: { customize: {} } },
      ],
    });
    expect(content?.settings.map((e) => e.id)).toEqual(['one']);
  });
});

describe('sortLibrary', () => {
  const pick = (id: string, date: string, placement: 1 | 2 | 3 | null) => ({
    id,
    name: id,
    date,
    placement,
    region: null,
    pro: false,
    event: '',
    author: '',
    description: '',
    screenshot: '',
    settings: { fov: 1 },
  });

  it('puts the newest first, and on the same day the winner first and the unplaced last', () => {
    const sorted = sortLibrary([
      pick('old-gold', '2026-09-01', 1),
      pick('new-unplaced', '2026-10-01', null),
      pick('new-bronze', '2026-10-01', 3),
      pick('new-gold', '2026-10-01', 1),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(['new-gold', 'new-bronze', 'new-unplaced', 'old-gold']);
  });
});

describe('contentSources', () => {
  it('asks GitHub first and its mirror second, both on main', () => {
    expect(contentSources()).toEqual([
      'https://raw.githubusercontent.com/nmallik1029/nm-nez-client/main/assets/content/client.json',
      'https://cdn.jsdelivr.net/gh/nmallik1029/nm-nez-client@main/assets/content/client.json',
    ]);
  });
});
