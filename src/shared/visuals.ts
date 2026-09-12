import {
  HITMARKER_START_COLOR,
  MARKER_PRESETS,
  MARKER_START_COLOR,
  SKY_PRESETS,
  SKY_START_COLOR,
} from './ui/tokens';

/**
 * The three things the client draws over Krunker's own art: a crosshair, a
 * hitmarker, and the colour of the sky.
 *
 * All three are the same idea. Krunker keeps its crosshair in `#aimDot` and
 * its hitmarker in `#hitmarker`, and both are plain `<img>` elements it only
 * ever sets a `src` on, so a client does not have to draw an overlay, track
 * hits, or know when a round starts: it sets the `src` and the game keeps
 * doing the showing and hiding. The sky is one field in the map JSON, so that
 * one is answered before the game ever sees it.
 *
 * That is also the fix for the bug this started as. A custom crosshair in
 * Krunker is a URL, and a URL on Discord stops resolving the moment the CDN
 * expires the link, which leaves you in a match with no crosshair at all. An
 * image dropped here is read off your disk and stored as its own bytes, so
 * there is nothing left to go and fetch.
 *
 * The shapes live here rather than beside the canvas that paints them because
 * the geometry is arithmetic and the painting is four canvas calls: this way
 * the part worth testing is testable in a plain node test, with no DOM.
 */

export type MarkerShape = 'cross' | 't' | 'x' | 'circle' | 'dot';

export const MARKER_SHAPES: readonly MarkerShape[] = ['cross', 't', 'x', 'circle', 'dot'];

/** What one drawn marker looks like. Shared by the crosshair and hitmarker. */
export interface MarkerSpec {
  readonly shape: MarkerShape;
  /** Arm length, measured from the end of the gap outwards. */
  readonly length: number;
  readonly thickness: number;
  /** Empty space at the centre, from the middle to where an arm starts. */
  readonly gap: number;
  /** Centre dot diameter. 0 for none. Drawn on any shape. */
  readonly dot: number;
  /** Dark edge around everything, so it reads on a light wall. 0 for none. */
  readonly outline: number;
  /** '#rrggbb'. */
  readonly color: string;
  /** 0..1. */
  readonly opacity: number;
}

export interface CrosshairConfig {
  readonly on: boolean;
  /**
   * A dropped image, as a data URL, or ''.
   *
   * Wins over the drawn marker when set, because someone who has just
   * dropped a PNG in expects to see the PNG. Clearing it goes back to the
   * marker, which is still there underneath.
   */
  readonly image: string;
  /** On-screen width of that image, in pixels. Height follows the aspect. */
  readonly imageSize: number;
  readonly marker: MarkerSpec;
}

export interface HitmarkerConfig {
  readonly on: boolean;
  readonly image: string;
  readonly imageSize: number;
  readonly marker: MarkerSpec;
  /** Nudge from the centre of the screen, in pixels. */
  readonly offsetX: number;
  readonly offsetY: number;
}

export interface SkyConfig {
  readonly on: boolean;
  /** '#rrggbb'. */
  readonly color: string;
}

export interface VisualsConfig {
  readonly sky: SkyConfig;
  readonly crosshair: CrosshairConfig;
  readonly hitmarker: HitmarkerConfig;
}

/** Ranges every number is held inside. The editors read them for their sliders. */
export const MARKER_LIMITS = {
  length: { min: 0, max: 40 },
  thickness: { min: 1, max: 12 },
  gap: { min: 0, max: 40 },
  dot: { min: 0, max: 14 },
  outline: { min: 0, max: 4 },
  opacity: { min: 0.1, max: 1 },
  /** Both the dropped-image width and the hitmarker's drawn size. */
  imageSize: { min: 8, max: 256 },
  /** How far from centre the hitmarker can be pushed. */
  offset: { min: -300, max: 300 },
} as const;

/**
 * The biggest image we will take, as base64 characters.
 *
 * This ends up in config.json, which is read at startup and rewritten on
 * every settings change, so it is not somewhere to put a 4MB screenshot.
 * 256KB of base64 is a generous crosshair and still a file that loads
 * instantly.
 */
export const MAX_IMAGE_CHARS = 256 * 1024;

const HEX = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value);
}

/**
 * '#b48cff' as 11832063.
 *
 * Krunker writes map colours both ways: `sky` came back as `"#dce8ed"` on one
 * map and as `14477549` on another, which is the same colour packed into an
 * integer. Whatever a map used is what it gets back, so the rewrite never
 * changes the shape of the field it is answering.
 */
export function colorToInt(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function color(value: unknown, fallback: string): string {
  return isHexColor(value) ? value.toLowerCase() : fallback;
}

/**
 * A data URL for an image, or ''.
 *
 * Anything else is dropped rather than repaired. This is the one field here
 * that is long enough to hide something in, and a `src` is a fetch: a
 * `https://` URL that arrived through a hostile userscript editing the
 * config would be a request we made on its behalf, which is exactly what
 * this feature exists to stop being possible.
 */
function image(value: unknown): string {
  if (typeof value !== 'string' || value === '') return '';
  if (value.length > MAX_IMAGE_CHARS) return '';
  return /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(value) ? value : '';
}

export function normaliseMarker(value: unknown, fallback: MarkerSpec): MarkerSpec {
  const raw = (value ?? {}) as Partial<MarkerSpec>;
  const shape = MARKER_SHAPES.includes(raw.shape as MarkerShape)
    ? (raw.shape as MarkerShape)
    : fallback.shape;
  const L = MARKER_LIMITS;
  return {
    shape,
    length: clamp(raw.length, L.length.min, L.length.max, fallback.length),
    thickness: clamp(raw.thickness, L.thickness.min, L.thickness.max, fallback.thickness),
    gap: clamp(raw.gap, L.gap.min, L.gap.max, fallback.gap),
    dot: clamp(raw.dot, L.dot.min, L.dot.max, fallback.dot),
    outline: clamp(raw.outline, L.outline.min, L.outline.max, fallback.outline),
    color: color(raw.color, fallback.color),
    opacity: clamp(raw.opacity, L.opacity.min, L.opacity.max, fallback.opacity),
  };
}

/**
 * Put a whole visuals section into range.
 *
 * Called on the way out of the config and again on the way in from the
 * editors. The config store only merges one level deep, so a section written
 * by an older build arrives with whole objects missing, and page script can
 * patch config with anything at all: both are the same problem, and this is
 * the one answer to it.
 */
export function normaliseVisuals(value: unknown): VisualsConfig {
  const raw = (value ?? {}) as Partial<VisualsConfig>;
  const sky = (raw.sky ?? {}) as Partial<SkyConfig>;
  const crosshair = (raw.crosshair ?? {}) as Partial<CrosshairConfig>;
  const hitmarker = (raw.hitmarker ?? {}) as Partial<HitmarkerConfig>;
  const L = MARKER_LIMITS;

  return {
    sky: {
      on: sky.on === true,
      color: color(sky.color, DEFAULT_VISUALS.sky.color),
    },
    crosshair: {
      on: crosshair.on === true,
      image: image(crosshair.image),
      imageSize: clamp(
        crosshair.imageSize,
        L.imageSize.min,
        L.imageSize.max,
        DEFAULT_VISUALS.crosshair.imageSize,
      ),
      marker: normaliseMarker(crosshair.marker, DEFAULT_VISUALS.crosshair.marker),
    },
    hitmarker: {
      on: hitmarker.on === true,
      image: image(hitmarker.image),
      imageSize: clamp(
        hitmarker.imageSize,
        L.imageSize.min,
        L.imageSize.max,
        DEFAULT_VISUALS.hitmarker.imageSize,
      ),
      marker: normaliseMarker(hitmarker.marker, DEFAULT_VISUALS.hitmarker.marker),
      offsetX: clamp(hitmarker.offsetX, L.offset.min, L.offset.max, 0),
      offsetY: clamp(hitmarker.offsetY, L.offset.min, L.offset.max, 0),
    },
  };
}

/**
 * What both editors open on.
 *
 * A plain green cross at Krunker's own weight, and the hitmarker as the X
 * everyone already knows, so the first thing anyone sees is a crosshair that
 * looks like a crosshair rather than a blank canvas and eight sliders.
 */
export const DEFAULT_VISUALS: VisualsConfig = {
  sky: { on: false, color: SKY_START_COLOR },
  crosshair: {
    on: false,
    image: '',
    imageSize: 32,
    marker: {
      shape: 'cross',
      length: 7,
      thickness: 2,
      gap: 4,
      dot: 0,
      outline: 1,
      color: MARKER_START_COLOR,
      opacity: 1,
    },
  },
  hitmarker: {
    on: false,
    image: '',
    imageSize: 40,
    marker: {
      shape: 'x',
      length: 8,
      thickness: 3,
      gap: 3,
      dot: 0,
      outline: 1,
      color: HITMARKER_START_COLOR,
      opacity: 1,
    },
    offsetX: 0,
    offsetY: 0,
  },
};

export { MARKER_PRESETS, SKY_PRESETS };

/** One arm, as a line the painter strokes at `thickness`. */
export interface MarkerLine {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/**
 * Where every part of a marker goes, on a square canvas of `size`.
 *
 * Lines rather than rectangles so the X is the same arithmetic as the cross
 * instead of a special case: a diagonal arm is not an axis-aligned box, and
 * once you are stroking a line for one you may as well stroke one for both.
 */
export interface MarkerGeometry {
  /** Canvas edge, in CSS pixels. Always at least 4. */
  readonly size: number;
  /** Centre of that canvas, i.e. size / 2. */
  readonly centre: number;
  readonly lines: readonly MarkerLine[];
  /** Centre dot diameter, 0 for none. */
  readonly dot: number;
  /** Ring radius, 0 for none. */
  readonly ring: number;
  readonly thickness: number;
  readonly outline: number;
}

/** Half of root two, for the diagonal arms. */
const DIAGONAL = Math.SQRT1_2;

/** Breathing room at the edge, so an outline is never clipped by the canvas. */
const PADDING = 2;

export function markerGeometry(spec: MarkerSpec): MarkerGeometry {
  const { shape, thickness, outline } = spec;
  // Half the stroke plus the outline is how far past its own endpoint a line
  // actually paints; everything below is sized from the outside of that.
  const edge = thickness / 2 + outline + PADDING;

  if (shape === 'dot') {
    const dot = Math.max(spec.dot, 1);
    const size = Math.ceil(dot + 2 * (outline + PADDING));
    return { size, centre: size / 2, lines: [], dot, ring: 0, thickness, outline };
  }

  if (shape === 'circle') {
    const ring = Math.max(spec.length, 1);
    const size = Math.ceil(2 * (ring + edge));
    return { size, centre: size / 2, lines: [], dot: spec.dot, ring, thickness, outline };
  }

  const reach = spec.gap + spec.length;
  const size = Math.max(4, Math.ceil(2 * (reach + edge)));
  const c = size / 2;
  const lines: MarkerLine[] = [];

  if (shape === 'x') {
    // Both ends of both diagonals, so the gap is a gap in the middle rather
    // than a shorter arm on one side.
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        lines.push({
          x1: c + sx * spec.gap * DIAGONAL,
          y1: c + sy * spec.gap * DIAGONAL,
          x2: c + sx * reach * DIAGONAL,
          y2: c + sy * reach * DIAGONAL,
        });
      }
    }
  } else {
    // 't' is the cross without its top arm, which is what Krunker's own
    // "T Style" does: it is the one arm that sits in front of whatever you
    // are aiming at.
    if (shape !== 't') lines.push({ x1: c, y1: c - spec.gap, x2: c, y2: c - reach });
    lines.push({ x1: c, y1: c + spec.gap, x2: c, y2: c + reach });
    lines.push({ x1: c - spec.gap, y1: c, x2: c - reach, y2: c });
    lines.push({ x1: c + spec.gap, y1: c, x2: c + reach, y2: c });
  }

  // Zero-length arms would paint a stub of the stroke at each end, which
  // reads as a dotted box rather than as nothing.
  return {
    size,
    centre: c,
    lines: spec.length > 0 ? lines : [],
    dot: spec.dot,
    ring: 0,
    thickness,
    outline,
  };
}

/** Which controls a shape actually has. The editors hide the rest. */
export function markerUsesArms(shape: MarkerShape): boolean {
  return shape === 'cross' || shape === 't' || shape === 'x';
}
