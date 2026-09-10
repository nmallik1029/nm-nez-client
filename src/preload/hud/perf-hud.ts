import type { HudCorner } from '../../shared/config';
import { FrameStats } from './frame-stats';

/**
 * Frame-time HUD.
 *
 * Two rules here. It samples every frame but only paints four times a second,
 * because a HUD reflowing text 300 times a second costs measurable frames and
 * a profiler that slows you down is worse than useless. And it never touches
 * innerHTML: every value goes through textContent, so the overlay can't turn
 * into an injection path in a page we share a world with.
 */

export interface PerfHudOptions {
  readonly corner: HudCorner;
  readonly detail: 'fps' | 'full';
}

const REPAINT_INTERVAL_MS = 250;

const CORNER_STYLES: Record<HudCorner, Partial<CSSStyleDeclaration>> = {
  'top-left': { top: '8px', left: '8px' },
  'top-right': { top: '8px', right: '8px' },
  'bottom-left': { bottom: '8px', left: '8px' },
  'bottom-right': { bottom: '8px', right: '8px' },
};

export interface PerfHud {
  setOptions(options: Partial<PerfHudOptions>): void;
  show(): void;
  hide(): void;
  toggle(): boolean;
  readonly visible: boolean;
  destroy(): void;
}

export function createPerfHud(initial: PerfHudOptions): PerfHud {
  const stats = new FrameStats(1000);

  const root = document.createElement('div');
  root.id = 'kc-perf-hud';
  Object.assign(root.style, {
    position: 'fixed',
    zIndex: '2147483000',
    padding: '5px 8px',
    borderRadius: '5px',
    background: 'rgba(10,11,13,0.72)',
    color: '#e8e9ec',
    font: '600 11px/1.45 ui-monospace, "Cascadia Mono", Consolas, monospace',
    letterSpacing: '0.02em',
    pointerEvents: 'none',
    whiteSpace: 'pre',
    display: 'none',
    // Keep the HUD out of page layout entirely. It shouldn't be able to force
    // a reflow of the game UI under it.
    contain: 'layout style paint',
  } satisfies Partial<CSSStyleDeclaration>);

  const line = document.createElement('div');
  root.appendChild(line);

  let options = initial;
  let visible = false;
  let rafId: number | null = null;
  let lastTime = 0;
  let lastPaint = 0;

  applyCorner(options.corner);

  function applyCorner(corner: HudCorner): void {
    for (const key of ['top', 'right', 'bottom', 'left'] as const) root.style[key] = '';
    Object.assign(root.style, CORNER_STYLES[corner]);
  }

  function frame(now: number): void {
    if (lastTime !== 0) stats.push(now - lastTime);
    lastTime = now;

    if (now - lastPaint >= REPAINT_INTERVAL_MS) {
      lastPaint = now;
      paint();
    }

    rafId = requestAnimationFrame(frame);
  }

  function paint(): void {
    const s = stats.snapshot();
    if (options.detail === 'fps') {
      line.textContent = `${Math.round(s.fps)} FPS`;
      return;
    }
    // Lows read 0 until the window can support the percentile, so show a dash
    // rather than a zero that isn't true.
    const low1 = s.low1 > 0 ? String(Math.round(s.low1)) : '--';
    const low01 = s.low01 > 0 ? String(Math.round(s.low01)) : '--';
    line.textContent =
      `${Math.round(s.fps)} FPS   ${s.frameTimeMs.toFixed(1)} ms\n` +
      `1%  ${low1}      0.1%  ${low01}`;
  }

  function attach(): void {
    if (!root.isConnected) document.documentElement.appendChild(root);
  }

  return {
    get visible() {
      return visible;
    },

    setOptions(next) {
      options = { ...options, ...next };
      applyCorner(options.corner);
      if (visible) paint();
    },

    show() {
      if (visible) return;
      visible = true;
      attach();
      root.style.display = 'block';
      stats.reset();
      lastTime = 0;
      lastPaint = 0;
      line.textContent = '-- FPS';
      rafId = requestAnimationFrame(frame);
    },

    hide() {
      if (!visible) return;
      visible = false;
      root.style.display = 'none';
      // Kill the rAF loop when hidden. Leaving it up wakes the renderer every
      // frame to work out numbers nobody is looking at.
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
    },

    toggle() {
      if (visible) this.hide();
      else this.show();
      return visible;
    },

    destroy() {
      this.hide();
      root.remove();
    },
  };
}
