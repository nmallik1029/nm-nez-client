import { coalesced } from './schedule';

/**
 * Rows of ours in Krunker's own left menu.
 *
 * The row is cloned from one of the game's rather than built by hand. The
 * menu is Svelte-compiled and its styling hides behind a per-build hash class
 * ("menuItem svelte-fgmdj8"), so anything we assemble ourselves matches none
 * of it and renders unstyled. Cloning gets the icon sizing, the type, the
 * hover and the hash, whatever the hash is this build.
 *
 * This started as private code in `changelog.ts` and moved here when QoL
 * Features wanted the same row at the other end of the list. Two copies of a
 * clone-and-restyle routine is two things to fix the day Krunker changes
 * what a menu row is made of.
 */

/** Krunker's left menu list. */
const CONTAINER_ID = 'menuItemContainer';
/**
 * Krunker's own Exit row, which it keeps last and ships hidden.
 *
 * A row added at the bottom goes above it, so ours is the last one you can
 * see whether or not the game ever shows its own.
 */
const EXIT_ID = 'clientExit';

export interface MenuItemSpec {
  /** Ours, so the row can be found again after a rebuild. */
  readonly id: string;
  /** Material Icons ligature. Matches the game's own outlined set. */
  readonly icon: string;
  readonly label: string;
  /** Above the game's first row, or below its last. */
  readonly position: 'top' | 'bottom';
  readonly onClick: () => void;
}

const items: MenuItemSpec[] = [];
let observer: MutationObserver | null = null;

/**
 * Find a menu row worth copying. Skips anything with an id already or one of
 * the promo classes: battle pass and guide rows are .menuItem too but carry
 * extra structure, and the promo ones are hidden, which we'd inherit.
 */
function findTemplate(container: HTMLElement): HTMLElement | null {
  for (const el of container.querySelectorAll<HTMLElement>('.menuItem')) {
    if (el.id !== '') continue;
    const cls = String(el.className);
    if (cls.includes('bpItem') || cls.includes('dsItem') || cls.includes('guideItem')) continue;
    if (!el.querySelector('.menuItemIcon') || !el.querySelector('.menuItemTitle')) continue;
    return el;
  }
  return null;
}

/** The game's own hover and click sounds, if they are there yet. */
function tick(): void {
  const play = (window as unknown as { playTick?: () => void }).playTick;
  if (typeof play === 'function') play();
}

function select(): void {
  const play = (window as unknown as { playSelect?: (volume: number) => void }).playSelect;
  if (typeof play === 'function') play(0.1);
}

function place(spec: MenuItemSpec): void {
  const container = document.getElementById(CONTAINER_ID);
  if (!container) return;
  if (document.getElementById(spec.id)) return;

  const template = findTemplate(container);
  if (!template) return;

  const item = template.cloneNode(true) as HTMLElement;
  item.id = spec.id;
  // The template might be hidden itself, and ids inside the clone would
  // duplicate the game's own.
  item.style.removeProperty('display');
  item.removeAttribute('onclick');
  for (const el of item.querySelectorAll('[id]')) el.removeAttribute('id');

  const icon = item.querySelector('.menuItemIcon');
  if (icon) icon.textContent = spec.icon;

  const title = item.querySelector('.menuItemTitle');
  if (!title) return;
  // replaceChildren throws out whatever the template had in it (badges,
  // counters, Svelte's comment markers) and leaves just our label.
  title.replaceChildren(document.createTextNode(spec.label));
  title.removeAttribute('onclick');

  item.addEventListener('mouseenter', tick);
  item.addEventListener('click', () => {
    select();
    spec.onClick();
  });

  if (spec.position === 'top') {
    container.insertBefore(item, container.firstChild);
    return;
  }
  // insertBefore wants a child of this container, so the Exit row is looked
  // for among the children rather than anywhere under them. A null reference
  // node appends, which is the right answer when the game has no Exit row.
  const exit = [...container.children].find((el) => el.id === EXIT_ID) ?? null;
  container.insertBefore(item, exit);
}

function placeAll(): void {
  for (const spec of items) place(spec);
}

/**
 * Add a row and keep it there.
 *
 * Krunker rebuilds the menu list on navigation and throws the clone away, so
 * one observer puts every registered row back. `place()` bails after one
 * getElementById in the normal case where the row is already up, which is
 * what keeps the steady state cheap: this runs on every mutation batch.
 */
export function installMenuItem(spec: MenuItemSpec): void {
  items.push(spec);
  place(spec);

  if (observer) return;
  const root = document.getElementById('menuHider') ?? document.body;
  if (!root) return;
  observer = new MutationObserver(coalesced(placeAll));
  observer.observe(root, { childList: true, subtree: true });
}
