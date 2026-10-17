/**
 * Colour arithmetic for the colour wheel in the QoL panel.
 *
 * Hue, saturation and value rather than RGB, because that is the shape of
 * the control: hue is the angle round the wheel, saturation is the distance
 * out from the middle, and value is the brightness slider under it. Kept
 * here, away from the canvas, so it can be tested without a DOM.
 */

/** Hue in degrees, 0 to 360; saturation and value 0 to 1. */
export interface Hsv {
  readonly h: number;
  readonly s: number;
  readonly v: number;
}

const HEX6 = /^#?([0-9a-f]{6})$/i;

/**
 * '#rrggbb' from whatever was typed, or null when it is not a colour.
 *
 * The # is optional because people paste hex from everywhere and half the
 * places leave it off.
 */
export function parseHex(text: string): string | null {
  const match = HEX6.exec(text.trim());
  return match ? `#${(match[1] ?? '').toLowerCase()}` : null;
}

/** 0-255 per channel. */
export function hsvToRgb({ h, s, v }: Hsv): [number, number, number] {
  const hue = (((h % 360) + 360) % 360) / 60;
  const chroma = v * s;
  const x = chroma * (1 - Math.abs((hue % 2) - 1));
  const [r, g, b] =
    hue < 1 ? [chroma, x, 0]
    : hue < 2 ? [x, chroma, 0]
    : hue < 3 ? [0, chroma, x]
    : hue < 4 ? [0, x, chroma]
    : hue < 5 ? [x, 0, chroma]
    : [chroma, 0, x];
  const m = v - chroma;
  return [r, g, b].map((c) => Math.round((c + m) * 255)) as [number, number, number];
}

export function hsvToHex(hsv: Hsv): string {
  return `#${hsvToRgb(hsv)
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')}`;
}

/** Null for anything `parseHex` would not take. */
export function hexToHsv(hex: string): Hsv | null {
  const parsed = parseHex(hex);
  if (parsed === null) return null;
  const n = parseInt(parsed.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;

  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;
  if (delta > 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  return { h: (h + 360) % 360, s: max === 0 ? 0 : delta / max, v: max };
}

/**
 * Where on a wheel of this radius a point falls, as hue and saturation.
 *
 * Measured from the centre. A point outside the wheel lands on its rim at the
 * same angle, so a drag that slips off the edge keeps tracking.
 */
export function wheelPick(dx: number, dy: number, radius: number): { h: number; s: number } {
  const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  const s = radius > 0 ? Math.min(1, Math.hypot(dx, dy) / radius) : 0;
  return { h, s };
}

/** The reverse of `wheelPick`: where to put the marker. */
export function wheelPoint(h: number, s: number, radius: number): { dx: number; dy: number } {
  const angle = (h * Math.PI) / 180;
  return { dx: Math.cos(angle) * s * radius, dy: Math.sin(angle) * s * radius };
}
