import { DEFAULT_VISUALS, MARKER_LIMITS, type CrosshairConfig } from '../../shared/visuals';
import { gameCrosshairIsOff, setGameCrosshairOff } from '../look/game-settings';
import { showToast } from '../toast';
import type { PanelView, TabContext } from './context';
import { actions, heading, hint, slider } from './controls';
import { imageDrop } from './image-drop';
import { markerControls } from './marker-controls';
import { showMarker } from './preview';
import { featureRow } from './row';
import { previewStage } from './stage';

/**
 * The crosshair maker.
 *
 * Build one out of a shape and six numbers, or drop in an image and use that.
 * Either way it goes straight into `#aimDot`, which is Krunker's own
 * crosshair element, so what you are looking at in the preview is what the
 * game will draw, at the size it will draw it.
 *
 * The image half is the reason this exists. Krunker takes a custom crosshair
 * as a URL, and a URL from Discord or an image host stops resolving sooner or
 * later, which leaves you in a match with nothing in the middle of the
 * screen. A file dropped here is stored as its own bytes and never fetched
 * again.
 */

export function crosshairEditor(): PanelView {
  return { title: 'CROSSHAIR', render };
}

function render(body: HTMLElement, ctx: TabContext): void {
  let config = ctx.deps.getVisuals().crosshair;

  const stage = previewStage();
  const draw = (): void => {
    showMarker(stage.art, config);
  };

  /**
   * Save and show.
   *
   * A number changing only has to repaint the preview, and repainting is a
   * canvas and a `src`, so the slider keeps the mouse and the game updates
   * under the panel as you drag. Anything that adds or removes a control
   * asks for a full draw instead.
   */
  const commit = (next: CrosshairConfig, structural = false): void => {
    config = next;
    ctx.deps.patchVisuals({ crosshair: next });
    if (structural) ctx.refresh();
    else draw();
  };

  const gameOff = gameCrosshairIsOff();

  body.append(
    featureRow({
      icon: 'gps_fixed',
      name: 'Use this crosshair',
      sub: 'Drawn over the game, and never fetched from anywhere.',
      on: config.on,
      onToggle: () => commit({ ...config, on: !config.on }, true),
    }),
    stage.root,
    /*
     * Krunker's own crosshair is still drawn underneath ours, so this is
     * here rather than in a paragraph of small print telling people where to
     * go and turn it off. It is the game's setting either way: this presses
     * the same switch its own settings window does.
     */
    featureRow({
      icon: 'visibility_off',
      name: "Krunker's own crosshair",
      sub: gameOff
        ? 'Off, so the only crosshair on screen is this one.'
        : 'Still on, and drawn underneath this one. Two crosshairs is usually one too many.',
      on: !gameOff,
      onToggle: () => {
        if (!setGameCrosshairOff(!gameOff)) {
          showToast('The game would not take that setting');
          return;
        }
        showToast(
          gameOff
            ? "Krunker's crosshair is back on"
            : "Krunker's crosshair is off, so only yours is drawn",
        );
        ctx.refresh();
      },
    }),
  );

  if (config.image !== '') {
    body.append(
      heading('Your image'),
      slider({
        label: 'Size',
        min: MARKER_LIMITS.imageSize.min,
        max: MARKER_LIMITS.imageSize.max,
        value: config.imageSize,
        format: (value) => `${value}px`,
        onChange: (imageSize) => commit({ ...config, imageSize }),
      }),
      actions([
        {
          label: 'Remove image',
          danger: true,
          onClick: () => commit({ ...config, image: '' }, true),
        },
      ]),
      hint('Removing it goes back to the crosshair you drew, which is still here.'),
    );
  } else {
    body.append(heading('Shape'));
    body.append(...markerControls(config.marker, (marker, structural) =>
      commit({ ...config, marker }, structural),
    ));
  }

  body.append(
    heading(config.image !== '' ? 'Replace it' : 'Or use an image'),
    imageDrop({
      label: 'Drop a crosshair image here',
      hint: 'PNG, GIF, JPEG or WebP, up to about 190KB',
      onPick: (image) => commit({ ...config, image }, true),
    }),
    actions([
      {
        label: 'Reset',
        onClick: () =>
          commit({ ...DEFAULT_VISUALS.crosshair, on: config.on }, true),
      },
    ]),
    hint(
      'This is drawn by the client, so it hides itself in the menu, while a window is open and while you are scoped. Krunker draws its own crosshair into the game rather than into the page, which is why turning that one off is a switch of its own.',
    ),
  );

  draw();
}
