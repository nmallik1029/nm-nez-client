import type { FeatureConfig } from '../../shared/config';
import type { VisualsConfig } from '../../shared/visuals';

/**
 * What a QoL tab is handed.
 *
 * Its own module so the panel and the tabs it renders do not import each
 * other. The types would be erased at build time either way, but a cycle in
 * the import graph is still a cycle to reason about the day one of these
 * grows a value export.
 */

export interface QolDeps {
  /**
   * The preload's live features mirror, not a copy. Read at the moment a row
   * is drawn, so a switch shows what is actually set rather than what was
   * set when the panel opened.
   */
  readonly getFeatures: () => FeatureConfig;
  /** Write a change and mirror it, the same way the settings tab does. */
  readonly patchFeatures: (partial: Partial<FeatureConfig>) => void;
  /** The crosshair, hitmarker and sky, same deal. */
  readonly getVisuals: () => VisualsConfig;
  /**
   * Write one of them back.
   *
   * Applies to the page immediately and saves a moment later: the editors
   * call this on every drag of a slider, and each call is an IPC round trip
   * and a disk write if it is not held back.
   */
  readonly patchVisuals: (partial: Partial<VisualsConfig>) => void;
  readonly reload: () => void;
}

/**
 * An editor, drawn over the tab that opened it.
 *
 * A view rather than a second modal: these belong to the row you pressed, and
 * a window over a window over the game is three backdrops deep before anyone
 * has changed anything. The panel swaps its tab strip for a back arrow while
 * one is up.
 */
export interface PanelView {
  /** Shown in the panel header, in place of QOL FEATURES. */
  readonly title: string;
  readonly render: (body: HTMLElement, ctx: TabContext) => void;
}

export interface TabContext {
  readonly deps: QolDeps;
  /** Draw the open tab, or editor, again from whatever the state is now. */
  readonly refresh: () => void;
  /**
   * Is this still the drawing whose output belongs on screen?
   *
   * False once the panel has been closed or another tab drawn over the top.
   * A tab that waits on IPC before it has anything to show has to ask before
   * it writes, or a slow answer lands in whatever tab is open by then.
   */
  readonly live: () => boolean;
  /** Open an editor over the top of this tab. */
  readonly push: (view: PanelView) => void;
}
