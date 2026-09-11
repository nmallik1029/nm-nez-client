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

/**
 * The sound played when the ranked queue finds a match.
 *
 * Read here and handed over as a data URL rather than served from disk,
 * because the page has no business reading the user's filesystem and the one
 * file involved is small. `MAX_SOUND_BYTES` is the cap; anything larger is
 * ignored rather than truncated, since half an mp3 is not a sound.
 *
 * Null when there is no file, which is the normal case. The queue is silent
 * until someone drops one in.
 */
const MAX_SOUND_BYTES = 4 * 1024 * 1024;
export const MATCH_SOUND_FILE = 'match-found.mp3';

function readSound(full: string): string | null {
  try {
    if (statSync(full).size > MAX_SOUND_BYTES) return null;
    return `data:audio/mpeg;base64,${readFileSync(full).toString('base64')}`;
  } catch {
    // Not there, or unreadable.
    return null;
  }
}

/**
 * The match sound: the user's if they have one, otherwise the shipped one.
 *
 * The bundled copy is the point — someone who installs the client should
 * hear it without having to find a folder first. `swap/sounds` stays as an
 * override so anyone who wants their own is not stuck with ours.
 *
 * `app.getAppPath()` is the repo root in development and the asar in a
 * package, so one path covers both.
 */
export function loadMatchSound(soundsDir: string, bundledDir: string): string | null {
  return readSound(join(soundsDir, MATCH_SOUND_FILE)) ?? readSound(join(bundledDir, MATCH_SOUND_FILE));
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
