import { ipcRenderer } from 'electron';
import { badgesFor } from '../shared/badges';
import { BRANDING } from '../shared/branding';
import { IPC } from '../shared/ipc';
import { SHEETS, STYLE_IDS, UI_CLASSES } from '../shared/ui';
import { defineStyle } from './style';

/**
 * Badges beside a name, on the two scoreboards.
 *
 * Who wears what is in `shared/badges.ts`; the pictures come from main, which
 * reads `assets/badges/` and hands them over as data URLs. This is the part
 * that puts one next to a name.
 *
 * Drawn to sit where Krunker's own verification and premium marks sit, which
 * is what makes them look like they came with the game rather than after it:
 * their rule is `vertical-align:middle; margin-right:3px` with premium adding
 * `margin-bottom:-2px`, read off the running game's own stylesheet. The last
 * of those is the slight drop that keeps a badge from looking like it is
 * floating above the text, and it is why these sit a touch low rather than
 * dead centre.
 */

/** Badge id to data URL. Null until main has answered. */
let images: Map<string, string> | null = null;
/** Ids someone has been given that no file backs, said once each. */
const missing = new Set<string>();

/**
 * Fetch the pictures, then tell the boards to redraw.
 *
 * The fetch is one IPC round trip at startup and the boards are usually
 * already up by the time it lands, hence the callback: without it the first
 * scoreboard of a session would have no badges on it and nothing would put
 * them there until the rows happened to be rebuilt.
 *
 * A client with no badges in it asks for nothing else. `images` ends up
 * empty, `applyBadges` returns immediately every time, and no stylesheet is
 * ever installed.
 */
export function installBadges(repaint: () => void): void {
  void ipcRenderer
    .invoke(IPC.badges)
    .then((list: unknown) => {
      const badges = Array.isArray(list) ? (list as { id: string; image: string }[]) : [];
      images = new Map(badges.map((badge) => [badge.id, badge.image]));
      if (images.size > 0) repaint();
    })
    .catch(() => {
      // Older main process, or a folder it could not read. No badges, and
      // nothing else in the client cares.
      images = new Map();
    });
}

/**
 * Put this player's badges in front of their name.
 *
 * Takes the name and clan already split, because the callers have them that
 * way: Krunker gives the clan as its own span inside the name element, so
 * nobody needs to parse `Name [CLAN]` out of a blob of text.
 *
 * Clears its own badges first. The boards are rebuilt constantly and a
 * repaint can land on an element that already has them, and two copies of
 * someone's badge is worse than none.
 */
export function applyBadges(el: HTMLElement, name: string, clan: string | null): void {
  if (images === null || images.size === 0) return;

  const wanted = badgesFor(name, clan);
  if (wanted.length === 0) return;

  defineStyle(STYLE_IDS.badges, SHEETS.badges);
  for (const old of el.querySelectorAll(`.${UI_CLASSES.badge}`)) old.remove();

  // Each goes before the same node, which is the name's own text, so they
  // come out in the order the list gave them.
  const before = el.firstChild;
  for (const id of wanted) {
    const src = images.get(id);
    if (src === undefined) {
      if (!missing.has(id)) {
        missing.add(id);
        console.warn(BRANDING.logPrefix, `badge "${id}" has no file in assets/badges`);
      }
      continue;
    }

    const img = document.createElement('img');
    img.className = UI_CLASSES.badge;
    img.src = src;
    // Decorative: the name is right beside it and a badge has nothing to add
    // to a screen reader that the name does not already say.
    img.alt = '';
    el.insertBefore(img, before);
  }
}
