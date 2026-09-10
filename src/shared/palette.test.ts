import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PALETTE_CSS } from './palette';

/**
 * The guard that keeps one palette from turning back into nine.
 *
 * A stylesheet is a string here, so nothing at build time notices a stray
 * `#1b1d22` or a `var(--nm-acccent)` typo — the first quietly forks the palette
 * and the second silently renders nothing at all. These three checks are what
 * make both loud, and they are the reason the tokens stay worth having.
 *
 * Deliberately a source scan rather than a DOM assertion: it has to cover the
 * queue window's HTML, which is built in the main process and never mounted in
 * a test.
 */

const SRC = join(import.meta.dirname, '..');
/** The one file allowed to hold a colour. */
const PALETTE_FILE = join(SRC, 'shared', 'palette.ts');

/** Hex colours, plus `rgb()`/`rgba()` with a numeric first channel. */
const COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/g;

/** `var(--nm-…)` references. */
const TOKEN_USE = /var\(\s*(--nm-[a-z0-9-]+)/g;

/** `--nm-…:` definitions inside the palette block. */
const TOKEN_DEF = /(--nm-[a-z0-9-]+)\s*:/g;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (extname(name) !== '.ts') continue;
    if (name.endsWith('.test.ts')) continue;
    out.push(full);
  }
  return out;
}

const FILES = sourceFiles(SRC);

function matches(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(new RegExp(pattern))].map((m) => m[1] ?? m[0]);
}

describe('palette', () => {
  it('scans a source tree it actually found', () => {
    // Without this the two checks below pass trivially on an empty list, which
    // is exactly the failure mode a guard like this is prone to.
    expect(FILES.length).toBeGreaterThan(30);
  });

  it('is the only file with a colour literal in it', () => {
    const offenders = FILES.filter((file) => file !== PALETTE_FILE)
      .map((file) => ({ file, found: matches(readFileSync(file, 'utf8'), COLOUR) }))
      .filter((entry) => entry.found.length > 0)
      .map((entry) => `${relative(SRC, entry.file)}: ${entry.found.join(', ')}`);

    // Put it in palette.ts and reference it as a token, or export it as a
    // string constant if it has to be readable from JS.
    expect(offenders).toEqual([]);
  });

  it('defines every token the stylesheets reference', () => {
    const defined = new Set(matches(PALETTE_CSS, TOKEN_DEF));

    const missing = new Set<string>();
    for (const file of FILES) {
      for (const token of matches(readFileSync(file, 'utf8'), TOKEN_USE)) {
        if (!defined.has(token)) missing.add(`${relative(SRC, file)}: ${token}`);
      }
    }

    // A var() with no definition resolves to nothing and the property is
    // dropped, so a typo here is invisible until someone looks at the screen.
    expect([...missing].sort()).toEqual([]);
  });

  it('has no token nothing uses', () => {
    const used = new Set<string>();
    for (const file of FILES) {
      for (const token of matches(readFileSync(file, 'utf8'), TOKEN_USE)) used.add(token);
    }

    const orphans = matches(PALETTE_CSS, TOKEN_DEF)
      .filter((token) => !used.has(token))
      .sort();

    expect(orphans).toEqual([]);
  });
});
