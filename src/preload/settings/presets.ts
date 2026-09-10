/**
 * Hide Krunker's settings preset tiles.
 *
 * The Default / Pro / Performance / Custom grid sits above the settings and
 * overwrites them wholesale when clicked. It is a row of large tiles for a
 * thing you do approximately never, directly above the thing you came for, and
 * one misclick loses whatever you had tuned.
 *
 * Found by shape rather than by selector, because Krunker gives them no class
 * we could rely on: the tiles are located by their own labels, and the element
 * that holds the most of them is the container. That is a guess about markup we
 * do not own, so it is a guess with a floor — fewer than three tiles under one
 * parent and nothing is touched at all. Hiding the wrong element in a settings
 * panel is much worse than leaving a row of buttons up.
 *
 * Hidden rather than removed. Krunker's own code still reads and writes these
 * nodes, and deleting something the game expects to find is how a settings
 * window stops opening.
 */

/** The tiles, lowercased. All four have to be Krunker's own wording. */
const PRESET_LABELS: ReadonlySet<string> = new Set([
  'default',
  'pro',
  'performance',
  'custom',
]);

/**
 * How many tiles must share a parent before that parent is treated as the
 * preset row. Three of the four, so a renamed or removed tile does not switch
 * the feature off, while a single stray element called "Custom" somewhere else
 * in the panel can never drag its container into this.
 */
const MIN_TILES = 3;

const HIDDEN_CLASS = 'kc-hidden';

/**
 * The value that appears most often, with its count.
 *
 * Pulled out because it is the part with an off-by-one in it and the rest is
 * DOM. Ties go to whichever was seen first, which for elements in document
 * order means the topmost container.
 */
export function dominant<T>(values: readonly T[]): { value: T; count: number } | null {
  let best: { value: T; count: number } | null = null;
  const counts = new Map<T, number>();

  for (const value of values) {
    const count = (counts.get(value) ?? 0) + 1;
    counts.set(value, count);
    if (!best || count > best.count) best = { value, count };
  }

  return best;
}

/** True for an element whose own label is one of the preset names. */
export function isPresetLabel(text: string): boolean {
  return PRESET_LABELS.has(text.replace(/\s+/g, ' ').trim().toLowerCase());
}

/**
 * The subtree to search.
 *
 * The tiles sit above `#settHolder` rather than inside it, so searching the
 * holder finds nothing. Walking a bounded number of levels up gets the
 * settings window without needing to know its id, and without ever reaching
 * the whole page — an unbounded search could match a "Custom" somewhere in
 * Krunker's menu and hide a chunk of the game.
 */
function searchRoot(holder: HTMLElement, levels = 5): HTMLElement {
  let root = holder;
  for (let i = 0; i < levels && root.parentElement; i++) root = root.parentElement;
  return root;
}

/**
 * Hide the preset row if it is up. Safe to call on every render: it re-finds
 * the row each time, because Krunker rebuilds this markup like everything else
 * in the settings window.
 */
export function hidePresetTiles(holder: HTMLElement): void {
  const root = searchRoot(holder);

  const parents: HTMLElement[] = [];
  for (const el of root.querySelectorAll<HTMLElement>('div,button,span,a')) {
    // Leaf-ish only: an ancestor's textContent includes every tile's label,
    // which would otherwise make the grid's own container look like a tile.
    if (el.childElementCount > 0) continue;
    if (!isPresetLabel(el.textContent ?? '')) continue;

    // The tile is usually the labelled element's parent, not the label itself.
    const tile = el.parentElement;
    const container = tile?.parentElement;
    if (container) parents.push(container);
  }

  const best = dominant(parents);
  if (!best || best.count < MIN_TILES) return;

  best.value.classList.add(HIDDEN_CLASS);
}
