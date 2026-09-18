import { KRUNKER_MODS } from '../krunker/constants';

/**
 * The markup side of the mods additions, kept pure so it can be tested
 * without a page: which window is which, what Reset Mods runs, and where its
 * link goes in the HTML each window's `gen()` returns.
 */

/** Where a window with this label sits in Krunker's `windows[]`, or -1. */
export function windowIndexByLabel(windows: readonly unknown[], label: string): number {
  return windows.findIndex(
    (win) => typeof win === 'object' && win !== null && (win as { label?: unknown }).label === label,
  );
}

/**
 * What Reset Mods runs, as an inline handler in the page's own scope.
 *
 * Exactly what Krunker's hidden Ctrl+/ shortcut runs, taken from its game.js:
 * forget the mod that loads on launch, then `reset(true)` on the Mod Manager,
 * which unloads textures, sounds, shaders and the mod's CSS and says "Mods
 * Cleared". The Reset Mods at the bottom of the manager's Loaded tab skips the
 * first half, so the mod it just cleared comes back the next time you start.
 *
 * `refresh` redraws the Mod Manager afterwards, for a link inside it: the
 * quiet reset does not, and its Loaded tab would go on listing the mod.
 */
export function resetModsScript(managerIndex: number, refresh = false): string {
  const redraw = refresh ? `;window.updateWindow&&updateWindow(${managerIndex + 1})` : '';
  return `setLastMod('');windows[${managerIndex}].reset(true)${redraw}`;
}

/** Marks our link, so HTML that already has one is never given a second. */
const RESET_ATTR = 'data-nm-reset-mods';

function resetLink(managerIndex: number, refresh: boolean): string {
  return (
    `<a href='javascript:;' class='${KRUNKER_MODS.linkClass}' ${RESET_ATTR}` +
    ` title='Unload every mod, and stop the last one loading when you start'` +
    ` onclick="${resetModsScript(managerIndex, refresh)}">Reset Mods</a>`
  );
}

/**
 * Load Mods, with Reset Mods on a line of its own under the URL row.
 *
 * Its own line because that row is a 78% input and the Load Mod link, and a
 * second link beside them wraps somewhere arbitrary.
 */
export function withResetInLoader(html: string, managerIndex: number): string {
  if (html.includes(RESET_ATTR)) return html;
  return `${html}<div style='margin-top:20px'>${resetLink(managerIndex, false)}</div>`;
}

/**
 * The Mod Manager, with Reset Mods after its Load Mod | Upload Mod links.
 *
 * Found by the window each link opens rather than by its text, which Krunker
 * translates. `linkTargets` are window indices in order of preference. The
 * HTML comes back unchanged if none of those links is there: a missing
 * button is better than one wedged into markup this was not written against.
 */
export function withResetInManager(
  html: string,
  managerIndex: number,
  linkTargets: readonly number[],
): string {
  if (html.includes(RESET_ATTR)) return html;
  for (const target of linkTargets) {
    if (target < 0) continue;
    const link = new RegExp(`<a\\b[^>]*showWindow\\(${target + 1}\\)[^>]*>[^<]*</a>`);
    const found = link.exec(html);
    if (!found) continue;
    const end = found.index + found[0].length;
    return `${html.slice(0, end)} | ${resetLink(managerIndex, true)}${html.slice(end)}`;
  }
  return html;
}
