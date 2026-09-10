import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildSwapIndex,
  EMPTY_SWAP_INDEX,
  resolveSwapUrl,
  scanSwapDir,
  type SwapFile,
} from './index';

const toUrl = (abs: string) => `swap://${abs}`;
const files = (...pairs: [string, string][]): SwapFile[] =>
  pairs.map(([relative, absolute]) => ({ relative, absolute }));

describe('buildSwapIndex', () => {
  it('indexes by full path and by basename', () => {
    const index = buildSwapIndex(files(['textures/wall.png', '/abs/wall.png']));
    expect(index.byPath.get('textures/wall.png')).toBe('/abs/wall.png');
    expect(index.byName.get('wall.png')).toBe('/abs/wall.png');
    expect(index.size).toBe(1);
  });

  it('resolves basename collisions deterministically, not by scan order', () => {
    const forward = buildSwapIndex(files(['a/x.png', '/abs/a.png'], ['b/x.png', '/abs/b.png']));
    const reverse = buildSwapIndex(files(['b/x.png', '/abs/b.png'], ['a/x.png', '/abs/a.png']));
    expect(forward.byName.get('x.png')).toBe(reverse.byName.get('x.png'));
    expect(forward.byName.get('x.png')).toBe('/abs/a.png');
  });
});

describe('resolveSwapUrl', () => {
  const index = buildSwapIndex(
    files(['textures/wall.png', '/abs/textures/wall.png'], ['lone.png', '/abs/lone.png']),
  );

  it('prefers an exact path match', () => {
    expect(resolveSwapUrl('https://assets.krunker.io/textures/wall.png', index, toUrl))
      .toBe('swap:///abs/textures/wall.png');
  });

  it('falls back to a basename match', () => {
    expect(resolveSwapUrl('https://assets.krunker.io/deep/nested/lone.png', index, toUrl))
      .toBe('swap:///abs/lone.png');
  });

  it('returns null for an unmatched asset', () => {
    expect(resolveSwapUrl('https://assets.krunker.io/nope.png', index, toUrl)).toBeNull();
  });

  it('matches case-insensitively', () => {
    expect(resolveSwapUrl('https://assets.krunker.io/Textures/WALL.png', index, toUrl))
      .toBe('swap:///abs/textures/wall.png');
  });

  it('decodes percent-escapes before matching', () => {
    const spaced = buildSwapIndex(files(['my file.png', '/abs/my file.png']));
    expect(resolveSwapUrl('https://assets.krunker.io/my%20file.png', spaced, toUrl))
      .toBe('swap:///abs/my file.png');
  });

  it('short-circuits on an empty index', () => {
    expect(resolveSwapUrl('https://assets.krunker.io/x.png', EMPTY_SWAP_INDEX, toUrl)).toBeNull();
  });

  it('ignores a bare origin with no path', () => {
    expect(resolveSwapUrl('https://krunker.io/', index, toUrl)).toBeNull();
  });

  it('survives a malformed URL and a malformed escape', () => {
    expect(resolveSwapUrl('not a url', index, toUrl)).toBeNull();
    expect(() => resolveSwapUrl('https://krunker.io/%E0%A4%A', index, toUrl)).not.toThrow();
  });
});

describe('scanSwapDir', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'swap-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const write = (rel: string) => {
    const full = join(root, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, 'x');
  };

  it('returns an empty list for a missing directory', () => {
    expect(scanSwapDir(join(root, 'nope'))).toEqual([]);
  });

  it('walks nested asset folders', () => {
    write('textures/wall.png');
    write('sounds/shot.mp3');
    expect(scanSwapDir(root).map((f) => f.relative).sort())
      .toEqual(['sounds/shot.mp3', 'textures/wall.png']);
  });

  it('skips folders owned by other features', () => {
    // themes/scripts/backgrounds are separate systems. Serving them as game
    // assets would be wrong and would leak userscript source to the page.
    write('themes/dark.css');
    write('scripts/thing.js');
    write('backgrounds/bg.png');
    write('keep.png');
    expect(scanSwapDir(root).map((f) => f.relative)).toEqual(['keep.png']);
  });

  it('only skips reserved names at the top level', () => {
    write('textures/themes/pattern.png');
    expect(scanSwapDir(root).map((f) => f.relative)).toEqual(['textures/themes/pattern.png']);
  });

  it('ignores dotfiles and OS junk', () => {
    write('.hidden.png');
    write('Thumbs.db');
    write('real.png');
    expect(scanSwapDir(root).map((f) => f.relative)).toEqual(['real.png']);
  });

  it('lowercases relative paths so lookups are case-insensitive', () => {
    write('Textures/Wall.PNG');
    expect(scanSwapDir(root)[0]?.relative).toBe('textures/wall.png');
  });
});
