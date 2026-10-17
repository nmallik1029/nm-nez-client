import { OWN_NAME_PRESETS, type OwnNameConfig } from '../../shared/visuals';
import type { PanelView, TabContext } from './context';
import { colorRow, hint } from './controls';
import { featureRow } from './row';

/**
 * Your own name's colour on the leaderboards.
 *
 * Every handler reads the setting fresh rather than closing over the copy the
 * panel was drawn with. Picking a colour does not redraw the panel, so a
 * closed-over copy would still hold the old colour, and switching bold after
 * a pick would quietly put it back.
 */

export function ownNameEditor(): PanelView {
  return { title: 'YOUR NAME COLOUR', render };
}

function render(body: HTMLElement, ctx: TabContext): void {
  const current = (): OwnNameConfig => ctx.deps.getVisuals().ownName;
  const commit = (change: Partial<OwnNameConfig>, redraw: boolean): void => {
    ctx.deps.patchVisuals({ ownName: { ...current(), ...change } });
    if (redraw) ctx.refresh();
  };
  const config = current();

  body.append(
    featureRow({
      icon: 'person',
      name: 'Colour your name',
      sub: 'Your name on the corner leaderboard, the Tab scoreboard and the end of match table.',
      on: config.on,
      onToggle: () => commit({ on: !current().on }, true),
    }),
    colorRow({
      label: 'Colour',
      value: config.color,
      presets: OWN_NAME_PRESETS,
      onPick: (color) => commit({ color }, false),
    }),
    featureRow({
      icon: 'format_bold',
      name: 'Bold',
      sub: 'Heavier as well as coloured.',
      on: config.bold,
      onToggle: () => commit({ bold: !current().bold }, true),
    }),
    hint(
      "Only you see this. It changes your copy of the boards and nobody else's. A name the client already colours keeps that colour.",
    ),
  );
}
