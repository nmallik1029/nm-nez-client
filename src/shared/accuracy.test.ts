import { describe, expect, it } from 'vitest';
import {
  accuracyLabel,
  EMPTY_ACCURACY,
  EMPTY_TALLY,
  HIT_MERGE_MS,
  HIT_WINDOW_MS,
  lifeShown,
  readAmmo,
  shotsBetween,
  tallyHit,
  tallyNewLife,
  tallyShots,
  withHit,
  withShots,
  type AccuracyState,
  type AccuracyTally,
} from './accuracy';

/**
 * The counter is only as good as its refusals. Every way the ammo counter
 * moves without a shot, and every way a hit sound plays more than once for
 * one shot, is a way to show a number that is confidently wrong -- so those
 * are what these check hardest.
 */

describe('readAmmo', () => {
  it('reads the counter and the magazine size', () => {
    expect(readAmmo('27', '30')).toEqual({ value: 27, max: 30 });
  });

  it('ignores the decoration around the numbers', () => {
    expect(readAmmo(' 27 ', '/ 30')).toEqual({ value: 27, max: 30 });
  });

  it('is null when the thing in hand has no ammo count', () => {
    expect(readAmmo('', '30')).toBeNull();
    expect(readAmmo(null, null)).toBeNull();
  });

  it('keeps a reading with no magazine size, as size 0', () => {
    expect(readAmmo('12', undefined)).toEqual({ value: 12, max: 0 });
  });
});

describe('shotsBetween', () => {
  const at = (value: number, max = 30) => ({ value, max });

  it('counts a shot', () => {
    expect(shotsBetween(at(30), at(29))).toBe(1);
  });

  it('counts a burst that lands between two looks', () => {
    expect(shotsBetween(at(30), at(27))).toBe(3);
  });

  it('counts nothing for the first reading', () => {
    expect(shotsBetween(null, at(30))).toBe(0);
  });

  it('counts nothing for a reload', () => {
    expect(shotsBetween(at(3), at(30))).toBe(0);
  });

  it('counts nothing for a swap to a weapon with a different magazine', () => {
    // 30 down to 6 is not 24 shots.
    expect(shotsBetween(at(30, 30), at(6, 6))).toBe(0);
  });

  it('counts nothing for a drop too large to be gunfire', () => {
    // A swap between two guns that share a magazine size.
    expect(shotsBetween(at(30), at(12))).toBe(0);
  });

  it('counts nothing when either side has no ammo count', () => {
    expect(shotsBetween(at(30), null)).toBe(0);
    expect(shotsBetween(null, null)).toBe(0);
  });
});

describe('withShots / withHit', () => {
  const fire = (s: AccuracyState, now: number, count = 1) => withShots(s, count, now);

  it('credits a hit to a shot', () => {
    const s = withHit(fire(EMPTY_ACCURACY, 0), 10);
    expect([s.shots, s.landed]).toEqual([1, 1]);
  });

  it('leaves a miss as a miss', () => {
    const s = fire(fire(EMPTY_ACCURACY, 0), 200);
    expect([s.shots, s.landed]).toEqual([2, 0]);
  });

  it('counts a shotgun shell once however many pellets hit', () => {
    let s = fire(EMPTY_ACCURACY, 0);
    for (let pellet = 0; pellet < 8; pellet++) s = withHit(s, 5 + pellet);
    expect([s.shots, s.landed]).toEqual([1, 1]);
  });

  it('counts a headshot once, though it plays two sounds', () => {
    let s = fire(fire(EMPTY_ACCURACY, 0), 100);
    s = withHit(s, 150); // hit_0
    s = withHit(s, 150); // headshot_0, same frame
    expect(s.landed).toBe(1);
  });

  it('does not merge two genuinely separate hits', () => {
    let s = fire(fire(EMPTY_ACCURACY, 0), 100);
    s = withHit(s, 10);
    s = withHit(s, 10 + HIT_MERGE_MS + 60);
    expect(s.landed).toBe(2);
  });

  it('credits nothing for a hit with no shot waiting, like a knife', () => {
    const s = withHit(EMPTY_ACCURACY, 500);
    expect([s.shots, s.landed]).toEqual([0, 0]);
  });

  it('does not credit a hit to a shot that is too old to have caused it', () => {
    const s = withHit(fire(EMPTY_ACCURACY, 0), HIT_WINDOW_MS + 1);
    expect(s.landed).toBe(0);
  });

  it('lets a slow projectile land inside the window', () => {
    const s = withHit(fire(EMPTY_ACCURACY, 0), HIT_WINDOW_MS - 1);
    expect(s.landed).toBe(1);
  });

  it('never goes past every shot landing', () => {
    let s = fire(EMPTY_ACCURACY, 0, 3);
    for (let i = 0; i < 10; i++) s = withHit(s, 100 + i * 100);
    expect(s.landed).toBeLessThanOrEqual(s.shots);
    expect(accuracyLabel(s)).toBe('100%');
  });

  it('adding no shots changes nothing', () => {
    expect(withShots(EMPTY_ACCURACY, 0, 50)).toBe(EMPTY_ACCURACY);
  });
});

describe('accuracyLabel', () => {
  it('shows a dash before the first shot of a life', () => {
    expect(accuracyLabel(EMPTY_ACCURACY)).toBe('-');
  });

  it('rounds to a whole percentage', () => {
    let s = fire3();
    s = withHit(s, 10);
    expect(accuracyLabel(s)).toBe('33%');
  });

  function fire3(): AccuracyState {
    return withShots(EMPTY_ACCURACY, 3, 0);
  }
});

describe('tally: match and life', () => {
  const counts = (s: AccuracyState) => [s.shots, s.landed];

  /** Two shots, the first of them landing. */
  function halfALife(t: AccuracyTally, at: number): AccuracyTally {
    return tallyShots(tallyHit(tallyShots(t, 1, at), at + 10), 1, at + 200);
  }

  it('counts a shot and a hit into both', () => {
    const t = tallyHit(tallyShots(EMPTY_TALLY, 1, 0), 10);
    expect(counts(t.match)).toEqual([1, 1]);
    expect(counts(t.life)).toEqual([1, 1]);
  });

  it('keeps the match through a death and starts the life over', () => {
    let t = halfALife(EMPTY_TALLY, 0);
    t = tallyNewLife(t);
    t = tallyShots(t, 1, 5_000);
    expect(counts(t.match)).toEqual([3, 1]);
    expect(counts(t.life)).toEqual([1, 0]);
    expect(accuracyLabel(t.match)).toBe('33%');
    expect(accuracyLabel(lifeShown(t))).toBe('0%');
  });

  it('shows the finished life until the next one fires', () => {
    const t = tallyNewLife(halfALife(EMPTY_TALLY, 0));
    expect(accuracyLabel(lifeShown(t))).toBe('50%');
  });

  it('keeps that figure through a hit sound that belongs to no shot', () => {
    // Nothing waiting in the new life, so this credits nothing, and the life
    // line must not drop to a dash because something was heard.
    const t = tallyHit(tallyNewLife(halfALife(EMPTY_TALLY, 0)), 3_000);
    expect(accuracyLabel(lifeShown(t))).toBe('50%');
  });

  it('takes one death reported twice as one death', () => {
    // #deathCount and #deathsVal are both watched, and both move.
    const once = tallyNewLife(halfALife(EMPTY_TALLY, 0));
    expect(tallyNewLife(once)).toEqual(once);
  });

  it('keeps the last life that fired through a life that did not', () => {
    const t = tallyNewLife(tallyNewLife(halfALife(EMPTY_TALLY, 0)));
    expect(accuracyLabel(lifeShown(t))).toBe('50%');
  });

  it('credits the match with a shot that lands after the shooter died', () => {
    // A rocket in flight when you die. The life it came from is gone; the
    // match it came from is not.
    let t = tallyShots(EMPTY_TALLY, 1, 0);
    t = tallyNewLife(t);
    t = tallyHit(t, 600);
    expect(counts(t.match)).toEqual([1, 1]);
    expect(counts(t.life)).toEqual([0, 0]);
  });

  it('shows a dash on both lines before the first shot of a match', () => {
    expect(accuracyLabel(EMPTY_TALLY.match)).toBe('-');
    expect(accuracyLabel(lifeShown(EMPTY_TALLY))).toBe('-');
  });

  it('adding no shots changes nothing', () => {
    expect(tallyShots(EMPTY_TALLY, 0, 50)).toBe(EMPTY_TALLY);
  });
});
