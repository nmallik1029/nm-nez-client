import { KRUNKER_MODS } from '../krunker/constants';
import { UI_IDS } from '../shared/ui';
import { installLobbyButton } from './lobby-button';
import { windowIndexByLabel, withResetInLoader, withResetInManager } from './mods-markup';

/**
 * Mods from inside a match: a Mods button on the lobby's icon row (placed by
 * `lobby-button.ts`), and Reset Mods in the windows that load them.
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

  // Registered, not placed: the icon row is only built on entering one of
  // those lobbies, so `lobby-button.ts` waits for it and puts it back on
  // every rebuild. Nothing here has to wait for that to have happened.
  installLobbyButton({
    id: UI_IDS.lobbyModsButton,
    icon: KRUNKER_MODS.icon,
    title: 'Mods',
    // Krunker's own, in its own scope: the same window More Krunker opens.
    onclick: `playSelect(),showWindow(${manager + 1})`,
  });
  const inLoader = wrapGen(windows[loader], (html) => withResetInLoader(html, manager));
  const inManager = wrapGen(windows[manager], (html) =>
    withResetInManager(html, manager, [publish, loader]),
  );
  return inLoader && inManager;
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
