/**
 * Chromium command-line switches, for Windows and Linux.
 *
 * Based on Krunker Civilian Client's `src/main/platform.ts` (GPL-3.0,
 * bigjakk). The feature-set accumulation fix, a good few of the switch choices
 * and the Linux GPU-process switches come from there. Reshaped into a pure
 * function that returns a list, so it can be tested without booting Electron;
 * the original applies them as a side effect and there's no way to get at that
 * from a test.
 *
 * One Linux switch is missing on purpose: `--ozone-platform=x11`. Chromium
 * picks its display backend in early C++ startup, before any of this runs, so
 * appending it here is silently ignored. It goes on the real command line
 * instead, from the launcher that scripts/after-pack.mjs puts in the package
 * and from scripts/start.mjs for `npm start`.
 */

import type { AdvancedConfig, AngleBackend, PerformanceConfig } from '../../shared/config';

export type { AdvancedConfig, AngleBackend, PerformanceConfig } from '../../shared/config';
export { angleBackendsFor } from '../../shared/config';

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
  platform: NodeJS.Platform,
): CommandSwitch[] {
  const isWindows = platform === 'win32';
  const isLinux = platform === 'linux';
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
  const angle = angleSwitchValue(advanced.angleBackend, platform);
  if (angle !== null) add('use-angle', angle);

  if (isWindows) {
    disabledFeatures.add('CalculateNativeWinOcclusion');
    disabledFeatures.add('HardwareMediaKeyHandling');
  }

  if (isLinux) {
    // The GPU sandbox fails outright inside an AppImage's FUSE mount and on
    // some Mesa versions, and a GPU process that can't start is a black
    // window. The renderer sandbox, the one between page script and the
    // machine, is untouched by this.
    add('disable-gpu-sandbox');
    // NVIDIA's proprietary driver has no VA-API. Probing libva for it logs
    // vaInitialize failures and can crash the GPU process while it is still
    // setting up. Krunker decodes no video that would miss hardware for it.
    add('disable-accelerated-video-decode');
    add('disable-accelerated-video-encode');
    add('disable-accelerated-mjpeg-decode');
  }

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
    // Not on Linux. Chromium's Linux workarounds are for Mesa and NVIDIA bugs
    // that hang or corrupt (gpu_driver_bug_list.json has "Mesa hangs the
    // system when allocating large textures"), and there is no other
    // renderer to fall back to when one bites.
    if (!isLinux) add('disable-gpu-driver-bug-workarounds');
    add('disable-software-rasterizer');
    // Chromium only chooses between GPUs on Windows and macOS (gpu_init.cc).
    // On Linux the dedicated GPU is the desktop entry's PrefersNonDefaultGPU.
    if (!isLinux) add('force-high-performance-gpu');
    // The 1ms Windows timer. There is no equivalent to ask for elsewhere.
    if (isWindows) add('raise-timer-frequency');
    add('disable-best-effort-tasks');
    // Skips proxy resolution outright, which does break proxied setups.
    add('no-proxy-server');
  }

  // ── Single emission of the accumulated feature sets ──
  if (enabledFeatures.size > 0) add('enable-features', [...enabledFeatures].join(','));
  if (disabledFeatures.size > 0) add('disable-features', [...disabledFeatures].join(','));

  return switches;
}

/**
 * The `--use-angle` value for a configured backend, or null to leave Chromium
 * its own choice.
 *
 * Windows pins D3D11 for "default", as it always has. On Linux Chromium's own
 * default is already OpenGL, so there is nothing to pin, and a Direct3D value
 * (a config carried over from Windows, say) is dropped rather than handed to a
 * GPU process that has no idea what it means.
 */
export function angleSwitchValue(backend: AngleBackend, platform: NodeJS.Platform): string | null {
  if (platform === 'linux') {
    return backend === 'gl' || backend === 'vulkan' ? backend : null;
  }
  return backend === 'default' ? 'd3d11' : backend;
}

/**
 * Environment the GPU process needs, which a switch can't set. Set on
 * `process.env` at module load, before Chromium starts the GPU process, which
 * inherits it.
 *
 * Linux only: NVIDIA's driver keeps its own vsync (`__GL_SYNC_TO_VBLANK`) that
 * the uncap's --disable-gpu-vsync may not reach. It is turned off only while
 * the uncap is on. The launcher used to turn it off always, which left the
 * default 60 fps with nothing holding it to the display: tearing, for nothing.
 * A value already in the environment is the player's and wins.
 */
export function gpuEnvironment(
  performance: PerformanceConfig,
  platform: NodeJS.Platform,
  env: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  if (platform !== 'linux' || !performance.fpsUnlocked) return {};
  if (env['__GL_SYNC_TO_VBLANK'] !== undefined) return {};
  return { __GL_SYNC_TO_VBLANK: '0' };
}

/** Apply a computed switch list to Electron's command line. */
export function applySwitches(commandLine: CommandLineLike, switches: readonly CommandSwitch[]): void {
  for (const s of switches) {
    if (s.value === undefined) commandLine.appendSwitch(s.name);
    else commandLine.appendSwitch(s.name, s.value);
  }
}
