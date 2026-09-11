import { afterEach, describe, expect, it, vi } from 'vitest';
import { coalesced } from './schedule';

/**
 * The environment is `node`, so there is no real `requestAnimationFrame`. The
 * stub keeps the queued callbacks and runs them on demand, which is what makes
 * "did the burst collapse" observable at all — with a real rAF the test would
 * only be able to assert timing.
 */
function stubFrames(): { flush: () => void; queued: () => number } {
  const queue: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    queue.push(cb);
    return queue.length;
  });
  return {
    flush: () => {
      const pending = queue.splice(0, queue.length);
      for (const cb of pending) cb(0);
    },
    queued: () => queue.length,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('coalesced', () => {
  it('does not run the work before the frame arrives', () => {
    stubFrames();
    const run = vi.fn();
    coalesced(run)();
    expect(run).not.toHaveBeenCalled();
  });

  it('runs a single call once', () => {
    const frames = stubFrames();
    const run = vi.fn();
    coalesced(run)();
    frames.flush();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('collapses a burst into one pass', () => {
    const frames = stubFrames();
    const run = vi.fn();
    const schedule = coalesced(run);
    // A match produces bursts this size between paints.
    for (let i = 0; i < 50; i++) schedule();
    expect(frames.queued()).toBe(1);
    frames.flush();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('schedules again after the frame has run', () => {
    const frames = stubFrames();
    const run = vi.fn();
    const schedule = coalesced(run);

    schedule();
    frames.flush();
    schedule();
    frames.flush();

    expect(run).toHaveBeenCalledTimes(2);
  });

  it('re-arms from inside the callback rather than dropping the call', () => {
    // A handler that mutates the DOM can trigger the observer that scheduled
    // it. That re-entrant call has to land on the next frame, not vanish.
    const frames = stubFrames();
    const run = vi.fn(() => {
      if (run.mock.calls.length === 1) schedule();
    });
    const schedule = coalesced(run);

    schedule();
    frames.flush();
    expect(run).toHaveBeenCalledTimes(1);

    frames.flush();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('keeps separate schedulers independent', () => {
    const frames = stubFrames();
    const a = vi.fn();
    const b = vi.fn();
    const scheduleA = coalesced(a);
    const scheduleB = coalesced(b);

    scheduleA();
    scheduleA();
    scheduleB();
    expect(frames.queued()).toBe(2);

    frames.flush();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
