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
 * Which is also why this is the one editor with a reload button on it.
 * Everything else in this panel lands on the frame you change it; a sky is
 * built once when the map loads, so a new colour is waiting for the next map
 * either way. Saying so beats a colour picker that appears to do nothing.
 *
 * `pending` is module-level so it survives the panel closing: you change the
 * colour, close the panel to look at the sky, and it has not changed. The
 * reason should still be there when you come back.
 */

let pending = false;

export function skyEditor(): PanelView {
  return { title: 'SKY COLOUR', render };
}

function render(body: HTMLElement, ctx: TabContext): void {
  const config = ctx.deps.getVisuals().sky;

  const commit = (next: SkyConfig, redraw: boolean): void => {
    ctx.deps.patchVisuals({ sky: next });
    pending = true;
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

  if (pending) {
    body.append(
      pendingStrip('The sky is built when a map loads, so this lands on the next one.', () => {
        pending = false;
        ctx.deps.reload();
      }),
    );
  }

  body.append(
    hint(
      'Most maps paint a textured dome over the top of their sky colour, so turning this on takes the dome off as well. Fog, lighting and shadows are left exactly as the map made them.',
    ),
  );
}
