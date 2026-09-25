import { KRUNKER_MODS } from '../krunker/constants';
import { coalesced } from './schedule';

/**
 * Buttons of ours on the lobby's icon row.
 *
 * A competitive or custom lobby, and a ranked match, swap Krunker's left menu
 * for a row of square icon buttons (`#compBtnLst`): loadout, customize,
 * settings, spectate, profile, invite, join. Anything of ours that lives in
 * the left menu is unreachable on that screen, so it needs a button here too.
 *
 * The button is cloned from the row's own Settings button rather than built,
 * for the reason `menu-item.ts` clones a menu row: the styling is Krunker's
 * and some of it hides behind classes we would have to match by hand. Cloning
 * gets the size, the blue, the icon set and the hover whatever they are this
 * build.
 *
 * This started as private code in `mods-menu.ts` and moved here when QoL
 * Features wanted the same button on the same row -- the same move
 * `menu-item.ts` came out of, and for the same reason: two copies of a
 * clone-and-restyle routine is two things to fix the day Krunker changes what
 * one of these buttons is made of.
 *
 * KEPT THERE, rather than placed once. The row does not exist in the menu at
 * all; it is built when you enter one of those lobbies and thrown away when
 * you leave. Polling for it only until it first turns up means a button that
 * never appears for anyone who joins a ranked match a minute after launch, so
 * one observer puts every registered button back instead.
 */

export interface LobbyButtonSpec {
  /** Ours, so the button can be found again after the row is rebuilt. */
  readonly id: string;
  /** Material Icons ligature, from the game's own set. */
  readonly icon: string;
  /** Its tooltip. The row's buttons carry no visible label. */
  readonly title: string;
  /**
   * A handler in the page's own scope, as an inline attribute, for the ones
   * that only have to reach Krunker's own globals (`showWindow`, `playSelect`).
   */
  readonly onclick?: string;
  /**
   * A handler of ours, for a panel the page's scope cannot reach. Gets the
   * game's own click sound, which an inline handler would have called itself.
   */
  readonly onClick?: () => void;
}

const specs: LobbyButtonSpec[] = [];
let observer: MutationObserver | null = null;

/** The game's own click sound, if it is there yet. As `menu-item.ts` does it. */
function select(): void {
  const play = (window as unknown as { playSelect?: (volume: number) => void }).playSelect;
  if (typeof play === 'function') play(0.1);
}

/**
 * The row's Settings button, the one worth copying.
 *
 * Falls back to whatever is first: a row that has been rearranged is still
 * better served by a button that looks like its neighbours than by none.
 */
function findTemplate(bar: HTMLElement): Element | null {
  return (
    Array.from(bar.children).find((el) =>
      (el.getAttribute('onclick') ?? '').includes(KRUNKER_MODS.lobbyTemplateOnclick),
    ) ?? bar.firstElementChild
  );
}

/**
 * Put every registered button on the row, in the order they were registered.
 *
 * Each goes after the one before it so the order is the same every time the
 * row is rebuilt, rather than reversing because they all inserted themselves
 * directly after Settings.
 */
function placeAll(): void {
  const bar = document.getElementById(KRUNKER_MODS.lobbyBarId);
  if (!bar) return;
  const template = findTemplate(bar);
  if (!template) return;

  let anchor: Element = template;
  for (const spec of specs) {
    const existing = document.getElementById(spec.id);
    if (existing) {
      anchor = existing;
      continue;
    }
    anchor = place(spec, template, anchor);
  }
}

function place(spec: LobbyButtonSpec, template: Element, anchor: Element): Element {
  const button = template.cloneNode(true) as HTMLElement;
  button.id = spec.id;
  // Ids inside the clone would be the game's own, twice over.
  for (const el of button.querySelectorAll('[id]')) el.removeAttribute('id');
  button.removeAttribute('onclick');

  if (spec.onclick !== undefined) {
    button.setAttribute('onclick', spec.onclick);
  } else if (spec.onClick) {
    const run = spec.onClick;
    button.addEventListener('click', () => {
      select();
      run();
    });
  }

  button.title = spec.title;
  const icon = button.querySelector('.material-icons, .material-icons-outlined');
  if (icon) icon.textContent = spec.icon;

  anchor.insertAdjacentElement('afterend', button);
  return button;
}

/**
 * Register a button and keep it on the row.
 *
 * Safe to call before the game has built anything: nothing happens until the
 * row exists, and the observer is what notices when it does.
 */
export function installLobbyButton(spec: LobbyButtonSpec): void {
  if (specs.some((existing) => existing.id === spec.id)) return;
  specs.push(spec);
  placeAll();

  if (observer || !document.body) return;
  observer = new MutationObserver(coalesced(placeAll));
  observer.observe(document.body, { childList: true, subtree: true });
}
