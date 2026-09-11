import { STYLE_IDS, TOKENS_CSS } from '../shared/ui';

/**
 * One way to get a stylesheet into the page.
 *
 * Every surface used to carry its own copy of "make a `<style>`, give it an
 * id, check it isn't already there, append it to head": six of them, and two
 * appended to `documentElement` instead, which quietly put those rules *after*
 * the active theme in tree order and made them the one thing a theme couldn't
 * restyle. Going through here means the cascade has a single shape:
 *
 *   head: [tokens] [component styles, in definition order] ... [active theme]
 *
 * The theme is re-appended on every change (`themes.ts`) so it stays last and
 * wins on equal specificity. That ordering is what lets a theme override a
 * token, so it is worth not breaking.
 *
 * A preload runs at document-start, where `documentElement` exists but `head`
 * often does not yet. Anything defined before then is queued and flushed in
 * definition order once the document is ready, rather than being dropped or
 * landing somewhere that reorders it.
 */

const nodes = new Map<string, HTMLStyleElement>();

let pending: HTMLStyleElement[] = [];
let flushArmed = false;

function mount(node: HTMLStyleElement): void {
  if (document.head) {
    document.head.appendChild(node);
    return;
  }

  pending.push(node);
  if (flushArmed) return;
  flushArmed = true;

  document.addEventListener(
    'DOMContentLoaded',
    () => {
      // documentElement is the fallback for a document with no head at all,
      // which shouldn't happen but shouldn't lose every stylesheet either.
      const host = document.head ?? document.documentElement;
      for (const queued of pending) host.appendChild(queued);
      pending = [];
    },
    { once: true },
  );
}

/**
 * Install `css` under `id`, or update it in place if that id is already up.
 *
 * Idempotent, so a caller that runs again on a re-render doesn't stack
 * duplicates. Text is only reassigned when it actually differs: setting
 * `textContent` forces a full style recalc even for identical bytes.
 */
export function defineStyle(id: string, css: string): void {
  const existing = nodes.get(id);
  if (existing) {
    if (existing.textContent !== css) existing.textContent = css;
    return;
  }

  const node = document.createElement('style');
  node.id = id;
  node.textContent = css;
  nodes.set(id, node);
  mount(node);
}

/** Drop a stylesheet installed by `defineStyle`. No-op if it isn't up. */
export function removeStyle(id: string): void {
  const node = nodes.get(id);
  if (!node) return;
  nodes.delete(id);
  pending = pending.filter((queued) => queued !== node);
  node.remove();
}

/** `defineStyle` when `on`, `removeStyle` when not. For a toggleable feature. */
export function toggleStyle(id: string, css: string, on: boolean): void {
  if (on) defineStyle(id, css);
  else removeStyle(id);
}

/**
 * Put the tokens in first, so every `var()` is resolvable by the time any
 * component stylesheet lands.
 *
 * Called at module scope from the preload entry rather than from inside its
 * async bootstrap, which starts with an `await` and so could otherwise resume
 * after another surface had already defined its styles.
 */
export function installTokens(): void {
  defineStyle(STYLE_IDS.tokens, TOKENS_CSS);
}
