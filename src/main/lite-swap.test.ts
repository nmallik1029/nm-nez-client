import * as nodeFs from 'node:fs';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sha512, swapAsar, swapFolder, type SwapFs } from './lite-swap';

/**
 * Against real files, because what matters here is what ends up on disk: an
 * install that opens after the swap, or, when the swap cannot finish, the one
 * that was there before. Never a half-written app.
 */

let dir = '';
let paths = { live: '', staged: '', previous: '' };
const OLD = Buffer.from('the app as installed, which is longer than the update');
const NEW = Buffer.from('the update');

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'nm-swap-'));
  paths = {
    live: join(dir, 'app.asar'),
    staged: join(dir, 'app.asar.update'),
    previous: join(dir, 'app.asar.old'),
  };
  writeFileSync(paths.live, OLD);
  writeFileSync(paths.staged, NEW);
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

const realFs = nodeFs as unknown as SwapFs;

/** The fs Windows gives us when the running app holds app.asar without delete sharing. */
function heldOpen(live: string): SwapFs {
  return {
    ...realFs,
    renameSync(from: string, to: string) {
      if (from === live) throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
      nodeFs.renameSync(from, to);
    },
  };
}

describe('swapAsar', () => {
  it('renames the update into place when Windows allows it', () => {
    expect(swapAsar(realFs, paths, sha512(NEW))).toBe('renamed');
    expect(readFileSync(paths.live)).toEqual(NEW);
    expect(readFileSync(paths.previous)).toEqual(OLD);
    expect(existsSync(paths.staged)).toBe(false);
  });

  it('writes over the live file in place when it is held open', () => {
    expect(swapAsar(heldOpen(paths.live), paths, sha512(NEW))).toBe('written');
    // Exactly the update: shorter than what it replaced, so nothing of the
    // old file may be left on the end.
    expect(readFileSync(paths.live)).toEqual(NEW);
    expect(readFileSync(paths.previous)).toEqual(OLD);
    expect(existsSync(paths.staged)).toBe(false);
  });

  it('puts the old app back when the written file does not read back right', () => {
    expect(() => swapAsar(heldOpen(paths.live), paths, sha512(Buffer.from('something else')))).toThrow();
    expect(readFileSync(paths.live)).toEqual(OLD);
  });

  it('puts the old app back when the update cannot be renamed in', () => {
    const stuck: SwapFs = {
      ...realFs,
      renameSync(from: string, to: string) {
        if (from === paths.staged) throw new Error('EPERM');
        nodeFs.renameSync(from, to);
      },
    };
    expect(() => swapAsar(stuck, paths, sha512(NEW))).toThrow();
    expect(readFileSync(paths.live)).toEqual(OLD);
  });

  it('clears a backup left by an earlier update before making its own', () => {
    writeFileSync(paths.previous, 'from last time');
    swapAsar(realFs, paths, sha512(NEW));
    expect(readFileSync(paths.previous)).toEqual(OLD);
  });
});

describe('swapFolder', () => {
  const pack = (root: string, name: string, body: string): void => {
    mkdirSync(join(dir, root), { recursive: true });
    writeFileSync(join(dir, root, name), body);
  };

  it('swaps the staged folder in and keeps the old one aside', () => {
    pack('killstreak', 'a.mp3', 'old');
    pack('killstreak.update', 'a.mp3', 'new');
    expect(swapFolder(realFs, dir, 'killstreak')).toBe(true);
    expect(readFileSync(join(dir, 'killstreak', 'a.mp3'), 'utf8')).toBe('new');
    expect(readFileSync(join(dir, 'killstreak.old', 'a.mp3'), 'utf8')).toBe('old');
    expect(existsSync(join(dir, 'killstreak.update'))).toBe(false);
  });

  it('adds the folder when the install never had it', () => {
    pack('killstreak.update', 'a.mp3', 'new');
    expect(swapFolder(realFs, dir, 'killstreak')).toBe(true);
    expect(readFileSync(join(dir, 'killstreak', 'a.mp3'), 'utf8')).toBe('new');
  });

  it('does nothing when nothing was staged', () => {
    pack('killstreak', 'a.mp3', 'old');
    expect(swapFolder(realFs, dir, 'killstreak')).toBe(false);
    expect(readFileSync(join(dir, 'killstreak', 'a.mp3'), 'utf8')).toBe('old');
  });

  it('puts the old folder back when the new one cannot be moved in', () => {
    pack('killstreak', 'a.mp3', 'old');
    pack('killstreak.update', 'a.mp3', 'new');
    const stuck: SwapFs = {
      ...realFs,
      renameSync(from: string, to: string) {
        if (from.endsWith('killstreak.update')) throw new Error('EPERM');
        nodeFs.renameSync(from, to);
      },
    };
    expect(() => swapFolder(stuck, dir, 'killstreak')).toThrow();
    expect(readFileSync(join(dir, 'killstreak', 'a.mp3'), 'utf8')).toBe('old');
  });
});
