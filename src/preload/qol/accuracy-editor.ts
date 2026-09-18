import type { AccuracyPlacement } from '../../shared/config';
import type { PanelView, TabContext } from './context';
import { chooser } from './controls';
import { featureRow } from './row';

/**
 * Live accuracy: on or off, and whether it sits top centre or bottom centre.
 *
 * Both apply as you touch them, readout on screen included, so there is
 * nothing to wait for and nothing to reload.
 */

export function accuracyEditor(): PanelView {
  return { title: 'LIVE ACCURACY', render };
}

const PLACEMENTS: readonly { readonly id: AccuracyPlacement; readonly label: string }[] = [
  { id: 'top', label: 'Top centre' },
  { id: 'bottom', label: 'Bottom centre' },
];

function render(body: HTMLElement, ctx: TabContext): void {
  const features = ctx.deps.getFeatures();
  body.append(
    featureRow({
      icon: 'track_changes',
      name: 'Show live accuracy',
      sub: 'How many of your shots have landed, side by side for the match so far, which starts over with a new match, and for this life, which starts over when you die.',
      on: features.accuracyCounter,
      onToggle: () => {
        ctx.deps.patchFeatures({ accuracyCounter: !ctx.deps.getFeatures().accuracyCounter });
        ctx.refresh();
      },
    }),
    chooser({
      label: 'Position',
      options: PLACEMENTS,
      value: features.accuracyPlacement,
      onPick: (id) => {
        ctx.deps.patchFeatures({ accuracyPlacement: id });
        ctx.refresh();
      },
    }),
  );
}
