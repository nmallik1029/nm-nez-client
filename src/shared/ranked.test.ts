import { describe, expect, it } from 'vitest';
import {
  buildQueueUrl,
  formatQueueTime,
  normaliseToken,
  parseQueueMessage,
  RANKED_MAPS,
  RANKED_QUEUE_WS,
  RANKED_REGIONS,
  rankedMapLabel,
  rankedRegionLabel,
} from './ranked';

const frame = (obj: unknown): string => JSON.stringify(obj);

describe('buildQueueUrl', () => {
  it('encodes token, maps and regions', () => {
    const url = new URL(buildQueueUrl('abc123', [2, 0], ['eu']));
    expect(`${url.protocol}//${url.host}${url.pathname}`).toBe(RANKED_QUEUE_WS);
    expect(url.searchParams.get('token')).toBe('abc123');
    expect(url.searchParams.get('regions')).toBe('eu');
  });

  it('sorts map ids so the same selection always produces the same URL', () => {
    expect(new URL(buildQueueUrl('t', [11, 0, 4], ['na'])).searchParams.get('maps')).toBe('0,4,11');
  });

  it('escapes a token containing URL metacharacters', () => {
    const url = buildQueueUrl('a&b=c d', [0], ['na']);
    expect(url).not.toContain('a&b=c d');
    expect(new URL(url).searchParams.get('token')).toBe('a&b=c d');
  });
});

describe('parseQueueMessage', () => {
  it('reads a match assignment', () => {
    const msg = parseQueueMessage(frame({
      type: 'QUEUE_STATUS',
      payload: { status: 'MATCHED', assignment: { extensions: { map: ' 14 ', region: 'xxeu' } } },
    }));
    expect(msg).toEqual({ kind: 'matched', mapId: 14, region: 'xxeu' });
  });

  it('treats a non-matched status as still queued', () => {
    expect(parseQueueMessage(frame({ type: 'QUEUE_STATUS', payload: { status: 'SEARCHING' } })))
      .toEqual({ kind: 'queued' });
  });

  it('reads a cooldown', () => {
    expect(parseQueueMessage(frame({
      type: 'ERROR', payload: { code: 'COOLDOWN', payload: { cooldown: 120 } },
    }))).toEqual({ kind: 'cooldown', seconds: 120 });
  });

  it('defaults a missing cooldown value to zero rather than NaN', () => {
    expect(parseQueueMessage(frame({ type: 'ERROR', payload: { code: 'COOLDOWN' } })))
      .toEqual({ kind: 'cooldown', seconds: 0 });
  });

  it('surfaces other errors as fatal with their code', () => {
    expect(parseQueueMessage(frame({ type: 'ERROR', payload: { code: 'BANNED' } })))
      .toEqual({ kind: 'fatal', code: 'BANNED' });
    expect(parseQueueMessage(frame({ type: 'INTERNAL_ERROR' })))
      .toEqual({ kind: 'fatal', code: 'INTERNAL_ERROR' });
  });

  it('never throws on junk', () => {
    // Dropping a frame we do not understand beats tearing down a queue the
    // user has been sitting in for ten minutes.
    for (const junk of ['', 'not json', '[]', 'null', '{"type":"WHO_KNOWS"}', '{}']) {
      expect(() => parseQueueMessage(junk)).not.toThrow();
      expect(['other', 'queued']).toContain(parseQueueMessage(junk).kind);
    }
  });

  it('rejects a match with an unparseable map id', () => {
    expect(parseQueueMessage(frame({
      type: 'QUEUE_STATUS',
      payload: { status: 'MATCHED', assignment: { extensions: { map: 'burg', region: 'eu' } } },
    })).kind).toBe('other');
  });

  it('handles a MATCHED frame with no assignment', () => {
    expect(parseQueueMessage(frame({ type: 'QUEUE_STATUS', payload: { status: 'MATCHED' } })).kind)
      .toBe('other');
  });
});

describe('labels', () => {
  it('names every ranked map', () => {
    for (const map of RANKED_MAPS) expect(rankedMapLabel(map.id)).toBe(map.label);
  });

  it('falls back for a map outside the pool', () => {
    expect(rankedMapLabel(999)).toBe('Map 999');
  });

  it('resolves a region id directly or with the server prefix', () => {
    expect(rankedRegionLabel('eu')).toBe('Europe');
    expect(rankedRegionLabel('xxeu')).toBe('Europe');
    expect(rankedRegionLabel('naus-ca-sv')).toBe('North America');
  });

  it('shows an unknown region verbatim rather than inventing a name', () => {
    expect(rankedRegionLabel('zz-somewhere')).toBe('zz-somewhere');
  });

  it('has a label for every region id', () => {
    for (const region of RANKED_REGIONS) expect(rankedRegionLabel(region.id)).toBe(region.label);
  });
});

describe('normaliseToken', () => {
  it('strips the quoting Krunker stores around it', () => {
    expect(normaliseToken('"abc/def"')).toBe('abcdef');
    expect(normaliseToken('  plain  ')).toBe('plain');
  });
});

describe('formatQueueTime', () => {
  it('formats mm:ss', () => {
    expect(formatQueueTime(0)).toBe('00:00');
    expect(formatQueueTime(65)).toBe('01:05');
    expect(formatQueueTime(3599)).toBe('59:59');
  });

  it('clamps negatives', () => {
    expect(formatQueueTime(-5)).toBe('00:00');
  });
});
