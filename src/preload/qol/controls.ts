/**
 * The parts an editor in the QoL panel is built from.
 *
 * A slider with its number beside it, a row of shapes to pick from, a row of
 * colours and a picker. Three editors use them, and they are here rather than
 * in each one so that a crosshair and a hitmarker cannot slowly grow two
 * different ideas of what a slider looks like.
 *
 * Everything takes a callback and owns nothing. None of these read or write
 * config: they report a value, the editor decides what it means.
 */

export interface SliderSpec {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly value: number;
  /** How the number is shown. Defaults to the number itself. */
  readonly format?: (value: number) => string;
  readonly onChange: (value: number) => void;
}

/**
 * A labelled slider with a live readout.
 *
 * `input` rather than `change`, so the picture keeps up with the thumb: every
 * one of these is attached to something being drawn on screen, and a
 * crosshair that only redraws when you let go is a crosshair you have to
 * guess at.
 */
export function slider(spec: SliderSpec): HTMLElement {
  const row = document.createElement('div');
  row.className = 'ctl';

  const label = document.createElement('span');
  label.className = 'lbl';
  label.textContent = spec.label;

  const range = document.createElement('input');
  range.type = 'range';
  range.className = 'rng';
  range.min = String(spec.min);
  range.max = String(spec.max);
  range.step = String(spec.step ?? 1);
  range.value = String(spec.value);

  const value = document.createElement('span');
  value.className = 'val';
  const show = (n: number): void => {
    value.textContent = spec.format ? spec.format(n) : String(n);
  };
  show(spec.value);

  range.addEventListener('input', () => {
    const next = Number(range.value);
    show(next);
    spec.onChange(next);
  });

  row.append(label, range, value);
  return row;
}

export interface ChoiceSpec<T extends string> {
  readonly label: string;
  readonly options: readonly { readonly id: T; readonly label: string }[];
  readonly value: T;
  readonly onPick: (id: T) => void;
}

/** A row of buttons where exactly one is on. */
export function chooser<T extends string>(spec: ChoiceSpec<T>): HTMLElement {
  const row = document.createElement('div');
  row.className = 'ctl';

  const label = document.createElement('span');
  label.className = 'lbl';
  label.textContent = spec.label;

  const group = document.createElement('div');
  group.className = 'seg';

  for (const option of spec.options) {
    const button = document.createElement('button');
    button.textContent = option.label;
    if (option.id === spec.value) button.classList.add('on');
    button.addEventListener('click', () => spec.onPick(option.id));
    group.appendChild(button);
  }

  row.append(label, group);
  return row;
}

export interface ColorSpec {
  readonly label: string;
  readonly value: string;
  readonly presets: readonly string[];
  readonly onPick: (color: string) => void;
}

/**
 * Swatches, then the picker.
 *
 * The swatches are the answer nearly every time, and the picker is there so
 * that "nearly" is not a wall. The current colour is shown by an outline on
 * the swatch rather than by a tick, which at this size is a smudge.
 */
export function colorRow(spec: ColorSpec): HTMLElement {
  const row = document.createElement('div');
  row.className = 'ctl';

  const label = document.createElement('span');
  label.className = 'lbl';
  label.textContent = spec.label;

  const group = document.createElement('div');
  group.className = 'swatches';

  const dots = new Map<string, HTMLButtonElement>();
  const picker = document.createElement('input');

  /*
   * The row keeps its own selection rather than being redrawn.
   *
   * The picker is an OS colour dialog that reports every colour the mouse
   * passes over, and rebuilding this row underneath an open dialog means
   * replacing the very element that dialog belongs to. So the only thing
   * that has to change on a pick is which swatch is outlined, and this does
   * that itself.
   */
  const mark = (color: string): void => {
    const wanted = color.toLowerCase();
    for (const [preset, dot] of dots) dot.classList.toggle('on', preset === wanted);
    if (picker.value.toLowerCase() !== wanted) picker.value = color;
  };

  for (const preset of spec.presets) {
    const dot = document.createElement('button');
    dot.className = 'swatch';
    dot.style.background = preset;
    dot.title = preset;
    dot.addEventListener('click', () => {
      mark(preset);
      spec.onPick(preset);
    });
    dots.set(preset.toLowerCase(), dot);
    group.appendChild(dot);
  }

  picker.type = 'color';
  picker.className = 'pick';
  picker.value = spec.value;
  picker.title = 'Pick any colour';
  picker.addEventListener('input', () => {
    mark(picker.value);
    spec.onPick(picker.value);
  });
  group.appendChild(picker);
  mark(spec.value);

  row.append(label, group);
  return row;
}

/** A line of small print under a control, for something worth saying once. */
export function hint(text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'hint';
  el.textContent = text;
  return el;
}

/** A heading inside an editor, so a long list of sliders has joints in it. */
export function heading(text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'sect';
  el.textContent = text;
  return el;
}

export interface ActionSpec {
  readonly label: string;
  readonly onClick: () => void;
  /** Draws in the delete colours. For anything that throws something away. */
  readonly danger?: boolean;
}

/** A right-aligned row of buttons, at the bottom of an editor. */
export function actions(specs: readonly ActionSpec[]): HTMLElement {
  const row = document.createElement('div');
  row.className = 'actions';

  for (const spec of specs) {
    const button = document.createElement('button');
    button.textContent = spec.label;
    if (spec.danger === true) button.className = 'del';
    button.addEventListener('click', spec.onClick);
    row.appendChild(button);
  }

  return row;
}
