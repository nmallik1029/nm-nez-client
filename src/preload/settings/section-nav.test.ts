import { describe, expect, it } from 'vitest';
import { activeIndex } from './section-nav';

/**
 * The scroll-spy. `sectionLabel` is not here because it works on a real
 * Element and the suite runs under `environment: 'node'`; stubbing enough of
 * the DOM to exercise `cloneNode` and `querySelectorAll` would test the stub.
 *
 * This is the part that goes wrong quietly. Highlighting the wrong entry
 * doesn't throw, doesn't fail a build, and reads as the nav being broken.
 */
describe('activeIndex', () => {
  const tops = [0, 400, 900, 1500];

  it('has nothing active with no sections', () => {
    expect(activeIndex([], 0)).toBe(-1);
    expect(activeIndex([], 999)).toBe(-1);
  });

  it('starts on the first section', () => {
    expect(activeIndex(tops, 0)).toBe(0);
  });

  it('stays on a section while scrolling through it', () => {
    expect(activeIndex(tops, 100)).toBe(0);
    expect(activeIndex(tops, 375)).toBe(0);
    expect(activeIndex(tops, 500)).toBe(1);
    // 876 is where the next one takes over, 24px early. See the lookahead test.
    expect(activeIndex(tops, 875)).toBe(1);
  });

  it('advances as each header reaches the reading line', () => {
    expect(activeIndex(tops, 400)).toBe(1);
    expect(activeIndex(tops, 900)).toBe(2);
    expect(activeIndex(tops, 1500)).toBe(3);
  });

  /**
   * Smooth scrolling lands a pixel or two short, and `scrollTo` is given
   * `top - 8` so a jumped-to header is not flush against the edge. Without
   * the lookahead the entry you just clicked would not light up.
   */
  it('counts a section as reached slightly before its exact top', () => {
    expect(activeIndex(tops, 400 - 8)).toBe(1);
    expect(activeIndex(tops, 400 - 24)).toBe(1);
    expect(activeIndex(tops, 400 - 25)).toBe(0);
  });

  it('holds the last section past the end of the scroll range', () => {
    expect(activeIndex(tops, 4000)).toBe(3);
  });

  it('never goes negative above the first section', () => {
    // Overscroll on a trackpad reports a negative scrollTop.
    expect(activeIndex(tops, -50)).toBe(0);
  });

  it('handles a single section', () => {
    expect(activeIndex([0], 0)).toBe(0);
    expect(activeIndex([0], 2000)).toBe(0);
  });

  it('picks the last of several sections sharing an offset', () => {
    // An empty section between two headers gives them the same top. Either
    // answer is defensible; this pins which one so it can't drift.
    expect(activeIndex([0, 300, 300, 700], 300)).toBe(2);
  });
});
