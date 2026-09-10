import { describe, expect, it } from 'vitest';
import {
  enemiesFromScoreJump,
  HARDPOINT_MAX_ENEMIES,
  HARDPOINT_POINTS_PER_ENEMY,
} from './hardpoint-counter';

/**
 * The counter is guesswork over a scoreboard, so the arithmetic is the part
 * worth pinning down. Getting into a ranked hardpoint match to check the rest
 * by hand is not something a test run can do.
 */
describe('enemiesFromScoreJump', () => {
  it('divides the score jump by the per-enemy rate', () => {
    expect(enemiesFromScoreJump(10)).toBe(1);
    expect(enemiesFromScoreJump(30)).toBe(3);
    expect(enemiesFromScoreJump(HARDPOINT_POINTS_PER_ENEMY * 5)).toBe(5);
  });

  it('reads a still score as nothing to report rather than zero enemies', () => {
    // Null and 0 are different: 0 would overwrite a live reading, null leaves
    // it standing until the stale timer clears it.
    expect(enemiesFromScoreJump(0)).toBeNull();
  });

  it('ignores a score going backwards', () => {
    // A round reset. Negative players do not exist.
    expect(enemiesFromScoreJump(-40)).toBeNull();
  });

  it('ignores a jump that is not a whole number of players', () => {
    // Capture bonuses and end-of-round awards land in the same score and do
    // not divide by ten.
    expect(enemiesFromScoreJump(25)).toBeNull();
    expect(enemiesFromScoreJump(7)).toBeNull();
  });

  it('ignores a jump too large to be people on a point', () => {
    const tooMany = (HARDPOINT_MAX_ENEMIES + 1) * HARDPOINT_POINTS_PER_ENEMY;
    expect(enemiesFromScoreJump(tooMany)).toBeNull();
    // The classic case: a baseline that went stale while the tab was hidden,
    // so one "tick" carries a whole match's worth of scoring.
    expect(enemiesFromScoreJump(4000)).toBeNull();
  });

  it('accepts a full team on the point', () => {
    const full = HARDPOINT_MAX_ENEMIES * HARDPOINT_POINTS_PER_ENEMY;
    expect(enemiesFromScoreJump(full)).toBe(HARDPOINT_MAX_ENEMIES);
  });

  it('rejects values that are not real numbers', () => {
    // parseInt on an empty or reworded score element gives NaN.
    expect(enemiesFromScoreJump(Number.NaN)).toBeNull();
    expect(enemiesFromScoreJump(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
