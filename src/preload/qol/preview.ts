import type { MarkerSpec } from '../../shared/visuals';
import { paintMarker } from '../look/paint';

/**
 * Draw what the game will draw, into the editor's preview.
 *
 * Deliberately the same call the client makes for the real thing, at the same
 * size, on a wall texture from the game: what is on screen here is not an
 * impression of the crosshair, it is the crosshair.
 */

export interface PreviewSource {
  readonly image: string;
  readonly imageSize: number;
  readonly marker: MarkerSpec;
}

/** Paint into the stage's image. Returns its width in CSS pixels. */
export function showMarker(art: HTMLImageElement, source: PreviewSource): number {
  if (source.image !== '') {
    art.src = source.image;
    art.style.width = `${source.imageSize}px`;
    art.style.height = 'auto';
    return source.imageSize;
  }

  const painted = paintMarker(source.marker);
  art.src = painted.url;
  art.style.width = `${painted.size}px`;
  art.style.height = `${painted.size}px`;
  return painted.size;
}
