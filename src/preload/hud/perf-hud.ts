import type { HudCorner } from '../../shared/config';
import { SHEETS, STYLE_IDS, UI_IDS } from '../../shared/ui';
import { defineStyle } from '../style';
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

const ID = UI_IDS.perfHud;

const CORNER_CLASSES: Record<HudCorner, string> = {
  'top-left': 'kc-hud-top-left',
  'top-right': 'kc-hud-top-right',
  'bottom-left': 'kc-hud-bottom-left',
  'bottom-right': 'kc-hud-bottom-right',
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

  defineStyle(STYLE_IDS.perfHud, SHEETS.perfHud);

  const root = document.createElement('div');
  root.id = ID;

  const line = document.createElement('div');
  root.appendChild(line);

  let options = initial;
  let visible = false;
  let rafId: number | null = null;
  let lastTime = 0;
  let lastPaint = 0;

  applyCorner(options.corner);

  function applyCorner(corner: HudCorner): void {
    root.classList.remove(...Object.values(CORNER_CLASSES));
    root.classList.add(CORNER_CLASSES[corner]);
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
      root.classList.add('kc-hud-on');
      stats.reset();
      lastTime = 0;
      lastPaint = 0;
      line.textContent = '-- FPS';
      rafId = requestAnimationFrame(frame);
    },

    hide() {
      if (!visible) return;
      visible = false;
      root.classList.remove('kc-hud-on');
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
