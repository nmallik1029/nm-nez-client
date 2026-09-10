import type { ThemeFile } from '../shared/ipc';

/**
 * CSS themes. One active at a time, swapped instantly.
 *
 * The text is cached in memory from startup, so picking a different theme is
 * one `textContent` assignment on one `<style>` element. No disk read, no IPC,
 * no reload, which is the whole reason to do this in the renderer instead of
 * making anyone restart.
 *
 * The element goes last in `document.head` and is re-appended on every change,
 * so a theme beats Krunker's own stylesheets instead of losing to them on
 * equal specificity.
 */
const ELEMENT_ID = 'kc-active-theme';

let cache: ThemeFile[] = [];
let activeName = '';
let element: HTMLStyleElement | null = null;

/** Themes currently on disk, in alphabetical order. */
export function knownThemes(): readonly ThemeFile[] {
  return cache;
}

export function activeTheme(): string {
  return activeName;
}

/** Replace the known set, from the initial load or a file-watcher push. */
export function setThemes(themes: ThemeFile[]): void {
  cache = themes;
  render();
}

/**
 * Apply a theme by filename. Empty string clears. False means the name isn't
 * among the loaded themes, which happens when the file was deleted while it
 * was selected, so the caller can say so instead of showing nothing.
 */
export function setActiveTheme(name: string): boolean {
  activeName = name;
  render();
  return name === '' || cache.some((t) => t.name === name);
}

function render(): void {
  const theme = activeName === '' ? undefined : cache.find((t) => t.name === activeName);

  if (!theme) {
    element?.remove();
    element = null;
    return;
  }

  const head = document.head as HTMLElement | null;
  if (!head) return;

  if (!element) {
    element = document.createElement('style');
    element.id = ELEMENT_ID;
  }

  // Only reassign when the text really differs. Setting textContent forces a
  // full style recalc even for identical bytes, and the watcher fires for any
  // save in the folder.
  if (element.textContent !== theme.css) element.textContent = theme.css;

  // Re-append so we stay last in the cascade even if Krunker has added
  // stylesheets since.
  head.appendChild(element);
}
