import { describe, expect, it } from 'vitest';
import {
  colorToInt,
  DEFAULT_VISUALS,
  MARKER_LIMITS,
  MAX_IMAGE_CHARS,
  markerGeometry,
  normaliseMarker,
  normaliseVisuals,
  type MarkerSpec,
} from './visuals';

/**
 * Two things are worth testing here and the rest is canvas calls.
 *
 * The geometry, because it is arithmetic that decides whether a crosshair is
 * centred, and a crosshair that is one pixel off centre is a crosshair that
 * is wrong in the only way that matters.
 *
 * The clamping, because everything it reads is untrusted: an old config with
 * whole objects missing, and page script, which runs at the game's origin and
 * can patch the config through the same channel the panel does. A number out
 * of range here is a canvas of that many pixels.
 */

const CROSS: MarkerSpec = {
  shape: 'cross',
  length: 8,
  thickness: 2,
  gap: 4,
  dot: 0,
  outline: 1,
  color: '#00ff88',
  opacity: 1,
};

describe('markerGeometry', () => {
  it('centres every arm on the canvas', () => {
    const geometry = markerGeometry(CROSS);
    for (const line of geometry.lines) {
      // One end of each arm is on a centre line; that is what makes it an arm
      // of this crosshair rather than a stroke near it.
      expect(line.x1 === geometry.centre || line.y1 === geometry.centre).toBe(true);
    }
  });

  it('leaves room for the stroke and the outline', () => {
    const geometry = markerGeometry(CROSS);
    const reach = CROSS.gap + CROSS.length;
    const furthest = Math.max(
      ...geometry.lines.map((line) =>
        Math.max(
          Math.abs(line.x2 - geometry.centre),
          Math.abs(line.y2 - geometry.centre),
        ),
      ),
    );

    expect(furthest).toBe(reach);
    // Half the stroke plus the outline has to fit past the tip, or the canvas
    // clips the end of every arm.
    expect(geometry.size / 2).toBeGreaterThanOrEqual(
      reach + CROSS.thickness / 2 + CROSS.outline,
    );
  });

  it('draws four arms for a cross and an X, three for a T', () => {
    expect(markerGeometry(CROSS).lines).toHaveLength(4);
    expect(markerGeometry({ ...CROSS, shape: 'x' }).lines).toHaveLength(4);
    expect(markerGeometry({ ...CROSS, shape: 't' }).lines).toHaveLength(3);
  });

  it('leaves the T open at the top, where you are aiming', () => {
    const geometry = markerGeometry({ ...CROSS, shape: 't' });
    const above = geometry.lines.filter((line) => line.y2 < geometry.centre);
    expect(above).toEqual([]);
  });

  it('puts the X on the diagonals, the same distance out as a cross', () => {
    const geometry = markerGeometry({ ...CROSS, shape: 'x' });
    for (const line of geometry.lines) {
      const dx = Math.abs(line.x2 - geometry.centre);
      const dy = Math.abs(line.y2 - geometry.centre);
      expect(dx).toBeCloseTo(dy, 6);
      expect(Math.hypot(dx, dy)).toBeCloseTo(CROSS.gap + CROSS.length, 6);
    }
  });

  it('draws nothing but a dot when the arms have no length', () => {
    const geometry = markerGeometry({ ...CROSS, length: 0, dot: 3 });
    // Zero-length arms would still paint a stub of the stroke at each end,
    // which reads as a dotted box rather than as nothing.
    expect(geometry.lines).toEqual([]);
    expect(geometry.dot).toBe(3);
  });

  it('sizes a circle from its radius and a dot from its diameter', () => {
    const circle = markerGeometry({ ...CROSS, shape: 'circle', length: 10 });
    expect(circle.ring).toBe(10);
    expect(circle.lines).toEqual([]);
    expect(circle.size / 2).toBeGreaterThanOrEqual(10 + CROSS.thickness / 2 + CROSS.outline);

    const dot = markerGeometry({ ...CROSS, shape: 'dot', dot: 6 });
    expect(dot.dot).toBe(6);
    expect(dot.size).toBeGreaterThanOrEqual(6 + 2 * CROSS.outline);
  });

  it('never returns a canvas too small to draw on', () => {
    const geometry = markerGeometry({
      ...CROSS,
      length: 0,
      gap: 0,
      dot: 0,
      outline: 0,
      thickness: 1,
    });
    expect(geometry.size).toBeGreaterThanOrEqual(4);
  });
});

describe('colorToInt', () => {
  it('packs a colour the way a map file writes it', () => {
    // Both of these are off the live game: map 14 gives its sky as the hex,
    // map 2 gives the same colour as this number.
    expect(colorToInt('#dce8ed')).toBe(14477549);
    expect(colorToInt('#000000')).toBe(0);
    expect(colorToInt('#ffffff')).toBe(16777215);
  });
});

describe('normaliseMarker', () => {
  it('holds every number inside its range', () => {
    const wild = normaliseMarker(
      { ...CROSS, length: 5000, thickness: -3, gap: Number.NaN, opacity: 12 },
      CROSS,
    );
    expect(wild.length).toBe(MARKER_LIMITS.length.max);
    expect(wild.thickness).toBe(MARKER_LIMITS.thickness.min);
    // Not a number at all, so the value that was already good stands.
    expect(wild.gap).toBe(CROSS.gap);
    expect(wild.opacity).toBe(MARKER_LIMITS.opacity.max);
  });

  it('keeps a colour only if it is one', () => {
    expect(normaliseMarker({ ...CROSS, color: '#ABCDEF' }, CROSS).color).toBe('#abcdef');
    expect(normaliseMarker({ ...CROSS, color: 'red' }, CROSS).color).toBe(CROSS.color);
    expect(normaliseMarker({ ...CROSS, color: '#fff' }, CROSS).color).toBe(CROSS.color);
    expect(
      normaliseMarker({ ...CROSS, color: 'url(https://evil.example/x)' }, CROSS).color,
    ).toBe(CROSS.color);
  });

  it('falls back on a shape it has never heard of', () => {
    expect(normaliseMarker({ ...CROSS, shape: 'spiral' }, CROSS).shape).toBe('cross');
  });
});

describe('normaliseVisuals', () => {
  it('fills in a section an older config never had', () => {
    expect(normaliseVisuals(undefined)).toEqual(DEFAULT_VISUALS);
    expect(normaliseVisuals({ sky: { on: true } }).crosshair).toEqual(
      DEFAULT_VISUALS.crosshair,
    );
  });

  it('keeps an image only when it is inline image data', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    expect(normaliseVisuals({ crosshair: { image: png } }).crosshair.image).toBe(png);

    // Everything below would be a request the client makes on behalf of
    // whoever wrote the config, which is the exact thing this feature exists
    // to stop being possible.
    for (const bad of [
      'https://cdn.discordapp.com/x.png',
      'javascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      'data:image/svg+xml;base64,PHN2Zz4=',
    ]) {
      expect(normaliseVisuals({ crosshair: { image: bad } }).crosshair.image).toBe('');
    }
  });

  it('refuses an image too big to keep in the config', () => {
    const huge = `data:image/png;base64,${'A'.repeat(MAX_IMAGE_CHARS)}`;
    expect(normaliseVisuals({ hitmarker: { image: huge } }).hitmarker.image).toBe('');
  });

  it('only treats true as on', () => {
    const visuals = normaliseVisuals({
      sky: { on: 'yes' },
      crosshair: { on: 1 },
      hitmarker: { on: true },
    });
    expect(visuals.sky.on).toBe(false);
    expect(visuals.crosshair.on).toBe(false);
    expect(visuals.hitmarker.on).toBe(true);
  });

  it('holds the hitmarker offsets on screen', () => {
    const visuals = normaliseVisuals({ hitmarker: { offsetX: 99999, offsetY: -99999 } });
    expect(visuals.hitmarker.offsetX).toBe(MARKER_LIMITS.offset.max);
    expect(visuals.hitmarker.offsetY).toBe(MARKER_LIMITS.offset.min);
  });

  it('survives the shapes a hostile patch would actually take', () => {
    for (const junk of [null, 42, 'nope', [], { crosshair: null }, { sky: [] }]) {
      expect(() => normaliseVisuals(junk)).not.toThrow();
    }
    expect(normaliseVisuals({ crosshair: null }).crosshair).toEqual(DEFAULT_VISUALS.crosshair);
  });
});
