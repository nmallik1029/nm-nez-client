import { ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';
import { SHEETS, STYLE_IDS, UI_IDS } from '../shared/ui';
import { defineStyle } from './style';

/**
 * Adds a launcher for the external queue into Krunker's own ranked panel.
 *
 * It sits in the footer row between the "All regions" checkbox and FIND MATCH,
 * which is where you look when you are about to queue anyway. Measured against
 * the live DOM:
 *
 *   .footer-controls
 *     ├─ .queue-all-regions-container   ("All regions")
 *     └─ FIND MATCH
 *
 * Selectors only match the stable part of each class. The markup is
 * Svelte-compiled and every class carries a build hash (svelte-mqcul7) that
 * moves whenever they rebuild, so matching the whole thing breaks on their
 * next deploy.
 */

const BUTTON_ID = UI_IDS.queueButton;
const FOOTER_SELECTOR = '[class*="footer-controls"]';
const REGIONS_SELECTOR = '[class*="queue-all-regions-container"]';

function buildButton(): HTMLElement {
  const button = document.createElement('div');
  button.id = BUTTON_ID;
  button.title = 'Open the external ranked queue. Keeps queueing with the game closed';
  // The usual "open in new window" glyph, inline so there's no asset to load
  // and nothing to 404.
  button.innerHTML =
    '<svg viewBox="0 0 24 24"><path d="M14 4h6v6"/><path d="M20 4 11 13"/>' +
    '<path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    ipcRenderer.send(IPC.rankedOpen);
  });
  return button;
}

function place(): void {
  const footer = document.querySelector(FOOTER_SELECTOR);
  if (!footer) return;
  if (footer.querySelector(`#${BUTTON_ID}`)) return;

  defineStyle(STYLE_IDS.queueButton, SHEETS.queueButton);
  const button = buildButton();
  const regions = footer.querySelector(REGIONS_SELECTOR);

  // After the regions checkbox if it's there, otherwise before the last child
  // (FIND MATCH) so we never end up past it.
  if (regions?.parentElement === footer) regions.insertAdjacentElement('afterend', button);
  else footer.insertBefore(button, footer.lastElementChild);
}

/**
 * Watch for the ranked panel showing up.
 *
 * It's built and torn down as you navigate, and Svelte re-renders the footer
 * on state changes, so inserting once doesn't stick. The observer puts the
 * button back whenever it goes missing, and the early return in `place()`
 * keeps the common case down to one querySelector.
 */
export function installRankedLaunchButton(): void {
  place();

  const root = document.getElementById('uiBase') ?? document.body;
  if (!root) return;

  const observer = new MutationObserver(() => place());
  observer.observe(root, { childList: true, subtree: true });
}
