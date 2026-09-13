import { KRUNKER_DOM_IDS } from '../../krunker/constants';
import { coalesced } from '../schedule';

/**
 * One observer for everything that mounts into Krunker's ranked menu.
 *
 * Two things do now: the queue launcher in the footer, and the progress bar
 * on the rank card. Both need the same signal, which is "the menu has been
 * rebuilt, put yourself back", and both would otherwise install a childList
 * observer over the whole of #uiBase to get it. That subtree is the entire
 * game UI and it churns hard in a match, killfeed lines and ammo counts and
 * leaderboard rows, so two of them is twice the walking for one answer.
 *
 * Same shape as `menu-item.ts`, which does this for rows in the left menu:
 * register a placer, get called whenever anything moves, and bail cheaply
 * when there is nothing to do.
 */

const placers: (() => void)[] = [];
let observer: MutationObserver | null = null;

const placeAll = coalesced((): void => {
  for (const place of placers) place();
});

/**
 * Call `place` now, and again whenever the menu changes under it.
 *
 * `place` is expected to be cheap when there is nothing to do, because this
 * runs on every mutation batch: one querySelector that misses is the normal
 * case, since the ranked menu is shut nearly all the time.
 */
export function watchRankedMenu(place: () => void): void {
  placers.push(place);
  place();

  if (observer) return;
  const root = document.getElementById(KRUNKER_DOM_IDS.uiBase) ?? document.body;
  if (!root) return;
  observer = new MutationObserver(placeAll);
  observer.observe(root, { childList: true, subtree: true });
}
