import { OWN_ALIAS_MAX, type OwnNameConfig } from '../../shared/visuals';
import { colorWheel } from './color-wheel';
import type { PanelView, TabContext } from './context';
import { heading, hint, textRow } from './controls';
import { featureRow } from './row';

/**
 * Your own name on the leaderboards: its colour, and what it says.
 *
 * The two are independent. The switch is the colour's; the name is off when
 * it is empty, so you can have either without the other.
 *
 * Every handler reads the setting fresh rather than closing over the copy the
 * panel was drawn with. Picking a colour does not redraw the panel, so a
 * closed-over copy would still hold the old colour, and switching bold after
 * a pick would quietly put it back.
 */

export function ownNameEditor(): PanelView {
  return { title: 'YOUR NAME', render };
}

function render(body: HTMLElement, ctx: TabContext): void {
  const current = (): OwnNameConfig => ctx.deps.getVisuals().ownName;
  const commit = (change: Partial<OwnNameConfig>, redraw: boolean): void => {
    ctx.deps.patchVisuals({ ownName: { ...current(), ...change } });
    if (redraw) ctx.refresh();
  };
  const config = current();

  body.append(
    heading('Colour'),
    featureRow({
      icon: 'person',
      name: 'Colour your name',
      sub: 'Your name on the corner leaderboard, the Tab scoreboard and the end of match table.',
      on: config.on,
      onToggle: () => commit({ on: !current().on }, true),
    }),
    colorWheel({
      label: 'Colour',
      value: config.color,
      onPick: (color) => commit({ color }, false),
    }),
    featureRow({
      icon: 'format_bold',
      name: 'Bold',
      sub: 'Heavier as well as coloured.',
      on: config.bold,
      onToggle: () => commit({ bold: !current().bold }, true),
    }),
    hint('A name the client already colours keeps that colour.'),
    heading('Name'),
    textRow({
      label: 'Show as',
      value: config.alias,
      placeholder: 'Your real name',
      maxLength: OWN_ALIAS_MAX,
      onChange: (alias) => commit({ alias }, false),
    }),
    hint(
      "Empty shows your real name. Only you see either of these: they change your copy of the boards and nobody else's. Chat and the kill feed keep your real name.",
    ),
  );
}
