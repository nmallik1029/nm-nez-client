import { BRANDING } from '../shared/branding';
import { CHANGELOG } from '../shared/changelog';

/**
 * Client name and version in the in-game HUD, under the round timer.
 *
 * Lives inside Krunker's own top-left stack instead of floating over the page,
 * so it moves, hides and scales with the HUD.
 *
 * The game has two layouts for that stack and marks the older one by adding a
 * `topLeftOld` class to everything in it, which changes the text size and
 * whether there's an outline. The CSS below copies what Krunker does to
 * `#matchInfo` either way, keyed off that element's own class with `:has()`.
 * The class turns up after the page loads and can change again mid-session, so
 * reading it once when we insert gets it wrong.
 *
 * Version comes off the changelog rather than a constant, so the number here
 * can't disagree with the newest entry in the panel.
 */

const ID = 'nm-hud-version';
const STYLE_ID = 'nm-hud-version-css';

const VERSION = CHANGELOG[0]?.version ?? '';

/*
 * Both blocks match #matchInfo's own rules. The current layout draws a hard
 * four-way outline because the text sits straight on the map. The older one is
 * bigger and goes without.
 */
const CSS = `
#${ID}{display:block;color:#fff;font-size:12px;margin-bottom:5px;
  text-shadow:#202020 -1px -1px 0,#202020 1px -1px 0,#202020 -1px 1px 0,#202020 1px 1px 0}
#topLeftMatchData:has(> #matchInfo.topLeftOld) > #${ID}{
  font-size:15px;margin-bottom:2px;text-shadow:unset}
`;

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head?.appendChild(style);
}

/** Returns false only while the HUD stack is not in the document yet. */
function place(): boolean {
  const row = document.getElementById('topLeftMatchData');
  const info = document.getElementById('matchInfo');
  if (!row || !info || info.parentElement !== row) return false;
  if (document.getElementById(ID)) return true;

  injectStyle();
  const line = document.createElement('div');
  line.id = ID;
  line.textContent = VERSION === '' ? BRANDING.productName : `${BRANDING.productName} ${VERSION}`;
  row.insertBefore(line, info);
  return true;
}

export function installWatermark(): void {
  if (place()) return;

  // The HUD stack is static markup, so this only covers running before
  // Krunker's script has built the page. One placement and the observer stops,
  // which keeps it clear of everything the HUD does per frame after that.
  const observer = new MutationObserver(() => {
    if (place()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
