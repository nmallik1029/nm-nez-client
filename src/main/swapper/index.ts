import { readdirSync } from 'node:fs';
import { join, posix, sep } from 'node:path';

/**
 * Resource swapper: serve a local file in place of a game asset.
 *
 * Two ways to match. An exact path (`swap/textures/wall.png` for
 * `/textures/wall.png`) is unambiguous and always wins. A bare filename
 * (`swap/wall.png`) matches any asset with that basename, which is what people
 * mean when they drop one texture in, but it can obviously collide. Collisions
 * go to the alphabetically first path rather than whatever the directory scan
 * happened to hit last.
 *
 * Subfolders belonging to other features aren't assets, so they're skipped.
 */
export const RESERVED_SUBDIRS: readonly string[] = ['themes', 'scripts', 'backgrounds'];

/** Files we will never serve, regardless of where they sit in the swap tree. */
const IGNORED_FILES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini']);

export interface SwapFile {
  /** Path relative to the swap root, POSIX-separated and lowercased. */
  readonly relative: string;
  /** Absolute path on disk. */
  readonly absolute: string;
}

export interface SwapIndex {
  readonly byPath: ReadonlyMap<string, string>;
  readonly byName: ReadonlyMap<string, string>;
  readonly size: number;
}

export const EMPTY_SWAP_INDEX: SwapIndex = {
  byPath: new Map(),
  byName: new Map(),
  size: 0,
};

export function buildSwapIndex(files: readonly SwapFile[]): SwapIndex {
  const byPath = new Map<string, string>();
  const byName = new Map<string, string>();

  // Sorted, so basename collisions land the same way on every machine.
  const sorted = [...files].sort((a, b) => a.relative.localeCompare(b.relative));

  for (const file of sorted) {
    if (byPath.has(file.relative)) continue;
    byPath.set(file.relative, file.absolute);

    const name = posix.basename(file.relative);
    // First writer wins, i.e. the shallowest alphabetically-first path.
    if (!byName.has(name)) byName.set(name, file.absolute);
  }

  return { byPath, byName, size: byPath.size };
}

/**
 * Resolve a request URL to a local file, or null.
 *
 * `toUrl` turns an absolute path into something the renderer can fetch. It's
 * injected to keep this testable and to keep the protocol scheme in one place.
 */
export function resolveSwapUrl(
  requestUrl: string,
  index: SwapIndex,
  toUrl: (absolutePath: string) => string,
): string | null {
  if (index.size === 0) return null;

  let pathname: string;
  try {
    pathname = new URL(requestUrl).pathname;
  } catch {
    return null;
  }

  const key = decodeURIComponentSafe(pathname.replace(/^\/+/, '')).toLowerCase();
  if (key === '') return null;

  const exact = index.byPath.get(key);
  if (exact !== undefined) return toUrl(exact);

  const byName = index.byName.get(posix.basename(key));
  return byName === undefined ? null : toUrl(byName);
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    // A malformed percent-escape isn't worth throwing over.
    return value;
  }
}

/** Walk the swap folder. Empty list if it isn't there. */
export function scanSwapDir(root: string): SwapFile[] {
  const out: SwapFile[] = [];

  const walk = (dir: string, prefix: string, depth: number): void => {
    // Depth guard. A symlink loop in a folder the user controls shouldn't be
    // able to hang startup.
    if (depth > 12) return;

    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const name = entry.name;
      if (name.startsWith('.')) continue;

      const rel = prefix === '' ? name : `${prefix}/${name}`;

      if (entry.isDirectory()) {
        if (depth === 0 && RESERVED_SUBDIRS.includes(name.toLowerCase())) continue;
        walk(join(dir, name), rel, depth + 1);
      } else if (entry.isFile()) {
        if (IGNORED_FILES.has(name.toLowerCase())) continue;
        out.push({
          relative: rel.split(sep).join('/').toLowerCase(),
          absolute: join(dir, name),
        });
      }
    }
  };

  walk(root, '', 0);
  return out;
}
