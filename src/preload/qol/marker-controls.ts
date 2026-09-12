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

/** Reads the marker as it is now, not as it was when a control was drawn. */
export type MarkerRead = () => MarkerSpec;

/**
 * Turn a change to one measurement into a whole marker.
 *
 * The reader is the entire point, and it is what this got wrong first time
 * round. Every slider used to close over the marker it was drawn with, and
 * moving a slider deliberately does not redraw the rows, so the second slider
 * you touched spread a snapshot taken before the first one moved: setting the
 * gap put the old length back, setting the colour put the old gap back, and
 * the labels went on reporting the values you had chosen because the labels
 * were not stale, the marker underneath them was.
 *
 * Reading through a function means there is no snapshot to be stale.
 */
export function markerEditor(
  read: MarkerRead,
  onChange: MarkerChange,
): (partial: Partial<MarkerSpec>, structural?: boolean) => void {
  return (partial, structural = false) => onChange({ ...read(), ...partial }, structural);
}

export function markerControls(read: MarkerRead, onChange: MarkerChange): HTMLElement[] {
  const L = MARKER_LIMITS;
  const rows: HTMLElement[] = [];
  // Only for deciding which controls exist and where their handles start.
  // Every value that leaves this function goes through `edit`.
  const spec = read();
  const edit = markerEditor(read, onChange);

  rows.push(
    chooser<MarkerShape>({
      label: 'Shape',
      options: MARKER_SHAPES.map((id) => ({ id, label: SHAPE_LABELS[id] })),
      value: spec.shape,
      // Structural: a circle has no gap and a dot has no arms, so which
      // controls exist changes with the shape.
      onPick: (shape) => edit({ shape }, true),
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
