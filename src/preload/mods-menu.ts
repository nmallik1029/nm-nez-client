import { KRUNKER_MODS } from '../krunker/constants';
import { UI_IDS } from '../shared/ui';
import { windowIndexByLabel, withResetInLoader, withResetInManager } from './mods-markup';

/**
 * Mods from inside a match: a Mods button on the lobby's icon row, and Reset
 * Mods in the windows that load them.
 *
 * A competitive or custom lobby, and a ranked match, swap Krunker's menu for a
 * row of square icon buttons (`#compBtnLst`): loadout, customize, settings,
 * spectate, profile, invite, join. The menu's own Mods entry is under More
 * Krunker, which that screen does not show, so there was no way to change
 * mods without leaving. The button added here opens the same Mod Manager
 * More Krunker does, and Krunker's loader has no rule against loading one
 * mid-match: the only gate in `loadModPack` is your own "load mods" setting.
 *
 * Reset Mods runs what Krunker's hidden Ctrl+/ does. See `mods-markup.ts`.
 *
 * Always on. It adds a button and a link, and neither does anything until
 * clicked.
 */

type WindowGen = ((...args: unknown[]) => unknown) & { __nmModsPatched?: boolean };

interface KrunkerWindow {
  label?: unknown;
  gen?: WindowGen;
}

interface ModsPage {
  windows?: KrunkerWindow[];
  canShowMods?: unknown;
}

const page = (): ModsPage => window as unknown as ModsPage;

/**
 * Pass a window's `gen()` output through `transform`.
 *
 * Krunker calls `windows[i].gen()` every time it draws the window, so the
 * wrapper runs on every open and nothing has to watch for it. Anything that
 * goes wrong in ours hands back Krunker's HTML untouched: a missing Reset
 * Mods link is not worth a window that will not open.
 */
function wrapGen(win: KrunkerWindow | undefined, transform: (html: string) => string): boolean {
  const original = win?.gen;
  if (!win || typeof original !== 'function') return false;
  if (original.__nmModsPatched === true) return true;

  const wrapped: WindowGen = function (this: unknown, ...args: unknown[]): unknown {
    const html = original.apply(this, args);
    if (typeof html !== 'string') return html;
    try {
      return transform(html);
    } catch {
      return html;
    }
  };
  wrapped.__nmModsPatched = true;
  win.gen = wrapped;
  return true;
}

/**
 * Add Mods to the lobby's icon row, as a copy of the row's own Settings button.
 *
 * Copied rather than built so it keeps their size, blue, icon style and the
 * tick on hover without this file owning any of it. It goes straight after
 * Settings, with the other two blue buttons that change how the game looks.
 * The handler is an inline string like its neighbours', run in the page's own
 * scope: `playSelect` and `showWindow` are theirs.
 */
function placeLobbyButton(managerIndex: number): boolean {
  if (document.getElementById(UI_IDS.lobbyModsButton)) return true;
  const bar = document.getElementById(KRUNKER_MODS.lobbyBarId);
  if (!bar) return false;

  const template =
    Array.from(bar.children).find((el) =>
      (el.getAttribute('onclick') ?? '').includes(KRUNKER_MODS.lobbyTemplateOnclick),
    ) ?? bar.firstElementChild;
  if (!template) return false;

  const button = template.cloneNode(true) as HTMLElement;
  button.id = UI_IDS.lobbyModsButton;
  for (const el of button.querySelectorAll('[id]')) el.removeAttribute('id');
  button.setAttribute('onclick', `playSelect(),showWindow(${managerIndex + 1})`);
  button.title = 'Mods';
  const icon = button.querySelector('.material-icons, .material-icons-outlined');
  if (icon) icon.textContent = KRUNKER_MODS.icon;

  template.insertAdjacentElement('afterend', button);
  return true;
}

/**
 * Everything, once the game has built what it touches.
 *
 * Returns true when there is nothing left to wait for: all three pieces are
 * in, or this page has no mods to offer.
 */
function install(): boolean {
  const { windows, canShowMods } = page();
  if (!Array.isArray(windows)) return false;
  // Krunker's own switch for its Mods menu, off on its Microsoft Store build.
  if (canShowMods === false) return true;

  const manager = windowIndexByLabel(windows, KRUNKER_MODS.managerLabel);
  if (manager < 0) return false;
  const loader = windowIndexByLabel(windows, KRUNKER_MODS.loaderLabel);
  const publish = windowIndexByLabel(windows, KRUNKER_MODS.publishLabel);

  const lobby = placeLobbyButton(manager);
  const inLoader = wrapGen(windows[loader], (html) => withResetInLoader(html, manager));
  const inManager = wrapGen(windows[manager], (html) =>
    withResetInManager(html, manager, [publish, loader]),
  );
  return lobby && inLoader && inManager;
}

/**
 * `windows[]` and the lobby row are both built by the game's own script, after
 * the preload has run, so this polls for them the way the name highlights do
 * and stops as soon as it has everything.
 */
const POLL_MS = 500;
const GIVE_UP_AFTER = 120; // a minute, then assume the page is not the game

let poll: ReturnType<typeof setInterval> | null = null;

export function installModsMenu(): void {
  if (poll !== null || install()) return;
  let attempts = 0;
  poll = setInterval(() => {
    attempts += 1;
    if (!install() && attempts < GIVE_UP_AFTER) return;
    if (poll !== null) clearInterval(poll);
    poll = null;
  }, POLL_MS);
}
