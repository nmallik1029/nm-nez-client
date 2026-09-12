import { MARKER_OUTLINE_COLOR } from '../../shared/ui/tokens';
import { markerGeometry, type MarkerGeometry, type MarkerSpec } from '../../shared/visuals';

/**
 * A marker, painted onto a canvas and handed back as a data URL.
 *
 * A data URL rather than a blob URL on purpose: this ends up as the `src` of
 * one of Krunker's own `<img>` elements, and a blob URL is a handle into a
 * store that has to be revoked or it leaks, with the added trap that the
 * moment it is revoked the crosshair vanishes. The whole point of this
 * feature is a crosshair that cannot vanish.
 *
 * The arithmetic is in `shared/visuals.ts`. What is left here is four canvas
 * calls and the two details a canvas needs that geometry does not: drawing at
 * the screen's pixel ratio, and the half-pixel offset that keeps a one-pixel
 * line one pixel wide instead of two grey ones.
 */

export interface PaintedMarker {
  /** `data:image/png;base64,...`, or '' if the canvas could not be had. */
  readonly url: string;
  /** How wide to show it, in CSS pixels. */
  readonly size: number;
}

/**
 * Cap on the backing store.
 *
 * Past 3x there is nothing left to see and the data URL is four times the
 * size for it, and this string is written to config.json on every change.
 */
const MAX_SCALE = 3;

export function paintMarker(spec: MarkerSpec): PaintedMarker {
  const geometry = markerGeometry(spec);
  const scale = Math.min(MAX_SCALE, Math.max(1, window.devicePixelRatio || 1));

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(geometry.size * scale);
  canvas.height = canvas.width;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { url: '', size: geometry.size };

  ctx.scale(scale, scale);
  /*
   * A stroke straddles the line it is given, so an odd-width stroke down an
   * integer coordinate covers half of two pixels and is drawn as two grey
   * ones. Nudging the whole drawing half a pixel puts it back on one. Which
   * way round that goes depends on the canvas being an even or odd number of
   * pixels across, so the two parities are asked together.
   */
  const nudge = (Math.round(geometry.thickness) + geometry.size) % 2 === 1 ? 0.5 : 0;
  ctx.translate(nudge, nudge);
  ctx.globalAlpha = spec.opacity;
  ctx.lineCap = 'butt';

  if (geometry.outline > 0) stroke(ctx, geometry, MARKER_OUTLINE_COLOR, geometry.outline);
  stroke(ctx, geometry, spec.color, 0);

  return { url: canvas.toDataURL('image/png'), size: geometry.size };
}

/**
 * One pass over every part of the marker.
 *
 * Run twice: once wider and in black for the outline, once at the real
 * weight in the chosen colour. `grow` is how much wider, and it also pushes
 * each arm's ends out by the same amount, or the outline would stop square
 * across the tip and leave the colour poking through it.
 */
function stroke(
  ctx: CanvasRenderingContext2D,
  geometry: MarkerGeometry,
  color: string,
  grow: number,
): void {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = geometry.thickness + grow * 2;

  for (const line of geometry.lines) {
    // Unit vector along the arm, so "longer by `grow`" means the same thing
    // for a diagonal as for an upright.
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = (dx / len) * grow;
    const uy = (dy / len) * grow;

    ctx.beginPath();
    ctx.moveTo(line.x1 - ux, line.y1 - uy);
    ctx.lineTo(line.x2 + ux, line.y2 + uy);
    ctx.stroke();
  }

  if (geometry.ring > 0) {
    ctx.beginPath();
    ctx.arc(geometry.centre, geometry.centre, geometry.ring, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (geometry.dot > 0) {
    ctx.beginPath();
    ctx.arc(geometry.centre, geometry.centre, geometry.dot / 2 + grow, 0, Math.PI * 2);
    ctx.fill();
  }
}
