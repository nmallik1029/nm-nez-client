import {
  DEFAULT_VISUALS,
  MARKER_LIMITS,
  markerGeometry,
  type HitmarkerConfig,
  type MarkerSpec,
} from '../../shared/visuals';
import { gameHitmarkerIsOff, setGameHitmarkerOff } from '../look/game-settings';
import { showToast } from '../toast';
import type { PanelView, TabContext } from './context';
import { actions, heading, hint, slider } from './controls';
import { imageDrop } from './image-drop';
import { markerControls } from './marker-controls';
import { showMarker } from './preview';
import { featureRow } from './row';
import { previewStage } from './stage';

/**
 * The hitmarker maker.
 *
 * Same idea as the crosshair, on `#hitmarker`, plus the two things a
 * hitmarker wants that a crosshair does not: it can sit somewhere other than
 * dead centre, and you want to make it bigger by making it bigger rather than
 * by finding the slider called size. So the preview is draggable and has a
 * corner to pull.
 *
 * Krunker still decides when it appears, because it is the game's own
 * element: ours shows up on the frame you land a shot, with its timing and
 * its sound, and there is no hit detection anywhere in this client.
 */

export function hitmarkerEditor(): PanelView {
  return { title: 'HITMARKER', render };
}

/** How far outside the preview the marker may be dragged. */
const STAGE_MARGIN = 8;

function render(body: HTMLElement, ctx: TabContext): void {
  let config = ctx.deps.getVisuals().hitmarker;

  const stage = previewStage();
  const handle = document.createElement('span');
  handle.className = 'handle';
  handle.title = 'Drag to resize';
  stage.grab.appendChild(handle);

  const readout = hint('');

  const place = (): void => {
    stage.grab.style.transform = `translate(calc(-50% + ${config.offsetX}px), calc(-50% + ${config.offsetY}px))`;
    const size = config.image === '' ? markerGeometry(config.marker).size : config.imageSize;
    readout.textContent = `${size}px, ${label(config.offsetX, config.offsetY)}. Drag it to move, pull the corner to resize.`;
  };

  const draw = (): void => {
    showMarker(stage.art, config);
    place();
  };

  const commit = (next: HitmarkerConfig, structural = false): void => {
    config = next;
    ctx.deps.patchVisuals({ hitmarker: next });
    if (structural) ctx.refresh();
    else draw();
  };

  installDrag(stage.grab, handle, {
    bounds: () => stage.root.getBoundingClientRect(),
    get: () => config,
    set: (next) => commit(next),
  });

  const gameOff = gameHitmarkerIsOff();

  body.append(
    featureRow({
      icon: 'add',
      name: 'Use this hitmarker',
      sub: 'Shown the moment the game plays its hit sound.',
      on: config.on,
      onToggle: () => commit({ ...config, on: !config.on }, true),
    }),
    featureRow({
      icon: 'visibility_off',
      name: "Krunker's own hitmarker",
      sub: gameOff
        ? 'Off, so the only hitmarker on screen is this one.'
        : 'Still on, and drawn underneath this one.',
      on: !gameOff,
      onToggle: () => {
        if (!setGameHitmarkerOff(!gameOff)) {
          showToast('The game would not take that setting');
          return;
        }
        showToast(gameOff ? "Krunker's hitmarker is back on" : "Krunker's hitmarker is off");
        ctx.refresh();
      },
    }),
    stage.root,
    readout,
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
    );
  } else {
    body.append(heading('Shape'));
    body.append(
      ...markerControls(config.marker, (marker, structural) =>
        commit({ ...config, marker }, structural),
      ),
    );
  }

  body.append(
    heading(config.image !== '' ? 'Replace it' : 'Or use an image'),
    imageDrop({
      label: 'Drop a hitmarker image here',
      hint: 'PNG, GIF, JPEG or WebP, up to about 190KB',
      onPick: (image) => commit({ ...config, image }, true),
    }),
    actions([
      {
        label: 'Centre it',
        onClick: () => commit({ ...config, offsetX: 0, offsetY: 0 }),
      },
      {
        label: 'Reset',
        onClick: () => commit({ ...DEFAULT_VISUALS.hitmarker, on: config.on }, true),
      },
    ]),
    hint(
      'This appears when the game plays the sound it plays for a landed shot, so it shows up exactly when Krunker says you hit someone, not when a client guesses.',
    ),
  );

  draw();
}

function label(x: number, y: number): string {
  if (x === 0 && y === 0) return 'centred';
  return `${x > 0 ? `${x} right` : `${-x} left`}, ${y > 0 ? `${y} down` : `${-y} up`}`;
}

interface DragDeps {
  readonly bounds: () => DOMRect;
  readonly get: () => HitmarkerConfig;
  readonly set: (next: HitmarkerConfig) => void;
}

/**
 * Drag to move, pull the corner to resize.
 *
 * Pointer events with a capture, rather than mousemove on the document: the
 * capture is what keeps the drag alive when the pointer leaves the preview,
 * which it will, because the whole point of dragging is to find the edge.
 *
 * Resizing a drawn marker scales its measurements rather than scaling the
 * picture, so it is redrawn at the new size instead of being blown up. Every
 * step works from the marker the drag started with, so a gesture that goes
 * out and comes back lands where it left.
 */
function installDrag(grab: HTMLElement, handle: HTMLElement, deps: DragDeps): void {
  const limit = MARKER_LIMITS.offset;
  grab.classList.add('drag');

  const clampOffset = (value: number, extent: number): number =>
    Math.round(
      Math.min(
        Math.min(limit.max, extent / 2 + STAGE_MARGIN),
        Math.max(Math.max(limit.min, -extent / 2 - STAGE_MARGIN), value),
      ),
    );

  grab.addEventListener('pointerdown', (event) => {
    if (event.target === handle) return;
    event.preventDefault();
    grab.setPointerCapture(event.pointerId);

    const start = deps.get();
    const fromX = event.clientX;
    const fromY = event.clientY;

    const move = (moved: PointerEvent): void => {
      const box = deps.bounds();
      deps.set({
        ...deps.get(),
        offsetX: clampOffset(start.offsetX + moved.clientX - fromX, box.width),
        offsetY: clampOffset(start.offsetY + moved.clientY - fromY, box.height),
      });
    };
    const done = (): void => {
      grab.removeEventListener('pointermove', move);
      grab.removeEventListener('pointerup', done);
      grab.removeEventListener('pointercancel', done);
    };

    grab.addEventListener('pointermove', move);
    grab.addEventListener('pointerup', done);
    grab.addEventListener('pointercancel', done);
  });

  handle.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    handle.setPointerCapture(event.pointerId);

    const start = deps.get();
    const fromX = event.clientX;
    const fromY = event.clientY;
    const startSize =
      start.image === '' ? markerGeometry(start.marker).size : start.imageSize;

    const move = (moved: PointerEvent): void => {
      /*
       * Both axes, halved, then doubled: the corner is pulled diagonally, so
       * the honest reading of the gesture is how far it went along that
       * diagonal, and the marker grows from its middle in both directions,
       * so a corner that moves by one adds two to the size. The two cancel,
       * which is why this is a sum rather than either.
       */
      const wanted = startSize + (moved.clientX - fromX) + (moved.clientY - fromY);
      const factor = Math.max(0.1, wanted / Math.max(1, startSize));
      const current = deps.get();

      deps.set(
        current.image === ''
          ? { ...current, marker: scaleMarker(start.marker, factor) }
          : {
              ...current,
              imageSize: Math.round(
                Math.min(
                  MARKER_LIMITS.imageSize.max,
                  Math.max(MARKER_LIMITS.imageSize.min, wanted),
                ),
              ),
            },
      );
    };
    const done = (): void => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', done);
      handle.removeEventListener('pointercancel', done);
    };

    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', done);
    handle.addEventListener('pointercancel', done);
  });
}

/**
 * The same marker, `factor` times as big.
 *
 * Thickness scales with everything else, because a marker twice the size
 * with the same hairline arms is not the same marker twice the size. Each
 * number is clamped on its own, so hitting the end of one range stops that
 * measurement growing rather than the whole gesture.
 */
function scaleMarker(marker: MarkerSpec, factor: number): MarkerSpec {
  const L = MARKER_LIMITS;
  const fit = (value: number, min: number, max: number): number =>
    Math.round(Math.min(max, Math.max(min, value * factor)));

  return {
    ...marker,
    length: fit(marker.length, L.length.min, L.length.max),
    thickness: fit(marker.thickness, L.thickness.min, L.thickness.max),
    gap: fit(marker.gap, L.gap.min, L.gap.max),
    dot: fit(marker.dot, L.dot.min, L.dot.max),
  };
}
