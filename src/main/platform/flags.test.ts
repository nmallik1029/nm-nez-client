import { describe, expect, it, vi } from 'vitest';
import {
  applySwitches,
  clampFrameCap,
  computeSwitches,
  FRAME_CAP_MAX,
  FRAME_CAP_MIN,
  type AdvancedConfig,
  type PerformanceConfig,
} from './flags';

const perf = (over: Partial<PerformanceConfig> = {}): PerformanceConfig => ({
  fpsUnlocked: true,
  frameCap: 0,
  higherMaxFps: false,
  ...over,
});

const adv = (over: Partial<AdvancedConfig> = {}): AdvancedConfig => ({
  angleBackend: 'default',
  removeUselessFeatures: true,
  perfTweaks: true,
  ...over,
});

const named = (switches: readonly { name: string; value?: string }[], name: string) =>
  switches.filter((s) => s.name === name);

describe('clampFrameCap', () => {
  it('treats zero and junk as uncapped', () => {
    expect(clampFrameCap(0)).toBe(0);
    expect(clampFrameCap(undefined)).toBe(0);
    expect(clampFrameCap(null)).toBe(0);
    expect(clampFrameCap('nonsense')).toBe(0);
    expect(clampFrameCap(-500)).toBe(0);
  });

  it('clamps into the supported range', () => {
    expect(clampFrameCap(1)).toBe(FRAME_CAP_MIN);
    expect(clampFrameCap(99999)).toBe(FRAME_CAP_MAX);
    expect(clampFrameCap(240)).toBe(240);
  });

  it('rounds fractional input', () => {
    expect(clampFrameCap(143.6)).toBe(144);
  });
});

describe('computeSwitches', () => {
  // This is the bug the whole module is shaped around: Chromium's CommandLine
  // keeps one value per switch name, so a second `enable-features` silently
  // discards the first. If this test fails, features are being lost at runtime
  // with no error anywhere.
  it('emits at most one enable-features and one disable-features switch', () => {
    const switches = computeSwitches(perf({ frameCap: 240 }), adv());
    expect(named(switches, 'enable-features')).toHaveLength(1);
    expect(named(switches, 'disable-features')).toHaveLength(1);
  });

  it('never emits a duplicate switch name', () => {
    const switches = computeSwitches(perf({ frameCap: 144 }), adv());
    const names = switches.map((s) => s.name);
    expect(names).toHaveLength(new Set(names).size);
  });

  it('passes the clamped cap to the CustomFrameCap feature', () => {
    const switches = computeSwitches(perf({ frameCap: 144 }), adv());
    expect(named(switches, 'enable-features')[0]?.value).toContain('CustomFrameCap:fps/144');
  });

  it('suppresses the deeper frame queue when a cap is set', () => {
    // At queue depth >= 2 the renderer decouples from the paced draw loop and
    // the cap stops being enforced, so these two must never both be on.
    const capped = computeSwitches(perf({ frameCap: 240, higherMaxFps: true }), adv());
    expect(named(capped, 'enable-features')[0]?.value).not.toContain('CustomMaxPendingFrames');

    const uncapped = computeSwitches(perf({ frameCap: 0, higherMaxFps: true }), adv());
    expect(named(uncapped, 'enable-features')[0]?.value).toContain('CustomMaxPendingFrames:count/2');
  });

  it('omits every uncap switch when fpsUnlocked is off', () => {
    const switches = computeSwitches(perf({ fpsUnlocked: false, frameCap: 240 }), adv());
    expect(named(switches, 'disable-frame-rate-limit')).toHaveLength(0);
    expect(named(switches, 'disable-gpu-vsync')).toHaveLength(0);
    expect(named(switches, 'enable-features')).toHaveLength(0);
  });

  it('maps the default ANGLE backend to d3d11 on Windows', () => {
    expect(named(computeSwitches(perf(), adv({ angleBackend: 'default' })), 'use-angle')[0]?.value)
      .toBe('d3d11');
    expect(named(computeSwitches(perf(), adv({ angleBackend: 'gl' })), 'use-angle')[0]?.value)
      .toBe('gl');
  });

  it('gates the optional switch groups', () => {
    const bare = computeSwitches(perf(), adv({ removeUselessFeatures: false, perfTweaks: false }));
    expect(named(bare, 'disable-breakpad')).toHaveLength(0);
    expect(named(bare, 'no-proxy-server')).toHaveLength(0);
    // Always-on switches survive regardless.
    expect(named(bare, 'ignore-gpu-blocklist')).toHaveLength(1);
  });
});

describe('applySwitches', () => {
  it('forwards valued and valueless switches differently', () => {
    const appendSwitch = vi.fn();
    applySwitches({ appendSwitch }, [{ name: 'solo' }, { name: 'pair', value: 'x' }]);
    expect(appendSwitch).toHaveBeenNthCalledWith(1, 'solo');
    expect(appendSwitch).toHaveBeenNthCalledWith(2, 'pair', 'x');
  });
});
