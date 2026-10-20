import { describe, expect, it } from 'vitest';
import { HIT_SOUNDS } from './game-sound';

/**
 * Which of the game's sounds mean a shot of yours landed. Live accuracy and
 * the hitmarker both count off this set, so a name wrongly in it or out of it
 * is a wrong figure on screen.
 */
describe('HIT_SOUNDS', () => {
  it('hears a hit to the body and a hit to the head', () => {
    expect(HIT_SOUNDS.has('hit_0')).toBe(true);
    // Played in place of hit_0, so without it no headshot that failed to
    // kill was ever counted.
    expect(HIT_SOUNDS.has('crit_0')).toBe(true);
  });

  it('does not take a kill sound or a power-up for a hit', () => {
    expect(HIT_SOUNDS.has('headshot_0')).toBe(false);
    expect(HIT_SOUNDS.has('instantkill_0')).toBe(false);
  });
});
