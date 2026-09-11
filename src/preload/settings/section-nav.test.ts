import { describe, expect, it } from 'vitest';
import { sectionRanges } from './section-nav';

/**
 * The index shows one section at a time, so the only arithmetic left is
 * working out which of the holder's children belong to which section.
 *
 * The scroll-position helpers this file used to cover, `activeIndex` and
 * `isAtEnd`, are gone with the scrolling version of the index. They existed
 * to answer "which section am I looking at" while everything shared one long
 * column, and nothing asks that any more.
 */
describe('sectionRanges', () => {
  const H = true;
  const R = false;

  it('finds nothing in an empty list', () => {
    expect(sectionRanges([])).toEqual([]);
  });

  it('finds nothing when there are no headers', () => {
    expect(sectionRanges([R, R, R])).toEqual([]);
  });

  it('takes a header and the rows under it', () => {
    expect(sectionRanges([H, R, R])).toEqual([{ start: 0, end: 3 }]);
  });

  it('ends a section where the next header starts', () => {
    expect(sectionRanges([H, R, H, R, R])).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 5 },
    ]);
  });

  it('handles a header with no rows of its own', () => {
    expect(sectionRanges([H, H, R])).toEqual([
      { start: 0, end: 1 },
      { start: 1, end: 3 },
    ]);
  });

  it('leaves anything before the first header out', () => {
    // Krunker puts its own preamble above the first section, and hiding that
    // along with a section would take the tab strip with it.
    expect(sectionRanges([R, R, H, R])).toEqual([{ start: 2, end: 4 }]);
  });

  it('covers every child once the first header is reached', () => {
    const flags = [R, H, R, R, H, R];
    const ranges = sectionRanges(flags);
    expect(ranges[0]?.start).toBe(1);
    expect(ranges[ranges.length - 1]?.end).toBe(flags.length);
    // No gaps and no overlaps between consecutive sections.
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i]?.start).toBe(ranges[i - 1]?.end);
    }
  });

  it('handles a trailing header with nothing after it', () => {
    expect(sectionRanges([H, R, H])).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 3 },
    ]);
  });

  it('handles a single header on its own', () => {
    expect(sectionRanges([H])).toEqual([{ start: 0, end: 1 }]);
  });
});
