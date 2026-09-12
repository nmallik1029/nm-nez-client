import { SKY_PRESETS, type SkyConfig } from '../../shared/visuals';
import type { PanelView, TabContext } from './context';
import { colorRow, hint } from './controls';
import { featureRow, pendingStrip } from './row';

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

  const swatch = document.createElement('div');
  swatch.className = 'sky';
  swatch.style.background = config.color;

  body.append(
    featureRow({
      icon: 'wb_sunny',
      name: 'Paint the sky',
      sub: "Off leaves every map's own sky alone.",
      on: config.on,
      onToggle: () => commit({ ...config, on: !config.on }, true),
    }),
    swatch,
    colorRow({
      label: 'Colour',
      value: config.color,
      presets: SKY_PRESETS,
      onPick: (color) => {
        swatch.style.background = color;
        commit({ ...config, color }, false);
      },
    }),
  );

  body.append(
    pendingStrip(
      'Krunker builds the sky when a map loads, so switching this on or off and changing the colour all land on the next map. Reload to see it now.',
      () => ctx.deps.reload(),
    ),
    hint(
      'Most maps paint a textured dome over the top of their sky colour, so turning this on takes the dome off as well. Fog, lighting and shadows are left exactly as the map made them.',
    ),
  );
}
