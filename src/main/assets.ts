import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import type { UserscriptInfo } from '../shared/ipc';

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
 * The bundled copy is the point: someone who installs the client should
 * hear it without having to find a folder first. `swap/sounds` stays as an
 * override so anyone who wants their own is not stuck with ours.
 *
 * `app.getAppPath()` is the repo root in development and the asar in a
 * package, so one path covers both.
 */
export function loadMatchSound(soundsDir: string, bundledDir: string): string | null {
  return readSound(join(soundsDir, MATCH_SOUND_FILE)) ?? readSound(join(bundledDir, MATCH_SOUND_FILE));
}

/**
 * The two menu screenshots the walkthrough shows beside its look choices.
 *
 * Captured from the running client rather than drawn, because the point of
 * them is to answer "what will this actually do to my menu" before the
 * answer costs anything. 768x432 each, which is a quarter of the pixels of
 * a 1080p grab and still legible at the size the cards give them.
 *
 * Bundled only. There is no swap override the way the match sound has one:
 * a screenshot of our own menu is a fact about the client, not a
 * preference, and one that someone had replaced would be a walkthrough
 * quietly lying about what it is offering.
 *
 * Null when a file is missing. The cards then show their text alone, which
 * is exactly what they showed before the pictures existed.
 */
const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;

export interface LookPreviews {
  /** With the menu skin on. */
  readonly nmnz: string | null;
  /** With it off, i.e. the game as it ships. */
  readonly krunker: string | null;
}

function readPreview(full: string): string | null {
  try {
    if (statSync(full).size > MAX_PREVIEW_BYTES) return null;
    return `data:image/png;base64,${readFileSync(full).toString('base64')}`;
  } catch {
    // Not there, or unreadable.
    return null;
  }
}

export function loadLookPreviews(bundledDir: string): LookPreviews {
  return {
    nmnz: readPreview(join(bundledDir, 'look-nmnz.png')),
    krunker: readPreview(join(bundledDir, 'look-krunker.png')),
  };
}

/**
 * The files in the scripts folder we are willing to run, in load order.
 *
 * Sorted, so that order is the same on every machine instead of whatever the
 * filesystem feels like. Anything oversized, unreadable or not a `.js` is
 * left out here rather than at each call site.
 */
function scriptFiles(scriptsDir: string): { name: string; full: string; bytes: number }[] {
  let entries: string[];
  try {
    entries = readdirSync(scriptsDir);
  } catch {
    return [];
  }

  const out: { name: string; full: string; bytes: number }[] = [];
  for (const name of entries.sort()) {
    if (out.length >= MAX_FILES) break;
    if (extname(name).toLowerCase() !== '.js') continue;

    const full = join(scriptsDir, name);
    try {
      const { size } = statSync(full);
      if (size > MAX_FILE_BYTES) continue;
      out.push({ name, full, bytes: size });
    } catch {
      // Unreadable file. Skip it instead of failing the whole load.
    }
  }
  return out;
}

/** All `.js` in the scripts folder, with their text. */
export function loadUserscripts(scriptsDir: string): Userscript[] {
  const out: Userscript[] = [];
  for (const file of scriptFiles(scriptsDir)) {
    try {
      const source = readFileSync(file.full, 'utf8');
      out.push({ name: file.name, source, title: parseScriptName(source) ?? file.name });
    } catch {
      // Readable a moment ago, not now. Skip it rather than fail the load.
    }
  }
  return out;
}

/**
 * The same files, as a list to look at rather than a list to run.
 *
 * Still reads each one, because the title comes out of the file. Only the
 * first couple of kilobytes of it are needed and none of it is kept, which
 * is the difference between this and `loadUserscripts`: that one answers
 * with every byte of every script over IPC, and the panel is drawing names.
 */
export function listUserscripts(scriptsDir: string): UserscriptInfo[] {
  return scriptFiles(scriptsDir).map((file) => ({
    name: file.name,
    title: scriptTitle(file.full) ?? file.name,
    bytes: file.bytes,
  }));
}

function scriptTitle(full: string): string | null {
  try {
    return parseScriptName(readFileSync(full, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Is this a plain filename we are willing to write into the scripts folder?
 *
 * The name arrives from the page, which runs at the game's origin alongside
 * whatever userscripts are already enabled, so it is not to be trusted with
 * a path. Everything that could make one is refused rather than stripped:
 * a name that has been quietly rewritten is a file somewhere the person who
 * dropped it is not looking.
 *
 * Windows reserves a few device names (CON, NUL, COM1) whatever the
 * extension, and those are refused too. Writing to one of them does not
 * write a file at all.
 */
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

export function isScriptFileName(name: string): boolean {
  if (name === '' || name.length > 120) return false;
  // Any separator, drive letter or wildcard. basename() alone is not enough:
  // on POSIX a backslash is an ordinary character in a filename, and this has
  // to answer the same way wherever it runs.
  if (/[\\/:*?"<>|]/.test(name)) return false;
  if (name !== basename(name)) return false;
  // Leading dots hide the file and "." and ".." are not names at all.
  if (name.startsWith('.')) return false;
  if (RESERVED_NAMES.test(name)) return false;
  return extname(name).toLowerCase() === '.js';
}

/** Why a save was refused, or 'ok'. */
export type SaveProblem = 'ok' | 'name' | 'size' | 'write';

/**
 * Write one dropped file into the scripts folder, replacing a file of the
 * same name.
 *
 * Replacing rather than refusing, because the ordinary reason to drop a
 * script you already have is that you have a newer copy of it, and the
 * alternative is asking someone to go and delete the old one first.
 */
export function saveUserscript(scriptsDir: string, name: string, source: string): SaveProblem {
  if (!isScriptFileName(name)) return 'name';
  if (Buffer.byteLength(source, 'utf8') > MAX_FILE_BYTES) return 'size';

  try {
    mkdirSync(scriptsDir, { recursive: true });
    writeFileSync(join(scriptsDir, name), source, 'utf8');
    return 'ok';
  } catch {
    return 'write';
  }
}

/** Delete one file from the scripts folder. False if it is still there. */
export function removeUserscript(scriptsDir: string, name: string): boolean {
  if (!isScriptFileName(name)) return false;
  try {
    rmSync(join(scriptsDir, name));
    return true;
  } catch {
    // Already gone, or locked by something. Either way nothing to report
    // beyond the list the caller is about to re-read.
    return false;
  }
}

/** Pull `@name` out of a metadata block, if there is one. */
function parseScriptName(source: string): string | null {
  // Head of the file only. A metadata block is always at the top and there's
  // no sense regexing megabytes of minified script.
  const head = source.slice(0, 2000);
  const match = /^\s*\/\/\s*@name\s+(.+)$/m.exec(head);
  return match?.[1]?.trim() || null;
}
