import { hexToHsv, hsvToHex, hsvToRgb, parseHex, wheelPick, wheelPoint, type Hsv } from '../../shared/color';

/**
 * A full colour wheel: hue round the ring, saturation out from the middle,
 * brightness on the slider underneath, and the hex beside the colour so an
 * exact one can be typed or pasted.
 *
 * Drawn in the panel rather than handed to the OS colour dialog, because the
 * dialog is a separate window: you cannot see the board or the sky behind it
 * while you pick, which is the whole reason the colour applies live.
 *
 * The control keeps its own hue, saturation and brightness rather than
 * re-deriving them from the hex each time. Hex forgets the hue of a grey, so
 * dragging brightness to black and back would otherwise lose the colour you
 * were on.
 */

export interface WheelSpec {
  readonly label: string;
  readonly value: string;
  readonly onPick: (color: string) => void;
}

/** CSS pixels across. The canvas is drawn at the screen's density. */
const SIZE = 168;

export function colorWheel(spec: WheelSpec): HTMLElement {
  const row = document.createElement('div');
  row.className = 'ctl wheel-row';

  const label = document.createElement('span');
  label.className = 'lbl';
  label.textContent = spec.label;

  const box = document.createElement('div');
  box.className = 'wheel';

  const disc = document.createElement('div');
  disc.className = 'wheel-disc';
  const canvas = document.createElement('canvas');
  const scale = Math.max(1, Math.round(window.devicePixelRatio || 1));
  canvas.width = SIZE * scale;
  canvas.height = SIZE * scale;
  const mark = document.createElement('div');
  mark.className = 'wheel-mark';
  disc.append(canvas, mark);

  const brightness = document.createElement('input');
  brightness.type = 'range';
  brightness.className = 'wheel-val';
  brightness.min = '0';
  brightness.max = '100';
  brightness.title = 'Brightness';

  const hexRow = document.createElement('div');
  hexRow.className = 'wheel-hex';
  const now = document.createElement('span');
  now.className = 'wheel-now';
  const hex = document.createElement('input');
  hex.type = 'text';
  hex.className = 'line';
  hex.maxLength = 7;
  hex.spellcheck = false;
  hex.autocomplete = 'off';
  // Krunker listens on the window for its binds; see textRow.
  for (const type of ['keydown', 'keyup', 'keypress'] as const) {
    hex.addEventListener(type, (event) => event.stopPropagation());
  }
  hexRow.append(now, hex);

  box.append(disc, brightness, hexRow);
  row.append(label, box);

  let hsv: Hsv = hexToHsv(spec.value) ?? { h: 0, s: 0, v: 1 };
  let drawnV = -1;

  /** The disc at one brightness. Only redrawn when the brightness moves. */
  const drawDisc = (): void => {
    if (drawnV === hsv.v) return;
    drawnV = hsv.v;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const n = canvas.width;
    const radius = n / 2;
    const image = ctx.createImageData(n, n);
    const px = image.data;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const dx = x + 0.5 - radius;
        const dy = y + 0.5 - radius;
        const distance = Math.hypot(dx, dy);
        if (distance > radius) continue;
        const { h, s } = wheelPick(dx, dy, radius);
        const [r, g, b] = hsvToRgb({ h, s, v: hsv.v });
        const i = (y * n + x) * 4;
        px[i] = r;
        px[i + 1] = g;
        px[i + 2] = b;
        // The last pixel of the rim fades, so the edge is not a staircase.
        px[i + 3] = Math.round(255 * Math.min(1, radius - distance));
      }
    }
    ctx.putImageData(image, 0, 0);
  };

  /** Everything but the hex box, which is left alone while you type in it. */
  const show = (fromTyping: boolean): string => {
    const color = hsvToHex(hsv);
    drawDisc();
    const { dx, dy } = wheelPoint(hsv.h, hsv.s, SIZE / 2);
    mark.style.left = `${SIZE / 2 + dx}px`;
    mark.style.top = `${SIZE / 2 + dy}px`;
    mark.style.background = color;
    brightness.value = String(Math.round(hsv.v * 100));
    // The slider's track runs from black to this hue at full brightness.
    const dark = hsvToHex({ ...hsv, v: 0 });
    const bright = hsvToHex({ ...hsv, v: 1 });
    brightness.style.background = `linear-gradient(to right, ${dark}, ${bright})`;
    now.style.background = color;
    if (!fromTyping) hex.value = color;
    return color;
  };

  const pickAt = (event: PointerEvent): void => {
    const rect = disc.getBoundingClientRect();
    const { h, s } = wheelPick(
      event.clientX - rect.left - rect.width / 2,
      event.clientY - rect.top - rect.height / 2,
      rect.width / 2,
    );
    hsv = { ...hsv, h, s };
    spec.onPick(show(false));
  };

  disc.addEventListener('pointerdown', (event) => {
    disc.setPointerCapture(event.pointerId);
    pickAt(event);
  });
  disc.addEventListener('pointermove', (event) => {
    if (disc.hasPointerCapture(event.pointerId)) pickAt(event);
  });

  brightness.addEventListener('input', () => {
    hsv = { ...hsv, v: Number(brightness.value) / 100 };
    spec.onPick(show(false));
  });

  hex.addEventListener('input', () => {
    const color = parseHex(hex.value);
    const next = color === null ? null : hexToHsv(color);
    if (color === null || next === null) return;
    hsv = next;
    show(true);
    spec.onPick(color);
  });
  // Tidy what was typed once you leave the box: 'ABC123' becomes '#abc123'.
  hex.addEventListener('blur', () => show(false));

  show(false);
  return row;
}
