import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, net } from 'electron';

/**
 * Krunker's UI typeface, for the windows of ours that aren't the game page.
 *
 * Those load from `data:` URLs, which have an opaque origin, and krunker.io
 * serves the font with no access-control-allow-origin, so they can't just link
 * it. Fetched once, cached next to the config, inlined as base64 per window.
 *
 * 19 KB, so this is cheap. Fetched at runtime rather than committed as a
 * base64 blob in a source file, because that's the sort of thing that makes a
 * repo impossible to read.
 */
const FONT_URL = 'https://krunker.io/css/fonts/FrVrKrunkerBold2.ttf';
const CACHE_NAME = 'gamefont.ttf';
/** Guards against caching an error page as if it were a font. */
const MIN_PLAUSIBLE_BYTES = 4096;

let cached: string | null = null;

function cachePath(): string {
  return join(app.getPath('userData'), CACHE_NAME);
}

/**
 * Base64 of the font, or '' if we couldn't get it. Never rejects. Worst case
 * the window falls back to a system stack, which is ugly but not broken.
 */
export async function gameFontBase64(): Promise<string> {
  if (cached !== null) return cached;

  // Disk first, which also means it works offline after one success.
  try {
    const bytes = readFileSync(cachePath());
    if (bytes.length >= MIN_PLAUSIBLE_BYTES) {
      cached = bytes.toString('base64');
      return cached;
    }
  } catch {
    // Not cached yet.
  }

  try {
    const response = await net.fetch(FONT_URL);
    if (!response.ok) return '';
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < MIN_PLAUSIBLE_BYTES) return '';

    try {
      writeFileSync(cachePath(), bytes);
    } catch {
      // Couldn't cache it. Still fine for this session.
    }
    cached = bytes.toString('base64');
    return cached;
  } catch {
    return '';
  }
}

/** A `@font-face` block, or a comment when the font could not be loaded. */
export function gameFontFace(base64: string): string {
  if (base64 === '') return '/* GameFont unavailable; using the fallback stack */';
  return `@font-face{font-family:'GameFont';src:url(data:font/ttf;base64,${base64}) format('truetype');font-display:block}`;
}
