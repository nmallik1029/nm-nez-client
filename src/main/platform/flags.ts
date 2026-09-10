/**
 * Chromium command-line switches. Windows only.
 *
 * Based on Krunker Civilian Client's `src/main/platform.ts` (GPL-3.0,
 * bigjakk). The feature-set accumulation fix and a good few of the switch
 * choices come from there. Reshaped into a pure function that returns a list,
 * so it can be tested without booting Electron; the original applies them as
 * a side effect and there's no way to get at that from a test.
 */

import type { AdvancedConfig, PerformanceConfig } from '../../shared/config';

export type { AdvancedConfig, AngleBackend, PerformanceConfig } from '../../shared/config';
export { ANGLE_BACKENDS } from '../../shared/config';

export interface CommandSwitch {
  readonly name: string;
  readonly value?: string;
}

/** Minimal view of `app.commandLine`, so callers can inject a fake in tests. */
export interface CommandLineLike {
  appendSwitch(name: string, value?: string): void;
}

export const FRAME_CAP_MIN = 30;
export const FRAME_CAP_MAX = 1000;

/** 0 is uncapped, anything else lands in 30..1000. Same clamp the binary uses. */
export function clampFrameCap(raw: unknown): number {
  const fps = Math.round(Number(raw ?? 0)) || 0;
  if (fps <= 0) return 0;
  return Math.min(FRAME_CAP_MAX, Math.max(FRAME_CAP_MIN, fps));
}

/**
 * Build the full switch list.
 *
 * Watch out for this one: Chromium's CommandLine holds a single value per
 * switch name, so calling appendSwitch('enable-features', x) twice throws the
 * first value away without saying so. Feature names go into sets and get
 * emitted once, comma-joined, at the end.
 */
export function computeSwitches(
  performance: PerformanceConfig,
  advanced: AdvancedConfig,
): CommandSwitch[] {
  const switches: CommandSwitch[] = [];
  const enabledFeatures = new Set<string>();
  const disabledFeatures = new Set<string>();

  const add = (name: string, value?: string): void => {
    switches.push(value === undefined ? { name } : { name, value });
  };

  // ── FPS uncap ──
  if (performance.fpsUnlocked) {
    add('disable-frame-rate-limit');
    add('disable-gpu-vsync');
    add('max-gum-fps', '9999');

    const frameCap = clampFrameCap(performance.frameCap);
    if (frameCap > 0) {
      // The patched Electron's CustomFrameCap reads this. It paces swap-ack
      // release per window so the cap still holds above the display refresh.
      enabledFeatures.add(`CustomFrameCap:fps/${frameCap}`);
    }
    // Depth 2 against the patched default of 1. Skipped when a cap is set: at
    // depth >= 2 the renderer comes loose from the paced draw loop and the cap
    // stops doing anything.
    if (performance.higherMaxFps && frameCap === 0) {
      enabledFeatures.add('CustomMaxPendingFrames:count/2');
    }
  }

  // ── Always on ──
  add('disable-backgrounding-occluded-windows');
  add('disable-background-timer-throttling');
  add('disable-renderer-backgrounding');
  add('autoplay-policy', 'no-user-gesture-required');
  add('overscroll-history-navigation', '0');
  add('pull-to-refresh', '0');
  // No WebGL, no Krunker, so push past any GPU blocklist.
  add('ignore-gpu-blocklist');

  // ── ANGLE backend ──
  add('use-angle', advanced.angleBackend === 'default' ? 'd3d11' : advanced.angleBackend);

  // Windows-only feature disables.
  disabledFeatures.add('CalculateNativeWinOcclusion');
  disabledFeatures.add('HardwareMediaKeyHandling');

  // ── Debloat ──
  // Only switches Electron actually has. The chrome-layer ones other clients
  // pass here (print preview, component update, metrics) aren't compiled in
  // and have never done anything.
  if (advanced.removeUselessFeatures) {
    add('disable-breakpad');
    add('disable-logging');
    add('disable-hang-monitor');
    add('disable-2d-canvas-clip-aa');
    add('no-pings');
    disabledFeatures.add('MediaRouter');
  }

  // ── Force-past-safety performance switches ──
  if (advanced.perfTweaks) {
    add('enable-gpu-rasterization');
    add('disable-gpu-driver-bug-workarounds');
    add('disable-software-rasterizer');
    add('force-high-performance-gpu');
    add('raise-timer-frequency');
    add('disable-best-effort-tasks');
    // Skips proxy resolution outright, which does break proxied setups.
    add('no-proxy-server');
  }

  // ── Single emission of the accumulated feature sets ──
  if (enabledFeatures.size > 0) add('enable-features', [...enabledFeatures].join(','));
  if (disabledFeatures.size > 0) add('disable-features', [...disabledFeatures].join(','));

  return switches;
}

/** Apply a computed switch list to Electron's command line. */
export function applySwitches(commandLine: CommandLineLike, switches: readonly CommandSwitch[]): void {
  for (const s of switches) {
    if (s.value === undefined) commandLine.appendSwitch(s.name);
    else commandLine.appendSwitch(s.name, s.value);
  }
}
