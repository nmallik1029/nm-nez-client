import {
  MARKER_LIMITS,
  MARKER_PRESETS,
  MARKER_SHAPES,
  markerUsesArms,
  type MarkerShape,
  type MarkerSpec,
} from '../../shared/visuals';
import { chooser, colorRow, slider } from './controls';

/**
 * The controls that build one marker. Used by both editors.
 *
 * Only the sliders that mean something for the chosen shape are drawn. A
 * circle has no gap and a dot has no arms, and leaving those on screen greyed
 * out or, worse, live and doing nothing, is the thing that makes an editor
 * feel like a settings file with a UI stuck on the front.
 *
 * `structural` on the way out says whether the editor has to be redrawn or
 * only repainted. Changing a number never adds or removes a control, so a
 * slider can keep the mouse; changing the shape does, so that one goes back
 * through a full draw.
 */

const SHAPE_LABELS: Record<MarkerShape, string> = {
  cross: 'Cross',
  t: 'T',
  x: 'X',
  circle: 'Circle',
  dot: 'Dot',
};

export type MarkerChange = (next: MarkerSpec, structural: boolean) => void;

export function markerControls(spec: MarkerSpec, onChange: MarkerChange): HTMLElement[] {
  const L = MARKER_LIMITS;
  const rows: HTMLElement[] = [];
  const edit = (partial: Partial<MarkerSpec>): void => onChange({ ...spec, ...partial }, false);

  rows.push(
    chooser<MarkerShape>({
      label: 'Shape',
      options: MARKER_SHAPES.map((id) => ({ id, label: SHAPE_LABELS[id] })),
      value: spec.shape,
      onPick: (shape) => onChange({ ...spec, shape }, true),
    }),
  );

  if (spec.shape === 'dot') {
    rows.push(
      slider({
        label: 'Size',
        min: 1,
        max: L.dot.max,
        value: Math.max(1, spec.dot),
        onChange: (dot) => edit({ dot }),
      }),
    );
  } else {
    rows.push(
      slider({
        // The same number means the arm on a cross and the radius on a
        // circle, and calling it "length" on a circle would be a small lie
        // repeated every time anyone looked at it.
        label: spec.shape === 'circle' ? 'Radius' : 'Length',
        min: spec.shape === 'circle' ? 1 : L.length.min,
        max: L.length.max,
        value: spec.length,
        onChange: (length) => edit({ length }),
      }),
      slider({
        label: 'Thickness',
        min: L.thickness.min,
        max: L.thickness.max,
        value: spec.thickness,
        onChange: (thickness) => edit({ thickness }),
      }),
    );

    if (markerUsesArms(spec.shape)) {
      rows.push(
        slider({
          label: 'Gap',
          min: L.gap.min,
          max: L.gap.max,
          value: spec.gap,
          onChange: (gap) => edit({ gap }),
        }),
      );
    }

    rows.push(
      slider({
        // "Centre dot" wrapped onto two lines in the label column and pushed
        // its own slider out of line with every other one.
        label: 'Dot',
        min: L.dot.min,
        max: L.dot.max,
        value: spec.dot,
        format: (value) => (value === 0 ? 'Off' : String(value)),
        onChange: (dot) => edit({ dot }),
      }),
    );
  }

  rows.push(
    slider({
      label: 'Outline',
      min: L.outline.min,
      max: L.outline.max,
      value: spec.outline,
      format: (value) => (value === 0 ? 'Off' : String(value)),
      onChange: (outline) => edit({ outline }),
    }),
    slider({
      label: 'Opacity',
      min: L.opacity.min,
      max: L.opacity.max,
      step: 0.05,
      value: spec.opacity,
      format: (value) => `${Math.round(value * 100)}%`,
      onChange: (opacity) => edit({ opacity }),
    }),
    colorRow({
      label: 'Colour',
      value: spec.color,
      presets: MARKER_PRESETS,
      onPick: (color) => edit({ color }),
    }),
  );

  return rows;
}
