import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

/**
 * Userscripts. CSS themes are in `themes.ts` instead, because those can be
 * watched and hot-swapped and a script that has already run can't be un-run.
 *
 * Size and count are both capped. Someone dropping a 200MB file in the scripts
 * folder shouldn't wedge startup, and nor should a folder with ten thousand
 * files in it.
 */
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 64;

export interface Userscript {
  readonly name: string;
  readonly source: string;
  /** From a Tampermonkey-style `@name` header, falling back to the filename. */
  readonly title: string;
}

/** All `.js` in the scripts folder. */
export function loadUserscripts(scriptsDir: string): Userscript[] {
  let entries: string[];
  try {
    entries = readdirSync(scriptsDir);
  } catch {
    return [];
  }

  const out: Userscript[] = [];
  // Sorted, so load order is the same on every machine instead of whatever
  // the filesystem feels like.
  for (const name of entries.sort()) {
    if (out.length >= MAX_FILES) break;
    if (extname(name).toLowerCase() !== '.js') continue;

    const full = join(scriptsDir, name);
    try {
      if (statSync(full).size > MAX_FILE_BYTES) continue;
      const source = readFileSync(full, 'utf8');
      out.push({ name, source, title: parseScriptName(source) ?? name });
    } catch {
      // Unreadable file. Skip it instead of failing the whole load.
    }
  }
  return out;
}

/** Pull `@name` out of a metadata block, if there is one. */
function parseScriptName(source: string): string | null {
  // Head of the file only. A metadata block is always at the top and there's
  // no sense regexing megabytes of minified script.
  const head = source.slice(0, 2000);
  const match = /^\s*\/\/\s*@name\s+(.+)$/m.exec(head);
  return match?.[1]?.trim() || null;
}
