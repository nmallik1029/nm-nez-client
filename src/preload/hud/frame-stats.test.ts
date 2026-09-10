import { describe, expect, it } from 'vitest';
import { FrameStats } from './frame-stats';

const pushAll = (stats: FrameStats, deltas: number[]) => {
  for (const d of deltas) stats.push(d);
};

describe('FrameStats', () => {
  it('reports nothing before any samples arrive', () => {
    expect(new FrameStats().snapshot()).toMatchObject({ fps: 0, samples: 0 });
  });

  it('converts a steady frame time to FPS', () => {
    const stats = new FrameStats(100);
    pushAll(stats, Array<number>(100).fill(10)); // 10ms => 100fps
    const snap = stats.snapshot();
    expect(snap.fps).toBeCloseTo(100, 6);
    expect(snap.frameTimeMs).toBeCloseTo(10, 6);
  });

  it('evicts oldest samples once the window is full', () => {
    const stats = new FrameStats(4);
    pushAll(stats, [100, 100, 100, 100, 10, 10, 10, 10]);
    // The four slow frames should be gone entirely.
    expect(stats.snapshot().fps).toBeCloseTo(100, 6);
    expect(stats.snapshot().samples).toBe(4);
  });

  it('surfaces hitches in the 1% low that the average hides', () => {
    const stats = new FrameStats(1000);
    // 990 fast frames plus 10 hitches. The average barely moves; the 1% low
    // is what tells you the stream is actually stuttering.
    pushAll(stats, Array<number>(990).fill(5));
    pushAll(stats, Array<number>(10).fill(50));
    const snap = stats.snapshot();

    expect(snap.fps).toBeGreaterThan(150);
    expect(snap.low1).toBeCloseTo(20, 0); // 50ms => 20fps
    expect(snap.low1).toBeLessThan(snap.fps);
  });

  it('withholds percentile lows until the window can support them', () => {
    const stats = new FrameStats(1000);
    // 50 samples cannot express a meaningful 1% (needs >= 100) or 0.1%.
    pushAll(stats, Array<number>(50).fill(10));
    const snap = stats.snapshot();
    expect(snap.fps).toBeCloseTo(100, 6);
    expect(snap.low1).toBe(0);
    expect(snap.low01).toBe(0);
  });

  it('ignores a tab-out gap instead of poisoning the window', () => {
    const stats = new FrameStats(100);
    pushAll(stats, Array<number>(99).fill(10));
    stats.push(30_000); // 30s alt-tab
    // A single 30s sample would drag the mean to ~310ms and read as 3 FPS.
    expect(stats.snapshot().fps).toBeCloseTo(100, 6);
  });

  it('ignores non-finite and non-positive deltas', () => {
    const stats = new FrameStats(10);
    pushAll(stats, [Number.NaN, Number.POSITIVE_INFINITY, 0, -5]);
    expect(stats.snapshot().samples).toBe(0);
  });

  it('orders the lows consistently', () => {
    const stats = new FrameStats(1000);
    for (let i = 0; i < 1000; i += 1) pushAll(stats, [5 + (i % 17)]);
    const snap = stats.snapshot();
    // Worse percentile => lower FPS. If this inverts, the tail slice is
    // reading from the wrong end of the sorted window.
    expect(snap.low01).toBeLessThanOrEqual(snap.low1);
    expect(snap.low1).toBeLessThanOrEqual(snap.fps);
  });

  it('clears on reset', () => {
    const stats = new FrameStats(10);
    pushAll(stats, [10, 10, 10]);
    stats.reset();
    expect(stats.snapshot().samples).toBe(0);
  });

  it('does not allocate a growing buffer under sustained load', () => {
    const stats = new FrameStats(64);
    for (let i = 0; i < 10_000; i += 1) stats.push(8);
    expect(stats.snapshot().samples).toBe(64);
  });
});
