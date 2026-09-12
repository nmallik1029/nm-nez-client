import { SKY_PRESETS, type SkyConfig } from '../../shared/visuals';
import type { PanelView, TabContext } from './context';
import { colorRow } from './controls';
import { featureRow, pendingStrip } from './row';
import { skyStage } from './sky-stage';

/**
 * The sky colour.
 *
 * One colour, because that is genuinely all it is: Krunker builds the scene
 * from the map's JSON, and the sky is one field in it. The client answers
 * that field before the game reads it.
 *
 * Which is also why this is the one editor with a reload button on it, and
 * why the notice is always on screen rather than appearing once something has
 * been changed. A sky is built when the map loads and nothing can repaint the
 * one you are standing under, so every change here is waiting for the next
 * map: switching it on, switching it off, and picking a colour alike. Telling
 * you that only afterwards would mean the first thing anyone does with this
 * feature is watch it appear to do nothing.
 */

export function skyEditor(): PanelView {
  return { title: 'SKY COLOUR', render };
}

function render(body: HTMLElement, ctx: TabContext): void {
  const config = ctx.deps.getVisuals().sky;

  const commit = (next: SkyConfig, redraw: boolean): void => {
    ctx.deps.patchVisuals({ sky: next });
    if (redraw) ctx.refresh();
  };

  // A real map with its sky cut out of it, and the colour behind the picture.
  // Falls back to a plain block of colour when no scenes are bundled.
  const stage = skyStage(config.color);

  body.append(
    featureRow({
      icon: 'wb_sunny',
      name: 'Paint the sky',
      sub: "Off leaves every map's own sky alone.",
      on: config.on,
      onToggle: () => commit({ ...config, on: !config.on }, true),
    }),
    stage.root,
    colorRow({
      label: 'Colour',
      value: config.color,
      presets: SKY_PRESETS,
      onPick: (color) => {
        stage.setColor(color);
        commit({ ...config, color }, false);
      },
    }),
  );

  body.append(
    pendingStrip(
      'Krunker builds the sky when a map loads, so switching this on or off and changing the colour all land on the next map. Reload to see it now.',
      () => ctx.deps.reload(),
    ),
  );
}
