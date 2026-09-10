import { describe, expect, it } from 'vitest';
import { dominant, isPresetLabel } from './presets';

/**
 * The two pure halves of finding Krunker's preset row.
 *
 * Worth testing precisely because the DOM half is a guess about markup we do
 * not own: the guess is only safe while the label match is tight and the
 * "which parent" answer is the obvious one. Loosen either and the feature
 * starts hiding parts of a settings window on someone else's machine.
 */

describe('isPresetLabel', () => {
  it('matches the four tiles', () => {
    expect(isPresetLabel('Default')).toBe(true);
    expect(isPresetLabel('Pro')).toBe(true);
    expect(isPresetLabel('Performance')).toBe(true);
    expect(isPresetLabel('Custom')).toBe(true);
  });

  it('ignores case and surrounding whitespace', () => {
    expect(isPresetLabel('  DEFAULT  ')).toBe(true);
    expect(isPresetLabel('\n  pro\t')).toBe(true);
  });

  it('collapses runs of whitespace rather than failing on them', () => {
    expect(isPresetLabel('Perfor mance')).toBe(false);
    expect(isPresetLabel(' Performance ')).toBe(true);
  });

  /**
   * The client's own settings tab has a "Performance" category, and Krunker's
   * rows include words like "Custom". Only an element whose ENTIRE label is a
   * preset name counts, or the search would drag half the panel in.
   */
  it('does not match a label that merely contains a preset name', () => {
    expect(isPresetLabel('Performance')).toBe(true);
    expect(isPresetLabel('Performance Settings')).toBe(false);
    expect(isPresetLabel('Custom Games')).toBe(false);
    expect(isPresetLabel('Default Loadout')).toBe(false);
    expect(isPresetLabel('Pro Tips')).toBe(false);
  });

  it('does not match empty or unrelated text', () => {
    expect(isPresetLabel('')).toBe(false);
    expect(isPresetLabel('   ')).toBe(false);
    expect(isPresetLabel('Render')).toBe(false);
  });
});

describe('dominant', () => {
  it('has no answer for an empty list', () => {
    expect(dominant([])).toBeNull();
  });

  it('finds the most common value with its count', () => {
    expect(dominant(['a', 'b', 'a', 'a'])).toEqual({ value: 'a', count: 3 });
  });

  it('counts a single value once', () => {
    expect(dominant(['only'])).toEqual({ value: 'only', count: 1 });
  });

  /**
   * Ties go to whichever was seen first. For elements collected in document
   * order that is the topmost container, which is the one to hide when the
   * markup nests two candidates.
   */
  it('breaks ties towards the first seen', () => {
    expect(dominant(['first', 'second', 'first', 'second'])).toEqual({
      value: 'first',
      count: 2,
    });
  });

  it('works on object identity, not equality', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    const same = { id: 'a' };
    // `same` looks like `a` but is a different element; counting them together
    // would be how two separate rows get mistaken for one.
    expect(dominant([a, b, same, a])).toEqual({ value: a, count: 2 });
  });

  it('reports a count below the caller floor rather than deciding for it', () => {
    // hidePresetTiles requires three. dominant just answers honestly.
    const result = dominant(['x', 'x']);
    expect(result).toEqual({ value: 'x', count: 2 });
  });
});
