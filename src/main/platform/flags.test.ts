import { describe, expect, it, vi } from 'vitest';
import {
  angleBackendsFor,
  angleSwitchValue,
  applySwitches,
  clampFrameCap,
  computeSwitches,
  FRAME_CAP_MAX,
  FRAME_CAP_MIN,
  gpuEnvironment,
  type AdvancedConfig,
  type AngleBackend,
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
    const switches = computeSwitches(perf({ frameCap: 240 }), adv(), 'win32');
    expect(named(switches, 'enable-features')).toHaveLength(1);
    expect(named(switches, 'disable-features')).toHaveLength(1);
  });

  it('never emits a duplicate switch name', () => {
    const switches = computeSwitches(perf({ frameCap: 144 }), adv(), 'win32');
    const names = switches.map((s) => s.name);
    expect(names).toHaveLength(new Set(names).size);
  });

  it('passes the clamped cap to the CustomFrameCap feature', () => {
    const switches = computeSwitches(perf({ frameCap: 144 }), adv(), 'win32');
    expect(named(switches, 'enable-features')[0]?.value).toContain('CustomFrameCap:fps/144');
  });

  it('suppresses the deeper frame queue when a cap is set', () => {
    // At queue depth >= 2 the renderer decouples from the paced draw loop and
    // the cap stops being enforced, so these two must never both be on.
    const capped = computeSwitches(perf({ frameCap: 240, higherMaxFps: true }), adv(), 'win32');
    expect(named(capped, 'enable-features')[0]?.value).not.toContain('CustomMaxPendingFrames');

    const uncapped = computeSwitches(perf({ frameCap: 0, higherMaxFps: true }), adv(), 'win32');
    expect(named(uncapped, 'enable-features')[0]?.value).toContain('CustomMaxPendingFrames:count/2');
  });

  it('omits every uncap switch when fpsUnlocked is off', () => {
    const switches = computeSwitches(perf({ fpsUnlocked: false, frameCap: 240 }), adv(), 'win32');
    expect(named(switches, 'disable-frame-rate-limit')).toHaveLength(0);
    expect(named(switches, 'disable-gpu-vsync')).toHaveLength(0);
    expect(named(switches, 'enable-features')).toHaveLength(0);
  });

  it('maps the default ANGLE backend to d3d11 on Windows', () => {
    expect(named(computeSwitches(perf(), adv({ angleBackend: 'default' }), 'win32'), 'use-angle')[0]?.value)
      .toBe('d3d11');
    expect(named(computeSwitches(perf(), adv({ angleBackend: 'gl' }), 'win32'), 'use-angle')[0]?.value)
      .toBe('gl');
  });

  it('gates the optional switch groups', () => {
    const bare = computeSwitches(perf(), adv({ removeUselessFeatures: false, perfTweaks: false }), 'win32');
    expect(named(bare, 'disable-breakpad')).toHaveLength(0);
    expect(named(bare, 'no-proxy-server')).toHaveLength(0);
    // Always-on switches survive regardless.
    expect(named(bare, 'ignore-gpu-blocklist')).toHaveLength(1);
  });

  it('keeps the Windows-only switches and features to Windows', () => {
    const win = computeSwitches(perf(), adv(), 'win32');
    expect(named(win, 'raise-timer-frequency')).toHaveLength(1);
    expect(named(win, 'disable-features')[0]?.value).toContain('CalculateNativeWinOcclusion');

    const linux = computeSwitches(perf(), adv(), 'linux');
    expect(named(linux, 'raise-timer-frequency')).toHaveLength(0);
    expect(named(linux, 'disable-features')[0]?.value).not.toContain('CalculateNativeWinOcclusion');
    expect(named(linux, 'disable-gpu-sandbox')).toHaveLength(1);
    expect(named(win, 'disable-gpu-sandbox')).toHaveLength(0);
  });

  it('keeps the uncap and the frame cap on Linux, which is what the patched build is for', () => {
    const switches = computeSwitches(perf({ frameCap: 240 }), adv(), 'linux');
    expect(named(switches, 'disable-frame-rate-limit')).toHaveLength(1);
    expect(named(switches, 'enable-features')[0]?.value).toContain('CustomFrameCap:fps/240');
    // Same single-emission rule as Windows. Linux adds switches of its own,
    // so this is where a duplicate would sneak in.
    const names = switches.map((s) => s.name);
    expect(names).toHaveLength(new Set(names).size);
  });

  it('leaves out the perf tweaks that are no-ops or risky on Linux', () => {
    const tweaks = { perfTweaks: true };
    const linux = computeSwitches(perf(), adv(tweaks), 'linux');
    const win = computeSwitches(perf(), adv(tweaks), 'win32');
    // Chromium only chooses between GPUs on Windows and macOS.
    expect(named(linux, 'force-high-performance-gpu')).toHaveLength(0);
    expect(named(win, 'force-high-performance-gpu')).toHaveLength(1);
    // Mesa's workarounds guard against hangs, with no renderer to fall back to.
    expect(named(linux, 'disable-gpu-driver-bug-workarounds')).toHaveLength(0);
    expect(named(win, 'disable-gpu-driver-bug-workarounds')).toHaveLength(1);
    // The rest of the group still applies.
    expect(named(linux, 'enable-gpu-rasterization')).toHaveLength(1);
  });

  it('leaves ANGLE to Chromium on Linux unless asked for a backend Linux has', () => {
    const angle = (backend: AngleBackend) =>
      named(computeSwitches(perf(), adv({ angleBackend: backend }), 'linux'), 'use-angle')[0]?.value;
    expect(angle('default')).toBeUndefined();
    expect(angle('gl')).toBe('gl');
    expect(angle('vulkan')).toBe('vulkan');
    // A config carried over from Windows must not reach a Linux GPU process.
    expect(angle('d3d11')).toBeUndefined();
    expect(angle('d3d11on12')).toBeUndefined();
  });
});

describe('angleBackendsFor', () => {
  it('offers only backends the OS has, and every one maps to a switch or the default', () => {
    for (const platform of ['win32', 'linux'] as const) {
      const offered = angleBackendsFor(platform);
      expect(offered[0]).toBe('default');
      for (const backend of offered) {
        if (backend === 'default') continue;
        expect(angleSwitchValue(backend, platform)).toBe(backend);
      }
    }
    expect(angleBackendsFor('linux')).not.toContain('d3d11');
    expect(angleBackendsFor('win32')).toContain('d3d11');
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

describe('gpuEnvironment', () => {
  it("turns NVIDIA's own vsync off on Linux, only while the uncap is on", () => {
    expect(gpuEnvironment(perf({ fpsUnlocked: true }), 'linux', {})).toEqual({ __GL_SYNC_TO_VBLANK: '0' });
    // Capped at the display, the driver's vsync is what stops tearing.
    expect(gpuEnvironment(perf({ fpsUnlocked: false }), 'linux', {})).toEqual({});
  });

  it("leaves a value the player set, and every other platform, alone", () => {
    expect(gpuEnvironment(perf(), 'linux', { __GL_SYNC_TO_VBLANK: '1' })).toEqual({});
    expect(gpuEnvironment(perf(), 'win32', {})).toEqual({});
  });
});
