import { describe, expect, it } from 'vitest';
import { KRUNKER_RANK_LADDER } from '../krunker/constants';
import { sameRankName, standing } from './rank-progress';

describe('standing', () => {
  it('puts the bottom of the ladder at the start of Bronze 1', () => {
    const at = standing(0);
    expect(at?.current.name).toBe('Bronze 1');
    expect(at?.next?.name).toBe('Bronze 2');
    expect(at?.toGo).toBe(200);
    expect(at?.fraction).toBe(0);
  });

  it('counts the last point of a rank as still in it', () => {
    const at = standing(199);
    expect(at?.current.name).toBe('Bronze 1');
    expect(at?.toGo).toBe(1);
  });

  it('moves up exactly on the threshold', () => {
    expect(standing(200)?.current.name).toBe('Bronze 2');
  });

  it('measures the gap mid-rank', () => {
    const at = standing(1460);
    expect(at?.current.name).toBe('Gold 1');
    expect(at?.next?.name).toBe('Gold 2');
    expect(at?.toGo).toBe(140);
    expect(at?.fraction).toBeCloseTo(160 / 300, 5);
  });

  it('rounds a part point up, since it is not earned yet', () => {
    expect(standing(1599.4)?.toGo).toBe(1);
  });

  it('has nothing left to climb at the top', () => {
    const at = standing(4700);
    expect(at?.current.name).toBe('Kracked');
    expect(at?.next).toBeNull();
    expect(at?.toGo).toBe(0);
    expect(at?.fraction).toBe(1);
  });

  it('stays at the top above it', () => {
    expect(standing(99999)?.current.name).toBe('Kracked');
    expect(standing(99999)?.next).toBeNull();
  });

  it('says nothing below the ladder or about a non-number', () => {
    expect(standing(-1)).toBeNull();
    expect(standing(Number.NaN)).toBeNull();
    // Infinity is not a rating either way round, however far up it looks.
    expect(standing(Number.POSITIVE_INFINITY)).toBeNull();
    expect(standing(Number.NEGATIVE_INFINITY)).toBeNull();
  });

  it('lands every threshold on its own rank, with the bar empty', () => {
    for (const step of KRUNKER_RANK_LADDER) {
      const at = standing(step.elo);
      expect(at?.current.name).toBe(step.name);
      expect(at?.fraction).toBe(step.name === 'Kracked' ? 1 : 0);
    }
  });

  it('keeps the bar inside the bar all the way up', () => {
    for (let elo = 0; elo <= 5200; elo += 17) {
      const at = standing(elo);
      expect(at).not.toBeNull();
      expect(at!.fraction).toBeGreaterThanOrEqual(0);
      expect(at!.fraction).toBeLessThanOrEqual(1);
      expect(at!.toGo).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('sameRankName', () => {
  it('ignores case and spacing', () => {
    expect(sameRankName('GOLD 2', 'Gold 2')).toBe(true);
    expect(sameRankName('  gold   2 ', 'Gold 2')).toBe(true);
  });

  it('reads a division in roman numerals as the same rank', () => {
    expect(sameRankName('Gold II', 'Gold 2')).toBe(true);
    expect(sameRankName('Bronze III', 'Bronze 3')).toBe(true);
  });

  it('still calls a different division a disagreement', () => {
    expect(sameRankName('Gold 2', 'Gold 3')).toBe(false);
    expect(sameRankName('Unranked', 'Bronze 1')).toBe(false);
    expect(sameRankName('Platinum', 'Diamond')).toBe(false);
  });
});
