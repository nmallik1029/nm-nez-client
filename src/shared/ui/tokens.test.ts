import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOKENS_CSS } from './tokens';

/**
 * The guard that keeps one token set from turning back into nine stylesheets
 * with their own opinions.
 *
 * A stylesheet is a string here, so nothing at build time notices a stray
 * `#1b1d22`, a `font-size:13px` that should have been a scale step, or a
 * `var(--nm-acccent)` typo. The first two quietly fork the design; the third
 * renders nothing at all, because a `var()` with no definition makes the
 * browser drop the whole declaration. These checks are what make all of it
 * loud, and they are the reason the tokens stay worth having.
 *
 * Deliberately a source scan rather than a DOM assertion: it has to cover the
 * queue window's HTML, which is built in the main process and never mounted in
 * a test.
 *
 * What is *not* guarded, on purpose: padding, margin, and element width and
 * height. Those are mostly one-off geometry, `width:38px` on the queue button
 * is a fact about that button, not a design decision, and a rule forcing them
 * onto a scale would push the code towards a sixteen-step lookup table that
 * reads worse than the numbers it replaced.
 */

const SRC = join(import.meta.dirname, '..', '..');
/** The one file allowed to hold a raw design value. */
const TOKENS_FILE = join(SRC, 'shared', 'ui', 'tokens.ts');
/**
 * Files holding colours that are data rather than design.
 *
 * `highlights.ts` is a list of friends and clans with the colour each should
 * be drawn in. Those are not values on a scale and they do not belong in the
 * token set: a token per person is not a design system, it is a phone book.
 * Exempt from the colour rule only: the rest still apply.
 */
const COLOUR_DATA_FILES = new Set([join(SRC, 'shared', 'highlights.ts')]);

/** Each rule: what to look for, and what to say when it turns up. */
const BANNED: { what: string; pattern: RegExp; fix: string }[] = [
  {
    what: 'colour',
    pattern: /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/g,
    fix: 'add it to tokens.ts and reference it, or export it as a string constant if JS needs it',
  },
  {
    what: 'font size',
    pattern: /font-size:\s*[0-9.]+(px|em|rem)/g,
    fix: 'use a --nm-fs-* step',
  },
  {
    what: 'z-index',
    pattern: /z-index:\s*[0-9]+/g,
    fix: 'use a --nm-z-* layer, so the next overlay is not a guess',
  },
  {
    what: 'border weight',
    pattern: /border(-(top|right|bottom|left))?:\s*[0-9.]+px\s+solid/g,
    fix: 'use --nm-bw, --nm-bw-thick or --nm-bw-heavy',
  },
  {
    what: 'letter spacing',
    pattern: /letter-spacing:\s*[0-9.]+em/g,
    fix: 'use a --nm-track-* step',
  },
  {
    // The update panel arrived with .16s, .12s and .2s written out, because
    // nothing here was looking. One transition that outlasts its neighbours is
    // the sort of thing you feel and can't find.
    what: 'transition duration',
    pattern: /(transition|animation)(-duration)?:[^;}`]*?\b(\d*\.?\d+m?s)/g,
    fix: 'use --nm-fast, --nm-quick, --nm-med, --nm-slow, or a named --nm-scan-* step',
  },
  {
    // Integers are allowed: `line-height:0` and `line-height:1` are layout
    // facts (a tag that must not add height, a timer set solid), not steps on
    // a scale.
    what: 'line height',
    pattern: /line-height:\s*\d+\.\d+/g,
    fix: 'use --nm-lh-tight, --nm-lh or --nm-lh-loose',
  },
];

/** `var(--nm-…)` references. */
const TOKEN_USE = /var\(\s*(--nm-[a-z0-9-]+)/g;

/** `--nm-…:` definitions. */
const TOKEN_DEF = /(--nm-[a-z0-9-]+)\s*:/g;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (extname(name) !== '.ts' || name.endsWith('.test.ts')) continue;
    out.push(full);
  }
  return out;
}

const FILES = sourceFiles(SRC);

function matches(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(new RegExp(pattern))].map((m) => m[1] ?? m[0]);
}

/** Comments explain rules by quoting values; only real declarations count. */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('design tokens', () => {
  it('scans a source tree it actually found', () => {
    // Without this the checks below pass trivially on an empty list, which is
    // exactly the failure mode a guard like this is prone to.
    expect(FILES.length).toBeGreaterThan(30);
  });

  it.each(BANNED)('has no $what outside tokens.ts', ({ what, pattern, fix }) => {
    const exempt = (file: string): boolean =>
      file === TOKENS_FILE || (what === 'colour' && COLOUR_DATA_FILES.has(file));

    const offenders = FILES.filter((file) => !exempt(file))
      .map((file) => ({ file, found: matches(withoutComments(readFileSync(file, 'utf8')), pattern) }))
      .filter((entry) => entry.found.length > 0)
      .map((entry) => `${relative(SRC, entry.file)}: ${entry.found.join(', ')}, ${fix}`);

    expect(offenders).toEqual([]);
  });

  it('defines every token the stylesheets reference', () => {
    const defined = new Set(matches(TOKENS_CSS, TOKEN_DEF));

    const missing = new Set<string>();
    for (const file of FILES) {
      for (const token of matches(withoutComments(readFileSync(file, 'utf8')), TOKEN_USE)) {
        if (!defined.has(token)) missing.add(`${relative(SRC, file)}: ${token}`);
      }
    }

    // A var() with no definition drops the declaration it is in, so a typo
    // here is invisible until someone looks at the screen.
    expect([...missing].sort()).toEqual([]);
  });

  it('has no token nothing uses', () => {
    const used = new Set<string>();
    for (const file of FILES) {
      for (const token of matches(withoutComments(readFileSync(file, 'utf8')), TOKEN_USE)) {
        used.add(token);
      }
    }

    const orphans = matches(TOKENS_CSS, TOKEN_DEF)
      .filter((token) => !used.has(token))
      .sort();

    expect(orphans).toEqual([]);
  });
});
