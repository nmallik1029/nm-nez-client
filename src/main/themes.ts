import { readdirSync, readFileSync, statSync, watch, type FSWatcher } from 'node:fs';
import { extname, join } from 'node:path';

/**
 * CSS themes.
 *
 * Read once at startup and handed over whole. A stylesheet is the one thing
 * here that changes with no reload at all: applying one appends a `<style>`,
 * removing it is `.remove()`. Caching the text means switching between themes
 * costs nothing, not even an IPC round trip.
 *
 * The folder is watched too, so editing a theme in an editor lands in the game
 * when you save.
 */
export interface Theme {
  readonly name: string;
  readonly css: string;
}

/** User content, so both are capped. One huge file shouldn't stall startup. */
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 64;

/** Every `.css` in `dir`. Empty list if the folder isn't there. */
export function loadThemes(dir: string): Theme[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const out: Theme[] = [];
  // Sorted, so load order (and therefore cascade order) is the same on every
  // machine instead of whatever the filesystem hands back.
  for (const name of entries.sort()) {
    if (out.length >= MAX_FILES) break;
    if (extname(name).toLowerCase() !== '.css') continue;

    const full = join(dir, name);
    try {
      if (statSync(full).size > MAX_FILE_BYTES) continue;
      out.push({ name, css: readFileSync(full, 'utf8') });
    } catch {
      // Unreadable file. Skip it instead of failing the whole load.
    }
  }
  return out;
}

/**
 * Watch `dir` and call `onChange` once things settle. Returns a disposer.
 *
 * Editors fire several events for one save (truncate, write, rename), hence
 * the debounce. `persistent: false` because watching a folder shouldn't be a
 * reason the process stays alive.
 */
export function watchThemes(dir: string, onChange: () => void, debounceMs = 150): () => void {
  let watcher: FSWatcher;
  try {
    watcher = watch(dir, { persistent: false });
  } catch {
    // Folder missing or not watchable. Themes still work, they just won't
    // hot-reload.
    return () => {};
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  watcher.on('change', schedule);
  watcher.on('rename', schedule);
  // Deleting the folder mid-session errors the watcher; don't take the app
  // down over it.
  watcher.on('error', () => {});

  function schedule(): void {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, debounceMs);
  }

  return () => {
    if (timer !== null) clearTimeout(timer);
    watcher.close();
  };
}
