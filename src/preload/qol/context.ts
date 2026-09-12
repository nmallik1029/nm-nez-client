import type { FeatureConfig } from '../../shared/config';

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
  readonly reload: () => void;
}

export interface TabContext {
  readonly deps: QolDeps;
  /** Draw the open tab again, from whatever the state is now. */
  readonly refresh: () => void;
  /**
   * Is this still the drawing whose output belongs on screen?
   *
   * False once the panel has been closed or another tab drawn over the top.
   * A tab that waits on IPC before it has anything to show has to ask before
   * it writes, or a slow answer lands in whatever tab is open by then.
   */
  readonly live: () => boolean;
}
